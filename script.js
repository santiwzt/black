/* ============================================================
   ROYAL NEON CASINO — script.js
   ------------------------------------------------------------
   Simulación recreativa con dinero ficticio.

   Índice
   0.  Utilidades
   1.  Guardado local y configuración
   2.  Runtime: temporizadores y bucle de animación únicos
   3.  Audio (Web Audio API: efectos + música generativa)
   4.  Saldo compartido
   5.  Efectos visuales compartidos (fichas voladoras, partículas)
   6.  Estadísticas e historial
   7.  Navegación y lobby
   8.  Modales (configuración, perfil, confirmación)
   9.  Cartas (mazo, render 3D incremental)
   10. Blackjack
   11. Poker Texas Hold'em
   12. Ruleta
   13. Coin Miner
   14. Chicken Road
   15. Plinko
   16. Aviator
   17. Carrera de caballos
   18. Reinicio general e inicialización
   19. Animación de victoria / derrota (original, sin cambios)
   ============================================================ */

/* ============================================================
   0. UTILIDADES
   ============================================================ */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);
const round2 = v => Math.round(v * 100) / 100;

const Ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function formatMoney(value) {
  let rounded = Number(Number(value || 0).toFixed(2));

  if (Number.isInteger(rounded)) {
    return "$" + rounded;
  }

  return "$" + rounded.toFixed(2);
}

/* Alias conservados del código original (cada juego tenía su propio formateador). */
function pokerMoney(value) { return formatMoney(value); }
function rouletteMoney(value) { return formatMoney(value); }
function plMoney(value) { return formatMoney(value); }
function avMoney(value) { return formatMoney(value); }
function hrMoney(value) { return formatMoney(value); }
function crMoney(value) { return "$" + Math.round(value); }

function shortMoney(value) {
  const v = Math.abs(value);
  if (v >= 1e6) return "$" + round2(value / 1e6) + "M";
  if (v >= 10000) return "$" + Math.round(value / 1000) + "K";
  if (v >= 1000) return "$" + (Math.round(value / 100) / 10) + "K";
  return formatMoney(value);
}

function setMessage(element, text, type = "") {
  if (!element) return;
  element.textContent = text;
  element.className = "message " + type;
  /* reinicia la micro-animación de cambio de mensaje */
  void element.offsetWidth;
  element.classList.add("msg-swap");
}

function flashValue(el) {
  if (!el) return;
  el.classList.remove("flash-value");
  void el.offsetWidth;
  el.classList.add("flash-value");
}

/* Valor de una ficha: ALL IN usa el saldo completo disponible. */
function chipAmount(chip) {
  return chip.dataset.allin === "true" ? balance : Number(chip.dataset.value);
}

/* ============================================================
   1. GUARDADO LOCAL Y CONFIGURACIÓN
   ============================================================ */
const Store = {
  prefix: "rnc:",
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      /* almacenamiento no disponible: se sigue sin persistir */
    }
  }
};

function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) return "low";
  if (cores <= 4) return "medium";
  return "high";
}

const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Settings = Object.assign(
  {
    sound: true,
    music: false,
    master: 80,
    sfx: 80,
    musicVol: 50,
    quality: detectQuality(),
    reduceMotion: !!prefersReduced,
    contrast: false,
    largeText: false,
    fast: false,
    tilt: true
  },
  Store.get("settings", {})
);

function saveSettings() {
  Store.set("settings", Settings);
}

const Quality = {
  dprCap() {
    return Settings.quality === "high" ? 2 : Settings.quality === "medium" ? 1.5 : 1;
  },
  particles(n) {
    const f = Settings.reduceMotion ? 0.15 : Settings.quality === "high" ? 1 : Settings.quality === "medium" ? 0.6 : 0.3;
    return Math.max(1, Math.round(n * f));
  },
  fancy() {
    return Settings.quality !== "low" && !Settings.reduceMotion;
  }
};

/* Escala de duración de las animaciones de juego (cartas, giros, saltos). */
function T(ms) {
  if (Settings.reduceMotion) return Math.round(ms * 0.2);
  if (Settings.fast) return Math.round(ms * 0.55);
  return ms;
}

/* Multiplicador de velocidad de las simulaciones en canvas. */
function simSpeed() {
  if (Settings.reduceMotion) return 3;
  if (Settings.fast) return 1.7;
  return 1;
}

function applySettings() {
  const body = document.body;
  body.classList.toggle("reduce-motion", !!Settings.reduceMotion);
  body.classList.toggle("high-contrast", !!Settings.contrast);
  body.classList.toggle("large-text", !!Settings.largeText);
  body.classList.toggle("fast-anim", !!Settings.fast);
  body.classList.remove("quality-low", "quality-medium", "quality-high");
  body.classList.add("quality-" + Settings.quality);

  const soundBtn = $("#sound-toggle");
  const musicBtn = $("#music-toggle");
  if (soundBtn) soundBtn.setAttribute("aria-pressed", String(!!Settings.sound));
  if (musicBtn) musicBtn.setAttribute("aria-pressed", String(!!Settings.music));

  Sound.applyVolumes();
}

/* ============================================================
   2. RUNTIME — temporizadores rastreados y bucle rAF único
   ------------------------------------------------------------
   Todos los setTimeout de los juegos pasan por Runtime.later()
   para que el reinicio general pueda cancelarlos y ninguna
   ronda siga ejecutándose (ni pagando) después del reset.
   ============================================================ */
const Runtime = {
  epoch: 0,
  timers: new Set(),

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, Math.max(0, ms));
    this.timers.add(id);
    return id;
  },

  sleep(ms) {
    return new Promise(resolve => this.later(resolve, ms));
  },

  cancel(id) {
    clearTimeout(id);
    this.timers.delete(id);
  },

  clearAll() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();
    this.epoch++;
  }
};

const later = (fn, ms) => Runtime.later(fn, ms);
const sleep = ms => Runtime.sleep(ms);

const Loop = {
  tasks: new Map(),
  raf: null,
  last: 0,

  add(name, fn) {
    this.tasks.set(name, fn);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(t => this.tick(t));
    }
  },

  remove(name) {
    this.tasks.delete(name);
  },

  has(name) {
    return this.tasks.has(name);
  },

  tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    for (const [name, fn] of this.tasks) {
      let keep = true;
      try {
        keep = fn(dt, now);
      } catch (err) {
        console.error("Error en animación '" + name + "':", err);
        keep = false;
      }
      if (keep === false) this.tasks.delete(name);
    }

    this.raf = this.tasks.size ? requestAnimationFrame(t => this.tick(t)) : null;
  }
};

/* Ajusta un canvas a su tamaño CSS respetando el límite de DPR de la calidad gráfica. */
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, Quality.dprCap());
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);

  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ============================================================
   3. AUDIO — Web Audio API
   ------------------------------------------------------------
   No se crea ni reproduce nada hasta la primera interacción.
   Todos los sonidos son sintetizados (sin archivos externos).
   ============================================================ */
const Sound = (() => {
  let ctx = null;
  let master, sfxBus, musicBus, noiseBuf;
  const loops = {};

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;

    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();

    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    applyVolumes();
    return ctx;
  }

  function applyVolumes() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(Settings.master / 100, now, 0.02);
    sfxBus.gain.setTargetAtTime(Settings.sound ? Settings.sfx / 100 : 0, now, 0.02);
    musicBus.gain.setTargetAtTime(Settings.music ? (Settings.musicVol / 100) * 0.55 : 0, now, 0.15);
  }

  function ready() {
    if (!Settings.sound) return null;
    const c = init();
    if (!c) return null;
    if (c.state === "suspended") c.resume();
    return c;
  }

  function unlock() {
    const c = init();
    if (c && c.state === "suspended") c.resume();
  }

  function tone(o) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    if (o.detune) osc.detune.value = o.detune;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.ff || 2000;
      f.Q.value = o.q || 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  /* Bucle continuo controlable (motor, rodado de la bola, público). */
  function startLoop(name, build) {
    const c = ready();
    if (!c || loops[name]) return;
    loops[name] = build(c);
  }

  function setLoop(name, params) {
    const l = loops[name];
    if (l && l.set) l.set(params);
  }

  function stopLoop(name) {
    const l = loops[name];
    if (!l) return;
    delete loops[name];
    try { l.stop(); } catch (e) { /* ya detenido */ }
  }

  function stopAllLoops() {
    Object.keys(loops).forEach(stopLoop);
  }

  const fx = {
    click() { tone({ freq: 1900, to: 1250, type: "triangle", dur: 0.05, vol: 0.06 }); },
    chip() {
      noise({ freq: 3800, q: 6, dur: 0.05, vol: 0.22 });
      noise({ freq: 2600, q: 5, dur: 0.06, vol: 0.16, delay: 0.035 });
      tone({ freq: 2900, type: "sine", dur: 0.04, vol: 0.05, delay: 0.01 });
    },
    chipsCollect() {
      for (let i = 0; i < 5; i++) noise({ freq: rand(2600, 4200), q: 6, dur: 0.05, vol: 0.12, delay: i * 0.045 });
    },
    card() {
      noise({ freq: 3200, to: 900, q: 0.8, dur: 0.14, vol: 0.22, filter: "bandpass" });
      tone({ freq: 160, to: 90, type: "sine", dur: 0.06, vol: 0.06, delay: 0.1 });
    },
    flip() {
      noise({ freq: 2400, to: 4200, q: 1.5, dur: 0.08, vol: 0.18 });
      tone({ freq: 700, to: 1100, type: "triangle", dur: 0.05, vol: 0.04 });
    },
    tick(v = 1) { tone({ freq: 3400, type: "triangle", dur: 0.018, vol: 0.05 * v }); noise({ freq: 5200, q: 8, dur: 0.015, vol: 0.06 * v }); },
    whoosh() { noise({ freq: 300, to: 2400, q: 0.9, dur: 0.38, vol: 0.18, attack: 0.08 }); },
    peg(row = 0) {
      const f = 520 + row * 48 + rand(-12, 12);
      tone({ freq: f, type: "sine", dur: 0.14, vol: 0.05 });
      tone({ freq: f * 2.01, type: "triangle", dur: 0.06, vol: 0.015 });
    },
    slot(mult) {
      const base = mult >= 3 ? 880 : mult >= 1 ? 660 : 330;
      tone({ freq: base, type: "triangle", dur: 0.22, vol: 0.09 });
      tone({ freq: base * 1.5, type: "sine", dur: 0.25, vol: 0.05, delay: 0.05 });
    },
    coin() {
      tone({ freq: 1320, type: "sine", dur: 0.16, vol: 0.1 });
      tone({ freq: 1760, type: "sine", dur: 0.3, vol: 0.09, delay: 0.07 });
      tone({ freq: 2640, type: "triangle", dur: 0.18, vol: 0.03, delay: 0.07 });
    },
    bomb() {
      noise({ freq: 900, to: 60, q: 0.6, dur: 1.0, vol: 0.55, filter: "lowpass", attack: 0.004 });
      tone({ freq: 130, to: 36, type: "sine", dur: 0.7, vol: 0.4 });
    },
    hop() { tone({ freq: 480, to: 920, type: "triangle", dur: 0.11, vol: 0.06 }); },
    land() { tone({ freq: 220, to: 140, type: "sine", dur: 0.07, vol: 0.06 }); },
    car() {
      noise({ freq: 500, to: 1800, q: 0.7, dur: 0.45, vol: 0.2, attack: 0.1 });
      tone({ freq: 410, type: "square", dur: 0.22, vol: 0.035, filter: "lowpass", ff: 1400 });
      tone({ freq: 520, type: "square", dur: 0.22, vol: 0.03, filter: "lowpass", ff: 1400 });
    },
    honk() {
      tone({ freq: 392, type: "square", dur: 0.28, vol: 0.04, filter: "lowpass", ff: 1500 });
      tone({ freq: 494, type: "square", dur: 0.28, vol: 0.035, filter: "lowpass", ff: 1500 });
    },
    crash() {
      noise({ freq: 1600, to: 120, q: 0.5, dur: 0.6, vol: 0.45, filter: "lowpass" });
      tone({ freq: 200, to: 50, type: "sawtooth", dur: 0.4, vol: 0.12, filter: "lowpass", ff: 700 });
    },
    barrier() { noise({ freq: 1800, q: 3, dur: 0.07, vol: 0.12 }); tone({ freq: 300, type: "square", dur: 0.06, vol: 0.03, filter: "lowpass", ff: 900 }); },
    cash() {
      tone({ freq: 988, type: "triangle", dur: 0.12, vol: 0.07 });
      tone({ freq: 1319, type: "triangle", dur: 0.2, vol: 0.07, delay: 0.08 });
      for (let i = 0; i < 4; i++) noise({ freq: rand(3000, 4500), q: 7, dur: 0.04, vol: 0.08, delay: 0.12 + i * 0.05 });
    },
    thump(v = 1) {
      tone({ freq: rand(80, 100), to: 48, type: "sine", dur: 0.09, vol: 0.09 * v });
      noise({ freq: 380, q: 0.8, dur: 0.06, vol: 0.05 * v, filter: "lowpass" });
    },
    bell() {
      tone({ freq: 1568, type: "sine", dur: 1.2, vol: 0.08 });
      tone({ freq: 2093, type: "sine", dur: 1.0, vol: 0.05, delay: 0.02 });
      tone({ freq: 3136, type: "sine", dur: 0.6, vol: 0.02, delay: 0.02 });
    },
    thud() { tone({ freq: 150, to: 70, type: "sine", dur: 0.18, vol: 0.12 }); },
    select() { tone({ freq: 1200, to: 1600, type: "sine", dur: 0.06, vol: 0.05 }); },
    deselect() { tone({ freq: 1400, to: 1000, type: "sine", dur: 0.06, vol: 0.04 }); },
    error() { tone({ freq: 220, type: "square", dur: 0.12, vol: 0.04, filter: "lowpass", ff: 900 }); }
  };

  /* --- bucles --- */
  function engineLoop(c) {
    const out = c.createGain();
    out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.4);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 62;
    const o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.value = 124;
    const o2g = c.createGain();
    o2g.gain.value = 0.3;
    const n = c.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 900;
    nf.Q.value = 0.8;
    const ng = c.createGain();
    ng.gain.value = 0.5;
    o1.connect(lp);
    o2.connect(o2g);
    o2g.connect(lp);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(lp);
    lp.connect(out);
    out.connect(sfxBus);
    o1.start();
    o2.start();
    n.start();
    return {
      set({ mult }) {
        const t = c.currentTime;
        const f = 62 + Math.log(Math.max(1, mult)) * 46;
        o1.frequency.setTargetAtTime(f, t, 0.1);
        o2.frequency.setTargetAtTime(f * 2.01, t, 0.1);
        lp.frequency.setTargetAtTime(700 + Math.log(Math.max(1, mult)) * 900, t, 0.1);
        nf.frequency.setTargetAtTime(900 + Math.log(Math.max(1, mult)) * 700, t, 0.1);
      },
      stop() {
        const t = c.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, 0.08);
        [o1, o2, n].forEach(node => node.stop(t + 0.5));
      }
    };
  }

  function noiseBedLoop(freq, q, vol, type = "bandpass") {
    return c => {
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.3);
      src.connect(f);
      f.connect(g);
      g.connect(sfxBus);
      src.start();
      return {
        set({ level = 1, freq: fq }) {
          const t = c.currentTime;
          g.gain.setTargetAtTime(Math.max(0.0001, vol * level), t, 0.08);
          if (fq) f.frequency.setTargetAtTime(fq, t, 0.08);
        },
        stop() {
          const t = c.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setTargetAtTime(0.0001, t, 0.1);
          src.stop(t + 0.6);
        }
      };
    };
  }

  /* --- música generativa --- */
  const Music = {
    timer: null,
    next: 0,
    step: 0,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],

    start() {
      const c = init();
      if (!c || this.timer) return;
      if (c.state === "suspended") c.resume();
      this.next = c.currentTime + 0.1;
      this.step = 0;
      this.timer = setInterval(() => this.schedule(), 120);
      this.schedule();
      applyVolumes();
    },

    stop() {
      clearInterval(this.timer);
      this.timer = null;
      applyVolumes();
    },

    note(midi, t, dur, vol, type) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = type === "pad" ? 1100 : 2400;
      osc.type = type === "pad" ? "triangle" : type === "bass" ? "sine" : "sine";
      osc.frequency.value = f;
      if (type === "pad") osc.detune.value = rand(-7, 7);
      const att = type === "pad" ? 0.8 : 0.008;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(musicBus);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    },

    schedule() {
      if (!ctx) return;
      const beat = 0.6;
      while (this.next < ctx.currentTime + 0.6) {
        const bar = Math.floor(this.step / 8) % this.chords.length;
        const chord = this.chords[bar];
        const s = this.step % 8;
        const t = this.next;
        if (s === 0) {
          chord.slice(0, 3).forEach(n => this.note(n, t, beat * 4.4, 0.035, "pad"));
          this.note(chord[0] - 12, t, beat * 1.8, 0.07, "bass");
        }
        if (s === 4) this.note(chord[0] - 12, t, beat * 1.6, 0.05, "bass");
        const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
        if (Math.random() > 0.18) this.note(chord[pattern[s]] + 12, t, 0.5, 0.018, "pluck");
        this.next += beat / 2;
        this.step++;
      }
    }
  };

  return {
    init,
    unlock,
    applyVolumes,
    play(name, ...args) {
      if (!Settings.sound) return;
      const f = fx[name];
      if (f) {
        try { f(...args); } catch (e) { /* audio no crítico */ }
      }
    },
    startEngine() { startLoop("engine", engineLoop); },
    setEngine(mult) { setLoop("engine", { mult }); },
    stopEngine() { stopLoop("engine"); },
    startRoll() { startLoop("roll", noiseBedLoop(1800, 0.7, 0.08)); },
    setRoll(level, freq) { setLoop("roll", { level, freq }); },
    stopRoll() { stopLoop("roll"); },
    startCrowd() { startLoop("crowd", noiseBedLoop(1100, 0.4, 0.05)); },
    setCrowd(level) { setLoop("crowd", { level }); },
    stopCrowd() { stopLoop("crowd"); },
    stopAllLoops,
    musicOn() { Music.start(); },
    musicOff() { Music.stop(); }
  };
})();

/* Desbloquea el audio solo tras una interacción real del usuario. */
["pointerdown", "keydown"].forEach(evt => {
  window.addEventListener(evt, function unlockOnce() {
    Sound.unlock();
    if (Settings.music) Sound.musicOn();
    window.removeEventListener(evt, unlockOnce);
  }, { passive: true });
});

/* ============================================================
   4. SALDO COMPARTIDO
   ============================================================ */
const INITIAL_BALANCE = 5000;
let balance = INITIAL_BALANCE;

const globalBalanceEl = document.getElementById("global-balance");
const resetCasinoBtn = document.getElementById("reset-casino");
const walletEl = document.getElementById("wallet");
const walletDeltaEl = document.getElementById("wallet-delta");

const walletView = { shown: balance, from: balance, to: balance, start: 0, lastValue: balance };
let saveBalanceTimer = null;

function updateBalance() {
  /* normaliza errores de coma flotante para que el saldo nunca derive */
  balance = round2(balance);
  if (balance < 0) balance = 0;

  const diff = round2(balance - walletView.lastValue);
  walletView.lastValue = balance;

  if (diff !== 0) {
    walletView.from = walletView.shown;
    walletView.to = balance;
    walletView.start = performance.now();
    Loop.add("wallet", walletTick);

    if (walletEl) {
      walletEl.classList.remove("pulse-up", "pulse-down");
      void walletEl.offsetWidth;
      walletEl.classList.add(diff > 0 ? "pulse-up" : "pulse-down");
    }

    if (walletDeltaEl) {
      walletDeltaEl.textContent = (diff > 0 ? "+" : "−") + formatMoney(Math.abs(diff));
      walletDeltaEl.className = "wallet-delta " + (diff > 0 ? "up" : "down");
      void walletDeltaEl.offsetWidth;
      walletDeltaEl.classList.add("show");
    }
  } else {
    globalBalanceEl.textContent = formatMoney(balance);
  }

  clearTimeout(saveBalanceTimer);
  saveBalanceTimer = setTimeout(saveBalance, 250);
}

function walletTick(dt, now) {
  const t = clamp((now - walletView.start) / 650, 0, 1);
  walletView.shown = lerp(walletView.from, walletView.to, Ease.outCubic(t));
  globalBalanceEl.textContent = formatMoney(t >= 1 ? walletView.to : walletView.shown);
  if (t >= 1) {
    walletView.shown = walletView.to;
    return false;
  }
  return true;
}

/* Las apuestas colocadas que todavía no entraron en juego se devuelven al guardar. */
function pendingRefundables() {
  let total = 0;
  try {
    if (!bj.active) total += bj.bet;
    if (pk.phase === "betting") total += pk.bet;
    if (!rt.spinning) total += rouletteTotalBet();
    if (!cm.active) total += cm.bet;
    if (!cr.active) total += cr.bet;
    if (!pl.dropping) total += pl.bet;
    if (!av.active) total += av.bet;
    if (!hr.racing) total += hr.bet;
  } catch (e) {
    /* durante la carga inicial algunos estados todavía no existen */
  }
  return total;
}

function saveBalance() {
  Store.set("balance", round2(balance + pendingRefundables()));
}

window.addEventListener("beforeunload", saveBalance);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveBalance();
});

/* ============================================================
   5. EFECTOS VISUALES COMPARTIDOS
   ============================================================ */
const CHIP_COLORS = {
  c25: ["#1f9e63", "#f7f2e6"],
  c50: ["#e8742a", "#f7f2e6"],
  c100: ["#23202e", "#f0c96b"],
  c500: ["#7b3fe4", "#f7f2e6"],
  c1000: ["#d9a634", "#fff7df"],
  c5000: ["#c2183a", "#ffd6de"],
  cx: ["#8a8aa0", "#f7f2e6"]
};

function chipClassFor(value) {
  if (value >= 5000) return "c5000";
  if (value >= 1000) return "c1000";
  if (value >= 500) return "c500";
  if (value >= 100) return "c100";
  if (value >= 50) return "c50";
  if (value >= 25) return "c25";
  return "cx";
}

function decomposeChips(amount, max = 10) {
  const denoms = [5000, 1000, 500, 100, 50, 25];
  let rest = Math.floor(amount);
  const out = [];
  for (const d of denoms) {
    while (rest >= d && out.length < max) {
      out.push("c" + d);
      rest -= d;
    }
  }
  if (out.length === 0 && amount > 0) out.push("cx");
  return out;
}

function renderChipStack(el, amount, opts = {}) {
  if (!el) return;
  /* una pila que se está liquidando (premio/barrido) no se pisa salvo que se fuerce */
  if (el.dataset.settling === "1") {
    if (!opts.force) return;
    delete el.dataset.settling;
    el.classList.remove("sweep-out");
  }
  const label = opts.label !== false;
  const max = opts.max || 10;
  const prevCount = Number(el.dataset.count || 0);
  const holder = el.closest(".bet-spot");

  if (!amount || amount <= 0) {
    el.innerHTML = "";
    el.dataset.count = "0";
    if (holder) holder.classList.remove("has-bet");
    return;
  }

  const chips = decomposeChips(amount, max);
  el.innerHTML =
    chips.map((c, i) => `<i class="stack-chip ${c}${i >= prevCount ? " drop" : ""}" style="--n:${i};--k:${Math.max(0, i - prevCount)}"></i>`).join("") +
    (label ? `<span class="stack-label">${shortMoney(amount)}</span>` : "");
  el.dataset.count = String(chips.length);
  if (holder) holder.classList.add("has-bet");
}

const FX = {
  layer: document.getElementById("fx-layer"),

  center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  },

  flyChip(fromEl, toEl, value, delay = 0) {
    if (Settings.reduceMotion || !this.layer || !this.visible(fromEl) || !this.visible(toEl)) return;
    const a = this.center(fromEl);
    const b = this.center(toEl);
    const [c, edge] = CHIP_COLORS[chipClassFor(value)];
    const chip = document.createElement("div");
    chip.className = "fly-chip";
    chip.style.setProperty("--chip-c", c);
    chip.style.setProperty("--chip-edge", edge);
    this.layer.appendChild(chip);

    const mx = (a.x + b.x) / 2;
    const my = Math.min(a.y, b.y) - 70;
    const anim = chip.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(1) rotate(0deg)` },
        { transform: `translate(${mx}px, ${my}px) scale(1.2) rotate(200deg)`, offset: 0.5 },
        { transform: `translate(${b.x}px, ${b.y}px) scale(0.8) rotate(360deg)` }
      ],
      { duration: T(560), delay, easing: "cubic-bezier(.45,.05,.35,1)", fill: "both" }
    );
    anim.onfinish = () => chip.remove();
    anim.oncancel = () => chip.remove();
  },

  burst(x, y, opts = {}) {
    if (!this.layer) return;
    const count = Quality.particles(opts.count || 18);
    const colors = opts.colors || ["#fff1c4", "#f0c96b", "#ff3d9a"];
    const speed = opts.speed || 160;
    const size = opts.size || 7;
    const gravity = opts.gravity == null ? 260 : opts.gravity;
    const life = opts.life || 800;

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "fx-particle";
      const s = size * rand(0.5, 1.3);
      p.style.width = s + "px";
      p.style.height = s + "px";
      p.style.background = colors[i % colors.length];
      p.style.boxShadow = `0 0 ${s * 1.6}px ${colors[i % colors.length]}`;
      if (opts.square) p.style.borderRadius = "2px";
      this.layer.appendChild(p);

      const ang = opts.angle != null ? opts.angle + rand(-opts.spread, opts.spread) : rand(0, Math.PI * 2);
      const v = speed * rand(0.4, 1.1);
      const dx = Math.cos(ang) * v;
      const dy = Math.sin(ang) * v;
      const tSec = life / 1000;
      const ex = x + dx * tSec;
      const ey = y + dy * tSec + 0.5 * gravity * tSec * tSec;
      const mx = x + dx * tSec * 0.5;
      const my = y + dy * tSec * 0.5 + 0.125 * gravity * tSec * tSec;

      const anim = p.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${mx}px, ${my}px) scale(0.9) rotate(${rand(-180, 180)}deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${ex}px, ${ey}px) scale(0.2) rotate(${rand(-360, 360)}deg)`, opacity: 0 }
        ],
        { duration: life * rand(0.75, 1.15), easing: "linear", fill: "forwards" }
      );
      anim.onfinish = () => p.remove();
    }
  },

  burstAt(el, opts) {
    if (!this.visible(el)) return;
    const c = this.center(el);
    this.burst(c.x, c.y, opts);
  },

  floatText(el, text, color = "#fff1c4") {
    if (!this.layer || !this.visible(el)) return;
    const c = this.center(el);
    const t = document.createElement("div");
    t.className = "fx-float-text";
    t.textContent = text;
    t.style.color = color;
    this.layer.appendChild(t);
    const anim = t.animate(
      [
        { transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
        { transform: `translate(${c.x}px, ${c.y - 24}px) translate(-50%, -50%) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${c.x}px, ${c.y - 70}px) translate(-50%, -50%) scale(1)`, opacity: 0 }
      ],
      { duration: T(1200), easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" }
    );
    anim.onfinish = () => t.remove();
  },

  clear() {
    if (this.layer) this.layer.innerHTML = "";
  }
};

/* Feedback táctil en botones: brillo radial desde el punto de contacto + clic. */
document.addEventListener("pointerdown", e => {
  const btn = e.target.closest(".btn, .chip, .quick-bet, .num-btn, .back-btn, .switch-pill, .filter-tab, .preset, .horse-option, .topbar-icon");
  if (!btn || btn.disabled) return;
  if (btn.classList.contains("btn")) {
    const r = btn.getBoundingClientRect();
    btn.style.setProperty("--px", ((e.clientX - r.left) / r.width) * 100 + "%");
    btn.style.setProperty("--py", ((e.clientY - r.top) / r.height) * 100 + "%");
  }
  if (!btn.classList.contains("chip") && !btn.classList.contains("num-btn") && !btn.classList.contains("quick-bet")) {
    Sound.play("click");
  }
});

function toast(text) {
  const stack = $("#toast-stack");
  if (!stack) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  stack.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

/* Animación de "ficha colocada" común: pop en la ficha + vuelo hasta el destino + sonido. */
function chipFeedback(chipEl, targetEl, value) {
  if (chipEl) {
    chipEl.classList.remove("chip-pop");
    void chipEl.offsetWidth;
    chipEl.classList.add("chip-pop");
  }
  Sound.play("chip");
  if (targetEl) FX.flyChip(chipEl, targetEl, value);
}

/* ============================================================
   6. ESTADÍSTICAS E HISTORIAL
   ============================================================ */
const GAME_META = {
  blackjack: { name: "Blackjack", screen: "blackjack-screen", glyph: "♠" },
  poker: { name: "Poker", screen: "poker-screen", glyph: "♦" },
  roulette: { name: "Ruleta", screen: "roulette-screen", glyph: "◉" },
  miner: { name: "Coin Miner", screen: "miner-screen", glyph: "◆" },
  chicken: { name: "Chicken Road", screen: "chicken-screen", glyph: "🐔" },
  plinko: { name: "Plinko", screen: "plinko-screen", glyph: "▾" },
  aviator: { name: "Aviator", screen: "aviator-screen", glyph: "✈" },
  horse: { name: "Carrera", screen: "horse-screen", glyph: "🏇" }
};

const SWITCH_ICONS = {
  blackjack: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="12" height="17" rx="2" fill="none" stroke="#34e89e" stroke-width="1.8"/><rect x="8" y="5" width="12" height="17" rx="2" fill="#0f2a20" stroke="#34e89e" stroke-width="1.8"/><path d="M14 10 q-3 3 0 5 q3 -2 0 -5z" fill="#34e89e"/></svg>',
  poker: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#ff4d6d" stroke-width="1.8" stroke-dasharray="3 2.2"/><path d="M12 7 l4 5 -4 5 -4 -5z" fill="#ff4d6d"/></svg>',
  roulette: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#f0c96b" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="#f0c96b"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="#f0c96b" stroke-width="1.6"/></svg>',
  miner: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" fill="#2de2e6" opacity=".4"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="#2de2e6" stroke-width="1.6"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="#2de2e6" stroke-width="1.6"/><circle cx="17" cy="17" r="3.6" fill="#f0c96b"/></svg>',
  chicken: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15" rx="6" ry="5.5" fill="#fff8ec"/><circle cx="13.5" cy="8.5" r="3.6" fill="#fff8ec"/><path d="M12 5 q1 -2.5 2 -.5 q1 -2 2 .5z" fill="#ff3b4e"/><path d="M17 8.5 l2.4 .8 -2.4 .8z" fill="#ffb21c"/></svg>',
  plinko: '<svg viewBox="0 0 24 24"><g fill="#c478ff"><circle cx="12" cy="5" r="1.6"/><circle cx="8.5" cy="10" r="1.6"/><circle cx="15.5" cy="10" r="1.6"/><circle cx="5" cy="15" r="1.6"/><circle cx="12" cy="15" r="1.6"/><circle cx="19" cy="15" r="1.6"/></g><rect x="3" y="18.5" width="18" height="3" rx="1.5" fill="#ff3d9a"/></svg>',
  aviator: '<svg viewBox="0 0 24 24"><path d="M3 20 C 10 19, 15 15, 21 5" fill="none" stroke="#ff3d5a" stroke-width="2" stroke-linecap="round"/><path d="M15 8 l6 -3 -2 6z" fill="#ffd2d9"/></svg>',
  horse: '<svg viewBox="0 0 24 24"><path d="M4 15 q1 -5 6 -5 l5 -1 q2 -4 5 -5 q1 2 -1 3 l-1 3 q-1 4 -4 5 h-6 q-3 0 -4 0z" fill="#78dc5a"/><path d="M7 16 l-2 4 M10 16 l1 4 M15 15 l3 4" stroke="#78dc5a" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

const Stats = {
  data: Store.get("stats", { games: {}, history: [] }),

  record(game, bet, payout, detail = "") {
    bet = round2(bet || 0);
    payout = round2(payout || 0);
    if (bet <= 0) return;

    const net = round2(payout - bet);
    const g = this.data.games[game] || (this.data.games[game] = { rounds: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, returned: 0, best: 0 });

    g.rounds++;
    if (net > 0) g.wins++;
    else if (net < 0) g.losses++;
    else g.pushes++;
    g.wagered = round2(g.wagered + bet);
    g.returned = round2(g.returned + payout);
    g.best = Math.max(g.best, net);

    this.data.history.unshift({ g: game, bet, payout, net, d: detail, t: Date.now() });
    if (this.data.history.length > 60) this.data.history.length = 60;

    this.save();
    updateHeroStats();
  },

  totals() {
    const all = { rounds: 0, wins: 0, wagered: 0, returned: 0, best: 0 };
    Object.values(this.data.games).forEach(g => {
      all.rounds += g.rounds;
      all.wins += g.wins;
      all.wagered += g.wagered;
      all.returned += g.returned;
      all.best = Math.max(all.best, g.best);
    });
    return all;
  },

  reset() {
    this.data = { games: {}, history: [] };
    this.save();
    updateHeroStats();
  },

  save() {
    Store.set("stats", this.data);
  }
};

function updateHeroStats() {
  const t = Stats.totals();
  const rounds = $("#hero-rounds");
  const best = $("#hero-best");
  if (rounds) rounds.textContent = String(t.rounds);
  if (best) best.textContent = formatMoney(t.best);
}

/* ============================================================
   7. NAVEGACIÓN Y LOBBY
   ============================================================ */
let currentScreen = "menu-screen";
const screenHooks = {};

function screenToGame(id) {
  const found = Object.entries(GAME_META).find(([, meta]) => meta.screen === id);
  return found ? found[0] : null;
}

function showScreen(id, opts = {}) {
  if (!document.getElementById(id)) id = "menu-screen";
  const prev = currentScreen;

  if (prev !== id && screenHooks[prev] && screenHooks[prev].hide) screenHooks[prev].hide();

  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });

  currentScreen = id;

  const game = screenToGame(id);
  if (game) {
    Store.set("lastGame", game);
    updateContinueButton();
  }

  if (!opts.fromHistory) {
    const hash = game ? "#" + game : "#lobby";
    if (location.hash !== hash) {
      try {
        history.pushState({ screen: id }, "", hash);
      } catch (e) { /* entornos sin history API */ }
    }
  }

  if (screenHooks[id] && screenHooks[id].show) {
    requestAnimationFrame(() => screenHooks[id].show());
  }

  if (id === "menu-screen") startHeroLoop();
  else Loop.remove("hero");

  window.scrollTo({ top: 0, behavior: Settings.reduceMotion ? "auto" : "smooth" });
}

window.addEventListener("popstate", () => {
  const key = location.hash.replace("#", "");
  const meta = GAME_META[key];
  showScreen(meta ? meta.screen : "menu-screen", { fromHistory: true });
});

document.querySelectorAll("[data-screen]").forEach(card => {
  card.addEventListener("click", e => {
    if (e.target.closest(".fav-btn")) return;
    showScreen(card.dataset.screen);
  });
  card.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target === card) {
      e.preventDefault();
      showScreen(card.dataset.screen);
    }
  });
});

