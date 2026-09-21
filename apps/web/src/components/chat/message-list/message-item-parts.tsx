// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import type { ChatMessage } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'
import { toolDisplayKey } from '@ihui/shared/chat'
import { computeMessageCostCny, formatCompactTokens, useModelPriceCny } from './use-model-price'

/** 2026-09-01 立,工具调用过程流式可视化:i18n 化等待态文案。
 *  依赖 message.toolCalls 中 status==='running' 的工具,让"正在调用工具 X"走 5 语言翻译。 */
export function TypingIndicator({
  reasoning,
  toolCalls,
}: {
  reasoning?: string
  toolCalls?: ChatMessage['toolCalls']
}) {
  const t = useTranslations('ai.toolCall')
  const tStatus = useTranslations('taskStatus')
  const runningTool = toolCalls?.find((tc) => tc.status === 'running')

  let label: string
  if (runningTool) {
    // 工具码名 → 功能名(映射不到的插件/MCP 动态名回落原展示)
    const displayKey = toolDisplayKey(runningTool.toolName)
    label = displayKey ? tStatus(displayKey) : t('callingTool', { name: runningTool.toolName })
  } else if (reasoning && reasoning.length > 0) {
    const preview = reasoning.length > 40 ? `${reasoning.slice(0, 40)}…` : reasoning
    label = t('thinking', { preview })
  } else {
    label = t('waitingResponse')
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* 2026-08-29:文字光线扫描动效(.text-shimmer),流式等待态视觉反馈 */}
      <span className="text-shimmer text-xs font-medium">{label}</span>
    </div>
  )
}

/** 把消息 createdAt 格式化为"今天 HH:MM / MM-DD HH:MM" 风格 footer 时间戳(2026-07-28 立)
 *  - hover 消息气泡时在 footer 显示完整时间,便于用户回溯精确时刻
 *  - 与 timeline-event.tsx 内的 formatRelativeTime 互为补充:相对时间用于时间线,绝对时间用于消息气泡 */
export function formatMessageTimestamp(createdAt: number): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

/** 元数据 usage 展开面板(2026-08-02 立,原项目 toggleMetadata 展开内容)
 *  展示 promptTokens / completionTokens / totalTokens 细分,类型安全读取 unknown 字段
 *  W12(2026-09-13):i18n 化标签 + 模型价目折算人民币成本明细 */
export function UsageBreakdown({ usage, model }: { usage: unknown; model?: string }) {
  const t = useTranslations('chat')
  const price = useModelPriceCny(model)
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const prompt = typeof u.promptTokens === 'number' ? u.promptTokens : null
  const completion = typeof u.completionTokens === 'number' ? u.completionTokens : null
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : null
  // #21 流内实时估算标记:权威 usage 到达后此标记消失,徽章仅出现在流式估算阶段
  const estimated = u.estimated === true
  const { inputCost, outputCost, totalCost } = computeMessageCostCny(price, {
    promptTokens: prompt,
    completionTokens: completion,
  })
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {prompt !== null && (
        <span className="text-muted-foreground">
          {t('sessionUsage.promptTokens')}:{' '}
          <span className="font-medium text-foreground">{prompt}</span>
        </span>
      )}
      {completion !== null && (
        <span className="text-muted-foreground">
          {t('sessionUsage.completionTokens')}:{' '}
          <span className="font-medium text-foreground">{completion}</span>
          {estimated && (
            <span className="ml-1 text-[10px] text-muted-foreground">{t('usageEstimated')}</span>
          )}
        </span>
      )}
      {total !== null && (
        <span className="text-muted-foreground">
          {t('messageUsage.total')}: <span className="font-medium text-foreground">{total}</span>
        </span>
      )}
      {inputCost !== null && (
        <span className="text-muted-foreground">
          {t('sessionUsage.inputCost')}: ¥{inputCost.toFixed(6)}
        </span>
      )}
      {outputCost !== null && (
        <span className="text-muted-foreground">
          {t('sessionUsage.outputCost')}: ¥{outputCost.toFixed(6)}
        </span>
      )}
      {totalCost !== null && (
        <span className="text-muted-foreground">
          {t('messageUsage.total')} ¥{totalCost.toFixed(6)}
        </span>
      )}
      {price === null && model !== null && model !== '' && (
        <span className="text-muted-foreground/60">{t('sessionUsage.noPriceHint')}</span>
      )}
    </div>
  )
}

/** 消息级 token/成本内联徽章(W12,2026-09-13 立)
 *  在消息气泡 hover 行(时间戳 · 时长 · 工具数之后)显示紧凑用量:
 *  `· 1.2k tok · ¥0.0034`,无价目数据时仅显示 token 数。 */
export function MessageUsageBadge({
  usage,
  model,
  messageId,
}: {
  usage: unknown
  model?: string
  messageId: string
}) {
  const t = useTranslations('chat')
  const price = useModelPriceCny(model)
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : 0
  if (total <= 0) return null
  const { totalCost } = computeMessageCostCny(price, {
    promptTokens: typeof u.promptTokens === 'number' ? u.promptTokens : null,
    completionTokens: typeof u.completionTokens === 'number' ? u.completionTokens : null,
  })
  return (
    <Tooltip content={t('sessionUsage.pricingHint')}>
      <span
        className="text-muted-foreground/70"
        aria-label={t('messageUsage.ariaLabel')}
        data-testid={`message-usage-${messageId}`}
      >
        · {formatCompactTokens(total)} tok
        {totalCost !== null && <span> · ¥{totalCost.toFixed(4)}</span>}
      </span>
    </Tooltip>
  )
}

