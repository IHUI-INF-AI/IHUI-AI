// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产档 connect-src 不得回退成通配(2026-10-31 立)。
 *
 * 现读缺陷:生产档原为 `connect-src 'self' https: wss: …` —— `https:` 通配等于告诉浏览器
 * "XSS 之后可以往任意 https 域发请求",同源策略的最后一道外泄信道就没了(同一天 img-src /
 * media-src 都已收口成同源代理,只剩这一条)。收窄前逐目标枚举过 apps/web/src、app、
 * packages 的 fetch/WebSocket/EventSource/beacon 出口,浏览器真正会连的外部源只有
 * api.aizhs.top 的 https + wss;其余静态资源都经同源 /api/* 代理。
 *
 * 三档成对钉(摘掉收口即红,把 dev 一起收掉也红):
 *   ① 生产档不得出现裸 `https:` / `ws:` / `wss:` 通配 token(带具体主机的照旧允许);
 *   ② 生产档必须保留 api.aizhs.top 的 https 与 wss(否则"更严"会变成"把功能掐死");
 *   ③ dev 档仍须放行 localhost / 127.0.0.1 的调试端点(收紧只针对生产)。
 */

import { describe, expect, it } from 'vitest'

import { buildCsp } from '@/config/csp'

/** 取出 connect-src 那条指令里的所有源 token */
function connectSrcOf(csp: string): string[] {
  const directive = csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('connect-src'))
  if (!directive) return []
  return directive.split(/\s+/).slice(1)
}

describe('CSP connect-src 收紧', () => {
  it('① 生产档不含裸通配 token', () => {
    const tokens = connectSrcOf(buildCsp({ dev: false }))

    expect(tokens.length).toBeGreaterThan(0)
    // 裸 "https:" / "wss:" / "ws:" = 任意域;带主机名的 https://api… 不算通配
    expect(tokens).not.toContain('https:')
    expect(tokens).not.toContain('wss:')
    expect(tokens).not.toContain('ws:')
    expect(tokens).not.toContain('*')
  })

  it('② 生产档保留真实在用的 api 主机(收紧不是掐死功能)', () => {
    const tokens = connectSrcOf(buildCsp({ dev: false }))

    expect(tokens).toContain("'self'")
    expect(tokens).toContain('https://api.aizhs.top')
    expect(tokens).toContain('wss://api.aizhs.top')
  })

  it('③ dev 档仍放行本机调试端点', () => {
    const tokens = connectSrcOf(buildCsp({ dev: true }))

    expect(tokens).toContain('ws:')
    expect(tokens.some((t) => t.includes('localhost'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
