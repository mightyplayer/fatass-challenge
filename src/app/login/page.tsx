import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getCurrentUser, safeNext } from "@/lib/session";

const ERRORS: Record<string, string> = {
  not_configured: "Вход через Telegram ещё не настроен: задайте TELEGRAM_CLIENT_ID и TELEGRAM_CLIENT_SECRET.",
  denied: "Вход отменён в Telegram.",
  state: "Сессия входа устарела, попробуйте ещё раз.",
  exchange: "Telegram не подтвердил вход, попробуйте ещё раз.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="max-w-md mx-auto mt-16 card text-center space-y-5">
      <div className="text-5xl">⚖️</div>
      <h1 className="h1">{config.competition.title}</h1>
      <a href={`/api/auth/telegram/start?next=${encodeURIComponent(next)}`} className="btn w-full !bg-[#2aabee] hover:!bg-[#229ed9] !py-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
        Войти через Telegram
      </a>
      {error && <p className="text-sm text-red-600">{ERRORS[error] ?? "Не получилось войти."}</p>}
      {config.devLogin && (
        <div className="text-sm muted border-t border-[var(--line)] pt-4 space-y-2">
          <p>Режим разработки: войти без Telegram</p>
          <form action="/api/auth/dev" className="flex gap-2">
            <input type="hidden" name="next" value={next} />
            <input name="name" placeholder="Имя" className="input" required />
            <button className="btn btn-ghost">Войти</button>
          </form>
        </div>
      )}
    </div>
  );
}
