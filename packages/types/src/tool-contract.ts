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
 *
 * 发射子集 == 校验子集(b76-05 票2):本接口的键集与
 * `schema-projection.ts` 的 `SCHEMA_PROJECTION_VOCABULARY` 是**同一份词汇表**——
 *那边是唯一权威(发射器与校验器同表),本接口是它的类型投影;两边若分叉,
 * 严格投影(`projectToolInputSchemaStrict`)会当场抛 `ToolSchemaProjectionError` 并给出
 * `$.properties.x` 形式的路径,不再允许"尽力归一化"把不认识的构造静默吞掉。
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
  /**
   * **上游原样匹配模式**(G-661,2026-09-30 立):只准放服务器/声明方明确下发的 pattern。
   * 本地推断值(由模板名/启发式推出的形状)一律写 `inferredPattern`,绝不写本字段冒充原样 ——
   * 空字符串与占位符(如 `__PATTERN__`)也算伪造:没有就是没有,读取出口
   * `declaredPattern` 会如实回 `undefined`,不回空串、不回推断值。
   * 与守门 135"失败分支身份不得丢、不得被文案冒充"同族:结构化身份字段只在结构化通道保真传递。
   */
  pattern?: string
  /**
   * **本地推断的匹配模式**(与 `pattern` 分键,G-661):由模板名/启发式推出的形状住这里,
   * 只准经显式推断出口 `inferPatternFromTemplateName` 产出、经 `inferredPatternOf` 显式读;
   * 渲染面读原样只走 `declaredPattern`,绝不读本键冒充原样。provider 可见面**永不投影**本键
   * (推断值不得下发冒充原样;发射白名单见 schema-projection.ts)。
   */
  inferredPattern?: string
}

/** 投影后交给 provider 的 JSON Schema 节点(开放键位,provider 侧扩展字段原样透传)。 */
export type ProviderJsonSchema = Readonly<Record<string, unknown>>

// ==================== 一·补:原样/推断分键的读取出口(G-661,2026-09-30)====================

/**
 * 占位形态判据(窄集合):这些值"写了等于没写",塞进 `pattern` 就是伪造原样,
 * 读取出口一律按缺席处置(回 `undefined`,不回空串)。集合刻意窄 —— 把真 pattern
 * 误判成占位会**丢真形状**,方向比照守门 137"宁漏不误报"。
 */
function isPlaceholderShapeValue(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return true
  const lowered = trimmed.toLowerCase()
  if (lowered === '...' || lowered === 'todo' || lowered === 'tbd' || lowered === 'placeholder') {
    return true
  }
  return /^__[^_]*__$/.test(trimmed) || /^<[^<>]*>$/.test(trimmed)
}

/** 非空、非占位的字符串才认;其余一律 `undefined`(取不到形状就是取不到,不造一个假的)。 */
function nonPlaceholderPattern(raw: unknown): string | undefined {
  return typeof raw === 'string' && !isPlaceholderShapeValue(raw) ? raw : undefined
}

/**
 * 渲染面读**原样** pattern 的唯一出口(G-661)。
 *
 * 只认上游原样 `pattern` 键;描述符缺席 / 键缺席 / 空串 / 占位 ⇒ `undefined`。
 * **绝不回退 `inferredPattern`**:渲染面拿推断值冒充原样,正是本票要消灭的形态。
 */
export function declaredPattern(
  descriptor: ToolShapeDescriptor | null | undefined,
): string | undefined {
  return nonPlaceholderPattern(descriptor?.pattern)
}

/**
 * 读本地推断分键的**显式出口**(G-661):消费方必须自知在拿推断值。
 * 返回值只准用于展示/提示,或写回 `inferredPattern` 键;**写进 `pattern` 即伪造原样**。
 */
export function inferredPatternOf(
  descriptor: ToolShapeDescriptor | null | undefined,
): string | undefined {
  return nonPlaceholderPattern(descriptor?.inferredPattern)
}

/**
 * 模板名 → 推断 pattern 的唯一启发式出口(G-661):**表为判据唯一来源**,认不出 ⇒ `undefined`,
 * 绝不现场猜一个正则。返回值只准写进描述符的 `inferredPattern` 键(经 `inferredPatternOf` 读),
 * 不得写进 `pattern` 冒充上游原样;provider 投影(`schema-projection.ts`)也不发射该键。
 */
