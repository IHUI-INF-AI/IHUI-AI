import { useState } from "react";
import { useShell } from "../context";
import {
  IconBolt,
  IconChevronDown,
  IconFolder,
  IconMore,
  IconPlus,
  IconSend,
} from "../icons";

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

const MODELS = [
  "DeepSeek-V4.1-Flash High",
  "DeepSeek-V4.1-Flash",
  "DeepSeek-V4.1-Pro",
  "DeepSeek-V3.2",
];
const MODES = ["标准模式", "快速模式", "深度思考模式"];
const WORKSPACES = ["默认工作区", "示例项目", "文档站"];
const ATTACHMENTS = ["@ 文件", "/ 指令", "工作区上下文"];

export function ChatView() {
  const { sessions, activeSessionId, messages, send } = useShell();
  const session = sessions.find((s) => s.id === activeSessionId);
  const [draft, setDraft] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [chatMoreOpen, setChatMoreOpen] = useState(false);

  const closeAll = () => {
    setModelOpen(false);
    setModeOpen(false);
    setWsOpen(false);
    setFilesOpen(false);
  };

  const submit = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  };

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col bg-bg"
      onClick={() => {
        if (modelOpen || modeOpen || wsOpen || filesOpen) closeAll();
      }}
    >
      {/* Empty state: hero + composer */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6">
        <div className="flex w-full max-w-[774.4px] flex-col items-center gap-4">
          <h1 className="text-center text-[26px] font-medium text-ink">
            探索未至之境
          </h1>

          <button
            type="button"
            data-composer-hint
            aria-label="输入提示"
            className="w-full text-center text-[14px] leading-6 text-ink-dim hover:text-ink"
          >
            描述你想要构建的内容，/ 调用指令，@ 文件或对话
          </button>

          {/* Composer card */}
          <div
            data-composer-card
            className="relative w-full max-w-[774.4px] rounded-panel bg-bg ring-1 ring-black/5 shadow-[rgba(0,0,0,0.1)_0_0_0_0.5px,rgba(0,0,0,0.03)_0_4px_16px,rgba(0,0,0,0.03)_0_0_24px]"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              data-composer-input
              placeholder="描述你想要构建的内容, / 调用指令, @ 文件或对话"
              className="h-[52px] w-full resize-none bg-transparent px-4 py-3 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none"
              rows={1}
            />

            {/* Composer toolbar */}
            <div className="flex items-center gap-[7px] px-3 py-[7px]">
              <button
                type="button"
                data-attach-trigger
                aria-label="添加文件或调用指令"
                aria-haspopup="true"
                aria-expanded={filesOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilesOpen((v) => !v);
                  setModelOpen(false);
                  setModeOpen(false);
                  setWsOpen(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-muted text-ink hover:bg-bg-chip"
              >
                <IconPlus size={14} />
              </button>

              <button
                type="button"
                data-workspace-trigger
                aria-label="选择工作区"
                aria-haspopup="true"
                aria-expanded={wsOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setWsOpen((v) => !v);
                  setModeOpen(false);
                  setFilesOpen(false);
                  setModelOpen(false);
                }}
                className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-ink ring-1 ring-black/10 hover:bg-bg-subtle"
              >
                <IconFolder size={16} />
                <span className="max-w-[120px] truncate">
                  {session?.workspace ?? "默认工作区"}
                </span>
                <span className="text-[11px] text-ink-faint">· 工作区内修改</span>
                <IconChevronDown
                  size={14}
                  className="text-ink-faint"
                />
              </button>

              <button
                type="button"
                data-mode-trigger
                aria-label="选择执行模式"
                aria-haspopup="true"
                aria-expanded={modeOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setModeOpen((v) => !v);
                  setWsOpen(false);
                  setFilesOpen(false);
                  setModelOpen(false);
                }}
                className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-ink ring-1 ring-black/10 hover:bg-bg-subtle"
              >
                <IconBolt size={16} />
                <span>标准模式</span>
                <IconChevronDown size={14} className="text-ink-faint" />
              </button>

              <button
                type="button"
                data-model-trigger
                aria-label="选择模型"
                aria-haspopup="true"
                aria-expanded={modelOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setModelOpen((v) => !v);
                  setModeOpen(false);
                  setFilesOpen(false);
                  setWsOpen(false);
                }}
                className="ml-auto flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] text-ink-dim ring-1 ring-black/10 hover:bg-bg-subtle"
              >
                <span className="max-w-[160px] truncate">
                  DeepSeek-V4.1-Flash High
                </span>
                <IconChevronDown size={14} className="text-ink-faint" />
              </button>

              <button
                type="button"
                aria-label="发送"
                onClick={(e) => {
                  e.stopPropagation();
                  submit();
                }}
                disabled={!draft.trim()}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
              >
                <IconSend size={16} />
              </button>
            </div>

            {/* Popups */}
            {filesOpen && (
              <div
                data-attach-popup
                role="menu"
                aria-label="添加文件或调用指令"
                className="absolute bottom-9 left-8 z-10 flex flex-col gap-1 rounded-md bg-bg p-1 ring-1 ring-black/10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xs text-ink-faint">
                  添加文件或调用指令
                </div>
                {ATTACHMENTS.map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="menuitem"
                    onClick={() => setFilesOpen(false)}
                    className="rounded-sm px-2 py-1 text-left text-xs text-ink-dim hover:bg-bg-subtle"
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}

            {wsOpen && (
              <div
                data-workspace-popup
                role="menu"
                aria-label="默认工作区"
                className="absolute bottom-9 left-16 z-10 flex flex-col rounded-md bg-bg p-1 ring-1 ring-black/10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xs text-ink-faint">工作区</div>
                {WORKSPACES.map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="menuitem"
                    onClick={() => setWsOpen(false)}
                    className={`rounded-sm px-3 py-1 text-left text-xs ${
                      w === "默认工作区"
                        ? "bg-bg-chip text-ink"
                        : "text-ink-dim hover:bg-bg-subtle"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}

            {modeOpen && (
              <div
                data-mode-popup
                role="menu"
                aria-label="标准模式"
                className="absolute bottom-9 left-24 z-10 flex flex-col rounded-md bg-bg p-1 ring-1 ring-black/10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xs text-ink-faint">执行模式</div>
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="menuitem"
                    onClick={() => setModeOpen(false)}
                    className={`rounded-sm px-3 py-1 text-left text-xs ${
                      m === "标准模式"
                        ? "bg-bg-chip text-ink"
                        : "text-ink-dim hover:bg-bg-subtle"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {modelOpen && (
              <div
                data-model-popup
                role="menu"
                aria-label="DeepSeek-V4.1-Flash High"
                className="absolute bottom-9 right-8 z-10 flex w-[240px] flex-col rounded-md bg-bg p-1 ring-1 ring-black/10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-xs text-ink-faint">模型</div>
                {MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="menuitem"
                    onClick={() => setModelOpen(false)}
                    className={`rounded-sm px-3 py-1.5 text-left text-xs ${
                      m === "DeepSeek-V4.1-Flash High"
                        ? "bg-bg-chip text-ink"
                        : "text-ink-dim hover:bg-bg-subtle"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message bubbles */}
      {messages.length > 0 && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1 ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[480px] rounded-md px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-accent text-on-accent"
                    : "bg-bg-subtle text-ink ring-1 ring-black/5"
                }`}
              >
                {m.content}
              </div>
              <span className="px-1 text-[11px] text-ink-faint">
                {m.role === "user" ? "你" : "Harness"} · {formatTime(m.at)}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
