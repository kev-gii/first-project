/* ---------- 9. 全局音频控制台（悬浮）：展开/收起 + 音量 + 频谱 ---------- */
import AudioBus from "../audio/audio-bus.js";

export function initAudioConsole() {
  const root = document.getElementById("audioConsole");
  const btn = document.getElementById("audioConsoleToggle");
  const canvas = document.getElementById("audioSpectrum");
  const vol = document.getElementById("audioVolume");
  if (!root || !btn) return;

  root.classList.add("is-open"); // 默认展开，首次手势后自动出声
  btn.addEventListener("click", () => {
    AudioBus.ensure();
    AudioBus.resume();
    root.classList.toggle("is-open");
  });

  if (vol) {
    vol.addEventListener("input", () => {
      const v = Number(vol.value) / 100;
      AudioBus.setVolume(v);
    });
    AudioBus.setVolume(Number(vol.value) / 100);
  }

  // 金色频谱：随 AnalyserNode 数据跳动
  if (canvas) {
    const ctx2d = canvas.getContext("2d");
    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx2d.clearRect(0, 0, W, H);
      const data = AudioBus.getFrequencies();
      const bars = 40;
      const step = data ? Math.floor(data.length / bars) : 1;
      const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const v = data ? data[i * step] / 255 : 0;
        const bh = Math.max(2, v * H);
        const x = i * bw + 1;
        ctx2d.fillStyle = `rgba(201, 164, 92, ${0.35 + v * 0.65})`;
        ctx2d.fillRect(x, H - bh, bw - 2, bh);
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

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
}
