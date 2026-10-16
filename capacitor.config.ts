import type { CapacitorConfig } from "@capacitor/cli";

const profile = process.env.LILY_BUILD_PROFILE === "pad" ? "pad" : "mobile";

const config: CapacitorConfig = {
  appId: profile === "pad" ? "com.lilywardrobe.quest.pad" : "com.lilywardrobe.quest",
  appName: profile === "pad" ? "莉莉的衣橱冒险 HD" : "莉莉的衣橱冒险",
  webDir: "dist-android",
  android: {
    backgroundColor: "#f7d8d5",
  },
};

export default config;
