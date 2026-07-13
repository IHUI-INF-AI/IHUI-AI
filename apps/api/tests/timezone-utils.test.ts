import { describe, it, expect } from 'vitest'
import {
  TZError,
  COMMON_ZONES,
  toAwareUtc,
  toZone,
  toUnix,
  toIso,
  safeAddDuration,
  isInDst,
  TimeWindow,
  TimezoneService,
} from '../src/utils/timezone-utils'

describe('timezone-utils — toAwareUtc', () => {
  it('Date 返回副本', () => {
    const d = new Date(Date.UTC(2024, 5, 15, 10, 0, 0))
    const out = toAwareUtc(d)
    expect(out.getTime()).toBe(d.getTime())
    expect(out).not.toBe(d)
  })
  it('number 秒（< 1e12）× 1000', () => {
    const sec = 1700000000 // 2023-11-14
    expect(toAwareUtc(sec).getTime()).toBe(sec * 1000)
  })
  it('number 毫秒（>= 1e12）原样', () => {
    const ms = Date.UTC(2024, 0, 1)
    expect(toAwareUtc(ms).getTime()).toBe(ms)
  })
  it('null/undefined 返回当前时间', () => {
    const before = Date.now()
    const out1 = toAwareUtc(null as unknown as undefined)
    const out2 = toAwareUtc(undefined as unknown as undefined)
    const after = Date.now()
    expect(out1.getTime()).toBeGreaterThanOrEqual(before)
    expect(out1.getTime()).toBeLessThanOrEqual(after)
    expect(out2.getTime()).toBeGreaterThanOrEqual(before)
    expect(out2.getTime()).toBeLessThanOrEqual(after)
  })
  it('ISO 带 Z 后缀', () => {
    expect(toAwareUtc('2024-01-15T08:00:00Z').getTime()).toBe(Date.UTC(2024, 0, 15, 8, 0, 0))
  })
  it('ISO 无时区按 UTC', () => {
    const out = toAwareUtc('2024-01-15T08:00:00')
    expect(out.getUTCHours()).toBe(8)
  })
  it('纯日期 YYYY-MM-DD 按 UTC', () => {
    const out = toAwareUtc('2024-03-01')
    expect(out.getUTCFullYear()).toBe(2024)
    expect(out.getUTCMonth()).toBe(2)
    expect(out.getUTCDate()).toBe(1)
  })
  it('naive 格式 YYYY-MM-DD HH:mm:ss 按 UTC', () => {
    const out = toAwareUtc('2024-03-01 12:30:45')
    expect(out.getUTCHours()).toBe(12)
    expect(out.getUTCMinutes()).toBe(30)
    expect(out.getUTCSeconds()).toBe(45)
  })
  it('非法字符串抛 TZError', () => {
    expect(() => toAwareUtc('not-a-date')).toThrow(TZError)
  })
  it('非法类型抛 TZError', () => {
    expect(() => toAwareUtc(true as unknown as string)).toThrow(TZError)
  })
})

describe('timezone-utils — toZone', () => {
  const epoch = '2024-06-15T12:00:00Z' // UTC 12:00

  it('UTC 时区偏移 0', () => {
    const z = toZone(epoch, 'UTC')
    expect(z.offsetMinutes).toBe(0)
    expect(z.hour).toBe(12)
    expect(z.isDst).toBe(false)
  })
  it('Asia/Shanghai UTC+8', () => {
    const z = toZone(epoch, 'Asia/Shanghai')
    expect(z.offsetMinutes).toBe(480)
    expect(z.hour).toBe(20) // 12 + 8
    expect(z.isDst).toBe(false) // 中国不使用 DST
  })
  it('America/Los_Angeles 夏令时 UTC-7', () => {
    // 2024-06-15 在 DST 期间，LA 是 UTC-7
    const z = toZone(epoch, 'America/Los_Angeles')
    expect(z.offsetMinutes).toBe(-420) // -7h
    expect(z.hour).toBe(5) // 12 - 7
    expect(z.isDst).toBe(true)
  })
  it('America/Los_Angeles 冬令时 UTC-8', () => {
    // 2024-01-15 不在 DST 期间，LA 是 UTC-8
    const z = toZone('2024-01-15T12:00:00Z', 'America/Los_Angeles')
    expect(z.offsetMinutes).toBe(-480) // -8h
    expect(z.hour).toBe(4) // 12 - 8
    expect(z.isDst).toBe(false)
  })
  it('含 year/month/day 等墙钟组件', () => {
    const z = toZone(epoch, 'Asia/Shanghai')
    expect(z.year).toBe(2024)
    expect(z.month).toBe(6)
    expect(z.day).toBe(15)
    expect(z.timeZone).toBe('Asia/Shanghai')
  })
  it('未知时区抛 TZError', () => {
    expect(() => toZone(epoch, 'Invalid/Zone')).toThrow(TZError)
  })
})

