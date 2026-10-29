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
 *  ⑥–⑧ O02 票④ 收口归属(2026-10-28):spec 档三分且逐档归属(两端直引 / 经 core 投影 /
 *     仅小程序经 core)、16 条差异档事实表与台账 counts 同批对账、单端档归属不许被"补引用凑平";
 *     ⑧ 两端落屏 px **现算**相等 —— 档名还在、单位或倍数折错(小程序把档名裸用成 rpx、
 *     RN 别名写成 `×2`)时 ⑥ 与门 128 都不红,只能靠算式求值发现。
 *     判据口径与逐档归因见 `bottom-action-bar-spec.ts` 头注「O02 票④ 收口证据」。
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
// ⑧ 的符号表:档值一律**现读**自导出面,手抄一份会在新增档后静默过期(两倍误差也能过的空转尺子)。
import * as bottomActionBarSpec from '../bottom-action-bar-spec'

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

/* ────────────────────────────────────────────────────────────────────────────
 * ⑥–⑨ O02 票④ 收口归属(判据口径与逐档归因见 spec 头注「O02 票④ 收口证据」)。
 *
 * 门 128 判的是**两端取值集合的差**(某一档只在一端出现 ⇒ 分叉),它看不见"两端同值但各写
 * 一份",也说不出"这一档的另一端是不是根本没有这个元素"。这两件事正是本票的收口条件,
 * 所以在这里补成可机器复核的三张账:
 *  · ⑥ spec 的每一枚 `_PX` 档只许落进三种归属之一 —— 两端直引 / 经 core 投影 / 仅小程序
 *    经 core;新档不登记 = 红(幻影档),RN 腿引用单端档 = 红(补引用凑平);
 *  · ⑦ 门 128 现读的 13 几何档 + 3 半径档逐条落成"值 + 归属端 + A/B/C + 出处锚点"的事实表,
 *    表长与台账 `counts` / `radiusCounts` **同批对账** —— 台账下调而事实表没同步 = 红;
 *  · ⑧ 对侧一旦出现该单端元素的身份(典型动机 = 让 diffCount 变小)⇒ 红;owner 侧出处改值
 *    ⇒ 红(事实表过期)。
 * 全部是源码级判据,不 import scripts/(测试不依赖守门实现),两端壳也不进本包 tsc。
 * ──────────────────────────────────────────────────────────────────────────── */

const SPEC_SRC = readFileSync(
  join(ROOT, 'packages/shared/src/ui/bottom-action-bar-spec.ts'),
  'utf8',
)

