'use strict';
/**
 * Bullwhip Lab simulation engine (pure, no I/O).
 *
 * Week t (1-based) for every role i (0 Retailer, 1 Wholesaler, 2 Distributor, 3 Factory):
 *   received(i,t) = shipped(i+1, t - S)            (factory: production ordered at t - S)
 *   incoming(i,t) = customerDemand(t)              (retailer)
 *                 = ordersPlaced(i-1, t - I)       (others)
 *   shipped(i,t)  = min(onHand + received, backlog + incoming)
 *   net(i,t)      = net(i,t-1) + received - incoming          (negative = backlog)
 *   cost(i,t)     = holding * max(net,0) + backlogCost * max(-net,0)
 * Values before week 1 equal the base demand (steady state).
 * Flows for week t depend only on earlier decisions, so a week's flows are
 * computed first, then players see them and place this week's order.
 * These rules reproduce the captured Classic chain exactly (see test/).
 */

const ROLES = ['Retailer', 'Wholesaler', 'Distributor', 'Factory'];

// Computer ordering policies. Benchmark was tuned for lowest total cost across
// classic/advanced/seasonal/random demand with 1- and 2-week delays.
const POLICIES = {
  standIn: { theta: 0.3, a: 0.25, b: 0.25 }, // fills empty roles in student chains
  benchmark: { theta: 0.2, a: 0.15, b: 0.25 }, // "well-run chain" for comparison
};

function createChainState(cfg, settings) {
  const base = settings.baseDemand;
  return {
    week: 0, // last week whose flows have been computed
    finished: false,
    shipDelay: cfg.shipDelay,
    infoDelay: cfg.infoDelay,
    base,
    holdingCost: settings.holdingCost,
    backlogCost: settings.backlogCost,
    demand: [], // customer demand by week index (0 = week 1)
    roles: ROLES.map(() => ({
      net: settings.initialInventory,
      cumCost: 0,
      cumHolding: 0,
      cumBacklog: 0,
      orders: [], // order placed in week t at index t-1
      forecasts: [],
      auto: [], // true when the order was auto-filled (timer / computer)
      received: [],
      incoming: [],
      shipped: [],
      nets: [],
      costs: [],
      expected: base, // smoothed demand expectation used by computer policy
    })),
  };
}

function orderAt(st, i, t) {
  return t >= 1 ? st.roles[i].orders[t - 1] : st.base;
}
function shippedAt(st, i, t) {
  return t >= 1 ? st.roles[i].shipped[t - 1] : st.base;
}

/** Compute flows for the next week. demandForWeek = customer demand. */
function beginWeek(st, demandForWeek) {
  const t = st.week + 1;
  const S = st.shipDelay;
  const I = st.infoDelay;
  st.demand[t - 1] = demandForWeek;
  for (let i = 0; i < 4; i++) {
    const r = st.roles[i];
    const rec = i < 3 ? shippedAt(st, i + 1, t - S) : orderAt(st, 3, t - S);
    const inc = i === 0 ? demandForWeek : orderAt(st, i - 1, t - I);
    const onHand = Math.max(0, r.net) + rec;
    const due = Math.max(0, -r.net) + inc;
    const ship = Math.min(onHand, due);
    r.net = r.net + rec - inc;
    const hold = st.holdingCost * Math.max(0, r.net);
    const back = st.backlogCost * Math.max(0, -r.net);
    r.received[t - 1] = rec;
    r.incoming[t - 1] = inc;
    r.shipped[t - 1] = ship;
    r.nets[t - 1] = r.net;
    r.costs[t - 1] = round2(hold + back);
    r.cumHolding = round2(r.cumHolding + hold);
    r.cumBacklog = round2(r.cumBacklog + back);
    r.cumCost = round2(r.cumCost + hold + back);
  }
  st.week = t;
  return t;
}

/** Record orders for the current week. orders[i] = {order, forecast, auto} */
function placeOrders(st, decisions) {
  const t = st.week;
  for (let i = 0; i < 4; i++) {
    const d = decisions[i];
    const r = st.roles[i];
    r.orders[t - 1] = clampOrder(d.order);
    r.forecasts[t - 1] = d.forecast == null || d.forecast === '' ? null : clampOrder(d.forecast);
    r.auto[t - 1] = !!d.auto;
  }
}

function clampOrder(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1e9);
}
function round2(x) {
  return Math.round(x * 100) / 100;
}

/** Orders placed but not yet received (supply line), including the initial pipeline. */
function supplyLine(st, i) {
  const t = st.week;
  const r = st.roles[i];
  const lead = i < 3 ? st.infoDelay + st.shipDelay : st.shipDelay;
  let placed = st.base * lead;
  for (let w = 0; w < r.orders.length; w++) placed += r.orders[w] || 0;
  let got = 0;
  for (let w = 0; w < t; w++) got += r.received[w] || 0;
  return Math.max(0, placed - got);
}

/**
 * Computer player: anchor-and-adjust ordering (Sterman 1989 style).
 * order = E + a * (target - net) + b * (E * lead - supplyLine)
 */
