export const APP_JS = `
'use strict';

// ── STATE ───────────────────────────────────────────────────
let currentUser = null;
let canEdit = false;
let DATA = { hs:{students:[]}, ms:{students:[]} };
let currentStudentKey = null;
let editState = { mode:'add', sk:'hs', index:-1 };
let connectedVal = false;
let interactionKey = null;
let editInteractionContext = null;
let pendingDeleteInteraction = null;
let currentInteractions = [];
let toastTimer = null;
let resetToken = null;        // held in memory only; stripped from the URL on boot

// ── ORG SETTINGS ────────────────────────────────────────────
let orgSettings = null;       // loaded from /api/settings/public on boot
let settingsData = null;      // full settings for admin editing
let settingsOriginal = null;  // snapshot for cancel/dirty detection
let settingsDirty = false;

// ── THEME ────────────────────────────────────────────────────
function initTheme() {
  const pref = localStorage.getItem('asm-theme') || 'auto';
  applyTheme(pref);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('asm-theme') || 'auto') === 'auto') applyTheme('auto');
  });
}
function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'light') root.setAttribute('data-theme', 'light');
  else if (pref === 'dark') root.setAttribute('data-theme', 'dark');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
  localStorage.setItem('asm-theme', pref);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('theme-btn-' + pref);
  if (activeBtn) activeBtn.classList.add('active');
  if (typeof applyBranding === 'function') applyBranding();
}

// ── SWIPE BACK ────────────────────────────────────────────────
function initSwipeBack() {
  const screen = document.getElementById('screen-student');
  if (!screen) return;
  let startX = 0, startY = 0;
  screen.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  screen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (startX < 50 && dx > 80 && Math.abs(dy) < 80) goBack();
  }, { passive: true });
}

// ── GRADIENTS (yellow palette) ──────────────────────────────
const GRADIENTS = [
  'linear-gradient(135deg,#f5c842,#f0a800)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#fcd34d,#fbbf24)',
  'linear-gradient(135deg,#f0a800,#d97706)',
  'linear-gradient(135deg,#fde68a,#f5c842)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#f5c842,#fbbf24)',
  'linear-gradient(135deg,#fbbf24,#f0a800)',
];

// ── HELPERS ─────────────────────────────────────────────────
function initials(n) {
  return (n||'?').trim().split(/\\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
}
function driveThumb(url) {
  if (!url) return null;
  const raw = String(url).trim();

  // R2 URLs and direct Google-hosted image URLs are served directly
  if (raw.startsWith('/r2/')) return raw;
  if (/^https?:\\/\\//.test(raw) && raw.includes('googleusercontent.com')) return raw;

  const mPath = raw.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
  if (mPath) return 'https://drive.google.com/thumbnail?id=' + mPath[1] + '&sz=w200-h200-c';

  try {
    const u = new URL(raw);
    const id = u.searchParams.get('id');
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w200-h200-c';
  } catch (_) {}

  return /^https?:\\/\\//.test(raw) ? raw : null;
}
// A bare YYYY-MM-DD parses as UTC midnight and then renders one day earlier in
// any timezone behind UTC, so birthdays would read a day off. Build those as a
// local date instead; anything else (full ISO timestamps) parses as before.
function parseDateValue(val) {
  if (!val) return null;
  const s = String(val);
  const bare = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  const d = bare ? new Date(+bare[1], +bare[2] - 1, +bare[3]) : new Date(s);
  return isNaN(d) ? null : d;
}
function formatDate(val) {
  if (!val) return '';
  const d = parseDateValue(val);
  if (!d) return val;
  return d.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
}
function calcAge(bd) {
  if (!bd) return null;
  const d = parseDateValue(bd);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0 || (now.getMonth()===d.getMonth() && now.getDate()<d.getDate())) age--;
  return age > 0 && age < 30 ? age : null;
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m<2) return 'just now';
  if (m<60) return m+'m ago';
  const h = Math.floor(m/60);
  if (h<24) return h+'h ago';
  const days = Math.floor(h/24);
  if (days<7) return days+'d ago';
  const wk = Math.floor(days/7);
  if (wk<5) return wk+'w ago';
  return Math.floor(days/30)+'mo ago';
}

// ── SCREEN MANAGEMENT ────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-'+name);
  if (el) { el.classList.add('active'); window.scrollTo(0,0); }
  const bnav = document.getElementById('bottom-nav');
  if (bnav) bnav.style.display = name === 'app' ? '' : 'none';
}

// ── MAIN NAV PANELS ──────────────────────────────────────────
function switchMainNav(name, btn) {
  document.querySelectorAll('.nav-panel').forEach(p => p.style.display='none');
  const p = document.getElementById('nav-'+name);
  if (p) p.style.display='';
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Sync mobile drawer active state
  ['roster','dashboard','activity','dump'].forEach(n => {
    const mb = document.getElementById('mob-pill-'+n);
    if (mb) mb.classList.toggle('active', n === name);
  });
  // Sync bottom nav active state
  ['roster','dashboard','activity','dump'].forEach(n => {
    const bb = document.getElementById('bnav-'+n);
    if (bb) bb.classList.toggle('active', n === name);
  });
  if (name==='activity') loadActivityFeed();
  if (name==='dashboard') renderDashboard();
}

function toggleMobileNav() {
  document.getElementById('mobile-nav-drawer').classList.toggle('open');
  document.getElementById('mobile-nav-overlay').classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobile-nav-drawer').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.remove('open');
}

// ── GATE ─────────────────────────────────────────────────────
async function initGate() {
  // Check for an existing server-side session (passcode or leader)
  try {
    const res = await fetch('/roster/api/me');
    const data = await res.json();
    if (data.user) { currentUser = data.user; canEdit = ['approved','admin','leader'].includes(currentUser.role); initApp(); return; }
  } catch(_) {}
  showScreen('gate');
  showLanes();
}

// Every gate sub-form lives in the DOM at once and is toggled by display, so
// switching between them means hiding all of them first.
const GATE_FORMS = ['gate-passcode-form','gate-leader-form','gate-forgot-form','gate-reset-form'];
function hideGateForms() {
  GATE_FORMS.forEach(id => { const el=document.getElementById(id); if (el) el.style.display='none'; });
}
function openGateForm(id) {
  const la = document.getElementById('gate-lanes');
  if (la) la.style.display = 'none';
  hideGateForms();
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
  return el;
}
function clearGateMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent=''; el.className='gate-error'; }
}
// tone: '' (error, the default red), 'info' or 'ok'
function setGateMsg(id, text, tone) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'gate-error' + (tone ? ' ' + tone : '');
}

function showLanes() {
  hideGateForms();
  const la = document.getElementById('gate-lanes');
  if (la) la.style.display = 'flex';
  // Hide passcode lane if access mode is leaders-only
  const passcodeLane = document.getElementById('gate-lane-passcode');
  if (passcodeLane) {
    const mode = orgSettings?.accessMode || 'leaders-only';
    passcodeLane.style.display = mode === 'shared-passcode' ? '' : 'none';
  }
}

function showPasscodeForm() {
  openGateForm('gate-passcode-form');
  clearGateMsg('gate-error');
  const input = document.getElementById('gate-input');
  input.focus();
  input.onkeydown = e => { if (e.key==='Enter') checkPasscode(); };
}

function showLeaderForm() {
  openGateForm('gate-leader-form');
  clearGateMsg('gate-leader-error');
  const email = document.getElementById('gate-leader-email');
  const pw = document.getElementById('gate-leader-password');
  email.focus();
  // Enter submits from either field — previously only the password did.
  email.onkeydown = e => { if (e.key==='Enter') doGateLeaderLogin(); };
  pw.onkeydown = e => { if (e.key==='Enter') doGateLeaderLogin(); };
}

function showForgotForm() {
  openGateForm('gate-forgot-form');
  clearGateMsg('gate-forgot-error');
  // Carry over whatever they already typed on the sign-in form.
  const typed = (document.getElementById('gate-leader-email')||{}).value || '';
  const input = document.getElementById('gate-forgot-email');
  if (typed && !input.value) input.value = typed;
  input.focus();
  input.onkeydown = e => { if (e.key==='Enter') doForgotPassword(); };
}

function showResetForm(token) {
  showScreen('gate');
  resetToken = token;
  openGateForm('gate-reset-form');
  clearGateMsg('gate-reset-error');
  const pw = document.getElementById('gate-reset-password');
  const confirm = document.getElementById('gate-reset-confirm');
  pw.value=''; confirm.value='';
  confirm.onkeydown = e => { if (e.key==='Enter') doResetPassword(); };
  pw.focus();
}

// ── PASSWORD HELPERS ─────────────────────────────────────────
// The server is the authority; this only saves a round trip on an empty field.
function passwordProblem(pw) {
  return (pw||'') ? null : 'Enter a password.';
}
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

async function doForgotPassword() {
  const email = ((document.getElementById('gate-forgot-email')||{}).value||'').trim().toLowerCase();
  const btn = document.getElementById('gate-forgot-btn');
  if (!email) { setGateMsg('gate-forgot-error','Enter your email address.'); return; }
  btn.disabled=true; btn.textContent='Sending…'; clearGateMsg('gate-forgot-error');
  try {
    const res = await fetch('/roster/api/auth/forgot-password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email}),
    });
    const data = await res.json();
    if (res.status === 429) setGateMsg('gate-forgot-error', data.error||'Too many requests. Try again later.');
    // The server answers the same way whether or not the account exists, so
    // this message can't be used to find out who has an account.
    else setGateMsg('gate-forgot-error', data.message||'If that account exists, a reset link is on its way.', 'ok');
  } catch(_) { setGateMsg('gate-forgot-error','Network error. Please try again.'); }
  btn.disabled=false; btn.textContent='Send reset link →';
}

async function doResetPassword() {
  const pw = (document.getElementById('gate-reset-password')||{}).value||'';
  const confirm = (document.getElementById('gate-reset-confirm')||{}).value||'';
  const btn = document.getElementById('gate-reset-btn');
  const problem = passwordProblem(pw);
  if (problem) { setGateMsg('gate-reset-error', problem); return; }
  if (pw !== confirm) { setGateMsg('gate-reset-error', "Those passwords don't match."); return; }

  btn.disabled=true; btn.textContent='Saving…'; clearGateMsg('gate-reset-error');
  try {
    const res = await fetch('/roster/api/auth/reset-password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({token: resetToken, newPassword: pw, confirmPassword: confirm}),
    });
    const data = await res.json();
    if (data.success) {
      resetToken = null;
      showLeaderForm();
      if (data.email) document.getElementById('gate-leader-email').value = data.email;
      setGateMsg('gate-leader-error','Password updated. Sign in with your new password.','ok');
      showToast('✓ Password updated','ok');
    } else {
      setGateMsg('gate-reset-error', data.error||'Could not reset your password.');
    }
  } catch(_) { setGateMsg('gate-reset-error','Network error. Please try again.'); }
  btn.disabled=false; btn.textContent='Set password →';
}

async function checkPasscode() {
  const val = document.getElementById('gate-input').value;
  const btn = document.getElementById('gate-btn');
  const err = document.getElementById('gate-error');
  btn.disabled=true; err.textContent='';
  try {
    const res = await fetch('/roster/api/auth/passcode', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({passcode:val}),
    });
    const data = await res.json();
    if (data.ok) {
      currentUser = null; canEdit = false; // will be set by refreshCurrentUser in initApp
      initApp();
      showToast(data.message || 'View-only access enabled', 'ok');
    } else {
      err.textContent = 'Wrong passcode. Try again.';
      document.getElementById('gate-input').value = '';
      document.getElementById('gate-input').focus();
    }
  } catch(_) { err.textContent = 'Network error. Please try again.'; }
  btn.disabled=false;
}

async function doGateLeaderLogin() {
  const email = ((document.getElementById('gate-leader-email')||{}).value||'').trim().toLowerCase();
  const password = (document.getElementById('gate-leader-password')||{}).value||'';
  const btn = document.getElementById('gate-leader-btn');
  if (!email||!password) { setGateMsg('gate-leader-error','Please fill in all fields.'); return; }
  btn.disabled=true; btn.textContent='Signing in…'; clearGateMsg('gate-leader-error');
  try {
    const res = await fetch('/roster/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email,password}),
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user; canEdit = ['approved','admin','leader'].includes(currentUser.role);
      await afterLogin();
      showToast('Welcome back, '+currentUser.name+'!', 'ok');
    } else {
      // A pending account isn't a failed sign-in — the password was right, the
      // request just hasn't been approved yet. Say so in a non-alarming tone.
      setGateMsg('gate-leader-error', data.error || 'Login failed.', data.reason==='pending' ? 'info' : '');
    }
  } catch(_) { setGateMsg('gate-leader-error','Network error. Please try again.'); }
  btn.disabled=false; btn.textContent='Sign In →';
}

// Shared tail for both sign-in paths (gate form and auth modal). An account
// created through an invite carries mustChangePassword — it has a password
// somebody else chose, so it can't be allowed into the app as-is.
async function afterLogin() {
  if (currentUser && currentUser.mustChangePassword) {
    openChangePassword(true);
    return;
  }
  await initApp();
}

function showNeedAccess() {
  showToast('Contact your team admin or leader to request access.');
}

// ── INIT ─────────────────────────────────────────────────────
async function initApp() {
  showScreen('app');
  await refreshCurrentUser();
  await loadOrgSettings();
  await loadRoster();
}

async function refreshCurrentUser() {
  try {
    const res = await fetch('/roster/api/me');
    const data = await res.json();
    currentUser = data.user;
    canEdit = currentUser && ['approved','admin','leader'].includes(currentUser.role);
  } catch(e) { currentUser=null; canEdit=false; }
  updateNav();
}

function updateNav() {
  const buildRight = () => {
    if (!currentUser) {
      return '<button class="nav-btn" onclick="openAuthModal(\\'signup\\')">Sign Up</button>' +
             '<button class="nav-btn primary" onclick="openAuthModal(\\'login\\')">Log In</button>';
    }
    const adminlandBtn = currentUser.role==='admin'
      ? '<button class=\"nav-btn\" onclick=\"openAdminland()\">Adminland</button>' : '';
    const thumb = driveThumb(currentUser.photoUrl);
    const avatarInner = thumb
      ? '<img class=\"nav-avatar-img\" src=\"'+thumb+'\" alt=\"'+(currentUser.name||'User')+'\" onerror=\"this.style.display=\\'none\\';this.parentElement.classList.remove(\\'has-photo\\')\">'
      : initials(currentUser.name);
    const photoClass = thumb ? ' has-photo' : '';
    return adminlandBtn + '<button class=\"nav-avatar'+photoClass+'\" onclick=\"openProfileModal()\" title=\"'+currentUser.name+'\">'+avatarInner+'</button>';
  };
  ['nav-right','student-nav-right'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = buildRight();
  });
  const rb = document.getElementById('readonly-banner');
  if (rb) {
    if (!currentUser) {
      rb.style.display='flex';
      rb.querySelector('p').innerHTML='You\\'re viewing in <strong>read-only mode</strong>. Log in to edit.';
      rb.querySelector('button').style.display=''; rb.querySelector('button').textContent='Log In';
      rb.querySelector('button').onclick=()=>openAuthModal('login');
    } else if (currentUser.role==='viewer') {
      rb.style.display='flex';
      let msg = 'View-only mode.';
      if (currentUser.expiresAt) {
        const t = new Date(currentUser.expiresAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
        msg = 'View-only mode.';
      }
      rb.querySelector('p').innerHTML=msg;
      rb.querySelector('button').style.display=''; rb.querySelector('button').textContent='Leader Login';
      rb.querySelector('button').onclick=()=>openAuthModal('login');
    } else if (currentUser.role==='pending') {
      rb.style.display='flex';
      rb.querySelector('p').innerHTML='<strong>Account pending.</strong> You\\'ll get an email when approved.';
      rb.querySelector('button').style.display='none';
    } else {
      rb.style.display='none';
    }
  }
  document.querySelectorAll('.edit-gated').forEach(el => {
    el.style.display = canEdit ? '' : 'none';
  });
}

// ── CONNECTION STATUS ────────────────────────────────────────
// Column D of the sheet. Used to be three page sections; it's now a dropdown
// on every card, so a student moves between statuses without moving in the DOM.
const STATUS_LABELS = { core:'Core', loose:'Loosely Connected', fringe:'Fringe' };
const STATUS_ORDER = ['core','loose','fringe'];
function statusOf(p) { return STATUS_LABELS[p.status] ? p.status : 'core'; }

// ── ROSTER ───────────────────────────────────────────────────
async function loadRoster() {
  // Every failure here used to be swallowed and rendered as "No students here
  // yet", which is indistinguishable from an empty sheet — say what went wrong
  // instead, and give the leader a way to retry without reloading.
  let error = null;
  try {
    const res = await fetch('/roster/api/sheet/read');
    let data = null;
    try { data = await res.json(); } catch(_) {}
    if (!res.ok) {
      error = (data && data.error) || ('The roster sheet returned ' + res.status + '.');
    } else if (!data || !data.hs || !Array.isArray(data.hs.students)) {
      error = 'The roster sheet came back in a shape we could not read.';
    } else {
      DATA = data;
      await Promise.all([loadGoals(), loadInteractionCounts()]);
    }
  } catch(e) {
    error = 'Could not reach the server. Check your connection and try again.';
  }
  showRosterError(error);
  renderAll();
}

// Goals left the sheet when its Goals column was deleted; they live in
// roster_kv now, keyed by the student's sheet ID. Fetched as one map per tab
// rather than per card, then hung off the student objects so every existing
// reader (the card progress bar, the detail panel) keeps working unchanged.
async function loadGoals() {
  await Promise.all(['hs','ms'].map(async sk => {
    let map = {};
    try {
      const res = await fetch('/roster/api/student/goals?sk='+sk);
      if (res.ok) map = await res.json();
    } catch(e) { /* goals are additive — a failure here shouldn't blank the roster */ }
    (DATA[sk].students||[]).forEach(p => {
      const g = map[p.id] || {};
      p.goals = g.goals || [];
      p.primaryGoal = g.primaryGoal || '';
    });
  }));
}

// Hangout counts used to come from a sheet column the Apps Script maintained.
// That column is gone, so the "Most interactions" sort reads them from the
// notes store instead.
let interactionCountsOk = false;
async function loadInteractionCounts() {
  let ok = false;
  await Promise.all(['hs','ms'].map(async sk => {
    let counts = {};
    try {
      const res = await fetch('/roster/api/student/interactions?sk='+sk);
      if (res.ok) { counts = (await res.json()).counts || {}; ok = true; }
    } catch(e) { /* the sort degrades to zeroes; not worth failing the load */ }
    (DATA[sk].students||[]).forEach(p => { p.interactionCount = counts[p.id] || 0; });
  }));
  // The sort can live with zeroes; the dashboard can't — a zero it can't tell
  // apart from "no access" reads as "nobody has ever hung out with anyone".
  interactionCountsOk = ok;
}

function showRosterError(message) {
  const el = document.getElementById('roster-error');
  if (!el) return;
  if (!message) { el.style.display = 'none'; el.innerHTML = ''; return; }
  console.error('[roster] ' + message);
  el.style.display = 'flex';
  el.innerHTML = '<p><strong>Couldn\\'t load the roster.</strong> ' + message + '</p>' +
    '<button class="nav-btn primary" onclick="retryLoadRoster(this)">Retry</button>';
}

async function retryLoadRoster(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Retrying…'; }
  await loadRoster();
}

function renderAll() {
  // Apply grade tab labels from settings
  if (orgSettings?.gradeTabs) {
    const hsBtn = document.querySelector('.seg-btn[onclick*="hs"]');
    const msBtn = document.querySelector('.seg-btn[onclick*="ms"]');
    if (hsBtn && orgSettings.gradeTabs.hs?.label) hsBtn.textContent = orgSettings.gradeTabs.hs.label;
    if (msBtn && orgSettings.gradeTabs.ms?.label) msBtn.textContent = orgSettings.gradeTabs.ms.label;
  }
  ['hs','ms'].forEach(sk => renderGrid(DATA[sk].students, sk+'-grid', sk));
  document.querySelectorAll('.edit-gated').forEach(el => {
    el.style.display=canEdit?'':'none';
  });
  populateFilterDropdowns();
}

function renderGrid(data, id, sk) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML='';
  if (!(data||[]).length) {
    el.innerHTML='<div class="empty"><div class="empty-icon">👥</div><p>No students here yet</p></div>';
    return;
  }
  (data||[]).forEach((p,i) => el.appendChild(makeCard(p,i,sk)));
}

function makeCard(person, idx, sk) {
  const card = document.createElement('div');
  card.className='card';
  const g = GRADIENTS[idx % GRADIENTS.length];
  const thumb = driveThumb(person.photoUrl);
  const age = calcAge(person.birthday);

  const tr = orgSettings?.tracking || {school:true,birthdays:true,age:true,showGrade:true};
  const meta = [
    (tr.school!==false) && person.school   ? '🏫 '+person.school : '',
    (tr.birthdays!==false) && person.birthday ? '🎂 '+formatDate(person.birthday)+((tr.age!==false)&&age?' · '+age+'yo':'') : '',
    '🤝 '+lastConnectedLabel(person),
  ].filter(Boolean).map(t => '<div class="meta-item"><span>'+t+'</span></div>').join('');

  const connBadge = '<span class="badge-status '+(person.connected?'connected':'not-connected')+'">'+
    (person.connected?'● Family Connected With':'○ Not Connected')+'</span>';

  // The whole card is a click target for the detail view, so the dropdown has
  // to stop propagation or picking a status also navigates away from it.
  const st = statusOf(person);
  const statusEl = canEdit
    ? '<select class="status-select status-'+st+'" onclick="event.stopPropagation()" '+
      'onchange="event.stopPropagation();changeStatus(\\''+sk+'\\','+idx+',this.value,this)">'+
      STATUS_ORDER.map(k=>'<option value="'+k+'"'+(k===st?' selected':'')+'>'+STATUS_LABELS[k]+'</option>').join('')+
      '</select>'
    : '<span class="status-chip status-'+st+'">'+STATUS_LABELS[st]+'</span>';

  const goals = person.goals||[];
  const done = goals.filter(g=>g.done).length;
  const goalHtml = goals.length
    ? '<div class="goal-bar-wrap"><div class="goal-bar-label"><span>Goals</span><span>'+done+'/'+goals.length+'</span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:'+(goals.length?Math.round(done/goals.length*100):0)+'%"></div></div></div>'
    : (person.primaryGoal ? '<div class="goal-primary">🎯 '+person.primaryGoal.slice(0,40)+'</div>' : '');

  const editBtn = canEdit
    ? '<button class="card-edit-btn" onclick="event.stopPropagation();openEditModal(\\''+sk+'\\','+idx+')" title="Edit">✏️</button>'
    : '';

  const avatarClick = canEdit
    ? 'event.stopPropagation();openEditModal(\\''+sk+'\\','+idx+')'
    : '';
  card.innerHTML = editBtn +
    '<div class="card-avatar"'+(canEdit?' onclick="'+avatarClick+'"':'')+'>'+
    '<div class="av-fallback" style="background:'+g+'">'+initials(person.name)+'</div>'+
    (thumb ? '<img src="'+thumb+'" alt="" loading="lazy" onload="this.classList.add(\\'loaded\\')" onerror="this.style.display=\\'none\\'">' : '')+
    (canEdit?'<div class="av-edit-overlay">📷</div>':'')+
    '</div><div class="card-name-row"><div class="card-name">'+person.name+'</div>'+
    ((tr.showGrade!==false) && person.grade ? '<span class="badge-grade">Gr.'+person.grade+'</span>' : '')+'</div>'+
    (meta ? '<div class="card-meta">'+meta+'</div>' : '')+
    '<div class="card-status-row">'+statusEl+connBadge+'</div>' + goalHtml;

  card.addEventListener('click', () => openStudentDetail(sk, idx));
  return card;
}

// Column B of the sheet — the last time this student's parents were connected
// with. Written by the Apps Script when the Connected toggle is switched on.
function lastConnectedLabel(person) {
  if (!person.lastConnected) return 'Parent connection · never';
  const t = timeAgo(person.lastConnected);
  return 'Parent connection · ' + (t || formatDate(person.lastConnected));
}

// Every sheet write goes through POST. It used to be a GET with the params in
// the query string, which meant ?action=delete was reachable by navigation and,
// with a SameSite=Lax session cookie, a leader clicking a crafted link could
// delete a student. Cross-site POSTs carry no cookie.
function writeInit(params) {
  return {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: params.toString(),
  };
}

// Writes column D. Optimistic: the dropdown already shows the new value, so on
// failure it's put back rather than left lying about what the sheet holds.
async function changeStatus(sk, idx, value, el) {
  const person = (DATA[sk].students||[])[idx];
  if (!person || !canEdit) return;
  const previous = statusOf(person);
  if (value === previous) return;

  person.status = value;
  if (el) el.className = 'status-select status-' + value;

  try {
    const params = new URLSearchParams({action:'update',payload:JSON.stringify({sheet:sk,id:person.id,rowIndex:person.rowIndex,fields:{status:value}})});
    const res = await fetch('/roster/api/sheet/write', writeInit(params));
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast('✓ '+person.name+' → '+STATUS_LABELS[value],'ok');
  } catch(e) {
    person.status = previous;
    if (el) { el.value = previous; el.className = 'status-select status-' + previous; }
    showToast('Could not save status — the sheet still says '+STATUS_LABELS[previous],'error');
  }
}

// ── SEARCH (replaced by applyFilters below) ─────────────────

// ── HS/MS TAB ────────────────────────────────────────────────
function switchTab(sk, btn) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+sk).classList.add('active');
  document.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── AUTH MODAL ───────────────────────────────────────────────
function openAuthModal(tab='login') { switchAuthTab(tab); openModal('auth-modal'); }
function closeAuthModal() { closeModal('auth-modal'); }
function switchAuthTab(tab) {
  // The success panel replaces the signup form after a request goes through;
  // switching tabs puts the form back.
  document.getElementById('auth-signup-done').style.display = 'none';
  document.getElementById('auth-login-form').style.display  = tab==='login'  ? 'flex' : 'none';
  document.getElementById('auth-signup-form').style.display = tab==='signup' ? 'flex' : 'none';
  document.getElementById('tab-login-btn').classList.toggle('active', tab==='login');
  document.getElementById('tab-signup-btn').classList.toggle('active', tab==='signup');
  document.getElementById('auth-modal-title').textContent = tab==='login' ? 'Welcome Back' : 'Request Access';
  ['login-msg','signup-msg'].forEach(id => { const el=document.getElementById(id); el.textContent=''; el.className='auth-msg'; });
}

// ── CHANGE PASSWORD ──────────────────────────────────────────
// forced=true is the invite path: the account has a password someone else
// chose, so the modal can't be dismissed until it's replaced.
let passwordChangeForced = false;
function openChangePassword(forced) {
  passwordChangeForced = !!forced;
  ['pw-old','pw-new','pw-confirm'].forEach(id => { document.getElementById(id).value=''; });
  const msg = document.getElementById('pw-msg'); msg.textContent=''; msg.className='auth-msg';
  document.getElementById('password-modal-title').textContent = forced ? 'Set Your Own Password' : 'Change Password';
  document.getElementById('password-modal-sub').textContent = forced
    ? 'This account was set up with a temporary password. Choose your own to continue.'
    : 'Choose a new password for your account';
  document.getElementById('password-modal-close').style.display = forced ? 'none' : '';
  openModal('password-modal');
}

async function doChangePassword() {
  const oldPassword=v('pw-old'), newPassword=v('pw-new'), confirmPassword=v('pw-confirm');
  const msg=document.getElementById('pw-msg'), btn=document.getElementById('pw-submit');
  if (!oldPassword||!newPassword||!confirmPassword) { setMsg(msg,'Please fill in all fields.','error'); return; }
  const problem = passwordProblem(newPassword);
  if (problem) { setMsg(msg, problem, 'error'); return; }
  if (newPassword!==confirmPassword) { setMsg(msg,"Those passwords don't match.",'error'); return; }

  btn.disabled=true; btn.textContent='Updating…'; msg.textContent='';
  try {
    const res = await fetch('/roster/api/auth/change-password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({oldPassword,newPassword,confirmPassword}),
    });
    const data = await res.json();
    if (data.success) {
      closeModal('password-modal');
      showToast('✓ Password updated','ok');
      if (passwordChangeForced) { passwordChangeForced=false; await initApp(); }
    } else setMsg(msg, data.error||'Could not update your password.','error');
  } catch(_) { setMsg(msg,'Network error. Please try again.','error'); }
  btn.disabled=false; btn.textContent='Update Password';
}

async function doLogin() {
  const email = v('login-email').trim().toLowerCase(), password = v('login-password');
  const msg = document.getElementById('login-msg');
  const btn = document.getElementById('login-submit');
  if (!email||!password) { setMsg(msg,'Please fill in all fields.','error'); return; }
  btn.disabled=true; btn.textContent='Logging in…'; msg.textContent='';
  try {
    const res = await fetch('/roster/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email,password}),
    });
    const data = await res.json();
    btn.disabled=false; btn.textContent='Log In';
    if (data.success) {
      currentUser=data.user; canEdit=['approved','admin','leader'].includes(currentUser.role);
      closeAuthModal();
      // Same entry point the gate's Sign In uses. This branch used to call
      // renderAll() directly, which drew the empty in-memory DATA and left the
      // roster reading "No students here yet" until the page was reloaded —
      // loadRoster() is only ever called from initApp().
      await afterLogin();
      showToast('✓ Welcome back, '+currentUser.name+'!','ok');
    } else setMsg(msg, data.error||'Login failed.','error');
  } catch(_) {
    btn.disabled=false; btn.textContent='Log In';
    setMsg(msg,'Network error. Please try again.','error');
  }
}

async function doSignup() {
  const name=v('signup-name').trim(), email=v('signup-email').trim().toLowerCase(), password=v('signup-password');
  const msg=document.getElementById('signup-msg'), btn=document.getElementById('signup-submit');
  if (!name||!email||!password) { setMsg(msg,'Please fill in all fields.','error'); return; }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { setMsg(msg,'That email address doesn\\'t look right.','error'); return; }
  const problem = passwordProblem(password);
  if (problem) { setMsg(msg, problem, 'error'); return; }

  btn.disabled=true; btn.textContent='Sending…'; msg.textContent='';
  try {
    const res = await fetch('/roster/api/auth/signup', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name,email,password}),
    });
    const data = await res.json();
    btn.disabled=false; btn.textContent='Request Access';
    if (data.success) {
      // Swap the filled-in form for a confirmation, so it's obvious the
      // request went somewhere and there's nothing left to do.
      ['signup-name','signup-email','signup-password'].forEach(id=>{ document.getElementById(id).value=''; });
      document.getElementById('auth-signup-form').style.display='none';
      document.getElementById('auth-done-body').textContent = data.message || "A team admin will review it. You'll get an email as soon as it's approved.";
      document.getElementById('auth-signup-done').style.display='flex';
    } else setMsg(msg,data.error||'Could not send your request.','error');
  } catch(_) {
    btn.disabled=false; btn.textContent='Request Access';
    setMsg(msg,'Network error. Please try again.','error');
  }
}

async function logout() {
  await fetch('/roster/api/auth/logout',{method:'POST'});
  currentUser=null; canEdit=false;
  showScreen('gate'); showLanes();
  showToast('Logged out');
}

// ── PROFILE MODAL ─────────────────────────────────────────────
function openProfileModal() {
  if (!currentUser) { openAuthModal('login'); return; }
  document.getElementById('profile-av-initials').textContent = initials(currentUser.name);
  document.getElementById('profile-display-name').textContent = currentUser.name;
  document.getElementById('profile-display-email').textContent = currentUser.email;
  sv('profile-name-input', currentUser.name||'');
  sv('profile-since-input', currentUser.leaderSince||'');
  sv('profile-funfact-input', currentUser.funFact||'');
  const img=document.getElementById('profile-av-img');
  const thumb=driveThumb(currentUser.photoUrl);
  if(thumb){img.src=thumb;img.style.display='';img.classList.remove('loaded');}
  else img.style.display='none';
  openModal('profile-modal');
}
function closeProfileModal() { closeModal('profile-modal'); }

async function saveProfile() {
  if (!currentUser) return;
  const name=v('profile-name-input'), leaderSince=v('profile-since-input'), funFact=v('profile-funfact-input');
  const res=await fetch('/roster/api/profile/update',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,leaderSince,funFact}),
  });
  const data=await res.json();
  if (data.success) {
    Object.assign(currentUser,{name,leaderSince,funFact});
    updateNav(); closeProfileModal(); showToast('✓ Profile updated','ok');
  } else showToast(data.error||'Update failed','error');
}

function uploadProfilePhoto(input) {
  if (!input.files.length) return;
  const file=input.files[0]; input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      cropImg=img; cropZoom=1; cropOffX=0; cropOffY=0;
      cropCallback=async blob=>{
        const data=await uploadCroppedBlob(blob,'leader');
        if(data.url){
          await fetch('/roster/api/profile/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoUrl:data.url})});
          currentUser.photoUrl=data.url;
          const thumb=driveThumb(data.url)||data.url;
          if(thumb){const i=document.getElementById('profile-av-img');i.src=thumb;i.style.display='';i.onload=()=>i.classList.add('loaded');}
          updateNav(); showToast('✓ Photo updated','ok');
        } else showToast(data.error||'Upload failed','error');
      };
      openModal('crop-modal');
      drawCrop(); initCropDrag();
      document.getElementById('crop-zoom').value=1;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── EDIT STUDENT MODAL ────────────────────────────────────────
function openEditModal(sk, index) {
  if (!canEdit) return;
  const p = DATA[sk].students[index];
  editState={mode:'edit',sk,index};
  document.getElementById('edit-modal-title').textContent='Edit Student';
  document.getElementById('edit-modal-sub').textContent=(sk==='hs'?'High School':'Middle School')+' · '+STATUS_LABELS[statusOf(p)];
  sv('ef-name',p.name||''); sv('ef-grade',p.grade||''); sv('ef-school',p.school||'');
  sv('ef-birthday',p.birthday||''); sv('ef-notes',p.notes||'');
  sv('ef-photoUrl',p.photoUrl||''); sv('ef-primary-goal',p.primaryGoal||'');
  sv('ef-status',statusOf(p));
  setConnected(p.connected||false);
  updateEditPhotoPreview();
  document.getElementById('ef-delete-btn').style.display='inline-block';
  document.getElementById('ef-save-btn').textContent='Save Changes';
  openModal('edit-modal');
}

function openAddModal(sk) {
  if (!canEdit) return;
  editState={mode:'add',sk,index:-1};
  document.getElementById('edit-modal-title').textContent='Add Student';
  document.getElementById('edit-modal-sub').textContent=(sk==='hs'?'High School':'Middle School');
  ['ef-name','ef-grade','ef-school','ef-birthday','ef-notes','ef-photoUrl','ef-primary-goal'].forEach(id=>sv(id,''));
  sv('ef-status','core');
  setConnected(false); updateEditPhotoPreview();
  document.getElementById('ef-delete-btn').style.display='none';
  document.getElementById('ef-save-btn').textContent='Add Student';
  openModal('edit-modal');
  document.getElementById('ef-name').focus();
}

function closeEditModal() { closeModal('edit-modal'); }
function setConnected(val) {
  connectedVal=val;
  const el=document.getElementById('ef-connected-toggle');
  el.classList.toggle('on',val);
  el.querySelector('.toggle-label').textContent=val?'Family Connected With':'Not Connected';
}
function toggleConnected() { setConnected(!connectedVal); }
function updateEditPhotoPreview() {
  const url=v('ef-photoUrl'), name=v('ef-name')||'?';
  document.getElementById('edit-pv-fallback').textContent=initials(name);
  const img=document.getElementById('edit-pv-img');
  const thumb=driveThumb(url);
  if(thumb){img.style.display='';img.classList.remove('loaded');img.src=thumb;}
  else img.style.display='none';
}

function uploadStudentPhoto(input) {
  if (!input.files.length) return;
  const file=input.files[0]; input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      cropImg=img; cropZoom=1; cropOffX=0; cropOffY=0;
      cropCallback=async blob=>{
        const data=await uploadCroppedBlob(blob,'student');
        if(data.url){sv('ef-photoUrl',data.url);updateEditPhotoPreview();showToast('✓ Uploaded','ok');}
        else showToast(data.error||'Upload failed','error');
      };
      openModal('crop-modal');
      drawCrop(); initCropDrag();
      document.getElementById('crop-zoom').value=1;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function triggerStudentDetailPhotoUpload(sk, index) {
  if (!canEdit) return;
  cropCallback=async blob=>{
    const data=await uploadCroppedBlob(blob,'student');
    if(!data.url){showToast(data.error||'Upload failed','error');return;}
    const person=DATA[sk].students[index];
    person.photoUrl=data.url;
    const params=new URLSearchParams({action:'update',payload:JSON.stringify({sheet:sk,id:person.id,rowIndex:person.rowIndex,fields:{photoUrl:data.url}})});
    await fetch('/roster/api/sheet/write', writeInit(params));
    renderStudentDetail(sk,index);
    showToast('✓ Photo updated','ok');
  };
  const input=document.getElementById('shared-photo-input');
  if(input){input.value='';input.click();}
}

async function saveEdit() {
  const name=v('ef-name');
  if (!name) { showToast('Name is required','error'); return; }
  const btn=document.getElementById('ef-save-btn');
  const origText=btn.textContent;
  btn.disabled=true; btn.textContent='Saving…';
  // The primary goal is the one field on this form that isn't a sheet column
  // any more — it goes to roster_kv with the rest of the student's goals.
  const primaryGoal=v('ef-primary-goal');
  const fields={
    name, grade:v('ef-grade'), school:v('ef-school'), birthday:v('ef-birthday'),
    notes:v('ef-notes'), photoUrl:v('ef-photoUrl'),
    status:v('ef-status')||'core', connected:connectedVal,
  };
  const {mode,sk,index}=editState;
  try {
    if (mode==='edit') {
      const person=DATA[sk].students[index];
      Object.assign(person, fields);
      const params=new URLSearchParams({action:'update',payload:JSON.stringify({sheet:sk,id:person.id,rowIndex:person.rowIndex,fields})});
      const res=await fetch('/roster/api/sheet/write', writeInit(params));
      const data=await res.json();
      // Column B is stamped by the script when connected flips on, so re-read
      // the row's date from its response rather than guessing at it here.
      if (data.lastConnected!==undefined) person.lastConnected=data.lastConnected;
      await saveGoals(sk,person,primaryGoal,person.goals||[]);
      showToast(data.error?'Saved locally':'✓ Saved',data.error?'error':'ok');
    } else {
      const params=new URLSearchParams({action:'add',payload:JSON.stringify({sheet:sk,person:fields})});
      const res=await fetch('/roster/api/sheet/write', writeInit(params));
      const data=await res.json();
      const person={...fields,goals:[],primaryGoal:'',lastConnected:data.lastConnected||''};
      if (data.newRowIndex!==undefined) person.rowIndex=data.newRowIndex;
      if (data.id) person.id=data.id;
      DATA[sk].students.push(person);
      await saveGoals(sk,person,primaryGoal,[]);
      showToast(data.error?'Added locally':'✓ Student added',data.error?'error':'ok');
    }
  } catch(e) {
    showToast('Network error — changes saved locally','error');
  }
  renderAll(); closeEditModal(); btn.disabled=false; btn.textContent=origText;
}

function confirmDelete() {
  const {sk,index}=editState;
  const name=DATA[sk].students[index].name;
  document.getElementById('confirm-student-delete-name').textContent=name;
  openModal('confirm-student-delete-modal');
}
async function doConfirmDeleteStudent() {
  const {sk,index}=editState;
  const name=DATA[sk].students[index].name;
  const person=DATA[sk].students.splice(index,1)[0];
  const params=new URLSearchParams({action:'delete',payload:JSON.stringify({sheet:sk,id:person.id,rowIndex:person.rowIndex})});
  await fetch('/roster/api/sheet/write', writeInit(params));
  closeModal('confirm-student-delete-modal');
  renderAll(); closeEditModal(); showToast('Removed '+name,'ok');
}

// ── STUDENT DETAIL ────────────────────────────────────────────
async function openStudentDetail(sk, index) {
  currentStudentKey={sk,index};
  showScreen('student');
  await renderStudentDetail(sk,index);
}

function goBack() { showScreen('app'); }

async function renderStudentDetail(sk, index) {
  const person=DATA[sk].students[index];
  const el=document.getElementById('student-content');
  const g=GRADIENTS[index%GRADIENTS.length];
  const thumb=driveThumb(person.photoUrl);
  const age=calcAge(person.birthday);

  const tr2 = orgSettings?.tracking || {school:true,birthdays:true,age:true,showGrade:true};
  const chips=[
    (tr2.showGrade!==false) && person.grade   ? '📚 Grade '+person.grade : '',
    (tr2.school!==false) && person.school  ? '🏫 '+person.school : '',
    (tr2.birthdays!==false) && person.birthday? '🎂 '+formatDate(person.birthday)+((tr2.age!==false)&&age?' · '+age+'yo':'') : '',
    '🔗 '+STATUS_LABELS[statusOf(person)],
    person.connected?'✅ Family Connected With':'○ Not Connected',
    '🤝 '+lastConnectedLabel(person),
  ].filter(Boolean).map(c=>'<div class="chip">'+c+'</div>').join('');

  const editBtn = canEdit
    ? '<button class="nav-btn primary edit-gated" onclick="openEditModal(\\''+sk+'\\','+index+')">Edit</button>'
    : '';
  const logBtn = canEdit && tr2.hangoutNotes !== false
    ? '<button class="nav-btn" onclick="openInteractionModal(\\''+sk+'\\','+index+',\\''+person.name+'\\')">+ Log Hangout</button>'
    : '';

  const sdAvatarClick = canEdit ? ' onclick="triggerStudentDetailPhotoUpload(\\''+sk+'\\','+index+')"' : '';
  el.innerHTML =
    '<div class="student-hero">'+
      '<div class="sd-avatar-wrap"'+sdAvatarClick+'>'+
      '<div class="student-avatar-lg"><div class="av-fallback" style="background:'+g+'">'+initials(person.name)+'</div>'+
      (thumb?'<img src="'+thumb+'" alt="" onload="this.classList.add(\\'loaded\\')" onerror="this.style.display=\\'none\\'">':'')+
      '</div>'+
      (canEdit?'<div class="av-cam-overlay">📷</div>':'')+
      '</div>'+
      '<div class="student-info">'+
        '<div class="student-name">'+person.name+'</div>'+
        '<div class="student-chips">'+chips+'</div>'+
        '<div class="student-actions">'+editBtn+logBtn+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="student-grid">'+
      '<div class="panel" id="goals-panel">'+
        '<div class="panel-title">🎯 Goals <span id="goal-count"></span></div>'+
        '<div id="goals-list"><div class="loader"><div class="loader-ring"></div></div></div>'+
        (canEdit?'<div class="add-goal-row"><input class="add-goal-input" id="new-goal-input" placeholder="Add a new goal…"><button class="add-goal-btn" onclick="addGoal()">+</button></div>':'')+
        (person.primaryGoal?'<div style="margin-top:12px;padding:9px 11px;background:var(--accent-glow);border:1px solid var(--accent-border);border-radius:8px;font-size:12px;color:var(--accent)">⭐ Primary: '+person.primaryGoal+'</div>':'')+
      '</div>'+
      '<div class="panel">'+
        '<div class="panel-title">📝 Notes</div>'+
        '<div style="font-size:13px;color:var(--text2);line-height:1.6">'+(person.notes||'<span style="color:var(--muted)">No notes yet.</span>')+'</div>'+
      '</div>'+
      (tr2.hangoutNotes !== false ?
        '<div class="panel full">'+
          '<div class="panel-title">🤝 Hangout Log <span id="int-count"></span></div>'+
          '<div id="interactions-list"><div class="loader"><div class="loader-ring"></div></div></div>'+
        '</div>' : '')+
    '</div>';

  // Load goals
  const goals=person.goals||[];
  renderGoalsList(goals,sk,index);

  // Load interactions (only if hangout notes tracking is enabled)
  if (tr2.hangoutNotes !== false) {
    try {
      const res=await fetch('/roster/api/student/interactions?sk='+sk+'&id='+encodeURIComponent(person.id||''));
      const d=await res.json();
      renderInteractionsList(d.interactions||[], sk, index);
    } catch(e) { document.getElementById('interactions-list').innerHTML='<div class="empty"><p>Could not load.</p></div>'; }
  }
}

function renderGoalsList(goals,sk,index) {
  const el=document.getElementById('goals-list');
  if (!el) return;
  const gc=document.getElementById('goal-count');
  if (gc) gc.textContent=goals.length ? goals.filter(g=>g.done).length+'/'+goals.length+' done' : '';
  if (!goals.length) { el.innerHTML='<div class="empty"><p>No goals yet.</p></div>'; return; }
  el.innerHTML=goals.map((g,gi)=>
    '<div class="goal-item">'+
      '<div class="goal-check '+(g.done?'done':'')+'" onclick="toggleGoal('+gi+')" title="Toggle"></div>'+
      '<div class="goal-text '+(g.done?'done':'')+'">'+g.text+'</div>'+
      (g.primary?'<span class="primary-tag">Primary</span>':'')+
      (canEdit?'<button class="goal-del" onclick="deleteGoal('+gi+')" title="Remove">✕</button>':'')+
    '</div>'
  ).join('');
}

function renderInteractionsList(interactions, sk, index) {
  currentInteractions = interactions;
  const el=document.getElementById('interactions-list');
  if (!el) return;
  const ic=document.getElementById('int-count');
  if (ic) ic.textContent=interactions.length ? interactions.length+' logged' : '';
  if (!interactions.length) { el.innerHTML='<div class="empty"><p>No hangouts logged yet.</p></div>'; return; }
  el.innerHTML=[...interactions].reverse().map(int=>{
    const canManage=int.id && currentUser && (int.leaderEmail===currentUser.email || currentUser.role==='admin');
    const editedTag=int.updatedAt ? ' <span class="int-edited">edited</span>' : '';
    const actBtns=canManage
      ? '<div class="int-actions">'+
          '<button class="int-action-btn" data-id="'+int.id+'" data-sk="'+sk+'" data-idx="'+index+'" onclick="openEditInteractionModal(this.dataset.id,this.dataset.sk,+this.dataset.idx)">Edit</button>'+
          '<button class="int-action-btn danger" data-id="'+int.id+'" data-sk="'+sk+'" data-idx="'+index+'" onclick="deleteInteractionNote(this.dataset.id,this.dataset.sk,+this.dataset.idx)">Delete</button>'+
        '</div>'
      : '';
    return '<div class="int-item">'+
      '<div class="int-header">'+
        '<div class="int-av">'+initials(int.leader)+'</div>'+
        '<div><div class="int-who">'+int.leader+editedTag+'</div><div class="int-when">'+formatDate(int.date)+' · '+timeAgo(int.createdAt)+'</div></div>'+
      '</div>'+
      '<div class="int-body">'+int.summary+'</div>'+
      actBtns+
    '</div>';
  }).join('');
}

// ── GOALS CRUD ────────────────────────────────────────────────
async function addGoal() {
  const input=document.getElementById('new-goal-input');
  const text=input.value.trim();
  if (!text||!currentStudentKey) return;
  const {sk,index}=currentStudentKey;
  const person=DATA[sk].students[index];
  if (!person.goals) person.goals=[];
  person.goals.push({text,done:false,primary:person.goals.length===0,createdAt:new Date().toISOString()});
  input.value='';
  await syncGoals(sk,index);
  renderGoalsList(person.goals,sk,index);
  renderAll();
  showToast('✓ Goal added','ok');
}
async function toggleGoal(gi) {
  if (!canEdit||!currentStudentKey) return;
  const {sk,index}=currentStudentKey;
  const person=DATA[sk].students[index];
  person.goals[gi].done=!person.goals[gi].done;
  await syncGoals(sk,index);
  renderGoalsList(person.goals,sk,index);
  renderAll();
}
async function deleteGoal(gi) {
  if (!canEdit||!currentStudentKey) return;
  const {sk,index}=currentStudentKey;
  const person=DATA[sk].students[index];
  person.goals.splice(gi,1);
  await syncGoals(sk,index);
  renderGoalsList(person.goals,sk,index);
  showToast('Goal removed');
}
async function syncGoals(sk,index) {
  const person=DATA[sk].students[index];
  await saveGoals(sk,person,person.primaryGoal||'',person.goals||[]);
}
// Goals no longer have a sheet column — they're stored in roster_kv against
// the student's stable sheet ID.
async function saveGoals(sk,person,primaryGoal,goals) {
  if (!person||!person.id) return;
  person.primaryGoal=primaryGoal;
  person.goals=goals;
  await fetch('/roster/api/student/goals',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sk,id:person.id,primaryGoal,goals}),
  });
}

// ── INTERACTION MODAL ─────────────────────────────────────────
function openInteractionModal(sk,index,studentName) {
  interactionKey={sk,index,studentName};
  document.getElementById('int-modal-sub').textContent='with '+studentName;
  sv('int-leader',currentUser?currentUser.name:'');
  sv('int-date',new Date().toISOString().slice(0,10));
  sv('int-summary','');
  openModal('interaction-modal');
}
function closeInteractionModal() { closeModal('interaction-modal'); }

async function saveInteraction() {
  const leader=v('int-leader'), date=v('int-date'), summary=v('int-summary');
  if (!leader||!summary) { showToast('Leader name and summary required','error'); return; }
  const btn=document.querySelector('#interaction-modal .btn-save');
  if(btn){btn.disabled=true;btn.textContent='Saving…';}
  const {sk,index,studentName}=interactionKey;
  const person=DATA[sk].students[index];
  const interaction={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),leader,date,summary,createdAt:new Date().toISOString(),leaderEmail:currentUser?currentUser.email:''};
  try {
    const res=await fetch('/roster/api/student/interactions',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sk,id:person.id,rowIndex:person.rowIndex,studentName,interaction}),
    });
    const data=await res.json();
    if (data.success) {
      closeInteractionModal();
      showToast('✓ Hangout logged!','ok');
      if (currentStudentKey) renderStudentDetail(currentStudentKey.sk,currentStudentKey.index);
    } else showToast(data.error||'Failed','error');
  } catch(e) {
    showToast('Network error — try again','error');
  }
  if(btn){btn.disabled=false;btn.textContent='Log It ✓';}
}

// ── INTERACTION EDIT / DELETE ─────────────────────────────────
function openEditInteractionModal(intId, sk, index) {
  const int = currentInteractions.find(n => n.id === intId);
  if (!int) return;
  const person = DATA[sk]?.students?.[index] || {};
  editInteractionContext = { int, sk, index, id: person.id, rowIndex: person.rowIndex };
  sv('edit-int-date', int.date || '');
  sv('edit-int-summary', int.summary || '');
  openModal('edit-interaction-modal');
}

async function saveEditedInteraction() {
  if (!editInteractionContext) return;
  const { int, sk, id, rowIndex } = editInteractionContext;
  const date = v('edit-int-date');
  const summary = v('edit-int-summary');
  if (!summary) { showToast('Summary cannot be empty', 'error'); return; }
  const res = await fetch('/roster/api/student/interactions', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sk, id, rowIndex, interactionId: int.id, changes: { date, summary } }),
  });
  const data = await res.json();
  if (data.success) {
    closeModal('edit-interaction-modal');
    showToast('✓ Note updated', 'ok');
    if (currentStudentKey) renderStudentDetail(currentStudentKey.sk, currentStudentKey.index);
  } else showToast(data.error || 'Failed', 'error');
}

function deleteInteractionNote(interactionId, sk, index) {
  const person = DATA[sk]?.students?.[index] || {};
  pendingDeleteInteraction = { interactionId, sk, id: person.id, rowIndex: person.rowIndex };
  openModal('confirm-delete-modal');
}

async function confirmDeleteInteraction() {
  if (!pendingDeleteInteraction) return;
  const { interactionId, sk, id, rowIndex } = pendingDeleteInteraction;
  const res = await fetch('/roster/api/student/interactions', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sk, id, rowIndex, interactionId }),
  });
  const data = await res.json();
  if (data.success) {
    closeModal('confirm-delete-modal');
    pendingDeleteInteraction = null;
    showToast('Note deleted', 'ok');
    if (currentStudentKey) renderStudentDetail(currentStudentKey.sk, currentStudentKey.index);
  } else showToast(data.error || 'Failed', 'error');
}

// ── ACTIVITY FEED ─────────────────────────────────────────────
async function loadActivityFeed() {
  const el=document.getElementById('activity-feed');
  el.innerHTML='<div class="loader"><div class="loader-ring"></div></div>';
  try {
    const res=await fetch('/roster/api/activity/recent');
    const data=await res.json();
    const items=data.items||[];
    if (!items.length) { el.innerHTML='<div class="empty"><div class="empty-icon">🌱</div><p>No activity yet. Log some hangouts!</p></div>'; return; }
    el.innerHTML=items.map(item=>{
      const student=findStudent(item.studentName);
      const sThumb=student?driveThumb(student.photoUrl):null;
      const sg=GRADIENTS[0], lg=GRADIENTS[2];
      return '<div class="act-card" onclick="navigateToStudent(\\''+item.studentName+'\\')">'+
        '<div class="act-header">'+
          '<div class="act-avatars">'+
            '<div class="act-av"><div class="av-fallback" style="background:'+sg+'">'+initials(item.studentName)+'</div>'+
            (sThumb?'<img src="'+sThumb+'" onload="this.classList.add(\\'loaded\\')" onerror="this.style.display=\\'none\\'">':'')+
            '</div>'+
            '<div class="act-av"><div class="av-fallback" style="background:'+lg+'">'+initials(item.leader)+'</div></div>'+
          '</div>'+
          '<div class="act-info">'+
            '<div class="act-names"><span>'+item.studentName+'</span> × '+item.leader+'</div>'+
            '<div class="act-time">'+formatDate(item.date)+' · '+timeAgo(item.createdAt)+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="act-summary">'+item.summary.slice(0,200)+(item.summary.length>200?'…':'')+'</div>'+
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML='<div class="empty"><p>Could not load activity.</p></div>'; }
}

function findStudent(name) {
  for (const sk of ['hs','ms']) {
    const s=(DATA[sk].students||[]).find(p=>p.name===name);
    if (s) return s;
  }
  return null;
}
function findStudentKey(name) {
  for (const sk of ['hs','ms']) {
    const idx=(DATA[sk].students||[]).findIndex(p=>p.name===name);
    if (idx>=0) return {sk,index:idx};
  }
  return null;
}
function navigateToStudent(name) {
  const k=findStudentKey(name);
  if (k) openStudentDetail(k.sk,k.index);
}

// ── BRAIN DUMP ────────────────────────────────────────────────
async function processBrainDump() {
  const text=document.getElementById('dump-text').value.trim();
  if (!text) { showToast('Write something first!','error'); return; }
  const btn=document.getElementById('dump-btn');
  btn.disabled=true; btn.textContent='✨ Processing…';
  const roster=getAllStudentNames();
  const res=await fetch('/roster/api/brain-dump',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,roster})});
  const data=await res.json();
  btn.disabled=false; btn.textContent='✨ Process & Assign';
  const el=document.getElementById('dump-result');
  if (!data.parsed||!data.parsed.length) {
    el.innerHTML='<div class="dump-result"><p style="color:var(--muted)">Couldn\\'t match any students. Try being more specific!</p></div>';
    return;
  }
  window._dumpParsed=data.parsed;
  el.innerHTML='<div class="dump-result"><div class="dump-result-title">✓ Found '+data.parsed.length+' mention'+
    (data.parsed.length!==1?'s':'')+
    '</div>'+
    data.parsed.map((p,i)=>
      '<div class="dump-match">'+
        '<div class="dump-match-name">'+p.name+' <span style="font-size:11px;color:'+(p.matched?'var(--connected)':'var(--warning)')+'">'+(p.matched?'✓ in roster':'⚠ not found')+'</span></div>'+
        '<div class="dump-match-sum">'+p.summary.slice(0,300)+'</div>'+
        (p.matched&&canEdit?'<div class="dump-match-actions"><button class="add-btn" onclick="applyDump('+i+')">Log as Hangout</button></div>':'')+
      '</div>'
    ).join('')+
  '</div>';
}
function getAllStudentNames() {
  const names=[];
  for (const sk of ['hs','ms']) (DATA[sk].students||[]).forEach(p=>names.push(p.name));
  return names;
}
async function applyDump(i) {
  const p=window._dumpParsed[i];
  const k=findStudentKey(p.name);
  if (!k) { showToast('Student not found','error'); return; }
  const person=DATA[k.sk].students[k.index];
  const interaction={leader:currentUser?currentUser.name:'Unknown',date:new Date().toISOString().slice(0,10),summary:p.summary,createdAt:new Date().toISOString(),leaderEmail:currentUser?currentUser.email:''};
  const res=await fetch('/roster/api/student/interactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sk:k.sk,id:person.id,rowIndex:person.rowIndex,studentName:p.name,interaction})});
  const data=await res.json();
  if (data.success) showToast('✓ Logged for '+p.name,'ok');
  else showToast('Failed: '+(data.error||''),'error');
}

// ── ADMIN ─────────────────────────────────────────────────────

function openAdminland() {
  loadAdminPanel();
}


function openAdminUsers() {
  showScreen('admin');
  switchAdminTab('users', document.querySelector('.admin-tab[onclick*="users"]'));
  loadAdminUsers();
}

async function loadAdminPanel() {
  showScreen('admin');
  await Promise.all([loadAdminOverview(),loadAdminUsers(),loadAdminMetrics()]);
}
function switchAdminTab(name,btn) {
  document.querySelectorAll('.admin-sec').forEach(s=>s.classList.remove('active'));
  document.getElementById('admin-'+name).classList.add('active');
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
}
async function loadAdminOverview() {
  const total=['hs','ms'].reduce((a,sk)=>a+(DATA[sk].students||[]).length,0);
  const conn=['hs','ms'].reduce((a,sk)=>a+(DATA[sk].students||[]).filter(p=>p.connected).length,0);
  let ints=0;
  try{const r=await fetch('/roster/api/activity/stats');const d=await r.json();ints=d.totalInteractions||0;}catch(e){}
  document.getElementById('admin-stats-grid').innerHTML=
    kpi(total,'Total Students')+kpi(conn,'Connected')+kpi(ints,'Hangouts Logged')+
    kpi((DATA.hs.students||[]).filter(p=>statusOf(p)==='core').length,'HS Core')+
    kpi((DATA.ms.students||[]).filter(p=>statusOf(p)==='core').length,'MS Core');
}
function kpi(n,label) { return '<div class="kpi"><div class="kpi-val">'+n+'</div><div class="kpi-label">'+label+'</div></div>'; }
function stat(n,label) { return '<div class="stat"><div class="stat-val">'+n+'</div><div class="stat-label">'+label+'</div></div>'; }
async function loadAdminUsers() {
  const res=await fetch('/roster/api/admin/users');
  const data=await res.json();
  const users=data.users||[];
  const el=document.getElementById('admin-users-table');
  if (!users.length) { el.innerHTML='<div class="empty"><p>No users.</p></div>'; return; }
  const selfEmail=(currentUser?.email||'').toLowerCase();
  el.innerHTML='<table class="user-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>'+
    users.map(u=>{
      const isSelf=u.email.toLowerCase()===selfEmail;
      const isAdmin=u.role==='admin';
      const isLeader=u.role==='leader';
      const isPending=u.role==='pending';
      const leaderChecked=(isLeader||isAdmin)?'checked':'';
      const leaderDisabled=(isSelf||isAdmin)?'disabled':'';
      return '<tr'+(isSelf?' style="background:var(--accent-glow)"':'')+'><td>'+u.name+(isSelf?' <span style="font-size:10px;color:var(--muted)">(you)</span>':'')+'</td>'+
        '<td style="color:var(--muted)">'+u.email+'</td>'+
        '<td><span class="role-badge '+u.role+'">'+u.role+'</span></td>'+
        '<td style="color:var(--muted);font-family:\\'JetBrains Mono\\',monospace;font-size:11px">'+(u.createdAt?new Date(u.createdAt).toLocaleDateString():'—')+'</td>'+
        '<td><div class="btn-row">'+
          (isPending?'<button class="role-btn approve" onclick="updateUser(\\''+u.email+'\\',\\'leader\\')">Approve</button>':'')+
          (isPending&&!isSelf?'<button class="role-btn revoke" onclick="declineUser(\\''+u.email+'\\')">Decline</button>':'')+
          (!isAdmin?'<label class="leader-toggle" title="Toggle leader access"><input type="checkbox" '+leaderChecked+' '+leaderDisabled+' onchange="toggleLeader(\\''+u.email+'\\',this.checked)"><span>Leader</span></label>':'')+
          (!isSelf&&!isAdmin?'<button class="role-btn mk-admin" onclick="updateUser(\\''+u.email+'\\',\\'admin\\')">→ Admin</button>':'')+
          (!isSelf&&!isPending?'<button class="role-btn revoke" onclick="updateUser(\\''+u.email+'\\',\\'pending\\')">Revoke</button>':'')+
        '</div></td></tr>';
    }).join('')+'</tbody></table>';
}
async function toggleLeader(email, isLeader) {
  await updateUser(email, isLeader ? 'leader' : 'approved');
}
async function loadAdminMetrics() {
  const el=document.getElementById('admin-metrics-content');
  try {
    const r=await fetch('/roster/api/activity/stats'); const d=await r.json();
    el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:4px">'+
      '<div class="panel"><div class="panel-title">🏆 Most Active Leaders</div>'+
      (d.topLeaders||[]).map(l=>'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span>'+l.name+'</span><span style="color:var(--accent)">'+l.count+' hangouts</span></div>').join('')+
      (!(d.topLeaders||[]).length?'<p style="color:var(--muted);font-size:13px">No data yet</p>':'')+
      '</div>'+
      '<div class="panel"><div class="panel-title">❤️ Most Visited</div>'+
      (d.topStudents||[]).map(s=>'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span>'+s.name+'</span><span style="color:var(--accent)">'+s.count+' visits</span></div>').join('')+
      (!(d.topStudents||[]).length?'<p style="color:var(--muted);font-size:13px">No data yet</p>':'')+
      '</div></div>'+
      '<div class="panel" style="margin-top:16px"><div class="panel-title">📊 Overview</div>'+
      '<div class="stats" style="margin-top:12px">'+
        stat(d.totalInteractions||0,'Total Interactions')+stat(d.uniqueLeaders||0,'Active Leaders')+
        stat(d.uniqueStudents||0,'Students Visited')+stat(d.thisMonth||0,'This Month')+
      '</div></div>';
  } catch(e) { el.innerHTML='<div class="empty"><p>Could not load.</p></div>'; }
}
async function updateUser(email,role) {
  if (currentUser && email.toLowerCase()===currentUser.email.toLowerCase() && currentUser.role==='admin' && role!=='admin') {
    showToast('You cannot change your own admin status','error'); return;
  }
  const res=await fetch('/roster/api/admin/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,role})});
  const data=await res.json();
  if (data.success) { showToast('✓ Updated','ok'); loadAdminUsers(); }
  else showToast(data.error||'Failed','error');
}

// Matches declining from the email link: the account is deleted outright and
// the person is told nothing. They can request again later if they want to.
async function declineUser(email) {
  if (!window.confirm('Decline and delete the request from '+email+'?\\n\\nThey will not be notified.')) return;
  const res=await fetch('/roster/api/admin/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action:'delete'})});
  const data=await res.json();
  if (data.success) { showToast('Request declined','ok'); loadAdminUsers(); }
  else showToast(data.error||'Failed','error');
}

// ── FILTER / SORT ────────────────────────────────────────────
function getAllStudents() {
  const all=[];
  for (const sk of ['hs','ms']) (DATA[sk].students||[]).forEach((p,i)=>all.push({...p,_sk:sk,_idx:i}));
  return all;
}
function populateFilterDropdowns() {
  const all=getAllStudents();
  const grades=[...new Set(all.map(p=>p.grade).filter(Boolean))].sort((a,b)=>+a-+b);
  const schools=[...new Set(all.map(p=>p.school).filter(Boolean))].sort();
  const gradeEl=document.getElementById('filter-grade');
  const schoolEl=document.getElementById('filter-school');
  if(gradeEl){
    const cur=gradeEl.value;
    gradeEl.innerHTML='<option value="">All Grades</option>'+grades.map(g=>'<option value="'+g+'">Grade '+g+'</option>').join('');
    gradeEl.value=cur;
  }
  if(schoolEl){
    const cur=schoolEl.value;
    schoolEl.innerHTML='<option value="">All Schools</option>'+schools.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
    schoolEl.value=cur;
  }
}
function applyFilters() {
  const q=(document.getElementById('roster-search').value||'').toLowerCase().trim();
  const gradeF=document.getElementById('filter-grade').value;
  const schoolF=document.getElementById('filter-school').value;
  const connF=document.getElementById('filter-connected').value;
  const statusF=(document.getElementById('filter-status')||{}).value||'';
  const sortF=document.getElementById('filter-sort').value;
  ['hs','ms'].forEach(sk => {
    const gridEl=document.getElementById(sk+'-grid');
    if(!gridEl) return;
    const items=DATA[sk].students||[];
    let filtered=items.map((p,i)=>({p,i})).filter(({p})=>{
      if(q && !(p.name||'').toLowerCase().includes(q) && !(p.school||'').toLowerCase().includes(q) && !(p.grade||'').toLowerCase().includes(q)) return false;
      if(gradeF && p.grade!==gradeF) return false;
      if(schoolF && p.school!==schoolF) return false;
      if(statusF && statusOf(p)!==statusF) return false;
      if(connF==='connected' && !p.connected) return false;
      if(connF==='not-connected' && p.connected) return false;
      return true;
    });
    if(sortF) {
      filtered.sort((a,b)=>{
        switch(sortF){
          case 'name-asc': return (a.p.name||'').localeCompare(b.p.name||'');
          case 'name-desc': return (b.p.name||'').localeCompare(a.p.name||'');
          case 'grade-asc': return (+a.p.grade||99)-(+b.p.grade||99);
          case 'grade-desc': return (+b.p.grade||0)-(+a.p.grade||0);
          case 'status-asc': return STATUS_ORDER.indexOf(statusOf(a.p))-STATUS_ORDER.indexOf(statusOf(b.p));
          case 'interactions-desc': return (+b.p.interactionCount||0)-(+a.p.interactionCount||0);
          case 'interactions-asc': return (+a.p.interactionCount||0)-(+b.p.interactionCount||0);
          default: return 0;
        }
      });
    }
    gridEl.innerHTML='';
    if(!filtered.length){
      gridEl.innerHTML='<div class="empty"><div class="empty-icon">🔍</div><p>No students match your filters</p></div>';
      return;
    }
    // The card's index has to stay the student's index in DATA, not their
    // position in the filtered list — every action on the card looks them up
    // by it.
    filtered.forEach(({p,i})=>gridEl.appendChild(makeCard(p,i,sk)));
  });
  document.querySelectorAll('.edit-gated').forEach(el=>{el.style.display=canEdit?'':'none';});
  updateFilterCount();
}
function clearSearch() {
  const el = document.getElementById('roster-search');
  if (el) { el.value=''; applyFilters(); }
}
function clearFilters() {
  document.getElementById('roster-search').value='';
  document.getElementById('filter-grade').value='';
  document.getElementById('filter-school').value='';
  document.getElementById('filter-connected').value='';
  const statusEl=document.getElementById('filter-status');
  if(statusEl) statusEl.value='';
  document.getElementById('filter-sort').value='';
  const panel = document.getElementById('filter-panel');
  if (panel) panel.classList.remove('open');
  const btn = document.getElementById('filter-toggle-btn');
  if (btn) { btn.classList.remove('active','has-filters'); }
  updateFilterCount();
  renderAll();
}
function toggleFilterPanel() {
  const panel = document.getElementById('filter-panel');
  const btn = document.getElementById('filter-toggle-btn');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('active', !isOpen);
}
function updateFilterCount() {
  const count = [
    (document.getElementById('filter-grade')||{}).value,
    (document.getElementById('filter-school')||{}).value,
    (document.getElementById('filter-connected')||{}).value,
    (document.getElementById('filter-status')||{}).value,
    (document.getElementById('filter-sort')||{}).value,
  ].filter(Boolean).length;
  const badge = document.getElementById('filter-count');
  const btn = document.getElementById('filter-toggle-btn');
  if (badge) { badge.textContent = count||''; badge.classList.toggle('visible', count>0); }
  if (btn) btn.classList.toggle('has-filters', count>0);
  const sc = document.getElementById('search-clear');
  if (sc) {
    const q = (document.getElementById('roster-search')||{}).value||'';
    sc.classList.toggle('visible', q.length>0);
  }
}

// ── CSV EXPORT ───────────────────────────────────────────────
function exportCSV() {
  const rows=[['Name','Grade','School','Birthday','Connection Status','Level','Connected','Last Connection','Interaction Count','Primary Goal','Notes']];
  for(const sk of ['hs','ms']){
    (DATA[sk].students||[]).forEach(p=>{
      rows.push([
        p.name||'', p.grade||'', p.school||'', p.birthday||'',
        STATUS_LABELS[statusOf(p)],
        sk==='hs'?'High School':'Middle School',
        p.connected?'Yes':'No',
        p.lastConnected||'',
        p.interactionCount||'0', p.primaryGoal||'', (p.notes||'').replace(/[\\n\\r]+/g,' ')
      ]);
    });
  }
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='asm-roster-'+new Date().toISOString().slice(0,10)+'.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV downloaded','ok');
}

// ── PRINT ────────────────────────────────────────────────────
function printRoster() {
  window.print();
}

// ── DASHBOARD ────────────────────────────────────────────────
// ── STATS DASHBOARD ──────────────────────────────────────────
// Everything here is derived, never stored. Roster-shaped numbers come from
// DATA (already loaded, so they're free and work for any viewer); anything
// time-based comes from /activity/stats, which needs the activity permission
// and only sees the last 90 days. When that call fails the roster panels still
// render — the activity ones are simply left out rather than shown as zeroes,
// which would read as "nobody has logged a hangout".

const DASH_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DASH_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DASH_DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DASH_DOW_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DASH_MEDALS = ['🥇','🥈','🥉'];
const DASH_STATUS_COLORS = { core:'#4ade80', loose:'#f5c842', fringe:'#f87171' };

// Names and schools come from a spreadsheet leaders type into by hand, so they
// reach the DOM as text, not markup.
function dashEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dashTabLabel(sk) {
  const t = orgSettings && orgSettings.gradeTabs && orgSettings.gradeTabs[sk];
  return (t && t.label) || (sk === 'hs' ? 'High School' : 'Middle School');
}

function dashCountBy(items, pick) {
  const out = {};
  items.forEach(it => { const k = pick(it); if (k !== '' && k != null) out[k] = (out[k]||0) + 1; });
  return out;
}
function dashRanked(counts) {
  return Object.keys(counts).map(k => ({ label:k, value:counts[k] })).sort((a,b) => b.value - a.value);
}
function dashPct(n, d) { return d ? Math.round(n / d * 100) : 0; }

function dashDaysSince(dateStr) {
  const d = parseDateValue(dateStr);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
// Days until the next time this birthday comes round, not the age.
function dashDaysToBirthday(bd) {
  const d = parseDateValue(bd);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - today) / 86400000);
}

// ── dashboard building blocks ────────────────────────────────
function dashTile(val, label, sub, unit) {
  return '<div class="dash-tile"><div class="dash-tile-val">' + val +
    (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>' +
    '<div class="dash-tile-label">' + label + '</div>' +
    (sub ? '<div class="dash-tile-sub">' + sub + '</div>' : '') + '</div>';
}
function dashPanel(title, inner, opts) {
  const o = opts || {};
  return '<div class="panel' + (o.full ? ' full' : '') + '">' +
    '<div class="panel-title">' + title + (o.badge ? '<span>' + o.badge + '</span>' : '') + '</div>' +
    inner + (o.note ? '<div class="dash-note">' + o.note + '</div>' : '') + '</div>';
}
function dashEmpty(msg) { return '<div class="dash-empty">' + msg + '</div>'; }

// rows: [{label, value}] — bar widths are relative to the biggest row, not to
// the total, so a breakdown with one dominant bucket still reads.
function dashBars(rows, suffix) {
  if (!rows.length) return dashEmpty('Nothing to show yet');
  const max = Math.max.apply(null, rows.map(r => r.value)) || 1;
  return rows.map(r =>
    '<div class="dash-bar-row">' +
      '<div class="dash-bar-label">' + dashEsc(r.label) + '</div>' +
      '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + dashPct(r.value, max) + '%"></div></div>' +
      '<div class="dash-bar-val">' + r.value + (suffix || '') + '</div>' +
    '</div>').join('');
}

function dashRanks(rows) {
  if (!rows.length) return dashEmpty('Nothing to show yet');
  const max = Math.max.apply(null, rows.map(r => r.value)) || 1;
  return rows.map((r, i) =>
    '<div class="dash-bar-row">' +
      '<div class="dash-rank-medal">' + (DASH_MEDALS[i] || (i + 1)) + '</div>' +
      '<div class="dash-rank-name">' + dashEsc(r.label) + '</div>' +
      '<div class="dash-bar-track" style="max-width:110px"><div class="dash-bar-fill" style="width:' + dashPct(r.value, max) + '%"></div></div>' +
      '<div class="dash-bar-val">' + r.value + '</div>' +
    '</div>').join('');
}

// segs: [{label, value, color}]
function dashDonut(segs, centerText) {
  const live = segs.filter(s => s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0);
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = live.map(s => {
    const dash = total ? s.value / total * C : 0;
    const el = '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + s.color +
      '" stroke-width="15" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) +
      '" stroke-dashoffset="' + (-offset).toFixed(2) + '"></circle>';
    offset += dash;
    return el;
  }).join('');
  const legend = segs.map(s =>
    '<div class="dash-legend-item"><span class="dash-legend-dot" style="background:' + s.color + '"></span>' +
    dashEsc(s.label) + ' · ' + s.value + ' (' + dashPct(s.value, total) + '%)</div>').join('');
  return '<div class="dash-donut-wrap">' +
    '<div class="dash-donut-chart">' +
      '<svg class="dash-donut-svg" viewBox="0 0 100 100">' +
        '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="var(--surface3)" stroke-width="15"></circle>' + arcs +
      '</svg>' +
      '<div class="dash-donut-center">' + centerText + '</div>' +
    '</div><div class="dash-donut-legend">' + legend + '</div></div>';
}

// cols: [{tick, value}]
function dashSpark(cols) {
  if (!cols.length) return dashEmpty('Nothing to show yet');
  const max = Math.max.apply(null, cols.map(c => c.value)) || 1;
  return '<div class="dash-spark">' + cols.map(c =>
    '<div class="dash-spark-col' + (c.value === max && max > 0 ? ' peak' : '') + '">' +
      '<div class="dash-spark-n">' + (c.value || '') + '</div>' +
      '<div class="dash-spark-bar" style="height:' + Math.max(2, Math.round(c.value / max * 58)) + 'px"></div>' +
      '<div class="dash-spark-tick">' + dashEsc(c.tick) + '</div>' +
    '</div>').join('') + '</div>';
}

function dashFact(icon, html) {
  return '<div class="dash-fact"><span class="dash-fact-icon">' + icon + '</span><span>' + html + '</span></div>';
}

async function renderDashboard() {
  const el = document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="loader-ring"></div></div>';

  let act = null;
  try {
    const r = await fetch('/roster/api/activity/stats');
    if (r.ok) act = await r.json();
  } catch(e) { /* roster-only dashboard below; the activity panels drop out */ }

  const all = getAllStudents();
  const total = all.length;
  if (!total) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>No students on the roster yet — stats will show up here once there are.</p></div>';
    return;
  }

  const hsCount = all.filter(p => p._sk === 'hs').length;
  const msCount = total - hsCount;
  const connected = all.filter(p => p.connected).length;
  const statusCounts = { core:0, loose:0, fringe:0 };
  all.forEach(p => { statusCounts[statusOf(p)]++; });

  // interactionCounts silently degrade to zero when the notes store is
  // unreachable or the viewer lacks access, which would read as "nobody has
  // ever hung out". Only draw those panels when the numbers are real.
  const hasCounts = interactionCountsOk;
  const hangouts = all.reduce((a, p) => a + (+p.interactionCount || 0), 0);
  const noHangout = all.filter(p => !(+p.interactionCount)).length;
  const avgHangouts = total ? (hangouts / total) : 0;

  const schoolRanks = dashRanked(dashCountBy(all, p => (p.school || '').trim()));
  const gradeRanks = dashRanked(dashCountBy(all, p => (p.grade || '').toString().trim()))
    .sort((a, b) => (+a.label || 99) - (+b.label || 99));

  const ages = all.map(p => calcAge(p.birthday)).filter(a => a);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const withPhoto = all.filter(p => p.photoUrl).length;
  const withNotes = all.filter(p => (p.notes || '').trim()).length;

  const goalsTotal = all.reduce((a, p) => a + (p.goals || []).length, 0);
  const goalsDone = all.reduce((a, p) => a + (p.goals || []).filter(g => g.done).length, 0);
  const withGoals = all.filter(p => (p.goals || []).length).length;

  const neverConnected = all.filter(p => !p.lastConnected).length;

  // ── headline tiles ──
  let html = '<div class="dash-section-title">The Big Numbers</div><div class="dash-tiles">' +
    dashTile(total, 'Students', dashTabLabel('hs') + ' ' + hsCount + ' · ' + dashTabLabel('ms') + ' ' + msCount) +
    dashTile(dashPct(connected, total), 'Connection Rate', connected + ' of ' + total + ' families connected', '%') +
    (hasCounts ? dashTile(hangouts, 'Hangouts Logged', 'All time, across every student') : '') +
    (hasCounts ? dashTile(avgHangouts.toFixed(1), 'Hangouts / Student', noHangout + ' still at zero') : '') +
    (act ? dashTile(act.thisMonth || 0, 'Hangouts This Month', (act.last7 || 0) + ' in the last 7 days') : '') +
    (act ? dashTile(act.activeLeaders7 || 0, 'Leaders Active', 'Logged something this week') : '') +
    dashTile(schoolRanks.length, 'Schools', 'Campuses we show up on') +
    dashTile(goalsTotal ? dashPct(goalsDone, goalsTotal) : 0, 'Goals Complete', goalsDone + ' of ' + goalsTotal + ' checked off', '%') +
  '</div>';

  // ── who's on the roster ──
  html += '<div class="dash-section-title">Who\\'s On The Roster</div><div class="dash-grid">';
  html += dashPanel('🎯 Connection Status', dashDonut([
      { label:'Core', value:statusCounts.core, color:DASH_STATUS_COLORS.core },
      { label:'Loosely Connected', value:statusCounts.loose, color:DASH_STATUS_COLORS.loose },
      { label:'Fringe', value:statusCounts.fringe, color:DASH_STATUS_COLORS.fringe },
    ], String(total)));
  html += dashPanel('🤝 Family Connection', dashDonut([
      { label:'Connected', value:connected, color:'#4ade80' },
      { label:'Not yet', value:total - connected, color:'#f87171' },
    ], dashPct(connected, total) + '%'));
  html += dashPanel('🎓 By Grade', dashBars(gradeRanks.map(g => ({ label:'Grade ' + g.label, value:g.value }))));
  html += dashPanel('🏫 By School', dashBars(schoolRanks.slice(0, 8)), {
    badge: schoolRanks.length > 8 ? '+' + (schoolRanks.length - 8) + ' more' : '' });
  html += '</div>';

  // ── connection health ──
  const stale = all
    .map(p => ({ p:p, days: dashDaysSince(p.lastConnected) }))
    .sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return -1;   // never connected sorts to the top
      if (b.days === null) return 1;
      return b.days - a.days;
    }).slice(0, 8);
  const staleHtml = stale.map(s =>
    '<div class="dash-list-row"><span class="grow">' + dashEsc(s.p.name) + '</span>' +
    '<span class="dash-list-note ' + (s.days === null || s.days > 60 ? 'warn' : '') + '">' +
    (s.days === null ? 'never' : s.days + 'd ago') + '</span></div>').join('');

  const gradeHealth = gradeRanks.filter(g => g.value >= 3).map(g => {
    const inGrade = all.filter(p => (p.grade || '').toString().trim() === g.label);
    return { label:'Grade ' + g.label, value: dashPct(inGrade.filter(p => p.connected).length, inGrade.length) };
  }).sort((a, b) => b.value - a.value);

  html += '<div class="dash-section-title">Connection Health</div><div class="dash-grid">';
  html += dashPanel('⏳ Longest Without A Connection', staleHtml || dashEmpty('Everyone is up to date'), {
    note: neverConnected ? neverConnected + ' student' + (neverConnected === 1 ? '' : 's') + ' have never been connected with.' : '' });
  html += dashPanel('🏅 Connection Rate By Grade', dashBars(gradeHealth, '%'), { badge:'grades of 3+' });
  html += '</div>';

  // ── hangouts ──
  if (act) {
    const topStudents = all.filter(p => +p.interactionCount > 0)
      .sort((a, b) => (+b.interactionCount) - (+a.interactionCount)).slice(0, 8)
      .map(p => ({ label:p.name, value:+p.interactionCount }));
    const dowRows = (act.byDayOfWeek || []).map((n, i) => ({ label:DASH_DOW_FULL[i], value:n }));
    // A per-week MM-DD tick truncates to "08-…" on a phone, where twelve of
    // them are identical and useless. Label the month only when it changes, so
    // the axis reads Jun · Jul · Aug at any width.
    let tickMonth = '';
    const weeks = (act.byWeek || []).map(w => {
      const mo = String(w.label).slice(0, 2);
      const tick = mo === tickMonth ? '' : (DASH_MONTHS_SHORT[(+mo || 1) - 1] || '');
      tickMonth = mo;
      return { tick:tick, value:w.count };
    });

    html += '<div class="dash-section-title">Hangouts <small>last ' + (act.windowDays || 90) + ' days</small></div>';
    html += dashPanel('📈 Last 12 Weeks', dashSpark(weeks), { full:true, badge:(act.last30 || 0) + ' in 30 days' });
    html += '<div class="dash-grid" style="margin-top:18px">';
    const leaderRows = (act.topLeaders || []).map(l => ({ label:l.name, value:l.count }));
    html += dashPanel('🏆 Most Active Leaders', dashRanks(leaderRows));
    html += dashPanel('📅 Day Of The Week', dashBars(dowRows));
    if (hasCounts) {
      html += dashPanel('❤️ Most Hung Out With', dashRanks(topStudents), { badge:'all time' });
      html += dashPanel('🎲 Hangout Coverage', dashDonut([
          { label:'Hung out with', value: total - noHangout, color:'#4ade80' },
          { label:'Not yet', value: noHangout, color:'#f87171' },
        ], dashPct(total - noHangout, total) + '%'));
    }
    html += '</div>';
  }

  // ── birthdays ──
  const bdays = all.map(p => ({ p:p, days: dashDaysToBirthday(p.birthday) }))
    .filter(b => b.days !== null && b.days <= 60)
    .sort((a, b) => a.days - b.days).slice(0, 10);
  const bdayHtml = bdays.map(b =>
    '<div class="dash-list-row"><span class="grow">' + dashEsc(b.p.name) + '</span>' +
    '<span class="dash-list-note">' + formatDate(b.p.birthday).replace(/,.*$/, '') + '</span>' +
    '<span class="dash-list-note ' + (b.days <= 7 ? 'soon' : '') + '">' +
    (b.days === 0 ? 'today 🎉' : b.days === 1 ? 'tomorrow' : 'in ' + b.days + 'd') + '</span></div>').join('');

  const monthCounts = [0,0,0,0,0,0,0,0,0,0,0,0];
  all.forEach(p => { const d = parseDateValue(p.birthday); if (d) monthCounts[d.getMonth()]++; });
  const monthRows = monthCounts.map((n, i) => ({ label:DASH_MONTHS_SHORT[i], value:n }));

  html += '<div class="dash-section-title">Birthdays</div><div class="dash-grid">';
  html += dashPanel('🎂 Coming Up', bdayHtml || dashEmpty('No birthdays in the next 60 days'), { badge:'next 60 days' });
  html += dashPanel('📆 Birthday Months', dashBars(monthRows));
  html += '</div>';

  // ── trivia ──
  const facts = [];
  if (schoolRanks.length) facts.push(dashFact('🏫', 'Biggest campus is <b>' + dashEsc(schoolRanks[0].label) + '</b> with <b>' + schoolRanks[0].value + '</b> student' + (schoolRanks[0].value === 1 ? '' : 's') + '.'));
  const topMonth = monthCounts.indexOf(Math.max.apply(null, monthCounts));
  if (monthCounts[topMonth] > 0) facts.push(dashFact('🎈', 'More birthdays land in <b>' + DASH_MONTHS[topMonth] + '</b> than any other month (<b>' + monthCounts[topMonth] + '</b>).'));

  // Same month and day, any year — the "wait, you too?" stat.
  const byMonthDay = {};
  all.forEach(p => {
    const d = parseDateValue(p.birthday);
    if (d) { const k = d.getMonth() + '-' + d.getDate(); (byMonthDay[k] = byMonthDay[k] || []).push(p.name); }
  });
  const twins = Object.keys(byMonthDay).filter(k => byMonthDay[k].length > 1);
  if (twins.length) facts.push(dashFact('👯', '<b>' + twins.length + '</b> birthday' + (twins.length === 1 ? '' : 's') + ' shared by two or more students — including <b>' + dashEsc(byMonthDay[twins[0]].join(' & ')) + '</b>.'));

  const initials = dashRanked(dashCountBy(all, p => (p.name || '').trim().charAt(0).toUpperCase()));
  if (initials.length && initials[0].value > 1) facts.push(dashFact('🔤', '<b>' + initials[0].value + '</b> students have names starting with <b>' + dashEsc(initials[0].label) + '</b> — the most of any letter.'));

  if (avgAge) facts.push(dashFact('🧮', 'Average age on the roster is <b>' + avgAge.toFixed(1) + '</b>.'));
  facts.push(dashFact('📸', '<b>' + dashPct(withPhoto, total) + '%</b> of students have a photo on file (' + withPhoto + ' of ' + total + ').'));
  facts.push(dashFact('📝', '<b>' + withNotes + '</b> student' + (withNotes === 1 ? ' has' : 's have') + ' notes written about them.'));
  if (hasCounts && noHangout) facts.push(dashFact('👋', '<b>' + noHangout + '</b> student' + (noHangout === 1 ? ' has' : 's have') + ' never had a hangout logged.'));
  if (withGoals) facts.push(dashFact('🎯', '<b>' + withGoals + '</b> student' + (withGoals === 1 ? '' : 's') + ' are working on goals — <b>' + goalsDone + '</b> of <b>' + goalsTotal + '</b> are done.'));
  if (gradeHealth.length) facts.push(dashFact('🥇', '<b>' + dashEsc(gradeHealth[0].label) + '</b> is the most connected grade at <b>' + gradeHealth[0].value + '%</b>.'));

  if (act) {
    if (act.busiestDay) facts.push(dashFact('🔥', 'Busiest day was <b>' + formatDate(act.busiestDay.date) + '</b> with <b>' + act.busiestDay.count + '</b> hangouts logged.'));
    const dow = act.byDayOfWeek || [];
    const maxDow = Math.max.apply(null, dow.concat([0]));
    if (maxDow > 0) facts.push(dashFact('📅', '<b>' + DASH_DOW_FULL[dow.indexOf(maxDow)] + '</b> is the most common day to hang out.'));
    if (act.daysLogged) facts.push(dashFact('🗓️', 'Something was logged on <b>' + act.daysLogged + '</b> different day' + (act.daysLogged === 1 ? '' : 's') + '.'));
    if (act.uniqueLeaders) facts.push(dashFact('🙌', '<b>' + act.uniqueLeaders + '</b> different leader' + (act.uniqueLeaders === 1 ? ' has' : 's have') + ' logged a hangout.'));
  }

  html += '<div class="dash-section-title">Fun Facts</div>' +
    dashPanel('✨ Things The Roster Knows', facts.join(''), { full:true });

  if (!act) html += '<div class="dash-note" style="text-align:center;margin-top:24px">Hangout stats are hidden — they need activity access.</div>';

  el.innerHTML = html;
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type='') {
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast'+(type?' '+type:'');
  void el.offsetHeight;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function v(id) { return (document.getElementById(id)||{}).value?.trim()||''; }
function sv(id,val) { const el=document.getElementById(id); if(el) el.value=val; }
function setMsg(el,msg,type) { el.textContent=msg; el.className='auth-msg '+(type||''); }

// ── PHOTO CROP / COMPRESS ─────────────────────────────────────
let cropImg=null, cropZoom=1, cropOffX=0, cropOffY=0, cropIsDragging=false, cropDragStartX=0, cropDragStartY=0;
let cropCallback=null, cropPhotoContext=null;

function triggerPhotoUpload(ctx, callback) {
  cropPhotoContext=ctx;
  cropCallback=callback;
  const input=document.getElementById('shared-photo-input');
  if(input){input.value='';input.click();}
}

function onSharedPhotoSelected(input) {
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      cropImg=img; cropZoom=1; cropOffX=0; cropOffY=0;
      openModal('crop-modal');
      drawCrop();
      initCropDrag();
      document.getElementById('crop-zoom').value=1;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function drawCrop() {
  const canvas=document.getElementById('crop-canvas');
  if(!canvas||!cropImg) return;
  const SIZE=300;
  canvas.width=SIZE; canvas.height=SIZE;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,SIZE,SIZE);
  const base=Math.min(cropImg.width,cropImg.height);
  const scale=(SIZE/base)*cropZoom;
  const w=cropImg.width*scale, h=cropImg.height*scale;
  ctx.drawImage(cropImg, (SIZE-w)/2+cropOffX, (SIZE-h)/2+cropOffY, w, h);
}

function initCropDrag() {
  const wrap=document.querySelector('.crop-canvas-wrap');
  if(!wrap||wrap._cropDragInit) return;
  wrap._cropDragInit=true;
  wrap.addEventListener('mousedown',e=>{cropIsDragging=true;cropDragStartX=e.clientX-cropOffX;cropDragStartY=e.clientY-cropOffY;});
  window.addEventListener('mousemove',e=>{if(!cropIsDragging)return;cropOffX=e.clientX-cropDragStartX;cropOffY=e.clientY-cropDragStartY;drawCrop();});
  window.addEventListener('mouseup',()=>{cropIsDragging=false;});
  wrap.addEventListener('touchstart',e=>{const t=e.touches[0];cropIsDragging=true;cropDragStartX=t.clientX-cropOffX;cropDragStartY=t.clientY-cropOffY;},{passive:true});
  wrap.addEventListener('touchmove',e=>{if(!cropIsDragging)return;const t=e.touches[0];cropOffX=t.clientX-cropDragStartX;cropOffY=t.clientY-cropDragStartY;drawCrop();},{passive:true});
  wrap.addEventListener('touchend',()=>{cropIsDragging=false;},{passive:true});
}

function onCropZoom(val) {
  cropZoom=+val; drawCrop();
}

function closeCropModal() {
  closeModal('crop-modal');
  cropCallback=null; cropPhotoContext=null; cropImg=null;
}

function saveCrop() {
  if(!cropImg) return;
  const src=document.getElementById('crop-canvas');
  const out=document.createElement('canvas');
  const SIZE=800; out.width=SIZE; out.height=SIZE;
  out.getContext('2d').drawImage(src,0,0,SIZE,SIZE);
  out.toBlob(blob=>{
    closeModal('crop-modal');
    if(cropCallback) cropCallback(blob);
  },'image/jpeg',0.85);
}

async function uploadCroppedBlob(blob, type) {
  showToast('Uploading…');
  const fd=new FormData(); fd.append('file',blob,'photo.jpg'); fd.append('type',type);
  const res=await fetch('/roster/api/upload-photo',{method:'POST',body:fd});
  return res.json();
}

// ── ORG SETTINGS (public branding) ────────────────────────────
async function loadOrgSettings() {
  try {
    const cached = localStorage.getItem('asm-org-settings');
    if (cached) { orgSettings = JSON.parse(cached); applyBranding(); }
    const res = await fetch('/roster/api/settings/public');
    const data = await res.json();
    orgSettings = data;
    localStorage.setItem('asm-org-settings', JSON.stringify(data));
    applyBranding();
  } catch(e) {}
}

function applyBranding() {
  if (!orgSettings) return;
  const name = orgSettings.ministryName || 'Anthem Students';
  const logo = orgSettings.logoUrl || '';
  document.documentElement.classList.remove('logo-needs-invert','logo-needs-dark');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (currentTheme === 'dark' && orgSettings.logoTone === 'dark') document.documentElement.classList.add('logo-needs-invert');
  if (currentTheme === 'light' && orgSettings.logoTone === 'light') document.documentElement.classList.add('logo-needs-dark');

  // Update gate screen
  const gateLogo = document.getElementById('gate-logo-area');
  const gateLogoEl = document.querySelector('.gate-logo');
  if (logo && gateLogoEl) {
    gateLogoEl.innerHTML = '<img class="gate-logo-img" src="'+logo+'" alt="'+name+'">';
  }
  const gateSub = document.querySelector('.gate-sub');
  if (gateSub && orgSettings.campus) {
    gateSub.textContent = name + ' · ' + orgSettings.campus;
  } else if (gateSub) {
    gateSub.textContent = 'Worship Grow Go · ' + name;
  }

  // Update nav logo
  document.querySelectorAll('.nav-logo').forEach(el => {
    // Skip settings nav
    if (el.closest('#screen-settings')) return;
    if (logo) {
      el.innerHTML = '<img class="nav-logo-img" src="'+logo+'" alt="'+name+'">';
    }
  });

  // Update subtitle in roster header
  const subtitle = document.querySelector('#nav-roster .subtitle');
  if (subtitle) {
    const yr = new Date().getFullYear();
    subtitle.textContent = name + ' · ASM ' + yr;
  }

  // Update gate access mode visibility
  const passcodeLane = document.getElementById('gate-lane-passcode');
  if (passcodeLane) {
    const mode = orgSettings.accessMode || 'leaders-only';
    passcodeLane.style.display = mode === 'shared-passcode' ? '' : 'none';
  }

  // Apply appearance settings
  if (orgSettings.appearance) {
    if (orgSettings.appearance.compactMode) document.body.classList.add('compact-mode');
    else document.body.classList.remove('compact-mode');
    const bnav = document.getElementById('bottom-nav');
    if (bnav && orgSettings.appearance.stickyBottomTabs === false) bnav.style.display = 'none';
  }
}

// ── SETTINGS PAGE (admin) ─────────────────────────────────────
async function openSettings() {
  if (!currentUser || currentUser.role !== 'admin') { showToast('Admin access required','error'); return; }
  showScreen('settings');
  showToast('Loading settings…');
  try {
    const res = await fetch('/roster/api/settings');
    const data = await res.json();
    settingsData = data.settings;
    settingsOriginal = JSON.parse(JSON.stringify(settingsData));
    populateSettingsUI();
    settingsDirty = false;
    updateSettingsSaveBtn();
    document.getElementById('settings-topbar-name').textContent = settingsData.ministryName || '';
  } catch(e) { showToast('Failed to load settings','error'); }
}

function closeSettings() {
  if (settingsDirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  showScreen('app');
}

function switchSettingsTab(tab, btn) {
  document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('settings-'+tab);
  if (pane) pane.classList.add('active');
  document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function markSettingsDirty() {
  settingsDirty = true;
  updateSettingsSaveBtn();
}

function updateSettingsSaveBtn() {
  const btns = [document.getElementById('settings-save-btn'), document.getElementById('settings-save-topbar')];
  btns.forEach(b => { if (b) b.disabled = !settingsDirty; });
}

function toggleSettingsSwitch(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on');
  markSettingsDirty();
  // Special: show/hide conditional sections
  if (id === 's-logo-toggle') {
    const area = document.getElementById('s-logo-upload-area');
    if (area) area.style.display = el.classList.contains('on') ? 'flex' : 'none';
  }
  if (id === 's-auto-archive') {
    const row = document.getElementById('s-archive-weeks-row');
    if (row) row.style.display = el.classList.contains('on') ? 'block' : 'none';
  }
}

function setSettingsSwitch(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on', on);
}

// ── Populate Settings UI from data ────────────────────────────
function populateSettingsUI() {
  const s = settingsData;
  if (!s) return;

  // General
  sv('s-ministry-name', s.ministryName || '');
  sv('s-campus', s.campus || '');
  setSettingsSwitch('s-logo-toggle', s.logoEnabled || false);
  const logoArea = document.getElementById('s-logo-upload-area');
  if (logoArea) logoArea.style.display = s.logoEnabled ? 'flex' : 'none';
  const logoImg = document.getElementById('s-logo-img');
  if (logoImg && s.logoUrl) { logoImg.src = s.logoUrl; logoImg.style.display = ''; }
  else if (logoImg) { logoImg.style.display = 'none'; }

  // Grades
  renderGradeChips(s);
  sv('s-hs-label', s.gradeTabs?.hs?.label || 'High School');
  sv('s-ms-label', s.gradeTabs?.ms?.label || 'Middle School');
  renderGradeTabChips(s);

  // Default week
  sv('s-meeting-day', s.meetingDay || 'sunday');
  sv('s-week-start', s.weekStartsOn || 'sunday');

  // Tracking
  const tr = s.tracking || {};
  setSettingsSwitch('s-track-hangoutNotes', tr.hangoutNotes !== false);
  setSettingsSwitch('s-track-tags', tr.tags || false);
  setSettingsSwitch('s-track-birthdays', tr.birthdays !== false);
  setSettingsSwitch('s-track-showGrade', tr.showGrade !== false);
  setSettingsSwitch('s-track-school', tr.school !== false);
  setSettingsSwitch('s-track-age', tr.age !== false);

  // Defaults
  sv('s-default-status', s.defaults?.newStudentStatus || 'new');
  setSettingsSwitch('s-auto-archive', s.defaults?.autoArchive || false);
  sv('s-archive-weeks', s.defaults?.autoArchiveWeeks || 8);
  const archRow = document.getElementById('s-archive-weeks-row');
  if (archRow) archRow.style.display = s.defaults?.autoArchive ? 'block' : 'none';

  // Access
  const acc = s.access || {};
  const radios = document.querySelectorAll('input[name="access-mode"]');
  radios.forEach(r => { r.checked = r.value === (acc.mode || 'leaders-only'); });
  onAccessModeChange();
  sv('s-passcode', acc.passcode || '');
  const perms = acc.passcodePermissions || {};
  ['viewRoster','viewAttendance','viewNotes','viewPrayer'].forEach(k => {
    const cb = document.getElementById('s-perm-'+k);
    if (cb) cb.checked = perms[k] || false;
  });

  // Appearance
  const currentTheme = localStorage.getItem('asm-theme') || 'auto';
  selectSettingsTheme(currentTheme, true);
  setSettingsSwitch('s-compact-mode', s.appearance?.compactMode || false);
  setSettingsSwitch('s-sticky-tabs', s.appearance?.stickyBottomTabs !== false);
}

// ── Grade Chips ───────────────────────────────────────────────
function renderGradeChips(s) {
  const container = document.getElementById('s-grades-chips');
  if (!container) return;
  const allGrades = [6,7,8,9,10,11,12];
  const hsGrades = s.gradeTabs?.hs?.grades || [9,10,11,12];
  const msGrades = s.gradeTabs?.ms?.grades || [6,7,8];
  const selected = [...new Set([...hsGrades, ...msGrades])];
  container.innerHTML = allGrades.map(g =>
    '<div class="s-chip'+(selected.includes(g)?' selected':'')+'" data-grade="'+g+'" onclick="toggleGradeChip(this)">Grade '+g+'</div>'
  ).join('');
}

function toggleGradeChip(el) {
  el.classList.toggle('selected');
  markSettingsDirty();
  syncGradeTabChips();
}

function renderGradeTabChips(s) {
  const hsGrades = s.gradeTabs?.hs?.grades || [9,10,11,12];
  const msGrades = s.gradeTabs?.ms?.grades || [6,7,8];
  renderGradeTabGroup('s-hs-grades', hsGrades);
  renderGradeTabGroup('s-ms-grades', msGrades);
}

function renderGradeTabGroup(containerId, grades) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = grades.map(g =>
    '<div class="s-chip selected" data-grade="'+g+'" onclick="moveGradeChip(this)">'+g+'</div>'
  ).join('');
}

function moveGradeChip(el) {
  const grade = +el.dataset.grade;
  const parent = el.parentElement;
  const isHs = parent.id === 's-hs-grades';
  const target = document.getElementById(isHs ? 's-ms-grades' : 's-hs-grades');
  if (target) {
    el.remove();
    target.appendChild(el);
    markSettingsDirty();
  }
}

function syncGradeTabChips() {
  const selected = [...document.querySelectorAll('#s-grades-chips .s-chip.selected')].map(c => +c.dataset.grade);
  const hsEl = document.getElementById('s-hs-grades');
  const msEl = document.getElementById('s-ms-grades');
  if (!hsEl || !msEl) return;
  // Keep existing assignment where possible
  const currentHs = [...hsEl.querySelectorAll('.s-chip')].map(c => +c.dataset.grade).filter(g => selected.includes(g));
  const currentMs = [...msEl.querySelectorAll('.s-chip')].map(c => +c.dataset.grade).filter(g => selected.includes(g));
  const assigned = new Set([...currentHs, ...currentMs]);
  selected.forEach(g => {
    if (!assigned.has(g)) {
      if (g >= 9) currentHs.push(g); else currentMs.push(g);
    }
  });
  renderGradeTabGroup('s-hs-grades', currentHs.sort((a,b)=>a-b));
  renderGradeTabGroup('s-ms-grades', currentMs.sort((a,b)=>a-b));
}

// ── Access Mode ───────────────────────────────────────────────
function onAccessModeChange() {
  const mode = document.querySelector('input[name="access-mode"]:checked')?.value || 'leaders-only';
  const passConfig = document.getElementById('s-passcode-config');
  const leadersInfo = document.getElementById('s-leaders-only-info');
  if (passConfig) passConfig.style.display = mode === 'shared-passcode' ? 'block' : 'none';
  if (leadersInfo) leadersInfo.style.display = mode === 'leaders-only' ? 'block' : 'none';
}

function togglePasscodeVisibility() {
  const inp = document.getElementById('s-passcode');
  const btn = inp?.parentElement?.querySelector('.s-show-pass');
  if (!inp || !btn) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
  else { inp.type = 'password'; btn.textContent = 'Show'; }
}

// ── Theme Selector (settings) ─────────────────────────────────
function selectSettingsTheme(theme, skipDirty) {
  document.querySelectorAll('.s-theme-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
  applyTheme(theme);
  if (!skipDirty) markSettingsDirty();
}

// ── Logo Upload ───────────────────────────────────────────────
async function uploadSettingsLogo(input) {
  if (!input.files.length) return;
  const file = input.files[0]; input.value = '';
  showToast('Uploading logo…');
  const fd = new FormData(); fd.append('file', file, 'logo.jpg'); fd.append('type', 'logo');
  try {
    const res = await fetch('/roster/api/upload-photo', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) {
      const img = document.getElementById('s-logo-img');
      if (settingsData) settingsData.logoTone = data.logoTone || settingsData.logoTone || 'light';
      if (img) { img.src = data.url; img.style.display = 'block'; img.previousElementSibling.style.display = 'none'; }
      if (settingsData) settingsData.logoUrl = data.url;
      markSettingsDirty();
      showToast('✓ Logo uploaded', 'ok');
    } else showToast(data.error || 'Upload failed', 'error');
  } catch(e) { showToast('Upload error', 'error'); }
}

function removeSettingsLogo() {
  const img = document.getElementById('s-logo-img');
  if (img) { img.src = ''; img.style.display = 'none'; img.previousElementSibling.style.display = ''; }
  if (settingsData) settingsData.logoUrl = '';
  markSettingsDirty();
}

// ── Save / Cancel ─────────────────────────────────────────────
async function saveSettings() {
  if (!settingsData) return;
  const btn = document.getElementById('settings-save-btn');
  const topBtn = document.getElementById('settings-save-topbar');
  [btn, topBtn].forEach(b => { if (b) { b.disabled = true; b.textContent = 'Saving…'; } });

  // Gather values from UI
  const s = {
    ministryName: v('s-ministry-name') || 'Anthem Students',
    campus: v('s-campus'),
    logoEnabled: document.getElementById('s-logo-toggle')?.classList.contains('on') || false,
    logoUrl: settingsData.logoUrl || '',
    logoTone: settingsData.logoTone || 'light',
    gradeTabs: {
      hs: {
        label: v('s-hs-label') || 'High School',
        grades: [...document.querySelectorAll('#s-hs-grades .s-chip')].map(c => +c.dataset.grade),
      },
      ms: {
        label: v('s-ms-label') || 'Middle School',
        grades: [...document.querySelectorAll('#s-ms-grades .s-chip')].map(c => +c.dataset.grade),
      },
    },
    meetingDay: v('s-meeting-day'),
    weekStartsOn: v('s-week-start'),
    tracking: {
      hangoutNotes: document.getElementById('s-track-hangoutNotes')?.classList.contains('on') || false,
      tags: document.getElementById('s-track-tags')?.classList.contains('on') || false,
      birthdays: document.getElementById('s-track-birthdays')?.classList.contains('on') || false,
      showGrade: document.getElementById('s-track-showGrade')?.classList.contains('on') || false,
      school: document.getElementById('s-track-school')?.classList.contains('on') || false,
      age: document.getElementById('s-track-age')?.classList.contains('on') || false,
    },
    defaults: {
      newStudentStatus: v('s-default-status') || 'new',
      autoArchive: document.getElementById('s-auto-archive')?.classList.contains('on') || false,
      autoArchiveWeeks: parseInt(v('s-archive-weeks')) || 8,
    },
    access: {
      mode: document.querySelector('input[name="access-mode"]:checked')?.value || 'leaders-only',
      passcode: v('s-passcode'),
      passcodePermissions: {
        viewRoster: document.getElementById('s-perm-viewRoster')?.checked || false,
        viewAttendance: document.getElementById('s-perm-viewAttendance')?.checked || false,
        viewNotes: document.getElementById('s-perm-viewNotes')?.checked || false,
        viewPrayer: document.getElementById('s-perm-viewPrayer')?.checked || false,
      },
    },
    appearance: {
      theme: localStorage.getItem('asm-theme') || 'auto',
      compactMode: document.getElementById('s-compact-mode')?.classList.contains('on') || false,
      stickyBottomTabs: document.getElementById('s-sticky-tabs')?.classList.contains('on') || false,
    },
  };

  try {
    const res = await fetch('/roster/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    const data = await res.json();
    if (data.success) {
      settingsData = data.settings || s;
      settingsOriginal = JSON.parse(JSON.stringify(settingsData));
      settingsDirty = false;
      updateSettingsSaveBtn();
      // Refresh public settings cache
      orgSettings = {
        ministryName: s.ministryName, campus: s.campus,
        logoUrl: s.logoEnabled ? s.logoUrl : '',
        logoEnabled: s.logoEnabled, gradeTabs: s.gradeTabs,
        tracking: s.tracking, appearance: s.appearance,
      };
      localStorage.setItem('asm-org-settings', JSON.stringify(orgSettings));
      applyBranding();
      document.getElementById('settings-topbar-name').textContent = s.ministryName;
      showToast('✓ Settings saved', 'ok');
    } else showToast(data.error || 'Save failed', 'error');
  } catch(e) { showToast('Network error', 'error'); }
  [btn, topBtn].forEach(b => { if (b) { b.disabled = false; b.textContent = b.id === 'settings-save-topbar' ? 'Save' : 'Save Changes'; } });
}

function cancelSettings() {
  if (!settingsOriginal) { closeSettings(); return; }
  settingsData = JSON.parse(JSON.stringify(settingsOriginal));
  populateSettingsUI();
  settingsDirty = false;
  updateSettingsSaveBtn();
  showToast('Changes reverted');
}

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  initTheme();

  // Auto-year
  const yr = new Date().getFullYear();
  ['year-gate','year-sub','year-footer','year-auth'].forEach(id => {
    const el=document.getElementById(id); if(el) el.textContent=yr;
  });
  ['year-nav','year-student-nav'].forEach(id => {
    const el=document.getElementById(id); if(el) el.textContent='\u00a0'+yr;
  });

  // Load org settings for branding (before gate)
  loadOrgSettings();

  // Swipe back
  initSwipeBack();

  // Wire up modal close-on-backdrop for ALL modals
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if(e.target===el) closeModal(el.id); });
  });
  // Wire up ef-name input preview
  const efName=document.getElementById('ef-name');
  if(efName) efName.addEventListener('input',updateEditPhotoPreview);
  // Enter key to add goals
  const goalInput=document.getElementById('new-goal-input');
  if(goalInput) goalInput.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addGoal();} });
  // Escape key to close topmost modal
  document.addEventListener('keydown', e => {
    if(e.key==='Escape'){
      const open=document.querySelector('.modal-overlay.open');
      if(open) closeModal(open.id);
    }
  });

  // A password-reset email lands here as /roster?resetToken=… . Take the token
  // into memory and strip it from the address bar before anything else runs, so
  // it can't leak through browser history, a bookmark, or a Referer header.
  const params = new URLSearchParams(location.search);
  const token = params.get('resetToken');
  if (token) {
    params.delete('resetToken');
    const query = params.toString();
    history.replaceState({}, '', location.pathname + (query ? '?' + query : ''));
    showResetForm(token);
    return;
  }

  initGate();
});
`;
