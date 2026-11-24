// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-hook-chain-refs.mjs — 钩子链引用完整性(2026-11-07 立)
 *
 * 病灶(实测):main HEAD b7ec515d92 单父提交把 082a260dcd / 6b849b5db6 / 0e3684bd62
 * 三笔的**调用方**挑进树里,被调用物没跟着进来 ⇒ 钩子一 require 就崩,而全仓 2519 个
 * JS 文件的全树扫描里,真需要只有 1 条,另有 19 条是注释/夹具字符串(静态扫描无法区分)。
 * 所以本门不判"全树有没有悬空 require",只判**真的会被加载的那条链**:
 *   ① 钩子(clone-runner → pre-commit-hook)能否 require 到底;
 *   ② 钩子源码里 spawn/exec 的 scripts/*.mjs|js 入口在不在;
 *   ③ 这些入口自身的相对 import 闭包能不能落到底(第 4 例 intentional-file-deletion.mjs
 *      就是靠这一档才被抓到,①②两档都看不见它)。
 *
 * 判据/退出码:
 *   默认只报数(exit 0);--strict:闭包内任一模块解析不到 / spawn 入口缺失 ⇒ exit 1(判红)。
 *   全树静态扫描只作基准读数,不参与判红(19 条夹具字符串是已知假阳性)。
 *
 * 基准读数(2026-11-07,HEAD b7ec515d92,修前三件缺失):
 *   JS 文件 2519 | 相对 require 39 条 | 全树解析不到 20 条(闭包内 1 条)
 *   钩子 spawn 引用 39 处 | 入口缺失 1 处(scripts/check-staged-resurrection.mjs)
 *   入口 import 闭包缺失 1 个(scripts/lib/intentional-file-deletion.mjs)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findRepoRoot } from './lib/gate-body-provenance.mjs'
import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = findRepoRoot(fileURLToPath(import.meta.url))
const STRICT = process.argv.includes('--strict')
const HOOK = 'scripts/lib/pre-commit-hook.js'
const CANDIDATE_EXTS = [
  '',
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '/index.js',
  '/index.cjs',
  '/index.mjs',
  '/index.ts',
  '/index.tsx',
]

// 判红面看**工作区**(钩子执行的就是工作区文件);HEAD 树只用来报"提交态还缺哪些"。
// 裸 `execFileSync('git', …)` 迁共享层 gitRaw(§12g 单源):原写法无 timeout、maxBuffer 吃默认
// 1MB,层默认 60s / 64MB 只强不弱;取不到仍与原来一样直接抛(顶层无 catch ⇒ 整门当场崩),
// 失败语义不变,只是 message 由层拼成 `git ls-tree 失败: <原因>`(比 Node 原生句式多归因)。
const headTree = new Set(
  String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], ROOT) ?? '')
    .split(/\r?\n/)
    .filter(Boolean),
)
const resolveWt = (rel) => CANDIDATE_EXTS.map((e) => rel + e).find((p) => existsSync(path.join(ROOT, p)))
const exists = (rel) => Boolean(resolveWt(rel))
const readWt = (rel) => readWorktreeFile(ROOT, rel) ?? ''


const REL_REQUIRE = String.raw`require\([[:space:]]*(['"])\.\.?\/[^'"]*\1[[:space:]]*\)`
const SPEC_RE = /(?:require\(\s*(['"])(\.\.?\/[^'"]*)\1\s*\)|(?:from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]*)\3)/g

/** 逐行推进"是否处在跨行模板字符串内":跳过转义、`'...'`/`"..."`、`//` 注释里的反引号。 */
function templateStateAfter(line, inTemplate) {
  let state = inTemplate ? 'tpl' : 'code'
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\') {
      i++
      continue
    }
    if (state === 'tpl') {
      if (c === '`') state = 'code'
      continue
    }
    if (state === 'dq' || state === 'sq') {
      if (c === (state === 'dq' ? '"' : "'")) state = 'code'
      continue
    }
    if (c === '/' && line[i + 1] === '/') break
    if (c === '`') state = 'tpl'
    else if (c === '"') state = 'dq'
    else if (c === "'") state = 'sq'
  }
  return state === 'tpl'
}

/**
 * 只认"真的会执行"的相对引用:注释行整体跳过;行内 `require(`/`from` 之前已出现引号
 * ⇒ 该处是夹具字符串里的示例(如 `'a.js': "module.exports = require('./x')"`),跳过;
 * 跨行模板字符串内整行跳过(生成器把产物源码当模板写,`import ... from './x'` 不是真引用)。
 * 这一步是全树扫描里 19 条假阳性的来源,也是唯一能把 2519/39/20 收敛到 2519/19/0 的判据。
 */
