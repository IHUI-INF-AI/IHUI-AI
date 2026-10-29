// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN→小程序样式转译层(rn-compat/style.ts)的单元锁。
 *
 * 为什么必须有:这一层是"一份共享屏源两端渲染"的承重墙 —— 数字单位、无单位键、
 * 阴影/变换/截断任一格译错,共享屏在小程序里就整屏走形,而**类型检查抓不到**
 * (译出来仍是合法 CSS)。本测试只锁语义不锁实现,断言的是用户能看见的那几条:
 *   - RN 数字 dp 与 weapp px 1:1(禁止悄悄折 rpx,那样物理尺寸差 2 倍);
 *   - flex/opacity/zIndex 等按无单位处理(补 px 会破坏语义);
 *   - 字符串原样透传(共享层依赖 var(--color-*) 直通);
 *   - numberOfLines 折 line-clamp、阴影折 box-shadow、transform 数组折字符串;
 *   - 空样式不产出空对象(调用方按 undefined 判"无样式")。
 */
import { describe, expect, it } from 'vitest'

import { flattenStyle, StyleSheet, toTaroStyle } from '@/rn-compat/style'

describe('toTaroStyle:单位口径', () => {
  it('数字按 1:1 落 px(不做 rpx 换算)', () => {
    expect(toTaroStyle({ padding: 28, borderRadius: 8 })).toEqual({
      padding: '28px',
      borderRadius: '8px',
    })
  })

  it('绝不产出 rpx 单位(共享屏的数字是 dp,折 rpx 会让物理尺寸差 2 倍)', () => {
    const out = toTaroStyle({ width: 100, marginLeft: 12, fontSize: 16, lineHeight: 24 })
    expect(JSON.stringify(out)).not.toMatch(/rpx/)
  })

  it('无单位键保持数字', () => {
    const out = toTaroStyle({ flex: 1, flexGrow: 2, opacity: 0.5, zIndex: 9, fontWeight: 600 })
    expect(out).toMatchObject({ flex: 1, flexGrow: 2, opacity: 0.5, zIndex: 9, fontWeight: 600 })
  })

  it('字符串原样透传(var / % / calc 不被改写)', () => {
    const out = toTaroStyle({ color: 'var(--color-foreground)', width: '50%', top: 'calc(100% - 8px)' })
    expect(out).toMatchObject({
      color: 'var(--color-foreground)',
      width: '50%',
      top: 'calc(100% - 8px)',
    })
  })

  it('undefined / null 值被跳过,不写进样式', () => {
    const out = toTaroStyle({ padding: 4, margin: undefined, top: null })
    expect(out).toEqual({ padding: '4px' })
  })

  it('空样式 ⇒ undefined(调用方按"无样式"处理)', () => {
    expect(toTaroStyle(undefined)).toBeUndefined()
    expect(toTaroStyle({})).toBeUndefined()
    expect(toTaroStyle(null)).toBeUndefined()
  })
})

describe('flattenStyle:数组与嵌套', () => {
  it('数组后者覆盖前者(RN 同语义)', () => {
    expect(flattenStyle([{ padding: 4, margin: 8 }, { padding: 12 }])).toEqual({
      padding: 12,
      margin: 8,
    })
  })

  it('falsy 项被忽略(条件样式 `cond && style` 的常态)', () => {
    expect(flattenStyle([false, null, undefined, { padding: 4 }])).toEqual({ padding: 4 })
  })

  it('嵌套数组展平', () => {
    expect(flattenStyle([{ a: 1 }, [{ a: 2 }, { b: 3 }]])).toEqual({ a: 2, b: 3 })
  })
})

describe('toTaroStyle:RN 专有能力折成 CSS', () => {
  it('numberOfLines ⇒ line-clamp(#===2)', () => {
    const out = toTaroStyle({ numberOfLines: 2, color: 'red' })
    expect(out).toMatchObject({
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 2,
      overflow: 'hidden',
    })
  })

  it('numberOfLines=0 ⇒ 不产生截断', () => {
    expect(toTaroStyle({ numberOfLines: 0 })).not.toHaveProperty('display')
  })

  it('ellipsizeMode 被丢弃(CSS 无对应能力)', () => {
    expect(toTaroStyle({ ellipsizeMode: 'tail' })?.display).toBeUndefined()
  })

  it('iOS 阴影四件套 ⇒ box-shadow(含透明度折 rgba)', () => {
    const out = toTaroStyle({
      shadowColor: '#112233',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      shadowOpacity: 0.2,
    })
    expect(out).toMatchObject({ boxShadow: '0px 2px 6px rgba(17,34,51,0.2)' })
  })

  it('三位 hex 阴影色也能折', () => {
    const out = toTaroStyle({ shadowColor: '#f00', shadowRadius: 4, shadowOpacity: 1 })
    expect(out?.boxShadow).toBe('0px 0px 4px rgba(255,0,0,1)')
  })

  it('elevation ⇒ boxShadow(近似)', () => {
    expect(toTaroStyle({ elevation: 4 })).toMatchObject({ boxShadow: '0 2px 4px rgba(0,0,0,0.18)' })
  })

  it('transform 数组 ⇒ CSS 字符串,平移补 px、缩放不补', () => {
    const out = toTaroStyle({ transform: [{ translateX: 4 }, { scale: 2 }] })
    expect(out?.transform).toBe('translateX(4px) scale(2)')
  })

  it('transform 非数组 ⇒ 不产出 transform(不猜)', () => {
    expect(toTaroStyle({ transform: 'rotate(3deg)' })?.transform).toBeUndefined()
  })
})

describe('StyleSheet 替身', () => {
  it('create 原样返回(共享层 `styles.x` 取值不受影响)', () => {
    const styles = StyleSheet.create({ box: { padding: 4 } })
    expect(styles.box).toEqual({ padding: 4 })
  })

  it('flatten 与 flattenStyle 同源', () => {
    expect(StyleSheet.flatten([{ a: 1 }, { b: 2 }])).toEqual(flattenStyle([{ a: 1 }, { b: 2 }]))
  })

  it('absoluteFill 四边贴齐', () => {
    expect(StyleSheet.absoluteFill).toEqual({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
