/**
 * DoomLoopDetector — 滑动窗口检测 LLM 重复调用相同工具相同参数的死循环。
 *
 * 灵感来源:cli 的 `cli-sampling-types/src/doom_loop.rs`
 *           (服务端 doom_loop 信号检测 + DoomLoopRecoveryPolicy 阈值策略)
 *           + `cli-sampler/src/doom_loop.rs`(DoomLoopSignalCollector 累积器)。
 * 简化策略(做减法):
 *   - 服务端 SSE 协议检测不做(我们不是 SSE 代理),改为客户端工具调用层检测
 *   - 不做加密 hash(JSON.stringify 够用,只检测完全相同参数)
 *   - 滑动窗口环形缓冲,窗口外的不算重复
 *   - 不检测"相似但不相同"(避免误判,只检测完全相同)
 */

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
    const repeatCount = this.window.filter(
      (e) => e.toolName === toolName && e.inputHash === inputHash,
    ).length
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

function hashInput(input: unknown): string {
  try {
    return JSON.stringify(input ?? {})
  } catch {
    return String(input)
  }
}
