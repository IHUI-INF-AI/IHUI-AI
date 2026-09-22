// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D79 等待态文案池:等待指示器单一固定串升级为分象限轮换池。
// 按对象(智能体/计算机/上下文/计划/详情)×阶段(首轮/中途/追问)分池,每池 5 个近义变体。
// 纯文案层、零数据成本;轮换用 seed/turnId 取模,禁止 Math.random(可测性)。
// D79 返工取词纪律:非英文文案一律走 packages/i18n/messages/shared 词表 waiting 命名空间,
// 本模块仅保留英文回退池(英文不触发硬编码中文守门);调用方经可选 t 注入取词函数,
// 缺键或无 t 时回退英文,绝不回退中文直贴、绝不回显 raw key 给用户。
// 键模式:waiting.<象限>.<阶段>.<下标> + waiting.vividTail,清单见 waitingI18nKeyList()。

export const WAITING_QUADRANTS = ['agent', 'computer', 'context', 'plan', 'detail'] as const

/** 等待对象象限:智能体/计算机/上下文/计划/详情 */
export type WaitingQuadrant = (typeof WAITING_QUADRANTS)[number]

export const WAITING_PHASES = ['first', 'middle', 'followup'] as const

/** 等待阶段:首轮/中途/追问 */
export type WaitingPhase = (typeof WAITING_PHASES)[number]

export const WAITING_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 覆盖五语言,与 packages/i18n 现有语言包对齐 */
export type WaitingLocale = (typeof WAITING_LOCALES)[number]

/** 人格化档位:保守(默认)/生动;关闭用人格开关 personaEnabled=false 回退固定串 */
export type WaitingPersona = 'conservative' | 'vivid'

/** 设置项三态:off=关闭(固定串)/conservative(默认)/vivid(人格化) */
export type WaitingPersonaSetting = 'off' | WaitingPersona

/** 设置项键(主 agent 落设置存储时用此键,各端取同一键) */
export const WAITING_PERSONA_SETTING_KEY = 'waitingPersona' as const

/** 设置默认值:保守(任务要求) */
export const WAITING_PERSONA_DEFAULT: WaitingPersonaSetting = 'conservative'

/** 未知/非法设置值一律回退保守,不抛错(设置存储脏数据不得崩渲染) */
export function resolveWaitingPersonaSetting(raw: unknown): WaitingPersonaSetting {
  if (raw === 'off' || raw === 'vivid' || raw === 'conservative') return raw
  return WAITING_PERSONA_DEFAULT
}

function isWaitingLocale(locale: unknown): locale is WaitingLocale {
  return (
    locale === 'zh-CN' ||
    locale === 'zh-TW' ||
    locale === 'en' ||
    locale === 'ja' ||
    locale === 'ko'
  )
}

type WaitingFallbackPoolTable = Record<WaitingQuadrant, Record<WaitingPhase, readonly string[]>>

/**
 * 英文回退池:分象限×分阶段,每池恰 5 个近义变体。
 * 保守口径:中性动词 + 进行态,不卖萌、不反问、不承诺完成时间。
 * 非英文文案已搬进 shared 词表,此处仅保留英文兜底。
 */
