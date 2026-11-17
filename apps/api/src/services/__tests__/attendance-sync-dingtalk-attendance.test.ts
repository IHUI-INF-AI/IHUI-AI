// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钉钉考勤数据源 provider 钉子(2026-11-17 立)。
 *
 * 钉住 design §7.4 的新口径 —— 审批三类不走审批实例接口,改走:
 *   · 请假:topapi/attendance/getleavestatus(duration_percent/duration_unit/leave_code)
 *          + topapi/attendance/vacation/type/list(leave_code → 假别名)
 *   · 加班/外出/出差:topapi/attendance/getcolumnval(考勤报表列值,按人按日)
 *     列 id 由 getattcolumns 按 alias 解析,解析不到用兜底常量。
 *
 * 边界纪律:0/空串列值不出行(报表对无记录日返回 "0.0"/"");无映射的 userid 跳过;
 * 假别映射缺失时 typeText 留 null(不猜);时长单位 percent_day→天、percent_hour→小时。
 */

import { describe, expect, it } from 'vitest'

import {
  APPROVAL_COLUMN_ALIAS,
  columnDateSlices,
  mapColumnValuesToRows,
  mapLeaveStatusToRows,
  monthRangeMs,
  msToDate,
  pickApprovalColumns,
} from '../attendance-sync/dingtalk-provider.js'

describe('columnDateSlices:考勤报表列值窗口 ≤30 天', () => {
  it('30 天月份一窗覆盖 1..30', () => {
    expect(columnDateSlices('2026-11')).toEqual([
      { from: '2026-11-01 00:00:00', to: '2026-11-30 23:59:59' },
    ])
  })

  it('31 天月份切成两窗(1..30 + 31)', () => {
    const slices = columnDateSlices('2026-12')
    expect(slices).toHaveLength(2)
    expect(slices[0]).toEqual({ from: '2026-12-01 00:00:00', to: '2026-12-30 23:59:59' })
    expect(slices[1]).toEqual({ from: '2026-12-31 00:00:00', to: '2026-12-31 23:59:59' })
  })
})

describe('monthRangeMs:请假状态查询的毫秒区间', () => {
  it('起点为当月 1 日 0 点、终点为次月 1 日 0 点前 1 毫秒(本地时区)', () => {
    const { startMs, endMs } = monthRangeMs('2026-11')
    expect(msToDate(startMs)).toBe('2026-11-01')
    expect(msToDate(endMs)).toBe('2026-11-30')
    expect(endMs - startMs).toBeGreaterThan(29 * 24 * 3600 * 1000)
    expect(endMs - startMs).toBeLessThan(31 * 24 * 3600 * 1000)
  })
})

describe('pickApprovalColumns:按 alias 解析列 id', () => {
  it('保留有 id 的审批类列,丢弃无 id / 无 alias / 非审批类列', () => {
    const picked = pickApprovalColumns([
      { id: 1220189021, alias: APPROVAL_COLUMN_ALIAS.overtimeWorkday, name: '工作日加班' },
      { id: 1220189017, alias: APPROVAL_COLUMN_ALIAS.businessTrip, name: '出差时长' },
      // 请假明细列:有 alias 无 id → 不可取,丢弃
      { alias: 'leave_', name: '事假' },
      // 无 alias → 丢弃
      { id: 1220189001, name: '应出勤天数' },
      // 非审批类 alias → 丢弃
      { id: 1220189006, alias: 'attendance_work_time', name: '工作时长' },
    ])
    expect(picked.get(APPROVAL_COLUMN_ALIAS.overtimeWorkday)).toEqual({
      id: 1220189021,
      name: '工作日加班',
    })
    expect(picked.get(APPROVAL_COLUMN_ALIAS.businessTrip)).toEqual({
      id: 1220189017,
      name: '出差时长',
    })
    expect(picked.has('leave_')).toBe(false)
    expect(picked.size).toBe(2)
  })
})

