/**
 * Subagent 优先级链核心算法 — P1-2 Subagent precedence。
 *
 * 对每个字段独立解析,采用 Rust Option::or_else 风格的短路链:
 * 第一个非 undefined 的层获胜,后续层不再求值。
 *
 * 四层优先级(高 → 低):
 *   1. explicit:overrides(SubagentRuntimeOverrides)
 *   2. role:role(SubagentRole)
 *   3. persona:personas[overrides.persona](SubagentPersona)
 *   4. parent:undefined(让下游 shell spawn 继承父 session 值)
 *
 * 特殊语义:
 *   - fail-closed:persona instructionsFile 读取失败 → personaError 记录,不抛异常
 *   - soft degradation:role promptFile 读取失败 → rolePromptWarning 记录,继续解析
 *   - enum 容错:capabilityMode 无效值 → 静默返回 undefined 让下层接手
 *   - 字符串 trim:所有从文件读取的内容都 trim 首尾空白(内嵌文本不 trim)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  SubagentRuntimeOverrides,
  SubagentRole,
  SubagentPersona,
  EffectiveRuntimeConfig,
  PersonaMap,
  CapabilityMode,
  IsolationMode,
  ReasoningEffort,
} from './types.js'

/** capabilityMode 合法值集合 */
const CAPABILITY_MODES: readonly string[] = ['read-only', 'read-write', 'execute', 'all']

/** isolation 合法值集合 */
const ISOLATION_MODES: readonly string[] = ['none', 'worktree', 'subprocess']

/** reasoningEffort 合法值集合 */
const REASONING_EFFORTS: readonly string[] = ['minimal', 'low', 'medium', 'high']

/**
 * 校验 capabilityMode 字符串是否合法。
 * - 合法值 → 原样返回(类型收窄为 CapabilityMode)
 * - 非法值 → undefined(让下层接手)
 * - undefined → undefined
 */
export function parseCapabilityMode(s: string | undefined): CapabilityMode | undefined {
  if (s === undefined) return undefined
  return CAPABILITY_MODES.includes(s) ? (s as CapabilityMode) : undefined
}

/**
 * 校验 isolation 字符串是否合法。
 * - 合法值 → 原样返回(类型收窄为 IsolationMode)
 * - 非法值 → undefined
 * - undefined → undefined
 */
export function parseIsolationMode(s: string | undefined): IsolationMode | undefined {
  if (s === undefined) return undefined
  return ISOLATION_MODES.includes(s) ? (s as IsolationMode) : undefined
}

/**
 * 校验 reasoningEffort 字符串是否合法。
 * - 合法值 → 原样返回(类型收窄为 ReasoningEffort)
 * - 非法值 → undefined
 * - undefined → undefined
 */
export function parseReasoningEffort(s: string | undefined): ReasoningEffort | undefined {
  if (s === undefined) return undefined
  return REASONING_EFFORTS.includes(s) ? (s as ReasoningEffort) : undefined
}

/**
 * 安全读取文件(失败返回 undefined,errMsg 写入 out 参数)。
 * 任何 I/O / 权限 / 编码错误都吞掉,仅返回错误描述。
 */
function safeReadFile(p: string): { content?: string; error?: string } {
  try {
    const content = fs.readFileSync(p, 'utf-8')
    return { content }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `failed to read ${p}: ${msg}` }
  }
}

/**
 * 解析 persona instructions(fail-closed)。
 * - 内嵌 instructions 优先(不 trim)
 * - 否则读 instructionsFile(读取内容 trim 首尾空白)
 * - 读取失败 → personaError 记录,不抛异常
 */
function resolvePersonaInstructions(
  persona: SubagentPersona,
  cwd?: string,
): { instructions?: string; error?: string } {
  // 算法:persona.instructions ?? persona.instructionsFile 读取的内容 ?? undefined
  if (persona.instructions !== undefined) {
    return { instructions: persona.instructions }
  }
  if (persona.instructionsFile) {
    const filePath = cwd ? path.resolve(cwd, persona.instructionsFile) : persona.instructionsFile
    const result = safeReadFile(filePath)
    if (result.content !== undefined) {
      return { instructions: result.content.trim() }
    }
    return { error: result.error }
  }
  return {}
}