const WAITING_POOLS_EN: WaitingFallbackPoolTable = {
  // 非英文池已搬进 shared 词表 waiting 命名空间,此处仅保留英文回退。
  agent: {
    first: [
      'Preparing a reply…',
      'Organizing my thoughts…',
      'Got it, thinking through a response…',
      'Generating a reply for you…',
      'Question received, working on it…',
    ],
    middle: [
      'Still working on it…',
      'Picking up where we left off…',
      'Putting together the rest of the reply…',
      'Following up on your question…',
      'Generating what comes next…',
    ],
    followup: [
      'Reading your follow-up…',
      'Thinking it through with context…',
      'Organizing a reply to your follow-up…',
      'Follow-up received, on it…',
      'Adding to my answer…',
    ],
  },
  computer: {
    first: [
      'Allocating compute…',
      'Initializing the runtime…',
      'Starting the pipeline…',
      'Spinning up processing…',
      'Running the first pass…',
    ],
    middle: [
      'Executing…',
      'Crunching the numbers…',
      'Working through intermediate results…',
      'Still running, making progress…',
      'Computing, one moment…',
    ],
    followup: [
      'Recomputing…',
      'Continuing with your new input…',
      'Processing the addition…',
      'Updating the results…',
      'Handling the follow-up request…',
    ],
  },
  context: {
    first: [
      'Reviewing conversation context…',
      'Loading relevant context…',
      'Sorting through background…',
      'Recalling related details…',
      'Gathering context…',
    ],
    middle: [
      'Connecting with earlier context…',
      'Thinking with context in mind…',
      'Glancing back at the thread…',
      'Context ready, working on it…',
      'Cross-checking previous messages…',
    ],
    followup: [
      'Reading your follow-up in context…',
      'Looking back at relevant context…',
      'Linking to earlier discussion…',
      'Checking against the thread…',
      'Working on it with context…',
    ],
  },
  plan: {
    first: [
      'Drafting a plan…',
      'Breaking down your request…',
      'Mapping out the steps…',
      'Analyzing the key points…',
      'Outlining the reply…',
    ],
    middle: [
      'Working through the plan…',
      'Moving to the next step…',
      'Plan in progress…',
      'Processing step by step…',
      'Carrying out the remaining steps…',
    ],
    followup: [
      'Adjusting the plan…',
      'Updating steps for your follow-up…',
      'Replanning…',
      'Filling in plan details…',
      'Following up on the new ask…',
    ],
  },
  detail: {
    first: [
      'Preparing a detailed answer…',
      'Organizing the details…',
      'Sorting the key points…',
      'Generating an in-depth reply…',
      'Fleshing out the answer…',
    ],
    middle: [
      'Adding details…',
      'Expanding the explanation…',
      'Polishing what comes next…',
      'Details in progress…',
      'Refining the reply…',
    ],
    followup: [
      'Adding the details you asked for…',
      'Expanding on your follow-up…',
      'Fleshing out the explanation…',
      'Preparing a supplement…',
      'Rounding out the follow-up answer…',
    ],
  },
}

// 开关关闭时的回退固定串:仅保留英文兜底。
// 中文固定串走各端自有词表(如 web 的 ai.toolCall.waitingResponse),由调用方经 fallback 显式传入。
// 此处绝不内联中文,否则硬编码中文守门又红。
export const WAITING_FALLBACK_EN = 'Waiting for model response…'

/** 历史导出兼容:各语言统一映射到英文兜底,调用方如需本地化请传 fallback。 */
export const WAITING_LEGACY_FALLBACK: Record<WaitingLocale, string> = {
  'zh-CN': WAITING_FALLBACK_EN,
  'zh-TW': WAITING_FALLBACK_EN,
  en: WAITING_FALLBACK_EN,
  ja: WAITING_FALLBACK_EN,
  ko: WAITING_FALLBACK_EN,
}

// vivid 档尾缀:人格化只加短尾,不另建池(变体数不膨胀)。
// 本地化尾缀走词表 waiting.vividTail,此处仅保留英文兜底。
export const WAITING_VIVID_TAIL_EN = ', almost there'

function hashSeedString(value: string): number {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    hash = ((hash << 5) + hash + code) >>> 0
  }
  return hash
}

/** seed 归一:数字取整取绝对值;字符串(turnId)用 djb2 哈希;非法值归 0 */
function normalizeSeed(seed: number | string | undefined): number {
  if (typeof seed === 'string') return hashSeedString(seed)
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.abs(Math.floor(seed))
  return 0
}

/** 取词函数形态:按完整词表键取本地化文案,缺键返回 undefined(由本模块回退英文)。 */
export type WaitingTextLookup = (key: string) => string | undefined

