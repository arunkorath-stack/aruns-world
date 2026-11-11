(function () {
  const { ROLES, ROLE_COLORS, CUSTOMER_COLOR, ROLE_ICONS, ICONS, esc, fmt, money, signed, toast, lineChart, remaining, mmss } = BW;
  const app = document.getElementById('app');
  document.getElementById('brand').innerHTML = ICONS.logo + '<span>Bullwhip Lab</span>';

  let token = null; try { token = localStorage.getItem('bwl-token'); } catch (e) { /* storage blocked */ } if (!token && window.BWSolo) token = 'solo';
  if (!token) { location.href = '/'; return; }

  const socket = io({ transports: ['websocket', 'polling'] });
  BW.connBanner(socket);
  let view = null;
  let offset = 0;
  let draft = { week: null, order: '', forecast: '' };
  let lastWeek = null;
  let showRules = false;
  let sending = false;

  socket.on('connect', () => {
    socket.emit('student:resume', { token }, (r) => {
      if (!r || !r.ok) {
        localStorage.removeItem('bwl-token');
        app.innerHTML = `<div class="panel center-msg"><h1>Please join again</h1><p class="muted">We could not find your place in the game.</p><div class="row"><a class="btn primary" href="/">Join a class</a></div></div>`;
      }
    });
  });
  socket.on('student:state', (v) => {
    offset = v.serverNow - Date.now();
    const g = v.game;
    if (g && lastWeek != null && g.week !== lastWeek && !g.finished) toast(`Week ${g.week} has started. Check your new numbers.`);
    if (g && g.finished && lastWeek != null && view && view.game && !view.game.finished) toast('The game is over. See your results.');
    const sameWeek = g && view && view.game && view.game.week === g.week && !g.finished && v.session.status === 'open' && !showRules;
    lastWeek = g ? g.week : null;
    view = v;
    const active = document.activeElement;
    if (sameWeek && active && active.closest && active.closest('#decide') && active.tagName === 'INPUT') {
      deferred = true; // do not steal focus while the student is typing
      updateTimer();
      return;
    }
    render();
  });
  let deferred = false;
  document.addEventListener('focusout', (e) => {
    if (!deferred || !e.target.closest || !e.target.closest('#decide')) return;
    setTimeout(() => {
      const a = document.activeElement;
      if (a && a.closest && a.closest('#decide')) return;
      deferred = false;
      render();
    }, 0);
  });

  setInterval(updateTimer, 500);

  function header() {
    document.getElementById('hdr-class').textContent = view.session.name;
    document.getElementById('hdr-name').textContent = view.me.name;
    const s = view.seat;
    document.getElementById('hdr-role').innerHTML = s ? `<span class="chip role-chip r${s.role}">${esc(s.roleName)} · ${esc(s.chainLabel)}</span>` : '';
  }

  function ctx() {
    const s = view.seat;
    return {
      role: s ? s.role : null,
      shipDelay: s ? s.config.shipDelay : 2,
      infoDelay: s ? s.config.infoDelay : 2,
      holdingCost: view.session.holdingCost,
      backlogCost: view.session.backlogCost,
    };
  }

  function render() {
    if (!view) return;
    header();
    const st = view.session.status;
    const g = view.game;
    if (g && g.finished) return renderDebrief();
    if (st === 'open' && g) return showRules ? renderRulesScreen(true) : renderPlay();
    if (st === 'prepare' || st === 'tutorial') return renderRulesScreen(false);
    if (st === 'open' && !view.seat) return msg('You are in the class', 'Your teacher will put you in a supply chain. Please wait. This page updates by itself.');
    if (st === 'ended') return msg('The game has ended', 'Thank you for playing. Your teacher will now discuss the results with the class.');
    return msg(`Welcome, ${view.me.name}`, `You joined <b>${esc(view.session.name)}</b>. Your teacher will open the game soon. This page updates by itself.` + seatLine());
  }

  function seatLine() {
    const s = view.seat;
    if (!s) return '';
    return `<br><br>You will play the <span class="chip role-chip r${s.role}">${esc(s.roleName)}</span> in ${esc(s.chainLabel)}.`;
  }

  function msg(title, body) {
    app.innerHTML = `<div class="panel center-msg"><h1>${esc(title)}</h1><p class="muted" style="margin-top:8px">${body}</p></div>`;
  }

  function renderRulesScreen(inGame) {
    const st = view.session.status;
    const note = view.session.note ? `<div class="alert" style="margin-bottom:16px"><b>Message from your teacher:</b> ${esc(view.session.note)}</div>` : '';
    const canName = view.seat && view.seat.role === 3 && view.session.chainNaming && !(view.game && view.game.finished);
    app.innerHTML = `
      <div class="spread" style="margin-bottom:16px"><h1>How to play</h1>${inGame ? '<button class="primary" id="back">Back to the game</button>' : '<span class="chip">Waiting for the teacher to start</span>'}</div>
      ${note}
      <div class="grid grid-2" style="align-items:start">
        <div class="panel">${BWRules.rulesHTML(ctx())}</div>
        <div class="stack">
          ${st === 'tutorial' || inGame ? `<div class="panel" id="tut">${BWRules.tutorialHTML()}</div>` : ''}
          ${canName ? nameChainHTML() : ''}
          ${view.seat ? teamHTML() : ''}
        </div>
      </div>`;
    if (inGame) document.getElementById('back').onclick = () => { showRules = false; render(); };
    const tut = document.getElementById('tut');
    if (tut) BWRules.bindTutorial(tut);
    bindNameChain();
  }

  function teamHTML() {
    const s = view.seat;
    return `<div class="panel"><h3>Your chain: ${esc(s.chainLabel)}</h3><div class="team">${s.chainPlayers.map((p, i) => `<span class="chip role-chip r${i}">${esc(p.role)}: ${p.names.length ? esc(p.names.join(', ')) : 'Computer'}</span>`).join('')}</div></div>`;
  }

  function nameChainHTML() {
    return `<form class="panel" id="name-chain"><h3>Name your chain</h3><p class="small muted" style="margin:6px 0 10px">As the Factory, you can give your chain a team name.</p><div class="row" style="flex-wrap:nowrap"><input type="text" id="chain-name" maxlength="30" value="${esc(view.seat.chainName || '')}" placeholder="Team name"><button type="submit">Save</button></div></form>`;
  }
  function bindNameChain() {
    const f = document.getElementById('name-chain');
    if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      socket.emit('student:nameChain', { token, name: document.getElementById('chain-name').value }, (r) => {
        if (r && r.ok) toast('Chain name saved.'); else toast((r && r.error) || 'Could not save.', 'error');
      });
    });
  }

  // ---------------- play ----------------
  function renderPlay() {
    const g = view.game, s = view.seat, c = g.current, r = s.role;
    if (draft.week !== g.week) draft = { week: g.week, order: '', forecast: '' };
    const buyer = r === 0 ? 'customers' : ROLES[r - 1];
    const supplier = r === 3 ? 'production' : ROLES[r + 1];
    const endTxt = view.session.endWeek ? `<small> of ${view.session.endWeek}</small>` : '';
    const owedBefore = Math.max(0, c.backlog);
    const lines = [
      { icon: r === 3 ? 'factory' : ICONS[ROLE_ICONS[r + 1]] ? ROLE_ICONS[r + 1] : 'truck', c: r === 3 ? 'var(--factory)' : `var(--${ROLES[r + 1].toLowerCase()})`, lbl: r === 3 ? 'Finished from production' : `Arrived from ${supplier}`, sub: 'Goods in', val: '+' + fmt(c.received) },
      { icon: r === 0 ? 'users' : ROLE_ICONS[r - 1], c: r === 0 ? 'var(--ink)' : `var(--${ROLES[r - 1].toLowerCase()})`, lbl: `New order from ${buyer}`, sub: 'Cases they want', val: fmt(c.incoming) },
      { icon: 'truck', c: `var(--${ROLES[r].toLowerCase()})`, lbl: `Shipped to ${buyer}`, sub: 'Goods out (new order + old backlog)', val: '−' + fmt(c.shipped) },
    ];
    const step = Math.max(1, Math.round(view.session.baseDemand / 4));
    const pend = g.myPending;
    app.innerHTML = `
      <div class="status">
        <div class="week">Week ${g.week}${endTxt}</div>
        <span id="timer"></span>
        <span class="spacer" style="flex:1"></span>
        <button class="small" id="how">${ICONS.info} How to play</button>
      </div>
      ${g.paused ? '<div class="alert" style="margin-bottom:16px"><b>Paused.</b> Your teacher has paused the game. Wait for the game to continue.</div>' : ''}
      <div class="play-grid">
        <div class="left">
          <section class="panel">
            <h2>This week</h2>
            <div class="ledger">${lines.map((l) => `<div class="line" style="--c:${l.c}"><span class="ic">${ICONS[l.icon] || ''}</span><span class="lbl">${esc(l.lbl)}<small>${esc(l.sub)}</small></span><span class="val">${l.val}</span></div>`).join('')}</div>
            <div class="stock-row">
              <div class="stat ${c.inventory > 0 ? 'good' : ''}"><div class="k">In stock</div><div class="v">${fmt(c.inventory)}</div></div>
              <div class="stat ${owedBefore > 0 ? 'bad' : ''}"><div class="k">Backlog (you owe)</div><div class="v">${fmt(c.backlog)}</div></div>
              <div class="stat"><div class="k">Cost this week</div><div class="v">${money(c.cost)}</div></div>
              <div class="stat"><div class="k">My total cost</div><div class="v">${money(c.cumCost)}</div></div>
            </div>
            ${c.supplyLine != null ? `<p class="alert" style="margin-top:12px">${ICONS.truck.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-4px;margin-right:6px"')}<b>${fmt(c.supplyLine)}</b> cases are ordered and on the way to you.</p>` : ''}
            <form class="decide" id="decide" novalidate>
              <div class="field">
                <label for="forecast">My guess: customer demand this week <span class="hint">(optional)</span></label>
                <input type="number" id="forecast" min="0" step="1" inputmode="numeric" placeholder="Cases" value="${esc(draft.forecast)}">
              </div>
              <div class="field">
                <label for="order">How many cases do you order from ${esc(supplier === 'production' ? 'production' : 'the ' + supplier)}?</label>
                <div class="stepper"><button type="button" data-d="-${step}" aria-label="Less">−</button><input type="number" id="order" min="0" step="1" inputmode="numeric" required placeholder="0" value="${esc(draft.order)}"><button type="button" data-d="${step}" aria-label="More">+</button></div>
              </div>
              <div id="form-err" class="alert error hidden" role="alert" style="margin-top:10px"></div>
              ${pend ? `<div class="alert ok sent">${ICONS.check.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-4px;margin-right:6px"')}<b>Order sent: ${fmt(pend.order)} cases.</b> ${g.waitingFor.length ? 'Waiting for:' : 'Next week is starting…'}<div class="waiting-list">${g.waitingFor.map((w) => `<span class="chip role-chip r${ROLES.indexOf(w)}">${esc(w)}</span>`).join('')}</div><p class="small" style="margin-top:8px">You can change your order until everyone has sent theirs.</p></div>` : ''}
              <button class="primary send" type="submit" ${g.paused ? 'disabled' : ''}>${pend ? 'Change my order' : 'Send order'}</button>
            </form>
          </section>
        </div>
        <div class="right stack">
          <section class="panel chart-panel"><h3>My stock and backlog</h3><p class="small muted">Above zero = cases in stock. Below zero = backlog.</p><div id="ch-stock"></div></section>
          <section class="panel chart-panel"><h3>Orders: in and out</h3><p class="small muted">Orders you received and orders you placed.</p><div id="ch-orders"></div></section>
          ${g.chain ? `<section class="panel chart-panel"><h3>Whole chain stock</h3><p class="small muted">Your teacher lets you see all four companies.</p><div id="ch-chain"></div></section>` : ''}
          <section><h3 style="margin-bottom:8px">My weeks</h3>${historyTable(g)}</section>
          ${teamHTML()}
          ${s.role === 3 && view.session.chainNaming ? nameChainHTML() : ''}
        </div>
      </div>`;

    const weeks = g.history.map((h) => h.week);
    const col = ROLE_COLORS[r];
    lineChart(document.getElementById('ch-stock'), { labels: weeks, step: true, series: [{ name: 'My stock (− = backlog)', color: col, values: g.history.map((h) => h.net) }], title: 'My stock' });
    const orderSeries = [
      { name: r === 0 ? 'Customer orders' : 'Orders received', color: '#6b7180', values: g.history.map((h) => h.incoming) },
      { name: 'My orders', color: col, values: g.history.map((h) => h.order) },
    ];
    if (g.customerDemand && r !== 0) orderSeries.push({ name: 'Customer demand', color: CUSTOMER_COLOR, dash: true, values: g.customerDemand });
    lineChart(document.getElementById('ch-orders'), { labels: weeks, series: orderSeries, title: 'Orders' });
    if (g.chain) lineChart(document.getElementById('ch-chain'), { labels: weeks, step: true, series: g.chain.map((x, i) => ({ name: x.role, color: ROLE_COLORS[i], values: x.nets })), title: 'Chain stock' });

    document.getElementById('how').onclick = () => { showRules = true; render(); window.scrollTo(0, 0); };
    bindNameChain();
    const form = document.getElementById('decide');
    const orderEl = document.getElementById('order');
    const fcEl = document.getElementById('forecast');
    orderEl.addEventListener('input', () => { draft.order = orderEl.value; });
    fcEl.addEventListener('input', () => { draft.forecast = fcEl.value; });
    form.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => {
      const v = Math.max(0, (parseInt(orderEl.value, 10) || 0) + Number(b.dataset.d));
      orderEl.value = v; draft.order = String(v); orderEl.focus();
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = document.getElementById('form-err');
      err.classList.add('hidden');
      const o = orderEl.value.trim();
      if (o === '' || !/^\d+$/.test(o)) { err.textContent = 'Type how many cases you want to order (a whole number, 0 or more).'; err.classList.remove('hidden'); orderEl.focus(); return; }
      const f = fcEl.value.trim();
      if (f !== '' && !/^\d+$/.test(f)) { err.textContent = 'Your guess must be a whole number, 0 or more.'; err.classList.remove('hidden'); fcEl.focus(); return; }
      if (sending) return;
      sending = true;
      deferred = false;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const btn = form.querySelector('.send');
      btn.disabled = true; btn.textContent = 'Sending…';
      socket.emit('student:submit', { token, week: g.week, order: Number(o), forecast: f === '' ? null : Number(f) }, (res) => {
        sending = false;
        if (!res || !res.ok) {
          btn.disabled = false; btn.textContent = 'Send order';
          err.textContent = (res && res.error) || 'Could not send. Try again.'; err.classList.remove('hidden');
        }
      });
    });
    if (draft.focus !== g.week && !pend && window.matchMedia('(min-width: 980px)').matches) { orderEl.focus({ preventScroll: true }); draft.focus = g.week; }
    updateTimer();
  }

  function historyTable(g) {
    const rows = g.history.slice().reverse().map((h) => `<tr><td class="num">${h.week}</td><td class="num">${fmt(h.received)}</td><td class="num">${fmt(h.incoming)}</td><td class="num">${fmt(h.shipped)}</td><td class="num ${h.net < 0 ? 'neg' : ''}">${signed(h.net)}</td><td class="num">${h.order == null ? '–' : fmt(h.order) + (h.auto ? '*' : '')}</td><td class="num">${money(h.cost)}</td></tr>`).join('');
    return `<div class="table-wrap" style="max-height:340px"><table><thead><tr><th class="num">Week</th><th class="num">Arrived</th><th class="num">Order in</th><th class="num">Shipped</th><th class="num">Stock</th><th class="num">My order</th><th class="num">Cost</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small muted" style="margin-top:6px">* ordered for you when the timer ended. Negative stock = backlog.</p>`;
  }

  function updateTimer() {
    const el = document.getElementById('timer');
    if (!el || !view || !view.game) return;
    const g = view.game;
    if (g.paused) { el.className = 'timer paused'; el.innerHTML = ICONS.pause + 'Paused'; return; }
    let secs = null;
    if (g.deadline) secs = remaining(g.deadline, offset);
    else if (g.frozenRemaining != null) secs = Math.round(g.frozenRemaining / 1000);
    if (secs == null) { el.className = ''; el.innerHTML = ''; return; }
    el.className = 'timer' + (secs <= 30 ? ' low' : '');
    el.innerHTML = ICONS.clock + `<span aria-label="Time left">${mmss(secs)}</span>`;
  }

  // ---------------- debrief ----------------
  function renderDebrief() {
    const g = view.game, s = view.seat, d = g.debrief;
    const ch = d.chain, a = ch.analytics;
    const me = ch.roles[s.role];
    const bench = d.benchmark;
    const weeks = ch.roles[0].series.map((x) => x.week);
    const ord = (x) => (x == null ? '–' : x + (x % 10 === 1 && x !== 11 ? 'st' : x % 10 === 2 && x !== 12 ? 'nd' : x % 10 === 3 && x !== 13 ? 'rd' : 'th'));
    app.innerHTML = `
      <div class="debrief-head">
        <div>
          <h1>Game over. Here is what happened.</h1>
          <p class="muted" style="margin-top:8px">${esc(s.chainLabel)} played ${a.weeks} weeks. Your role: <span class="chip role-chip r${s.role}">${esc(s.roleName)}</span></p>
        </div>
        <div class="panel">
          <div class="k small muted"><b>Total cost of your chain</b></div>
          <div class="big-cost">${money(a.totalCost)}</div>
          <p class="small" style="margin-top:6px">${d.chainsRanked > 1 ? `${ord(d.rank)} lowest of ${d.chainsRanked} chains.` : ''} Your company: <b>${money(me.cumCost)}</b>.</p>
        </div>
      </div>
      <div class="grid grid-2" style="align-items:start">
        <section class="panel chart-panel">
          <h2>The bullwhip effect</h2>
          <p class="small muted" style="margin:6px 0 8px">The black dashed line is real customer demand. The coloured lines are the orders each company placed.</p>
          <div id="ch-bw"></div>
        </section>
        <section class="panel chart-panel">
          <h2>Stock and backlog</h2>
          <p class="small muted" style="margin:6px 0 8px">Below zero means customers were waiting.</p>
          <div id="ch-net"></div>
        </section>
      </div>
      <section style="margin-top:18px">
        <h2 style="margin-bottom:10px">Each company</h2>
        <div class="table-wrap"><table><thead><tr><th>Company</th><th class="num">Total cost</th><th class="num">Stock cost</th><th class="num">Backlog cost</th><th class="num">Biggest order</th><th class="num">vs biggest customer order</th><th class="num">Bullwhip ratio</th><th class="num">Guess error</th></tr></thead><tbody>
        ${a.roles.map((x, i) => `<tr${i === s.role ? ' style="font-weight:700"' : ''}><td><span class="chip role-chip r${i}">${esc(x.role)}</span>${i === s.role ? ' (you)' : ''}</td><td class="num">${money(x.cumCost)}</td><td class="num">${money(x.cumHolding)}</td><td class="num">${money(x.cumBacklog)}</td><td class="num">${fmt(x.peakOrder)} <span class="muted small">wk ${x.peakWeek ?? '–'}</span></td><td class="num">${BW.ratio(x.amplification)}</td><td class="num">${BW.ratio(x.bullwhip)}</td><td class="num">${x.forecastError == null ? '–' : fmt(x.forecastError)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="small muted" style="margin-top:8px">“vs biggest customer order” = your biggest order divided by the biggest customer order. Bullwhip ratio = how much more your orders moved up and down than customer demand (variance). 1× means no extra swing. Guess error = average difference between your guess and real customer demand.</p>
      </section>
      <div class="grid grid-2" style="margin-top:18px;align-items:start">
        ${bench ? `<section class="panel"><h2>Compare with a careful computer chain</h2><p style="margin-top:8px">The same demand was played by four computer players. They follow one rule: <i>order what customers want, plus a small fix for stock that is too high or too low, and remember goods already on the way.</i></p><div class="compare" style="margin-top:14px"><div class="spread"><span>Your chain</span><b class="num">${money(a.totalCost)}</b></div><div class="spread"><span>Careful computer chain</span><b class="num">${money(bench.analytics.totalCost)}</b></div><div class="spread"><span>${view.solo ? 'Your best score on this device' : 'Best chain in your class'}</span><b class="num">${money(d.classBestCost)}</b></div></div></section>` : ''}
        <section class="panel reflect"><h2>Think about it</h2><ol>
          <li>Customer demand changed only once (or a little). Why did the orders up the chain move so much more?</li>
          <li>When you had backlog, did you order more? What happened when all those goods arrived?</li>
          <li>Did you remember the cases that were already on the way to you?</li>
          <li>What information would you like to see from the other companies? How would it help?</li>
          <li>Name one real company problem that looks like this game.</li>
        </ol></section>
      </div>`;
    const bw = ch.roles.map((x, i) => ({ name: x.role, color: ROLE_COLORS[i], values: x.series.map((h) => h.order), width: i === s.role ? 3.25 : 2 }));
    bw.unshift({ name: 'Customer demand', color: CUSTOMER_COLOR, dash: true, values: ch.demand });
    lineChart(document.getElementById('ch-bw'), { labels: weeks, series: bw, title: 'Orders by company' });
    lineChart(document.getElementById('ch-net'), { labels: weeks, step: true, series: ch.roles.map((x, i) => ({ name: x.role, color: ROLE_COLORS[i], values: x.series.map((h) => h.net), width: i === s.role ? 3.25 : 2 })), title: 'Stock by company' });
  }
})();
