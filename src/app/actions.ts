"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireFan, requireParticipant, requireSuperAdmin, requireUser, safeNext } from "@/lib/session";
import { getFund, saveFund } from "@/lib/fund";
import { payoutTo } from "@/lib/challenges";
import { REACTIONS, type ReactionKind } from "@/lib/reactions";
import { saveImage } from "@/lib/storage";
import { isAdmin, isSuperAdmin, normalizeUsername } from "@/lib/users";
import { currentWeek, finalWeek, predictionsRevealed } from "@/lib/week";
import { parseLocalDate } from "@/lib/time";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

const toNum = (v: unknown) => (v === "" || v == null ? undefined : Number(String(v).replace(",", ".")));
const num = (min: number, max: number) => z.preprocess(toNum, z.number().min(min).max(max));
const optNum = (min: number, max: number) => z.preprocess(toNum, z.number().min(min).max(max).optional());
const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

/** Сумма из кнопок или своя: своя идёт в форме последней и важнее. */
const lastAmount = (form: FormData, name: string) =>
  form
    .getAll(name)
    .map((v) => String(v).trim())
    .filter(Boolean)
    .pop();

/** Хранитель призового фонда: принимает переводы болельщиков и выплачивает их. */
async function requireKeeper() {
  const admin = await requireAdmin();
  const fund = await getFund();
  if (fund.keeperId !== admin.id) throw new Error("Это делает хранитель фонда");
  return admin;
}

/** Оборачивает действие: ошибки валидации и доступа превращаются в сообщение для формы. */
async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    if (e instanceof Error && !("digest" in e)) return { error: e.message };
    throw e;
  }
}

// ---------- Онбординг и профиль ----------

const phone = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 15, "Телефон: от 10 до 15 цифр")
    .optional(),
);


const goalFields = z.object({
  goalWeight: optNum(30, 350),
  heightCm: optNum(100, 250),
  motto: optStr(140),
});

export async function chooseRole(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser({ allowPending: true });
  const role = form.get("role");
  if (role === "FAN") {
    await db.user.update({ where: { id: user.id }, data: { role: "FAN" } });
  } else if (role === "PARTICIPANT") {
    const r = goalFields.safeParse(Object.fromEntries(form));
    if (!r.success) return { error: "Проверь цель и рост: нужны числа" };
    await db.user.update({
      where: { id: user.id },
      data: { role: "PARTICIPANT", ...r.data, heightCm: r.data.heightCm ? Math.round(r.data.heightCm) : null },
    });
  } else {
    return { error: "Выбери роль" };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")?.toString()));
}

const requisites = z.object({ sbpPhone: phone, sbpBank: optStr(60) });

/** Участник указывает свои реквизиты для донатов. */
export async function updateRequisites(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireParticipant();
    const data = requisites.parse(Object.fromEntries(form));
    await db.user.update({ where: { id: user.id }, data: { sbpPhone: data.sbpPhone ?? null, sbpBank: data.sbpBank ?? null } });
    return "Сохранено";
  });
}

/** Админ указывает реквизиты для донатов любому участнику. */
export async function adminUpdateRequisites(_: ActionState, form: FormData) {
  return run(async () => {
    await requireAdmin();
    const userId = z.string().min(1).parse(form.get("userId"));
    const data = requisites.parse(Object.fromEntries(form));
    const p = await db.user.findUnique({ where: { id: userId } });
    if (p?.role !== "PARTICIPANT") throw new Error("Это не участник соревнования");
    await db.user.update({ where: { id: p.id }, data: { sbpPhone: data.sbpPhone ?? null, sbpBank: data.sbpBank ?? null } });
    return "Сохранено";
  });
}

/** Участник правит свою цель, рост и девиз. Стартовый вес и результаты вносит админ. */
export async function updateProfile(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireParticipant();
    const data = goalFields.parse(Object.fromEntries(form));
    await db.user.update({
      where: { id: user.id },
      data: {
        goalWeight: data.goalWeight ?? null,
        heightCm: data.heightCm ? Math.round(data.heightCm) : null,
        motto: data.motto ?? null,
      },
    });
    return "Профиль обновлён";
  });
}

// ---------- Админка ----------

const count = z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(7));

