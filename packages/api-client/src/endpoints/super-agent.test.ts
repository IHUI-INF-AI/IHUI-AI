// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RP-43:web 工单面板端点封装的形状闸。契约真源 = apps/api/src/routes/super-agent.ts。
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client.js', () => ({ fetchApi: vi.fn() }))

import { ApiError } from '../api-error'
import { fetchApi } from '../client.js'
import type { ApiResult } from '@ihui/types'
import type { SuperAgentPanelView } from './super-agent'
import {
  acceptSuperAgentRecorded,
  getSuperAgentPanel,
  getSuperAgentTicketAssignment,
  getSuperAgentTicketLease,
  stopSuperAgentTicket,
} from './super-agent'

const mockedFetchApi = vi.mocked(fetchApi)

function ok<T>(data: T): ApiResult<T> {
  return { success: true, data }
}

beforeEach(() => {
  mockedFetchApi.mockReset()
})

describe('super-agent 面板端点', () => {
  it('GET /api/super-agent/panel 返回面板视图', async () => {
    const panel: SuperAgentPanelView = {
      needsPerson: [],
      tickets: [],
      quietDrops: 0,
      recorded: 0,
      pendingRecords: [],
    }
    mockedFetchApi.mockResolvedValue(ok(panel))

    await expect(getSuperAgentPanel()).resolves.toEqual(panel)
    expect(mockedFetchApi).toHaveBeenCalledWith('/api/super-agent/panel', undefined)
  })

  it('停止工单走 POST /tickets/:id/stop 且只带 reason', async () => {
    mockedFetchApi.mockResolvedValue(ok({ disposition: 'ignored', ticketId: 't-1' }))

    await stopSuperAgentTicket('t 1', '用户停止')

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/super-agent/tickets/t%201/stop', {
      method: 'POST',
      body: JSON.stringify({ reason: '用户停止' }),
    })
  })

  it('未填停止原因时 body 为空对象，不伪造结局', async () => {
    mockedFetchApi.mockResolvedValue(ok({ disposition: 'ignored' }))

    await stopSuperAgentTicket('t-1')

    expect(JSON.parse(String(mockedFetchApi.mock.calls[0]?.[1]?.body))).toEqual({})
  })

  it('确认记账请求走 POST /recorded/:id/accept，规则与备注原样上行', async () => {
    mockedFetchApi.mockResolvedValue(ok({ disposition: 'accepted', ticketId: 't-2' }))

    await acceptSuperAgentRecorded('tr-1', 'rule-a', '人工确认')

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/super-agent/recorded/tr-1/accept', {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'rule-a', routerNotes: '人工确认' }),
    })
  })

  it('派工与租约读数走 GET 子路径', async () => {
    mockedFetchApi.mockResolvedValue(ok(null))
    await getSuperAgentTicketAssignment('t-1')
    expect(mockedFetchApi).toHaveBeenLastCalledWith(
      '/api/super-agent/tickets/t-1/assignment',
      undefined,
    )

    const lease = { remainingMs: 1000, lostLeaseCount: 0, leaseLostAt: null }
    mockedFetchApi.mockResolvedValue(ok(lease))
    await expect(getSuperAgentTicketLease('t-1')).resolves.toEqual(lease)
    expect(mockedFetchApi).toHaveBeenLastCalledWith('/api/super-agent/tickets/t-1/lease', undefined)
  })

  it('401/403 失败抛带 status 的 ApiError，端上据此判「无权限」而非空数据', async () => {
    mockedFetchApi.mockResolvedValue({
      success: false,
      error: '未登录或登录已过期',
      status: 401,
      errorCode: 'UNAUTHORIZED',
    })

    const error = await getSuperAgentPanel().catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect((error as ApiError).errorCode).toBe('UNAUTHORIZED')
  })
})
