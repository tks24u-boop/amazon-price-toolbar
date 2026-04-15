"""
NotebookLM MCP Server — 自律型AI開発ワークフロー向けナレッジ統合サーバー

Role: Antigravity Full-Stack Agent のナレッジグラウンディング基盤。
NotebookLM への読み書き・ソース追加・クエリをMCPツールとして公開する。
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import BaseModel, Field
from rich.console import Console

load_dotenv()

console = Console()

# ---------------------------------------------------------------------------
# 定数 / 設定
# ---------------------------------------------------------------------------

NOTEBOOKLM_API_BASE = os.environ.get(
    "NOTEBOOKLM_API_BASE", "http://localhost:8080"
)
DEFAULT_NOTEBOOK_ID = os.environ.get("DEFAULT_NOTEBOOK_ID", "")
REQUEST_TIMEOUT = 30.0


# ---------------------------------------------------------------------------
# Pydantic モデル
# ---------------------------------------------------------------------------


class SourceItem(BaseModel):
    """NotebookLM に追加するソース情報。"""

    url: str | None = Field(None, description="追加するURL（優先）")
    text: str | None = Field(None, description="テキストソース（URLがない場合）")
    title: str | None = Field(None, description="ソースのタイトル（任意）")


class PlanApproval(BaseModel):
    """リモート承認ペイロード。"""

    plan_id: str = Field(..., description="承認または却下する計画のID")
    approved: bool = Field(..., description="True=承認 / False=却下")
    comment: str | None = Field(None, description="承認者からのコメント（任意）")


class FreshnessReport(BaseModel):
    """データ鮮度レポート。"""

    notebook_id: str
    source_count: int
    oldest_source_date: str | None
    freshness_ok: bool
    warnings: list[str]


# ---------------------------------------------------------------------------
# MCP サーバー初期化
# ---------------------------------------------------------------------------

mcp = FastMCP(
    name="notebooklm-mcp",
    description=(
        "NotebookLM と Antigravity を繋ぐ MCP サーバー。"
        "ソース追加・ナレッジクエリ・データ鮮度監視をツールとして提供する。"
    ),
)


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------


async def _notebooklm_request(
    method: str,
    path: str,
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """NotebookLM MCP CLI の HTTP エンドポイントへリクエストを送る。"""
    url = f"{NOTEBOOKLM_API_BASE}{path}"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.request(method, url, json=json, params=params)
        resp.raise_for_status()
        return resp.json()


def _resolve_notebook_id(notebook_id: str | None) -> str:
    nid = notebook_id or DEFAULT_NOTEBOOK_ID
    if not nid:
        raise ValueError(
            "notebook_id が未指定です。引数か環境変数 DEFAULT_NOTEBOOK_ID を設定してください。"
        )
    return nid


# ---------------------------------------------------------------------------
# MCP ツール定義
# ---------------------------------------------------------------------------


@mcp.tool()
async def list_notebooks() -> list[dict[str, Any]]:
    """
    利用可能な NotebookLM ノートブックの一覧を返す。

    Returns:
        ノートブックのリスト（id, title, source_count, updated_at を含む）
    """
    result = await _notebooklm_request("GET", "/notebooks")
    return result.get("notebooks", [])


@mcp.tool()
async def add_source(
    source: SourceItem,
    notebook_id: str | None = None,
) -> dict[str, Any]:
    """
    NotebookLM の指定ノートブックへソース（URL またはテキスト）を追加する。

    モバイルエントリーポイント: ユーザーがスマホから送信した URL/着想をここへ渡す。

    Args:
        source: 追加するソース情報（url または text が必須）
        notebook_id: 対象ノートブックID（省略時はデフォルトを使用）

    Returns:
        追加されたソースのメタデータ
    """
    nid = _resolve_notebook_id(notebook_id)

    if not source.url and not source.text:
        raise ValueError("source.url または source.text のいずれかを指定してください。")

    payload: dict[str, Any] = {"notebook_id": nid}
    if source.url:
        payload["url"] = source.url
    if source.text:
        payload["text"] = source.text
    if source.title:
        payload["title"] = source.title

    return await _notebooklm_request("POST", "/content/sources", json=payload)


@mcp.tool()
async def query_notebook(
    question: str,
    notebook_id: str | None = None,
    response_length: str = "medium",
) -> dict[str, Any]:
    """
    NotebookLM のノートブックに対して質問し、引用付きの回答を得る。

    エージェントが実装計画（Plan）を策定する前にナレッジをグラウンディングするために使う。

    Args:
        question: ノートブックへの質問
        notebook_id: 対象ノートブックID（省略時はデフォルトを使用）
        response_length: 回答の長さ（"short" / "medium" / "long"）

    Returns:
        answer（回答文）, citations（引用ソースリスト）, confidence（信頼度）
    """
    nid = _resolve_notebook_id(notebook_id)
    return await _notebooklm_request(
        "POST",
        "/ask",
        json={
            "notebook_id": nid,
            "question": question,
            "response_length": response_length,
        },
    )


@mcp.tool()
async def create_implementation_plan(
    feature_description: str,
    notebook_id: str | None = None,
) -> dict[str, Any]:
    """
    ノートブックのナレッジを根拠に実装計画（Plan）を策定してキューへ登録する。

    策定された計画はユーザーのスマホへ通知され、承認を待機する。

    Args:
        feature_description: 実装したい機能の説明
        notebook_id: 参照するノートブックID

    Returns:
        plan_id, plan_steps（実装ステップ）, status（"awaiting_approval"）
    """
    nid = _resolve_notebook_id(notebook_id)

    # ノートブックのナレッジを参照して計画を策定
    grounding = await query_notebook(
        f"次の機能を実装するために必要な技術情報・制約・前例を教えてください: {feature_description}",
        notebook_id=nid,
        response_length="long",
    )

    plan_payload = {
        "notebook_id": nid,
        "feature_description": feature_description,
        "grounding_context": grounding.get("answer", ""),
        "grounding_citations": grounding.get("citations", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "awaiting_approval",
    }

    result = await _notebooklm_request("POST", "/content/generate", json=plan_payload)
    return result


@mcp.tool()
async def submit_approval(approval: PlanApproval) -> dict[str, Any]:
    """
    ユーザーがスマホから送信した計画の承認 / 却下を処理する。

    承認された場合は Antigravity エージェントへ実行シグナルを送る。

    Args:
        approval: 承認ペイロード（plan_id, approved, comment）

    Returns:
        updated_status, next_action
    """
    return await _notebooklm_request(
        "POST",
        "/approvals",
        json=approval.model_dump(),
    )


@mcp.tool()
async def check_freshness(notebook_id: str | None = None) -> FreshnessReport:
    """
    ノートブック内ソースのデータ鮮度を監視し、古いソースがあれば警告する。

    AIが推測でソースを汚染しないよう、定期的に呼び出すこと。

    Args:
        notebook_id: 対象ノートブックID（省略時はデフォルトを使用）

    Returns:
        FreshnessReport（source_count, oldest_source_date, warnings を含む）
    """
    nid = _resolve_notebook_id(notebook_id)
    sources_data = await _notebooklm_request(
        "GET", "/content/sources", params={"notebook_id": nid}
    )

    sources: list[dict[str, Any]] = sources_data.get("sources", [])
    warnings: list[str] = []
    oldest_date: str | None = None
    stale_threshold_days = 30

    now = datetime.now(timezone.utc)
    for src in sources:
        added_at_str = src.get("added_at")
        if added_at_str:
            try:
                added_at = datetime.fromisoformat(added_at_str.replace("Z", "+00:00"))
                delta = (now - added_at).days
                if delta > stale_threshold_days:
                    warnings.append(
                        f"ソース '{src.get('title', src.get('url', 'unknown'))}' は"
                        f" {delta} 日前に追加されており、情報が古い可能性があります。"
                    )
                if oldest_date is None or added_at_str < oldest_date:
                    oldest_date = added_at_str
            except ValueError:
                pass

    return FreshnessReport(
        notebook_id=nid,
        source_count=len(sources),
        oldest_source_date=oldest_date,
        freshness_ok=len(warnings) == 0,
        warnings=warnings,
    )


@mcp.tool()
async def sync_artifact(
    artifact_type: str,
    artifact_path: str,
    plan_id: str,
    notebook_id: str | None = None,
) -> dict[str, Any]:
    """
    Antigravity が生成した成果物（スクリーンショット・録画パス）を
    ノートブックへメタデータとして記録する。

    Args:
        artifact_type: "screenshot" または "recording"
        artifact_path: 成果物のローカルパスまたはURL
        plan_id: 対応する計画ID
        notebook_id: 記録先ノートブックID

    Returns:
        recorded_source_id
    """
    nid = _resolve_notebook_id(notebook_id)
    payload = {
        "notebook_id": nid,
        "text": (
            f"[Artifact] plan_id={plan_id} type={artifact_type} "
            f"path={artifact_path} recorded_at={datetime.now(timezone.utc).isoformat()}"
        ),
        "title": f"Artifact: {artifact_type} ({plan_id})",
    }
    return await _notebooklm_request("POST", "/content/sources", json=payload)


# ---------------------------------------------------------------------------
# エントリーポイント
# ---------------------------------------------------------------------------


def main() -> None:
    console.print("[bold green]NotebookLM MCP Server を起動しています...[/bold green]")
    console.print(f"  API_BASE : {NOTEBOOKLM_API_BASE}")
    console.print(f"  Notebook : {DEFAULT_NOTEBOOK_ID or '(未設定)'}")
    mcp.run()


if __name__ == "__main__":
    main()
