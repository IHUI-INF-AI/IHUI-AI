// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useShell, useTheme } from '../context'
import {
  IconBrand,
  IconMore,
  IconNewChat,
  IconPlugin,
  IconAutomation,
  IconSearch,
  IconGridDots,
  IconPanelCollapse,
  IconFolderPlus,
  IconSortLines,
} from '../icons'

/**
 * Left sidebar: brand row, "新会话" button, panel nav (插件/自动化任务/更多),
 * search + tool buttons, project tree with sessions, and bottom 更多 trigger.
 * On small screens it becomes a drawer toggled from the top bar.
 * All interactive controls have data-attrs so Craft Anything's
 * state capture can open the same menus as the original.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { sessions, activeSessionId, setActiveSessionId, newSession } = useShell()
  const { mode, setMode } = useTheme()

  return (
    <div className="flex h-full w-[272px] flex-col bg-bg-subtle text-ink max-md:hidden">
      {/* Brand row */}
      <div data-window-drag className="flex items-center gap-2 px-2 pt-[31px] pb-2">
        <button
          type="button"
          aria-label="新建会话"
          data-sidebar-brand
          className="flex h-6 items-center gap-1.5 rounded-sm px-1.5 text-[13.3px] font-medium"
          onClick={() => {
            newSession()
            onNavigate?.()
          }}
        >
          <IconBrand size={26} className="text-ink" />
          <span className="text-[20px] font-bold tracking-[-0.015em] lowercase">deepseek</span>
          <span className="rounded-[4px] bg-ink px-[5px] py-[2px] text-[8.5px] font-bold tracking-[0.09em] text-bg">
            HARNESS
          </span>
        </button>
        <button
          type="button"
          aria-label={mode === 'dark' ? '切换到浅色' : '切换到深色'}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-sm text-ink-dim hover:bg-bg-muted"
        >
          <IconPanelCollapse size={15} />
        </button>
      </div>

      {/* New session button */}
      <div className="px-2 pb-2">
        <button
          type="button"
          data-new-session
          className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] bg-bg px-3 text-[13px] font-medium ring-1 ring-black/10 hover:bg-bg-subtle"
          onClick={() => {
            newSession()
            onNavigate?.()
          }}
        >
          <IconNewChat size={14} />
          <span>新会话</span>
        </button>
      </div>

      {/* Panel nav */}
      <nav data-panel-nav className="flex flex-col gap-[2px]">
        {[
          { key: 'plugin', label: '插件', icon: <IconPlugin size={16} /> },
          {
            key: 'auto',
            label: '自动化任务',
            icon: <IconAutomation size={16} />,
          },
          { key: 'more', label: '更多', icon: <IconGridDots size={16} /> },
        ].map((row) => (
          <button
            key={row.key}
            type="button"
            className="flex h-10 items-center gap-2.5 rounded-sm px-3 text-sm hover:bg-bg-subtle"
          >
            {row.icon}
            <span>{row.label}</span>
          </button>
        ))}
      </nav>

      {/* Project / session tree */}
      <div
        role="tree"
        aria-label="工作区"
        data-session-tree
        className="mt-3 flex flex-1 flex-col overflow-y-auto px-3"
      >
        {/* 分区标题 */}
        <div className="mb-1 px-3 text-[11px] font-medium text-ink-faint">工作区</div>
        <div
          role="treeitem"
          aria-selected="true"
          data-workspace-row
          className="flex h-[34px] items-center gap-2 rounded-sm px-3 text-sm"
        >
          <span className="text-accent">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            >
              <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5Z" />
            </svg>
          </span>
          <span className="truncate">默认工作区</span>
          <span className="ml-auto flex items-center gap-0.5 text-ink-faint">
            <button
              type="button"
              aria-label="搜索"
              className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-bg-muted"
            >
              <IconSearch size={14} />
            </button>
            <button
              type="button"
              aria-label="排序"
              className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-bg-muted"
            >
              <IconSortLines size={14} />
            </button>
            <button
              type="button"
              aria-label="新建文件夹"
              className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-bg-muted"
            >
              <IconFolderPlus size={14} />
            </button>
          </span>
        </div>
        {sessions.map((s) => {
          const active = s.id === activeSessionId
          return (
            <div
              key={s.id}
              role="treeitem"
              data-session-row
              aria-selected={active}
              onClick={() => {
                setActiveSessionId(s.id)
                onNavigate?.()
              }}
              className={`flex h-8 cursor-pointer items-center rounded-sm px-3 pl-6 text-sm ${
                active ? 'bg-[#2631480f]' : 'hover:bg-bg-subtle'
              }`}
            >
              <span className="truncate">{s.title}</span>
            </div>
          )
        })}
      </div>

      {/* 底部更多（原版左下角） */}
      <div className="px-4 pb-4">
        <button
          type="button"
          data-more-bottom
          aria-label="更多"
          className="flex h-7 items-center gap-2 text-[13px] text-ink-dim hover:text-ink"
        >
          <IconMore size={14} />
          <span>更多</span>
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
