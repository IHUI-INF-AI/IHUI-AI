// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts SDK-HMAC-SHA256 签名器金标准单测(2026-10-22 立)。
 *
 * 期望值取自 https://github.com/2951461586/CodeArts2API internal/codearts/signer_test.go
 * (由独立 Python 复刻 @huaweicloud/huaweicloud-sdk-core JS signer 语义算出,含两处非标准
 * 怪癖:CanonicalURI 强制补尾斜杠、CanonicalHeaders 尾 \n 导致 SignedHeaders 前多空行)。
 * 纯本地计算,不发任何网络请求。
 */
import { describe, it, expect } from 'vitest'
import {
  jsURLEncode,
  canonicalURI,
  canonicalQuery,
  signRequest,
  buildDpopProof,
  verifyDpopProof,
  generateDpopKeyJwk,
} from '../src/services/upstream-adapters/codearts-signer.js'

const vecAK = 'HSTAAAAAAAAAAAAAAAAAAA'
const vecSK = 'sk-secret-0123456789abcdef'
const vecSTS = 'sts-token-abc123'

describe('codearts jsURLEncode(RFC3986 unreserved 之外一律 %XX 大写)', () => {
  it.each([
    ['abcXYZ019-._~', 'abcXYZ019-._~'],
    ['a b', 'a%20b'],
    ['$&+,:;=@', '%24%26%2B%2C%3A%3B%3D%40'],
    ['模型', '%E6%A8%A1%E5%9E%8B'],
    ['a/b', 'a%2Fb'],
    ['100%', '100%25'],
  ])('jsURLEncode(%j) = %j', (input, want) => {
    expect(jsURLEncode(input)).toBe(want)
  })
})

describe('codearts canonicalURI(逐段编码 + 强制补尾斜杠)', () => {
  it.each([
    ['https://h/api/v2/chat/completions', '/api/v2/chat/completions/'],
    ['https://h/', '/'],
    ['https://h', '/'],
    ['https://h/a/b/', '/a/b/'],
    // $ + 必须编码(Go url.PathEscape 会放过,JS signer 不放过)
    ['https://h/a$b+c', '/a%24b%2Bc/'],
    // 中文与空格按 UTF-8 逐字节 %XX 大写
    ['https://h/模型 名称', '/%E6%A8%A1%E5%9E%8B%20%E5%90%8D%E7%A7%B0/'],
  ])('canonicalURI(%j) = %j', (raw, want) => {
    expect(canonicalURI(new URL(raw))).toBe(want)
  })
})

describe('codearts canonicalQuery(键、值各自排序后再编码)', () => {
  it.each([
    ['', ''],
    ['b=2&a=1&a=0', 'a=0&a=1&b=2'],
    ['z=~-._', 'z=~-._'],
    ['q=a b', 'q=a%20b'],
  ])('canonicalQuery(?%j) = %j', (raw, want) => {
    expect(canonicalQuery(new URL(`https://h/p?${raw}`))).toBe(want)
  })
})

