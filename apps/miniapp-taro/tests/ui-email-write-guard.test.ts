// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-email-write-guard.test.ts — 小程序「绑定邮箱」页写操作/定时器回归锁
 *
 * 缺陷(2026-11-07 深度审计):
 *  ① sendCode 只用 counting 做门,而 counting 在 POST 返回后才置 true ⇒ 同 tick/请求在飞
 *    期间连点会重复 POST /auth/email/code,用户收到多封验证码邮件。
 *  ② startCountdown 不复用前不清理旧 interval,叠加时秒数双跳。
 *  ③ 页面卸载不清理倒计时,后台继续 setState;绑定成功后的 1s navigateBack 定时器未托管,
 *    用户在 1s 内自行返回会多退一层页面。
 *
 * 本端无 DOM 测试环境(仓库未引入 jsdom),以源码形制锁固定上述契约。
 * 修前必须真红。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.resolve(dir, '../src/pkg-user/user/email.tsx'), 'utf8')

function bodyOf(signature: string): string {
  const start = src.indexOf(signature)
  expect(start, `${signature} 应存在`).toBeGreaterThanOrEqual(0)
  const end = src.indexOf('\n  }', start + signature.length)
  expect(end, `${signature} 函数体边界应可定位`).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('小程序绑定邮箱页 · 写操作与定时器契约', () => {
  it('sendCode 必须在 await 之前用 ref 早退,并在 finally 复位', () => {
    const body = bodyOf('async function sendCode()')
    const guardAt = body.search(/if\s*\(counting\s*\|\|\s*sendingRef\.current\)\s*return/)
    const awaitAt = body.indexOf('await post')
    expect(guardAt, 'sendCode 缺少 sendingRef 同 tick 早退').toBeGreaterThanOrEqual(0)
    expect(guardAt, '早退必须在发码请求之前').toBeLessThan(awaitAt)
    expect(body, 'sendCode 必须在 finally 复位 sendingRef').toMatch(
      /finally\s*\{\s*sendingRef\.current\s*=\s*false/,
    )
  })

  it('onSubmit 必须用 ref 早退,并托管延迟返回定时器', () => {
    const body = bodyOf('async function onSubmit()')
    expect(body, 'onSubmit 缺少 submittingRef 早退').toMatch(
      /if\s*\(submitting\s*\|\|\s*submittingRef\.current\)\s*return/,
    )
    expect(body, 'navigateBack 定时器必须存入 ref 以便卸载取消').toMatch(
      /navigateTimerRef\.current\s*=\s*setTimeout\(/,
    )
  })

  it('startCountdown 复用前必须清旧 interval', () => {
    const body = bodyOf('function startCountdown()')
    const clearAt = body.indexOf('clearInterval(timerRef.current)')
    const setAt = body.indexOf('setInterval(')
    expect(clearAt, 'startCountdown 缺少清旧 interval').toBeGreaterThanOrEqual(0)
    expect(clearAt, '清旧 interval 必须在 setInterval 之前').toBeLessThan(setAt)
  })

  it('页面卸载必须清理倒计时与延迟返回定时器', () => {
    expect(src, '缺少卸载清理 effect').toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>\s*\{[\s\S]*?clearInterval\(timerRef\.current\)[\s\S]*?clearTimeout\(navigateTimerRef\.current\)[\s\S]*?\}[\s\S]*?,\s*\[\],?\s*\)/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
