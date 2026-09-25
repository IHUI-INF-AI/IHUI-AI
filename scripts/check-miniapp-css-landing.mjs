#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-css-landing.mjs —— 小程序端「源码用到的 Tailwind utility ↔ 产物里真产出规则」对账
 *
 * 为什么要有这一道(2026-09-25 立):跨端"同源对账"已有五道(36 / 37 / 93 / style-parity / radius),
 * 它们**全部只核源码与 token 源头,没有一道看产物**。实测一次真实 weapp 构建(exit 0)之后,
 * dist 的 154 个 wxss 里源码用到的 Tailwind utility **0 个产出规则**,而五道门同时全绿。
 * "写的同源"与"生效的同源"是两件事,后者此前无人看守 —— 本门补的就是这一面。
 *
 * ⚠️ 定级:**当前为手动 / CI 门,刻意不接进提交链**。它判的是构建产物,而产物在提交者机器上
 *   结构上未必存在(dist 被 .gitignore 忽略,且会被同端另一次构建整目录换掉 —— 立因当天本机 dist
 *   就在取证中途被一次 h5 构建覆盖)。接成 blocking 只会逼人 --no-verify,连带废掉全部守门
 *   (§12e 同型,本仓最高频反面教训)。镜像测试锁住「声明的接线态与实际接线态必须一致」。
 *
 * 三条判据:
 *   C1 落地覆盖率 = |源码用到 ∩ utility 参考层 ∩ dist 里真有规则| / |源码用到 ∩ utility 参考层|。
 *      低于 --min-coverage(默认 100%)即判红,并给若干缺失样例。
 *      **参考层的引擎由产物决定**(见下「引擎同源」):拿 v3 的可选集去量 v4 的产物,
 *      报出来的"还剩 N 条没落地"不是缺陷计数,是一把量错东西的尺子的读数。
 *   C2 同名双义 = 源码用到的 utility 名同时被端内自有 CSS 定义为同名类。逐条列出并分类,
 *      其中 white-on-white 那一型不是"样式没生效"而是**观感事故**(白底白字),必须点名。
 *   C3 体积预算 = 按 app.json 声明的 subpackage roots 切主包量字节,对 2 MiB 上限报余量。
 *      utilities 链**已于 2026-09-25 开链落地**(实测主包 C1 覆盖 0.79% → 32.15%,主包体积反瘦 61KB),
 *      所以这里报的是**含 utilities 落地量的实测现值** —— 旧的"若开启…装不装得下"假设算术已作废。
 *      **只报数不判红** —— 体积是决策输入,不是本门的对错。
 *
 * 引擎同源(2026-09-25 换档,本门从"报一个错引擎的数"改成"同引擎或弃权"):
 *   端 `apps/miniapp-taro/package.json` 声明 Tailwind v3,但真实 weapp 构建跑的是 **v4.3.3**
 *   (weapp-tailwindcss@5.2.9 引 `@tailwindcss/postcss`)。参考层此前恒用端内解析到的 v3 直出。
 *   现在 `auto` 档按产物 base 层指纹选引擎,选不到同引擎就 **exit 2 且一个覆盖率都不给**;
 *   v4 档的输入是实测出来的三件套(少一样分母就是错的):
 *     1. `@config '<端内 tailwind.config.ts>'` —— 缺它则 `bg-muted` / `text-card` 这类命名档整类不产出;
 *     2. `@import 'tailwindcss/theme.css'` —— 只导 utilities.css 时 `px-4` / `text-sm` 全部产不出
 *        (实测参考层可选集 762 → 599,而产物里明明有 `.px-4`);
 *     3. **候选由本门显式喂进** `compile().build(candidates)`,不用 `@source` 扫盘 ——
 *        实测 `@tailwindcss/postcss` + `@source "<端内源码>"` 在本进程里一条候选都没扫到
 *        (v4 直出 `px-4=false`),拿它当分母等于把缺陷洗成"不在可选集";显式喂候选还顺带让
 *        参考层与源码**同一个面**,消掉了原来"参考层只能判磁盘、HEAD 面在量的却是另一把尺"的缺陷。
 *   `--reference-engine v3|v4` / `--legacy-reference-v3` 是人工对比档:出数但 C1 不判红。
 *
 * 口径(与守门 70/77/83/98/101 一致):
 *   **单一判定面**:源码与参考层在同一轮取自**同一个面** ——
 *     源码面:全量判 **HEAD blob** / `--staged` 判**索引 blob** / `--worktree` 仅人工逃生舱。
 *     参考面:v4 = 与源码同面(候选由源码面 harvest 后显式喂进 compile().build());
 *             v3 = 生成器只能读 content globs(磁盘)⇒ 仅当源码面也是 worktree 才算同面;
 *                  auto 档遇到「v3 参考层 + 非 worktree 源码面」直接判「无法判定」,
 *                  **不再允许"参考层取材=磁盘、源码面=head —— 两把不同面"还照样出判定结论**
 *                  (异面读数是自洽但基准错位的假结论,本仓在守门 77/83/101 各记过一次同型)。
 *   产物面:**恒为磁盘** —— dist 被 gitignore,HEAD 与索引里根本没有它,不存在第二个 git 面;
 *     它是"产物事实"而不是第二把判定尺。
 *   任一面取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。尤其不得把"产物不存在"
 *   报成"0% 覆盖" —— 那是把工具失效冒充成业务结论。同样不得把"参考层引擎/取材面与判定不同"
 *   报成一个百分比 —— 那是把量错东西冒充成量到了东西。
 *
 * 用法见 --help。镜像测试:node --test scripts/tests/check-miniapp-css-landing.test.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_REL = 'apps/miniapp-taro'
const SRC_PREFIX = `${APP_REL}/src/`
/**
 * 本门的接线态**唯一真相源**,由镜像测试与 guardian-runner 实际内容对账。
 * 为什么要有这个常量而不是让人读注释:「手动门」和「已接提交链」都可能是真的,
 * 而漂移(改了没登记 / 登记了没改)必须被机器发现 —— 否则"刻意不接线"这件事
 * 会在某次改动后悄悄变成"忘了接线",或反过来有人把它接成 blocking 而无人知。
 *   'manual' = 刻意不进提交链(当前):判据依赖构建产物,提交者结构上未必满足。
 *   'commit' = 已接提交链:此时 runner 必须真有它,且必须带 skipEnv 应急出口。
 */
export const WIRING_MODE = 'manual'

/**
 * 接线态对账,**做成纯函数 + 可注入 runnerText**:「声明 manual 而实际被接进了提交链」与
 * 「声明 commit 而实际被摘线」两个方向都必须能红。若这段判断写在测试里,测试就只能观察到
 * 当前真值(manual + 未接线 = 绿)那一格,另外两格永远没被证明过 —— 那等于没锁。
 */
export function auditWiring({ declared, runnerText, scriptName = 'check-miniapp-css-landing.mjs' }) {
  if (!['manual', 'commit'].includes(declared)) return { ok: false, reason: `WIRING_MODE 取值非法:${declared}` }
  if (typeof runnerText !== 'string') return { ok: false, reason: 'runner 文本取不到,无法判定接线态' }
  const wired = runnerText.includes(scriptName)
  if (declared === 'manual' && wired) {
    return { ok: false, reason: `声明为手动/CI 门,但 runner 里出现了 ${scriptName} —— 被接进提交链而没改声明` }
  }
  if (declared === 'commit' && !wired) {
    return { ok: false, reason: `声明已接提交链,但 runner 里没有 ${scriptName} —— 本门被静默摘线` }
  }
  if (declared === 'commit') {
    const i = runnerText.indexOf(scriptName)
    const block = runnerText.slice(Math.max(0, i - 600), i + 600)
    if (!/skipEnv/.test(block)) return { ok: false, reason: '接进提交链的门必须留 skipEnv 应急出口,否则恒红只会逼人 --no-verify' }
  }
  return { ok: true, reason: '', wired }
}
/** 微信小程序主包硬上限(字节)。是决策算术的分母,不是本门可调参数。 */
const MAIN_PACKAGE_LIMIT = 2 * 1024 * 1024
const MISSING_SAMPLES = 5
/** 只认 className/class 后紧跟的三种字面量形态;其余写法一律不猜。 */
const CLASS_ATTR_RE = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g
/**
 * 类名体允许 CSS 转义对 `\X`(Tailwind 会把 `!visible` / `-right-[12rpx]` 里的 `!`、`[`、`]`
 * 逐个转义)。首字符仍是数字的不算类名(`.2xl` 不是合法选择器)。
 * 这条不是洁癖:本端 dist 历史上光任意值类就有 541 条规则,漏了转义等于整类隐身。
 */
const CLASS_NAME_IN_SELECTOR = /\.(-?(?![0-9])(?:\\.|[A-Za-z0-9_-])+)/g

/** `.\!visible` → `!visible`;`.-right-\[12rpx\]` → `-right-[12rpx]` */
function unescapeClassName(s) {
  return s.replace(/\\(.)/g, '$1')
}
/** 注释里的假规则不得参与判定(建门时同类假阳记过多次) */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/* ───────────────────────── 源码侧:用量与自有类 ───────────────────────── */

/** className 字面量 token。模板串里的 `${}` 段切出来多半不是类名,由 C1 的分母自然滤掉。 */
export function harvestClassNameTokens(text) {
  const tokens = []
  let m
  CLASS_ATTR_RE.lastIndex = 0
  while ((m = CLASS_ATTR_RE.exec(text))) {
    for (const tok of (m[1] ?? m[2] ?? m[3] ?? '').split(/\s+/)) if (tok) tokens.push(tok)
  }
  return tokens
}

/**
 * 花括号树切分。**这一层是两侧(参考层 / 产物)共用的唯一解析器。**
 *
 * 为什么不能用扁平的 `[^{}]+{[^{}]*}`(它是本门立项时的写法):v4 产出的类规则常常把
 * `@supports` / `@media` **嵌在自己身上**,例如实测形态
 * `.bg-primary\/10 { background-color: var(--color-primary); @supports (color: color-mix(in lab, red, red)) { … } }`
 * —— 规则体里有 `{`,扁平式整条匹配不上 ⇒ 这些 utility 从参考层里**隐身**,表现为
 * C1 的分母悄悄变小(实测 11 个真 utility 走这条形态,全是 `/alpha` 档)。**一把会藏东西的
 * 尺子比一把偏严的尺子危险得多**,所以改成逐块解析。
 *
 * 三条语义(都由 --self-test 钉住):
 *  - at-rule 块(`@media (...) {` / `@layer x {`)的头部 **不参与类名抽取** ——
 *    里面出现的 `.25rem` 之类是数值不是类;只有"选择器规则"节点 contributes 类名。
 *  - 一个类名"有规则" = 选中它的规则块**自己或任一后代块**至少有一条声明;空块不算落地
 *    (立项语义 P5「裸类名不算落地」在此保持不变)。
 *  - 引号内的 `;` / `{` / `}` 不作分隔符(`content:'{'`、`url("a;b")` 不得把解析器打断)。
 */
