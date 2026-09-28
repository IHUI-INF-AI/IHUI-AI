#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-taro-style-parity.mjs — miniapp-taro 跨端样式一致性守门(2026-09-03 立)。
 *
 * 背景:web 与 miniapp-taro 必须视觉完全一致(除平台独占差异)。此前 app.css 硬编码
 *       深色科技风全局覆盖 + 565 处硬编码 hex + 同名工具类冲突,导致两端样式严重
 *       不一致。本次重构后建立守门,防止回潮,落实「两端修改必须同步」铁律。
 *
 * 校验内容(RULE-1~5):
 *   RULE-1a (BLOCK): 页面/组件 CSS 规则中出现深色科技风禁用色板
 *                    (#00f2ff/#121217/#1f1f28/#1a1a2e/#1a1a23/#12121a/#0a0a0f/#1e1e2e/#2a2a3e)。
 *   RULE-1b (BLOCK): 页面/组件 CSS 中非平台白名单 #hex 硬编码。
 *   RULE-2  (BLOCK): app.css 回归 —— 不得再出现深色科技风全局覆盖
 *                    (禁用色板 / page{...!important 字体} / *{font-family!important})。
 *   RULE-3  (BLOCK): app.config.ts 中每个路由页 .tsx 必须挂载 <ThemeRoot>(主题根节点)。
 *   RULE-4  (BLOCK): tsx 内联非平台白名单 #hex;tsx/css 出现紫青残留/深海军蓝页底/半成品 var。
 *   RULE-5  (BLOCK): 已删除的深色科技装饰类(card-neon/cyber-card/tech-card/tech-border/
 *                    tech-grid/tech-loading/glass/gradient-primary/text-light/text-neon/
 *                    text-error/list-cell/uni-tabbar/btn-accent)不得被重新引用。
 *   RULE-6  (BLOCK): CSS 伪类不得带空格(`: active` 会导致 weapp-tailwindcss 构建失败),
 *                    必须为 `:active`(无空格)。扫描 app.css + 页面/组件 CSS。
 *
 * 退出码:0 = 全部通过(含 WARN,不阻塞);1 = 出现 BLOCK 级失败(阻塞)。
 *
 * 用法:
 *   node scripts/check-miniapp-taro-style-parity.mjs           # 全量校验(判定面 = 工作树磁盘)
 *   node scripts/check-miniapp-taro-style-parity.mjs --quiet   # 仅输出失败
 *   node scripts/check-miniapp-taro-style-parity.mjs --help    # 帮助
 *   node scripts/check-miniapp-taro-style-parity.mjs --staged  # 提交链档:判定面 = 索引 blob
 *   node scripts/check-miniapp-taro-style-parity.mjs --worktree# 显式磁盘档(人工逃生舱)
 *   node scripts/check-miniapp-taro-style-parity.mjs --root <d># 显式仓库根(测试/夹具通道,仅 --worktree 档)
 *
 * 判定面(2026-09-28 收口,与守门 70/118 及 2i 死 key 扫描同口径):
 *   本步是**批外 blocking**(不在 guardian-runner 里,拿不到它统一追加的面旗),且旧形态把
 *   pages/components/app.css **整片按磁盘读** ⇒ 并行会话任意一个未暂存的 miniapp 页面就能把
 *   本次提交钉红,而各会话唯一出路是 --no-verify(一次绕过约等于链上全部守门对该提交作废,
 *   AGENTS §12e/§12f)。现 `--staged` ⇒ 清单(`git ls-files -z -- apps/miniapp-taro/src`)与
 *   内容(一次 `cat-file --batch` 读满)**同面同轮**;别人没 `git add` 的东西结构上不在索引里。
 *   面上取材失败 ⇒ **exit 2「未判定」并点名原因,绝不回退磁盘、绝不记为通过**。
 *   两面旗同给 ⇒ exit 2(互斥,取哪一面都会把另一面洗成假绿)。
 *   缺省 / `--worktree` ⇒ 工作树磁盘,既有全量行为逐字不变(CI 与 check:all 走这档)。
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

// ─── CLI 解析(先解析 --root,再推导路径:§15 不硬编码盘符,也不按 process.cwd() 定根) ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')

/**
 * `--root <dir>` 与 `--root=<dir>` 两种形态都必须认:早期只认空格形态时
 * `--root=<不存在的目录>` 被静默忽略 ⇒ 夹具扫的是真仓,红绿都不作数(守门 70 那一型)。
 * @returns {{root:string|null, error:string|null}}
 */
function resolveRootArg(list) {
  const eq = list.find((a) => a.startsWith('--root='))
  if (eq !== undefined) {
    const v = eq.slice('--root='.length)
    return v ? { root: resolve(v), error: null } : { root: null, error: '--root= 缺目录值' }
  }
  const i = list.indexOf('--root')
  if (i < 0) return { root: null, error: null }
  const v = list[i + 1]
  if (!v || v.startsWith('-')) return { root: null, error: '--root 必须带目录值' }
  return { root: resolve(v), error: null }
}
const rootArg = resolveRootArg(argv)
if (rootArg.error) {
  console.error(`[check-miniapp-taro-style-parity] 无法判定(exit 2,未判定): ${rootArg.error}`)
  process.exit(2)
}
const root = rootArg.root ?? join(dirname(fileURLToPath(import.meta.url)), '..')

// 判定面选择:与守门 70/103/118 共用同一条 selectFace(两面旗同给 = 自相矛盾,判死不取任何一面)。
const facePick = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
  def: 'worktree',
})
if (facePick.error) {
  console.error(`[check-miniapp-taro-style-parity] 无法判定(exit 2,未判定): ${facePick.error}`)
  process.exit(2)
}
const FACE = facePick.face
// `--root <dir>` 与 `--staged` **可以**同用:git 一律 `-C <root>`,取的就是那棵树自己的索引
// (镜像测试靠这条通道把夹具仓喂进来,与 scan-dead-i18n-keys 的 --root 通道同形)。
// 真正的危险是"root 是仓库的**子目录**"⇒ ls-files 的路径与 join(root, rel) 错位,
// 那由 ensureFaceIndex 里的 assertRepoRoot 判死,不在这里靠猜。
const FACE_LABEL_TEXT = FACE === 'staged' ? '索引 blob' : '工作树磁盘'

