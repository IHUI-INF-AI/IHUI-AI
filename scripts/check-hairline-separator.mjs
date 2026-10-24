#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 发丝分隔线守门 — 拦住「用**背景色**画一条 1px 线」这一型视觉元素(台账票 L29018)。
 *
 * 与守门 11d(`check-no-divider.mjs`)是**同一个视觉动作的两种书写语言**,不是同一把尺子:
 *   11d 判「线由**描边**画出来」(border-t/b/l/r、CSS border-top、RN borderTopWidth);
 *   本门判「线由**背景色**画出来」(web/miniapp 的 `h-px`/`w-px` + `bg-*`;RN 样式对象
 *   `height:/width: 1|StyleSheet.hairlineWidth` + `backgroundColor` 中性档)。
 * 11d 的族 1–6 结构上打不到本族 —— `h-px bg-border` 里一个 `border` 的**边**都没写,
 * 它只是一块 1px 高的彩色矩形。票面现读:web/小程序 29 枚、RN 6 枚。
 *
 * ── 为什么不能"出现即拦":形状重载(票面明令,§12e)────────────────────────────
 * 同一条 `w-px bg-border` 在三处是**结构件**而不是分隔线;机械判红这三型就是恒红门,
 * 唯一结局是人人 `--no-verify` 连带废掉全部守门。故先给三型的**可机械判定指纹**,
 * 命中的一律放过并**给出"凭什么放过"的原话**;其余才进差值棘轮。
 *
 *   型① 语义分隔件(semantic-separator)—— 菜单/下拉/选择器里的分隔项:
 *        · 同元素带 `role="separator"`(ARIA 语义:这段 UI **就是**一个分隔件);
 *        · 或宿主组件名以 `Separator` 结尾(`<DropdownMenuPrimitive.Separator>` /
 *          `<SelectPrimitive.Separator>` —— Radix 原语自己带 role,JSX 行上不写 role)。
 *        凭什么放过:被屏幕阅读器当作结构语义读出,不是"两块内容之间画条线"。
 *
 *   型② 导引轨(guide-rail)—— 时间线 / 树 / 进度轴的连线:
 *        · 同一元素的 class 表达式里 `absolute` 在场;
 *        · **且**竖轴的上界成对:同时有 `top-*` 与 `bottom-*`(含 `inset-y-0`/`inset-0`),
 *          或有 `top-*|bottom-*` 配 `h-[calc(...)]`;
 *        · **且**发丝维度是**宽度**(`w-px`)。
 *        凭什么放过:长度方向被 inset 撑满、横截面 1px ⇒ 一根"轨道",内容挂在它旁边,
 *        不是横在两块内容之间的分隔线。反向锁:横向撑满的 `left-0 right-0 top-0 h-px`
 *        **不**放过(那正是"绝对定位的分隔线",轨出口只认竖轴,见自检 T08)。
 *        ⚠️ 只读一行会读错:实测 `stream-ui.tsx:354` 的发丝在 `'absolute left-[7px] w-px'`
 *        那一串、而 `top-6 bottom-1 bg-border/70` 在同一 `cn()` 的第二串 ⇒ 判据按
 *        **className 值表达式整体**取形状(`classNameValueSpan`),不按物理行取。
 *
 *   型③ 可拖拽分隔器(draggable-splitter)—— 面板分割条:
 *        · 光标 `cursor-col-resize` / `cursor-row-resize`;
 *        · 或类名 / **拥有者声明名** / 文件路径命中 `pane-split|resizer|split-handle|drag-handle`。
 *        凭什么放过:那条线是可聚焦、可拖拽、可用方向键调整的手柄,不是装饰性的分隔。
 *        ⚠️ 三条都要:实测 `pane-split-container.tsx:113` 把可见细线写成
 *        `RESIZER_CLASS.x.line = 'h-full w-px bg-border'` —— 同一行上既无 `pane-split`
 *        也无 `cursor-*`,只认 class 会把这枚读成存量违规(报数不判红,但账面失真)。
 *
 * ── 其余(真·纯分隔线)走**差值棘轮**(不判绝对红)────────────────────────────
 * 锚点 = **该文件 HEAD 面自身的命中数**(与守门 109/130/11d 同形,由
 * `./lib/face-scan.mjs` 的 `headAnchors` 提供,读数与锚点**同一个** `countDividers`,§22c);
 * 只拦"本次改动把违规加回来/加得比 HEAD 更多",存量只报数不判红(§12e:存量未清上 blocking
 * 就是恒红门)。除三型之外的**形状收窄**(与 11d 同一套口径,勿各写一份):
 *   · 底色非中性档(`bg-primary/40`、`bg-success.DEFAULT`)⇒ 彩色强调条/下划线,放过;
 *     本门中性根表 = 11d 的中性根表 + {white, black, popover, hairline, divider, separator} ——
 *     差异只有一处:白/黑在本族算中性。理由是 11d 的「描边不得取墨档」是 **border 专有**规则,
 *     而"背景色画线"取墨档在白底上根本看不见,不构成同一个问题。
 *   · **粗于发丝的尺寸根本不进候选**(`h-[4px]`、`h-[20rpx]`、`w-[300px]`):那是尺寸块不是线,
 *     收进来只会把报告淹掉(第一版实测放进 586 文件里 159 枚「厚度≥3px」纯噪声);
 *     本族只认 1–2px —— RN 侧 `hairlineWidth * 2` 是真实写法(见 SearchOverlay:481),故 2px 仍算发丝;
 *   · 0 / `h-0` / `StyleSheet.hairlineWidth * 0` ⇒ 擦除动作,放过;
 *   · 同一行 / 同一 className 表达式里同时有描边画的边 ⇒ 不归本门(归 11d),不重复报。
 *
 * ── 未判定(§0.3:取不到就点名,绝不猜成绿)──────────────────────────────────
 *   · 发丝维度写成量不出物理像素的任意值(`w-[0.125rem]`、`w-[length:0.5em]`);
 *   · RN 侧 `height: StyleSheet.hairlineWidth * <非数字>`;
 *   · 样式对象括号配不平 / 有展开运算符却没写出 `backgroundColor`(形状读不出);
 *   · 未判定逐条点名并计入结论行;非零 ⇒ exit 2(票面验收口径:0 通过 / 1 新增违规 / 2 未判定)。
 *     若将来存量形状未判定非零,先清偿形状再谈升档,**不得把它改判成绿**。
 *   仍归"未判定"而**不**归违规的还有一条:发丝 `w-px` 配 `h-full|flex-1` 这类
 *   "疑似连接轨但没有 absolute"的形状 —— 它们按违规**计数**(棘轮要留牙),但每条带
 *   `railSuspect` 标记,报告里单列,交人复核归入型②或清偿;判据不替人下结论。
 *
 * 取材面纪律(§0.4):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工
 * 逃生舱;两面旗同给 ⇒ exit 2 并打「未判定」。候选清单与正文同面同轮,都出自
 * `./lib/face-scan.mjs`(`sourceCandidates` / `readSources`),取不到被审面**不回落另一个面**。
 *
 * 射程(现读,不是推断):
 *   · 覆盖 `apps/**` + `packages/**` 的 `.ts/.tsx/.js/.jsx`(Tailwind 类名面 + 样式对象面)。
 *   · **不含** `.css` 面:实测 `git grep -E "height: *(0\.5|1|1\.0)px" -- "*.css"` = 0 命中、
 *     miniapp 全树 `h-px|w-px|h-\[1px\]` = 0 命中 ⇒ 现值为空集。将来若出现,属 11d 族 5
 *     扩容,不在这里长第二把尺子(§0.6)。
 *   · 不含 RN 的 `borderWidth: hairlineWidth`(描边画线,11d 族 6 已管)。
 *
 * 用法:
 *   node scripts/check-hairline-separator.mjs --staged     pre-commit(新增超基线则 exit 1)
 *   node scripts/check-hairline-separator.mjs              全量扫描报告(存量只报数, exit 0)
 *   node scripts/check-hairline-separator.mjs --worktree   人工逃生舱(读磁盘,不作提交门禁)
 *   node scripts/check-hairline-separator.mjs --self-test  判据自检
 *   node scripts/check-hairline-separator.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_HAIRLINE_SEPARATOR=1 git commit ...
 */
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
import {
  addedLineNumbers,
  headAnchors,
  overBaseline,
  readSources,
  sourceCandidates,
} from './lib/face-scan.mjs'
// 形状读取器**复用**兄弟门而不是抄一份(§0.6):块定位 / 插值 / 发丝档 / 中性色引用这四件纯解析
// 在 11d 里已被 30+ 例自检钉住,第二份必然漂开(本仓记过"两把尺子读出 31 与 59"那一型)。
// 三型结构件指纹(`structuralTypeOf`)同样只有一份,住在 11d 的族 7 段:
// 本门与族 7 对同一枚发丝线必须得到同一判定,否则又是"两把尺子"。
import {
  attributeValueSpan,
  classNameValueSpan,
  enclosingBraceBlock,
  interpolationBraceIndices,
  isNeutralColorRef,
  jsxTagNameAt,
  ownerNameOf,
  stripVariantPrefix,
  structuralTypeOf,
  thinTokensOf,
} from './check-no-divider.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isWorktree = argv.includes('--worktree')
const isSelfTest = argv.includes('--self-test')
const isHelp = argv.includes('--help') || argv.includes('-h')
const SKIP_ENV = 'HUSKY_SKIP_HAIRLINE_SEPARATOR'

