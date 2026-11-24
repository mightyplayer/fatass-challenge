import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createSession, safeNext } from "@/lib/session";
import { exchangeCode } from "@/lib/telegram";
import { upsertTelegramUser } from "@/lib/users";

export async function GET(req: NextRequest) {
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${config.appUrl}/login?error=${encodeURIComponent(reason)}`);
    res.cookies.delete("sb_oauth");
    return res;
  };

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return fail("denied");

  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("sb_oauth")?.value ?? "{}");
  } catch {}
  if (!code || !state || !saved.state || state !== saved.state || !saved.verifier) return fail("state");

  try {
    const profile = await exchangeCode(code, saved.verifier);
    const user = await upsertTelegramUser(profile);
    await createSession(user.id);
    const res = NextResponse.redirect(`${config.appUrl}${user.role === "PENDING" ? `/onboarding?next=${encodeURIComponent(safeNext(saved.next))}` : safeNext(saved.next)}`);
    res.cookies.delete("sb_oauth");
    return res;
  } catch (e) {
    console.error("Telegram login failed", e);
    return fail("exchange");
  }
}
