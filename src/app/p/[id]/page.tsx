import { Fragment } from "react";
import { notFound } from "next/navigation";
import { cancelDonation, markTransferred } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Avatar } from "@/components/Avatar";
import { ChallengePayBox } from "@/components/Challenges";
import { WeightChart } from "@/components/Charts";
import { FavoriteButton } from "@/components/FavoriteButton";
import { DONATION_STATUS, FeedCard } from "@/components/FeedItems";
import { ChallengeForm, DonateForm, PostComposer } from "@/components/Forms";
import { LoginPrompt } from "@/components/LoginPrompt";
import { db } from "@/lib/db";
import { getFeed } from "@/lib/feed";
import { getFund } from "@/lib/fund";
import { betPoints } from "@/lib/scoring";
import { getViewer } from "@/lib/session";
import { getParticipantStats } from "@/lib/stats";
import { isAdmin } from "@/lib/users";
import { competitionStarted, currentWeek, finalWeek, predictionsRevealed, START_WEEK, weekLabel, weekLabels } from "@/lib/week";

export const dynamic = "force-dynamic";

const round1 = (n: number) => Math.round(n * 10) / 10;
/** −1.2 / +0.4 / 0 с настоящим минусом */
const signed = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : "0");
/** снижение веса — зелёным, набор — красным */
const tone = (n: number | null) => (n === null || n === 0 ? "" : n < 0 ? "text-[var(--color-accent)]" : "text-red-600");

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getViewer();
  const all = await getParticipantStats();
  const p = all.find((s) => s.id === id);
  if (!p) notFound();

  const week = currentWeek();
  const started = competitionStarted();
  const revealed = predictionsRevealed();
  const [feed, myVote, details, myDonations, predictionsAbout, myChallenges, fund] = await Promise.all([
    getFeed(user?.id ?? null, id),
    user?.role === "FAN" ? db.vote.findUnique({ where: { fanId: user.id } }) : null,
    db.user.findUnique({ where: { id }, select: { paymentDetails: true, sbpPhone: true, sbpBank: true } }),
    user?.role === "FAN"
      ? db.donation.findMany({ where: { fromId: user.id, toId: id, status: { in: ["AWAITING_TRANSFER", "PENDING_REVIEW", "REJECTED"] } }, orderBy: { createdAt: "desc" }, take: 5 })
      : [],
    revealed ? db.prediction.findMany({ where: { targetId: id }, include: { author: { select: { name: true } } } }) : [],
    user?.role === "FAN"
      ? db.challenge.findMany({
          where: { authorId: user.id, targetId: id, status: { in: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAYMENT_REJECTED"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [],
    getFund(),
  ]);
  const fundOpen = Boolean(fund.keeper && fund.sbpPhone);
  const isMe = user?.id === id;
  const next = `/p/${id}`;
  const fanView = !user || user.role === "FAN";
  const finalWeight = p.weightSeries.find((w) => w.week === finalWeek())?.weight;

  const scoreByWeek = new Map(p.weeks.map((w) => [w.week, w]));
  const lastWeek = p.lastWeek;
  const hasStart = p.startWeight !== null;
  const progressed = hasStart && lastWeek !== null && lastWeek !== START_WEEK;
  const badges = [
    { label: "место", value: `${p.total > 0 && p.place <= 3 ? ["🥇", "🥈", "🥉"][p.place - 1] + " " : ""}${p.place} из ${all.length}` },
    { label: "баллов", value: p.total },
    { label: "донатов", value: `${p.donationsTotal.toLocaleString("ru-RU")} ₽` },
  ];

  return (
    <div className="space-y-6">
      <div className="card flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar name={p.name} url={p.avatarUrl} size={128} className="ring-4 ring-[var(--color-accent)]/25 self-center sm:self-auto" />
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="text-3xl font-bold leading-tight">{p.name}</h1>
          {p.username && (
            <a href={`https://t.me/${p.username}`} target="_blank" rel="noreferrer" className="muted text-sm hover:underline">
              @{p.username}
            </a>
          )}
          {p.motto && <p className="mt-1 italic">«{p.motto}»</p>}
          <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
            {badges.map((b) => (
              <span key={b.label} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm">
                <b className="tabular-nums">{b.value}</b> <span className="muted">{b.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="self-center">
          <FavoriteButton id={id} count={p.fans} active={myVote?.participantId === id} guest={!user} readOnly={!!user && user.role !== "FAN"} size="lg" />
        </div>
      </div>

      <section className="card space-y-5">
        {!hasStart ? (
          <p className="muted text-sm">Стартовое взвешивание ещё не внесено.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 sm:items-stretch">
              <div className="rounded-xl bg-[var(--bg)] p-4">
                <div className="text-xs uppercase tracking-wide muted">Был</div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums mt-1">{p.startWeight} кг</div>
                <div className="text-sm muted mt-1">{weekLabel(START_WEEK)}</div>
                <div className="text-sm muted">Талия {p.startWaist ? `${p.startWaist} см` : "—"}</div>
              </div>
              <div className="hidden sm:flex items-center muted text-2xl">→</div>
              <div className="rounded-xl bg-[var(--bg)] p-4">
                <div className="text-xs uppercase tracking-wide muted">Сейчас</div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums mt-1">{progressed ? `${p.currentWeight} кг` : "—"}</div>
                <div className="text-sm muted mt-1">{progressed ? weekLabel(lastWeek!) : "—"}</div>
                <div className="text-sm muted">Талия {p.currentWaist ? `${p.currentWaist} см` : "—"}</div>
              </div>
              <div className="hidden sm:flex items-center muted text-2xl">=</div>
              <div className={`col-span-2 sm:col-span-1 rounded-xl p-4 ${p.lostKg > 0 ? "bg-[var(--color-accent)]/10" : p.lostKg < 0 ? "bg-red-500/10" : "bg-[var(--bg)]"}`}>
                <div className="text-xs uppercase tracking-wide muted">Итог</div>
                <div className={`text-2xl sm:text-3xl font-bold tabular-nums mt-1 ${tone(-p.lostKg)}`}>{signed(-p.lostKg)} кг</div>
                <div className={`text-sm font-semibold mt-1 ${tone(-p.lostKg)}`}>{signed(-p.lostPct)}% от стартового веса</div>
              </div>
            </div>
            {!!p.goalWeight && (
              <div>
                <div className="flex flex-wrap justify-between gap-2 text-sm mb-1.5">
                  <span>
                    Цель <b>{p.goalWeight} кг</b>
                    <span className="muted"> · сбросить {round1(p.startWeight! - p.goalWeight)} кг</span>
                  </span>
                  {p.goalPct !== null && (
                    <span>
                      пройдено <b>{p.goalPct}%</b>
                      {p.currentWeight !== null && p.currentWeight > p.goalWeight && <span className="muted"> · осталось {round1(p.currentWeight - p.goalWeight)} кг</span>}
                    </span>
                  )}
                </div>
                <div className="h-2.5 rounded-full bg-[var(--line)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${p.goalPct ?? 0}%` }} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className={`grid gap-6 items-start ${fanView ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        <div className="space-y-4 min-w-0">
          <section className="card">
            <h2 className="h2 mb-3">Вес по неделям</h2>
            <WeightChart series={p.weightSeries} goal={p.goalWeight} start={p.startWeight} labels={weekLabels()} />
          </section>

          <section className="card !p-0 overflow-hidden">
            <h2 className="h2 p-5 pb-3">Динамика по неделям</h2>
            {p.dynamics.length === 0 ? (
              <p className="muted text-sm px-5 pb-5">Результатов пока нет.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="muted text-left text-xs sm:text-sm whitespace-nowrap">
                    <tr className="border-y border-[var(--line)]">
                      <th className="py-2 pl-3 sm:pl-5 pr-2 font-medium">Неделя</th>
                      <th className="py-2 pr-2 sm:pr-3 font-medium text-right">Вес</th>
                      <th className="py-2 pr-2 sm:pr-3 font-medium text-right">За неделю</th>
                      <th className="hidden sm:table-cell py-2 pr-3 font-medium text-right">От старта</th>
                      <th className="hidden sm:table-cell py-2 pr-3 font-medium text-right">Талия</th>
                      <th className="py-2 pr-3 sm:pr-5 font-medium text-right">Баллы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.dynamics.map((d) => {
                      const w = scoreByWeek.get(d.week);
                      const dash = <span className="muted">—</span>;
                      const kgPct = (kg: number, pct: number) => (
                        <>
                          <div>{signed(kg)} кг</div>
                          <div className="text-xs opacity-80">{signed(pct)}%</div>
                        </>
                      );
                      const parts: [string, number][] = w
                        ? [
                            ["Вес", w.weightPts],
                            ["Шаги", w.stepsPts],
                            ["Кардио", w.cardioPts],
                            ["Силовые", w.strengthPts],
                            ...(w.penalty ? [["Штраф", -w.penalty] as [string, number]] : []),
                          ]
                        : [];
                      const start = d.week === START_WEEK;
                      const cell = `py-2 align-top ${parts.length ? "pb-1" : ""}`;
                      return (
                        <Fragment key={d.week}>
                          <tr className={`${parts.length ? "" : "border-b"} border-[var(--line)] ${start ? "bg-[var(--bg)]" : ""}`}>
                            <td className={`${cell} pl-3 sm:pl-5 pr-2`}>{weekLabel(d.week)}</td>
                            <td className={`${cell} pr-2 sm:pr-3 text-right tabular-nums font-semibold`}>{d.weight}</td>
                            <td className={`${cell} pr-2 sm:pr-3 text-right tabular-nums whitespace-nowrap ${tone(d.deltaKg)}`}>
                              {d.deltaKg === null ? dash : kgPct(d.deltaKg, d.deltaPct!)}
                            </td>
                            <td className={`${cell} hidden sm:table-cell pr-3 text-right tabular-nums whitespace-nowrap ${tone(d.fromStartKg)}`}>
                              {start || d.fromStartKg === null ? dash : kgPct(d.fromStartKg, d.fromStartPct!)}
                            </td>
                            <td className={`${cell} hidden sm:table-cell pr-3 text-right tabular-nums`}>{d.waistCm ?? dash}</td>
                            <td className={`${cell} pr-3 sm:pr-5 text-right tabular-nums font-semibold`}>{w ? w.total : dash}</td>
                          </tr>
                          {parts.length > 0 && (
                            <tr className="border-b border-[var(--line)]">
                              <td colSpan={6} className="pb-2 pl-3 sm:pl-5 pr-3 sm:pr-5">
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs muted">
                                  {parts.map(([label, v]) => (
                                    <span key={label} className="whitespace-nowrap">
                                      {label} <b className={`tabular-nums ${v < 0 ? "text-red-600" : "text-[var(--text)]"}`}>{v < 0 ? `−${-v}` : v}</b>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {(p.finalWaist || revealed) && (
                      <tr>
                        <td className="py-2 pl-3 sm:pl-5 pr-2" colSpan={5}>
                          Финал: ставки {p.betPts}, бонус за талию {p.waistPts}
                        </td>
                        <td className="py-2 pr-3 sm:pr-5 text-right tabular-nums font-semibold">{p.betPts + p.waistPts}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {revealed && predictionsAbout.length > 0 && (
            <section className="card space-y-2">
              <h2 className="h2">Ставки на финальный вес {p.name}</h2>
              {predictionsAbout.map((pr) => (
                <div key={pr.id} className="flex justify-between text-sm border-t border-[var(--line)] pt-2">
                  <span>{pr.author.name}</span>
                  <span className="tabular-nums">
                    {pr.weight} кг{finalWeight !== undefined && ` · +${betPoints(pr.weight, finalWeight)} балл.`}
                  </span>
                </div>
              ))}
            </section>
          )}

          {isMe && <PostComposer />}
          <h2 className="h2">Активность</h2>
          {feed.length === 0 && <p className="muted">Пока ничего нет.</p>}
          {feed.map((item) => (
            <FeedCard key={`${item.type}-${item.data.id}`} item={item} viewerId={user?.id ?? null} isAdmin={isAdmin(user)} />
          ))}
        </div>
        {fanView && (
          <aside className="space-y-4 lg:sticky lg:top-4 order-first lg:order-none">
            <section className="card space-y-3">
              <h2 className="h2">💸 Поддержать</h2>
              {!user ? (
                <LoginPrompt next={next}>Войти и задонатить</LoginPrompt>
              ) : !details?.sbpPhone && !details?.paymentDetails ? (
                <p className="text-sm muted">{p.name} ещё не указал(а) реквизиты для перевода.</p>
              ) : (
                <>
                  {myDonations.map((d) => (
                    <div key={d.id} className="rounded-xl border border-[var(--line)] p-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <b>{d.amount.toLocaleString("ru-RU")} ₽</b>
                        <span className={DONATION_STATUS[d.status].cls}>{DONATION_STATUS[d.status].text}</span>
                      </div>
                      {d.status === "AWAITING_TRANSFER" && (
                        <>
                          {details.sbpPhone ? (
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                              <dt className="muted">СБП</dt>
                              <dd className="font-medium tabular-nums select-all">{details.sbpPhone}</dd>
                              {details.sbpBank && (
                                <>
                                  <dt className="muted">Банк</dt>
                                  <dd className="font-medium">{details.sbpBank}</dd>
                                </>
                              )}
                              <dt className="muted">Получатель</dt>
                              <dd className="font-medium">{p.name}</dd>
                            </dl>
                          ) : (
                            <p className="font-medium whitespace-pre-wrap">{details.paymentDetails}</p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <ActionButton action={markTransferred.bind(null, d.id)} className="!py-1.5 !px-3 !text-xs">
                              Я перевёл
                            </ActionButton>
                            <ActionButton action={cancelDonation.bind(null, d.id)} variant="ghost" className="!py-1.5 !px-3 !text-xs">
                              Отменить
                            </ActionButton>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <DonateForm toId={id} />
                </>
              )}
            </section>
            <section className="card">
              <h2 className="h2 mb-3">🔥 Бросить челлендж</h2>
              {!user ? (
                <LoginPrompt next={next}>Войти и бросить челлендж</LoginPrompt>
              ) : !fundOpen ? (
                <p className="text-sm muted">Реквизиты фонда ещё не заданы.</p>
              ) : (
                <div className="space-y-3">
                  {myChallenges.map((c) => (
                    <ChallengePayBox key={c.id} c={c} fund={fund} />
                  ))}
                  <ChallengeForm targetId={id} />
                </div>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
