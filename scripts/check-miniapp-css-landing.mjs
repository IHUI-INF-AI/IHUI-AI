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
 *   C2 同名双义 = 源码用到的 utility 名同时被端内自有 CSS 定义为同名类。逐条列出并分类,
 *      其中 white-on-white 那一型不是"样式没生效"而是**观感事故**(白底白字),必须点名。
 *   C3 体积预算 = 按 app.json 声明的 subpackage roots 切主包量字节,对 2 MiB 上限报余量,
 *      并与 utilities 参考层体积并排给出"开了装不装得下"的算术。**只报数不判红** ——
 *      体积是决策输入,不是本门的对错。
 *
 * 口径(与守门 70/77/83/98/101 一致):
 *   源码面:全量判 **HEAD blob** / `--staged` 判**索引 blob** / `--worktree` 仅人工逃生舱。
 *   产物面:**恒为磁盘** —— dist 被 gitignore,HEAD 与索引里根本没有它,不存在第三个面。
 *   任一面取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。尤其不得把"产物不存在"
 *   报成"0% 覆盖" —— 那是把工具失效冒充成业务结论。
 *
 * 用法见 --help。镜像测试:node --test scripts/tests/check-miniapp-css-landing.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, selectFace } from './lib/face-reader.mjs'

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
 * CSS 里"某个类名被定义了哪些声明"。多规则同名时并集。
 * 只吃 `selector { decls }` 且规则体不含嵌套 `{}` —— 小程序端 CSS 无嵌套语法;遇到嵌套
 * 宁可不收,也不要把父选择器算成子规则的声明(那是假阳的直接来源)。
 */
export function harvestClassDeclarations(cssText) {
  const map = new Map()
  const stripped = stripComments(cssText)
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(stripped))) {
    const decls = m[2]
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
    if (!decls.length) continue
    CLASS_NAME_IN_SELECTOR.lastIndex = 0
    let c
    while ((c = CLASS_NAME_IN_SELECTOR.exec(m[1]))) {
      const name = unescapeClassName(c[1])
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(...decls)
    }
  }
  return map
}

