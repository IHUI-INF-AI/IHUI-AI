// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-phone-timer-guard.test.ts — 小程序「修改/绑定手机号」页写操作/定时器回归锁
 *
 * 缺陷(2026-11-07 深度审计,票 E):
 *  ① onSendOldCode / onSendCode 只做倒计时门,而倒计时在 sendSmsCode 返回后才置 >0
 *     ⇒ 同 tick/请求在飞期间连点会重复发短信。main 已把倒计时收进 useCountdown,
 *     本条钉 codeCountdown.count + sendingRef 双门。
 *  ② onSubmit 只用 submitting state 做门,同 tick 双调会重复 bindPhone。
 *  ③ 绑定成功后的 1s navigateBack 定时器未托管,卸载不取消 ⇒ 用户在 1s 内自行
 *     返回会多退一层页面;倒计时 interval 由 useCountdown 的 ticker 卸载自清。
 *  ④ main 的 useCountdown 已用截止戳派生取代手写 interval,故本锁改钉**反向契约**:
 *     本页不得再出现裸的 setInterval 自减倒计时。
 *
 * 本端无 DOM 测试环境(仓库未引入 jsdom),以源码形制锁固定上述契约。
 * 修前必须真红。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.resolve(dir, '../src/pkg-user/user/phone.tsx'), 'utf8')

function bodyOf(signature: string): string {
  const start = src.indexOf(signature)
  expect(start, `${signature} 应存在`).toBeGreaterThanOrEqual(0)
  const end = src.indexOf('\n  }', start + signature.length)
  expect(end, `${signature} 函数体边界应可定位`).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('小程序手机号页 · 写操作与定时器契约', () => {
  it('onSendOldCode 必须在 await 之前用 ref 早退,并在 finally 复位', () => {
    const body = bodyOf('const onSendOldCode = useCallback(async () => {')
    const guardAt = body.search(
      /if\s*\(oldCodeCountdown\.count\s*>\s*0\s*\|\|\s*oldSendingRef\.current\)\s*return/,
    )
    const awaitAt = body.indexOf('await sendSmsCode')
    expect(guardAt, 'onSendOldCode 缺少 oldSendingRef 同 tick 早退').toBeGreaterThanOrEqual(0)
    expect(guardAt, '早退必须在发码请求之前').toBeLessThan(awaitAt)
    expect(body, 'onSendOldCode 必须在 finally 复位 oldSendingRef').toMatch(
      /finally\s*\{\s*oldSendingRef\.current\s*=\s*false/,
    )
  })

  it('onSendCode 必须在 await 之前用 ref 早退,并在 finally 复位', () => {
    const body = bodyOf('const onSendCode = useCallback(async () => {')
    const guardAt = body.search(
      /if\s*\(newCodeCountdown\.count\s*>\s*0\s*\|\|\s*newSendingRef\.current\)\s*return/,
    )
    const awaitAt = body.indexOf('await pwdExist')
    expect(guardAt, 'onSendCode 缺少 newSendingRef 同 tick 早退').toBeGreaterThanOrEqual(0)
    expect(guardAt, '早退必须在查重/发码请求之前').toBeLessThan(awaitAt)
    expect(body, 'onSendCode 必须在 finally 复位 newSendingRef').toMatch(
      /finally\s*\{\s*newSendingRef\.current\s*=\s*false/,
    )
  })

  it('onSubmit 必须用 ref 早退,并托管延迟返回定时器', () => {
    const body = bodyOf('const onSubmit = useCallback(async () => {')
    expect(body, 'onSubmit 缺少 submittingRef 早退').toMatch(
      /if\s*\(submitting\s*\|\|\s*submittingRef\.current\)\s*return/,
    )
    expect(body, 'navigateBack 定时器必须存入 ref 以便卸载取消').toMatch(
      /navigateTimerRef\.current\s*=\s*setTimeout\(/,
    )
    expect(body, 'onSubmit 必须在 finally 复位 submittingRef').toMatch(
      /finally\s*\{\s*submittingRef\.current\s*=\s*false/,
    )
  })

  it('双倒计时必须走 useCountdown,页面不得再裸写 setInterval 自减', () => {
    expect(
      (src.match(/useCountdown\(/g) || []).length,
      '双冷却各自一个 useCountdown',
    ).toBeGreaterThanOrEqual(2)
    expect(src, '页面不得再出现裸的 setInterval 自减倒计时').not.toMatch(/setInterval\s*\(/)
  })

  it('页面卸载必须清理延迟返回定时器', () => {
    expect(src, '缺少卸载清理 effect').toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout\(navigateTimerRef\.current\)[\s\S]*?\}[\s\S]*?,\s*\[\],?\s*\)/,
    )
  })
})

/**
 * 同形态全量扫描(票 E「顺手全扫」):提交成功后延迟 navigateBack 的页面,
 * 定时器必须存入 navigateTimerRef 并在卸载时 clearTimeout,否则用户自行返回会多退一层。
 * 修前这些页面全部是裸 setTimeout。
 */
const DELAYED_BACK_PAGES = [
  '../src/pkg-shop/wallet/withdrawal/index.tsx',
  '../src/pages/circle/create.tsx',
  '../src/pages/study/publish/index.tsx',
  '../src/pages/ask/create.tsx',
  '../src/pkg-shop/order/refund.tsx',
  '../src/pkg-user/user/password.tsx',
  '../src/pkg-user/user/nickname.tsx',
  '../src/pkg-content/plaza/set-need/index.tsx',
  '../src/pkg-ai/aigc/publish.tsx',
]

describe('小程序「成功后延迟返回」全量扫描 · 定时器托管', () => {
  for (const rel of DELAYED_BACK_PAGES) {
    it(`${rel} 的延迟返回定时器已托管并在卸载时清理`, () => {
      const source = fs.readFileSync(path.resolve(dir, rel), 'utf8')
      const bare = (source.match(/setTimeout\(\(\)\s*=>\s*Taro\.navigateBack\(\)/g) || []).length
      const hosted = (
        source.match(
          /navigateTimerRef\.current\s*=\s*setTimeout\(\(\)\s*=>\s*Taro\.navigateBack\(\)/g,
        ) || []
      ).length
      expect(bare, '应存在延迟返回定时器').toBeGreaterThanOrEqual(1)
      expect(bare, '存在未托管的 navigateBack 定时器').toBe(hosted)
      expect(source, '缺少卸载时 clearTimeout(navigateTimerRef.current)').toMatch(
        /clearTimeout\(navigateTimerRef\.current\)/,
      )
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
