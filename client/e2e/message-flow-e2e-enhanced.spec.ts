/**
 * 消息通知链路端到端真实联调测试（增强版）
 *
 * 与 v1-message.spec.ts 的区别:
 * - 旧版只测 "查" (列表/未读数), 不测 "改" (发送/已读/删除)
 * - 本文件测完整的消息流转, 验证数据真的写了/改了/删了
 *
 * 测试链路（基于后端真实接口 /api/v1/message/*）:
 *
 * A. 消息列表查询:
 *   1. 消息列表返回 records 数组 → 验证 total 和 records 结构
 *   2. 分页查询 → 验证 page/size 参数生效
 *
 * B. 发送站内信:
 *   3. 发送站内信 → 验证返回完整消息对象 (id/title/content/status=0)
 *   4. 发送后未读数量增加 → 验证 unread 真的 +1
 *
 * C. 标记已读:
 *   5. 标记单条已读 → 验证返回 true
 *   6. 标记后未读数量减少 → 验证 unread 真的 -1
 *   7. 批量标记已读 → 验证返回 true
 *   8. 全部标记已读 → 验证未读数量变成 0
 *
 * D. 删除消息:
 *   9. 删除单条消息 → 验证返回 true
 *  10. 批量删除消息 → 验证返回 true
 *
 * E. 消息类型与优先级:
 *  11. 发送不同类型消息 (system/notification/reminder) → 验证 type 字段正确
 *  12. 发送不同优先级消息 (high/medium/low) → 验证 priority 字段正确
 *
 * 后端实现: server/app/api/v1_message.py
 * 真实链路验证: 发送的消息真的写入 _MOCK_MESSAGES, 未读数量真的变化
 *
 * 注意: 后端 list 接口和 send/unread-count 操作的是两套独立存储
 * (list 用 v1_business_store 种子数据, send/unread-count 用 _MOCK_MESSAGES)
 * 这是后端设计, 测试测真实行为
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容 "0"/0/200/"200") */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 生成唯一标识 */
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

/** 发送站内信, 返回新消息对象 */
async function sendMessage(
  request: APIRequestContext,
  options: {
    type?: string
    title?: string
    content?: string
    priority?: string
    category?: string
    userId?: string
  } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const resp = await request.post(`${BACKEND}/api/v1/message/send`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data: {
      type: options.type || 'system',
      title: options.title || uniqueId('e2e_msg'),
      content: options.content || 'e2e测试内容',
      priority: options.priority || 'medium',
      category: options.category || 'system',
      userId: options.userId || 'e2e_test_user',
    },
  })
  let body: Record<string, unknown> = {}
  try {
    body = await resp.json()
  } catch {
    // 非 JSON
  }
  if (isWafBlocked(resp.status(), body)) { test.skip(); return { status: 0, body: {} } }
  return { status: resp.status(), body }
}

/** 判断是否被 WAF 限流 */
function isWafBlocked(status: number, body: any): boolean {
  return status === 403 || body?.blocked_by === 'rate_limit' || body?.error === 'rate_limited'
}

/** 查询未读数量 */
async function getUnreadCount(
  request: APIRequestContext
): Promise<{ unread: number; total: number }> {
  const resp = await request.get(`${BACKEND}/api/v1/message/unread-count`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })
  const body = await resp.json()
  if (isWafBlocked(resp.status(), body)) { test.skip(); return { unread: 0, total: 0 } }
  const data = (body.data ?? {}) as { unread: number; total: number }
  return { unread: data.unread ?? 0, total: data.total ?? 0 }
}

test.describe.configure({ mode: 'serial' })

