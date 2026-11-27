/* HEADLINERS: World Soccer 48 — original big-head 1v1 arcade soccer.
   All art/audio generated with Higgsfield. Engine: Canvas2D, fixed 1280x720 world. */
(() => {
'use strict';
const W = 1280, H = 720;
const GROUND = 624;              // y of grass contact line
const GOAL_W = 156;              // goal mouth depth from each edge
const CROSSBAR = GROUND - 272;   // y of crossbar
let BALL_R = 21;
const CLOCK_RATE = 3;
const MATCH_TIME = 90;
const cv = document.getElementById('game');
let ctx = cv.getContext('2d'); const mainCtx = ctx;
let scale = 1, offX = 0, offY = 0;

/* ---------------- assets ---------------- */
const IMG = {}, SND = {};
const A = 'assets/';
function loadImg(key, src) {
  return new Promise(res => { const i = new Image(); i.onload = () => { IMG[key] = i; res(); }; i.onerror = () => res(); i.src = src; });
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------------- audio ---------------- */
let AC = null, master = null, musicGain = null, sfxGain = null, muted = store.get('hl_muted', false);
const BUF = {};
async function loadSound(key, src) {
  try { const r = await fetch(src); if (!r.ok) return; BUF[key] = await r.arrayBuffer(); } catch (e) {}
}
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.connect(AC.destination); master.gain.value = muted ? 0 : 1;
  musicGain = AC.createGain(); musicGain.gain.value = 0.45; musicGain.connect(master);
  sfxGain = AC.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  for (const k in BUF) { const ab = BUF[k]; AC.decodeAudioData(ab.slice(0)).then(b => SND[k] = b).catch(() => {}); }
}
function sfx(key, vol = 1, rate = 1) {
  if (!AC || !SND[key]) return null;
  if (match.demo && screen !== 'match' && key !== 'click') return null;
  const s = AC.createBufferSource(); s.buffer = SND[key]; s.playbackRate.value = rate;
  const g = AC.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxGain); s.start(); return s;
}
let musicNode = null, musicKey = null, crowdNode = null;
function music(key) {
  if (!AC) return; if (musicGain && key === 'menu') musicGain.gain.value = 0.45;
  if (musicKey === key) return;
  if (musicNode) { try { musicNode.stop(); } catch (e) {} musicNode = null; }
  musicKey = key; if (!key || !SND[key]) { if (key) setTimeout(() => { musicKey = null; music(key); }, 500); return; }
  const s = AC.createBufferSource(); s.buffer = SND[key]; s.loop = true; s.connect(musicGain); s.start(); musicNode = s;
}
function crowd(on) {
  if (!AC) return;
  if (on && !crowdNode && SND.crowd) {
    const s = AC.createBufferSource(); s.buffer = SND.crowd; s.loop = true; const g = AC.createGain(); g.gain.value = 0.35;
    s.connect(g); g.connect(sfxGain); s.start(); crowdNode = s;
  } else if (!on && crowdNode) { try { crowdNode.stop(); } catch (e) {} crowdNode = null; }
}
function setMuted(m) { muted = m; store.set('hl_muted', m); if (master) master.gain.value = m ? 0 : 1; }

/* ---------------- tinting helpers ---------------- */
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function tinted(img, hex, base = [242, 206, 176]) {
  // multiply-tint so that "base" colour maps to hex
  if (!img) return null;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, t = hex2rgb(hex);
  const f = [t[0] / base[0], t[1] / base[1], t[2] / base[2]];
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
    if (lum < 70) continue; // keep outlines
    p[i] = Math.min(255, p[i] * f[0]); p[i + 1] = Math.min(255, p[i + 1] * f[1]); p[i + 2] = Math.min(255, p[i + 2] * f[2]);
  }
  x.putImageData(d, 0, 0); return c;
}
function sockTint(img, hex, skin) {
  // white sock -> team colour, peach knee -> player skin, keep boot (dark) and outline
  if (!img) return null;
  const sk = skin ? hex2rgb(skin) : null, base = [242, 206, 176];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, t = hex2rgb(hex);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 150 && mx - mn < 40) { const k = mx / 255; p[i] = t[0] * k; p[i + 1] = t[1] * k; p[i + 2] = t[2] * k; }
    else if (sk && r > g && g > b && r - b > 35 && r > 120) { p[i] = Math.min(255, r * sk[0] / base[0]); p[i + 1] = Math.min(255, g * sk[1] / base[1]); p[i + 2] = Math.min(255, b * sk[2] / base[2]); }
  }
  x.putImageData(d, 0, 0); return c;
}

/* ---------------- team ratings ---------------- */
const RATING = { ARG: 92, FRA: 92, ESP: 91, ENG: 90, BRA: 90, POR: 89, GER: 88, NED: 87, BEL: 85, CRO: 84, URU: 84, COL: 83, MAR: 83, SUI: 80, USA: 80, MEX: 80, JPN: 81, SEN: 80, NOR: 80, AUT: 79, KOR: 78, ECU: 79, TUR: 78, SWE: 78, CZE: 76, SCO: 75, IRN: 76, AUS: 75, CAN: 76, PAR: 76, ALG: 75, EGY: 75, CIV: 76, TUN: 73, BIH: 73, KSA: 71, QAT: 71, GHA: 74, RSA: 72, UZB: 72, COD: 73, IRQ: 70, JOR: 70, PAN: 71, CPV: 70, NZL: 68, HAI: 66, CUW: 67 };
const FLAG_IDX = {}; (typeof WORLD_ROWS !== 'undefined' ? WORLD_ROWS : []).forEach((r, i) => FLAG_IDX[r[0]] = i);
const flagTag = (c, cls = '') => { const i = FLAG_IDX[c] ?? 0; return `<i class="fs ${cls}" style="background-position:${(i % 15) * 100 / 14}% ${Math.floor(i / 15) * 100 / 13}%"></i>`; };
const WORLD_BY = {};   // every other FIFA nation (Full World Cup mode), filled by world.js
const byCode = c => TEAMS.find(t => t.code === c) || WORLD_BY[c];
window.HL_byCode = byCode;

/* ---------------- per-team visual cache ---------------- */
const VIS = {};
function teamVis(code) {
  if (VIS[code]) return VIS[code];
  const t = byCode(code), pl = PLAYERS[code];
  const v = {
    head: IMG['head_' + code], kit: IMG['kit_' + code], badge: IMG['badge_' + code],
    arm: tinted(IMG.arm, pl.skin), thigh: tinted(IMG.thigh, pl.skin), shin: sockTint(IMG.shin, t.primary === '#FFFFFF' ? t.secondary : t.primary, pl.skin),
    hand: tinted(IMG.hand, pl.skin)
  };
  const dark = c => { if (!c) return null; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.filter = 'brightness(0.8)'; x.drawImage(c, 0, 0); return o; };
  v.armD = dark(v.arm); v.thighD = dark(v.thigh); v.shinD = dark(v.shin);
  VIS[code] = v; return v;
}

/* ---------------- input ---------------- */
const keys = {}, pressed = {};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true; keys[e.code] = true; initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const touch = { left: false, right: false, jump: false, kick: false, power: false };
const touchPressed = {};
function controlsP1(solo) {
  return {
    left: keys.KeyA || (solo && keys.ArrowLeft) || touch.left,
    right: keys.KeyD || (solo && keys.ArrowRight) || touch.right,
    jump: keys.KeyW || (solo && keys.ArrowUp) || touch.jump,
    kickP: pressed.Space || pressed.KeyS || (solo && pressed.KeyX) || touchPressed.kick,
    powerP: pressed.KeyE || pressed.ShiftLeft || (solo && pressed.KeyC) || touchPressed.power,
  };
}
function controlsP2() {
  return { left: keys.ArrowLeft, right: keys.ArrowRight, jump: keys.ArrowUp, kickP: pressed.ArrowDown || pressed.Enter || pressed.KeyL, powerP: pressed.ShiftRight || pressed.KeyK };
}

/* ---------------- particles & fx ---------------- */
let parts = [], shake = 0, flash = 0, slowmo = 0, hitstop = 0, pops = [];
const popCd = {};
// floating comic-style callouts in world space ("HEADER!", "OFF THE BAR!")
function callout(text, x, y, col = '#ffd23a', size = 34, key = text, cd = 2.2) {
  const now = performance.now() / 1000; if (popCd[key] && now - popCd[key] < cd) return; popCd[key] = now;
  pops.push({ text, x: clamp(x, 120, W - 120), y: clamp(y, 90, GROUND - 60), col, size, t: 0, max: 1.05, rot: (Math.random() - 0.5) * 0.18 });
  if (pops.length > 4) pops.shift();
}
function ring(x, y, col = '255,255,255', r1 = 70, life = 0.28, w = 6) { parts.push({ x, y, vx: 0, vy: 0, life, max: life, ring: true, r1, col: `rgba(${col},`, size: w }); }
function impact(power) { hitstop = Math.max(hitstop, power); }
function burst(x, y, n, col, spd = 300, life = 0.6, size = 6) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life, max: life, col, size: size * (0.5 + Math.random()) }); }
}
function dust(x, n = 6) { for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 30, y: GROUND - 2, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, life: 0.45, max: 0.45, col: 'rgba(210,200,160,', size: 5 + Math.random() * 6, dust: true }); }

/* ---------------- ball ---------------- */
const ball = { x: W / 2, y: 200, vx: 0, vy: 0, rot: 0, power: 0, powerBy: null, trail: [], lastTouch: null, frozen: 0 };

/* ---------------- player ---------------- */
const P_SPEED = 360, P_JUMP = 860, P_GRAV = 2350, HEAD_R = 47;
const RIG = { thigh: 28, shin: 38, kitH: 84, kitNeck: 0.05, headH: 116, headUp: 46, arm: 40 };
class Player {
  constructor(side, code, human, ctl) {
    this.side = side; this.dir = side === 0 ? 1 : -1; this.code = code; this.human = human; this.ctl = ctl;
    this.reset();
    this.meter = 0; this.charged = 0; this.goals = 0;
  }
  reset() {
    this.x = this.side === 0 ? 340 : W - 340; this.y = GROUND; this.vx = 0; this.vy = 0; this.onGround = true;
    this.hold = 0; this.kickT = -1; this.anim = 0; this.runPhase = 0; this.stun = 0; this.cele = 0; this.sad = 0; this.powerAnim = -1; this.kicked = false; this.squash = 0;
  }
  get headY() { return this._hy || (this.y - BODY_H - RIG.headH * 0.44); }
  get headX() { return this._hx || (this.x + this.dir * 3); }
  footPos() {
    // front foot world pos from current kick pose
    const k = this.kickAngle();
    const hipX = this.x + this.dir * 14, hipY = this.y - (RIG.thigh + RIG.shin);
    const a = k.thigh, b = -k.shin;
    const kx = hipX + Math.sin(a) * RIG.thigh * this.dir, ky = hipY + Math.cos(a) * RIG.thigh;
    const fx = kx + Math.sin(a + b) * RIG.shin * this.dir, fy = ky + Math.cos(a + b) * RIG.shin;
    return { x: fx, y: fy };
  }
  kickAngle() {
    if (this.kickT < 0) return { thigh: 0, shin: 0 };
    const t = this.kickT / 0.32;
    if (t < 0.3) { const u = t / 0.3; return { thigh: -0.6 * u, shin: 0.9 * u }; }           // wind-up (leg back)
    if (t < 0.6) { const u = (t - 0.3) / 0.3; return { thigh: -0.6 + 2.3 * u, shin: 0.9 - 0.9 * u }; } // swing through
    const u = (t - 0.6) / 0.4; return { thigh: 1.7 * (1 - u), shin: 0 };
  }
  update(dt, c) {
    this.anim += dt;
    if (this.stun > 0) { this.stun -= dt; c = { left: 0, right: 0, jump: 0, kickP: 0, powerP: 0 }; }
    const fx = this.fx || {};
    if (fx.frozen > 0) { c = { left: 0, right: 0, jump: 0, kickP: 0, powerP: 0 }; if (this.onGround) this.vx *= 0.5; }
    if (this.hold > 0) { if (match.state === 'play') this.hold -= dt; c = { left: 0, right: 0, jump: 0, kickP: 0, powerP: 0 }; }
    if (match.state !== 'play') c = { left: 0, right: 0, jump: 0, kickP: 0, powerP: 0 };
    let ax = 0; if (c.left) ax -= 1; if (c.right) ax += 1;
    const target = ax * P_SPEED * (this.human ? 1 : (AI_LVL[match.difficulty ?? 1] || AI_LVL[1]).speed) * (fx.speed > 0 ? 1.38 : 1);
    if (fx.speed > 0 && Math.abs(this.vx) > 120 && Math.random() < 0.7) parts.push({ x: this.x - Math.sign(this.vx) * 20, y: this.y - 10 - Math.random() * 60, vx: -this.vx * 0.2, vy: -30, life: 0.35, max: 0.35, col: 'rgba(80,230,255,', size: 6 + Math.random() * 5, glow: true });
    if (!(this.bounceT > 0)) this.vx += (target - this.vx) * Math.min(1, dt * (this.onGround ? 14 : 6));
    // forgiving inputs: coyote time after leaving the ground, short-hop on early release, buffered kicks
    this.offT = this.onGround ? 0 : (this.offT || 0) + dt;
    const jumpNow = c.jump && !this.jumpLock;
    if (jumpNow && (this.onGround || this.offT < 0.08)) {
      const boost = this.fx && this.fx.speed > 0 ? 1.12 : 1;
      this.vy = -P_JUMP * boost; this.onGround = false; this.offT = 9; this.jumpHeld = true; dust(this.x, 8); sfx('jump', 0.5, 1 + Math.random() * 0.1);
    }
    if (this.human && this.jumpHeld && !c.jump && this.vy < -320) { this.vy *= 0.55; this.jumpHeld = false; }
    if (!c.jump || this.onGround) this.jumpHeld = this.jumpHeld && !!c.jump;
    if (c.kickP && this.kickT >= 0 && this.kickT > 0.12) this.kBuf = 0.16;
    if (this.kBuf > 0) this.kBuf -= dt;
    if ((c.kickP || (this.kBuf > 0 && this.kickT < 0)) && this.kickT < 0) {
      this.kBuf = 0;
      if (match.state === 'play') STATS.kickPress[this.side]++; this.kickT = 0; this.kicked = false; sfx('whoosh', 0.35, 1.1 + Math.random() * 0.2);
      // overhead kick: in the air with the ball up around (or over) our head
      const bx = (ball.x - this.x) * this.dir;
      this.bike = !this.onGround && ball.y < this.y - 150 && ball.y > this.y - 330 && bx > -70 && bx < 110;
      if (this.bike) { this.vy = Math.min(this.vy, -300); }
    }
    if (c.powerP && this.meter >= 1 && this.charged <= 0) { this.charged = 4; this.meter = 0; this.powerAnim = 0; sfx('charge', 0.8); burst(this.x, this.y - 120, 30, 'rgba(255,190,40,', 380, 0.7, 7); shake = 6; }
    if (this.charged > 0) { this.charged -= dt; if (Math.random() < 0.6) parts.push({ x: this.x + (Math.random() - 0.5) * 60, y: this.y - Math.random() * 200, vx: 0, vy: -160, life: 0.5, max: 0.5, col: 'rgba(255,170,30,', size: 5 + Math.random() * 5, glow: true }); }
    if (this.powerAnim >= 0) { this.powerAnim += dt; if (this.powerAnim > 0.6) this.powerAnim = -1; }
    if (this.kickT >= 0) { this.kickT += dt; if (this.kickT > (this.bike ? 0.42 : 0.32)) { this.kickT = -1; this.bike = false; } }
    this.vy += P_GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y >= GROUND) { if (!this.onGround && this.vy > 400) { dust(this.x, 6); this.squash = 0.18; } this.y = GROUND; this.vy = 0; this.onGround = true; }
    this.squash = Math.max(0, this.squash - dt);
    // walls: can step into goal mouth but not past back net
    // players stay on the pitch side of each goal line (no getting trapped under the crossbar)
    const minX = GOAL_W + 26, maxX = W - GOAL_W - 26;
    if (this.x < minX) { this.x = minX; if (this.vx < 0) this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; if (this.vx > 0) this.vx = 0; }
    if (this.onGround && Math.abs(this.vx) > 30) this.runPhase += dt * Math.abs(this.vx) / 34;
    else this.runPhase *= 0.9;
    if (this.cele > 0) this.cele -= dt; if (this.sad > 0) this.sad -= dt;
  }
}

/* ---------------- AI ---------------- */
// Ball flight predictor (same gravity/bounce rules as physics). Returns samples every 1/30 s.
function predictBall(T = 1.6) {
  const out = []; let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy, h = 1 / 30;
  const g = ball.power > 0 ? 0 : 1750;
  for (let t = h; t <= T; t += h) {
    vy += g * h; x += vx * h; y += vy * h; vx *= (1 - 0.12 * h);
    if (y > GROUND - BALL_R) { y = GROUND - BALL_R; vy = -vy * 0.52; vx *= 0.96; if (Math.abs(vy) < 150) vy = 0; }
    if (y >= GROUND - BALL_R - 0.5 && vy === 0) vx *= (1 - 1.25 * WFRIC() * h);
    if (y < BALL_R + 4) { y = BALL_R + 4; vy = Math.abs(vy) * 0.6; }
    if (x < BALL_R) { x = BALL_R; vx = Math.abs(vx) * 0.5; } if (x > W - BALL_R) { x = W - BALL_R; vx = -Math.abs(vx) * 0.5; }
    out.push({ t, x, y, vx, vy });
  }
  return out;
}
const AI_LVL = [
  { react: 0.36, err: 90, speed: 0.86, jump: 0.4, read: 0.5, power: 0.2, lob: 0.2, think: 0.55, miss: 0.35 },  // easy
  { react: 0.16, err: 32, speed: 1.0, jump: 0.8, read: 1.0, power: 0.6, lob: 0.6, think: 0.25, miss: 0.12 },    // normal
  { react: 0.04, err: 8, speed: 1.05, jump: 1.0, read: 1.3, power: 1.0, lob: 0.9, think: 0.1, miss: 0 },    // hard
];
function aiControl(p, opp, dt) {
  const L = AI_LVL[match.difficulty ?? 1];
  const c = { left: 0, right: 0, jump: 0, kickP: 0, powerP: 0 };
  const ai = p.ai || (p.ai = { mode: 'attack', decide: 0, stuck: 0, backT: 0, backDir: 0, tx: p.x, lastX: p.x, shot: null, hold: 0 });
  const dir = p.dir;                                   // we attack towards +dir
  const myGoal = dir > 0 ? 0 : W, oppGoal = dir > 0 ? W : 0;
  const ahead = v => v * dir;                          // signed distance in attacking direction
  const pred = predictBall(1.6);
  ai.decide -= dt;

  // ---- reachable interception point: earliest predicted ball we can meet at foot/body/head height ----
  let inter = null;
  for (const s of pred) {
    if (s.t < L.react * 0.6) continue;
    const standX = s.x - dir * 34;                      // stand just behind the ball, facing goal
    const runT = Math.abs(standX - p.x) / (P_SPEED * L.speed);
    const low = s.y > GROUND - 150, head = s.y > GROUND - 330 && s.y < GROUND - 170;
    if ((low || head) && runT <= s.t + 0.05) { inter = { ...s, standX, head }; break; }
  }
  if (!inter) { const s = pred[pred.length - 1]; inter = { ...s, standX: s.x - dir * 34, head: false }; }

  // ---- situation ----
  const ballSide = ahead(ball.x - p.x);                // >0 ball in front of us
  const oppSide = ahead(opp.x - p.x);
  const ballToMyGoal = Math.abs(ball.x - myGoal);
  const comingAtUs = ahead(ball.vx) < -180;
  const oppCloser = Math.abs(opp.x - ball.x) + 30 < Math.abs(p.x - ball.x);
  const danger = (comingAtUs && ballToMyGoal < 700) || (ballToMyGoal < 360 && ahead(opp.x - ball.x) < 0) || (oppCloser && ballToMyGoal < W * 0.55);
  const oppBlocking = oppSide > 0 && oppSide < 190 && Math.abs(opp.y - p.y) < 60;
  const oppHasBall = Math.abs(opp.x - ball.x) < 70 && ball.y > GROUND - 160 && Math.abs(opp.x - ball.x) < Math.abs(p.x - ball.x);

  // ---- stuck detection: pushing into the opponent without making progress ----
  const moved = Math.abs(p.x - ai.lastX); ai.lastX = p.x;
  const touching = Math.abs(opp.x - p.x) < 78 && Math.abs(opp.y - p.y) < 80;
  if (touching && moved < 1.5 && p.onGround) ai.stuck += dt * (Math.abs(ball.x - p.x) > 200 ? 2 : 1); else ai.stuck = Math.max(0, ai.stuck - dt * 2);

  if (ai.decide <= 0) {
    ai.decide = L.think * (0.7 + Math.random() * 0.6);
    // choose a mode
    if (ai.stuck > 0.22 + L.react) {
      // break the deadlock: back off, hop over, or poke the ball
      const r = Math.random();
      const wantX = ai.tx, oppInWay = (opp.x - p.x) * (wantX - p.x) > 0 && Math.abs(wantX - p.x) > Math.abs(opp.x - p.x);
      const roomBehind = dir > 0 ? p.x - 70 > GOAL_W + 40 : p.x + 70 < W - GOAL_W - 40;
      if (oppInWay && (ballSide < 0 || !roomBehind)) ai.mode = 'hop';
      else if (ballSide > -10 && ballSide < 60 && ball.y > GROUND - 120 && r < 0.4) ai.mode = 'poke';
      else if (!roomBehind) ai.mode = 'hop';
      else if (r < 0.75) { ai.mode = 'backoff'; ai.backT = 0.28 + Math.random() * 0.25; }
      else ai.mode = 'hop';
      ai.stuck = 0;
    } else if (ai.mode === 'backoff' && ai.backT > 0) {
      // keep backing off
    } else if (danger || (oppHasBall && ahead(opp.x - p.x) < 0)) ai.mode = 'defend';
    else if (oppHasBall) ai.mode = 'press';
    else ai.mode = 'attack';
  }
  if (ai.backT > 0) ai.backT -= dt; else if (ai.mode === 'backoff') ai.mode = 'attack';

  // ---- targets per mode ----
  let tx = p.x;
  const err = (Math.sin(performance.now() / 700 + p.side * 3) * L.err) * 0.5;
  if (ai.mode === 'attack') {
    tx = inter.standX + err * 0.3;
    // ball behind us: go round it (approach from the goal side, never through it)
    if (ballSide < -20) tx = ball.x - dir * 70;
    // ball dropping onto/over our head: plant and head it forward instead of carrying it back under us
    if (ball.y < p.y - 170 && Math.abs(ball.x - p.x) < 110 && ballSide < 30) { tx = ball.x + ahead(ball.vx) * 0; tx = ball.x - dir * 10; if (ahead(ball.vx) < -150) tx = ball.x + (ball.vx > 0 ? 1 : -1) * 60; }
  } else if (ai.mode === 'defend') {
    // stand between the ball and our goal, a step off the line; meet it early if we can get there first
    const line = myGoal + dir * (GOAL_W + 34);
    const cover = ball.x - dir * 90;
    tx = ahead(cover - line) > 0 ? cover : line;
    if (ahead(inter.standX - p.x) > -40 && inter.t < 0.6) tx = inter.standX;
  } else if (ai.mode === 'press') {
    // jockey: stay goal-side about a body-length off the carrier and wait for the touch, don't crowd
    const gap = 95 + (1 - L.read) * 30;
    tx = ball.x - dir * gap;
    if (opp.kickT >= 0 || Math.abs(opp.x - ball.x) > 90) tx = inter.standX;   // ball released: go and win it
  } else if (ai.mode === 'backoff') {
    tx = p.x - dir * 160;
  } else if (ai.mode === 'hop' || ai.mode === 'poke') {
    tx = ball.x - dir * 20;
  }
  // don't run back through the ball towards our own net
  const goingBack = ahead(tx - p.x) < 0;
  if (goingBack && ballSide < 0 && ballSide > -120 && ball.y > GROUND - 140 && p.onGround) {
    const oppFarSide = (opp.x - p.x) * (ball.x - p.x) < 0;              // they'd have to get past us first
    const safeHop = Math.abs(ball.vx) < 160 && ball.y > GROUND - 60 && (Math.abs(opp.x - ball.x) > 300 || (oppFarSide && ai.stuck > 0.5));
    if (p.onGround && safeHop) c.jump = 1;                              // hop over the loose ball and come back goal-side
    else if (ahead(ball.vx) < -40 && p.onGround && Math.abs(opp.x - p.x) > 90) c.jump = 1;   // it's drifting to our net: must get round it
    else if (Math.abs(opp.x - p.x) < 85 && ai.stuck > 0.25) c.jump = 1;  // they're leaning on us: go over the ball and come back goal-side
    else tx = p.x;                                                       // shield: they have to get past us to reach it
  }
  // grab a floating power-up when the ball's far away and nothing's on
  if (pu.items.length && (ai.mode === 'attack' || ai.mode === 'press') && Math.abs(ball.x - p.x) > 260 && !danger && L.read >= 0.9) {
    const it = pu.items[0];
    if (Math.abs(it.x - p.x) < 300 && Math.abs(it.x - ball.x) > 200) { tx = it.x; if (Math.abs(it.x - p.x) < 50 && p.onGround && it.y > p.y - 400) c.jump = 1; }
  }
  tx = clamp(tx, GOAL_W + 28, W - GOAL_W - 28); ai.tx = tx;
  const dz = 10 + (1 - L.read) * 14;
  if (tx < p.x - dz) c.left = 1; else if (tx > p.x + dz) c.right = 1;

  // ---- jumping: headers, blocks, hops ----
  if (p.onGround && Math.random() < L.jump) {
    // block or head a ball that will pass at head height
    for (const s of pred) {
      if (s.t > 0.55) break;
      if (Math.abs(s.x - p.headX) < 40) {
        const above = p.y - s.y;
        if (above > 215 && above < 380 && s.t > 0.12 && s.t < 0.38) { c.jump = 1; break; }
        break;
      }
    }
    // attacking header: dropping ball, we're behind it with the goal in front
    if (ai.mode === 'attack' && inter.head && Math.abs(inter.standX - p.x) < 40 && inter.t < 0.35 && inter.t > 0.15) c.jump = 1;
  }
  const lowThreat = pred.some(q => q.t < 0.55 && Math.abs(q.x - p.x) < 50 && q.y > p.y - 150) && ahead(ball.vx) < -120;
  if (lowThreat || (danger && ball.y > GROUND - 150 && Math.abs(ball.x - p.x) < 260)) c.jump = 0;
  if (ai.mode === 'hop') { if (p.onGround && !lowThreat) c.jump = 1; const hx = ball.x > p.x ? 1 : -1; c.left = hx < 0 ? 1 : 0; c.right = hx > 0 ? 1 : 0; if (!p.onGround && p.vy > 0) ai.mode = 'attack'; }

  // ---- tackle: ball wedged between us or being dribbled into us -> scoop it over their head ----
  const wedged = touching && ballSide > -10 && ballSide < oppSide + 10 && ball.y > GROUND - 170;
  const dribbledAtUs = oppSide > 0 && oppSide < 160 && ballSide > 0 && ballSide < oppSide && ahead(opp.vx) < -60;
  if ((wedged || dribbledAtUs) && p.kickT < 0 && (ai.tackle = (ai.tackle || 0) + dt) > L.react * 0.8) {
    c.kickP = 1; p.kickType = 'lob'; ai.tackle = -0.35; ai.hold = 0.3;
    if (wedged && Math.random() < 0.3 * L.read) ai.mode = 'hop';
  }
  if (!(wedged || dribbledAtUs)) ai.tackle = Math.min(ai.tackle || 0, 0);
  // hold our ground against a dribbler instead of retreating
  if (dribbledAtUs && ai.mode !== 'backoff') { if (dir > 0) { c.right = 1; c.left = 0; } else { c.left = 1; c.right = 0; } }
  // never lean on the opponent without the ball in between: step off so they're free to play
  const ballBetween = (ball.x - p.x) * (opp.x - ball.x) > 0 && ball.y > GROUND - 200;
  if (touching && !ballBetween && !dribbledAtUs) {
    const intoOpp = (opp.x - p.x) > 0 ? c.right : c.left;
    if (intoOpp) { c.left = c.right = 0; if (Math.abs(ball.x - p.x) > 90) { if (ball.x > p.x) c.right = (opp.x < p.x) ? 1 : 0; else c.left = (opp.x > p.x) ? 1 : 0; } }
    if (Math.abs(ball.x - p.x) > 120 && (ball.x - p.x) * (opp.x - p.x) > 0 && p.onGround && Math.abs(opp.x - ball.x) > 160) c.jump = 1; // ball is past them: hop over
  }
  // ---- shooting ----
  const inReach = ballSide > -12 && ballSide < 92 && ball.y > p.y - 135 && Math.abs(ball.y - (p.y - 40)) < 120;
  if (inReach && p.kickT < 0 && (ai.hold -= dt) <= 0) {
    const distGoal = Math.abs(oppGoal - ball.x);
    let shoot = ai.mode !== 'backoff'; p.kickType = 'drive';
    if (ai.mode === 'poke' || ai.mode === 'press' || ai.mode === 'defend') { shoot = true; p.kickType = ball.y < GROUND - 60 ? 'drive' : (danger ? 'clear' : 'chip'); }
    else if (oppBlocking && Math.random() < L.lob) { shoot = true; p.kickType = oppSide < 110 ? 'lob' : 'chip'; }
    else if (distGoal < 520 || !oppBlocking) { shoot = true; p.kickType = distGoal > 760 ? 'chip' : 'drive'; }
    if (shoot && Math.random() < (L.miss || 0)) { shoot = false; ai.hold = 0.25; }   // dawdles on the ball now and then
    if (shoot) { c.kickP = 1; ai.hold = 0.12 + L.react; if (ai.mode === 'poke') ai.mode = 'attack'; }
  }
  // ---- overhead kick: airborne under a dropping ball with the goal ahead ----
  if (!p.onGround && p.kickT < 0 && ball.y < p.y - 160 && ball.y > p.y - 320 && ahead(ball.x - p.x) > -40 && ahead(ball.x - p.x) < 90 && Math.abs(oppGoal - p.x) < 820 && Math.random() < L.lob * dt * 6) c.kickP = 1;
  // ---- power shot: when we have a clear look or we're in range ----
  if (p.meter >= 1 && p.charged <= 0 && Math.random() < L.power * dt * 4) {
    const close = Math.abs(oppGoal - ball.x) < 700 && ballSide > -20 && ballSide < 220;
    if (close && (!oppBlocking || Math.random() < 0.4)) c.powerP = 1;
  }
  return c;
}

