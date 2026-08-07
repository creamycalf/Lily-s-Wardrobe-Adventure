import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/sokoban.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { generateLevels } = await import(moduleUrl);
const levels = generateLevels(50);

assert.equal(levels.length, 50);

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

  signatures.add(JSON.stringify({
    rows: level.rows,
    boxes: level.boxes,
    goals: level.goals,
  }));
}

assert.equal(signatures.size, 50, "All 50 levels must have unique maps");

const chapterStats = Array.from({ length: 5 }, (_, chapter) => {
  const group = levels.slice(chapter * 10, chapter * 10 + 10);
  return {
    chapter: chapter + 1,
    minBoxes: Math.min(...group.map((level) => level.boxes.length)),
    maxBoxes: Math.max(...group.map((level) => level.boxes.length)),
    averagePushes: group.reduce((total, level) => total + level.solutionPushes, 0) / group.length,
  };
});

for (let index = 1; index < chapterStats.length; index += 1) {
  assert.ok(chapterStats[index].minBoxes >= chapterStats[index - 1].minBoxes);
  assert.ok(chapterStats[index].averagePushes > chapterStats[index - 1].averagePushes);
}

console.log(JSON.stringify({ levels: levels.length, unique: signatures.size, chapterStats }));