export const TEMPLATE_NAME_INFERRED_PATTERNS: Readonly<Record<string, string>> = {
  'date-iso': '^\\d{4}-\\d{2}-\\d{2}$',
  'time-iso': '^\\d{2}:\\d{2}(:\\d{2})?$',
  uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  semver: '^\\d+\\.\\d+\\.\\d+$',
}

export function inferPatternFromTemplateName(templateName: string): string | undefined {
  if (typeof templateName !== 'string') return undefined
  return TEMPLATE_NAME_INFERRED_PATTERNS[templateName.trim().toLowerCase()]
}

/**
 * **路由身份键清单(唯一一份;守门与类型层共用,禁止在别处抄第二份)**。
 *
 * 规范(注释级,2026-09-25 立;机器判据 = `scripts/check-tool-arg-routing-identity.mjs`):
 * **路由身份一律由宿主在 closure / ctx 里绑定,绝不得出现在 `shape.input` 或任何会进入
 * 模型可见 schema 的参数集合里。** 一旦这类键进了 schema,模型就能自己填一个**别人的**值,
 * 把结果投给别的会话 / 别的宿主实例 —— 那是越权,不是参数校验问题(同族先例见
 * `docs/runtime-capability-disclosure.md` 与 agent-control 链路"投递定址按实例绑定、模型不得覆盖")。
 *
 * 判据的归一化口径住在守门内(小写 + 去 `_`/`-`,故 `sessionId` 与 `session_id` 同视),
 * 这里只出**清单**,以免两份实现各处漂移。
 *
 * 为什么正是这 16 个:它们每一个都回答"**这次调用归谁 / 落到哪条会话 / 落到哪个实例**",
 * 即"投递定址"本身:
 * - `sessionId` / `agentId` / `instanceId` — 会话、Agent 定义、宿主实例三级定址;
 * - `userId` — 归属主体(填别人的 = 直接跨账号);
 * - `conversationId` / `chatId` — 对话容器(结果会被写进哪一个对话);
 * - `runId` / `turnId` — 运行与轮次(把产出续到别人那一轮上)。
 *
 * **刻意排除的键(它们是"内容引用"而不是"路由身份",纳进来会误拦正当用法)**:
 * - `messageId` / `message_id` — 模型引用它要回复/引用哪条消息,是任务内容的一部分;
 * - `toolCallId` / `tool_call_id` — 协议关联位(把结果对回某次调用),宿主本就按它回填;
 * - `taskId` / `subagentId` / `fileId` / `path` 等 — 业务对象句柄,权限由 effectScope + 批准面管,
 *   不构成"投给别的会话/别的实例"的定址能力。
 * 要往这张表加键,先问一句:**填错它会不会把结果送到别人那里?** 会 → 加;不会 → 属于内容引用,不得加。
 */
export const ROUTING_IDENTITY_KEYS = [
  'sessionId',
  'session_id',
  'agentId',
  'agent_id',
  'instanceId',
  'instance_id',
  'userId',
  'user_id',
  'conversationId',
  'conversation_id',
  'chatId',
  'chat_id',
  'runId',
  'run_id',
  'turnId',
  'turn_id',
] as const

export type RoutingIdentityKey = (typeof ROUTING_IDENTITY_KEYS)[number]