/** 产物侧"真产出规则"的类名集合:必须带规则体才算落地,裸出现在文本里不算。 */
export function harvestLandedSelectors(cssText) {
  const names = new Set()
  const stripped = stripComments(cssText)
  const ruleRe = /([^{}]+)\{/g
  let m
  while ((m = ruleRe.exec(stripped))) {
    CLASS_NAME_IN_SELECTOR.lastIndex = 0
    let c
    while ((c = CLASS_NAME_IN_SELECTOR.exec(m[1]))) names.add(unescapeClassName(c[1]))
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
 * 用**端内真配置**直出 utilities 参考层,得到"这份配置下到底会产出哪些 utility"。
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
  return { names: new Set(decls.keys()), decls, bytes: Buffer.byteLength(css, 'utf8'), tailwindVersion: version }
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

/* ───────────────────────── 源码取材面 ───────────────────────── */

function git(root, args, label) {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Undetermined(`${label}失败(${String(e.stderr || e.message).trim()})`)
  }
}

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
  const list = git(root, args, `git ${args[0]} 列 ${SRC_PREFIX} 源码文件`)
    .split('\0')
    .filter(Boolean)
  if (list.length === 0) throw new Undetermined(`${face} 面在 ${SRC_PREFIX} 下列出 0 个文件,无法判定`)
  return list
}

/** 该面单文件内容;取不到返回 null,由调用方按"少扫多少个"如实计数,不静默。 */
function readSource(root, face, rel) {
  if (face === 'worktree') {
    const p = join(root, rel)
    if (!existsSync(p)) return null
    try {
      const t = readFileSync(p, 'utf8')
      return t.includes('\u0000') ? null : t
    } catch {
      return null
    }
  }
  const rev = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  try {
    return git(root, ['show', rev], `git show ${rev}`)
  } catch {
    return null
  }
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
  for (const rel of tsFiles) {
    const t = readSource(root, face, rel)
    if (t === null) {
      unreadable++
      continue
    }
    for (const tok of harvestClassNameTokens(t)) usedTokens.set(tok, (usedTokens.get(tok) || 0) + 1)
  }
  for (const rel of cssFiles) {
    const t = readSource(root, face, rel)
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

  const referenceFace = 'worktree(磁盘)'
  let reference = null
  if (opts.skipReference) {
    undetermined.push('--skip-reference:无 utility 全集 ⇒ C1 覆盖率与 C2 双义结构上判不出,只报产物规则总数')
  } else {
    try {
      reference = await buildUtilityReference(appDir)
      if (face !== 'worktree') {
        // 参考层**只能判磁盘**:tailwind 的 content globs 是生成器自己去读文件的,
        // 没有 HEAD/索引这一说。于是它与源码面天然不同面,必须大声说明,否则就是
        // "用一把随并行会话漂移的尺子量 HEAD"却对外报绿。
        notices.push(
          `参考层取材 = ${referenceFace},源码面 = ${face} —— 两把不同面。盘上被并行会话改名/删掉的类不会出现在参考层里(立因当天实测:text-card 盘上已改成 aigc-text-card,于是 C2 看不见它)。要同面对账请跑 --worktree`,
        )
      }
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      undetermined.push(`utility 参考层判不出:${e.message}`)
    }
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
  if (!undetermined.length && coverage && coverage.pct < minCoverage) {
    failing.push(
      `C1 落地覆盖率 ${(coverage.pct * 100).toFixed(2)}%(${coverage.hitKinds}/${coverage.demandedKinds} 类、${coverage.missOccurrences} 处用法无规则)< 要求的 ${minCoverage * 100}%`,
    )
  }
  // 产物引擎 vs 参考层引擎:不同 ⇒ 参考层给的是"错引擎的清单",C1 的可选集与 C3 的算术都失去依据。
  // 判红会踩"恒红门逼人绕过钩子"那条老账(本门判的是产物,产物在提交者机器上结构上未必存在),
  // 所以这里**只把结论降级成"不可据以开链"**,不改 exit。
  let productEngine = null
  try {
    productEngine = detectProductTailwindMajor(distDir)
  } catch (e) {
    if (e instanceof Undetermined) undetermined.push(`产物引擎判不出:${e.message}`)
    else throw e
  }
  const refMajor = reference?.tailwindVersion ? String(reference.tailwindVersion).split('.')[0] : null
  const engineMismatch =
    !!productEngine && productEngine.major !== 'unknown' && !!refMajor && `${productEngine.major.slice(1)}.x` !== `${refMajor}.x`
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
    productEngine,
    engineMismatch,
    referenceBytes: reference ? reference.bytes : null,
    referenceFace: reference ? referenceFace : null,
    coverage,
    missingSamples,
    dual,
    blindSpots,
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
  console.log(`取材面:源码 = ${r.face || '(未判定)'},产物 = 磁盘(dist 被 gitignore,不存在第二个面)`)
  console.log(
    `源码:${r.tsFileCount} 个 .ts/.tsx、${r.cssFileCount} 个 .css;className token ${r.usedTokenKinds} 种、端内自有类名 ${r.ownClassKinds} 种`,
  )
  if (r.tailwindVersion) console.log(`tailwind(端内解析)= ${r.tailwindVersion}`)
  if (r.productEngine) {
    console.log(
      `tailwind(产物指纹)= ${r.productEngine.major || 'unknown'}` +
        `(v4 独有 ${r.productEngine.v4Hits}/${r.productEngine.v4Total}、v3 独有 ${r.productEngine.v3Hits}/${r.productEngine.v3Total};preflight ${r.productEngine.preflight ? '在' : '无'})`,
    )
  }
  console.log(`产物形态 = ${r.distShape},wxss ${r.wxssFiles} 个`)
  if (r.engineMismatch) {
    console.log(
      `⚠️ 引擎不一致 ⇒ 下面的"参考层"是**错引擎的清单**:产物跑 ${r.productEngine.major},参考层由端内 ${r.tailwindVersion} 直出。` +
        `因此 C1 的"可选集"与 C3 的算术**都不构成"该不该开链"的依据**;要据此决策,先把参考层换成与产物同引擎再重跑。`,
    )
  }

  if (r.coverage) {
    const c = r.coverage
    console.log(
      `C1 覆盖 ${c.hitKinds}/${c.demandedKinds} 类(${(c.pct * 100).toFixed(2)}%)` +
        ` —— utility 参考层共 ${c.referenceKinds} 个可选,产物规则名共 ${c.landedRuleKinds} 个`,
    )
    if (c.missKinds) {
      console.log(`   缺失 ${c.missKinds} 类 / ${c.missOccurrences} 处用法`)
      console.log(`   缺失样例(≤${MISSING_SAMPLES}):${r.missingSamples.join(', ')}`)
    }
  } else {
    console.log('C1 覆盖:未判定(见下方「无法判定」)')
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
      const slack = b.headroomBytes - r.referenceBytes
      console.log(
        `   若开启 utilities:${b.headroomBytes} - 参考层 ${r.referenceBytes} = ${slack} B ${slack >= 0 ? '(装得下)' : '(装不下)'}` +
          (r.engineMismatch ? ' 〔⚠️ 此数按错引擎的参考层算,不得据以决策〕' : ''),
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
  runCheck,
  selfTest,
  APP_REL,
  SRC_PREFIX,
  MAIN_PACKAGE_LIMIT,
  MISSING_SAMPLES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
