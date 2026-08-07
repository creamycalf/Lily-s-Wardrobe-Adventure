"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createInitialState, generateLevels, isSolved, moveState, stateToCells, type GameState } from "../lib/sokoban";

const TOTAL_LEVELS = 50;
const STORAGE_KEY = "lilys-wardrobe-adventure-v1";

const outfits = [
  { id: "rose", name: "玫瑰晨礼裙", unlockAt: 1, asset: "/art/outfit-rose.png", color: "#f3a0b9", boardFilter: "brightness(1)" },
  { id: "bakery", name: "蓝莓烘焙裙", unlockAt: 5, asset: "/art/outfit-bakery.png", color: "#91bde0", boardFilter: "hue-rotate(165deg) saturate(.82) brightness(1.03)" },
  { id: "garden", name: "薄荷花园裙", unlockAt: 10, asset: "/art/outfit-garden.png", color: "#a9cf77", boardFilter: "hue-rotate(72deg) saturate(.72) brightness(1.04)" },
  { id: "pearl", name: "珍珠茶会裙", unlockAt: 15, asset: "/art/outfit-pearl.png", color: "#f0ded0", boardFilter: "saturate(.3) brightness(1.12) sepia(.12)" },
  { id: "berry", name: "莓果丝绒裙", unlockAt: 20, asset: "/art/outfit-berry.png", color: "#9e315e", boardFilter: "hue-rotate(322deg) saturate(1.35) brightness(.82)" },
  { id: "violet", name: "紫罗兰礼裙", unlockAt: 25, asset: "/art/outfit-violet.png", color: "#ad62ac", boardFilter: "hue-rotate(250deg) saturate(.92) brightness(.94)" },
  { id: "ice", name: "冰晶星光裙", unlockAt: 30, asset: "/art/outfit-ice.png", color: "#83b9ef", boardFilter: "hue-rotate(175deg) saturate(.7) brightness(1.14)" },
  { id: "moon", name: "月光公主裙", unlockAt: 35, asset: "/art/outfit-moon.png", color: "#b89ce5", boardFilter: "hue-rotate(235deg) saturate(.6) brightness(1.08)" },
  { id: "autumn", name: "琥珀斗篷裙", unlockAt: 40, asset: "/art/outfit-autumn.png", color: "#d89051", boardFilter: "hue-rotate(338deg) saturate(.95) sepia(.28) brightness(.96)" },
  { id: "winter", name: "冬日红斗篷", unlockAt: 43, asset: "/art/outfit-winter.png", color: "#ca4a58", boardFilter: "hue-rotate(323deg) saturate(1.45) brightness(.86)" },
  { id: "starlight", name: "星空魔法裙", unlockAt: 47, asset: "/art/outfit-starlight.png", color: "#243d85", boardFilter: "hue-rotate(188deg) saturate(1.4) brightness(.65)" },
  { id: "crown", name: "皇冠终章礼服", unlockAt: 50, asset: "/art/outfit-crown.png", color: "#f0cf99", boardFilter: "sepia(.55) saturate(.85) brightness(1.08)" },
] as const;

const chapters = [
  { name: "阳光玩具房", range: "1—10", className: "theme-toy", background: "/art-v2/backgrounds/chapter-01-toy-room.png", board: "/art-v2/scene-board-agent-test.png", grid: { left: "50%", top: "50%", width: "76%", height: "44.2%" } },
  { name: "草莓茶会厅", range: "11—20", className: "theme-tea", background: "/art-v2/backgrounds/chapter-02-tea-room.png", board: "/art-v3/scene-board-chapter-02.png", grid: { left: "50%", top: "49.2%", width: "68%", height: "42.8%" } },
  { name: "秘密花园房", range: "21—30", className: "theme-garden", background: "/art-v2/backgrounds/chapter-03-garden-room.png", board: "/art-v3/scene-board-chapter-03.png", grid: { left: "50%", top: "49%", width: "69%", height: "44.8%" } },
  { name: "月光魔法阁楼", range: "31—40", className: "theme-moon", background: "/art-v2/backgrounds/chapter-04-moon-attic.png", board: "/art-v3/scene-board-chapter-04.png", grid: { left: "50%", top: "50.7%", width: "64%", height: "42.3%" } },
  { name: "皇家衣帽间", range: "41—50", className: "theme-royal", background: "/art-v2/backgrounds/chapter-05-royal-wardrobe.png", board: "/art-v3/scene-board-chapter-05.png", grid: { left: "50%", top: "56.1%", width: "70%", height: "43.7%" } },
] as const;

