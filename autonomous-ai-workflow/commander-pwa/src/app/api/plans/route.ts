import { NextRequest, NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function GET() {
  try {
    return await proxyToMcp("/plans");
  } catch {
    return NextResponse.json({ error: "計画一覧の取得に失敗しました" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await proxyToMcp("/content/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "計画の策定に失敗しました" }, { status: 503 });
  }
}
