// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { TeamStats } from '@ihui/api-client'
import type { IconName } from '@/components/LineIcon'

/** 与共享屏 features/team/TeamScreen.tsx 的 TAB_KEYS / STATUS_LABELS 同键同序,端内不造第二份语义 */
export type TeamTab = 'all' | 'direct' | 'indirect'

export const TAB_KEYS: TeamTab[] = ['all', 'direct', 'indirect']
export const TAB_TEXT: Record<TeamTab, [string, string]> = {
  all: ['team.tab_all', '全部'],
  direct: ['team.tab_direct', '直推'],
  indirect: ['team.tab_indirect', '间推'],
}

/** 共享屏 STATUS_LABELS 有 active/inactive 两档,而本端 API 的类型收窄到 active:
 *  按 string 键存表 + 显式兜底,不为了类型去砍共享屏已有的档。 */
export const STATUS_FALLBACK: [string, string] = ['team.status_active', '活跃']
export const STATUS_TEXT: Record<string, [string, string]> = {
  active: STATUS_FALLBACK,
  inactive: ['team.status_inactive', '不活跃'],
}
export const statusLabel = (s: string): [string, string] => STATUS_TEXT[s] ?? STATUS_FALLBACK

/** 统计四格:次序与取值口径 = 共享屏 statsRow 的四枚 statItem */
export const STAT_CELLS: ReadonlyArray<{ key: string; fb: string; of: (s: TeamStats) => number }> =
  [
    { key: 'team.totalMembers', fb: '团队总人数', of: (s) => s.totalMembers },
    { key: 'team.activeMembers', fb: '活跃成员', of: (s) => s.activeMembers },
    { key: 'team.directCount', fb: '直推人数', of: (s) => s.directCount },
    { key: 'team.indirectCount', fb: '间推人数', of: (s) => s.indirectCount },
  ]

export type MenuEntry = { url: string; icon: IconName; k: string; fb: string }
/** 本端特有导航入口(共享屏无对应段;保留为不砍端内既有出口),取词前缀 distribution.company. */
export const MENU: ReadonlyArray<MenuEntry> = [
  { url: '/pages/distribution/team', icon: 'users', k: 'menuTeam', fb: '团队' },
  { url: '/pages/distribution/commission', icon: 'wallet', k: 'menuCommission', fb: '佣金' },
  { url: '/pages/distribution/withdraw', icon: 'wallet', k: 'menuWithdraw', fb: '提现' },
]

/** 共享屏档位 → 端内类名(rpx = 共享屏 px × 2;圆角只走标准档) */
export const CENTER = 'flex flex-col items-center justify-center py-[64rpx]'
export const TITLE = 'block text-[length:48rpx] font-bold text-foreground'
export const SUBTITLE = 'block text-[length:28rpx] text-muted-foreground mt-[16rpx]'
export const SOFT_TEXT = 'text-[length:28rpx] text-[var(--color-text-tertiary)]'
export const DANGER_TEXT = 'text-[length:28rpx] text-[var(--color-destructive)]'
export const STAT_VAL = 'text-[length:40rpx] font-bold text-[var(--color-success)]'
export const STAT_LABEL =
  'text-[length:20rpx] text-[var(--color-success-deep-text)] mt-[16rpx] text-center'
export const CONTRIB_LABEL = 'text-[length:22rpx] text-muted-foreground'
export const MEMBER_NAME = 'flex-1 text-[length:32rpx] font-semibold text-foreground truncate'
export const MEMBER_META =
  'block text-[length:22rpx] text-[var(--color-text-tertiary)] mt-[16rpx] truncate'
export const AVATAR_IMG = 'w-[88rpx] h-[88rpx] rounded-2xl flex-shrink-0'
export const AVATAR_BOX = `${AVATAR_IMG} bg-[var(--color-muted)] items-center justify-center`
export const BADGE = 'px-[12rpx] py-[2rpx] rounded-md text-[length:20rpx] text-muted-foreground'
export const badgeCls = (on: boolean): string =>
  `${BADGE} ${on ? 'bg-[var(--color-success-light)]' : 'bg-card'}`

/** 与共享屏 initials() 同判据:空名回 '?' */
export const initials = (name: string): string => (name ? name.slice(0, 1).toUpperCase() : '?')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
