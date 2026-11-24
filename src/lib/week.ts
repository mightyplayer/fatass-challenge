import { config } from "./config";
import { fmtShortDate } from "./time";

// Недели соревнования:
//   0          — старт: стартовый вес и талия
//   1..weeks   — еженедельные отчёты, каждые 7 дней после старта
//   weeks + 1  — финал: финальный вес и талия (без недельных баллов, только для ставок и бонуса за талию)
const DAY_MS = 24 * 60 * 60 * 1000;

export const START_WEEK = 0;
export const finalWeek = () => config.competition.weeks + 1;
export const isFinalWeek = (week: number) => week === finalWeek();
export const allWeeks = () => Array.from({ length: finalWeek() + 1 }, (_, i) => i);

export function weekDate(week: number): Date {
  if (isFinalWeek(week)) return config.competition.final;
  return new Date(config.competition.start.getTime() + week * 7 * DAY_MS);
}

/** Последняя неделя, дата которой уже наступила. До старта — -1. */
export function currentWeek(now = new Date()): number {
  let current = -1;
  for (const w of allWeeks()) if (weekDate(w).getTime() <= now.getTime()) current = w;
  return current;
}

export const competitionStarted = (now = new Date()) => currentWeek(now) >= 0;
/** После финала ставки раскрываются и больше не меняются. */
export const predictionsRevealed = (now = new Date()) => now.getTime() >= config.competition.final.getTime();

const short = fmtShortDate;

export function weekLabel(week: number): string {
  if (week === START_WEEK) return `Старт · ${short(weekDate(week))}`;
  if (isFinalWeek(week)) return `Финал · ${short(weekDate(week))}`;
  return `Неделя ${week} · ${short(weekDate(week))}`;
}

export function weekShortLabel(week: number): string {
  if (week === START_WEEK) return "старт";
  if (isFinalWeek(week)) return "финал";
  return `н${week}`;
}

/** Совместимость: подпись текущей недели для заголовков. */
export const formatWeek = weekLabel;

/** Подписи всех недель для графиков (передаются в клиентские компоненты). */
export const weekLabels = () => Object.fromEntries(allWeeks().map((w) => [w, weekShortLabel(w)]));
