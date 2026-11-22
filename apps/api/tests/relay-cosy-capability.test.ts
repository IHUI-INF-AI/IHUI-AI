// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Cosy 能力自述的行为锁(2026-11-18 立)。
 *
 * 钉住:
 *   C1 头族齐  5 条映射 + 2 条固定档必须在(缺一条就等于设备头不完整,上游会拒)。
 *   C2 不撒谎  请求签名必须标 unreproducible 且 evidence 写明"不伪造";桥接必须标 bridged。
 *   C3 无凭据  自述只吐键位与头名,绝不吐任何值(这层会被 admin 面直接回给前端)。
 *   C4 纯函数  同输入恒等,连调两次结果一致。
 */
import { describe, it, expect } from 'vitest'
import { describeCosyCapability, cosyHeaderNames } from '../src/services/relay-cosy-capability.js'

describe('relay-cosy-capability', () => {
  it('C1 头族齐:4 条映射键位精确', () => {
    const d = describeCosyCapability()
    expect(d.headerCount).toBe(4)
    expect(d.headerMapping).toEqual([
      { sourceKey: 'machine_token', header: 'Cosy-MachineToken' },
      { sourceKey: 'machine_code', header: 'Cosy-MachineCode' },
      { sourceKey: 'machine_type', header: 'Cosy-MachineType' },
      { sourceKey: 'version', header: 'Cosy-Version' },
    ])
    expect(cosyHeaderNames()).toContain('Cosy-MachineToken')
  })

  it('C1b 固定档 2 条 + 头族 1 条都在', () => {
    const ids = describeCosyCapability().surfaces.map((s) => s.id)
    expect(ids).toContain('client-type')
    expect(ids).toContain('machine-os')
    expect(ids).toContain('machine-token-family')
  })

  it('C2 请求签名标 unreproducible 且明说不伪造', () => {
    const sig = describeCosyCapability().surfaces.find((s) => s.id === 'request-signature')
    expect(sig?.state).toBe('unreproducible')
    expect(sig?.evidence).toContain('不伪造')
  })

  it('C2b 桥接通路标 bridged 并给出已实证依据', () => {
    const b = describeCosyCapability().surfaces.find((s) => s.id === 'signature-via-client-bridge')
    expect(b?.state).toBe('bridged')
    expect(b?.evidence).toContain('已实证')
  })

  it('C2c 每条 surface 的 evidence 都非空(说不清就等于没判)', () => {
    for (const s of describeCosyCapability().surfaces) {
      expect(s.evidence.length).toBeGreaterThan(8)
    }
  })

  it('C3 自述不含任何凭据值:序列化后不出现长 token 形态', () => {
    const json = JSON.stringify(describeCosyCapability())
    expect(json).not.toMatch(/[0-9a-f]{32,}/i)
    expect(json).not.toMatch(/dt-|drt-/)
  })

  it('C4 纯函数:两次调用恒等', () => {
    expect(describeCosyCapability()).toEqual(describeCosyCapability())
  })

  it('verdict 同时提到"头族可用"与"算法未复刻"', () => {
    const v = describeCosyCapability().verdict
    expect(v).toContain('设备头族')
    expect(v).toContain('未复刻')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
