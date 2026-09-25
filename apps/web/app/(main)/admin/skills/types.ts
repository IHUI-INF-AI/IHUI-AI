// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「我的技能库」视图模型(`GET /api/skills` 的行)。
 *
 * **身份就是 `name`,没有 `id`。** 后端 `apps/api/src/routes/skills.ts` 的存储形态
 * `SkillRecord` 从不产出 id 字段:Redis key 是 `skills:<userId>`、field 是 `name`,
 * 读写删全部按 `:name` 寻址(`GET/DELETE /skills/:name`)。此前这里声明了一个必填
 * `id: string`,于是:
 *  - `SkillTable` 的 `<tr key={skill.id}>` 每行 React key 恒为 `undefined`(重复 key);
 *  - 删除按钮 `onDelete(skill.id)` 实际打到 `DELETE /api/skills/undefined` ⇒ 恒 404,
 *    **删除功能对用户是坏的**。
 * 与市场条目同一处置径(见本文件 `MarketSkill.id` 的注释:市场侧由 helpers 显式
 * `id = entry.name` 映射):这里**删掉那个从不产出的字段**,而不是给它编一个假 id。
 */
export interface Skill {
  name: string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  metadata?: Record<string, unknown> | null
  /**
   * 后端 `GET /api/skills` 的存储形态(`apps/api/src/routes/skills.ts` 的 `SkillRecord`)
   * **不产出**这个字段,全目录也没有任何读取点(仅本声明)。此前写成必填是视图模型的一桩
   * 虚构:它让 `fetchSkills` 无法直接返回 api-client 出口的类型,只能靠端内 `api<T>()` 泛型
   * 兜过去。改可选即与真实响应一致,且不改任何运行时值(原本就是 undefined)。
   */
  isPublic?: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface SkillForm {
  name: string
  description: string
  version: string
  tags: string
  metadata: string
}

export interface MarketSkill {
  /**
   * 市场条目唯一标识 —— 后端 `GET /skills/market` 的条目(SkillMarketEntry)**没有数据库
   * id**,install / unlist / ownership 一律以 `name` 为键,故视图模型的 id 即 name。
   */
  id: string
  name: string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  author?: string | null
  rating?: number | null
  installCount?: number | null
  createdAt: string
}

export interface MarketListResponse {
  /**
   * 2026-09-25 契约收口:后端 `SkillMarketListResponse`(packages/shared/src/skills/market.ts)
   * 写入的键是 `items`,此前本类型声明的 `list` 与后端不一致 ⇒ admin 市场列表恒空
   * (判据:apps/web/app/(main)/admin/skills/__tests__/market-list-items-contract.test.tsx)。
   * 此前视图模型里的 isInstalled / isOwner 已删:后端市场列表**不产出**这两个字段
   * (旧类型是从未生效的臆造形态);unlist 权限由服务端 requireAdmin 兜底,不靠前端字段。
   */
  items: MarketSkill[]
  total: number
  page: number
  pageSize: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
