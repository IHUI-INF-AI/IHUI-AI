// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Toolbar 6 工具格几何锁(L5171 宫格文字重叠票的常驻部分,2026-10-09)。
 *
 * 背景:2026-09-24 v0.0.5 真机截图报「宫格中间列两张卡文字重叠 + 机器人图标游离压卡」。
 * 机器人游离半已由枚 d12125f071 收(toolbar-banner-face.test.ts)。本锁钉的是静态推理
 * 结论:现几何下重叠**机制**不存在 —— ① 双列 48.5%(不存在"中间列");② 格子家族无
 * 负 margin / 无绝对定位 / 无固定 height(固定高裁字是重叠同型);③ minHeight 让两行
 * 描述按内容放开。真机像素复验(两帧复现截图不再重叠)仍待持机,台账行保持未勾。
 *
 * 判据样式与 toolbar-banner-face.test.ts 同款:源码解析,不 import 组件
 * (lucide-react-native 在测试环境不可渲染,源码判据足够钉住几何不变量)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src/components/Toolbar.tsx')

/** 取 StyleSheet 里某个键的对象体(括号配平,与 banner-face 锁同一出口) */
function styleBlockOf(source: string, key: string): string {
  const head = new RegExp(`^\\s*${key}:\\s*\\{`, 'm').exec(source)
  if (!head) throw new Error(`判据失明:Toolbar.tsx 里解析不到样式档 ${key}`)
  const from = head.index + head[0].length - 1
  let depth = 0
  for (let i = from; i < source.length; i++) {
    const c = source[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return source.slice(from + 1, i)
    }
  }
  throw new Error(`样式档 ${key} 的花括号配平不到,拒绝猜边界`)
}

const GRID_FAMILY = [
  'toolGrid',
  'toolCell',
  'rowFace',
  'toolIconWrap',
  'toolTextWrap',
  'toolTitle',
  'toolDesc',
] as const

describe('Toolbar 6 工具格几何锁(L5171)', () => {
  const src = readFileSync(SRC, 'utf8')

  it('双列布局在位:toolGrid 是 wrap 行 + 格宽 48.5% ⇒ 结构上不存在"中间列"', () => {
    const grid = styleBlockOf(src, 'toolGrid')
    expect(grid).toContain("flexWrap: 'wrap'")
    const cell = styleBlockOf(src, 'toolCell')
    expect(cell).toMatch(/width:\s*'48\.5%'/)
  })

  it('格子家族无绝对定位:重叠同型机制不得回流', () => {
    for (const key of GRID_FAMILY) {
      const block = styleBlockOf(src, key)
      expect(block, `${key} 出现 position: 'absolute'`).not.toContain("position: 'absolute'")
      expect(block, `${key} 出现 negative margin`).not.toMatch(/(margin\w*):\s*-(?!\()-/)
    }
  })

  it('文字承载面无固定 height:文字按内容放开,不裁字不叠压', () => {
    // toolIconWrap 是 38×38 图标方块,固定尺寸正当;文字承载面才禁固定高(固定高裁字=叠压同型)
    const textBearers = ['toolGrid', 'toolCell', 'rowFace', 'toolTextWrap', 'toolTitle', 'toolDesc']
    for (const key of textBearers) {
      const block = styleBlockOf(src, key)
      expect(block, `${key} 出现固定 height`).not.toMatch(/(?<!min)height:\s*\d/)
    }
    const iconWrap = styleBlockOf(src, 'toolIconWrap')
    expect(iconWrap).toMatch(/width:\s*38/)
    expect(iconWrap).toMatch(/height:\s*38/)
  })

  it('toolCell 用 minHeight 而非 height:两行描述按内容长高', () => {
    const cell = styleBlockOf(src, 'toolCell')
    expect(cell).toMatch(/minHeight:\s*\d/)
  })

  it('面层同形纪律:rowFace 与 toolCell 排布声明同向(row + center)', () => {
    const face = styleBlockOf(src, 'rowFace')
    expect(face).toContain("flexDirection: 'row'")
    expect(face).toContain("alignItems: 'center'")
  })

  it('6 格数据面:HOME_TOOLS 恰 6 项(双列 3 行,与真机 v0.0.5 后重构一致)', () => {
    const m = /const HOME_TOOLS[^=]*=\s*\[([\s\S]*?)\]/.exec(src)
    const body = m?.[1] ?? ''
    expect(body, '解析不到 HOME_TOOLS 定义(正则没匹配到或整段为空)').toBeTruthy()
    const keys = (body.match(/key:\s*'/g) ?? []).length
    expect(keys).toBe(6)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
