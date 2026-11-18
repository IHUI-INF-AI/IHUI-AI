// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游能力矩阵的行为锁(2026-11-18 立)。
 *
 * M1 三家齐   qoder / trae / workbuddy 各一行,缺一行就等于矩阵不完整。
 * M2 证据齐   每条能力必须带 evidence,且形如「路径:符号」(指不到就不许列)。
 * M3 唯一红线  unreproducible 只能出现在 Qoder 请求签名这一条,且必须写明替代通路。
 * M4 计数自洽  totals 三项之和 = capabilities 总数。
 * M5 差集结论  对照程序四类典型能力必须逐条给出本仓落点。
 */
import { describe, it, expect } from 'vitest'
import { describeUpstreamCapabilityMatrix, UPSTREAM_CAPABILITY_MATRIX, GAP_NOTE } from '../src/services/relay-upstream-capability-matrix.js'

describe('relay-upstream-capability-matrix', () => {
  it('M1 三家各一行', () => {
    const codes = UPSTREAM_CAPABILITY_MATRIX.map((p) => p.providerCode)
    expect(codes).toEqual(['qoder', 'trae', 'workbuddy'])
  })

  it('M2 每条能力都有「路径:符号」形态的证据', () => {
    for (const p of UPSTREAM_CAPABILITY_MATRIX) {
      for (const c of p.capabilities) {
        expect(c.evidence).toMatch(/\/.+\.(ts|mjs):[A-Za-z_$]/)
      }
    }
  })

  it('M3 unreproducible 只有 Qoder 请求签名一条,且写明替代通路', () => {
    const unrep = UPSTREAM_CAPABILITY_MATRIX.flatMap((p) => p.capabilities).filter((c) => c.state === 'unreproducible')
    expect(unrep).toHaveLength(1)
    expect(unrep[0]!.id).toBe('cosy-request-signature')
    expect(unrep[0]!.note).toContain('客户端桥接')
  })

  it('M4 totals 自洽', () => {
    const d = describeUpstreamCapabilityMatrix()
    const t = d.totals
    expect(t.providers).toBe(3)
    expect(t.implemented + t.derived + t.unreproducible).toBe(t.capabilities)
    expect(t.capabilities).toBe(UPSTREAM_CAPABILITY_MATRIX.reduce((n, p) => n + p.capabilities.length, 0))
  })

  it('M5 对照四类典型能力逐条有本仓落点', () => {
    for (const k of GAP_NOTE.typicalOpenSourceGateway) {
      const landing = (GAP_NOTE.ourLanding as Record<string, string>)[k]
      expect(landing, `缺少落点:${k}`).toBeTruthy()
    }
    expect(GAP_NOTE.verdict).toContain('unreproducible')
  })

  it('矩阵不含任何凭据形态', () => {
    const json = JSON.stringify(describeUpstreamCapabilityMatrix())
    expect(json).not.toMatch(/[0-9a-f]{32,}/i)
    expect(json).not.toMatch(/dt-|drt-|sk-/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
