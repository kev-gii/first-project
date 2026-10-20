/* ============================================================
   AURORA 交响乐团 — 交互脚本（原生 JavaScript）
   ============================================================ */
"use strict";

/* ---------- 1. 背景画布：漂浮的音符粒子（随音频电平律动） ---------- */
(function initCanvas() {
  const canvas = document.getElementById("stage-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, notes;
  let level = 0; // 由画布自身每帧向 AudioBus 读取

  const GLYPHS = ["𝄞", "𝄢", "♪", "♩", "♫"];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function makeNote(x) {
    return {
      x: x ?? Math.random() * w,
      y: h + 40,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      size: 14 + Math.random() * 22,
      speed: 0.25 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 0.4,
      alpha: 0.08 + Math.random() * 0.2,
      spin: (Math.random() - 0.5) * 0.004,
      rot: Math.random() * Math.PI,
    };
  }

  function init() {
    resize();
    notes = Array.from({ length: 26 }, () => {
      const n = makeNote();
      n.y = Math.random() * h; // 首帧铺满全屏
      return n;
    });
  }

  function tick() {
    // 平滑跟踪当前音频电平：有声时粒子更亮、更活跃
    const target = AudioBus.getLevel();
    level += (target - level) * 0.08;

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      n.y -= n.speed * (1 + level * 3.5);
      n.x += n.drift;
      n.rot += n.spin * (1 + level * 2);
      if (n.y < -60) notes[i] = makeNote();
      const a = Math.min(0.55, n.alpha + level * 0.45);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rot);
      ctx.font = `${n.size}px "Playfair Display", serif`;
      ctx.fillStyle = `rgba(201, 164, 92, ${a})`;
      ctx.fillText(n.glyph, 0, 0);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  init();
  requestAnimationFrame(tick); // 首帧走 rAF：此时整个脚本已加载完，AudioBus 已就绪（避开 const TDZ）
})();

/* ---------- 2. 导航：滚动态 + 移动端菜单 ---------- */
(function initNav() {
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const links = document.querySelector(".nav__links");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }, { passive: true });

  burger.addEventListener("click", () => links.classList.toggle("is-open"));

  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("is-open"))
  );
})();

/* ---------- 3. 主题切换 + 音乐厅灯光（按时间自动） ---------- */
(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");

  // 手动选择优先，其次按时间：晚 19:00–早 7:00 → 冷蓝灯光（音乐厅夜间模式）
  function autoLighting() {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
  }
  function apply(theme, lighting) {
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    if (lighting === "cool") {
      root.setAttribute("data-lighting", "cool");
    } else {
      root.removeAttribute("data-lighting");
    }
    const dark = theme !== "light";
    icon.textContent = dark ? "☾" : "☀";
    label.textContent = dark ? "排练厅" : "舞台";
    btn.setAttribute(
      "aria-label",
      dark ? "切换到浅色排练厅主题" : "切换到深色舞台主题"
    );
  }

  let manual = localStorage.getItem("aurora-theme");
  if (!manual) {
    apply("dark", autoLighting() ? "cool" : "warm");
  } else {
    apply(manual, manual === "dark" && autoLighting() ? "cool" : "warm");
  }

  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    manual = next;
    localStorage.setItem("aurora-theme", next);
    apply(next, next === "dark" && autoLighting() ? "cool" : "warm");
  });
})();

/* ---------- 4. 数字滚动动画 ---------- */
(function initCounters() {
  const nums = document.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      const target = Number(el.dataset.count);
      const dur = 1600;
      const start = performance.now();
      (function step(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(step);
      })(start);
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
})();

/* ---------- 5. 共享音频总线（AnalyserNode 供频谱/粒子使用） ---------- */
const AudioBus = (function () {
  let ctx = null;
  let master = null;
  let analyser = null;
  let freqData = null;

  function ensure() {
    // 浏览器自动播放策略：首次用户手势时才创建
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser);
    analyser.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function getCtx() {
    ensure();
    resume();
    return ctx;
  }

  function getMaster() {
    ensure();
    return master;
  }

  function setVolume(v) {
    if (!ctx) {
      master = null;
    }
    ensure();
    master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }

  // 当前整体电平（0–1），供画布粒子律动
  function getLevel() {
    if (!freqData || !analyser) return 0;
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < 48; i++) sum += freqData[i];
    return sum / (48 * 255);
  }

  // 低频能量（0–1），供频谱条渲染
  function getFrequencies() {
    if (!freqData || !analyser) return null;
    analyser.getByteFrequencyData(freqData);
    return freqData;
  }

  return { getCtx, getMaster, ensure, resume, setVolume, getLevel, getFrequencies };
})();