/** 索引面预载:rel(仓库根相对、正斜杠) → blob 文本。null 表示"未预载"。 */
let faceIndex = null

/** 仓库根相对路径(正斜杠),索引面的 Map 键。 */
function relKey(p) {
  return relative(root, p).replace(/\\/g, '/')
}

function failUndetermined(what) {
  console.error(`[check-miniapp-taro-style-parity] 无法判定(exit 2,未判定): ${what}`)
  console.error('   这不是"仓库有违规",是这次判不了。**未判定 ≠ 通过**,也绝不回退磁盘。')
  process.exit(2)
}

/** 索引面一次性枚举 + 读满(清单与内容同面同轮;混着取会产出自洽却错位的尺子,守门 118)。 */
function ensureFaceIndex() {
  if (faceIndex) return
  const srcRel = relKey(SRC)
  let listing
  try {
    assertRepoRoot(root, '本门')
    listing = gitRaw(['ls-files', '-z', '--', srcRel], root, { timeout: 120000 }).split('\0')
  } catch (e) {
    if (e instanceof Undetermined) failUndetermined(`索引面枚举失败:${e.message}`)
    throw e
  }
  const rels = listing.filter(Boolean)
  // 枚举到 0 个可扫文件 = 判据失明,不是"这一端干净"(空扫不记绿,守门 70/77/118 同一条)。
  if (rels.length === 0) failUndetermined(`索引面在 ${relKey(SRC)} 下枚举到 0 个跟踪文件`)
  let got
  try {
    got = catBatch(root, rels.map((r) => `:${r}`), { maxBuffer: 1 << 28, timeout: 180000 })
  } catch (e) {
    if (e instanceof Undetermined)
      failUndetermined(`索引面取材失败(**不回退磁盘**):${e.message}`)
    throw e
  }
  faceIndex = new Map()
  const absent = []
  for (const r of rels) {
    const t = got.get(`:${r}`)
    if (typeof t === 'string') faceIndex.set(r, t)
    else absent.push(r) // unmerged / 非 blob:索引面上"没有可读正文",由 faceExists 决定语义
  }
  if (absent.length > 0) {
    failUndetermined(
      `索引面有 ${absent.length} 个路径取不到正文(unmerged / 非 blob),首个:${absent[0]}`,
    )
  }
}

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码中文绝对路径) ───
const SRC = join(root, 'apps/miniapp-taro/src')
const APP_CSS_PATH = join(SRC, 'app.css')
const APP_CONFIG_PATH = join(SRC, 'app.config.ts')
const PAGES_DIR = join(SRC, 'pages')
const COMPONENTS_DIR = join(SRC, 'components')