/** Админ вносит или правит результат участника за неделю (0 — старт, последняя — финал). */
export async function submitResult(_: ActionState, form: FormData) {
  return run(async () => {
    const admin = await requireAdmin();
    const data = z
      .object({
        participantId: z.string().min(1),
        week: num(0, finalWeek()),
        weight: num(30, 350),
        waistCm: optNum(40, 250),
        stepsDays: count,
        cardioDays: count,
        strengthSessions: count,
        penalty: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(100)),
        note: optStr(1000),
      })
      .parse(Object.fromEntries(form));
    const participant = await db.user.findUnique({ where: { id: data.participantId } });
    if (participant?.role !== "PARTICIPANT") throw new Error("Это не участник соревнования");
    const week = Math.round(data.week);
    const fields = {
      weight: data.weight,
      waistCm: data.waistCm ?? null,
      stepsDays: data.stepsDays,
      cardioDays: data.cardioDays,
      strengthSessions: data.strengthSessions,
      penalty: data.penalty,
      note: data.note ?? null,
      enteredById: admin.id,
    };
    await db.weeklyResult.upsert({
      where: { participantId_week: { participantId: participant.id, week } },
      create: { participantId: participant.id, week, ...fields },
      update: fields,
    });
    return `${participant.name}: сохранено`;
  });
}

export async function deleteResult(resultId: string) {
  return run(async () => {
    await requireAdmin();
    await db.weeklyResult.delete({ where: { id: resultId } });
  });
}

/**
 * Привязать вошедший через Telegram аккаунт к заранее заведённому участнику.
 * Заготовка получает telegramId, @username и аватар, временный аккаунт удаляется.
 */
export async function linkToParticipant(userId: string, placeholderId: string) {
  return run(async () => {
    await requireAdmin();
    const [user, placeholder] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.user.findUnique({ where: { id: placeholderId } }),
    ]);
    if (!user || !placeholder) throw new Error("Пользователь не найден");
    if (placeholder.telegramId >= 0) throw new Error("Этот участник уже привязан к Telegram");
    if (user.telegramId < 0) throw new Error("Можно привязать только вошедший через Telegram аккаунт");
    if (await db.weeklyResult.count({ where: { participantId: user.id } }))
      throw new Error("У этого аккаунта уже есть результаты, его нельзя слить с заготовкой");
    await db.$transaction([
      db.user.delete({ where: { id: user.id } }),
      db.user.update({
        where: { id: placeholder.id },
        data: { telegramId: user.telegramId, username: user.username, avatarUrl: user.avatarUrl, isAdmin: placeholder.isAdmin || user.isAdmin },
      }),
    ]);
    return `${user.name} теперь ${placeholder.name}`;
  });
}

export async function renameUser(_: ActionState, form: FormData) {
  return run(async () => {
    await requireAdmin();
    const data = z.object({ userId: z.string().min(1), name: z.string().trim().min(1).max(60) }).parse(Object.fromEntries(form));
    await db.user.update({ where: { id: data.userId }, data: { name: data.name } });
    return "Имя сохранено";
  });
}

/** Telegram-ник заготовки участника: по нему первый вход попадает в эту заготовку. */
export async function setPlaceholderUsername(_: ActionState, form: FormData) {
  return run(async () => {
    await requireAdmin();
    const data = z.object({ userId: z.string().min(1), username: z.string().max(64) }).parse(Object.fromEntries(form));
    const username = normalizeUsername(data.username);
    if (username && !/^[a-z0-9_]{4,32}$/.test(username)) throw new Error("Неверный ник");
    const user = await db.user.findUnique({ where: { id: data.userId } });
    if (!user || user.telegramId >= 0) throw new Error("Это не заготовка");
    if (username && isSuperAdmin({ telegramId: 0n, username })) throw new Error("Это ник супер-админа");
    if (username && (await db.user.findFirst({ where: { id: { not: user.id }, username: { equals: username, mode: "insensitive" } } })))
      throw new Error("Ник уже занят");
    await db.user.update({ where: { id: user.id }, data: { username } });
    return "Ник сохранён";
  });
}

export async function setRole(userId: string, role: "FAN" | "PARTICIPANT") {
  return run(async () => {
    await requireAdmin();
    await db.user.update({ where: { id: userId }, data: { role } });
  });
}

