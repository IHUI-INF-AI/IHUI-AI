// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具契约声明面(A13 第一阶段,2026-09-25 立)。
//
// 我们在修什么:一等工具面 apps/cli/src/tools/index.ts 的 `Tool` 只有一个**可选** `dangerLevel`,
// 注释自述"缺省按只读处理" ⇒ **未声明即放行**,方向与"未声明即不可信"相反。于是每次新增工具,
// 默认落点是"不需要批准";而真正的判定要等人记得写 `dangerLevel`。本文件把这类边界收敛成
// **一份声明 + 两个派生谓词**,缺省分支由谓词承担(缺席 ⇒ 判不可信),不再由"没写"承担放行。
//
// 为什么放在 packages/types(而不是像上游那样贴着实现):本仓 web / api / ai-service / cli 四处都要
// 读同一份判定(AGENTS §3 共享层优先)。`dangerLevel` 现有 4 个消费者(clawdbot/permission-guard、
// routes/agent-runtime、ai-service/agent_engine、cli/commands/agent)按打标位与消费层必须同规则
// 的要求,只能取同一处导出的谓词,不得各自再写一遍 if。
//
// 本轮只落三类语义(形状 / 权限 / 结果预算)。**超时与取消 / 追踪两类本轮不装,登记为待评估**:
// 本仓 cli 侧的超时与取消目前没有统一出口(agent.ts 的 tool loop 无逐工具超时档),
// 装了就是一台在既有仓库上无事可判的门 —— 待有消费者时再立,字段位保留在下方注释里。

/**
 * 副作用范围:外部世界五档 + 两档纯协议语义。
 *
 * 值域用本仓既有概念就近命名(不得引入第三个真相源):
 * - `none` — 纯计算,不碰任何外部状态(既有档:`dangerLevel: 'read'` 的一部分)
 * - `workspace` — 读写工作区文件(`ToolContext.workspacePath` / `sandbox.allowedPaths` / `folderTrust`)
 * - `repository` — 读写版本库状态(tools/git.ts、git-advanced.ts、worktree.ts)
 * - `network` — 出网(tools/fetch-url.ts、web-search.ts、github-pr.ts)
 * - `system` — 系统级副作用(tools/terminal.ts 子进程、clipboard.ts、browser.ts Computer-use)
 * - `delegate-to-caller` — 本端不执行,交回调用方/远端(hub 远程注册表、MCP 工具面)
 * - `ask-user` — 只向用户取输入(tools/ask-user.ts 的 `ask_user`、`ToolContext.confirmDangerous`)
 *
 * 与 `packages/types/src/permission-mode.ts` 的权限模式**对齐但不合并**:那边是"用户愿意放行到哪一档",
 * 这边是"这次调用会碰到什么",两者一起才决定批准与否(合并属另一票)。
 */
export const TOOL_EFFECT_SCOPES = [
  'none',
  'workspace',
  'repository',
  'network',
  'system',
  'delegate-to-caller',
  'ask-user',
] as const

export type ToolEffectScope = (typeof TOOL_EFFECT_SCOPES)[number]

/**
 * 纯协议语义两档:副作用不在本端发生(交回调用方 / 只问用户)。
 *
 * 这是 `touchesExternalWorld` 用**排除法**时唯一排除的集合。刻意不把 `none` 排除掉:
 * 声明为"无副作用的读"其结果仍取决于外部状态(读到什么由磁盘/上游决定),策略侧要按"碰了"处置。
 */
export const TOOL_PROTOCOL_EFFECT_SCOPES: readonly ToolEffectScope[] = [
  'delegate-to-caller',
  'ask-user',
]

/** 会改写工作区/仓库/系统状态的档位(谓词 `mayWriteWorkspace` 的判据集合)。 */
export const TOOL_MUTATING_EFFECT_SCOPES: readonly ToolEffectScope[] = [
  'workspace',
  'repository',
  'system',
]

const TOOL_EFFECT_SCOPE_SET: ReadonlySet<string> = new Set<string>(TOOL_EFFECT_SCOPES)

