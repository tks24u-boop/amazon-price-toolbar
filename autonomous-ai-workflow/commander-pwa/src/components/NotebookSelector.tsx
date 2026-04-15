"use client";

import { useEffect } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { listNotebooks } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";

export function NotebookSelector() {
  const { notebooks, activeNotebookId, setNotebooks, setActiveNotebook } =
    useWorkflowStore();

  useEffect(() => {
    listNotebooks()
      .then((nbs) => {
        setNotebooks(nbs);
        if (!activeNotebookId && nbs.length > 0) {
          setActiveNotebook(nbs[0].id);
        }
      })
      .catch(() => {/* ネットワーク未接続時は無視 */});
    // 初回マウント時のみ実行。Zustand の setter は安定参照のため依存配列から除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = notebooks.find((n) => n.id === activeNotebookId);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2">
        <BookOpen size={14} className="text-[var(--primary)] flex-shrink-0" />
        <select
          value={activeNotebookId ?? ""}
          onChange={(e) => setActiveNotebook(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[var(--foreground)] focus:outline-none appearance-none cursor-pointer"
        >
          {notebooks.length === 0 && (
            <option value="" disabled>
              ノートブックを読み込み中...
            </option>
          )}
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title} ({nb.source_count} ソース)
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="text-[var(--muted)] flex-shrink-0" />
      </div>
      {active && (
        <p className="text-xs text-[var(--muted)] mt-1 px-1">
          最終更新:{" "}
          {new Date(active.updated_at).toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