function ruleNodes(cssText) {
  const src = stripComments(cssText)
  const nodes = []
  let pos = 0
  function block(selector, isSelectorRule) {
    const node = { selector, isSelectorRule, decls: [], children: [] }
    nodes.push(node)
    let buf = ''
    let quote = ''
    while (pos < src.length) {
      const ch = src[pos]
      if (quote) {
        buf += ch
        pos++
        if (ch === '\\') {
          if (pos < src.length) { buf += src[pos]; pos++ }
          continue
        }
        if (ch === quote) quote = ''
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; buf += ch; pos++; continue }
      if (ch === ';' || ch === '{' || ch === '}') {
        const head = buf.trim()
        buf = ''
        pos++
        if (ch === ';') { if (head) node.decls.push(head); continue }
        if (ch === '}') { if (head) node.decls.push(head); break }
        node.children.push(block(head, !head.startsWith('@')))
        continue
      }
      buf += ch
      pos++
    }
    return node
  }
  const root = block('', false)
  nodes.shift()
  return { root, nodes }
}

function declarationsOf(node) {
  const out = []
  const walk = (n) => {
    for (const d of n.decls) if (!out.includes(d)) out.push(d)
    n.children.forEach(walk)
  }
  walk(node)
  return out
}

function classNamesIn(selector) {
  const names = []
  CLASS_NAME_IN_SELECTOR.lastIndex = 0
  let c
  while ((c = CLASS_NAME_IN_SELECTOR.exec(selector))) names.push(unescapeClassName(c[1]))
  return names
}

/**
 * CSS 里"某个类名被定义了哪些声明"。多规则同名时并集。
 * 只吃"选择器规则"节点(含嵌套),at-rule 头部 不参与。
 */
export function harvestClassDeclarations(cssText) {
  const map = new Map()
  const { nodes } = ruleNodes(cssText)
  for (const node of nodes) {
    if (!node.isSelectorRule) continue
    const decls = declarationsOf(node)
    if (!decls.length) continue
    for (const name of classNamesIn(node.selector)) {
      if (!map.has(name)) map.set(name, [])
      const bag = map.get(name)
      for (const d of decls) if (!bag.includes(d)) bag.push(d)
    }
  }
  return map
}

/** 产物侧"真产出规则"的类名集合:必须带规则体(自己或后代块里有声明)才算落地,裸出现在文本里不算。 */
/**
 * 只有"整条选择器就是一个裸类(可再带伪类)"才算该 utility 真落地。
 *
 * 为什么必须是这条判据(2026-09-25 实测抓到本门最大的一个洞):旧实现把选择器里**任何位置**的
 * 类名都算落地,于是端内手写的后代规则 `.vip-page .border-border{border-color:var(--vip-border)}`
 * 会让 `border-border` 被判成"已落地" —— 而元素只挂 `class="border-border"` 时那条规则根本不生效。
 * 后果不是数字难看一点:项目色档整族(实测 12 档 / 1,313 处裸用法)在产物里 **0 条裸类规则**,
 * 而 C1 照样报 99.89%。一把"复合规则也算数"的尺,恰好把本门立项要防的那一格量没了。
 *
 * 允许伪类/伪元素(`.hover\:bg-primary:hover`、`.focus\:outline-none:focus`)—— 那仍是单类;
 * 排除组合器与第二个类(`.a .b`、`.w-full.rounded-b-\[30rpx\]`、`.a>.b`)。
 */
const BARE_SINGLE_CLASS = /^\.-?(?![0-9])(?:\\.|[A-Za-z0-9_\u00a0-\uffff-])+(?::{1,2}[-\w]+(?:\([^)]*\))?)*$/
export function isBareUtilitySelector(sel) {
  return BARE_SINGLE_CLASS.test(String(sel).trim())
}

export function harvestLandedSelectors(cssText) {
  const names = new Set()
  const { nodes } = ruleNodes(cssText)
  for (const node of nodes) {
    if (!node.isSelectorRule) continue
    if (!declarationsOf(node).length) continue
    // 逗号组里逐条判:任一"裸类"分支成立才算这个类名落地
    for (const part of node.selector.split(',')) {
      if (isBareUtilitySelector(part)) for (const name of classNamesIn(part)) names.add(name)
    }
  }
  return names
}

/* ───────── 产物形态判别:这是不是"一次 weapp 构建的 dist" ───────── */

function walkFiles(dir, out = []) {
  let items
  try {
    items = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of items) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      // 不穿重解析点(§26:递归枚举穿过 junction 会把别人工具态误记成本仓产物)
      if (e.isSymbolicLink()) continue
      walkFiles(p, out)
    } else out.push(p)
  }
  return out
}

function countFilesWithExt(dir, ext) {
  return walkFiles(dir).filter((p) => p.endsWith(ext)).length
}

/**
 * 这一步是整个门的生命线。本端 `outputRoot` 对 weapp 与 h5 **都**解析成 `dist/`
 * (config/index.ts 只在 alipay 时切 `dist-alipay`),所以一次 `taro build --type h5`
 * 会把 weapp 产物整目录换掉(立因当天本机就是这样:取证跑到一半 154 个 wxss 全没了)。
 * 不做这层判别,门会把"h5 的 dist"读成"weapp 产物里 0 条规则",产出与真实改动无关的假红。
 */
export function classifyDist(distDir) {
  if (!existsSync(distDir)) return { kind: 'absent', reason: `产物目录不存在:${distDir}`, wxssCount: 0 }
  let entries
  try {
    entries = readdirSync(distDir)
  } catch (e) {
    return { kind: 'undetermined', reason: `产物目录读不出来:${distDir}(${e.message})`, wxssCount: 0 }
  }
  const wxssCount = countFilesWithExt(distDir, '.wxss')
  const wxmlCount = countFilesWithExt(distDir, '.wxml')
  if (entries.includes('index.html') && wxmlCount === 0) {
    return {
      kind: 'wrong-platform',
      reason:
        'dist 顶层有 index.html 且一个 .wxml 都没有 —— 这是 h5 构建的产物;weapp 与 h5 共用 outputRoot,dist 已被覆盖,需重跑 weapp 构建',
      wxssCount,
    }
  }
  if (wxmlCount === 0) {
    return { kind: 'wrong-platform', reason: 'dist 下没有任何 .wxml,不是一次 weapp 构建产物', wxssCount }
  }
  if (wxssCount === 0) {
    return { kind: 'wrong-platform', reason: 'dist 有 .wxml 但 .wxss 计数为 0,产物不完整', wxssCount }
  }
  return { kind: 'weapp', reason: '', wxssCount, wxmlCount }
}

/** dist 下全部 wxss 的落地选择器并集(恒判磁盘:HEAD/索引里没有产物)。 */
export function collectLandedFromDist(distDir) {
  const landed = new Set()
  const wxss = walkFiles(distDir).filter((p) => p.endsWith('.wxss'))
  if (wxss.length === 0) throw new Undetermined(`遍历 ${distDir} 一个 .wxss 也没读到,无法判定`)
  for (const p of wxss) {
    for (const n of harvestLandedSelectors(readFileSync(p, 'utf8'))) landed.add(n)
  }
  return { landed, wxssFiles: wxss.length }
}

/**
 * 产物实际跑的 Tailwind 大版本 —— 由 base 层指纹判,**不看 package.json**。
 *
 * 为什么必须有这一条(2026-09-25 O62附⑦):本门的 C1 判据与 C3 的"装不装得下"算术都建立在
 * "utility 参考层"上,而参考层是拿**端内解析到的** tailwind 直出的(现值 3.4.19)。可产物 base 层
 * 带的是 **v4** 指纹,且端 config 明写 `corePlugins.preflight:false` 而产物**照样有 preflight**
 * ⇒ 那份 config 根本没进链。用 v3 参考层去算 v4 构建的体积预算,算的是**错引擎的数**,
 * 而它打印的是"(装得下)"—— 一个会让人据此开链的结论。
 *
 * 两版独有的自定义属性各列一把,**必须成组用**:单看一条会误判(`--tw-ring-offset-shadow` 两版都有)。
 * 命中数只作方向,取"独有指纹谁更全"的那个版本。
 */
const V4_ONLY_PROPS = ['--tw-leading', '--tw-tracking', '--tw-gradient-position', '--tw-drop-shadow-size', '--tw-duration', '--tw-ease']
const V3_ONLY_PROPS = ['--tw-bg-opacity', '--tw-text-opacity', '--tw-border-opacity']

export function detectProductTailwindMajor(distDir) {
  const wxss = walkFiles(distDir).filter((p) => p.endsWith('.wxss'))
  if (wxss.length === 0) throw new Undetermined(`遍历 ${distDir} 一个 .wxss 也没读到,无法判定产物引擎`)
  // base 层只可能出现在 app 级 wxss(及其 @import 的 origin 件),不必拼 154 个文件
  const base = wxss
    .filter((p) => /(^|[\\/])app[^\\/]*\.wxss$/.test(p))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n')
  if (!base) throw new Undetermined('产物里没有 app 级 wxss,判不出 base 层指纹')
  const hit = (list) => list.filter((k) => base.includes(k))
  const v4 = hit(V4_ONLY_PROPS)
  const v3 = hit(V3_ONLY_PROPS)
  return {
    major: v4.length > 0 && v3.length === 0 ? 'v4' : v3.length > 0 && v4.length === 0 ? 'v3' : 'unknown',
    v4Hits: v4.length,
    v4Total: V4_ONLY_PROPS.length,
    v3Hits: v3.length,
    v3Total: V3_ONLY_PROPS.length,
    preflight: /box-sizing:\s*border-box/.test(base) && /border:\s*0\s+solid/.test(base),
  }
}

/* ───────────────────────── 主包体积(C3,只报数) ───────────────────────── */

/**
 * 按 **app.json 声明的 subpackage roots** 切主包,而不是按"不在 pkg-* 下"。
 * 立因:本端有 7 个分包根长在 `pages/` 里(pages/circle、pages/member、pages/exam …),
 * 按 pkg-* 粗切会把它们错算进主包,把余量直接报成负数(实测差 665,519 B)。
 */