export interface ToolShapeContract {
  /** 可见性位:false ⇒ 不进下发清单(内部编排专用工具,模型不该看到) */
  visibleToProvider: boolean
  /**
   * 入参形状:校验面与模型面同源的那一份。
   *
   * ⚠️ 注释级规范(判据在守门,不在本类型):`input.properties` / `parameters` 的键集
   * **只准放业务入参**。路由身份(见上方 `ROUTING_IDENTITY_KEYS`)由宿主在 closure / ctx 绑定,
   * 一旦进到这里就变成"模型可填",等于把投递定址交给模型 —— 越权而非校验问题。
   */
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

// ==================== 二·补:确认凭据档(confirmation)====================

/**
 * 确认凭据的封闭三档。
 *
 * 它在修什么(上游取证,第三方 CLI zcode 的读法,原路径见 PROJECT_PLAN 该票):
 * 破坏性确认做在**参数层/声明层**而不是执行层 —— 缺 `--force` 直接回 usage 且**不执行**、
 * 覆盖既有资源要 `replace` 前缀或一次显式 TUI 选择、幂等 no-op 用 `removed: … | null`
 * 编码而不是回 `true`。三者共同点是:"要不要人点头"是**契约的一部分**,不是执行时临场决定。
 * 我方现状(2026-09-29 实测 `git grep -c confirmation HEAD -- packages/types/src/tool-contract.ts`
 * = 0 命中):契约里根本没有这一档,写/危险档工具"由谁确认、怎么确认"无处可查。
 *
 * 三条设计约束(缺一不成立):
 *  1. **封闭联合** —— mode 取值只有三档,拼不认识即判据失明,所以归一化出口只认字面量;
 *  2. **`none` 也带 reason** —— "没有确认"必须是一个**显式决定**(写明为什么不需要,例如
 *     调用方已在上游完成批准、该操作天然幂等无破坏面),而不是字段缺席;缺席由守门 TC5
 *     在写/危险档判红(与 `declaredEffectScope` "认不出返回 null、不静默降级" 同一条禁令);
 *  3. **字段本身可选** —— 既有 104 枚工具与 `schema-projection.ts` / `argument-validator.ts`
 *     不得因新增**必填**字段而编译失败(本票只加描述与判据,不改运行时行为);
 *     "必填"由判据 `scripts/check-tool-contract-declared.mjs` 的 **TC5** 在写/危险档执行。
 */
export const TOOL_CONFIRMATION_MODES = ['explicit-flag', 'interactive', 'none'] as const
export type ToolConfirmationMode = (typeof TOOL_CONFIRMATION_MODES)[number]

const TOOL_CONFIRMATION_MODE_SET: ReadonlySet<string> = new Set<string>(TOOL_CONFIRMATION_MODES)

/** 调用必须显式带上 `flag` 命名的参数(如 `force` / `yes`)才放行;缺席由工具面拒绝执行。 */
export interface ToolExplicitFlagConfirmation {
  mode: 'explicit-flag'
  /** 参数名(非空)。投影到 provider schema 时它是一个普通业务入参,由执行前判定消费。 */
  flag: string
}

/** 由宿主向人发起一次交互批准(本仓对应 `ToolContext.confirmDangerous` / 批准闸链路)。 */
export interface ToolInteractiveConfirmation {
  mode: 'interactive'
}

/** 显式决定"不需要确认",**必须带理由**;理由为空等于没做这个决定。 */
export interface ToolNoConfirmation {
  mode: 'none'
  reason: string
}

export type ToolConfirmationPolicy =
  | ToolExplicitFlagConfirmation
  | ToolInteractiveConfirmation
  | ToolNoConfirmation

/** 任意输入 → 规范确认档;认不出返回 `null`(**不**回退 `'none'`,静默降级就是放行)。 */
export function normalizeToolConfirmationMode(raw: unknown): ToolConfirmationMode | null {
  return typeof raw === 'string' && TOOL_CONFIRMATION_MODE_SET.has(raw)
    ? (raw as ToolConfirmationMode)
    : null
}

/**
 * 确认凭据的运行时校验出口(唯一一份;判据的静态解析与本函数的形状规则必须同形)。
 *
 * 通过 ⇒ 返回规范化策略;任何一档缺它要求的非空字符串(`flag` / `reason`)⇒ `null`,
 * 不返回"最接近的一档"。
 */
export function validateToolConfirmationPolicy(raw: unknown): ToolConfirmationPolicy | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const mode = normalizeToolConfirmationMode(record['mode'])
  if (mode === null) return null
  if (mode === 'explicit-flag') {
    const flag = record['flag']
    return typeof flag === 'string' && flag.trim().length > 0 ? { mode, flag } : null
  }
  if (mode === 'interactive') return { mode }
  const reason = record['reason']
  return typeof reason === 'string' && reason.trim().length > 0 ? { mode, reason } : null
}

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
   *
   * 消费者(此前全仓零消费者,声明等于空支票):
   * `apps/cli/src/tools/index.ts` 的 `requiresUserConfirmation()` —— 唯一实现,只认显式 `true`。
   */
  alwaysAsk?: boolean
  /**
   * 确认凭据档(见上方「二·补」)。**类型层可选、判据层必填**:
   * `riskLevel`(或工具面 `dangerLevel`)落在 `write` / `dangerous` 而此字段缺席 ⇒
   * 守门 `scripts/check-tool-contract-declared.mjs` **TC5** 判红;
   * `read` 档无强制要求。既有 104 枚工具与投影/校验消费方**不因本字段而改行为**。
   */
  confirmation?: ToolConfirmationPolicy
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
 * 免批两轴的**声明面**(2026-09-28 立,第三方工具面专用)。
 *
 * 它钉的是这一型漏洞:第三方工具能不能免批,过去只看一档危险级别(**单轴**),于是
 * "只读但会把请求打到外部世界"与"不碰外部世界但会写"在批准闸上长得一模一样。
 * 口径(用户 2026-09-28 拍板):**只有「只读」且「不碰外部世界」同时成立才允许免批**,
 * 任一不成立就必须问。
 *
 * 两条**独立**字段,刻意不合成一个布尔,也不借用 `riskLevel`/`dangerLevel` 冒充 ——
 * 一档风险级别回答的是"这一档多危险",而这里要的是两条可各自取证、各自为假的事实
 * (合并即"把两轴压回一轴",正是本票要消灭的形态)。
 * 判据(两者的合取)只住一处:`apps/cli/src/tools/index.ts` 的 `requiresUserConfirmation()`;
 * 声明方(如 `tools/mcp-runtime.ts`)只抄事实,不得自己判"免不免批"。
 */
