import Link from "next/link";
import { finishChallenge, respondChallenge } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { ChallengePayActions } from "@/components/Challenges";
import { challengeStatus, DONATION_STATUS, rub, STATUS_LABEL } from "@/components/FeedItems";
import { PredictionsForm, ProfileForm, RequisitesForm } from "@/components/Forms";
import { betPoints } from "@/lib/scoring";
import { getParticipantStats } from "@/lib/stats";
import { finalWeek, predictionsRevealed, weekLabel } from "@/lib/week";
import { db } from "@/lib/db";
import { getFund } from "@/lib/fund";
import { requireUser } from "@/lib/session";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await requireUser();
  return user.role === "PARTICIPANT" ? <ParticipantCabinet userId={user.id} /> : <FanCabinet userId={user.id} />;
}

async function ParticipantCabinet({ userId }: { userId: string }) {
  const [user, results, challenges, stats, predictions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.weeklyResult.findMany({ where: { participantId: userId }, orderBy: { week: "desc" } }),
    db.challenge.findMany({
      where: { targetId: userId, status: { in: ["PENDING", "ACCEPTED", "COMPLETION_REVIEW"] } },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getParticipantStats(),
    db.prediction.findMany({ where: { authorId: userId } }),
  ]);
  const me = stats.find((s) => s.id === userId);
  const pointsByWeek = new Map(me?.weeks.map((w) => [w.week, w.total]));
  const others = stats.filter((s) => s.id !== userId);
  const revealed = predictionsRevealed();
  const final = finalWeek();

  return (
    <div className="space-y-6">
      {!user.sbpPhone && !user.paymentDetails && (
        <div className="card !border-amber-300 text-sm">
          Укажи реквизиты для донатов внизу страницы, иначе болельщики не смогут тебе перевести.
        </div>
      )}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="space-y-2">
          <h1 className="h1">Мой прогресс</h1>
          {me && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-[var(--line)] px-3 py-1">
                <b className="tabular-nums">{me.place}</b> <span className="muted">место</span>
              </span>
              <span className="rounded-full border border-[var(--line)] px-3 py-1">
                <b className="tabular-nums">{me.total}</b> <span className="muted">баллов</span>
              </span>
            </div>
          )}
        </div>
        <Link href={`/p/${userId}`} className="btn btn-ghost">
          Моя страница
        </Link>
      </div>

      <section className="card space-y-3">
        <h2 className="h2">Челленджи от болельщиков</h2>
        {challenges.length === 0 && <p className="muted text-sm">Новых челленджей нет.</p>}
        {challenges.map((c) => (
          <div key={c.id} className="rounded-xl border border-[var(--line)] p-4 space-y-2">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">🔥 {c.title}</div>
                <div className="text-xs muted">
                  от {c.author.name}
                  {c.dueDate && ` · до ${fmtDate(c.dueDate)}`}
                </div>
              </div>
              <span className={`text-sm font-medium whitespace-nowrap shrink-0 ${STATUS_LABEL[c.status].cls}`}>{STATUS_LABEL[c.status].text}</span>
            </div>
            {c.reward > 0 && <div className="font-bold tabular-nums">💰 {rub(c.reward)}</div>}
            {c.description && <p className="text-sm whitespace-pre-wrap">{c.description}</p>}
            <div className="flex gap-2 flex-wrap">
              {c.status === "COMPLETION_REVIEW" ? null : c.status === "PENDING" ? (
                <>
                  <ActionButton action={respondChallenge.bind(null, c.id, "ACCEPTED")}>Принять</ActionButton>
                  <ActionButton action={respondChallenge.bind(null, c.id, "DECLINED")} variant="ghost">
                    Отклонить
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton action={finishChallenge.bind(null, c.id, "COMPLETED")}>Выполнил(а)</ActionButton>
                  <ActionButton action={finishChallenge.bind(null, c.id, "FAILED")} variant="ghost">
                    Не получилось
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Мои результаты</h2>
        {results.length === 0 ? (
          <p className="muted text-sm">Результатов пока нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="muted text-left">
              <tr>
                <th className="py-1 pr-3 font-medium">Неделя</th>
                <th className="py-1 pr-3 font-medium text-right">Вес</th>
                <th className="py-1 pr-3 font-medium text-right">Талия</th>
                <th className="py-1 font-medium text-right">Баллы</th>
                <th className="hidden md:table-cell py-1 pl-6 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)] align-top">
                  <td className="py-2 pr-3">
                    <span className="whitespace-nowrap">{weekLabel(r.week)}</span>
                    {r.note && <div className="md:hidden text-xs muted mt-0.5">{r.note}</div>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{r.weight} кг</td>
                  <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{r.waistCm ? `${r.waistCm} см` : "—"}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{pointsByWeek.get(r.week) ?? "—"}</td>
                  <td className="hidden md:table-cell py-2 pl-6 muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">🎯 Ставки на финальный вес</h2>
        {revealed ? (
          <div className="space-y-2">
            {others.map((o) => {
              const pr = predictions.find((x) => x.targetId === o.id);
              const fin = o.weightSeries.find((w) => w.week === final)?.weight;
              return (
                <div key={o.id} className="flex justify-between text-sm border-t border-[var(--line)] pt-2">
                  <span>{o.name}</span>
                  <span className="tabular-nums">
                    {pr ? `${pr.weight} кг` : "нет ставки"}
                    {fin !== undefined && ` · факт ${fin} кг`}
                    {pr && fin !== undefined && ` · +${betPoints(pr.weight, fin)}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <PredictionsForm
              others={others.map((o) => ({ id: o.id, name: o.name, currentWeight: o.currentWeight, prediction: predictions.find((x) => x.targetId === o.id)?.weight ?? null }))}
            />
          </>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Реквизиты для донатов</h2>
        <RequisitesForm user={user} />
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Цель и профиль</h2>
        <ProfileForm user={user} />
      </section>
    </div>
  );
}

async function FanCabinet({ userId }: { userId: string }) {
  const [challenges, donations, favorite, fundContributions, fund] = await Promise.all([
    db.challenge.findMany({
      where: { authorId: userId },
      include: { target: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.donation.findMany({ where: { fromId: userId }, include: { to: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.vote.findUnique({ where: { fanId: userId }, include: { participant: { select: { id: true, name: true } } } }),
    db.fundContribution.findMany({ where: { fromId: userId, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } }),
    getFund(),
  ]);
  const fundTotal = fundContributions.filter((c) => c.status === "CONFIRMED").reduce((s, c) => s + c.amount, 0);
  const total = donations.filter((d) => d.status === "CONFIRMED").reduce((s, d) => s + d.amount, 0);
  return (
    <div className="space-y-6">
      <h1 className="h1">Кабинет болельщика</h1>

      <section className="card space-y-3">
        <h2 className="h2">Мои челленджи</h2>
        {challenges.length === 0 && <p className="muted text-sm">Пока ни одного.</p>}
        {challenges.map((c) => {
          const s = challengeStatus(c);
          return (
            <div key={c.id} className="border-t border-[var(--line)] pt-3 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <span>
                  🔥 {c.title} →{" "}
                  <Link href={`/p/${c.target.id}`} className="font-medium hover:underline">
                    {c.target.name}
                  </Link>
                  {c.reward > 0 && <b className="tabular-nums"> · {rub(c.reward)}</b>}
                </span>
                <span className={`whitespace-nowrap ${s.cls}`}>{s.text}</span>
              </div>
              <ChallengePayActions c={c} fund={fund} />
            </div>
          );
        })}
      </section>

      <section className="card space-y-3">
        <div className="flex justify-between items-baseline gap-3">
          <h2 className="h2">Мои донаты</h2>
          {total > 0 && <span className="font-semibold tabular-nums whitespace-nowrap">{total.toLocaleString("ru-RU")} ₽</span>}
        </div>
        {donations.length === 0 && <p className="muted text-sm">Пока ни одного.</p>}
        {donations.map((d) => (
          <div key={d.id} className="flex justify-between items-start gap-3 border-t border-[var(--line)] pt-3 text-sm">
            <Link href={`/p/${d.to.id}`} className="hover:underline min-w-0">
              {d.to.name}
            </Link>
            <div className="text-right shrink-0">
              <div className="font-semibold tabular-nums">{d.amount.toLocaleString("ru-RU")} ₽</div>
              <div className={`text-xs ${DONATION_STATUS[d.status].cls}`}>{DONATION_STATUS[d.status].text}</div>
            </div>
          </div>
        ))}
      </section>

      {fundContributions.length > 0 && (
        <section className="card space-y-3">
          <div className="flex justify-between items-baseline gap-3">
            <h2 className="h2">
              <Link href="/fund" className="hover:underline">
                Призовой фонд
              </Link>
            </h2>
            {fundTotal > 0 && <span className="font-semibold tabular-nums whitespace-nowrap">{fundTotal.toLocaleString("ru-RU")} ₽</span>}
          </div>
          {fundContributions.map((c) => (
            <div key={c.id} className="flex justify-between items-start gap-3 border-t border-[var(--line)] pt-3 text-sm">
              <span className="muted">{fmtDate(c.createdAt)}</span>
              <div className="text-right shrink-0">
                <div className="font-semibold tabular-nums">{c.amount.toLocaleString("ru-RU")} ₽</div>
                <div className={`text-xs ${DONATION_STATUS[c.status].cls}`}>{DONATION_STATUS[c.status].text}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Мой фаворит</h2>
        {favorite ? (
          <Link href={`/p/${favorite.participant.id}`} className="text-rose-600 font-medium hover:underline">
            ♥ {favorite.participant.name}
          </Link>
        ) : (
          <p className="muted text-sm">—</p>
        )}
      </section>
    </div>
  );
}
