// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 优先级链类型定义 — P1-2 Subagent precedence。
 *
 * 四层优先级(高 → 低,前者胜):
 *   1. explicit:spawn 时显式传入的 override(SubagentRuntimeOverrides)
 *   2. role:按 subagent_type 匹配的 SubagentRole 默认配置
 *   3. persona:按 overrides.persona 名查找的 SubagentPersona 默认配置
 *   4. parent:None — 让下游 shell spawn 时继承父 session 值(TS 中返回 undefined)
 *
 * 设计参考:参考行业 Agent 框架的 subagent-resolution Rust Option::or_else 短路链。
 */

/** 隔离模式:none=不隔离 / worktree=git worktree / subprocess=子进程 */
export type IsolationMode = 'none' | 'worktree' | 'subprocess'

/** 能力模式:控制 subagent 工具白名单档位 */
export type CapabilityMode = 'read-only' | 'read-write' | 'execute' | 'all'

/** 推理强度:对齐 OpenAI/Anthropic reasoning effort 参数 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'

/** explicit 层:用户在 task 工具调用时显式传入的覆盖项 */
export interface SubagentRuntimeOverrides {
  /** 用户在 task 工具调用时显式传入 */
  model?: string
  reasoningEffort?: ReasoningEffort
  persona?: string
  capabilityMode?: CapabilityMode
  isolation?: IsolationMode
}

/** role 层:按 subagent_type 匹配的默认配置 */
export interface SubagentRole {
  /** role 名称(如 'researcher' / 'coder' / 'reviewer') */
  name: string
  /** role 默认模型 */
  model?: string
  reasoningEffort?: ReasoningEffort
  defaultCapabilityMode?: CapabilityMode
  defaultIsolation?: IsolationMode
  /** role 内嵌 prompt 文本 */
  prompt?: string
  /** role prompt 文件路径(优先于 prompt) */
  promptFile?: string
}

/** persona 层:按 overrides.persona 名查找的默认配置 */
export interface SubagentPersona {
  /** persona 名称 */
  name: string
  model?: string
  reasoningEffort?: ReasoningEffort
  defaultIsolation?: IsolationMode
  /** persona 内嵌 instructions 文本 */
  instructions?: string
  /** persona instructions 文件路径(优先于 instructions) */
  instructionsFile?: string
}

/**
 * G-395 出处层标识:四层短路链的层名(高 → 低)。
 * 'parent' = 本链未给出值,由下游 shell spawn 继承父 session(或 isolation 的默认 'none')。
 */
export type PrecedenceLayer = 'explicit' | 'role' | 'persona' | 'parent'

/**
 * G-395 单字段出处标签:哪个层获胜 + 来自哪个覆盖项/配置项/来源文件。
 * 生成只此一处(precedence.ts 的 resolveEffectiveOverrides),消费方读同一出口,不得复算。
 */
export interface ConfigFieldSource {
  layer: PrecedenceLayer
  /** 出处描述,如 'overrides.model' / 'role[coder].model' / 'persona[p1].instructionsFile:<路径>' */
  origin: string
}

/**
 * G-395 快照修订号取不到的原因(机器码,`null` = 已取到)。
 * 取不到一律写原因码并让 revision 落 `null`,**不得**用 0 / 空串冒充"取到了"。
 */
export type RevisionUnavailable = 'no-file-source' | 'stat-failed'

/**
 * G-395 单层快照修订号:该层在本轮解析中真实读过的来源文件的 mtime 语义。
 * 本仓 role / persona 配置表是内存常量(`PERSONAS` / `DEFAULT_ROLES`),没有配置文件可 stat,
 * 因此能给出真实修订号的只有它们指向的 `promptFile` / `instructionsFile`;
 * 其余层(CLI 参数、父 session 继承)结构上无来源文件 ⇒ `file=null` + `unavailable='no-file-source'`。
 */
export interface LayerRevision {
  /** 本轮解析中该层真实读取的来源文件绝对路径;非文件驱动 ⇒ null */
  file: string | null
  /** 来源文件 mtime 的 ISO 时刻(修订号语义);未取到 ⇒ null(绝不用 0 / 空串冒充) */
  revision: string | null
  /** `revision` 为 null 的显式原因;取到时 ⇒ null */
  unavailable: RevisionUnavailable | null
}

/** G-395 四层快照修订号(键集合 = 层名清单,由 precedence.ts 的 Record 穷尽性钉住) */
export type SourceRevisions = Record<PrecedenceLayer, LayerRevision>

/**
 * G-395 请求档 vs 实得档留痕:仅当请求档未被原样采纳(降档/升档/非法枚举损耗)时非空。
 * 'effective' 与 EffectiveRuntimeConfig.reasoningEffort 同值、同一出口生成(非第二份真相),
 * 打包进本记录只为让日志/状态面一次读全 requested ≠ effective。
 */
