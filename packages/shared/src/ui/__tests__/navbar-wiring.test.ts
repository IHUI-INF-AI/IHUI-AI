// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NavBar「跨端档位一致性」契约(O02 票④,NavBar 族)。
 *
 * 与 InputArea 族同一副尺子(packages/shared/src/ui/__tests__/input-area-wiring.test.ts),分工也相同:
 * 守门 128 判的是**两端取值集合的差**,它看不见两件事 ——
 *  ① 两端同值却各写一份(改一端不带着另一端走);
 *  ② 某一档只在一端被引用时,那到底是"另一端根本没有这个元素"还是"另一端还没接线"。
 *    两者读数一模一样,判词只能靠一张**写死的归属表**(见 navbar-spec 头注 O02 段的 A/B/C)。
 *
 *  ① 登记面与现状对账:清单是真相源(不从源码反推 —— 反推的集合会跟着现状缩:某腿一脱线,
 *     那条档就自动退出射程 ⇒ 尺子把被测对象缩没了,静默放行)。
 *  ② 共用档两端落屏逻辑 px 相等:小程序 `toUnit(T)` = T px、`rpx(N)` = N/2 px、
 *     `T * TARO_RPX_PER_PX` 是喂给 Taro 组件的 rpx 数(= T px),RN 裸数值 = px。
 *     取数点按**窗口法**定位(以档名为锚吞掉算式片段),所以 `T * 2` 这类改写会被算出来。
 *  ③ 端内不得有第二份真相:同一块里既引档又写同值裸字面量 ⇒ 红(块级限定控归因)。
 *  ④ 单端档只在登记的那一端出现:另一端补引用 = 凑平(红);owner 侧取用消失 = 元素被误删(红)。
 *  ⑤ spec 导出面全覆盖:每枚导出必须有真消费方(AGENTS §0.9 造好没装车 = 没有)。
 *  ⑥ 上屏腿拓扑:骨架只经共享 core、恰好两条腿、packages/app 的 DOM 副本不是腿
 *     (本票实测它零消费者:全仓无 import、packages/app/src/index.ts 未导出)。
 *  ⑦ C 类机制档:z-index 两端各写一份但**必须同值** —— 类名通道无法由常量驱动(见 spec 头注),
 *     所以档留在端内,而同值这件事由本条机器比对,不靠散文。
 * 每条判据都配一枚"改坏的源码"反向自证 —— 缺这一半就是一条空转的尺子。
 *
 * 判据一律**源码级** readFileSync + 剥注释:两端组件不在本包的被检程序里,
 * import 它们会把 RN / Taro 的编译约束带进 shared 的 tsc(与 input-area-wiring 同口径);
 * 本文件也刻意不 import scripts/(测试不依赖守门实现)。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as navbarSpec from '../navbar-spec'

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

/** 两端各自的 NavBar 腿(守门 128 在册配对的两条腿文件)。 */
const LEGS = [
  { name: 'miniapp-taro', file: 'apps/miniapp-taro/src/components/NavBar.tsx' },
  { name: 'mobile-rn', file: 'apps/mobile-rn/src/components/NavBar.tsx' },
] as const

type LegName = (typeof LEGS)[number]['name']

/** 本族的骨架单一源 / 非腿副本 / 包出口 —— ⑥ 的取材点。 */
const CORE_FILE = 'packages/shared/src/ui/navbar-core.tsx'
const DEAD_COPY_FILE = 'packages/app/src/components/NavBar.tsx'
const APP_BARREL_FILE = 'packages/app/src/index.ts'
const GEOMETRY_FILE = 'packages/design-tokens/src/geometry.js'

/**
 * 跨端共用档清单 —— 本测试的**真相源**(7 枚;2026-10-28 现读,与 navbar-spec 头注 O02 段、
 * 守门 128 的 SL 维同一读数)。
 *
 * 为什么手写而不"从源码反推两端交集":反推出来的集合会**跟着现状缩** —— 某一端把引用删了
 * (退化回"各写一份裸数字"),交集随之少一枚,那条档就此退出被测范围 ⇒ 静默放行。
 * 所以清单写死在此,并用三条对账钉住:① 每枚仍从 spec 导出;② 每枚两端都真引用;
 * ③ 现状两端都在用的档**必须全部登记**(漏登记 ⇒ 红,不许静默少测一档)。
 */
