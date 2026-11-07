#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 侧栏/抽屉宽度一致性守门 (2026-07-22 立,2026-11-07 判据重写)
 *
 * 防的是同一件事的三种坏法:
 *  ① CSS 镜像值与 JS 生效值不一致 ⇒ 首屏 CSS 预设 → JS 覆盖的宽度跳变闪烁;
 *  ② 端内又写一份数字(第二份真相)⇒「数值碰巧相等而不同源」,改一处不生效;
 *  ③ 改了档却只有一半人跟着改 ⇒ 三端宽度分叉。
 *
 * 期望值唯一来源 = `packages/design-tokens/src/geometry.js` 的 GEOMETRY_PX:
 *  · drawerWidth            展开默认宽(web 常驻侧栏 / RN 抽屉 / 小程序抽屉)
 *  · sidebarMaxWidth        桌面拖拽上限
 *  · sidebarCollapsedWidth  折叠态宽度
 *
 * 2026-11-07 判据重写(机主要求「三端同一数字、改一处生效」)。旧版三个结构性缺陷:
 *  A. 期望值取自 `sidebar.tsx` 的字面量 ⇒ 把第二份真相当基准,跨端不同源永远判绿;
 *  B. 引用校验只问「文件里出现过 `rnGeometry.x` 吗」(存在性),于是
 *     `= rnGeometry.drawerWidth + 40`、`Number('160')` + 一行陪跑 `void rnGeometry.x` 全绿;
 *  C. 扫描面只有 barrel 一个文件,而 2026-08-28 起真正的宽度消费在 `sidebar/` 子模块里。
 * 现在:绑定式校验(右侧必须**整体**是档引用或可解到档的别名)+ 扩到 `sidebar/` 全目录
 * + CSS 取不到 / 非 px 单位一律 exit 2 未判定(原先只警告 ⇒ 删掉 token 反而判绿)。
 *
 * 用法:
 *   node scripts/check-sidebar-width-consistency.mjs           全量
 *   node scripts/check-sidebar-width-consistency.mjs --staged  仅相关文件被 staged 时检查
 * 退出码:0 一致 / 1 判红 / 2 未判定(取不到判据输入,AGENTS §0.3:不记绿也不冒红)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = process.cwd()
const wantsStaged = process.argv.includes('--staged')

/**
 * 取面解析(2026-11-07 补):`--staged` 只在**当前目录确实是 git 仓库**时才成立。
 * 旧版把"非 git 环境 ⇒ 跑全量"的兜底只写在 staged 触发检测那一段 try/catch 里,
 * 而 `readFace()` 仍按索引面 `git show :<path>` 取值 ⇒ 非 git 目录下每个面都取不到,
 * 本门从「回退全量」退化成「整份未判定」(实测 exit 2,与自述口径相反)。
 * 现在先把面定死一次,后续取值只认这一个 `isStaged`。
 */
function detectGitRepo() {
  try {
    gitRaw(['rev-parse', '--git-dir'], ROOT)
    return true
  } catch {
    return false
  }
}
const isStaged = wantsStaged && detectGitRepo()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const TOKENS_CANDIDATES = [
  'packages/design-tokens/src/styles/tokens.css',
  'packages/design-tokens/dist/styles/tokens.css',
  'apps/web/src/styles/design-tokens.css',
]
const GEOMETRY_REL = 'packages/design-tokens/src/geometry.js'
const SIDEBAR_BARREL_REL = 'apps/web/src/components/sidebar.tsx'
const SIDEBAR_DIR_REL = 'apps/web/src/components/sidebar'
const SIDEBAR_BARREL = join(ROOT, SIDEBAR_BARREL_REL)
const SIDEBAR_DIR = join(ROOT, SIDEBAR_DIR_REL)

