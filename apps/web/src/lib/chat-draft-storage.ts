// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 输入草稿(`chat:draft*`)的桌面端加密通道 —— O59⑤ 残留修复(2026-10-06)
 *
 * ## 为什么单独一个模块,而不是复用 `createVaultBackedPersistStorage`
 * 那一层是 **zustand persist** 的装载器,契约要求值是 `{state, version}` 形态
 * (`parseStorageValue` 强制 `'state' in parsed`,不满足就当"无缓存"丢回去)。
 * 草稿桶里是**裸纯文本**,套上去会被整条丢掉 —— 这不是配置问题,是类型契约不匹配。
 * 所以本模块直接复用**键无关**的 `sealVaultText` / `openVaultText`,自建 kv 包装。
 *
 * ## 与 persist blob 里那份 draftInput 的关系
 * `stores/chat.ts` 的 `ihui-chat` persist blob 里也有 `draftInput`,那份**已加密**
 * (chat-persist 域)。本模块管的是 `chat:draft:{conversationId}` 这组分桶键,
 * 二者是不同的键、不同粒度,故单开 `chat-draft` 域(见 local-vault.ts 的 DOMAIN_INFO 注释)。
 *
 * ## 四条硬要求(逐条对应实现里的落点)
 * 1. **桌面端短路**:非 Tauri / 无 kv ⇒ 全链路退化为裸 localStorage,浏览器行为一字不变。
 * 2. **异步写序**:`pendingWrites` 队列。加密把写入变成异步,同步 localStorage 原本天然的
 *    "后写覆盖先写"顺序没了,必须自己排 —— 且 **remove 也要入队**(见下)。
 * 3. **明文一次性迁移**:`openVaultText` 返回 `kind:'plain'`(改造前存量)⇒ 读时 seal 回写。
 *    层数 >1 的历史/并发套娃归正为恰一份。
 * 4. **密钥不可用时明文兜底**:`sealVaultText` 返回 null ⇒ 写明文,绝不静默丢草稿。
 *
 * ## remove 必须入队(踩过的坑,写在这里防回潮)
 * 只把 write 排进 `pendingWrites`、remove 直删,会出一个真实的数据复活 bug:
 * 防抖写入已入队(WebCrypto 还在跑)→ 发送成功调 remove 同步删掉 → 队列里的
 * 密文随后落盘 ⇒ **已发送的草稿复活**。所以删除走同一条队列,保证"后写覆盖先写"。
 */

import {
  isDesktopEnv,
  openVaultText,
  sealVaultText,
  type VaultDomain,
  type VaultEntryChannel,
} from './local-vault'

/** 注入用的最小 kv 形态(生产传 window.localStorage;测试传内存实现) */
export interface DraftKvStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ChatDraftStorageOptions {
  kv: DraftKvStore | null
  /** 桌面端开关:默认取既有平台判定 isDesktopEnv()(不新造第二套判定) */
  isDesktop?: boolean
  /** 密钥通道注入点(默认 Tauri store);测试必须注入,否则会去 load 真 store */
  channel?: VaultEntryChannel
  /**
   * HKDF 派生域:默认 'chat-draft'(输入草稿)。
   * **新增被加密的键族必须开新域**,理由与 `chat-persist-crypto` 的同一条纪律:
   * 共用子密钥 ⇒ 任一方日后重加密/换密钥时,另一族的密文也跟着一起废,
   * 且"这段密文是用哪把子密钥写的"失去锚点、无法归因。
   * 与 persist 各 store 的差别只在于:那几族是 zustand blob(值已是 JSON),
   * 本模块的调用方是**纯文本桶**(草稿正文 / prompt-history 数组),
   * 但纪律完全一致 —— 见 local-vault.ts 的 DOMAIN_INFO。
   */
  domain?: VaultDomain
}

/** 解不开时把原密文挪到旁路键,随后写新数据会清掉它 —— 不留游离的旧 blob */
const UNREADABLE_SUFFIX = '.unreadable'

