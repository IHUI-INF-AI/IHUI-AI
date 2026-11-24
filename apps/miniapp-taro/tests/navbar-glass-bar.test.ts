// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 本测试钉住 2026-11-24 小程序顶栏悬浮条化:玻璃只铺导航行、左右留边取底栏同一枚档;
// 状态栏占位区不透明;default 容器纵向 flex。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { TAB_BAR_MARGIN_H } from '../src/constants/tab-bar-metrics'

/** 仓库根按本文件位置现推,不写盘符(AGENTS §0:盘符每次实测/推导)。 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const squash = (src: string): string => src.replace(/\s+/g, '')

/** 从 anchor 起取第一个配平块(与 navbar-wiring.test.ts 同一手法),剥注释后按空白归一。 */
function blockOf(src: string, anchor: string): string {
  const at = src.indexOf(anchor)
  if (at < 0) throw new Error(`读不到 ${anchor} ⇒ 悬浮条判据取材前提失效`)
  const open = src.indexOf('{', at)
  let depth = 0
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return squash(src.slice(at, i + 1))
    }
  }
  throw new Error(`${anchor} 的块没有闭合 ⇒ 悬浮条判据取材前提失效`)
}

const MINI_SRC = stripComments(
  readFileSync(join(ROOT, 'apps/miniapp-taro/src/components/NavBar.tsx'), 'utf8'),
)
const RN_CHROME = stripComments(
  readFileSync(join(ROOT, 'apps/mobile-rn/src/components/NavChrome.tsx'), 'utf8'),
)

describe('顶栏悬浮玻璃条(小程序 / RN 同一条垂直边线)', () => {
  it('左右留边档真取到值(转发 self-check;转发本体由 tab-bar-spec-shape 钉住)', () => {
    expect(Number.isFinite(TAB_BAR_MARGIN_H)).toBe(true)
    expect(TAB_BAR_MARGIN_H).toBeGreaterThan(0)
  })

  it('小程序:玻璃只铺导航行,左右留边取档;承载容器不透明、不铺玻璃', () => {
    const glassRow = blockOf(MINI_SRC, 'const glassRowStyle = {')
    expect(glassRow).toContain('marginLeft:px(TAB_BAR_MARGIN_H)')
    expect(glassRow).toContain('marginRight:px(TAB_BAR_MARGIN_H)')
    expect(glassRow).toContain('...barSurface')
    const chrome = blockOf(MINI_SRC, 'const chromeStyle = {')
    expect(chrome).toContain("backgroundColor:bgColor??'var(--color-background)'")
    expect(chrome).not.toContain('barSurface')
  })

  it('小程序:default 容器纵向 flex、行去掉 w-full(否则状态栏并排 + margin 溢出)', () => {
    const flat = squash(MINI_SRC)
    expect(flat).toContain('z-50flexflex-col')
    expect(flat).not.toContain('z-50flexitems-centerjustify-center')
    expect(flat).not.toContain('relativeflexw-fullitems-centerjustify-center')
  })

  it('RN:NavChrome 左右留边取同一枚 tab-bar-spec 档', () => {
    expect(squash(RN_CHROME)).toContain('marginHorizontal:TAB_BAR_MARGIN_H_PX')
  })

  it('反向:留边改裸数字 / 容器退回横排,判据必须红', () => {
    const dirtyMargin = MINI_SRC.replace('marginLeft: px(TAB_BAR_MARGIN_H),', 'marginLeft: px(24),')
    expect(dirtyMargin, '变异没落到 marginLeft ⇒ 反向自证是空转').not.toBe(MINI_SRC)
    expect(blockOf(dirtyMargin, 'const glassRowStyle = {')).not.toContain(
      'marginLeft:px(TAB_BAR_MARGIN_H)',
    )

    const dirtyFlex = MINI_SRC.replace(
      'fixed top-0 left-0 right-0 z-50 flex flex-col',
      'fixed top-0 left-0 right-0 z-50 flex items-center justify-center',
    )
    expect(dirtyFlex, '变异没落到容器类名 ⇒ 反向自证是空转').not.toBe(MINI_SRC)
    expect(squash(dirtyFlex)).toContain('z-50flexitems-centerjustify-center')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
