// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * BottomActionBar「一份源 + 两端注入」接线契约的测试(O02 票④,形态照抄 back-chevron-wiring.test.ts)。
 *
 * 钉五组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① 共享核心的平台纯度 —— 核心里出现 react-native / @tarojs import,一端 tsc 就会把它
 *     拉进被检程序;"只在注释里禁止"拦不住任何东西;
 *  ② 核心行为(行衬 / 卡盒 / 卡内图文距与字号 / 控件方块与墨迹)—— 注入 capturing 原语直调函数,
 *     不渲染:换算格注入双倍档 ⇒ 几何必须跟着翻倍,证明核心没有绕过 toUnit 写死数字;
 *  ③ 小程序壳接线 —— 三个核心子件在壳里、五件原语在壳里、壳不再持有被收走的端内数字;
 *  ④ RN 壳接线 —— 控件走核心、StyleSheet 不再写方块边长、字形仍由 lucide 注入;
 *  ⑤ 「只剩一份源」—— 两端壳都从 `@ihui/shared/ui` 取同一枚核心,端内不再各有一份卡盒/行衬定义。
 *
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),并用"改坏的源码"回喂同一把尺子自证有牙。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ReactElement } from 'react'

import { describe, expect, it } from 'vitest'

import {
  BottomActionBarControl,
  BottomActionBarIconCardRow,
  BottomActionBarInlineRow,
  type BottomActionBarGlyphProps,
  type BottomActionBarPlatform,
  type BottomActionBarPressableProps,
  type BottomActionBarTextProps,
  type BottomActionBarViewProps,
} from '../bottom-action-bar-core'
import {
  BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX,
  BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
  BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX,
  BOTTOM_ACTION_BAR_ICON_CARD_GLYPH_GAP_PX,
  BOTTOM_ACTION_BAR_ICON_CARD_HEIGHT_PX,
  BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX,
  BOTTOM_ACTION_BAR_ICON_CARD_WIDTH_PX,
  BOTTOM_ACTION_BAR_ICON_GLYPH_PX,
  BOTTOM_ACTION_BAR_INLINE_ROW_PAD_BOTTOM_PX,
  BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX,
  BOTTOM_ACTION_BAR_SEND_GLYPH_PX,
} from '../bottom-action-bar-spec'

/** 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数(与 back-chevron-wiring 同因)。 */
function repoRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url))
  for (let up = 0; up < 12; up += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
      return dir
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 跨端接线对账无从取材')
}

const ROOT = repoRoot()

const CORE_SRC = readFileSync(
  join(ROOT, 'packages/shared/src/ui/bottom-action-bar-core.tsx'),
  'utf8',
)
const RN_SRC = readFileSync(join(ROOT, 'apps/mobile-rn/src/components/BottomActionBar.tsx'), 'utf8')
const TARO_SRC = readFileSync(
  join(ROOT, 'apps/miniapp-taro/src/components/BottomActionBar.tsx'),
  'utf8',
)

/**
 * 剥注释但**保留字符串内容** —— 剥字符串会把 `className="flex"` 一起抹掉(判据失明),
 * 留注释会把说明性文字喂进判据(核心头注里逐字写着 "禁止 import 'react-native'")。
 * 与守门 128 的同名函数同一形状;本文件不引 scripts/(测试不依赖守门实现)。
 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    const n = src.charAt(i + 1)
    if (mode === 'code') {
      if (quote !== '') {
        out += c
        if (c === '\\') {
          out += n
          i += 1
        } else if (c === quote) {
          quote = ''
        }
        continue
      }
      if (c === '/' && n === '/') {
        mode = 'line'
        out += '  '
        i += 1
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        out += '  '
        i += 1
        continue
      }
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else {
        out += ' '
      }
      continue
    }
    if (c === '*' && n === '/') {
      mode = 'code'
      out += '  '
      i += 1
      continue
    }
    out += c === '\n' ? c : ' '
  }
  return out
}

/** 核心纯度:import 源白名单 = react(仅类型)+ 本地 spec。平台件进共享层,一端 tsc 拉爆。 */
function corePurityProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const sources = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
  const allowed = new Set(['react', './bottom-action-bar-spec'])
  for (const s of sources) {
    if (!allowed.has(s)) out.push(`核心 import 了白名单外模块: ${s}`)
  }
  return out
}

