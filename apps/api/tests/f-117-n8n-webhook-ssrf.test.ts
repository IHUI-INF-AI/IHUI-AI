// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-117 回归锁(2026-11-08)。
 *
 * 病灶:/n8n/workflow/run 的 webhookPath 直接拼到基址后面,且请求头带 X-N8N-API-KEY。
 *       `https://n8n.internal@evil.com/x` 被 URL 解析为 host=evil.com → 平台密钥外泄 + SSRF。
 * 判据:webhookPath 只能落在基址同源内;他源/带 userinfo/协议相对/反斜杠一律判非法。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveN8nWebhookUrl } from '../src/utils/n8n-env.js'

const ORIGIN = 'https://n8n.internal'

describe('F-117 n8n webhookPath 必须锁在同源内', () => {
  it('正常相对路径解析到基址同源', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, '/webhook/abc')).toBe('https://n8n.internal/webhook/abc')
    expect(resolveN8nWebhookUrl(ORIGIN, '/webhook')).toBe('https://n8n.internal/webhook')
  })

  it('userinfo 伪装的他源域名 → 拒绝', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, 'https://n8n.internal@evil.com/x')).toBeNull()
  })

  it('协议相对 //evil.com → 拒绝', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, '//evil.com/x')).toBeNull()
  })

  it('绝对 url 指向他源 → 拒绝', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, 'https://evil.com/webhook')).toBeNull()
    expect(resolveN8nWebhookUrl(ORIGIN, 'http://127.0.0.1:9200/x')).toBeNull()
  })

  it('反斜杠绕过 → 拒绝', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, '\\\\evil.com\\x')).toBeNull()
  })

  it('同源绝对 url 放行', () => {
    expect(resolveN8nWebhookUrl(ORIGIN, 'https://n8n.internal/webhook/x')).toBe(
      'https://n8n.internal/webhook/x',
    )
  })

  it('源码锁:run 端点必须走解析器,不得直接字符串拼接', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/routes/ai-vendors/proxy-tools.ts', import.meta.url)),
      'utf8',
    )
    expect(source).toContain('resolveN8nWebhookUrl(')
    // 旧的 `${base.origin}${body.webhookPath ?? '/webhook'}` 直拼必须消失
    expect(source).not.toMatch(/base\.origin\}\$\{body\.webhookPath/)
  })
})
