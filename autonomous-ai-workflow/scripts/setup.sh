#!/usr/bin/env bash
# =============================================================================
# 自律型AI開発ワークフロー — 初回セットアップスクリプト
# =============================================================================
# 使い方:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# =============================================================================

set -euo pipefail

RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BOLD}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════════╗
  ║      Antigravity Commander — セットアップウィザード       ║
  ║   スマホ司令塔 × NotebookLM × MCP 統合環境を構築します   ║
  ╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${RESET}"

# ---------------------------------------------------------------------------
# Step 1: 依存ツールの確認
# ---------------------------------------------------------------------------
info "Step 1/5: 依存ツールを確認しています..."

check_command() {
  if command -v "$1" &>/dev/null; then
    success "$1 が見つかりました"
  else
    error "$1 が見つかりません。インストールしてください。"
    exit 1
  fi
}

check_command python3
check_command node
check_command npm

# uv（Python パッケージマネージャー）
if ! command -v uv &>/dev/null; then
  warn "uv が見つかりません。インストールを試みます..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.cargo/bin:$PATH"
fi
check_command uv

# ---------------------------------------------------------------------------
# Step 2: MCP サーバーのセットアップ
# ---------------------------------------------------------------------------
info "Step 2/5: NotebookLM MCP サーバーをセットアップしています..."

cd "$PROJECT_ROOT/mcp-server"

if [ ! -f ".env" ]; then
  cp .env.example .env
  warn ".env.example を .env にコピーしました。"
  warn "mcp-server/.env を編集して DEFAULT_NOTEBOOK_ID を設定してください。"
fi

# notebooklm-mcp-2026 のインストールと認証
info "notebooklm-mcp-2026 をインストールしています..."
uv tool install notebooklm-mcp-2026 2>/dev/null || true

if command -v notebooklm-mcp-2026 &>/dev/null; then
  success "notebooklm-mcp-2026 がインストールされました"
  echo ""
  warn "==================================================================="
  warn "次のコマンドで Google 認証を行ってください（初回のみ）:"
  warn "  notebooklm-mcp-2026 setup"
  warn "==================================================================="
  echo ""
else
  warn "notebooklm-mcp-2026 のインストールに問題が発生しました。"
  warn "手動でインストールしてください: uv tool install notebooklm-mcp-2026"
fi

# Python 仮想環境のセットアップ
info "Python 仮想環境を作成しています..."
uv venv .venv
uv pip install -e "." --quiet
success "MCP サーバーの依存関係をインストールしました"

# ---------------------------------------------------------------------------
# Step 3: Commander PWA のセットアップ
# ---------------------------------------------------------------------------
info "Step 3/5: Commander PWA をセットアップしています..."

cd "$PROJECT_ROOT/commander-pwa"

if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  success ".env.local.example を .env.local にコピーしました"
fi

info "npm パッケージをインストールしています..."
npm install --silent
success "Commander PWA の依存関係をインストールしました"

# ---------------------------------------------------------------------------
# Step 4: Antigravity MCP 設定ファイルの生成
# ---------------------------------------------------------------------------
info "Step 4/5: Antigravity MCP 設定を生成しています..."

MCP_CONFIG_DIR="$HOME/.config/antigravity"
mkdir -p "$MCP_CONFIG_DIR"

cat > "$MCP_CONFIG_DIR/mcp.json" << MCPEOF
{
  "mcpServers": {
    "notebooklm": {
      "command": "uv",
      "args": [
        "run",
        "--project", "${PROJECT_ROOT}/mcp-server",
        "python", "${PROJECT_ROOT}/mcp-server/server.py"
      ],
      "env": {
        "NOTEBOOKLM_API_BASE": "http://localhost:8080",
        "DEFAULT_NOTEBOOK_ID": ""
      }
    }
  }
}
MCPEOF

success "Antigravity MCP 設定を $MCP_CONFIG_DIR/mcp.json に保存しました"

# ---------------------------------------------------------------------------
# Step 5: 起動スクリプトの確認
# ---------------------------------------------------------------------------
info "Step 5/5: 起動スクリプトを確認しています..."

if [ -x "$PROJECT_ROOT/scripts/start.sh" ]; then
  success "start.sh が見つかりました"
else
  warn "start.sh が見つかりません。scripts/start.sh を確認してください。"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ セットアップが完了しました！${RESET}"
echo ""
echo -e "${BOLD}次のステップ:${RESET}"
echo "  1. notebooklm-mcp-2026 setup  — Google 認証（初回のみ）"
echo "  2. mcp-server/.env を編集     — DEFAULT_NOTEBOOK_ID を設定"
echo "  3. ./scripts/start.sh         — 全サービスを起動"
echo "  4. http://localhost:3000       — Commander PWA をブラウザで開く"
echo ""
echo -e "${CYAN}スマホからアクセスする場合:${RESET}"
echo "  同一 Wi-Fi 内なら http://<PCのIPアドレス>:3000 でアクセス可能です。"
echo "  外出先からは Cloudflare Tunnel / ngrok 等を使ってください。"
echo ""
