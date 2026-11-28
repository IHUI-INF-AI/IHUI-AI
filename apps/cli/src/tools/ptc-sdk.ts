// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * W4-14:run_code 的程序面 SDK 渲染(净室实现,不复制上游声明文本)。
 *
 * 判据:
 * - 只列真正会装进程序 globals 的只读绑定,不把注册表全量伪装成 SDK;
 * - 按名字排序、参数按键排序,同一工具面得到逐字节稳定的 prompt 段(KV cache);
 * - 声明是给模型看的文档,不是可执行 TypeScript;运行侧接受 TypeScript 可擦除语法（类型标注会被擦除,enum/namespace 等拒绝）;
 * - 描述里的反引号先中和,不能让工具描述截断 SDK 代码块。
 */

import type { Tool, ToolParameter } from './index.js'
import {
  PTC_DEFAULT_MAX_BINDING_CALLS,
  PTC_DEFAULT_MAX_CONCURRENT_BINDING_CALLS,
} from './ptc-executor.js'
import type { PtcBindingCallQuota, PtcBindingConcurrencyQuota } from './ptc-executor.js'
import {
  PTC_DEFAULT_BINDING_TIMEOUT_MS,
  PTC_DEFAULT_BINDING_TOOL_NAMES,
} from './ptc-tool.js'

const BINDING_NAMES: ReadonlySet<string> = new Set<string>(PTC_DEFAULT_BINDING_TOOL_NAMES)

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export interface RenderPtcSdkOptions {
  /** 单次 run_code 的绑定调用总预算;缺省 1000。与执行器 maxBindingCalls 同源。 */
  maxBindingCalls?: number
  /** 单次 run_code 同时在飞的绑定调用上限;缺省 10。与执行器 maxConcurrentBindingCalls 同源。 */
  maxConcurrentCalls?: number
  /** 命名空间/成员级调用配额;与执行器 maxBindingCallsByScope 同源。 */
  maxBindingCallsByScope?: readonly PtcBindingCallQuota[]
  /** 命名空间/成员级并发配额;与执行器 maxConcurrentCallsByScope 同源。 */
  maxConcurrentCallsByScope?: readonly PtcBindingConcurrencyQuota[]
  /** 排队老化上限;与执行器 priorityAging 同源,0/缺省时不额外公告。 */
  priorityAging?: number
  /** 单个绑定调用的墙钟上限;0/缺省不额外公告,与 runtime defaultBindingTimeoutMs 同源。 */
  maxBindingTimeoutMs?: number
  /** 是否启用 Node permission-model;缺省 true,false 时不在 SDK 里声称有沙箱。 */
  permissionModel?: boolean
  /** 是否启用 Windows AppContainer 内核沙箱;true 时公告内核边界。 */
  osSandbox?: boolean
  /** 一个 agent 回合内多个 run_code 共享的绑定调用总上限;缺省不设回合闸。 */
  maxTurnBindingCalls?: number
  /** 一个 agent 回合内多个 run_code 共享的同时在飞绑定调用上限;缺省不设回合并发闸。 */
  maxTurnConcurrentCalls?: number
  /** 是否在每次绑定调用前等待宿主审批;缺省 false 时不额外公告。 */
  approveBindings?: boolean
  /** 是否启用宿主侧 TypeScript 预检;缺省 false 时不额外公告。 */
  typeCheck?: boolean
  /** 是否为保留式 REPL/Script; true 时公告顶层声明保留和最终表达式。 */
  retained?: boolean
}

