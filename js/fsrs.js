// FSRS-5 style scheduler (compact implementation) + simple learning steps.
// Card: { state:0 new|1 learning|2 review|3 relearning, step, due(ms), S, D, reps, lapses, last(ms) }
const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5, FACTOR = 19 / 81;
const DAY = 86400000, MIN = 60000;
export const LEARN_STEPS = [1, 10];      // minutes
export const RELEARN_STEPS = [10];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const R = (t, S) => Math.pow(1 + FACTOR * t / S, DECAY);
const ivl = (S, r) => (S / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
const s0 = (g) => Math.max(0.1, W[g - 1]);
const d0 = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
function nextD(D, g) {
  const dd = -W[6] * (g - 3);
  const d1 = D + dd * (10 - D) / 9;
  return clamp(W[7] * d0(4) + (1 - W[7]) * d1, 1, 10);
}
function sRecall(D, S, r, g) {
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
}
function sForget(D, S, r) {
  return Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
}
function sShort(S, g) { return S * Math.exp(W[17] * (g - 3 + W[18])); }

// Anki-like rollover: reviews due "at 4am" of the target day
function dueDay(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days); d.setHours(4, 0, 0, 0);
  if (days <= 0 && d.getTime() < now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function newCard() { return { state: 0, step: 0, due: 0, S: 0, D: 0, reps: 0, lapses: 0, last: 0 }; }

export function schedule(card, g, now = Date.now(), retention = 0.9) {
  const c = { ...card };
  const interval = (S) => Math.max(1, Math.round(ivl(S, retention)));
  const grad = (min = 1) => {
    c.state = 2; c.step = 0;
    let d = Math.min(36500, Math.max(min, interval(c.S)));
    c.due = dueDay(now, d);
  };
  if (c.state === 0) {                   // first ever review
    c.S = s0(g); c.D = d0(g); c.reps = 1; c.last = now;
    if (g === 4) { grad(4); return c; }
    c.state = 1; c.step = g === 3 && LEARN_STEPS.length > 1 ? 1 : 0;
    c.due = now + (g === 1 ? LEARN_STEPS[0] : g === 2 ? 5 : LEARN_STEPS[c.step]) * MIN;
    if (g === 3 && LEARN_STEPS.length === 1) grad();
    return c;
  }
  if (c.state === 1 || c.state === 3) {  // (re)learning steps
    const steps = c.state === 1 ? LEARN_STEPS : RELEARN_STEPS;
    c.S = Math.max(0.1, sShort(c.S, g)); c.D = nextD(c.D, g); c.reps++; c.last = now;
    if (g === 1) { c.step = 0; c.due = now + steps[0] * MIN; return c; }
    if (g === 2) { c.due = now + steps[Math.min(c.step, steps.length - 1)] * MIN * (c.step === 0 ? 1.5 : 1); return c; }
    if (g === 3 && c.step < steps.length - 1) { c.step++; c.due = now + steps[c.step] * MIN; return c; }
    grad(g === 4 ? 2 : 1); return c;
  }
  // review
  const t = Math.max(0, (now - c.last) / DAY);
  const r = R(t, c.S);
  c.reps++; c.last = now;
  if (g === 1) {
    c.lapses++; c.S = Math.max(0.1, sForget(c.D, c.S, r)); c.D = nextD(c.D, g);
    c.state = 3; c.step = 0; c.due = now + RELEARN_STEPS[0] * MIN; return c;
  }
  const S = sRecall(c.D, c.S, r, g);
  c.D = nextD(c.D, g); c.S = S;
  let d = interval(S);
  if (g === 2) d = Math.max(1, Math.min(d, interval(sRecall(card.D, card.S, r, 3)) - 0));
  if (g === 4) d = Math.max(d, interval(sRecall(card.D, card.S, r, 3)) + 1);
  c.due = dueDay(now, Math.min(36500, d));
  return c;
}

export function preview(card, now = Date.now(), retention = 0.9) {
  const out = {};
  for (const g of [1, 2, 3, 4]) out[g] = schedule(card, g, now, retention).due - now;
  return out;
}
export const retrievability = (card, now = Date.now()) => card.state === 0 ? 0 : R(Math.max(0, (now - card.last) / DAY), card.S);
