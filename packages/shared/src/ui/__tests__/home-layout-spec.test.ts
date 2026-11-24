// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARD_PADDING_PX } from '../card-spec'
import { HOME_CARD_PADDING_PX, HOME_PAGE_GUTTER_X_PX } from '../home-layout-spec'
import { TAB_BAR_MARGIN_H_PX } from '../tab-bar-spec'

/**
 * 首页横向边线锁定:
 * 页面留白必须与输入区/底部胶囊同一条垂直边线,卡片内边距必须与通用 Card 同档。
 * 任何一端再写 16 / 20rpx 这类第二份数,先让本用例红。
 */
describe('home-layout-spec', () => {
  it('页面左右留白与底部胶囊共用同一条边线', () => {
    expect(HOME_PAGE_GUTTER_X_PX).toBe(TAB_BAR_MARGIN_H_PX)
  })

  it('卡片内边距与通用 Card 同档', () => {
    expect(HOME_CARD_PADDING_PX).toBe(CARD_PADDING_PX)
  })

  it('共享首页的页面边线和卡片内边距只走 home-layout-spec', () => {
    const source = readSource('../../../../app/src/features/home/HomeScreen.tsx')
    const pageBlocks: Array<[string, string]> = [
      ['section', 'paddingHorizontal'],
      ['headerRow', 'paddingHorizontal'],
      ['errorWrap', 'marginHorizontal'],
    ]
    for (const [name, gutterProp] of pageBlocks) {
      const block = styleBlock(source, name)
      expect(block).toContain('HOME_PAGE_GUTTER_X_PX')
      expect(block).not.toMatch(new RegExp(`${gutterProp}:\\s*(?:\\d|rpx\\(|rnSpacing)`))
    }
    for (const name of ['discoverCard', 'card']) {
      const block = styleBlock(source, name)
      expect(block).toContain('HOME_CARD_PADDING_PX')
      expect(block).not.toMatch(
        /(?:paddingHorizontal|paddingLeft|paddingRight):\s*(?:\d|rpx\(|rnSpacing)/,
      )
    }
  })

  it('RN 壳和首页主卡片也接同一组 token', () => {
    const shell = readSource('../../../../../apps/mobile-rn/src/screens/HomeScreen.tsx')
    for (const name of ['aiModelWrap', 'sectionWrap']) {
      const block = styleBlock(shell, name)
      expect(block).toContain('HOME_PAGE_GUTTER_X_PX')
      expect(block).not.toMatch(/paddingHorizontal:\s*(?:\d|rpx\(|rnSpacing)/)
    }
    const aiCard = readSource('../../../../../apps/mobile-rn/src/components/AiModelCard.tsx')
    expect(styleBlock(aiCard, 'card')).toContain('HOME_CARD_PADDING_PX')
    const bottomFigure = readSource('../../../../../apps/mobile-rn/src/components/BottomFigure.tsx')
    expect(bottomFigure).toContain('const SIDE_INSET = HOME_PAGE_GUTTER_X_PX')
  })
})

function readSource(relativeToTest: string): string {
  return readFileSync(new URL(relativeToTest, import.meta.url), 'utf8')
}

function styleBlock(source: string, name: string): string {
  const match = source.match(new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`))
  const body = match?.[1]
  if (!body) throw new Error(`style block not found: ${name}`)
  return body
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
