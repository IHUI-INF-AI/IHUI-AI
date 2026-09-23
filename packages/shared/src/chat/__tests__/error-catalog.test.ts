// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 Turn 错误分类族 —— 覆盖率与零兜底用例(G-98)。
//
// 冻结清单 `PRODUCED_ERROR_CODES` = `node scripts/check-error-code-coverage.mjs --list`
// 在 2026-09-24 的实测输出(扫 packages/api-client/src + apps/ai-service/app,97 个)。
// 它是**覆盖率硬判据的输入**:逐条断言每个码都有标题、都有动作、都有分类。
// 清单若随后端新增而过时,由那支守门脚本(它扫的是活的源码)负责报警 ——
// 本用例守的是"已收录的码一个都不许没标题 / 不许落兜底"。

import { describe, expect, it } from 'vitest'

import {
  ERROR_CODE_CATALOG,
  TURN_ERROR_CLASSES,
  hasAllTurnErrorClasses,
  hasUnknownFallback,
  isKnownErrorCode,
  resolveErrorCatalog,
  type ErrorCategory,
} from '../error-catalog'

/** 我方实际产出的 errorCode 全集(守门脚本 --list 实测,97 个)。 */
const PRODUCED_ERROR_CODES = [
  'API_BRIDGE_ERROR',
  'BAD_PARAMS',
  'BUDGET_EXHAUSTED',
  'CAPTURE_FAILED',
  'CDP_DISABLED',
  'CDP_UNAVAILABLE',
  'CONCURRENCY_LIMIT_EXCEEDED',
  'CRON_NOT_SUPPORTED',
  'DANGEROUS_COMMAND',
  'DANGEROUS_COMMAND_BLOCKED',
  'DELEGATE_ERROR',
  'DELEGATE_NO_RESULT',
  'DELEGATE_TIMEOUT',
  'DEP_MISSING',
  'DOWNLOAD_FAILED',
  'DUAL_MODE',
  'EMPTY_AUDIO',
  'EMPTY_DIFF',
  'EMPTY_OLD_STRING',
  'EMPTY_RESULT',
  'EMPTY_TASKS',
  'ENCODING_ERROR',
  'ENGINE_ERROR',
  'ENGINE_UNAVAILABLE',
  'EXEC_POLICY_DENIED',
  'EXEC_POLICY_NEEDS_APPROVAL',
  'EXECUTION_EXCEPTION',
  'EXECUTION_FAILED',
  'EXECUTOR_DISABLED',
  'FALLBACK_FAILED',
  'FETCH_FAILED',
  'FILE_NOT_FOUND',
  'FILE_TOO_LARGE',
  'GENERATION_FAILED',
  'GITHUB_API_ERROR',
  'IMAGE_FETCH_FAILED',
  'IMAGE_TOO_LARGE',
  'INTERNAL_AUTH_UNAVAILABLE',
  'INTERNAL_ERROR',
  'INVALID_ARGS',
  'INVALID_ARGUMENT',
  'INVALID_CHART_TYPE',
  'INVALID_CONFIG',
  'INVALID_DATA',
  'INVALID_OUTPUT_DIR',
  'INVALID_PARAMS',
  'INVALID_PR',
  'INVALID_PROVIDER',
  'INVALID_REPO',
  'INVALID_TRIGGER',
  'IS_A_DIRECTORY',
  'LLM_ERROR',
  'LLM_FAILED',
  'MISSING_DATA',
  'MISSING_PARAMS',
  'MISSING_PATH_PARAM',
  'MISSING_SECRET',
  'MISSING_TITLE',
  'MODEL_NOT_CONFIGURED',
  'MULTIPLE_MATCHES',
  'NESTING_DEPTH_EXCEEDED',
  'NETWORK_APPROVAL_DENIED',
  'NETWORK_ERROR',
  'NO_FILE_VERSIONS',
  'NOT_A_DIRECTORY',
  'NOT_FOUND',
  'OLD_STRING_NOT_FOUND',
  'PATH_NOT_ALLOWED',
  'PATH_NOT_IN_WORKSPACE',
  'PERMISSION_DENIED',
  'PR_NOT_FOUND',
  'PROVIDER_ERROR',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_QUOTA_EXHAUSTED',
  'RATE_LIMITED',
  'RESOURCE_NOT_REGISTERED',
  'RISK_CONFIRM_REQUIRED',
  'SCHEME_REJECTED',
  'SCREENSHOT_FAILED',
  'SENSITIVE_FILE_BLOCKED',
  'SSRF_BLOCKED',
  'STEP_FAILED',
  'SUBAGENT_FAILED',
  'TASK_FAILED',
  'TEXT_TOO_LONG',
  'TIMEOUT',
  'TOO_LARGE',
  'TOOL_FAILED',
  'TOOL_NOT_FOUND',
  'TRIAL_QUOTA_EXCEEDED',
  'UNKNOWN_API_TOOL',
  'UNSUPPORTED_FORMAT',
  'UNSUPPORTED_IMAGE_FORMAT',
  'VERSION_NOT_FOUND',
  'VERSION_SELECTOR_REQUIRED',
  'VIDEO_FETCH_FAILED',
  'WRITE_FAILED',
]

