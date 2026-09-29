// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815418 的回归:im-gateway webhook 的验签面。
 *
 * 票面两条要求:
 *  ① 密钥归属不得由客户端自报的 body.userId 决定,且 adapter 不存在与验签失败**同形回包**;
 *  ② HMAC 必须对原始字节算,不得对再序列化结果算。
 * 两条都要求"合法签名仍通过"的正向对照(只测被拒那一支,门可能只是把功能改坏了)。
 *
 * 判据函数是纯函数(resolveWebhookAdapter),所以这里不连库、不起 fastify、不发网络
 * —— AGENTS §5 测试隔离铁律:不得对生产 PG/Redis 产生任何副作用。
 */
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// 被测模块在导入时会拉数据库层;这里整体桩掉,保证本文件零连接。
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
}))

import {
  resolveWebhookAdapter,
  WEBHOOK_SIGNATURE_FALLBACK_HEADERS,
  type WebhookCandidate,
} from '../src/routes/im-gateway.js'

const hex = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex')
const b64 = (secret: string, body: string) =>
  createHmac('sha256', secret).update(body).digest('base64')

const CAND_A: WebhookCandidate = { userId: 'user-A', enabled: true, webhookSecret: 'secret-A' }
const CAND_B: WebhookCandidate = { userId: 'user-B', enabled: true, webhookSecret: 'secret-B' }

describe('G-815418 ① 归属由服务端按签名算出', () => {
  it('正向对照:B 家的合法签名 ⇒ 解析到 B(与请求体自报的 userId 无关)', () => {
    const raw = '{"type":"text","text":"hi"}'
    const out = resolveWebhookAdapter({
      rows: [CAND_A, CAND_B],
      headers: { 'x-im-signature': hex('secret-B', raw) },
      rawBody: raw,
    })
    expect(out.kind).toBe('resolved')
    if (out.kind === 'resolved') expect(out.adapter.userId).toBe('user-B')
  })

  it('别人家的密钥签不动我:用 A 的 secret 签,只会解析到 A,不会顺手落到 B', () => {
    const raw = '{"a":1}'
    const out = resolveWebhookAdapter({
      rows: [CAND_A, CAND_B],
      headers: { 'x-im-signature': hex('secret-A', raw) },
      rawBody: raw,
    })
    expect(out.kind === 'resolved' && out.adapter.userId).toBe('user-A')
  })

  it('存在性 oracle 已关:零候选与坏签名回包**逐字同形**(都是同一个 unauthorized)', () => {
    const raw = '{"a":1}'
    const noAdapter = resolveWebhookAdapter({ rows: [], headers: {}, rawBody: raw })
    const badSig = resolveWebhookAdapter({
      rows: [CAND_A],
      headers: { 'x-im-signature': hex('wrong-secret', raw) },
      rawBody: raw,
    })
    const missingHeader = resolveWebhookAdapter({ rows: [CAND_A], headers: {}, rawBody: raw })
    expect(noAdapter).toEqual({ kind: 'unauthorized' })
    expect(badSig).toEqual(missingHeader)
    expect(badSig).toEqual(noAdapter)
  })

  it('未启用的候选不参与归属(整平台只有停用行 ⇒ 与"没有配过"同形)', () => {
    const raw = '{"a":1}'
    const off = resolveWebhookAdapter({
      rows: [{ userId: 'user-C', enabled: false, webhookSecret: 'secret-C' }],
      headers: { 'x-im-signature': hex('secret-C', raw) },
      rawBody: raw,
    })
    expect(off).toEqual({ kind: 'unauthorized' })
  })
})

describe('G-815418 ② HMAC 的输入是原始字节', () => {
  it('key 顺序不同也要能验过:签名对真字节算,函数收到真字节 ⇒ 通过', () => {
    const raw = '{"b":1,"a":2}'
    const out = resolveWebhookAdapter({
      rows: [CAND_A],
      headers: { 'x-im-signature': hex('secret-A', raw) },
      rawBody: raw,
    })
    expect(out.kind).toBe('resolved')
  })

  it('反向对照:同一份正文若被再序列化(空白与数字格式被改掉)⇒ 必拒 —— 这条就是票面那个坏法', () => {
    // 夹具刻意用 "空格 + 2.0":JSON.parse→stringify 会归一成 {"a":1,"b":2},
    // 而 key 顺序对 JS 对象并不保证重排,拿顺序当差异会把这条用例变成恒真。
    const raw = '{"a": 1,"b":2.0}'
    const reserialized = JSON.stringify(JSON.parse(raw))
    expect(reserialized).not.toBe(raw) // 夹具确实造出了差异,否则这条用例没有牙
    const out = resolveWebhookAdapter({
      rows: [CAND_A],
      headers: { 'x-im-signature': hex('secret-A', raw) },
      rawBody: reserialized,
    })
    expect(out).toEqual({ kind: 'unauthorized' })
  })

  it('正向对照(同一条正文):把真字节交给判据就验得过 ⇒ 上一条的红来自取材档,不是判据过严', () => {
    const raw = '{"a": 1,"b":2.0}'
    const out = resolveWebhookAdapter({
      rows: [CAND_A],
      headers: { 'x-im-signature': hex('secret-A', raw) },
      rawBody: raw,
    })
    expect(out.kind).toBe('resolved')
  })
})