export async function setAdmin(userId: string, value: boolean) {
  return run(async () => {
    await requireSuperAdmin();
    await db.user.update({ where: { id: userId }, data: { isAdmin: value } });
    // снятый админ больше не может быть хранителем фонда
    if (!value && (await getFund()).keeperId === userId) await saveFund({ keeperId: null, sbpPhone: null, sbpBank: null });
  });
}

// ---------- Посты ----------

export async function createPost(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireParticipant();
    const { text } = z.object({ text: z.string().trim().min(1, "Напиши текст").max(4000) }).parse(Object.fromEntries(form));
    const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 6) throw new Error("Не больше 6 картинок в посте");
    const urls: string[] = [];
    for (const f of files) urls.push((await saveImage(f))!);
    await db.post.create({
      data: { authorId: user.id, text, images: { create: urls.map((url, order) => ({ url, order })) } },
    });
    return "Пост опубликован";
  });
}

export async function deletePost(postId: string) {
  return run(async () => {
    const user = await requireUser();
    const post = await db.post.findUnique({ where: { id: postId } });
    if (!post) throw new Error("Пост не найден");
    if (post.authorId !== user.id && !isAdmin(user)) throw new Error("Можно удалять только свои посты");
    await db.post.delete({ where: { id: postId } });
  });
}

// ---------- Комментарии ----------

export async function addComment(postId: string, parentId: string | null, _: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    const { text } = z.object({ text: z.string().trim().min(1, "Напиши текст").max(2000) }).parse(Object.fromEntries(form));
    const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new Error("Пост не найден");
    if (parentId) {
      const parent = await db.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== postId) throw new Error("Комментарий не найден");
      if (parent.deletedAt) throw new Error("Комментарий удалён");
    }
    await db.comment.create({ data: { postId, parentId, authorId: user.id, text } });
  });
}

/** Комментарий с ответами становится «удалён», без ответов удаляется вместе с опустевшими удалёнными предками. */
export async function deleteComment(commentId: string) {
  return run(async () => {
    const user = await requireUser();
    const comment = await db.comment.findUnique({ where: { id: commentId }, include: { _count: { select: { replies: true } } } });
    if (!comment || comment.deletedAt) throw new Error("Комментарий не найден");
    if (comment.authorId !== user.id && !isAdmin(user)) throw new Error("Можно удалять только свои комментарии");
    if (comment._count.replies > 0) {
      await db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), text: "" } });
      return;
    }
    await db.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      let parentId = comment.parentId;
      while (parentId) {
        const parent = await tx.comment.findUnique({ where: { id: parentId }, include: { _count: { select: { replies: true } } } });
        if (!parent?.deletedAt || parent._count.replies > 0) break;
        await tx.comment.delete({ where: { id: parent.id } });
        parentId = parent.parentId;
      }
    });
  });
}

// ---------- Челленджи ----------

/** Болельщик создаёт челлендж с вознаграждением: дальше переводит его хранителю фонда и жмёт «Я перевёл». */
export async function createChallenge(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireFan();
    const fund = await getFund();
    if (!fund.keeperId || !fund.sbpPhone) throw new Error("Реквизиты фонда ещё не заданы");
    const data = z
      .object({
        targetId: z.string().min(1),
        title: z.string().trim().min(3, "Слишком короткое название").max(120),
        description: optStr(1000),
        dueDate: z.preprocess((v) => (v ? parseLocalDate(String(v)) : undefined), z.date().optional()),
        reward: num(1, 1_000_000),
      })
      .parse({ ...Object.fromEntries(form), reward: lastAmount(form, "reward") });
    const target = await db.user.findUnique({ where: { id: data.targetId } });
    if (target?.role !== "PARTICIPANT") throw new Error("Челлендж можно бросить только участнику");
    await db.challenge.create({ data: { ...data, reward: Math.round(data.reward), status: "AWAITING_PAYMENT", authorId: user.id } });
  });
}

export async function markChallengeTransferred(challengeId: string) {
  return run(async () => {
    const user = await requireFan();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c || c.authorId !== user.id) throw new Error("Челлендж не найден");
    if (c.status !== "AWAITING_PAYMENT") throw new Error("Этот челлендж уже отмечен");
    await db.challenge.update({ where: { id: c.id }, data: { status: "PAYMENT_REVIEW", transferredAt: new Date() } });
  });
}

/**
 * Автор удаляет челлендж, пока участник не ответил. Без подтверждённой оплаты челлендж удаляется,
 * с оплатой — отменяется, и хранитель возвращает вознаграждение автору.
 */
