// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型代次判定客户端行为锁(2026-11-20 立)。
 *
 * 钉住四条边界:
 * 1. 空集合不调上游(没有模型可判 ≠ 判不了);
 * 2. 任一失败(票签不出 / 非 2xx / 抛异常 / 响应坏)必须返回 null —— 调用方据此 fail-open,
 *    绝不能返回"空 Map"让上层误以为"全都不是旧代"再把号池打空;
 * 3. 成功时按 provider+id 成对回填,并把结论写进进程内缓存(第二次不再发请求);
 * 4. 响应里出现没问过的 id 不写缓存(不把别的平台的结论套过来)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  buildInternalCallHeaders: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({ aiServiceFetch: mocks.aiServiceFetch }))
vi.mock('../../utils/internal-call-headers.js', () => ({
  buildInternalCallHeaders: mocks.buildInternalCallHeaders,
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn() },
}))

import {
  classifyPoolModels,
  poolModelClassKey,
  resetPoolModelClassifyCacheForTests,
} from '../model-catalog-classify-client.js'

function okResponse(items: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ items }) }
}

beforeEach(() => {
  mocks.aiServiceFetch.mockReset()
  mocks.buildInternalCallHeaders.mockReset()
  mocks.warn.mockReset()
  resetPoolModelClassifyCacheForTests()
})

describe('classifyPoolModels', () => {
  it('空集合返回空 Map 且不调上游', async () => {
    const out = await classifyPoolModels([])
    expect(out).toEqual(new Map())
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(mocks.buildInternalCallHeaders).not.toHaveBeenCalled()
  })

  it('票签不出 ⇒ null(fail-open),不隐藏也不标代次', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue(null)
    const out = await classifyPoolModels([{ id: 'workbuddy/kimi-k2.5', provider: 'workbuddy' }])
    expect(out).toBeNull()
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('非 2xx ⇒ null', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue({ 'X-Internal-Service-Ticket': 't' })
    mocks.aiServiceFetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    const out = await classifyPoolModels([{ id: 'workbuddy/kimi-k2.5', provider: 'workbuddy' }])
    expect(out).toBeNull()
  })

  it('抛异常 / 响应缺 items ⇒ null', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue({ 'X-Internal-Service-Ticket': 't' })
    mocks.aiServiceFetch.mockRejectedValueOnce(new Error('boom'))
    expect(
      await classifyPoolModels([{ id: 'workbuddy/kimi-k2.5', provider: 'workbuddy' }]),
    ).toBeNull()

    mocks.aiServiceFetch.mockReset()
    mocks.aiServiceFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    expect(
      await classifyPoolModels([{ id: 'workbuddy/glm-4.7', provider: 'workbuddy' }]),
    ).toBeNull()
  })

  it('成功按 provider+id 回填,并缓存(第二次不再发请求)', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue({ 'X-Internal-Service-Ticket': 't' })
    mocks.aiServiceFetch.mockResolvedValue(
      okResponse([
        {
          id: 'workbuddy/kimi-k2.5',
          provider: 'workbuddy',
          category: 'chat',
          model_tier: 'standard',
          hidden: true,
        },
        {
          id: 'workbuddy/kimi-k3',
          provider: 'workbuddy',
          category: 'chat',
          model_tier: 'latest',
          hidden: false,
        },
      ]),
    )

    const refs = [
      { id: 'workbuddy/kimi-k2.5', provider: 'workbuddy' },
      { id: 'workbuddy/kimi-k3', provider: 'workbuddy' },
    ]
    const first = await classifyPoolModels(refs)
    expect(first).not.toBeNull()
    expect(first?.get(poolModelClassKey('workbuddy', 'workbuddy/kimi-k2.5'))).toEqual({
      category: 'chat',
      modelTier: 'standard',
      hidden: true,
    })
    expect(first?.get(poolModelClassKey('workbuddy', 'workbuddy/kimi-k3'))?.hidden).toBe(false)

    const calls = mocks.aiServiceFetch.mock.calls.length
    const second = await classifyPoolModels(refs)
    expect(second?.get(poolModelClassKey('workbuddy', 'workbuddy/kimi-k2.5'))?.hidden).toBe(true)
    expect(mocks.aiServiceFetch.mock.calls.length).toBe(calls)
  })

  it('响应里没问过的 id 不写缓存', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue({ 'X-Internal-Service-Ticket': 't' })
    mocks.aiServiceFetch.mockResolvedValue(
      okResponse([
        {
          id: 'workbuddy/kimi-k2.5',
          provider: 'workbuddy',
          category: 'chat',
          model_tier: 'legacy',
          hidden: true,
        },
        {
          id: 'other/some-model',
          provider: 'other',
          category: 'chat',
          model_tier: 'legacy',
          hidden: true,
        },
      ]),
    )
    const out = await classifyPoolModels([{ id: 'workbuddy/kimi-k2.5', provider: 'workbuddy' }])
    expect(out?.has(poolModelClassKey('other', 'other/some-model'))).toBe(false)

    // 陌生 id 没进缓存:下次真问它时必须重新请求
    const before = mocks.aiServiceFetch.mock.calls.length
    await classifyPoolModels([{ id: 'other/some-model', provider: 'other' }])
    expect(mocks.aiServiceFetch.mock.calls.length).toBe(before + 1)
  })

  it('只把缓存未命中的那部分发给上游', async () => {
    mocks.buildInternalCallHeaders.mockResolvedValue({ 'X-Internal-Service-Ticket': 't' })
    mocks.aiServiceFetch.mockResolvedValue(
      okResponse([
        {
          id: 'workbuddy/kimi-k3',
          provider: 'workbuddy',
          category: 'chat',
          model_tier: 'latest',
          hidden: false,
        },
      ]),
    )
    await classifyPoolModels([{ id: 'workbuddy/kimi-k3', provider: 'workbuddy' }])

    mocks.aiServiceFetch.mockResolvedValue(okResponse([]))
    await classifyPoolModels([
      { id: 'workbuddy/kimi-k3', provider: 'workbuddy' },
      { id: 'workbuddy/new-model', provider: 'workbuddy' },
    ])
    const body = JSON.parse(String(mocks.aiServiceFetch.mock.calls.at(-1)?.[2]?.body))
    expect(body.models).toEqual([{ id: 'workbuddy/new-model', provider: 'workbuddy' }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