const CROSS_END_TIERS = [
  'NAVBAR_SIDE_PADDING_PX',
  'NAVBAR_ACTION_GLYPH_PX',
  'NAVBAR_ACTION_LABEL_FONT_PX',
  'NAVBAR_ACTION_LABEL_MAX_WIDTH_PX',
  'NAVBAR_TITLE_FONT_PX',
  'NAVBAR_TITLE_MAX_WIDTH_PX',
  'NAVBAR_CENTER_MIN_WIDTH_PX',
] as const

/**
 * 单端档归属表 —— 本族"两端不一样"的 5 枚具名档各自只许在哪一端出现(O02 票④ 第 ④ 格,
 * 枚数 2026-10-28 现读 = 守门 128 的 `SL NavBar(5)`)。
 *
 * 为什么要一张**机器钉住的账**,而不是一段散文:
 *  - 守门 128 的 diffCount 只报"这一档只在一端出现",说不出那是"另一端没有这个元素"还是
 *    "本该同值却各写一份"。前者是事实,后者是缺陷 —— 两者读数一模一样。
 *  - 这张表把判词写死:谁往"另一端"补一个取数点(典型动机 = 让 diffCount 变小),这里就红。
 *    那正是本票明令禁止的「给单端补数字凑平」。
 *  - 反过来,若 owner 端把真实取数点删了(元素被误删/退化回裸数字),那一侧断言也会红。
 *
 * 5 枚全部属 A 类(一端根本没有该元素/该结构),逐条依据见 navbar-spec 头注 O02 段:
 * 本族 **0 枚 B**(已裁决的变体契约)、0 枚 C 类具名档(C 类只剩 z-index,转由本文件 ⑨ 判)。
 */
const SINGLE_END_TIERS: ReadonlyArray<{ tier: string; owner: LegName; why: string }> = [
  {
    tier: 'NAVBAR_ROW_HEIGHT_PX',
    owner: 'mobile-rn',
    why: 'A 小程序行高 = 微信胶囊实测 height + 8(平台量),RN 走本档 44',
  },
  {
    tier: 'NAVBAR_ROW_HEIGHT_SUBTITLE_PX',
    owner: 'mobile-rn',
    why: 'A 同上:小程序无 subtitle,双行档没有消费面',
  },
  {
    tier: 'NAVBAR_SIDE_PLACEHOLDER_PX',
    owner: 'mobile-rn',
    why: 'A 小程序居中走 absolute 悬浮钮 + justify-center,结构上无占位元素',
  },
  {
    tier: 'NAVBAR_SUBTITLE_FONT_PX',
    owner: 'mobile-rn',
    why: 'A 小程序 NavBarProps 无 subtitle 字段(全仓给小程序传 subtitle 的调用点 0 处)',
  },
  {
    tier: 'NAVBAR_SUBTITLE_MARGIN_TOP_PX',
    owner: 'mobile-rn',
    why: 'A 同上:小程序没有"主标题下方再一行"这层结构,无从给间距',
  },
]

/**
 * 登记在册的**派生取用**(不是档值本身,但仍是同一枚档的合法消费者)。
 *
 * 为什么需要这张表:窗口法会把 `T + 2` 算成"这一腿对 T 取到了 22",与 20 并成两个值 ⇒ 假红。
 * 但把派生一律放过就等于拆掉"改写检测"(`T * 2` 也会被放过)。所以派生必须**逐条登记**:
 * 登记表外的任何算式形态 ⇒ 红。判定要求 `tier`/`leg`/`expr` 三元逐字在位。
 */
const DERIVED_USAGES: ReadonlyArray<{ tier: string; leg: LegName; expr: string; why: string }> = [
  {
    tier: 'NAVBAR_ACTION_GLYPH_PX',
    leg: 'mobile-rn',
    expr: 'NAVBAR_ACTION_GLYPH_PX + 2',
    why: 'actionEmoji 的 lineHeight = 字形 + 2(纯 emoji 钮的行高补偿,不是另一份墨迹档)',
  },
]

