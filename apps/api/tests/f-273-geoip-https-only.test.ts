// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGeoIpService } from '../src/services/geoip.js'

/**
 * F-273 回归锁(2026-11-13)。
 *
 * 病灶:MaxMind 未命中时 lookup() 回退到明文 HTTP 的 ip-api.com,响应无签名/无校验,
 * 却直接进入登录风控(services/anomaly-detector.ts)与登录呈现地区(services/login-region.ts)
 * 的裁决链 ⇒ 中间人可改写「登录地」压低异地登录分数,或把访客判成错误地区。
 *
 * 本文件钉住:出站只允许 HTTPS;异常响应一律 fail-open 落 null;私网/保留/非法 IP 零出站。
 * 修复前 geoip.ts 里存在 http:// 明文端点,所以第 ① 组会真红。
 */
const SOURCE_PATH = fileURLToPath(new URL('../src/services/geoip.ts', import.meta.url))
const SOURCE = readFileSync(SOURCE_PATH, 'utf8')

/** ipwho.is 真实响应形状(仅保留本服务消费的字段)。 */
const IPWHO_SUCCESS = {
  ip: '1.1.1.1',
  success: true,
  type: 'IPv4',
  country: 'Australia',
  country_code: 'AU',
  region: 'Queensland',
  city: 'South Brisbane',
  latitude: -27.4766,
  longitude: 153.0166,
  timezone: { id: 'Australia/Brisbane', utc: '+10:00' },
}

/** 造一个最小 Response 替身:测试面不连真实网络。 */
function responseLike(
  body: unknown,
  init: { ok?: boolean; contentLength?: string | null; jsonThrows?: boolean } = {},
): Record<string, unknown> {
  return {
    ok: init.ok ?? true,
    headers: {
      get: (name: string): string | null =>
        name.toLowerCase() === 'content-length' ? (init.contentLength ?? null) : null,
    },
    json: async (): Promise<unknown> => {
      if (init.jsonThrows) throw new SyntaxError('unexpected token in json')
      return body
    },
  }
}

/**
 * 安装 fetch 替身并记录每次出站 URL。
 * 所有用例都用它取走网络,任何未预期的真实请求都会在断言里显形。
 */