export function measureMainPackage(distDir) {
  const appJsonPath = join(distDir, 'app.json')
  if (!existsSync(appJsonPath)) throw new Undetermined(`产物里没有 app.json:${appJsonPath}`)
  let app
  try {
    app = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  } catch (e) {
    throw new Undetermined(`app.json 解析失败:${e.message}`)
  }
  const roots = [...(app.subpackages || []), ...(app.subPackages || [])]
    .map((s) => String(s.root || '').replace(/^\/+|\/+$/g, '').replace(/\//g, sep))
    .filter(Boolean)
  let mainBytes = 0
  let subBytes = 0
  let fileCount = 0
  for (const p of walkFiles(distDir)) {
    const rel = relative(distDir, p)
    fileCount++
    const size = statSync(p).size
    if (roots.some((r) => rel === r || rel.startsWith(r + sep))) subBytes += size
    else mainBytes += size
  }
  if (fileCount === 0) throw new Undetermined(`产物目录为空:${distDir}`)
  return {
    subpackageRootCount: roots.length,
    fileCount,
    mainBytes,
    subBytes,
    totalBytes: mainBytes + subBytes,
    limitBytes: MAIN_PACKAGE_LIMIT,
    headroomBytes: MAIN_PACKAGE_LIMIT - mainBytes,
  }
}

/* ───────────────── utility 参考层:唯一一处跑 tailwind ───────────────── */

/**
 * 参考层必须**与产物同一个引擎**,否则 C1 的分母是"错引擎的可选集"。
 *
 * 为什么这是一道判据而不是一个日志(2026-09-25 换档):此前参考层恒用**端内解析到的 v3**
 * (3.4.19)直出,而端 `apps/miniapp-taro` 的真实 weapp 构建跑的是 **v4.3.3**
 * (由 weapp-tailwindcss@5.2.9 自带 `@tailwindcss/postcss` 引入,产物 base 层指纹可判)。
 * 用 v3 清单量 v4 产物,报出来的 "还剩 N 条没落地" 不是缺陷计数,是一把量错东西的尺子的读数。
 *
 * `auto` 档只有两种结局:**同引擎**,或**弃权(exit 2 且不给覆盖率数字)**。
 * `v3`/`v4` 是人工指定的对比档 —— 它照样出数,但 C1 不判红,输出行明写"对比档,只是读数"。
 * 这条口径来自本仓反复付过学费的一条禁令:宁可说"判不出",绝不用自信的语气报一个错的数。
 */
export function pickReferenceEngine({ productMajor, requested = 'auto' }) {
  if (requested !== 'auto' && requested !== 'v3' && requested !== 'v4')
    return { engine: null, explicit: false, reason: `--reference-engine 取值非法:${requested}(只认 auto/v3/v4)` }
  if (requested !== 'auto') return { engine: requested, explicit: true, reason: '' }
  if (productMajor === 'v3' || productMajor === 'v4') return { engine: productMajor, explicit: false, reason: '' }
  return {
    engine: null,
    explicit: false,
    reason: `产物引擎判不出(major = ${productMajor || '未知'}),无法保证参考层与产物同引擎 ⇒ 不出覆盖率`,
  }
}

/**
 * 参考层与源码面**同面**判据(2026-09-25 立,与引擎同档并列的第二把锁)。
 *
 * 为什么单独成函数:C1 是这门唯一的判红量,而"判红"的前提除了同引擎,还必须**同取材面** ——
 * 参考层由谁的材料生成,决定这把尺量的是哪一轮的世界。三条实测形态:
 *  - v4 档候选由本门从**被审的源码面** harvest 后显式喂进 ⇒ 天然同面,可判。
 *  - v3 档由 tailwind 自己读 content globs(磁盘)⇒ 只有源码面也是 worktree 时才同面;
 *    auto 档碰到「v3 + head/staged」必须**拒绝出判定数**(旧写法只挂一条"两把不同面"的
 *    notice 照样判红 —— 那是把基准错位的读数当结论,守门 77/83/101 都记过同型)。
 *  - 人工指定档(--reference-engine / --legacy-reference-v3)异面时仍可出**读数**,
 *    但 judged=false,报告行明写"对比档,不计红"。
 * 形状判据只能用纯函数 + 构造面证明(§"prove-shape-rulers"),所以面与档的分流全在这里,
 * runCheck 只消费它的结论。
 */
export function planReferenceFace({ face, engine, explicit = false }) {
  if (engine === 'v4') return { sameFace: true, judged: true, action: 'build', reason: '' }
  if (engine === 'v3') {
    if (face === 'worktree') return { sameFace: true, judged: true, action: 'build', reason: '' }
    if (explicit)
      return {
        sameFace: false,
        judged: false,
        action: 'build',
        reason: `人工对比档:参考层只能判磁盘,与 ${face} 面不同面 ⇒ 本行只是读数,不计红`,
      }
    return {
      sameFace: false,
      judged: false,
      action: 'abstain',
      reason: `v3 参考层由生成器读磁盘产出,与 ${face} 源码面天然异面 ⇒ 拒绝出判定覆盖率;要同面对账请跑 --worktree(人工档)`,
    }
  }
  return { sameFace: false, judged: false, action: 'abstain', reason: `未知参考层引擎:${String(engine)}` }
}

function majorOf(version) {
  return `v${String(version || '').split('.')[0]}`
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** v4 的入口在 exports['.'] 的 import/default 里(v4 的 main 导出会**主动报错拒绝**被当 postcss 插件用) */
function esmEntryOf(pkgDir, pkg) {
  const e = pkg.exports && pkg.exports['.']
  const rel = typeof e === 'string' ? e : (e && (e.import || e.default)) || null
  const cand = rel ? join(pkgDir, rel) : null
  if (cand && existsSync(cand)) return cand
  const fallback = join(pkgDir, 'dist', 'lib.mjs')
  if (existsSync(fallback)) return fallback
  throw new Undetermined(`tailwindcss@${pkg.version} 找不到 ESM 入口(exports['.']=${JSON.stringify(e)})`)
}

/**
 * 解析指定大版本的 tailwindcss 安装。锚点顺序 = 端目录 → 仓根,并**逐个如实记账**。
 * 实测本机:端目录解析到 3.4.19、仓根解析到 4.3.3 —— 只查一个锚点必然拿错引擎,
 * 所以这里按"要哪个大版本"筛,而不是"先解析到谁就用谁"。
 */
export function resolveTailwindInstall({ root, appDir, wantMajor }) {
  const tried = []
  for (const anchor of [appDir, root]) {
    try {
      const req = createRequire(join(anchor, 'noop.js'))
      const pkgJsonPath = realpathSync(req.resolve('tailwindcss/package.json'))
      const pkgDir = dirname(pkgJsonPath)
      const pkg = readJson(pkgJsonPath)
      tried.push(`${anchor} → ${pkg.version}`)
      if (!wantMajor || majorOf(pkg.version) === wantMajor)
        return { pkgDir, pkg, version: pkg.version, major: majorOf(pkg.version), anchor, tried }
    } catch (e) {
      tried.push(`${anchor} → 解析失败(${String(e.message).split('\n')[0].slice(0, 90)})`)
    }
  }
  throw new Undetermined(`解析不到 tailwindcss${wantMajor ? `(${wantMajor})` : ''};试过 ${tried.join(' | ')}`)
}

/**
 * pnpm 虚拟仓根:由包自己的 realpath 向上反推,不写死盘符、不写死 `D:\nm`。
 * 布局是 `<store>/<pkg目录>/node_modules/<包>`(作用域包再深一层),
 * 所以**必须先向上找到那个名为 node_modules 的祖先**,再上两级才是 store。
 * 直接对包目录数 `dirname()` 会差一层(写门时踩过:作用域包 `@tailwindcss/postcss` 的
 * 路径比裸包深一段,同一套 dirname 对裸包对、对作用域包就落到 `@tailwindcss` 上了)。
 * 结构不符(非 pnpm 布局)就如实返回 null,由调用方走下一个候选。
 */
function findPnpmStore(fromDir) {
  let cur = resolve(fromDir)
  for (let i = 0; i < 12; i++) {
    const parent = dirname(cur)
    if (parent === cur) return null
    if (basename(cur) === 'node_modules') {
      const store = dirname(parent)
      try {
        return readdirSync(store).length > 0 ? store : null
      } catch {
        return null
      }
    }
    cur = parent
  }
  return null
}

/**
 * 按包名定位它的目录。`<name>/package.json` 是最直接的,但**不少 v4 包的 exports
 * 不放开 ./package.json**(实测 `@tailwindcss/postcss` 就是这样),所以退一步:
 * 解析主入口,再向上找到 `package.json` 里 name 对得上的那一层。
 */
function resolvePkgDir(anchorDir, name) {
  const req = createRequire(join(anchorDir, 'noop.js'))
  try {
    const pj = realpathSync(req.resolve(`${name}/package.json`))
    return { pkgDir: dirname(pj), pkg: readJson(pj) }
  } catch (e) {
    const first = String(e.message).split('\n')[0].slice(0, 60)
    try {
      let cur = dirname(realpathSync(req.resolve(name)))
      for (let i = 0; i < 6; i++) {
        const pj = join(cur, 'package.json')
        if (existsSync(pj)) {
          const pkg = readJson(pj)
          if (pkg.name === name) return { pkgDir: cur, pkg }
        }
        const parent = dirname(cur)
        if (parent === cur) break
        cur = parent
      }
      return { pkgDir: null, pkg: null, reason: `主入口向上没找到 name=${name} 的 package.json(先:${first})` }
    } catch (e2) {
      return { pkgDir: null, pkg: null, reason: first }
    }
  }
}

function storeCandidates(storeDir, scopeName, wantMajor) {
  const out = []
  if (!storeDir) return out
  const prefix = `${scopeName.replace('/', '+')}@`
  let entries = []
  try {
    entries = readdirSync(storeDir)
  } catch {
    return out
  }
  for (const d of entries) {
    if (!d.startsWith(prefix)) continue
    const pkgJson = join(storeDir, d, 'node_modules', scopeName, 'package.json')
    try {
      const pkg = readJson(pkgJson)
      if (wantMajor && majorOf(pkg.version) !== wantMajor) continue
      out.push({ pkgDir: dirname(pkgJson), pkg, via: `pnpm 虚拟仓 ${basename(storeDir)}/${d}` })
    } catch {
      /* 目录名像但不是有效包(安装中/临时键)—— 跳过并留给下一个候选 */
    }
  }
  return out
}

/**
 * v4 的 CSS-first 入口需要 `@tailwindcss/node` 的 `loadModule`(它内部用 jiti 读端内
 * `tailwind.config.ts` —— 产物里的 `text-card` / `bg-muted` 这些命名档就来自那份 config)。
 * `@tailwindcss/postcss` / `@tailwindcss/node` 在 `D:\nm\.pnpm` 里**都存在,但从端目录和仓根
 * 都 resolve 不到**(实测:端锚 MODULE_NOT_FOUND;`@tailwindcss/postcss@4.3.3` 在依赖图里挂在
 * **apps/web** 那个 importer 名下,把它当"本端的依赖"读正是本仓反复登记过的那类机器事实误采)。
 * 所以候选按可靠性排、每条落空都记原因,并且**先按版本大版本筛**再谈载入:
 *  1. 由 v4 tailwindcss 的 realpath 反推虚拟仓根,按目录名 `@tailwindcss+node@<同大版本>` 取;
 *     (本机实测:命中这条,报 `pnpm 虚拟仓 .pnpm/@tailwindcss+node@4.3.3`)
 *  2. 常规 require 解析(端目录 / 仓根 —— 自己声明了它的仓与 CI 上有效);
 *  3. 先解析 `@tailwindcss/postcss`(含 apps/web 这个兜底锚点),再顺着它的位置找 node。
 * 拿到的引擎与产物同版本已核对:本仓 store 里 v4 只有 `tailwindcss@4.3.3` 一份
 * (`ls .pnpm/tailwindcss@*` 实测),而 weapp 侧的 `loadTailwindV4DesignSystem(source)` 是
 * **先解析出一个 tailwindcss 包再加载它**,不是另带一份闭合引擎 —— 所以"根上那份 4.3.3"
 * 与构建用的是同一套代码;真要证伪这一点,看的是产物指纹(`detectProductTailwindMajor`)而不是谁的 package.json。
 * 全部候选落空 ⇒ 抛 Undetermined 并列出逐候选失败原因 —— **不得**改拿 v3 凑数,
 * 也不得"退而求其次"用没有 loadModule 的入口跑一份缺 config 的参考层(那正是本次要修的错读数)。
 */
export async function resolveV4Loaders({ root, appDir, twPkgDir, wantMajor = 'v4' }) {
  const tried = []
  const cands = []
  const pushStore = (dir, label) => {
    const store = findPnpmStore(dir)
    const got = storeCandidates(store, '@tailwindcss/node', wantMajor)
    if (!got.length) tried.push(`虚拟仓(${label} → ${store || '解析不到 store'})里没有 ${wantMajor} 的 @tailwindcss/node`)
    for (const c of got) cands.push(c)
  }
  pushStore(twPkgDir, 'tailwindcss')
  for (const anchor of [appDir, root]) {
    const r = resolvePkgDir(anchor, '@tailwindcss/node')
    if (r.pkgDir && majorOf(r.pkg.version) === wantMajor) cands.push({ pkgDir: r.pkgDir, pkg: r.pkg, via: `createRequire(${anchor})` })
    else tried.push(`${anchor} → ${r.reason || `解析到 ${r.pkg && r.pkg.version},不是 ${wantMajor}`}`)
  }
  for (const anchor of [appDir, root, join(root, 'apps', 'web')]) {
    const plugin = resolvePkgDir(anchor, '@tailwindcss/postcss')
    if (!plugin.pkgDir) {
      tried.push(`经 postcss 入口(${anchor})→ ${plugin.reason}`)
      continue
    }
    pushStore(plugin.pkgDir, `@tailwindcss/postcss@${anchor}`)
    const viaPlugin = resolvePkgDir(plugin.pkgDir, '@tailwindcss/node')
    if (viaPlugin.pkgDir && majorOf(viaPlugin.pkg.version) === wantMajor)
      cands.push({ pkgDir: viaPlugin.pkgDir, pkg: viaPlugin.pkg, via: `@tailwindcss/postcss ← ${anchor}` })
    else tried.push(`经 postcss(${anchor})→ ${viaPlugin.reason || `不是 ${wantMajor}`}`)
  }
  const seen = new Set()
  for (const c of cands) {
    if (seen.has(c.pkgDir)) continue
    seen.add(c.pkgDir)
    let entry
    try {
      entry = esmEntryOf(c.pkgDir, c.pkg)
    } catch (e) {
      tried.push(`${c.via} → ${String(e.message).slice(0, 70)}`)
      continue
    }
    try {
      const mod = await import(pathToFileURL(entry).href)
      if (typeof mod.loadModule !== 'function') {
        tried.push(`${c.via} → 不导出 loadModule`)
        continue
      }
      return { loadModule: mod.loadModule, pkgDir: c.pkgDir, version: c.pkg.version, via: c.via, tried }
    } catch (e) {
      tried.push(`${c.via} → 载入失败 ${String(e.message).split('\n')[0].slice(0, 70)}`)
    }
  }
  throw new Undetermined(`解析不到 v4 的 @tailwindcss/node(loadModule);候选 ${cands.length} 个,记录:${[...tried, ...cands.map((c) => c.via)].join(' | ').slice(0, 400)}`)
}

/**
 * **v4 档参考层**:与产物同引擎,输入与构建一致 ——
 *  - `@config '<端内 tailwind.config.ts>'`:构建侧(weapp-tailwindcss 自带 config 加载器)就是拿这份 config 喂 v4 的;
 *    实测少了它 `bg-muted` / `text-card` 一类命名档整类不产出。
 *  - `@import 'tailwindcss/theme.css'`:v4 的 `px-4` / `text-sm` 取值来自 theme,实测**只导 utilities.css
 *    会让这些档全部产不出**(参考层从 762 掉到 599 个可选,分母当场少 161 条)。
 *  - 候选 = **调用方显式喂进来的类名**(取自本门正在判的那个源码面),而不是让引擎自己去扫盘。
 *    两条理由:① 实测 `@tailwindcss/postcss` + `@source "<端内源码>"` 在本进程里**一条候选都没扫到**
 *    (v4 直出 `px-4` 为 false,而产物里明明有 `.px-4`),拿它当分母等于把缺陷洗成"不在可选集";
 *    ② 显式候选让参考层与源码**同一个面**,消掉本门此前"参考层只能判磁盘、与 HEAD 不同面"的那把漂移尺。
 */
export async function buildUtilityReferenceV4({ root, appDir, candidates }) {
  if (!Array.isArray(candidates) || candidates.length === 0)
    throw new Undetermined('v4 参考层需要显式候选(源码面 harvest 出的类名),这次给了 0 个 ⇒ 判不出')
  const tw = resolveTailwindInstall({ root, appDir, wantMajor: 'v4' })
  const loaders = await resolveV4Loaders({ root, appDir, twPkgDir: tw.pkgDir, wantMajor: 'v4' })
  const configPath = join(appDir, 'tailwind.config.ts')
  if (!existsSync(configPath)) throw new Undetermined(`端内没有 tailwind.config.ts:${configPath}(命名档全出自它,缺它参考层必失真)`)
  let engine
  try {
    engine = await import(pathToFileURL(esmEntryOf(tw.pkgDir, tw.pkg)).href)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`载入 v4 引擎失败:${String(e.message).split('\n')[0].slice(0, 160)}`)
  }
  if (typeof engine.compile !== 'function')
    throw new Undetermined(`tailwindcss@${tw.version} 不导出 compile() —— 不是 v4 的低层入口,拿它直出的清单与产物不同形`)

  const loadStylesheet = async (id, base) => {
    const p =
      id === 'tailwindcss'
        ? join(tw.pkgDir, 'index.css')
        : id.startsWith('tailwindcss/')
          ? join(tw.pkgDir, id.slice('tailwindcss/'.length))
          : resolve(base || appDir, id)
    try {
      return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') }
    } catch (e) {
      throw new Undetermined(`v4 参考层取样式入口失败:${id}(base=${base} → ${p}):${e.message}`)
    }
  }
  const head = `@config '${configPath.replace(/\\/g, '/')}';\n@import 'tailwindcss/theme.css';\n`
  const run = async (cssIn) => {
    const compiler = await engine.compile(cssIn, {
      base: join(appDir, 'src'),
      from: join(appDir, 'src', 'app.css'),
      loadStylesheet,
      loadModule: loaders.loadModule,
    })
    return compiler.build(candidates)
  }

  let css
  let themeOnly
  try {
    css = await run(`${head}@import 'tailwindcss/utilities.css';\n`)
    // 净 utilities 体积 = (theme + utilities) - theme,与 v3 的 `@tailwind utilities` 口径可比(C3 用它做算术)
    themeOnly = await run(head)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    throw new Undetermined(`v4 utilities 参考层直出失败:${String(e.message).split('\n')[0].slice(0, 200)}`)
  }
  const decls = harvestClassDeclarations(css)
  if (decls.size === 0) throw new Undetermined('v4 参考层产出 0 个类名 —— 输入不成立,不得拿它当分母')
  const total = Buffer.byteLength(css, 'utf8')
  const utilitiesBytes = total - Buffer.byteLength(themeOnly, 'utf8')
  return {
    names: new Set(decls.keys()),
    decls,
    bytes: utilitiesBytes > 0 ? utilitiesBytes : total,
    bytesIsNetUtilities: utilitiesBytes > 0,
    tailwindVersion: tw.version,
    engine: 'v4',
    resolvedVia: `tailwindcss@${tw.version} ← ${tw.anchor};loadModule ← ${loaders.via}`,
    candidateKinds: candidates.length,
  }
}

/**
 * **v3 档参考层**(现只作为 `--legacy-reference-v3` 的人工对比档存在)。
 * 用**端内真配置**直出 utilities,得到"这份配置下到底会产出哪些 utility"。
 * 之所以必须问生成器而不是靠命名文法猜:`text-card` 之类既是 Tailwind 的 `text-<色档>`
 * 又是端内自有类名,只有生成器能判定它是不是真候选。
 *
 * 三条实现约束(都是实测踩出来的):
 *  1. **显式传配置绝对路径,不传 `{}`**。传 `{}` 时 tailwind v3 的 `resolveConfigPath` 因
 *     `isEmpty({})` 落到"按 process.cwd() 自动发现配置文件"那一支,参考集会随调用方 cwd 漂移
 *     (实测同一份 `{}` 在两个 cwd 下分别是 48,608 B / 1 B)。
 *  2. 用 createRequire 从**端目录**解析 —— 仓里同时装了 tailwind v3 与 v4,根目录解析到 v4,
 *     拿错版本参考层会整个变形。
 *  3. 跑不起来 ⇒ 抛 Undetermined ⇒ exit 2。**绝不退回"命名文法猜"再假装是同一个指标**。
 */
export async function buildUtilityReference(appDir) {
  const req = createRequire(join(appDir, 'noop.js'))
  let tailwindPath
  try {
    tailwindPath = req.resolve('tailwindcss')
  } catch (e) {
    throw new Undetermined(`端内解析不到 tailwindcss(${appDir}):${e.message}`)
  }
  let postcss
  let tailwindcss
  try {
    postcss = createRequire(tailwindPath)(createRequire(tailwindPath).resolve('postcss'))
    tailwindcss = req('tailwindcss')
  } catch (e) {
    throw new Undetermined(`tailwindcss/postcss 加载失败:${e.message}`)
  }
  const configPath = join(appDir, 'tailwind.config.ts')
  if (!existsSync(configPath)) throw new Undetermined(`端内没有 tailwind.config.ts:${configPath}`)

  const cwdBefore = process.cwd()
  try {
    process.chdir(appDir)
  } catch (e) {
    throw new Undetermined(`无法切到端目录做参考层直出:${e.message}`)
  }
  let css
  try {
    // tailwind v3 的 postcss 插件是**异步插件**,`LazyResult.toString()` 会直接抛
    // "Use process(css).then(cb) to work with async plugins"(建门时实测)。
    // 所以这里必须 await,不能同步求值 —— 本门因此整体是 async。
    const res = await postcss([tailwindcss(configPath)]).process('@tailwind utilities;\n', {
      from: join(appDir, 'src/app.css'),
      to: join(appDir, 'src/app.css'),
    })
    css = res.css
  } catch (e) {
    throw new Undetermined(`utilities 参考层直出失败:${e.message}`)
  } finally {
    process.chdir(cwdBefore)
  }
  const decls = harvestClassDeclarations(css)
  let version = 'unknown'
  try {
    version = req('tailwindcss/package.json').version
  } catch {
    /* 版本只是报告用,拿不到不改判定 */
  }
  return {
    names: new Set(decls.keys()),
    decls,
    bytes: Buffer.byteLength(css, 'utf8'),
    tailwindVersion: version,
    engine: majorOf(version) === 'v3' ? 'v3' : majorOf(version),
    resolvedVia: `tailwindcss@${version} ← ${appDir}`,
    candidateKinds: null,
  }
}

/* ───────────────────────── 同名双义(C2) ───────────────────────── */

const LIGHT_LITERAL =
  /#fff\b|#ffffff|\bwhite\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*[,)]|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,|hsla?\([^)]*100%\s*,\s*100%\s*,\s*100%\s*[,/)]/i
/** 本项目语义色板里恒为浅色的那一档(明暗两态取值相同,故可无条件判浅) */
const LIGHT_TOKEN =
  /var\(--color-(card|background|popover|float-indicator-bg|cta-foreground|primary-foreground|danger-foreground|success-foreground|info-foreground|warning-foreground)\b/i

function looksLight(value) {
  return LIGHT_LITERAL.test(value) || LIGHT_TOKEN.test(value)
}
function valuesFor(decls, propRe) {
  return decls.filter((d) => propRe.test(d)).map((d) => d.replace(/^[^:]+:/, ''))
}

/**
 * 分类三档,**每档处置动作不同,所以必须各有一正一反例钉住**:
 *  - white-on-white:utility 出浅色 color,自有类出浅色 background 且自己不设 color
 *    ⇒ 开启 utilities 后该元素直接白底白字。属观感事故,不是"样式没生效"。
 *  - color-overlap:两侧都设 color ⇒ 谁赢取决于样式表先后。现状自有规则在后所以自有赢,
 *    但这是"顺序对了才没事"那一类,不留证据就没人知道。
 *  - coexist:两侧属性不相交 ⇒ 同名但各管各的,仍是双义债。
 */
export function classifyDualMeaning(utilDecls, ownDecls) {
  const utilColors = valuesFor(utilDecls, /^color\s*:/)
  const ownColors = valuesFor(ownDecls, /^color\s*:/)
  const ownBgs = valuesFor(ownDecls, /^background(-color)?\s*:/)
  if (utilColors.some((v) => looksLight(v)) && ownBgs.length && ownBgs.some((v) => looksLight(v)) && !ownColors.length)
    return 'white-on-white'
  if (utilColors.length && ownColors.length) return 'color-overlap'
  return 'coexist'
}

/** 类名的命名空间前缀 = 最后一个连字符之前的部分;只有一段时即整名。 */
export function namespacePrefix(name) {
  const i = name.lastIndexOf('-')
  return i <= 0 ? name : name.slice(0, i)
}

/**
 * C2 盲区:在**所判源码面**上确实用了、且端内自有 CSS 同名定义了,但不在参考层里的类名。
 * 参考层只能判磁盘,所以盘上一改名,HEAD 仍在用的那个名字就掉出参考层 —— C2 会安静少报。
 * 把"够不到"显式列出来,才不会被读成"没有双义"。
 *
 * **只收落在 Tailwind 命名空间里的**:端内 2,143 个自有类名绝大多数(`action-btn`、
 * `agent-avatar`…)前缀下没有任何 Tailwind 规则,结构上不可能是候选;全算成盲区会报出
 * 1,500+ 条并把真那一条(`text-card`)埋掉 —— 报数报到没人看,等于没报。
 */
export function findBlindSpots(usedAndOwnClassed, referenceNames) {
  const prefixes = new Set([...referenceNames].map(namespacePrefix))
  return [...new Set(usedAndOwnClassed)]
    .filter((n) => !referenceNames.has(n) && prefixes.has(namespacePrefix(n)))
    .sort()
}

/**
 * C1 的算术,**刻意做成纯函数**:覆盖率是本门唯一判红的量。若只能在"真仓 + 真跑 tailwind"
 * 下观察它,镜像测试就证明不了它"该红时红、该绿时绿"(§22c:形状判据只能用纯函数 + 构造面证明)。
 * 分母只算 `源码用到 ∩ 参考层` —— 参考层外的名字(端内自有语义类)结构上不可能产出,
 * 纳进分母等于把覆盖率永远压低,造出一把恒红的尺子。
 */
export function computeCoverage(usedTokenNames, referenceNames, landedNames) {
  const demanded = [...new Set([...usedTokenNames].filter((n) => referenceNames.has(n)))]
  const hit = demanded.filter((n) => landedNames.has(n))
  const miss = demanded.filter((n) => !landedNames.has(n))
  return {
    demandedKinds: demanded.length,
    hitKinds: hit.length,
    missKinds: miss.length,
    pct: demanded.length === 0 ? 1 : hit.length / demanded.length,
    missOccurrences: 0,
    referenceKinds: referenceNames.size,
    landedRuleKinds: landedNames.size,
    missingSamples: miss.sort().slice(0, MISSING_SAMPLES),
  }
}

/* ───────────────────────── 源码取材面(经 scripts/lib/face-reader.mjs) ───────────────────────── */

/** 清单与内容必须同一个面(否则"glob 读盘 + 内容读 git"会造出基准错位的假绿尺子)。 */
function listSourceFiles(root, face) {
  if (face === 'worktree') {
    return walkFiles(join(root, SRC_PREFIX))
      .map((p) => relative(root, p).split(sep).join('/'))
      .sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--full-name', '-z', '--', SRC_PREFIX]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', SRC_PREFIX]
  const list = gitRaw(args, root, { timeout: 60000 }).split('\0').filter(Boolean)
  if (list.length === 0) throw new Undetermined(`${face} 面在 ${SRC_PREFIX} 下列出 0 个文件,无法判定`)
  return list
}

/**
 * 一轮把该面**全部**内容读回来(一次 `cat-file --batch`,不是每文件一次 `git show` ——
 * 539 个逐文件派生是 §5b 记过的 fork 风暴同型)。取不到的路径值为 null,
 * 由调用方按"少扫多少个"如实计数,不静默。
 */
function prefetchSource(root, face, paths) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    for (const rel of paths) map.set(rel, readWorktreeFile(root, rel))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { timeout: 120000 })
  paths.forEach((p, i) => {
    const t = got.get(specs[i]) ?? null
    map.set(p, t !== null && t.includes('\u0000') ? null : t)
  })
  return map
}

/* ───────────────────────── 主流程 ───────────────────────── */

export async function runCheck(opts) {
  const root = opts.root
  const { face, error } = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (error) return { exit: 2, face: null, undetermined: [error], failing: [], dual: [] }

  const undetermined = []
  const notices = []
  const appDir = join(root, APP_REL)
  let tsFiles = []
  let cssFiles = []
  try {
    const all = listSourceFiles(root, face)
    tsFiles = all.filter((p) => /\.(tsx|ts)$/.test(p) && !p.endsWith('.d.ts'))
    cssFiles = all.filter((p) => p.endsWith('.css'))
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    undetermined.push(`源码清单判不出:${e.message}`)
  }

  const usedTokens = new Map()
  const own = new Map()
  let unreadable = 0
  // 一轮批量取回该面全部内容(一次 cat-file --batch / 一次磁盘枚举),清单与内容同面同轮。
  const srcTexts = prefetchSource(root, face, [...tsFiles, ...cssFiles])
  for (const rel of tsFiles) {
    const t = srcTexts.get(rel) ?? null
    if (t === null) {
      unreadable++
      continue
    }
    for (const tok of harvestClassNameTokens(t)) usedTokens.set(tok, (usedTokens.get(tok) || 0) + 1)
  }
  for (const rel of cssFiles) {
    const t = srcTexts.get(rel) ?? null
    if (t === null) {
      unreadable++
      continue
    }
    for (const [name, decls] of harvestClassDeclarations(t)) {
      if (!own.has(name)) own.set(name, { decls: [], files: new Set() })
      const bag = own.get(name)
      for (const d of decls) if (!bag.decls.includes(d)) bag.decls.push(d)
      bag.files.add(rel.slice(SRC_PREFIX.length))
    }
  }
  if (unreadable) undetermined.push(`${face} 面有 ${unreadable} 个源码文件取不到内容(计入"少扫",不静默)`)

  /* ---- 产物面(先判,因为参考层要跟它同引擎) ---- */
  const distDir = join(appDir, opts.distDirname || 'dist')
  const shape = classifyDist(distDir)
  let landed = null
  if (shape.kind === 'weapp') {
    try {
      landed = collectLandedFromDist(distDir).landed
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      undetermined.push(`产物内容判不出:${e.message}`)
    }
  } else {
    undetermined.push(`产物面无法判定(${shape.kind}):${shape.reason}`)
  }
  let productEngine = null
  try {
    productEngine = detectProductTailwindMajor(distDir)
  } catch (e) {
    if (e instanceof Undetermined) undetermined.push(`产物引擎判不出:${e.message}`)
    else throw e
  }

  /* ---- utility 参考层:引擎由产物决定、取材面由 planReferenceFace 决定;做不到同引擎/同面就弃权 ---- */
  let referenceFace = null
  let reference = null
  let referenceJudged = true
  const wanted = opts.skipReference ? 'skip' : opts.legacyReferenceV3 ? 'v3' : opts.referenceEngine || 'auto'
  const picked = opts.skipReference ? { engine: null, explicit: false, reason: '--skip-reference' } : pickReferenceEngine({ productMajor: productEngine?.major || null, requested: wanted })
  const facePlan = picked.engine ? planReferenceFace({ face, engine: picked.engine, explicit: picked.explicit }) : { action: 'abstain', judged: false, sameFace: false, reason: '' }
  if (opts.skipReference) {
    undetermined.push('--skip-reference:无 utility 全集 ⇒ C1 覆盖率与 C2 双义结构上判不出,只报产物规则总数')
  } else if (!picked.engine) {
    // 同引擎不可得 ⇒ **不出覆盖率数字**。报一个错引擎的百分比,比报"判不出"危害大得多:
    // 前者会让人照着它决策(开链/收口),后者只会让人去查原因。
    undetermined.push(`参考层引擎无法确定:${picked.reason}`)
  } else if (facePlan.action === 'abstain') {
    // 同面不可得 ⇒ 同样弃权。此前这一格只挂一条"两把不同面"的 notice 就照常判红 ——
    // 基准错位的自洽读数比"判不出"更危险(守门 77/83/101 各记过一次同型)。
    undetermined.push(`参考层与源码面不同面:${facePlan.reason}`)
  } else {
    try {
      reference =
        picked.engine === 'v4'
          ? await buildUtilityReferenceV4({ root, appDir, candidates: [...usedTokens.keys()] })
          : await buildUtilityReference(appDir)
      referenceFace =
        picked.engine === 'v4'
          ? `${face}(显式候选 ${reference.candidateKinds} 个,与源码同面)`
          : `${face}(生成器读 content globs;仅 worktree 面下同面)`
      referenceJudged = facePlan.judged
      if (!facePlan.judged) notices.push(facePlan.reason)
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      reference = null
      referenceFace = null
      undetermined.push(`utility 参考层判不出(${picked.engine} 档):${e.message}`)
    }
  }
  // 参考层与产物不同引擎:默认档结构上不会再出现这一步(picked 已按产物引擎选),
  // 只有人工指定(--legacy-reference-v3 / --reference-engine)才可能不匹配。
  // 不匹配时 **C1 不计红**,只作为对比读数输出。
  const refMajor = reference ? majorOf(reference.tailwindVersion) : null
  const engineMismatch = !!reference && !!productEngine && productEngine.major !== 'unknown' && refMajor !== productEngine.major
  if (reference && !picked.explicit && engineMismatch) {
    // 兜底:万一将来又允许 auto 走出不同引擎的分支,这里必须弃权而不是报数。
    reference = null
    referenceFace = null
    undetermined.push('参考层引擎与产物引擎不一致(auto 档 ⇒ 弃权,不出覆盖率)')
  }
  // 盲区 = 「HEAD/索引这一面确实用了、且端内自有 CSS 同名定义了、但参考层里没有」的名字。
  // 它们**结构上无法被 C2 分类**,所以必须报出来 —— 只因为参考层看不见就当没有,
  // 等于把"判据够不到"洗成"没有双义"。立因当天漏掉的正是 white-on-white 那一型。
  const blindSpots = reference
    ? findBlindSpots(
        [...usedTokens.keys()].filter((n) => own.has(n)),
        reference.names,
      )
    : []
  if (blindSpots.length) {
    notices.push(
      `C2 盲区 ${blindSpots.length} 个:这些类名在 ${face} 面确实用了且自有 CSS 同名定义了,但不在参考层里 ⇒ 无法判它是否 Tailwind 候选(样例 ${blindSpots.slice(0, MISSING_SAMPLES).join(', ')})。逐个自查,不得当作零双义`,
    )
  }
  // 反向盲区 = 「产物真出了规则、源码确实用了、参考层却不认」的名字。
  // 这一维直接量的是**分母有没有在藏东西**:参考层漏认一个真 utility,
  // 症状恰恰是"覆盖率变好看"。必须报出来,不能静默。
  // 与 C2 盲区同一道过滤:**只落在 Tailwind 命名空间里** —— 端内自有类(login-btn、
  // action-btn…)前缀下没有任何 utility,结构上不可能是候选,全算进来就是 1,501 条噪声
  // (实测不过滤时正是这个数,会把真该看的那几条埋掉 —— 报数报到没人看,等于没报)。
  const referenceBlindSpots = reference && landed ? findBlindSpots([...usedTokens.keys()].filter((n) => landed.has(n)), reference.names) : []
  if (referenceBlindSpots.length) {
    notices.push(
      `参考层反向盲区 ${referenceBlindSpots.length} 个:产物里有规则、${face} 面确实用了、且落在 Tailwind 命名空间里,但参考层不认它 ⇒ 它不进 C1 分母,覆盖率因此**偏高**(样例 ${referenceBlindSpots.slice(0, MISSING_SAMPLES).join(', ')})。逐条查参考层的输入是不是还缺了构建那边的某一样(缺 theme / 缺 config / 候选没喂到),不得当成"本来就没这条规则"`,
    )
  }

  let budget = null
  try {
    budget = measureMainPackage(distDir)
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    undetermined.push(`C3 主包体积判不出:${e.message}`)
  }

  /* ---- C1 落地覆盖率 ---- */
  let coverage = null
  let missingSamples = []
  if (reference && landed) {
    coverage = computeCoverage(usedTokens.keys(), reference.names, landed)
    const miss = [...usedTokens.keys()].filter((n) => reference.names.has(n) && !landed.has(n))
    coverage.missOccurrences = miss.reduce((a, n) => a + (usedTokens.get(n) || 0), 0)
    missingSamples = coverage.missingSamples
    delete coverage.missingSamples
  }

  /* ---- C2 同名双义 ---- */
  const dual = []
  if (reference) {
    for (const name of new Set([...usedTokens.keys()].filter((n) => reference.names.has(n)))) {
      const o = own.get(name)
      if (!o) continue
      dual.push({
        name,
        kind: classifyDualMeaning(reference.decls.get(name) || [], o.decls),
        tailwind: reference.decls.get(name) || [],
        own: o.decls,
        ownFiles: [...o.files],
        usages: usedTokens.get(name) || 0,
      })
    }
  }
  const RANK = { 'white-on-white': 0, 'color-overlap': 1, coexist: 2 }
  dual.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.name.localeCompare(b.name))

  const minCoverage = opts.minCoverage ?? 1
  const failing = []
  // C1 只在"参考层与产物**同引擎**且与源码**同面**"时计红。人工对比档照样出数,
  // 但它是一句**读数**而不是一句**结论** —— 拿错引擎/错面的分母判红,和拿它判绿一样错。
  const c1Judged = !!coverage && !engineMismatch && referenceJudged
  if (!undetermined.length && c1Judged && coverage.pct < minCoverage) {
    failing.push(
      `C1 落地覆盖率 ${(coverage.pct * 100).toFixed(2)}%(${coverage.hitKinds}/${coverage.demandedKinds} 类、${coverage.missOccurrences} 处用法无规则)< 要求的 ${minCoverage * 100}%`,
    )
  }
  const exit = undetermined.length ? 2 : failing.length ? 1 : 0
  return {
    exit,
    face,
    distShape: shape.kind,
    wxssFiles: shape.wxssCount,
    tsFileCount: tsFiles.length,
    cssFileCount: cssFiles.length,
    usedTokenKinds: usedTokens.size,
    ownClassKinds: own.size,
    tailwindVersion: reference ? reference.tailwindVersion : null,
    referenceEngine: reference ? reference.engine : null,
    referenceResolvedVia: reference ? reference.resolvedVia : null,
    referenceRequested: wanted,
    c1Judged,
    productEngine,
    engineMismatch,
    referenceBytes: reference ? reference.bytes : null,
    referenceBytesIsNetUtilities: reference ? !!reference.bytesIsNetUtilities : null,
    referenceFace: reference ? referenceFace : null,
    coverage,
    missingSamples,
    dual,
    blindSpots,
    referenceBlindSpots,
    budget,
    undetermined,
    notices,
    failing,
  }
}