describe('timezone-utils — toUnix', () => {
  it('转秒级时间戳', () => {
    const ms = Date.UTC(2024, 0, 1, 0, 0, 0)
    expect(toUnix(new Date(ms))).toBe(ms / 1000)
  })
  it('向下取整', () => {
    const ms = Date.UTC(2024, 0, 1, 0, 0, 0, 500) // +500ms
    expect(toUnix(new Date(ms))).toBe(Math.floor(ms / 1000))
  })
})

describe('timezone-utils — toIso', () => {
  it('UTC 输出 +00:00', () => {
    expect(toIso('2024-06-15T12:00:00Z', 'UTC')).toBe('2024-06-15T12:00:00+00:00')
  })
  it('Asia/Shanghai 输出 +08:00', () => {
    expect(toIso('2024-06-15T12:00:00Z', 'Asia/Shanghai')).toBe('2024-06-15T20:00:00+08:00')
  })
  it('America/Los_Angeles 夏令时输出 -07:00', () => {
    expect(toIso('2024-06-15T12:00:00Z', 'America/Los_Angeles')).toBe('2024-06-15T05:00:00-07:00')
  })
  it('默认 UTC', () => {
    expect(toIso('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00+00:00')
  })
})

describe('timezone-utils — safeAddDuration', () => {
  it('加秒数', () => {
    const z = safeAddDuration('2024-06-15T12:00:00Z', 3600, 'UTC')
    expect(z.hour).toBe(13)
  })
  it('加 1 天 = 86400 秒', () => {
    const z = safeAddDuration('2024-06-15T12:00:00Z', 86400, 'UTC')
    expect(z.day).toBe(16)
    expect(z.hour).toBe(12)
  })
  it('默认 UTC 时区', () => {
    const z = safeAddDuration('2024-06-15T12:00:00Z', 60)
    expect(z.minute).toBe(1)
    expect(z.timeZone).toBe('UTC')
  })
})

describe('timezone-utils — isInDst', () => {
  it('LA 6 月在 DST', () => {
    expect(isInDst('2024-06-15T12:00:00Z', 'America/Los_Angeles')).toBe(true)
  })
  it('LA 1 月不在 DST', () => {
    expect(isInDst('2024-01-15T12:00:00Z', 'America/Los_Angeles')).toBe(false)
  })
  it('Shanghai 无 DST', () => {
    expect(isInDst('2024-06-15T12:00:00Z', 'Asia/Shanghai')).toBe(false)
  })
  it('UTC 无 DST', () => {
    expect(isInDst('2024-06-15T12:00:00Z', 'UTC')).toBe(false)
  })
})

describe('timezone-utils — TimeWindow', () => {
  it('正常构造', () => {
    const w = new TimeWindow('2024-06-15T00:00:00Z', '2024-06-15T12:00:00Z')
    expect(w.start.getTime()).toBe(Date.UTC(2024, 5, 15, 0, 0, 0))
    expect(w.end.getTime()).toBe(Date.UTC(2024, 5, 15, 12, 0, 0))
    expect(w.timeZone).toBe('UTC')
  })
  it('start > end 抛 TZError', () => {
    expect(() => new TimeWindow('2024-06-15T12:00:00Z', '2024-06-15T00:00:00Z')).toThrow(TZError)
  })
  it('start === end 允许（零宽窗口）', () => {
    const w = new TimeWindow('2024-06-15T12:00:00Z', '2024-06-15T12:00:00Z')
    expect(w.durationSeconds()).toBe(0)
  })
  it('contains: 在窗口内 true / 外 false / 边界 true', () => {
    const w = new TimeWindow('2024-06-15T00:00:00Z', '2024-06-15T12:00:00Z')
    expect(w.contains('2024-06-15T06:00:00Z')).toBe(true)
    expect(w.contains('2024-06-15T13:00:00Z')).toBe(false)
    expect(w.contains('2024-06-15T00:00:00Z')).toBe(true) // 边界
    expect(w.contains('2024-06-15T12:00:00Z')).toBe(true) // 边界
  })
  it('overlaps: 重叠 true / 不重叠 false / 边界相切 true', () => {
    const w1 = new TimeWindow('2024-06-15T00:00:00Z', '2024-06-15T12:00:00Z')
    const w2 = new TimeWindow('2024-06-15T06:00:00Z', '2024-06-15T18:00:00Z')
    const w3 = new TimeWindow('2024-06-15T12:00:00Z', '2024-06-15T18:00:00Z')
    const w4 = new TimeWindow('2024-06-15T13:00:00Z', '2024-06-15T18:00:00Z')
    expect(w1.overlaps(w2)).toBe(true)
    expect(w1.overlaps(w3)).toBe(true) // 边界相切
    expect(w1.overlaps(w4)).toBe(false)
  })
  it('durationSeconds', () => {
    const w = new TimeWindow('2024-06-15T00:00:00Z', '2024-06-15T01:00:00Z')
    expect(w.durationSeconds()).toBe(3600)
  })
})

describe('timezone-utils — TimezoneService', () => {
  it('convert 转 ZonedDateTime', () => {
    const svc = new TimezoneService()
    const z = svc.convert('2024-06-15T12:00:00Z', 'Asia/Shanghai')
    expect(z.hour).toBe(20)
    expect(z.timeZone).toBe('Asia/Shanghai')
  })
  it('unix 转秒', () => {
    const svc = new TimezoneService()
    expect(svc.unix('2024-01-01T00:00:00Z')).toBe(1704067200)
  })
  it('iso 输出', () => {
    const svc = new TimezoneService()
    expect(svc.iso('2024-06-15T12:00:00Z', 'UTC')).toBe('2024-06-15T12:00:00+00:00')
  })
  it('listZones 返回 COMMON_ZONES', () => {
    const svc = new TimezoneService()
    const zones = svc.listZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('Asia/Shanghai')
    expect(zones).toContain('America/Los_Angeles')
  })
  it('inDst 判断', () => {
    const svc = new TimezoneService()
    expect(svc.inDst('2024-06-15T12:00:00Z', 'America/Los_Angeles')).toBe(true)
    expect(svc.inDst('2024-01-15T12:00:00Z', 'America/Los_Angeles')).toBe(false)
  })
  it('getStats 统计 convert 次数', () => {
    const svc = new TimezoneService()
    svc.convert('2024-06-15T12:00:00Z', 'UTC')
    svc.convert('2024-06-15T12:00:00Z', 'UTC')
    svc.convert('2024-06-15T12:00:00Z', 'UTC')
    expect(svc.getStats().convert).toBe(3)
  })
})

describe('timezone-utils — COMMON_ZONES', () => {
  it('含 9 个常用时区', () => {
    expect(COMMON_ZONES.length).toBeGreaterThanOrEqual(9)
    expect(COMMON_ZONES).toContain('UTC')
    expect(COMMON_ZONES).toContain('Asia/Shanghai')
    expect(COMMON_ZONES).toContain('Asia/Tokyo')
    expect(COMMON_ZONES).toContain('America/New_York')
    expect(COMMON_ZONES).toContain('Europe/London')
    expect(COMMON_ZONES).toContain('Australia/Sydney')
  })
})
