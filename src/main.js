/* 入口模块：按原 script.js 的顺序初始化各功能。
   <script type="module"> 默认 defer，DOM 解析完成后再执行，无需 DOMContentLoaded。
   AudioBus / SoundSamples 在 import 时即建立（SoundSamples 静默预拉采样）。 */
import { initCanvas } from "./core/canvas.js";
import { initNav, initTheme, initReveal } from "./core/theme-nav.js";
import { initCounters } from "./core/counters.js";
import { initVoices } from "./core/voices.js";
import { initConcerts } from "./core/concerts.js";
import { initMiniPlayer } from "./core/mini-player.js";
import { initAudioConsole } from "./core/audio-console.js";
import { initTicketForm } from "./core/ticket-form.js";
import { initSeatMap } from "./core/seat-map.js";

initCanvas();
initNav();
initTheme();
initCounters();
initVoices();
initConcerts();
initMiniPlayer();
initAudioConsole();
initTicketForm();
initReveal();
initSeatMap();
