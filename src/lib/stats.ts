import { config } from "./config";
import { db } from "./db";
import { betPoints, scoreWeeks, waistBonus, type WeekScore } from "./scoring";
import { currentWeek, finalWeek, predictionsRevealed, START_WEEK } from "./week";

export type ParticipantStats = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  motto: string | null;
  goalWeight: number | null;
  startWeight: number | null;
  currentWeight: number | null;
  startWaist: number | null;
  finalWaist: number | null;
  /** последний известный обхват талии */
  currentWaist: number | null;
  /** неделя последнего взвешивания */
  lastWeek: number | null;
  lostKg: number;
  lostPct: number;
  /** сколько пройдено от стартового веса до цели, 0..100; null, если цели нет */
  goalPct: number | null;
  /** взвешивания с изменением к прошлому и к старту */
  dynamics: WeightStep[];
  // баллы
  weightPts: number;
  stepsPts: number;
  cardioPts: number;
  strengthPts: number;
  penalty: number;
  betPts: number;
  waistPts: number;
  total: number;
  weeks: WeekScore[];
  /** накопленные баллы по неделям для графика */
  pointsSeries: { week: number; value: number }[];
  /** % снижения веса от старта по неделям для графика */
  lossSeries: { week: number; value: number }[];
  weightSeries: { week: number; weight: number }[];
  reportedThisWeek: boolean;
  donationsTotal: number;
  /** Сколько болельщиков выбрали участника фаворитом */
  fans: number;
  challengesAccepted: number;
  challengesCompleted: number;
  likes: number;
  place: number;
};

export type WeightStep = {
  week: number;
  weight: number;
  waistCm: number | null;
  /** к прошлому взвешиванию; у первого null */
  deltaKg: number | null;
  deltaPct: number | null;
  /** к стартовому весу, отрицательное — сброшено */
  fromStartKg: number | null;
  fromStartPct: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export async function getParticipantStats(): Promise<ParticipantStats[]> {
  const week = currentWeek();
  const final = finalWeek();
  const [participants, predictions] = await Promise.all([
    db.user.findMany({
      where: { role: "PARTICIPANT" },
      include: {
        results: { orderBy: { week: "asc" }, include: { _count: { select: { likes: true } } } },
        donationsReceived: { where: { status: "CONFIRMED" }, select: { amount: true } },
        _count: { select: { votesReceived: true } },
        challengesReceived: { select: { status: true, _count: { select: { likes: true } } } },
        posts: { select: { _count: { select: { likes: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // ставки учитываются только после финала, когда известен финальный вес
    predictionsRevealed() ? db.prediction.findMany() : Promise.resolve([]),
  ]);

  const finalWeight = new Map(
    participants.flatMap((p) => {
      const f = p.results.find((r) => r.week === final);
      return f ? [[p.id, f.weight] as const] : [];
    }),
  );

  const stats = participants.map((p) => {
    const start = p.results.find((r) => r.week === START_WEEK);
    const fin = p.results.find((r) => r.week === final);
    const startWeight = start?.weight ?? p.startWeight ?? null;
    const last = p.results.at(-1)?.weight ?? startWeight;
    const lostKg = startWeight && last ? startWeight - last : 0;

    const weeks = scoreWeeks(p.results, config.competition.weeks);
    const weightPts = sum(weeks.map((w) => w.weightPts));
    const stepsPts = sum(weeks.map((w) => w.stepsPts));
    const cardioPts = sum(weeks.map((w) => w.cardioPts));
    const strengthPts = sum(weeks.map((w) => w.strengthPts));
    const penalty = sum(weeks.map((w) => w.penalty));
    const waistPts = waistBonus(start?.waistCm, fin?.waistCm);
    const betPts = sum(
      predictions
        .filter((pr) => pr.authorId === p.id && finalWeight.has(pr.targetId))
        .map((pr) => betPoints(pr.weight, finalWeight.get(pr.targetId)!)),
    );

    // накопленные баллы: старт = 0, далее по неделям, в финале добавляются ставки и талия
    let acc = 0;
    const pointsSeries = [
      ...(start ? [{ week: START_WEEK, value: 0 }] : []),
      ...weeks.map((w) => ({ week: w.week, value: (acc += w.total) })),
      ...(fin ? [{ week: final, value: acc + betPts + waistPts }] : []),
    ];
    const lossSeries = startWeight
      ? p.results.map((r) => ({ week: r.week, value: round1(((startWeight - r.weight) / startWeight) * 100) }))
      : [];

    const dynamics: WeightStep[] = p.results.map((r, i) => {
      const prev = p.results[i - 1]?.weight;
      return {
        week: r.week,
        weight: r.weight,
        waistCm: r.waistCm,
        deltaKg: prev !== undefined ? round1(r.weight - prev) : null,
        deltaPct: prev !== undefined ? round1(((r.weight - prev) / prev) * 100) : null,
        fromStartKg: startWeight ? round1(r.weight - startWeight) : null,
        fromStartPct: startWeight ? round1(((r.weight - startWeight) / startWeight) * 100) : null,
      };
    });
    const goalPct =
      startWeight && last && p.goalWeight && p.goalWeight < startWeight
        ? Math.max(0, Math.min(100, Math.round(((startWeight - last) / (startWeight - p.goalWeight)) * 100)))
        : null;

    const likes =
      sum(p.results.map((r) => r._count.likes)) + sum(p.posts.map((r) => r._count.likes)) + sum(p.challengesReceived.map((r) => r._count.likes));

    return {
      id: p.id,
      name: p.name,
      username: p.username,
      avatarUrl: p.avatarUrl,
      motto: p.motto,
      goalWeight: p.goalWeight,
      startWeight,
      currentWeight: last,
      startWaist: start?.waistCm ?? null,
      finalWaist: fin?.waistCm ?? null,
      currentWaist: p.results.findLast((r) => r.week !== START_WEEK && r.waistCm !== null)?.waistCm ?? null,
      lastWeek: p.results.at(-1)?.week ?? null,
      goalPct,
      dynamics,
      lostKg: round1(lostKg),
      lostPct: startWeight ? round1((lostKg / startWeight) * 100) : 0,
      weightPts,
      stepsPts,
      cardioPts,
      strengthPts,
      penalty,
      betPts,
      waistPts,
      total: weightPts + stepsPts + cardioPts + strengthPts - penalty + betPts + waistPts,
      weeks,
      pointsSeries,
      lossSeries,
      weightSeries: p.results.map((r) => ({ week: r.week, weight: r.weight })),
      reportedThisWeek: p.results.some((r) => r.week === week),
      donationsTotal: sum(p.donationsReceived.map((d) => d.amount)),
      fans: p._count.votesReceived,
      challengesAccepted: p.challengesReceived.filter((c) => ["ACCEPTED", "COMPLETION_REVIEW", "COMPLETED", "FAILED"].includes(c.status)).length,
      challengesCompleted: p.challengesReceived.filter((c) => c.status === "COMPLETED").length,
      likes,
      place: 0,
    } satisfies ParticipantStats;
  });

  stats.sort((a, b) => b.total - a.total || b.lostPct - a.lostPct);
  // одинаковые баллы и % делят место
  stats.forEach((s, i) => {
    const prev = stats[i - 1];
    s.place = prev && prev.total === s.total && prev.lostPct === s.lostPct ? prev.place : i + 1;
  });
  return stats;
}
