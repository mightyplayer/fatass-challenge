import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createSession, safeNext } from "@/lib/session";
import { upsertTelegramUser } from "@/lib/users";

// Вход без Telegram для локальной разработки. Работает только при DEV_LOGIN=true вне production.
export async function GET(req: NextRequest) {
  if (!config.devLogin) return new NextResponse("Not found", { status: 404 });
  const name = req.nextUrl.searchParams.get("name") || "Тестовый пользователь";
  const id = req.nextUrl.searchParams.get("id") || String(1000 + Math.floor(Math.random() * 9000));
  const user = await upsertTelegramUser({ telegramId: BigInt(id), name, username: req.nextUrl.searchParams.get("username") || `dev${id}` });
  await createSession(user.id);
  return NextResponse.redirect(`${config.appUrl}${user.role === "PENDING" ? `/onboarding?next=${encodeURIComponent(safeNext(req.nextUrl.searchParams.get("next")))}` : safeNext(req.nextUrl.searchParams.get("next"))}`);
}
