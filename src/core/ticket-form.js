/* ---------- 10. 购票表单：校验 + 反馈 ---------- */
export function initTicketForm() {
  const form = document.getElementById("ticketForm");
  const note = document.getElementById("ticketNote");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("tName").value.trim();
    const email = document.getElementById("tEmail").value.trim();
    const level = document.getElementById("tLevel").value;

    if (note) note.className = "ticket__note";

    if (!name) {
      if (note) {
        note.textContent = "请填写您的姓名。";
        note.classList.add("err");
      }
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (note) {
        note.textContent = "请填写有效的邮箱地址。";
        note.classList.add("err");
      }
      return;
    }

    const levelText = { vip: "VIP 乐友（含彩排）", gold: "金卡会员", standard: "普通会员" }[level];
    if (note) {
      note.textContent = `欢迎，${name}！您已登记为「${levelText}」，确认函已发送至 ${email}。`;
      note.classList.add("ok");
    }
    form.reset();
  });
}
