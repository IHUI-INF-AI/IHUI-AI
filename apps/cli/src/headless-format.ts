// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P1-5 Headless 多格式输出 — 序列化器与格式解析。
 *
 * 灵感来源:参考行业 Agent 框架的 LeaderOutput/HeadlessFormat 设计(支持 text/json/markdown/yaml)。
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
  /**
   * D113(2026-09-27)流中 diff 预览帧 —— 载荷字段沿用 `@ihui/api-client` 的
   * `ToolDeltaEvent`(toolCallId / seq / partialText / truncated?),`partialText` 是
   * **累积**文本(整帧替换渲染,同 seq 重放幂等)。`name` 是本端补的关联线索:
   * headless 的 `tool_call`/`tool_result` 都没有 toolCallId,机器消费方只有靠工具名
   * 才能把这一串预览帧归到那一次调用上(派生算法与预算不在这里,见
   * `src/tools/file-edit-preview.ts` 唯一出口;本面**不得**自拼 JSON.stringify(args))。
   */
  | { type: 'tool_delta'; name: string; toolCallId: string; seq: number; partialText: string; truncated?: boolean }
  /**
   * 同一 toolCallId 的预览作废(工具落终态或流中断)。**清场靠这一条,而不是再追加一条
   * 预览**:消费方据此撤下预览,随后才渲染 tool_result —— 否则"将要写入什么"会与
   * "已经写成什么"同屏(与 web/RN/小程序"result 到达即清 partialDiff"同一条纪律)。
   */
  | { type: 'tool_delta_clear'; name: string; toolCallId: string }
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
    // D113:markdown 是**终态报告**,没有"更新同一 id"的撤回通道 —— 预览文本一旦落进
    // 报告,就在终态之后继续挂在里面,被读成"已经写成这样了"。所以这两条在 markdown
    // 模式刻意不出现在报告里(机器消费方走 `--output-format json`,逐帧带 toolCallId,
    // 由 tool_delta_clear 撤下)。不是漏接:发出去却撤不掉的预览比没有预览更坏。
    case 'tool_delta':
    case 'tool_delta_clear':
      return ''
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

// ==================== 票B:事件流的单一写者(2026-09-29 立)====================

/**
 * 谁持有这条事件流的写入权。
 *
 * 立论(机制出处:上游 ZCode CLI 的 prompt-command —— 它在提交结果之前先停订阅,
 * 于是"要么有常驻订阅、要么有 per-turn 回调,二者取其一;取证件不在版本控制里,
 * 所以这里只留机制不留路径,别让后来人去一个已经不存在的地方找证据):
 * 常驻订阅跨回合存活,所以"完成通知驱动的回合"的事件也在内;per-turn 回调只在那一次
 * 提交的范围里活着。两者**同时装**时,同一条事件被两个 sink 各写一次 = 一行重复的
 * NDJSON,而按 id 去重要求"两个 sink 的调用顺序可预期" —— 那是运行时约定,不是结构事实。
 * 上游因此用"二选一"而不是"双装 + 去重",本端照抄同一个形状:
 * **恰好一次由"谁拿到了写入权"决定,不由 sink 的先后决定。**
 */
export type HeadlessEventWriterSource = 'resident-subscription' | 'per-turn-callbacks'

/** 一条事件被挡下的原因。两档必须可分辨 —— "没人能写了"与"终止符已经落笔"是两件事。 */
export type HeadlessEventDropReason = 'detached' | 'after-terminal'

export interface HeadlessEventDropInfo {
  event: HeadlessEvent
  reason: HeadlessEventDropReason
  /** 累计被挡下的条数(含本条)。 */
  droppedCount: number
}

export interface HeadlessEventSinkOptions {
  /** 唯一的落笔出口(通常是 `process.stdout.write`)。写不写、写几条由 sink 决定,不由调用方决定。 */
  write: (line: string) => void
  format: OutputFormat
  /**
   * 事件被挡下时的交代出口(每条都喊,不合并 —— 条数本身就是"有多少东西被挡在终止符之外")。
   *
   * 为什么必须有这一格:AGENTS §30"静默变短等于伪造完整性"与守门 118"绝不静默成
   * 看起来全绿"是同一条禁令。一个挡下事件却什么都不说的 sink,比一个不挡的 sink 更难查 ——
   * 后者症状看得见,前者把"丢了哪几条"整块从观测面抹掉。
   * 调用方应把它写到 **stderr**:stdout 是事件流,交代不能成为"结果行之后的事件行"。
   */
  onDrop?: (info: HeadlessEventDropInfo) => void
}

