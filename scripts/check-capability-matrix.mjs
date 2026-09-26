#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 *   node scripts/check-capability-matrix.mjs             (报告模式, 漂移 exit 1)
 *   node scripts/check-capability-matrix.mjs --quiet     (无漂移时静默, 供 pre-commit)
 *   node scripts/check-capability-matrix.mjs --self-test (自检, 临时夹具验证两判据都能红/绿)
 *   node scripts/check-capability-matrix.mjs --root <dir>(改取材根目录, 供夹具)
 * 接线:scripts/lib/pre-commit-hook.js(blocking,接线由主会话统一做)。
 */

const ROOT_DEFAULT = join(fileURLToPath(import.meta.url), '..', '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const selfTest = args.includes('--self-test')
const rootFlagIdx = args.indexOf('--root')
const ROOT = rootFlagIdx >= 0 && args[rootFlagIdx + 1] ? resolvePath(args[rootFlagIdx + 1]) : ROOT_DEFAULT

/** 默认值字面量为这些值时,视为「默认关」能力(J2 的红域)。 */
const OFF_DEFAULTS = new Set(['false', '0', 'off'])
/** 读 env 的两种 Python 写法(单行内联字面量形态)。 */
const ENV_READ_RE = /os\.(?:environ\.get|getenv)\(\s*"([A-Z][A-Z0-9_]+)"\s*,\s*"([A-Za-z0-9_]+)"/g
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
 * 对账主流程。@returns {{errors: string[], stats: Record<string, number>}}
 */
export function runCheck(root) {
  const appDir = join(root, 'apps/ai-service/app')
  // MATRIX_FILE 常量已删(eslint no-unused-vars):--root 夹具场景下 root 是参数
  // 不是模块级 ROOT,路径必须就地重拼,常量反成误导
  const matrixFile = join(appDir, 'core/capability_matrix.py')
  const errors = []
  const stats = {}

  let matrixSrc
  try {
    matrixSrc = readFileSync(matrixFile, 'utf-8')
  } catch {
    return { errors: [`apps/ai-service/app/core/capability_matrix.py 缺失: 能力台账单一事实源被移动/删除, 请同步本守门`], stats }
  }
  const matrixEnvs = collectMatrixEnvs(matrixSrc)
  stats.matrixEnvs = matrixEnvs.size

  // 取材语料:除矩阵文件本身(登记动作当然会写出 env 名,不算"代码里存在"的证据)。
  const pyFiles = listPyFiles(appDir).filter((f) => f !== matrixFile)
  let corpus = ''
  const defaultOff = new Map() // env -> 首个出现文件(相对路径, 供报错定位)
  for (const f of pyFiles) {
    const text = stripPyLineComments(readFileSync(f, 'utf-8'))
    corpus += text + '\n'
    for (const m of text.matchAll(ENV_READ_RE)) {
      if (OFF_DEFAULTS.has(m[2]) && !defaultOff.has(m[1])) {
        defaultOff.set(m[1], f.slice(root.length + 1))
      }
    }
  }
  stats.scannedFiles = pyFiles.length
  stats.defaultOffEnvs = defaultOff.size

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
  const { errors, stats } = runCheck(ROOT)
  if (errors.length > 0) {
    console.error(`❌ check-capability-matrix: 能力台账对账失败(${errors.length} 条):`)
    for (const e of errors) console.error(`   ${e}`)
    process.exit(1)
  }
  if (!quiet) {
    console.log(
      `✅ check-capability-matrix: 台账 ${stats.matrixEnvs} 条 / 扫描 ${stats.scannedFiles} 个 py 文件 / 代码默认关 env ${stats.defaultOffEnvs} 个, 全部对账一致`,
    )
  }
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
      `B = os.environ.get("FIXTURE_REAL_ENABLED", "false")\n`

    const run = (envs) => {
      writeFileSync(join(coreDir, 'capability_matrix.py'), matrixSrc(envs))
      writeFileSync(join(coreDir, 'fixture.py'), fixtureCode)
      return runCheck(dir)
    }

    // 场景 1(应绿): 两个真实 env 都登记 → 无错误, 且注释里的 env 未被误吸。
    {
      const { errors } = run(['FIXTURE_MISSING_ENABLED', 'FIXTURE_REAL_ENABLED'])
      const commentLeak = errors.some((e) => e.includes('FIXTURE_COMMENT_ENABLED'))
      if (errors.length !== 0 || commentLeak) {
        console.error(`❌ self-test 绿场景失败: 期望 0 错误, 实得 ${errors.length}${commentLeak ? '(注释被误吸!)' : ''}:`, errors)
        return 1
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

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
