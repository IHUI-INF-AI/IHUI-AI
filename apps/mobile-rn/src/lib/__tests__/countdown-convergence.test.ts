// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 倒计时收敛夹具:RN 侧 setTimeout 自减 ⇒ @ihui/shared useCountdown(截止戳派生),
 * AppState 回 active 时显式 sync,后台跨过截止后归零/立即可用。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

describe('XUI-countdown:RN AccountCancel 截止戳收敛', () => {
  it('使用 shared useCountdown 且回前台 AppState sync,无 setTimeout 自减', () => {
    const src = read('src/screens/AccountCancelScreen.tsx')
    expect(src).toContain("import { useCountdown } from '@ihui/shared'")
    expect(src).toContain('useCountdown(60)')
    expect(src).toContain('useCountdown(5)')
    expect(src).toContain('AppState.addEventListener')
    expect(src).toContain("state === 'active'")
    expect(src).toContain('smsCountdown.sync()')
    expect(src).toContain('confirmCountdown.sync()')
    expect(src).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*setCountdown/)
    expect(src).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*setConfirmCountdown/)
    expect(src).not.toMatch(/countdown\s*-\s*1/)
  })
})
