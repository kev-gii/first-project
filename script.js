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

  // 性能降级（5.2）：
  // - prefers-reduced-motion → 只画一帧静态粒子，不进 rAF 循环
  // - 低端设备（核心数少 / 内存小 / 高 DPR）→ 粒子数量减半
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowEnd =
    (navigator.hardwareConcurrency || 4) <= 4 ||
    (navigator.deviceMemory || 8) <= 4 ||
    window.devicePixelRatio > 2.5;
  const COUNT = lowEnd ? 13 : 26;

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
    notes = Array.from({ length: COUNT }, () => {
      const n = makeNote();
      n.y = Math.random() * h; // 首帧铺满全屏
      return n;
    });
  }

  function paint() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const a = Math.min(0.55, n.alpha + level * 0.45);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rot);
      ctx.font = `${n.size}px "Playfair Display", serif`;
      ctx.fillStyle = `rgba(201, 164, 92, ${a})`;
      ctx.fillText(n.glyph, 0, 0);
      ctx.restore();
    }
  }

  function tick() {
    // 平滑跟踪当前音频电平：有声时粒子更亮、更活跃
    const target = AudioBus.getLevel();
    level += (target - level) * 0.08;

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      n.y -= n.speed * (1 + level * 3.5);
      n.x += n.drift;
      n.rot += n.spin * (1 + level * 2);
      if (n.y < -60) notes[i] = makeNote();
    }
    paint();
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduced) paint(); // 降级模式下 resize 后重绘静态帧
  });
  init();
  if (reduced) {
    // prefers-reduced-motion：静态粒子背景，不跑动画循环
    paint();
  } else {
    requestAnimationFrame(tick); // 首帧走 rAF：此时整个脚本已加载完，AudioBus 已就绪（避开 const TDZ）
  }
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

  // WAV 采样解码（SoundFont 采样播放用，2.1）
  function decode(arrayBuffer) {
    ensure();
    return ctx.decodeAudioData(arrayBuffer);
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

  return { getCtx, getMaster, ensure, resume, decode, setVolume, getLevel, getFrequencies };
})();

/* ---------- 5.5 SoundFont 式采样层（2.1）：本地 WAV 优先，缺失时回退振荡器合成 ----------
   采样由 tools/make-soundfont-samples.py 生成（assets/soundfont/，含 manifest.json）。
   fetch + AudioBus.decode 得到 AudioBuffer，用 BufferSourceNode 播放；
   任一采样缺失（如 file:// 直开、网络异常）→ hasXxx 返回 false → 原合成路径。
   --------------------------------------------------------------- */
const SoundSamples = (function () {
  const cache = {}; // key → AudioBuffer（加载成功才写入）
  const pending = new Set(); // 正在加载的 key（防重复 fetch）

  function fetchOne(key) {
    if (cache[key] || pending.has(key)) return;
    pending.add(key);
    fetch("assets/soundfont/" + key + ".wav")
      .then((r) => {
        if (!r.ok) throw new Error("http " + r.status);
        return r.arrayBuffer();
      })
      .then((ab) => AudioBus.decode(ab))
      .then((buf) => { cache[key] = buf; })
      .catch(() => { /* 采样不可用 → 保持振荡器合成（回退） */ });
  }

  function prime() {
    fetchOne("strings"); fetchOne("woodwinds"); fetchOne("brass"); fetchOne("percussion");
    ["bach", "mozart", "beethoven", "tchaikovsky", "dvorak", "mahler"].forEach(fetchOne);
  }

  function hasVoice(key) { return Boolean(cache[key]); }
  function hasTrack(key) { return Boolean(cache[key]); }
  function durationOf(key) { return cache[key] ? cache[key].duration : 0; }

  // 播放一段采样（声部示范，一次性 + 尾部淡出）
  function playVoice(key) {
    const buf = cache[key];
    if (!buf) return false;
    const ctx = AudioBus.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    const now = ctx.currentTime;
    const end = now + buf.duration - 0.08;
    g.gain.setValueAtTime(0.9, end);
    g.gain.exponentialRampToValueAtTime(0.0001, now + buf.duration);
    src.connect(g); g.connect(AudioBus.getMaster());
    src.start(now);
    return true;
  }

  // 循环播放曲目采样；onEnd 在一轮结束时回调（供进度条推进）
  let curSrc = null, curGain = null, curLoopTimer = null;

  function stopAll() {
    if (curSrc) { try { curSrc.stop(); } catch (e) { /* 已停止 */ } curSrc = null; }
    if (curGain) { try { curGain.disconnect(); } catch (e) { /* 已断开 */ } curGain = null; }
    if (curLoopTimer) { clearTimeout(curLoopTimer); curLoopTimer = null; }
  }

  function loopTrack(key) {
    const buf = cache[key];
    if (!buf) return false;
    stopAll();
    const ctx = AudioBus.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.95;
    src.connect(g); g.connect(AudioBus.getMaster());
    src.start();
    curSrc = src; curGain = g;
    const durMs = buf.duration * 1000;
    curLoopTimer = setTimeout(function tick() {
      if (curSrc !== src) return; // 已切走/停掉
      curLoopTimer = setTimeout(tick, durMs);
    }, durMs);
    return true;
  }

  prime(); // 首次用户手势（点击声部/曲目）前就静默拉取，命中后即时可用
  return { hasVoice, hasTrack, durationOf, playVoice, loopTrack, stopAll };
})();

