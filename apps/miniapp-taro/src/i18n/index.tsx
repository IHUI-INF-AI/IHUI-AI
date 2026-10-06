// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { mergeMessages, translate, resolveList } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { LOCALE_KEY, I18N_PACK_KEY_PREFIX } from '@/constants/storage'
import { aizhsUrl } from '@/constants/icon-urls'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/{shared,miniapp-taro}/
// 2026-07-26 loader.getValueByPath 扩展为返回 unknown,resolveList 支持 fallback,
// 删除本地 mergeDict/resolveRaw,完全复用 @ihui/i18n/loader
// 2026-09-12 体积优化:非中文 4 语言包改为离线 gzip+base64 内联(见 generated/remote-locales.gen.ts),
// 运行时经 fflate 惰性解压,主包不再静态打包这 8 个 JSON(净省约 540KB),功能零损失。
// 2026-10-06 主包余量治理:离线内联载荷(440KB base64,占主包 22%)改**按需拉取** ——
// 载荷从 CDN(aizhsUrl,与 remote-images 同一部署通道)按语言下载,storage 缓存,清单
// (generated/remote-locale-manifest.gen.ts,约 0.5KB)做缓存 key 与完整性校验。
// 同步语义 fail-closed:包未就绪时 getMessages 一律回落 zh-CN(内置回落语),不白屏、
// 不卡首屏、不弹错;tabBar 页文案在 zh-CN 内置集里,始终可达。就绪后 Provider bump
// packEpoch 触发整树重渲染。离线真相 remote-locales.gen.ts 保留在磁盘供守门对账,
// 但运行时**不再 import**(否则 440KB 重新进 common.js)。
import { gunzipSync, strFromU8 } from 'fflate'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import miniappZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import { REMOTE_LOCALE_MANIFEST, type RemoteLocale } from './generated/remote-locale-manifest.gen'

// 纯 JS base64 → Uint8Array 查表解码:小程序真机 JSCore 未必提供 atob,不依赖任何运行时 API
const B64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Uint8Array(256)
for (let i = 0; i < B64_TABLE.length; i++) B64_LOOKUP[B64_TABLE.charCodeAt(i)] = i

function b64ToBytes(b64: string): Uint8Array {
  const len = b64.length
  let pad = 0
  if (len > 0 && b64[len - 1] === '=') pad++
  if (len > 1 && b64[len - 2] === '=') pad++
  const out = new Uint8Array((len / 4) * 3 - pad)
  for (let i = 0, o = 0; i < len; i += 4) {
    const n =
      ((B64_LOOKUP[b64.charCodeAt(i)] ?? 0) << 18) |
      ((B64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0) << 12) |
      ((B64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0) << 6) |
      (B64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0)
    if (o < out.length) out[o++] = (n >> 16) & 0xff
    if (o < out.length) out[o++] = (n >> 8) & 0xff
    if (o < out.length) out[o++] = n & 0xff
  }
  return out
}

export type { Locale }

/* ───────────────── 按需语言包:三级就绪(内存 → storage → CDN) ─────────────────
 *
 * 为什么是三级而不是"下载完再取词":getMessages 活在渲染路径里,必须是**同步**的。
 * 所以这一层的契约是 fail-closed ——任何一级没就绪,取词一律回落内置 zh-CN(它留在包内,
 * 是天然回落语,不得搬走),绝不抛错、绝不白屏、绝不"等网络"。就绪后由 packReady 通知
 * Provider bump epoch,整树重渲染,用户看到的是"先中文、随后自然变成所选语言"。
 *
 * 完整性:清单(generated/remote-locale-manifest.gen.ts,约 0.5KB)带
 *   version = 载荷 gzip+b64 的 sha256 → 用作 storage key 与失效判据(包一换 key 就变,
 *              旧缓存自然不会被读到,也无需运行时算哈希)
 *   bytes   = 载荷字符数            → 下载完整性粗校验
 * 真正的"坏包不上屏"靠结构性校验:b64 字符集 ∧ 字节数 ∧ gunzip ∧ JSON.parse ∧ 必须是
 * 普通对象。任一环不过 ⇒ 该载荷**既不进内存也不写 storage**,并就地摘掉坏缓存条目
 * (留着它,下次冷启还会读到同一份坏包 —— 那才是"坏包永久上屏")。
 */

/** CDN 载荷目录名 = src/assets/remote-locales/ 的目录名,即部署通道契约(与 remote-images 同法) */
const REMOTE_PACK_PATH_SEG = 'remote-locales'
const PACK_REQUEST_TIMEOUT_MS = 15_000
const PACK_RETRY_BASE_MS = 2_000
const PACK_RETRY_MAX_MS = 60_000
/** 一次会话内同一语言最多试这么多次,之后只走缓存/回落,不再打网络 */
const PACK_MAX_ATTEMPTS = 5

