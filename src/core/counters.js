/* ---------- 4. 数字滚动动画 ---------- */
export function initCounters() {
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
}
