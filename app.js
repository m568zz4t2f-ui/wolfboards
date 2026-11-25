// Wolfboards · page behaviour
// Film (scroll-driven) · booking form · patch cable builder · dock · reveals.
// The problem picker itself needs no JS (radios + CSS :has); this file only wires state between sections.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

// ── Film: one scroll progress drives frame, camera scale, caption and rail ──
// Each beat: [frame, start scale, end scale]. To use footage later, swap a shot's <img> for a <video>
// and map the beat's local progress t to video.currentTime.
const PLAN = [
  ['side', 0.84, 0.88],  // 0 whole board, pulled back so the brand word has room
  ['side', 0.88, 1.60],  // 1 cut to the run: push into the top cable arcs
  ['under', 1.00, 1.15], // 2 under the deck
  ['low', 1.05, 1.30],   // 3 every connection checked
  ['side', 1.05, 0.84],  // 4 back to the whole board
];
const film = document.querySelector('.film');
let renderFilm = () => {};

function startFilm() {
  film.classList.add('film-on');
  const stage = film.querySelector('.film-stage');
  const beats = [...film.querySelectorAll('.beat')];
  const steps = [...film.querySelectorAll('.rail button')];
  const shots = Object.fromEntries([...film.querySelectorAll('.shot')].map(s => [s.dataset.frame, s]));
  const smooth = t => t * t * (3 - 2 * t);
  let travel = 1, beat = -1;
  const measure = () => { travel = Math.max(1, film.offsetHeight - stage.offsetHeight); }; // layout read: resize only

  renderFilm = () => {
    const p = Math.min(1, Math.max(0, -film.getBoundingClientRect().top / travel));
    const x = p * PLAN.length;
    const i = Math.min(PLAN.length - 1, Math.floor(x));
    const [frame, s0, s1] = PLAN[i];
    shots[frame].style.transform = `scale(${(s0 + (s1 - s0) * smooth(Math.min(1, x - i))).toFixed(4)})`;
    if (i === beat) return;
    beat = i;
    film.dataset.beat = i;
    beats.forEach((b, j) => b.classList.toggle('is-on', j === i));
    for (const k in shots) shots[k].classList.toggle('on', k === frame);
    steps.forEach((b, j) => b.setAttribute('aria-current', j === i ? 'step' : 'false'));
  };

  // Rail steps jump to the held middle of each beat.
  steps.forEach((b, j) => b.addEventListener('click', () =>
    scrollTo({ top: film.offsetTop + travel * (j + 0.35) / PLAN.length, behavior: 'smooth' })));
  addEventListener('resize', () => requestAnimationFrame(() => { measure(); renderFilm(); }));
  measure();
  renderFilm();
}

// ── Booking form ──
const SERVICE = { noise: 'Cleanup & troubleshooting', dropout: 'Cleanup & troubleshooting', mess: 'Re-cable', layout: 'Full rebuild' };
const req = $('req'), service = $('f-service'), issue = $('f-issue'), issueErr = $('f-issue-err');

function bookingMessage() {
  const f = new FormData(req);
  const lines = ['Hi Marvin, I\'d like to request a service.', '', 'Service: ' + f.get('service'), 'What\'s happening: ' + (f.get('issue').trim() || '…')];
  if (f.get('pedals').trim()) lines.push('Pedals: ' + f.get('pedals').trim());
  lines.push('Getting it to you: ' + f.get('handoff'));
  if (f.get('date').trim()) lines.push('Deadline: ' + f.get('date').trim());
  return lines.join('\n');
}

// ── Patch cable builder (separate order, separate message) ──
const cableList = $('cable-list');
const blankRow = cableList.firstElementChild.cloneNode(true);
const KIND = { 'Right-angle, low profile': 'lp', 'Right-angle': 'ra', 'Straight': 'st' };
const LENGTHS = ['3 in', '4 in', '6 in', '8 in', '10 in', '12 in', '18 in', '24 in'];
const val = (li, n) => li.querySelector(`[name="${n}"]`).value;
const qtyOf = li => Math.max(1, Math.min(50, parseInt(val(li, 'qty'), 10) || 1));
const cableCount = () => [...cableList.children].reduce((n, li) => n + qtyOf(li), 0);

