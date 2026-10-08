// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 记忆与用户画像域跨端契约:MemoryScope/Entry/Sync + 检索/衰减 + UserProfile。
// 自 agent-runtime.ts 拆出(2026-10-08,C2 契约文件行上限 2000 收口;拆分前该文件 2164 行)。
// 内容按行段逐字节搬移,经 agent-runtime.ts 的 export * 链路再导出,公开导出面与拆分前
// 逐名等值 —— @ihui/types 主入口、api-contracts、mobile-rn mock 的消费面均不受影响。
// 守门静态锚定的词汇域(权限模式词表 / AGENT_INSTANCE_STATES / AGENT_TASK_STATUSES /
// AGENT_TURN_STOP_REASONS / AgentSSEEvent / CONNECTION_CAPABILITY_FIELDS)仍实体留在 agent-runtime.ts。
// ============================================================================
// 统一记忆契约(P0-3)
// ============================================================================

/** 记忆作用域(统一三端:CLI/api/ai-service) */
export type MemoryScope = 'global' | 'project' | 'session' | 'user'

/** 记忆条目类型 */
export type MemoryEntryType =
  | 'preference' // 用户偏好
  | 'convention' // 项目约定
  | 'decision' // 历史决策
  | 'fact' // 事实信息
  | 'feedback' // 用户反馈
  | 'skill_ref' // skill 引用(指向 SkillDefinition)

/** 统一记忆条目(跨端共享) */
export interface MemoryEntry {
  /** 条目 ID(自增或 UUID) */
  id: string
  /** 作用域 */
  scope: MemoryScope
  /** 条目类型 */
  type: MemoryEntryType
  /** 分类(如 "UI 偏好"/"API 约定",缺省 "未分类") */
  category: string
  /** 条目文本 */
  text: string
  /** 来源端(cli/api/ai-service) */
  source: string
  /** 创建时间(ISO) */
  createdAt: string
  /** 更新时间(ISO) */
  updatedAt: string
}

/** 统一记忆读写请求 */
export interface MemorySyncRequest {
  /** 用户 ID(必填,隔离不同用户记忆) */
  userId: string
  /** 作用域(缺省 session) */
  scope?: MemoryScope
  /** 会话 ID(scope=session 时必填) */
  sessionId?: string
  /** 项目标识(scope=project 时必填,如 "IHUI-AI-<hash8>") */
  projectKey?: string
}

/** 统一记忆读写响应 */
export interface MemorySyncResponse {
  entries: MemoryEntry[]
  total: number
}

// ============================================================================
// 记忆系统深度层契约(P3-1,2026-07-22 立)
// 对标 Hermes Agent:FTS5 全文 + 向量双引擎 + 自动提取 + 衰减遗忘 + 用户画像
// ============================================================================

/** 记忆检索引擎(双引擎) */
export type MemoryRetrievalEngine = 'fts5' | 'vector' | 'hybrid'

/** 记忆检索请求 */
export interface MemoryRetrievalRequest {
  /** 用户 ID */
  userId: string
  /** 查询文本(语义检索 + 关键词) */
  query: string
  /** 检索引擎(默认 hybrid) */
  engine?: MemoryRetrievalEngine
  /** 作用域过滤 */
  scope?: MemoryScope
  /** 返回条数(默认 10) */
  topK?: number
  /** 相似度阈值(0-1,默认 0.7) */
  similarityThreshold?: number
  /** 是否包含已衰减记忆(默认 false) */
  includeDecayed?: boolean
}

/** 记忆检索结果项 */
export interface MemoryRetrievalResultItem {
  /** 记忆条目 */
  entry: MemoryEntry
  /** 相似度分数(0-1,向量检索) */
  similarity?: number
  /** FTS5 rank(全文检索) */
  ftsRank?: number
  /** 综合得分(hybrid 模式) */
  combinedScore?: number
  /** 命中原因 */
  matchedBy: 'vector' | 'fts5' | 'hybrid' | 'exact'
}

/** 记忆检索响应 */
export interface MemoryRetrievalResponse {
  items: MemoryRetrievalResultItem[]
  total: number
  engine: MemoryRetrievalEngine
  /** 检索耗时(ms) */
  durationMs: number
}

/** 记忆衰减配置 */
export interface MemoryDecayConfig {
  /** 衰减策略 */
  strategy: 'time' | 'access_frequency' | 'combined'
  /** 半衰期(天,time 策略) */
  halfLifeDays: number
  /** 最小保留分数(低于此值标记为 decayed) */
  minRetentionScore: number
  /** 访问加分(每次访问 +x,access_frequency 策略) */
  accessBoost: number
}

/** 记忆衰减状态 */
export interface MemoryDecayState {
  /** 记忆条目 ID */
  entryId: string
  /** 当前衰减分数(0-1) */
  retentionScore: number
  /** 上次访问时间(ISO) */
  lastAccessedAt: string
  /** 访问次数 */
  accessCount: number
  /** 是否已衰减(retentionScore < minRetentionScore) */
  isDecayed: boolean
}

/** 用户画像维度 */
export type UserProfileDimension =
  | 'preference' // 偏好(技术栈/工具/风格)
  | 'expertise' // 专业能力
  | 'communication_style' // 沟通风格
  | 'workflow' // 工作流习惯
  | 'domain' // 领域知识

/** 用户画像条目 */
export interface UserProfileEntry {
  /** 用户 ID */
  userId: string
  /** 画像维度 */
  dimension: UserProfileDimension
  /** 画像内容(如 "偏好 TypeScript,常用 React") */
  content: string
  /** 置信度(0-1,基于支持记忆数) */
  confidence: number
  /** 支持该画像的记忆 ID 列表 */
  supportingMemoryIds: string[]
  /** 最后更新时间(ISO) */
  updatedAt: string
}

/** 用户画像聚合结果 */
export interface UserProfileAggregate {
  userId: string
  entries: UserProfileEntry[]
  /** 记忆总数 */
  totalMemories: number
  /** 画像完整度(0-1,基于各维度覆盖) */
  completeness: number
  /** 上次更新时间(ISO) */
  updatedAt: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
