import type { ChallengeStatus } from "@prisma/client";

/** Статусы оплаченных челленджей: их видят участник и все остальные. */
export const PUBLIC_CHALLENGE_STATUSES: ChallengeStatus[] = ["PENDING", "ACCEPTED", "DECLINED", "COMPLETION_REVIEW", "COMPLETED", "FAILED"];

type Settleable = { status: ChallengeStatus; paidAt: Date | null; settledAt: Date | null; reward: number };

/** Кому хранитель должен перевести вознаграждение: участнику, автору или никому. */
export function payoutTo(c: Settleable): "target" | "author" | null {
  if (!c.paidAt || c.settledAt || c.reward <= 0) return null;
  if (c.status === "COMPLETED") return "target";
  if (c.status === "DECLINED" || c.status === "FAILED" || c.status === "CANCELLED") return "author";
  return null;
}
