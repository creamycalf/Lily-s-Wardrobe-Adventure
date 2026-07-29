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

type State = {
  player: Point;
  boxes: string;
};

type Template = {
  name: string;
  rows: string[];
};

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

const LEVEL_NAMES = [
  "丝带序章",
  "梳妆侧厅",
  "花架回廊",
  "月光小屋",
  "缎面书房",
  "珍珠花园",
  "星灯走廊",
  "玫瑰工坊",
  "雪糖庭院",
  "王冠夹层",
];

const TEMPLATES: Template[] = [
  {
    name: "atelier",
    rows: [
      "#########",
      "#.......#",
      "#..#....#",
      "#..#..#.#",
      "#.......#",
      "#..###..#",
      "#...#...#",
      "#.......#",
      "#########",
    ],
  },
  {
    name: "gallery",
    rows: [
      "##########",
      "#........#",
      "#.####...#",
      "#....#...#",
      "#....#...#",
      "#...###..#",
      "#........#",
      "#..####..#",
      "#........#",
      "##########",
    ],
  },
  {
    name: "courtyard",
    rows: [
      "#########",
      "#.......#",
      "#.###...#",
      "#...#...#",
      "#...#...#",
      "#...###.#",
      "#.......#",
      "#..#....#",
      "#########",
    ],
  },
  {
    name: "hall",
    rows: [
      "##########",
      "#........#",
      "#..##.#..#",
      "#..##.#..#",
      "#........#",
      "#..####..#",
      "#........#",
      "#..#..#..#",
      "#........#",
      "##########",
    ],
  },
  {
    name: "loop",
    rows: [
      "#########",
      "#.......#",
      "#.#####.#",
      "#.#...#.#",
      "#.#...#.#",
      "#.#...#.#",
      "#.#####.#",
      "#.......#",
      "#########",
    ],
  },
  {
    name: "parlor",
    rows: [
      "##########",
      "#....#...#",
      "#....#...#",
      "#........#",
      "#.##.##..#",
      "#........#",
      "#...#....#",
      "#...#....#",
      "#........#",
      "##########",
    ],
  },
];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, max: number) {
  return Math.floor(rng() * max);
}

function shuffle<T>(items: T[], rng: () => number) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function parseTemplate(template: Template) {
  const rows = template.rows.map((row) => row.split(""));
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const floorCells: Point[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rows[y][x] !== "#") floorCells.push({ x, y });
    }
  }
  return { rows, width, height, floorCells };
}

function mirrorRows(rows: string[]) {
  return rows.map((row) => row.split("").reverse().join(""));
}

function buildTemplate(seed: number) {
  const template = TEMPLATES[seed % TEMPLATES.length];
  const mirrored = seed % 2 === 0 ? template.rows : mirrorRows(template.rows);
  return { name: template.name, rows: mirrored };
}

function deadCorner(rows: string[][], point: Point) {
  const up = rows[point.y - 1]?.[point.x] === "#";
  const down = rows[point.y + 1]?.[point.x] === "#";
  const left = rows[point.y]?.[point.x - 1] === "#";
  const right = rows[point.y]?.[point.x + 1] === "#";
  return (up || down) && (left || right);
}

function stateKey(player: Point, boxes: Set<string>) {
  return `${player.x},${player.y}|${Array.from(boxes).sort().join(";")}`;
}

function normalizePlayer(player: Point, boxes: Set<string>, rows: string[][]) {
  const queue: Point[] = [player];
  const visited = new Set<string>([pointKey(player)]);
  let best = player;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.y < best.y || (current.y === best.y && current.x < best.x)) {
      best = current;
    }

    for (const dir of DIRECTIONS) {
      const next = { x: current.x + dir.dx, y: current.y + dir.dy };
      const row = rows[next.y];
      if (!row) continue;
      if (row[next.x] === "#") continue;
      if (boxes.has(pointKey(next))) continue;
      const key = pointKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return { best, reachable: visited };
}

function solvePushes(rows: string[][], player: Point, boxes: Point[], goals: Point[]) {
  const goalSet = new Set(goals.map(pointKey));
  const startBoxes = new Set(boxes.map(pointKey));
  const start = { player, boxes: startBoxes };
  const queue: Array<{ player: Point; boxes: Set<string>; pushes: number }> = [{ ...start, pushes: 0 }];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const normalized = normalizePlayer(current.player, current.boxes, rows);
    const canonicalPlayer = normalized.best;
    const key = stateKey(canonicalPlayer, current.boxes);
    if (seen.has(key)) continue;
    seen.add(key);

    let solved = true;
    for (const box of current.boxes) {
      if (!goalSet.has(box)) {
        solved = false;
        break;
      }
    }
    if (solved) {
      return { pushes: current.pushes };
    }

    const reachable = normalized.reachable;
    for (const cellKey of reachable) {
      const [sx, sy] = cellKey.split(",").map(Number);
      for (const dir of DIRECTIONS) {
        const boxPos = { x: sx + dir.dx, y: sy + dir.dy };
        const boxKey = pointKey(boxPos);
        if (!current.boxes.has(boxKey)) continue;
        const landing = { x: boxPos.x + dir.dx, y: boxPos.y + dir.dy };
        const landingRow = rows[landing.y];
        if (!landingRow) continue;
        if (landingRow[landing.x] === "#") continue;
        if (current.boxes.has(pointKey(landing))) continue;

        const nextBoxes = new Set(current.boxes);
        nextBoxes.delete(boxKey);
        nextBoxes.add(pointKey(landing));
        queue.push({ player: boxPos, boxes: nextBoxes, pushes: current.pushes + 1 });
      }
    }
  }

  return null;
}

function sampleDistinct<T>(items: T[], count: number, rng: () => number) {
  return shuffle(items, rng).slice(0, count);
}

function buildCandidateLevel(index: number, seed: number) {
  const rng = mulberry32(seed);
  const { rows: templateRows } = buildTemplate(seed);
  const { rows, floorCells } = parseTemplate({ name: "candidate", rows: templateRows });
  const difficultyTier = Math.floor((index - 1) / 10);
  const boxCount = Math.min(4, 2 + Math.floor(index / 18));
  const targetPushes = 4 + difficultyTier * 2;
  const shuffledFloors = shuffle(floorCells, rng);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const goals = sampleDistinct(shuffledFloors, boxCount, rng);
    const goalKeys = new Set(goals.map(pointKey));
    const playerOptions = shuffledFloors.filter((cell) => !goalKeys.has(pointKey(cell)));
    if (playerOptions.length === 0) continue;
    const player = playerOptions[randInt(rng, playerOptions.length)];

    const boxPool = shuffledFloors.filter(
      (cell) =>
        !goalKeys.has(pointKey(cell)) &&
        pointKey(cell) !== pointKey(player) &&
        !deadCorner(rows, cell),
    );
    if (boxPool.length < boxCount) continue;
    const boxes = sampleDistinct(boxPool, boxCount, rng);

    const result = solvePushes(rows, player, boxes, goals);
    if (!result || result.pushes < targetPushes) continue;

    return {
      id: index,
      name: `${LEVEL_NAMES[(index - 1) % LEVEL_NAMES.length]} · ${index}`,
      rows: templateRows,
      player,
      boxes,
      goals,
      solutionPushes: result.pushes,
    } satisfies Level;
  }

  throw new Error(`Could not generate level ${index}`);
}

export function generateLevels(count = 50) {
  const levels: Level[] = [];
  for (let i = 1; i <= count; i += 1) {
    levels.push(buildCandidateLevel(i, 8731 + i * 97));
  }
  return levels;
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

