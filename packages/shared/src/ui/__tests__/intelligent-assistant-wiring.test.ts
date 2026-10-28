// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IntelligentAssistant「跨端档位一致性」契约(O02 票④,IntelligentAssistant 族)。
 *
 * 与门 128 的分工(与 `input-area-wiring.test.ts` 同一范式):门 128 判的是**两端取值集合的差**
 * (某一档只在一端出现),它**看不见"两端同值但各写一份"** —— 后者才是"改一端不带着另一端走"。
 * 本族逐条归因的现读结论是 **0 处**(见 `intelligent-assistant-spec` 头注 O02 段),所以本测试钉的是
 * **归属**:谁为让 diffCount 变小而往单端档的另一端补引用、谁把 owner 端的真实取数点删掉,都会红。
 *
 *  ① **登记面与现状对账**:共用档清单是**真相源**(不从源码反推:反推出来的集合会跟着现状缩,
 *     某端删了引用就退出被测范围 ⇒ 静默放行)。每枚必须仍从 spec 导出、两端都真引用,且
 *     现状两端都在用的档必须全部登记(漏登记 ⇒ 红)。
 *  ② **两端共用档落屏同值(表达式现算)**:小程序 `toUnit(x)` = x px、`rpx(n)` = n/RPX px,
 *     RN 裸值 = px;窗口法吞掉整段算式,`T * 2` 这类改写会被算出来而不是只看"档名两边都在"。
 *  ③ **端内不得有第二份真相(块级反向锁)**:同一最内层块里既引档、又出现与档同值的裸字面量
 *     (含 `rpx(…)` / `toUnit(…)` 写法) ⇒ 红。
 *  ④ **本锁有牙**:用改坏的源码回喂同一把尺子,断言必须红(缺这一半就是空转的尺子)。
 *  ⑤ **单端档归属表**:9 枚单端档各自只许在登记的那一端有取数点(补引用 = 凑平,必须红)。
 *  ⑥ **导出面全覆盖**:每一枚导出档必须登记在两张表之一,且必须有真消费方 ——
 *     "spec 导出、两条腿都不取数"的幻影档 = 造好没装车(AGENTS §0.9),红。
 *
 * 判据一律**源码级** readFileSync + 剥注释:两端组件不在本包的被检程序里,import 它们会把
 * RN / Taro 的编译约束带进 shared 的 tsc(与 input-area-wiring 同口径)。
 * 只吃两端 `.tsx`(与门 128 同名配对同口径):`.ia-robot` 的 `margin-right: 20rpx` 与
 * `@keyframes` 的 `-6rpx` 留在 `.css` 里,不进本测试射程(覆盖面事实见 spec 头注,不是豁免)。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as iaSpec from '../intelligent-assistant-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数(定长 `../../..` 一旦文件搬家就
 * 静默指向别处,把"耦合已断"报成"文件读不到")。找不到就抛 —— 取材前提没了不许退化成跳过。
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

/** 两端各自的 IntelligentAssistant 腿(守门 128 在册配对的两条腿文件)。 */
const LEGS = [
  { name: 'miniapp-taro', file: 'apps/miniapp-taro/src/components/IntelligentAssistant.tsx' },
  { name: 'mobile-rn', file: 'apps/mobile-rn/src/components/IntelligentAssistant.tsx' },
] as const

type LegName = (typeof LEGS)[number]['name']

/**
 * 跨端共用档清单 —— 本测试的**真相源**。
 *
 * 只登记"两端同值且共用同一枚常数"的档:改 spec 一处,两端同时生效。清单写死在此,不用
 * "两端交集"反推 —— 反推会在某一端删引用时**跟着缩**,尺子自己把被测对象缩没了。
 */
const CROSS_END_TIERS = [
  'IA_MARGIN_PX',
  'IA_PADDING_PX',
  'IA_GREETING_FONT_PX',
  'IA_SUBTITLE_FONT_PX',
  'IA_TOKEN_FONT_PX',
  'IA_RECHARGE_FONT_PX',
  'IA_TEXT_GAP_PX',
  'IA_TOKEN_ROW_GAP_PX',
  'IA_RECHARGE_HIT_PX',
  'IA_GREETING_TOP_PX',
] as const

/**
 * 两端共用、但不是度量档的那一枚(字符串字重):② 的算式求值对它不适用,
 * 由 ⑫ 单独钉"两端都真引用同一枚导出"。
 */
