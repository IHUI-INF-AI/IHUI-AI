// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤写接口端侧契约的用例册(edu-mgmt-attendance/contract.ts 的镜像测试)。
 *
 * 判的是 2026-11 后端收口后的三条真不变量,每条都能被破坏、破了就红:
 *  ① 三个写载荷**结构上不含 status** —— 状态由服务端按该班 edu_attendance_rule 现算,
 *     客户端自报的那一句在账面等于"把被规则判成迟到的人写成出勤"(键集用运行时 Object.keys 量,
 *     不靠源码字面量对账)。
 *  ② 回填非当日必须同批给出该日内时刻:缺时刻 ⇒ 构造不出载荷 ⇒ 请求根本不发出去
 *     (失效方向是"多要一次说明",不是"打过去吃 400");给出的时刻折回上海业务日
 *     必须仍等于所选 date —— 这条用页面同一个取值出口 `@/utils/time` 现算,不复算第二把尺(§22c)。
 *  ③ 状态展示词表五档齐(present/late/early/absent/leave)且逐档有色档与类名:
 *     `early` 自签退重判落地后**真的会出现在列表里**,漏一格就是拿灰字糊弄一条判定结果。
 */
import { describe, it, expect } from 'vitest'
import {
  __test__ as C,
  // 直接 import 生产出口,不在本册复刻任何判据(AGENTS §22c)
  buildBatchPayload,
  buildCheckInPayload,
  buildCheckOutPayload,
} from '../src/pkg-user/edu-mgmt-attendance/contract'
import { formatDate } from '../src/utils/time'

const TODAY = '2026-11-08'
const PAST = '2026-11-05'

describe('写载荷不含 status', () => {
  it('① 当日代签:只交归属三件 + 方式,既不报 status 也不报时刻(时刻由服务器落)', () => {
    const p = buildCheckInPayload({
      studentId: 's1',
      classId: 'c1',
      date: TODAY,
      hm: '',
      today: TODAY,
    })
    expect(p).toEqual({
      studentId: 's1',
      classId: 'c1',
      date: TODAY,
      checkInMethod: 'manual',
    })
    expect(Object.keys(p ?? {})).not.toContain('status')
  })

  it('①b 整班点名同样不报 status,也不报 studentIds(名单唯一来源是在册学生)', () => {
    const p = buildBatchPayload({ classId: 'c1', date: TODAY, hm: '', today: TODAY })
    expect(p).toEqual({ classId: 'c1', date: TODAY })
    const keys = Object.keys(p ?? {})
    expect(keys).not.toContain('status')
    expect(keys).not.toContain('studentIds')
  })

  it('①c 签退:交归属三件 + 方式;签退后的重判由服务端做,端上不猜下一档状态', () => {
    const p = buildCheckOutPayload({ studentId: 's1', classId: 'c1', date: PAST })
    expect(p).toEqual({
      studentId: 's1',
      classId: 'c1',
      date: PAST,
      checkOutMethod: 'manual',
    })
    expect(Object.keys(p)).not.toContain('status')
  })
})

