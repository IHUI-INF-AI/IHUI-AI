// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 源站直连守卫镜像用例(2026-10-21 立)。
 *
 * 纪律:判据一律 import 源文件(§0.6/§22c,禁复制第二份);逐条正反配对 ——
 * 每一族"拒"都有同族"放"钉住失败方向(空/畸形/私网/回环/0.0.0.0/具名域一律放行);
 * W 段是"摘掉新增判据即翻红"的变异对照(接线锁 + 判据同源锁)。
 */
import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { isPrivateOrReservedIp, parseIpAddress } from '@ihui/shared/utils/ssrf-guard'
import { evaluateOriginHostGuard } from '../origin-direct-host-guard'
import { config, proxy } from '../../../proxy'

const DENIED = [
  // 公网 IPv4 字面量(本次事故形态:EdgeOne 直填回源后 8801 公网可达)
  '218.27.70.129',
  '218.27.70.129:8801',
  '8.8.8.8:53',
  // 公网 IPv6(家宽 IPv6 同样公网)
  '[2408:8234:0:100::1]',
  '[2408:8234:0:100::1]:8801',
  // IPv4-mapped 折回 family 4 后仍是公网(Host 头里 IPv6 必须带方括号,RFC 7230)
  '[::ffff:218.27.70.129]',
] as const

const ALLOWED = [
  // 合法 CDN 回源 / 隧道转发 Host(EdgeOne 回源 Host = 加速域名,当次实测)
  'www.aizhs.top',
  'bsm.aizhs.top',
  'aizhs.top:443',
  'www.aizhs.top.', // 根点 FQDN 形态
  // 健康检查与本机/局域网访问(deploy/win/ihui-deploy.ps1 用 127.0.0.1:8801)
  '127.0.0.1:8801',
  '127.0.0.1',
  'localhost:3000',
  'localhost',
  '[::1]',
  '[::1]:8801',
  '0.0.0.0',
  '0.0.0.0:8801',
  '192.168.1.37:8801',
  '10.0.0.5',
  '172.16.0.1',
  '172.31.255.255',
  '169.254.169.254', // 云元数据段 = 私网侧,本守卫不兼 SSRF
  '100.64.0.1', // CGNAT
  '[::]', // IPv6 未指定地址
  '[2001:DB8::1]', // 文档段(保留集)
  '[fe80::1%eth0]', // 链路本地带 zone
  // 空 / 畸形 Host ⇒ 失败方向必须是放行(§0.3)
  '   ',
  'host:',
  'a:b:c', // 未加方括号的 IPv6,RFC 7230 不合法
  '::ffff:218.27.70.129', // 同上:裸 IPv6 字面量按畸形放行(逃逸面,如实登记)
  '[::1', // 方括号未闭合
  '[::1]x', // 括号后挂垃圾
  '218.27.70.129:abc', // 端口非数字 ⇒ 畸形(逃逸面已如实写进守卫头注)
  '218.27.70.129:', // 空端口
  '1.2.3', // BSD 缩写形态:解析器判"非 IP 字面量" ⇒ 按具名主机放行
  '218.27.70.129.', // 尾点四段半:解析不出 ⇒ 放行
] as const

describe('源站直连守卫:公网 IP 字面量 ⇒ 拒', () => {
  for (const host of DENIED) {
    it(`deny ${host}`, () => {
      const d = evaluateOriginHostGuard(host)
      expect(d.allowed).toBe(false)
      expect(d.reason).toBe('public-ip-literal-host')
    })
  }
})

describe('源站直连守卫:域名/私网/回环/0.0.0.0/畸形 ⇒ 放', () => {
  for (const host of ALLOWED) {
    it(`allow ${JSON.stringify(host)}`, () => {
      expect(evaluateOriginHostGuard(host).allowed).toBe(true)
    })
  }
  it('allow missing-host(undefined / null)', () => {
    expect(evaluateOriginHostGuard(undefined).allowed).toBe(true)
    expect(evaluateOriginHostGuard(null).allowed).toBe(true)
    expect(evaluateOriginHostGuard('').allowed).toBe(true)
  })
})

describe('正反配对:同一形态的公网/私网必须落在相反的裁决上', () => {
  it('v4 同端口对:218.27.70.129:8801 拒 ↔ 192.168.1.37:8801/127.0.0.1:8801/0.0.0.0:8801 放', () => {
    expect(evaluateOriginHostGuard('218.27.70.129:8801').allowed).toBe(false)
    expect(evaluateOriginHostGuard('192.168.1.37:8801').allowed).toBe(true)
    expect(evaluateOriginHostGuard('127.0.0.1:8801').allowed).toBe(true)
    expect(evaluateOriginHostGuard('0.0.0.0:8801').allowed).toBe(true)
  })
  it('v6 同族对:[2408:8234:0:100::1] 拒 ↔ [::1]/[fe80::1] 放', () => {
    expect(evaluateOriginHostGuard('[2408:8234:0:100::1]').allowed).toBe(false)
    expect(evaluateOriginHostGuard('[::1]').allowed).toBe(true)
    expect(evaluateOriginHostGuard('[fe80::1]').allowed).toBe(true)
  })
  it('mapped 折叠对:[::ffff:218.27.70.129] 拒 ↔ [::ffff:127.0.0.1] 放', () => {
    expect(evaluateOriginHostGuard('[::ffff:218.27.70.129]').allowed).toBe(false)
    expect(evaluateOriginHostGuard('[::ffff:127.0.0.1]').allowed).toBe(true)
  })
})