/* ───────────────────────── 输出 ───────────────────────── */

function report(r, asJson) {
  if (asJson) {
    const jsonable = {
      ...r,
      dual: r.dual.map((d) => ({ ...d, ownFiles: d.ownFiles })),
      budget: r.budget,
    }
    process.stdout.write(JSON.stringify(jsonable, null, 1) + '\n')
    return
  }
  console.log(
    `取材面:单一判定面 = ${r.face || '(未判定)'}(源码与参考层同面取自它);产物事实 = 磁盘 —— dist 被 gitignore,不在任何 git 面上,不构成第二把判定尺`,
  )
  console.log(
    `源码:${r.tsFileCount} 个 .ts/.tsx、${r.cssFileCount} 个 .css;className token ${r.usedTokenKinds} 种、端内自有类名 ${r.ownClassKinds} 种`,
  )
  if (r.tailwindVersion)
    console.log(
      `参考层引擎 = ${r.referenceEngine || '?'} ${r.tailwindVersion}(请求档 ${r.referenceRequested})` +
        ` —— 解析:${r.referenceResolvedVia || '(未记)'}` +
        (r.referenceFace ? `;候选取材 = ${r.referenceFace}` : ''),
    )
  if (r.productEngine) {
    console.log(
      `tailwind(产物指纹)= ${r.productEngine.major || 'unknown'}` +
        `(v4 独有 ${r.productEngine.v4Hits}/${r.productEngine.v4Total}、v3 独有 ${r.productEngine.v3Hits}/${r.productEngine.v3Total};preflight ${r.productEngine.preflight ? '在' : '无'})`,
    )
  }
  console.log(`产物形态 = ${r.distShape},wxss ${r.wxssFiles} 个`)
  if (r.engineMismatch) {
    console.log(
      `⚠️ 引擎不一致 ⇒ 下面的"参考层"是**错引擎的清单**(人工指定档 ${r.referenceRequested} 才会走到这里;auto 档遇此情形直接判「无法判定」):` +
        `产物跑 ${r.productEngine.major},参考层由 ${r.tailwindVersion} 直出。` +
        `因此 C1 的"可选集"与 C3 的算术**都不构成"该不该开链"的依据**;要据此决策,去掉人工指定档重跑。`,
    )
  }

  if (r.coverage) {
    const c = r.coverage
    console.log(
      `C1 覆盖 ${c.hitKinds}/${c.demandedKinds} 类(${(c.pct * 100).toFixed(2)}%)` +
        ` —— utility 参考层共 ${c.referenceKinds} 个可选,产物规则名共 ${c.landedRuleKinds} 个` +
        (r.c1Judged ? '' : ' 〔对比档:参考层与产物不同引擎或与源码不同面,本行只是读数,不计红〕'),
    )
    if (c.missKinds) {
      console.log(`   缺失 ${c.missKinds} 类 / ${c.missOccurrences} 处用法`)
      console.log(`   缺失样例(≤${MISSING_SAMPLES}):${r.missingSamples.join(', ')}`)
    }
  } else {
    console.log('C1 覆盖:未判定(见下方「无法判定」)—— 拿不到同引擎的参考层就**不出覆盖率数字**')
  }

  console.log(`C2 同名双义:${r.dual.length} 条`)
  for (const d of r.dual) {
    console.log(`   - ${d.name} [${d.kind}] 源码用 ${d.usages} 处`)
    console.log(`       tailwind 会出: ${d.tailwind.join('; ')}`)
    console.log(`       端内已有    : ${d.own.join('; ')}  (${d.ownFiles.join(', ')})`)
  }

  if (r.budget) {
    const b = r.budget
    console.log(
      `C3 主包 ${b.mainBytes} B / 上限 ${b.limitBytes} B ⇒ 余量 ${b.headroomBytes} B` +
        `(按 app.json 的 ${b.subpackageRootCount} 个分包根剔除)`,
    )
    if (r.referenceBytes != null) {
      console.log(
        `   utilities 参考层体积 = ${r.referenceBytes} B —— 链已开(2026-09-25 起,起效载体是 app.css 的 @source),` +
          `上方主包/余量是**含 utilities 落地量的实测现值**;旧的"若开启…装不装得下"假设算术不再成立(那组前置数实测方向是反的)。` +
          (r.referenceBytesIsNetUtilities === false ? ' 〔参考层含 theme 块,非纯 utilities 体积〕' : ''),
      )
    }
  }
  for (const u of r.undetermined) console.log(`⚠️ 无法判定:${u}`)
  for (const n of r.notices || []) console.log(`ℹ️ 如实报数(不计红):${n}`)
  for (const f of r.failing) console.log(`❌ ${f}`)
  console.log(
    `结论:exit ${r.exit} —— ${r.exit === 2 ? '未判定(既不记绿也不冒红)' : r.exit === 0 ? '通过' : '判红'}`,
  )
  console.log('注:本门当前为手动 / CI 门,未接进提交链(产物在提交者机器上结构上未必存在)。')
}

