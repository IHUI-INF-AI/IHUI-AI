#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 324:import 目标完整性(治"看得见 import、看不见文件")。
 *
 * ## 立因(2026-11-15)
 * 2026-11-15 一天内实测到 **两批**同型故障:引用方已进库、被引用文件当刻不在工作树
 * (`093e778d7e` / `c6ce232d0c5` 两笔"全量提交工作树"兜底提交),留下
 * `@/stores/appearance-scope`、`./message-style-menu`、`@/lib/bionic-reading`、
 * `@/hooks/use-resolved-appearance`、`rn-compat/press-handlers.ts` 等悬空引用 ⇒
 * `apps/web` 与 `apps/miniapp-taro` 的 typecheck 结构性红,部署环连续失败。
 * 杀伤力不在当笔:此后**每一笔**提交的 pre-push typecheck 都必然红,与本笔无关,
 * 逼所有人 `--no-verify` —— 一处绕门,该提交上全部守门同时作废。
 *
 * ## 判据
 *   R1 每个候选源文件里的 `from '…'` / `import '…'` / `import('…')` / `require('…')`,
 *      若说明符是**本地路径**(`./` `../`)或工作区别名(`@/` `~/`),解析后目标必须在
 *      **同一棵提交树**里存在(按 ts/js/json 扩展名与 `index.*` 逐个试)。
 *   R2 棘轮:只拦**本笔新增或恶化**的悬空引用。锚点 = 同一文件在 HEAD 面的悬空数。
 *      HEAD 取不到(新文件)⇒ 锚点 0。存量只报数、不判红。
 *   R3 尺子失效保护:HEAD 面一个候选都扫不到 ⇒ exit 2(绝不记绿)。
 *
 * ## 面纪律(§0.3 / §0.6)
 * 全量判 HEAD blob;`--staged` 判索引 blob。两面旗同给 = 用法错。取不到面 / 取不到
 * blob 一律 **exit 2(未判定)** —— 不冒红也不记绿,不回落另一个面。
 * 清单与正文同面同轮,均出自 `./lib/face-reader.mjs`(本门只用该层,不自写 `git show`)。
 *
 * ## 射程(stagedTriggers)
 * `apps/` `packages/` —— 本门只读这两个根下的源文件,别处的提交不会触发它。
 *
 * ## 用法与出口
 * 用法: node scripts/check-import-integrity.mjs [--staged] [--self-test] [--quiet]
 * 退出: 0 通过(无新增悬空) / 1 有新增悬空 / 2 无法判定(面或 blob 取不到、尺子失效)
 * 跳过: HUSKY_SKIP_IMPORT_INTEGRITY=1(应急放行,提交信息须写明责任归属)
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, listFaceFiles, selectFace } from './lib/face-reader.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const SKIP_ENV = 'HUSKY_SKIP_IMPORT_INTEGRITY'
const GIT_TIMEOUT = 120_000
const MAX_BUFFER = 1 << 29

/** 只有这些扩展名的文件才被判 */
const SRC_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** 解析候选后缀:先按原名,再补扩展名;最后试 `<dir>/index.<ext>` */
const SUFFIXES = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json']

/** 只判这两个根下的源码(apps 的 src/ 与 app/ 面、packages 的 src/ 面) */
const SCOPE_RE = /^(?:apps\/[^/]+\/(?:src|app)\/|packages\/[^/]+\/src\/)/

/** 产物与依赖目录永不参与 */
const EXCLUDE_RE = /(?:^|\/)(?:node_modules|dist|\.next|build|coverage|\.turbo)\//

/**
 * 测试面不判。原因不是"测试不重要",而是测试里的说明符**本来就可以不存在**:
 *   · `vi.mock('./model-switch')` / `vi.mock('virtual:x')` 注册的是虚拟模块;
 *   · `import x from '../Foo.tsx?raw'` 是打包器的加载器查询串(不是文件路径);
 *   · 反向断言常故意引用不存在的模块来验证降级路径。
 * 这三类在本门判据下全是假红,而真·缺件的测试会在跑测试时自己炸,不需要本门兜。
 */
