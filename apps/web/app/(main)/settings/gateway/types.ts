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
  // 模型自动同步(ModelSyncService)
  ModelSyncResult,
  ModelSyncStatus,
  // F4.4:同步历史时间轴
  ModelSyncHistoryRecord,
  // F4.13:同步健康度面板
  ModelSyncHealth,
  // v4:模型同步运维端点(2026-07-31 立,ModelSyncService 可视化运维)
  ResetProviderResult,
  SyncConfigUpdate,
  SyncConfigResult,
  SyncStatsResult,
  SyncStatsByProvider,
  CleanupResult,
} from '@ihui/api-client'

export type GatewayTab = 'providers' | 'combos' | 'compaction'

export const GATEWAY_TABS: GatewayTab[] = ['providers', 'combos', 'compaction']

export function isGatewayTab(v: string | null): v is GatewayTab {
  return v === 'providers' || v === 'combos' || v === 'compaction'
}