function safeRead(kv: DraftKvStore, key: string): string | null {
  try {
    return kv.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(kv: DraftKvStore, key: string, value: string): void {
  try {
    kv.setItem(key, value)
  } catch {
    // localStorage 配额/隐私模式:写不进去就这一轮不落盘,不得冒泡到输入路径
  }
}

function safeRemove(kv: DraftKvStore, key: string): void {
  try {
    kv.removeItem(key)
  } catch {
    // 同上
  }
}

export interface ChatDraftStorage {
  /** 读草稿明文(触发解密 + 存量明文迁移)。缺失/解不开 ⇒ 空串 */
  read(key: string): Promise<string>
  /** 写草稿;空串等价于删桶(与旧 hook「有值 setItem / 无值 removeItem」的语义对齐) */
  write(key: string, text: string): Promise<void>
  /** 删桶(入队,见文件头「remove 必须入队」) */
  remove(key: string): Promise<void>
  /**
   * 同步窥视:仅在**非桌面端**(值本就是明文)返回真值。
   * 桌面端恒返 null —— 值是密文,同步解不开。
   * 调用方据此决定"初始值同步给"还是"先显示空、解密后一次性回填"。
   */
  peekSync(key: string): string | null
}

export function createChatDraftStorage(options: ChatDraftStorageOptions): ChatDraftStorage {
  const { kv } = options
  const isDesktop = options.isDesktop ?? isDesktopEnv()
  // 要求 1:非桌面端 / 无 kv ⇒ 全部走裸 localStorage,零行为变更
  if (!isDesktop || !kv) {
    return {
      read: async (key) => (kv ? (safeRead(kv, key) ?? '') : ''),
      write: async (key, text) => {
        if (!kv) return
        if (text) safeWrite(kv, key, text)
        else safeRemove(kv, key)
      },
      remove: async (key) => {
        if (kv) safeRemove(kv, key)
      },
      peekSync: (key) => (kv ? safeRead(kv, key) : null),
    }
  }

  const channel = options.channel
  const domain: VaultDomain = options.domain ?? 'chat-draft'
  /** 加密把写入变成异步,得自己保住"后写覆盖先写"的顺序(要求 2) */
  const pendingWrites = new Map<string, Promise<void>>()

  const enqueue = (key: string, task: () => Promise<void>): Promise<void> => {
    // 排到该键的队尾;链上永不 reject(否则一次失败会把后续写入一起带崩)
    const queued = (pendingWrites.get(key) ?? Promise.resolve()).then(task, task)
    pendingWrites.set(key, queued)
    return queued
  }

  return {
    read: async (key) => {
      const stored = safeRead(kv, key)
      if (stored === null) return ''

      const opened = await openVaultText(domain, stored, channel)
      if (opened.kind === 'unreadable') {
        // 密钥丢了/密文坏了:保留现场供取证,对外一律可读空态(要求 1/4)
        if (safeRead(kv, `${key}${UNREADABLE_SUFFIX}`) === null)
          safeWrite(kv, `${key}${UNREADABLE_SUFFIX}`, stored)
        return ''
      }

      if (opened.kind === 'sealed' && opened.layers > 1) {
        // 双重包裹(并发窗口/历史产物):归正为"恰一份",不得再往上叠层
        const normalized = await sealVaultText(domain, opened.text, channel)
        if (normalized !== null) safeWrite(kv, key, normalized)
      } else if (opened.kind === 'plain') {
        // 明文一次性迁移(要求 3)。seal 失败(拿不到可用密钥)⇒ 保持明文,原文照旧可用(要求 4)
        const sealed = await sealVaultText(domain, opened.text, channel)
        if (sealed !== null) safeWrite(kv, key, sealed)
      }

      return opened.text
    },

    write: (key, text) =>
      enqueue(key, async () => {
        if (!text) {
          // 空草稿 = 清桶。走队列而不是直删,否则已入队的旧写入会在删完后落盘(文件头那个坑)
          safeRemove(kv, key)
          safeRemove(kv, `${key}${UNREADABLE_SUFFIX}`)
          return
        }
        const sealed = await sealVaultText(domain, text, channel)
        // sealed === null ⇒ 这一轮没有可用密钥 ⇒ 写明文(等价改造前),绝不静默丢草稿
        safeWrite(kv, key, sealed ?? text)
        safeRemove(kv, `${key}${UNREADABLE_SUFFIX}`)
      }),

    remove: (key) =>
      enqueue(key, async () => {
        safeRemove(kv, key)
        safeRemove(kv, `${key}${UNREADABLE_SUFFIX}`)
      }),

    // 桌面端恒返 null:值是密文,同步解不开
    peekSync: () => null,
  }
}

/**
 * 取 window.localStorage。必须 try 包住:部分隐私模式/被禁用的站点下
 * **属性访问本身**就会抛 SecurityError。
 */
function resolveBrowserKv(): DraftKvStore | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * 按域各持一个单例。**不能只用一个**:单例里含 `pendingWrites` 队列与硬编码的域,
 * 共用即等于两族共用一把子密钥且共用一条队列(见 ChatDraftStorageOptions.domain
 * 的纪律说明)。Map 键用域本身,新增域自动各持一份,不需要在这里登记。
 */
const singletons = new Map<VaultDomain, ChatDraftStorage>()

/**
 * 草稿通道的单一入口。惰性建一次并缓存 —— `pendingWrites` 队列必须是**模块级单例**,
 * 否则每次调用新建一个队列就等于没有队列(顺序保证失效),草稿会出现"旧值覆盖新值"。
 */
export function getChatDraftStorage(domain?: VaultDomain): ChatDraftStorage {
  const key = domain ?? 'chat-draft'
  const hit = singletons.get(key)
  if (hit) return hit
  const created = createChatDraftStorage({ kv: resolveBrowserKv(), domain: key })
  singletons.set(key, created)
  return created
}

/** 输入草稿桶(`chat:draft*`)的通道:默认域,等价于 `getChatDraftStorage()` */
export function getPromptDraftStorage(): ChatDraftStorage {
  return getChatDraftStorage('chat-draft')
}

/**
 * prompt-history 桶(`chat:prompt-history*`)的通道:独立域(见 DOMAIN_INFO 注释)。
 * 与草稿面分开的理由和 chat/work-panel 同源 —— 两族的写入时机、生命周期、归因对象都不同,
 * 共用子密钥会让"这段密文是哪一族写的"失去锚点。
 */
export function getPromptHistoryStorage(): ChatDraftStorage {
  return getChatDraftStorage('chat-prompt-history')
}

/**
 * 清草稿桶的便捷出口(发送成功 / 侧问 / 入队等 6 处清稿共用)。
 * 单一出口不是为了省几行,是为了"清桶必须入队"这条不变量只写在文件头一处 ——
 * 过去 6 处各写一遍 `localStorage.removeItem`,任何一处漏改成直删都会让
 * 已发送的草稿复活(见文件头「remove 必须入队」)。
 *
 * 刻意不 await:调用点都是"先清 UI 再干活"的乐观路径,等它没有收益;
 * 顺序由通道内部的队列保证。
 */
export function clearDraft(draftKey: string): void {
  if (typeof window === 'undefined') return
  void getChatDraftStorage().remove(draftKey)
}

/** 仅测试用:清掉单例(测试要注入不同 kv) */
export function __resetChatDraftStorageForTest(): void {
  singletons.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