const TEST_EXCLUDE_RE = /(?:^|\/)(?:__tests__|tests)\/|\.(?:test|spec)\.[a-z]+$/i

const C = {
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  dim: '\u001b[2m',
  reset: '\u001b[0m',
}

/* ============================ 纯函数(供自检) ============================ */

function extOf(rel) {
  const m = rel.match(/\.[a-z]+$/i)
  return m ? m[0].toLowerCase() : ''
}

/**
 * 注释遮罩:把 `//…` 与 `/* … *\/` 换成等长空格(换行保留),**字符串内容不动**。
 *
 * 为什么要自己写:注释里的 `// import x from './gone'` 不该判红;而 URL 里的 `https://`
 * 在字符串内,不能当注释起点。长度保持不变是为了让"在遮罩文本上匹配、在原文上取值"
 * 的偏移量可直接复用。
 */
export function maskComments(src) {
  const out = src.split('')
  const n = src.length
  let i = 0
  let quote = null
  while (i < n) {
    const c = src[i]
    if (quote) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      i += 1
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') {
        out[i] = ' '
        i += 1
      }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      out[i] = ' '
      out[i + 1] = ' '
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i += 1
      }
      if (i < n) {
        out[i] = ' '
        if (i + 1 < n) out[i + 1] = ' '
        i += 2
      }
      continue
    }
    i += 1
  }
  return out.join('')
}

/** 从已遮罩的源码里抽出全部模块说明符(去重、保序) */
export function extractSpecs(masked) {
  const found = []
  const patterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"\n]+)['"]/g,
  ]
  for (const re of patterns) {
    for (const m of masked.matchAll(re)) {
      const spec = m[1]
      if (spec && !found.includes(spec)) found.push(spec)
    }
  }
  return found
}

/** 该说明符是不是"本地路径"(相对路径或工作区别名) */
export function isLocalSpec(spec) {
  return spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('~/')
}

/**
 * 解析本地说明符到候选路径列表(仅算路径,不判存在)。
 * `@/x` 与 `~/x` 一律映射到**本文件所属包**的 `src/x` —— 本仓两个端
 * (apps/web、apps/miniapp-taro)与 packages/* 的别名都指向自己的 src。
 */
export function candidatePaths(rel, spec) {
  // 打包器加载器查询串(`?raw` / `?url` / `?inline`)不是路径的一部分
  const clean = spec.split('?')[0].split('#')[0]
  let base
  if (clean.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(rel), clean))
  } else {
    const pkg = rel.split('/').slice(0, 2).join('/')
    base = path.posix.normalize(`${pkg}/src/${clean.slice(2)}`)
  }
  if (base.startsWith('..')) return []
  const bases = [base]
  // ESM 里常见的 `./x.js` 实际指向 TS 源码:补一组换扩展名的变体
  if (base.endsWith('.js')) bases.push(base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx')
  if (base.endsWith('.mjs')) bases.push(base.slice(0, -4) + '.mts', base.slice(0, -4) + '.ts')
  const out = []
  for (const b of bases) {
    for (const s of SUFFIXES) out.push(b + s)
    for (const s of SUFFIXES) out.push(`${b}/index${s}`)
  }
  return out
}

/** 在给定文件集上解析;返回 null 表示"本地说明符但目标不存在" */
export function resolveLocalSpec(rel, spec, fileSet) {
  if (!isLocalSpec(spec)) return { local: false }
  const cands = candidatePaths(rel, spec)
  for (const c of cands) if (fileSet.has(c)) return { local: true, resolved: c }
  return { local: true, resolved: null }
}

/** 判定一份源码:返回悬空的说明符列表 */
export function judgeSource(rel, src, fileSet) {
  const specs = extractSpecs(maskComments(src))
  const missing = []
  for (const spec of specs) {
    const r = resolveLocalSpec(rel, spec, fileSet)
    if (r.local && !r.resolved) missing.push(spec)
  }
  return missing
}

/* ============================== 面与清单 ============================== */

/**
 * 列一个面的全部路径。**统一走 `listFaceFiles`,不自写 `git ls-tree`** ——
 * 索引面的正确动词是 `git ls-files --cached`,`ls-tree` 少了 tree-ish 直接 usage 报错
 * (本轮实测踩过),而这层差异已经收在 `lib/face-reader.mjs` 里(§0.6 单一实现)。
 */