function remotePackUrl(locale: RemoteLocale, version: string): string {
  // ?v= 只做缓存击穿:cdn-server.js 用 new URL(req.url).pathname 取文件,query 不参与路径解析。
  // 载荷文件名恒定而内容随版本变,不加这一维会拿到 CDN 的旧副本,并把它当"当前版本"缓存住。
  return aizhsUrl(`${REMOTE_PACK_PATH_SEG}/${locale}.b64.txt?v=${version}`)
}

function packStorageKey(locale: RemoteLocale, version: string): string {
  return `${I18N_PACK_KEY_PREFIX}${locale}_${version}`
}

function isRemoteLocale(locale: Locale): locale is RemoteLocale {
  return Object.prototype.hasOwnProperty.call(REMOTE_LOCALE_MANIFEST, locale)
}

/**
 * 载荷 → messages;不合法一律返回 null(不抛)。
 * 校验顺序按"便宜的在前":字符集 → 字节数 → 解压 → JSON → 形状。
 */
function decodePack(locale: RemoteLocale, rawPayload: string): Messages | null {
  const entry = REMOTE_LOCALE_MANIFEST[locale]
  if (!entry) return null
  // 服务端/CDN 可能在文末补换行,先剥掉空白再按清单字节数校验(否则合法包会被判成坏包)
  const payload = rawPayload.trim()
  if (!payload || payload.length !== entry.bytes) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null
  try {
    const parsed: unknown = JSON.parse(strFromU8(gunzipSync(b64ToBytes(payload))))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Messages
  } catch {
    return null
  }
}

/** 内存级:只存"已通过 decodePack"的语言包,所以命中即可直接用,无需再校验 */
const remoteCache = new Map<Locale, Messages>()
/** 在途请求:同一 locale 并发取词只发一次(渲染一次调几十遍 getMessages 是常态) */
const inflight = new Map<RemoteLocale, Promise<void>>()
/** 会话内退避:失败次数 + 下次允许发起的时刻;超上限就不再打网络,静默用 zh-CN */
const backoff = new Map<RemoteLocale, { attempts: number; nextAt: number }>()
const packReadyListeners = new Set<() => void>()

function notifyPackReady(): void {
  for (const listener of [...packReadyListeners]) {
    try {
      listener()
    } catch {
      // 某个监听器坏了不得拖垮取词链路
    }
  }
}

/** storage 级:同步读缓存;读到坏载荷 ⇒ 摘除条目并返回 null(而不是把坏包上屏) */
function readCachedPack(locale: RemoteLocale): Messages | null {
  const version = REMOTE_LOCALE_MANIFEST[locale]?.version
  if (!version) return null
  let raw: unknown = ''
  try {
    raw = Taro.getStorageSync(packStorageKey(locale, version))
  } catch {
    return null
  }
  if (typeof raw !== 'string' || !raw) return null
  const messages = decodePack(locale, raw)
  if (!messages) {
    try {
      Taro.removeStorageSync(packStorageKey(locale, version))
    } catch {
      // 摘不掉也不能让坏缓存留下就报错:静默,下次仍走同一判据
    }
    return null
  }
  return messages
}

/**
 * 摘掉同一语言**旧版本**的缓存条目:缓存 key 里带 version,所以每次发版都会留下一个
 * 永远不会再被读到的旧键。WeChat storage 是 10MB 共享配额 —— 不清就会随发版线性堆积,
 * 写满之后 setStorageSync 开始抛错,缓存这一级从此永久失效(而它正是弱网体验的承重点)。
 * 量不到 keys 时什么都不做:宁可多留一个旧键,也不要让清理动作拦住本次写入。
 */
function pruneOldPackVersions(locale: RemoteLocale, keepVersion: string): void {
  const keepKey = packStorageKey(locale, keepVersion)
  const prefix = `${I18N_PACK_KEY_PREFIX}${locale}_`
  try {
    const info = Taro.getStorageInfoSync() as unknown as { keys?: string[] }
    for (const key of info?.keys ?? []) {
      if (typeof key === 'string' && key !== keepKey && key.startsWith(prefix)) {
        Taro.removeStorageSync(key)
      }
    }
  } catch {
    // 静默:这一维失败不影响包已就绪
  }
}

/** CDN 级:拉载荷文本;任何失败(网络/状态码/非字符串)一律 null,绝不抛给调用方 */
async function fetchPackPayload(locale: RemoteLocale): Promise<string | null> {
  const entry = REMOTE_LOCALE_MANIFEST[locale]
  if (!entry) return null
  try {
    const res = await Taro.request({
      url: remotePackUrl(locale, entry.version),
      method: 'GET',
      dataType: 'text', // 载荷是纯文本 base64,不能让 weapp 按 JSON 解析响应体
      timeout: PACK_REQUEST_TIMEOUT_MS,
    })
    const statusCode: unknown = res?.statusCode
    if (typeof statusCode !== 'number' || statusCode < 200 || statusCode >= 300) return null
    const data: unknown = res?.data
    return typeof data === 'string' ? data : null
  } catch {
    return null
  }
}

