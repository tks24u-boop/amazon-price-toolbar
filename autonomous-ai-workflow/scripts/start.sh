#!/usr/bin/env bash
# =============================================================================
# 自律型AI開発ワークフロー — 全サービス起動スクリプト
# =============================================================================
# 使い方:
#   ./scripts/start.sh
#   ./scripts/start.sh --tunnel  # Cloudflare Tunnel も起動（外出先アクセス用）
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"
BOLD="\033[1m"

WITH_TUNNEL=false
for arg in "$@"; do
  [ "$arg" = "--tunnel" ] && WITH_TUNNEL=true
done

# クリーンアップ（Ctrl+C 時）
cleanup() {
  echo ""
  echo -e "${YELLOW}サービスを停止しています...${RESET}"
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${BOLD}${CYAN}Antigravity Commander を起動しています...${RESET}"
echo ""

# ---------------------------------------------------------------------------
# 1. NotebookLM MCP CLI サーバーを起動
# ---------------------------------------------------------------------------
echo -e "${GREEN}[1/3]${RESET} NotebookLM MCP CLI サーバーを起動..."
(
  cd "$PROJECT_ROOT/mcp-server"
  source .env 2>/dev/null || true
  # notebooklm-mcp-2026 が HTTP サーバーモードで起動する場合
  if command -v notebooklm-mcp-2026 &>/dev/null; then
    notebooklm-mcp-2026 serve --port 8080 2>&1 | sed 's/^/[mcp-cli] /' &
  else
    echo "[mcp-cli] notebooklm-mcp-2026 が見つかりません。setup.sh を実行してください。"
  fi
) &
MCP_CLI_PID=$!

sleep 1

# ---------------------------------------------------------------------------
# 2. FastMCP サーバーを起動（Antigravity が使う MCP ブリッジ）
# ---------------------------------------------------------------------------
echo -e "${GREEN}[2/3]${RESET} FastMCP ブリッジサーバーを起動..."
(
  cd "$PROJECT_ROOT/mcp-server"
  source .env 2>/dev/null || true
  uv run python server.py 2>&1 | sed 's/^/[fastmcp] /'
) &
FASTMCP_PID=$!

sleep 1

# ---------------------------------------------------------------------------
# 3. Commander PWA を起動
# ---------------------------------------------------------------------------
echo -e "${GREEN}[3/3]${RESET} Commander PWA を起動..."
(
  cd "$PROJECT_ROOT/commander-pwa"
  npm run dev 2>&1 | sed 's/^/[pwa] /'
) &
PWA_PID=$!

# ---------------------------------------------------------------------------
# (オプション) Cloudflare Tunnel
# ---------------------------------------------------------------------------
if $WITH_TUNNEL; then
  if command -v cloudflared &>/dev/null; then
    echo -e "${CYAN}[tunnel]${RESET} Cloudflare Tunnel を起動..."
    cloudflared tunnel --url http://localhost:3000 2>&1 | sed 's/^/[tunnel] /' &
    TUNNEL_PID=$!
  else
    echo -e "${YELLOW}[warn]${RESET} cloudflared が見つかりません。"
    echo "  インストール: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/"
  fi
fi

echo ""
echo -e "${BOLD}${GREEN}✓ 全サービスが起動しました${RESET}"
echo ""
echo -e "  Commander PWA  : ${CYAN}http://localhost:3000${RESET}"
echo -e "  MCP CLI        : ${CYAN}http://localhost:8080${RESET}"
echo ""
echo "Ctrl+C で全サービスを停止します"
echo ""

wait
