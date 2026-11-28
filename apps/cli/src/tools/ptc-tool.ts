// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * W4-14:run_code 工具与纯 PTC 只读执行器。
 *
 * 两种接入面共用同一组只读绑定:
 * - env `IHUI_PTC_TOOL=1`:混合面,原工具仍可直接调,run_code 只是多一条程序化入口;
 * - `--tool-executor ptc`:纯面,广告面只留 run_code,其余原生工具仅供绑定调用。
 *
 * 绑定只暴露四个显式只读工具,且每次 binding 仍走 `executeToolCall` 的
 * 权限/hook/审计;程序本身的任意 Node 能力由 `dangerLevel: 'dangerous'`
 * 的确认闸兜住,但确认不等于 OS 沙箱。
 */

import { NodePtcRuntime, NodeReplRuntime, PTC_MAX_BINDING_TIMEOUT_MS } from '@ihui/ptc-runtime'
import type {
  PtcBindingNamespace,
  PtcJsonValue,
  PtcRuntime,
} from '@ihui/ptc-runtime'

export { PTC_MAX_BINDING_TIMEOUT_MS }

import { createPtcToolExecutor, PTC_DEFAULT_MAX_BINDING_CALLS, PTC_MAX_BINDING_CALLS, PTC_RUN_CODE_TOOL_NAME } from './ptc-executor.js'
import type {
  PtcBindingApprover,
  PtcBindingCallQuota,
  PtcBindingConcurrencyQuota,
  PtcTurnBudget,
  PtcTurnConcurrency,
} from './ptc-executor.js'
import type { Tool, ToolContext, ToolResult } from './index.js'
import type { NativeToolCallRunner, ToolExecutor } from './tool-executor.js'

export const PTC_TOOL_ENV = 'IHUI_PTC_TOOL'

/** 只暴露明确只读的工具;不把注册表全量塞进程序。 */
export const PTC_READ_ONLY_TOOL_NAMES = ['read_file', 'list_dir', 'grep', 'glob'] as const

export interface CreateRunCodeToolOptions {
  /** 绑定调用必须仍走完整工具边界;缺省由宿主注入 executeToolCall。 */
  runner: NativeToolCallRunner
  /** 只读工具名白名单;缺省为 PTC_READ_ONLY_TOOL_NAMES。 */
  readOnlyTools?: readonly string[]
  /** 单次 run_code 的绑定调用总预算;缺省 1000,超限 abort。 */
  maxBindingCalls?: number
  /** 单次 run_code 同时在飞的绑定调用上限;缺省 10,超出排队。 */
  maxConcurrentBindingCalls?: number
  /** 命名空间/成员级调用配额;未知范围在启动进程前归 invalid_arguments。 */
  maxBindingCallsByScope?: readonly PtcBindingCallQuota[]
  /** 命名空间/成员级并发配额;priority 0..10 只影响排队顺序。未知范围在启动进程前归 invalid_arguments。 */
  maxConcurrentCallsByScope?: readonly PtcBindingConcurrencyQuota[]
  /** 排队老化上限;0 关闭,1..10 给仍在排队的调用逐轮加有效优先级。 */
  priorityAging?: number
  /** 单个绑定调用的墙钟上限;0 关闭,缺省 30000,最大 600000。 */
  bindingTimeoutMs?: number
  /** 回合并发闸;纯 PTC 由 runToolLoop 传入,run_code 工具从 ctx.ptcTurnConcurrency 读取。 */
  turnConcurrency?: PtcTurnConcurrency
  /**
   * 回合级共享预算;纯 PTC 执行器由 runToolLoop 传入,run_code 工具从 ctx.ptcTurnBudget 读取。
   * 缺省 undefined 时只按单程序 maxBindingCalls 约束。
   */
  turnBudget?: PtcTurnBudget
  /**
   * 绑定调用前的审批等待。缺省不配置 = 只读绑定直接放行;宿主可注入自己的
   * 审批器,对危险绑定先 await 人工/策略决策。
   */
  approveBinding?: PtcBindingApprover
  /** 宿主侧 TypeScript 预检;缺省 true,仅检查程序自身可判定的类型错误。 */
  typeCheck?: boolean
  /**
   * 保留式 REPL/Script。缺省 false:每次 run_code 新进程、不保留变量。
   * true 时同一执行器内复用 NodeReplRuntime 和同一个 stateOwner。
   */
  retainState?: boolean
  /** 保留式执行的 owner;不传且 retainState=true 时由执行器创建。 */
  stateOwner?: object
  /** 测试/嵌入方可注入 runtime 工厂。 */
  runtimeFactory?: () => PtcRuntime
  /** Windows AppContainer 内核沙箱;缺省 false。 */
  osSandbox?: boolean
  /** AppContainer worker 根目录;缺省 %ProgramData%\IHUI-AI\PTC。 */
  osSandboxRoot?: string
}