function stubFetch(responder: (url: string) => Promise<unknown> | unknown): {
  mock: ReturnType<typeof vi.fn>
  urls: string[]
} {
  const urls: string[] = []
  const mock = vi.fn(async (input: unknown): Promise<unknown> => {
    const url = String(input)
    urls.push(url)
    return responder(url)
  })
  vi.stubGlobal('fetch', mock)
  return { mock, urls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('F-273 ① 源锁:出站只允许 HTTPS', () => {
  it('geoip.ts 源码内不再出现明文 http://(修复前此处是 ip-api 明文端点)', () => {
    expect(SOURCE.includes('http://')).toBe(false)
  })

  it('远程端点常量为 https://ipwho.is,且保留 AbortSignal 超时', () => {
    expect(SOURCE).toContain("'https://ipwho.is'")
    expect(SOURCE).toContain('AbortSignal.timeout(REMOTE_GEO_TIMEOUT_MS)')
  })

  it('明文接口已删除:源码里不再出现 ip-api.com/json', () => {
    expect(SOURCE.includes('ip-api.com/json')).toBe(false)
  })
})

describe('F-273 ② MaxMind 未命中 → 走 HTTPS 源并正确映射字段', () => {
  it('出站 URL 为 https://ipwho.is/<ip> 且字段按既有结构透出', async () => {
    const { urls } = stubFetch(() => responseLike(IPWHO_SUCCESS))

    const result = await getGeoIpService().lookup('1.1.1.1')

    expect(urls).toHaveLength(1)
    expect(urls[0]?.startsWith('https://')).toBe(true)
    expect(urls[0]?.includes('http://')).toBe(false)
    expect(urls[0]).toContain('ipwho.is')
    expect(result).toEqual({
      country: 'Australia',
      countryCode: 'AU',
      city: 'South Brisbane',
      region: 'Queensland',
      latitude: -27.4766,
      longitude: 153.0166,
      timezone: 'Australia/Brisbane',
    })
  })
})

describe('F-273 ③ 上游异常一律 fail-open 返回 null(不抛)', () => {
  it('非 200 → null', async () => {
    stubFetch(() => responseLike(IPWHO_SUCCESS, { ok: false }))
    await expect(getGeoIpService().lookup('8.8.4.4')).resolves.toBeNull()
  })

  it('非 JSON(解析抛错)→ null', async () => {
    stubFetch(() => responseLike(null, { jsonThrows: true }))
    await expect(getGeoIpService().lookup('9.9.9.9')).resolves.toBeNull()
  })

  it('JSON 不是对象 → null', async () => {
    stubFetch(() => responseLike('ok'))
    await expect(getGeoIpService().lookup('208.67.222.222')).resolves.toBeNull()
  })

  it('上游显式声明失败(success:false)→ null', async () => {
    stubFetch(() => responseLike({ success: false, message: 'invalid query' }))
    await expect(getGeoIpService().lookup('208.67.220.220')).resolves.toBeNull()
  })

  it('超时(AbortSignal 触发)→ null', async () => {
    stubFetch(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')))
    await expect(getGeoIpService().lookup('114.114.115.115')).resolves.toBeNull()
  })

  it('网络错误 → null', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(getGeoIpService().lookup('223.5.5.5')).resolves.toBeNull()
  })
})

describe('F-273 ④ 私网/保留/非法 IP 零出站', () => {
  it('这些地址不触发任何 fetch 调用', async () => {
    const { mock } = stubFetch(() => responseLike(IPWHO_SUCCESS))

    const blocked = [
      '',
      'not-an-ip',
      '999.1.1.1',
      '1.2.3',
      '127.0.0.1',
      '10.1.2.3',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.1.1',
      '100.64.0.1',
      '192.0.2.10',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ]
    for (const ip of blocked) {
      await expect(getGeoIpService().lookup(ip)).resolves.toBeNull()
    }
    expect(mock).not.toHaveBeenCalled()
  })
})

describe('F-273 ⑤ 体积与字段类型异常被拒', () => {
  it('content-length 超限 → null,且不读取响应体', async () => {
    const json = vi.fn(async (): Promise<unknown> => IPWHO_SUCCESS)
    const mock = vi.fn(async () => ({
      ok: true,
      headers: { get: (): string => String(1024 * 1024) },
      json,
    }))
    vi.stubGlobal('fetch', mock)

    await expect(getGeoIpService().lookup('4.4.4.4')).resolves.toBeNull()
    expect(json).not.toHaveBeenCalled()
  })

  it('country_code 类型异常(数字)→ null', async () => {
    stubFetch(() => responseLike({ success: true, country: 'China', country_code: 123 }))
    await expect(getGeoIpService().lookup('180.76.76.76')).resolves.toBeNull()
  })

  it('latitude 类型异常(字符串)→ null', async () => {
    stubFetch(() =>
      responseLike({ success: true, country: 'China', country_code: 'CN', latitude: '30.2' }),
    )
    await expect(getGeoIpService().lookup('119.29.29.29')).resolves.toBeNull()
  })

  it('country_code 形态异常(三字母)→ null', async () => {
    stubFetch(() => responseLike({ success: true, country: 'China', country_code: 'CHN' }))
    await expect(getGeoIpService().lookup('182.254.116.116')).resolves.toBeNull()
  })

  it('timezone 类型异常(既非字符串也无 id)→ null', async () => {
    stubFetch(() =>
      responseLike({ success: true, country: 'China', country_code: 'CN', timezone: 123 }),
    )
    await expect(getGeoIpService().lookup('223.6.6.6')).resolves.toBeNull()
  })
})