function listFaceAll(face) {
  return listFaceFiles(ROOT, face, { timeout: GIT_TIMEOUT })
}

function readFace(rev, rels) {
  if (rels.length === 0) return new Map()
  const specs = rels.map((r) => `${rev}:${r}`)
  const got = catBatch(ROOT, specs, { timeout: GIT_TIMEOUT, maxBuffer: MAX_BUFFER })
  const out = new Map()
  for (const rel of rels) {
    const src = got.get(`${rev}:${rel}`)
    if (src === undefined || src === null) {
      throw new Error(`${rev || '索引'}:${rel} 取不到 ⇒ 该面无法判定`)
    }
    out.set(rel, src)
  }
  return out
}

/* ================================ 主判 ================================ */

function main() {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`[import-integrity] ${SKIP_ENV}=1 ⇒ 跳过(应急放行,提交信息须写明责任归属)`)
    return 0
  }

  const argv = process.argv.slice(2)
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: false, def: 'head' })
  if (!picked.face || picked.error) {
    console.error(`${C.red}❌ [import-integrity] 未判定:${picked.error || '取不到判定面'}${C.reset}`)
    return 2
  }
  const face = picked.face
  const rev = face === 'staged' ? '' : 'HEAD'
  const faceLabel = face === 'staged' ? '索引面' : 'HEAD 面'

  let listed
  try {
    listed = listFaceAll(face)
  } catch (e) {
    console.error(
      `${C.red}❌ [import-integrity] 未判定:取不到 ${faceLabel} 清单(${e instanceof Error ? e.message : String(e)})${C.reset}`,
    )
    return 2
  }

  const candidates = listed.filter(
    (p) =>
      SRC_EXTS.has(extOf(p)) &&
      SCOPE_RE.test(p) &&
      !EXCLUDE_RE.test(p) &&
      !TEST_EXCLUDE_RE.test(p),
  )
  if (candidates.length === 0) {
    console.error(
      `${C.red}❌ [import-integrity] ${faceLabel} 下没有一个可判候选 ⇒ 尺子疑似失效 ⇒ exit 2${C.reset}`,
    )
    return 2
  }

  const fileSet = new Set(listed)
  let current
  try {
    current = readFace(rev, candidates)
  } catch (e) {
    console.error(
      `${C.red}❌ [import-integrity] 未判定:${e instanceof Error ? e.message : String(e)}${C.reset}`,
    )
    return 2
  }

  const judged = []
  for (const rel of candidates) {
    const missing = judgeSource(rel, current.get(rel), fileSet)
    if (missing.length > 0) judged.push({ rel, missing })
  }

  // ---- 棘轮:staged 档只给"有悬空"的文件取 HEAD 锚点 ----
  let headFileSet = null
  const headSrc = new Map()
  if (face === 'staged' && judged.length > 0) {
    try {
      const headListed = listFaceAll('head')
      headFileSet = new Set(headListed)
      const need = judged.map((j) => j.rel)
      const fetched = readFace('HEAD', need).entries()
      for (const [rel, src] of fetched) headSrc.set(rel, src)
    } catch {
      // HEAD 取不到(如首次提交/浅克隆)⇒ 一律按锚点 0,新增即拦;不因此判未判定
      headFileSet = null
    }
  }

  const violations = []
  let stock = 0
  for (const j of judged) {
    let anchor = 0
    if (face === 'head') {
      anchor = 0 // 全量档按构造"新增恒 0",只报存量
      stock += j.missing.length
      continue
    }
    if (headFileSet && headSrc.has(j.rel)) {
      anchor = judgeSource(j.rel, headSrc.get(j.rel), headFileSet).length
    }
    const delta = j.missing.length - anchor
    if (delta > 0) violations.push({ rel: j.rel, missing: j.missing, anchor })
    else stock += j.missing.length
  }

  if (face === 'head') {
    // 全量档:巡检读数,不判红(提交链只走 --staged)
    console.log(
      `[import-integrity] 判定面=${faceLabel}:候选 ${candidates.length} 个;存量悬空 ${stock} 处 / ${judged.length} 文件(棘轮只报数,不判红)`,
    )
    for (const j of judged.slice(0, 20)) {
      console.log(`  ${C.dim}·${C.reset} ${j.rel} → ${j.missing.join(', ')}`)
    }
    if (judged.length > 20) console.log(`  ${C.dim}…其余 ${judged.length - 20} 个文件见 --quiet 关闭后重跑${C.reset}`)
    return 0
  }

  if (violations.length === 0) {
    console.log(
      `[import-integrity] ✅ import 目标完整性通过(${faceLabel}:候选 ${candidates.length} 个,新增悬空 0;存量 ${stock} 处只报数)`,
    )
    return 0
  }

  console.error(
    `${C.red}❌ [import-integrity] 本笔新增/恶化 ${violations.length} 个文件的悬空 import(${faceLabel}):${C.reset}`,
  )
  for (const v of violations) {
    console.error(`  · ${v.rel}(HEAD 锚点 ${v.anchor})`)
    for (const spec of v.missing) console.error(`      ${C.red}→ ${spec}${C.reset} 目标不在同一棵树里`)
  }
  console.error(
    `  ${C.yellow}💡 两种正解:① 把被引用文件一起提交;② 删掉这条引用(并把功能一并摘干净)。${C.reset}`,
  )
  console.error(
    `  ${C.yellow}   应急放行:${SKIP_ENV}=1(提交信息须写明责任归属)。${C.reset}`,
  )
  return 1
}

