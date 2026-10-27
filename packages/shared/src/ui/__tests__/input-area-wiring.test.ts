// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * InputArea「跨端档位一致性」契约(O02 票④,InputArea 族)。
 *
 * 本测试与守门 128 的分工:门 128 判的是**两端取值集合的差**(某一档只在一端出现 ⇒ 分叉),
 * 它**看不见"两端同值但各写一份"** —— 那正是本票要拆的形态(改一端不带着另一端走)。
 * 所以这里补的是门 128 结构上补不了的那一维,并且**刻意不靠"两端此刻都引用了它"来圈定范围**:
 * 那样圈出来的范围会在某一端把引用删掉时**跟着缩**,尺子自己把被测对象缩没了 ⇒ 静默放行。
 *
 *  ① **登记面与现状对账**:本文件登记的"跨端共用档"清单是**真相源**(不是从源码反推的),
 *     三条对账保证它不会静默过期:清单里的档必须仍从 spec 导出、必须两端都真引用,
 *     且**现状两端都在用的档必须全部登记**(漏登记 ⇒ 红灯,不许静默少测一档)。
 *  ② **同档两端取值一致(表达式求值)**:把该档落到屏幕上的**逻辑 px** 在两端各自现算出来再比 ——
 *     小程序端 `toUnit(T)` = T px、`rpx(N)` = N/2 px,RN 端裸数值 = px。
 *     取数点按**窗口法**定位(以档名为锚向两侧吞掉算式片段),所以 `T * 2` 这类**改写**
 *     会被算成 40 而不是 20 —— 只比"档名两边都在"是恒真的空转尺子。
 *  ③ **端内不得有第二份真相(块级反向锁)**:同一个样式块里既引用了档 T、又出现与 T 同值的
 *     裸字面量 ⇒ 那一处尺寸有两个来源(改一端不带另一端走)。块级限定是**归因受控**的关键:
 *     全端扫裸数字会把别的元素(别的档、别的机制)误伤 —— 那是"归因过宽"。
 *  ④ **本锁有牙**:用"改坏的源码"回喂同一把尺子,断言它必须红 —— 缺这一半就是一条空转的尺子。
 *
 * 判据一律是**源码级** readFileSync + 剥注释:两端组件文件不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc(与 input-area-glyph-wiring 同口径)。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as inputAreaSpec from '../input-area-spec'

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

/** 两端各自的 InputArea 腿(守门 128 在册配对的两条腿文件)。 */
const LEGS = [
  { name: 'miniapp-taro', file: 'apps/miniapp-taro/src/components/InputArea.tsx' },
  { name: 'mobile-rn', file: 'apps/mobile-rn/src/components/InputArea.tsx' },
] as const

/**
 * 跨端共用档清单 —— 本测试的**真相源**。
 *
 * 为什么手写而不"从源码反推两端交集":反推出来的集合会**跟着现状缩** ——
 * 某一端把引用删了(退化回"各写一份裸数字"),交集随之少一枚,那条档就此退出被测范围,
 * 尺子自己把被测对象缩没了 ⇒ 静默放行。所以清单写死在此,并用三条对账把它钉住:
 * ① 每一枚仍从 spec 导出(档被删/改名 ⇒ 红灯);② 每一枚两端都真引用(某腿脱线 ⇒ 红灯);
 * ③ 现状两端都在用的档**必须全部登记**(漏登记 ⇒ 红灯,不许静默少测)。
 * 只登记**取值同档**的那些:两端同值且共用同一枚常数,改一端另一端自动生效。
 */
const CROSS_END_TIERS = [
  'INPUT_AREA_CONTROL_GLYPH_PX',
  'INPUT_AREA_ATTACHMENT_CLOSE_GLYPH_PX',
  'INPUT_AREA_DOC_NAME_STRIP_PX',
  'INPUT_AREA_EXPAND_BTN_BOX_PX',
  'INPUT_AREA_FANGDA_TOP_PX',
  'INPUT_AREA_GLYPH_MD_PX',
  'INPUT_AREA_THUMB_GLYPH_PX',
  'INPUT_AREA_VOICE_BTN_GAP_PX',
] as const