/**
 * 纯 PTC 模式的执行器:每次 run_code 新建/释放 runtime,不把 runtime 泄漏到回合间;
 * 只接 run_code,绑定只含只读工具。原生工具仍留在注册表里供绑定调用,但不会广告给模型。
 */
export function createPtcReadOnlyExecutor(options: CreateRunCodeToolOptions): ToolExecutor {
  const readOnlyTools = options.readOnlyTools ?? PTC_READ_ONLY_TOOL_NAMES
  const totalBudget = options.maxBindingCalls ?? PTC_DEFAULT_MAX_BINDING_CALLS
  const pendingLimit =
    Number.isInteger(totalBudget) && totalBudget >= 1 && totalBudget <= PTC_MAX_BINDING_CALLS
      ? totalBudget + 1
      : PTC_DEFAULT_MAX_BINDING_CALLS
  const retainedState = options.retainState === true
  const stateOwner =
    options.stateOwner ?? (retainedState ? {} : undefined)
  const retainedRuntime = retainedState
    ? (options.runtimeFactory?.() ?? new NodeReplRuntime({
        maxPendingCalls: pendingLimit,
        ...(options.bindingTimeoutMs === undefined
          ? {}
          : { defaultBindingTimeoutMs: options.bindingTimeoutMs }),
        ...(options.osSandbox === true
          ? {
              osSandbox: true,
              ...(options.osSandboxRoot === undefined
                ? {}
                : { osSandboxRoot: options.osSandboxRoot }),
            }
          : {}),
      }))
    : undefined

  return {
    kind: 'ptc',
    async dispose(): Promise<void> {
      await retainedRuntime?.dispose?.()
    },
    async execute(call, ctx): Promise<ToolResult> {      // 程序可能一次 Promise.all 发起上千次绑定调用。host 侧的并发闸负责排队，
      // 但 runtime/worker 的 maxPendingCalls 默认只有 128，会先于并发闸拒绝。
      // 默认 runtime 把 pending 上限对齐到本程序的**总预算 + 1**：
      // 预算内的调用都能进入 host 队列，越界的那一次由 tool-call-limit 终止。
      const runtime =
        retainedRuntime ??
        (options.runtimeFactory?.() ?? new NodePtcRuntime({
          maxPendingCalls: pendingLimit,
          ...(options.bindingTimeoutMs === undefined
            ? {}
            : { defaultBindingTimeoutMs: options.bindingTimeoutMs }),
          ...(options.osSandbox === true
            ? {
                osSandbox: true,
                ...(options.osSandboxRoot === undefined
                  ? {}
                  : { osSandboxRoot: options.osSandboxRoot }),
              }
            : {}),
        }))
      const turnBudget = options.turnBudget ?? ctx.ptcTurnBudget
      const turnConcurrency = options.turnConcurrency ?? ctx.ptcTurnConcurrency
      try {
        const executor = createPtcToolExecutor({
          runtime,
          resolveBindings: () => [
            createReadOnlyBindings(options.runner, ctx, readOnlyTools),
          ],
          maxBindingCalls: options.maxBindingCalls,
          maxConcurrentBindingCalls: options.maxConcurrentBindingCalls,
          maxBindingCallsByScope: options.maxBindingCallsByScope,
          maxConcurrentCallsByScope: options.maxConcurrentCallsByScope,
          priorityAging: options.priorityAging,
          turnBudget,
          turnConcurrency,
          approveBinding: options.approveBinding,
          typeCheck: options.typeCheck,
          ...(stateOwner === undefined ? {} : { stateOwner }),
        })
        return await executor.execute(call, ctx)
      } finally {
        if (retainedRuntime === undefined) await runtime.dispose?.()
      }
    },
  }
}

