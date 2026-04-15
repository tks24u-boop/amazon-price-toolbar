"use client";

import { useEffect } from "react";
import { Cpu, Layers, Clock } from "lucide-react";
import { listPlans } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";
import { NotebookSelector } from "@/components/NotebookSelector";
import { SourceEntryPanel } from "@/components/SourceEntryPanel";
import { PlanCreator } from "@/components/PlanCreator";
import { PlanCard } from "@/components/PlanCard";
import { FreshnessBanner } from "@/components/FreshnessBanner";
import { ToastContainer } from "@/components/ToastContainer";

export default function CommanderPage() {
  const { plans, setPlans } = useWorkflowStore();

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch(() => {/* 未接続時は無視 */});
    // setPlans は Zustand のストアから取得した安定した参照のため依存配列から除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = plans.filter((p) => p.status === "awaiting_approval").length;

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <ToastContainer />

      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Cpu size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--foreground)]">
                Antigravity Commander
              </h1>
              <p className="text-xs text-[var(--muted)]">自律型AI司令塔</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-2.5 py-1">
              <Clock size={12} className="text-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-300">
                {pendingCount} 件承認待ち
              </span>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-xl mx-auto px-4 py-5 space-y-4 pb-24">
        {/* ノートブック選択 */}
        <section>
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            ナレッジベース
          </p>
          <NotebookSelector />
          <div className="mt-2">
            <FreshnessBanner />
          </div>
        </section>

        {/* ソース追加 */}
        <section>
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            モバイルエントリー
          </p>
          <SourceEntryPanel />
        </section>

        {/* 計画策定 */}
        <section>
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            エージェントへの指示
          </p>
          <PlanCreator />
        </section>

        {/* 計画リスト */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={12} />
              実装計画 ({plans.length})
            </p>
          </div>
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                まだ計画がありません
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                上の「実装計画を策定」から開始してください
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <PlanCard key={plan.plan_id} plan={plan} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ボトムナビ（PWA 向け safe area 対応） */}
      <div className="fixed bottom-0 left-0 right-0 h-safe-area-inset-bottom bg-[var(--background)]" />
    </div>
  );
}
