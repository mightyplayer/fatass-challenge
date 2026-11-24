import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CompetitionChart } from "@/components/Charts";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ContributorList, FundTotal } from "@/components/Fund";
import { loginHref } from "@/components/LoginPrompt";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { getFundSummary } from "@/lib/fund";
import { getViewer } from "@/lib/session";
import { getParticipantStats } from "@/lib/stats";
import { isAdmin } from "@/lib/users";
import { competitionStarted, currentWeek, finalWeek, predictionsRevealed, weekDate, weekLabel, weekLabels } from "@/lib/week";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default async function Dashboard() {
  const user = await getViewer();
  const week = currentWeek();
  const started = competitionStarted();
  const [stats, activeChallenges, myVote, fund] = await Promise.all([
    getParticipantStats(),
    db.challenge.count({ where: { status: { in: ["PENDING", "ACCEPTED", "COMPLETION_REVIEW"] } } }),
    user?.role === "FAN" ? db.vote.findUnique({ where: { fanId: user.id } }) : null,
    getFundSummary(),
  ]);

  const leader = stats[0];
  const totalLost = stats.reduce((s, p) => s + p.lostKg, 0);
  const totalDonations = stats.reduce((s, p) => s + p.donationsTotal, 0);
  const reported = stats.filter((p) => p.reportedThisWeek).length;
  const labels = weekLabels();
  const final = finalWeek();
  const showBets = predictionsRevealed();
  const showWaist = stats.some((p) => p.finalWaist);

  const tiles = [
    { label: "Лидер", value: leader && leader.total > 0 ? leader.name : "—", hint: leader && leader.total > 0 ? `${leader.total} баллов` : undefined },
    { label: "Сброшено всеми", value: `${fmt(Math.round(totalLost * 10) / 10)} кг` },
    { label: "Донаты", value: `${fmt(totalDonations)} ₽` },
    { label: "Челленджи", value: activeChallenges },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Общий рейтинг</h1>
          <p className="muted">
            {started ? `${weekLabel(week)} · внесено ${reported} из ${stats.length}` : `Старт ${fmtDate(weekDate(0))}`}
            {` · финал ${fmtDate(config.competition.final)}`}
          </p>
        </div>
        {isAdmin(user) && started && reported < stats.length && (
          <Link href={`/admin?week=${week}`} className="btn">
            Внести: {weekLabel(week)}
          </Link>
        )}
      </div>

      <section className="card grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <h2 className="h2">🏆 Призовой фонд</h2>
          <FundTotal total={fund.total} baseAmount={fund.baseAmount} contributed={fund.contributed} />
          {fund.keeper && fund.sbpPhone && (!user || user.role === "FAN") && (
            <Link href={user ? "/fund" : loginHref("/fund")} className="btn">
              Пополнить фонд
            </Link>
          )}
        </div>
        {fund.contributors.length > 0 && (
          <div className="space-y-3 md:border-l md:border-[var(--line)] md:pl-5 max-md:border-t max-md:border-[var(--line)] max-md:pt-4">
            <h2 className="h2">
              <Link href="/fund" className="hover:underline">
                Болельщики
              </Link>{" "}
              <span className="muted font-normal">· {fund.contributors.length}</span>
            </h2>
            <ContributorList contributors={fund.contributors} limit={5} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card !p-4">
            <div className="text-sm muted">{t.label}</div>
            <div className="text-2xl font-bold mt-1 truncate">{t.value}</div>
            {t.hint && <div className="text-xs muted mt-1">{t.hint}</div>}
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="h2 mb-4">Баллы по неделям</h2>
        <CompetitionChart participants={stats.map((p) => ({ id: p.id, name: p.name, series: p.pointsSeries }))} labels={labels} unit="pts" />
      </section>

      <section className="card !p-0 overflow-hidden">
        <div className="p-5 pb-3 flex flex-wrap gap-2 items-center justify-between">
          <h2 className="h2">Таблица</h2>
        </div>
        {stats.length === 0 ? (
          <p className="muted p-5 pt-0">Участников пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="muted text-left text-xs sm:text-sm">
                <tr className="border-y border-[var(--line)] whitespace-nowrap">
                  <th className="py-2 pl-3 sm:pl-5 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Участник</th>
                  <th className="py-2 pr-2 sm:pr-3 font-medium text-right">Баллы</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right" title="Баллы за снижение веса">Вес</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right" title="Баллы за дни с 10 000+ шагов">Шаги</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right" title="Баллы за дни с кардио 60+ минут">Кардио</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right" title="Баллы за силовые 45+ минут">Силовые</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right">Штрафы</th>
                  {showBets && <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right">Ставки</th>}
                  {showWaist && <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right">Талия</th>}
                  <th className="py-2 pr-2 sm:pr-3 font-medium text-right">Сброшено</th>
                  <th className="hidden lg:table-cell py-2 pr-3 font-medium text-right">Донаты</th>
                  <th className="py-2 pr-2 sm:pr-5 font-medium text-right">Фаворит</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pl-3 sm:pl-5 pr-2 font-semibold">{p.total > 0 && p.place <= 3 ? ["🥇", "🥈", "🥉"][p.place - 1] : p.place}</td>
                    <td className="py-3 pr-2">
                      <Link href={`/p/${p.id}`} className="flex items-center gap-2 hover:underline">
                        <Avatar name={p.name} url={p.avatarUrl} size={28} />
                        <span className="min-w-0">
                          <span className="font-medium block leading-tight">{p.name}</span>
                          {started && !p.reportedThisWeek && <span className="chip muted !text-[10px] mt-0.5 hidden sm:inline-flex">нет данных</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 pr-2 sm:pr-3 text-right tabular-nums text-base font-bold">{p.total}</td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.weightPts}</td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.stepsPts}</td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.cardioPts}</td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.strengthPts}</td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.penalty ? <span className="text-red-600">−{p.penalty}</span> : 0}</td>
                    {showBets && <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.betPts}</td>}
                    {showWaist && <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums">{p.finalWaist ? p.waistPts : <span className="muted">—</span>}</td>}
                    <td className="py-3 pr-2 sm:pr-3 text-right tabular-nums whitespace-nowrap">
                      <div>{p.lostKg > 0 ? `−${p.lostKg}` : p.lostKg < 0 ? `+${-p.lostKg}` : "0"} кг</div>
                      <div className="muted text-xs">{p.lostPct > 0 ? `−${p.lostPct}` : p.lostPct < 0 ? `+${-p.lostPct}` : "0"}%</div>
                    </td>
                    <td className="hidden lg:table-cell py-3 pr-3 text-right tabular-nums whitespace-nowrap">{fmt(p.donationsTotal)} ₽</td>
                    <td className="py-2 pr-2 sm:pr-5 text-right">
                      <FavoriteButton id={p.id} count={p.fans} active={myVote?.participantId === p.id} guest={!user} readOnly={!!user && user.role !== "FAN"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-4">Динамика веса</h2>
        <CompetitionChart participants={stats.map((p) => ({ id: p.id, name: p.name, series: p.lossSeries }))} labels={labels} unit="pct" />
      </section>

      <details className="card">
        <summary className="h2 cursor-pointer">Как считаются баллы</summary>
        <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
          <li>Каждый понедельник админ вносит вес и активность за неделю, всего {config.competition.weeks} недель.</li>
          <li>
            Вес: снижение от прошлого взвешивания меньше 0,3% — 0 баллов, до 0,6% — 3, до 0,9% — 6, до 1,2% — 9, больше — 12.
          </li>
          <li>Дни с 10 000+ шагов, дни с кардио от 60 минут и силовые от 45 минут: по баллу за каждый, но не больше 3 за неделю в каждом.</li>
          <li>Штрафы вычитаются.</li>
          <li>
            В финале ({fmtDate(weekDate(final))}) бонус за талию по % уменьшения от старта: меньше 1% — 0, до 3% — 2, до 5% — 4, до 7% — 6, до 9% — 8,
            больше — 10.
          </li>
          <li>
            Ставки: каждый участник угадывает финальный вес остальных. Ошибка до 1 кг — 3 балла, до 2 кг — 2, до 3 кг — 1. Ставки скрыты до финала.
          </li>
        </ul>
      </details>
    </div>
  );
}
