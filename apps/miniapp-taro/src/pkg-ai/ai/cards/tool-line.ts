// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具活动行的"取词 + 措辞"层(miniapp-taro 端内唯一入口)。
 *
 * 消息流活动行语言 = 状态 · 功能名 · 对象 · 结果度量 · 耗时,其中:
 * - 语义推导(功能名键 / 对象 / 度量 / ± 行数)一律走共享层 `@ihui/shared/chat#describeToolCall`,
 *   端内不再自行从 args/result 现挖,保证与 web / extension / mobile-rn / cli 同一口径;
 * - 本文件只负责"把视图模型 + i18n 键变成本地化文本",并且**只碰取词**,不产任何硬编码文案。
 *
 * 取词约定(踩过坑,必须遵守):小程序端 t 用点号全路径键,状态条与工具行共用
 * `taskStatus` 命名空间(权威源在 packages/i18n/messages/shared/),
 * 非中文 4 语言经离线压缩语言包打包;新增键若没进包,非中文下会静默回退中文,
 * 因此加键后必须重跑 `pnpm gen:i18n`。
 */
import {
  describeMcpToolActivity,
  describeToolCall,
  humanizeToolText,
  toolDisplayKey,
  type ToolCallView as SharedToolCallView,
  type ToolMetricKind,
} from '@ihui/shared/chat'
import { toSharedToolCallStatus, type ToolCallView } from '@/pkg-ai/ai/cards/types'

/** 端内 t 的最小签名(hook 与模块级 t 通用) */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/** toolDisplayKey 返回裸键,taro 的键在 taskStatus 命名空间下,此处统一加前缀 */
export function toDisplayKey(key: string): string {
  return `taskStatus.${key}`
}

/** 工具码名 → 本地化功能名;映射不到(插件 / MCP 动态名)原样回落,由调用方决定是否加"调用"前缀 */
export function toolDisplayName(name: string, t: TranslateFn): string {
  const key = toolDisplayKey(name)
  return key ? t(toDisplayKey(key)) : name
}

/** 自由文本(计划步骤标题 / 说明)里的英文工具码名 → 本地化功能名,界面禁止直显码名 */
export function localizeToolText(text: string, t: TranslateFn): string {
  return humanizeToolText(text, (key) => t(toDisplayKey(key)))
}

/**
 * 工具行的主标题:命中映射 → 功能名;未命中(动态名)→ "调用 {name}"。
 * 任何分支都不会把 read_file 这类码名裸着放进界面(动态名本就无中文名可译)。
 *
 * D83 接线:MCP 调用先走共享层 server×tool 定制措辞(describeMcpToolActivity,
 * 回落链 server-tool → server → tool → 功能名 → 码名,取不到定制即落回下方既有逻辑)。
 * error 态刻意不进双时态链 —— 对失败的调用声称"已 X"是假陈述(与 web 同一口径)。
 */
export function toolRowTitle(call: ToolCallView, t: TranslateFn): string {
  if (call.serverSource === 'mcp' && call.status !== 'error') {
    const line = describeMcpToolActivity({
      serverName: call.serverName ?? null,
      toolName: call.name,
      state: call.status === 'running' ? 'running' : 'completed',
      translate: (key, params) => t(toDisplayKey(key), params),
    })
    if (line !== call.name) return line
  }
  const key = toolDisplayKey(call.name)
  return key ? t(toDisplayKey(key)) : t(toDisplayKey('activityTool'), { tool: call.name })
}

/** 结果度量文本("128 行" / "2 个结果" / "5 个文件");拿不到值一律空串,绝不显示 0 占位 */
export function formatToolMetric(
  kind: ToolMetricKind,
  value: number | null | undefined,
  t: TranslateFn,
): string {
  if (kind === 'none' || value === null || value === undefined || value < 0) return ''
  const unitKey =
    kind === 'lines' || kind === 'chars'
      ? 'unitLines'
      : kind === 'files'
        ? 'unitFiles'
        : 'unitResults'
  return t(toDisplayKey(unitKey), { n: value })
}

/**
 * ± 行数文本(工具行与状态条共用一条判据):-1 / 负数 = 行数未知 → 对应项 null 不渲染,
 * 绝不用 0 占位(0 会被读成"没改",与"不知道改了多少"是两回事)。
 */
export function formatDeltaParts(
  added: number,
  removed: number,
  t: TranslateFn,
): { added: string | null; removed: string | null } {
  return {
    added: added >= 0 ? t(toDisplayKey('addedCount'), { n: added }) : null,
    removed: removed >= 0 ? t(toDisplayKey('removedCount'), { n: removed }) : null,
  }
}

/** 单次工具调用的 ± 行数(写类工具才由调用方取用) */
export function toolDelta(
  view: SharedToolCallView,
  t: TranslateFn,
): { added: string | null; removed: string | null } {
  return formatDeltaParts(view.added, view.removed, t)
}

/** 一次工具调用 → 活动行视图模型(共享层单一真相源) */
export function viewToolCall(call: ToolCallView): SharedToolCallView {
  return describeToolCall({
    toolName: call.name,
    args: call.args,
    result: call.result,
    status: toSharedToolCallStatus(call.status),
  })
}

/**
 * 流式活动列表(纯文本一行)的措辞:功能名 · 对象 · 度量。
 * 用于 chat.tsx 把 SSE 事件压成 text 的场景,与工具卡同一取词链路。
 */
export function toolActivityText(
  call: ToolCallView,
  t: TranslateFn,
  opts?: { withMetric?: boolean },
): string {
  const view = viewToolCall(call)
  const parts: string[] = [toolRowTitle(call, t)]
  if (view.subject) parts.push(view.subject)
  if (opts?.withMetric) {
    const metric = formatToolMetric(view.metricKind, view.metricValue, t)
    if (metric) parts.push(metric)
    if (view.writesFile) {
      const delta = toolDelta(view, t)
      const line = [delta.added, delta.removed].filter(Boolean).join(' ')
      if (line) parts.push(line)
    }
  }
  return parts.join(' · ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
