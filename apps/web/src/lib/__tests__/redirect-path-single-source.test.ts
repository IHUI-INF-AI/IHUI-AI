// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-1018194:回跳判据"只许有一份实现"的装车证明。
// 前两档问行为(委托后必须与共享层同值),后两档问形状(不许再有人在自己文件里写一遍前缀判断):
// 判据分两处写,漂移的表现不是报错,是"其中一处天天放行跨站值而另一处报绿"。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getRedirectPath } from '../auth-utils'
import { isSameOriginRelative } from '../sso-redirect-guard'
import { isSameOriginRelativePath } from '@ihui/shared/auth/sso-core'

const mockRequest = (redirect: string | null) =>
  ({
    nextUrl: { searchParams: new URLSearchParams(redirect === null ? {} : { redirect }) },
  }) as unknown as Parameters<typeof getRedirectPath>[0]

describe('两个 web 落点都必须走共享层那一份', () => {
  it('getRedirectPath 对反斜杠形态回落到 "/"(旧写法在这里放行)', () => {
    expect(getRedirectPath(mockRequest('/\\evil.com'))).toBe('/')
    expect(getRedirectPath(mockRequest('//evil.com'))).toBe('/')
    expect(getRedirectPath(mockRequest('/dashboard'))).toBe('/dashboard')
    expect(getRedirectPath(mockRequest(null))).toBe('/')
  })
  it('sso-redirect-guard 与共享判据逐值同结论(委托不等于改名)', () => {
    for (const v of ['/ok', '//evil.com', '/\\evil.com', 'https://evil.com', '']) {
      expect(isSameOriginRelative(v)).toBe(isSameOriginRelativePath(v))
    }
  })
})

describe('形状锁:不得再出现第二份前缀判断', () => {
  const files = ['src/lib/auth-utils.ts', 'src/lib/sso-redirect-guard.ts']
  for (const rel of files) {
    it(`${rel} 必须 import 共享判据,且整文件不再出现 // 前缀测试`, () => {
      // 判据**不剥注释**,因此这条比"代码面"更严:注释里复述一遍旧写法也会红。
      // 刻意的 —— 复述一旦落地就成了下一个人"照注释改回去"的入口,而本仓为这句话记过多次。
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src).toMatch(/from\s+'@ihui\/shared\/auth\/sso-core'/)
      expect(src).not.toMatch(/startsWith\(\s*'\/\/'\s*\)/)
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
