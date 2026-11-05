// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { LiveListTab } from '@ihui/rn-app'

/**
 * 直播列表 tab → `/live/list` 查询串。
 *
 * 后端 `listChannelsQuery.status` 是 `z.coerce.number().int()`(启用位 0/1),不是阶段;
 * 传 `upcoming/ongoing/ended` 会 NaN ⇒ 400。阶段只能用语义键 `isLive` 表达。
 * 且 `/live/list` 恒带 `publishedOnly=true` ⇒ 未发布的 upcoming 不在该端点行集内,
 * 与本仓小程序同类页一致只保留三档(`pkg-learn/live/list.tsx` 同判据)。
 */
export const LIVE_LIST_TABS: LiveListTab[] = ['all', 'ongoing', 'ended']

/** 生成查询串;`all` 不筛,`ongoing=isLive:true`, `ended=isLive:false`。 */
export function buildLiveListQuery(tab: LiveListTab, page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (tab === 'ongoing') params.set('isLive', 'true')
  else if (tab === 'ended') params.set('isLive', 'false')
  return params.toString()
}
