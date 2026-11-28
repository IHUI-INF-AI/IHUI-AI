// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 设备执行器 → 会话执行面的折叠器(2026-11-28 立)。
 *
 * 对标 TRAE 的跨端任务视图:手机看到的不是一段「· read_file {...}」文本日志,而是与
 * 网页/桌面同构的工具卡、终端卡。设备端 AgentCore 只吐 `tool_call` / `tool_result`
 * (无 toolCallId、无 plan 帧),所以本层负责:
 *  ① 给每次调用补稳定 id(设备端本地自增,重放同一任务时序号不变);
 *  ② start → result 就地更新同一张卡,不追加第二张;
 *  ③ `run_command` / `terminal_exec_sandboxed` 同时投影成终端任务(命令、起止、输出、退出状态);
 *  ④ 结果/入参按字符预算截断,避免一条 200KB 的工具结果把 WS 帧撑爆。
 *
 * 这是纯函数式状态机,不读写 DB / 不发网络;CLI 与测试共用同一份判据。
 */

import type { TerminalTask, ToolCall } from '@ihui/types'

/** 单条工具入参/结果的最大 JSON 字符数(与 API 侧执行面预算同值)。 */
export const DEVICE_EXECUTION_VALUE_MAX_CHARS = 6000

/** 会被额外投影成终端卡的命令类工具(与 CLI `run_command` / 沙箱终端同名)。 */
const TERMINAL_TOOL_NAMES = new Set(['run_command', 'terminal_exec_sandboxed'])

export interface DeviceExecutionSnapshot {
  toolCalls: ToolCall[]
  terminalTasks: TerminalTask[]
}

export interface DeviceExecutionTracker {
  /** 记录一次工具开始;返回本次调用的稳定 id。 */
  onToolCall(name: string, args?: Record<string, unknown>): string
  /** 记录一次工具结束;按 name 找到最近一张 running 卡就地收口。 */
  onToolResult(name: string, success: boolean, output?: string): void
  /** 当前全量执行面(调用方每次上报都发全量,不依赖增量合并)。 */
  snapshot(): DeviceExecutionSnapshot
}

interface TrackerOptions {
  maxValueChars?: number
  now?: () => number
}

function clampValue(value: unknown, maxChars: number): unknown {
  if (value === undefined) return undefined
  try {
    const json = JSON.stringify(value)
    if (typeof json !== 'string' || json.length <= maxChars) return value
    return { truncated: true, preview: json.slice(0, maxChars) }
  } catch {
    return String(value).slice(0, maxChars)
  }
}

function commandOf(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  const raw = args.command ?? args.cmd ?? args.script ?? args.input
  if (typeof raw === 'string' && raw.trim().length > 0) return raw
  try {
    return JSON.stringify(args).slice(0, 200)
  } catch {
    return ''
  }
}

interface TerminalBinding {
  terminalId: string
  toolCallId: string
  startedAtMs: number
}

export function createDeviceExecutionTracker(options: TrackerOptions = {}): DeviceExecutionTracker {
  const maxChars = options.maxValueChars ?? DEVICE_EXECUTION_VALUE_MAX_CHARS
  const now = options.now ?? (() => Date.now())
  let seq = 0
  const toolCalls: ToolCall[] = []
  const terminalTasks: TerminalTask[] = []
  const terminalBindings = new Map<string, TerminalBinding>()
  const toolStartedAt = new Map<string, number>()

  const toIso = (ms: number): string => new Date(ms).toISOString()

  function startTerminal(toolCallId: string, name: string, args: Record<string, unknown>): void {
    if (!TERMINAL_TOOL_NAMES.has(name)) return
    const terminalId = `dev-term-${toolCallId}`
    const at = now()
    terminalTasks.push({
      id: terminalId,
      command: commandOf(args).slice(0, 400),
      status: 'running',
      startedAt: toIso(at),
    })
    terminalBindings.set(toolCallId, { terminalId, toolCallId, startedAtMs: at })
  }

  function finishTerminal(toolCall: ToolCall, success: boolean): void {
    const binding = terminalBindings.get(toolCall.id)
    if (!binding) return
    const at = now()
    const idx = terminalTasks.findIndex((task) => task.id === binding.terminalId)
    if (idx < 0) return
    const task = terminalTasks[idx]!
    terminalTasks[idx] = {
      ...task,
      status: success ? 'completed' : 'failed',
      endedAt: toIso(at),
      durationMs: Math.max(0, at - binding.startedAtMs),
      ...(toolCall.result !== undefined
        ? {
            output:
              typeof toolCall.result === 'string'
                ? toolCall.result.slice(0, maxChars)
                : (() => {
                    try {
                      return JSON.stringify(toolCall.result).slice(0, maxChars)
                    } catch {
                      return String(toolCall.result).slice(0, maxChars)
                    }
                  })(),
          }
        : {}),
    }
    terminalBindings.delete(toolCall.id)
  }

  return {
    onToolCall(name, args) {
      seq += 1
      const id = `dev-tool-${seq}`
      const at = now()
      const safeArgs = (clampValue(args ?? {}, maxChars) as Record<string, unknown>) ?? {}
      toolStartedAt.set(id, at)
      toolCalls.push({
        id,
        toolName: name,
        args: safeArgs,
        status: 'running',
      })
      startTerminal(id, name, safeArgs)
      return id
    },
    onToolResult(name, success, output) {
      // 并行同名工具:收口最近一张 running 的(与 AgentCore 的事件顺序一致)。
      let index = -1
      for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
        if (toolCalls[i]!.toolName === name && toolCalls[i]!.status === 'running') {
          index = i
          break
        }
      }
      const at = now()
      if (index < 0) {        // 没有 start(设备重启后补报/旧事件):按结果补一张卡,不丢执行痕迹。
        seq += 1
        const id = `dev-tool-${seq}`
        const call: ToolCall = {
          id,
          toolName: name,
          args: {},
          status: success ? 'success' : 'error',
          ...(success ? {} : { isError: true }),
          ...(output !== undefined ? { result: clampValue(output, maxChars) } : {}),
        }
        toolCalls.push(call)
        return
      }
      const call = toolCalls[index]!
      const startedAt = toolStartedAt.get(call.id)
      const durationMs = startedAt === undefined ? undefined : Math.max(0, at - startedAt)
      const next: ToolCall = {
        ...call,
        status: success ? 'success' : 'error',
        ...(success ? {} : { isError: true }),
        ...(output !== undefined ? { result: clampValue(output, maxChars) } : {}),
        ...(durationMs === undefined ? {} : { durationMs }),
      }
      toolCalls[index] = next
      toolStartedAt.delete(call.id)
      finishTerminal(next, success)
    },
    snapshot() {
      return { toolCalls: toolCalls.slice(), terminalTasks: terminalTasks.slice() }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
