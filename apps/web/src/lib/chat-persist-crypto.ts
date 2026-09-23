// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * zustand persist 的桌面端加密装载层 —— D48(G-56)A 层:会话正文
 *
 * 平台特有:仅桌面端(Tauri WebView)启用,依赖 localStorage + local-vault;不适合共享层(§3)。
 *
 * ## 做什么
 * `ihui-chat` 这条 persist 记录里带**完整消息正文**(partialize 的 recentMessages.messages
 * 最近 50 条 / draftInput / failedDraft / inputHistory / sideQueueByConversation /
 * pendingDiffComments),过去以明文 JSON 躺在 WebView localStorage。本层把
 * 「写进 kv 的那一段字符串」整体换成 AES-256-GCM 信封,做到**静态盘 grep 明文会话为 0**。
 *
 * ## 边界(刻意保守)
 * - 浏览器(非 Tauri)路径:`createChatPersistStorage` 原样返回注入的 base storage,
 *   **对象同一、行为同一**,不改 web 端任何行为。
 * - zustand 的序列化格式一字未动:信封解出来仍是 `{state, version}` 原 JSON,
 *   `version` / `migrate` 链路照旧;因此回退到旧版本构建也只是读不到密文(退回空态),不会解坏。
 *
 * ## 三条硬要求怎么落在这份代码里
 * 1. **降级不崩**:`getItem` 全部异常路径(读 kv 抛错 / 密文解不开 / 解出来不是合法 JSON)
 *    一律 `return null` —— zustand 把 null 当"无缓存",首页以默认空态渲染,不会抛错打断渲染。
 * 2. **迁移幂等 + 不丢数据**:迁移判据是 `openVaultText` 的**层数**而非"是否存在密文":
 *    layers=0 才迁移(明文 → 恰一份);layers=1 什么都不做;l>1(历史/并发套娃)则**重写为恰一份**。
 *    加密或写回任一步失败 ⇒ 原文照旧返回并使用(绝不为"加密上了"而牺牲用户数据)。
 * 3. **零明文残留**:见 `apps/web/tests/d48-chat-persist-encryption.test.ts` ——
 *    用真实 zustand 序列化产物做夹具,迁移后断言 kv 里不含正文子串。
 *    唯一例外是"密钥通道不可用"时的兜底明文写入:那是"退回改造前行为",不是新增泄露面。
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { isDesktopEnv, openVaultText, sealVaultText, type VaultEntryChannel } from './local-vault'

/** 注入用的最小 kv 形态(生产传 window.localStorage;测试传内存实现) */
export interface VaultKvStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ChatVaultStorageOptions<S> {
  /** 非桌面端时原样返回的 base storage(即 persist-helpers.ssrStorage) */
  base: PersistStorage<S> | undefined
  kv: VaultKvStore | null
  /** 桌面端开关:默认取既有平台判定 isDesktopEnv()(不新造第二套判定) */
  isDesktop?: boolean
  /** 密钥通道注入点(默认 Tauri store) */
  channel?: VaultEntryChannel
}

/** 解不开时把原密文挪到旁路键,随后写新数据会清掉它 —— 不留游离的旧 blob */
const UNREADABLE_SUFFIX = '.unreadable'

function safeRead(kv: VaultKvStore, key: string): string | null {
  try {
    return kv.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(kv: VaultKvStore, key: string, value: string): void {
  try {
    kv.setItem(key, value)
  } catch {
    // localStorage 配额/隐私模式:写不进去就这一轮不落盘,不得冒泡到渲染路径
  }
}

function safeRemove(kv: VaultKvStore, key: string): void {
  try {
    kv.removeItem(key)
  } catch {
    // 同上
  }
}

/** 解出来的文本必须是 `{state, version}` 形态;不是就按"无缓存"处理(不抛错) */
function parseStorageValue<S>(text: string): StorageValue<S> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  if (!('state' in parsed)) return null
  return parsed as StorageValue<S>
}

/**
 * 加密版 PersistStorage。非桌面端 / 无 kv ⇒ 直接返回 base(零行为变更)。
 */
export function createVaultBackedPersistStorage<S>(
  options: ChatVaultStorageOptions<S>,
): PersistStorage<S> | undefined {
  const { base, kv } = options
  const isDesktop = options.isDesktop ?? isDesktopEnv()
  if (!isDesktop || !kv) return base
  const channel = options.channel
  /** 加密把写入变成了异步,得自己保住"后写覆盖先写"的顺序(同步 localStorage 原本天然有序) */
  const pendingWrites = new Map<string, Promise<void>>()

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const stored = safeRead(kv, name)
      if (stored === null) return null

      const opened = await openVaultText('chat-persist', stored, channel)
      if (opened.kind === 'unreadable') {
        // 密钥丢了/密文坏了:保留现场供取证,对外一律可读空态(要求 1)
        if (safeRead(kv, `${name}${UNREADABLE_SUFFIX}`) === null)
          safeWrite(kv, `${name}${UNREADABLE_SUFFIX}`, stored)
        return null
      }

      if (opened.kind === 'sealed' && opened.layers > 1) {
        // 双重包裹(并发窗口/历史产物):归正为"恰一份",不得再往上叠层
        const normalized = await sealVaultText('chat-persist', opened.text, channel)
        if (normalized !== null) safeWrite(kv, name, normalized)
      } else if (opened.kind === 'plain') {
        // 一次性迁移。seal 失败(拿不到可用密钥)⇒ 保持明文,原文照旧可用(要求 2)
        const sealed = await sealVaultText('chat-persist', opened.text, channel)
        if (sealed !== null) safeWrite(kv, name, sealed)
      }

      return parseStorageValue<S>(opened.text)
    },

    setItem: (name: string, value: StorageValue<S>): Promise<void> => {
      const write = async (): Promise<void> => {
        const json = JSON.stringify(value)
        const sealed = await sealVaultText('chat-persist', json, channel)
        // sealed === null 表示这一轮没有可用密钥 ⇒ 写明文(等价改造前),绝不静默丢数据
        safeWrite(kv, name, sealed ?? json)
        safeRemove(kv, `${name}${UNREADABLE_SUFFIX}`)
      }
      // 排到该键的队尾;链上永不 reject(否则一次失败会把后续写入一起带崩)
      const queued = (pendingWrites.get(name) ?? Promise.resolve()).then(write, write)
      pendingWrites.set(name, queued)
      return queued
    },

    removeItem: (name: string): void => {
      safeRemove(kv, name)
      safeRemove(kv, `${name}${UNREADABLE_SUFFIX}`)
    },
  }
}

/**
 * chat store 的唯一入口:桌面端走加密装载层,浏览器原样返回 base。
 * 放在这里而不是 chat.ts 里做 if 判断 —— store 侧只有一行改动。
 */
/**
 * 取 window.localStorage。必须 try 包住:部分隐私模式/被禁用的站点下
 * **属性访问本身**就会抛 SecurityError,而这里是在 store 模块初始化时求值的 ——
 * 不兜住就等于让整个 chat store(进而首页)崩掉,而不是"降级不崩"。
 */
function resolveBrowserKv(): VaultKvStore | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function createChatPersistStorage<S>(
  base: PersistStorage<S> | undefined,
): PersistStorage<S> | undefined {
  return createVaultBackedPersistStorage({
    base,
    kv: resolveBrowserKv(),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
