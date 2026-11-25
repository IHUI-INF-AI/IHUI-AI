// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统计型问数回归：意图识别必须准、数字必须可复算。
 * 这类错误最难被发现——答案看起来通顺，但数字是错的。
 */

import { describe, expect, it } from 'vitest'
import { computeAskStats, detectAskIntent } from '../wechat-hub/ask-stats'

const at = (iso: string) => new Date(iso)

const rows = [
  {
    direction: 'inbound',
    content: '报价单什么时候给',
    senderName: '张三',
    sentAt: at('2026-11-24T02:00:00Z'),
  },
  {
    direction: 'outbound',
    content: '下午发你',
    senderName: null,
    sentAt: at('2026-11-24T02:00:30Z'),
  },
  {
    direction: 'inbound',
    content: '合同条款再确认下',
    senderName: '张三',
    sentAt: at('2026-11-24T03:00:00Z'),
  },
  {
    direction: 'outbound',
    content: '我看过没问题',
    senderName: null,
    sentAt: at('2026-11-24T03:01:00Z'),
  },
  {
    direction: 'inbound',
    content: '明天的会议改到几点',
    senderName: '李四',
    sentAt: at('2026-11-25T01:00:00Z'),
  },
]

describe('detectAskIntent', () => {
  it('识别人物排名与 topN', () => {
    expect(detectAskIntent('这个月谁最活跃')).toMatchObject({ kind: 'sender-rank', topN: 5 })
    expect(detectAskIntent('排个前三名')).toMatchObject({ kind: 'sender-rank', topN: 3 })
  })

  it('识别日期峰值、小时峰值、回复速度、总量', () => {
    expect(detectAskIntent('哪天消息最多')).toMatchObject({ kind: 'day-peak' })
    expect(detectAskIntent('一般几点最热闹')).toMatchObject({ kind: 'hour-peak' })
    expect(detectAskIntent('他们回复速度快吗')).toMatchObject({ kind: 'reply-latency' })
    expect(detectAskIntent('上周一共多少条')).toMatchObject({ kind: 'count' })
  })

  it('叙述型问题不抢管，交给模型', () => {
    expect(detectAskIntent('预算最晚什么时候确认')).toBeNull()
    expect(detectAskIntent('他们在争什么')).toBeNull()
  })
})

describe('computeAskStats', () => {
  it('人物排名带占比', () => {
    const result = computeAskStats(rows, { kind: 'sender-rank', topN: 2 }, 'Asia/Shanghai')
    expect(result?.text).toContain('张三 2 条（40.0%）')
    expect(result?.data.participants).toBe(3)
  })

  it('日期峰值给出最集中的一天', () => {
    const result = computeAskStats(rows, { kind: 'day-peak', topN: 3 }, 'Asia/Shanghai')
    expect(result?.text).toContain('2026-11-24')
    expect(result?.text).toContain('4 条')
    expect(result?.data.activeDays).toBe(2)
  })

  it('小时峰值按目标时区分档', () => {
    // 02:00Z / 02:00:30Z 在 Asia/Shanghai 是 10 点，03:00Z / 03:01Z 是 11 点，01:00Z 次日是 9 点
    const result = computeAskStats(rows, { kind: 'hour-peak', topN: 5 }, 'Asia/Shanghai')
    expect(result?.data.peakHour).toBe(10)
    const hourly = result?.data.hourly as number[]
    expect(hourly[10]).toBe(2)
    expect(hourly[11]).toBe(2)
    expect(hourly[9]).toBe(1)
  })

  it('回复速度按 6 小时窗口配对，超窗口不算同一次对话', () => {
    // 30s / 3570s(59.5min) / 60s 三对计入；22 小时那对剔除
    const result = computeAskStats(rows, { kind: 'reply-latency', topN: 5 }, 'Asia/Shanghai')
    expect(result?.data).toMatchObject({
      pairs: 3,
      medianSeconds: 60,
      minSeconds: 30,
      maxSeconds: 3570,
    })
  })

  it('总量统计收发与活跃日', () => {
    const result = computeAskStats(rows, { kind: 'count', topN: 5 }, 'Asia/Shanghai')
    expect(result?.data).toMatchObject({ total: 5, inbound: 3, outbound: 2, activeDays: 2 })
  })

  it('空数据返回 null，不编造', () => {
    expect(computeAskStats([], { kind: 'count', topN: 5 }, 'Asia/Shanghai')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