export async function deleteChallenge(challengeId: string) {
  return run(async () => {
    const user = await requireFan();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c || c.authorId !== user.id) throw new Error("Челлендж не найден");
    if (!["AWAITING_PAYMENT", "PAYMENT_REJECTED", "PENDING"].includes(c.status)) throw new Error("Удалить можно только челлендж без ответа участника");
    if (c.paidAt) await db.challenge.update({ where: { id: c.id }, data: { status: "CANCELLED" } });
    else await db.challenge.delete({ where: { id: c.id } });
  });
}

/** Хранитель фонда подтверждает, что вознаграждение пришло: челлендж уходит участнику. */
export async function reviewChallengePayment(challengeId: string, decision: "CONFIRMED" | "REJECTED") {
  return run(async () => {
    const admin = await requireKeeper();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new Error("Челлендж не найден");
    if (c.status !== "PAYMENT_REVIEW" && c.status !== "AWAITING_PAYMENT") throw new Error("Оплата уже проверена");
    await db.challenge.update({
      where: { id: c.id },
      data: decision === "CONFIRMED" ? { status: "PENDING", paidAt: new Date(), paidById: admin.id } : { status: "PAYMENT_REJECTED", paidById: admin.id },
    });
  });
}

export async function respondChallenge(challengeId: string, decision: "ACCEPTED" | "DECLINED") {
  return run(async () => {
    const user = await requireParticipant();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c || c.targetId !== user.id) throw new Error("Челлендж не найден");
    if (c.status !== "PENDING") throw new Error("На этот челлендж уже ответили");
    await db.challenge.update({ where: { id: c.id }, data: { status: decision, respondedAt: new Date() } });
  });
}

/** Участник отмечает выполнение (дальше проверяет админ) или признаёт, что не получилось. */
export async function finishChallenge(challengeId: string, outcome: "COMPLETED" | "FAILED") {
  return run(async () => {
    const user = await requireParticipant();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c || c.targetId !== user.id) throw new Error("Челлендж не найден");
    if (c.status !== "ACCEPTED") throw new Error("Завершить можно только принятый челлендж");
    await db.challenge.update({ where: { id: c.id }, data: { status: outcome === "COMPLETED" ? "COMPLETION_REVIEW" : "FAILED" } });
  });
}

/** Админ подтверждает выполнение челленджа. Свой челлендж админ-участник не проверяет. */
export async function reviewChallengeCompletion(challengeId: string, outcome: "COMPLETED" | "FAILED") {
  return run(async () => {
    const admin = await requireAdmin();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c) throw new Error("Челлендж не найден");
    if (c.targetId === admin.id) throw new Error("Свой челлендж проверяет другой админ");
    if (c.status !== "COMPLETION_REVIEW") throw new Error("Выполнение уже проверено");
    await db.challenge.update({ where: { id: c.id }, data: { status: outcome, reviewedById: admin.id } });
  });
}

/** Хранитель отмечает, что перевёл вознаграждение участнику или вернул автору. */
export async function settleChallenge(challengeId: string) {
  return run(async () => {
    const admin = await requireKeeper();
    const c = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!c || !payoutTo(c)) throw new Error("Переводить по этому челленджу нечего");
    await db.challenge.update({ where: { id: c.id }, data: { settledAt: new Date(), settledById: admin.id } });
  });
}

// ---------- Поддержка болельщиков ----------

/** Болельщик создаёт донат: дальше переводит деньги по реквизитам участника и жмёт «Я перевёл». */
export async function donate(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireFan();
    const data = z
      .object({ toId: z.string().min(1), amount: num(1, 1_000_000), message: optStr(300) })
      .parse(Object.fromEntries(form));
    const to = await db.user.findUnique({ where: { id: data.toId } });
    if (to?.role !== "PARTICIPANT") throw new Error("Донатить можно только участникам");
    if (!to.sbpPhone && !to.paymentDetails) throw new Error("Участник ещё не указал реквизиты для перевода");
    await db.donation.create({ data: { fromId: user.id, toId: to.id, amount: Math.round(data.amount), message: data.message } });
    return "Переведи деньги по реквизитам ниже и нажми «Я перевёл»";
  });
}

