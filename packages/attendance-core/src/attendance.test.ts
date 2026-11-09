// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect } from 'vitest'
import { judgeStatus, judgeStatusDetailed, hmOfLocalDate, normalizeHm } from './index.js'
import {
  isPastHm,
  resolveBackfillDays,
  buildBizDayWindow,
  dayFloorOf,
  absentCandidatePairsForRule,
  buildScopeScheduleGates,
  gateDueDates,
  weekdayOfBizDayKey,
} from './algorithm.js'

describe('normalizeHm', () => {
  it('补零 9:00 -> 09:00', () => expect(normalizeHm('9:00')).toBe('09:00'))
  it('吃 HH:MM:SS(截断到分)', () => expect(normalizeHm('18:30:00')).toBe('18:30'))
  it('越界返回 null', () => {
    expect(normalizeHm('25:00')).toBeNull()
    expect(normalizeHm('18:60')).toBeNull()
  })
  it('非字符串/非法返回 null', () => {
    expect(normalizeHm('abc')).toBeNull()
    expect(normalizeHm(123)).toBeNull()
  })
})

describe('judgeStatus', () => {
  const t = (hm: string) => new Date(`2026-01-05T${hm}:00+08:00`)
  it('无签到 => absent', () => expect(judgeStatus({})).toBe('absent'))
  it('有签到无阈值 => present', () => expect(judgeStatus({ checkInTime: t('09:00') })).toBe('present'))
  it('迟到', () => {
    const r = judgeStatusDetailed({ lateAfter: '09:00', checkInTime: t('09:30') })
    expect(r.status).toBe('late')
  })
  it('未迟到', () => expect(judgeStatus({ lateAfter: '09:00', checkInTime: t('08:30') })).toBe('present'))
  it('早退', () =>
    expect(judgeStatus({ earlyBefore: '18:00', checkInTime: t('09:00'), checkOutTime: t('17:30') })).toBe(
      'early',
    ))
  it('阈值非法 => unjudged(present)', () => {
    const r = judgeStatusDetailed({ lateAfter: '99:99', checkInTime: t('09:30') })
    expect(r.status).toBe('present')
    expect(r.reason.startsWith('unjudged:')).toBe(true)
  })
  it('早退维缺签退不参与', () =>
    expect(judgeStatus({ earlyBefore: '18:00', checkInTime: t('09:00') })).toBe('present'))
})

describe('dayFloorOf', () => {
  it('YYYY-MM-DD 原样', () => expect(dayFloorOf('2026-01-05')).toBe('2026-01-05'))
  it('Date => Shanghai YMD', () => expect(dayFloorOf(new Date('2026-01-05T01:30:00Z'))).toBe('2026-01-05'))
  it('非法 => null', () => expect(dayFloorOf('nope')).toBeNull())
})

describe('isPastHm', () => {
  it('北京 19:00 过 18:30', () =>
    expect(isPastHm('18:30', new Date('2026-01-05T19:00:00+08:00'))).toBe(true))
  it('北京 17:00 未过 18:30', () =>
    expect(isPastHm('18:30', new Date('2026-01-05T17:00:00+08:00'))).toBe(false))
  it('非法阈值 => false', () =>
    expect(isPastHm('99:99', new Date('2026-01-05T19:00:00+08:00'))).toBe(false))
})

describe('resolveBackfillDays', () => {
  it('默认 3', () => expect(resolveBackfillDays(undefined)).toBe(3))
  it('非法回落 + 告警', () => {
    let warned = false
    expect(resolveBackfillDays(-1, () => { warned = true })).toBe(3)
    expect(warned).toBe(true)
  })
  it('越界封顶 30 + 告警', () => {
    let warned = false
    expect(resolveBackfillDays(100, () => { warned = true })).toBe(30)
    expect(warned).toBe(true)
  })
  it('正常透传', () => expect(resolveBackfillDays(5)).toBe(5))
})

