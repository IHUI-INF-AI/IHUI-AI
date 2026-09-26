// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 Turn 错误分类族(G-98,2026-09-24 立)
//
// **自证结论(改本表前先读)**:attachErrorMeta(packages/api-client/src/client.ts:1117)
// 只做一件事 —— 把 SSE error 帧的 errorCode 原样挂到 Error 上;真正给用户看标题的是
// formatSSEError(同文件),而它**只按 HTTP 码分支**(401/403/429/5xx/4xx/abort/network),
// errorCode 从头到尾没参与判据 —— 于是后端产出的 96 个业务码在 web 侧全部退化成
// 「AI 服务异常」一类兜底,worst case 直接落 severity 'unknown' + 裸 rawMessage。
// 本表补的正是这一层:**errorCode → 中文标题 + 建议动作**,落点与 attachErrorMeta
// 的字段名(errorCode)完全对齐,与 web 错误卡(mcp-view-failure.tsx 的
// 「分类标题 + 错误码 + 建议动作」三行结构)同形。
//
// **零「未知错误」兜底**:表内没有 UNKNOWN 条目、没有 fallback 常量。判据靠
// scripts/check-error-code-coverage.mjs 机械守住 —— 我方产出的 errorCode 只要有一个
// 没进这张表,那支脚本 exit 1。未收录的码一律返回 null(宁可不渲染标题,也不臆造
// 「未知错误」四个字 —— 误报比不报更贵)。
//
// 分类沿用 D92 view-failure-taxonomy 的 ViewFailureKind(**不另立第二套分类学**);
// 本表只增补"业务错误码 → 该分类"的映射,与 MCP/插件视图失败卡共用同一套分类语义。

import type { ViewFailureKind } from '../utils/view-failure-taxonomy'

/** 分类沿用 D92 既有分类学(15 类),**不另立第二套**。 */
export type ErrorCategory = ViewFailureKind

export interface ErrorCatalogEntry {
  /** `ai.pane.errorCatalog` 内的标题键(相对路径,供 `t()` 直接用) */
  readonly titleKey: string
  /** `ai.pane.errorCatalog` 内的建议动作键;缺省表示该码没有可行动作 */
  readonly actionKey?: string
  readonly category: ErrorCategory
}

/** 词包命名空间(web 侧 `useTranslations('ai.pane.errorCatalog')`) */
export const ERROR_CATALOG_NAMESPACE = 'ai.pane.errorCatalog' as const

/**
 * 台账 D71 明文点名的八类(对标原文逐字落在 zh-CN 词包里,测试逐字断言)。
 * 其中 TIMEOUT / INTERNAL_ERROR 我方已在产出,其余六类是我方**尚未产出**的码:
 * 先在本表登记(契约先行),等后端真正产出时词包与判据都已就位。
 */
export const TURN_ERROR_CLASSES = [
  'CONTEXT_TOO_LONG',
  'MEDIA_COUNT_EXCEEDED',
  'MODEL_REFUSED',
  'REQUEST_TIMEOUT',
  'INTERNAL_ERROR',
  'VERSION_TOO_LOW',
  'ACCOUNT_RESTRICTED',
  'TOKEN_EXPIRED',
] as const
export type TurnErrorClass = (typeof TURN_ERROR_CLASSES)[number]

/**
 * errorCode → { titleKey, actionKey, category }。
 *
 * 键即后端产出的原始错误码(不改名、不归一 —— 归一会让排障时 grep 不到)。
 * 解析脚本按行读取,故每条保持单行三字段形状,新增码直接照抄一行。
 */
