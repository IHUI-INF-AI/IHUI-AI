// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反向例实测（任务验收要求逐条给读数）。
 * 这里用"拦截 transport"替代网络，记录真实调用次数与上报体；
 * 运行 `vitest run src/lib/rum/__tests__/rum-reverse-evidence.test.ts` 可看到 console.log 读数。
 */
import { describe, expect, it } from 'vitest'

import { RumCollector, type RumEvent } from '../collector'

function interceptTransport(): {
  batches: RumEvent[][]
  transport: (events: RumEvent[]) => void
} {
  const batches: RumEvent[][] = []
  return {
    batches,
    transport: (events) => {
      batches.push(events)
    },
  }
}

describe('RUM 反向例实测', () => {
  it('① 关闭同意开关 → 拦截层记录到的请求数为 0', async () => {
    const { batches, transport } = interceptTransport()
    const collector = new RumCollector({
      transport,
      consent: () => false,
      sampler: () => true,
      platform: () => 'linux',
    })
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
      collector.recordRequestFailure('/api/v1/foo', 500)
    }
    await collector.flush()
    console.info(`[反向例①] 关闭同意 → transport 请求数 = ${batches.length}`)
    expect(batches.length).toBe(0)
  })

  it('② 含 C:\\Users\\张三\\secret.txt 与 a@b.com 的指标 → 上报体找不到原文', async () => {
    const { batches, transport } = interceptTransport()
    const collector = new RumCollector({
      transport,
      consent: () => true,
      sampler: () => true,
      platform: () => 'linux',
    })
    collector.recordError('error', new Error('failed at C:\\Users\\张三\\secret.txt for a@b.com'))
    await collector.flush()
    const body = JSON.stringify(batches)
    console.info(`[反向例②] 脱敏后上报体 = ${body}`)
    expect(body).not.toContain('C:\\Users\\张三\\secret.txt')
    expect(body).not.toContain('a@b.com')
    expect(body).toContain('<path>')
    expect(body).toContain('<email>')
  })

  it('③ 采样率设为 0 → 上报条数为 0', async () => {
    const { batches, transport } = interceptTransport()
    const collector = new RumCollector({
      transport,
      consent: () => true,
      samplingRate: 0,
      sampler: () => true,
      platform: () => 'linux',
    })
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    const sent = await collector.flush()
    console.info(`[反向例③] 采样率 0 → 上报条数 = ${sent}`)
    expect(sent).toBe(0)
    expect(batches.flat()).toHaveLength(0)
  })

  it('④ 构造 1000 条事件 → 实际上报 10 条（≤ 1% 上界）', async () => {
    const { batches, transport } = interceptTransport()
    const collector = new RumCollector({
      transport,
      consent: () => true,
      samplingRate: 1,
      random: () => 0,
      platform: () => 'linux',
    })
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    const sent = await collector.flush()
    console.info(`[反向例④] 1000 条事件 → 实际上报条数 = ${sent}（上限 10）`)
    expect(sent).toBe(10)
    expect(batches.flat()).toHaveLength(10)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
