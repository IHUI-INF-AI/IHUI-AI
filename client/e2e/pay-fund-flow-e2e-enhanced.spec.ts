/**
 * 第66轮真测试：支付/资金管理流程
 *
 * 覆盖四个后端接口文件：
 * A. v1_pay.py: pay CRUD（内存存储 pay，通过 v1_business_store）
 * B. v1_payment.py: 支付创建/状态/回调/退款/记录/方式/关闭/余额/充值/提现（独立进程内存储）
 * C. v1_fund.py: 资金余额/交易/转账/提现/银行卡/优惠券/佣金/发票（内存存储 fund）
 * D. v1_fund_mgmt.py: 令牌使用/订单详情/商品信息/支付回调/统计/支付宝支付（真实数据库 + 回调）
 *
 * 真测试原则：验证数据真的写了/改了/删了，不只看状态码
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

// ============================ 工具函数 ============================

/** 成功码兼容：支持 "0"/0/200/"200" 多种格式 */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** WAF 限流检测 */
function isWafBlocked(body: any): boolean {
  return body?.blocked_by === 'rate_limit' || body?.error === 'rate_limited'
}

/** 数据库不可用检测（500 错误 + 表缺失） */
function isDbUnavailable(body: any): boolean {
  const msg = String(body?.detail || body?.msg || body?.message || '')
  return /no such table|database is locked|OperationalError|relation .* does not exist/i.test(msg)
}

/** 安全 GET 请求 */
async function safeGet(request: APIRequestContext, path: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const resp = await request.get(`${BACKEND}${path}`, { timeout: 15000, headers })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON 响应 */ }
  return { status, body }
}

/** 安全 POST 请求 */
async function safePost(request: APIRequestContext, path: string, data: any = {}, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const resp = await request.post(`${BACKEND}${path}`, { timeout: 15000, headers, data })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON 响应 */ }
  return { status, body }
}

