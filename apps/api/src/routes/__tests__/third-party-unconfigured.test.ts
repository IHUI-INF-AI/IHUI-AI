// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方通道未配置 ⇒ 认证类端点不得回 200 假成功(2026-10-22 立)。
 *
 * 立因:`auth-extended.ts` 里曾有 9 处 `reply.send(success({ mock: true, msg: '…未配置' }))`。
 * 那种答复 HTTP 200、信封 `{code:0,data}` 与真登录**完全同形**,消费方看不出失败:
 * 小程序 `api.openId()` 拿到 `openid: undefined` 仍按成功往下走 ⇒ "没接通"被读成"登录过了"。
 *
 * 直接触发点是同一天另一处修复:把支付宝的"配置"判据改成"私钥文件真读得到才算配好"之后,
 * 支付宝立刻掉进那支 mock 分支 —— **判据变严必须同时收口兜底分支**,否则修的是账面、
 * 放开的是鉴权(§0.10 失效方向只能是"多要一次说明",不能是"多放一次成功")。
 *
 * 本文件是黑盒 inject 真跑路由,并留一条**形状反向锁**:整个 auth-extended 源码里
 * 不得再出现 `success({ mock: true })` 这种认证兜底(摘掉反向锁 ⇒ 下一位作者可以照抄旧形态)。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { authExtendedRoutes } from '../auth-extended.js'
import { isAlipayConfigured } from '../../services/alipay.js'

/** 仓根:③/④ 两档要用"仓内一定存在的真实文件"和"一个目录"当对照夹具,不落临时件 */
const ROOT = resolve(__dirname, '../../../../..')

let app: FastifyInstance

beforeEach(async () => {
  // 这一族的用例判的就是"未配置"那一档 ⇒ 必须把凭据位清空,不能依赖 CI 机器上有没有真键
  for (const k of [
    'GOOGLE_APP_ID',
    'GOOGLE_SECRET',
    'WX_MINI_APPID',
    'WX_MINI_SECRET',
    'DINGTALK_APP_KEY',
    'DINGTALK_APP_SECRET',
    'DINGTALK_REDIRECT_URI',
    'WECOM_CORP_ID',
    'WECOM_SECRET',
    'WECOM_AGENT_ID',
    'WECOM_SUITE_ID',
    'ALIPAY_APP_ID',
    'ALIPAY_PRIVATE_KEY',
    'ALIPAY_PRIVATE_KEY_PATH',
  ])
    process.env[k] = ''
  app = Fastify({ logger: false })
  await app.register(authExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('未配置的第三方通道 ⇒ 503 响亮失败,绝不回 200 mock 成功', () => {
  const routes: Array<[string, string, string]> = [
    ['GET', '/api/auth/google/pc/wxCode?code=FAKE', 'Google'],
    ['GET', '/api/auth/alipay/pc/wxCode?code=FAKE', 'Alipay'],
    ['GET', '/api/auth/wechat/mini/login?code=FAKE', '微信小程序'],
    ['GET', '/api/auth/dingtalk/auth-url', '钉钉'],
    ['GET', '/api/auth/login/enterprise/pc/wxCode?code=FAKE', '企业微信'],
  ]

  for (const [method, url, platform] of routes) {
    it(`${url} ⇒ 503 且点名缺哪些键`, async () => {
      const res = await app.inject({ method: method as 'GET', url })
      expect(res.statusCode).toBe(503)
      const body = res.json()
      expect(body.code).toBe(503)
      // 反向锁:响应体里不得再出现 mock 这个"看起来像成功"的形状
      expect(JSON.stringify(body)).not.toMatch(/"mock"\s*:\s*true/)
      expect(String(body.message)).toContain(platform)
    })
  }

  it('需要登录态的那两支也不能用 mock 兜底(它们曾回裸 success({mock:true}))', async () => {
    const phone = await app.inject({ method: 'POST', url: '/api/auth/wechat/mini/phone?code=FAKE' })
    // 未带凭据 ⇒ 先撞上 authenticate 的 401,这本身就是"没有兜底成功"的证据
    expect([401, 503]).toContain(phone.statusCode)
    expect(phone.payload).not.toMatch(/"mock"\s*:\s*true/)
  })
})

describe('源码级反向锁:认证路由里不得再出现 mock 兜底', () => {
  it('auth-extended.ts 的 success({ mock: true }) 出现次数必须为 0', () => {
    const src = readFileSync(resolve(__dirname, '../auth-extended.ts'), 'utf8')
    // 只数代码面:注释里那句"旧写法回 success({mock:true})"是解释,不是违规
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const hits = codeOnly.match(/success\(\s*\{\s*mock\s*:\s*true/g) ?? []
    expect(hits).toHaveLength(0)
  })
})

/**
 * 支付宝那把"配置好了"的尺子:必须验到私钥**真读得到**,不是验键名字符串非空。
 * 三档成对钉住 —— 摘掉文件在场这一维,"路径写了但文件没了"就会重新被读成已配置(实测现场)。
 */
describe('isAlipayConfigured 验的是私钥可用性,不是键名在场', () => {
  const setKeys = (kv: Record<string, string>) => {
    for (const k of ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PRIVATE_KEY_PATH'])
      process.env[k] = ''
    Object.assign(process.env, kv)
  }

  it('① 只给了路径、文件不在位 ⇒ 未配置(这就是 2026-10-22 实测到的线上形态)', () => {
    setKeys({
      ALIPAY_APP_ID: '2021000000000000',
      ALIPAY_PRIVATE_KEY_PATH: resolve(__dirname, 'no-such-key-file.pem'),
    })
    expect(isAlipayConfigured()).toBe(false)
  })

  it('② 私钥内联在 env 里 ⇒ 配置好了(不该被文件那一档拖累)', () => {
    setKeys({
      ALIPAY_APP_ID: '2021000000000000',
      ALIPAY_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----x',
    })
    expect(isAlipayConfigured()).toBe(true)
  })

  it('③ 路径指向一个真实可读的文件 ⇒ 配置好了(反向:不许修成一律红)', () => {
    // 用仓内一定存在且非空的文件当夹具,不落任何临时件:
    // 建临时文件要引根工具层的 scratch-dir(无 d.ts ⇒ apps/api 的 tsconfig 报 TS7016),
    // 而这一档要证的只是"读得到就算配置",不需要真的新造文件。
    setKeys({
      ALIPAY_APP_ID: '2021000000000000',
      ALIPAY_PRIVATE_KEY_PATH: resolve(ROOT, 'apps/api/package.json'),
    })
    expect(isAlipayConfigured()).toBe(true)
  })

  it('④ 路径指向目录 ⇒ 未配置(有人把目录当私钥文件填,读它会 EISDIR)', () => {
    setKeys({
      ALIPAY_APP_ID: '2021000000000000',
      ALIPAY_PRIVATE_KEY_PATH: resolve(ROOT, 'apps/api'),
    })
    expect(isAlipayConfigured()).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
