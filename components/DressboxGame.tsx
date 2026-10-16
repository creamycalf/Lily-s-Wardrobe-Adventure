"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, TouchEvent as ReactTouchEvent } from "react";
import { calculateStars, createInitialState, generateLevels, isSolved, moveState, stateToCells, type GameState } from "../lib/sokoban";
import { GameAudioEngine } from "../lib/game-audio";
import { authenticateHykb, exitNativeGame, releaseHykb } from "../lib/platform-compliance";

const TOTAL_LEVELS = 100;
const STORAGE_KEY = "lilys-wardrobe-adventure-production-v2";
const PRIVACY_CONSENT_KEY = "lily-privacy-consent-2026-10-14";
const SWIPE_THRESHOLD = 24;

type PrivacyConsent = "required" | "accepted" | "refused";
type AntiAddictionState = "idle" | "authenticating" | "ready" | "blocked";

type SwipeDirection = { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | null;

function resolveSwipeDirection(dx: number, dy: number): SwipeDirection {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return null;
  if (Math.abs(dx) > Math.abs(dy)) return { dx: dx > 0 ? 1 : -1, dy: 0 };
  return { dx: 0, dy: dy > 0 ? 1 : -1 };
}

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
  { id: "sapphire", name: "蓝宝石骑士礼裙", unlockAt: 45, asset: "/art/outfit-sapphire.png", color: "#315fc1", boardFilter: "hue-rotate(198deg) saturate(1.2) brightness(.9)" },
  { id: "winter", name: "冬日红斗篷", unlockAt: 50, asset: "/art/outfit-winter.png", color: "#ca4a58", boardFilter: "hue-rotate(323deg) saturate(1.45) brightness(.86)" },
  { id: "swan", name: "白天鹅舞会礼裙", unlockAt: 55, asset: "/art/outfit-swan.png", color: "#e9e4d8", boardFilter: "saturate(.3) brightness(1.15)" },
  { id: "starlight", name: "星空魔法裙", unlockAt: 60, asset: "/art/outfit-starlight.png", color: "#243d85", boardFilter: "hue-rotate(188deg) saturate(1.4) brightness(.65)" },
  { id: "phoenix", name: "霞光凤凰礼裙", unlockAt: 65, asset: "/art/outfit-phoenix.png", color: "#f58b5c", boardFilter: "hue-rotate(335deg) saturate(1.25) brightness(1.08)" },
  { id: "crown", name: "皇冠终章礼服", unlockAt: 70, asset: "/art/outfit-crown.png", color: "#f0cf99", boardFilter: "sepia(.55) saturate(.85) brightness(1.08)" },
  { id: "navigator", name: "云海航行礼服", unlockAt: 75, asset: "/art/outfit-navigator.png", color: "#55cbd5", boardFilter: "hue-rotate(175deg) saturate(1.05) brightness(1.02)" },
  { id: "crystal", name: "云晶羽翼礼裙", unlockAt: 80, asset: "/art/outfit-crystal.png", color: "#8ddbea", boardFilter: "hue-rotate(170deg) saturate(.9) brightness(1.12)" },
  { id: "wisteria", name: "紫藤梦境礼裙", unlockAt: 85, asset: "/art/outfit-wisteria.png", color: "#c8a9e8", boardFilter: "hue-rotate(245deg) saturate(.65) brightness(1.1)" },
  { id: "roseclock", name: "时光玫瑰礼服", unlockAt: 90, asset: "/art/outfit-roseclock.png", color: "#c85a7a", boardFilter: "hue-rotate(325deg) saturate(1.15) brightness(.94)" },
  { id: "aurora", name: "极光女王礼服", unlockAt: 95, asset: "/art/outfit-aurora.png", color: "#3aa8bd", boardFilter: "hue-rotate(190deg) saturate(1.2) brightness(.92)" },
  { id: "eternal", name: "永恒星冠礼服", unlockAt: 100, asset: "/art/outfit-eternal.png", color: "#6650b9", boardFilter: "hue-rotate(225deg) saturate(1.12) brightness(.9)" },
] as const;

