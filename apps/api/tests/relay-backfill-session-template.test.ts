// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池缺模板票「一键补采」的守门锁(2026-11-10 立)。
 *
 * 只测纯函数:本文件 import 被测脚本不得连生产库(脚本自带 isDirectRun 守卫),
 * 也不得触碰任何真实登录态/凭证。锁的是三件会再次把人坑回「切了号却没换」的事:
 *   ① 缺模板兜底平台清单与写回判据同源(漏一家就又会出现静默沿用旧号)
 *   ② 默认 dry-run / 冲突参数拒绝 / 平台白名单(不许误写生产库)
 *   ③ 合成模板身份必须归位到票自己,且不许带凭证或自造标记(后者会被整份写进客户端文件)
 */
import { describe, expect, it } from 'vitest'
import {
  BACKFILL_PROVIDERS,
  buildSyntheticTemplate,
  maskPhone,
  parseArgs,
} from '../scripts/relay-backfill-session-template.js'
import { TEMPLATE_FALLBACK_PROVIDERS } from '../scripts/relay-login-local-verified.js'

const CRED_KEYS = [
  'token',
  'accessToken',
  'refreshToken',
  'expiresAt',
  'refreshTokenExpiresAt',
  'cookies',
]

describe('补模板脚本:参数裁决(默认只读,不猜)', () => {
  it('缺省 dry-run,显式 --apply 才写库', () => {
    expect(parseArgs([]).apply).toBe(false)
    expect(parseArgs(['--dry-run']).apply).toBe(false)
    expect(parseArgs(['--apply']).apply).toBe(true)
  })

  it('--apply 与 --dry-run 同时给 ⇒ 拒绝(不猜)', () => {
    const r = parseArgs(['--apply', '--dry-run'])
    expect(r.error).toMatch(/冲突/)
  })

  it('平台白名单只收四家静默兜底平台,其它一律拒绝', () => {
    expect(parseArgs(['--provider', 'qoder']).error).toBeNull()
    expect(parseArgs(['--provider', 'trae']).error).toMatch(/只接受/)
    expect(parseArgs(['--provider', 'workbuddy']).error).toMatch(/只接受/)
  })

  it('未知参数不静默吞', () => {
    expect(parseArgs(['--nuke']).error).toMatch(/未知参数/)
  })

  it('补采清单 = 写回判据的兜底平台清单(漏一家就留尾巴)', () => {
    expect(new Set(BACKFILL_PROVIDERS)).toEqual(new Set([...TEMPLATE_FALLBACK_PROVIDERS]))
  })
})

describe('补模板脚本:身份掩码与模板形状', () => {
  it('11 位手机号掩码,不暴露中段;非手机号不编造', () => {
    expect(maskPhone('15754320340')).toBe('157****0340')
    expect(maskPhone('')).toBe('')
    expect(maskPhone(null)).toBe('')
    expect(maskPhone('ok502319984@gmail.com')).toBe('ok5***')
  })

  const base = (over: Record<string, unknown> = {}) => ({
    provider: 'qoder',
    uid: '019f47e7-feab-7bba-bcde-f206d32e4407',
    name: '15754320340',
    secrets: {} as Record<string, unknown>,
    extraMetadata: {} as Record<string, unknown>,
    skeleton: null as Record<string, unknown> | null,
    ...over,
  })

  it('qoder:user.id 归位到票 uid、user.phone 取票内真实手机号,骨架照搬不发明端点', () => {
    const tpl = buildSyntheticTemplate(
      base({ skeleton: { schemaVersion: 1, authenticationContext: '["https://qoder.cn"]' } }),
    )
    expect(tpl).not.toBeNull()
    const user = tpl?.['user'] as Record<string, unknown>
    expect(user['id']).toBe('019f47e7-feab-7bba-bcde-f206d32e4407')
    expect(user['phone']).toBe('15754320340')
    expect(user['name']).toBe('157****0340')
    expect(tpl?.['schemaVersion']).toBe(1)
    expect(tpl?.['authenticationContext']).toBe('["https://qoder.cn"]')
  })

  it('qoder:auto:uid 没法判身份 ⇒ 不造半个模板', () => {
    expect(buildSyntheticTemplate(base({ uid: 'auto:abc' }))).toBeNull()
  })

  it('codearts:account.id 归位,label 取 extraMetadata 实采值', () => {
    const tpl = buildSyntheticTemplate(
      base({
        provider: 'codearts',
        extraMetadata: { account: { label: 'ok502319984' } },
        secrets: { domainId: 'd1' },
      }),
    )
    const account = tpl?.['account'] as Record<string, unknown>
    expect(account['id']).toBe('019f47e7-feab-7bba-bcde-f206d32e4407')
    expect(account['label']).toBe('ok502319984')
    expect(tpl?.['domainId']).toBe('d1')
  })

  it('minimax / opencode:平台资料键与票内 email 如实带入', () => {
    const mm = buildSyntheticTemplate(
      base({
        provider: 'minimax',
        uid: 'auto:1b079a5',
        secrets: { clientId: 'mcode-public', region: 'cn', recordKey: 'rk1' },
      }),
    )
    expect(mm?.['account_id']).toBe('auto:1b079a5')
    expect(mm?.['recordKey']).toBe('rk1')
    expect(mm?.['region']).toBe('cn')

    const oc = buildSyntheticTemplate(
      base({
        provider: 'opencode',
        uid: 'auto:d9fbe94',
        secrets: { providerID: 'opencode' },
        extraMetadata: { email: 'ok502319984@gmail.com' },
      }),
    )
    expect(oc?.['providerID']).toBe('opencode')
    expect(oc?.['email']).toBe('ok502319984@gmail.com')
  })

  it('未知平台不补;模板里绝不带凭证或自造标记(写回腿会整份复制进客户端文件)', () => {
    expect(buildSyntheticTemplate(base({ provider: 'unknown' }))).toBeNull()
    for (const p of BACKFILL_PROVIDERS) {
      const tpl = buildSyntheticTemplate(base({ provider: p }))
      expect(tpl).not.toBeNull()
      for (const k of CRED_KEYS) expect(k in (tpl as object)).toBe(false)
      expect('__synthetic' in (tpl as object)).toBe(false)
      expect('__synthesizedAt' in (tpl as object)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
