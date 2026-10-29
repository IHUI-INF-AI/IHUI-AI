// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「已 accepted 未投影」的端内接线(web 腿)—— `@ihui/shared/chat/pending-command-registry` 的消费者。
 *
 * 判据**全部**在共享层:TTL 锚定首次登记(重复登记不续期)、receipt 对账(命中即结算)、
 * "查不到不得静默丢弃"三条都由 `createPendingCommandLedger` 实现。本文件只做两件端内才有的事:
 * ① 给共享账本一个 web 侧同步 storage(localStorage 不可用 ⇒ 内存降级,只吞不抛);
 * ② 把"同一条指令"映射成稳定 commandId、把"投影到了没有"映射成 receipt,再接成发送准入判定。
 *
 * ## 为什么不是在途锁(`sendInFlightRef` / `isStreaming`)的重复实现
 * 在途锁拦的是**同一时刻两条流**,流一收尾必然释放。而"已 accepted 未投影"的窗口恰恰
 * **在收尾之后**:请求已经发出去、服务端可能已经执行,但客户端一个确认都没有(断链 / 超时 /
 * 页面死在半路)。那时在途锁早已放开、界面也看不出结果 —— 用户再发一次同一条,服务端就执行两遍。
 * 两把尺子量的是两个时间段,不是重复。
 *
 * ## 为什么不是"内容相同就拒绝"
 * 用户**合法地**可以连发两条一模一样的消息(过一会儿再问一遍)。所以判据不是内容相同,而是账本:
 * - 账本里**仍有**这条 commandId 且**投影没到** ⇒ 拦(这是"上一次可能已经在服务端执行了");
 * - 上一次已有确证结局(答了 / 服务端明确拒了 / 用户自己停了)⇒ 收尾已结算 ⇒ 放行。
 * 于是"重复点击同一条"与"真的要发两条一样的消息"在数据上自然分开,不需要任何启发式阈值。
 *
 * ## receipt = 本轮真的答出了东西
 * 共享层的 receipt 语义是"队列投影命中 sourceCommandId"。端内对应的投影面就是转写本身:
 * **最后一条同文用户消息之后出现了一条非失败、非空的 assistant 行** ⇒ 那条指令的投影到了。
 * 这条配对规则同时给出跨刷新的正确结局:页面死在半路 ⇒ 用户消息可能已落库、但后面没有答案
 * ⇒ 不构成 receipt ⇒ 仍然拦(那正是要拦的一格);正常答完 ⇒ 有答案 ⇒ 放行(合法重发)。
 *
 * ## 失效方向
 * 拿不准一律**留条目**(拦一次 + 定向说明 + 一键人工放行),绝不放过去:
 * 多要一次说明的代价,远小于把重复副作用放到线上。共享层 TTL(24h)保证不是永久锁。
 */

import {
  createPendingCommandLedger,
  type PendingCommandLedger,
  type PendingCommandRecord,
  type PendingCommandStorage,
} from '@ihui/shared/chat/pending-command-registry'

/** 账本键:与共享层缺省一致 —— 换端(未来 RN / 小程序)读同一份 */
const STORAGE_KEY = 'ihui-pending-commands'

/** preview 只做"是哪条指令"的展示,不含可重放原文(账本本来就不存原文) */
const PREVIEW_MAX = 80

/** 判定 receipt 所需的最小转写行形状(`ChatMessage` 天然满足) */
export interface ProjectionRow {
  readonly role: string
  readonly content: string
  readonly error?: boolean
}

/**
 * web storage 适配:localStorage 可用则直连;隐私模式 / 配额 / SSR 时退到内存。
 * 只吞不抛 —— 账本只是辅助对账,绝不成为聊天的单点(与共享层同一失效方向)。
 * 双写内存是刻意的:localStorage 在中途失效时,本次会话内仍认得出"上一次没确认"。
 */
function createWebPendingStorage(): PendingCommandStorage {
  const memory = new Map<string, string>()
  const local = (): Storage | null => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage ?? null
    } catch {
      return null
    }
  }
  return {
    getItem: (key) => {
      const store = local()
      if (!store) return memory.get(key) ?? null
      try {
        return store.getItem(key)
      } catch {
        return memory.get(key) ?? null
      }
    },
    setItem: (key, value) => {
      memory.set(key, value)
      const store = local()
      if (!store) return
      try {
        store.setItem(key, value)
      } catch {
        // 配额 / 隐私模式:内存那份本次会话仍生效,只是不跨刷新
      }
    },
    removeItem: (key) => {
      memory.delete(key)
      const store = local()
      if (!store) return
      try {
        store.removeItem(key)
      } catch {
        // 同上
      }
    },
  }
}

/** 指令规范化:与 `sendMessage` 入口的 `content.trim()` 同一把尺子 */
function normalizeInstruction(text: string): string {
  return text.trim()
}

