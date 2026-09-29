// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-automation-scheduler parseNextRun 纯函数单测(2026-09-07 立;2026-09-29 重写)。
 * 不连 DB,不 mock 网络——只测 rrule MVP 解析器。
 *
 * 为什么要重写:原用例用 `new Date(y, m, d, h, min)`(**宿主本地**)构造输入,又用
 * `getFullYear()/getHours()/getDate()`(**宿主本地**)断言输出 —— 两端都跟着宿主时区走,
 * 于是"解析器按宿主时区算墙钟"这个缺陷在**任何**宿主下都能自洽通过。宿主时区被从
 * CST 悄悄改成 UTC 的 25 天里,全体用户定时任务在错点触发而这条测试一路绿,就是
 * 本仓反复点名的"什么都没钉住的断言"。
 *
 * 现在的口径:
 *  - 输入一律由显式 UTC epoch 构造(`Date.parse('...Z')`),不再出现宿主本地构造器;
 *  - 期望一律写成 ISO-with-offset 的**绝对时刻**(如 `2026-09-07T09:30:00+08:00`),
 *    并用 Intl 独立复核"该时刻在行上时区里读得出 09:30 这个墙钟",双向钉住语义;
 *  - 每条功能用例在宿主 TZ = UTC / Asia/Shanghai / America/New_York 三档下各跑一次
 *    (测后还原),钉住"结果与宿主无关";
 *  - Asia/Shanghai 行的期望值**等于改动前(宿主 CST)算出的同一批绝对时刻**,
 *    所以"老用户的时间没被挪动"是被断言的,不是被声称的;
 *  - 有一条非默认时区(America/New_York)用例证明 timezone 列真的被读了。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { parseNextRun, DEFAULT_SCHEDULE_TIMEZONE } from '../agent-automation-scheduler'

/** 零偏移 / +08 无 DST / -5~-4 有 DST:宿主本地时区一旦参与计算,这三档必然露馅。 */
const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const

const ORIGINAL_TZ = process.env.TZ

/**
 * 每次取一个**新的**非法时区字面量。
 * 生产侧的"只喊一次"按非法值去重(模块级 Set,跨用例存活),三档宿主时区各跑一次
 * 同一条用例若共用一个字面量,后两档必然看到 0 次 warn —— 那是夹具自撞,不是判据失效。
 */
let bogusZoneSeq = 0
function nextBogusZone(): string {
  bogusZoneSeq += 1
  return `Mars/Olympus_Mons-${bogusZoneSeq}`
}

