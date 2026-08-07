export type Point = { x: number; y: number };

export type Level = {
  id: number;
  name: string;
  rows: string[];
  player: Point;
  boxes: Point[];
  goals: Point[];
  solutionPushes: number;
  difficulty: number;
  layout: string;
};

export type GameState = ReturnType<typeof createInitialState>;

const CHAPTER_NAMES = ["阳光玩具房", "草莓茶会厅", "秘密花园房", "月光魔法阁楼", "皇家衣帽间"];
const LAYOUT_NAMES = ["初见方厅", "双柱回廊", "缎带隔间", "镜像长廊", "四叶中庭", "衣柜凹室", "星光曲径", "双门套间", "花窗转角", "王冠迷宫"];
const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function parseKey(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function addWall(walls: Set<string>, x: number, y: number, width: number, height: number) {
  if (x > 0 && y > 0 && x < width - 1 && y < height - 1) walls.add(`${x},${y}`);
}

function roomWalls(width: number, height: number, layoutIndex: number, chapter: number) {
  const walls = new Set<string>();
  for (let x = 0; x < width; x += 1) {
    walls.add(`${x},0`);
    walls.add(`${x},${height - 1}`);
  }
  for (let y = 0; y < height; y += 1) {
    walls.add(`0,${y}`);
    walls.add(`${width - 1},${y}`);
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const strength = chapter >= 3 ? 1 : 0;

  switch (layoutIndex) {
    case 0:
      addWall(walls, cx, 2, width, height);
      if (chapter > 0) addWall(walls, cx, height - 3, width, height);
      break;
    case 1:
      for (const [x, y] of [[3, 3], [width - 4, 3], [3, height - 4], [width - 4, height - 4]]) addWall(walls, x, y, width, height);
      break;
    case 2:
      for (let y = 2; y < height - 2; y += 1) {
        if (y !== 3 && y !== height - 4) addWall(walls, cx, y, width, height);
      }
      break;
    case 3:
      for (let x = 2; x < width - 2; x += 1) {
        if (x !== 3 && x !== width - 4) addWall(walls, x, cy, width, height);
      }
      break;
    case 4:
      for (let y = 2; y < height - 2; y += 1) if (Math.abs(y - cy) > 1) addWall(walls, cx, y, width, height);
      for (let x = 2; x < width - 2; x += 1) if (Math.abs(x - cx) > 1) addWall(walls, x, cy, width, height);
      break;
    case 5:
      // A broken L-shaped wardrobe wall. The centre openings are important on
      // the fixed board: they leave enough circulation space to get behind a
      // box while still making this layout visually distinct.
      for (let x = 2; x <= Math.min(width - 3, 5 + strength); x += 1) {
        if (x !== cx) addWall(walls, x, 2, width, height);
      }
      for (let y = 2; y <= Math.min(height - 3, 5 + strength); y += 1) {
        if (y !== cy) addWall(walls, 2, y, width, height);
      }
      addWall(walls, width - 3, height - 3, width, height);
      break;
    case 6:
      for (let step = 0; step < Math.min(width, height) - 5; step += 1) {
        if (step % 3 !== 1) addWall(walls, 2 + step, 2 + step, width, height);
      }
      addWall(walls, width - 3, 2, width, height);
      addWall(walls, 2, height - 3, width, height);
      break;
    case 7:
      for (let y = 2; y < height - 2; y += 1) {
        if (y !== cy - 1 && y !== cy + 1) {
          addWall(walls, Math.floor(width / 3), y, width, height);
          addWall(walls, Math.floor((width * 2) / 3), y, width, height);
        }
      }
      break;
    case 8:
      for (let x = 2; x < width - 3; x += 1) if (x !== cx - 1) addWall(walls, x, 3, width, height);
      for (let y = 3; y < height - 2; y += 1) if (y !== cy + 1) addWall(walls, width - 4, y, width, height);
      break;
    default:
      for (let x = 2; x < width - 2; x += 1) {
        if (x !== cx && x !== cx + 1) addWall(walls, x, 2, width, height);
      }
      for (let y = 2; y < height - 2; y += 1) {
        if (y !== cy) addWall(walls, width - 3, y, width, height);
      }
      for (let x = 3; x < width - 3; x += 1) {
        if (x !== cx - 1) addWall(walls, x, height - 3, width, height);
      }
      if (chapter >= 3) addWall(walls, 3, cy, width, height);
  }

  return walls;
}

function largestFloorComponent(width: number, height: number, walls: Set<string>) {
  const remaining = new Set<string>();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (!walls.has(`${x},${y}`)) remaining.add(`${x},${y}`);
    }
  }

  let largest = new Set<string>();
  while (remaining.size) {
    const first = remaining.values().next().value as string;
    const component = new Set<string>();
    const queue = [parseKey(first)];
    remaining.delete(first);
    while (queue.length) {
      const current = queue.shift()!;
      const key = pointKey(current);
      component.add(key);
      for (const direction of DIRECTIONS) {
        const next = { x: current.x + direction.x, y: current.y + direction.y };
        const nextKey = pointKey(next);
        if (remaining.delete(nextKey)) queue.push(next);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function reachableFrom(start: Point, floor: Set<string>, boxes: Set<string>) {
  const startKey = pointKey(start);
  if (!floor.has(startKey) || boxes.has(startKey)) return new Set<string>();
  const visited = new Set([startKey]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = pointKey(next);
      if (floor.has(key) && !boxes.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited;
}

function buildRows(width: number, height: number, floor: Set<string>) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => floor.has(`${x},${y}`) ? "." : "#").join(""),
  );
}

function difficultyFor(index: number) {
  const chapter = Math.floor((index - 1) / 10);
  const stage = (index - 1) % 10;
  const boxBands = [
    stage < 4 ? 1 : 2,
    stage < 6 ? 2 : 3,
    stage < 3 ? 2 : 3,
    stage < 6 ? 3 : 4,
    4,
  ];
  return {
    chapter,
    stage,
    boxes: boxBands[chapter],
    // A fixed seven-by-seven playfield has less routing space than the old
    // variable boards.  Three extra solution pushes per chapter keeps a clear
    // difficulty climb without making the denser room layouts impossible.
    reversePushes: 3 + chapter * 3 + stage,
  };
}

function generateLevel(index: number): Level {
  const settings = difficultyFor(index);
  const layoutIndex = (index - 1) % 10;
  // Every visual chapter uses the same seven-by-seven board mother. The two
  // outer wall rows/columns are logical only, giving one stable 9x9 coordinate
  // system for all 50 levels and all composited scene backgrounds.
  const width = 9;
  const height = 9;

  for (let attempt = 0; attempt < 900; attempt += 1) {
    const random = mulberry32(index * 10007 + attempt * 7919 + 37);
    const walls = roomWalls(width, height, layoutIndex, settings.chapter);
    const floor = largestFloorComponent(width, height, walls);
    // Reserve practical manoeuvring room without rejecting every decorated
    // 7x7 layout once chapters introduce four or five boxes.
    if (floor.size < settings.boxes * 6 + 12) continue;

    const pullableGoals = shuffle(
      [...floor].map(parseKey).filter((point) =>
        DIRECTIONS.some((direction) =>
          floor.has(`${point.x - direction.x},${point.y - direction.y}`)
          && floor.has(`${point.x - direction.x * 2},${point.y - direction.y * 2}`),
        ),
      ),
      random,
    );

    const goals: Point[] = [];
    const minimumGoalSpacing = settings.boxes >= 4 ? 2 : 3;
    for (const candidate of pullableGoals) {
      if (goals.every((goal) => Math.abs(goal.x - candidate.x) + Math.abs(goal.y - candidate.y) >= minimumGoalSpacing)) {
        goals.push(candidate);
        if (goals.length === settings.boxes) break;
      }
    }
    if (goals.length !== settings.boxes) continue;

    const boxes = new Set(goals.map(pointKey));
    const free = shuffle([...floor].filter((key) => !boxes.has(key)), random);
    let player = parseKey(free[0]);
    const seen = new Set([JSON.stringify([...boxes].sort())]);
    const movedBoxes = new Set<string>();
    let pulls = 0;

    while (pulls < settings.reversePushes) {
      const reachable = reachableFrom(player, floor, boxes);
      const candidates: Array<{ boxKey: string; previous: Point; playerBefore: Point }> = [];
      for (const boxKey of boxes) {
        const box = parseKey(boxKey);
        for (const direction of shuffle(DIRECTIONS, random)) {
          const previous = { x: box.x - direction.x, y: box.y - direction.y };
          const playerBefore = { x: box.x - direction.x * 2, y: box.y - direction.y * 2 };
          const previousKey = pointKey(previous);
          const beforeKey = pointKey(playerBefore);
          if (!reachable.has(previousKey) || !floor.has(beforeKey) || boxes.has(previousKey) || boxes.has(beforeKey)) continue;
          const nextBoxes = [...boxes].filter((key) => key !== boxKey).concat(previousKey).sort();
          if (!seen.has(JSON.stringify(nextBoxes))) candidates.push({ boxKey, previous, playerBefore });
        }
      }
      if (!candidates.length) break;
      const chosen = candidates[Math.floor(random() * candidates.length)];
      boxes.delete(chosen.boxKey);
      boxes.add(pointKey(chosen.previous));
      player = chosen.playerBefore;
      movedBoxes.add(chosen.boxKey);
      seen.add(JSON.stringify([...boxes].sort()));
      pulls += 1;
    }

    const boxesOnGoals = [...boxes].filter((key) => goals.some((goal) => pointKey(goal) === key)).length;
    if (pulls < settings.reversePushes || boxesOnGoals > 0 || movedBoxes.size < Math.min(settings.boxes, 2)) continue;

    return {
      id: index,
      name: `${CHAPTER_NAMES[settings.chapter]} · ${LAYOUT_NAMES[layoutIndex]}`,
      rows: buildRows(width, height, floor),
      player,
      boxes: [...boxes].map(parseKey),
      goals,
      solutionPushes: pulls,
      difficulty: settings.chapter + 1,
      layout: LAYOUT_NAMES[layoutIndex],
    };
  }

  throw new Error(`Unable to generate solvable level ${index}`);
}

export function generateLevels(count = 50) {
  return Array.from({ length: count }, (_, index) => generateLevel(index + 1));
}

export function isSolved(level: Level, boxes: Set<string>) {
  const goalSet = new Set(level.goals.map(pointKey));
  return boxes.size === goalSet.size && [...boxes].every((box) => goalSet.has(box));
}

export function createInitialState(level: Level) {
  return {
    player: { ...level.player },
    boxes: new Set(level.boxes.map(pointKey)),
    pushes: 0,
    moves: 0,
  };
}

export function moveState(level: Level, state: GameState, dx: number, dy: number) {
  const target = { x: state.player.x + dx, y: state.player.y + dy };
  const targetRow = level.rows[target.y];
  if (!targetRow || targetRow[target.x] === "#") return null;

  const targetKey = pointKey(target);
  if (!state.boxes.has(targetKey)) {
    return { player: target, boxes: new Set(state.boxes), pushes: state.pushes, moves: state.moves + 1 };
  }

  const landing = { x: target.x + dx, y: target.y + dy };
  const landingRow = level.rows[landing.y];
  if (!landingRow || landingRow[landing.x] === "#" || state.boxes.has(pointKey(landing))) return null;

  const nextBoxes = new Set(state.boxes);
  nextBoxes.delete(targetKey);
  nextBoxes.add(pointKey(landing));
  return { player: target, boxes: nextBoxes, pushes: state.pushes + 1, moves: state.moves + 1 };
}

export function stateToCells(level: Level, state: GameState) {
  const goals = new Set(level.goals.map(pointKey));
  return level.rows.map((row, y) =>
    row.split("").map((tile, x) => {
      const key = `${x},${y}`;
      return {
        x,
        y,
        isWall: tile === "#",
        isBorder: tile === "#" && (x === 0 || y === 0 || x === row.length - 1 || y === level.rows.length - 1),
        isGoal: goals.has(key),
        isBox: state.boxes.has(key),
        isPlayer: state.player.x === x && state.player.y === y,
      };
    }),
  );
}

export function formatProgress(current: number, total: number) {
  return `${Math.min(current, total)}/${total}`;
}
