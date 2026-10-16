import { Capacitor, registerPlugin } from "@capacitor/core";

export type AntiAddictionResult = {
  allowed: boolean;
  code?: number;
  message?: string;
  sdkAvailable?: boolean;
};

type HykbAntiAddictionPlugin = {
  status(): Promise<{ sdkAvailable: boolean; gameIdConfigured: boolean }>;
  authenticate(options: { gameId: string; orientation: "portrait" | "landscape" }): Promise<AntiAddictionResult>;
  exitGame(): Promise<void>;
  release(): Promise<void>;
};

const HykbAntiAddiction = registerPlugin<HykbAntiAddictionPlugin>("HykbAntiAddiction");

export const HYKB_GAME_ID = "45613";

export function needsHykbAntiAddiction() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function authenticateHykb(): Promise<AntiAddictionResult> {
  if (!needsHykbAntiAddiction()) return { allowed: true, sdkAvailable: false };

  const status = await HykbAntiAddiction.status();
  if (!status.gameIdConfigured) {
    return { allowed: false, sdkAvailable: status.sdkAvailable, message: "尚未配置好游快爆游戏 ID。" };
  }
  if (!status.sdkAvailable) {
    return {
      allowed: false,
      sdkAvailable: false,
      message: "尚未放入好游快爆防沉迷 SDK，请安装平台最新版 SDK 后重试。",
    };
  }

  return HykbAntiAddiction.authenticate({
    gameId: HYKB_GAME_ID,
    orientation: document.documentElement.dataset.buildProfile === "pad" ? "landscape" : "portrait",
  });
}

export async function exitNativeGame() {
  if (needsHykbAntiAddiction()) await HykbAntiAddiction.exitGame();
}

export async function releaseHykb() {
  if (needsHykbAntiAddiction()) await HykbAntiAddiction.release();
}
