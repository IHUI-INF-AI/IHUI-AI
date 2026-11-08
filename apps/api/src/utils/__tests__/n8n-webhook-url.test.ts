// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-117 夹具：n8n `webhookPath` 只允许站内相对路径。
 *
 * 改前事实：`/n8n/workflow/run` 直接 `` `${base.origin}${body.webhookPath}` `` 拼接。
 * 传 `@169.254.169.254/latest/meta-data/` 时，URL 解析把基址读成 userinfo、主机换成
 * 169.254.169.254 —— 请求仍带 `X-N8N-API-KEY`，既是云元数据 SSRF，也是密钥外泄
 * （`@attacker.example/x` 同型）。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { buildN8nWebhookUrl, isSafeN8nWebhookPath } from '../n8n-webhook-url.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROXY_TOOLS = resolve(HERE, '../../routes/ai-vendors/proxy-tools.ts')

const BASE = 'https://n8n.internal'
/** 改前会把主机换成元数据地址的 payload */
const METADATA_ATTACK = '@169.254.169.254/latest/meta-data/'

describe('F-117 webhookPath 主机切换一律拒绝', () => {
  it('@ 形式（userinfo + 主机切换）拒绝', () => {
    expect(isSafeN8nWebhookPath(METADATA_ATTACK)).toBe(false)
    expect(() => buildN8nWebhookUrl(BASE, METADATA_ATTACK)).toThrow()
    expect(() => buildN8nWebhookUrl(BASE, '@attacker.example/x')).toThrow()
  })

  it('协议相对 //、绝对 URL、反斜杠、非 / 开头一律拒绝', () => {
    expect(() => buildN8nWebhookUrl(BASE, '//169.254.169.254/latest/meta-data/')).toThrow()
    expect(() => buildN8nWebhookUrl(BASE, 'http://169.254.169.254/latest/meta-data/')).toThrow()
    expect(() => buildN8nWebhookUrl(BASE, '\\\\169.254.169.254\\x')).toThrow()
    expect(() => buildN8nWebhookUrl(BASE, 'webhook')).toThrow()
    expect(() => buildN8nWebhookUrl(BASE, '/webhook\\evil')).toThrow()
  })

  it('合法相对路径保持原拼接语义（含基址路径前缀与查询串）', () => {
    expect(buildN8nWebhookUrl(BASE, '/webhook/abc')).toBe('https://n8n.internal/webhook/abc')
    expect(buildN8nWebhookUrl(BASE, undefined)).toBe('https://n8n.internal/webhook')
    expect(buildN8nWebhookUrl('https://n8n.internal/base', '/webhook')).toBe(
      'https://n8n.internal/base/webhook',
    )
    expect(buildN8nWebhookUrl(BASE, '/webhook?x=1')).toBe('https://n8n.internal/webhook?x=1')
  })

  it('路由不得再直接拼接基址（源码锚点）', () => {
    const src = readFileSync(PROXY_TOOLS, 'utf-8')
    expect(src).not.toContain('${base.origin}${body.webhookPath')
    expect(src).toContain('buildN8nWebhookUrl(')
    expect(src).toMatch(/webhookPath: z[\s\S]{0,120}\.refine\(isSafeN8nWebhookPath/)
    expect(src).toContain('buildN8nWebhookUrl(base.origin, body.webhookPath)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
