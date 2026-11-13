import { useState } from "react";
import { IconChevronDown, IconTerminal } from "../icons";

interface LogLine {
  level: "info" | "warn" | "error" | "cmd";
  text: string;
}

const bootLines: LogLine[] = [
  { level: "cmd", text: "$ harness --workspace 默认工作区" },
  { level: "info", text: "[harness] loading settings... ok" },
  { level: "info", text: "[harness] session catalog: 1 session(s)" },
  {
    level: "info",
    text: "[harness] model: DeepSeek-V4.1-Flash High (standard)",
  },
  { level: "info", text: "[harness] ready in 342ms" },
];

export function TerminalPanel({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [lines] = useState<LogLine[]>(bootLines);
  const [input, setInput] = useState("");

  return (
    <div
      data-shell-bottom
      className={`flex flex-col border-t border-black/5 bg-bg-subtle text-xs ${
        open ? "h-[220px]" : "h-[36px]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 items-center gap-2 px-3 text-ink-dim hover:bg-bg-muted"
      >
        <IconTerminal size={14} />
        <span className="text-[13px] font-medium">终端 / 日志</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-faint">
          {open ? "折叠" : "展开"}
          <IconChevronDown
            size={14}
            className={open ? "" : "rotate-180"}
          />
        </span>
      </button>
      {open && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 font-mono">
            {lines.map((l, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  l.level === "cmd"
                    ? "text-ink"
                    : l.level === "warn"
                    ? "text-amber-500"
                    : l.level === "error"
                    ? "text-red-500"
                    : "text-ink-dim"
                }`}
              >
                {l.text}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-black/5 px-3 py-1.5 font-mono">
            <span className="text-ink-faint">$</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入命令…"
              className="flex-1 bg-transparent text-ink outline-none"
            />
          </div>
        </>
      )}
    </div>
  );
}
