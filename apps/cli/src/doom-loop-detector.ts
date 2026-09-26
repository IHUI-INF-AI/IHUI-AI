// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DoomLoopDetector — 滑动窗口检测 LLM 重复调用相同工具相同参数的死循环。
 *
 * 灵感来源:参考行业 Agent 框架的 doom_loop 信号检测设计
 *           (服务端 doom_loop 信号检测 + DoomLoopRecoveryPolicy 阈值策略)
 *           + DoomLoopSignalCollector 累积器模式。
 * 简化策略(做减法):
 *   - 服务端 SSE 协议检测不做(我们不是 SSE 代理),改为客户端工具调用层检测
 *   - 2026-09-27 修正:inputHash 改为真 SHA-256 摘要(规范化序列化后取 hex)。
 *     旧实现原样返回 JSON.stringify(整个入参),而这份"原文"会被拼进 pattern
 *     POST 到服务端长期落库(见 commands/agent.ts persistDoomLoopProcedural),
 *     file_read/file_edit/run_command 类入参含文件路径、文件正文、命令行明文。
 *   - 滑动窗口环形缓冲,窗口外的不算重复
 *   - 不检测"相似但不相同"(避免误判,只检测完全相同)
 */

import { createHash } from 'node:crypto'

export interface ToolCall {
  toolName: string
  inputHash: string
}

export interface DoomLoopDetectorOptions {
  windowSize: number
  repeatThreshold: number
  cooldownMs: number
}

export interface DoomLoopAlert {
  toolName: string
  inputHash: string
  repeatCount: number
  message: string
  suggestion: string
}

const DEFAULT_OPTIONS: DoomLoopDetectorOptions = {
  windowSize: 10,
  repeatThreshold: 3,
  cooldownMs: 0,
}

interface WindowEntry {
  toolName: string
  inputHash: string
  timestamp: number
}

export class DoomLoopDetector {
  private readonly options: DoomLoopDetectorOptions
  private readonly window: WindowEntry[] = []
  private totalCalls = 0
  private uniqueCalls = 0
  private readonly uniqueSet = new Set<string>()

  constructor(options?: Partial<DoomLoopDetectorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  record(toolName: string, input: unknown): DoomLoopAlert | null {
    const inputHash = hashInput(input)
    const now = Date.now()
    this.pruneWindow(now)
    this.window.push({ toolName, inputHash, timestamp: now })
    this.totalCalls++
    const uniqueKey = `${toolName}::${inputHash}`
    if (!this.uniqueSet.has(uniqueKey)) {
      this.uniqueSet.add(uniqueKey)
      this.uniqueCalls++
    }
    // 2026-09-03 修复: 原实现统计"窗口内出现次数",会把跨轮合法重读同一文件(如 a,b,a,b,a,b)
    // 误判为死循环。改为只统计窗口尾部连续相同的调用——中间夹着任何不同调用即打断计数。
    // 跨轮整轮重复(tool_call 模式完全相同)由 ConsecutiveSignatureDetector 兜底。
    let repeatCount = 0
    for (let i = this.window.length - 1; i >= 0; i--) {
      const e = this.window[i]!
      if (e.toolName === toolName && e.inputHash === inputHash) {
        repeatCount++
      } else {
        break
      }
    }
    if (repeatCount >= this.options.repeatThreshold) {
      return {
        toolName,
        inputHash,
        repeatCount,
        message: `检测到工具 ${toolName} 连续调用 ${repeatCount} 次相同参数,可能陷入死循环。`,
        suggestion: `请检查工具返回值,或换用其他工具/方法。`,
      }
    }
    return null
  }

  reset(): void {
    this.window.length = 0
    this.totalCalls = 0
    this.uniqueCalls = 0
    this.uniqueSet.clear()
  }

  getStats(): { totalCalls: number; uniqueCalls: number; repeatRate: number } {
    if (this.totalCalls === 0) {
      return { totalCalls: 0, uniqueCalls: 0, repeatRate: 0 }
    }
    return {
      totalCalls: this.totalCalls,
      uniqueCalls: this.uniqueCalls,
      repeatRate: 1 - this.uniqueCalls / this.totalCalls,
    }
  }

  private pruneWindow(now: number): void {
    while (this.window.length >= this.options.windowSize) {
      this.window.shift()
    }
    if (this.options.cooldownMs > 0) {
      while (
        this.window.length > 0 &&
        now - this.window[0]!.timestamp > this.options.cooldownMs
      ) {
        this.window.shift()
      }
    }
  }
}

/**
 * 确定性、永不抛错的规范化序列化:
 * - 对象键逐层排序 ⇒ 同一逻辑入参(键序不同)得到同一字符串,去重/等值比较才成立
 *   (旧实现直接 JSON.stringify,键序一变 inputHash 就变,等于去重键失效)
 * - 循环引用:只对"当前祖先链"上的对象判 "[Circular]"(同对象在兄弟分支重复出现
 *   属 DAG,不算循环,仍正常序列化)
 * - BigInt → 十进制字符串;undefined/function/symbol 按 JSON 语义丢弃;
 *   NaN/Infinity → null;最外层是 undefined 时退化为 '{}'
 */
function canonicalSerialize(value: unknown): string {
  const ancestors = new Set<object>()
  const walk = (v: unknown): string | undefined => {
    if (v === null) return 'null'
    switch (typeof v) {
      case 'undefined':
      case 'function':
      case 'symbol':
        return undefined
      case 'number':
        return Number.isFinite(v) ? JSON.stringify(v) : 'null'
      case 'bigint':
        return `"${(v as bigint).toString(10)}"`
      case 'string':
      case 'boolean':
        return JSON.stringify(v)
      default:
        break
    }
    const obj = v as object
    if (ancestors.has(obj)) return '"[Circular]"'
    ancestors.add(obj)
    let out: string
    if (Array.isArray(obj)) {
      out = `[${obj.map((item) => walk(item) ?? 'null').join(',')}]`
    } else {
      const record = obj as Record<string, unknown>
      const parts: string[] = []
      for (const key of Object.keys(record).sort()) {
        const serialized = walk(record[key])
        if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`)
      }
      out = `{${parts.join(',')}}`
    }
    ancestors.delete(obj)
    return out
  }
  return walk(value) ?? '{}'
}

/** 序列化整体意外抛错(如抛错 getter、极端深度爆栈)时的兜底占位串:不含任何入参原文 */
const HASH_FALLBACK_SERIALIZED = '{"__doom_loop_unserializable__":true}'

/**
 * 工具入参 → SHA-256 摘要(64 位小写 hex,定长)。
 * 名字与现实终于对齐:摘要不留原文,明文不再有机会流入 pattern / 服务端落库;
 * 任何入参(含循环引用/BigInt/undefined)都不抛错 —— 本函数在 CLI 主流程的
 * 工具调用检测器上,炸了会影响正常调用工具。
 */
export function hashInput(input: unknown): string {
  let serialized: string
  try {
    serialized = canonicalSerialize(input ?? {})
  } catch {
    serialized = HASH_FALLBACK_SERIALIZED
  }
  return createHash('sha256').update(serialized, 'utf8').digest('hex')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