if (showHelp) {
  console.log(`
check-miniapp-taro-style-parity.mjs — miniapp-taro 跨端样式一致性守门(2026-09-03)

用法:
  node scripts/check-miniapp-taro-style-parity.mjs [选项]

选项:
  --quiet, -q    仅输出失败(BLOCK 级)信息
  --help, -h     显示此帮助
  --staged       判定面 = 索引 blob(pre-commit 用这一档;清单与内容同面同轮)
  --worktree     判定面 = 工作树磁盘(缺省档,人工 / CI 全量审计)
  --root <dir>   显式仓库根(**仅** --worktree 档,供测试夹具)

校验内容:
  RULE-1a (BLOCK) 页面/组件 CSS 禁用深色科技风色板
  RULE-1b (BLOCK) 页面/组件 CSS 非平台白名单 #hex
  RULE-2  (BLOCK) app.css 深色科技风全局覆盖回归
  RULE-3  (BLOCK) 路由页必须挂载 <ThemeRoot>
  RULE-4  (BLOCK) tsx 内联非白名单 hex / 紫青·深海军蓝·半成品 var 残留
  RULE-5  (BLOCK) 已删除的科技装饰类被重新引用
  RULE-6  (BLOCK) CSS 伪类带空格(: active 导致构建失败)

退出码:
  0 = 通过(含 WARN)
  1 = BLOCK 级失败
  2 = 无法判定(未判定:索引面取材失败 / 参数矛盾)—— 既非通过也非违规
`)
  process.exit(0)
}

// ─── 常量 ───

/** 深色科技风禁用色板(本次重构从 app.css 彻底移除,任何回潮即 BLOCK)。 */
const BANNED_DARKTECH = new Set([
  '#00f2ff',
  '#121217',
  '#1f1f28',
  '#1a1a2e',
  '#1a1a23',
  '#12121a',
  '#0a0a0f',
  '#1e1e2e',
  '#2a2a3e',
])

/** 已删除的深色科技装饰类(零引用,重新引用即 BLOCK)。 */
const DELETED_CLASSES = [
  'card-neon',
  'cyber-card',
  'tech-card',
  'tech-border',
  'tech-grid',
  'tech-loading',
  'glass',
  'gradient-primary',
  'text-light',
  'text-neon',
  'text-error',
  'list-cell',
  'uni-tabbar',
  'btn-accent',
]

/** RULE-4 平台/品牌色白名单(微信绿、链接蓝、VIP 金、状态色等,属平台常量,允许硬编码)。 */
const PLATFORM_COLORS = new Set([
  '#07c160',
  '#09bb07',
  '#4cd964',
  '#00b578',
  '#1677ff',
  '#409eff',
  '#517bff',
  '#8b91ff',
  '#847cff',
  '#6366f1',
  '#ffd700',
  '#ffc107',
  '#ff6b00',
  '#d4a017',
  '#d4af6a',
  '#b8860b',
  '#cd7f32',
  '#c0c0c0',
  '#b89dff',
  '#ec4899',
  '#f8d486',
  '#ff0b0b',
  '#e94d3a',
  '#ff9800',
  '#fff',
  '#ffffff',
  '#000',
  '#000000',
  '#9ca3af', // 与 web 共享层 Carousel 空态文字逐字一致(gray-400),两端必须同步使用
  '#f0f8e8',
  '#f0eeff',
  '#7ca500',
  '#716fff',
  '#6b6980',
  '#b7b5ca',
  '#d1d1d1',
  '#222',
  '#2c2c2c',
  '#3a3a3a',
  '#3d3d3d',
])

