import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";
import { db } from "./db";
import { isAdmin, isSuperAdmin } from "./users";

const COOKIE = "sb_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(config.sessionSecret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.appUrl.startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, config.sessionSecret);
    if (!payload.sub) return null;
    return await db.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Для страниц: смотреть можно без входа. Вошедшего без роли отправляем выбрать роль. */
export async function getViewer() {
  const user = await getCurrentUser();
  if (user?.role === "PENDING") redirect("/onboarding");
  return user;
}

/** Требует вход; пользователя без роли отправляет на выбор роли. */
export async function requireUser(opts: { allowPending?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "PENDING" && !opts.allowPending) redirect("/onboarding");
  return user;
}

export async function requireParticipant() {
  const user = await requireUser();
  if (user.role !== "PARTICIPANT") throw new Error("Доступно только участникам соревнования");
  return user;
}

export async function requireFan() {
  const user = await requireUser();
  if (user.role !== "FAN") throw new Error("Доступно только болельщикам");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser({ allowPending: true });
  if (!isAdmin(user)) throw new Error("Доступно только админам");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser({ allowPending: true });
  if (!isSuperAdmin(user)) throw new Error("Доступно только супер-админу");
  return user;
}

/** Безопасный внутренний путь для возврата после входа. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
