// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSea, getAsset } from 'node:sea'

import { formatIcu, hasIcuSyntax } from '@ihui/i18n'

import { readIntlLocale, readSystemLocaleEnv } from '../utils/system-locale.js'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 语言包目录探测:从本模块起逐级向上找 packages/i18n/messages。
// 写死相对层数(原 4 级)只在 tsx 直跑 src 时成立;tsc dist 与单文件打包
// (SEA)的 __dirname 深度各不相同,层数一错整包语言静默退化成裸 key。
// 向上探测对三种形态同一判据;全部落空返回 null(调用方回退英文键,不抛)。
function findMessagesRoot(): string | null {
  let dir = __dirname
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'packages', 'i18n', 'messages')
    if (existsSync(join(candidate, 'cli')) && existsSync(join(candidate, 'shared'))) {
      return candidate
    }
    // npm 单文件发布包形态(第三条探测路径):语言包随包放在 dist/messages/{cli,shared},
    // 模块 __dirname 即 dist,故同一层再探一次;判据仍要求 cli/ 与 shared/ 同时存在。
    const bundled = join(dir, 'messages')
    if (existsSync(join(bundled, 'cli')) && existsSync(join(bundled, 'shared'))) {
      return bundled
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
const MESSAGES_ROOT = findMessagesRoot()
const MESSAGES_DIR = MESSAGES_ROOT ? join(MESSAGES_ROOT, 'cli') : ''
// 跨端共享语言包(taskStatus.* 等通用键的唯一真相源,含工具功能名/结果度量单位)。
// cli 端语言包按"端 override 优先"深合并到 shared 之上 —— 与 mobile-rn / miniapp-taro
// 的 mergeMessages(shared, 端) 同一策略。这样工具活动行取 `taskStatus.toolReadFile` 等
// 已有键,无需在各端语言包重复 130+ 条工具映射,也满足"禁改 messages/shared 内容"。
const SHARED_DIR = MESSAGES_ROOT ? join(MESSAGES_ROOT, 'shared') : ''

type Messages = Record<string, unknown>

function readJson(dir: string, locale: string): Messages {
  try {
    return JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'))
  } catch {
    return {}
  }
}

// SEA 单文件形态:语言包以 assets 内嵌(键清单见 scripts/build-sea.mjs),不经文件系统。
// 否则 exe 部署到仓库外(MESSAGES_ROOT 探测落空)时所有 t() 退化为裸键名——
// 恰好躲过开发期自验(exe 留在 dist-sea/ 里跑时向上探测能命中仓库根)的分发期缺陷。
function seaAssetJson(key: string): Messages | null {
  try {
    return JSON.parse(Buffer.from(getAsset(key)).toString('utf8')) as Messages
  } catch {
    return null
  }
}

function loadMessages(locale: string): Messages {
  if (isSea()) {
    return deepMerge(seaAssetJson(`shared-${locale}.json`) ?? {}, seaAssetJson(`cli-${locale}.json`) ?? {})
  }
  return deepMerge(readJson(SHARED_DIR, locale), readJson(MESSAGES_DIR, locale))
}

const baseMessages: Record<Locale, Messages> = {
  'zh-CN': loadMessages('zh-CN'),
  en: loadMessages('en'),
  ja: loadMessages('ja'),
  ko: loadMessages('ko'),
  'zh-TW': loadMessages('zh-TW'),
}

let activeLocale: Locale = getLocale()
function normalizeLocale(raw: string): Locale {
  // 同时接住 POSIX(`zh_TW.UTF-8`)与 BCP-47(`zh-TW`)两族形态:
  // 剥掉编码/变体后缀,下划线换连字符。此前本函数只可能收到 Intl 的 BCP-47,
  // env 链接进来后若不归一,`zh-tw.utf-8` 会静默落回默认档(错得毫无声响)。
  const lower = (raw.toLowerCase().split(/[.@]/)[0] ?? '').replace(/_/g, '-')
  if (lower === 'zh' || lower === 'zh-cn') return 'zh-CN'
  if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-TW'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja'
  if (lower === 'ko' || lower.startsWith('ko-')) return 'ko'
  return 'zh-CN'
}

export function getLocale(): Locale {
  if (process.env.IHUI_LOCALE) {
    return normalizeLocale(process.env.IHUI_LOCALE)
  }
  // 系统环境语言优先于 ICU:与 voice/language.ts 共用同一份链实现
  // (`LC_ALL > LC_MESSAGES > LANG`,C/POSIX 档判"无语言信息")。
  // 此前这里只读 Intl,两处各算一次,会出现"界面按 ICU、语音按 env"的分叉。
  const fromEnv = readSystemLocaleEnv()
  if (fromEnv) return normalizeLocale(fromEnv)
  return normalizeLocale(readIntlLocale())
}

export function setLocale(locale: Locale): void {
  activeLocale = locale
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result: Record<string, unknown> = {}
  // 必须遍历两侧键的并集:只遍历 base 会把"仅存在于 override 的顶层命名空间"整块丢掉
  // (实测:合并 messages/shared 后 cli 自己的 cli.* 命名空间被吞,t() 回显键名)
  for (const key of new Set([...Object.keys(base), ...Object.keys(override ?? {})])) {
    const baseValue = base[key]
    const overrideValue = override[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      )
    } else {
      result[key] = overrideValue !== undefined ? overrideValue : baseValue
    }
  }
  return result as T
}
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function t(key: string, params?: Record<string, string | number>): string {
  const active = deepMerge(
    baseMessages['zh-CN'] as unknown as Record<string, unknown>,
    baseMessages[activeLocale] as unknown as Record<string, unknown>,
  )
  const text = getNestedValue(active, key)
  if (text === undefined) {
    return key
  }
  // ICU 形态一律交给共享端中立解释器(packages/i18n/src/icu.ts),与 web(next-intl)同语义;
  // 缺 params 也要渲染,否则 plural/select 键会在终端里显示成语法残迹。
  if (hasIcuSyntax(text)) {
    return formatIcu(text, params ?? {}, { locale: activeLocale })
  }
  if (!params) return text
  // 同时支持 {{name}} 与 {name} 两种占位符:packages/i18n/messages 全库统一
  // 单花括号(ICU 风格),旧消息用双花括号(2026-09-10 修复:单花括号不插值,
  // CLI 输出出现字面量 "{path}",且 en locale 下中文断言测试失败)
  return text
    .replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(params[name] ?? `{{${name}}}`),
    )
    .replace(/\{(\w+)\}/g, (_, name) =>
      String(params[name] ?? `{${name}}`),
    )
}

export const i18n = {
  getLocale,
  setLocale,
  t,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
