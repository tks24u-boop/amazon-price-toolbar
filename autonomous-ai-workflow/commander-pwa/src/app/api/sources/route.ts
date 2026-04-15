import { NextRequest, NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await proxyToMcp("/content/sources", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "ソース追加に失敗しました" }, { status: 503 });
  }
}