document.querySelectorAll(".back-btn").forEach(button => {
  button.addEventListener("click", () => {
    showScreen("menu-screen");
  });
});

$("#brand-home").addEventListener("click", () => showScreen("menu-screen"));

/* --- Selector rápido de juegos dentro de cada pantalla --- */
function buildGameSwitchers() {
  $$(".game-switcher").forEach(nav => {
    const screen = nav.closest(".screen");
    const current = screen ? screen.dataset.game : null;
    nav.innerHTML = "";
    Object.entries(GAME_META).forEach(([key, meta]) => {
      const b = document.createElement("button");
      b.className = "switch-pill" + (key === current ? " current" : "");
      b.dataset.label = meta.name;
      b.setAttribute("aria-label", meta.name);
      b.innerHTML = SWITCH_ICONS[key];
      if (key === current) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => showScreen(meta.screen));
      nav.appendChild(b);
    });
  });
}

/* --- Favoritos, filtros y buscador --- */
const Lobby = {
  favorites: new Set(Store.get("favorites", [])),
  filter: "all",
  query: ""
};

function normalizeText(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function applyLobbyFilter() {
  const q = normalizeText(Lobby.query.trim());
  let visible = 0;

  $$(".menu-card").forEach((card, index) => {
    const game = card.dataset.game;
    const haystack = normalizeText(card.dataset.name + " " + card.dataset.tags + " " + card.dataset.cat);
    let show = !q || haystack.includes(q);

    if (Lobby.filter === "fav") show = show && Lobby.favorites.has(game);
    else if (Lobby.filter !== "all") show = show && card.dataset.cat === Lobby.filter;

    card.classList.toggle("hidden-by-filter", !show);
    if (show) {
      card.style.setProperty("--i", String(visible));
      visible++;
    }
    card.dataset.order = String(index);
  });

  const count = $("#lobby-count");
  if (count) count.textContent = visible + (visible === 1 ? " juego" : " juegos");
  const empty = $("#lobby-empty");
  if (empty) {
    empty.hidden = visible > 0;
    empty.textContent = Lobby.filter === "fav" && !q
      ? "Todavía no marcaste favoritos. Tocá la ★ de un juego para agregarlo."
      : "No hay juegos que coincidan con tu búsqueda.";
  }
}

function renderFavorites() {
  $$(".fav-btn").forEach(btn => {
    const on = Lobby.favorites.has(btn.dataset.fav);
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Quitar de favoritos" : "Agregar a favoritos";
  });
}

$$(".fav-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const id = btn.dataset.fav;
    if (Lobby.favorites.has(id)) {
      Lobby.favorites.delete(id);
      toast(GAME_META[id].name + " quitado de favoritos");
      Sound.play("deselect");
    } else {
      Lobby.favorites.add(id);
      toast("★ " + GAME_META[id].name + " agregado a favoritos");
      Sound.play("select");
    }
    Store.set("favorites", [...Lobby.favorites]);
    renderFavorites();
    applyLobbyFilter();
  });
});

$$(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    Lobby.filter = tab.dataset.filter;
    $$(".filter-tab").forEach(t => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", String(t === tab));
    });
    applyLobbyFilter();
  });
});

const searchInput = $("#game-search");
searchInput.addEventListener("input", () => {
  Lobby.query = searchInput.value;
  if (currentScreen !== "menu-screen") showScreen("menu-screen");
  applyLobbyFilter();
});
searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const first = $$(".menu-card").find(c => !c.classList.contains("hidden-by-filter"));
    if (first) {
      searchInput.blur();
      showScreen(first.dataset.screen);
    }
  }
  if (e.key === "Escape") {
    searchInput.value = "";
    Lobby.query = "";
    applyLobbyFilter();
    searchInput.blur();
  }
});

/* --- Inclinación 3D e iluminación que sigue al puntero --- */
$$(".menu-card").forEach(card => {
  card.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", px * 100 + "%");
    card.style.setProperty("--my", py * 100 + "%");
    if (Settings.tilt && !Settings.reduceMotion) {
      card.classList.add("tilting");
      card.style.setProperty("--rx", (0.5 - py) * 9 + "deg");
      card.style.setProperty("--ry", (px - 0.5) * 11 + "deg");
    }
  });
  card.addEventListener("pointerleave", () => {
    card.classList.remove("tilting");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
});

/* --- Seguir jugando --- */
function updateContinueButton() {
  const btn = $("#hero-continue");
  const last = Store.get("lastGame", null);
  if (!btn) return;
  if (last && GAME_META[last]) {
    btn.hidden = false;
    $("#hero-continue-name").textContent = GAME_META[last].name;
    btn.onclick = () => showScreen(GAME_META[last].screen);
  } else {
    btn.hidden = true;
  }
}

/* --- Partículas del hero (chispas doradas y neón) --- */
const Hero = { canvas: $("#hero-canvas"), parts: [], w: 0, h: 0 };

function startHeroLoop() {
  if (!Hero.canvas || !Quality.fancy()) {
    Loop.remove("hero");
    if (Hero.canvas) {
      const { ctx, w, h } = fitCanvas(Hero.canvas);
      ctx.clearRect(0, 0, w, h);
    }
    return;
  }
  Loop.add("hero", heroTick);
}