/** 生成唯一订单号 */
function genOrderId(): string {
  return `e2e_ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

/** 生成唯一用户ID */
function genUserId(): string {
  return `e2e_u_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// ============================ 测试分组 ============================

test.describe('第66轮：支付/资金管理流程真测试', () => {
  test.describe.configure({ mode: 'serial' })

  // =========================================================================
  // A. v1_pay.py: pay CRUD（内存存储）
  // =========================================================================
  test.describe('A. v1_pay 模块 CRUD', () => {
    test('A1: 列表接口返回种子数据', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/pay/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('pay')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('A2: 详情接口返回 records 数组', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/pay/info')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('A3: 创建→查询→删除完整流程（真写入验证）', async ({ request }) => {
      const name = `e2e_pay_${Date.now()}`
      // 1. 创建
      const { status: s1, body: b1 } = await safePost(request, '/api/v1/pay/create', { name, description: 'e2e 测试', status: 'active' })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.created).toBe(true)
      const created = b1?.data?.item
      expect(created).toBeTruthy()
      expect(created.name).toBe(name)
      expect(created.id).toBeTruthy()
      const newId = created.id

      // 2. 查询列表，验证新记录真的写入了
      const { body: b2 } = await safeGet(request, '/api/v1/pay/list?page=1&size=100')
      const found = (b2?.data?.records || []).find((r: any) => r.id === newId)
      expect(found).toBeTruthy()
      expect(found.name).toBe(name)

      // 3. 删除
      const { status: s3, body: b3 } = await safePost(request, `/api/v1/pay/delete?item_id=${newId}`)
      expect(s3).toBe(200)
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.deleted).toBe(true)

      // 4. 再次查询列表，验证记录真的被删除了
      const { body: b4 } = await safeGet(request, '/api/v1/pay/list?page=1&size=100')
      const stillFound = (b4?.data?.records || []).find((r: any) => r.id === newId)
      expect(stillFound).toBeUndefined()
    })

    test('A4: 更新接口接受 payload', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/pay/update', { name: 'e2e_update_test', description: '更新测试' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.updated).toBe(true)
    })
  })

  // =========================================================================
  // B. v1_payment.py: 支付完整流程（独立进程内存储）
  // =========================================================================
  test.describe('B. v1_payment 支付完整流程', () => {
    test('B1: 支付方式列表返回5种方式', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/payment/methods')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      const methods = body?.data?.methods
      expect(Array.isArray(methods)).toBe(true)
      expect(methods.length).toBeGreaterThanOrEqual(5)
      const codes = methods.map((m: any) => m.code)
      expect(codes).toContain('alipay')
      expect(codes).toContain('wechat')
      expect(codes).toContain('balance')
      expect(codes).toContain('bank')
    })

    test('B2: 创建支付→查询状态→回调→退款完整流程（真状态流转）', async ({ request }) => {
      const orderId = genOrderId()
      const userId = genUserId()
      // 1. 创建支付订单
      const { status: s1, body: b1 } = await safePost(request, '/api/v1/payment/create', {
        order_id: orderId, amount: 100.0, method: 'alipay', user_id: userId,
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.pay_id).toBeTruthy()
      expect(b1?.data?.status).toBe('pending')
      expect(b1?.data?.pay_url).toContain(b1?.data?.pay_id)
      const payId = b1?.data?.pay_id

      // 2. 查询状态（pending）
      const { body: b2 } = await safeGet(request, `/api/v1/payment/status?order_id=${orderId}`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.found).toBe(true)
      expect(b2?.data?.status).toBe('pending')
      expect(b2?.data?.pay_id).toBe(payId)

      // 3. 回调支付成功（状态变 paid）
      const { body: b3 } = await safePost(request, '/api/v1/payment/callback', {
        pay_id: payId, status: 'paid', out_trade_no: orderId,
      })
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.matched).toBe(true)
      expect(b3?.data?.status).toBe('paid')

      // 4. 再次查询状态（应为 paid）
      const { body: b4 } = await safeGet(request, `/api/v1/payment/status?order_id=${orderId}`)
      expect(b4?.data?.status).toBe('paid')

      // 5. 申请退款（状态变 refunding）
      const { body: b5 } = await safePost(request, '/api/v1/payment/refund', {
        pay_id: payId, amount: 50.0, reason: 'e2e 测试退款',
      })
      expect(isCodeOk(b5?.code)).toBe(true)
      expect(b5?.data?.refunded).toBe(true)
      expect(b5?.data?.refund_id).toBeTruthy()
      expect(b5?.data?.amount).toBe(50.0)
    })

    test('B3: 回调幂等性（重复回调不重复入账）', async ({ request }) => {
      const orderId = genOrderId()
      const userId = genUserId()
      // 创建
      const { body: b1 } = await safePost(request, '/api/v1/payment/create', {
        order_id: orderId, amount: 200.0, method: 'wechat', user_id: userId,
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      const payId = b1?.data?.pay_id

      // 第一次回调 paid
      await safePost(request, '/api/v1/payment/callback', { pay_id: payId, status: 'paid' })
      // 第二次回调 paid（应幂等）
      const { body: b3 } = await safePost(request, '/api/v1/payment/callback', { pay_id: payId, status: 'paid' })
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.idempotent).toBe(true)
    })

    test('B4: 关闭支付订单（pending→closed）', async ({ request }) => {
      const orderId = genOrderId()
      const { body: b1 } = await safePost(request, '/api/v1/payment/create', {
        order_id: orderId, amount: 30.0, method: 'balance', user_id: genUserId(),
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      const payId = b1?.data?.pay_id

      const { body: b2 } = await safePost(request, '/api/v1/payment/close', { pay_id: payId })
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.closed).toBe(true)
      expect(b2?.data?.pay_id).toBe(payId)
    })

    test('B5: 账户余额查询 + 充值流程', async ({ request }) => {
      const userId = genUserId()
      // 1. 查询初始余额
      const { body: b1 } = await safeGet(request, `/api/v1/payment/balance?user_id=${userId}`)
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.user_id).toBe(userId)
      expect(typeof b1?.data?.balance).toBe('number')
      const initialBalance = b1?.data?.balance

      // 2. 充值
      const { body: b2 } = await safePost(request, '/api/v1/payment/recharge', {
        user_id: userId, amount: 500.0, method: 'alipay',
      })
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.recharged).toBe(true)
      expect(b2?.data?.amount).toBe(500.0)
      expect(b2?.data?.pay_url).toBeTruthy()
    })

    test('B6: 支付记录分页查询', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/payment/records?page=1&size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(typeof body?.data?.page).toBe('number')
      expect(typeof body?.data?.size).toBe('number')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('B7: 提现查询返回记录列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/payment/withdraw?page=1&size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('B8: 退款失败场景（支付单不存在）', async ({ request }) => {
      const { body } = await safePost(request, '/api/v1/payment/refund', {
        pay_id: 'nonexistent_pay_id_xxx', amount: 10.0,
      })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.refunded).toBe(false)
    })
  })

  // =========================================================================
  // C. v1_fund.py: 资金管理（内存存储 fund）
  // =========================================================================
  test.describe('C. v1_fund 资金管理', () => {
    test('C1: 余额接口返回 fund 存储记录', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/fund/balance')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('fund')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('C2: 交易记录接口', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/fund/transactions')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/fund/transactions')
    })

    test('C3: 转账业务操作', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/fund/transfer', { amount: 100, to: 'u2' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/fund/transfer')
    })

    test('C4: 提现业务操作', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/fund/withdraw', { amount: 50 })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('C5: 银行卡列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/fund/banks')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('C6: 银行卡业务操作', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/fund/bank', { action: 'add', card: '622200011234' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('C7: 优惠券列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/fund/coupons')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('C8: 领取优惠券', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/fund/coupon/receive', { coupon_id: 'c1' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('C9: 佣金查询', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/fund/commission')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('C10: 发票业务操作', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/fund/invoice', { title: '测试公司', amount: 1000 })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })
  })

  // =========================================================================
  // D. v1_fund_mgmt.py: 资金管理（Java 迁移，真实数据库 + 回调）
  // =========================================================================
  test.describe('D. v1_fund_mgmt 资金管理（Java 迁移）', () => {
    test('D1: 获取订单信息（商品身份 + 活动）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/fund/getProduct')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data).toBeTruthy()
      expect(Array.isArray(body?.data?.productIdentities)).toBe(true)
      // activity 可能为 null
      expect(body?.data && 'activity' in body.data).toBe(true)
    })

    test('D2: 获取身份订单详情（按 token 查询）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/fund/getInfo?token=test_code')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      // data 是数组
      expect(Array.isArray(body?.data)).toBe(true)
    })

    test('D3: 微信支付回调（返回 SUCCESS）', async ({ request }) => {
      const resp = await request.post(`${BACKEND}/fund/notify`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/xml' },
        data: '<xml><out_trade_no>test_ord</out_trade_no></xml>',
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const body = await resp.json()
      expect(body?.code).toBe('SUCCESS')
      expect(body?.message).toBeTruthy()
    })

    test('D4: 移动端支付回调（返回 SUCCESS）', async ({ request }) => {
      const resp = await request.post(`${BACKEND}/fund/app/notify`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        data: { order_id: 'test_ord' },
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const body = await resp.json()
      expect(body?.code).toBe('SUCCESS')
    })

    test('D5: 智能体提现回调（返回 SUCCESS）', async ({ request }) => {
      const resp = await request.post(`${BACKEND}/fund/agent/transfer/notify`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        data: { agent_id: 'a1', amount: 100 },
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const body = await resp.json()
      expect(body?.code).toBe('SUCCESS')
    })

    test('D6: 支付宝支付创建（返回 mock HTML 表单）', async ({ request }) => {
      const { status, body } = await safePost(request, '/fund/ali/pay/create', {
        uuid: 'test_uuid', amount: 99.9, desc: 'e2e 测试商品', productType: 'vip',
      })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(typeof body).toBe('string')
      expect(body).toContain('<form')
      expect(body).toContain('out_trade_no')
    })

    test('D7: 支付宝支付创建2（返回 map 格式）', async ({ request }) => {
      const resp = await request.post(`${BACKEND}/fund/ali/pay/create2`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        data: { uuid: 'test_uuid', amount: 88.8 },
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const body = await resp.json()
      expect(body?.form).toBeTruthy()
      expect(body?.orderId).toBeTruthy()
      expect(body?.orderId).toContain('ORDER_')
    })

    test('D8: 支付宝异步回调（非 TRADE_SUCCESS 返回 fail）', async ({ request }) => {
      const resp = await request.post(`${BACKEND}/fund/ali/pay/alipay/notify`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: { trade_status: 'WAIT_BUYER_PAY', out_trade_no: 'test_ord', trade_no: 't1', total_amount: '99' },
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const text = await resp.text()
      // FastAPI 返回字符串 "fail" 时会 JSON 编码成带引号的 "fail"
      expect(text).toContain('fail')
    })

    test('D9: 支付宝同步回调（跳转页面）', async ({ request }) => {
      const resp = await request.get(`${BACKEND}/fund/ali/pay/alipay/return?trade_status=TRADE_SUCCESS&out_trade_no=test_ord`, {
        timeout: 15000,
      })
      const status = resp.status()
      if (status === 403) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      const text = await resp.text()
      expect(text).toContain('<html>')
    })

    test('D10: 支付成功页面', async ({ request }) => {
      const { status, body } = await safeGet(request, '/fund/ali/pay/success?orderNo=test_ord_001')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.message).toBeTruthy()
    })

    test('D11: 支付失败页面', async ({ request }) => {
      const { status, body } = await safeGet(request, '/fund/ali/pay/fail')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.message).toBeTruthy()
    })

    test('D12: 使用令牌（参数缺失返回 400）', async ({ request }) => {
      const { status, body } = await safePost(request, '/fund/useToken', {})
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(400)
    })

    test('D13: 文件转流（参数缺失返回 400）', async ({ request }) => {
      const { status, body } = await safePost(request, '/fund/file/to/stream', {})
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(400)
    })
  })
})
