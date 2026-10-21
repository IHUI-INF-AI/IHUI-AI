// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BackChevron「一份源 + 两端注入」接线契约的测试(O81 票③第一例)。
 *
 * 这个文件钉五组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① 共享核心的平台纯度 —— 核心里出现 react-native / @tarojs import,一端 tsc 就会把它
 *     拉进被检程序(根桶事故同型);而"只在注释里禁止"拦不住任何东西;
 *  ② 核心行为(几何 / 按压 / 字号 / 透传)—— 注入 capturing 原语直调函数,不渲染:
 *     墨迹 = round(档位 × 注入倍率)、pressed 恒定 0.6、调用方 style 原样透传;
 *  ③ RN 壳接线 —— 五件原语(Pressable/View/ChevronLeft/useFontMultiplier/单位换算)在壳里,
 *     pressed 落在子 View 的**数组**样式上(守门 131:函数形态 style 会被 cssInterop 整份吃掉),
 *     壳不重复取尺寸档(真相源只有核心);
 *  ④ Taro 壳接线 + hoverClass 同值 —— 'opacity-60' 与 BACK_CHEVRON_PRESSED_OPACITY 的
 *     对应关系由本条判据对账(60/100 === 0.6),不靠注释口头同值;
 *  ⑤ props 形态不回退 —— 两端壳的导出面与 props 字段逐字在位 ⇒ 134 + 7 个调用点零改动。
 * 每条判据都是**源码级**(readFileSync + 剥注释):两端壳不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc —— 那正是本票要拆掉的东西。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ReactElement } from 'react'

import { describe, expect, it } from 'vitest'

import {
  BackChevronCore,
  type BackChevronGlyphProps,
  type BackChevronPlatform,
  type BackChevronPressableProps,
} from '../back-chevron-core'
import {
  BACK_CHEVRON_PRESSED_OPACITY,
  backChevronBoxStyle,
  backChevronGlyphPx,
} from '../back-chevron-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数 —— 本文件搬家或 vitest 换解析根时,
 * 定长 `../../..` 会静默指向别处(实测同型:colorful-loader 第一版少爬一层,ENOENT 把
 * "耦合已断"报成"文件读不到")。找不到就抛:那是"这条测试的取材前提没了",不许退化成跳过。
 */
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

const CORE_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/back-chevron-core.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/app/src/components/BackChevron.tsx'), 'utf8')
const TARO_SRC = readFileSync(
  join(ROOT, 'apps/miniapp-taro/src/components/BackChevron.tsx'),
  'utf8',
)

/**
 * 几何档现读:不 import(避免 dist 陈旧时测试跟着说谎),也不在判据里抄第二份字面值。
 * `tapBox` = 命中方块边长,`glyphMd` = 图标墨迹边长。取值依据写在 geometry.js 头注里
 * (含"为什么移动端不取 web 顶栏的 14px")—— 本测试只核"核心真的走了真相源"。
 */
