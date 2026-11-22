// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useI18n, useTt } from '@/i18n'
import type { ChatMessage } from '@/api'
import type { ContextLedger, ContextLedgerCategory } from '@ihui/shared'
import {
  LABEL_SENTINELS,
  computeContextAttribution,
  formatShare,
  type AttributionDetail,
  type AttributionKey,
  type AttributionMessage,
} from '@ihui/shared/utils'
import type { SegmentLabelKey } from '@ihui/types'
import { buildLedgerRows, formatLedgerPercent, tokenizerText } from './chat-cap-text'

/**
 * 上下文占用归因条(小程序消费端)— 消费共享引擎 computeContextAttribution,
 * 与 web 端 context-usage-ring 同一取数语义:明细行优先展示 tailPreview(尾部摘录),
 * 哨兵键(@system-prompt / @unnamed)经 i18n 词表翻译,kind==='result' 追加结果后缀。
 *
 * 词表键一律是 `ai.contextUsage.*` 下的静态字面量(不拼字符串)。
 */
const SEGMENT_LABEL_KEYS: Record<AttributionKey, `ai.contextUsage.${SegmentLabelKey}`> = {
  system: 'ai.contextUsage.segSystem',
  toolSchema: 'ai.contextUsage.segToolSchema',
  skill: 'ai.contextUsage.segSkill',
  roleUser: 'ai.contextUsage.segRoleUser',
  roleAssistant: 'ai.contextUsage.segRoleAssistant',
  roleToolCall: 'ai.contextUsage.segRoleToolCall',
  roleToolResult: 'ai.contextUsage.segRoleToolResult',
}

/** 段色:只用全端 token 变量,不硬编码色值(check-miniapp-taro-style-parity 同口径) */
const SEGMENT_COLOR_VARS: Record<AttributionKey, string> = {
  system: 'var(--color-brand-accent)',
  toolSchema: 'var(--color-warning)',
  skill: 'var(--color-brand-accent-deep)',
  roleUser: 'var(--color-success)',
  roleAssistant: 'var(--color-muted-foreground)',
  roleToolCall: 'var(--color-warning)',
  roleToolResult: 'var(--color-destructive)',
}

/** 批次 3:七类账本的固定文案(词表键为静态字面量,缺失时用端内中文兜底)。 */
const LEDGER_LABEL: Record<ContextLedgerCategory, { key: string; fallback: string }> = {
  system_prompt: { key: 'ai.contextLedger.systemPrompt', fallback: '系统提示词' },
  system_tools: { key: 'ai.contextLedger.systemTools', fallback: '系统工具' },
  skills: { key: 'ai.contextLedger.skills', fallback: '技能' },
  messages: { key: 'ai.contextLedger.messages', fallback: '消息' },
  other: { key: 'ai.contextLedger.other', fallback: '其他' },
  free_space: { key: 'ai.contextLedger.freeSpace', fallback: '空闲空间' },
  auto_compact: { key: 'ai.contextLedger.autoCompact', fallback: '压缩预留' },
}

/** free_space 固定中性色;其余沿用归因条的同一套 token。 */
const LEDGER_COLOR_VARS: Record<ContextLedgerCategory, string> = {
  system_prompt: 'var(--color-brand-accent)',
  system_tools: 'var(--color-warning)',
  skills: 'var(--color-brand-accent-deep)',
  messages: 'var(--color-success)',
  other: 'var(--color-warning)',
  free_space: 'var(--color-muted-foreground)',
  auto_compact: 'var(--color-destructive)',
}

interface ContextUsageStripProps {
  messages: ChatMessage[]
  /** 当前模型窗口容量(token);0 = 未知,占比显示为 — */
  maxTokens: number
  /** G-403(2026-10-07):prompt 缓存命中读 token —— 数字(含 0)=上游真回报;
   *  null/缺省 = 没采到(未知),归因条显示"不可得"而非 0(与 web ring 同一口径)。 */
  cacheReadTokens?: number | null
  /** prompt 缓存写入 token(Anthropic 系才有);三态同上 */
  cacheWriteTokens?: number | null
  /** 批次 3:最近一轮七类上下文账本;null/缺省 = 没有账本,保留现有估算展示。 */
  contextLedger?: ContextLedger | null
  /** 批次 3:该账本对应的审计轮次(查询行 turnIndex);null = 流内实时帧,退回消息条数计轮。 */
  contextLedgerTurn?: number | null
}

