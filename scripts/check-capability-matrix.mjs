#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/**
 * check-capability-matrix.mjs — 能力台账静态对账门(V3 #57,2026-09-26 立)
 *
 * 病理:
 *   ai-service 的 feature env(能力开关)散落在 core/services/routers 各处,
 *   app/core/capability_matrix.py 的台账登记完全靠人手维护。两型漂移无人能发现:
 *     (a) 幽灵条目 —— 台账登记的 env 在代码里已被改名/删除,台账变成小说;
 *     (b) 台账逃逸 —— 新增一个 `os.environ.get("X_XXX_ENABLED", "false")` 型
 *         默认关能力却没登记进矩阵,「生产上哪些能力是关的」再度不可知。
 *
 * 判据:
 *   J1 矩阵登记的每个 env 必须在 apps/ai-service/app/ 源码中以字符串字面量真实
 *      出现(含常量定义 `ENV_X = "..."` 形态,如 ENABLE_MCP_EXPORT)。缺失即红。
 *   J2 代码中以 `os.environ.get("X", "false"|"0"|"off")` / `os.getenv(同型)`
 *      内联字面量出现的默认关 env,必须已登记进矩阵。缺失即红。
 *
 * 取材铁律(仓库血泪教训):Python 侧一律先剥行注释再 grep —— 注释里出现的
 * 同名字符串会被裸正则误吸,造成假绿/假红(参考 check-agent-event-parity.mjs
 * 的 stripPyLineComments / check-tool-registry-integrity.mjs 的 stripLineComments,
 * 本脚本复制同一实现)。
 *
 * 已知盲区(报告为局限而非红):跨行的 os.environ.get( 调用(如 agent_loop_v2.py
 * 的 AGENT_COMPACTION_RETENTION_BUDGET_ENABLED 把参数换行)第二行的字符串不被
 * J2 的单行正则捕获 —— 该 env 已手工登记,J1 仍校验其存在。
 *
 * 用法:
 *   node scripts/check-capability-matrix.mjs             (报告模式, 漂移 exit 1;判定面=工作树磁盘)
 *   node scripts/check-capability-matrix.mjs --quiet     (无漂移时静默, 供 pre-commit)
 *   node scripts/check-capability-matrix.mjs --staged    (提交链档:判定面 = **索引 blob**)
 *   node scripts/check-capability-matrix.mjs --worktree  (显式磁盘档,人工逃生舱)
 *   node scripts/check-capability-matrix.mjs --self-test (自检, 临时夹具验证两判据都能红/绿)
 *   node scripts/check-capability-matrix.mjs --root <dir>(改取材根目录, 供夹具)
 * 接线:scripts/lib/pre-commit-hook.js(blocking,接线由主会话统一做)。
 *
 * 判定面(2026-09-28 收口,与守门 70/118 及 2i 死 key 扫描同口径):
 *   本步是**批外 blocking**,旧形态把 apps/ai-service/app 下**全部 .py** 按磁盘读 —— ai-service
 *   是并行会话最常动的面之一,任何人一个未暂存的默认关 env(还没登记进台账)都会把**无关提交**
 *   钉红,唯一出路是 --no-verify,一次绕过约等于链上全部守门对该提交作废(§12e/§12f)。
 *   `--staged` ⇒ 清单(`git ls-files -z -- apps/ai-service/app`)与内容(一次 `cat-file --batch`
 *   读满)**同面同轮**;面上取材失败 / 枚举到 0 个 .py ⇒ **exit 2「未判定」并点名原因,
 *   绝不回退磁盘、绝不记为通过**。缺省 / `--worktree` ⇒ 磁盘,既有全量行为逐字不变。
 *   退出码:0 通过 / 1 台账漂移 / 2 无法判定(未判定)。
 */

const ROOT_DEFAULT = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const selfTest = args.includes('--self-test')
const rootFlagIdx = args.indexOf('--root')
const ROOT_HAS_VALUE = rootFlagIdx >= 0 && !!args[rootFlagIdx + 1] && !args[rootFlagIdx + 1].startsWith('-')
const ROOT = ROOT_HAS_VALUE ? resolvePath(args[rootFlagIdx + 1]) : ROOT_DEFAULT
if (rootFlagIdx >= 0 && !ROOT_HAS_VALUE) {
  // --root 给了开关却没值:静默退回真仓 = 夹具扫真仓的假绿(守门 70 那一型),判死。
  console.error('❌ check-capability-matrix: --root 必须带目录值(未判定,exit 2)')
  process.exit(2)
}

/** 判定面(缺省 = 工作树磁盘,既有全量行为;--staged = 索引 blob)。 */
const FACE_PICK = selectFace({
  staged: args.includes('--staged'),
  worktree: args.includes('--worktree'),
  def: 'worktree',
})
const APP_DIR_REL = 'apps/ai-service/app'
const MATRIX_REL = `${APP_DIR_REL}/core/capability_matrix.py`

/**
 * 取材层:按判定面提供「枚举 .py」与「读一份正文」。
 * 磁盘档逐字保留旧行为(readdirSync + readFileSync);索引档一次 `ls-files` + 一次
 * `cat-file --batch` 读满 ⇒ **清单与内容同面同轮**(混面取数会产出自洽却错位的尺子,守门 118)。
 * 面上取不到 ⇒ 抛 Undetermined,由调用方折成 exit 2「未判定」,**绝不回退磁盘**。
 */
function makeLoader(root, face) {
  if (face !== 'staged') {
    return {
      face,
      listPy(dirRel) {
        return listPyFiles(join(root, dirRel)).map((abs) =>
          abs.slice(root.length + 1).replace(/\\/g, '/'),
        )
      },
      read(rel) {
        try {
          return readFileSync(join(root, rel), 'utf-8')
        } catch (e) {
          // ENOENT = 磁盘上真没有(与旧语义同:矩阵缺失时返回判据红);
          // 其它错误(编码/权限)原样抛 ⇒ 不得伪装成"文件不存在"的业务结论。
          if (e && e.code === 'ENOENT') return null
          throw e
        }
      },
    }
  }
  let cache = null
  const preload = () => {
    if (cache) return cache
    try {
      assertRepoRoot(root, '本门')
    } catch (e) {
      if (e instanceof Undetermined) throw e
      throw new Undetermined(`判定面基准不成立:${e?.message ?? e}`)
    }
    let listing
    try {
      listing = gitRaw(['ls-files', '-z', '--', dirRelOf(root)], root, { timeout: 120000 }).split('\0')
    } catch (e) {
      if (e instanceof Undetermined) throw e
      throw new Undetermined(`索引面枚举失败:${e?.message ?? e}`)
    }
    const rels = listing.filter(Boolean).filter((r) => r.endsWith('.py'))
    if (rels.length === 0)
      throw new Undetermined(`索引面在 ${APP_DIR_REL} 下枚举到 0 个 .py(空扫不记绿)`)
    let got
    try {
      got = catBatch(root, rels.map((r) => `:${r}`), { maxBuffer: 1 << 28, timeout: 180000 })
    } catch (e) {
      if (e instanceof Undetermined) throw e
      throw new Undetermined(`索引面取材失败:${e?.message ?? e}`)
    }
    const texts = new Map()
    const unreadable = []
    for (const r of rels) {
      const t = got.get(`:${r}`)
      if (typeof t === 'string') texts.set(r, t)
      else unreadable.push(r)
    }
    if (unreadable.length > 0)
      throw new Undetermined(
        `索引面有 ${unreadable.length} 个 .py 取不到正文(unmerged / 非 blob),首个:${unreadable[0]}`,
      )
    cache = { rels, texts }
    return cache
  }
  return {
    face,
    listPy() {
      return preload().rels.slice()
    },
    read(rel) {
      const t = preload().texts.get(rel)
      return typeof t === 'string' ? t : null
    },
  }
}
/** ls-files 的 pathspec:仓库根相对,正斜杠。 */
function dirRelOf() {
  return APP_DIR_REL
}

/** 默认值字面量为这些值时,视为「默认关」能力(J2 的红域)。 */
const OFF_DEFAULTS = new Set(['false', '0', 'off'])
/** 读 env 的写法。旧判据只认「内联字面量 + 带默认值」这一种,实测 235 个读取点只看得见 76 个:
 *  经模块常量(`X_ENV = "X"`)或经辅助函数(`_env_flag(X_ENV, default=False)`)的读取**整条隐身**,
 *  于是门一路报「台账全部对账一致」而替漏登的项背书。现四种形态同视。 */
const ENV_READ_RE = /os\.(?:environ\.get|getenv)\(\s*"([A-Z][A-Z0-9_]+)"\s*,\s*"([A-Za-z0-9_]+)"/g
/** `X_ENV = "ACTUAL_ENV"` —— 常量名到 env 名的映射,按文件现读,不抄第二份表。 */
const ENV_CONST_DECL_RE = /^([A-Z][A-Z0-9_]*_ENV)\s*=\s*["']([A-Z][A-Z0-9_]+)["']/gm
/** 常量形态:`os.environ.get(X_ENV)` / `os.getenv(X_ENV, "false")`。 */
const ENV_READ_CONST_RE = /os\.(?:environ\.get|getenv)\(\s*([A-Z][A-Z0-9_]*_ENV)\b\s*(?:,\s*"([A-Za-z0-9_]+)")?/g
/** 辅助函数形态:`_env_flag(X_ENV, default=False)` / `_env_flag("X", default=False)`。 */
const ENV_FLAG_RE = /_env_flag\(\s*(?:"([A-Z][A-Z0-9_]+)"|([A-Z][A-Z0-9_]*_ENV))\s*,\s*default=(True|False)/g
/** 矩阵条目的 env 字段。 */
const MATRIX_ENV_RE = /"env":\s*"([A-Z][A-Z0-9_]+)"/g

/**
 * 剥掉 Python 行注释(保留字符串内部的 `#`)。
 * 这不是洁癖:capability_matrix 与被扫描代码的注释里都会出现 env 同名串
 * (如「AGENT_COMPACTION_MODE=off,语义正确且可放量」这类说明),不剥会把
 * 注释里的词吸进集合,直接造成假绿/假红 —— 与 check-tool-registry-integrity
 * 的取材铁律同型。
 */
function stripPyLineComments(src) {
  const out = []
  for (const line of src.split('\n')) {
    let buf = ''
    let quote = null
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quote) {
        if (ch === '\\') {
          buf += ch + (line[i + 1] ?? '')
          i++
          continue
        }
        if (ch === quote) quote = null
        buf += ch
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        buf += ch
        continue
      }
      if (ch === '#') break
      buf += ch
    }
    out.push(buf)
  }
  return out.join('\n')
}

/** 递归收集 dir 下全部 .py 文件绝对路径(跳过 __pycache__)。 */
function listPyFiles(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === '__pycache__') continue
      files.push(...listPyFiles(full))
    } else if (name.endsWith('.py')) {
      files.push(full)
    }
  }
  return files
}

/** 解析矩阵登记的 env 集合。 */
export function collectMatrixEnvs(matrixSrc) {
  const envs = new Set()
  for (const m of stripPyLineComments(matrixSrc).matchAll(MATRIX_ENV_RE)) envs.add(m[1])
  return envs
}

/**
 * 对账主流程。
 * @param {string} root 仓库根(或夹具根)
 * @param {{face?:string}} [opts] 判定面;缺省 `worktree` = 磁盘(自检与 CI 全量档走这档)。
 *   `staged` 走索引 blob —— **清单与内容同面同轮**;面上取不到一律抛 Undetermined,
 *   由调用方折成 exit 2「未判定」,绝不回退磁盘。
 * @returns {{errors: string[], stats: Record<string, number>}}
 */
export function runCheck(root, opts = {}) {
  const face = opts.face || 'worktree'
  const loader = makeLoader(root, face)
  // MATRIX_FILE 常量已删(eslint no-unused-vars):--root 夹具场景下 root 是参数
  // 不是模块级 ROOT,路径必须就地重拼,常量反成误导
  const errors = []
  const stats = { face: face === 'staged' ? 1 : 0 }

  let matrixSrc
  try {
    matrixSrc = loader.read(MATRIX_REL)
  } catch (e) {
    if (e instanceof Undetermined) throw e
    matrixSrc = null
  }
  if (matrixSrc === null || matrixSrc === undefined) {
    return {
      errors: [
        `${MATRIX_REL} 缺失(判定面:${face === 'staged' ? '索引 blob' : '工作树磁盘'}): 能力台账单一事实源被移动/删除, 请同步本守门`,
      ],
      stats,
    }
  }
  const matrixEnvs = collectMatrixEnvs(matrixSrc)
  stats.matrixEnvs = matrixEnvs.size

  // 取材语料:除矩阵文件本身(登记动作当然会写出 env 名,不算"代码里存在"的证据)。
  const pyRels = loader.listPy(APP_DIR_REL).filter((r) => r !== MATRIX_REL)
  let corpus = ''
  const defaultOff = new Map() // env -> 首个出现文件(相对路径, 供报错定位)
  const anyRead = new Set() // 四种形态合起来「代码真读了」的 env 名,用于诚实报账
  for (const rel of pyRels) {
    const raw = loader.read(rel)
    if (raw === null || raw === undefined) continue // 面上没有这份正文(枚举已保证在,保守跳过)
    const text = stripPyLineComments(raw)
    corpus += text + '\n'
    const consts = new Map()
    for (const m of text.matchAll(ENV_CONST_DECL_RE)) consts.set(m[1], m[2])
    const noteOff = (env) => {
      if (!defaultOff.has(env)) defaultOff.set(env, rel)
    }
    for (const m of text.matchAll(ENV_READ_RE)) {
      anyRead.add(m[1])
      if (OFF_DEFAULTS.has(m[2])) noteOff(m[1])
    }
    for (const m of text.matchAll(ENV_READ_CONST_RE)) {
      const env = consts.get(m[1])
      if (!env) continue
      anyRead.add(env)
      if (m[2] !== undefined && OFF_DEFAULTS.has(m[2])) noteOff(env)
    }
    for (const m of text.matchAll(ENV_FLAG_RE)) {
      const env = m[1] ?? consts.get(m[2])
      if (!env) continue
      anyRead.add(env)
      if (m[3] === 'False') noteOff(env)
    }
  }
  stats.scannedFiles = pyRels.length
  stats.defaultOffEnvs = defaultOff.size
  // 台账外但**不属 J2 红域**的读取点(阈值/URL/密钥路径等非默认关项):原样报数不判红。
  // 报出来的理由是「放过」与「没看见」在账面上必须不同形 —— 本门此前就是后者。
  stats.envNamesRead = anyRead.size
  stats.undocumentedNotOff = [...anyRead].filter((e) => !matrixEnvs.has(e)).length

  // J1: 幽灵条目 —— 矩阵登记的 env 必须在源码里真实存在。
  for (const env of [...matrixEnvs].sort()) {
    if (!corpus.includes(`"${env}"`) && !corpus.includes(`'${env}'`)) {
      errors.push(`[J1 幽灵条目] 台账登记的 env "${env}" 在 apps/ai-service/app/ 源码中不存在(被改名/删除?), 请同步 capability_matrix.py`)
    }
  }

  // J2: 台账逃逸 —— 代码里新增的默认关 env 必须登记进矩阵。
  for (const [env, file] of [...defaultOff.entries()].sort()) {
    if (!matrixEnvs.has(env)) {
      errors.push(`[J2 台账逃逸] 默认关 env "${env}"(${file})未登记进 capability_matrix.py, 生产能力状态再度不可知`)
    }
  }

  return { errors, stats }
}

function main() {
  if (selfTest) {
    process.exit(selfTestRun())
  }
  if (FACE_PICK.error) {
    console.error(`❌ check-capability-matrix: 无法判定(exit 2,未判定)—— ${FACE_PICK.error}`)
    process.exit(2)
  }
  const face = FACE_PICK.face
  let checked
  try {
    checked = runCheck(ROOT, { face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(
        `❌ check-capability-matrix: 无法判定(exit 2,未判定)—— 索引面取材失败,**不回退磁盘**:${e.message}`,
      )
      console.error('   未判定 ≠ 通过:这次没判成,不是"台账一致"。')
      process.exit(2)
    }
    throw e
  }
  const { errors, stats } = checked
  if (errors.length > 0) {
    console.error(
      `❌ check-capability-matrix: 能力台账对账失败(${errors.length} 条;判定面:${face === 'staged' ? '索引 blob' : '工作树磁盘'}):`,
    )
    for (const e of errors) console.error(`   ${e}`)
    process.exit(1)
  }
  if (!quiet) {
    console.log(
      `✅ check-capability-matrix: 台账 ${stats.matrixEnvs} 条 / 扫描 ${stats.scannedFiles} 个 py 文件 / ` +
        `代码可读到的 env 名 ${stats.envNamesRead} 个,其中可判「默认关」${stats.defaultOffEnvs} 个已全部登记; ` +
        `台账外且非默认关 ${stats.undocumentedNotOff} 个(阈值/URL/密钥路径等,按设计不属 J2 红域,只报数不判红)`,
    )
  }
  // 判定面**总是**印(不受 --quiet 影响):提交链的绿必须能读出它判的是哪一份。
  console.log(
    `   判定面:${face === 'staged' ? '索引 blob(本次提交真正会带走的那一份)' : '工作树磁盘'}`,
  )
  process.exit(0)
}

/** --self-test: 用临时夹具验证 J1/J2 都能红、修正后能绿。返回 exit code。 */
function selfTestRun() {
  const dir = mkScratch('ihui-cap-matrix-selftest-')
  try {
    const coreDir = join(dir, 'apps/ai-service/app/core')
    mkdirSync(coreDir, { recursive: true })

    const matrixSrc = (envs) =>
      `CAPABILITY_MATRIX = [\n${envs.map((e) => `    {"key": "${e.toLowerCase()}", "env": "${e}", "default": "false", "category": "开关类", "owner_module": "m", "doc_ref": "d", "reason_if_off": ""},\n`).join('')}]\n`
    // 夹具代码:两个默认关 env,其中 MISSING_ENABLED 故意不登记;GHOST_ENABLED 是矩阵幽灵
    const fixtureCode =
      `import os\n` +
      `# 注释陷阱: os.environ.get("FIXTURE_COMMENT_ENABLED", "false") 出现在注释里, 不许被吸\n` +
      `A = os.environ.get("FIXTURE_MISSING_ENABLED", "false")\n` +
      `B = os.environ.get("FIXTURE_REAL_ENABLED", "false")\n` +
      // 下面两行是本门旧判据的结构盲区:env 名经模块常量、以及经 `_env_flag` 辅助函数读取,
      // 形态上没有内联字面量 ⇒ 旧正则一条都吸不到,而门照报"全部对账一致"。
      `FIXTURE_CONST_ENV = "FIXTURE_CONST_ENABLED"\n` +
      `C = os.environ.get(FIXTURE_CONST_ENV, "false")\n` +
      `FIXTURE_FLAG_ENV = "FIXTURE_FLAG_ENABLED"\n` +
      `D = _env_flag(FIXTURE_FLAG_ENV, default=False)\n`

    const ALL_FOUR = ['FIXTURE_MISSING_ENABLED', 'FIXTURE_REAL_ENABLED', 'FIXTURE_CONST_ENABLED', 'FIXTURE_FLAG_ENABLED']

    const run = (envs) => {
      writeFileSync(join(coreDir, 'capability_matrix.py'), matrixSrc(envs))
      writeFileSync(join(coreDir, 'fixture.py'), fixtureCode)
      return runCheck(dir)
    }

    // 场景 1(应绿): 四个真实 env 都登记 → 无错误, 且注释里的 env 未被误吸。
    {
      const { errors } = run(ALL_FOUR)
      const commentLeak = errors.some((e) => e.includes('FIXTURE_COMMENT_ENABLED'))
      if (errors.length !== 0 || commentLeak) {
        console.error(`❌ self-test 绿场景失败: 期望 0 错误, 实得 ${errors.length}${commentLeak ? '(注释被误吸!)' : ''}:`, errors)
        return 1
      }
    }
    // 场景 1b(应红,放宽判据的阳性对照): 只登记内联字面量那两个 ⇒ 经常量与经 `_env_flag`
    // 读的两个必须被抓出来。少这一条,「放宽形态」就等于只写在注释里。
    {
      const { errors } = run(['FIXTURE_MISSING_ENABLED', 'FIXTURE_REAL_ENABLED'])
      for (const need of ['FIXTURE_CONST_ENABLED', 'FIXTURE_FLAG_ENABLED']) {
        if (!errors.some((e) => e.includes('J2') && e.includes(need))) {
          console.error(`❌ self-test 场景 1b 失败: 未检出台账逃逸 ${need}(该形态仍是盲区)`, errors)
          return 1
        }
      }
    }
    // 场景 2(应红): 少登记 MISSING → J2 台账逃逸。
    {
      const { errors } = run(['FIXTURE_REAL_ENABLED'])
      if (!errors.some((e) => e.includes('J2') && e.includes('FIXTURE_MISSING_ENABLED'))) {
        console.error('❌ self-test 红场景(J2)失败: 未检出台账逃逸:', errors)
        return 1
      }
    }
    // 场景 3(应红): 登记 GHOST → J1 幽灵条目。
    {
      const { errors } = run(['FIXTURE_MISSING_ENABLED', 'FIXTURE_REAL_ENABLED', 'FIXTURE_GHOST_ENABLED'])
      if (!errors.some((e) => e.includes('J1') && e.includes('FIXTURE_GHOST_ENABLED'))) {
        console.error('❌ self-test 红场景(J1)失败: 未检出幽灵条目:', errors)
        return 1
      }
    }
    if (!quiet) console.log('✅ check-capability-matrix self-test: J1/J2 红 + 绿场景全部咬合, 注释剥离生效')
    return 0
  } finally {
    rmScratch(dir)
  }
}

// §22d 双形态入口守护:`runCheck` / `collectMatrixEnvs` 已 export 给镜像测试直接 import,
// 而 main() 顶层就取材并 process.exit —— 不加守护时 import 一次等于把整道门跑完,
// 测试退出码由真仓当下状态决定(于是"跟着仓库颜色走"的复读机,§22c 那一型)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
