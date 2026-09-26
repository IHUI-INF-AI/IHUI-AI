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

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 词包 `ai.pane.errorCatalog` 子树(取不到即抛,不静默当成"没有这个码")。 */
const readErrorCatalog = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    ai?: { pane?: { errorCatalog?: Record<string, unknown> } }
  }
  const node = parsed.ai?.pane?.errorCatalog
  if (!node) throw new Error(`missing ai.pane.errorCatalog in ${locale}.json`)
  return node
}

/** 五份词包各 1 MB 级,按 locale 缓存(逐码逐字段重复 parse 会把一次 `vitest run` 拖成秒级)。 */
const CATALOG_CACHE = new Map<string, Record<string, unknown>>()
const errorCatalogOf = (locale: string): Record<string, unknown> => {
  const hit = CATALOG_CACHE.get(locale)
  if (hit) return hit
  const node = readErrorCatalog(locale)
  CATALOG_CACHE.set(locale, node)
  return node
}

/** 取某一码的某一字段,**取不到就抛** —— 不让"缺词"在断言里被读成"值为空串"。 */
const catalogField = (locale: string, code: string, field: 'title' | 'action'): string => {
  const node = errorCatalogOf(locale)[code]
  if (!node || typeof node !== 'object') throw new Error(`${locale} :: ${code} 不是对象`)
  const value = (node as Record<string, unknown>)[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${locale} :: ${code}.${field} 不是非空字符串`)
  }
  return value
}

/** 码位族判据:按**码位**量语种,不按字形肉眼判(谚文 을 与假名 を 会被看混)。 */
const HAN = /[\u4e00-\u9fff\u3400-\u4dbf]/
const KANA = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/

/** 2026-09-26 补录的两枚工具面错误码(产出场景见下方 describe 的注释)。 */
const RECENTLY_COVERED_CODES: ReadonlyArray<{ code: string; category: ErrorCategory }> = [
  { code: 'CHAT_MODE_TOOL_BLOCKED', category: 'authForbidden' },
  { code: 'TOOL_MODE_UNAVAILABLE', category: 'capabilityNotOffered' },
]

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
    const categories = TURN_ERROR_CLASSES.map(
      (c) => resolveErrorCatalog(c)?.category as ErrorCategory,
    )
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

// 2026-09-26 补录两枚**后端早已产出、目录迟迟没收录**的工具面错误码:
//   - CHAT_MODE_TOOL_BLOCKED —— llm.py:3122(V3 #53 ChatMode 硬收窄的第二道闸):
//     工具清单在 loop 入口已按模式过滤,模型仍会幻觉调用未下发的名字。ask 模式禁用全部工具,
//     plan / review 只放行只读白名单;被拦时不执行、不触碰 _mcp.call_tool,直接回灌失败结果。
//     → 属"策略不允许这么做",与 EXEC_POLICY_DENIED / DANGEROUS_COMMAND 同族,分 authForbidden。
//   - TOOL_MODE_UNAVAILABLE —— llm.py:3320(V3 #49 委托专有工具的可用性拦截):
//     apply_patch / create_file / delete_file / move_file 只在浏览器委托面(前端
//     workspace-tool-executor.ts)存在,请求不带 workspace_context(桌面端 / 本地工作区)时
//     这一面根本没提供该能力,故分 capabilityNotOffered(不是"没权限",也不是"找不到资源")。
// 这里守的不是"键在不在"(五语 parity 门已管),而是 AGENTS §19 那句"parity 绿不等于内容
// 语种对":逐门按**码位**验文案真是这门语言,且没有"同名自套一层"那种机械写法。
describe('D71 补录的两枚工具面错误码(llm.py V3 #53 / V3 #49)', () => {
  it('两枚码都在唯一真源里,分类与产出场景一致', () => {
    for (const { code, category } of RECENTLY_COVERED_CODES) {
      expect(isKnownErrorCode(code), code).toBe(true)
      expect(resolveErrorCatalog(code)?.category, code).toBe(category)
      expect(resolveErrorCatalog(code)?.titleKey, code).toBe(`${code}.title`)
      expect(resolveErrorCatalog(code)?.actionKey, code).toBe(`${code}.action`)
    }
  })

  it('五语言逐门取得到非空 title / action(零自套一层)', () => {
    for (const locale of LOCALES) {
      for (const { code } of RECENTLY_COVERED_CODES) {
        const node = errorCatalogOf(locale)[code]
        expect(node, `${locale} :: ${code} 缺整块`).toBeTruthy()
        const fieldNames = Object.keys(node as Record<string, unknown>).sort()
        expect(fieldNames, `${locale} :: ${code} 形状`).toEqual(['action', 'title'])
        for (const field of ['title', 'action'] as const) {
          expect(catalogField(locale, code, field).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('按码位量语种:ja 含假名 / ko 纯谚文 / en 无汉字 / 两支中文含汉字', () => {
    for (const { code } of RECENTLY_COVERED_CODES) {
      for (const field of ['title', 'action'] as const) {
        const tag = `${code}.${field}`
        expect(KANA.test(catalogField('ja', code, field)), `ja ${tag} 没有假名`).toBe(true)
        const koText = catalogField('ko', code, field)
        expect(HANGUL.test(koText), `ko ${tag} 没有谚文`).toBe(true)
        expect(HAN.test(koText), `ko ${tag} 混入汉字`).toBe(false)
        expect(HAN.test(catalogField('en', code, field)), `en ${tag} 混入汉字`).toBe(false)
        for (const zh of ['zh-CN', 'zh-TW'] as const) {
          expect(HAN.test(catalogField(zh, code, field)), `${zh} ${tag} 没有汉字`).toBe(true)
        }
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
