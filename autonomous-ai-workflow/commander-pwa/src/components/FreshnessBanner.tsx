"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { checkFreshness } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";
import { useState } from "react";
import { clsx } from "clsx";

export function FreshnessBanner() {
  const { freshnessReport, setFreshnessReport, activeNotebookId, addToast } =
    useWorkflowStore();
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const report = await checkFreshness(activeNotebookId ?? undefined);
      setFreshnessReport(report);
    } catch (e) {
      addToast(`鮮度チェックに失敗: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!freshnessReport) {
    return (
      <button
        onClick={handleCheck}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RefreshCw size={13} />
        )}
        データ鮮度を確認
      </button>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-2xl border p-3",
        freshnessReport.freshness_ok
          ? "bg-emerald-950/50 border-emerald-700/50"
          : "bg-amber-950/50 border-amber-700/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {freshnessReport.freshness_ok ? (
            <CheckCircle2 size={15} className="text-emerald-400" />
          ) : (
            <AlertTriangle size={15} className="text-amber-400" />
          )}
          <span
            className={clsx(
              "text-xs font-medium",
              freshnessReport.freshness_ok
                ? "text-emerald-300"
                : "text-amber-300"
            )}
          >
            {freshnessReport.freshness_ok
              ? `ソース ${freshnessReport.source_count} 件 — 鮮度OK`
              : `${freshnessReport.warnings.length} 件の古いソース`}
          </span>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
      </div>
      {!freshnessReport.freshness_ok && freshnessReport.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {freshnessReport.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-400/80">
              • {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
