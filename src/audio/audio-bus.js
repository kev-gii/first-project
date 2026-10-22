/* ---------- 5. 共享音频总线（AnalyserNode 供频谱/粒子使用） ---------- */
const AudioBus = (() => {
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

export default AudioBus;
