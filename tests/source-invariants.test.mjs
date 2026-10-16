import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the local Vite entry loads the global game stylesheet", async () => {
  const source = await readFile(new URL("main.tsx", root), "utf8");

  assert.match(source, /import ["']\.\/app\/globals\.css["'];/);
});

test("production builds keep sequential level and outfit progression", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.doesNotMatch(source, /TEST_UNLOCK_ALL|VITE_UNLOCK_ALL|全关卡与服装已解锁/);
  assert.match(source, /const accessibleCompletedLevel = completedLevel;/);
  assert.match(source, /const accessibleOutfits = unlocked;/);
  assert.match(source, /lilys-wardrobe-adventure-production-v2/);
  assert.match(source, /window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(\{ levelIndex, selectedOutfit, unlocked, completedLevel, levelStars \}\)\)/);
  assert.match(source, /calculateStars\(level, snapshot\.pushes, snapshot\.moves\)/);
});

test("the visual board renders only the inner seven-by-seven playfield", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(source, /cells\.slice\(1, -1\)\.flatMap\(\(row\) => row\.slice\(1, -1\)\)/);
  assert.match(source, /gridTemplateColumns: "repeat\(7, minmax\(0, 1fr\)\)"/);
  assert.match(source, /width: "68\.5%"/);
  assert.match(source, /rows: "48\.8fr 48\.4fr 50\.4fr/);
  assert.doesNotMatch(source, /integratedBoardMode = chapterIndex === 0/);
});

  test("integrated target and pieces use explicit tile-centre anchors", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const component = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

    assert.match(css, /\.integrated-board-mode \.tile\.goal::after[\s\S]*?inset: 50% auto auto 50%;[\s\S]*?transform: translate\(-50%, -50%\)/);
    assert.match(css, /\.integrated-board-mode \.crate[\s\S]*?inset: 50% auto auto 50%;[\s\S]*?transform: translate\(-50%, -50%\)/);
    assert.match(css, /\.integrated-board-mode \.obstacle-prop[\s\S]*?inset: 50% auto auto 50%;[\s\S]*?transform: translate\(-50%, -50%\)/);
    assert.match(css, /@keyframes goal-target-pulse/);
    assert.match(css, /width: 96%;[\s\S]*?height: 96%;[\s\S]*?0 0 20px rgba\(255,175,48/);
    assert.match(css, /\.integrated-board-mode \.tile\.goal\.box-complete::before/);
    assert.match(component, /BOARD_ROW_SCALES_BY_ASSET = \[/);
    assert.match(component, /BOARD_GRID_BY_ASSET\[chapterAssetIndex\]/);
    assert.match(component, /translateX\(\$\{\(cell\.visualX - 3\) \* \(BOARD_ROW_SCALES_BY_ASSET\[chapterAssetIndex\]\[cell\.visualY\] - 1\)/);
    assert.match(component, /transformOrigin: "50% 50%"/);
    assert.match(css, /\.integrated-board-mode img\.board-character[\s\S]*?left: 50%;[\s\S]*?top: 50%;[\s\S]*?transform: translate\(-50%, -54%\)/);
    assert.match(css, /@keyframes character-pop[\s\S]*?transform: translate\(-50%, -54%\)/);
  });

test("mobile swipes use one touch path and consume each gesture once", async () => {
  const component = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(component, /const gestureRef = useRef/);
  assert.match(component, /function resolveSwipeDirection/);
  assert.match(component, /function onTouchStart/);
  assert.match(component, /function onTouchEnd/);
  assert.match(component, /function onTouchCancel/);
  assert.doesNotMatch(component, /onPointerUp|onPointerCancel/);
  assert.match(component, /if \(gestureRef\.current\) return/);
  assert.match(component, /gestureRef\.current = null/);
  assert.doesNotMatch(component, /const \[gesture, setGesture\]/);
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
    "public/art-v3/start-screen-mobile.png",
    "public/art/girl-celebrate-clean.png",
  ];

  await Promise.all(boards.map((board) => access(new URL(board, root))));
});

test("all platforms use the princess castle puzzle app icon", async () => {
  const manifest = await readFile(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
  const background = await readFile(new URL("android/app/src/main/res/values/ic_launcher_background.xml", root), "utf8");
  const icon = await readFile(new URL("public/app-icon.png", root));
  assert.equal(icon.toString("ascii", 12, 16), "IHDR");
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(background, /#68247F/);
  assert.match(await readFile(new URL("app/layout.tsx", root), "utf8"), /icon: "\/favicon\.png"/);
  assert.match(await readFile(new URL("desktop/main.cjs", root), "utf8"), /icon: path\.join\(__dirname, "dist-pc", "app-icon\.png"\)/);
});

test("default rose push frames are normalized RGBA assets and wired into the manifest", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = [
    "public/art-v3/characters/rose/down/push-01.png",
    "public/art-v3/characters/rose/up/push-01.png",
    "public/art-v3/characters/rose/left/push-01.png",
    "public/art-v3/characters/rose/right/push-01.png",
  ];

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("default rose walk frames are normalized RGBA assets and wired into the manifest", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = [
    "public/art-v3/characters/rose/down/walk-01.png",
    "public/art-v3/characters/rose/up/walk-01.png",
    "public/art-v3/characters/rose/left/walk-01.png",
    "public/art-v3/characters/rose/right/walk-01.png",
  ];

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("blueberry bakery outfit has four normalized board idle views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = [
    "public/art-v3/characters/bakery/down/idle-01.png",
    "public/art-v3/characters/bakery/up/idle-01.png",
    "public/art-v3/characters/bakery/left/idle-01.png",
    "public/art-v3/characters/bakery/right/idle-01.png",
  ];

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /bakery:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("blueberry bakery outfit has four normalized walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/bakery/${direction}/walk-01.png`,
    `public/art-v3/characters/bakery/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("mint garden outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/garden/${direction}/idle-01.png`,
    `public/art-v3/characters/garden/${direction}/walk-01.png`,
    `public/art-v3/characters/garden/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /garden:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("pearl tea outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/pearl/${direction}/idle-01.png`,
    `public/art-v3/characters/pearl/${direction}/walk-01.png`,
    `public/art-v3/characters/pearl/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /pearl:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("berry velvet outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/berry/${direction}/idle-01.png`,
    `public/art-v3/characters/berry/${direction}/walk-01.png`,
    `public/art-v3/characters/berry/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /berry:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("violet ceremony outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/violet/${direction}/idle-01.png`,
    `public/art-v3/characters/violet/${direction}/walk-01.png`,
    `public/art-v3/characters/violet/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /violet:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("ice crystal outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/ice/${direction}/idle-01.png`,
    `public/art-v3/characters/ice/${direction}/walk-01.png`,
    `public/art-v3/characters/ice/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} width`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} height`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /ice:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("moonlight princess outfit has four normalized idle, walk and push views", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const frames = ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/moon/${direction}/idle-01.png`,
    `public/art-v3/characters/moon/${direction}/walk-01.png`,
    `public/art-v3/characters/moon/${direction}/push-01.png`,
  ]);

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} must be 512px wide`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} must be 512px tall`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  assert.match(source, /moon:\s*\{/);
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("the final seven outfits have complete normalized board actions", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const outfits = ["autumn", "winter", "starlight", "crown", "crystal", "roseclock", "eternal"];
  const frames = outfits.flatMap((outfit) => ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/${outfit}/${direction}/idle-01.png`,
    `public/art-v3/characters/${outfit}/${direction}/walk-01.png`,
    `public/art-v3/characters/${outfit}/${direction}/push-01.png`,
  ]));

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} must be 512px wide`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} must be 512px tall`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  for (const outfit of outfits) {
    assert.match(source, new RegExp(`${outfit}:\\s*\\{`));
  }
  for (const frame of frames) {
    const assetUrl = `/${frame.replace(/^public\//, "")}`;
    assert.match(source, new RegExp(assetUrl.replaceAll("/", "\\/")));
  }
});

test("late-game progression unlocks a complete outfit every five levels", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const unlockLevels = [...source.matchAll(/unlockAt:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(unlockLevels, [1, ...Array.from({ length: 20 }, (_, index) => (index + 1) * 5)]);

  const addedOutfits = ["sapphire", "swan", "phoenix", "navigator", "wisteria", "aurora"];
  const frames = addedOutfits.flatMap((outfit) => ["down", "up", "left", "right"].flatMap((direction) => [
    `public/art-v3/characters/${outfit}/${direction}/idle-01.png`,
    `public/art-v3/characters/${outfit}/${direction}/walk-01.png`,
    `public/art-v3/characters/${outfit}/${direction}/push-01.png`,
  ]));

  await Promise.all(frames.map(async (frame) => {
    const png = await readFile(new URL(frame, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512, `${frame} must be 512px wide`);
    assert.equal(png.readUInt32BE(20), 512, `${frame} must be 512px tall`);
    assert.equal(png[25], 6, `${frame} must be RGBA`);
  }));

  for (const outfit of addedOutfits) {
    assert.match(source, new RegExp(`${outfit}: generatedOutfitFrames\\("${outfit}"\\)`));
    const portrait = await readFile(new URL(`public/art/outfit-${outfit}.png`, root));
    assert.equal(portrait.readUInt32BE(16), 512, `${outfit} portrait width`);
    assert.equal(portrait.readUInt32BE(20), 512, `${outfit} portrait height`);
    assert.equal(portrait[25], 6, `${outfit} portrait must be RGBA`);
  }
});

test("the game wires browser-native music and action sound effects", async () => {
  const component = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const audio = await readFile(new URL("lib/game-audio.ts", root), "utf8");

  assert.match(component, /GameAudioEngine/);
  assert.match(component, /audioRef\.current\?\.move\(pushed\)/);
  assert.match(component, /audioRef\.current\?\.success\(\)/);
  assert.match(component, /if \(screen === "start" && privacyConsent === "accepted" && antiAddictionState === "ready"\) audioRef\.current\?\.start\(0\)/);
  assert.match(component, /audioRef\.current\?\.setChapter\(chapterIndex\)/);
  assert.match(component, /sound-toggle/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /princess-castle-adventure\.wav/);
  assert.match(audio, /new Audio\(MUSIC_ASSET\)/);
  assert.match(audio, /this\.music\.loop = true/);
  assert.match(audio, /setChapter/);
  assert.match(audio, /move\(push: boolean\)/);
  assert.match(audio, /private noise\(/);
  assert.doesNotMatch(audio, /playMusicBar|musicTimer|chapterTracks/);
});

test("privacy consent, 8+ guidance and anti-addiction gate run before play", async () => {
  const component = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const bridge = await readFile(new URL("lib/platform-compliance.ts", root), "utf8");
  const manifest = await readFile(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
  const activity = await readFile(new URL("android/app/src/main/java/com/lilywardrobe/quest/MainActivity.java", root), "utf8");

  assert.match(component, /PRIVACY_CONSENT_KEY/);
  assert.match(component, /qaLevel === null \? "required" : "accepted"/);
  assert.doesNotMatch(component, /localStorage\.getItem\(PRIVACY_CONSENT_KEY\)/);
  assert.match(component, /每次启动必读/);
  assert.match(component, /适龄提示与隐私保护/);
  assert.match(component, /不同意并退出/);
  assert.match(component, /同意以上内容并继续/);
  assert.match(component, /适龄提示/);
  assert.match(component, /antiAddictionState !== "ready"/);
  assert.match(bridge, /registerPlugin<.*>\("HykbAntiAddiction"\)/);
  assert.match(bridge, /HYKB_GAME_ID = "45613"/);
  assert.match(manifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.match(activity, /registerPlugin\(HykbAntiAddictionPlugin\.class\)/);
});

test("fallback outfit tint is clipped to the clothing layer", async () => {
  const component = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");

  assert.match(component, /board-character-base/);
  assert.match(component, /board-character-tint/);
  assert.match(css, /\.integrated-board-mode \.board-character-tint[\s\S]*?clip-path: inset\(54% 0 0\)[\s\S]*?filter: var\(--character-filter, none\)/);
  assert.doesNotMatch(css, /\.integrated-board-mode img\.board-character\s*\{[^}]*var\(--character-filter/);
});

test("the first playable object set is normalized RGBA art and wired into the board", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");
  const objectAssets = [
    "public/art-v3/objects-topdown/crate-centered.png",
    "public/art-v3/objects-topdown/padded-block-centered.png",
    "public/art-v3/objects-topdown/teddy-centered.png",
    "public/art-v3/objects-topdown/rocking-horse-centered.png",
  ];

  await Promise.all(objectAssets.map(async (asset) => {
    const png = await readFile(new URL(asset, root));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.ok(png.readUInt32BE(16) > 0, `${asset} width`);
    assert.ok(png.readUInt32BE(20) > 0, `${asset} height`);
    assert.equal(png[25], 6, `${asset} must be RGBA`);
  }));

  assert.match(source, /art-v3\/objects-topdown\/\$\{obstacleName\}-centered\.png/);
  assert.match(source, /art-v3\/objects-topdown\/crate-centered\.png/);
  assert.match(source, /obstacle-prop/);
});

test("level selection cannot skip ahead of completed progress", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(source, /const isAvailable = index <= accessibleCompletedLevel/);
  assert.match(source, /disabled=\{!isAvailable\}/);
  assert.match(source, /index < completedLevel \? `\$\{"★"\.repeat\(levelStars\[index\]\)\}\$\{"☆"\.repeat\(3 - levelStars\[index\]\)\}`/);
  assert.doesNotMatch(source, /completedLevel >= index \* 10 \|\| levelIndex >= index \* 10/);
});

test("chapter perspective spread follows each reused painted-board asset", async () => {
  const source = await readFile(new URL("components/DressboxGame.tsx", root), "utf8");

  assert.match(source, /const BOARD_GRID_BY_ASSET = \[/);
  assert.match(source, /const CHAPTER_ASSET_INDEXES = \[0, 1, 2, 3, 4, 3, 4, 2, 3, 4\]/);
  assert.match(source, /BOARD_GRID_BY_ASSET\[chapterAssetIndex\]/);
  assert.match(source, /integratedBoardMode\n\s+\? `translateX/);
});
