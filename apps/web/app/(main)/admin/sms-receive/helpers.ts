// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 短信接码页面常量与 API 封装 */
import { adminApi } from '@/lib/admin/api'
import type {
  CardType,
  GetPhoneForm,
  MessageData,
  PhoneHistoryItem,
  PhonePlatformStat,
  RelatedMsgItem,
  RelatedMsgsData,
  UsedRecord,
} from './types'

export const API_BASE = '/api/admin/sms-receive'

/** 轮询取码间隔(ms)。平台按请求量计费(每 1000 次扣 0.01~0.2 元),5s 足够快且成本低 */
export const POLL_INTERVAL_MS = 5_000
/** 轮询总时长上限(ms),超时自动停止,防止忘停空烧 */
export const POLL_TIMEOUT_MS = 180_000
/** 历史记录冷却(秒),平台限频 1 次/分钟 */
export const USED_COOLDOWN_SECONDS = 60

/** 近 30 分钟热度统计窗口(ms),台账卡「近 30 分钟热度」格展示用 */
export const HOT_WINDOW_MS = 30 * 60 * 1000
/** 自动筛新号预筛阈值:全局被接码次数(平台 ≤12 条滚动窗口)≥该值 = 被使用多次 → 拉黑换号 */
export const HOT_MIN_RECORDS = 3

export const CARD_TYPES: CardType[] = ['全部', '实卡', '虚卡']

export const EMPTY_GET_PHONE_FORM: GetPhoneForm = {
  keyWord: '',
  phone: '',
  province: '',
  // 默认实卡:虚卡(虚商号段)收码可靠性差,筛 trae 实测 171 虚卡号 5 分钟未收到短信(2026-10-08)
  cardType: '实卡',
}

export async function fetchBalance(): Promise<string> {
  const d = await adminApi<{ balance: string }>(`${API_BASE}/balance`, { method: 'POST' })
  return d.balance
}

export async function fetchPhone(form: GetPhoneForm): Promise<string> {
  const body = JSON.stringify({
    keyWord: form.keyWord || undefined,
    phone: form.phone || undefined,
    province: form.province || undefined,
    cardType: form.cardType,
  })
  const d = await adminApi<{ phone: string }>(`${API_BASE}/phone`, { method: 'POST', body })
  return d.phone
}

export async function fetchMessage(phone: string, keyWord: string): Promise<MessageData> {
  return adminApi<MessageData>(`${API_BASE}/message`, {
    method: 'POST',
    body: JSON.stringify({ phone, keyWord }),
  })
}

export async function releasePhone(phone: string) {
  return adminApi<{ ok: boolean; result?: string }>(`${API_BASE}/release`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function blockPhone(phone: string) {
  return adminApi<{ ok: boolean; result?: string }>(`${API_BASE}/block`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function sendSms(phone: string, toPhone: string, content: string) {
  return adminApi<{ ok: boolean; result?: string }>(`${API_BASE}/send`, {
    method: 'POST',
    body: JSON.stringify({ phone, toPhone, content }),
  })
}

export async function fetchUsed(): Promise<UsedRecord[]> {
  const d = await adminApi<{ items: UsedRecord[] }>(`${API_BASE}/used`)
  return d.items
}

// used 平台限频 1 次/分钟 → 客户端 60s 缓存:自动筛新号连续换号时预筛查询全部走缓存,
// 不打爆平台限频(缓存为空期间查询失败返回 null,fail-open 视为无记录)
let usedCache: { at: number; items: UsedRecord[] } | null = null

/** 取本账号 24h 流水(60s 缓存);缓存过期且查询失败时返回 null(fail-open) */
export async function fetchUsedCached(): Promise<UsedRecord[] | null> {
  if (usedCache && Date.now() - usedCache.at < USED_COOLDOWN_SECONDS * 1000) return usedCache.items
  try {
    const items = await fetchUsed()
    usedCache = { at: Date.now(), items }
    return items
  } catch {
    return usedCache ? usedCache.items : null // 过期缓存也胜过没有:429 冷却期内沿用旧数据
  }
}

/** 预筛:该号码是否出现在本账号 24h 流水里(出现过=近期被本机用过,不是新号) */
export async function lookupUsedHistory(phone: string): Promise<UsedRecord[]> {
  const items = await fetchUsedCached()
  if (!items) return []
  return items.filter((u) => u.phone === phone)
}

/** 查某号码的本地接码台账(items=最近 20 条流水,total=全量条数即本机累计使用次数,platformStats=平台×用途全量计数) */
export async function fetchPhoneHistory(
  phone: string,
): Promise<{ items: PhoneHistoryItem[]; total: number; platformStats: PhonePlatformStat[] }> {
  const d = await adminApi<{
    items: PhoneHistoryItem[]
    total: number
    platformStats: PhonePlatformStat[]
  }>(`${API_BASE}/phone-history?phone=${encodeURIComponent(phone)}`)
  return { items: d.items, total: d.total, platformStats: d.platformStats ?? [] }
}

/** 查平台「号码相关短信」全局时间线(免费、全局号码维度;该号被所有买家收码的记录) */
export async function fetchRelatedMsgs(phone: string): Promise<RelatedMsgItem[]> {
  const d = await adminApi<{ items: RelatedMsgItem[] }>(
    `${API_BASE}/related-msgs?phone=${encodeURIComponent(phone)}`,
  )
  return d.items
}

/**
 * 查平台时间线 + 本地快照累积并集(2026-10-09)。
 * items=平台单次窗口(≤12条,预筛判据口径);totalUnion=跨快照并集总数
 * (可>12,展示口径;快照写库失败=null 降级旧口径,fail-open)。
 */
export async function fetchRelatedMsgsWithUnion(
  phone: string,
): Promise<RelatedMsgsData> {
  return adminApi<RelatedMsgsData>(
    `${API_BASE}/related-msgs?phone=${encodeURIComponent(phone)}`,
  )
}

/**
 * 近 30 分钟热度统计(HOT_WINDOW_MS 窗口内的收码记录数),台账卡「近 30 分钟热度」格展示用。
 * 平台时间线只给 HH:MM 无日期,跨日记录按「解析出未来时间=昨日」归位。
 * 注:自动筛新号预筛的「被使用多次→拉黑」判据已改用全局窗口总数(related.length ≥HOT_MIN_RECORDS),
 * 不再走本函数——近 30 分钟 ≥3 的号必然总数 ≥3,拉黑规则完整覆盖旧「释放跳过」规则。
 */
export function countRecentRecords(items: RelatedMsgItem[]): number {
  const now = Date.now()
  let recent = 0
  for (const it of items) {
    const t = parseHhMm(it.time, now)
    if (t !== null && now - t <= HOT_WINDOW_MS) recent += 1
  }
  return recent
}

/** 解析 HH:MM 为当天时间戳;若落在未来(跨日记录)视为昨日 */
function parseHhMm(time: string, now: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  const d = new Date(now)
  d.setHours(h, min, 0, 0)
  let t = d.getTime()
  if (t - now > 60_000) t -= 24 * 60 * 60 * 1000
  return t
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
