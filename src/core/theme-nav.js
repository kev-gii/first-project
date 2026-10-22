/* ---------- 2. 导航：滚动态 + 移动端菜单 ---------- */
/* ---------- 3. 主题切换 + 音乐厅灯光（按时间自动） ---------- */
/* ---------- 11. 滚动入场动画 ---------- */

export function initNav() {
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const links = document.querySelector(".nav__links");
  if (!nav || !burger || !links) return;

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }, { passive: true });

  burger.addEventListener("click", () => links.classList.toggle("is-open"));

  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("is-open"))
  );
}

export function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (!btn || !icon || !label) return;

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
}

export function initReveal() {
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
    .querySelectorAll(".section__eyebrow, .section__title, .section__lead, .voice, .conductor, .rep__item, .hero__stats, .mini-player")
    .forEach((el) => el.classList.add("reveal"));
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}