export async function markTransferred(donationId: string) {
  return run(async () => {
    const user = await requireFan();
    const d = await db.donation.findUnique({ where: { id: donationId } });
    if (!d || d.fromId !== user.id) throw new Error("Донат не найден");
    if (d.status !== "AWAITING_TRANSFER") throw new Error("Этот донат уже отмечен");
    await db.donation.update({ where: { id: d.id }, data: { status: "PENDING_REVIEW", transferredAt: new Date() } });
    return "Отправлено на проверку админу";
  });
}

export async function cancelDonation(donationId: string) {
  return run(async () => {
    const user = await requireFan();
    const d = await db.donation.findUnique({ where: { id: donationId } });
    if (!d || d.fromId !== user.id) throw new Error("Донат не найден");
    if (d.status !== "AWAITING_TRANSFER") throw new Error("Отменить можно только непереведённый донат");
    await db.donation.update({ where: { id: d.id }, data: { status: "CANCELLED" } });
  });
}

/** Админ подтверждает, что перевод пришёл, или отклоняет донат. */
export async function reviewDonation(donationId: string, decision: "CONFIRMED" | "REJECTED") {
  return run(async () => {
    const admin = await requireAdmin();
    const d = await db.donation.findUnique({ where: { id: donationId } });
    if (!d) throw new Error("Донат не найден");
    if (d.status !== "PENDING_REVIEW" && d.status !== "AWAITING_TRANSFER") throw new Error("Донат уже проверен");
    await db.donation.update({ where: { id: d.id }, data: { status: decision, reviewedById: admin.id, reviewedAt: new Date() } });
  });
}

// ---------- Призовой фонд ----------

/** Супер-админ задаёт базовую сумму фонда и хранителя — одного из админов. */
export async function saveFundSettings(_: ActionState, form: FormData) {
  return run(async () => {
    await requireSuperAdmin();
    const data = z.object({ baseAmount: optNum(0, 100_000_000), keeperId: optStr(40) }).parse(Object.fromEntries(form));
    const fund = await getFund();
    const keeperId = data.keeperId ?? null;
    if (keeperId && keeperId !== fund.keeperId) {
      const keeper = await db.user.findUnique({ where: { id: keeperId } });
      if (!keeper || !isAdmin(keeper)) throw new Error("Хранителем можно назначить только админа");
    }
    // реквизиты принадлежат хранителю: сменился хранитель — новый указывает свои
    const reset = keeperId !== fund.keeperId ? { sbpPhone: null, sbpBank: null } : {};
    await saveFund({ baseAmount: Math.round(data.baseAmount ?? 0), keeperId, ...reset });
    return "Сохранено";
  });
}

/** Хранитель (или супер-админ за него) указывает телефон и банк хранителя для переводов по СБП. */
export async function saveFundRequisites(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireAdmin();
    const fund = await getFund();
    if (!fund.keeperId) throw new Error("Сначала назначь хранителя фонда");
    if (fund.keeperId !== user.id && !isSuperAdmin(user)) throw new Error("Реквизиты указывает хранитель фонда или супер-админ");
    const data = z.object({ sbpPhone: phone, sbpBank: optStr(60) }).parse(Object.fromEntries(form));
    await saveFund({ sbpPhone: data.sbpPhone ?? null, sbpBank: data.sbpBank ?? null });
    return "Сохранено";
  });
}

/** Болельщик создаёт взнос в фонд: дальше переводит хранителю по СБП и жмёт «Я перевёл». */
export async function contributeToFund(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireFan();
    const fund = await getFund();
    if (!fund.keeperId || !fund.sbpPhone) throw new Error("Реквизиты фонда ещё не заданы");
    const data = z.object({ amount: num(1, 1_000_000), message: optStr(300) }).parse({ amount: lastAmount(form, "amount"), message: form.get("message") });
    await db.fundContribution.create({ data: { fromId: user.id, amount: Math.round(data.amount), message: data.message } });
  });
}

export async function markFundTransferred(contributionId: string) {
  return run(async () => {
    const user = await requireFan();
    const c = await db.fundContribution.findUnique({ where: { id: contributionId } });
    if (!c || c.fromId !== user.id) throw new Error("Взнос не найден");
    if (c.status !== "AWAITING_TRANSFER") throw new Error("Этот взнос уже отмечен");
    await db.fundContribution.update({ where: { id: c.id }, data: { status: "PENDING_REVIEW", transferredAt: new Date() } });
  });
}

