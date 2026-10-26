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
 *     结果带 `effortDowngrade` 留痕(requested/effective 两值 + 双方出处 + 原因:
 *     'invalid-enum' 非法枚举 / 'rank-lower' 被降低(含落空) / 'rank-higher' 被抬高),
 *     消除静默改档。标签生成只此一处,消费方读同一出口(§0.6)。
 *   - 快照带 `sourceRevisions`(四层各自的来源文件 + mtime 修订号,取不到显式 null + 原因码),
 *     由本文件的 `formatConfigSnapshot` 单点渲染、默认留痕出口写一行 stderr ⇒ 字段有真实消费者。
 *   - 层名清单与人类可读标签的唯一真相源 = 本文件的 `PRECEDENCE_LAYER_LABELS`
 *     (Record 双向穷尽,类型里加一层而不跟本表 ⇒ 编译失败);别处不得再抄第二份层名表。
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
  LayerRevision,
  SourceRevisions,
  RevisionUnavailable,
} from './types.js'

/**
 * G-395 四层名单与标签的唯一真相源(高 → 低)。
 * 键集合 = `PrecedenceLayer`(Record 双向穷尽:多键/少键都编译失败);
 * 插入顺序 = 优先级顺序(`Object.keys` 保序),`PRECEDENCE_LAYERS` 由它派生。
 */
export const PRECEDENCE_LAYER_LABELS: Record<PrecedenceLayer, string> = {
  explicit: 'CLI 显式覆盖',
  role: 'role 默认配置',
  persona: 'persona 默认配置',
  parent: '父 session 继承/默认档',
}

/** 层名清单(高 → 低),唯一出处是上面的标签表 */
export const PRECEDENCE_LAYERS = Object.keys(PRECEDENCE_LAYER_LABELS) as PrecedenceLayer[]

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

/** 单文件修订号读取结果:`revision=null` 时 `reason` 必给(不得用 0 / 空串冒充"取到了") */
export interface FileRevision {
  revision: string | null
  reason: RevisionUnavailable | null
}

/** 修订号读取器(注入点,只为可测 `stat-failed` 一臂;生产一律用 `readFileRevision`) */
export type RevisionReader = (file: string) => FileRevision

/**
 * 默认修订号读取:来源文件 mtime 的 ISO 时刻。
 * stat 拿不到 ⇒ `{revision:null, reason:'stat-failed'}`(不猜、不回落"当前时刻")。
 */
export function readFileRevision(file: string): FileRevision {
  try {
    return { revision: fs.statSync(file).mtime.toISOString(), reason: null }
  } catch {
    return { revision: null, reason: 'stat-failed' }
  }
}

/** `resolveEffectiveOverrides` 的可选注入面(生产不传 = 全用默认实现) */
export interface ResolveEffectiveOptions {
  /** 修订号读取器(默认 `readFileRevision`) */
  revisionReader?: RevisionReader
  /** 快照留痕出口(默认 stderr;传 `null` = 本进程不写)。只吃本文件的单点渲染结果 */
  traceSink?: ((line: string) => void) | null
}

/** 留痕总开关:`IHUI_SUBAGENT_CONFIG_TRACE=0` 关闭(默认开启,每次解析一行) */
export const CONFIG_TRACE_ENV = 'IHUI_SUBAGENT_CONFIG_TRACE'

