// Проверка правил подсчёта: npm test
import assert from "node:assert/strict";
import { activityPoints, betPoints, scoreWeeks, waistBonus, weightPoints } from "./scoring";
assert.equal(weightPoints(100, 99.8), 0);   // 0.2%
assert.equal(weightPoints(100, 99.7), 3);   // 0.3%
assert.equal(weightPoints(100, 99.45), 3);  // 0.55%
assert.equal(weightPoints(100, 99.4), 6);   // 0.6%
assert.equal(weightPoints(100, 99.1), 9);   // 0.9%
assert.equal(weightPoints(100, 98.8), 12);  // 1.2%
assert.equal(weightPoints(100, 101), 0);    // набрал
assert.equal(activityPoints(5), 3); assert.equal(activityPoints(2), 2); assert.equal(activityPoints(-1), 0);
assert.equal(waistBonus(100, 99.5), 0); assert.equal(waistBonus(100, 98), 2); assert.equal(waistBonus(100, 96), 4);
assert.equal(waistBonus(100, 94), 6); assert.equal(waistBonus(100, 92), 8); assert.equal(waistBonus(100, 90), 10); assert.equal(waistBonus(null, 90), 0);
assert.equal(betPoints(80, 81), 3); assert.equal(betPoints(80, 81.5), 2); assert.equal(betPoints(80, 83), 1); assert.equal(betPoints(80, 83.1), 0);
assert.equal(betPoints(80.3, 81.3), 3);
const s = scoreWeeks([
  { week: 0, weight: 100, waistCm: 100, stepsDays: 0, cardioDays: 0, strengthSessions: 0, penalty: 0 },
  { week: 1, weight: 99, waistCm: null, stepsDays: 7, cardioDays: 2, strengthSessions: 3, penalty: 1 },
  { week: 3, weight: 98.5, waistCm: null, stepsDays: 1, cardioDays: 0, strengthSessions: 0, penalty: 0 },
  { week: 12, weight: 90, waistCm: 92, stepsDays: 0, cardioDays: 0, strengthSessions: 0, penalty: 0 },
], 11);
assert.deepEqual(s.map((w) => [w.week, w.weightPts, w.total]), [[1, 9, 9 + 3 + 2 + 3 - 1], [3, 3, 3 + 1]]);
console.log("scoring ok");
