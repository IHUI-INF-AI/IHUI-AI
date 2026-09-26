// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ansi.ts — 终端 ANSI 转义序列解析为结构化 span(纯函数,零依赖)
 *
 * 为什么手写而不引 ansi 依赖:
 *   1) 终端输出是不可信输入,解析器越薄、攻击面越小;自实现 ~200 行完全可控。
 *   2) 消息流内不用 xterm(保持轻量,真正 xterm 只在 AiTerminalDock),不需要
 *      ansi-regex / ansi-styles 这类面向"拼接 HTML 字符串"的库。
 *
 * XSS 硬防线(为什么输出 span 数组而不是 HTML 字符串):
 *   终端输出可能含 <script>、onerror= 等注入载荷。本模块只把文本拆成
 *   { text, 样式 } 的结构化数据,渲染交给 React —— React 对文本子节点
 *   自动转义,任何载荷都不会被解释执行。本模块绝不产生 HTML 字符串,
 *   调用方也禁止把解析结果拼成 dangerouslySetInnerHTML。
 *
 * 覆盖的语法(只消费 SGR;其余转义按语义丢弃或按文本渲染):
 *   - SGR(\x1b[...m):前景/背景 8 色(30-37/40-47)、亮色(90-97/100-107)、
 *     256 色(38;5;n / 48;5;n)、truecolor(38;2;r;g;b)、粗体(1)/暗淡(2)/
 *     斜体(3)/下划线(4)/反显(7)/删除线(9) 及对应 off(22/23/24/27/29)、
 *     默认色(39/49)、全复位(0;\x1b[m)
 *   - CSI 光标控制类(\x1b[...A-L 等非 m 终结):丢弃(纯屏幕定位,
 *     对线性输出流无意义)
 *   - OSC(\x1b]...BEL/ST,含 DCS/SOS/PM/APC 字符串类):安全丢弃
 *     (标题/超链接,渲染出来是垃圾;超链接更不可信)
 *   - 单字符转义(\x1bM、\x1b7 等 @-Z\-_ 段):丢弃
 *
 * 流式半截序列的处理(重要约定):
 *   terminal_delta 是逐块流式的,全量缓冲里末尾可能挂着半截转义序列
 *   (如 "...\x1b[31" 还没等到 'm')。约定:遇到到末尾仍未终结的 CSI,
 *   按**普通文本**渲染 —— 理由:(a) 下一帧 delta 到达后是全量重解析,
 *   半截序列自然"愈合"成正确颜色,中间态只闪现几个裸字符;(b) 若按
 *   丢弃处理,颜色切换会被静默吞掉,样式跨帧漂移更难排查。OSC 则相反:
 *   未终结的 OSC 丢弃到末尾 —— OSC 载荷是标题/URL,按文本闪现出一大段
 *   不可信链接比短暂少一段文本更糟。
 */

/** 单个渲染片段:样式为可选字段,无样式的片段就是普通文本 */
export interface AnsiSpan {
  text: string
  /** 前景色,值为 CSS 颜色(命名/rgb()),直接可用于 React style */
  color?: string
  /** 背景色,同上 */
  bg?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  /** 反显(SGR 7):渲染时前景/背景互换 */
  inverse?: boolean
}

/**
 * 8/16 色调色板:对齐 VS Code Dark+ / iTerm 常用暗色终端默认值。
 * 用固定值而非主题 token,因为 ANSI 色是程序语义(如红色=错误),
 * 与页面明暗主题无关;暗色终端是命令输出的主导语境。
 */
const ANSI_PALETTE: readonly string[] = [
  '#000000', // 0 black
  '#cd3131', // 1 red
  '#0dbc79', // 2 green
  '#e5e513', // 3 yellow
  '#2472c8', // 4 blue
  '#bc3fbc', // 5 magenta
  '#11a8cd', // 6 cyan
  '#e5e5e5', // 7 white
  '#767676', // 8 bright black
  '#f14c4c', // 9 bright red
  '#23d18b', // 10 bright green
  '#f5f543', // 11 bright yellow
  '#3b8eea', // 12 bright blue
  '#d670d6', // 13 bright magenta
  '#29b8db', // 14 bright cyan
  '#ffffff', // 15 bright white
]

/** 256 色调色板序号 → CSS 颜色(xterm 标准 6x6x6 立方 + 24 级灰度) */
function paletteColor(n: number): string {
  const c = Math.min(n, 255) // 超界序号 clamp(畸形 38;5;999 也不越表)
  if (c < 16) return ANSI_PALETTE[c] ?? ANSI_PALETTE[15] ?? '#ffffff'
  if (c < 232) {
    const i = c - 16
    const to = (v: number) => (v === 0 ? 0 : 55 + v * 40)
    return `rgb(${to(Math.floor(i / 36))},${to(Math.floor((i % 36) / 6))},${to(i % 6)})`
  }
  const v = 8 + (c - 232) * 10
  return `rgb(${v},${v},${v})`
}

/** 安全取整参数:非有限/负数一律按 0(SGR 空参数语义) */
function parseParam(s: string | undefined): number {
  if (s === undefined || s === '') return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** SGR 样式状态(跨序列延续) */
interface SgrState {
  color?: string
  bg?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
}

/** 全量样式键(复位/比较时遍历用) */
const SGR_KEYS = [
  'color',
  'bg',
  'bold',
  'dim',
  'italic',
  'underline',
  'strikethrough',
  'inverse',
] as const

/** 把一段 SGR 参数体(如 "1;31" 或 "38;5;196")应用到状态上 */
function applySgr(body: string, state: SgrState): void {
  if (body === '') {
    // \x1b[m 等价 \x1b[0m(ECMA-48)
    for (const key of SGR_KEYS) delete state[key]
    return
  }
  const parts = body.split(';')
  let k = 0
  while (k < parts.length) {
    const p = parseParam(parts[k])
    if (p === 0) {
      for (const key of SGR_KEYS) delete state[key]
    } else if (p === 1) state.bold = true
    else if (p === 2) state.dim = true
    else if (p === 3) state.italic = true
    else if (p === 4) state.underline = true
    else if (p === 7) state.inverse = true
    else if (p === 9) state.strikethrough = true
    else if (p === 22) {
      delete state.bold
      delete state.dim
    } else if (p === 23) delete state.italic
    else if (p === 24) delete state.underline
    else if (p === 27) delete state.inverse
    else if (p === 29) delete state.strikethrough
    else if (p >= 30 && p <= 37) state.color = ANSI_PALETTE[p - 30]
    else if (p === 39) delete state.color
    else if (p >= 40 && p <= 47) state.bg = ANSI_PALETTE[p - 40]
    else if (p === 49) delete state.bg
    else if (p >= 90 && p <= 97) state.color = ANSI_PALETTE[p - 90 + 8]
    else if (p >= 100 && p <= 107) state.bg = ANSI_PALETTE[p - 100 + 8]
    else if (p === 38 || p === 48) {
      // 扩展色:38;5;n(256 色) / 38;2;r;g;b(truecolor);其余形态视为
      // 畸形序列,停止消费本序列剩余参数(防止吃掉后续无关参数)
      const mode = parseParam(parts[k + 1])
      let color: string | undefined
      if (mode === 5) {
        color = paletteColor(parseParam(parts[k + 2]))
        k += 2
      } else if (mode === 2) {
        const r = parseParam(parts[k + 2]) % 256
        const g = parseParam(parts[k + 3]) % 256
        const b = parseParam(parts[k + 4]) % 256
        color = `rgb(${r},${g},${b})`
        k += 4
      } else {
        break
      }
      if (p === 38) state.color = color
      else state.bg = color
    }
    // 未识别的 SGR 参数:静默忽略(前向兼容)
    k++
  }
}

/** CSI 终结字节范围 0x40(@) - 0x7E(~);undefined 越界按未终结 */
function isCsiFinal(ch: string | undefined): boolean {
  if (ch === undefined) return false
  const c = ch.charCodeAt(0)
  return c >= 0x40 && c <= 0x7e
}

/**
 * 字符串类转义(到 BEL 或 ST 结束):OSC(]) / DCS(P) / SOS(X) / PM(^) / APC(_)
 * 这类序列载荷可能包含任意不可信内容(标题/URL),统一安全丢弃。
 */
function isStringSeqIntro(ch: string | undefined): boolean {
  return ch === ']' || ch === 'P' || ch === 'X' || ch === '^' || ch === '_'
}

/** 单字符转义段(0x40-0x5F,且非上面已特判的字符串类) */
function isSingleCharEscape(ch: string | undefined): boolean {
  if (ch === undefined) return false
  const c = ch.charCodeAt(0)
  return c >= 0x40 && c <= 0x5f && !isStringSeqIntro(ch) && ch !== '['
}

/** 快速判断:含 ESC 才需要走解析路径(无转义时零拷贝直通) */
export function hasAnsiCodes(text: string): boolean {
  return text.includes('\x1b')
}

/**
 * 解析 ANSI 文本为结构化 span 数组(供 React 渲染,绝不产生 HTML)。
 * 无转义时返回单片段直通;空串返回空数组。
 */
export function parseAnsi(text: string): AnsiSpan[] {
  if (text.length === 0) return []
  if (!hasAnsiCodes(text)) return [{ text }]

  const spans: AnsiSpan[] = []
  const state: SgrState = {}
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf === '') return
    const last = spans[spans.length - 1]
    const lastHasStyle =
      last !== undefined &&
      (last.color !== undefined ||
        last.bg !== undefined ||
        last.bold === true ||
        last.dim === true ||
        last.italic === true ||
        last.underline === true ||
        last.strikethrough === true ||
        last.inverse === true)
    const hasStyle =
      state.color !== undefined ||
      state.bg !== undefined ||
      state.bold === true ||
      state.dim === true ||
      state.italic === true ||
      state.underline === true ||
      state.strikethrough === true ||
      state.inverse === true
    // 相邻同样式片段合并,减少 React 节点数(长构建日志可达数千段)
    if (!hasStyle && !lastHasStyle && last !== undefined) {
      last.text += buf
    } else if (hasStyle && last !== undefined && sameStyle(last, state)) {
      last.text += buf
    } else if (hasStyle) {
      spans.push({ ...state, text: buf })
    } else {
      spans.push({ text: buf })
    }
    buf = ''
  }

  while (i < text.length) {
    const ch = text[i]
    if (ch !== '\x1b') {
      buf += ch
      i++
      continue
    }
    const next = text[i + 1]
    if (next === '[') {
      // CSI:扫描到终结字节
      let j = i + 2
      while (j < text.length && !isCsiFinal(text[j])) j++
      if (j >= text.length) {
        // 不完整 CSI(流式半截):按普通文本渲染,下一帧全量重解析自愈
        buf += text.slice(i)
        i = text.length
        break
      }
      const body = text.slice(i + 2, j)
      const fin = text[j]
      // 先用"旧状态"固化 buf,再应用新序列 —— 顺序错了会把前一段文本
      // 染成新序列的样式(实测踩过)
      flush()
      if (fin === 'm') applySgr(body, state)
      // 非 m 终结 = 光标控制类(清屏/移动等),对线性输出无意义 → 丢弃
      i = j + 1
    } else if (isStringSeqIntro(next)) {
      // OSC/DCS/SOS/PM/APC:到 BEL(\x07) 或 ST(\x1b\\) 结束,整体丢弃
      const bel = text.indexOf('\x07', i + 2)
      const st = text.indexOf('\x1b\\', i + 2)
      if (bel === -1 && st === -1) {
        // 不完整字符串序列:丢弃到末尾(见头部注释"流式半截"的取舍)
        i = text.length
        break
      }
      if (bel !== -1 && (st === -1 || bel < st)) {
        i = bel + 1
      } else {
        i = st + 2
      }
    } else if (isSingleCharEscape(next)) {
      // \x1bM / \x1b7 等单字符转义:丢弃 2 字节
      flush()
      i += 2
    } else {
      // 裸 ESC(含末尾悬空 ESC):按普通文本渲染
      buf += ch
      i++
    }
  }
  flush()
  return spans
}

/** 两片段样式是否相同(用于合并相邻片段) */
function sameStyle(a: AnsiSpan, b: SgrState): boolean {
  return (
    a.color === b.color &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.inverse === b.inverse
  )
}

/**
 * 剥离所有 ANSI 转义,返回纯文本(供复制按钮使用)。
 * 决定(V3 #67):复制的内容是**剥离转义后的纯文本** —— 复制出来的
 * \x1b[31m 粘贴到任何地方都是垃圾/可被终端误解释,而颜色信息在终端
 * 场景下本来就不该进入剪贴板。
 * 与 parseAnsi 的差异:不完整序列也一并剥离(复制不需要"自愈"语义)。
 */
export function stripAnsiCodes(text: string): string {
  if (!hasAnsiCodes(text)) return text
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch !== '\x1b') {
      out += ch
      i++
      continue
    }
    const next = text[i + 1]
    if (next === '[') {
      let j = i + 2
      while (j < text.length && !isCsiFinal(text[j])) j++
      if (j >= text.length) return out // 不完整尾部:丢弃剩余
      i = j + 1
    } else if (isStringSeqIntro(next)) {
      const bel = text.indexOf('\x07', i + 2)
      const st = text.indexOf('\x1b\\', i + 2)
      if (bel === -1 && st === -1) return out
      if (bel !== -1 && (st === -1 || bel < st)) i = bel + 1
      else i = st + 2
    } else if (isSingleCharEscape(next)) {
      i += 2
    } else {
      out += ch
      i++
    }
  }
  return out
}