const obstacleNames = ["teddy", "rocking-horse", "wardrobe", "stool", "chest", "pink-chest"] as const;

type Outfit = (typeof outfits)[number];
type Direction = "up" | "down" | "left" | "right";
type Screen = "start" | "game" | "map";
type Snapshot = GameState & { levelIndex: number };

function clampLevel(index: number) {
  return Math.max(0, Math.min(TOTAL_LEVELS - 1, index));
}

function playerAsset(outfit: Outfit, direction: Direction, action: "idle" | "walk" | "push", boardMode = false) {
  if (boardMode) return `/art-v2/character-topdown/${direction}.png`;
  if (outfit.id !== "rose") return outfit.asset;
  const base = "/art-v2/character";
  if (action === "push") {
    if (direction === "left") return `${base}/push-left-1.png`;
    if (direction === "right") return `${base}/push-right-1.png`;
    if (direction === "up") return `${base}/push-right-2.png`;
    return `${base}/push-left-2.png`;
  }
  if (action === "walk") {
    if (direction === "left") return `${base}/walk-left-2.png`;
    if (direction === "right") return `${base}/walk-right-2.png`;
    if (direction === "up") return `${base}/walk-right-4.png`;
    return `${base}/walk-front-1.png`;
  }
  if (direction === "left") return `${base}/idle-left-1.png`;
  if (direction === "right") return `${base}/idle-right-1.png`;
  if (direction === "up") return `${base}/idle-right-2.png`;
  return `${base}/idle-front-1.png`;
}

function Character({ outfit, direction, action, className = "" }: {
  outfit: Outfit;
  direction: Direction;
  action: "idle" | "walk" | "push";
  className?: string;
}) {
  const boardMode = className.split(" ").includes("board-character");
  const portraitDirection = !boardMode && outfit.id !== "rose" ? `portrait-direction direction-${direction}` : "";
  return <img className={`character ${className} outfit-${outfit.id} action-${action} ${portraitDirection}`} src={playerAsset(outfit, direction, action, boardMode)} alt="" draggable={false} />;
}

