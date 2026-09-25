// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'
import { fetchMarketSkills } from '@ihui/api-client'
import type { Skill, SkillForm, MarketListResponse } from './types'

// 注意:本 helper 走 web 端 fetchApi 包装(apps/web/src/lib/api.ts),它在**非 GET** 收到 401
// 时会自动弹登录框;@ihui/api-client 的共享 fetchApi 没有这一步(无 onUnauthorized 钩子可注册),
// 且本文件两个调用方 page.tsx 的 saveMut/delMut 都没有 onError 分支 —— 弹窗是它们唯一的
// 401 反馈。故下面两处 mutation 型调用**刻意不收口**到 api-client 端点(AGENTS §3 的例外,
// 理由量化于票面),不得为"清直连数字"而迁移。GET 型的市场列表已迁,见 fetchMarketSkills。
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchSkills(): Promise<Skill[]> {
  const data = await api<{ skills: Skill[] }>('/api/skills')
  return data?.skills ?? []
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