function geometryPx(step: 'tapBox' | 'glyphMd'): number {
  const src = readFileSync(join(ROOT, 'packages/design-tokens/src/geometry.js'), 'utf8')
  const hit = src.match(new RegExp(`\\b${step}\\s*:\\s*(\\d+(?:\\.\\d+)?)`))
  if (!hit) throw new Error(`geometry.js 读不到 ${step} ⇒ 本测试的耦合前提已失效`)
  const [, raw = ''] = hit
  const px = Number(raw)
  if (!Number.isFinite(px)) throw new Error(`geometry.js 的 ${step} 不是有限数: ${raw}`)
  return px
}

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="opacity-60"`
 * 一起抹掉(判据失明),留注释会把说明性文字喂进判据(核心头注里逐字写着
 * "禁止 import 'react-native'",不剥就会被自己的说明判红)。
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
  const allowed = new Set(['react', './back-chevron-spec'])
  for (const s of sources) {
    if (!allowed.has(s)) out.push(`核心 import 了白名单外模块: ${s}`)
  }
  return out
}

/** 尺寸三件套:真相源只有共享核心,壳里再 import 一份就是"端内既定档"回潮。 */
const SPEC_EXPORTS = ['backChevronBoxStyle', 'backChevronGlyphPx', 'BACK_CHEVRON_PRESSED_OPACITY']

function specReFetchedIn(code: string, side: string): string[] {
  return SPEC_EXPORTS.filter((name) => new RegExp(`\\b${name}\\b`).test(code)).map(
    (name) => `${side} 壳重复取数 ${name}(档位唯一真相源是共享核心,壳只注入原语)`,
  )
}

/** RN 壳接线判据:走核心 + 五件原语注入 + pressed 数组落点 + props 形态 + 双导出。 */
function rnWiringProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui['"]/.test(code)) out.push('RN 壳未从 @ihui/shared/ui 引入核心')
  if (!/<BackChevronCore[\s/>]/.test(code))
    out.push('RN 壳没有渲染 <BackChevronCore>(接线形状回退)')
  const pressableAt = code.indexOf('<Pressable')
  if (pressableAt < 0) {
    out.push('RN 壳未渲染 <Pressable> 原语')
  } else {
    // 守门 131 立项那一型:Pressable 注册过 cssInterop,style= 落在开标签上会被静默整份吃掉
    const open = code.slice(pressableAt, code.indexOf('>', pressableAt))
    if (/style=/.test(open))
      out.push('RN 壳 Pressable 开标签带了 style=(cssInterop 会整份静默丢失)')
  }
  if (!/style=\{\[/.test(code)) out.push('RN 壳子 View 样式不是数组形态(pressed 无处落栈)')
  if (!/from\s+['"]lucide-react-native['"]/.test(code) || !/<ChevronLeft[\s/>]/.test(code)) {
    out.push('RN 壳未注入 lucide-react-native ChevronLeft 字形(守门 102 的矢量出口)')
  }
  if (!/from\s+['"]\.\/MoreLink['"]/.test(code) || !code.includes('useFontMultiplier')) {
    out.push('RN 壳未注入 useFontMultiplier(./MoreLink,系统字号缩放通道)')
  }
  if (!/\btoUnit\s*:/.test(code)) out.push('RN 壳未注入 toUnit(盒子几何单位换算)')
  if (!/\bglyphUnit\s*:/.test(code)) out.push('RN 壳未注入 glyphUnit(墨迹单位换算)')
  out.push(...specReFetchedIn(code, 'RN'))
  const propsPatterns: Array<[RegExp, string]> = [
    [/onPress\?: \(\) => void/, 'onPress?: () => void'],
    [/\blabel: string/, 'label: string'],
    [/colorScheme: AppThemeMode/, 'colorScheme: AppThemeMode'],
    [/style\?: StyleProp<ViewStyle>/, 'style?: StyleProp<ViewStyle>'],
    [/testID\?: string/, 'testID?: string'],
  ]
  for (const [pattern, what] of propsPatterns) {
    if (!pattern.test(code)) out.push(`RN 壳 props 形态缺失: ${what}(调用点零改动的前提)`)
  }
  if (!/export\s+function\s+BackChevron\s*\(/.test(code))
    out.push('RN 壳丢了 named export function BackChevron')
  if (!/export\s+default\s+BackChevron/.test(code)) out.push('RN 壳丢了 default export')
  return out
}

/** Taro 壳的按压态类名抽档:`const HOVER_CLASS = 'opacity-NN'` ⇒ NN(读不出返回 null)。 */
function hoverOpacityPct(src: string): number | null {
  const code = stripComments(src)
  const hit = code.match(/const\s+HOVER_CLASS\s*=\s*'opacity-(\d+)'/)
  return hit ? Number(hit[1]) : null
}

/** Taro 壳接线判据:走核心 + 静态 hoverClass + chevron-left 矢量出口 + props 形态 + default 导出。 */
function taroWiringProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui['"]/.test(code))
    out.push('Taro 壳未从 @ihui/shared/ui 引入核心')
  if (!/<BackChevronCore[\s/>]/.test(code))
    out.push('Taro 壳没有渲染 <BackChevronCore>(接线形状回退)')
  if (!/from\s+['"]@tarojs\/components['"]/.test(code))
    out.push('Taro 壳未从 @tarojs/components 取 View 原语')
  if (!/<LineIcon[\s/>]/.test(code) || !/name="chevron-left"/.test(code)) {
    out.push('Taro 壳未注入 LineIcon name="chevron-left"(守门 102 的矢量出口)')
  }
  if (!/ariaRole="button"/.test(code)) out.push('Taro 壳无障碍角色缺失(ariaRole="button")')
  if (!/onClick=\{onActivate\}/.test(code)) out.push('Taro 壳激活动作未接线(onClick={onActivate})')
  if (!/hoverClass=\{HOVER_CLASS\}/.test(code)) {
    out.push('Taro 壳按压态未走静态 hoverClass={HOVER_CLASS}')
  }
  if (!/const\s+HOVER_CLASS\s*=\s*'opacity-60'/.test(code)) {
    out.push(
      "Taro 壳 HOVER_CLASS 不是静态字面量 'opacity-60'(模板串端内 Tailwind 生成器不产出规则)",
    )
  }
  if (!/\btoUnit\s*:/.test(code)) out.push('Taro 壳未注入 toUnit(rpx 串换算)')
  if (!/glyphUnit\s*:\s*\(px[^)]*\)\s*=>\s*px\s*\*\s*TARO_RPX_PER_PX/.test(code)) {
    out.push('Taro 壳 glyphUnit 未给 rpx 数值(LineIcon 的 size 收数值,它自己再按 H5/原生换算)')
  }
  if (!/useFontMultiplier\s*:\s*\(\)\s*=>\s*1/.test(code)) {
    out.push('Taro 壳字号倍率未注入恒 1(小程序端无系统字号缩放通道)')
  }
  out.push(...specReFetchedIn(code, 'Taro'))
  const propsPatterns: Array<[RegExp, string]> = [
    [/onTap\?: \(event: ITouchEvent\) => void/, 'onTap?: (event: ITouchEvent) => void'],
    [/className\?: string/, 'className?: string'],
    [/color\?: string/, 'color?: string'],
    [/style\?: CSSProperties/, 'style?: CSSProperties'],
  ]
  for (const [pattern, what] of propsPatterns) {
    if (!pattern.test(code)) out.push(`Taro 壳 props 形态缺失: ${what}(调用点零改动的前提)`)
  }
  if (!/export\s+default\s+function\s+BackChevron\s*\(/.test(code)) {
    out.push('Taro 壳 default export 形态回退(export default function BackChevron)')
  }
  return out
}

// ── ② 的行为面:注入 capturing 原语,直调核心函数(不渲染,jsdom 无关) ─────────────

/** 端事件类型的测试替身(RN 是 GestureResponderEvent、小程序是 ITouchEvent,核心只透传)。 */
interface FakeEvent {
  nativeEvent: { type: string }
}

/**
 * 直调核心构造 Pressable 元素(不渲染):`React.createElement` 不会同步调用组件函数,
 * 所以这里从返回的 `el.props` 读注入原语收到的入参 —— 这正是"接线形状"的契约面:
 * 核心把 onActivate / boxStyle / pressedStyle / 无障碍名 / 样式 / 钩子原样喂给 Pressable 元素,
 * 且子节点是注入的 Glyph 元素(等价"若 React 真的渲染时注入组件会收到的 props")。
 */
function CapturingPressable(
  _props: BackChevronPressableProps<number, Record<string, unknown>, FakeEvent>,
): null {
  return null
}

/** 字形原语:本组判据从 Pressable 收到的 children 上读 props,不需要它真被调用。 */
function StubGlyph(_props: BackChevronGlyphProps): null {
  return null
}

function makePlatform(
  multiplier: number,
  toUnit: (px: number) => number = (px) => px,
): BackChevronPlatform<number, Record<string, unknown>, FakeEvent> {
  return {
    toUnit,
    glyphUnit: (px) => px,
    useFontMultiplier: () => multiplier,
    Pressable: CapturingPressable,
    Glyph: StubGlyph,
  }
}

/** 核心构造出的 Pressable 元素入参(等价于"React 渲染时注入组件会收到的 props")。 */
type RenderedPressableProps = BackChevronPressableProps<number, Record<string, unknown>, FakeEvent>

/** 直调核心一次,返回构造出的元素树、传入的 onPress(透传判据要比引用同一性)、以及 Pressable 入参。 */
function renderCore(platform: BackChevronPlatform<number, Record<string, unknown>, FakeEvent>): {
  el: ReactElement
  onPress: (event: FakeEvent) => void
  seen: RenderedPressableProps
} {
  const onPress = (_event: FakeEvent): void => {}
  const el = BackChevronCore<number, Record<string, unknown>, FakeEvent>({
    platform,
    onPress,
    label: '返回',
    glyphColor: '#6b7280',
    style: { marginLeft: 4 },
    testID: 'back-chevron-test',
    className: 'nav-back',
  })
  if (el.type !== (platform.Pressable as ReactElement['type'])) {
    throw new Error('核心没有把渲染树交给注入的 Pressable 原语 ⇒ 接线已断')
  }
  const seen = el.props as RenderedPressableProps
  return { el, onPress, seen }
}

describe('① 共享核心的平台纯度', () => {
  it('现态:import 源只有 react(类型)与 ./back-chevron-spec,无 react-native / @tarojs', () => {
    expect(corePurityProblems(CORE_SRC)).toEqual([])
  })

  it('本锁有牙:核心被污染进 react-native ⇒ 纯度判据必须红', () => {
    const dirty = CORE_SRC.replace(
      "import type { ComponentType, ReactNode } from 'react'",
      "import { View } from 'react-native'",
    )
    expect(dirty).not.toBe(CORE_SRC) // 防"替换没发生、断言空转"
    expect(corePurityProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('② 核心行为:几何 / 按压 / 字号 / 透传(capturing 原语直调)', () => {
  it('盒子几何 = backChevronBoxStyle(toUnit),且 toUnit 真的被喂进去', () => {
    const identity = renderCore(makePlatform(1))
    expect(identity.seen.boxStyle).toEqual(backChevronBoxStyle((px: number) => px))
    expect(identity.seen.boxStyle.width).toBe(geometryPx('tapBox'))
    expect(identity.seen.boxStyle.height).toBe(geometryPx('tapBox'))
    expect(identity.seen.boxStyle.display).toBe('flex')
    expect(identity.seen.boxStyle.alignItems).toBe('center')
    expect(identity.seen.boxStyle.justifyContent).toBe('center')
    // 换算格注入双倍档 ⇒ 盒子必须跟着翻倍(证明核心没有绕过 toUnit 写死数字)
    const doubled = renderCore(makePlatform(1, (px) => px * 2))
    expect(doubled.seen.boxStyle.width).toBe(geometryPx('tapBox') * 2)
    expect(doubled.seen.boxStyle.height).toBe(geometryPx('tapBox') * 2)
  })

  it('按压态恒定供出 BACK_CHEVRON_PRESSED_OPACITY(0.6)', () => {
    const { seen } = renderCore(makePlatform(1))
    expect(seen.pressedStyle).toEqual({ opacity: BACK_CHEVRON_PRESSED_OPACITY })
    expect(BACK_CHEVRON_PRESSED_OPACITY).toBe(0.6)
  })

  it('墨迹边长 = round(backChevronGlyphPx() × 注入倍率),取整防亚像素', () => {
    const base = renderCore(makePlatform(1))
    const glyph = base.seen.children as ReactElement<BackChevronGlyphProps>
    expect(glyph.props.size).toBe(geometryPx('glyphMd'))
    expect(glyph.props.size).toBe(backChevronGlyphPx())
    // 1.4 是 RN useFontMultiplier 的上限:20 × 1.4 = 28 取整后仍是整数,
    // 若漏乘倍率这里会是 20、若不取整会是 28.000000000000004 之类
    const scaled = renderCore(makePlatform(1.4))
    const glyphScaled = scaled.seen.children as ReactElement<BackChevronGlyphProps>
    expect(glyphScaled.props.size).toBe(Math.round(geometryPx('glyphMd') * 1.4))
    expect(Number.isInteger(glyphScaled.props.size)).toBe(true)
    expect(glyph.props.color).toBe('#6b7280')
  })

  it('渲染树完全由注入原语拼出;动作/名称/样式/钩子原样透传', () => {
    const { el, onPress, seen } = renderCore(makePlatform(1))
    expect(el.type).toBe(CapturingPressable)
    const glyph = seen.children as ReactElement<BackChevronGlyphProps>
    expect(glyph.type).toBe(StubGlyph)
    expect(seen.onActivate).toBe(onPress)
    expect(seen.accessibilityLabel).toBe('返回')
    expect(seen.style).toEqual({ marginLeft: 4 })
    expect(seen.testID).toBe('back-chevron-test')
    expect(seen.className).toBe('nav-back')
  })
})

describe('③ RN 壳接线(壳只注入原语,不持有结构与档位)', () => {
  it('现态:五件原语注入 + pressed 数组落点 + props 形态 + 双导出', () => {
    expect(rnWiringProblems(RN_SRC)).toEqual([])
  })

  it('本锁有牙:壳回退成自渲染(<BackChevronCore → <View)⇒ 接线判据必须红', () => {
    const dirty = RN_SRC.replace('<BackChevronCore', '<View')
    expect(dirty).not.toBe(RN_SRC)
    expect(rnWiringProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('④ Taro 壳接线与按压档同值', () => {
  it('现态:核心 + 静态 hoverClass + chevron-left + props 形态 + default 导出', () => {
    expect(taroWiringProblems(TARO_SRC)).toEqual([])
  })

  it('hoverClass 与共享源同值:opacity-60 的 60/100 === BACK_CHEVRON_PRESSED_OPACITY', () => {
    const pct = hoverOpacityPct(TARO_SRC)
    if (pct === null)
      throw new Error("Taro 壳读不到静态 HOVER_CLASS = 'opacity-NN' ⇒ 同值对账前提失效")
    expect(pct / 100).toBe(BACK_CHEVRON_PRESSED_OPACITY)
  })

  it('本锁有牙:按压档改值(opacity-60 → opacity-50)⇒ 同值对账必须红', () => {
    const dirty = TARO_SRC.replace("'opacity-60'", "'opacity-50'")
    expect(dirty).not.toBe(TARO_SRC)
    const pct = hoverOpacityPct(dirty)
    if (pct === null) throw new Error('变异文本读不到 HOVER_CLASS ⇒ 本锁的变异手法已失效')
    expect(pct / 100).not.toBe(BACK_CHEVRON_PRESSED_OPACITY)
  })

  it('本锁有牙:hoverClass 模板串化 ⇒ 静态字面量判据必须红', () => {
    const dirty = TARO_SRC.replace(
      "const HOVER_CLASS = 'opacity-60'",
      'const HOVER_CLASS = `opacity-${60}`',
    )
    expect(dirty).not.toBe(TARO_SRC)
    expect(taroWiringProblems(dirty).length).toBeGreaterThan(0)
  })
})
