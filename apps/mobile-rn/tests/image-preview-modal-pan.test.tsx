// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-853(mobile-rn)图片预览的平移接线。
 *
 * 为什么这一份测试不长成 web 那份的样子:RN 的手势走 **responder 系统**,而 vitest 的
 * react-native 替身把 View/Pressable 渲染成 DOM 节点 —— `onResponderGrant/Move/Release`
 * 在 DOM 上根本没有对应的可派发事件。硬造一个"看起来像"的 fireEvent 只会验到替身。
 * 所以这里分两层各验各的:
 *   A. 行为层(真函数、真判据):端内的 contain 取材 `containedImageBox` 与共享层
 *      `clampImagePreviewOffset` **串成同一条链**跑 —— 这正是渲染时喂给 transform 的那两个值;
 *   B. 接线层(源码形状锁):证明组件真的消费了共享出口、三个释放/复位出口都在位。
 *      形状锁不是替代行为测试,它替代的是"摘掉某一行后没人发现"这一格(守门 70/76/81 同族)。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, fireEvent } from '@testing-library/react'

// 两个替身照同端既有先例 `image-preview-modal-element-pack.test.tsx` 原样取,不另发明一套:
// 缺它们时组件渲染即抛 `useI18n must be used within I18nProvider`,现象与"平移实现有错"同形。
vi.mock('../src/i18n', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})
// active-tokens 顶层依赖原生模块(expo/nativewind),vitest 下加载即抛;组件只取一个色常量。
vi.mock('../src/theme/active-tokens', () => ({
  tokens: { surface: { light: '#f9fafb' } },
}))

import ImagePreviewModal, { containedImageBox } from '../src/components/ImagePreviewModal'
import {
  clampImagePreviewOffset,
  imagePreviewPanApplies,
} from '@ihui/shared/utils/image-preview-offset'

const BOX = { width: 400, height: 300 }
const SOURCE = { uri: 'https://img.test/a.png' }

describe('G-853 RN · 平移量的真实计算链(contain 取材 → 共享钳制)', () => {
  it('contain 取材:横图在竖盒里按宽适配,再乘缩放 ⇒ 与视口比出的溢出量两向各钳一次', () => {
    // 自然 1600×900 装进 400×300 的盒:按宽适配 ⇒ 400×225
    const drawn = containedImageBox({ width: 1600, height: 900 }, BOX)
    expect(drawn).toEqual({ width: 400, height: 225 })

    // 放大 2 倍 ⇒ 800×450,视口 400×300 ⇒ x 溢出 400(上限 200)、y 溢出 150(上限 75)
    const geo = (offsetX: number, offsetY: number) => ({
      offsetX,
      offsetY,
      scaledWidth: drawn.width * 2,
      scaledHeight: drawn.height * 2,
      viewportWidth: BOX.width,
      viewportHeight: BOX.height,
    })
    expect(imagePreviewPanApplies(geo(0, 0))).toBe(true)
    expect(clampImagePreviewOffset(geo(9999, 9999))).toEqual({ x: 200, y: 75 })
    expect(clampImagePreviewOffset(geo(-9999, -9999))).toEqual({ x: -200, y: -75 })
  })

  it('未放大(画出来仍小于盒)⇒ 判"不平移",端内不得自己按 zoom>1 猜', () => {
    const drawn = containedImageBox({ width: 1600, height: 900 }, BOX)
    const geo = {
      offsetX: 999,
      offsetY: 999,
      scaledWidth: drawn.width,
      scaledHeight: drawn.height,
      viewportWidth: BOX.width,
      viewportHeight: BOX.height,
    }
    expect(imagePreviewPanApplies(geo)).toBe(false)
    expect(clampImagePreviewOffset(geo)).toEqual({ x: 0, y: 0 })
  })

  it('尺寸没量到(onLoad/onLayout 还没回来)⇒ 不平移:未测不得被读成可拖', () => {
    expect(containedImageBox({ width: 0, height: 0 }, BOX)).toEqual({ width: 0, height: 0 })
    expect(containedImageBox({ width: 100, height: 100 }, { width: 0, height: 0 })).toEqual({
      width: 0,
      height: 0,
    })
  })
})