/** 常量名 → 期望档。`SIDEBAR_MIN_WIDTH` 与 `SIDEBAR_WIDTH` 同取 drawerWidth(下限恒等于默认) */
const RULES = [
  { constName: 'SIDEBAR_WIDTH', step: 'drawerWidth' },
  { constName: 'SIDEBAR_MIN_WIDTH', step: 'drawerWidth' },
  { constName: 'SIDEBAR_MAX_WIDTH', step: 'sidebarMaxWidth' },
  { constName: 'SIDEBAR_COLLAPSED_WIDTH', step: 'sidebarCollapsedWidth' },
]
const REQUIRED_STEPS = ['drawerWidth', 'sidebarMaxWidth', 'sidebarCollapsedWidth']
const STORAGE_KEY_CONST = 'SIDEBAR_WIDTH_STORAGE_KEY'
/**
 * 侧栏目录里"类名写死宽度"的可疑数值档族。
 * 取值来自历年真实档位(250 → 200 → 160,折叠 54/60,上限 130/180):
 * 命中这些数说明有人把档抄回了组件;其它像素宽(徽标 36、logo 上限 80)不在此列。
 */
const WIDTH_CLASS_SUSPECTS = new Set([54, 60, 130, 160, 180, 200, 250])

function pickTokensPath() {
  for (const rel of TOKENS_CANDIDATES) {
    const abs = join(ROOT, rel)
    if (existsSync(abs)) return abs
  }
  return null
}

function rel(abs) {
  return abs.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

/** 解析 `GEOMETRY_PX` 表(与门 128 同形态:每档独占一行 `key: <数字>`) */
function parseGeometry(src) {
  const body = src.match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
  if (!body) return null
  const out = {}
  for (const m of body[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(\d+(?:\.\d+)?)\s*,?\s*$/gm)) {
    out[m[1]] = Number(m[2])
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * 去注释。块注释用状态机(旧版按"行首是 `//` 或 `*`"过滤 ⇒ 块注释中间行不以 `*` 开头时
 * 会被当成代码,写一段反例注释就误红);行注释切到行尾,但 `https://` 这类冒号后的斜杠不算。
 */
function stripComments(src) {
  const out = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    let line = raw
    if (inBlock) {
      const end = line.indexOf('*/')
      if (end === -1) {
        out.push('')
        continue
      }
      line = line.slice(end + 2)
      inBlock = false
    }
    for (;;) {
      const start = line.indexOf('/*')
      if (start === -1) break
      const end = line.indexOf('*/', start + 2)
      if (end === -1) {
        line = line.slice(0, start)
        inBlock = true
        break
      }
      line = line.slice(0, start) + ' '.repeat(end + 2 - start) + line.slice(end + 2)
    }
    const m = line.match(/(^|[^:])\/\//)
    if (m) line = line.slice(0, m.index + m[1].length)
    out.push(line)
  }
  return out.join('\n')
}

/** 本地别名表:局部名 → 几何档名(`const X = rnGeometry.step` / `const { a, b: c } = rnGeometry`) */
function collectAliases(code) {
  const map = new Map()
  for (const m of code.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*rnGeometry\.([A-Za-z_$][\w$]*)\b/g,
  )) {
    map.set(m[1], m[2])
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*rnGeometry\b/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const [src, alias] = t.split(':').map((s) => s.trim())
      if (src) map.set(alias || src, src)
    }
  }
  return map
}

/**
 * 绑定式解析右值:必须是 `rnGeometry.<档>` 或能解到档的裸标识符。
 * `+ 40`、`Number('160')`、`Math.min(...)`、`160 as const` 一律解不出 ⇒ 判红。
 * 这一条是本次重写的核心:旧版只做"字符串出现过吗"的存在性检查。
 */
function resolveRhs(rhs, aliases) {
  const direct = rhs.match(/^rnGeometry\.([A-Za-z_$][\w$]*)(?:\s+as\s+const)?$/)
  if (direct) return direct[1]
  const bare = rhs.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+const)?$/)
  if (bare) return aliases.get(bare[1]) ?? null
  return null
}

/** 剥掉 CSS 块注释:注释里的 `:root` / 花括号会干扰括号深度与选择器匹配 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (s) => ' '.repeat(s.length))
}

/**
 * 取"顶层(花括号深度 0)且选择器命中 `:root`"的块内容。
 * 必须限定顶层 —— `@media (...) { :root { --sidebar-width: 160px } }` 里的同名属性是
 * 区间覆盖值,不是基准。旧版直接 `/:root\s*\{/g` 扫全文,媒体块里的 :root 也被当成顶层,
 * 只要覆盖值碰巧等于档值就判绿(C1 假绿)。
 */