function heroTick(dt) {
  if (currentScreen !== "menu-screen" || document.hidden) return true;
  const { ctx, w, h } = fitCanvas(Hero.canvas);
  const target = Quality.particles(46);

  while (Hero.parts.length < target) {
    Hero.parts.push({
      x: rand(0, w),
      y: rand(0, h) + (Hero.parts.length > 10 ? h : 0),
      r: rand(0.6, 2.4),
      vy: rand(8, 26),
      vx: rand(-6, 6),
      hue: Math.random() < 0.7 ? "240,201,107" : "255,61,154",
      tw: rand(0, Math.PI * 2)
    });
  }
  if (Hero.parts.length > target) Hero.parts.length = target;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  Hero.parts.forEach(p => {
    p.y -= p.vy * dt;
    p.x += p.vx * dt;
    p.tw += dt * 2;
    if (p.y < -10) {
      p.y = h + 10;
      p.x = rand(0, w);
    }
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.tw));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
    g.addColorStop(0, `rgba(${p.hue},${a})`);
    g.addColorStop(1, `rgba(${p.hue},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = "source-over";
  return true;
}

/* --- Atajos de teclado --- */
const PRIMARY_ACTIONS = {
  "blackjack-screen": ["bj-deal", "bj-stand"],
  "poker-screen": ["pk-deal", "pk-draw"],
  "roulette-screen": ["rt-spin"],
  "miner-screen": ["cm-start", "cm-cashout"],
  "chicken-screen": ["cr-start", "cr-go"],
  "plinko-screen": ["pl-drop"],
  "aviator-screen": ["av-cashout", "av-start"],
  "horse-screen": ["hr-start"]
};

document.addEventListener("keydown", e => {
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  if (document.querySelector("dialog[open]")) return;

  if (e.key === "/" && !typing) {
    e.preventDefault();
    const bar = $(".casino-topbar");
    bar.classList.add("search-open");
    searchInput.focus();
    return;
  }

  if (e.key === "Escape" && !typing && currentScreen !== "menu-screen") {
    showScreen("menu-screen");
    return;
  }

  if (e.code === "Space" && !typing && tag !== "BUTTON") {
    const ids = PRIMARY_ACTIONS[currentScreen];
    if (!ids) return;
    const btn = ids.map(id => document.getElementById(id)).find(b => b && !b.disabled);
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
});

/* ============================================================
   8. MODALES
   ============================================================ */
function openModal(id) {
  const d = document.getElementById(id);
  if (!d) return;
  if (typeof d.showModal === "function") {
    if (!d.open) d.showModal();
  } else {
    d.setAttribute("open", "");
  }
}

function closeModal(d) {
  if (!d) return;
  if (typeof d.close === "function") d.close();
  else d.removeAttribute("open");
}

$$("dialog.modal").forEach(d => {
  d.addEventListener("click", e => {
    if (e.target === d) closeModal(d);
    if (e.target.closest("[data-close]")) closeModal(d);
  });
});

/* --- Configuración --- */
const setEls = {
  sound: $("#set-sound"),
  music: $("#set-music"),
  master: $("#set-master"),
  sfx: $("#set-sfx"),
  musicVol: $("#set-music-vol"),
  fast: $("#set-fast"),
  tilt: $("#set-tilt"),
  reduce: $("#set-reduce"),
  contrast: $("#set-contrast"),
  large: $("#set-large")
};

function syncSettingsUI() {
  setEls.sound.checked = !!Settings.sound;
  setEls.music.checked = !!Settings.music;
  setEls.master.value = Settings.master;
  setEls.sfx.value = Settings.sfx;
  setEls.musicVol.value = Settings.musicVol;
  setEls.fast.checked = !!Settings.fast;
  setEls.tilt.checked = !!Settings.tilt;
  setEls.reduce.checked = !!Settings.reduceMotion;
  setEls.contrast.checked = !!Settings.contrast;
  setEls.large.checked = !!Settings.largeText;
  $("#out-master").textContent = Settings.master + "%";
  $("#out-sfx").textContent = Settings.sfx + "%";
  $("#out-music").textContent = Settings.musicVol + "%";
  $$(".seg-btn[data-quality]").forEach(b => b.classList.toggle("active", b.dataset.quality === Settings.quality));
}

function setSetting(key, value) {
  Settings[key] = value;
  saveSettings();
  applySettings();
  syncSettingsUI();
}

function setSound(on) {
  setSetting("sound", on);
  if (!on) Sound.stopAllLoops();
}

function setMusic(on) {
  setSetting("music", on);
  if (on) Sound.musicOn();
  else Sound.musicOff();
}

setEls.sound.addEventListener("change", () => setSound(setEls.sound.checked));
setEls.music.addEventListener("change", () => setMusic(setEls.music.checked));
setEls.master.addEventListener("input", () => setSetting("master", Number(setEls.master.value)));
setEls.sfx.addEventListener("input", () => setSetting("sfx", Number(setEls.sfx.value)));
setEls.musicVol.addEventListener("input", () => setSetting("musicVol", Number(setEls.musicVol.value)));
setEls.fast.addEventListener("change", () => setSetting("fast", setEls.fast.checked));
setEls.tilt.addEventListener("change", () => setSetting("tilt", setEls.tilt.checked));
setEls.reduce.addEventListener("change", () => {
  setSetting("reduceMotion", setEls.reduce.checked);
  if (currentScreen === "menu-screen") startHeroLoop();
});
setEls.contrast.addEventListener("change", () => setSetting("contrast", setEls.contrast.checked));
setEls.large.addEventListener("change", () => setSetting("largeText", setEls.large.checked));

$$(".seg-btn[data-quality]").forEach(b => {
  b.addEventListener("click", () => {
    setSetting("quality", b.dataset.quality);
    if (currentScreen === "menu-screen") startHeroLoop();
    if (screenHooks[currentScreen] && screenHooks[currentScreen].show) screenHooks[currentScreen].show();
  });
});

$("#sound-test").addEventListener("click", () => {
  Sound.unlock();
  Sound.play("chip");
  later(() => Sound.play("card"), 160);
  later(() => Sound.play("coin"), 360);
});

$("#sound-toggle").addEventListener("click", () => setSound(!Settings.sound));
$("#music-toggle").addEventListener("click", () => setMusic(!Settings.music));

$$(".modal-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".modal-tab").forEach(t => t.classList.toggle("active", t === tab));
    $$(".modal-panel").forEach(p => p.classList.toggle("active", p.id === tab.dataset.tab));
    if (tab.dataset.tab === "tab-stats") renderStatsPanel();
    if (tab.dataset.tab === "tab-history") renderHistoryPanel();
  });
});

$("#settings-open").addEventListener("click", () => {
  syncSettingsUI();
  renderStatsPanel();
  renderHistoryPanel();
  openModal("settings-modal");
});

function signedMoney(v) {
  return (v > 0 ? "+" : v < 0 ? "−" : "") + formatMoney(Math.abs(v));
}

function renderStatsPanel() {
  const t = Stats.totals();
  const net = round2(t.returned - t.wagered);
  $("#stats-summary").innerHTML = `
    <div><span>Rondas</span><strong>${t.rounds}</strong></div>
    <div><span>Ganadas</span><strong>${t.wins}</strong></div>
    <div><span>Apostado</span><strong>${shortMoney(t.wagered)}</strong></div>
    <div><span>Neto</span><strong class="${net >= 0 ? "pos" : "neg"}">${signedMoney(net)}</strong></div>
  `;

  const rows = Object.entries(GAME_META).map(([key, meta]) => {
    const g = Stats.data.games[key];
    if (!g) return `<tr><td>${meta.name}</td><td>0</td><td>–</td><td>–</td><td>–</td></tr>`;
    const gnet = round2(g.returned - g.wagered);
    const rate = g.rounds ? Math.round((g.wins / g.rounds) * 100) + "%" : "–";
    return `<tr><td>${meta.name}</td><td>${g.rounds}</td><td>${rate}</td><td class="${gnet >= 0 ? "pos" : "neg"}">${signedMoney(gnet)}</td><td>${formatMoney(g.best)}</td></tr>`;
  });

  $("#stats-table").innerHTML = `<thead><tr><th>Juego</th><th>Rondas</th><th>Ganadas</th><th>Neto</th><th>Mejor</th></tr></thead><tbody>${rows.join("")}</tbody>`;
}

function renderHistoryPanel() {
  const list = $("#history-list");
  const h = Stats.data.history;
  if (!h.length) {
    list.innerHTML = '<li class="empty">Todavía no hay partidas registradas.</li>';
    return;
  }
  list.innerHTML = h.map(item => {
    const meta = GAME_META[item.g] || { name: item.g };
    const time = new Date(item.t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return `<li><div><b>${meta.name}</b><small>${item.d ? item.d + " · " : ""}${time}</small></div><small>Apuesta ${formatMoney(item.bet)}</small><span class="h-net ${item.net >= 0 ? "pos" : "neg"}">${signedMoney(item.net)}</span></li>`;
  }).join("");
}

$("#stats-reset").addEventListener("click", () => {
  Stats.reset();
  renderStatsPanel();
  renderHistoryPanel();
  toast("Estadísticas borradas");
});

/* --- Perfil --- */
const Profile = Object.assign({ name: "", avatar: "" }, Store.get("profile", {}));

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RN";
  return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || "")).toUpperCase();
}

function renderProfile() {
  const ini = initialsOf(Profile.name);
  $("#profile-initials").textContent = ini;
  $("#profile-big-initials").textContent = ini;
  const small = $("#profile-avatar");
  const big = $("#profile-big-img");
  [small, big].forEach(img => {
    if (Profile.avatar) {
      img.src = Profile.avatar;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  });
  $("#profile-btn").title = Profile.name ? "Perfil: " + Profile.name : "Perfil";
}

$("#profile-btn").addEventListener("click", () => {
  $("#profile-name").value = Profile.name;
  openModal("profile-modal");
});

$("#profile-name").addEventListener("input", e => {
  Profile.name = e.target.value.slice(0, 24);
  Store.set("profile", Profile);
  renderProfile();
});

$("#profile-file").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 160;
      const cx = c.getContext("2d");
      const s = Math.min(img.width, img.height);
      cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
      Profile.avatar = c.toDataURL("image/jpeg", 0.85);
      Store.set("profile", Profile);
      renderProfile();
      toast("Foto de perfil actualizada");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
});

$("#profile-photo-remove").addEventListener("click", () => {
  Profile.avatar = "";
  Store.set("profile", Profile);
  renderProfile();
});

/* ============================================================
   9. CARTAS
   ============================================================ */
const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  let deck = [];

  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({
        suit,
        rank,
        color: suit === "♥" || suit === "♦" ? "red" : "black"
      });
    }
  }

  return shuffle(deck);
}

function shuffle(array) {
  let arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    let random = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[random]] = [arr[random], arr[i]];
  }

  return arr;
}

/* Posiciones de pips (x%, y%) para cartas numéricas. */
const PIP_LAYOUTS = {
  2: [[50, 12], [50, 88, 1]],
  3: [[50, 12], [50, 50], [50, 88, 1]],
  4: [[25, 12], [75, 12], [25, 88, 1], [75, 88, 1]],
  5: [[25, 12], [75, 12], [50, 50], [25, 88, 1], [75, 88, 1]],
  6: [[25, 12], [75, 12], [25, 50], [75, 50], [25, 88, 1], [75, 88, 1]],
  7: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [25, 88, 1], [75, 88, 1]],
  8: [[25, 12], [75, 12], [50, 31], [25, 50], [75, 50], [50, 69, 1], [25, 88, 1], [75, 88, 1]],
  9: [[25, 10], [75, 10], [25, 37], [75, 37], [50, 50], [25, 63, 1], [75, 63, 1], [25, 90, 1], [75, 90, 1]],
  10: [[25, 10], [75, 10], [50, 24], [25, 37], [75, 37], [25, 63, 1], [75, 63, 1], [50, 76, 1], [25, 90, 1], [75, 90, 1]]
};

function cardFrontHTML(card) {
  const corner = `${card.rank}<small>${card.suit}</small>`;
  let center;

  if (card.rank === "A") {
    center = `<div class="center-suit"><span class="pip ace" style="--x:50%;--y:50%">${card.suit}</span></div>`;
  } else if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
    center = `<div class="face-art"><i class="t">${card.suit}</i><b>${card.rank}</b><i class="b">${card.suit}</i></div>`;
  } else {
    const layout = PIP_LAYOUTS[Number(card.rank)] || [];
    center = `<div class="center-suit">${layout.map(([x, y, f]) => `<span class="pip${f ? " flip" : ""}" style="--x:${x}%;--y:${y}%">${card.suit}</span>`).join("")}</div>`;
  }

  return `<div class="corner">${corner}</div>${center}<div class="corner bottom">${corner}</div>`;
}

/* Crea una carta 3D (frente + dorso). Las ocultas no llevan el frente en el DOM
   hasta que se revelan, así el valor no se puede espiar. */
function createCard(card, hidden = false) {
  let div = document.createElement("div");
  div.className = "card" + (card && card.color === "red" ? " red" : "") + (hidden ? " is-hidden" : "");
  div.innerHTML = `<div class="card-inner"><div class="card-face card-front">${hidden ? "" : cardFrontHTML(card)}</div><div class="card-face card-back"></div></div>`;
  div._card = card;
  div._hidden = hidden;
  return div;
}

function revealCardEl(el, card) {
  if (!el._hidden) return;
  el._hidden = false;
  el.querySelector(".card-front").innerHTML = cardFrontHTML(card);
  el.classList.toggle("red", card.color === "red");
  void el.offsetWidth;
  el.classList.remove("is-hidden", "back");
}

function hideCardEl(el) {
  if (el._hidden) return;
  el._hidden = true;
  el.classList.add("is-hidden");
}

/* Animación de reparto desde el mazo visible (FLIP con Web Animations). */
function animateDealFrom(el, shoeEl, opts = {}) {
  if (Settings.reduceMotion || !shoeEl || !FX.visible(shoeEl)) return;
  const from = shoeEl.getBoundingClientRect();
  const to = el.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const rot = opts.rotate != null ? opts.rotate : rand(-24, -10);
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0.72)`, opacity: 0.0 },
      { opacity: 1, offset: 0.12 },
      { transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 18}px) rotate(${rot * 0.1}deg) scale(1.04)`, offset: 0.8 },
      { transform: opts.endTransform || "none", opacity: 1 }
    ],
    { duration: T(opts.duration || 460), easing: "cubic-bezier(.2,.75,.25,1)" }
  );
  shoeEl.classList.remove("dealing");
  void shoeEl.offsetWidth;
  shoeEl.classList.add("dealing");
}

/* Sincroniza una mano con su contenedor de forma incremental:
   solo se crean (y animan) las cartas nuevas, y solo giran las que cambian de estado. */
function syncHand(container, cards, isHidden, opts = {}) {
  const children = Array.from(container.children).filter(c => c.classList.contains("card"));

  /* si la mano cambió de identidad (ronda nueva o reinicio), se reconstruye */
  const mismatch = children.some((el, i) => el._card !== cards[i]);
  if (mismatch || children.length > cards.length) {
    container.innerHTML = "";
    children.length = 0;
  }

  let dealt = 0;
  cards.forEach((card, i) => {
    const hidden = isHidden(i);
    let el = children[i];

    if (!el) {
      el = createCard(card, true);
      if (opts.decorate) opts.decorate(el, i);
      container.appendChild(el);
      if (opts.animate) {
        animateDealFrom(el, opts.shoe, { rotate: opts.rotate });
        dealt++;
        Sound.play("card");
        if (!hidden) {
          later(() => {
            if (el.isConnected) {
              revealCardEl(el, card);
              Sound.play("flip");
            }
          }, T(opts.flipDelay || 300));
        }
      } else if (!hidden) {
        revealCardEl(el, card);
      }
      return;
    }

    if (el._hidden && !hidden) {
      revealCardEl(el, card);
      if (opts.animate) Sound.play("flip");
    } else if (!el._hidden && hidden) {
      hideCardEl(el);
    }
  });

  return dealt;
}

/* Contador numérico animado para puntos y montos. */
function animateNumber(el, to, format = v => String(Math.round(v)), duration = 380) {
  if (!el) return;
  const from = Number(el.dataset.value || 0);
  el.dataset.value = String(to);
  if (from === to || Settings.reduceMotion) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const key = "num-" + (el.id || Math.random());
  Loop.add(key, (dt, now) => {
    const t = clamp((now - start) / duration, 0, 1);
    el.textContent = format(lerp(from, to, Ease.outCubic(t)));
    return t < 1;
  });
  const badge = el.closest(".score-badge");
  if (badge) {
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

function rankValue(rank) {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

/* Barrido de cartas al final de una ronda (las cartas viajan al descarte). */
async function sweepCards(containers) {
  const cards = containers.flatMap(c => Array.from(c.querySelectorAll(".card")));
  if (!cards.length) return;
  if (!Settings.reduceMotion) {
    cards.forEach((el, i) => {
      el.animate(
        [
          { transform: getComputedStyle(el).transform === "none" ? "none" : getComputedStyle(el).transform, opacity: 1 },
          { transform: `translate(${-160 - i * 6}px, -40px) rotate(-30deg) scale(0.7)`, opacity: 0 }
        ],
        { duration: T(380), delay: i * 30, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      );
    });
    Sound.play("whoosh");
    await sleep(T(380) + cards.length * 30);
  }
  containers.forEach(c => { c.innerHTML = ""; });
}

/* Liquidación visual de una pila de fichas: premio hacia el saldo o barrido hacia la banca. */
function settleStack(stackEl, won, payout, towardEl) {
  if (!stackEl) return;
  stackEl.dataset.settling = "1";
  if (won && payout > 0) {
    renderChipStack(stackEl, payout, { force: true });
    stackEl.dataset.settling = "1";
    later(() => {
      if (stackEl.dataset.settling !== "1") return;
      FX.flyChip(stackEl, walletEl, payout);
      FX.flyChip(stackEl, walletEl, payout, 90);
      FX.flyChip(stackEl, walletEl, payout, 180);
      Sound.play("chipsCollect");
      delete stackEl.dataset.settling;
      renderChipStack(stackEl, 0, { force: true });
    }, T(900));
  } else {
    if (towardEl) FX.flyChip(stackEl, towardEl, 100);
    stackEl.classList.add("sweep-out");
    later(() => {
      if (stackEl.dataset.settling !== "1") return;
      stackEl.classList.remove("sweep-out");
      delete stackEl.dataset.settling;
      renderChipStack(stackEl, 0, { force: true });
    }, T(650));
  }
}

/* ============================================================
   10. BLACKJACK
   ============================================================ */
const bj = {
  deck: [],
  dealer: [],
  player: [],
  bet: 0,
  active: false,
  hidden: true,
  animating: false,
  doubled: false
};

const bjEls = {
  message: document.getElementById("bj-message"),
  bet: document.getElementById("bj-bet"),
  dealerCards: document.getElementById("bj-dealer-cards"),
  playerCards: document.getElementById("bj-player-cards"),
  dealerScore: document.getElementById("bj-dealer-score"),
  playerScore: document.getElementById("bj-player-score"),
  chips: document.querySelectorAll(".bj-chip"),
  clear: document.getElementById("bj-clear"),
  deal: document.getElementById("bj-deal"),
  hit: document.getElementById("bj-hit"),
  stand: document.getElementById("bj-stand"),
  double: document.getElementById("bj-double"),
  shoe: document.getElementById("bj-shoe"),
  table: document.getElementById("bj-table"),
  stack: document.getElementById("bj-stack"),
  betSpot: document.getElementById("bj-bet-spot")
};

function bjValue(rank) {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

function bjScore(hand) {
  let total = 0;
  let aces = 0;

  for (let card of hand) {
    total += bjValue(card.rank);
    if (card.rank === "A") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && bjScore(hand) === 21;
}

function bjUpdateScores() {
  let dealerScore = 0;
  if (bj.dealer.length > 0) {
    dealerScore = bj.hidden ? bjValue(bj.dealer[0].rank) : bjScore(bj.dealer);
  }
  const playerScore = bjScore(bj.player);

  animateNumber(bjEls.dealerScore, dealerScore);
  animateNumber(bjEls.playerScore, playerScore);

  const pBadge = bjEls.playerScore.closest(".score-badge");
  const dBadge = bjEls.dealerScore.closest(".score-badge");
  pBadge.classList.toggle("is-bust", playerScore > 21);
  pBadge.classList.toggle("is-21", playerScore === 21);
  dBadge.classList.toggle("is-bust", !bj.hidden && dealerScore > 21);
  dBadge.classList.toggle("is-21", !bj.hidden && dealerScore === 21 && bj.dealer.length > 0);
}

function renderBlackjack(animate = false) {
  syncHand(bjEls.dealerCards, bj.dealer, index => bj.hidden && index === 1, { animate, shoe: bjEls.shoe });
  syncHand(bjEls.playerCards, bj.player, () => false, {
    animate,
    shoe: bjEls.shoe,
    decorate: (el, index) => {
      if (bj.doubled && index === 2) el.classList.add("doubled");
    }
  });

  if (!animate) bjUpdateScores();

  bjEls.bet.textContent = formatMoney(bj.bet);
  if (bj.bet > 0) renderChipStack(bjEls.stack, bj.bet);
  else if (!bj.active) renderChipStack(bjEls.stack, 0);
}

function updateBlackjackButtons() {
  const busy = bj.active || bj.animating;

  bjEls.chips.forEach(chip => {
    let value = chipAmount(chip);
    chip.disabled = busy || value <= 0 || balance < value;
  });

  bjEls.clear.disabled = busy || bj.bet === 0;
  bjEls.deal.disabled = busy || bj.bet === 0;
  bjEls.hit.disabled = !bj.active || bj.animating;
  bjEls.stand.disabled = !bj.active || bj.animating;
  bjEls.double.disabled = !bj.active || bj.animating || bj.player.length !== 2 || balance < bj.bet;
}

function bjPlaceChip(value, chipEl) {
  if (bj.active || bj.animating || value <= 0 || balance < value) return;

  balance -= value;
  bj.bet = round2(bj.bet + value);

  chipFeedback(chipEl, bjEls.betSpot, value);
  updateBalance();
  renderChipStack(bjEls.stack, bj.bet, { force: true });
  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Apostaste " + formatMoney(bj.bet) + ". Ya podés repartir.");
}

function bjClearBet() {
  if (bj.active || bj.animating) return;

  balance += bj.bet;
  if (bj.bet > 0) FX.flyChip(bjEls.betSpot, walletEl, bj.bet);
  bj.bet = 0;

  updateBalance();
  renderChipStack(bjEls.stack, 0, { force: true });
  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Apuesta limpiada.");
}

/* Reparte una carta con animación y actualiza los puntos cuando aterriza. */
async function bjDealCard(target) {
  const card = bj.deck.pop();
  bj[target].push(card);
  renderBlackjack(true);
  await sleep(T(340));
  bjUpdateScores();
  await sleep(T(160));
}

async function bjDeal() {
  if (bj.bet <= 0 || bj.active || bj.animating) return;

  bj.animating = true;
  bj.active = true;
  bj.doubled = false;
  updateBlackjackButtons();
  bjEls.table.classList.remove("dealer-turn");
  setMessage(bjEls.message, "Repartiendo cartas…");

  await sweepCards([bjEls.dealerCards, bjEls.playerCards]);

  bj.deck = createDeck();
  bj.dealer = [];
  bj.player = [];
  bj.hidden = true;
  renderBlackjack();

  await bjDealCard("player");
  await bjDealCard("dealer");
  await bjDealCard("player");
  await bjDealCard("dealer");

  bj.animating = false;
  updateBlackjackButtons();

  let playerBJ = isBlackjack(bj.player);
  let dealerBJ = isBlackjack(bj.dealer);

  if (playerBJ && dealerBJ) {
    bjFinish("push");
  } else if (playerBJ) {
    bjFinish("blackjack");
  } else if (dealerBJ) {
    bjFinish("dealerWin");
  } else {
    setMessage(bjEls.message, "Tu turno: pedí carta, plantate o doblá.");
  }
}

async function bjHit() {
  if (!bj.active || bj.animating) return;

  bj.animating = true;
  updateBlackjackButtons();

  await bjDealCard("player");

  bj.animating = false;

  const score = bjScore(bj.player);
  if (score > 21) {
    bjEls.playerCards.lastElementChild && bjEls.playerCards.lastElementChild.classList.add("bust-card");
    bjFinish("playerBust");
  } else if (score === 21) {
    setMessage(bjEls.message, "¡21! Te conviene plantarte.", "push");
  } else {
    setMessage(bjEls.message, "Podés pedir otra o plantarte.");
  }

  updateBlackjackButtons();
}

/* Turno del dealer: revela la carta oculta y pide hasta 17 con animación. */
async function bjDealerPlay() {
  bj.animating = true;
  updateBlackjackButtons();
  bjEls.table.classList.add("dealer-turn");

  bj.hidden = false;
  renderBlackjack(true);
  Sound.play("flip");
  setMessage(bjEls.message, "El dealer da vuelta su carta…");
  await sleep(T(650));
  bjUpdateScores();

  while (bjScore(bj.dealer) < 17) {
    await sleep(T(320));
    setMessage(bjEls.message, "El dealer pide carta (" + bjScore(bj.dealer) + ").");
    await bjDealCard("dealer");
  }

  await sleep(T(250));
  bj.animating = false;

  let dealerScore = bjScore(bj.dealer);
  let playerScore = bjScore(bj.player);

  if (dealerScore > 21) {
    bjFinish("dealerBust");
  } else if (playerScore > dealerScore) {
    bjFinish("playerWin");
  } else if (playerScore < dealerScore) {
    bjFinish("dealerWin");
  } else {
    bjFinish("push");
  }
}

function bjStand() {
  if (!bj.active || bj.animating) return;
  setMessage(bjEls.message, "Te plantaste con " + bjScore(bj.player) + ".");
  bjDealerPlay();
}

async function bjDouble() {
  if (!bj.active || bj.animating || bj.player.length !== 2 || balance < bj.bet) return;

  balance -= bj.bet;
  chipFeedback(bjEls.double, bjEls.betSpot, bj.bet);
  bj.bet = round2(bj.bet * 2);
  bj.doubled = true;

  updateBalance();
  renderChipStack(bjEls.stack, bj.bet, { force: true });
  bjEls.bet.textContent = formatMoney(bj.bet);
  setMessage(bjEls.message, "Doblaste: una sola carta más.");

  bj.animating = true;
  updateBlackjackButtons();
  await bjDealCard("player");
  bj.animating = false;

  if (bjScore(bj.player) > 21) {
    bjFinish("playerBust");
  } else {
    bjDealerPlay();
  }
}

async function bjFinish(result) {
  bj.active = false;
  bj.animating = true;
  updateBlackjackButtons();

  if (bj.hidden) {
    bj.hidden = false;
    renderBlackjack(true);
    Sound.play("flip");
    await sleep(T(600));
  }
  bjUpdateScores();
  bjEls.table.classList.remove("dealer-turn");

  const betPlaced = bj.bet;
  let payout = 0;

  if (result === "blackjack") {
    let pay = Math.floor(bj.bet * 2.5);
    let profit = pay - bj.bet;
    payout = pay;
    balance += pay;
    setMessage(bjEls.message, "¡Blackjack! Ganaste $" + profit, "win");
    later(() => showWinAnimation("¡BLACKJACK!", profit, "bigwin"), 1000);
  }

  if (result === "playerWin") {
    let pay = bj.bet * 2;
    let profit = bj.bet;
    payout = pay;
    balance += pay;
    setMessage(bjEls.message, "Ganaste. Cobrás " + formatMoney(pay), "win");
    const wType  = profit >= 300 ? "bigwin" : "win";
    const wTitle = profit >= 300 ? "BIG WIN" : "WIN";
    later(() => showWinAnimation(wTitle, Math.round(profit), wType), 1000);
  }

  if (result === "dealerBust") {
    let pay = bj.bet * 2;
    let profit = bj.bet;
    payout = pay;
    balance += pay;
    setMessage(bjEls.message, "El dealer se pasó. Ganaste " + formatMoney(pay), "win");
    const wType  = profit >= 300 ? "bigwin" : "win";
    const wTitle = profit >= 300 ? "BIG WIN" : "WIN";
    later(() => showWinAnimation(wTitle, Math.round(profit), wType), 1000);
  }

  if (result === "push") {
    payout = bj.bet;
    balance += bj.bet;
    setMessage(bjEls.message, "Empate. Recuperás tu apuesta.", "push");
  }

  if (result === "playerBust") {
    let lost = bj.bet;
    setMessage(bjEls.message, "Te pasaste de 21. Perdiste.", "lose");
    later(() => showWinAnimation("GAME OVER", Math.round(lost), "lose"), 1000);
  }

  if (result === "dealerWin") {
    let lost = bj.bet;
    setMessage(bjEls.message, "Gana el dealer. Perdiste.", "lose");
    later(() => showWinAnimation("GAME OVER", Math.round(lost), "lose"), 1000);
  }

  const labels = {
    blackjack: "Blackjack natural",
    playerWin: "Mano ganadora",
    dealerBust: "Dealer pasado",
    push: "Empate",
    playerBust: "Te pasaste",
    dealerWin: "Ganó el dealer"
  };
  Stats.record("blackjack", betPlaced, payout, labels[result] + " · " + bjScore(bj.player) + " vs " + bjScore(bj.dealer));

  if (payout > betPlaced) Sound.play("cash");
  else if (payout === 0) Sound.play("thud");

  settleStack(bjEls.stack, payout > 0, payout, bjEls.dealerCards);

  bj.bet = 0;
  bj.animating = false;

  updateBalance();
  renderBlackjack();
  updateBlackjackButtons();
}

function bjReset() {
  bj.deck = [];
  bj.dealer = [];
  bj.player = [];
  bj.bet = 0;
  bj.active = false;
  bj.hidden = true;
  bj.animating = false;
  bj.doubled = false;
  bjEls.table.classList.remove("dealer-turn");
  renderChipStack(bjEls.stack, 0, { force: true });
  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Elegí fichas y tocá Repartir.");
}

bjEls.chips.forEach(chip => {
  chip.addEventListener("click", () => bjPlaceChip(chipAmount(chip), chip));
});

bjEls.clear.addEventListener("click", bjClearBet);
bjEls.deal.addEventListener("click", bjDeal);
bjEls.hit.addEventListener("click", bjHit);
bjEls.stand.addEventListener("click", bjStand);
bjEls.double.addEventListener("click", bjDouble);

/* ============================================================
   11. POKER TEXAS HOLD'EM
   ============================================================ */
const pk = {
  deck: [],
  dealer: [],
  player: [],
  community: [],
  revealedCommunity: 0,

  bet: 0,
  dealerBet: 0,
  pot: 0,

  pendingRaise: 0,
  waitingPlayerCall: 0,

  phase: "betting",
  revealDealer: false,
  selected: new Set(),
  animating: false
};

const pkEls = {
  message: document.getElementById("pk-message"),
  bet: document.getElementById("pk-bet"),
  dealerBet: document.getElementById("pk-dealer-bet"),
  pot: document.getElementById("pk-pot"),
  stage: document.getElementById("pk-stage"),
  dealerCards: document.getElementById("pk-dealer-cards"),
  playerCards: document.getElementById("pk-player-cards"),
  communityCards: document.getElementById("pk-community-cards"),
  dealerName: document.getElementById("pk-dealer-name"),
  playerName: document.getElementById("pk-player-name"),
  chips: document.querySelectorAll(".pk-chip"),
  clear: document.getElementById("pk-clear"),
  deal: document.getElementById("pk-deal"),
  draw: document.getElementById("pk-draw"),
  stand: document.getElementById("pk-stand"),
  shoe: document.getElementById("pk-shoe"),
  pending: document.getElementById("pk-pending"),
  pendingPill: document.querySelector(".pk-raise-pill"),
  potStack: document.getElementById("pk-pot-stack"),
  potZone: document.getElementById("pk-pot-zone"),
  potLabel: document.getElementById("pk-pot-label"),
  dealerStack: document.getElementById("pk-dealer-stack"),
  playerStack: document.getElementById("pk-player-stack"),
  streets: document.getElementById("pk-streets"),
  seatDealer: document.getElementById("pk-seat-dealer"),
  seatPlayer: document.getElementById("pk-seat-player"),
  dealerAction: document.getElementById("pk-dealer-action")
};

function resetPokerVisual() {
  pk.deck = [];
  pk.dealer = [];
  pk.player = [];
  pk.community = [];
  pk.revealedCommunity = 0;
  pk.pot = 0;
  pk.dealerBet = 0;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.revealDealer = false;
  pk.selected.clear();

  pkEls.dealerName.textContent = "Cartas ocultas";
  pkEls.playerName.textContent = "Tus cartas";
  $$(".hand-ranks li").forEach(li => li.classList.remove("active-rank"));
}

function pokerStageName() {
  if (pk.phase === "betting") return "Esperando apuesta";
  if (pk.waitingPlayerCall > 0) return "Dealer subió";
  if (pk.phase === "showdown") return "Final";
  if (pk.revealedCommunity === 3) return "Flop";
  if (pk.revealedCommunity === 4) return "Turn";
  if (pk.revealedCommunity === 5) return "River";
  return "En juego";
}

function pokerStreetKey() {
  if (pk.phase === "showdown" || (pk.phase === "betting" && pk.revealDealer && pk.player.length)) return "showdown";
  if (pk.phase !== "action") return null;
  if (pk.revealedCommunity >= 5) return "river";
  if (pk.revealedCommunity === 4) return "turn";
  if (pk.revealedCommunity === 3) return "flop";
  return "preflop";
}

function renderPokerStreets() {
  const order = ["preflop", "flop", "turn", "river", "showdown"];
  const current = pokerStreetKey();
  const ci = order.indexOf(current);
  $$("span", pkEls.streets).forEach(span => {
    const i = order.indexOf(span.dataset.street);
    span.classList.toggle("current", i === ci);
    span.classList.toggle("done", ci > -1 && i < ci);
  });
}

function renderPoker(animate = false) {
  syncHand(pkEls.dealerCards, pk.dealer, () => !pk.revealDealer, { animate, shoe: pkEls.shoe });
  syncHand(pkEls.playerCards, pk.player, () => false, { animate, shoe: pkEls.shoe });
  syncHand(pkEls.communityCards, pk.community, index => index >= pk.revealedCommunity, { animate, shoe: pkEls.shoe, rotate: -6, flipDelay: 260 });

  pkEls.bet.textContent = pokerMoney(pk.bet);
  pkEls.dealerBet.textContent = pokerMoney(pk.dealerBet);
  pkEls.pot.textContent = pokerMoney(pk.pot);
  pkEls.potLabel.textContent = pokerMoney(pk.pot);
  pkEls.stage.textContent = pokerStageName();
  pkEls.pending.textContent = pokerMoney(pk.pendingRaise);
  pkEls.pendingPill.classList.toggle("active", pk.pendingRaise > 0);

  renderChipStack(pkEls.potStack, pk.pot, { label: false, max: 12 });
  renderChipStack(pkEls.playerStack, pk.phase === "betting" ? pk.bet : pk.pendingRaise);
  renderChipStack(pkEls.dealerStack, pk.waitingPlayerCall);
  renderPokerStreets();
}

function pkSetTurn(who) {
  pkEls.seatDealer.classList.toggle("is-turn", who === "dealer");
  pkEls.seatPlayer.classList.toggle("is-turn", who === "player");
  pkEls.seatDealer.classList.toggle("thinking", who === "dealer");
}

function pkBubble(text, cls = "") {
  const b = pkEls.dealerAction;
  b.textContent = text;
  b.className = "action-bubble";
  void b.offsetWidth;
  b.className = "action-bubble show " + cls;
}

function pkPotBump() {
  pkEls.potZone.classList.remove("bump");
  void pkEls.potZone.offsetWidth;
  pkEls.potZone.classList.add("bump");
}

function updatePokerButtons() {
  let betting = pk.phase === "betting";
  let action = pk.phase === "action";
  const busy = pk.animating;

  pkEls.chips.forEach(chip => {
    let value = chipAmount(chip);
    chip.disabled = busy || !(betting || action) || pk.waitingPlayerCall > 0 || value <= 0 || balance < value;
  });

  pkEls.clear.disabled = busy || (betting ? pk.bet === 0 : pk.pendingRaise === 0 || pk.waitingPlayerCall > 0);
  pkEls.deal.disabled = busy || !betting || pk.bet === 0;
  pkEls.draw.disabled = busy || !action;
  pkEls.stand.disabled = busy || !action;

  pkEls.clear.textContent = action ? "Deshacer subida" : "Limpiar";

  if (pk.waitingPlayerCall > 0) {
    pkEls.draw.textContent = "Pagar subida " + pokerMoney(pk.waitingPlayerCall);
  } else {
    pkEls.draw.textContent = pk.pendingRaise > 0 ? "Confirmar apuesta" : "Pasar / seguir";
  }

  pkEls.stand.textContent = "Retirarse";
}

function pkPlaceChip(value, chipEl) {
  if (pk.animating || value <= 0 || balance < value) return;

  if (pk.phase === "betting") {
    if (pk.bet === 0 && pk.player.length > 0) {
      resetPokerVisual();
    }

    balance -= value;
    pk.bet = round2(pk.bet + value);

    chipFeedback(chipEl, pkEls.playerStack.isConnected && FX.visible(pkEls.playerStack) ? pkEls.playerStack : pkEls.potZone, value);
    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Apostaste " + pokerMoney(pk.bet) + ". Ya podés repartir.");
    return;
  }

  if (pk.phase === "action") {
    if (pk.waitingPlayerCall > 0) {
      setMessage(pkEls.message, "Primero tenés que pagar la subida del dealer o retirarte.", "push");
      return;
    }

    balance -= value;
    pk.bet = round2(pk.bet + value);
    pk.pendingRaise = round2(pk.pendingRaise + value);
    pk.pot = round2(pk.pot + value);

    chipFeedback(chipEl, FX.visible(pkEls.playerStack) ? pkEls.playerStack : pkEls.potZone, value);
    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(
      pkEls.message,
      "Subiste " + pokerMoney(pk.pendingRaise) + ". Ahora confirmá la apuesta."
    );
  }
}

function pkClearBet() {
  if (pk.animating) return;

  if (pk.phase === "betting") {
    balance += pk.bet;
    pk.bet = 0;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Apuesta limpiada.");
    return;
  }

  if (pk.phase === "action" && pk.pendingRaise > 0 && pk.waitingPlayerCall === 0) {
    balance += pk.pendingRaise;
    pk.bet = round2(pk.bet - pk.pendingRaise);
    pk.pot = round2(pk.pot - pk.pendingRaise);
    pk.pendingRaise = 0;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Subida cancelada.");
  }
}

async function pkDeal() {
  if (pk.bet <= 0 || pk.phase !== "betting" || pk.animating) return;

  pk.animating = true;
  updatePokerButtons();
  setMessage(pkEls.message, "Repartiendo cartas…");

  await sweepCards([pkEls.dealerCards, pkEls.playerCards, pkEls.communityCards]);

  const deck = createDeck();
  pk.deck = deck;
  pk.player = [];
  pk.dealer = [];
  pk.community = [];

  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.revealDealer = false;
  pk.revealedCommunity = 0;
  pk.phase = "action";
  $$(".hand-ranks li").forEach(li => li.classList.remove("active-rank"));

  pkEls.playerName.textContent = "Tus cartas";
  pkEls.dealerName.textContent = "Cartas ocultas";

  const playerCards = [deck.pop(), deck.pop()];
  const dealerCards = [deck.pop(), deck.pop()];
  const communityCards = [];
  for (let i = 0; i < 5; i++) {
    communityCards.push(deck.pop());
  }

  pk.dealerBet = pk.bet;
  pk.pot = pk.bet + pk.dealerBet;
  renderPoker();

  /* reparto alternado: jugador, dealer, jugador, dealer */
  for (let i = 0; i < 2; i++) {
    pk.player.push(playerCards[i]);
    renderPoker(true);
    await sleep(T(260));
    pk.dealer.push(dealerCards[i]);
    renderPoker(true);
    await sleep(T(260));
  }

  pkBubble("Igualo " + pokerMoney(pk.dealerBet));
  FX.flyChip(pkEls.seatDealer, pkEls.potZone, pk.dealerBet);
  Sound.play("chip");
  pkPotBump();
  await sleep(T(420));

  /* cartas comunitarias boca abajo y luego el flop, una por una */
  for (let i = 0; i < 5; i++) {
    pk.community.push(communityCards[i]);
    renderPoker(true);
    await sleep(T(150));
  }
  await sleep(T(320));

  for (let i = 1; i <= 3; i++) {
    pk.revealedCommunity = i;
    renderPoker(true);
    Sound.play("flip");
    await sleep(T(260));
  }

  pk.revealedCommunity = 3;
  pk.animating = false;
  renderPoker();
  updatePokerButtons();
  pkSetTurn("player");

  setMessage(
    pkEls.message,
    "El dealer igualó tu apuesta inicial con " + pokerMoney(pk.dealerBet) + ". Se mostró el flop."
  );
}

async function pkProceed() {
  if (pk.phase !== "action" || pk.animating) return;

  if (pk.waitingPlayerCall > 0) {
    if (balance < pk.waitingPlayerCall) {
      setMessage(pkEls.message, "No tenés saldo para pagar la subida. Podés retirarte.", "lose");
      return;
    }

    pk.animating = true;

    balance -= pk.waitingPlayerCall;
    pk.bet = round2(pk.bet + pk.waitingPlayerCall);
    pk.pot = round2(pk.pot + pk.waitingPlayerCall);

    let paid = pk.waitingPlayerCall;

    FX.flyChip(pkEls.draw, pkEls.potZone, paid);
    FX.flyChip(FX.visible(pkEls.dealerStack) ? pkEls.dealerStack : pkEls.seatDealer, pkEls.potZone, paid, 80);
    Sound.play("chip");

    pk.waitingPlayerCall = 0;

    updateBalance();
    renderPoker();
    updatePokerButtons();
    pkPotBump();

    setMessage(pkEls.message, "Pagaste la subida de " + pokerMoney(paid) + ".", "push");

    await sleep(T(650));
    advancePokerStreet();
    return;
  }

  pk.animating = true;
  updatePokerButtons();
  pkSetTurn("dealer");
  setMessage(pkEls.message, pk.pendingRaise > 0 ? "Subiste " + pokerMoney(pk.pendingRaise) + ". El dealer piensa…" : "Pasaste. El dealer piensa…");
  await sleep(T(650 + Math.random() * 550));

  let dealerAction = dealerPokerAction();

  if (dealerAction.type === "fold") {
    pkBubble("Me retiro", "fold");
    Sound.play("thud");
    await sleep(T(700));
    pkWinByDealerFold();
    return;
  }

  if (dealerAction.type === "call") {
    pk.dealerBet = round2(pk.dealerBet + pk.pendingRaise);
    pk.pot = round2(pk.pot + pk.pendingRaise);

    if (pk.pendingRaise > 0) {
      pkBubble("Pago " + pokerMoney(pk.pendingRaise));
      FX.flyChip(FX.visible(pkEls.playerStack) ? pkEls.playerStack : pkEls.seatPlayer, pkEls.potZone, pk.pendingRaise);
      FX.flyChip(pkEls.seatDealer, pkEls.potZone, pk.pendingRaise, 100);
      Sound.play("chip");
      pkPotBump();
      setMessage(
        pkEls.message,
        "El dealer pagó tu subida de " + pokerMoney(pk.pendingRaise) + ".",
        "push"
      );
    } else {
      pkBubble("Paso");
      Sound.play("tick", 2);
      setMessage(pkEls.message, "El dealer pasó.");
    }

    pk.pendingRaise = 0;
    renderPoker();
    await sleep(T(700));
    advancePokerStreet();
    return;
  }

  if (dealerAction.type === "raise") {
    let dealerCall = pk.pendingRaise;
    let dealerRaise = dealerAction.amount;

    pk.dealerBet = round2(pk.dealerBet + dealerCall + dealerRaise);
    pk.pot = round2(pk.pot + dealerCall + dealerRaise);

    if (dealerCall > 0) FX.flyChip(FX.visible(pkEls.playerStack) ? pkEls.playerStack : pkEls.seatPlayer, pkEls.potZone, dealerCall);
    FX.flyChip(pkEls.seatDealer, FX.visible(pkEls.dealerStack) ? pkEls.dealerStack : pkEls.potZone, dealerRaise, 100);
    Sound.play("chip");
    pkBubble("Subo " + pokerMoney(dealerRaise), "raise");

    pk.pendingRaise = 0;
    pk.waitingPlayerCall = dealerRaise;
    pk.animating = false;

    renderPoker();
    updatePokerButtons();
    pkPotBump();
    pkSetTurn("player");

    setMessage(
      pkEls.message,
      "El dealer pagó y además subió " + pokerMoney(dealerRaise) + ". Pagá o retirate.",
      "push"
    );
    return;
  }

  pk.animating = false;
  updatePokerButtons();
}

async function advancePokerStreet() {
  pk.pendingRaise = 0;

  if (pk.revealedCommunity < 5) {
    pk.animating = true;
    pk.revealedCommunity++;

    renderPoker(true);
    Sound.play("flip");
    updatePokerButtons();
    await sleep(T(560));

    pk.animating = false;
    pkSetTurn("player");
    renderPoker();
    updatePokerButtons();

    if (pk.revealedCommunity === 4) {
      setMessage(pkEls.message, "Se mostró el turn. Podés apostar más o pasar.");
    } else {
      setMessage(pkEls.message, "Se mostró el river. Última decisión antes de mostrar cartas.");
    }

    return;
  }

  finishPokerRound();
}

function pkFold() {
  if (pk.phase !== "action" || pk.animating) return;

  let pkLost = pk.bet; // capturar antes del reset

  FX.flyChip(pkEls.potZone, pkEls.seatDealer, pk.pot);
  Sound.play("thud");

  pk.phase = "betting";
  pk.revealDealer = true;

  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;

  renderPoker(true);
  updatePokerButtons();
  pkSetTurn(null);

  Stats.record("poker", pkLost, 0, "Te retiraste");

  setMessage(pkEls.message, "Te retiraste. Gana el dealer.", "lose");
  later(() => showWinAnimation("GAME OVER", Math.round(pkLost), "lose"), 1000);
}

function dealerPokerAction() {
  let visibleCards = [...pk.dealer, ...pk.community.slice(0, pk.revealedCommunity)];
  let dealerHand = evaluateBestHand(visibleCards);
  let handPower = dealerHand.rank;
  let random = Math.random();

  let possibleRaise = dealerRaiseAmount();

  if (pk.pendingRaise > 0) {
    if (handPower <= 1 && pk.pendingRaise >= 100 && random < 0.65) {
      return { type: "fold" };
    }

    if (handPower <= 2 && pk.pendingRaise >= 200 && random < 0.45) {
      return { type: "fold" };
    }

    if (handPower >= 4 && possibleRaise > 0 && random < 0.25) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }

    return { type: "call" };
  }

  if (possibleRaise > 0) {
    if (handPower >= 4 && random < 0.55) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }

    if (handPower >= 2 && random < 0.22) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }
  }

  return { type: "call" };
}

function dealerRaiseAmount() {
  let options = [25, 50, 100, 500].filter(value => value <= balance);

  if (options.length === 0) return 0;

  if (pk.revealedCommunity === 3) {
    return options.includes(50) ? 50 : options[0];
  }

  if (pk.revealedCommunity === 4) {
    return options.includes(100) ? 100 : options[options.length - 1];
  }

  return options[options.length - 1];
}

function pkWinByDealerFold() {
  pk.phase = "betting";
  pk.revealDealer = true;

  pkEls.dealerName.textContent = "Se retiró";
  pkEls.playerName.textContent = "Ganaste por fold";

  let winAmount = pk.pot;
  let pkProfit  = pk.pot - pk.bet; // capturamos antes del reset
  let pkBetPlaced = pk.bet;

  balance += pk.pot;

  FX.flyChip(pkEls.potZone, walletEl, winAmount);
  FX.flyChip(pkEls.potZone, walletEl, winAmount, 120);
  Sound.play("cash");

  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.animating = false;

  updateBalance();
  renderPoker(true);
  updatePokerButtons();
  pkSetTurn(null);

  Stats.record("poker", pkBetPlaced, winAmount, "El dealer se retiró");

  setMessage(pkEls.message, "El dealer se retiró. Ganaste " + pokerMoney(winAmount) + ".", "win");

  const pkWType  = pkProfit >= 300 ? "bigwin" : "win";
  const pkWTitle = pkProfit >= 300 ? "BIG WIN" : "WIN";
  later(() => showWinAnimation(pkWTitle, Math.round(pkProfit), pkWType), 1000);
}

/* Resalta las 5 cartas de la mejor mano en la mesa. */
function pkHighlightHand(best) {
  const all = [...pkEls.playerCards.children, ...pkEls.dealerCards.children, ...pkEls.communityCards.children];
  const set = new Set(best && best.cards ? best.cards : []);
  all.forEach(el => {
    el.classList.toggle("highlight", set.has(el._card));
    el.classList.toggle("dim", !set.has(el._card));
  });
}

async function finishPokerRound() {
  pk.animating = true;
  pk.phase = "showdown";
  pk.revealDealer = true;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pkSetTurn(null);
  updatePokerButtons();

  renderPoker(true);
  setMessage(pkEls.message, "Showdown: se revelan las cartas del dealer…");
  await sleep(T(850));

  let playerBest = evaluateBestHand([...pk.player, ...pk.community]);
  let dealerBest = evaluateBestHand([...pk.dealer, ...pk.community]);
  let result = compareHands(playerBest, dealerBest);

  pkEls.playerName.textContent = playerBest.name;
  pkEls.dealerName.textContent = dealerBest.name;

  $$(".hand-ranks li").forEach(li => li.classList.toggle("active-rank", li.querySelector("span").textContent === playerBest.name));
  pkHighlightHand(result >= 0 ? playerBest : dealerBest);

  // capturamos antes del reset de pk.bet / pk.pot
  let pkPot   = pk.pot;
  let pkBet   = pk.bet;

  renderPoker();

  if (result > 0) {
    let pkProfit = pkPot - pkBet;
    balance += pkPot;
    FX.flyChip(pkEls.potZone, walletEl, pkPot);
    FX.flyChip(pkEls.potZone, walletEl, pkPot, 120);
    Sound.play("cash");
    Stats.record("poker", pkBet, pkPot, playerBest.name);
    setMessage(pkEls.message, "Ganaste con " + playerBest.name + ". Cobrás " + pokerMoney(pkPot) + ".", "win");
    const pkWType  = pkProfit >= 300 ? "bigwin" : "win";
    const pkWTitle = pkProfit >= 300 ? "BIG WIN" : "WIN";
    later(() => showWinAnimation(pkWTitle, Math.round(pkProfit), pkWType), 1000);
  } else if (result < 0) {
    FX.flyChip(pkEls.potZone, pkEls.seatDealer, pkPot);
    Sound.play("thud");
    Stats.record("poker", pkBet, 0, "Dealer con " + dealerBest.name);
    setMessage(pkEls.message, "Gana el dealer con " + dealerBest.name + ". Perdiste.", "lose");
    later(() => showWinAnimation("GAME OVER", Math.round(pkBet), "lose"), 1000);
  } else {
    let returned = Math.floor(pkPot / 2);
    balance += returned;
    Stats.record("poker", pkBet, returned, "Empate · " + playerBest.name);
    setMessage(pkEls.message, "Empate. Recuperás " + pokerMoney(returned) + ".", "push");
  }

  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;
  pk.phase = "betting";
  pk.animating = false;

  updateBalance();
  renderPoker();
  updatePokerButtons();
}

function evaluateBestHand(cards) {
  let best = null;

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            let combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            let hand = evaluateHand(combo);
            hand.cards = combo;

            if (!best || compareHands(hand, best) > 0) {
              best = hand;
            }
          }
        }
      }
    }
  }

  return best;
}

function evaluateHand(hand) {
  let values = hand.map(card => rankValue(card.rank)).sort((a, b) => b - a);
  let suitsInHand = hand.map(card => card.suit);
  let counts = {};

  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  let groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  let flush = suitsInHand.every(suit => suit === suitsInHand[0]);
  let straightHigh = getStraightHigh(values);

  if (flush && straightHigh === 14 && values.includes(10)) {
    return { rank: 10, name: "Royal Flush", points: [14] };
  }

  if (flush && straightHigh) {
    return { rank: 9, name: "Straight Flush", points: [straightHigh] };
  }

  if (groups[0].count === 4) {
    let kicker = groups.find(group => group.count === 1).value;
    return { rank: 8, name: "Poker", points: [groups[0].value, kicker] };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 7, name: "Full House", points: [groups[0].value, groups[1].value] };
  }

  if (flush) {
    return { rank: 6, name: "Color", points: values };
  }

  if (straightHigh) {
    return { rank: 5, name: "Escalera", points: [straightHigh] };
  }

  if (groups[0].count === 3) {
    let kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.value)
      .sort((a, b) => b - a);

    return { rank: 4, name: "Trío", points: [groups[0].value, ...kickers] };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    let pairs = groups
      .filter(group => group.count === 2)
      .map(group => group.value)
      .sort((a, b) => b - a);

    let kicker = groups.find(group => group.count === 1).value;

    return { rank: 3, name: "Doble pareja", points: [...pairs, kicker] };
  }

  if (groups[0].count === 2) {
    let kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.value)
      .sort((a, b) => b - a);

    return { rank: 2, name: "Pareja", points: [groups[0].value, ...kickers] };
  }

  return { rank: 1, name: "Carta alta", points: values };
}

function getStraightHigh(values) {
  let unique = [...new Set(values)].sort((a, b) => a - b);

  if (unique.length !== 5) return null;

  let normalStraight = true;

  for (let i = 1; i < unique.length; i++) {
    if (unique[i] !== unique[i - 1] + 1) {
      normalStraight = false;
      break;
    }
  }

  if (normalStraight) return unique[4];

  let lowAceStraight = [2, 3, 4, 5, 14];
  let isLowAceStraight = unique.every((value, index) => value === lowAceStraight[index]);

  if (isLowAceStraight) return 5;

  return null;
}

function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;

  let maxLength = Math.max(a.points.length, b.points.length);

  for (let i = 0; i < maxLength; i++) {
    let valueA = a.points[i] || 0;
    let valueB = b.points[i] || 0;

    if (valueA !== valueB) return valueA > valueB ? 1 : -1;
  }

  return 0;
}

function pkReset() {
  resetPokerVisual();
  pk.bet = 0;
  pk.phase = "betting";
  pk.animating = false;
  pkSetTurn(null);
  pkEls.dealerAction.className = "action-bubble";
  [pkEls.potStack, pkEls.playerStack, pkEls.dealerStack].forEach(el => renderChipStack(el, 0, { force: true }));
  renderPoker();
  updatePokerButtons();
  setMessage(pkEls.message, "Elegí fichas y tocá Repartir mano.");
}

pkEls.chips.forEach(chip => {
  chip.addEventListener("click", () => pkPlaceChip(chipAmount(chip), chip));
});

pkEls.clear.addEventListener("click", pkClearBet);
pkEls.deal.addEventListener("click", pkDeal);
pkEls.draw.addEventListener("click", pkProceed);
pkEls.stand.addEventListener("click", pkFold);

/* ============================================================
   12. RULETA
   ------------------------------------------------------------
   El número ganador se sortea primero (igual que antes) y la
   física de la bola se calcula para terminar exactamente en
   ese casillero de la rueda. Pagos sin cambios:
   pleno x36, docena x3, chances simples x2.
   ============================================================ */
const rouletteOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26
];

const rouletteBoardOrder = [
  0,
  3, 2, 1,
  6, 5, 4,
  9, 8, 7,
  12, 11, 10,
  15, 14, 13,
  18, 17, 16,
  21, 20, 19,
  24, 23, 22,
  27, 26, 25,
  30, 29, 28,
  33, 32, 31,
  36, 35, 34
];

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const rt = {
  bets: {},
  selectedTargets: {},
  spinning: false,
  rotation: 0,
  lastBets: null,
  history: Store.get("rtHistory", []),

  /* estado de la simulación de la rueda */
  wheel: {
    rotor: 0,
    idleSpeed: 0.22,
    ballAngle: 0,
    ballRadius: 0,
    ballVisible: false,
    winnerIndex: -1,
    spin: null,
    layers: null,
    size: 0,
    lastFret: null
  }
};

const rtEls = {
  message: document.getElementById("rt-message"),
  bet: document.getElementById("rt-bet"),
  target: document.getElementById("rt-target"),
  betsList: document.getElementById("rt-bets-list"),
  result: document.getElementById("roulette-result"),
  resultChip: document.getElementById("rt-result-chip"),
  canvas: document.getElementById("rt-wheel"),
  history: document.getElementById("rt-history"),
  board: document.getElementById("number-board"),
  chips: document.querySelectorAll(".rt-chip"),
  clear: document.getElementById("rt-clear"),
  rebet: document.getElementById("rt-rebet"),
  spin: document.getElementById("rt-spin"),
  quickBets: document.querySelectorAll(".quick-bet")
};

function rouletteColor(number) {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function rouletteBetKey(target) {
  return target.type + "-" + target.value;
}

function rouletteTargetName(target) {
  if (!target) return "Ninguna";

  if (target.type === "number") return "Número " + target.value;

  if (target.type === "dozen") {
    if (target.value === 1) return "1 - 12";
    if (target.value === 2) return "13 - 24";
    if (target.value === 3) return "25 - 36";
  }

  let names = {
    red: "Rojo",
    black: "Negro",
    even: "Par",
    odd: "Impar"
  };

  return names[target.value];
}

function rouletteMultiplier(target) {
  if (target.type === "number") return 36;
  if (target.type === "dozen") return 3;
  return 2;
}

function rouletteTotalBet() {
  return Object.values(rt.bets).reduce((total, bet) => {
    return total + bet.amount;
  }, 0);
}

function selectedTargetsArray() {
  return Object.values(rt.selectedTargets);
}

function updateRouletteInfo() {
  let total = rouletteTotalBet();
  let selected = selectedTargetsArray();

  rtEls.bet.textContent = rouletteMoney(total);

  if (selected.length === 0) {
    rtEls.target.textContent = "Ninguna";
  } else {
    rtEls.target.textContent = selected.map(rouletteTargetName).join(", ");
  }

  if (!rtEls.betsList) return;

  let bets = Object.values(rt.bets);

  if (bets.length === 0) {
    rtEls.betsList.textContent = "Sin apuestas";
    return;
  }

  rtEls.betsList.innerHTML = "";

  bets.forEach(bet => {
    let item = document.createElement("div");
    item.className = "rt-bet-item";

    item.innerHTML = `
      <span>${rouletteTargetName(bet.target)} <small>x${rouletteMultiplier(bet.target)}</small></span>
      <strong>${rouletteMoney(bet.amount)}</strong>
    `;

    rtEls.betsList.appendChild(item);
  });
}

function rtAllInPerTarget() {
  const count = selectedTargetsArray().length;
  if (!count) return 0;
  return Math.floor(balance / count);
}

function updateRouletteButtons() {
  let selectedCount = selectedTargetsArray().length;

  rtEls.chips.forEach(chip => {
    let value = chip.dataset.allin === "true" ? rtAllInPerTarget() : Number(chip.dataset.value);
    let totalCost = value * selectedCount;

    chip.disabled = rt.spinning || selectedCount === 0 || value <= 0 || balance < totalCost;
  });

  rtEls.clear.disabled = rt.spinning || (rouletteTotalBet() === 0 && selectedCount === 0);
  rtEls.spin.disabled = rt.spinning || rouletteTotalBet() === 0;

  const lastTotal = rt.lastBets ? Object.values(rt.lastBets).reduce((t, b) => t + b.amount, 0) : 0;
  rtEls.rebet.disabled = rt.spinning || !lastTotal || balance < lastTotal;

  rtEls.quickBets.forEach(b => { b.disabled = rt.spinning; });
  if (rtEls.board) $$(".num-btn", rtEls.board).forEach(b => { b.disabled = rt.spinning; });

  markRouletteButtons();
}

function toggleRouletteTarget(type, value, element) {
  if (rt.spinning) return;

  let target = {
    type,
    value: type === "number" || type === "dozen" ? Number(value) : value
  };

  let key = rouletteBetKey(target);

  if (rt.selectedTargets[key]) {
    delete rt.selectedTargets[key];
    element.classList.remove("selected");
    Sound.play("deselect");
  } else {
    rt.selectedTargets[key] = target;
    element.classList.add("selected");
    Sound.play("select");
  }

  updateRouletteInfo();
  updateRouletteButtons();

  let selectedCount = selectedTargetsArray().length;

  if (selectedCount === 0) {
    setMessage(rtEls.message, "No hay selecciones. Marcá números u opciones para apostar.");
  } else {
    setMessage(
      rtEls.message,
      "Tenés " + selectedCount + " selección/es. Tocá una ficha para apostar en todas."
    );
  }
}

function rtTargetElement(target) {
  const sel = `[data-type="${target.type}"][data-value="${target.value}"]`;
  return document.querySelector("#roulette-screen " + sel);
}

function rtPlaceChip(value, chipEl) {
  if (rt.spinning) return;

  let selected = selectedTargetsArray();

  if (selected.length === 0) {
    setMessage(rtEls.message, "Primero seleccioná uno o más números u opciones.", "push");
    Sound.play("error");
    return;
  }

  if (!value || value <= 0) return;

  let totalCost = value * selected.length;

  if (balance < totalCost) {
    setMessage(rtEls.message, "No tenés saldo suficiente para apostar esa ficha en todas las selecciones.", "lose");
    return;
  }

  balance -= totalCost;

  selected.forEach((target, i) => {
    let key = rouletteBetKey(target);

    if (!rt.bets[key]) {
      rt.bets[key] = {
        target: { ...target },
        amount: 0,
        count: 0
      };
    }

    rt.bets[key].amount = round2(rt.bets[key].amount + value);
    rt.bets[key].count = (rt.bets[key].count || 0) + 1;

    if (i < 10) FX.flyChip(chipEl, rtTargetElement(target), value, i * 40);
  });

  if (chipEl) {
    chipEl.classList.remove("chip-pop");
    void chipEl.offsetWidth;
    chipEl.classList.add("chip-pop");
  }
  Sound.play("chip");

  updateBalance();
  updateRouletteInfo();
  /* las fichas aparecen sobre la mesa cuando aterrizan las que vuelan */
  later(updateRouletteButtons, Settings.reduceMotion ? 0 : T(420));
  updateRouletteButtons();

  setMessage(
    rtEls.message,
    "Apostaste " + rouletteMoney(value) + " en cada selección. Total: " + rouletteMoney(totalCost) + "."
  );
}

function rtClearBet() {
  if (rt.spinning) return;

  let total = rouletteTotalBet();

  balance += total;
  rt.bets = {};
  rt.selectedTargets = {};

  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("selected", "has-bet");
  });

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();

  setMessage(rtEls.message, "Apuestas limpiadas.");
}

function rtRebet() {
  if (rt.spinning || !rt.lastBets) return;
  const bets = Object.values(rt.lastBets);
  const total = bets.reduce((t, b) => t + b.amount, 0);
  if (!total || balance < total) {
    setMessage(rtEls.message, "No tenés saldo suficiente para repetir la apuesta anterior.", "lose");
    return;
  }

  balance -= total;
  bets.forEach((b, i) => {
    const key = rouletteBetKey(b.target);
    if (!rt.bets[key]) rt.bets[key] = { target: { ...b.target }, amount: 0, count: 0 };
    rt.bets[key].amount = round2(rt.bets[key].amount + b.amount);
    rt.bets[key].count = (rt.bets[key].count || 0) + (b.count || 1);
    if (i < 10) FX.flyChip(rtEls.rebet, rtTargetElement(b.target), b.amount, i * 40);
  });

  Sound.play("chipsCollect");
  updateBalance();
  updateRouletteInfo();
  later(updateRouletteButtons, T(420));
  updateRouletteButtons();
  setMessage(rtEls.message, "Repetiste la apuesta anterior: " + rouletteMoney(total) + ".");
}

function isRouletteWin(target, number) {
  if (target.type === "number") {
    return number === target.value;
  }

  if (target.type === "dozen") {
    if (target.value === 1) return number >= 1 && number <= 12;
    if (target.value === 2) return number >= 13 && number <= 24;
    if (target.value === 3) return number >= 25 && number <= 36;
  }

  if (target.value === "red") return rouletteColor(number) === "red";
  if (target.value === "black") return rouletteColor(number) === "black";
  if (target.value === "even") return number !== 0 && number % 2 === 0;
  if (target.value === "odd") return number % 2 === 1;

  return false;
}

/* --- Simulación física de la rueda y la bola --- */
const RT_SEG = (Math.PI * 2) / 37;

function rtRotorAt(spin, t) {
  const T_ = spin.T;
  const tt = Math.min(t, T_);
  const idle = rt.wheel.idleSpeed;
  return spin.rotor0 + idle * t + (spin.omega0 - idle) * (tt - (tt * tt) / (2 * T_));
}

function rtBallRelAt(spin, t) {
  const u = clamp(t / spin.Tb, 0, 1);
  let psi = spin.psi0 - spin.Psi * (1 - Math.pow(1 - u, 2.15));
  if (u > 0.7) {
    const v = (u - 0.7) / 0.3;
    psi += spin.bounceA * Math.sin(3 * Math.PI * v) * Math.pow(1 - v, 2);
  }
  return psi;
}

function rtBallRadiusAt(spin, t, R) {
  const u = clamp(t / spin.Tb, 0, 1);
  const track = R * 0.86;
  const pocket = R * 0.6;
  if (u < 0.05) return lerp(spin.r0, track, Ease.outCubic(u / 0.05));
  if (u < 0.55) return track + Math.sin(u * 60) * R * 0.004;
  if (u < 0.72) {
    const v = (u - 0.55) / 0.17;
    const fall = lerp(track, R * 0.7, Ease.inQuad(v));
    const bump = Math.abs(Math.sin(v * Math.PI * 2)) * R * 0.025 * (1 - v);
    return fall + bump;
  }
  const v = (u - 0.72) / 0.28;
  return pocket + (R * 0.1) * (1 - Ease.outCubic(v)) * Math.abs(Math.cos(v * Math.PI * 3.5));
}

function buildRouletteWheel() {
  const canvas = rtEls.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const size = Math.round(Math.min(rect.width, rect.height));
  if (size < 20) return;
  const dpr = Math.min(window.devicePixelRatio || 1, Quality.dprCap());
  rt.wheel.size = size;
  rt.wheel.layers = {
    bowl: buildBowlLayer(size, dpr),
    rotor: buildRotorLayer(size, dpr),
    dpr
  };
  const R = size / 2 * 0.97;
  if (!rt.wheel.ballRadius) rt.wheel.ballRadius = R * 0.6;
}

/* Conservado por compatibilidad: antes reconstruía las etiquetas de la rueda. */
function buildRouletteLabels() {
  buildRouletteWheel();
  drawRouletteWheel(performance.now());
}

function makeLayer(size, dpr) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(size * dpr);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

function buildBowlLayer(size, dpr) {
  const { c, ctx } = makeLayer(size, dpr);
  const cx = size / 2;
  const R = size / 2 * 0.97;

  /* aro exterior de madera */
  const wood = ctx.createRadialGradient(cx, cx * 0.85, R * 0.6, cx, cx, R);
  wood.addColorStop(0, "#6b3a16");
  wood.addColorStop(0.75, "#3d1f0a");
  wood.addColorStop(0.92, "#7a4a1e");
  wood.addColorStop(1, "#241104");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.arc(cx, cx, R, 0, Math.PI * 2);
  ctx.fill();

  /* vetas de la madera */
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = i % 2 ? "#000" : "#c98a4a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cx, R * (0.93 + Math.random() * 0.065), Math.random() * 6.28, Math.random() * 6.28 + 0.8);
    ctx.stroke();
  }
  ctx.restore();

  /* anillos dorados */
  const ring = (r, w, a = 1) => {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, `rgba(255,241,196,${a})`);
    g.addColorStop(0.4, `rgba(201,147,53,${a})`);
    g.addColorStop(0.7, `rgba(248,223,160,${a})`);
    g.addColorStop(1, `rgba(138,90,28,${a})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(R * 0.925, R * 0.018);

  /* pista de la bola */
  const track = ctx.createRadialGradient(cx, cx, R * 0.8, cx, cx, R * 0.915);
  track.addColorStop(0, "#0d0705");
  track.addColorStop(0.55, "#2a1a10");
  track.addColorStop(0.85, "#4a2f1a");
  track.addColorStop(1, "#1a0e06");
  ctx.fillStyle = track;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.915, 0, Math.PI * 2);
  ctx.arc(cx, cx, R * 0.795, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  /* brillo de la pista */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, "rgba(255,230,190,0.16)");
  sheen.addColorStop(0.5, "rgba(255,230,190,0)");
  sheen.addColorStop(1, "rgba(255,230,190,0.06)");
  ctx.strokeStyle = sheen;
  ctx.lineWidth = R * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.87, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  /* rombos deflectores */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.sin(a) * R * 0.855;
    const y = cx - Math.cos(a) * R * 0.855;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const long = i % 2 === 0;
    const w = R * (long ? 0.022 : 0.034);
    const h = R * (long ? 0.05 : 0.022);
    const g = ctx.createLinearGradient(-w, -h, w, h);
    g.addColorStop(0, "#fff1c4");
    g.addColorStop(0.5, "#c99335");
    g.addColorStop(1, "#8a5a1c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ring(R * 0.8, R * 0.012, 0.9);
  ring(R * 0.995, R * 0.012, 0.7);

  /* sombra interior que cae sobre el rotor */
  const inner = ctx.createRadialGradient(cx, cx, R * 0.7, cx, cx, R * 0.8);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.8, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

function buildRotorLayer(size, dpr) {
  const { c, ctx } = makeLayer(size, dpr);
  const cx = size / 2;
  const R = size / 2 * 0.97;
  const rOuter = R * 0.795;
  const rNumIn = R * 0.655;
  const rPocketIn = R * 0.54;

  const colors = {
    red: ["#e3294f", "#9c0f2c"],
    black: ["#2c2836", "#0f0c16"],
    green: ["#1dbb73", "#086438"]
  };

  rouletteOrder.forEach((number, i) => {
    const color = colors[rouletteColor(number)];
    const a0 = i * RT_SEG - RT_SEG / 2 - Math.PI / 2;
    const a1 = a0 + RT_SEG;

    /* banda de números */
    const g = ctx.createRadialGradient(cx, cx, rNumIn, cx, cx, rOuter);
    g.addColorStop(0, color[1]);
    g.addColorStop(0.6, color[0]);
    g.addColorStop(1, color[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, rOuter, a0, a1);
    ctx.arc(cx, cx, rNumIn, a1, a0, true);
    ctx.closePath();
    ctx.fill();

    /* bolsillo (más oscuro y con profundidad) */
    const p = ctx.createRadialGradient(cx, cx, rPocketIn, cx, cx, rNumIn);
    p.addColorStop(0, "rgba(0,0,0,0.75)");
    p.addColorStop(0.5, color[1]);
    p.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.arc(cx, cx, rNumIn, a0, a1);
    ctx.arc(cx, cx, rPocketIn, a1, a0, true);
    ctx.closePath();
    ctx.fill();

    /* número */
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(i * RT_SEG);
    ctx.fillStyle = "#fff8ea";
    ctx.font = `700 ${Math.max(8, R * 0.062)}px Unbounded, Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 2;
    ctx.fillText(String(number), 0, -(rOuter + rNumIn) / 2);
    ctx.restore();
  });

  /* trastes metálicos entre bolsillos */
  for (let i = 0; i < 37; i++) {
    const a = i * RT_SEG - RT_SEG / 2 - Math.PI / 2;
    ctx.strokeStyle = "#e8c47a";
    ctx.lineWidth = Math.max(1, R * 0.008);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rPocketIn, cx + Math.sin(a) * rPocketIn);
    ctx.lineTo(cx + Math.cos(a) * rNumIn, cx + Math.sin(a) * rNumIn);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,201,107,0.55)";
    ctx.lineWidth = Math.max(0.6, R * 0.004);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rNumIn, cx + Math.sin(a) * rNumIn);
    ctx.lineTo(cx + Math.cos(a) * rOuter, cx + Math.sin(a) * rOuter);
    ctx.stroke();
  }

  [rOuter, rNumIn, rPocketIn].forEach((r, k) => {
    ctx.strokeStyle = k === 1 ? "#e8c47a" : "#c99335";
    ctx.lineWidth = Math.max(1, R * (k === 1 ? 0.01 : 0.008));
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  /* cono central */
  const cone = ctx.createRadialGradient(cx - R * 0.1, cx - R * 0.12, R * 0.05, cx, cx, rPocketIn);
  cone.addColorStop(0, "#f8dfa0");
  cone.addColorStop(0.25, "#b9822b");
  cone.addColorStop(0.55, "#5a3412");
  cone.addColorStop(0.85, "#3a1f08");
  cone.addColorStop(1, "#1a0c02");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.arc(cx, cx, rPocketIn, 0, Math.PI * 2);
  ctx.fill();

  /* torreta con cuatro brazos */
  ctx.save();
  ctx.translate(cx, cx);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    const g = ctx.createLinearGradient(0, -R * 0.03, 0, R * 0.03);
    g.addColorStop(0, "#fff1c4");
    g.addColorStop(0.5, "#c99335");
    g.addColorStop(1, "#6b4210");
    ctx.fillStyle = g;
    roundRect(ctx, R * 0.06, -R * 0.018, R * 0.3, R * 0.036, R * 0.018);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R * 0.37, 0, R * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
  const knob = ctx.createRadialGradient(-R * 0.03, -R * 0.03, 0, 0, 0, R * 0.09);
  knob.addColorStop(0, "#fff8e1");
  knob.addColorStop(0.4, "#e7b85a");
  knob.addColorStop(1, "#6b4210");
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return c;
}

function drawRouletteWheel(now) {
  const canvas = rtEls.canvas;
  if (!canvas || !canvas.offsetWidth) return;
  const { ctx, w, h } = fitCanvas(canvas);
  const size = Math.min(w, h);
  if (!rt.wheel.layers || Math.abs(rt.wheel.size - size) > 1) buildRouletteWheel();
  const L = rt.wheel.layers;
  if (!L) return;

  const cx = w / 2;
  const cy = h / 2;
  const R = size / 2 * 0.97;
  const W = rt.wheel;

  ctx.clearRect(0, 0, w, h);

  ctx.drawImage(L.bowl, cx - size / 2, cy - size / 2, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(W.rotor);
  ctx.drawImage(L.rotor, -size / 2, -size / 2, size, size);

  /* casillero ganador iluminado (en el espacio del rotor) */
  if (W.winnerIndex >= 0 && !W.spin) {
    const pulse = 0.55 + 0.45 * Math.sin(now / 220);
    const a0 = W.winnerIndex * RT_SEG - RT_SEG / 2 - Math.PI / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,241,196,${0.28 * pulse + 0.12})`;
    ctx.shadowColor = "rgba(255,230,160,0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.8, a0, a0 + RT_SEG);
    ctx.arc(0, 0, R * 0.54, a0 + RT_SEG, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  /* bola */
  if (W.ballVisible) {
    const bx = cx + Math.sin(W.ballAngle) * W.ballRadius;
    const by = cy - Math.cos(W.ballAngle) * W.ballRadius;
    const br = R * 0.034;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(bx + br * 0.35, by + br * 0.5, br * 1.05, br * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.45, br * 0.1, bx, by, br);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#e9e7f2");
    g.addColorStop(1, "#8d8aa0");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  /* reflejo de cristal */
  const gloss = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.4);
  gloss.addColorStop(0, "rgba(255,255,255,0.12)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0.02)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
}

function rouletteTick(dt, now) {
  const W = rt.wheel;

  if (W.spin) {
    const s = W.spin;
    const t = (now - s.start) / 1000 * s.speed;
    const R = (rt.wheel.size || 400) / 2 * 0.97;

    W.rotor = rtRotorAt(s, t);
    const psi = rtBallRelAt(s, t);
    W.ballAngle = W.rotor + psi;
    W.ballRadius = rtBallRadiusAt(s, t, R);

    /* sonido: rodado sobre la pista y golpes contra los trastes */
    const u = t / s.Tb;
    if (u < 0.6) Sound.setRoll(clamp(1 - u * 1.3, 0.15, 1), 1500 + (1 - u) * 1200);
    else Sound.stopRoll();
    if (u > 0.55 && u < 1) {
      const fret = Math.floor((psi + RT_SEG / 2) / RT_SEG);
      if (W.lastFret !== null && fret !== W.lastFret) Sound.play("tick", 1.4 - u * 0.5);
      W.lastFret = fret;
    }

    if (t >= s.T) {
      W.rotor = rtRotorAt(s, s.T);
      W.ballAngle = W.rotor + rtBallRelAt(s, s.Tb);
      W.ballRadius = R * 0.6;
      const winner = s.winnerNumber;
      W.spin = null;
      Sound.stopRoll();
      rtResolve(winner);
    }
  } else {
    W.rotor += W.idleSpeed * dt;
    if (W.winnerIndex >= 0) W.ballAngle = W.rotor + W.winnerIndex * RT_SEG;
  }

  if (currentScreen === "roulette-screen") drawRouletteWheel(now);
  return W.spin !== null || currentScreen === "roulette-screen";
}

function startRouletteLoop() {
  Loop.add("roulette", rouletteTick);
}

function rtSpin() {
  if (rt.spinning || rouletteTotalBet() <= 0) return;

  rt.spinning = true;
  rt.lastBets = JSON.parse(JSON.stringify(rt.bets));
  updateRouletteButtons();

  let winnerIndex = Math.floor(Math.random() * rouletteOrder.length);
  let winnerNumber = rouletteOrder[winnerIndex];

  const W = rt.wheel;
  const R = (W.size || 400) / 2 * 0.97;
  const speed = simSpeed();
  const T_ = 7.2;
  const Tb = T_ * 0.8;
  const laps = 4 + Math.floor(Math.random() * 2);
  const ball0 = W.ballVisible ? W.ballAngle : W.rotor + Math.random() * Math.PI * 2;
  const psi0 = ball0 - W.rotor;
  const target = winnerIndex * RT_SEG;
  const delta = (((psi0 - target) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  W.spin = {
    start: performance.now(),
    speed,
    T: T_,
    Tb,
    rotor0: W.rotor,
    omega0: 2.4 + Math.random() * 0.6,
    psi0,
    Psi: delta + Math.PI * 2 * laps,
    bounceA: RT_SEG * (1.1 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1),
    r0: W.ballVisible ? W.ballRadius : R * 0.86,
    winnerNumber
  };
  W.winnerIndex = winnerIndex;
  W.ballVisible = true;
  W.lastFret = null;
  rt.rotation = W.rotor;

  rtEls.result.textContent = "?";
  rtEls.resultChip.className = "wheel-center";
  $$(".win-cell").forEach(el => el.classList.remove("win-cell"));

  Sound.play("whoosh");
  Sound.startRoll();
  startRouletteLoop();

  setMessage(rtEls.message, "La ruleta está girando... ¡No va más!");
}

function rtResolve(winnerNumber) {
  rtEls.result.textContent = winnerNumber;
  rtEls.resultChip.className = "wheel-center " + rouletteColor(winnerNumber);
  void rtEls.resultChip.offsetWidth;
  rtEls.resultChip.classList.add("reveal");
  Sound.play("bell");

  rt.history.unshift(winnerNumber);
  if (rt.history.length > 14) rt.history.length = 14;
  Store.set("rtHistory", rt.history);
  renderRouletteHistory();

  let totalBet = rouletteTotalBet();
  let totalPayout = 0;
  let wonBets = [];

  Object.values(rt.bets).forEach(bet => {
    if (isRouletteWin(bet.target, winnerNumber)) {
      let multiplier = rouletteMultiplier(bet.target);
      let payout = bet.amount * multiplier;

      totalPayout += payout;

      wonBets.push(
        rouletteTargetName(bet.target) + " +" + rouletteMoney(payout - bet.amount)
      );

      const el = rtTargetElement(bet.target);
      if (el) {
        FX.burstAt(el, { count: 14, colors: ["#fff1c4", "#f0c96b", "#34e89e"], speed: 120 });
      }
    }
  });

  /* ilumina el número ganador y las apuestas externas que pagan */
  const numEl = rtTargetElement({ type: "number", value: winnerNumber });
  if (numEl) numEl.classList.add("win-cell");
  rtEls.quickBets.forEach(b => {
    const target = { type: b.dataset.type, value: b.dataset.type === "dozen" ? Number(b.dataset.value) : b.dataset.value };
    if (isRouletteWin(target, winnerNumber)) b.classList.add("win-cell");
  });
  later(() => $$(".win-cell").forEach(el => el.classList.remove("win-cell")), 3800);

  Stats.record("roulette", totalBet, totalPayout, "Salió " + winnerNumber);

  if (totalPayout > 0) {
    balance += totalPayout;

    let net = totalPayout - totalBet;

    setMessage(
      rtEls.message,
      "Salió " + winnerNumber + ". Ganaste: " + wonBets.join(", ") + ". Neto: " + rouletteMoney(net) + ".",
      "win"
    );
    Sound.play("cash");

    if (net > 0) {
      const rtWType  = net >= 300 ? "bigwin" : "win";
      const rtWTitle = net >= 300 ? "BIG WIN" : "WIN";
      later(() => showWinAnimation(rtWTitle, Math.round(net), rtWType), 1000);
    }
  } else {
    setMessage(
      rtEls.message,
      "Salió " + winnerNumber + ". Perdiste " + rouletteMoney(totalBet) + ".",
      "lose"
    );
    later(() => showWinAnimation("GAME OVER", Math.round(totalBet), "lose"), 1000);
  }

  rt.bets = {};
  rt.selectedTargets = {};
  rt.spinning = false;

  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("selected", "has-bet");
  });

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();
}

function renderRouletteHistory() {
  if (!rtEls.history) return;
  rtEls.history.innerHTML = rt.history.map(n => `<span class="${rouletteColor(n)}">${n}</span>`).join("");
}

function buildNumberBoard() {
  rtEls.board.innerHTML = "";

  rouletteBoardOrder.forEach(number => {
    let btn = document.createElement("button");
    let color = rouletteColor(number);

    btn.className = "num-btn " + color;
    btn.textContent = number;
    btn.dataset.type = "number";
    btn.dataset.value = number;
    btn.setAttribute("aria-label", "Número " + number + " " + (color === "red" ? "rojo" : color === "black" ? "negro" : "verde"));

    if (number === 0) {
      btn.classList.add("zero");
    }

    btn.addEventListener("click", () => {
      toggleRouletteTarget("number", number, btn);
    });

    rtEls.board.appendChild(btn);
  });
}

function markRouletteButtons() {
  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("has-bet");

    let type = button.dataset.type;
    let value = button.dataset.value;

    if (!type || value === undefined) return;

    let target = {
      type,
      value: type === "number" || type === "dozen" ? Number(value) : value
    };

    let key = rouletteBetKey(target);
    let chip = button.querySelector(".bet-chip");

    if (rt.bets[key]) {
      button.classList.add("has-bet");
      const amount = rt.bets[key].amount;
      const cls = chipClassFor(amount);
      const label = shortMoney(amount).replace("$", "");
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "bet-chip";
        button.appendChild(chip);
      }
      if (chip.dataset.amount !== String(amount)) {
        chip.className = "bet-chip " + cls;
        chip.style.setProperty("--chip-c", CHIP_COLORS[cls][0]);
        chip.textContent = label;
        chip.dataset.amount = String(amount);
        chip.dataset.count = String(rt.bets[key].count || 1);
        chip.style.animation = "none";
        void chip.offsetWidth;
        chip.style.animation = "";
      }
    } else if (chip) {
      chip.remove();
    }
  });
}

function rtReset() {
  rt.bets = {};
  rt.selectedTargets = {};
  rt.spinning = false;
  rt.wheel.spin = null;
  rt.wheel.winnerIndex = -1;
  rt.wheel.ballVisible = false;
  Sound.stopRoll();
  rtEls.result.textContent = "?";
  rtEls.resultChip.className = "wheel-center";
  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("selected", "has-bet", "win-cell");
  });
  updateRouletteInfo();
  updateRouletteButtons();
  setMessage(rtEls.message, "Elegí una apuesta, cargá fichas y girá.");
  if (currentScreen === "roulette-screen") startRouletteLoop();
}

rtEls.quickBets.forEach(button => {
  button.addEventListener("click", () => {
    toggleRouletteTarget(button.dataset.type, button.dataset.value, button);
  });
});

rtEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    const value = chip.dataset.allin === "true" ? rtAllInPerTarget() : Number(chip.dataset.value);
    rtPlaceChip(value, chip);
  });
});

