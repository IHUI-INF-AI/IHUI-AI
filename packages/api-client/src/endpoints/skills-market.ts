// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '../client'
import { buildQs } from '../utils'
import type { SkillEnabledList, SkillEnabledState } from '@ihui/types'

/**
 * Skill 市场「启停」(用户级启用/停用)API(2026-09 立,第三梯队 #14)。
 *
 * 对应后端 apps/api/src/routes/skills.ts:
 *  - GET  /api/skills/enabled          → 当前用户已启用 skill 名称列表
 *  - POST /api/skills/:name/enable      → 启用(加入用户启用集)
 *  - POST /api/skills/:name/disable     → 停用(移出用户启用集)
 *
 * install 是一次性入库动作,enable/disable 是运行态开关,二者正交。
 */

/** 当前用户已启用的 skill 名称列表(初始化页面 启停状态用) */
export function fetchEnabledSkills() {
  return fetchApi<SkillEnabledList>('/api/skills/enabled')
}

/** 启用一个 skill(写入用户启用集) */
export function enableSkill(name: string) {
  return fetchApi<SkillEnabledState>(`/api/skills/${encodeURIComponent(name)}/enable`, {
    method: 'POST',
  })
}

/** 停用一个 skill(移出用户启用集) */
export function disableSkill(name: string) {
  return fetchApi<SkillEnabledState>(`/api/skills/${encodeURIComponent(name)}/disable`, {
    method: 'POST',
  })
}

/**
 * listing 级上下架(P2-14 补齐,2026-09-25)。
 *
 * 与上面的 enable/disable 正交,别混:
 *  - enable/disable = **用户级运行态开关**(我装了的这个 skill 我要不要跑);
 *  - listing        = **条目级在架状态**(这条 skill 在不在商店货架上,owner 才能动)。
 * 对应后端 apps/api/src/routes/skills.ts:
 *  - POST /api/skills/:name/listing    → 上下架切换(服务端按 userId 校 owner)
 *  - GET  /api/skills/:name/ownership  → owner 判定 + 当前在架状态
 */
export interface SkillListingState {
  name: string
  enabled: boolean
}

/** owner 判定响应(ownerId 为空表示平台内置/内部同步条目,无人是 owner) */
export interface SkillOwnership {
  name: string
  isOwner: boolean
  ownerId: number | null
  enabled: boolean
  source: 'builtin' | 'user' | 'hub' | null
}

/** 切换某个市场条目的上下架(仅上架者本人可成功,否则后端 403) */
export function setSkillListing(name: string, enabled: boolean) {
  return fetchApi<SkillListingState>(`/api/skills/${encodeURIComponent(name)}/listing`, {
    method: 'POST',
    body: JSON.stringify({ enabled } satisfies { enabled: boolean }),
  })
}

/** 查询当前用户是否为该市场条目的上架者,以及条目当前在架状态 */
export function fetchSkillOwnership(name: string) {
  return fetchApi<SkillOwnership>(`/api/skills/${encodeURIComponent(name)}/ownership`)
}

/**
 * 市场条目「安装 / 下架」(2026-09-25 收口:admin 技能市场对话框由页面内 api() 直连改走本出口)。
 *
 * 对应后端 apps/api/src/routes/skills.ts:
 *  - POST /api/skills/:name/install → installCount++ 并写入当前用户私有库 Hash(登录用户即可)
 *  - POST /api/skills/:name/unlist  → 从市场目录**破坏性硬删**条目(requireAdmin,401/403 在 handler 之前落定)
 *
 * 与 setSkillListing 互斥、不是它的别名:unlist 连带抹掉 installCount/评分/订阅关系;
 * listing 只是"条目还在、在架/不在架翻转"。要可逆用 setSkillListing,本票只原样换通道。
 */
export interface SkillInstallResult {
  name: string
  installed: boolean
  installCount: number
}

export interface SkillUnlistResult {
  name: string
  unlisted: boolean
}

/** 安装一个市场条目到当前用户技能库 */
export function installSkill(name: string) {
  return fetchApi<SkillInstallResult>(`/api/skills/${encodeURIComponent(name)}/install`, {
    method: 'POST',
  })
}

/** 管理员:从市场目录硬删条目(不可逆,区别于 setSkillListing) */
export function unlistSkill(name: string) {
  return fetchApi<SkillUnlistResult>(`/api/skills/${encodeURIComponent(name)}/unlist`, {
    method: 'POST',
  })
}

/**
 * 市场目录**列表**(2026-09-25 收口:admin 技能页 helpers 的 `searchMarketSkills` 由页面内
 * `api()` 直连改走本出口)。
 *
 * 对应后端 apps/api/src/routes/skills.ts: `GET /api/skills/market`
 *  - 需登录(checkAuth),q/tag 为可选过滤,page/pageSize 必填分页(服务端 zod 校验)
 *  - 已下架条目(enabled === false)对非 owner 隐身 —— 过滤在服务端,调用方无需重复实现
 *
 * 为什么不能复用 `resource.ts` 的 `getSkills`:那是 `GET /api/skills`(**当前用户自己的**
 * 技能库,非市场目录),且解包形态是 `{ skills, total }` 之外的 `PageData`。两者是不同
 * 资源,不是同一资源的不同参数,故另立出口。
 *
 * ⚠️ 返回字段名按**现网消费方契约**(`list`)声明,与后端 handler 写入的 `items` 不一致 ——
 * 这是本票落地前既存的缺陷(admin 市场列表因此恒空),**迁移刻意零改动**:改字段名会连带
 * 改运行时行为,且修它要动 apps/api(不在本票范围)。留此说明,勿当已核实为正确照抄。
 */
export interface SkillMarketItem {
  id: string
  name: string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  author?: string | null
  rating?: number | null
  installCount?: number | null
  isInstalled: boolean
  isOwner: boolean
  createdAt: string
}

export interface SkillMarketListResult {
  list: SkillMarketItem[]
  total: number
  page: number
  pageSize: number
}

export interface SkillMarketQuery {
  q?: string
  tag?: string
  page?: number
  pageSize?: number
}

/** 分页查询市场目录(q/tag 空串按"不过滤"处理,buildQs 自动剔除) */
export function fetchMarketSkills(query: SkillMarketQuery = {}) {
  return fetchApi<SkillMarketListResult>(`/api/skills/market${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