function topLevelRootBlocks(css) {
  const blocks = []
  let depth = 0
  let preludeStart = 0
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i]
    if (ch === '{') {
      if (depth === 0 && /(^|,)\s*:root\b/.test(css.slice(preludeStart, i))) {
        let d = 1
        let j = i + 1
        while (j < css.length && d > 0) {
          if (css[j] === '{') d += 1
          else if (css[j] === '}') d -= 1
          j += 1
        }
        blocks.push(css.slice(i + 1, j - 1))
        i = j - 1
        preludeStart = j
        continue
      }
      depth += 1
      preludeStart = i + 1
    } else if (ch === '}') {
      if (depth > 0) depth -= 1
      preludeStart = i + 1
    }
  }
  return blocks
}

/**
 * 在顶层 `:root` 块内取自定义属性的值。
 * 不取"文件里第一条"—— 平板媒体查询里同名属性的覆盖值不是基准(把媒体块挪到前面就会换口径)。
 * 2026-11-07 补:多个顶层 `:root` 时按 **CSS 级联取最后一个**(后者胜)。旧版取第一个 ⇒
 * 文件末尾追加一条 `:root{--sidebar-width:250px}`(实际生效 250)实测仍判绿。
 * 返回 null = 找不到;`inRoot:false` = 只在媒体查询/其它选择器里出现(基准不明 ⇒ 调用方判未判定)。
 */
function readRootToken(css, token) {
  const clean = stripCssComments(css)
  const inRoot = new RegExp(`${token}\\s*:\\s*([^;\\n}]+)`)
  const blocks = topLevelRootBlocks(clean)
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const all = [...blocks[i].matchAll(new RegExp(inRoot, 'g'))]
    if (all.length > 0) return { raw: all[all.length - 1][1].trim(), inRoot: true }
  }
  const m = clean.match(inRoot)
  return m ? { raw: m[1].trim(), inRoot: false } : null
}

/** 长度值解析:只认 px。`10rem` / `100%` / 无单位一律解析不出(未判定,不许静默当通过) */
function parseLength(raw) {
  const m = String(raw).match(/^(-?\d+(?:\.\d+)?)(px|rem|em|rpx|%)$/)
  if (!m) return { ok: false, raw }
  return { ok: true, num: Number(m[1]), unit: m[2] }
}

/**
 * 取判定面内容(守门 118:全量判 HEAD blob / `--staged` 判索引 blob)。
 * 2026-11-07 补:A11 病灶 —— 旧版 `--staged` 只拿它决定"要不要跑",内容仍 `readFileSync` 工作树 ⇒
 * 索引里是字面量、工作树里是档引用时会判绿(pre-commit 实跑就是这条路径)。
 * 返回 null = 该面取不到(调用方判未判定,不回落另一个面)。
 * `isStaged` 已在文件头按"是否真是 git 仓库"解析过,这里不再二次判断。
 */