const CROSS_END_WEIGHT_TIER = 'IA_HEADING_FONT_WEIGHT'

/**
 * 单端档归属表 —— 本族"两端不一样"的 9 枚具名档各自只许在哪一端出现
 * (枚数与现读口径见 spec 头注 O02 段:门 128 点名 8 枚 + 负值档 1 枚)。
 *
 * 为什么要一张**机器钉住的账**:门 128 的 diffCount 只报"这一档只在一端出现",它说不出那是
 * "另一端根本没有这个元素"(事实)还是"本该同值却各写一份"(缺陷)。这张表把判词写死:
 * 谁往"另一端"补一个取数点(典型动机 = 让 diffCount 变小),这里就红;反过来 owner 那侧
 * 的真实取数点被删(元素误删 / 退化回裸数字),>0 断言也会红。
 *
 * 三类归属(与 spec 头注 O02 段逐条对应):
 *  A 一端根本没有该元素(往另一端补引用 = 往屏幕上加一个不存在的节点);
 *  B 同一元素两端按已裁决的变体契约取不同档 —— 本族 **0 枚**(11 枚共用档已全部同值);
 *  C 同槽位留白,两端各由自身机制决定(量纲/机制不同,不是同一个量的两条写法)。
 * RN 的胶囊圆角 4(`rnRadius.sm`)不是 spec 具名档(圆角走 `radius.js` 单一源),故不在本表。
 */
const SINGLE_END_TIERS: ReadonlyArray<{ tier: string; owner: LegName; why: string }> = [
  // ── A 一端根本没有该元素 ──
  {
    tier: 'IA_ROBOT_ICON_INK_PX',
    owner: 'miniapp-taro',
    why: 'A 小程序行内矢量;RN 同一位置是 absolute 位图装饰(不同媒介)',
  },
  { tier: 'IA_ROBOT_DECOR_W_PX', owner: 'mobile-rn', why: 'A RN 位图装饰布局盒;小程序无装饰层' },
  { tier: 'IA_ROBOT_DECOR_H_PX', owner: 'mobile-rn', why: 'A 同上:装饰布局盒高度' },
  {
    tier: 'IA_ROBOT_DECOR_TOP_PX',
    owner: 'mobile-rn',
    why: 'A 同上:负值 top,门 128 几何读数不含负值档',
  },
  { tier: 'IA_ROBOT_DECOR_RIGHT_PX', owner: 'mobile-rn', why: 'A 同上:贴卡右上方的 right' },
  {
    tier: 'IA_RECHARGE_CAPSULE_PAD_X_PX',
    owner: 'mobile-rn',
    why: 'A RN 实底胶囊可见内衬;小程序是纯文字链,无胶囊本体',
  },
  {
    tier: 'IA_RECHARGE_CAPSULE_PAD_Y_PX',
    owner: 'mobile-rn',
    why: 'A 同上:胶囊上下内衬',
  },
  // ── C 同槽位留白,两端各由自身机制决定 ──
  {
    tier: 'IA_TEXT_INDENT_PX',
    owner: 'mobile-rn',
    why: 'C 避让 absolute 装饰;小程序靠行内矢量 + CSS margin-right 10 撑出左缘',
  },
  {
    tier: 'IA_RECHARGE_GAP_PX',
    owner: 'mobile-rn',
    why: 'C RN 值行左聚拢的固定间距;小程序 .ia-token-row 用 space-between 动态决定',
  },
]

/**
 * 几何槽位白名单 —— 只有这些属性名上的裸字面量算"尺寸真相"。
 * 白名单之外(flex / zIndex / opacity / 颜色 …)不参与第二份真相判定:判进去是"归因过宽"。
 */
const GEOMETRY_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginVertical',
  'marginHorizontal',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingVertical',
  'paddingHorizontal',
  'gap',
  'rowGap',
  'columnGap',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'borderWidth',
  'borderRadius',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
])

/**
 * 剥注释但**保留字符串内容** —— 剥字符串会把 `className="ia-card"` 一起抹掉(判据失明),
 * 留注释会把说明性文字(含历史数字)喂进判据(本族 spec 头注逐字写着"32 / 107 / 110")。
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

/**
 * 去掉 import 语句(import 块里的档名是"已接线"的声明,**不是取数点**)。
 * 若把 import 里的档名算成取数点,两端"都引用了"这条正向对照会**恒真**。
 */
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

