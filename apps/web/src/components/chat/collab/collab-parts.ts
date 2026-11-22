// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 协作面板共享词表件(2026-10-23 另批收口,设计稿 docs/d125-session-collab-design.md §3/§6)。
 *
 * 档位 wire 值类型直接派生自 `@ihui/types/permission-mode` 注册表(`PERMISSION_MODE_WIRE_VALUES`),
 * 不抄第二份清单(§0.6);这里只登记 wire 值 → `collab` 命名空间文案键的唯一投影,
 * 收件箱与管理面板共用。未知值落 plan 档文案(缺省档,服务端 DEFAULT_TIER 同值)。
 */
import type { PERMISSION_MODE_WIRE_VALUES } from '@ihui/types'

export type CollabTierWire = (typeof PERMISSION_MODE_WIRE_VALUES)[number]

const COLLAB_TIER_LABEL_KEYS: Record<CollabTierWire, string> = {
  default: 'tierDefault',
  plan: 'tierPlan',
  'accept-edits': 'tierAcceptEdits',
  'bypass-permissions': 'tierBypassPermissions',
}

const COLLAB_STATUS_LABEL_KEYS: Record<'pending' | 'accepted' | 'revoked', string> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  revoked: 'statusRevoked',
}

export function collabTierLabelKey(tier: string): string {
  return (COLLAB_TIER_LABEL_KEYS as Record<string, string>)[tier] ?? 'tierPlan'
}

export function collabStatusLabelKey(status: string): string {
  return (COLLAB_STATUS_LABEL_KEYS as Record<string, string>)[status] ?? 'statusPending'
}