// 2026-08-02:消息交互按钮基础样式(完全复用原项目 AIChat.vue 统一按钮系统)
// --fcd-btn-size:28px → h-7 w-7 | --fcd-btn-radius:6px → rounded-md | --fcd-btn-icon-size:16px → h-4 w-4
// _message-list.scss .message-actions: display:flex; gap:8px; opacity:1(始终显示)
export const ACTION_BTN_CLASS =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** 近似展示汇率(USD→CNY):仅用于消息底部成本徽章的展示换算,权威成本以后端 costUsd 为准。
 * 非实时汇率,不用于账单/扣费。 */
const USD_TO_CNY = 7.2

/** 毫秒 → 紧凑秒串(用于首 token / 总耗时):<1s 显示两位小数,>=1s 一位小数。 */
function formatSeconds(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 分隔点(列表项之间的视觉分隔,非文案,可直接硬编码)。 */
const SEP = '·'

/**
 * D1 消息级计量徽章行(2026-09-19 立):AI 回复消息底部展示紧凑用量。
 * 形如 `1.2k tok · 3.4s · 首 0.8s · deepseek-chat · ¥0.01`,各项条件性渲染:
 *   - tokens:formatCompactTokens 千分位缩写(1.2k),totalTokens<=0 不渲染整行
 *   - duration:总耗时(仅 durationMs>0)
 *   - firstToken:首 token 延迟(仅 firstTokenMs>0)
 *   - model:实际计费模型(仅非空)
 *   - cost:costUsd→CNY(仅 costUsd 非 null);为 null 不显示
 * 样式 text-xs muted;hover 用 Tooltip 展示完整明细(不用原生 title)。
 * 仅对 usageByMessageId 有数据的消息渲染(无数据返回 null)。
 */
export function MessageUsageMetrics({
  messageId,
  fallbackModel,
}: {
  messageId: string
  fallbackModel?: string
}) {
  const t = useTranslations('ai.message.metrics')
  const tc = useTranslations('chat')
  // zustand selector 返回既有对象引用(undefined 或 usage 对象),不构造新数组/对象,符合项目规则。
  const usage = useChatStore((s) => s.usageByMessageId[messageId])
  if (!usage || usage.totalTokens <= 0) return null

  const model = usage.model || fallbackModel || ''
  const costCny = usage.costUsd !== null ? usage.costUsd * USD_TO_CNY : null

  // 明细(悬浮展示):复用 chat.messageUsage/sessionUsage 既有键 + ai.message.metrics.reasoningTokens
  const detail = (
    <div className="space-y-0.5 leading-4">
      <div className="mb-0.5 font-medium">{t('detailTitle')}</div>
      <div>
        {tc('messageUsage.total')}: <span className="tabular-nums">{usage.totalTokens}</span>
      </div>
      <div>
        {tc('sessionUsage.promptTokens')}:{' '}
        <span className="tabular-nums">{usage.promptTokens}</span>
      </div>
      <div>
        {tc('sessionUsage.completionTokens')}:{' '}
        <span className="tabular-nums">{usage.completionTokens}</span>
      </div>
      {usage.reasoningTokens !== null && (
        <div>
          {t('reasoningTokens')}: <span className="tabular-nums">{usage.reasoningTokens}</span>
        </div>
      )}
      {usage.firstTokenMs > 0 && (
        <div>
          {t('firstTokenDetail')}:{' '}
          <span className="tabular-nums">{formatSeconds(usage.firstTokenMs)}</span>
        </div>
      )}
      {usage.durationMs > 0 && (
        <div>
          {t('durationDetail')}:{' '}
          <span className="tabular-nums">{formatSeconds(usage.durationMs)}</span>
        </div>
      )}
      {model && (
        <div>
          {t('modelDetail')}: <span className="tabular-nums">{model}</span>
        </div>
      )}
      {costCny !== null && (
        <div>
          {t('costDetail')}: <span className="tabular-nums">¥{costCny.toFixed(2)}</span>
        </div>
      )}
    </div>
  )

  return (
    <Tooltip content={detail}>
      <span
        className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
        data-testid={`message-usage-metrics-${messageId}`}
        aria-label={tc('messageUsage.ariaLabel')}
      >
        <span data-testid="usage-total" className="tabular-nums">
          {formatCompactTokens(usage.totalTokens)} {t('tokens')}
        </span>
        {usage.durationMs > 0 && (
          <span data-testid="usage-duration" className="tabular-nums">
            {SEP} {formatSeconds(usage.durationMs)}
          </span>
        )}
        {usage.firstTokenMs > 0 && (
          <span data-testid="usage-first-token" className="tabular-nums">
            {SEP} {t('firstToken', { s: formatSeconds(usage.firstTokenMs) })}
          </span>
        )}
        {model && (
          <span data-testid="usage-model" className="tabular-nums">
            {SEP} {model}
          </span>
        )}
        {costCny !== null && (
          <span data-testid="usage-cost" className="tabular-nums">
            {SEP} {t('cost', { cost: costCny.toFixed(2) })}
          </span>
        )}
      </span>
    </Tooltip>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