/** 去掉 import 块:import 里的档名是"已接线"的声明,**不是取数点**(与 InputArea 同名函数同因)。 */
function stripImportLines(src: string): string {
  const out: string[] = []
  let inImport = false
  for (const line of src.split('\n')) {
    if (!inImport && /^\s*import\b/.test(line)) inImport = true
    if (inImport) {
      if (/from\s*['"][^'"]*['"]/.test(line) || /^\s*import\s*['"][^'"]*['"]/.test(line))
        inImport = false
      out.push('')
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** 判定用源码:剥注释(保留字符串)→ 去 import。与 InputArea / 守门 128 同形。 */
function prepared(src: string): string {
  return stripImportLines(stripComments(src))
}

function occurrences(src: string, name: string): number {
  return [...src.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length
}

/** spec 导出的 `_PX` 档(现读,不手抄 —— 手抄的清单在新增档后会静默过期)。 */
function specTierNames(specSrc: string): string[] {
  return [
    ...prepared(specSrc).matchAll(/export\s+const\s+(BOTTOM_ACTION_BAR_[A-Z0-9_]+_PX)\s*=/g),
  ].map((m) => m[1] as string)
}

/**
 * spec 档的三分归属 —— 本测试的**真相源**,不从源码反推(反推会随某一端删引用而缩)。
 *  - both-legs:两端组件源都直接取这一枚;
 *  - miniapp-via-core:小程序经 core 的 `BottomActionBarInlineRow` 取,RN 直取;
 *  - miniapp-core-only:只有小程序渲染的图标卡行/条内行消费(【B 单端档】,不得扩到 RN)。
 */
type TierScope = 'both-legs' | 'miniapp-via-core' | 'miniapp-core-only'

const SPEC_TIER_SCOPES: ReadonlyArray<{ tier: string; scope: TierScope; why: string }> = [
  { tier: 'BOTTOM_ACTION_BAR_CHIP_FONT_PX', scope: 'both-legs', why: 'chip 文字字号' },
  { tier: 'BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX', scope: 'both-legs', why: '模型条文字字号' },
  { tier: 'BOTTOM_ACTION_BAR_TEXT_FONT_PX', scope: 'both-legs', why: '正文/旧模式按钮字号' },
  { tier: 'BOTTOM_ACTION_BAR_MODEL_BADGE_PX', scope: 'both-legs', why: '模型条字形墨迹' },
  { tier: 'BOTTOM_ACTION_BAR_CONTROL_BOX_PX', scope: 'both-legs', why: '附件/发送方块' },
  { tier: 'BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX', scope: 'both-legs', why: '附件槽字形墨迹' },
  { tier: 'BOTTOM_ACTION_BAR_SEND_GLYPH_PX', scope: 'both-legs', why: '发送槽字形墨迹' },
  {
    tier: 'BOTTOM_ACTION_BAR_CHIP_ROW_GAP_PX',
    scope: 'miniapp-via-core',
    why: '行距:RN 直取,小程序经 core 的 InlineRow',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_ICON_GLYPH_PX',
    scope: 'miniapp-core-only',
    why: 'A 图标卡墨迹 35:RN 同功能走 AddPanel(另一枚组件)',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_INLINE_ROW_PAD_X_PX',
    scope: 'miniapp-core-only',
    why: 'B 条内行横衬 10:RN 由容器/行 gap 表达',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_INLINE_ROW_PAD_BOTTOM_PX',
    scope: 'miniapp-core-only',
    why: 'B 条内行下衬 5:RN 由容器 gap 表达',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_ICON_CARD_WIDTH_PX',
    scope: 'miniapp-core-only',
    why: 'A 图标卡盒宽 80:RN 同功能走 AddPanel',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_ICON_CARD_HEIGHT_PX',
    scope: 'miniapp-core-only',
    why: 'A 图标卡盒高 75:RN 同功能走 AddPanel',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX',
    scope: 'miniapp-core-only',
    why: 'A 图标卡标文字号 10:RN 同功能走 AddPanel',
  },
  {
    tier: 'BOTTOM_ACTION_BAR_ICON_CARD_GLYPH_GAP_PX',
    scope: 'miniapp-core-only',
    why: 'A 图标卡图文距 6:RN 同功能走 AddPanel',
  },
]

/** 返回问题清单(空 = 三分归属成立)。`table` 只是给变异用例留的注入点,判据本身零复制。 */
function tierScopeProblems(opts: {
  specSrc: string
  coreSrc: string
  miniSrc: string
  rnSrc: string
  table?: ReadonlyArray<{ tier: string; scope: TierScope; why: string }>
}): string[] {
  const table = opts.table ?? SPEC_TIER_SCOPES
  const spec = prepared(opts.specSrc)
  const core = prepared(opts.coreSrc)
  const mini = prepared(opts.miniSrc)
  const rn = prepared(opts.rnSrc)
  const exports = specTierNames(opts.specSrc)
  const declared = new Set(exports)
  const seen = new Set<string>()
  const out: string[] = []

  for (const row of table) {
    if (seen.has(row.tier)) out.push(`${row.tier} 在归属表里登记了两遍`)
    seen.add(row.tier)
    if (!declared.has(row.tier)) {
      out.push(`${row.tier} 已不在 spec 导出面(档被删/改名)⇒ 归属表过期;${row.why}`)
      continue
    }
    const onMini = occurrences(mini, row.tier)
    const onRn = occurrences(rn, row.tier)
    const consumers = onRn + occurrences(core, row.tier) + occurrences(spec, row.tier)
    if (row.scope === 'both-legs') {
      if (onMini === 0) out.push(`小程序腿不再直接取 ${row.tier} ⇒ 两端同值档少了一半(${row.why})`)
      if (onRn === 0) out.push(`RN 腿不再直接取 ${row.tier} ⇒ 两端同值档少了一半(${row.why})`)
    }
    if (row.scope === 'miniapp-via-core') {
      if (onRn === 0) out.push(`RN 腿不再取 ${row.tier}(该档经 core 供小程序)⇒ 投影腿脱线`)
      if (onMini > 0) out.push(`小程序腿开始直取 ${row.tier} ⇒ 归属表要重裁(原:经 core)`)
      if (consumers < 2) out.push(`${row.tier} 没有任何消费方 ⇒ 幻影档(造好没装车 = 没有)`)
    }
    if (row.scope === 'miniapp-core-only') {
      if (onRn > 0) out.push(`RN 腿引用了 ${row.tier} ⇒ 给单端档补引用凑平,不是收敛(${row.why})`)
      if (consumers < 2) out.push(`${row.tier} 在 core/spec 里没有消费点 ⇒ 幻影档`)
    }
  }
  for (const name of exports)
    if (!seen.has(name)) out.push(`${name} 从 spec 导出却未进归属表 ⇒ 新档必须先归因再接线`)

  for (const rowName of ['BottomActionBarIconCardRow', 'BottomActionBarInlineRow']) {
    if (!new RegExp(`<${rowName}[\\s/>]`).test(mini))
      out.push(`小程序壳不再渲染 <${rowName}> ⇒ 单端档失去唯一渲染点`)
    if (new RegExp(`<${rowName}[\\s/>]`).test(rn))
      out.push(`RN 壳开始渲染 <${rowName}> ⇒ 单端档不再是单端`)
  }
  return out
}

/**
 * 门 128 现读的 16 条单端差异档 —— 值 + 归属端 + A/B/C + 出处锚点 + 对侧"元素身份"反锚。
 * 表长与 `cross-end-ui-parity-baseline.json` 的 `counts` / `radiusCounts` **同批对账**:
 * 台账下调而表没同步 ⇒ ⑦ 红(防止"读数变好"与"归属结论"各走各的)。
 */
type FactDim = 'geometry' | 'radius'
type FamilyLeg = 'miniapp-taro' | 'mobile-rn'

interface OneSidedFact {
  value: number
  dimension: FactDim
  owner: FamilyLeg
  kind: 'A' | 'B' | 'C' | 'A/B'
  /** owner 侧的真实出处;值/写法一改 ⇒ 事实表过期 */
  anchor: RegExp
  /** 对侧若出现这个元素身份 ⇒ 已不再是单端(补引用凑平 / 元素被搬过去) */
  otherAnchor: RegExp
  why: string
}

const ONE_SIDED_FACTS: ReadonlyArray<OneSidedFact> = [
  // ── 仅 RN(几何 12 枚;44 另含 B 面) ──
  {
    value: 2,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /imageRemoveBtn:\s*\{[^}]*\btop:\s*2,/,
    otherAnchor: /imageRemoveBtn/,
    why: 'A 图片预览删除角标:小程序预览行在 InputArea',
  },
  {
    value: 3,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /recordingWave:\s*\{[^}]*\bgap:\s*3,/,
    otherAnchor: /recordingWave/,
    why: 'A 录音波形:小程序本组件无录音态',
  },
  {
    value: 10,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /recordingOverlay:\s*\{[^}]*\bgap:\s*10,/,
    otherAnchor: /recordingOverlay/,
    why: 'A 录音覆盖层 gap / 输入行竖衬 / 死样式行高:小程序同行由行衬 0/10/5 表达',
  },
  {
    value: 18,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /const ICON_BUTTON_EMOJI_SIZE = 18\b/,
    otherAnchor: /ICON_BUTTON_EMOJI_SIZE/,
    why: 'A 旧模式 emoji 字号 / 录音波形高:小程序按钮一律矢量图标,无 emoji 文字行',
  },
  {
    value: 20,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /configEmoji:\s*\{[^}]*\blineHeight:\s*20,/,
    otherAnchor: /configEmoji/,
    why: 'A 旧模式配置钮/辅助行行高:小程序模型条没有配置钮',
  },
  {
    value: 24,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /size=\{24\}/,
    otherAnchor: /AddPanel/,
    why: 'A AddPanel 项图标:小程序同功能是内联图标卡,配对等 AddPanel 那一票',
  },
  {
    value: 28,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /const MODEL_BAR_HEIGHT = 28\b/,
    otherAnchor: /MODEL_BAR_HEIGHT/,
    why: 'A 模型条固定高 + 配置钮:小程序模型条无固定高、无配置旋钮',
  },
  {
    value: 36,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /const VOICE_BTN_SIZE = rnGeometry\.tapBox\b/,
    otherAnchor: /VOICE_BTN_SIZE/,
    why: 'A 语音/辅助钮命中方块:小程序本文件里没有这两枚方块(几何表已是单一源)',
  },
  {
    value: 44,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A/B',
    anchor: /const INPUT_MIN_HEIGHT = 44\b/,
    otherAnchor: /INPUT_MIN_HEIGHT/,
    why: 'A 旧模式 actions 按钮高 / 图标钮;同值 44 的输入行最小高对小程序默认输入(≈36)属 B',
  },
  {
    value: 48,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /const IMAGE_PREVIEW_SIZE = 48\b/,
    otherAnchor: /IMAGE_PREVIEW_SIZE/,
    why: 'A 图片预览盒:小程序预览行在 InputArea',
  },
  {
    value: 100,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'C',
    anchor: /const INPUT_MAX_HEIGHT = 100\b/,
    otherAnchor: /INPUT_MAX_HEIGHT/,
    why: 'C 多行输入生长上限;小程序输入框不设上限(自适应)',
  },
  {
    value: 200,
    dimension: 'geometry',
    owner: 'mobile-rn',
    kind: 'C',
    anchor: /maxWidth:\s*200,/,
    otherAnchor: /modelNameLabel/,
    why: 'C 模型名单行截断;小程序整行 flex 换行,无截断节点',
  },
  {
    value: 6,
    dimension: 'geometry',
    owner: 'miniapp-taro',
    kind: 'C',
    anchor: /padding:\s*'12rpx 0'/,
    otherAnchor: /'12rpx 0'/,
    why: 'C chip 纵向内衬 12rpx(=6) vs RN 固定高 TOGGLE_CHIP_HEIGHT=32,两端落屏高都约 32',
  },
  // ── 半径(RD 维 3 枚;RE 维 0 是"两侧无同名元素",不是"圆角已一致") ──
  {
    value: 8,
    dimension: 'radius',
    owner: 'miniapp-taro',
    kind: 'A',
    anchor: /borderRadius:\s*rnRadius\.lg,/,
    otherAnchor: /rnRadius\.lg/,
    why: 'A 图标卡圆角:RN 同功能走共享 AddPanel(另一枚组件)',
  },
  {
    value: 2,
    dimension: 'radius',
    owner: 'mobile-rn',
    kind: 'A',
    anchor: /borderRadius:\s*rnRadiusFor\.tiny,/,
    otherAnchor: /rnRadiusFor\.tiny/,
    why: 'A 录音波形条圆角:小程序本组件无录音层',
  },
  {
    value: 16,
    dimension: 'radius',
    owner: 'mobile-rn',
    kind: 'B',
    anchor: /const INPUT_BORDER_RADIUS = rnRadius\['2xl'\]/,
    otherAnchor: /rnRadius\['2xl'\]/,
    why: 'B 输入框/发送钮圆角 16 vs 小程序同元素 rounded-sm(4),产品裁决面',
  },
]

/** 返回问题清单(空 = 每条事实的出处仍在、对侧仍无该元素、类别合法)。 */
function oneSidedFactProblems(
  facts: ReadonlyArray<OneSidedFact>,
  srcs: Record<FamilyLeg, string>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const f of facts) {
    const key = `${f.dimension}:${f.value}`
    if (seen.has(key)) out.push(`${key} 在事实表里登记了两遍`)
    seen.add(key)
    const other: FamilyLeg = f.owner === 'miniapp-taro' ? 'mobile-rn' : 'miniapp-taro'
    if (!f.anchor.test(prepared(srcs[f.owner])))
      out.push(`${f.owner} 侧已找不到 ${f.value} 的出处 ⇒ 事实表过期(${f.why})`)
    if (f.otherAnchor.test(prepared(srcs[other])))
      out.push(`${other} 侧出现了 ${f.value} 的元素身份 ⇒ 该档已不是单端,归属表要重裁(${f.why})`)
    if (!/^[ABC](\/[ABC])?$/.test(f.kind)) out.push(`${f.value} 的归因类别 ${f.kind} 不是 A/B/C`)
  }
  return out
}

/** 台账锚点(只读):事实表的表长必须与它同批对账。 */
interface ParityBaseline {
  counts?: Record<string, number>
  radiusCounts?: Record<string, number>
  elementRadiusCounts?: Record<string, number>
}

const PARITY_BASELINE = JSON.parse(
  readFileSync(join(ROOT, 'scripts/cross-end-ui-parity-baseline.json'), 'utf8'),
) as ParityBaseline

describe('⑥ spec 档三分且逐档归属(两端直引 / 经 core 投影 / 仅小程序经 core)', () => {
  it('现态:15 枚导出档全部登记,交叉档两腿都在、单端档只在唯一渲染端', () => {
    expect(specTierNames(SPEC_SRC)).toHaveLength(SPEC_TIER_SCOPES.length)
    expect(
      tierScopeProblems({
        specSrc: SPEC_SRC,
        coreSrc: CORE_SRC,
        miniSrc: TARO_SRC,
        rnSrc: RN_SRC,
      }),
      'spec 档归属被破坏(新档未归因 / 单端档被补引用 / 幻影档)',
    ).toEqual([])
  })

  it('本锁有牙:RN 腿引用单端档 ⇒ 判据必须红', () => {
    const dirtyRn = `${RN_SRC}\nconst __probe = BOTTOM_ACTION_BAR_ICON_CARD_WIDTH_PX\n`
    expect(dirtyRn).not.toBe(RN_SRC)
    expect(
      tierScopeProblems({
        specSrc: SPEC_SRC,
        coreSrc: CORE_SRC,
        miniSrc: TARO_SRC,
        rnSrc: dirtyRn,
      }).length,
      '给单端档补引用后归属判据仍绿 ⇒ 锁拦不住"凑平"',
    ).toBeGreaterThan(0)
  })

  it('本锁有牙:凭空新增一枚无人消费的 spec 档 ⇒ 判据必须红(幻影档)', () => {
    const dirtySpec = `${SPEC_SRC}\nexport const BOTTOM_ACTION_BAR___PROBE_PHANTOM_PX = 7\n`
    expect(dirtySpec).not.toBe(SPEC_SRC)
    expect(
      tierScopeProblems({
        specSrc: dirtySpec,
        coreSrc: CORE_SRC,
        miniSrc: TARO_SRC,
        rnSrc: RN_SRC,
      }).length,
      '新增未归因的导出档后判据仍绿 ⇒ 导出面没人对账',
    ).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 腿摘掉一枚两端直引档 ⇒ 判据必须红', () => {
    const dirtyRn = RN_SRC.replaceAll('BOTTOM_ACTION_BAR_CONTROL_BOX_PX', '__gone__')
    expect(dirtyRn).not.toBe(RN_SRC)
    expect(
      tierScopeProblems({
        specSrc: SPEC_SRC,
        coreSrc: CORE_SRC,
        miniSrc: TARO_SRC,
        rnSrc: dirtyRn,
      }).length,
      'RN 腿退回自己的数字后判据仍绿 ⇒ 它只认"档名在不在 spec"',
    ).toBeGreaterThan(0)
  })
})

describe('⑦ 差异档事实表与台账同批对账(13 几何 + 3 半径)', () => {
  it('现态:每条事实出处仍在 owner 侧、对侧无该元素、表长与台账 counts 一致', () => {
    expect(
      oneSidedFactProblems(ONE_SIDED_FACTS, {
        'miniapp-taro': TARO_SRC,
        'mobile-rn': RN_SRC,
      }),
      '差异档归属与源码现状脱节(出处消失 / 对侧出现该元素)',
    ).toEqual([])
    const geometry = ONE_SIDED_FACTS.filter((f) => f.dimension === 'geometry')
    const radius = ONE_SIDED_FACTS.filter((f) => f.dimension === 'radius')
    expect(
      geometry.length,
      '几何事实表 ≠ 台账 counts.BottomActionBar ⇒ 台账/结论已漂开,必须同批重裁',
    ).toBe(PARITY_BASELINE.counts?.['BottomActionBar'])
    expect(
      radius.length,
      '半径事实表 ≠ 台账 radiusCounts.BottomActionBar ⇒ 台账/结论已漂开,必须同批重裁',
    ).toBe(PARITY_BASELINE.radiusCounts?.['BottomActionBar'])
    expect(
      PARITY_BASELINE.elementRadiusCounts?.['BottomActionBar'],
      'RE 维若不再为 0,本表缺一整维归属(两侧出现同名元素)',
    ).toBe(0)
    // 三类归属必须都在场(全 A 的"分类"没有信息量)
    expect([...new Set(ONE_SIDED_FACTS.map((f) => f.kind))].sort().join(',')).toBe('A,A/B,B,C')
  })

  it('本锁有牙:把单端元素名搬进对侧 ⇒ 判据必须红(补引用凑平)', () => {
    const dirtyMini = `${TARO_SRC}\nconst __probe = IMAGE_PREVIEW_SIZE\n`
    expect(dirtyMini).not.toBe(TARO_SRC)
    expect(
      oneSidedFactProblems(ONE_SIDED_FACTS, {
        'miniapp-taro': dirtyMini,
        'mobile-rn': RN_SRC,
      }).length,
      '对侧出现单端元素后判据仍绿 ⇒ 锁只认"值"，不认"元素身份"',
    ).toBeGreaterThan(0)
  })

  it('本锁有牙:owner 侧出处改值 ⇒ 判据必须红(事实表过期)', () => {
    const dirtyRn = RN_SRC.replace('const INPUT_MAX_HEIGHT = 100', 'const INPUT_MAX_HEIGHT = 101')
    expect(dirtyRn).not.toBe(RN_SRC)
    expect(
      oneSidedFactProblems(ONE_SIDED_FACTS, {
        'miniapp-taro': TARO_SRC,
        'mobile-rn': dirtyRn,
      }).length,
      '出处改值后判据仍绿 ⇒ 事实表只认端名、不认那一行还在不在',
    ).toBeGreaterThan(0)
  })
})

/* ─────────── ⑧ 两端落屏 px 现算相等(算式求值,不认字面名)─────────── */

/**
 * ⑥ 与门 128 都只认"档名还在不在两端":一端把 `toUnit(TIER)` 写成 `rpx(TIER)`
 * (小程序端按 rpx 解释 ⇒ 落屏只有一半)、或把 `TIER * 2` 塞进别名,档名仍在一处,
 * typecheck、⑥⑦ 与门 128 全绿,而屏幕上一端已经翻倍/减半 —— 这正是本票要拆的
 * "两端同值各写一份"的反面:档名同源而**落屏值分叉**,读数是看不出来的。
 * 本组把两端的取数算式各自折算成**逻辑 px** 再比,量纲错、倍数错当场红。
 *
 * 求值口径(与 InputArea 镜像测试同一把尺子):
 *  - `toUnit(x)` = x px(rpx(px × 2) 在 750 设计宽下渲染回 x px;RN 端恒等);
 *  - `rpx(n)`    = n / RPX_PER_PX px;
 *  - 裸数值/档名 = 该数值 px;
 *  - 含顶层 `+`/`-` 的算式 = 派生值(如 `lineHeight = 字号 + 4`),不计作该档的落屏取数;
 *  - 认不出的标识符 ⇒ **不可求值**(不猜值、不静默放行)。
 * 小程序端额外要求档名经 `toUnit(…)` 或经 core 的 `boxPx=`/`glyphPx=` —— 裸用会按 rpx 解释。
 */

/** spec 导出面里所有 `_PX` 数字档 —— ⑧ 的符号表与"档值"唯一真相(现读,不手抄)。 */
function specTierValues(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [k, v] of Object.entries(bottomActionBarSpec as Record<string, unknown>)) {
    if (/^BOTTOM_ACTION_BAR_[A-Z0-9_]+_PX$/.test(k) && typeof v === 'number') out.set(k, v)
  }
  return out
}

const TIER_VALUES = specTierValues()

/**
 * 小程序端 rpx 与逻辑 px 的换算系数 —— **现读**不写死:
 * 前提是小程序壳仍写着 `const toUnit = (px) => rpx(px * TARO_RPX_PER_PX)`,
 * 系数取自 design-tokens 的 `TARO_RPX_PER_PX`;任一处失效 ⇒ 抛错(宁红不静默按 2 折算)。
 */
function taroRpxPerPx(): number {
  const mini = stripComments(TARO_SRC)
  if (!/const\s+toUnit\s*=\s*\(px:\s*number\)\s*=>\s*rpx\(px\s*\*\s*TARO_RPX_PER_PX\)/.test(mini)) {
    throw new Error('小程序端 toUnit 不再是 rpx(px * TARO_RPX_PER_PX)⇒ 本测试的换算前提已失效')
  }
  const geo = readFileSync(join(ROOT, 'packages/design-tokens/src/geometry.js'), 'utf8')
  const hit = geo.match(/\bTARO_RPX_PER_PX\s*=\s*(\d+(?:\.\d+)?)/)
  if (!hit) throw new Error('geometry.js 读不到 TARO_RPX_PER_PX ⇒ 本测试的换算前提已失效')
  return Number(hit[1])
}

const RPX_PER_PX = taroRpxPerPx()

type PxTok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

function pxTokens(text: string): PxTok[] {
  const out: PxTok[] = []
  const re = /\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[()+\-*/]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const t = m[0]
    if (/^\d/.test(t)) out.push({ k: 'num', v: Number(t) })
    else if (/^[A-Za-z_$]/.test(t)) out.push({ k: 'id', v: t })
    else out.push({ k: 'op', v: t })
  }
  return out
}

interface PxScope {
  readonly tiers: ReadonlyMap<string, number>
  /** 该端 `const NAME = <expr>` 表(别名链求值用) */
  readonly aliases: ReadonlyMap<string, string>
  readonly rpxPerPx: number
  readonly depth: number
}

/** 算式 → 逻辑 px;不可求值 ⇒ null。别名递归求值,深度上限 8(防环)。 */
function evalPx(text: string, scope: PxScope): number | null {
  const toks = pxTokens(text)
  if (toks.length === 0) return null
  let i = 0
  const peek = (): PxTok | undefined => toks[i]

  const factor = (): number | null => {
    const t = peek()
    if (t === undefined) return null
    if (t.k === 'num') {
      i += 1
      return t.v
    }
    if (t.k === 'op' && t.v === '-') {
      i += 1
      const v = factor()
      return v === null ? null : -v
    }
    if (t.k === 'op' && t.v === '(') {
      i += 1
      const v = expr()
      const close = peek()
      if (v === null || close === undefined || close.k !== 'op' || close.v !== ')') return null
      i += 1
      return v
    }
    if (t.k !== 'id') return null
    i += 1
    const next = peek()
    if (next !== undefined && next.k === 'op' && next.v === '(') {
      i += 1
      const arg = expr()
      const close = peek()
      if (arg === null || close === undefined || close.k !== 'op' || close.v !== ')') return null
      i += 1
      if (t.v === 'toUnit') return arg
      if (t.v === 'rpx') return arg / scope.rpxPerPx
      return null
    }
    const tier = scope.tiers.get(t.v)
    if (tier !== undefined) return tier
    const alias = scope.aliases.get(t.v)
    if (alias === undefined || scope.depth > 8) return null
    return evalPx(alias, { ...scope, depth: scope.depth + 1 })
  }

  const term = (): number | null => {
    let left = factor()
    if (left === null) return null
    for (;;) {
      const t = peek()
      if (t === undefined || t.k !== 'op' || (t.v !== '*' && t.v !== '/')) return left
      i += 1
      const right = factor()
      if (right === null) return null
      if (t.v === '*') left *= right
      else {
        if (right === 0) return null
        left /= right
      }
    }
  }

  const expr = (): number | null => {
    let left = term()
    if (left === null) return null
    for (;;) {
      const t = peek()
      if (t === undefined || t.k !== 'op' || (t.v !== '+' && t.v !== '-')) return left
      i += 1
      const right = term()
      if (right === null) return null
      left = t.v === '+' ? left + right : left - right
    }
  }

  const v = expr()
  return v !== null && i === toks.length ? v : null
}

/** 该端 `const NAME = <expr>` 表(`expr` 到行尾/分号为止;只收全大写常量名)。 */
function constAliases(src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^\n;]+)/g)) {
    out.set(m[1] as string, (m[2] ?? '').trim())
  }
  return out
}