function readFace(relPath) {
  if (isStaged) {
    try {
      const out = gitRaw(['show', `:${relPath}`], ROOT)
      return typeof out === 'string' && out.length > 0 ? out : null
    } catch {
      return null
    }
  }
  const abs = join(ROOT, relPath)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

/**
 * 取 `const|let|var <name> = <右值>` 的**完整**右值(跨行)。
 * 旧版用 `([^\n;]+)`,右值换行写(`= rnGeometry.drawerWidth` 换行 `+ 40`)只捕到第一段 ⇒
 * 实测判绿:表达式绕过绑定式校验。这里按括号深度 + 行尾运算符判断语句是否续行。
 */
function readConstRhs(code, name) {
  const m = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(code)
  if (!m) return null
  const start = m.index + m[0].length
  let depth = 0
  let i = start
  for (; i < code.length; i += 1) {
    const ch = code[i]
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break
      depth -= 1
    } else if (depth === 0) {
      if (ch === ';') break
      if (ch === '\n') {
        const soFar = code.slice(start, i).trimEnd()
        const next = code.slice(i + 1).match(/^[ \t]*(\S)/)
        const contNext =
          next !== null && ['+', '-', '*', '/', '%', '?', ':', '.', '&', '|', ','].includes(next[1])
        const contPrev = /[+\-*/%?:.&|,(]$/.test(soFar)
        if (!contNext && !contPrev) break
      }
    }
  }
  return code.slice(start, i).trim()
}

/** 扫描面 = barrel + `sidebar/` **全目录递归**子模块(2026-08-28 拆分后真正的消费在这里) */
function listSidebarFiles() {
  const files = []
  if (existsSync(SIDEBAR_BARREL)) files.push(SIDEBAR_BARREL)
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name)
      // 旧版 `!ent.isFile() ⇒ continue`,只扫一层 ⇒ `sidebar/nav/x.tsx` 里的字面量实测判绿。
      if (ent.isDirectory()) {
        if (ent.name === '__tests__' || ent.name === 'node_modules') continue
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(ent.name)) continue
      if (/\.(test|spec)\.tsx?$/.test(ent.name)) continue
      files.push(full)
    }
  }
  walk(SIDEBAR_DIR)
  return files
}

/** 名字像不像"侧栏宽度常量"(SIDEBAR_WIDTH / DRAWER_MAX_WIDTH / COLLAPSED_W / sidebarW …) */
function isWidthConstName(name) {
  if (name === STORAGE_KEY_CONST) return false
  // 2026-11-07 补:旧版只认「全大写且含 WIDTH」与驼峰 `*Width` ⇒ `const COLLAPSED_W = 60`、
  // `const sidebarW = 160` 实测判绿(改个名就绕过扫描面)。这里补 `_W` / 结尾 `W` 两形。
  if (/^[A-Z0-9_]+$/.test(name)) {
    return /WIDTH|(^|_)W$/.test(name) && /SIDEBAR|DRAWER|ASIDE|COLLAPSED/.test(name)
  }
  return /^(drawer|sidebar|aside|collapsed)[A-Za-z0-9_$]*(Width|W)$/.test(name)
}

// ── --staged 面:只在相关文件被 staged 时才检查 ────────────────────────────────
if (isStaged) {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(绝对路径二进制 + safe.directory + stdio/windowsHide 统一)。
    const staged = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], ROOT)
    const files = staged.split('\n').filter(Boolean)
    const relevant = files.some(
      (f) =>
        f.includes('design-tokens.css') ||
        f.includes('tokens.css') ||
        f.includes('sidebar.tsx') ||
        f.includes('components/sidebar/') ||
        f.includes('geometry.js') ||
        f.includes('globals.css') ||
        f.includes('app/layout.tsx') ||
        f.includes('GlobalShell.tsx'),
    )
    if (!relevant) {
      console.log(`${C.dim}⏭  侧栏宽度一致性守门(无相关 staged 改动, 跳过)${C.reset}`)
      process.exit(0)
    }
  } catch {
    // 走到这里说明 git 可用但 `diff --cached` 本身失败(索引损坏/lock)。
    // 不跳过、也不退回工作树面:面已由文件头定死为索引面,继续判 ⇒ 取不到就如实未判定。
  }
}

let hasError = false
let undetermined = null
/**
 * 记「未判定」并**同时写 stderr**。
 * 2026-11-07 补:A12 病灶 —— 本门把诊断全打 stdout,而 `scripts/lib/gate-failure-kind.mjs` 的
 * `detectUndetermined` 只认 **stderr** 里的「未判定/无法判定」⇒ exit 2 在提交链上被判成 red,
 * 与本门自述「未判定既不记绿也不冒红」相反(实测:几何档缺档时 runner 记 failed++)。
 * 两个条件(exit 2 + stderr 自称未判定)缺一不可,所以这里必须显式落一行到 stderr。
 */
const markUndetermined = (why) => {
  undetermined = why
  console.error(`未判定:${why}`)
}
/** 早期退出(还没走到 markUndetermined 之前)也要落 stderr,否则同样被判红 */
const exitUndetermined = (why) => {
  console.error(`未判定:${why}`)
  process.exit(2)
}

