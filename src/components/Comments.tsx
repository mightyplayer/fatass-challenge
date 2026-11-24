"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addComment, deleteComment, type ActionState } from "@/app/actions";
import { buildTree, visibleCount, type CommentNode, type FlatComment } from "@/lib/comments";
import { Avatar } from "./Avatar";
import { loginHref } from "./LoginPrompt";

/** Глубже этого уровня ответы не сдвигаются вправо, чтобы ветка не уезжала на телефоне. */
const MAX_INDENT = 4;

type Ctx = { postId: string; viewerId: string | null; isAdmin: boolean; next: string };

function when(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function BubbleIcon() {
  return (
    <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/** Под постом: лайк, счётчик комментариев и раскрывающееся дерево комментариев. */
export function PostComments({ postId, comments, viewerId, isAdmin, like }: { postId: string; comments: FlatComment[]; viewerId: string | null; isAdmin: boolean; like: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tree = useMemo(() => buildTree(comments), [comments]);
  const ctx: Ctx = { postId, viewerId, isAdmin, next: usePathname() };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {like}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`chip cursor-pointer muted hover:bg-[var(--bg)] ${open ? "bg-[var(--bg)]" : ""}`}>
          <BubbleIcon />
          {visibleCount(comments)}
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--line)] pt-3">
          {viewerId ? (
            <CommentForm ctx={ctx} parentId={null} placeholder="Комментарий" />
          ) : (
            <Link href={loginHref(ctx.next)} className="btn btn-ghost !py-1.5 !text-sm">
              Комментировать
            </Link>
          )}
          {tree.length > 0 && (
            <div className="space-y-3">
              {tree.map((n) => (
                <CommentItem key={n.id} node={n} depth={0} ctx={ctx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentForm({ ctx, parentId, placeholder, onDone, autoFocus }: { ctx: Ctx; parentId: string | null; placeholder: string; onDone?: () => void; autoFocus?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addComment.bind(null, ctx.postId, parentId), null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    ref.current?.reset();
    onDone?.();
  }, [state, onDone]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <textarea name="text" rows={2} maxLength={2000} required autoFocus={autoFocus} placeholder={placeholder} className="input !text-sm resize-y" />
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn !py-1.5 !px-3 !text-sm" disabled={pending}>
          Отправить
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost !py-1.5 !px-3 !text-sm" onClick={onDone}>
            Отмена
          </button>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function CommentItem({ node, depth, ctx, replyTo }: { node: CommentNode; depth: number; ctx: Ctx; replyTo?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const deleted = !!node.deletedAt;
  const name = deleted ? "удалён" : node.author.name;
  const flatten = depth >= MAX_INDENT;
  const canDelete = !deleted && (node.author.id === ctx.viewerId || ctx.isAdmin);

  if (collapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} className="flex items-center gap-2 text-left text-sm w-full min-w-0 cursor-pointer">
        <span className="muted w-6 text-center shrink-0 font-semibold">+</span>
        <span className={`font-semibold truncate ${deleted ? "muted" : ""}`}>{name}</span>
        <span className="muted text-xs shrink-0">{when(node.createdAt)}</span>
        {node.total > 0 && <span className="chip muted shrink-0">{node.total}</span>}
      </button>
    );
  }

  const replies = node.replies.map((r) => <CommentItem key={r.id} node={r} depth={depth + 1} ctx={ctx} replyTo={flatten ? name : undefined} />);

  return (
    <>
      <div className="flex gap-2 min-w-0">
        <div className="flex flex-col items-center shrink-0">
          {deleted ? <span className="w-6 h-6 rounded-full bg-[var(--line)]" /> : <Avatar name={node.author.name} url={node.author.avatarUrl} size={24} />}
          <button type="button" aria-label="Свернуть" onClick={() => setCollapsed(true)} className="group flex-1 w-6 flex justify-center pt-1 cursor-pointer">
            <span className="w-0.5 h-full rounded bg-[var(--line)] group-hover:bg-[var(--color-accent)]" />
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-sm leading-6 flex items-baseline gap-x-2 flex-wrap">
            {deleted ? (
              <span className="muted font-semibold">{name}</span>
            ) : (
              <Link href={`/p/${node.author.id}`} className="font-semibold hover:underline">
                {name}
              </Link>
            )}
            {replyTo && <span className="muted text-xs">→ {replyTo}</span>}
            <span className="muted text-xs">{when(node.createdAt)}</span>
          </div>
          {!deleted && <p className="text-sm whitespace-pre-wrap break-words">{node.text}</p>}
          {!deleted && (
            <div className="flex items-center gap-3 text-xs font-semibold muted">
              {ctx.viewerId ? (
                <button type="button" className="hover:text-[var(--text)] cursor-pointer" onClick={() => setReplying(!replying)}>
                  Ответить
                </button>
              ) : (
                <Link href={loginHref(ctx.next)} className="hover:text-[var(--text)]">
                  Ответить
                </Link>
              )}
              {canDelete && (
                <button
                  type="button"
                  disabled={pending}
                  className="hover:text-red-600 cursor-pointer"
                  onClick={() => {
                    if (!window.confirm("Удалить комментарий?")) return;
                    start(async () => setError((await deleteComment(node.id))?.error));
                  }}
                >
                  Удалить
                </button>
              )}
              {error && <span className="text-red-600 font-normal">{error}</span>}
            </div>
          )}
          {replying && <CommentForm ctx={ctx} parentId={node.id} placeholder="Ответ" autoFocus onDone={() => setReplying(false)} />}
          {!flatten && replies.length > 0 && <div className="space-y-3 pt-1.5">{replies}</div>}
        </div>
      </div>
      {flatten && replies}
    </>
  );
}
