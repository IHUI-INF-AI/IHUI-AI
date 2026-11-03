// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { hasAnsiCodes, parseAnsi, stripAnsiCodes } from '../ansi'

describe('parseAnsi — 无转义直通', () => {
  it('纯文本返回单 span,原样', () => {
    expect(parseAnsi('hello world')).toEqual([{ text: 'hello world' }])
  })

  it('空串返回空数组', () => {
    expect(parseAnsi('')).toEqual([])
  })

  it('多行纯文本不拆分', () => {
    expect(parseAnsi('line1\nline2')).toEqual([{ text: 'line1\nline2' }])
  })
})

describe('parseAnsi — SGR 基础色', () => {
  it('前景 8 色(31 = red)', () => {
    const spans = parseAnsi('\x1b[31mred\x1b[0m plain')
    expect(spans).toEqual([{ text: 'red', color: '#cd3131' }, { text: ' plain' }])
  })

  it('背景 8 色(41 = bg red)', () => {
    expect(parseAnsi('\x1b[41mon red\x1b[0m')).toEqual([{ text: 'on red', bg: '#cd3131' }])
  })

  it('亮色前景(90-97)与亮色背景(100-107)', () => {
    expect(parseAnsi('\x1b[90mgray\x1b[0m')[0]).toEqual({
      text: 'gray',
      color: '#767676',
    })
    expect(parseAnsi('\x1b[104mbg\x1b[0m')[0]).toEqual({
      text: 'bg',
      bg: '#3b8eea',
    })
  })

  it('默认色复位(39/49)', () => {
    const spans = parseAnsi('\x1b[31mred\x1b[39mback')
    expect(spans).toEqual([{ text: 'red', color: '#cd3131' }, { text: 'back' }])
  })
})

describe('parseAnsi — 组合与状态延续', () => {
  it('多参数组合:粗体 + 红', () => {
    expect(parseAnsi('\x1b[1;31mbold red\x1b[0m')[0]).toEqual({
      text: 'bold red',
      color: '#cd3131',
      bold: true,
    })
  })

  it('样式跨序列延续', () => {
    const spans = parseAnsi('\x1b[31mA\x1b[1mB\x1b[0m')
    expect(spans).toEqual([
      { text: 'A', color: '#cd3131' },
      { text: 'B', color: '#cd3131', bold: true },
    ])
  })

  it('粗斜体下划线删除线全开', () => {
    const spans = parseAnsi('\x1b[1;3;4;9mx\x1b[0m')
    expect(spans[0]).toEqual({
      text: 'x',
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
    })
  })

  it('部分复位(22 关粗体,4 仍在)', () => {
    const spans = parseAnsi('\x1b[1;4mxy\x1b[22mz\x1b[0m')
    expect(spans).toEqual([
      { text: 'xy', bold: true, underline: true },
      { text: 'z', underline: true },
    ])
  })

  it('inverse(SGR 7)标记', () => {
    expect(parseAnsi('\x1b[7minv\x1b[0m')[0]).toEqual({
      text: 'inv',
      inverse: true,
    })
  })

  it('\\x1b[m 等价全复位', () => {
    const spans = parseAnsi('\x1b[31mr\x1b[mplain')
    expect(spans).toEqual([{ text: 'r', color: '#cd3131' }, { text: 'plain' }])
  })

  it('相邻同样式片段合并', () => {
    const spans = parseAnsi('\x1b[31ma\x1b[31mb')
    expect(spans).toEqual([{ text: 'ab', color: '#cd3131' }])
  })
})

describe('parseAnsi — 256 色 / truecolor', () => {
  it('38;5;n 256 色(196 = 亮红)', () => {
    const span = parseAnsi('\x1b[38;5;196mc\x1b[0m')[0]
    expect(span?.color).toBe('rgb(255,0,0)')
  })

  it('48;5;n 256 色背景 + 灰度段(243)', () => {
    const span = parseAnsi('\x1b[48;5;243mg\x1b[0m')[0]
    expect(span?.bg).toBe('rgb(118,118,118)')
  })

  it('38;2;r;g;b truecolor', () => {
    const span = parseAnsi('\x1b[38;2;12;34;56mt\x1b[0m')[0]
    expect(span?.color).toBe('rgb(12,34,56)')
  })

  it('38 后跟畸形参数:停止消费,不吃掉后续参数', () => {
    const spans = parseAnsi('\x1b[38;99;31mred\x1b[0m')
    expect(spans).toEqual([{ text: 'red' }])
  })
})

