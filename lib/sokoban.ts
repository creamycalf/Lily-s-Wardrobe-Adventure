export type Point = { x: number; y: number };

export type Level = {
  id: number;
  name: string;
  rows: string[];
  player: Point;
  boxes: Point[];
  goals: Point[];
  solutionPushes: number;
};

const CHAPTER_NAMES = [
  "玫瑰门厅",
  "缎带长廊",
  "月光衣帽间",
  "花园工坊",
  "珍珠画室",
  "星灯侧厅",
  "蓝宝石书房",
  "莓果茶室",
  "琥珀露台",
  "王冠终章",
];

type Blueprint = {
  width: number;
  height: number;
  player: Point;
  boxes: Point[];
  goals: Point[];
  obstacles?: Point[];
  solutionPushes: number;
};

const BLUEPRINTS: Blueprint[] = [
  {
    width: 9,
    height: 9,
    player: { x: 2, y: 4 },
    boxes: [
      { x: 3, y: 3 },
      { x: 3, y: 5 },
    ],
    goals: [
      { x: 6, y: 3 },
      { x: 6, y: 5 },
    ],
    obstacles: [
      { x: 4, y: 1 },
      { x: 4, y: 7 },
    ],
    solutionPushes: 6,
  },
  {
    width: 10,
    height: 9,
    player: { x: 2, y: 4 },
    boxes: [
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 3, y: 6 },
    ],
    goals: [
      { x: 7, y: 2 },
      { x: 7, y: 4 },
      { x: 7, y: 6 },
    ],
    obstacles: [
      { x: 5, y: 1 },
      { x: 5, y: 7 },
      { x: 8, y: 4 },
    ],
    solutionPushes: 12,
  },
  {
    width: 10,
    height: 10,
    player: { x: 2, y: 5 },
    boxes: [
      { x: 4, y: 3 },
      { x: 4, y: 5 },
      { x: 4, y: 7 },
    ],
    goals: [
      { x: 7, y: 3 },
      { x: 7, y: 5 },
      { x: 7, y: 7 },
    ],
    obstacles: [
      { x: 2, y: 2 },
      { x: 2, y: 7 },
      { x: 6, y: 1 },
      { x: 6, y: 8 },
    ],
    solutionPushes: 9,
  },
  {
    width: 11,
    height: 9,
    player: { x: 2, y: 4 },
    boxes: [
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 4, y: 6 },
      { x: 6, y: 4 },
    ],
    goals: [
      { x: 8, y: 2 },
      { x: 8, y: 4 },
      { x: 8, y: 6 },
      { x: 7, y: 4 },
    ],
    obstacles: [
      { x: 3, y: 1 },
      { x: 3, y: 7 },
      { x: 6, y: 1 },
      { x: 6, y: 7 },
    ],
    solutionPushes: 13,
  },
  {
    width: 9,
    height: 10,
    player: { x: 2, y: 2 },
    boxes: [
      { x: 3, y: 3 },
      { x: 3, y: 5 },
      { x: 3, y: 7 },
    ],
    goals: [
      { x: 6, y: 3 },
      { x: 6, y: 5 },
      { x: 6, y: 7 },
    ],
    obstacles: [
      { x: 1, y: 6 },
      { x: 7, y: 2 },
      { x: 5, y: 8 },
    ],
    solutionPushes: 9,
  },
];

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function mirrorPoint(point: Point, width: number): Point {
  return { x: width - 1 - point.x, y: point.y };
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function rotateBlueprint(source: Blueprint, index: number): Blueprint {
  if (index % 2 === 0) {
    return {
      ...source,
      player: clonePoint(source.player),
      boxes: source.boxes.map(clonePoint),
      goals: source.goals.map(clonePoint),
      obstacles: source.obstacles?.map(clonePoint),
    };
  }

  return {
    ...source,
    player: mirrorPoint(source.player, source.width),
    boxes: source.boxes.map((point) => mirrorPoint(point, source.width)),
    goals: source.goals.map((point) => mirrorPoint(point, source.width)),
    obstacles: source.obstacles?.map((point) => mirrorPoint(point, source.width)),
  };
}

function blueprintRows(blueprint: Blueprint) {
  const obstacleSet = new Set((blueprint.obstacles ?? []).map(pointKey));
  const rows: string[] = [];

  for (let y = 0; y < blueprint.height; y += 1) {
    let row = "";
    for (let x = 0; x < blueprint.width; x += 1) {
      const border = x === 0 || y === 0 || x === blueprint.width - 1 || y === blueprint.height - 1;
      row += border || obstacleSet.has(`${x},${y}`) ? "#" : ".";
    }
    rows.push(row);
  }

  return rows;
}

function makeLevel(index: number): Level {
  const blueprint = rotateBlueprint(BLUEPRINTS[(index - 1) % BLUEPRINTS.length], index);
  const chapter = CHAPTER_NAMES[Math.floor((index - 1) / 5) % CHAPTER_NAMES.length];
  const variant = ((index - 1) % 5) + 1;

  return {
    id: index,
    name: `${chapter} · ${variant}`,
    rows: blueprintRows(blueprint),
    player: clonePoint(blueprint.player),
    boxes: blueprint.boxes.map(clonePoint),
    goals: blueprint.goals.map(clonePoint),
    solutionPushes: blueprint.solutionPushes,
  };
}

export function generateLevels(count = 50) {
  return Array.from({ length: count }, (_, index) => makeLevel(index + 1));
}

export function isSolved(level: Level, boxes: Set<string>) {
  const goalSet = new Set(level.goals.map(pointKey));
  for (const box of boxes) {
    if (!goalSet.has(box)) return false;
  }
  return true;
}

export function createInitialState(level: Level) {
  return {
    player: { ...level.player },
    boxes: new Set(level.boxes.map(pointKey)),
    pushes: 0,
    moves: 0,
  };
}

export type GameState = ReturnType<typeof createInitialState>;

export function moveState(level: Level, state: GameState, dx: number, dy: number) {
  const rows = level.rows.map((row) => row.split(""));
  const target = { x: state.player.x + dx, y: state.player.y + dy };
  const targetRow = rows[target.y];
  if (!targetRow || targetRow[target.x] === "#") return null;

  const targetKey = pointKey(target);
  if (!state.boxes.has(targetKey)) {
    return {
      player: target,
      boxes: new Set(state.boxes),
      pushes: state.pushes,
      moves: state.moves + 1,
    };
  }

  const landing = { x: target.x + dx, y: target.y + dy };
  const landingRow = rows[landing.y];
  if (!landingRow || landingRow[landing.x] === "#") return null;
  if (state.boxes.has(pointKey(landing))) return null;

  const nextBoxes = new Set(state.boxes);
  nextBoxes.delete(targetKey);
  nextBoxes.add(pointKey(landing));

  return {
    player: target,
    boxes: nextBoxes,
    pushes: state.pushes + 1,
    moves: state.moves + 1,
  };
}

export function stateToCells(level: Level, state: GameState) {
  const boxSet = state.boxes;
  const goalSet = new Set(level.goals.map(pointKey));
  const rows = level.rows.map((row) => row.split(""));

  return rows.map((row, y) =>
    row.map((tile, x) => {
      const cellKey = `${x},${y}`;
      const isWall = tile === "#";
      const isGoal = goalSet.has(cellKey);
      const isBox = boxSet.has(cellKey);
      const isPlayer = state.player.x === x && state.player.y === y;
      return { x, y, isWall, isGoal, isBox, isPlayer };
    }),
  );
}

export function formatProgress(levelIndex: number, total: number) {
  return `${Math.min(levelIndex, total)}/${total}`;
}
