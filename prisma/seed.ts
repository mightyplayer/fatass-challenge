// Демо-данные для локальной разработки: npm run db:seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const plan = [
  { start: 90, waist: 96, drops: [0.4, 0.6, 0.3, 0.5] },
  { start: 98, waist: 104, drops: [0.7, 0.4, 0.8, 0.5] },
  { start: 83, waist: 89, drops: [0.3, 0.5, 0.4, 0.6] },
  { start: 107, waist: 111, drops: [0.9, 0.6, 0.8, 0.7] },
  { start: 94, waist: 99, drops: [0.5, 0.7, 0.4, 0.3] },
];

async function main() {
  const fans = await Promise.all(
    ["Болельщик 1", "Болельщик 2"].map((name, i) =>
      db.user.upsert({ where: { telegramId: BigInt(-900 - i) }, update: {}, create: { telegramId: BigInt(-900 - i), name, role: "FAN" } }),
    ),
  );
  const participants = await Promise.all(
    plan.map((_, i) => {
      const id = `demo-participant-${i + 1}`;
      return db.user.upsert({
        where: { id },
        update: {},
        create: { id, telegramId: BigInt(-1 - i), name: `Участник ${i + 1}`, role: "PARTICIPANT" },
      });
    }),
  );
  for (const [i, p] of plan.entries()) {
    const { id } = participants[i];
    let w = p.start;
    await db.weeklyResult.upsert({
      where: { participantId_week: { participantId: id, week: 0 } },
      update: {},
      create: { participantId: id, week: 0, weight: w, waistCm: p.waist },
    });
    for (const [k, drop] of p.drops.entries()) {
      w = Math.round((w - drop) * 10) / 10;
      await db.weeklyResult.upsert({
        where: { participantId_week: { participantId: id, week: k + 1 } },
        update: {},
        create: {
          participantId: id,
          week: k + 1,
          weight: w,
          stepsDays: (k + i) % 6,
          cardioDays: (k * 2 + i) % 4,
          strengthSessions: (k + 2 * i) % 4,
          penalty: k === 2 && i === 2 ? 2 : 0,
        },
      });
    }
    await db.donation.create({
      data: { fromId: fans[i % 2].id, toId: id, amount: 300 * (i + 1), message: "Вперёд!", status: "CONFIRMED", reviewedAt: new Date() },
    });
  }
  await db.challenge.create({ data: { authorId: fans[0].id, targetId: participants[0].id, title: "10 000 шагов каждый день", description: "Скрин шагомера в пост" } });
  await db.post.create({ data: { authorId: participants[0].id, text: "Первая неделя позади, держусь без сладкого 💪" } });
}

main().finally(() => db.$disconnect());
