export const REACTIONS = [
  { kind: "FIRE", emoji: "🔥" },
  { kind: "THUMBS_UP", emoji: "👍" },
  { kind: "THUMBS_DOWN", emoji: "👎" },
  { kind: "CLOWN", emoji: "🤡" },
  { kind: "POOP", emoji: "💩" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];
export type ReactionSummary = { kind: ReactionKind; count: number; mine: boolean };

/** Сводка по посту: сколько каждой реакции и стоит ли она у зрителя. Порядок как в REACTIONS. */
export function summarize(rows: { kind: string; userId: string }[], viewerId: string | null): ReactionSummary[] {
  return REACTIONS.map(({ kind }) => {
    const own = rows.filter((r) => r.kind === kind);
    return { kind, count: own.length, mine: !!viewerId && own.some((r) => r.userId === viewerId) };
  });
}