/* ---------------- match ---------------- */
const STATS = window.__STATS = { kickPress: [0, 0], kickHit: [0, 0], headers: [0, 0], bodyTouch: [0, 0], power: [0, 0], airT: 0, highT: 0, offTopT: 0, groundT: 0, cornerT: 0, closeT: 0, playT: 0, touches: [], fps: [] };
const match = { state: 'menu', time: MATCH_TIME, score: [0, 0], players: [], banner: null, bannerT: 0, golden: false, knockout: false, difficulty: 1, onEnd: null, kickoffT: 0, scorer: -1 };
function startMatch(opts) {
  if (window.FW_prep) FW_prep([opts.home, opts.away]);
  match.players = [new Player(0, opts.home, true, 'p1'), new Player(1, opts.away, !!opts.twoP, opts.twoP ? 'p2' : 'ai')];
  match.agg = opts.agg || null;   // two-legged ties: goals already banked [p1, p2]
  match.solo = !opts.twoP; match.tag = opts.tag || null;
  match.score = [0, 0]; match.banner = null; match.bannerT = 0; match.special = null; parts = []; shake = 0; flash = 0; slowmo = 0; match.time = opts.time || MATCH_TIME; match.total = match.time; match.halfDone = false; match.special = null; match.golden = false; match.knockout = !!opts.knockout; match.difficulty = opts.difficulty ?? 1;
  match.onEnd = opts.onEnd; match.label = opts.label || ''; match.demo = !!opts.demo;
  match.powerups = opts.powerups ?? (settings.powerups !== false); puReset(); wxP = []; match.replay = null; match.weather = opts.weather || pickWeather(opts.demo);
  teamVis(opts.home); teamVis(opts.away);
  if (opts.demo) { kickoff(-1); return; }
  kickoff(-1); match.state = 'intro'; match.introT = 2.4; ball.frozen = 99; screen = 'match'; music('match'); if (musicGain) musicGain.gain.value = 0.2; crowd(true);
  sfx('vo_kickoff', 0.9);
}
function kickoff(conceded) {
  for (const p of match.players) p.reset();
  pu.items = [];
  // the side that conceded (or a random side) starts with the ball at its feet; the other waits a beat
  const k = conceded === 0 || conceded === 1 ? conceded : (Math.random() < 0.5 ? 0 : 1), kp = match.players[k];
  ball.x = kp.x + kp.dir * 62; ball.y = GROUND - BALL_R; ball.vx = 0; ball.vy = 0; ball.power = 0; ball.trail = []; ball.frozen = 0.45; ball.idleT = 0;
  match.players[1 - k].hold = 0.8;
  match.state = 'kickoff'; match.kickoffT = 1.0; match.koT = match.simT || 0;
}
function setBanner(t, d, sub) { match.banner = t; match.bannerSub = sub || ''; match.bannerT = d; match.bannerMax = d; }
function goalScored(side) {
  (window.__goalLog = window.__goalLog || []).push({ since: +(match.simT - (match.koT || 0)).toFixed(1), from: ball.kickX | 0, how: ball.kickHow, side, lt: ball.lastTouch, pw: ball.power > 0 ? ball.ptype : '', vx: ball.vx | 0, t: match.time | 0, px: match.players.map(p => p.x | 0) });
  match.score[side]++; match.state = 'goal'; match.goalT = 1.4; match.scorer = side;
  const s = match.players[side], o = match.players[1 - side]; s.cele = 2.0; o.sad = 2.0;
  const far = Math.abs((side === 0 ? W - GOAL_W : GOAL_W) - (ball.kickX || W / 2));
  const how = ball.lastTouch !== side ? 'OWN GOAL!' : ball.lastHow === 'power' ? SPECIALS[ball.ptype || 'fire'].name : ball.lastHow === 'bicycle' ? 'BICYCLE KICK!' : ball.lastHow === 'header' ? 'WHAT A HEADER!' : ball.lastHow === 'volley' ? 'VOLLEY!' : (ball.lastHow === 'drive' && far > 640) ? 'SCREAMER!' : ball.lastHow === 'chip' || ball.lastHow === 'lob' ? 'CHIPPED IN!' : '';
  match.goalHow = how; s.goals = (s.goals || 0) + 1;
  const tag = s.goals === 3 ? 'HAT-TRICK!' : how;
  setBanner('GOAL!', 1.6, tag ? tag : byCode(s.code).name.toUpperCase());
  if (tag) impact(0.12);
  sfx('cheer', 1); setTimeout(() => sfx('vo_goal', 1), 250);
  shake = 14; flash = 0.5; slowmo = 0.5;
  burst(side === 0 ? W - 60 : 60, CROSSBAR + 120, 70, 'rgba(255,230,90,', 520, 1.1, 8);
  if (match.golden) { match.time = 0; }
}

/* collisions */
function circleHit(cx, cy, r, p, bounce = 1, addV = 1) {
  const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy), m = r + BALL_R;
  if (d < m && d > 0.01) {
    const nx = dx / d, ny = dy / d;
    ball.x = cx + nx * m; ball.y = cy + ny * m;
    const rvx = ball.vx - (p ? p.vx * addV : 0), rvy = ball.vy - (p ? p.vy * addV : 0);
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      ball.vx -= (1 + 0.62 * bounce) * vn * nx; ball.vy -= (1 + 0.62 * bounce) * vn * ny;
      if (p) { ball.vx += p.vx * 0.5; ball.vy += Math.min(0, p.vy) * 0.55 - 20; }
      return true;
    }
  }
  return false;
}
function segHit(x1, y1, x2, y2, r) {
  const vx = x2 - x1, vy = y2 - y1, t = Math.max(0, Math.min(1, ((ball.x - x1) * vx + (ball.y - y1) * vy) / (vx * vx + vy * vy)));
  const px = x1 + vx * t, py = y1 + vy * t; const dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy);
  if (d < BALL_R + r && d > 0.01) {
    const nx = dx / d, ny = dy / d; ball.x = px + nx * (BALL_R + r); ball.y = py + ny * (BALL_R + r);
    const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vy -= 1.7 * vn * ny; if (Math.abs(vn) > 300) sfx('post', 0.7); }
    return true;
  }
  return false;
}
function goalThreat() {
  // will the ball (as it moves now) cross either goal line under the bar within ~0.6s?
  let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
  for (let i = 0; i < 20; i++) {
    vy += (ball.power > 0 ? 0 : 1750) * 0.03; x += vx * 0.03; y += vy * 0.03;
    if (y > GROUND - BALL_R) { y = GROUND - BALL_R; vy = -vy * 0.5; }
    if (y > CROSSBAR + BALL_R && x < GOAL_W - 10) return 0;
    if (y > CROSSBAR + BALL_R && x > W - GOAL_W + 10) return 1;
  }
  return -1;
}
function touchBall(p) {
  if (match.state === 'play' && ball.lastTouch === 1 - p.side && ball.threat === p.side && ball.lastHow !== 'body' && Math.hypot(ball.vx, ball.vy) > 450) {
    callout(ball.power > 0 ? 'BLOCKED!' : 'WHAT A SAVE!', p.x, p.y - 300, '#7fd0ff', 38, 'save', 1.2); impact(0.05); shake = Math.max(shake, 6); sfx('cheer', 0.35, 1.2);
    STATS.saves = (STATS.saves || [0, 0]); STATS.saves[p.side]++;
  }
  ball.threat = -1;
  ball.lastTouch = p.side;
  const now = performance.now();
  if (!p._lt || now - p._lt > 350) p.meter = Math.min(1, p.meter + 0.035);
  p._lt = now;
  if (p.charged > 0) firePower(p);
}
const SPECIALS = { fire: { name: 'FIREBALL!', col: [255, 140, 30], spd: 1500 }, zig: { name: 'ZIG-ZAG!', col: [80, 255, 140], spd: 1050 }, thunder: { name: 'THUNDER STRIKE!', col: [120, 200, 255], spd: 1750 }, tornado: { name: 'TORNADO!', col: [210, 120, 255], spd: 1150 } };
const SPECIAL_KEYS = ['fire', 'zig', 'thunder', 'tornado'];
const specialOf = code => SPECIAL_KEYS[byCode(code).idx % 4];
function firePower(p) {
  STATS.power[p.side]++;
  p.charged = 0; p.powerAnim = 0;
  const type = specialOf(p.code), S = SPECIALS[type];
  const tx = p.side === 0 ? W - 30 : 30, ty = CROSSBAR + 110 + Math.random() * 80;
  const dx = tx - ball.x, dy = ty - ball.y, d = Math.hypot(dx, dy);
  ball.vx = dx / d * S.spd; ball.vy = dy / d * S.spd; ball.power = type === 'tornado' ? 1.6 : 1.3; ball.powerBy = p.side; ball.hitOnce = false; ball.ptype = type; ball.ptime = 0; ball.baseVy = ball.vy;
  if (type === 'tornado') { ball.vy = -900; }
  sfx('power', 1); sfx('vo_power', 0.9); shake = 12; flash = 0.25; slowmo = 0.18; impact(0.09); ring(ball.x, ball.y, S.col.join(','), 140, 0.4, 10); ball.lastHow = 'power'; camKick = 0.06;
  match.special = { name: S.name, t: 1.1, side: p.side };
  burst(ball.x, ball.y, 40, `rgba(${S.col.join(',')},`, 500, 0.6, 8);
}
/* ---------------- power-ups ---------------- */
const PU = {
  bighead: { name: 'BIG HEAD!', col: '#ffb43a', dur: 9 },
  speed:   { name: 'TURBO BOOTS!', col: '#3ee0ff', dur: 8 },
  freeze:  { name: 'FREEZE!', col: '#bff0ff', dur: 2.6 },
  mega:    { name: 'MEGA BALL!', col: '#ff6ad5', dur: 8 },
  meter:   { name: 'SUPER CHARGED!', col: '#ffe14a', dur: 0 },
  shrink:  { name: 'TINY GOALIE!', col: '#a6ff5a', dur: 8 },
};
const PU_KEYS = Object.keys(PU);
const pu = { items: [], next: 8, mega: 0 };
function puReset() { pu.items = []; pu.next = 7 + Math.random() * 4; pu.mega = 0; BALL_R = 21; }
function puOn() { return match.powerups && !match.demo && !match.golden; }
function grantPU(type, p) {
  const o = match.players[1 - p.side], d = PU[type];
  p.fx = p.fx || {}; o.fx = o.fx || {};
  if (type === 'bighead') p.fx.bighead = d.dur;
  else if (type === 'speed') p.fx.speed = d.dur;
  else if (type === 'freeze') { o.fx.frozen = d.dur; o.vx = 0; sfx('hit', 0.6, 1.6); }
  else if (type === 'mega') pu.mega = d.dur;
  else if (type === 'meter') { p.meter = 1; }
  else if (type === 'shrink') o.fx.tiny = d.dur;
  STATS.pu = (STATS.pu || 0) + 1;
  callout(d.name, (type === 'freeze' || type === 'shrink') ? o.x : p.x, p.y - 300, d.col, 38, 'pu', 0.2);
  sfx('charge', 0.7, 1.5); sfx('click', 0.8, 0.7);
}
function updatePU(dt) {
  const [a, b] = match.players;
  for (const p of [a, b]) { const f = p.fx || (p.fx = {}); for (const k in f) if (f[k] > 0) f[k] = Math.max(0, f[k] - dt); }
  if (pu.mega > 0) pu.mega = Math.max(0, pu.mega - dt);
  BALL_R += ((pu.mega > 0 ? 33 : 21) - BALL_R) * Math.min(1, dt * 6);
  if (!puOn() || match.state !== 'play') return;
  pu.next -= dt;
  if (pu.next <= 0 && pu.items.length < 1) {
    const type = PU_KEYS[Math.floor(Math.random() * PU_KEYS.length)];
    pu.items.push({ type, x: 360 + Math.random() * (W - 720), y: 290 + Math.random() * 120, t: 0, life: 12 });
    pu.next = 7 + Math.random() * 6; sfx('tick', 0.6, 0.7);
  }
  for (const it of pu.items) {
    it.t += dt; const iy = it.y + Math.sin(it.t * 2.6) * 12;
    let who = null;
    if (Math.hypot(ball.x - it.x, ball.y - iy) < BALL_R + 36) who = match.players[ball.lastTouch ?? (Math.abs(a.x - ball.x) < Math.abs(b.x - ball.x) ? 0 : 1)];
    for (const p of [a, b]) if (!who && Math.hypot(p.headX - it.x, p.headY - iy) < HEAD_R + 30) who = p;
    if (who) { it.dead = true; grantPU(it.type, who); burst(it.x, iy, 34, 'rgba(255,255,255,', 420, 0.6, 7); ring(it.x, iy, '255,255,255', 110, 0.35, 8); }
    if (it.t > it.life) it.dead = true;
  }
  pu.items = pu.items.filter(i => !i.dead);
}
function drawPUIcon(type, r) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (type === 'bighead') {
    ctx.fillStyle = '#ffd9b0'; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 2, r * 0.62, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a2a10'; ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.05, r * 0.09, 0, 7); ctx.arc(r * 0.22, -r * 0.05, r * 0.09, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.28, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (type === 'speed') {
    ctx.fillStyle = '#fff36a'; ctx.strokeStyle = '#6a4a00'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.75); ctx.lineTo(-r * 0.45, r * 0.1); ctx.lineTo(-r * 0.02, r * 0.1); ctx.lineTo(-r * 0.2, r * 0.75); ctx.lineTo(r * 0.45, -r * 0.12); ctx.lineTo(r * 0.04, -r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (type === 'freeze') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); ctx.lineTo(-Math.cos(a) * r * 0.62, -Math.sin(a) * r * 0.62); ctx.stroke(); }
    ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, cx = Math.cos(a) * r * 0.4, cy = Math.sin(a) * r * 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a + 0.9) * r * 0.16, cy + Math.sin(a + 0.9) * r * 0.16); ctx.lineTo(cx, cy); ctx.lineTo(cx + Math.cos(a - 0.9) * r * 0.16, cy + Math.sin(a - 0.9) * r * 0.16); ctx.stroke(); }
  } else if (type === 'mega') {
    if (IMG.ball) ctx.drawImage(IMG.ball, -r * 0.7, -r * 0.7, r * 1.4, r * 1.4); else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill(); }
    ctx.font = `${r * 0.55}px "Lilita One", sans-serif`; ctx.textAlign = 'center'; strokeText('XL', r * 0.42, r * 0.62, '#ff6ad5', 4);
  } else if (type === 'meter') {
    drawStar(0, 0, r * 0.68);
  } else if (type === 'shrink') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.12, -r * 0.12); ctx.moveTo(r * 0.55, r * 0.55); ctx.lineTo(r * 0.12, r * 0.12); ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(r * 0.12, -r * 0.12); ctx.moveTo(-r * 0.55, r * 0.55); ctx.lineTo(-r * 0.12, r * 0.12); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const [sx, sy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.08, sy * r * 0.08); ctx.lineTo(sx * r * 0.32, sy * r * 0.08); ctx.lineTo(sx * r * 0.08, sy * r * 0.32); ctx.fill(); }
  }
}
function drawPowerups() {
  for (const it of pu.items) {
    const iy = it.y + Math.sin(it.t * 2.6) * 12, k = Math.min(1, it.t / 0.35), r = 34 * easeOutBack(k) * (1 + Math.sin(it.t * 6) * 0.04);
    if (it.life - it.t < 2.5 && Math.floor(it.t * 8) % 2) continue;
    ctx.save(); ctx.translate(it.x, iy);
    const col = PU[it.type].col;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.25); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(10,20,60,0.85)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col + '44'; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#10172e'; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, 7); ctx.stroke();
    drawPUIcon(it.type, r);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.48, r * 0.22, r * 0.12, -0.6, 0, 7); ctx.fill();
    ctx.restore();
  }
}
function physics(dt, last = true) {
  const [a, b] = match.players; match.simT = (match.simT || 0) + dt; if (!ball.hitAt) ball.hitAt = [-9, -9];
  if (ball.frozen > 0) { ball.frozen -= dt; if (ball.frozen <= 0 && match.state === 'kickoff') { match.state = 'play'; } return; }
  const g = ball.power > 0 ? 0 : 1750;
  ball.vy += g * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  ball.rot += ball.vx * dt / BALL_R;
  if (ball.power > 0) {
    ball.ptime += dt;
    if (ball.ptype === 'zig') ball.vy = ball.baseVy * 0.3 + Math.cos(ball.ptime * 20) * 1100;
    if (ball.ptype === 'tornado') { ball.vy += 2600 * dt; if (ball.y > CROSSBAR + 150 && ball.vy > 0) ball.vy = 0; }
    if (ball.ptype === 'thunder' && Math.random() < 0.5) parts.push({ x: ball.x + (Math.random() - 0.5) * 40, y: ball.y + (Math.random() - 0.5) * 40, vx: 0, vy: 0, life: 0.15, max: 0.15, col: 'rgba(200,235,255,', size: 4, glow: true });
  }
  if (ball.power > 0) { ball.power -= dt; ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 16) ball.trail.shift(); if (ball.power <= 0) { ball.vx *= 0.6; ball.vy *= 0.6; } }
  else if (ball.trail.length) ball.trail.shift();
  // ground
  if (ball.y > GROUND - BALL_R) { ball.y = GROUND - BALL_R; if (ball.vy > 160) sfx('bounce', Math.min(0.6, ball.vy / 1400), 1); ball.vy = -ball.vy * 0.52; ball.vx *= 0.96; if (Math.abs(ball.vy) < 150) ball.vy = 0; if (ball.power > 0) { ball.vy = -Math.abs(ball.vy); } }
  if (ball.y < BALL_R + 4) { ball.y = BALL_R + 4; ball.vy = Math.abs(ball.vy) * 0.6; }
  ball.vx *= (1 - 0.12 * dt);
  if (ball.y >= GROUND - BALL_R - 0.5 && ball.vy === 0) ball.vx *= (1 - 1.25 * WFRIC() * dt); // rolling friction (slick in rain, sticky in snow)
  // goals: crossbar segments and back net
  for (const [x1, x2] of [[0, GOAL_W], [W - GOAL_W, W]]) {
    const sp0 = Math.hypot(ball.vx, ball.vy);
    if (segHit(x1, CROSSBAR, x2, CROSSBAR, 7) && sp0 > 520 && (ball.clangCd || 0) <= 0) {
      ball.clangCd = 0.4; impact(0.06); shake = Math.max(shake, 9); ring(ball.x, CROSSBAR, '255,240,170', 80);
      const nearMouth = Math.abs(ball.x - (x1 === 0 ? GOAL_W : W - GOAL_W)) < 40;
      callout(nearMouth ? 'OFF THE POST!' : 'OFF THE BAR!', ball.x, CROSSBAR - 60, '#ffe9a0', 36, 'bar');
      sfx('cheer', 0.25, 1.4);
    }
  }
  if (ball.clangCd > 0) ball.clangCd -= dt;
  // goal roofs slope towards the pitch: a ball resting on top rolls back into play
  const onRoof = ball.y < CROSSBAR && ball.y > CROSSBAR - BALL_R - 14 && Math.abs(ball.vy) < 220;
  if (onRoof && ball.x < GOAL_W + 4) ball.vx += 900 * dt;
  if (onRoof && ball.x > W - GOAL_W - 4) ball.vx -= 900 * dt;
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.5; }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.5; }
  // goal check
  if (match.state === 'play') {
    if (ball.x < GOAL_W - BALL_R - 6 && ball.y > CROSSBAR + BALL_R) goalScored(1);
    else if (ball.x > W - GOAL_W + BALL_R + 6 && ball.y > CROSSBAR + BALL_R) goalScored(0);
  }
  if (match.state !== 'play' && match.state !== 'kickoff') { if (ball.x < GOAL_W && ball.y > CROSSBAR) { ball.vx *= 0.9; } if (ball.x > W - GOAL_W && ball.y > CROSSBAR) ball.vx *= 0.9; }
  // players
  for (const p of [a, b]) {
    const o = p === a ? b : a;
    // powered ball flattens opponent
    if (ball.power > 0 && ball.powerBy !== p.side) {
      const d = Math.hypot(ball.x - p.headX, ball.y - p.headY);
      if (!ball.hitOnce && (d < HEAD_R + BALL_R + 10 || (Math.abs(ball.x - p.x) < 40 && ball.y > p.y - 110))) {
        ball.hitOnce = true; p.stun = 1.0; p.vx = Math.sign(ball.vx) * 380; p.vy = -340; p.onGround = false; sfx('hit', 1); shake = 10;
        // blocked! the defender soaks it up: the ball loses its power and pops back out
        ball.power = 0; ball.trail = []; ball.vx = -ball.vx * 0.3; ball.vy = -420; STATS.blocks = (STATS.blocks || 0) + 1;
        burst(p.headX, p.headY, 20, 'rgba(255,255,255,', 300, 0.5, 6);
      }
      continue;
    }
    if (ball.ghostT > 0 && (ball.ghostSide === p.side || ball.ghostSide === 2)) continue;
    // head
    const pf = p.fx || {}, ts = pf.tiny > 0 ? 0.68 : 1, hs = (pf.bighead > 0 ? 1.55 : 1) * ts;
    if (circleHit(p.headX, p.headY, HEAD_R * hs, p, 0.45, 0.4)) { const atk = p.side ? -1 : 1; if (p.vx * atk < 0) ball.vx -= p.vx * 0.42; ball.vx += atk * 110; ball.hitAt[p.side] = match.simT; STATS.headers[p.side]++; STATS.touches.push([match.simT, p.side, 'head']); ball.lastHow = 'header'; touchBall(p);
      if (!p.onGround && ball.vx * atk > 520) { impact(0.035); ring(ball.x, ball.y, '255,255,255', 55, 0.2, 4); if (Math.abs(ball.x - (atk > 0 ? W : 0)) < 640) callout('HEADER!', p.headX, p.headY - 110, '#fff', 30, 'head' + p.side, 4); } sfx('header', 0.6, 0.95 + Math.random() * 0.1); p.squash = 0.12; }
    // body (two circles)
    if (circleHit(p.x, p.y - 104 * ts, 30 * ts, p, 0.6, 0.6)) { ball.hitAt[p.side] = match.simT; touchBall(p); ball.lastHow = 'body'; }
    if (circleHit(p.x, p.y - 44 * ts, 24 * ts, p, 0.5, 0.6)) { ball.hitAt[p.side] = match.simT; touchBall(p); ball.lastHow = 'body'; }
    // kick
    if (p.kickT >= 0 && !p.kicked && p.bike) {
      const t = p.kickT / 0.42, cx = p.x + p.dir * 18, cy = p.y - 200;
      if (t > 0.2 && t < 0.75 && Math.hypot(ball.x - cx, ball.y - cy) < 120) {
        p.kicked = true; STATS.kickHit[p.side]++; ball.kickX = p.x; ball.kickHow = 'bicycle'; STATS.bike = (STATS.bike || 0) + 1;
        ball.vx = p.dir * 1080; ball.vy = 260; ball.lastHow = 'bicycle';
        touchBall(p); p.meter = Math.min(1, p.meter + 0.05);
        sfx('kick', 1, 0.8); impact(0.09); shake = Math.max(shake, 9); ring(ball.x, ball.y, '140,240,255', 110, 0.3, 8); burst(ball.x, ball.y, 24, 'rgba(160,240,255,', 360, 0.4, 6);
        callout('BICYCLE KICK!', p.x, p.y - 330, '#7ff0ff', 42, 'bike' + p.side, 1); sfx('cheer', 0.3, 1.3);
      }
    }
    if (p.kickT >= 0 && !p.kicked && !p.bike) {
      const f = p.footPos(); const t = p.kickT / 0.32;
      if (t > 0.14 && t < 0.82) {
        const d = Math.hypot(ball.x - f.x, ball.y - f.y);
        const box = (ball.x - p.x) * p.dir > -14 && (ball.x - p.x) * p.dir < 96 && ball.y > p.y - 165 && ball.y < GROUND;
        if ((d < BALL_R + 34 || box) && (ball.x - p.x) * p.dir > -24) {
          p.kicked = true; STATS.kickHit[p.side]++; ball.kickX = p.x; ball.kickHow = (p.kickType || 'drive') + (p.human ? '' : '-cpu'); STATS.touches.push([match.simT, p.side, 'kick']);
          if (p.human && !p.kickType && (o.x - p.x) * p.dir > 0 && (o.x - p.x) * p.dir < 150 && o.onGround && ball.y > GROUND - 120) p.kickType = 'chip';
          const up = ball.y > p.y - 50 ? 1 : 0.6, kt = p.kickType || 'drive'; p.kickType = null;
          ball.vx = p.dir * (780 + Math.abs(p.vx) * 0.4); ball.vy = -340 * up - (p.onGround ? 0 : 100);
          if (kt === 'lob') { ball.vx = p.dir * 430; ball.vy = -860; }          // scoop it over a blocker
          else if (kt === 'chip') { ball.vx = p.dir * 600; ball.vy = -640; }
          else if (kt === 'clear') { ball.vx = p.dir * 820; ball.vy = -640; }
          if (!p.onGround && ball.y < p.y - 60) { ball.vy = 180; ball.vx = p.dir * 980; } // volley downwards

          ball.y = Math.min(ball.y, GROUND - BALL_R - 1);
          touchBall(p); p.meter = Math.min(1, p.meter + 0.02);
          const ksp = Math.hypot(ball.vx, ball.vy);
          sfx('kick', 0.9, 0.9 + Math.random() * 0.2); burst(ball.x, ball.y, 10, 'rgba(255,255,255,', 200, 0.3, 4);
          ring(ball.x, ball.y, '255,255,255', 46 + ksp / 25, 0.22, 5);
          if (!p.onGround) { impact(0.07); shake = Math.max(shake, 7); }
          else if (ksp > 820) { impact(0.045); shake = Math.max(shake, 4); }
          ball.lastHow = p.onGround ? (kt === 'drive' ? 'drive' : kt) : (p.bike ? 'bicycle' : 'volley');
          if (p.bike) { callout('BICYCLE KICK!', p.x, p.y - 300, '#7ff0ff', 40, 'bike' + p.side, 1); sfx('power', 0.4, 1.5); }
          else if (!p.onGround) callout('VOLLEY!', p.x, p.y - 290, '#b6ff6a', 34, 'volley' + p.side, 3);
          // kick into opponent: knock him back (no stun)
        }
      }
      // kicking the opponent's leg/shin when nearby gives a small shove
      if (t > 0.3 && t < 0.6 && Math.abs(o.x - (p.x + p.dir * 50)) < 34 && Math.abs(o.y - p.y) < 40 && !o._shoved) { o.vx += p.dir * 260; o._shoved = 0.3; }
    }
    if (p._shoved) { p._shoved -= dt; if (p._shoved <= 0) p._shoved = 0; }
  }
  // ball squeezed between both players: it squirts up and out instead of wedging
  if (match.simT - ball.hitAt[0] < 0.12 && match.simT - ball.hitAt[1] < 0.12 && (ball.squeezeCd || 0) <= 0) {
    const sgn = Math.sign(b.x - a.x || 1), pa = a.vx * sgn, pb = -b.vx * sgn;   // how hard each pushes inwards
    ball.vy = -560 - Math.random() * 140; ball.vx = (pa > pb ? 1 : pb > pa ? -1 : (Math.random() < 0.5 ? 1 : -1)) * sgn * (180 + Math.random() * 160); ball.y -= 6; ball.squeezeCd = 0.4; ball.ghostT = 0.16; ball.ghostSide = 2;
    const sg = Math.sign(b.x - a.x || 1); a.vx = -sg * 260; b.vx = sg * 260; sfx('bounce', 0.5, 1.2);
  }
  if (ball.squeezeCd > 0) ball.squeezeCd -= dt;
  if (ball.ghostT > 0) ball.ghostT -= dt;
  // player-player: nobody can shove anybody. Whoever is moving into the other gets stopped;
  // if both are, they split the overlap. (The opponent can always be jumped over.)
  const dx = b.x - a.x;
  if (Math.abs(dx) < 64 && Math.abs(a.y - b.y) < 96) {
    const sg = Math.sign(dx || 1), over = 64 - Math.abs(dx);
    const aIn = a.vx * sg > 20, bIn = -b.vx * sg > 20;          // moving towards the other
    let fa = 0.5, fb = 0.5;
    if (aIn && !bIn) { fa = 1; fb = 0; } else if (bIn && !aIn) { fa = 0; fb = 1; }
    // never push someone through their goal line / the wall
    const minX = GOAL_W + 26, maxX = W - GOAL_W - 26;
    if ((sg > 0 && a.x - over * fa < minX) || (sg < 0 && a.x + over * fa > maxX)) { fb = 1; fa = 0; }
    if ((sg > 0 && b.x + over * fb > maxX) || (sg < 0 && b.x - over * fb < minX)) { fa = 1; fb = 0; }
    a.x -= over * fa * sg; b.x += over * fb * sg;
    if (aIn) a.vx = Math.min(Math.abs(a.vx), 40) * Math.sign(a.vx); if (bIn) b.vx = Math.min(Math.abs(b.vx), 40) * Math.sign(b.vx);
  }
  // stand on opponent's head
  // springboard: landing on the opponent's big head bounces you on over them, the way you were heading
  for (const [p, o] of [[a, b], [b, a]]) {
    if (p.vy > 0 && Math.abs(p.x - o.x) < 56 && p.y > o.y - 190 && p.y < o.y - 96) {
      const way = Math.abs(p.vx) > 60 ? Math.sign(p.vx) : (Math.abs(ball.x - p.x) > 20 ? Math.sign(ball.x - p.x) : (p.x >= o.x ? 1 : -1));
      p.y = o.y - 190; p.vy = -560; p.vx = way * 380; p.onGround = false; p.bounceT = 0.35; o.squash = 0.2;
      sfx('header', 0.5, 0.7); ring(o.headX, o.headY - 40, '255,255,255', 50, 0.2, 4);
      if (match.state === 'play') callout('HEAD BOUNCE!', o.headX, o.headY - 120, '#ffffff', 26, 'hb', 5);
    }
    if (p.bounceT > 0) { p.bounceT -= dt; }
  }
  // passive meter fill
  if (last) for (const p of [a, b]) { const behind = match.score[1 - p.side] - match.score[p.side]; p.meter = Math.min(1, p.meter + dt * 0.011 * (behind >= 2 ? 2.4 : behind === 1 ? 1.5 : 1)); }
  if (match.state === 'play' && last) {
    const fd = dt * (match._n || 1); STATS.playT += fd;
    if (ball.y < GROUND - 300) STATS.highT += fd; if (ball.y < 30) STATS.offTopT += fd; if (ball.y > GROUND - BALL_R - 4) STATS.groundT += fd; else STATS.airT += fd;
    if (ball.x < GOAL_W + 60 || ball.x > W - GOAL_W - 60) STATS.cornerT += fd;
    if (Math.abs(a.x - b.x) < 80) STATS.closeT += fd;
  }
  // dead-ball watchdog: if the ball sits still and untouched, drop it again
  if (match.state === 'play' && last) {
    if (Math.hypot(ball.vx, ball.vy) < 25 && match.simT - Math.max(ball.hitAt[0], ball.hitAt[1]) > 1) ball.idleT = (ball.idleT || 0) + dt; else ball.idleT = 0;
    if (ball.idleT > 4) { ball.idleT = 0; ball.x = W / 2; ball.y = 120; ball.vx = (Math.random() - 0.5) * 80; ball.vy = 0; window.__stallLog = (window.__stallLog || 0) + 1; setBanner('DROP BALL', 1); sfx('whistle', 0.6); }
  }
  // speed cap
  const sp = Math.hypot(ball.vx, ball.vy), cap = ball.power > 0 ? 1700 : 1350; if (sp > cap) { ball.vx *= cap / sp; ball.vy *= cap / sp; }
}