/** §22d 双形态入口:被镜像测试 import 时不得执行 skip/--help/主流程,也不得 process.exit */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.env[SKIP_ENV] === '1') {
  console.log(`⏭  发丝分隔线守门(${SKIP_ENV}=1, 跳过)`)
  process.exit(0)
}

if (isDirectRun && isHelp) {
  console.log(`
check-hairline-separator.mjs — 发丝分隔线守门(用背景色画 1px 线)

用法:
  node scripts/check-hairline-separator.mjs --staged     pre-commit 模式(新增超基线则 exit 1)
  node scripts/check-hairline-separator.mjs              全量扫描报告(存量只报数, exit 0)
  node scripts/check-hairline-separator.mjs --worktree   人工逃生舱:量盘上进度(不作提交门禁)
  node scripts/check-hairline-separator.mjs --self-test  判据自检
  node scripts/check-hairline-separator.mjs --help       本帮助

判定:
  违规族(差值棘轮,锚点 = 该文件 HEAD 面自身命中数;存量只报数):
    web/miniapp  h-px|w-px|h-[1px]|w-[1px] 配中性底色 bg-border|bg-muted|…
    RN/内联样式  height|width: 1|StyleSheet.hairlineWidth(×1|×2) 配中性 backgroundColor
  放过(三型结构件,逐型降噪,不自创第四条):
    ① role="separator" / 宿主组件 *Separator(语义分隔件)
    ② absolute + 竖轴上界成对 + w-px(时间线/树导引轨)
    ③ cursor-col|row-resize / pane-split|resizer|*-handle(可拖拽分隔器)
  放过(形状收窄):彩色底(非中性档)、粗于发丝的尺寸(不进候选)、宽度 0 擦除
  未判定:任意单位量不出物理像素 / hairlineWidth 乘变量 / 括号配不平 / 展开且无 backgroundColor

退出码:0 = 通过 / 1 = 判出新增违规 / 2 = 未判定或参数不成立
`)
  process.exit(0)
}

