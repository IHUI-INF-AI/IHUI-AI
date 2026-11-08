// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-215 夹具：危险地址族「放行档」恒拦（relay allowPrivate:true）。
 *
 * 改前事实（本夹具即按此写死）：
 *  - IPv4 分支只拦 0/127/169.254，`100.64.0.0/10`（CGNAT，含阿里云元数据 100.100.100.200）漏过；
 *  - IPv6 分支写成 `startsWith('fb')`，而 ULA 是 `fc00::/7` ⇒ `fc00::1` 与
 *    `fd00:ec2::254`（AWS IPv6 元数据）全部漏过。
 * relay 转发允许私网（LAN 自托管），所以不得靠 allowPrivate 兜底，必须在 isBlockedTargetIp 恒拦。
 */
import { describe, it, expect } from 'vitest'
import { assertSafeFetchUrl, isBlockedTargetIp } from '../ssrf-guard.js'
import { RELAY_EGRESS_GUARD } from '../relay-egress-guard.js'

describe('F-215 isBlockedTargetIp 危险地址族', () => {
  it('IPv4 CGNAT 100.64.0.0/10 恒拦（100.100.100.200 为阿里云元数据）', () => {
    expect(isBlockedTargetIp('100.100.100.200')).toBe(true)
    expect(isBlockedTargetIp('100.64.0.1')).toBe(true)
    expect(isBlockedTargetIp('100.127.255.254')).toBe(true)
    // 边界外仍是公网，不做扩大化（避免把正常上游一起拦掉）
    expect(isBlockedTargetIp('100.63.255.255')).toBe(false)
    expect(isBlockedTargetIp('100.128.0.1')).toBe(false)
  })

  it('IPv6 ULA fc00::/7（fc/fd）恒拦，fd00:ec2::254 为 AWS IPv6 元数据', () => {
    expect(isBlockedTargetIp('fc00::1')).toBe(true)
    expect(isBlockedTargetIp('fd00:ec2::254')).toBe(true)
    expect(isBlockedTargetIp('fd12:3456:789a::1')).toBe(true)
    // 既有 link-local 族不回归
    expect(isBlockedTargetIp('fe80::1')).toBe(true)
  })

  it('既有危害族不回归：169.254.169.254 / 127 / 0 / ::1', () => {
    expect(isBlockedTargetIp('169.254.169.254')).toBe(true)
    expect(isBlockedTargetIp('127.0.0.1')).toBe(true)
    expect(isBlockedTargetIp('0.0.0.0')).toBe(true)
    expect(isBlockedTargetIp('::1')).toBe(true)
    expect(isBlockedTargetIp('::')).toBe(true)
  })

  it('relay 放行档（allowPrivate:true）仍拒绝云元数据直连（IP 字面量，无 DNS）', async () => {
    const aliyun = await assertSafeFetchUrl(
      'http://100.100.100.200/latest/meta-data/',
      RELAY_EGRESS_GUARD,
    )
    expect(aliyun.safe).toBe(false)
    const awsV6 = await assertSafeFetchUrl('http://[fd00:ec2::254]/latest/meta-data/', RELAY_EGRESS_GUARD)
    expect(awsV6.safe).toBe(false)
    const awsV4 = await assertSafeFetchUrl(
      'http://169.254.169.254/latest/meta-data/',
      RELAY_EGRESS_GUARD,
    )
    expect(awsV4.safe).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
