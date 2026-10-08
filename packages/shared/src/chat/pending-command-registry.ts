// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816008:待对账命令账本(跨端共享,无端特定依赖)。
 *
 * 故障形态(上游 packages/ui/src/v4/pendingCommandRegistry.ts:120-260 同型):
 * 命令已被服务端 accepted,但 UI 一直等不到对应投影(user row)时,唯一的恢复动作
 * 是整条重发 —— 可能重复副作用。本账本把"已 accepted 但未投影"变成可指认的事实:
 *
 * 1. **TTL 锚定首次登记时间**(上游 :128-129 "TTL 锚定首次登记时间,reload/reconcile
 *    不得续期"):register 对同一 commandId 只保留**最初**的 firstRegisteredAt,
 *    重复登记/重放对账都不得把 TTL 续下去。
 * 2. **queue 投影即接收收据**(上游 :229-254):对账时 queue.items[].sourceCommandId
 *    是**权威接收证据** —— 命中即结算(账本条目消失);查不到 ⇒ **不得静默丢弃**
 *    (反向锁:静默丢等于把"没送到"洗成"没这回事"),必须以 unacknowledged 返回,
 *    由调用方出重发提示。
 * 3. **损坏时清账不阻断聊天**(上游 :337-353):storage 里的 JSON 解析失败/形状不符
 *    ⇒ 清账(移除损坏 blob)并当作空账本,聊天照常可用 —— 账本不得成为聊天的单点。
 *
 * 隐私:记录只存展示用 preview,**不存任何可重放原文**;上游的 sensitiveDigest
 * 永不重放原则在本层以"根本没有原文字段"落实(重发由调用方用既有草稿,不由账本回放)。
 */

/** 账本条目(持久化形状)。 */
export interface PendingCommandRecord {
  /** 客户端命令 id;与 queue 投影条目的 sourceCommandId 对账 */
  commandId: string
  /** 所属会话 */
  conversationId: string
  /** 重发提示展示用预览(非敏感;账本不存原文,永不重放) */
  preview: string
  /** TTL 锚 = 首次登记时间(ms);reload/reconcile 不得续期 */
  firstRegisteredAt: number
}

/** queue 投影条目只需暴露 sourceCommandId(其余字段不关心)。 */
export interface QueueProjectionItem {
  sourceCommandId?: unknown
}

export interface PendingCommandReconcileResult {
  /** queue 命中(权威接收证据)⇒ 已结算,账本中移除 */
  settled: string[]
  /** queue 里查不到 ⇒ 未被接收,调用方必须出重发提示(不得静默丢弃);条目保留在账本 */
  unacknowledged: PendingCommandRecord[]
}

/** 最小同步 storage 接口(localStorage / AsyncStorage 包装 / 内存实现均可)。 */
export interface PendingCommandStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface CreatePendingCommandLedgerOptions {
  storage: PendingCommandStorage
  /** storage key,默认 'ihui-pending-commands' */
  storageKey?: string
  /** 时钟(测试注入);默认 Date.now */
  now?: () => number
  /** TTL(ms),默认 24h;从 firstRegisteredAt 起算 */
  ttlMs?: number
}

export interface PendingCommandLedger {
  /**
   * 登记一条"已 accepted、待投影"的命令。
   * 同一 commandId 重复登记 ⇒ 保留**最初**的 firstRegisteredAt(TTL 锚不得续期)。
   */
  register(command: { commandId: string; conversationId: string; preview: string }): void
  /** 当前有效条目(TTL 过期的顺手清除)。 */
  list(): PendingCommandRecord[]
  /**
   * 与 queue 投影对账:sourceCommandId 命中 ⇒ 结算移除;查不到 ⇒ unacknowledged 返回
   * (条目保留,不得静默丢弃)。
   */
  reconcile(queue: readonly QueueProjectionItem[]): PendingCommandReconcileResult
  /** 清空账本(显式操作;损坏清账走内部路径,不经这里)。 */
  clear(): void
}

export const PENDING_COMMAND_LEDGER_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_STORAGE_KEY = 'ihui-pending-commands'

/** 条目形状校验:不认得的条目静默清掉(上游 :193-197 unknown 静默清账不弹横幅)。 */
function isRecordShape(value: unknown): value is PendingCommandRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['commandId'] === 'string' &&
    v['commandId'].length > 0 &&
    typeof v['conversationId'] === 'string' &&
    typeof v['preview'] === 'string' &&
    typeof v['firstRegisteredAt'] === 'number' &&
    Number.isFinite(v['firstRegisteredAt'])
  )
}

export function createPendingCommandLedger(
  options: CreatePendingCommandLedgerOptions,
): PendingCommandLedger {
  const storage = options.storage
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? PENDING_COMMAND_LEDGER_TTL_MS

  /** 读账本:损坏 ⇒ 清账并返回空(聊天仍可用,不让账本成为单点)。 */
  const load = (): PendingCommandRecord[] => {
    let raw: string | null
    try {
      raw = storage.getItem(storageKey)
    } catch {
      return []
    }
    if (!raw) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try {
        storage.removeItem(storageKey)
      } catch {
        // 清不掉也当作空账本,绝不向上抛
      }
      return []
    }
    if (!Array.isArray(parsed)) {
      try {
        storage.removeItem(storageKey)
      } catch {
        // 同上
      }
      return []
    }
    // 形状不符的条目静默清掉;写不回去(理论不可达,storage 异常)也按空账本继续
    const valid = parsed.filter(isRecordShape)
    if (valid.length !== parsed.length) {
      try {
        save(valid)
      } catch {
        // ignore
      }
    }
    return valid
  }

  const save = (records: PendingCommandRecord[]): void => {
    try {
      if (records.length === 0) {
        storage.removeItem(storageKey)
      } else {
        storage.setItem(storageKey, JSON.stringify(records))
      }
    } catch {
      // 写失败不得阻断聊天(账本只是辅助对账,不是聊新的单点)
    }
  }

  /** TTL 过滤 + 顺手清除过期条目。 */
  const listActive = (): PendingCommandRecord[] => {
    const records = load()
    const active = records.filter((r) => now() - r.firstRegisteredAt <= ttlMs)
    if (active.length !== records.length) save(active)
    return active
  }

  return {
    register(command) {
      const records = load()
      const existing = records.find((r) => r.commandId === command.commandId)
      if (existing) {
        // TTL 锚定首次登记时间:重复登记不续期,只允许更新展示预览
        existing.preview = command.preview
        existing.conversationId = command.conversationId
        save(records)
        return
      }
      records.push({ ...command, firstRegisteredAt: now() })
      save(records)
    },

    list() {
      return listActive()
    },

    reconcile(queue) {
      const records = listActive()
      // queue.items[].sourceCommandId 是权威接收证据;只认 string 形态的命中
      const received = new Set<string>()
      for (const item of queue) {
        const id = item?.sourceCommandId
        if (typeof id === 'string' && id.length > 0) received.add(id)
      }
      const settled: string[] = []
      const unacknowledged: PendingCommandRecord[] = []
      const remaining: PendingCommandRecord[] = []
      for (const record of records) {
        if (received.has(record.commandId)) {
          settled.push(record.commandId)
        } else {
          // 查不到 ⇒ 不得静默丢弃:返回给调用方出重发提示,条目保留到 TTL 或下次对账
          unacknowledged.push(record)
          remaining.push(record)
        }
      }
      if (settled.length > 0) save(remaining)
      return { settled, unacknowledged }
    },

    clear() {
      save([])
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
