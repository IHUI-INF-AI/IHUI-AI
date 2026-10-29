// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话 Cookie 域作用域(2026-10-20 立项)—— `Domain=` 只在请求 host 真属于该域时才发。
//
// 立因(本机实锤,不是推演):这台机同一个 api 进程同时服务公网 bsm.aizhs.top 与本机
// 127.0.0.1:8801,而 `COOKIE_DOMAIN=.aizhs.top` 此前是**无条件**挂上的。RFC 6265 §5.2.3
// 规定 Domain 不是请求 host 所属域的 Cookie 由浏览器直接拒收 ⇒ 在本机地址上
// auth_token / refresh_token 从未落地过:内存 Bearer 一切正常(界面显示已登录),但只认
// Cookie 的 /admin/* 守卫恒 307,SSO「授权并跳转」的守卫探测恒判被拦,刷新即掉线。
//   POST http://127.0.0.1:8801/api/auth/logout
//   set-cookie: auth_token=; Max-Age=0; Domain=.aizhs.top; Path=/; HttpOnly; SameSite=Lax
//
// 本套件钉五件事(正反各一 + 接线 + 降级方向,全程 app.inject 不连库/不连 Redis §5):
//   ① 单元:域本身 / 子域 ⇒ 发共享域;IP / localhost / 后缀形似而实非的域 ⇒ 退回 host-only
//   ② 接线:同一份 setAuthCookies,Host=bsm.aizhs.top ⇒ 带 Domain;Host=127.0.0.1:8801 ⇒ 不带
//   ③ 摘除与下发共用同一判据(clearAuthCookies 不得把域挂回来)
//   ④ 方向锁:host 取不到 ⇒ **维持**配置值(不得拿畸形输入把生产降级成 host-only);
//      未配置 COOKIE_DOMAIN ⇒ 两条链路都恒 host-only(与本配置落地前逐字相同)
//   ⑤ 会话提示 Cookie(2026-10-27):与两条 httpOnly 凭据同批下发/同批摘除,同域同寿命,
//      但**不得带 HttpOnly** —— 带上了前端就读不到,冷启动闸门依旧把老用户判成匿名
import { describe, it, expect, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.COOKIE_DOMAIN = '.aizhs.top'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const { resolveCookieDomain, setAuthCookies, clearAuthCookies } =
  await import('../src/utils/auth-cookies.js')

/** 一份 auth-cookies 模块(接线用例要能把「改 env 后重新 import 的那一份」也接上 app)。 */
type AuthCookiesModule = {
  setAuthCookies: typeof setAuthCookies
  clearAuthCookies: typeof clearAuthCookies
}

const PAYLOAD = { accessToken: 'access.jwt.value', refreshToken: 'refresh.jwt.value' }

/** 起一枚只挂 cookie 插件的最小 app,把 setAuthCookies/clearAuthCookies 接到真 reply 上。
 *  trustProxy 必须与生产同形(config/index.ts TRUSTED_PROXIES 缺省 '127.0.0.1,::1'):
 *  request.hostname 是否采信 X-Forwarded-Host 由它决定,不设的话「公网臂」那条回归测不出来。 */
async function buildApp(mod: AuthCookiesModule): Promise<FastifyInstance> {
  const app = Fastify({ trustProxy: '127.0.0.1,::1' })
  await app.register(cookie)
  app.get('/set', (request, reply) => {
    mod.setAuthCookies(reply, PAYLOAD)
    return { ok: true }
  })
  app.get('/clear', (request, reply) => {
    mod.clearAuthCookies(reply)
    return { ok: true }
  })
  await app.ready()
  return app
}

/** inject 时指定 Host(Next 的同源反代会原样透传 host,这里复刻那一步)。 */
async function cookiesFor(app: FastifyInstance, path: string, host: string): Promise<string[]> {
  const res = await app.inject({ method: 'GET', url: path, headers: { host } })
  return res.headers['set-cookie'] as string[]
}

describe('resolveCookieDomain —— 域作用域判据', () => {
  it('配置域本身与它的子域 ⇒ 发共享域 Cookie(公网跨子域共享登录的正例)', () => {
    expect(resolveCookieDomain('aizhs.top')).toBe('.aizhs.top')
    expect(resolveCookieDomain('bsm.aizhs.top')).toBe('.aizhs.top')
    expect(resolveCookieDomain('api.aizhs.top')).toBe('.aizhs.top')
    expect(resolveCookieDomain('deep.sub.aizhs.top')).toBe('.aizhs.top')
  })

  it('带端口、大小写混写都要先归一再判(本机入口就是 127.0.0.1:8801)', () => {
    expect(resolveCookieDomain('BSM.Aizhs.Top:443')).toBe('.aizhs.top')
    expect(resolveCookieDomain('127.0.0.1:8801')).toBeUndefined()
  })

  it('回环 / localhost / 局域网 IP ⇒ 退回 host-only,否则浏览器拒收、Cookie 永不落地', () => {
    for (const host of ['127.0.0.1', 'localhost:8801', '192.168.1.20:8801', '0.0.0.0:8801']) {
      expect(resolveCookieDomain(host)).toBeUndefined()
    }
  })

  it('IPv6 字面量不得被端口切法劈碎', () => {
    expect(resolveCookieDomain('[::1]:8801')).toBeUndefined()
    expect(resolveCookieDomain('::1')).toBeUndefined()
  })

  it('后缀形似而实非的域必须拒(把 Cookie 发给别人的域 = 会话外泄)', () => {
    for (const host of ['evil-aizhs.top', 'aizhs.top.evil.com', 'notaizhs.top']) {
      expect(resolveCookieDomain(host)).toBeUndefined()
    }
  })

  it('host 取不到 ⇒ 维持配置值(降级只准在正向认出 host 不属于该域时发生)', () => {
    expect(resolveCookieDomain(undefined)).toBe('.aizhs.top')
    expect(resolveCookieDomain('   ')).toBe('.aizhs.top')
  })
})

describe('setAuthCookies / clearAuthCookies —— 接线', () => {
  const mod = { setAuthCookies, clearAuthCookies }
  /** 只挑出两条 httpOnly 凭据 Cookie(提示 Cookie 的性质相反,断言必须分开写)。 */
  const credentialCookies = (list: string[]) => list.filter((c) => !/ihui_session_hint=/.test(c))
  const hintCookie = (list: string[]) => list.find((c) => /^ihui_session_hint=/.test(c))

  it('公网 host 下发带 Domain 的共享域 Cookie,本机 host 下发 host-only Cookie', async () => {
    const instance = await buildApp(mod)
    const prod = await cookiesFor(instance, '/set', 'bsm.aizhs.top')
    const local = await cookiesFor(instance, '/set', '127.0.0.1:8801')

    expect(prod).toHaveLength(3)
    expect(prod.every((c) => c.includes('Domain=.aizhs.top'))).toBe(true)
    expect(local).toHaveLength(3)
    expect(local.some((c) => /Domain=/i.test(c))).toBe(false)
    // 除 Domain 之外的属性不得顺手改掉(httpOnly/SameSite 是 P2-18 的立命之本)
    const creds = credentialCookies(local)
    expect(creds).toHaveLength(2)
    expect(creds.every((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c))).toBe(true)
    // 会话提示 Cookie 的存在意义就是"JS 看得见",因此它必须**不带** HttpOnly;
    // 其余属性与凭据同形(同域同寿命),否则前端读到的信号与浏览器实有的凭据两套口径。
    const hint = hintCookie(local)
    expect(hint).toBeDefined()
    expect(hint as string).toMatch(/^ihui_session_hint=1;/)
    expect(hint).toContain('Path=/')
    expect(hint).toContain('Max-Age=2592000')
    expect(/HttpOnly/i.test(hint as string)).toBe(false)
    expect(/SameSite=Lax/i.test(hint as string)).toBe(true)
  })

  it('登出摘除与下发共用同一判据:本机档不得把 Domain 挂回来,提示 Cookie 也同批摘', async () => {
    const instance = await buildApp(mod)
    const prod = await cookiesFor(instance, '/clear', 'bsm.aizhs.top')
    const local = await cookiesFor(instance, '/clear', '127.0.0.1:8801')

    expect(prod).toHaveLength(3)
    expect(prod.every((c) => c.includes('Domain=.aizhs.top') && /Max-Age=0/.test(c))).toBe(true)
    expect(local.every((c) => /Max-Age=0/.test(c))).toBe(true)
    expect(local.some((c) => /Domain=/i.test(c))).toBe(false)
    expect(hintCookie(local)).toBeDefined()
    expect(/HttpOnly/i.test(hintCookie(local) as string)).toBe(false)
  })

  it('可信代理透传的 X-Forwarded-Host 决定域(公网访客经反代的真实形态)', async () => {
    const instance = await buildApp(mod)
    // 反代把访客原始 host 放进 X-Forwarded-Host,自己只留 127.0.0.1:8802 当 Host;
    // remoteAddress 127.0.0.1 命中 trustProxy ⇒ 采信转发的 host。
    const res = await instance.inject({
      method: 'GET',
      url: '/set',
      remoteAddress: '127.0.0.1',
      headers: { host: '127.0.0.1:8802', 'x-forwarded-host': 'bsm.aizhs.top' },
    })
    const setCookies = res.headers['set-cookie'] as string[]
    expect(setCookies.every((c) => c.includes('Domain=.aizhs.top'))).toBe(true)
  })

  it('不可信来源伪造 X-Forwarded-Host 不得换来共享域 Cookie', async () => {
    const instance = await buildApp(mod)
    // remoteAddress 换成公网地址 ⇒ 不在 trustProxy 名单 ⇒ 转发头必须被无视
    const res = await instance.inject({
      method: 'GET',
      url: '/set',
      remoteAddress: '203.0.113.5',
      headers: { host: 'evil.example.com', 'x-forwarded-host': 'bsm.aizhs.top' },
    })
    const setCookies = res.headers['set-cookie'] as string[]
    expect(setCookies).toHaveLength(3)
    expect(setCookies.some((c) => /Domain=/i.test(c))).toBe(false)
  })
})

describe('未配置 COOKIE_DOMAIN —— 行为与本配置落地前逐字相同', () => {
  afterEach(() => {
    process.env.COOKIE_DOMAIN = '.aizhs.top'
    vi.resetModules()
  })

  it('env 缺席时两条链路都恒 host-only,且 host 取不到也不凭空造域', async () => {
    delete process.env.COOKIE_DOMAIN
    vi.resetModules()
    const fresh = await import('../src/utils/auth-cookies.js')
    expect(fresh.resolveCookieDomain('bsm.aizhs.top')).toBeUndefined()
    expect(fresh.resolveCookieDomain(undefined)).toBeUndefined()

    const instance = await buildApp(fresh)
    const prod = await cookiesFor(instance, '/set', 'bsm.aizhs.top')
    expect(prod).toHaveLength(3)
    expect(prod.some((c) => /Domain=/i.test(c))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
