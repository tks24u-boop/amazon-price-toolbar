"use client";

import { useState } from "react";
import { Link, FileText, Send, Loader2 } from "lucide-react";
import { addSource } from "@/lib/api";
import { useWorkflowStore } from "@/store/workflow";
import { clsx } from "clsx";

type Mode = "url" | "text";

export function SourceEntryPanel() {
  const [mode, setMode] = useState<Mode>("url");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const { activeNotebookId, addToast } = useWorkflowStore();

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const source =
        mode === "url"
          ? { url: value.trim(), title: title.trim() || undefined }
          : { text: value.trim(), title: title.trim() || undefined };
      await addSource(source, activeNotebookId ?? undefined);
      addToast("ソースを NotebookLM に追加しました", "success");
      setValue("");
      setTitle("");
    } catch (e) {
      addToast(`追加に失敗しました: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
        <Send size={15} className="text-[var(--primary)]" />
        ソースを追加
      </h2>

      {/* モード切替 */}
      <div className="flex rounded-lg overflow-hidden border border-[var(--border)] text-xs">
        {(["url", "text"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
              mode === m
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            {m === "url" ? <Link size={12} /> : <FileText size={12} />}
            {m === "url" ? "URL" : "テキスト"}
          </button>
        ))}
      </div>

      {/* タイトル */}
      <input
        type="text"
        placeholder="タイトル（任意）"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
      />

      {/* URL / テキスト入力 */}
      {mode === "url" ? (
        <input
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
        />
      ) : (
        <textarea
          placeholder="着想やメモを入力..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none"
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        className={clsx(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
          "bg-[var(--primary)] text-white",
          "hover:bg-[var(--primary-hover)] active:scale-95",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Send size={15} />
        )}
        {loading ? "追加中..." : "NotebookLM へ送信"}
      </button>
    </div>
  );
}
