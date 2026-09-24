// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'

import {
  computeExpectedDigestHex,
  readWebhookSecret,
  verifyWebhookSignature,
  WEBHOOK_SECRET_ENV_KEYS,
  WEBHOOK_SIGNATURE_HEADER,
} from '../src/services/github-app/signature'

const SECRET = 'whsec_test_secret_0123456789'
const BODY = JSON.stringify({ action: 'opened', repository: { full_name: 'octo/hello' } })

function sign(body: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

describe('github-app signature:头与常量', () => {
  it('签名头与 secret 环境变量键均为显式列举的小写常量', () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe('x-hub-signature-256')
    expect(WEBHOOK_SECRET_ENV_KEYS).toEqual(['GITHUB_APP_WEBHOOK_SECRET', 'GITHUB_WEBHOOK_SECRET'])
  })

  it('期望摘要为 64 位小写十六进制,与 GitHub 算法逐位一致', () => {
    const digest = computeExpectedDigestHex(BODY, SECRET)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(digest).toBe(createHmac('sha256', SECRET).update(BODY, 'utf8').digest('hex'))
  })
})

describe('github-app signature:正例', () => {
  it('正确签名通过', () => {
    expect(
      verifyWebhookSignature({ rawBody: BODY, signatureHeader: sign(BODY), secret: SECRET }),
    ).toEqual({
      ok: true,
    })
  })

  it('十六进制大小写混写仍算匹配(GitHub 给小写,但不得因大小写误拒)', () => {
    const upper = `sha256=${computeExpectedDigestHex(BODY, SECRET).toUpperCase()}`
    expect(
      verifyWebhookSignature({ rawBody: BODY, signatureHeader: upper, secret: SECRET }).ok,
    ).toBe(true)
  })

  it('Fastify 折叠成数组的头取首个值', () => {
    expect(
      verifyWebhookSignature({ rawBody: BODY, signatureHeader: [sign(BODY), ''], secret: SECRET })
        .ok,
    ).toBe(true)
  })
})

describe('github-app signature:反例一律 fail-closed', () => {
  it('body 被改动 → mismatch', () => {
    expect(
      verifyWebhookSignature({ rawBody: `${BODY}x`, signatureHeader: sign(BODY), secret: SECRET }),
    ).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('用错的 secret 签的名 → mismatch', () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sign(BODY, 'other'),
        secret: SECRET,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('缺签名头 → missing_signature(而不是放行)', () => {
    expect(
      verifyWebhookSignature({ rawBody: BODY, signatureHeader: undefined, secret: SECRET }),
    ).toEqual({
      ok: false,
      reason: 'missing_signature',
    })
  })

  it.each([
    ['sha1 旧算法', 'sha1=deadbeef'],
    ['摘要非十六进制', 'sha256=zzzzzzzz'],
    ['摘要长度不足', `sha256=${'a'.repeat(63)}`],
    ['摘要长度超出', `sha256=${'a'.repeat(65)}`],
    ['只有前缀', 'sha256='],
    ['整个头是垃圾', 'not-a-signature-at-all'],
  ])('形态非法(%s)→ malformed_signature', (_label, header) => {
    expect(
      verifyWebhookSignature({ rawBody: BODY, signatureHeader: header, secret: SECRET }),
    ).toEqual({
      ok: false,
      reason: 'malformed_signature',
    })
  })

  it.each([
    ['secret 为 null', null],
    ['secret 为空串', ''],
    ['secret 全空白', '   '],
  ])('%s → secret_not_configured,绝不误判为通过', (_label, secret) => {
    expect(verifyWebhookSignature({ rawBody: BODY, signatureHeader: sign(BODY), secret })).toEqual({
      ok: false,
      reason: 'secret_not_configured',
    })
  })

  it('任意畸形输入都不会抛异常(抛穿会变成 500)', () => {
    const inputs: Array<string | string[] | undefined> = [
      undefined,
      [],
      ['', ''],
      'sha256=' + '0'.repeat(64),
      1_000_000 as unknown as string,
    ]
    for (const signatureHeader of inputs) {
      expect(() =>
        verifyWebhookSignature({ rawBody: '', signatureHeader, secret: SECRET }),
      ).not.toThrow()
    }
  })
})

describe('github-app signature:readWebhookSecret', () => {
  it('按显式优先级取值:GITHUB_APP_WEBHOOK_SECRET 覆盖 GITHUB_WEBHOOK_SECRET', () => {
    expect(
      readWebhookSecret({ GITHUB_APP_WEBHOOK_SECRET: ' app ', GITHUB_WEBHOOK_SECRET: 'legacy' }),
    ).toBe('app')
    expect(readWebhookSecret({ GITHUB_WEBHOOK_SECRET: 'legacy' })).toBe('legacy')
  })

  it('两键都缺 / 都是空值 → null(调用方据此回 503)', () => {
    expect(readWebhookSecret({})).toBeNull()
    expect(
      readWebhookSecret({ GITHUB_APP_WEBHOOK_SECRET: '', GITHUB_WEBHOOK_SECRET: '  ' }),
    ).toBeNull()
  })

  it('不认识的键名不会被当成 secret', () => {
    expect(readWebhookSecret({ GITHUB_WEBHOOK_TOKEN: 'x', GITHUB_SECRET: 'y' })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
