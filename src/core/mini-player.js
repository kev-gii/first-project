/* ---------- 8.1 迷你曲目播放器：旋律引擎 + SoundFont 采样（2.1）优先 ----------
   标题行显示「作曲家 · 曲名」；当前曲目高亮 + 进度条随播放推进；
   控制台播放/暂停键与之联动。采样缺失时回退振荡器引擎。 */
import AudioBus from "../audio/audio-bus.js";
import SoundSamples from "../audio/sound-samples.js";

export function initMiniPlayer() {
  const N = {
    E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    Eb4: 311.13, Gb4: 349.23, Ab4: 415.3, Gb2: 83.31, A2: 110.0,
    Bb2: 116.54, Bb3: 233.08, C4: 261.63, C5: 523.25, D5: 587.33,
    D4: 293.66, E5: 659.25, F5: 698.46, G5: 784.0, F3: 174.61,
    D3: 146.83, A3: 220.0, B3: 246.94, D6: 1174.7,
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
  const BEATS = 60; // 循环总拍数（进度条满）

  const wrap = document.getElementById("playerTracks");
  const bar = document.getElementById("playerProgress");
  const trackBtn = document.getElementById("playerToggle");
  const trackChip = document.getElementById("playerNow");
  if (!wrap) return;

  let active = null; // 当前曲目对象
  let activeStart = 0; // 循环起点（音频时钟）
  let playing = false;
  let schedTimer = null;
  let progRaf = 0;
  let loopGain = null; // 当前一轮循环的独立增益组（切换/暂停时整体断开）
  let progressDur = BEATS * TEMPO; // 当前播放周期时长（采样模式 = 采样实际时长）

  // 立即停止所有已排程的振荡器：断开本轮 loopGain + 清重排定时器
  // （预排程的音符在未来时间才出声，必须整组断开才能立刻静音）
  // 同时停掉 2.1 的采样循环（若当前是采样模式）
  function stopScheduled() {
    SoundSamples.stopAll(); // 采样循环（未激活时是 no-op）
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
    .map((k, i) => `\n      <button class="mini-player__track" data-tr="${k}" aria-pressed="false" aria-label="试听${TITLES[k]}">\n        <span class="mini-player__idx" aria-hidden="true">${i + 1}</span>\n        <span class="mini-player__name">${TITLES[k]}</span>\n        <span class="mini-player__play" aria-hidden="true">𝄞</span>\n      </button>`)
    .join("");

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

    // 预排程一个完整循环；循环结束前重排
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
    stopScheduled(); // 先停上一首（含已排程未播的音符与采样循环），再播新的
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
}
