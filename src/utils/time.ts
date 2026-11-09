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