/* ───────────────── --self-test:纯判据成对正反例,零副作用 ───────── */

export function selfTest() {
  const results = []
  const eq = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    results.push({ label, ok, got: ok ? undefined : got, want: ok ? undefined : want })
  }
  const has = (label, set, v) => results.push({ label, ok: [...set].includes(v) })

  // token harvest
  eq(
    'P1 双引号 / 单引号 / 模板串三种形态都收',
    harvestClassNameTokens(`a className="flex p-3" b className='w-full' c className={\`text-sm\`} ${'x'}`).sort(),
    ['flex', 'p-3', 'text-sm', 'w-full'].sort(),
  )
  eq('P2 非 class 属性不得收', harvestClassNameTokens('href="flex items-center"'), [])

  // selector harvest
  eq('P3 注释里的假规则不算定义', [...harvestClassDeclarations('/* .fake{color:red} */ .real{color:red}').keys()], ['real'])
  eq('P4 多选择器共享规则体逐个收', [...harvestLandedSelectors('.a,.b{color:red}')], ['a', 'b'])
  eq('P5 无规则体的裸类名不算落地', [...harvestLandedSelectors('.only-parent .x')], [])
  eq('P6 转义类名反解', unescapeClassName('\\!visible'), '!visible')
  has('P7 任意值类名可收', harvestLandedSelectors('.-right-\\[12rpx\\]{right:-12rpx}'), '-right-[12rpx]')
  eq('P8 数字开头不算类名', [...harvestClassDeclarations('.2xl{a:b}').keys()], [])
  eq('P9 声明体确实带出来', harvestClassDeclarations('.flex{display:flex}').get('flex'), ['display:flex'])
  eq('P10 同名多规则的声明取并集', harvestClassDeclarations('.x{color:red}.x{padding:1px}').get('x'), ['color:red', 'padding:1px'])

  // dist 形态判别 —— 把"工具失效"和"业务结论"分开的那道闸
  const base = mkTempDir('shape')
  try {
    eq('P11 不存在的 dist 判 absent', classifyDist(join(base, 'nope')).kind, 'absent')
    mkdirSync(join(base, 'h5'), { recursive: true })
    writeFileSync(join(base, 'h5', 'index.html'), '<html>')
    writeFileSync(join(base, 'h5', 'app.js'), '')
    eq('P12 h5 覆盖必须判 wrong-platform(绝不当成 0% 覆盖)', classifyDist(join(base, 'h5')).kind, 'wrong-platform')
    const w = join(base, 'w')
    mkdirSync(join(w, 'pages'), { recursive: true })
    writeFileSync(join(w, 'app.wxss'), '@import "./a.wxss";')
    writeFileSync(join(w, 'a.wxss'), '.flex{display:flex}')
    writeFileSync(join(w, 'pages', 'i.wxml'), '<view/>')
    const s = classifyDist(w)
    eq('P13 weapp 判对并量到 wxss 数', [s.kind, s.wxssCount], ['weapp', 2])
    const partial = join(base, 'partial')
    mkdirSync(join(partial, 'pages'), { recursive: true })
    writeFileSync(join(partial, 'pages', 'x.wxml'), '')
    eq('P14 有 wxml 无 wxss ⇒ 产物不完整,判 wrong-platform', classifyDist(partial).kind, 'wrong-platform')
    const { landed, wxssFiles } = collectLandedFromDist(w)
    eq('P15 落地集合可枚举', [wxssFiles, landed.has('flex')], [2, true])
    // P15b/P15c:裸类判据的四对正反例 —— 复合手写规则不得冒充 utility 落地(本门最大的一个洞)
    eq('P15b 裸类/伪类算落地', ['a', 'b', 'c', 'd'].map((k) => isBareUtilitySelector({ a: '.flex', b: '.hover\\:bg-primary:hover', c: '.text-2xl', d: '.-top-\\[2px\\]' }[k])), [true, true, true, true])
    eq('P15c 复合/后代/双类不算落地', ['a', 'b', 'c', 'd'].map((k) => isBareUtilitySelector({ a: '.vip-page .border-border', b: '.w-full.rounded-b-\\[30rpx\\]', c: '.a>.b', d: '.dark .flex' }[k])), [false, false, false, false])
    eq(
      'P15d 落地集合只收裸类(端到端:同一份 CSS 里两种写法并存)',
      (() => {
        const s = harvestLandedSelectors('.vip-page .border-border{border-color:var(--vip-border)}\n.flex{display:flex}\n.w-full.rounded-x{width:100%}')
        return [s.has('flex'), s.has('border-border'), s.has('w-full')]
      })(),
      [true, false, false],
    )
    eq('P16 空目录 collect 必抛 Undetermined', throwsUndetermined(() => collectLandedFromDist(join(base, 'nope'))), true)
  } finally {
    rmTempDir(base)
  }

  // 同名双义分类 —— 三档各一正一反,否则分类判据等于没有
  eq(
    'P17 浅色 color × 浅色 background 且自有不设 color ⇒ white-on-white',
    classifyDualMeaning(['color:var(--color-card)'], ['background:var(--color-card)', 'padding:28rpx']),
    'white-on-white',
  )
  eq(
    'P18 自有规则自己也设 color ⇒ 降为 color-overlap(自有在样式表后,当前自有赢)',
    classifyDualMeaning(['color:var(--color-foreground)'], ['color:#111827']),
    'color-overlap',
  )
  eq('P19 两侧属性不相交 ⇒ coexist', classifyDualMeaning(['width:100%'], ['background:var(--color-card)']), 'coexist')
  eq('P20 深色 background 不得判成白底事故', classifyDualMeaning(['color:var(--color-card)'], ['background:#111827']), 'coexist')
  eq('P21 utility 不出 color ⇒ 不构成白底事故', classifyDualMeaning(['display:flex'], ['background:var(--color-card)']), 'coexist')
  eq('P22 #fff / white 字面量按浅色算', classifyDualMeaning(['color:#fff'], ['background:white']), 'white-on-white')
  eq('P23 深色 foreground 档(#0a0a0a)不得按浅色认', classifyDualMeaning(['color:var(--color-foreground)'], ['background:var(--color-card)']), 'coexist')

  // C2 盲区:参考层判磁盘、源码判 HEAD 时,"盘上改名但 HEAD 还在用"的那批必须被点名,
  // 否则 C2 的少报会表现为"没有双义"—— 立因当天正是这样漏掉了 white-on-white 那一型。
  eq('P23a 前缀切到最后一个连字符', namespacePrefix('text-muted-foreground'), 'text-muted')
  eq('P23a2 无前缀的裸名整名即前缀', namespacePrefix('visible'), 'visible')
  // 正例:text-card 的前缀 text 在参考层里确有邻居(text-sm)⇒ 它落在 Tailwind 命名空间,"参考层看不见"必须被点名
  eq(
    'P23b 用了且自有同名、参考层没有、但前缀属 Tailwind 命名空间 ⇒ 记盲区',
    findBlindSpots(['text-card'], new Set(['text-sm', 'flex'])),
    ['text-card'],
  )
  // 反例:action-btn 的前缀 action 在参考层里没有任何邻居 ⇒ 结构上不可能是 Tailwind 候选,
  // 不得混进盲区(否则报出 1500+ 条,把真那一条埋掉 = 等于没报)
  eq(
    'P23c 不属任何 Tailwind 命名空间的自有类不得记盲区',
    findBlindSpots(['action-btn', 'agent-avatar'], new Set(['text-sm', 'flex'])),
    [],
  )
  eq('P23d 参考层全覆盖时盲区必须为空(不得凭空造盲区)', findBlindSpots(['flex'], new Set(['flex'])), [])
  eq('P23e 盲区去重且稳定排序', findBlindSpots(['text-b', 'text-a', 'text-b'], new Set(['text-sm'])), ['text-a', 'text-b'])

  // C1 算术:该红必红、该绿必绿,且分母只算参考层内的名字(否则造出一把恒红的尺子)
  eq(
    'P23f 全缺失 ⇒ pct 0 并点名样例',
    (() => {
      const c = computeCoverage(['flex', 'text-sm', 'w-full'], new Set(['flex', 'text-sm', 'w-full']), new Set())
      return [c.pct, c.demandedKinds, c.missKinds, c.missingSamples.length]
    })(),
    [0, 3, 3, 3],
  )
  eq(
    'P23g 全落地 ⇒ pct 1、无缺失',
    (() => {
      const c = computeCoverage(['flex', 'text-sm'], new Set(['flex', 'text-sm']), new Set(['flex', 'text-sm', 'bg-red-500']))
      return [c.pct, c.missKinds, c.landedRuleKinds]
    })(),
    [1, 0, 3],
  )
  eq(
    'P23h 参考层外的自有类不得进分母(否则覆盖率被永远压低=恒红)',
    computeCoverage(['flex', 'action-btn', 'my-title'], new Set(['flex']), new Set(['flex'])).demandedKinds,
    1,
  )
  eq(
    'P23i 部分落地按命中数计',
    computeCoverage(['a', 'b', 'c'], new Set(['a', 'b', 'c']), new Set(['a'])).pct,
    1 / 3,
  )
  eq('P23j 分母为空不得当成 0 覆盖(无需求=无可判)', computeCoverage(['x'], new Set(), new Set()).pct, 1)
  const b2 = mkTempDir('budget')
  try {
    const d = join(b2, 'dist')
    mkdirSync(join(d, 'pages', 'circle'), { recursive: true })
    mkdirSync(join(d, 'pkg-ai'), { recursive: true })
    const appJson = JSON.stringify({
      pages: ['pages/index/index'],
      subpackages: [{ root: 'pages/circle' }, { root: 'pkg-ai' }],
    })
    writeFileSync(join(d, 'app.json'), appJson)
    writeFileSync(join(d, 'app.wxss'), 'x'.repeat(100))
    writeFileSync(join(d, 'pages', 'circle', 'i.wxss'), 'y'.repeat(500))
    writeFileSync(join(d, 'pkg-ai', 'a.wxss'), 'z'.repeat(700))
    const m = measureMainPackage(d)
    const wantMain = Buffer.byteLength(appJson) + 100
    eq('P24 pages/ 下的分包根必须剔除,不得算进主包', [m.mainBytes, m.subBytes], [wantMain, 1200])
    eq('P25 余量 = 上限 - 主包', m.headroomBytes, MAIN_PACKAGE_LIMIT - wantMain)
    eq('P26 分包根计数按 app.json 实数', m.subpackageRootCount, 2)
    eq('P27 缺 app.json ⇒ Undetermined', throwsUndetermined(() => measureMainPackage(join(d, 'pages'))), true)

    // P28-P30:产物引擎指纹判据(参考层用错引擎 ⇒ C1 的可选集与 C3 的算术都失去依据)
    const engRoot = mkTempDir('eng')
    const engBase = join(engRoot, 'dist')
    mkdirSync(engBase, { recursive: true })
    const V4 = '--tw-leading:;--tw-tracking:;--tw-gradient-position:initial;--tw-drop-shadow-size:;--tw-duration:initial;--tw-ease:initial;'
    const V3 = '--tw-bg-opacity:1;--tw-text-opacity:1;--tw-border-opacity:1;'
    writeFileSync(join(engBase, 'app.wxss'), '@import "./app-origin.wxss";')
    // P28 纯 v4 指纹 ⇒ v4,且 preflight 在(端 config 明写 preflight:false 时这就是"config 没进链"的证据)
    writeFileSync(
      join(engBase, 'app-origin.wxss'),
      `page{box-sizing:border-box;border:0 solid}${V4}.a{color:red}`,
    )
    eq('P28 只有 v4 指纹 ⇒ v4 + preflight 在', (() => { const r = detectProductTailwindMajor(engBase); return [r.major, r.preflight, r.v4Hits, r.v3Hits] })(), ['v4', true, 6, 0])
    // P29 纯 v3 指纹 ⇒ v3(反向对照:否则本判据等于恒答 v4)
    writeFileSync(join(engBase, 'app-origin.wxss'), `page{margin:0}${V3}`)
    eq('P29 只有 v3 指纹 ⇒ v3 且 preflight 不在', (() => { const r = detectProductTailwindMajor(engBase); return [r.major, r.preflight] })(), ['v3', false])
    // P30 两版指纹同时出现 ⇒ unknown,不得猜一个方向
    writeFileSync(join(engBase, 'app-origin.wxss'), `${V4}${V3}`)
    eq('P30 两版指纹都有 ⇒ unknown(不猜)', detectProductTailwindMajor(engBase).major, 'unknown')
  } catch (e) {
    results.push({ label: 'P24-P30 主包切分与产物引擎', ok: false, got: String(e).slice(0, 200) })
  } finally {
    rmTempDir(b2)
  }

  /* ---- P31–P38:v4 产物的嵌套语义(换引擎后新暴露的一类"分母在藏东西") ----
     v4 会把 @supports / @media **嵌在类规则自己身上**,例如实测形态
       .bg-primary\/10 { background-color: var(--color-primary); @supports (color: color-mix(in lab, red, red)) { … } }
     旧的扁平解析器对这种规则**整条匹配不上** ⇒ 类名从参考层隐身 ⇒ 分母变小、覆盖率虚高。
     这组正反例就是把这一型钉死:漏收即红。 */
  eq(
    'P31 类规则自带 @supports 嵌套时仍必须收到该类和它自己的声明',
    [
      [...harvestLandedSelectors('.bg-primary\\/10{background-color:var(--color-primary);@supports (color:color-mix(in lab,red,red)){background-color:color-mix(in oklab,var(--color-primary)10%,transparent)}}')],
      harvestClassDeclarations('.bg-primary\\/10{background-color:var(--color-primary);@supports (x:y){color:red}}').get('bg-primary/10'),
    ],
    [['bg-primary/10'], ['background-color:var(--color-primary)', 'color:red']],
  )
  eq('P32 反向对照:@media 嵌在类规则里但全树零声明 ⇒ 不算落地(不得把空壳当规则)', [...harvestLandedSelectors('.a{@media (min-width:24rem){}}')], [])
  eq('P33 at-rule 头部 里的数值不得被当成类名', [...harvestLandedSelectors('@media (min-width: 24.5rem){.c{color:red}}')], ['c'])
  eq('P34 @supports 条件里的逗号/百分号不得产出假类名', [...harvestLandedSelectors('@supports (color: color-mix(in lab, red 50%, red)){.d{color:red}}')], ['d'])
  eq('P35 值里的花括号与分号(引号内)不得打断解析', [...harvestLandedSelectors('.e{content:"{"}.f{color:red}.g{background:url("a;b.png")}')].sort(), ['e', 'f', 'g'])
  eq(
    'P36 多层嵌套(类 > @media > 声明)逐层收',
    [...harvestLandedSelectors('@layer utilities{.h{color:red}.i{@media (width>=40rem){color:blue}}}')].sort(),
    ['h', 'i'],
  )
  eq('P37 空规则体仍不算落地(立项语义不得被嵌套改造带跑)', [...harvestLandedSelectors('.j{}')], [])
  // P38-P42:参考层引擎择档(auto = 同引擎,判不出即弃权)
  eq('P38 auto + 产物 v4 ⇒ 参考层走 v4,且不是人工档', pickReferenceEngine({ productMajor: 'v4' }), { engine: 'v4', explicit: false, reason: '' })
  eq('P39 auto + 产物 v3 ⇒ 走 v3(反向对照:否则本判据等于恒答 v4)', pickReferenceEngine({ productMajor: 'v3' }).engine, 'v3')
  eq(
    'P40 auto + 引擎判不出 ⇒ 必须弃权(engine null 并给原因),不得继续报一个覆盖率',
    (() => {
      const r = pickReferenceEngine({ productMajor: 'unknown' })
      return [r.engine, r.explicit, typeof r.reason === 'string' && r.reason.length > 0]
    })(),
    [null, false, true],
  )
  eq('P41 人工指定 v3 对比档 ⇒ 放行且标 explicit(由调用方决定不判红)', pickReferenceEngine({ productMajor: 'v4', requested: 'v3' }), { engine: 'v3', explicit: true, reason: '' })
  eq(
    'P42 非法档名 ⇒ 弃权并点名,不静默按 auto 跑',
    (() => {
      const r = pickReferenceEngine({ productMajor: 'v4', requested: 'v9' })
      return [r.engine, /非法/.test(r.reason)]
    })(),
    [null, true],
  )

  // P43–P46:参考层与源码面**同面**判据(2026-09-25 立)。
  // 关键形状是"**同一份产物输入,只换源码面,结论必须换**"——P43 与 P44 就差一个 face。
  eq(
    'P43 异面必拒:引擎档 v3 × 源码面 head ⇒ abstain(不再"两把不同面"照样出判定数)',
    (() => {
      const r = planReferenceFace({ face: 'head', engine: 'v3', explicit: false })
      return [r.action, r.sameFace, r.judged, /异面/.test(r.reason)]
    })(),
    ['abstain', false, false, true],
  )
  eq(
    'P44 同面正常出结论:引擎档 v3 × 源码面 worktree ⇒ build 且可判(与 P43 只差面)',
    planReferenceFace({ face: 'worktree', engine: 'v3', explicit: false }).action,
    'build',
  )
  eq('P44a 同面正向的另一半:v3 × worktree 时 judged 必须为 true(否则 P44 只证了 action)', planReferenceFace({ face: 'worktree', engine: 'v3', explicit: false }).judged, true)
  eq('P45 v4 档候选由被审面喂入 ⇒ 任何源码面都同面、可判', planReferenceFace({ face: 'head', engine: 'v4' }), { sameFace: true, judged: true, action: 'build', reason: '' })
  eq(
    'P46 人工对比档:异面仍出**读数**,但 judged=false(报告行必须标"不计红")',
    (() => {
      const r = planReferenceFace({ face: 'staged', engine: 'v3', explicit: true })
      return [r.action, r.sameFace, r.judged]
    })(),
    ['build', false, false],
  )

  let failed = 0
  for (const x of results) {
    console.log(`${x.ok ? '✅' : '❌'} ${x.label}${x.ok ? '' : ` got=${JSON.stringify(x.got)} want=${JSON.stringify(x.want)}`}`)
    if (!x.ok) failed++
  }
  console.log(`--self-test:${results.length} 例,失败 ${failed}`)
  return failed === 0 ? 0 : 1
}

