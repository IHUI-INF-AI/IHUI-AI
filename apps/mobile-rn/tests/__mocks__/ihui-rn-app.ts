// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/rn-app - vitest mock
// Replaces the real package which transitively imports @ihui/design-tokens (now aliased)
// and other packages with typeof type syntax.
import { createElement } from 'react'

export const plazaScreenPropsCaptured: Array<Record<string, unknown>> = []
export function PlazaScreen(props: Record<string, unknown>) {
  plazaScreenPropsCaptured.push(props)
  return createElement('div', { 'data-testid': 'shared-plaza-screen', ...props }, null)
}

export const agentScreenPropsCaptured: Array<Record<string, unknown>> = []
export function AgentScreen(props: Record<string, unknown>) {
  agentScreenPropsCaptured.push(props)
  return createElement('div', { 'data-testid': 'shared-agent-screen', ...props }, null)
}

export type PlazaScreenProps = {
  t: (key: string) => string
  colorScheme?: 'light' | 'dark'
  items: Array<Record<string, unknown>>
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  status: string
  search: string
  showSearch: boolean
  onRefresh: () => void
  onEndReached: () => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
  onSubmitSearch: () => void
  onPressItem: (item: Record<string, unknown>) => void
  onPublish: () => void
}

export type AgentScreenProps = {
  t: (key: string) => string
  items: Array<Record<string, unknown>>
  loading: boolean
  refreshing: boolean
  error: string | null
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export { SettingsScreen } from '../../../../packages/app/src/features/settings/SettingsScreen'
export { OrderScreen } from '../../../../packages/app/src/features/order/OrderScreen'
export { PaymentScreen } from '../../../../packages/app/src/features/payment/PaymentScreen'
export { WalletScreen } from '../../../../packages/app/src/features/wallet/WalletScreen'
export { WithdrawScreen } from '../../../../packages/app/src/features/withdraw/WithdrawScreen'
// D28 多端同步(2026-09-21):外部会话导入共享屏直连真实实现(与上方 Settings/Order 同款做法),
// 便于 wrapper 测试覆盖「注入的 picker/parse/commit」与共享 UI 的联动。
export { ConversationImportScreen } from '../../../../packages/app/src/features/conversation-import/ConversationImportScreen'

// WalletBalance / WalletScreenProps / WithdrawScreenProps re-exported for type compatibility
export type {
  WalletBalance,
  WalletScreenProps,
} from '../../../../packages/app/src/features/wallet/WalletScreen'
export type { WithdrawScreenProps } from '../../../../packages/app/src/features/withdraw/WithdrawScreen'

/**
 * 色板一律走真包,不得手抄。
 *
 * 此处原先手抄了 `tokens/lightTokens/darkTokens/getTokens` 的字面值,且抄的是
 * **2026-09-04 已被明确替换掉的蓝灰旧值**(`surface.bg` 浅 #FFFFFF→真 #F5F5F5、
 * 深 #1F2937→真 #242424,`card` #F3F4F6/#374151→真 #FFFFFF/#1A1A1A)。
 * 而同一文件里的 `SettingsScreen` 又是 re-export 真实组件 —— 真组件配假色板,
 * 结果就是 dark-mode 测试对一份不存在的色板断言全绿,色板改了几轮测试毫无反应。
 */
export {
  tokens,
  lightTokens,
  darkTokens,
  getTokens,
} from '../../../../packages/app/src/theme/tokens'

export { ModelPlazaScreen } from './model-plaza-mock'

/**
 * 统一分类栏:必须 re-export **真实组件**,不得在此另写一份假实现。
 * 本文件已有一次"真组件配假色板 ⇒ 测试对不存在的色板全绿"的事故记录(见上方注释),
 * 同类错误只要换个组件就会重犯。此前 CategoryDropdown 完全没从这里导出,
 * 结果是"点击开下拉窗"这一形态在全仓零覆盖 —— 一旦有屏用它,测试直接
 * "Element type is invalid"。
 */
export { CategoryInlineBar } from '../../../../packages/app/src/components/category/CategoryInlineBar'
export { CategoryDropdown } from '../../../../packages/app/src/components/category/CategoryDropdown'
export type {
  CategoryItem,
  CategoryInlineBarProps,
  CategoryDropdownProps,
} from '../../../../packages/app/src/components/category'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
