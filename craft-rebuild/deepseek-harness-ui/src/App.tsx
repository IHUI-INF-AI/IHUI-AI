import { useState } from "react";
import { useShell } from "./context";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { FilesView } from "./components/FilesView";
import { TerminalPanel } from "./components/TerminalPanel";
import { PreviewDialog } from "./components/PreviewDialog";
import { IconPanelCollapse } from "./icons";

export function App() {
  const { activeSessionId, setActiveSessionId, sessions } = useShell();
  const session = sessions.find((s) => s.id === activeSessionId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 原版首屏：右侧文件树与底部终端默认折叠，对话区占满
  const [rightOpen, setRightOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [preview, setPreview] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg text-ink">
      {/* 原版：仅主区右上角一个面板开关，无顶部横条 */}
      <div className="pointer-events-none absolute right-3 top-2.5 z-20 flex items-center gap-1">
        <button
          type="button"
          data-workspace-toggle
          aria-label={rightOpen ? "折叠工作区" : "展开工作区"}
          onClick={() => setRightOpen((v) => !v)}
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-sm text-ink-dim hover:bg-bg-muted"
        >
          <IconPanelCollapse size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div
              data-sidebar-mask
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full">
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Middle: chat + terminal */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ChatView />
          </div>
          {termOpen && (
            <TerminalPanel open onToggle={() => setTermOpen(false)} />
          )}
        </main>

        {/* Right: files */}
        {rightOpen && (
          <aside
            data-right-panel
            className="hidden w-[300px] shrink-0 border-l border-black/5 lg:block"
          >
            <FilesView />
          </aside>
        )}
      </div>

      {preview && <PreviewDialog onDismiss={() => setPreview(false)} />}
    </div>
  );
}