export default function DressboxGame() {
  const levels = useMemo(() => generateLevels(TOTAL_LEVELS), []);
  const [screen, setScreen] = useState<Screen>("start");
  const [mapChapter, setMapChapter] = useState<number | null>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentState, setCurrentState] = useState<Snapshot>(() => ({ ...createInitialState(levels[0]), levelIndex: 0 }));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [completedLevel, setCompletedLevel] = useState(0);
  const [selectedOutfit, setSelectedOutfit] = useState<string>("rose");
  const [unlocked, setUnlocked] = useState<string[]>(["rose"]);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [action, setAction] = useState<"idle" | "walk" | "push">("idle");
  const [gesture, setGesture] = useState<{ x: number; y: number } | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef<HTMLElement | null>(null);

  const level = levels[levelIndex];
  const outfit = outfits.find((item) => item.id === selectedOutfit) ?? outfits[0];
  const cells = useMemo(() => stateToCells(level, currentState), [level, currentState]);
  // The generated level keeps a one-cell wall ring for collision detection.
  // It is not part of the painted seven-by-seven board, so never give those
  // logical border cells visual grid tracks.
  const visibleCells = useMemo(
    () => cells.slice(1, -1).flatMap((row) => row.slice(1, -1)),
    [cells],
  );
  const chapterIndex = Math.min(4, Math.floor(levelIndex / 10));
  const chapter = chapters[chapterIndex];
  const integratedBoardMode = true;
  const chapterAssetBase = `/art-v2/objects/chapter-${String(chapterIndex + 1).padStart(2, "0")}`;
  const completion = Math.round((completedLevel / TOTAL_LEVELS) * 100);
  const journeyChapter = Math.min(4, Math.floor(Math.max(completedLevel, levelIndex) / 10));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as { levelIndex?: number; selectedOutfit?: string; unlocked?: string[]; completedLevel?: number };
      const savedCompletedLevel = Math.max(0, Math.min(TOTAL_LEVELS, save.completedLevel ?? 0));
      // Older saves could point at any level in an unlocked chapter. Keep the
      // resume point inside the sequentially cleared range during migration.
      const nextLevel = Math.min(clampLevel(save.levelIndex ?? 0), Math.min(TOTAL_LEVELS - 1, savedCompletedLevel));
      setLevelIndex(nextLevel);
      setCurrentState({ ...createInitialState(levels[nextLevel]), levelIndex: nextLevel });
      setSelectedOutfit(save.selectedOutfit ?? "rose");
      setUnlocked(save.unlocked?.length ? save.unlocked : ["rose"]);
      setCompletedLevel(savedCompletedLevel);
    } catch {
      // Ignore damaged local saves.
    }
  }, [levels]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ levelIndex, selectedOutfit, unlocked, completedLevel }));
  }, [levelIndex, selectedOutfit, unlocked, completedLevel]);

  useEffect(() => {
    if (screen !== "game") return;
    const frame = window.requestAnimationFrame(() => gameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [screen, levelIndex]);

  function resetLevel(nextIndex = levelIndex, nextScreen: Screen = "game") {
    const target = clampLevel(nextIndex);
    setLevelIndex(target);
    setCurrentState({ ...createInitialState(levels[target]), levelIndex: target });
    setHistory([]);
    setShowResult(false);
    setScreen(nextScreen);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }

  function animate(nextAction: "walk" | "push") {
    setAction(nextAction);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => setAction("idle"), 220);
  }

  function playMove(dx: number, dy: number) {
    const nextDirection = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    setDirection(nextDirection);
    const next = moveState(level, currentState, dx, dy);
    if (!next) return;
    animate(next.pushes > currentState.pushes ? "push" : "walk");
    setHistory((items) => [...items, currentState]);
    const snapshot = { ...next, levelIndex };
    setCurrentState(snapshot);
    if (isSolved(level, snapshot.boxes)) {
      const cleared = Math.max(completedLevel, levelIndex + 1);
      setCompletedLevel(cleared);
      setUnlocked(Array.from(new Set([...unlocked, ...outfits.filter((item) => item.unlockAt <= cleared).map((item) => item.id)])));
      setShowResult(true);
    }
  }

  function undoMove() {
    const previous = history.at(-1);
    if (!previous) return;
    setCurrentState(previous);
    setHistory((items) => items.slice(0, -1));
    setShowResult(false);
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (screen !== "game" || showWardrobe) return;
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") playMove(0, -1);
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") playMove(0, 1);
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") playMove(-1, 0);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") playMove(1, 0);
    if (event.key.toLowerCase() === "z") undoMove();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    setGesture(null);
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) playMove(dx > 0 ? 1 : -1, 0);
    else playMove(0, dy > 0 ? 1 : -1);
  }

  const themeStyle = {
    "--accent": outfit.color,
    "--chapter-bg": `url("${chapter.background}")`,
    "--integrated-board-bg": `url("${chapter.board}")`,
    "--board-grid-left": chapter.grid.left,
    "--board-grid-top": chapter.grid.top,
    "--board-grid-width": chapter.grid.width,
    "--board-grid-height": chapter.grid.height,
    "--character-filter": outfit.boardFilter,
    "--tile-floor": `url("${chapterAssetBase}/floor-cream.png")`,
    "--tile-goal": `url("${chapterAssetBase}/goal.png")`,
    "--tile-goal-lit": `url("${chapterAssetBase}/goal-lit.png")`,
    "--crate-art": integratedBoardMode
      ? 'url("/art-v2/objects-topdown/crate.png")'
      : `url("${chapterAssetBase}/crate.png")`,
    "--internal-wall-art": integratedBoardMode
      ? 'url("/art-v2/objects-topdown/pink-block.png")'
      : "none",
  } as CSSProperties;

  if (screen === "start") {
    return (
      <main className="start-screen">
        <div className="start-art" />
        <div className="start-copy">
          <p className="eyebrow">50关 · 推箱解谜 · 梦幻换装</p>
          <h1>莉莉的<br />衣橱冒险</h1>
          <p>把每一只宝箱推到星光位置，打开衣橱里珍藏的新裙子。</p>
          <button className="primary-button start-button" type="button" onClick={() => setScreen("game")}>开始游戏</button>
          <button className="text-button" type="button" onClick={() => setScreen("map")}>选择关卡</button>
        </div>
      </main>
    );
  }

  if (screen === "map") {
    if (mapChapter === null) {
      return (
        <main className="map-screen chapter-journey-screen">
          <div className="map-backdrop" />
          <section className="map-journey">
            <div className="map-art" />
            <header className="map-header">
              <button className="round-icon" type="button" onClick={() => setScreen("start")} aria-label="返回首页"><img src="/art/ui-back.png" alt="" /></button>
              <div><span>莉莉的梦幻旅程</span><h1>选择章节</h1></div>
              <div className="star-counter"><img src="/art/ui-star.png" alt="" />{completedLevel}</div>
            </header>
            <div className="chapter-route" aria-label="五个章节">
              {chapters.map((item, index) => {
                const progress = Math.max(0, Math.min(10, completedLevel - index * 10));
                const isUnlocked = index === 0 || completedLevel >= index * 10;
                return (
                  <button
                    type="button"
                    key={item.name}
                    className={`chapter-node chapter-node-${index + 1} ${isUnlocked ? "unlocked" : "locked"}`}
                    onClick={() => isUnlocked && setMapChapter(index)}
                    disabled={!isUnlocked}
                    aria-label={`进入${item.name}`}
                  >
                    <span>第 {index + 1} 章</span>
                    <strong>{item.name}</strong>
                    <small>{progress}/10</small>
                  </button>
                );
              })}
              <Character outfit={outfit} direction="up" action="walk" className={`map-girl map-girl-${journeyChapter + 1}`} />
            </div>
          </section>
        </main>
      );
    }

    const mapChapterData = chapters[mapChapter];
    const mapChapterAssetBase = `/art-v2/objects/chapter-${String(mapChapter + 1).padStart(2, "0")}`;
    const chapterStart = mapChapter * 10;
    return (
      <main
        className={`chapter-map-screen ${mapChapterData.className}`}
        style={{ "--chapter-bg": `url("${mapChapterData.background}")`, "--level-cushion": `url("${mapChapterAssetBase}/goal.png")` } as CSSProperties}
      >
        <header className="map-header">
          <button className="round-icon" type="button" onClick={() => setMapChapter(null)} aria-label="返回章节"><img src="/art/ui-back.png" alt="" /></button>
          <div><span>第 {mapChapter + 1} 章 · {mapChapterData.range}关</span><h1>{mapChapterData.name}</h1></div>
          <div className="star-counter"><img src="/art/ui-star.png" alt="" />{completedLevel}</div>
        </header>
        <section className="chapter-level-scene">
          <Character outfit={outfit} direction="right" action="walk" className="chapter-map-girl" />
          <div className="chapter-levels">
          {levels.slice(chapterStart, chapterStart + 10).map((item, localIndex) => {
            const index = chapterStart + localIndex;
            const isAvailable = index <= completedLevel;
            return (
            <button
              type="button"
              key={item.id}
              className={`${index === levelIndex ? "active" : ""} ${index < completedLevel ? "cleared" : ""} ${isAvailable ? "" : "locked"}`}
              onClick={() => isAvailable && resetLevel(index)}
              disabled={!isAvailable}
              aria-label={`进入第${index + 1}关`}
              data-layout={item.rows.join("|")}
              data-boxes={item.boxes.length}
              data-pushes={item.solutionPushes}
            >
              <small>{index < completedLevel ? "★" : `第${index + 1}关`}</small>
            </button>
          )})}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main ref={gameRef} className={`game-screen ${chapter.className} integrated-board-mode`} style={themeStyle} onKeyDown={handleKey} tabIndex={0}>
      <header className="game-header">
        <button className="round-icon" type="button" onClick={() => setScreen("start")} aria-label="返回首页"><img src="/art/ui-home.png" alt="" /></button>
        <div className="level-title"><span>{chapter.name}</span><strong>第 {levelIndex + 1} 关</strong></div>
        <div className="header-actions">
          <button className="round-icon" type="button" onClick={() => setScreen("map")} aria-label="选择关卡"><img src="/art/ui-star.png" alt="" /></button>
          <button className="round-icon" type="button" onClick={() => setShowWardrobe(true)} aria-label="打开衣橱"><img src="/art/wardrobe.png" alt="" /></button>
        </div>
      </header>

      <section className="game-stage">
        <div className="stage-heading">
          <div><span>{chapter.range}关主题 · 难度 {"★".repeat(level.difficulty)}</span><h2>{level.name}</h2></div>
          <div className="move-stats">
            <span>宝箱 <b>{level.boxes.length}</b></span>
            <span>步数 <b>{currentState.moves}</b></span>
            <span>推箱 <b>{currentState.pushes}</b></span>
          </div>
          </div>
          <div className="board-frame" onPointerDown={(event) => setGesture({ x: event.clientX, y: event.clientY })} onPointerUp={onPointerUp}>
            {integratedBoardMode ? <div className="integrated-board-art" aria-hidden="true" /> : null}
            <div className="board-grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {visibleCells.map((cell) => (
              <div
                key={`${cell.x}-${cell.y}`}
                className={[
                  "tile",
                  cell.isWall && cell.isBorder ? "wall border-wall" : "floor",
                  cell.isWall && !cell.isBorder ? "internal-wall" : "",
                  cell.isGoal ? "goal" : "",
                  cell.isBox && cell.isGoal ? "box-complete" : "",
                  cell.isBox ? "has-box" : "",
                  cell.isPlayer ? "has-player" : "",
                ].filter(Boolean).join(" ")}
                style={{ zIndex: cell.isPlayer || cell.isBox || (cell.isWall && !cell.isBorder) ? 20 + cell.y : undefined }}
              >
                {cell.isWall && !cell.isBorder ? (
                  <img
                    className="obstacle-prop"
                    src={`${chapterAssetBase}/${obstacleNames[(cell.x * 3 + cell.y + chapterIndex) % obstacleNames.length]}.png`}
                    alt=""
                  />
                ) : null}
                {cell.isBox ? <span className="crate" /> : null}
                {cell.isPlayer ? <Character outfit={outfit} direction={direction} action={action} className="board-character" /> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="game-toolbar">
          <button type="button" onClick={undoMove}><span>↶</span>撤销</button>
          <button type="button" onClick={() => resetLevel(levelIndex)}><img src="/art/ui-restart.png" alt="" />重来</button>
          <button type="button" onClick={() => setShowWardrobe(true)}><img src="/art/wardrobe.png" alt="" />换装</button>
        </div>
        <div className="touch-pad" aria-label="方向控制">
          <i /><button type="button" onClick={() => playMove(0, -1)} aria-label="向上">▲</button><i />
          <button type="button" onClick={() => playMove(-1, 0)} aria-label="向左">◀</button>
          <button type="button" onClick={() => playMove(0, 1)} aria-label="向下">▼</button>
          <button type="button" onClick={() => playMove(1, 0)} aria-label="向右">▶</button>
        </div>
      </section>

      <footer className="progress-footer"><span>衣橱旅程</span><div><i style={{ width: `${completion}%` }} /></div><strong>{completedLevel}/50</strong></footer>

      {showWardrobe ? (
        <div className="modal-backdrop" onClick={() => setShowWardrobe(false)}>
          <section className="wardrobe-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowWardrobe(false)}>×</button>
            <div className="wardrobe-scene">
              <img src="/art/wardrobe.png" alt="" />
              <Character outfit={outfit} direction="down" action="idle" className="wardrobe-character" />
              <div><span>当前穿搭</span><strong>{outfit.name}</strong></div>
            </div>
            <div className="outfit-grid">
              {outfits.map((item) => {
                const isUnlocked = unlocked.includes(item.id);
                const isActive = selectedOutfit === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`${isActive ? "active" : ""} ${isUnlocked ? "" : "locked"}`}
                    onClick={() => {
                      if (!isUnlocked) return;
                      setSelectedOutfit(item.id);
                      setShowWardrobe(false);
                    }}
                  >
                    <img src={item.asset} alt={item.name} />
                    {!isUnlocked ? <span><img src="/art/ui-lock.png" alt="" />第{item.unlockAt}关</span> : null}
                    <strong>{item.name}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {showResult ? (
        <div className="modal-backdrop result-backdrop">
          <section className="result-card">
            <div className="result-illustration"><img src="/art/girl-celebrate.png" alt="" /></div>
            <div className="result-stars">★ ★ ★</div>
            <h2>{levelIndex === 49 ? "皇冠终章完成！" : "通关成功！"}</h2>
            <p>星光已经收进衣橱，继续寻找下一套漂亮裙子吧。</p>
            <button className="primary-button" type="button" onClick={() => levelIndex === 49 ? setScreen("map") : resetLevel(levelIndex + 1)}>{levelIndex === 49 ? "查看全部关卡" : "下一关"}</button>
            <button className="text-button" type="button" onClick={() => setShowResult(false)}>留在本关</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
