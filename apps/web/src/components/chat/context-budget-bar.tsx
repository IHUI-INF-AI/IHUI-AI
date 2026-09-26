// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// V3 #69(2026-09-27 立):会话窗口额度实时进度条。
// 消费 `@ihui/api-client` 已解析的 budget 命名帧(level/percent/usedTokens/limitTokens/
// resetAt,生产端真值见 apps/api/src/routes/ai-chat-stream.ts checkTokenBudget,本卡只读不改):
//   - warning(80%~95%)→ 琥珀;critical(95%~100%)→ 红 —— 档位色与 #43 ContextUsageRing
//     的 USAGE_STYLES 同族(amber-500 / red-500 系),不另立第二套进度条观感;
//   - ≥100% 的 block 档不走本条(429 + errorCode 'BUDGET_EXHAUSTED' 走失败卡,
//     send-message.ts 已把 errorCode 落进消息,D67 归属分型卡负责文案)。
// 落点数据在 `@/hooks/use-chat/budget-state`(帧 → 模块级态),本组件只读不算第二份数。

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Gauge } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatTokenCount } from '@/lib/model-context-capacity'
import {
  budgetBarPercent,
  getBudgetEvent,
  getBudgetEventServerSnapshot,
  subscribeBudgetEvent,
} from '@/hooks/use-chat/budget-state'

/** resetAt 是网关算好的东八区次日 0 点 ISO 串;展示走 Intl.DateTimeFormat(§4 时间规范),
 *  解析失败返回 null —— 宁可少一段提示,不给界面摆 "Invalid Date" */
function formatResetTime(iso: string, locale: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return null
  }
}

/**
 * 输入框上方的额度进度条。未收到过 budget 帧 ⇒ 整条不渲染(不占位)。
 * 进度轨道仅装饰(百分比/用量文本已携带同一事实),对读屏器以 role="status" 播报文本为准。
 */
export function ContextBudgetBar() {
  const event = React.useSyncExternalStore(
    subscribeBudgetEvent,
    getBudgetEvent,
    getBudgetEventServerSnapshot,
  )
  const t = useTranslations('chat')
  const locale = useLocale()

  if (!event) return null

  const critical = event.level === 'critical'
  const percent = budgetBarPercent(event)
  const resetText = event.resetAt ? formatResetTime(event.resetAt, locale) : null

  return (
    <div
      role="status"
      data-testid="context-budget-bar"
      data-level={event.level}
      className={cn(
        'mx-4 mb-2 rounded-lg px-3 py-2 text-xs',
        critical
          ? 'bg-red-500/10 text-red-700 dark:text-red-400'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0 font-medium">{t('budgetBar.title')}</span>
        {critical && <span className="shrink-0 font-medium">{t('budgetBar.critical')}</span>}
        {event.usedTokens !== undefined && event.limitTokens !== undefined && (
          <span className="min-w-0 truncate opacity-90">
            {t('budgetBar.tokens', {
              used: formatTokenCount(event.usedTokens),
              limit: formatTokenCount(event.limitTokens),
            })}
          </span>
        )}
        {resetText && (
          <span className="shrink-0 opacity-90">{t('budgetBar.resetAt', { time: resetText })}</span>
        )}
        {/* 百分比徽章:§4 数字计数徽章确定性居中模板(inline-flex + leading-none + tabular-nums) */}
        <span
          className={cn(
            'ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-[10px] font-semibold leading-none tabular-nums',
            critical ? 'bg-red-500/20 text-red-700 dark:text-red-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
          )}
        >
          {percent}%
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded bg-muted" aria-hidden="true">
        <div
          className={cn('h-full rounded transition-[width] duration-300', critical ? 'bg-red-500' : 'bg-amber-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
