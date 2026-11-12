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
const quote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

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
  daily: [], dailyLog: {}, tasks: [], assignments: [], classes: [], feeds: [], sent: {},
  settings: { name: '', notif: false, morning: '07:30', evening: '20:00', nagMins: 30, motivate: true }
};
let S = load();
let tab = 'today';
let schoolSeg = 'assignments';

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* start fresh */ }
  const s = { ...structuredClone(DEFAULTS), ...saved };
  s.settings = { ...DEFAULTS.settings, ...(saved.settings || {}) };
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
      <p class="sub">${streak() ? `🔥 ${streak()}-day streak` : 'Finish the whole list to start a streak.'}</p></div></section>`;
    if (miss.length) h += `<div class="alert bad"><b>${miss.length} missing assignment${miss.length > 1 ? 's' : ''}</b>${miss.slice(0, 3).map(a => esc(a.title)).join(', ')}${miss.length > 3 ? ' and more' : ''}. Turn them in, even late.</div>`;
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
      h += `<div class="btn-row" style="margin:0 0 14px"><button class="btn primary" data-act="add-assignment">+ Add assignment</button><button class="btn" data-act="school-sync">${S.feeds.length ? 'Sync school' : 'Connect school'}</button></div>`;
      if (m.length) h += `<section class="card"><h2>Missing <span class="badge bad">${m.length}</span></h2><ul class="list">${m.map(assignmentRow).join('')}</ul></section>`;
      h += `<section class="card"><h2>Upcoming</h2>${u.length ? `<ul class="list">${u.map(assignmentRow).join('')}</ul>` : '<p class="empty">Nothing upcoming. Add an assignment or import your school calendar.</p>'}</section>`;
      if (d.length) h += `<section class="card"><h2>Turned in</h2><ul class="list">${d.map(assignmentRow).join('')}</ul></section>`;
    } else {
      h += `<section class="card"><div class="card-head"><h2>Classes</h2><button class="btn small primary" data-act="add-class">+ Add class</button></div>
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
    return `${verdict}<div class="stats">
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
        <label class="setting">Your name<input data-set="name" value="${esc(st.name)}" placeholder="Optional"></label></section>
      <section class="card"><h2>Reminders</h2><p class="sub">${permText}</p>
        <div class="btn-row"><button class="btn primary" data-act="enable-notif">${perm === 'granted' && st.notif ? 'Turn off' : 'Turn on notifications'}</button>
        <button class="btn" data-act="test-notif">Send a test</button></div>
        <div style="margin-top:10px">
        <label class="setting">Morning briefing<input type="time" data-set="morning" value="${st.morning}"></label>
        <label class="setting">Evening check-in<input type="time" data-set="evening" value="${st.evening}"></label>
        <label class="setting">Keep nagging until done<select data-set="nagMins">
          ${[[0, 'Once only'], [15, 'Every 15 min'], [30, 'Every 30 min'], [60, 'Every hour']].map(([v, l]) => `<option value="${v}" ${+st.nagMins === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="setting">Motivational messages<input type="checkbox" data-set="motivate" ${st.motivate ? 'checked' : ''}></label></div></section>
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
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  $('#top-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

/* ---------- sheet (add / edit forms) ---------- */
let sheetCtx = null;
function openSheet({ title, fields, onSave, onDelete, help, after }) {
  sheetCtx = { onSave, onDelete, help, after };
  $('#sheet-title').textContent = title;
  $('#sheet-fields').innerHTML = fields.map(f => f.options
    ? `<label class="field"><span>${esc(f.label)}</span><select name="${f.name}">${f.options.map(([v, l]) => `<option value="${v}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`
    : `<label class="field"><span>${esc(f.label)}</span>
    <input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''}
    ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.type === 'number' ? 'min="0" max="150" step="0.1" inputmode="decimal"' : ''} ${f.type === 'text' || !f.type ? 'maxlength="120" autocomplete="off"' : ''}></label>`).join('') + '<p class="sub" id="sheet-help" style="margin:0 0 14px"></p>';
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
      { name: 'goal', label: 'Goal grade (%)', type: 'number', value: c?.goal }
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
    after: () => syncAll(false, [feed])
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
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    if (!t.slice(0, 2000).includes('BEGIN:VCALENDAR')) throw new Error('Not a calendar');
    return t;
  };
  try { return await get(url); } catch (e) { return await get('api/feed?url=' + encodeURIComponent(url)); }
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
    } catch (e) { failed++; f.lastError = navigator.onLine ? 'Could not read this link' : 'Offline, will retry'; }
  }
  syncing = false;
  save(); tick();
  if (!$('#sheet').open) render();
  if (quiet) { if (added) toast(`${added} new assignment${added > 1 ? 's' : ''} from school`); return; }
  toast(failed ? 'That link could not be read from here. Download the calendar as a file and use "Import .ics file" instead.'
    : `School synced: ${added} new, ${updated} updated`);
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
function remind(key, title, body) {
  if (S.sent[key] || !canNotify()) return;
  S.sent[key] = Date.now();
  show(title, S.settings.motivate ? `${body} ${quote()}` : body, key);
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
    remind(`morning|${day}`, 'Good morning from RE-Mind', parts.length ? parts.join(', ') + '.' : 'A clear day. Plan something worth doing.');
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
  if (miss.length) remind(`missing|${day}|${miss.length}`, `${miss.length} missing assignment${miss.length > 1 ? 's' : ''}`, miss.slice(0, 3).map(a => a.title).join(', ') + '. Turn them in, even late.');

  const old = Date.now() - 14 * 24 * HOUR;
  for (const k in S.sent) if (S.sent[k] < old) delete S.sent[k];
  if (Object.keys(S.sent).length !== before) save();
}

/* ---------- start ---------- */
let lastDay = ymd();
function refresh() {
  if (ymd() !== lastDay || tab === 'today') { lastDay = ymd(); if (!$('#sheet').open) render(); }
  tick(); autoSync();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
tick();
autoSync();
setInterval(refresh, 30e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