export const ERROR_CODE_CATALOG: Readonly<Record<string, ErrorCatalogEntry>> = Object.freeze({
  ACCOUNT_RESTRICTED: {
    titleKey: 'ACCOUNT_RESTRICTED.title',
    actionKey: 'ACCOUNT_RESTRICTED.action',
    category: 'authForbidden',
  },
  API_BRIDGE_ERROR: {
    titleKey: 'API_BRIDGE_ERROR.title',
    actionKey: 'API_BRIDGE_ERROR.action',
    category: 'backendExited',
  },
  BAD_PARAMS: {
    titleKey: 'BAD_PARAMS.title',
    actionKey: 'BAD_PARAMS.action',
    category: 'invalidResponse',
  },
  BUDGET_EXHAUSTED: {
    titleKey: 'BUDGET_EXHAUSTED.title',
    actionKey: 'BUDGET_EXHAUSTED.action',
    category: 'resourceLimitExceeded',
  },
  CAPTURE_FAILED: {
    titleKey: 'CAPTURE_FAILED.title',
    actionKey: 'CAPTURE_FAILED.action',
    category: 'runtimeException',
  },
  CDP_DISABLED: {
    titleKey: 'CDP_DISABLED.title',
    actionKey: 'CDP_DISABLED.action',
    category: 'environmentInitFailed',
  },
  CDP_UNAVAILABLE: {
    titleKey: 'CDP_UNAVAILABLE.title',
    actionKey: 'CDP_UNAVAILABLE.action',
    category: 'environmentInitFailed',
  },
  CHAT_MODE_TOOL_BLOCKED: {
    titleKey: 'CHAT_MODE_TOOL_BLOCKED.title',
    actionKey: 'CHAT_MODE_TOOL_BLOCKED.action',
    category: 'authForbidden',
  },
  CONCURRENCY_LIMIT_EXCEEDED: {
    titleKey: 'CONCURRENCY_LIMIT_EXCEEDED.title',
    actionKey: 'CONCURRENCY_LIMIT_EXCEEDED.action',
    category: 'resourceLimitExceeded',
  },
  CONTEXT_TOO_LONG: {
    titleKey: 'CONTEXT_TOO_LONG.title',
    actionKey: 'CONTEXT_TOO_LONG.action',
    category: 'resourceLimitExceeded',
  },
  CRON_NOT_SUPPORTED: {
    titleKey: 'CRON_NOT_SUPPORTED.title',
    actionKey: 'CRON_NOT_SUPPORTED.action',
    category: 'invalidResponse',
  },
  DANGEROUS_COMMAND: {
    titleKey: 'DANGEROUS_COMMAND.title',
    actionKey: 'DANGEROUS_COMMAND.action',
    category: 'authForbidden',
  },
  DANGEROUS_COMMAND_BLOCKED: {
    titleKey: 'DANGEROUS_COMMAND_BLOCKED.title',
    actionKey: 'DANGEROUS_COMMAND_BLOCKED.action',
    category: 'authForbidden',
  },
  DELEGATE_ERROR: {
    titleKey: 'DELEGATE_ERROR.title',
    actionKey: 'DELEGATE_ERROR.action',
    category: 'runtimeException',
  },
  DELEGATE_NO_RESULT: {
    titleKey: 'DELEGATE_NO_RESULT.title',
    actionKey: 'DELEGATE_NO_RESULT.action',
    category: 'runtimeException',
  },
  DELEGATE_TIMEOUT: {
    titleKey: 'DELEGATE_TIMEOUT.title',
    actionKey: 'DELEGATE_TIMEOUT.action',
    category: 'backendTimeout',
  },
  DEP_MISSING: {
    titleKey: 'DEP_MISSING.title',
    actionKey: 'DEP_MISSING.action',
    category: 'dependencyModuleMissing',
  },
  DOWNLOAD_FAILED: {
    titleKey: 'DOWNLOAD_FAILED.title',
    actionKey: 'DOWNLOAD_FAILED.action',
    category: 'backendExited',
  },
  DUAL_MODE: {
    titleKey: 'DUAL_MODE.title',
    actionKey: 'DUAL_MODE.action',
    category: 'invalidResponse',
  },
  EMPTY_AUDIO: {
    titleKey: 'EMPTY_AUDIO.title',
    actionKey: 'EMPTY_AUDIO.action',
    category: 'invalidResponse',
  },
  EMPTY_DIFF: {
    titleKey: 'EMPTY_DIFF.title',
    actionKey: 'EMPTY_DIFF.action',
    category: 'invalidResponse',
  },
  EMPTY_OLD_STRING: {
    titleKey: 'EMPTY_OLD_STRING.title',
    actionKey: 'EMPTY_OLD_STRING.action',
    category: 'invalidResponse',
  },
  EMPTY_RESULT: {
    titleKey: 'EMPTY_RESULT.title',
    actionKey: 'EMPTY_RESULT.action',
    category: 'invalidResponse',
  },
  EMPTY_TASKS: {
    titleKey: 'EMPTY_TASKS.title',
    actionKey: 'EMPTY_TASKS.action',
    category: 'invalidResponse',
  },
  ENCODING_ERROR: {
    titleKey: 'ENCODING_ERROR.title',
    actionKey: 'ENCODING_ERROR.action',
    category: 'runtimeException',
  },
  ENGINE_ERROR: {
    titleKey: 'ENGINE_ERROR.title',
    actionKey: 'ENGINE_ERROR.action',
    category: 'runtimeException',
  },
  ENGINE_UNAVAILABLE: {
    titleKey: 'ENGINE_UNAVAILABLE.title',
    actionKey: 'ENGINE_UNAVAILABLE.action',
    category: 'runtimeException',
  },
  EXECUTION_EXCEPTION: {
    titleKey: 'EXECUTION_EXCEPTION.title',
    actionKey: 'EXECUTION_EXCEPTION.action',
    category: 'runtimeException',
  },
  EXECUTION_FAILED: {
    titleKey: 'EXECUTION_FAILED.title',
    actionKey: 'EXECUTION_FAILED.action',
    category: 'runtimeException',
  },
  EXECUTOR_DISABLED: {
    titleKey: 'EXECUTOR_DISABLED.title',
    actionKey: 'EXECUTOR_DISABLED.action',
    category: 'disabled',
  },
  EXEC_POLICY_DENIED: {
    titleKey: 'EXEC_POLICY_DENIED.title',
    actionKey: 'EXEC_POLICY_DENIED.action',
    category: 'authForbidden',
  },
  EXEC_POLICY_NEEDS_APPROVAL: {
    titleKey: 'EXEC_POLICY_NEEDS_APPROVAL.title',
    actionKey: 'EXEC_POLICY_NEEDS_APPROVAL.action',
    category: 'authForbidden',
  },
  FALLBACK_FAILED: {
    titleKey: 'FALLBACK_FAILED.title',
    actionKey: 'FALLBACK_FAILED.action',
    category: 'runtimeException',
  },
  FETCH_FAILED: {
    titleKey: 'FETCH_FAILED.title',
    actionKey: 'FETCH_FAILED.action',
    category: 'backendExited',
  },
  FILE_NOT_FOUND: {
    titleKey: 'FILE_NOT_FOUND.title',
    actionKey: 'FILE_NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  FILE_TOO_LARGE: {
    titleKey: 'FILE_TOO_LARGE.title',
    actionKey: 'FILE_TOO_LARGE.action',
    category: 'resourceLimitExceeded',
  },
  GENERATION_FAILED: {
    titleKey: 'GENERATION_FAILED.title',
    actionKey: 'GENERATION_FAILED.action',
    category: 'runtimeException',
  },
  GITHUB_API_ERROR: {
    titleKey: 'GITHUB_API_ERROR.title',
    actionKey: 'GITHUB_API_ERROR.action',
    category: 'backendExited',
  },
  IMAGE_FETCH_FAILED: {
    titleKey: 'IMAGE_FETCH_FAILED.title',
    actionKey: 'IMAGE_FETCH_FAILED.action',
    category: 'backendExited',
  },
  IMAGE_TOO_LARGE: {
    titleKey: 'IMAGE_TOO_LARGE.title',
    actionKey: 'IMAGE_TOO_LARGE.action',
    category: 'resourceLimitExceeded',
  },
  INTERNAL_AUTH_UNAVAILABLE: {
    titleKey: 'INTERNAL_AUTH_UNAVAILABLE.title',
    actionKey: 'INTERNAL_AUTH_UNAVAILABLE.action',
    category: 'authForbidden',
  },
  INTERNAL_ERROR: {
    titleKey: 'INTERNAL_ERROR.title',
    actionKey: 'INTERNAL_ERROR.action',
    category: 'runtimeException',
  },
  INVALID_ARGS: {
    titleKey: 'INVALID_ARGS.title',
    actionKey: 'INVALID_ARGS.action',
    category: 'invalidResponse',
  },
  INVALID_ARGUMENT: {
    titleKey: 'INVALID_ARGUMENT.title',
    actionKey: 'INVALID_ARGUMENT.action',
    category: 'invalidResponse',
  },
  INVALID_CHART_TYPE: {
    titleKey: 'INVALID_CHART_TYPE.title',
    actionKey: 'INVALID_CHART_TYPE.action',
    category: 'invalidResponse',
  },
  INVALID_CONFIG: {
    titleKey: 'INVALID_CONFIG.title',
    actionKey: 'INVALID_CONFIG.action',
    category: 'invalidResponse',
  },
  INVALID_DATA: {
    titleKey: 'INVALID_DATA.title',
    actionKey: 'INVALID_DATA.action',
    category: 'invalidResponse',
  },
  INVALID_OUTPUT_DIR: {
    titleKey: 'INVALID_OUTPUT_DIR.title',
    actionKey: 'INVALID_OUTPUT_DIR.action',
    category: 'invalidResponse',
  },
  INVALID_PARAMS: {
    titleKey: 'INVALID_PARAMS.title',
    actionKey: 'INVALID_PARAMS.action',
    category: 'invalidResponse',
  },
  INVALID_PR: {
    titleKey: 'INVALID_PR.title',
    actionKey: 'INVALID_PR.action',
    category: 'invalidResponse',
  },
  INVALID_PROVIDER: {
    titleKey: 'INVALID_PROVIDER.title',
    actionKey: 'INVALID_PROVIDER.action',
    category: 'runtimeException',
  },
  INVALID_REPO: {
    titleKey: 'INVALID_REPO.title',
    actionKey: 'INVALID_REPO.action',
    category: 'invalidResponse',
  },
  INVALID_TRIGGER: {
    titleKey: 'INVALID_TRIGGER.title',
    actionKey: 'INVALID_TRIGGER.action',
    category: 'invalidResponse',
  },
  IS_A_DIRECTORY: {
    titleKey: 'IS_A_DIRECTORY.title',
    actionKey: 'IS_A_DIRECTORY.action',
    category: 'invalidResponse',
  },
  LLM_ERROR: {
    titleKey: 'LLM_ERROR.title',
    actionKey: 'LLM_ERROR.action',
    category: 'runtimeException',
  },
  LLM_FAILED: {
    titleKey: 'LLM_FAILED.title',
    actionKey: 'LLM_FAILED.action',
    category: 'runtimeException',
  },
  MEDIA_COUNT_EXCEEDED: {
    titleKey: 'MEDIA_COUNT_EXCEEDED.title',
    actionKey: 'MEDIA_COUNT_EXCEEDED.action',
    category: 'resourceLimitExceeded',
  },
  MISSING_DATA: {
    titleKey: 'MISSING_DATA.title',
    actionKey: 'MISSING_DATA.action',
    category: 'invalidResponse',
  },
  MISSING_PARAMS: {
    titleKey: 'MISSING_PARAMS.title',
    actionKey: 'MISSING_PARAMS.action',
    category: 'invalidResponse',
  },
  MISSING_PATH_PARAM: {
    titleKey: 'MISSING_PATH_PARAM.title',
    actionKey: 'MISSING_PATH_PARAM.action',
    category: 'invalidResponse',
  },
  MISSING_SECRET: {
    titleKey: 'MISSING_SECRET.title',
    actionKey: 'MISSING_SECRET.action',
    category: 'environmentInitFailed',
  },
  MISSING_TITLE: {
    titleKey: 'MISSING_TITLE.title',
    actionKey: 'MISSING_TITLE.action',
    category: 'invalidResponse',
  },
  MODEL_NOT_CONFIGURED: {
    titleKey: 'MODEL_NOT_CONFIGURED.title',
    actionKey: 'MODEL_NOT_CONFIGURED.action',
    category: 'environmentInitFailed',
  },
  MODEL_REFUSED: {
    titleKey: 'MODEL_REFUSED.title',
    actionKey: 'MODEL_REFUSED.action',
    category: 'runtimeException',
  },
  MULTIPLE_MATCHES: {
    titleKey: 'MULTIPLE_MATCHES.title',
    actionKey: 'MULTIPLE_MATCHES.action',
    category: 'invalidResponse',
  },
  NESTING_DEPTH_EXCEEDED: {
    titleKey: 'NESTING_DEPTH_EXCEEDED.title',
    actionKey: 'NESTING_DEPTH_EXCEEDED.action',
    category: 'resourceLimitExceeded',
  },
  NETWORK_APPROVAL_DENIED: {
    titleKey: 'NETWORK_APPROVAL_DENIED.title',
    actionKey: 'NETWORK_APPROVAL_DENIED.action',
    category: 'authForbidden',
  },
  NETWORK_ERROR: {
    titleKey: 'NETWORK_ERROR.title',
    actionKey: 'NETWORK_ERROR.action',
    category: 'backendExited',
  },
  NOT_A_DIRECTORY: {
    titleKey: 'NOT_A_DIRECTORY.title',
    actionKey: 'NOT_A_DIRECTORY.action',
    category: 'invalidResponse',
  },
  NOT_FOUND: {
    titleKey: 'NOT_FOUND.title',
    actionKey: 'NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  NO_FILE_VERSIONS: {
    titleKey: 'NO_FILE_VERSIONS.title',
    actionKey: 'NO_FILE_VERSIONS.action',
    category: 'resourceNotFound',
  },
  OLD_STRING_NOT_FOUND: {
    titleKey: 'OLD_STRING_NOT_FOUND.title',
    actionKey: 'OLD_STRING_NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  PATH_NOT_ALLOWED: {
    titleKey: 'PATH_NOT_ALLOWED.title',
    actionKey: 'PATH_NOT_ALLOWED.action',
    category: 'entrypointInvalid',
  },
  PATH_NOT_IN_WORKSPACE: {
    titleKey: 'PATH_NOT_IN_WORKSPACE.title',
    actionKey: 'PATH_NOT_IN_WORKSPACE.action',
    category: 'entrypointInvalid',
  },
  PERMISSION_DENIED: {
    titleKey: 'PERMISSION_DENIED.title',
    actionKey: 'PERMISSION_DENIED.action',
    category: 'authForbidden',
  },
  PROVIDER_ERROR: {
    titleKey: 'PROVIDER_ERROR.title',
    actionKey: 'PROVIDER_ERROR.action',
    category: 'runtimeException',
  },
  PROVIDER_NOT_CONFIGURED: {
    titleKey: 'PROVIDER_NOT_CONFIGURED.title',
    actionKey: 'PROVIDER_NOT_CONFIGURED.action',
    category: 'environmentInitFailed',
  },
  PROVIDER_QUOTA_EXHAUSTED: {
    titleKey: 'PROVIDER_QUOTA_EXHAUSTED.title',
    actionKey: 'PROVIDER_QUOTA_EXHAUSTED.action',
    category: 'resourceLimitExceeded',
  },
  PR_NOT_FOUND: {
    titleKey: 'PR_NOT_FOUND.title',
    actionKey: 'PR_NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  RATE_LIMITED: {
    titleKey: 'RATE_LIMITED.title',
    actionKey: 'RATE_LIMITED.action',
    category: 'resourceLimitExceeded',
  },
  REQUEST_TIMEOUT: {
    titleKey: 'REQUEST_TIMEOUT.title',
    actionKey: 'REQUEST_TIMEOUT.action',
    category: 'backendTimeout',
  },
  RESOURCE_NOT_REGISTERED: {
    titleKey: 'RESOURCE_NOT_REGISTERED.title',
    actionKey: 'RESOURCE_NOT_REGISTERED.action',
    category: 'resourceNotFound',
  },
  RISK_CONFIRM_REQUIRED: {
    titleKey: 'RISK_CONFIRM_REQUIRED.title',
    actionKey: 'RISK_CONFIRM_REQUIRED.action',
    category: 'authForbidden',
  },
  SCHEME_REJECTED: {
    titleKey: 'SCHEME_REJECTED.title',
    actionKey: 'SCHEME_REJECTED.action',
    category: 'entrypointInvalid',
  },
  SCREENSHOT_FAILED: {
    titleKey: 'SCREENSHOT_FAILED.title',
    actionKey: 'SCREENSHOT_FAILED.action',
    category: 'runtimeException',
  },
  SENSITIVE_FILE_BLOCKED: {
    titleKey: 'SENSITIVE_FILE_BLOCKED.title',
    actionKey: 'SENSITIVE_FILE_BLOCKED.action',
    category: 'authForbidden',
  },
  SSRF_BLOCKED: {
    titleKey: 'SSRF_BLOCKED.title',
    actionKey: 'SSRF_BLOCKED.action',
    category: 'entrypointInvalid',
  },
  STEP_FAILED: {
    titleKey: 'STEP_FAILED.title',
    actionKey: 'STEP_FAILED.action',
    category: 'runtimeException',
  },
  SUBAGENT_FAILED: {
    titleKey: 'SUBAGENT_FAILED.title',
    actionKey: 'SUBAGENT_FAILED.action',
    category: 'runtimeException',
  },
  TASK_FAILED: {
    titleKey: 'TASK_FAILED.title',
    actionKey: 'TASK_FAILED.action',
    category: 'runtimeException',
  },
  TEXT_TOO_LONG: {
    titleKey: 'TEXT_TOO_LONG.title',
    actionKey: 'TEXT_TOO_LONG.action',
    category: 'resourceLimitExceeded',
  },
  TIMEOUT: { titleKey: 'TIMEOUT.title', actionKey: 'TIMEOUT.action', category: 'backendTimeout' },
  TOKEN_EXPIRED: {
    titleKey: 'TOKEN_EXPIRED.title',
    actionKey: 'TOKEN_EXPIRED.action',
    category: 'authForbidden',
  },
  TOOL_FAILED: {
    titleKey: 'TOOL_FAILED.title',
    actionKey: 'TOOL_FAILED.action',
    category: 'runtimeException',
  },
  TOOL_MODE_UNAVAILABLE: {
    titleKey: 'TOOL_MODE_UNAVAILABLE.title',
    actionKey: 'TOOL_MODE_UNAVAILABLE.action',
    category: 'capabilityNotOffered',
  },
  TOOL_NOT_FOUND: {
    titleKey: 'TOOL_NOT_FOUND.title',
    actionKey: 'TOOL_NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  TOO_LARGE: {
    titleKey: 'TOO_LARGE.title',
    actionKey: 'TOO_LARGE.action',
    category: 'resourceLimitExceeded',
  },
  TRIAL_QUOTA_EXCEEDED: {
    titleKey: 'TRIAL_QUOTA_EXCEEDED.title',
    actionKey: 'TRIAL_QUOTA_EXCEEDED.action',
    category: 'resourceLimitExceeded',
  },
  UNKNOWN_API_TOOL: {
    titleKey: 'UNKNOWN_API_TOOL.title',
    actionKey: 'UNKNOWN_API_TOOL.action',
    category: 'resourceNotFound',
  },
  UNSUPPORTED_FORMAT: {
    titleKey: 'UNSUPPORTED_FORMAT.title',
    actionKey: 'UNSUPPORTED_FORMAT.action',
    category: 'invalidResponse',
  },
  UNSUPPORTED_IMAGE_FORMAT: {
    titleKey: 'UNSUPPORTED_IMAGE_FORMAT.title',
    actionKey: 'UNSUPPORTED_IMAGE_FORMAT.action',
    category: 'invalidResponse',
  },
  VERSION_NOT_FOUND: {
    titleKey: 'VERSION_NOT_FOUND.title',
    actionKey: 'VERSION_NOT_FOUND.action',
    category: 'resourceNotFound',
  },
  VERSION_SELECTOR_REQUIRED: {
    titleKey: 'VERSION_SELECTOR_REQUIRED.title',
    actionKey: 'VERSION_SELECTOR_REQUIRED.action',
    category: 'resourceNotFound',
  },
  VERSION_TOO_LOW: {
    titleKey: 'VERSION_TOO_LOW.title',
    actionKey: 'VERSION_TOO_LOW.action',
    category: 'protocolMismatch',
  },
  VIDEO_FETCH_FAILED: {
    titleKey: 'VIDEO_FETCH_FAILED.title',
    actionKey: 'VIDEO_FETCH_FAILED.action',
    category: 'backendExited',
  },
  WRITE_FAILED: {
    titleKey: 'WRITE_FAILED.title',
    actionKey: 'WRITE_FAILED.action',
    category: 'runtimeException',
  },
})

