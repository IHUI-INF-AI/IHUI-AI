// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信手机号「一键登录」接线锁(从 apps/miniapp-taro/tests 搬入,消门 103 的端→repo-tooling 反向依赖)。
 * 测试读小程序源码做文本形态反向锁,用 node:test 跑;同一份 maskComments 在 repo-tooling 层内,不跨层。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../apps/miniapp-taro/src')
const codeFace = (rel) => maskComments(readFileSync(resolve(SRC, rel), 'utf8'))

describe('api/index.ts 里 oneTapLogin 的请求形状', () => {
  const apiCode = codeFace('api/index.ts')
  const from = apiCode.indexOf('export const oneTapLogin')
  const to = apiCode.indexOf('export const', from + 'export const'.length)
  const decl = apiCode.slice(from, to === -1 ? from + 300 : to)

  it('打到 one-tap-login 端点', () => {
    // 允许 `post<T>(...)` 这一形(2026-10-23 一键登录不再二次解包 ⇒ 加了返回类型实参);
    // 端点字面量仍逐字判,换成别的端点照样红。
    assert.match(decl, /post(?:<[^>]+>)?\(\s*['"`]\/auth\/wechat\/mini\/one-tap-login['"`]/)
  })

  it('入参形状逐字只有 loginCode / phoneCode(两个 code 不得同名、不得漏一个)', () => {
    assert.match(
      decl,
      /oneTapLogin\s*=\s*\(\s*data:\s*\{\s*loginCode:\s*string;\s*phoneCode:\s*string\s*\}\s*\)/,
    )
  })

  it('请求体就是 data 本身:手机号不得由客户端自报(§5 认证不等于授权)', () => {
    assert.ok(decl.includes("/auth/wechat/mini/one-tap-login', data)"))
    assert.doesNotMatch(decl, /\bphone\s*:/)
  })
})

describe('pages/user/index.tsx 接线形态', () => {
  const page = codeFace('pages/user/index.tsx')

  it('一键登录走 one-tap-login 端点', () => {
    assert.ok(page.includes('api.oneTapLogin({ loginCode, phoneCode })'))
  })

  it('反向锁:不得再读那个从来不存在的 openIdRes.token 字段', () => {
    assert.doesNotMatch(page, /openIdRes\??\.token/)
  })

  it('反向锁:不得再把两个 code 传反(旧缺陷的文本形态)', () => {
    assert.doesNotMatch(page, /code:\s*phoneCode,\s*phoneCode:\s*loginCode/)
  })

  it('反向锁:登录路径不得再打需要鉴权的 /mini/phone(那是已登录换绑端点)', () => {
    assert.doesNotMatch(page, /api\.getPhoneNumber\(/)
  })

  it('拿到 token 后三件套都要落(access / refresh / user),少一件就是半截登录', () => {
    const start = page.indexOf('api.oneTapLogin')
    const body = page.slice(start, start + 900)
    assert.ok(body.includes('setToken(res.accessToken)'))
    assert.ok(body.includes('setRefreshToken(res.refreshToken)'))
    assert.ok(body.includes('persistUserInfo(res.user)'))
  })
})

describe('codeFace 自身的形状锁', () => {
  const raw = readFileSync(resolve(SRC, 'pages/user/index.tsx'), 'utf8')

  it('原始面确实含有那两条旧缺陷原文(否则反向锁是在打空靶)', () => {
    assert.match(raw, /openIdRes\??\.token/)
    assert.match(raw, /code:\s*phoneCode,\s*phoneCode:\s*loginCode/)
  })

  it('遮罩后它们消失,而真调用仍在', () => {
    const masked = codeFace('pages/user/index.tsx')
    assert.doesNotMatch(masked, /openIdRes\??\.token/)
    assert.ok(masked.includes('api.oneTapLogin('))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
