// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具输出留存与裁剪原语 —— 跨端共用的一次性工具结果治理层。
 *
 * 立因(2026-11-26 四程序对标):同类产品在「工具结果进上下文」这一步都做了三件事,
 * 而本仓此前只有"结果信封"(超大输出落盘换路径)一种手段:
 *   1. **留存(retention)**:按预算只把头部/尾部/首尾窗口交给模型,并如实报告省略量;
 *   2. **裁剪(prune)**:没有落盘路径时,按码点保留头段+尾段,中段换成固定标记;
 *   3. **配对平衡(tool-pairing)**:压缩切点不得落在"有调用无结果"的中间态。
 *
 * 三条都是**纯函数**,零 IO、零模型调用、可回放:
 * 同一输入恒得同一输出,因此压缩前后可以逐字节对账,不需要另存状态。
 *
 * 与既有能力的边界(不得互相冒充):
 *   - `markers.ts` 的 `ENVELOPE_*` 负责"已落盘的大输出用什么形状指回原文件";
 *   - 本模块负责"还没落盘、但必须现在就少给一点"的预算与省略口径;
 *   - 摘要压缩负责"跨回合折叠",本模块只动**单条工具结果**,不改写会话结构。
 */

import type { ChatMessage } from './types.js'

/** 中段被裁掉时插入的固定标记(幂等识别锚点,不得本地另写字面量) */
export const TOOL_OUTPUT_PRUNE_MARKER = '\n\n[... 工具结果中段已裁剪 ...]\n\n'

/** 默认预算:沿用同类产品的低摩擦档位(8K 触发,保留头 4K + 尾 1K) */
export const DEFAULT_TOOL_OUTPUT_BUDGET = {
  thresholdChars: 8192,
  headChars: 4096,
  tailChars: 1024,
} as const

/** 单条工具结果的裁剪预算(单位:Unicode 码点) */
export interface ToolOutputBudget {
  /** 超过该码点数才裁剪 */
  thresholdChars: number
  /** 保留头部码点数 */
  headChars: number
  /** 保留尾部码点数 */
  tailChars: number
}

/** 裁剪结果:未超预算时 `truncated === false` 且正文原样返回 */
export interface ToolOutputPruneResult {
  text: string
  removedChars: number
  truncated: boolean
}

/** 留存窗口形态 */
export type RetentionKind = 'head' | 'tail' | 'headTail'

/** 留存选项:`maxChars` 是**保留总量**上限,不是窗口起点 */
export interface RetentionOptions {
  kind: RetentionKind
  maxChars: number
  /** 仅 `headTail` 使用:尾部保留量,缺省 0 */
  tailChars?: number
}

/** 留存结果:省略量是精确码点差,不是估算 */
export interface RetentionResult {
  text: string
  omittedChars: number
  truncated: boolean
  kind: RetentionKind
}

/** 工具调用/结果配对折叠结果(下标与会话消息一一对应) */
export interface ToolPairingFold {
  /** 第 i 条消息**之前**的切点是否平衡(没有悬空调用) */
  balancedBefore: boolean[]
  /** 第 i 条消息**之后**的切点是否平衡 */
  balancedAfter: boolean[]
  /** 折完后仍未拿到结果的调用 id(正常对话里应为空) */
  unansweredCallIds: string[]
}

/**
 * 按 Unicode 码点计数,不劈开代理对。
 *
 * 不能用 `String.prototype.length`:那是 UTF-16 码元数,emoji/生僻字会被算成 2,
 * 而按码元切片会把一个字符劈成两个孤立代理项 —— 落进上下文就是乱码。
 */
export function countCodePoints(text: string): number {
  return Array.from(text).length
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`tool-output: ${name} 必须是正整数,收到 ${String(value)}`)
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`tool-output: ${name} 必须是非负整数,收到 ${String(value)}`)
  }
}

/**
 * 解析并校验预算:任何一条不成立都直接抛,绝不静默夹取。
 *
 * 三档必须满足 `head + marker + tail <= threshold`,否则"裁剪后反而更长",
 * 这类配置错误必须在调用前炸掉,而不是让模型收到一段比原文还长的占位。
 */
export function resolveToolOutputBudget(partial: Partial<ToolOutputBudget> = {}): ToolOutputBudget {
  const thresholdChars = partial.thresholdChars ?? DEFAULT_TOOL_OUTPUT_BUDGET.thresholdChars
  const headChars = partial.headChars ?? DEFAULT_TOOL_OUTPUT_BUDGET.headChars
  const tailChars = partial.tailChars ?? DEFAULT_TOOL_OUTPUT_BUDGET.tailChars
  assertPositiveInteger('thresholdChars', thresholdChars)
  assertNonNegativeInteger('headChars', headChars)
  assertNonNegativeInteger('tailChars', tailChars)
  const emitted = headChars + countCodePoints(TOOL_OUTPUT_PRUNE_MARKER) + tailChars
  if (emitted > thresholdChars) {
    throw new Error(
      `tool-output: headChars + 标记 + tailChars (${emitted}) 不得超过 thresholdChars (${thresholdChars})`,
    )
  }
  return { thresholdChars, headChars, tailChars }
}

/**
 * 确定性头/中/尾裁剪:保留头段与尾段,中段换成固定标记。
 *
 * 只处理**文本**。图片、附件等富块不经过本函数 —— 它们要么有独立定价,
 * 要么由结果信封整条落盘,不能被文本裁剪误伤。
 */
