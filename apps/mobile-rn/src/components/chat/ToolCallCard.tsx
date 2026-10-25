// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯抽取:从 ChatScreen renderMessage 抽出「终端任务 / 工具调用」最小可视态(D113 流中 diff /
// D119 并行工具后续票面的挂载点)。零行为/视觉变更。

import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import { useI18n } from '../../i18n'
import {
  formatDurationMs,
  type AssistantExecutionViz,
  type ToolCallItem,
} from '../../utils/chat-render-model'

const styles = StyleSheet.create({
  // ── D135 执行/交互帧最小可视态 ──
  execRows: {
    marginTop: rpx(8),
    gap: rpx(4),
  },
  execRowText: {
    fontSize: rpx(12),
    color: tokens.text.tertiary,
  },
  // ── D113 工具调用行(流中 diff 预览的挂载点) ──
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
    // 与 execRowText 同行高视觉对齐(终端行是裸 Text,这里补一点垂直呼吸)
    paddingVertical: rpx(1),
  },
  toolRowText: {
    fontSize: rpx(12),
    color: tokens.text.tertiary,
    flexShrink: 1,
  },
  toolRowStatusRunning: { color: tokens.text.secondary },
  toolRowStatusSuccess: { color: tokens.success.deep },
  toolRowStatusError: { color: tokens.error.text },
  toolDiffBlock: {
    marginTop: rpx(2),
    padding: rpx(8),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    gap: rpx(4),
  },
  toolDiffLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rpx(8),
  },
  toolDiffLabel: {
    fontSize: rpx(11),
    color: tokens.text.tertiary,
  },
  toolDiffToggle: {
    fontSize: rpx(11),
    color: tokens.text.secondary,
  },
  // 等宽字体与 ChatMessageList.codeBlockContent 同一 Platform.select 口径
  toolDiffContent: {
    fontSize: rpx(11),
    lineHeight: rpx(16),
    color: tokens.text.secondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
})

/** 工具三态 → 行内状态措辞(running 的"执行中…"是唯一进行时文案,终态不冒充完成语义) */
const TOOL_STATUS_LABEL: Record<ToolCallItem['status'], string> = {
  running: 'chat.toolRunning',
  success: 'chat.toolOk',
  error: 'chat.toolFail',
}

/** 工具三态 → 状态文字取色(running 用中性色,不用成功绿;error 用 error.text) */
const TOOL_STATUS_TEXT_STYLE = {
  running: styles.toolRowStatusRunning,
  success: styles.toolRowStatusSuccess,
  error: styles.toolRowStatusError,
} satisfies Record<ToolCallItem['status'], { color: string }>

/** D113 收起态预览行数上限;超出时末行补 "…" 交代"还有下文"(与 web 6 行同口径) */
const PARTIAL_DIFF_PREVIEW_LINES = 6

/** 收起态预览截断:≤上限原样返回;>上限取前 N 行且末行补 "…"(展开态不走此函数) */
function clampPartialDiffPreview(text: string): string {
  const lines = text.split('\n')
  if (lines.length <= PARTIAL_DIFF_PREVIEW_LINES) return text
  const head = lines.slice(0, PARTIAL_DIFF_PREVIEW_LINES)
  head[head.length - 1] = `${head[head.length - 1]}…`
  return head.join('\n')
}

/**
 * 来源徽标文案:builtin 不标注(核心工具集无需向用户交代);
 * plugin/mcp 优先 serverName,缺省回落来源码本身。
 */
function toolSourceLabel(call: ToolCallItem): string | null {
  if (call.serverSource === 'plugin' || call.serverSource === 'mcp') {
    return call.serverName ?? call.serverSource
  }
  return null
}

/**
 * D113 单个工具调用行:工具名 + 来源 + 三态 + 耗时。
 * running 且 partialDiff 非空时,头部下方挂「流中 diff 预览」折叠块
 * (默认收起,点头部整行切换;展开显示全部 partialDiff)。
 * success/error 不渲染预览块 —— partialDiff 已在 tool-result 到达时清空,
 * 最终 diff 以 result 为准(chat-render-model.applyToolCallEvent 口径)。
 * 纯展示:本行只有 expanded 一处本地 UI 状态,零副作用。
 */
function ToolCallRow({ call }: { call: ToolCallItem }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const source = toolSourceLabel(call)
  const durationText = formatDurationMs(call.durationMs)
  // 渲染条件与 web 对齐:仅 running 态 + 非空 partialDiff 才出预览块
  const partialDiff = call.status === 'running' && call.partialDiff ? call.partialDiff : undefined
  const header = (
    <Text style={styles.toolRowText} numberOfLines={1}>
      {call.name}
      {source ? ` · ${source}` : ''}
      <Text
        style={TOOL_STATUS_TEXT_STYLE[call.status]}
      >{` · ${t(TOOL_STATUS_LABEL[call.status])}`}</Text>
      {durationText ? ` · ${durationText}` : ''}
    </Text>
  )
  return (
    <View>
      {partialDiff ? (
        <Pressable
          style={styles.toolRow}
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? t('chat.diffCollapse') : t('chat.diffExpand')}
        >
          {header}
        </Pressable>
      ) : (
        <View style={styles.toolRow}>{header}</View>
      )}
      {partialDiff ? (
        <View style={styles.toolDiffBlock}>
          <View style={styles.toolDiffLabelRow}>
            <Text style={styles.toolDiffLabel}>流中 diff 预览</Text>
            <Text style={styles.toolDiffToggle}>
              {expanded ? t('teacher.detail.collapse') : t('teacher.detail.expand')}
            </Text>
          </View>
          <Text style={styles.toolDiffContent} selectable>
            {expanded ? partialDiff : clampPartialDiffPreview(partialDiff)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

interface ToolCallCardProps {
  /** 失败轮不渲染工具/终端可视态(对齐 renderMessage isFailed 守卫) */
  isFailed: boolean
  /** 本轮 assistant 消息的终端任务快照(对齐 executionVizById[item.id]?.terminalTasks) */
  terminalTasks: AssistantExecutionViz['terminalTasks']
  /** D113 本轮 assistant 消息的工具调用快照(对齐 executionVizById[item.id]?.toolCalls);
   *  与 terminalTasks 相互独立,任一有内容即渲染,都不空才整卡不渲染 */
  toolCalls?: ToolCallItem[]
}

/**
 * 终端任务最小可视态:命令 + 状态 + 耗时(完整终端面板在 N8n 屏,不在此复制)。
 * D113(文件写类工具流中 diff 预览)、D119(并行工具)等后续票面在此组件内演进,
 * 不触碰 renderMessage 主干。无任务 / 失败轮 → 渲染 null,与抽取前一致。
 */
export function ToolCallCard({ isFailed, terminalTasks, toolCalls }: ToolCallCardProps) {
  if (isFailed) return null
  const hasToolCalls = !!toolCalls && toolCalls.length > 0
  if ((!terminalTasks || terminalTasks.length === 0) && !hasToolCalls) return null
  return (
    <View style={styles.execRows}>
      {terminalTasks?.map((task) => (
        <Text key={task.id} style={styles.execRowText} numberOfLines={1}>
          {`$ ${task.command} · ${task.status}${
            task.durationMs !== undefined ? ` · ${formatDurationMs(task.durationMs)}` : ''
          }`}
        </Text>
      ))}
      {toolCalls?.map((call) => (
        <ToolCallRow key={call.id} call={call} />
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
