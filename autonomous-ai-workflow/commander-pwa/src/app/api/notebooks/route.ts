import { NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function GET() {
  try {
    return await proxyToMcp("/notebooks");
  } catch {
    return NextResponse.json({ error: "MCP サーバーに接続できません" }, { status: 503 });
  }
}
