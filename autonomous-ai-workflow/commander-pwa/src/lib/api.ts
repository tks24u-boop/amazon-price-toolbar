/**
 * MCP サーバー / Antigravity API クライアント
 *
 * Commander PWA から MCP Server（Python FastMCP）へ HTTP リクエストを送る薄いクライアント。
 * 全リクエストは /api/* の Next.js Route Handler を経由するため、
 * CORS 問題を回避しつつ APPROVAL_WEBHOOK_SECRET による認証を一元管理できる。
 */

export type Notebook = {
  id: string;
  title: string;
  source_count: number;
  updated_at: string;
};

export type SourceItem = {
  url?: string;
  text?: string;
  title?: string;
};

export type AddedSource = {
  source_id: string;
  notebook_id: string;
  title: string;
  added_at: string;
};

export type QueryResult = {
  answer: string;
  citations: Array<{ title: string; url?: string; excerpt: string }>;
  confidence: number;
};

export type Plan = {
  plan_id: string;
  feature_description: string;
  plan_steps: string[];
  status: "awaiting_approval" | "approved" | "rejected" | "running" | "done";
  created_at: string;
};

export type FreshnessReport = {
  notebook_id: string;
  source_count: number;
  oldest_source_date: string | null;
  freshness_ok: boolean;
  warnings: string[];
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Notebook 操作
// ---------------------------------------------------------------------------

export const listNotebooks = () =>
  apiRequest<Notebook[]>("/notebooks");

export const addSource = (source: SourceItem, notebookId?: string) =>
  apiRequest<AddedSource>("/sources", {
    method: "POST",
    body: JSON.stringify({ source, notebook_id: notebookId }),
  });

export const queryNotebook = (
  question: string,
  notebookId?: string,
  responseLength: "short" | "medium" | "long" = "medium"
) =>
  apiRequest<QueryResult>("/query", {
    method: "POST",
    body: JSON.stringify({
      question,
      notebook_id: notebookId,
      response_length: responseLength,
    }),
  });

// ---------------------------------------------------------------------------
// 計画管理
// ---------------------------------------------------------------------------

export const createPlan = (
  featureDescription: string,
  notebookId?: string
) =>
  apiRequest<Plan>("/plans", {
    method: "POST",
    body: JSON.stringify({
      feature_description: featureDescription,
      notebook_id: notebookId,
    }),
  });

export const listPlans = () => apiRequest<Plan[]>("/plans");

export const submitApproval = (
  planId: string,
  approved: boolean,
  comment?: string
) =>
  apiRequest<{ updated_status: string; next_action: string }>("/approvals", {
    method: "POST",
    body: JSON.stringify({ plan_id: planId, approved, comment }),
  });

// ---------------------------------------------------------------------------
// 鮮度監視
// ---------------------------------------------------------------------------

export const checkFreshness = (notebookId?: string) =>
  apiRequest<FreshnessReport>("/freshness", {
    method: "POST",
    body: JSON.stringify({ notebook_id: notebookId }),
  });
