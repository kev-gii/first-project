/* ---------- 12. 选座购票（3.2）：半圆看台 SVG 座位图 + 订单摘要 ----------
   12 排 × 21 座 = 252 座。看台为舞台（顶部）向下的同心圆弧。
   票价档位：VIP 前区（1–3 排）¥880 · 金卡区（4–7 排）¥560 · 普通区（8–12 排）¥380
   已售座位按场次稳定哈希生成（同一场次每次打开布局一致），最多选 8 座。 */
import { ConcertData } from "./shared.js";

export function initSeatMap() {
  const svg = document.getElementById("seatMapSvg");
  const pick = document.getElementById("seatConcert");
  const listEl = document.getElementById("seatList");
  const totalEl = document.getElementById("seatTotal");
  const emptyEl = document.getElementById("seatEmpty");
  const confirmBtn = document.getElementById("seatConfirm");
  const doneEl = document.getElementById("seatDone");
  if (!svg || !pick) return;

  const NS = "http://www.w3.org/2000/svg";
  const ROWS = 12, PER_ROW = 21, MAX_PICK = 8;
  const VIEW_W = 800, VIEW_H = 450;
  const CX = VIEW_W / 2; // 水平中点
  const CY = 70; // 圆心 = 舞台中心（顶部），座位向观众（下方）扇形展开
  const R_IN = 120; // 第 1 排（VIP，离舞台最近）半径，最小
  const DR = 20; // 相邻排半径差（排距）
  const THETA_IN = 0.95; // 第 1 排半弧宽（弧度，≈54°）
  const THETA_DR = 0.018; // 越往后弧越宽；后区半弧 ≈65.7°

  const tierOf = (row) => (row <= 3 ? "vip" : row <= 7 ? "gold" : "std");
  const priceOf = (row) => (row <= 3 ? 880 : row <= 7 ? 560 : 380);
  const tierName = { vip: "VIP 前区", gold: "金卡区", std: "普通区" };

  // 舞台：台面 + 弧形台口
  const stage = document.createElementNS(NS, "g");
  const apron = document.createElementNS(NS, "path");
  apron.setAttribute("d", "M 330 26 L 470 26 L 452 110 Q 400 122 348 110 Z");
  apron.setAttribute("class", "seatmap-stage");
  const label = document.createElementNS(NS, "text");
  label.setAttribute("x", CX);
  label.setAttribute("y", 72);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("class", "seatmap-stage-label");
  label.textContent = "舞 台";
  stage.appendChild(apron);
  stage.appendChild(label);
  svg.appendChild(stage);

  // 座位分组（每个座位自带 <title> 悬停提示）
  const seatG = document.createElementNS(NS, "g");
  svg.appendChild(seatG);

  let current = null; // 当前场次
  const picked = []; // 已选座位 [{row, col, label, price}]

  function seatPos(row, col) {
    const r = R_IN + (row - 1) * DR;
    const th = THETA_IN + (row - 1) * THETA_DR; // 本排半弧宽（弧度）
    const t = -th + (col / 10) * th; // col 0→-th（左外），10→0（正中），20→+th（右外）
    return {
      x: CX + r * Math.sin(t),
      y: CY + r * Math.cos(t),
    };
  }

  function seatLabel(row, col) {
    const side = col < 10 ? "A" : col === 10 ? "B" : "C";
    const n = col === 10 ? 1 : col < 10 ? 10 - col : col - 10;
    return `R${row}·${side}${n}`;
  }

  // 确定性哈希：同场次同座位的售出状态恒定
  function isSold(concert, row, col) {
    const s = `${concert.d}|${row}-${col}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 100 < 22; // 约 22% 已售
  }

  function buildMap() {
    picked.length = 0;
    doneEl.textContent = "";
    while (seatG.firstChild) seatG.removeChild(seatG.firstChild);
    for (let row = 1; row <= ROWS; row++) {
      for (let col = 0; col < PER_ROW; col++) {
        const c = document.createElementNS(NS, "circle");
        const p = seatPos(row, col);
        c.setAttribute("cx", p.x.toFixed(1));
        c.setAttribute("cy", p.y.toFixed(1));
        c.setAttribute("r", 5);
        c.setAttribute("class", `seat seat--${tierOf(row)}`);
        c.dataset.row = row;
        c.dataset.col = col;
        const sold = isSold(current, row, col);
        if (sold) c.classList.add("is-sold");
        const tip = document.createElementNS(NS, "title");
        tip.textContent = sold
          ? `${seatLabel(row, col)} · 已售`
          : `${seatLabel(row, col)} · ${tierName[tierOf(row)]} 第 ${row} 排 · ¥ ${priceOf(row)}`;
        c.appendChild(tip);
        c.addEventListener("click", () => toggleSeat(c, row, col, sold));
        seatG.appendChild(c);
      }
    }
    renderPanel();
  }

  function toggleSeat(c, row, col, sold) {
    if (sold) return;
    const key = `${row}-${col}`;
    const i = picked.findIndex((s) => s.key === key);
    if (i >= 0) {
      picked.splice(i, 1);
      c.classList.remove("is-sel");
    } else {
      if (picked.length >= MAX_PICK) {
        doneEl.textContent = `最多可选 ${MAX_PICK} 座，先取消一座再选吧。`;
        return;
      }
      picked.push({ key, row, col, label: seatLabel(row, col), price: priceOf(row), tier: tierOf(row) });
      c.classList.add("is-sel");
    }
    doneEl.textContent = "";
    renderPanel();
  }

  function renderPanel() {
    if (!emptyEl) return;
    emptyEl.style.display = picked.length ? "none" : "";
    if (listEl) {
      listEl.innerHTML = "";
      let sum = 0;
      picked.slice().sort((a, b) => a.row - b.row || a.col - b.col).forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `<span><strong>${s.label}</strong> <span class="seat-t">${tierName[s.tier]} ${s.row} 排</span></span><span>¥ ${s.price}</span>`;
        listEl.appendChild(li);
        sum += s.price;
      });
      if (totalEl) totalEl.textContent = `¥ ${sum}`;
      if (confirmBtn) confirmBtn.disabled = !picked.length;
    }
  }

  function generateOrder() {
    if (!picked.length) return;
    const concertText = `${current.d} ${current.m} · ${current.title}`;
    const lines = [
      `【AURORA 选座订单摘要】`,
      `场次：${concertText}`,
      `场馆：${current.venue || "AURORA 音乐厅"}`,
      ``,
      ...picked.slice().sort((a, b) => a.row - b.row || a.col - b.col)
        .map((s) => `${s.label}（${tierName[s.tier]} ${s.row} 排） ¥ ${s.price}`),
      ``,
      `合计 ¥ ${picked.reduce((n, s) => n + s.price, 0)} · ${picked.length} 座`,
      `订单号：AU-${Date.now().toString(36).toUpperCase()}`,
    ];
    const text = lines.join("\n");
    doneEl.textContent = "订单摘要已生成（见下方）";
    doneEl.innerHTML = "";
    const pre = document.createElement("pre");
    pre.className = "seatmap__order";
    pre.textContent = text;
    doneEl.appendChild(pre);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => { pre.textContent = text + "\n\n（已复制到剪贴板）"; },
        () => {}
      );
    }
  }

  if (confirmBtn) confirmBtn.addEventListener("click", generateOrder);

  function loadOptions(list) {
    pick.innerHTML = "";
    const opts = list
      .map((c, i) => ({ i, sold: !!c.sold }))
      .filter((c) => !c.sold);
    if (!opts.length) {
      pick.innerHTML = `<option value="">暂无可选场次</option>`;
      return;
    }
    opts.forEach(({ i }) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = `${list[i].d} ${list[i].m} · ${list[i].title}`;
      pick.appendChild(o);
    });
    pick.value = String(opts[0].i);
    current = list[Number(pick.value)];
    buildMap();
  }

  function loadForIndex(idx) {
    if (!pick.__list) return;
    current = pick.__list[idx];
    buildMap();
  }
  pick.addEventListener("change", () => loadForIndex(Number(pick.value)));

  ConcertData.promise.then((list) => {
    pick.__list = list;
    loadOptions(list);
  });
}
