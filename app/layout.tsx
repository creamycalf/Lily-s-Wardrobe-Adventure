import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3217";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "莉莉的衣橱冒险",
    description: "50关2.5D推箱子换装游戏，支持键盘、滑动和手机方向键操作。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "莉莉的衣橱冒险",
      description: "推动宝箱收集星光，每完成若干关卡解锁一套新裙子。",
      type: "website",
      locale: "zh_CN",
      images: ["/art-v3/start-screen-clean.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "莉莉的衣橱冒险",
      description: "50关2.5D推箱子换装游戏。",
      images: ["/art-v3/start-screen-clean.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
