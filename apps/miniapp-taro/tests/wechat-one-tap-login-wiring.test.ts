// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信手机号「一键登录」接线锁。
 *
 * 立因(2026-10-22 逐条读码):`pages/user/index.tsx` 那段 onOneClickLogin 从未成功登录过
 * 任何人,三重断裂叠在一起 ——
 *  ① 先调 `api.openId(loginCode)` 再读 `openIdRes.token`,而 GET /auth/wechat/mini/login
 *     的响应里**没有 token 这个字段**(它回 accessToken)⇒ 恒 undefined;
 *  ② 兜底调 `api.getPhoneNumber({ code: phoneCode, phoneCode: loginCode })` ——
 *     **两个 code 传反**;
 *  ③ 后端 /mini/phone 从 **query** 取 code(客户端发 body)、还要求已登录、也不回 token。
 * 修法是新后端端点 /auth/wechat/mini/one-tap-login(免鉴权、strictObject、回 token+user),
 * 消费点一次调用它。本文件钉住「别再退回那三种死形态」。
 *
 * 源码级锁的正当性:端内 vitest 是 environment:'node'(无 jsdom),`src/api/index.ts` 的
 * 传递依赖里有 Taro 构建期全局(实测 `ENABLE_INNER_HTML is not defined`),运行时 import 打不通;
 * 而这三条恰恰是「文本形态即缺陷」—— 字段名传反、读一个不存在的字段,都不需要运行时就能判。
 * 同仓先例:apps/web/src/lib/__tests__/auto-submit-gate-wiring.test.ts 读 login-form 源码。
 *
 * 遮罩必须是全仓那一份(§0.6):本文件头注逐字引用了 `openIdRes.token` 与
 * `api.getPhoneNumber({ code: phoneCode, phoneCode: loginCode })` 这两条**旧缺陷原文**,
 * 不遮注释的话反向锁会咬到自己的散文(实测 4 条里 3 条假红)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { maskComments } from '../../../scripts/lib/code-mask.mjs'

const SRC = resolve(__dirname, '../src')
/** 只看代码面:注释整段剥掉,字符串保留(反向锁判的是「有没有这样调用」,不是「有没有这样解释」) */
const codeFace = (rel: string) => maskComments(readFileSync(resolve(SRC, rel), 'utf8'))

describe('api/index.ts 里 oneTapLogin 的请求形状', () => {
  const apiCode = codeFace('api/index.ts')
  const from = apiCode.indexOf('export const oneTapLogin')
  const to = apiCode.indexOf('export const', from + 'export const'.length)
  /** 只取这一条导出自己的那一段:切进下一条会把它的形参当成本模块的请求字段 */
  const decl = apiCode.slice(from, to === -1 ? from + 300 : to)

  it('打到 one-tap-login 端点', () => {
    expect(decl).toContain("post('/auth/wechat/mini/one-tap-login'")
  })

  it('入参形状逐字只有 loginCode / phoneCode(两个 code 不得同名、不得漏一个)', () => {
    expect(decl).toMatch(
      /oneTapLogin\s*=\s*\(\s*data:\s*\{\s*loginCode:\s*string;\s*phoneCode:\s*string\s*\}\s*\)/,
    )
  })

  it('请求体就是 data 本身:手机号不得由客户端自报(§5 认证不等于授权)', () => {
    expect(decl).toContain("/auth/wechat/mini/one-tap-login', data)")
    expect(decl).not.toMatch(/\bphone\s*:/)
  })
})

describe('pages/user/index.tsx 接线形态', () => {
  const page = codeFace('pages/user/index.tsx')

  it('一键登录走 one-tap-login 端点', () => {
    expect(page).toContain('api.oneTapLogin({ loginCode, phoneCode })')
  })

  it('反向锁:不得再读那个从来不存在的 openIdRes.token 字段', () => {
    expect(page).not.toMatch(/openIdRes\??\.token/)
  })

  it('反向锁:不得再把两个 code 传反(旧缺陷的文本形态)', () => {
    expect(page).not.toMatch(/code:\s*phoneCode,\s*phoneCode:\s*loginCode/)
  })

  it('反向锁:登录路径不得再打需要鉴权的 /mini/phone(那是已登录换绑端点)', () => {
    expect(page).not.toMatch(/api\.getPhoneNumber\(/)
  })

  it('拿到 token 后三件套都要落(access / refresh / user),少一件就是半截登录', () => {
    const body = page.slice(page.indexOf('api.oneTapLogin'), page.indexOf('api.oneTapLogin') + 900)
    expect(body).toContain('setToken(res.accessToken)')
    expect(body).toContain('setRefreshToken(res.refreshToken)')
    expect(body).toContain('persistUserInfo(res.user)')
  })
})

/**
 * 遮罩本身的方向自证:反向锁必须能「因为注释而红」→ 加了遮罩才绿。
 * 摘掉 maskComments 这三条即翻红 —— 没有这一组,反向锁在注释改写后就成了空转通过。
 */
describe('codeFace 自身的形状锁', () => {
  const raw = readFileSync(resolve(SRC, 'pages/user/index.tsx'), 'utf8')

  it('原始面确实含有那两条旧缺陷原文(否则反向锁是在打空靶)', () => {
    expect(raw).toMatch(/openIdRes\??\.token/)
    expect(raw).toMatch(/code:\s*phoneCode,\s*phoneCode:\s*loginCode/)
  })

  it('遮罩后它们消失,而真调用仍在', () => {
    expect(codeFace('pages/user/index.tsx')).not.toMatch(/openIdRes\??\.token/)
    expect(codeFace('pages/user/index.tsx')).toContain('api.oneTapLogin(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
