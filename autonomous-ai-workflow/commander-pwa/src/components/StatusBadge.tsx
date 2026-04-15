import { clsx } from "clsx";

type Status =
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "running"
  | "done";

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; dot: string }
> = {
  awaiting_approval: {
    label: "承認待ち",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400 animate-pulse",
  },
  approved: {
    label: "承認済み",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dot: "bg-blue-400",
  },
  rejected: {
    label: "却下",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    dot: "bg-red-400",
  },
  running: {
    label: "実行中",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400 animate-pulse",
  },
  done: {
    label: "完了",
    color: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.done;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        cfg.color
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
