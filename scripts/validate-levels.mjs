import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/sokoban.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { generateLevels } = await import(moduleUrl);
const levels = generateLevels(100);

function shortestWalkDistance(start, target, floor, boxes) {
  if (start === target) return 0;
  const visited = new Set([start]);
  const queue = [{ key: start, distance: 0 }];
  while (queue.length) {
    const { key, distance } = queue.shift();
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = `${x + dx},${y + dy}`;
      if (!floor.has(next) || boxes.has(next) || visited.has(next)) continue;
      if (next === target) return distance + 1;
      visited.add(next);
      queue.push({ key: next, distance: distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function replaysSolution(level) {
  const floor = new Set();
  level.rows.forEach((row, y) => row.split("").forEach((tile, x) => tile === "." && floor.add(`${x},${y}`)));
  const goals = new Set(level.goals.map(({ x, y }) => `${x},${y}`));
  const boxes = new Set(level.boxes.map(({ x, y }) => `${x},${y}`));
  let player = `${level.player.x},${level.player.y}`;
  let moves = 0;

  for (const step of level.solution) {
    const from = `${step.from.x},${step.from.y}`;
    const behind = `${step.from.x - step.dx},${step.from.y - step.dy}`;
    const landing = `${step.from.x + step.dx},${step.from.y + step.dy}`;
    const walking = shortestWalkDistance(player, behind, floor, boxes);
    if (!boxes.has(from) || !floor.has(landing) || boxes.has(landing) || !Number.isFinite(walking)) return { solved: false, moves };
    moves += walking + 1;
    boxes.delete(from);
    boxes.add(landing);
    player = from;
  }

  return { solved: boxes.size === goals.size && [...boxes].every((box) => goals.has(box)), moves };
}

assert.equal(levels.length, 100);

const signatures = new Set();
for (const level of levels) {
  assert.equal(level.boxes.length, level.goals.length, `Level ${level.id} has mismatched boxes and goals`);
  assert.ok(level.boxes.length >= 1, `Level ${level.id} has no boxes`);
  assert.ok(level.solutionPushes >= 3, `Level ${level.id} is too short`);

  const floor = new Set();
  level.rows.forEach((row, y) => row.split("").forEach((tile, x) => tile === "." && floor.add(`${x},${y}`)));
  assert.ok(floor.has(`${level.player.x},${level.player.y}`), `Level ${level.id} player is inside a wall`);
  for (const point of [...level.boxes, ...level.goals]) {
    assert.ok(floor.has(`${point.x},${point.y}`), `Level ${level.id} object is inside a wall`);
  }
  assert.equal(level.solution.length, level.solutionPushes, `Level ${level.id} solution length mismatch`);
  const replay = replaysSolution(level);
  assert.ok(replay.solved, `Level ${level.id} has no forward solution`);
  assert.equal(level.solutionMoves, replay.moves, `Level ${level.id} move par mismatch`);
  assert.ok(level.solutionMoves >= level.solutionPushes, `Level ${level.id} has an invalid move par`);
  assert.ok(level.difficulty >= 1 && level.difficulty <= 5, `Level ${level.id} difficulty is outside 1-5`);

  signatures.add(JSON.stringify({
    rows: level.rows,
    boxes: level.boxes,
    goals: level.goals,
  }));
}

assert.equal(signatures.size, 100, "All 100 levels must have unique maps");

const chapterStats = Array.from({ length: 10 }, (_, chapter) => {
  const group = levels.slice(chapter * 10, chapter * 10 + 10);
  return {
    chapter: chapter + 1,
    minBoxes: Math.min(...group.map((level) => level.boxes.length)),
    maxBoxes: Math.max(...group.map((level) => level.boxes.length)),
    averagePushes: group.reduce((total, level) => total + level.solutionPushes, 0) / group.length,
    averageMoves: group.reduce((total, level) => total + level.solutionMoves, 0) / group.length,
    averageDifficulty: group.reduce((total, level) => total + level.difficulty, 0) / group.length,
  };
});

for (let index = 1; index < chapterStats.length; index += 1) {
  assert.ok(chapterStats[index].minBoxes >= chapterStats[index - 1].minBoxes);
  assert.ok(chapterStats[index].averagePushes > chapterStats[index - 1].averagePushes);
}

console.log(JSON.stringify({ levels: levels.length, unique: signatures.size, chapterStats }));
