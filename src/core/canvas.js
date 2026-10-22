/* ---------- 1. 背景画布：漂浮的音符粒子（随音频电平律动） ---------- */
import AudioBus from "../audio/audio-bus.js";
import { perfProfile } from "./shared.js";

export function initCanvas() {
  const canvas = document.getElementById("stage-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, notes;
  let level = 0; // 由画布自身每帧向 AudioBus 读取

  const GLYPHS = ["𝄞", "𝄢", "♪", "♩", "♫"];

  // 性能降级（5.2）：reduced → 静态一帧；低端 → 粒子数量减半
  const { reduced, count } = perfProfile();
  const COUNT = count;

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
}