/**
 * 几何槽位白名单 —— 只有这些属性名上的裸字面量算"尺寸真相"。
 * 白名单之外(flex / zIndex / opacity / 事件参数 …)不参与第二份真相判定:
 * 那些不是尺寸,判进去是"归因过宽"。
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
 * 剥注释但**保留字符串内容** —— 剥字符串会把 `className="search-right"` 一起抹掉(判据失明),
 * 留注释会把说明性文字(含历史数字)喂进判据(本族 spec 头注逐字写着"收编前是 20 / rpx(40)")。
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
 * 逐行状态机:进 import 后一直吃到该 import 收尾(`from '…'` 那行),中间的档名列一并去掉 ——
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
 * 把字符串内容涂成空格(保留引号与行数)—— 让**字面量扫描**看不见字符串里的数字
 * (`placeholderStyle="font-size: 28rpx;"` 这类),同时不破坏大括号配平。
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

/**
 * 两端各自的**判定用源码**(剥注释 → 去 import → 涂字符串),按腿名索引。
 * 类型取自 `LEGS` 本身:写成 `Record<string, string>` 会让 `noUncheckedIndexedAccess`
 * 把每次索引都判成 `string | undefined`,逼出一堆无谓的断言噪音。
 */
type LegName = (typeof LEGS)[number]['name']

const LEG_SRC = Object.fromEntries(
  LEGS.map((l) => [l.name, prepare(readFileSync(join(ROOT, l.file), 'utf8'))]),
) as Record<LegName, string>

/**
 * spec 导出面里所有 `_PX` 数字档 —— 算式求值时的符号表,以及"档值"的唯一真相。
 * 现读,不手抄:手抄的表在新增档后会静默过期 ⇒ 判据变成"两倍误差也能过"的空转尺子。
 */
function specTierValues(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [k, v] of Object.entries(inputAreaSpec as Record<string, unknown>)) {
    if (/^[A-Z][A-Z0-9_]*_PX$/.test(k) && typeof v === 'number') out.set(k, v)
  }
  return out
}

const TIER_VALUES = specTierValues()

/**
 * 小程序端 `toUnit` 的换算系数(rpx/px)。**现读**自两端源码,不在本文件写死 2:
 * 换算系数变了而本测试还按 2 折算,断言就变成"两倍误差也能过"的空转尺子。
 *
 * 取自 `const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)` 与 design-tokens 的
 * `TARO_RPX_PER_PX` 两处:小程序端必须**同时**用上这两个,否则 rpx 与逻辑 px 的关系就不是 2:1。
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
 * 极简算式求值器:支持数值、spec 档名、`toUnit(…)` / `rpx(…)`、括号与 `+ - * /`。
 * 认不出的标识符 ⇒ 返回 null(**不可求值**),绝不猜一个值。
 *
 * 量纲约定(全部折算到**逻辑 px**,两端同量纲才可比):
 *  - `toUnit(x)` = x px(rpx(px × 2) 在 750 设计宽下渲染回 x px)
 *  - `rpx(n)`    = n / RPX_PER_PX px
 *  - 裸数值      = 该数值 px(RN 端 dp / 小程序端 style 数值)
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
 * 吞到的是**这一处取数的完整算式**(含 `toUnit(…)` / `rpx(…)` 包装与 `* 2` 之类改写),
 * 于是"档被放大/缩小"能被算出来,而不是一律当成档值本身。
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

/** 某一端对某枚档的取数(折算到逻辑 px)。 */
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

/**
 * 一档两端取值是否一致 + 各自是否真引用 —— 判据核心。
 * @returns {{problems:string[], miniPx:number[], rnPx:number[]}} 问题列表;空 = 通过
 */
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
 *
 * 为什么限定"最内层块":同一块里的槽位属于**同一个控件/同一条样式**,
 * 那里再写一份同值字面量,就是"同一处尺寸有两个来源" ⇒ 改一端不带另一端走。
 * 反之,跨块/跨元素的巧合同值是常态(不同控件同尺寸),扫全端会把它们误伤 —— 那是"归因过宽"。
 *
 * 字面量口径:
 *  - 裸数值 → 该数值 px;
 *  - `rpx(N)` → N / RPX_PER_PX px(小程序端的 rpx 字面量);
 *  - `toUnit(N)` → N px(已是逻辑 px);
 *  - 档名本身是**引用**不是字面量,不参与判定;
 *  - 只有**几何槽位白名单**上的属性才参与(flex / zIndex / opacity 等不是尺寸)。
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
      // 是不是一个"键名"?(后面紧跟 `:`)—— 是则记住它,好让后面的裸数字归属到它。
      // **连冒号一起吃掉**:否则那个 `:` 会被下面的兜底分支当成"非键字符",
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

