// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 用户实拍:首页营销 banner「中间列两张卡文字重叠,另有一个机器人图标游离压在卡上」。
// 根因不是样式值写错,而是一次 union 归并把 `bannerFace` 的 `flexDirection` 整条弄丢 ——
// `View` 默认 `column`,面层不显式声明 `row` 时机器人与卡片由并排变竖排,卡片被压到下方宫格上。
// 守门 131 只拦「函数形态 style 被 cssInterop 吃掉」,不拦「档位属性在合并里丢失」,
// 而 `git grep -i bannerFace` 在测试面零命中 ⇒ 这处修复至今没有任何常驻尺子。本文件补这一格。
//
// 三条判据各挡一种失效,缺一都会让这把锁形同虚设:
//  ① 绝对判据:bannerFace 必须自己声明 flexDirection:'row' —— 只判「与 bannerWrap 同形」的话,
//     两者被一起改成 column 时同形依然成立,锁就白了(判据不能只比自己造出来的参照)。
//  ② 同形判据:bannerFace 的排布两键必须逐字等于 bannerWrap(源码注释自述的设计约束)。
//  ③ 浮动余量:translateY 的上浮幅度不得超过 bannerWrap.paddingTop,否则机器人飘出容器。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src/components/Toolbar.tsx')

/** 取 StyleSheet 里某个键的对象体(括号配平,不靠缩进与 `as X` 后缀猜边界) */
function styleBlockOf(source: string, key: string): string {
  const head = new RegExp(`^\\s*${key}:\\s*\\{`, 'm').exec(source)
  // 找不到判据输入面 ⇒ 直接红:本锁拒绝把"没看见"读成"没有违规"
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

/** 取 `styles.<key>` 所在 JSX 开标签的文本(到它自己的 `>` 为止,不含子节点) */
function jsxTagHolding(source: string, key: string): string {
  const at = source.indexOf(`styles.${key}`)
  if (at < 0) throw new Error(`判据失明:JSX 里找不到 styles.${key}`)
  const open = source.lastIndexOf('<', at)
  const close = source.indexOf('>', at)
  return source.slice(open, close + 1)
}

/** 某样式档在指定锚点子树里的兄弟深度:同一深度 = 并排的兄弟节点,解析不到即抛 */
function depthUnder(source: string, anchorKey: string, key: string): number {
  const faceAt = source.indexOf(`styles.${anchorKey}`)
  if (faceAt < 0) throw new Error(`判据失明:JSX 里找不到锚点 styles.${anchorKey},不判为通过`)
  const faceTagEnd = source.indexOf('>', faceAt)
  const body = source.slice(faceTagEnd + 1)
  let depth = 0
  // 逐个标签走:开标签若非自闭则进一层,闭合则退一层;遇到目标键记下当时深度
  const tag = /<(\/?)([A-Za-z][\w.]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tag.exec(body))) {
    const [, closing, , attrs, selfClosed] = m
    // 空串是合法形态(`</View>`、`<View>` 的属性区就是空),只有解析不到捕获组才是判据失明。
    if (attrs === undefined) throw new Error('判据失明:标签解析不出属性区,不判为通过')
    if (closing) depth--
    if (attrs.includes(`styles.${key}`)) return depth
    if (!closing && !selfClosed) depth++
  }
  throw new Error(`判据失明:bannerFace 子树里找不到 styles.${key}(整体解析失败,不判为通过)`)
}

