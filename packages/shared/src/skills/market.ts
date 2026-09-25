// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skills 市场跨端共享类型(2026-07-23 立)。
 * 自研技能市场能力:IHUI-AI 补齐搜索/安装/评分分发闭环。
 */

export interface SkillMarketEntry {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  /** lucide 图标名(可选,前端按名渲染;缺省回退通用图标) */
  icon?: string
  installCount: number
  rating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  /**
   * listing 级上下架开关(P2-14 补齐,2026-09-25)。
   * 缺省即 true —— 既有种子数据与历史写入点都没有这个字段,按"未下架"解释,
   * 只有显式 false 才从市场列表隐身(下架不删条目,与 installCount/rating 一同保留)。
   */
  enabled?: boolean
  /**
   * 条目来源:builtin 平台内置 / user 用户上架 / hub 内部自进化同步写入。
   * 由服务端按调用身份推导(带 X-Internal-Secret 的走 hub,登录用户走 user),
   * 不接受客户端自报,否则等于把归属权交给请求体。
   */
  source?: 'builtin' | 'user' | 'hub'
  /**
   * 上架者的用户 ID,owner 判定的唯一依据(服务端按 request.userId 比对此列)。
   * 内置种子与内部同步条目没有归属者 ⇒ 留空,任何人都不算 owner。
   */
  ownerId?: number
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
export type SkillPublishResponse = SkillMarketEntry

/** 订阅状态查询响应 */
export interface SkillSubscriptionResponse {
  subscribed: boolean
  subscriberCount: number
}

/** Skill 更新通知(存储于 Redis List skill-notifications:<userId>) */
export interface SkillNotification {
  id: string
  skillName: string
  message: string
  version?: string
  timestamp: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