/** 在指定宿主时区下跑一次断言体,跑完立刻还原(不留残档给后面的用例/文件)。 */
function inHostZone(hostZone: string, body: () => void): void {
  const prev = process.env.TZ
  process.env.TZ = hostZone
  try {
    body()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

/** 同一条断言在三档宿主时区下各跑一次 ⇒ "结果与宿主无关"是被量出来的。 */
function itInEveryHostZone(name: string, body: () => void): void {
  for (const hostZone of HOST_ZONES) {
    it(`${name}(宿主 TZ=${hostZone})`, () => inHostZone(hostZone, body))
  }
}

/** 显式 UTC epoch 构造输入:本文件禁止再用 `new Date(y, m, d, …)` 这种宿主本地构造器。 */
function utc(isoWithZ: string): Date {
  const ms = Date.parse(isoWithZ)
  if (Number.isNaN(ms)) throw new Error(`夹具输入不是合法 ISO 时刻:${isoWithZ}`)
  return new Date(ms)
}

/**
 * 绝对时刻逐位等值(含毫秒)。expected 写成 ISO-with-offset,读的人一眼看得出
 * "哪个时区的几点"——这正是本次修复的语义所在。
 */
function expectInstant(actual: Date | null, expected: string): Date {
  if (actual === null) {
    throw new Error(`parseNextRun 返回了 null,期望 ${expected}`)
  }
  expect(actual.toISOString(), `期望绝对时刻 ${expected}`).toBe(utc2iso(expected))
  return actual
}

/** 把 ISO-with-offset 期望值归一成 UTC ISO 串(期望值写错时立刻炸,不带病通过)。 */
function utc2iso(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`期望值不是合法 ISO 时刻:${iso}`)
  return new Date(ms).toISOString()
}

/**
 * 独立复核(只用 Intl,不引被测代码):该绝对时刻在 zone 里的墙钟读数。
 * 没有它,硬编码的 epoch 期望值可能被我算错而"自洽地错"。
 */
function wallClock(instant: Date, zone: string): string {
  const map: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant)) {
    map[part.type] = part.value
  }
  const hour = map.hour === '24' ? '00' : map.hour
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}`
}

function expectWallClock(actual: Date | null, expected: string, zone: string, text: string): void {
  const instant = expectInstant(actual, expected)
  expect(wallClock(instant, zone), `期望时刻在 ${zone} 的墙钟读数`).toBe(text)
}

describe('parseNextRun(按行 timezone 的墙钟,与宿主时区无关)', () => {
  afterAll(() => {
    // 每条用例都在 finally 里还原;这一维若被漏掉,这里会红 —— 不得把测试档位留给后面的文件
    expect(process.env.TZ ?? '', '宿主 TZ 未还原').toBe(ORIGINAL_TZ ?? '')
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  describe('DAILY', () => {
    itInEveryHostZone('今天时刻未到 → 今天 BYHOUR:BYMINUTE(Asia/Shanghai 行)', () => {
      // from = 08:00 CST,要到的是 09:30 CST ⇒ 绝对时刻 01:30Z(与改动前宿主 CST 时算出的同一个)
      const next = parseNextRun(
        'FREQ=DAILY;BYHOUR=9;BYMINUTE=30',
        utc('2026-09-07T00:00:00Z'),
        'Asia/Shanghai',
      )
      expectWallClock(next, '2026-09-07T09:30:00+08:00', 'Asia/Shanghai', '2026-09-07 09:30')
    })

    itInEveryHostZone('今天时刻已过 → 明天同一墙钟时刻', () => {
      const next = parseNextRun(
        'FREQ=DAILY;BYHOUR=9;BYMINUTE=30',
        utc('2026-09-07T02:00:00Z'), // 10:00 CST
        'Asia/Shanghai',
      )
      expectWallClock(next, '2026-09-08T09:30:00+08:00', 'Asia/Shanghai', '2026-09-08 09:30')
    })

    itInEveryHostZone('from 恰在默认墙钟时刻 00:00 → 严格晚于 ⇒ 次日 00:00', () => {
      const next = parseNextRun('FREQ=DAILY', utc('2026-09-06T16:00:00Z'), 'Asia/Shanghai')
      expectWallClock(next, '2026-09-08T00:00:00+08:00', 'Asia/Shanghai', '2026-09-08 00:00')
    })

    itInEveryHostZone('BYHOUR 边界 0 与 23 都按墙钟算', () => {
      expectWallClock(
        parseNextRun(
          'FREQ=DAILY;BYHOUR=0;BYMINUTE=5',
          utc('2026-09-07T01:00:00Z'),
          'Asia/Shanghai',
        ),
        '2026-09-08T00:05:00+08:00',
        'Asia/Shanghai',
        '2026-09-08 00:05',
      )
      expectWallClock(
        parseNextRun(
          'FREQ=DAILY;BYHOUR=23;BYMINUTE=59',
          utc('2026-09-07T01:00:00Z'),
          'Asia/Shanghai',
        ),
        '2026-09-07T23:59:00+08:00',
        'Asia/Shanghai',
        '2026-09-07 23:59',
      )
    })
  })

  describe('WEEKLY', () => {
    itInEveryHostZone('同日命中 BYDAY 且时刻未到 → 今天', () => {
      // 2026-09-07 在 Shanghai 是周一 08:30
      const next = parseNextRun(
        'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0',
        utc('2026-09-07T00:30:00Z'),
        'Asia/Shanghai',
      )
      expectWallClock(next, '2026-09-07T09:00:00+08:00', 'Asia/Shanghai', '2026-09-07 09:00')
    })

    itInEveryHostZone('跨周(周五晚 → 下周一早)', () => {
      const next = parseNextRun(
        'FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0',
        utc('2026-09-04T10:00:00Z'), // Fri 18:00 CST
        'Asia/Shanghai',
      )
      expectWallClock(next, '2026-09-07T09:00:00+08:00', 'Asia/Shanghai', '2026-09-07 09:00')
    })

    itInEveryHostZone('BYDAY 全 7 天且 from 恰在时刻上 → 次日同时刻(严格晚于)', () => {
      const next = parseNextRun(
        'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=10;BYMINUTE=0',
        utc('2026-09-07T02:00:00Z'), // Mon 10:00 CST
        'Asia/Shanghai',
      )
      expectWallClock(next, '2026-09-08T10:00:00+08:00', 'Asia/Shanghai', '2026-09-08 10:00')
    })

    // 星期几也必须按行的时区算:同一绝对时刻在两个时区里是**不同的星期**,
    // 按宿主算就会让一侧拿到别的日子。
    itInEveryHostZone('星期几按行 timezone 判:Shanghai 已周一、New_York 还是周日', () => {
      const from = utc('2026-09-07T00:00:00Z')
      const rrule = 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0'
      expectWallClock(
        parseNextRun(rrule, from, 'Asia/Shanghai'), // 当地 Mon 08:00 → 今天 09:00
        '2026-09-07T09:00:00+08:00',
        'Asia/Shanghai',
        '2026-09-07 09:00',
      )
      expectWallClock(
        parseNextRun(rrule, from, 'America/New_York'), // 当地 Sun 20:00 → 下周一 09:00 EDT
        '2026-09-07T09:00:00-04:00',
        'America/New_York',
        '2026-09-07 09:00',
      )
    })
  })

  itInEveryHostZone('HOURLY:绝对时间 +1h(与墙钟时区无关)', () => {
    for (const zone of ['Asia/Shanghai', 'America/New_York', 'UTC'] as const) {
      const next = parseNextRun('FREQ=HOURLY;BYHOUR=9', utc('2026-09-07T09:15:00Z'), zone)
      expectInstant(next, '2026-09-07T10:15:00Z')
    }
  })

  // 这一族是本票的正面证据:同一条 rrule、同一 from,只换 timezone ⇒ 绝对时刻必须不同。
  itInEveryHostZone('timezone 列真的被读:New_York 行与 Shanghai 行差 12 小时(不是钉死北京)', () => {
    const from = utc('2026-09-07T00:00:00Z')
    const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0'
    const sh = expectInstant(
      parseNextRun(rrule, from, 'Asia/Shanghai'),
      '2026-09-07T09:00:00+08:00',
    )
    const ny = expectInstant(
      parseNextRun(rrule, from, 'America/New_York'),
      // from 在纽约是周日 20:00 ⇒ 当地"今天 09:00"已过(且早于 from)⇒ 落到周一 09:00 EDT
      '2026-09-07T09:00:00-04:00',
    )
    expect(ny.getTime() - sh.getTime(), '两行时区差(小时)').toBe(12 * 60 * 60 * 1000)
    expect(wallClock(ny, 'America/New_York')).toBe('2026-09-07 09:00')
    expect(wallClock(sh, 'Asia/Shanghai')).toBe('2026-09-07 09:00')
  })

  itInEveryHostZone('夏令时切换日:纽约 03-08 那天只有 23 小时,墙钟仍要落在 09:00', () => {
    const next = parseNextRun(
      'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      utc('2026-03-07T15:00:00Z'), // 当地 03-07 10:00 EST,已过 09:00
      'America/New_York',
    )
    expectWallClock(next, '2026-03-08T09:00:00-04:00', 'America/New_York', '2026-03-08 09:00')
    // 同一 from 的 Shanghai 行:当地 23:00,下一天 09:00 +08
    expectWallClock(
      parseNextRun('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', utc('2026-03-07T15:00:00Z'), 'Asia/Shanghai'),
      '2026-03-08T09:00:00+08:00',
      'Asia/Shanghai',
      '2026-03-08 09:00',
    )
  })

  describe('timezone 缺失 / 非法一律兜底默认档,且喊得出来', () => {
    itInEveryHostZone('null / undefined / 空串 ⇒ 与显式 Asia/Shanghai 结果逐位相同', () => {
      const from = utc('2026-09-07T00:00:00Z')
      const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=30'
      const reference = expectInstant(
        parseNextRun(rrule, from, 'Asia/Shanghai'),
        '2026-09-07T09:30:00+08:00',
      )
      for (const missing of [null, undefined, '', '   ']) {
        expectInstant(parseNextRun(rrule, from, missing), '2026-09-07T09:30:00+08:00')
      }
      expect(reference.toISOString()).toBe(utc2iso('2026-09-07T09:30:00+08:00'))
      expect(DEFAULT_SCHEDULE_TIMEZONE, '兜底档必须就是北京,否则上面这些期望值全部作废').toBe(
        'Asia/Shanghai',
      )
    })

    itInEveryHostZone('非法 IANA 名:不抛错、按默认档算、每个非法值只 warn 一次', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const from = utc('2026-09-07T00:00:00Z')
        const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=30'
        const bogus = nextBogusZone()
        let next: Date | null = null
        expect(() => {
          next = parseNextRun(rrule, from, bogus)
        }).not.toThrow()
        expectInstant(next, '2026-09-07T09:30:00+08:00') // 兜底 = 默认档,不是崩溃也不是 null
        expect(warn, '静默兜底等于伪造"按用户设定执行",必须喊').toHaveBeenCalledTimes(1)
        parseNextRun(rrule, from, bogus)
        parseNextRun(rrule, from, bogus)
        expect(warn, '同一非法值不得每 60s tick 刷一次日志').toHaveBeenCalledTimes(1)
      } finally {
        warn.mockRestore()
      }
    })
  })

  describe('结构性非法 rrule → null(调用方据此置 paused)', () => {
    const from = utc('2026-09-07T01:00:00Z')
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['BYHOUR=9;BYMINUTE=0', '缺 FREQ'],
      ['FREQ=MONTHLY;BYMONTHDAY=1', 'FREQ 不支持'],
      ['FREQ=DAILY;BYHOUR=24', 'BYHOUR 越界'],
      ['FREQ=DAILY;BYMINUTE=60', 'BYMINUTE 越界'],
      ['FREQ=WEEKLY;BYDAY=XX;BYHOUR=9', 'BYDAY 非法'],
      ['FREQ=WEEKLY;BYHOUR=9', 'WEEKLY 缺 BYDAY'],
    ]
    for (const [rrule, title] of cases) {
      itInEveryHostZone(`${title} → null`, () => {
        expect(parseNextRun(rrule, from, 'Asia/Shanghai')).toBeNull()
        // 非法 timezone 也不得把"结构合法"翻成 null / 把"结构非法"翻成有值
        expect(parseNextRun(rrule, from, 'Not/AZone')).toBeNull()
      })
    }
  })

  describe('宿主无关性(汇总证明)', () => {
    it('同一条用例在三档宿主时区下得到同一个绝对时刻', () => {
      const collect = (): string[] =>
        HOST_ZONES.map((hostZone) => {
          const holder: { value: Date | null } = { value: null }
          inHostZone(hostZone, () => {
            holder.value = parseNextRun(
              'FREQ=WEEKLY;BYDAY=TU,FR;BYHOUR=7;BYMINUTE=45',
              utc('2026-09-07T05:00:00Z'),
              'Asia/Shanghai',
            )
          })
          return holder.value === null ? 'null' : holder.value.toISOString()
        })
      const results = collect()
      expect(new Set(results).size, `宿主时区仍参与了计算:${results.join(' | ')}`).toBe(1)
      expect(results[0]).toBe(utc2iso('2026-09-08T07:45:00+08:00'))
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