function updateMatch(dt) {
  if (match.state === 'replay') { updateReplay(dt); return; }
  const [a, b] = match.players;
  const c1 = (window.__AIBOTH || match.demo) ? aiControl(a, b, dt) : controlsP1(match.solo);
  const c2 = b.human ? controlsP2() : aiControl(b, a, dt);
  a.update(dt, c1); b.update(dt, c2);
  const sp = Math.hypot(ball.vx, ball.vy) * dt, n = Math.min(8, Math.max(1, Math.ceil(sp / 7)));
  match._n = n; for (let i = 0; i < n; i++) physics(dt / n, i === n - 1);
  updatePU(dt);
  if (match.state === 'play') ball.threat = goalThreat();
  STATS.wallT = (STATS.wallT || 0) + dt; STATS.goalT = (STATS.goalT || 0) + (match.state === 'goal' || match.state === 'kickoff' ? dt : 0);
  if (match.players[0].y < GROUND - 150 && Math.abs(match.players[0].x - match.players[1].x) < 60) STATS.headstand = (STATS.headstand || 0) + dt;
  if (match.state === 'kickoff') { match.kickoffT -= dt; }
  if (match.state === 'intro') { match.introT -= dt; if (match.introT <= 0) { kickoff(-1); setBanner('KICK OFF!', 1.2); sfx('whistle', 0.8); } }
  if (match.state === 'play') {
    if (!match.golden) {
      match.time -= dt * CLOCK_RATE;   // 90 on the clock, ~30 real seconds of play
      if (!match.halfDone && match.time <= match.total / 2) { match.halfDone = true; match.state = 'half'; match.halfT = 1.6; setBanner('HALF TIME', 1.5, `${match.players[0].code} ${match.score[0]} - ${match.score[1]} ${match.players[1].code}`); sfx('whistle_end', 0.8); sfx('vo_half', 0.9); for (const p of match.players) p.charged = 0; }
      if (match.time <= 30 && Math.floor((match.time + dt * CLOCK_RATE) / 3) !== Math.floor(match.time / 3) && match.time > 0) sfx('tick', 0.5);
      if (match.time <= 30 && match.time + dt * CLOCK_RATE > 30 && !match.demo) { setBanner('FINAL SECONDS!', 1.3, Math.abs(match.score[0] - match.score[1]) <= 1 ? 'ALL TO PLAY FOR' : ''); sfx('cheer', 0.4, 0.9); if (musicNode) musicNode.playbackRate.value = 1.08; }
      if (match.time <= 0) {
        match.time = 0;
        const ag = match.agg || [0, 0];
        if (match.knockout && match.score[0] + ag[0] === match.score[1] + ag[1]) { match.golden = true; match.goldenT = 0; setBanner('GOLDEN GOAL', 1.6, 'NEXT GOAL WINS'); sfx('vo_golden', 1); sfx('whistle', 0.8); kickoff(-1); }
        else endMatch();
      }
    } else match.goldenT += dt;
  }
  if (match.state === 'half') { match.halfT -= dt; if (match.halfT <= 0) { kickoff(1); sfx('whistle', 0.8); setBanner('SECOND HALF', 1.2); } }
  recordFrame();
  if (match.state === 'goal') {
    match.goalT -= dt;
    if (match.goalT <= 0) { if (!startReplay()) afterGoal(); }
  }
}
function afterGoal() { if (match.golden) endMatch(); else kickoff(match.scorer === 0 ? 1 : 0); }
/* ---------------- weather & lighting ---------------- */
const WEATHER = { day: { name: '', fric: 1 }, night: { name: 'NIGHT GAME', fric: 1 }, rain: { name: 'RAIN · SLICK PITCH', fric: 0.55 }, snow: { name: 'SNOW · HEAVY PITCH', fric: 1.9 }, sunset: { name: 'SUNSET', fric: 1 } };
function pickWeather(demo) { if (demo) return 'day'; const r = Math.random(); return r < 0.42 ? 'day' : r < 0.6 ? 'night' : r < 0.74 ? 'sunset' : r < 0.88 ? 'rain' : 'snow'; }
const WFRIC = () => (WEATHER[match.weather] || WEATHER.day).fric;
let wxP = [];
function drawWeather(dt, front) {
  const w = match.weather || 'day';
  if (!front) {
    // grade the stadium (players and ball are drawn on top, so they stay bright like they're under floodlights)
    if (w === 'night' || w === 'rain' || w === 'snow') {
      ctx.fillStyle = w === 'night' ? 'rgba(6,10,40,0.5)' : w === 'rain' ? 'rgba(18,26,48,0.5)' : 'rgba(170,190,220,0.18)'; ctx.fillRect(-60, -60, W + 120, GROUND + 20);
      if (w === 'night') {
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [150, W - 150]) { const g = ctx.createRadialGradient(lx, 40, 10, lx, 40, 520); g.addColorStop(0, 'rgba(255,250,220,0.32)'); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120); }
        const pg = ctx.createRadialGradient(W / 2, GROUND, 40, W / 2, GROUND, 700); pg.addColorStop(0, 'rgba(200,255,200,0.10)'); pg.addColorStop(1, 'rgba(200,255,200,0)'); ctx.fillStyle = pg; ctx.fillRect(-60, GROUND - 200, W + 120, 400);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (w === 'sunset') {
      ctx.globalCompositeOperation = 'multiply'; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffb080'); g.addColorStop(0.6, '#ffd2a6'); g.addColorStop(1, '#ffe8d0'); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120); ctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter'; const s2 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 500); s2.addColorStop(0, 'rgba(255,170,90,0.35)'); s2.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = s2; ctx.fillRect(-60, -60, W + 120, H + 120); ctx.globalCompositeOperation = 'source-over';
    }
    return;
  }
  if (w !== 'rain' && w !== 'snow') return;
  const want = w === 'rain' ? 260 : 120;
  while (wxP.length < want) wxP.push({ x: Math.random() * (W + 200) - 100, y: Math.random() * H - H, s: 0.5 + Math.random() });
  for (const q of wxP) {
    if (w === 'rain') { q.x -= 160 * dt * q.s; q.y += 1100 * dt * q.s; } else { q.x += Math.sin((q.y + q.s * 200) / 60) * 30 * dt; q.y += 70 * dt * q.s; }
    if (q.y > GROUND + 10) { if (w === 'rain' && Math.random() < 0.3) parts.push({ x: q.x, y: GROUND - 2, vx: (Math.random() - 0.5) * 60, vy: -60, life: 0.18, max: 0.18, col: 'rgba(200,220,255,', size: 2.5 }); q.y = -20 - Math.random() * 100; q.x = Math.random() * (W + 200) - 100; }
  }
  if (w === 'rain') { ctx.strokeStyle = 'rgba(205,222,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); for (const q of wxP) { ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 4 * q.s, q.y - 22 * q.s); } ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const q of wxP) { ctx.beginPath(); ctx.arc(q.x, q.y, 2 + q.s * 2, 0, 7); ctx.fill(); } }
}
/* ---------------- instant replay ---------------- */
const REC = [];
function snapPlayer(p) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, kickT: p.kickT, runPhase: p.runPhase, anim: p.anim, charged: p.charged, powerAnim: p.powerAnim, stun: p.stun, squash: p.squash, bike: p.bike, fx: { ...(p.fx || {}) }, code: p.code, side: p.side, dir: p.dir, human: p.human, ctl: p.ctl, cele: 0, sad: 0, meter: p.meter }; }
function recordFrame() {
  if (match.demo || window.__NOREPLAY) return;
  if (match.state === 'play' || (match.state === 'goal' && match.goalT > 0.9)) {
    REC.push({ t: match.simT, b: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, rot: ball.rot, power: ball.power, ptype: ball.ptype, trail: ball.power > 0 ? ball.trail.map(q => ({ ...q })) : [], R: BALL_R }, p: match.players.map(snapPlayer), goal: match.state === 'goal' });
    if (REC.length > 240) REC.shift();
  }
}
function startReplay() {
  if (match.demo || window.__NOREPLAY || REC.length < 30 || !match.goalHow || match.goalHow === 'OWN GOAL!') { REC.length = 0; return false; }
  const gi = REC.findIndex(f => f.goal); if (gi < 0) { REC.length = 0; return false; }
  const t0 = REC[gi].t - 1.9, i0 = Math.max(0, REC.findIndex(f => f.t >= t0));
  match.rp = { frames: REC.slice(i0), t: REC[i0].t, end: REC[REC.length - 1].t, goalT: REC[gi].t, flashed: false };
  REC.length = 0; match.state = 'replay'; parts = []; pops = [];
  window.__REPLAY = { on: true, camX: match.rp.frames[0].b.x };
  return true;
}
function replayFrame() { const r = match.rp; let f = r.frames[0]; for (const q of r.frames) { if (q.t > r.t) break; f = q; } return f; }
function updateReplay(dt) {
  const r = match.rp; r.t += dt * (r.t > r.goalT - 0.7 && r.t < r.goalT + 0.15 ? 0.32 : 0.6);
  const f = replayFrame(); window.__REPLAY.camX = f.b.x;
  if (!r.flashed && r.t >= r.goalT) { r.flashed = true; flash = 0.35; shake = 10; sfx('cheer', 0.5); }
  let skip = false; for (const k in pressed) if (pressed[k]) skip = true; for (const k in touchPressed) if (touchPressed[k]) skip = true;
  if (r.t >= r.end + 0.1 || skip) { match.state = 'goal'; window.__REPLAY = { on: false }; match.rp = null; afterGoal(); }
}
function drawReplay() {
  const f = replayFrame();
  const ps = f.p.map(q => Object.assign(Object.create(Player.prototype), q));
  drawPlayer(ps[1]); drawPlayer(ps[0]);
  const save = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, rot: ball.rot, power: ball.power, ptype: ball.ptype, trail: ball.trail }, R = BALL_R;
  Object.assign(ball, f.b); BALL_R = f.b.R; drawBall(); Object.assign(ball, save); BALL_R = R;
}
function drawReplayChrome() {
  const bar = 58;
  ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  const blink = Math.floor(performance.now() / 400) % 2;
  ctx.fillStyle = blink ? '#ff3b30' : '#7a1a14'; ctx.beginPath(); ctx.arc(48, bar / 2, 11, 0, 7); ctx.fill();
  ctx.font = '30px "Lilita One", sans-serif'; ctx.textAlign = 'left'; strokeText('REPLAY', 68, bar / 2 + 11, '#fff', 5);
  if (match.goalHow) { ctx.textAlign = 'center'; strokeText(match.goalHow, W / 2, bar / 2 + 11, '#ffd23a', 6); }
  ctx.font = '18px "Lilita One", sans-serif'; ctx.textAlign = 'right'; strokeText(isTouch ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP', W - 30, H - bar / 2 + 7, '#cfe0ff', 4);
}
function endMatch() {
  if (match.demo) { startDemo(); return; }
  match.state = 'end'; if (musicNode) musicNode.playbackRate.value = 1; sfx('whistle_end', 0.9); setTimeout(() => sfx('vo_fulltime', 0.9), 700); crowd(false);
  const [s0, s1] = match.score;
  const win = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;
  match.result = { win };
  setBanner('FULL TIME', 99, `${match.players[0].code} ${s0} - ${s1} ${match.players[1].code}`);
  if (win >= 0) { match.players[win].cele = 99; match.players[1 - win].sad = 99; }
  setTimeout(() => { if (screen === 'match') { music('menu'); match.onEnd && match.onEnd(s0, s1); } }, 2600);
}

/* ---------------- rendering: rig ---------------- */
function drawPart(img, px, py, x, y, ang, h, flip, wm = 1) {
  if (!img) return;
  const w = h * img.width / img.height * wm;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -px * w, -py * h, w, h); ctx.restore();
}
// kit-space anchors measured from the Higgsfield kit art (sleeve ends / shorts leg openings)
const BODY_H = 136;
const KIT_A = { shB: [0.075, 0.32], shF: [0.925, 0.32], hipB: [0.34, 0.90], hipF: [0.68, 0.90] };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function poseOf(p, menu) {
  // angles: + = toward facing direction. arms: 0 = hanging. legs: thigh/shin.
  const T = p.anim, P = { bob: 0, lean: 0, aF: 0.18, aB: -0.18, tF: 0, tB: 0, sF: 0, sB: 0, tilt: 0 };
  const still = menu || match.state !== 'play';
  const running = p.onGround && Math.abs(p.vx) > 40;
  if (running) {
    const ph = p.runPhase, s = Math.sin(ph), c = Math.cos(ph);
    P.tF = 0.62 * s; P.tB = -0.62 * s;
    P.sF = -(0.12 + 1.0 * Math.max(0, -c) ** 1.3); P.sB = -(0.12 + 1.0 * Math.max(0, c) ** 1.3);
    P.aF = 0.5 - 0.5 * s; P.aB = -0.5 - 0.5 * s;     // opposite to legs, kept on their own side
    P.bob = -Math.abs(Math.sin(ph)) * 5; P.lean = 0.08 * Math.sign(p.vx) * p.dir;
  } else if (p.onGround) {
    const b = Math.sin(T * 3.2); P.bob = b * 1.6; P.aF = 0.12 + b * 0.04; P.aB = -0.12 - b * 0.04; P.sF = -0.04; P.sB = -0.04;
  }
  if (!p.onGround) {
    const up = p.vy < 0;
    P.tF = up ? 0.75 : 0.35; P.sF = up ? -1.25 : -0.6; P.tB = up ? 0.1 : -0.15; P.sB = up ? -1.0 : -0.55;
    P.aF = up ? 1.5 : 1.0; P.aB = up ? -1.5 : -1.0;
  }
  if (p.kickT >= 0) {
    const k = p.kickAngle(); P.tF = k.thigh; P.sF = -k.shin; P.tB = -0.15 - 0.2 * Math.max(0, k.thigh);
    const sw = clamp((k.thigh + 0.6) / 2.3, 0, 1); P.aF = lerp(1.0, -0.2, sw); P.aB = lerp(-0.4, -1.3, sw);
    P.lean = -0.14 * clamp(k.thigh, 0, 1);
  }
  if (p.powerAnim >= 0) { const u = Math.sin(p.powerAnim / 0.6 * Math.PI); P.aF = 1.2 + 1.4 * u; P.aB = -1.2 - 1.4 * u; P.lean = -0.18 * u; }
  if (p.stun > 0) { P.lean = Math.sin(T * 20) * 0.12; P.aF = 1.1 + Math.sin(T * 14) * 0.3; P.aB = -1.1 + Math.sin(T * 14) * 0.3; P.tilt = Math.sin(T * 18) * 0.22; }
  if (p.cele > 0 && still) { const w = Math.sin(T * 12) * 0.25; P.aF = 2.6 + w; P.aB = -2.6 + w; P.bob = -Math.abs(Math.sin(T * 7)) * 20; if (P.bob < -4) { P.tF = 0.35; P.sF = -0.7; P.tB = -0.1; P.sB = -0.6; } }
  if (p.sad > 0 && still) { P.aF = 0.04; P.aB = -0.04; P.lean = 0.16; P.tilt = 0.22; }
  P.aF = clamp(P.aF, -0.08, 2.9); P.aB = clamp(P.aB, -2.9, 0.08);
  return P;
}
function drawPlayer(p, opt) {
  const menu = opt && opt.menu;
  const v = teamVis(p.code), t = byCode(p.code), d = p.dir, flip = d < 0;
  const T = p.anim, P = poseOf(p, menu);
  const sq = p.squash > 0 ? Math.sin(p.squash / 0.2 * Math.PI) * 0.08 : 0;
  const x = p.x, y = p.y + P.bob;
  // shadow
  const hgt = Math.max(0, GROUND - p.y);
  ctx.fillStyle = `rgba(0,0,0,${0.32 - Math.min(0.2, hgt / 1200)})`;
  ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 40 - Math.min(20, hgt / 20), 8, 0, 0, Math.PI * 2); ctx.fill();
  if (p.charged > 0) { const g = ctx.createRadialGradient(x, y - 110, 10, x, y - 110, 150); g.addColorStop(0, 'rgba(255,200,60,0.55)'); g.addColorStop(1, 'rgba(255,120,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 110, 150, 0, Math.PI * 2); ctx.fill(); }
  const pfx = (!menu && p.fx) || {}, tsc = pfx.tiny > 0 ? 0.68 : 1;
  ctx.save();
  ctx.translate(x, y); ctx.scale((1 + sq) * tsc, (1 - sq) * tsc); ctx.translate(-x, -y);
  // ---- full-body pose sprite (Higgsfield-drawn, recoloured per nation) ----
  const frames = v.body || (window.BODY && BODY.ready() ? (v.body = BODY.bodyFor(p.code)) : null);
  let pose = 0, rot = 0;
  const still = menu || match.state !== 'play';
  if (!p.onGround) pose = 4;
  else if (Math.abs(p.vx) > 40) pose = [1, 2, 3, 2][Math.floor(p.runPhase / (Math.PI / 2)) & 3];
  if (p.kickT >= 0) { const kt = p.kickT / 0.32; pose = kt < 0.3 ? 7 : kt < 0.85 ? 5 : 0; }
  if (p.powerAnim >= 0) pose = p.powerAnim < 0.3 ? 7 : 6;
  if (p.cele > 0 && still) pose = Math.sin(T * 7) < -0.2 ? 4 : 6;
  if (p.stun > 0) rot = Math.sin(T * 20) * 0.08;
  if (p.bike && p.kickT >= 0) { const u = clamp(p.kickT / 0.42, 0, 1), e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); pose = u < 0.25 ? 4 : 5; const cy = y - 110; ctx.translate(x, cy); ctx.rotate(-d * e * Math.PI * 2); ctx.translate(-x, -cy); }
  if (p.sad > 0 && still) rot = 0.06 * d;
  let neck = { x: x + d * 3, y: y - BODY_H }, hh = RIG.headH;
  if (frames) {
    const m = BODY.meta[pose], fr = frames[pose], S = BODY_H / BODY.meta[0].spanH;
    const nx = m.neckX, ny = m.neckY;
    const fw = fr.width * S, fh = fr.height * S;
    // anchor: feet on the ground line, neck horizontally over the player's x
    const left = flip ? (x + d * 3) + nx * S - fw : (x + d * 3) - nx * S;
    const top = y - m.feet * S;
    neck = { x: x + d * 3, y: top + ny * S };
    if (rot) { ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y); }
    hh = (RIG.headH + (p.cele > 0 && still ? Math.sin(T * 14) * 3 : 0)) * (pfx.bighead > 0 ? (pfx.bighead < 1 ? 1 + 0.55 * pfx.bighead : 1.55) : 1);
    const htilt = (P.tilt || 0) * d + (pose === 5 ? -0.08 * d : pose === 7 ? 0.1 * d : 0);
    ctx.save();
    if (flip) { ctx.translate(left + fw, top); ctx.scale(-1, 1); ctx.drawImage(fr, 0, 0, fw, fh); }
    else ctx.drawImage(fr, left, top, fw, fh);
    ctx.restore();
    // head after the body: its neck stub plugs the collar opening
    const ncy = neck.y + m.holeH * S * 0.35;
    if (v.head) drawPart(v.head, 0.5, 0.965, neck.x, ncy, htilt, hh, flip);
    p._hx = neck.x + Math.sin(htilt) * hh * 0.46; p._hy = ncy - Math.cos(htilt) * hh * 0.46;
  } else if (v.head) { drawPart(v.head, 0.5, 0.965, neck.x, neck.y + 6, 0, hh, flip); p._hx = neck.x; p._hy = neck.y - 48; }
  if (tsc !== 1) { p._hx = x + (p._hx - x) * tsc; p._hy = y + (p._hy - y) * tsc; }
  const hx = p._hx, hy = p._hy;
  ctx.restore();
  if (pfx.frozen > 0) {
    const top = Math.min(hy - 60 * tsc, y - 200 * tsc), w2 = 66 * tsc;
    ctx.save(); ctx.globalAlpha = Math.min(1, pfx.frozen * 3);
    const g = ctx.createLinearGradient(x - w2, top, x + w2, y); g.addColorStop(0, 'rgba(220,250,255,0.75)'); g.addColorStop(0.5, 'rgba(140,215,255,0.45)'); g.addColorStop(1, 'rgba(90,170,240,0.6)');
    ctx.fillStyle = g; roundRect(x - w2, top, w2 * 2, y - top + 6, 14); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - w2 + 14, top + 22); ctx.lineTo(x - w2 + 30, top + 60); ctx.moveTo(x + w2 - 22, top + 30); ctx.lineTo(x + w2 - 34, top + 48); ctx.stroke();
    ctx.restore();
  }
  const sadNow = p.sad > 0 && (menu || match.state !== 'play');
  if (v.head && (sadNow || (!menu && match.state === 'play' && match.score[1 - p.side] - match.score[p.side] >= 2))) {
    const ex = hx + d * 8, ey = hy + 9;
    for (let i = 0; i < (sadNow ? 3 : 1); i++) {
      const ph = ((T * (sadNow ? 1.6 : 0.6)) + i / 3) % 1;
      const dx = sadNow ? ex + d * 4 : hx - d * 6, dy = sadNow ? ey + ph * 46 : hy - 52 + ph * 26;
      ctx.globalAlpha = 1 - ph * 0.8; ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#1b4f86'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dx, dy - 9); ctx.quadraticCurveTo(dx + 6, dy, dx, dy + 5); ctx.quadraticCurveTo(dx - 6, dy, dx, dy - 9); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (p.stun > 0) { for (let i = 0; i < 3; i++) { const a = T * 6 + i * 2.1; drawStar(hx + Math.cos(a) * 46, hy - 66 + Math.sin(a) * 10, 9); } }
  if (!menu && (match.state === 'kickoff' || match.state === 'play' && match.time > match.total - 3 * CLOCK_RATE)) {
    ctx.font = '700 18px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    const lbl = p.human ? (p.ctl === 'p1' ? (match.tag || 'P1') : 'P2') : 'CPU';
    ctx.fillStyle = lbl === 'P1' ? '#3ee07a' : p.human ? '#4fb3ff' : '#ff5a4f';
    ctx.beginPath(); ctx.moveTo(hx - 8, hy - 86); ctx.lineTo(hx + 8, hy - 86); ctx.lineTo(hx, hy - 76); ctx.fill();
    strokeText(lbl, hx, hy - 92, '#fff');
  }
}
function drawLimb(v, hx, hy, thighA, shinA, d, flip, back) {
  const th = back ? v.thighD : v.thigh, sh = back ? v.shinD : v.shin;
  const kx = hx + Math.sin(thighA) * RIG.thigh * d, ky = hy + Math.cos(thighA) * RIG.thigh;
  if (sh) drawPart(sh, 0.42, 0.09, kx, ky - 1, -(thighA + shinA) * d, RIG.shin * 1.22, flip);
  if (th) drawPart(th, 0.5, 0.12, hx, hy, -thighA * d, RIG.thigh * 1.36, flip, 1.08); // thigh over shin: one clean knee
}
function drawArm(v, sx, sy, ang, d, flip, back) {
  const im = back ? v.armD : v.arm;
  if (im) drawPart(im, 0.5, 0.08, sx, sy, -ang * d, RIG.arm, flip, 1.35);
}
function drawStar(x, y, r) { ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
function strokeText(t, x, y, fill, sw = 5, stroke = '#10172e') { ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y); }

/* ---------------- rendering: world ---------------- */
function drawWorld(dt) {
  // stadium backdrop
  if (IMG.stadium) {
    const S = IMG.stadium, sx = S.width / W, sy = S.height / H;
    ctx.drawImage(S, 0, 0, W, H);
    // crowd jumps on goals / big moments
    const hype = match.state === 'goal' ? 1 : match.state === 'end' && match.result && match.result.win >= 0 ? 0.6 : (ball.power > 0 ? 0.3 : 0);
    if (hype > 0) {
      const t = performance.now() / 1000;
      for (let i = 0; i < 8; i++) {
        const x0 = i * W / 8, off = Math.abs(Math.sin(t * 9 + i * 1.7)) * -7 * hype;
        ctx.drawImage(S, x0 * sx, 330 * sy, (W / 8) * sx, 190 * sy, x0, 330 + off, W / 8, 190);
      }
    }
    drawJumbotron();
  } else { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1a3a'); g.addColorStop(1, '#203a6a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (IMG.pitch) ctx.drawImage(IMG.pitch, 0, GROUND - 46, W, H - GROUND + 46);
  else if (!IMG.stadium) { ctx.fillStyle = '#3c9a3a'; ctx.fillRect(0, GROUND - 30, W, H); }
  // floodlight bloom
  const fl = ctx.createRadialGradient(W / 2, -80, 50, W / 2, -80, 900); fl.addColorStop(0, 'rgba(255,255,230,0.10)'); fl.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
  // goals back layer
  drawGoal(0, false); drawGoal(1, false);
}
function drawJumbotron() {
  // screen area of the generated stadium (blank jumbotron, top centre)
  const x = 506, y = 76, w = 270, h = 124;
  const [a, b] = match.players; if (!a) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#0c1e52'); g.addColorStop(1, '#06102e'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const va = teamVis(a.code), vb = teamVis(b.code);
  if (match.state === 'goal' && match.scorer >= 0) {
    const s = match.players[match.scorer], vs = teamVis(s.code), t = performance.now() / 1000;
    ctx.fillStyle = `hsl(${(t * 220) % 360},90%,55%)`; ctx.globalAlpha = 0.35; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    if (vs.head) { const hh = 118; ctx.drawImage(vs.head, x + w / 2 - hh * vs.head.width / vs.head.height / 2, y + 6 + Math.sin(t * 10) * 3, hh * vs.head.width / vs.head.height, hh); }
    ctx.font = '26px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText('GOAL!', x + w / 2, y + h - 10, '#ffd23a', 5);
  } else {
    if (va.badge) ctx.drawImage(va.badge, x + 18, y + 22, 70, 70);
    if (vb.badge) ctx.drawImage(vb.badge, x + w - 88, y + 22, 70, 70);
    ctx.font = '40px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    strokeText(`${match.score[0]}-${match.score[1]}`, x + w / 2, y + 72, '#fff', 5);
    ctx.font = '15px "Lilita One", sans-serif'; strokeText(match.label || 'LIVE', x + w / 2, y + h - 12, '#7fd0ff', 4);
  }
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = y; i < y + h; i += 3) ctx.fillRect(x, i, w, 1);
  ctx.restore();
}
function drawGoal(side, front) {
  const img = IMG.goal; const gh = GROUND - CROSSBAR + 26, gw = GOAL_W + 20;
  if (img) {
    ctx.save();
    if (side === 1) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    const gx = GOAL_W + 10 - gw, gy = CROSSBAR - 20;
    if (!front) ctx.drawImage(img, gx, gy, gw, gh);
    else { const f = 0.88, sx = img.width * f; ctx.drawImage(img, sx, 0, img.width - sx, img.height, gx + gw * f, gy, gw * (1 - f), gh); }
    ctx.restore();
  } else {
    const x0 = side === 0 ? 0 : W - GOAL_W, x1 = side === 0 ? GOAL_W : W;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath();
    const px = side === 0 ? x1 : x0; ctx.moveTo(px, GROUND); ctx.lineTo(px, CROSSBAR); ctx.lineTo(side === 0 ? x0 : x1, CROSSBAR); ctx.stroke();
    if (!front) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; for (let i = CROSSBAR; i < GROUND; i += 16) { ctx.beginPath(); ctx.moveTo(x0, i); ctx.lineTo(x1, i); ctx.stroke(); } for (let i = x0; i < x1; i += 16) { ctx.beginPath(); ctx.moveTo(i, CROSSBAR); ctx.lineTo(i, GROUND); ctx.stroke(); } }
  }
}
function drawBall() {
  // shadow
  const hgt = GROUND - ball.y; ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.35 - hgt / 1500)})`;
  ctx.beginPath(); ctx.ellipse(ball.x, GROUND + 3, Math.max(8, 22 - hgt / 30), 5, 0, 0, 7); ctx.fill();
  // fire trail
  if (ball.trail.length) {
    const pc = SPECIALS[ball.ptype || 'fire'].col;
    for (let i = 0; i < ball.trail.length; i++) { const t = ball.trail[i], k = i / ball.trail.length; ctx.fillStyle = `rgba(${pc[0]},${Math.min(255, pc[1] + k * 60) | 0},${pc[2]},${k * 0.6})`; ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.5 + k * 0.9), 0, 7); ctx.fill(); }
  }
  if (ball.power > 0 && IMG.fireball && (ball.ptype || 'fire') === 'fire') { const a = Math.atan2(ball.vy, ball.vx); ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(IMG.fireball, -128, -32, 156, 79); ctx.restore(); }
  // speed streaks
  const bsp = Math.hypot(ball.vx, ball.vy);
  if (bsp > 850 && !ball.power) {
    const ux = ball.vx / bsp, uy = ball.vy / bsp, L = Math.min(150, (bsp - 700) / 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineCap = 'round';
    for (const o of [-0.6, 0, 0.6]) { ctx.lineWidth = o ? 3 : 5; ctx.beginPath(); ctx.moveTo(ball.x - ux * BALL_R - uy * o * BALL_R, ball.y - uy * BALL_R + ux * o * BALL_R); ctx.lineTo(ball.x - ux * (BALL_R + L * (o ? 0.7 : 1)) - uy * o * BALL_R, ball.y - uy * (BALL_R + L * (o ? 0.7 : 1)) + ux * o * BALL_R); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(ball.x, ball.y);
  if (bsp > 500) { const a = Math.atan2(ball.vy, ball.vx), st = Math.min(0.22, (bsp - 500) / 4000); ctx.rotate(a); ctx.scale(1 + st, 1 - st * 0.8); ctx.rotate(-a); }
  ctx.rotate(ball.rot);
  if (IMG.ball) ctx.drawImage(IMG.ball, -BALL_R - 2, -BALL_R - 2, BALL_R * 2 + 4, BALL_R * 2 + 4);
  else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  // off-screen indicator
  if (ball.y < 30) { ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(ball.x, 6); ctx.lineTo(ball.x - 10, 22); ctx.lineTo(ball.x + 10, 22); ctx.fill(); }
}
function drawPops(dt) {
  for (const q of pops) q.t += dt;
  pops = pops.filter(q => q.t < q.max);
  ctx.textAlign = 'center';
  for (const q of pops) {
    const k = Math.min(1, q.t / 0.18), out = Math.min(1, (q.max - q.t) / 0.25), s = (0.3 + 0.7 * easeOutBack(k)) * (0.85 + 0.15 * out);
    ctx.save(); ctx.globalAlpha = out; ctx.translate(q.x, q.y - q.t * 40); ctx.rotate(q.rot); ctx.scale(s, s);
    ctx.font = `${q.size}px "Lilita One", sans-serif`; strokeText(q.text, 0, 0, q.col, q.size * 0.26);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawParticles(dt) {
  for (const q of parts) { q.life -= dt; if (q.ring) continue; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.dust ? 200 : 600) * dt; }
  parts = parts.filter(q => q.life > 0);
  for (const q of parts) {
    const k = q.life / q.max;
    if (q.ring) { ctx.strokeStyle = q.col + (k * 0.9) + ')'; ctx.lineWidth = q.size * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.r1 * (1 - k * k) + 8, 0, 7); ctx.stroke(); continue; }
    if (q.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = q.col + (k * (q.dust ? 0.5 : 0.95)) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.dust ? 2 - k : k + 0.3), 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* ---------------- HUD ---------------- */
function fmtTime(t) { t = Math.ceil(t); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
function drawHUD(dt) {
  const [a, b] = match.players, ta = byCode(a.code), tb = byCode(b.code);
  // scoreboard (Higgsfield HUD plate; positions measured from the art)
  const sbw = 420, sbh = IMG.scoreboard ? sbw * IMG.scoreboard.height / IMG.scoreboard.width : 92, sx = W / 2 - sbw / 2, sy = H - sbh - 2;
  if (IMG.scoreboard) ctx.drawImage(IMG.scoreboard, sx, sy, sbw, sbh);
  else { ctx.fillStyle = '#10204a'; roundRect(sx, sy, sbw, sbh, 16); ctx.fill(); }
  const vA = teamVis(a.code), vB = teamVis(b.code), bs = sbw * 0.118;
  if (vA.badge) ctx.drawImage(vA.badge, sx + sbw * 0.1075 - bs / 2, sy + sbh * 0.57 - bs / 2, bs, bs);
  if (vB.badge) ctx.drawImage(vB.badge, sx + sbw * 0.895 - bs / 2, sy + sbh * 0.57 - bs / 2, bs, bs);
  ctx.textAlign = 'center'; ctx.font = '42px "Lilita One", sans-serif';
  strokeText(match.score[0], sx + sbw * 0.27, sy + sbh * 0.80, '#fff', 7);
  strokeText(match.score[1], sx + sbw * 0.73, sy + sbh * 0.80, '#fff', 7);
  ctx.font = '25px "Lilita One", sans-serif';
  const tcol = match.golden ? '#ffd23a' : match.time <= 30 ? (Math.floor(match.time / 1.5) % 2 ? '#ff4a3a' : '#fff') : '#fff';
  strokeText(match.golden ? 'OT' : fmtTime(match.time), W / 2, sy + sbh * 0.37, tcol, 5);
  if (match.agg) { ctx.save(); ctx.font = '15px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText(`AGG ${match.score[0] + match.agg[0]}-${match.score[1] + match.agg[1]}`, W / 2, sy - 6, '#7fe8ff', 4); ctx.restore(); }
  ctx.font = '13px "Lilita One", sans-serif';
  strokeText(match.golden ? 'GOLDEN GOAL' : match.halfDone ? '2ND HALF' : '1ST HALF', W / 2, sy + sbh * 0.66, '#ffd76a', 4);
  if (!match.golden) { strokeText(ta.code, sx + sbw * 0.4, sy + sbh * 0.66, '#cfe0ff', 4); strokeText(tb.code, sx + sbw * 0.6, sy + sbh * 0.66, '#cfe0ff', 4); }
  if (pu.mega > 0) { ctx.font = '16px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText(`MEGA BALL ${Math.ceil(pu.mega)}`, W / 2, sy - 8, PU.mega.col, 4); }
  // power meters
  drawMeter(a, 16, H - 52, false); drawMeter(b, W - 16 - 300, H - 52, true);
}
function drawMeter(p, x, y, right) {
  const x0 = x, w = 300, h = IMG.meter ? w * IMG.meter.height / IMG.meter.width : 40, full = p.meter >= 1;
  ctx.save();
  if (IMG.meter) { if (right) { ctx.translate(x + w, 0); ctx.scale(-1, 1); x = 0; } ctx.drawImage(IMG.meter, x, y, w, h); }
  else { ctx.fillStyle = '#0d1630'; roundRect(x, y, w, h, 12); ctx.fill(); }
  const ix = x + w * 0.155, iw = w * 0.795, iy = y + h * 0.31, ih = h * 0.4;
  const g = ctx.createLinearGradient(ix, 0, ix + iw, 0);
  g.addColorStop(0, '#ffb300'); g.addColorStop(1, full ? '#ff3b1f' : '#ffd84a');
  ctx.fillStyle = g; roundRect(ix, iy, iw * (p.charged > 0 ? 1 : p.meter), ih, ih / 2); ctx.fill();
  if (full || p.charged > 0) { ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 90) * 0.3; ctx.fillStyle = '#fff'; roundRect(ix, iy, iw, ih, ih / 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.font = '17px "Lilita One", sans-serif'; ctx.textAlign = right ? 'right' : 'left';
  const nm = PLAYERS[p.code].name.toUpperCase();
  x = x0; strokeText(nm, right ? x + w - 6 : x + 6, y - 6, '#fff', 4);
  const fx = p.fx || {}; let ly = y - (full && p.charged <= 0 && p.human ? 48 : 28);
  const lab = { bighead: 'BIG HEAD', speed: 'TURBO', frozen: 'FROZEN', tiny: 'TINY' }, lcol = { bighead: PU.bighead.col, speed: PU.speed.col, frozen: PU.freeze.col, tiny: PU.shrink.col };
  ctx.font = '15px "Lilita One", sans-serif';
  for (const k in lab) if (fx[k] > 0) { ctx.textAlign = right ? 'right' : 'left'; strokeText(`${lab[k]} ${Math.ceil(fx[k])}`, right ? x0 + w : x0, ly, lcol[k], 4); ly -= 19; }
  if (full && p.charged <= 0 && p.human) { ctx.textAlign = right ? 'right' : 'left'; ctx.font = '15px "Lilita One", sans-serif'; strokeText(p.ctl === 'p1' ? 'POWER READY! [E]' : 'POWER READY! [K]', right ? x + w : x, y - 26, '#ffd23a', 4); }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawIntro() {
  if (match.state !== 'intro') return;
  const k = Math.min(1, (2.4 - match.introT) / 0.35), out = Math.min(1, match.introT / 0.3);
  ctx.save(); ctx.globalAlpha = out;
  ctx.fillStyle = 'rgba(5,10,30,0.72)'; ctx.fillRect(0, 0, W, H);
  const [a, b] = match.players;
  [a, b].forEach((p, i) => {
    const v = teamVis(p.code), side = i === 0 ? -1 : 1, x = W / 2 + side * (330 + (1 - easeOutBack(k)) * 400);
    ctx.save(); ctx.translate(x, 470); ctx.scale(1.55, 1.55); ctx.translate(0, -GROUND);
    drawPlayer(poseChar(p.code, 'idle', performance.now() / 1000, i === 0 ? 1 : -1), { menu: true });
    ctx.restore();
    ctx.save(); ctx.translate(x, 330);
    if (v.badge) ctx.drawImage(v.badge, -60 + side * -170, -220, 120, 120);
    ctx.font = '40px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    strokeText(byCode(p.code).name.toUpperCase(), 0, 200, '#fff', 9);
    ctx.font = '24px "Lilita One", sans-serif'; strokeText(PLAYERS[p.code].name, 0, 235, '#ffd23a', 6);
    ctx.restore();
  });
  ctx.translate(W / 2, 330); const s = 0.6 + 0.4 * easeOutBack(k); ctx.scale(s, s); ctx.rotate(-0.08);
  ctx.font = '130px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText('VS', 0, 40, '#ffd23a', 16);
  if (match.label) { ctx.rotate(0.08); ctx.font = '28px "Lilita One", sans-serif'; strokeText(match.label, 0, -150, '#7fd0ff', 7); ctx.rotate(-0.08); }
  const wn = (WEATHER[match.weather] || {}).name; if (wn) { ctx.rotate(0.08); ctx.font = '26px "Lilita One", sans-serif'; strokeText(wn, 0, 110, '#ffffff', 7); }
  ctx.restore();
}
function drawSpecial(dt) {
  const s = match.special; if (!s || s.t <= 0) return; s.t -= dt;
  const k = Math.min(1, (1.1 - s.t) / 0.15), x = s.side === 0 ? 300 : W - 300;
  ctx.save(); ctx.translate(x, 180); ctx.scale(0.6 + 0.4 * easeOutBack(k), 0.6 + 0.4 * easeOutBack(k)); ctx.rotate(s.side === 0 ? -0.08 : 0.08);
  ctx.font = '46px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, s.t / 0.2);
  const c = SPECIALS[ball.ptype || 'fire'].col; strokeText(s.name, 0, 0, `rgb(${c.join(',')})`, 10); ctx.restore();
}
function drawBanner(dt) {
  if (!match.banner || match.bannerT <= 0) return;
  match.bannerT -= dt;
  const age = match.bannerMax - match.bannerT, k = Math.min(1, age / 0.25), out = Math.min(1, match.bannerT / 0.25);
  const s = (0.4 + 0.6 * easeOutBack(k)) * out;
  ctx.save(); ctx.translate(W / 2, match.banner === 'GOAL!' ? H * 0.36 : H * 0.4); ctx.scale(s, s);
  if (match.banner === 'GOAL!' && IMG.goaltext) { ctx.drawImage(IMG.goaltext, -190, -200, 380, 340); }
  else { ctx.font = '86px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText(match.banner, 0, 20, '#ffd23a', 14); }
  if (match.bannerSub) { ctx.font = '34px "Lilita One", sans-serif'; ctx.textAlign = 'center'; strokeText(match.bannerSub, 0, match.banner === 'GOAL!' ? 178 : 72, '#fff', 8); }
  ctx.restore();
}
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* ---------------- full-rig character renders for menus ---------------- */
let menuChars = [];
function poseChar(code, pose, t, dir) {
  const p = new Player(dir > 0 ? 0 : 1, code, true, 'menu');
  p.x = 0; p.y = GROUND; p.anim = t; p.onGround = true; p.vx = 0; p.vy = 0;
  if (pose === 'cele') p.cele = 1; else if (pose === 'sad') p.sad = 1;
  else if (pose === 'run') { p.vx = 300 * dir; p.runPhase = t * 11; }
  return p;
}
function renderChar(cnv, code, pose, t, dir = 1) {
  const c2 = cnv.getContext('2d'), S = cnv.height / 300;
  c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cnv.width, cnv.height);
  c2.setTransform(S, 0, 0, S, cnv.width / 2, cnv.height - 16 * S - GROUND * S);
  ctx = c2; try { drawPlayer(poseChar(code, pose, t, dir), { menu: true }); } finally { ctx = mainCtx; }
}
function charCanvas(code, pose, w, h, dir = 1) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px'; c.className = 'charcan';
  const entry = { c, code, pose, dir }; menuChars.push(entry); renderChar(c, code, pose, performance.now() / 1000, dir); return c;
}

/* ---------------- UI screens (DOM overlay) ---------------- */
let screen = 'loading';
const ui = document.getElementById('ui');
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(label, cls, fn) { const b = el('button', 'mbtn ' + (cls || ''), `<span>${label}</span>`); b.onclick = () => { initAudio(); sfx('click', 0.7); fn(); }; return b; }
function clearUI() { ui.innerHTML = ''; ui.className = ''; menuChars = []; }
function badgeImg(code, size = 64) { return `<img class="badge" src="${A}badges/${code}.webp" width="${size}" height="${size}" alt="${code}">`; }

function startDemo() {
  const pick = () => TEAMS[Math.random() * TEAMS.length | 0].code; let h = pick(), a = pick(); while (a === h) a = pick();
  startMatch({ home: h, away: a, demo: true, difficulty: 2, time: 60 });
}
function showTitle() {
  if (!match.demo || screen === 'match' || !match.players.length) startDemo();
  screen = 'title'; clearUI(); ui.className = 'menu title'; music('menu'); crowd(false);
  ui.appendChild(el('img', 'logo')).src = A + 'ui/logo.webp';
  const col = el('div', 'col');
  col.appendChild(btn('FULL WORLD CUP', 'gold big', () => FW_new()));
  const sub = el('div', 'subrow');
  sub.appendChild(btn('WORLD CUP 48', 'sm', () => teamSelect('wc')));
  sub.appendChild(btn('QUICK MATCH', 'sm', () => teamSelect('quick')));
  sub.appendChild(btn('2 PLAYERS', 'sm', () => teamSelect('2p')));
  sub.appendChild(btn('2P WORLD CUP', 'sm', () => FW_new({ step: 0 })));
  col.appendChild(sub);
  const wc = store.get('hl_wc', null);
  const cont = el('div', 'subrow');
  if (window.FW_hasSave && FW_hasSave()) cont.appendChild(btn('CONTINUE ROAD TO 2026', 'green sm', () => FW_continue()));
  if (wc && !wc.done && !wc.full) cont.appendChild(btn('CONTINUE CUP', 'green sm', () => { cup = wc; cupHub(); }));
  const wc2 = store.get('hl_wc2', null);
  if (wc2 && !wc2.done) cont.appendChild(btn('CONTINUE 2P CUP', 'green sm', () => { cup = wc2; if (window.FW_prep) FW_prep(cup.users); cupHub(); }));
  if (cont.children.length) col.insertBefore(cont, col.firstChild);
  ui.appendChild(col);
  const diff = el('div', 'diff');
  const names = ['EASY', 'NORMAL', 'HARD'];
  names.forEach((n, i) => { const b = el('button', 'chip' + (settings.difficulty === i ? ' on' : ''), n); b.onclick = () => { settings.difficulty = i; store.set('hl_set', settings); showTitle(); }; diff.appendChild(b); });
  const puB = el('button', 'chip' + (settings.powerups !== false ? ' on' : ''), settings.powerups !== false ? '★ POWER-UPS ON' : '☆ POWER-UPS OFF');
  puB.onclick = () => { settings.powerups = settings.powerups === false; store.set('hl_set', settings); sfx('click', 0.5); showTitle(); };
  diff.appendChild(puB);
  ui.appendChild(diff);
  ui.appendChild(el('div', 'help', 'P1: <b>A D</b> move · <b>W</b> jump (tap = short hop) · <b>SPACE</b> kick · <b>E</b> power shot &nbsp;|&nbsp; P2: <b>← →</b> · <b>↑</b> · <b>↓</b> kick · <b>K</b> power<br>Jump + kick under a high ball = <b>BICYCLE KICK</b> · land on their head to <b>BOUNCE</b> over · pop bubbles with the ball for <b>POWER-UPS</b>'));
  ui.appendChild(soundToggle());
}
function soundToggle() { const b = el('button', 'iconbtn snd' + (muted ? ' off' : '')); b.innerHTML = `<img src="${A}ui/btn2.webp">`; b.onclick = () => { initAudio(); setMuted(!muted); b.classList.toggle('off', muted); }; return b; }
const settings = store.get('hl_set', { difficulty: 1 });

const FIFA_NAME = { KOR: 'KOREA REPUBLIC', IRN: 'IR IRAN', CPV: 'CABO VERDE', CIV: "CÔTE D'IVOIRE", BIH: 'BOSNIA AND HERZEGOVINA', COD: 'CONGO DR', TUR: 'TÜRKIYE', CZE: 'CZECHIA', CUW: 'CURAÇAO', USA: 'USA' };
function teamSelect(mode, step = 0, picked = null) {
  screen = 'select'; clearUI(); ui.className = 'menu select fifa';
  ui.appendChild(el('div', 'fbg', `<svg viewBox="0 0 1280 720" preserveAspectRatio="none"><defs><filter id="fglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="farc" x1="0" x2="1"><stop offset="0" stop-color="#3d7bff" stop-opacity="0"/><stop offset=".45" stop-color="#4f8dff"/><stop offset="1" stop-color="#2f5fff" stop-opacity=".1"/></linearGradient></defs>
    <g fill="none" stroke="url(#farc)" filter="url(#fglow)"><ellipse cx="820" cy="330" rx="560" ry="300" stroke-width="5" opacity="1"/><ellipse cx="760" cy="420" rx="430" ry="210" stroke-width="3" opacity=".8"/><path d="M-40 650 Q 420 380 1320 560" stroke-width="4" opacity=".85"/><path d="M220 -20 Q 640 260 1300 120" stroke-width="3" opacity=".6"/><ellipse cx="1180" cy="40" rx="260" ry="140" stroke-width="3" opacity=".55"/></g></svg>`));
  const title = mode === '2p' ? (step === 0 ? 'PLAYER 1 — PICK YOUR NATION' : 'PLAYER 2 — PICK YOUR NATION') : mode === 'quick' && step === 1 ? 'PICK YOUR OPPONENT' : 'PICK YOUR NATION';
  ui.appendChild(el('h2', '', title));
  const wrap = el('div', 'selwrap');
  const grid = el('div', 'grid fgrid');
  const prev = el('div', 'preview');
  let cur = picked && step === 1 ? TEAMS.find(t => t.code !== picked).code : (store.get('hl_last', 'ARG'));
  function showPrev(code) {
    cur = code; const t = byCode(code), pl = PLAYERS[code];
    prev.innerHTML = `<div class="pflag">${flagTag(code)}</div><div class="pname">${FIFA_NAME[code] || t.name.toUpperCase()}</div><div class="pgroup">GROUP ${t.group}</div>
      <div class="pchar"></div>
      <div class="pstar">★ ${pl.name}</div><div class="prate">RATING ${RATING[code]}</div>`;
    menuChars = menuChars.filter(m => m.c.isConnected);
    prev.querySelector('.pchar').appendChild(charCanvas(code, 'idle', 220, 250, 1));
    grid.querySelectorAll('.cell').forEach(c => c.classList.toggle('on', c.dataset.code === code));
  }
  for (const g of GROUPS) {
    const card = el('div', 'fgroup'); card.appendChild(el('div', 'fgh', 'GROUP ' + g)); const cells = card; grid.appendChild(card);
    for (const t of TEAMS.filter(t => t.group === g)) {
      const nm = FIFA_NAME[t.code] || t.name.toUpperCase();
      const c = el('button', 'cell frow' + (t.code === picked ? ' taken' : ''), `${flagTag(t.code, 'fflag')}<span class="fbar"${nm.length > 17 ? ' style="font-size:12px"' : ''}>${nm}</span>`);
      c.dataset.code = t.code; c.title = t.name;
      c.onclick = () => { if (t.code === picked) return; sfx('click', 0.5); showPrev(t.code); };
      c.ondblclick = () => go();
      cells.appendChild(c);
    }
  }
  wrap.appendChild(grid); wrap.appendChild(prev); ui.appendChild(wrap);
  const row = el('div', 'row');
  row.appendChild(btn('BACK', 'red', () => step ? teamSelect(mode, 0) : showTitle()));
  const go = () => {
    if (step === 0) store.set('hl_last', cur);
    if (mode === 'wc') return newCup(cur);
    if (step === 0) return teamSelect(mode, 1, cur);
    startMatch({ home: picked, away: cur, twoP: mode === '2p', difficulty: settings.difficulty, label: mode === '2p' ? 'FRIENDLY · 2P' : 'FRIENDLY', onEnd: (a, b) => resultScreen(picked, cur, a, b, () => showTitle(), () => startMatch({ home: picked, away: cur, twoP: mode === '2p', difficulty: settings.difficulty, label: 'REMATCH', onEnd: arguments.callee })) });
  };
  row.appendChild(btn(step === 0 && mode !== 'wc' ? 'NEXT' : 'PLAY', 'green', go));
  ui.appendChild(row);
  showPrev(cur);
}
function resultScreen(h, a, s0, s1, onOk, onRematch) {
  screen = 'result'; clearUI(); ui.className = 'menu result';
  const w = s0 > s1 ? h : s1 > s0 ? a : null;
  ui.appendChild(el('h2', '', w ? `${byCode(w).name.toUpperCase()} WIN!` : 'DRAW'));
  const fig = (c, st) => `<div class="rfig" data-c="${c}" data-st="${st}"><div class="rname">${PLAYERS[c].name}</div></div>`;
  const stH = w === h ? 'win' : w ? 'lose' : 'draw', stA = w === a ? 'win' : w ? 'lose' : 'draw';
  ui.appendChild(el('div', 'resrow', `${fig(h, stH)}<div class="scoreline">${badgeImg(h, 96)}<b>${s0}</b><i>-</i><b>${s1}</b>${badgeImg(a, 96)}</div>${fig(a, stA)}`));
  ui.querySelectorAll('.rfig').forEach(f => { const c = f.dataset.c, st = f.dataset.st; f.insertBefore(charCanvas(c, st === 'win' ? 'cele' : st === 'lose' ? 'sad' : 'idle', 230, 300, c === a ? -1 : 1), f.firstChild); });
  sfx(w ? 'fanfare' : 'whistle_end', 0.9);
  const row = el('div', 'row'); row.appendChild(btn('MENU', 'red', onOk)); if (onRematch) row.appendChild(btn('REMATCH', 'green', onRematch)); ui.appendChild(row);
}

/* ---------------- WORLD CUP 48 ---------------- */
let cup = null;
const cupGroup = g => cup && cup.groups ? cup.groups[g] : TEAMS.filter(x => x.group === g).map(x => x.code);
function newCup(code, groups = null, extra = {}) {
  cup = { team: code, stage: 'group', md: 0, results: {}, fixtures: {}, ko: null, koRound: 0, done: false, champion: null, diff: settings.difficulty, groups, ...extra };
  // group fixtures: rounds (1v2,3v4),(1v3,2v4),(1v4,2v3)
  for (const g of GROUPS) {
    const t = cupGroup(g);
    cup.fixtures[g] = [[[t[0], t[1]], [t[2], t[3]]], [[t[0], t[2]], [t[1], t[3]]], [[t[3], t[0]], [t[1], t[2]]]];
  }
  saveCup(); cupHub();
}
function saveCup() { if (cup && cup.full) { if (window.FW_saveCup) FW_saveCup(cup); } else store.set(cup && cup.duo ? 'hl_wc2' : 'hl_wc', cup); }
// humans still in it (1-player cup: just cup.team; 2-player cup: whoever is alive)
const humans = () => !cup ? [] : cup.duo ? cup.users.filter((u, i) => cup.alive[i]) : [cup.team];
const isMe = c => !!cup && (cup.duo ? cup.users.includes(c) : c === cup.team);
const pTag = c => cup && cup.duo ? `<b class="ptag p${cup.users.indexOf(c) + 1}">P${cup.users.indexOf(c) + 1}</b>` : '';
function simScore(h, a) {
  const rh = RATING[h], ra = RATING[a];
  const lam = (r1, r2) => Math.max(0.2, 1.35 + (r1 - r2) * 0.06);
  const pois = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  return [pois(lam(rh, ra)), pois(lam(ra, rh))];
}
function table(g) {
  const t = cupGroup(g).map(code => ({ code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  const f = c => t.find(x => x.code === c);
  for (let md = 0; md < 3; md++) for (const [h, a] of cup.fixtures[g][md]) {
    const r = cup.results[`${h}-${a}`]; if (!r) continue;
    const H_ = f(h), A_ = f(a); H_.p++; A_.p++; H_.gf += r[0]; H_.ga += r[1]; A_.gf += r[1]; A_.ga += r[0];
    if (r[0] > r[1]) { H_.w++; A_.l++; H_.pts += 3; } else if (r[0] < r[1]) { A_.w++; H_.l++; A_.pts += 3; } else { H_.d++; A_.d++; H_.pts++; A_.pts++; }
  }
  t.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || RATING[y.code] - RATING[x.code]);
  return t;
}
function myGroup() { return cup.groups ? GROUPS.find(g => cup.groups[g].includes(cup.team)) : byCode(cup.team).group; }
function myFixture() {
  if (cup.stage === 'group') { const g = myGroup(); return cup.fixtures[g][cup.md].find(m => m.includes(cup.team)); }
  if (cup.stage === 'ko') { const r = cup.ko[cup.koRound]; return r.find(m => m.includes(cup.team)); }
  return null;
}
const KO_NAMES = ['ROUND OF 32', 'ROUND OF 16', 'QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'];
function cupHub() {
  screen = 'cup'; clearUI(); ui.className = 'menu cup' + (cup.stage !== 'group' && cup.ko ? ' ko' : ''); music('menu'); crowd(false);
  if (cup.stage !== 'group' && cup.ko) { ui.appendChild(bracketPoster()); cupRow(); return; }
  if (cup.duo) duoTop(); else {
  const top = el('div', 'cuptop', `${badgeImg(cup.team, 64)}<div><div class="ct1">${cup.full ? 'WORLD CUP 2026 FINALS' : 'WORLD CUP 48'}</div><div class="ct2">${byCode(cup.team).name.toUpperCase()} · ${cup.stage === 'group' ? 'GROUP ' + myGroup() + ' · MATCHDAY ' + (cup.md + 1) : cup.stage === 'ko' ? KO_NAMES[cup.koRound] : cup.champion === cup.team ? 'CHAMPIONS!' : 'ELIMINATED'}</div></div>`);
  ui.appendChild(top); }
  const body = el('div', 'cupbody');
  if (cup.stage === 'group') {
    const g = myGroup(); body.appendChild(groupTable(g, true));
    const others = el('div', 'others'); for (const gg of GROUPS) if (gg !== g) others.appendChild(groupTable(gg, false)); body.appendChild(others);
    if (cup.duo) body.classList.add('duo');
  } else body.appendChild(bracketView());
  ui.appendChild(body);
  cupRow();
}
function cupRow() {
  const row = el('div', 'row');
  row.appendChild(btn('MENU', 'red', showTitle));
  const fx = myFixture();
  if (fx && !cup.done) {
    const opp = fx[0] === cup.team ? fx[1] : fx[0];
    if (cup.duo) row.appendChild(el('div', 'next', `${fx.every(isMe) ? 'P1 v P2:' : pTag(cup.team) + ' NEXT:'} ${badgeImg(cup.team, 40)} vs ${badgeImg(opp, 40)} <b>${byCode(opp).name.toUpperCase()}</b>`));
    else row.appendChild(el('div', 'next', `NEXT: ${badgeImg(cup.team, 40)} vs ${badgeImg(opp, 40)} <b>${byCode(opp).name.toUpperCase()}</b>`));
    row.appendChild(btn(cup.duo ? (fx.every(isMe) ? 'PLAY P1 v P2' : `PLAYER ${cup.turn + 1} — PLAY`) : 'PLAY MATCH', 'green', () => playCupMatch(fx)));
  } else if (cup.done) {
    if (cup.full) row.appendChild(btn('NEW CAMPAIGN', 'gold', () => FW_new()));
    else if (cup.duo) row.appendChild(btn('NEW 2P WORLD CUP', 'gold', () => { store.set('hl_wc2', null); FW_new({ step: 0 }); }));
    else row.appendChild(btn('NEW CUP', 'gold', () => { store.set('hl_wc', null); teamSelect('wc'); }));
  }
  ui.appendChild(row);
}
function groupTable(g, big) {
  const t = table(g), d = el('div', 'gtable' + (big ? ' big' : ''));
  let h = `<div class="gt-h">GROUP ${g}</div><table><tr><th></th><th>${big ? 'TEAM' : ''}</th><th>P</th>${big ? '<th>W</th><th>D</th><th>L</th><th>GD</th>' : ''}<th>PTS</th></tr>`;
  t.forEach((r, i) => { h += `<tr class="${isMe(r.code) ? 'me' : ''} ${i < 2 ? 'q' : i === 2 ? 'q3' : ''}"><td>${badgeImg(r.code, big ? 34 : 22)}</td><td>${big ? byCode(r.code).name : r.code}</td><td>${r.p}</td>${big ? `<td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>` : ''}<td><b>${r.pts}</b></td></tr>`; });
  d.innerHTML = h + '</table>'; return d;
}
/* poster-style knockout bracket: two mirrored halves meeting at the final in the middle */
const SHORT = { RSA: 'S. AFRICA', KOR: 'S. KOREA', BIH: 'BOSNIA', SUI: 'SWITZ.', CIV: 'IVORY COAST', NED: 'NETHERLANDS', NZL: 'N. ZEALAND', CPV: 'CAPE VERDE', KSA: 'SAUDI ARABIA', UZB: 'UZBEKISTAN', COD: 'DR CONGO', CUW: 'CURAÇAO' };
const tName = c => SHORT[c] || byCode(c).name.toUpperCase();
const RND_HEAD = ['ROUND OF 32', 'ROUND OF 16', 'QUARTERFINALS', 'SEMIFINALS', 'FINAL'];
const RND_DATE = ['JUN 28 – JUL 3', 'JUL 4 – 7', 'JUL 9 – 11', 'JUL 14 – 15', 'JUL 19'];
function bracketPoster() {
  const PW = 1240, PH = 616, BW = 124, FW = 168, top = 150, bottom = PH - 14;
  const d = el('div', 'kposter');
  d.innerHTML = `<div class="kblob l"></div><div class="kblob r"></div>
    <div class="ktitle">WORLD CUP 2026</div><div class="kpill">KNOCKOUT BRACKET</div>
    ${cup.duo ? `<div class="kme duo">${cup.users.map((u, i) => `<div class="kmep p${i + 1}${cup.alive[i] ? '' : ' dead'}">${pTag(u)}${badgeImg(u, 26)}<span>${tName(u)}<i>${cup.champion === u ? 'CHAMPIONS!' : !cup.alive[i] ? 'ELIMINATED' : cup.champion ? 'RUNNERS-UP' : RND_HEAD[cup.koRound]}</i></span></div>`).join('')}</div>`
    : `<div class="kme">${badgeImg(cup.team, 30)}<span>${byCode(cup.team).name.toUpperCase()}<i>${cup.champion === cup.team ? 'CHAMPIONS!' : cup.stage === 'out' ? 'ELIMINATED' : RND_HEAD[cup.koRound]}</i></span></div>`}`;
  const step = (PW - 16 - BW) / 8;
  const colX = (r, side) => side === 0 ? 8 + r * step : PW - 8 - BW - r * step;
  const svg = []; const boxes = [];
  const slotY = (r, i) => { const n = 8 >> r, h = (bottom - top) / n; return top + h * (i + 0.5); };
  const R1 = 19, rowsH = R1 * 2;
  const mnum = (r, side, i) => [73, 89, 97, 101][r] + side * (8 >> r) + i;
  const res = (r, m) => m && cup.results['ko' + r + ':' + m.join('-')];
  const box = (r, m, x, y, w, side, label, isFinal) => {
    const rr = res(r, m), me = m && m.some(isMe), up = me && !rr && !cup.done && r === cup.koRound;
    const rows = [0, 1].map(k => {
      const c = m && m[k];
      if (!c) return `<div class="kr tbd"><span class="kn">TBD</span></div>`;
      const st = rr ? (rr.w === k ? ' win' : ' lose') : '';
      const nm = tName(c), fs = nm.length > 10 ? 10.5 : nm.length > 8 ? 12 : 13.5;
      const flag = flagTag(c, 'kf'), sc = rr ? `<b class="ks">${rr.s[k]}</b>` : '';
      return `<div class="kr${st}${isMe(c) ? ' mine' + (cup.duo ? ' p' + (cup.users.indexOf(c) + 1) : '') : ''}">${side === 1 ? sc : flag}<span class="kn" style="font-size:${fs}px">${nm}</span>${side === 1 ? flag : sc}</div>`;
    }).join('');
    const lab = `${label} • ${rr ? 'FULL TIME' : up ? (cup.duo ? (m.every(isMe) ? 'P1 v P2!' : 'P' + (cup.users.indexOf(m.find(isMe)) + 1) + ' MATCH') : 'YOUR MATCH') : RND_DATE[r]}`;
    boxes.push(`<div class="kb${isFinal ? ' fin' : ''}${me ? ' me' : ''}${up ? ' up' : ''} s${side}" style="left:${x}px;top:${y - (isFinal ? 26 : rowsH / 2)}px;width:${w}px">${rows}<div class="kl">${lab}</div></div>`);
  };
  // halves
  for (let r = 0; r < 4; r++) {
    const round = cup.ko[r] || [], n = 8 >> r;
    for (const side of [0, 1]) {
      const x = colX(r, side);
      boxes.push(`<div class="kh" style="left:${x}px;top:${top - 26}px;width:${BW}px">${RND_HEAD[r]}</div>`);
      for (let i = 0; i < n; i++) {
        const m = round[side * n + i], y = slotY(r, i);
        box(r, m, x, y, BW, side, 'M' + mnum(r, side, i));
        if (r > 0) { // connectors from the two feeder matches
          const px = side === 0 ? colX(r - 1, 0) + BW : colX(r - 1, 1), cx = side === 0 ? x : x + BW, mx = (px + cx) / 2;
          const y1 = slotY(r - 1, i * 2), y2 = slotY(r - 1, i * 2 + 1);
          svg.push(`M${px} ${y1}H${mx}V${y2}H${px}M${mx} ${y}H${cx}`);
        }
      }
    }
  }
  // final in the centre, fed by both semis
  const fx = PW / 2 - FW / 2, fy = (top + bottom) / 2 - 92;
  boxes.push(`<div class="kh fin" style="left:${fx}px;top:${fy - 52}px;width:${FW}px">FINAL</div>`);
  box(4, cup.ko[4] && cup.ko[4][0], fx, fy, FW, 0, 'M104', true);
  if (cup.champion) boxes.push(`<div class="kchamp" style="left:${PW / 2 - 75}px;top:${slotY(3, 0) + 30}px"><img src="${A}ui/trophy.webp">${badgeImg(cup.champion, 44)}<div><small>CHAMPIONS</small>${byCode(cup.champion).name.toUpperCase()}</div></div>`);
  d.insertAdjacentHTML('beforeend', `<svg class="klines" width="${PW}" height="${PH}"><path d="${svg.join('')}"/></svg>` + boxes.join(''));
  return d;
}
function bracketView() {
  const d = el('div', 'bracket');
  cup.ko.forEach((round, ri) => {
    const col = el('div', 'bcol'); col.appendChild(el('div', 'bh', KO_NAMES[ri]));
    round.forEach(m => {
      const r = cup.results['ko' + ri + ':' + m.join('-')];
      const cell = el('div', 'bm' + (m.some(isMe) ? ' me' : ''));
      cell.innerHTML = m.map((c, i) => `<div class="bt ${r && ((i === 0 && r.w === 0) || (i === 1 && r.w === 1)) ? 'w' : ''}">${badgeImg(c, 20)}<span>${c}</span><b>${r ? r.s[i] : ''}</b></div>`).join('');
      col.appendChild(cell);
    });
    d.appendChild(col);
  });
  if (cup.champion) { const c = el('div', 'bcol champ'); c.innerHTML = `<div class="bh">CHAMPION</div><img src="${A}ui/trophy.webp" class="troph">${badgeImg(cup.champion, 80)}<div class="cn">${byCode(cup.champion).name.toUpperCase()}</div>`; d.appendChild(c); }
  return d;
}
function playCupMatch(fx) {
  const home = cup.duo && fx.every(isMe) ? cup.users[0] : cup.team, away = fx[0] === home ? fx[1] : fx[0];
  const ko = cup.stage === 'ko', vs = cup.duo && fx.every(isMe);
  if (cup.duo) { cup.team = home; }
  startMatch({
    home, away, difficulty: cup.diff, knockout: ko, twoP: vs, tag: cup.duo && !vs ? 'P' + (cup.turn + 1) : null, label: (cup.duo ? (vs ? 'P1 v P2 · ' : `P${cup.turn + 1} · `) : '') + (ko ? KO_NAMES[cup.koRound] : `GROUP ${myGroup()} · MD${cup.md + 1}`),
    onEnd: (s0, s1) => {
      // map back to fixture order
      const r = fx[0] === home ? [s0, s1] : [s1, s0];
      if (!ko) { cup.results[`${fx[0]}-${fx[1]}`] = r; if (!cup.duo || !duoPending().length) advanceGroup(); }
      else { const w = r[0] > r[1] ? 0 : 1; cup.results['ko' + cup.koRound + ':' + fx.join('-')] = { s: r, w }; if (!cup.duo || !duoPending().length) advanceKO(); }
      if (cup.duo) duoTurn();
      saveCup(); resultScreen(home, away, s0, s1, () => cupHub(), null);
      document.querySelector('.result .row .mbtn span').textContent = 'CONTINUE';
    }
  });
}
function advanceGroup() {
  // sim all other matches of this matchday
  for (const g of GROUPS) for (const [h, a] of cup.fixtures[g][cup.md]) { const k = `${h}-${a}`; if (!cup.results[k]) cup.results[k] = simScore(h, a); }
  cup.md++;
  if (cup.md >= 3) buildKO();
}
function buildKO() {
  const firsts = [], seconds = [], thirds = [];
  for (const g of GROUPS) { const t = table(g); firsts.push({ ...t[0], g }); seconds.push({ ...t[1], g }); thirds.push({ ...t[2], g }); }
  const rk = (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
  thirds.sort(rk);
  const q = [...firsts.sort(rk), ...seconds.sort(rk), ...thirds.slice(0, 8)];
  const qualified = q.map(x => x.code);
  if (cup.duo) cup.alive = cup.users.map(u => qualified.includes(u));
  const out = !humans().length;
  // seed 1..32, pair 1v32 etc avoiding same group in R32 where possible
  const seeds = q.slice(); const pairs = []; const used = new Set();
  for (let i = 0; i < 16; i++) {
    const top = seeds[i]; if (used.has(top.code)) continue;
  }
  const top16 = seeds.slice(0, 16), bot16 = seeds.slice(16).reverse();
  for (let i = 0; i < 16; i++) {
    let j = i; while (j < 16 && bot16[j].g === top16[i].g) j++;
    if (j < 16 && j !== i) [bot16[i], bot16[j]] = [bot16[j], bot16[i]];
    pairs.push([top16[i].code, bot16[i].code]);
  }
  // bracket order so seeds 1&2 meet only in final
  const order = [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
  cup.ko = [order.map(i => pairs[i])]; cup.koRound = 0; cup.stage = 'ko';
  if (cup.duo && cup.alive[0] && cup.alive[1]) duoSplit(cup.ko[0]);
  if (out) { cup.stage = 'out'; cup.done = true; simToEnd(); return; }
  simKORound();
}
function simKORound() {
  const r = cup.koRound, round = cup.ko[r];
  for (const m of round) { const k = 'ko' + r + ':' + m.join('-'); if (cup.results[k] || m.some(c => humans().includes(c))) continue; let s = simScore(m[0], m[1]); if (s[0] === s[1]) s[Math.random() < RATING[m[0]] / (RATING[m[0]] + RATING[m[1]]) ? 0 : 1]++; cup.results[k] = { s, w: s[0] > s[1] ? 0 : 1 }; }
}
function advanceKO() {
  const r = cup.koRound, round = cup.ko[r];
  simKORound();
  const winners = round.map(m => m[cup.results['ko' + r + ':' + m.join('-')].w]);
  if (cup.duo) cup.alive = cup.alive.map((a, i) => a && winners.includes(cup.users[i]));
  if (!winners.some(c => cup.duo ? cup.users.includes(c) : c === cup.team)) { cup.done = true; cup.stage = 'out'; }
  if (winners.length === 1) { cup.champion = winners[0]; cup.done = true; cup.stage = 'done'; if (cup.duo && cup.users.includes(cup.champion)) cup.team = cup.champion; if (cup.champion === cup.team) setTimeout(trophyScreen, 50); return; }
  const next = []; for (let i = 0; i < winners.length; i += 2) next.push([winners[i], winners[i + 1]]);
  cup.ko.push(next); cup.koRound++;
  if (cup.done) { while (cup.ko[cup.koRound].length >= 1) { simKORound(); const rr = cup.koRound, rd = cup.ko[rr]; const ws = rd.map(m => m[cup.results['ko' + rr + ':' + m.join('-')].w]); if (ws.length === 1) { cup.champion = ws[0]; break; } const nx = []; for (let i = 0; i < ws.length; i += 2) nx.push([ws[i], ws[i + 1]]); cup.ko.push(nx); cup.koRound++; } }
  else simKORound();
}
function simToEnd() {
  for (;;) {
    simKORound(); const rr = cup.koRound, rd = cup.ko[rr];
    const ws = rd.map(m => m[cup.results['ko' + rr + ':' + m.join('-')].w]);
    if (ws.length === 1) { cup.champion = ws[0]; return; }
    const nx = []; for (let i = 0; i < ws.length; i += 2) nx.push([ws[i], ws[i + 1]]); cup.ko.push(nx); cup.koRound++;
  }
}
/* ---------------- 2-PLAYER WORLD CUP ----------------
   Two humans, two nations, one tournament. P1 plays, then P2, each matchday / round.
   Their nations take the place of the weakest qualified teams, sit in different groups,
   and are kept on opposite halves of the bracket so they can only meet in the final. */
window.WC2_new = (p1, p2) => {
  const groups = {}; GROUPS.forEach(g => groups[g] = TEAMS.filter(t => t.group === g).map(t => t.code));
  const gOf = c => GROUPS.find(g => groups[g].includes(c));
  const replaced = [];
  const place = (c, avoid) => {
    if (gOf(c)) return;
    const w = Object.values(groups).flat().filter(x => x !== p1 && x !== p2 && gOf(x) !== avoid).sort((a, b) => RATING[a] - RATING[b])[0];
    const g = gOf(w); groups[g][groups[g].indexOf(w)] = c; replaced.push([c, w]);
  };
  place(p1, null); place(p2, gOf(p1));
  if (gOf(p1) === gOf(p2)) {   // both already qualified in the same group: swap P2 with the closest-rated team elsewhere
    const g1 = gOf(p1), x = Object.values(groups).flat().filter(c => gOf(c) !== g1).sort((a, b) => Math.abs(RATING[a] - RATING[p2]) - Math.abs(RATING[b] - RATING[p2]))[0];
    const gx = gOf(x), i2 = groups[g1].indexOf(p2), ix = groups[gx].indexOf(x); groups[g1][i2] = x; groups[gx][ix] = p2;
  }
  if (window.FW_prep) FW_prep([p1, p2]);
  store.set('hl_wc2', null);
  newCup(p1, groups, { duo: true, users: [p1, p2], alive: [true, true], turn: 0, replaced, intro: true });
};
function fixtureOf(code) { const t = cup.team; cup.team = code; const f = myFixture(); cup.team = t; return f; }
function fxPlayed(fx) { return !fx || (cup.stage === 'group' ? !!cup.results[`${fx[0]}-${fx[1]}`] : cup.stage === 'ko' ? !!cup.results['ko' + cup.koRound + ':' + fx.join('-')] : true); }
function duoPending() { return cup.done ? [] : [0, 1].filter(i => cup.alive[i] && !fxPlayed(fixtureOf(cup.users[i]))); }
function duoTurn() { const p = duoPending(); if (p.length) { cup.turn = p[0]; cup.team = cup.users[cup.turn]; } saveCup(); }
// keep the two humans apart: never paired in the R32, and on opposite halves (matches 0-7 vs 8-15)
function duoSplit(r32) {
  const [a, b] = cup.users, at = c => r32.findIndex(m => m.includes(c));
  let ia = at(a), ib = at(b);
  if (ia === ib) { const j = ia ^ 1, k = r32[j][0] === a || r32[j][0] === b ? 1 : 0, o = r32[j][k]; r32[ia][r32[ia].indexOf(b)] = o; r32[j][k] = b; ib = j; }
  if ((ia >> 3) === (ib >> 3)) { const j = (ib + 8) % 16; [r32[ib], r32[j]] = [r32[j], r32[ib]]; }
}
function duoTop() {
  const stageTxt = c => { const i = cup.users.indexOf(c); if (!cup.alive[i]) return 'ELIMINATED'; const t = cup.team; cup.team = c; const g = myGroup(); cup.team = t; return cup.stage === 'group' ? `GROUP ${g}` : cup.stage === 'ko' ? KO_NAMES[cup.koRound] : ''; };
  const card = (c, i) => `<div class="duocard p${i + 1}${cup.turn === i && !cup.done ? ' on' : ''}${cup.alive[i] ? '' : ' dead'}">${pTag(c)}${badgeImg(c, 52)}<div><div class="dn">${tName(c)}</div><div class="ds">${stageTxt(c)}</div></div></div>`;
  const fx = !cup.done && myFixture(), vs = fx && fx.every(isMe);
  const turn = cup.done ? `<div class="duoturn">${cup.champion && cup.users.includes(cup.champion) ? `<b class="p${cup.users.indexOf(cup.champion) + 1}">PLAYER ${cup.users.indexOf(cup.champion) + 1} WON THE WORLD CUP!</b>` : 'BOTH PLAYERS ARE OUT'}</div>`
    : `<div class="duoturn p${cup.turn + 1}">${vs ? `<b>P1 v P2</b> — HEAD TO HEAD!` : `<b>PLAYER ${cup.turn + 1}'S TURN</b>${cup.turn === 0 && cup.alive[1] ? ' · then P2' : cup.turn === 1 && cup.alive[0] ? ' · P1 already played' : ''}`}</div>`;
  const top = el('div', 'cuptop duo', `${card(cup.users[0], 0)}<div class="duomid"><div class="ct1">2P WORLD CUP</div><div class="ct2">${cup.stage === 'group' ? 'MATCHDAY ' + (cup.md + 1) + ' OF 3' : cup.stage === 'ko' ? KO_NAMES[cup.koRound] : 'FINISHED'}</div>${turn}</div>${card(cup.users[1], 1)}`);
  ui.appendChild(top);
  if (cup.intro) { cup.intro = false; saveCup(); if (cup.replaced.length) ui.appendChild(el('div', 'duonote', cup.replaced.map(([c, w]) => `${badgeImg(c, 22)} <b>${tName(c)}</b> takes the place of ${badgeImg(w, 22)} ${tName(w)}`).join(' &nbsp;·&nbsp; '))); }
}
function trophyScreen() {
  screen = 'trophy'; clearUI(); ui.className = 'menu trophy'; sfx('cheer', 1); sfx('vo_champ', 1);
  ui.appendChild(el('img', 'bigtrophy')).src = A + 'ui/trophy.webp';
  ui.appendChild(el('h2', '', cup.duo ? `PLAYER ${cup.users.indexOf(cup.team) + 1} WINS THE WORLD CUP!` : 'WORLD CHAMPIONS!'));
  const cr = el('div', 'champrow', `${badgeImg(cup.team, 120)}<span>${byCode(cup.team).name.toUpperCase()}</span>`); cr.insertBefore(charCanvas(cup.team, 'cele', 200, 260, 1), cr.firstChild); ui.appendChild(cr);
  const row = el('div', 'row'); row.appendChild(btn('CONTINUE', 'gold', cupHub)); ui.appendChild(row);
  for (let i = 0; i < 6; i++) setTimeout(() => sfx('firework', 0.6), i * 500);
}

/* ---------------- pause & touch ---------------- */
let paused = false;
function togglePause() {
  if (screen !== 'match' || match.state === 'end') return;
  paused = !paused;
  if (paused) {
    clearUI(); ui.className = 'menu pause';
    ui.appendChild(el('h2', '', 'PAUSED'));
    const col = el('div', 'col');
    col.appendChild(btn('RESUME', 'green', togglePause));
    col.appendChild(btn('QUIT MATCH', 'red', () => { paused = false; crowd(false); cup && screen === 'match' && cup.stage !== 'done' ? cupHub() : showTitle(); }));
    ui.appendChild(col); ui.appendChild(soundToggle());
  } else { clearUI(); hudDom(); }
}
function hudDom() {
  const p = el('button', 'iconbtn pausebtn'); p.innerHTML = `<img src="${A}ui/btn1.webp">`; p.onclick = togglePause; ui.appendChild(p);
  if (isTouch) {
    const tc = el('div', 'touch');
    const mk = (cls, key, html) => { const b = el('div', 'tbtn ' + cls, html); const on = e => { e.preventDefault(); initAudio(); if (!touch[key]) touchPressed[key] = true; touch[key] = true; b.classList.add('down'); }; const off = e => { e.preventDefault(); touch[key] = false; b.classList.remove('down'); }; b.addEventListener('touchstart', on); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); return b; };
    tc.appendChild(mk('l', 'left', '◀')); tc.appendChild(mk('r', 'right', '▶'));
    tc.appendChild(mk('j', 'jump', '▲')); tc.appendChild(mk('k', 'kick', 'KICK')); tc.appendChild(mk('p', 'power', '⚡'));
    ui.appendChild(tc);
  }
}
const isTouch = 'ontouchstart' in window;
addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); });

/* ---------------- main loop ---------------- */
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sw = innerWidth, sh = innerHeight; scale = Math.min(sw / W, sh / H);
  cv.width = Math.round(sw * dpr); cv.height = Math.round(sh * dpr); cv.style.width = sw + 'px'; cv.style.height = sh + 'px';
  offX = (sw - W * scale) / 2; offY = (sh - H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  const root = document.getElementById('stage'); root.style.width = W + 'px'; root.style.height = H + 'px';
  root.style.transform = `translate(${offX}px,${offY}px) scale(${scale})`;
}
addEventListener('resize', resize);
let last = performance.now(), wasMatch = false;
function frame(now) {
  let dt = Math.min(0.033, (now - last) / 1000); last = now;
  const realDt = dt;
  if (slowmo > 0) { slowmo -= dt; dt *= 0.35; }
  let frozenFrame = false;
  if (hitstop > 0) { hitstop -= realDt; frozenFrame = true; }
  const inMatch = screen === 'match';
  if (inMatch && !wasMatch) { clearUI(); hudDom(); }
  wasMatch = inMatch;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#050913'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
  ctx.save();
  if (shake > 0) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake = Math.max(0, shake - dt * 40); }
  if (inMatch) {
    if (!paused && !frozenFrame) updateMatch(dt);
    // broadcast-style punch-in toward the net on goals
    // live camera: drifts toward the ball, leans in when it's near a goal, punches in on goals and power shots
    const live = match.state === 'play' || match.state === 'kickoff';
    const nearGoal = live ? clamp((Math.abs(ball.x - W / 2) - 300) / 260, 0, 1) : 0;
    let zT = 1 + nearGoal * 0.05 + camKick; if (match.state === 'goal') zT = 1.1;
    if (window.__REPLAY && window.__REPLAY.on) zT = 1.12;
    camKick = Math.max(0, camKick - realDt * 0.15);
    cam.z += (zT - cam.z) * Math.min(1, realDt * 3.2);
    const fx = match.scorer === 0 ? W - 160 : 160;
    const txC = match.state === 'goal' ? fx : (window.__REPLAY && window.__REPLAY.on) ? window.__REPLAY.camX : live ? W / 2 + (ball.x - W / 2) * 0.9 : W / 2;
    cam.x += (txC - cam.x) * Math.min(1, realDt * 3.2);
    const tyC = live ? clamp(ball.y + 120, CROSSBAR, GROUND) : GROUND; cam.y += (tyC - cam.y) * Math.min(1, realDt * 2.5);
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    drawWorld(dt);
    const [a, b] = match.players;
    drawWeather(dt, false);
    if (match.state === 'replay') drawReplay();
    else {
      drawPowerups();
      if (match.state !== 'intro') { drawPlayer(b); drawPlayer(a); }
      drawBall();
    }
    drawGoal(0, true); drawGoal(1, true);
    drawParticles(paused || frozenFrame ? 0 : dt);
    drawPops(paused ? 0 : realDt);
    drawWeather(paused ? 0 : realDt, true);
    ctx.restore();
    if (match.state === 'replay') drawReplayChrome(); else drawHUD(dt);
    drawSpecial(paused ? 0 : dt);
    drawIntro();
    drawBanner(paused ? 0 : dt);
    if (match.state === 'kickoff' && match.kickoffT > 0) { }
  } else if (match.demo && match.players.length && (screen === 'title' || screen === 'select' || screen === 'cup')) {
    updateMatch(dt); drawWorld(dt); const [a, b] = match.players; drawPlayer(b); drawPlayer(a); drawBall(); drawGoal(0, true); drawGoal(1, true); drawParticles(dt);
    ctx.fillStyle = screen === 'title' ? 'rgba(6,12,32,0.35)' : 'rgba(6,12,32,0.62)'; ctx.fillRect(0, 0, W, H);
  } else {
    drawMenuBG(dt);
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(-20, -20, W + 40, H + 40); flash = Math.max(0, flash - dt * 1.6); }
  ctx.restore();
  if (menuChars.length) { const tt = performance.now() / 1000; for (const m of menuChars) if (m.c.isConnected) renderChar(m.c, m.code, m.pose, tt, m.dir); }
  for (const k in pressed) pressed[k] = false; for (const k in touchPressed) touchPressed[k] = false;
  requestAnimationFrame(frame);
}
let menuT = 0, camKick = 0; const cam = { z: 1, x: W / 2, y: GROUND };
function drawMenuBG(dt) {
  menuT += dt;
  if (IMG.menubg) { const z = 1.04 + Math.sin(menuT * 0.2) * 0.02; ctx.drawImage(IMG.menubg, W / 2 - W * z / 2, H / 2 - H * z / 2, W * z, H * z); }
  else if (IMG.stadium) ctx.drawImage(IMG.stadium, 0, 0, W, H);
  else { ctx.fillStyle = '#0b1a3a'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(6,12,32,0.45)'; ctx.fillRect(0, 0, W, H);
}

/* ---------------- boot ---------------- */
async function boot() {
  resize();
  const bar = document.getElementById('loadbar');
  const list = [['stadium', 'env/stadium.webp'], ['pitch', 'env/pitch.webp'], ['goal', 'env/goal.webp'], ['menubg', 'env/menubg.webp'],
    ['ball', 'ui/ball.webp'], ['scoreboard', 'ui/scoreboard.webp'], ['meter', 'ui/meter.webp'], ['goaltext', 'ui/goaltext.webp'], ['fireball', 'ui/fireball.webp'], ['trophy', 'ui/trophy.webp'],
    ['arm', 'rig/arm.webp'], ['thigh', 'rig/thigh.webp'], ['shin', 'rig/shin.webp']];
  for (let i = 0; i < 8; i++) list.push(['body' + i, `body/pose${i}.webp`]);
  for (const t of TEAMS) { list.push(['head_' + t.code, `heads/${t.code}.webp`], ['kit_' + t.code, `kits/${t.code}.webp`], ['badge_' + t.code, `badges/${t.code}.webp`]); }
  const snds = ['menu', 'match', 'crowd', 'cheer', 'kick', 'header', 'bounce', 'post', 'whistle', 'whistle_end', 'power', 'charge', 'hit', 'jump', 'whoosh', 'click', 'tick', 'firework', 'fanfare', 'vo_goal', 'vo_power', 'vo_champ', 'vo_golden', 'vo_kickoff', 'vo_half', 'vo_fulltime'];
  let done = 0; const total = list.length + snds.length;
  const tick = () => { done++; bar.style.width = (done / total * 100) + '%'; };
  await Promise.all([...list.map(([k, s]) => loadImg(k, A + s).then(tick)), ...snds.map(k => loadSound(k, `${A}audio/${k}.mp3`).then(tick))]);
  window.__IMG = IMG; try { BODY.prepTemplate([0, 1, 2, 3, 4, 5, 6, 7].map(i => IMG['body' + i])); } catch (e) { console.error(e); }
  document.getElementById('loading').remove();
  showTitle(); requestAnimationFrame(frame);
}
window.__HL = { match, ball, startMatch, pu, grantPU, callout, PU, get REC() { return REC; }, showTitle, teamSelect, get cup() { return cup; }, newCup, cupHub, rigShot: (code, fields, dir = 1) => { const c = document.createElement('canvas'); c.width = 220; c.height = 300; const c2 = c.getContext('2d'); c2.fillStyle = '#3a8a3a'; c2.fillRect(0, 0, 220, 300); c2.setTransform(1, 0, 0, 1, 110, 284 - GROUND); const pl = new Player(dir > 0 ? 0 : 1, code, true, 'menu'); Object.assign(pl, { x: 0, y: GROUND, onGround: true, vx: 0, vy: 0, anim: 1 }, fields); ctx = c2; try { drawPlayer(pl, { menu: true }); } finally { ctx = mainCtx; } return c.toDataURL(); }, advanceGroup, advanceKO, myFixture, table, saveCup, setCup: c => cup = c };
/* =====================================================================
   FULL WORLD CUP — every FIFA nation, six continental qualifiers,
   the intercontinental play-off, the final draw, then the finals.
   ===================================================================== */
(() => {
/* ---------------- nations ---------------- */
const WT = WORLD_ROWS.map(r => ({ code: r[0], name: r[1], iso: r[2], conf: r[3], rating: r[4], primary: r[5], secondary: r[6], accent: r[7], pool: r[8], pname: r[9], skin: r[10], lon: r[11], lat: r[12] }));
const WMAP = {}; WT.forEach(t => WMAP[t.code] = t);
// a few nations whose shirts aren't their flag's main colour
const KIT = {
  ITA: { primary: '#1F5FB8', secondary: '#FFFFFF', kit: { base: '#1F5FB8', d: 'thin', a: '#FFFFFF' } }, UKR: { primary: '#FFD700', secondary: '#0057B8' },
  PER: { primary: '#FFFFFF', secondary: '#D91023', kit: { base: '#FFFFFF', d: 'sash', a: '#D91023' } }, JAM: { primary: '#FED100', secondary: '#009B3A' },
  CMR: { primary: '#007A5E', secondary: '#CE1126' }, NGA: { primary: '#008751', secondary: '#FFFFFF', kit: { base: '#008751', d: 'chevron', a: '#FFFFFF' } },
  WAL: { primary: '#C8102E', secondary: '#FFFFFF' }, IRL: { primary: '#169B62', secondary: '#FFFFFF' }, NIR: { primary: '#00843D', secondary: '#FFFFFF' },
  GRE: { primary: '#FFFFFF', secondary: '#0D5EAF', kit: { base: '#FFFFFF', d: 'thin', a: '#0D5EAF' } }, HON: { primary: '#FFFFFF', secondary: '#0073CF' },
  SLV: { primary: '#0F47AF', secondary: '#FFFFFF' }, THA: { primary: '#0A2E8C', secondary: '#FFFFFF' }, UAE: { primary: '#FFFFFF', secondary: '#C8102E' },
  CHI: { primary: '#D52B1E', secondary: '#0039A6' }, BOL: { primary: '#007934', secondary: '#FFFFFF' }, VEN: { primary: '#8A1538', secondary: '#FFFFFF' },
  CRC: { primary: '#CE1126', secondary: '#002B7F' }, ZAM: { primary: '#198A00', secondary: '#FFFFFF' }, MLI: { primary: '#14B53A', secondary: '#FCD116' },
  DEN: { primary: '#C8102E', secondary: '#FFFFFF' }, HUN: { primary: '#CE2939', secondary: '#FFFFFF' }, SRB: { primary: '#C6363C', secondary: '#FFFFFF' },
  POL: { primary: '#FFFFFF', secondary: '#DC143C' }, ISL: { primary: '#02529C', secondary: '#FFFFFF' }, FIN: { primary: '#FFFFFF', secondary: '#002F6C' },
};
let idx = 48;
for (const t of WT) {
  if (!t.pool) continue;   // already one of the 48 built-in nations
  const k = KIT[t.code] || {};
  WORLD_BY[t.code] = { code: t.code, name: t.name, group: null, primary: k.primary || t.primary, secondary: k.secondary || t.secondary, accent: t.accent, idx: idx++, kit: k.kit };
  RATING[t.code] = t.rating;
  PLAYERS[t.code] = { name: t.pname, skin: t.skin };
}
const nm = c => (byCode(c) || WMAP[c] || { name: c }).name;
const NM = c => (FIFA_NAME[c] || nm(c).toUpperCase());
const flag = (c, cls = 'wflag') => flagTag(c, cls);
const R = c => RATING[c] || 50;

// every nation has its own head; the 162 extra ones live in a few atlas sheets
const HSHEET = [];
function headSheet(s) {
  if (!HSHEET[s]) { const i = new Image(), o = HSHEET[s] = { img: i, ok: false, wait: [] }; i.onload = () => { o.ok = true; o.wait.splice(0).forEach(f => f()); }; i.src = `${A}headsheet/heads${s}.webp`; }
  return HSHEET[s];
}
function cutHead(code) {
  const [s, x, y, w, h] = HEAD_ATLAS.r[code], c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(HSHEET[s].img, x, y, w, h, 0, 0, w, h);
  IMG['head_' + code] = c; prep.own[code] = 1; if (VIS[code]) delete VIS[code];
}
for (let s = 0; s < HEAD_ATLAS.n; s++) headSheet(s);
// make sure a nation's art is ready before a match / preview (own head from the atlas, lazy badge)
function prep(code) {
  const t = WMAP[code]; if (!t || !t.pool) return;
  if (!prep.own[code] && HEAD_ATLAS.r[code]) {
    const sh = headSheet(HEAD_ATLAS.r[code][0]);
    if (sh.ok) cutHead(code);
    else { if (!IMG['head_' + code] && IMG['head_' + t.pool]) IMG['head_' + code] = IMG['head_' + t.pool]; if (!sh.wait.includes(prep.q[code] ||= () => cutHead(code))) sh.wait.push(prep.q[code]); }
  }
  if (!IMG['head_' + code] && IMG['head_' + t.pool]) IMG['head_' + code] = IMG['head_' + t.pool];
  if (!IMG['badge_' + code] && !prep.loading[code]) { prep.loading[code] = 1; const i = new Image(); i.onload = () => { IMG['badge_' + code] = i; if (VIS[code]) delete VIS[code]; }; i.src = `${A}badges/${code}.webp`; }
  if (VIS[code] && !VIS[code].badge && IMG['badge_' + code]) delete VIS[code];
}
prep.loading = {}; prep.own = {}; prep.q = {};
window.FW_prep = codes => codes.forEach(prep);
function preloadAll() { WT.forEach(t => prep(t.code)); }

/* ---------------- confederations ---------------- */
const CONF = {
  UEFA: { name: 'EUROPE', full: 'UEFA', col: '#7fa6ff', center: [15, 50], places: '16 places', fmt: '12 groups, home & away. Group winners qualify. Runners-up + 4 wildcards fight through play-off paths for the last 4 places.' },
  CONMEBOL: { name: 'SOUTH AMERICA', full: 'CONMEBOL', col: '#ffd36b', center: [-60, -18], places: '6 places + 1 play-off', fmt: 'One 10-team league, everyone plays everyone home & away. Top 6 qualify, 7th goes to the intercontinental play-off.' },
  CONCACAF: { name: 'NORTH & CENTRAL AMERICA', full: 'CONCACAF', col: '#ff9a8a', center: [-88, 22], places: '3 places + 2 play-off (+3 hosts)', fmt: 'Hosts USA, Mexico & Canada are in. Round 1 knockouts, Round 2 groups of 5, Round 3 groups of 4: winners qualify, best 2 runners-up to the play-off.' },
  CAF: { name: 'AFRICA', full: 'CAF', col: '#8fe39a', center: [20, 3], places: '9 places + 1 play-off', fmt: '9 groups of 6, home & away. Group winners qualify. The 4 best runners-up play off for an intercontinental spot.' },
  AFC: { name: 'ASIA', full: 'AFC', col: '#f7a7e1', center: [92, 28], places: '8 places + 1 play-off', fmt: 'Five rounds: knockouts, groups of 4, groups of 6 (top 2 qualify), mini-groups for 2 more places, then a play-off.' },
  OFC: { name: 'OCEANIA', full: 'OFC', col: '#84e6f0', center: [168, -18], places: '1 place + 1 play-off', fmt: 'Preliminary group, then two groups of 4, then semis and a final. Winner qualifies, runner-up to the play-off.' },
};
const CONF_KEYS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
const HOSTS = ['USA', 'MEX', 'CAN'];
const confTeams = k => WT.filter(t => t.conf === k).map(t => t.code);
const W_QUAL = 23, W_TOTAL = 25;   // matchday windows: 23 for qualifying, 2 for the intercontinental play-off

/* ---------------- helpers ---------------- */
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const byRating = a => a.slice().sort((x, y) => R(y) - R(x));
function roundRobin(teams, double) {
  const t = teams.slice(); if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const md = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) md.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(md); t.splice(1, 0, t.pop());
  }
  return double ? rounds.concat(rounds.map(md => md.map(([a, b]) => [b, a]))) : rounds;
}
function sim(h, a, homeAdv = 2) {
  const lam = (r1, r2) => Math.max(0.15, 1.3 + (r1 - r2) * 0.055);
  const pois = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
  return [pois(lam(R(h) + homeAdv, R(a))), pois(lam(R(a), R(h) + homeAdv))];
}
function snakeGroups(teams, nGroups, sizes) {   // seeded pots, one per group, shuffled within pots
  const s = byRating(teams), groups = Array.from({ length: nGroups }, () => []);
  for (let p = 0; p * nGroups < s.length; p++) {
    const pot = shuffle(s.slice(p * nGroups, (p + 1) * nGroups));
    const open = groups.map((g, i) => i).filter(i => groups[i].length < sizes[i]);
    pot.forEach((c, k) => groups[open[k % open.length]].push(c));
  }
  return groups;
}
const GL = 'ABCDEFGHIJKL';

/* ---------------- stages ----------------
   A stage is: { id, name, kind: 'groups'|'ties'|'ko', md: [[fixtures...]...], ... }
   fixtures are {h, a, g?, tie?} and results live in FW.res[key] = [h, a]. */
function groupsStage(id, name, groups, double, short) {
  const st = { id, name, short: short || name, kind: 'groups', groups: groups.map((t, i) => ({ name: GL[i], teams: t })), md: [] };
  const per = st.groups.map(g => roundRobin(g.teams, double));
  const n = Math.max(...per.map(p => p.length));
  for (let m = 0; m < n; m++) st.md.push(per.flatMap((p, gi) => (p[m] || []).map(([h, a]) => ({ h, a, g: gi }))));
  return st;
}
function tiesStage(id, name, pairs, legs, short) {   // two-legged (legs=2) or single-leg ties, all in parallel
  const st = { id, name, short: short || name, kind: 'ties', ties: pairs.map(([a, b]) => ({ a, b, legs, w: null })), md: [] };
  st.md.push(st.ties.map((t, i) => ({ h: t.a, a: t.b, tie: i, leg: 0 })));
  if (legs === 2) st.md.push(st.ties.map((t, i) => ({ h: t.b, a: t.a, tie: i, leg: 1 })));
  return st;
}
function koStage(id, name, pairs, short, labels) {   // single-leg knockout over several rounds (semis -> final)
  const st = { id, name, short: short || name, kind: 'ko', rounds: [pairs.map(([a, b]) => ({ a, b, w: null }))], md: [], labels: labels || ['SEMI-FINAL', 'FINAL'] };
  st.md.push(st.rounds[0].map((t, i) => ({ h: t.a, a: t.b, r: 0, tie: i })));
  return st;
}
const rkey = (st, f) => `${st.id}|${f.h}-${f.a}`;
function table(st, gi) {
  const g = st.groups[gi], rows = g.teams.map(code => ({ code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })), f = c => rows.find(r => r.code === c);
  for (const md of st.md) for (const fx of md) {
    if (fx.g !== gi) continue; const r = FW.res[rkey(st, fx)]; if (!r) continue;
    const H = f(fx.h), Aw = f(fx.a); H.p++; Aw.p++; H.gf += r[0]; H.ga += r[1]; Aw.gf += r[1]; Aw.ga += r[0];
    if (r[0] > r[1]) { H.w++; Aw.l++; H.pts += 3; } else if (r[0] < r[1]) { Aw.w++; H.l++; Aw.pts += 3; } else { H.d++; Aw.d++; H.pts++; Aw.pts++; }
  }
  return rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || R(y.code) - R(x.code));
}
const rankRows = rows => rows.slice().sort((x, y) => (y.pts / Math.max(1, y.p)) - (x.pts / Math.max(1, x.p)) || (y.gf - y.ga) / Math.max(1, y.p) - (x.gf - x.ga) / Math.max(1, x.p) || R(y.code) - R(x.code));
function tieWinner(st, i) {
  const t = st.ties[i]; const r1 = FW.res[`${st.id}|${t.a}-${t.b}`], r2 = t.legs === 2 ? FW.res[`${st.id}|${t.b}-${t.a}`] : null;
  if (!r1 || (t.legs === 2 && !r2)) return null;
  const ga = r1[0] + (r2 ? r2[1] : 0), gb = r1[1] + (r2 ? r2[0] : 0);
  if (ga !== gb) return ga > gb ? t.a : t.b;
  if (t.pens) return t.pens;
  t.pens = Math.random() < R(t.a) / (R(t.a) + R(t.b)) ? t.a : t.b;   // shoot-out
  return t.pens;
}
function koWinner(st, r, i) {
  const t = st.rounds[r][i], res = FW.res[`${st.id}|${t.a}-${t.b}`]; if (!res) return null;
  if (res[0] !== res[1]) return res[0] > res[1] ? t.a : t.b;
  if (!t.pens) t.pens = Math.random() < R(t.a) / (R(t.a) + R(t.b)) ? t.a : t.b;
  return t.pens;
}

/* ---------------- the six qualifying competitions ---------------- */
// each plan: total matchdays M, start(cs) builds stage 0, resolve(cs, st) -> next stage or null
const PLANS = {
  UEFA: {
    M: 12,
    start: () => { const g = snakeGroups(confTeams('UEFA'), 12, [5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4]); return groupsStage('UEFA1', 'GROUP STAGE', g, true, 'GROUPS'); },
    resolve(cs, st) {
      if (st.id === 'UEFA1') {
        const tabs = st.groups.map((g, i) => table(st, i));
        tabs.forEach((t, i) => qualify(t[0].code, 'UEFA', `Won UEFA Group ${GL[i]}`));
        const ru = tabs.map(t => t[1]); const thirds = rankRows(tabs.map(t => t[2])).slice(0, 4);
        tabs.forEach(t => t.slice(2).forEach(r => { if (!thirds.includes(r)) eliminate(r.code, 'UEFA group stage'); }));
        thirds.forEach(r => news(`${flag(r.code)} <b>${NM(r.code)}</b> grab a play-off lifeline as a Nations League wildcard`, 'ue'));
        const seeds = byRating(ru.map(r => r.code)), rest = shuffle(byRating(seeds.slice(8)).concat(thirds.map(r => r.code)));
        const top = shuffle(seeds.slice(0, 8)), pairs = top.map((c, i) => [c, rest[i]]);
        return koStage('UEFA2', 'PLAY-OFFS', pairs, 'PLAY-OFFS', ['PLAY-OFF SEMI-FINAL', 'PLAY-OFF FINAL']);
      }
      if (st.id === 'UEFA2') { st.rounds[1].forEach((t, i) => { const w = koWinner(st, 1, i); qualify(w, 'UEFA', 'Won a UEFA play-off path'); eliminate(w === t.a ? t.b : t.a, 'UEFA play-off final'); }); return null; }
    },
    koNext(st) { const w = st.rounds[0].map((t, i) => koWinner(st, 0, i)); st.rounds[0].forEach((t, i) => eliminate(w[i] === t.a ? t.b : t.a, 'UEFA play-off semi-final')); return [[w[0], w[1]], [w[2], w[3]], [w[4], w[5]], [w[6], w[7]]]; },
  },
  CONMEBOL: {
    M: 18,
    start: () => groupsStage('CSA1', 'LEAGUE', [confTeams('CONMEBOL')], true, 'LEAGUE'),
    resolve(cs, st) { const t = table(st, 0); t.slice(0, 6).forEach((r, i) => qualify(r.code, 'CONMEBOL', `Finished ${i + 1}${['st', 'nd', 'rd', 'th', 'th', 'th'][i]} in CONMEBOL`)); toIC(t[6].code, 'CONMEBOL', 'Finished 7th in CONMEBOL'); t.slice(7).forEach(r => eliminate(r.code, 'CONMEBOL league')); return null; },
  },
  CAF: {
    M: 12,
    start: () => groupsStage('CAF1', 'GROUP STAGE', snakeGroups(confTeams('CAF'), 9, Array(9).fill(6)), true, 'GROUPS'),
    resolve(cs, st) {
      if (st.id === 'CAF1') {
        const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach((t, i) => qualify(t[0].code, 'CAF', `Won CAF Group ${GL[i]}`));
        const ru = rankRows(tabs.map(t => t[1])), best = ru.slice(0, 4).map(r => r.code);
        tabs.forEach(t => t.slice(1).forEach(r => { if (!best.includes(r.code)) eliminate(r.code, 'CAF group stage'); }));
        return koStage('CAF2', 'PLAY-OFF', [[best[0], best[3]], [best[1], best[2]]], 'PLAY-OFF', ['PLAY-OFF SEMI-FINAL', 'PLAY-OFF FINAL']);
      }
      const t = st.rounds[1][0], w = koWinner(st, 1, 0); toIC(w, 'CAF', 'Won the CAF play-off'); eliminate(w === t.a ? t.b : t.a, 'CAF play-off final'); return null;
    },
    koNext(st) { const w = st.rounds[0].map((t, i) => koWinner(st, 0, i)); st.rounds[0].forEach((t, i) => eliminate(w[i] === t.a ? t.b : t.a, 'CAF play-off semi-final')); return [[w[0], w[1]]]; },
  },
  AFC: {
    M: 23,
    start: () => { const s = byRating(confTeams('AFC')), low = s.slice(26); const pairs = []; for (let i = 0; i < 10; i++) pairs.push([low[i], low[19 - i]]); return tiesStage('AFC1', 'ROUND 1', pairs, 2, 'ROUND 1'); },
    resolve(cs, st) {
      if (st.id === 'AFC1') {
        const win = st.ties.map((t, i) => tieWinner(st, i)); st.ties.forEach((t, i) => eliminate(win[i] === t.a ? t.b : t.a, 'AFC Round 1'));
        const seeded = cs.carry || byRating(confTeams('AFC')).slice(0, 26);
        return groupsStage('AFC2', 'ROUND 2', snakeGroups(seeded.concat(win), 9, Array(9).fill(4)), true, 'ROUND 2');
      }
      if (st.id === 'AFC2') { const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach(t => t.slice(2).forEach(r => eliminate(r.code, 'AFC Round 2'))); return groupsStage('AFC3', 'ROUND 3', snakeGroups(tabs.flatMap(t => [t[0].code, t[1].code]), 3, [6, 6, 6]), true, 'ROUND 3'); }
      if (st.id === 'AFC3') {
        const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach((t, i) => { qualify(t[0].code, 'AFC', `Won AFC Round 3 Group ${GL[i]}`); qualify(t[1].code, 'AFC', `2nd in AFC Round 3 Group ${GL[i]}`); t.slice(4).forEach(r => eliminate(r.code, 'AFC Round 3')); });
        return groupsStage('AFC4', 'ROUND 4', snakeGroups(tabs.flatMap(t => [t[2].code, t[3].code]), 2, [3, 3]), false, 'ROUND 4');
      }
      if (st.id === 'AFC4') { const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach((t, i) => { qualify(t[0].code, 'AFC', `Won AFC Round 4 Group ${GL[i]}`); t.slice(2).forEach(r => eliminate(r.code, 'AFC Round 4')); }); return tiesStage('AFC5', 'ROUND 5 PLAY-OFF', [[tabs[0][1].code, tabs[1][1].code]], 2, 'ROUND 5'); }
      const t = st.ties[0], w = tieWinner(st, 0); toIC(w, 'AFC', 'Won the AFC Round 5 play-off'); eliminate(w === t.a ? t.b : t.a, 'AFC Round 5'); return null;
    },
  },
  CONCACAF: {
    M: 13,
    start: () => { const s = byRating(confTeams('CONCACAF').filter(c => !HOSTS.includes(c))), low = s.slice(28); return tiesStage('CCF1', 'ROUND 1', [[low[0], low[3]], [low[1], low[2]]], 2, 'ROUND 1'); },
    resolve(cs, st) {
      if (st.id === 'CCF1') { const win = st.ties.map((t, i) => tieWinner(st, i)); st.ties.forEach((t, i) => eliminate(win[i] === t.a ? t.b : t.a, 'CONCACAF Round 1')); const seeded = byRating(confTeams('CONCACAF').filter(c => !HOSTS.includes(c))).slice(0, 28); return groupsStage('CCF2', 'ROUND 2', snakeGroups(seeded.concat(win), 6, Array(6).fill(5)), false, 'ROUND 2'); }
      if (st.id === 'CCF2') { const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach(t => t.slice(2).forEach(r => eliminate(r.code, 'CONCACAF Round 2'))); return groupsStage('CCF3', 'ROUND 3', snakeGroups(tabs.flatMap(t => [t[0].code, t[1].code]), 3, [4, 4, 4]), true, 'ROUND 3'); }
      const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach((t, i) => qualify(t[0].code, 'CONCACAF', `Won CONCACAF Round 3 Group ${GL[i]}`));
      const ru = rankRows(tabs.map(t => t[1])); ru.slice(0, 2).forEach(r => toIC(r.code, 'CONCACAF', 'Best runner-up in CONCACAF Round 3')); eliminate(ru[2].code, 'CONCACAF Round 3'); tabs.forEach(t => t.slice(2).forEach(r => eliminate(r.code, 'CONCACAF Round 3')));
      return null;
    },
  },
  OFC: {
    M: 8,
    start: () => { const s = byRating(confTeams('OFC')); return groupsStage('OFC1', 'PRELIMINARY', [s.slice(7)], false, 'PRELIM'); },
    resolve(cs, st) {
      if (st.id === 'OFC1') { const t = table(st, 0); t.slice(1).forEach(r => eliminate(r.code, 'OFC preliminary round')); return groupsStage('OFC2', 'ROUND 2', snakeGroups(byRating(confTeams('OFC')).slice(0, 7).concat([t[0].code]), 2, [4, 4]), false, 'ROUND 2'); }
      if (st.id === 'OFC2') { const tabs = st.groups.map((g, i) => table(st, i)); tabs.forEach(t => t.slice(2).forEach(r => eliminate(r.code, 'OFC Round 2'))); return koStage('OFC3', 'FINAL ROUND', [[tabs[0][0].code, tabs[1][1].code], [tabs[1][0].code, tabs[0][1].code]], 'FINALS', ['OFC SEMI-FINAL', 'OFC FINAL']); }
      const t = st.rounds[1][0], w = koWinner(st, 1, 0); qualify(w, 'OFC', 'Won the OFC final'); toIC(w === t.a ? t.b : t.a, 'OFC', 'OFC final runner-up'); return null;
    },
    koNext(st) { const w = st.rounds[0].map((t, i) => koWinner(st, 0, i)); st.rounds[0].forEach((t, i) => eliminate(w[i] === t.a ? t.b : t.a, 'OFC semi-final')); return [[w[0], w[1]]]; },
  },
};
const FWtmp = {};

/* ---------------- campaign state ---------------- */
let FW = null;
const save = () => store.set('hl_fwc', FW);
window.FW_hasSave = () => { const s = store.get('hl_fwc', null); return !!(s && s.v === 1 && !s.done); };
window.FW_saveCup = c => { if (!FW) return; FW.cup = c; if (c.done) FW.done = !!c.champion; save(); };

function news(html, cls = '') { const n = { w: FW.win, html, cls }; FW.news.unshift(n); FW.fresh.push(n); if (FW.news.length > 80) FW.news.length = 80; }
function qualify(code, conf, how) {
  if (!code || FW.status[code] === 'q') return;
  FW.status[code] = 'q'; FW.qualified.push({ code, conf, how, w: FW.win }); FW.how[code] = how;
  news(`${flag(code)} <b>${NM(code)}</b> QUALIFY FOR THE WORLD CUP! <i>${how}</i>`, code === FW.team ? 'me q' : 'q');
  if (code === FW.team) FW.popup = { kind: 'q', text: 'QUALIFIED!', sub: how };
}
function eliminate(code, where) {
  if (!code || FW.status[code] === 'q' || FW.status[code] === 'out') return;
  FW.status[code] = 'out'; FW.how[code] = 'Out in ' + where;
  if (code === FW.team) { FW.popup = { kind: 'out', text: 'ELIMINATED', sub: 'Knocked out in ' + where }; news(`${flag(code)} <b>${NM(code)}</b> are knocked out in ${where}`, 'me out'); }
  else if (R(code) >= 76) news(`SHOCK! ${flag(code)} <b>${NM(code)}</b> are out of the World Cup race`, 'out');
}
function toIC(code, conf, how) { if (!code) return; FW.status[code] = 'ic'; FW.how[code] = how; FW.ic.push(code); news(`${flag(code)} <b>${NM(code)}</b> head to the intercontinental play-off <i>${how}</i>`, code === FW.team ? 'me ic' : 'ic'); if (code === FW.team) FW.popup = { kind: 'ic', text: 'STILL ALIVE!', sub: 'Into the intercontinental play-off' }; }

function newCampaign(team, diff) {
  FW = { v: 1, team, diff, win: 0, phase: 'qual', conf: {}, res: {}, status: {}, how: {}, qualified: [], ic: [], icStage: null, news: [], fresh: [], popup: null, draw: null, cup: null, finalsTeam: null, done: false, started: Date.now() };
  HOSTS.forEach(h => { FW.status[h] = 'q'; FW.how[h] = 'Tournament host'; FW.qualified.push({ code: h, conf: 'CONCACAF', how: 'Tournament host', w: 0 }); });
  for (const k of CONF_KEYS) { const cs = { key: k, mdDone: 0, stages: [] }; FW.conf[k] = cs; cs.stages.push(PLANS[k].start(cs)); cs.si = 0; cs.mi = 0; }
  news(`The road to the World Cup begins! <b>210 nations</b>, 48 places. Hosts ${flag('USA')}${flag('MEX')}${flag('CAN')} are already in.`, 'big');
  FW.fresh = []; save();
}

/* windows: which matchday each confederation plays in window w */
const windowOf = (k, key) => Math.floor(k * W_QUAL / PLANS[key].M);
function curStage(key) { const cs = FW.conf[key]; return cs && cs.si < cs.stages.length ? cs.stages[cs.si] : null; }
function dueFixtures(w) {   // [{key, st, fx}] scheduled in window w
  const out = [];
  if (w < W_QUAL) {
    for (const k of CONF_KEYS) { const cs = FW.conf[k], st = curStage(k); if (!st || cs.mdDone >= PLANS[k].M || windowOf(cs.mdDone, k) !== w) continue; for (const fx of st.md[cs.mi] || []) out.push({ key: k, st, fx }); }
  } else if (FW.icStage) { const st = FW.icStage, mi = w - W_QUAL; for (const fx of st.md[mi] || []) out.push({ key: 'IC', st, fx }); }
  return out;
}
function myFixture() {
  if (FW.phase !== 'qual') return null;
  return dueFixtures(FW.win).find(d => d.fx.h === FW.team || d.fx.a === FW.team) || null;
}
// play out window w: every fixture without a result gets simulated, then stages advance
function runWindow() {
  const w = FW.win; FW.fresh = [];
  const due = dueFixtures(w);
  for (const d of due) { const k = rkey(d.st, d.fx); if (!FW.res[k]) FW.res[k] = sim(d.fx.h, d.fx.a, d.st.id === 'IC' ? 0 : 2); }
  headlines(due);
  if (w < W_QUAL) {
    for (const k of CONF_KEYS) {
      const cs = FW.conf[k], st = curStage(k); if (!st || cs.mdDone >= PLANS[k].M || windowOf(cs.mdDone, k) !== w) continue;
      cs.mdDone++; cs.mi++;
      if (st.kind === 'ko' && cs.mi === st.md.length && st.rounds.length === 1) { const pairs = PLANS[k].koNext(st); st.rounds.push(pairs.map(([a, b]) => ({ a, b, w: null }))); st.md.push(st.rounds[1].map((t, i) => ({ h: t.a, a: t.b, r: 1, tie: i }))); continue; }
      if (cs.mi >= st.md.length) { const nx = PLANS[k].resolve(cs, st); st.done = true; cs.si++; cs.mi = 0; if (nx) cs.stages.push(nx); }
    }
  } else if (FW.icStage) {
    const st = FW.icStage, mi = w - W_QUAL;
    if (mi === 0) { const w0 = st.rounds[0].map((t, i) => koWinner(st, 0, i)); st.rounds[0].forEach((t, i) => eliminate(w0[i] === t.a ? t.b : t.a, 'the intercontinental play-off')); st.rounds.push([{ a: st.seeds[0], b: w0[0], w: null }, { a: st.seeds[1], b: w0[1], w: null }]); st.md.push(st.rounds[1].map((t, i) => ({ h: t.a, a: t.b, r: 1, tie: i }))); }
    if (mi === 1) { st.rounds[1].forEach((t, i) => { const wn = koWinner(st, 1, i); qualify(wn, CONF_OF(wn), 'Won the intercontinental play-off'); eliminate(wn === t.a ? t.b : t.a, 'the intercontinental play-off final'); }); st.done = true; }
  }
  FW.win++;
  if (FW.win === W_QUAL && !FW.icStage) buildIC();
  if (FW.win >= W_TOTAL) { FW.phase = 'draw'; news(`Qualifying is over! The <b>48 nations</b> are set. Time for the FINAL DRAW.`, 'big'); }
  save();
}
const CONF_OF = c => (WMAP[c] || {}).conf;
function buildIC() {
  const s = byRating(FW.ic.slice(0, 6));
  while (s.length < 6) s.push(byRating(WT.map(t => t.code).filter(c => !FW.status[c] || FW.status[c] === 'alive'))[0]);
  const st = koStage('IC', 'INTERCONTINENTAL PLAY-OFF', [[s[2], s[5]], [s[3], s[4]]], 'IC PLAY-OFF', ['PLAY-OFF SEMI-FINAL', 'PLAY-OFF FINAL']);
  st.seeds = [s[0], s[1]]; FW.icStage = st;
  news(`The intercontinental play-off is set: ${s.map(c => flag(c)).join('')} fight for the last 2 places. ${NM(s[0])} and ${NM(s[1])} get byes to the finals.`, 'big');
}
function headlines(due) {
  for (const d of due) {
    const r = FW.res[rkey(d.st, d.fx)], { h, a } = d.fx, me = h === FW.team || a === FW.team;
    const mine = me || (d.fx.g != null && d.st.groups && d.st.groups[d.fx.g].teams.includes(FW.team));
    const up = (r[0] > r[1] && R(h) + 12 < R(a)) || (r[1] > r[0] && R(a) + 12 < R(h));
    const thrash = Math.abs(r[0] - r[1]) >= 5;
    if (me) continue;   // your own match is shown separately
    if (mine || up || thrash) news(`${flag(h)} ${NM(h)} <b>${r[0]}-${r[1]}</b> ${NM(a)} ${flag(a)} <i>${up ? 'UPSET!' : thrash ? 'Demolition!' : (d.key === 'IC' ? 'IC play-off' : CONF[d.key].full)}</i>`, up ? 'up' : mine ? 'grp' : '');
  }
}

/* ---------------- screens: shared chrome ---------------- */
const fbgSVG = () => `<svg viewBox="0 0 1280 720" preserveAspectRatio="none"><defs><filter id="fglow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="farc2" x1="0" x2="1"><stop offset="0" stop-color="#3d7bff" stop-opacity="0"/><stop offset=".45" stop-color="#4f8dff"/><stop offset="1" stop-color="#2f5fff" stop-opacity=".1"/></linearGradient></defs>
  <g fill="none" stroke="url(#farc2)" filter="url(#fglow2)" opacity=".7"><ellipse cx="820" cy="330" rx="560" ry="300" stroke-width="4"/><path d="M-40 650 Q 420 380 1320 560" stroke-width="3"/><ellipse cx="1180" cy="40" rx="260" ry="140" stroke-width="3"/></g></svg>`;
function base(cls) { clearUI(); ui.className = 'menu fw ' + cls; ui.appendChild(el('div', 'fbg', fbgSVG())); }

/* ---------------- the globe ---------------- */
let GEO = null;
const geoReady = fetch(A + 'world110.json').then(r => r.json()).then(j => { GEO = j; GEO.features.forEach(f => f.properties.b = d3.geoBounds(f)); }).catch(e => console.error('globe data', e));
function makeGlobe(host, w, h, opts) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = el('canvas', 'globe'); cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; host.appendChild(cv);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const R0 = Math.min(w, h) * 0.44;
  const g = { rot: opts.rot ? opts.rot.slice() : [-10, -20], scale: 1, hover: null, hoverF: null, sel: opts.sel || null, vel: [0, 0], drag: null, idle: 0, fly: null, alive: true };
  const proj = d3.geoOrthographic().translate([w / 2, h / 2]).clipAngle(90).precision(0.6);
  const path = d3.geoPath(proj, c), grat = d3.geoGraticule10();
  const dots = WT.filter(t => !['gb-eng', 'gb-sct', 'gb-wls', 'gb-nir'].includes(t.iso) || true);
  function fillFor(f) {
    const p = f.properties, cf = p.c;
    if (!cf) return '#3a4259'; if (cf === 'RUS') return '#4b5164';
    if (opts.mode === 'status') {
      const st = p.t && FW && FW.status[p.t];
      if (p.t === (FW && FW.team)) return '#3ef08a';
      if (st === 'q') return '#ffc928'; if (st === 'out') return '#566077'; if (st === 'ic') return '#ff9a3c';
    }
    return CONF[cf] ? CONF[cf].col : '#9aa6c4';
  }
  function draw(t) {
    if (!g.alive || !cv.isConnected) { g.alive = false; return; }
    const dt = Math.min(0.05, (t - (g.t || t)) / 1000); g.t = t;
    if (g.fly) { const k = Math.min(1, (t - g.fly.t0) / g.fly.ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; g.rot[0] = g.fly.r0[0] + (g.fly.r1[0] - g.fly.r0[0]) * e; g.rot[1] = g.fly.r0[1] + (g.fly.r1[1] - g.fly.r0[1]) * e; g.scale = g.fly.s0 + (g.fly.s1 - g.fly.s0) * e; if (k >= 1) { const cb = g.fly.cb; g.fly = null; cb && cb(); } }
    else if (!g.drag) {
      g.rot[0] += g.vel[0] * dt; g.rot[1] = Math.max(-80, Math.min(80, g.rot[1] + g.vel[1] * dt)); g.vel[0] *= Math.pow(0.08, dt); g.vel[1] *= Math.pow(0.08, dt);
      g.idle += dt; if (g.idle > 2.2 && !g.hover && Math.abs(g.vel[0]) < 2) g.rot[0] += 6 * dt;
    }
    proj.rotate([g.rot[0], g.rot[1], 0]).scale(R0 * g.scale);
    c.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, rr = R0 * g.scale;
    // atmosphere + ocean
    const at = c.createRadialGradient(cx, cy, rr * 0.9, cx, cy, rr * 1.18); at.addColorStop(0, 'rgba(70,140,255,0.55)'); at.addColorStop(1, 'rgba(70,140,255,0)');
    c.fillStyle = at; c.beginPath(); c.arc(cx, cy, rr * 1.18, 0, 7); c.fill();
    const oc = c.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr); oc.addColorStop(0, '#1d4fa8'); oc.addColorStop(0.7, '#0c2a6b'); oc.addColorStop(1, '#071a45');
    c.fillStyle = oc; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
    c.beginPath(); path(grat); c.strokeStyle = 'rgba(120,170,255,0.13)'; c.lineWidth = 1; c.stroke();
    if (GEO) {
      for (const f of GEO.features) {
        const p = f.properties, hl = g.hover && p.c === g.hover, sel = g.sel && p.c === g.sel;
        c.beginPath(); path(f);
        c.fillStyle = hl ? '#2f80ff' : sel ? '#4b8dff' : fillFor(f); c.fill();
        c.strokeStyle = hl ? 'rgba(220,240,255,0.9)' : 'rgba(10,20,50,0.55)'; c.lineWidth = hl ? 1.1 : 0.6; c.stroke();
      }
      if (g.hover) { c.save(); c.shadowColor = '#5aa0ff'; c.shadowBlur = 18; c.strokeStyle = 'rgba(150,200,255,0.9)'; c.lineWidth = 1.6; for (const f of GEO.features) if (f.properties.c === g.hover) { c.beginPath(); path(f); c.stroke(); } c.restore(); }
    }
    // nation dots (small islands don't show as shapes at this scale)
    const center = [-g.rot[0], -g.rot[1]];
    for (const t2 of WT) {
      if (d3.geoDistance([t2.lon, t2.lat], center) > 1.52) continue;
      const pt = proj([t2.lon, t2.lat]); if (!pt) continue;
      const st = opts.mode === 'status' && FW ? FW.status[t2.code] : null, me = FW && t2.code === FW.team && opts.mode === 'status';
      const small = t2.rating < 52 || ['gb-eng', 'gb-sct', 'gb-wls', 'gb-nir', 'xk', 'mt', 'lu', 'ad', 'sm', 'li', 'gi', 'fo', 'cy'].includes(t2.iso);
      if (!small && !me && opts.mode !== 'status') continue;
      const col = me ? '#3ef08a' : st === 'q' ? '#ffc928' : st === 'out' ? '#7a8399' : st === 'ic' ? '#ff9a3c' : (g.hover === t2.conf ? '#bfe0ff' : '#ffffff');
      c.beginPath(); c.arc(pt[0], pt[1], me ? 4.5 : (opts.mode === 'status' ? 2.6 : 2.1) * Math.sqrt(g.scale), 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(5,10,30,0.8)'; c.stroke();
      if (me) { c.beginPath(); c.arc(pt[0], pt[1], 9 + Math.sin(t / 200) * 3, 0, 7); c.strokeStyle = 'rgba(62,240,138,0.7)'; c.lineWidth = 2; c.stroke(); }
    }
    // confederation labels
    c.textAlign = 'center';
    for (const k of CONF_KEYS) {
      const cc = CONF[k].center; if (d3.geoDistance(cc, center) > 1.25) continue;
      const pt = proj(cc); if (!pt) continue;
      const on = g.hover === k;
      c.font = `${on ? 800 : 700} ${on ? 19 : 14}px "Barlow Condensed", sans-serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(4,10,30,0.85)'; c.strokeText(CONF[k].name, pt[0], pt[1]); c.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.88)'; c.fillText(CONF[k].name, pt[0], pt[1]);
      if (on) { c.font = '700 13px "Barlow Condensed", sans-serif'; c.strokeText(k, pt[0], pt[1] + 16); c.fillStyle = '#9fd0ff'; c.fillText(k, pt[0], pt[1] + 16); }
    }
    // rim shine
    const sh = c.createRadialGradient(cx - rr * 0.45, cy - rr * 0.5, 0, cx - rr * 0.45, cy - rr * 0.5, rr * 1.1); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
    requestAnimationFrame(draw);
  }
  function pick(x, y) {
    const cx = w / 2, cy = h / 2, rr = R0 * g.scale; if ((x - cx) ** 2 + (y - cy) ** 2 > rr * rr) return null;
    const ll = proj.invert([x, y]); if (!ll || !GEO) return null;
    for (const f of GEO.features) { const b = f.properties.b; if (ll[1] < b[0][1] - 1 || ll[1] > b[1][1] + 1) continue; if (d3.geoContains(f, ll)) return f; }
    // near a nation dot?
    let best = null, bd = 9;
    for (const t2 of WT) { const pt = proj([t2.lon, t2.lat]); if (!pt || d3.geoDistance([t2.lon, t2.lat], [-g.rot[0], -g.rot[1]]) > 1.5) continue; const d = Math.hypot(pt[0] - x, pt[1] - y); if (d < bd) { bd = d; best = t2; } }
    return best ? { properties: { c: best.conf, t: best.code, n: best.name } } : null;
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const p = pos(e); g.drag = { p, r: g.rot.slice(), moved: 0, t: performance.now(), last: p }; g.vel = [0, 0]; g.idle = 0; });
  cv.addEventListener('pointermove', e => {
    const p = pos(e); g.idle = 0;
    if (g.drag) {
      const k = 90 / (R0 * g.scale); const dx = p[0] - g.drag.p[0], dy = p[1] - g.drag.p[1]; g.drag.moved = Math.max(g.drag.moved, Math.hypot(dx, dy));
      g.rot[0] = g.drag.r[0] + dx * k; g.rot[1] = Math.max(-80, Math.min(80, g.drag.r[1] - dy * k));
      const now = performance.now(), ddt = Math.max(1, now - g.drag.t) / 1000; g.vel = [(p[0] - g.drag.last[0]) * k / ddt, -(p[1] - g.drag.last[1]) * k / ddt]; g.drag.last = p; g.drag.t = now;
      return;
    }
    const f = pick(p[0], p[1]); const cf = f && CONF[f.properties.c] ? f.properties.c : null;
    if (cf !== g.hover) { g.hover = cf; opts.onHover && opts.onHover(cf, f); } else if (f && opts.onHoverF) opts.onHoverF(f);
    if (opts.onHoverF && f !== g.hoverF) { g.hoverF = f; opts.onHoverF(f); }
    cv.style.cursor = cf ? 'pointer' : 'grab';
  });
  const up = e => {
    if (!g.drag) return; const d = g.drag; g.drag = null;
    if (d.moved < 6) { const p = pos(e); const f = pick(p[0], p[1]); const cf = f && CONF[f.properties.c] ? f.properties.c : null; if (cf && opts.onPick) opts.onPick(cf, f); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { g.drag = null; });
  cv.addEventListener('pointerleave', () => { if (!g.drag && g.hover) { g.hover = null; opts.onHover && opts.onHover(null); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); g.scale = Math.max(0.8, Math.min(2.6, g.scale * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: false });
  g.flyTo = (ll, s, ms, cb) => { const r1 = [-ll[0], -ll[1]]; let d0 = r1[0] - g.rot[0]; d0 = ((d0 + 540) % 360) - 180; g.fly = { r0: g.rot.slice(), r1: [g.rot[0] + d0, r1[1]], s0: g.scale, s1: s, t0: performance.now(), ms, cb }; };
  g.setHover = k => { g.hover = k; };
  geoReady.then(() => requestAnimationFrame(draw));
  return g;
}

/* ---------------- 1. pick a confederation on the globe ---------------- */
// duo = { step: 0|1, p1 } when picking nations for the 2-player World Cup
window.FW_new = (duo) => {
  initAudio && initAudio(); preloadAll();
  screen = 'fwglobe'; base('fwglobe' + (duo ? ' duo p' + (duo.step + 1) : '')); music('menu'); crowd(false);
  ui.appendChild(el('div', 'fwtitle', duo ? `<div class="fwt1">2P WORLD CUP</div><div class="fwt2">PLAYER ${duo.step + 1} — SPIN THE GLOBE &amp; PICK ANY NATION${duo.p1 ? ` · P1 HAS ${NM(duo.p1)}` : ''}</div>`
    : `<div class="fwt1">FULL WORLD CUP</div><div class="fwt2">ROAD TO 2026 · 210 NATIONS · 48 PLACES</div>`));
  const wrap = el('div', 'fwgwrap'); ui.appendChild(wrap);
  const left = el('div', 'fwgside l', `<div class="fwhint">SPIN THE GLOBE<br><small>drag to rotate · scroll to zoom</small><br><br>CLICK A CONTINENT<br><small>to pick your nation from its qualifiers</small></div>`); wrap.appendChild(left);
  const host = el('div', 'fwghost'); wrap.appendChild(host);
  const info = el('div', 'fwgside r'); wrap.appendChild(info);
  const showInfo = k => {
    if (!k) { info.innerHTML = `<div class="fwci none">HOVER OVER A CONTINENT</div><div class="fwcl">${CONF_KEYS.map(c => `<div class="fwcrow"><i style="background:${CONF[c].col}"></i>${CONF[c].name}<b>${confTeams(c).length}</b></div>`).join('')}</div>`; return; }
    const t = confTeams(k);
    info.innerHTML = `<div class="fwci"><div class="fwcn">${CONF[k].name}</div><div class="fwck">${CONF[k].full}</div>
      <div class="fwcs"><b>${t.length}</b> nations · <b>${CONF[k].places}</b></div><div class="fwcf">${CONF[k].fmt}</div>
      <div class="fwflags">${byRating(t).slice(0, 18).map(c => flag(c)).join('')}</div><div class="fwgo">CLICK TO ENTER ›</div></div>`;
  };
  showInfo(null);
  const G = makeGlobe(host, 560, 560, {
    mode: 'select', rot: [-15, -25],
    onHover: k => { showInfo(k); if (k) sfx('tick', 0.25, 1.6); },
    onPick: k => { sfx('click', 0.6); G.flyTo(CONF[k].center, 1.9, 650, () => confPick(k, duo)); },
  });
  const row = el('div', 'row'); row.appendChild(btn('BACK', 'red', () => duo && duo.step ? FW_new({ step: 0 }) : showTitle())); ui.appendChild(row);
};

/* ---------------- 2. pick a nation from that confederation ---------------- */
function confPick(k, duo) {
  screen = 'fwconf'; base('select fifa fwconf' + (duo ? ' duo p' + (duo.step + 1) : ''));
  ui.appendChild(el('h2', '', duo ? `PLAYER ${duo.step + 1} · PICK YOUR ${CONF[k].name} NATION` : `${CONF[k].name} · ${CONF[k].full} QUALIFIERS`));
  const wrap = el('div', 'selwrap'); const grid = el('div', 'grid fgrid fwlist'); const prev = el('div', 'preview');
  const teams = WT.filter(t => t.conf === k).sort((a, b) => a.name.localeCompare(b.name));
  const cols = teams.length > 40 ? 5 : teams.length > 20 ? 4 : teams.length > 10 ? 3 : 2;
  grid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  let cur = byRating(teams.map(t => t.code).filter(c => !duo || c !== duo.p1))[0];
  function showPrev(code) {
    cur = code; prep(code); const t = byCode(code), pl = PLAYERS[code];
    const host = !duo && HOSTS.includes(code), in48 = TEAMS.some(t => t.code === code);
    prev.innerHTML = `<div class="pflag">${flagTag(code)}</div><div class="pname">${NM(code)}</div><div class="pgroup">${CONF[k].full}${host ? ' · HOST NATION' : ''}</div>
      <div class="pchar"></div><div class="pstar">★ ${pl.name}</div><div class="prate">RATING ${R(code)}</div>${host ? '<div class="phost">Already qualified as host! Watch the world fight for places, then play the finals.</div>' : ''}${duo ? `<div class="phost">${in48 ? 'Already one of the 48 — keeps its group spot.' : 'Not one of the 48 — takes the place of the weakest team in the draw.'}</div>` : ''}`;
    menuChars = menuChars.filter(m => m.c.isConnected);
    prev.querySelector('.pchar').appendChild(charCanvas(code, 'idle', 220, 230, 1));
    grid.querySelectorAll('.cell').forEach(c => c.classList.toggle('on', c.dataset.code === code));
  }
  for (const t of teams) {
    const n = NM(t.code);
    const taken = duo && t.code === duo.p1;
    const c = el('button', 'cell frow' + (!duo && HOSTS.includes(t.code) ? ' host' : '') + (taken ? ' taken' : ''), `${flagTag(t.code, 'fflag')}<span class="fbar"${n.length > 16 ? ' style="font-size:11px"' : ''}>${n}</span>`);
    c.dataset.code = t.code; c.onclick = () => { if (taken) return; sfx('click', 0.5); showPrev(t.code); }; c.ondblclick = () => { if (!taken) go(); };
    grid.appendChild(c);
  }
  wrap.appendChild(grid); wrap.appendChild(prev); ui.appendChild(wrap);
  const go = () => { if (duo) return duo.step ? WC2_new(duo.p1, cur) : FW_new({ step: 1, p1: cur }); newCampaign(cur, settings.difficulty); hub('road'); };
  const row = el('div', 'row'); row.appendChild(btn('GLOBE', 'red', () => FW_new(duo))); row.appendChild(btn(duo ? (duo.step ? 'START 2P WORLD CUP' : 'NEXT: PLAYER 2') : 'START CAMPAIGN', 'green', go)); ui.appendChild(row);
  setTimeout(() => showPrev(cur), 0);
}

/* ---------------- 3. the hub: Road to 2026 ---------------- */
window.FW_continue = () => { FW = store.get('hl_fwc', null); if (!FW) return FW_new(); preloadAll(); if (FW.phase === 'finals' && FW.cup) { cup = FW.cup; cupHub(); } else if (FW.phase === 'draw') drawScreen(); else hub('road'); };
let hubTab = 'road', worldSel = null;
function stageLabel(key) {
  if (key === 'IC') return 'INTERCONTINENTAL PLAY-OFF';
  const st = curStage(key); if (!st) return 'COMPLETE';
  return `${CONF[key].full} · ${st.name}`;
}
function myKey() { return FW.status[FW.team] === 'ic' || (FW.icStage && FW.icStage.rounds.flat().some(t => t.a === FW.team || t.b === FW.team)) ? 'IC' : CONF_OF(FW.team); }
function hub(tab) {
  hubTab = tab || hubTab; screen = 'fwhub'; base('fwhub'); music('menu'); crowd(false);
  const me = FW.team, st = FW.status[me];
  const qn = FW.qualified.length;
  const head = el('div', 'fwhead', `<div class="fwme">${flag(me, 'fwmeflag')}<div><div class="fwmen">${NM(me)}</div><div class="fwmes">${st === 'q' ? '<b class="q">QUALIFIED</b> · ' + (FW.how[me] || '') : st === 'out' ? '<b class="o">ELIMINATED</b> · ' + (FW.how[me] || '') : st === 'ic' ? '<b class="ic">INTERCONTINENTAL PLAY-OFF</b>' : stageLabel(CONF_OF(me))}</div></div></div>
    <div class="fwprog"><div class="fwpw">${FW.phase === 'qual' ? (FW.win < W_QUAL ? `QUALIFYING WINDOW ${FW.win + 1} / ${W_QUAL}` : 'INTERCONTINENTAL PLAY-OFF') : 'QUALIFYING COMPLETE'}</div>
    <div class="fwbar"><i style="width:${Math.min(100, FW.win / W_TOTAL * 100)}%"></i></div></div>
    <div class="fwqc"><b>${qn}</b><span>/48<br>QUALIFIED</span></div>`);
  ui.appendChild(head);
  const tabs = el('div', 'fwtabs');
  [['road', 'MY ROAD'], ['world', 'AROUND THE WORLD'], ['board', 'WORLD CUP 2026']].forEach(([k, n]) => { const b = el('button', 'fwtab' + (hubTab === k ? ' on' : ''), n); b.onclick = () => { sfx('click', 0.4); hub(k); }; tabs.appendChild(b); });
  ui.appendChild(tabs);
  const body = el('div', 'fwbody'); ui.appendChild(body);
  if (hubTab === 'road') roadTab(body); else if (hubTab === 'world') worldTab(body); else boardTab(body);
  hubRow();
  if (FW.popup) { const p = FW.popup; FW.popup = null; save(); popup(p); }
}
function hubRow() {
  const row = el('div', 'row fwrow');
  row.appendChild(btn('MENU', 'red', showTitle));
  if (FW.phase === 'draw') { row.appendChild(btn('FINAL DRAW', 'gold', drawScreen)); ui.appendChild(row); return; }
  const fx = myFixture();
  if (fx) {
    const opp = fx.fx.h === FW.team ? fx.fx.a : fx.fx.h, home = fx.fx.h === FW.team;
    row.appendChild(el('div', 'next fwnext', `${flag(FW.team)}<span>vs</span>${flag(opp)}<div><b>${NM(opp)}</b><small>${matchLabel(fx)}${home ? ' · HOME' : ' · AWAY'}</small></div>`));
    row.appendChild(btn('SIM', '', () => { const r = sim(fx.fx.h, fx.fx.a, fx.st.id === 'IC' ? 0 : 2); FW.res[rkey(fx.st, fx.fx)] = r; runWindow(); hub('road'); }));
    row.appendChild(btn('PLAY MATCH', 'green', () => playMine(fx)));
  } else {
    const alive = !FW.status[FW.team] || FW.status[FW.team] === 'ic';
    row.appendChild(btn('NEXT WINDOW', '', () => { runWindow(); hub(); }));
    row.appendChild(btn(alive ? 'SIM TO MY MATCH' : 'SIM TO THE DRAW', 'green', () => {
      let n = 0; do { runWindow(); n++; } while (FW.phase === 'qual' && !myFixture() && n < 30 && !(alive && FW.popup));
      hub();
    }));
  }
  ui.appendChild(row);
}
function matchLabel(d) {
  const st = d.st, fx = d.fx;
  const comp = d.key === 'IC' ? 'IC PLAY-OFF' : CONF[d.key].full;
  if (st.kind === 'groups') { const gi = fx.g, md = st.md.findIndex(m => m.includes(fx)) + 1; return `${comp} · ${st.short}${st.groups.length > 1 ? ' · GROUP ' + GL[gi] : ''} · MD ${md}/${st.md.length}`; }
  if (st.kind === 'ties') return `${comp} · ${st.short} · ${fx.leg ? '2ND LEG' : '1ST LEG'}`;
  return `${comp} · ${st.labels[fx.r] || st.short}`;
}
function playMine(d) {
  const st = d.st, fx = d.fx, me = FW.team, home = fx.h === me, opp = home ? fx.a : fx.h;
  let agg = null, ko = false;
  if (st.kind === 'ties' && fx.leg === 1) { const r1 = FW.res[`${st.id}|${fx.a}-${fx.h}`]; if (r1) { agg = home ? [r1[1], r1[0]] : [r1[0], r1[1]]; ko = true; } }
  if (st.kind === 'ko') ko = true;
  prep(me); prep(opp);
  startMatch({
    home: me, away: opp, difficulty: FW.diff, knockout: ko, agg, label: matchLabel(d),
    onEnd: (s0, s1) => {
      FW.res[rkey(st, fx)] = home ? [s0, s1] : [s1, s0];
      runWindow();
      resultScreen(me, opp, s0, s1, () => hub('road'), null);
      const b = document.querySelector('.result .row .mbtn span'); if (b) b.textContent = 'CONTINUE';
    },
  });
}
function popup(p) {
  const o = el('div', 'fwpop ' + p.kind, `<div class="fwpbox">${flag(FW.team, 'fwpflag')}<div class="fwpt">${p.text}</div><div class="fwps">${p.sub || ''}</div></div>`);
  ui.appendChild(o); sfx(p.kind === 'out' ? 'whistle_end' : 'fanfare', 0.8); if (p.kind === 'q') for (let i = 0; i < 4; i++) setTimeout(() => sfx('firework', 0.5), i * 400);
  o.onclick = () => o.remove(); setTimeout(() => o.isConnected && o.classList.add('fade'), 2600); setTimeout(() => o.remove(), 3200);
}

// --- tab: my road ---
function groupTableHTML(st, gi, big) {
  const t = table(st, gi), me = FW.team;
  const qn = (st.id === 'UEFA1' || st.id === 'CAF1' || st.id === 'OFC1') ? 1 : st.id === 'CSA1' ? 6 : st.id === 'AFC3' ? 2 : st.id === 'AFC4' ? 1 : st.id === 'CCF3' ? 1 : st.id === 'OFC3' ? 0 : 2;
  const po = st.id === 'CSA1' ? 7 : st.id === 'AFC3' ? 4 : st.id === 'AFC4' ? 2 : st.id === 'CCF3' || st.id === 'UEFA1' ? 2 : st.id === 'CAF1' ? 2 : 0;
  let h = `<div class="fwgt${big ? ' big' : ''}"><div class="fwgth">${st.groups.length > 1 ? 'GROUP ' + GL[gi] : st.name}</div><table><tr><th></th><th></th><th>P</th>${big ? '<th>W</th><th>D</th><th>L</th><th>GD</th>' : ''}<th>PTS</th></tr>`;
  t.forEach((r, i) => {
    const s = FW.status[r.code];
    h += `<tr class="${r.code === me ? 'me' : ''} ${i < qn ? 'qz' : i < po ? 'pz' : ''} ${s === 'out' ? 'dead' : ''}"><td>${flag(r.code, 'tf')}</td><td class="tn">${big ? NM(r.code) : r.code}</td><td>${r.p}</td>${big ? `<td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>` : ''}<td><b>${r.pts}</b></td></tr>`;
  });
  return h + '</table></div>';
}
function tiesHTML(st, highlight) {
  const rows = (st.kind === 'ties' ? [st.ties] : st.rounds).map((round, ri) => `<div class="fwkoround"><div class="fwkoh">${st.kind === 'ties' ? st.name : st.labels[ri]}</div>${round.map((t, i) => {
    const r1 = FW.res[`${st.id}|${t.a}-${t.b}`], r2 = st.kind === 'ties' && t.legs === 2 ? FW.res[`${st.id}|${t.b}-${t.a}`] : null;
    const ga = r1 ? r1[0] + (r2 ? r2[1] : 0) : '', gb = r1 ? r1[1] + (r2 ? r2[0] : 0) : '';
    const w = st.kind === 'ties' ? (r1 && (t.legs === 1 || r2) ? tieWinner(st, i) : null) : (r1 ? koWinner(st, ri, i) : null);
    const mine = t.a === FW.team || t.b === FW.team;
    const legs = st.kind === 'ties' && t.legs === 2 ? `<small>${r1 ? r1.join('-') : '–'} / ${r2 ? r2[1] + '-' + r2[0] : '–'}</small>` : '';
    return `<div class="fwtie${mine ? ' me' : ''}"><div class="${w === t.a ? 'w' : w ? 'l' : ''}">${flag(t.a, 'tf')}<span>${NM(t.a)}</span><b>${ga}</b></div><div class="${w === t.b ? 'w' : w ? 'l' : ''}">${flag(t.b, 'tf')}<span>${NM(t.b)}</span><b>${gb}</b></div>${legs}</div>`;
  }).join('')}</div>`).join('');
  return `<div class="fwko">${rows}</div>`;
}
function stageView(key, st, big) {
  if (!st) return '<div class="fwempty">Stage complete</div>';
  if (st.kind === 'groups') {
    const mineG = st.groups.findIndex(g => g.teams.includes(FW.team));
    if (big && mineG >= 0) return `<div class="fwsv">${groupTableHTML(st, mineG, true)}${st.groups.length > 1 ? `<div class="fwgrid">${st.groups.map((g, i) => i === mineG ? '' : groupTableHTML(st, i, false)).join('')}</div>` : ''}</div>`;
    return `<div class="fwgrid ${st.groups.length === 1 ? 'one' : ''}">${st.groups.map((g, i) => groupTableHTML(st, i, st.groups.length === 1)).join('')}</div>`;
  }
  return tiesHTML(st);
}
const inStage = (s, c) => s.groups ? s.groups.some(g => g.teams.includes(c)) : (s.ties || s.rounds.flat()).some(t => t.a === c || t.b === c);
function myStage() {
  const k = myKey(); if (k === 'IC') return { key: 'IC', st: FW.icStage };
  const cs = FW.conf[k];
  for (let i = cs.stages.length - 1; i >= 0; i--) if (inStage(cs.stages[i], FW.team)) return { key: k, st: cs.stages[i] };
  return { key: k, st: curStage(k) || cs.stages[cs.stages.length - 1], bye: true };   // seeded nations skip the early rounds
}
function roadTab(body) {
  const { key, st, bye } = myStage();
  const left = el('div', 'fwleft'); left.innerHTML = `<div class="fwpanelh">${key === 'IC' ? 'INTERCONTINENTAL PLAY-OFF' : CONF[key].full + ' QUALIFIERS · ' + (st ? st.name : '')}</div>` + (bye ? `<div class="fwbye">${flag(FW.team, 'tf')} <b>${NM(FW.team)}</b> are seeded and skip this round — you enter in the next round. Hit <b>SIM TO MY MATCH</b>.</div>` : '') + stageView(key, st, true);
  if (HOSTS.includes(FW.team)) left.innerHTML = `<div class="fwpanelh">HOST NATION</div><div class="fwhostmsg">${flag(FW.team, 'fwbigflag')}<p><b>${NM(FW.team)}</b> are hosting the World Cup and are already qualified.</p><p>Watch the world fight for the other 45 places in <b>AROUND THE WORLD</b>, then lead your nation at the finals.</p></div>`;
  body.appendChild(left);
  const right = el('div', 'fwright');
  // my fixtures this stage
  let fx = '';
  if (st && !bye && !HOSTS.includes(FW.team)) {
    const mine = st.md.flatMap((md, i) => md.filter(f => f.h === FW.team || f.a === FW.team).map(f => ({ f, i })));
    fx = mine.map(({ f, i }) => { const r = FW.res[rkey(st, f)], home = f.h === FW.team, opp = home ? f.a : f.h; const my = r ? (home ? r[0] : r[1]) : null, th = r ? (home ? r[1] : r[0]) : null; const res = r ? (my > th ? 'W' : my < th ? 'L' : 'D') : '';
      return `<div class="fwfx ${res}"><span class="fwmd">${st.kind === 'groups' ? 'MD' + (i + 1) : st.kind === 'ties' ? (f.leg ? 'LEG 2' : 'LEG 1') : (st.labels[f.r] || '').replace('PLAY-OFF ', '')}</span>${flag(opp, 'tf')}<span class="fwopp">${home ? '' : '@ '}${NM(opp)}</span>${r ? `<b>${my}-${th}</b><i>${res}</i>` : '<em>—</em>'}</div>`; }).join('');
  }
  right.innerHTML = `<div class="fwpanelh">${HOSTS.includes(FW.team) ? 'QUALIFIED SO FAR' : 'YOUR FIXTURES'}</div><div class="fwfxs">${HOSTS.includes(FW.team) ? `<div class="fwqchips">${FW.qualified.map(q => flag(q.code, 'qf')).join('')}</div>` : fx || '<div class="fwempty">No fixtures</div>'}</div>
    <div class="fwpanelh">AROUND THE WORLD</div><div class="fwnews">${FW.news.slice(0, 14).map(n => `<div class="fwn ${n.cls} ${FW.fresh.includes(n) || n.w >= FW.win - 1 ? 'new' : ''}">${n.html}</div>`).join('')}</div>`;
  body.appendChild(right);
}
// --- tab: around the world ---
function worldTab(body) {
  const left = el('div', 'fwleft globeL'); body.appendChild(left);
  const tip = el('div', 'fwtip', 'Hover a nation · click a continent'); left.appendChild(tip);
  const right = el('div', 'fwright wide'); body.appendChild(right);
  worldSel = worldSel || CONF_OF(FW.team);
  const showConf = k => {
    worldSel = k; const cs = FW.conf[k], st = curStage(k) || cs.stages[cs.stages.length - 1];
    const q = FW.qualified.filter(x => x.conf === k);
    right.innerHTML = `<div class="fwpanelh">${CONF[k].name} · ${CONF[k].full} <span class="fwpl">${st ? (curStage(k) ? st.name : 'FINISHED') : ''}</span></div>
      <div class="fwqrow"><span>QUALIFIED</span>${q.map(x => flag(x.code, 'qf')).join('') || '<em>none yet</em>'}</div>
      <div class="fwscroll">${stageView(k, st, false)}</div>
      ${FW.icStage ? `<div class="fwpanelh">INTERCONTINENTAL PLAY-OFF</div>${tiesHTML(FW.icStage)}` : FW.ic.length ? `<div class="fwqrow"><span>IC PLAY-OFF</span>${FW.ic.map(c => flag(c, 'qf')).join('')}</div>` : ''}`;
  };
  showConf(worldSel);
  const legend = el('div', 'fwlegend', `<span><i class="lq"></i>QUALIFIED</span><span><i class="li"></i>PLAY-OFF</span><span><i class="lo"></i>OUT</span><span><i class="lm"></i>YOU</span>`); left.appendChild(legend);
  const G = makeGlobe(left, 520, 440, {
    mode: 'status', rot: [-(CONF[worldSel].center[0]), -CONF[worldSel].center[1]], sel: worldSel,
    onHoverF: f => { if (!f) { tip.innerHTML = 'Hover a nation · click a continent'; return; } const c = f.properties.t; if (!c || !WMAP[c]) { tip.innerHTML = f.properties.n || ''; return; } const s = FW.status[c]; tip.innerHTML = `${flag(c, 'tf')} <b>${NM(c)}</b> · ${s === 'q' ? '<span class="q">QUALIFIED</span>' : s === 'out' ? '<span class="o">OUT</span>' : s === 'ic' ? '<span class="ic">IC PLAY-OFF</span>' : 'STILL ALIVE'} <small>${FW.how[c] || CONF[WMAP[c].conf].full}</small>`; },
    onPick: k => { sfx('click', 0.4); G.sel = k; showConf(k); },
  });
}
// --- tab: the World Cup board (empty until the draw) ---
function boardHTML(groups, highlight) {
  return `<div class="fwboard">${GL.split('').map(g => `<div class="fgroup"><div class="fgh">GROUP ${g}</div>${[0, 1, 2, 3].map(i => {
    const c = groups && groups[g] ? groups[g][i] : null;
    return c ? `<div class="cell frow fill${highlight === c ? ' pop' : ''}${c === FW.team || c === FW.finalsTeam ? ' on' : ''}">${flagTag(c, 'fflag')}<span class="fbar">${NM(c)}</span></div>`
      : `<div class="cell frow empty"><span class="fflag eflag"></span><span class="fbar">${g}${i + 1}</span></div>`;
  }).join('')}</div>`).join('')}</div>`;
}
function boardTab(body) {
  const pre = { A: ['MEX'], B: ['CAN'], D: ['USA'] };
  const groups = FW.draw ? FW.draw.groups : pre;
  const b = el('div', 'fwboardwrap', boardHTML(groups) + `<div class="fwqrow big"><span>QUALIFIED ${FW.qualified.length}/48</span>${FW.qualified.map(q => flag(q.code, 'qf' + (q.code === FW.team ? ' me' : ''))).join('')}${Array(48 - FW.qualified.length).fill('<i class="qslot"></i>').join('')}</div>`);
  body.appendChild(b);
}

/* ---------------- 4. the final draw ---------------- */
function makeDraw() {
  const q = FW.qualified.map(x => x.code).filter((c, i, a) => a.indexOf(c) === i).slice(0, 48);
  const hosts = { MEX: 'A', CAN: 'B', USA: 'D' };
  const others = byRating(q.filter(c => !hosts[c]));
  const pots = [others.slice(0, 9), others.slice(9, 21), others.slice(21, 33), others.slice(33, 45)];
  for (let attempt = 0; attempt < 400; attempt++) {
    const groups = {}; GL.split('').forEach(g => groups[g] = []);
    Object.entries(hosts).forEach(([c, g]) => groups[g].push(c));
    const order = []; let ok = true;
    Object.entries(hosts).forEach(([c, g]) => order.push([c, g]));
    for (let p = 0; p < 4 && ok; p++) {
      for (const c of shuffle(pots[p])) {
        const cf = CONF_OF(c), lim = cf === 'UEFA' ? 2 : 1, relax = attempt > 300;
        const open = shuffle(GL.split('').filter(g => groups[g].length === p && (relax || groups[g].filter(x => CONF_OF(x) === cf).length < lim)));
        if (!open.length) { ok = false; break; }
        groups[open[0]].push(c); order.push([c, open[0]]);
      }
    }
    if (ok && GL.split('').every(g => groups[g].length === 4)) return { groups, order };
  }
  // fallback: straight seeding
  const groups = {}; GL.split('').forEach((g, i) => groups[g] = []); const all = byRating(q); all.forEach((c, i) => groups[GL[i % 12]].push(c));
  return { groups, order: all.map((c, i) => [c, GL[i % 12]]) };
}
function drawScreen() {
  screen = 'fwdraw'; base('fwdraw'); music('menu');
  if (!FW.draw) { const d = makeDraw(); FW.draw = { groups: null, order: d.order, final: d.groups, shown: 0 }; save(); }
  ui.appendChild(el('div', 'fwtitle small', `<div class="fwt1">THE FINAL DRAW</div><div class="fwt2">48 NATIONS · 12 GROUPS · NO TWO FROM THE SAME CONFEDERATION (EXCEPT EUROPE, MAX 2)</div>`));
  const wrap = el('div', 'fwdrawwrap'); ui.appendChild(wrap);
  const cur = el('div', 'fwdrawn'); ui.appendChild(cur);
  const groups = {}; GL.split('').forEach(g => groups[g] = []);
  let i = 0; const order = FW.draw.order;
  const render = hl => { wrap.innerHTML = boardHTML(groups, hl); };
  render();
  const row = el('div', 'row'); ui.appendChild(row);
  let timer = null;
  const finish = () => { clearInterval(timer); order.forEach(([c, g]) => { if (!groups[g].includes(c)) groups[g].push(c); }); render(); done(); };
  const done = () => {
    FW.draw.groups = FW.draw.final; save(); cur.innerHTML = `<b>THE DRAW IS COMPLETE!</b>`;
    row.innerHTML = ''; row.appendChild(btn('MENU', 'red', showTitle));
    const inIt = FW.qualified.some(q => q.code === FW.team);
    if (!inIt && !FW.finalsTeam) { row.appendChild(btn('PICK A NATION TO LEAD', 'gold', pickFinalsTeam)); return; }
    row.appendChild(btn('KICK OFF THE WORLD CUP!', 'green', startFinals));
  };
  row.appendChild(btn('SKIP', '', finish));
  if (FW.draw.groups) { finish(); return; }
  timer = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(timer); return; }
    if (i >= order.length) { clearInterval(timer); done(); return; }
    const [c, g] = order[i++]; groups[g].push(c); render(c); sfx('click', 0.5, 1 + (i % 4) * 0.1);
    cur.innerHTML = `${flag(c, 'fwdflag')}<span><b>${NM(c)}</b> → GROUP ${g}</span>`;
    if (c === FW.team) sfx('cheer', 0.6);
  }, 380);
}
function pickFinalsTeam() {
  base('select fifa fwconf');
  ui.appendChild(el('h2', '', `${NM(FW.team)} DIDN'T MAKE IT — PICK A NATION TO LEAD AT THE WORLD CUP`));
  const wrap = el('div', 'fwboardwrap pick'); ui.appendChild(wrap);
  wrap.innerHTML = boardHTML(FW.draw.groups);
  let cur = null;
  wrap.querySelectorAll('.cell.fill').forEach((c, k) => { const g = GL[Math.floor(k / 4)], code = FW.draw.groups[g][k % 4]; c.onclick = () => { sfx('click', 0.5); cur = code; wrap.querySelectorAll('.cell').forEach(x => x.classList.remove('on')); c.classList.add('on'); }; c.ondblclick = () => go(); });
  const go = () => { if (!cur) return; FW.finalsTeam = cur; save(); startFinals(); };
  const row = el('div', 'row'); row.appendChild(btn('BACK', 'red', drawScreen)); row.appendChild(btn('LEAD THIS NATION', 'green', go)); ui.appendChild(row);
}
function startFinals() {
  const team = FW.finalsTeam || FW.team;
  FW.qualified.forEach(q => prep(q.code));
  newCup(team, FW.draw.groups, { full: true, diff: FW.diff });
  FW.phase = 'finals'; FW.cup = cup; save(); cupHub();
}
window.FW_debug = { get FW() { return FW; }, runWindow, myFixture, hub, drawScreen, startFinals, newCampaign, confPick, WT, sim, playMine };
})();

boot();
})();
