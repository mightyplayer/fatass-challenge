import { FeedCard } from "@/components/FeedItems";
import { PUBLIC_CHALLENGE_STATUSES } from "@/lib/challenges";
import { db } from "@/lib/db";
import { likesFor } from "@/lib/feed";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const user = await getViewer();
  const challenges = await db.challenge.findMany({
    where: { status: { in: PUBLIC_CHALLENGE_STATUSES } },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      target: { select: { id: true, name: true, avatarUrl: true } },
      ...likesFor(user?.id ?? null),
    },
    orderBy: { createdAt: "desc" },
  });
  const groups = [
    { title: "Ждут ответа", items: challenges.filter((c) => c.status === "PENDING") },
    { title: "В процессе", items: challenges.filter((c) => c.status === "ACCEPTED" || c.status === "COMPLETION_REVIEW") },
    { title: "Завершённые", items: challenges.filter((c) => ["COMPLETED", "FAILED", "DECLINED"].includes(c.status)) },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="h1">Челленджи</h1>
      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="h2">
            {g.title} <span className="muted font-normal">· {g.items.length}</span>
          </h2>
          {g.items.map((c) => (
            <FeedCard key={c.id} item={{ type: "challenge", at: c.createdAt, data: c }} viewerId={user?.id ?? null} />
          ))}
        </section>
      ))}
    </div>
  );
}