/** 源码面:Tailwind 类名 + 样式对象都在 .ts/.tsx/.js/.jsx 里(见头注"射程") */
const SCAN_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx']

/**
 * git grep 预筛:必须是各族判据的**超集**,否则清单面比内容面窄 = 静默少扫。
 * 三支:`h-px|w-px`(web 主档)、任意值发丝、`hairlineWidth`(RN 命名档)、
 * `height|width: 0|1|2`(RN 数值档)。宽出来的部分只花一次 blob 读取,不产生结论。
 */
const PREFILTER_RE =
  'hairlineWidth|[hw]-px|[hw]-\\[(length:)?[0-9.]|(height|width): *[0-2][[:space:],}]'

/** class 字符集(与 11d 同表:字母数字 + 连字符/冒号/斜杠/方括号/点/下划线/括号/@%/) */
const CLASS_TOKEN_RE = /[A-Za-z0-9_[\]./:()@%,-]+/g

/** 中性底色词根(见头注:11d 的中性根表 + 白/黑/popover/发丝族词根) */
const NEUTRAL_BG_ROOTS = new Set([
  'border',
  'input',
  'muted',
  'card',
  'background',
  'popover',
  'divider',
  'hairline',
  'separator',
  'surface',
  'white',
  'black',
])
const NEUTRAL_SHADE_RE = /^(?:gray|grey|neutral|slate|zinc|stone)-\d+$/
/** `bg-*` 里这些不是颜色(尺寸/定位/渐变/关键字),读到就整枚不算底色 */
const NON_COLOR_BG_RE =
  /^(?:gradient|none|cover|contain|center|left|right|top|bottom|repeat|no-repeat|clip|origin|blend|fixed|local|scroll|auto|transparent|current|inherit|unset|initial|opacity|size|position|image|url)/

// ───────────────────────────── 面 A:class 表达式里的形状 ─────────────────────────────

/** 索引 → 行号(遮罩后文本与原文逐行等长,行号可直接对回原文件) */
export function lineOfIndex(text, idx) {
  const before = text.slice(0, idx)
  return (before.match(/\n/g) || []).length + 1
}

// `attributeValueSpan` / `classNameValueSpan` / `thinTokensOf` 的实现住在 11d 的族 7 段,
// 本文件只 import(§0.6:同一把尺子只留一份)。

/**
 * 底色档。返回 true = 中性(就是"线"的颜色)/ false = 彩色(强调)/ null = 不是颜色 token。
 * 判读口径见头注"形状收窄"。
 */
