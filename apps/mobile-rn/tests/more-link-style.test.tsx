// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 红米真机实测:「我的AI员工」入口渲染成竖排(文字一行 + 箭头第二行)。
// uiautomator bounds 给出的不是"wrap 生效",而是 **整份 styles.hit 没落到节点上**:
//   Button [552,584]-[676,640] = 124x56px = 62x28dp;TextView [552,584]-[676,616] = 124x32px
//   28dp = 文字 16dp + 箭头 12dp,**既没有 paddingVertical 4+4(否则 36dp)也没有 gap 2**;
//   62dp = 「我的AI员工」6 字的自然宽度 ⇒ 容器被最高的子节点撑开 = 竖排 + stretch 对齐。
//
// 第 1 组用例先证明 MoreLink **内部样式在隔离下是对的**(jsdom 读到 flexDirection:'row'),
// 把嫌疑从"样式值写错"推到"样式没送到节点"。第 2 组是本票的回归锁:形状锁 —— 被 NativeWind
// cssInterop 包装的 RN 原语不得收函数形态的 style,因为那一形态在真机上会被整份丢掉。
//
// WHY(根因来自读三方实现,不是推断):
// `react-native-css-interop/dist/runtime/components.js:7` 注册了
// `cssInterop(Pressable, { className: "style" })`,而 `runtime/wrap-jsx.js` 是**无条件**替换
// (与用没用 className 无关)⇒ 所有 `<Pressable>` 都走 `native-interop.js`:
//   collectInlineRules 把 props.style(函数)原样塞进 normal →
//   applyRules 的非数组分支执行 `assignToTarget(props, { ...declaration }, config, …)`,
//   而 `{ ...函数 }` === `{}`(函数的 name/length 是不可枚举自有属性)→
//   state.props.style 被写成 `{}`,再在 render-component.js:76 的
//   `props = { ...props, ...possiblyAnimatedProps }` 里覆盖掉原函数 ⇒ 节点最终 style={},
//   静态档 / 内联档 / 调用方传入的档 **一起**消失。数组与对象形态不受影响
//   (collectInlineRules 会递归数组并把自有对象逐个并入,结果与直接传数组等价)。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { MoreLink } from '@ihui/rn-app'

const MORE_LINK_SRC = resolve(__dirname, '../../../packages/app/src/components/MoreLink.tsx')
const CSS_INTEROP_DIR = resolve(__dirname, '../node_modules/react-native-css-interop')

/** Pressable 的开标签文本(从 `<Pressable` 到它自己的 `>`;本组件的开标签内不含 `=>`) */
const openTagOf = (source: string): string => {
  const start = source.indexOf('<Pressable')
  expect(start).toBeGreaterThanOrEqual(0)
  return source.slice(start, source.indexOf('>', start))
}

describe('MoreLink 的横排档在隔离下是对的(排除"样式值写错")', () => {
  it('容器 style 含 flexDirection:row / alignItems:center / gap,且调用方档同时生效', () => {
    const { getByRole } = render(
      <MoreLink label="我的AI员工" onPress={() => {}} style={{ marginLeft: 8 }} />,
    )
    const hit = getByRole('button')
    expect(hit.style.flexDirection).toBe('row')
    expect(hit.style.alignItems).toBe('center')
    expect(hit.style.marginLeft).toBe('8px')
    // paddingVertical/paddingHorizontal 是 RN 专属轴向社会属性,DOM 侧没有对应槽位,
    // 断不了不等于没生效 —— 它由真机 bounds(28dp → 24dp)那一判据负责。
    expect(hit.getAttribute('style') ?? '').toContain('gap: 2px')
  })
})

/** Pressable 的 children 渲染函数形态(`>` 之后紧跟 `({ pressed }) =>`) */
const CHILDREN_FN = />\s*\{\s*\(\s*\{\s*pressed\s*\}\s*\)\s*=>/

describe('回归锁:MoreLink 不得向 cssInterop 包装的 RN 原语传函数形态 style', () => {
  const src = readFileSync(MORE_LINK_SRC, 'utf8')

  it('Pressable 的 style= 是数组字面量,且开标签内不出现 pressed', () => {
    const open = openTagOf(src)
    expect(open).toMatch(/style=\{\[/)
    // 函数形态(style={({ pressed }) => …})在真机上会被 cssInterop 丢掉整份 style
    expect(open).not.toMatch(/style=\{\s*\(/)
    expect(open).not.toContain('pressed')
  })

  it('按压反馈只能是 Pressable 的 children 渲染函数(不新增布局节点)', () => {
    expect(src).toMatch(CHILDREN_FN)
    expect(src).not.toMatch(/<Pressable[\s\S]*?>\s*<View/)
  })

  it('本锁有牙:把根因形态与"包一层 View"两种改法喂回判据,各自必须红', () => {
    // ① 函数形态的 style(真机上被 cssInterop 整份丢掉的那一型)
    const regressed = src.replace(
      /style=\{\[[^\]]*\]\}/,
      'style={({ pressed }) => [styles.hit, pressed ? styles.pressed : null, style]}',
    )
    expect(regressed).not.toBe(src)
    const open = openTagOf(regressed)
    expect(open).toMatch(/style=\{\s*\(/)
    expect(open).not.toMatch(/style=\{\[/)
    expect(open).toContain('pressed')
    // ② 用外层 View 承载 pressed —— 多出一个布局节点,横排几何随之改变
    const wrapped = src.replace(
      '      {({ pressed }) => (\n        <>',
      '      <View>\n        <>\n        ',
    )
    expect(wrapped).not.toBe(src)
    expect(wrapped).toMatch(/<Pressable[\s\S]*?>\s*<View/)
  })

  it('前提复核:三方实现仍在原位且确实无条件包装 Pressable', () => {
    const registered = readFileSync(resolve(CSS_INTEROP_DIR, 'dist/runtime/components.js'), 'utf8')
    expect(registered).toMatch(/cssInterop\)[\s\S]*?\.Pressable/)
    const wrap = readFileSync(resolve(CSS_INTEROP_DIR, 'dist/runtime/wrap-jsx.js'), 'utf8')
    expect(wrap).toMatch(/interopComponents\.get\(type\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