export interface EffortDowngradeTrace {
  /** 请求档原始值(最高优先给出非 undefined 的层,含非法枚举值,原样保留供归因) */
  requested: string
  /** 请求档出处(哪层/哪个配置项给的) */
  requestedSource: ConfigFieldSource
  /** 实得档(链解析后的最终值;undefined = 四层皆空) */
  effective?: ReasoningEffort
  /** 实得档出处(哪层/哪个配置项接手了) */
  effectiveSource: ConfigFieldSource
  /** 'invalid-enum' = 请求档非法枚举被容错丢弃;'rank-lower' = 实得档低于请求档(含落空);'rank-higher' = 实得档被抬高于请求档 */
  reason: 'invalid-enum' | 'rank-lower' | 'rank-higher'
}

/** 解析后的有效运行时配置(四层短路链结果) */
export interface EffectiveRuntimeConfig {
  model?: string
  reasoningEffort?: ReasoningEffort
  capabilityMode?: CapabilityMode
  persona?: string
  personaInstructions?: string
  rolePrompt?: string
  roleName?: string
  /** 隔离模式:默认 'none',从不为 undefined */
  isolation: IsolationMode
  /** persona 文件读取错误(fail-closed 不抛异常,记录于此) */
  personaError?: string
  /** role prompt 文件读取警告(soft degradation) */
  rolePromptWarning?: string
  /** G-395:各生效字段的出处标签(哪层获胜、来自哪个覆盖项/配置项/来源文件) */
  sources: {
    model: ConfigFieldSource
    reasoningEffort: ConfigFieldSource
    capabilityMode: ConfigFieldSource
    isolation: ConfigFieldSource
    /** persona instructions 内容出处(无内容时缺省) */
    personaInstructions?: ConfigFieldSource
    /** role prompt 内容出处(无内容时缺省) */
    rolePrompt?: ConfigFieldSource
  }
  /** G-395:请求档 vs 实得档留痕,仅降档发生时存在(消除静默降档) */
  effortDowngrade?: EffortDowngradeTrace
  /**
   * G-395:快照可读的四层修订号(哪一层的来源文件、mtime、取不到时的显式原因)。
   * 消费方读 `precedence.ts` 的 `formatConfigSnapshot` / 默认留痕出口,不得自带第二份渲染。
   */
  sourceRevisions: SourceRevisions
}

/** persona 名 → persona 配置映射 */
export type PersonaMap = Record<string, SubagentPersona>

/** role 名 → role 配置映射 */
export type RoleMap = Record<string, SubagentRole>

// ───────────────────────── Subagent 状态机(唯一成员清单) ─────────────────────────

/**
 * "无活动超阈 ⇒ 转后台"这一中间态的机器码(2026-09-27 票)。
 * 全仓 `'detached_idle'` 字面量只许出现在这一处声明
 * (由 apps/cli/tests/subagent-detach-state-vocabulary.test.ts 源码锁钉住);
 * 其余文件一律引本常量或 `SubagentLifecycleStatus` 类型。
 */
export const SUBAGENT_STATUS_DETACHED_IDLE = 'detached_idle' as const

/**
 * Subagent 生命周期状态机 —— **成员清单的唯一声明处**。
 * state-store.ts 的持久化 status 字段与 worker-pool.ts 的转后台迁移都引用本表,
 * 不得再抄第二份成员清单(本仓 blocking 守门判"端内不得再抄第二份成员清单")。
 *
 * `detached_idle` 的语义(用户拍板的两条硬口径):
 *   · 它是一次**状态迁移**而非杀死 —— 子进程仍在后台运行,终态仍可经
 *     `SubagentWorkerPool.awaitResult()` 取回;
 *   · 它**刻意不进** `SUBAGENT_TERMINAL_STATUSES` —— 不得把转后台渲染成
 *     completed/failed/cancelled 里任何一个(AGENTS.md §30「钩子无终态不得渲染成"完成"」
 *     同一条禁令:账面绿而实际没人知道那一步发生了什么,是本仓最高代价的失效型)。
 */
export const SUBAGENT_LIFECYCLE_STATUSES = [
  'running',
  'completed',
  'failed',
  'cancelled',
  SUBAGENT_STATUS_DETACHED_IDLE,
] as const

export type SubagentLifecycleStatus = (typeof SUBAGENT_LIFECYCLE_STATUSES)[number]

/**
 * 终态集合:completed / failed / cancelled。
 * `detached_idle` 与 `running` 都是中间态,不在此集合内。
 */
export const SUBAGENT_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const

export type SubagentTerminalStatus = (typeof SUBAGENT_TERMINAL_STATUSES)[number]

/** 是否终态(判据唯一出口,消费端不得自行内联三档名单) */
export function isSubagentTerminalStatus(
  status: SubagentLifecycleStatus,
): status is SubagentTerminalStatus {
  return (SUBAGENT_TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * 转后台原因的机器码(用户可见文案暂以本 ASCII 码呈现)。
 * 语言包此刻有多个代理并发修改(本仓记过的事故型),五语言键由语言包持有人单批补齐;
 * 键名与各语言建议文案见该票交付报告末节。
 */
export const SUBAGENT_DETACH_REASON = 'subagent_detached_idle' as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
