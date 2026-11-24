import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(`${config.appUrl}/`, { status: 303 });
}