/** 只取真正存在的只读工具;顺序固定,缺失项不会在 SDK 里冒充存在。 */
export function selectPtcBindingTools(tools: readonly Tool[]): Tool[] {
  return [...tools]
    .filter((tool) => BINDING_NAMES.has(tool.name) && IDENTIFIER.test(tool.name))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 给 model 的 program-only SDK 段;空工具面也给出语法/边界说明。 */
export function renderPtcSdk(
  tools: readonly Tool[],
  options: RenderPtcSdkOptions = {},
): string {
  const bindings = selectPtcBindingTools(tools)
  const maxBindingCalls = options.maxBindingCalls ?? PTC_DEFAULT_MAX_BINDING_CALLS
  const maxConcurrentCalls =
    options.maxConcurrentCalls ?? PTC_DEFAULT_MAX_CONCURRENT_BINDING_CALLS
  const quotaLine = renderScopeQuotas(options.maxBindingCallsByScope)
  const concurrencyLine = renderScopeConcurrency(options.maxConcurrentCallsByScope)
  const bindingTimeoutMs = options.maxBindingTimeoutMs ?? PTC_DEFAULT_BINDING_TIMEOUT_MS
  const declarations = bindings.map(renderBinding).join('\n')
  const example = bindings.some((tool) => tool.name === 'read_file')
    ? [
        'const file = await tools.read_file({ path: "README.md" });',
        'return file.output;',
      ]
    : ['// 本次没有 read_file 绑定;按上面的 SDK 调用可用绑定。']
  const retained = options.retained === true
  const hasWritableBindings = bindings.some((tool) => tool.dangerLevel !== 'read')
  const lines = [
    '## 在 run_code 里写程序',
    '',
    retained
      ? '`run_code` 的参数 `code` 是一段 REPL/Script 语句:支持顶层声明、`await` 和最终表达式,不支持顶层 `return`。同一 agent 内顶层 `let`/`const`/函数/对象身份会跨 `run_code` 调用保留。只支持可擦除语法:类型标注、`interface`、`type`、`as`/`satisfies` 会被擦除,`enum`、`namespace`、参数属性等需要生成运行时代码的语法会被拒绝。纯 JavaScript 也接受。'
      : '`run_code` 的参数 `code` 是一段 TypeScript `async` 函数体;只支持可擦除语法:类型标注、`interface`、`type`、`as`/`satisfies` 会被擦除,`enum`、`namespace`、参数属性等需要生成运行时代码的语法会被拒绝。纯 JavaScript 也接受。',
    hasWritableBindings
      ? '只有 `run_code` 是可直接调用的工具;下面这些 `tools.*` 是程序内绑定,不能在工具调用层直接调用。只读绑定直接放行;可写绑定每次调用前必须过宿主审批,没人批就不执行。'
      : '只有 `run_code` 是可直接调用的工具;下面这些 `tools.*` 是程序内绑定,不能在工具调用层直接调用。绑定是只读的,每次调用仍走宿主的权限/hook/审计。',
    ...(options.permissionModel === false
      ? []
      : ['程序自身跑在 Node permission-model 沙箱里:默认不能直接读写文件、创建子进程或工作线程;文件访问要走 `tools` 绑定。']),
    ...(options.osSandbox === true
      ? ['程序还跑在 Windows AppContainer 内核沙箱里:文件读写由内核按 AppContainer SID 的 ACL 裁决,网络默认不可用;Node permission-model 是第二层,不是唯一边界。']
      : []),
    `单次 \`run_code\` 最多发起 ${maxBindingCalls} 次绑定调用,最多 ${maxConcurrentCalls} 个同时进行;超过后子进程会被终止,程序不能靠 \`catch\` 继续循环。`,
    ...(bindingTimeoutMs <= 0
      ? []
      : [`单个绑定调用超过 ${bindingTimeoutMs}ms 会终止整次 \`run_code\`,不会把挂死的工具留在后台。`]),
    ...(options.maxTurnBindingCalls === undefined
      ? []
      : [`本回合所有 \`run_code\` 合计最多发起 ${options.maxTurnBindingCalls} 次绑定调用;预算耗尽后新的 \`run_code\` 会在启动程序前被拒绝。`]),
    ...(options.maxTurnConcurrentCalls === undefined
      ? []
      : [`本回合所有 \`run_code\` 合计最多 ${options.maxTurnConcurrentCalls} 个绑定调用同时在飞;超出只排队,不会单独因为回合并发而终止。空槽优先给当前在飞更少的 \`run_code\`,避免单个程序长期占满全部回合槽。`]),
    ...(quotaLine === undefined ? [] : [quotaLine]),
    ...(concurrencyLine === undefined ? [] : [concurrencyLine]),
    ...(options.priorityAging === undefined || options.priorityAging <= 0
      ? []
      : [`范围优先级老化:每个空槽分配轮给仍在排队的调用 +1 级有效优先级,最多加 ${options.priorityAging} 级;等待越久越不容易被持续高优先级饿死。`]),
    ...(hasWritableBindings
      ? ['可写绑定没有"默认放行"档:宿主审批器缺省时一律拒绝,只有显式注入审批器并逐次返回 true 才会执行。']
      : []),
    ...(options.approveBindings === true
      ? ['每次绑定调用前会先等待宿主审批;审批被拒绝只影响该次绑定,程序可以 `catch` 后走别的路径,不会 abort 整个 `run_code`。']
      : []),
    ...(options.typeCheck === true
      ? ['程序在启动前会先做一次 TypeScript 类型检查;类型错误会以 `exception` 返回并带 `程序第 N 行`,不会进入执行。']
      : []),
    retained
      ? '用最终表达式返回可无损 JSON 化的结果(对象表达式请加括号);`console.log` 会作为日志带回。绑定失败会抛 `ToolCallError`,`toolName` 指向具体绑定,程序可以 `try/catch`。程序异常会带 `程序第 N 行`;绑定拒绝还会带 `命名空间.成员` 前缀。'
      : '用 `return` 返回可无损 JSON 化的结果;`console.log` 会作为日志带回。绑定失败会抛 `ToolCallError`,`toolName` 指向具体绑定,程序可以 `try/catch`。程序异常或绑定拒绝逃出程序时,错误会带 `程序第 N 行`;绑定拒绝还会带 `命名空间.成员` 前缀。',
    '',
    '程序内 SDK 绑定(仅签名;下面的 `declare` 是类型声明,不要复制进 `code`):',
    '',
    '```ts',
    'declare const tools: {',
    declarations || '  // 本次没有可用的绑定',
    '};',
    '```',
    '',
    '示例:',
    '',
    '```ts',
    ...example,
    '```',
  ]
  return lines.join('\n')
}

function renderScopeQuotas(
  quotas: readonly PtcBindingCallQuota[] | undefined,
): string | undefined {
  if (quotas === undefined || quotas.length === 0) return undefined
  const sorted = [...quotas].sort((a, b) => quotaLabel(a).localeCompare(quotaLabel(b)))
  const parts = sorted.map((quota) => `${quotaLabel(quota)} 最多 ${quota.limit} 次`)
  return (
    `范围配额:${parts.join('、')};任一条超出也会终止,` +
    '程序不能靠 `catch` 继续循环。'
  )
}

function renderScopeConcurrency(
  quotas: readonly PtcBindingConcurrencyQuota[] | undefined,
): string | undefined {
  if (quotas === undefined || quotas.length === 0) return undefined
  const sorted = [...quotas].sort((a, b) => quotaLabel(a).localeCompare(quotaLabel(b)))
  const parts = sorted.map((quota) => {
    const priority = quota.priority !== undefined && quota.priority > 0
      ? `(优先级 ${quota.priority})`
      : ''
    const weight = quota.weight !== undefined && quota.weight > 1
      ? `(权重 ${quota.weight})`
      : ''
    return `${quotaLabel(quota)} 最多 ${quota.limit} 路${priority}${weight}`
  })
  return (
    `范围并发:${parts.join('、')};超出只排队,高优先级先拿空槽,同优先级按权重分份额,` +
    '不会单独因为范围并发而终止。'
  )
}

function quotaLabel(quota: PtcBindingCallQuota): string {
  return quota.member === undefined ? quota.namespace : `${quota.namespace}.${quota.member}`
}

function renderBinding(tool: Tool): string {
  const argsType = renderObjectType(tool.parameters, tool.required ?? [])
  return [
    '  /**',
    `   * ${normalizeDescription(tool.description)}`,
    `   * @param ${argsType} args`,
    '   * @returns {Promise<{ success: boolean, output: string, error?: string }>}',
    '   */',
    `  ${tool.name}(args: ${argsType}): Promise<{ success: boolean, output: string, error?: string }>;`,
  ].join('\n')
}

function renderObjectType(
  properties: Record<string, ToolParameter>,
  required: readonly string[],
): string {
  const keys = Object.keys(properties).sort((a, b) => a.localeCompare(b))
  if (keys.length === 0) return 'Record<string, never>'
  const requiredSet = new Set(required)
  const members = keys.map((key) => {
    const property = properties[key]
    if (property === undefined) return `${key}?: unknown`
    const optional = requiredSet.has(key) ? '' : '?'
    return `${key}${optional}: ${renderType(property)}`
  })
  return `{ ${members.join(', ')} }`
}

function renderType(parameter: ToolParameter): string {
  if (parameter.enum !== undefined && parameter.enum.length > 0) {
    const values = [...parameter.enum].sort((a, b) => a.localeCompare(b))
    return values.map((value) => JSON.stringify(value)).join(' | ')
  }
  switch (parameter.type) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return parameter.items === undefined ? 'unknown[]' : `Array<${renderType(parameter.items)}>`
    case 'object':
      return renderObjectType(
        parameter.properties ?? {},
        parameter.required ?? [],
      )
    default:
      return 'unknown'
  }
}

function normalizeDescription(description: string): string {
  return description
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
