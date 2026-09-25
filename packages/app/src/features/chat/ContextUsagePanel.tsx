// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius } from '@ihui/design-tokens'
import type { ChatScreenMessage } from '@ihui/types'
import type { TFunction } from '@ihui/types'
import {
  LABEL_SENTINELS,
  computeContextAttribution,
  formatShare,
  type AttributionDetail,
  type AttributionKey,
  type AttributionMessage,
} from '@ihui/shared/utils'

/**
 * 上下文占用归因面板(RN 消费端)— 消费共享引擎 computeContextAttribution,
 * 与 web 端 context-usage-ring 同一取数语义:明细行优先展示 tailPreview(尾部摘录),
 * 哨兵键(@system-prompt / @unnamed)经 i18n 词表翻译,kind==='result' 追加结果后缀。
 *
 * 词表键静态列举在 SEGMENT_LABEL_KEYS(守门要求 useTranslations 命名空间可静态解析
 * 的同款纪律,RN 侧是注入式 t,同样不拼字符串)。
 */
type SegmentLabelKey =
  | 'segSystem'
  | 'segToolSchema'
  | 'segSkill'
  | 'segRoleUser'
  | 'segRoleAssistant'
  | 'segRoleToolCall'
  | 'segRoleToolResult'

const SEGMENT_LABEL_KEYS: Record<AttributionKey, `chat.contextUsage.${SegmentLabelKey}`> = {
  system: 'chat.contextUsage.segSystem',
  toolSchema: 'chat.contextUsage.segToolSchema',
  skill: 'chat.contextUsage.segSkill',
  roleUser: 'chat.contextUsage.segRoleUser',
  roleAssistant: 'chat.contextUsage.segRoleAssistant',
  roleToolCall: 'chat.contextUsage.segRoleToolCall',
  roleToolResult: 'chat.contextUsage.segRoleToolResult',
}

/** 段色(RN token 档位,不新增色值):7 档在现有调色板内的最近语义映射 */
function segmentColor(tk: AppThemeTokens, key: AttributionKey): string {
  switch (key) {
    case 'system':
      return tk.brandAccent.DEFAULT
    case 'toolSchema':
      return tk.warning.amber
    case 'skill':
      return tk.brandAccent.deep
    case 'roleUser':
      return tk.success.DEFAULT
    case 'roleAssistant':
      return tk.text.secondary
    case 'roleToolCall':
      return tk.warning.amberText
    case 'roleToolResult':
      return tk.danger.DEFAULT
  }
}

interface ContextUsagePanelProps {
  t: TFunction
  messages: ChatScreenMessage[]
  /** 当前模型窗口容量(token);0 = 未知,占比显示为 — */
  maxTokens: number
  colorScheme: 'light' | 'dark'
}