function collectSpecs(src) {
  const out = []
  let inTemplate = false
  for (const line of src.split(/\r?\n/)) {
    const startedInTemplate = inTemplate
    inTemplate = templateStateAfter(line, inTemplate)
    if (startedInTemplate) continue
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    for (const m of line.matchAll(SPEC_RE)) {
      const before = line.slice(0, m.index)
      if (/['"`]/.test(before)) continue
      const spec = m[2] || m[4]
      if (spec && !/\$\{/.test(spec)) out.push(spec)
    }
  }
  return out
}

// ─── ① 全树静态基准读数(不判红)──────────────────────────────────────────────
const jsFiles = [...headTree].filter((f) => /\.(c|m)?js$/.test(f))
// 裸 `spawnSync('git', …)` 迁共享层 gitRaw(§12g 单源),maxBuffer 1<<28 与原自拼同参数
//(256MB,不得回落层默认 64MB —— 这档原文就是 256MB,缓冲区不许降档);timeout 取层默认 60s
//(原写法无界,更严)。失败语义也保持原样:原来只取 `.stdout`、**不看状态码**,git grep 零命中
// 本来就退出 1、spawn 失败时 stdout 为 null,一律落空串 —— 所以这里同样不抛:本档只是
//「全树静态基准读数(不判红)」,判红面在下面的③闭包,读数取不到就按零命中报数,不崩整门。
let grepOut
try {
  grepOut = gitRaw(['grep', '-n', '-E', REL_REQUIRE, 'HEAD', '--', '*.js', '*.mjs', '*.cjs'], ROOT, {
    maxBuffer: 1 << 28,
  })
} catch {
  grepOut = ''
}
let treeRequires = 0
const treeBroken = []
for (const line of String(grepOut || '').split(/\r?\n/)) {
  const m = /^HEAD:(.*?):(\d+):(.*)$/.exec(line)
  if (!m) continue
  const [, file, lineno, content] = m
  const t = content.trim()
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
  const spec = /require\(\s*['"](\.[^'"]*)['"]\s*\)/.exec(content)
  if (!spec) continue
  const before = content.slice(0, spec.index)
  if (/['"`]/.test(before)) continue
  treeRequires++
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec[1]))
  if (!exists(target)) treeBroken.push(`${file}:${lineno} -> ${spec[1]}`)
}

// ─── ② 钩子 spawn 入口存在性 ─────────────────────────────────────────────────
// 只认会执行的 token:注释行、行内引号之后的提及(「见 scripts/xxx.mjs」)一律不算,
// 否则闭包会被注释里提到的生成器带偏(实测把 gen-rn-compat/sync-rn-tokens 的模板字符串
// 当成真 import,多出 2 条假红)。
const hookSrc = exists(HOOK) ? readWt(HOOK) : ''
const spawnTargets = new Set()
let spawnMentioned = 0
for (const line of hookSrc.split(/\r?\n/)) {
  const t = line.trim()
  const tokens = [...line.matchAll(/scripts\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:mjs|js)/g)]
  spawnMentioned += tokens.filter((m) => !m[0].includes('*')).length
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
  for (const m of tokens) {
    if (m[0].includes('*')) continue
    spawnTargets.add(m[0])
  }
}
const spawnMissing = [...spawnTargets].filter((p) => !exists(p))

// ─── ③ 钩子 + spawn 入口的 import 闭包(判红面)────────────────────────────────
const closureMissing = []
const visited = new Set()
const queue = [HOOK, ...[...spawnTargets].filter((p) => exists(p))]
while (queue.length) {
  const file = queue.pop()
  if (visited.has(file)) continue
  visited.add(file)
  let src
  try {
    src = readWt(file)
  } catch {
    continue
  }
  for (const spec of collectSpecs(src)) {
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), spec.replace(/\\/g, '/')),
    )
    const resolved = resolveWt(target)
    if (!resolved) closureMissing.push(`${file} -> ${spec}`)
    else if (/\.(c|m)?js$/.test(resolved)) queue.push(resolved)
  }
}

// ─── ③b 提交态还缺哪些(工作区已补、HEAD 树未补 ⇒ 只报不判红)────────────────
const headMissing = [...new Set([HOOK, ...spawnTargets, ...visited])].filter(
  (p) => /\.(c|m)?js$/.test(p) && !headTree.has(p) && exists(p),
)

// ─── ④ 钩子本体能否 require(不靠静态推断)──────────────────────────────────
const hookLoad = spawnSync(process.execPath, ['-e', `require('./${HOOK}')`], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
})
const hookLoadErr = hookLoad.status === 0 ? '' : String(hookLoad.stderr || '').trim().split('\n')[0]

// ─── 汇总 ───────────────────────────────────────────────────────────────────
console.log(
  `钩子链引用完整性:JS 文件 ${jsFiles.length} | 相对 require ${treeRequires} 条 | 全树解析不到 ${treeBroken.length} 条(已知夹具/注释假阳性,不判红) | 钩子 spawn 提及 ${spawnMentioned} 处/真调用 ${spawnTargets.size} 处 | 入口缺失 ${spawnMissing.length} 处 | 闭包缺失 ${closureMissing.length} 个 | 钩子 require=${hookLoad.status === 0 ? 'OK' : 'FAIL'} | 工作区已补而 HEAD 未补 ${headMissing.length} 个`,
)
for (const p of spawnMissing) console.log(`  MISSING-SPAWN ${p}`)
for (const p of closureMissing) console.log(`  MISSING-MODULE ${p}`)
for (const p of headMissing) console.log(`  WORKTREE-ONLY ${p}`)
if (hookLoadErr) console.log(`  REQUIRE-FAIL ${hookLoadErr}`)

const red = closureMissing.length + spawnMissing.length + (hookLoad.status === 0 ? 0 : 1)
if (STRICT && red > 0) {
  console.error(`❌ 钩子链有 ${red} 处引用落不到底(缺失文件 ⇒ 提交路径会当场崩)`)
  process.exit(1)
}
if (!STRICT) console.log('ℹ️ 只报数模式;判红请加 --strict')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
