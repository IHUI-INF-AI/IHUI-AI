#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 分割线守门 — 拦住"用描边画一条分隔线"这一型视觉元素。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制)与"禁止分割线(强制)":
 *   禁止 `<hr>` / divide-y / divide-x / 单边 border-t/b/l/r 当纯分隔线。
 *   允许:容器完整描边(border border-border)、背景色对比、间距分隔(gap-* / space-y-*)。
 *
 * 判定四族:
 *   1) divide-y / divide-x        → BLOCKING(出现即违规,无合法 UI 用途)
 *   2) 字面量 `<hr>`              → BLOCKING(仅 .tsx 的真实 JSX;字符串/注释内豁免)
 *   3) 单边低透明度描边(如 border-t border-border/50)→ WARN(不阻塞)
 *   4) **单边不透明描边**(如 `border-b border-border`、`<tr className="border-t">`)
 *      → 差值棘轮 BLOCKING(2026-10-23 立)
 *
 * 为什么第 4 族走差值棘轮而不是"出现即拦":机主 2026-10-22 定档"界面里不该有分割线",
 * 而存量按当次 HEAD 现读(散在几十页)。把存量挂成绝对红就是 §12e 的恒红门 —— 唯一结局
 * 是人人 --no-verify 连带废掉全部门。锚点 = **该文件 HEAD 面自身的命中数**:只拦"本次提交
 * 把它加回来 / 加得比 HEAD 更多",逐页清存量时只报数。
 *
 * 第 4 族怎么和 AGENTS.md 允许的"结构性边框"区分(容器完整边框系统 / 引用块左边框 /
 * IDE diff 面板都不是分隔线)—— 全部按**可机械判定的形状**收窄,不做语义猜测:
 *   · 同一行还写了整圈宽度(`border` / `border-2`)或双轴(`border-x` / `border-y`)
 *     ⇒ 这一边只是"整圈边框系统里的一格 override",放过;
 *   · 单边宽度 ≥2(`border-l-4`、`border-b-2`)⇒ 强调条 / 下划线式选中态,放过;
 *   · 描边颜色不是中性档(非 border|input|muted|card|background,且非 gray|neutral|slate|zinc|stone-N)
 *     ⇒ 彩色强调,放过;`transparent` 同理(根本没画线);
 *   · 同一格同时收一条横边 + 一条竖边(`border-b border-r`)⇒ 网格 / 箱体收口(课程表、考勤矩阵
 *     每格自画 bottom+right 的那种格线),放过;只把同向两条(`border-t border-b`)照样判 —— 那是两条线;
 *   · 竖边 + 同轴缩进对(`ml-4 border-l pl-2`)⇒ 引用块左条 / 树形缩进导引线(§4 明文允许
 *     "引用块左边框"),放过;横边不享受这一条;
 *   · 宽度为 0(`last:border-b-0`)⇒ 擦除动作,放过。
 * 已知不在射程的形状:实心 CSS 字符串(`border-bottom:1px`)、深色面上的 `border-white/10`。
 * 判据宁窄勿宽 —— 漏的那部分由全量档报数暴露,不许为凑数反手放宽。
 *
 * 取材面纪律(§0.4):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、棘轮锚点判 HEAD blob;
 * 清单与内容同面同轮,都出自 ./lib/face-reader.mjs。此前本门"清单取索引、内容读磁盘"正是
 * §5c 2026-10-15 记过的那一型(盘上改好但没提交 ⇒ 门报绿而 CI 必红)。
 *
 * 用法:
 *   node scripts/check-no-divider.mjs --staged     pre-commit(新增违规则 exit 1)
 *   node scripts/check-no-divider.mjs              全量扫描报告(存量只报数, exit 0)
 *   node scripts/check-no-divider.mjs --worktree   人工逃生舱:量盘上清偿进度(读磁盘,可能撞并发席的半编辑态,
 *                                                  不作提交门禁;§0.4 规定的第三面)
 *   node scripts/check-no-divider.mjs --self-test  判据自检(含主判定路径)
 *   node scripts/check-no-divider.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
 */
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isWorktree = process.argv.includes('--worktree')
const isSelfTest = process.argv.includes('--self-test')
const isHelp = process.argv.includes('--help')

const GIT_TIMEOUT = 120_000

/** §22d 双形态入口:被镜像测试 import 时不得执行 skip/--help/主流程,也不得 process.exit */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
// 守卫排在 isDirectRun 里:本文件同时被镜像测试 import,顶层 process.exit 会把测试进程带走。
if (isDirectRun && process.env.HUSKY_SKIP_NO_DIVIDER === '1') {
  console.log('⏭  分割线守门(HUSKY_SKIP_NO_DIVIDER=1, 跳过)')
  process.exit(0)
}

