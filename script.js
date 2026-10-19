/* ============================================================
   AURORA 交响乐团 — 交互脚本（原生 JavaScript）
   ============================================================ */
"use strict";

/* ---------- 1. 背景画布：漂浮的音符粒子 ---------- */
(function initCanvas() {
  const canvas = document.getElementById("stage-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, notes;

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
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      n.y -= n.speed;
      n.x += n.drift;
      n.rot += n.spin;
      if (n.y < -60) notes[i] = makeNote();
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rot);
      ctx.font = `${n.size}px "Playfair Display", serif`;
      ctx.fillStyle = `rgba(201, 164, 92, ${n.alpha})`;
      ctx.fillText(n.glyph, 0, 0);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  init();
  tick();
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

/* ---------- 4. 声部卡片：Web Audio 合成音色试听 ---------- */
(function initVoices() {
  let audioCtx = null;
  const cards = document.querySelectorAll(".voice[data-note]");

  function play(card) {
    // 首次交互时才创建 AudioContext（浏览器自动播放策略）
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const freq = Number(card.dataset.note);
    const type = card.dataset.wave || "sine";
    const gain = Number(card.dataset.gain) || 0.1;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const master = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // 两个振荡器叠加，模拟真实声部"一个音"的厚度
    osc.type = type;
    osc2.type = type;
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 1.005; // 轻微失谐
    filter.type = "lowpass";
    filter.frequency.value = Math.min(freq * 4, 3500);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(master);
    master.connect(audioCtx.destination);

    // 音包络：快速起音 + 缓慢衰减
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(gain, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.9);
    osc2.stop(now + 1.9);

    card.classList.add("is-playing");
    setTimeout(() => card.classList.remove("is-playing"), 1900);
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

/* ---------- 5. 演出日程：动态渲染 ---------- */
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

/* ---------- 6. 购票表单：校验 + 反馈 ---------- */
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

/* ---------- 7. 滚动入场动画 ---------- */
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
    .querySelectorAll(".section__eyebrow, .section__title, .section__lead, .voice, .conductor, .rep__item, .hero__stats")
    .forEach((el) => el.classList.add("reveal"));
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