/* ───────────────────────── 源码准备(剥注释 → 去 import → 涂字符串) ───────────────────────── */

/**
 * 剥注释但**保留字符串内容** —— 剥字符串会把 `className="z-[1001]"` 一起抹掉(⑨ 失明),
 * 留注释会把说明性文字(含历史数字)喂进判据(本族 spec 头注逐字写着"26px / 32px")。
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
 * 去掉 import 语句(import 块里的档名是"已接线"的**声明**,不是取数点)。
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
 * 把字符串内容涂成空格(保留引号与行数)—— 让**字面量扫描**看不见字符串里的数字,
 * 同时不破坏大括号配平。⑨ 的 z-index 判据要在涂之前从原文取,故不复用这一份。
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
 * 只剥注释、**保留字符串**的腿源 —— 给 ⑨ 的 z-index 判据用:
 * 小程序端那一档住在 `className="sticky … z-[1001]"` 这个字符串里,`prepare` 会把字符串涂白
 * ⇒ 用 LEG_SRC 取会读出"0 个值",把"判据失明"记成"两端都没写"(那正是本仓记过的失效型)。
 */
const LEG_CODE = Object.fromEntries(
  LEGS.map((l) => [l.name, stripComments(readFileSync(join(ROOT, l.file), 'utf8'))]),
) as Record<LegName, string>

/**
 * spec 导出面里所有 `_PX` 数字档 —— 算式求值时的符号表,以及"档值"的唯一真相。
 * 现读,不手抄:手抄的表在新增档后会静默过期 ⇒ 判据变成"两倍误差也能过"的空转尺子。
 */
function specTierValues(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [k, v] of Object.entries(navbarSpec as Record<string, unknown>)) {
    if (/^[A-Z][A-Z0-9_]*_PX$/.test(k) && typeof v === 'number') out.set(k, v)
  }
  return out
}

const TIER_VALUES = specTierValues()

/**
 * 小程序端 `toUnit` 的换算系数(rpx/px)。**现读**自两端源码,不在本文件写死 2:
 * 换算系数变了而本测试还按 2 折算,断言就变成"两倍误差也能过"的空转尺子。
 */
function taroRpxPerPx(): number {
  const mini = LEG_SRC['miniapp-taro']
  if (
    !/const\s+toUnit\s*=\s*\(logicalPx:\s*number\)\s*=>\s*rpx\(logicalPx\s*\*\s*TARO_RPX_PER_PX\)/.test(
      mini,
    )
  ) {
    throw new Error('小程序端 toUnit 不再是 rpx(px * TARO_RPX_PER_PX)⇒ 本测试的换算前提已失效')
  }
  const geo = readFileSync(join(ROOT, GEOMETRY_FILE), 'utf8')
  const hit = geo.match(/\bTARO_RPX_PER_PX\s*=\s*(\d+(?:\.\d+)?)/)
  if (!hit) throw new Error('geometry.js 读不到 TARO_RPX_PER_PX ⇒ 本测试的换算前提已失效')
  return Number(hit[1])
}

const RPX_PER_PX = taroRpxPerPx()

/* ───────────────────────── 取数点定位与算式求值(逻辑 px 口径) ───────────────────────── */

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

