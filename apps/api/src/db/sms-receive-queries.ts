// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信接码历史台账读写(管理员短信接码 /admin/sms-receive)。
 * 收码成功时路由层落一条流水;取号后按号码回查历史,回答
 * "这个号接过哪些平台的码/是否已注册过"(register=新号,login=已注册过)。
 */

import { count, desc, eq } from 'drizzle-orm'
import { db } from './index.js'
import { smsReceiveHistory, smsRelatedSnapshots, type SmsReceiveHistory } from '@ihui/database'
// 用途词汇表的唯一持有者是分类器所在的服务层;这里只 import 它,不再抄第二份字面量联合。
import { toSmsUsageKind, type SmsUsageKind } from '../services/d1jiema-service.js'

export interface RecordSmsReceivedInput {
  phone: string
  keyword?: string
  platform?: string
  usageKind: SmsUsageKind
  smsCode?: string
  smsRaw: string
}

/** 收码成功 → 落一条台账流水(写库失败不抛,台账缺失不应影响取码主流程) */
export async function recordSmsReceived(input: RecordSmsReceivedInput): Promise<void> {
  try {
    await db.insert(smsReceiveHistory).values({
      phone: input.phone,
      keyword: input.keyword,
      platform: input.platform,
      usageKind: input.usageKind,
      smsCode: input.smsCode,
      smsRaw: input.smsRaw,
    })
  } catch (e) {
    console.error('[sms-receive] 台账写入失败(不影响取码响应):', e)
  }
}

/** 查某号码的接码历史(倒序,默认最近 20 条) */
export async function getPhoneHistory(phone: string, limit = 20): Promise<SmsReceiveHistory[]> {
  return db
    .select()
    .from(smsReceiveHistory)
    .where(eq(smsReceiveHistory.phone, phone))
    .orderBy(desc(smsReceiveHistory.receivedAt))
    .limit(Math.min(Math.max(limit, 1), 100))
}

/** 查某号码的本地台账全量条数(不受最近 N 条截断,用于「本机累计使用 K 次」) */
export async function getPhoneHistoryCount(phone: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(smsReceiveHistory)
    .where(eq(smsReceiveHistory.phone, phone))
  return rows[0]?.n ?? 0
}

/** 平台 × 用途计数行(group-by 全量,不受最近 20 条截断) */
export interface PhonePlatformStatRow {
  platform: string | null
  usageKind: SmsUsageKind
  count: number
}

/**
 * 查某号码本地台账的「平台 × 用途」计数(2026-10-09 机主要求:分平台显示登录/注册具体数)。
 * 全量 group-by:台账 items 只回最近 20 条,直接在前端数会漏历史,统计必须在 SQL 层做。
 */
export async function getPhoneHistoryPlatformStats(
  phone: string,
): Promise<PhonePlatformStatRow[]> {
  const rows = await db
    .select({
      platform: smsReceiveHistory.platform,
      usageKind: smsReceiveHistory.usageKind,
      n: count(),
    })
    .from(smsReceiveHistory)
    .where(eq(smsReceiveHistory.phone, phone))
    .groupBy(smsReceiveHistory.platform, smsReceiveHistory.usageKind)
  return rows.map((r) => ({
    platform: r.platform,
    usageKind: toSmsUsageKind(r.usageKind),
    count: Number(r.n),
  }))
}

// ── 平台 relatedMsgs 快照累积(2026-10-09):唯一能超越平台 12 条滚动窗口的全局热度口径 ──

/** 平台时间线记录的查询层最小形态(与服务层 RelatedMsgRecord 同形,避免跨层依赖) */
export interface RelatedSnapshotInput {
  time: string
  flag: string
}

/**
 * 把一次 relatedMsgs 查询的窗口快照逐条抄进本地(幂等,冲突忽略)。
 * 归位规则:平台只给 HH:MM 无日期,记录时刻晚于当前时刻 = 昨日(跨日滚动窗口连续化)。
 * 返回本次新入库条数(0 = 全部已在库,窗口无新增)。
 */
export async function snapshotRelatedMsgs(
  phone: string,
  records: RelatedSnapshotInput[],
): Promise<number> {
  if (records.length === 0) return 0
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  const values = records.map((r) => ({
    phone,
    recDate: r.time > nowHHMM ? yesterday : today,
    recTime: r.time,
    flag: r.flag,
  }))
  const inserted = await db
    .insert(smsRelatedSnapshots)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: smsRelatedSnapshots.id })
  return inserted.length
}

/** 查某号码快照累积的全局被接码总数(跨快照并集,单调不减,可超越平台 12 条) */
export async function getRelatedUnionCount(phone: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(smsRelatedSnapshots)
    .where(eq(smsRelatedSnapshots.phone, phone))
  return rows[0]?.n ?? 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