// ── 0. 几何档(唯一真相源) ─────────────────────────────────────────────────────
const geometrySrc = readFace(GEOMETRY_REL)
const geom = geometrySrc ? parseGeometry(geometrySrc) : null
if (!geom) {
  console.log(`${C.yellow}  ⚠️  未判定:取不到几何档 ${GEOMETRY_REL}(文件缺失或 GEOMETRY_PX 体解析失败)${C.reset}`)
  console.log(`${C.dim}     本门期望值全部来自几何档,取不到就无法判定 —— 这不是通过${C.reset}`)
  exitUndetermined(`几何档 ${GEOMETRY_REL} 读不到或解析失败`)
}
const missingSteps = REQUIRED_STEPS.filter((s) => typeof geom[s] !== 'number')
if (missingSteps.length > 0) {
  console.log(`${C.yellow}  ⚠️  未判定:几何档缺 ${missingSteps.join(' / ')} ⇒ 判据输入不完整${C.reset}`)
  exitUndetermined(`几何档缺 ${missingSteps.join('/')}`)
}

console.log('📏 检查侧栏宽度一致性(几何档 vs tokens.css vs sidebar 组件)…')

// ── 1. tokens.css 镜像值 ──────────────────────────────────────────────────────
const TOKENS_PATH = pickTokensPath()
const cssSourceLabel = TOKENS_PATH ? rel(TOKENS_PATH) : null

function checkCssToken(css, token, expected) {
  const got = readRootToken(css, token)
  if (!got) {
    console.log(
      `${C.yellow}  ⚠️  未判定:${cssSourceLabel} 里找不到 ${token}(删掉 token 不等于"没有约束")${C.reset}`,
    )
    markUndetermined(`${cssSourceLabel} 缺 ${token}`)
    return
  }
  if (!got.inRoot) {
    console.log(
      `${C.yellow}  ⚠️  未判定:${token} 不在 :root 块内(媒体查询里的覆盖值不能当基准)${C.reset}`,
    )
    markUndetermined(`${token} 不在 :root`)
    return
  }
  const len = parseLength(got.raw)
  if (!len.ok) {
    console.log(`${C.yellow}  ⚠️  未判定:${token} 的值 \`${got.raw}\` 解析不出 px 长度${C.reset}`)
    markUndetermined(`${token} 值不可解析`)
    return
  }
  if (len.unit !== 'px') {
    console.log(
      `${C.yellow}  ⚠️  未判定:${token} 单位是 ${len.unit},本门只对账 px(换单位等于换口径)${C.reset}`,
    )
    markUndetermined(`${token} 非 px`)
    return
  }
  if (len.num !== expected) {
    console.log(
      `${C.red}  ❌ 不一致!${cssSourceLabel} ${token}: ${len.num}px ≠ 几何档 ${expected}px${C.reset}`,
    )
    console.log(
      `${C.red}     这会导致首屏 CSS 预设 ${len.num}px → JS 生效 ${expected}px 的宽度跳变闪烁${C.reset}`,
    )
    console.log(`${C.dim}     修复:CSS 是 JS 常量的镜像 → 把 ${token} 改为 ${expected}px${C.reset}`)
    hasError = true
    return
  }
  console.log(
    `${C.green}  ✅ 一致:${cssSourceLabel} ${token}: ${len.num}px === 几何档 ${expected}px${C.reset}`,
  )
}

if (!TOKENS_PATH) {
  console.log(
    `${C.yellow}  ⚠️  未判定:未找到 design-tokens 源文件(已尝试: ${TOKENS_CANDIDATES.join(', ')})${C.reset}`,
  )
  markUndetermined('未找到 tokens.css')
} else {
  const cssText = readFace(rel(TOKENS_PATH))
  if (cssText === null) {
    console.log(`${C.yellow}  ⚠️  未判定:${cssSourceLabel} 取不到内容(该面读不到)${C.reset}`)
    markUndetermined(`${cssSourceLabel} 取不到`)
  } else {
    checkCssToken(cssText, '--sidebar-width', geom.drawerWidth)
    checkCssToken(cssText, '--sidebar-collapsed-width', geom.sidebarCollapsedWidth)
  }
}

