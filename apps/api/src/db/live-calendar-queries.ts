import { eq, and, gte, asc, sql, lte } from 'drizzle-orm'
import { db } from './index.js'
import { liveChannels, type LiveChannel } from '@ihui/database'

export interface FindLiveCalendarOpts {
  page: number
  pageSize: number
  startDate?: Date
  endDate?: Date
}

/**
 * 查询已发布的直播日程（status=1, isPublished=true），按开始时间升序，分页。
 * 可选 startDate/endDate 范围筛选 startTime。
 */
export async function findLiveCalendar(
  opts: FindLiveCalendarOpts,
): Promise<{ list: LiveChannel[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(liveChannels.status, 1), eq(liveChannels.isPublished, true)]
  if (opts.startDate) conds.push(gte(liveChannels.startTime, opts.startDate))
  if (opts.endDate) conds.push(lte(liveChannels.startTime, opts.endDate))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(liveChannels)
      .where(where)
      .orderBy(asc(liveChannels.startTime), asc(liveChannels.sort))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveChannels)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}
