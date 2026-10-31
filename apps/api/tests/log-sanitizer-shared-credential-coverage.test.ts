// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据层脱敏(services/log-sanitizer.ts)必须吃共享层唯一规则源 —— 票「后端脱敏两套规则并存」现读收口。
 *
 * 立据(不是推断,是量出来的):改前用同一批 16 族样本喂 sanitizeText,13 族原样出明文
 * (ghp_/AIza/AKIA/xoxb-/glpat-/sk_/ihui_、PEM 私钥块、不带 Bearer 前缀的裸 JWT、
 * 非三段式的 Bearer 不透明 token、password= 赋值、URL query 里的 api_key)。
 * 而 routes/admin/relay-logs.ts 的**列表面**与 **metadata 面**只过 sanitizeLogEntry
 * (详情面才在外面补 redactCredentialText)⇒ 这些明文随响应出仓。
 *
 * 每一条漏盖都有正向对照(普通文本/路径/非敏感参数不得被误伤)——
 * 摘掉 sanitizeText 里 `for (const rule of SECRET_RULES)` 那一步,下面 10 条凭据族断言即翻红。
 */
import { describe, expect, it } from 'vitest'

import { sanitizeText } from '../src/services/log-sanitizer.js'

/** 每族都是"完整形状 + 前后普通文本",证明脱敏按形状而非按整串打码 */
const wrap = (secret: string) => `[2026-10-30 10:00:00] upstream event ok; value=${secret}; done`

describe('数据层脱敏:凭据族覆盖(此前漏盖的 13 族)', () => {
  const LEAKED_FAMILIES: Array<[string, string]> = [
    ['GitHub token ghp_', `ghp_${'A'.repeat(36)}`],
    ['Google API key AIza', `AIza${'B'.repeat(35)}`],
    ['AWS Access Key ID', `AKIA${'C'.repeat(16)}`],
    ['Slack token xoxb-', `xoxb-${'D'.repeat(28)}`],
    ['GitLab token glpat-', `glpat-${'E'.repeat(20)}`],
    ['上游号池 sk_xxxx', `sk_${'F'.repeat(24)}`],
    ['IHUI 对客 key ihui_', `ihui_${'G'.repeat(24)}`],
    [
      '裸 JWT(无 Bearer 前缀)',
      `eyJ${'H'.repeat(20)}.eyJ${'I'.repeat(20)}.eyJ${'J' + 'K'.repeat(19)}`,
    ],
    ['Bearer 不透明 token(非三段式)', `Bearer ${'L'.repeat(40)}`],
    ['PEM 私钥块', '-----BEGIN RSA PRIVATE KEY-----\nMIIEvQIBADAN\n-----END RSA PRIVATE KEY-----'],
    ['通用 password= 赋值', 'password=SuperSecret99'],
  ]

  for (const [label, secret] of LEAKED_FAMILIES) {
    it(`${label} 不再以原文出仓`, () => {
      const out = sanitizeText(wrap(secret))
      expect(out).not.toContain(secret.slice(0, 18))
      // 正向对照:同一串里的普通散文逐字保留(脱敏不是"一律打码")
      expect(out).toContain('upstream event ok')
      expect(out).toContain('; done')
    })
  }

  it('URL query 只盖敏感参数值,路径与非敏感参数保留', () => {
    const out = sanitizeText(wrap('https://api.example.com/cb?access_token=abcd1234efgh&state=ok'))
    expect(out).not.toContain('access_token=abcd1234efgh')
    expect(out).toContain('/cb')
    expect(out).toContain('state=ok')
  })

  it('redactApiKey=false 时凭据族交回调用方(开关语义不得被"顺手全盖"洗掉)', () => {
    const secret = `ghp_${'A'.repeat(36)}`
    expect(sanitizeText(wrap(secret), { redactApiKey: false })).toContain(secret)
  })

  it('keepOriginalForAdmin 仍是显式逃生舱(整段原样出,含封顶)', () => {
    const secret = `AKIA${'C'.repeat(16)}`
    expect(sanitizeText(wrap(secret), { keepOriginalForAdmin: true })).toContain(secret)
  })
})

describe('数据层脱敏:既有格式契约不得被收敛改坏', () => {
  it('sk- 形态保留"部分留尾"(管理员要认出是哪把 key),且不二次堆叠标记', () => {
    const secret = `sk-${'Kqx1a7v3mZp8dRn4Yt2Ws6uJ'}`
    const out = sanitizeText(wrap(secret))
    expect(out).not.toContain(secret)
    expect(out).toContain('sk-***')
    expect(out).not.toContain('[REDACTED_SECRET]')
  })

  it('邮箱/手机号形状与封顶标记逐字不变', () => {
    expect(sanitizeText('mail a@b.com here')).toBe('mail a***@b.com here')
    expect(sanitizeText('tel 13812345678 ok')).toBe('tel 138****5678 ok')
  })

  it('普通散文零改动(共享层 k=v 规则不得误伤无前缀单词)', () => {
    const plain = 'request completed normally; tokens=128 cost=0.02 model=deepseek-chat'
    expect(sanitizeText(plain)).toBe(plain)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