/** 极简算式求值器:数值 / spec 档名 / 括号 / `+ - * /`。认不出的标识符 ⇒ null(绝不猜值)。 */
function evalExpr(text: string): number | null {
  const toks = tokenize(text)
  let i = 0
  const peek = (): Tok | undefined => toks[i]
  const expr = (): number | null => {
    let left = term()
    if (left === null) return null
    for (;;) {
      const t = peek()
      if (!t || t.k !== 'op' || (t.v !== '+' && t.v !== '-')) return left
      i += 1
      const right = term()
      if (right === null) return null
      left = t.v === '+' ? left + right : left - right
    }
  }
  const term = (): number | null => {
    let left = factor()
    if (left === null) return null
    for (;;) {
      const t = peek()
      if (!t || t.k !== 'op' || (t.v !== '*' && t.v !== '/')) return left
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
  const factor = (): number | null => {
    const t = peek()
    if (!t) return null
    if (t.k === 'num') {
      i += 1
      return t.v
    }
    if (t.k === 'op' && t.v === '(') {
      i += 1
      const v = expr()
      const close = peek()
      if (v === null || !close || close.k !== 'op' || close.v !== ')') return null
      i += 1
      return v
    }
    if (t.k === 'id') {
      i += 1
      const v = TIER_VALUES.get(t.v)
      return v === undefined ? null : v
    }
    return null
  }
  const value = expr()
  if (value === null || i !== toks.length) return null
  return value
}

/**
 * 算式片段里可能出现的字符(窗口法边界集合)。
 * 与 input-area-wiring 的差别只有一处:**不含换行** —— 换行会让窗口吞进下一行语句的标识符
 * (`NAVBAR_X * TARO_RPX_PER_PX` 后面紧跟的 `const ACTION_BOX_STYLE` 会被算成表达式的一部分)。
 * 本族没有跨行算式,收窄是安全的;收窄后 `T * 2` 这类改写照样能被算出来。
 */
const ARITH_CHAR = /^[A-Za-z0-9_$.+\-*/()\t ]$/

interface Usage {
  /** 1 基行号 */
  line: number
  /** 该取数点所在的算式片段(已 trim) */
  window: string
}

function usagesOf(src: string, tier: string): Usage[] {
  const out: Usage[] = []
  const re = new RegExp(`\\b${tier}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let s = m.index
    while (s > 0 && ARITH_CHAR.test(src.charAt(s - 1))) s -= 1
    let e = m.index + m[0].length
    while (e < src.length && ARITH_CHAR.test(src.charAt(e))) e += 1
    out.push({ line: src.slice(0, m.index).split('\n').length, window: src.slice(s, e).trim() })
  }
  return out
}

type UsageKind = 'tier' | 'unit' | 'rpx' | 'rpxnum' | 'derived'

/**
 * 给一个取数窗口定性,并折算到**逻辑 px**:
 *  - `T`                       → 档值本身(RN 的 dp 与逻辑 px 1:1)
 *  - `toUnit(T)`               → T px(rpx(px × 2) 在 750 设计宽下渲染回 px)
 *  - `rpx(T)`                  → T / RPX_PER_PX px
 *  - `T * TARO_RPX_PER_PX`     → 喂给 Taro 组件的 rpx 数,落屏仍是 T px
 *  - 其余一律 `derived`(须在 DERIVED_USAGES 登记,否则红:那是"另一份算式",不是同一档取值)
 */
function classifyUsage(window: string): { kind: UsageKind; expr: string; px: number | null } {
  const toUnit = /^toUnit\((.+)\)$/.exec(window)
  if (toUnit && toUnit[1] !== undefined) {
    const inner = toUnit[1].trim()
    return { kind: 'unit', expr: inner, px: evalExpr(inner) }
  }
  const rpxCall = /^rpx\((.+)\)$/.exec(window)
  if (rpxCall && rpxCall[1] !== undefined) {
    const inner = rpxCall[1].trim()
    const v = evalExpr(inner)
    return { kind: 'rpx', expr: inner, px: v === null ? null : v / RPX_PER_PX }
  }
  const rpxNum = /^(.+?)\s*\*\s*TARO_RPX_PER_PX$/.exec(window)
  if (rpxNum && rpxNum[1] !== undefined) {
    const inner = rpxNum[1].trim()
    return { kind: 'rpxnum', expr: inner, px: evalExpr(inner) }
  }
  if (/^[A-Z][A-Z0-9_]*_PX$/.test(window))
    return { kind: 'tier', expr: window, px: evalExpr(window) }
  return { kind: 'derived', expr: window, px: evalExpr(window) }
}

/**
 * 一档两端取值是否一致 + 各自是否真引用 —— 判据核心。
 * @returns 问题列表;空 = 通过
 */
function tierParityProblems(
  tier: string,
  miniSrc: string,
  rnSrc: string,
): { problems: string[]; miniPx: number[]; rnPx: number[] } {
  const problems: string[] = []
  const take = (src: string, side: LegName) => {
    const px: number[] = []
    for (const u of usagesOf(src, tier)) {
      const c = classifyUsage(u.window)
      if (c.kind === 'derived') {
        const ok = DERIVED_USAGES.some(
          (d) => d.tier === tier && d.leg === side && d.expr === c.expr,
        )
        if (!ok)
          problems.push(`${side} L${u.line} 对 ${tier} 用的是未登记的算式「${u.window}」⇒ 档被改写`)
        continue
      }
      if (c.px === null) {
        problems.push(
          `${side} L${u.line} 对 ${tier} 的取数点不可求值「${u.window}」⇒ 本测试对该档失明`,
        )
        continue
      }
      px.push(c.px)
    }
    return px
  }
  const miniPx = [...new Set(take(miniSrc, 'miniapp-taro'))]
  const rnPx = [...new Set(take(rnSrc, 'mobile-rn'))]
  if (!usagesOf(miniSrc, tier).length) {
    problems.push(`小程序端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
  if (!usagesOf(rnSrc, tier).length) {
    problems.push(`RN 端没有任何取数点引用 ${tier} ⇒ 该腿脱线,改一端不带另一端走`)
  }
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

interface LevelHit {
  tiers: { name: string; px: number; line: number }[]
  lits: { px: number; line: number; key: string }[]
}

/**
 * 块级扫描:同一个**最内层块**里既引用了档 T、又出现与 T 同值的裸字面量 ⇒ 第二份真相。
 * 限定"最内层块"的理由与 input-area-wiring ③ 同:同一块 = 同一个控件/同一条样式,
 * 那里再写一份同值字面量就是"同一处尺寸两个来源";跨块巧合同值是常态,扫全端会误伤。
 */
function doubleTruthProblems(src: string, side: string, rpxPerPx: number): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const levels: (LevelHit | undefined)[] = []
  let depth = 0
  let line = 1
  let key: string | null = null
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
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(p))
      if (!m) continue
      const name = m[0]
      const rest = src.slice(p + name.length)
      if (name === 'rpx' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg && expectValue && key && GEOMETRY_KEYS.has(key)) {
          hit.lits.push({ px: Number(arg[1]) / rpxPerPx, line, key })
        }
        if (arg) {
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      if (name === 'toUnit' && /^\s*\(/.test(rest)) {
        const arg = /^\s*\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(rest)
        if (arg && expectValue && key && GEOMETRY_KEYS.has(key)) {
          hit.lits.push({ px: Number(arg[1]), line, key })
        }
        if (arg) {
          p += name.length + arg[0].length - 1
          expectValue = false
          continue
        }
      }
      const px = TIER_VALUES.get(name)
      if (px !== undefined) hit.tiers.push({ name, px, line })
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

/* ───────────────────────── 单端归属 / 幻影档 / 拓扑 ───────────────────────── */

/** 两端"都在用"的档集合(取数点口径,import 不算)。 */
function tiersUsedByBoth(miniSrc: string, rnSrc: string): string[] {
  const out: string[] = []
  for (const name of TIER_VALUES.keys()) {
    if (usagesOf(miniSrc, name).length > 0 && usagesOf(rnSrc, name).length > 0) out.push(name)
  }
  return out.sort()
}

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

/** spec 导出面的数字档名(幻影档判据的输入)。 */
function specTierNames(): string[] {
  return [...TIER_VALUES.keys()].sort()
}

/** 腿名 → 文件路径(幻影档判据按腿取数时用)。 */
const L_LEG_FILE: Record<LegName, string> = Object.fromEntries(
  LEGS.map((l) => [l.name, l.file]),
) as Record<LegName, string>

/**
 * 幻影档判据:返回问题清单(空 = 每一枚导出档都有真消费方)。
 * `read` 是给 ⑪ 变异留的注入点(默认现读磁盘),判据本身零复制 —— 取数点口径与 ①/⑦ 同一条。
 */
function phantomTierProblems(opts: {
  legSrcs: Record<LegName, string>
  tiers: string[]
  read?: (rel: string) => string
}): string[] {
  const { legSrcs, tiers } = opts
  const read =
    opts.read ?? ((rel: string): string => prepare(readFileSync(join(ROOT, rel), 'utf8')))
  const problems: string[] = []
  for (const tier of tiers) {
    if (!/^[A-Z][A-Z0-9_]*_PX$/.test(tier)) continue
    if (
      (tier === 'NAVBAR_ACTION_HEIGHT_PX' || tier === 'NAVBAR_ACTION_MIN_WIDTH_PX') &&
      (Object.keys(legSrcs) as LegName[]).every((leg) =>
        /navbarActionBoxStyle\s*\(/.test(legSrcs[leg]),
      )
    ) {
      continue
    }
    if (
      tier === 'NAVBAR_BACK_GLYPH_PX' &&
      (Object.keys(legSrcs) as LegName[]).every((leg) => /\bBackChevron\b/.test(legSrcs[leg]))
    ) {
      continue
    }
    const legs = (Object.keys(legSrcs) as LegName[]).filter(
      (leg) => usagesOf(legSrcs[leg], tier).length > 0,
    )
    if (legs.length > 0) continue
    problems.push(
      `${tier} 从 spec 导出却没有任何消费方(两条腿都无取数点)⇒ 幻影档:` +
        `接上真实取数点,或把档删掉;只在注释/台账里宣称"已收成"不算装车`,
    )
  }
  // 骨架函数与盒子出口同一条纪律:导出了就必须有人取数。
  if (typeof navbarSpec.navbarActionBoxStyle !== 'function')
    problems.push('navbarActionBoxStyle 不再是函数 ⇒ 两端盒子单一源被拆')
  else
    for (const leg of Object.keys(legSrcs) as LegName[])
      if (!/navbarActionBoxStyle\s*\(/.test(read(L_LEG_FILE[leg])))
        problems.push(`${leg} 不再调用 navbarActionBoxStyle ⇒ 侧钮盒子退回端内自持`)
  return problems
}

/**
 * 上屏腿拓扑判据:骨架只经共享 core、恰好两条腿、DOM 副本不是腿。
 * 立因:本族在 2026-09 曾有三份同名实现(NavBar / Carousel 即此型),门 128 的 RN 腿
 * "同名优先共享层"选到死副本后整对被剔除 ⇒ NavBar 在提交链上**从来没有被对账过**。
 * 本票实测 packages/app 那份仍零消费者,所以这里把它登记成"非腿"并钉住。
 */
function topologyProblems(srcs: {
  legs: Record<LegName, string>
  core: string
  deadCopy: string
  barrel: string
}): string[] {
  const problems: string[] = []
  if (/from\s+['"]react-native['"]|from\s+['"]@tarojs\//.test(srcs.core))
    problems.push('navbar-core 出现平台件 import ⇒ 一端 tsc 会把它拉进被检程序(根桶事故同型)')
  for (const leg of Object.keys(srcs.legs) as LegName[]) {
    const src = srcs.legs[leg]
    if (!/\bNavBarCore\b/.test(src))
      problems.push(`${leg} 不再经 NavBarCore 取骨架 ⇒ 骨架被端内重写`)
    if (!/platform=\{NAVBAR_PLATFORM\}/.test(src))
      problems.push(`${leg} 不再注入 platform adapter ⇒ 原语接法不明`)
    if (!/\bBackChevron\b/.test(src))
      problems.push(`${leg} 不再走 BackChevron ⇒ 返回键脱离 back-chevron-spec 单一源`)
  }
  if (/\bNavBarCore\b|navbar-spec/.test(srcs.deadCopy))
    problems.push(
      'packages/app 的 DOM 副本开始消费本族单一源 ⇒ 它已变成第三条腿:' +
        '请把它登记进 LEGS 并跑门 128,而不是让它在配对腿之外悄悄上屏',
    )
  if (/\bNavBar\b/.test(srcs.barrel))
    problems.push('packages/app/src/index.ts 导出了 NavBar ⇒ 死副本获得公开出口,需重新过 §7 三问')
  return problems
}

/* ───────────────────────── C 类机制档:sticky 层 z-index ───────────────────────── */

/**
 * 两端 sticky 容器的 z-index —— 两端各写一份(小程序 Tailwind `z-[1001]` 类名 / RN StyleSheet
 * `zIndex: 1001`),通道不同、**数值必须相同**。类名无法由 TS 常量生成(动态类名会被 purge),
 * 所以档留在端内;但"同值"这件事必须有人比,否则改一端没人喊。
 * 注意只认**任意值类** `z-[N]`:小程序默认模式用 `z-50` 且 RN 默认模式无 z-index,不在此档。
 */
function stickyZProblems(srcs: Record<LegName, string>): string[] {
  const problems: string[] = []
  const read = (leg: LegName): number[] => {
    const src = srcs[leg]
    const out: number[] = []
    if (leg === 'miniapp-taro') {
      for (const m of src.matchAll(/\bz-\[(\d+)\]/g)) out.push(Number(m[1]))
    } else {
      for (const m of src.matchAll(/\bzIndex:\s*(\d+)/g)) out.push(Number(m[1]))
    }
    return [...new Set(out)]
  }
  const mini = read('miniapp-taro')
  const rn = read('mobile-rn')
  if (mini.length !== 1)
    problems.push(
      `小程序端 sticky z-index 读到 ${mini.length} 个值 [${mini.join(',')}] ⇒ 本判据失明或档被拆`,
    )
  if (rn.length !== 1)
    problems.push(`RN 端 zIndex 读到 ${rn.length} 个值 [${rn.join(',')}] ⇒ 本判据失明或档被拆`)
  if (mini.length === 1 && rn.length === 1 && mini[0] !== rn[0])
    problems.push(`sticky z-index 两端不同值:小程序 ${mini[0]} vs RN ${rn[0]} ⇒ C 类机制档被改走样`)
  return problems
}

describe('NavBar 跨端档位一致性(O02 票④)', () => {
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
      `现状两端都在用的档未登记进 CROSS_END_TIERS:${unregistered.join(',')} ⇒ 新增共用档必须进清单`,
    ).toEqual([])
  })

  it('② 两端共用的每一枚档,两端落屏的逻辑 px 相等(算式现算,不认字面名)', () => {
    for (const tier of CROSS_END_TIERS) {
      const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], LEG_SRC['mobile-rn'])
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

  it('④ 本锁有牙:一端把档放大(TIER * 2)⇒ 取值一致性判据必须红', () => {
    const tier = 'NAVBAR_TITLE_FONT_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /fontSize:\s*NAVBAR_TITLE_FONT_PX,/,
      'fontSize: NAVBAR_TITLE_FONT_PX * 2,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn)
    expect(problems.length, '把档放大 2 倍后取值一致性判据仍绿 ⇒ 判据没在比值').toBeGreaterThan(0)
  })

  it('⑤ 本锁有牙:某一端把引用改成裸数字(退回各写一份)⇒ 脱线判据必须红', () => {
    const tier = 'NAVBAR_CENTER_MIN_WIDTH_PX'
    const dirtyRn = LEG_SRC['mobile-rn'].replace(
      /minWidth:\s*NAVBAR_CENTER_MIN_WIDTH_PX,/,
      'minWidth: 80,',
    )
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const { problems } = tierParityProblems(tier, LEG_SRC['miniapp-taro'], dirtyRn)
    expect(problems.length, '一端退回裸数字后判据仍绿 ⇒ 判据只认"名字在不在"').toBeGreaterThan(0)
  })

  it('⑥ 本锁有牙:块内混入同值裸字面量 ⇒ 块级反向锁必须红(端内第二份真相)', () => {
    // 形态 = 图标盒的宽仍走档、高退回裸 20:同一块里"档 20"与"字面量 20"并存 ⇒ 一处尺寸两个来源。
    const dirtyRn = LEG_SRC['mobile-rn'].replace(/height:\s*NAVBAR_ACTION_GLYPH_PX,/, 'height: 20,')
    expect(dirtyRn).not.toBe(LEG_SRC['mobile-rn'])
    const problems = doubleTruthProblems(dirtyRn, 'mobile-rn', RPX_PER_PX)
    expect(problems.length, '块内混入同值裸字面量后反向锁仍绿 ⇒ 锁没生效').toBeGreaterThan(0)
  })

  it('⑦ 单端档归属表:每枚只在登记的那一端有取数点(另一端补引用 = 凑平,必须红)', () => {
    expect(SINGLE_END_TIERS.length, '归属表空了 ⇒ 这条尺子没在测任何东西').toBeGreaterThan(3)
    expect(
      singleEndProblems(LEG_SRC),
      '单端档归属被破坏(要么真实取数点丢了,要么有人往另一端补引用凑平)',
    ).toEqual([])
  })

  it('⑧ 本锁有牙:两端各做一次变异 ⇒ ⑦ 必须红', () => {
    // 变异一:往"另一端"补一个取数点 —— 本票明令禁止的"给单端补数字凑平"。
    const tier = 'NAVBAR_SIDE_PLACEHOLDER_PX'
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
    const stripped: Record<LegName, string> = {
      ...LEG_SRC,
      'mobile-rn': LEG_SRC['mobile-rn'].replaceAll(tier, '__gone__'),
    }
    expect(stripped['mobile-rn']).not.toBe(LEG_SRC['mobile-rn'])
    expect(
      singleEndProblems(stripped).length,
      'owner 端取数点被删后归属判据仍绿 ⇒ 锁只认"另一侧没有",不认"这一侧还在不在"',
    ).toBeGreaterThan(0)
  })

  it('⑨ C 类机制档:sticky 容器 z-index 两端各写一份,数值必须相同', () => {
    expect(stickyZProblems(LEG_CODE), '两端 sticky z-index 不同值或被拆成多枚').toEqual([])
    // 反向:改一端 ⇒ 必须红(两枚 C 类档里唯一还能机器比的量)。
    const dirtyRn = LEG_CODE['mobile-rn'].replace(/zIndex:\s*1001/, 'zIndex: 1002')
    expect(dirtyRn).not.toBe(LEG_CODE['mobile-rn'])
    expect(
      stickyZProblems({ ...LEG_CODE, 'mobile-rn': dirtyRn }).length,
      'z-index 改一端后判据仍绿 ⇒ 这条 C 类档没人看着',
    ).toBeGreaterThan(0)
  })

  it('⑩ 导出面全覆盖:每一枚 spec 档都有真消费方(幻影档 = 造好没装车 ⇒ 红)', () => {
    const exports = specTierNames()
    expect(exports.length, 'spec 导出面读空 ⇒ 本用例在测一个不存在的东西').toBeGreaterThanOrEqual(
      12,
    )
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, tiers: exports }),
      '存在无消费方的导出档(AGENTS §0.9 造好没装车 = 没有)',
    ).toEqual([])
    for (const row of SINGLE_END_TIERS)
      expect(
        exports.includes(row.tier),
        `${row.tier} 已不在 spec 导出面 ⇒ SINGLE_END_TIERS 过期,请同步清单`,
      ).toBe(true)
    for (const row of DERIVED_USAGES)
      expect(
        exports.includes(row.tier),
        `${row.tier} 已不在 spec 导出面 ⇒ DERIVED_USAGES 过期,请同步清单`,
      ).toBe(true)
  })

  it('⑪ 本锁有牙:凭空加一枚无人取数的档 ⇒ ⑩ 必须红', () => {
    const phantom = 'NAVBAR___PROBE_PHANTOM_PX'
    expect(
      phantomTierProblems({ legSrcs: LEG_SRC, tiers: [...specTierNames(), phantom] }).length,
      '凭空加一枚无人引用的档后幻影判据仍绿 ⇒ 导出面没人对账',
    ).toBeGreaterThan(0)
  })

  it('⑫ 上屏腿拓扑:骨架只经共享 core、恰好两条腿、packages/app 的 DOM 副本不是腿', () => {
    const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')
    const ctx = {
      legs: LEG_SRC,
      core: read(CORE_FILE),
      deadCopy: read(DEAD_COPY_FILE),
      barrel: read(APP_BARREL_FILE),
    }
    expect(topologyProblems(ctx), '上屏腿拓扑被破坏(骨架被端内重写 / 死副本变成第三条腿)').toEqual(
      [],
    )
    // 反向:死副本一旦消费本族单一源 ⇒ 必须点名(它是"第三条腿",不是可以顺手接线的第三个壳)。
    const dirty = {
      ...ctx,
      deadCopy: `${ctx.deadCopy}\nimport { NavBarCore } from '@ihui/shared/ui'\n`,
    }
    expect(
      topologyProblems(dirty).length,
      '死副本接上 NavBarCore 后拓扑判据仍绿 ⇒ 这条锁看不见第三腿',
    ).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
