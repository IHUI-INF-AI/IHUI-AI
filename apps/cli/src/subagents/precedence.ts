// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *   - enum 容错:capabilityMode / reasoningEffort 无效值 → 返回 undefined 让下层接手
 *     (G-395:reasoningEffort 同步接入容错;非法请求档不再静默传播,改由留痕归因)
 *   - 字符串 trim:所有从文件读取的内容都 trim 首尾空白(内嵌文本不 trim)
 *
 * G-395 出处标签与降档留痕(参照上游 provider resolver 的 source 形状):
 *   - 每个生效字段带 `sources` 出处标签(哪层获胜、哪个覆盖项/配置项/来源文件);
 *   - 请求档(reasoningEffort 最高优先非 undefined 原始值)未被原样采纳时,
 *     结果带 `effortDowngrade` 留痕(requested/effective 两值 + 双方出处 + 原因),
 *     消除静默降档。标签生成只此一处,消费方读同一出口(§0.6)。
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
  PrecedenceLayer,
  ConfigFieldSource,
  EffortDowngradeTrace,
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

/** 构造出处标签(唯一生成点,配合 resolveEffectiveOverrides 使用) */
function src(layer: PrecedenceLayer, origin: string): ConfigFieldSource {
  return { layer, origin }
}

/**
 * 档位序:由 REASONING_EFFORTS 数组下标定义(minimal<low<medium<high),
 * 不另立第二份 rank 表;非法值返回 -1。
 */
function effortRank(e: string): number {
  return REASONING_EFFORTS.indexOf(e)
}

/**
 * 四层短路链的带出处版本:第一个非 undefined 的候选获胜并带出其 source;
 * 全部落空 → 返回 parentSource(继承父 session 语义)。
 */
function firstHit<T>(
  candidates: ReadonlyArray<{ value: T | undefined; source: ConfigFieldSource }>,
  parentSource: ConfigFieldSource,
): { value: T | undefined; source: ConfigFieldSource } {
  for (const c of candidates) {
    if (c.value !== undefined) return { value: c.value, source: c.source }
  }
  return { value: undefined, source: parentSource }
}

/**
 * G-395 降档判定:请求档(最高优先给出非 undefined 原始值的层)未被原样采纳时生成留痕。
 * - 请求档非法枚举被容错丢弃 → 'invalid-enum'
 * - 请求档合法但实得档档位下标更低 → 'rank-lower'(当前链合法 explicit 必获胜,
 *   此臂为票面判据"请求档高于实得档"的直接实现,防未来钳制层静默)
 */
