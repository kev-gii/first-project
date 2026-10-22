/* ---------- 5.5 SoundFont 式采样层（2.1）：本地 WAV 优先，缺失时回退振荡器合成 ----------
   采样由 tools/make-soundfont-samples.py 生成（public/assets/soundfont/，含 manifest.json）。
   fetch + AudioBus.decode 得到 AudioBuffer，用 BufferSourceNode 播放；
   任一采样缺失（如 file:// 直开、网络异常）→ hasXxx 返回 false → 原合成路径。 */
import AudioBus from "./audio-bus.js";

const SoundSamples = (() => {
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

export default SoundSamples;
