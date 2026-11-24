// Подсчёт баллов по правилам из таблицы соревнования.

/** Процент снижения с округлением до 4 знаков, чтобы float не сдвигал границы. */
const lossPct = (from: number, to: number) => Math.round(((from - to) / from) * 100 * 10000) / 10000;

/** Баллы за вес по % снижения относительно веса прошлой недели. */
export function weightPoints(prevWeight: number, weight: number): number {
  if (prevWeight <= 0) return 0;
  const pct = lossPct(prevWeight, weight);
  if (pct < 0.3) return 0;
  if (pct < 0.6) return 3;
  if (pct < 0.9) return 6;
  if (pct < 1.2) return 9;
  return 12;
}

/** Шаги, кардио и силовые: не больше 3 баллов за каждое. */
export const activityPoints = (value: number) => Math.max(0, Math.min(Math.floor(value), 3));

/** Бонус в финале за % уменьшения талии от старта. */
export function waistBonus(startWaist: number | null | undefined, finalWaist: number | null | undefined): number {
  if (!startWaist || !finalWaist) return 0;
  const pct = lossPct(startWaist, finalWaist);
  if (pct < 1) return 0;
  if (pct < 3) return 2;
  if (pct < 5) return 4;
  if (pct < 7) return 6;
  if (pct < 9) return 8;
  return 10;
}

/** Баллы за ставку на финальный вес: ошибка до 1 кг — 3, до 2 — 2, до 3 — 1. */
export function betPoints(predicted: number, actual: number): number {
  const err = Math.abs(predicted - actual);
  // округляем, чтобы 1.0000000002 из-за float не считалось больше 1
  const e = Math.round(err * 1000) / 1000;
  if (e <= 1) return 3;
  if (e <= 2) return 2;
  if (e <= 3) return 1;
  return 0;
}

export type WeekInput = {
  week: number;
  weight: number;
  waistCm: number | null;
  stepsDays: number;
  cardioDays: number;
  strengthSessions: number;
  penalty: number;
};

export type WeekScore = {
  week: number;
  weight: number;
  prevWeight: number | null;
  weightPts: number;
  stepsPts: number;
  cardioPts: number;
  strengthPts: number;
  penalty: number;
  total: number;
};

/**
 * Недельные баллы участника. Неделя 0 (старт) и финал недельных баллов не дают.
 * Вес сравнивается с последним известным весом до этой недели.
 */
export function scoreWeeks(results: WeekInput[], reportWeeks: number): WeekScore[] {
  const sorted = [...results].sort((a, b) => a.week - b.week);
  const scores: WeekScore[] = [];
  let prev: number | null = null;
  for (const r of sorted) {
    if (r.week >= 1 && r.week <= reportWeeks) {
      const weightPts = prev !== null ? weightPoints(prev, r.weight) : 0;
      const stepsPts = activityPoints(r.stepsDays);
      const cardioPts = activityPoints(r.cardioDays);
      const strengthPts = activityPoints(r.strengthSessions);
      scores.push({
        week: r.week,
        weight: r.weight,
        prevWeight: prev,
        weightPts,
        stepsPts,
        cardioPts,
        strengthPts,
        penalty: r.penalty,
        total: weightPts + stepsPts + cardioPts + strengthPts - r.penalty,
      });
    }
    if (r.week <= reportWeeks) prev = r.weight;
  }
  return scores;
}
