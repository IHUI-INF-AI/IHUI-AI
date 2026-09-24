// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * App 主题 → NativeWind colorScheme 同步的回归。
 *
 * 为什么要钉这条:共享 preset 是 `darkMode: 'class'`(packages/design-tokens/src/tailwind-preset.js:24),
 * NativeWind 的 `dark:*` 变体读它自己的 store,没人 set 就恒跟系统外观;而本 App 的主题走
 * 「模块级 token 单例 + 重载 JS」。两条通道各走各的 ⇒ 用户在设置里选深色、系统却是浅色时,
 * `tokens.*` 侧全翻暗、`dark:bg-*` 侧一条都不生效。守门 83 的 R2 又把"同行有 dark: 变体"记为已配对,
 * 所以缺这条同步时,那些配对只是纸面正确。
 *
 * 钉三层:① 同步函数真把解析结果落进 store;② ThemeProvider 确实调用它(源码级装车证明);
 * ③ App.tsx 必须把界面包在 ThemeProvider 内 —— 缺 ③ 时 ② 是死代码。
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { syncNativeWindColorScheme } from '../src/theme/color-scheme-sync'
import { colorSchemeCalls, __resetColorSchemeCalls } from './__mocks__/nativewind'

describe('App 主题 → NativeWind colorScheme 同步', () => {
  beforeEach(() => {
    __resetColorSchemeCalls()
  })

  it('深色解析结果落到 store', () => {
    expect(syncNativeWindColorScheme('dark')).toBe('dark')
    expect(colorSchemeCalls).toEqual(['dark'])
  })

  it('浅色同样落 store(不能只在深色时设)', () => {
    syncNativeWindColorScheme('light')
    expect(colorSchemeCalls).toEqual(['light'])
  })

  it('来回切换按调用顺序逐次落值(store 是幂等覆盖,不是累加)', () => {
    syncNativeWindColorScheme('dark')
    syncNativeWindColorScheme('light')
    syncNativeWindColorScheme('dark')
    expect(colorSchemeCalls).toEqual(['dark', 'light', 'dark'])
  })
})

describe('装车证明:同步确实接在主题入口链上', () => {
  const ctx = readFileSync(resolve(__dirname, '../src/context/ThemeContext.tsx'), 'utf8')
  const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')

  it('ThemeProvider 里调用了同步(且以解析后的主题为依赖)', () => {
    expect(ctx).toMatch(/import \{ syncNativeWindColorScheme \} from '\.\.\/theme\/color-scheme-sync'/)
    const provider = ctx.slice(ctx.indexOf('export function ThemeProvider'))
    expect(provider).toMatch(/syncNativeWindColorScheme\(resolved\)/)
    expect(provider).toMatch(/\}, \[resolved\]\)/)
  })

  it('解析值覆盖三档偏好:system 取系统,light/dark 直取', () => {
    expect(ctx).toMatch(/themeMode === 'system' \? \(systemScheme === 'dark' \? 'dark' : 'light'\) : themeMode/)
  })

  it('App.tsx 必须真的用 ThemeProvider 包住界面 —— 否则上面两条是死代码', () => {
    expect(app).toMatch(/<ThemeProvider>/)
    expect(app).toMatch(/from '\.\/src\/context\/ThemeContext'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
