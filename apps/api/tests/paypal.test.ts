import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isPaypalConfigured,
  isWebhookVerificationReady,
  centsToYuanString,
  isSubscribedEvent,
  SUBSCRIBED_EVENTS,
  verifyWebhookSignature,
  getAccessToken,
  createOrder,
  captureOrder,
  getOrderStatus,
  refundCapture,
  __clearTokenCacheForTests,
  type PaypalWebhookHeaders,
} from '../src/services/paypal.js'

describe('paypal service', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    __clearTokenCacheForTests()
    // 测试环境默认无 PayPal 配置
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    delete process.env.PAYPAL_WEBHOOK_ID
    delete process.env.PAYPAL_API_BASE
    delete process.env.PAYPAL_RETURN_URL
    delete process.env.PAYPAL_CANCEL_URL
    // 默认 mock fetch 返回 401(模拟无凭证调用 PayPal)
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":"invalid_client"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  afterEach(() => {
    __clearTokenCacheForTests()
    global.fetch = originalFetch
    // 恢复 env
    for (const k of [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'PAYPAL_WEBHOOK_ID',
      'PAYPAL_API_BASE',
      'PAYPAL_RETURN_URL',
      'PAYPAL_CANCEL_URL',
      'NODE_ENV',
    ]) {
      if (k in originalEnv) {
        process.env[k] = originalEnv[k as keyof typeof originalEnv]
      } else {
        delete process.env[k]
      }
    }
  })

  // ==========================================================================
  // 配置检测
  // ==========================================================================

  describe('isPaypalConfigured', () => {
    it('无 client id/secret 时返回 false', () => {
      expect(isPaypalConfigured()).toBe(false)
    })

    it('仅有 client id 时返回 false', () => {
      process.env.PAYPAL_CLIENT_ID = 'test-id'
      expect(isPaypalConfigured()).toBe(false)
    })

    it('client id + secret 都配置时返回 true', () => {
      process.env.PAYPAL_CLIENT_ID = 'test-id'
      process.env.PAYPAL_CLIENT_SECRET = 'test-secret'
      expect(isPaypalConfigured()).toBe(true)
    })
  })

  describe('isWebhookVerificationReady', () => {
    it('无 webhook id 时返回 false', () => {
      expect(isWebhookVerificationReady()).toBe(false)
    })

    it('配置 webhook id 时返回 true', () => {
      process.env.PAYPAL_WEBHOOK_ID = 'WH-XXX'
      expect(isWebhookVerificationReady()).toBe(true)
    })
  })

  // ==========================================================================
  // 金额转换(cents → PayPal "元字符串")
  // ==========================================================================

  describe('centsToYuanString', () => {
    it('整数分转 2 位小数', () => {
      expect(centsToYuanString(1099)).toBe('10.99')
      expect(centsToYuanString(100)).toBe('1.00')
      expect(centsToYuanString(1)).toBe('0.01')
    })

    it('大额金额正确转换', () => {
      expect(centsToYuanString(100000)).toBe('1000.00')
      expect(centsToYuanString(99999999)).toBe('999999.99')
    })

    it('0 分返回 "0.00"', () => {
      expect(centsToYuanString(0)).toBe('0.00')
    })

    it('非整除场景四舍五入到 2 位', () => {
      // 199 分 = 1.99 元
      expect(centsToYuanString(199)).toBe('1.99')
      // 12345 分 = 123.45 元
      expect(centsToYuanString(12345)).toBe('123.45')
    })
  })

  // ==========================================================================
  // Webhook 事件订阅过滤
  // ==========================================================================

  describe('isSubscribedEvent', () => {
    it('订阅清单包含 4 个支付关键事件', () => {
      expect(SUBSCRIBED_EVENTS.size).toBe(4)
      expect(SUBSCRIBED_EVENTS.has('CHECKOUT.ORDER.APPROVED')).toBe(true)
      expect(SUBSCRIBED_EVENTS.has('PAYMENT.CAPTURE.COMPLETED')).toBe(true)
      expect(SUBSCRIBED_EVENTS.has('PAYMENT.CAPTURE.REFUNDED')).toBe(true)
      expect(SUBSCRIBED_EVENTS.has('PAYMENT.CAPTURE.DENIED')).toBe(true)
    })

    it('订阅事件返回 true', () => {
      expect(isSubscribedEvent('PAYMENT.CAPTURE.COMPLETED')).toBe(true)
      expect(isSubscribedEvent('CHECKOUT.ORDER.APPROVED')).toBe(true)
      expect(isSubscribedEvent('PAYMENT.CAPTURE.REFUNDED')).toBe(true)
      expect(isSubscribedEvent('PAYMENT.CAPTURE.DENIED')).toBe(true)
    })

    it('未订阅事件返回 false', () => {
      expect(isSubscribedEvent('PAYMENT.AUTHORIZATION.CREATED')).toBe(false)
      expect(isSubscribedEvent('BILLING.SUBSCRIPTION.ACTIVATED')).toBe(false)
      expect(isSubscribedEvent('')).toBe(false)
      expect(isSubscribedEvent('unknown.event')).toBe(false)
    })
  })

  // ==========================================================================
  // Webhook 验签
  // ==========================================================================

  describe('verifyWebhookSignature', () => {
    const validHeaders: PaypalWebhookHeaders = {
      transmissionId: 'trans-id-xxx',
      transmissionTime: '2026-07-28T00:00:00Z',
      transmissionSig: 'sig-xxx',
      certUrl: 'https://api-m.paypal.com/cert',
      authAlgo: 'SHA256withRSA',
    }

    it('DEV 环境无 PAYPAL_WEBHOOK_ID 时降级直接 parse payload', async () => {
      process.env.NODE_ENV = 'development'
      const payload = JSON.stringify({
        id: 'evt-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: { id: 'cap-1', custom_id: 'PP20260728' },
      })
      const event = await verifyWebhookSignature(payload, validHeaders)
      expect(event.id).toBe('evt-1')
      expect(event.event_type).toBe('PAYMENT.CAPTURE.COMPLETED')
      expect(event.resource).toEqual({ id: 'cap-1', custom_id: 'PP20260728' })
    })

    it('test 环境无 PAYPAL_WEBHOOK_ID 时也降级 parse', async () => {
      // vitest 默认 NODE_ENV=test,不等于 production
      const payload = JSON.stringify({
        id: 'evt-2',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource_type: 'checkout-order',
        resource: {},
      })
      const event = await verifyWebhookSignature(payload, validHeaders)
      expect(event.id).toBe('evt-2')
      expect(event.event_type).toBe('CHECKOUT.ORDER.APPROVED')
    })

    it('生产环境无 PAYPAL_WEBHOOK_ID 时抛错(拒绝未验签事件)', async () => {
      process.env.NODE_ENV = 'production'
      const payload = JSON.stringify({ id: 'evt-3', event_type: 'x' })
      await expect(verifyWebhookSignature(payload, validHeaders)).rejects.toThrow(
        'PAYPAL_WEBHOOK_ID not configured',
      )
    })

    it('DEV 环境无 PAYPAL_WEBHOOK_ID 时即使 event_type 未订阅也直接 parse(验签不等于事件过滤)', async () => {
      process.env.NODE_ENV = 'development'
      const payload = JSON.stringify({
        id: 'evt-4',
        event_type: 'UNKNOWN.EVENT',
        resource_type: 'x',
        resource: {},
      })
      const event = await verifyWebhookSignature(payload, validHeaders)
      expect(event.event_type).toBe('UNKNOWN.EVENT')
    })

    it('配置 PAYPAL_WEBHOOK_ID 时调用 Verify-API 返回 SUCCESS 则验签通过', async () => {
      process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST'
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      // 第一次 fetch:OAuth2 token;第二次 fetch:verify-webhook-signature
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-xxx', expires_in: 32400 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      global.fetch = mockFetch

      const payload = JSON.stringify({
        id: 'evt-5',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: { id: 'cap-5', custom_id: 'PP20260728005' },
      })
      const event = await verifyWebhookSignature(payload, validHeaders)
      expect(event.id).toBe('evt-5')
      expect(event.event_type).toBe('PAYMENT.CAPTURE.COMPLETED')
      // 验证调用了 2 次 fetch(token + verify)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      // 第二次调用的 URL 含 verify-webhook-signature
      const secondCallUrl = String(mockFetch.mock.calls[1][0])
      expect(secondCallUrl).toContain('/v1/notifications/verify-webhook-signature')
    })

    it('Verify-API 返回 FAILURE 时抛错(拒绝伪造事件)', async () => {
      process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST'
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-xxx', expires_in: 32400 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ verification_status: 'FAILURE' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

      const payload = JSON.stringify({ id: 'evt-6', event_type: 'x' })
      await expect(verifyWebhookSignature(payload, validHeaders)).rejects.toThrow(
        /signature verification failed/,
      )
    })

    it('Verify-API HTTP 非 200 时抛错', async () => {
      process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST'
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-xxx', expires_in: 32400 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response('{"error":"bad"}', {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

      const payload = JSON.stringify({ id: 'evt-7', event_type: 'x' })
      await expect(verifyWebhookSignature(payload, validHeaders)).rejects.toThrow(
        /verify-webhook-signature failed: 500/,
      )
    })
  })

  // ==========================================================================
  // OAuth2 token(无配置时 fetch 失败 → 抛错)
  // ==========================================================================

  describe('getAccessToken', () => {
    it('无配置时 PayPal 返回 401 抛错', async () => {
      await expect(getAccessToken()).rejects.toThrow(/PayPal OAuth2 token failed: 401/)
    })

    it('成功获取 token 后缓存命中,第二次不调 fetch', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'cached-token', expires_in: 32400 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      global.fetch = mockFetch

      const t1 = await getAccessToken()
      expect(t1).toBe('cached-token')
      const t2 = await getAccessToken()
      expect(t2).toBe('cached-token')
      // 缓存命中,只调了 1 次 fetch
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('token 过期后重新获取(模拟过期)', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-1', expires_in: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-2', expires_in: 32400 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      global.fetch = mockFetch

      const t1 = await getAccessToken()
      expect(t1).toBe('token-1')
      // 等 token 过期(expires_in=1s,缓存提前 60s 失效,所以立即过期)
      const t2 = await getAccessToken()
      expect(t2).toBe('token-2')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ==========================================================================
  // Orders API(无配置时因 getAccessToken 失败而抛错)
  // ==========================================================================

  describe('createOrder', () => {
    it('无配置时抛错(依赖 getAccessToken)', async () => {
      await expect(
        createOrder({
          outTradeNo: 'PP20260728001',
          amountYuan: '10.99',
          currency: 'USD',
          description: 'Test order',
        }),
      ).rejects.toThrow(/PayPal OAuth2 token failed/)
    })

    it('成功创建订单时返回 id/status/links,请求体含 intent=CAPTURE', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'PAYID-XXX',
              status: 'CREATED',
              links: [
                { href: 'https://approve', rel: 'approve', method: 'GET' },
                { href: 'https://self', rel: 'self', method: 'GET' },
              ],
            }),
            { status: 201 },
          ),
        )
      global.fetch = mockFetch

      const result = await createOrder({
        outTradeNo: 'PP20260728001',
        amountYuan: '10.99',
        currency: 'USD',
        description: 'Test order',
        returnUrl: 'https://app.example.com/return',
        cancelUrl: 'https://app.example.com/cancel',
      })
      expect(result.id).toBe('PAYID-XXX')
      expect(result.status).toBe('CREATED')
      const approveLink = result.links.find((l) => l.rel === 'approve')
      expect(approveLink?.href).toBe('https://approve')

      // 验证第二次 fetch(创建订单)的请求体
      const orderCall = mockFetch.mock.calls[1]
      const orderBody = JSON.parse(String(orderCall[1].body))
      expect(orderBody.intent).toBe('CAPTURE')
      expect(orderBody.purchase_units[0].reference_id).toBe('PP20260728001')
      expect(orderBody.purchase_units[0].amount.currency_code).toBe('USD')
      expect(orderBody.purchase_units[0].amount.value).toBe('10.99')
      expect(orderBody.application_context.brand_name).toBe('IHUI-AI')
      expect(orderBody.application_context.shipping_preference).toBe('NO_SHIPPING')
      expect(orderBody.application_context.return_url).toBe('https://app.example.com/return')
    })
  })

  describe('captureOrder', () => {
    it('无配置时抛错', async () => {
      await expect(captureOrder('PAYID-XXX')).rejects.toThrow(/PayPal OAuth2 token failed/)
    })

    it('成功 capture 时返回 captures 数组', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'PAYID-XXX',
              status: 'COMPLETED',
              purchase_units: [
                {
                  payments: {
                    captures: [
                      {
                        id: 'CAP-123',
                        status: 'COMPLETED',
                        amount: { currency_code: 'USD', value: '10.99' },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 201 },
          ),
        )

      const result = await captureOrder('PAYID-XXX')
      expect(result.status).toBe('COMPLETED')
      const capture = result.purchase_units[0].payments?.captures?.[0]
      expect(capture?.id).toBe('CAP-123')
      expect(capture?.status).toBe('COMPLETED')
    })
  })

  describe('getOrderStatus', () => {
    it('无配置时抛错', async () => {
      await expect(getOrderStatus('PAYID-XXX')).rejects.toThrow(/PayPal OAuth2 token failed/)
    })

    it('成功查询时返回订单状态含 reference_id', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'PAYID-XXX',
              status: 'APPROVED',
              intent: 'CAPTURE',
              purchase_units: [
                {
                  reference_id: 'PP20260728001',
                  amount: { currency_code: 'USD', value: '10.99' },
                },
              ],
            }),
            { status: 200 },
          ),
        )

      const status = await getOrderStatus('PAYID-XXX')
      expect(status.status).toBe('APPROVED')
      expect(status.purchase_units[0].reference_id).toBe('PP20260728001')
    })
  })

  describe('refundCapture', () => {
    it('无配置时抛错', async () => {
      await expect(
        refundCapture({
          captureId: 'CAP-XXX',
          amountYuan: '5.00',
          currency: 'USD',
          note: 'test refund',
        }),
      ).rejects.toThrow(/PayPal OAuth2 token failed/)
    })

    it('不传金额时走全退(请求体无 amount 字段)', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'REF-123',
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '10.99' },
            }),
            { status: 201 },
          ),
        )
      global.fetch = mockFetch

      const result = await refundCapture({ captureId: 'CAP-XXX' })
      expect(result.id).toBe('REF-123')
      expect(result.status).toBe('COMPLETED')

      // 验证请求体不含 amount(全退)
      const refundCall = mockFetch.mock.calls[1]
      const refundBody = JSON.parse(String(refundCall[1].body))
      expect(refundBody.amount).toBeUndefined()
    })

    it('部分退款时请求体含 amount + note_to_payer', async () => {
      process.env.PAYPAL_CLIENT_ID = 'id'
      process.env.PAYPAL_CLIENT_SECRET = 'secret'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'REF-456',
              status: 'PENDING',
              amount: { currency_code: 'USD', value: '5.00' },
            }),
            { status: 201 },
          ),
        )
      global.fetch = mockFetch

      const result = await refundCapture({
        captureId: 'CAP-XXX',
        amountYuan: '5.00',
        currency: 'USD',
        note: 'partial refund',
      })
      expect(result.id).toBe('REF-456')
      expect(result.status).toBe('PENDING')

      const refundCall = mockFetch.mock.calls[1]
      const refundBody = JSON.parse(String(refundCall[1].body))
      expect(refundBody.amount).toEqual({ currency_code: 'USD', value: '5.00' })
      expect(refundBody.note_to_payer).toBe('partial refund')
    })
  })

  // ==========================================================================
  // __clearTokenCacheForTests(测试辅助函数)
  // ==========================================================================

  describe('__clearTokenCacheForTests', () => {
    it('调用不抛错', () => {
      expect(() => __clearTokenCacheForTests()).not.toThrow()
    })

    it('多次调用安全(幂等)', () => {
      __clearTokenCacheForTests()
      __clearTokenCacheForTests()
      __clearTokenCacheForTests()
      // 不抛错即通过
      expect(true).toBe(true)
    })
  })
})
