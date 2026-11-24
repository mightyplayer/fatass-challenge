import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteResult,
  linkToParticipant,
  reviewChallengeCompletion,
  reviewChallengePayment,
  reviewDonation,
  reviewFundContribution,
  setAdmin,
  setRole,
  settleChallenge,
} from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Avatar } from "@/components/Avatar";
import { challengeStatus, DONATION_STATUS } from "@/components/FeedItems";
import { AdminResultForm, FundRequisitesForm, FundSettingsForm, RenameForm, RequisitesForm, UsernameForm } from "@/components/Forms";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { payoutTo } from "@/lib/challenges";
import { getFund, getFundSummary } from "@/lib/fund";
import { scoreWeeks } from "@/lib/scoring";
import { requireUser } from "@/lib/session";
import { isAdmin, isSuperAdmin } from "@/lib/users";
import { allWeeks, currentWeek, finalWeek, START_WEEK, weekLabel } from "@/lib/week";
import { fmtFull } from "@/lib/time";

export const dynamic = "force-dynamic";

type Tab = "results" | "donations" | "challenges" | "fund" | "users";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ week?: string; tab?: string }> }) {
  const me = await requireUser({ allowPending: true });
  if (!isAdmin(me)) notFound();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "users" || sp.tab === "donations" || sp.tab === "challenges" || sp.tab === "fund" ? sp.tab : "results";
  const [pending, fundPending, challengesPending] = await Promise.all([
    db.donation.count({ where: { status: "PENDING_REVIEW" } }),
    db.fundContribution.count({ where: { status: "PENDING_REVIEW" } }),
    db.challenge.count({
      where: {
        OR: [
          { status: { in: ["PAYMENT_REVIEW", "COMPLETION_REVIEW"] } },
          { paidAt: { not: null }, settledAt: null, reward: { gt: 0 }, status: { in: ["COMPLETED", "DECLINED", "FAILED", "CANCELLED"] } },
        ],
      },
    }),
  ]);
  const week = sp.week !== undefined && allWeeks().includes(Number(sp.week)) ? Number(sp.week) : Math.max(currentWeek(), START_WEEK);

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "results", label: "Результаты", href: "/admin" },
    { id: "donations", label: pending ? `Донаты · ${pending}` : "Донаты", href: "/admin?tab=donations" },
    { id: "challenges", label: challengesPending ? `Челленджи · ${challengesPending}` : "Челленджи", href: "/admin?tab=challenges" },
    { id: "fund", label: fundPending ? `Призовой фонд · ${fundPending}` : "Призовой фонд", href: "/admin?tab=fund" },
    { id: "users", label: "Пользователи", href: "/admin?tab=users" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="h1">Админка</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className={`btn !py-1.5 !px-3 ${tab === t.id ? "" : "btn-ghost"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "results" && <Results week={week} />}
      {tab === "donations" && <Donations />}
      {tab === "challenges" && <Challenges me={me} />}
      {tab === "fund" && <Fund me={me} />}
      {tab === "users" && <Users me={me} />}
    </div>
  );
}

async function Results({ week }: { week: number }) {
  const final = finalWeek();
  const kind = week === START_WEEK ? "start" : week === final ? "final" : "weekly";
  const participants = await db.user.findMany({
    where: { role: "PARTICIPANT" },
    include: { results: { orderBy: { week: "asc" }, include: { enteredBy: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const filled = participants.filter((p) => p.results.some((r) => r.week === week)).length;
  const now = currentWeek();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {allWeeks().map((w) => (
          <Link
            key={w}
            href={`/admin?week=${w}`}
            className={`chip !px-3 !py-1 ${w === week ? "!bg-[var(--color-accent)] text-white !border-transparent" : w > now ? "muted" : ""}`}
          >
            {w === START_WEEK ? "Старт" : w === final ? "Финал" : w}
          </Link>
        ))}
      </div>
      <p className="text-sm">
        <b>{weekLabel(week)}</b> · внесено {filled} из {participants.length}
      </p>
      {participants.length === 0 && <p className="muted">Участников пока нет.</p>}
      {participants.map((p) => {
        const r = p.results.find((x) => x.week === week);
        const score = r && kind === "weekly" ? scoreWeeks(p.results, config.competition.weeks).find((s) => s.week === week) : undefined;
        return (
          <div key={p.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={`/p/${p.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                <Avatar name={p.name} url={p.avatarUrl} size={32} />
                {p.name}
              </Link>
              {r ? <span className="chip text-[var(--color-accent)]">внесено</span> : <span className="chip text-amber-600">нет результата</span>}
            </div>
            <AdminResultForm key={`${p.id}-${week}`} participantId={p.id} week={week} kind={kind} defaults={r ?? undefined} />
            {r && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs muted border-t border-[var(--line)] pt-3">
                {score && (
                  <span className="text-[var(--text)] text-sm">
                    <b>{score.total} балл.</b>: вес {score.weightPts}
                    {score.prevWeight !== null ? ` (было ${score.prevWeight})` : " (нет прошлого веса)"}, шаги {score.stepsPts}, кардио {score.cardioPts}, силовые{" "}
                    {score.strengthPts}
                    {score.penalty ? `, штраф −${score.penalty}` : ""}
                  </span>
                )}
                <span>
                  {r.enteredBy ? `Внёс(ла) ${r.enteredBy.name}` : "Внесено"} · {fmtFull(r.updatedAt)}
                </span>
                <ActionButton action={deleteResult.bind(null, r.id)} variant="ghost" confirm="Удалить результат за эту неделю?" className="!py-1 !px-2 !text-xs">
                  Удалить
                </ActionButton>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

async function Donations() {
  const donations = await db.donation.findMany({
    where: { status: { in: ["PENDING_REVIEW", "AWAITING_TRANSFER", "CONFIRMED", "REJECTED"] } },
    include: { from: { select: { name: true } }, to: { select: { name: true, paymentDetails: true } }, reviewedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const groups = [
    { title: "Ждут проверки", hint: "", items: donations.filter((d) => d.status === "PENDING_REVIEW") },
    { title: "Ещё не переведены", hint: "", items: donations.filter((d) => d.status === "AWAITING_TRANSFER") },
    { title: "Проверенные", hint: "", items: donations.filter((d) => d.status === "CONFIRMED" || d.status === "REJECTED") },
  ];
  return (
    <section className="space-y-6">
      {groups.map((g) => (
        <div key={g.title} className="space-y-3">
          <h2 className="h2">
            {g.title} <span className="muted font-normal">· {g.items.length}</span>
          </h2>
          {g.hint && <p className="text-sm muted">{g.hint}</p>}
          {g.items.map((d) => (
            <div key={d.id} className="card !p-4 flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
              <div className="text-sm">
                <b>{d.from.name}</b> → <b>{d.to.name}</b>: <b>{d.amount.toLocaleString("ru-RU")} ₽</b>
                {d.message && <span className="muted"> · «{d.message}»</span>}
                <div className="text-xs muted mt-0.5">
                  создан {fmtFull(d.createdAt)}
                  {d.transferredAt && ` · перевёл ${fmtFull(d.transferredAt)}`}
                  {d.reviewedBy && ` · проверил(а) ${d.reviewedBy.name}`}
                </div>
              </div>
              {d.status === "PENDING_REVIEW" || d.status === "AWAITING_TRANSFER" ? (
                <div className="flex gap-2">
                  <ActionButton action={reviewDonation.bind(null, d.id, "CONFIRMED")} className="!py-1 !px-3 !text-xs">
                    Деньги пришли
                  </ActionButton>
                  <ActionButton action={reviewDonation.bind(null, d.id, "REJECTED")} variant="ghost" confirm="Отклонить донат?" className="!py-1 !px-3 !text-xs">
                    Отклонить
                  </ActionButton>
                </div>
              ) : (
                <span className={`text-sm font-medium ${DONATION_STATUS[d.status].cls}`}>{DONATION_STATUS[d.status].text}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

async function Challenges({ me }: { me: { id: string } }) {
  const [fund, challenges] = await Promise.all([
    getFund(),
    db.challenge.findMany({
      where: { OR: [{ reward: { gt: 0 } }, { status: "COMPLETION_REVIEW" }] },
      include: {
        author: { select: { name: true, username: true } },
        target: { select: { id: true, name: true, sbpPhone: true, sbpBank: true, paymentDetails: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  const isKeeper = fund.keeperId === me.id;
  const groups = [
    { title: "Оплата ждёт проверки", items: challenges.filter((c) => c.status === "PAYMENT_REVIEW" || c.status === "AWAITING_PAYMENT") },
    { title: "Выполнение ждёт проверки", items: challenges.filter((c) => c.status === "COMPLETION_REVIEW") },
    { title: "К выплате участнику", items: challenges.filter((c) => payoutTo(c) === "target") },
    { title: "К возврату автору", items: challenges.filter((c) => payoutTo(c) === "author") },
    { title: "Закрытые", items: challenges.filter((c) => c.settledAt || c.status === "PAYMENT_REJECTED") },
  ];
  return (
    <section className="space-y-6">
      {groups.map((g) => (
        <div key={g.title} className="space-y-3">
          <h2 className="h2">
            {g.title} <span className="muted font-normal">· {g.items.length}</span>
          </h2>
          {g.items.map((c) => {
            const to = payoutTo(c);
            const s = challengeStatus(c);
            return (
              <div key={c.id} className="card !p-4 flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
                <div className="text-sm min-w-0">
                  <b>{c.author.name}</b> → <b>{c.target.name}</b>: <b>{c.reward.toLocaleString("ru-RU")} ₽</b> · 🔥 {c.title}
                  <div className="text-xs muted mt-0.5">
                    создан {fmtFull(c.createdAt)}
                    {c.transferredAt && ` · перевёл ${fmtFull(c.transferredAt)}`}
                  </div>
                  {to === "target" && (
                    <div className="text-xs mt-1 whitespace-pre-wrap">
                      {c.target.sbpPhone ? `СБП ${c.target.sbpPhone}${c.target.sbpBank ? `, ${c.target.sbpBank}` : ""}` : (c.target.paymentDetails ?? "—")}
                    </div>
                  )}
                  {to === "author" && <div className="text-xs mt-1">{c.author.username ? `@${c.author.username}` : "—"}</div>}
                </div>
                {(c.status === "PAYMENT_REVIEW" || c.status === "AWAITING_PAYMENT") && isKeeper ? (
                  <div className="flex gap-2">
                    <ActionButton action={reviewChallengePayment.bind(null, c.id, "CONFIRMED")} className="!py-1 !px-3 !text-xs">
                      Деньги пришли
                    </ActionButton>
                    <ActionButton action={reviewChallengePayment.bind(null, c.id, "REJECTED")} variant="ghost" confirm="Отклонить оплату?" className="!py-1 !px-3 !text-xs">
                      Отклонить
                    </ActionButton>
                  </div>
                ) : c.status === "COMPLETION_REVIEW" && c.target.id !== me.id ? (
                  <div className="flex gap-2">
                    <ActionButton action={reviewChallengeCompletion.bind(null, c.id, "COMPLETED")} className="!py-1 !px-3 !text-xs">
                      Выполнен
                    </ActionButton>
                    <ActionButton action={reviewChallengeCompletion.bind(null, c.id, "FAILED")} variant="ghost" confirm="Челлендж не выполнен?" className="!py-1 !px-3 !text-xs">
                      Не выполнен
                    </ActionButton>
                  </div>
                ) : to && isKeeper ? (
                  <ActionButton action={settleChallenge.bind(null, c.id)} confirm={to === "target" ? `Перевёл ${c.target.name}?` : `Вернул ${c.author.name}?`} className="!py-1 !px-3 !text-xs">
                    {to === "target" ? "Выплачено" : "Возвращено"}
                  </ActionButton>
                ) : (
                  <span className={`text-sm font-medium ${s.cls}`}>{s.text}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

async function Fund({ me }: { me: { id: string; telegramId: bigint; username: string | null; isAdmin: boolean } }) {
  const superMe = isSuperAdmin(me);
  const [fund, users, contributions] = await Promise.all([
    getFundSummary(),
    superMe ? db.user.findMany({ where: { telegramId: { gte: 0 } }, orderBy: { name: "asc" } }) : [],
    db.fundContribution.findMany({
      where: { status: { in: ["PENDING_REVIEW", "AWAITING_TRANSFER", "CONFIRMED", "REJECTED"] } },
      include: { from: { select: { name: true } }, reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const isKeeper = fund.keeperId === me.id;
  const admins = users.filter((u) => isAdmin(u)).map((u) => ({ id: u.id, name: u.name }));
  const groups = [
    { title: "Ждут проверки", items: contributions.filter((c) => c.status === "PENDING_REVIEW") },
    { title: "Ещё не переведены", items: contributions.filter((c) => c.status === "AWAITING_TRANSFER") },
    { title: "Проверенные", items: contributions.filter((c) => c.status === "CONFIRMED" || c.status === "REJECTED") },
  ];
  return (
    <section className="space-y-6">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">Призовой фонд</h2>
          <span className="text-2xl font-bold tabular-nums">{fund.total.toLocaleString("ru-RU")} ₽</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="muted">База</dt>
          <dd className="tabular-nums">{fund.baseAmount.toLocaleString("ru-RU")} ₽</dd>
          <dt className="muted">От болельщиков</dt>
          <dd className="tabular-nums">{fund.contributed.toLocaleString("ru-RU")} ₽</dd>
          <dt className="muted">Хранитель</dt>
          <dd>{fund.keeper?.name ?? "—"}</dd>
          <dt className="muted">СБП</dt>
          <dd>{fund.sbpPhone ? `${fund.sbpPhone}${fund.sbpBank ? `, ${fund.sbpBank}` : ""}` : "—"}</dd>
        </dl>
        {superMe && (
          <div className="border-t border-[var(--line)] pt-4">
            <FundSettingsForm baseAmount={fund.baseAmount} keeperId={fund.keeperId} admins={admins} />
          </div>
        )}
        {(isKeeper || (superMe && fund.keeperId)) && (
          <div className="border-t border-[var(--line)] pt-4">
            <FundRequisitesForm sbpPhone={fund.sbpPhone} sbpBank={fund.sbpBank} />
          </div>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.title} className="space-y-3">
          <h2 className="h2">
            {g.title} <span className="muted font-normal">· {g.items.length}</span>
          </h2>
          {g.items.map((c) => (
            <div key={c.id} className="card !p-4 flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
              <div className="text-sm">
                <b>{c.from.name}</b>: <b>{c.amount.toLocaleString("ru-RU")} ₽</b>
                {c.message && <span className="muted"> · «{c.message}»</span>}
                <div className="text-xs muted mt-0.5">
                  создан {fmtFull(c.createdAt)}
                  {c.transferredAt && ` · перевёл ${fmtFull(c.transferredAt)}`}
                  {c.reviewedBy && ` · проверил(а) ${c.reviewedBy.name}`}
                </div>
              </div>
              {(c.status === "PENDING_REVIEW" || c.status === "AWAITING_TRANSFER") && isKeeper ? (
                <div className="flex gap-2">
                  <ActionButton action={reviewFundContribution.bind(null, c.id, "CONFIRMED")} className="!py-1 !px-3 !text-xs">
                    Деньги пришли
                  </ActionButton>
                  <ActionButton action={reviewFundContribution.bind(null, c.id, "REJECTED")} variant="ghost" confirm="Отклонить взнос?" className="!py-1 !px-3 !text-xs">
                    Отклонить
                  </ActionButton>
                </div>
              ) : (
                <span className={`text-sm font-medium ${DONATION_STATUS[c.status].cls}`}>{DONATION_STATUS[c.status].text}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

const ROLE_LABEL = { PENDING: "не выбрал роль", FAN: "болельщик", PARTICIPANT: "участник" } as const;

async function Users({ me }: { me: { id: string; telegramId: bigint; username: string | null; isAdmin: boolean } }) {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { results: true } } } });
  const placeholders = users.filter((u) => u.telegramId < 0);
  const superMe = isSuperAdmin(me);
  return (
    <section className="space-y-3">
      <div className="card !p-0 text-sm">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_14rem_9rem] gap-4 px-5 py-2 border-b border-[var(--line)] muted">
          <span>Пользователь</span>
          <span>Роль</span>
          <span>Админ</span>
        </div>
        <div>
            {users.map((u) => (
              <div key={u.id} className="grid md:grid-cols-[minmax(0,1fr)_14rem_9rem] gap-x-4 gap-y-2 px-4 md:px-5 py-3 border-b border-[var(--line)] last:border-0">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <Avatar name={u.name} url={u.avatarUrl} size={28} />
                    <div className="space-y-1 min-w-0">
                      <RenameForm user={u} />
                      {u.telegramId < 0 ? <UsernameForm user={u} /> : <div className="text-xs muted">{u.username ? `@${u.username}` : `id ${u.telegramId}`}</div>}
                      {u.role === "PARTICIPANT" && <RequisitesForm user={u} byAdmin />}
                      {u.telegramId >= 0 && u._count.results === 0 && placeholders.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {placeholders.map((p) => (
                            <ActionButton
                              key={p.id}
                              action={linkToParticipant.bind(null, u.id, p.id)}
                              variant="ghost"
                              confirm={`Привязать этот Telegram к участнику «${p.name}»? Отдельный аккаунт «${u.name}» удалится вместе с его постами и лайками.`}
                              className="!py-0.5 !px-2 !text-xs"
                            >
                              это {p.name}
                            </ActionButton>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pl-9 md:pl-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{ROLE_LABEL[u.role]}</span>
                    {u.role !== "PARTICIPANT" && (
                      <ActionButton action={setRole.bind(null, u.id, "PARTICIPANT")} variant="ghost" className="!py-1 !px-2 !text-xs">
                        → участник
                      </ActionButton>
                    )}
                    {u.role !== "FAN" && (
                      <ActionButton action={setRole.bind(null, u.id, "FAN")} variant="ghost" className="!py-1 !px-2 !text-xs">
                        → болельщик
                      </ActionButton>
                    )}
                  </div>
                </div>
                <div className="pl-9 md:pl-0">
                  {isSuperAdmin(u) ? (
                    <span className="chip text-[var(--color-accent)]">супер-админ</span>
                  ) : superMe && u.telegramId >= 0 ? (
                    <ActionButton action={setAdmin.bind(null, u.id, !u.isAdmin)} variant={u.isAdmin ? "ghost" : "primary"} className="!py-1 !px-2 !text-xs">
                      {u.isAdmin ? "Снять админа" : "Сделать админом"}
                    </ActionButton>
                  ) : (
                    <span className={`muted ${u.isAdmin ? "" : "hidden md:inline"}`}>{u.isAdmin ? "админ" : "—"}</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