describe('codearts signRequest 金标准向量', () => {
  const cases: Array<{ name: string; want: string; run: () => Record<string, string> }> = [
    {
      // POST body 参与签名、X-Security-token 注入、header 值 trim("  agent-general  " → "agent-general")
      name: 'POST with body, STS and padded header value',
      run: () =>
        signRequest({
          accessKeyId: vecAK,
          secretAccessKey: vecSK,
          securityToken: vecSTS,
          method: 'POST',
          url: 'https://snap-access.cn-north-4.myhuaweicloud.com/api/v2/chat/completions',
          body: '{"model":"glm-5.3-flash","stream":false}',
          headers: {
            'Content-Type': 'application/json',
            'X-Sdk-Date': '20260101T000000Z',
            maas_type: 'benefit',
            'model-id': 'glm-5.3-flash',
            'X-Ot-Function': '  agent-general  ',
          },
        }),
      want:
        `SDK-HMAC-SHA256 Access=${vecAK}, SignedHeaders=content-type;host;maas_type;model-id;x-ot-function;x-sdk-date;x-security-token, ` +
        'Signature=d74d70f38c5d7e69b73c728740a2c7397a4191737d93f207d1a6f5fce49e99c4',
    },
    {
      // 非 POST/PUT/PATCH 的 body 不参与签名(payload = sha256(""))
      name: 'GET with query, body must not be signed',
      run: () =>
        signRequest({
          accessKeyId: 'AKID',
          secretAccessKey: 'SECRET',
          method: 'GET',
          url: 'https://opengw.developer.huaweicloud.com/api/v1/user/tokens/balance?b=2&a=1&a=0',
          body: '{"ignored":true}',
          headers: { 'X-Sdk-Date': '20260203T040506Z' },
        }),
      want:
        'SDK-HMAC-SHA256 Access=AKID, SignedHeaders=host;x-sdk-date, ' +
        'Signature=0acd5e903f49fd4e91d71aee6188d446d6f76863c5d8f13a4d428c0af017af45',
    },
    {
      // 路径/查询需要 JS urlencode($ + 中文 空格),STS 注入
      name: 'path and query need JS urlencode',
      run: () =>
        signRequest({
          accessKeyId: 'AKID',
          secretAccessKey: 'SECRET',
          securityToken: 'TOK',
          method: 'POST',
          url: 'https://snap-access.cn-north-4.myhuaweicloud.com/api/v2/models/模型 名称/a$b+c?q=a b&z=~-._',
          body: '{}',
          headers: { 'X-Sdk-Date': '20260304T050607Z', 'x-ot-session-id': 'ses_deadbeefdeadbeef' },
        }),
      want:
        'SDK-HMAC-SHA256 Access=AKID, SignedHeaders=host;x-ot-session-id;x-sdk-date;x-security-token, ' +
        'Signature=177aeae3dc48dc4b2dec46b1754ee2e1ea3af8d3f76044c33fe74f74df5f7224',
    },
    {
      // PUT 空 body(sha256("") = e3b0c442…),无 security token 时不注入 x-security-token
      name: 'PUT with empty body',
      run: () =>
        signRequest({
          accessKeyId: 'AKID',
          secretAccessKey: 'SECRET',
          method: 'PUT',
          url: 'https://snap-access.cn-north-4.myhuaweicloud.com/v1/ops/claim',
          body: '',
          headers: { 'X-Sdk-Date': '20260405T060708Z' },
        }),
      want:
        'SDK-HMAC-SHA256 Access=AKID, SignedHeaders=host;x-sdk-date, ' +
        'Signature=1ee2960c0fad87a352395c32d2e4cb4f1fc2755cd92d09822dea0994700f3f79',
    },
  ]

  it.each(cases)('$name → Authorization 逐字命中金标准', ({ want, run }) => {
    const got = run()
    expect(got['Authorization']).toBe(want)
    expect(got['host']).toBeDefined()
  })

  it('security token 为空时不注入 x-security-token', () => {
    const got = signRequest({
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      method: 'GET',
      url: 'https://h/p',
      headers: { 'X-Sdk-Date': '20260101T000000Z' },
    })
    expect(got['x-security-token']).toBeUndefined()
    expect(got['Authorization']).toBeDefined()
  })

  it('header 键小写化、只 trim 值不 trim 名', () => {
    const got = signRequest({
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      method: 'GET',
      url: 'https://h/p',
      headers: { 'X-Sdk-Date': '20260101T000000Z' },
    })
    expect(got['x-sdk-date']).toBe('20260101T000000Z')
    expect(got['X-Sdk-Date']).toBeUndefined()
  })

  it('入参 headers 不被就地修改', () => {
    const input = { 'Content-Type': 'application/json', 'X-Sdk-Date': '20260101T000000Z' }
    signRequest({
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      securityToken: 'STS',
      method: 'POST',
      url: 'https://h/p',
      body: '{}',
      headers: input,
    })
    expect(Object.keys(input)).toHaveLength(2)
    expect((input as Record<string, string>)['host']).toBeUndefined()
    expect(input['Content-Type']).toBe('application/json')
  })

  it('未提供 X-Sdk-Date 时自动补 UTC 时间戳(YYYYMMDDTHHMMSSZ)', () => {
    const got = signRequest({
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      method: 'GET',
      url: 'https://h/p',
      headers: {},
    })
    expect(got['x-sdk-date']).toMatch(/^\d{8}T\d{6}Z$/)
    expect(got['Authorization']).toMatch(/^SDK-HMAC-SHA256 Access=AK, /)
  })
})

describe('codearts DPoP 证明(ES256 JWS,RFC 9449)', () => {
  it('生成的证明可被同钥公钥验签,header/payload 形状正确', () => {
    const jwk = generateDpopKeyJwk()
    const proof = buildDpopProof(jwk, {
      htm: 'POST',
      htu: 'https://sts.cn-north-4.myhuaweicloud.com/v1/oauth2/tokens',
      iat: 1766361600,
      jti: 'deadbeef'.repeat(8),
    })
    const [h, p, s] = proof.split('.')
    expect(h && p && s).toBeTruthy()
    const header = JSON.parse(Buffer.from(h as string, 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(p as string, 'base64url').toString('utf8'))
    expect(header).toMatchObject({ alg: 'ES256', typ: 'dpop+jwt' })
    expect(header.jwk).toMatchObject({ kty: 'EC', crv: 'P-256', x: jwk['x'], y: jwk['y'] })
    expect(payload).toEqual({
      htm: 'POST',
      htu: 'https://sts.cn-north-4.myhuaweicloud.com/v1/oauth2/tokens',
      iat: 1766361600,
      jti: 'deadbeef'.repeat(8),
    })
    // ES256 裸签名 r||s = 64 字节(非 DER)
    expect(Buffer.from(s as string, 'base64url')).toHaveLength(64)
    expect(verifyDpopProof(proof, jwk)).toBe(true)
  })

  it('非 P-256 EC 私钥直接拒绝', () => {
    expect(() =>
      buildDpopProof({ kty: 'oct', d: 'zzz' }, { htm: 'POST', htu: 'https://h' }),
    ).toThrow(/不支持/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
