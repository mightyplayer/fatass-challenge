import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { safeNext } from "@/lib/session";
import { buildAuthorizeUrl, randomToken } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  if (!config.telegram.enabled) {
    return NextResponse.redirect(`${config.appUrl}/login?error=not_configured`);
  }
  const state = randomToken(16);
  const verifier = randomToken(48);
  const res = NextResponse.redirect(await buildAuthorizeUrl(state, verifier));
  res.cookies.set("sb_oauth", JSON.stringify({ state, verifier, next: safeNext(req.nextUrl.searchParams.get("next")) }), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.appUrl.startsWith("https://"),
    path: "/api/auth/telegram",
    maxAge: 600,
  });
  return res;
}