/** D92 分类学的合法取值(本表不另立第二套)。 */
const VALID_CATEGORIES = [
  'resourceNotFound',
  'runtimeException',
  'entrypointNotRegistered',
  'entrypointInvalid',
  'dependencyModuleMissing',
  'resourceLimitExceeded',
  'environmentInitFailed',
  'disabled',
  'backendTimeout',
  'backendExited',
  'capabilityNotOffered',
  'backendCrashed',
  'protocolMismatch',
  'authForbidden',
  'invalidResponse',
]

describe('D71 错误分类族 / 覆盖率', () => {
  it('我方产出的 errorCode 逐条都有收录(零漏网)', () => {
    expect(PRODUCED_ERROR_CODES.length).toBeGreaterThan(50)
    for (const code of PRODUCED_ERROR_CODES) {
      expect(isKnownErrorCode(code), code).toBe(true)
    }
  })

  it('每个收录的码都有非空 titleKey / actionKey / category', () => {
    const entries = Object.entries(ERROR_CODE_CATALOG)
    expect(entries.length).toBeGreaterThanOrEqual(PRODUCED_ERROR_CODES.length)
    for (const [code, entry] of entries) {
      expect(entry.titleKey.trim().length, code).toBeGreaterThan(0)
      expect((entry.actionKey ?? '').trim().length, code).toBeGreaterThan(0)
      expect(VALID_CATEGORIES, `${code} → ${entry.category}`).toContain(entry.category)
    }
  })

  it('产出的码逐条都有标题键与动作键(不只是一个空壳条目)', () => {
    for (const code of PRODUCED_ERROR_CODES) {
      const entry = resolveErrorCatalog(code)
      expect(entry, code).not.toBeNull()
      expect(entry?.titleKey, code).toBe(`${code}.title`)
      expect(entry?.actionKey, code).toBe(`${code}.action`)
    }
  })
})

describe('D71 台账点名的八类', () => {
  it('八类常量齐全且顺序即台账顺序', () => {
    expect(TURN_ERROR_CLASSES).toEqual([
      'CONTEXT_TOO_LONG',
      'MEDIA_COUNT_EXCEEDED',
      'MODEL_REFUSED',
      'REQUEST_TIMEOUT',
      'INTERNAL_ERROR',
      'VERSION_TOO_LOW',
      'ACCOUNT_RESTRICTED',
      'TOKEN_EXPIRED',
    ])
  })

  it('八类全部登记在表内(hasAllTurnErrorClasses)', () => {
    expect(hasAllTurnErrorClasses()).toBe(true)
    for (const cls of TURN_ERROR_CLASSES) {
      expect(isKnownErrorCode(cls), cls).toBe(true)
      expect(resolveErrorCatalog(cls)?.titleKey, cls).toBe(`${cls}.title`)
    }
  })

  it('八类各有独立分类(不得全塞进同一类)', () => {
    const categories = TURN_ERROR_CLASSES.map((c) => resolveErrorCatalog(c)?.category as ErrorCategory)
    expect(new Set(categories).size).toBeGreaterThan(3)
  })
})

describe('D71 零「未知错误」兜底', () => {
  it('表内没有 unknown 分类 / UNKNOWN 条目', () => {
    expect(hasUnknownFallback()).toBe(false)
    expect(ERROR_CODE_CATALOG).not.toHaveProperty('UNKNOWN')
  })

  it('未收录的码返回 null —— 宁可不渲染,也不臆造「未知错误」', () => {
    expect(resolveErrorCatalog('NOT_A_REAL_CODE')).toBeNull()
    expect(resolveErrorCatalog('')).toBeNull()
    expect(resolveErrorCatalog(undefined)).toBeNull()
    expect(resolveErrorCatalog(null)).toBeNull()
    expect(isKnownErrorCode('NOT_A_REAL_CODE')).toBe(false)
  })

  it('产出的码里没有一个是"兜底语义"的(标题键不得含 unknown)', () => {
    for (const code of PRODUCED_ERROR_CODES) {
      const entry = resolveErrorCatalog(code)
      expect(entry?.category, code).not.toBe('unknown')
    }
  })

  it('UNKNOWN_API_TOOL 是真实业务码,不得被当成兜底误删', () => {
    expect(isKnownErrorCode('UNKNOWN_API_TOOL')).toBe(true)
    expect(resolveErrorCatalog('UNKNOWN_API_TOOL')?.category).toBe('resourceNotFound')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
