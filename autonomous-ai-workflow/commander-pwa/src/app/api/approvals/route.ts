import { NextRequest, NextResponse } from "next/server";
import { proxyToMcp } from "../proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Webhook シークレット検証（本番環境用）
    const secret = req.headers.get("x-approval-secret");
    const expectedSecret = process.env.APPROVAL_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await proxyToMcp("/approvals", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "承認処理に失敗しました" }, { status: 503 });
  }
}