/**
 * 解析 role prompt(soft degradation)。
 * - promptFile 优先(读取内容 trim 首尾空白)
 * - 否则用内嵌 prompt(不 trim)
 * - 读取失败 → rolePromptWarning 记录,继续解析
 */
function resolveRolePrompt(
  role: SubagentRole,
  cwd?: string,
): { prompt?: string; warning?: string } {
  // 算法:role.promptFile 读取的内容 ?? role.prompt ?? undefined
  if (role.promptFile) {
    const filePath = cwd ? path.resolve(cwd, role.promptFile) : role.promptFile
    const result = safeReadFile(filePath)
    if (result.content !== undefined) {
      return { prompt: result.content.trim() }
    }
    return { warning: result.error }
  }
  if (role.prompt !== undefined) {
    return { prompt: role.prompt }
  }
  return {}
}

/**
 * 按四层优先级解析 effective runtime config。
 *
 * - overrides:explicit 层(用户显式传入)
 * - role:role 层(可为 undefined,表示无 role 配置)
 * - personas:persona map(按 overrides.persona 名查找,未找到则 undefined)
 * - cwd:文件读取的基准目录(用于 promptFile / instructionsFile 相对路径)
 * - roleName:role 名(用于 EffectiveRuntimeConfig.roleName,可为 undefined)
 *
 * 返回的 isolation 字段从不为 undefined(默认 'none')。
 */
export function resolveEffectiveOverrides(
  overrides: SubagentRuntimeOverrides,
  role: SubagentRole | undefined,
  personas: PersonaMap,
  cwd?: string,
  roleName?: string,
): EffectiveRuntimeConfig {
  // === persona 层:按 overrides.persona 名查找 ===
  const personaName = overrides.persona
  let persona: SubagentPersona | undefined
  let personaNotFoundError: string | undefined
  if (personaName) {
    persona = personas[personaName]
    if (!persona) {
      // persona 未找到 → 记录错误但其他字段不受影响
      personaNotFoundError = `persona not found: ${personaName}`
    }
  }

  // === persona instructions 加载(fail-closed) ===
  let personaInstructions: string | undefined
  let personaError: string | undefined
  if (persona) {
    const result = resolvePersonaInstructions(persona, cwd)
    personaInstructions = result.instructions
    personaError = result.error
  }
  // persona 未找到也记录到 personaError(优先于 instructions 读取错误)
  if (personaNotFoundError) {
    personaError = personaNotFoundError
  }

  // === role prompt 加载(soft degradation) ===
  let rolePrompt: string | undefined
  let rolePromptWarning: string | undefined
  if (role) {
    const result = resolveRolePrompt(role, cwd)
    rolePrompt = result.prompt
    rolePromptWarning = result.warning
  }

  // === 各字段四层短路链解析 ===

  // model: explicit ?? role ?? persona ?? undefined(parent)
  const model = overrides.model ?? role?.model ?? persona?.model ?? undefined

  // reasoningEffort: explicit ?? role ?? persona ?? undefined
  const reasoningEffort =
    overrides.reasoningEffort ?? role?.reasoningEffort ?? persona?.reasoningEffort ?? undefined

  // capabilityMode: explicit ?? role ?? undefined(不从 persona 级联,enum 容错)
  const capabilityMode =
    parseCapabilityMode(overrides.capabilityMode) ??
    parseCapabilityMode(role?.defaultCapabilityMode) ??
    undefined

  // isolation: explicit ?? role ?? persona ?? 'none'(默认 'none',从不为 undefined)
  const isolation: IsolationMode =
    overrides.isolation ?? role?.defaultIsolation ?? persona?.defaultIsolation ?? 'none'

  // persona 名:只走 explicit(不会反向查找)
  const personaField = overrides.persona ?? undefined

  return {
    model,
    reasoningEffort,
    capabilityMode,
    persona: personaField,
    personaInstructions,
    rolePrompt,
    roleName,
    isolation,
    personaError,
    rolePromptWarning,
  }
}
