/* Rules and tutorial in simple English. Shared by the student page and the teacher preview. */
(function () {
  const { ROLES, ROLE_ICONS, ICONS, esc, money } = BW;

  function flowDiagram(role) {
    const nodes = ['Customer', ...ROLES];
    return '<div class="flow" aria-hidden="true">' + nodes.map((n, i) => {
      const c = i === 0 ? 'var(--ink)' : `var(--${n.toLowerCase()})`;
      const icon = i === 0 ? ICONS.users : ICONS[ROLE_ICONS[i - 1]];
      const me = role != null && i === role + 1 ? ' me' : '';
      const arrows = i ? `<div class="arrows"><span title="orders go up">${ICONS.arrowRight}</span><span style="transform:scaleX(-1)" title="goods come down">${ICONS.arrowRight}</span></div>` : '';
      return arrows + `<div class="node${me}" style="--c:${c}">${icon}<span>${n}${me ? '<br><small>(you)</small>' : ''}</span></div>`;
    }).join('') + '</div><p class="small muted">Orders move to the right, one step each time. Goods move to the left.</p>';
  }

  function rulesHTML(ctx) {
    const r = ctx.role;
    const name = r == null ? 'one company' : 'the <b>' + ROLES[r] + '</b>';
    const buyer = r == null ? '' : r === 0 ? 'customers' : 'the ' + ROLES[r - 1];
    const seller = r == null ? '' : r === 3 ? 'your own production line' : 'the ' + ROLES[r + 1];
    const s = ctx.shipDelay, i = ctx.infoDelay;
    const wk = (n) => n + (n === 1 ? ' week' : ' weeks');
    return `
      <div class="rules stack" style="--gap:18px">
        <section>
          <h2>Your job</h2>
          <p style="margin-top:8px">You are ${name} in a supply chain of four companies.${r == null ? '' : ` You sell to ${buyer}. You get goods from ${seller}.`}</p>
          ${flowDiagram(r)}
        </section>
        <section>
          <h3>Every week</h3>
          <ol>
            <li><b>Goods arrive</b> from your supplier.</li>
            <li><b>An order arrives</b> from your buyer.</li>
            <li><b>You ship</b> as much as you can. If you do not have enough, the missing cases are <b>backlog</b>. You must send them later.</li>
            <li><b>You order</b> new cases from your supplier.</li>
          </ol>
        </section>
        <section>
          <h3>Delays</h3>
          <ol>
            <li>Your order takes <b>${wk(i)}</b> to reach your supplier.</li>
            <li>Goods take <b>${wk(s)}</b> to travel to you.${r === 3 ? ` For the Factory, production takes <b>${wk(s)}</b>.` : ''}</li>
            <li>So goods you order today arrive in about <b>${wk(r === 3 ? s : i + s)}</b>, if your supplier has stock.</li>
          </ol>
        </section>
        <section>
          <h3>Costs</h3>
          <div class="cost-pair">
            <div class="stat"><div class="k">Each case in stock</div><div class="v">${money(ctx.holdingCost)}</div><div class="small muted">per week</div></div>
            <div class="stat bad"><div class="k">Each case in backlog</div><div class="v">${money(ctx.backlogCost)}</div><div class="small">per week</div></div>
          </div>
          <p style="margin-top:10px">Your team goal: the <b>lowest total cost for the whole chain</b>. Too much stock costs money. Backlog costs more.</p>
        </section>
        <section>
          <h3>Rules of play</h3>
          <ol>
            <li>Do not talk to the other players in your chain. Use only the numbers on your screen.</li>
            <li>Each week, also guess the customer demand. This guess does not change your cost. We use it after the game.</li>
            <li>When there is a timer and it ends, the game orders for you: it orders the same number your buyer ordered.</li>
          </ol>
        </section>
      </div>`;
  }

  const QUIZ = [
    {
      q: 'You have 5 cases in stock. Your buyer orders 8. What happens?',
      opts: ['You ship 8 cases.', 'You ship 5 cases. 3 cases become backlog.', 'You ship 0 cases.'],
      a: 1,
      why: 'You can only ship what you have. The 3 missing cases are backlog. You send them later.',
    },
    {
      q: 'Which costs more each week?',
      opts: ['1 case in stock', '1 case in backlog', 'They cost the same'],
      a: 1,
      why: 'Backlog costs twice as much as stock. Customers who wait are expensive.',
    },
    {
      q: 'You ordered a lot of cases, but they have not arrived yet. What should you remember?',
      opts: ['They will still arrive later. Do not order them again.', 'They are lost. Order them again.', 'It does not matter.'],
      a: 0,
      why: 'Orders take time. If you forget the goods that are on the way, you order too much and get a big pile of stock later.',
    },
  ];

  function tutorialHTML() {
    return `<div class="stack" style="--gap:12px"><h2>Practice questions</h2><p class="muted">Answer these three questions before the game starts.</p><div class="quiz">${QUIZ.map((q, qi) => `
      <div class="q" data-q="${qi}"><b>${qi + 1}. ${esc(q.q)}</b><div class="opts">${q.opts.map((o, oi) => `<button type="button" data-o="${oi}">${esc(o)}</button>`).join('')}</div><p class="why small hidden" style="margin-top:8px"></p></div>`).join('')}</div></div>`;
  }

  function bindTutorial(root) {
    root.querySelectorAll('.quiz .q').forEach((qel) => {
      const q = QUIZ[Number(qel.dataset.q)];
      qel.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => {
          const o = Number(b.dataset.o);
          qel.querySelectorAll('button').forEach((x) => x.classList.remove('right', 'wrong'));
          b.classList.add(o === q.a ? 'right' : 'wrong');
          const why = qel.querySelector('.why');
          why.textContent = (o === q.a ? 'Correct. ' : 'Not quite. ') + q.why;
          why.classList.remove('hidden');
        });
      });
    });
  }

  window.BWRules = { rulesHTML, tutorialHTML, bindTutorial, flowDiagram };
})();