describe('G-853 RN · 手势接线形状锁', () => {
  // 取源码路径走 __dirname + resolve,不用 `new URL(..., import.meta.url)`:
  // vitest 变换后的模块里 import.meta.url 不是 file: scheme,readFileSync 会当场抛
  // `The URL must be of scheme file` ⇒ **整个套件在收集期就崩**,里面所有行为用例一条都不跑
  // (与守门 114 立项那一型同族:收集期失败表现为"少一批测试",不是报错)。
  // 本端既有先例:`tests/more-link-style.test.tsx` 用的就是 resolve(__dirname, ...)。
  const src = readFileSync(resolve(__dirname, '../src/components/ImagePreviewModal.tsx'), 'utf8')

  it('平移判据只来自共享层,端内没有第二份钳制算式', () => {
    expect(src).toContain("from '@ihui/shared/utils/image-preview-offset'")
    expect(src).toContain('clampImagePreviewOffset(')
    expect(src).toContain('imagePreviewPanApplies(')
    // 端内不得出现自算的 Math.max(0, … - …)/2 那一行 —— 那是第二份真相
    expect(src).not.toMatch(/Math\.max\(\s*0\s*,\s*[\w.]+\s*-\s*[\w.]+\s*\)\s*\/\s*2/)
  })

  it('三个出口都在位:release / terminate / 复位', () => {
    expect(src).toContain('onResponderRelease={handleEnd}')
    expect(src).toContain('onResponderTerminate={handleEnd}')
    expect(src).toContain('dragRef.current = null')
    // 复位触发面由 **effect 依赖**表达,不由 `setOffset` 的文本次数表达。
    // 上一版断言"至少 3 处 setOffset({x:0,y:0})",实测 2 处就红 —— 但语义覆盖其实是全的:
    // 一处 `useEffect(..., [index, zoom])` 同时管住"换图"与"改缩放"两个场景。
    // 按文本数次数有两个失效方向:依赖面已覆盖时误报"缺一处复位"(本次红就是这一型),
    // 以及有人把复位抽进 helper / 换行书写时永远红 —— 那是把重构当缺陷。
    // 真正要保证的不变量是:**存在一个复位 effect,其依赖同时含 index 与 zoom**。
    // ⚠️ 必须**收集全部**复位 effect 再判,`exec` 只取第一个匹配会抓到"打开时"那个
    //    (deps = [visible, initialIndex, total])而漏掉真正承载换图/改缩放的那一处 ——
    //    本断言的第一版就是这样写的,它当时以"红"伪装成"有牙",变异自证才发现它恒定只看第一个。
    const allDeps = [
      ...src.matchAll(/setOffset\(\{\s*x:\s*0,\s*y:\s*0\s*\}\)[\s\S]{0,80}?\},\s*\[([^\]]*)\]/g),
    ].map((m) => m[1].split(',').map((s) => s.trim()))
    expect(allDeps.length, '一处复位 effect 都没解析到 ⇒ 判据失明,不记通过').toBeGreaterThan(0)
    const covers = allDeps.some((d) => d.includes('index') && d.includes('zoom'))
    expect(
      covers,
      `没有任何一个复位 effect 的依赖同时含 index 与 zoom(实得 ${JSON.stringify(allDeps)})`,
    ).toBe(true)
  })

  it('手势面只在真能平移时才打开(未放大保持 pointerEvents="none")', () => {
    expect(src).toContain("pointerEvents={panApplies ? 'auto' : 'none'}")
    expect(src).toContain('onStartShouldSetResponder={() => panApplies}')
  })

  it('translate 在 scale 之前 ⇒ 平移量是视口 dp,不会再被 zoom 乘一遍', () => {
    expect(src).toMatch(/translateX:[\s\S]*?translateY:[\s\S]*?scale:\s*zoom/)
  })
})

describe('G-853 RN · 现网行为不回退', () => {
  it('默认态(没量到尺寸)仍可点遮罩关闭,且不带任何平移', () => {
    const onClose = vi.fn()
    const { container } = render(<ImagePreviewModal visible source={SOURCE} onClose={onClose} />)
    const buttons = Array.from(container.querySelectorAll('button'))
    fireEvent.click(buttons[0]!)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('100%')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