if (isDirectRun && isHelp) {
  console.log(`
check-no-divider.mjs — 分割线守门

用法:
  node scripts/check-no-divider.mjs --staged     pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-divider.mjs              全量扫描报告(存量只报数, exit 0)
  node scripts/check-no-divider.mjs --worktree    人工逃生舱:量盘上进度(不作提交门禁, exit 0)
  node scripts/check-no-divider.mjs --self-test  判据自检
  node scripts/check-no-divider.mjs --help       本帮助

判定:
  - divide-y / divide-x:出现即违规(BLOCKING,注释行豁免)
  - <hr 标签:.tsx 真实 JSX 出现即违规(BLOCKING,字符串/注释内豁免)
  - 单边低透明度描边(border-t border-border/50):WARN(非阻塞)
  - 单边不透明描边(border-b border-border、<tr className="border-t">):差值棘轮 BLOCKING
    锚点 = 该文件 HEAD 面自身命中数;存量只报数,超出基线才拦提交
  - 整圈边框、双轴(border-x/y)、宽度≥2 的强调条、彩色描边、横竖各一边的网格收口、
    竖边+同轴 ml/pl 的缩进轨(引用块左条/树形导引线)、宽度 0 的擦除 ⇒ 结构性,放过
`)
  process.exit(0)
}

/** 只扫源码(class 工具类不会出现在纯 CSS 产物之外;CSS 侧由跨端 token 门管) */
const SCAN_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx']

/** git grep 预筛:必须是各族判据的**超集**,否则清单面比内容面窄 = 静默少扫 */
const PREFILTER_RE = 'divide-[yx]|<hr|border-[tblr]'

/** 违规模式:divide-y / divide-x(独立 class token;用 \b 词边界,兼容引号包裹的 className) */
const VIOLATION_RE = /\bdivide-[yx]\b/

/** 违规模式:字面量 <hr 标签(无歧义分割线,大小写敏感匹配小写 hr 元素) */
const HR_RE = /<hr\b/

/** 单边方向档(AGENTS.md §4 点名的正是这四条边) */
const SIDE_TOKENS = new Set(['t', 'b', 'l', 'r'])
/** 双轴档 = 一次画两条对边,属"整圈边框系统"的一种,不按纯分隔线判 */
const AXIS_TOKENS = new Set(['x', 'y'])
/** 中性描边色档(这些档就是"线"本身;其余色名一律当强调) */
const NEUTRAL_COLOR_ROOTS = new Set(['border', 'input', 'muted', 'card', 'background'])
const NEUTRAL_SHADE_RE = /^(?:gray|neutral|slate|zinc|stone)-\d+$/

/** class 字符集:字母数字 + 连字符/冒号/斜杠/方括号/点/下划线/括号/@% */
const CLASS_TOKEN_RE = /[A-Za-z0-9_[\]./:()@%,-]+/g

/**
 * 把一个 class token 拆成分割线判据要的形状信息。
 * 变体前缀(hover: / dark: / last: / [&>div]:)一律剥掉,只看最后一段真 class。
 * @returns {{kind:'full'|'axis'|'side'|'color', side?:string, width?:number, color?:string, opacity:number|null}|null}
 */
export function classifyBorderToken(cls) {
  const head = cls.includes(':') ? cls.slice(cls.lastIndexOf(':') + 1) : cls
  if (!head.startsWith('border')) return null
  const slash = head.indexOf('/')
  const body = slash < 0 ? head : head.slice(0, slash)
  const opacityRaw = slash < 0 ? null : head.slice(slash + 1)
  const opacity = opacityRaw !== null && /^\d+$/.test(opacityRaw) ? Number(opacityRaw) : null
  const segs = body.split('-')
  if (segs[0] !== 'border') return null
  if (segs.length === 1) return { kind: 'full', opacity }
  const second = segs[1]
  if (/^\d+$/.test(second)) return { kind: 'full', width: Number(second), opacity }
  if (AXIS_TOKENS.has(second)) return { kind: 'axis', opacity }
  if (SIDE_TOKENS.has(second)) {
    if (segs.length === 2) return { kind: 'side', side: second, width: 1, opacity }
    if (/^\d+$/.test(segs[2]))
      return { kind: 'side', side: second, width: Number(segs[2]), opacity }
    return { kind: 'side', side: second, width: 1, color: segs.slice(2).join('-'), opacity }
  }
  return { kind: 'color', color: segs.slice(1).join('-'), opacity }
}

/** 没写颜色 ⇒ 继承全局中性描边档;写了非中性色档 ⇒ 强调,不算分隔线 */
export function isNeutralBorderColor(name) {
  if (name === undefined || name === null) return true
  if (NEUTRAL_COLOR_ROOTS.has(name)) return true
  return NEUTRAL_SHADE_RE.test(name)
}

/**
 * 缩进轨指纹:这一行的 class 里,每条被收的竖边都在**同一轴**上配齐了
 * `m<l|r>-` / `mx-`(把整块推离基准)与 `p<l|r>-` / `px-`(内容与轨之间的导流)。
 * 三条全齐 = 引用块 / 树形导引线(AGENTS.md §4 允许),不是分隔线。
 */