rtEls.clear.addEventListener("click", rtClearBet);
rtEls.rebet.addEventListener("click", rtRebet);
rtEls.spin.addEventListener("click", rtSpin);

screenHooks["roulette-screen"] = {
  show() {
    buildRouletteWheel();
    startRouletteLoop();
  }
};

/* ============================================================
   13. COIN MINER
   ============================================================ */
const cm = {
  bet: 0,
  baseBet: 0,
  profit: 0,
  active: false,
  board: [],
  safeFlipped: 0,
  bombs: 3,
  lastIndex: -1
};

const cmEls = {
  message: document.getElementById("cm-message"),
  bet: document.getElementById("cm-bet"),
  profit: document.getElementById("cm-profit"),
  total: document.getElementById("cm-total"),
  next: document.getElementById("cm-next"),
  safe: document.getElementById("cm-safe"),
  board: document.getElementById("cm-board"),
  boardWrap: document.getElementById("cm-board-wrap"),
  ladder: document.getElementById("cm-ladder"),
  progress: document.getElementById("cm-progress-bar"),
  chips: document.querySelectorAll(".cm-chip"),
  bombsInput: document.getElementById("cm-bombs-input"),
  bombsApply: document.getElementById("cm-bombs-apply"),
  bombsMinus: document.getElementById("cm-bombs-minus"),
  bombsPlus: document.getElementById("cm-bombs-plus"),
  presets: document.querySelectorAll(".bomb-presets .preset"),
  rulesText: document.getElementById("cm-rules-text"),
  rulesExample: document.getElementById("cm-rules-example"),
  clear: document.getElementById("cm-clear"),
  start: document.getElementById("cm-start"),
  cashout: document.getElementById("cm-cashout"),
  tiles: []
};

function getCoinPercent() {
  let basePercent = cm.bombs + 2;
  let growthPercent = cm.safeFlipped * 1.25;

  return Number((basePercent + growthPercent).toFixed(2));
}

function coinPercentAt(step) {
  return Number((cm.bombs + 2 + step * 1.25).toFixed(2));
}

function createCoinMinerBoard() {
  let cards = [];

  for (let i = 0; i < cm.bombs; i++) {
    cards.push({
      type: "bomb",
      revealed: false
    });
  }

  for (let i = cm.bombs; i < 25; i++) {
    cards.push({
      type: "coin",
      revealed: false
    });
  }

  return shuffle(cards);
}

function createEmptyMinerBoard() {
  let empty = [];

  for (let i = 0; i < 25; i++) {
    empty.push({
      type: "coin",
      revealed: false
    });
  }

  return empty;
}