export function bgNeutrality(classHead) {
  if (!/^bg-/.test(classHead)) return null
  const body = classHead.slice(3)
  const slash = body.indexOf('/')
  const colorPart = slash < 0 ? body : body.slice(0, slash)
  if (colorPart === '') return null
  if (/^\[/.test(colorPart)) {
    // `bg-[length:…]`/`bg-[size:…]` 是尺寸不是颜色
    if (/^\[(length|size|position|image|url|linear-gradient|radial-gradient):/.test(colorPart))
      return null
    return isNeutralColorRef(colorPart.replace(/^\[/, '').replace(/\]$/, ''))
  }
  if (NON_COLOR_BG_RE.test(colorPart)) return null
  if (NEUTRAL_BG_ROOTS.has(colorPart)) return true
  if (NEUTRAL_SHADE_RE.test(colorPart)) return true
  // 复合名(`bg-surface-muted`):任一段落在中性根表即中性
  return colorPart.includes('-') && colorPart.split('-').some((seg) => NEUTRAL_BG_ROOTS.has(seg))
}

/** @returns {Array<{token:string, neutral:boolean}>} */
export function bgTokensOf(classText) {
  const out = []
  for (const m of classText.matchAll(CLASS_TOKEN_RE)) {
    const head = stripVariantPrefix(m[0])
    const verdict = bgNeutrality(head)
    if (verdict !== null) out.push({ token: head, neutral: verdict })
  }
  return out
}

// 三型结构件指纹(`structuralTypeOf`)已上收到 11d 族 7 段,本文件 import 同一份实现。
// 原话与逐型理由见本文件头注;判据本体见 check-no-divider.mjs 的族 7 段(§0.6)。

// ───────────────────────── 面 B:RN / 内联样式对象 ─────────────────────────

/**
 * RN 横截面档。`StyleSheet.hairlineWidth`(×1|×2)与数值 1–2 都是发丝;
 * `* <非数字>` ⇒ unknown(量不到);变量/百分比/函数调用 ⇒ null(不是发丝候选,不进射程)。
 * @returns {'hair'|'thick'|'erase'|'unknown'|null}
 */
export function rnThinGrade(raw) {
  const v = String(raw ?? '')
    .trim()
    .replace(/,$/, '')
  if (v === '') return null
  const hw = /^StyleSheet\.hairlineWidth(?:\s*\*\s*(\d+(?:\.\d+)?))?$/.exec(v)
  if (hw) {
    const n = hw[1] === undefined ? 1 : Number(hw[1])
    if (n <= 0) return 'erase'
    return n <= 2 ? 'hair' : 'thick'
  }
  if (/^StyleSheet\.hairlineWidth\s*\*/.test(v)) return 'unknown'
  if (/^[A-Za-z_$'"`]/.test(v)) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return 'erase'
  return n <= 2 ? 'hair' : 'thick'
}

// ───────────────────────────── 整份源码判据 ─────────────────────────────

/**
 * 整份源码判据(自检与 CLI **共用同一实现**,§0.6)。
 * @returns {{hits:Array<{line:number,kind:string,label:string,snippet:string,type?:string,why?:string,railSuspect?:boolean}>, undetermined:Array}}
 */
export function scanSource(relPath, rawText) {
  const masked = maskComments(rawText)
  const skip = interpolationBraceIndices(masked)
  const rawLines = rawText.split('\n')
  const hits = []
  const seen = new Set()
  const push = (hit) => {
    if (seen.has(hit.line)) return
    seen.add(hit.line)
    hits.push(hit)
  }
  const snippetOf = (line) =>
    String(rawLines[line - 1] ?? '')
      .trim()
      .slice(0, 140)

  // ── 面 A:Tailwind 类名(h-px / w-px / 任意值发丝 + bg-*)──
  for (const m of masked.matchAll(/[hw]-px\b|[hw]-\[(?:length:)?[0-9.]+(?:px|rpx|rem|em|pt)\]/g)) {
    const line = lineOfIndex(masked, m.index)
    if (seen.has(line)) continue
    const span = classNameValueSpan(masked, m.index)
    const surface = span
      ? masked.slice(span.start, span.end)
      : masked.slice(
          masked.lastIndexOf('\n', m.index) + 1,
          masked.indexOf('\n', m.index) < 0 ? masked.length : masked.indexOf('\n', m.index),
        )
    // 没写底色 ⇒ 这条线不是背景色画的,不归本门
    const bgs = bgTokensOf(surface)
    if (bgs.length === 0) continue
    if (!bgs.some((b) => b.neutral)) {
      push({
        line,
        kind: 'exempt',
        type: 'accent-background',
        label: `彩色底 ${bgs.map((b) => b.token).join(',')}`,
        why: '底色非中性档 ⇒ 强调条 / 下划线,不是中性分隔线',
        snippet: snippetOf(line),
      })
      continue
    }
    const thin = thinTokensOf(surface)
    const hair = thin.filter((t) => t.grade === 'hair')
    if (hair.length === 0) {
      const unknown = thin.filter((t) => t.grade === 'unknown')
      if (unknown.length > 0) {
        push({
          line,
          kind: 'undetermined',
          label: `发丝维度量不出物理像素(${unknown.map((t) => t.token).join(',')})`,
          snippet: snippetOf(line),
        })
      }
      continue
    }
    const structural = structuralTypeOf({ relPath, text: masked, idx: m.index, surface })
    if (structural) {
      push({
        line,
        kind: 'exempt',
        type: structural.type,
        label: structural.type,
        why: structural.why,
        snippet: snippetOf(line),
      })
      continue
    }
    const suspect =
      thin.some((t) => t.axis === 'w') &&
      tokensSome(surface, /^(?:h-full|flex-1|h-auto|flex-auto|self-stretch)$/)
    push({
      line,
      kind: 'divider',
      label: 'bg 发丝分隔线(h-px/w-px + 中性底)',
      snippet: snippetOf(line),
      ...(suspect ? { railSuspect: true } : {}),
    })
  }

  // ── 面 B:RN / 内联样式对象(height|width 发丝 + backgroundColor 中性)──
  for (const m of masked.matchAll(/\b(height|width)\s*:\s*([^,;{}\n]+)/g)) {
    const line = lineOfIndex(masked, m.index)
    if (seen.has(line)) continue
    const grade = rnThinGrade(m[2])
    if (grade === 'unknown') {
      push({
        line,
        kind: 'undetermined',
        label: `横截面取不出物理像素(${m[2].trim()})`,
        snippet: snippetOf(line),
      })
      continue
    }
    if (grade !== 'hair') continue
    const block = enclosingBraceBlock(masked, m.index, skip)
    if (!block) {
      push({
        line,
        kind: 'undetermined',
        label: '样式对象括号配不平 ⇒ 同块底色读不出',
        snippet: snippetOf(line),
      })
      continue
    }
    // `shadowOffset: { width: 0, height: 1 }` 是阴影偏移,不是线(实测 5 枚,见票面)
    if (
      /shadow(?:Offset|Radius)\s*:\s*$/.test(
        masked.slice(Math.max(0, block.start - 40), block.start),
      )
    ) {
      continue
    }
    const bgVals = [...block.inner.matchAll(/\bbackgroundColor\s*:\s*([^,;{}\n]+)/g)].map(
      (x) => x[1],
    )
    if (bgVals.length === 0) {
      // 有展开运算符却读不到显式底色 ⇒ 形状读不出(不猜成绿)
      if (block.inner.includes('...')) {
        push({
          line,
          kind: 'undetermined',
          label: '样式对象用展开运算符且未写 backgroundColor ⇒ 底色读不出',
          snippet: snippetOf(line),
        })
      }
      continue
    }
    if (!bgVals.every((v) => isNeutralColorRef(v))) {
      push({
        line,
        kind: 'exempt',
        type: 'accent-background',
        label: '彩色底',
        why: 'background 非中性档 ⇒ 强调条,不是中性分隔线',
        snippet: snippetOf(line),
      })
      continue
    }
    const structural = structuralTypeOf({
      relPath,
      text: masked,
      idx: m.index,
      surface: snippetOf(line),
    })
    if (structural) {
      push({
        line,
        kind: 'exempt',
        type: structural.type,
        label: structural.type,
        why: structural.why,
        snippet: snippetOf(line),
      })
      continue
    }
    push({
      line,
      kind: 'divider',
      label: 'RN/内联发丝分隔线(height|width + 中性 backgroundColor)',
      snippet: snippetOf(line),
    })
  }

  hits.sort((a, b) => a.line - b.line)
  return { hits, undetermined: hits.filter((h) => h.kind === 'undetermined') }
}

/** surface 里是否存在匹配 re 的 class token(带变体前缀剥离) */
function tokensSome(surface, re) {
  for (const m of surface.matchAll(CLASS_TOKEN_RE)) {
    if (re.test(stripVariantPrefix(m[0]))) return true
  }
  return false
}

/** 棘轮读数口径 —— 锚点与本轮读数必须用**同一把尺子**(§22c) */
export function countDividers(scan) {
  return scan.hits.filter((h) => h.kind === 'divider').length
}

/** 结构件放过分型计数(报告用)`{'semantic-separator','guide-rail','draggable-splitter','accent-background'}` */
export function excuseCounts(hits) {
  const out = {
    'semantic-separator': 0,
    'guide-rail': 0,
    'draggable-splitter': 0,
    'accent-background': 0,
  }
  for (const h of hits) {
    if (h.kind !== 'exempt') continue
    if (out[h.type] === undefined) out[h.type] = 0
    out[h.type]++
  }
  return out
}

// ───────────────────────────── 取材与棘轮 ─────────────────────────────

export async function run({ staged, worktree }) {
  const top = assertRepoRoot(ROOT, '发丝分隔线守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.yellow}⚠️  未判定:${picked.error}(取哪一面都会让另一面成为假绿)${C.reset}`)
    return 2
  }
  const face = picked.face
  const faceLabel =
    face === 'staged'
      ? '索引 blob'
      : face === 'worktree'
        ? '工作树(人工逃生舱,不作提交门禁)'
        : 'HEAD blob'

  console.log(
    `${C.cyan}${C.bold}[发丝分隔线守门] 扫描 h-px|w-px + bg-* / RN height|width 发丝 + 中性 backgroundColor...${C.reset}`,
  )
  console.log(
    `${C.dim}规则: 分隔线不得用背景色画 —— 改 space-y-* 间距或 bg-muted 区块对比;三型结构件按指纹放过${C.reset}`,
  )
  console.log(
    `${C.dim}取材面: ${faceLabel};真分隔线按「该文件 HEAD 面自身命中数」做差值棘轮(存量只报数)${C.reset}`,
  )
  console.log('')

  const added = staged ? addedLineNumbers(top) : null
  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest: isExcludedDirName,
  })
  const candidates0 = staged ? listed.filter((rel) => added.has(rel)) : listed
  if (candidates0.length === 0) {
    console.log(
      `${C.green}✅ ${staged ? '暂存区无含发丝线 token 的源码变更,跳过' : '被审面无含发丝线 token 的源码文件,跳过'}${C.reset}`,
    )
    console.log(
      `发丝分隔线守门结论:面=${faceLabel} 扫描 0 文件 | 真分隔线 存量 0 枚 新增 0 枚 | 结构件放过 0 枚 | 未判定 0 枚 ⇒ 通过`,
    )
    return 0
  }
  const { texts } = readSources(top, face, candidates0)
  const files = candidates0.filter((rel) => texts.has(rel))
  // 锚点与读数同一个 countDividers —— 两把尺子算出来的差值不叫棘轮,叫吵架
  const anchor = staged
    ? headAnchors(top, files, (rel, src) => countDividers(scanSource(rel, src)))
    : new Map()

  let newViolations = 0
  let stock = 0
  const totals = {
    'semantic-separator': 0,
    'guide-rail': 0,
    'draggable-splitter': 0,
    'accent-background': 0,
  }
  const undeterminedItems = []
  const reports = []

  for (const rel of files) {
    const relPosix = relative(top, rel).split('\\').join('/')
    const scan = scanSource(rel, texts.get(rel))
    const excused = excuseCounts(scan.hits)
    for (const k of Object.keys(totals)) totals[k] += excused[k] ?? 0
    for (const u of scan.undetermined) undeterminedItems.push({ file: relPosix, ...u })

    const dividers = scan.hits.filter((h) => h.kind === 'divider')
    const base = staged ? (anchor.get(rel) ?? 0) : dividers.length
    const over = Math.max(0, dividers.length - base)
    newViolations += over
    stock += dividers.length - over
    if (scan.hits.length === 0) continue
    reports.push({
      file: relPosix,
      base: staged ? base : null,
      over,
      items: scan.hits.map((h) => ({
        ...h,
        level:
          h.kind === 'exempt'
            ? 'exempt'
            : h.kind === 'undetermined'
              ? 'undetermined'
              : over > 0
                ? 'blocking'
                : 'stock',
      })),
    })
  }

  // 结构件放过只数三型(彩色底是"形状收窄",两个账分开记 —— 合起来读会得出 118 = 11+10+2 的错账)
  const excusedTotal =
    totals['semantic-separator'] + totals['guide-rail'] + totals['draggable-splitter']
  console.log(`${C.bold}扫描结果:${C.reset}`)
  console.log(`  扫描文件: ${files.length} 个`)
  console.log(
    `  真分隔线: 存量 ${stock} 枚 / 超基线新增 ${newViolations} 枚${staged ? '(锚点 = 该文件 HEAD 面命中数)' : '(全量档只报数,§12e)'}`,
  )
  console.log(
    `  结构件放过: ${excusedTotal} 枚 (语义分隔件 ${totals['semantic-separator']}, 导引轨 ${totals['guide-rail']}, 可拖拽分隔器 ${totals['draggable-splitter']})`,
  )
  console.log(
    `  形状收窄放过: ${totals['accent-background']} 枚 (彩色底 ${totals['accent-background']})`,
  )
  console.log(`  未判定: ${undeterminedItems.length} 枚(逐条点名,不冒充没命中)`)
  console.log('')

  for (const r of reports) {
    const hasBlocking = r.items.some((i) => i.level === 'blocking')
    console.log(
      `${hasBlocking ? C.red : C.dim}${r.file}${C.reset}${staged ? `${C.dim}(HEAD 基线 ${r.base})${C.reset}` : ''}`,
    )
    for (const it of r.items) {
      const tag =
        it.level === 'blocking'
          ? `${C.red}[新增]${C.reset}`
          : it.level === 'exempt'
            ? `${C.dim}[放过]${C.reset}`
            : it.level === 'undetermined'
              ? `${C.yellow}[未判定]${C.reset}`
              : `${C.dim}[存量]${C.reset}`
      const tail =
        it.kind === 'exempt'
          ? ` — ${it.why}`
          : it.railSuspect
            ? ' — 疑似连接轨(无 absolute),请人工复核归型②或清偿'
            : ''
      console.log(`  ${C.dim}行 ${it.line}${C.reset} ${tag} [${it.label}] ${it.snippet}${tail}`)
    }
    console.log('')
  }

  if (undeterminedItems.length > 0) {
    console.log(
      `${C.yellow}${C.bold}未判定 ${undeterminedItems.length} 枚(§0.3:不记绿也不冒红):${C.reset}`,
    )
    for (const u of undeterminedItems) {
      console.log(
        `  ${C.dim}${u.file}:${u.line}${C.reset} ${C.yellow}[未判定]${C.reset} ${u.label} ${u.snippet}`,
      )
    }
    console.log('')
  }

  console.log(`${C.dim}修复方法(与守门 11d 同一套出口):${C.reset}`)
  console.log(`  1. 列表/区块之间用 space-y-* 间距分隔(§4 允许)`)
  console.log(`  2. 或用 bg-muted / bg-card 区块底色对比区分(§4 允许)`)
  console.log(`  3. 确属语义分隔件 ⇒ 用 Radix DropdownMenu.Separator / role="separator"(型①)`)
  console.log(`  4. 确属时间线/树导引轨 ⇒ absolute + top/bottom 撑满(型②),不要裸 h-px`)
  console.log(`  5. 确属面板分割 ⇒ 走 pane-split-container(型③),不要各页自画`)
  console.log('')

  const conclusion =
    `发丝分隔线守门结论:面=${faceLabel} 扫描 ${files.length} 文件 | ` +
    `真分隔线 存量 ${stock} 枚 新增 ${newViolations} 枚 | ` +
    `结构件放过 ${excusedTotal} 枚(语义分隔件 ${totals['semantic-separator']} / 导引轨 ${totals['guide-rail']} / 可拖拽分隔器 ${totals['draggable-splitter']}) | ` +
    `彩色底放过 ${totals['accent-background']} 枚 | 未判定 ${undeterminedItems.length} 枚 ⇒ `

  if (newViolations > 0) {
    console.log(`${C.red}${C.bold}${conclusion}失败(新增 ${newViolations} 枚超基线)${C.reset}`)
    if (staged) {
      console.log(`${C.dim}跳过方法:${SKIP_ENV}=1 git commit ...${C.reset}`)
      return 1
    }
    return 0
  }
  if (undeterminedItems.length > 0) {
    console.log(`${C.yellow}${C.bold}${conclusion}未判定(形状读不出,不记绿也不冒红)${C.reset}`)
    return 2
  }
  console.log(`${C.green}${C.bold}${conclusion}通过${C.reset}`)
  if (staged) return 0
  return 0
}

// ───────────────────────────── 自检 ─────────────────────────────

function ok(cond, msg) {
  if (!cond) throw new Error(msg || '断言不成立')
}

/**
 * 判据自检(成对给夹具:每条"放过"都配同形状的"判红"对照)。
 * 必达覆盖:三型结构件各一例放过 + 真分隔线一例判红 + 一例未判定 + 棘轮算术 +
 * 形状锁(预筛是判据的超集,删掉任一支就会红)。主判定 scanSource 走真身,不测副本。
 */
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const scan = (body, rel = 'apps/web/src/components/x.tsx') => scanSource(rel, body)
  const kindOf = (body, rel) => scan(body, rel).hits[0]

  t('T01 型①语义分隔件:同元素 role="separator" ⇒ 放过', () => {
    const h = kindOf(
      'export const M = () => <div role="separator" className="my-0.5 h-px bg-border/60" aria-hidden />\n',
    )
    ok(h && h.kind === 'exempt' && h.type === 'semantic-separator', JSON.stringify(h))
  })
  t('T02 型①语义分隔件:宿主组件 *Separator(JSX 行不写 role)⇒ 放过', () => {
    const src = [
      'const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (',
      '  <DropdownMenuPrimitive.Separator',
      '    ref={ref}',
      "    className={cn('-mx-1 my-1 h-px bg-border', className)}",
      '    {...props}',
      '  />',
      '))',
      '',
    ].join('\n')
    const h = kindOf(src)
    ok(h && h.kind === 'exempt' && h.type === 'semantic-separator', JSON.stringify(h))
  })
  t('T03 型②导引轨:absolute + top/bottom 成对 + w-px ⇒ 放过', () => {
    const h = kindOf('<span className="absolute top-0 bottom-0 w-px bg-border" />\n')
    ok(h && h.kind === 'exempt' && h.type === 'guide-rail', JSON.stringify(h))
  })
  t('T04 型②导引轨:形状分散在 cn() 多行里也要认出来(top+calc 高度)', () => {
    const src = [
      'export const G = ({ open }) => (',
      '  <span',
      '    aria-hidden',
      '    className={cn(',
      "      'absolute left-[7px] w-px transition-colors',",
      "      open ? 'top-6 bottom-1 bg-border/70' : 'h-0 opacity-0',",
      '    )}',
      '  />',
      ')',
      '',
    ].join('\n')
    const h = kindOf(src)
    ok(h && h.kind === 'exempt' && h.type === 'guide-rail', JSON.stringify(h))
    // 反向锁:按物理行读会漏掉 bg-border/70(它不在发丝那一行)
    ok(scanSource('apps/web/a.tsx', "const s = 'absolute w-px'\n").hits[0] === undefined)
  })
  t(
    'T05 型③可拖拽分隔器:拥有者名 / 文件路径 pane-split|resizer ⇒ 放过(实测 RESIZER_CLASS 那一格)',
    () => {
      // 实测形状:pane-split-container.tsx 把可见细线写成 RESIZER_CLASS.x.line,
      // 那一行上既无 pane-split 也无 cursor-*(所以型③必须多看拥有者名)
      const src = [
        'const RESIZER_CLASS = {',
        '  x: {',
        "    track: 'w-2 shrink-0 cursor-col-resize',",
        "    line: 'h-full w-px bg-border',",
        '  },',
        '}',
        '',
      ].join('\n')
      const h = scan(src, 'apps/web/src/components/ai/pane-split-container.tsx').hits[0]
      ok(h && h.kind === 'exempt' && h.type === 'draggable-splitter', JSON.stringify(h))
      // 拥有者名单独也足以放过(路径不是唯一凭据)
      const h2 = scan(src, 'apps/web/src/components/other.tsx').hits[0]
      ok(h2 && h2.kind === 'exempt' && h2.type === 'draggable-splitter', JSON.stringify(h2))
      // 反向对照:普通拥有者名 + 普通路径 ⇒ 判红(豁免不是"见到 w-px 就放")
      const h3 = scan("const rowLine = {\n  line: 'h-full w-px bg-border',\n}\n").hits[0]
      ok(h3 && h3.kind === 'divider', JSON.stringify(h3))
    },
  )
  t('T06 型③可拖拽分隔器:cursor-col-resize ⇒ 放过', () => {
    const h = kindOf('<div className="h-full w-px cursor-col-resize bg-border" />\n')
    ok(h && h.kind === 'exempt' && h.type === 'draggable-splitter', JSON.stringify(h))
  })
  t('T07 真分隔线:h-px + 中性底 ⇒ 判红(不属三型)', () => {
    const h = kindOf('<div className="h-px bg-border" aria-hidden />\n')
    ok(h && h.kind === 'divider', JSON.stringify(h))
    ok(countDividers(scan('<div className="h-px bg-border" />\n')) === 1)
  })
  t('T08 反向锁:横向撑满的 absolute + h-px 仍是分隔线(轨出口只认竖轴)', () => {
    const h = kindOf('<span className="absolute left-0 right-0 top-0 h-px bg-border" />\n')
    ok(h && h.kind === 'divider', JSON.stringify(h))
  })
  t('T09 未判定:任意值单位量不出物理像素 ⇒ 不猜', () => {
    const h = kindOf('<span className="w-[0.125rem] bg-border" />\n')
    ok(h && h.kind === 'undetermined', JSON.stringify(h))
    ok(scan('<span className="w-[0.125rem] bg-border" />\n').undetermined.length === 1)
  })
  t('T10 形状收窄:彩色底放过 / 粗于发丝不进候选 / 擦除不计数', () => {
    const accent = kindOf('<span className="h-px w-8 bg-primary/60" />\n')
    ok(
      accent && accent.kind === 'exempt' && accent.type === 'accent-background',
      JSON.stringify(accent),
    )
    // 粗于发丝的尺寸是"尺寸块"不是线 ⇒ 不进候选,连放过行都不该有(否则报告被缩略图/骨架块淹掉)
    ok(
      scan('<span className="h-[4px] bg-border" />\n').hits.length === 0,
      JSON.stringify(kindOf('<span className="h-[4px] bg-border" />\n')),
    )
    ok(scan('<span className="h-[96rpx] bg-border" />\n').hits.length === 0)
    ok(countDividers(scan('<span className="h-0 bg-border" />\n')) === 0, '擦除动作不画线')
  })
  t('T11 面 B:RN height + 中性 backgroundColor ⇒ 判红', () => {
    const src =
      'const s = StyleSheet.create({\n  divider: {\n    height: StyleSheet.hairlineWidth,\n    backgroundColor: tk.border.light,\n  },\n})\n'
    const h = kindOf(src, 'packages/app/src/features/a/A.tsx')
    ok(h && h.kind === 'divider' && /RN\/内联/.test(h.label), JSON.stringify(h))
  })
  t('T12 反向锁:shadowOffset 的 height: 1 不是线(实测 5 枚)', () => {
    const src =
      'const s = StyleSheet.create({\n  card: {\n    shadowOffset: { width: 0, height: 1 },\n    shadowOpacity: 0.1,\n  },\n})\n'
    ok(scan(src, 'apps/mobile-rn/src/a.tsx').hits.length === 0, JSON.stringify(scan(src).hits))
  })
  t('T13 未判定:hairlineWidth 乘变量 ⇒ 量不到', () => {
    const src =
      'const s = {\n  bar: { height: StyleSheet.hairlineWidth * SCALE, backgroundColor: tk.border.light },\n}\n'
    const h = kindOf(src, 'apps/mobile-rn/src/a.tsx')
    ok(h && h.kind === 'undetermined', JSON.stringify(h))
  })
  t('T14 差值棘轮算术:锚点 = 该文件 HEAD 面自身命中数,只拦超出部分', () => {
    const reads = new Map([
      ['a.tsx', 3],
      ['b.tsx', 1],
    ])
    const anchors = new Map([['a.tsx', 1]])
    const over = overBaseline(reads, anchors)
    ok(over.get('a.tsx') === 2, String(over.get('a.tsx')))
    ok(over.get('b.tsx') === 1, '新文件基线 0 ⇒ 全额计新增')
    ok(
      overBaseline(new Map([['a.tsx', 1]]), new Map([['a.tsx', 5]])).get('a.tsx') === 0,
      '存量下降不得记红',
    )
  })
  t('T15 形状锁:预筛是判据的超集(删掉任一支就静默少扫)', () => {
    for (const frag of [
      '[hw]-px',
      'hairlineWidth',
      '[hw]-\\[(length:)?[0-9.]',
      '(height|width): *[0-2]',
    ]) {
      ok(PREFILTER_RE.includes(frag), `预筛缺 ${frag}:${PREFILTER_RE}`)
    }
    ok(SCAN_GLOBS.includes('*.tsx') && SCAN_GLOBS.includes('*.ts'), JSON.stringify(SCAN_GLOBS))
  })
  t('T16 注释里的不算(判据读的是遮罩面)', () => {
    ok(scan('// 旧写法:<div className="h-px bg-border" />\nexport const x = 1\n').hits.length === 0)
    ok(scan('/* <span className="w-px bg-border" /> */\nexport const x = 1\n').hits.length === 0)
  })
  t('T17 没写底色 ⇒ 不是本族(不抢 11d 的描边面)', () => {
    ok(scan('<div className="h-px w-full" />\n').hits.length === 0)
    ok(scan('<div className="w-px h-4" />\n').hits.length === 0)
  })
  t('T18 疑似连接轨带标记但照常计数(判据不替人下结论)', () => {
    const h = kindOf('<span className="mt-0.5 h-full w-px bg-border" />\n')
    ok(h && h.kind === 'divider' && h.railSuspect === true, JSON.stringify(h))
  })

  let pass = 0
  const lines = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      lines.push(`  ✅ ${c.name}`)
    } catch (e) {
      lines.push(`  ❌ ${c.name} — ${e?.message ?? e}`)
    }
  }
  console.log(lines.join('\n'))
  const total = cases.length
  console.log(`\n发丝分隔线守门自检: ${pass}/${total} 通过`)
  if (pass !== total) {
    console.log(`${C.red}❌ 自检未过 — 判据本身坏了${C.reset}`)
    return 1
  }
  console.log(`${C.green}✅ 发丝分隔线守门自检通过${C.reset}`)
  return 0
}

async function main() {
  return isSelfTest ? selfTest() : await run({ staged: isStaged, worktree: isWorktree })
}

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      // 取不到输入 ⇒ exit 2 显式「未判定」,不记绿也不冒红(§0.3)
      const undetermined = e instanceof Undetermined
      console.log(
        `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  未判定(取材失败,既不记绿也不冒红)' : '❌ 发丝分隔线守门异常'}: ${e?.message ?? e}${C.reset}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  SCAN_GLOBS,
  PREFILTER_RE,
  attributeValueSpan,
  bgNeutrality,
  bgTokensOf,
  classNameValueSpan,
  countDividers,
  excuseCounts,
  jsxTagNameAt,
  lineOfIndex,
  ownerNameOf,
  rnThinGrade,
  scanSource,
  selfTest,
  structuralTypeOf,
  thinTokensOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
