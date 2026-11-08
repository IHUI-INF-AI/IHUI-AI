// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 倒计时收敛夹具:miniapp 侧自减 state + setInterval ⇒ @ihui/shared useCountdown(截止戳派生)。
 * 旧码在「后台跨过截止再回来」时读数停在自减后的残值;新码在 useDidShow 里 sync 立即归零。
 * pay/index.tsx 是轮询计时(deadlineRef + Date.now),按判定保持不动,此处仅加守卫防误改。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

describe('XUI-countdown:miniapp 倒计时截止戳收敛', () => {
  it('forgot-password:useCountdown + 回前台 sync,且无自减 interval', () => {
    const src = read('pages/forgot-password/index.tsx')
    expect(src).toContain("import { useCountdown } from '@ihui/shared'")
    expect(src).toContain('useCountdown(60)')
    expect(src).toContain('codeCountdown.sync()')
    expect(src).toContain('useDidShow')
    expect(src).not.toMatch(/setInterval/)
    expect(src).not.toMatch(/prev\s*-\s*1/)
  })

  it('phone:双冷却各一个 useCountdown,回前台双 sync', () => {
    const src = read('pkg-user/user/phone.tsx')
    expect(src).toContain("import { useCountdown } from '@ihui/shared'")
    expect(src.match(/useCountdown\(60\)/g)?.length).toBe(2)
    expect(src).toContain('oldCodeCountdown.sync()')
    expect(src).toContain('newCodeCountdown.sync()')
    expect(src).not.toMatch(/setInterval/)
    expect(src).not.toMatch(/prev\s*-\s*1/)
  })

  it('email:useCountdown + 回前台 sync,按钮态走 isRunning', () => {
    const src = read('pkg-user/user/email.tsx')
    expect(src).toContain("import { useCountdown } from '@ihui/shared'")
    expect(src).toContain('useCountdown(60)')
    expect(src).toContain('codeCountdown.sync()')
    expect(src).toContain('codeCountdown.isRunning')
    expect(src).not.toMatch(/setInterval/)
    expect(src).not.toMatch(/prev\s*-\s*1/)
  })

  it('account-cancel:5s 闸门 + 发码冷却均截止戳派生,回前台双 sync', () => {
    const src = read('pkg-user/account-cancel/index.tsx')
    expect(src).toContain("import { useCountdown } from '@ihui/shared'")
    expect(src).toContain('useCountdown(60)')
    expect(src).toContain('useCountdown(5)')
    expect(src).toContain('codeCountdown.sync()')
    expect(src).toContain('confirmCountdown.sync()')
    expect(src).toContain('confirmCountdown.start()')
    expect(src).not.toMatch(/setInterval/)
    expect(src).not.toMatch(/prev\s*-\s*1/)
  })

  it('pay:轮询计时保持 deadlineRef + Date.now,不得改成倒计时 hook', () => {
    const src = read('pkg-shop/pay/index.tsx')
    expect(src).toContain('deadlineRef')
    expect(src).toContain('Date.now()')
    expect(src).not.toContain('useCountdown')
  })
})