export function pruneToolResultText(
  text: string,
  budget: Partial<ToolOutputBudget> = {},
): ToolOutputPruneResult {
  const resolved = resolveToolOutputBudget(budget)
  const points = Array.from(text)
  const total = points.length
  if (total <= resolved.thresholdChars) {
    return { text, removedChars: 0, truncated: false }
  }
  const head = points.slice(0, resolved.headChars).join('')
  const tail = resolved.tailChars === 0 ? '' : points.slice(total - resolved.tailChars).join('')
  const output = `${head}${TOOL_OUTPUT_PRUNE_MARKER}${tail}`
  const kept = resolved.headChars + resolved.tailChars
  const removedChars = total - kept
  if (countCodePoints(output) > resolved.thresholdChars) {
    throw new Error('tool-output: 裁剪结果仍超预算(预算不变量被破坏)')
  }
  if (countCodePoints(output) >= total) {
    throw new Error('tool-output: 裁剪结果没有变短(拒绝产出无效占位)')
  }
  return { text: output, removedChars, truncated: true }
}

/**
 * 留存窗口:流式工具(命令输出、搜索结果页、日志)在**产出端**就只留预算内的一段。
 *
 * 与 `pruneToolResultText` 的差别:那个是"已拿到全文,事后裁剪";
 * 这个是"不打算把全文交给模型,先留窗口",省略量同样精确可报。
 */
export function retainText(text: string, options: RetentionOptions): RetentionResult {
  assertPositiveInteger('maxChars', options.maxChars)
  const points = Array.from(text)
  const total = points.length
  if (total <= options.maxChars) {
    return { text, omittedChars: 0, truncated: false, kind: options.kind }
  }
  if (options.kind === 'head') {
    const kept = points.slice(0, options.maxChars).join('')
    return { text: kept, omittedChars: total - options.maxChars, truncated: true, kind: 'head' }
  }
  if (options.kind === 'tail') {
    const kept = points.slice(total - options.maxChars).join('')
    return { text: kept, omittedChars: total - options.maxChars, truncated: true, kind: 'tail' }
  }
  const tailChars = options.tailChars ?? 0
  assertNonNegativeInteger('tailChars', tailChars)
  if (tailChars > options.maxChars) {
    throw new Error(`tool-output: tailChars (${tailChars}) 不得超过 maxChars (${options.maxChars})`)
  }
  const headChars = options.maxChars - tailChars
  const head = headChars === 0 ? '' : points.slice(0, headChars).join('')
  const tail = tailChars === 0 ? '' : points.slice(total - tailChars).join('')
  const kept = headChars + tailChars
  return {
    text: `${head}${TOOL_OUTPUT_PRUNE_MARKER}${tail}`,
    omittedChars: total - kept,
    truncated: true,
    kind: 'headTail',
  }
}

/**
 * 统一省略说明:告诉模型"少了多少、去哪找",而不是只说"已截断"。
 *
 * `hint` 由调用方给(例如结果信封的文件路径),本函数不猜存储位置。
 */
export function formatRetentionNotice(omittedChars: number, hint?: string): string {
  assertNonNegativeInteger('omittedChars', omittedChars)
  if (omittedChars === 0) return ''
  const suffix = hint === undefined || hint === '' ? '' : `;${hint}`
  return `\n\n[已省略 ${omittedChars} 个字符${suffix}]`
}

/**
 * 折叠工具调用/结果配对,给出每个切点是否"平衡"。
 *
 * 用途:压缩只能在平衡切点下刀。若让一条 assistant 的工具调用留在摘要里、
 * 而对应结果被折掉(或反过来),上游会收到"工具调用悬空"的非法消息序列,
 * 表现为模型端 400 或无声地丢工具轮次。
 *
 * 严格模式:结果消息带 `tool_call_id` 时必须命中一个**尚未闭合**的调用;
 * 结果消息不带 id 时按 FIFO 闭合最早一个;两者都无对应调用即抛错 ——
 * 会话面已经不合法,不能靠兜底继续压。
 */
export function foldToolPairing(messages: readonly ChatMessage[]): ToolPairingFold {
  const openIds: string[] = []
  const balancedBefore: boolean[] = []
  const balancedAfter: boolean[] = []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message === undefined) {
      throw new Error(`tool-output: 消息下标 ${index} 不存在(稀疏数组不允许进入配对折叠)`)
    }
    balancedBefore[index] = openIds.length === 0
    if (message.role === 'assistant' && message.tool_calls !== undefined) {
      for (let callIndex = 0; callIndex < message.tool_calls.length; callIndex += 1) {
        const call = message.tool_calls[callIndex]
        const id = call?.id !== undefined && call.id !== '' ? call.id : `anonymous-${index}-${callIndex}`
        openIds.push(id)
      }
    } else if (message.role === 'tool') {
      const id = message.tool_call_id ?? ''
      if (id !== '') {
        const at = openIds.indexOf(id)
        if (at < 0) {
          throw new Error(`tool-output: 工具结果引用了未发起的调用 id=${id}`)
        }
        openIds.splice(at, 1)
      } else if (openIds.length > 0) {
        openIds.shift()
      } else {
        throw new Error('tool-output: 工具结果没有对应的调用(会话面不合法)')
      }
    }
    balancedAfter[index] = openIds.length === 0
  }
  return { balancedBefore, balancedAfter, unansweredCallIds: openIds.slice() }
}

/**
 * 最近一个"平衡切点"的下标(可安全在此处开始摘要/丢弃)。
 *
 * 返回 -1 表示从头到尾都不平衡 —— 调用方应放弃本轮压缩或先补齐结果,
 * 不得退化成"随便找个位置下刀"。
 */
export function lastBalancedCut(fold: ToolPairingFold): number {
  for (let index = fold.balancedAfter.length - 1; index >= 0; index -= 1) {
    if (fold.balancedAfter[index] === true) return index + 1
  }
  return -1
}
