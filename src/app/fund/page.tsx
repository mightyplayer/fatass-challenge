import { cancelFundContribution, markFundTransferred } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { DONATION_STATUS } from "@/components/FeedItems";
import { FundContributeForm } from "@/components/Forms";
import { ContributorList, FundTotal, SbpRequisites } from "@/components/Fund";
import { LoginPrompt } from "@/components/LoginPrompt";
import { db } from "@/lib/db";
import { getFundSummary } from "@/lib/fund";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FundPage() {
  const user = await getViewer();
  const fund = await getFundSummary();
  const open = Boolean(fund.keeper && fund.sbpPhone);
  const showAside = open && (!user || user.role === "FAN");
  const mine =
    user?.role === "FAN"
      ? await db.fundContribution.findMany({
          where: { fromId: user.id, status: { in: ["AWAITING_TRANSFER", "PENDING_REVIEW", "REJECTED"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [];

  return (
    <div className="space-y-6">
      <h1 className="h1">🏆 Призовой фонд</h1>
      <div className={`grid gap-6 items-start ${showAside ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        <div className="space-y-6 min-w-0">
          <section className="card">
            <FundTotal total={fund.total} baseAmount={fund.baseAmount} contributed={fund.contributed} />
          </section>
          {fund.contributors.length > 0 && (
            <section className="card space-y-3">
              <h2 className="h2">
                Болельщики <span className="muted font-normal">· {fund.contributors.length}</span>
              </h2>
              <ContributorList contributors={fund.contributors} />
            </section>
          )}
        </div>
        {showAside && (
          <aside className="card space-y-3 lg:sticky lg:top-4">
            <h2 className="h2">Пополнить</h2>
            {!user ? (
              <LoginPrompt next="/fund">Войти и пополнить</LoginPrompt>
            ) : (
              <>
                {mine.map((c) => (
                  <div key={c.id} className="rounded-xl border border-[var(--line)] p-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <b>{c.amount.toLocaleString("ru-RU")} ₽</b>
                      <span className={`whitespace-nowrap ${DONATION_STATUS[c.status].cls}`}>{DONATION_STATUS[c.status].text}</span>
                    </div>
                    {c.status === "AWAITING_TRANSFER" && (
                      <>
                        <SbpRequisites phone={fund.sbpPhone!} bank={fund.sbpBank} keeper={fund.keeper!.name} />
                        <div className="flex gap-2 flex-wrap">
                          <ActionButton action={markFundTransferred.bind(null, c.id)} className="!py-1.5 !px-3 !text-xs">
                            Я перевёл
                          </ActionButton>
                          <ActionButton action={cancelFundContribution.bind(null, c.id)} variant="ghost" className="!py-1.5 !px-3 !text-xs">
                            Отменить
                          </ActionButton>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <FundContributeForm />
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
