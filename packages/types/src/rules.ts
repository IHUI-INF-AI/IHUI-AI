/**
 * Rules 引擎跨端类型契约(2026-07-22 立,对标 Trae IDE Rules)。
 *
 * Rule = 用户可编辑的规则集,约束 agent 运行时行为。
 * 与 AGENTS.md(项目级强制规则)互补:AGENTS.md 是人读 + 守门脚本执行,
 * Rule 是 agent 运行时动态加载 + 注入 system prompt。
 *
 * 存储:ai-service 端用文件系统(.trae-cn/rules/*.md frontmatter),不走数据库。
 * 匹配:always / keyword / regex / semantic(embedding cosine)。
 */

/** 规则作用域 */
export type RuleScope = 'global' | 'workspace' | 'agent'

/** 规则匹配类型 */
export type RuleMatchType = 'always' | 'keyword' | 'regex' | 'semantic'

/** 用户可编辑的规则定义 */
export interface Rule {
  /** 唯一标识(slug,用作文件名) */
  id: string
  /** 规则名称 */
  name: string
  /** 规则描述(可选) */
  description?: string
  /** 规则正文(markdown,作为 prompt 注入) */
  content: string
  /** 作用域:全局 / 工作区 / 特定 agent */
  scope: RuleScope
  /** scope='agent' 时指定的 agent id */
  agentId?: string
  /** 优先级 0-100,数字越大优先级越高 */
  priority: number
  /** 是否启用 */
  enabled: boolean
  /** 匹配类型 */
  matchType: RuleMatchType
  /**
   * 匹配模式:
   * - always: 无需 pattern
   * - keyword: 逗号分隔关键词,任一命中即注入
   * - regex: 正则字符串
   * - semantic: 自然语言描述(用 embedding cosine similarity 匹配)
   */
  matchPattern?: string
  /** 创建时间 ISO */
  createdAt: string
  /** 更新时间 ISO */
  updatedAt: string
}

/** 创建规则请求体 */
export interface RuleInput {
  name: string
  description?: string
  content: string
  scope?: RuleScope
  agentId?: string
  priority?: number
  enabled?: boolean
  matchType?: RuleMatchType
  matchPattern?: string
}

/** 更新规则请求体(部分字段) */
export interface RuleUpdate {
  name?: string
  description?: string
  content?: string
  scope?: RuleScope
  agentId?: string
  priority?: number
  enabled?: boolean
  matchType?: RuleMatchType
  matchPattern?: string
}

/** 规则测试请求体 */
export interface RuleTestRequest {
  message: string
}

/** 规则测试结果 */
export interface RuleTestResult {
  matched: boolean
  reason: string
}

/** 规则列表响应 */
export interface RuleListResponse {
  rules: Rule[]
  total: number
}

/** 规则匹配结果(供 agent loop 拼接到 system prompt) */
export interface RuleMatchResult {
  /** 命中的规则(按 priority DESC 排序,截断 top 10) */
  appliedRules: Rule[]
  /** 拼接后的规则正文(直接追加到 system prompt 末尾) */
  promptSuffix: string
}
