"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { togglePostReaction } from "@/app/actions";
import { REACTIONS, type ReactionKind, type ReactionSummary } from "@/lib/reactions";
import { loginHref } from "./LoginPrompt";

const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji])) as Record<ReactionKind, string>;

function AddIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="13" r="8" />
      <path d="M8 15.5c1.6 1.6 4.4 1.6 6 0M8.5 11h.01M13.5 11h.01M19 2v5M16.5 4.5h5" />
    </svg>
  );
}

/** Реакции на пост: стоящие показываются чипами, остальные добавляются из меню. */
export function PostReactions({ postId, summary, guest }: { postId: string; summary: ReactionSummary[]; guest: boolean }) {
  const [state, toggle] = useOptimistic(summary, (s, kind: ReactionKind) =>
    s.map((r) => (r.kind === kind ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)),
  );
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const next = usePathname();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const react = (kind: ReactionKind) =>
    start(async () => {
      toggle(kind);
      await togglePostReaction(postId, kind);
    });

  const chipCls = (mine: boolean) =>
    `chip cursor-pointer transition ${mine ? "border-[var(--color-accent)] bg-[var(--bg)] text-[var(--text)]" : "muted hover:bg-[var(--bg)]"}`;

  return (
    <>
      {state
        .filter((r) => r.count > 0)
        .map((r) =>
          guest ? (
            <Link key={r.kind} href={loginHref(next)} className={chipCls(false)}>
              <span aria-hidden>{EMOJI[r.kind]}</span>
              {r.count}
            </Link>
          ) : (
            <button key={r.kind} type="button" aria-pressed={r.mine} onClick={() => react(r.kind)} className={chipCls(r.mine)}>
              <span aria-hidden>{EMOJI[r.kind]}</span>
              {r.count}
            </button>
          ),
        )}
      {guest ? (
        <Link href={loginHref(next)} aria-label="Реакция" className="chip muted hover:bg-[var(--bg)] !py-1">
          <AddIcon />
        </Link>
      ) : (
        <div ref={box} className="relative">
          <button type="button" aria-label="Реакция" aria-expanded={open} onClick={() => setOpen(!open)} className="chip cursor-pointer muted hover:bg-[var(--bg)] !py-1">
            <AddIcon />
          </button>
          {open && (
            <div className="absolute bottom-full left-0 mb-2 z-10 flex gap-1 rounded-full border border-[var(--line)] bg-[var(--card)] p-1 shadow-lg">
              {state.map((r) => (
                <button
                  key={r.kind}
                  type="button"
                  aria-pressed={r.mine}
                  onClick={() => {
                    setOpen(false);
                    react(r.kind);
                  }}
                  className={`w-9 h-9 rounded-full text-xl leading-none cursor-pointer transition hover:scale-125 ${r.mine ? "bg-[var(--bg)] ring-1 ring-[var(--color-accent)]" : ""}`}
                >
                  {EMOJI[r.kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
