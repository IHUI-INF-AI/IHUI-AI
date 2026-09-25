// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import type { ChatMessage } from '@/api'
import {
  LABEL_SENTINELS,
  computeContextAttribution,
  formatShare,
  type AttributionDetail,
  type AttributionKey,
  type AttributionMessage,
} from '@ihui/shared/utils'

/**
 * 上下文占用归因条(小程序消费端)— 消费共享引擎 computeContextAttribution,
 * 与 web 端 context-usage-ring 同一取数语义:明细行优先展示 tailPreview(尾部摘录),
 * 哨兵键(@system-prompt / @unnamed)经 i18n 词表翻译,kind==='result' 追加结果后缀。
 *
 * 词表键一律是 `ai.contextUsage.*` 下的静态字面量(不拼字符串)。
 */
type SegmentLabelKey =
  | 'segSystem'
  | 'segToolSchema'
  | 'segSkill'
  | 'segRoleUser'
  | 'segRoleAssistant'
  | 'segRoleToolCall'
  | 'segRoleToolResult'

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

interface ContextUsageStripProps {
  messages: ChatMessage[]
  /** 当前模型窗口容量(token);0 = 未知,占比显示为 — */
  maxTokens: number
}

export default function ContextUsageStrip({ messages, maxTokens }: ContextUsageStripProps) {
  const [expanded, setExpanded] = useState(false)
  const [openSegment, setOpenSegment] = useState<AttributionKey | null>(null)

  const attribution = useMemo(
    () =>
      computeContextAttribution({
        messages: messages.map((m): AttributionMessage => ({
          role: m.role,
          content: m.content,
          error: m.error,
        })),
        providerPromptTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      }),
    [messages],
  )

  // t 由页面级 I18nProvider 提供(useI18n 是端内唯一取词通道)
  const { t } = useI18n()

  const usedTokens = attribution.totalTokens
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 0
  const percent = Math.round(ratio * 100)

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
    <View className="ctx-usage" onClick={() => setExpanded((v) => !v)}>
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
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
