/**
 * 统计模块链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 业务统计 (/cozeZhsApi/statistics/*):
 *   1. 用户使用统计返回结构化数据
 *   2. 用户行为统计返回结构化数据
 *   3. 订单统计返回结构化数据
 *   4. 智能体统计返回结构化数据
 *   5. 系统统计返回结构化数据
 *
 * B. 开发者统计 (/api/developer/statistics/*):
 *   6. 性能指标返回数组
 *   7. 错误日志返回分页数据
 *   8. 标记错误已解决返回成功消息
 *   9. 导出统计数据返回 CSV 文件
 *  10. 实时统计返回结构化数据
 *
 * 后端实现: server/app/api/v1_statistics.py
 * 真实链路验证: 所有接口返回真实结构化数据 (不是占位 action:true),
 *               验证关键字段存在且类型正确
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容 "0"/0/200/"200") */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 (403 + rate_limit) */
async function isWafBlocked(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 403) return false
  try {
    const body = await resp.json()
    return body?.blocked_by === 'rate_limit' || body?.message?.includes('速率限制')
  } catch {
    return false
  }
}

/** 统一 GET 请求, 遇到 WAF 限流自动 skip 测试 */
async function safeGet(
  request: APIRequestContext,
  path: string,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.get(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

/** 统一 POST 请求, 遇到 WAF 限流自动 skip 测试 */
async function safePost(
  request: APIRequestContext,
  path: string,
  data: unknown,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.post(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data,
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

test.describe('统计模块链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 业务统计 ==========

  test('A1. 用户使用统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/cozeZhsApi/statistics/usage?type=month', test)
    expect(resp.status(), '用户使用统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `用户使用统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    // 验证 period 时间范围
    expect(data.period, '应返回 period 对象').toBeDefined()
    expect(data.period.type, 'period.type 应为 month').toBe('month')
    // 验证 chat 会话统计
    expect(data.chat, '应返回 chat 对象').toBeDefined()
    expect(typeof data.chat.totalSessions, 'chat.totalSessions 应为数字').toBe('number')
    expect(typeof data.chat.totalMessages, 'chat.totalMessages 应为数字').toBe('number')
    expect(typeof data.chat.totalTokens, 'chat.totalTokens 应为数字').toBe('number')
    // 验证 files 文件统计
    expect(data.files, '应返回 files 对象').toBeDefined()
    expect(typeof data.files.totalFiles, 'files.totalFiles 应为数字').toBe('number')
    // 验证 tokens 令牌统计
    expect(data.tokens, '应返回 tokens 对象').toBeDefined()
    expect(typeof data.tokens.consumed, 'tokens.consumed 应为数字').toBe('number')
    expect(typeof data.tokens.recharged, 'tokens.recharged 应为数字').toBe('number')
    // 验证 orders 订单统计
    expect(data.orders, '应返回 orders 对象').toBeDefined()
    expect(typeof data.orders.totalOrders, 'orders.totalOrders 应为数字').toBe('number')
    // 验证 trends 趋势数组
    expect(Array.isArray(data.trends), 'trends 应为数组').toBe(true)
    console.log(`[A1] 用户使用统计: chat.totalSessions=${data.chat.totalSessions}, trends.length=${data.trends.length}`)
  })

  test('A2. 用户行为统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/cozeZhsApi/statistics/behavior?type=week', test)
    expect(resp.status(), '用户行为统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `用户行为统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    // 验证 login 登录统计
    expect(data.login, '应返回 login 对象').toBeDefined()
    expect(typeof data.login.loginDays, 'login.loginDays 应为数字').toBe('number')
    expect(typeof data.login.totalLoginCount, 'login.totalLoginCount 应为数字').toBe('number')
    // 验证 activeHours 活跃时段数组
    expect(Array.isArray(data.activeHours), 'activeHours 应为数组').toBe(true)
    if (data.activeHours.length > 0) {
      expect(typeof data.activeHours[0].hour, 'activeHours[0].hour 应为数字').toBe('number')
      expect(typeof data.activeHours[0].count, 'activeHours[0].count 应为数字').toBe('number')
    }
    // 验证 favoriteAgents 收藏智能体数组
    expect(Array.isArray(data.favoriteAgents), 'favoriteAgents 应为数组').toBe(true)
    // 验证 activeDays 活跃天数数组
    expect(Array.isArray(data.activeDays), 'activeDays 应为数组').toBe(true)
    console.log(`[A2] 用户行为统计: login.loginDays=${data.login.loginDays}, activeHours.length=${data.activeHours.length}`)
  })

  test('A3. 订单统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/cozeZhsApi/statistics/orders?type=month', test)
    expect(resp.status(), '订单统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `订单统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    // 验证 summary 汇总
    expect(data.summary, '应返回 summary 对象').toBeDefined()
    expect(typeof data.summary.totalOrders, 'summary.totalOrders 应为数字').toBe('number')
    expect(typeof data.summary.totalAmount, 'summary.totalAmount 应为数字').toBe('number')
    expect(typeof data.summary.paidOrders, 'summary.paidOrders 应为数字').toBe('number')
    // 验证 byPaymentMethod 按支付方式分组
    expect(Array.isArray(data.byPaymentMethod), 'byPaymentMethod 应为数组').toBe(true)
    if (data.byPaymentMethod.length > 0) {
      expect(data.byPaymentMethod[0].payType, 'byPaymentMethod[0].payType 应有值').toBeTruthy()
      expect(typeof data.byPaymentMethod[0].count, 'byPaymentMethod[0].count 应为数字').toBe('number')
    }
    // 验证 byOrderType 按订单类型分组
    expect(Array.isArray(data.byOrderType), 'byOrderType 应为数组').toBe(true)
    // 验证 trends 趋势数组
    expect(Array.isArray(data.trends), 'trends 应为数组').toBe(true)
    console.log(`[A3] 订单统计: summary.totalOrders=${data.summary.totalOrders}, byPaymentMethod.length=${data.byPaymentMethod.length}`)
  })

  test('A4. 智能体统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/cozeZhsApi/statistics/agents?type=month', test)
    expect(resp.status(), '智能体统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `智能体统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    // 验证 examine 审核统计
    expect(data.examine, '应返回 examine 对象').toBeDefined()
    expect(typeof data.examine.totalExamines, 'examine.totalExamines 应为数字').toBe('number')
    expect(typeof data.examine.approved, 'examine.approved 应为数字').toBe('number')
    expect(typeof data.examine.pending, 'examine.pending 应为数字').toBe('number')
    // 验证 buy 购买统计
    expect(data.buy, '应返回 buy 对象').toBeDefined()
    expect(typeof data.buy.totalBuys, 'buy.totalBuys 应为数字').toBe('number')
    expect(typeof data.buy.totalRevenue, 'buy.totalRevenue 应为数字').toBe('number')
    // 验证 settlement 结算统计
    expect(data.settlement, '应返回 settlement 对象').toBeDefined()
    expect(typeof data.settlement.totalSettlements, 'settlement.totalSettlements 应为数字').toBe('number')
    console.log(`[A4] 智能体统计: examine.totalExamines=${data.examine.totalExamines}, buy.totalBuys=${data.buy.totalBuys}`)
  })

  test('A5. 系统统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/cozeZhsApi/statistics/system', test)
    expect(resp.status(), '系统统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `系统统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    // 验证 users 用户统计
    expect(data.users, '应返回 users 对象').toBeDefined()
    expect(typeof data.users.totalUsers, 'users.totalUsers 应为数字').toBe('number')
    expect(typeof data.users.vipUsers, 'users.vipUsers 应为数字').toBe('number')
    expect(typeof data.users.activeUsers, 'users.activeUsers 应为数字').toBe('number')
    // 验证 orders 订单统计
    expect(data.orders, '应返回 orders 对象').toBeDefined()
    expect(typeof data.orders.totalOrders, 'orders.totalOrders 应为数字').toBe('number')
    expect(typeof data.orders.totalRevenue, 'orders.totalRevenue 应为数字').toBe('number')
    // 验证 chat 会话统计
    expect(data.chat, '应返回 chat 对象').toBeDefined()
    expect(typeof data.chat.totalConversations, 'chat.totalConversations 应为数字').toBe('number')
    // 验证 agents 智能体统计
    expect(data.agents, '应返回 agents 对象').toBeDefined()
    // 验证 files 文件统计
    expect(data.files, '应返回 files 对象').toBeDefined()
    expect(typeof data.files.totalFiles, 'files.totalFiles 应为数字').toBe('number')
    console.log(`[A5] 系统统计: users.totalUsers=${data.users.totalUsers}, orders.totalOrders=${data.orders.totalOrders}`)
  })

  // ========== B. 开发者统计 ==========

  test('B1. 性能指标返回数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/developer/statistics/performance', test)
    expect(resp.status(), '性能指标应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `性能指标 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(Array.isArray(data), '性能指标应为数组').toBe(true)
    expect(data.length, '性能指标数组应非空').toBeGreaterThan(0)
    // 验证第一条记录的关键字段
    const first = data[0]
    expect(first.endpoint, '应有 endpoint 字段').toBeTruthy()
    expect(first.method, '应有 method 字段').toBeTruthy()
    expect(typeof first.avgResponseTime, 'avgResponseTime 应为数字').toBe('number')
    expect(typeof first.totalRequests, 'totalRequests 应为数字').toBe('number')
    expect(typeof first.errorRate, 'errorRate 应为数字').toBe('number')
    expect(typeof first.successRate, 'successRate 应为数字').toBe('number')
    console.log(`[B1] 性能指标: data.length=${data.length}, first.endpoint=${first.endpoint}`)
  })

  test('B2. 错误日志返回分页数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/developer/statistics/errors?page=1&pageSize=20', test)
    expect(resp.status(), '错误日志应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `错误日志 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.list, '应返回 list 数组').toBeDefined()
    expect(Array.isArray(data.list), 'list 应为数组').toBe(true)
    expect(data.pagination, '应返回 pagination 对象').toBeDefined()
    expect(typeof data.pagination.page, 'pagination.page 应为数字').toBe('number')
    expect(typeof data.pagination.pageSize, 'pagination.pageSize 应为数字').toBe('number')
    expect(typeof data.pagination.total, 'pagination.total 应为数字').toBe('number')
    // 验证第一条日志的关键字段
    if (data.list.length > 0) {
      const first = data.list[0]
      expect(first.id, '日志应有 id 字段').toBeTruthy()
      expect(first.endpoint, '日志应有 endpoint 字段').toBeTruthy()
      expect(typeof first.statusCode, 'statusCode 应为数字').toBe('number')
    }
    console.log(`[B2] 错误日志: list.length=${data.list.length}, pagination.total=${data.pagination.total}`)
  })

  test('B3. 标记错误已解决返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/developer/statistics/errors/err_001/resolve',
      { resolved: true, note: '测试标记已解决' },
      test
    )
    expect(resp.status(), '标记错误已解决应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `标记错误已解决 code 应为成功, 实际: ${body.code}`).toBe(true)
    // 验证返回的消息包含错误 ID
    expect(body.msg, '应返回 msg 消息').toBeTruthy()
    expect(body.msg, 'msg 应包含错误 ID').toContain('err_001')
    console.log(`[B3] 标记错误已解决: msg=${body.msg}`)
  })

  test('B4. 导出统计数据返回 CSV 文件 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/developer/statistics/export', test)
    expect(resp.status(), '导出统计数据应返回 200').toBe(200)
    // 验证 Content-Type 是 CSV
    const contentType = resp.headers()['content-type']
    expect(contentType, 'Content-Type 应为 text/csv').toContain('text/csv')
    // 验证 Content-Disposition 包含文件名
    const contentDisposition = resp.headers()['content-disposition']
    expect(contentDisposition, '应有 Content-Disposition 头').toBeTruthy()
    expect(contentDisposition, 'Content-Disposition 应包含 filename').toContain('filename')
    // 验证响应体是 CSV 内容
    const text = await resp.text()
    expect(text, 'CSV 内容应非空').toBeTruthy()
    expect(text, 'CSV 应包含表头 endpoint').toContain('endpoint')
    expect(text, 'CSV 应包含方法 POST').toContain('POST')
    console.log(`[B4] 导出统计数据: contentType=${contentType}, contentLength=${text.length}`)
  })

  test('B5. 实时统计返回结构化数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/developer/statistics/realtime', test)
    expect(resp.status(), '实时统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `实时统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(typeof data.currentQPS, 'currentQPS 应为数字').toBe('number')
    expect(typeof data.currentConcurrency, 'currentConcurrency 应为数字').toBe('number')
    expect(typeof data.todayCalls, 'todayCalls 应为数字').toBe('number')
    expect(typeof data.todayCost, 'todayCost 应为数字').toBe('number')
    expect(typeof data.errorRate, 'errorRate 应为数字').toBe('number')
    expect(typeof data.avgResponseTime, 'avgResponseTime 应为数字').toBe('number')
    console.log(`[B5] 实时统计: currentQPS=${data.currentQPS}, todayCalls=${data.todayCalls}`)
  })
})
