// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型可用性判据层(2026-11-17 立,对标 qoder2api-hub 的「未开通条目不过滤,附 disabled_message 原文」)。
 *
 * 对照的模型清单会把**当前拿不到的模型也列出来**,并在条目上挂一句原因 ——
 * 用户看到的是「Qwen3.8-Max(未开通)」,不是「这个模型凭空消失了」。
 *
 * 本仓 `/v1/models` 用 `enabled=true` 与 `is_relay_public=true` 过滤,拿不到的模型**静默消失**;
 * 缺的正是「消失的那条去哪了、为什么」。本层把这件事做成纯判据,由管理面端点交出清单。
 *
 * 三条纪律:
 * - **不冒充原因**。库内没写原因(enabled=false 且无 lastTestError/description)时如实标 `none`,
 *   不编「额度不足」这类从未被记录的说法。
 * - **优先级固定**:停用(disabled) > 测试失败(test_failed) > 未上架(not_public) > 可见(ok)。
 *   同一行可能同时命中多条,取最贴近用户观感的那条(停用最硬)。
 * - **可见性与 /v1/models 同源**:判据只说「这一行在公开清单里看不看得到、为什么」,
 *   不自己决定过滤 —— 过滤仍由 /v1/models 的 SQL 谓词负责(单一真相源)。
 */

export type ModelAvailabilityCategory = 'ok' | 'disabled' | 'test_failed' | 'not_public'

export type ModelReasonSource =
  | 'enabled_flag'
  | 'last_test_error'
  | 'last_test_status'
  | 'not_public_flag'
  | 'library_error'
  | 'none'

export interface ModelAvailabilityInput {
  /** 模型行自身开关(ai_model_config_models.enabled) */
  enabled?: boolean | null
  /** 是否在中转站公开上架(ai_model_config_models.is_relay_public) */
  isRelayPublic?: boolean | null
  /** 最近一次测试结论(PASS/FAIL/SKIP 等,库内原文) */
  lastTestStatus?: string | null
  /** 最近一次测试错误原文 */
  lastTestError?: string | null
}

export interface ModelAvailabilityExplain {
  /** 该行会不会出现在 /v1/models 的公开清单里 */
  visible: boolean
  category: ModelAvailabilityCategory
  /** 给用户看的一句话(库内原文优先,缺失时如实标注) */
  reason: string
  reason_source: ModelReasonSource
}

/** 判据(纯函数;零 IO、零 DB)。 */
export function explainModelAvailability(row: ModelAvailabilityInput): ModelAvailabilityExplain {
  const enabled = row.enabled !== false
  const isPublic = row.isRelayPublic === true
  const testStatus = (row.lastTestStatus ?? '').trim()
  const testError = (row.lastTestError ?? '').trim()
  const testFailed = testStatus.toUpperCase() === 'FAIL' || testStatus.toUpperCase() === 'ERROR'

  if (!enabled) {
    return {
      visible: false,
      category: 'disabled',
      reason: testError || '该模型在本平台已停用(库内未记录停用原因)',
      reason_source: testError ? 'last_test_error' : 'enabled_flag',
    }
  }

  if (testFailed) {
    return {
      visible: false,
      category: 'test_failed',
      reason: testError || `该模型最近一次连通性测试未通过(${testStatus || 'FAIL'})`,
      reason_source: testError ? 'last_test_error' : 'last_test_status',
    }
  }

  if (!isPublic) {
    return {
      visible: false,
      category: 'not_public',
      reason: '该模型可用但未在中转站上架(/v1/models 不返回它)',
      reason_source: 'not_public_flag',
    }
  }

  return {
    visible: true,
    category: 'ok',
    reason: '',
    reason_source: 'none',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
