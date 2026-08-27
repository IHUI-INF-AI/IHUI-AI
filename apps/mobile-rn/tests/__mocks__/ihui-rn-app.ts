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

// WalletBalance / WalletScreenProps / WithdrawScreenProps re-exported for type compatibility
export type {
  WalletBalance,
  WalletScreenProps,
} from '../../../../packages/app/src/features/wallet/WalletScreen'
export type { WithdrawScreenProps } from '../../../../packages/app/src/features/withdraw/WithdrawScreen'

export const tokens = {
  brand: { DEFAULT: '#000000' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', dark: '#1F2937', muted: '#F9FAFB', card: '#F3F4F6' },
} as const
export const lightTokens = {
  brand: { DEFAULT: '#000000', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', dark: '#1F2937', muted: '#F9FAFB', card: '#F3F4F6' },
} as const
export const darkTokens = {
  brand: { DEFAULT: '#FFFFFF', dark: '#34D399' },
  surface: { bg: '#1F2937', light: '#FFFFFF', dark: '#0F172A', muted: '#111827', card: '#374151' },
} as const
export function getTokens(theme: 'light' | 'dark') {
  return theme === 'dark' ? darkTokens : lightTokens
}

export { ModelPlazaScreen } from './model-plaza-mock'
