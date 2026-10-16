export type Point = { x: number; y: number };

export type Level = {
  id: number;
  name: string;
  rows: string[];
  player: Point;
  boxes: Point[];
  goals: Point[];
  solutionPushes: number;
  solutionMoves: number;
  solution: Array<{ from: Point; dx: number; dy: number }>;
  difficulty: number;
  layout: string;
};

export type GameState = ReturnType<typeof createInitialState>;

const CHAPTER_NAMES = [
  "阳光玩具房",
  "草莓茶会厅",
  "秘密花园房",
  "月光魔法阁楼",
  "皇家衣帽间",
  "星辉舞会厅",
  "皇冠秘密宝库",
  "云端水晶宫",
  "时光玫瑰长廊",
  "永恒星冠殿",
];
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

function transformPoint(point: Point, size: number, transform: number): Point {
  const { x, y } = point;
  switch (transform % 8) {
    case 1: return { x: size - y, y: x };
    case 2: return { x: size - x, y: size - y };
    case 3: return { x: y, y: size - x };
    case 4: return { x: size - x, y };
    case 5: return { x, y: size - y };
    case 6: return { x: y, y: x };
    case 7: return { x: size - y, y: size - x };
    default: return { x, y };
  }
}

function roomWalls(
  width: number,
  height: number,
  layoutIndex: number,
  chapter: number,
  transform: number,
  accentCount: number,
  random: () => number,
) {
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

  // Rotate/reflect the architectural motif between chapters. More importantly,
  // add a few seeded accent walls so later rooms do not merely replay the same
  // ten topologies with different box coordinates.
  const transformed = new Set<string>();
  for (const key of walls) {
    const point = transformPoint(parseKey(key), width - 1, transform);
    transformed.add(pointKey(point));
  }
  const accentCandidates = shuffle(
    Array.from({ length: height - 2 }, (_, row) =>
      Array.from({ length: width - 2 }, (_, column) => ({ x: column + 1, y: row + 1 })),
    ).flat().filter((point) => !transformed.has(pointKey(point))),
    random,
  );
  for (const point of accentCandidates.slice(0, accentCount)) transformed.add(pointKey(point));
  return transformed;
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

function shortestWalkDistance(start: Point, target: Point, floor: Set<string>, boxes: Set<string>) {
  const startKey = pointKey(start);
  const targetKey = pointKey(target);
  if (startKey === targetKey) return 0;
  const visited = new Set([startKey]);
  const queue = [{ point: start, distance: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    for (const direction of DIRECTIONS) {
      const next = { x: current.point.x + direction.x, y: current.point.y + direction.y };
      const key = pointKey(next);
      if (!floor.has(key) || boxes.has(key) || visited.has(key)) continue;
      if (key === targetKey) return current.distance + 1;
      visited.add(key);
      queue.push({ point: next, distance: current.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function countSolutionMoves(level: Pick<Level, "rows" | "player" | "boxes" | "solution">) {
  const floor = new Set<string>();
  level.rows.forEach((row, y) => row.split("").forEach((tile, x) => {
    if (tile === ".") floor.add(`${x},${y}`);
  }));
  const boxes = new Set(level.boxes.map(pointKey));
  let player = { ...level.player };
  let moves = 0;
  for (const step of level.solution) {
    const behind = { x: step.from.x - step.dx, y: step.from.y - step.dy };
    const walk = shortestWalkDistance(player, behind, floor, boxes);
    if (!Number.isFinite(walk)) return Number.POSITIVE_INFINITY;
    const fromKey = pointKey(step.from);
    boxes.delete(fromKey);
    boxes.add(`${step.from.x + step.dx},${step.from.y + step.dy}`);
    player = { ...step.from };
    moves += walk + 1;
  }
  return moves;
}

function buildRows(width: number, height: number, floor: Set<string>) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => floor.has(`${x},${y}`) ? "." : "#").join(""),
  );
}

function rowTransformSignatures(rows: string[]) {
  const size = rows.length - 1;
  return Array.from({ length: 8 }, (_, transform) => {
    const output = rows.map((row) => [...row]);
    for (let y = 0; y <= size; y += 1) {
      for (let x = 0; x <= size; x += 1) {
        const target = transformPoint({ x, y }, size, transform);
        output[target.y][target.x] = rows[y][x];
      }
    }
    return output.map((row) => row.join("")).join("/");
  });
}

function signatureDistance(left: string, right: string) {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

function canonicalSolutionSignature(level: Level) {
  const variants = Array.from({ length: 8 }, (_, transform) => level.solution.map(({ dx, dy }) => {
    const [x, y] = [
      [dx, dy], [-dy, dx], [-dx, -dy], [dy, -dx],
      [-dx, dy], [dx, -dy], [dy, dx], [-dy, -dx],
    ][transform];
    if (x === 1) return "R";
    if (x === -1) return "L";
    if (y === 1) return "D";
    return "U";
  }).join(""));
  return variants.sort()[0];
}

function difficultyFor(index: number) {
  const chapter = Math.floor((index - 1) / 10);
  const stage = (index - 1) % 10;
  const boxBands = [
    stage < 4 ? 1 : 2,
    stage < 6 ? 2 : 3,
    stage < 3 ? 2 : 3,
    stage < 6 ? 3 : 4,
    stage % 4 === 0 ? 3 : 4,
    stage % 5 === 1 ? 3 : 4,
    4,
    stage >= 7 ? 5 : 4,
    stage >= 6 && stage % 2 === 0 ? 5 : 4,
    stage >= 5 ? 5 : 4,
  ];
  return {
    chapter,
    stage,
    boxes: boxBands[chapter],
    // Keep the difficulty curve continuous at chapter boundaries. The old
    // formula restarted at a low push count on level 11/21/31/41, which made
    // later chapters feel easier than the chapter they followed. These bands
    // preserve a gentle first five levels and leave enough room on the fixed
    // seven-by-seven board for four-box endgame layouts.
    reversePushes: (() => {
      const bands = [
        [4, 8],
        [9, 14],
        [15, 20],
        [21, 26],
        [27, 32],
        [33, 38],
        [39, 44],
        [45, 50],
        [51, 56],
        [57, 63],
      ] as const;
      const [start, end] = bands[chapter];
      return start + Math.round(((end - start) * stage) / 9);
    })(),
  };
}

function generateLevel(index: number, variantSalt = 0): Level {
  const settings = difficultyFor(index);
  // A coprime chapter/stage permutation avoids presenting the same room order
  // in every chapter while retaining the ten named architectural families.
  const layoutIndex = (settings.stage * 3 + settings.chapter * 7) % LAYOUT_NAMES.length;
  // Every visual chapter uses the same seven-by-seven board mother. The two
  // outer wall rows/columns are logical only, giving one stable 9x9 coordinate
  // system for all 100 levels and all composited scene backgrounds.
  const width = 9;
  const height = 9;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const random = mulberry32(index * 10007 + attempt * 7919 + variantSalt * 104729 + 37);
    const accentCount = settings.boxes >= 5 ? 2 : 2 + ((settings.chapter + settings.stage) % 3);
    const transform = settings.chapter * 3 + settings.stage * 5 + attempt + variantSalt;
    const walls = roomWalls(width, height, layoutIndex, settings.chapter, transform, accentCount, random);
    const floor = largestFloorComponent(width, height, walls);
    // Reserve practical manoeuvring room without rejecting every decorated
    // 7x7 layout once chapters introduce four or five boxes.
    if (floor.size < settings.boxes * 5 + 12) continue;

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
    const boxIds = new Map(goals.map((goal, goalIndex) => [pointKey(goal), goalIndex]));
    const movedBoxes = new Set<number>();
    const boxMoveCounts = Array.from({ length: settings.boxes }, () => 0);
    const usedDirections = new Set<string>();
    const movedBoxTrace: number[] = [];
    const reverseSolution: Array<{ from: Point; dx: number; dy: number }> = [];
    let previousDirection = "";
    let pulls = 0;

    while (pulls < settings.reversePushes) {
      const reachable = reachableFrom(player, floor, boxes);
      const candidates: Array<{ boxKey: string; boxId: number; previous: Point; playerBefore: Point; direction: Point; score: number }> = [];
      for (const boxKey of boxes) {
        const box = parseKey(boxKey);
        for (const direction of shuffle(DIRECTIONS, random)) {
          const previous = { x: box.x - direction.x, y: box.y - direction.y };
          const playerBefore = { x: box.x - direction.x * 2, y: box.y - direction.y * 2 };
          const previousKey = pointKey(previous);
          const beforeKey = pointKey(playerBefore);
          if (!reachable.has(previousKey) || !floor.has(beforeKey) || boxes.has(previousKey) || boxes.has(beforeKey)) continue;
          const nextBoxes = [...boxes].filter((key) => key !== boxKey).concat(previousKey).sort();
          const boxId = boxIds.get(boxKey);
          if (boxId === undefined || seen.has(JSON.stringify(nextBoxes))) continue;
          const directionKey = `${direction.x},${direction.y}`;
          const leastMoved = Math.min(...boxMoveCounts);
          const score = (boxMoveCounts[boxId] === leastMoved ? 5 : 0)
            + (!movedBoxes.has(boxId) ? 4 : 0)
            + (directionKey !== previousDirection ? 2 : 0)
            + (!usedDirections.has(directionKey) ? 2 : 0)
            + random();
          candidates.push({ boxKey, boxId, previous, playerBefore, direction, score });
        }
      }
      if (!candidates.length) break;
      candidates.sort((left, right) => right.score - left.score);
      const choiceBand = Math.max(1, Math.ceil(candidates.length / 3));
      const chosen = candidates[Math.floor(random() * choiceBand)];
      reverseSolution.push({ from: { ...chosen.previous }, dx: chosen.direction.x, dy: chosen.direction.y });
      boxes.delete(chosen.boxKey);
      boxes.add(pointKey(chosen.previous));
      boxIds.delete(chosen.boxKey);
      boxIds.set(pointKey(chosen.previous), chosen.boxId);
      player = chosen.playerBefore;
      movedBoxes.add(chosen.boxId);
      boxMoveCounts[chosen.boxId] += 1;
      movedBoxTrace.push(chosen.boxId);
      previousDirection = `${chosen.direction.x},${chosen.direction.y}`;
      usedDirections.add(previousDirection);
      seen.add(JSON.stringify([...boxes].sort()));
      pulls += 1;
    }

    const boxesOnGoals = [...boxes].filter((key) => goals.some((goal) => pointKey(goal) === key)).length;
    const requiredMovedBoxes = settings.boxes === 1 ? 1 : settings.boxes;
    const requiredDirections = settings.chapter < 2 ? 2 : 3;
    const directionChanges = reverseSolution.slice(1).filter((step, stepIndex) => {
      const previous = reverseSolution[stepIndex];
      return step.dx !== previous.dx || step.dy !== previous.dy;
    }).length;
    const boxSwitches = movedBoxTrace.slice(1).filter((boxId, traceIndex) => boxId !== movedBoxTrace[traceIndex]).length;
    const minimumDirectionChanges = Math.min(settings.reversePushes - 1, Math.ceil(settings.reversePushes * 0.25));
    const minimumBoxSwitches = settings.boxes === 1 ? 0 : Math.min(settings.reversePushes - 1, settings.boxes + 1);
    if (pulls < settings.reversePushes || boxesOnGoals > 0
      || movedBoxes.size < requiredMovedBoxes || usedDirections.size < requiredDirections
      || directionChanges < minimumDirectionChanges || boxSwitches < minimumBoxSwitches) continue;

    const rows = buildRows(width, height, floor);
    const solution = reverseSolution.reverse();
    const draft = {
      rows,
      player,
      boxes: [...boxes].map(parseKey),
      solution,
    };
    const solutionMoves = countSolutionMoves(draft);
    if (!Number.isFinite(solutionMoves)) continue;
    const internalWalls = (width - 2) * (height - 2) - floor.size;
    const complexity = pulls + settings.boxes * 5 + internalWalls * 1.25
      + directionChanges * 0.75 + boxSwitches * 0.6;
    const difficulty = complexity >= 88 ? 5 : complexity >= 64 ? 4 : complexity >= 42 ? 3 : complexity >= 24 ? 2 : 1;

    return {
      id: index,
      name: `${CHAPTER_NAMES[settings.chapter]} · ${LAYOUT_NAMES[layoutIndex]}`,
      rows,
      player,
      boxes: draft.boxes,
      goals,
      solutionPushes: pulls,
      solutionMoves,
      solution,
      difficulty,
      layout: LAYOUT_NAMES[layoutIndex],
    };
  }

  throw new Error(`Unable to generate solvable level ${index}`);
}

const CURATED_LEVEL_SALTS = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
  0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 2, 0, 0, 1, 0,
  0, 4, 0, 0, 0, 0, 0, 1, 0, 1,
  12, 0, 0, 0, 0, 0, 1, 2, 0, 0,
  0, 0, 0, 0, 0, 3, 0, 3, 27, 1,
  0, 3, 2, 0, 4, 0, 16, 3, 12, 0,
  63, 0, 22, 87, 0, 3, 16, 77, 0, 9,
] as const;

/** Re-run the diversity search when the generator itself changes. The shipped
 * game uses the curated salts below so mobile startup does not pay this cost. */
export function regenerateLevels(count = 100, onProgress?: (level: number, salt: number) => void) {
  const levels: Level[] = [];
  const roomSignatures: string[] = [];
  const solutionSignatures = new Set<string>();
  for (let index = 1; index <= count; index += 1) {
    let accepted: Level | null = null;
    let acceptedSalt = 0;
    const preferredSalt = CURATED_LEVEL_SALTS[index - 1] ?? 0;
    const saltCandidates = [preferredSalt, ...Array.from({ length: 240 }, (_, salt) => salt).filter((salt) => salt !== preferredSalt)];
    for (const salt of saltCandidates) {
      let candidate: Level;
      try {
        candidate = generateLevel(index, salt);
      } catch {
        continue;
      }
      const roomSignature = candidate.rows.join("/");
      const roomVariants = rowTransformSignatures(candidate.rows);
      const tooSimilar = roomSignatures.some((previous) =>
        roomVariants.some((variant) => signatureDistance(variant, previous) < 3),
      );
      const solutionSignature = canonicalSolutionSignature(candidate);
      if (tooSimilar || solutionSignatures.has(solutionSignature)) continue;
      roomSignatures.push(roomSignature);
      solutionSignatures.add(solutionSignature);
      accepted = candidate;
      acceptedSalt = salt;
      break;
    }
    if (!accepted) throw new Error(`Unable to generate a distinct level ${index}`);
    levels.push(accepted);
    onProgress?.(index, acceptedSalt);
  }
  return levels;
}

export function generateLevels(count = 100) {
  if (count > CURATED_LEVEL_SALTS.length) return regenerateLevels(count);
  return Array.from({ length: count }, (_, levelIndex) =>
    generateLevel(levelIndex + 1, CURATED_LEVEL_SALTS[levelIndex]),
  );
}

export function isSolved(level: Level, boxes: Set<string>) {
  const goalSet = new Set(level.goals.map(pointKey));
  return boxes.size === goalSet.size && [...boxes].every((box) => goalSet.has(box));
}

export function calculateStars(level: Pick<Level, "solutionPushes" | "solutionMoves">, pushes: number, moves: number) {
  const threeStarMoveLimit = Math.ceil(level.solutionMoves * 1.25);
  const twoStarPushLimit = Math.ceil(level.solutionPushes * 1.2);
  const twoStarMoveLimit = Math.ceil(level.solutionMoves * 1.65);
  if (pushes <= level.solutionPushes && moves <= threeStarMoveLimit) return 3;
  if (pushes <= twoStarPushLimit && moves <= twoStarMoveLimit) return 2;
  return 1;
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
