"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  createInitialState,
  formatProgress,
  generateLevels,
  isSolved,
  moveState,
  stateToCells,
  type GameState,
  type Level,
} from "../lib/sokoban";

const TOTAL_LEVELS = 50;
const STORAGE_KEY = "dressbox-quest-save-v1";

const outfits = [
  {
    id: "rose",
    name: "玫瑰晨裙",
    unlockAt: 1,
    dress: "#f49ab7",
    dressDark: "#c65f86",
    trim: "#fff4fa",
    bow: "#efc4d6",
    hair: "#5d3a2d",
    shine: "rgba(255, 216, 230, 0.65)",
    mood: "默认装扮",
  },
  {
    id: "moon",
    name: "月光缎裙",
    unlockAt: 5,
    dress: "#c9d4ff",
    dressDark: "#7d90d8",
    trim: "#f8fbff",
    bow: "#91a8ff",
    hair: "#4f3c36",
    shine: "rgba(211, 223, 255, 0.72)",
    mood: "柔光反射",
  },
  {
    id: "garden",
    name: "花园围裙",
    unlockAt: 10,
    dress: "#93dcb3",
    dressDark: "#4d9e73",
    trim: "#f4fff7",
    bow: "#d5f4e1",
    hair: "#5b4336",
    shine: "rgba(203, 255, 224, 0.66)",
    mood: "清新花香",
  },
  {
    id: "pearl",
    name: "珍珠礼裙",
    unlockAt: 15,
    dress: "#f8dccb",
    dressDark: "#d1907a",
    trim: "#fff8f4",
    bow: "#ffd5c4",
    hair: "#4b3732",
    shine: "rgba(255, 236, 226, 0.68)",
    mood: "华丽展开",
  },
  {
    id: "sky",
    name: "晴空短裙",
    unlockAt: 20,
    dress: "#8de2ef",
    dressDark: "#48a7c5",
    trim: "#f0feff",
    bow: "#caf8ff",
    hair: "#55453d",
    shine: "rgba(201, 248, 255, 0.7)",
    mood: "轻盈跳跃",
  },
  {
    id: "berry",
    name: "莓果蓬裙",
    unlockAt: 25,
    dress: "#d97dbd",
    dressDark: "#a34d87",
    trim: "#fff0f8",
    bow: "#f4b4d9",
    hair: "#54352f",
    shine: "rgba(255, 217, 240, 0.64)",
    mood: "甜味加倍",
  },
  {
    id: "sapphire",
    name: "蓝宝丝裙",
    unlockAt: 30,
    dress: "#7698ff",
    dressDark: "#4159b9",
    trim: "#f6f8ff",
    bow: "#afbefc",
    hair: "#493833",
    shine: "rgba(214, 226, 255, 0.7)",
    mood: "冷调闪光",
  },
  {
    id: "lavender",
    name: "薰衣草晚装",
    unlockAt: 35,
    dress: "#c79cff",
    dressDark: "#8456c2",
    trim: "#fbf5ff",
    bow: "#ead7ff",
    hair: "#59453e",
    shine: "rgba(241, 226, 255, 0.7)",
    mood: "梦境感",
  },
  {
    id: "ember",
    name: "琥珀伞裙",
    unlockAt: 40,
    dress: "#f1b56e",
    dressDark: "#c7702d",
    trim: "#fff9ef",
    bow: "#ffd8ac",
    hair: "#52392f",
    shine: "rgba(255, 232, 192, 0.72)",
    mood: "暖色高光",
  },
  {
    id: "crown",
    name: "王冠终章裙",
    unlockAt: 45,
    dress: "#f6a8aa",
    dressDark: "#cf6674",
    trim: "#fff8fb",
    bow: "#ffe0ea",
    hair: "#443534",
    shine: "rgba(255, 229, 233, 0.75)",
    mood: "终章庆典",
  },
] as const;

type Outfit = (typeof outfits)[number];

type SaveData = {
  levelIndex: number;
  outfitId: string;
  unlocked: string[];
};

type Snapshot = GameState & { levelIndex: number; moves: number; pushes: number };

function clampLevel(levelIndex: number) {
  return Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIndex));
}