function throwsUndetermined(fn) {
  try {
    fn()
    return false
  } catch (e) {
    return e instanceof Undetermined
  }
}

/* 临时夹具落仓库内 .ihui-agent/tmp(§15/§15b 指定的项目内唯一临时落点,已 gitignore)。
   刻意不用 os.tmpdir() —— 活进程的 TEMP 可能仍钉在 C 盘(§26 实测)。 */
function mkTempDir(tag) {
  const p = join(DEFAULT_ROOT, '.ihui-agent', 'tmp', `css-landing-selftest-${tag}`)
  rmTempDir(p)
  mkdirSync(p, { recursive: true })
  return p
}
function rmTempDir(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

function parseArgs(argv) {
  const o = { minCoverage: 1 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--staged') o.staged = true
    else if (a === '--worktree') o.worktree = true
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--skip-reference') o.skipReference = true
    else if (a === '--legacy-reference-v3') o.legacyReferenceV3 = true
    else if (a === '--reference-engine') o.referenceEngine = argv[++i]
    else if (a === '--min-coverage') o.minCoverage = Number(argv[++i])
    else if (a === '--dist-dirname') o.distDirname = argv[++i]
    else if (a === '--root') o.root = resolve(argv[++i])
    else if (a === '--help' || a === '-h') o.help = true
    else throw new Error(`未知参数:${a}`)
  }
  return o
}

const HELP = `用法:node scripts/check-miniapp-css-landing.mjs [选项]
  --staged            源码判索引 blob(与 --worktree 互斥)
  --worktree          源码判磁盘(人工排查,不作门禁)
  --json              机器可读输出
  --min-coverage <n>  C1 阈值 0..1,默认 1;传 0 = 只观测不计红
  --skip-reference    不跑 tailwind(C1/C2 结构上判不出,如实计入「无法判定」)
  --reference-engine <auto|v3|v4>
                      参考层引擎。默认 auto = **跟产物同引擎、并与源码判定同面**:
                      v4 候选由被审的源码面 harvest 后显式喂入(天然同面);
                      v3 生成器只能读磁盘 ⇒ 仅 --worktree 下算同面,auto+v3+HEAD 判「无法判定」。
                      判不出产物引擎、或同引擎那套工具链解析不到 ⇒ 直接 exit 2 且**不出覆盖率数字**。
                      显式指定 v3/v4 是人工对比档:照样出数,但 C1 不判红。
  --legacy-reference-v3
                      = --reference-engine v3 的别名(与换档前的口径逐位对账时用)
  --dist-dirname <d>  换产物目录名(默认 dist)
  --root <dir>        仓库根(镜像测试夹具通道)
  --self-test         纯判据成对正反例(零副作用)
退出码:0 通过 / 1 判红 / 2 无法判定(既不记绿也不冒红)
定级:当前为手动 / CI 门,**未接进提交链**。`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  if (opts.selfTest) return selfTest()
  let r
  try {
    r = await runCheck({ ...opts, root: opts.root || DEFAULT_ROOT })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      console.log('结论:exit 2 —— 未判定')
      return 2
    }
    throw e
  }
  report(r, opts.json)
  return r.exit
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  harvestClassNameTokens,
  harvestClassDeclarations,
  harvestLandedSelectors,
  isBareUtilitySelector,
  unescapeClassName,
  classifyDist,
  detectProductTailwindMajor,
  collectLandedFromDist,
  measureMainPackage,
  classifyDualMeaning,
  findBlindSpots,
  namespacePrefix,
  computeCoverage,
  buildUtilityReference,
  buildUtilityReferenceV4,
  pickReferenceEngine,
  planReferenceFace,
  resolveTailwindInstall,
  resolveV4Loaders,
  majorOf,
  runCheck,
  selfTest,
  APP_REL,
  SRC_PREFIX,
  MAIN_PACKAGE_LIMIT,
  MISSING_SAMPLES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