/**
 * FNV-1a 32 位(两个不同初值各算一遍,拼成 64 位量级的指纹)。
 * 同步、零 crypto 依赖 —— 发送入口的准入判定是同步的,不能为了算 id 先 await。
 */
function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * 同一条指令的稳定身份 = 会话 + 规范化正文指纹。
 *
 * - **不含时间戳**:同一句话在同一次未确认窗口里必须是同一个 id,否则拦不住重复点击;
 * - **不含 messageId**:每次点击都会新造消息 id,拿它当身份等于永远不撞;
 * - **含会话**:不同会话里说同一句话互不相干。
 */
export function commandIdOf(conversationId: string, text: string): string {
  const body = normalizeInstruction(text)
  const digest = `${fnv1a(body, 0x811c9dc5)}${fnv1a(body, 0x050c5d1f)}${body.length.toString(16)}`
  return `${conversationId}#${digest}`
}

/**
 * 投影收据:最后一条同文用户消息**之后**是否已有一条非失败、非空的 assistant 行。
 *
 * 只看"最后一条"是有意的 —— 同一句话可以合法地发过多次,关心的是最近那一次有没有答出来。
 * 失败行(`error === true`)不算收据:它的 content 是错误文案,不是答案。
 */
export function hasProjectedAnswer(rows: readonly ProjectionRow[], text: string): boolean {
  const target = normalizeInstruction(text)
  if (!target) return false
  let lastUser = -1
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (row && row.role === 'user' && normalizeInstruction(row.content) === target) {
      lastUser = i
      break
    }
  }
  if (lastUser === -1) return false
  return rows
    .slice(lastUser + 1)
    .some(
      (row) =>
        row.role === 'assistant' && row.error !== true && (row.content ?? '').trim().length > 0,
    )
}

/** 账本单例(整页一份;换会话不重置 —— 条目自带 conversationId) */
let ledgerSingleton: PendingCommandLedger | null = null

function ledger(): PendingCommandLedger {
  if (!ledgerSingleton) {
    ledgerSingleton = createPendingCommandLedger({
      storage: createWebPendingStorage(),
      storageKey: STORAGE_KEY,
    })
  }
  return ledgerSingleton
}

export interface PendingSendClaim {
  /** true = 放行(已登记);false = 拦下(同一指令仍有未确认的一条) */
  readonly allowed: boolean
  /** 本条的 commandId(恒有值;拦下时也可直接交给 settle,查不到即空操作) */
  readonly commandId: string
  /** 拦下时:那条未确认记录的现值(供提示取 preview / 时间) */
  readonly record?: PendingCommandRecord
}

/**
 * 发送准入。调用点:conversationId 已解析、用户消息尚未入 store 之前。
 *
 * @param rows       当前转写(投影面)。用于判"上一次那条到底答出来了没有"。
 * @param force      人工放行(UI 给出定向说明后的显式"仍要发送"):
 *                   先结算旧条目再重新登记 —— 这是一次**新**登记,TTL 锚点随之重算(不是续期)。
 */
export function claimPendingSend(input: {
  conversationId: string
  text: string
  rows: readonly ProjectionRow[]
  force?: boolean
}): PendingSendClaim {
  const { conversationId, text, rows } = input
  const book = ledger()
  const commandId = commandIdOf(conversationId, text)

  // ① 投影已到 ⇒ 上一次那条已被接收(结算掉)。这是"合法重发"能通过的唯一依据。
  if (hasProjectedAnswer(rows, text)) {
    book.reconcile([{ sourceCommandId: commandId }])
  }

  // ② 仍在账本里 = 已发出、没看到投影
  const existing = book.list().find((r) => r.commandId === commandId)
  if (existing && input.force !== true) {
    return { allowed: false, commandId, record: existing }
  }
  if (existing) {
    // 人工放行:先经 reconcile 结算旧条目(reconcile 是唯一结算口,不直接改 storage)
    book.reconcile([{ sourceCommandId: commandId }])
  }

  book.register({
    commandId,
    conversationId,
    preview: normalizeInstruction(text).slice(0, PREVIEW_MAX),
  })
  return { allowed: true, commandId }
}

/**
 * 结算(本轮有了确证结局:答了 / 服务端明确拒了 / 用户自己停了)。
 * 未登记过的 id 是空操作(reconcile 不命中即不写盘)。
 */
export function settlePendingSend(commandId: string): void {
  ledger().reconcile([{ sourceCommandId: commandId }])
}

/** 该会话当前仍未被确认的条目(TTL 过滤后的现值;诊断 / 提示用) */
export function listPendingSends(conversationId: string): PendingCommandRecord[] {
  return ledger()
    .list()
    .filter((r) => r.conversationId === conversationId)
}

export const __test__ = {
  STORAGE_KEY,
  normalizeInstruction,
  fnv1a,
  createWebPendingStorage,
  /** 测试间重置单例(共享账本本身无状态,单例只缓存 storage 适配与默认键) */
  resetLedgerSingleton: (): void => {
    ledgerSingleton = null
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
