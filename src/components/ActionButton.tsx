"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";

type Props = {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  confirm?: string;
  className?: string;
};

export function ActionButton({ action, children, variant = "primary", confirm, className }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={`btn ${variant === "ghost" ? "btn-ghost" : ""} ${className ?? ""}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setError((await action())?.error));
        }}
      >
        {children}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
