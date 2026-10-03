/*! flowfig v1.1.0 - interactive flow diagrams - MIT License
 *
 * Reads a JSON config from <script type="application/json" id="flowfig-config">
 * (or window.FLOWFIG_CONFIG) and renders it into #flowfig.
 *
 * Architecture
 *   layout tree  -> HTML boxes positioned by flexbox (no coordinates)
 *   edges        -> one SVG overlay; boxes are measured, curves drawn between sides
 *   scenarios    -> timed "beats"; a dot carries a payload along each hop
 *   render(t)    -> EVERYTHING visible is a pure function of (scenario, time),
 *                   which is what makes GIF/MP4 export frame-exact.
 *
 * Public API: window.flowfig (see bottom of file).
 */
(function () {
  'use strict';

  var VERSION = '1.1.0';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Built-in icons: 24x24 viewBox, drawn with stroke="currentColor".
     Kept as strict JSON between the markers so scripts/build.mjs can read it. */
  var ICONS = /*ICONS-START*/{
    "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8\"/>",
    "users": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5\"/><path d=\"M16 4.5a3.5 3.5 0 0 1 0 7\"/><path d=\"M18 13.8c2.1.8 3.5 2.9 3.5 5.2\"/>",
    "browser": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"M6.5 6.5h.01M9 6.5h.01\"/>",
    "mobile": "<rect x=\"7\" y=\"2.5\" width=\"10\" height=\"19\" rx=\"2\"/><path d=\"M11 18.5h2\"/>",
    "desktop": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"1.5\"/><path d=\"M8 20h8M12 16v4\"/>",
    "terminal": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 9l3 3-3 3M12 15h5\"/>",
    "chip": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4\"/>",
    "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18\"/><path d=\"M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z\"/>",
    "signpost": "<path d=\"M12 3v18\"/><path d=\"M5 6h11l3 2.5-3 2.5H5z\"/><path d=\"M19 13H8l-3 2.5L8 18h11z\"/>",
    "balance": "<circle cx=\"12\" cy=\"5\" r=\"2\"/><circle cx=\"5\" cy=\"19\" r=\"2\"/><circle cx=\"12\" cy=\"19\" r=\"2\"/><circle cx=\"19\" cy=\"19\" r=\"2\"/><path d=\"M12 7v10M12 11l-6 6.2M12 11l6 6.2\"/>",
    "gateway": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M10 8.5L7 12l3 3.5M14 8.5l3 3.5-3 3.5\"/>",
    "cloud": "<path d=\"M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.2 4.5 4.5 0 0 0 7 18z\"/>",
    "pin": "<path d=\"M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/>",
    "shield": "<path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/>",
    "wall": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"1\"/><path d=\"M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19\"/>",
    "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"M11 12l9-9M16 7l3 3M14 9l2 2\"/>",
    "lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>",
    "server": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"6.5\" rx=\"1.5\"/><rect x=\"3\" y=\"13.5\" width=\"18\" height=\"6.5\" rx=\"1.5\"/><path d=\"M7 7.25h.01M7 16.75h.01\"/>",
    "braces": "<path d=\"M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3\"/>",
    "lambda": "<path d=\"M6.5 4H10l7.5 16\"/><path d=\"M12.4 10.6L7 20\"/>",
    "box": "<path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9z\"/><path d=\"M4 7.5l8 4.5 8-4.5M12 12v9\"/>",
    "helm": "<path d=\"M12 2.8l7.8 4.5v9L12 20.8l-7.8-4.5v-9z\"/><circle cx=\"12\" cy=\"12\" r=\"2.2\"/><path d=\"M12 5.5v4.3M12 14.2v4.3M6.3 8.7l3.8 2.2M13.9 13.1l3.8 2.2M6.3 15.3l3.8-2.2M13.9 10.9l3.8-2.2\"/>",
    "gear": "<circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1\"/>",
    "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
    "database": "<ellipse cx=\"12\" cy=\"5.5\" rx=\"7.5\" ry=\"2.8\"/><path d=\"M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13\"/><path d=\"M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8\"/>",
    "bolt": "<path d=\"M13 2.5L5 13.5h6l-1 8 8-11h-6z\"/>",
    "bucket": "<ellipse cx=\"12\" cy=\"6\" rx=\"8\" ry=\"2.5\"/><path d=\"M4 6l2 14c.3 1 2.8 1.5 6 1.5s5.7-.5 6-1.5l2-14\"/>",
    "warehouse": "<path d=\"M3 10l9-6 9 6v10H3z\"/><path d=\"M7 20v-6h10v6\"/>",
    "search": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5L21 21\"/>",
    "dots": "<circle cx=\"5\" cy=\"6\" r=\"1.6\"/><circle cx=\"12\" cy=\"4\" r=\"1.6\"/><circle cx=\"19\" cy=\"8\" r=\"1.6\"/><circle cx=\"7\" cy=\"14\" r=\"1.6\"/><circle cx=\"15\" cy=\"13\" r=\"1.6\"/><circle cx=\"10\" cy=\"20\" r=\"1.6\"/><circle cx=\"19\" cy=\"18\" r=\"1.6\"/>",
    "file": "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4M9 12h6M9 16h6\"/>",
    "queue": "<rect x=\"3\" y=\"7\" width=\"4\" height=\"10\" rx=\"1\"/><rect x=\"10\" y=\"7\" width=\"4\" height=\"10\" rx=\"1\"/><rect x=\"17\" y=\"7\" width=\"4\" height=\"10\" rx=\"1\"/>",
    "waves": "<path d=\"M3 8c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 13c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 18c3 0 3-2 6-2s3 2 6 2 3-2 6-2\"/>",
    "broadcast": "<circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14\"/>",
    "mail": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3.5 6.5L12 13l8.5-6.5\"/>",
    "bell": "<path d=\"M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z\"/><path d=\"M10 20.5a2 2 0 0 0 4 0\"/>",
    "pulse": "<path d=\"M3 12h4l2.5-6 4 12 2.5-6H21\"/>",
    "list": "<path d=\"M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01\"/>",
    "chart": "<path d=\"M3 21h18\"/><rect x=\"5\" y=\"11\" width=\"3\" height=\"7\"/><rect x=\"10.5\" y=\"6\" width=\"3\" height=\"12\"/><rect x=\"16\" y=\"13\" width=\"3\" height=\"5\"/>",
    "sparkle": "<path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z\"/><path d=\"M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z\"/>",
    "external": "<path d=\"M14 4h6v6\"/><path d=\"M20 4l-9 9\"/><path d=\"M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5\"/>",
    "card": "<rect x=\"2.5\" y=\"5\" width=\"19\" height=\"14\" rx=\"2\"/><path d=\"M2.5 10h19M6 15h4\"/>",
    "git": "<circle cx=\"6\" cy=\"5\" r=\"2\"/><circle cx=\"6\" cy=\"19\" r=\"2\"/><circle cx=\"18\" cy=\"8\" r=\"2\"/><path d=\"M6 7v10M18 10c0 4-6 3-11.5 7\"/>",
    "pipeline": "<circle cx=\"5\" cy=\"12\" r=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><circle cx=\"19\" cy=\"12\" r=\"2\"/><path d=\"M7 12h3M14 12h3\"/>",
    "rocket": "<path d=\"M12 2.5c3.5 2 5 5.5 5 9.5l-2.5 3h-5L7 12c0-4 1.5-7.5 5-9.5z\"/><circle cx=\"12\" cy=\"9\" r=\"1.6\"/><path d=\"M9.5 18.5L8 21.5M14.5 18.5l1.5 3M12 17.5V21\"/>",
    "code": "<path d=\"M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16\"/>"
  }/*ICONS-END*/;

  /* Component kinds -> default icon, category (icon tint) and shape. */
  var KINDS = /*KINDS-START*/{
    "user": { "icon": "user", "cat": "client", "shape": "pill" },
    "users": { "icon": "users", "cat": "client", "shape": "pill" },
    "client": { "icon": "desktop", "cat": "client" },
    "browser": { "icon": "browser", "cat": "client" },
    "mobile": { "icon": "mobile", "cat": "client" },
    "cli": { "icon": "terminal", "cat": "client" },
    "device": { "icon": "chip", "cat": "client" },
    "cdn": { "icon": "globe", "cat": "network" },
    "dns": { "icon": "signpost", "cat": "network" },
    "lb": { "icon": "balance", "cat": "network" },
    "gateway": { "icon": "gateway", "cat": "network" },
    "network": { "icon": "cloud", "cat": "network" },
    "region": { "icon": "pin", "cat": "network" },
    "waf": { "icon": "shield", "cat": "security" },
    "firewall": { "icon": "wall", "cat": "security" },
    "auth": { "icon": "key", "cat": "security" },
    "secrets": { "icon": "lock", "cat": "security" },
    "service": { "icon": "server", "cat": "compute" },
    "api": { "icon": "braces", "cat": "compute" },
    "function": { "icon": "lambda", "cat": "compute" },
    "container": { "icon": "box", "cat": "compute" },
    "cluster": { "icon": "helm", "cat": "compute" },
    "worker": { "icon": "gear", "cat": "compute" },
    "scheduler": { "icon": "clock", "cat": "compute" },
    "database": { "icon": "database", "cat": "data", "shape": "store" },
    "cache": { "icon": "bolt", "cat": "data", "shape": "store" },
    "storage": { "icon": "bucket", "cat": "data", "shape": "store" },
    "warehouse": { "icon": "warehouse", "cat": "data", "shape": "store" },
    "search": { "icon": "search", "cat": "data", "shape": "store" },
    "vector": { "icon": "dots", "cat": "data", "shape": "store" },
    "file": { "icon": "file", "cat": "data" },
    "queue": { "icon": "queue", "cat": "messaging" },
    "stream": { "icon": "waves", "cat": "messaging" },
    "topic": { "icon": "broadcast", "cat": "messaging" },
    "email": { "icon": "mail", "cat": "messaging" },
    "notification": { "icon": "bell", "cat": "messaging" },
    "monitor": { "icon": "pulse", "cat": "observability" },
    "logs": { "icon": "list", "cat": "observability" },
    "metrics": { "icon": "chart", "cat": "observability" },
    "llm": { "icon": "sparkle", "cat": "ai" },
    "agent": { "icon": "sparkle", "cat": "ai" },
    "external": { "icon": "external", "cat": "external", "style": "dashed" },
    "payment": { "icon": "card", "cat": "external", "style": "dashed" },
    "repo": { "icon": "git", "cat": "devops" },
    "pipeline": { "icon": "pipeline", "cat": "devops" },
    "deploy": { "icon": "rocket", "cat": "devops" },
    "code": { "icon": "code", "cat": "devops" }
  }/*KINDS-END*/;
  var KIND_ALIASES = { db: 'database', k8s: 'cluster', kubernetes: 'cluster', bucket: 'storage', s3: 'storage', lambda: 'function', serverless: 'function', loadbalancer: 'lb', 'load-balancer': 'lb', events: 'topic', pubsub: 'topic', kafka: 'stream', ai: 'llm', idp: 'auth', identity: 'auth', vault: 'secrets', saas: 'external', thirdparty: 'external', ci: 'pipeline', vm: 'service', server: 'service', app: 'service' };

  var UI = {
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="M6 5v14M18 6l-8 6 8 6z"/>',
    next: '<path d="M18 5v14M6 6l8 6-8 6z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    steps: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5.5h1.5v2M4 11.2c.5-.6 2-.6 2 .3 0 .9-2 1.3-2 2.5h2M4 16.5h2l-1 1.2c.8 0 1 .4 1 .8 0 .5-.5.9-1.1.9H4"/>'
  };

  var TONE_VARS = { accent: '--ff-accent', ok: '--ff-ok', warn: '--ff-warn', error: '--ff-error', blue: '--ff-blue', purple: '--ff-purple', green: '--ff-green', orange: '--ff-orange', red: '--ff-red', teal: '--ff-teal', pink: '--ff-pink', gray: '--ff-gray', indigo: '--ff-indigo' };
  var HOP_TONES = { ok: 1, warn: 1, error: 1 };
  var STATUS_BADGE = { ok: '✓', warn: '!', error: '✕', off: '–' };
  var ENCODERS = {
    gifenc: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js',
    mediabunny: 'https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs'
  };

  /* ---------------- small helpers ---------------- */
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    return e;
  }
  function uiIcon(name) {
    var e = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    e.innerHTML = UI[name];
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // motion tokens: travel uses ease-in-out cubic; entering content eases out
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  var DUR = { enter: 320, caption: 240, linger: 260, fade: 320 };
  function toneColor(t) {
    if (!t) return null;
    if (TONE_VARS[t]) return 'var(' + TONE_VARS[t] + ')';
    if (/^(#|rgb|hsl|oklch|color\()/.test(t)) return t;
    return null;
  }
  function kindOf(k) { if (!k) return null; k = String(k).toLowerCase(); return KINDS[k] || KINDS[KIND_ALIASES[k]] || null; }
  function sideName(v) { var m = { t: 't', top: 't', r: 'r', right: 'r', b: 'b', bottom: 'b', l: 'l', left: 'l' }; return m[v] || null; }
  function opposite(sd) { return { t: 'b', b: 't', l: 'r', r: 'l' }[sd]; }
  function lastAt(list, t) { var v; if (!list) return v; for (var i = 0; i < list.length && list[i].t <= t; i++) v = list[i]; return v; }
  function escapeHtml(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function miniMarkdown(x) {
    return escapeHtml(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function slug(x) { return String(x || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow'; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }

  function toHops(v) {
    if (v == null) return [];
    var list = Array.isArray(v) ? v : [v];
    return list.map(function (x) { return typeof x === 'string' ? { edge: x } : Object.assign({}, x); });
  }
  function toItems(content) {
    if (content == null) return null;
    var list = Array.isArray(content) ? content : [content];
    return list.map(function (x) { return typeof x === 'string' ? { text: x } : x; });
  }

  /* ================================================================
     Edge router
     Routes every edge around the boxes on a sparse "channel grid" (A*):
       - boxes are hard obstacles: a line never crosses one
       - a soft margin around boxes is allowed but costs extra, so lines
         keep their distance when there is room
       - bends, crossings and shared channels cost extra
       - parallel lines that still share a channel are nudged apart
     Ports sit exactly on each shape's outline (box, cylinder, pill, the
     back card of a stack), and arrowheads are drawn as fixed-size shapes
     aligned with the last segment, so they always sit on the line.
     ================================================================ */
  var Router = (function () {
    var HARD = 4, SOFT = 16, STUB = 20, BEND = 30, CROSS = 18, SHARE = 1.4, SEP = 7, AROUND = 3, BORDER = 1.6;
    var AL = 9, AW = 4.5; // arrowhead length / half-width
    var OPP = { t: 'b', b: 't', l: 'r', r: 'l' };
    var NRM = { t: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0] };

    function cx(r) { return r.x + r.w / 2; }
    function cy(r) { return r.y + r.h / 2; }
    function grow(r, d) { return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d, id: r.id, soft: r.soft }; }
    function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }
    function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    function unit(a, b) { var dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1; return { x: dx / l, y: dy / l }; }

    /* ---- shapes and ports ---- */
    // Point on a rounded-rect outline for a side and a coordinate along that side
    function outline(b, side, c) {
      var rx = b.rx || 0, ry = b.ry || 0, d = 0, inset;
      if (side === 'l' || side === 'r') {
        if (ry > 0 && c < b.y + ry) d = (b.y + ry - c) / ry; else if (ry > 0 && c > b.y + b.h - ry) d = (c - (b.y + b.h - ry)) / ry;
        inset = rx * (1 - Math.sqrt(Math.max(0, 1 - d * d)));
        return { x: side === 'l' ? b.x + inset : b.x + b.w - inset, y: c, inset: inset };
      }
      if (rx > 0 && c < b.x + rx) d = (b.x + rx - c) / rx; else if (rx > 0 && c > b.x + b.w - rx) d = (c - (b.x + b.w - rx)) / rx;
      inset = ry * (1 - Math.sqrt(Math.max(0, 1 - d * d)));
      return { x: c, y: side === 't' ? b.y + inset : b.y + b.h - inset, inset: inset };
    }
    // Range along a side where ports may sit (the straight part, or the middle of a curved side)
    function usable(b, side) {
      var vert = side === 'l' || side === 'r';
      var len = vert ? b.h : b.w, rad = vert ? (b.ry || 0) : (b.rx || 0), start = vert ? b.y : b.x;
      var lo = start + rad + 3, hi = start + len - rad - 3;
      if (hi - lo < len * 0.35) { var m = start + len / 2, half = len * 0.28; lo = m - half; hi = m + half; }
      return [lo, hi];
    }
    // Ports on the right/bottom of a stacked node sit on the back card
    function face(b, side) {
      if (b.stack && (side === 'r' || side === 'b')) return { x: b.x + b.stack, y: b.y + b.stack, w: b.w, h: b.h, rx: b.rx, ry: b.ry, id: b.id };
      return b;
    }

    function blockedBetween(a, b, axis, hard, skip) {
      var lo, hi, from, to, i, r;
      if (axis === 'v') { lo = Math.max(a.x, b.x); hi = Math.min(a.x + a.w, b.x + b.w); from = Math.min(a.y + a.h, b.y + b.h); to = Math.max(a.y, b.y); }
      else { lo = Math.max(a.y, b.y); hi = Math.min(a.y + a.h, b.y + b.h); from = Math.min(a.x + a.w, b.x + b.w); to = Math.max(a.x, b.x); }
      for (i = 0; i < hard.length; i++) {
        r = hard[i];
        if (skip[r.id]) continue;
        if (axis === 'v' ? (r.x < hi && r.x + r.w > lo && r.y < to && r.y + r.h > from) : (r.y < hi && r.y + r.h > lo && r.x < to && r.x + r.w > from)) return true;
      }
      return false;
    }
    function chooseSides(e, a, b, hard) {
      var sa, sb, skip = {};
      skip[e.from] = skip[e.to] = 1;
      if (e.around) { sa = sb = e.around === 'above' ? 't' : 'b'; }
      else {
        var ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        var oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy <= 0) {
          sa = cy(a) < cy(b) ? 'b' : 't'; sb = OPP[sa];
          if (blockedBetween(a, b, 'v', hard, skip)) sa = sb = 'r';
        } else if (oy > 0 && ox <= 0) {
          sa = cx(a) < cx(b) ? 'r' : 'l'; sb = OPP[sa];
          if (blockedBetween(a, b, 'h', hard, skip)) sa = sb = 'b';
        } else if (ox > 0 && oy > 0) {
          var dx = cx(b) - cx(a), dy = cy(b) - cy(a);
          if (Math.abs(dx) >= Math.abs(dy)) { sa = dx >= 0 ? 'r' : 'l'; } else { sa = dy >= 0 ? 'b' : 't'; }
          sb = OPP[sa];
        } else {
          var gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
          var gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
          if (gx >= 24 || gx >= gy) { sa = cx(a) < cx(b) ? 'r' : 'l'; } else { sa = cy(a) < cy(b) ? 'b' : 't'; }
          sb = OPP[sa];
        }
      }
      if (e.fromSide) { sa = e.fromSide; if (!e.toSide && !e.around) sb = OPP[sa]; }
      if (e.toSide) sb = e.toSide;
      return [sa, sb];
    }

    function assignPorts(plans, boxes) {
      var buckets = {};
      plans.forEach(function (p) {
        [['1', p.e.from, p.sa, p.b], ['2', p.e.to, p.sb, p.a]].forEach(function (x) {
          var k = x[1] + '\u0000' + x[2];
          (buckets[k] = buckets[k] || []).push({ p: p, end: x[0], side: x[2], other: x[3] });
        });
      });
      Object.keys(buckets).forEach(function (k) {
        var list = buckets[k], side = list[0].side, id = k.split('\u0000')[0];
        var box = face(boxes[id], side), vert = side === 'l' || side === 'r';
        var range = usable(box, side), n = list.length, span = range[1] - range[0];
        list.sort(function (m, q) {
          var a = vert ? cy(m.other) : cx(m.other), b = vert ? cy(q.other) : cx(q.other);
          return a - b || (m.p.idx - q.p.idx) * (m.end === '1' ? 1 : -1);
        });
        var gap = n > 1 ? Math.min(18, span / (n - 1)) : 0;
        var mid = clampN(vert ? cy(box) : cx(box), range[0] + gap * (n - 1) / 2, range[1] - gap * (n - 1) / 2);
        list.forEach(function (it, i) {
          it.p['c' + it.end] = mid + (i - (n - 1) / 2) * gap;
          it.p['range' + it.end] = range;
          it.p['n' + it.end] = n;
        });
      });
      // Facing ports with nothing else on their side line up, so the edge is straight
      plans.forEach(function (p) {
        if (OPP[p.sa] !== p.sb) return;
        var facing = p.sa === 'r' ? p.a.x + p.a.w <= p.b.x : p.sa === 'l' ? p.b.x + p.b.w <= p.a.x : p.sa === 'b' ? p.a.y + p.a.h <= p.b.y : p.b.y + p.b.h <= p.a.y;
        if (!facing) return;
        if (p.n1 === 1 && p.n2 === 1) {
          var lo = Math.max(p.range1[0], p.range2[0]), hi = Math.min(p.range1[1], p.range2[1]);
          if (hi >= lo) p.c1 = p.c2 = clampN((p.c1 + p.c2) / 2, lo, hi);
        } else if (p.n1 === 1 && p.c2 >= p.range1[0] && p.c2 <= p.range1[1]) p.c1 = p.c2;
        else if (p.n2 === 1 && p.c1 >= p.range2[0] && p.c1 <= p.range2[1]) p.c2 = p.c1;
      });
      plans.forEach(function (p) {
        p.P1 = outline(face(boxes[p.e.from], p.sa), p.sa, p.c1);
        p.P2 = outline(face(boxes[p.e.to], p.sb), p.sb, p.c2);
      });
    }
    // Free distance from P along a normal before hitting another box
    function freeRun(P, n, hard, own) {
      var best = 1e9;
      for (var i = 0; i < hard.length; i++) {
        var r = hard[i];
        if (r.id === own) continue;
        if (n[0] !== 0) {
          if (P.y <= r.y || P.y >= r.y + r.h) continue;
          var dx = n[0] > 0 ? r.x - P.x : P.x - (r.x + r.w);
          if (dx >= 0 && dx < best) best = dx;
        } else {
          if (P.x <= r.x || P.x >= r.x + r.w) continue;
          var dy = n[1] > 0 ? r.y - P.y : P.y - (r.y + r.h);
          if (dy >= 0 && dy < best) best = dy;
        }
      }
      return best;
    }

    /* ---- channel grid ---- */
    function uniq(list) {
      list.sort(function (a, b) { return a - b; });
      var out = [];
      for (var i = 0; i < list.length; i++) if (!out.length || list[i] - out[out.length - 1] > 0.25) out.push(list[i]);
      return out;
    }
    function lowerIdx(arr, v) { var lo = 0, hi = arr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; }
    function buildGrid(obstacles, groups, extraX, extraY, bounds) {
      var hard = obstacles.map(function (r) { return grow(r, HARD); });
      var soft = obstacles.map(function (r) { return grow(r, SOFT); });
      var xs = [], ys = [], bx = [], by = [];
      soft.forEach(function (r) { if (r.soft !== false) { xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h); } });
      hard.forEach(function (r) { bx.push(r.x, r.x + r.w); by.push(r.y, r.y + r.h); });
      // group boundaries: lines between groups run down the middle of the gap, and just outside each group
      groups.forEach(function (gr) {
        bx.push(gr.x, gr.x + gr.w); by.push(gr.y, gr.y + gr.h);
        xs.push(gr.x - 12, gr.x + gr.w + 12); ys.push(gr.y - 12, gr.y + gr.h + 12);
      });
      bx = uniq(bx); by = uniq(by);
      for (var i = 1; i < bx.length; i++) if (bx[i] - bx[i - 1] > 4) xs.push((bx[i] + bx[i - 1]) / 2);
      for (i = 1; i < by.length; i++) if (by[i] - by[i - 1] > 4) ys.push((by[i] + by[i - 1]) / 2);
      xs = uniq(xs.concat(extraX, [bounds.x0, bounds.x1]));
      ys = uniq(ys.concat(extraY, [bounds.y0, bounds.y1]));
      var nx = xs.length, ny = ys.length, N = nx * ny;
      var blockP = new Uint8Array(N), blockH = new Uint8Array(N), blockV = new Uint8Array(N);
      var nearB = new Uint8Array(N * 2);
      var softH1 = new Int16Array(N).fill(-1), softH2 = new Int16Array(N).fill(-1), softV1 = new Int16Array(N).fill(-1), softV2 = new Int16Array(N).fill(-1);
      hard.forEach(function (r) {
        var i0 = lowerIdx(xs, r.x), i1 = lowerIdx(xs, r.x + r.w), j0 = lowerIdx(ys, r.y), j1 = lowerIdx(ys, r.y + r.h);
        var i, j;
        // points strictly inside
        for (j = j0; j < ny && ys[j] < r.y + r.h; j++) { if (ys[j] <= r.y) continue; for (i = i0; i < nx && xs[i] < r.x + r.w; i++) if (xs[i] > r.x) blockP[j * nx + i] = 1; }
        // horizontal grid edges whose y is strictly inside and whose span overlaps the rect
        for (j = j0; j < ny && ys[j] < r.y + r.h; j++) { if (ys[j] <= r.y) continue; for (i = Math.max(0, i0 - 1); i < nx - 1 && xs[i] < r.x + r.w; i++) if (xs[i + 1] > r.x) blockH[j * nx + i] = 1; }
        // vertical grid edges
        for (i = i0; i < nx && xs[i] < r.x + r.w; i++) { if (xs[i] <= r.x) continue; for (j = Math.max(0, j0 - 1); j < ny - 1 && ys[j] < r.y + r.h; j++) if (ys[j + 1] > r.y) blockV[j * nx + i] = 1; }
      });
      soft.forEach(function (r, si) {
        if (r.soft === false) return;
        var i0 = lowerIdx(xs, r.x), j0 = lowerIdx(ys, r.y), i, j, k;
        for (j = j0; j < ny && ys[j] < r.y + r.h; j++) { if (ys[j] <= r.y) continue; for (i = Math.max(0, i0 - 1); i < nx - 1 && xs[i] < r.x + r.w; i++) if (xs[i + 1] > r.x) { k = j * nx + i; if (softH1[k] === -1) softH1[k] = si; else if (softH2[k] === -1) softH2[k] = si; } }
        for (i = i0; i < nx && xs[i] < r.x + r.w; i++) { if (xs[i] <= r.x) continue; for (j = Math.max(0, j0 - 1); j < ny - 1 && ys[j] < r.y + r.h; j++) if (ys[j + 1] > r.y) { k = j * nx + i; if (softV1[k] === -1) softV1[k] = si; else if (softV2[k] === -1) softV2[k] = si; } }
      });
      // grid edges running along a group border (within 6px) cost extra: a line there reads as part of the box
      groups.forEach(function (gr) {
        var i, j;
        [gr.y, gr.y + gr.h].forEach(function (yb) {
          for (j = lowerIdx(ys, yb - 6); j < ny && ys[j] <= yb + 6; j++) for (i = Math.max(0, lowerIdx(xs, gr.x) - 1); i < nx - 1 && xs[i] < gr.x + gr.w; i++) if (xs[i + 1] > gr.x) nearB[(j * nx + i) * 2] = 1;
        });
        [gr.x, gr.x + gr.w].forEach(function (xb) {
          for (i = lowerIdx(xs, xb - 6); i < nx && xs[i] <= xb + 6; i++) for (j = Math.max(0, lowerIdx(ys, gr.y) - 1); j < ny - 1 && ys[j] < gr.y + gr.h; j++) if (ys[j + 1] > gr.y) nearB[(j * nx + i) * 2 + 1] = 1;
        });
      });
      return { nearB: nearB, xs: xs, ys: ys, nx: nx, ny: ny, blockP: blockP, blockH: blockH, blockV: blockV, softH1: softH1, softH2: softH2, softV1: softV1, softV2: softV2, usedH: new Uint8Array(N), usedV: new Uint8Array(N), ptH: new Uint8Array(N), ptV: new Uint8Array(N), hard: hard, owners: obstacles.map(function (o) { return o.id; }) };
    }
    function nearest(arr, v) {
      var i = lowerIdx(arr, v);
      if (i > 0 && (i >= arr.length || Math.abs(arr[i - 1] - v) <= Math.abs(arr[i] - v))) i--;
      return Math.abs(arr[i] - v) <= 0.3 ? i : -1;
    }
    function cell(G, p) {
      var i = nearest(G.xs, p.x), j = nearest(G.ys, p.y);
      return i < 0 || j < 0 ? -1 : j * G.nx + i;
    }

    /* ---- A* over (point, axis) states ---- */
    function Heap() { this.f = []; this.v = []; }
    Heap.prototype.push = function (f, v) {
      var a = this.f, b = this.v, i = a.length;
      a.push(f); b.push(v);
      while (i > 0) { var p = (i - 1) >> 1; if (a[p] <= f) break; a[i] = a[p]; b[i] = b[p]; i = p; }
      a[i] = f; b[i] = v;
    };
    Heap.prototype.pop = function () {
      var a = this.f, b = this.v, top = b[0], lf = a.pop(), lv = b.pop(), n = a.length, i = 0;
      if (n) {
        while (true) { var l = 2 * i + 1, r = l + 1, m = i, mf = lf; if (l < n && a[l] < mf) { m = l; mf = a[l]; } if (r < n && a[r] < mf) { m = r; mf = a[r]; } if (m === i) break; a[i] = a[m]; b[i] = b[m]; i = m; }
        a[i] = lf; b[i] = lv;
      }
      return top;
    };
    Heap.prototype.size = function () { return this.v.length; };

    function astar(G, s, t, o) {
      var nx = G.nx, ny = G.ny, N = nx * ny, xs = G.xs, ys = G.ys;
      var g = new Float64Array(N * 2).fill(Infinity), prev = new Int32Array(N * 2).fill(-1);
      var tx = xs[t % nx], ty = ys[(t / nx) | 0];
      var heap = new Heap();
      var sAx = o.startDir[0] !== 0 ? 0 : 1;
      g[s * 2 + sAx] = 0;
      heap.push(Math.abs(xs[s % nx] - tx) + Math.abs(ys[(s / nx) | 0] - ty), s * 2 + sAx);
      var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1], best = -1, bestCost = Infinity, guard = 0;
      while (heap.size()) {
        var st = heap.pop(), p = st >> 1, ax = st & 1, gc = g[st];
        if (gc + Math.abs(xs[p % nx] - tx) + Math.abs(ys[(p / nx) | 0] - ty) >= bestCost) break;
        if (++guard > 400000) break;
        var pi = p % nx, pj = (p / nx) | 0;
        for (var d = 0; d < 4; d++) {
          var dx = DX[d], dy = DY[d], nax = dy === 0 ? 0 : 1;
          if (p === s && dx === -o.startDir[0] && dy === -o.startDir[1]) continue; // never fold back into the source
          var qi = pi + dx, qj = pj + dy;
          if (qi < 0 || qj < 0 || qi >= nx || qj >= ny) continue;
          var q = qj * nx + qi, e = nax === 0 ? pj * nx + Math.min(pi, qi) : Math.min(pj, qj) * nx + pi;
          if (G.blockP[q] || (nax === 0 ? G.blockH[e] : G.blockV[e])) continue;
          var len = nax === 0 ? Math.abs(xs[qi] - xs[pi]) : Math.abs(ys[qj] - ys[pj]);
          var c = len;
          var s1 = nax === 0 ? G.softH1[e] : G.softV1[e], s2 = nax === 0 ? G.softH2[e] : G.softV2[e];
          if ((s1 !== -1 && !o.exempt[G.owners[s1]]) || (s2 !== -1 && !o.exempt[G.owners[s2]])) c += len * 2;
          var used = nax === 0 ? G.usedH[e] : G.usedV[e];
          if (used) c += len * SHARE * used;
          if (nax === 0 ? G.ptV[q] : G.ptH[q]) c += CROSS;
          if (G.nearB[e * 2 + nax]) c += len * BORDER;
          if (o.lane != null && nax === 0 && Math.abs(ys[qj] - o.lane) > 1) c += len * (AROUND - 1);
          if (nax !== ax) c += BEND;
          if (q === t) {
            if (dx === -o.endDir[0] && dy === -o.endDir[1]) continue; // arriving from inside the target
            if (!(dx === o.endDir[0] && dy === o.endDir[1])) c += BEND;
          }
          var ng = gc + c, ns = q * 2 + nax;
          if (ng < g[ns]) {
            g[ns] = ng; prev[ns] = st;
            if (q === t) { if (ng < bestCost) { bestCost = ng; best = ns; } continue; }
            heap.push(ng + Math.abs(xs[qi] - tx) + Math.abs(ys[qj] - ty), ns);
          }
        }
      }
      if (best < 0) return null;
      var cells = [];
      for (var k = best; k !== -1; k = prev[k]) cells.push(k >> 1);
      cells.reverse();
      return cells;
    }
    function occupy(G, cells) {
      var nx = G.nx;
      for (var k = 1; k < cells.length; k++) {
        var a = cells[k - 1], b = cells[k];
        if (((a / nx) | 0) === ((b / nx) | 0)) { var e = Math.min(a, b); if (G.usedH[e] < 250) G.usedH[e]++; G.ptH[a] = G.ptH[b] = 1; }
        else { var ev = Math.min(a, b); if (G.usedV[ev] < 250) G.usedV[ev]++; G.ptV[a] = G.ptV[b] = 1; }
      }
    }
    function simplify(pts) {
      var out = [];
      pts.forEach(function (p) {
        if (out.length && Math.abs(out[out.length - 1].x - p.x) < 0.01 && Math.abs(out[out.length - 1].y - p.y) < 0.01) return;
        if (out.length >= 2) {
          var a = out[out.length - 2], b = out[out.length - 1];
          if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - p.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - p.y) < 0.01)) { out[out.length - 1] = p; return; }
        }
        out.push({ x: p.x, y: p.y });
      });
      return out;
    }

    /* ---- separate lines that share a channel ---- */
    function nudge(routes) {
      var groups = {};
      routes.forEach(function (rt, ri) {
        var pts = rt.pts;
        for (var k = 1; k < pts.length - 2; k++) {
          var a = pts[k], b = pts[k + 1], vert = Math.abs(a.x - b.x) < 0.5;
          var c = vert ? a.x : a.y, lo = vert ? Math.min(a.y, b.y) : Math.min(a.x, b.x), hi = vert ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
          var key = (vert ? 'v' : 'h') + Math.round(c);
          var pa = pts[k - 1], pb = pts[k + 2];
          var bias = vert ? (pa.x - c) + (pb.x - c) : (pa.y - c) + (pb.y - c);
          (groups[key] = groups[key] || []).push({ rt: rt, ri: ri, k: k, vert: vert, lo: lo, hi: hi, bias: bias });
        }
      });
      Object.keys(groups).forEach(function (key) {
        var segs = groups[key].sort(function (a, b) { return a.lo - b.lo; });
        var cluster = [], end = -Infinity;
        function flush() {
          var ids = {};
          cluster.forEach(function (sg) { ids[sg.ri] = 1; });
          if (Object.keys(ids).length > 1) {
            cluster.sort(function (a, b) { return a.bias - b.bias || a.ri - b.ri; });
            var m = cluster.length;
            cluster.forEach(function (sg, i) {
              var off = (i - (m - 1) / 2) * SEP, pts = sg.rt.pts, k = sg.k;
              // keep the stub segments next to the ports long enough for an arrowhead
              if (k === 1) off = limit(off, pts[0], pts[1], sg.vert);
              if (k + 2 === pts.length - 1) off = limit(off, pts[k + 2], pts[k + 1], sg.vert);
              if (sg.vert) { pts[k].x += off; pts[k + 1].x += off; } else { pts[k].y += off; pts[k + 1].y += off; }
            });
          }
          cluster = [];
        }
        function limit(off, port, pt, vert) {
          // moving pt by off along the axis perpendicular to the segment changes the stub length
          var cur = vert ? pt.x - port.x : pt.y - port.y, sign = cur >= 0 ? 1 : -1, min = AL + 6;
          var next = Math.abs(cur + off);
          if (next < min || (cur + off) * sign < 0) return sign * min - cur;
          return off;
        }
        segs.forEach(function (sg) {
          if (cluster.length && sg.lo >= end - 1) flush();
          cluster.push(sg); end = Math.max(cluster.length > 1 ? end : -Infinity, sg.hi);
        });
        flush();
      });
    }

    /* ---- path geometry ---- */
    function toPath(pts, opt) {
      var p = pts.map(function (q) { return { x: q.x, y: q.y }; }), n = p.length, res = {};
      if (opt.end && n >= 2) {
        var ue = unit(p[n - 2], p[n - 1]);
        res.end = { tip: { x: p[n - 1].x, y: p[n - 1].y }, dir: ue };
        var le = dist(p[n - 2], p[n - 1]), te = Math.min(AL - 0.5, Math.max(0, le - 1));
        p[n - 1] = { x: p[n - 1].x - ue.x * te, y: p[n - 1].y - ue.y * te };
      }
      if (opt.start && n >= 2) {
        var us = unit(p[1], p[0]);
        res.start = { tip: { x: p[0].x, y: p[0].y }, dir: us };
        var ls = dist(p[0], p[1]), ts = Math.min(AL - 0.5, Math.max(0, ls - 1));
        p[0] = { x: p[0].x - us.x * ts, y: p[0].y - us.y * ts };
      }
      var R = opt.radius, f = function (v) { return Math.round(v * 100) / 100; };
      var d = 'M ' + f(p[0].x) + ' ' + f(p[0].y);
      for (var i = 1; i < n - 1; i++) {
        var a = p[i - 1], c = p[i], b = p[i + 1];
        var la = dist(a, c), lb = dist(c, b);
        var r = Math.min(R, i === 1 ? la - 1 : la / 2, i === n - 2 ? lb - 2 : lb / 2);
        if (r < 1) { d += ' L ' + f(c.x) + ' ' + f(c.y); continue; }
        var u = unit(a, c), v = unit(c, b);
        var A = { x: c.x - u.x * r, y: c.y - u.y * r }, B = { x: c.x + v.x * r, y: c.y + v.y * r }, k = 0.55 * r;
        d += ' L ' + f(A.x) + ' ' + f(A.y) + ' C ' + f(A.x + u.x * k) + ' ' + f(A.y + u.y * k) + ', ' + f(B.x - v.x * k) + ' ' + f(B.y - v.y * k) + ', ' + f(B.x) + ' ' + f(B.y);
      }
      d += ' L ' + f(p[n - 1].x) + ' ' + f(p[n - 1].y);
      res.d = d;
      return res;
    }
    function arrowHead(a) {
      var t = a.tip, u = a.dir, b = { x: t.x - u.x * AL, y: t.y - u.y * AL }, px = -u.y * AW, py = u.x * AW;
      var f = function (v) { return Math.round(v * 100) / 100; };
      return 'M ' + f(t.x) + ' ' + f(t.y) + ' L ' + f(b.x + px) + ' ' + f(b.y + py) + ' L ' + f(b.x - px) + ' ' + f(b.y - py) + ' Z';
    }

    /* ---- main entry ---- */
    function route(input) {
      var boxes = input.boxes, edges = input.edges, obstacles = input.obstacles;
      var hardForSides = obstacles.map(function (r) { return grow(r, HARD); });
      var plans = [];
      edges.forEach(function (e, idx) {
        var a = boxes[e.from], b = boxes[e.to];
        if (!a || !b || e.from === e.to) return;
        var sides = chooseSides(e, a, b, hardForSides);
        plans.push({ e: e, idx: idx, a: a, b: b, sa: sides[0], sb: sides[1] });
      });
      assignPorts(plans, boxes);
      // stubs: a short straight run out of each port
      plans.forEach(function (p) {
        [['1', p.e.from, p.sa], ['2', p.e.to, p.sb]].forEach(function (x) {
          var P = p['P' + x[0]], n = NRM[x[2]];
          var run = freeRun(P, n, hardForSides, x[1]);
          var len = clampN(Math.min(STUB, run / 2), Math.min(STUB, P.inset + HARD + 3), STUB);
          p['S' + x[0]] = { x: P.x + n[0] * len, y: P.y + n[1] * len };
        });
      });
      // grid over everything (+ a margin to route around the outside)
      var groups = input.groups || [];
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Object.keys(boxes).map(function (k) { return boxes[k]; }).concat(groups).forEach(function (r) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w + (r.stack || 0)); y1 = Math.max(y1, r.y + r.h + (r.stack || 0)); });
      var lanes = { above: y0 - 28, below: y1 + 28 };
      var bounds = { x0: x0 - 18, y0: y0 - 18, x1: x1 + 18, y1: y1 + 18 };
      var ex = [], ey = [lanes.above, lanes.below];
      plans.forEach(function (p) { ex.push(p.S1.x, p.S2.x); ey.push(p.S1.y, p.S2.y); });
      var G = buildGrid(obstacles, groups, ex, ey, bounds);
      // short edges first: they claim the obvious channels
      var order = plans.slice().sort(function (a, b) { return (dist(a.S1, a.S2) - dist(b.S1, b.S2)) || (a.idx - b.idx); });
      order.forEach(function (p) {
        var s = cell(G, p.S1), t = cell(G, p.S2), cells = null;
        var ex2 = {}; ex2[p.e.from] = ex2[p.e.to] = 1;
        p.why = s < 0 || t < 0 ? 'off-grid' : G.blockP[s] || G.blockP[t] ? 'stub-blocked' : '';
        if (s >= 0 && t >= 0 && !G.blockP[s] && !G.blockP[t]) {
          cells = astar(G, s, t, { startDir: NRM[p.sa], endDir: [-NRM[p.sb][0], -NRM[p.sb][1]], exempt: ex2, lane: p.e.around ? lanes[p.e.around] : null });
        }
        var mid;
        if (cells) {
          occupy(G, cells);
          mid = cells.map(function (c) { return { x: G.xs[c % G.nx], y: G.ys[(c / G.nx) | 0] }; });
          p.routed = true;
        } else {
          // no clear path (boxes too close or overlapping): fall back to a simple elbow
          mid = (p.sa === 'l' || p.sa === 'r') ? [p.S1, { x: (p.S1.x + p.S2.x) / 2, y: p.S1.y }, { x: (p.S1.x + p.S2.x) / 2, y: p.S2.y }, p.S2] : [p.S1, { x: p.S1.x, y: (p.S1.y + p.S2.y) / 2 }, { x: p.S2.x, y: (p.S1.y + p.S2.y) / 2 }, p.S2];
          p.routed = false;
        }
        p.pts = simplify([{ x: p.P1.x, y: p.P1.y }].concat(mid, [{ x: p.P2.x, y: p.P2.y }]));
      });
      nudge(plans.map(function (p) { return p; }));
      var out = {};
      plans.forEach(function (p) {
        p.pts = simplify(p.pts);
        var g = toPath(p.pts, { start: p.e.arrowStart, end: p.e.arrowEnd, radius: input.radius });
        out[p.e.id] = { pts: p.pts, d: g.d, sides: [p.sa, p.sb], routed: p.routed, why: p.routed ? undefined : (p.why || 'no-path'), start: g.start ? arrowHead(g.start) : null, end: g.end ? arrowHead(g.end) : null };
      });
      return out;
    }
    return { route: route, outline: outline, AL: AL };
  })();

  /* ================================================================
     createFlowfig
     ================================================================ */
  function createFlowfig(root, cfg, params) {
    var C = normalize(cfg);
    var reducedMq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var darkMq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function () {} };

    var S = {
      s: 0, t: 0, playing: true, speed: 1, manual: C.playback === 'manual', holdUntil: Infinity,
      themeMode: 'auto', full: false, exporting: false, hovered: null, dirty: true,
      reduced: !!reducedMq.matches && !params.export
    };
    if (params.present) S.manual = true;
    if (params.playback === 'manual' || params.playback === 'auto') S.manual = params.playback === 'manual';
    if (S.reduced) S.manual = true;
    if (params.speed) S.speed = [0.5, 0.75, 1, 1.5, 2].reduce(function (a, b) { return Math.abs(b - parseFloat(params.speed)) < Math.abs(a - parseFloat(params.speed)) ? b : a; }, 1);
    if (params.autoplay === '0' || params.export) S.playing = false;

    /* ---------- DOM skeleton ---------- */
    root.classList.add('flowfig');
    root.setAttribute('role', 'figure');
    if (C.title) root.setAttribute('aria-label', C.title);
    if (params.embed) { root.classList.add('ff-embed'); document.body.classList.add('ff-embedded'); }
    root.innerHTML = '';
    var figure = h('div', 'ff-figure');
    var frame = h('div', 'ff-frame');
    var head = h('div', 'ff-head');
    var titleEl = C.title ? h('div', 'ff-title', C.title) : null;
    var subEl = C.subtitle ? h('div', 'ff-subtitle', C.subtitle) : null;
    var whereEl = h('div', 'ff-where');
    if (titleEl) head.append(titleEl);
    if (subEl) head.append(subEl);
    head.append(whereEl);
    var canvas = h('div', 'ff-canvas');
    var fitBox = h('div', 'ff-fit');
    var stage = h('div', 'ff-stage');
    fitBox.append(stage);
    canvas.append(fitBox);
    var caption = h('div', 'ff-caption');
    frame.append(head, canvas, caption);
    var controls = h('div', 'ff-controls');
    figure.append(frame, controls);
    root.append(figure);

    /* ---------- Build the layout tree ---------- */
    var boxes = {};        // id -> element (nodes and id'd groups)
    var nodes = {};        // id -> node element (leaves)
    var groups = {};       // id -> group element
    var panels = {};       // id -> { el, variants: Map(key -> el) }
    var iconImgs = [];     // provider icons that may swap per theme

    var variantsByNode = collectVariants(C);

    function buildIcon(spec, specDark, color) {
      if (spec === false || spec == null || spec === '') return null;
      if (ICONS[spec]) {
        var e = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
        e.setAttribute('class', 'ff-icon');
        e.innerHTML = ICONS[spec];
        if (color) e.style.color = color;
        return e;
      }
      var src = String(spec);
      if (src.trim().indexOf('<svg') === 0) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
      if (/^(data:|https?:|\.{0,2}\/)/.test(src) || /\.(svg|png|jpe?g|webp|gif)$/i.test(src)) {
        if (/^https?:/.test(src)) console.warn('[flowfig] remote icon "' + src + '" - inline it with build.mjs --fetch-icons so the file works offline and exports correctly.');
        var img = h('img', 'ff-icon');
        img.alt = '';
        img.src = src;
        if (specDark) iconImgs.push({ img: img, light: src, dark: String(specDark).trim().indexOf('<svg') === 0 ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(specDark) : specDark });
        return img;
      }
      console.warn('[flowfig] unknown icon "' + spec + '"');
      return null;
    }

    function build(item, depth) {
      if (item.children) {
        var labeled = item.label != null && item.style !== 'plain';
        var g = h('div', labeled ? 'ff-group' : '');
        if (item.style) g.dataset.style = item.style;
        var tc = toneColor(item.tone);
        if (tc && labeled) { g.dataset.tone = item.tone; g.style.setProperty('--ff-t', tc); }
        if (item.label != null && item.style !== 'plain') {
          var lab = h('div', 'ff-group-label');
          var gk = kindOf(item.kind);
          var gi = buildIcon(item.icon != null ? item.icon : gk ? gk.icon : null, item.iconDark, tc || null);
          if (gi) lab.append(gi);
          lab.append(document.createTextNode(item.label));
          g.append(lab);
        }
        var row = h('div', 'ff-row');
        var dir = item.direction || 'row';
        row.style.flexDirection = dir;
        row.style.gap = (item.gap != null ? item.gap : dir === 'column' ? 28 : 56) + 'px';
        row.style.alignItems = item.align ? (item.align === 'center' ? 'center' : 'flex-' + item.align) : dir === 'column' ? 'stretch' : 'center';
        item.children.forEach(function (c) { row.append(build(c, depth + 1)); });
        g.append(row);
        if (item.id) {
          g.dataset.ff = item.id; boxes[item.id] = g; groups[item.id] = g;
          hoverable(g, item.id);
        }
        return g;
      }
      var kind = kindOf(item.kind);
      var n = h('div', 'ff-node');
      n.dataset.ff = item.id;
      n.dataset.shape = item.shape || (kind && kind.shape) || 'box';
      if (item.kind) n.dataset.kind = item.kind;
      if (item.stack) n.dataset.stack = '';
      if (item.style || (kind && kind.style)) n.dataset.style = item.style || kind.style;
      if (item.desc) n.title = item.desc;
      var color = toneColor(item.tone) || (kind ? 'var(--ff-cat-' + kind.cat + ')' : null);
      var ic = buildIcon(item.icon != null ? item.icon : kind ? kind.icon : null, item.iconDark, null);
      if (ic) {
        var chip = h('span', 'ff-chip' + (ic.tagName === 'IMG' ? ' ff-chip-img' : ''));
        if (color) chip.style.setProperty('--ff-t', color);
        chip.append(ic);
        n.append(chip);
      }
      n.append(h('div', 'ff-label', item.label != null ? item.label : item.id));
      if (item.sub) n.append(h('div', 'ff-sub', item.sub));
      var variants = variantsByNode.get(item.id);
      if (variants || item.lines) {
        var p = h('div', 'ff-panel');
        var map = new Map();
        var empty = h('div', 'ff-variant ff-on');
        empty.append(h('div', 'ff-item', item.placeholder || '—'));
        if (item.lines) empty.style.minHeight = (15 * item.lines + 4 * (item.lines - 1)) + 'px';
        p.append(empty);
        map.set('', empty);
        (variants || new Map()).forEach(function (content, key) {
          var v = h('div', 'ff-variant');
          toItems(content).forEach(function (it) { v.append(renderItem(it)); });
          p.append(v);
          map.set(key, v);
        });
        n.append(p);
        n.classList.add('ff-has-panel');
        panels[item.id] = { el: p, variants: map, on: empty, key: '' };
      }
      n.append(h('div', 'ff-badge'));
      var w = item.width || (variants || item.lines ? 180 : null);
      if (w) { n.style.width = w + 'px'; n.style.maxWidth = 'none'; }
      nodes[item.id] = n; boxes[item.id] = n;
      hoverable(n, item.id);
      return n;
    }

    function renderItem(it) {
      var tone = toneColor(it.tone || 'blue') || 'var(--ff-blue)';
      var tag = null, mark = null;
      if (it.tag != null) { tag = h('span', 'ff-tag', it.tag); tag.style.setProperty('--ff-t', tone); }
      if (it.mark != null) { mark = h('span', 'ff-mark', it.mark); var mt = toneColor(it.markTone); if (mt) mark.style.setProperty('--ff-t', mt); }
      var txt = h('span', 'ff-txt' + (it.mono ? ' ff-mono' : ''), it.text != null ? it.text : '');
      if (it.meta != null) txt.append(h('span', 'ff-meta', ' · ' + it.meta));
      if (tag && String(it.tag).length > 3) {
        var wrap = h('div', 'ff-item ff-stacked');
        var top = h('div', 'ff-item-top');
        top.append(tag);
        if (mark) top.append(mark);
        wrap.append(top, txt);
        return wrap;
      }
      var row = h('div', 'ff-item');
      if (tag) row.append(tag);
      row.append(txt);
      if (mark) row.append(mark);
      return row;
    }

    function hoverable(el, id) {
      el.addEventListener('mouseenter', function (e) { e.stopPropagation(); S.hovered = id; S.dirty = true; });
      el.addEventListener('mouseleave', function () { if (S.hovered === id) S.hovered = null; S.dirty = true; });
    }

    stage.append(build(C.layout, 0));
    // Edges that loop around the top/bottom need room outside the boxes
    function loops(sd) { return function (e) { return e.around === (sd === 't' ? 'above' : 'below') || (sideName(e.fromSide) === sd && sideName(e.toSide) === sd); }; }
    if (C.edges.some(loops('t'))) stage.classList.add('ff-pad-above');
    if (C.edges.some(loops('b'))) stage.classList.add('ff-pad-below');

    /* ---------- SVG edge layer ---------- */
    // z-order: group backgrounds < edges < nodes < edge labels < dots < payload pills
    var svg = s('svg', { class: 'ff-svg', 'aria-hidden': 'true' });
    var edgeEls = {}, edgeLens = {}, labelEls = {}, edgeById = {}, heads = {}, routes = {};
    C.edges.forEach(function (e) {
      edgeById[e.id] = e;
      var p = s('path', { class: 'ff-edge' + (e.quiet ? ' ff-quiet' : '') });
      p.dataset.edge = e.id;
      if (e.style && e.style !== 'sync') p.dataset.style = e.style;
      svg.append(p);
      edgeEls[e.id] = p;
      heads[e.id] = [];
      ['start', 'end'].forEach(function (end) {
        if (!(end === 'start' ? e.arrowStart : e.arrowEnd)) return;
        var a = s('path', { class: 'ff-ah' + (e.quiet ? ' ff-quiet' : '') });
        a.dataset.end = end;
        svg.append(a);
        heads[e.id].push(a);
      });
      if (e.label) labelEls[e.id] = h('div', 'ff-elabel' + (e.quiet ? ' ff-quiet' : ''), e.label);
    });
    var maxHops = 1;
    C.scenarios.forEach(function (sc) { sc.flow.forEach(function (b) { maxHops = Math.max(maxHops, toHops(b.edges != null ? b.edges : b.hops).length); }); });
    var dotSvg = s('svg', { class: 'ff-svg ff-dots', 'aria-hidden': 'true' });
    var dots = [], pills = [];
    for (var di = 0; di < maxHops; di++) {
      var g = s('g', { class: 'ff-dot' });
      g.append(s('circle', { r: '10', class: 'ff-halo' }), s('circle', { r: '4.5', class: 'ff-core' }), s('path', { class: 'ff-x', d: 'M-2.3 -2.3 L2.3 2.3 M2.3 -2.3 L-2.3 2.3' }));
      dotSvg.append(g); dots.push(g);
    }
    stage.append(svg);
    Object.keys(labelEls).forEach(function (k) { stage.append(labelEls[k]); });
    stage.append(dotSvg);
    for (di = 0; di < maxHops; di++) { var pl = h('div', 'ff-pill'); stage.append(pl); pills.push(pl); }

    // Legend (only when the diagram mixes line styles)
    var styles = {};
    C.edges.forEach(function (e) { styles[e.style || 'sync'] = 1; });
    if (C.legend !== false && (styles.async || styles.stream)) {
      var leg = h('div', 'ff-legend');
      [['sync', 'request / sync', null], ['async', 'async / event', '5 4'], ['stream', 'stream', '1 5']].forEach(function (x) {
        if (!styles[x[0]] && x[0] !== 'sync') return;
        var sp = h('span');
        var ls = s('svg', { viewBox: '0 0 28 8', 'aria-hidden': 'true' });
        var ln = s('line', { x1: '0', y1: '4', x2: '21', y2: '4' });
        if (x[2]) ln.setAttribute('stroke-dasharray', x[2]);
        if (x[0] === 'stream') ln.setAttribute('stroke-linecap', 'round');
        ls.append(ln, s('path', { d: 'M28 4 L20 0.5 L20 7.5 Z' }));
        sp.append(ls, document.createTextNode(x[1]));
        leg.append(sp);
      });
      canvas.append(leg);
      canvas.style.paddingBottom = '34px';
    }

    /* ---------- Compile scenarios into timelines ---------- */
    var SC = C.scenarios.map(compileScenario);

    function compileScenario(sc) {
      var beats = [], t = C.leadMs;
      sc.flow.forEach(function (raw) {
        var ms = raw.ms != null ? raw.ms : C.beatMs;
        var hops = toHops(raw.edges != null ? raw.edges : raw.hops).map(function (hp) {
          var travel = S.reduced ? 0 : (hp.travelMs != null ? hp.travelMs : raw.travelMs != null ? raw.travelMs : Math.min(C.travelMs, ms * 0.7));
          return { edge: hp.edge, back: !!hp.back, data: hp.data, tone: HOP_TONES[hp.tone] ? hp.tone : (hp.fail ? 'error' : null), fail: !!hp.fail, delay: S.reduced ? 0 : (hp.delay || 0), travel: travel };
        });
        var arriveRel = 0;
        hops.forEach(function (hp) { arriveRel = Math.max(arriveRel, hp.delay + hp.travel); });
        beats.push({ start: t, end: t + ms, ms: ms, hops: hops, arrive: t + Math.min(arriveRel, ms), raw: raw });
        t += ms;
      });
      var shows = new Map(), states = new Map(), lights = [], says = [];
      beats.forEach(function (b) {
        Object.keys(b.raw.show || {}).forEach(function (id) {
          if (!shows.has(id)) shows.set(id, []);
          var content = b.raw.show[id];
          shows.get(id).push({ t: b.arrive, key: content == null ? '' : JSON.stringify(content) });
        });
        Object.keys(b.raw.state || {}).forEach(function (id) {
          if (!states.has(id)) states.set(id, []);
          states.get(id).push({ t: b.arrive, v: b.raw.state[id] });
        });
        if (b.raw.light) lights.push({ t: b.arrive, ids: [].concat(b.raw.light) });
        if (b.raw.say != null) says.push({ t: b.start, text: b.raw.say });
      });
      var lastEnd = beats.length ? beats[beats.length - 1].end : C.leadMs;
      return { label: sc.label || 'Flow', caption: sc.caption, beats: beats, shows: shows, states: states, lights: lights, says: says, lastEnd: lastEnd, total: lastEnd + C.holdMs };
    }

    function beatAt(sc, t) {
      var i = -1;
      for (var k = 0; k < sc.beats.length && sc.beats[k].start <= t; k++) i = k;
      return i;
    }

    /* ---------- Geometry: measure boxes, route edges ---------- */
    var scale = 1;
    function fit() {
      var W = stage.offsetWidth, H = stage.offsetHeight;
      if (!W || !H) return;
      var cw = fitBox.clientWidth, sc, tx = 0, ty = 0;
      if (S.exporting) {
        sc = 1;
        fitBox.style.width = W + 'px';
        fitBox.style.height = H + 'px';
      } else if (S.full) {
        fitBox.style.width = '';
        fitBox.style.height = '';
        var ch = fitBox.clientHeight;
        sc = Math.min(cw / W, ch / H, C.maxFullScale);
        tx = Math.max(0, (cw - W * sc) / 2);
        ty = Math.max(0, (ch - H * sc) / 2);
      } else {
        fitBox.style.width = '';
        sc = clamp(cw / W, C.minScale, C.maxScale);
        tx = Math.max(0, (cw - W * sc) / 2);
        fitBox.style.height = Math.ceil(H * sc) + 'px';
      }
      fitBox.style.overflowX = !S.exporting && !S.full && W * sc > cw + 1 ? 'auto' : '';
      scale = sc;
      stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    }

    function parseRadius(v, w, hh) {
      var parts = String(v || '0').trim().split(/\s+/);
      var lenOf = function (t, ref) { return /%$/.test(t) ? parseFloat(t) / 100 * ref : parseFloat(t) || 0; };
      var rx = lenOf(parts[0], w), ry = lenOf(parts[1] || parts[0], hh);
      var f = Math.min(1, rx > 0 ? w / (2 * rx) : 1, ry > 0 ? hh / (2 * ry) : 1);
      return [rx * f, ry * f];
    }
    function measure() {
      fit();
      var o = stage.getBoundingClientRect();
      var k = o.width / stage.offsetWidth || 1;
      if (!o.width) return;
      var rectOf = function (el) { var r = el.getBoundingClientRect(); return { x: (r.left - o.left) / k, y: (r.top - o.top) / k, w: r.width / k, h: r.height / k }; };
      var geo = {}, obstacles = [];
      Object.keys(boxes).forEach(function (id) {
        var el = boxes[id], r = rectOf(el), rad = parseRadius(getComputedStyle(el).borderTopLeftRadius, r.w, r.h);
        r.rx = rad[0]; r.ry = rad[1]; r.id = id;
        r.stack = nodes[id] && el.dataset.stack != null ? 8 : 0;
        geo[id] = r;
        if (nodes[id]) obstacles.push({ x: r.x, y: r.y, w: r.w + r.stack, h: r.h + r.stack, id: id });
      });
      var groupRects = [];
      Array.prototype.forEach.call(stage.querySelectorAll('.ff-group'), function (gEl) {
        if (gEl.dataset.style === 'plain') return;
        groupRects.push(rectOf(gEl));
      });
      // group titles are obstacles too, so lines never run through them
      Array.prototype.forEach.call(stage.querySelectorAll('.ff-group-label'), function (lab) {
        var r = rectOf(lab);
        obstacles.push({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4, id: null, soft: false });
      });
      var t0 = performance.now();
      routes = Router.route({ boxes: geo, obstacles: obstacles, groups: groupRects, edges: C.edges, radius: C.routing === 'orthogonal' ? 8 : 26 });
      lastRouteMs = performance.now() - t0;
      C.edges.forEach(function (e) {
        var r = routes[e.id], el = edgeEls[e.id];
        if (!r) { el.removeAttribute('d'); edgeLens[e.id] = 0; return; }
        el.setAttribute('d', r.d);
        edgeLens[e.id] = el.getTotalLength();
        heads[e.id].forEach(function (a) { a.setAttribute('d', r[a.dataset.end] || ''); });
      });
      placeLabels(geo, obstacles);
      S.dirty = true;
    }
    var lastRouteMs = 0;
    // Edge labels go on the longest straight run of their line, away from boxes and other labels
    function placeLabels(geo, obstacles) {
      var taken = obstacles.map(function (r) { return { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }; });
      var hit = function (a) {
        var area = 0;
        taken.forEach(function (b) {
          var ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ix > 0 && iy > 0) area += ix * iy;
        });
        return area;
      };
      C.edges.forEach(function (e) {
        var lab = labelEls[e.id], r = routes[e.id], el = edgeEls[e.id], L = edgeLens[e.id];
        if (!lab || !r || !L) return;
        var w = lab.offsetWidth, hh = lab.offsetHeight, cands = [];
        if (e.labelAt != null) cands.push(el.getPointAtLength(L * clamp(e.labelAt, 0, 1)));
        else {
          var segs = [], AH = 2 * Router.AL + 10;
          for (var i = 0; i + 1 < r.pts.length; i++) {
            var a = r.pts[i], b = r.pts[i + 1], horiz = Math.abs(a.y - b.y) < 0.5, len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, fits = len >= (horiz ? w : hh) + AH;
            var base = len + (horiz ? 40 : 0) - (i === 0 || i === r.pts.length - 2 ? 60 : 0);
            segs.push({ p: m, score: (fits ? 1000 : 0) + base });
            // beside the line when the line is too short to carry the label
            if (horiz) { segs.push({ p: { x: m.x, y: m.y - hh / 2 - 5 }, score: 500 + base }); segs.push({ p: { x: m.x, y: m.y + hh / 2 + 5 }, score: 499 + base }); }
            else { segs.push({ p: { x: m.x + w / 2 + 6, y: m.y }, score: 500 + base }); segs.push({ p: { x: m.x - w / 2 - 6, y: m.y }, score: 499 + base }); }
          }
          segs.sort(function (m, n) { return n.score - m.score; });
          segs.forEach(function (sg) { cands.push(sg.p); });
          [0.5, 0.35, 0.65, 0.25, 0.75].forEach(function (f) { cands.push(el.getPointAtLength(L * f)); });
        }
        var best = null, bestHit = Infinity;
        for (var c = 0; c < cands.length; c++) {
          var box = { x: cands[c].x - w / 2, y: cands[c].y - hh / 2, w: w, h: hh }, ov = hit(box);
          if (ov < bestHit) { best = cands[c]; bestHit = ov; }
          if (!ov) break;
        }
        lab.style.left = best.x + 'px';
        lab.style.top = best.y + 'px';
        taken.push({ x: best.x - w / 2 - 4, y: best.y - hh / 2 - 3, w: w + 8, h: hh + 6 });
      });
    }

    /* ---------- Render: pure function of (scenario, time) ---------- */
    var captionKey = null;
    function render() {
      S.dirty = false;
      var sc = SC[S.s];
      if (!sc) return;
      var t = S.t;
      var i = beatAt(sc, t);
      var b = i >= 0 ? sc.beats[i] : null;
      var active = {}, seen = {}, lit = {}, tones = {};

      for (var j = 0; j < i; j++) sc.beats[j].hops.forEach(function (hp) { seen[hp.edge] = 1; });

      // Dots + pills
      var hops = b ? b.hops : [];
      for (var k = 0; k < dots.length; k++) {
        var hp = hops[k], path = hp && edgeEls[hp.edge], len = hp && edgeLens[hp.edge];
        var dot = dots[k], pill = pills[k];
        if (!hp || !path || !len) { dot.style.opacity = '0'; pill.style.opacity = '0'; continue; }
        var e = edgeById[hp.edge];
        active[hp.edge] = 1;
        if (hp.tone) tones[hp.edge] = hp.tone;
        var t0 = b.start + hp.delay, t1 = t0 + hp.travel;
        var from = hp.back ? e.to : e.from, to = hp.back ? e.from : e.to;
        if (t >= t0) lit[from] = 1;
        if (t >= t1) lit[to] = hp.fail ? lit[to] : 1;
        var p = hp.travel > 0 ? clamp((t - t0) / hp.travel, 0, 1) : 1;
        var u = ease(p) * (hp.fail ? 0.55 : 1);
        var pt = path.getPointAtLength((hp.back ? 1 - u : u) * len);
        var linger = hp.fail ? 900 : DUR.linger;
        var op = t < t0 ? 0 : 1 - clamp((t - t1 - linger) / DUR.fade, 0, 1);
        if (S.reduced) op = 0;
        var failed = hp.fail && p >= 1;
        dot.setAttribute('transform', 'translate(' + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2) + ')');
        dot.style.opacity = String(op);
        dot.style.color = hp.tone ? 'var(--ff-' + hp.tone + ')' : '';
        if (dot.classList.contains('ff-fail') !== failed) { dot.classList.toggle('ff-fail', failed); dot.children[1].setAttribute('r', failed ? '6' : '4.5'); }
        if (hp.data != null) {
          if (pill.textContent !== String(hp.data)) pill.textContent = hp.data;
          pill.className = 'ff-pill' + (hp.tone ? ' ff-t-' + hp.tone : '');
          pill.style.transform = 'translate(' + pt.x.toFixed(2) + 'px,' + pt.y.toFixed(2) + 'px) translate(-50%, calc(-100% - 12px))';
          pill.style.opacity = String(op);
        } else pill.style.opacity = '0';
      }
      Object.keys(seen).forEach(function (id) { var e = edgeById[id]; if (e) { lit[e.from] = 1; lit[e.to] = 1; } });

      // Panels
      Object.keys(panels).forEach(function (id) {
        var pn = panels[id], cur = lastAt(sc.shows.get(id), t);
        var key = cur ? cur.key : '';
        var v = pn.variants.get(key) || pn.variants.get('');
        if (pn.on !== v) { pn.on.classList.remove('ff-on'); pn.on.style.opacity = ''; pn.on.style.transform = ''; v.classList.add('ff-on'); pn.on = v; }
        pn.el.classList.toggle('ff-filled', key !== '');
        if (key !== '') {
          lit[id] = 1;
          var f = S.reduced ? 1 : easeOut(clamp((t - cur.t) / DUR.enter, 0, 1));
          v.style.opacity = String(f);
          v.style.transform = f < 1 ? 'translateY(' + ((1 - f) * 4).toFixed(2) + 'px)' : '';
        } else { v.style.opacity = ''; v.style.transform = ''; }
      });
      sc.lights.forEach(function (l) { if (l.t <= t) l.ids.forEach(function (id) { lit[id] = 1; }); });

      // Node status
      Object.keys(nodes).forEach(function (id) {
        var st = lastAt(sc.states.get(id), t);
        var v = st && st.v ? String(st.v) : '';
        var n = nodes[id];
        if ((n.dataset.status || '') !== v) {
          if (v) { n.dataset.status = v; n.querySelector('.ff-badge').textContent = STATUS_BADGE[v] || ''; }
          else delete n.dataset.status;
        }
      });

      // Hover overrides the playback highlight
      var eActive = active, eSeen = seen;
      if (S.hovered && !S.exporting) {
        eActive = {}; eSeen = {}; lit = {}; lit[S.hovered] = 1;
        C.edges.forEach(function (e) { if (e.from === S.hovered || e.to === S.hovered) { eActive[e.id] = 1; lit[e.from] = 1; lit[e.to] = 1; } });
        tones = {};
      }
      var flowOffset = -(t * 0.02);
      C.edges.forEach(function (e) {
        var el = edgeEls[e.id], on = !!eActive[e.id], sn = !on && !!eSeen[e.id];
        var tone = on && tones[e.id];
        el.classList.toggle('ff-active', on);
        el.classList.toggle('ff-seen', sn);
        el.classList.toggle('ff-t-error', tone === 'error');
        el.classList.toggle('ff-t-ok', tone === 'ok');
        el.classList.toggle('ff-t-warn', tone === 'warn');
        heads[e.id].forEach(function (a) {
          a.classList.toggle('ff-active', on);
          a.classList.toggle('ff-seen', sn);
          a.classList.toggle('ff-t-error', tone === 'error');
          a.classList.toggle('ff-t-ok', tone === 'ok');
          a.classList.toggle('ff-t-warn', tone === 'warn');
        });
        if (e.style === 'stream') el.style.strokeDashoffset = flowOffset.toFixed(1);
        var lab = labelEls[e.id];
        if (lab) { lab.classList.toggle('ff-on', on); lab.classList.toggle('ff-seen', sn); }
      });
      Object.keys(boxes).forEach(function (id) { boxes[id].classList.toggle('ff-lit', !!lit[id]); });
      // Dim the rest only once the story has started (the lead-in shows the whole picture)
      stage.classList.toggle('ff-focus', i >= 0 || (!!S.hovered && !S.exporting));

      // Caption
      var say = null;
      sc.says.forEach(function (x) { if (x.t <= t) say = x; });
      var text = say ? say.text : (sc.caption || C.caption || '');
      var ck = S.s + '|' + (say ? say.t : -1);
      if (ck !== captionKey) { captionKey = ck; caption.innerHTML = miniMarkdown(text); }
      var cf = say && !S.reduced ? easeOut(clamp((t - say.t) / DUR.caption, 0, 1)) : 1;
      caption.style.opacity = String(0.15 + 0.85 * cf);

      // Where are we
      var n = sc.beats.length;
      whereEl.textContent = !n ? '' : (SC.length > 1 || C.title ? sc.label + ' · ' : '') + Math.max(0, i + 1) + '/' + n;
      if (progress) progress.style.transform = 'scaleX(' + clamp(t / sc.total, 0, 1).toFixed(4) + ')';
      syncSteps(i);
    }

    /* ---------- Playback clock ---------- */
    var last = performance.now();
    function tick(now) {
      var dt = Math.min(100, now - last);
      last = now;
      if (S.playing && !S.exporting) advance(dt * S.speed);
      if (S.dirty || S.playing) render();
      requestAnimationFrame(tick);
    }
    function advance(ms) {
      var sc = SC[S.s];
      var t = S.t + ms;
      if (S.manual) {
        if (t >= S.holdUntil) { t = S.holdUntil; S.playing = false; syncButtons(); }
      } else if (t >= sc.total) {
        if (SC.length > 1) { loadScenario((S.s + 1) % SC.length); return; }
        if (C.loop === false) { t = sc.total; S.playing = false; syncButtons(); }
        else t = 0;
      }
      S.t = t;
      S.dirty = true;
    }
    function loadScenario(i) {
      S.s = clamp(i, 0, SC.length - 1);
      S.t = 0;
      S.holdUntil = S.manual ? C.leadMs : Infinity;
      captionKey = null;
      syncTabs();
      S.dirty = true;
    }
    function jumpBeat(j) {
      var sc = SC[S.s], b = sc.beats[j];
      if (!b) return;
      S.t = b.start;
      // hold 1 ms before the beat ends so beatAt() still reports this beat
      S.holdUntil = S.manual ? (S.reduced ? b.arrive + 1 : b.end - 1) : Infinity;
      if (S.reduced) S.t = b.arrive + 1;
      S.playing = true;
      S.dirty = true;
      syncButtons();
    }
    function next() {
      var sc = SC[S.s], i = beatAt(sc, S.t);
      if (i < sc.beats.length - 1) jumpBeat(i + 1);
      else if (SC.length > 1 || C.loop !== false) { loadScenario((S.s + 1) % SC.length); jumpBeat(0); }
    }
    function prev() {
      var sc = SC[S.s], i = beatAt(sc, S.t);
      if (i >= 0 && S.t - sc.beats[i].start > 700 && !S.reduced) jumpBeat(i);
      else if (i > 0) jumpBeat(i - 1);
      else if (S.s > 0) { loadScenario(S.s - 1); jumpBeat(SC[S.s].beats.length - 1); }
      else { loadScenario(S.s); }
    }
    function play() {
      if (S.manual) {
        var sc = SC[S.s], i = beatAt(sc, S.t);
        if (i < 0 && S.t < C.leadMs) { S.holdUntil = C.leadMs; next(); return; }
        if (S.t >= S.holdUntil - 1) { next(); return; }
      } else if (S.t >= SC[S.s].total) S.t = 0;
      S.playing = true; syncButtons();
    }
    function pause() { S.playing = false; syncButtons(); }
    function seek(si, ms) {
      if (si !== S.s) { S.s = clamp(si, 0, SC.length - 1); captionKey = null; syncTabs(); }
      S.t = Math.max(0, ms);
      render();
    }

    /* ---------- Theme ---------- */
    function resolveTheme(mode) { return mode === 'dark' || mode === 'light' ? mode : darkMq.matches ? 'dark' : 'light'; }
    function applyTheme(forced) {
      var th = forced || resolveTheme(S.themeMode);
      root.dataset.theme = th;
      var tv = C.theme || {};
      var over = Object.assign({}, tv.accent ? { accent: tv.accent, accentStrong: tv.accentStrong || tv.accent } : {}, tv[th] || {});
      Object.keys(over).forEach(function (k) {
        root.style.setProperty('--ff-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), over[k]);
      });
      iconImgs.forEach(function (x) { x.img.src = th === 'dark' && x.dark ? x.dark : x.light; });
      if (root.parentElement === document.body || document.body.classList.contains('ff-body')) {
        document.body.style.background = getComputedStyle(root).getPropertyValue('--ff-page');
        document.documentElement.style.colorScheme = th;
      }
      if (themeBtn) { themeBtn.replaceChildren(uiIcon(th === 'dark' ? 'sun' : 'moon')); themeBtn.title = 'Switch to ' + (th === 'dark' ? 'light' : 'dark') + ' theme (T)'; }
      S.dirty = true;
    }
    function setTheme(mode, persist) {
      S.themeMode = mode === 'light' || mode === 'dark' ? mode : 'auto';
      if (persist) store('flowfig-theme', S.themeMode);
      applyTheme();
    }
    if (darkMq.addEventListener) darkMq.addEventListener('change', function () { if (S.themeMode === 'auto') applyTheme(); });

    /* ---------- Controls ---------- */
    var SPEEDS = [0.5, 0.75, 1, 1.5, 2];
    function snapSpeed(v) { v = parseFloat(v) || 1; return SPEEDS.reduce(function (a, b) { return Math.abs(b - v) < Math.abs(a - v) ? b : a; }, 1); }
    function speedLabel(v) { return (String(v).length > 3 ? String(v) : v.toFixed(1)) + '×'; }
    var progress = null, tabs = [], playBtn, stepBtn, themeBtn, fullBtn, speedSel, prevBtn, nextBtn, exportBtn, stepsBtn, stepsPanel, menu;
    function btn(icon, title, onClick, text) {
      var b = h('button', 'ff-btn' + (icon ? ' ff-icon-btn' : ''));
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title.replace(/\s*\(.*\)$/, ''));
      if (icon) b.append(uiIcon(icon)); else b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    }
    function cluster() { var c = h('div', 'ff-cluster'); c.append.apply(c, arguments); return c; }
    function buildControls() {
      prevBtn = btn('prev', 'Previous step (←)', function () { prev(); });
      playBtn = btn('play', 'Play / pause (Space)', function () { S.playing ? pause() : play(); });
      playBtn.classList.add('ff-primary');
      nextBtn = btn('next', 'Next step (→)', function () { next(); });
      var tl = h('div', 'ff-tabs');
      tl.setAttribute('role', 'tablist');
      tl.setAttribute('aria-label', 'Scenarios');
      tabs = SC.map(function (sc, i) {
        var tb = h('button', 'ff-tab', sc.label);
        tb.type = 'button';
        tb.setAttribute('role', 'tab');
        tb.title = 'Scenario ' + (i + 1) + (i < 9 ? ' (' + (i + 1) + ')' : '');
        tb.addEventListener('click', function () { loadScenario(i); if (S.manual) next(); else play(); });
        tl.append(tb);
        return tb;
      });
      progress = h('div', 'ff-progress');
      stepBtn = btn(null, 'Auto-play or step-by-step (S)', function () { setManual(!S.manual); }, 'auto');
      // Playback speed: native select (keyboard and screen-reader friendly)
      var speedWrap = h('label', 'ff-select');
      speedWrap.title = 'Playback speed (- / +)';
      speedSel = h('select');
      SPEEDS.forEach(function (v) { var o = h('option', null, speedLabel(v)); o.value = String(v); speedSel.append(o); });
      speedSel.addEventListener('change', function () { setSpeed(parseFloat(speedSel.value)); });
      speedWrap.append(h('span', 'ff-sr', 'Playback speed'), speedSel);
      themeBtn = btn('moon', 'Toggle theme (T)', function () { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true); });
      fullBtn = btn('expand', 'Full screen / present (F)', function () { toggleFull(); });
      var view = cluster(themeBtn, fullBtn);
      if (SC.some(function (sc) { return sc.says.length; })) {
        stepsPanel = buildSteps();
        stepsBtn = btn('steps', 'Show the steps as text', function () {
          stepsPanel.hidden = !stepsPanel.hidden;
          stepsBtn.setAttribute('aria-expanded', String(!stepsPanel.hidden));
          stepsBtn.classList.toggle('ff-active', !stepsPanel.hidden);
          stepsKey = null; S.dirty = true;
        });
        stepsBtn.setAttribute('aria-expanded', 'false');
        stepsBtn.setAttribute('aria-controls', stepsPanel.id);
        view.prepend(stepsBtn);
      }
      if (C.exportButton !== false) {
        exportBtn = btn('download', 'Export GIF / video / PNG', function () { toggleMenu(); });
        view.append(exportBtn);
        menu = buildMenu();
      }
      controls.append(cluster(prevBtn, playBtn, nextBtn), tl, cluster(stepBtn, speedWrap), h('span', 'ff-sep'), view);
      if (menu) figure.append(menu);
      if (stepsPanel) figure.append(stepsPanel);
      syncTabs(); syncButtons();
    }
    function setSpeed(v) { S.speed = snapSpeed(v); syncButtons(); }
    // Text version of every scenario: for screen readers, skimming, and printing
    var stepsKey = null;
    function buildSteps() {
      var panel = h('div', 'ff-steps');
      panel.id = 'ff-steps-' + Math.random().toString(36).slice(2, 8);
      panel.hidden = true;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Steps');
      SC.forEach(function (sc, si) {
        panel.append(h('h4', null, sc.label));
        var ol = h('ol');
        sc.beats.forEach(function (b, bi) {
          if (b.raw.say == null) return;
          var li = h('li'), bt = h('button');
          li.dataset.s = si; li.dataset.b = bi;
          bt.type = 'button';
          bt.innerHTML = miniMarkdown(b.raw.say);
          bt.addEventListener('click', function () { loadScenario(si); jumpBeat(bi); });
          li.append(bt);
          ol.append(li);
        });
        panel.append(ol);
      });
      return panel;
    }
    function syncSteps(i) {
      if (!stepsPanel || stepsPanel.hidden) return;
      var sc = SC[S.s], cur = -1;
      for (var k = 0; k <= i && k < sc.beats.length; k++) if (sc.beats[k].raw.say != null) cur = k;
      var key = S.s + ':' + cur;
      if (key === stepsKey) return;
      stepsKey = key;
      Array.prototype.forEach.call(stepsPanel.querySelectorAll('li'), function (li) {
        li.classList.toggle('ff-now', +li.dataset.s === S.s && +li.dataset.b === cur);
      });
    }
    function syncTabs() {
      tabs.forEach(function (tb, i) {
        tb.setAttribute('aria-selected', String(i === S.s));
        tb.tabIndex = i === S.s ? 0 : -1;
        if (i === S.s && progress) tb.append(progress);
      });
    }
    function syncButtons() {
      if (!playBtn) return;
      playBtn.replaceChildren(uiIcon(S.playing ? 'pause' : 'play'));
      playBtn.title = (S.playing ? 'Pause' : 'Play') + ' (Space)';
      stepBtn.textContent = S.manual ? 'step' : 'auto';
      stepBtn.classList.toggle('ff-active', S.manual);
      stepBtn.setAttribute('aria-pressed', String(S.manual));
      if (speedSel.value !== String(S.speed)) speedSel.value = String(S.speed);
      speedSel.classList.toggle('ff-active', S.speed !== 1);
      fullBtn.replaceChildren(uiIcon(S.full ? 'shrink' : 'expand'));
      caption.setAttribute('aria-live', S.manual ? 'polite' : 'off');
    }
    function setManual(on) {
      S.manual = !!on;
      if (S.manual) { var sc = SC[S.s], i = beatAt(sc, S.t); S.holdUntil = i >= 0 ? sc.beats[i].end - 1 : C.leadMs; }
      else { S.holdUntil = Infinity; S.playing = true; }
      syncButtons();
    }
    var idleTimer = null;
    function wake() {
      root.classList.remove('ff-idle');
      clearTimeout(idleTimer);
      if (S.full) idleTimer = setTimeout(function () { root.classList.add('ff-idle'); }, 2500);
    }
    root.addEventListener('mousemove', wake);
    root.addEventListener('touchstart', wake, { passive: true });
    function toggleFull(force) {
      var on = force != null ? force : !S.full;
      S.full = on;
      root.classList.toggle('ff-full', on);
      wake();
      try {
        if (on && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(function () {});
        if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {});
      } catch (e) { /* not allowed (iframe) - the CSS overlay still works */ }
      syncButtons();
      requestAnimationFrame(measure);
    }
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement && S.full) { S.full = false; root.classList.remove('ff-full'); syncButtons(); requestAnimationFrame(measure); }
    });

    /* ---------- Keyboard (presentation clickers send PageUp/PageDown) ---------- */
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      var k = e.key, done = true;
      if (k === ' ' || k === 'k' || k === 'K') { if (S.manual) next(); else (S.playing ? pause() : play()); }
      else if (k === 'ArrowRight' || k === 'PageDown' || k === 'l' || k === 'L') next();
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'j' || k === 'J') prev();
      else if (k === 'ArrowDown') { loadScenario((S.s + 1) % SC.length); if (S.manual) next(); else play(); }
      else if (k === 'ArrowUp') { loadScenario((S.s - 1 + SC.length) % SC.length); if (S.manual) next(); else play(); }
      else if (/^[1-9]$/.test(k) && +k <= SC.length) { loadScenario(+k - 1); if (S.manual) next(); else play(); }
      else if (k === 'f' || k === 'F') toggleFull();
      else if (k === 't' || k === 'T') setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
      else if (k === 's' || k === 'S') setManual(!S.manual);
      else if (k === '-' || k === '_') setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(S.speed) - 1)]);
      else if (k === '+' || k === '=') setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(S.speed) + 1)]);
      else if (k === 'r' || k === 'R') { loadScenario(S.s); if (S.manual) next(); else play(); }
      else if (k === 'Escape') { if (menu && !menu.hidden) menu.hidden = true; else if (S.full) toggleFull(false); else done = false; }
      else done = false;
      if (done) e.preventDefault();
    });

    // Host pages can drive the theme of an embedded diagram:
    //   iframe.contentWindow.postMessage({ flowfig: 'theme', value: 'dark' }, '*')
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || typeof d !== 'object' || d.flowfig == null) return;
      if (d.flowfig === 'theme') setTheme(d.value, false);
      else if (d.flowfig === 'scenario') loadScenario(+d.value || 0);
      else if (d.flowfig === 'play') play();
      else if (d.flowfig === 'pause') pause();
    });

    /* ================================================================
       In-page export (GIF / MP4 / WebM / PNG)
       Frames are rendered deterministically with seek(), rasterised through
       an SVG <foreignObject> snapshot, then encoded in the browser.
       ================================================================ */
    function setExportMode(on) {
      S.exporting = !!on;
      root.classList.toggle('ff-export', S.exporting);
      if (on) { S.hovered = null; root.classList.remove('ff-full'); }
      measure();
      render();
    }
    function cssText() {
      var el = document.getElementById('flowfig-css');
      if (el) return el.textContent;
      var out = '';
      Array.prototype.forEach.call(document.styleSheets, function (sh) {
        try { Array.prototype.forEach.call(sh.cssRules, function (r) { if (r.cssText.indexOf('ff-') >= 0 || r.cssText.indexOf('flowfig') >= 0) out += r.cssText + '\n'; }); } catch (e) { /* cross-origin sheet */ }
      });
      return out;
    }
    function makeSnapshot(W, H) {
      var css = cssText().replace(/&/g, '&amp;').replace(/</g, '&lt;');
      var ser = new XMLSerializer();
      return function (cv, sc) {
        var style = (root.getAttribute('style') || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        var markup = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(W * sc) + '" height="' + Math.round(H * sc) + '" viewBox="0 0 ' + W + ' ' + H + '">' +
          '<foreignObject x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<div xmlns="http://www.w3.org/1999/xhtml" class="' + root.className + '" data-theme="' + root.dataset.theme + '" style="' + style + ';margin:0;width:' + W + 'px;height:' + H + 'px">' +
          '<style>' + css + '</style>' + ser.serializeToString(frame) + '</div></foreignObject></svg>';
        var img = new Image();
        img.decoding = 'sync';
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
        return img.decode().then(function () {
          var ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.fillStyle = getComputedStyle(root).getPropertyValue('--ff-page') || '#fff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
        });
      };
    }
    function frameList(list, fps) {
      var out = [];
      list.forEach(function (si) {
        var n = Math.ceil(SC[si].total / 1000 * fps);
        for (var k = 0; k < n; k++) out.push([si, k * 1000 / fps]);
      });
      return out;
    }
    function exportMedia(opts) {
      opts = opts || {};
      var format = (opts.format || 'gif').toLowerCase();
      var saved = { s: S.s, t: S.t, playing: S.playing };
      var progressCb = opts.onProgress || function () {};
      var signal = opts.signal || {};
      pause();
      setExportMode(true);
      if (opts.theme && opts.theme !== 'current') applyTheme(resolveTheme(opts.theme));
      var list = opts.scope === 'all' ? SC.map(function (_, i) { return i; }) : [saved.s];
      function restore() {
        setExportMode(false);
        applyTheme();
        seek(saved.s, saved.t);
        if (saved.playing) play();
      }
      var job = nextFrame().then(function () {
        measure(); render();
        var W = Math.ceil(frame.offsetWidth), H = Math.ceil(frame.offsetHeight);
        var snap = makeSnapshot(W, H);
        function mkCanvas(sc, even) {
          var cv = document.createElement('canvas');
          var w = Math.round(W * sc), hh = Math.round(H * sc);
          if (even) { w -= w % 2; hh -= hh % 2; }
          cv.width = w; cv.height = hh;
          return cv;
        }
        if (format === 'png') {
          var pc = mkCanvas(opts.scale || 2);
          seek(saved.s, saved.t);
          return snap(pc, opts.scale || 2).then(function () { return new Promise(function (r) { pc.toBlob(r, 'image/png'); }); });
        }
        if (format === 'gif') {
          var gsc = opts.scale || Math.min(1, (opts.maxWidth || 1280) / W);
          var delayCs = Math.max(2, Math.round(100 / (opts.fps || 12)));
          var gfps = 100 / delayCs;
          var frames = frameList(list, gfps);
          var cv = mkCanvas(gsc);
          var ctx = cv.getContext('2d', { willReadFrequently: true });
          return import(C.encoders.gifenc).then(function (G) {
            // One global palette sampled from representative frames: less flicker, faster.
            var samples = [];
            list.forEach(function (si) {
              var sc = SC[si];
              samples.push([si, sc.lastEnd]);
              sc.beats.forEach(function (b) { if (b.hops.length) samples.push([si, (b.start + b.arrive) / 2]); });
            });
            samples = samples.slice(0, 12);
            var small = document.createElement('canvas');
            small.width = Math.min(cv.width, 360);
            small.height = Math.max(1, Math.round(cv.height * small.width / cv.width));
            var sctx = small.getContext('2d', { willReadFrequently: true });
            var chunks = [];
            var chain = Promise.resolve();
            samples.forEach(function (fr) {
              chain = chain.then(function () {
                seek(fr[0], fr[1]);
                return snap(cv, gsc).then(function () {
                  sctx.drawImage(cv, 0, 0, small.width, small.height);
                  chunks.push(sctx.getImageData(0, 0, small.width, small.height).data);
                });
              });
            });
            return chain.then(function () {
              var total = chunks.reduce(function (a, c) { return a + c.length; }, 0);
              var all = new Uint8ClampedArray(total), off = 0;
              chunks.forEach(function (c) { all.set(c, off); off += c.length; });
              // 255 real colours + 1 transparent slot. Pixels that did not change since the
              // previous frame are written as transparent, which keeps files small.
              var colors = G.quantize(all, 255);
              var tIndex = colors.length;
              var palette = colors.concat([[0, 0, 0]]);
              var gif = G.GIFEncoder();
              var k = 0, prevIdx = null;
              function step() {
                if (signal.aborted) throw new Error('Export cancelled');
                if (k >= frames.length) { gif.finish(); return new Blob([gif.bytes()], { type: 'image/gif' }); }
                seek(frames[k][0], frames[k][1]);
                return snap(cv, gsc).then(function () {
                  var data = ctx.getImageData(0, 0, cv.width, cv.height).data;
                  var index = G.applyPalette(data, colors);
                  var out = index;
                  if (prevIdx) {
                    out = new Uint8Array(index.length);
                    for (var q = 0; q < index.length; q++) out[q] = index[q] === prevIdx[q] ? tIndex : index[q];
                  }
                  gif.writeFrame(out, cv.width, cv.height, { palette: k === 0 ? palette : undefined, delay: delayCs * 10, transparent: !!prevIdx, transparentIndex: tIndex, dispose: 1 });
                  prevIdx = index;
                  k++;
                  progressCb(k / frames.length);
                  return step();
                });
              }
              return step();
            });
          });
        }
        // mp4 / webm through WebCodecs + mediabunny
        var vfps = opts.fps || 30;
        var vsc = opts.scale || Math.min(2, (opts.maxWidth || 1920) / W);
        var vc = mkCanvas(vsc, true);
        var vframes = frameList(list, vfps);
        return import(C.encoders.mediabunny).then(function (M) {
          var webm = format === 'webm';
          var codecs = webm ? ['vp9', 'vp8', 'av1'] : ['avc', 'hevc', 'vp9', 'av1'];
          return M.getFirstEncodableVideoCodec(codecs, { width: vc.width, height: vc.height }).then(function (codec) {
            if (!codec) throw new Error('This browser cannot encode ' + format.toUpperCase() + '. Export a GIF, or use scripts/export.mjs.');
            var output = new M.Output({ format: webm ? new M.WebMOutputFormat() : new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
            var source = new M.CanvasSource(vc, { codec: codec, bitrate: M.QUALITY_HIGH });
            output.addVideoTrack(source, { frameRate: vfps });
            var k = 0;
            function step() {
              if (signal.aborted) return output.cancel().then(function () { throw new Error('Export cancelled'); });
              if (k >= vframes.length) return output.finalize().then(function () { var bl = new Blob([output.target.buffer], { type: output.format.mimeType }); bl.codec = codec; return bl; });
              seek(vframes[k][0], vframes[k][1]);
              return snap(vc, vsc).then(function () { return source.add(k / vfps, 1 / vfps); }).then(function () { k++; progressCb(k / vframes.length); return step(); });
            }
            return output.start().then(step);
          });
        });
      });
      return job.then(function (blob) { restore(); return blob; }, function (err) { restore(); throw err; });
    }
    function download(blob, name) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }

    // Export menu UI
    var exportChoice = { format: 'gif', theme: 'current', scope: 'current' };
    function buildMenu() {
      var m = h('div', 'ff-menu');
      m.hidden = true;
      function seg(title, key, options) {
        m.append(h('h4', null, title));
        var row = h('div', 'ff-seg');
        options.forEach(function (o) {
          var b = h('button', null, o[1]);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(exportChoice[key] === o[0]));
          b.addEventListener('click', function () {
            exportChoice[key] = o[0];
            Array.prototype.forEach.call(row.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
          });
          row.append(b);
        });
        m.append(row);
      }
      seg('Format', 'format', [['gif', 'GIF'], ['mp4', 'MP4'], ['webm', 'WebM'], ['png', 'PNG']]);
      seg('Theme', 'theme', [['current', 'current'], ['light', 'light'], ['dark', 'dark']]);
      if (SC.length > 1) seg('Scenarios', 'scope', [['current', 'this one'], ['all', 'all']]);
      var go = h('button', 'ff-go', 'Export');
      go.type = 'button';
      go.addEventListener('click', function () { m.hidden = true; runExport(); });
      m.append(go);
      m.append(h('p', 'ff-note', 'Renders frame by frame in this browser (Chrome/Edge recommended). Encoders load from jsDelivr on first use. For offline or print-quality output use scripts/export.mjs.'));
      return m;
    }
    function toggleMenu() { menu.hidden = !menu.hidden; }
    function runExport() {
      var modal = h('div', 'ff-modal');
      var boxEl = h('div', 'ff-modal-box');
      var label = h('div', null, 'Rendering ' + exportChoice.format.toUpperCase() + '…');
      var bar = h('div', 'ff-bar'); var fill = h('div'); bar.append(fill);
      var cancel = h('button', 'ff-btn', 'Cancel');
      var signal = { aborted: false };
      cancel.addEventListener('click', function () { signal.aborted = true; label.textContent = 'Cancelling…'; });
      boxEl.append(label, bar, cancel);
      modal.append(boxEl);
      modal.classList.add('flowfig');
      modal.dataset.theme = root.dataset.theme;
      document.body.append(modal);
      var th = exportChoice.theme === 'current' ? root.dataset.theme : exportChoice.theme;
      var ext = exportChoice.format;
      var scen = exportChoice.scope === 'all' || SC.length === 1 ? '' : '-' + slug(SC[S.s].label);
      exportMedia({ format: ext, theme: exportChoice.theme, scope: exportChoice.scope, signal: signal, onProgress: function (p) { fill.style.width = (p * 100).toFixed(1) + '%'; label.textContent = 'Rendering ' + ext.toUpperCase() + '… ' + Math.round(p * 100) + '%'; } })
        .then(function (blob) {
          modal.remove();
          download(blob, slug(C.title) + scen + '-' + th + '.' + ext);
        }, function (err) {
          label.textContent = err && err.message ? err.message : String(err);
          cancel.textContent = 'Close';
          cancel.onclick = function () { modal.remove(); };
          console.error('[flowfig] export failed', err);
        });
    }

    /* ---------- Boot ---------- */
    var initialTheme = params.theme || (!params.export && C.rememberTheme !== false ? store('flowfig-theme') : null) || C.themeMode || 'auto';
    S.themeMode = initialTheme === 'light' || initialTheme === 'dark' ? initialTheme : 'auto';
    if (!params.export) buildControls();
    applyTheme();
    var startS = 0;
    if (params.scenario != null) {
      var byName = SC.findIndex(function (x) { return slug(x.label) === slug(params.scenario); });
      startS = byName >= 0 ? byName : clamp(parseInt(params.scenario, 10) || 0, 0, SC.length - 1);
    }
    loadScenario(startS);
    if (S.manual && !params.export) { if (S.reduced) jumpBeat(0); else S.playing = false; }
    if (params.export) setExportMode(true);
    if (params.present) toggleFull(true);
    syncButtons();

    var measureQueued = false;
    var ro = new ResizeObserver(function () {
      if (measureQueued) return;
      measureQueued = true;
      requestAnimationFrame(function () { measureQueued = false; measure(); });
    });
    ro.observe(fitBox); ro.observe(stage);
    Object.keys(boxes).forEach(function (id) { ro.observe(boxes[id]); });
    measure();
    requestAnimationFrame(tick);

    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    var ready = Promise.all([document.fonts ? document.fonts.ready : null].concat(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; })))
      .then(nextFrame).then(function () { measure(); render(); api.isReady = true; return api; });

    var api = {
      version: VERSION,
      config: cfg,
      isReady: false,
      ready: null,
      get scenarios() { return SC.map(function (x) { return { label: x.label, duration: x.total, lastBeatEnd: x.lastEnd, beats: x.beats.length }; }); },
      get state() { return { scenario: S.s, time: S.t, playing: S.playing, manual: S.manual, theme: root.dataset.theme, themeMode: S.themeMode }; },
      seek: seek,
      play: play,
      pause: pause,
      next: next,
      prev: prev,
      scenario: function (i) { loadScenario(i); render(); },
      setTheme: function (m) { setTheme(m, false); render(); },
      setManual: setManual,
      fullscreen: toggleFull,
      setExportMode: setExportMode,
      frameRect: function () { var r = frame.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; },
      exportMedia: exportMedia,
      download: function (opts) { return exportMedia(opts).then(function (b) { download(b, slug(C.title) + '.' + (opts && opts.format || 'gif')); return b; }); },
      measure: measure,
      get routeMs() { return lastRouteMs; },
      get routes() { return routes; },
      render: render
    };
    api.ready = ready;
    return api;
  }

  /* ---------------- config normalisation ---------------- */
  function normalize(cfg) {
    var C = Object.assign({}, cfg);
    C.layout = cfg.layout || { children: [] };
    C.scenarios = (cfg.scenarios || cfg.steps || []).map(function (sc) { return Object.assign({}, sc, { flow: sc.flow || sc.beats || [] }); });
    if (!C.scenarios.length) C.scenarios = [{ label: 'Overview', flow: [] }];
    // Arrowheads: "auto" puts one at both ends when any hop travels back along the edge
    var back = {};
    C.scenarios.forEach(function (sc) { sc.flow.forEach(function (b) { toHops(b.edges != null ? b.edges : b.hops).forEach(function (hp) { if (hp.back) back[hp.edge] = 1; }); }); });
    var defArrows = cfg.arrows || 'auto';
    C.edges = (cfg.edges || []).map(function (e) {
      var id = e.id || e.from + '->' + e.to;
      var mode = e.arrows || (e.both ? 'both' : defArrows);
      if (mode === 'auto') mode = back[id] ? 'both' : 'end';
      return Object.assign({}, e, { id: id, fromSide: sideName(e.fromSide), toSide: sideName(e.toSide), arrowStart: mode === 'both' || mode === 'start', arrowEnd: mode === 'both' || mode === 'end' });
    });
    C.routing = cfg.routing === 'orthogonal' ? 'orthogonal' : 'curved';
    C.beatMs = cfg.beatMs || cfg.speed || 2200;
    C.travelMs = cfg.travelMs || 1400;
    C.leadMs = cfg.leadMs != null ? cfg.leadMs : 400;
    C.holdMs = cfg.holdMs != null ? cfg.holdMs : 1800;
    C.minScale = cfg.minScale || 0.5;
    C.maxScale = cfg.maxScale || 1;
    C.maxFullScale = cfg.maxFullScale || 2.5;
    if (typeof cfg.theme === 'string') { C.themeMode = cfg.theme; C.theme = {}; }
    else { C.theme = cfg.theme || {}; C.themeMode = C.theme.mode || 'auto'; }
    C.encoders = Object.assign({}, ENCODERS, cfg.encoders || {});
    return C;
  }
  function collectVariants(C) {
    var map = new Map();
    C.scenarios.forEach(function (sc) {
      sc.flow.forEach(function (b) {
        Object.keys(b.show || {}).forEach(function (id) {
          var content = b.show[id];
          if (content == null) return;
          if (!map.has(id)) map.set(id, new Map());
          map.get(id).set(JSON.stringify(content), content);
        });
      });
    });
    return map;
  }
  function parseParams() {
    var out = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v === '' ? '1' : v; }); } catch (e) { /* ignore */ }
    ['export', 'present', 'embed'].forEach(function (k) { if (out[k] === '0' || out[k] === 'false') delete out[k]; });
    return out;
  }

  function boot() {
    var cfg = window.FLOWFIG_CONFIG;
    var el = document.getElementById('flowfig-config');
    if (!cfg && el) {
      try { cfg = JSON.parse(el.textContent); } catch (e) { console.error('[flowfig] invalid JSON config', e); return; }
    }
    if (!cfg) { console.error('[flowfig] no config found'); return; }
    var mount = document.getElementById('flowfig');
    if (!mount) { mount = document.createElement('div'); mount.id = 'flowfig'; document.body.append(mount); }
    window.flowfig = createFlowfig(mount, cfg, parseParams());
  }
  window.createFlowfig = createFlowfig;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
