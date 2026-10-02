// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-1018194:站内相对跳转判据的唯一实现 + "为什么解析判据不能换成安全判据"的钉。
// 表里的反斜杠形态不是臆造的测试向量 —— 取证自 `.ihui-agent/tmp/g1018194/probe-url.mjs`
// (node 的 WHATWG 实现与浏览器同一套算法):`/\evil.com` 在 base 下解析成 https://evil.com/。
import { describe, expect, it } from 'vitest'

import { buildSsoRedirectUrl, isSameOriginRelativePath } from '../sso-core'

const CASES: ReadonlyArray<readonly [string, boolean]> = [
  ['/dashboard', true],
  ['/a/b/c?x=1', true],
  ['/', true],
  ['//evil.com', false],
  ['///evil.com', false],
  ['/\\evil.com', false],
  ['/\\/\\/evil.com', false],
  ['https://evil.com', false],
  ['ihui://sso/callback', false],
  ['', false],
]

describe('isSameOriginRelativePath', () => {
  for (const [input, expected] of CASES) {
    it(`${JSON.stringify(input)} → ${String(expected)}`, () => {
      expect(isSameOriginRelativePath(input)).toBe(expected)
    })
  }

  it('判据必须比"只挡 //"更严:反斜杠形态单独钉一条', () => {
    // 旧写法 `startsWith('/') && !startsWith('//')` 在这一条上给 true,
    // 而浏览器把它解析成跨站 ⇒ 本断言就是那枚洞的封口证明。
    const legacy = (v: string) => v.startsWith('/') && !v.startsWith('//')
    expect(legacy('/\\evil.com')).toBe(true)
    expect(isSameOriginRelativePath('/\\evil.com')).toBe(false)
  })
})

describe('buildSsoRedirectUrl 的 isRelative 是解析判断,不是安全判断', () => {
  it('反斜杠形态今天走相对分支 ⇒ code 只挂回本站路径,不跟去外站', () => {
    // 把安全判据塞进这个分支开关,`/\evil.com` 会落进绝对分支、经 fallback 变成
    // `/\evil.com?sso_code=…` —— 浏览器再把它解析成 https://evil.com,等于把 code 送出去。
    // 这条断言的存在就是阻止那次"顺手统一"。
    expect(buildSsoRedirectUrl('/\\evil.com', 'CODE1')).toBe('/?sso_code=CODE1')
  })
  it('正常站内路径幂等附加(去重旧 sso_code 的行为不变)', () => {
    expect(buildSsoRedirectUrl('/edu/x?sso_code=OLD', 'NEW')).toBe('/edu/x?sso_code=NEW')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
