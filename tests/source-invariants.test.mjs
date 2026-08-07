import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the visual board renders only the inner seven-by-seven playfield", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(source, /cells\.slice\(1, -1\)\.flatMap\(\(row\) => row\.slice\(1, -1\)\)/);
  assert.match(source, /gridTemplateColumns: "repeat\(7, minmax\(0, 1fr\)\)"/);
  assert.doesNotMatch(source, /integratedBoardMode = chapterIndex === 0/);
});

test("all five chapters have a committed seven-by-seven scene board", async () => {
  const boards = [
    "public/art-v2/scene-board-agent-test.png",
    "public/art-v3/scene-board-chapter-02.png",
    "public/art-v3/scene-board-chapter-03.png",
    "public/art-v3/scene-board-chapter-04.png",
    "public/art-v3/scene-board-chapter-05.png",
    "public/art-v3/level-map-clean.png",
    "public/art-v3/start-screen-clean.png",
  ];

  await Promise.all(boards.map((board) => access(new URL(board, root))));
});

test("level selection cannot skip ahead of completed progress", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(source, /const isAvailable = index <= completedLevel/);
  assert.match(source, /disabled=\{!isAvailable\}/);
  assert.doesNotMatch(source, /completedLevel >= index \* 10 \|\| levelIndex >= index \* 10/);
});
