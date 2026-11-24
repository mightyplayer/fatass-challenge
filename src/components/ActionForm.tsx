"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions";

type Props = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
};

export function ActionForm({ action, children, submitLabel, resetOnSuccess, className, submitClassName }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className ?? "space-y-3"}>
      {children}
      <div className="flex items-center gap-3 flex-wrap">
        <button className={`btn ${submitClassName ?? ""}`} disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && state.message && <span className="text-sm text-[var(--color-accent)]">{state.message}</span>}
      </div>
    </form>
  );
}
