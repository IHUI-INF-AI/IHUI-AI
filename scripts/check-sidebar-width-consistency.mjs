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
const isStaged = process.argv.includes('--staged')

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
 * 返回 null = 找不到;`inRoot:false` = 只在媒体查询/其它选择器里出现(基准不明 ⇒ 调用方判未判定)。
 */
function readRootToken(css, token) {
  const clean = stripCssComments(css)
  const inRoot = new RegExp(`${token}\\s*:\\s*([^;\\n}]+)`)
  for (const block of topLevelRootBlocks(clean)) {
    const m = block.match(inRoot)
    if (m) return { raw: m[1].trim(), inRoot: true }
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

/** 扫描面 = barrel + sidebar/ 子模块(2026-08-28 拆分后真正的消费在这里) */
function listSidebarFiles() {
  const files = []
  if (existsSync(SIDEBAR_BARREL)) files.push(SIDEBAR_BARREL)
  if (existsSync(SIDEBAR_DIR)) {
    for (const ent of readdirSync(SIDEBAR_DIR, { withFileTypes: true })) {
      if (!ent.isFile()) continue
      if (!/\.tsx?$/.test(ent.name)) continue
      if (/\.(test|spec)\.tsx?$/.test(ent.name)) continue
      files.push(join(SIDEBAR_DIR, ent.name))
    }
  }
  return files
}

/** 名字像不像"侧栏宽度常量"(SIDEBAR_WIDTH / DRAWER_MAX_WIDTH / drawerWidth …) */
function isWidthConstName(name) {
  if (name === STORAGE_KEY_CONST) return false
  if (/^[A-Z0-9_]+$/.test(name)) return /WIDTH/.test(name) && /(SIDEBAR|DRAWER|ASIDE)/.test(name)
  return /^(drawer|sidebar|aside)\w*Width$/.test(name)
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
    // 非 git 环境,跑全量
  }
}

let hasError = false
let undetermined = null
const markUndetermined = (why) => {
  undetermined = why
}

// ── 0. 几何档(唯一真相源) ─────────────────────────────────────────────────────
const geometryPath = join(ROOT, GEOMETRY_REL)
const geom = existsSync(geometryPath) ? parseGeometry(readFileSync(geometryPath, 'utf8')) : null
if (!geom) {
  console.log(`${C.yellow}  ⚠️  未判定:取不到几何档 ${GEOMETRY_REL}(文件缺失或 GEOMETRY_PX 体解析失败)${C.reset}`)
  console.log(`${C.dim}     本门期望值全部来自几何档,取不到就无法判定 —— 这不是通过${C.reset}`)
  process.exit(2)
}
const missingSteps = REQUIRED_STEPS.filter((s) => typeof geom[s] !== 'number')
if (missingSteps.length > 0) {
  console.log(`${C.yellow}  ⚠️  未判定:几何档缺 ${missingSteps.join(' / ')} ⇒ 判据输入不完整${C.reset}`)
  process.exit(2)
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
  const cssText = readFileSync(TOKENS_PATH, 'utf8')
  checkCssToken(cssText, '--sidebar-width', geom.drawerWidth)
  checkCssToken(cssText, '--sidebar-collapsed-width', geom.sidebarCollapsedWidth)
}

// ── 2. sidebar 组件:barrel 四枚常量必须精确绑定到档 ──────────────────────────
const sidebarFiles = listSidebarFiles()
if (sidebarFiles.length === 0) {
  console.log(
    `${C.yellow}  ⚠️  未判定:未找到 ${SIDEBAR_BARREL_REL} 或 ${SIDEBAR_DIR_REL}/ ⇒ 侧栏源码面读不到${C.reset}`,
  )
  markUndetermined('侧栏源码缺失')
} else {
  const barrelCode = stripComments(readFileSync(SIDEBAR_BARREL, 'utf8'))

  if (!/from\s+['"]@ihui\/design-tokens['"]/.test(barrelCode)) {
    console.log(
      `${C.red}  ❌ ${SIDEBAR_BARREL_REL} 未从 @ihui/design-tokens 导入几何档 ⇒ 侧栏宽度失去单一来源${C.reset}`,
    )
    hasError = true
  }

  const barrelAliases = collectAliases(barrelCode)
  for (const { constName, step } of RULES) {
    const m = barrelCode.match(new RegExp(`\\b(?:const|let|var)\\s+${constName}\\s*=\\s*([^\\n;]+)`))
    if (!m) {
      console.log(
        `${C.red}  ❌ ${SIDEBAR_BARREL_REL} 找不到 ${constName}(被删/改名都会让宽度失去声明入口)${C.reset}`,
      )
      hasError = true
      continue
    }
    const rhs = m[1].trim()
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

  // ── 3. 子模块:任何"宽度常量"都必须接档,不许自带数字 ─────────────────────
  for (const file of sidebarFiles) {
    if (file === SIDEBAR_BARREL) continue
    const code = stripComments(readFileSync(file, 'utf8'))
    const aliases = collectAliases(code)
    for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;]+)/g)) {
      const name = m[1]
      if (!isWidthConstName(name)) continue
      const rhs = m[2].trim()
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
    // Tailwind 类名里写死侧栏宽(JIT 只扫字面量 ⇒ 这种写法不会随档变)
    for (const m of code.matchAll(/\bw-\[(\d+)px\]/g)) {
      const n = Number(m[1])
      if (n === geom.drawerWidth || n === geom.sidebarMaxWidth || n === geom.sidebarCollapsedWidth) {
        console.log(
          `${C.red}  ❌ ${rel(file)} 用类名写死了侧栏宽度 w-[${n}px](改档不会跟随)${C.reset}`,
        )
        console.log(`${C.dim}     修复:宽度走 inline style + 几何档;Tailwind JIT 认不出动态类名${C.reset}`)
        hasError = true
      }
    }
  }
}

// ── 4. token-registry 第三源(与 tokens.css 对账) ─────────────────────────────
const REGISTRY_PATH = join(ROOT, 'packages/design-tokens/src/token-registry.ts')
if (TOKENS_PATH && existsSync(REGISTRY_PATH)) {
  const cssText = readFileSync(TOKENS_PATH, 'utf8')
  const reg = readFileSync(REGISTRY_PATH, 'utf8')
  const checkRegistry = (tokenName) => {
    const got = readRootToken(cssText, tokenName)
    if (!got) return
    const len = parseLength(got.raw)
    if (!len.ok || len.unit !== 'px') return
    const re = new RegExp(String.raw`\{\s*name:\s*'${tokenName}'[^}]*defaultValue:\s*'(\d+)px'`)
    const m = reg.match(re)
    if (!m) {
      console.log(`${C.yellow}  ⚠️  token-registry.ts 中未找到 ${tokenName} 注册条目${C.reset}`)
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
