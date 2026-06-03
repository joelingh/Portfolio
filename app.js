/* ============================================================
   Million Tracker — invest, grow, and reach your goal.
   Pure vanilla JS. All data saved in localStorage on device.
   ============================================================ */

const STORE_KEY = 'millionTracker.v1';

const PERIODS = {
  week:    { label: 'week',    plural: 'weeks',    perYear: 52,  days: 7 },
  month:   { label: 'month',   plural: 'months',   perYear: 12,  days: 30.4375 },
  quarter: { label: 'quarter', plural: 'quarters', perYear: 4,   days: 91.3125 },
  year:    { label: 'year',    plural: 'years',    perYear: 1,   days: 365.25 },
};

// Default plan + empty log
const defaultState = () => ({
  plan: { start: 10000, rate: 2, period: 'month', contrib: 0, goal: 1000000 },
  logs: [], // { id, date:'YYYY-MM-DD', amount, note }
});

let state = load();

/* ---------- Persistence ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return defaultState();
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Formatting ---------- */
const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmt$compact = (n) => {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 2).replace(/\.00$/, '') + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};

/* ---------- Core projection ----------
   balanceNext = balance * (1 + r) + contribution
   Returns array of {n, balance, growth} from period 0 (start) to goal. */
function project(plan) {
  const r = plan.rate / 100;
  const cap = 2000; // safety cap on periods
  const rows = [{ n: 0, balance: plan.start, growth: 0 }];
  let bal = plan.start;
  let n = 0;

  if (plan.start >= plan.goal) return rows; // already there

  // If it can never grow, bail early
  const canGrow = r > 0 || plan.contrib > 0;
  while (bal < plan.goal && n < cap && canGrow) {
    const growth = bal * r;
    bal = bal + growth + plan.contrib;
    n++;
    rows.push({ n, balance: bal, growth: growth + plan.contrib });
  }
  return rows;
}

/* Convert a number of periods into a human "Xy Zm" style string */
function humanTime(periods, periodKey) {
  const p = PERIODS[periodKey];
  const totalYears = periods / p.perYear;
  const years = Math.floor(totalYears);
  const remPeriods = Math.round(periods - years * p.perYear);
  const out = [];
  if (years > 0) out.push(years + 'y');
  if (remPeriods > 0) out.push(remPeriods + (p.label === 'year' ? 'y' : p.label[0]));
  return out.length ? out.join(' ') : '0' + p.label[0];
}

function addPeriods(date, periods, periodKey) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Math.round(periods * PERIODS[periodKey].days));
  return d;
}

/* ---------- Current balance: latest log, else plan start ---------- */
function currentBalance() {
  if (state.logs.length) {
    const sorted = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1].amount;
  }
  return state.plan.start;
}

/* What the plan says the balance should be by today, given the start date
   (first log date, or today if no logs). */
