// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { IconFile, IconFolder, IconFolderOpen, IconMore } from '../icons'

interface FileNode {
  name: string
  kind: 'folder' | 'file'
  children?: FileNode[]
}

const tree: FileNode[] = [
  {
    name: 'src',
    kind: 'folder',
    children: [
      {
        name: 'components',
        kind: 'folder',
        children: [
          { name: 'Sidebar.tsx', kind: 'file' },
          { name: 'ChatView.tsx', kind: 'file' },
          { name: 'TerminalPanel.tsx', kind: 'file' },
        ],
      },
      { name: 'context.tsx', kind: 'file' },
      { name: 'main.tsx', kind: 'file' },
      { name: 'styles.css', kind: 'file' },
    ],
  },
  { name: 'package.json', kind: 'file' },
  { name: 'tsconfig.json', kind: 'file' },
  { name: 'vite.config.ts', kind: 'file' },
]

export function FilesView() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    src: true,
    'src/components': true,
  })
  const [moreOpen, setMoreOpen] = useState(false)

  const toggle = (p: string) => setOpen((o) => ({ ...o, [p]: !o[p] }))

  const render = (nodes: FileNode[], depth = 0, prefix = '') =>
    nodes.map((n) => {
      const path = prefix + n.name
      const isOpen = open[path]
      return (
        <div key={path}>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-bg-subtle"
            style={{ paddingLeft: 8 + depth * 16 }}
            onClick={() => n.kind === 'folder' && toggle(path)}
          >
            {n.kind === 'folder' ? (
              isOpen ? (
                <IconFolderOpen size={16} className="text-accent" />
              ) : (
                <IconFolder size={16} className="text-accent" />
              )
            ) : (
              <IconFile size={16} className="text-ink-dim" />
            )}
            <span className="truncate">{n.name}</span>
          </button>
          {n.kind === 'folder' && isOpen && n.children && (
            <div>{render(n.children, depth + 1, path + '/')}</div>
          )}
        </div>
      )
    })

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-medium text-ink">工作区</span>
        <button
          type="button"
          data-files-more-trigger
          aria-label="更多"
          aria-haspopup="true"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink-dim hover:bg-bg-subtle"
        >
          <IconMore size={16} />
        </button>
        {moreOpen && (
          <div
            data-files-more-menu
            role="menu"
            aria-label="更多"
            className="absolute right-3 top-10 z-10 flex w-[180px] flex-col rounded-md bg-bg p-1 ring-1 ring-black/10 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="rounded-sm px-3 py-1 text-left text-xs text-ink-dim hover:bg-bg-subtle"
            >
              刷新
            </button>
            <button
              type="button"
              role="menuitem"
              className="rounded-sm px-3 py-1 text-left text-xs text-ink-dim hover:bg-bg-subtle"
            >
              新建文件
            </button>
            <button
              type="button"
              role="menuitem"
              className="rounded-sm px-3 py-1 text-left text-xs text-ink-dim hover:bg-bg-subtle"
            >
              折叠全部
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">{render(tree)}</div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
