/**
 * AI 网关 Dashboard — 共享类型(re-export from @ihui/api-client,AGENTS.md §3 共享层优先)
 */
export type {
  ProviderStatus,
  ProviderCategory,
  GatewayProvider,
  ProvidersHealthResult,
  ComboStrategy,
  ComboChain,
  ComboListResult,
  ComboCreateInput,
  ComboCreateResult,
  ComboDeleteResult,
  CompactionStrategy,
  CompactionDemoInput,
  CompactionDemoResult,
} from '@ihui/api-client'

export type GatewayTab = 'providers' | 'combos' | 'compaction'

export const GATEWAY_TABS: GatewayTab[] = ['providers', 'combos', 'compaction']

export function isGatewayTab(v: string | null): v is GatewayTab {
  return v === 'providers' || v === 'combos' || v === 'compaction'
}
