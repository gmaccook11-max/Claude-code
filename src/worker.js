// RE-Mind on Cloudflare Workers. The app itself is served from ./public as static
// assets; this script only answers /api/feed, the school calendar relay.
//
// School sites such as Schoology and Canvas do not let a web page read their calendar
// links directly, so the app asks this relay to fetch the link for it. It only passes
// through public https calendar (.ics) data and stores nothing.

const MAX_BYTES = 2 * 1024 * 1024;

function allowed(url) {
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const h = url.hostname.toLowerCase();
  if (!h.includes('.') || h.endsWith('.local') || h.endsWith('.internal') || h === 'localhost') return false;
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return false; // no raw IP addresses
  return true;
}

const fail = (status, message) => new Response(message, { status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });

async function feed(request) {
  let target;
  try { target = new URL(new URL(request.url).searchParams.get('url')); } catch (e) { return fail(400, 'Missing or invalid url'); }
  if (!allowed(target)) return fail(400, 'Only public https calendar links are allowed');

  let res;
  try {
    // Follow redirects by hand so every hop is checked against the same rules.
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(target, { redirect: 'manual', headers: { accept: 'text/calendar, text/plain;q=0.8' } });
      if (res.status < 300 || res.status >= 400) break;
      target = new URL(res.headers.get('location'), target);
      if (!allowed(target)) return fail(400, 'Redirected to a link that is not allowed');
    }
  } catch (e) { return fail(502, 'Could not reach the calendar'); }
  if (!res.ok) return fail(502, 'The calendar link returned an error');

  const body = await res.text();
  if (body.length > MAX_BYTES) return fail(413, 'Calendar is too large');
  if (!body.slice(0, 2000).includes('BEGIN:VCALENDAR')) return fail(415, 'That link is not a calendar feed');

  return new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/feed' && request.method === 'GET') return feed(request);
    return env.ASSETS.fetch(request);
  }
};
