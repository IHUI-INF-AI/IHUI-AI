#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据层守门 —— 拦住"新增 sqlite 写路径"。2026-11-19 立,机主定档:项目数据层只允许 PostgreSQL。
 *
 * ## 为什么是差值棘轮而不是"出现即拦"
 *
 * 现读 HEAD 面有 5 个模块在用 sqlite 落盘(审批授权 / 会话存储 / SSO 身份 / 记忆清理 / 工作准入)。
 * 把存量挂成绝对红就是 §12e 的恒红门 —— 唯一结局是人人 `--no-verify`,连带废掉该提交上全部守门。
 * 所以锚点 = **基线清单**(`scripts/data/sqlite-write-paths-baseline.json`)里的逐文件命中数:
 * 只拦"本次提交把这个数加上去"或"出现了清单外的新写路径";清存量时只报数。
 * 升绝对档的前置 = 基线归零(五模块全迁完)。
 *
 * ## 射程按"会不会产生我们的存储"收窄,不做语义猜测
 *
 * 命中族(可机械判定):
 *   1) Python `sqlite3.connect(` —— 打开连接即可能写
 *   2) `aiosqlite` —— 同上,异步封装
 *   3) JS `better-sqlite3` / `sqlite3.Database` / `new Database(` —— Node 侧同样一型
 *
 * **读别人的库不算**:同一行带 `mode=ro`(只读 URI)或 `:memory:`(临时库)时不计命中。
 * `browser_hub.py` 的 `mode=ro`、`importers/cursor.py` 的 `:memory:` 因此天然在射程外,
 * 不需要在基线里登记成"豁免"——那会把"技术上不是存储"降级成"人批准的例外"。
 *
 * 证据常量不算:`codex_local_store_schema.py` 里的 `"goals_1.sqlite"` 是**关于外部程序的取证**,
 * 不是我们的库;它的形态是字符串常量,不含任何 connect/Database 调用,结构上打不到。
 *
 * ## 取材面纪律(§0.4)
 *
 * 默认判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容同面同轮。
 * 取不到 = 未判定(exit 2),不回落另一个面。
 *
 * 用法:
 *   node scripts/check-sqlite-write-paths.mjs                 # 判 HEAD 面
 *   node scripts/check-sqlite-write-paths.mjs --staged        # 判索引面
 *   node scripts/check-sqlite-write-paths.mjs --worktree      # 人工逃生舱
 *   node scripts/check-sqlite-write-paths.mjs --emit-baseline # 打印基线 JSON(不写盘)
 *   node scripts/check-sqlite-write-paths.mjs --self-test     # 判据自检(无需仓库)
 *
 * 机读末行:
 *   `SQLITE-WRITE-PATHS-RESULT state=clean|new|undetermined new=<n> base=<n> face=<head|staged|worktree>`
 * 退出码:0 = 只在基线内 / 1 = 出现新增(blocking) / 2 = 未判定或用法错。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, listFaceFiles, gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/data/sqlite-write-paths-baseline.json'
