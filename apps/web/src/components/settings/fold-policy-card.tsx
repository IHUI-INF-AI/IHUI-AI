// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * FoldPolicyCard — 设置页「中间步骤折叠策略」卡片
 * (2026-09-21 自聊天输入区工具栏迁入统一设置页,与高级参数 2026-09-14 迁移同模式)
 *
 * D21 折叠策略控制的是消息列表中间步骤的显示方式(自适应/始终折叠/始终展开),
 * 属于阅读视图偏好而非输入框能力开关,故归位设置页。
 *
 * 读写复用 chat/message-list/fold-policy 模块:localStorage + FOLD_POLICY_EVENT 广播,
 * MessageItem 监听同一事件实时重解析(未被用户显式操作过的消息跟随新策略),链路不变。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, FoldVertical } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import {
  readFoldPolicyMode,
  writeFoldPolicyMode,
  FOLD_POLICY_EVENT,
  type FoldPolicyMode,
} from '@/components/chat/message-list/fold-policy'
import { cn } from '@/lib/utils'

/** 三选一项,与 i18n key chat.foldPolicy.{auto|collapsed|expanded} 对齐 */
const FOLD_POLICY_MODES: FoldPolicyMode[] = ['auto', 'collapsed', 'expanded']

/** 设置页「中间步骤折叠策略」卡片 */
export function FoldPolicyCard() {
  const t = useTranslations('chat.foldPolicy')
  const [mode, setMode] = React.useState<FoldPolicyMode>('auto')

  // 与原 FoldPolicyButton 同步逻辑:挂载读初始值 + 监听广播事件跟随外部变更
  React.useEffect(() => {
    const sync = () => setMode(readFoldPolicyMode())
    sync()
    window.addEventListener(FOLD_POLICY_EVENT, sync)
    return () => window.removeEventListener(FOLD_POLICY_EVENT, sync)
  }, [])

  return (
    <Card data-testid="fold-policy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FoldVertical className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {FOLD_POLICY_MODES.map((m) => {
            const active = mode === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => writeFoldPolicyMode(m)}
                aria-pressed={active}
                data-testid={`fold-policy-option-${m}`}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors',
                  active
                    ? 'border-brand-accent-deep bg-primary/5 text-primary'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="flex items-center gap-1 font-medium">
                  {t(m)}
                  {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span className="text-center text-[11px] leading-snug text-muted-foreground">
                  {t(`${m}Desc`)}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default FoldPolicyCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