function computerOrder(st, i, opts = {}) {
  const theta = opts.theta ?? POLICIES.standIn.theta;
  const a = opts.a ?? POLICIES.standIn.a;
  const b = opts.b ?? POLICIES.standIn.b;
  const target = opts.target ?? st.base * 3;
  const t = st.week;
  const r = st.roles[i];
  const inc = r.incoming[t - 1];
  r.expected = theta * inc + (1 - theta) * r.expected;
  const lead = i < 3 ? st.infoDelay + st.shipDelay : st.shipDelay;
  const sl = supplyLine(st, i);
  const o = r.expected + a * (target - r.net) + b * (r.expected * lead - sl);
  return { order: Math.max(0, Math.round(o)), forecast: Math.round(r.expected), auto: true };
}

// ---------------- demand patterns ----------------
const ADVANCED = [1, 1, 1, 1, 2.5, 2.5, 2.5, 2, 3]; // then 2.5 (observed ratios)

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demandSeries(demand, base, weeks) {
  const out = [];
  const type = demand.type || 'classic';
  const rnd = mulberry32(Number(demand.seed) || 12345);
  for (let w = 1; w <= weeks; w++) {
    let v;
    switch (type) {
      case 'advanced':
        v = base * (w <= ADVANCED.length ? ADVANCED[w - 1] : 2.5);
        break;
      case 'seasonal':
        v = w <= 3 ? base : base * (1.5 + 0.5 * Math.sin((2 * Math.PI * (w - 4)) / 12));
        break;
      case 'random':
        v = w <= 3 ? base : base * (1.5 + (rnd() - 0.5) * 1.0);
        break;
      case 'custom': {
        const arr = demand.custom || [];
        v = arr.length ? arr[Math.min(w - 1, arr.length - 1)] : base;
        break;
      }
      case 'classic':
      default:
        v = w <= 3 ? base : base * 2;
    }
    out.push(Math.max(0, Math.round(v)));
  }
  return out;
}

// ---------------- analytics ----------------
function variance(arr) {
  const a = arr.filter((x) => Number.isFinite(x));
  if (a.length < 2) return 0;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
}

function chainAnalytics(st) {
  const weeks = st.roles[0].orders.length;
  const dem = st.demand.slice(0, weeks);
  const vd = variance(dem);
  const roles = st.roles.map((r, i) => {
    const orders = r.orders.slice(0, weeks);
    let peak = -1, peakWeek = null;
    orders.forEach((o, w) => { if (o > peak) { peak = o; peakWeek = w + 1; } });
    const nets = r.nets.slice(0, weeks);
    const peakDemand = dem.length ? Math.max(...dem) : 0;
    return {
      role: ROLES[i],
      amplification: peakDemand > 0 && peak >= 0 ? round2(peak / peakDemand) : null,
      bullwhip: vd > 0 ? round2(variance(orders) / vd) : null,
      peakOrder: peak < 0 ? null : peak,
      peakWeek,
      maxInventory: nets.length ? Math.max(0, ...nets) : 0,
      maxBacklog: nets.length ? Math.max(0, ...nets.map((n) => -n)) : 0,
      cumCost: r.cumCost,
      cumHolding: r.cumHolding,
      cumBacklog: r.cumBacklog,
      forecastError: forecastError(r.forecasts.slice(0, weeks), dem),
    };
  });
  const pw = roles.map((r) => r.peakWeek);
  const allPeaks = pw.every((x) => x != null) && weeks > 0;
  const classicBullwhip = allPeaks && pw[0] < pw[1] && pw[1] < pw[2] && pw[2] < pw[3];
  const reverseBullwhip = allPeaks && pw[0] > pw[1] && pw[1] > pw[2] && pw[2] > pw[3];
  const totalCost = round2(roles.reduce((s, r) => s + r.cumCost, 0));
  return {
    weeks,
    roles,
    classicBullwhip,
    reverseBullwhip,
    totalCost,
    totalHolding: round2(roles.reduce((s, r) => s + r.cumHolding, 0)),
    totalBacklog: round2(roles.reduce((s, r) => s + r.cumBacklog, 0)),
    avgCostPerWeek: weeks ? round2(totalCost / weeks) : 0,
    maxInventory: Math.max(0, ...roles.map((r) => r.maxInventory)),
    maxBacklog: Math.max(0, ...roles.map((r) => r.maxBacklog)),
  };
}

function forecastError(forecasts, dem) {
  const pairs = forecasts.map((f, w) => [f, dem[w]]).filter(([f]) => f != null);
  if (!pairs.length) return null;
  const mae = pairs.reduce((s, [f, d]) => s + Math.abs(f - d), 0) / pairs.length;
  return round2(mae);
}

/** Run a whole chain with computer players only (benchmark). */
function runBenchmark(cfg, settings, demand, weeks, opts) {
  const st = createChainState(cfg, settings);
  const policy = opts || POLICIES.benchmark;
  for (let w = 1; w <= weeks; w++) {
    beginWeek(st, demand[w - 1]);
    placeOrders(st, [0, 1, 2, 3].map((i) => computerOrder(st, i, policy)));
  }
  st.finished = true;
  return st;
}

const api = {
  ROLES,
  POLICIES,
  createChainState,
  beginWeek,
  placeOrders,
  supplyLine,
  computerOrder,
  demandSeries,
  chainAnalytics,
  runBenchmark,
  variance,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.BWEngine = api;
