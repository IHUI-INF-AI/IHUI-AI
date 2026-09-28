// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内那份实现已经没了 —— 这把锁判的是"**它不能长回来**"。
 *
 * 前身是两份实现的逐组合对比(2026-09-29 收口 G-365 另一半时,RN 侧降级成 re-export)。
 * 收口之后如果继续对比结论,就是"同一个函数和自己比"的恒真式断言 —— 本仓反复登记的
 * 另一种失效型,所以这里换成三条真有牙的判据:
 *   ① 引用同值:端内出口与共享层出口必须是**同一个函数对象**(不是两个碰巧同形的实现);
 *   ② 源码形态:端内文件除转发与注释外不得出现任何判定语句(长回一份实现即红);
 *   ③ 落盘 key 名三端同值(这条与实现是否同源无关,RN 的 key 住在 lib/token.ts,仍会漂)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as rnFace from '../src/lib/auto-login-policy'
import * as sharedFace from '../../../packages/shared/src/auth/auto-login-policy'

const here = path.dirname(fileURLToPath(import.meta.url))
const rnSource = readFileSync(path.resolve(here, '..', 'src', 'lib', 'auto-login-policy.ts'), 'utf-8')

describe('RN 侧只能是转发,不得再存在第二份实现', () => {
  it('① 端内出口与共享层出口是同一个函数对象(引用同值,不是同形)', () => {
    expect(rnFace.shouldAttemptAutoLogin).toBe(sharedFace.shouldAttemptAutoLogin)
    expect(rnFace.canSilentlyReLogin).toBe(sharedFace.canSilentlyReLogin)
    // 反向对照:引用同值不等于"两个都 undefined"
    expect(typeof rnFace.shouldAttemptAutoLogin).toBe('function')
    expect(typeof sharedFace.shouldAttemptAutoLogin).toBe('function')
  })

  it('② 端内文件里没有判定逻辑(把实现写回来即红)', () => {
    const codeOnly = rnSource
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\/\*|\*|$\s*$)/.test(l))
      .join('\n')
    expect(codeOnly).not.toMatch(/\bif\s*\(/)
    expect(codeOnly).not.toMatch(/\breturn\b/)
    expect(codeOnly).not.toMatch(/\bfunction\b|=>/)
    // 只允许 export ... from '...' 这一种形态
    const statements = codeOnly
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    for (const s of statements) {
      expect(s, `端内转发文件里出现了非转发语句:${s}`).toMatch(
        /^export\s+(type\s+)?(\{[^}]*\}|\*)\s+from\s+['"]@ihui\/shared\/auth\/auto-login-policy['"];?$/,
      )
    }
    expect(statements.length).toBeGreaterThan(0)
  })

  it('③ 落盘 key 名三端同值(RN 那份写在 lib/token.ts,漂移=各端各有各的标记)', () => {
    const tokenSrc = readFileSync(path.resolve(here, '..', 'src', 'lib', 'token.ts'), 'utf-8')
    const found = tokenSrc.match(/SESSION_LOGGED_OUT_KEY\s*=\s*'([^']+)'/)
    expect(found, 'lib/token.ts 里的登出标记 key 常量不得改名或删除').toBeTruthy()
    expect(found?.[1]).toBe(sharedFace.SESSION_LOGGED_OUT_STORAGE_KEY)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
