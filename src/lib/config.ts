import { parseLocalDate } from "./time";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Не задана переменная окружения ${name}`);
  return v;
}

export const config = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    return new TextEncoder().encode(required("SESSION_SECRET"));
  },
  telegram: {
    get clientId() {
      return required("TELEGRAM_CLIENT_ID");
    },
    get clientSecret() {
      return required("TELEGRAM_CLIENT_SECRET");
    },
    get enabled() {
      return Boolean(process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET);
    },
  },
  competition: {
    title: process.env.COMPETITION_TITLE ?? "Жиробас челлендж",
    // день старта: стартовый вес и талия
    start: parseLocalDate(process.env.COMPETITION_START ?? "2026-10-12"),
    // число еженедельных отчётов (каждые 7 дней после старта)
    weeks: Number(process.env.COMPETITION_WEEKS ?? 11),
    // финал: финальный вес и талия, раскрытие ставок
    final: parseLocalDate(process.env.COMPETITION_FINAL ?? "2026-12-31"),
  },
  // Супер-админы: Telegram id или @username через запятую. Назначают админов в /admin.
  superAdmins: (process.env.SUPERADMIN_TELEGRAM ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean),
  devLogin: process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production",
};