export async function cancelFundContribution(contributionId: string) {
  return run(async () => {
    const user = await requireFan();
    const c = await db.fundContribution.findUnique({ where: { id: contributionId } });
    if (!c || c.fromId !== user.id) throw new Error("Взнос не найден");
    if (c.status !== "AWAITING_TRANSFER") throw new Error("Отменить можно только непереведённый взнос");
    await db.fundContribution.update({ where: { id: c.id }, data: { status: "CANCELLED" } });
  });
}

/** Хранитель фонда подтверждает, что перевод пришёл, или отклоняет взнос. */
export async function reviewFundContribution(contributionId: string, decision: "CONFIRMED" | "REJECTED") {
  return run(async () => {
    const admin = await requireAdmin();
    const fund = await getFund();
    if (fund.keeperId !== admin.id) throw new Error("Взносы подтверждает хранитель фонда");
    const c = await db.fundContribution.findUnique({ where: { id: contributionId } });
    if (!c) throw new Error("Взнос не найден");
    if (c.status !== "PENDING_REVIEW" && c.status !== "AWAITING_TRANSFER") throw new Error("Взнос уже проверен");
    await db.fundContribution.update({ where: { id: c.id }, data: { status: decision, reviewedById: admin.id, reviewedAt: new Date() } });
  });
}

// ---------- Ставки на финальный вес ----------

/** Участник ставит на финальный вес других участников. Менять можно до финала. */
export async function savePredictions(_: ActionState, form: FormData) {
  return run(async () => {
    const user = await requireParticipant();
    if (predictionsRevealed()) throw new Error("Ставки закрыты: финал уже наступил");
    const others = await db.user.findMany({ where: { role: "PARTICIPANT", id: { not: user.id } }, select: { id: true } });
    const ops = [];
    for (const o of others) {
      const raw = form.get(`p_${o.id}`);
      const value = raw === null || String(raw).trim() === "" ? null : Number(String(raw).replace(",", "."));
      if (value === null) {
        ops.push(db.prediction.deleteMany({ where: { authorId: user.id, targetId: o.id } }));
      } else {
        if (!Number.isFinite(value) || value < 30 || value > 350) throw new Error("Вес в ставке должен быть от 30 до 350 кг");
        ops.push(
          db.prediction.upsert({
            where: { authorId_targetId: { authorId: user.id, targetId: o.id } },
            create: { authorId: user.id, targetId: o.id, weight: value },
            update: { weight: value },
          }),
        );
      }
    }
    await db.$transaction(ops);
    return "Ставки сохранены. До финала их видишь только ты";
  });
}

export async function toggleFavorite(participantId: string) {
  return run(async () => {
    const user = await requireFan();
    const target = await db.user.findUnique({ where: { id: participantId } });
    if (target?.role !== "PARTICIPANT") throw new Error("Голосовать можно только за участника");
    const existing = await db.vote.findUnique({ where: { fanId: user.id } });
    if (existing?.participantId === participantId) await db.vote.delete({ where: { id: existing.id } });
    else
      await db.vote.upsert({
        where: { fanId: user.id },
        create: { fanId: user.id, participantId },
        update: { participantId, createdAt: new Date() },
      });
  });
}

export async function togglePostReaction(postId: string, kind: ReactionKind) {
  return run(async () => {
    const user = await requireUser();
    const k = z.enum(REACTIONS.map((r) => r.kind) as [ReactionKind, ...ReactionKind[]]).parse(kind);
    const where = { userId_postId_kind: { userId: user.id, postId, kind: k } };
    if (await db.postReaction.findUnique({ where })) await db.postReaction.delete({ where });
    else await db.postReaction.create({ data: { userId: user.id, postId, kind: k } });
  });
}

export async function toggleLike(kind: "post" | "result" | "challenge", id: string) {
  return run(async () => {
    const user = await requireUser();
    const field = ({ post: "postId", result: "resultId", challenge: "challengeId" } as const)[kind];
    if (!field) throw new Error("Неизвестный тип");
    const existing = await db.like.findFirst({ where: { userId: user.id, [field]: id } });
    if (existing) await db.like.delete({ where: { id: existing.id } });
    else await db.like.create({ data: { userId: user.id, [field]: id } });
  });
}
