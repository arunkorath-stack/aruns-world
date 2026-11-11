/* Shared helpers: formatting, icons, toast, SVG charts. */
(function () {
  const ROLES = ['Retailer', 'Wholesaler', 'Distributor', 'Factory'];
  const ROLE_COLORS = ['#0a6aa6', '#0b8064', '#c2510a', '#74469b'];
  const CUSTOMER_COLOR = '#1b2232';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('en-US');
  const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : nf.format(Math.round(n)));
  const money = (n) => {
    if (n == null) return '–';
    const neg = n < 0;
    const v = Math.abs(n);
    const s = v >= 1000 ? nf.format(Math.round(v)) : v.toFixed(2).replace(/\.00$/, '');
    return (neg ? '−$' : '$') + s;
  };
  const signed = (n) => (n < 0 ? '−' + fmt(-n) : fmt(n));

  // authored icons, 24px grid, 1.75 stroke
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    logo: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#f5f2ea"/><path d="M5 20c3 0 3-8 6-8s3 12 6 12 3-16 6-16 3 8 4 8" fill="none" stroke="#1b2232" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    store: P('<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>'),
    warehouse: P('<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><path d="M7 16h10"/>'),
    truck: P('<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    factory: P('<path d="M3 20V10l5 3V10l5 3V6h3l1-3h2l1 3v14z"/><path d="M7 16h2M12 16h2"/>'),
    clock: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    users: P('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 6M18 13.8c1.8.6 3 2.3 3 5.2"/>'),
    check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    pause: P('<path d="M9 5v14M15 5v14"/>'),
    play: P('<path d="M8 5l11 7-11 7z"/>'),
    stop: P('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
    restart: P('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>'),
    skip: P('<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    arrowRight: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    shuffle: P('<path d="M4 7h3c5 0 5 10 10 10h3"/><path d="M4 17h3c2 0 3-1.5 4-3.5M13 9.5c1-2 2-2.5 4-2.5h3"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>'),
    edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
    screen: P('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
    logout: P('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
    info: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  };
  const ROLE_ICONS = ['store', 'warehouse', 'truck', 'factory'];

  let toastTimer;
  function toast(msg, kind) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle('error', kind === 'error');
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function connBanner(socket) {
    const el = document.createElement('div');
    el.className = 'conn hidden';
    el.textContent = 'Connection lost. Trying to reconnect…';
    document.body.appendChild(el);
    socket.on('disconnect', () => el.classList.remove('hidden'));
    socket.on('connect', () => el.classList.add('hidden'));
  }

  function niceStep(range, ticks) {
    const raw = range / Math.max(1, ticks);
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }
  function shortNum(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(0) + 'k';
    return nf.format(v);
  }

  /**
   * lineChart(container, { series:[{name,color,values,dash,width}], labels:[...], height, yFormat, step })
   * values may contain null. x = index.
   */
  function lineChart(el, opts) {
    el._chartOpts = opts;
    const W = Math.max(300, Math.min(1200, Math.round(el.clientWidth || 640))), H = opts.height || 240, L = 44, R = 12, T = 12, B = 26;
    const series = opts.series.filter((s) => s.values && s.values.length);
    const n = Math.max(1, ...series.map((s) => s.values.length), (opts.labels || []).length);
    const labels = opts.labels || Array.from({ length: n }, (_, i) => i + 1);
    const all = series.flatMap((s) => s.values.filter((v) => v != null && Number.isFinite(v)));
    let lo = Math.min(0, ...all), hi = Math.max(1, ...all);
    if (opts.min != null) lo = Math.min(lo, opts.min);
    const step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    if (hi === lo) hi = lo + step;
    const x = (i) => L + (n <= 1 ? 0 : (i * (W - L - R)) / (n - 1));
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const yf = opts.yFormat || shortNum;
    let g = '<g class="grid">';
    for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    g += '</g><g class="axis">';
    for (let v = lo; v <= hi + 1e-9; v += step) g += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(yf(v))}</text>`;
    const every = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += every) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>`;
    g += '</g>';
    if (lo < 0) g += `<line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    let paths = '';
    for (const s of series) {
      let d = '', pen = false;
      s.values.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) { pen = false; return; }
        if (opts.step) {
          d += pen ? `H${x(i).toFixed(1)}V${y(v).toFixed(1)}` : `M${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        } else d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
        pen = true;
      });
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.25}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
      if (s.values.filter((v) => v != null).length === 1) {
        const i = s.values.findIndex((v) => v != null);
        paths += `<circle cx="${x(i)}" cy="${y(s.values[i])}" r="3.5" fill="${s.color}"/>`;
      }
    }
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || 'Chart')}">${g}${paths}<line class="cursor" y1="${T}" y2="${H - B}" x1="-10" x2="-10"/></svg>` +
      (opts.legend === false ? '' : `<div class="legend">${series.map((s) => `<span><i class="${s.dash ? 'dash' : ''}" style="background:${s.color};color:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`);
    const svg = el.querySelector('svg');
    const cursor = svg.querySelector('.cursor');
    let tip = null;
    function move(ev) {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
      cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i)); cursor.classList.add('on');
      if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; el.appendChild(tip); }
      const rows = series.filter((s) => s.values[i] != null).map((s) => `<div><span class="sw" style="background:${s.color}"></span>${esc(s.name)}: <b>${esc((opts.tipFormat || fmt)(s.values[i]))}</b></div>`).join('');
      tip.innerHTML = `<div><b>${esc(opts.xName || 'Week')} ${esc(labels[i])}</b></div>${rows}`;
      const left = (x(i) / W) * r.width;
      tip.style.left = Math.min(Math.max(left, 80), r.width - 80) + 'px';
      tip.style.top = (T / H) * r.height + 'px';
    }
    function leave() { cursor.classList.remove('on'); if (tip) { tip.remove(); tip = null; } }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', leave);
  }

  /** barChart(el, { bars:[{label, parts:[{value,color,name}]}], height }) stacked horizontal bars */
  function barChart(el, opts) {
    const bars = opts.bars;
    const max = Math.max(1, ...bars.map((b) => b.parts.reduce((s, p) => s + Math.max(0, p.value), 0)));
    const names = [];
    bars.forEach((b) => b.parts.forEach((p) => { if (!names.find((n) => n.name === p.name)) names.push({ name: p.name, color: p.color }); }));
    el.innerHTML = `<div class="bars">${bars.map((b) => {
      const total = b.parts.reduce((s, p) => s + p.value, 0);
      return `<div class="bar-row"><div class="bar-label">${esc(b.label)}</div><div class="bar-track">${b.parts.map((p) => `<span title="${esc(p.name)}: ${esc((opts.format || money)(p.value))}" style="width:${(Math.max(0, p.value) / max) * 100}%;background:${p.color}"></span>`).join('')}</div><div class="bar-val num">${esc((opts.format || money)(total))}</div></div>`;
    }).join('')}</div>` + (bars.some((b) => b.parts.length > 1) ? `<div class="legend">${names.map((n) => `<span><i style="background:${n.color}"></i>${esc(n.name)}</span>`).join('')}</div>` : '');
  }

  // redraw charts at their real width when the window size changes
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => document.querySelectorAll('.chart').forEach((el) => { if (el._chartOpts && el.isConnected) lineChart(el, el._chartOpts); }), 150);
  });

  function ratio(v) {
    if (v == null) return '–';
    return (v >= 100 ? nf.format(Math.round(v)) : v.toFixed(1)) + '×';
  }

  function remaining(deadline, offset) {
    if (!deadline) return null;
    return Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000));
  }
  function mmss(s) {
    if (s == null) return '';
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  window.BW = { ratio, ROLES, ROLE_COLORS, CUSTOMER_COLOR, ROLE_ICONS, ICONS, esc, fmt, money, signed, toast, connBanner, lineChart, barChart, remaining, mmss, shortNum };
})();