test.describe('消息通知链路端到端联调（增强版）', () => {
  test.setTimeout(30000)

  // ========== A. 消息列表查询 ==========

  test('A1. 消息列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v1/message/list?page=1&size=10`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body1 = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body1)) { test.skip(); return }
    expect(resp.status(), '消息列表应返回 200').toBe(200)
    const body = body1
    expect(isCodeOk(body.code), `列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // 真实接口: data 直接是数组, total 在顶层
    const records = Array.isArray(body.data) ? body.data : (body.data?.records ?? [])
    const total = body.total ?? body.data?.total ?? 0
    expect(Array.isArray(records), '应返回数组').toBe(true)
    expect(total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 消息列表: total=${total}, records数量=${records.length}`)
  })

  test('A2. 分页查询参数生效 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查第 1 页, 每页 2 条
    const resp = await request.get(`${BACKEND}/api/v1/message/list?page=1&size=2`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '分页查询应返回 200').toBe(200)
    // 真实接口: data 直接是数组
    const records = Array.isArray(body.data) ? body.data : (body.data?.records ?? [])
    expect(records.length, '第1页最多2条').toBeLessThanOrEqual(2)
    console.log(`[A2] 分页生效: 返回${records.length}条`)
  })

  // ========== B. 发送站内信 ==========

  test('B1. 发送站内信返回完整消息对象 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const title = uniqueId('e2e_send')
    const content = '这是B1测试内容'

    const { status, body } = await sendMessage(request, {
      type: 'system',
      title,
      content,
      priority: 'high',
      category: 'system',
    })
    expect(status, '发送应返回 200').toBe(200)
    expect(isCodeOk(body.code), `发送 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data as Record<string, unknown>
    expect(data.id, '应返回消息 id').toBeTruthy()
    expect(data.title, `title 应为 ${title}`).toBe(title)
    expect(data.content, `content 应为 ${content}`).toBe(content)
    expect(data.type, 'type 应为 system').toBe('system')
    expect(data.priority, 'priority 应为 high').toBe('high')
    expect(data.status, '新消息 status 应为 0 (未读)').toBe(0)
    expect(data.createTime, '应返回 createTime').toBeTruthy()
    console.log(`[B1] 发送成功: id=${data.id}, title=${title}`)
  })

  test('B2. 发送后未读数量增加 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先记录发送前的未读数量
    const before = await getUnreadCount(request)
    console.log(`[B2] 发送前: unread=${before.unread}, total=${before.total}`)

    // 发送一条新消息
    const { status, body } = await sendMessage(request, { title: uniqueId('e2e_unread') })
    expect(status, '发送应返回 200').toBe(200)

    // 再查未读数量, 应该 +1
    const after = await getUnreadCount(request)
    console.log(`[B2] 发送后: unread=${after.unread}, total=${after.total}`)
    expect(after.unread, `发送后未读应增加, before=${before.unread}, after=${after.unread}`).toBe(before.unread + 1)
    expect(after.total, `发送后总数应增加, before=${before.total}, after=${after.total}`).toBe(before.total + 1)
  })

  // ========== C. 标记已读 ==========

  test('C1. 标记单条已读返回 true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发一条新消息
    const { body: sendBody } = await sendMessage(request, { title: uniqueId('e2e_read') })
    const msgId = (sendBody.data as Record<string, unknown>).id as string
    expect(msgId, '应拿到消息 id').toBeTruthy()

    // 标记已读
    const resp = await request.post(`${BACKEND}/api/v1/message/${msgId}/read`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '标记已读应返回 200').toBe(200)
    expect(isCodeOk(body.code), `标记已读 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 true').toBe(true)
    console.log(`[C1] 标记已读成功: id=${msgId}`)
  })

  test('C2. 标记已读后未读数量减少 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发一条新消息
    const { body: sendBody } = await sendMessage(request, { title: uniqueId('e2e_read_dec') })
    const msgId = (sendBody.data as Record<string, unknown>).id as string

    // 记录发送后的未读数量
    const before = await getUnreadCount(request)
    console.log(`[C2] 标记前: unread=${before.unread}`)

    // 标记已读
    await request.post(`${BACKEND}/api/v1/message/${msgId}/read`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })

    // 再查未读数量, 应该 -1
    const after = await getUnreadCount(request)
    console.log(`[C2] 标记后: unread=${after.unread}`)
    expect(after.unread, `标记后未读应减少, before=${before.unread}, after=${after.unread}`).toBe(before.unread - 1)
  })

  test('C3. 批量标记已读返回 true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发 2 条新消息
    const { body: b1 } = await sendMessage(request, { title: uniqueId('e2e_batch1') })
    const { body: b2 } = await sendMessage(request, { title: uniqueId('e2e_batch2') })
    const id1 = (b1.data as Record<string, unknown>).id as string
    const id2 = (b2.data as Record<string, unknown>).id as string

    // 批量标记已读
    const resp = await request.post(`${BACKEND}/api/v1/message/batch-read`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { messageIds: [id1, id2] },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '批量标记应返回 200').toBe(200)
    expect(isCodeOk(body.code), `批量标记 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 true').toBe(true)
    console.log(`[C3] 批量标记已读成功: ids=${id1},${id2}`)
  })

  test('C4. 全部标记已读后未读数量变成 0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发 1 条确保有未读
    await sendMessage(request, { title: uniqueId('e2e_all_read') })

    // 全部标记已读
    const resp = await request.post(`${BACKEND}/api/v1/message/read-all`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '全部标记应返回 200').toBe(200)
    expect(isCodeOk(body.code), `全部标记 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 true').toBe(true)

    // 再查未读数量, 应该为 0
    const after = await getUnreadCount(request)
    expect(after.unread, `全部标记后未读应为 0, 实际: ${after.unread}`).toBe(0)
    console.log(`[C4] 全部标记已读成功: unread=${after.unread}`)
  })

  // ========== D. 删除消息 ==========

  test('D1. 删除单条消息返回 true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发一条新消息
    const { body: sendBody } = await sendMessage(request, { title: uniqueId('e2e_del') })
    const msgId = (sendBody.data as Record<string, unknown>).id as string

    // 删除消息
    const resp = await request.delete(`${BACKEND}/api/v1/message/${msgId}`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '删除应返回 200').toBe(200)
    expect(isCodeOk(body.code), `删除 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 true').toBe(true)
    console.log(`[D1] 删除成功: id=${msgId}`)
  })

  test('D2. 批量删除消息返回 true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先发 2 条新消息
    const { body: b1 } = await sendMessage(request, { title: uniqueId('e2e_bdel1') })
    const { body: b2 } = await sendMessage(request, { title: uniqueId('e2e_bdel2') })
    const id1 = (b1.data as Record<string, unknown>).id as string
    const id2 = (b2.data as Record<string, unknown>).id as string

    // 批量删除
    const resp = await request.post(`${BACKEND}/api/v1/message/batch-delete`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { messageIds: [id1, id2] },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '批量删除应返回 200').toBe(200)
    expect(isCodeOk(body.code), `批量删除 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 true').toBe(true)
    console.log(`[D2] 批量删除成功: ids=${id1},${id2}`)
  })

  // ========== E. 消息类型与优先级 ==========

  test('E1. 发送不同类型消息 type 字段正确 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const types = ['system', 'notification', 'reminder']

    for (const type of types) {
      const { status, body } = await sendMessage(request, {
        type,
        title: uniqueId(`e2e_type_${type}`),
      })
      expect(status, `发送 ${type} 类型应返回 200`).toBe(200)
      const data = body.data as Record<string, unknown>
      expect(data.type, `type 应为 ${type}, 实际: ${data.type}`).toBe(type)
      console.log(`[E1] 类型 ${type} 正确`)
    }
  })

  test('E2. 发送不同优先级消息 priority 字段正确 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const priorities = ['high', 'medium', 'low']

    for (const priority of priorities) {
      const { status, body } = await sendMessage(request, {
        priority,
        title: uniqueId(`e2e_pri_${priority}`),
      })
      expect(status, `发送 ${priority} 优先级应返回 200`).toBe(200)
      const data = body.data as Record<string, unknown>
      expect(data.priority, `priority 应为 ${priority}, 实际: ${data.priority}`).toBe(priority)
      console.log(`[E2] 优先级 ${priority} 正确`)
    }
  })
})