/* ---------- 6. 声部卡片：采样音色优先（2.1），缺失回退定制合成 ----------
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
    const key = card.dataset.voice || "strings";
    // SoundFont 采样优先：有本地采样就用（音色更接近真实）；没有 → 下方振荡器合成
    if (SoundSamples.hasVoice(key) && SoundSamples.playVoice(key)) {
      card.classList.add("is-playing");
      setTimeout(() => card.classList.remove("is-playing"), 2100);
      return;
    }
    const ctx = AudioBus.getCtx();
    const master = AudioBus.getMaster();
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

/* ---------- 7. 演出日程：外部数据 + 动态渲染 + .ics 下载 ----------
   数据同时交给 ConcertData（座位图选座等复用同一份场次） */
const ConcertData = (function () {
  let resolveFn;
  const promise = new Promise((res) => { resolveFn = res; });
  return { promise, deliver(list) { resolveFn(list); } };
})();
(function initConcerts() {
  // 数据外置：优先 fetch 外部 JSON；file:// 或 fetch 失败时回退内嵌数据
  // （内容更新只需改 data/concerts.json，无需改 JS）
  const FALLBACK = [
    { d: "11", m: "11月", title: "贝多芬 · 命运交响夜", desc: "指挥：艾琳 · 冯·哈根 · 贝多芬《第五交响曲》《第六交响曲 '田园'》", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "24", m: "11月", title: "柴可夫斯基之夜", desc: "指挥：陆之弦 · 《天鹅湖》精选 · 《第一钢琴协奏曲》", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "08", m: "12月", title: "冬之序曲 · 新年音乐周", desc: "指挥：凯勒 · 安德森 · 小约翰·施特劳斯圆舞曲专场", sold: true, year: 2026, time: "20:00", venue: "AURORA 音乐厅 · 大厅" },
    { d: "21", m: "12月", title: "马勒 · 第五交响曲", desc: "驻团青年系列 · 指挥：索菲亚 · 里德尔 · 与小泽征尔基金会合作", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "05", m: "1月", title: "德沃夏克 · 自新大陆", desc: "指挥：艾琳 · 冯·哈根 · 与合唱团联袂 · 观众投票最受欢迎曲目", sold: false, year: 2027, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
  ];
  const wrap = document.getElementById("concertList");

  function icsEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  // 计算场次的绝对日期：以 json 里的 year 为准（跨年场次如 1 月应写次年）
  function concertDate(c) {
    const y = Number(c.year) || new Date().getFullYear();
    const mo = Number(c.m.replace(/月/, "")) - 1;
    return new Date(y, mo, Number(c.d));
  }

  function buildICS(c) {
    const dt = concertDate(c);
    const [hh, mm] = String(c.time || "19:30").split(":");
    dt.setHours(Number(hh), Number(mm), 0, 0);
    const durMin = 120;
    const end = new Date(dt.getTime() + durMin * 60000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
      `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
    const uid = `aurora-${c.year || dt.getFullYear()}-${c.d}-concert@example.com`;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AURORA//Concerts//CN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dt)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${icsEscape("交响乐团 · " + c.title)}`,
      `DESCRIPTION:${icsEscape(c.desc || "")}`,
      `LOCATION:${icsEscape(c.venue || "AURORA 音乐厅")}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
  }

  function downloadICS(c) {
    const blob = new Blob([buildICS(c)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = c.title.replace(/[·、，]/g, "-") + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function render(concerts) {
    wrap.innerHTML = concerts
      .map((c, i) => `\n      <div class="concert ${c.sold ? "is-soldout" : ""} reveal">\n        <div class="concert__date">\n          <strong>${c.d}</strong>\n          <span>${c.m}</span>\n        </div>\n        <div class="concert__body">\n          <h3>${c.title}</h3>\n          <p>${c.desc}</p>\n        </div>\n        <div class="concert__actions">\n          ${c.sold
          ? `<a class="btn btn--ghost concert__soldout" href="#ticket" style="border-color:#555">已售罄</a>`
          : `<a class="btn btn--gold" href="#seatmap" data-seatpick="${i}">选座购票</a>`}\n          <button class="concert__ics" type="button" data-ics="${i}" aria-label="将「${c.title}」加入日历">加日历</button>\n        </div>\n      </div>`
      )
      .join("");

    wrap.querySelectorAll("[data-ics]").forEach((btn) => {
      btn.addEventListener("click", () => downloadICS(concerts[Number(btn.dataset.ics)]));
    });
    // 「选座购票」→ 预选该场次（选座模块在 ConcertData 上消费这个值）
    wrap.querySelectorAll("[data-seatpick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pick = document.getElementById("seatConcert");
        if (pick) { pick.value = btn.dataset.seatpick; pick.dispatchEvent(new Event("change")); }
      });
    });
  }

  fetch("data/concerts.json")
    .then((r) => {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    })
    .then((data) => {
      const list = Array.isArray(data) && data.length ? data : FALLBACK;
      render(list);
      ConcertData.deliver(list); // 座位图等复用
    })
    .catch(() => { render(FALLBACK); ConcertData.deliver(FALLBACK); }); // file:// 或网络异常 → 内嵌数据保底

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
  let loopGain = null;   // 当前一轮循环的独立增益组（切换/暂停时整体断开）
  let progressDur = BEATS * TEMPO; // 当前播放周期的时长（采样模式下 = 采样实际时长）

  // 立即停止所有已排程的振荡器：断开本轮 loopGain + 清重排定时器
  // （预排程的音符在未来时间才会出声，必须整组断开才能立刻静音）
  // 同时停掉 2.1 的采样循环（若当前是采样模式）
  function stopScheduled() {
    SoundSamples.stopAll(); // 采样循环（未激活时为无操作）
    clearSched();
    if (loopGain) {
      try { loopGain.disconnect(); } catch (e) { /* 已断开则忽略 */ }
      loopGain = null;
    }
  }

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
      <button class="mini-player__track" data-tr="${k}" aria-pressed="false" aria-label="试听${TITLES[k]}">
        <span class="mini-player__idx" aria-hidden="true">${i + 1}</span>
        <span class="mini-player__name">${TITLES[k]}</span>
        <span class="mini-player__play" aria-hidden="true">𝄞</span>
      </button>`).join("");

  const trackEls = wrap.querySelectorAll(".mini-player__track");
  trackEls.forEach((el) => {
    el.addEventListener("click", () => select(el.dataset.tr));
    // 键盘可访问：Enter / Space 触发（与 click 等效）
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(el.dataset.tr);
      }
    });
  });

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

    // 本轮循环挂独立增益组：切换/暂停时可整组断开，立即停掉所有已排程音符
    // （循环重排路径里旧增益组的音符已播完，先断开旧组再建新的）
    if (loopGain) { try { loopGain.disconnect(); } catch (e) { /* 忽略 */ } }
    loopGain = ctx.createGain();
    loopGain.connect(master);

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
        osc.connect(g); g.connect(loopGain);
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
      const el = (ctx.currentTime - activeStart) / progressDur;
      const pct = ((el % 1 + 1) % 1) * 100;
      if (bar) bar.style.width = pct.toFixed(1) + "%";
      progRaf = requestAnimationFrame(tick);
    })();
  }

  function select(key) {
    stopScheduled(); // 先停掉上一首（含已排程未播出的音符与采样循环），再播新的
    active = key;
    playing = true;
    markActive(key);
    if (trackBtn) trackBtn.textContent = "暂停";
    // 采样优先（2.1）：有本地曲目采样 → 循环播放（音色更真实）；缺失 → 振荡器引擎
    if (SoundSamples.hasTrack(key) && SoundSamples.loopTrack(key)) {
      progressDur = SoundSamples.durationOf(key);
      activeStart = AudioBus.getCtx().currentTime;
    } else {
      progressDur = BEATS * TEMPO;
      schedule(key);
    }
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
      stopScheduled(); // 暂停：整组断开，预排程的剩余音符立即静音
      stopProgress();
      if (trackBtn) trackBtn.textContent = "播放";
    } else {
      playing = true;
      // 采样优先（2.1）：恢复播放时同样先试采样，缺失才走振荡器引擎
      if (SoundSamples.hasTrack(active) && SoundSamples.loopTrack(active)) {
        progressDur = SoundSamples.durationOf(active);
        activeStart = AudioBus.getCtx().currentTime;
      } else {
        schedule(active);
      }
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

/* ---------- 12. 选座购票（3.2）：半圆看台 SVG 座位图 + 订单摘要 ----------
    12 排 × 21 座 = 252 座。看台为舞台（顶部）向下的同心圆弧。
    票价档位：VIP 前区（1–3 排）¥880 · 金卡区（4–7 排）¥560 · 普通区（8–12 排）¥380
    已售座位按场次稳定哈希生成（同一场次每次打开布局一致），最多选 8 座。 */
(function initSeatMap() {
  const svg = document.getElementById("seatMapSvg");
  const pick = document.getElementById("seatConcert");
  const listEl = document.getElementById("seatList");
  const totalEl = document.getElementById("seatTotal");
  const emptyEl = document.getElementById("seatEmpty");
  const confirmBtn = document.getElementById("seatConfirm");
  const doneEl = document.getElementById("seatDone");
  if (!svg || !pick) return;

  const NS = "http://www.w3.org/2000/svg";
  const ROWS = 12, PER_ROW = 21, MAX_PICK = 8;
  const VIEW_W = 800, VIEW_H = 450;
  const CX = VIEW_W / 2;          // 水平中点
  const CY = 70;                 // 圆心 = 舞台中心（顶部），座位向观众（下方）扇形展开
  const R_IN = 120;               // 第 1 排（VIP，离舞台最近）半径，最小
  const DR = 20;                 // 相邻排半径差（排距）
  const THETA_IN = 0.95;         // 第 1 排半弧宽（弧度，≈54°）
  const THETA_DR = 0.018;         // 越往后弧越宽；后区半弧 ≈65.7°，角点 x≈±311、y≈210 在 viewBox 内

  const tierOf = (row) => (row <= 3 ? "vip" : row <= 7 ? "gold" : "std");
  const priceOf = (row) => (row <= 3 ? 880 : row <= 7 ? 560 : 380);
  const tierName = { vip: "VIP 前区", gold: "金卡区", std: "普通区" };

  // 舞台：台面 + 弧形台口（圆心 CY=70 在台面内，座位扇形向下展开）
  const stage = document.createElementNS(NS, "g");
  const apron = document.createElementNS(NS, "path");
  apron.setAttribute("d", "M 330 26 L 470 26 L 452 110 Q 400 122 348 110 Z");
  apron.setAttribute("class", "seatmap-stage");
  const label = document.createElementNS(NS, "text");
  label.setAttribute("x", CX);
  label.setAttribute("y", 72);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("class", "seatmap-stage-label");
  label.textContent = "舞 台";
  stage.appendChild(apron);
  stage.appendChild(label);
  svg.appendChild(stage);

  // 座位分组（每个座位自带 <title> 悬停提示）
  const seatG = document.createElementNS(NS, "g");
  svg.appendChild(seatG);

  let current = null;   // 当前场次
  const picked = [];    // 已选座位 [{row, col, label, price}]

  function seatPos(row, col) {
    // 每排 21 座（col 0–20）沿本排圆弧均匀分布；第 1 排半径最小（最靠舞台），越往后半径越大，
    // 看台向观众（下方）呈经典扇形。t 为本排圆弧上的角度：-th（左外）→ 0（正对舞台）→ +th（右外）。
    const r = R_IN + (row - 1) * DR;
    const th = THETA_IN + (row - 1) * THETA_DR; // 本排半弧宽（弧度）
    const t = -th + (col / 10) * th; // col 0→-th（左外），10→0（正中），20→+th（右外）；逐座步进 th/5
    // t=0 正对舞台；圆心在舞台中心（CY），cos(t) 向下展开
    return {
      x: CX + r * Math.sin(t),
      y: CY + r * Math.cos(t),
    };
  }

  function seatLabel(row, col) {
    // 两侧对称：中央 B1；靠中为 1 号向外递增到 10（col 0/20 最外 = 10 号，col 9/11 最靠中 = 1 号）
    const side = col < 10 ? "A" : col === 10 ? "B" : "C";
    const n = col === 10 ? 1 : col < 10 ? 10 - col : col - 10;
    return `R${row}·${side}${n}`;
  }

  // 确定性哈希：同场次同座位的售出状态恒定
  function isSold(concert, row, col) {
    const s = `${concert.d}|${row}-${col}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 100 < 22; // 约 22% 已售
  }

  function buildMap() {
    picked.length = 0;
    doneEl.textContent = "";
    while (seatG.firstChild) seatG.removeChild(seatG.firstChild);
    for (let row = 1; row <= ROWS; row++) {
      for (let col = 0; col < PER_ROW; col++) {
        const c = document.createElementNS(NS, "circle");
        const p = seatPos(row, col);
        c.setAttribute("cx", p.x.toFixed(1));
        c.setAttribute("cy", p.y.toFixed(1));
        c.setAttribute("r", 5);
        c.setAttribute("class", `seat seat--${tierOf(row)}`);
        c.dataset.row = row;
        c.dataset.col = col;
        const sold = isSold(current, row, col);
        if (sold) c.classList.add("is-sold");
        // 悬停提示：原生 <title>，随座位重建
        const tip = document.createElementNS(NS, "title");
        tip.textContent = sold
          ? `${seatLabel(row, col)} · 已售`
          : `${seatLabel(row, col)} · ${tierName[tierOf(row)]} 第 ${row} 排 · ¥ ${priceOf(row)}`;
        c.appendChild(tip);
        c.addEventListener("click", () => toggleSeat(c, row, col, sold));
        seatG.appendChild(c);
      }
    }
    renderPanel();
  }

  function toggleSeat(c, row, col, sold) {
    if (sold) return;
    const key = `${row}-${col}`;
    const i = picked.findIndex((s) => s.key === key);
    if (i >= 0) {
      picked.splice(i, 1);
      c.classList.remove("is-sel");
    } else {
      if (picked.length >= MAX_PICK) {
        doneEl.textContent = `最多可选 ${MAX_PICK} 座，先取消一座再选吧。`;
        return;
      }
      picked.push({ key, row, col, label: seatLabel(row, col), price: priceOf(row), tier: tierOf(row) });
      c.classList.add("is-sel");
    }
    doneEl.textContent = "";
    renderPanel();
  }

  function renderPanel() {
    emptyEl.style.display = picked.length ? "none" : "";
    listEl.innerHTML = "";
    let sum = 0;
    picked.slice().sort((a, b) => a.row - b.row || a.col - b.col).forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<span><strong>${s.label}</strong> <span class="seat-t">${tierName[s.tier]} ${s.row} 排</span></span><span>¥ ${s.price}</span>`;
      listEl.appendChild(li);
      sum += s.price;
    });
    totalEl.textContent = `¥ ${sum}`;
    confirmBtn.disabled = !picked.length;
  }

  function generateOrder() {
    if (!picked.length) return;
    const concertText = `${current.d} ${current.m} · ${current.title}`;
    const lines = [
      `【AURORA 选座订单摘要】`,
      `场次：${concertText}`,
      `场馆：${current.venue || "AURORA 音乐厅"}`,
      ``,
      ...picked.slice().sort((a, b) => a.row - b.row || a.col - b.col)
        .map((s) => `${s.label}（${tierName[s.tier]} ${s.row} 排） ¥ ${s.price}`),
      ``,
      `合计 ¥ ${picked.reduce((n, s) => n + s.price, 0)} · ${picked.length} 座`,
      `订单号：AU-${Date.now().toString(36).toUpperCase()}`,
    ];
    // 复制到剪贴板；失败则直接展示
    const text = lines.join("\n");
    doneEl.textContent = "订单摘要已生成（见下方）";
    doneEl.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "seatmap__order";
    pre.textContent = text;
    doneEl.appendChild(pre);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => { pre.textContent = text + "\n\n（已复制到剪贴板）"; },
        () => {}
      );
    }
  }

  confirmBtn.addEventListener("click", generateOrder);

  function loadOptions(list) {
    pick.innerHTML = "";
    const opts = list
      .map((c, i) => ({ i, sold: !!c.sold }))
      .filter((c) => !c.sold);
    if (!opts.length) {
      pick.innerHTML = `<option value="">暂无可选场次</option>`;
      return;
    }
    opts.forEach(({ i }) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = `${list[i].d} ${list[i].m} · ${list[i].title}`;
      pick.appendChild(o);
    });
    pick.value = String(opts[0].i);
    current = list[Number(pick.value)];
    buildMap();
  }

  // 切换场次：options 的 value 是场次在 list 中的索引；__list 由 ConcertData 填充
  function loadForIndex(idx) {
    if (!pick.__list) return;
    current = pick.__list[idx];
    buildMap();
  }
  pick.addEventListener("change", () => loadForIndex(Number(pick.value)));

  ConcertData.promise.then((list) => {
    pick.__list = list;
    loadOptions(list);
  });
})();
