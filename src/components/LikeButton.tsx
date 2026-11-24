"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toggleLike } from "@/app/actions";

type Props = { kind: "post" | "result" | "challenge"; id: string; count: number; liked: boolean; guest?: boolean };

export function LikeButton({ kind, id, count, liked, guest }: Props) {
  const [state, setState] = useOptimistic({ count, liked });
  const [pending, start] = useTransition();
  const pathname = usePathname();
  if (guest) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} title="Войди через Telegram, чтобы ставить лайки" className="chip muted hover:bg-[var(--bg)]">
        <span aria-hidden>♡</span>
        {count}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={state.liked}
      onClick={() =>
        start(async () => {
          setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
          await toggleLike(kind, id);
        })
      }
      className={`chip cursor-pointer transition ${state.liked ? "border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:border-rose-800" : "muted hover:bg-[var(--bg)]"}`}
    >
      <span aria-hidden>{state.liked ? "♥" : "♡"}</span>
      {state.count}
    </button>
  );
}
