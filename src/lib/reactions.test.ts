// Проверка сводки реакций: npm test
import assert from "node:assert/strict";
import { summarize } from "./reactions";

const rows = [{ kind: "FIRE", userId: "a" }, { kind: "FIRE", userId: "b" }, { kind: "POOP", userId: "a" }];
const s = summarize(rows, "b");
assert.deepEqual(s.map((r) => r.kind), ["FIRE", "THUMBS_UP", "THUMBS_DOWN", "CLOWN", "POOP"]);
assert.deepEqual(s[0], { kind: "FIRE", count: 2, mine: true });
assert.deepEqual(s[4], { kind: "POOP", count: 1, mine: false });
assert.equal(summarize(rows, null).some((r) => r.mine), false);
console.log("reactions: ok");