/** 任意输入 → 规范档位;认不出返回 `null`(**不**回退 `'none'`,静默降级就是放行)。 */
export function normalizeToolEffectScope(raw: unknown): ToolEffectScope | null {
  return typeof raw === 'string' && TOOL_EFFECT_SCOPE_SET.has(raw) ? (raw as ToolEffectScope) : null
}

// ==================== 一、形状(含 provider 可见性位)====================

/**
 * 形状描述符:运行时校验器读的**那一份**结构。
 *
 * 它就是 `apps/cli/src/tools/argument-validator.ts` 的入参描述(`ToolParameter`)的结构化超集
 * —— 字段名逐字对齐(`type` / `description` / `enum` / `items` / `properties` / `required`),
 * 使既有声明**无需改写即满足本类型**。模型可见的 JSON Schema 由 `schema-projection.ts`
 * 从这一份单向投影得到,因此"怎么校验"与"模型被告知怎么填"不可能分叉。
 */
export interface ToolShapeDescriptor {
  /** `unknown` 是本仓 `zod` 未接入工具面前"不做类型断言"的那一档(投影时不得写出 type 键) */
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'unknown'
  description?: string
  enum?: readonly (string | number | boolean)[]
  items?: ToolShapeDescriptor
  properties?: Record<string, ToolShapeDescriptor>
  required?: readonly string[]
  /** 任意键值的对象:值类型(缺省即"未约束",投影按归一化第 4 步补键类型) */
  additionalProperties?: ToolShapeDescriptor | boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

/** 投影后交给 provider 的 JSON Schema 节点(开放键位,provider 侧扩展字段原样透传)。 */
export type ProviderJsonSchema = Readonly<Record<string, unknown>>

export interface ToolShapeContract {
  /** 可见性位:false ⇒ 不进下发清单(内部编排专用工具,模型不该看到) */
  visibleToProvider: boolean
  /** 入参形状:校验面与模型面同源的那一份 */
  input: ToolShapeDescriptor
  /** 出参形状:本仓现状多数工具未声明,故可选;声明了就同时用于出参校验 */
  output?: ToolShapeDescriptor
  /** 运行时专用细化:JSON Schema 表达不了的约束(谓词式)。校验时两层都过 */
  runtimeOnlyNotes?: readonly string[]
}

// ==================== 二、权限 ====================

/**
 * 风险级三档。值域与本仓 `Tool.dangerLevel` **逐字相同**(read/write/dangerous),
 * 这里只是把它从端内内联联合提升为共享类型;合并两侧(让 cli 直接用这个类型名)属另一票。
 */
export const TOOL_RISK_LEVELS = ['read', 'write', 'dangerous'] as const
export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number]

/** 判定模式取值来源:策略拿哪几处的字符串去匹配规则(工具名 / 入参 / 路径 / 命令 / URL)。 */
export const TOOL_MATCH_SOURCES = ['tool-name', 'input', 'path', 'command', 'url'] as const
export type ToolMatchSource = (typeof TOOL_MATCH_SOURCES)[number]

/** 拒绝规则的优先位:在询问用户**之前**拦截,还是在静态放行**之后**才拦。 */
export const TOOL_DENY_PRECEDENCES = ['before-ask', 'after-static-allow'] as const
export type ToolDenyPrecedence = (typeof TOOL_DENY_PRECEDENCES)[number]

/** 可持久放行范围的收窄:`never` = 连会话内都不记(每次入参都是新代码的工具备档)。 */
export const TOOL_PERSIST_SCOPES = ['permanent', 'session-only', 'never'] as const
export type ToolPersistScope = (typeof TOOL_PERSIST_SCOPES)[number]

export interface ToolPermissionContract {
  /** 权限键(规则表用它匹配;与 `ToolContext.permissions` 的键空间一致) */
  permissionKey: string
  /** 给人看的批准理由(缺省即不可信:不许留空串) */
  reason: string
  riskLevel: ToolRiskLevel
  /** 副作用范围:两个派生谓词的唯一输入 */
  effectScope: ToolEffectScope
  /** 是否需要批准 */
  requiresApproval: boolean
  /**
   * 无论多宽松都必须问。**只覆盖放行分支,绝不覆盖拒绝分支** ——
   * 被静态规则拒绝的调用不得因为 alwaysAsk 而变成"问一次再放行"。
   */
  alwaysAsk?: boolean
  matchSources?: readonly ToolMatchSource[]
  denyPrecedence?: ToolDenyPrecedence
  persistAllowance?: ToolPersistScope
}