export function createRunCodeTool(options: CreateRunCodeToolOptions): Tool {
  const executor = createPtcReadOnlyExecutor(options)
  return {
    name: PTC_RUN_CODE_TOOL_NAME,
    description:
      '在 Node 子进程里执行一段 async TypeScript 函数体（只支持可擦除语法;类型标注、interface、type、as/satisfies 会被擦除,enum/namespace 等运行时代码会被拒绝;纯 JavaScript 也接受）。用 `await tools.<name>(args)` 调用只读宿主工具(read_file/list_dir/grep/glob),用 `return` 返回无损 JSON,`console.log` 捕获输出。程序默认跑在 Node permission-model 沙箱里:不能直接读写文件、创建子进程或工作线程(不拦网络),因此本工具仍按 dangerous 级别要求确认。',
    parameters: {
      code: {
        type: 'string',
        description: 'async 函数体源码;支持顶层 await/return;接受 TypeScript 可擦除语法（类型标注会被擦除,enum/namespace 等拒绝）,纯 JavaScript 也接受。',
      },
      description: {
        type: 'string',
        description: '这段程序要做什么的简短说明。',
      },
      timeoutMs: {
        type: 'number',
        description: '可选墙钟预算(毫秒);缺省 120000,上限 600000。',
      },
    },
    required: ['code', 'description'],
    // 程序可直接 import node:fs / child_process;不能按 read 级放行。
    dangerLevel: 'dangerous',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'ptc.run_code',
        reason: '在 Node 子进程执行任意可擦除 TypeScript:默认 Node permission-model 约束文件/子进程/工作线程,但不拦网络,属系统级入口;要不要问由危险档与权限矩阵决定,本契约层不额外强制',
        riskLevel: 'dangerous',
        effectScope: 'system',
        requiresApproval: false,
        confirmation: { mode: 'interactive' },
      },
      resultBudget: {
        inlineLimitBytes: 16 * 1024,
        providerVisibleLimitBytes: 8 * 1024,
        policy: 'truncate',
        preview: { bytes: 2048, lines: 40, from: 'head' },
      },
    },
    async execute(args, ctx): Promise<ToolResult> {
      return executor.execute(
        { name: PTC_RUN_CODE_TOOL_NAME, arguments: args },
        ctx,
      )
    },
  }
}

function createReadOnlyBindings(
  runner: NativeToolCallRunner,
  ctx: ToolContext,
  names: readonly string[],
): PtcBindingNamespace {
  const functions: Record<string, (args: unknown) => Promise<PtcJsonValue>> = {}
  for (const name of names) {
    if (name === PTC_RUN_CODE_TOOL_NAME) continue
    functions[name] = async (args) => {
      if (!isRecord(args)) throw new Error(`${name} 的参数必须是对象`)
      const result = await runner({ name, arguments: args }, ctx)
      if (!result.success) {
        throw new Error(`${name} failed: ${result.error ?? result.output}`)
      }
      return { success: true, output: result.output }
    }
  }
  return {
    global: 'tools',
    functions,
    errorClass: {
      name: 'ToolCallError',
      memberNameProperty: 'toolName',
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
