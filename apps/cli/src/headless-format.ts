/**
 * P1-5 Headless 多格式输出 — 序列化器与格式解析。
 *
 * 灵感来源:grok-build 的 LeaderOutput/HeadlessFormat(Rust enum,支持 text/json/markdown/yaml)。
 * 简化策略(做减法):
 *   - 不引入外部 yaml 库,自实现 30 行极简序列化器(只覆盖常见类型)
 *   - 流式输出,不缓冲整个会话(内存友好,长任务不爆)
 *
 * 从 agent.ts 抽出此模块以便独立单元测试(不污染 agent.ts 公共 API)。
 */

import type { AgentStopReason, TokenUsage } from './commands/agent.js'

export type OutputFormat = 'text' | 'json' | 'markdown' | 'yaml'

export type HeadlessEvent =
  | { type: 'start'; prompt: string; model: string; workspace: string }
  | { type: 'message_delta'; text: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; output: string }
  | { type: 'iteration'; count: number; max: number }
  | { type: 'error'; message: string }
  | { type: 'complete'; stopReason: AgentStopReason; iterations: number; usage: TokenUsage }

/**
 * 极简 YAML 序列化器(不引入外部依赖)。
 * 支持类型:null / boolean / number / string / array / object。
 * 缩进 2 空格,数组元素用 `- ` 前缀。
 * 字符串仅在含特殊字符时用双引号(JSON 兼容),其余直接输出。
 */
export function toYaml(obj: unknown, indent = 0): string {
  const pad = ' '.repeat(indent)
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'boolean') return obj ? 'true' : 'false'
  if (typeof obj === 'number') return Number.isFinite(obj) ? String(obj) : 'null'
  if (typeof obj === 'string') {
    if (obj.length === 0) return '""'
    // 含换行/特殊字符的用 JSON 双引号(yaml 兼容);简单标识符风格字符串直接输出
    // 注意:\s 在正则中包含 \n\r\t,所以单独排除换行符
    if (!/[\n\r\t:#{}`"'&*!|>%@]/.test(obj)
      && /^[A-Za-z0-9_\-\.\/\p{L}][A-Za-z0-9_\-\.\/ \p{L}]*$/u.test(obj)
      && !/^(true|false|null|yes|no|on|off|\d)/.test(obj)) return obj
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => {
      if (item === null || item === undefined) return `${pad}- null`
      if (typeof item === 'object') {
        // 对象/数组:第一行紧跟 - ,后续行缩进对齐
        const sub = toYaml(item, indent + 2)
        const firstLineIndent = ' '.repeat(indent + 2)
        const subWithoutFirstIndent = sub.startsWith(firstLineIndent) ? sub.slice(firstLineIndent.length) : sub
        return `${pad}- ${subWithoutFirstIndent}`
      }
      return `${pad}- ${toYaml(item, 0)}`
    }).join('\n')
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    return entries.map(([k, v]) => {
      if (v === null || v === undefined) return `${pad}${k}: null`
      if (typeof v === 'object') {
        const sub = toYaml(v, indent + 2)
        if (sub === '[]' || sub === '{}') return `${pad}${k}: ${sub}`
        return `${pad}${k}:\n${sub}`
      }
      return `${pad}${k}: ${toYaml(v, 0)}`
    }).join('\n')
  }
  return String(obj)
}

/** 将单个事件转为 markdown 片段(适合拼接成完整 markdown 报告) */
export function eventToMarkdown(event: HeadlessEvent): string {
  switch (event.type) {
    case 'start':
      return `## 🤖 Agent 启动\n\n- **模型**: ${event.model}\n- **工作区**: ${event.workspace}\n- **任务**: ${event.prompt}\n`
    case 'message_delta':
      return event.text
    case 'tool_call':
      return `\n### 🔧 工具调用: \`${event.name}\`\n\n\`\`\`json\n${JSON.stringify(event.arguments, null, 2)}\n\`\`\`\n`
    case 'tool_result': {
      const icon = event.success ? '✓' : '✗'
      const status = event.success ? '成功' : '失败'
      const truncated = event.output.length > 1000 ? event.output.slice(0, 1000) + '\n...(truncated)' : event.output
      return `\n#### ${icon} 工具结果 [${status}]\n\n\`\`\`\n${truncated}\n\`\`\`\n`
    }
    case 'iteration':
      return `\n<!-- iteration ${event.count}/${event.max} -->\n`
    case 'error':
      return `\n> ❌ **错误**: ${event.message}\n`
    case 'complete': {
      const u = event.usage
      const cost = u.estimatedCostUsd > 0 ? `$${u.estimatedCostUsd.toFixed(4)}` : 'plan 套餐'
      return `\n---\n\n## ✨ 完成\n\n- **停止原因**: ${event.stopReason}\n- **迭代轮次**: ${event.iterations}\n- **Tokens**: ${u.totalTokens} (prompt ${u.promptTokens} + completion ${u.completionTokens})\n- **成本**: ${cost}\n`
    }
    default:
      return ''
  }
}

/** 解析 outputFormat 字符串,非法值默认 text */
export function parseOutputFormat(v: unknown): OutputFormat {
  if (v === 'text' || v === 'json' || v === 'markdown' || v === 'yaml') return v
  return 'text'
}

/** 把单个事件序列化为指定格式的字符串(text 模式返回空字符串,由调用方走 chalk/ora 路径) */
export function formatHeadlessEvent(event: HeadlessEvent, format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(event) + '\n'
  if (format === 'markdown') return eventToMarkdown(event)
  if (format === 'yaml') return '---\n' + toYaml(event) + '\n'
  return '' // text
}
