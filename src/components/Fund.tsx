import Link from "next/link";
import { Avatar } from "./Avatar";

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

type Contributor = { id: string; name: string; avatarUrl: string | null; amount: number };

export function FundTotal({ total, baseAmount, contributed }: { total: number; baseAmount: number; contributed: number }) {
  return (
    <div>
      <div className="text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight">{rub(total)}</div>
      {contributed > 0 && baseAmount > 0 && (
        <div className="text-sm muted mt-1 tabular-nums">
          база {rub(baseAmount)} · болельщики {rub(contributed)}
        </div>
      )}
    </div>
  );
}

export function ContributorList({ contributors, limit }: { contributors: Contributor[]; limit?: number }) {
  const shown = limit ? contributors.slice(0, limit) : contributors;
  if (shown.length === 0) return null;
  return (
    <ol className="divide-y divide-[var(--line)]">
      {shown.map((c) => (
        <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <Avatar name={c.name} url={c.avatarUrl} size={32} />
          <span className="font-medium truncate min-w-0">{c.name}</span>
          <span className="ml-auto tabular-nums font-semibold whitespace-nowrap">{rub(c.amount)}</span>
        </li>
      ))}
      {limit && contributors.length > limit && (
        <li className="pt-2.5 text-sm">
          <Link href="/fund" className="hover:underline muted">
            ещё {contributors.length - limit}
          </Link>
        </li>
      )}
    </ol>
  );
}

/** Куда переводить по СБП: телефон и банк хранителя фонда. */
export function SbpRequisites({ phone, bank, keeper }: { phone: string; bank: string | null; keeper: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="muted">СБП</dt>
      <dd className="font-medium tabular-nums select-all">{phone}</dd>
      {bank && (
        <>
          <dt className="muted">Банк</dt>
          <dd className="font-medium">{bank}</dd>
        </>
      )}
      <dt className="muted">Получатель</dt>
      <dd className="font-medium">{keeper}</dd>
    </dl>
  );
}