/**
 * 让某语言的包"尽力就绪":内存已有 ⇒ 零成本;否则发起(且只发起一次)CDN 拉取。
 * 返回的 promise 永不 reject —— 失败是这一层的正常分支(静默回落),不是异常。
 */
export function ensureRemotePack(locale: Locale): Promise<void> {
  if (!isRemoteLocale(locale)) return Promise.resolve()
  if (remoteCache.has(locale)) return Promise.resolve()
  const running = inflight.get(locale)
  if (running) return running
  const waited = backoff.get(locale)
  if (waited && (waited.attempts >= PACK_MAX_ATTEMPTS || Date.now() < waited.nextAt)) {
    return Promise.resolve()
  }
  const task = (async (): Promise<void> => {
    const payload = await fetchPackPayload(locale)
    inflight.delete(locale)
    const messages = payload ? decodePack(locale, payload) : null
    if (!payload || !messages) {
      const attempts = (backoff.get(locale)?.attempts ?? 0) + 1
      backoff.set(locale, {
        attempts,
        nextAt: Date.now() + Math.min(PACK_RETRY_BASE_MS * 2 ** (attempts - 1), PACK_RETRY_MAX_MS),
      })
      return
    }
    remoteCache.set(locale, messages)
    backoff.delete(locale)
    const version = REMOTE_LOCALE_MANIFEST[locale].version
    try {
      // 存的是**载荷原文**而不是解压后的对象:下次冷启同步读回即可上屏,不必再联网
      Taro.setStorageSync(packStorageKey(locale, version), payload)
      pruneOldPackVersions(locale, version)
    } catch {
      // 写缓存失败只影响"下次还得下一遍",不影响本次上屏 —— 静默
    }
    notifyPackReady()
  })()
  inflight.set(locale, task)
  return task
}

interface I18nContextValue {
  locale: Locale
  t: (key: string, params?: Record<string, string | number>) => string
  tList: (key: string) => string[]
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  t: (key) => key,
  tList: () => [],
  setLocale: () => {},
})

// 各 locale 的合并 messages:shared 作 base,miniapp-taro 覆盖(端 key 优先)。
// zh-CN 静态打包在主包内 —— 它既是默认语言,也是按需包未就绪时的**唯一回落语**。
const zhCNMessages: Messages = mergeMessages(sharedZhCN as Messages, miniappZhCN as Messages)

/**
 * 取某语言的 messages(同步)。
 * 三级就绪:内存 → storage 缓存 → CDN 拉取(异步,本次先回落);失败静默,永不抛。
 * 返回值在包未就绪时是 zhCNMessages —— 调用方无需判空,也不会看到半截词典。
 */
export function getMessages(locale: Locale): Messages {
  if (locale === 'zh-CN') return zhCNMessages
  const hit = remoteCache.get(locale)
  if (hit) return hit
  if (!isRemoteLocale(locale)) return zhCNMessages
  const cached = readCachedPack(locale)
  if (cached) {
    remoteCache.set(locale, cached)
    return cached
  }
  // 冷启首屏:先让 zh-CN 上屏,同时在后台发起拉取(在途/退避由 ensureRemotePack 收敛)
  void ensureRemotePack(locale)
  return zhCNMessages
}

const LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

// 模块级当前 locale(供非组件代码使用,如 utils/platform 中的 Taro.showToast 提示文案)
// I18nProvider 挂载时从 storage 同步,setLocale 时同步更新
let currentLocale: Locale = 'zh-CN'

/**
 * 组件树外的 locale 切换入口(2026-09-21 立,供 AI 操控桥调用)。
 *
 * 为什么不能直接改 `currentLocale`/storage:那只会让**下一次**渲染用到新值,当前界面纹丝不动
 * —— 对调用方等于"报了成功但用户什么都没看见"的假成功。真正生效必须走 I18nProvider 里那个
 * `setLocale`(它会 setState 触发整树重渲染),而它在 React 内部。
 * 所以由 Provider 挂载时把 setter 注册进来、卸载时摘掉;注册表这边只在**确实拿到 setter** 时
 * 才算成功,否则如实返回失败(不编造)。
 */
let localeSetter: ((locale: Locale) => void) | null = null

export function registerLocaleSetter(setter: ((locale: Locale) => void) | null): void {
  localeSetter = setter
}

