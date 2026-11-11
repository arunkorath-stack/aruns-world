/* Single-player Bullwhip game that runs fully in the browser (no server).
 * It imitates the small socket API the student screen (play.js) uses, so the
 * same, tested screens work on GitHub Pages: one student plays one company,
 * computer players run the other three. */
(function () {
  const E = window.BWEngine;
  const SETTINGS = { baseDemand: 4, initialInventory: 12, holdingCost: 0.5, backlogCost: 1 };
  const CONFIGS = {
    classic: { name: 'Classic', shipDelay: 2, infoDelay: 2, showPOS: false, showChain: false, showSupplyLine: false },
    shared: { name: 'Shared information', shipDelay: 1, infoDelay: 1, showPOS: true, showChain: true, showSupplyLine: true },
  };

  function roleSeries(r, upto) {
    const out = [];
    for (let w = 1; w <= upto; w++) {
      out.push({ week: w, incoming: r.incoming[w - 1], received: r.received[w - 1], shipped: r.shipped[w - 1], net: r.nets[w - 1], order: r.orders[w - 1] ?? null, forecast: r.forecasts[w - 1] ?? null, auto: r.auto[w - 1] ?? false, cost: r.costs[w - 1] });
    }
    return out;
  }

  function create({ role, mode, demandType, name }) {
    const cfg = CONFIGS[mode] || CONFIGS.classic;
    const endWeek = 24 + Math.floor(Math.random() * 7); // hidden from the player
    const seed = Math.floor(Math.random() * 1e6) + 1;
    const demand = E.demandSeries({ type: demandType === 'random' ? 'random' : 'classic', seed }, SETTINGS.baseDemand, endWeek);
    const st = E.createChainState(cfg, SETTINGS);
    E.beginWeek(st, demand[0]);
    const bench = E.runBenchmark(cfg, SETTINGS, demand, endWeek);
    const handlers = {};
    let pending = null;
    const bestKey = 'bwl-solo-best-' + mode + '-' + demandType;

    function fire(ev, data) { (handlers[ev] || []).forEach((fn) => fn(data)); }

    function view() {
      const r = st.roles[role];
      const finished = st.finished;
      const g = {
        week: st.week,
        finished,
        paused: false,
        deadline: null,
        frozenRemaining: null,
        timerTotal: null,
        submitted: !!pending,
        myPending: pending ? { order: pending.order, forecast: pending.forecast } : null,
        waitingFor: pending ? E.ROLES.filter((_, i) => i !== role) : [],
        current: {
          incoming: r.incoming[st.week - 1], received: r.received[st.week - 1], shipped: r.shipped[st.week - 1],
          net: r.net, inventory: Math.max(0, r.net), backlog: Math.max(0, -r.net), cost: r.costs[st.week - 1], cumCost: r.cumCost,
          supplyLine: cfg.showSupplyLine || finished ? E.supplyLine(st, role) : null,
        },
        history: roleSeries(r, st.week),
        customerDemand: role === 0 || cfg.showPOS || finished ? st.demand.slice(0, st.week) : null,
        chain: cfg.showChain || finished ? st.roles.map((x, i) => ({ role: E.ROLES[i], net: x.net, cumCost: x.cumCost, nets: x.nets.slice(0, st.week) })) : null,
      };
      if (finished) {
        let best = null;
        try { best = Number(localStorage.getItem(bestKey)) || null; } catch (e) { /* storage blocked */ }
        g.debrief = {
          chain: {
            week: st.week, finished: true, demand: st.demand.slice(0, st.week),
            roles: st.roles.map((x, i) => ({ role: E.ROLES[i], net: x.net, cumCost: x.cumCost, cumHolding: x.cumHolding, cumBacklog: x.cumBacklog, supplyLine: E.supplyLine(st, i), series: roleSeries(x, st.week) })),
            analytics: E.chainAnalytics(st),
          },
          benchmark: { analytics: E.chainAnalytics(bench), orders: bench.roles.map((x) => x.orders.slice()), nets: bench.roles.map((x) => x.nets.slice()) },
          rank: 1, chainsRanked: 1, classBestCost: best,
        };
      }
      return {
        solo: true,
        serverNow: Date.now(),
        me: { id: 'me', name },
        session: { name: 'Practice game', code: '', status: 'open', paused: false, note: '', chainNaming: false, holdingCost: SETTINGS.holdingCost, backlogCost: SETTINGS.backlogCost, baseDemand: SETTINGS.baseDemand, initialInventory: SETTINGS.initialInventory, endWeek: null },
        seat: {
          chainId: 'solo', chainNumber: 1, chainName: '', chainLabel: cfg.name + ' chain', role, roleName: E.ROLES[role], teammates: [],
          chainPlayers: E.ROLES.map((x, i) => ({ role: x, names: i === role ? [name] : [] })),
          config: { name: cfg.name, shipDelay: cfg.shipDelay, infoDelay: cfg.infoDelay, showPOS: cfg.showPOS, showChain: cfg.showChain, showSupplyLine: cfg.showSupplyLine },
        },
        game: g,
      };
    }

    function emitState() { setTimeout(() => fire('student:state', view()), 0); }

    function submit(msg, cb) {
      if (st.finished) return cb({ ok: false, error: 'The game has finished.' });
      if (Number(msg.week) !== st.week) return cb({ ok: false, error: 'This week is already done.' });
      const o = Number(msg.order);
      if (!Number.isFinite(o) || o < 0 || Math.round(o) !== o) return cb({ ok: false, error: 'Order must be a whole number, 0 or more.' });
      if (pending) return cb({ ok: false, error: 'Wait a moment, the other companies are ordering.' });
      pending = { order: o, forecast: msg.forecast == null ? null : Math.round(Number(msg.forecast)) };
      cb({ ok: true });
      emitState();
      // the computer players "think" for a moment, then the week moves on
      setTimeout(() => {
        const decisions = [0, 1, 2, 3].map((i) => (i === role ? { order: pending.order, forecast: pending.forecast, auto: false } : E.computerOrder(st, i)));
        E.placeOrders(st, decisions);
        pending = null;
        if (st.week >= endWeek) {
          st.finished = true;
          const cost = E.chainAnalytics(st).totalCost;
          try { const b = Number(localStorage.getItem(bestKey)); if (!b || cost < b) localStorage.setItem(bestKey, String(cost)); } catch (e) { /* ignore */ }
        } else {
          E.beginWeek(st, demand[st.week]);
        }
        emitState();
      }, 650);
    }

    const socket = {
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); if (ev === 'connect') setTimeout(fn, 0); return socket; },
      off() { return socket; },
      emit(ev, msg, cb) {
        cb = cb || function () {};
        if (ev === 'student:resume') { cb({ ok: true }); emitState(); return; }
        if (ev === 'student:submit') return submit(msg || {}, cb);
        cb({ ok: false, error: 'Not available in practice mode.' });
      },
    };
    return socket;
  }

  window.BWSolo = { create };
})();
