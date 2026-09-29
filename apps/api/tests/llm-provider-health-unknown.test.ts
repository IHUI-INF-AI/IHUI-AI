// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-726 票面验收(2026-09-29 立):provider 健康度三态可知。
 *
 * 成对三条,一条都不能少 —— 它们分别钉住改动前的三处塌缩:
 *   ① 超时/网络失败    → 旧实现返回空 Map,消费面按"空 Map = 宽松 = 可用"处理,
 *                         于是"本轮根本没问到"被显示成"这个 provider 健康"。
 *                         现必须 `known:false`,且消费面拿不到"健康"这个结论。
 *   ② 200 + status=down → 必须判不可用(正向对照,证明三态化没有把判不可用那一档一起削掉)。
 *   ③ 200 + providers=[] → 这是"取到了,且上游说没有任何 provider 上报",属 **known:true**;
 *                         该 code 未被上报 ⇒ 仍走 isProviderHardUnavailable 的宽松分支,
 *                         **与改动前逐字同形**(本票刻意不改严,改严属另票)。
 *
 * 全程 mock `aiServiceSystemFetch`,不产生任何网络/DB 副作用(§5 测试隔离铁律)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: mocks.fetch,
}))

import {
  fetchProviderHealth,
  isProviderHardUnavailable,
  resolveProviderAvailability,
  type ProviderHealthSnapshot,
} from '../src/lib/llm-provider-health.js'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

/** 消费面(v1-public / llm-models)那条映射的可执行复刻:known:false ⇒ 不给 available 字段 */
function badgeTextFor(availability: string, table: Record<string, string>): string | null {
  if (availability === 'unknown') return null
  return table[availability === 'available' ? 'healthy' : 'down'] ?? null
}

describe('G-726 provider 健康度三态可知', () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① mock 超时 ⇒ known:false,且消费面渲染不出"健康"字样', async () => {
    mocks.fetch.mockRejectedValue(new Error('AbortError: 请求超时'))

    const snapshot = await fetchProviderHealth()

    expect(snapshot.known).toBe(false)
    expect(snapshot.providers.size).toBe(0)

    // 消费面:任何 code 都不得拿到"可用/健康"这一结论
    for (const code of ['openai', 'deepseek', 'stepfun', undefined]) {
      expect(resolveProviderAvailability(code, snapshot)).toBe('unknown')
    }

    // 字面验收:徽章取词表里"健康"那档不得被选中
    const healthTable = JSON.parse(
      readFileSync(
        resolve(process.cwd(), '../../packages/i18n/messages/shared/zh-CN.json'),
        'utf8',
      ),
    ).llmSettings.v2.health as Record<string, string>
    expect(healthTable.healthy).toBe('健康')
    const rendered = badgeTextFor(resolveProviderAvailability('openai', snapshot), healthTable)
    expect(rendered).toBeNull()
    expect(rendered).not.toBe('健康')
  })

  it('② mock 200 + status=down ⇒ known:true 且判不可用(正向对照)', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({ providers: [{ provider_code: 'deepseek', status: 'down', error_type: '' }] }),
    )

    const snapshot = await fetchProviderHealth()

    expect(snapshot.known).toBe(true)
    expect(isProviderHardUnavailable('deepseek', snapshot.providers)).toBe(true)
    expect(resolveProviderAvailability('deepseek', snapshot)).toBe('unavailable')

    const healthTable = { healthy: '健康', down: '不可用' }
    expect(badgeTextFor(resolveProviderAvailability('deepseek', snapshot), healthTable)).toBe(
      '不可用',
    )
  })

  it('③ mock 200 + 空数组 ⇒ known:true 且该 code 视为未上报(与改动前同形,不收紧)', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ providers: [] }))

    const snapshot = await fetchProviderHealth()

    // 这一档是"问到了、上游没有任何上报",不是"没问到" —— 与 ① 必须可区分
    expect(snapshot.known).toBe(true)
    expect(snapshot.providers.size).toBe(0)
    // 未上报 ⇒ 维持 isProviderHardUnavailable 的 PENDING 宽松分支
    expect(isProviderHardUnavailable('deepseek', snapshot.providers)).toBe(false)
    expect(resolveProviderAvailability('deepseek', snapshot)).toBe('available')
    expect(
      badgeTextFor(resolveProviderAvailability('deepseek', snapshot), { healthy: '健康' }),
    ).toBe('健康')
  })

  it('非 2xx(① 的姊妹档)⇒ known:false,不得被读成"全部可用"', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ message: 'upstream 503' }, false, 503))
    const snapshot = await fetchProviderHealth()
    expect(snapshot.known).toBe(false)
    expect(resolveProviderAvailability('openai', snapshot)).toBe('unknown')
  })

  it('包裹形态 { code, data:{providers} } 正常解出且 known:true(解包回归)', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        code: 0,
        data: {
          providers: [{ provider_code: 'stepfun', status: 'degraded', error_type: 'rate_limited' }],
        },
      }),
    )
    const snapshot: ProviderHealthSnapshot = await fetchProviderHealth()
    expect(snapshot.known).toBe(true)
    expect(resolveProviderAvailability('stepfun', snapshot)).toBe('unavailable')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