/**
 * 端内"被收走的数字"回潮判据:这些字面量收编后只应存在于共享 spec / 核心,
 * 壳里再出现一份就是"同一个元素两端各写一次"回来了(不判 className 里的 Tailwind 档)。
 */
const SHELL_NUMBERS: Array<[RegExp, string]> = [
  [/\brpx\(160\)/, '卡盒宽 80 又被写成端内 rpx(160)'],
  [/\brpx\(150\)/, '卡盒高 75 又被写成端内 rpx(150)'],
  [/\brpx\(20\)/, '标文字号 10 又被写成端内 rpx(20)'],
  [/\bmarginBottom:\s*rpx\(12\)/, '卡内图文距 6 又被写成端内 rpx(12)'],
  [/'0 20rpx 10rpx'/, "行衬 '0 20rpx 10rpx' 又被写成端内字面量串"],
]

function shellNumberProblems(code: string, side: string): string[] {
  return SHELL_NUMBERS.filter(([re]) => re.test(code)).map(([, what]) => `${side} 壳: ${what}`)
}

/** 小程序壳接线判据:三个核心子件 + 五件原语 + 端内数字回潮 + 导出形态。 */
function taroWiringProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui['"]/.test(code))
    out.push('Taro 壳未从 @ihui/shared/ui 引入核心')
  for (const member of [
    'BottomActionBarInlineRow',
    'BottomActionBarIconCardRow',
    'BottomActionBarControl',
  ]) {
    if (!new RegExp(`<${member}[\\s/>]`).test(code))
      out.push(`Taro 壳没有渲染 <${member}>(接线形状回退)`)
  }
  if (!/from\s+['"]@tarojs\/components['"]/.test(code))
    out.push('Taro 壳未从 @tarojs/components 取 View 原语')
  if (/\btoUnit\b/.test(code) === false) out.push('Taro 壳未注入 toUnit(rpx 串换算)')
  if (!/glyphUnit:\s*\(px\)\s*=>\s*px\s*\*\s*TARO_RPX_PER_PX/.test(code)) {
    out.push('Taro 壳 glyphUnit 未给 rpx 数值(LineIcon 的 size 收数值,它自己再按 H5/原生换算)')
  }
  if (!/<LineIcon[\s/>]/.test(code)) out.push('Taro 壳未注入 LineIcon 字形(守门 102 的矢量出口)')
  if (!/hoverClass=\{disabled === true \? 'none' : 'opacity-60'\}/.test(code)) {
    out.push("Taro 壳按压态未走静态 hoverClass(disabled ? 'none' : 'opacity-60')")
  }
  out.push(...shellNumberProblems(code, 'Taro'))
  return out
}

/** RN 壳接线判据:控件走核心 + 数组样式 + StyleSheet 不持有方块边长 + lucide 字形注入。 */
function rnWiringProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui['"]/.test(code)) out.push('RN 壳未从 @ihui/shared/ui 引入核心')
  if (!/<BottomActionBarControl[\s/>]/.test(code))
    out.push('RN 壳没有渲染 <BottomActionBarControl>(接线形状回退)')
  if (!/\btoUnit:\s*\(px\)\s*=>\s*px/.test(code)) out.push('RN 壳未注入 toUnit(dp 恒等)')
  if (!/\bglyphUnit:\s*\(px\)\s*=>\s*px/.test(code)) out.push('RN 壳未注入 glyphUnit(dp 恒等)')
  if (!/from\s+['"]lucide-react-native['"]/.test(code))
    out.push('RN 壳未注入 lucide-react-native 字形(守门 102 的矢量出口)')
  if (!/style=\{\[/.test(code)) out.push('RN 壳子 View 样式不是数组形态(pressed 无落栈处)')
  // 方块边长只由核心供出:sendBtn 档里再写 width/height 就是端内第二份 32
  const sendBtnAt = code.search(/\bsendBtn:\s*\{/)
  if (sendBtnAt >= 0) {
    const block = code.slice(sendBtnAt, code.indexOf('}', sendBtnAt))
    if (/\bwidth\b|\bheight\b/.test(block))
      out.push('RN 壳 sendBtn 档仍持有方块宽/高(方块边长唯一源是共享核心)')
  } else {
    out.push('RN 壳读不到 sendBtn 档 ⇒ 本锁的取材前提已失效')
  }
  if (/\bsize=\{BOTTOM_ACTION_BAR_SEND_GLYPH_PX\}/.test(code))
    out.push('RN 壳仍自持发送字形墨迹档(应经核心 glyphPx)')
  out.push(...shellNumberProblems(code, 'RN'))
  return out
}

// ── ② 的行为面:注入 capturing 原语,直调核心函数(不渲染,jsdom 无关) ─────────────

interface FakeEvent {
  nativeEvent: { type: string }
}

type RenderedPressableProps = BottomActionBarPressableProps<
  number,
  Record<string, unknown>,
  FakeEvent
>

function CapturingPressable(props: RenderedPressableProps): null {
  void props
  return null
}

function StubGlyph(_props: BottomActionBarGlyphProps): null {
  return null
}

function CapturingView(_props: BottomActionBarViewProps<number, Record<string, unknown>>): null {
  return null
}

function CapturingText(_props: BottomActionBarTextProps<number, Record<string, unknown>>): null {
  return null
}

function makePlatform(
  toUnit: (px: number) => number = (px) => px,
  glyphUnit: (px: number) => number = (px) => px,
): BottomActionBarPlatform<number, Record<string, unknown>, FakeEvent> {
  return {
    toUnit,
    glyphUnit,
    View: CapturingView,
    Text: CapturingText,
    Pressable: CapturingPressable,
    Glyph: StubGlyph,
  }
}

function inlineRowEl(
  platform: BottomActionBarPlatform<number, Record<string, unknown>, FakeEvent>,
) {
  return BottomActionBarInlineRow<number, Record<string, unknown>, FakeEvent>({
    platform,
    className: 'flex',
    style: { width: 300 },
    children: 'row',
  }) as ReactElement<BottomActionBarViewProps<number, Record<string, unknown>>>
}

function controlEl(
  platform: BottomActionBarPlatform<number, Record<string, unknown>, FakeEvent>,
  onActivate: (event: FakeEvent) => void,
): ReactElement<RenderedPressableProps> {
  return BottomActionBarControl<number, Record<string, unknown>, FakeEvent>({
    platform,
    boxPx: BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
    glyphPx: BOTTOM_ACTION_BAR_SEND_GLYPH_PX,
    glyph: 'arrow-up',
    glyphColor: '#fff',
    label: '发送',
    onActivate,
    disabled: true,
    className: 'send',
    style: { backgroundColor: '#000' },
    disabledStyle: { opacity: 0.5 },
  }) as ReactElement<RenderedPressableProps>
}

describe('① 共享核心的平台纯度', () => {
  it('现态:import 源只有 react(类型)与 ./bottom-action-bar-spec,无 react-native / @tarojs', () => {
    expect(corePurityProblems(CORE_SRC)).toEqual([])
  })

  it('本锁有牙:核心被污染进 react-native ⇒ 纯度判据必须红', () => {
    const dirty = CORE_SRC.replace(
      "import type { ComponentType, ReactNode } from 'react'",
      "import { View } from 'react-native'",
    )
    expect(dirty).not.toBe(CORE_SRC)
    expect(corePurityProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('② 核心行为:行衬 / 卡盒 / 控件(capturing 原语直调)', () => {
  it('条内行衬 = spec 的 0/10/5 + 行距 8,且 toUnit 真的被喂进去', () => {
    const el = inlineRowEl(makePlatform())
    const box = el.props.boxStyle
    expect(el.type).toBe(CapturingView)
    expect(box).toEqual({
      paddingTop: 0,
      paddingRight: BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX,
      paddingBottom: BOTTOM_ACTION_BAR_INLINE_ROW_PAD_BOTTOM_PX,
      paddingLeft: BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX,
      gap: BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX,
    })
    expect(el.props.className).toBe('flex')
    expect(el.props.style).toEqual({ width: 300 })
    // 换算格注入双倍档 ⇒ 几何必须跟着翻倍(证明核心没写死数字)
    const doubled = inlineRowEl(makePlatform((px) => px * 2))
    expect(doubled.props.boxStyle?.paddingRight).toBe(BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX * 2)
    expect(doubled.props.boxStyle?.gap).toBe(BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX * 2)
  })

  it('图标卡行:卡盒 80×75 / 图文距 6 / 标文字号 10 / 墨迹 35 全部来自 spec', () => {
    const onActivate = (_item: unknown, _event: FakeEvent): void => {}
    const cardRow = BottomActionBarIconCardRow<number, Record<string, unknown>, FakeEvent>({
      platform: makePlatform(),
      items: [
        { key: 'camera', label: '相机', glyph: 'camera' },
        { key: 'voice', label: '语音输入', glyph: 'mic', active: true },
      ],
      className: 'flex justify-start',
      cardClassName: 'flex flex-col items-center justify-center',
      cardStyle: { backgroundColor: '#eee' },
      activeCardStyle: { backgroundColor: '#0af' },
      glyphColor: '#666',
      activeGlyphColor: '#fff',
      labelColor: '#111',
      activeLabelColor: '#fff',
      onActivate,
    }) as ReactElement<BottomActionBarViewProps<number, Record<string, unknown>>>
    expect(cardRow.props.boxStyle?.paddingRight).toBe(BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX)
    const cards = cardRow.props.children as unknown as Array<ReactElement<RenderedPressableProps>>
    expect(cards).toHaveLength(2)
    const [idle, active] = cards
    expect(idle?.props.boxStyle).toEqual({
      width: BOTTOM_ACTION_BAR_ICON_CARD_WIDTH_PX,
      height: BOTTOM_ACTION_BAR_ICON_CARD_HEIGHT_PX,
      gap: BOTTOM_ACTION_BAR_ICON_CARD_GLYPH_GAP_PX,
    })
    expect(idle?.props.className).toBe('flex flex-col items-center justify-center')
    expect(idle?.props.style).toEqual({ backgroundColor: '#eee' })
    expect(idle?.props.active).toBe(false)
    const idleGlyph = idle?.props.children as unknown as Array<
      ReactElement<BottomActionBarGlyphProps>
    >
    expect(idleGlyph[0]?.props.name).toBe('camera')
    expect(idleGlyph[0]?.props.size).toBe(BOTTOM_ACTION_BAR_ICON_GLYPH_PX)
    expect(idleGlyph[0]?.props.color).toBe('#666')
    const idleLabel = idleGlyph[1] as unknown as ReactElement<
      BottomActionBarTextProps<number, Record<string, unknown>>
    >
    expect(idleLabel.type).toBe(CapturingText)
    expect(idleLabel.props.fontSize).toBe(BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX)
    expect(idleLabel.props.color).toBe('#111')
    // 选中态:active 为 true ⇒ 原语收到 activeStyle,字形换选中色
    expect(active?.props.active).toBe(true)
    expect(active?.props.activeStyle).toEqual({ backgroundColor: '#0af' })
    const activeGlyph = active?.props.children as unknown as Array<
      ReactElement<BottomActionBarGlyphProps>
    >
    expect(activeGlyph[0]?.props.color).toBe('#fff')
  })

  it('控件(附件/发送):方块 32 / 墨迹 16 / 动作与禁用通道原样透传', () => {
    const onActivate = (_event: FakeEvent): void => {}
    const el = controlEl(makePlatform(), onActivate)
    expect(el.type).toBe(CapturingPressable)
    expect(el.props.boxStyle).toEqual({
      width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
      height: BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
    })
    expect(el.props.onActivate).toBe(onActivate)
    expect(el.props.accessibilityLabel).toBe('发送')
    expect(el.props.disabled).toBe(true)
    expect(el.props.className).toBe('send')
    expect(el.props.style).toEqual({ backgroundColor: '#000' })
    expect(el.props.disabledStyle).toEqual({ opacity: 0.5 })
    const glyph = el.props.children as ReactElement<BottomActionBarGlyphProps>
    expect(glyph.type).toBe(StubGlyph)
    expect(glyph.props.name).toBe('arrow-up')
    expect(glyph.props.size).toBe(BOTTOM_ACTION_BAR_SEND_GLYPH_PX)
    // 换算格注入 rpx 倍率 ⇒ 方块与墨迹必须跟着换算(小程序端 2× 即 32rpx/32)
    const scaled = controlEl(
      makePlatform(
        (px) => px * 2,
        (px) => px * 2,
      ),
      onActivate,
    )
    expect(scaled.props.boxStyle.width).toBe(BOTTOM_ACTION_BAR_CONTROL_BOX_PX * 2)
    const scaledGlyph = scaled.props.children as ReactElement<BottomActionBarGlyphProps>
    expect(scaledGlyph.props.size).toBe(BOTTOM_ACTION_BAR_SEND_GLYPH_PX * 2)
  })

  it('控件墨迹档与附件档是两个槽位(发送 16 / 附件 14),核心不合并', () => {
    const el = BottomActionBarControl<number, Record<string, unknown>, FakeEvent>({
      platform: makePlatform(),
      boxPx: BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
      glyphPx: BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX,
      glyph: 'plus',
    }) as ReactElement<RenderedPressableProps>
    const glyph = el.props.children as ReactElement<BottomActionBarGlyphProps>
    expect(glyph.props.size).toBe(BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX)
    expect(el.props.accessibilityLabel).toBeUndefined()
  })
})

describe('③ 小程序壳接线(壳只注入原语,不持有结构与档位)', () => {
  it('现态:三个核心子件 + 五件原语 + 端内数字不回潮', () => {
    expect(taroWiringProblems(TARO_SRC)).toEqual([])
  })

  it('本锁有牙:壳回退成自渲染卡行 ⇒ 接线判据必须红', () => {
    const dirty = TARO_SRC.replace('<BottomActionBarIconCardRow', '<View')
    expect(dirty).not.toBe(TARO_SRC)
    expect(taroWiringProblems(dirty).length).toBeGreaterThan(0)
  })

  it('本锁有牙:卡盒数字回潮到壳里 ⇒ 端内数字判据必须红', () => {
    const dirty = `${TARO_SRC}\nconst leak = { width: rpx(160), padding: '0 20rpx 10rpx' }\n`
    expect(shellNumberProblems(stripComments(dirty), 'Taro').length).toBe(2)
  })
})

describe('④ RN 壳接线(控件走核心,StyleSheet 只留视觉)', () => {
  it('现态:控件 + 单位恒等 + lucide 字形 + 数组样式 + sendBtn 不持方块边长', () => {
    expect(rnWiringProblems(RN_SRC)).toEqual([])
  })

  it('本锁有牙:sendBtn 回写 width/height ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('sendBtn: {', 'sendBtn: {\n    width: 32,\n    height: 32,')
    expect(dirty).not.toBe(RN_SRC)
    expect(rnWiringProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('⑤ 该族只剩一份源(两端壳 import 同一枚核心)', () => {
  it('两端壳都消费 @ihui/shared/ui 的同一核心,端内不再各有一份卡盒/行衬定义', () => {
    const codeOf = (side: string, src: string): string[] => {
      const code = stripComments(src)
      const out: string[] = []
      if (!/from\s+['"]@ihui\/shared\/ui['"]/.test(code)) out.push(`${side} 壳没有消费共享核心`)
      // 端内再写一遍"行衬三值"或"卡盒两值"就是第二份源
      if (/padding:\s*['"]0\s+20rpx\s+10rpx['"]/.test(code)) out.push(`${side} 壳自持行衬`)
      if (/paddingTop:\s*10\b/.test(code)) out.push(`${side} 壳自持行衬(paddingTop 10)`)
      return out
    }
    expect(codeOf('Taro', TARO_SRC)).toEqual([])
    expect(codeOf('RN', RN_SRC)).toEqual([])
    // 核心才是唯一持有者:三个几何函数的调用点在核心里,不在壳里
    expect(/bottomActionBarInlineRowBoxStyle\(platform\.toUnit\)/.test(CORE_SRC)).toBe(true)
    expect(/bottomActionBarIconCardBoxStyle\(platform\.toUnit\)/.test(CORE_SRC)).toBe(true)
    expect(/BOTTOM_ACTION_BAR_ICON_CARD_WIDTH_PX/.test(CORE_SRC)).toBe(false)
  })
})
