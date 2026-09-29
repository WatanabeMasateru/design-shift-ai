import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Shift AI｜AIデザイン改善ワークスペース",
  description: "画像やテキストから、伝わりやすいデザイン案を複数生成・比較できるAIデザインツール。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className="antialiased">{children}</body></html>;
}