const SUBROOTS = ['apps', 'packages', 'scripts']
const EXTS = ['.py', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx']
// 尺子不量自己:本文件的命中族常量、ALLOW 标记与自检用例本身就是这些字面,
// 扫进来必然"清单外新命中 10 处" ⇒ 恒红门(§12e)。同族:镜像测试同样不量。
const SKIP_SELF = new Set(['scripts/check-sqlite-write-paths.mjs', 'scripts/tests/check-sqlite-write-paths.test.mjs'])

// 降噪豁免族(2026-11-19 立,自有写路径清零后启用零容忍):这两处**不是我们的存储**——
// 一处是读外部格式(浏览器 profile),一处是 PG 集成用例的历史输入夹具(用例本身跑 PG)。
// 豁免必须"验过才免":每轮都核对路径仍在被审面存在,消失即判红(豁免到期)。
// 除这两条之外,**任何 sqlite 写形态都不再有基线**:一律按"清单外新命中"判红。
export const NON_STORE_FIXTURES = new Map([
  [
    'apps/ai-service/tests/test_external_browser_profile.py',
    '外部浏览器 profile 夹具:构造/读取别人格式的 sqlite 文件,不是我们的存储',
  ],
  [
    'apps/ai-service/tests/test_sag2_pg_integration.py',
    'PG 集成用例的历史输入夹具:为"迁移前形态"准备 sqlite 输入,该用例本身跑 PG',
  ],
])

// 命中族:打开/驱动 sqlite 的调用形态。顺序即诊断顺序。
export const HIT_PATTERNS = [
  { id: 'py-connect', re: /sqlite3\.connect\s*\(/g },
  { id: 'py-aiosqlite', re: /\baiosqlite\b/g },
  { id: 'js-better-sqlite3', re: /better-sqlite3/g },
  { id: 'js-sqlite3-database', re: /sqlite3\.Database\b/g },
  { id: 'js-new-database', re: /\bnew\s+Database\s*\(/g },
]

// 豁免标记:不是我们的存储。
export const ALLOW_MARKERS = ['mode=ro', "mode: 'ro'", 'mode: "ro"', ':memory:']

const USAGE = [
  '用法: node scripts/check-sqlite-write-paths.mjs [--staged|--worktree|--emit-baseline|--self-test] [--root <仓库根>]',
]

/** 该行是否命中的唯一判据(供扫描与自检共用)。 */
export function classifyLine(line) {
  const text = String(line)
  for (const marker of ALLOW_MARKERS) {
    if (text.includes(marker)) return null
  }
  for (const p of HIT_PATTERNS) {
    p.re.lastIndex = 0
    if (p.re.test(text)) return p.id
  }
  return null
}

/** 一份文件内容的命中数(按行计,一行多命中记一次)。 */
export function countHits(content) {
  let n = 0
  for (const line of String(content).split(/\r?\n/)) {
    if (classifyLine(line) !== null) n += 1
  }
  return n
}

function underSubroots(rel) {
  return SUBROOTS.some((s) => rel === s || rel.startsWith(`${s}/`))
}

function isSource(rel) {
  const dot = rel.lastIndexOf('.')
  return dot > 0 && EXTS.includes(rel.slice(dot))
}

function readBaseline(root) {
  const p = join(root, BASELINE_REL)
  if (!existsSync(p)) return null
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  if (!raw || typeof raw.files !== 'object' || raw.files === null) return null
  return raw
}

/** 扫描一个判定面,返回逐文件命中表。 */
function scanFace({ root, face }) {
  const listed = listFaceFiles(root, face, { paths: SUBROOTS })
  const targets = listed.filter(
    (rel) => underSubroots(rel) && isSource(rel) && !SKIP_SELF.has(rel) && !NON_STORE_FIXTURES.has(rel),
  )
  if (!targets.length) throw new Error(`目录枚举到 0 个候选(${face} 面)`)

  const hits = new Map()
  if (face === 'worktree') {
    for (const rel of targets) {
      const abs = join(root, rel)
      if (!existsSync(abs)) continue
      const n = countHits(readFileSync(abs, 'utf8'))
      if (n > 0) hits.set(rel, n)
    }
    return { hits, scanned: targets.length, listed: new Set(listed) }
  }
  const spec = (rel) => (face === 'head' ? `HEAD:${rel}` : `:${rel}`)
  const batch = catBatch(root, targets.map(spec))
  for (const rel of targets) {
    const content = batch.get(spec(rel))
    if (content === null || content === undefined) {
      throw new Error(`blob 取不到(${face}:${rel})`)
    }
    const n = countHits(content)
    if (n > 0) hits.set(rel, n)
  }
  return { hits, scanned: targets.length, listed: new Set(listed) }
}

/** 基线 vs 现读 ⇒ 新增集。 */
export function diffAgainstBaseline(hits, baseline) {
  const base = baseline?.files ?? {}
  const grown = []
  const fresh = []
  for (const [rel, n] of [...hits.entries()].sort()) {
    const was = Number(base[rel] ?? 0)
    if (!(rel in base)) {
      if (n > 0) fresh.push({ path: rel, count: n })
      continue
    }
    if (n > was) grown.push({ path: rel, count: n, baseline: was })
  }
  return { grown, fresh }
}

function selfTest({ quiet = false } = {}) {
  const problems = []
  const cases = [
    ['conn = sqlite3.connect(str(db_path))', 'py-connect'],
    ['await aiosqlite.connect(path)', 'py-aiosqlite'],
    ['const db = new Database(tmp)', 'js-new-database'],
    ['require("better-sqlite3")', 'js-better-sqlite3'],
    ['con = sqlite3.connect(f"file:{dst}?mode=ro", uri=True)', null],
    ['conn = sqlite3.connect(":memory:")', null],
    ['"goals_1.sqlite",', null],
    ['DATABASE_URL=postgresql://localhost/postgres', null],
  ]
  for (const [line, want] of cases) {
    const got = classifyLine(line)
    if (got !== want) problems.push(`classifyLine(${JSON.stringify(line)}) = ${got}, 期望 ${want}`)
  }
  if (countHits('a\nsqlite3.connect(1)\nb\nsqlite3.connect(2)') !== 2) {
    problems.push('countHits 未按行计数')
  }
  if (countHits('sqlite3.connect(1) # mode=ro') !== 0) {
    problems.push('allow 标记未生效')
  }
  const d = diffAgainstBaseline(
    new Map([['a.py', 2], ['b.py', 1]]),
    { files: { 'a.py': 2, 'c.py': 3 } },
  )
  if (d.grown.length !== 0) problems.push('同数不该判新增')
  if (d.fresh.length !== 1 || d.fresh[0].path !== 'b.py') problems.push('清单外文件必须点名')
  const d2 = diffAgainstBaseline(new Map([['a.py', 3]]), { files: { 'a.py': 2 } })
  if (d2.grown.length !== 1 || d2.grown[0].baseline !== 2) problems.push('涨了必须报出新旧数')
  for (const p of problems) if (!quiet) console.log(`❌ ${p}`)
  if (!quiet) {
    console.log(
      `SQLITE-WRITE-PATHS-SELFTEST state=${problems.length ? 'fail' : 'ok'} cases=${cases.length} problems=${problems.length}`,
    )
  }
  return problems.length ? 1 : 0
}

function parseArgv(argv) {
  const out = { face: 'head', emitBaseline: false, selfTest: false, root: ROOT, error: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--staged') out.face = 'staged'
    else if (a === '--worktree') out.face = 'worktree'
    else if (a === '--emit-baseline') out.emitBaseline = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--root') {
      const v = argv[i + 1]
      if (!v) out.error = '--root 缺参数'
      else {
        out.root = resolve(v)
        i += 1
      }
    } else out.error = `未知参数 ${a}`
  }
  return out
}

function main() {
  const a = parseArgv(process.argv.slice(2))
  if (a.error) {
    console.log(`❌ 用法错 —— ${a.error}`)
    for (const l of USAGE) console.log(l)
    return 2
  }
  if (a.selfTest) return selfTest()

  // 直跑面纪律(门 312):门体被直接调用时先自证判据可用 —— 判据坏了就不许答题(exit 2)。
  const stProblems = selfTest({ quiet: true })
  if (stProblems) {
    console.log('SQLITE-WRITE-PATHS-RESULT state=undetermined new=NA base=NA face=none')
    console.log('❌ 未判定:判据自检不过(跑 --self-test 看明细)')
    return 2
  }

  try {
    gitRaw(['rev-parse', '--git-dir'], a.root, { timeout: 30000 })
  } catch {
    console.log('SQLITE-WRITE-PATHS-RESULT state=undetermined new=NA base=NA face=none')
    console.log('❌ 未判定:目标根不是 git 仓库')
    return 2
  }

  let scanned
  try {
    scanned = scanFace({ root: a.root, face: a.face })
  } catch (e) {
    console.log('SQLITE-WRITE-PATHS-RESULT state=undetermined new=NA base=NA face=' + a.face)
    console.log(`❌ 未判定:${e.message}`)
    return 2
  }

  const hits = scanned.hits
  const total = [...hits.values()].reduce((s, n) => s + n, 0)

  // 豁免必须"验过才免":路径消失 ⇒ 清单腐烂 ⇒ 判红(不得静默留着一条空豁免)。
  const lapsed = [...NON_STORE_FIXTURES.keys()].filter((rel) => !scanned.listed.has(rel))
  if (lapsed.length) {
    console.log('')
    console.log('❌ 豁免清单已腐烂(这些路径在被审面不存在了,请删掉对应豁免):')
    for (const rel of lapsed) console.log('  · ' + rel)
    console.log('SQLITE-WRITE-PATHS-RESULT state=new new=' + lapsed.length + ' base=NA face=' + a.face)
    return 1
  }

  if (a.emitBaseline) {
    const files = Object.fromEntries([...hits.entries()].sort())
    console.log(JSON.stringify({ files }, null, 2))
    return 0
  }

  const baseline = readBaseline(a.root)
  if (!baseline) {
    console.log(`SQLITE-WRITE-PATHS-RESULT state=undetermined new=NA base=NA face=${a.face}`)
    console.log(`❌ 未判定:基线清单读不到(${BASELINE_REL})`)
    return 2
  }

  const { grown, fresh } = diffAgainstBaseline(hits, baseline)
  const baseCount = Object.keys(baseline.files).length

  console.log(
    `面=${a.face} · 扫源文件 ${scanned.scanned} · 命中 ${hits.size} 文件 / ${total} 处 · 基线 ${baseCount} 文件`,
  )
  for (const [rel, n] of [...hits.entries()].sort()) {
    const was = baseline.files[rel]
    const tag = was === undefined ? '清单外' : was === n ? '同比' : n > was ? `↑${was}→${n}` : `↓${was}→${n}`
    console.log(`  ${String(n).padStart(2)}  ${rel}  (${tag})`)
  }

  if (grown.length || fresh.length) {
    console.log('')
    console.log('❌ 出现 sqlite 写路径新增(数据层只允许 PostgreSQL):')
    for (const g of grown) console.log(`  · ${g.path}: ${g.baseline} → ${g.count}`)
    for (const f of fresh) console.log(`  · ${f.path}: 清单外新命中 ${f.count} 处`)
    console.log('  出口 = 改用 app.core.db_pool 的 PostgreSQL 连接,或把该调用改成只读(mode=ro)。')
    console.log(
      `SQLITE-WRITE-PATHS-RESULT state=new new=${grown.length + fresh.length} base=${baseCount} face=${a.face}`,
    )
    return 1
  }

  console.log(
    `✅ 只在基线内,无新增(${hits.size} 文件 / ${total} 处;改动只许减不许增)`,
  )
  console.log(`SQLITE-WRITE-PATHS-RESULT state=clean new=0 base=${baseCount} face=${a.face}`)
  return 0
}

// 只在被当作脚本直跑时才执行;被镜像测试 import 时不退出进程(否则测试进程被一起带走)。
const RUN_AS_SCRIPT =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (RUN_AS_SCRIPT) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