/**
 * 把字符串内容涂成空格(保留引号与行数)—— 让**字面量扫描**看不见字符串里的数字与档名,
 * 同时不破坏大括号配平。
 */
function maskStrings(src: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    if (quote !== '') {
      if (c === '\\') {
        out += '  '
        i += 1
        continue
      }
      if (c === quote) {
        quote = ''
        out += c
        continue
      }
      out += c === '\n' ? '\n' : ' '
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      continue
    }
    out += c
  }
  return out
}

/** 一端用于判定的源码:剥注释 → 去 import → 涂字符串。 */
function prepare(src: string): string {
  return maskStrings(stripImportLines(stripComments(src)))
}

const LEG_SRC = Object.fromEntries(
  LEGS.map((l) => [l.name, prepare(readFileSync(join(ROOT, l.file), 'utf8'))]),
) as Record<LegName, string>

/**
 * spec 导出面里所有 `_PX` 数字档 —— 算式求值时的符号表,以及"档值"的唯一真相。
 * 现读,不手抄:手抄的表在新增档后会静默过期 ⇒ 判据变成"两倍误差也能过"的空转尺子。
 */
function specTierValues(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [k, v] of Object.entries(iaSpec as Record<string, unknown>)) {
    if (/^[A-Z][A-Z0-9_]*_PX$/.test(k) && typeof v === 'number') out.set(k, v)
  }
  return out
}

const TIER_VALUES = specTierValues()

/** spec 全部导出档(含非度量档),供 ⑩ 的登记面/导出面对账。 */
function allSpecExports(): string[] {
  return Object.keys(iaSpec)
    .filter((k) => /^IA_[A-Z0-9_]+$/.test(k))
    .sort()
}

/**
 * 小程序端 `toUnit` 的换算系数(rpx/px)。**现读**自两端源码与 design-tokens,不在本文件写死 2:
 * 换算系数变了而本测试还按 2 折算,断言就变成"两倍误差也能过"的空转尺子。
 */
function taroRpxPerPx(): number {
  const mini = LEG_SRC['miniapp-taro']
  if (!/const\s+toUnit\s*=\s*\(px:\s*number\)\s*=>\s*rpx\(px\s*\*\s*TARO_RPX_PER_PX\)/.test(mini)) {
    throw new Error('小程序端 toUnit 不再是 rpx(px * TARO_RPX_PER_PX)⇒ 本测试的换算前提已失效')
  }
  const geo = readFileSync(join(ROOT, 'packages/design-tokens/src/geometry.js'), 'utf8')
  const hit = geo.match(/\bTARO_RPX_PER_PX\s*=\s*(\d+(?:\.\d+)?)/)
  if (!hit) throw new Error('geometry.js 读不到 TARO_RPX_PER_PX ⇒ 本测试的换算前提已失效')
  return Number(hit[1])
}

const RPX_PER_PX = taroRpxPerPx()

/* ───────────────────────── 表达式求值(逻辑 px 口径) ───────────────────────── */

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
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

/**
 * 极简算式求值器:数值、spec 档名、`toUnit(…)` / `rpx(…)`、括号与 `+ - * /`。
 * 认不出的标识符 ⇒ 返回 null(**不可求值**),绝不猜一个值。
 *
 * 量纲约定(全部折算到**逻辑 px**):`toUnit(x)` = x px;`rpx(n)` = n / RPX_PER_PX px;
 * 裸数值 = 该数值 px(RN dp / 小程序 style 数值)。
 */
class Expr {
  private i = 0

  constructor(
    private readonly toks: Tok[],
    private readonly rpxPerPx: number,
  ) {}

  parse(): number | null {
    const v = this.expr()
    if (v === null) return null
    return this.i === this.toks.length ? v : null
  }

  private peek(): Tok | undefined {
    return this.toks[this.i]
  }

  private expr(): number | null {
    let left = this.term()
    if (left === null) return null
    for (;;) {
      const t = this.peek()
      if (!t || t.k !== 'op' || (t.v !== '+' && t.v !== '-')) return left
      this.i += 1
      const right = this.term()
      if (right === null) return null
      left = t.v === '+' ? left + right : left - right
    }
  }

