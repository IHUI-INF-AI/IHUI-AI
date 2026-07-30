'use client'

import * as React from 'react'
import { BookOpen, FileText, Hammer, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'

// ChatMode 4 态元信息(2026-07-28 立,移除 4 按钮后改用小徽章显示)
// - icon: 当前模式徽章图标(lucide-react)
// - i18nKey: 模式名 i18n key(从 chat.modeBuild/modePlan/modeReview/modeSpec 取)
// - slashCmd: 对应 / 命令(供 tooltip 提示用户)
const CHAT_MODE_META: Record<
  ChatMode,
  { icon: React.ComponentType<{ className?: string }>; i18nKey: string; slashCmd: string }
> = {
  build: { icon: Hammer, i18nKey: 'modeBuild', slashCmd: '/build' },
  plan: { icon: BookOpen, i18nKey: 'modePlan', slashCmd: '/plan' },
  review: { icon: Search, i18nKey: 'modeReview', slashCmd: '/review' },
  spec: { icon: FileText, i18nKey: 'modeSpec', slashCmd: '/spec' },
}

/**
 * 当前 ChatMode 徽章(2026-07-28 立,移除 4 按钮后改用小徽章显示)。
 *
 * 视觉:h-6 px-2 text-xs、bg-muted 圆角 6px、icon + label 同行,subtle 风格。
 * 切换入口(全部在 Tooltip 提示):
 * - /build /plan /review /spec 斜杠命令
 * - Ctrl+1/2/3/4 全局快捷键
 * - AI 自动判断(用户输入发送时由 use-chat.ts suggestMode 触发)
 *
 * 不再提供按钮交互(2026-07-28 立,移除 4 按钮,纯视觉指示):
 * - 4 按钮占据顶部空间大、与其他 AI 工具(Cursor/Claude Code/Copilot/Windsurf)设计不符
 * - 用户可显式 /命令 或 Ctrl+1-4 切换,AI 也能自动判断
 * - 当前模式必须保留视觉反馈(用户需知道 AI 当前在哪个模式工作)
 */
export function CurrentModeBadge() {
  const t = useTranslations('chat')
  const currentMode = useModeStore((s) => s.currentMode)
  const meta = CHAT_MODE_META[currentMode]
  const ModeIcon = meta.icon
  return (
    <Tooltip
      content={
        <div className="space-y-0.5 text-[11px]">
          <div className="font-medium">{t('modeBadgeTooltip', { mode: t(meta.i18nKey) })}</div>
          <div className="text-muted-foreground">{t('modeBadgeSwitchHint')}</div>
        </div>
      }
      side="bottom"
    >
      <span
        className={cn(
          // 2026-07-30 padding 平衡:h-7(28px) - 16px 行高 = 12px → 上下各 6px,
          // 与横向 px-2(8px) 接近 1:1 平衡(原 h-6 上下仅 4px,比例 4:8 偏窄)
          'inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground',
        )}
        data-testid="chat-mode-badge"
        data-mode={currentMode}
      >
        <ModeIcon className="h-3 w-3" aria-hidden="true" />
        <span>{t(meta.i18nKey)}</span>
      </span>
    </Tooltip>
  )
}
