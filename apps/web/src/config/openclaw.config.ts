/**
 * OpenClaw 配置 — 等价自旧架构 client/src/config/openclaw.config.ts
 * OpenClaw 是客户端 AI 智能体编排引擎，此处定义其运行时配置
 */

/** OpenClaw 运行模式 */
export type OpenClawMode = 'local' | 'cloud' | 'hybrid'

/** 工具调用策略 */
export type ToolCallStrategy = 'auto' | 'manual' | 'whitelist'

export interface OpenClawConfig {
  /** 运行模式 */
  mode: OpenClawMode
  /** 默认模型 ID */
  defaultModel: string
  /** 备选模型（主模型不可用时降级） */
  fallbackModels: string[]
  /** 最大并发工具调用数 */
  maxConcurrentTools: number
  /** 单轮对话最大 Token */
  maxTokensPerTurn: number
  /** 对话历史保留轮数 */
  contextWindowTurns: number
  /** 工具调用策略 */
  toolCallStrategy: ToolCallStrategy
  /** 允许的工具白名单（strategy=whitelist 时生效） */
  toolWhitelist: string[]
  /** 是否启用流式输出 */
  streamOutput: boolean
  /** 是否启用思考过程展示 */
  showReasoning: boolean
  /** 请求超时（毫秒） */
  requestTimeoutMs: number
  /** 重试次数 */
  retryCount: number
  /** 自定义系统提示词前缀 */
  systemPromptPrefix?: string
  /**
   * 安全护栏：禁止的话题(使用 ID 而非敏感关键词,避免敏感词进入 LLM 上下文)
   * 实际拦截由 systemPromptPrefix 中的"遵守平台安全规范"声明 + 后端审核层兜底
   */
  blockedTopics: string[]
}

/** 默认 OpenClaw 配置 */
export const OPENCLAW_CONFIG: OpenClawConfig = {
  mode: 'cloud',
  defaultModel: 'gpt-4o',
  fallbackModels: ['claude-sonnet', 'gemini-pro'],
  maxConcurrentTools: 5,
  maxTokensPerTurn: 4096,
  contextWindowTurns: 20,
  toolCallStrategy: 'auto',
  toolWhitelist: ['search', 'fetch', 'calculator', 'code-interpreter', 'image-gen'],
  streamOutput: true,
  showReasoning: false,
  requestTimeoutMs: 30000,
  retryCount: 2,
  systemPromptPrefix: '你是 IHUI-AI 的智能助手，请用中文回答，并遵守平台安全规范。',
  // 清空敏感关键词列表:避免"暴力/成人内容"等词被拼入 system prompt 触发 LLM 安全过滤
  // 实际合规拦截由后端审核层兜底,前端不再硬编码敏感词
  blockedTopics: [],
}

/** 本地模式配置覆盖（隐私优先，禁用云端） */
export const OPENCLAW_LOCAL_OVERRIDE: Partial<OpenClawConfig> = {
  mode: 'local',
  defaultModel: 'local-llama',
  fallbackModels: [],
  streamOutput: true,
  showReasoning: true,
  toolCallStrategy: 'whitelist',
  toolWhitelist: ['calculator', 'code-interpreter'],
}

/** 合并用户自定义配置与默认配置 */
export function resolveOpenClawConfig(override?: Partial<OpenClawConfig>): OpenClawConfig {
  const base = { ...OPENCLAW_CONFIG, ...override }
  // 本地模式自动应用本地覆盖
  if (base.mode === 'local') {
    Object.assign(base, OPENCLAW_LOCAL_OVERRIDE, override)
  }
  return base
}