/* ---------- 6. 声部卡片：按声部定制的合成音色试听 ----------
   弦乐：叠层失谐 + 颤音 + 弦弓摩擦（低通噪声）
   木管：簧片起音 + 呼吸声 + 颤音
   铜管：加宽和弦 + 明亮锯齿 + 颤音
   打击乐：噪声包络鼓槌 + 低频鼓胸 + 金属泛音
   ------------------------------------------------------- */
(function initVoices() {
  const cards = document.querySelectorAll(".voice[data-note]");
  const VOICES = {
    strings: { chord: [1, 2, 2.997], waves: ["sawtooth", "sawtooth", "triangle"], vib: 6, vibRate: 4.5, filter: 2200, breath: 0.05 },
    woodwinds: { chord: [1, 2.004], waves: ["sawtooth", "triangle"], vib: 4, vibRate: 5.5, filter: 1700, breath: 0.1 },
    brass: { chord: [1, 1.498, 1.996, 2.004], waves: ["sawtooth", "triangle", "sawtooth", "triangle"], vib: 8, vibRate: 6, filter: 3000, breath: 0.02 },
    percussion: {},
  };

  function noiseBuffer() {
    const ctx = AudioBus.getCtx();
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function play(card) {
    const ctx = AudioBus.getCtx();
    const master = AudioBus.getMaster();
    const key = card.dataset.voice || "strings";
    const base = Number(card.dataset.note);
    const gain = Number(card.dataset.gain) || 0.12;
    const v = VOICES[key] || VOICES.strings;
    const now = ctx.currentTime;

    const out = ctx.createGain();
    out.connect(master);

    if (key === "percussion") {
      // —— 打击乐：噪声包络（鼓槌敲击）+ 低频鼓胸 + 金属泛音 ——
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * 1.6, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      src.connect(bp); bp.connect(g); g.connect(out);
      src.start(now);

      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(base, now);
      thump.frequency.exponentialRampToValueAtTime(base * 0.55, now + 0.3);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(gain * 1.4, now);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      thump.connect(tg); tg.connect(out);
      thump.start(now); thump.stop(now + 0.55);

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = base * 4.2;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(gain * 0.35, now);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      shimmer.connect(sg); sg.connect(out);
      shimmer.start(now); shimmer.stop(now + 1.5);
    } else {
      // —— 管乐/弦乐：失谐和弦叠层 + 颤音 + 低通 + 弓弦/呼吸噪声 ——
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(v.filter, now);
      lp.frequency.linearRampToValueAtTime(v.filter * 0.6, now + 1.6);
      lp.Q.value = 0.5;
      lp.connect(out);

      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = v.vibRate || 5;
      const vibratoDepth = ctx.createGain();
      vibratoDepth.gain.value = v.vib || 0;
      vibrato.connect(vibratoDepth);
      vibrato.start(now); vibrato.stop(now + 2.2);

      v.chord.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = (v.waves && v.waves[i]) || "sawtooth";
        osc.frequency.value = base * ratio * (1 + (i ? 0.0015 : 0));
        if (vibratoDepth.gain.value > 0) vibratoDepth.connect(osc.frequency);
        const og = ctx.createGain();
        og.gain.value = 1 / v.chord.length;
        osc.connect(og); og.connect(lp);
        osc.start(now); osc.stop(now + 2.2);
      });

      if (v.breath > 0) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = base * 3;
        bp.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v.breath * gain, now + 0.1);
        g.gain.linearRampToValueAtTime(v.breath * gain * 0.6, now + 1);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(now); src.stop(now + 2);
      }
    }

    // 音包络：弓弦/簧片起音 + 缓慢收弓
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + 0.08);
    out.gain.setValueAtTime(1, now + 1.2);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);

    card.classList.add("is-playing");
    setTimeout(() => card.classList.remove("is-playing"), 2100);
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => play(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(card);
      }
    });
  });
})();

