import Link from "next/link";

export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** Кнопка вместо действия для гостя: ведёт на вход и возвращает обратно. */
export function LoginPrompt({ next, children, className }: { next: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={loginHref(next)} className={`btn ${className ?? ""}`}>
      {children}
    </Link>
  );
}