// ─── 工具函数 ───

/**
 * 读取文本并去除 BOM。**按判定面分派**:
 *  - `--staged` ⇒ 预载的索引 blob(路径不在索引面 ⇒ null,由 `exists()` 先挡住);
 *  - 缺省 / `--worktree` ⇒ 磁盘(既有全量行为逐字不变)。
 */
function readText(p) {
  let s
  if (FACE === 'staged') {
    ensureFaceIndex()
    const t = faceIndex.get(relKey(p))
    if (typeof t !== 'string') return null
    s = t
  } else {
    s = readFileSync(p, 'utf8')
  }
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s
}

/** 路径在**判定面**上是否存在(索引面 = 索引里有这条路径且取到了正文)。 */
function exists(p) {
  if (FACE !== 'staged') return existsSync(p)
  ensureFaceIndex()
  return faceIndex.has(relKey(p))
}

/** 去除 CSS 块注释 /* ... *\/。 */
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 去除 TS/JS 行注释与块注释(用于 tsx 扫描)。 */
function stripTsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * 递归收集目录下所有指定后缀文件。**索引面走枚举,不走磁盘**:
 * 别人未 `git add` 的新文件进不了本次提交,也不该参与本次判定。
 */
function walk(dir, exts, out = []) {
  if (FACE === 'staged') {
    ensureFaceIndex()
    const prefix = relKey(dir) + '/'
    for (const rel of faceIndex.keys()) {
      if (!rel.startsWith(prefix)) continue
      const ext = rel.slice(rel.lastIndexOf('.') + 1)
      if (exts.includes(ext)) out.push(join(root, rel))
    }
    return out
  }
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.includes(full.slice(full.lastIndexOf('.') + 1))) out.push(full)
  }
  return out
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g

