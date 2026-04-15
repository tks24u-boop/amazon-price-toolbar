"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { submitApproval } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";
import { StatusBadge } from "./StatusBadge";
import type { Plan } from "@/lib/api";
import { clsx } from "clsx";

export function PlanCard({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const { updatePlan, addToast } = useWorkflowStore();

  const isPending = plan.status === "awaiting_approval";

  const handleDecision = async (approved: boolean) => {
    setLoading(approved ? "approve" : "reject");
    try {
      const res = await submitApproval(
        plan.plan_id,
        approved,
        comment.trim() || undefined
      );
      updatePlan(plan.plan_id, {
        status: res.updated_status as Plan["status"],
      });
      addToast(
        approved ? "計画を承認しました。実行を開始します。" : "計画を却下しました。",
        approved ? "success" : "info"
      );
    } catch (e) {
      addToast(`操作に失敗しました: ${(e as Error).message}`, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">
            {plan.feature_description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={plan.status} />
            <span className="text-xs text-[var(--muted)]">
              {new Date(plan.created_at).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[var(--muted)] flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[var(--muted)] flex-shrink-0" />
        )}
      </button>

      {/* 展開コンテンツ */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
          {/* ステップ一覧 */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
              実装ステップ
            </p>
            <ol className="space-y-1.5">
              {plan.plan_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-xs flex items-center justify-center text-[var(--muted)]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* 承認 UI */}
          {isPending && (
            <div className="space-y-2 pt-2">
              <textarea
                placeholder="コメント（任意）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision(true)}
                  disabled={!!loading}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {loading === "approve" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  承認・実行
                </button>
                <button
                  onClick={() => handleDecision(false)}
                  disabled={!!loading}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-[var(--surface-elevated)] text-red-400 border border-red-500/30 hover:bg-red-950 active:scale-95",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {loading === "reject" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  却下
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