function cableMessage() {
  const lines = ['Hi Marvin, I\'d like custom patch cables (Mogami).', ''];
  for (const li of cableList.children) lines.push(`• ${qtyOf(li)} × ${val(li, 'len')}: ${val(li, 'a')} to ${val(li, 'b')}`);
  const total = cableCount();
  lines.push('', `Total: ${total} cable${total === 1 ? '' : 's'}`);
  const notes = $('c-notes').value.trim();
  if (notes) lines.push('Notes: ' + notes);
  return lines.join('\n');
}
function drawRow(li, i) {
  const len = val(li, 'len'), idx = LENGTHS.indexOf(len);
  li.querySelector('.plug').dataset.kind = KIND[val(li, 'a')];
  li.querySelector('.plug.b').dataset.kind = KIND[val(li, 'b')];
  li.querySelector('.cord').style.setProperty('--len', idx < 0 ? 1 : 0.18 + 0.82 * idx / (LENGTHS.length - 1));
  li.querySelector('.len-tag').textContent = idx < 0 ? 'custom' : len;
  li.querySelector('.remove').setAttribute('aria-label', `Remove cable ${i + 1}`);
  li.querySelector('.dup').setAttribute('aria-label', `Duplicate cable ${i + 1}`);
}
function addRow(from) {
  const row = blankRow.cloneNode(true);
  if (from) for (const n of ['len', 'a', 'b', 'qty']) row.querySelector(`[name="${n}"]`).value = val(from, n);
  from ? from.after(row) : cableList.append(row);
  row.classList.add('enter');
  syncCables();
  row.querySelector('select').focus();
}

// ── Dock: appears after the film (which has its own actions); hidden over the booking form ──
const dock = $('dock'), dockLabel = $('dock-service'), dockBtn = dock.querySelector('.btn');
const cablesSection = $('cables'), cableSend = $('cable-send'), booking = $('request');
let dockState = '';
function placeDock() {
  const vh = innerHeight;
  const b = booking.getBoundingClientRect(), c = cablesSection.getBoundingClientRect(), s = cableSend.getBoundingClientRect();
  const inCables = c.top < vh * 0.5 && c.bottom > vh * 0.5;
  const hidden = film.getBoundingClientRect().bottom > vh * 0.5 || (b.top < vh * 0.9 && b.bottom > 0) || (inCables && s.top < vh && s.bottom > 0);
  const n = inCables ? cableCount() : 0;
  const label = inCables ? `${n} cable${n === 1 ? '' : 's'} in your order` : service.value;
  const state = `${hidden}|${inCables}|${label}`;
  if (state === dockState) return; // touch the DOM only when something changed
  dockState = state;
  dock.hidden = hidden;
  dockLabel.textContent = label;
  dockBtn.textContent = inCables ? 'Send cable order' : 'Book your board in';
  dockBtn.setAttribute('href', inCables ? '#cable-send' : '#request');
}

// ── Sync: previews and dock follow every change ──
function syncBooking() { $('preview').textContent = bookingMessage(); placeDock(); }
function syncCables() {
  [...cableList.children].forEach(drawRow);
  $('c-preview').textContent = cableMessage();
  const only = cableList.children.length === 1;
  cableList.querySelectorAll('.remove').forEach(b => { b.disabled = only; });
  placeDock();
}