function expectedToday() {
  const plan = state.plan;
  if (!state.logs.length) return plan.start;
  const sorted = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = new Date(sorted[0].date);
  const today = new Date();
  const daysElapsed = (today - startDate) / 86400000;
  const periodsElapsed = daysElapsed / PERIODS[plan.period].days;
  const r = plan.rate / 100;
  // grow plan.start by periodsElapsed (fractional, with contributions)
  let bal = plan.start;
  const whole = Math.floor(periodsElapsed);
  for (let i = 0; i < whole && i < 2000; i++) bal = bal * (1 + r) + plan.contrib;
  const frac = periodsElapsed - whole;
  bal = bal * (1 + r * frac) + plan.contrib * frac;
  return bal;
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  const plan = state.plan;
  const rows = project(plan);
  const reached = rows.length && rows[rows.length - 1].balance >= plan.goal;
  const periods = reached ? rows[rows.length - 1].n : null;

  /* ----- Hero ----- */
  const bal = currentBalance();
  document.getElementById('heroBalance').textContent = fmt$(bal);

  const pct = Math.min(100, (bal / plan.goal) * 100);
  document.getElementById('progressFill').style.width = Math.max(1, pct) + '%';
  document.getElementById('progressPct').textContent = pct.toFixed(pct < 10 ? 1 : 0) + '% of goal';
  document.getElementById('goalLabel').textContent = 'Goal ' + fmt$compact(plan.goal);

  document.getElementById('statEtaValue').textContent = periods != null ? humanTime(periods, plan.period) : '∞';
  const gains = bal - plan.start;
  document.getElementById('statGainValue').textContent = (gains >= 0 ? '' : '-') + fmt$compact(Math.abs(gains));

  // vs plan
  const vsEl = document.getElementById('statVsPlan');
  if (state.logs.length) {
    const exp = expectedToday();
    const diff = bal - exp;
    const diffPct = exp ? (diff / exp) * 100 : 0;
    if (Math.abs(diffPct) < 0.5) { vsEl.textContent = 'On plan'; vsEl.style.color = '#fff'; }
    else if (diff > 0) { vsEl.textContent = '+' + fmt$compact(Math.abs(diff)); vsEl.style.color = '#bfffe6'; }
    else { vsEl.textContent = '-' + fmt$compact(Math.abs(diff)); vsEl.style.color = '#ffd2d6'; }
  } else {
    vsEl.textContent = '—'; vsEl.style.color = '#fff';
  }

  /* ----- Projection card ----- */
  document.getElementById('resPeriods').textContent = periods != null ? periods : '∞';
  document.getElementById('resTime').textContent = periods != null ? humanTime(periods, plan.period) : 'never';
  document.getElementById('resDate').textContent = periods != null
    ? addPeriods(new Date(), periods, plan.period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const totalContrib = periods != null ? plan.contrib * periods : 0;
  document.getElementById('resContrib').textContent = fmt$compact(totalContrib);

  const noteEl = document.getElementById('resNote');
  if (periods == null) {
    noteEl.textContent = 'With 0% growth and no recurring deposits, this goal can’t be reached. Add a growth rate or a recurring deposit.';
  } else {
    const pdef = PERIODS[plan.period];
    const finalBal = rows[rows.length - 1].balance;
    const investedTotal = plan.start + totalContrib;
    const fromGrowth = finalBal - investedTotal;
    noteEl.innerHTML =
      `Starting at <b>${fmt$compact(plan.start)}</b> growing <b>${plan.rate}%</b> per ${pdef.label}` +
      (plan.contrib > 0 ? ` plus <b>${fmt$compact(plan.contrib)}</b> added each ${pdef.label}` : '') +
      `, you reach <b>${fmt$compact(plan.goal)}</b> in <b>${humanTime(periods, plan.period)}</b>. ` +
      `Of that, <b>${fmt$compact(fromGrowth)}</b> comes from growth.`;
  }

  drawChart(rows);
  renderSchedule(rows, reached);
  renderLogs();
  save();
}

/* ============================================================
   CHART — plan line + actual log points
   ============================================================ */
function drawChart(rows) {
  const canvas = document.getElementById('chart');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = 200;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const W = cssW - pad.l - pad.r;
  const H = cssH - pad.t - pad.b;

  const maxBal = Math.max(state.plan.goal, ...rows.map(r => r.balance), currentBalance());
  const maxN = Math.max(1, rows[rows.length - 1].n);

  const x = (n) => pad.l + (n / maxN) * W;
  const y = (b) => pad.t + H - (b / maxBal) * H;

  // goal line
  ctx.strokeStyle = 'rgba(255,206,79,.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.l, y(state.plan.goal));
  ctx.lineTo(pad.l + W, y(state.plan.goal));
  ctx.stroke();
  ctx.setLineDash([]);

  // plan area fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + H);
  grad.addColorStop(0, 'rgba(79,124,255,.35)');
  grad.addColorStop(1, 'rgba(79,124,255,0)');
  ctx.beginPath();
  ctx.moveTo(x(0), y(rows[0].balance));
  rows.forEach(r => ctx.lineTo(x(r.n), y(r.balance)));
  ctx.lineTo(x(rows[rows.length - 1].n), pad.t + H);
  ctx.lineTo(x(0), pad.t + H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // plan line
  ctx.beginPath();
  ctx.moveTo(x(0), y(rows[0].balance));
  rows.forEach(r => ctx.lineTo(x(r.n), y(r.balance)));
  ctx.strokeStyle = '#4f7cff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // actual points — map log dates onto period axis
  if (state.logs.length) {
    const sorted = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = new Date(sorted[0].date);
    ctx.beginPath();
    sorted.forEach((log, i) => {
      const days = (new Date(log.date) - startDate) / 86400000;
      const n = days / PERIODS[state.plan.period].days;
      const px = x(Math.min(n, maxN));
      const py = y(Math.min(log.amount, maxBal));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#2ecc8f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    sorted.forEach(log => {
      const days = (new Date(log.date) - startDate) / 86400000;
      const n = days / PERIODS[state.plan.period].days;
      ctx.beginPath();
      ctx.arc(x(Math.min(n, maxN)), y(Math.min(log.amount, maxBal)), 3.5, 0, 7);
      ctx.fillStyle = '#2ecc8f';
      ctx.fill();
    });
  }
}

/* ============================================================
   SCHEDULE table — sampled milestones
   ============================================================ */
function renderSchedule(rows, reached) {
  const body = document.getElementById('schedBody');
  body.innerHTML = '';
  const today = new Date();
  const total = rows.length - 1;

  // pick ~14 evenly spaced rows + always the final goal row
  const maxRows = 14;
  const step = Math.max(1, Math.ceil(total / maxRows));
  const indices = [];
  for (let i = 0; i <= total; i += step) indices.push(i);
  if (indices[indices.length - 1] !== total) indices.push(total);

  indices.forEach(i => {
    const r = rows[i];
    const tr = document.createElement('tr');
    if (reached && i === total) tr.className = 'goal-row';
    const date = addPeriods(today, r.n, state.plan.period)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    tr.innerHTML =
      `<td>${r.n}</td><td>${r.n === 0 ? 'now' : date}</td>` +
      `<td>${fmt$compact(r.balance)}</td>` +
      `<td>${r.growth ? '+' + fmt$compact(r.growth) : '—'}</td>`;
    body.appendChild(tr);
  });
}

/* ============================================================
   LOG list
   ============================================================ */
function renderLogs() {
  const list = document.getElementById('logList');
  const empty = document.getElementById('logEmpty');
  list.innerHTML = '';
  if (!state.logs.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const sorted = [...state.logs].sort((a, b) => b.date.localeCompare(a.date)); // newest first
  // build chronological for diffing
  const chrono = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));

  sorted.forEach(log => {
    const idx = chrono.findIndex(l => l.id === log.id);
    const prev = idx > 0 ? chrono[idx - 1] : null;
    const diff = prev ? log.amount - prev.amount : 0;

    const li = document.createElement('li');
    li.className = 'log-item';
    const dateStr = new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const tag = prev
      ? `<span class="log-tag ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${fmt$compact(Math.abs(diff))}</span>`
      : '';
    li.innerHTML =
      `<div class="log-left">
         <div class="log-amt">${fmt$(log.amount)}</div>
         <div class="log-sub">${dateStr}${log.note ? ' · ' + escapeHtml(log.note) : ''}</div>
       </div>
       <div class="log-right">${tag}
         <button class="del-btn" data-id="${log.id}" aria-label="Delete">✕</button>
       </div>`;
    list.appendChild(li);
  });

  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.logs = state.logs.filter(l => l.id !== btn.dataset.id);
      render();
    });
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============================================================
   WIRING
   ============================================================ */