/* ---------- 7. 演出日程：动态渲染 ---------- */
(function initConcerts() {
  const concerts = [
    { d: "11", m: "11月", title: "贝多芬 · 命运交响夜", desc: "指挥：艾琳 · 冯·哈根 · 贝多芬《第五交响曲》《第六交响曲 '田园'》", sold: false },
    { d: "24", m: "11月", title: "柴可夫斯基之夜", desc: "指挥：陆之弦 · 《天鹅湖》精选 · 《第一钢琴协奏曲》", sold: false },
    { d: "08", m: "12月", title: "冬之序曲 · 新年音乐周", desc: "指挥：凯勒 · 安德森 · 小约翰·施特劳斯圆舞曲专场", sold: true },
    { d: "21", m: "12月", title: "马勒 · 第五交响曲", desc: "驻团青年系列 · 指挥：索菲亚 · 里德尔 · 与小泽征尔基金会合作", sold: false },
    { d: "05", m: "1月", title: "德沃夏克 · 自新大陆", desc: "指挥：艾琳 · 冯·哈根 · 与合唱团联袂 · 观众投票最受欢迎曲目", sold: false },
  ];

  const wrap = document.getElementById("concertList");
  wrap.innerHTML = concerts
    .map((c) => `
      <div class="concert ${c.sold ? "is-soldout" : ""} reveal">
        <div class="concert__date">
          <strong>${c.d}</strong>
          <span>${c.m}</span>
        </div>
        <div class="concert__body">
          <h3>${c.title}</h3>
          <p>${c.desc}</p>
        </div>
        ${c.sold
          ? `<a class="btn btn--ghost concert__soldout" href="#ticket" style="border-color:#555">已售罄</a>`
          : `<a class="btn btn--gold" href="#ticket">购票</a>`}
      </div>`
    )
    .join("");

  // 小节线分隔符（声部/曲目/演出日程 之间）
  const ids = ["sections", "repertoire", "concerts"];
  ids.forEach((id) => {
    const sec = document.getElementById(id);
    if (sec && sec.parentElement) {
      const d = document.createElement("div");
      d.className = "divider";
      d.setAttribute("aria-hidden", "true");
      d.innerHTML = "<span>𝄂 𝄞 𝄢 𝄂</span>";
      sec.parentElement.insertBefore(d, sec);
    }
  });
})();

/* ---------- 8. 迷你播放器：常演曲目主题动机试听 ----------
   六首主题动机全部由 Web Audio 现场合成（循环播放，无音频文件）。
   当前曲目高亮 + 进度条随播放推进；控制台播放/暂停键与之联动。
   ----------------------------------------------------------- */
