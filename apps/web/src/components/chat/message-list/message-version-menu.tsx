// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 票59(消息级版本切换,2/3 切片,2026-10-22):AI 回复的版本切换器。
 *
 * **交互与 `CanvasVersionMenu`(components/chat/canvas-overlay.tsx)同构** ——
 * History 图标触发 + PortalPanel 下拉 + 列表点选,不另起第二套弹层语言:
 * 用户在画布与消息气泡上看到的是同一个东西 ——「这个位置的版本历史」。
 * 差别只在数据面:画布版本是 store 里的草稿快照(savedAt + content),消息版本是
 * 服务端 sibling 行(id + 正文);切换**不写库、不发请求**,只改读投影的激活版本
 * (stores/chat.ts 的 activeVersionByRoot,判族口径唯一源 lib/message-version-family.ts)。
 *
 * 文案复用 chat 命名空间既有键(canvasVersions / canvasRevert):本轮文件边界不含
 * packages/i18n,新增键须按 §19 五语言同批,留待跨端那一批一起落(不在此硬编码中文)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, History } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { PortalPanel } from '@/components/feedback/portal-panel'

/** 菜单里一行的版本读数 —— 由宿主按 versionFamilyPosition 的 members 派生 */
export interface MessageVersionEntry {
  /** 该版本的消息 id(切换时原样回传宿主) */
  id: string
  /** 版本序号(1 起;对用户显示为 `n/N` 里的 n) */
  ordinal: number
  /** 正文摘要(一行说明"这是哪一版") */
  summary: string
}

export interface MessageVersionMenuProps {
  versions: readonly MessageVersionEntry[]
  /** 当前激活版本 id */
  activeId: string
  /** 选中某版本(宿主转交 store 的 setActiveMessageVersion) */
  onSelect: (messageId: string) => void
}

export function MessageVersionMenu({ versions, activeId, onSelect }: MessageVersionMenuProps) {
  const t = useTranslations('chat')
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // 单版本没有可切的东西:不渲染 1/1 骗用户去点(n/N 只对 ≥2 有意义)
  if (versions.length < 2) return null
  const activeIndex = versions.findIndex((v) => v.id === activeId)

  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={t('canvasVersions')} side="top">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t('canvasVersions')}
          aria-expanded={open}
          data-testid="message-version-menu"
          className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] tabular-nums text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          <span>{`${activeIndex + 1}/${versions.length}`}</span>
        </button>
      </Tooltip>
      <PortalPanel
        open={open}
        anchorRef={rootRef}
        onClose={() => setOpen(false)}
        side="top"
        align="start"
        gap={4}
        className="max-h-48 w-64 overflow-y-auto rounded-xl border border-border/40 bg-popover p-1 shadow-lg"
      >
        <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
          {t('canvasVersions')}
        </p>
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              onSelect(v.id)
              setOpen(false)
            }}
            aria-label={t('canvasRevert')}
            aria-current={v.id === activeId ? 'true' : undefined}
            data-testid={`message-version-item-${v.id}`}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted/60"
          >
            <span className="w-8 shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {`${v.ordinal}/${versions.length}`}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/70">
              {v.summary || '—'}
            </span>
            <Check
              className={cn(
                'h-3 w-3 shrink-0',
                v.id === activeId ? 'text-primary' : 'text-transparent',
              )}
              aria-hidden
            />
          </button>
        ))}
      </PortalPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