describe('header 兜底清单与编码档', () => {
  it('平台专属 header 优先,兜底 header 也认(与旧路由同形)', () => {
    const raw = '{"a":1}'
    const sig = hex('secret-A', raw)
    for (const name of WEBHOOK_SIGNATURE_FALLBACK_HEADERS) {
      const out = resolveWebhookAdapter({ rows: [CAND_A], headers: { [name]: sig }, rawBody: raw })
      expect(out.kind === 'resolved' && out.adapter.userId).toBe('user-A')
    }
    const withMetaHeader = resolveWebhookAdapter({
      rows: [CAND_A],
      signatureHeader: 'x-hub-signature-256',
      headers: { 'x-hub-signature-256': sig },
      rawBody: raw,
    })
    expect(withMetaHeader.kind).toBe('resolved')
  })

  it('sha256= 前缀与 base64 编码档都验得过(不得把某一档读成坏签名)', () => {
    const raw = '{"a":1}'
    const prefixed = resolveWebhookAdapter({
      rows: [CAND_A],
      headers: { 'x-im-signature': `sha256=${hex('secret-A', raw)}` },
      rawBody: raw,
    })
    expect(prefixed.kind).toBe('resolved')
    const encoded = resolveWebhookAdapter({
      rows: [CAND_A],
      signatureEncoding: 'base64',
      headers: { 'x-im-signature': b64('secret-A', raw) },
      rawBody: raw,
    })
    expect(encoded.kind).toBe('resolved')
  })
})

describe('无密钥平台的边界(单机开发部署)', () => {
  it('恰好一个启用候选且谁都没配密钥 ⇒ 无歧义,通过', () => {
    const out = resolveWebhookAdapter({
      rows: [{ userId: 'solo', enabled: true }],
      headers: {},
      rawBody: '{}',
    })
    expect(out.kind === 'resolved' && out.adapter.userId).toBe('solo')
  })

  it('两个都没配密钥的候选 ⇒ 拒(此时归属只能由请求方挑,那正是本票要关的口子)', () => {
    const out = resolveWebhookAdapter({
      rows: [
        { userId: 'one', enabled: true },
        { userId: 'two', enabled: true },
      ],
      headers: {},
      rawBody: '{}',
    })
    expect(out).toEqual({ kind: 'unauthorized' })
  })
})

describe('路由侧接线(反向锁:判据在而没人调用等于没有)', () => {
  const SRC = fileURLToPath(new URL('../src/routes/im-gateway.ts', import.meta.url))
  const src = readFileSync(SRC, 'utf8')

  it('webhook 路由必须真的调 resolveWebhookAdapter,并保留原始字节的 parser', () => {
    expect(src.includes('resolveWebhookAdapter({')).toBe(true)
    expect(src.includes("addContentTypeParser(\n    'application/json'")).toBe(true)
    expect(src.includes('.rawBody')).toBe(true)
  })

  it('不得再按客户端自报的 body.userId 定位密钥(旧措辞与旧查询都不得回来)', () => {
    expect(src.includes('body.userId 必填')).toBe(false)
    const webhookRegion = src.slice(
      src.indexOf("'/im-gateway/webhook/:platform'"),
      src.indexOf('// 解析入站消息'),
    )
    expect(webhookRegion.includes('eq(imAdapters.userId, userId)')).toBe(false)
    expect(webhookRegion.includes('status(404)')).toBe(false)
    expect(webhookRegion.includes('status(403)')).toBe(false)
  })

  it('归属与后续落库用的是验签结果里的 userId,不是请求体字段', () => {
    const webhookRegion = src.slice(
      src.indexOf("'/im-gateway/webhook/:platform'"),
      src.indexOf('// 解析入站消息'),
    )
    expect(webhookRegion.includes('decided.adapter.userId')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
