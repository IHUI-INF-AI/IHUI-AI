// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主题 token 单例(src/theme/active-tokens.ts)的取色契约回归。
 *
 * 钉两件事:
 *  1. **来回切换必须回得来**。旧实现 `const mutableTokens = {...rnLightTokens}` 只拷顶层,
 *     mutableTokens.brand 与 rnLightTokens.brand 同一对象 ⇒ apply('dark') 把 PALETTES.light
 *     本身涂成深色,apply('light') 退化成自我赋值,浅色永远回不来。
 *     而"切主题即重载 JS 所以无所谓"这句注释在 **release 下不成立**:
 *     DevSettings.reload() 在非 __DEV__ 是空实现,同一 JS 生命周期内确实会跑第二次 apply()。
 *  2. **源色板不得被就地改写**。rnLightTokens / rnDarkTokens 是被别处直接 import 的常量,
 *     就地覆写会让"未走单例"的读取方看到错色。
 */
import { describe, expect, it } from 'vitest'
import { rnLightTokens, rnDarkTokens } from '@ihui/design-tokens'
import { commitRnTheme, currentRnTheme, tokens } from '../src/theme/active-tokens'

describe('主题 token 单例:切换必须可逆', () => {
  it('dark → light 后来回切换,取色回到浅色原值', () => {
    const lightCta = tokens.brand.DEFAULT
    const lightCard = tokens.surface.card

    expect(commitRnTheme('dark')).toBe(true)
    expect(tokens.brand.DEFAULT).toBe(rnDarkTokens.brand.DEFAULT)
    expect(tokens.surface.card).toBe(rnDarkTokens.surface.card)

    expect(commitRnTheme('light')).toBe(true)
    // 旧实现在这两行必红:PALETTES.light 已被 apply('dark') 就地污染
    expect(tokens.brand.DEFAULT).toBe(lightCta)
    expect(tokens.surface.card).toBe(lightCard)
  })

  it('切到深色后,源色板 rnLightTokens 仍是浅色(未被就地覆写)', () => {
    commitRnTheme('dark')
    expect(rnLightTokens.surface.card).toBe('#FFFFFF')
    expect(rnLightTokens.brand.DEFAULT).toBe('#000000')
    commitRnTheme('light')
  })

  it('重复设同一偏好返回 false(调用方据此跳过重载)', () => {
    commitRnTheme('dark')
    expect(commitRnTheme('dark')).toBe(false)
    expect(currentRnTheme()).toBe('dark')
    commitRnTheme('light')
    expect(commitRnTheme('light')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
