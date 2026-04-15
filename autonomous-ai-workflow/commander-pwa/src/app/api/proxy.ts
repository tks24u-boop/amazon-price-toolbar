/**
 * MCP サーバーへのプロキシユーティリティ
 *
 * Next.js の API Route から Python FastMCP サーバーへ転送する共通処理。
 */

const MCP_BASE =
  process.env.MCP_SERVER_URL ?? "http://localhost:8080";

export async function proxyToMcp(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const upstream = `${MCP_BASE}${path}`;
  const res = await fetch(upstream, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