/* El tablero se construye una sola vez: los listeners no se duplican y
   cada casilla conserva su elemento para animar solo lo que cambia. */
function buildMinerBoard() {
  cmEls.board.innerHTML = "";
  cmEls.tiles = [];
  for (let index = 0; index < 25; index++) {
    const button = document.createElement("button");
    button.className = "miner-tile hidden";
    button.setAttribute("aria-label", "Casilla " + (index + 1));
    button.innerHTML = '<span class="tile-inner"><span class="tile-face tile-front"></span><span class="tile-face tile-back"></span></span>';
    button._revealed = false;

    button.addEventListener("pointerdown", () => {
      if (!button.disabled) button.classList.add("pressing");
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => button.addEventListener(ev, () => button.classList.remove("pressing")));
    button.addEventListener("click", () => {
      button.classList.remove("pressing");
      flipCoinMinerTile(index);
    });

    cmEls.board.appendChild(button);
    cmEls.tiles.push(button);
  }
}

function renderCoinMiner() {
  let autoOrder = 0;

  cm.board.forEach((tile, index) => {
    const button = cmEls.tiles[index];
    if (!button) return;
    const inner = button.firstElementChild;

    if (tile.revealed && !button._revealed) {
      button._revealed = true;
      button.querySelector(".tile-back").innerHTML = `<span class="${tile.type}-face"></span>`;
      inner.style.transitionDelay = tile.auto ? T(autoOrder++ * 35) + "ms" : "0ms";
      button.classList.remove("hidden", "coin", "bomb", "ghost", "just");
      button.classList.add("revealed", tile.type);
      if (tile.auto) button.classList.add("ghost");
      if (index === cm.lastIndex) button.classList.add("just");
    } else if (!tile.revealed && button._revealed) {
      button._revealed = false;
      inner.style.transitionDelay = "0ms";
      button.classList.remove("revealed", "coin", "bomb", "ghost", "just");
      button.classList.add("hidden");
      later(() => {
        if (!button._revealed) button.querySelector(".tile-back").innerHTML = "";
      }, 500);
    }

    button.disabled = !cm.active || tile.revealed;
  });

  let nextPercent = getCoinPercent();
  let safeTotal = 25 - cm.bombs;

  cmEls.bet.textContent = formatMoney(cm.bet);
  cmEls.profit.textContent = formatMoney(cm.profit);
  cmEls.total.textContent = formatMoney(cm.bet + cm.profit);
  cmEls.next.textContent = "+" + nextPercent + "%";
  cmEls.safe.textContent = cm.safeFlipped + "/" + safeTotal;

  const heat = safeTotal ? cm.safeFlipped / safeTotal : 0;
  cmEls.boardWrap.style.setProperty("--heat", cm.active || cm.safeFlipped ? heat.toFixed(3) : "0");
  cmEls.progress.style.width = (heat * 100).toFixed(1) + "%";

  renderMinerLadder();
  renderMinerRules();
}

function renderMinerLadder() {
  const safeTotal = 25 - cm.bombs;
  const from = Math.max(0, cm.safeFlipped - 2);
  const to = Math.min(safeTotal, from + 9);
  const base = cm.baseBet || cm.bet;
  let html = "";
  for (let s = from; s < to; s++) {
    const pct = coinPercentAt(s);
    const cls = s < cm.safeFlipped ? "done" : s === cm.safeFlipped ? "next" : "";
    html += `<div class="ladder-step ${cls}"><small>Moneda ${s + 1}</small>+${pct}%${base ? " · " + formatMoney(base * pct / 100) : ""}</div>`;
  }
  cmEls.ladder.innerHTML = html;
}

function renderMinerRules() {
  if (!cmEls.rulesText) return;
  const first = coinPercentAt(0);
  cmEls.rulesText.innerHTML = `Hay 25 tarjetas. Dentro hay <strong>${cm.bombs} bomba${cm.bombs === 1 ? "" : "s"}</strong>. La primera moneda suma un <strong>${first}% de tu apuesta inicial</strong> y cada moneda siguiente suma 1,25% más.`;
  let gain = 0;
  for (let s = 0; s < 4; s++) gain += 100 * coinPercentAt(s) / 100;
  cmEls.rulesExample.textContent = `Ejemplo: si apostás $100 con ${cm.bombs} bomba${cm.bombs === 1 ? "" : "s"} y cobrás después de 4 monedas, recibís ${formatMoney(100 + gain)}.`;
  cmEls.presets.forEach(p => p.classList.toggle("active", Number(p.dataset.bombs) === cm.bombs));
}

function updateCoinMinerButtons() {
  cmEls.chips.forEach(chip => {
    let value = chipAmount(chip);
    chip.disabled = cm.active || value <= 0 || balance < value;
  });

  cmEls.bombsInput.disabled = cm.active;
  cmEls.bombsApply.disabled = cm.active;
  cmEls.bombsMinus.disabled = cm.active || cm.bombs <= 1;
  cmEls.bombsPlus.disabled = cm.active || cm.bombs >= 24;
  cmEls.presets.forEach(p => { p.disabled = cm.active; });

  cmEls.clear.disabled = cm.active || cm.bet === 0;
  cmEls.start.disabled = cm.active || cm.bet === 0;
  cmEls.cashout.disabled = !cm.active || cm.safeFlipped === 0;
}

function applyBombAmount() {
  if (cm.active) return;

  let amount = Number(cmEls.bombsInput.value);

  if (!Number.isFinite(amount)) {
    amount = cm.bombs || 3;
  }

  if (!Number.isInteger(amount)) {
    amount = Math.floor(amount);
  }

  if (amount < 1) amount = 1;
  if (amount > 24) amount = 24;

  cm.bombs = amount;
  cmEls.bombsInput.value = amount;

  cm.safeFlipped = 0;
  cm.profit = 0;
  cm.lastIndex = -1;
  cm.board = createEmptyMinerBoard();

  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(
    cmEls.message,
    "Elegiste " + cm.bombs + " bombas. La próxima moneda paga +" + getCoinPercent() + "%."
  );
}

function cmPlaceChip(value, chipEl) {
  if (cm.active || value <= 0 || balance < value) return;

  balance -= value;
  cm.bet = round2(cm.bet + value);
  cm.baseBet = cm.bet;

  chipFeedback(chipEl, cmEls.bet, value);
  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(cmEls.message, "Apostaste " + formatMoney(cm.bet) + ". Ya podés iniciar.");
}

function cmClearBet() {
  if (cm.active) return;

  balance += cm.bet;

  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;
  cm.safeFlipped = 0;
  cm.lastIndex = -1;
  cm.board = createEmptyMinerBoard();

  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(cmEls.message, "Apuesta limpiada.");
}

function cmStartGame() {
  if (cm.active || cm.bet <= 0) return;

  applyBombAmount();

  cm.active = true;
  cm.baseBet = cm.bet;
  cm.profit = 0;
  cm.safeFlipped = 0;
  cm.lastIndex = -1;
  cm.board = createCoinMinerBoard();

  renderCoinMiner();
  updateCoinMinerButtons();
  Sound.play("whoosh");

  /* ola de luz que recorre el tablero al iniciar */
  if (!Settings.reduceMotion) {
    cmEls.tiles.forEach((t, i) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      t.querySelector(".tile-front").animate(
        [{ filter: "brightness(1)" }, { filter: "brightness(1.9)", offset: 0.4 }, { filter: "brightness(1)" }],
        { duration: 520, delay: (row + col) * 45, easing: "ease-out" }
      );
    });
  }

  setMessage(
    cmEls.message,
    "Partida iniciada con " + cm.bombs + " bombas. Primera moneda paga +" + getCoinPercent() + "%."
  );
}

function flipCoinMinerTile(index) {
  if (!cm.active) return;

  let tile = cm.board[index];

  if (tile.revealed) return;

  tile.revealed = true;
  cm.lastIndex = index;

  if (tile.type === "bomb") {
    cmLose();
    return;
  }

  let percent = getCoinPercent();
  let gain = cm.baseBet * (percent / 100);

  cm.profit = Number((cm.profit + gain).toFixed(2));
  cm.safeFlipped++;

  renderCoinMiner();
  updateCoinMinerButtons();

  const tileEl = cmEls.tiles[index];
  Sound.play("flip");
  later(() => {
    Sound.play("coin");
    FX.burstAt(tileEl, { count: 16, colors: ["#fff1c4", "#f0c96b", "#ffd166"], speed: 150, gravity: 320, size: 6 });
    FX.floatText(tileEl, "+" + formatMoney(gain), "#fff1c4");
  }, T(220));
  flashValue(cmEls.total);

  if (cm.safeFlipped === 25 - cm.bombs) {
    cmCashout(true);
    return;
  }

  setMessage(
    cmEls.message,
    "🪙 Moneda. Sumaste " + formatMoney(gain) + " (" + percent + "%). La próxima paga +" + getCoinPercent() + "%.",
    "win"
  );
}

function cmLose() {
  let lost = cm.bet;
  let coins = cm.safeFlipped;

  cm.active = false;
  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;

  cm.board.forEach(tile => {
    if (!tile.revealed) tile.auto = true;
    tile.revealed = true;
  });

  renderCoinMiner();
  updateCoinMinerButtons();

  const tileEl = cmEls.tiles[cm.lastIndex];
  Sound.play("bomb");
  later(() => {
    FX.burstAt(tileEl, { count: 34, colors: ["#ff4d6d", "#ffd166", "#ff9f1c", "#2a0a14"], speed: 280, gravity: 200, size: 9, life: 900 });
    cmEls.boardWrap.classList.remove("shake");
    void cmEls.boardWrap.offsetWidth;
    cmEls.boardWrap.classList.add("shake");
  }, T(180));

  Stats.record("miner", lost, 0, "Bomba tras " + coins + " moneda" + (coins === 1 ? "" : "s") + " · " + cm.bombs + " bombas");

  setMessage(cmEls.message, "💣 Tocaste bomba. Perdiste " + formatMoney(lost) + ".", "lose");
  later(() => showWinAnimation("GAME OVER", Math.round(lost), "lose"), 1000);
}

function cmCashout(perfect = false) {
  if (!cm.active) return;

  let payout  = Number((cm.bet + cm.profit).toFixed(2));
  let cmProfit = cm.profit; // capturar antes del reset
  let betPlaced = cm.bet;
  let coins = cm.safeFlipped;

  balance = Number((balance + payout).toFixed(2));

  cm.active = false;
  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;

  cm.board.forEach(tile => {
    if (!tile.revealed) tile.auto = true;
    tile.revealed = true;
  });

  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  Sound.play("cash");
  FX.flyChip(cmEls.cashout, walletEl, payout);
  Stats.record("miner", betPlaced, payout, coins + " moneda" + (coins === 1 ? "" : "s") + " · " + cm.bombs + " bombas");

  if (perfect) {
    setMessage(cmEls.message, "Limpiaste todo el tablero. Cobraste " + formatMoney(payout) + ".", "win");
  } else {
    setMessage(cmEls.message, "Cobraste " + formatMoney(payout) + ". Bien jugado.", "win");
  }

  const cmWType  = cmProfit >= 300 ? "bigwin" : "win";
  const cmWTitle = cmProfit >= 300 ? "BIG WIN" : "WIN";
  later(() => showWinAnimation(cmWTitle, Math.round(cmProfit), cmWType), 1000);
}

function cmReset() {
  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;
  cm.active = false;
  cm.safeFlipped = 0;
  cm.lastIndex = -1;
  cm.board = createEmptyMinerBoard();
  renderCoinMiner();
  updateCoinMinerButtons();
  setMessage(cmEls.message, "Elegí fichas y tocá Iniciar partida.");
}

function cmSetBombs(n) {
  if (cm.active) return;
  cmEls.bombsInput.value = clamp(Math.round(n), 1, 24);
  applyBombAmount();
}

cmEls.bombsApply.addEventListener("click", applyBombAmount);

cmEls.bombsInput.addEventListener("change", applyBombAmount);
cmEls.bombsMinus.addEventListener("click", () => cmSetBombs(cm.bombs - 1));
cmEls.bombsPlus.addEventListener("click", () => cmSetBombs(cm.bombs + 1));
cmEls.presets.forEach(p => p.addEventListener("click", () => cmSetBombs(Number(p.dataset.bombs))));

cmEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    cmPlaceChip(chipAmount(chip), chip);
  });
});

cmEls.clear.addEventListener("click", cmClearBet);
cmEls.start.addEventListener("click", cmStartGame);
cmEls.cashout.addEventListener("click", () => cmCashout(false));

/* ============================================================
   14. CHICKEN ROAD
   ------------------------------------------------------------
   La lógica decide primero si el cruce es seguro (mismas
   probabilidades que antes). La escena solo representa ese
   resultado: si es seguro, el carril se corta y los autos
   frenan o pasan antes; si no, aparece el auto que atropella.
   ============================================================ */
const cr = {
  bet: 0,
  active: false,
  step: 0,
  crashedLane: null,
  animating: false
};

const crMultipliers = [1.20, 1.45, 1.75, 2.10, 2.65, 3.30, 4.20, 5.40, 7.00, 10.00];

const crLoseChances = [0.18, 0.23, 0.28, 0.34, 0.40, 0.47, 0.54, 0.61, 0.68, 0.75];
const crEls = {
  message: document.getElementById("cr-message"),
  bet: document.getElementById("cr-bet"),
  multiplier: document.getElementById("cr-multiplier"),
  cash: document.getElementById("cr-cash"),
  step: document.getElementById("cr-step"),
  road: document.getElementById("cr-road"),
  canvas: document.getElementById("cr-canvas"),
  ladder: document.getElementById("cr-ladder"),
  chips: document.querySelectorAll(".cr-chip"),
  clear: document.getElementById("cr-clear"),
  start: document.getElementById("cr-start"),
  go: document.getElementById("cr-go"),
  cashout: document.getElementById("cr-cashout")
};

const CAR_COLORS = [
  ["#ff4d6d", "#9c1033"], ["#2de2e6", "#0b7f86"], ["#f0c96b", "#8a5a1c"],
  ["#8b5cf6", "#4520a0"], ["#e9e6f5", "#8f8ba6"], ["#34e89e", "#0d7a4d"], ["#ff9f1c", "#a35a00"]
];

const crScene = {
  w: 0, h: 0, lw: 100, sw: 140,
  camX: 0,
  cars: [],
  particles: [],
  barriers: [],
  spawnIn: [],
  shake: 0,
  time: 0,
  chicken: { lane: -1, x: 0, y: 0, hop: null, state: "idle", squash: 0, face: 1, blink: 0, deadAt: 0 },
  plates: []
};

function crCurrentMultiplier() {
  if (cr.step <= 0) return 1;
  return crMultipliers[cr.step - 1];
}

function crCashValue() {
  if (cr.step <= 0) return 0;
  return Math.round(cr.bet * crCurrentMultiplier());
}

/* --- geometría del mundo --- */
function crLaneX(i) { return crScene.sw + i * crScene.lw; }
function crLaneCenter(i) { return crLaneX(i) + crScene.lw / 2; }
function crChickenRestX(lane) { return lane < 0 ? crScene.sw * 0.5 : lane >= crMultipliers.length ? crLaneX(crMultipliers.length) + crScene.sw * 0.6 : crLaneCenter(lane); }
function crWorldW() { return crLaneX(crMultipliers.length) + crScene.sw * 1.4; }
function crChickenY() { return crScene.h * 0.62; }
function crBarrierY() { return crChickenY() - crScene.lw * 0.95; }

function crLayout() {
  const s = crScene;
  const { w, h } = fitCanvas(crEls.canvas);
  s.w = w;
  s.h = h;
  s.lw = clamp(h * 0.26, 76, 132);
  s.sw = s.lw * 1.45;
  s.chicken.y = crChickenY();
  if (!s.chicken.hop) s.chicken.x = crChickenRestX(s.chicken.lane);
}

function crScale() { return crScene.lw / 110; }

function crSpawnCar(lane, opts = {}) {
  const s = crScene;
  const k = crScale();
  const truck = !opts.killer && Math.random() < 0.18;
  const len = (truck ? 128 : rand(66, 80)) * k;
  const width = (truck ? 54 : rand(42, 48)) * k;
  const base = s.h * (0.75 + lane * 0.07);
  const car = {
    lane,
    y: opts.y != null ? opts.y : -len,
    len,
    width,
    speed: opts.speed || base * rand(0.85, 1.25) * (truck ? 0.8 : 1),
    color: truck ? ["#3a3448", "#191523"] : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    truck,
    stopAt: null,
    killer: !!opts.killer,
    honked: false,
    wob: rand(0, 6)
  };
  if (opts.killer) car.color = ["#ff2d55", "#7a0019"];
  s.cars.push(car);
  return car;
}

function crBarrierActive(lane) {
  return crScene.barriers.some(b => b.lane === lane);
}

/* Corta un carril para un cruce seguro: los autos de abajo aceleran y pasan,
   los de arriba frenan detrás de la barrera. */
function crClearLaneForCrossing(lane, killer) {
  const s = crScene;
  const by = crBarrierY();
  const fast = s.lw * 13;
  const queue = s.cars
    .filter(c => c.lane === lane && !c.killer)
    .sort((a, b) => b.y - a.y);

  let k = 0;
  queue.forEach(c => {
    if (c.y + c.len / 2 > by - 4) {
      c.speed = Math.max(c.speed, fast);
      c.stopAt = null;
    } else if (!killer) {
      c.stopAt = by - 14 - c.len / 2 - k * (c.len + 12);
      k++;
    } else {
      c.y = -9999; /* se retira: el auto del choque toma el carril */
    }
  });
  s.cars = s.cars.filter(c => c.y > -9000);
}

function crUpdateScene(dt) {
  const s = crScene;
  const k = crScale();
  const chick = s.chicken;
  s.time += dt;

  /* tráfico ambiente en los carriles sin barrera */
  for (let i = 0; i < crMultipliers.length; i++) {
    if (crBarrierActive(i)) continue;
    if (cr.crashedLane === i && s.chicken.state === "dead") continue;
    if (s.spawnIn[i] == null) s.spawnIn[i] = rand(0, 1.4);
    s.spawnIn[i] -= dt;
    if (s.spawnIn[i] <= 0) {
      const blocked = s.cars.some(c => c.lane === i && c.y < c.len * 1.2);
      if (!blocked) crSpawnCar(i);
      s.spawnIn[i] = rand(0.9, 2.6) / (1 + i * 0.06);
    }
  }

  s.cars.forEach(c => {
    if (c.stopAt != null) {
      const dist = c.stopAt - c.y;
      if (dist <= 0.5) {
        c.y = c.stopAt;
        c.speed = 0;
      } else {
        const v = Math.min(c.speed, Math.sqrt(2 * 2600 * k * dist));
        c.speed = Math.max(0, v);
        c.y += c.speed * dt;
      }
    } else {
      c.y += c.speed * dt;
    }
  });
  s.cars = s.cars.filter(c => c.y - c.len / 2 < s.h + 40);

  /* barreras: animación de caída */
  s.barriers.forEach(b => { b.t = Math.min(1, b.t + dt * 3.2); });

  /* salto del pollito */
  if (chick.hop) {
    const hop = chick.hop;
    hop.t += dt / hop.dur;
    const t = clamp(hop.t, 0, 1);
    if (hop.phase === "crouch") {
      chick.squash = Ease.outQuad(t) * 0.35;
      if (t >= 1) {
        hop.phase = "air";
        hop.t = 0;
        hop.dur = hop.airDur;
        Sound.play("hop");
      }
    } else {
      chick.x = lerp(hop.fromX, hop.toX, Ease.inOutSine(t));
      chick.z = Math.sin(t * Math.PI) * s.lw * 0.42;
      chick.squash = t < 0.5 ? -0.2 * Math.sin(t * Math.PI * 2) : 0;
      if (t >= 1) {
        chick.z = 0;
        chick.squash = 0.28;
        chick.hop = null;
        Sound.play("land");
        if (hop.onLand) hop.onLand();
      }
    }
  } else {
    chick.squash *= Math.pow(0.0008, dt);
    if (chick.state === "idle" || chick.state === "win") {
      chick.z = chick.state === "win" ? Math.abs(Math.sin(s.time * 7)) * s.lw * 0.22 : 0;
    }
  }

  chick.blink -= dt;
  if (chick.blink < -0.12) chick.blink = rand(1.5, 4);

  /* colisión del auto asesino */
  s.cars.forEach(c => {
    if (!c.killer || c.hit) return;
    if (!c.honked && c.y > -c.len * 2) {
      c.honked = true;
      Sound.play("honk");
    }
    if (chick.state !== "dead" && c.y + c.len / 2 >= chick.y - s.lw * 0.12 && !chick.hop) {
      c.hit = true;
      crImpact(c);
    }
  });

  /* partículas */
  s.particles.forEach(p => {
    p.vy += (p.g || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += (p.vr || 0) * dt;
    p.life -= dt;
    if (p.type === "feather") {
      p.vx *= Math.pow(0.3, dt);
      p.vy = Math.min(p.vy, 60 * k);
    }
  });
  s.particles = s.particles.filter(p => p.life > 0);

  s.shake = Math.max(0, s.shake - dt * 2.4);

  /* cámara que sigue al pollito */
  const worldW = crWorldW();
  let target = chick.x - s.w * 0.34;
  target = clamp(target, 0, Math.max(0, worldW - s.w));
  if (worldW < s.w) target = -(s.w - worldW) / 2;
  s.camX = lerp(s.camX, target, 1 - Math.pow(0.02, dt));
}

function crImpact(car) {
  const s = crScene;
  const chick = s.chicken;
  const k = crScale();
  chick.state = "dead";
  chick.deadAt = s.time;
  s.shake = 1;
  car.speed *= 0.55;
  Sound.play("crash");

  const n = Quality.particles(28);
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0);
    const v = rand(80, 320) * k;
    s.particles.push({
      type: i % 3 === 0 ? "spark" : "feather",
      x: chick.x, y: chick.y - 10 * k,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      g: i % 3 === 0 ? 500 * k : 120 * k,
      rot: rand(0, 6), vr: rand(-6, 6),
      life: rand(0.8, 1.8), max: 1.8,
      size: rand(5, 10) * k
    });
  }

  if (s.onImpact) {
    const cb = s.onImpact;
    s.onImpact = null;
    cb();
  }
}

function crCoinBurst(x, y) {
  const s = crScene;
  const k = crScale();
  const n = Quality.particles(18);
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const v = rand(120, 300) * k;
    s.particles.push({ type: "coin", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 700 * k, rot: 0, vr: rand(-10, 10), life: rand(0.7, 1.2), max: 1.2, size: rand(5, 8) * k });
  }
}

/* --- dibujo --- */
function crDrawCar(ctx, c, x) {
  const k = crScale();
  const w = c.width;
  const L = c.len;
  const y = c.y;
  const left = x - w / 2;
  const top = y - L / 2;

  /* haz de luces hacia adelante (abajo) */
  if (Quality.fancy()) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beam = ctx.createLinearGradient(0, y + L / 2, 0, y + L / 2 + L * 1.6);
    beam.addColorStop(0, "rgba(255,240,200,0.32)");
    beam.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.1, y + L / 2 - 2);
    ctx.lineTo(left + w * 0.9, y + L / 2 - 2);
    ctx.lineTo(left + w * 1.35, y + L / 2 + L * 1.6);
    ctx.lineTo(left - w * 0.35, y + L / 2 + L * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, left + 4 * k, top + 6 * k, w, L, 10 * k);
  ctx.fill();

  const body = ctx.createLinearGradient(left, 0, left + w, 0);
  body.addColorStop(0, c.color[1]);
  body.addColorStop(0.35, c.color[0]);
  body.addColorStop(0.65, c.color[0]);
  body.addColorStop(1, c.color[1]);
  ctx.fillStyle = body;
  roundRect(ctx, left, top, w, L, (c.truck ? 6 : 12) * k);
  ctx.fill();

  if (c.truck) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, left + 4 * k, top + 4 * k, w - 8 * k, L * 0.68, 4 * k);
    ctx.fill();
    ctx.fillStyle = c.color[0];
    roundRect(ctx, left + 3 * k, top + L * 0.72, w - 6 * k, L * 0.26, 6 * k);
    ctx.fill();
  }

  /* parabrisas delantero (abajo) y trasero */
  ctx.fillStyle = "rgba(20,30,52,0.9)";
  roundRect(ctx, left + w * 0.14, top + L * (c.truck ? 0.76 : 0.6), w * 0.72, L * 0.15, 4 * k);
  ctx.fill();
  if (!c.truck) {
    ctx.fillStyle = "rgba(20,30,52,0.75)";
    roundRect(ctx, left + w * 0.17, top + L * 0.16, w * 0.66, L * 0.12, 4 * k);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, left + w * 0.2, top + L * 0.32, w * 0.6, L * 0.24, 5 * k);
    ctx.fill();
  }

  /* faros y luces traseras */
  ctx.fillStyle = "#fff6d8";
  ctx.shadowColor = "#fff2c0";
  ctx.shadowBlur = Quality.fancy() ? 12 : 0;
  ctx.fillRect(left + w * 0.1, top + L - 5 * k, w * 0.22, 4 * k);
  ctx.fillRect(left + w * 0.68, top + L - 5 * k, w * 0.22, 4 * k);
  ctx.fillStyle = c.speed < 30 ? "#ff2d55" : "#b3122f";
  ctx.shadowColor = "#ff2d55";
  ctx.fillRect(left + w * 0.1, top + 1, w * 0.2, 4 * k);
  ctx.fillRect(left + w * 0.7, top + 1, w * 0.2, 4 * k);
  ctx.shadowBlur = 0;
}