export interface ApprovalExemptionAxes {
  /** 轴 A(只读):true = 被声明为只读取数据、不产生状态变更;false/缺席 = 未证明 ⇒ 按非只读处置 */
  readonly readonlyAxis: boolean
  /** 轴 B(不碰外部世界):true = 被声明为不触达外部世界;false/缺席 = 未证明 ⇒ 按"碰"处置 */
  readonly closedWorldAxis: boolean
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
  /**
   * 免批两轴的声明位(见 `ApprovalExemptionAxes`)。
   *
   * 为什么住在挂载位而不是塞进 `contract.permission`:后者要求同时填满 `shape` 与
   * `resultBudget` 才能构造,而第三方工具**没有**声明过结果预算 —— 为了一条批准判据
   * 去伪造一份 `resultBudget`,等于顺手给该工具的输出加一道裁剪(执行器边界按契约截断),
   * 那是本票明确禁止的"顺手改缺省语义"。两轴因此独立成一份只声明事实的挂载位。
   *
   * **缺席 = 本判据不适用**(内建工具行为逐字不变),不是"两轴都不成立"。
   */
  approvalExemption?: ApprovalExemptionAxes
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

// ==================== 四、权限轴 → 批准决策的唯一投影(D142,2026-09-29)====================

/**
 * 「这次调用必须由人来批准」的**唯一投影出口**(D142 权限轴落地)。
 *
 * 它在修什么:`ToolPermissionContract` 的字段(`effectScope` / `riskLevel` /
 * `requiresApproval` / `alwaysAsk`)此前只有声明面与一份 drift 报告(spec-drift.ts),
 * **执行路径一条都不读** ⇒ 契约写了什么与运行时问不问人毫无关系(同族先例:守门 64/70/81/115
 * "造好没装车")。本函数是那一句承诺的唯一实现:决策宿主(cli `tools/permissions.ts` 的
 * `decideWithMode`、cli `tools/danger-gate.ts` 的会话级 flag 闸)一律调它,
 * **禁止在任何宿主里再抄一份档名清单或 if 链**(§3 共享层优先;TC4 判这条摘线)。
 *
 * 三条判序(顺序本身是判据):
 *  1. **契约缺席 ⇒ `false`,本判据完全不参与**。这是"不改缺省语义"的落点:第二阶段把
 *     "未声明即不可信"翻成运行时行为属另一票(前置 = `--flip-audit` 点名的工具逐个补档),
 *     否则用户侧表现是"昨天能跑今天全要批准" —— 那是制造事故不是收紧安全。
 *  2. 显式 `alwaysAsk === true` ⇒ 必须问(只认字面量 true,与 `tools/index.ts` 的
 *     `isAlwaysAskDeclared` 同一档语义,不是第二份判据:那边判"要不要问",这边判"谁能替人答")。
 *  3. `requiresApproval === true` 且这次调用**碰外部世界** ⇒ 必须问;
 *     两档纯协议语义(`delegate-to-caller` / `ask-user`)本端没有可批准的事,判 `false`。
 *     字段拼不认识 / 取不到 ⇒ `touchesExternalWorld` 判"碰"(**已声明**的契约上 fail-closed,
 *     与"契约整体缺席不参与"是两件事,不得混读)。
 *
 * 消费面(不得只写注释):生产面读取点由 `scripts/check-tool-contract-declared.mjs` 的
 * **TC4** 对账 —— 零消费者即红,所以"加了出口没人调"在这一枚提交里就过不去。
 */
export function humanApprovalMandated(carrier: EffectScopeCarrier): boolean {
  const permission = carrier?.contract?.permission
  if (!permission) return false
  if (permission.alwaysAsk === true) return true
  if (permission.requiresApproval !== true) return false
  return touchesExternalWorld(carrier)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