export function hasIndentRailPair(line, sides) {
  const has = (re) => re.test(line)
  return [...sides].every((s) => {
    const margin = new RegExp(`(?:[\\w.-]+:)*m(?:${s}|x)-(?:\\d+|\\[[^\\]]*\\])`)
    const pad = new RegExp(`(?:[\\w.-]+:)*p(?:${s}|x)-(?:\\d+|\\[[^\\]]*\\])`)
    return has(margin) && has(pad)
  })
}

/**
 * 单行判定(纯函数;自检与 CLI 共用同一实现,§0.6 单一真相源)。
 * @returns {{level:'warn'|'blocking', label:string, col:number}|null}
 */
export function classifyDividerLine(line) {
  const tokens = []
  for (const m of line.matchAll(CLASS_TOKEN_RE)) {
    const parsed = classifyBorderToken(m[0])
    if (parsed) tokens.push({ parsed, col: m.index + 1 })
  }
  if (tokens.length === 0) return null
  // 整圈 / 双轴宽度在场 ⇒ 这一边只是边框系统里的一格 override,AGENTS.md 明示允许
  if (tokens.some((t) => t.parsed.kind === 'full' || t.parsed.kind === 'axis')) return null
  const sides = tokens.filter((t) => t.parsed.kind === 'side')
  if (sides.length === 0) return null
  // 宽度 0 = 擦除动作(如 last:border-b-0),不画线
  const drawn = sides.filter((t) => t.parsed.width > 0)
  if (drawn.length === 0) return null
  // 粗边(≥2px)= 强调条 / 选中下划线
  if (drawn.some((t) => t.parsed.width >= 2)) return null
  // 彩色(含 transparent)描边 = 强调,不是中性分隔线
  const colored = tokens.some(
    (t) =>
      (t.parsed.kind === 'side' || t.parsed.kind === 'color') &&
      !isNeutralBorderColor(t.parsed.color),
  )
  if (colored) return null
  // 同一格同时收**一条横边 + 一条竖边** = 网格 / 箱体的角(课程表、考勤表、排班矩阵那种
  // 每格自己画 bottom+right 的格线),不是"两块内容之间的一条线" ⇒ AGENTS.md 的"容器边框收口"。
  // 刻意只认垂直相交的那一组:`border-t border-b`(上下各一条)是**两条**分隔线,照判。
  const drawnSides = new Set(drawn.map((t) => t.parsed.side))
  if (
    (drawnSides.has('t') || drawnSides.has('b')) &&
    (drawnSides.has('l') || drawnSides.has('r'))
  ) {
    return null
  }
  // 引用块左条 / 树形缩进导引线:AGENTS.md §4 明文允许"引用块左边框"。这一族的机械指纹是
  // **竖边 + 同轴的缩进对**(m?- 与 p?- 同时在场)—— 块被推离基准线、内容又与轨留了导流,
  // 那这根边就是"缩进块的轨",不是两块内容之间的线。横边(t/b)一律不享受这一条 ——
  // `mt-3 border-t pt-2` 正是本轮清掉最多的那一型分隔线,横边也走这条出口就等于"加一对 mt/pt 就能遮红"。
  if ([...drawnSides].every((s) => s === 'l' || s === 'r') && hasIndentRailPair(line, drawnSides)) {
    return null
  }
  const first = drawn[0]
  // 带透明度 ⇒ 老那一档"伪分割线",维持 WARN(存量清完再谈升档)
  if (tokens.some((t) => t.parsed.opacity !== null)) {
    return { level: 'warn', label: 'low-opacity single border', col: first.col }
  }
  return { level: 'blocking', label: 'single-side divider', col: first.col }
}

/**
 * 块注释遮罩:内容替换为空格、保留换行,行号与原文件逐行对齐。
 * 字符串字面量**不遮** —— 生成器往 HTML 里拼 `border-b` 也是真违规(code-generator.ts 实测即此型)。
 */
export function maskBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * 整份源码判据。
 * @returns {{hard: Array, single: Array}} hard=族 1/2(无条件违规),single=族 3/4(带 level)
 */
export function scanSource(relPath, text) {
  const hard = []
  const single = []
  const isTsx = relPath.endsWith('.tsx')
  const lines = maskBlockComments(text).split('\n')
  lines.forEach((line, idx) => {
    if (isExemptLine(line)) return
    const lineNumber = idx + 1
    const dm = VIOLATION_RE.exec(line)
    if (dm) {
      hard.push({
        line: lineNumber,
        col: dm.index + 1,
        label: line.match(/divide-y\b/) ? 'divide-y' : 'divide-x',
        snippet: line.trim().slice(0, 140),
      })
      return
    }
    if (isTsx) {
      const code = stripStringsAndComments(line)
      const hm = HR_RE.exec(code)
      if (hm) {
        hard.push({
          line: lineNumber,
          col: hm.index + 1,
          label: '<hr>',
          snippet: line.trim().slice(0, 140),
        })
        return
      }
    }
    const sd = classifyDividerLine(line)
    if (sd) {
      single.push({
        line: lineNumber,
        col: sd.col,
        level: sd.level,
        label: sd.label,
        snippet: line.trim().slice(0, 140),
      })
    }
  })
  return { hard, single }
}

