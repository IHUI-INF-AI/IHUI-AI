// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 两份实现的一致性锁(跨端收口的过渡措施,不是最终形态)。
 *
 * 现状:判据的**跨端唯一实现**在 `packages/shared/src/auth/auto-login-policy.ts`(2026-09-27 #29),
 * web 与小程序已接上它;RN 这一端仍留着一份端内实现 `src/lib/auto-login-policy.ts` ——
 * 把它改成 re-export 会让本端测试在收集期就炸,原因是
 * `apps/mobile-rn/vitest.config.ts` 里 `'@ihui/shared/auth'` 这条**父别名**按
 * `startsWith(pattern + '/')` 吞掉子路径(同文件多处注释明写"子路径别名必须排在父路径之前"),
 * 而新增那条子路径别名属本票文件清单之外。
 *
 * 所以这里放一把真判据:逐组合对比两份实现的结论 + 对比落盘 key 名。
 * 任一侧重改判据而不改另一侧 ⇒ 本文件红。RN 侧接上共享出口后,本文件与端内那份一起删除
 * (届时对比退化成"同一个函数和自己比",恒真式断言正是本仓反复登记的另一种失效型)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { shouldAttemptAutoLogin as rnImpl } from '../src/lib/auto-login-policy'
import {
  shouldAttemptAutoLogin as sharedImpl,
  SESSION_LOGGED_OUT_STORAGE_KEY,
} from '../../../packages/shared/src/auth/auto-login-policy'

const combos: Array<[boolean, boolean, boolean]> = [
  [true, true, true],
  [true, true, false],
  [true, false, true],
  [true, false, false],
  [false, true, true],
  [false, true, false],
  [false, false, true],
  [false, false, false],
]

describe('RN 端内实现必须与跨端共享实现同结论(漂移即红)', () => {
  it.each(combos)(
    'sessionLoggedOut=%s hasAutoLoginFlag=%s hasRememberedCredentials=%s',
    (loggedOut, flag, remembered) => {
      const deps = () => ({
        sessionLoggedOut: () => loggedOut,
        hasAutoLoginFlag: () => flag,
        hasRememberedCredentials: () => remembered,
      })
      expect(rnImpl(deps())).toBe(sharedImpl(deps()))
    },
  )

  it('落盘 key 名三端同值(RN 那份写在 lib/token.ts,漂移=各端各有各的标记)', () => {
    const tokenSrc = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'token.ts'),
      'utf-8',
    )
    const found = tokenSrc.match(/SESSION_LOGGED_OUT_KEY\s*=\s*'([^']+)'/)
    expect(found, 'lib/token.ts 里的登出标记 key 常量不得改名或删除').toBeTruthy()
    expect(found?.[1]).toBe(SESSION_LOGGED_OUT_STORAGE_KEY)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
