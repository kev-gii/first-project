/* ---------- 6. 声部卡片：采样音色优先（2.1），缺失回退定制合成 ----------
   弦乐：叠层失谐 + 颤音 + 弦弓摩擦（低通噪声）
   木管：簧片起音 + 呼吸声 + 颤音
   铜管：加宽和弦 + 明亮锯齿 + 颤音
   打击乐：噪声包络鼓槌 + 低频鼓胸 + 金属泛音 */
import AudioBus from "../audio/audio-bus.js";
import SoundSamples from "../audio/sound-samples.js";

export function initVoices() {
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
}