// ── 2. sidebar 组件:barrel 四枚常量必须精确绑定到档 ──────────────────────────
const sidebarFiles = listSidebarFiles()
if (sidebarFiles.length === 0) {
  console.log(
    `${C.yellow}  ⚠️  未判定:未找到 ${SIDEBAR_BARREL_REL} 或 ${SIDEBAR_DIR_REL}/ ⇒ 侧栏源码面读不到${C.reset}`,
  )
  markUndetermined('侧栏源码缺失')
} else {
  const barrelSrc = readFace(SIDEBAR_BARREL_REL)
  const barrelCode = barrelSrc === null ? null : stripComments(barrelSrc)
  if (barrelCode === null) {
    console.log(`${C.yellow}  ⚠️  未判定:${SIDEBAR_BARREL_REL} 取不到内容(该面读不到)${C.reset}`)
    markUndetermined('barrel 取不到')
  } else {

  if (!/from\s+['"]@ihui\/design-tokens['"]/.test(barrelCode)) {
    console.log(
      `${C.red}  ❌ ${SIDEBAR_BARREL_REL} 未从 @ihui/design-tokens 导入几何档 ⇒ 侧栏宽度失去单一来源${C.reset}`,
    )
    hasError = true
  }

  const barrelAliases = collectAliases(barrelCode)
  for (const { constName, step } of RULES) {
    const rhs = readConstRhs(barrelCode, constName)
    if (rhs === null) {
      console.log(
        `${C.red}  ❌ ${SIDEBAR_BARREL_REL} 找不到 ${constName}(被删/改名都会让宽度失去声明入口)${C.reset}`,
      )
      hasError = true
      continue
    }
    const resolved = resolveRhs(rhs, barrelAliases)
    if (!resolved) {
      console.log(
        `${C.red}  ❌ ${constName} = ${rhs} 不是几何档引用(写数字/表达式/Number() 都算第二份真相)${C.reset}`,
      )
      console.log(`${C.dim}     修复:改成 ${constName} = rnGeometry.${step} —— 唯一数字在 ${GEOMETRY_REL}${C.reset}`)
      hasError = true
      continue
    }
    if (resolved !== step) {
      console.log(
        `${C.red}  ❌ ${constName} 绑到了 rnGeometry.${resolved},期望 rnGeometry.${step}${C.reset}`,
      )
      hasError = true
      continue
    }
    console.log(`${C.green}  ✅ ${constName} = rnGeometry.${step}${C.reset}`)
  }
  }

  // ── 3. 子模块:任何"宽度常量"都必须接档,不许自带数字 ─────────────────────
  for (const file of sidebarFiles) {
    if (file === SIDEBAR_BARREL) continue
    const src = readFace(rel(file))
    if (src === null) {
      console.log(`${C.yellow}  ⚠️  未判定:${rel(file)} 取不到内容(该面读不到)${C.reset}`)
      markUndetermined(`${rel(file)} 取不到`)
      continue
    }
    const code = stripComments(src)
    const aliases = collectAliases(code)
    const declaredNames = new Set(
      [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]),
    )
    for (const name of declaredNames) {
      if (!isWidthConstName(name)) continue
      const rhs = readConstRhs(code, name)
      if (rhs === null) continue
      const resolved = resolveRhs(rhs, aliases)
      if (!resolved) {
        console.log(
          `${C.red}  ❌ ${rel(file)} 的 ${name} = ${rhs} 是宽度字面量(第二份真相)${C.reset}`,
        )
        console.log(`${C.dim}     修复:改为 rnGeometry.<档>,或直接消费 barrel 导出的常量${C.reset}`)
        hasError = true
      } else if (!REQUIRED_STEPS.includes(resolved)) {
        console.log(
          `${C.red}  ❌ ${rel(file)} 的 ${name} 绑到了未知档 rnGeometry.${resolved}${C.reset}`,
        )
        hasError = true
      }
    }
    // Tailwind 类名里写死侧栏宽(JIT 只扫字面量 ⇒ 这种写法不会随档变)。
    // 2026-11-07 二次修正:先前收窄成「同一行提到 sidebar/aside/drawer 才认」,实测
    // `const box = 'w-[160px]'` 这种抽出一行的写法直接绕过(单测 B4 当场变绿 = 判据缺口)。
    // 本目录整体就是侧栏代码,真正的区分量是**数值**而不是行内关键词:
    //   命中宽度档族 {54,60,130,160,180,200,250} ⇒ 只可能是"把档抄回来";
    //   其余像素宽(如 `max-w-[80px]` 的 logo 上限)是别的语义,不拦。
    for (const line of code.split('\n')) {
      for (const m of line.matchAll(/(?<![\w-])(?:min-|max-)?w-\[(\d+)px\]/g)) {
        const n = Number(m[1])
        if (WIDTH_CLASS_SUSPECTS.has(n)) {
          console.log(
            `${C.red}  ❌ ${rel(file)} 用类名写死了侧栏宽度 w-[${n}px](改档不会跟随)${C.reset}`,
          )
          console.log(`${C.dim}     修复:宽度走 inline style + 几何档;Tailwind JIT 认不出动态类名${C.reset}`)
          hasError = true
        }
      }
    }
  }
}