export function ContextUsagePanel({ t, messages, maxTokens, colorScheme }: ContextUsagePanelProps) {
  const tk = getTokens(colorScheme)
  const [expanded, setExpanded] = useState(false)
  const [openSegment, setOpenSegment] = useState<AttributionKey | null>(null)

  const attribution = useMemo(
    () =>
      computeContextAttribution({
        // 共享屏消息契约只有 {role, content};RN 链路无工具调用帧,与 web 端
        // toolCalls 缺省时的口径一致(该段如实不出现,不伪造)。
        messages: messages.map((m): AttributionMessage => ({ role: m.role, content: m.content })),
        providerPromptTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      }),
    [messages],
  )

  const usedTokens = attribution.totalTokens
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 0
  const percent = Math.round(ratio * 100)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 明细行可读文本:与 web useDetailLabelTranslator 同一优先级(哨兵 → tailPreview/label → 后缀) */
  const translateDetail = (detail: AttributionDetail): string => {
    if (detail.label === LABEL_SENTINELS.systemPrompt) return t('chat.contextUsage.segSystemPrompt')
    if (detail.label === LABEL_SENTINELS.unnamed) return t('chat.contextUsage.unnamedItem')
    const preview = detail.tailPreview ?? detail.label
    if (detail.kind === 'result') {
      return `${preview || t('chat.contextUsage.unnamedItem')} · ${t('chat.contextUsage.resultSuffix')}`
    }
    return preview || t('chat.contextUsage.unnamedItem')
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.summary}>
          {percent}% · {usedTokens.toLocaleString()} /{' '}
          {maxTokens > 0 ? maxTokens.toLocaleString() : '—'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t('chat.contextUsage.title')}</Text>
          <View style={styles.bar}>
            {attribution.segments
              .filter((seg) => seg.observed && seg.tokens > 0)
              .map((seg) => (
                <View
                  key={seg.key}
                  style={{
                    height: '100%',
                    width: `${Math.min(seg.share * 100, 100)}%`,
                    backgroundColor: segmentColor(tk, seg.key),
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
                <Pressable
                  onPress={() => expandable && setOpenSegment(open ? null : seg.key)}
                  accessibilityRole={expandable ? 'button' : undefined}
                  accessibilityState={expandable ? { expanded: open } : undefined}
                  style={styles.row}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: seg.observed
                          ? segmentColor(tk, seg.key)
                          : tk.text.tertiary,
                      },
                    ]}
                  />
                  <Text style={[styles.rowLabel, !seg.observed && styles.dim]}>
                    {t(SEGMENT_LABEL_KEYS[seg.key])}
                  </Text>
                  {!open && topDetail ? (
                    <Text style={[styles.topDetail, styles.dim]} numberOfLines={1}>
                      {translateDetail(topDetail)}
                    </Text>
                  ) : null}
                  <Text style={[styles.num, !seg.observed && styles.dim]}>
                    {seg.observed ? seg.tokens.toLocaleString() : '—'}
                  </Text>
                  <Text style={[styles.num, styles.dim]}>
                    {seg.observed ? formatShare(seg.share) : '—'}
                  </Text>
                </Pressable>

                {!seg.observed ? (
                  <Text style={[styles.note, styles.dim]}>
                    {seg.unobservedCode === 'server-only'
                      ? t('chat.contextUsage.unobservedServerOnly')
                      : t('chat.contextUsage.unobservedNotSupplied')}
                  </Text>
                ) : null}

                {expandable && open ? (
                  <View style={styles.details}>
                    {seg.details.map((detail, idx) => (
                      <View key={`${detail.label}-${idx}`} style={styles.detailRow}>
                        <Text style={[styles.detailText, styles.dim]} numberOfLines={2}>
                          {translateDetail(detail)}
                        </Text>
                        <Text style={styles.num}>{detail.tokens.toLocaleString()}</Text>
                      </View>
                    ))}
                    {seg.truncated > 0 ? (
                      <Text style={[styles.note, styles.dim]}>
                        {t('chat.contextUsage.detailsTruncated', { count: String(seg.truncated) })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          })}

          {attribution.residualTokens > 0 ? (
            <View style={styles.row}>
              <Text style={[styles.rowLabel, styles.dim]}>
                {t('chat.contextUsage.residualLabel')}
              </Text>
              <Text style={styles.num}>{attribution.residualTokens.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 12, paddingTop: 6 },
    summary: { fontSize: 12, color: tk.text.secondary, fontVariant: ['tabular-nums'] },
    panel: {
      marginTop: 6,
      padding: 8,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
    },
    panelTitle: { fontSize: 12, fontWeight: '600', color: tk.text.primary, marginBottom: 6 },
    bar: {
      flexDirection: 'row',
      height: 6,
      borderRadius: rnRadius.xs,
      overflow: 'hidden',
      backgroundColor: tk.border.light,
      marginBottom: 6,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
    dot: { width: 8, height: 8, borderRadius: rnRadius.xs },
    rowLabel: { fontSize: 11, color: tk.text.primary },
    topDetail: { flex: 1, fontSize: 10 },
    num: { fontSize: 11, color: tk.text.primary, fontVariant: ['tabular-nums'] },
    dim: { color: tk.text.secondary },
    note: { fontSize: 10, paddingLeft: 14, paddingVertical: 2 },
    details: {
      marginLeft: 14,
      marginBottom: 4,
      padding: 6,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.light,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1 },
    detailText: { flex: 1, fontSize: 10 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
