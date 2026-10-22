/* ---------- 7. 演出日程：外部数据 + 动态渲染 + .ics 下载 ----------
   数据同时交给 ConcertData（座位图选座等复用同一份场次） */
import { ConcertData } from "./shared.js";

export function initConcerts() {
  // 数据外置：优先 fetch 外部 JSON；file:// 或 fetch 失败时回退内嵌数据
  // （内容更新只需改 public/data/concerts.json，无需改 JS）
  const FALLBACK = [
    { d: "11", m: "11月", title: "贝多芬 · 命运交响夜", desc: "指挥：艾琳 · 冯·哈根 · 贝多芬《第五交响曲》《第六交响曲 '田园'》", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "24", m: "11月", title: "柴可夫斯基之夜", desc: "指挥：陆之弦 · 《天鹅湖》精选 · 《第一钢琴协奏曲》", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "08", m: "12月", title: "冬之序曲 · 新年音乐周", desc: "指挥：凯勒 · 安德森 · 小约翰·施特劳斯圆舞曲专场", sold: true, year: 2026, time: "20:00", venue: "AURORA 音乐厅 · 大厅" },
    { d: "21", m: "12月", title: "马勒 · 第五交响曲", desc: "驻团青年系列 · 指挥：索菲亚 · 里德尔 · 与小泽征尔基金会合作", sold: false, year: 2026, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
    { d: "05", m: "1月", title: "德沃夏克 · 自新大陆", desc: "指挥：艾琳 · 冯·哈根 · 与合唱团联袂 · 观众投票最受欢迎曲目", sold: false, year: 2027, time: "19:30", venue: "AURORA 音乐厅 · 主舞台" },
  ];
  const wrap = document.getElementById("concertList");
  if (!wrap) return;

  function icsEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  // 计算场次的绝对日期：以 json 里的 year 为准（跨年场次如 1 月应写次年）
  function concertDate(c) {
    const y = Number(c.year) || new Date().getFullYear();
    const mo = Number(c.m.replace(/月/, "")) - 1;
    return new Date(y, mo, Number(c.d));
  }

  function buildICS(c) {
    const dt = concertDate(c);
    const [hh, mm] = String(c.time || "19:30").split(":");
    dt.setHours(Number(hh), Number(mm), 0, 0);
    const durMin = 120;
    const end = new Date(dt.getTime() + durMin * 60000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
      `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
    const uid = `aurora-${c.year || dt.getFullYear()}-${c.d}-concert@example.com`;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AURORA//Concerts//CN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dt)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${icsEscape("交响乐团 · " + c.title)}`,
      `DESCRIPTION:${icsEscape(c.desc || "")}`,
      `LOCATION:${icsEscape(c.venue || "AURORA 音乐厅")}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
  }

  function downloadICS(c) {
    const blob = new Blob([buildICS(c)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = c.title.replace(/[·、，]/g, "-") + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function render(concerts) {
    wrap.innerHTML = concerts
      .map((c, i) => `\n      <div class="concert ${c.sold ? "is-soldout" : ""} reveal">\n        <div class="concert__date">\n          <strong>${c.d}</strong>\n          <span>${c.m}</span>\n        </div>\n        <div class="concert__body">\n          <h3>${c.title}</h3>\n          <p>${c.desc}</p>\n        </div>\n        <div class="concert__actions">\n          ${c.sold
        ? `<a class="btn btn--ghost concert__soldout" href="#ticket" style="border-color:#555">已售罄</a>`
        : `<a class="btn btn--gold" href="#seatmap" data-seatpick="${i}">选座购票</a>`}\n          <button class="concert__ics" type="button" data-ics="${i}" aria-label="将「${c.title}」加入日历">加日历</button>\n        </div>\n      </div>`
      )
      .join("");

    wrap.querySelectorAll("[data-ics]").forEach((btn) => {
      btn.addEventListener("click", () => downloadICS(concerts[Number(btn.dataset.ics)]));
    });
    // 「选座购票」→ 预选该场次（选座模块在 ConcertData 上消费这个值）
    wrap.querySelectorAll("[data-seatpick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pick = document.getElementById("seatConcert");
        if (pick) { pick.value = btn.dataset.seatpick; pick.dispatchEvent(new Event("change")); }
      });
    });
    // 卡片入场动画（render 后追加 .reveal）交给 initReveal 统一观察
  }

  fetch("data/concerts.json")
    .then((r) => {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    })
    .then((data) => {
      const list = Array.isArray(data) && data.length ? data : FALLBACK;
      render(list);
      ConcertData.deliver(list); // 座位图等复用
    })
    .catch(() => { render(FALLBACK); ConcertData.deliver(FALLBACK); }); // file:// 或网络异常 → 内嵌数据保底

  // 小节线分隔符（声部/曲目/演出日程 之间）
  const ids = ["sections", "repertoire", "concerts"];
  ids.forEach((id) => {
    const sec = document.getElementById(id);
    if (sec && sec.parentElement) {
      const d = document.createElement("div");
      d.className = "divider";
      d.setAttribute("aria-hidden", "true");
      d.innerHTML = "<span>𝄂 𝄞 𝄢 𝄂</span>";
      sec.parentElement.insertBefore(d, sec);
    }
  });
}