  private term(): number | null {
    let left = this.factor()
    if (left === null) return null
    for (;;) {
      const t = this.peek()
      if (!t || t.k !== 'op' || (t.v !== '*' && t.v !== '/')) return left
      this.i += 1
      const right = this.factor()
      if (right === null) return null
      if (t.v === '*') left = left * right
      else {
        if (right === 0) return null
        left = left / right
      }
    }
  }

  private factor(): number | null {
    const t = this.peek()
    if (!t) return null
    if (t.k === 'num') {
      this.i += 1
      return t.v
    }
    if (t.k === 'op' && t.v === '-') {
      this.i += 1
      const v = this.factor()
      return v === null ? null : -v
    }
    if (t.k === 'op' && t.v === '(') {
      this.i += 1
      const v = this.expr()
      const close = this.peek()
      if (v === null || !close || close.k !== 'op' || close.v !== ')') return null
      this.i += 1
      return v
    }
    if (t.k === 'id') {
      this.i += 1
      const next = this.peek()
      if (next && next.k === 'op' && next.v === '(') {
        this.i += 1
        const arg = this.expr()
        const close = this.peek()
        if (arg === null || !close || close.k !== 'op' || close.v !== ')') return null
        this.i += 1
        if (t.v === 'toUnit') return arg
        if (t.v === 'rpx') return arg / this.rpxPerPx
        return null
      }
      const v = TIER_VALUES.get(t.v)
      return v === undefined ? null : v
    }
    return null
  }
}

/** 求一个算式片段的逻辑 px 值;不可求值 ⇒ null。 */
function evalExpr(text: string, rpxPerPx: number): number | null {
  const toks = tokenize(text)
  if (!toks.length) return null
  return new Expr(toks, rpxPerPx).parse()
}

/** 算式片段里可能出现的字符(窗口法的边界集合)。 */
const ARITH_CHAR = /[A-Za-z0-9_$.+\-*/()\s]/

interface Usage {
  /** 1 基行号 */
  line: number
  /** 该取数点所在的算式片段 */
  window: string
}

/**
 * 窗口法定位取数点:以档名为锚,向左右吞掉算术片段。
 * 于是 `toUnit(…)` / `rpx(…)` 包装与 `* 2` 之类改写能被算出来,而不是只比"档名在不在"。
 */
