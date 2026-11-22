// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-33 回归:支付宝 OAuth 的签名 `timestamp` 必须是 GMT+8 的
 * `yyyy-MM-dd HH:mm:ss`,且与支付链路 `alipay.formatTimestamp` 同源。
 *
 * 旧实现 `new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00')` 把 UTC 墙钟
 * 贴上 `+08:00` 标签(恒偏 8 小时),形式还是 ISO 8601;网关按北京时间校验必拒。
 * 这里四条判据各堵一种"假绿":
 *  1. 协议形状(不是带 T 的 ISO 8601);
 *  2. 固定瞬间 + 硬编码北京时间真值(两路互比不算数);
 *  3. 两个调用点(exchange / user info)都真的带上该值;
 *  4. 与 alipay.formatTimestamp 同一 Date 逐字相同(单源,不是第二份实现)。
 */

import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

import {
  alipayOAuthTimestamp,
  exchangeAlipayCode,
  getAlipayUserInfo,
} from '../src/services/oauth-providers.js'
import { formatTimestamp } from '../src/services/alipay.js'

const ORIGINAL_TZ = process.env.TZ
const HOST_ZONES = ['UTC', 'Asia/Shanghai', 'America/New_York'] as const
const FIXED_INSTANT = '2026-11-08T02:33:12Z'
const FIXED_BEIJING_TEXT = '2026-11-08 10:33:12'
const TIMESTAMP_SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SDB-33 支付宝 OAuth timestamp 形状与北京时间换算', () => {
  it.each(HOST_ZONES)(
    '%s 宿主时区下:2026-11-08T02:33:12Z 必须换算成 2026-11-08 10:33:12',
    (zone) => {
      process.env.TZ = zone
      const ts = alipayOAuthTimestamp(new Date(FIXED_INSTANT))
      expect(ts).toBe(FIXED_BEIJING_TEXT)
      expect(ts).toMatch(TIMESTAMP_SHAPE)
      // 旧实现输出的 `2026-11-08T02:33:12+08:00` 同时错小时也错形状
      expect(ts).not.toContain('T')
      expect(ts).not.toContain('+08:00')
    },
  )

  it('任意当前时刻形状恒为 yyyy-MM-dd HH:mm:ss(不是 ISO 8601)', () => {
    process.env.TZ = 'UTC'
    expect(alipayOAuthTimestamp(new Date())).toMatch(TIMESTAMP_SHAPE)
  })
})

describe('SDB-33 与 alipay.formatTimestamp 单源一致', () => {
  const INSTANTS = [
    FIXED_INSTANT,
    '2025-11-24T16:00:00Z', // 北京 2025-11-25 00:00:00(跨日界)
    '2026-12-31T15:59:59Z', // 北京 2026-12-31 23:59:59
  ]

  it.each(INSTANTS)('%s 同一 Date 两处输出逐字相同', (iso) => {
    // 宿主时区刻意取 UTC:一处若退回本地 getter,这里会直接分叉
    process.env.TZ = 'UTC'
    const d = new Date(iso)
    expect(alipayOAuthTimestamp(d)).toBe(formatTimestamp(d))
  })
})

describe('SDB-33 exchangeAlipayCode / getAlipayUserInfo 都走同一格式', () => {
  const gatewayUrls: URL[] = []
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gatewayUrls.length = 0
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    vi.stubEnv('ALIPAY_APP_ID', '2021000')
    vi.stubEnv(
      'ALIPAY_PRIVATE_KEY',
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    )
    vi.stubEnv('ALIPAY_GATEWAY', 'https://openapi.alipay.com/gateway.do')
    // 强制直连出口,避免 .env.test 若配了 PROXY_URL 时改走代理分支
    vi.stubEnv('PROXY_URL', '')
    process.env.TZ = 'Asia/Shanghai'

    fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input)
      gatewayUrls.push(url)
      const payload =
        url.searchParams.get('method') === 'alipay.system.oauth.token'
          ? {
              alipay_system_oauth_token_response: { access_token: 'at-1', user_id: '2088' },
            }
          : {
              alipay_user_info_share_response: {
                code: '10000',
                user_id: '2088',
                nick_name: 'nick',
              },
            }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    // 只假 Date,保留真实 setTimeout(出站超时计时器照常工作)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(FIXED_INSTANT))
  })

  it('换票与取用户信息携带同一个北京时间 timestamp', async () => {
    await exchangeAlipayCode('auth-code-1')
    await getAlipayUserInfo('access-token-1')

    expect(gatewayUrls.map((u) => u.searchParams.get('method'))).toEqual([
      'alipay.system.oauth.token',
      'alipay.user.info.share',
    ])
    const expected = formatTimestamp(new Date(FIXED_INSTANT))
    expect(expected).toBe(FIXED_BEIJING_TEXT)
    expect(gatewayUrls.map((u) => u.searchParams.get('timestamp'))).toEqual([
      expected,
      expected,
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