/** 直接/间接引用该档的 const 名(别名链闭包;档名本身不在内)。 */
function aliasClosure(tier: string, aliases: ReadonlyMap<string, string>): string[] {
  const names = new Set<string>()
  let grew = true
  while (grew) {
    grew = false
    for (const [name, text] of aliases) {
      if (names.has(name)) continue
      if ([tier, ...names].some((n) => new RegExp(`\\b${n}\\b`).test(text))) {
        names.add(name)
        grew = true
      }
    }
  }
  return [...names]
}

const PX_WINDOW_CHAR = /[A-Za-z0-9_$.+\-*/()\s]/

interface PxSite {
  line: number
  /** 该取数点所在的完整算式片段(含 `toUnit(…)` / `rpx(…)` / `× 2` 之类改写) */
  text: string
  /** 算式片段之前的 24 个字符(判"是否经 core 的 boxPx=/glyphPx= 注入") */
  before: string
}

/** 窗口法定位取数点:以档名/别名为锚,向左右吞掉算术片段。 */
function pxSitesOf(src: string, name: string): PxSite[] {
  const out: PxSite[] = []
  const re = new RegExp(`\\b${name}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let s = m.index
    while (s > 0 && PX_WINDOW_CHAR.test(src.charAt(s - 1))) s -= 1
    let e = m.index + m[0].length
    while (e < src.length && PX_WINDOW_CHAR.test(src.charAt(e))) e += 1
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      text: src.slice(s, e).trim(),
      before: src.slice(Math.max(0, s - 24), s),
    })
  }
  return out
}

/** 顶层 `+`/`-` ⇒ 派生算式(字号 + 4 之类的行高),不是该档的落屏取数。 */
function isDerivedSum(text: string): boolean {
  let depth = 0
  for (let idx = 0; idx < text.length; idx += 1) {
    const c = text.charAt(idx)
    if (c === '(') depth += 1
    else if (c === ')') depth -= 1
    else if ((c === '+' || c === '-') && depth === 0 && idx > 0) return true
  }
  return false
}

interface PxTaking {
  px: number
  line: number
  text: string
  via: 'direct' | 'alias'
  /** 小程序端:经 `toUnit(…)` 或经 core 的 `boxPx=`/`glyphPx=`(RN 端无此概念,恒 true) */
  wrapped: boolean
}

function pxTakeingsOf(src: string, tier: string, scope: PxScope): PxTaking[] {
  const out: PxTaking[] = []
  const collect = (sites: ReadonlyArray<PxSite>, via: 'direct' | 'alias'): void => {
    for (const site of sites) {
      if (isDerivedSum(site.text)) continue
      const px = evalPx(site.text, scope)
      if (px === null) continue
      out.push({
        px,
        line: site.line,
        text: site.text,
        via,
        wrapped:
          via === 'alias' ||
          /toUnit\s*\(/.test(site.text) ||
          /(?:boxPx|glyphPx)\s*=\s*\{?\s*$/.test(site.before.trimEnd()),
      })
    }
  }
  collect(pxSitesOf(src, tier), 'direct')
  for (const name of aliasClosure(tier, scope.aliases)) collect(pxSitesOf(src, name), 'alias')
  return out
}

function pxScopeFor(src: string): PxScope {
  return {
    tiers: TIER_VALUES,
    aliases: constAliases(prepared(src)),
    rpxPerPx: RPX_PER_PX,
    depth: 0,
  }
}

/** 返回问题清单(空 = 两端对每条两端直引档的落屏逻辑 px 一致且等于 spec 现值)。 */
function pxParityProblems(opts: {
  tiers: ReadonlyArray<string>
  miniSrc: string
  rnSrc: string
}): string[] {
  const out: string[] = []
  // 取数点必须扫**判定面**(剥注释 → 去 import):否则头注里点名的档、import 清单里的档名
  // 都会被当成取数点(实测:import 行被读成"裸用档名")。
  const miniSrc = prepared(opts.miniSrc)
  const rnSrc = prepared(opts.rnSrc)
  const miniScope = pxScopeFor(opts.miniSrc)
  const rnScope = pxScopeFor(opts.rnSrc)
  for (const tier of opts.tiers) {
    const want = TIER_VALUES.get(tier)
    if (want === undefined) {
      out.push(`${tier} 已不在 spec 导出面(档被删/改名)⇒ 两端 px 对账无从取真值`)
      continue
    }
    const mini = pxTakeingsOf(miniSrc, tier, miniScope)
    const rn = pxTakeingsOf(rnSrc, tier, rnScope)
    if (mini.length === 0) out.push(`小程序腿没有任何可求值取数点引用 ${tier} ⇒ 两端同值档少了一半`)
    if (rn.length === 0) out.push(`RN 腿没有任何可求值取数点引用 ${tier} ⇒ 两端同值档少了一半`)
    for (const t of mini) {
      if (t.px !== want) {
        out.push(`小程序 ${tier} 落屏 ${t.px}px ≠ spec ${want}px(第 ${t.line} 行「${t.text}」)`)
      } else if (!t.wrapped) {
        out.push(
          `小程序 ${tier} 裸用档名(未 toUnit / 未经 core 的 boxPx|glyphPx)⇒ 端上按 rpx 解释为 ${want / RPX_PER_PX}px(第 ${t.line} 行「${t.text}」)`,
        )
      }
    }
    for (const t of rn) {
      if (t.px !== want) {
        out.push(`RN ${tier} 落屏 ${t.px}px ≠ spec ${want}px(第 ${t.line} 行「${t.text}」)`)
      }
    }
  }
  return out
}

/** ⑧ 的射程 = 归属表里"两端直引"的那一组(单端档/经 core 投影档没有两条腿可比)。 */
const BOTH_LEG_TIERS = SPEC_TIER_SCOPES.filter((row) => row.scope === 'both-legs').map(
  (row) => row.tier,
)

describe('⑧ 两端落屏 px 现算相等(算式求值,不认字面名)', () => {
  it('现态:两端直引档在两端折成同一个逻辑 px,且等于 spec 现值', () => {
    expect(
      BOTH_LEG_TIERS.length,
      '归属表里没有"两端直引"档 ⇒ ⑧ 射程为空(空转尺子)',
    ).toBeGreaterThan(0)
    expect(
      pxParityProblems({ tiers: BOTH_LEG_TIERS, miniSrc: TARO_SRC, rnSrc: RN_SRC }),
      '两端对同一枚档的落屏逻辑 px 不一致(量纲/倍数/档错位)',
    ).toEqual([])
  })

  it('本锁有牙:小程序端把 toUnit 换成 rpx(档名还在,单位折错)⇒ 判据必须红', () => {
    const dirtyMini = TARO_SRC.replace(
      'fontSize: toUnit(BOTTOM_ACTION_BAR_CHIP_FONT_PX)',
      'fontSize: rpx(BOTTOM_ACTION_BAR_CHIP_FONT_PX)',
    )
    expect(dirtyMini).not.toBe(TARO_SRC)
    expect(
      pxParityProblems({ tiers: BOTH_LEG_TIERS, miniSrc: dirtyMini, rnSrc: RN_SRC }).length,
      '一端落屏减半而判据仍绿 ⇒ 它只认档名在不在,不认换算',
    ).toBeGreaterThan(0)
  })

  it('本锁有牙:小程序端裸用档名(忘 toUnit)⇒ 判据必须红', () => {
    const dirtyMini = TARO_SRC.replace(
      'fontSize: toUnit(BOTTOM_ACTION_BAR_CHIP_FONT_PX)',
      'fontSize: BOTTOM_ACTION_BAR_CHIP_FONT_PX',
    )
    expect(dirtyMini).not.toBe(TARO_SRC)
    expect(
      pxParityProblems({ tiers: BOTH_LEG_TIERS, miniSrc: dirtyMini, rnSrc: RN_SRC }).length,
      '档名裸用后落屏按 rpx 解释为一半,判据仍绿 ⇒ 单价量纲无人判',
    ).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 端把别名放大(TIER * 2)⇒ 判据必须红', () => {
    const dirtyRn = RN_SRC.replace(
      'const TOGGLE_CHIP_FONT_SIZE = BOTTOM_ACTION_BAR_CHIP_FONT_PX',
      'const TOGGLE_CHIP_FONT_SIZE = BOTTOM_ACTION_BAR_CHIP_FONT_PX * 2',
    )
    expect(dirtyRn).not.toBe(RN_SRC)
    expect(
      pxParityProblems({ tiers: BOTH_LEG_TIERS, miniSrc: TARO_SRC, rnSrc: dirtyRn }).length,
      '一端放大一倍而判据仍绿 ⇒ 算式求值没跟上别名',
    ).toBeGreaterThan(0)
  })
})