describe('回填必须给同日内具体时刻', () => {
  it('② 非当日 + 没给时刻 ⇒ 构造不出载荷(代签与点名同口径)', () => {
    expect(
      buildCheckInPayload({ studentId: 's1', classId: 'c1', date: PAST, hm: '', today: TODAY }),
    ).toBeNull()
    expect(buildBatchPayload({ classId: 'c1', date: PAST, hm: '', today: TODAY })).toBeNull()
    expect(C.needsExplicitMoment(PAST, TODAY)).toBe(true)
    expect(C.backfillBlocked(PAST, TODAY, '')).toBe(true)
    // 当日不需要时刻,也不该被拦
    expect(C.backfillBlocked(TODAY, TODAY, '')).toBe(false)
  })

  it('②b 给了时刻 ⇒ 折回上海业务日仍等于所选 date(用页面同一个取值出口验,不复算时区)', () => {
    const p = buildCheckInPayload({
      studentId: 's1',
      classId: 'c1',
      date: PAST,
      hm: '08:30',
      today: TODAY,
    })
    expect(p?.checkInTime).toBe(`${PAST}T08:30:00+08:00`)
    expect(formatDate(p?.checkInTime ?? '', 'YYYY-MM-DD')).toBe(PAST)
    expect(formatDate(p?.checkInTime ?? '', 'HH:mm')).toBe('08:30')
    // 点名走同一个时刻
    expect(buildBatchPayload({ classId: 'c1', date: PAST, hm: '08:30', today: TODAY })).toEqual({
      classId: 'c1',
      date: PAST,
      checkInTime: `${PAST}T08:30:00+08:00`,
    })
  })

  it('②c 当日也可显式给时刻(补签今日早些时候),时刻仍折回今天', () => {
    const p = buildCheckInPayload({
      studentId: 's1',
      classId: 'c1',
      date: TODAY,
      hm: '07:05',
      today: TODAY,
    })
    expect(formatDate(p?.checkInTime ?? '', 'YYYY-MM-DD')).toBe(TODAY)
    expect(formatDate(p?.checkInTime ?? '', 'HH:mm')).toBe('07:05')
  })

  it('②d 形状不合法一律 null(不回落 now、不猜):坏日期 / 坏时刻 / 钟面上不存在的时刻', () => {
    const base = { studentId: 's1', classId: 'c1', hm: '08:30', today: TODAY }
    expect(buildCheckInPayload({ ...base, date: '2026-11-8' })).toBeNull()
    expect(buildCheckInPayload({ ...base, date: '' })).toBeNull()
    expect(buildCheckInPayload({ ...base, date: PAST, hm: '8:30' })).toBeNull()
    expect(C.checkInMomentIso(PAST, '25:00')).toBeNull()
    expect(C.checkInMomentIso(PAST, '24:00')).toBeNull()
    expect(C.checkInMomentIso(PAST, '08:60')).toBeNull()
    expect(C.checkInMomentIso('', '08:30')).toBeNull()
    // 越界时刻不该把写按钮从"禁用"翻成"可点"
    expect(C.backfillBlocked(PAST, TODAY, '25:00')).toBe(true)
    expect(C.backfillBlocked(PAST, TODAY, '07:30')).toBe(false)
  })
})

describe('状态词表与色档', () => {
  it('③ 五档全在册,early 有色档(签退重判后它真会出现)', () => {
    expect([...C.ATTENDANCE_STATUS_CODES]).toEqual(['present', 'late', 'early', 'absent', 'leave'])
    for (const code of C.ATTENDANCE_STATUS_CODES) {
      expect(C.STATUS_TONES[code]).toBeTruthy()
      expect(C.TONE_CLASS[C.STATUS_TONES[code]]).toBeTruthy()
    }
    expect(C.statusToneOf('early')).toBe('warn')
    expect(C.statusToneOf('present')).toBe('ok')
    expect(C.statusToneOf('absent')).toBe('danger')
  })

  it('③b 词表外的状态不猜档:落 muted,但仍进计数并如实点名(§0.3)', () => {
    expect(C.statusToneOf('suspended')).toBe('muted')
    expect(
      C.statusTally([{ status: 'early' }, { status: 'early' }, { status: 'suspended' }]),
    ).toEqual([
      { code: 'early', count: 2 },
      { code: 'suspended', count: 1 },
    ])
    // 零计数不出现:页顶那行只报真的有人在此页出现过的状态
    expect(C.statusTally([])).toEqual([])
  })

  it('③c 色档类名只取本端在册用词,不新引色值(design-tokens 里没有 orange ⇒ early 归琥珀)', () => {
    const classes = Object.values(C.TONE_CLASS)
    expect(classes).toContain('text-amber-600')
    expect(classes.some((c) => /orange|#/.test(c))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
