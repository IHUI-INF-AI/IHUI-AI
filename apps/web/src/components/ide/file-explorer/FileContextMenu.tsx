// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:文件右键菜单从 file-explorer.tsx 抽出(点击外部/Escape 关闭由父级管理)
import { useTranslations } from 'next-intl'
import { Pencil, Trash2 } from 'lucide-react'

export interface FileContextMenuProps {
  x: number
  y: number
  onRename: () => void
  onDelete: () => void
}

export function FileContextMenu({ x, y, onRename, onDelete }: FileContextMenuProps) {
  const t = useTranslations('ide')
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 右键菜单弹窗;键盘用户通过 Escape + 菜单项 Enter 提供等价交互
    <div
      className="fixed z-50 min-w-32 rounded-md border border-border bg-popover p-1 text-xs shadow-md"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1">
        <button
          onClick={onRename}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-muted"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{t('fileExplorer.rename')}</span>
        </button>
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-red-500 hover:bg-muted"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span>{t('fileExplorer.delete')}</span>
        </button>
      </div>
    </div>
  )
}
