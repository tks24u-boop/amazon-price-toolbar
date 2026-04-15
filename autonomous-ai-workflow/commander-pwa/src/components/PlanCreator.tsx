"use client";

import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { createPlan, listPlans } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";
import { clsx } from "clsx";

export function PlanCreator() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { activeNotebookId, setPlans, addToast } = useWorkflowStore();

  const handleCreate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      await createPlan(description.trim(), activeNotebookId ?? undefined);
      const plans = await listPlans();
      setPlans(plans);
      addToast("計画を策定しました。承認待ちに追加されました。", "success");
      setDescription("");
    } catch (e) {
      addToast(`計画の策定に失敗: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
        <Zap size={15} className="text-yellow-400" />
        実装計画を策定
      </h2>
      <textarea
        placeholder="実装したい機能を自然言語で記述..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none"
      />
      <button
        onClick={handleCreate}
        disabled={loading || !description.trim()}
        className={clsx(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
          "bg-gradient-to-r from-blue-600 to-purple-600 text-white",
          "hover:from-blue-500 hover:to-purple-500 active:scale-95",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Zap size={15} />
        )}
        {loading ? "ナレッジを参照して計画中..." : "計画を策定"}
      </button>
      <p className="text-xs text-[var(--muted)] text-center">
        NotebookLM のナレッジを根拠に計画を生成します
      </p>
    </div>
  );
}