function crDrawChicken(ctx, x, y, z, squash, state, blink) {
  const k = crScale();
  const sx = 1 + squash;
  const sy = 1 - squash;

  /* sombra */
  const shadowScale = 1 - clamp(z / (crScene.lw * 0.6), 0, 0.6);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18 * k, 20 * k * shadowScale, 7 * k * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - z + 18 * k);
  ctx.scale(sx, sy);
  ctx.translate(0, -18 * k);

  if (state === "dead") {
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#f3e7d3";
    ctx.beginPath();
    ctx.ellipse(0, 12 * k, 26 * k, 9 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1325";
    ctx.lineWidth = 2 * k;
    [[-8, 9], [6, 9]].forEach(([ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo((ex - 3) * k, (ey - 3) * k);
      ctx.lineTo((ex + 3) * k, (ey + 3) * k);
      ctx.moveTo((ex + 3) * k, (ey - 3) * k);
      ctx.lineTo((ex - 3) * k, (ey + 3) * k);
      ctx.stroke();
    });
    ctx.fillStyle = "#ff3b4e";
    ctx.beginPath();
    ctx.ellipse(-20 * k, 8 * k, 5 * k, 3 * k, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const t = crScene.time;
  const legSwing = crScene.chicken.hop ? 0.6 : Math.sin(t * 6) * 0.08;

  /* patas */
  ctx.strokeStyle = "#ffa21c";
  ctx.lineWidth = 3.4 * k;
  ctx.lineCap = "round";
  [-6, 6].forEach((lx, i) => {
    const sw = (i ? 1 : -1) * legSwing;
    ctx.beginPath();
    ctx.moveTo(lx * k, 10 * k);
    ctx.lineTo((lx + sw * 10) * k, 19 * k);
    ctx.stroke();
  });

  /* cuerpo */
  const body = ctx.createRadialGradient(-5 * k, -6 * k, 2 * k, 0, 0, 22 * k);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.7, "#fff1dc");
  body.addColorStop(1, "#e8d2b0");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18 * k, 15 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ala */
  const flap = crScene.chicken.hop ? Math.sin(t * 40) * 0.5 : 0;
  ctx.fillStyle = "#f1dfc0";
  ctx.save();
  ctx.translate(-9 * k, 1 * k);
  ctx.rotate(-0.3 + flap);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* cabeza */
  ctx.fillStyle = "#fffaf2";
  ctx.beginPath();
  ctx.arc(9 * k, -13 * k, 10 * k, 0, Math.PI * 2);
  ctx.fill();

  /* cresta */
  ctx.fillStyle = "#ff3b4e";
  ctx.beginPath();
  ctx.arc(5 * k, -23 * k, 3.6 * k, 0, Math.PI * 2);
  ctx.arc(9.5 * k, -24.5 * k, 4 * k, 0, Math.PI * 2);
  ctx.arc(14 * k, -22.5 * k, 3.4 * k, 0, Math.PI * 2);
  ctx.fill();

  /* pico y barbilla */
  ctx.fillStyle = "#ffb21c";
  ctx.beginPath();
  ctx.moveTo(18 * k, -15 * k);
  ctx.lineTo(26 * k, -12 * k);
  ctx.lineTo(18 * k, -9 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff3b4e";
  ctx.beginPath();
  ctx.ellipse(17 * k, -6 * k, 2.4 * k, 3.6 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  /* ojo */
  if (blink > 0) {
    ctx.fillStyle = "#1a1325";
    ctx.beginPath();
    ctx.arc(12 * k, -15 * k, 2.2 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(12.7 * k, -15.8 * k, 0.8 * k, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#1a1325";
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(10 * k, -15 * k);
    ctx.lineTo(14 * k, -15 * k);
    ctx.stroke();
  }

  ctx.restore();
}

function crDraw() {
  const s = crScene;
  const canvas = crEls.canvas;
  if (!canvas.offsetWidth) return;
  const { ctx, w, h } = fitCanvas(canvas);
  if (w !== s.w || h !== s.h) crLayout();
  const k = crScale();
  const lanes = crMultipliers.length;
  const cy = crChickenY();

  ctx.save();
  if (s.shake > 0) ctx.translate(rand(-1, 1) * s.shake * 10, rand(-1, 1) * s.shake * 8);
  ctx.translate(-s.camX, 0);

  /* fondo general */
  ctx.fillStyle = "#121019";
  ctx.fillRect(s.camX - 20, -20, w + 40, h + 40);

  /* veredas */
  const drawSidewalk = (x0, width, finish) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + width, 0);
    g.addColorStop(0, finish ? "#2b2440" : "#3a3550");
    g.addColorStop(1, finish ? "#3a3060" : "#2c2840");
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, width, h);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const tile = 34 * k;
    for (let yy = 0; yy < h; yy += tile) {
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + width, yy);
      ctx.stroke();
    }
    for (let xx = x0; xx < x0 + width; xx += tile) {
      ctx.beginPath();
      ctx.moveTo(xx, 0);
      ctx.lineTo(xx, h);
      ctx.stroke();
    }
  };
  drawSidewalk(0, s.sw, false);
  const endX = crLaneX(lanes);
  drawSidewalk(endX, s.sw * 1.6, true);

  /* cordones */
  ctx.fillStyle = "#c8c3d8";
  ctx.fillRect(s.sw - 6 * k, 0, 6 * k, h);
  ctx.fillRect(endX, 0, 6 * k, h);

  /* carriles */
  for (let i = 0; i < lanes; i++) {
    const x = crLaneX(i);
    const g = ctx.createLinearGradient(x, 0, x + s.lw, 0);
    g.addColorStop(0, "#1d1a28");
    g.addColorStop(0.5, "#24202f");
    g.addColorStop(1, "#1d1a28");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, s.lw, h);

    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 3 * k;
      ctx.setLineDash([26 * k, 22 * k]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const crossed = i < cr.step && cr.crashedLane !== i;
    const isTarget = cr.active && i === cr.step;
    const crashed = cr.crashedLane === i;

    /* tapa / placa del multiplicador */
    const px = crLaneCenter(i);
    const pr = s.lw * 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 5);
    ctx.fillStyle = crashed ? "rgba(255,45,85,0.25)" : crossed ? "rgba(52,232,158,0.22)" : "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.arc(px, cy, pr * 1.15, 0, Math.PI * 2);
    ctx.fill();

    const plate = ctx.createRadialGradient(px - pr * 0.3, cy - pr * 0.3, 2, px, cy, pr);
    plate.addColorStop(0, crossed ? "#6ff3c0" : crashed ? "#ff6b85" : "#5a556d");
    plate.addColorStop(1, crossed ? "#0d7a4d" : crashed ? "#7a0019" : "#2a2638");
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.arc(px, cy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isTarget ? `rgba(255,196,107,${0.5 + pulse * 0.5})` : "rgba(255,255,255,0.18)";
    ctx.lineWidth = isTarget ? 3 * k : 2 * k;
    ctx.stroke();
    if (isTarget) {
      ctx.save();
      ctx.shadowColor = "#ff9f1c";
      ctx.shadowBlur = 18 * pulse;
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#fff8ea";
    ctx.font = `800 ${Math.max(10, 14 * k)}px Unbounded, Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("x" + crMultipliers[i].toFixed(2), px, cy);
  }

  /* barreras de carriles ya cruzados */
  s.barriers.forEach(b => {
    const x = crLaneX(b.lane);
    const by = crBarrierY() - (1 - Ease.outBack(b.t)) * s.h * 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + 6 * k, by + 6 * k, s.lw - 8 * k, 14 * k);
    const stripes = 6;
    for (let j = 0; j < stripes; j++) {
      ctx.fillStyle = j % 2 ? "#f7f2e6" : "#ff2d55";
      ctx.fillRect(x + 4 * k + (j * (s.lw - 8 * k)) / stripes, by, (s.lw - 8 * k) / stripes, 12 * k);
    }
    const blink = Math.sin(s.time * 8 + b.lane) > 0;
    ctx.fillStyle = blink ? "#ffc46b" : "#7a4a10";
    ctx.shadowColor = "#ff9f1c";
    ctx.shadowBlur = blink ? 14 : 0;
    ctx.beginPath();
    ctx.arc(x + 10 * k, by - 4 * k, 4 * k, 0, Math.PI * 2);
    ctx.arc(x + s.lw - 10 * k, by - 4 * k, 4 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  /* autos */
  s.cars.forEach(c => crDrawCar(ctx, c, crLaneCenter(c.lane)));

  /* meta */
  const fx = endX + s.sw * 0.6;
  ctx.fillStyle = "rgba(240,201,107,0.12)";
  ctx.beginPath();
  ctx.arc(fx, cy, s.lw * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0c96b";
  ctx.font = `900 ${Math.max(11, 15 * k)}px Unbounded, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("META", fx, cy - s.lw * 0.95);
  ctx.strokeStyle = "#f0c96b";
  ctx.lineWidth = 4 * k;
  ctx.beginPath();
  ctx.moveTo(fx - s.lw * 0.5, cy + s.lw * 0.5);
  ctx.lineTo(fx - s.lw * 0.5, cy - s.lw * 0.75);
  ctx.lineTo(fx + s.lw * 0.5, cy - s.lw * 0.75);
  ctx.lineTo(fx + s.lw * 0.5, cy + s.lw * 0.5);
  ctx.stroke();

  /* salida */
  ctx.fillStyle = "rgba(255,159,28,0.85)";
  ctx.font = `800 ${Math.max(10, 12 * k)}px Unbounded, sans-serif`;
  ctx.fillText("SALIDA", s.sw * 0.5, cy - s.lw * 0.8);

  /* farolas: charcos de luz en los bordes */
  if (Quality.fancy()) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i <= lanes; i += 2) {
      const lx = crLaneX(i);
      [h * 0.06, h * 0.96].forEach(ly => {
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, s.lw * 1.3);
        g.addColorStop(0, "rgba(255,190,120,0.16)");
        g.addColorStop(1, "rgba(255,190,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx - s.lw * 1.3, ly - s.lw * 1.3, s.lw * 2.6, s.lw * 2.6);
      });
    }
    ctx.restore();
  }

  /* pollito */
  const ch = s.chicken;
  crDrawChicken(ctx, ch.x, ch.y, ch.z || 0, ch.squash || 0, ch.state, ch.blink);

  /* partículas */
  s.particles.forEach(p => {
    const a = clamp(p.life / (p.max || 1), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.type === "feather") {
      ctx.fillStyle = "#fff8ec";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "coin") {
      ctx.fillStyle = "#f0c96b";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * Math.abs(Math.cos(p.rot * 2)) + 1, p.size, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffc46b";
      ctx.fillRect(-p.size / 4, -p.size / 4, p.size / 2, p.size / 2);
    }
    ctx.restore();
  });

  ctx.restore();

  /* viñeta */
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function crTick(dt) {
  crUpdateScene(dt * simSpeed());
  if (currentScreen === "chicken-screen") crDraw();
  return currentScreen === "chicken-screen" || cr.animating;
}

function crStartLoop() {
  crLayout();
  Loop.add("chicken", crTick);
}

function crSceneReset() {
  const s = crScene;
  s.barriers = [];
  s.particles = [];
  s.cars.forEach(c => { c.stopAt = null; if (c.speed < 1) c.speed = s.h * 0.9; });
  s.cars = s.cars.filter(c => !c.killer);
  s.shake = 0;
  s.onImpact = null;
  s.chicken.lane = -1;
  s.chicken.hop = null;
  s.chicken.state = "idle";
  s.chicken.z = 0;
  s.chicken.squash = 0;
  s.chicken.x = crChickenRestX(-1);
  s.chicken.y = crChickenY();
}

function renderChickenRoad() {
  if (crEls.ladder) {
    if (crEls.ladder.children.length !== crMultipliers.length) {
      crEls.ladder.innerHTML = crMultipliers.map(() => '<div class="road-lane"><span class="lane-multiplier"></span></div>').join("");
    }
    crMultipliers.forEach((multi, index) => {
      const lane = crEls.ladder.children[index];
      lane.className = "road-lane";
      if (cr.crashedLane === index) lane.classList.add("crash");
      else if (index < cr.step) lane.classList.add("safe");
      else if (cr.active && index === cr.step) lane.classList.add("current");
      else lane.classList.add("car");
      lane.firstElementChild.textContent = "x" + multi.toFixed(2);
    });
  }

  crEls.bet.textContent = crMoney(cr.bet);
  crEls.multiplier.textContent = "x" + crCurrentMultiplier().toFixed(2);
  crEls.cash.textContent = crMoney(crCashValue());
  crEls.step.textContent = cr.step + "/" + crMultipliers.length;
}

function updateChickenButtons() {
  crEls.chips.forEach(chip => {
    let value = chipAmount(chip);
    chip.disabled = cr.active || cr.animating || value <= 0 || balance < value;
  });

  crEls.clear.disabled = cr.active || cr.animating || cr.bet === 0;
  crEls.start.disabled = cr.active || cr.animating || cr.bet === 0;
  crEls.go.disabled = !cr.active || cr.animating;
  crEls.cashout.disabled = !cr.active || cr.animating || cr.step === 0;
}

function crPlaceChip(value, chipEl) {
  if (cr.active || cr.animating || value <= 0 || balance < value) return;

  balance -= value;
  cr.bet = round2(cr.bet + value);

  chipFeedback(chipEl, crEls.bet, value);
  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "Apostaste " + crMoney(cr.bet) + ". Tocá Iniciar para jugar.");
}

function crClearBet() {
  if (cr.active || cr.animating) return;

  balance += cr.bet;

  cr.bet = 0;
  cr.step = 0;
  cr.crashedLane = null;
  crSceneReset();

  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "Apuesta limpiada.");
}

function crStartGame() {
  if (cr.active || cr.animating || cr.bet <= 0) return;

  cr.active = true;
  cr.step = 0;
  cr.crashedLane = null;
  crSceneReset();

  renderChickenRoad();
  updateChickenButtons();
  crStartLoop();

  setMessage(crEls.message, "El pollito está listo. Tocá Avanzar para cruzar.");
}

/* Animación de salto hacia el carril objetivo; resuelve al aterrizar. */
function crHopTo(lane) {
  return new Promise(resolve => {
    const s = crScene;
    const ch = s.chicken;
    ch.hop = {
      phase: "crouch",
      t: 0,
      dur: 0.12,
      airDur: 0.42,
      fromX: ch.x,
      toX: crChickenRestX(lane),
      onLand: () => {
        ch.lane = lane;
        resolve();
      }
    };
  });
}

async function crGoForward() {
  if (!cr.active || cr.animating) return;

  let crashChance = crLoseChances[cr.step] || 0.75;
  let crashed = Math.random() < crashChance;
  const lane = cr.step;

  cr.animating = true;
  updateChickenButtons();
  crStartLoop();

  const s = crScene;
  crClearLaneForCrossing(lane, crashed);

  if (crashed) {
    /* el auto se calcula para llegar justo cuando el pollito aterriza */
    const arrive = 0.12 + 0.42 + 0.05; /* en tiempo de simulación */
    const len = 78 * crScale();
    const targetFront = crChickenY() - s.lw * 0.1;
    const y0 = Math.min(-len, targetFront - s.lw * 14 * arrive);
    const speed = (targetFront - (y0 + len / 2)) / arrive;
    crSpawnCar(lane, { killer: true, y: y0, speed });
    Sound.play("car");

    const impact = new Promise(resolve => { s.onImpact = resolve; });
    await crHopTo(lane);
    await impact;
    await sleep(T(450));
    cr.animating = false;
    crCrash();
    return;
  }

  /* cruce seguro: cae la barrera y los autos de arriba frenan */
  s.barriers.push({ lane, t: 0 });
  Sound.play("barrier");
  await crHopTo(lane);
  crCoinBurst(crLaneCenter(lane), crChickenY());
  Sound.play("coin");

  cr.step++;
  cr.animating = false;

  renderChickenRoad();
  updateChickenButtons();
  flashValue(crEls.multiplier);

  if (cr.step >= crMultipliers.length) {
    cr.animating = true;
    updateChickenButtons();
    await crHopTo(crMultipliers.length);
    cr.animating = false;
    crCashout(true);
    return;
  }

  setMessage(
    crEls.message,
    "Cruzaste bien. Multiplicador actual: x" + crCurrentMultiplier().toFixed(2) + ". Podés seguir o cobrar.",
    "win"
  );
}

function crCrash() {
  let lost = cr.bet;
  let reached = cr.step;

  cr.crashedLane = cr.step;
  cr.active = false;
  cr.bet = 0;

  renderChickenRoad();
  updateChickenButtons();

  Stats.record("chicken", lost, 0, "Atropellado en el carril " + (reached + 1));

  setMessage(crEls.message, "💥 Pasó un auto. Perdiste " + crMoney(lost) + ".", "lose");
  later(() => showWinAnimation("GAME OVER", lost, "lose"), 1000);
}

function crCashout(perfect = false) {
  if (!cr.active || cr.animating) return;

  let payout  = crCashValue();
  let crProfit = payout - cr.bet; // capturar antes del reset
  let betPlaced = cr.bet;

  balance += payout;

  cr.active = false;
  cr.bet = 0;
  cr.crashedLane = null;

  crScene.chicken.state = "win";
  crCoinBurst(crScene.chicken.x, crScene.chicken.y - 20);
  Sound.play("cash");
  FX.flyChip(crEls.cashout, walletEl, payout);

  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  Stats.record("chicken", betPlaced, payout, cr.step + " cruces · x" + crCurrentMultiplier().toFixed(2));

  if (perfect) {
    setMessage(crEls.message, "¡Cruzaste todo! Cobraste " + crMoney(payout) + ".", "win");
  } else {
    setMessage(crEls.message, "Cobraste " + crMoney(payout) + ". Te salvaste a tiempo.", "win");
  }

  const crWType  = crProfit >= 300 ? "bigwin" : "win";
  const crWTitle = crProfit >= 300 ? "BIG WIN" : "WIN";
  later(() => showWinAnimation(crWTitle, Math.round(crProfit), crWType), 1000);
}

function crReset() {
  cr.bet = 0;
  cr.active = false;
  cr.step = 0;
  cr.crashedLane = null;
  cr.animating = false;
  crScene.cars = [];
  crScene.spawnIn = [];
  crSceneReset();
  renderChickenRoad();
  updateChickenButtons();
  setMessage(crEls.message, "Elegí fichas y tocá Iniciar.");
  if (currentScreen === "chicken-screen") crStartLoop();
}

crEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    crPlaceChip(chipAmount(chip), chip);
  });
});

crEls.clear.addEventListener("click", crClearBet);
crEls.start.addEventListener("click", crStartGame);
crEls.go.addEventListener("click", crGoForward);
crEls.cashout.addEventListener("click", () => crCashout(false));

screenHooks["chicken-screen"] = {
  show() {
    crLayout();
    if (!crScene.chicken.hop) crScene.chicken.x = crChickenRestX(crScene.chicken.lane);
    crStartLoop();
  }
};

/* ============================================================
   15. PLINKO
   ------------------------------------------------------------
   Cada bola sortea sus decisiones izquierda/derecha (50/50,
   igual que antes) y su recorrido se arma con parábolas reales
   entre los clavos que toca, terminando exactamente en el
   casillero de su multiplicador.
   ============================================================ */
const pl = {
  bet: 0,
  rows: 10,
  risk: "medium",
  balls: 1,
  dropping: false,
  lastMultiplier: 0,
  lastWin: 0,
  hitSlots: [],
  history: []
};

const plEls = {
  message: document.getElementById("pl-message"),
  bet: document.getElementById("pl-bet"),
  risk: document.getElementById("pl-risk"),
  rows: document.getElementById("pl-rows"),
  balls: document.getElementById("pl-balls"),
  riskLabel: document.getElementById("pl-risk-label"),
  rowsLabel: document.getElementById("pl-rows-label"),
  ballsLabel: document.getElementById("pl-balls-label"),
  perBall: document.getElementById("pl-per-ball"),
  lastMultiplier: document.getElementById("pl-last-multiplier"),
  lastWin: document.getElementById("pl-last-win"),
  history: document.getElementById("pl-history"),
  stage: document.getElementById("plinko-stage"),
  canvas: document.getElementById("pl-canvas"),
  chips: document.querySelectorAll(".pl-chip"),
  clear: document.getElementById("pl-clear"),
  drop: document.getElementById("pl-drop")
};

const plinkoTables = {
  8: {
    low: [5.6, 2.1, 1.1, 0.7, 0.5, 0.7, 1.1, 2.1, 5.6],
    medium: [9, 3, 1.6, 0.9, 0.5, 0.9, 1.6, 3, 9],
    high: [16, 5, 2, 0.5, 0.2, 0.5, 2, 5, 16]
  },
  10: {
    low: [8, 3, 1.5, 1.1, 0.8, 0.5, 0.8, 1.1, 1.5, 3, 8],
    medium: [12, 5, 2, 1.4, 0.9, 0.5, 0.9, 1.4, 2, 5, 12],
    high: [20, 8, 3, 1.3, 0.6, 0.2, 0.6, 1.3, 3, 8, 20]
  },
  12: {
    low: [10, 4, 2, 1.5, 1.1, 0.8, 0.5, 0.8, 1.1, 1.5, 2, 4, 10],
    medium: [14, 6, 3, 1.8, 1.2, 0.7, 0.4, 0.7, 1.2, 1.8, 3, 6, 14],
    high: [18, 10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10, 18]
  }
};

const plScene = {
  geo: null,
  balls: [],
  pegGlow: new Map(),
  slotBump: [],
  texts: [],
  sparks: []
};

function getPlinkoMultipliers() {
  return plinkoTables[pl.rows][pl.risk];
}

function getRiskLabel(value) {
  if (value === "low") return "Riesgo bajo";
  if (value === "high") return "Riesgo alto";
  return "Riesgo medio";
}

function updatePlinkoInfo() {
  plEls.bet.textContent = plMoney(pl.bet);
  plEls.riskLabel.textContent = getRiskLabel(pl.risk);
  plEls.rowsLabel.textContent = String(pl.rows);
  plEls.ballsLabel.textContent = String(pl.balls);
  plEls.perBall.textContent = plMoney(pl.bet / Math.max(1, pl.balls));
  plEls.lastMultiplier.textContent = "x" + pl.lastMultiplier.toFixed(2);
  plEls.lastWin.textContent = plMoney(pl.lastWin);
}

function updatePlinkoButtons() {
  plEls.chips.forEach(chip => {
    let value = chipAmount(chip);
    chip.disabled = pl.dropping || value <= 0 || balance < value;
  });

  plEls.clear.disabled = pl.dropping || pl.bet === 0;
  plEls.drop.disabled = pl.dropping || pl.bet === 0;

  plEls.risk.disabled = pl.dropping;
  plEls.rows.disabled = pl.dropping;
  plEls.balls.disabled = pl.dropping;

  plEls.drop.textContent = pl.balls > 1 ? "Soltar " + pl.balls + " bolas" : "Soltar bola";
}

function getSlotClass(multiplier) {
  if (multiplier >= 3) return "high";
  if (multiplier >= 1) return "mid";
  return "low";
}

function getPlinkoGeometry() {
  const canvas = plEls.canvas;
  const rect = canvas ? canvas.getBoundingClientRect() : { width: 760, height: 660 };
  const width = rect.width || 760;
  const height = rect.height || 660;

  const rows = pl.rows;
  const slotCount = rows + 1;

  const topPadding = height * 0.08 + 10;
  const bottomPadding = Math.max(56, height * 0.13);
  const usableHeight = height - topPadding - bottomPadding;

  const centerX = width / 2;
  const boardWidth = Math.min(width * 0.94, width - 24);

  const rowGap = usableHeight / rows;
  const slotStep = Math.min(boardWidth / (rows + 2), rowGap * 1.25);
  const startSlotX = centerX - (rows / 2) * slotStep;
  const slotWidth = slotStep * 0.9;
  const pegR = clamp(slotStep * 0.085, 2.4, 6);
  const ballR = clamp(slotStep * 0.19, 4, 10.5);
  const slotTop = topPadding + rows * rowGap - rowGap * 0.15;
  const slotH = Math.min(bottomPadding * 0.62, 44);

  return {
    width,
    height,
    rows,
    slotCount,
    topPadding,
    bottomPadding,
    usableHeight,
    centerX,
    boardWidth,
    slotStep,
    startSlotX,
    rowGap,
    slotWidth,
    pegR,
    ballR,
    slotTop,
    slotH
  };
}

function plPegPos(geo, row, j) {
  return {
    x: geo.centerX + (j - (row + 2) / 2) * geo.slotStep,
    y: geo.topPadding + geo.rowGap * row
  };
}

function plSlotCenter(geo, i) {
  return geo.startSlotX + i * geo.slotStep;
}

function renderPlinkoBoard() {
  if (!plEls.stage || !plEls.canvas) return;
  plScene.geo = getPlinkoGeometry();
  plScene.slotBump = new Array(pl.rows + 1).fill(0);
  plScene.balls.forEach(b => plBuildSegments(b, plScene.geo));
  plDraw(performance.now());
  updatePlinkoInfo();
}

