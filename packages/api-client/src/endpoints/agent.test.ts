// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// M4 api-B(2026-11-03):`updateAgentBilling` 的请求形状闸。
// 真源 = apps/web/app/(main)/agents/edit/[id]/PageClient.tsx updateMut 的
// `PUT /api/agents/:id` + body `{ price, isFree }`(本包 base 已含 /api)。
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client.js', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '../client.js'
import type { ApiResult } from '@ihui/types'
import type { Agent } from './agent'
import { updateAgentBilling } from './agent'

const mockedFetchApi = vi.mocked(fetchApi)
const AGENT_ID = '5f0c1a9e-3b2d-4c8e-9a1f-7d6e5c4b3a29'

beforeEach(() => {
  mockedFetchApi.mockReset()
})

describe('updateAgentBilling — 与 web 编辑页同形', () => {
  it('PUT /agents/:agentId,body 只含 price(number) 与 isFree(boolean)', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: {} as Agent })

    const result = await updateAgentBilling(AGENT_ID, { price: 9.9, isFree: false })

    expect(mockedFetchApi).toHaveBeenCalledTimes(1)
    expect(mockedFetchApi).toHaveBeenCalledWith(`/agents/${AGENT_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ price: 9.9, isFree: false }),
    })
    expect(result.success).toBe(true)
  })

  it('免费档 price 归一为 0、isFree 为 true', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: {} as Agent })

    await updateAgentBilling(AGENT_ID, { price: 0, isFree: true })

    expect(JSON.parse(String(mockedFetchApi.mock.calls[0]?.[1]?.body))).toEqual({
      price: 0,
      isFree: true,
    })
  })

  it('请求失败原样透出 success:false,不吞错也不改判成功', async () => {
    const failure: ApiResult<Agent> = { success: false, error: '智能体不存在', status: 404 }
    mockedFetchApi.mockResolvedValue(failure)

    const result = await updateAgentBilling(AGENT_ID, { price: 1, isFree: false })

    expect(result).toEqual(failure)
  })

  it('传输层异常不被端点函数吞掉', async () => {
    mockedFetchApi.mockRejectedValue(new Error('network down'))

    await expect(updateAgentBilling(AGENT_ID, { price: 1, isFree: false })).rejects.toThrow(
      'network down',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
