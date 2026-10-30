// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 底部弹层的两格行为锁(2026-10-31 立,提现 2FA 面板实测形态为其成因):
 * ① 键盘避让必须住在 Modal **内部**并包住内容 —— RN 的 Modal 是独立原生窗,
 *    挂在它外面的避让层对弹层里的输入框不生效;
 * ② 弹层按钮的底色与前景必须成对取自 CTA 档 —— 深色下 brand.cta 翻成纯白,
 *    任何写死的前景都会与它同值(字隐形)。
 *
 * 每条锁都带「缺陷形态复跑」:同一把尺必须先能量到坏形状,否则"零命中"是坏尺而不是结论。
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { BottomPops } from '../src/components/BottomPops'

vi.mock('../src/theme/active-tokens', async () => {
  const { rnDarkTokens } = await import('@ihui/design-tokens')
  return { tokens: rnDarkTokens }
})
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const SHEET_SRC = readFileSync(resolve(__dirname, '../src/components/BottomPops.tsx'), 'utf8')
const WITHDRAW_SRC = readFileSync(resolve(__dirname, '../src/screens/WithdrawScreen.tsx'), 'utf8')

/** 形状尺:避让层开标签是否落在 <Modal … </Modal> 之间 */
function keyboardAvoidInsideModal(src: string): boolean {
  const open = src.indexOf('<Modal')
  const close = src.indexOf('</Modal>')
  const avoid = src.indexOf('<KeyboardAvoidingView')
  if (open < 0 || close < 0 || avoid < 0) return false
  return avoid > open && avoid < close
}

describe('BottomPops 键盘避让层', () => {
  it('避让层住在 <Modal> 内部(外层避让对独立原生窗无效)', () => {
    expect(keyboardAvoidInsideModal(SHEET_SRC)).toBe(true)
  })

  it('反向对照:同一把尺喂「避让放 Modal 外」的形态必须判不过', () => {
    const broken = '<Modal><View/></Modal><KeyboardAvoidingView><View/></KeyboardAvoidingView>'
    expect(keyboardAvoidInsideModal(broken)).toBe(false)
    // 缺避让层这一维也不能被读成通过
    expect(keyboardAvoidInsideModal('<Modal><View/></Modal>')).toBe(false)
  })

  it('弹层内容真的渲染在避让层之内', () => {
    const { container } = render(
      createElement(BottomPops, {
        visible: true,
        onClose: () => {},
        title: 'sheet',
        children: createElement('span', null, 'TOTP-CELL-MARKER'),
      }),
    )
    const avoid = container.querySelector('[data-role="keyboard-avoiding"]')
    expect(avoid).not.toBeNull()
    expect(avoid?.textContent).toContain('TOTP-CELL-MARKER')
  })

  it('阳性对照:visible=false 时整层不渲(证明上一条断言不是恒真)', () => {
    const { container } = render(
      createElement(BottomPops, {
        visible: false,
        onClose: () => {},
        title: 'sheet',
        children: createElement('span', null, 'SHOULD-NOT-APPEAR'),
      }),
    )
    expect(container.querySelector('[data-role="keyboard-avoiding"]')).toBeNull()
  })
})

describe('提现 2FA 弹层的色值与档位同源', () => {
  it('CTA 底与前景在两态都不同值(同值即文字隐形)', async () => {
    const { rnDarkTokens, rnLightTokens } = await import('@ihui/design-tokens')
    expect(rnDarkTokens.brand.cta).not.toBe(rnDarkTokens.brand.ctaForeground)
    expect(rnLightTokens.brand.cta).not.toBe(rnLightTokens.brand.ctaForeground)
  })

  it('按钮复用弹层唯一档,屏内不再自定高度与圆角', () => {
    expect(WITHDRAW_SRC).toContain('sheetButton.primary')
    expect(WITHDRAW_SRC).toContain('sheetButton.primaryText')
    expect(WITHDRAW_SRC).not.toMatch(/height:\s*46/)
    expect(WITHDRAW_SRC).not.toMatch(/borderRadius:\s*10\b/)
  })

  it('输入框走共享 TextField(聚焦描边与全端同一出处)', () => {
    expect(WITHDRAW_SRC).toContain('<TextField')
    expect(WITHDRAW_SRC).toMatch(/colorScheme=\{resolvedTheme\}/)
    expect(WITHDRAW_SRC).not.toMatch(/<TextInput\b/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