describe('营销 banner 面层几何回归锁(归并丢 flexDirection 的常驻尺子)', () => {
  const src = readFileSync(SRC, 'utf8')
  const face = styleBlockOf(src, 'bannerFace')
  const wrap = styleBlockOf(src, 'bannerWrap')
  const layout = (block: string) => ({
    row: /flexDirection:\s*'row'/.test(block),
    end: /alignItems:\s*'flex-end'/.test(block),
  })

  it('① 绝对判据:bannerFace 自己必须声明横排 + 底对齐', () => {
    const l = layout(face)
    expect(l.row).toBe(true)
    expect(l.end).toBe(true)
  })

  it('② 同形判据:面层排布两键逐字等于外框(源码注释自述的设计约束)', () => {
    expect(layout(face)).toEqual(layout(wrap))
  })

  it('③ 浮动余量:上浮幅度不得超过外框 paddingTop', () => {
    const pad = Number(/paddingTop:\s*(\d+(?:\.\d+)?)/.exec(wrap)?.[1])
    expect(Number.isFinite(pad)).toBe(true)
    const range = /outputRange:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/.exec(src)
    expect(range, '判据失明:找不到浮动动画的 outputRange').not.toBeNull()
    const extremes = [Number(range![1]), Number(range![2])]
    const upShift = Math.max(...extremes.map((v) => Math.abs(v)))
    expect(upShift, '向上浮动超出容器预留的 paddingTop 会飘出边界').toBeLessThanOrEqual(pad)
    expect(Math.min(...extremes), '正值=向下压,会把机器人压在下方卡片上').toBeLessThanOrEqual(0)
  })

  it('机器人与卡片必须是同一层的兄弟节点(嵌套会退化成竖排)', () => {
    expect(depthUnder(src, 'bannerFace', 'bannerFloat')).toBe(
      depthUnder(src, 'bannerFace', 'bannerCard'),
    )
  })

  it('bannerCard 自己不得是横排(它内部是标题+副标题的两行)', () => {
    expect(/flexDirection:\s*'column'/.test(styleBlockOf(src, 'bannerCard'))).toBe(true)
  })

  it('本锁有牙:把根因形态(归并弄丢 flexDirection)喂回判据,必须红', () => {
    // 只在 bannerFace 块内删:文件里 bannerWrap 也有同一条声明,按第一个匹配删会删错对象,
    // 于是 face 侧判据照绿 —— 那正是"变异自证自己先失效"的形态。
    const regressed = src.replace(/(bannerFace:\s*\{[\s\S]*?)flexDirection:\s*'row',/, '$1')
    expect(regressed, '变异没命中原文,这条自证等于没跑').not.toBe(src)
    const f = layout(styleBlockOf(regressed, 'bannerFace'))
    // ① 绝对判据翻红
    expect(f.row).toBe(false)
    // ② 同形判据也翻红 —— 两条独立判据都要能拦住同一件事
    expect(f).not.toEqual(layout(wrap))
    // 反向对照:还原原文必须立刻复绿(证明红的确实是这一条,不是夹具坏了)
    expect(layout(face).row).toBe(true)
  })

  it('前提复核:面层仍由外框撑满,JSX 结构没被换成第二份实现', () => {
    const tag = jsxTagHolding(src, 'bannerFace')
    expect(tag).toMatch(/<View/)
    expect(/width:\s*'100%'/.test(face)).toBe(true)
    expect(/height:\s*'100%'/.test(face)).toBe(true)
    // 函数形态 style 会被 NativeWind cssInterop 整份丢掉(守门 131 立项那一型)
    expect(tag).not.toMatch(/style=\{\s*\(/)
  })
})

// 同一次实拍里的另一半:重叠发生在**下方宫格**(两列卡片),而 bannerFace 只是把机器人压下去的
// 那个游离图标。宫格侧的修法是三件事叠在一起 —— 文字层可收缩(`flex:1` + `minWidth:0`)、
// 两列宽度容得下、标题/描述各有行数上限。缺任何一件,长文案都会把相邻列顶成互相压字。
describe('首页宫格列宽与文字收缩回归锁(与 banner 那半同一次实拍,此前零常驻锁)', () => {
  const src = readFileSync(SRC, 'utf8')
  const cell = styleBlockOf(src, 'toolCell')
  const wrap = styleBlockOf(src, 'toolTextWrap')

  it('① 收缩判据:文字层必须同时声明 flex:1 与 minWidth:0', () => {
    // Yoga 里 flex:1 不带 minWidth:0 时,子项的内容宽度把父容器顶开 ⇒ 相邻列互相压字。
    expect(/flex:\s*1,/.test(wrap)).toBe(true)
    expect(/minWidth:\s*0,/.test(wrap)).toBe(true)
  })

  it('② 两列容得下:单元格宽必须是百分比形态,且两倍不超一行', () => {
    const w = /width:\s*'([\d.]+)%'/.exec(cell)
    expect(w, '判据失明:toolCell 宽度不再是百分比形态').not.toBeNull()
    expect(Number(w![1]) * 2).toBeLessThanOrEqual(100)
  })

  it('③ 标题与描述各有行数上限,且两行都装在收缩层之内', () => {
    expect(/numberOfLines=\{1\}/.test(jsxTagHolding(src, 'toolTitle'))).toBe(true)
    expect(/numberOfLines=\{2\}/.test(jsxTagHolding(src, 'toolDesc'))).toBe(true)
    // 这两个调用在结构漂了时会抛(判据失明)而不是静默通过 —— 本锁拒绝把"没找到"读成"没有违规"
    expect(depthUnder(src, 'toolTextWrap', 'toolTitle')).toBeGreaterThanOrEqual(0)
    expect(depthUnder(src, 'toolTextWrap', 'toolDesc')).toBeGreaterThanOrEqual(0)
  })

  it('④ 宫格取用节点不得写成函数形态 style(守门 131 那一型)', () => {
    for (const key of ['toolCell', 'toolTextWrap', 'toolTitle', 'toolDesc']) {
      expect(jsxTagHolding(src, key), `styles.${key} 所在标签写成了函数形态 style`).not.toMatch(
        /style=\{\s*\(/,
      )
    }
  })

  it('本锁有牙:退掉 minWidth 或行数上限,各自必须翻红;还原必须复绿', () => {
    const noMinWidth = src.replace(/(toolTextWrap:\s*\{[\s\S]*?)minWidth:\s*0,/, '$1')
    expect(noMinWidth, '变异没命中原文,这条自证等于没跑').not.toBe(src)
    expect(/minWidth:\s*0,/.test(styleBlockOf(noMinWidth, 'toolTextWrap'))).toBe(false)

    const noLineCap = src.replace(/(<Text style=\{styles\.toolDesc\}) numberOfLines=\{2\}/, '$1')
    expect(noLineCap, '变异没命中原文(描述行数上限),这条自证等于没跑').not.toBe(src)
    expect(/numberOfLines=\{2\}/.test(jsxTagHolding(noLineCap, 'toolDesc'))).toBe(false)

    // 反向对照:原文两条都在位 ⇒ 证明上面红的确实是"缺那一条",不是夹具坏了
    expect(/minWidth:\s*0,/.test(wrap)).toBe(true)
    expect(/numberOfLines=\{2\}/.test(jsxTagHolding(src, 'toolDesc'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