/** 族 4 的计数口径 —— 棘轮锚点与本轮读数必须用同一把尺子(§22c) */
export function countOpaqueSingles(scan) {
  return scan.single.filter((f) => f.level === 'blocking').length
}

/**
 * 去除行内字符串字面量与注释,用于 <hr 判定。
 * 真实 JSX <hr 元素永远不会出现在字符串/注释内,故剥离后残留的 <hr 才属真实违规;
 * 字符串字面量(如 markdown→HTML 的 '<hr/>')与注释中的 <hr 会被一并去除,避免误报。
 */
function stripStringsAndComments(line) {
  let out = ''
  const n = line.length
  let i = 0
  while (i < n) {
    const c = line[i]
    const c2 = line[i + 1]
    if (c === '/' && c2 === '//') break // 行注释:余下全部跳过
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(line[i] === '*' && line[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      i++
      while (i < n) {
        if (line[i] === '\\') {
          i += 2
          continue
        }
        if (line[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 豁免判定 — 返回 true 表示该行不算违规。仅豁免注释行(// 单行、/* 块注释、* 列表项、
 * JSX {/* 块注释),以及行内 // 注释之后出现的 divide-(说明性注释)。
 * divide-y / divide-x 无合法 UI 用途,故不做内容豁免。
 */
function isExemptLine(line) {
  const trimmed = line.trim()
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true
  const m = line.match(/divide-[yx]\b/)
  if (m && line.slice(0, m.index).includes('//')) return true
  return false
}

// ───────────────────────────── 取材(face-reader 共用层) ─────────────────────────────

/**
 * 候选清单:git grep 预筛。退出码 1 = 无命中(合法的零候选);其它非零 ⇒ Undetermined。
 * `git grep <rev>` 输出带 `<rev>:` 前缀,必须剥掉,否则 catBatch 规格变成 `HEAD:HEAD:…`。
 */
function grepCandidates(top, face) {
  const args =
    face === 'staged'
      ? ['grep', '--cached', '-I', '-l', '-E', PREFILTER_RE, '--', ...SCAN_GLOBS]
      : face === 'worktree'
        ? ['grep', '-I', '-l', '-E', PREFILTER_RE, '--', ...SCAN_GLOBS]
        : ['grep', '-I', '-l', '-E', PREFILTER_RE, 'HEAD', '--', ...SCAN_GLOBS]
  let out
  try {
    out = gitRaw(args, top, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
  return String(out)
    .split(/\r?\n/)
    .map((p) => p.trim())
    .map((p) => (face === 'staged' ? p : p.replace(/^HEAD:/, '')))
    .filter((p) => p.length > 0)
    .filter((p) => p.startsWith('apps/') || p.startsWith('packages/'))
    .filter((p) => !p.split('/').some((seg) => isExcludedDirName(seg)))
}

/** 一轮取材:清单与正文同面(`HEAD:<path>` / `:<path>`)。取不到不回落另一个面(§0.4)。 */
function readFace(top, face, files) {
  if (files.length === 0) return new Map()
  const out = new Map()
  if (face === 'worktree') {
    // 人工逃生舱:盘上可能正被并发席删着 ⇒ 缺文件只跳过并计数,不拿机器态伪装成业务结论
    let skipped = 0
    for (const rel of files) {
      const src = readWorktreeFile(top, rel)
      if (src === null) {
        skipped += 1
        continue
      }
      out.set(rel, src)
    }
    if (skipped > 0) {
      console.log(
        `${C.dim}· worktree 档跳过盘上不存在的文件 ${skipped} 个(清单仍来自被跟踪面)${C.reset}`,
      )
    }
    return out
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${pre}${p}`)
  const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  for (let i = 0; i < files.length; i++) {
    const src = got.get(specs[i])
    if (src === null || src === undefined) {
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} blob 取不到 ${files[i]} ⇒ 该面无法判定(不冒红也不记绿)`,
      )
    }
    out.set(files[i], src)
  }
  return out
}

/**
 * `git diff --cached --name-status -M -z` 解析:区分 A / rename 与取材失败(rename 基线要跟旧路径走)。
 *
 * ⚠️ **不带 pathspec** —— 实测(git 2.56.0,2026-10-23):同一份改名,带上
 * `-- <新路径>` 后 git 直接报 `A`(改名配对被 pathspec 单边限死,它看不见删除那一侧),
 * 于是"rename 从旧路径带基线"这一支永远不会命中,存量会被读成新增。守门 213 的
 * `nameStatusMap` 至今还带着 pathspec,那条分支在它那里同样是死的(本门先修自己那一份)。
 * 整份 staged diff 一次问完即可,不比逐文件派生贵。
 *
 * 另一格如实登记的局限:内容很短的文件(实测 81 字节的 tsx)git 自己就不配成 R 而报 A ⇒
 * 这类改名会按"新文件基线 0"判。宁可用一次可见的红换"不猜",不为此再造一把启发式尺子。
 */
function nameStatusMap(top) {
  const out = gitRaw(['diff', '--cached', '--name-status', '-M', '-z'], top, {
    timeout: GIT_TIMEOUT,
  })
  const map = new Map()
  const tokens = String(out).split('\0')
  let i = 0
  while (i < tokens.length) {
    const st = tokens[i]
    if (!st) {
      i += 1
      continue
    }
    if (/^[RC]/.test(st)) {
      const old = tokens[i + 1]
      const nw = tokens[i + 2]
      if (nw) map.set(nw, { status: st[0], old: old ?? null })
      i += 3
      continue
    }
    const p = tokens[i + 1]
    if (p) map.set(p, { status: st[0], old: null })
    i += 2
  }
  return map
}

/**
 * 棘轮锚点:每个候选文件在 **HEAD 面**自身的族 4 命中数。
 * 新文件基线 0;rename 基线从旧路径带;两者都证明不了 ⇒ Undetermined(不拿"当成新文件"冒红)。
 */
function buildAnchor(top, candidates, contents) {
  const anchor = new Map()
  const need = candidates.filter(
    (rel) => countOpaqueSingles(scanSource(rel, contents.get(rel))) > 0,
  )
  if (need.length === 0) return anchor
  const specs = need.map((r) => `HEAD:${r}`)
  const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  const status = nameStatusMap(top)
  const pendings = []
  for (const rel of need) {
    const src = got.get(`HEAD:${rel}`) ?? null
    if (src !== null) {
      anchor.set(rel, countOpaqueSingles(scanSource(rel, src)))
      continue
    }
    const st = status.get(rel)
    if (st && st.status === 'A') {
      anchor.set(rel, 0) // 新文件基线 0(不是取材失败)
      continue
    }
    if (st && st.old) {
      pendings.push({ rel, old: st.old })
      continue
    }
    throw new Undetermined(
      `HEAD blob 取不到 ${rel} 且 name-status 既不判 A 也不判 rename ⇒ 无法判定(不冒红也不记绿)`,
    )
  }
  if (pendings.length > 0) {
    const ospecs = pendings.map((p) => `HEAD:${p.old}`)
    const ogot = catBatch(top, ospecs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
    for (const p of pendings) {
      const osrc = ogot.get(`HEAD:${p.old}`) ?? null
      if (osrc === null) {
        throw new Undetermined(`rename 基线源 HEAD blob 取不到 ${p.old}(${p.rel}) ⇒ 无法判定`)
      }
      anchor.set(p.rel, countOpaqueSingles(scanSource(p.old, osrc)))
    }
  }
  return anchor
}

/**
 * 被审面"本次提交新增的行号"集合,供 divide / <hr 两族使用(出现即拦,不按基线)。
 * 族 4 **不用**这一把尺子:逐页清存量时同文件其余命中的行号会挪位,按行号拦会把"正在往下清"
 * 的动作判成新增 —— 那是 §12e 恒红门的另一副面孔。
 *
 * `--diff-filter` 必须带 **R**:实测(2026-10-23)只写 `ACM` 时"改名 + 改内容"这一档整个
 * 从 diff 里消失(连 `+++ b/` 头都没有),于是改名后的页面根本不进候选 —— 上面那行
 * `rename 基线从旧路径带` 的分支也就永远走不到,门对"改名顺带把描边留住"这一型失明。
 * 纯改名没有 "+" 行,依旧自然落在射程外,不会因此多拦。
 */
function getStagedAddedLines(top) {
  const result = new Map()
  let output
  try {
    output = gitRaw(['diff', '--cached', '-U0', '--diff-filter=ACMR', '--no-color'], top, {
      timeout: GIT_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? m[1] : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      curFile = null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行,不推进 curLine
      } else {
        curLine++
      }
    }
  }
  return result
}

// ───────────────────────────── 主流程 ─────────────────────────────

export async function run({ staged, worktree }) {
  const top = assertRepoRoot(ROOT, '分割线守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.red}❌ ${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face

  console.log(
    `${C.cyan}${C.bold}[分割线守门] 扫描 divide-y / divide-x / <hr> / 单边描边...${C.reset}`,
  )
  console.log(
    `${C.dim}规则: AGENTS.md 第 4 节 — 禁止 divide-y/divide-x/<hr>/单边 border-t|b|l|r 当分割线,改用 space-y-* 间距或 bg-muted 对比${C.reset}`,
  )
  console.log(
    `${C.dim}取材面: ${face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱,不作提交门禁)' : 'HEAD blob'};单边不透明描边按「该文件 HEAD 自身命中数」做差值棘轮${C.reset}`,
  )
  console.log('')

  const addedLines = staged ? getStagedAddedLines(top) : null
  const candidates0 = staged
    ? grepCandidates(top, face).filter((rel) => addedLines.has(rel))
    : grepCandidates(top, face)
  if (candidates0.length === 0) {
    console.log(
      `${C.green}✅ ${staged ? '暂存区无含分割线类 token 的源码变更,跳过' : '被审面无含分割线类 token 的源码文件,跳过'}${C.reset}`,
    )
    return 0
  }
  const contents = readFace(top, face, candidates0)
  const candidates = candidates0.filter((rel) => contents.has(rel))
  const addedLinesMap = staged ? addedLines : null
  const anchor = staged ? buildAnchor(top, candidates, contents) : new Map()

  let hardNew = 0
  let hardStock = 0
  let dividerNew = 0
  let dividerStock = 0
  let warnStock = 0
  const reports = []

  for (const rel of candidates) {
    const scan = scanSource(rel, contents.get(rel))
    const allowed = staged ? addedLinesMap?.get(rel) : null
    const items = []

    for (const f of scan.hard) {
      if (staged && allowed && allowed.has(f.line)) {
        hardNew++
        items.push({ ...f, level: 'blocking', tag: '被审面新增' })
      } else {
        hardStock++
        items.push({ ...f, level: 'stock', tag: staged ? '未改动行(HEAD 存量)' : '存量' })
      }
    }

    // 族 4:判据是**计数**(超出基线才算红),点名是**取证**(整族逐行给出落点)。
    // 不这样分开写,清理动作就会因为行号挪位而被读成"新增"。
    const blockers = scan.single.filter((x) => x.level === 'blocking')
    const base = staged ? (anchor.get(rel) ?? 0) : blockers.length
    const over = Math.max(0, blockers.length - base)
    dividerNew += over
    dividerStock += blockers.length - over
    for (const f of blockers) {
      items.push({
        ...f,
        level: over > 0 ? 'blocking' : 'stock',
        tag: over > 0 ? `超出 HEAD 基线 ${base}` : '存量',
      })
    }
    for (const f of scan.single.filter((x) => x.level === 'warn')) {
      warnStock++
      items.push({ ...f, level: 'warn', tag: '存量' })
    }

    if (items.length > 0) {
      reports.push({ file: relative(top, rel).split('\\').join('/'), items })
    }
  }

  const blockingTotal = hardNew + dividerNew
  console.log(`${C.bold}扫描结果:${C.reset}`)
  console.log(`  扫描文件: ${candidates.length} 个`)
  console.log(
    `  拦截数:   ${blockingTotal} 处 (BLOCKING:divide/<hr> 新增 ${hardNew},单边描边超基线 ${dividerNew})`,
  )
  console.log(
    `  存量:     ${hardStock + dividerStock} 处 (divide/<hr> ${hardStock},单边描边 ${dividerStock}) — 只报数(§12e)`,
  )
  console.log(`  告警:     ${warnStock} 处 (WARN:低透明度单边描边,不阻塞)`)
  console.log('')

  if (reports.length === 0) {
    console.log(`${C.green}${C.bold}✅ 分割线守门通过${C.reset}`)
    return 0
  }

  if (blockingTotal > 0) {
    console.log(`${C.red}${C.bold}❌ 发现 ${blockingTotal} 处违规 + ${warnStock} 处告警:${C.reset}`)
  } else {
    console.log(
      `${C.yellow}${C.bold}⚠️  本次提交无新增违规;下列 ${hardStock + dividerStock} 处存量与 ${warnStock} 处告警待逐页清偿${C.reset}`,
    )
  }
  console.log('')
  for (const { file, items } of reports) {
    const head = items.some((i) => i.level === 'blocking') ? C.red : C.yellow
    console.log(`${head}${file}${C.reset}`)
    for (const f of items) {
      const tag = f.level === 'blocking' ? C.red : f.level === 'warn' ? C.yellow : C.dim
      const lvl = f.level === 'blocking' ? '[BLOCKING]' : f.level === 'warn' ? '[WARN]' : '[存量]'
      console.log(
        `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${tag}${lvl} [${f.label}] ${f.tag}${C.reset} ${f.snippet}`,
      )
    }
    console.log('')
  }
  console.log(`${C.dim}修复方法:${C.reset}`)
  console.log(`  1. 列表容器用 space-y-* 间距分隔(推荐,§4 允许的"间距分隔")`)
  console.log(`  2. 或用 bg-muted / bg-card 背景色对比区分区块(§4 允许的"背景色对比")`)
  console.log(`  3. 容器完整描边用 border border-border(单边 border-t/b/l/r 当分割线仍禁止)`)
  console.log(`  4. <hr> 标签一律禁止,改用上述替代方案`)
  console.log(`  5. 单边描边若确属结构性(整圈边框系统的一格 / 引用块左条 / IDE diff 面板),`)
  console.log(`     把宽度写进 ≥2 或换彩色档即落在判据之外;纯分隔线一律改间距或背景对比`)
  console.log(`  6. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"`)
  console.log('')

  if (staged && blockingTotal > 0) {
    console.log(`${C.red}${C.bold}❌ 分割线守门失败 — 提交已阻止${C.reset}`)
    console.log(`${C.dim}跳过方法:HUSKY_SKIP_NO_DIVIDER=1 git commit ...${C.reset}`)
    return 1
  }
  if (!staged) {
    console.log(
      `${C.yellow}${C.bold}⚠️  ${face === 'worktree' ? '工作树档只供人工量进度(exit 0,不作提交门禁)' : '全量模式仅报数(exit 0)'}${C.reset}`,
    )
  }
  return 0
}

// ───────────────────────────── 自检 ─────────────────────────────

function ok(cond, msg) {
  if (!cond) throw new Error(msg || '断言不成立')
}

/**
 * 判据自检。成对给夹具(每条"放过"都必须有同形状的"判红"对照),并覆盖主判定
 * scanSource —— 只测 helper 而主路径坏了,门一跑就红在自检之外(本仓记过那一型)。
 */
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const hit = (line) => classifyDividerLine(line)

  t('S01 不透明单边描边 ⇒ blocking', () => {
    const r = hit('  return <div className="border-b border-border px-3" />')
    ok(r && r.level === 'blocking' && r.label === 'single-side divider', JSON.stringify(r))
  })
  t('S02 无颜色 token 的裸 border-t ⇒ blocking', () => {
    const r = hit('  <tr key={d.date} className="border-t" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
  })
  t('S03 低透明 ⇒ 仍 WARN(不悄悄升档)', () => {
    const r = hit('  <div className="border-t border-border/50" />')
    ok(r && r.level === 'warn', JSON.stringify(r))
  })
  t('S04 整圈描边 + 单边 override ⇒ 放过(结构性:容器边框系统的一格)', () => {
    ok(hit('  <div className="border border-border border-r" />') === null)
    ok(hit('  <div className="border border-border border-t-0" />') === null)
  })
  t('S05 双轴 border-x ⇒ 放过', () => {
    ok(hit('  <div className="border-x border-border" />') === null)
  })
  t('S06 宽度≥2 强调条 ⇒ 放过', () => {
    ok(hit('  <div className="border-l-4 border-info" />') === null)
  })
  t('S07 下划线式选中态 ⇒ 放过', () => {
    ok(hit("  'rounded-none border-0 border-b-2 border-accent text-accent'") === null)
  })
  t('S08 单边彩色 compound 名 ⇒ 放过', () => {
    ok(hit("  ? 'text-primary border-l-brand-accent-deep bg-muted'") === null)
  })
  t('S09 擦除动作 last:border-b-0 ⇒ 放过', () => {
    ok(hit('  <div className="grid gap-4 px-4 py-3 last:border-b-0" />') === null)
  })
  t('S10 transparent ⇒ 放过', () => {
    ok(hit("  'flex border-l-2 border-transparent'") === null)
  })
  t('S11 中性色阶 gray-200(RN 分隔线)⇒ blocking', () => {
    const r = hit('  <View className="border-b border-gray-200 px-4" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
  })
  t('S12 驼峰 CSS-in-JS 键不误伤', () => {
    ok(hit("  const s = { borderTopWidth: 1, borderBottomColor: '#eee' }") === null)
  })
  t('S13 主判定:注释行整族豁免', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      '// 这里曾有 border-b border-border 与 divide-y\nexport const z = 1\n',
    )
    ok(r.hard.length === 0 && r.single.length === 0)
  })
  t('S14 主判定:块注释里的 <hr> 不算违规', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      '/* 旧模板产出的 <hr/> 已移除 */\nexport const P = () => <div />\n',
    )
    ok(r.hard.length === 0)
  })
  t('S15 主判定:.tsx 真实 <hr> ⇒ hard', () => {
    const r = scanSource('apps/web/a.tsx', 'export const P = () => <div><hr /></div>\n')
    ok(r.hard.length === 1 && r.hard[0].label === '<hr>', JSON.stringify(r))
  })
  t('S16 主判定:.ts 字符串里的 <hr> 不算', () => {
    const r = scanSource('apps/api/x.ts', "export const s = '<hr/>'\n")
    ok(r.hard.length === 0)
  })
  t('S17 主判定:divide-y 无条件违规', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => <ul className="divide-y"><li>a</li></ul>\n',
    )
    ok(r.hard.length === 1 && r.hard[0].label === 'divide-y')
  })
  t('S18 主判定:同一行 divide 优先,不重复报单边', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => <ul className="divide-y border-b border-border" />\n',
    )
    ok(r.hard.length === 1 && r.single.length === 0, JSON.stringify(r))
  })
  t('S19 主判定:生成器拼进 HTML 的分隔线是真违规', () => {
    const r = scanSource(
      'apps/api/code-generator.ts',
      'const html = `<div className="flex justify-between border-b py-2">x</div>`\n',
    )
    ok(r.single.length === 1 && r.single[0].level === 'blocking', JSON.stringify(r))
  })
  t('S20 同文件多行分别计数(棘轮按计数比大小)', () => {
    const r = scanSource(
      'apps/web/a.tsx',
      'export const P = () => (\n  <div>\n    <div className="border-t border-border" />\n    <div className="border-b border-border" />\n  </div>\n)\n',
    )
    ok(countOpaqueSingles(r) === 2, String(countOpaqueSingles(r)))
  })
  t('S21 反向断言:摘掉透明度即从 WARN 落 blocking', () => {
    ok(hit('  <div className="border-t border-muted/30" />')?.level === 'warn')
    ok(hit('  <div className="border-t border-muted" />')?.level === 'blocking')
  })
  t('S22 形状锁:预筛是判据的超集(border-[tblr] 一族必在清单面)', () => {
    ok(PREFILTER_RE.includes('border-[tblr]'))
    ok([...SIDE_TOKENS].every((s) => 'tblr'.includes(s)))
  })
  t('S23 形状锁:族 4 未点名整圈边框 ⇒ 结构性出口不许被删', () => {
    ok(classifyBorderToken('border')?.kind === 'full')
    ok(classifyBorderToken('border-2')?.kind === 'full')
    ok(classifyBorderToken('hover:border')?.kind === 'full')
    ok(classifyBorderToken('border-y')?.kind === 'axis')
    ok(classifyBorderToken('border-b')?.kind === 'side')
    ok(classifyBorderToken('border-b-0')?.width === 0)
    ok(classifyBorderToken('border-b-brand-accent-deep')?.color === 'brand-accent-deep')
    ok(classifyBorderToken('rounded-lg') === null)
  })
  t('S24 网格收口:同格横边 + 竖边各一 ⇒ 放过(课程表/考勤矩阵那种每格自画格线)', () => {
    ok(hit('  <div className="min-h-[60px] border-b border-r p-1" />') === null)
    ok(hit('  <div className="border-t border-l p-2" />') === null)
  })
  t('S25 反向对照:同向两条边是两条分隔线,照判', () => {
    const h = hit('  <div className="border-t border-b px-3 py-2" />')
    ok(h && h.level === 'blocking', JSON.stringify(h))
    const v = hit('  <div className="border-l border-r px-3 py-2" />')
    ok(v && v.level === 'blocking', JSON.stringify(v))
  })
  t('S26 反向对照:单边仍判红 —— 网格档只放过垂直相交的那一组', () => {
    ok(hit('  <div className="border-b border-r p-1" />') === null)
    ok(hit('  <div className="border-b p-1" />')?.level === 'blocking')
  })
  t('S27 缩进轨:竖边 + 同轴 ml/pl 成对 ⇒ 放过(引用块左条 / 树形导引线)', () => {
    ok(hit('  <div className="ml-4 border-l border-border pl-2 pt-1" />') === null)
    ok(hit('  <div className="mr-4 border-r border-border pr-2" />') === null)
    ok(hit('  <div className="mx-2 border-l border-border/40 px-2" />') === null)
  })
  t('S28 反向对照:缺任一半缩进对就照判(border-l 不能靠加点 padding 混过去)', () => {
    ok(
      hit('  <div className="flex w-72 shrink-0 flex-col border-l bg-card" />')?.level ===
        'blocking',
    )
    ok(hit('  <div className="ml-4 border-l border-border" />')?.level === 'blocking')
    ok(hit('  <div className="border-l border-border pl-2" />')?.level === 'blocking')
  })
  t('S29 横边不享受缩进轨出口(最常见的遮红形状:mt-3 border-t pt-2)', () => {
    const r = hit('  <div className="mt-3 border-t border-border pt-2" />')
    ok(r && r.level === 'blocking', JSON.stringify(r))
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
  console.log(`\n分割线守门自检: ${pass}/${total} 通过`)
  if (pass !== total) {
    console.log(`${C.red}❌ 自检未过 — 判据本身坏了${C.reset}`)
    return 1
  }
  console.log(`${C.green}✅ 分割线守门自检通过${C.reset}`)
  return 0
}

if (isDirectRun) {
  try {
    const code = isSelfTest ? selfTest() : await run({ staged: isStaged, worktree: isWorktree })
    process.exit(code)
  } catch (e) {
    // 取不到输入 ⇒ exit 2 显式「未判定」,不记绿也不冒红(§0.3)
    const undetermined = e instanceof Undetermined
    console.log(
      `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  无法判定(取材失败,既不记绿也不冒红)' : '❌ 分割线守门异常'}: ${e?.message ?? e}${C.reset}`,
    )
    process.exit(2)
  }
}

export const __test__ = {
  classifyBorderToken,
  classifyDividerLine,
  hasIndentRailPair,
  isNeutralBorderColor,
  maskBlockComments,
  scanSource,
  countOpaqueSingles,
  selfTest,
  PREFILTER_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