/** 返回 false = 当前没有挂载中的 I18nProvider(冷启竞态/未挂 Provider),调用方须如实报错。 */
export function requestLocaleChange(locale: Locale): boolean {
  if (!localeSetter) return false
  localeSetter(locale)
  return true
}

/**
 * 全局 t 函数(供非组件代码使用,如 utils/pay.ts、platform/pay.ts 等)
 * - 组件内优先用 useI18n() 获取响应式 t
 * - utils/platform 等非组件代码用本函数
 * - locale 切换由 I18nProvider 同步到 currentLocale
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(getMessages(currentLocale), key, { fallback: zhCNMessages, params })
}

/** 带回退的翻译函数类型(供模块级数据工厂函数注入,避免在数据常量里调用 hook) */
export type TtFn = (k: string, fb: string, params?: Record<string, string | number>) => string

/**
 * 原生 tabBar 文案本地化(app.json 的 text 为静态配置,不支持 i18n,
 * 通过 setTabBarItem 在运行时按当前 locale 覆盖;失败静默,如非 tab 页环境)
 */
const TAB_BAR_ITEMS: ReadonlyArray<{ index: number; key: string; fb: string }> = [
  { index: 0, key: 'tabBar.community', fb: '智汇社区' },
  { index: 1, key: 'tabBar.agent', fb: 'AI agent' },
  { index: 2, key: 'tabBar.square', fb: '广场' },
  { index: 3, key: 'tabBar.user', fb: '我的' },
  { index: 4, key: 'tabBar.share', fb: '分享星球' },
]

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = Taro.getStorageSync(LOCALE_KEY)
    currentLocale = LOCALES.includes(stored) ? (stored as Locale) : 'zh-CN'
    return currentLocale
  })
  // 按需包就绪的**渲染令牌**:包在后台下载完成时 bump 一次,整树重渲染把 zh-CN 换成所选语言。
  // 刻意不绑定这个值 —— 重渲染后由渲染期重算的 messages 引用作为换词典的通道,
  // 留一个"从不读的变量"当证据比不留更糟(它会让下一个人以为它进了某个依赖)。
  // 为什么不直接 setState 新词典:词典住在模块级 Map(不是 React state),没有这一维,
  // 渲染路径就只会停在"上次取到的 zh-CN 回落值"上,用户语言永远不生效。
  const [, setPackEpoch] = useState(0)

  const setLocale = useCallback((l: Locale) => {
    currentLocale = l
    setLocaleState(l)
    Taro.setStorageSync(LOCALE_KEY, l)
  }, [])

  // 把真正会重渲染的 setter 暴露给组件树外(AI 操控桥);卸载时摘掉,避免调用到已销毁的 Provider
  useEffect(() => {
    registerLocaleSetter(setLocale)
    return () => registerLocaleSetter(null)
  }, [setLocale])

  // 就绪订阅 + 冷启/切语言即发起拉取(不阻塞渲染:未就绪期间取词回落内置 zh-CN)
  useEffect(() => {
    const bump = () => setPackEpoch((n) => n + 1)
    packReadyListeners.add(bump)
    void ensureRemotePack(locale)
    return () => {
      packReadyListeners.delete(bump)
    }
  }, [locale])

  // 渲染期取一次:后台包就绪时 setPackEpoch 触发重渲染,这里重新算出的就是新的词典引用,
  // 所以下面两个 useCallback 依赖的是"真正被读到的值",不必关掉 exhaustive-deps 规则。
  const messages = getMessages(locale)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(messages, key, { fallback: zhCNMessages, params }),
    [messages],
  )

  const tList = useCallback((key: string) => resolveList(messages, key, zhCNMessages), [messages])

  // locale 变化/初始化时同步原生 tabBar 文案
  useEffect(() => {
    for (const item of TAB_BAR_ITEMS) {
      const text = t(item.key)
      if (text === item.key) continue // 词典缺失时保留静态默认文案
      Taro.setTabBarItem({ index: item.index, text }).catch(() => {})
    }
  }, [locale, t])

  return (
    <I18nContext.Provider value={{ locale, t, tList, setLocale }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * 带回退的翻译 hook(替代各页面/组件内联的 tt 函数)
 *
 * - 若 key 存在翻译,返回翻译值(支持 {placeholder} 参数替换)
 * - 若 key 不存在,返回 fb 回退文案(支持 {placeholder} 参数替换)
 *
 * 用 useCallback 包装避免每次渲染重建,消除 react-hooks/exhaustive-deps 警告
 */
export function useTt() {
  const { t } = useI18n()
  return useCallback(
    (k: string, fb: string, params?: Record<string, string | number>) => {
      const v = params ? t(k, params) : t(k)
      if (v !== k) return v
      if (!params) return fb
      return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
    },
    [t],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
