import { NextRequest, NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await proxyToMcp(
      `/content/sources?notebook_id=${encodeURIComponent(body.notebook_id ?? "")}`,
      { method: "GET" }
    );
  } catch {
    return NextResponse.json({ error: "鮮度チェックに失敗しました" }, { status: 503 });
  }
}
