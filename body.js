/* Full-body pose sprites (Higgsfield-drawn, key-coloured) recoloured per nation at runtime.
   Key colours in the template: shirt = red, shorts = blue, socks = green, skin = peach, boots/outline = dark. */
(() => {
const POSES = 8; // 0 idle, 1 runA, 2 runPass, 3 runB, 4 jump, 5 kick, 6 celebrate, 7 windup
const tpl = [];   // template canvases
const REF = [0, 1, 1, 1];   // per key-colour reference brightness (95th percentile)
const meta = [];  // per-pose: shirt bbox, neck point, feet y
const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const DESIGNS = ['chevron', 'pin', 'band', 'sash', 'yoke', 'fade', 'vee', 'side'];
const OVR = {
  ARG: { base: '#75AADB', d: 'stripes', a: '#FFFFFF' }, PAR: { base: '#D52B1E', d: 'stripes', a: '#FFFFFF' },
  CRO: { base: '#FFFFFF', d: 'checks', a: '#E0201B' }, URU: { base: '#5CBFEB', d: 'thin', a: '#1B2A4A' },
  FRA: { base: '#0B2A6F', d: 'thin', a: '#ED2939' }, GER: { base: '#FFFFFF', d: 'tri', a: ['#000000', '#DD0000', '#FFCE00'] },
  ENG: { base: '#FFFFFF', d: 'sash', a: '#CE1124' }, ESP: { base: '#C60B1E', d: 'yoke', a: '#FFC400' },
  POR: { base: '#9B0D23', d: 'sash', a: '#046A38' }, NED: { base: '#FF6C00', d: 'thin', a: '#21468B' },
  JPN: { base: '#0B2A6F', d: 'pin', a: '#2a4c9a' }, BEL: { base: '#E30613', d: 'yoke', a: '#111111' },
  COL: { base: '#FCD116', d: 'thin', a: '#003893' }, SCO: { base: '#0B2A6F', d: 'sash', a: '#FFFFFF' },
  SEN: { base: '#FFFFFF', d: 'tri', a: ['#00853F', '#FDEF42', '#E31B23'] }, MEX: { base: '#006847', d: 'chevron', a: '#CE1126' },
  SWE: { base: '#FECC02', d: 'side', a: '#006AA7' }, NOR: { base: '#BA0C2F', d: 'tri', a: ['#00205B', '#FFFFFF', '#00205B'] },
  GHA: { base: '#FFFFFF', d: 'tri', a: ['#CE1126', '#FCD116', '#006B3F'] }, KOR: { base: '#CD2E3A', d: 'chevron', a: '#0047A0' },
  BRA: { base: '#FEDD00', d: 'chevron', a: '#009C3B' }, USA: { base: '#FFFFFF', d: 'yoke', a: '#B31942' },
};
function design(team) {
  if (team.kit) return team.kit;
  if (OVR[team.code]) return OVR[team.code];
  const d = DESIGNS[team.idx % 8];
  return { base: team.primary, d, a: d === 'pin' ? team.secondary : team.accent };
}
function sampleShorts(kit) {
  // median colour of the shorts area in the generated kit art
  if (!kit) return null;
  const c = document.createElement('canvas'); c.width = kit.width; c.height = kit.height; const x = c.getContext('2d'); x.drawImage(kit, 0, 0);
  const d = x.getImageData(Math.floor(kit.width * 0.3), Math.floor(kit.height * 0.72), Math.max(1, Math.floor(kit.width * 0.4)), Math.max(1, Math.floor(kit.height * 0.12))).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { const lum = d[i] + d[i + 1] + d[i + 2]; if (lum > 60) px.push([d[i], d[i + 1], d[i + 2], lum]); }
  if (!px.length) return null; px.sort((a, b) => a[3] - b[3]); const m = px[Math.floor(px.length * 0.6)];
  return [m[0], m[1], m[2]];
}
function classify(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
  if (mx < 70) return 0;                         // outline / boots
  if (sat > 0.45) {
    if (r >= g && r >= b && g < r * 0.55 && b < r * 0.55) return 1; // red shirt
    if (b >= r && b >= g && r < b * 0.6) return 2;                   // blue shorts
    if (g >= r && g >= b && r < g * 0.75 && b < g * 0.75) return 3;  // green socks
  }
  if (r > g && g > b && r > 120) return 4;      // skin
  return 5;                                     // other (white highlights, sole, etc.)
}
function prepTemplate(imgs) {
  const hist = [[], [], [], []];
  for (let i = 0; i < POSES; i++) {
    const im = imgs[i]; if (!im) return false;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data, cls = new Uint8Array(c.width * c.height);
    let sx0 = 1e9, sy0 = 1e9, sx1 = -1, sy1 = -1, feet = 0;
    for (let k = 0, j = 0; k < p.length; k += 4, j++) {
      if (p[k + 3] < 30) { cls[j] = 255; continue; }
      const t = classify(p[k], p[k + 1], p[k + 2]); cls[j] = t; if (t >= 1 && t <= 3 && (j & 7) === 0) hist[t].push(Math.max(p[k], p[k + 1], p[k + 2]) / 255);
      const px = j % c.width, py = (j / c.width) | 0;
      if (t === 1) { if (px < sx0) sx0 = px; if (px > sx1) sx1 = px; if (py < sy0) sy0 = py; if (py > sy1) sy1 = py; }
      if (py > feet) feet = py;
    }
    // neck = centroid of the dark collar opening (dark red pixels in the top part of the shirt)
    let nx = 0, ny = 0, n = 0, hy0 = 1e9, hy1 = -1;
    const lim = sy0 + (sy1 - sy0) * 0.3;
    for (let yy = sy0; yy < lim; yy++) for (let xx = sx0; xx <= sx1; xx++) {
      const j = yy * c.width + xx; if (cls[j] !== 1) continue; const k = j * 4;
      if (Math.max(p[k], p[k + 1], p[k + 2]) < 150) { nx += xx; ny += yy; n++; if (yy < hy0) hy0 = yy; if (yy > hy1) hy1 = yy; }
    }
    const neckX = n ? nx / n : (sx0 + sx1) / 2, neckY = n ? ny / n : sy0;
    meta[i] = { spanH: feet - sy0, w: c.width, h: c.height, sx0, sy0, sx1, sy1, neckX, neckY, holeH: n ? hy1 - hy0 : 0, feet, cls, data: d };
    tpl[i] = c;
  }
  for (let t = 1; t <= 3; t++) { const h = hist[t].sort((a, b) => a - b); REF[t] = h.length ? h[Math.floor(h.length * 0.9)] : 1; }
  return true;
}
function patternAt(ds, u, v) {
  // u,v in shirt bbox [0..1]; returns accent colour or null
  const A = ds.a;
  switch (ds.d) {
    case 'stripes': return (Math.floor(u * 7) % 2) ? A : null;
    case 'checks': return ((Math.floor(u * 6) + Math.floor(v * 6)) % 2) ? A : null;
    case 'pin': return (u * 14 % 1) < 0.16 ? A : null;
    case 'band': return v > 0.34 && v < 0.5 ? A : null;
    case 'thin': return v > 0.4 && v < 0.47 ? A : null;
    case 'tri': return v > 0.34 && v < 0.4 ? A[0] : v >= 0.4 && v < 0.46 ? A[1] : v >= 0.46 && v < 0.52 ? A[2] : null;
    case 'sash': return Math.abs((u - 0.15) - (v * 0.9)) < 0.11 ? A : null;
    case 'yoke': return v < 0.24 ? A : null;
    case 'fade': return v > 0.62 + Math.sin(u * 20) * 0.02 ? A : null;
    case 'vee': return v < 0.42 && Math.abs(u - 0.5) * 1.6 > 0.42 - v - 0.08 && Math.abs(u - 0.5) * 1.6 < 0.42 - v + 0.06 ? A : null;
    case 'side': return u < 0.16 || u > 0.84 ? A : null;
    case 'chevron': { const y0 = 0.3 + Math.abs(u - 0.5) * 0.5; return v > y0 && v < y0 + 0.1 ? A : null; }
  }
  return null;
}
const cache = {};
function bodyFor(code) {
  if (cache[code]) return cache[code];
  if (!tpl.length) return null;
  const team = (window.HL_byCode ? window.HL_byCode(code) : TEAMS.find(t => t.code === code)), pl = PLAYERS[code], kit = window.__IMG && window.__IMG['kit_' + code];
  const ds = design(team), base = hex(ds.base);
  const acc = Array.isArray(ds.a) ? ds.a.map(hex) : hex(ds.a);
  const dsx = { d: ds.d, a: acc };
  const shorts = sampleShorts(kit) || hex(team.secondary);
  const sock = hex(team.primary === '#FFFFFF' ? team.secondary : team.primary);
  const skin = hex(pl.skin), skinBase = [242, 200, 168];
  const out = [];
  for (let i = 0; i < POSES; i++) {
    const m = meta[i], c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    const x = c.getContext('2d'), d = new ImageData(new Uint8ClampedArray(m.data.data), m.w, m.h), p = d.data;
    const bw = Math.max(1, m.sx1 - m.sx0), bh = Math.max(1, m.sy1 - m.sy0);
    for (let k = 0, j = 0; k < p.length; k += 4, j++) {
      const t = m.cls[j]; if (t === 255 || t === 0 || t === 5) continue;
      const r = p[k], g = p[k + 1], b = p[k + 2], mx = Math.max(r, g, b) / 255;
      let col;
      if (t === 1) { const u = ((j % m.w) - m.sx0) / bw, v = (((j / m.w) | 0) - m.sy0) / bh; col = patternAt(dsx, u, v) || base; }
      else if (t === 2) col = shorts; else if (t === 3) col = sock;
      else { p[k] = Math.min(255, r * skin[0] / skinBase[0]); p[k + 1] = Math.min(255, g * skin[1] / skinBase[1]); p[k + 2] = Math.min(255, b * skin[2] / skinBase[2]); continue; }
      // keep the cel shading: scale the target colour by the template's brightness, lift highlights
      const sh = Math.min(1.15, mx / REF[t]), lift = Math.max(0, sh - 1) * 255;
      p[k] = Math.min(255, col[0] * Math.min(1, sh) + lift); p[k + 1] = Math.min(255, col[1] * Math.min(1, sh) + lift); p[k + 2] = Math.min(255, col[2] * Math.min(1, sh) + lift);
    }
    x.putImageData(d, 0, 0); out.push(c);
  }
  // soften the recolour seams slightly by redrawing outline pixels untouched (they already are) — done
  cache[code] = out; return out;
}
window.BODY = { POSES, prepTemplate, bodyFor, meta, ready: () => tpl.length === POSES };
})();