export default function ContextUsageStrip({
  messages,
  maxTokens,
  cacheReadTokens = null,
  cacheWriteTokens = null,
  contextLedger = null,
  contextLedgerTurn = null,
}: ContextUsageStripProps) {
  const [expanded, setExpanded] = useState(false)
  const [openSegment, setOpenSegment] = useState<AttributionKey | null>(null)
  const [ledgerExpanded, setLedgerExpanded] = useState(false)

  const attribution = useMemo(
    () =>
      computeContextAttribution({
        messages: messages.map((m): AttributionMessage => ({
          role: m.role,
          content: m.content,
          error: m.error,
        })),
        providerPromptTokens: null,
        // G-403:由宿主(chat.tsx onUsage 帧)透传;没采到保持 null —— 渲染位折叠,
        // 绝不在此造 0(0 = "一次都没命中"的肯定结论,不是"没量到")。
        cacheReadTokens: cacheReadTokens ?? null,
        cacheWriteTokens: cacheWriteTokens ?? null,
      }),
    [messages, cacheReadTokens, cacheWriteTokens],
  )

  // t 由页面级 I18nProvider 提供(useI18n 是端内唯一取词通道)
  const { t } = useI18n()
  const tt = useTt()

  const usedTokens = attribution.totalTokens
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 0
  const percent = Math.round(ratio * 100)
  // 批次 3:账本轮次优先用查询行 turnIndex(审计口径);流内实时帧没有该字段,
  // 退回当前会话助手回复条数,保证"第 N 轮"在首屏/流式两种状态下都可读。
  const assistantTurns = messages.filter((m) => m.role === 'assistant').length
  const ledgerRound = contextLedgerTurn ?? assistantTurns
  const ledgerRows = contextLedger ? buildLedgerRows(contextLedger) : []

  /** 明细行可读文本:与 web useDetailLabelTranslator 同一优先级(哨兵 → tailPreview/label → 后缀) */
  const translateDetail = (detail: AttributionDetail): string => {
    if (detail.label === LABEL_SENTINELS.systemPrompt) return t('ai.contextUsage.segSystemPrompt')
    if (detail.label === LABEL_SENTINELS.unnamed) return t('ai.contextUsage.unnamedItem')
    const preview = detail.tailPreview ?? detail.label
    if (detail.kind === 'result') {
      return `${preview || t('ai.contextUsage.unnamedItem')} · ${t('ai.contextUsage.resultSuffix')}`
    }
    return preview || t('ai.contextUsage.unnamedItem')
  }

  return (
    <View className="ctx-usage" hoverClass="opacity-60" onClick={() => setExpanded((v) => !v)}>
      <Text className="ctx-usage-summary">
        {percent}% · {usedTokens.toLocaleString()} /{' '}
        {maxTokens > 0 ? maxTokens.toLocaleString() : '—'}
      </Text>
      {expanded ? (
        <View className="ctx-usage-panel">
          <Text className="ctx-usage-title">{t('ai.contextUsage.title')}</Text>
          <View className="ctx-usage-bar">
            {attribution.segments
              .filter((seg) => seg.observed && seg.tokens > 0)
              .map((seg) => (
                <View
                  key={seg.key}
                  className="ctx-usage-bar-seg"
                  style={{
                    width: `${Math.min(seg.share * 100, 100)}%`,
                    background: SEGMENT_COLOR_VARS[seg.key],
                  }}
                />
              ))}
          </View>
          {attribution.segments.map((seg) => {
            const expandable = seg.observed && seg.details.length > 0
            const topDetail = expandable ? seg.details[0] : undefined
            const open = openSegment === seg.key
            return (
              <View key={seg.key}>
                <View
                  className="ctx-usage-row"
                  hoverClass="opacity-60"
                  onClick={(e) => {
                    if (!expandable) return
                    e.stopPropagation()
                    setOpenSegment(open ? null : seg.key)
                  }}
                >
                  <View
                    className="ctx-usage-dot"
                    style={{
                      background: seg.observed
                        ? SEGMENT_COLOR_VARS[seg.key]
                        : 'var(--color-muted-foreground)',
                    }}
                  />
                  <Text className="ctx-usage-row-label">{t(SEGMENT_LABEL_KEYS[seg.key])}</Text>
                  {!open && topDetail ? (
                    <Text className="ctx-usage-top-detail">{translateDetail(topDetail)}</Text>
                  ) : null}
                  <Text className="ctx-usage-num">
                    {seg.observed ? seg.tokens.toLocaleString() : '—'}
                  </Text>
                  <Text className="ctx-usage-num ctx-usage-num-dim">
                    {seg.observed ? formatShare(seg.share) : '—'}
                  </Text>
                </View>
                {!seg.observed ? (
                  <Text className="ctx-usage-note">
                    {seg.unobservedCode === 'server-only'
                      ? t('ai.contextUsage.unobservedServerOnly')
                      : t('ai.contextUsage.unobservedNotSupplied')}
                  </Text>
                ) : null}
                {expandable && open ? (
                  <View className="ctx-usage-details">
                    {seg.details.map((detail, idx) => (
                      <View key={`${detail.label}-${idx}`} className="ctx-usage-detail-row">
                        <Text className="ctx-usage-detail-text">{translateDetail(detail)}</Text>
                        <Text className="ctx-usage-num">{detail.tokens.toLocaleString()}</Text>
                      </View>
                    ))}
                    {seg.truncated > 0 ? (
                      <Text className="ctx-usage-note">
                        {t('ai.contextUsage.detailsTruncated', { count: String(seg.truncated) })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          })}
          {attribution.residualTokens > 0 ? (
            <View className="ctx-usage-row">
              <Text className="ctx-usage-row-label ctx-usage-dim">
                {t('ai.contextUsage.residualLabel')}
              </Text>
              <Text className="ctx-usage-num">{attribution.residualTokens.toLocaleString()}</Text>
            </View>
          ) : null}
          {/* 批次 3:七类上下文账本(固定顺序;free_space 中性色)。账本缺席时整块不渲染,
              上方的估算归因仍照旧 —— "查询失败静默回退现有估算"的落点就在这里。 */}
          {contextLedger ? (
            <View className="ctx-usage-ledger">
              <View
                className="ctx-usage-ledger-head"
                hoverClass="opacity-60"
                onClick={(e) => {
                  e.stopPropagation()
                  setLedgerExpanded((v) => !v)
                }}
              >
                <Text className="ctx-usage-ledger-title">
                  {tt('ai.contextLedger.title', '上下文七类明细')} ·{' '}
                  {tt('ai.contextLedger.round', '第 {n} 轮', {
                    n: String(Math.max(1, ledgerRound)),
                  })}{' '}
                  · {tokenizerText(contextLedger.tokenizer)}
                </Text>
                <Text className="ctx-usage-ledger-toggle">
                  {ledgerExpanded
                    ? tt('ai.contextLedger.collapse', '收起')
                    : tt('ai.contextLedger.expand', '展开')}
                </Text>
              </View>
              {ledgerExpanded ? (
                <View className="ctx-usage-ledger-panel">
                  {ledgerRows.map((row) => (
                    <View key={row.category} className="ctx-usage-ledger-row">
                      <View
                        className="ctx-usage-dot"
                        style={{ background: LEDGER_COLOR_VARS[row.category] }}
                      />
                      <Text className="ctx-usage-ledger-label">
                        {tt(LEDGER_LABEL[row.category].key, LEDGER_LABEL[row.category].fallback)}
                      </Text>
                      <Text className="ctx-usage-ledger-num">{row.tokens.toLocaleString()}</Text>
                      <Text className="ctx-usage-ledger-num ctx-usage-dim">
                        {formatLedgerPercent(row.percent)}
                      </Text>
                    </View>
                  ))}
                  <Text className="ctx-usage-note">
                    {contextLedger.contextLimit > 0
                      ? tt('ai.contextLedger.total', '已用 {used} / 上限 {limit} · {percent}', {
                          used: contextLedger.usedTokens.toLocaleString(),
                          limit: contextLedger.contextLimit.toLocaleString(),
                          percent: formatLedgerPercent(contextLedger.percentage),
                        })
                      : tt('ai.contextLedger.windowUnknown', '窗口未知 · 已用 {used}', {
                          used: contextLedger.usedTokens.toLocaleString(),
                        })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
