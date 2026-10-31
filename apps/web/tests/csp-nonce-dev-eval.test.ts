// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// dev-only CSP 放宽回归锁(2026-10-31 立,治"dev 壳把 §17 真浏览器验证结构性打废")
//
// 现读缺陷:`buildCsp` 的三元结构是 `nonce ? <nonce 分支> : (dev ? ... : ...)`,
// 只要 proxy.ts 发了 nonce(2026-10-30 起对 HTML 路径一律发,开发态也发),dev 分支
// 就被**整条跳过** ⇒ dev 页拿不到 'unsafe-eval' ⇒ React 开发模式 / Next HMR /
// React Refresh / eval 型 source map 全部被 CSP 拦下,页面落进「应用发生严重错误」
// 错误边界(控制台原文 `eval() is not supported in this environment ... CSP`)。
//
// 判据写法要一眼看出这是 dev-only 放宽,不是把 2026-10-30 的收紧改回去:
//  - dev + nonce  ⇒ 有 'unsafe-eval'、**没有** 'unsafe-inline'(CSP3 下 nonce 存在时
//    'unsafe-inline' 会被浏览器忽略,留着只会误导排查的人 —— 该铁律不因本放宽松动);
//  - prod + nonce ⇒ 'unsafe-eval' 与 'unsafe-inline' 都不得出现(反向牙:证明放宽
//    只住在 dev 分支,生产态 nonce 分支一字未变);
//  - 无 nonce 两档维持既有行为逐字不变(next.config.ts headers() 消费的就是这两档)。

import { describe, expect, it } from 'vitest'

import { buildCsp } from '@/config/csp'

const NONCE = 'testNonceValue123=='

/** 取出 script-src 指令的 token 数组(精确到指令名,防误匹配 script-src-elem) */
function scriptSrcTokens(csp: string): string[] {
  const directive = csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s === 'script-src' || s.startsWith('script-src '))
  if (!directive) throw new Error('CSP 串里没有 script-src 指令')
  return directive.split(/\s+/).slice(1)
}

describe('CSP nonce 分支的 dev-only 放宽(2026-10-31)', () => {
  it("dev + nonce:含 'unsafe-eval'(HMR/React Refresh/eval source map 的生存线)", () => {
    const tokens = scriptSrcTokens(buildCsp({ nonce: NONCE, dev: true }))
    expect(tokens).toContain("'unsafe-eval'")
    // nonce 本体与 strict-dynamic 不得被放宽动作挤掉
    expect(tokens).toContain(`'nonce-${NONCE}'`)
    expect(tokens).toContain("'strict-dynamic'")
  })

  it("dev + nonce:仍不含 'unsafe-inline'(铁律②:nonce 分支带它是 CSP3 下的误导双写)", () => {
    expect(scriptSrcTokens(buildCsp({ nonce: NONCE, dev: true }))).not.toContain("'unsafe-inline'")
  })

  it("prod + nonce:不含 'unsafe-eval' 也不含 'unsafe-inline'(反向牙:放宽是 dev-only)", () => {
    const tokens = scriptSrcTokens(buildCsp({ nonce: NONCE, dev: false }))
    expect(tokens).not.toContain("'unsafe-eval'")
    expect(tokens).not.toContain("'unsafe-inline'")
    // 生产 nonce 分支的既有形态逐字保真
    expect(tokens).toContain(`'nonce-${NONCE}'`)
    expect(tokens).toContain("'strict-dynamic'")
  })

  it('无 nonce / dev 档:逐字维持既有行为(含 unsafe-inline 与 unsafe-eval)', () => {
    const tokens = scriptSrcTokens(buildCsp({ dev: true }))
    expect(tokens).toContain("'unsafe-inline'")
    expect(tokens).toContain("'unsafe-eval'")
    expect(tokens.some((t) => t.startsWith("'nonce-"))).toBe(false)
  })

  it('无 nonce / prod 档:逐字维持既有行为(含 unsafe-inline,不含 unsafe-eval)', () => {
    const tokens = scriptSrcTokens(buildCsp({ dev: false }))
    expect(tokens).toContain("'unsafe-inline'")
    expect(tokens).not.toContain("'unsafe-eval'")
    expect(tokens.some((t) => t.startsWith("'nonce-"))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
