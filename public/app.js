'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localInput = d => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const atTime = (day, hhmm) => new Date(`${day}T${hhmm}`);
const fmtTime = hhmm => atTime('2000-01-01', hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDay = day => {
  const t = ymd();
  if (day === t) return 'Today';
  if (day === ymd(addDays(new Date(), 1))) return 'Tomorrow';
  if (day === ymd(addDays(new Date(), -1))) return 'Yesterday';
  return new Date(`${day}T12:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtDue = iso => `${fmtDay(iso.slice(0, 10))}, ${fmtTime(iso.slice(11, 16))}`;

const QUOTES = [
  'Small steps today beat big plans tomorrow.',
  'Future you is counting on right now you.',
  'Done is better than perfect. Start with one thing.',
  'You do not have to feel like it. You just have to begin.',
  'Every box you tick is proof you keep your word.',
  'Ten focused minutes can change the whole day.',
  'Turn it in on time and enjoy the free evening.',
  'Discipline is remembering what you actually want.',
  'One assignment at a time. You have got this.',
  'Streaks are built on the days you did not feel like it.'
];
const TOUGH = [
  'No excuses. Do it now.',
  'You said this mattered. Prove it.',
  'Nobody else is going to do this for you.',
  'Late is a choice. Choose differently.',
  'Put the phone down and start.',
  'You have done harder things than this.',
  'Comfortable now means stressed later.',
  'Stop planning to do it. Do it.'
];
const GOALS = {
  grades: { label: 'Raise my grades', line: 'Every assignment you turn in moves your grade toward your goal.' },
  late: { label: 'Stop turning things in late', line: 'On time today means nothing late on your record.' },
  missing: { label: 'Stop missing assignments', line: 'Zero missing is the goal. Clear one now.' },
  habits: { label: 'Build better daily habits', line: 'Your streak is built one tick at a time.' },
  stress: { label: 'Feel less stressed about school', line: 'Getting it done now is how tonight stays calm.' }
};
const OBSTACLES = {
  procrastination: { label: 'I put things off', tip: 'Start with just five minutes.' },
  forgetting: { label: 'I forget what is due', tip: 'Do it now, while you are thinking about it.' },
  distractions: { label: 'My phone distracts me', tip: 'Put the phone face down until this is done.' },
  busy: { label: 'I am too busy', tip: 'Pick the smallest piece and finish that.' },
  motivation: { label: 'I do not feel motivated', tip: 'You do not need to feel ready. Start anyway.' }
};
const TONES = { encouraging: 'Encouraging', tough: 'Tough love', facts: 'Just the facts' };
const STARTERS = {
  grades: ['Check Schoology for new assignments', 'Study or review for 20 minutes'],
  late: ['Turn in everything due today', 'Check what is due tomorrow'],
  missing: ['Check what is due tomorrow', 'Check Schoology for new assignments'],
  habits: ['Pack my bag for tomorrow', 'Read for 20 minutes'],
  stress: ['Plan tomorrow before bed']
};
const pick = list => list[Math.floor(Math.random() * list.length)];
// A motivational line built from what the person told us at setup: their reason, their
// goals, what gets in their way, and the tone they asked for.
function quote() {
  const p = S.profile;
  if (p.tone === 'facts') return '';
  const tough = p.tone === 'tough';
  const personal = [];
  if (p.why) personal.push(tough ? `You said you want this: "${p.why}". Act like it.` : `Remember why you started: "${p.why}".`);
  if (p.goalText) personal.push(tough ? `Your goal, your words: "${p.goalText}". Earn it.` : `Keep going for your goal: "${p.goalText}".`);
  for (const g of p.goals) if (GOALS[g]) personal.push(GOALS[g].line);
  for (const o of p.obstacles) if (OBSTACLES[o]) personal.push(OBSTACLES[o].tip);
  if (personal.length && Math.random() < 0.6) return pick(personal);
  return pick(tough ? TOUGH : QUOTES);
}

/* ---------- school systems ---------- */
const PROVIDERS = {
  schoology: { name: 'Schoology', steps: 'On the Schoology website (not the phone app), open Calendar and choose Export or Share. You can also find it under Settings, Account Settings, "Share your Schoology calendar". Turn sharing on and copy the link it gives you.' },
  canvas: { name: 'Canvas', steps: 'On the Canvas website, open Calendar, choose "Calendar Feed" at the bottom of the right-hand side, and copy the link.' },
  google: { name: 'Google Classroom', steps: 'Open Google Calendar on a computer, go to Settings, pick a class calendar on the left, and copy "Secret address in iCal format". Add one connection for each class.' },
  other: { name: 'Other school system', steps: 'Open the calendar in your school system and look for Export, Subscribe or iCal. Copy the link it gives you. If it only offers a download, use "Import .ics file" instead.' }
};

/* ---------- state ---------- */
const KEY = 'remind.v1';
const DEFAULTS = {
  daily: [], dailyLog: {}, tasks: [], assignments: [], classes: [], feeds: [], sent: {}, acked: {},
  profile: { done: false, goals: [], goalText: '', why: '', obstacles: [], gradeGoal: null, tone: 'encouraging' },
  settings: { name: '', notif: false, morning: '07:30', evening: '20:00', nagMins: 30, motivate: true, callouts: true }
};
let S = load();
let tab = 'today';
let schoolSeg = 'assignments';

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* start fresh */ }
  const s = { ...structuredClone(DEFAULTS), ...saved };
  s.settings = { ...DEFAULTS.settings, ...(saved.settings || {}) };
  s.profile = { ...DEFAULTS.profile, ...(saved.profile || {}) };
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this device'); }
}

/* ---------- derived data ---------- */
const dailyFor = day => S.daily.filter(i => i.created <= day);
function dayStats(day) {
  const items = dailyFor(day);
  const log = S.dailyLog[day] || {};
  const done = items.filter(i => log[i.id]).length;
  return { items, done, total: items.length, left: items.filter(i => !log[i.id]) };
}
function streak() {
  let n = 0;
  const t = dayStats(ymd());
  if (t.total && t.done === t.total) n++;
  for (let i = 1; i < 366; i++) {
    const s = dayStats(ymd(addDays(new Date(), -i)));
    if (!s.total || s.done < s.total) break;
    n++;
  }
  return n;
}
const isMissing = a => a.status === 'todo' && new Date(a.due) < new Date();
const missing = () => S.assignments.filter(isMissing).sort((a, b) => a.due.localeCompare(b.due));
const upcoming = () => S.assignments.filter(a => a.status === 'todo' && !isMissing(a)).sort((a, b) => a.due.localeCompare(b.due));
const turnedIn = () => S.assignments.filter(a => a.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
const lateOnes = () => turnedIn().filter(a => a.late);
const belowGoal = () => S.classes.filter(c => c.goal != null && c.grade != null && c.grade < c.goal);
const letter = g => g >= 90 ? 'A' : g >= 80 ? 'B' : g >= 70 ? 'C' : g >= 60 ? 'D' : 'F';

/* ---------- call-outs ---------- */
// Spots slipping grades and work that is not being turned in, and says so plainly in the
// tone the person chose. Each one stays on the Today screen until they tap "I'm on it".
function callouts() {
  if (!S.settings.callouts) return [];
  const tone = S.profile.tone, out = [];
  const say = (enc, tough, facts) => tone === 'tough' ? tough : tone === 'facts' ? facts : enc;
  const names = list => list.slice(0, 3).map(a => a.title).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
  const n1 = x => +x.toFixed(2);

  for (const c of S.classes) {
    const h = c.history || [];
    if (h.length < 2 || c.grade == null) continue;
    const cur = h[h.length - 1].grade, prev = h[h.length - 2].grade, drop = n1(prev - cur);
    if (drop < 0.5) continue;
    const twice = h.length > 2 && h[h.length - 3].grade > prev;
    const under = c.goal != null && cur < c.goal ? (prev >= c.goal ? ` That puts it below your goal of ${c.goal}%.` : ` It is ${n1(c.goal - cur)} below your goal of ${c.goal}%.`) : '';
    out.push({
      key: `grade|${c.id}|${cur}`, type: 'grade',
      title: `${c.name} is going down`,
      text: `${c.name} went from ${prev}% to ${cur}%, down ${drop}${twice ? ', and that is the second drop in a row' : ''}.${under} ` + say(
        'You can win that back. Find out what pulled it down and fix that first.',
        'That does not fix itself. What are you doing about it today?',
        '').trim()
    });
  }

  const miss = missing();
  if (miss.length) {
    const oldest = Math.floor((new Date() - new Date(miss[0].due)) / (24 * 3600e3));
    out.push({
      key: `missing|${ymd()}|${miss.length}`, type: 'missing',
      title: `${miss.length} assignment${miss.length > 1 ? 's' : ''} not turned in`,
      text: `${names(miss)}.${oldest >= 2 ? ` The oldest has been missing for ${oldest} days.` : ''} ` + say(
        'Turn one in today, even late. Late beats a zero.',
        'Every day you wait it gets worse. Pick one and finish it now.',
        '').trim()
    });
  }

  const week = localInput(addDays(new Date(), -7));
  const late = lateOnes().filter(a => (a.doneAt || '') >= week);
  if (late.length >= 2) out.push({
    key: `late|${late.length}|${late[0].doneAt}`, type: 'late',
    title: `${late.length} things turned in late this week`,
    text: `${names(late)}. ` + say(
      'It is turning into a habit. Start the next one a day earlier.',
      'That is a pattern, not bad luck. Start the next one a day earlier.',
      '').trim()
  });

  const why = S.profile.why && tone !== 'facts' ? ` You said this matters because: "${S.profile.why}".` : '';
  const who = S.settings.name ? `${S.settings.name}, ` : '';
  return out.map(c => ({ ...c, text: (c.text + why).trim(), title: who + c.title }));
}
const activeCallouts = () => callouts().filter(c => !S.acked[c.key]);

/* ---------- views ---------- */
function ring(done, total) {
  const pct = total ? done / total : 0;
  const c = 2 * Math.PI * 36;
  return `<div class="ring ${total && done === total ? 'done' : ''}"><svg viewBox="0 0 84 84">
    <circle class="track" cx="42" cy="42" r="36"/><circle class="bar" cx="42" cy="42" r="36" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
  </svg><b>${done}/${total}</b></div>`;
}

function assignmentRow(a) {
  const miss = isMissing(a);
  const meta = a.status === 'done'
    ? `Turned in ${a.doneAt ? fmtDay(a.doneAt.slice(0, 10)) : ''} ${a.late ? '<span class="badge warn">Late</span>' : '<span class="badge good">On time</span>'}`
    : `${miss ? 'Was due' : 'Due'} ${fmtDue(a.due)} ${miss ? '<span class="badge bad">Missing</span>' : ''}`;
  return `<li class="row ${a.status === 'done' ? 'done' : ''}">
    <button class="check ${a.status === 'done' ? 'on' : ''}" data-act="toggle-assignment" data-id="${a.id}" aria-label="Mark ${esc(a.title)} turned in"></button>
    <div class="body"><span class="title">${esc(a.title)}</span>
    <span class="meta ${miss ? 'bad' : ''}">${a.course ? esc(a.course) + ' · ' : ''}${meta}</span></div>
    <button class="more" data-act="edit-assignment" data-id="${a.id}" aria-label="Edit ${esc(a.title)}">⋯</button></li>`;
}
function taskRow(t) {
  const overdue = !t.done && t.date && (t.time ? atTime(t.date, t.time) < new Date() : t.date < ymd());
  const when = t.date ? `${fmtDay(t.date)}${t.time ? ', ' + fmtTime(t.time) : ''}` : 'No date';
  return `<li class="row ${t.done ? 'done' : ''}">
    <button class="check ${t.done ? 'on' : ''}" data-act="toggle-task" data-id="${t.id}" aria-label="Tick ${esc(t.title)}"></button>
    <div class="body"><span class="title">${esc(t.title)}</span><span class="meta ${overdue ? 'bad' : ''}">${when}${overdue ? ' · overdue' : ''}</span></div>
    <button class="more" data-act="edit-task" data-id="${t.id}" aria-label="Edit ${esc(t.title)}">⋯</button></li>`;
}

const views = {
  today() {
    const day = ymd();
    const st = dayStats(day);
    const log = S.dailyLog[day] || {};
    const y = dayStats(ymd(addDays(new Date(), -1)));
    const miss = missing();
    const soon = upcoming().filter(a => new Date(a.due) - new Date() < 48 * 3600e3);
    const todays = S.tasks.filter(t => !t.done && t.date && t.date <= day);
    const hello = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
    const name = S.settings.name ? ', ' + esc(S.settings.name) : '';
    const status = !st.total ? 'Add the things you must do every day.'
      : st.done === st.total ? 'Everything done today. Nice work.'
      : `${st.total - st.done} left to do today.`;
    let h = `<section class="card hero">${ring(st.done, st.total)}<div><h2>${hello}${name}</h2><p class="sub">${status}</p>
      ${S.profile.why ? `<p class="sub why">Your why: ${esc(S.profile.why)}</p>` : ''}
      <p class="sub">${streak() ? `🔥 ${streak()}-day streak` : 'Finish the whole list to start a streak.'}</p></div></section>`;
    const calls = activeCallouts();
    h += calls.map(c => `<div class="callout" role="alert"><b>${esc(c.title)}</b><p>${esc(c.text)}</p>
      <button class="btn small" data-act="ack-callout" data-key="${esc(c.key)}">I'm on it</button></div>`).join('');
    if (miss.length && !calls.some(c => c.type === 'missing')) h += `<div class="alert bad"><b>${miss.length} missing assignment${miss.length > 1 ? 's' : ''}</b>${miss.slice(0, 3).map(a => esc(a.title)).join(', ')}${miss.length > 3 ? ' and more' : ''}.</div>`;
    if (y.total && y.left.length) h += `<div class="alert warn"><b>Yesterday you skipped ${y.left.length} of ${y.total}</b>${y.left.map(i => esc(i.title)).join(', ')}. Make today count.</div>`;
    h += `<section class="card"><div class="card-head"><h2>Daily checklist</h2><button class="btn small" data-act="add-daily">+ Add</button></div>
      ${st.total ? `<ul class="list">${st.items.map(i => `<li class="row ${log[i.id] ? 'done' : ''}">
        <button class="check ${log[i.id] ? 'on' : ''}" data-act="toggle-daily" data-id="${i.id}" aria-label="Tick ${esc(i.title)}"></button>
        <div class="body"><span class="title">${esc(i.title)}</span>${i.time ? `<span class="meta">Reminder at ${fmtTime(i.time)}</span>` : ''}</div>
        <button class="more" data-act="edit-daily" data-id="${i.id}" aria-label="Edit ${esc(i.title)}">⋯</button></li>`).join('')}</ul>`
      : '<p class="empty">Nothing here yet. These items come back every day until you tick them.</p>'}</section>`;
    h += `<section class="card"><div class="card-head"><h2>Scheduled for today</h2><button class="btn small" data-act="add-task" data-today="1">+ Add</button></div>
      ${todays.length ? `<ul class="list">${todays.map(taskRow).join('')}</ul>` : '<p class="empty">Nothing scheduled for today.</p>'}</section>`;
    h += `<section class="card"><div class="card-head"><h2>Due soon</h2><button class="btn small" data-act="go-school">All</button></div>
      ${miss.length + soon.length ? `<ul class="list">${[...miss, ...soon].map(assignmentRow).join('')}</ul>` : '<p class="empty">No assignments due in the next two days.</p>'}</section>`;
    return h;
  },

  plan() {
    const open = S.tasks.filter(t => !t.done).sort((a, b) => ((a.date || '9') + (a.time || '')).localeCompare((b.date || '9') + (b.time || '')));
    const done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 15);
    return `<section class="card"><div class="card-head"><h2>My checklist</h2><button class="btn small primary" data-act="add-task">+ Add</button></div>
      <p class="sub">Things you need to schedule. Give one a date and time and RE-Mind will remind you.</p>
      ${open.length ? `<ul class="list">${open.map(taskRow).join('')}</ul>` : '<p class="empty">Your list is clear.</p>'}</section>
      ${done.length ? `<section class="card"><div class="card-head"><h2>Done</h2><button class="btn small" data-act="clear-done">Clear</button></div><ul class="list">${done.map(taskRow).join('')}</ul></section>` : ''}`;
  },

  school() {
    let h = `<div class="seg"><button class="${schoolSeg === 'assignments' ? 'on' : ''}" data-act="seg" data-seg="assignments">Assignments</button>
      <button class="${schoolSeg === 'grades' ? 'on' : ''}" data-act="seg" data-seg="grades">Grades</button></div>`;
    if (schoolSeg === 'assignments') {
      const m = missing(), u = upcoming(), d = turnedIn().slice(0, 20);
      h += `<div class="btn-row" style="margin:0 0 14px"><button class="btn primary" data-act="add-assignment">+ Add</button><button class="btn" data-act="quick-assignments">Type several</button><button class="btn" data-act="school-sync">${S.feeds.length ? 'Sync school' : 'Connect school'}</button></div>`;
      if (m.length) h += `<section class="card"><h2>Missing <span class="badge bad">${m.length}</span></h2><ul class="list">${m.map(assignmentRow).join('')}</ul></section>`;
      h += `<section class="card"><h2>Upcoming</h2>${u.length ? `<ul class="list">${u.map(assignmentRow).join('')}</ul>` : '<p class="empty">Nothing upcoming. Add an assignment or import your school calendar.</p>'}</section>`;
      if (d.length) h += `<section class="card"><h2>Turned in</h2><ul class="list">${d.map(assignmentRow).join('')}</ul></section>`;
    } else {
      h += `<section class="card"><div class="card-head"><h2>Classes</h2><button class="btn small" data-act="add-class">+ Add</button></div>
        <div class="btn-row" style="margin:0 0 6px"><button class="btn primary" data-act="scan-grades">Scan a screenshot</button><button class="btn" data-act="quick-grades">Type several</button></div>
        ${S.classes.length ? `<ul class="list">${S.classes.map(c => {
          const prev = c.history && c.history.length > 1 ? c.history[c.history.length - 2].grade : null;
          const trend = prev == null || c.grade == null || prev === c.grade ? '' : c.grade > prev ? ` · ▲ up from ${prev}%` : ` · ▼ down from ${prev}%`;
          const bad = c.goal != null && c.grade != null && c.grade < c.goal;
          return `<li class="row"><div class="body"><span class="title">${esc(c.name)}</span>
            <span class="meta ${bad ? 'bad' : ''}">${c.goal != null ? `Goal ${c.goal}%` : 'No goal set'}${bad ? ` · ${(c.goal - c.grade).toFixed(1).replace('.0', '')} points below goal` : ''}${trend}</span></div>
            <div class="grade ${bad ? 'bad' : ''}">${c.grade != null ? `${c.grade}%<small>${letter(c.grade)}</small>` : '—'}</div>
            <button class="more" data-act="edit-class" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">⋯</button></li>`;
        }).join('')}</ul>` : '<p class="empty">Add your classes with your current grade and the grade you are aiming for.</p>'}</section>`;
    }
    return h;
  },

  report() {
    const m = missing(), late = lateOnes(), t = turnedIn(), bg = belowGoal();
    const judged = t.length + m.length;
    const onTime = judged ? Math.round((t.length - late.length) / judged * 100) : null;
    const days = [...Array(7)].map((_, i) => ymd(addDays(new Date(), i - 6)));
    const bars = days.map(d => {
      const s = dayStats(d); const pct = s.total ? s.done / s.total : 0;
      return `<div><i class="${!s.total || !pct ? 'none' : pct === 1 ? 'full' : ''}" style="height:${Math.round(pct * 100)}%"></i><small>${new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'narrow' })}</small></div>`;
    }).join('');
    const issues = m.length + late.length + bg.length;
    const verdict = !S.assignments.length && !S.daily.length && !S.classes.length
      ? '<div class="alert warn"><b>Nothing to report yet</b>Add your daily checklist, assignments and classes and this page will keep score.</div>'
      : issues === 0 ? '<div class="alert good"><b>You are on track</b>Nothing missing, nothing late, every class at or above goal.</div>'
      : `<div class="alert bad"><b>Needs your attention</b>${[m.length && `${m.length} missing`, late.length && `${late.length} turned in late`, bg.length && `${bg.length} class${bg.length > 1 ? 'es' : ''} below goal`].filter(Boolean).join(' · ')}</div>`;
    const week = ymd(addDays(new Date(), -7));
    const lateWeek = late.filter(a => (a.doneAt || '').slice(0, 10) >= week).length;
    const withGoal = S.classes.filter(c => c.goal != null && c.grade != null);
    const weekDone = days.reduce((n, d) => n + dayStats(d).done, 0), weekTotal = days.reduce((n, d) => n + dayStats(d).total, 0);
    const progress = {
      grades: withGoal.length ? [`${withGoal.length - bg.length} of ${withGoal.length} classes at or above goal`, !bg.length] : ['Add your classes and goal grades to track this', null],
      late: [lateWeek ? `${lateWeek} turned in late in the last 7 days` : 'Nothing turned in late in the last 7 days', !lateWeek],
      missing: [m.length ? `${m.length} missing right now` : 'Nothing missing right now', !m.length],
      habits: weekTotal ? [`${Math.round(weekDone / weekTotal * 100)}% of your daily checklist done this week`, weekDone / weekTotal >= 0.8] : ['Add a daily checklist to track this', null],
      stress: [m.length + upcoming().filter(a => new Date(a.due) - new Date() < 48 * 3600e3).length ? `${m.length} missing and ${upcoming().filter(a => new Date(a.due) - new Date() < 48 * 3600e3).length} due in the next two days` : 'Nothing missing and nothing due in the next two days', !m.length]
    };
    const goalsCard = S.profile.goals.length || S.profile.goalText ? `<section class="card"><h2>Your goals</h2>
      ${S.profile.goalText ? `<p class="sub">In your words: ${esc(S.profile.goalText)}</p>` : ''}
      <ul class="list">${S.profile.goals.filter(g => GOALS[g]).map(g => `<li class="row"><div class="body"><span class="title">${GOALS[g].label}</span>
        <span class="meta ${progress[g][1] === false ? 'bad' : ''}">${progress[g][0]}</span></div>${progress[g][1] == null ? '' : `<span class="badge ${progress[g][1] ? 'good' : 'bad'}">${progress[g][1] ? 'On track' : 'Off track'}</span>`}</li>`).join('')}</ul></section>` : '';
    return `${verdict}${goalsCard}<div class="stats">
      <div class="stat"><b>${streak()}</b><span>Day streak</span></div>
      <div class="stat ${onTime != null && onTime < 80 ? 'bad' : 'good'}"><b>${onTime == null ? '—' : onTime + '%'}</b><span>Turned in on time</span></div>
      <div class="stat ${m.length ? 'bad' : ''}"><b>${m.length}</b><span>Missing now</span></div>
      <div class="stat ${late.length ? 'bad' : ''}"><b>${late.length}</b><span>Turned in late</span></div></div>
      <section class="card"><h2>Daily checklist, last 7 days</h2><div class="bars">${bars}</div></section>
      <section class="card"><h2>Grades below goal</h2>${bg.length ? `<ul class="list">${bg.map(c => `<li class="row"><div class="body"><span class="title">${esc(c.name)}</span><span class="meta bad">Goal ${c.goal}%</span></div><div class="grade bad">${c.grade}%</div></li>`).join('')}</ul>` : '<p class="empty">Every class with a goal is at or above it.</p>'}</section>
      <section class="card"><h2>Late log</h2>${late.length ? `<ul class="list">${late.map(a => `<li class="row"><div class="body"><span class="title">${esc(a.title)}</span><span class="meta">${a.course ? esc(a.course) + ' · ' : ''}Due ${fmtDue(a.due)}, turned in ${fmtDay(a.doneAt.slice(0, 10))}</span></div></li>`).join('')}</ul>` : '<p class="empty">Nothing turned in late. Keep it that way.</p>'}</section>`;
  },

  settings() {
    const st = S.settings;
    const perm = !('Notification' in window) ? 'unsupported' : Notification.permission;
    const permText = perm === 'unsupported' ? 'This browser cannot show notifications. On iPhone, add RE-Mind to your Home Screen first.'
      : perm === 'granted' && st.notif ? 'Notifications are on.'
      : perm === 'denied' ? 'Notifications are blocked. Allow them for this site in your phone settings.'
      : 'Notifications are off.';
    return `<section class="card"><h2>You</h2>
        <label class="setting">Your name<input data-set="name" value="${esc(st.name)}" placeholder="Optional"></label>
        <p class="sub">${S.profile.done ? 'Your goals, your reason and the way RE-Mind talks to you.' : 'Tell RE-Mind your goals so it can motivate you.'}</p>
        <button class="btn block" data-act="edit-profile">${S.profile.done ? 'Change my goals and answers' : 'Set up my profile'}</button></section>
      <section class="card"><h2>Reminders</h2><p class="sub">${permText}</p>
        <div class="btn-row"><button class="btn primary" data-act="enable-notif">${perm === 'granted' && st.notif ? 'Turn off' : 'Turn on notifications'}</button>
        <button class="btn" data-act="test-notif">Send a test</button></div>
        <div style="margin-top:10px">
        <label class="setting">Morning briefing<input type="time" data-set="morning" value="${st.morning}"></label>
        <label class="setting">Evening check-in<input type="time" data-set="evening" value="${st.evening}"></label>
        <label class="setting">Keep nagging until done<select data-set="nagMins">
          ${[[0, 'Once only'], [15, 'Every 15 min'], [30, 'Every 30 min'], [60, 'Every hour']].map(([v, l]) => `<option value="${v}" ${+st.nagMins === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="setting">Motivational messages<input type="checkbox" data-set="motivate" ${st.motivate ? 'checked' : ''}></label>
        <label class="setting">Call me out when I slip<input type="checkbox" data-set="callouts" ${st.callouts ? 'checked' : ''}></label></div></section>
      <section class="card"><h2>School data</h2>
        <p class="sub">Connect your school calendar and RE-Mind pulls in your assignments each time you open it. Works with Schoology, Canvas, Google Classroom and anything else that offers a calendar link.</p>
        ${S.feeds.length ? `<ul class="list" style="margin-top:8px">${S.feeds.map(f => `<li class="row"><div class="body"><span class="title">${esc(PROVIDERS[f.provider]?.name || 'School calendar')}</span>
          <span class="meta ${f.lastError ? 'bad' : ''}">${f.lastError ? esc(f.lastError) : f.lastSync ? 'Last synced ' + fmtDue(localInput(new Date(f.lastSync))) : 'Not synced yet'}</span></div>
          <button class="btn small danger" data-act="remove-feed" data-id="${f.id}">Remove</button></li>`).join('')}</ul>` : ''}
        <button class="btn block primary" data-act="connect">Connect a school calendar</button>
        ${S.feeds.length ? '<button class="btn block" data-act="sync">Sync now</button>' : ''}
        <button class="btn block" data-act="import-file">Import .ics file</button>
        <p class="sub" style="margin-top:10px">Calendar links carry assignments and due dates, not grades. Enter grades under School, Grades.</p></section>
      <section class="card"><h2>Your data</h2><p class="sub">Everything is stored only on this device.</p>
        <div class="btn-row"><button class="btn" data-act="export">Export backup</button><button class="btn danger" data-act="reset">Erase everything</button></div></section>`;
  }
};

function render() {
  $('#view').innerHTML = views[tab]();
  document.querySelectorAll('.tabs button').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    if (b.dataset.tab === 'today') b.classList.toggle('alerting', activeCallouts().length > 0);
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  $('#top-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

/* ---------- sheet (add / edit forms) ---------- */
let sheetCtx = null;
function openSheet({ title, fields, onSave, onDelete, help, after, html }) {
  sheetCtx = { onSave, onDelete, help, after };
  $('#sheet-title').textContent = title;
  $('#sheet-fields').innerHTML = fields.map(f => f.options
    ? `<label class="field"><span>${esc(f.label)}</span><select name="${f.name}">${f.options.map(([v, l]) => `<option value="${v}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    : f.type === 'textarea' ? `<label class="field"><span>${esc(f.label)}</span><textarea name="${f.name}" rows="6" required placeholder="${esc(f.placeholder)}"></textarea></label>`
    : `<label class="field"><span>${esc(f.label)}</span>
    <input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''}
    ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.type === 'number' ? 'min="0" max="150" step="0.1" inputmode="decimal"' : ''} ${f.type === 'text' || !f.type ? 'maxlength="120" autocomplete="off"' : ''}></label>`).join('') + (html || '') + '<p class="sub" id="sheet-help" style="margin:0 0 14px"></p>';
  const showHelp = () => { $('#sheet-help').textContent = help ? help(Object.fromEntries(new FormData($('#sheet-form')))) : ''; };
  $('#sheet-fields').onchange = showHelp; showHelp();
  $('#sheet-delete').hidden = !onDelete;
  $('#sheet').showModal();
}
$('#sheet-form').addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  for (const k in data) data[k] = data[k].trim();
  sheetCtx.onSave(data);
  $('#sheet').close(); save(); render(); tick();
  sheetCtx.after?.();
});
$('#sheet-cancel').addEventListener('click', () => $('#sheet').close());
$('#sheet-delete').addEventListener('click', () => { sheetCtx.onDelete(); $('#sheet').close(); save(); render(); });

const num = v => v === '' || v == null || isNaN(+v) ? null : +v;

function dailySheet(item) {
  openSheet({
    title: item ? 'Edit daily item' : 'New daily item',
    fields: [
      { name: 'title', label: 'What do you need to do every day?', value: item?.title, required: true, placeholder: 'e.g. Read for 20 minutes' },
      { name: 'time', label: 'Remind me at (optional)', type: 'time', value: item?.time }
    ],
    onSave: d => item ? Object.assign(item, d) : S.daily.push({ id: uid(), created: ymd(), ...d }),
    onDelete: item && (() => { S.daily = S.daily.filter(i => i !== item); })
  });
}
function taskSheet(t, today) {
  openSheet({
    title: t ? 'Edit item' : 'New checklist item',
    fields: [
      { name: 'title', label: 'What do you need to do?', value: t?.title, required: true, placeholder: 'e.g. Email coach about practice' },
      { name: 'date', label: 'Date (optional)', type: 'date', value: t?.date ?? (today ? ymd() : '') },
      { name: 'time', label: 'Time (optional)', type: 'time', value: t?.time }
    ],
    onSave: d => { if (d.time && !d.date) d.date = ymd(); t ? Object.assign(t, d) : S.tasks.push({ id: uid(), done: false, ...d }); },
    onDelete: t && (() => { S.tasks = S.tasks.filter(x => x !== t); })
  });
}
function assignmentSheet(a) {
  const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(23, 59, 0, 0);
  openSheet({
    title: a ? 'Edit assignment' : 'New assignment',
    fields: [
      { name: 'title', label: 'Assignment', value: a?.title, required: true, placeholder: 'e.g. Chapter 4 essay' },
      { name: 'course', label: 'Class', value: a?.course, placeholder: 'e.g. English' },
      { name: 'due', label: 'Due', type: 'datetime-local', value: a?.due ?? localInput(def), required: true }
    ],
    onSave: d => {
      if (a) { Object.assign(a, d); if (a.status === 'done') a.late = a.doneAt > a.due; }
      else S.assignments.push({ id: uid(), status: 'todo', late: false, source: 'manual', ...d });
    },
    onDelete: a && (() => { S.assignments = S.assignments.filter(x => x !== a); })
  });
}
function classSheet(c) {
  openSheet({
    title: c ? 'Update class' : 'New class',
    fields: [
      { name: 'name', label: 'Class name', value: c?.name, required: true, placeholder: 'e.g. Algebra 2' },
      { name: 'grade', label: 'Current grade (%)', type: 'number', value: c?.grade },
      { name: 'goal', label: 'Goal grade (%)', type: 'number', value: c ? c.goal : S.profile.gradeGoal }
    ],
    onSave: d => {
      const grade = num(d.grade), goal = num(d.goal);
      if (!c) { c = { id: uid(), history: [] }; S.classes.push(c); }
      if (grade != null && grade !== c.grade) c.history.push({ date: ymd(), grade });
      Object.assign(c, { name: d.name, grade, goal });
    },
    onDelete: c && (() => { S.classes = S.classes.filter(x => x !== c); })
  });
}

/* ---------- quick add: type a list, one per line ---------- */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// Understands "tomorrow", "fri", "11/15", "nov 15", each with an optional time like "3pm".
// Returns null when the text is not a date.
function parseWhen(text, now = new Date()) {
  let t = text.toLowerCase().replace(/\b(due|on|at|by)\b/g, ' ').replace(/[.,]/g, ' ').trim();
  let h = 23, min = 59, hasTime = false;
  t = t.replace(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/, (_, hh, mm, ap) => {
    h = (+hh % 12) + (ap === 'pm' ? 12 : 0); min = +(mm || 0); hasTime = true; return ' ';
  }).replace(/\s+/g, ' ').trim();
  const d = new Date(now); d.setHours(h, min, 0, 0);
  let m;
  if (t === '' && hasTime) { if (d < now) d.setDate(d.getDate() + 1); }
  else if (t === 'today' || t === 'tonight') { /* today */ }
  else if (t === 'tomorrow' || t === 'tmrw' || t === 'tmr') d.setDate(d.getDate() + 1);
  else if ((m = t.match(/^(next )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/)) && /^(sun|mon|tues?|wed(nes)?|thu(rs?)?|fri|sat(ur)?)(day)?$/.test(m[0].replace('next ', ''))) {
    let add = (WEEKDAYS.indexOf(m[2]) - d.getDay() + 7) % 7;
    if (m[1] && add < 7) add += add === 0 ? 7 : 0;
    d.setDate(d.getDate() + add);
  } else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)) || (m = t.match(/^([a-z]{3,9}) (\d{1,2})(?:st|nd|rd|th)?$/)) || (m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})$/))) {
    let mon, day, year = m[3] ? +m[3] : null;
    if (/^\d/.test(m[1]) && /^\d/.test(m[2])) { mon = +m[1] - 1; day = +m[2]; }
    else { const name = /^\d/.test(m[1]) ? m[2] : m[1]; mon = MONTHS.indexOf(name.slice(0, 3)); day = +(/^\d/.test(m[1]) ? m[1] : m[2]); }
    if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
    if (year != null && year < 100) year += 2000;
    d.setFullYear(year ?? now.getFullYear(), mon, day);
    if (year == null && d < addDays(now, -60)) d.setFullYear(d.getFullYear() + 1);
  } else return null;
  return d;
}
// "Essay, English, Friday" or "Math worksheet tomorrow 3pm". Parts can be in any order.
function parseAssignmentLine(line, now = new Date()) {
  let parts = line.split(/[,;\t|]| - /).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  let due = null;
  const rest = [];
  for (const part of parts) { const d = !due && parseWhen(part, now); d ? due = d : rest.push(part); }
  if (!due && rest.length) {
    const words = rest[rest.length - 1].split(/\s+/);
    for (let n = Math.min(4, words.length - 1); n >= 1 && !due; n--) {
      const d = parseWhen(words.slice(-n).join(' '), now);
      if (d) { due = d; rest[rest.length - 1] = words.slice(0, -n).join(' ').replace(/\s+(due|on|by|at)$/i, ''); }
    }
  }
  if (!rest.length || !rest[0]) return null;
  if (!due) { due = addDays(now, 1); due.setHours(23, 59, 0, 0); }
  return { title: rest[0].slice(0, 120), course: (rest[1] || '').slice(0, 120), due: localInput(due) };
}
// "Algebra 85" or "English 91 goal 95".
function parseGradeLine(line) {
  let goal = null;
  let t = line.replace(/\bgoal\s*:?\s*(\d+(?:\.\d+)?)\s*%?/i, (_, g) => { goal = +g; return ' '; }).replace(/[%,:;=|-]+/g, ' ').trim();
  const m = t.match(/^(.*\S)\s+(\d+(?:\.\d+)?)$/);
  const name = (m ? m[1] : t).trim().slice(0, 120);
  if (!name) return null;
  return { name, grade: m ? +m[2] : null, goal };
}
function quickAssignmentsSheet() {
  let n = 0;
  openSheet({
    title: 'Type your assignments',
    fields: [{ name: 'lines', label: 'One per line: what it is, the class, and when it is due', type: 'textarea', placeholder: 'Essay, English, Friday\nMath worksheet tomorrow\nLab report, Biology, 11/20 3pm' }],
    help: () => 'Leave out the day and it is set to tomorrow night. You can fix any of them afterwards.',
    onSave: d => {
      for (const line of d.lines.split('\n')) {
        const a = parseAssignmentLine(line);
        if (a) { S.assignments.push({ id: uid(), status: 'todo', late: false, source: 'manual', ...a }); n++; }
      }
    },
    after: () => toast(n ? `Added ${n} assignment${n > 1 ? 's' : ''}` : 'Nothing to add')
  });
}
function quickGradesSheet() {
  let n = 0;
  openSheet({
    title: 'Type your grades',
    fields: [{ name: 'lines', label: 'One class per line: the class, then your grade', type: 'textarea', placeholder: 'Algebra 85\nEnglish 91 goal 95\nBiology 78' }],
    help: () => 'Open your grades in Schoology and copy the numbers across. Classes you already have are updated, not doubled.',
    onSave: d => {
      for (const line of d.lines.split('\n')) {
        const g = parseGradeLine(line);
        if (!g) continue;
        let c = S.classes.find(x => x.name.toLowerCase() === g.name.toLowerCase());
        if (!c) { c = { id: uid(), name: g.name, grade: null, goal: S.profile.gradeGoal, history: [] }; S.classes.push(c); }
        if (g.grade != null && g.grade !== c.grade) { c.grade = g.grade; c.history.push({ date: ymd(), grade: g.grade }); }
        if (g.goal != null) c.goal = g.goal;
        n++;
      }
    },
    after: () => toast(n ? `Saved ${n} class${n > 1 ? 'es' : ''}` : 'Nothing to add')
  });
}

/* ---------- scan a screenshot of your grades ---------- */
// The text is read on the phone itself (files in ocr/), so screenshots never leave the device.
let ocrWorker = null;
function loadScript(src) {
  return new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => fail(new Error('load')); document.head.append(el); });
}
async function readImageText(file, onProgress) {
  if (!window.Tesseract) await loadScript('ocr/tesseract.min.js');
  const at = f => new URL('ocr/' + f, location.href).href;
  ocrWorker ||= await Tesseract.createWorker('eng', 1, {
    workerPath: at('worker.min.js'), corePath: at(''), langPath: at(''), gzip: true,
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); }
  });
  return (await ocrWorker.recognize(file)).data.text;
}
// Finds "class name ... 93.5%" pairs in the text of a grades page. The name can be on the
// same line as the grade or on the line above it.
function parseGradesText(text) {
  const out = [], seen = new Set();
  const NUM = '(\\d{1,3}(?:\\.\\d{1,2})?)';
  const tidy = t => t.replace(/\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/g, ' ')       // 45/50, 11/20
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ');                                          // 8:23
  const nameOf = t => t.replace(/\(\s*\)/g, ' ').replace(/\b(overall|current|final|course)?\s*grade\b\s*:?/ig, ' ')
    .replace(/(^|\s)[A-DF][+-]?(?=\s*$)/, ' ')                                      // trailing letter grade
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '').replace(/\s+/g, ' ').trim();
  const isName = n => (n.match(/[A-Za-z]/g) || []).length >= 3 && !/^(grades?|grade report|gradebook|courses?|my grades)$/i.test(n);
  let prev = '';
  for (const raw of text.split('\n')) {
    const line = tidy(raw).trim();
    if (!line) continue;
    let m = line.match(new RegExp(NUM + '\\s*%')) || line.match(new RegExp('\\(\\s*' + NUM + '\\s*\\)')) || (/\d\s*\/\s*\d/.test(raw) ? null : line.match(new RegExp('(?:^|\\s)' + NUM + '\\s*$')));  // a bare number only counts when the line has no 45/50 style score
    const grade = m ? +m[1] : null;
    if (grade == null || grade > 150) { prev = nameOf(line); continue; }
    let name = nameOf(line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length));
    if (!isName(name)) name = prev;
    prev = '';
    if (!isName(name) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name: name.slice(0, 120), grade });
  }
  return out;
}
// A single class's grade page, as the Schoology phone app shows it: the class name in the
// top bar, a "Course Grade" heading, then one row per grading period. Gives one result:
// the class name with the grade from the first (overall) row.
function parseCoursePage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const at = lines.findIndex(l => /^\W*course\s+grade\W*$/i.test(l));
  if (at < 1) return null;
  let name = '';
  for (let i = at - 1; i >= 0 && !name; i--) {
    if (/^\W*\d{1,2}:\d{2}/.test(lines[i])) continue;                       // status bar clock
    const t = lines[i].replace(/^[^A-Za-z0-9]+/, '')
      .replace(/\s*:\s*\d[^:]*$/, '')                                       // section, e.g. ": 1(A)"
      .replace(/[^A-Za-z0-9)]+$/, '').trim();
    if ((t.match(/[A-Za-z]/g) || []).length >= 3) name = t;
  }
  if (!name) return null;
  for (const l of lines.slice(at + 1)) {
    const m = l.match(/\(\s*(\d{1,3}(?:\.\d{1,2})?)\s*%\s*\)\W*$/);
    if (m && +m[1] <= 150 && /[A-F][+-]?\s*\(\s*[\d.]+\s*%\s*\)\W*$/.test(l)) return [{ name: name.slice(0, 120), grade: +m[1] }];
  }
  return null;
}
function reviewGradesSheet(found) {
  let n = 0;
  openSheet({
    title: `Found ${found.length} grade${found.length > 1 ? 's' : ''}`,
    fields: [],
    html: found.map((g, i) => `<div class="scan-row"><input name="n${i}" value="${esc(g.name)}" aria-label="Class name" maxlength="120"><input name="g${i}" type="number" min="0" max="150" step="0.01" inputmode="decimal" value="${g.grade}" aria-label="Grade"></div>`).join(''),
    help: () => 'Check these against your screenshots and fix anything that was read wrong. Clear a name to leave that one out.',
    onSave: d => {
      found.forEach((_, i) => {
        const name = d['n' + i], grade = num(d['g' + i]);
        if (!name || grade == null) return;
        let c = S.classes.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (!c) { c = { id: uid(), name, grade: null, goal: S.profile.gradeGoal, history: [] }; S.classes.push(c); }
        if (grade !== c.grade) { c.grade = grade; c.history.push({ date: ymd(), grade }); }
        n++;
      });
    },
    after: () => toast(n ? `Saved ${n} grade${n > 1 ? 's' : ''}` : 'Nothing saved')
  });
}
$('#grade-shots').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  const busy = $('#busy'), label = $('#busy-text');
  busy.hidden = false;
  try {
    const found = [], seen = new Set();
    for (let i = 0; i < files.length; i++) {
      const which = files.length > 1 ? ` ${i + 1} of ${files.length}` : '';
      label.textContent = `Getting ready to read screenshot${which}…`;
      const text = await readImageText(files[i], p => { label.textContent = `Reading screenshot${which}… ${Math.round(p * 100)}%`; });
      for (const g of parseCoursePage(text) || parseGradesText(text)) {
        if (!seen.has(g.name.toLowerCase())) { seen.add(g.name.toLowerCase()); found.push(g); }
      }
    }
    busy.hidden = true;
    if (found.length) reviewGradesSheet(found);
    else alert('No grades were found.\n\nIn Schoology, open a class, tap Grades, and take a screenshot that shows the class name at the top and its percentage. Do that for each class, then pick all the screenshots at once.');
  } catch (err) {
    busy.hidden = true;
    alert(navigator.onLine ? 'That picture could not be read. Try a different screenshot.' : 'The first scan needs an internet connection to download the reader. Try again when you are online.');
  }
});

function connectSheet() {
  let feed;
  openSheet({
    title: 'Connect a school calendar',
    fields: [
      { name: 'provider', label: 'School system', value: 'schoology', options: Object.entries(PROVIDERS).map(([k, v]) => [k, v.name]) },
      { name: 'url', label: 'Calendar link', type: 'url', required: true, placeholder: 'https://… or webcal://…' }
    ],
    help: d => PROVIDERS[d.provider].steps,
    onSave: d => {
      const url = d.url.replace(/^webcals?:/i, 'https:');
      feed = S.feeds.find(f => f.url === url);
      if (!feed) { feed = { id: uid(), provider: d.provider, url }; S.feeds.push(feed); } else feed.provider = d.provider;
    },
    after: async () => {
      await syncAll(false, [feed]);
      if (!feed.lastSync && feed.lastError) {
        S.feeds = S.feeds.filter(f => f !== feed); save(); render();
        alert(`RE-Mind could not use that link.\n\n${feed.lastError}\n\nYou can also skip the link: on the School tab, tap "Type several" and type your assignments in, one per line.`);
      }
    }
  });
}

/* ---------- actions ---------- */
const byId = (list, id) => list.find(x => x.id === id);
const actions = {
  'add-daily': () => dailySheet(),
  'edit-daily': el => dailySheet(byId(S.daily, el.dataset.id)),
  'toggle-daily': el => {
    const day = ymd(); const log = S.dailyLog[day] ||= {};
    log[el.dataset.id] ? delete log[el.dataset.id] : log[el.dataset.id] = true;
    const s = dayStats(day);
    if (s.total && s.done === s.total) toast('Daily checklist complete. ' + quote());
  },
  'add-task': el => taskSheet(null, el.dataset.today),
  'edit-task': el => taskSheet(byId(S.tasks, el.dataset.id)),
  'toggle-task': el => { const t = byId(S.tasks, el.dataset.id); t.done = !t.done; t.doneAt = t.done ? localInput(new Date()) : null; },
  'clear-done': () => { S.tasks = S.tasks.filter(t => !t.done); },
  'add-assignment': () => assignmentSheet(),
  'edit-assignment': el => assignmentSheet(byId(S.assignments, el.dataset.id)),
  'toggle-assignment': el => {
    const a = byId(S.assignments, el.dataset.id);
    if (a.status === 'done') { a.status = 'todo'; a.doneAt = null; a.late = false; return; }
    a.status = 'done'; a.doneAt = localInput(new Date()); a.late = a.doneAt > a.due;
    toast(a.late ? 'Turned in late. It is on your record, but done counts.' : 'Turned in on time. Nice.');
  },
  'add-class': () => classSheet(),
  'quick-assignments': () => quickAssignmentsSheet(),
  'quick-grades': () => quickGradesSheet(),
  'ack-callout': el => { S.acked[el.dataset.key] = Date.now(); toast(S.profile.tone === 'tough' ? 'Good. Prove it.' : 'Good. Go handle it.'); },
  'edit-profile': () => startOnboarding(),
  'scan-grades': () => $('#grade-shots').click(),
  'edit-class': el => classSheet(byId(S.classes, el.dataset.id)),
  'seg': el => { schoolSeg = el.dataset.seg; },
  'go-school': () => { tab = 'school'; schoolSeg = 'assignments'; },
  'enable-notif': async () => {
    if (!('Notification' in window)) return toast('Notifications are not available here. On iPhone, add the app to your Home Screen first.');
    if (S.settings.notif && Notification.permission === 'granted') { S.settings.notif = false; return; }
    const p = await Notification.requestPermission();
    S.settings.notif = p === 'granted';
    toast(S.settings.notif ? 'Notifications on' : 'Notifications were not allowed');
    save(); render();
  },
  'test-notif': async () => {
    if (!canNotify()) return toast('Turn on notifications first');
    await show('RE-Mind test', 'This is what a reminder looks like. ' + quote(), 'test');
    toast('Test sent');
  },
  'import-file': () => $('#ics-file').click(),
  'connect': () => connectSheet(),
  'sync': () => syncAll(false),
  'school-sync': () => S.feeds.length ? syncAll(false) : connectSheet(),
  'remove-feed': el => {
    if (confirm('Remove this school connection? Assignments already imported stay in the app.')) S.feeds = S.feeds.filter(f => f.id !== el.dataset.id);
  },
  'export': () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `re-mind-backup-${ymd()}.json`; a.click(); URL.revokeObjectURL(a.href);
  },
  'reset': () => {
    if (!confirm('Erase all RE-Mind data on this device? This cannot be undone.')) return;
    S = structuredClone(DEFAULTS);
  }
};

document.addEventListener('click', async e => {
  const tabBtn = e.target.closest('.tabs button');
  if (tabBtn) { tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  await actions[el.dataset.act](el);
  save(); render();
});
document.addEventListener('change', e => {
  const k = e.target.dataset.set;
  if (!k) return;
  S.settings[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'nagMins' ? +e.target.value : e.target.value.trim();
  save(); tick();
});

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ---------- school calendar import (.ics) ---------- */
function parseIcsDate(v) {
  const m = v.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?/);
  if (!m) return null;
  if (!m[4]) return new Date(+m[1], m[2] - 1, +m[3], 23, 59);
  return m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
}
function parseIcs(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let ev = null; out.calName = '';
  const clean = s => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT') { if (ev && ev.title && ev.due) out.push(ev); ev = null; }
    else if (!ev && /^X-WR-CALNAME[:;]/i.test(line)) out.calName = clean(line.slice(line.indexOf(':') + 1)).slice(0, 120);
    else if (ev) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const name = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1);
      if (name === 'SUMMARY') {
        const t = clean(val).replace(/^Assignment:\s*/i, ''); const m = t.match(/^(.*)\s\[([^\]]+)\]$/);
        ev.title = (m ? m[1] : t).slice(0, 120); if (m) ev.course = m[2].slice(0, 120);
      } else if (name === 'UID') ev.uid = val.trim();
      else if (name === 'DTSTART' || (name === 'DTEND' && !ev.due) || name === 'DUE') { const d = parseIcsDate(val.trim()); if (d && !isNaN(d)) ev.due = d; }
    }
  }
  return out;
}
function importIcs(text, feed) {
  const cutoff = addDays(new Date(), -14);
  const parsed = parseIcs(text);
  const events = parsed.filter(e => e.due >= cutoff);
  let added = 0, updated = 0;
  for (const e of events) {
    if (!e.course && feed?.provider === 'google') e.course = parsed.calName;
    const key = e.uid || `${e.title}|${localInput(e.due)}`;
    const old = S.assignments.find(a => a.uid === key);
    if (old) { old.title = e.title; old.due = localInput(e.due); if (e.course) old.course = e.course; updated++; }
    else { S.assignments.push({ id: uid(), uid: key, title: e.title, course: e.course || '', due: localInput(e.due), status: 'todo', late: false, source: 'ics' }); added++; }
  }
  return { added, updated };
}
$('#ics-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const r = importIcs(await f.text()); e.target.value = '';
  save(); render(); tick();
  toast(r.added + r.updated ? `Imported ${r.added} new, updated ${r.updated}` : 'No current assignments found in that file');
});

/* ---------- school calendar sync ---------- */
// Tries the link directly first. Most school sites block that from a browser, so the
// fallback is this app's own relay at api/feed (see src/worker.js).
async function fetchFeed(url) {
  const get = async u => {
    const r = await fetch(u, { cache: 'no-store' });
    const t = await r.text();
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, detail: t.slice(0, 200) });
    if (!t.slice(0, 2000).includes('BEGIN:VCALENDAR')) throw Object.assign(new Error('Not a calendar'), { status: 415 });
    return t;
  };
  try { return await get(url); } catch (e) { return await get('api/feed?url=' + encodeURIComponent(url)); }
}
// Turns a failed sync into a plain explanation of what went wrong and what to try.
function explainSyncError(e) {
  if (!navigator.onLine) return 'You are offline. It will try again later.';
  if (e.status === 415) return 'That link opens a web page, not a calendar. Copy the calendar sharing link instead of the address of the page. In Schoology it usually has "ical" in it.';
  if (e.status === 502) return `Your school site would not hand over the calendar${/\d{3}/.test(e.detail || '') ? ' (error ' + e.detail.match(/\d{3}/)[0] + ')' : ''}. Calendar sharing may be switched off, or the link has expired. Try copying a fresh link.`;
  if (e.status === 400) return 'That does not look like a full link. It should start with https:// or webcal://.';
  if (e.status === 404) return 'School sync is not available on this copy of the app.';
  return 'The calendar could not be reached. Check your connection and try again.';
}
let syncing = false;
async function syncAll(quiet, feeds = S.feeds) {
  if (syncing || !feeds.length) return;
  syncing = true;
  if (!quiet) toast('Syncing with school…');
  let added = 0, updated = 0, failed = 0;
  for (const f of feeds) {
    f.lastTry = Date.now();
    try {
      const r = importIcs(await fetchFeed(f.url), f);
      added += r.added; updated += r.updated; f.lastSync = Date.now(); f.lastError = '';
    } catch (e) { failed++; f.lastError = explainSyncError(e); }
  }
  syncing = false;
  save(); tick();
  if (!$('#sheet').open) render();
  if (quiet) { if (added) toast(`${added} new assignment${added > 1 ? 's' : ''} from school`); return; }
  toast(failed ? 'School sync did not work. See Settings for the reason.' : `School synced: ${added} new, ${updated} updated`);
}
const autoSync = () => { if (navigator.onLine && S.feeds.some(f => Date.now() - (f.lastTry || 0) > HOUR)) syncAll(true); };

/* ---------- reminders ---------- */
const canNotify = () => 'Notification' in window && Notification.permission === 'granted' && S.settings.notif;
async function show(title, body, tag) {
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, opts);
  } catch (e) { /* fall through */ }
  try { new Notification(title, opts); } catch (e) { /* not available */ }
}
function remind(key, title, body, plain) {
  if (S.sent[key] || !canNotify()) return;
  S.sent[key] = Date.now();
  show(title, S.settings.motivate && !plain ? `${body} ${quote()}`.trim() : body, key);
}
const HOUR = 3600e3;
const within = (t, now, ms = HOUR) => now >= t && now - t < ms;

function tick() {
  const now = new Date(), day = ymd(now), st = S.settings;
  const s = dayStats(day), miss = missing();
  const before = Object.keys(S.sent).length;

  if (within(atTime(day, st.morning), now, 3 * HOUR)) {
    const due = upcoming().filter(a => a.due.slice(0, 10) === day).length;
    const parts = [s.total && `${s.total} on your daily checklist`, due && `${due} assignment${due > 1 ? 's' : ''} due today`, miss.length && `${miss.length} missing`].filter(Boolean);
    remind(`morning|${day}`, S.settings.name ? `Good morning, ${S.settings.name}` : 'Good morning from RE-Mind', parts.length ? parts.join(', ') + '.' : 'A clear day. Plan something worth doing.');
  }
  for (const i of s.left) if (i.time && within(atTime(day, i.time), now)) remind(`daily|${i.id}|${day}`, i.title, 'Time to tick this off your daily checklist.');

  const eve = atTime(day, st.evening);
  if (s.left.length && now >= eve) {
    const slot = st.nagMins ? Math.floor((now - eve) / (st.nagMins * 60e3)) : 0;
    remind(`evening|${day}|${slot}`, `${s.left.length} thing${s.left.length > 1 ? 's' : ''} still not done today`, s.left.map(i => i.title).join(', ') + '.');
  }
  for (const t of S.tasks) if (!t.done && t.date && t.time && within(atTime(t.date, t.time), now)) remind(`task|${t.id}|${t.date}|${t.time}`, t.title, 'You scheduled this for now.');

  for (const a of upcoming()) {
    const left = new Date(a.due) - now;
    if (left <= 2 * HOUR) remind(`a2|${a.id}|${a.due}`, `Due soon: ${a.title}`, `Due at ${fmtTime(a.due.slice(11, 16))}${a.course ? ' for ' + a.course : ''}.`);
    else if (left <= 24 * HOUR) remind(`a24|${a.id}|${a.due}`, `Due tomorrow: ${a.title}`, `Due ${fmtDue(a.due)}${a.course ? ' for ' + a.course : ''}.`);
  }
  if (S.settings.callouts) for (const c of activeCallouts()) remind(`callout|${c.key}`, c.title, c.text, true);
  else if (miss.length) remind(`missing|${day}|${miss.length}`, `${miss.length} missing assignment${miss.length > 1 ? 's' : ''}`, miss.slice(0, 3).map(a => a.title).join(', ') + '. Turn them in, even late.');

  const old = Date.now() - 14 * 24 * HOUR;
  for (const k in S.sent) if (S.sent[k] < old) delete S.sent[k];
  for (const k in S.acked) if (S.acked[k] < old - 76 * 24 * HOUR) delete S.acked[k];
  if (Object.keys(S.sent).length !== before) save();
}

/* ---------- first-run setup ---------- */
// Asks who the person is, what they want and why, then uses the answers for motivation,
// default grade goals, the Report page and a starter daily checklist.
let ob = null;
const chips = (key, options) => `<div class="chips">${Object.entries(options).map(([k, v]) =>
  `<button type="button" class="chip ${ob.draft[key].includes(k) ? 'on' : ''}" data-ob-chip="${key}" data-val="${k}" aria-pressed="${ob.draft[key].includes(k)}">${v.label}</button>`).join('')}</div>`;
const OB_STEPS = [
  () => `<h2>Welcome to RE-Mind</h2><p class="sub">A few quick questions so the app can keep you on track in a way that works for you. Your answers stay on this phone.</p>
    <label class="field"><span>What should we call you?</span><input data-ob="name" value="${esc(ob.draft.name)}" maxlength="40" autocomplete="given-name" placeholder="Your first name"></label>`,
  () => `<h2>${ob.draft.name ? esc(ob.draft.name) + ', what' : 'What'} do you want to get better at?</h2><p class="sub">Pick as many as you like.</p>${chips('goals', GOALS)}
    <label class="field"><span>Or say it in your own words (optional)</span><input data-ob="goalText" value="${esc(ob.draft.goalText)}" maxlength="120" placeholder="e.g. Get a B or higher in every class"></label>`,
  () => `<h2>Why does this matter to you?</h2><p class="sub">RE-Mind will remind you of this when you feel like skipping.</p>
    <label class="field"><span>Your reason</span><input data-ob="why" value="${esc(ob.draft.why)}" maxlength="140" placeholder="e.g. Stay eligible for the team"></label>
    <label class="field"><span>What grade are you aiming for in your classes? (%)</span><input data-ob="gradeGoal" type="number" min="0" max="100" inputmode="decimal" value="${ob.draft.gradeGoal ?? ''}" placeholder="e.g. 90"></label>`,
  () => `<h2>What usually gets in your way?</h2><p class="sub">You will get tips aimed at these.</p>${chips('obstacles', OBSTACLES)}`,
  () => `<h2>How should RE-Mind talk to you?</h2><div class="chips col">${Object.entries({
      encouraging: ['Encouraging', 'Friendly pushes and positive reminders.'],
      tough: ['Tough love', 'Blunt and direct. No sugar-coating.'],
      facts: ['Just the facts', 'Only what is due and when. No pep talk.']
    }).map(([k, [t, d]]) => `<button type="button" class="chip big ${ob.draft.tone === k ? 'on' : ''}" data-ob-tone="${k}" aria-pressed="${ob.draft.tone === k}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>`,
  () => {
    const have = new Set(S.daily.map(i => i.title.toLowerCase()));
    const ideas = [...new Set((ob.draft.goals.length ? ob.draft.goals : ['habits', 'late']).flatMap(g => STARTERS[g] || []))].filter(t => !have.has(t.toLowerCase()));
    ob.ideas = ideas;
    if (ob.draft.starters == null) ob.draft.starters = S.profile.done ? [] : ideas.slice(0, 3);  // only pre-pick on first run
    return `<h2>Last step: your day</h2><p class="sub">When should RE-Mind check in with you?</p>
      <label class="setting">Morning briefing<input type="time" data-ob="morning" value="${ob.draft.morning}"></label>
      <label class="setting">Evening check-in<input type="time" data-ob="evening" value="${ob.draft.evening}"></label>
      ${ideas.length ? `<p class="sub" style="margin-top:14px">Start your daily checklist with these? Tap to choose.</p>
      <div class="chips col">${ideas.map(t => `<button type="button" class="chip ${ob.draft.starters.includes(t) ? 'on' : ''}" data-ob-starter="${esc(t)}" aria-pressed="${ob.draft.starters.includes(t)}">${esc(t)}</button>`).join('')}</div>` : ''}`;
  }
];
function startOnboarding() {
  ob = { step: 0, draft: { ...structuredClone(S.profile), name: S.settings.name, morning: S.settings.morning, evening: S.settings.evening, starters: null } };
  renderOnboarding();
}
function renderOnboarding() {
  const el = $('#onboard'), last = ob.step === OB_STEPS.length - 1;
  el.hidden = false;
  el.innerHTML = `<div class="ob-box"><div class="ob-dots">${OB_STEPS.map((_, i) => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="ob-body">${OB_STEPS[ob.step]()}</div>
    <div class="sheet-actions">${ob.step ? '<button class="btn ghost" data-ob-go="-1">Back</button>' : '<button class="btn ghost" data-ob-go="skip">Skip</button>'}
    <span class="spacer"></span><button class="btn primary" data-ob-go="1">${last ? 'Finish' : 'Next'}</button></div></div>`;
  el.scrollTop = 0;
}
function finishOnboarding(skipped) {
  if (!skipped) {
    const d = ob.draft;
    S.settings.name = d.name.trim();
    if (d.morning) S.settings.morning = d.morning;
    if (d.evening) S.settings.evening = d.evening;
    const g = d.gradeGoal === '' || d.gradeGoal == null || isNaN(+d.gradeGoal) ? null : +d.gradeGoal;
    Object.assign(S.profile, { goals: d.goals, goalText: d.goalText.trim(), why: d.why.trim(), obstacles: d.obstacles, tone: d.tone, gradeGoal: g });
    if (g != null) for (const c of S.classes) if (c.goal == null) c.goal = g;
    for (const t of d.starters || []) S.daily.push({ id: uid(), created: ymd(), title: t, time: '' });
  }
  S.profile.done = true;
  ob = null; $('#onboard').hidden = true;
  save(); render(); tick();
  if (!skipped) toast(S.settings.name ? `You are set, ${S.settings.name}. Let's go.` : 'You are set. Let\'s go.');
}
$('#onboard').addEventListener('input', e => { const k = e.target.dataset.ob; if (k) ob.draft[k] = e.target.value; });
$('#onboard').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  e.stopPropagation();
  const toggle = (list, v) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  if (t.dataset.obChip) ob.draft[t.dataset.obChip] = toggle(ob.draft[t.dataset.obChip], t.dataset.val);
  else if (t.dataset.obTone) ob.draft.tone = t.dataset.obTone;
  else if (t.dataset.obStarter) ob.draft.starters = toggle(ob.draft.starters, t.dataset.obStarter);
  else if (t.dataset.obGo === 'skip') return finishOnboarding(true);
  else if (t.dataset.obGo) {
    ob.step += +t.dataset.obGo;
    if (ob.step >= OB_STEPS.length) return finishOnboarding(false);
  }
  renderOnboarding();
});

/* ---------- start ---------- */
let lastDay = ymd();
function refresh() {
  if (ymd() !== lastDay || tab === 'today') { lastDay = ymd(); if (!$('#sheet').open) render(); }
  tick(); autoSync();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
if (!S.profile.done) startOnboarding();
tick();
autoSync();
setInterval(refresh, 30e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