// ==================== 三、结果预算 ====================

export const TOOL_RESULT_POLICIES = ['inline', 'truncate', 'artifact'] as const
export type ToolResultPolicy = (typeof TOOL_RESULT_POLICIES)[number]

export const TOOL_ARTIFACT_RETENTIONS = ['turn', 'session', 'persistent'] as const
export type ToolArtifactRetention = (typeof TOOL_ARTIFACT_RETENTIONS)[number]

export interface ToolResultBudgetContract {
  /** 内联展示阈值(超过即按 policy 处置) */
  inlineLimitBytes: number
  /** provider 可见阈值:回灌模型上下文的上限,独立于内联展示 */
  providerVisibleLimitBytes: number
  policy: ToolResultPolicy
  preview: { bytes: number; lines: number; from: 'head' | 'tail' }
  artifactRetention?: ToolArtifactRetention
}

// ==================== 契约与挂载位 ====================

/**
 * 一份工具契约 = 形状 + 权限 + 结果预算。
 *
 * 本轮不装的语义(登记为待评估,字段位**不**在此声明,免得出现"有字段无消费者"):
 * 超时与取消(`no-timeout` / 定时档 / 取消支持与清理等级 / 给用户看的那句话)、
 * 追踪(强制 trace / 是否穿透 adapter / 入出参各按 摘要|全量|不记)。
 */
export interface ToolContract {
  shape: ToolShapeContract
  permission: ToolPermissionContract
  resultBudget: ToolResultBudgetContract
}

/**
 * 契约挂载位:各端 `Tool` 接口 `extends` 它。
 *
 * **可选是本阶段的刻意设计**(第二阶段翻缺省语义时才收紧):本阶段"没挂契约"必须由
 * 守门 `scripts/check-tool-contract-declared.mjs` 以棘轮拦新增,而不是由运行时改行为 ——
 * 翻缺省是行为变更,用户侧表现为"昨天能跑今天全要批准",必须单独一票逐点复核。
 */
export interface ToolContractMount {
  contract?: ToolContract
}

/** 契约形状的最小视图:两个谓词只需要 `contract?.permission.effectScope`。 */
export type EffectScopeCarrier = Pick<ToolContractMount, 'contract'> | null | undefined

/** 取声明到的副作用范围;任何一层缺席/拼错都返回 `null`(= 交给谓词按不可信处置)。 */
export function declaredEffectScope(carrier: EffectScopeCarrier): ToolEffectScope | null {
  const permission = carrier?.contract?.permission
  if (!permission) return null
  return normalizeToolEffectScope(permission.effectScope)
}

/**
 * 谓词一:这次调用**会不会改写工作区**?缺省即不可信。
 *
 * 判据:`effectScope` 落在 `TOOL_MUTATING_EFFECT_SCOPES` ⇒ 会;
 * **字段缺席 / 契约缺席 / 拼不认识** ⇒ 也判会(未声明即不可信)。
 * 只有显式声明为五档里非改写的那几档与两档协议语义才判不会。
 */
export function mayWriteWorkspace(carrier: EffectScopeCarrier): boolean {
  const scope = declaredEffectScope(carrier)
  if (scope === null) return true
  return TOOL_MUTATING_EFFECT_SCOPES.includes(scope)
}

/**
 * 谓词二:这次调用**碰没碰外部世界**?缺省即不可信,且用**排除法**。
 *
 * 只排除 `TOOL_PROTOCOL_EFFECT_SCOPES`(交回调用方 / 只问用户)两档纯协议语义;
 * `none` 也算碰 —— "声明为无副作用的读"其结果仍取决于外部状态,策略侧要能看见它。
 * 字段缺席 ⇒ 判碰。
 */
export function touchesExternalWorld(carrier: EffectScopeCarrier): boolean {
  const scope = declaredEffectScope(carrier)
  if (scope === null) return true
  return !TOOL_PROTOCOL_EFFECT_SCOPES.includes(scope)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
