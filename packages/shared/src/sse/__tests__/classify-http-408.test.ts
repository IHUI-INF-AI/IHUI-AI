// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { classifyHttpFailureKind } from '../contract'

describe('XUI-027 classifyHttpFailureKind:408 是瞬时失败', () => {
  it('408 Request Timeout ⇒ transient(可退避重试),不是 contract_mismatch', () => {
    expect(classifyHttpFailureKind(408)).toBe('transient')
  })

  it('相邻语义不被误伤(阴性对照)', () => {
    expect(classifyHttpFailureKind(429)).toBe('rate_limited')
    expect(classifyHttpFailureKind(404)).toBe('endpoint_unavailable')
    expect(classifyHttpFailureKind(500)).toBe('transient')
    expect(classifyHttpFailureKind(418)).toBe('contract_mismatch')
  })
})