// ── 4. token-registry 第三源(与 tokens.css 对账) ─────────────────────────────
const REGISTRY_REL = 'packages/design-tokens/src/token-registry.ts'
if (TOKENS_PATH) {
  const cssText = readFace(rel(TOKENS_PATH))
  const reg = readFace(REGISTRY_REL)
  if (cssText === null || reg === null) {
    console.log(`${C.yellow}  ⚠️  未判定:token-registry 对账面取不到(${REGISTRY_REL})${C.reset}`)
    markUndetermined('token-registry 取不到')
  } else {
  const checkRegistry = (tokenName) => {
    const got = readRootToken(cssText, tokenName)
    if (!got) return
    const len = parseLength(got.raw)
    if (!len.ok || len.unit !== 'px') return
    const re = new RegExp(String.raw`\{\s*name:\s*'${tokenName}'[^}]*defaultValue:\s*'(\d+)px'`)
    const m = reg.match(re)
    if (!m) {
      // 2026-11-07 补:旧版只 warn ⇒ 删掉注册条目反而判绿。注册表是**第三份副本**,
      // 它不在就没人与 CSS 对账,属"取不到判据输入"而不是"通过"。
      console.log(
        `${C.yellow}  ⚠️  未判定:${REGISTRY_REL} 中未找到 ${tokenName} 注册条目(缺条目 ≠ 一致)${C.reset}`,
      )
      markUndetermined(`registry 缺 ${tokenName}`)
      return
    }
    const regValue = Number(m[1])
    if (regValue !== len.num) {
      console.log(
        `${C.red}  ❌ 不一致!token-registry.ts ${tokenName} defaultValue: ${regValue}px ≠ tokens.css: ${len.num}px${C.reset}`,
      )
      console.log(`${C.dim}     修复:同步 token-registry.ts 的 defaultValue 后重建 design-tokens${C.reset}`)
      hasError = true
      return
    }
    console.log(
      `${C.green}  ✅ 一致:token-registry.ts ${tokenName}: ${regValue}px === tokens.css: ${len.num}px${C.reset}`,
    )
  }
  checkRegistry('--sidebar-width')
  checkRegistry('--sidebar-collapsed-width')
  }
}

// ── 5. 端内其它载体(本单亲手改过、也必须被门看住的四处) ──────────────────────
/**
 * 2026-11-07 补:A13 病灶 —— 本单把 web 首屏 script、globals.css 平板区间、`packages/ui-react`
 * 侧栏、RN / 小程序抽屉四处改成消费档,但门一个都不看 ⇒ 任一处回退成字面量,门仍全绿
 * (实测:把 globals.css 改回 `width:60px` 三连、把首屏 script 改回 `sn>=160&&sn<=180`,两次都 exit 0)。
 * 这四处的共同点是"CSS/内联脚本/另一端",无法 import 档常量,只能靠门逐处认形态。
 */