describe('变异对照:判据同源锁 + 接线锁(摘掉任何一环即翻红)', () => {
  it('M1 判据同源:每一条 deny 都必须"解析成 IP ∧ 不属私有/保留段"(源取自 ssrf-guard,守卫被掏空/私藏第二份尺子都会与此断言分叉)', () => {
    const bareOf = (h: string): string => {
      if (h.startsWith('[')) return h.slice(1, h.indexOf(']'))
      const ci = h.indexOf(':')
      return ci < 0 ? h : h.slice(0, ci)
    }
    for (const host of DENIED) {
      const bare = bareOf(host)
      expect(parseIpAddress(bare), `parse ${host}`).not.toBeNull()
      expect(isPrivateOrReservedIp(bare), `private-or-reserved ${host}`).toBe(false)
      expect(evaluateOriginHostGuard(host).allowed, `guard-agrees ${host}`).toBe(false)
    }
    for (const host of ['127.0.0.1', '192.168.1.37', '10.0.0.5', '0.0.0.0', '::1', 'fe80::1']) {
      expect(isPrivateOrReservedIp(host), `shared-ruler ${host}`).toBe(true)
      expect(evaluateOriginHostGuard(host).allowed, `guard-agrees ${host}`).toBe(true)
    }
  })

  it('M2 接线锁(真集成):直接驱动 proxy() —— 公网 IP Host 得 403 且响应体不含内部信息;合法 Host 全站放行;鉴权射程逐字不变;matcher 已扩全站。摘掉 proxy.ts 里的任何一环,本用例当场翻红', async () => {
    // 载体:undici Request 的 headers guard 会静默丢弃 forbidden 的 Host 头
    // (实测 new NextRequest(url,{headers:{host}}).headers.get('host') === null),
    // 而 proxy() 真读的只有 headers.get('host') / nextUrl.{pathname,search,clone} /
    // cookies.get 三处 —— 用逐字对齐的替身驱动**真 proxy 函数体**,不是替身函数。
    const req = (path: string, host: string): NextRequest => {
      const url = new URL(`http://${host}${path}`)
      const headers = new Headers({ host })
      expect(headers.get('host'), `carrier sanity ${host}`).toBe(host)
      return {
        headers,
        nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
        cookies: { get: () => undefined },
      } as unknown as NextRequest
    }

    // ① 公网 IP 直连 ⇒ 403,正文只有 'Forbidden'(不带堆栈/配置/判据原因)
    const blocked = await proxy(req('/admin/x', '218.27.70.129:8801'))
    expect(blocked.status).toBe(403)
    expect(await blocked.text()).toBe('Forbidden')
    const blocked6 = await proxy(req('/', '[2408:8234:0:100::1]'))
    expect(blocked6.status).toBe(403)

    // ② 合法 Host 全站放行:CDN 回源域 / 健康检查 / 局域网 / 公网站点路径一律非 403
    for (const host of [
      'www.aizhs.top',
      '127.0.0.1:8801',
      'localhost:3000',
      '192.168.1.37:8801',
      '[::1]',
    ]) {
      const ok = await proxy(req('/login', host))
      expect(ok.status, `allow /login @ ${host}`).not.toBe(403)
    }

    // ③ 鉴权射程与旧窄 matcher 等价:公网站点路径不得被重定向(全站 matcher 的灾难失败型)
    const pub = await proxy(req('/pricing', 'www.aizhs.top'))
    expect(pub.status).toBe(200)
    // 受保护路径未登录仍 307 到 SSO(旧行为原样)
    const admin = await proxy(req('/admin/users', 'www.aizhs.top'))
    expect(admin.status).toBe(307)
    expect(new URL(admin.headers.get('location') ?? '').pathname).toBe('/sso/login')
    const edu = await proxy(req('/edu/edu-management', 'www.aizhs.top'))
    expect(edu.status).toBe(307)
    // /admin/unauthorized 不阻塞
    const una = await proxy(req('/admin/unauthorized', 'www.aizhs.top'))
    expect(una.status).toBe(200)

    // ④ matcher 现值 = 全站(守卫拦截面必须覆盖所有路径)
    expect(config.matcher).toEqual(['/:path*'])
  })

  it('M3 反证:被掏空(恒放行)的守卫必须与真守卫在 DENIED 族全体分歧 —— 真守卫现在逐条判拒,任何"摘掉判据"的改动当场翻红', () => {
    const neuteredAllowed = true // 恒放行 stub 的输出
    for (const host of DENIED) {
      expect(evaluateOriginHostGuard(host).allowed, `neutered-divergence ${host}`).not.toBe(
        neuteredAllowed,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
