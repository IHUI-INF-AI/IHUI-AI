// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 标准签名协议层的行为锁(2026-11-18 立)。
 *
 * S1 rfc3986:空格 %20、~ 不编码、! 编码(OAuth 与 AWS 都依赖这条编码规则)。
 * S2 HMAC   :用 RFC 4231 Test Case 2 的公开向量校验,确保不是"自己编的算法"。
 * S3 SigV4  :四步派生的结构必须齐(Credential/SignedHeaders/Signature),同输入恒等。
 * S4 OAuth1a:固定 nonce/时间戳后 base string 结构可复现。
 * S5 JWT    :三段结构、header alg=HS256、exp 按传入偏移计算。
 * S6 边界   :协议清单只有公开四件,不含任何私有协议。
 */
import { describe, it, expect } from 'vitest'
import {
  rfc3986,
  signHmacSha256,
  signAwsSigV4,
  signOAuth1a,
  signJwtHs256,
  describeSignatureProtocols,
} from '../src/services/upstream-adapters/signature-protocols.js'

describe('signature-protocols', () => {
  it('S1 rfc3986 编码规则', () => {
    expect(rfc3986('a b')).toBe('a%20b')
    expect(rfc3986('~')).toBe('~')
    expect(rfc3986('!')).toBe('%21')
    expect(rfc3986('a*b')).toBe('a%2Ab')
  })

  it('S2 HMAC-SHA256 对 RFC 4231 Test Case 2 公开向量', () => {
    const r = signHmacSha256({ secret: 'Jefe', canonicalString: 'what do ya want for nothing?' })
    expect(r.hex).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
    expect(r.headerValue).toBe(`hmac-sha256=${r.hex}`)
  })

  it('S2b HMAC 同输入恒等', () => {
    const a = signHmacSha256({ secret: 'k', canonicalString: 'c' })
    const b = signHmacSha256({ secret: 'k', canonicalString: 'c' })
    expect(a).toEqual(b)
  })

  it('S3 SigV4 结构齐全且可复现', () => {
    const input = {
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'secret',
      region: 'cn-north-1',
      service: 's3',
      method: 'GET',
      canonicalUri: '/bucket/key',
      canonicalQueryString: '',
      headers: { host: 'example.com', 'x-amz-date': '20261118T000000Z' },
      timestamp: '20261118T000000Z',
    } as const
    const r = signAwsSigV4(input)
    expect(r.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20261118\/cn-north-1\/s3\/aws4_request/)
    expect(r.authorization).toContain('SignedHeaders=host;x-amz-date')
    expect(r.authorization).toMatch(/Signature=[0-9a-f]{64}$/)
    expect(r.canonicalRequest.split('\n').length).toBe(8)
    expect(r.canonicalRequest).toContain('host:example.com')
    expect(r.canonicalRequest).toContain('x-amz-date:20261118T000000Z')
    expect(r.canonicalRequest).toContain('host;x-amz-date')
    expect(signAwsSigV4(input)).toEqual(r)
  })

  it('S4 OAuth1a 固定 nonce 后 base string 可复现', () => {
    const input = {
      method: 'GET',
      url: 'https://api.example.com/1.1/statuses?b=2&a=1',
      consumerKey: 'ck',
      consumerSecret: 'cs',
      token: 'tk',
      tokenSecret: 'ts',
      nonce: 'abc123',
      timestamp: '1763424000',
    } as const
    const r = signOAuth1a(input)
    expect(r.signatureBase.startsWith('GET&https%3A%2F%2Fapi.example.com%2F1.1%2Fstatuses&')).toBe(true)
    expect(r.signatureBase).toContain('oauth_consumer_key%3Dck')
    expect(r.header.startsWith('OAuth ')).toBe(true)
    expect(r.header).toContain('oauth_signature_method="HMAC-SHA1"')
    expect(signOAuth1a(input)).toEqual(r)
  })

  it('S5 JWT 三段 + alg=HS256 + exp', () => {
    const jwt = signJwtHs256({
      secret: 's',
      payload: { iss: 'ihui', sub: 'relay' },
      expiresInSec: 60,
      now: 1763424000,
    })
    const parts = jwt.split('.')
    expect(parts).toHaveLength(3)
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64').toString('utf8')) as { alg: string }
    expect(header.alg).toBe('HS256')
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString('utf8')) as { exp: number }
    expect(payload.exp).toBe(1763424060)
    expect(jwt).toBe(
      signJwtHs256({ secret: 's', payload: { iss: 'ihui', sub: 'relay' }, expiresInSec: 60, now: 1763424000 }),
    )
  })

  it('S6 只声明公开四件协议', () => {
    const d = describeSignatureProtocols()
    expect(d.protocols).toEqual(['hmac-sha256', 'aws-sigv4', 'oauth1a', 'jwt-hs256'])
    expect(d.note).toContain('公开标准协议')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
