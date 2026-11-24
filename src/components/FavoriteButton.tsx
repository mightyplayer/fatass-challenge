"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions";

type Props = { id: string; count: number; active: boolean; guest?: boolean; readOnly?: boolean; size?: "sm" | "lg" };

/** Постоянный голос болельщика за фаворита: один на болельщика, можно перенести или снять. */
export function FavoriteButton({ id, count, active, guest, readOnly, size = "sm" }: Props) {
  const [state, setState] = useOptimistic({ count, active });
  const [pending, start] = useTransition();
  const pathname = usePathname();
  const base =
    size === "lg"
      ? "inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-lg font-bold transition"
      : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition";
  const on = "border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:border-rose-700";
  const off = "border-[var(--line)] hover:border-rose-300 hover:text-rose-600";
  const heart = (filled: boolean) => (
    <span aria-hidden className={size === "lg" ? "text-2xl leading-none" : "text-base leading-none"}>
      {filled ? "♥" : "♡"}
    </span>
  );

  if (readOnly) {
    return (
      <span className={`${base} border-[var(--line)] muted`}>
        {heart(count > 0)}
        {count}
      </span>
    );
  }
  if (guest) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={`${base} ${off}`}>
        {heart(false)}
        {count}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={state.active}
      title="Фаворит"
      onClick={() =>
        start(async () => {
          setState({ active: !state.active, count: state.count + (state.active ? -1 : 1) });
          await toggleFavorite(id);
        })
      }
      className={`${base} cursor-pointer ${state.active ? on : off}`}
    >
      {heart(state.active)}
      {state.count}
    </button>
  );
}