function plDraw(now) {
  const canvas = plEls.canvas;
  if (!canvas.offsetWidth) return;
  const { ctx, w, h } = fitCanvas(canvas);
  let geo = plScene.geo;
  if (!geo || Math.abs(geo.width - w) > 1 || Math.abs(geo.height - h) > 1) {
    geo = plScene.geo = getPlinkoGeometry();
    plScene.slotBump = new Array(pl.rows + 1).fill(0);
    plScene.balls.forEach(b => plBuildSegments(b, geo));
  }
  const multipliers = getPlinkoMultipliers();

  ctx.clearRect(0, 0, w, h);

  /* luz cenital */
  const top = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.9);
  top.addColorStop(0, "rgba(196,120,255,0.16)");
  top.addColorStop(1, "rgba(196,120,255,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);

  /* embudo de entrada */
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(geo.centerX - geo.slotStep * 0.9, 0);
  ctx.lineTo(geo.centerX + geo.slotStep * 0.9, 0);
  ctx.lineTo(geo.centerX + geo.slotStep * 0.35, geo.topPadding - geo.rowGap * 0.7);
  ctx.lineTo(geo.centerX - geo.slotStep * 0.35, geo.topPadding - geo.rowGap * 0.7);
  ctx.closePath();
  ctx.fill();

  /* clavos */
  for (let row = 0; row < geo.rows; row++) {
    for (let j = 0; j < row + 3; j++) {
      const p = plPegPos(geo, row, j);
      const key = row * 100 + j;
      const glow = plScene.pegGlow.get(key) || 0;
      if (glow > 0.02) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, geo.pegR * 5);
        g.addColorStop(0, `rgba(255,154,208,${0.75 * glow})`);
        g.addColorStop(1, "rgba(255,61,154,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, geo.pegR * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      const pg = ctx.createRadialGradient(p.x - geo.pegR * 0.35, p.y - geo.pegR * 0.4, 0.5, p.x, p.y, geo.pegR);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(0.5, glow > 0.05 ? "#ffd1ea" : "#d9c8f5");
      pg.addColorStop(1, glow > 0.05 ? "#ff3d9a" : "#7a68a8");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, geo.pegR * (1 + glow * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* casilleros */
  for (let i = 0; i < geo.slotCount; i++) {
    const m = multipliers[i];
    const cls = getSlotClass(m);
    const cx = plSlotCenter(geo, i);
    const bump = plScene.slotBump[i] || 0;
    const y = geo.slotTop + bump * 6;
    const sw = geo.slotWidth;
    const colors = cls === "high" ? ["#ff5fae", "#a3155c"] : cls === "mid" ? ["#a77bff", "#4f2bb0"] : ["#6d74ff", "#2b2e8a"];
    if (bump > 0.02) {
      ctx.save();
      ctx.shadowColor = colors[0];
      ctx.shadowBlur = 24 * bump;
    }
    const g = ctx.createLinearGradient(0, y, 0, y + geo.slotH);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    roundRect(ctx, cx - sw / 2, y, sw, geo.slotH, Math.min(8, sw * 0.2));
    ctx.fill();
    if (bump > 0.02) ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(ctx, cx - sw / 2 + 2, y + 2, sw - 4, geo.slotH * 0.35, Math.min(6, sw * 0.15));
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${clamp(sw * 0.3, 8, 14)}px Manrope, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((m >= 10 ? m : m) + "x", cx, y + geo.slotH * 0.55);
  }

  /* bolas con estela */
  plScene.balls.forEach(b => {
    if (b.done && b.fade <= 0) return;
    const alpha = b.done ? clamp(b.fade, 0, 1) : 1;
    if (Quality.fancy() && b.trail.length > 1) {
      for (let i = 1; i < b.trail.length; i++) {
        const t = i / b.trail.length;
        ctx.strokeStyle = `rgba(255,120,190,${0.28 * t * alpha})`;
        ctx.lineWidth = geo.ballR * 1.4 * t;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
        ctx.lineTo(b.trail[i].x, b.trail[i].y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(b.x - geo.ballR * 0.4, b.y - geo.ballR * 0.45, 0.5, b.x, b.y, geo.ballR);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#ffb3db");
    g.addColorStop(1, "#ff2d8a");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,61,154,0.9)";
    ctx.shadowBlur = Quality.fancy() ? 14 : 0;
    ctx.beginPath();
    ctx.arc(b.x, b.y, geo.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  /* chispas de impacto */
  plScene.sparks.forEach(s => {
    ctx.globalAlpha = clamp(s.life / s.max, 0, 1);
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  /* textos flotantes de multiplicador */
  plScene.texts.forEach(t => {
    const a = clamp(t.life / t.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.font = `800 ${clamp(geo.slotStep * 0.36, 11, 18)}px Unbounded, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.globalAlpha = 1;
}

/* Construye la trayectoria parabólica de una bola a partir de sus decisiones. */
function plBuildSegments(ball, geo) {
  const segs = [];
  const g = geo.rowGap * 58;
  const contact = (row, k, side) => {
    const peg = plPegPos(geo, row, k + 1);
    const off = (geo.pegR + geo.ballR) * (0.28 * side + ball.jit[row] * 0.18);
    return { x: peg.x + off, y: peg.y - (geo.pegR + geo.ballR) * 0.95, peg: row * 100 + k + 1, row };
  };

  let k = 0;
  const first = contact(0, 0, ball.decisions[0] ? 1 : -1);
  const start = { x: geo.centerX + ball.jit[0] * geo.pegR, y: geo.topPadding - geo.rowGap * 1.1 };
  segs.push(plSegment(start, first, 0, g, null));

  for (let row = 0; row < geo.rows; row++) {
    const goRight = ball.decisions[row];
    const from = contact(row, k, goRight ? 1 : -1);
    if (goRight) k++;
    let to;
    if (row + 1 < geo.rows) {
      to = contact(row + 1, k, ball.decisions[row + 1] ? 1 : -1);
    } else {
      to = { x: plSlotCenter(geo, k) + ball.jit[row] * geo.slotWidth * 0.12, y: geo.slotTop + geo.slotH * 0.45, slot: k };
    }
    const apex = geo.rowGap * (0.16 + Math.abs(ball.jit[(row + 3) % ball.jit.length]) * 0.14) * (1 - row / geo.rows * 0.35);
    segs.push(plSegment(from, to, apex, g, from.peg, row));
  }

  ball.segs = segs;
  ball.slotIndex = k;
}

function plSegment(from, to, apex, g, pegHit, row = 0) {
  const vy0 = -Math.sqrt(2 * g * Math.max(0, apex));
  const dy = to.y - from.y;
  const t = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * dy)) / g;
  return { x0: from.x, y0: from.y, x1: to.x, y1: to.y, vy0, g, t, pegHit, row, slot: to.slot };
}

function plPlaceChip(value, chipEl) {
  if (pl.dropping || value <= 0 || balance < value) return;

  balance -= value;
  pl.bet = round2(pl.bet + value);

  chipFeedback(chipEl, plEls.bet, value);
  updateBalance();
  updatePlinkoInfo();
  updatePlinkoButtons();

  setMessage(plEls.message, "Apostaste " + plMoney(pl.bet) + ". Ya podés soltar.");
}

function plClearBet() {
  if (pl.dropping) return;

  balance += pl.bet;
  pl.bet = 0;

  updateBalance();
  updatePlinkoInfo();
  updatePlinkoButtons();

  setMessage(plEls.message, "Apuesta limpiada.");
}

/* Sortea el recorrido de una bola: una decisión 50/50 por fila (sin cambios). */
function getPlinkoPath() {
  const decisions = [];
  let rights = 0;

  for (let row = 0; row < pl.rows; row++) {
    let goRight = Math.random() < 0.5;
    if (goRight) rights++;
    decisions.push(goRight);
  }

  return {
    decisions,
    slotIndex: rights
  };
}

function plTick(dt, now) {
  const step = dt * simSpeed();
  const geo = plScene.geo || getPlinkoGeometry();

  plScene.balls.forEach(b => {
    if (b.done) {
      b.fade -= step * 2.5;
      return;
    }
    if (b.wait > 0) {
      b.wait -= step;
      const s0 = b.segs[0];
      b.x = s0.x0;
      b.y = s0.y0;
      return;
    }

    b.segT += step;
    let seg = b.segs[b.seg];
    while (seg && b.segT >= seg.t) {
      b.segT -= seg.t;
      /* impacto al final del segmento: clavo siguiente o casillero */
      const next = b.segs[b.seg + 1];
      if (next && next.pegHit != null) {
        plScene.pegGlow.set(next.pegHit, 1);
        if (Math.random() < 0.7 || plScene.balls.length < 4) Sound.play("peg", next.row);
      }
      b.seg++;
      seg = b.segs[b.seg];
      if (!seg) {
        plLandBall(b, geo);
        break;
      }
    }
    if (seg) {
      const t = b.segT;
      const u = t / seg.t;
      b.x = lerp(seg.x0, seg.x1, u);
      b.y = seg.y0 + seg.vy0 * t + 0.5 * seg.g * t * t;
    }
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 8) b.trail.shift();
  });

  plScene.pegGlow.forEach((v, key) => {
    const nv = v - step * 2.2;
    if (nv <= 0) plScene.pegGlow.delete(key);
    else plScene.pegGlow.set(key, nv);
  });
  plScene.slotBump = plScene.slotBump.map(v => Math.max(0, v - step * 2.4));
  plScene.texts.forEach(t => { t.life -= step; t.y -= step * 40; });
  plScene.texts = plScene.texts.filter(t => t.life > 0);
  plScene.sparks.forEach(s => { s.life -= step; s.x += s.vx * step; s.y += s.vy * step; s.vy += 420 * step; });
  plScene.sparks = plScene.sparks.filter(s => s.life > 0);
  plScene.balls = plScene.balls.filter(b => !b.done || b.fade > 0);

  if (currentScreen === "plinko-screen") plDraw(now);

  const busy = plScene.balls.length || plScene.texts.length || plScene.sparks.length || plScene.pegGlow.size || plScene.slotBump.some(v => v > 0);
  return !!busy;
}

function plLandBall(b, geo) {
  b.done = true;
  b.fade = 1;
  const slot = b.slotIndex;
  plScene.slotBump[slot] = 1;
  const m = getPlinkoMultipliers()[slot];
  const cx = plSlotCenter(geo, slot);
  plScene.texts.push({ text: m + "x", x: cx, y: geo.slotTop - 8, life: 1, max: 1, color: m >= 3 ? "#ff9ad0" : m >= 1 ? "#d3c1ff" : "#a5a8f5" });
  const n = Quality.particles(10);
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
    const v = rand(60, 180);
    plScene.sparks.push({ x: cx, y: geo.slotTop, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.2, 2.6), life: rand(0.4, 0.8), max: 0.8, c: m >= 3 ? "#ff9ad0" : "#d3c1ff" });
  }
  Sound.play("slot", m);
  plPushHistory(m);
  if (b.resolve) b.resolve();
}

function plPushHistory(m) {
  pl.history.unshift(m);
  if (pl.history.length > 16) pl.history.length = 16;
  plEls.history.innerHTML = pl.history.map(v => `<span class="${getSlotClass(v)}">${v}x</span>`).join("");
}

function animateBall(drop, delay = 0) {
  return new Promise(resolve => {
    const geo = plScene.geo || getPlinkoGeometry();
    const ball = {
      decisions: drop.decisions,
      jit: drop.decisions.map(() => rand(-1, 1)),
      seg: 0,
      segT: 0,
      wait: delay / 1000,
      x: geo.centerX,
      y: -20,
      trail: [],
      done: false,
      fade: 1,
      resolve
    };
    plBuildSegments(ball, geo);
    plScene.balls.push(ball);
    Loop.add("plinko", plTick);
  });
}

async function plDropBall() {
  if (pl.dropping || pl.bet <= 0) return;

  pl.dropping = true;
  updatePlinkoButtons();
  plScene.geo = getPlinkoGeometry();

  let totalBet = pl.bet;
  let ballCount = pl.balls;
  let betPerBall = totalBet / ballCount;

  let multipliers = getPlinkoMultipliers();
  let drops = [];
  let results = [];

  setMessage(
    plEls.message,
    "Soltando " + ballCount + " bola/s de " + plMoney(betPerBall) + " cada una..."
  );

  for (let i = 0; i < ballCount; i++) {
    let drop = getPlinkoPath();
    let multiplier = multipliers[drop.slotIndex];
    let payout = Number((betPerBall * multiplier).toFixed(2));

    results.push({
      multiplier,
      payout
    });

    drops.push(animateBall(drop, i * 160));
  }

  await Promise.all(drops);
  await sleep(T(250));

  let totalPayout = results.reduce((sum, result) => {
    return sum + result.payout;
  }, 0);

  totalPayout = Number(totalPayout.toFixed(2));

  let effectiveMultiplier = totalPayout / totalBet;

  balance = Number((balance + totalPayout).toFixed(2));

  pl.lastMultiplier = Number(effectiveMultiplier.toFixed(2));
  pl.lastWin = totalPayout;

  pl.bet = 0;
  pl.dropping = false;

  updateBalance();
  updatePlinkoInfo();
  updatePlinkoButtons();
  flashValue(plEls.lastWin);

  Stats.record("plinko", totalBet, totalPayout, ballCount + " bola" + (ballCount === 1 ? "" : "s") + " · x" + pl.lastMultiplier.toFixed(2));

  if (totalPayout > totalBet) {
    let plProfit = totalPayout - totalBet;
    Sound.play("cash");
    setMessage(
      plEls.message,
      "Ganaste. Multiplicador efectivo x" + pl.lastMultiplier.toFixed(2) + ". Cobraste " + plMoney(totalPayout) + ".",
      "win"
    );
    const plWType  = plProfit >= 300 ? "bigwin" : "win";
    const plWTitle = plProfit >= 300 ? "BIG WIN" : "WIN";
    later(() => showWinAnimation(plWTitle, Math.round(plProfit), plWType), 1000);
  } else if (totalPayout < totalBet) {
    let plLost = totalBet - totalPayout;
    setMessage(
      plEls.message,
      "Perdiste parte de la apuesta. Multiplicador efectivo x" + pl.lastMultiplier.toFixed(2) + ". Cobraste " + plMoney(totalPayout) + ".",
      "lose"
    );
    later(() => showWinAnimation("GAME OVER", Math.round(plLost), "lose"), 1000);
  } else {
    setMessage(
      plEls.message,
      "Empataste. Recuperaste " + plMoney(totalPayout) + ".",
      "push"
    );
  }
}

function plReset() {
  pl.bet = 0;
  pl.dropping = false;
  pl.lastMultiplier = 0;
  pl.lastWin = 0;
  plScene.balls = [];
  plScene.texts = [];
  plScene.sparks = [];
  plScene.pegGlow.clear();
  renderPlinkoBoard();
  updatePlinkoInfo();
  updatePlinkoButtons();
  setMessage(plEls.message, "Elegí fichas, configurá el tablero y soltá la bola.");
}

plEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    const amount = chip.dataset.allin === "true"
      ? balance
      : Number(chip.dataset.value);

    plPlaceChip(amount, chip);
  });
});

plEls.clear.addEventListener("click", plClearBet);
plEls.drop.addEventListener("click", plDropBall);

plEls.risk.addEventListener("change", () => {
  pl.risk = plEls.risk.value;
  renderPlinkoBoard();
  updatePlinkoInfo();
});

plEls.rows.addEventListener("change", () => {
  pl.rows = Number(plEls.rows.value);
  renderPlinkoBoard();
  updatePlinkoInfo();
});

plEls.balls.addEventListener("change", () => {
  pl.balls = Number(plEls.balls.value);
  updatePlinkoInfo();
  updatePlinkoButtons();
});

screenHooks["plinko-screen"] = {
  show() {
    renderPlinkoBoard();
  }
};

/* ============================================================
   16. AVIATOR
   ------------------------------------------------------------
   Mecánica intacta: multiplicador = e^(0.00028·ms), crash
   sorteado al despegar y cobro manual (o automático opcional).
   Todo el movimiento se dibuja en canvas desde un único
   lugar, sin transformaciones CSS que compitan.
   ============================================================ */
const av = {
  bet: 0,
  active: false,
  cashedOut: false,
  multiplier: 1,
  crashAt: 0,
  lastCrash: 0,
  lastWin: 0,
  cashedMultiplier: 0,
  startedAt: 0,
  growthRate: 0.00028,
  raf: null,
  history: Store.get("avHistory", []),
  auto: Object.assign({ enabled: false, value: 2 }, Store.get("avAuto", {}))
};

const avEls = {
  message: document.getElementById("av-message"),
  bet: document.getElementById("av-bet"),
  multiplier: document.getElementById("av-multiplier"),
  cash: document.getElementById("av-cash"),
  lastCrash: document.getElementById("av-last-crash"),
  lastWin: document.getElementById("av-last-win"),
  multiplierBig: document.getElementById("av-multiplier-big"),
  status: document.getElementById("av-status"),
  stage: document.getElementById("av-stage"),
  canvas: document.getElementById("av-canvas"),
  history: document.getElementById("av-history"),
  autoEnabled: document.getElementById("av-auto-enabled"),
  autoValue: document.getElementById("av-auto-value"),
  chips: document.querySelectorAll(".av-chip"),
  clear: document.getElementById("av-clear"),
  start: document.getElementById("av-start"),
  cashout: document.getElementById("av-cashout")
};

const avScene = {
  w: 0, h: 0,
  tMax: 8, mMax: 2,
  stars: [],
  smoke: [],
  sparks: [],
  hills: [],
  plane: { x: 0, y: 0, angle: 0 },
  flyAway: null,
  cashMark: null,
  elapsed: 0,
  time: 0,
  lastFrame: 0,
  crashedAt: 0
};

function avGenerateCrash() {
  const r = Math.random();

  if (r < 0.28) return Number((1 + Math.random() * 0.35).toFixed(2));
  if (r < 0.56) return Number((1.35 + Math.random() * 0.85).toFixed(2));
  if (r < 0.78) return Number((2.2 + Math.random() * 1.8).toFixed(2));
  if (r < 0.92) return Number((4 + Math.random() * 4).toFixed(2));
  if (r < 0.985) return Number((8 + Math.random() * 12).toFixed(2));

  return Number((20 + Math.random() * 25).toFixed(2));
}

function avCashNow() {
  if (!av.active) return 0;
  return Number((av.bet * av.multiplier).toFixed(2));
}

function updateAviatorInfo() {
  avEls.bet.textContent = avMoney(av.bet);
  avEls.multiplier.textContent = av.multiplier.toFixed(2) + "x";
  avEls.cash.textContent = avMoney(av.cashedOut ? 0 : avCashNow());
  avEls.lastCrash.textContent = av.lastCrash > 0 ? av.lastCrash.toFixed(2) + "x" : "-";
  avEls.lastWin.textContent = avMoney(av.lastWin);
  avEls.multiplierBig.textContent = av.multiplier.toFixed(2) + "x";

  const big = avEls.multiplierBig;
  if (av.active) {
    big.classList.remove("crashed");
    big.classList.toggle("cashed-out", av.cashedOut);
    big.classList.toggle("tier-2", av.multiplier >= 2 && av.multiplier < 5);
    big.classList.toggle("tier-3", av.multiplier >= 5 && av.multiplier < 10);
    big.classList.toggle("tier-4", av.multiplier >= 10);
  }

  avEls.cashout.textContent = av.active && !av.cashedOut ? "Cobrar " + avMoney(avCashNow()) : "Cobrar";
}

function updateAviatorStatus(text, cls = "") {
  avEls.status.textContent = text;
  avEls.status.className = "aviator-status-tag" + (cls ? " " + cls : "");
}

function updateAviatorButtons() {
  avEls.chips.forEach(chip => {
    let value = chip.dataset.allin === "true" ? balance : Number(chip.dataset.value);
    chip.disabled = av.active || balance <= 0 || balance < value;
  });

  avEls.clear.disabled = av.active || av.bet === 0;
  avEls.start.disabled = av.active || av.bet === 0;
  avEls.cashout.disabled = !av.active || av.cashedOut;
}

function renderAviatorHistory() {
  avEls.history.innerHTML = av.history.map(v => `<span class="${v < 2 ? "lo" : v < 10 ? "md" : "hi"}">${v.toFixed(2)}x</span>`).join("");
}

/* --- escena --- */
function avLayout() {
  const { w, h } = fitCanvas(avEls.canvas);
  avScene.w = w;
  avScene.h = h;
  const target = Quality.particles(90);
  avScene.stars = [];
  for (let i = 0; i < target; i++) {
    avScene.stars.push({ x: rand(0, w), y: rand(0, h * 0.85), z: rand(0.2, 1), tw: rand(0, 6) });
  }
  avScene.hills = [];
  for (let layer = 0; layer < 2; layer++) {
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(rand(0.1, 1));
    avScene.hills.push(pts);
  }
}

function avPad() {
  const w = avScene.w;
  return { l: w < 500 ? 36 : 52, r: 28, t: 26, b: 34 };
}

function avMapX(t) {
  const p = avPad();
  return p.l + (t / avScene.tMax) * (avScene.w - p.l - p.r);
}

function avMapY(m) {
  const p = avPad();
  return avScene.h - p.b - ((m - 1) / (avScene.mMax - 1)) * (avScene.h - p.t - p.b) * 0.82;
}

function avNiceStep(range) {
  const raw = range / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

function drawPlane(ctx, x, y, angle, s, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);

  /* llama del escape */
  const flick = 0.75 + Math.sin(t * 60) * 0.15 + Math.random() * 0.1;
  const flame = ctx.createLinearGradient(-46, 0, -26, 0);
  flame.addColorStop(0, "rgba(255,61,90,0)");
  flame.addColorStop(0.6, "rgba(255,140,90,0.7)");
  flame.addColorStop(1, "rgba(255,240,200,0.95)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-26, -3.5);
  ctx.quadraticCurveTo(-38 - 10 * flick, 0, -26, 3.5);
  ctx.closePath();
  ctx.fill();

  /* ala trasera (lejana) */
  ctx.fillStyle = "#8f1430";
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-16, 15);
  ctx.lineTo(-9, 15);
  ctx.lineTo(10, 3);
  ctx.closePath();
  ctx.fill();

  /* fuselaje */
  const body = ctx.createLinearGradient(0, -7, 0, 7);
  body.addColorStop(0, "#ff8fa2");
  body.addColorStop(0.45, "#ff3d5a");
  body.addColorStop(1, "#9c1033");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-28, -2.5);
  ctx.quadraticCurveTo(-10, -7.5, 18, -6);
  ctx.quadraticCurveTo(32, -4.5, 36, 0);
  ctx.quadraticCurveTo(32, 5, 18, 6);
  ctx.quadraticCurveTo(-10, 7, -28, 2.5);
  ctx.closePath();
  ctx.fill();

  /* franja */
  ctx.fillStyle = "rgba(255,241,196,0.85)";
  ctx.fillRect(-18, -1, 34, 2);

  /* cabina */
  const glass = ctx.createLinearGradient(10, -8, 24, -2);
  glass.addColorStop(0, "#c9fbff");
  glass.addColorStop(1, "#1a6f86");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(8, -5.5);
  ctx.quadraticCurveTo(16, -12, 25, -4.2);
  ctx.closePath();
  ctx.fill();

  /* timón de cola */
  ctx.fillStyle = "#ff5c75";
  ctx.beginPath();
  ctx.moveTo(-26, -2);
  ctx.lineTo(-32, -15);
  ctx.lineTo(-24, -15);
  ctx.lineTo(-16, -3);
  ctx.closePath();
  ctx.fill();

  /* ala delantera */
  const wing = ctx.createLinearGradient(0, -4, 0, -22);
  wing.addColorStop(0, "#ffd2d9");
  wing.addColorStop(1, "#ff8fa2");
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(-18, -21);
  ctx.lineTo(-10, -21);
  ctx.lineTo(12, -3);
  ctx.closePath();
  ctx.fill();

  /* hélice */
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(37.5, 0, 1.6, 10 + Math.sin(t * 80) * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1a2e";
  ctx.beginPath();
  ctx.arc(37, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();

  /* luces de navegación */
  if (Math.sin(t * 9) > 0.2) {
    ctx.fillStyle = "#2de2e6";
    ctx.shadowColor = "#2de2e6";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-17, -21, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function renderAviatorGraph() {
  const canvas = avEls.canvas;
  if (!canvas || !canvas.offsetWidth) return;
  const { ctx, w, h } = fitCanvas(canvas);
  if (w !== avScene.w || h !== avScene.h) avLayout();

  const now = performance.now();
  const dt = avScene.lastFrame ? Math.min(0.05, (now - avScene.lastFrame) / 1000) : 0.016;
  avScene.lastFrame = now;
  avScene.time += dt;
  const S = avScene;
  const p = avPad();
  const flying = av.active;
  const m = Math.max(av.multiplier, 1);

  /* escala de cámara suavizada */
  const elapsed = flying ? S.elapsed : S.flyAway ? S.elapsed : 0;
  const tTarget = Math.max(8, elapsed * 1.2);
  const mTarget = Math.max(2, m * 1.25);
  if (flying || S.flyAway) {
    S.tMax = lerp(S.tMax, tTarget, 1 - Math.pow(0.001, dt));
    S.mMax = lerp(S.mMax, mTarget, 1 - Math.pow(0.001, dt));
  } else {
    S.tMax = lerp(S.tMax, 8, 1 - Math.pow(0.05, dt));
    S.mMax = lerp(S.mMax, 2, 1 - Math.pow(0.05, dt));
  }

  /* cielo */
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0a0614");
  sky.addColorStop(0.55, "#170a22");
  sky.addColorStop(1, flying && m > 5 ? "#3a0d2a" : "#260c22");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const speedFactor = flying ? 0.3 + Math.log(m) * 1.2 : 0.05;

  /* estrellas con paralaje */
  S.stars.forEach(st => {
    st.x -= speedFactor * st.z * 60 * dt;
    if (st.x < -4) {
      st.x = w + 4;
      st.y = rand(0, h * 0.85);
    }
    st.tw += dt * 3;
    const a = 0.3 + 0.5 * st.z * (0.6 + 0.4 * Math.sin(st.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    if (flying && m > 2 && Quality.fancy()) {
      ctx.fillRect(st.x, st.y, 1 + speedFactor * st.z * 6, st.z * 1.4);
    } else {
      ctx.fillRect(st.x, st.y, st.z * 1.6, st.z * 1.6);
    }
  });

  /* resplandor del horizonte */
  const glow = ctx.createRadialGradient(w * 0.7, h, 0, w * 0.7, h, h * 0.9);
  glow.addColorStop(0, "rgba(255,61,90,0.28)");
  glow.addColorStop(1, "rgba(255,61,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  /* colinas lejanas con desplazamiento */
  S.hills.forEach((pts, layer) => {
    const off = (S.time * speedFactor * (layer ? 26 : 12)) % (w / 12);
    ctx.fillStyle = layer ? "rgba(40,10,40,0.95)" : "rgba(28,10,36,0.8)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 24; i++) {
      const x = i * (w / 12) - off;
      const y = h - p.b + 4 - pts[i % pts.length] * (layer ? 26 : 46);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });

  /* grilla y ejes */
  ctx.font = "700 11px Manrope, sans-serif";
  ctx.textBaseline = "middle";
  const mStep = avNiceStep(S.mMax - 1);
  ctx.textAlign = "right";
  for (let v = 1; v <= S.mMax + 0.001; v += mStep) {
    const y = avMapY(v);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.l, y);
    ctx.lineTo(w - p.r, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(v.toFixed(v < 10 ? 1 : 0) + "x", p.l - 8, y);
  }
  const tStep = avNiceStep(S.tMax);
  ctx.textAlign = "center";
  for (let v = 0; v <= S.tMax + 0.001; v += tStep) {
    const x = avMapX(v);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(x, p.t);
    ctx.lineTo(x, h - p.b);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(Math.round(v) + "s", x, h - p.b + 16);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(p.l, p.t);
  ctx.lineTo(p.l, h - p.b);
  ctx.lineTo(w - p.r, h - p.b);
  ctx.stroke();

  /* curva de crecimiento real: m(t) = e^(k·t) */
  const k = av.growthRate * 1000;
  const endT = flying ? S.elapsed : S.flyAway ? S.flyAway.t : 0;
  const endM = flying ? m : S.flyAway ? S.flyAway.m : 1;
  if (endT > 0) {
    const N = 64;
    ctx.beginPath();
    ctx.moveTo(avMapX(0), avMapY(1));
    for (let i = 1; i <= N; i++) {
      const tt = (endT * i) / N;
      const mm = i === N ? endM : Math.exp(k * tt);
      ctx.lineTo(avMapX(tt), avMapY(mm));
    }
    const ex = avMapX(endT);
    const ey = avMapY(endM);
    const crashed = !flying && S.flyAway;

    ctx.save();
    ctx.lineTo(ex, h - p.b);
    ctx.lineTo(avMapX(0), h - p.b);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, ey, 0, h - p.b);
    fill.addColorStop(0, crashed ? "rgba(120,120,140,0.3)" : "rgba(255,61,90,0.45)");
    fill.addColorStop(1, "rgba(255,61,90,0.02)");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(avMapX(0), avMapY(1));
    for (let i = 1; i <= N; i++) {
      const tt = (endT * i) / N;
      const mm = i === N ? endM : Math.exp(k * tt);
      ctx.lineTo(avMapX(tt), avMapY(mm));
    }
    ctx.strokeStyle = crashed ? "#9a96ad" : "#ff3d5a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (Quality.fancy()) {
      ctx.shadowColor = crashed ? "transparent" : "rgba(255,61,90,0.9)";
      ctx.shadowBlur = 16;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* marca de cobro */
    if (S.cashMark) {
      const cx = avMapX(S.cashMark.t);
      const cy = avMapY(S.cashMark.m);
      ctx.fillStyle = "#34e89e";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(52,232,158,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy - 34);
      ctx.stroke();
      ctx.fillStyle = "rgba(6,30,20,0.85)";
      const label = "+" + avMoney(S.cashMark.win) + " · " + S.cashMark.m.toFixed(2) + "x";
      ctx.font = "800 12px Manrope, sans-serif";
      const tw = ctx.measureText(label).width + 16;
      roundRect(ctx, cx - tw / 2, cy - 56, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#34e89e";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy - 45);
    }

    /* avión orientado según la tangente de la curva */
    if (flying) {
      const t2 = Math.max(0, endT - 0.12);
      const ax = avMapX(t2);
      const ay = avMapY(Math.exp(k * t2));
      const angle = Math.atan2(ey - ay, ex - ax);
      S.plane = { x: ex, y: ey, angle };

      if (Quality.fancy() && Math.random() < 0.8) {
        S.smoke.push({ x: ex - Math.cos(angle) * 26, y: ey - Math.sin(angle) * 26, r: rand(3, 6), life: 1, vx: -rand(20, 50), vy: rand(-8, 8) });
      }
    }
  }

  /* humo de la estela */
  S.smoke.forEach(sm => {
    sm.life -= dt * 1.3;
    sm.x += sm.vx * dt;
    sm.y += sm.vy * dt;
    sm.r += dt * 14;
  });
  S.smoke = S.smoke.filter(sm => sm.life > 0);
  S.smoke.forEach(sm => {
    ctx.fillStyle = `rgba(255,170,190,${0.16 * sm.life})`;
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const planeScale = clamp(w / 900, 0.7, 1.2);

  if (flying) {
    const bob = Math.sin(S.time * 5) * 1.5;
    drawPlane(ctx, S.plane.x, S.plane.y + bob, S.plane.angle, planeScale, S.time);
  } else if (S.flyAway) {
    const fa = S.flyAway;
    fa.vx += 900 * dt;
    fa.vy -= 500 * dt;
    fa.x += fa.vx * dt;
    fa.y += fa.vy * dt;
    fa.alpha = Math.max(0, fa.alpha - dt * 0.9);
    if (fa.alpha > 0) drawPlane(ctx, fa.x, fa.y, Math.atan2(fa.vy, fa.vx), planeScale * (1 + (1 - fa.alpha) * 0.3), S.time, fa.alpha);
  } else {
    /* en pista, esperando el despegue */
    const bx = avMapX(0) + 30 * planeScale;
    const by = avMapY(1) - 8 + Math.sin(S.time * 2) * 2;
    drawPlane(ctx, bx, by, -0.05, planeScale, S.time);
  }

  /* chispas al volar lejos */
  S.sparks.forEach(sp => {
    sp.life -= dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 300 * dt;
  });
  S.sparks = S.sparks.filter(sp => sp.life > 0);
  S.sparks.forEach(sp => {
    ctx.fillStyle = `rgba(255,${120 + Math.floor(sp.life * 100)},120,${sp.life})`;
    ctx.fillRect(sp.x, sp.y, 3, 3);
  });
}

/* Bucle visual cuando no hay vuelo (avión en pista y salida tras el crash). */
function avIdleTick() {
  if (currentScreen !== "aviator-screen") return false;
  if (!av.active) renderAviatorGraph();
  return true;
}

function avStartIdle() {
  Loop.add("aviator-idle", avIdleTick);
}

function avPlaceChip(value, chipEl) {
  if (av.active || balance < value || value <= 0) return;

  balance -= value;
  av.bet = round2(av.bet + value);

  chipFeedback(chipEl, avEls.bet, value);
  updateBalance();
  updateAviatorInfo();
  updateAviatorButtons();

  setMessage(avEls.message, "Apostaste " + avMoney(av.bet) + ". Ya podés iniciar el vuelo.");
}

function avClearBet() {
  if (av.active) return;

  balance += av.bet;
  av.bet = 0;

  updateBalance();
  updateAviatorInfo();
  updateAviatorButtons();

  setMessage(avEls.message, "Apuesta limpiada.");
}

function avStartRound() {
  if (av.active || av.bet <= 0) return;

  if (av.raf) {
    cancelAnimationFrame(av.raf);
    av.raf = null;
  }

  av.active = true;
  av.cashedOut = false;
  av.cashedMultiplier = 0;
  av.multiplier = 1;
  av.crashAt = avGenerateCrash();
  av.lastWin = 0;
  av.startedAt = 0;

  avScene.flyAway = null;
  avScene.cashMark = null;
  avScene.elapsed = 0;
  avScene.smoke = [];
  avEls.multiplierBig.className = "aviator-big-multiplier";

  updateAviatorInfo();
  renderAviatorGraph();
  updateAviatorButtons();
  updateAviatorStatus("En vuelo", "flying");

  Sound.startEngine();
  Sound.play("whoosh");

  setMessage(avEls.message, "El avión despegó. Cobrá antes de que desaparezca.");

  av.raf = requestAnimationFrame(avTick);
}

function avTick(timestamp) {
  if (!av.active) return;

  if (!av.startedAt) {
    av.startedAt = timestamp;
  }

  const elapsed = timestamp - av.startedAt;

  av.multiplier = Number(Math.max(1, Math.exp(av.growthRate * elapsed)).toFixed(2));
  avScene.elapsed = elapsed / 1000;

  /* cobro automático opcional: se ejecuta antes del chequeo de crash
     solo si el objetivo es menor al punto de crash sorteado */
  if (av.auto.enabled && !av.cashedOut && av.multiplier >= av.auto.value && av.auto.value < av.crashAt) {
    av.multiplier = Number(av.auto.value.toFixed(2));
    avCashout();
  }

  if (av.multiplier >= av.crashAt) {
    avFinishCrash();
    return;
  }

  Sound.setEngine(av.multiplier);
  renderAviatorGraph();
  updateAviatorInfo();

  av.raf = requestAnimationFrame(avTick);
}

function avCashout() {
  if (!av.active || av.cashedOut) return;

  const payout   = Number((av.bet * av.multiplier).toFixed(2));
  const avProfit = Number((payout - av.bet).toFixed(2)); // capturar antes del reset

  balance = Number((balance + payout).toFixed(2));
  av.lastWin = payout;
  av.cashedOut = true;
  av.cashedMultiplier = av.multiplier;

  avScene.cashMark = { t: avScene.elapsed, m: av.multiplier, win: payout };
  Sound.play("cash");
  FX.flyChip(avEls.cashout, walletEl, payout);
  Stats.record("aviator", av.bet, payout, "Cobro a " + av.multiplier.toFixed(2) + "x");

  updateBalance();
  updateAviatorInfo();
  updateAviatorButtons();
  updateAviatorStatus("Cobrado", "cashed");

  setMessage(
    avEls.message,
    "Cobraste a " + av.multiplier.toFixed(2) + "x y recibiste " + avMoney(payout) + ".",
    "win"
  );

  const avWType  = avProfit >= 300 ? "bigwin" : "win";
  const avWTitle = avProfit >= 300 ? "BIG WIN" : "WIN";
  later(() => showWinAnimation(avWTitle, Math.round(avProfit), avWType), 1000);
}

function avFinishCrash() {
  const avLost = av.bet; // capturar antes del reset (solo se usa si no cobró)

  if (av.raf) {
    cancelAnimationFrame(av.raf);
    av.raf = null;
  }

  av.multiplier = av.crashAt;
  av.lastCrash = av.crashAt;
  av.active = false;

  /* el avión se va volando desde el punto exacto del crash */
  const k = av.growthRate * 1000;
  const crashT = Math.log(av.crashAt) / k;
  avScene.elapsed = crashT;
  avScene.flyAway = {
    t: crashT,
    m: av.crashAt,
    x: avScene.plane.x || avMapX(crashT),
    y: avScene.plane.y || avMapY(av.crashAt),
    vx: 260,
    vy: -180,
    alpha: 1
  };
  for (let i = 0; i < Quality.particles(26); i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(60, 260);
    avScene.sparks.push({ x: avScene.flyAway.x, y: avScene.flyAway.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 1) });
  }

  av.history.unshift(av.crashAt);
  if (av.history.length > 16) av.history.length = 16;
  Store.set("avHistory", av.history);
  renderAviatorHistory();

  Sound.stopEngine();
  Sound.play("crash");
  avEls.stage.classList.remove("shake");
  void avEls.stage.offsetWidth;
  avEls.stage.classList.add("shake");

  avEls.multiplierBig.className = "aviator-big-multiplier crashed";
  updateAviatorInfo();
  avEls.multiplierBig.textContent = "VOLÓ " + av.crashAt.toFixed(2) + "x";
  avStartIdle();

  if (av.cashedOut) {
    // La animación de WIN ya fue disparada desde avCashout()
    updateAviatorStatus("Se fue", "crashed");
    setMessage(
      avEls.message,
      "El avión desapareció en " + av.crashAt.toFixed(2) + "x. Ya habías cobrado en " + av.cashedMultiplier.toFixed(2) + "x.",
      "win"
    );
  } else {
    av.lastWin = 0;
    Stats.record("aviator", avLost, 0, "Crash en " + av.crashAt.toFixed(2) + "x");
    updateAviatorStatus("Crash", "crashed");
    setMessage(
      avEls.message,
      "El avión desapareció en " + av.crashAt.toFixed(2) + "x. Perdiste " + avMoney(avLost) + ".",
      "lose"
    );
    later(() => showWinAnimation("GAME OVER", Math.round(avLost), "lose"), 1000);
  }

  av.bet = 0;
  av.cashedOut = false;
  av.cashedMultiplier = 0;

  updateAviatorInfo();
  avEls.multiplierBig.textContent = "VOLÓ " + av.crashAt.toFixed(2) + "x";
  updateAviatorButtons();
}

function avReset() {
  if (av.raf) {
    cancelAnimationFrame(av.raf);
    av.raf = null;
  }
  av.bet = 0;
  av.active = false;
  av.cashedOut = false;
  av.cashedMultiplier = 0;
  av.multiplier = 1;
  av.lastWin = 0;
  avScene.flyAway = null;
  avScene.cashMark = null;
  avScene.elapsed = 0;
  avScene.smoke = [];
  avScene.sparks = [];
  Sound.stopEngine();
  avEls.multiplierBig.className = "aviator-big-multiplier";
  updateAviatorInfo();
  updateAviatorButtons();
  updateAviatorStatus("Esperando");
  setMessage(avEls.message, "Elegí fichas y tocá Iniciar vuelo.");
  if (currentScreen === "aviator-screen") avStartIdle();
}

function syncAutoCashUI() {
  avEls.autoEnabled.checked = !!av.auto.enabled;
  avEls.autoValue.value = Number(av.auto.value).toFixed(2);
}

avEls.autoEnabled.addEventListener("change", () => {
  av.auto.enabled = avEls.autoEnabled.checked;
  Store.set("avAuto", av.auto);
  toast(av.auto.enabled ? "Cobro automático en " + av.auto.value.toFixed(2) + "x" : "Cobro automático desactivado");
});

avEls.autoValue.addEventListener("change", () => {
  let v = Number(avEls.autoValue.value);
  if (!Number.isFinite(v)) v = 2;
  v = clamp(round2(v), 1.01, 100);
  av.auto.value = v;
  avEls.autoValue.value = v.toFixed(2);
  Store.set("avAuto", av.auto);
});

avEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    const amount = chip.dataset.allin === "true"
      ? balance
      : Number(chip.dataset.value);

    avPlaceChip(amount, chip);
  });
});

avEls.clear.addEventListener("click", avClearBet);
avEls.start.addEventListener("click", avStartRound);
avEls.cashout.addEventListener("click", avCashout);

screenHooks["aviator-screen"] = {
  show() {
    avLayout();
    renderAviatorGraph();
    avStartIdle();
  }
};

/* ============================================================
   17. CARRERA DE CABALLOS
   ------------------------------------------------------------
   El orden de llegada se sortea primero (pesos sin cambios).
   Cada caballo tiene un tiempo de llegada estrictamente
   ordenado según ese ranking y una curva de avance monótona
   con "personalidad" (largada rápida o atropellada final),
   así hay adelantamientos pero quien cruza primero la meta
   es siempre el ganador calculado.
   ============================================================ */
const hrHorseTemplates = [
  { id: 1, name: "Relámpago", odds: 2.0, weight: 30, color: "#dc2626", coat: "#5a3418", form: "1-2-1" },
  { id: 2, name: "Tornado", odds: 2.6, weight: 24, color: "#2563eb", coat: "#2a1a10", form: "2-1-3" },
  { id: 3, name: "Trueno", odds: 3.4, weight: 18, color: "#16a34a", coat: "#7a4a22", form: "3-4-2" },
  { id: 4, name: "Furia", odds: 4.5, weight: 14, color: "#f97316", coat: "#3d2614", form: "4-2-5" },
  { id: 5, name: "Centella", odds: 6.5, weight: 9, color: "#9333ea", coat: "#9a9aa8", form: "5-6-3" },
  { id: 6, name: "Fantasma", odds: 10.0, weight: 5, color: "#64748b", coat: "#e4e1ea", form: "6-5-6" }
];

const hr = {
  bet: 0,
  selectedHorse: null,
  betType: "winner",
  racing: false,
  horses: [],
  winner: null,
  podium: [],
  lastPayout: 0
};

const hrEls = {
  message: document.getElementById("hr-message"),
  bet: document.getElementById("hr-bet"),
  selected: document.getElementById("hr-selected"),
  lastWinner: document.getElementById("hr-last-winner"),
  lastWin: document.getElementById("hr-last-win"),
  horseList: document.getElementById("hr-horse-list"),
  track: document.getElementById("hr-track"),
  canvas: document.getElementById("hr-canvas"),
  standings: document.getElementById("hr-standings"),
  results: document.getElementById("hr-results"),
  betType: document.getElementById("hr-bet-type"),
  chips: document.querySelectorAll(".hr-chip"),
  clear: document.getElementById("hr-clear"),
  start: document.getElementById("hr-start")
};

const hrScene = {
  w: 0, h: 0,
  D: 2400,
  startX: 120,
  camX: 0,
  time: 0,
  race: null,
  flash: 0,
  crowd: [],
  lastStand: 0,
  lastThump: 0
};

function getHorseById(id) {
  return hr.horses.find(horse => horse.id === id);
}

function getHorsePodiumMultiplier(horse) {
  return Number(Math.max(1.25, horse.odds * 0.42).toFixed(2));
}

function resetHorsePositions() {
  hr.horses = hrHorseTemplates.map(horse => ({
    ...horse,
    runnerEl: null,
    areaEl: null,
    x: 0,
    phase: Math.random(),
    speed: 0,
    finished: false
  }));

  renderHorseRaceBoard();
}

function renderHorseList() {
  hrEls.horseList.innerHTML = "";

  hr.horses.forEach(horse => {
    const button = document.createElement("button");
    button.className = "horse-option";

    if (hr.selectedHorse === horse.id) {
      button.classList.add("selected");
    }

    button.disabled = hr.racing;
    button.style.setProperty("--horse-color", horse.color);

    button.innerHTML = `
      <span class="horse-number-pill">${horse.id}</span>
      <div class="horse-option-top">
        <span class="horse-name">${horse.name}</span>
        <span class="horse-form">Últimas: ${horse.form}</span>
      </div>

      <div class="horse-odds">
        Ganador <b>x${horse.odds.toFixed(2)}</b><br>
        Podio <b>x${getHorsePodiumMultiplier(horse).toFixed(2)}</b>
      </div>
    `;

    button.addEventListener("click", () => {
      if (hr.racing) return;

      hr.selectedHorse = horse.id;
      Sound.play("select");

      renderHorseList();
      updateHorseInfo();
      updateHorseButtons();
      hrDraw();

      setMessage(hrEls.message, "Elegiste a " + horse.name + ". Ahora poné fichas.");
    });

    hrEls.horseList.appendChild(button);
  });
}

/* Prepara la escena de la pista (antes armaba los carriles en el DOM). */
function renderHorseRaceBoard() {
  hrLayout();
  hr.horses.forEach(horse => {
    horse.x = hrScene.startX;
    horse.finished = false;
  });
  hrScene.camX = 0;
  hrScene.race = null;
  hrRenderStandings(true);
  hrDraw();
}

function hrLayout() {
  if (!hrEls.canvas) return;
  const { w, h } = fitCanvas(hrEls.canvas);
  hrScene.w = w;
  hrScene.h = h;
  hrScene.startX = Math.max(140, w * 0.17);
  hrScene.D = Math.max(1800, w * 2.8);
  if (!hrScene.crowd.length) {
    for (let i = 0; i < 240; i++) {
      hrScene.crowd.push({ x: rand(0, 1), y: rand(0, 1), c: ["#ff3d9a", "#2de2e6", "#f0c96b", "#fff", "#8b5cf6", "#ff9f1c"][i % 6], p: rand(0, 6) });
    }
  }
}

function hrLaneGeom(i) {
  const h = hrScene.h;
  const top = h * 0.36;
  const bottom = h * 0.95;
  const laneH = (bottom - top) / 6;
  return { y: top + laneH * (i + 0.82), laneH, scale: 0.78 + i * 0.06, top, bottom };
}

function drawHorse(ctx, x, y, s, phase, coat, silk, num, running, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x - 52 * s, y);
  ctx.scale(s, s);

  const TAU = Math.PI * 2;
  const bob = running ? Math.sin(phase * TAU * 2) * 2.2 : Math.sin(phase * TAU * 0.5) * 0.6;
  const dark = "rgba(0,0,0,0.25)";

  /* sombra */
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(4, 1, 38, 5, 0, 0, TAU);
  ctx.fill();

  ctx.translate(0, bob);

  const leg = (hx, hy, off, front, far) => {
    const a = running ? Math.sin((phase + off) * TAU) : 0.05;
    const upper = (front ? 0.55 : -0.5) * a;
    const knee = running ? (front ? Math.max(0, Math.cos((phase + off) * TAU)) * 1.25 : -Math.max(0, -Math.cos((phase + off) * TAU)) * 1.05) : 0;
    const l1 = 15;
    const l2 = 15;
    const kx = hx + Math.sin(upper) * l1;
    const ky = hy + Math.cos(upper) * l1;
    const fx = kx + Math.sin(upper + knee * (front ? -1 : 1)) * l2;
    const fy = ky + Math.cos(upper + knee * (front ? -1 : 1)) * l2;
    ctx.strokeStyle = far ? shadeColor(coat, -0.35) : coat;
    ctx.lineWidth = 5.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.6, 0, TAU);
    ctx.fill();
  };

  /* patas lejanas */
  leg(16, -30, 0.62, true, true);
  leg(-18, -31, 0.12, false, true);

  /* cola */
  const tailWave = running ? Math.sin(phase * TAU * 2) * 4 : Math.sin(hrScene.time * 2) * 2;
  ctx.strokeStyle = shadeColor(coat, -0.45);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-26, -40);
  ctx.quadraticCurveTo(-40, -40 + tailWave, -48, -28 + tailWave);
  ctx.stroke();

  /* cuerpo */
  const body = ctx.createLinearGradient(0, -48, 0, -22);
  body.addColorStop(0, shadeColor(coat, 0.25));
  body.addColorStop(0.6, coat);
  body.addColorStop(1, shadeColor(coat, -0.3));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-2, -36, 28, 11.5, -0.05, 0, TAU);
  ctx.fill();

  /* cuello y cabeza */
  const nodd = running ? Math.sin(phase * TAU * 2 + 0.6) * 0.08 : 0;
  ctx.save();
  ctx.translate(20, -40);
  ctx.rotate(-0.85 + nodd);
  ctx.fillStyle = coat;
  roundRect(ctx, -5, -6, 28, 12, 6);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(38, -58 + Math.sin(phase * TAU * 2) * (running ? 1.5 : 0));
  ctx.rotate(0.45 + nodd);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(6, 0, 12, 5.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shadeColor(coat, -0.4);
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(0, -11);
  ctx.lineTo(3, -5);
  ctx.fill();
  ctx.fillStyle = "#0d0906";
  ctx.beginPath();
  ctx.arc(3, -1.5, 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* crin */
  ctx.strokeStyle = shadeColor(coat, -0.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, -46);
  ctx.quadraticCurveTo(26, -58, 33, -64);
  ctx.stroke();

  /* mantilla con número */
  ctx.fillStyle = "#f7f2e6";
  roundRect(ctx, -14, -44, 18, 13, 3);
  ctx.fill();
  ctx.fillStyle = silk;
  ctx.fillRect(-14, -44, 18, 3);
  ctx.fillStyle = "#15121d";
  ctx.font = "900 9px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), -5, -36.5);

  /* patas cercanas */
  leg(16, -30, 0.38, true, false);
  leg(-18, -31, 0.88, false, false);

  /* jockey */
  const lean = running ? 0.95 : 0.55;
  ctx.save();
  ctx.translate(-2, -47);
  ctx.strokeStyle = "#f3e2b3";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7, 6);
  ctx.lineTo(4, 11);
  ctx.stroke();
  ctx.rotate(lean);
  ctx.fillStyle = silk;
  roundRect(ctx, -4, -17, 9, 18, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-4, -11, 9, 3);
  ctx.restore();

  const shx = -2 + Math.sin(lean) * 15;
  const shy = -47 - Math.cos(lean) * 15;
  ctx.strokeStyle = silk;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(shx, shy);
  ctx.lineTo(shx + 9, shy + 7 + (running ? Math.sin(phase * TAU * 2) * 2 : 0));
  ctx.stroke();
  ctx.fillStyle = "#f3d3b0";
  ctx.beginPath();
  ctx.arc(shx + 4, shy - 4, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = silk;
  ctx.beginPath();
  ctx.arc(shx + 4, shy - 5.5, 4.3, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(shx + 4, shy - 6, 5, 1.6);

  ctx.restore();
}

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((f - r) * p + r);
  g = Math.round((f - g) * p + g);
  b = Math.round((f - b) * p + b);
  return "rgb(" + r + "," + g + "," + b + ")";
}

function hrDraw() {
  const canvas = hrEls.canvas;
  if (!canvas || !canvas.offsetWidth) return;
  const { ctx, w, h } = fitCanvas(canvas);
  if (w !== hrScene.w || h !== hrScene.h) hrLayout();
  const S = hrScene;
  const cam = S.camX;
  const finishX = S.startX + S.D;
  const g0 = hrLaneGeom(0);

  /* cielo de atardecer */
  const sky = ctx.createLinearGradient(0, 0, 0, g0.top);
  sky.addColorStop(0, "#1e0b33");
  sky.addColorStop(0.55, "#6b1d4d");
  sky.addColorStop(1, "#e2715a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, g0.top);

  /* sol */
  const sunX = w * 0.72 - cam * 0.02;
  const sun = ctx.createRadialGradient(sunX, g0.top * 0.75, 0, sunX, g0.top * 0.75, g0.top * 0.6);
  sun.addColorStop(0, "rgba(255,230,170,0.95)");
  sun.addColorStop(0.3, "rgba(255,170,110,0.5)");
  sun.addColorStop(1, "rgba(255,120,90,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, g0.top);

  /* tribuna con público (paralaje 0.5) */
  const standTop = g0.top * 0.42;
  const standH = g0.top * 0.5;
  const px = cam * 0.5;
  ctx.fillStyle = "#2a1630";
  ctx.fillRect(0, standTop, w, standH);
  ctx.fillStyle = "#3b2142";
  const bay = 180;
  for (let x = -((px) % bay) - bay; x < w + bay; x += bay) {
    ctx.fillRect(x, standTop - 10, 6, standH + 10);
    ctx.fillStyle = "#4a2a50";
    ctx.beginPath();
    ctx.moveTo(x - 8, standTop - 10);
    ctx.lineTo(x + bay + 8, standTop - 18);
    ctx.lineTo(x + bay + 8, standTop - 10);
    ctx.lineTo(x - 8, standTop - 2);
    ctx.fill();
    ctx.fillStyle = "#3b2142";
  }
  const excite = S.race ? 1 : 0.3;
  S.crowd.forEach(c => {
    const cx = ((c.x * 1400 - px) % 1400 + 1400) % 1400;
    if (cx > w) return;
    const jump = Math.max(0, Math.sin(S.time * 8 * excite + c.p)) * 3 * excite;
    ctx.fillStyle = c.c;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(cx, standTop + 6 + c.y * (standH - 14) - jump, 3, 4);
  });
  ctx.globalAlpha = 1;

  /* baranda exterior */
  const railY = g0.top - 6;
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, railY - 3, w, 4);
  for (let x = -((cam) % 60); x < w; x += 60) ctx.fillRect(x, railY - 3, 3, 14);

  /* pista de césped con franjas de corte */
  const trackTop = g0.top + 6;
  const tg = ctx.createLinearGradient(0, trackTop, 0, h);
  tg.addColorStop(0, "#2f6a20");
  tg.addColorStop(1, "#1c4512");
  ctx.fillStyle = tg;
  ctx.fillRect(0, trackTop, w, h - trackTop);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  const stripe = 120;
  for (let x = -((cam) % (stripe * 2)); x < w; x += stripe * 2) ctx.fillRect(x, trackTop, stripe, h - trackTop);

  /* líneas de carril */
  for (let i = 0; i <= 6; i++) {
    const y = i === 0 ? trackTop : hrLaneGeom(i - 1).y + hrLaneGeom(0).laneH * 0.18;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  /* marcas de distancia */
  ctx.font = "800 11px Manrope, sans-serif";
  ctx.textAlign = "center";
  for (let d = 0; d <= S.D; d += S.D / 6) {
    const x = S.startX + d - cam;
    if (x < -40 || x > w + 40) continue;
    const meters = Math.round((1 - d / S.D) * 1200);
    if (meters === 0 || meters === 1200) continue;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x - 1.5, railY - 22, 3, 22);
    ctx.fillStyle = "#15121d";
    roundRect(ctx, x - 18, railY - 36, 36, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#f0c96b";
    ctx.fillText(meters + "m", x, railY - 27.5);
  }

  /* gatera de largada */
  const sx = S.startX - cam;
  if (sx > -80 && sx < w + 40) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(sx - 2, trackTop, 4, h - trackTop);
  }

  /* línea de meta a cuadros */
  const fx = finishX - cam;
  if (fx > -40 && fx < w + 40) {
    const sq = 8;
    for (let y = trackTop, r = 0; y < h; y += sq, r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#111" : "#fff";
        ctx.fillRect(fx + c * sq - sq, y, sq, sq);
      }
    }
    ctx.fillStyle = "#f0c96b";
    ctx.fillRect(fx - 3, railY - 70, 6, 70);
    ctx.fillStyle = "#15121d";
    roundRect(ctx, fx - 34, railY - 92, 68, 24, 6);
    ctx.fill();
    ctx.fillStyle = "#f0c96b";
    ctx.font = "900 12px Unbounded, sans-serif";
    ctx.fillText("META", fx, railY - 79);
  }

  /* caballos: de atrás (lejos) hacia adelante (cerca) */
  hr.horses.forEach((horse, i) => {
    const g = hrLaneGeom(i);
    const x = horse.x - cam;
    if (x < -200 || x > w + 140) return;
    const mine = hr.selectedHorse === horse.id;
    if (mine) {
      ctx.fillStyle = "rgba(240,201,107,0.18)";
      ctx.beginPath();
      ctx.ellipse(x - 48 * g.scale, g.y + 2, 46 * g.scale, 8 * g.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHorse(ctx, x, g.y, g.scale, horse.phase, horse.coat, horse.color, horse.id, horse.speed > 5);

    /* polvo detrás de los cascos */
    if (horse.speed > 40 && Quality.fancy()) {
      ctx.fillStyle = "rgba(220,200,160,0.18)";
      for (let k = 0; k < 3; k++) {
        const dx = x - 80 * g.scale - k * 14 * g.scale - (horse.phase * 20 % 14);
        ctx.beginPath();
        ctx.arc(dx, g.y - 2 - k * 2, (4 + k * 3) * g.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  /* número de carril fijo a la izquierda */
  hr.horses.forEach((horse, i) => {
    const g = hrLaneGeom(i);
    ctx.fillStyle = horse.color;
    roundRect(ctx, 8, g.y - 26 * g.scale, 20, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "900 11px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(horse.id), 18, g.y - 16 * g.scale);
  });

  /* flash de foto final */
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${S.flash * 0.55})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function hrRenderStandings(force) {
  const order = [...hr.horses].sort((a, b) => b.x - a.x || a.id - b.id);
  if (force || hrEls.standings.children.length !== order.length) {
    hrEls.standings.innerHTML = order.map(h => `<span data-id="${h.id}" style="--c:${h.color}" class="${h.id === hr.selectedHorse ? "mine" : ""}">${h.id}</span>`).join("");
    return;
  }
  /* reordena con transición FLIP sencilla */
  const spans = {};
  Array.from(hrEls.standings.children).forEach(s => { spans[s.dataset.id] = s; });
  const before = {};
  Object.values(spans).forEach(s => { before[s.dataset.id] = s.getBoundingClientRect().left; });
  order.forEach(h => hrEls.standings.appendChild(spans[h.id]));
  order.forEach(h => {
    const s = spans[h.id];
    s.classList.toggle("mine", h.id === hr.selectedHorse);
    const dx = before[h.id] - s.getBoundingClientRect().left;
    if (dx && !Settings.reduceMotion) s.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 300, easing: "ease-out" });
  });
}

function updateHorseInfo() {
  const selectedHorse = getHorseById(hr.selectedHorse);

  hrEls.bet.textContent = hrMoney(hr.bet);
  hrEls.selected.textContent = selectedHorse ? selectedHorse.name : "Ninguno";
  hrEls.lastWinner.textContent = hr.winner ? getHorseById(hr.winner)?.name || "-" : "-";
  hrEls.lastWin.textContent = hrMoney(hr.lastPayout);
}

function updateHorseButtons() {
  hrEls.chips.forEach(chip => {
    const value = chip.dataset.allin === "true"
      ? balance
      : Number(chip.dataset.value);

    chip.disabled = hr.racing || !hr.selectedHorse || balance <= 0 || balance < value;
  });

  hrEls.clear.disabled = hr.racing || hr.bet === 0;
  hrEls.start.disabled = hr.racing || hr.bet === 0 || !hr.selectedHorse;
  hrEls.betType.disabled = hr.racing;
}

function hrPlaceChip(value, chipEl) {
  if (hr.racing || !hr.selectedHorse || balance < value || value <= 0) return;

  balance -= value;
  hr.bet = round2(hr.bet + value);

  chipFeedback(chipEl, hrEls.bet, value);
  updateBalance();
  updateHorseInfo();
  updateHorseButtons();

  setMessage(hrEls.message, "Apostaste " + hrMoney(hr.bet) + ".");
}

function hrClearBet() {
  if (hr.racing) return;

  balance += hr.bet;
  hr.bet = 0;

  updateBalance();
  updateHorseInfo();
  updateHorseButtons();

  setMessage(hrEls.message, "Apuesta limpiada.");
}

function weightedPick(horses) {
  const totalWeight = horses.reduce((sum, horse) => sum + horse.weight, 0);
  let random = Math.random() * totalWeight;

  for (const horse of horses) {
    random -= horse.weight;

    if (random <= 0) {
      return horse;
    }
  }

  return horses[horses.length - 1];
}

function generateHorsePodium() {
  let available = [...hr.horses];
  let podium = [];

  for (let i = 0; i < 3; i++) {
    const picked = weightedPick(available);
    podium.push(picked.id);
    available = available.filter(horse => horse.id !== picked.id);
  }

  const rest = available
    .sort(() => Math.random() - 0.5)
    .map(horse => horse.id);

  return [...podium, ...rest];
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* Avance normalizado (0→1 en la meta). Monótono: largada con aceleración,
   deformación temporal con "personalidad" y desaceleración después de la meta. */
function hrProgress(data, t) {
  const ua = 0.12;
  const s = u => (u < ua ? (u * u) / (2 * ua) : u - ua / 2) / (1 - ua / 2);
  if (t <= data.T) {
    const u = t / data.T;
    const wu = u + (data.a1 * Math.sin(Math.PI * u)) / Math.PI + (data.a2 * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);
    return s(clamp(wu, 0, 1));
  }
  const vEnd = ((1 / (1 - ua / 2)) * (1 - data.a1 + data.a2)) / data.T;
  const tau = t - data.T;
  const decel = 1.6;
  const tc = Math.min(tau, decel);
  return 1 + vEnd * (tc - (tc * tc) / (2 * decel));
}

function hrStartRace() {
  if (hr.racing || hr.bet <= 0 || !hr.selectedHorse) return;

  hr.betType = hrEls.betType.value;
  hr.racing = true;
  hr.winner = null;
  hr.podium = [];
  hrEls.results.hidden = true;

  resetHorsePositions();
  renderHorseList();
  updateHorseButtons();

  const ranking = generateHorsePodium();
  const podium = ranking.slice(0, 3);
  const winner = ranking[0];

  const selectedHorse = getHorseById(hr.selectedHorse);
  const totalBet = hr.bet;
  const selectedId = hr.selectedHorse;
  const betType = hr.betType;

  setMessage(
    hrEls.message,
    "La carrera empezó. Apostaste por " + selectedHorse.name + "."
  );

  /* tiempos de llegada estrictamente ordenados por el ranking sorteado */
  const baseT = 7.4;
  let acc = baseT;
  const finishTimes = {};
  ranking.forEach((id, rank) => {
    if (rank > 0) acc += rand(0.12, 0.42);
    finishTimes[id] = acc;
  });

  const raceData = hr.horses.map(horse => {
    const rank = ranking.indexOf(horse.id);
    return {
      id: horse.id,
      rank,
      T: finishTimes[horse.id],
      a1: rand(-0.42, 0.42),
      a2: rand(-0.22, 0.22),
      finished: false
    };
  });

  hrScene.race = {
    start: performance.now(),
    data: raceData,
    ranking,
    podium,
    winner,
    selectedId,
    betType,
    totalBet,
    resolved: false,
    crossed: 0,
    lastT: 0
  };
  hrScene.flash = 0;

  Sound.play("bell");
  Sound.startCrowd();
  Loop.add("horses", hrTick);
}

function hrTick(dt, now) {
  const S = hrScene;
  S.time += dt;
  S.flash = Math.max(0, S.flash - dt * 2.5);
  const race = S.race;

  if (race) {
    const t = ((now - race.start) / 1000) * simSpeed();
    const dtSim = Math.max(0.0001, t - race.lastT);
    race.lastT = t;

    race.data.forEach(data => {
      const horse = getHorseById(data.id);
      const prev = horse.x;
      horse.x = S.startX + hrProgress(data, t) * S.D;
      horse.speed = (horse.x - prev) / dtSim;
      horse.phase = (horse.phase + (horse.speed * dtSim) / 150) % 1;

      if (!data.finished && t >= data.T) {
        data.finished = true;
        race.crossed++;
        if (data.rank === 0) {
          S.flash = 1;
          Sound.play("bell");
        }
        if (race.crossed === 3 && !race.resolved) {
          race.resolved = true;
          later(() => hrFinishRace({
            winner: race.winner,
            podium: race.podium,
            ranking: race.ranking,
            selectedId: race.selectedId,
            betType: race.betType,
            totalBet: race.totalBet
          }), T(350));
        }
      }
    });

    /* galope sonoro marcado por el líder */
    const leader = hr.horses.reduce((a, b) => (b.x > a.x ? b : a), hr.horses[0]);
    if (leader.speed > 40) {
      const beat = Math.floor(leader.phase * 4);
      if (beat !== S.lastThump) {
        S.lastThump = beat;
        Sound.play("thump", 0.7);
      }
    }
    const progressLead = (leader.x - S.startX) / S.D;
    Sound.setCrowd(0.4 + clamp(progressLead, 0, 1) * 1.6);

    /* cámara: sigue al líder y se detiene mostrando la meta */
    const maxCam = S.startX + S.D + S.w * 0.3 - S.w;
    const target = clamp(leader.x - S.w * 0.62, 0, Math.max(0, maxCam));
    S.camX = lerp(S.camX, target, 1 - Math.pow(0.004, dt));

    if (now - S.lastStand > 180) {
      S.lastStand = now;
      hrRenderStandings(false);
    }

    const allDone = race.data.every(d => t > d.T + 1.6);
    if (allDone && race.resolved) {
      S.race = null;
      Sound.stopCrowd();
      hr.horses.forEach(hh => { hh.speed = 0; });
      hrShowResults(race);
    }
  } else {
    hr.horses.forEach(h => { h.phase = (h.phase + dt * 0.3) % 1; });
  }

  if (currentScreen === "horse-screen") hrDraw();
  return !!S.race || currentScreen === "horse-screen";
}

function hrShowResults(race) {
  const first = race.data.find(d => d.rank === 0);
  const rows = race.ranking.map((id, rank) => {
    const horse = getHorseById(id);
    const d = race.data.find(x => x.id === id);
    const gap = rank === 0 ? "Ganador" : "+" + (d.T - first.T).toFixed(2) + "s";
    return `<li class="${id === race.selectedId ? "mine" : ""}" style="--k:${rank}"><span class="pos">${rank + 1}º</span><span class="num" style="--c:${horse.color}">${id}</span><span>${horse.name}</span><span class="gap">${gap}</span></li>`;
  }).join("");
  hrEls.results.innerHTML = `<div class="results-card"><h3>Resultado oficial</h3><ol>${rows}</ol><button class="btn primary close-results">Ver pista</button></div>`;
  hrEls.results.hidden = false;
  hrEls.results.querySelector(".close-results").addEventListener("click", () => { hrEls.results.hidden = true; });
}

function hrFinishRace(result) {
  hr.racing = false;
  hr.winner = result.winner;
  hr.podium = result.podium;

  const selectedHorse = getHorseById(result.selectedId);
  const winnerHorse = getHorseById(result.winner);

  let payout = 0;

  if (result.betType === "winner" && result.selectedId === result.winner) {
    payout = result.totalBet * selectedHorse.odds;
  }

  if (result.betType === "podium" && result.podium.includes(result.selectedId)) {
    payout = result.totalBet * getHorsePodiumMultiplier(selectedHorse);
  }

  payout = Number(payout.toFixed(2));

  const position = result.ranking.indexOf(result.selectedId) + 1;
  Stats.record("horse", result.totalBet, payout, selectedHorse.name + " · " + position + "º · " + (result.betType === "winner" ? "Ganador" : "Podio"));

  if (payout > 0) {
    balance = Number((balance + payout).toFixed(2));
    hr.lastPayout = payout;
    Sound.play("cash");
    FX.flyChip(hrEls.track, walletEl, payout);

    setMessage(
      hrEls.message,
      "Ganó " + winnerHorse.name + ". Tu caballo entró. Cobraste " + hrMoney(payout) + ".",
      "win"
    );

    let hrProfit = payout - result.totalBet;
    const hrWType  = hrProfit >= 300 ? "bigwin" : "win";
    const hrWTitle = hrProfit >= 300 ? "BIG WIN" : "WIN";
    later(() => showWinAnimation(hrWTitle, Math.round(hrProfit), hrWType), 1000);
  } else {
    hr.lastPayout = 0;

    setMessage(
      hrEls.message,
      "Ganó " + winnerHorse.name + ". Perdiste " + hrMoney(result.totalBet) + ".",
      "lose"
    );
    later(() => showWinAnimation("GAME OVER", Math.round(result.totalBet), "lose"), 1000);
  }

  hr.bet = 0;

  updateBalance();
  renderHorseList();
  updateHorseInfo();
  updateHorseButtons();
}

function hrReset() {
  hr.bet = 0;
  hr.racing = false;
  hr.winner = null;
  hr.podium = [];
  hr.lastPayout = 0;
  hrScene.race = null;
  hrScene.flash = 0;
  hrEls.results.hidden = true;
  Sound.stopCrowd();
  resetHorsePositions();
  renderHorseList();
  updateHorseInfo();
  updateHorseButtons();
  setMessage(hrEls.message, "Elegí un caballo, poné fichas y empezá la carrera.");
  if (currentScreen === "horse-screen") Loop.add("horses", hrTick);
}

hrEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    const amount = chip.dataset.allin === "true"
      ? balance
      : Number(chip.dataset.value);

    hrPlaceChip(amount, chip);
  });
});

hrEls.clear.addEventListener("click", hrClearBet);
hrEls.start.addEventListener("click", hrStartRace);

hrEls.betType.addEventListener("change", () => {
  hr.betType = hrEls.betType.value;

  if (hr.betType === "winner") {
    setMessage(hrEls.message, "Modo ganador: cobrás solo si tu caballo sale primero.");
  } else {
    setMessage(hrEls.message, "Modo podio: cobrás si tu caballo termina entre los primeros 3.");
  }
});

screenHooks["horse-screen"] = {
  show() {
    hrLayout();
    if (!hrScene.race && !hr.racing) {
      hr.horses.forEach(h => { if (!h.finished) h.x = Math.max(h.x, hrScene.startX); });
    }
    hrDraw();
    Loop.add("horses", hrTick);
  }
};

/* ============================================================
   18. REINICIO GENERAL E INICIALIZACIÓN
   ============================================================ */
function resetCasino() {
  /* 1) se cancelan temporizadores, flujos async y animaciones en curso */
  Runtime.clearAll();
  Loop.tasks.clear();
  if (av.raf) {
    cancelAnimationFrame(av.raf);
    av.raf = null;
  }
  Sound.stopAllLoops();
  FX.clear();

  /* 2) cada juego vuelve a un estado consistente, sin apuestas en curso */
  bjReset();
  pkReset();
  rtReset();
  cmReset();
  crReset();
  plReset();
  avReset();
  hrReset();

  /* 3) saldo ficticio inicial */
  balance = INITIAL_BALANCE;
  updateBalance();
  saveBalance();

  if (screenHooks[currentScreen] && screenHooks[currentScreen].show) screenHooks[currentScreen].show();
  if (currentScreen === "menu-screen") startHeroLoop();

  toast("Casino reiniciado: saldo ficticio " + formatMoney(INITIAL_BALANCE));
}

resetCasinoBtn.addEventListener("click", () => {
  openModal("confirm-modal");
});

$("#confirm-ok").addEventListener("click", () => {
  closeModal($("#confirm-modal"));
  resetCasino();
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    rt.wheel.layers = null;
    if (screenHooks[currentScreen] && screenHooks[currentScreen].show) screenHooks[currentScreen].show();
  }, 120);
});

function initCasino() {
  applySettings();
  syncSettingsUI();

  const saved = Store.get("balance", null);
  if (typeof saved === "number" && Number.isFinite(saved) && saved >= 0) balance = round2(saved);
  walletView.shown = walletView.lastValue = walletView.to = balance;
  globalBalanceEl.textContent = formatMoney(balance);

  buildGameSwitchers();
  renderFavorites();
  applyLobbyFilter();
  updateHeroStats();
  updateContinueButton();
  renderProfile();

  renderBlackjack();
  updateBlackjackButtons();

  renderPoker();
  updatePokerButtons();

  buildRouletteWheel();
  buildNumberBoard();
  renderRouletteHistory();
  updateRouletteInfo();
  updateRouletteButtons();

  buildMinerBoard();
  cm.board = createEmptyMinerBoard();
  renderCoinMiner();
  updateCoinMinerButtons();

  crSceneReset();
  renderChickenRoad();
  updateChickenButtons();

  renderPlinkoBoard();
  updatePlinkoInfo();
  updatePlinkoButtons();

  syncAutoCashUI();
  renderAviatorHistory();
  updateAviatorInfo();
  updateAviatorButtons();
  updateAviatorStatus("Esperando");

  resetHorsePositions();
  renderHorseList();
  updateHorseInfo();
  updateHorseButtons();

  const key = location.hash.replace("#", "");
  if (GAME_META[key]) {
    showScreen(GAME_META[key].screen, { fromHistory: true });
  } else {
    try { history.replaceState({ screen: "menu-screen" }, "", location.pathname + location.search); } catch (e) { /* sin history */ }
    startHeroLoop();
  }
}


/* ============================================================
   19. WIN CELEBRATION ANIMATION (original, sin cambios)
   ============================================================ */
(function () {
  const overlay   = document.getElementById("win-overlay");
  const titleEl   = document.getElementById("win-title");
  const amountEl  = document.getElementById("win-amount");
  const coinsEl   = document.getElementById("win-coins");
  const starsEl   = document.getElementById("win-stars");
  const closeBtn  = document.getElementById("win-close");

  let _autoClose = null;

  /* ---- helpers ---- */
  function fmtMoney(n) {
    return n.toLocaleString("es-AR");
  }

  function rnd(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ---- build particles ---- */
  function spawnCoins(count, extraClass) {
    coinsEl.innerHTML = "";
    const SYMBOLS = ["$", "$", "$", "🪙", "$", "$"];
    for (let i = 0; i < count; i++) {
      const coin = document.createElement("div");
      coin.className = "win-coin" + (extraClass ? " " + extraClass : "");
      coin.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

      const size  = rnd(26, 52);
      const left  = rnd(2, 97);
      const delay = rnd(0, 2.8);
      const dur   = rnd(1.6, 3.4);

      coin.style.cssText = [
        `left: ${left}%`,
        `width: ${size}px`,
        `height: ${size}px`,
        `font-size: ${Math.floor(size * 0.46)}px`,
        `animation-duration: ${dur.toFixed(2)}s`,
        `animation-delay: ${delay.toFixed(2)}s`
      ].join(";");

      coinsEl.appendChild(coin);
    }
  }

  function spawnStars(count, glyphs) {
    starsEl.innerHTML = "";
    const GLYPHS = glyphs || ["✨", "⭐", "💫", "🌟", "✨", "💛"];
    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.className = "win-star";
      star.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

      const left  = rnd(5, 92);
      const top   = rnd(5, 80);
      const delay = rnd(0, 1.8);
      const dur   = rnd(0.9, 1.8);
      const size  = rnd(18, 34);

      star.style.cssText = [
        `left: ${left}%`,
        `top: ${top}%`,
        `font-size: ${size}px`,
        `animation-duration: ${dur.toFixed(2)}s`,
        `animation-delay: ${delay.toFixed(2)}s`
      ].join(";");

      starsEl.appendChild(star);
    }
  }

  /* ---- public API ---- */
  // type: "win" | "bigwin" | "lose"
  window.showWinAnimation = function (title, amount, type) {
    type = type || "win";

    titleEl.textContent  = title;
    amountEl.textContent = (type === "lose" ? "-$" : "+$") + fmtMoney(amount);

    // Apply variant class — reset all first
    overlay.className = "win-overlay win-overlay--" + type;

    // Spawn particles based on type
    if (type === "lose") {
      coinsEl.innerHTML = "";  // sin monedas
      starsEl.innerHTML = "";  // sin estrellas — más sutil
    } else if (type === "bigwin") {
      spawnCoins(42);
      spawnStars(18);
    } else {
      // regular win — fewer particles
      spawnCoins(20);
      spawnStars(8);
    }

    /* reset win-card animation so it replays each time */
    const card = overlay.querySelector(".win-card");
    card.style.animation = "none";
    card.offsetHeight;                  // force reflow
    card.style.animation = "";

    if (_autoClose) clearTimeout(_autoClose);
    // lose: más corto y dinámico (1.8s); win/bigwin: 4.5s
    _autoClose = setTimeout(closeWin, type === "lose" ? 1800 : 4500);
  };

  function closeWin() {
    overlay.classList.add("win-overlay--out");
    if (_autoClose) { clearTimeout(_autoClose); _autoClose = null; }
    setTimeout(() => overlay.classList.add("win-overlay--hidden"), 420);
  }

  closeBtn.addEventListener("click", closeWin);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeWin();
  });
})();
/* Arranque: después de definir showWinAnimation */
initCasino();