export interface HeadlessEventSink {
  readonly format: OutputFormat
  /**
   * 当前持有写入权的来源;没人 claim 过时为 null。
   * `start` / `complete` 这类**回合外**事件不需要 claim —— claim 管的是"哪一路回合事件源在写",
   * 不是"谁能落笔"。
   */
  readonly claimedBy: HeadlessEventWriterSource | null
  /** 是否已停订阅(停过就不再回到未停)。 */
  readonly detached: boolean
  /** 是否已落结果行。真值一旦为 true,这条流上就再没有第二次终止符。 */
  readonly terminalWritten: boolean
  /** 实际落笔的事件数(序列化出空串的不计,与迁移前 `if (line) write(line)` 逐字同形)。 */
  readonly writtenCount: number
  /** 被挡下的事件数。非零就说明有人想在终止符后面插行 —— 该报出来,不该吞。 */
  readonly droppedCount: number
  /**
   * 先到先得地取得写入权。
   *  - 同一来源重复 claim ⇒ true(幂等,调用方可以在两处问同一个问题);
   *  - 已被**另一路**持有 ⇒ false ⇒ 调用方**不得**再装自己的 sink;
   *  - 已停订阅或已落结果行 ⇒ false(任何一路都不再是写者)。
   */
  claim(source: HeadlessEventWriterSource): boolean
  /** 回合事件出口:停订阅之后一律挡下并交代。 */
  emit(event: HeadlessEvent): void
  /**
   * 落**结果行**(终止符)并关闭这条流。
   *
   * 与 `detach()` 的分工是这张表的全部要点:`detach()` 停的是**来源**(订阅),
   * 结果行本身还要靠它之后那一次落笔。上游 headless-workflow 也是这个顺序 ——
   * 先 `stopObservingEvents()` 再打结果行。第二条结果行按"挡下"处理:一条流只能有一个终止符。
   */
  emitTerminal(event: HeadlessEvent): void
  /** 停订阅:必须在落结果行**之前**调用(见 `commands/agent.ts` runAgent 里的那一处)。 */
  detach(): void
}

/**
 * 建一个单一写者出口。刻意不做全局单例 —— 一次运行一个,由 `runAgent` 持有,
 * 这样测试与并发调用方各自拿到自己的 sink(全局态会把"恰好一次"变成"恰好一次每次运行",
 * 而后者的边界从来没人定义)。
 */
export function createHeadlessEventSink(options: HeadlessEventSinkOptions): HeadlessEventSink {
  const { write, format, onDrop } = options
  let claimedBy: HeadlessEventWriterSource | null = null
  let detached = false
  let terminalWritten = false
  let writtenCount = 0
  let droppedCount = 0

  const drop = (event: HeadlessEvent, reason: HeadlessEventDropReason): void => {
    droppedCount += 1
    onDrop?.({ event, reason, droppedCount })
  }
  /** 唯一的落笔通道:序列化 + 计数,空串不写(与迁移前 `if (line)` 同形)。 */
  const writeEvent = (event: HeadlessEvent): boolean => {
    const line = formatHeadlessEvent(event, format)
    if (!line) return false
    writtenCount += 1
    write(line)
    return true
  }

  return {
    get format() {
      return format
    },
    get claimedBy() {
      return claimedBy
    },
    get detached() {
      return detached
    },
    get terminalWritten() {
      return terminalWritten
    },
    get writtenCount() {
      return writtenCount
    },
    get droppedCount() {
      return droppedCount
    },
    claim(source) {
      if (detached || terminalWritten) return false
      if (claimedBy === null || claimedBy === source) {
        claimedBy = source
        return true
      }
      return false
    },
    emit(event) {
      // 判序刻意是"终止符优先于停订阅":流已经结束 是比 某个来源被停掉 更强的事实,
      // 报告里读到 after-terminal 的人不必再去猜"是不是只是没人订阅了"。
      if (terminalWritten) {
        drop(event, 'after-terminal')
        return
      }
      if (detached) {
        drop(event, 'detached')
        return
      }
      writeEvent(event)
    },
    emitTerminal(event) {
      if (terminalWritten) {
        drop(event, 'after-terminal')
        return
      }
      terminalWritten = true
      writeEvent(event)
    },
    detach() {
      detached = true
    },
  }
}

/**
 * "二选一"的接线判据(把上游那句 `...(detachEvents?{}:{onEvent})` 抽成可测出口)。
 *
 * 拿到写入权 ⇒ 返回这组 per-turn 回调;没拿到(常驻订阅已在写,或已停订阅)⇒ 返回空对象,
 * 展开出去就是**一个回调都不装**。判据住在这里而不是调用方的 `if` 里,是因为调用方的 `if`
 * 能写错方向,而这个函数**没有"两个都装"那条分支**。
 */
export function perTurnSinkArgs<TSinkArgs extends object>(
  sink: HeadlessEventSink,
  perTurnArgs: TSinkArgs,
): TSinkArgs | Record<never, never> {
  return sink.claim('per-turn-callbacks') ? perTurnArgs : {}
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
