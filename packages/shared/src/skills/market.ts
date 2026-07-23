/**
 * Skills 市场跨端共享类型(2026-07-23 立)。
 * 对齐 TRAE Work 技能市场能力:IHUI-AI 补齐搜索/安装/评分分发闭环。
 */

export interface SkillMarketEntry {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  installCount: number
  rating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface SkillRating {
  id: string
  userId: number
  userName: string
  skillName: string
  score: number
  comment?: string
  createdAt: string
}

export interface SkillMarketQuery {
  q?: string
  tag?: string
  page?: number
  pageSize?: number
}

export interface SkillMarketListResponse {
  items: SkillMarketEntry[]
  total: number
  page: number
  pageSize: number
}

export interface SkillInstallResponse {
  name: string
  installed: boolean
  installCount: number
}

export interface SkillRateRequest {
  score: number
  comment?: string
}

/**
 * 发布 skill 到市场的请求体。
 * content 为 skill 正文(供安装时复制到用户私有库),市场条目本身只存元数据。
 */
export interface SkillPublishRequest {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  content: string
}

/** 发布端点响应(返回新建的市场条目) */
export interface SkillPublishResponse extends SkillMarketEntry {}
