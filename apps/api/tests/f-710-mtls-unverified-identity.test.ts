// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-710 回归锁(2026-11-13)。
 *
 * 病灶:required=false(默认降级模式)下客户端出示自签证书,socket.authorized === false
 * 只 warn 就继续;若路由配了 cnAllowList,攻击者可控的 CN 就能命中白名单,并被
 * request.mtlsClient = buildClientIdentity(cert) 注入下游当作授权判据。
 *
 * 修法(a):只在 socket.authorized === true 时注入身份(未验证时不产出身份);
 * 同时 cnAllowList 分支显式要求 authorized,白名单语义只保留"已验证主体"这一层。
 *
 * 自证红:回退注入判据 → authorized:false 也能拿到 mtlsClient;
 * 回退白名单判据 → 自签证书 + 白名单 CN 返回 200。
 */
import { TLSSocket } from 'node:tls'
import type { PeerCertificate } from 'node:tls'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import mtlsPlugin, { type MtlsRouteConfig } from '../src/plugins/mtls.js'

const VALID_FROM = '2026-01-01T00:00:00.000Z'
const VALID_TO = '2027-01-01T00:00:00.000Z'

function makeCert(cn: string): PeerCertificate {
  return {
    subject: { CN: cn },
    issuer: { CN: 'self-signed' },
    fingerprint256: 'AA:BB:CC',
    valid_from: VALID_FROM,
    valid_to: VALID_TO,
  } as unknown as PeerCertificate
}

/** 假 TLSSocket:authorized 与 peer certificate 均由用例指定(不建真实 TLS 连接)。 */
function makeSocket(cert: PeerCertificate, authorized: boolean): TLSSocket {
  const socket = new TLSSocket()
  socket.authorized = authorized
  socket.getPeerCertificate = () => cert
  Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1', configurable: true })
  return socket
}

async function buildApp(opts: {
  cert: PeerCertificate
  authorized: boolean
  mtls: MtlsRouteConfig
}) {
  const app = Fastify()
  await app.register(mtlsPlugin)
  app.addHook('onRequest', async (request) => {
    // app.inject 的 request.raw.socket 是 MockSocket,替换成假 TLSSocket 才能进证书分支
    request.raw.socket = makeSocket(opts.cert, opts.authorized)
  })
  app.get('/probe', { config: { mtls: opts.mtls } }, async (request) => ({
    mtlsClient: request.mtlsClient ?? null,
  }))
  await app.ready()
  return app
}

describe('F-710 未验证证书不得产出可授权身份', () => {
  it('authorized:false 且 CN 命中白名单 → 403,白名单不放行', async () => {
    const app = await buildApp({
      cert: makeCert('good-client'),
      authorized: false,
      mtls: { required: false, cnAllowList: ['good-client'] },
    })
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('not verified')
    await app.close()
  })

  it('authorized:false 且未配白名单 → 200 但不注入 mtlsClient', async () => {
    const app = await buildApp({
      cert: makeCert('good-client'),
      authorized: false,
      mtls: { required: false },
    })
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ mtlsClient: null })
    await app.close()
  })

  it('authorized:true 且 CN 命中白名单 → 200 且身份正确注入', async () => {
    const app = await buildApp({
      cert: makeCert('good-client'),
      authorized: true,
      mtls: { required: false, cnAllowList: ['good-client'] },
    })
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(200)
    expect(res.json().mtlsClient).toMatchObject({
      cn: 'good-client',
      fingerprint: 'aabbcc',
      issuer: 'self-signed',
      validFrom: VALID_FROM,
      validTo: VALID_TO,
    })
    await app.close()
  })

  it('authorized:true 但 CN 不在白名单 → 403,白名单仍然生效', async () => {
    const app = await buildApp({
      cert: makeCert('evil-client'),
      authorized: true,
      mtls: { required: false, cnAllowList: ['good-client'] },
    })
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('not in allow list')
    await app.close()
  })

  it('required:true 且 authorized:false → 401(强制模式行为不变)', async () => {
    const app = await buildApp({
      cert: makeCert('good-client'),
      authorized: false,
      mtls: { required: true, cnAllowList: ['good-client'] },
    })
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('verification failed')
    await app.close()
  })
})

