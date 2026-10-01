// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录屏错误身份对账(「错误身份收口」第一格)
 *
 * LoginScreen 的 `form.error` 契约是混合态:`translateError` 只把 `auth.*` 前缀当 i18n
 * 键翻译,其余按原样上屏。批量迁移(第五十三波)当时把这里 7 处整族跳过,理由是"要收得
 * 先立 status→键 映射表";现读复核后收口为:**ApiResult 六站在把失败响应交给
 * `apiFailureToText(res, t('auth.loginFailed'))` 之后再进 setError** —— 键分支照旧,
 * 服务端失败分支从"裸串上屏"升级为"errorCode → status → 文案"判序后的文案,不需要新增
 * 第二份 status→键 表。
 *
 * 为什么不是渲染级:LoginScreen 模块顶层有 `require('../../assets/*.svg')`(metro
 * svg-transformer 编译期产物),vitest 无 require 垫片,整文件收集期即失败,渲染路径在本
 * 仓 harness 下结构上不可达 —— 故此处为「逐站接线锁(该站必须把整个 res 交给唯一出口)
 * + 出口在该站参数形态下的真行为断言」两层,判据仍现读被审面所在磁盘源文。
 *
 * 七站中六站(res / apiRes 皆 ApiResult,带 status)已换出口;剩一站刻意保留:
 * applyOAuthResult 的 `res` 是 OAuthRedirectResult(无 status/errorCode,身份在
 * lib/oauth-redirect.ts 上游已丢)—— 强制换出口会把 provider 原串喂进文案正则,在这里
 * 复刻「把 401 撞进参数类正则」那一型,故保留 `??` 并以注释钉住真正待改的上游契约。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { apiFailureToText } from '@ihui/shared/utils'

// 与 budget-note.test.ts 同款:__dirname 在 vitest SSR 变换下可用;import.meta.url 在本仓
// 环境是 http 形态(vite 模块 URL),readFileSync(new URL(…)) 会报 "URL must be of scheme file"。
const source = readFileSync(join(__dirname, '..', 'src', 'screens', 'LoginScreen.tsx'), 'utf8')

/** 每站:endpoint 调用锚点 → 该站第一个 setError 必须恰好是出口调用(把整个响应交给判序)。 */
const SITES: ReadonlyArray<{ anchor: string; site: string; label: string }> = [
  {
    anchor: 'const res = await sendEmailCode(email.trim())',
    site: "form.setError(apiFailureToText(res, t('auth.loginFailed')))",
    label: '邮箱验证码发送',
  },
  {
    anchor: 'const res = await loginByEmailCode(email.trim(), emailCode.trim())',
    site: "form.setError(apiFailureToText(res, t('auth.loginFailed')))",
    label: '邮箱验证码登录',
  },
  {
    anchor: 'const res = await sendSmsCode(phone.trim())',
    site: "form.setError(apiFailureToText(res, t('auth.loginFailed')))",
    label: '短信验证码发送',
  },
  {
    anchor: 'const res = await loginBySms(phone.trim(), phoneCode.trim())',
    site: "form.setError(apiFailureToText(res, t('auth.loginFailed')))",
    label: '手机验证码登录',
  },
  {
    anchor: 'const apiRes = await loginByCarrierOneClick({',
    site: "form.setError(apiFailureToText(apiRes, t('auth.loginFailed')))",
    label: '运营商一键登录',
  },
  {
    anchor: 'const res = await loginByWechat(code)',
    site: "form.setError(apiFailureToText(res, t('auth.loginFailed')))",
    label: '微信 App 授权登录',
  },
]

describe('LoginScreen:服务端失败分支逐站接唯一出口', () => {
  it.each(SITES)('$label 站:响应到手后第一个 form.setError 即出口调用', ({ anchor, site }) => {
    const from = source.indexOf(anchor)
    expect(from, `锚点消失(endpoint 调用行被改写?测试必须先随实态更新)`).toBeGreaterThan(-1)
    const next = source.indexOf('form.setError(', from)
    expect(next).toBeGreaterThan(-1)
    // 该站的调用文本以固定长度逐字比对(调用形如 setError(apiFailureToText(res, t('…'))) ——
    // 用"到第一个右括号"截断会把 t('auth.loginFailed' 的收括号当成语句结尾)
    expect(source.slice(next, next + site.length)).toBe(site)
  })

  it("六站之外不再残留任何 `res.error ?? 'auth.loginFailed'` 直塞(除刻意保留的 OAuth 站)", () => {
    const raw = source.match(/form\.setError\((?:res|apiRes)\.error \?\? 'auth\.loginFailed'\)/g)
    expect(raw).toHaveLength(1)
    const oauthFn = source.indexOf('const applyOAuthResult')
    const at = source.indexOf(raw![0]!)
    expect(at).toBeGreaterThan(oauthFn)
    // 保留站必须带理由注释(OAuthRedirectResult 无 status,上游契约待改)
    expect(source.slice(Math.max(0, at - 400), at)).toContain('OAuthRedirectResult')
  })

  it('出口确从共享层引入,不是端内自拼的第三份判序', () => {
    expect(source).toContain("import { apiFailureToText } from '@ihui/shared/utils'")
    expect(source).not.toMatch(/STATUS_TO_ZH|toUserFriendlyMessage/)
  })
})

describe('出口在登录站参数形态下的身份优先行为', () => {
  const LOGIN_FAILED_TEXT = '登录失败' // t('auth.loginFailed') 的中文兜底(演示用,链路不依赖其字面值)

  it('401 的 "Invalid or expired token" 判成「重新登录」类,而不是「提交的信息有误」', () => {
    const out = apiFailureToText(
      { error: 'Invalid or expired token', status: 401 },
      LOGIN_FAILED_TEXT,
    )
    expect(out).toBe('登录已过期,请重新登录')
    expect(out).not.toBe('提交的信息有误,请检查后重试')
  })

  it('errorCode 比 status 更优先;两者皆无时保留该屏兜底文案(键分支不受影响)', () => {
    expect(
      apiFailureToText(
        { error: 'ignored', status: 401, errorCode: 'RATE_LIMITED' },
        LOGIN_FAILED_TEXT,
      ),
    ).toBe('操作过于频繁,请稍后再试')
    expect(apiFailureToText({ error: '' }, LOGIN_FAILED_TEXT)).toBe(LOGIN_FAILED_TEXT)
  })

  it('对照:同一 message 不带 status 只能落到参数类正则 —— 上一条判别的正是 status', () => {
    expect(apiFailureToText({ error: 'Invalid or expired token' }, LOGIN_FAILED_TEXT)).toBe(
      '提交的信息有误,请检查后重试',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
