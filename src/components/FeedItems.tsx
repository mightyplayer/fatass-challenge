/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { deletePost } from "@/app/actions";
import { ActionButton } from "./ActionButton";
import { Avatar } from "./Avatar";
import { PostComments } from "./Comments";
import { PostReactions } from "./PostReactions";
import { summarize } from "@/lib/reactions";
import { LikeButton } from "./LikeButton";
import { payoutTo } from "@/lib/challenges";
import type { FeedItem } from "@/lib/feed";
import { weekLabel } from "@/lib/week";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const DONATION_STATUS: Record<string, { text: string; cls: string }> = {
  AWAITING_TRANSFER: { text: "ждёт перевода", cls: "text-amber-600" },
  PENDING_REVIEW: { text: "ожидает проверки", cls: "text-blue-600" },
  CONFIRMED: { text: "подтверждён админом ✓", cls: "text-[var(--color-accent)]" },
  REJECTED: { text: "отклонён", cls: "text-red-600" },
  CANCELLED: { text: "отменён", cls: "muted" },
};

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  AWAITING_PAYMENT: { text: "ждёт оплаты", cls: "text-amber-600" },
  PAYMENT_REVIEW: { text: "оплата на проверке", cls: "text-blue-600" },
  PAYMENT_REJECTED: { text: "оплата отклонена", cls: "text-red-600" },
  PENDING: { text: "ждёт ответа", cls: "text-amber-600" },
  ACCEPTED: { text: "принят", cls: "text-blue-600" },
  DECLINED: { text: "отклонён", cls: "muted" },
  COMPLETION_REVIEW: { text: "выполнение на проверке", cls: "text-blue-600" },
  COMPLETED: { text: "выполнен ✓", cls: "text-[var(--color-accent)]" },
  FAILED: { text: "не выполнен", cls: "text-red-600" },
  CANCELLED: { text: "удалён", cls: "muted" },
};

/** Статус челленджа с учётом выплаты: выплачено участнику или возвращено автору. */
export function challengeStatus(c: Parameters<typeof payoutTo>[0]) {
  const s = STATUS_LABEL[c.status];
  if (c.paidAt && c.reward > 0) {
    const to = payoutTo(c);
    if (c.settledAt) return { text: c.status === "COMPLETED" ? `${s.text} · выплачено` : `${s.text} · возвращено`, cls: s.cls };
    if (to === "target") return { text: `${s.text} · к выплате`, cls: s.cls };
    if (to === "author") return { text: `${s.text} · к возврату`, cls: s.cls };
  }
  return s;
}

export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

function when(d: Date) {
  return fmtDateTime(d);
}

function Head({ user, children, at }: { user: { id: string; name: string; avatarUrl: string | null }; children?: React.ReactNode; at: Date }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={user.name} url={user.avatarUrl} />
      <div className="text-sm leading-tight">
        <Link href={`/p/${user.id}`} className="font-semibold hover:underline">
          {user.name}
        </Link>{" "}
        <span className="muted">{children}</span>
        <div className="muted text-xs mt-0.5">{when(at)}</div>
      </div>
    </div>
  );
}

