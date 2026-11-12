/** 数字转中文（1–99，日期小签用）：12 → 十二、21 → 二十一 */
function toCn(n: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (n <= 10) return digits[n] ?? String(n);
  if (n < 20) return `十${n % 10 ? digits[n % 10] : ""}`;
  return `${digits[Math.floor(n / 10)]}十${n % 10 ? digits[n % 10] : ""}`;
}

/** 今日日期小签：十一月十二日 */
export function chineseDate(now = new Date()): string {
  return `${toCn(now.getMonth() + 1)}月${toCn(now.getDate())}日`;
}

/** 相对时间格式化：刚刚 / N 分钟前 / 今天 HH:MM / 昨天 HH:MM / M-D HH:MM */
export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;

  const d = new Date(ms);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return `今天 ${hhmm}`;
  if (sameDay(d, yesterday)) return `昨天 ${hhmm}`;

  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.getFullYear() === now.getFullYear()) return `${md} ${hhmm}`;
  return `${d.getFullYear()}年${md} ${hhmm}`;
}
