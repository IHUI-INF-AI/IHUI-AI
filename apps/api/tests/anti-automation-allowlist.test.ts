// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 频率挑战白名单(ANTI_AUTOMATION_ALLOWLIST)单测(2026-11-13 立)。
 *
 * 背景:anti-automation 的 429 CAPTCHA 要求客户端渲染 `/api/security/challenge`,
 * 但桌面/移动/CLI 首方客户端无任何实现 ⇒ 公网固定出口撞阈值后用户侧死锁
 * (只见文案、无控件可完成)。白名单让运营者把自己的固定出口 IP 捞出来。
 *
 * 覆盖点:
 * - 默认(未配置)恒不豁免 —— 零破坏面;
 * - 精确 IPv4 命中 / CIDR 命中(含 /24 /16 /0)/ 未命中;
 * - 非法条目(错误段数 / 越界 / IPv6)安全忽略,不因配置错放行全部;
 * - 现读 env + 缓存重置;
 * - 源码断言:白名单只作用于频率段(if 条件),不豁免扫描器与「已被封禁」判定。
 */
import { describe, it, expect, afterEach } from 'vitest'

import { __test__ } from '../src/plugins/anti-automation.js'

const ENV = 'ANTI_AUTOMATION_ALLOWLIST'

function setAllowlist(value: string | undefined): void {
  if (value === undefined) delete process.env[ENV]
  else process.env[ENV] = value
  __test__.resetAllowlistCacheForTest()
}

afterEach(() => {
  setAllowlist(undefined)
})

describe('频率挑战白名单 isRateAllowlisted', () => {
  it('默认未配置 → 恒不豁免(零破坏面,不改变既有行为)', () => {
    setAllowlist(undefined)
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
    expect(__test__.isRateAllowlisted('8.8.8.8')).toBe(false)
  })

  it('空字符串/纯逗号 → 等同未配置', () => {
    setAllowlist('')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
    setAllowlist(' , , ')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
  })

  it('精确 IPv4:命中目标,放过无关 IP', () => {
    setAllowlist('203.0.113.7')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(true)
    expect(__test__.isRateAllowlisted('203.0.113.8')).toBe(false)
  })

  it('多条目(逗号分隔)任一命中即豁免', () => {
    setAllowlist('198.51.100.0/24,203.0.113.7')
    expect(__test__.isRateAllowlisted('198.51.100.55')).toBe(true)
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(true)
    expect(__test__.isRateAllowlisted('203.0.113.99')).toBe(false)
  })

  it('CIDR 掩码:/24 命中整段、/16 命中更宽、目标按掩码对齐', () => {
    setAllowlist('198.51.100.0/24')
    expect(__test__.isRateAllowlisted('198.51.100.0')).toBe(true)
    expect(__test__.isRateAllowlisted('198.51.100.255')).toBe(true)
    expect(__test__.isRateAllowlisted('198.51.101.1')).toBe(false)

    setAllowlist('203.0.0.0/16')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(true)
    expect(__test__.isRateAllowlisted('203.1.0.1')).toBe(false)
  })

  it('非对齐基址按掩码截断:基址主机位非零仍按网段匹配', () => {
    // 基址 198.51.100.55 与 .0 同属 /24,应命中(掩码截断语义,与 ipInCidr 一致)
    setAllowlist('198.51.100.55/24')
    expect(__test__.isRateAllowlisted('198.51.100.9')).toBe(true)
    expect(__test__.isRateAllowlisted('198.51.101.9')).toBe(false)
  })

  it('/0 恒真 —— 仅用于显式关闭挑战,测试钉住这一语义存在', () => {
    setAllowlist('0.0.0.0/0')
    expect(__test__.isRateAllowlisted('1.2.3.4')).toBe(true)
  })

  it('非法条目安全忽略:IPv6 / 越界 / 错误段数 / 非法前缀 → 目标不豁免', () => {
    setAllowlist('::1,999.1.1.1,203.0.113,203.0.113.1/33,abc')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
    expect(__test__.isRateAllowlisted('::1')).toBe(false)
  })

  it('非法条目混入合法条目:合法项照常生效', () => {
    setAllowlist('::1,203.0.113.7,junk')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(true)
    expect(__test__.isRateAllowlisted('::1')).toBe(false)
  })

  it('目标 IP 非法(IPv6/乱码)→ 不豁免(安全跳过)', () => {
    setAllowlist('0.0.0.0/0')
    expect(__test__.isRateAllowlisted('::1')).toBe(false)
    expect(__test__.isRateAllowlisted('not-an-ip')).toBe(false)
  })

  it('现读 env + 缓存重置:改配置后无需重载模块即生效', () => {
    setAllowlist(undefined)
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
    setAllowlist('203.0.113.7')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(true)
    setAllowlist('198.51.100.1')
    expect(__test__.isRateAllowlisted('203.0.113.7')).toBe(false)
    expect(__test__.isRateAllowlisted('198.51.100.1')).toBe(true)
  })
})

describe('白名单安全边界(源码断言)', () => {
  it('白名单只作用于频率段,不豁免扫描器判定与「已被封禁」', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(
      new URL('../src/plugins/anti-automation.ts', import.meta.url),
      'utf8',
    )
    // 频率段 if 与白名单合流:白名单命中才跳过频率统计
    expect(src).toMatch(/if \(!healthCheckUa && !isRateAllowlisted\(ip\)\) \{/)
    // 扫描器判定与封禁查询必须仍在白名单之前、不受白名单影响
    expect(src).toMatch(/if \(isScannerPath\(path\)\) \{/)
    expect(src).toMatch(/const blockInfo = await ipRep\.getBlockInfo\(ip\)/)
    // 白名单函数存在且默认空=关闭
    expect(src).toMatch(/ANTI_AUTOMATION_ALLOWLIST/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
