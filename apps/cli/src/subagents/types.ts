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
}

/** persona 名 → persona 配置映射 */
export type PersonaMap = Record<string, SubagentPersona>

/** role 名 → role 配置映射 */
export type RoleMap = Record<string, SubagentRole>
