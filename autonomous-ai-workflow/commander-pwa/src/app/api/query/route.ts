import { NextRequest, NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await proxyToMcp("/ask", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "クエリに失敗しました" }, { status: 503 });
  }
}
