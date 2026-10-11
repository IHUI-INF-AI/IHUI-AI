// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 业务错误码 → UI 动作表 + 包装码文案兜底
 * (机制吸收 G-977970;上游出处 zcode packages/ui/src/lib/providerBusinessError.ts:57-213)。
 *
 * 吸收的是**结构**,不是上游 GLM/Start Plan 的具体码表本体(上游 1005/1006/
 * 1308-1321/3102 属上游商业码表,不抄):本表码值全部为本仓自拟中性示例码,
 * 接入真实码表时只需改两张表,机制不变。
 *
 * 核心规则:
 *  1. 码 → (i18n id, UI action) 两张表驱动;"无可执行恢复动作"是**显式 null**
 *     —— 客户端自助救不回来的错误也要有文案,只是不给按钮,这与"码不在表里"
 *     是两回事,不能用 undefined 混掉;
 *  2. 旧链路会把真实业务码压成包装码(PROVIDER_BUSINESS_ERROR / SEND_FAILED /
 *     unknown_error 等)+ 稳定文案。只在**目标 provider 边界内**用文案关键词
 *     恢复真实业务码:并发类文案必须区分"模型级并发"(切模型即可恢复)与
 *     "账号级并发"(阻断型升级)—— 模型级并发不得退化成账号级阻断码,否则
 *     服务恢复后输入框仍被锁住;
 *  3. 非目标 provider 边界一律不兜底(同名文案在别的 provider 语义可能完全
 *     不同,返回 undefined 表示"不兜底")。
 */

export type BusinessErrorUiAction =
  'relogin' | 'refresh-quota' | 'switch-model' | 'retry-later' | 'upgrade'

/** 本仓自拟示例业务码(接入真实码表时整体替换,表结构不动) */
export type BusinessErrorCode = '4291' | '4292' | '4293' | '5001' | '5002' | '5003'

/** 表一:码 → i18n 文案 id(展示层按 id 取本地化文案,不在本层拼句子) */
const BUSINESS_ERROR_MESSAGE_IDS: Record<BusinessErrorCode, string> = {
  '4291': 'ihui.error.business.4291', // 账号级并发上限(阻断型,需升级套餐)
  '4292': 'ihui.error.business.4292', // 模型级并发上限(切模型即可恢复)
  '4293': 'ihui.error.business.4293', // 请求过频(限流,稍后重试)
  '5001': 'ihui.error.business.5001', // 安全校验拒绝(客户端无法自助恢复)
  '5002': 'ihui.error.business.5002', // 配额不足(刷新配额)
  '5003': 'ihui.error.business.5003', // 鉴权失效(重新登录)
}

/**
 * 表二:码 → UI 动作。"无可执行恢复动作"是显式 null:
 * 5001 类错误客户端救不回来,横幅只给文案不给按钮。
 */
const BUSINESS_ERROR_UI_ACTIONS: Record<BusinessErrorCode, BusinessErrorUiAction | null> = {
  '4291': 'upgrade',
  '4292': 'switch-model',
  '4293': 'retry-later',
  // 安全校验拒绝:客户端无法完成校验,没有任何可执行恢复动作(显式 null)
  '5001': null,
  '5002': 'refresh-quota',
  '5003': 'relogin',
}

const BUSINESS_ERROR_CODES: ReadonlySet<string> = new Set(Object.keys(BUSINESS_ERROR_UI_ACTIONS))

export function isBusinessErrorCode(code: string | undefined): code is BusinessErrorCode {
  return !!code && BUSINESS_ERROR_CODES.has(code)
}

export function getBusinessErrorMessageId(code: string | undefined): string | undefined {
  return isBusinessErrorCode(code) ? BUSINESS_ERROR_MESSAGE_IDS[code] : undefined
}

/** 未知码与"已知但无可执行动作"统一返回 null;需要区分时先用 isBusinessErrorCode */
export function getBusinessErrorUiAction(code: string | undefined): BusinessErrorUiAction | null {
  return isBusinessErrorCode(code) ? BUSINESS_ERROR_UI_ACTIONS[code] : null
}

/** 旧链路包装码集合:外层码落在这里(或缺席)时才允许文案兜底 */
const WRAPPER_CODES: ReadonlySet<string> = new Set([
  'PROVIDER_BUSINESS_ERROR',
  'SEND_FAILED',
  'unknown_error',
  'MODEL_RATE_LIMITED',
])

/**
 * 文案兜底的目标 provider 边界:只有名单内的 provider 才做包装码文案恢复。
 * (与 lib/error-attribution.ts 的可信名单同源取 ihui_relay 一方中转;
 * 用户自配 provider 的同名错误不套用本机制。)
 */
const WRAPPER_FALLBACK_PROVIDER_IDS: ReadonlySet<string> = new Set(['ihui_relay'])

/** 并发类文案关键词(中英;命中才允许恢复并发业务码) */
const CONCURRENCY_COPY_PATTERNS: ReadonlyArray<string> = ['concurrent', 'concurrency', '并发']

/** 模型级并发判定词:文案点名 model/模型 才算模型级,其余按账号级处理 */
const MODEL_SCOPED_COPY_PATTERNS: ReadonlyArray<string> = ['model', '模型']

/**
 * 包装码 + 稳定文案 → 恢复真实业务码(仅目标 provider 边界内)。
 *
 * @returns 恢复出的业务码;undefined 表示"边界外/证据不足,不兜底"。
 *   已是业务码直接透传;文案缺并发关键词、外层码不在包装码名单、providerId
 *   不在目标边界,一律不兜底。
 */
export function resolveBusinessCodeFromWrapperCopy(
  code: string | undefined,
  message: string | undefined,
  providerId: string,
): BusinessErrorCode | undefined {
  // 目标边界门:非目标 provider 的同名错误不兜底(误套语义 = 上游 1308 号缺陷同型)
  if (!WRAPPER_FALLBACK_PROVIDER_IDS.has(providerId)) return undefined
  if (isBusinessErrorCode(code)) return code
  const normalizedCode = code?.trim()
  const normalizedMessage = message?.trim().toLowerCase()
  if (!normalizedMessage) return undefined
  if (normalizedCode && !WRAPPER_CODES.has(normalizedCode)) return undefined
  const isConcurrencyCopy = CONCURRENCY_COPY_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern),
  )
  if (!isConcurrencyCopy) return undefined
  // 模型级并发不得退化成账号级阻断码:文案点名 model/模型 → 模型级(切模型可恢复),
  // 否则账号级(升级)。恢复成模型级后,输入框不该被锁。
  const isModelScoped = MODEL_SCOPED_COPY_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern),
  )
  return isModelScoped ? '4292' : '4291'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
