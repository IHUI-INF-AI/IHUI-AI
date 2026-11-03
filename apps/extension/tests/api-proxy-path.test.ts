// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 19 批:api.proxy 目标路径判据。
 *
 * 钉住"代理面只认站内相对路径"这一格。绝对 URL 会让 api-client 的 normalizeUrl 直通,
 * 随后无条件挂本站 Bearer ⇒ 后台带着凭据去任意域。
 *
 * 重点是 `/\evil.com` 这一族:只挡 `//` 的老写法会把它放行(WHATWG 在 special scheme 下
 * 把第二字符的 `/` 与 `\` 等值处理,实测 `new URL('/\\evil.com','https://aizhs.top')`
 * 解析成 `https://evil.com/`)—— 这条是**正反对照**,不是凑数。
 */
import { describe, expect, it } from 'vitest'

import { assertApiProxyPath } from '../lib/api-proxy-path'

describe('api.proxy 站内前缀放行', () => {
  it.each([
    '/api/notifications/unread-count', // 现读全仓唯一消费方传的形态
    '/api/users/me',
    '/uploads/abc.png',
    '/ws/ticket',
  ])('%s ⇒ ok', (path) => {
    expect(assertApiProxyPath(path)).toEqual({ ok: true })
  })
})

describe('api.proxy 拒绝外链与协议相对', () => {
  it.each([
    ['https://evil.example/api/x'],
    ['http://169.254.169.254/latest/meta-data/'],
    ['ftp://internal/x'],
    ['javascript:alert(1)'],
    ['//evil.example/api/x'],
    ['/?a=1'], // 站内但不是允许前缀
    ['/evil/x'],
    [''],
  ])('%s ⇒ 拒', (path) => {
    const verdict = assertApiProxyPath(path)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBeTruthy()
  })

  it('/\\evil.com 反斜杠形态同样拒(只挡 // 会放行成跨站)', () => {
    const verdict = assertApiProxyPath('/\\evil.example/api/x')
    expect(verdict.ok).toBe(false)
    // 而且必须**真的**是跨站语义,不是判据自己臆想:浏览器解析口径作正反对照
    expect(new URL('/\\evil.example/api/x', 'https://aizhs.top').host).toBe('evil.example')
  })

  it('大小写混合的 scheme 形态也拒(不能只挡小写 http)', () => {
    expect(assertApiProxyPath('HTTPS://evil.example/x').ok).toBe(false)
    expect(assertApiProxyPath('HpTp://evil.example/x').ok).toBe(false)
  })

  it('reason 里点名旋钮,便于调用方定位而不是只看一句"非法"', () => {
    const verdict = assertApiProxyPath('/evil/x')
    expect(verdict.reason).toContain('/api/')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
