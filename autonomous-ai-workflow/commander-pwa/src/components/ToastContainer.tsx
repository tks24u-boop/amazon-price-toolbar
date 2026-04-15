"use client";

import { useWorkflowStore } from "@/store/workflow";
import { clsx } from "clsx";
import { X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useWorkflowStore();

  return (
    <div className="fixed top-4 right-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "flex items-start gap-3 p-3 rounded-xl shadow-xl border pointer-events-auto",
            "animate-in slide-in-from-top-2 duration-200",
            t.type === "success" &&
              "bg-emerald-950 border-emerald-700 text-emerald-200",
            t.type === "error" && "bg-red-950 border-red-700 text-red-200",
            t.type === "info" && "bg-slate-900 border-slate-700 text-slate-200"
          )}
        >
          <p className="flex-1 text-sm">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
