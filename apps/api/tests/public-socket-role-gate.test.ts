// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L9242(G-998164)public-socket 查询/投递面按连接角色门控 —— 装车回归。
 *
 * 票面要件:send-message 增可选投递档位(role);与连接角色不合的请求返回
 * **明确的 no-op 结果**(sent=0 + gatedRole 计数,HTTP 200),不抛错、不断开;
 * 缺省(不传 role)= 既有语义。
 *
 * G-1080905:帧类别改由服务端按 `broadcastEventClassOf(event)` 推导 ——
 * 调用方自报的 role 只许在事件名推导不出类别时作收窄提示;自报与 event
 * 矛盾或自报 'all' 想放宽 ⇒ 一律以服务端推导为准。
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
const U_CONV = 'eeeeeeee-1111-4111-8111-111111111111'

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
    _publicSocketInternal.registerConnection(U_CONV, '127.0.0.1', 'conversation')
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

  it('③ 缺省(不传 role)不再等于不门控:帧类别按事件名推导,mcp 连接对 conversation:updated 是 no-op(G-1080905 改口径:缺省也压不过事件名)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'conversation:updated', data: {} },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 0, total: 1, gatedRole: 1 })
    // no-op 语义不破:连接保留、不抛错
    expect(_publicSocketInternal.activeConnections.get(U_MCP)).toHaveLength(1)
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

/**
 * G-1080905 成对测试:调用方自报档位与 event 矛盾 ⇒ **以服务端推导为准**。
 * (把服务端推导摘回"信调用方"时,⑥⑦⑧ 必红 —— 变异自证见票面报告。)
 */
describe('G-1080905 帧类别由服务端按事件名推导,自报只许收窄不许放宽', () => {
  beforeEach(() => {
    _publicSocketInternal.activeConnections.clear()
    _publicSocketInternal.eventHistory.length = 0
    _publicSocketInternal.registerConnection(U_MCP, '127.0.0.1', 'mcp')
    _publicSocketInternal.registerConnection(U_CONV, '127.0.0.1', 'conversation')
  })

  it('⑥ 矛盾自报:conversation:updated 谎报 role=mcp ⇒ 按 conversation 门控(mcp 连接 no-op、conversation 连接收)', async () => {
    const app = await buildApp()
    // 谎报 mcp 档 —— 不得让 mcp 连接收到 conversation 帧(信调用方时这里会 delivered)
    const toMcp = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'conversation:updated', data: {}, role: 'mcp' },
    })
    expect(toMcp.statusCode).toBe(200)
    expect(toMcp.json().data).toMatchObject({ sent: 0, total: 1, gatedRole: 1 })
    // 同一帧的合面连接照收(no-op 只作用于不合面连接)
    const toConv = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_CONV, event: 'conversation:updated', data: {}, role: 'mcp' },
    })
    expect(toConv.statusCode).toBe(200)
    expect(toConv.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('⑦ 放宽自报 role=all:mcp:status 声明 all 想不门控 ⇒ 仍按 mcp 门控(conversation 连接 no-op)', async () => {
    const app = await buildApp()
    const toConv = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_CONV, event: 'mcp:status', data: {}, role: 'all' },
    })
    expect(toConv.statusCode).toBe(200)
    expect(toConv.json().data).toMatchObject({ sent: 0, total: 1, gatedRole: 1 })
    // 合面连接照收
    const toMcp = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'mcp:status', data: {}, role: 'all' },
    })
    expect(toMcp.statusCode).toBe(200)
    expect(toMcp.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('⑧ 收窄允许:事件名推导不出类别时,自报 role 作收窄提示生效(ops:custom 报 mcp ⇒ conversation 连接 no-op)', async () => {
    const app = await buildApp()
    const toConv = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_CONV, event: 'ops:custom', data: {}, role: 'mcp' },
    })
    expect(toConv.statusCode).toBe(200)
    expect(toConv.json().data).toMatchObject({ sent: 0, total: 1, gatedRole: 1 })
    const toMcp = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'ops:custom', data: {}, role: 'mcp' },
    })
    expect(toMcp.statusCode).toBe(200)
    expect(toMcp.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })

  it('⑨ 推导不出且缺省自报 ⇒ 既有语义:不门控', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/public-socket/send-message',
      payload: { userId: U_MCP, event: 'ops:custom', data: {} },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ sent: 1, total: 1, gatedRole: 0 })
    await app.close()
  })
})
