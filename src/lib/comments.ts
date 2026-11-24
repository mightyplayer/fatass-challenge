/** Плоский комментарий к посту, как он приходит из базы. */
export type FlatComment = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: Date;
  deletedAt: Date | null;
  author: { id: string; name: string; avatarUrl: string | null };
};

export type CommentNode = FlatComment & { replies: CommentNode[]; total: number };

/** Собирает дерево: ветки по времени, старые сверху. total — живые комментарии в ветке, включая сам. */
export function buildTree(flat: FlatComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const c of [...flat].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    nodes.set(c.id, { ...c, replies: [], total: 0 });
  }
  const roots: CommentNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    (parent ? parent.replies : roots).push(n);
  }
  const count = (n: CommentNode): number => (n.total = (n.deletedAt ? 0 : 1) + n.replies.reduce((s, r) => s + count(r), 0));
  roots.forEach(count);
  return roots;
}

/** Сколько комментариев показывать в счётчике: удалённые не считаются. */
export const visibleCount = (flat: { deletedAt: Date | null }[]) => flat.filter((c) => !c.deletedAt).length;
