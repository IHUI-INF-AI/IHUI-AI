// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台 API 目录覆盖(catalog/probe/plan)的 UI 侧类型与映射。
 * 数据契约单一真相源在 `@ihui/api-client/endpoints/connectors`,此处只做原文转发 +
 * 纯展示层映射(徽章文案/变体、探测结果就地回填优先级),不得另立第二套字段定义。
 */
export type {
  CoverageApi,
  CoverageApiStatus,
  CoverageCatalog,
  CoverageDomain,
  CoveragePlatform,
  CoverageProbeItem,
  CoverageState,
  CoverageStateCounts,
  CoverageTotals,
  CoverageUnenumeratedDomain,
} from '@ihui/api-client/endpoints/connectors'

import type {
  CoverageApi,
  CoverageApiStatus,
  CoveragePlatform,
  CoverageProbeItem,
  CoverageState,
} from '@ihui/api-client/endpoints/connectors'

/** 面板平台切换档位;顺序即按钮顺序 */
export const COVERAGE_PLATFORMS: ReadonlyArray<{ value: CoveragePlatform; label: string }> = [
  { value: 'feishu', label: '飞书' },
  { value: 'dingtalk', label: '钉钉' },
  { value: 'wecom', label: '企业微信' },
]

/** 与 `@/components/data` 的 Badge 变体档一一对齐(不自立颜色档) */
export type CoverageBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'

/**
 * 八态文案与徽章变体:与后端冻结契约 `CoverageState` 逐字对齐,不得增删。
 * 形状被测试逐键钉住(`toEqual({ label, badge })`),多一个键即红。
 */
export const COVERAGE_STATE_META: Record<CoverageState, { label: string; badge: CoverageBadgeVariant }> = {
  available: { label: '可用', badge: 'success' },
  permission_denied: { label: '权限不足', badge: 'danger' },
  need_user_token: { label: '需用户授权', badge: 'warning' },
  need_admin: { label: '需管理员', badge: 'warning' },
  unsupported: { label: '不支持', badge: 'default' },
  error: { label: '探测错误', badge: 'danger' },
  unprobed: { label: '未探测', badge: 'default' },
  unjudged: { label: '未判定', badge: 'default' },
}

/** API 级状态:排除目录级的 `unjudged`(那是 catalog_state,不进单条 API 的计数桶)。
 *  `CoverageStateCounts` 只带这七键 ⇒ 用它索引 counts 不会撞 TS7053。 */
export type CoverageApiState = Exclude<CoverageState, 'unjudged'>

/** 统计条展示顺序:可用在前、未探测在末,中间按处置紧迫度排 */
export const COVERAGE_STATE_ORDER: readonly CoverageApiState[] = [
  'available',
  'permission_denied',
  'need_user_token',
  'need_admin',
  'unsupported',
  'error',
  'unprobed',
]

/**
 * 单条 API 的有效状态:探测回填(override)优先于目录自带状态。
 * 探测结果不带 `probed_at` 契约位,回填时沿用目录侧的探测时刻,不伪造时间。
 */
export function resolveApiStatus(
  api: CoverageApi,
  override: CoverageProbeItem | null,
): CoverageApiStatus {
  if (!override) return api.status
  return {
    state: override.state,
    http_code: override.http_code,
    platform_code: override.platform_code,
    reason: override.reason,
    missing_scope: override.missing_scope,
    probed_at: api.status.probed_at,
  }
}
