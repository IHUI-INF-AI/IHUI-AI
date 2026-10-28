// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createSkill, deleteSkill, getSkills, fetchMarketSkills } from '@ihui/api-client'
import type { Skill as ClientSkill } from '@ihui/api-client'
import type { Skill, SkillForm, MarketListResponse } from './types'

// 2026-09-25 收口:本目录此前"刻意留下"的三处直连(POST /api/skills、DELETE /api/skills/:id、
// GET /api/skills)已全部改走 @ihui/api-client 出口,用于绕开共享包的 web 包装层
// `api()`/`fetchApi` 因此删除(全目录唯一调用方就是本页,已随本次改写摘线)。
//
// 为什么现在能迁而不丢 401 反馈:共享包补了 `setUnauthorizedHandler`
// (packages/api-client/src/client.ts),`apps/web/src/lib/api.ts` 在模块加载时把
// **与包装层同一份** `requestLoginDialogForUnauthorized` 注册进去 —— 所以"非 GET 的 401
// 弹登录框"不再取决于调用方走不走 web 包装层,弹窗通路反而从"仅本包装层"变成全端共享。
// 下面三处的 `if (!r.success) throw new Error(r.error)` 逐字保留迁移前 `api()` 的失败语义
// (react-query 的 isError 与 SkillTable 的错误渲染分支不变)。

/** 建/改技能 —— 后端 POST /skills 是 upsert by name,响应为落库后的整条记录。 */
export async function postSkill(input: Partial<ClientSkill>): Promise<ClientSkill> {
  const r = await createSkill(input)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 删技能 —— 按 name 寻址;URL 编码已收口在 api-client 出口内,调用点不再重复。 */
export async function removeSkill(name: string): Promise<void> {
  const r = await deleteSkill(name)
  if (!r.success) throw new Error(r.error)
}

export async function fetchSkills(): Promise<Skill[]> {
  const r = await getSkills()
  if (!r.success) throw new Error(r.error)
  // 后端 GET /skills 的列表键是 `skills`(不是 PageData 的 `list`),解包对齐见
  // packages/api-client/src/endpoints/resource.ts 的 SkillListResponse。
  return r.data?.skills ?? []
}

export async function searchMarketSkills(
  q: string,
  tag: string,
  page: number,
  pageSize: number,
): Promise<MarketListResponse> {
  const r = await fetchMarketSkills({ q, tag, page, pageSize })
  if (!r.success) throw new Error(r.error)
  // 后端契约键是 `items`(packages/shared/src/skills/market.ts 的 SkillMarketListResponse);
  // 此前本函数把响应当 `list` 解包 ⇒ admin 市场列表恒空。id 以 name 为键:市场条目没有
  // 数据库 id,install/unlist/ownership 一律按 name 寻址(见 types.ts 注释)。
  const data = r.data
  return {
    items: (data.items ?? []).map((entry) => ({
      id: entry.name,
      name: entry.name,
      description: entry.description,
      version: entry.version,
      tags: entry.tags,
      author: entry.author,
      rating: entry.rating,
      installCount: entry.installCount,
      createdAt: entry.createdAt,
    })),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export const EMPTY_FORM: SkillForm = {
  name: '',
  description: '',
  version: '1.0.0',
  tags: '',
  metadata: '',
}

export function skillToForm(item: Skill): SkillForm {
  return {
    name: item.name,
    description: item.description ?? '',
    version: item.version ?? '1.0.0',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