export function FeedCard({ item, viewerId, isAdmin }: { item: FeedItem; viewerId: string | null; isAdmin?: boolean }) {
  const guest = !viewerId;
  switch (item.type) {
    case "post": {
      const p = item.data;
      return (
        <article className="card space-y-3">
          <div className="flex justify-between gap-3">
            <Head user={p.author} at={p.createdAt}>
              написал(а) пост
            </Head>
            {(p.authorId === viewerId || isAdmin) && (
              <ActionButton action={deletePost.bind(null, p.id)} variant="ghost" confirm="Удалить пост?" className="!py-1 !px-2 !text-xs">
                Удалить
              </ActionButton>
            )}
          </div>
          <p className="whitespace-pre-wrap">{p.text}</p>
          {p.images.length > 0 && (
            <div className={`grid gap-2 ${p.images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
              {p.images.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt="" className={`w-full rounded-xl object-cover ${p.images.length === 1 ? "max-h-[480px]" : "aspect-square"}`} />
                </a>
              ))}
            </div>
          )}
          <PostComments
            postId={p.id}
            comments={p.comments}
            viewerId={viewerId}
            isAdmin={!!isAdmin}
            like={
              <>
                <LikeButton guest={guest} kind="post" id={p.id} count={p._count.likes} liked={p.likes.length > 0} />
                <PostReactions postId={p.id} summary={summarize(p.reactions, viewerId)} guest={guest} />
              </>
            }
          />
        </article>
      );
    }
    case "result": {
      const r = item.data;
      const start = r.startWeight;
      const lost = start ? Math.round((start - r.weight) * 10) / 10 : null;
      const sc = r.score;
      return (
        <article className="card space-y-3">
          <Head user={r.participant} at={r.updatedAt}>
            {weekLabel(r.week)}
          </Head>
          <div className="flex flex-wrap gap-6 items-baseline">
            {sc && (
              <div>
                <div className="text-xs muted">Баллы за неделю</div>
                <div className="text-2xl font-bold tabular-nums text-[var(--color-accent)]">{sc.total}</div>
              </div>
            )}
            <div>
              <div className="text-xs muted">Вес</div>
              <div className="text-2xl font-bold tabular-nums">{r.weight} кг</div>
            </div>
            {lost !== null && r.week > 0 && (
              <div>
                <div className="text-xs muted">От старта ({start} кг)</div>
                <div className={`text-xl font-semibold tabular-nums ${lost > 0 ? "text-[var(--color-accent)]" : ""}`}>
                  {lost > 0 ? `−${lost}` : `+${-lost}`} кг
                  <span className="text-sm font-medium"> · {lost > 0 ? "−" : "+"}{Math.abs(Math.round((lost / start!) * 1000) / 10)}%</span>
                </div>
              </div>
            )}
            {r.waistCm && (
              <div>
                <div className="text-xs muted">Талия</div>
                <div className="text-xl font-semibold tabular-nums">{r.waistCm} см</div>
              </div>
            )}
          </div>
          {sc && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="chip">вес +{sc.weightPts}</span>
              <span className="chip">шаги 10k: {r.stepsDays} дн. → +{sc.stepsPts}</span>
              <span className="chip">кардио: {r.cardioDays} дн. → +{sc.cardioPts}</span>
              <span className="chip">силовые: {r.strengthSessions} → +{sc.strengthPts}</span>
              {sc.penalty > 0 && <span className="chip text-red-600">штраф −{sc.penalty}</span>}
            </div>
          )}
          {r.note && <p className="whitespace-pre-wrap">{r.note}</p>}
          {r.photoUrl && <img src={r.photoUrl} alt="" className="rounded-xl max-h-96 object-cover" />}
          <LikeButton guest={guest} kind="result" id={r.id} count={r._count.likes} liked={r.likes.length > 0} />
        </article>
      );
    }
    case "challenge": {
      const c = item.data;
      const s = challengeStatus(c);
      return (
        <article className="card space-y-3">
          <Head user={c.author} at={c.createdAt}>
            бросил(а) челлендж участнику{" "}
            <Link href={`/p/${c.target.id}`} className="font-semibold hover:underline text-[var(--text)]">
              {c.target.name}
            </Link>
          </Head>
          <div className="rounded-xl border border-[var(--line)] p-4">
            <div className="flex justify-between gap-3">
              <div className="font-semibold min-w-0">🔥 {c.title}</div>
              <span className={`text-sm font-medium whitespace-nowrap shrink-0 ${s.cls}`}>{s.text}</span>
            </div>
            {c.reward > 0 && <div className="mt-1 font-bold tabular-nums">💰 {rub(c.reward)}</div>}
            {c.description && <p className="text-sm muted mt-1 whitespace-pre-wrap">{c.description}</p>}
            {c.dueDate && <p className="text-xs muted mt-2">До {fmtDate(c.dueDate)}</p>}
          </div>
          <LikeButton guest={guest} kind="challenge" id={c.id} count={c._count.likes} liked={c.likes.length > 0} />
        </article>
      );
    }
    case "donation": {
      const d = item.data;
      return (
        <article className="card space-y-3">
          <Head user={d.from} at={d.reviewedAt ?? d.createdAt}>
            задонатил(а) <b className="text-[var(--text)]">{d.amount.toLocaleString("ru-RU")} ₽</b> участнику{" "}
            <Link href={`/p/${d.to.id}`} className="font-semibold hover:underline text-[var(--text)]">
              {d.to.name}
            </Link>
          </Head>
          {d.message && <p className="text-sm">«{d.message}»</p>}
        </article>
      );
    }
  }
}