/** 从已去注释文本提取所有 #hex(小写)。 */
function extractHexes(cleanText) {
  const out = []
  let m
  const re = new RegExp(HEX_RE.source, 'g')
  while ((m = re.exec(cleanText)) !== null) out.push(m[0].toLowerCase())
  return out
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  // 判定面**总是**印(不受 --quiet 影响):归因层与人都要能区分"判的是哪一份",
  // 否则 --quiet 档的绿与索引面的绿在日志里长得一样。
  console.log(
    `[check-miniapp-taro-style-parity] 跨端样式一致性守门…(判定面:${FACE_LABEL_TEXT}${FACE === 'staged' ? ' = 索引 blob,本次提交真正会带走的那一份' : ''})`,
  )
  let blocking = 0
  const warnings = 0

  const pageCss = walk(PAGES_DIR, ['css'])
  const compCss = walk(COMPONENTS_DIR, ['css'])
  const allCss = [...pageCss, ...compCss]
  const pageTsx = walk(PAGES_DIR, ['tsx'])
  const compTsx = walk(COMPONENTS_DIR, ['tsx'])
  const allTsx = [...pageTsx, ...compTsx]

  // ── RULE-1a / RULE-1b:页面/组件 CSS 硬编码 hex ──
  const bannedHits = [] // { file, hex }
  const otherHex = new Map() // file -> Set<hex>
  for (const f of allCss) {
    const clean = stripCssComments(readText(f))
    for (const hex of extractHexes(clean)) {
      if (BANNED_DARKTECH.has(hex)) bannedHits.push({ file: f, hex })
      else {
        if (!otherHex.has(f)) otherHex.set(f, new Set())
        otherHex.get(f).add(hex)
      }
    }
  }
  if (bannedHits.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-1a: ${bannedHits.length} 处深色科技风禁用色板回潮:`)
    for (const h of bannedHits.slice(0, 20))
      console.error(`    ${h.file.replace(SRC + '/', '')}: ${h.hex}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-1a: 无深色科技风禁用色板回潮')
  }
  // RULE-1b:页面/组件 CSS 中非平台白名单 #hex -> BLOCK(token 化铁律,防止回潮)
  const cssHexOff = []
  for (const [f, set] of otherHex) {
    for (const hex of set) {
      if (!PLATFORM_COLORS.has(hex)) cssHexOff.push(`${f.replace(SRC + '/', '')}: ${hex}`)
    }
  }
  if (cssHexOff.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-1b: ${cssHexOff.length} 处非白名单 #hex 硬编码(必须改用 design-tokens 变量):`)
    for (const h of cssHexOff.slice(0, 30)) console.error(`    ${h}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-1b: 页面/组件 CSS 无非白名单硬编码 #hex')
  }

  // ── RULE-2:app.css 深色科技风回归 ──
  if (exists(APP_CSS_PATH)) {
    const clean = stripCssComments(readText(APP_CSS_PATH))
    const bannedInApp = extractHexes(clean).filter((h) => BANNED_DARKTECH.has(h))
    // 深色全局覆盖签名:page{...} 含背景十六进制,或 *{font-family...!important}
    const darkOverride =
      /\bpage\s*\{[^}]*background\s*:\s*#[0-9a-fA-F]{3,8}/.test(clean) ||
      /\*\s*\{[^}]*font-family[^}]*!important/.test(clean)
    if (bannedInApp.length > 0 || darkOverride) {
      blocking++
      console.error('[FAIL] RULE-2: app.css 出现深色科技风全局覆盖回归:')
      if (bannedInApp.length > 0)
        console.error(`    禁用色板: ${[...new Set(bannedInApp)].join(' ')}`)
      if (darkOverride) console.error('    检测到 page{...!important 字体} 或 *{font-family!important} 覆盖')
    } else if (!quiet) {
      console.log('[PASS] RULE-2: app.css 无深色科技风全局覆盖回归')
    }
  } else if (!quiet) {
    console.log('[SKIP] RULE-2: app.css 不存在,跳过')
  }

  // ── RULE-3:路由页必须挂载 <ThemeRoot> ──
  if (exists(APP_CONFIG_PATH)) {
    const cfg = readText(APP_CONFIG_PATH)
    const m = cfg.match(/pages:\s*\[([\s\S]*?)\]/)
    if (m) {
      const pages = (m[1].match(/'[^']+'|"[^"]+"/g) || []).map((s) =>
        s.replace(/['"]/g, ''),
      )
      const missing = []
      for (const p of pages) {
        const tsx = join(SRC, p + '.tsx')
        if (!exists(tsx)) continue
        if (!/ThemeRoot/.test(readText(tsx))) missing.push(p)
      }
      if (missing.length > 0) {
        blocking++
        console.error(`[FAIL] RULE-3: ${missing.length}/${pages.length} 路由页未挂载 <ThemeRoot>:`)
        for (const p of missing.slice(0, 30)) console.error(`    pages/${p}.tsx`)
      } else if (!quiet) {
        console.log(`[PASS] RULE-3: ${pages.length} 个路由页全部挂载 <ThemeRoot>`)
      }
    } else if (!quiet) {
      console.log('[SKIP] RULE-3: 未能解析 app.config.ts pages[],跳过')
    }
  } else if (!quiet) {
    console.log('[SKIP] RULE-3: app.config.ts 不存在,跳过')
  }

  // ── RULE-4a:tsx 内联非白名单 #hex -> BLOCK ──
  const inlineColorRe =
    /(color|backgroundColor|fill|stroke|borderColor)\s*[:=]\s*["'](#[0-9a-fA-F]{3,8})["']/g
  const inlineOff = []
  for (const f of allTsx) {
    const clean = stripTsComments(readText(f))
    let m
    const re = new RegExp(inlineColorRe.source, 'g')
    while ((m = re.exec(clean)) !== null) {
      const hex = m[2].toLowerCase()
      if (PLATFORM_COLORS.has(hex)) continue
      inlineOff.push(`${f.replace(SRC + '/', '')}:${m[1]}=${m[2]}`)
    }
  }
  if (inlineOff.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-4a: ${inlineOff.length} 处 tsx 内联非白名单 #hex(必须改用 token):`)
    for (const s of inlineOff.slice(0, 30)) console.error(`    ${s}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-4a: tsx 无内联非白名单 #hex')
  }

  // ── RULE-4b:紫青残留 / 深海军蓝页底 / 半成品 var -> BLOCK(2026-09-03 曾漏网根因) ──
  const RESIDUE_PATTERNS = [
    [/rgba\(\s*205\s*,\s*208\s*,\s*255/i, '紫青残留 lavender rgba(205,208,255)'],
    [/rgba\(\s*253\s*,\s*255\s*,\s*225/i, '米黄残留 rgba(253,255,225)'],
    [/rgba\(\s*223\s*,\s*138\s*,\s*248/i, '紫描边 rgba(223,138,248)'],
    [/rgba\(\s*169\s*,\s*165\s*,\s*255/i, '紫阴影 rgba(169,165,255)'],
    [/#93d2f3/i, '青色残留 #93d2f3'],
    [/--color-brand-cyan\b/, '半成品 var --color-brand-cyan'],
    [/--color-accent-blue\b/, '半成品 var --color-accent-blue'],
    [/--color-text-selected\b/, '半成品 var --color-text-selected'],
    [/--color-text-date\b/, '半成品 var --color-text-date'],
    [/--color-text-icon-label\b/, '半成品 var --color-text-icon-label'],
    [/--color-text-drawer\b/, '半成品 var --color-text-drawer'],
  ]
  const NAVY_PATTERNS = [
    [/rgba\(\s*15\s*,\s*22\s*,\s*35/i, '深海军蓝 rgba(15,22,35)'],
    [/rgba\(\s*31\s*,\s*41\s*,\s*55/i, '深灰蓝 rgba(31,41,55)'],
    [/rgba\(\s*3\s*,\s*10\s*,\s*28/i, '深海军蓝 rgba(3,10,28)'],
    [/rgba\(\s*8\s*,\s*20\s*,\s*40/i, '深蓝 rgba(8,20,40)'],
    [/rgba\(\s*26\s*,\s*26\s*,\s*46/i, '深紫蓝 rgba(26,26,46)'],
    [/rgba\(\s*31\s*,\s*31\s*,\s*40/i, '深灰 rgba(31,31,40)'],
    [/rgba\(\s*15\s*,\s*23\s*,\s*42/i, '深蓝 rgba(15,23,42)'],
  ]
  const resHits = []
  for (const f of [...allTsx, ...allCss]) {
    const clean = f.endsWith('.css')
      ? stripCssComments(readText(f))
      : stripTsComments(readText(f))
    for (const [re, label] of [...RESIDUE_PATTERNS, ...NAVY_PATTERNS]) {
      if (re.test(clean)) resHits.push(`${f.replace(SRC + '/', '')} :: ${label}`)
    }
  }
  if (resHits.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-4b: ${resHits.length} 处紫青/深海军蓝/半成品 var 残留(必须 token 化):`)
    for (const h of [...new Set(resHits)].slice(0, 40)) console.error(`    ${h}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-4b: 无紫青残留/深海军蓝页底/半成品 var')
  }

  // ── RULE-5:已删除科技装饰类被重新引用(BLOCK) ──
  const reintro = []
  const scanForDeleted = (files, isCss) => {
    for (const f of files) {
      const clean = isCss ? stripCssComments(readText(f)) : stripTsComments(readText(f))
      for (const cls of DELETED_CLASSES) {
        // 类选择器 .cls 或 className 中的 "cls"/'cls'/ cls 边界
        const re = isCss
          ? new RegExp(`\\.${cls}\\b`)
          : new RegExp(`['"\`\\s]${cls}\\b`)
        if (re.test(clean)) reintro.push({ file: f, cls })
      }
    }
  }
  scanForDeleted(allCss, true)
  scanForDeleted(allTsx, false)
  if (reintro.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-5: ${reintro.length} 处已删除科技装饰类被重新引用:`)
    for (const r of reintro.slice(0, 30))
      console.error(`    ${r.file.replace(SRC + '/', '')}: .${r.cls}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-5: 无已删除科技装饰类被重新引用')
  }

  // ── RULE-6:CSS 伪类/伪元素带空格(`: active` / `: last-child` 导致 weapp-tailwindcss 构建失败) ──
  const PSEUDO_KW = [
    'active', 'hover', 'focus', 'focus-within', 'focus-visible', 'visited', 'link',
    'checked', 'unchecked', 'disabled', 'enabled', 'first-child', 'last-child',
    'first-of-type', 'last-of-type', 'nth-child', 'nth-of-type', 'only-child',
    'only-of-type', 'empty', 'not', 'root', 'target', 'default', 'valid', 'invalid',
    'required', 'optional', 'in-range', 'out-of-range', 'read-only', 'read-write',
    'placeholder-shown', 'odd', 'even', 'first-letter', 'first-line', 'selection',
    'backdrop', 'marker', 'placeholder', 'shadow', 'before', 'after',
  ]
  // RULE-6 只检查"选择器头部"(每个 { 之前的文本):声明块 / property: value 天然排除,
  // @media 等嵌套块内层规则的选择器也会被收集(声明永不入选);每段再剥括号组
  // (@media 特性 / :not() 参数),避免把 `-webkit-touch-callout: default;` 或
  // `@media (hover: hover)` 误判为"伪类带空格"
  const collectSelectorHeads = (cssText) => {
    const src = stripCssComments(cssText)
    const heads = []
    let segStart = 0
    let i = 0
    const n = src.length
    const stripParens = (seg) => {
      let prev
      do { prev = seg; seg = seg.replace(/\([^()]*\)/g, ' ') } while (seg !== prev)
      return seg
    }
    while (i < n) {
      const ch = src[i]
      if (ch === '{') {
        heads.push(stripParens(src.slice(segStart, i)))
        i++
        segStart = i
      } else if (ch === '}') {
        segStart = i + 1
        i++
      } else if (ch === '(') {
        let d = 1
        i++
        while (i < n && d > 0) {
          if (src[i] === '(') d++
          else if (src[i] === ')') d--
          i++
        }
      } else if (ch === '"' || ch === "'") {
        const q = ch
        i++
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') i++
          i++
        }
        i++
      } else {
        i++
      }
    }
    return heads.join('\n')
  }
  const spacePseudoRe = new RegExp(':[ \\t]+(' + PSEUDO_KW.join('|') + ')\\b', 'g')
  const spacePseudoHits = []
  for (const f of [...allCss, APP_CSS_PATH]) {
    if (!exists(f)) continue
    const selectorText = collectSelectorHeads(readText(f))
    let m
    const re = new RegExp(spacePseudoRe.source, 'g')
    while ((m = re.exec(selectorText)) !== null) spacePseudoHits.push(`${f.replace(SRC + '/', '')} -> 选择器内伪类带空格 :${m[1]}(应为 :${m[1]} 无空格)`)
  }
  if (spacePseudoHits.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-6: ${spacePseudoHits.length} 处 CSS 伪类带空格(应为 :pseudo 无空格,否则构建失败):`)
    for (const h of [...new Set(spacePseudoHits)].slice(0, 30)) console.error(`    ${h}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-6: 无 CSS 伪类带空格')
  }

  // ── 汇总 ──
  if (blocking > 0) {
    console.error(
      `\n❌ 跨端样式一致性守门失败:${blocking} 项 BLOCK 级问题(已阻塞;判定面:${FACE_LABEL_TEXT})`,
    )
    return 1
  }
  if (!quiet) {
    if (warnings > 0)
      console.log(`\n✅ 跨端样式一致性守门通过(${warnings} 项 WARN,不阻塞;判定面:${FACE_LABEL_TEXT})`)
    else console.log(`\n✅ 跨端样式一致性守门通过(无 WARN;判定面:${FACE_LABEL_TEXT})`)
  }
  return 0
}

// ─── §22d 双形态入口守护 ───
// 下面那段是 CLI 副作用(索引面取材 + process.exit)。测试 import 本文件只为拿纯判据,
// 若不加守护,import 一次就等于把整道门跑完并杀掉测试进程。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    if (FACE === 'staged') ensureFaceIndex()
    process.exit(main())
  } catch (e) {
    if (e instanceof Undetermined) {
      failUndetermined(`索引面取材失败(**不回退磁盘**):${e.message}`)
      process.exit(2)
    }
    throw e
  }
}

export const __test__ = { resolveRootArg, selectFace, relKeyOf: () => relKey, getFace: () => FACE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
