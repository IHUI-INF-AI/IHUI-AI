// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 服务端出站/通知文案取词出口(台账号 G-815926)。
 *
 * 口径:服务端现读订阅用户语言不可得(会话语言通道不在本轮),缺省渲染 zh-CN;
 * 文案单一来源 = packages/i18n/messages/api/*.json 的 `apiOutbound` 键族,
 * zh-CN 值与既有硬编码逐字相同 ⇒ 行为零变化。「按订阅用户语言渲染」留账后续票。
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
