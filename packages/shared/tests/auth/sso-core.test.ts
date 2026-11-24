// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * buildSsoRedirectUrl 测试(2026-09-22 立)。
 *
 * 这个函数是 SSO 回跳 URL 的唯一构造口。它守的是 2026-09-22 桌面端实测到的
 * 真实故障:登录守卫把用户 307 打回 /sso/login?redirect=<原目标> 后,原目标里
 * 已经带过 sso_code,旧实现(各调用点手写 `${uri}?sso_code=`)又追加一次 →
 * redirect 参数递归膨胀(?sso_code=A&sso_code=B&sso_code=C…,WebView2 历史实测 4 层),
 * 最终把 redirect 本身拼坏。
 *
 * 所以"重复调用必须幂等"是本文件的核心断言,其余是三种 URI 形态的回归保护。
 */
import { describe, it, expect } from 'vitest'
import { buildSsoRedirectUrl } from '../../src/auth/sso-core'

describe('buildSsoRedirectUrl - 同源相对路径', () => {
  it('无 query 时用 ? 连接', () => {
    expect(buildSsoRedirectUrl('/edu/a', 'ABC')).toBe('/edu/a?sso_code=ABC')
  })

  it('已有 query 时用 & 连接且不丢失原参数', () => {
    expect(buildSsoRedirectUrl('/edu/a?from=1', 'ABC')).toBe('/edu/a?from=1&sso_code=ABC')
  })

  it('保留 hash 片段', () => {
    expect(buildSsoRedirectUrl('/edu/a?x=1#sec', 'ABC')).toBe('/edu/a?x=1&sso_code=ABC#sec')
  })

  it('结果不含占位 origin(必须还原为相对形态)', () => {
    expect(buildSsoRedirectUrl('/edu/a', 'ABC').startsWith('/')).toBe(true)
  })
})

describe('buildSsoRedirectUrl - 幂等去重(核心回归)', () => {
  it('已带 sso_code 时替换而非追加', () => {
    expect(buildSsoRedirectUrl('/edu/a?sso_code=OLD', 'NEW')).toBe('/edu/a?sso_code=NEW')
  })

  it('递归膨胀的历史脏值被收敛为单个 sso_code', () => {
    const corrupted = '/edu/edu-management/study-plan?sso_code=A&sso_code=B'
    expect(buildSsoRedirectUrl(corrupted, 'C')).toBe('/edu/edu-management/study-plan?sso_code=C')
  })

  it('反复调用同一目标稳定不增长(模拟守卫反复打回)', () => {
    let target = '/edu/edu-management/study-plan'
    for (const code of ['A', 'B', 'C', 'D']) {
      target = buildSsoRedirectUrl(target, code)
    }
    expect(target).toBe('/edu/edu-management/study-plan?sso_code=D')
  })

  it('其它参数不被去重影响', () => {
    expect(buildSsoRedirectUrl('/edu/a?sso_code=A&keep=1', 'B')).toBe('/edu/a?keep=1&sso_code=B')
  })
})

describe('buildSsoRedirectUrl - 绝对 URL 与自定义协议深链', () => {
  it('绝对 URL 先剥离旧 sso_code 再附加', () => {
    expect(buildSsoRedirectUrl('https://sub.example.com/cb?a=1&sso_code=OLD', 'NEW')).toBe(
      'https://sub.example.com/cb?a=1&sso_code=NEW',
    )
  })

  it('自定义协议深链可用(桌面端 ihui:// 闭环)', () => {
    expect(buildSsoRedirectUrl('ihui://sso', 'ABC')).toBe('ihui://sso?sso_code=ABC')
  })

  it('自定义协议深链同样幂等', () => {
    expect(buildSsoRedirectUrl('ihui://sso?sso_code=OLD', 'NEW')).toBe('ihui://sso?sso_code=NEW')
  })
})

describe('buildSsoRedirectUrl - 边界', () => {
  it('空目标原样返回(不凭空造 ?sso_code=)', () => {
    expect(buildSsoRedirectUrl('', 'ABC')).toBe('')
  })

  it('生成结果能被 extractSsoCode 回读,闭环成立', () => {
    const finalUrl = buildSsoRedirectUrl('https://sub.example.com/cb?a=1', 'ABC')
    expect(finalUrl).toContain('sso_code=ABC')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