describe('InputArea 跨端档位一致性(O02 票④)', () => {
  it('① 登记面与现状对账:清单仍从 spec 导出、两端都真引用、现状共用档全部登记', () => {
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

  it('④ 本锁有牙:一端把档放大(TIER → TIER * 2)⇒ 取值一致性判据必须红', () => {
    const tier = 'INPUT_AREA_EXPAND_BTN_BOX_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /height:\s*INPUT_AREA_EXPAND_BTN_BOX_PX,/,
      'height: INPUT_AREA_EXPAND_BTN_BOX_PX * 2,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(problems.length, '把档放大 2 倍后取值一致性判据仍绿 ⇒ 判据没在比值').toBeGreaterThan(0)
  })

  it('⑤ 本锁有牙:某一端把引用改成裸数字(退回各写一份)⇒ 脱线判据必须红', () => {
    const tier = 'INPUT_AREA_EXPAND_BTN_BOX_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /width:\s*INPUT_AREA_EXPAND_BTN_BOX_PX,\s*\n\s*height:\s*INPUT_AREA_EXPAND_BTN_BOX_PX,/,
      'width: 20,\n    height: 20,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn, RPX_PER_PX)
    expect(
      problems.length,
      '一端退回裸数字后取值一致性判据仍绿 ⇒ 判据只认"名字在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑥ 本锁有牙:只把块内一个槽位改成裸数字 ⇒ 块级反向锁必须红(端内第二份真相)', () => {
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /width:\s*INPUT_AREA_EXPAND_BTN_BOX_PX,/,
      'width: 20,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const problems = doubleTruthProblems(dirtyRn, 'mobile-rn', RPX_PER_PX)
    expect(problems.length, '块内混入同值裸字面量后反向锁仍绿 ⇒ 锁没生效').toBeGreaterThan(0)
  })

  it('⑦ 本锁有牙:小程序端单槽位退回 rpx(40) 写法 ⇒ 端内第二份真相必须红', () => {
    // 这一例是**本票真实发生过的那次退化形态**(收编前小程序写 rpx(40)、RN 写裸 20):
    // 两端数值同档但各写一份 ⇒ 门 128 看不见(它只看"某一档是否只在一端出现")。
    // 只换**一格**(宽度退回收编前写法、高度仍走共享档)⇒ 同一块内同时出现
    // "档引用"与"同值裸字面量",正是第二份真相的形态;回喂同一把尺子必须红,
    // 否则"块级反向锁"只是一句口号。
    const dirtyMini = LEG_SRC['miniapp-taro'].replace(
      /width:\s*toUnit\(INPUT_AREA_EXPAND_BTN_BOX_PX\),/,
      'width: rpx(40),',
    )
    expect(dirtyMini).not.toBe(LEG_SRC['miniapp-taro'])
    const problems = doubleTruthProblems(dirtyMini, 'miniapp-taro', RPX_PER_PX)
    expect(
      problems.length,
      '小程序端单槽位退回 rpx(40) 后反向锁仍绿 ⇒ 锁认不出"rpx 字面量也是同值裸真相"',
    ).toBeGreaterThan(0)
  })

  it('⑧ 本锁有牙:小程序端整枚档退出引用 ⇒ 脱线判据必须红(改一端不带另一端走)', () => {
    // 把小程序端**全部**取数点退回收编前写法(两处 search-right / search-suo 的 width+height),
    // 这一枚档在小程序端就彻底没有引用了 ⇒ 改 spec 档值不带小程序端走。
    const tier = 'INPUT_AREA_EXPAND_BTN_BOX_PX'
    const dirtyMini = LEG_SRC['miniapp-taro'].replace(
      /toUnit\(INPUT_AREA_EXPAND_BTN_BOX_PX\)/g,
      'rpx(40)',
    )
    expect(dirtyMini).not.toBe(LEG_SRC['miniapp-taro'])
    expect(
      usagesOf(dirtyMini, tier).length,
      '变异源里该档仍有引用 ⇒ 变异没生效,判据在测一个没发生过的场景',
    ).toEqual(0)
    const { problems } = tierParityProblems(tier, dirtyMini, LEG_SRC['mobile-rn'], RPX_PER_PX)
    expect(
      problems.length,
      '一端整枚档退出引用后取值一致性判据仍绿 ⇒ 判据只认"名字在不在"',
    ).toBeGreaterThan(0)
  })
})
