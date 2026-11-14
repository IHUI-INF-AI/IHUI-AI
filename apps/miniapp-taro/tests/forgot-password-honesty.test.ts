// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 找回密码 · 重置结果诚实性接线锁(2026-11-13 立)。
 *
 * 立此锁的因由:旧实现在 `submitReset()` 里把 `/auth/reset-password` 包了一层 try/catch,
 * catch 里只 `console.warn(...'mock success')`,**随后无条件**提示「重置成功」并 800ms 后跳回
 * 登录页。后端那条端点是真的、也是有失败路径的(apps/api/src/routes/auth.ts `/reset-password`):
 *   400 验证码错误或已过期 / 403 系统内置管理员密码不可重置 / 429 限流(3 次/分钟) / 400 参数不合规。
 * 于是用户会看到两条矛盾的提示(api-bridge 已 toast 真实原因,页面又 toast 成功),被送回登录页
 * 却拿旧密码仍能登录 —— 这是一条**对用户说谎**的静默失效,不是样式问题。
 *
 * 本锁钉两件事:① 成功提示必须只在请求真的成功之后;② catch 分支不得再出现任何成功/跳转。
 * 反向对照:用旧实现形状喂同一条判据必须判 false —— 判据不是恒绿。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  join(__dirname, '..', 'src', 'pages', 'forgot-password', 'index.tsx'),
  'utf8',
)

/** 取 `submitReset` 函数体(到下一个顶层 `function`/`const ... useCallback` 之前)。 */
function submitResetBody(src: string): string {
  const at = src.indexOf('async function submitReset')
  expect(at, '找不到 submitReset() —— 锚点漂了先怀疑尺子,不是判据通过').toBeGreaterThanOrEqual(0)
  const rest = src.slice(at)
  const end = rest.search(/\n {2}(?:function|const)\s/)
  const body = end > 0 ? rest.slice(0, end) : rest
  // 判据只看代码:注释里为说明旧缺陷会逐字提到「重置成功」「goToLogin」,
  // 拿注释当证据会把"已修好"读成"仍谎报"(实测踩过)。先剥注释再判。
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** 判据:成功提示必须排在 await post(...) 之后,且 catch 分支内不得出现成功/跳转。 */
function resetIsHonest(src: string): boolean {
  const body = submitResetBody(src)
  const postAt = body.indexOf("await post('/auth/reset-password'")
  const successAt = body.indexOf('forgot.resetSuccess')
  if (postAt < 0 || successAt < 0) return false
  // ① 成功提示在请求之后(不是无条件先报后请求)
  if (successAt < postAt) return false
  // ② 成功提示不得落在任何 catch 块内
  const catchIdx = body.indexOf('catch')
  if (catchIdx >= 0 && catchIdx < successAt) {
    // 粗判 catch 块范围:从 catch 到同级 } finally / } 结束
    const catchBlockEnd = body.indexOf('finally', catchIdx)
    const endAt = catchBlockEnd > 0 ? catchBlockEnd : body.length
    if (successAt < endAt) return false
  }
  return true
}

describe('找回密码 · 重置失败不得谎报成功', () => {
  it('当前实现:成功提示只在 await post 成功之后,catch 内无成功/跳转', () => {
    expect(resetIsHonest(SRC), 'submitReset 又回到「失败也报成功」的形态').toBe(true)
  })

  it('实现里不再有「mock success」式降级注释(那正是谎报的来源)', () => {
    expect(SRC).not.toMatch(/mock success/i)
    expect(SRC).not.toMatch(/降级为\s*mock/i)
  })

  it('catch 分支必须停下来(不得 fallthrough 到成功提示)', () => {
    const body = submitResetBody(SRC)
    // 失败后既不提示成功、也不跳登录页
    const catchAt = body.indexOf('catch')
    expect(catchAt).toBeGreaterThanOrEqual(0)
    const tail = body.slice(catchAt)
    expect(tail).not.toContain('forgot.resetSuccess')
    expect(tail).not.toContain('goToLogin')
  })

  it('反向对照:旧实现形状喂同一判据必须判 false(尺子有牙)', () => {
    const legacy = `
  async function submitReset() {
    setSubmitting(true)
    try {
      try {
        await post('/auth/reset-password', { phone, code, newPassword })
      } catch (e) {
        console.warn('reset-password endpoint failed, mock success', e)
      }
      onToast(t('forgot.resetSuccess'), { kind: 'success' })
      setTimeout(goToLogin, 800)
    } catch {
    } finally {
      setSubmitting(false)
    }
  }
`
    expect(resetIsHonest(legacy), '旧形状被本判据放过 = 锁是走过场').toBe(false)
  })
})
