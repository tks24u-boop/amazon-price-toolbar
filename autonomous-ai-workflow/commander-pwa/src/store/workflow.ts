/**
 * Zustand グローバルストア — ワークフロー状態管理
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Notebook, Plan, FreshnessReport } from "@/lib/api";

type Toast = { id: string; message: string; type: "success" | "error" | "info" };

type WorkflowState = {
  // 選択中のノートブック
  activeNotebookId: string | null;
  notebooks: Notebook[];

  // 計画
  plans: Plan[];

  // 鮮度レポート
  freshnessReport: FreshnessReport | null;

  // UI
  toasts: Toast[];

  // アクション
  setActiveNotebook: (id: string) => void;
  setNotebooks: (notebooks: Notebook[]) => void;
  setPlans: (plans: Plan[]) => void;
  updatePlan: (planId: string, updates: Partial<Plan>) => void;
  setFreshnessReport: (report: FreshnessReport) => void;
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
};

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      activeNotebookId: null,
      notebooks: [],
      plans: [],
      freshnessReport: null,
      toasts: [],

      setActiveNotebook: (id) => set({ activeNotebookId: id }),
      setNotebooks: (notebooks) => set({ notebooks }),
      setPlans: (plans) => set({ plans }),
      updatePlan: (planId, updates) =>
        set({
          plans: get().plans.map((p) =>
            p.plan_id === planId ? { ...p, ...updates } : p
          ),
        }),
      setFreshnessReport: (report) => set({ freshnessReport: report }),
      addToast: (message, type = "info") => {
        const id = crypto.randomUUID();
        set({ toasts: [...get().toasts, { id, message, type }] });
        setTimeout(() => get().removeToast(id), 4000);
      },
      removeToast: (id) =>
        set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: "ag-commander-workflow",
      partialize: (s) => ({
        activeNotebookId: s.activeNotebookId,
      }),
    }
  )
);