describe('mapColumnValuesToRows:加班列(天)', () => {
  const column = { id: 1220189021, name: '工作日加班' }

  it('只输出正值日期,0.0 与空串不出行', () => {
    const rows = mapColumnValuesToRows('overtime', 'E001', {
      column_vals: [
        { date: '2026-11-02 00:00:00', value: '0.0' },
        { date: '2026-11-03 00:00:00', value: '' },
        { date: '2026-11-04 00:00:00', value: '0.5' },
      ],
      column_vo: { id: 1220189021 },
    }, column)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      employeeNo: 'E001',
      date: '2026-11-04',
      typeText: '加班(工作日加班)',
      durationText: '0.5天',
      totalDays: '0.5',
      externalId: 'report:1220189021:2026-11-04',
    })
  })
})

describe('mapColumnValuesToRows:外出/出差', () => {
  it('出差列按天,外出列按小时', () => {
    const trip = mapColumnValuesToRows('outgoing', 'E002', {
      column_vals: [{ date: '2026-11-05 00:00:00', value: '2.0' }],
      column_vo: { id: 1220189017 },
    }, { id: 1220189017, name: '出差时长' })
    expect(trip[0]).toMatchObject({
      typeText: '出差',
      durationText: '2天',
      totalDays: '2',
    })

    const out = mapColumnValuesToRows('outgoing', 'E002', {
      column_vals: [{ date: '2026-11-06 00:00:00', value: '1.5' }],
      column_vo: { id: 1220189018 },
    }, { id: 1220189018, name: '外出时长' })
    expect(out[0]).toMatchObject({
      typeText: '外出',
      durationText: '1.5小时',
      totalDays: null,
    })
  })
})

describe('mapLeaveStatusToRows:请假状态', () => {
  const useridMap = new Map([['user-1', 'E100']])
  const leaveNames = new Map([['code-annual', '年假']])

  it('percent_day 100 → 1 天,totalDays 记 "1",假别按 leave_code 映射', () => {
    const rows = mapLeaveStatusToRows(
      [
        {
          userid: 'user-1',
          start_time: new Date(2026, 10, 3, 9, 0, 0, 0).getTime(),
          end_time: new Date(2026, 10, 3, 18, 0, 0, 0).getTime(),
          duration_percent: 100,
          duration_unit: 'percent_day',
          leave_code: 'code-annual',
        },
      ],
      useridMap,
      leaveNames,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      employeeNo: 'E100',
      date: '2026-11-03',
      endDate: '2026-11-03',
      checkInTime: '09:00',
      checkOutTime: '18:00',
      typeText: '年假',
      durationText: '1天',
      totalDays: '1',
      statusText: '已通过',
    })
    expect(rows[0]?.externalId).toContain('leave:user-1:')
  })

  it('percent_hour 650 → 6.5 小时,totalDays 留 null(不换算天)', () => {
    const rows = mapLeaveStatusToRows(
      [
        {
          userid: 'user-1',
          start_time: new Date(2026, 10, 4, 13, 30, 0, 0).getTime(),
          end_time: new Date(2026, 10, 4, 20, 0, 0, 0).getTime(),
          duration_percent: 650,
          duration_unit: 'percent_hour',
        },
      ],
      useridMap,
      new Map(),
    )
    expect(rows[0]).toMatchObject({
      durationText: '6.5小时',
      totalDays: null,
    })
    // 无 leave_code / 无映射 → 假别不猜,保持 null
    expect(rows[0]?.typeText).toBeNull()
  })

  it('userid 无工号映射 → 跳过该条(不臆造工号)', () => {
    const rows = mapLeaveStatusToRows(
      [
        {
          userid: 'unknown-user',
          start_time: new Date(2026, 10, 3, 9, 0, 0, 0).getTime(),
          duration_percent: 100,
          duration_unit: 'percent_day',
        },
      ],
      useridMap,
      leaveNames,
    )
    expect(rows).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