// ── Send: copy inside the click, then show a real link to the chat ──
// (Opening a window from script is blocked in many embedded and in-app browsers, so the chat is opened by the
//  visitor's own tap on a real link. Nothing claims success unless the copy actually worked.)
// execCommand is deprecated but is still the most widely allowed synchronous copy; the async API is the backup.
function copySync(text) {
  const t = document.createElement('textarea');
  t.value = text;
  t.setAttribute('readonly', '');
  t.style.cssText = 'position:fixed;top:0;opacity:0';
  document.body.append(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  t.remove();
  return ok;
}
function sendToDM(text, statusEl, fallbackEl, box, goLink) {
  box.value = text;
  const copied = copySync(text) ? Promise.resolve() : navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
  copied.then(() => {
    statusEl.className = 'status ok';
    statusEl.textContent = 'Copied. Open the Instagram chat and paste it.';
    fallbackEl.hidden = true;
    goLink.hidden = false;
    goLink.focus();
  }, () => {
    statusEl.className = 'status bad';
    statusEl.textContent = 'Couldn\'t copy automatically. Copy the message below, then paste it in the Instagram chat.';
    goLink.hidden = true;
    fallbackEl.hidden = false;
    box.focus();
    box.select();
  });
}

// ── Wiring ──
// Picking a problem pre-selects its service everywhere; clearing resets it.
document.querySelectorAll('[name="symptom"]').forEach(r => r.addEventListener('change', () => { service.value = SERVICE[r.value]; syncBooking(); }));
$('symptoms').addEventListener('reset', () => setTimeout(() => { service.value = 'Not sure yet'; syncBooking(); }));
// Service links (hero, footer) pre-select the matching problem.
document.querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => {
  const r = $('s-' + a.dataset.pick);
  if (r) { r.checked = true; service.value = SERVICE[r.value]; syncBooking(); }
}));
// "Book …" buttons carry the service (and the picked problem) into the form.
document.querySelectorAll('[data-service]').forEach(a => a.addEventListener('click', () => {
  service.value = a.dataset.service;
  const symptom = document.querySelector('[name="symptom"]:checked');
  if (symptom && !issue.value) issue.value = symptom.nextElementSibling.textContent + '.';
  syncBooking();
}));

req.addEventListener('input', syncBooking);
req.addEventListener('change', syncBooking);
issue.addEventListener('input', () => { if (issue.value.trim()) { issue.removeAttribute('aria-invalid'); issueErr.hidden = true; } });
req.addEventListener('submit', e => {
  e.preventDefault();
  if (!issue.value.trim()) {
    issue.setAttribute('aria-invalid', 'true');
    issueErr.hidden = false;
    issue.focus();
    return;
  }
  sendToDM(bookingMessage(), $('status'), $('fallback'), $('f-msg'), $('go'));
});

$('add-cable').addEventListener('click', () => addRow());
cableList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  if (e.target.closest('.step')) {
    li.querySelector('[name="qty"]').value = Math.max(1, Math.min(50, qtyOf(li) + Number(e.target.closest('.step').dataset.step)));
    syncCables();
  } else if (e.target.closest('.dup')) {
    addRow(li);
  } else if (e.target.closest('.remove') && cableList.children.length > 1) {
    (li.nextElementSibling || li.previousElementSibling).querySelector('select').focus();
    li.remove();
    syncCables();
  }
});
$('cable-form').addEventListener('input', syncCables);
$('cable-form').addEventListener('change', syncCables);
$('cable-form').addEventListener('submit', e => { e.preventDefault(); sendToDM(cableMessage(), $('c-status'), $('c-fallback'), $('c-msg'), $('c-go')); });

// One rAF-throttled scroll loop for everything scroll-driven.
let frameQueued = false;
addEventListener('scroll', () => {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => { frameQueued = false; placeDock(); renderFilm(); });
}, { passive: true });

// Scroll reveals: headings rise, lists stagger. Once only; skipped under reduced motion.
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -2% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => {
    [...el.children].forEach((c, i) => c.style.setProperty('--i', i));
    el.classList.add('armed');
    io.observe(el);
  });
}

// Pre-decode images that appear mid-scroll during idle time, so no frame pays for a decode.
(window.requestIdleCallback || (cb => setTimeout(cb, 400)))(() => {
  document.querySelectorAll('.frames img, .view img').forEach(img => { img.loading = 'eager'; img.decode().catch(() => {}); });
});

// ── Start ──
if (film && !reduce) startFilm();
syncBooking();
syncCables();
