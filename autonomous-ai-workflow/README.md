# 自律型AI開発・ナレッジ同期システム

> **「スマホを司令塔、NotebookLM を脳、Antigravity を実動部隊」**  
> 場所を選ばない自律型開発ワークフローを実現する統合環境。

---

## アーキテクチャ概要

```
[スマホ] ─ Commander PWA (Next.js PWA)
               │
               │ HTTP (Next.js API Routes)
               ▼
         [MCP Server]  ─── FastMCP (Python)
               │
               │ MCP Protocol
               ▼
         [NotebookLM]       ← ナレッジベース（Google）
               │
               │ query / grounding
               ▼
         [Antigravity]      ← エージェント実行エンジン
               │
               │ 成果物（スクリーンショット・録画）
               ▼
         [NotebookLM]       ← 成果物をメタデータとして記録
```

---

## 運用フロー

| # | アクター | アクション |
|---|---------|-----------|
| 1 | ユーザー | スマホの Commander PWA から URL や着想を入力 |
| 2 | MCP Server | `add_source` ツールで NotebookLM へ自動追加 |
| 3 | Antigravity | `query_notebook` でナレッジをグラウンディングし実装計画を策定 |
| 4 | ユーザー | Commander PWA で計画を確認し「承認」または「却下」 |
| 5 | Antigravity | 承認後にバックグラウンドでコード生成・ビルド・ブラウザ検証を実行 |
| 6 | ユーザー | スクリーンショット・録画をスマホで確認し、最終デプロイを指示 |

---

## ディレクトリ構成

```
autonomous-ai-workflow/
├── .antigravity/
│   └── mcp.json              # Antigravity MCP サーバー設定
├── .github/
│   └── workflows/ci.yml      # CI（型チェック・ビルド）
├── mcp-server/               # Python FastMCP サーバー
│   ├── server.py             # MCP ツール定義（7ツール）
│   ├── pyproject.toml        # uv プロジェクト設定
│   └── .env.example          # 環境変数テンプレート
├── commander-pwa/            # Next.js 15 モバイル PWA
│   ├── src/
│   │   ├── app/              # App Router ページ・API Routes
│   │   ├── components/       # UI コンポーネント
│   │   ├── lib/api.ts        # API クライアント
│   │   └── store/workflow.ts # Zustand 状態管理
│   ├── public/
│   │   ├── manifest.json     # PWA マニフェスト
│   │   └── sw.js             # Service Worker
│   └── .env.local.example    # 環境変数テンプレート
└── scripts/
    ├── setup.sh              # 初回セットアップ
    └── start.sh              # 全サービス起動
```

---

## セットアップ手順

### 前提条件

- Python 3.11+
- Node.js 22+
- [uv](https://docs.astral.sh/uv/) (Python パッケージマネージャー)
- Google アカウント（NotebookLM アクセス用）

### 1. 初回セットアップ

```bash
cd autonomous-ai-workflow
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Google 認証（NotebookLM）

```bash
notebooklm-mcp-2026 setup
```

ブラウザが開くので、対象の Google アカウントでログインします。

### 3. 環境変数の設定

**`mcp-server/.env`**

```env
NOTEBOOKLM_API_BASE=http://localhost:8080
DEFAULT_NOTEBOOK_ID=<NotebookLM の URL から取得>
```

NotebookLM の URL: `https://notebooklm.google.com/notebook/<ここがID>`

**`commander-pwa/.env.local`**

```env
MCP_SERVER_URL=http://localhost:8080
APPROVAL_WEBHOOK_SECRET=<任意のシークレット文字列>
```

### 4. 起動

```bash
./scripts/start.sh
```

| サービス | URL |
|---------|-----|
| Commander PWA | http://localhost:3000 |
| MCP CLI サーバー | http://localhost:8080 |

### 5. スマホからアクセス

```bash
# 外出先からアクセスする場合（Cloudflare Tunnel）
./scripts/start.sh --tunnel
```

Tunnel URL が端末に表示されます。そのURLをスマホのブラウザで開き、  
「ホーム画面に追加」でPWAとしてインストールしてください。

---

## Antigravity への統合

`.antigravity/mcp.json` が自動的に読み込まれます。  
Antigravity を起動すると、以下のMCPツールが利用可能になります。

| ツール | 説明 |
|-------|------|
| `list_notebooks` | ノートブック一覧を取得 |
| `add_source` | URL/テキストをNotebookLMへ追加 |
| `query_notebook` | 引用付きでノートブックに質問 |
| `create_implementation_plan` | ナレッジを根拠に実装計画を策定 |
| `submit_approval` | 計画の承認/却下を処理 |
| `check_freshness` | ソースのデータ鮮度を監視 |
| `sync_artifact` | 成果物をNotebookLMへ記録 |

---

## データ鮮度の監視

`check_freshness` ツールは30日以上更新されていないソースを自動検出し、  
Commander PWA のバナーで警告を表示します。  
これにより、AIが古い情報を根拠に推測してソースを汚染するリスクを防ぎます。

---

## ライセンス

MIT
