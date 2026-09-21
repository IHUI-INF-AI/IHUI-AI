// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌​‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * IP ACL 匹配纯函数单测(2026-09-19 立)。
 *
 * 覆盖点:
 * - parseIPv4:合法(边界 0/255/知名值)/非法(段数、>255、非数字、IPv6)
 * - ipInCidr:/32 精确、/24、/16、非对齐基址按掩码截断、/0 恒真、
 *   无 '/' / 非法前缀 / 非法 IP → false(安全跳过)
 *
 * 测试模式:仅 mock '../src/db/index.js'(relay-billing-service 顶层 import,
 * 池化惰性连接),纯函数无副作用可直测。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { parseIPv4, ipInCidr } from '../src/services/relay-billing-service.js'

describe('parseIPv4', () => {
  it('合法 IPv4 → uint32(边界与知名值)', () => {
    expect(parseIPv4('0.0.0.0')).toBe(0)
    expect(parseIPv4('255.255.255.255')).toBe(4294967295)
    expect(parseIPv4('192.168.1.1')).toBe(3232235777)
    expect(parseIPv4('8.8.8.8')).toBe(134744072)
  })

  it('非法输入 → null(段数/超界/非数字/IPv6)', () => {
    expect(parseIPv4('192.168.1')).toBeNull()
    expect(parseIPv4('192.168.1.1.5')).toBeNull()
    expect(parseIPv4('256.1.1.1')).toBeNull()
    expect(parseIPv4('a.b.c.d')).toBeNull()
    expect(parseIPv4('')).toBeNull()
    expect(parseIPv4('::1')).toBeNull()
    expect(parseIPv4('192.168.-1.1')).toBeNull()
    expect(parseIPv4('192.168.01x.1')).toBeNull()
  })
})

describe('ipInCidr', () => {
  it('/32 精确匹配', () => {
    expect(ipInCidr('197.0.0.1', '197.0.0.1/32')).toBe(true)
    expect(ipInCidr('197.0.0.2', '197.0.0.1/32')).toBe(false)
  })

  it('/24 网段', () => {
    expect(ipInCidr('197.0.0.1', '197.0.0.0/24')).toBe(true)
    expect(ipInCidr('197.0.0.254', '197.0.0.0/24')).toBe(true)
    expect(ipInCidr('197.0.1.1', '197.0.0.0/24')).toBe(false)
  })

  it('/16 与非对齐基址按掩码截断比较', () => {
    expect(ipInCidr('10.1.2.3', '10.1.0.0/16')).toBe(true)
    expect(ipInCidr('10.2.0.1', '10.1.0.0/16')).toBe(false)
    // 基址非对齐(10.1.7.7/16)→ 按掩码截断后即 10.1.0.0/16
    expect(ipInCidr('10.1.9.9', '10.1.7.7/16')).toBe(true)
    expect(ipInCidr('10.1.9.9', '10.1.7.7/24')).toBe(false)
  })

  it('/0 恒真(全网放行)', () => {
    expect(ipInCidr('1.2.3.4', '0.0.0.0/0')).toBe(true)
    expect(ipInCidr('255.255.255.255', '8.8.8.8/0')).toBe(true)
  })

  it('非法规则/非法 IP → false(安全跳过)', () => {
    expect(ipInCidr('192.168.1.1', '192.168.1.0')).toBe(false) // 无 '/'
    expect(ipInCidr('192.168.1.1', '192.168.1.0/33')).toBe(false)
    expect(ipInCidr('192.168.1.1', '192.168.1.0/abc')).toBe(false)
    expect(ipInCidr('192.168.1.1', '999.1.1.0/24')).toBe(false)
    expect(ipInCidr('not-an-ip', '192.168.1.0/24')).toBe(false)
    expect(ipInCidr('::1', '192.168.1.0/24')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌​‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