/** 默认留痕出口:stderr 单行;写失败不得把解析带崩 */
function defaultTraceSink(): ((line: string) => void) | null {
  if (process.env[CONFIG_TRACE_ENV] === '0') return null
  return (line: string): void => {
    try {
      process.stderr.write(line)
    } catch {
      /* 诊断出口自身抛错不得把解析带崩 */
    }
  }
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
 * - 请求档合法但实得档档位下标更低(含实得档彻底落空)→ 'rank-lower'
 * - 请求档合法但实得档档位被抬更高 → 'rank-higher'(票面「因约束被降/升都不得静默改档」的升档半边)
 * 当前四层链上合法请求档必然自己获胜 ⇒ 后两臂打不到(见 __test__ 注记):它们是钳制层的哨兵,
 * 不是冗余分支 —— 少了升档那一臂,一次"被悄悄抬高"的档位就又回到静默传播。
 */
function buildEffortDowngrade(
  requested: { raw: string; source: ConfigFieldSource } | undefined,
  hit: { value: ReasoningEffort | undefined; source: ConfigFieldSource },
): EffortDowngradeTrace | undefined {
  if (!requested) return undefined
  if (requested.raw === hit.value) return undefined
  const trace = (reason: EffortDowngradeTrace['reason']): EffortDowngradeTrace => ({
    requested: requested.raw,
    requestedSource: requested.source,
    effective: hit.value,
    effectiveSource: hit.source,
    reason,
  })
  const rRank = effortRank(requested.raw)
  const eRank = hit.value === undefined ? -1 : effortRank(hit.value)
  if (rRank === -1) return trace('invalid-enum')
  if (eRank < rRank) return trace('rank-lower')
  if (eRank > rRank) return trace('rank-higher')
  // 只剩同序异值 = 档位表出现重复项(下标即序本应单射)。此时降/升两个方向都无从判定,
  // 硬贴一个方向是编造 ⇒ 不猜(§0.3);该前置由镜像测试直接钉住(档位表无重复、下标单射)。
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
): { instructions?: string; error?: string; source?: ConfigFieldSource; filePath?: string } {
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
        // filePath 供快照修订号取 mtime(只有真读过文件才有修订号语义)
        filePath,
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
): { prompt?: string; warning?: string; source?: ConfigFieldSource; filePath?: string } {
  // 算法:role.promptFile 读取的内容 ?? role.prompt ?? undefined
  if (role.promptFile) {
    const filePath = cwd ? path.resolve(cwd, role.promptFile) : role.promptFile
    const result = safeReadFile(filePath)
    if (result.content !== undefined) {
      return {
        prompt: result.content.trim(),
        // filePath 供快照修订号取 mtime(只有真读过文件才有修订号语义)
        filePath,
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
 * - options:注入面(修订号读取器 / 留痕出口),生产不传
 *
 * 返回的 isolation 字段从不为 undefined(默认 'none')。
 */
export function resolveEffectiveOverrides(
  overrides: SubagentRuntimeOverrides,
  role: SubagentRole | undefined,
  personas: PersonaMap,
  cwd?: string,
  roleName?: string,
  options: ResolveEffectiveOptions = {},
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
  // 真读过文件才有修订号语义(只记成功读取的那一条路径)
  let personaInstructionsFile: string | undefined
  let personaError: string | undefined
  if (persona) {
    const result = resolvePersonaInstructions(persona, cwd)
    personaInstructions = result.instructions
    personaInstructionsSource = result.source
    personaInstructionsFile = result.filePath
    personaError = result.error
  }
  // persona 未找到也记录到 personaError(优先于 instructions 读取错误)
  if (personaNotFoundError) {
    personaError = personaNotFoundError
  }

  // === role prompt 加载(soft degradation) ===
  let rolePrompt: string | undefined
  let rolePromptSource: ConfigFieldSource | undefined
  let rolePromptFile: string | undefined
  let rolePromptWarning: string | undefined
  if (role) {
    const result = resolveRolePrompt(role, cwd)
    rolePrompt = result.prompt
    rolePromptSource = result.source
    rolePromptFile = result.filePath
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

  // === 快照修订号(G-395):四层各自的来源文件 + mtime;取不到 ⇒ null + 原因码 ===
  const revisionReader = options.revisionReader ?? readFileRevision
  const revisionOf = (file: string | undefined): LayerRevision => {
    if (!file) return { file: null, revision: null, unavailable: 'no-file-source' }
    const r = revisionReader(file)
    return {
      file,
      revision: r.revision,
      // revision 落 null 时原因码必给(取不到读数不许写 0 / 空串)
      unavailable: r.revision === null ? (r.reason ?? 'stat-failed') : null,
    }
  }
  const sourceRevisions: SourceRevisions = {
    explicit: revisionOf(undefined),
    role: revisionOf(rolePromptFile),
    persona: revisionOf(personaInstructionsFile),
    parent: revisionOf(undefined),
  }

  const effective: EffectiveRuntimeConfig = {
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
    sourceRevisions,
  }

  // 快照留痕:消费 sourceRevisions 的唯一生产出口(单点渲染 + 默认 stderr)
  emitConfigSnapshotTrace(effective, options.traceSink)
  return effective
}

/**
 * 快照单行渲染(唯一实现):获胜层 + 四层修订号。
 * 修订号取不到时打印 `null(原因码)` —— 点名"哪一层、为什么",不冒充读数。
 */
export function formatConfigSnapshot(config: EffectiveRuntimeConfig): string {
  const winners = (['model', 'reasoningEffort', 'capabilityMode', 'isolation'] as const)
    .map((field) => `${field}:${config.sources[field].layer}`)
    .join(',')
  const revisions = PRECEDENCE_LAYERS.map((layer) => {
    const r = config.sourceRevisions[layer]
    if (r.file !== null) return `${layer}=${r.file}@${r.revision ?? 'null'}`
    return `${layer}=null(${r.unavailable ?? 'unavailable'})`
  }).join(' ')
  return `[subagent] config snapshot(G-395): winners=${winners} revisions=${revisions}\n`
}

/**
 * 快照留痕出口(默认 stderr,`IHUI_SUBAGENT_CONFIG_TRACE=0` 或 `sink=null` 关闭)。
 * 写失败只吞自身,绝不让诊断把一次正常解析带崩。
 */
export function emitConfigSnapshotTrace(
  config: EffectiveRuntimeConfig,
  sink?: ((line: string) => void) | null,
): void {
  const write = sink === undefined ? defaultTraceSink() : sink
  if (!write) return
  try {
    write(formatConfigSnapshot(config))
  } catch {
    /* 诊断出口自身抛错不得把解析带崩 */
  }
}

/**
 * G-395 镜像测试出口(§22c):把降档判据本体交给测试,测试不得自带第二份判据。
 *
 * 为什么必须开这个口:`buildEffortDowngrade` 的 `rank-lower` 那一臂在**当前四层链上结构性打不到**
 * (请求档 = 最高优先给出非 undefined 原始值的层;它若合法就是第一个合法值,必然自己获胜 ⇒
 * effective === requested)。它不是冗余分支,是票面判据「请求档因约束被降/升必须留痕」的直接实现 ——
 * 未来任何钳制/降档层一旦接进这条链,只有这一臂会响。不开口就只有两种坏结局:
 * 要么这条臂永无夹具(声明了却没人验,§0.9),要么为凑覆盖率把它删掉(把票面判据删了)。
 * 因此:该臂由测试直接喂合成入参钉住,同时反向核验「今天的公共入口确实打不到它」(见镜像测试)。
 */
export const __test__ = {
  /** 降档留痕判据本体(公共入口的合法链路上只可能产出 invalid-enum 臂) */
  buildEffortDowngrade,
  /** 档位序:下标即序,唯一出处是 REASONING_EFFORTS,别处不得再抄一份 rank 表 */
  effortRank,
  /** 档位表本体(镜像测试读它,不得自带第二份档位清单) */
  REASONING_EFFORTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