(function initMiniPlayer() {
  const N = {
    E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    Eb4: 311.13, Gb4: 349.23, Ab4: 415.3, Gb2: 83.31, A2: 110.0,
    Bb2: 116.54, Bb3: 233.08, C4: 261.63, C5: 523.25, D5: 587.33,
    D4: 293.66, E5: 659.25, F5: 698.46, G5: 784.0, F3: 174.61,
    D3: 146.83, A3: 220.0, B3: 246.94, D6: 1174.7
  };

  // [音高/和弦, 拍数]；null = 休止
  const P = {
    bach: [
      [N.C4, 1], [N.E4, 1], [N.G4, 1], [N.C5, 2],
      [N.B4, 1], [N.A4, 1], [N.G4, 1], [N.E4, 2],
      [N.G4, 1], [N.A4, 1], [N.B4, 1], [N.C5, 3], [null, 1],
      [N.C5, 1], [N.B4, 1], [N.A4, 1], [N.G4, 1], [N.E4, 3], [null, 1],
    ],
    mozart: [
      [N.C4, 1], [N.E4, 1], [N.G4, 1], [N.C5, 1], [N.B4, 1], [N.G4, 1],
      [N.A4, 1], [N.G4, 1], [N.E4, 1], [N.C4, 2],
      [N.D4, 1], [N.F4, 1], [N.G4, 1], [N.A4, 1], [N.F4, 1], [N.D4, 1],
      [N.E4, 1], [N.C4, 3], [null, 1],
    ],
    beethoven: [
      [N.G4, 1], [N.G4, 1], [N.G4, 1], [N.Eb4, 3],
      [N.G4, 1], [N.G4, 1], [N.G4, 1], [N.E4, 3],
      [N.G4, 1], [N.Bb3, 1], [N.C4, 1], [N.D4, 2],
      [N.G4, 1], [N.E4, 1], [N.F4, 1], [N.D4, 3], [null, 1],
    ],
    tchaikovsky: [
      [N.B4, 2], [N.G4, 1], [N.D5, 3],
      [N.B4, 2], [N.G4, 1], [N.D5, 1], [N.F5, 2],
      [N.G5, 2], [N.E5, 1], [N.D5, 3], [null, 1],
    ],
    dvorak: [
      [N.B3, 3], [N.A3, 3],
      [N.D4, 1], [N.F4, 1], [N.G4, 2], [N.A4, 3],
      [N.G4, 3], [N.F4, 1], [N.D4, 3], [N.B3, 4],
      [N.E4, 3], [N.F4, 3], [N.G4, 1], [N.D4, 5], [null, 1],
    ],
    mahler: [
      [N.Gb2, 2], [N.A2, 2],
      [N.C4, 2], [N.D4, 2], [N.G4, 2], [N.Gb2, 4],
      [N.A2, 2], [N.Bb2, 2], [N.D4, 2], [N.E4, 2], [N.A2, 6],
    ],
  };

  const TEMPO = 0.42; // 每拍秒数
  const BEATS = 60;   // 循环总拍数（进度条满）

  const wrap = document.getElementById("playerTracks");
  const bar = document.getElementById("playerProgress");
  const trackBtn = document.getElementById("playerToggle");
  const trackChip = document.getElementById("playerNow");

  let active = null;     // 当前曲目对象
  let activeStart = 0;   // 循环起点（音频时钟）
  let playing = false;
  let schedTimer = null;
  let progRaf = 0;

  // 标题行：作曲家 + 曲名（与常演曲目一致）
  const TITLES = {
    bach: "巴赫 · 咏叹调",
    mozart: "莫扎特 · 第四十交响曲",
    beethoven: "贝多芬 · 命运",
    tchaikovsky: "柴可夫斯基 · 天鹅湖",
    dvorak: "德沃夏克 · 自新大陆",
    mahler: "马勒 · 第五交响曲",
  };

  const tracks = Object.keys(P);
  wrap.innerHTML = tracks
    .map((k, i) => `
      <button class="mini-player__track" data-tr="${k}" aria-pressed="false">
        <span class="mini-player__idx">${i + 1}</span>
        <span class="mini-player__name">${TITLES[k]}</span>
        <span class="mini-player__play" aria-hidden="true">𝄞</span>
      </button>`).join("");

  const trackEls = wrap.querySelectorAll(".mini-player__track");
  trackEls.forEach((el) =>
    el.addEventListener("click", () => select(el.dataset.tr))
  );

  function markActive(key) {
    trackEls.forEach((el) => {
      const on = el.dataset.tr === key;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const label = key ? "正在试听 · " + TITLES[key] : "点击曲目试听";
    if (trackChip) trackChip.textContent = label;
    const consoleNow = document.getElementById("audioNow");
    if (consoleNow) consoleNow.textContent = key ? "♪ " + label : "点击声部或曲目开始试听";
  }

  function clearSched() {
    if (schedTimer) { clearTimeout(schedTimer); schedTimer = null; }
  }

  function noteAt(arr, beat) {
    let b = 0;
    for (const [p, d] of arr) {
      if (beat < b + d) return p;
      b += d;
    }
    return null;
  }

  function schedule(key) {
    const ctx = AudioBus.getCtx();
    const master = AudioBus.getMaster();
    const arr = P[key];
    const beatLen = TEMPO;
    const t0 = ctx.currentTime + 0.06;
    activeStart = t0;

    // 预先调度一个完整循环；循环结束前重新调度
    let t = t0;
    let beat = 0;
    while (t < t0 + BEATS * beatLen) {
      const p = noteAt(arr, beat);
      if (p) {
        const osc = ctx.createOscillator();
        osc.type = key === "mahler" ? "sine" : "triangle";
        osc.frequency.value = p;
        const g = ctx.createGain();
        const a = beatLen * 0.9;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a);
        osc.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + a + 0.05);
      }
      beat += 1;
      t += beatLen;
    }

    const dur = BEATS * beatLen;
    clearSched();
    schedTimer = setTimeout(() => {
      if (active === key && playing) schedule(key);
    }, (dur - 2) * 1000);
  }

  function stopProgress() {
    if (progRaf) { cancelAnimationFrame(progRaf); progRaf = 0; }
    if (bar) bar.style.width = "0%";
  }

  function startProgress() {
    stopProgress();
    (function tick() {
      if (!playing || !active) return;
      const ctx = AudioBus.getCtx();
      const el = (ctx.currentTime - activeStart) / (BEATS * TEMPO);
      const pct = ((el % 1 + 1) % 1) * 100;
      if (bar) bar.style.width = pct.toFixed(1) + "%";
      progRaf = requestAnimationFrame(tick);
    })();
  }

  function select(key) {
    active = key;
    playing = true;
    markActive(key);
    if (trackBtn) trackBtn.textContent = "暂停";
    clearSched();
    schedule(key);
    startProgress();
  }

  function toggleActive() {
    if (!active) {
      // 无高亮曲目 → 默认从头播放第一首
      select(tracks[0]);
      return;
    }
    if (playing) {
      playing = false;
      clearSched();
      stopProgress();
      if (trackBtn) trackBtn.textContent = "播放";
    } else {
      playing = true;
      schedule(active);
      startProgress();
      if (trackBtn) trackBtn.textContent = "暂停";
    }
  }

  if (trackBtn) trackBtn.addEventListener("click", toggleActive);
})();

