import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function loadSokoban() {
  const source = await readFile(new URL("lib/sokoban.ts", root), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

test("generated levels keep the nine-by-nine logical border outside the seven-by-seven visual board", async () => {
  const { generateLevels, stateToCells, createInitialState } = await loadSokoban();
  const levels = generateLevels(100);

  assert.equal(levels.length, 100);
  for (const level of levels) {
    assert.equal(level.rows.length, 9);
    assert.ok(level.rows.every((row) => row.length === 9));
    assert.ok(level.rows[0].split("").every((tile) => tile === "#"));
    assert.ok(level.rows[8].split("").every((tile) => tile === "#"));
    assert.ok(level.rows.every((row) => row[0] === "#" && row[8] === "#"));
    for (const point of [level.player, ...level.boxes, ...level.goals]) {
      assert.ok(point.x >= 1 && point.x <= 7);
      assert.ok(point.y >= 1 && point.y <= 7);
    }
    assert.equal(stateToCells(level, createInitialState(level)).slice(1, -1).flatMap((row) => row.slice(1, -1)).length, 49);
  }
});

test("walking and pushing update state without mutating the previous snapshot", async () => {
  const { createInitialState, isSolved, moveState } = await loadSokoban();
  const level = {
    id: 1,
    name: "rule test",
    rows: ["#####", "#...#", "#.#.#", "#...#", "#####"],
    player: { x: 1, y: 1 },
    boxes: [{ x: 2, y: 1 }],
    goals: [{ x: 3, y: 1 }],
    solutionPushes: 1,
    solutionMoves: 1,
    solution: [],
    difficulty: 1,
    layout: "test",
  };
  const initial = createInitialState(level);

  const walked = moveState(level, initial, 0, 1);
  assert.ok(walked);
  assert.deepEqual(walked.player, { x: 1, y: 2 });
  assert.equal(walked.moves, 1);
  assert.equal(walked.pushes, 0);
  assert.deepEqual(initial.player, { x: 1, y: 1 });

  const pushed = moveState(level, initial, 1, 0);
  assert.ok(pushed);
  assert.deepEqual(pushed.player, { x: 2, y: 1 });
  assert.ok(pushed.boxes.has("3,1"));
  assert.equal(pushed.moves, 1);
  assert.equal(pushed.pushes, 1);
  assert.ok(!initial.boxes.has("3,1"));
  assert.equal(isSolved(level, pushed.boxes), true);
  assert.equal(moveState(level, pushed, 1, 0), null);
});

test("the hundred-level difficulty curve grows through the final chapter", async () => {
  const { generateLevels } = await loadSokoban();
  const levels = generateLevels(100);
  const pushes = levels.map((level) => level.solutionPushes);

  assert.ok(pushes[0] <= 5, "the opening levels should stay beginner-friendly");
  assert.ok(pushes.every((value, index) => index === 0 || value >= pushes[index - 1]));
  assert.ok(levels.every((level) => level.difficulty >= 1 && level.difficulty <= 5));
  assert.ok(pushes[99] >= 57, "the final chapter should require substantially more pushes");
  assert.ok(levels.slice(90).every((level) => level.difficulty >= 4));
  assert.ok(pushes[9] <= pushes[10]);
  assert.ok(pushes[19] <= pushes[20]);
  assert.ok(pushes[29] <= pushes[30]);
  assert.ok(pushes[39] <= pushes[40]);
  assert.ok(pushes[49] <= pushes[50]);
  assert.ok(pushes[59] <= pushes[60]);
  assert.ok(pushes[69] <= pushes[70]);
  assert.ok(pushes[79] <= pushes[80]);
  assert.ok(pushes[89] <= pushes[90]);
});

test("star ratings compare both pushes and moves against the level par", async () => {
  const { calculateStars } = await loadSokoban();
  const level = { solutionPushes: 10, solutionMoves: 20 };

  assert.equal(calculateStars(level, 10, 25), 3);
  assert.equal(calculateStars(level, 12, 33), 2);
  assert.equal(calculateStars(level, 13, 25), 1);
  assert.equal(calculateStars(level, 10, 34), 1);
});