const chapters = [
  { name: "阳光玩具房", range: "1—10", className: "theme-toy", background: "/art-v2/backgrounds/chapter-01-toy-room.png", board: "/art-v2/scene-board-agent-test.png", grid: { left: "50%", top: "49.15%", width: "68.5%", height: "44.77%", rows: "48.8fr 48.4fr 50.4fr 52.5fr 54.6fr 55.9fr 65.5fr" } },
  { name: "草莓茶会厅", range: "11—20", className: "theme-tea", background: "/art-v2/backgrounds/chapter-02-tea-room.png", board: "/art-v3/scene-board-chapter-02.png", grid: { left: "50%", top: "49.2%", width: "68%", height: "42.8%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "秘密花园房", range: "21—30", className: "theme-garden", background: "/art-v2/backgrounds/chapter-03-garden-room.png", board: "/art-v3/scene-board-chapter-03.png", grid: { left: "50%", top: "49%", width: "69%", height: "44.8%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "月光魔法阁楼", range: "31—40", className: "theme-moon", background: "/art-v2/backgrounds/chapter-04-moon-attic.png", board: "/art-v3/scene-board-chapter-04.png", grid: { left: "50%", top: "50.7%", width: "64%", height: "42.3%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "皇家衣帽间", range: "41—50", className: "theme-royal", background: "/art-v2/backgrounds/chapter-05-royal-wardrobe.png", board: "/art-v3/scene-board-chapter-05.png", grid: { left: "50%", top: "56.1%", width: "70%", height: "43.7%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "星辉舞会厅", range: "51—60", className: "theme-starlight", background: "/art-v2/backgrounds/chapter-04-moon-attic.png", board: "/art-v3/scene-board-chapter-04.png", grid: { left: "50%", top: "50.7%", width: "64%", height: "42.3%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "皇冠秘密宝库", range: "61—70", className: "theme-crown", background: "/art-v2/backgrounds/chapter-05-royal-wardrobe.png", board: "/art-v3/scene-board-chapter-05.png", grid: { left: "50%", top: "56.1%", width: "70%", height: "43.7%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "云端水晶宫", range: "71—80", className: "theme-crystal", background: "/art-v2/backgrounds/chapter-03-garden-room.png", board: "/art-v3/scene-board-chapter-03.png", grid: { left: "50%", top: "49%", width: "69%", height: "44.8%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "时光玫瑰长廊", range: "81—90", className: "theme-roseclock", background: "/art-v2/backgrounds/chapter-04-moon-attic.png", board: "/art-v3/scene-board-chapter-04.png", grid: { left: "50%", top: "50.7%", width: "64%", height: "42.3%", rows: "repeat(7, minmax(0, 1fr))" } },
  { name: "永恒星冠殿", range: "91—100", className: "theme-eternal", background: "/art-v2/backgrounds/chapter-05-royal-wardrobe.png", board: "/art-v3/scene-board-chapter-05.png", grid: { left: "50%", top: "56.1%", width: "70%", height: "43.7%", rows: "repeat(7, minmax(0, 1fr))" } },
] as const;

// The painted boards use a shallow camera perspective: lower rows are wider
// than upper rows. The transparent interaction grid needs the same spread so
// sprites land on the painted cell centres instead of only the logical ones.
const BOARD_ROW_SCALES_BY_ASSET = [
  [1, 1.01, 1.025, 1.05, 1.08, 1.1, 1.12],
  [0.968, 0.954, 1.012, 1.023, 1.043, 1.063, 1.086],
  [0.963, 0.98, 1, 1.022, 1.037, 1.053, 1.076],
  [1.005, 1.023, 1.041, 1.063, 1.084, 1.087, 1.111],
  [0.982, 1.002, 1.023, 1.039, 1.059, 1.086, 1.11],
] as const;

const BOARD_GRID_BY_ASSET = [
  null,
  { left: "50%", top: "48.55%", width: "68%", height: "43.82%", rows: "99fr 86fr 89fr 94fr 96fr 100fr 109fr" },
  { left: "50%", top: "48.8%", width: "69%", height: "44.47%", rows: "89fr 89fr 92fr 97fr 99fr 104fr 110fr" },
  { left: "50%", top: "50.68%", width: "64%", height: "41.86%", rows: "82fr 84fr 88fr 91fr 94fr 98fr 106fr" },
  { left: "51.42%", top: "55.47%", width: "66.4%", height: "44.79%", rows: "100fr 89fr 91fr 96fr 100fr 105fr 107fr" },
] as const;

const CHAPTER_ASSET_INDEXES = [0, 1, 2, 3, 4, 3, 4, 2, 3, 4] as const;

const obstacleNames = ["padded-block", "teddy", "rocking-horse"] as const;

type Outfit = (typeof outfits)[number];
type Direction = "up" | "down" | "left" | "right";
type Action = "idle" | "walk" | "push";
type Screen = "start" | "game" | "map";
type Snapshot = GameState & { levelIndex: number };

type CharacterFrameSet = Record<Direction, Record<Action, string[]>>;

function generatedOutfitFrames(id: string): CharacterFrameSet {
  const frames = (direction: Direction) => ({
    idle: [`/art-v3/characters/${id}/${direction}/idle-01.png`],
    walk: [`/art-v3/characters/${id}/${direction}/walk-01.png`],
    push: [`/art-v3/characters/${id}/${direction}/push-01.png`],
  });
  return {
    down: frames("down"),
    up: frames("up"),
    left: frames("left"),
    right: frames("right"),
  };
}

// Keep board character paths in one manifest. The current committed art has
// The board uses normalized idle, walk and push frames with a shared foot
// baseline. Adding more animation frames later only requires extending these
// arrays, not changing the renderer or input code.
const characterManifest: Record<string, CharacterFrameSet> = {
  rose: {
    down: {
      idle: ["/art-v2/character-topdown/rose-down.png"],
      walk: ["/art-v3/characters/rose/down/walk-01.png"],
      push: ["/art-v3/characters/rose/down/push-01.png"],
    },
    up: {
      idle: ["/art-v2/character-topdown/rose-up.png"],
      walk: ["/art-v3/characters/rose/up/walk-01.png"],
      push: ["/art-v3/characters/rose/up/push-01.png"],
    },
    left: {
      idle: ["/art-v2/character-topdown/rose-left.png"],
      walk: ["/art-v3/characters/rose/left/walk-01.png"],
      push: ["/art-v3/characters/rose/left/push-01.png"],
    },
    right: {
      idle: ["/art-v2/character-topdown/rose-right.png"],
      walk: ["/art-v3/characters/rose/right/walk-01.png"],
      push: ["/art-v3/characters/rose/right/push-01.png"],
    },
  },
  bakery: {
    down: {
      idle: ["/art-v3/characters/bakery/down/idle-01.png"],
      walk: ["/art-v3/characters/bakery/down/walk-01.png"],
      push: ["/art-v3/characters/bakery/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/bakery/up/idle-01.png"],
      walk: ["/art-v3/characters/bakery/up/walk-01.png"],
      push: ["/art-v3/characters/bakery/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/bakery/left/idle-01.png"],
      walk: ["/art-v3/characters/bakery/left/walk-01.png"],
      push: ["/art-v3/characters/bakery/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/bakery/right/idle-01.png"],
      walk: ["/art-v3/characters/bakery/right/walk-01.png"],
      push: ["/art-v3/characters/bakery/right/push-01.png"],
    },
  },
  garden: {
    down: {
      idle: ["/art-v3/characters/garden/down/idle-01.png"],
      walk: ["/art-v3/characters/garden/down/walk-01.png"],
      push: ["/art-v3/characters/garden/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/garden/up/idle-01.png"],
      walk: ["/art-v3/characters/garden/up/walk-01.png"],
      push: ["/art-v3/characters/garden/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/garden/left/idle-01.png"],
      walk: ["/art-v3/characters/garden/left/walk-01.png"],
      push: ["/art-v3/characters/garden/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/garden/right/idle-01.png"],
      walk: ["/art-v3/characters/garden/right/walk-01.png"],
      push: ["/art-v3/characters/garden/right/push-01.png"],
    },
  },
  pearl: {
    down: {
      idle: ["/art-v3/characters/pearl/down/idle-01.png"],
      walk: ["/art-v3/characters/pearl/down/walk-01.png"],
      push: ["/art-v3/characters/pearl/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/pearl/up/idle-01.png"],
      walk: ["/art-v3/characters/pearl/up/walk-01.png"],
      push: ["/art-v3/characters/pearl/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/pearl/left/idle-01.png"],
      walk: ["/art-v3/characters/pearl/left/walk-01.png"],
      push: ["/art-v3/characters/pearl/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/pearl/right/idle-01.png"],
      walk: ["/art-v3/characters/pearl/right/walk-01.png"],
      push: ["/art-v3/characters/pearl/right/push-01.png"],
    },
  },
  berry: {
    down: {
      idle: ["/art-v3/characters/berry/down/idle-01.png"],
      walk: ["/art-v3/characters/berry/down/walk-01.png"],
      push: ["/art-v3/characters/berry/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/berry/up/idle-01.png"],
      walk: ["/art-v3/characters/berry/up/walk-01.png"],
      push: ["/art-v3/characters/berry/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/berry/left/idle-01.png"],
      walk: ["/art-v3/characters/berry/left/walk-01.png"],
      push: ["/art-v3/characters/berry/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/berry/right/idle-01.png"],
      walk: ["/art-v3/characters/berry/right/walk-01.png"],
      push: ["/art-v3/characters/berry/right/push-01.png"],
    },
  },
  violet: {
    down: {
      idle: ["/art-v3/characters/violet/down/idle-01.png"],
      walk: ["/art-v3/characters/violet/down/walk-01.png"],
      push: ["/art-v3/characters/violet/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/violet/up/idle-01.png"],
      walk: ["/art-v3/characters/violet/up/walk-01.png"],
      push: ["/art-v3/characters/violet/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/violet/left/idle-01.png"],
      walk: ["/art-v3/characters/violet/left/walk-01.png"],
      push: ["/art-v3/characters/violet/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/violet/right/idle-01.png"],
      walk: ["/art-v3/characters/violet/right/walk-01.png"],
      push: ["/art-v3/characters/violet/right/push-01.png"],
    },
  },
  ice: {
    down: {
      idle: ["/art-v3/characters/ice/down/idle-01.png"],
      walk: ["/art-v3/characters/ice/down/walk-01.png"],
      push: ["/art-v3/characters/ice/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/ice/up/idle-01.png"],
      walk: ["/art-v3/characters/ice/up/walk-01.png"],
      push: ["/art-v3/characters/ice/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/ice/left/idle-01.png"],
      walk: ["/art-v3/characters/ice/left/walk-01.png"],
      push: ["/art-v3/characters/ice/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/ice/right/idle-01.png"],
      walk: ["/art-v3/characters/ice/right/walk-01.png"],
      push: ["/art-v3/characters/ice/right/push-01.png"],
    },
  },
  moon: {
    down: {
      idle: ["/art-v3/characters/moon/down/idle-01.png"],
      walk: ["/art-v3/characters/moon/down/walk-01.png"],
      push: ["/art-v3/characters/moon/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/moon/up/idle-01.png"],
      walk: ["/art-v3/characters/moon/up/walk-01.png"],
      push: ["/art-v3/characters/moon/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/moon/left/idle-01.png"],
      walk: ["/art-v3/characters/moon/left/walk-01.png"],
      push: ["/art-v3/characters/moon/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/moon/right/idle-01.png"],
      walk: ["/art-v3/characters/moon/right/walk-01.png"],
      push: ["/art-v3/characters/moon/right/push-01.png"],
    },
  },
  autumn: {
    down: {
      idle: ["/art-v3/characters/autumn/down/idle-01.png"],
      walk: ["/art-v3/characters/autumn/down/walk-01.png"],
      push: ["/art-v3/characters/autumn/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/autumn/up/idle-01.png"],
      walk: ["/art-v3/characters/autumn/up/walk-01.png"],
      push: ["/art-v3/characters/autumn/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/autumn/left/idle-01.png"],
      walk: ["/art-v3/characters/autumn/left/walk-01.png"],
      push: ["/art-v3/characters/autumn/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/autumn/right/idle-01.png"],
      walk: ["/art-v3/characters/autumn/right/walk-01.png"],
      push: ["/art-v3/characters/autumn/right/push-01.png"],
    },
  },
  winter: {
    down: {
      idle: ["/art-v3/characters/winter/down/idle-01.png"],
      walk: ["/art-v3/characters/winter/down/walk-01.png"],
      push: ["/art-v3/characters/winter/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/winter/up/idle-01.png"],
      walk: ["/art-v3/characters/winter/up/walk-01.png"],
      push: ["/art-v3/characters/winter/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/winter/left/idle-01.png"],
      walk: ["/art-v3/characters/winter/left/walk-01.png"],
      push: ["/art-v3/characters/winter/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/winter/right/idle-01.png"],
      walk: ["/art-v3/characters/winter/right/walk-01.png"],
      push: ["/art-v3/characters/winter/right/push-01.png"],
    },
  },
  starlight: {
    down: {
      idle: ["/art-v3/characters/starlight/down/idle-01.png"],
      walk: ["/art-v3/characters/starlight/down/walk-01.png"],
      push: ["/art-v3/characters/starlight/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/starlight/up/idle-01.png"],
      walk: ["/art-v3/characters/starlight/up/walk-01.png"],
      push: ["/art-v3/characters/starlight/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/starlight/left/idle-01.png"],
      walk: ["/art-v3/characters/starlight/left/walk-01.png"],
      push: ["/art-v3/characters/starlight/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/starlight/right/idle-01.png"],
      walk: ["/art-v3/characters/starlight/right/walk-01.png"],
      push: ["/art-v3/characters/starlight/right/push-01.png"],
    },
  },
  crown: {
    down: {
      idle: ["/art-v3/characters/crown/down/idle-01.png"],
      walk: ["/art-v3/characters/crown/down/walk-01.png"],
      push: ["/art-v3/characters/crown/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/crown/up/idle-01.png"],
      walk: ["/art-v3/characters/crown/up/walk-01.png"],
      push: ["/art-v3/characters/crown/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/crown/left/idle-01.png"],
      walk: ["/art-v3/characters/crown/left/walk-01.png"],
      push: ["/art-v3/characters/crown/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/crown/right/idle-01.png"],
      walk: ["/art-v3/characters/crown/right/walk-01.png"],
      push: ["/art-v3/characters/crown/right/push-01.png"],
    },
  },
  crystal: {
    down: {
      idle: ["/art-v3/characters/crystal/down/idle-01.png"],
      walk: ["/art-v3/characters/crystal/down/walk-01.png"],
      push: ["/art-v3/characters/crystal/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/crystal/up/idle-01.png"],
      walk: ["/art-v3/characters/crystal/up/walk-01.png"],
      push: ["/art-v3/characters/crystal/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/crystal/left/idle-01.png"],
      walk: ["/art-v3/characters/crystal/left/walk-01.png"],
      push: ["/art-v3/characters/crystal/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/crystal/right/idle-01.png"],
      walk: ["/art-v3/characters/crystal/right/walk-01.png"],
      push: ["/art-v3/characters/crystal/right/push-01.png"],
    },
  },
  roseclock: {
    down: {
      idle: ["/art-v3/characters/roseclock/down/idle-01.png"],
      walk: ["/art-v3/characters/roseclock/down/walk-01.png"],
      push: ["/art-v3/characters/roseclock/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/roseclock/up/idle-01.png"],
      walk: ["/art-v3/characters/roseclock/up/walk-01.png"],
      push: ["/art-v3/characters/roseclock/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/roseclock/left/idle-01.png"],
      walk: ["/art-v3/characters/roseclock/left/walk-01.png"],
      push: ["/art-v3/characters/roseclock/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/roseclock/right/idle-01.png"],
      walk: ["/art-v3/characters/roseclock/right/walk-01.png"],
      push: ["/art-v3/characters/roseclock/right/push-01.png"],
    },
  },
  eternal: {
    down: {
      idle: ["/art-v3/characters/eternal/down/idle-01.png"],
      walk: ["/art-v3/characters/eternal/down/walk-01.png"],
      push: ["/art-v3/characters/eternal/down/push-01.png"],
    },
    up: {
      idle: ["/art-v3/characters/eternal/up/idle-01.png"],
      walk: ["/art-v3/characters/eternal/up/walk-01.png"],
      push: ["/art-v3/characters/eternal/up/push-01.png"],
    },
    left: {
      idle: ["/art-v3/characters/eternal/left/idle-01.png"],
      walk: ["/art-v3/characters/eternal/left/walk-01.png"],
      push: ["/art-v3/characters/eternal/left/push-01.png"],
    },
    right: {
      idle: ["/art-v3/characters/eternal/right/idle-01.png"],
      walk: ["/art-v3/characters/eternal/right/walk-01.png"],
      push: ["/art-v3/characters/eternal/right/push-01.png"],
    },
  },
  sapphire: generatedOutfitFrames("sapphire"),
  swan: generatedOutfitFrames("swan"),
  phoenix: generatedOutfitFrames("phoenix"),
  navigator: generatedOutfitFrames("navigator"),
  wisteria: generatedOutfitFrames("wisteria"),
  aurora: generatedOutfitFrames("aurora"),
};

function clampLevel(index: number) {
  return Math.max(0, Math.min(TOTAL_LEVELS - 1, index));
}

function playerAsset(outfit: Outfit, direction: Direction, action: Action, boardMode = false, frameIndex = 0) {
  // The board uses the compact four-view set: it has a shared foot baseline
  // and a consistent camera, unlike the much taller portrait renders.
  if (boardMode) {
    const directionFrames = (characterManifest[outfit.id] ?? characterManifest.rose)[direction];
    const frames = directionFrames[action].length ? directionFrames[action] : directionFrames.idle;
    return frames[frameIndex % frames.length];
  }
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

function Character({ outfit, direction, action, frameIndex = 0, className = "" }: {
  outfit: Outfit;
  direction: Direction;
  action: Action;
  frameIndex?: number;
  className?: string;
}) {
  const boardMode = className.split(" ").includes("board-character");
  const portraitDirection = !boardMode && outfit.id !== "rose" ? `portrait-direction direction-${direction}` : "";
  const frameSrc = playerAsset(outfit, direction, action, boardMode, frameIndex);
  const characterClass = `character ${className} outfit-${outfit.id} action-${action} ${portraitDirection}`;

  // Until an outfit has its own board sprites, tint only the lower clothing
  // layer. The unfiltered base image keeps Lily's hair, face and skin stable.
  if (boardMode && outfit.id !== "rose" && !characterManifest[outfit.id]) {
      return (
        <span
          className={`board-character board-character-shell outfit-${outfit.id} action-${action}`}
        style={{ "--character-filter": outfit.boardFilter } as CSSProperties}
        aria-hidden="true"
      >
        <img className="character board-character-layer board-character-base" src={frameSrc} alt="" draggable={false} />
        <img className="character board-character-layer board-character-tint" src={frameSrc} alt="" draggable={false} />
      </span>
    );
  }

  return <img className={characterClass} src={frameSrc} alt="" draggable={false} />;
}

function WardrobeModal({ outfit, selectedOutfit, accessibleOutfits, onSelect, onClose }: {
  outfit: Outfit;
  selectedOutfit: string;
  accessibleOutfits: string[];
  onSelect: (outfitId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="wardrobe-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭衣橱">×</button>
        <div className="wardrobe-scene">
          <img src="/art/wardrobe.png" alt="" />
          <Character outfit={outfit} direction="down" action="idle" className="wardrobe-character" />
          <div><span>当前穿搭</span><strong>{outfit.name}</strong></div>
        </div>
        <div className="outfit-grid">
          {outfits.map((item) => {
            const isUnlocked = accessibleOutfits.includes(item.id);
            const isActive = selectedOutfit === item.id;
            return (
              <button
                type="button"
                key={item.id}
                className={`${isActive ? "active" : ""} ${isUnlocked ? "" : "locked"}`}
                onClick={() => isUnlocked && onSelect(item.id)}
                aria-label={isUnlocked ? `换上${item.name}` : `${item.name}，第${item.unlockAt}关解锁`}
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
  );
}

export default function DressboxGame() {
  const levels = useMemo(() => generateLevels(TOTAL_LEVELS), []);
  const qaLevel = useMemo(() => {
    // Local visual QA can address every level without rebuilding the app one
    // hundred times. The query parameter is deliberately ignored outside a
    // local preview so it cannot unlock levels in production packages.
    const localQaLevel = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? new URLSearchParams(window.location.search).get("qaLevel")
      : null;
    const configured = localQaLevel ?? import.meta.env.VITE_QA_LEVEL;
    if (typeof configured !== "string" || !configured) return null;
    const requestedLevel = Number(configured);
    return Number.isFinite(requestedLevel) ? clampLevel(requestedLevel - 1) : null;
  }, []);
  const initialLevel = qaLevel ?? 0;
  const initialOutfit = qaLevel === null
    ? "rose"
    : [...outfits].reverse().find((item) => item.unlockAt <= qaLevel + 1)?.id ?? "rose";
  const [screen, setScreen] = useState<Screen>(qaLevel === null ? "start" : "game");
  const [mapChapter, setMapChapter] = useState<number | null>(null);
  const [levelIndex, setLevelIndex] = useState(initialLevel);
  const [currentState, setCurrentState] = useState<Snapshot>(() => ({ ...createInitialState(levels[initialLevel]), levelIndex: initialLevel }));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [completedLevel, setCompletedLevel] = useState(0);
  const [levelStars, setLevelStars] = useState<number[]>(() => Array.from({ length: TOTAL_LEVELS }, () => 0));
  const [resultStars, setResultStars] = useState(0);
  const [selectedOutfit, setSelectedOutfit] = useState<string>(initialOutfit);
  const [unlocked, setUnlocked] = useState<string[]>(["rose"]);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [action, setAction] = useState<Action>("idle");
  const [actionFrameIndex, setActionFrameIndex] = useState(0);
  const gestureRef = useRef<{ x: number; y: number } | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<GameAudioEngine | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Production always opens with the compliance dialog. The stored consent is
  // retained as an audit/version marker, but never hides the next launch prompt.
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsent>(qaLevel === null ? "required" : "accepted");
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [showAgeGuide, setShowAgeGuide] = useState(false);
  const [antiAddictionState, setAntiAddictionState] = useState<AntiAddictionState>(qaLevel === null ? "idle" : "ready");
  const [antiAddictionMessage, setAntiAddictionMessage] = useState("");
  const [antiAddictionAttempt, setAntiAddictionAttempt] = useState(0);
  const chapterIndex = Math.min(chapters.length - 1, Math.floor(levelIndex / 10));

  useEffect(() => () => {
    if (actionTimer.current) clearTimeout(actionTimer.current);
  }, []);

  useEffect(() => {
    const audio = new GameAudioEngine();
    audioRef.current = audio;
    return () => {
      audio.dispose();
      audioRef.current = null;
      void releaseHykb();
    };
  }, []);

  useEffect(() => {
    if (qaLevel !== null || privacyConsent !== "accepted") return;
    let active = true;
    // Authentication is an external native operation; reflect its pending
    // state before awaiting the platform callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAntiAddictionState("authenticating");
    authenticateHykb()
      .then((result) => {
        if (!active) return;
        if (result.allowed) {
          setAntiAddictionMessage("");
          setAntiAddictionState("ready");
        } else {
          setAntiAddictionMessage(result.message ?? `防沉迷校验未通过（${result.code ?? "未知错误"}）。`);
          setAntiAddictionState("blocked");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAntiAddictionMessage(error instanceof Error ? error.message : "防沉迷服务暂时不可用，请检查网络后重试。");
        setAntiAddictionState("blocked");
      });
    return () => { active = false; };
  }, [antiAddictionAttempt, privacyConsent, qaLevel]);

  // Try to start the ambient music as soon as the home screen mounts. Browsers
  // may keep the AudioContext suspended until a gesture, so startGame and the
  // first touch also call start() as the policy-compliant fallback.
  useEffect(() => {
    audioRef.current?.setChapter(chapterIndex);
    if (screen === "start" && privacyConsent === "accepted" && antiAddictionState === "ready") audioRef.current?.start(0);
  }, [antiAddictionState, chapterIndex, privacyConsent, screen]);

  const level = levels[levelIndex];
  const outfit = outfits.find((item) => item.id === selectedOutfit) ?? outfits[0];
  const cells = useMemo(() => stateToCells(level, currentState), [level, currentState]);
  // The generated level keeps a one-cell wall ring for collision detection.
  // It is not part of the painted seven-by-seven board, so never give those
  // logical border cells visual grid tracks.
  const visibleCells = useMemo(
    () => cells.slice(1, -1).flatMap((row) => row.slice(1, -1)).map((cell) => ({
      ...cell,
      visualX: cell.x - 1,
      visualY: cell.y - 1,
    })),
    [cells],
  );
  const chapter = chapters[chapterIndex];
  const chapterAssetIndex = CHAPTER_ASSET_INDEXES[chapterIndex] ?? 4;
  const measuredGrid = BOARD_GRID_BY_ASSET[chapterAssetIndex] ?? chapter.grid;
  const integratedBoardMode = true;
  const chapterAssetBase = `/art-v2/objects/chapter-${String(chapterAssetIndex + 1).padStart(2, "0")}`;
  const accessibleCompletedLevel = completedLevel;
  const accessibleOutfits = unlocked;
  const totalStars = levelStars.reduce((total, stars) => total + stars, 0);
  const completion = Math.round((accessibleCompletedLevel / TOTAL_LEVELS) * 100);
  const journeyChapter = Math.min(chapters.length - 1, Math.floor(Math.max(accessibleCompletedLevel, levelIndex) / 10));

  useEffect(() => {
    if (qaLevel !== null) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as { levelIndex?: number; selectedOutfit?: string; unlocked?: string[]; completedLevel?: number; levelStars?: number[] };
      const savedCompletedLevel = Math.max(0, Math.min(TOTAL_LEVELS, save.completedLevel ?? 0));
      // Older saves could point at any level in an unlocked chapter. Keep the
      // resume point inside the sequentially cleared range during migration.
      const nextLevel = Math.min(clampLevel(save.levelIndex ?? 0), Math.min(TOTAL_LEVELS - 1, savedCompletedLevel));
      // This is an intentional hydration-time restore from localStorage. Keep
      // it in an effect so the server's first render matches the client shell.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLevelIndex(nextLevel);
      setCurrentState({ ...createInitialState(levels[nextLevel]), levelIndex: nextLevel });
      const allowedOutfits = outfits.filter((item) => item.unlockAt <= savedCompletedLevel).map((item) => item.id);
      const safeUnlocked = Array.from(new Set(["rose", ...allowedOutfits]));
      setSelectedOutfit(safeUnlocked.includes(save.selectedOutfit ?? "") ? save.selectedOutfit ?? "rose" : "rose");
      setUnlocked(safeUnlocked);
      setCompletedLevel(savedCompletedLevel);
      setLevelStars(Array.from({ length: TOTAL_LEVELS }, (_, index) => {
        const savedStars = save.levelStars?.[index];
        if (Number.isFinite(savedStars)) return Math.max(0, Math.min(3, Math.floor(savedStars!)));
        // Old saves only knew whether a level was cleared. Preserve that work
        // as one star and let replaying the level improve the result.
        return index < savedCompletedLevel ? 1 : 0;
      }));
    } catch {
      // Ignore damaged local saves.
    }
  }, [levels, qaLevel]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ levelIndex, selectedOutfit, unlocked, completedLevel, levelStars }));
  }, [levelIndex, selectedOutfit, unlocked, completedLevel, levelStars]);

  useEffect(() => {
    if (screen !== "game") return;
    const frame = window.requestAnimationFrame(() => gameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [screen, levelIndex]);

  function resetLevel(nextIndex = levelIndex, nextScreen: Screen = "game") {
    audioRef.current?.start(chapterIndex);
    const target = clampLevel(nextIndex);
    setLevelIndex(target);
    setCurrentState({ ...createInitialState(levels[target]), levelIndex: target });
    setHistory([]);
    setShowResult(false);
    setResultStars(0);
    setDirection("right");
    setAction("idle");
    setActionFrameIndex(0);
    setScreen(nextScreen);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }

  function animate(nextAction: "walk" | "push") {
    setAction(nextAction);
    setActionFrameIndex((frame) => frame + 1);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => setAction("idle"), 220);
  }

  function playMove(dx: number, dy: number) {
    if (screen !== "game" || showWardrobe || showResult) return;
    const nextDirection = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    setDirection(nextDirection);
    const next = moveState(level, currentState, dx, dy);
    if (!next) return;
    const pushed = next.pushes > currentState.pushes;
    audioRef.current?.move(pushed);
    animate(pushed ? "push" : "walk");
    setHistory((items) => [...items, currentState]);
    const snapshot = { ...next, levelIndex };
    setCurrentState(snapshot);
    if (isSolved(level, snapshot.boxes)) {
      audioRef.current?.success();
      const earnedStars = calculateStars(level, snapshot.pushes, snapshot.moves);
      setResultStars(earnedStars);
      setLevelStars((ratings) => ratings.map((stars, index) => index === levelIndex ? Math.max(stars, earnedStars) : stars));
      const cleared = Math.max(completedLevel, levelIndex + 1);
      setCompletedLevel(cleared);
      setUnlocked(Array.from(new Set([...unlocked, ...outfits.filter((item) => item.unlockAt <= cleared).map((item) => item.id)])));
      setShowResult(true);
    }
  }

  function undoMove() {
    const previous = history.at(-1);
    if (!previous) return;
    audioRef.current?.undo();
    setCurrentState(previous);
    setHistory((items) => items.slice(0, -1));
    setShowResult(false);
    setAction("idle");
  }

  function acceptPrivacy() {
    window.localStorage.setItem(PRIVACY_CONSENT_KEY, "accepted");
    setShowPrivacyDetails(false);
    setPrivacyConsent("accepted");
    setAntiAddictionState("idle");
  }

  function refusePrivacy() {
    window.localStorage.removeItem(PRIVACY_CONSENT_KEY);
    setPrivacyConsent("refused");
    void exitNativeGame();
  }

  function retryAntiAddiction() {
    setAntiAddictionMessage("");
    setAntiAddictionAttempt((attempt) => attempt + 1);
  }

  function startGame() {
    if (privacyConsent !== "accepted" || antiAddictionState !== "ready") return;
    audioRef.current?.start(chapterIndex);
    setScreen("game");
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioRef.current?.setEnabled(next);
  }

  function selectOutfit(outfitId: string) {
    setSelectedOutfit(outfitId);
    setShowWardrobe(false);
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (screen !== "game" || showWardrobe) return;
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") playMove(0, -1);
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") playMove(0, 1);
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") playMove(-1, 0);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") playMove(1, 0);
    if (event.key.toLowerCase() === "z") undoMove();
  }

  function beginGesture(x: number, y: number) {
    if (gestureRef.current) return;
    gestureRef.current = { x, y };
  }

  function cancelGesture() {
    gestureRef.current = null;
  }

  function finishGesture(x: number, y: number) {
    const start = gestureRef.current;
    if (!start) return;
    gestureRef.current = null;
    const direction = resolveSwipeDirection(x - start.x, y - start.y);
    if (direction) playMove(direction.dx, direction.dy);
  }

  function onTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return;
    event.preventDefault();
    beginGesture(touch.clientX, touch.clientY);
  }

  function onTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    event.preventDefault();
    finishGesture(touch.clientX, touch.clientY);
  }

  function onTouchCancel(event: ReactTouchEvent<HTMLDivElement>) {
    event.preventDefault();
    cancelGesture();
  }

  const themeStyle = {
    "--accent": outfit.color,
    "--chapter-bg": `url("${chapter.background}")`,
    "--integrated-board-bg": `url("${chapter.board}")`,
    "--board-grid-left": measuredGrid.left,
    "--board-grid-top": measuredGrid.top,
    "--board-grid-width": measuredGrid.width,
    "--board-grid-height": measuredGrid.height,
    "--board-grid-rows": measuredGrid.rows,
    "--character-filter": outfit.boardFilter,
    "--tile-floor": `url("${chapterAssetBase}/floor-cream.png")`,
    "--tile-goal": `url("${chapterAssetBase}/goal.png")`,
    "--tile-goal-lit": `url("${chapterAssetBase}/goal-lit.png")`,
    "--crate-art": integratedBoardMode
      ? 'url("/art-v3/objects-topdown/crate-centered.png")'
      : `url("${chapterAssetBase}/crate.png")`,
    "--internal-wall-art": integratedBoardMode
      ? 'url("/art-v2/objects-topdown/pink-block.png")'
      : "none",
  } as CSSProperties;

  if (privacyConsent !== "accepted" || antiAddictionState !== "ready") {
    const isAuthenticating = privacyConsent === "accepted" && antiAddictionState === "authenticating";
    const isBlocked = privacyConsent === "accepted" && antiAddictionState === "blocked";
    return (
      <main className="start-screen compliance-screen">
        <div className="start-art" />
        <div className="start-copy compliance-backdrop-copy" aria-hidden="true">
          <h1>莉莉的<br />衣橱冒险</h1>
          <p>把每一只宝箱推到星光位置，打开衣橱里珍藏的新裙子。</p>
          <button className="primary-button start-button" type="button" disabled>开始游戏</button>
        </div>
        <section className="compliance-modal" role="dialog" aria-modal="true" aria-labelledby="compliance-title">
          {privacyConsent === "required" ? (
            <>
              <div className="compliance-heading">
                <span className="age-badge" aria-label="适龄提示：8周岁以上">8+</span>
                <div><p>每次启动必读</p><h2 id="compliance-title">适龄提示与隐私保护</h2></div>
              </div>
              <div className="startup-age-copy">
                <strong>适龄提示：本游戏适合8周岁及以上用户。</strong>
                <span>游戏为卡通公主主题的单机推箱子解谜内容，不含付费、抽卡、赌博或陌生人社交。未成年人请在监护人指导下体验并合理安排游戏时间。</span>
              </div>
              {showPrivacyDetails ? (
                <div className="privacy-inline-details">
                  <h3>《莉莉的衣橱冒险》隐私政策摘要</h3>
                  <p>游戏在设备本地保存关卡进度、已解锁衣服、当前衣服和声音设置。卸载游戏或清除应用数据可删除这些本地数据。</p>
                  <p>3839安卓渠道版将在你同意后初始化“好游快爆开发者SDK（单机游戏防沉迷）”，由厦门纯游互动科技有限公司提供，用于实名认证、识别未成年人身份并执行游戏时段限制。</p>
                  <p>该SDK可能处理姓名、身份证号码、手机号码、AndroidID、OAID、IP地址、设备型号、系统版本、网络状态、运营商、屏幕信息、应用包名及签名信息。游戏无广告、无支付、无陌生人社交。</p>
                  <p>第三方隐私政策：https://m.3839.com/html/hykb-265.html</p>
                  <p>运营主体：魔杰工作室　联系邮箱：136417505@qq.com</p>
                  <button className="text-button" type="button" onClick={() => setShowPrivacyDetails(false)}>返回简要说明</button>
                </div>
              ) : (
                <p className="compliance-copy">
                  我们仅在本机保存游戏进度。你同意后，安卓渠道版才会初始化好游快爆实名认证及防沉迷服务；不同意将不会初始化SDK，也无法进入游戏。
                </p>
              )}
              <button className="privacy-detail-button" type="button" onClick={() => setShowPrivacyDetails((value) => !value)}>
                {showPrivacyDetails ? "收起隐私政策" : "查看完整说明与第三方清单"}
              </button>
              <div className="compliance-actions">
                <button className="secondary-button" type="button" onClick={refusePrivacy}>不同意并退出</button>
                <button className="primary-button" type="button" onClick={acceptPrivacy}>同意以上内容并继续</button>
              </div>
            </>
          ) : null}
          {privacyConsent === "refused" ? (
            <>
              <h2 id="compliance-title">已选择不同意</h2>
              <p className="compliance-copy">我们不会初始化防沉迷SDK。你可以退出游戏，或返回重新阅读并选择。</p>
              <div className="compliance-actions">
                <button className="secondary-button" type="button" onClick={() => void exitNativeGame()}>退出游戏</button>
                <button className="primary-button" type="button" onClick={() => setPrivacyConsent("required")}>重新选择</button>
              </div>
            </>
          ) : null}
          {isAuthenticating ? (
            <>
              <div className="compliance-spinner" aria-hidden="true" />
              <h2 id="compliance-title">实名认证与防沉迷</h2>
              <p className="compliance-copy">正在连接平台服务，请根据弹窗完成实名验证。</p>
            </>
          ) : null}
          {isBlocked ? (
            <>
              <h2 id="compliance-title">暂时无法进入游戏</h2>
              <p className="compliance-copy">{antiAddictionMessage}</p>
              <p className="compliance-help">未成年人受限时段或平台要求退出时，游戏不会绕过防沉迷校验。</p>
              <div className="compliance-actions">
                <button className="secondary-button" type="button" onClick={() => void exitNativeGame()}>退出游戏</button>
                <button className="primary-button" type="button" onClick={retryAntiAddiction}>重新验证</button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    );
  }

  if (screen === "start") {
    return (
      <>
      <main className="start-screen" onPointerDown={() => audioRef.current?.start(0)}>
        <div className="start-art" />
        <div className="start-copy">
          <h1>莉莉的<br />衣橱冒险</h1>
          <p>把每一只宝箱推到星光位置，打开衣橱里珍藏的新裙子。</p>
          <button className="primary-button start-button" type="button" onClick={startGame}>开始游戏</button>
          <button className="text-button" type="button" onClick={() => setScreen("map")}>选择关卡</button>
          <button className="wardrobe-home-button" type="button" onClick={() => setShowWardrobe(true)}>
            <img src="/art/wardrobe.png" alt="" />
            进入衣橱换装
          </button>
          <div className="start-compliance-links">
            <button className="age-prompt-button" type="button" onClick={() => setShowAgeGuide(true)}><span>8+</span>适龄提示</button>
            <button className="privacy-link" type="button" onClick={() => setShowPrivacyDetails(true)}>隐私政策</button>
          </div>
        </div>
      </main>
      {showAgeGuide ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAgeGuide(false)}>
          <section className="information-modal" role="dialog" aria-modal="true" aria-labelledby="age-guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="age-badge age-badge-large">8+</span>
            <h2 id="age-guide-title">适龄提示</h2>
            <p>本游戏是一款卡通公主主题的单机益智推箱解谜游戏，适合8周岁及以上用户。</p>
            <p>游戏不含写实暴力、恐怖、赌博、抽卡、付费或陌生人社交内容。未成年人建议在监护人指导下体验，请合理安排游戏时间，避免沉迷。</p>
            <p>安卓渠道版接入实名认证与防沉迷服务，未成年人的游戏时间将按国家相关规定执行。</p>
            <button className="primary-button" type="button" onClick={() => setShowAgeGuide(false)}>我知道了</button>
          </section>
        </div>
      ) : null}
      {showPrivacyDetails ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPrivacyDetails(false)}>
          <section className="information-modal privacy-information-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-info-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="privacy-info-title">隐私政策</h2>
            <p>游戏进度、服装和声音设置仅保存在设备本地。3839安卓渠道版仅在获得同意后初始化好游快爆实名认证及防沉迷SDK。</p>
            <p>SDK提供方：厦门纯游互动科技有限公司；用途：实名认证、未成年人身份识别及游戏时段限制；可能处理姓名、身份证号码、手机号码及必要的设备与网络信息。</p>
            <p>第三方政策：https://m.3839.com/html/hykb-265.html</p>
            <p>运营主体：魔杰工作室　联系邮箱：136417505@qq.com</p>
            <button className="primary-button" type="button" onClick={() => setShowPrivacyDetails(false)}>关闭</button>
          </section>
        </div>
      ) : null}
      {showWardrobe ? (
        <WardrobeModal
          outfit={outfit}
          selectedOutfit={selectedOutfit}
          accessibleOutfits={accessibleOutfits}
          onSelect={selectOutfit}
          onClose={() => setShowWardrobe(false)}
        />
      ) : null}
      </>
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
              <div className="star-counter" title="累计星级"><img src="/art/ui-star.png" alt="" />{totalStars}/{TOTAL_LEVELS * 3}</div>
            </header>
            <div className="chapter-route" aria-label="十个章节">
              {chapters.map((item, index) => {
                const progress = Math.max(0, Math.min(10, accessibleCompletedLevel - index * 10));
                const isUnlocked = index === 0 || accessibleCompletedLevel >= index * 10;
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
    const mapChapterAssetIndex = CHAPTER_ASSET_INDEXES[mapChapter] ?? 4;
    const mapChapterAssetBase = `/art-v2/objects/chapter-${String(mapChapterAssetIndex + 1).padStart(2, "0")}`;
    const chapterStart = mapChapter * 10;
    return (
      <main
        className={`chapter-map-screen ${mapChapterData.className}`}
        style={{ "--chapter-bg": `url("${mapChapterData.background}")`, "--level-cushion": `url("${mapChapterAssetBase}/goal.png")` } as CSSProperties}
      >
        <header className="map-header">
          <button className="round-icon" type="button" onClick={() => setMapChapter(null)} aria-label="返回章节"><img src="/art/ui-back.png" alt="" /></button>
          <div><span>第 {mapChapter + 1} 章 · {mapChapterData.range}关</span><h1>{mapChapterData.name}</h1></div>
          <div className="star-counter" title="累计星级"><img src="/art/ui-star.png" alt="" />{totalStars}/{TOTAL_LEVELS * 3}</div>
        </header>
        <section className="chapter-level-scene">
          <Character outfit={outfit} direction="right" action="walk" className="chapter-map-girl" />
          <div className="chapter-levels">
          {levels.slice(chapterStart, chapterStart + 10).map((item, localIndex) => {
            const index = chapterStart + localIndex;
            const isAvailable = index <= accessibleCompletedLevel;
            return (
            <button
              type="button"
              key={item.id}
              className={`${index === levelIndex ? "active" : ""} ${index < accessibleCompletedLevel ? "cleared" : ""} ${isAvailable ? "" : "locked"}`}
              onClick={() => isAvailable && resetLevel(index)}
              disabled={!isAvailable}
              aria-label={`进入第${index + 1}关`}
              data-layout={item.rows.join("|")}
              data-boxes={item.boxes.length}
              data-pushes={item.solutionPushes}
            >
              <small>{index < completedLevel ? `${"★".repeat(levelStars[index])}${"☆".repeat(3 - levelStars[index])}` : `第${index + 1}关`}</small>
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
          <button className={`round-icon sound-toggle ${soundEnabled ? "is-on" : "is-off"}`} type="button" onClick={toggleSound} aria-label={soundEnabled ? "关闭声音" : "打开声音"}>{soundEnabled ? "♫" : "×"}</button>
        </div>
      </header>

      <section className="game-stage">
        <div className="stage-heading">
          <div><span>{chapter.range}关主题 · 难度 {"★".repeat(level.difficulty)}{"☆".repeat(5 - level.difficulty)}</span><h2>{level.name}</h2></div>
          <div className="move-stats">
            <span>宝箱 <b>{level.boxes.length}</b></span>
            <span>步数 <b>{currentState.moves}</b></span>
            <span>推箱 <b>{currentState.pushes}</b></span>
            <span className="star-goal">三星 <b>{level.solutionPushes}推/{Math.ceil(level.solutionMoves * 1.25)}步</b></span>
          </div>
          </div>
          <div
            className="board-frame"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
          >
            {integratedBoardMode ? <div className="integrated-board-art" aria-hidden="true" /> : null}
            <div className="board-grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {visibleCells.map((cell) => (
              <div
                key={`${cell.visualX}-${cell.visualY}`}
                className={[
                  "tile",
                  cell.isWall && cell.isBorder ? "wall border-wall" : "floor",
                  cell.isWall && !cell.isBorder ? "internal-wall" : "",
                  cell.isGoal ? "goal" : "",
                  cell.isBox && cell.isGoal ? "box-complete" : "",
                  cell.isBox ? "has-box" : "",
                  cell.isPlayer ? "has-player" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  zIndex: cell.isPlayer || cell.isBox || (cell.isWall && !cell.isBorder) ? 20 + cell.y : undefined,
                  transformOrigin: "50% 50%",
                   transform: integratedBoardMode
                     ? `translateX(${(cell.visualX - 3) * (BOARD_ROW_SCALES_BY_ASSET[chapterAssetIndex][cell.visualY] - 1) * 100}%) scaleX(${BOARD_ROW_SCALES_BY_ASSET[chapterAssetIndex][cell.visualY]})`
                     : undefined,
                }}
              >
                {cell.isWall && !cell.isBorder ? (() => {
                  const obstacleName = obstacleNames[(cell.visualX * 3 + cell.visualY + chapterIndex) % obstacleNames.length];
                  const obstacleSrc = integratedBoardMode
                    ? `/art-v3/objects-topdown/${obstacleName}-centered.png`
                    : `${chapterAssetBase}/${obstacleName === "padded-block" ? "pink-chest" : obstacleName}.png`;
                  return <img className="obstacle-prop" src={obstacleSrc} alt="" />;
                })() : null}
                {cell.isBox ? <span className="crate" /> : null}
                {cell.isPlayer ? <Character outfit={outfit} direction={direction} action={action} frameIndex={actionFrameIndex} className="board-character" /> : null}
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

      <footer className="progress-footer"><span>衣橱旅程</span><div><i style={{ width: `${completion}%` }} /></div><strong>{accessibleCompletedLevel}/{TOTAL_LEVELS}</strong></footer>

      {showWardrobe ? (
        <WardrobeModal
          outfit={outfit}
          selectedOutfit={selectedOutfit}
          accessibleOutfits={accessibleOutfits}
          onSelect={selectOutfit}
          onClose={() => setShowWardrobe(false)}
        />
      ) : null}

      {showResult ? (
        <div className="modal-backdrop result-backdrop">
          <section className="result-card">
            <div className="result-illustration"><img src="/art/girl-celebrate-clean.png" alt="" /></div>
            <div className="result-stars" aria-label={`获得${resultStars}星`}>
              <span>{"★".repeat(resultStars)}</span><i>{"★".repeat(3 - resultStars)}</i>
            </div>
            <h2>{levelIndex === TOTAL_LEVELS - 1 ? "皇冠终章完成！" : "通关成功！"}</h2>
            <p>本次 {currentState.pushes} 次推箱、{currentState.moves} 步；三星目标不超过 {level.solutionPushes} 次推箱和 {Math.ceil(level.solutionMoves * 1.25)} 步。已保留本关最高星级。</p>
            <button className="primary-button" type="button" onClick={() => levelIndex === TOTAL_LEVELS - 1 ? setScreen("map") : resetLevel(levelIndex + 1)}>{levelIndex === TOTAL_LEVELS - 1 ? "查看全部关卡" : "下一关"}</button>
            <button className="text-button" type="button" onClick={() => setShowResult(false)}>留在本关</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