function usagesOf(src: string, tier: string): Usage[] {
  const out: Usage[] = []
  const re = new RegExp(`\\b${tier}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let s = m.index
    while (s > 0 && ARITH_CHAR.test(src.charAt(s - 1))) s -= 1
    let e = m.index + m[0].length
    while (e < src.length && ARITH_CHAR.test(src.charAt(e))) e += 1
    out.push({ line: src.slice(0, m.index).split('\n').length, window: src.slice(s, e) })
  }
  return out
}

interface Taking {
  px: number
  line: number
}

function takeingsOf(
  src: string,
  tier: string,
  rpxPerPx: number,
): { takeings: Taking[]; sites: Usage[] } {
  const sites = usagesOf(src, tier)
  const takeings: Taking[] = []
  for (const site of sites) {
    const px = evalExpr(site.window, rpxPerPx)
    if (px !== null) takeings.push({ px, line: site.line })
  }
  return { takeings, sites }
}

/** 一档两端取值是否一致 + 各自是否真引用 —— 判据核心。 */
function tierParityProblems(
  tier: string,
  miniSrc: string,
  rnSrc: string,
  rpxPerPx: number,
): { problems: string[]; miniPx: number[]; rnPx: number[] } {
  const problems: string[] = []
  const mini = takeingsOf(miniSrc, tier, rpxPerPx)
  const rn = takeingsOf(rnSrc, tier, rpxPerPx)
  if (!mini.sites.length) {
    problems.push(`小程序端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
  if (!rn.sites.length) {
    problems.push(`RN 端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
  if (!mini.takeings.length && mini.sites.length) {
    problems.push(`小程序端对 ${tier} 的取数点全部不可求值 ⇒ 本测试对该档失明`)
  }
  if (!rn.takeings.length && rn.sites.length) {
    problems.push(`RN 端对 ${tier} 的取数点全部不可求值 ⇒ 本测试对该档失明`)
  }
  const miniPx = [...new Set(mini.takeings.map((t) => t.px))]
  const rnPx = [...new Set(rn.takeings.map((t) => t.px))]
  if (miniPx.length > 1) {
    problems.push(`小程序端对 ${tier} 取到了多个值 ${miniPx.join('/')} ⇒ 同一档名身不自洽`)
  }
  if (rnPx.length > 1) {
    problems.push(`RN 端对 ${tier} 取到了多个值 ${rnPx.join('/')} ⇒ 同一档名身不自洽`)
  }
  if (miniPx.length === 1 && rnPx.length === 1 && miniPx[0] !== rnPx[0]) {
    problems.push(`${tier} 两端取值不同:小程序 ${miniPx[0]}px vs RN ${rnPx[0]}px`)
  }
  const specPx = TIER_VALUES.get(tier)
  if (specPx !== undefined && miniPx.length === 1 && miniPx[0] !== specPx) {
    problems.push(`${tier} 小程序端落屏 ${miniPx[0]}px ≠ spec 档值 ${specPx}px ⇒ 档被改写`)
  }
  if (specPx !== undefined && rnPx.length === 1 && rnPx[0] !== specPx) {
    problems.push(`${tier} RN 端落屏 ${rnPx[0]}px ≠ spec 档值 ${specPx}px ⇒ 档被改写`)
  }
  return { problems, miniPx, rnPx }
}

/* ───────────────────── 块级反向锁:端内第二份真相 ───────────────────── */

interface LevelHit {
  tiers: { name: string; px: number; line: number }[]
  /** 几何槽位上的裸字面量(已折算到逻辑 px) */
  lits: { px: number; line: number; key: string }[]
}

/**
 * 块级扫描:同一个**最内层块**里既引用了档 T、又出现与 T 同值的裸字面量 ⇒ 第二份真相。
 * 限定最内层块是**归因受控**的关键:跨块/跨元素的巧合同值是常态(不同控件同尺寸),
 * 扫全端会把别的元素误伤。
 *
 * 字面量口径:裸数值 = px;`rpx(N)` = N / RPX_PER_PX;`toUnit(N)` = N;
 * 档名本身是引用(记进 tiers);只有几何槽位白名单上的属性参与。
 */
function doubleTruthProblems(src: string, side: string, rpxPerPx: number): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const levels: (LevelHit | undefined)[] = []
  let depth = 0
  let line = 1
  /** 当前层里"最近一个几何槽位的键名" */
  let key: string | null = null
  /** 刚读到 `:` ⇒ 下一个值若为裸数字,算作该键的值 */
  let expectValue = false

  const level = (): LevelHit | undefined => levels[depth]

  for (let p = 0; p < src.length; p += 1) {
    const c = src.charAt(p)
    if (c === '\n') {
      line += 1
      expectValue = false
      continue
    }
    if (c === '{') {
      depth += 1
      levels[depth] = { tiers: [], lits: [] }
      key = null
      expectValue = false
      continue
    }
    if (c === '}') {
      const hit = levels[depth]
      if (hit) {
        for (const tier of hit.tiers) {
          for (const lit of hit.lits) {
            if (lit.px !== tier.px) continue
            const dedupe = `${tier.name}|${lit.px}|${lit.line}`
            if (seen.has(dedupe)) continue
            seen.add(dedupe)
            problems.push(
              `${side} L${lit.line}:同一块内已引档 ${tier.name}(${tier.px}px),` +
                `${lit.key} 却又写了同值裸字面量 ${lit.px}px ⇒ 第二份真相`,
            )
          }
        }
      }
      levels[depth] = undefined
      depth = Math.max(0, depth - 1)
      key = null
      expectValue = false
      continue
    }
    const hit = level()
    if (!hit) continue
    if (/\s/.test(c)) continue
    // 标识符
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(p))
      if (!m) continue
      const name = m[0]
      const rest = src.slice(p + name.length)
      if (name === 'rpx' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg) {
          if (expectValue && key && GEOMETRY_KEYS.has(key)) {
            hit.lits.push({ px: Number(arg[1]) / rpxPerPx, line, key })
          }
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      if (name === 'toUnit' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg) {
          if (expectValue && key && GEOMETRY_KEYS.has(key)) {
            hit.lits.push({ px: Number(arg[1]), line, key })
          }
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      const px = TIER_VALUES.get(name)
      if (px !== undefined) hit.tiers.push({ name, px, line })
      // 键名判定:**连冒号一起吃掉**,否则那个 `:` 会被下面的兜底分支当成"非键字符",
      // 把刚记住的 key/expectValue 清掉 ⇒ 键后面的裸数字永远记不上账(锁失明)。
      const after = /^\s*:/.exec(rest)
      if (after) {
        key = GEOMETRY_KEYS.has(name) ? name : null
        expectValue = true
        p += name.length + after[0].length - 1
        continue
      }
      key = null
      expectValue = false
      p += name.length - 1
      continue
    }
    // 数值
    if (/[0-9]/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(p))
      if (!m) continue
      if (expectValue && key && GEOMETRY_KEYS.has(key)) {
        hit.lits.push({ px: Number(m[0]), line, key })
      }
      expectValue = false
      p += m[0].length - 1
      continue
    }
    key = null
    expectValue = false
  }
  return problems
}

/** 两端"都在用"的档集合(取数点口径,import 不算)。 */
function tiersUsedByBoth(miniSrc: string, rnSrc: string): string[] {
  const out: string[] = []
  for (const name of TIER_VALUES.keys()) {
    if (usagesOf(miniSrc, name).length > 0 && usagesOf(rnSrc, name).length > 0) out.push(name)
  }
  return out.sort()
}

/** 单端档归属判据:返回问题清单(空 = 每枚档只在登记的那一端有取数点)。 */
function singleEndProblems(srcs: Record<LegName, string>): string[] {
  const problems: string[] = []
  for (const { tier, owner, why } of SINGLE_END_TIERS) {
    if (!TIER_VALUES.has(tier)) {
      problems.push(`${tier} 已不在 spec 导出面(档被删/改名)⇒ 归属表过期;${why}`)
      continue
    }
    const other: LegName = owner === 'miniapp-taro' ? 'mobile-rn' : 'miniapp-taro'
    if (usagesOf(srcs[owner], tier).length === 0)
      problems.push(`${owner} 不再消费 ${tier} ⇒ 真实取数点丢了(${why})`)
    if (usagesOf(srcs[other], tier).length > 0)
      problems.push(`${other} 也引用了 ${tier} ⇒ 给单端补引用凑平,不是收敛(${why})`)
  }
  return problems
}

/** 幻影档判据:导出档必须在两条腿之一有真取数点(import 不算)。 */
function phantomTierProblems(opts: {
  legSrcs: Record<LegName, string>
  specExports: string[]
}): string[] {
  const problems: string[] = []
  for (const tier of opts.specExports) {
    const legs = (Object.keys(opts.legSrcs) as LegName[]).filter(
      (leg) => usagesOf(opts.legSrcs[leg], tier).length > 0,
    )
    if (legs.length === 0) {
      problems.push(
        `${tier} 从 spec 导出却没有任何消费方(两条腿都无取数点)⇒ 幻影档:` +
          `接上真实取数点,或把档删掉;只在注释/台账里宣称"已收成"不算装车(AGENTS §0.9)`,
      )
    }
  }
  return problems
}

/** 登记面判据:每一枚导出档必须落在"共用表 / 字重档 / 单端表"之一。 */
function unregisteredExports(exports: string[]): string[] {
  const registered = new Set<string>([
    ...CROSS_END_TIERS,
    CROSS_END_WEIGHT_TIER,
    ...SINGLE_END_TIERS.map((s) => s.tier),
  ])
  return exports.filter((t) => !registered.has(t))
}

describe('IntelligentAssistant 跨端档位一致性(O02 票④)', () => {
  it('① 登记面与现状对账:共用档仍从 spec 导出、两端真引用、现状共用档全部登记', () => {
    for (const tier of CROSS_END_TIERS) {
      expect(
        TIER_VALUES.has(tier),
        `${tier} 已不在 spec 导出面 ⇒ 清单过期(档被删或改名),请同步本清单`,
      ).toBe(true)
      for (const leg of LEGS) {
        expect(
          usagesOf(LEG_SRC[leg.name], tier).length,
          `${leg.file} 不再引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`,
        ).toBeGreaterThan(0)
      }
    }
    // 字重档不是度量档,单独钉"两端都真取数"(② 的算式求值对它不适用)
    for (const leg of LEGS) {
      expect(
        usagesOf(LEG_SRC[leg.name], CROSS_END_WEIGHT_TIER).length,
        `${leg.file} 不再引用 ${CROSS_END_WEIGHT_TIER} ⇒ 字重档脱线`,
      ).toBeGreaterThan(0)
    }
    const both = tiersUsedByBoth(LEG_SRC['miniapp-taro'], LEG_SRC['mobile-rn'])
    const unregistered = both.filter((t) => !(CROSS_END_TIERS as readonly string[]).includes(t))
    expect(
      unregistered,
      `现状两端都在用的档未登记进 CROSS_END_TIERS:${unregistered.join(',')} ⇒ 新增共用档必须进清单,否则少测一档`,
    ).toEqual([])
  })

  it('② 两端共用的每一枚档,两端落屏的逻辑 px 相等(算式现算,不认字面名)', () => {
    for (const tier of CROSS_END_TIERS) {
      const { problems } = tierParityProblems(
        tier,
        LEG_SRC['miniapp-taro'],
        LEG_SRC['mobile-rn'],
        RPX_PER_PX,
      )
      expect(problems, `${tier} 两端取值不一致`).toEqual([])
    }
  })

  it('③ 端内不得有第二份真相:块级反向锁', () => {
    for (const leg of LEGS) {
      expect(
        doubleTruthProblems(LEG_SRC[leg.name], leg.name, RPX_PER_PX),
        `${leg.file} 上有"同一块内既引档又写同值裸字面量"的第二份真相`,
      ).toEqual([])
    }
  })

  it('④ 本锁有牙:一端把共用档放大(TIER * 2)⇒ 取值一致性判据必须红', () => {
    const tier = 'IA_MARGIN_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /marginHorizontal:\s*IA_MARGIN_PX,/,
      'marginHorizontal: IA_MARGIN_PX * 2,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(problems.length, '把档放大 2 倍后取值一致性判据仍绿 ⇒ 判据没在比值').toBeGreaterThan(0)
  })

  it('⑤ 本锁有牙:一端把共用档退回裸数字(各写一份)⇒ 脱线判据必须红', () => {
    const tier = 'IA_PADDING_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(/padding:\s*IA_PADDING_PX,/, 'padding: 12,')
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(
      problems.length,
      '一端退回裸数字后取值一致性判据仍绿 ⇒ 判据只认"名字在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑥ 本锁有牙:块内混入同值裸字面量 ⇒ 块级反向锁必须红(端内第二份真相)', () => {
    const dirtyMini = LEG_SRC['miniapp-taro'].replace(
      /marginTop:\s*toUnit\(IA_TEXT_GAP_PX\),/,
      'marginTop: toUnit(IA_TEXT_GAP_PX),\n  lineHeight: 12,',
    )
    expect(dirtyMini).not.toBe(LEG_SRC['miniapp-taro'])
    const problems = doubleTruthProblems(dirtyMini, 'miniapp-taro', RPX_PER_PX)
    expect(problems.length, '块内混入同值裸字面量后反向锁仍绿 ⇒ 锁没生效').toBeGreaterThan(0)
  })

  it('⑦ 本锁有牙:小程序单槽位退回 rpx(同值)写法 ⇒ 端内第二份真相必须红', () => {
    // 这一例就是本族收编前的真实形态:同一块里 margin / padding 都写 `rpx(16)`(= 8px)。
    // 只把 padding 退回去、margin 仍走共享档(8)⇒ 同块内"档引用 + 同值 rpx 字面量"并存。
    const dirtyMini = LEG_SRC['miniapp-taro'].replace(
      /padding:\s*toUnit\(IA_PADDING_PX\),/,
      'padding: rpx(16),',
    )
    expect(dirtyMini).not.toBe(LEG_SRC['miniapp-taro'])
    const problems = doubleTruthProblems(dirtyMini, 'miniapp-taro', RPX_PER_PX)
    expect(
      problems.length,
      '小程序端单槽位退回 rpx(16) 后反向锁仍绿 ⇒ 锁认不出"rpx 字面量也是同值裸真相"',
    ).toBeGreaterThan(0)
  })

  it('⑧ 单端档归属表:每枚只在登记的那一端有取数点(另一端补引用 = 凑平,必须红)', () => {
    expect(SINGLE_END_TIERS.length, '归属表缩水 ⇒ 这条尺子少测了档').toBeGreaterThanOrEqual(9)
    expect(
      singleEndProblems(LEG_SRC),
      '单端档归属被破坏(要么真实取数点丢了,要么有人往另一端补引用凑平)',
    ).toEqual([])
  })

  it('⑨ 本锁有牙:两端各做一次变异 ⇒ ⑧ 必须红', () => {
    // 变异一:往"另一端"补一个取数点 —— 本票明令禁止的"给单端补数字凑平"。
    const tier = 'IA_ROBOT_DECOR_W_PX'
    const padded: Record<LegName, string> = {
      ...LEG_SRC,
      'miniapp-taro': `${LEG_SRC['miniapp-taro']}\nconst __probe = { width: ${tier} }\n`,
    }
    expect(padded['miniapp-taro']).not.toBe(LEG_SRC['miniapp-taro'])
    expect(
      singleEndProblems(padded).length,
      '另一端补引用后归属判据仍绿 ⇒ 锁拦不住"凑平"',
    ).toBeGreaterThan(0)

    // 变异二:把 owner 那一端的真实取数点删掉(元素被误删 / 退化回裸数字)。
    const rnTier = 'IA_TEXT_INDENT_PX'
    const stripped: Record<LegName, string> = {
      ...LEG_SRC,
      'mobile-rn': LEG_SRC['mobile-rn'].replaceAll(rnTier, '__gone__'),
    }
    expect(stripped['mobile-rn']).not.toBe(LEG_SRC['mobile-rn'])
    expect(
      singleEndProblems(stripped).length,
      'owner 端取数点被删后归属判据仍绿 ⇒ 锁只认"另一侧没有",不认"这一侧还在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑩ 导出面全覆盖:每一枚导出档都登记且有真消费方(幻影档 = 造好没装车 ⇒ 红)', () => {
    const exports = allSpecExports()
    expect(exports.length, 'spec 导出面读空 ⇒ 本用例在测一个不存在的东西').toBeGreaterThanOrEqual(
      19,
    )
    expect(
      unregisteredExports(exports),
      'spec 导出了未登记的档 ⇒ 共用表/单端表都不是真相源,新增档必须先归类再进表',
    ).toEqual([])
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, specExports: exports }),
      '存在无消费方的导出档(AGENTS §0.9 造好没装车 = 没有)',
    ).toEqual([])
  })

  it('⑪ 本锁有牙:凭空加一枚导出 / 摘掉唯一消费腿 ⇒ ⑩ 必须红', () => {
    const exports = allSpecExports()

    // 变异一:凭空新增一枚"从 spec 导出、两条腿都不取数"的档(用永远不会被真接上的合成名)。
    const phantom = 'IA___PROBE_PHANTOM_PX'
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, specExports: [...exports, phantom] }).length,
      '凭空加一枚无人引用的档后幻影判据仍绿 ⇒ 导出面没人对账',
    ).toBeGreaterThan(0)
    expect(
      unregisteredExports([...exports, phantom]).length,
      '凭空加一枚未登记档后登记面判据仍绿 ⇒ 新增导出会静默少测',
    ).toBeGreaterThan(0)

    // 变异二:摘掉**唯一**消费腿的取数点 ⇒ 该档退出真实使用(§12f:失效的表现永远是安静)。
    const onlyRnTier = 'IA_ROBOT_DECOR_W_PX'
    const stripped: Record<LegName, string> = {
      ...LEG_SRC,
      'mobile-rn': LEG_SRC['mobile-rn'].replaceAll(onlyRnTier, '__gone__'),
    }
    expect(usagesOf(stripped['mobile-rn'], onlyRnTier).length).toEqual(0)
    expect(
      phantomTierProblems({ legSrcs: stripped, specExports: exports }).length,
      '摘掉唯一消费方的取数点后幻影判据仍绿 ⇒ 它其实只看了 import 面',
    ).toBeGreaterThan(0)
  })

  it('⑫ 字重档:两端取的是同一枚导出,且 spec 值仍是非空字重串', () => {
    const value = (iaSpec as Record<string, unknown>)[CROSS_END_WEIGHT_TIER]
    expect(typeof value, `${CROSS_END_WEIGHT_TIER} 不是字符串档 ⇒ 消费端会静默失效`).toBe('string')
    expect(String(value).length).toBeGreaterThan(0)
    for (const leg of LEGS) {
      expect(
        usagesOf(LEG_SRC[leg.name], CROSS_END_WEIGHT_TIER).length,
        `${leg.file} 不再引用 ${CROSS_END_WEIGHT_TIER} ⇒ 两端字重各写一份`,
      ).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