/* ============================== 自检档 ============================== */

function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, cond })

  const fileSet = new Set([
    'apps/web/src/a.ts',
    'apps/web/src/b/index.tsx',
    'apps/web/src/c.json',
    'packages/app/src/d.tsx',
    'apps/web/src/util.ts',
  ])

  ok('相对路径命中', resolveLocalSpec('apps/web/src/a.ts', './util', fileSet).resolved === 'apps/web/src/util.ts')
  ok('相对目录命中 index', resolveLocalSpec('apps/web/src/a.ts', './b', fileSet).resolved === 'apps/web/src/b/index.tsx')
  ok('别名命中本包 src', resolveLocalSpec('apps/web/src/a.ts', '@/util', fileSet).resolved === 'apps/web/src/util.ts')
  ok('缺目标判 null', resolveLocalSpec('apps/web/src/a.ts', './gone', fileSet).resolved === null)
  ok('裸包名不归本门', resolveLocalSpec('apps/web/src/a.ts', 'react', fileSet).local === false)
  ok(
    '逃出仓库根的相对路径不产出候选',
    candidatePaths('apps/web/src/a.ts', '../../../../../../etc/passwd').length === 0,
  )

  const masked = maskComments(`
    // import gone from './gone'
    /* const x = require('./gone2') */
    import real from './util'
    const u = 'https://example.com/x'
  `)
  const specs = extractSpecs(masked)
  ok('注释里的 import 不算', !specs.includes('./gone') && !specs.includes('./gone2'))
  ok('真 import 抽得到', specs.includes('./util'))

  const missing = judgeSource(
    'apps/web/src/a.ts',
    "import x from './gone'\nimport y from './util'\n",
    fileSet,
  )
  ok('只报缺的那条', missing.length === 1 && missing[0] === './gone')

  const passed = cases.filter((c) => c.cond).length
  for (const c of cases) {
    console.log(`${c.cond ? `${C.green}✅${C.reset}` : `${C.red}❌${C.reset}`} ${c.name}`)
  }
  console.log(`${passed}/${cases.length} 项自检${passed === cases.length ? ' 通过' : ' 未通过'}`)
  return passed === cases.length ? 0 : 2
}

/* ================================ 入口 ================================ */

const argv = process.argv.slice(2)
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (argv.includes('--self-test')) {
  process.exitCode = selfTest()
} else if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(
      `${C.red}❌ [import-integrity] 未判定:脚本自身异常 ${e instanceof Error ? e.message : String(e)}${C.reset}`,
    )
    process.exitCode = 2
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
