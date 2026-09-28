// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D36 输入草稿 — 共享层纯逻辑(截断上限 / 安全读取 / 防抖常量 / 跨会话桶配额淘汰)。
 *
 * key 分桶由调用方决定(hook 消费 draftKey 字符串,与 prompt-history 同形);
 * 平台特有部分(localStorage / React 状态)留在各端 hook,不进共享层。
 * 契约以 apps/web/src/hooks/use-prompt-drafts.ts 及其测试为准。
 *
 * 淘汰为什么存在:草稿/历史都按 conversationId 分桶(`chat:draft:{id}` /
 * `chat:prompt-history:{id}`),桶值有上限(单项 20000 字符 / 栈 50 条)而**桶数没有**
 * —— 会话只增不减,localStorage 就无界增长。本模块补的是票面验收里"存储配额淘汰"
 * 那一半:纯函数判"该删谁",localStorage 的实际 removeItem 留在各端 hook。
 */

/** 输入变化防抖写入窗口(尾沿,ms) */
export const PROMPT_DRAFT_WRITE_DEBOUNCE_MS = 500

/** 草稿落盘上限(字符):超长截断而非拒存,配额内保最长可用前缀 */
export const PROMPT_DRAFT_MAX_LENGTH = 20000

/** 落盘前截断:非字符串输入兜空串,绝不抛错 */
export function truncatePromptDraft(text: string): string {
  if (typeof text !== 'string') return ''
  return text.length > PROMPT_DRAFT_MAX_LENGTH ? text.slice(0, PROMPT_DRAFT_MAX_LENGTH) : text
}

/** 草稿安全读取:缺失 / 非字符串一律空串,绝不抛错(存储值即纯文本,无 JSON 包裹) */
export function parsePromptDraft(raw: string | null): string {
  return typeof raw === 'string' ? raw : ''
}

// ==================== 跨会话桶配额淘汰(D36 验收"存储配额淘汰") ====================

/**
 * 每族桶数上限(草稿族 / 历史族**各自独立计数**):超出按最后写入时间 LRU 淘汰最旧。
 * 取 50 与 `PROMPT_HISTORY_LIMIT`(栈内 50 条)同量级 —— 单人活跃会话远少于此,
 * 触顶即"长期不回的旧会话",删它们的草稿/历史是可接受代价;真正的活跃桶靠 touch 保命。
 */
export const PROMPT_BUCKET_MAX = 50

/** 桶索引 key:记每个桶最后一次写入的 epochMs(淘汰的 LRU 依据;桶值本身形态不变)。 */
export const PROMPT_BUCKET_INDEX_KEY = 'chat:prompt-bucket-index'

/** 草稿族前缀(`chat:draft` 与 `chat:draft:{id}` 同族)。 */
export const PROMPT_DRAFT_PREFIX = 'chat:draft'

/** 历史族前缀(`chat:prompt-history` 与 `chat:prompt-history:{id}` 同族)。 */
export const PROMPT_HISTORY_PREFIX = 'chat:prompt-history'

/** 桶索引:key → 最后写入时刻(epochMs)。 */
export type PromptBucketIndex = Record<string, number>

/**
 * 索引安全读取:缺失 / 坏 JSON / 非对象 / 值非有限数 ⇒ 一律清洗掉。
 * 返回空对象等价于"没有年龄证据"——配合 planPromptBucketEviction 的 fail-safe,
 * 坏索引最多导致"本轮不淘汰",绝不据坏索引删人草稿(删比留危险,同 §5b 取向)。
 */
export function parsePromptBucketIndex(raw: string | null | undefined): PromptBucketIndex {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: PromptBucketIndex = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/** 记一次桶写入(不可变:返回新对象,调用方负责持久化)。 */
export function touchPromptBucket(
  index: PromptBucketIndex,
  key: string,
  now: number,
): PromptBucketIndex {
  return { ...index, [key]: now }
}

/**
 * 淘汰计划(纯函数,不碰存储):返回该族中应删除的桶 key。
 * 族内桶清单**只来自索引**(存储里存在但索引没有的桶 = 索引引入前的存量,
 * 对它不可见 ⇒ 不会被删,直到它下次写入被 touch 进索引;宁可暂超上限,不据盲删)。
 * - 族内桶数 ≤ max ⇒ 空数组;
 * - 超出 ⇒ 按 touchedAt 升序(最旧先删),同刻按 key 升序定序(序不唯一则"删了谁"不可复现);
 * - **fail-safe**:族内桶一个年龄都判不出(索引被手拼成全非数值)⇒ 返回空数组 ——
 *   "没判"不得写成"判过了删光"。
 */
export function planPromptBucketEviction(
  index: PromptBucketIndex,
  prefix: string,
  max: number = PROMPT_BUCKET_MAX,
): string[] {
  const keys = Object.keys(index).filter((k) => k === prefix || k.startsWith(`${prefix}:`))
  if (keys.length <= max) return []
  const aged = keys.filter((k) => Number.isFinite(index[k]))
  if (aged.length === 0) return []
  const sorted = keys.slice().sort((a, b) => {
    const ta = Number.isFinite(index[a]) ? (index[a] as number) : -1
    const tb = Number.isFinite(index[b]) ? (index[b] as number) : -1
    if (ta !== tb) return ta - tb
    return a < b ? -1 : a > b ? 1 : 0
  })
  return sorted.slice(0, sorted.length - max)
}