export interface ResolveWaitingTextInput {
  quadrant: WaitingQuadrant
  phase: WaitingPhase
  /** 保留兼容:非法值回退 zh-CN(不抛错);实际文案走 t,无 t 一律回退英文 */
  locale?: WaitingLocale
  /** 确定性轮换键:轮次 turnId 或数字 seed;缺省 0 */
  seed?: number | string
  /** 人格化档位,默认 conservative */
  persona?: WaitingPersona
  /** 人格开关,默认 true;false 直接回退固定串 */
  personaEnabled?: boolean
  /** 自定义回退串,缺省用英文兜底 */
  fallback?: string
  /** 取词注入:按 waiting.<象限>.<阶段>.<下标> 取本地化文案,缺省不用 */
  t?: WaitingTextLookup
}

/**
 * 词表取词单点:取到非空且非 raw key 才采用,否则回退英文。
 * raw key 回显是交付事故,此处直接拦死,不把 key 漏给用户。
 */
function pickWaitingDictText(
  t: WaitingTextLookup | undefined,
  key: string,
  fallbackEn: string,
): string {
  if (!t) return fallbackEn
  try {
    const value = t(key)
    if (typeof value !== 'string') return fallbackEn
    if (value.trim() === '') return fallbackEn
    if (value === key) return fallbackEn
    return value
  } catch {
    return fallbackEn
  }
}

/**
 * 取等待文案(纯函数,同输入必同输出)。
 * 下标 = normalizeSeed(seed) % 池长;vivid 档 = 保守文案 + 词表尾缀。
 * 有 t 走词表,无 t 或缺键回退英文池。
 */
export function resolveWaitingText(input: ResolveWaitingTextInput): string {
  const locale = isWaitingLocale(input.locale) ? input.locale : 'zh-CN'
  const fallbackEn = input.fallback ?? WAITING_LEGACY_FALLBACK[locale]
  if (input.personaEnabled === false) return fallbackEn
  const poolEn = WAITING_POOLS_EN[input.quadrant]?.[input.phase]
  if (!poolEn || poolEn.length === 0) return fallbackEn
  const index = normalizeSeed(input.seed) % poolEn.length
  const key = waitingI18nKey(input.quadrant, input.phase, index)
  const baseEn = poolEn[index] ?? fallbackEn
  const base = pickWaitingDictText(input.t, key, baseEn)
  if ((input.persona ?? 'conservative') === 'vivid') {
    const tail = pickWaitingDictText(
      input.t,
      `${WAITING_I18N_NAMESPACE}.vividTail`,
      WAITING_VIVID_TAIL_EN,
    )
    return `${base}${tail}`
  }
  return base
}

/**
 * 某池变体数(验收"每池 ≥5"用它断言,不硬编码数字)。
 * locale 参数保留兼容,五语言池等长,一律按英文回退池计数。
 */
export function waitingPoolSize(
  _locale: WaitingLocale,
  quadrant: WaitingQuadrant,
  phase: WaitingPhase,
): number {
  return WAITING_POOLS_EN[quadrant][phase].length
}

/** 读屏去重门:文本无变化或为空不播报(sr-stream-announcer 侧调用) */
export function shouldAnnounceWaitingText(previous: string, next: string): boolean {
  return next.trim() !== '' && previous !== next
}

/** 词表命名空间(主 agent 在 packages/i18n/messages/** 建池用) */
export const WAITING_I18N_NAMESPACE = 'waiting' as const

/** 单条词表键:`waiting.<象限>.<阶段>.<下标>` */
export function waitingI18nKey(
  quadrant: WaitingQuadrant,
  phase: WaitingPhase,
  index: number,
): string {
  return `${WAITING_I18N_NAMESPACE}.${quadrant}.${phase}.${index}`
}

/**
 * 词表键清单:75 条正文键(5 象限×3 阶段×5 变体) + 1 条 vividTail,共 76。
 * 已落地 packages/i18n/messages/shared 五语言,此处仅作键清单真相源。
 */
export function waitingI18nKeyList(): string[] {
  const keys: string[] = []
  for (const quadrant of WAITING_QUADRANTS) {
    for (const phase of WAITING_PHASES) {
      const size = WAITING_POOLS_EN[quadrant][phase].length
      for (let index = 0; index < size; index += 1) {
        keys.push(waitingI18nKey(quadrant, phase, index))
      }
    }
  }
  keys.push(`${WAITING_I18N_NAMESPACE}.vividTail`)
  return keys
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
