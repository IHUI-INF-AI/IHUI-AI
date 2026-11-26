// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it } from 'vitest'
import { decideUpdateSource } from '../src/services/update-source-policy.js'

const OFFICIAL = 'https://aizhs.top/downloads'
const PROXY = 'http://127.0.0.1:8081'

describe('L11 签名闸', () => {
  it('签名未通过即拒,不看源', () => {
    const r = decideUpdateSource(
      { officialUrl: OFFICIAL, proxyUrl: PROXY },
      { signatureValid: false, proxyHealthy: true },
    )
    expect(r.allowed).toBe(false)
    expect(r.sourceUrl).toBeNull()
    expect(r.reason).toContain('签名')
  })

  it('签名未传也 fail-closed', () => {
    const r = decideUpdateSource({ officialUrl: OFFICIAL }, {})
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('未执行')
  })

  it('签名通过 + 官方源即放行', () => {
    const r = decideUpdateSource({ officialUrl: OFFICIAL }, { signatureValid: true })
    expect(r.allowed).toBe(true)
    expect(r.sourceUrl).toBe(OFFICIAL)
    expect(r.fallback).toBe(false)
    expect(r.warnings).toEqual([])
  })
})

describe('L11 本地代理与回退告警', () => {
  it('代理健康走代理', () => {
    const r = decideUpdateSource(
      { officialUrl: OFFICIAL, proxyUrl: PROXY },
      { signatureValid: true, proxyHealthy: true },
    )
    expect(r.sourceUrl).toBe(PROXY)
    expect(r.fallback).toBe(false)
    expect(r.warnings).toEqual([])
  })

  it('代理不可用回退官方并告警(不静默)', () => {
    const r = decideUpdateSource(
      { officialUrl: OFFICIAL, proxyUrl: PROXY },
      { signatureValid: true, proxyHealthy: false },
    )
    expect(r.sourceUrl).toBe(OFFICIAL)
    expect(r.fallback).toBe(true)
    expect(r.warnings.some((w) => w.includes('回退官方源'))).toBe(true)
  })

  it('代理未健康探测(undefined)也回退并告警', () => {
    const r = decideUpdateSource(
      { officialUrl: OFFICIAL, proxyUrl: PROXY },
      { signatureValid: true },
    )
    expect(r.sourceUrl).toBe(OFFICIAL)
    expect(r.fallback).toBe(true)
  })

  it('官方源空一律拒绝', () => {
    const r = decideUpdateSource({ officialUrl: '  ' }, { signatureValid: true })
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('官方源')
  })
})

describe('L11 灰度通道白名单', () => {
  it('stable/beta/canary 归一化', () => {
    expect(decideUpdateSource({ officialUrl: OFFICIAL, channel: 'beta' }, { signatureValid: true }).channel).toBe('beta')
    expect(decideUpdateSource({ officialUrl: OFFICIAL, channel: 'CANARY' }, { signatureValid: true }).channel).toBe('canary')
    expect(decideUpdateSource({ officialUrl: OFFICIAL, channel: null }, { signatureValid: true }).channel).toBe('stable')
  })

  it('非法通道回退 stable 且告警', () => {
    const r = decideUpdateSource({ officialUrl: OFFICIAL, channel: 'rogue' }, { signatureValid: true })
    expect(r.channel).toBe('stable')
    expect(r.warnings.some((w) => w.includes('非法'))).toBe(true)
  })

  it('拒绝时告警也带上通道告警', () => {
    const r = decideUpdateSource({ officialUrl: OFFICIAL, channel: 'rogue' }, { signatureValid: false })
    expect(r.allowed).toBe(false)
    expect(r.warnings.length).toBeGreaterThanOrEqual(2)
  })
})