/**
 * 兜底条目的**唯一**形态:键恰好是 `UNKNOWN`。
 * 刻意不放宽成"含 unknown 字样" —— UNKNOWN_API_TOOL 是真实业务码
 * (「未找到该工具」,分类 resourceNotFound),宽松判据会把它误判成兜底删掉。
 */
export const UNKNOWN_FALLBACK_CODE = 'UNKNOWN' as const

/** 查表:未收录的码返回 null(**不给「未知错误」兜底**,由守门脚本保证收录完备)。 */
export function resolveErrorCatalog(
  errorCode: string | undefined | null,
): ErrorCatalogEntry | null {
  if (!errorCode) return null
  return ERROR_CODE_CATALOG[errorCode] ?? null
}

/** 是否被本表收录(UI 据此决定渲染错误卡还是干脆不渲染)。 */
export function isKnownErrorCode(errorCode: string | undefined | null): boolean {
  return resolveErrorCatalog(errorCode) !== null
}

/** 八类是否全部登记(台账判据,防止"说覆盖其实漏了几类")。 */
export function hasAllTurnErrorClasses(): boolean {
  return TURN_ERROR_CLASSES.every((c) => isKnownErrorCode(c))
}

/**
 * 自检:表内不得出现 unknown 分类、不得出现 UNKNOWN 兜底条目(零兜底判据)。
 *
 * 分类那一半在**类型层面已被堵死**(`ErrorCategory = ViewFailureKind` 不含 'unknown'),
 * 这里仍保留运行时比较(转 string 比较,否则 tsc 会因"类型无交集"直接报错):
 * 万一将来有人把分类放宽成 `string`,这条运行时判据还在。
 */
export function hasUnknownFallback(): boolean {
  return (
    ERROR_CODE_CATALOG[UNKNOWN_FALLBACK_CODE] !== undefined ||
    Object.values(ERROR_CODE_CATALOG).some((e) => (e.category as string) === 'unknown')
  )
}
