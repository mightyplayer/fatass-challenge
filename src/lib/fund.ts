import { db } from "./db";

const FUND_ID = "main";

/** Настройки призового фонда; записи может ещё не быть — тогда всё пустое. */
export async function getFund() {
  const fund = await db.prizeFund.findUnique({
    where: { id: FUND_ID },
    include: { keeper: { select: { id: true, name: true, avatarUrl: true, isAdmin: true, telegramId: true, username: true } } },
  });
  return {
    baseAmount: fund?.baseAmount ?? 0,
    keeperId: fund?.keeperId ?? null,
    keeper: fund?.keeper ?? null,
    sbpPhone: fund?.sbpPhone ?? null,
    sbpBank: fund?.sbpBank ?? null,
  };
}

export async function saveFund(data: { baseAmount?: number; keeperId?: string | null; sbpPhone?: string | null; sbpBank?: string | null }) {
  await db.prizeFund.upsert({ where: { id: FUND_ID }, create: { id: FUND_ID, ...data }, update: data });
}

/** Сумма фонда (база + подтверждённые взносы) и болельщики с их подтверждёнными взносами, по убыванию. */
export async function getFundSummary() {
  const [fund, grouped] = await Promise.all([
    getFund(),
    db.fundContribution.groupBy({ by: ["fromId"], where: { status: "CONFIRMED" }, _sum: { amount: true }, _max: { reviewedAt: true } }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: grouped.map((g) => g.fromId) } }, select: { id: true, name: true, avatarUrl: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const contributors = grouped
    .map((g) => ({ ...byId.get(g.fromId)!, amount: g._sum.amount ?? 0, last: g._max.reviewedAt }))
    .filter((c) => c.id)
    .sort((a, b) => b.amount - a.amount || (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));
  const contributed = contributors.reduce((s, c) => s + c.amount, 0);
  return { ...fund, contributed, total: fund.baseAmount + contributed, contributors };
}