describe('parseAnsi — 非颜色转义的处理', () => {
  it('光标控制 CSI 丢弃(清行/上移)', () => {
    expect(parseAnsi('a\x1b[2Kb\x1b[1Ac')).toEqual([{ text: 'abc' }])
  })

  it('OSC 标题(BEL 结束)丢弃', () => {
    expect(parseAnsi('\x1b]0;my title\x07body')).toEqual([{ text: 'body' }])
  })

  it('OSC 超链接(ST 结束)丢弃', () => {
    expect(parseAnsi('\x1b]8;;http://evil.example\x1b\\link\x1b]8;;\x1b\\')).toEqual([
      { text: 'link' },
    ])
  })

  it('单字符转义(\\x1bM)丢弃', () => {
    expect(parseAnsi('a\x1bMb')).toEqual([{ text: 'ab' }])
  })
})

describe('parseAnsi — 流式半截(不完整序列)', () => {
  it('末尾半截 CSI 按文本渲染(下一帧全量重解析自愈)', () => {
    expect(parseAnsi('ok \x1b[31')).toEqual([{ text: 'ok \x1b[31' }])
  })

  it('末尾裸 ESC 按文本渲染', () => {
    expect(parseAnsi('ok \x1b')).toEqual([{ text: 'ok \x1b' }])
  })

  it('末尾半截 OSC 丢弃(标题/URL 不闪现)', () => {
    expect(parseAnsi('body\x1b]0;partial')).toEqual([{ text: 'body' }])
  })

  it('中间位置的完整 CSI(非 m 终结)按控制序列丢弃', () => {
    // 小写/大写字母都是合法 CSI 终结字节(0x40-0x7E),'x' 即终结
    expect(parseAnsi('\x1b[3xa')).toEqual([{ text: 'a' }])
  })
})

describe('parseAnsi — XSS 防线(结构化路径)', () => {
  it('script 载荷只进 span.text,绝不产生 HTML 字符串', () => {
    const spans = parseAnsi('\x1b[31m<script>alert(1)</script>\x1b[0m')
    expect(spans).toEqual([{ text: '<script>alert(1)</script>', color: '#cd3131' }])
    // 结构化数据无任何 HTML 形态字段,调用方没有拼 HTML 的原料
    expect(Object.keys(spans[0] as object).sort()).toEqual(['color', 'text'])
  })

  it('onerror 属性注入同样只作为文本', () => {
    const spans = parseAnsi('<img src=x onerror=alert(1)>')
    expect(spans).toEqual([{ text: '<img src=x onerror=alert(1)>' }])
  })

  it('返回类型是数组对象而非字符串(类型层面防线)', () => {
    expect(Array.isArray(parseAnsi('\x1b[1mx'))).toBe(true)
  })
})

describe('stripAnsiCodes', () => {
  it('剥离颜色序列', () => {
    expect(stripAnsiCodes('\x1b[31mred\x1b[0m plain')).toBe('red plain')
  })

  it('剥离光标控制与 OSC', () => {
    expect(stripAnsiCodes('\x1b[2Ka\x1b]0;t\x07b\x1bM c')).toBe('ab c')
  })

  it('无转义零拷贝原样返回', () => {
    const s = 'plain text'
    expect(stripAnsiCodes(s)).toBe(s)
  })

  it('末尾不完整序列剥离(复制语义不需要自愈)', () => {
    expect(stripAnsiCodes('ok \x1b[31')).toBe('ok ')
  })
})

describe('hasAnsiCodes', () => {
  it('含 ESC 为 true,否则 false', () => {
    expect(hasAnsiCodes('\x1b[31m')).toBe(true)
    expect(hasAnsiCodes('plain')).toBe(false)
  })
})
