import { deleteChallenge, markChallengeTransferred } from "@/app/actions";
import { ActionButton } from "./ActionButton";
import { challengeStatus, rub } from "./FeedItems";
import { SbpRequisites } from "./Fund";

type Fund = { sbpPhone: string | null; sbpBank: string | null; keeper: { name: string } | null };
type MyChallenge = {
  id: string;
  title: string;
  reward: number;
  status: Parameters<typeof challengeStatus>[0]["status"];
  paidAt: Date | null;
  settledAt: Date | null;
};

const DELETABLE = ["AWAITING_PAYMENT", "PAYMENT_REJECTED", "PENDING"];

/** Реквизиты хранителя, пока челлендж не оплачен, и кнопки «Я перевёл» и «Удалить», пока участник не ответил. */
export function ChallengePayActions({ c, fund }: { c: MyChallenge; fund: Fund }) {
  const pay = c.status === "AWAITING_PAYMENT";
  const del = DELETABLE.includes(c.status);
  if (!pay && !del) return null;
  return (
    <>
      {pay && fund.sbpPhone && fund.keeper && <SbpRequisites phone={fund.sbpPhone} bank={fund.sbpBank} keeper={fund.keeper.name} />}
      <div className="flex gap-2 flex-wrap">
        {pay && (
          <ActionButton action={markChallengeTransferred.bind(null, c.id)} className="!py-1.5 !px-3 !text-xs">
            Я перевёл
          </ActionButton>
        )}
        {del && (
          <ActionButton
            action={deleteChallenge.bind(null, c.id)}
            variant="ghost"
            confirm={c.paidAt ? `Удалить челлендж «${c.title}»? Вознаграждение вернётся.` : `Удалить челлендж «${c.title}»?`}
            className="!py-1.5 !px-3 !text-xs"
          >
            Удалить
          </ActionButton>
        )}
      </div>
    </>
  );
}

/** Неоплаченный челлендж автора на странице участника. */
export function ChallengePayBox({ c, fund }: { c: MyChallenge; fund: Fund }) {
  const s = challengeStatus(c);
  return (
    <div className="rounded-xl border border-[var(--line)] p-3 space-y-2 text-sm">
      <div className="font-semibold">🔥 {c.title}</div>
      <div className="flex justify-between gap-2">
        <b className="tabular-nums">{rub(c.reward)}</b>
        <span className={`whitespace-nowrap ${s.cls}`}>{s.text}</span>
      </div>
      <ChallengePayActions c={c} fund={fund} />
    </div>
  );
}
