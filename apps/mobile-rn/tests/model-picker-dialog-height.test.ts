// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首页 AI 输入框「模型选择」弹窗:高度按内容自适应、到 70% 上限后内部滚动。
 *
 * 缺陷现场(修复前):HomeScreen.tsx 的弹层样式写 `maxHeight: '70%'`,列表块写 `flex: 1`。
 * RN 0.86 Fabric 下百分比上限不给子节点确定高度,`flex: 1` 在「高度由子内容决定」的父级里
 * 拿不到可分配空间 ⇒ 列表实际高度 0,弹窗只剩把手/标题/分类条,模型行一条都看不见。
 *
 * 本套件两条腿:
 * ① 纯函数:内容小取内容高、内容大取上限、未测量先给上限(保证列表有确定高度可渲染并上报)。
 * ② 源码接线:HomeScreen 弹层不再写百分比上限、列表不再写 `flex: 1`,且两个列表
 *    (ModelList / AgentList)都把内容尺寸回传给弹层。
 *
 * 说明:本仓库的 react-native 测试替身是 DOM stub,没有 Yoga 布局引擎,无法在测试里
 * 真的量出「0 高」。这里锁的是几何输入(谁给高度、上限多少)与纯函数行为;真机验证仍需
 * 人工按验收步骤执行。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIALOG_MAX_HEIGHT_RATIO,
  adaptiveDialogContentHeight,
  dialogContentHeight,
} from '../src/lib/dialog-geometry'

/** vitest 的 root 固定在本包目录,用 cwd 取源码(import.meta.url 在 jsdom 下非 file 协议) */
const homeSrc = readFileSync(resolve(process.cwd(), 'src/screens/HomeScreen.tsx'), 'utf8')

/** 按样式键切出对象源码(到同缩进的 `} as const,` 收尾,弹层样式块内部无嵌套对象) */
function styleBlockOf(src: string, key: string): string {
  const start = src.indexOf(`${key}: {`)
  expect(start, `未找到样式块 ${key}`).toBeGreaterThan(-1)
  const end = src.indexOf('\n  } as const,', start)
  expect(end, `样式块 ${key} 未闭合`).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('adaptiveDialogContentHeight(纯函数)', () => {
  it('内容小于上限时按内容撑开(内容小则矮)', () => {
    expect(adaptiveDialogContentHeight(180, 560)).toBe(180)
  })
  it('内容超过上限时封顶(内部滚动)', () => {
    expect(adaptiveDialogContentHeight(1200, 560)).toBe(560)
  })
  it('尚未测得内容高度时先返回上限,保证列表有确定高度可渲染并上报', () => {
    expect(adaptiveDialogContentHeight(0, 560)).toBe(560)
    expect(adaptiveDialogContentHeight(Number.NaN, 560)).toBe(560)
  })
  it('上限无效时返回 null,不产出 0 高弹层', () => {
    expect(adaptiveDialogContentHeight(180, 0)).toBeNull()
    expect(adaptiveDialogContentHeight(180, -1)).toBeNull()
    expect(adaptiveDialogContentHeight(180, Number.NaN)).toBeNull()
  })
  it('高度取整,且上限沿用统一比例 0.7', () => {
    expect(adaptiveDialogContentHeight(180.6, 560)).toBe(181)
    expect(dialogContentHeight(800)).toBe(Math.round(800 * DIALOG_MAX_HEIGHT_RATIO))
  })
})

describe('HomeScreen 模型弹窗接线(防回归)', () => {
  it('弹层样式不再写百分比上限(百分比在 Fabric 下不给子节点确定高度)', () => {
    expect(styleBlockOf(homeSrc, 'modelModalSheet')).not.toContain("maxHeight: '70%'")
  })

  it('列表块不再写 flex: 1(父级无确定高度时会被压成 0)', () => {
    expect(styleBlockOf(homeSrc, 'modelModalListBody')).not.toContain('flex: 1')
  })

  it('弹层高度由「测得内容高 + 统一上限」产出,并保留 70% 上限', () => {
    expect(homeSrc).toContain('adaptiveDialogContentHeight')
    expect(homeSrc).toContain('useDialogMaxHeightStyle')
    expect(homeSrc).toContain('dialogMaxHeightStyle')
    expect(homeSrc).toContain('modelModalMaxHeight')
    expect(homeSrc).toContain('modelModalListMaxHeight')
    expect(homeSrc).toContain('modelModalListHeight')
  })

  it('ModelList 与 AgentList 都把内容尺寸回传给弹层', () => {
    expect(homeSrc.split('onContentSizeChange=').length - 1).toBeGreaterThanOrEqual(2)
    expect(homeSrc.split('setModelModalContentHeight').length - 1).toBeGreaterThanOrEqual(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
