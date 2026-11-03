// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤判定纯函数测试(2026-11-01,ATT-JOB 票)。
 * 全程零 IO、不连库(§5 测试隔离铁律)。
 *
 * AGENTS §22c:镜像测试必须 `import { __test__ }` 直接用生产判据,禁止在测试里
 * 复制一份 normalizeHm/judgeStatus(否则必然漂移,`check-test-judge-not-replicated`
 * blocking 会拦)。
 */
import { describe, expect, it } from 'vitest'

import { __test__ as ruleTest } from '../src/services/edu-attendance-rule.js'
import { __test__ as conflictTest } from '../src/services/edu-schedule-conflict.js'

const { judgeStatus, judgeStatusDetailed, hmOfLocalDate } = ruleTest
const { normalizeHm } = conflictTest

/** 把本地墙钟拼成 Date(避开 TZ) */
const local = (hh: number, mm: number): Date => {
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d
}

describe('judgeStatus 四型:迟到 / 早退 / 正常 / 缺输入', () => {
  it('① 无签到 ⇒ absent(不依赖阈值)', () => {
    expect(judgeStatus({})).toBe('absent')
    expect(judgeStatus({ checkInTime: null, lateAfter: '08:30' })).toBe('absent')
    const r = judgeStatusDetailed({ checkInTime: null })
    expect(r.status).toBe('absent')
    expect(r.reason).toBe('no-check-in')
  })

  it('② 签到晚于 lateAfter ⇒ late', () => {
    expect(judgeStatus({ lateAfter: '08:30', checkInTime: local(9, 0) })).toBe('late')
    const r = judgeStatusDetailed({ lateAfter: '08:30', checkInTime: local(9, 0) })
    expect(r.status).toBe('late')
    expect(r.reason.startsWith('late:09:00>08:30')).toBe(true)
  })

  it('③ 签到等于 lateAfter ⇒ present(严格大于才判迟到,边界不裁)', () => {
    expect(judgeStatus({ lateAfter: '08:30', checkInTime: local(8, 30) })).toBe('present')
  })

  it('④ 签退早于 earlyBefore ⇒ early', () => {
    expect(
      judgeStatus({ earlyBefore: '16:00', checkInTime: local(8, 0), checkOutTime: local(15, 30) }),
    ).toBe('early')
    const r = judgeStatusDetailed({
      earlyBefore: '16:00',
      checkInTime: local(8, 0),
      checkOutTime: local(15, 30),
    })
    expect(r.status).toBe('early')
    expect(r.reason.startsWith('early:15:30<16:00')).toBe(true)
  })

  it('⑤ 正常时段 ⇒ present 且 reason=ok', () => {
    const r = judgeStatusDetailed({
      lateAfter: '08:30',
      earlyBefore: '16:00',
      checkInTime: local(8, 0),
      checkOutTime: local(16, 30),
    })
    expect(r.status).toBe('present')
    expect(r.reason).toBe('ok')
  })

  it('⑥ 阈值给了但归一化拿不到 ⇒ 未判定,不冒充判过(§0.3)', () => {
    const r = judgeStatusDetailed({ lateAfter: '9:5', checkInTime: local(10, 0) })
    expect(r.status).toBe('present')
    expect(r.reason).toBe('unjudged:malformed-late-window')
  })

  it('⑦ 早退阈值非法 ⇒ 未判定,不冒充', () => {
    const r = judgeStatusDetailed({
      earlyBefore: '上午4点',
      checkInTime: local(8, 0),
      checkOutTime: local(15, 0),
    })
    expect(r.status).toBe('present')
    expect(r.reason).toBe('unjudged:malformed-early-window')
  })

  it('⑧ checkInTime 存在但 checkOutTime 缺失 ⇒ 早退维不参与,不误判', () => {
    expect(judgeStatus({ earlyBefore: '16:00', checkInTime: local(8, 0) })).toBe('present')
  })
})

describe('未补零时刻归一化对照(与 edu-schedule-conflict.normalizeHm 同源,§22c 单源)', () => {
  it("'9:00' 与 '09:00' 判定一致(避免字典序陷阱:9:00 > 10:00 是字符串序假象)", () => {
    const checkIn = local(9, 30)
    expect(judgeStatus({ lateAfter: '9:00', checkInTime: checkIn })).toBe(
      judgeStatus({ lateAfter: '09:00', checkInTime: checkIn }),
    )
    expect(judgeStatus({ lateAfter: '9:00', checkInTime: checkIn })).toBe('late')
  })

  it('规则侧未补零 + 阈值边界 ⇒ 归一化后仍严格大于才判', () => {
    // 09:00 归一后与 09:00 相等 ⇒ present
    expect(judgeStatus({ lateAfter: '9:00', checkInTime: local(9, 0) })).toBe('present')
    // 09:01 > 09:00 ⇒ late
    expect(judgeStatus({ lateAfter: '9:00', checkInTime: local(9, 1) })).toBe('late')
  })

  it('normalizeHm 与 hmOfLocalDate 输出形态一致(均为补零 HH:MM)', () => {
    const raw = normalizeHm('9:00')
    const hm = hmOfLocalDate(local(9, 0))
    expect(raw).toBe(hm)
    expect(hm).toBe('09:00')
  })

  it('PG time 列回读形态 08:30:00 阈值下,09:00 签到判 late(不再落 unjudged)', () => {
    // 迟到链与补录链共用 normalizeHm 单源:`late_after` 从库里回来就是 '08:30:00'
    expect(judgeStatus({ lateAfter: '08:30:00', checkInTime: local(9, 0) })).toBe('late')
    const r = judgeStatusDetailed({ lateAfter: '08:30:00', checkInTime: local(9, 0) })
    expect(r.reason.startsWith('late:09:00>08:30')).toBe(true)
    // 早退链同形:early_before = '16:00:00',15:30 签退 ⇒ early(旧尺子在这里判成 unjudged)
    expect(
      judgeStatus({
        lateAfter: '08:30:00',
        checkInTime: local(8, 0),
        earlyBefore: '16:00:00',
        checkOutTime: local(15, 30),
      }),
    ).toBe('early')
    // 带秒不影响边界:08:30:45 阈值下 08:30 签到仍 present(截断到分钟 ⇒ 同档、不严格大于)
    expect(judgeStatus({ lateAfter: '08:30:45', checkInTime: local(8, 30) })).toBe('present')
    expect(judgeStatus({ lateAfter: '08:30:45', checkInTime: local(8, 31) })).toBe('late')
  })

  it('hmOfLocalDate 对非法 Date 返回 null(不猜)', () => {
    expect(hmOfLocalDate(new Date('not-a-date'))).toBeNull()
    expect(hmOfLocalDate(null)).toBeNull()
    expect(hmOfLocalDate(undefined)).toBeNull()
  })

  it('空串/null 阈值 ⇒ 该维不判,继续下一维', () => {
    // lateAfter='' 时不判迟到;earlyBefore 合法且满足 ⇒ early
    const r = judgeStatusDetailed({
      lateAfter: '',
      earlyBefore: '16:00',
      checkInTime: local(8, 0),
      checkOutTime: local(15, 0),
    })
    expect(r.status).toBe('early')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
