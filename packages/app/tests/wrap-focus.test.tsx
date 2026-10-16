// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 容器级(WRAP)聚焦描边唯一实现的回归钉。
//
// 立因:AGENTS §4 把"输入框/选择控件聚焦态描边"定为「描边不得取墨档」的唯一例外位,
// 而 RN/共享侧此前没有容器级的取值出口 —— `TextField`(输入框级)管不到整行/整井的容器,
// 于是 SearchInput 与 MessageInput 各写一份 `useState(focused)` + 各挑一次 brand 色值,
// 这正是"改一端忘另一端"的开口(票 G-42 ② 记的就是这一型)。
//
// 判据方向:比的是**逐字取值**与**接入形态**,不是排版;并配变异对照证明它会咬
// (把墨档换成别的档,断言必须红 —— 否则这条钉等于"恒绿的散文")。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getTokens } from '../src/theme/tokens'
import { useWrapFocus, wrapFocusBorder, wrapFocusInk } from '../src/hooks/use-wrap-focus'

const here = dirname(fileURLToPath(import.meta.url))
const stripFormat = (src: string): string => src.replace(/,*(\s*[)\]])/g, '$1').replace(/\s+/g, '')

describe('wrapFocusBorder / wrapFocusInk 取值', () => {
  it('浅色聚焦 = 纯黑 #000000;深色聚焦 = 纯白 #FFFFFF(墨档随主题反转,不是 brandAccent 蓝)', () => {
    expect(wrapFocusBorder(getTokens('light'), true)).toEqual({ borderColor: '#000000' })
    expect(wrapFocusBorder(getTokens('dark'), true)).toEqual({ borderColor: '#FFFFFF' })
  })

  it('未聚焦 ⇒ undefined:完全不介入宿主常态样式 ⇒ 换色不换宽、零布局跳动', () => {
    expect(wrapFocusBorder(getTokens('light'), false)).toBeUndefined()
    expect(wrapFocusBorder(getTokens('dark'), false)).toBeUndefined()
  })

  it('变异对照:把墨档换成"另一档蓝"必须不等于本出口的取值(钉不住就等于没钉)', () => {
    const tk = getTokens('light')
    const ink = wrapFocusInk(tk)
    expect(ink).not.toBe('#0000FF')
    expect(wrapFocusBorder(tk, true)?.borderColor).toBe(ink)
    // 反向:若有人把描边退回中性灰,这条必须红
    expect(ink).not.toBe(tk.border.light)
  })
})

describe('useWrapFocus 状态与宿主回调', () => {
  it('聚焦/失焦切换驱动 focusBorder,且宿主 onFocus/onBlur 原样透传(内部记账不吃回调)', () => {
    const calls: string[] = []
    const { result } = renderHook(() =>
      useWrapFocus(getTokens('light'), {
        onFocus: () => calls.push('host-focus'),
        onBlur: () => calls.push('host-blur'),
      }),
    )

    expect(result.current.focused).toBe(false)
    expect(result.current.focusBorder).toBeUndefined()

    act(() => result.current.onFocus())
    expect(result.current.focused).toBe(true)
    expect(result.current.focusBorder).toEqual({ borderColor: '#000000' })

    act(() => result.current.onBlur())
    expect(result.current.focused).toBe(false)
    expect(result.current.focusBorder).toBeUndefined()

    expect(calls).toEqual(['host-focus', 'host-blur'])
  })

  it('spread 与 onFocus/onBlur 是同一对处理器(铺 Input 上即可,不必两处各接)', () => {
    const { result } = renderHook(() => useWrapFocus(getTokens('light')))
    expect(result.current.spread.onFocus).toBe(result.current.onFocus)
    expect(result.current.spread.onBlur).toBe(result.current.onBlur)
  })
})

describe('两处 WRAP 站点确实走这一份实现(端接线证据)', () => {
  const search = readFileSync(join(here, '../src/components/SearchInput.tsx'), 'utf8')
  const msgInput = readFileSync(join(here, '../src/features/chat/MessageInput.tsx'), 'utf8')

  it('SearchInput:描边取 ff.focusBorder,不再自挑 brand 色值,也不再自持 focused state', () => {
    expect(stripFormat(search)).toContain('useWrapFocus(tokens,{onFocus,onBlur})')
    expect(search).toContain('ff.focusBorder')
    expect(/focused\s*\?\s*\{\s*borderColor:\s*tokens\.brand\.DEFAULT/.test(search)).toBe(false)
    expect(/const \[focused, setFocused\] = useState/.test(search)).toBe(false)
  })

  it('MessageInput:inputRowFocused 的描边取自 wrapFocusInk(同一出口),不是本地别名', () => {
    expect(msgInput).toContain("import { wrapFocusInk } from '../../hooks/use-wrap-focus'")
    expect(stripFormat(msgInput)).toContain('inputRowFocused:{borderColor:wrapFocusInk(tk)}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
