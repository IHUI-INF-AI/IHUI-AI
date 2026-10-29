// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 工作台主区顶栏(2026-10-28 片3):标题 + 上下文用量环。
 *
 * 上下文环直接挂内核件 ContextUsageRing(票60 步序四起窗格寻址 ⇒ 在本壳的
 * ChatPaneProvider 内读的是**本工作台 pane** 的 messages/usageByMessageId,
 * 不是根侧栏的);用量判据/压缩交互全部在那一件内核里,本件不另算第二份(§0.6)。
 * 模型与流式态取自 useChat()(同 Provider 寻址),本件只负责把它们递给环。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Maximize2, Minimize2 } from 'lucide-react'

import { ContextUsageRing } from '@/components/ai/context-usage-ring'
import { ModeSwitcher } from '@/components/chat/mode-switcher'
import { useChat } from '@/hooks/use-chat'
import { Button } from '@ihui/ui-react'

export interface WorkbenchPaneHeaderProps {
  /** 当前会话标题(新任务态由壳传 t('newConversation')) */
  title: string
  /** 大屏模式当前态(布局由壳负责,顶栏只负责开关) */
  immersive?: boolean
  onToggleImmersive?: () => void
}

export function WorkbenchPaneHeader({
  title,
  immersive = false,
  onToggleImmersive,
}: WorkbenchPaneHeaderProps) {
  const { currentModel, isStreaming } = useChat()
  const t = useTranslations('chat')
  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4"
      data-workbench-header=""
    >
      <span className="min-w-0 truncate text-sm font-medium" title={title}>
        {title}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {/* 模式档(ask/plan/build…)内核件:票60 普查批起窗格寻址 ⇒ 在本壳 Provider 内
            切的是**工作台窗格**的模式,不带走根侧栏;本壳不写第二份切换逻辑。 */}
        <ModeSwitcher />
        <ContextUsageRing model={currentModel ?? ''} isStreaming={isStreaming} />
        {onToggleImmersive && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onToggleImmersive}
            aria-pressed={immersive}
            aria-label={immersive ? t('workbenchImmersiveExit') : t('workbenchImmersiveEnter')}
            data-workbench-immersive-toggle={immersive ? 'on' : 'off'}
          >
            {immersive ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        )}
      </div>
    </header>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
