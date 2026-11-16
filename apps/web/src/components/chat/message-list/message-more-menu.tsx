// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 消息操作栏的「更多」收纳(2026-11-16 立)。
 *
 * 背景:每条消息底部一排操作键最多可达 18 个(可见性/复制/钉选/收藏/朗读/反馈/下载/
 * 分享/分享回合/元数据/重生成/回退/发布/编辑/回复/评论…),在窄 AI 面板里直接顶出
 * 右边界。处理办法与竞品一致:高频键留在行内,低频键收进「更多」下拉。
 *
 * 交互与 `MessageVersionMenu` 同构(History 触发 + PortalPanel 向上弹出),
 * 不另起第二套弹层语言;菜单项沿用原按钮的 data-testid / aria-pressed / disabled,
 * 保证行为与可测试性不因收纳而改变。
 */

import * as React from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { PortalPanel } from '@/components/feedback/portal-panel'
import { ACTION_BTN_CLASS } from './message-item-parts'

export interface MessageMoreMenuItem {
  /** 稳定 key(同一消息内唯一) */
  key: string
  icon: LucideIcon
  label: string
  onSelect: () => void
  /** 沿用原按钮的测试锚点,收纳不改变断言入口 */
  testId?: string
  disabled?: boolean
  /** 双态项(钉选/收藏/评论)保持 aria-pressed 语义 */
  pressed?: boolean
  /** 删除类危险项 */
  danger?: boolean
}

export interface MessageMoreMenuProps {
  /** 触发按钮的本地化名称(chat.message.moreActions) */
  label: string
  items: readonly MessageMoreMenuItem[]
  /** 触发按钮 testid(message-more-<id>) */
  testId?: string
  className?: string
}

export function MessageMoreMenu({ label, items, testId, className }: MessageMoreMenuProps) {
  const [open, setOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  // 没有可收纳项时不渲染空菜单(Copy/重生成就够用的极简消息不出现死按钮)
  if (items.length === 0) return null

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <Tooltip content={label} side="top">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={label}
          aria-expanded={open}
          data-testid={testId}
          className={cn(ACTION_BTN_CLASS, open && 'text-primary bg-muted/60')}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </Tooltip>
      <PortalPanel
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        side="top"
        align="end"
        gap={4}
        className="max-h-72 w-52 overflow-y-auto rounded-xl border border-stroke-strong bg-popover p-1 shadow-elevation-lg"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setOpen(false)
              item.onSelect()
            }}
            disabled={item.disabled}
            aria-label={item.label}
            aria-pressed={item.pressed === undefined ? undefined : item.pressed}
            data-testid={item.testId}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body transition-colors',
              'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-40',
              item.danger && 'hover:text-destructive focus-visible:text-destructive',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        ))}
      </PortalPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