function buildEffortDowngrade(
  requested: { raw: string; source: ConfigFieldSource } | undefined,
  hit: { value: ReasoningEffort | undefined; source: ConfigFieldSource },
): EffortDowngradeTrace | undefined {
  if (!requested) return undefined
  if (requested.raw === hit.value) return undefined
  const rRank = effortRank(requested.raw)
  const eRank = hit.value === undefined ? -1 : effortRank(hit.value)
  if (rRank === -1) {
    return {
      requested: requested.raw,
      requestedSource: requested.source,
      effective: hit.value,
      effectiveSource: hit.source,
      reason: 'invalid-enum',
    }
  }
  if (eRank < rRank) {
    return {
      requested: requested.raw,
      requestedSource: requested.source,
      effective: hit.value,
      effectiveSource: hit.source,
      reason: 'rank-lower',
    }
  }
  return undefined
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
): { instructions?: string; error?: string; source?: ConfigFieldSource } {
  // 算法:persona.instructions ?? persona.instructionsFile 读取的内容 ?? undefined
  if (persona.instructions !== undefined) {
    return {
      instructions: persona.instructions,
      source: src('persona', `persona[${persona.name}].instructions`),
    }
  }
  if (persona.instructionsFile) {
    const filePath = cwd ? path.resolve(cwd, persona.instructionsFile) : persona.instructionsFile
    const result = safeReadFile(filePath)
    if (result.content !== undefined) {
      return {
        instructions: result.content.trim(),
        source: src('persona', `persona[${persona.name}].instructionsFile:${filePath}`),
      }
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
): { prompt?: string; warning?: string; source?: ConfigFieldSource } {
  // 算法:role.promptFile 读取的内容 ?? role.prompt ?? undefined
  if (role.promptFile) {
    const filePath = cwd ? path.resolve(cwd, role.promptFile) : role.promptFile
    const result = safeReadFile(filePath)
    if (result.content !== undefined) {
      return {
        prompt: result.content.trim(),
        source: src('role', `role[${role.name}].promptFile:${filePath}`),
      }
    }
    return { warning: result.error }
  }
  if (role.prompt !== undefined) {
    return { prompt: role.prompt, source: src('role', `role[${role.name}].prompt`) }
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
  let personaInstructionsSource: ConfigFieldSource | undefined
  let personaError: string | undefined
  if (persona) {
    const result = resolvePersonaInstructions(persona, cwd)
    personaInstructions = result.instructions
    personaInstructionsSource = result.source
    personaError = result.error
  }
  // persona 未找到也记录到 personaError(优先于 instructions 读取错误)
  if (personaNotFoundError) {
    personaError = personaNotFoundError
  }

  // === role prompt 加载(soft degradation) ===
  let rolePrompt: string | undefined
  let rolePromptSource: ConfigFieldSource | undefined
  let rolePromptWarning: string | undefined
  if (role) {
    const result = resolveRolePrompt(role, cwd)
    rolePrompt = result.prompt
    rolePromptSource = result.source
    rolePromptWarning = result.warning
  }

  // === 各字段四层短路链解析(带 G-395 出处标签) ===

  const roleTag = role?.name ?? '?'
  const personaTag = persona?.name ?? '?'
  const parentInherit = src('parent', 'parent(inherit)')

  // model: explicit ?? role ?? persona ?? undefined(parent)
  const modelHit = firstHit(
    [
      { value: overrides.model, source: src('explicit', 'overrides.model') },
      { value: role?.model, source: src('role', `role[${roleTag}].model`) },
      { value: persona?.model, source: src('persona', `persona[${personaTag}].model`) },
    ],
    parentInherit,
  )

  // reasoningEffort: explicit ?? role ?? persona ?? undefined(enum 容错同 capabilityMode;
  // 非法请求档不静默传播,由 effortDowngrade 留痕归因)
  const effortCandidates: ReadonlyArray<{ raw: string | undefined; source: ConfigFieldSource }> =
    [
      { raw: overrides.reasoningEffort, source: src('explicit', 'overrides.reasoningEffort') },
      { raw: role?.reasoningEffort, source: src('role', `role[${roleTag}].reasoningEffort`) },
      {
        raw: persona?.reasoningEffort,
        source: src('persona', `persona[${personaTag}].reasoningEffort`),
      },
    ]
  const effortHit = firstHit<ReasoningEffort>(
    effortCandidates.map((c) => ({ value: parseReasoningEffort(c.raw), source: c.source })),
    parentInherit,
  )
  // 请求档 = 最高优先给出非 undefined 原始值的层(含非法值,原样留痕)
  const requestedEffort = effortCandidates.find(
    (c): c is { raw: string; source: ConfigFieldSource } => c.raw !== undefined,
  )
  const effortDowngrade = buildEffortDowngrade(requestedEffort, effortHit)

  // capabilityMode: explicit ?? role ?? undefined(不从 persona 级联,enum 容错)
  const capabilityModeHit = firstHit(
    [
      {
        value: parseCapabilityMode(overrides.capabilityMode),
        source: src('explicit', 'overrides.capabilityMode'),
      },
      {
        value: parseCapabilityMode(role?.defaultCapabilityMode),
        source: src('role', `role[${roleTag}].defaultCapabilityMode`),
      },
    ],
    parentInherit,
  )

  // isolation: explicit ?? role ?? persona ?? 'none'(默认 'none',从不为 undefined)
  const isolationHit = firstHit(
    [
      { value: overrides.isolation, source: src('explicit', 'overrides.isolation') },
      { value: role?.defaultIsolation, source: src('role', `role[${roleTag}].defaultIsolation`) },
      {
        value: persona?.defaultIsolation,
        source: src('persona', `persona[${personaTag}].defaultIsolation`),
      },
    ],
    src('parent', 'default:none'),
  )
  const isolation: IsolationMode = isolationHit.value ?? 'none'

  // persona 名:只走 explicit(不会反向查找)
  const personaField = overrides.persona ?? undefined

  return {
    model: modelHit.value,
    reasoningEffort: effortHit.value,
    capabilityMode: capabilityModeHit.value,
    persona: personaField,
    personaInstructions,
    rolePrompt,
    roleName,
    isolation,
    personaError,
    rolePromptWarning,
    sources: {
      model: modelHit.source,
      reasoningEffort: effortHit.source,
      capabilityMode: capabilityModeHit.source,
      isolation: isolationHit.source,
      personaInstructions: personaInstructionsSource,
      rolePrompt: rolePromptSource,
    },
    effortDowngrade,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
