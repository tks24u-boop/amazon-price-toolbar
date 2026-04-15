/**
 * Service Worker 登録スクリプトを返すエンドポイント
 * layout.tsx の <script> から呼び出される。
 */
import { NextResponse } from "next/server";

export async function GET() {
  const script = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
  `.trim();
  return new NextResponse(script, {
    headers: { "Content-Type": "application/javascript" },
  });
}
