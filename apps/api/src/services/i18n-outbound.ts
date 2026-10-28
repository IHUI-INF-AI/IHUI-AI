// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 服务端出站/通知文案取词出口(台账号 G-815926)。
 *
 * 口径:服务端出站文案按**目标订阅用户语言**渲染(G-1058621,2026-10-07 落地):
 * 调用方把用户语言真实传入 locale 形参(用户语言读 user_preferences group='preferences'
 * key='language',经 normalizeOutboundLocale 归一);拿不到/认不出 ⇒ 缺省渲染 zh-CN。
 * 文案单一来源 = packages/i18n/messages/api/*.json 的 `apiOutbound` 键族。
 *
 * 设计:
 *  - 模块级缓存,每 locale 只读一次盘;读不到/解析不了 ⇒ 空词典、由回退链兜底,
 *    绝不让文案缺失升级成进程崩溃(旧写法是源码常量,永远可用 —— 不得引入新失败模式)。
 *  - 取词链:请求 locale → zh-CN → 键名原样返回。「缺键回退 zh-CN」是硬判据。
 *  - 插值:`{name}` 占位,与 budgetAlert 键族同一风格;params 未提供的占位原样保留。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type MessagesTree = Record<string, unknown>

export type OutboundI18nParams = Record<string, string | number>

const DEFAULT_LOCALE = 'zh-CN'

/** 出站文案实际有词包的语言面(= packages/i18n/messages/api/ 下存在的 locale,与测试 LOCALES 同源)。 */
const SUPPORTED_OUTBOUND_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/**
 * 把存储值(用户偏好 language 等)归一到支持的 locale。
 * G-1058621:locale 形参要有真实调用方 —— 归一规则:精确命中(大小写/连接符不敏感,
 * `en_US` ≡ `en-US`)→ 主子标签前缀命中(`en-US` → `en`)→ 认不出一律 zh-CN(硬判据:缺面回落,
 * 与 t() 的缺键回退同一条禁令 —— 绝不让「拼错的 locale」静默变成另一种语言)。
 */
export function normalizeOutboundLocale(raw: string | null | undefined): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_LOCALE
  const canonical = value.replace(/_/g, '-').toLowerCase()
  const exact = SUPPORTED_OUTBOUND_LOCALES.find((l) => l.toLowerCase() === canonical)
  if (exact) return exact
  const primary = canonical.split('-')[0] ?? ''
  const byPrimary = SUPPORTED_OUTBOUND_LOCALES.find((l) => l.toLowerCase().split('-')[0] === primary)
  return byPrimary ?? DEFAULT_LOCALE
}

const messagesCache = new Map<string, MessagesTree>()

function loadLocaleMessages(locale: string): MessagesTree {
  const cached = messagesCache.get(locale)
  if (cached) return cached
  let parsed: MessagesTree = {}
  try {
    // src/services 与 dist/services 到仓库根同为 4 层 ⇒ tsc 编译前后同一个相对位
    const file = fileURLToPath(
      new URL(`../../../../packages/i18n/messages/api/${locale}.json`, import.meta.url),
    )
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) parsed = raw as MessagesTree
  } catch {
    // 语言包取不到 ⇒ 空词典;取词链兜底到键名,不得抛错打断出站链路
  }
  messagesCache.set(locale, parsed)
  return parsed
}

function lookup(tree: MessagesTree, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object' && !Array.isArray(node)
          ? (node as MessagesTree)[segment]
          : undefined,
      tree,
    )
}

/** 服务端通知文案取词:`apiOutbound` 键族;缺省 zh-CN,缺键逐级回退(终极回退 = 键名)。 */
export function t(
  key: string,
  params?: OutboundI18nParams,
  locale: string = DEFAULT_LOCALE,
): string {
  const local = lookup(loadLocaleMessages(locale), key)
  const fallback =
    locale === DEFAULT_LOCALE ? local : lookup(loadLocaleMessages(DEFAULT_LOCALE), key)
  const template =
    typeof local === 'string' ? local : typeof fallback === 'string' ? fallback : key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder,
  )
}
