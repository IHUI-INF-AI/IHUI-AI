// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台目录覆盖(coverage)前端类型与展示映射单一来源。
 *
 * 类型逐字对齐后端冻结契约(GET /api/connectors/coverage 等),
 * 状态枚举只允许后端那八态,前端不得自造分桶。
 */
import type {
  CoverageApi,
  CoverageApiStatus,
  CoverageCatalog,
  CoverageDomain,
  CoverageEventsView,
  CoveragePlanConnector,
  CoveragePlanResponse,
  CoveragePlatform,
  CoverageProbeItem,
  CoverageProbeResponse,
  CoverageState,
  CoverageStateCounts,
  CoverageTotals,
  CoverageUnenumeratedDomain,
} from '@ihui/api-client/endpoints/connectors'

export type {
  CoverageApi,
  CoverageApiStatus,
  CoverageCatalog,
  CoverageDomain,
  CoverageEventsView,
  CoveragePlanConnector,
  CoveragePlanResponse,
  CoveragePlatform,
  CoverageProbeItem,
  CoverageProbeResponse,
  CoverageState,
  CoverageStateCounts,
  CoverageTotals,
  CoverageUnenumeratedDomain,
}

/** 与 @/components/data Badge 既有变体兼容的档位(不引入新色档) */
export type CoverageBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'

/** 平台切换选项 */
export const COVERAGE_PLATFORMS: { value: CoveragePlatform; label: string }[] = [
  { value: 'feishu', label: '飞书' },
  { value: 'dingtalk', label: '钉钉' },
  { value: 'wecom', label: '企业微信' },
]

interface StateMeta {
  label: string
  badge: CoverageBadgeVariant
}

/** 探测状态 -> 中文文案 + 既有 Badge 变体(色值只取 design token,不另起调色板) */
export const COVERAGE_STATE_META: Record<CoverageState, StateMeta> = {
  available: { label: '可用', badge: 'success' },
  permission_denied: { label: '权限不足', badge: 'danger' },
  need_user_token: { label: '需用户授权', badge: 'warning' },
  need_admin: { label: '需管理员', badge: 'warning' },
  unsupported: { label: '不支持', badge: 'default' },
  error: { label: '探测错误', badge: 'danger' },
  unprobed: { label: '未探测', badge: 'default' },
  unjudged: { label: '未判定', badge: 'default' },
}

/** 视为失败 / 需要展示原始错误码的状态 */
export const FAILURE_STATES: ReadonlySet<CoverageState> = new Set([
  'permission_denied',
  'need_user_token',
  'need_admin',
  'unsupported',
  'error',
])

/** 取某条 API 当前展示状态:探测回填覆盖优先,其次目录自带状态 */
export function resolveApiStatus(
  api: CoverageApi,
  override: CoverageProbeItem | null | undefined,
): CoverageApiStatus {
  if (!override) return api.status
  return {
    state: override.state,
    http_code: override.http_code,
    platform_code: override.platform_code,
    reason: override.reason,
    missing_scope: override.missing_scope,
    probed_at: null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
