import { PUBLIC_CHALLENGE_STATUSES } from "./challenges";
import { config } from "./config";
import { db } from "./db";
import { scoreWeeks, type WeekScore } from "./scoring";
import { START_WEEK } from "./week";

const userSelect = { id: true, name: true, avatarUrl: true } as const;

/** Счётчик лайков и лайк текущего зрителя (у гостя — никогда). */
export const likesFor = (viewerId: string | null) =>
  ({ _count: { select: { likes: true } }, likes: { where: { userId: viewerId ?? "guest" }, select: { id: true } } }) as const;

/** Лента активностей: посты, недельные отчёты и челленджи. Можно ограничить одним участником. */
export async function getFeed(viewerId: string | null, participantId?: string, take = 40) {
  const likeInclude = likesFor(viewerId);

  const [posts, results, challenges, donations, allResults] = await Promise.all([
    db.post.findMany({
      where: participantId ? { authorId: participantId } : {},
      include: {
        author: { select: userSelect },
        images: { orderBy: { order: "asc" } },
        reactions: { select: { kind: true, userId: true } },
        comments: { select: { id: true, parentId: true, text: true, createdAt: true, deletedAt: true, author: { select: userSelect } }, orderBy: { createdAt: "asc" } },
        ...likeInclude,
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.weeklyResult.findMany({
      where: participantId ? { participantId } : {},
      include: { participant: { select: { ...userSelect, startWeight: true } }, ...likeInclude },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    db.challenge.findMany({
      where: { status: { in: PUBLIC_CHALLENGE_STATUSES }, ...(participantId ? { targetId: participantId } : {}) },
      include: { author: { select: userSelect }, target: { select: userSelect }, ...likeInclude },
      orderBy: { createdAt: "desc" },
      take,
    }),
    // публично показываем только подтверждённые админом донаты
    db.donation.findMany({
      where: { status: "CONFIRMED", ...(participantId ? { toId: participantId } : {}) },
      include: { from: { select: userSelect }, to: { select: userSelect } },
      orderBy: { reviewedAt: "desc" },
      take,
    }),
    // все результаты нужны, чтобы посчитать баллы недели (вес сравнивается с прошлой неделей)
    db.weeklyResult.findMany({
      where: participantId ? { participantId } : {},
      select: { participantId: true, week: true, weight: true, waistCm: true, stepsDays: true, cardioDays: true, strengthSessions: true, penalty: true },
    }),
  ]);

  const scores = new Map<string, WeekScore>();
  const startWeights = new Map<string, number>();
  for (const pid of new Set(allResults.map((r) => r.participantId))) {
    const own = allResults.filter((r) => r.participantId === pid);
    const start = own.find((r) => r.week === START_WEEK);
    if (start) startWeights.set(pid, start.weight);
    for (const sc of scoreWeeks(own, config.competition.weeks)) scores.set(`${pid}:${sc.week}`, sc);
  }

  const items = [
    ...posts.map((p) => ({ type: "post" as const, at: p.createdAt, data: p })),
    ...results.map((r) => ({
      type: "result" as const,
      at: r.updatedAt,
      data: { ...r, score: scores.get(`${r.participantId}:${r.week}`) ?? null, startWeight: startWeights.get(r.participantId) ?? r.participant.startWeight },
    })),
    ...challenges.map((c) => ({ type: "challenge" as const, at: c.respondedAt ?? c.createdAt, data: c })),
    ...donations.map((d) => ({ type: "donation" as const, at: d.reviewedAt ?? d.createdAt, data: d })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

export type FeedItem = Awaited<ReturnType<typeof getFeed>>[number];
