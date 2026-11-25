// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ChannelItem } from '@/lib/openclaw-api'

/** 微信系渠道类型(与 Clawbot/OpenClaw 用户态渠道对齐)。 */
export const WECHAT_TYPES = new Set(['wechat', 'wechat_mp', 'wechat-work'])

/**
 * 合并「已登记渠道」与「可接入候选」,按渠道 type 去重、已登记优先。
 *
 * 历史 bug:按 id 合并时,ch-wechat(已登记)与 sup-wechat(候选)虽然都叫
 * "微信公众号"但 id 不同,页面就出现两个同名渠道。按 type 去重后同一
 * 类型只显示一条,并保留后端返回的真实 connected 状态。
 */
export function mergeWechatChannels(
  registered: ChannelItem[],
  supported: ChannelItem[],
): ChannelItem[] {
  const byType = new Map<string, ChannelItem>()
  // 候选先入:某个类型若尚未登记,仍要给用户一个可连接的入口
  for (const c of supported) {
    if (WECHAT_TYPES.has(c.type) && !byType.has(c.type)) {
      byType.set(c.type, { ...c, connected: false })
    }
  }
  // 已登记覆盖:同类型只留一条,且用真实的 connected 状态
  for (const c of registered) {
    if (WECHAT_TYPES.has(c.type)) byType.set(c.type, c)
  }
  return [...byType.values()]
}
