// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import { decodeInput } from '../src/tui/fullscreen/keymap.js'

const CTX = { running: false }

/** SGR 鼠标帧:`\x1b[<b;x;yM`(按下/滚轮)、`m`(释放)。键码 64=上滚、65=下滚,高位是修饰键。 */
describe('全屏 TUI 的 SGR 滚轮解码(G-329 缺陷格)', () => {
  it('64 = 上滚,一旦匹配就出 scroll 动作(负行数=向历史翻)', () => {
    expect(decodeInput('\x1b[<64;10;5M', CTX)).toEqual([{ type: 'scroll', lines: -3 }])
  })

  it('65 = 下滚,方向相反', () => {
    expect(decodeInput('\x1b[<65;10;5M', CTX)).toEqual([{ type: 'scroll', lines: 3 }])
  })

  it('修饰键只改高位,不改方向(shift+上滚 = 68)', () => {
    expect(decodeInput('\x1b[<68;1;1M', CTX)).toEqual([{ type: 'scroll', lines: -3 }])
    expect(decodeInput('\x1b[<69;1;1M', CTX)).toEqual([{ type: 'scroll', lines: 3 }])
  })

  it('普通按键与释放帧不产生滚动(只吞不猜)', () => {
    expect(decodeInput('\x1b[<0;10;5M', CTX)).toEqual([{ type: 'unbound', label: 'mouse' }])
    expect(decodeInput('\x1b[<0;10;5m', CTX)).toEqual([{ type: 'unbound', label: 'mouse' }])
    expect(decodeInput('\x1b[<65;10;5m', CTX)).toEqual([{ type: 'unbound', label: 'mouse' }])
  })

  it('滚轮字节与普通键/方向键混在一串里时逐段切分,不吞后文', () => {
    const chunk = '\x1b[<64;3;3M' + 'a' + '\x1b[A' + '\x1b[<65;3;3M'
    expect(decodeInput(chunk, CTX)).toEqual([
      { type: 'scroll', lines: -3 },
      { type: 'insert', text: 'a' },
      { type: 'historyUp' },
      { type: 'scroll', lines: 3 },
    ])
  })

  it('回归锁:没有 `<` 前缀的普通 CSI 不被当成鼠标(方向键语义不变)', () => {
    expect(decodeInput('\x1b[B', CTX)).toEqual([{ type: 'historyDown' }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