function readSave(): SaveData {
  if (typeof window === "undefined") {
    return { levelIndex: 0, outfitId: outfits[0].id, unlocked: [outfits[0].id] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { levelIndex: 0, outfitId: outfits[0].id, unlocked: [outfits[0].id] };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const unlocked = Array.isArray(parsed.unlocked) && parsed.unlocked.length > 0 ? parsed.unlocked : [outfits[0].id];
    return {
      levelIndex: clampLevel(parsed.levelIndex ?? 0),
      outfitId: typeof parsed.outfitId === "string" ? parsed.outfitId : outfits[0].id,
      unlocked,
    };
  } catch {
    return { levelIndex: 0, outfitId: outfits[0].id, unlocked: [outfits[0].id] };
  }
}

function cellClass(cell: { isWall: boolean; isGoal: boolean; isBox: boolean; isPlayer: boolean }) {
  return [
    "tile",
    cell.isWall ? "wall" : "floor",
    cell.isGoal ? "goal" : "",
    cell.isBox ? "box-present" : "",
    cell.isPlayer ? "player-present" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function OutfitSprite({ outfit, large = false }: { outfit: Outfit; large?: boolean }) {
  const style = {
    "--dress": outfit.dress,
    "--dress-dark": outfit.dressDark,
    "--trim": outfit.trim,
    "--bow": outfit.bow,
    "--hair": outfit.hair,
    "--shine": outfit.shine,
  } as CSSProperties;

  return (
    <div className={`sprite ${large ? "sprite-large" : ""}`} style={style}>
      <span className="sprite-glow" />
      <span className="sprite-hair back" />
      <span className="sprite-head" />
      <span className="sprite-blush left" />
      <span className="sprite-blush right" />
      <span className="sprite-eye left" />
      <span className="sprite-eye right" />
      <span className="sprite-bow" />
      <span className="sprite-hair front" />
      <span className="sprite-body" />
      <span className="sprite-sleeve left" />
      <span className="sprite-sleeve right" />
      <span className="sprite-belt" />
      <span className="sprite-skirt" />
      <span className="sprite-ribbon" />
      <span className="sprite-leg left" />
      <span className="sprite-leg right" />
      <span className="sprite-shoe left" />
      <span className="sprite-shoe right" />
    </div>
  );
}

function BoardCell({
  cell,
  outfit,
}: {
  cell: { isWall: boolean; isGoal: boolean; isBox: boolean; isPlayer: boolean };
  outfit: Outfit;
}) {
  return (
    <div className={cellClass(cell)}>
      {!cell.isWall ? <div className="tile-floor" /> : null}
      {!cell.isWall && cell.isGoal ? <span className="tile-goal" aria-hidden="true" /> : null}
      {cell.isBox ? <span className="crate" aria-hidden="true" /> : null}
      {cell.isPlayer ? <OutfitSprite outfit={outfit} /> : null}
    </div>
  );
}

export default function Home() {
  const levels = useMemo(() => generateLevels(TOTAL_LEVELS), []);
  const [booted, setBooted] = useState(false);
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentState, setCurrentState] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([outfits[0].id]);
  const [selectedOutfit, setSelectedOutfit] = useState(outfits[0].id);
  const [toast, setToast] = useState<string>("");
  const [showWardrobe, setShowWardrobe] = useState(true);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.22 });
  const boardRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  const level = levels[levelIndex];
  const outfit = outfits.find((item) => item.id === selectedOutfit) ?? outfits[0];
  const theme = {
    "--theme": outfit.dress,
    "--theme-dark": outfit.dressDark,
    "--theme-soft": outfit.shine,
  } as CSSProperties;

  useEffect(() => {
    const save = readSave();
    setLevelIndex(save.levelIndex);
    setSelectedOutfit(save.outfitId);
    setUnlocked(save.unlocked);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    const next = {
      levelIndex,
      outfitId: selectedOutfit,
      unlocked,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [booted, levelIndex, selectedOutfit, unlocked]);

  useEffect(() => {
    if (!level) return;
    setCurrentState({
      ...createInitialState(level),
      levelIndex,
    });
    setHistory([]);
  }, [levelIndex, level]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  function unlockForLevel(nextLevelIndex: number) {
    const eligible = outfits.filter((item) => item.unlockAt <= nextLevelIndex + 1).map((item) => item.id);
    const merged = Array.from(new Set([...unlocked, ...eligible]));
    if (merged.length !== unlocked.length) {
      const newest = outfits.find((item) => !unlocked.includes(item.id) && item.unlockAt <= nextLevelIndex + 1);
      if (newest) {
        setToast(`解锁新裙装：${newest.name}`);
      }
      setUnlocked(merged);
    }
    if (!merged.includes(selectedOutfit)) {
      setSelectedOutfit(merged[merged.length - 1] ?? outfits[0].id);
    }
  }

  function playMove(dx: number, dy: number) {
    if (!currentState) return;
    const next = moveState(level, currentState, dx, dy);
    if (!next) return;
    const snapshot: Snapshot = { ...next, levelIndex, moves: next.moves, pushes: next.pushes };
    setCurrentState(snapshot);
    setHistory((items) => [...items, currentState]);
    if (isSolved(level, snapshot.boxes)) {
      setToast("过关了，衣橱里又多了一件新裙子。");
      unlockForLevel(levelIndex);
    }
  }

  function handleKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") playMove(0, -1);
    if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") playMove(0, 1);
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") playMove(-1, 0);
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") playMove(1, 0);
    if (event.key === "z" || event.key === "Z") undoMove();
  }

  function undoMove() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setCurrentState(previous);
  }

  function restartLevel() {
    setCurrentState({ ...createInitialState(level), levelIndex });
    setHistory([]);
  }

  function goToLevel(nextIndex: number) {
    const clamped = clampLevel(nextIndex);
    setLevelIndex(clamped);
    unlockForLevel(clamped);
    setToast(`进入第 ${clamped + 1} 关`);
  }

  function nextLevel() {
    if (levelIndex >= TOTAL_LEVELS - 1) return;
    goToLevel(levelIndex + 1);
  }

  function previousLevel() {
    if (levelIndex <= 0) return;
    goToLevel(levelIndex - 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    gestureRef.current = { x: event.clientX, y: event.clientY, active: true };
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture?.active) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      playMove(dx > 0 ? 1 : -1, 0);
    } else {
      playMove(0, dy > 0 ? 1 : -1);
    }
  }

  const cells = useMemo(() => (currentState ? stateToCells(level, currentState) : []), [currentState, level]);
  const solved = currentState ? isSolved(level, currentState.boxes) : false;
  const completion = Math.round(((levelIndex + (solved ? 1 : 0)) / TOTAL_LEVELS) * 100);
  const unlockedCount = unlocked.length;
  const currentTheme = outfits.find((item) => item.id === selectedOutfit) ?? outfits[0];
  const currentChapter = `第 ${levelIndex + 1} 关 / ${TOTAL_LEVELS} 关`;

  return (
    <main
      className="game-shell"
      style={
        {
          ...theme,
          "--pointer-x": `${pointer.x * 100}%`,
          "--pointer-y": `${pointer.y * 100}%`,
        } as CSSProperties
      }
      onKeyDown={handleKey}
      tabIndex={0}
    >
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />
      <div className="ambient ambient-c" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="pointer-halo" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <div className="mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p>裙装推箱子</p>
            <span>50 关 · 触控 + 键盘 · 换装收集</span>
          </div>
        </div>

        <div className="meta-strip">
          <span>{currentChapter}</span>
          <span>{completion}% 完成</span>
          <span>{formatProgress(unlockedCount, outfits.length)} 套裙装</span>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <p className="kicker">PUZZLE STORYBOOK</p>
          <h1>把箱子推到目标上，也把新的裙子推回衣橱。</h1>
          <p>
            这是一个偏商业手游质感的推箱子版式：你会沿着 50 关逐步解锁裙装，
            每过几关就能换一套新衣服。可以直接触控，也可以用方向键。
          </p>
        </div>

        <div className="hero-portrait">
          <div className="portrait-stage">
            <div className="portrait-backdrop" />
            <OutfitSprite outfit={currentTheme} large />
            <div className="portrait-note">
              <strong>{currentTheme.name}</strong>
              <span>{currentTheme.mood}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="playfield">
        <div className="board-panel">
          <div className="panel-head">
            <div>
              <p>当前关卡</p>
              <h2>{level.name}</h2>
            </div>
            <div className="panel-stats">
              <span>步数 {currentState?.moves ?? 0}</span>
              <span>推箱 {currentState?.pushes ?? 0}</span>
            </div>
          </div>

          <div
            className="board-frame"
            ref={boardRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={(event) => {
              const board = boardRef.current;
              if (!board) return;
              const rect = board.getBoundingClientRect();
              setPointer({
                x: (event.clientX - rect.left) / rect.width,
                y: (event.clientY - rect.top) / rect.height,
              });
            }}
          >
            <div
              className="board-grid"
              style={{ gridTemplateColumns: `repeat(${level.rows[0]?.length ?? 0}, minmax(0, 1fr))` }}
            >
              {cells.map((row) =>
                row.map((cell) => (
                  <BoardCell key={`${cell.x}-${cell.y}`} cell={cell} outfit={currentTheme} />
                )),
              )}
            </div>

            <div className={`win-banner ${solved ? "show" : ""}`}>
              <strong>通关啦</strong>
              <span>你为她解锁了新一套裙装</span>
            </div>
          </div>

          <div className="control-row">
            <button type="button" onClick={previousLevel} aria-label="上一关">
              ←
            </button>
            <button type="button" onClick={undoMove} aria-label="撤销一步">
              撤销
            </button>
            <button type="button" onClick={restartLevel} aria-label="重新开始本关">
              重来
            </button>
            <button type="button" onClick={nextLevel} aria-label="下一关">
              →
            </button>
          </div>

          <div className="touch-pad" aria-label="方向控制">
            <div />
            <button type="button" onClick={() => playMove(0, -1)} aria-label="向上移动">
              ↑
            </button>
            <div />
            <button type="button" onClick={() => playMove(-1, 0)} aria-label="向左移动">
              ←
            </button>
            <button type="button" onClick={() => playMove(0, 1)} aria-label="向下移动">
              ↓
            </button>
            <button type="button" onClick={() => playMove(1, 0)} aria-label="向右移动">
              →
            </button>
          </div>
        </div>

        <aside className={`wardrobe-panel ${showWardrobe ? "open" : ""}`}>
          <div className="panel-head">
            <div>
              <p>衣橱</p>
              <h2>换装系统</h2>
            </div>
            <button type="button" onClick={() => setShowWardrobe((value) => !value)}>
              {showWardrobe ? "收起" : "展开"}
            </button>
          </div>

          <p className="wardrobe-copy">
            每到新的里程碑，裙子就会解锁。你可以随时选回喜欢的那一套。
          </p>

          <div className="wardrobe-preview">
            <OutfitSprite outfit={currentTheme} large />
            <div>
              <strong>{currentTheme.name}</strong>
              <span>{currentTheme.mood}</span>
            </div>
          </div>

          <div className="wardrobe-grid">
            {outfits.map((item) => {
              const unlockedNow = unlocked.includes(item.id);
              const active = item.id === selectedOutfit;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`wardrobe-card ${active ? "active" : ""} ${unlockedNow ? "" : "locked"}`}
                  onClick={() => {
                    if (!unlockedNow) return;
                    setSelectedOutfit(item.id);
                    setToast(`换上了 ${item.name}`);
                  }}
                >
                  <span className="wardrobe-swatch" style={{ background: item.dress }} />
                  <span className="wardrobe-meta">
                    <strong>{item.name}</strong>
                    <small>{unlockedNow ? "已解锁" : `第 ${item.unlockAt} 关解锁`}</small>
                  </span>
                  <span className="wardrobe-lock">{unlockedNow ? (active ? "已穿戴" : "可穿戴") : "锁定"}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="footer-bar">
        <div>
          <p>进度条</p>
          <div className="progress-track">
            <span style={{ width: `${completion}%` }} />
          </div>
        </div>
        <button type="button" onClick={() => setToast("已保存到本地。")}>
          本地存档
        </button>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