describe('buildBizDayWindow', () => {
  const shift = (k: string, d: number) => {
    const dt = new Date(`${k}T00:00:00Z`)
    dt.setUTCDate(dt.getUTCDate() + d)
    return dt.toISOString().slice(0, 10)
  }
  it('含今日 + 回溯,由旧到新', () => {
    expect(buildBizDayWindow('2026-01-05', 2, shift)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05'])
  })
})

describe('absentCandidatePairsForRule', () => {
  it('幂等:已有记录不进候选,下界生效', () => {
    const r = absentCandidatePairsForRule({
      scopeId: 'C1',
      dueDates: ['2026-01-05', '2026-01-06'],
      subjects: [
        { subjectId: 'A', floor: null },
        { subjectId: 'B', floor: null },
      ],
      ruleFloor: null,
      existing: [{ subjectId: 'A', date: '2026-01-05' }],
    })
    expect(r.candidates.map((c) => `${c.subjectId}|${c.date}`).sort()).toEqual([
      'A|2026-01-06',
      'B|2026-01-05',
      'B|2026-01-06',
    ])
    expect(r.existingHits).toBe(1)
  })
  it('下界:主体登记日晚于规则落库日 => 只判登记日及之后', () => {
    const r = absentCandidatePairsForRule({
      scopeId: 'C1',
      dueDates: ['2026-01-04', '2026-01-05', '2026-01-06'],
      subjects: [{ subjectId: 'A', floor: '2026-01-05' }],
      ruleFloor: '2026-01-01',
      existing: [],
    })
    expect(r.candidates.map((c) => c.date)).toEqual(['2026-01-05', '2026-01-06'])
  })
})

describe('buildScopeScheduleGates / gateDueDates', () => {
  it('gated 只留星期几(周一/周三)', () => {
    const { gates } = buildScopeScheduleGates({
      scopeIds: ['S1'],
      rows: [
        { scopeId: 'S1', weekday: 1 },
        { scopeId: 'S1', weekday: 3 },
      ],
    })
    const g = gates.get('S1')!
    expect(g.state).toBe('gated')
    // 2026-01-05 周一 / 01-06 周二 / 01-07 周三
    const due = gateDueDates(['2026-01-05', '2026-01-06', '2026-01-07'], g)
    expect(due.dates).toEqual(['2026-01-05', '2026-01-07'])
    expect(due.gatedOut).toEqual(['2026-01-06'])
  })
  it('no-schedule 全放行', () => {
    const { gates } = buildScopeScheduleGates({ scopeIds: ['S1'], rows: [] })
    expect(gates.get('S1')!.state).toBe('no-schedule')
    expect(gateDueDates(['2026-01-05'], gates.get('S1')).dates).toEqual(['2026-01-05'])
  })
  it('unjudged(weekday 非法) 全放行', () => {
    const { gates } = buildScopeScheduleGates({ scopeIds: ['S1'], rows: [{ scopeId: 'S1', weekday: 99 }] })
    expect(gates.get('S1')!.state).toBe('unjudged')
    expect(gateDueDates(['2026-01-05'], gates.get('S1')).dates).toEqual(['2026-01-05'])
  })
})

describe('weekdayOfBizDayKey', () => {
  it('1=周一..7=周日', () => {
    expect(weekdayOfBizDayKey('2026-01-05')).toBe(1) // 周一
    expect(weekdayOfBizDayKey('2026-01-04')).toBe(7) // 周日
  })
  it('畸形 => null', () => expect(weekdayOfBizDayKey('nope')).toBeNull())
})

describe('hmOfLocalDate', () => {
  it('补零 HH:MM / 非法 null', () => {
    expect(hmOfLocalDate(new Date('2026-01-05T09:05:00+08:00'))).toBe('09:05')
    expect(hmOfLocalDate(null)).toBeNull()
    // 非 Date 入参靠运行时守卫兜住(JS 调用方可能透传脏值),类型面用断言表达"故意越界"
    expect(hmOfLocalDate('x' as unknown as Date)).toBeNull()
  })
})
