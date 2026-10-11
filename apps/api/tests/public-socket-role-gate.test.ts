// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L9242(G-998164)public-socket 查询/投递面按连接角色门控 —— 装车回归。
 *
 * 票面要件:send-message 增可选投递档位(role);与连接角色不合的请求返回
 * **明确的 no-op 结果**(sent=0 + gatedRole 计数,HTTP 200),不抛错、不断开;
 * 缺省(不传 role)= 既有语义。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
}))
vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: vi.fn(async () => true),
}))

import { publicSocketRoutes, _publicSocketInternal } from '../src/routes/public-socket.js'

const U_ALL = 'bbbbbbbb-1111-4111-8111-111111111111'
const U_MCP = 'cccccccc-1111-4111-8111-111111111111'

async function buildApp() {
  const app = Fastify()
  await app.register(publicSocketRoutes)
  await app.ready()
  return app
}

describe('L9242 public-socket 投递档位与连接角色', () => {
  beforeEach(() => {
    _publicSocketInternal.activeConnections.clear()
    _publicSocketInternal.eventHistory.length = 0
    _publicSocketInternal.registerConnection(U_ALL, '127.0.0.1')
    _publicSocketInternal.registerConnection(U_MCP, '127.0.0.1', 'mcp')
  })

  it('① 正向:档位与角色合面 ⇒ 照常投递(sentCount 递增)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'mcp:status', data: { state: 'connected' }, role: 'mcp' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('② 反向 no-op:档位与角色不合 ⇒ sent=0 + gatedRole=1,HTTP 200 不抛错,连接保留', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: {
        userId: U_MCP,
        event: 'conversation:updated',
        data: { conversationId: 'c1' },
        role: 'conversation',
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 0, total: 1, gatedRole: 1 })
    // 连接未被摘除,角色位仍在
    const conn = _publicSocketInternal.activeConnections.get(U_MCP)![0]!
    expect(conn.role).toBe('mcp')
    // 事件台账按 no-op 记 skipped
    expect(_publicSocketInternal.eventHistory.at(-1)?.status).toBe('skipped')
    await app.close()
  })

  it('③ 缺省(不传 role)= 既有语义:mcp 角色连接照收任意事件', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'conversation:updated', data: {} },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('④ all 角色连接(缺省注册)在任何档位下都不被门控', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_ALL, event: 'mcp:status', data: {}, role: 'mcp' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('⑤ register 带 role ⇒ /connections 查询面可见角色位', async () => {
    const app = await buildApp()
    const reg = await app.inject({
      method: 'POST',
      url: '/public-socket/register',
      payload: { userId: 'dddddddd-1111-4111-8111-111111111111', modelId: 'm', chatId: 'c', role: 'mcp' },
    })
    expect(reg.statusCode).toBe(201)
    const list = await app.inject({
      method: 'GET',
      url: '/public-socket/connections?userId=dddddddd-1111-4111-8111-111111111111',
    })
    expect(list.json().data.list[0]?.role).toBe('mcp')
    await app.close()
  })
})