function checkOtherCarrier(relPath, { require = [], forbid = [] } = {}) {
  const srcRaw = readFace(relPath)
  if (srcRaw === null) {
    console.log(`${C.yellow}  ⚠️  未判定:${relPath} 取不到内容(该面读不到)${C.reset}`)
    markUndetermined(`${relPath} 取不到`)
    return
  }
  // 判据面必须去注释:本单在注释里写了"此前是 `w-[54px]/w-[200px]`"这类反例说明,
  // 直接扫原文会把说明当违规(实测误红)。CSS/TSX 同用一套去注释状态机。
  const src = stripComments(srcRaw)
  let bad = false
  for (const re of require) {
    if (re instanceof RegExp ? !re.test(src) : !src.includes(re)) {
      console.log(`${C.red}  ❌ ${relPath} 缺少必需形态 ${re} ⇒ 宽度没接档${C.reset}`)
      bad = true
    }
  }
  for (const { re, why } of forbid) {
    const m = re.exec(src)
    if (m !== null) {
      console.log(`${C.red}  ❌ ${relPath} 出现字面量宽度 \`${m[0]}\`(${why})${C.reset}`)
      bad = true
    }
  }
  if (bad) {
    hasError = true
    return
  }
  console.log(`${C.green}  ✅ 已接档:${relPath}${C.reset}`)
}

// 5a. web 首屏 nonce 内联脚本(hydrate 前唯一的宽度预设源,改档必漏的典型位置)
checkOtherCarrier('apps/web/app/layout.tsx', {
  require: [
    'rnGeometry.drawerWidth',
    'rnGeometry.sidebarMaxWidth',
    'rnGeometry.sidebarCollapsedWidth',
  ],
  forbid: [
    {
      re: /sidebar-width'?,\s*'(\d{2,3})px'/,
      why: '宽度 fallback 仍是字面量,应插值 ${rnGeometry.drawerWidth}',
    },
  ],
})

// 5b. web 平板区间折叠态(640-1023px):必须引用 CSS 变量,不得三连写死
checkOtherCarrier('apps/web/app/globals.css', {
  require: [/aside\[data-viewport-collapsed='true'\][\s\S]{0,400}var\(--sidebar-collapsed-width\)/],
  forbid: [
    {
      re: /aside\[data-viewport-collapsed='true'\][\s\S]{0,300}?:\s*(\d{2,3})px;/,
      why: '折叠态宽度写死 px,改档不会跟随',
    },
  ],
})

// 5c. packages/ui-react 侧栏(54/200 是历史漂移值,不得复活)
checkOtherCarrier('packages/ui-react/src/components/sidebar.tsx', {
  require: ['rnGeometry.sidebarCollapsedWidth', 'rnGeometry.drawerWidth'],
  forbid: [
    { re: /\bw-\[(\d+)px\]/, why: 'Tailwind 类名写死宽度(JIT 不跟随动态值);54/200 是历史漂移值' },
  ],
})

// 5d. RN 抽屉:封顶必须取档,不得留数字封顶
checkOtherCarrier('apps/mobile-rn/src/components/Drawer.tsx', {
  require: ['rnGeometry.drawerWidth'],
  forbid: [
    {
      re: /Math\.min\([^)]*,\s*(160|180|200|220|250|256)\)/,
      why: '封顶值是数字字面量(第二份真相)',
    },
  ],
})

// 5e. 小程序抽屉:宽度必须由 taroGeometry.drawerWidth 折出,不得出现 rpx(数字) 当抽屉宽
checkOtherCarrier('apps/miniapp-taro/src/components/DrawerComponent.tsx', {
  require: ['rpx(taroGeometry.drawerWidth)'],
  forbid: [{ re: /width:\s*rpx\((\d{3,})\)/, why: '抽屉宽写死 rpx 数字,改档不会跟随' }],
})

// ── 收口:红优先于未判定 ──────────────────────────────────────────────────────
if (hasError) {
  process.exit(1)
}
if (undetermined) {
  console.log(
    `${C.yellow}  ⚠️  未判定(${undetermined})—— 这一格没有结论,既不是通过也不是判红${C.reset}`,
  )
  process.exit(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