// Plan inputs
const planMap = {
  inStart: ['start', 'num'], inRate: ['rate', 'num'], inContrib: ['contrib', 'num'],
  inGoal: ['goal', 'num'], inPeriod: ['period', 'str'],
};
function syncPlanInputs() {
  document.getElementById('inStart').value = state.plan.start;
  document.getElementById('inRate').value = state.plan.rate;
  document.getElementById('inContrib').value = state.plan.contrib;
  document.getElementById('inGoal').value = state.plan.goal;
  document.getElementById('inPeriod').value = state.plan.period;
}
Object.entries(planMap).forEach(([id, [key, type]]) => {
  document.getElementById(id).addEventListener('input', (e) => {
    state.plan[key] = type === 'num' ? (parseFloat(e.target.value) || 0) : e.target.value;
    render();
  });
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'plan') render(); // redraw chart at correct size
  });
});

// Add log entry
document.getElementById('logDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('addLogBtn').addEventListener('click', () => {
  const date = document.getElementById('logDate').value;
  const amount = parseFloat(document.getElementById('logAmount').value);
  const note = document.getElementById('logNote').value.trim();
  if (!date || !(amount >= 0) || isNaN(amount)) {
    alert('Please enter a date and a valid balance.');
    return;
  }
  state.logs.push({ id: Date.now().toString(36), date, amount, note });
  document.getElementById('logAmount').value = '';
  document.getElementById('logNote').value = '';
  render();
  // jump to track tab feedback already visible
});

// Reset
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Reset your plan and delete all logged entries?')) {
    state = defaultState();
    syncPlanInputs();
    render();
  }
});

// Redraw chart on resize/orientation change
window.addEventListener('resize', () => {
  if (document.getElementById('tab-plan').classList.contains('active')) drawChart(project(state.plan));
});

/* ---------- Boot ---------- */
syncPlanInputs();
render();
