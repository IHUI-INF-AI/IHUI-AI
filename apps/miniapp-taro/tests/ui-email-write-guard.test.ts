// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-email-write-guard.test.ts — 小程序「绑定邮箱」页写操作/定时器回归锁
 *
 * 缺陷(2026-11-07 深度审计):
 *  ① sendCode 只用倒计时态做门,而该态在 POST 返回后才置位 ⇒ 同 tick/请求在飞期间连点
 *    会重复 POST /auth/email/code,用户收到多封验证码邮件。
 *  ② startCountdown 不复用前不清理旧 interval,叠加时秒数双跳。main 已把整段倒计时收进
 *    useCountdown(截止戳派生 + ticker 卸载自清),故本条改钉**反向契约**:本页不得再出现
 *    裸的 setInterval 自减倒计时。
 *  ③ 绑定成功后的 1s navigateBack 定时器未托管,用户在 1s 内自行返回会多退一层页面。
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
    const guardAt = body.search(
      /if\s*\(codeCountdown\.count\s*>\s*0\s*\|\|\s*sendingRef\.current\)\s*return/,
    )
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

  it('倒计时必须走 useCountdown,页面不得再裸写 setInterval 自减', () => {
    expect(src, '倒计时必须使用 useCountdown(截止戳派生)').toMatch(/useCountdown\(/)
    expect(src, '页面不得再出现裸的 setInterval 自减倒计时').not.toMatch(/setInterval\s*\(/)
  })

  it('页面卸载必须清理延迟返回定时器', () => {
    expect(src, '缺少卸载清理 effect').toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout\(navigateTimerRef\.current\)[\s\S]*?\}[\s\S]*?,\s*\[\],?\s*\)/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
