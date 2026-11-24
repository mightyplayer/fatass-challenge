import { config } from "./config";
import { db } from "./db";
import { cacheAvatar } from "./storage";
import type { TelegramProfile } from "./telegram";

export function normalizeUsername(username: string | null | undefined) {
  const u = username?.trim().replace(/^@+/, "").toLowerCase();
  return u || null;
}

/** Заготовка участника (ещё без Telegram) с таким же ником. */
function findPlaceholder(username: string | undefined) {
  const u = normalizeUsername(username);
  if (!u) return null;
  return db.user.findFirst({ where: { telegramId: { lt: 0 }, username: { equals: u, mode: "insensitive" } } });
}

export async function upsertTelegramUser(p: TelegramProfile) {
  // аватар из Telegram храним у себя. Не вышло скачать — прошлую копию не трогаем (undefined),
  // а прямую ссылку t.me не сохраняем: она протухает, и вместо фото висит пустой кружок
  const avatarUrl = p.avatarUrl ? ((await cacheAvatar(p.avatarUrl, p.telegramId.toString())) ?? undefined) : undefined;
  const linked = { telegramId: p.telegramId, username: p.username, avatarUrl };

  // Участник заведён заранее по нику: вход попадает в его заготовку с уже внесёнными результатами.
  const superAdmin = isSuperAdmin({ telegramId: p.telegramId, username: p.username ?? null });
  const placeholder = superAdmin ? null : await findPlaceholder(p.username);
  if (placeholder) {
    const existing = await db.user.findUnique({ where: { telegramId: p.telegramId }, include: { _count: { select: { results: true } } } });
    if (!existing) return db.user.update({ where: { id: placeholder.id }, data: linked });
    // вошёл раньше, чем появилась привязка по нику: отдельный пустой аккаунт сливаем в заготовку
    if (existing._count.results === 0) {
      const [, user] = await db.$transaction([
        db.user.delete({ where: { id: existing.id } }),
        db.user.update({ where: { id: placeholder.id }, data: { ...linked, isAdmin: placeholder.isAdmin || existing.isAdmin } }),
      ]);
      return user;
    }
  }

  // имя задаётся при первом входе, дальше его может поменять админ — не перетираем
  return db.user.upsert({
    where: { telegramId: p.telegramId },
    // супер-админ — болельщик, выбирать роль ему не нужно
    create: { telegramId: p.telegramId, name: p.name, username: p.username, avatarUrl, role: superAdmin ? "FAN" : undefined },
    update: { username: p.username, avatarUrl },
  });
}

export function isSuperAdmin(user: { telegramId: bigint; username: string | null }) {
  const ids = config.superAdmins;
  return ids.includes(user.telegramId.toString()) || (!!user.username && ids.includes(user.username.toLowerCase()));
}

/** Админ — назначенный супер-админом пользователь или сам супер-админ. */
export function isAdmin(user: { isAdmin: boolean; telegramId: bigint; username: string | null } | null | undefined) {
  return !!user && (user.isAdmin || isSuperAdmin(user));
}
