// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 21 批:SSO 回调的 state 绑定。
 *
 * 病灶:`buildSsoLoginUrl` 只发 redirect + client_id,回调侧 `extractSsoCode` 也不比对任何
 * 东西 —— 而各端的回调落点(CLI 的 loopback 1738、桌面/RN 的 ihui:// deep-link、小程序的
 * web-view 消息)在等待窗内对本机任意进程与任意网页可达。谁先往那里投一枚**自己的**
 * 授权码,谁就替用户完成登录(登录 CSRF / 换票码注入),用户被换成攻击者账户。
 *
 * 修法 = OAuth 标准 state:发起前生成随机值随 URL 发出,授权页**原样透传**,端上比对。
 *
 * 用例:
 *  A buildSsoLoginUrl:带 state 才出现该参数;不带则与旧形状逐字一致(向后兼容)
 *  B buildSsoRedirectUrl:state 与 sso_code 一起附加,且重入幂等(先删再加)
 *  C extractSsoCode:给 expectedState 时比对;不符/缺失一律 null;不给则保持旧行为
 *  D 变异自证:把比对那行去掉(恒不校验)⇒ C 的两条断言翻红
 */
import { describe, expect, it } from 'vitest'

import { buildSsoLoginUrl, buildSsoRedirectUrl, extractSsoCode } from '../sso-core'

describe('A buildSsoLoginUrl', () => {
  it('带 state ⇒ 出现在登录 URL 上', () => {
    const u = buildSsoLoginUrl('https://aizhs.top', 'http://localhost:1738/callback', 'cli', 'st-1')
    const parsed = new URL(u)
    expect(parsed.searchParams.get('state')).toBe('st-1')
    expect(parsed.searchParams.get('client_id')).toBe('cli')
    expect(parsed.searchParams.get('redirect')).toBe('http://localhost:1738/callback')
  })

  it('不带 state ⇒ 与旧形状逐字一致(未接入的端不中断)', () => {
    const u = buildSsoLoginUrl('https://aizhs.top', '/x', 'web')
    expect(u).toBe('https://aizhs.top/sso/login?redirect=%2Fx&client_id=web')
  })
})

describe('B buildSsoRedirectUrl', () => {
  it('把 sso_code 与 state 一起附加', () => {
    const u = buildSsoRedirectUrl('ihui://sso', 'code-1', 'st-1')
    expect(u).toContain('sso_code=code-1')
    expect(u).toContain('state=st-1')
  })

  it('重入幂等:已有的 sso_code / state 先删再加(不膨胀)', () => {
    const once = buildSsoRedirectUrl('ihui://sso?sso_code=old&state=old', 'new-code', 'new-state')
    const twice = buildSsoRedirectUrl(once, 'new-code', 'new-state')
    expect(once).toBe(twice)
    expect(once.match(/sso_code=/g)).toHaveLength(1)
    expect(once.match(/state=/g)).toHaveLength(1)
  })

  it('相对路径形态仍不带 origin', () => {
    const u = buildSsoRedirectUrl('/edu/x?y=1', 'c', 's')
    expect(u.startsWith('/edu/x')).toBe(true)
    expect(u).toContain('sso_code=c')
    expect(u).toContain('state=s')
  })
})

describe('C extractSsoCode 的 state 绑定', () => {
  const ok = 'http://127.0.0.1:1738/callback?sso_code=real&state=st-1'

  it('state 相符 ⇒ 取到码', () => {
    expect(extractSsoCode(ok, 'st-1')).toBe('real')
  })

  it('state 不符 ⇒ null(攻击者投的码被丢弃)', () => {
    expect(extractSsoCode('http://127.0.0.1:1738/callback?sso_code=evil&state=st-2', 'st-1')).toBe(
      null,
    )
  })

  it('缺 state ⇒ null(老式裸码不再被接受)', () => {
    expect(extractSsoCode('http://127.0.0.1:1738/callback?sso_code=evil', 'st-1')).toBe(null)
  })

  it('不传 expectedState ⇒ 保持旧行为(逐端接入期不中断)', () => {
    expect(extractSsoCode('http://127.0.0.1:1738/callback?sso_code=any')).toBe('any')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
