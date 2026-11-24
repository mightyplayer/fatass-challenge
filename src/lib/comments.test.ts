// Проверка дерева комментариев: npm test
import assert from "node:assert/strict";
import { buildTree, visibleCount, type FlatComment } from "./comments";

const author = { id: "u", name: "U", avatarUrl: null };
const c = (id: string, parentId: string | null, min: number, deleted = false): FlatComment => ({
  id, parentId, text: id, createdAt: new Date(2026, 9, 12, 12, min), deletedAt: deleted ? new Date() : null, author,
});

const tree = buildTree([c("b", null, 5), c("a1", "a", 2), c("a", null, 1), c("a2", "a", 3, true), c("a2x", "a2", 4), c("a1x", "a1", 6)]);
assert.deepEqual(tree.map((n) => n.id), ["a", "b"]);
assert.deepEqual(tree[0].replies.map((n) => n.id), ["a1", "a2"]);
assert.equal(tree[0].replies[0].replies[0].id, "a1x");
assert.equal(tree[0].total, 4); // a, a1, a1x, a2x; удалённый a2 не считается
assert.equal(tree[1].total, 1);
assert.equal(visibleCount([c("x", null, 1), c("y", null, 2, true)]), 1);
// ответ на комментарий, которого нет в выборке, всплывает наверх, а не теряется
assert.deepEqual(buildTree([c("z", "missing", 1)]).map((n) => n.id), ["z"]);
console.log("comments: ok");
