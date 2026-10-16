import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/sokoban.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { generateLevels, regenerateLevels } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
let levels;
const generationStarted = performance.now();
try {
  levels = process.argv.includes("--regenerate")
    ? regenerateLevels(100, (level, salt) => console.error(`selected level=${level} salt=${salt}`))
    : generateLevels(100);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const generationMs = performance.now() - generationStarted;

function transforms(rows) {
  const grid = rows.map((row) => [...row]);
  const size = grid.length;
  const at = (x, y, mode) => {
    switch (mode) {
      case 1: return grid[size - 1 - x][y];
      case 2: return grid[size - 1 - y][size - 1 - x];
      case 3: return grid[x][size - 1 - y];
      case 4: return grid[y][size - 1 - x];
      case 5: return grid[size - 1 - y][x];
      case 6: return grid[x][y];
      default: return grid[size - 1 - x][size - 1 - y];
    }
  };
  return Array.from({ length: 8 }, (_, mode) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => at(x, y, mode)).join(""),
    ).join("/"),
  );
}

function direction(step) {
  if (step.dx === 1) return "R";
  if (step.dx === -1) return "L";
  if (step.dy === 1) return "D";
  return "U";
}

function canonicalSolution(level) {
  const variants = Array.from({ length: 8 }, (_, mode) => level.solution.map(({ dx, dy }) => {
    const [x, y] = [
      [dx, dy], [-dy, dx], [-dx, -dy], [dy, -dx],
      [-dx, dy], [dx, -dy], [dy, dx], [-dy, -dx],
    ][mode];
    return direction({ dx: x, dy: y });
  }).join(""));
  return variants.sort()[0];
}

function movedBoxCount(level) {
  const boxes = new Map(level.boxes.map((point, index) => [`${point.x},${point.y}`, index]));
  const moved = new Set();
  for (const step of level.solution) {
    const from = `${step.from.x},${step.from.y}`;
    const id = boxes.get(from);
    if (id === undefined) throw new Error(`Broken solution identity at level ${level.id}`);
    boxes.delete(from);
    boxes.set(`${step.from.x + step.dx},${step.from.y + step.dy}`, id);
    moved.add(id);
  }
  return moved.size;
}

const roomSignatures = levels.map((level) => level.rows.join("/"));
const canonicalRooms = levels.map((level) => transforms(level.rows).sort()[0]);
const solutions = levels.map((level) => level.solution.map(direction).join(""));
const canonicalSolutions = levels.map(canonicalSolution);
const runProfiles = solutions.map((solution) => solution.replace(/(.)\1+/g, (run) => `${run[0]}${Math.min(run.length, 4)}`));
const wallMasks = levels.map((level) => level.rows.slice(1, -1).join("").split("").map((tile) => tile === "#" ? 1 : 0));
const nearestDistances = wallMasks.map((mask, index) => Math.min(
  ...wallMasks.filter((_, other) => other !== index).map((other) =>
    mask.reduce((distance, value, cell) => distance + (value === other[cell] ? 0 : 1), 0),
  ),
));
const rotationalNearestDistances = levels.map((level, index) => Math.min(
  ...levels.filter((_, other) => other !== index).map((other) => {
    const target = other.rows.join("/");
    return Math.min(...transforms(level.rows).map((variant) =>
      [...variant].reduce((distance, value, cell) => distance + (value === target[cell] ? 0 : 1), 0),
    ));
  }),
));
const boxDistribution = Object.fromEntries([...new Set(levels.map((level) => level.boxes.length))]
  .sort().map((count) => [count, levels.filter((level) => level.boxes.length === count).length]));

const result = {
  levels: levels.length,
  generationMs: Number(generationMs.toFixed(1)),
  exactRoomTopologies: new Set(roomSignatures).size,
  topologiesIgnoringRotationAndReflection: new Set(canonicalRooms).size,
  exactPushDirectionSequences: new Set(solutions).size,
  pushSequencesIgnoringRotationAndReflection: new Set(canonicalSolutions).size,
  runLengthPushProfiles: new Set(runProfiles).size,
  minimumNearestWallDifference: Math.min(...nearestDistances),
  averageNearestWallDifference: Number((nearestDistances.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)),
  minimumRotationalWallDifference: Math.min(...rotationalNearestDistances),
  averageRotationalWallDifference: Number((rotationalNearestDistances.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)),
  levelsUsingAtLeastThreePushDirections: levels.filter((level) => new Set(level.solution.map(direction)).size >= 3).length,
  levelsMovingEveryBox: levels.filter((level) => movedBoxCount(level) === level.boxes.length).length,
  boxDistribution,
  ...(process.argv.includes("--regenerate") ? { generationSalts: levels.map((level) => level.generationSalt ?? 0) } : {}),
};

assert.equal(result.exactRoomTopologies, 100, "Each level needs its own room topology");
assert.equal(result.topologiesIgnoringRotationAndReflection, 100, "Rotated or mirrored rooms must not be duplicates");
assert.equal(result.exactPushDirectionSequences, 100, "Push sequences must be distinct");
assert.equal(result.pushSequencesIgnoringRotationAndReflection, 100, "Rotated or mirrored push sequences must be distinct");
assert.ok(result.minimumRotationalWallDifference >= 3, "Any two room topologies must differ by at least three cells");
assert.ok(result.levelsUsingAtLeastThreePushDirections >= 95, "Almost every level should require multi-directional play");
assert.equal(result.levelsMovingEveryBox, 100, "Every solution must involve every box");
assert.ok((result.boxDistribution[5] ?? 0) >= 10, "Late chapters should include five-box levels");

console.log(JSON.stringify(result, null, 2));