/* ---------- 9. 全局音频控制台（悬浮） ---------- */
(function initAudioConsole() {
  const root = document.getElementById("audioConsole");
  const btn = document.getElementById("audioConsoleToggle");
  const canvas = document.getElementById("audioSpectrum");
  const vol = document.getElementById("audioVolume");

  root.classList.add("is-open"); // 默认展开，首次手势后自动出声
  btn.addEventListener("click", () => {
    AudioBus.ensure();
    AudioBus.resume();
    root.classList.toggle("is-open");
  });

  vol.addEventListener("input", () => {
    const v = Number(vol.value) / 100;
    AudioBus.setVolume(v);
  });
  AudioBus.setVolume(Number(vol.value) / 100);

  // 金色频谱：随 AnalyserNode 数据跳动
  const ctx2d = canvas.getContext("2d");
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);
    const data = AudioBus.getFrequencies();
    const bars = 40;
    const step = Math.floor(data.length / bars);
    const bw = W / bars;
    for (let i = 0; i < bars; i++) {
      const v = data ? (data[i * step] / 255) : 0;
      const bh = Math.max(2, v * H);
      const x = i * bw + 1;
      ctx2d.fillStyle = `rgba(201, 164, 92, ${0.35 + v * 0.65})`;
      ctx2d.fillRect(x, H - bh, bw - 2, bh);
    }
    requestAnimationFrame(draw);
  }
  draw();

  // “正在发声”提示：有音频时点亮
  let live = false;
  (function watch() {
    const lvl = AudioBus.getLevel();
    const on = lvl > 0.04;
    if (on !== live) {
      live = on;
      root.classList.toggle("is-live", on);
    }
    setTimeout(watch, 400);
  })();
})();

/* ---------- 10. 购票表单：校验 + 反馈 ---------- */
(function initTicketForm() {
  const form = document.getElementById("ticketForm");
  const note = document.getElementById("ticketNote");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("tName").value.trim();
    const email = document.getElementById("tEmail").value.trim();
    const level = document.getElementById("tLevel").value;

    note.className = "ticket__note";

    if (!name) {
      note.textContent = "请填写您的姓名。";
      note.classList.add("err");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      note.textContent = "请填写有效的邮箱地址。";
      note.classList.add("err");
      return;
    }

    const levelText = { vip: "VIP 乐友（含彩排）", gold: "金卡会员", standard: "普通会员" }[level];
    note.textContent = `欢迎，${name}！您已登记为「${levelText}」，确认函已发送至 ${email}。`;
    note.classList.add("ok");
    form.reset();
  });
})();

/* ---------- 11. 滚动入场动画 ---------- */
(function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  // 标记需要入场动画的元素（section 标题、卡片）
  document
    .querySelectorAll(".section__eyebrow, .section__title, .section__lead, .voice, .conductor, .rep__item, .hero__stats, .mini-player")
    .forEach((el) => el.classList.add("reveal"));
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
