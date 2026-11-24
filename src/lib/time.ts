// Всё время на сайте показывается по Самаре, независимо от часового пояса сервера и браузера.
export const TIME_ZONE = "Europe/Samara";
const OFFSET = "+04:00";

/** Дата и время: «12 окт., 19:03». */
export const fmtDateTime = (d: Date) =>
  d.toLocaleString("ru-RU", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Полная дата и время: «12.10.2026, 19:03:00». */
export const fmtFull = (d: Date) => d.toLocaleString("ru-RU", { timeZone: TIME_ZONE });

/** Дата: «12.10.2026». */
export const fmtDate = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE });

/** Короткая дата: «12 окт.». */
export const fmtShortDate = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: TIME_ZONE, day: "numeric", month: "short" });

/** «2026-10-12» → полночь этого дня по Самаре. Строки с временем разбираются как есть. */
export function parseLocalDate(s: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00${OFFSET}` : s);
}
