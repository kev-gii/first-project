/* ---------- 共享工具：演出数据单例 + 性能降级检测（5.2） ---------- */

// 演出数据单例：initConcerts 拉取后 deliver，座位图（initSeatMap）等复用同一份
let _resolveFn;
export const ConcertData = {
  promise: new Promise((res) => { _resolveFn = res; }),
  deliver(list) { _resolveFn(list); },
};

// 性能降级（5.2）：
// - prefers-reduced-motion → 画布只画一帧静态粒子，不进 rAF 循环
// - 低端设备（核心数少 / 内存小 / 高 DPR）→ 粒子数量减半
export function perfProfile() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowEnd =
    (navigator.hardwareConcurrency || 4) <= 4 ||
    (navigator.deviceMemory || 8) <= 4 ||
    window.devicePixelRatio > 2.5;
  return { reduced, lowEnd, count: lowEnd ? 13 : 26 };
}
