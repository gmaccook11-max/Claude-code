// Background reminders for RE-Mind.
//
// The app uploads the list of upcoming reminders for one phone. A Durable Object keeps
// that list, wakes itself up when the next one is due, and sends it to the phone as a Web
// Push message, so reminders arrive even when the app is closed.
//
// Each phone gets its own Durable Object and its own signing key, created on first use
// and kept in the object's storage. There are no secrets to configure.

import { DurableObject } from 'cloudflare:workers';

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Only real browser push services, so the worker cannot be pointed at arbitrary sites.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
function pushUrl(endpoint, env) {
  let url;
  try { url = new URL(endpoint); } catch (e) { return null; }
  if (env.PUSH_TEST_HOST && url.host === env.PUSH_TEST_HOST) return url;   // local testing only
  return url.protocol === 'https:' && PUSH_HOSTS.some(h => h.test(url.hostname)) ? url : null;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// Message encryption for Web Push (RFC 8291, "aes128gcm").
export async function encryptPayload(subscription, text) {
  const uaPublic = unb64u(subscription.keys.p256dh), auth = unb64u(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, cipher);
}

// Signed token that tells the push service which app server is sending (VAPID, RFC 8292).
export async function vapidHeader(keys, endpoint, subject) {
  const part = obj => b64u(enc.encode(JSON.stringify(obj)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`;
}

const text = (v, max) => String(v ?? '').slice(0, max);

export class Reminders extends DurableObject {
  async keys() {
    let keys = await this.ctx.storage.get('keys');
    if (!keys) {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      keys = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) };
      await this.ctx.storage.put('keys', keys);
    }
    return keys;
  }

  async send(state, reminder) {
    const url = pushUrl(state.subscription.endpoint, this.env);
    if (!url) return 410;
    const body = await encryptPayload(state.subscription, JSON.stringify({ title: reminder.title, body: reminder.body, tag: reminder.tag }));
    const res = await fetch(url, {
      method: 'POST', body,
      headers: {
        'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '3600', urgency: 'high',
        authorization: await vapidHeader(await this.keys(), url.href, state.subject)
      }
    });
    return res.status;
  }

  async schedule(state) {
    await this.ctx.storage.put('state', state);
    if (state.subscription && state.reminders.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, state.reminders[0].at));
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const state = await this.ctx.storage.get('state');
    if (!state?.subscription) return;
    const now = Date.now();
    let sent = 0, retryAt = 0;
    while (state.reminders.length && state.reminders[0].at <= now + 5000 && sent < 5) {
      const r = state.reminders[0];
      if (now - r.at > 2 * 3600e3) { state.reminders.shift(); continue; }          // too old to be useful
      let status = 0;
      try { status = await this.send(state, r); } catch (e) { status = 0; }
      if (status === 404 || status === 410 || status === 403) { state.subscription = null; state.gone = true; break; }  // phone unsubscribed
      if (status < 200 || status >= 300) {
        r.tries = (r.tries || 0) + 1;
        if (r.tries < 4) { retryAt = now + 60e3; break; }
      }
      state.reminders.shift(); sent++;
    }
    state.lastRun = now;
    await this.ctx.storage.put('state', state);
    if (!state.subscription || !state.reminders.length) return;
    await this.ctx.storage.setAlarm(retryAt || Math.max(now + 1000, state.reminders[0].at));
  }

  async fetch(request) {
    const url = new URL(request.url), action = url.pathname.split('/').pop();
    if (action === 'key') return json({ key: (await this.keys()).publicKey });

    let data = {};
    try { data = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
    const state = (await this.ctx.storage.get('state')) || { subscription: null, reminders: [] };

    if (action === 'off') { await this.ctx.storage.deleteAlarm(); await this.ctx.storage.delete('state'); return json({ ok: true }); }

    const sub = data.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !pushUrl(sub.endpoint, this.env)) return json({ error: 'Bad subscription' }, 400);
    state.subscription = { endpoint: text(sub.endpoint, 1000), keys: { p256dh: text(sub.keys.p256dh, 200), auth: text(sub.keys.auth, 100) } };
    state.subject = url.origin;
    state.gone = false;

    if (action === 'schedule') {
      const now = Date.now();
      state.reminders = (Array.isArray(data.reminders) ? data.reminders : [])
        .filter(r => r && Number.isFinite(r.at) && r.at > now - 60e3 && r.at < now + 40 * 24 * 3600e3)
        .map(r => ({ at: r.at, title: text(r.title, 120), body: text(r.body, 400), tag: text(r.tag, 120) }))
        .sort((a, b) => a.at - b.at).slice(0, 300);
      await this.schedule(state);
      return json({ ok: true, count: state.reminders.length });
    }
    if (action === 'test') {
      const delay = Math.min(Math.max(+data.delay || 0, 0), 120) * 1000;
      state.reminders = [{ at: Date.now() + delay, title: text(data.title, 120) || 'RE-Mind test', body: text(data.body, 400), tag: 'test' }, ...state.reminders.filter(r => r.tag !== 'test')].sort((a, b) => a.at - b.at);
      await this.schedule(state);
      return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  }
}

// Routes /api/push/* to the Durable Object for the calling phone.
export async function handlePush(request, env) {
  const url = new URL(request.url);
  let device = url.searchParams.get('device');
  if (request.method === 'POST') {
    if (+request.headers.get('content-length') > 200000) return json({ error: 'Too large' }, 413);
    try { device = (await request.clone().json()).device; } catch (e) { return json({ error: 'Bad request' }, 400); }
  } else if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!/^[a-f0-9]{32,64}$/.test(device || '')) return json({ error: 'Bad device' }, 400);
  return env.REMINDERS.get(env.REMINDERS.idFromName(device)).fetch(request);
}
