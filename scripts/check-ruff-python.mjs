#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * ruff 守门(2026-10-27 立):把 Python lint 从"只挂 CI"接进提交链。
 *
 * 立因:ruff 此前只在 CI 跑,`chore(auto)` 收编能把 Python 欠账直带进 HEAD,提交链上无人拦。
 * 前置(存量归零)已现读满足:apps/ai-service 全量 `ruff check .` = All checks passed!。
 *
 * 判定面(与 check-mypy.mjs 同口径):默认判 HEAD 面;`--staged` 判索引面;`--worktree` 判磁盘
 * (仅人工逃生舱);两面旗同给 ⇒ exit 2。ruff 是外部工具只看得见磁盘,故面内容先经 face-reader
 * 取材,再物化到 scratch-dir 的临时目录里跑 —— 邻居未提交的在飞文件不参与判定。
 *
 * 版本 pin 唯一源 = apps/ai-service/pyproject.toml 的 `ruff==x.y.z`(现读 0.16.6),脚本解析取值,
 * 不硬编码(§0.6)。
 *
 * 退出码:0 无违规 / 1 有违规(逐条打印 ruff 输出)/ 2 未判定(uvx 缺失、pin 解析失败、被审面
 * 取不到、ruff 自身 rc∉{0,1})。未判定优先于红:任一维没量到就不出结论。
 * 出网退路(2026-10-28 本机实测补):uvx 走 reqwest 的 Windows 系统代理解析,节点挂时对 pypi 报
 * `tls handshake eof`(rc=2),而 `ruff==<pin>` 常常已在 uv 本地缓存里 ⇒ 那只说明"这一条腿没通",
 * 不说明"判不了"。故出网形状的失败后按同一 pin、同一参数补跑一次 `uvx --offline`:缓存腿给出
 * 结论即采用它(报告里点名两腿),两腿都不通仍落 exit 2。**非网络形状的 rc=2(规则名写错、配置坏)
 * 一律不重跑** —— 给真故障开重跑等于把它洗成偶发重试。
 *
 * 紧急跳过:HUSKY_SKIP_RUFF=1 git commit ...
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** ROOT 由脚本自身位置推导(AGENTS §15):共享工作区里 cwd 不可靠,判定面不得随站位漂。 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AI_REL = 'apps/ai-service'
const AI_PREFIX = 'apps/ai-service/'
const PYPROJECT_REL = `${AI_PREFIX}pyproject.toml`
const GIT_TIMEOUT = 120000
const BATCH_TIMEOUT = 240000
/** 全量实跑实测 ~1.5s(1492 个 .py);环境变量只用于放宽,不用于关掉判定。 */
const RUFF_TIMEOUT = Number(process.env.IHUI_RUFF_GATE_TIMEOUT_MS || 600000)
/**
 * `--no-respect-gitignore`:判定面已由 `git ls-tree` / `git ls-files` 枚举(跟踪面 = gitignore 的上游),
 * 再让 ruff 按**scratch 落点**祖先目录的 .gitignore 过滤一遍,会把整面静默滤空(本仓 `.DevEnv/` 被忽略)
 * ⇒ 一派"All checks passed"的假绿。所以物化面这一层必须关掉它。
 */
const RUFF_ARGS = ['check', '.', '--no-cache', '--no-respect-gitignore']

// === 颜色(对齐 guardian-runner.mjs 的 C 对象) ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ===========================================================================
// 纯判据(§22c:导出给镜像测试,测试里不得再抄一份)
// ===========================================================================

/**
 * ruff 版本 pin 解析 —— 唯一源是 pyproject.toml 里 `"ruff==x.y.z"` 这条依赖行。
 * 只认"行首(可带空白)+ 引号 + ruff=="的依赖串:注释里的 `# ruff==0.1.0`、`[tool.ruff]` 段名都不算。
 * 多个不同版本 = 无法确定唯一 pin ⇒ 未判定(不猜)。
 */
export function parseRuffPin(text) {
  const src = typeof text === 'string' ? text : ''
  if (!src.trim()) return { ok: false, reason: 'pyproject.toml 内容为空' }
  const hits = []
  src.split(/\r?\n/).forEach((line, i) => {
    const m = /^\s*["']ruff==([0-9][0-9A-Za-z.+!-]*)["']/.exec(line)
    if (m) hits.push({ version: m[1], line: i + 1 })
  })
  if (hits.length === 0) {
    return { ok: false, reason: '未找到 `ruff==x.y.z` 形式的依赖行(注释/段名里的同形字符串不算)' }
  }
  const versions = [...new Set(hits.map((h) => h.version))]
  if (versions.length > 1) {
    return {
      ok: false,
      reason: `同名依赖出现 ${versions.length} 个不同版本(${versions.join(' / ')}),pin 不唯一`,
    }
  }
  return { ok: true, version: versions[0], pinLine: hits[0].line, hits: hits.length }
}

/** uvx 的包规格串(与 pin 同源,全仓只有这一个拼法)。 */
export function ruffSpecFor(version) {
  return typeof version === 'string' && version.trim() ? `ruff==${version.trim()}` : null
}

/** 哪些路径进物化集合:Python 源 + ruff 配置源。少物化一个 = 给判定面发假合格证。 */
export function isRuffMaterializable(rel) {
  if (typeof rel !== 'string' || !rel.startsWith(AI_PREFIX)) return false
  if (rel === PYPROJECT_REL) return true
  if (rel === `${AI_PREFIX}ruff.toml` || rel === `${AI_PREFIX}.ruff.toml`) return true
  return /\.(py|pyi|ipynb)$/.test(rel)
}

export function pickRuffPaths(paths) {
  return (Array.isArray(paths) ? paths : []).filter(isRuffMaterializable)
}

/** 面上的 blob 规格前缀:索引面 `:path`、HEAD 面 `HEAD:path`(与守门 105/118 同一条写法)。 */
export function faceSpecPrefix(face) {
  if (face === 'staged') return ':'
  if (face === 'head') return 'HEAD:'
  return null
}

/** 面选择走共用层单源(selectFace),本门只负责把 argv 折成它的入参。 */
export function resolveFace(argvList = []) {
  const args = Array.isArray(argvList) ? argvList : []
  return selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
    def: 'head',
  })
}

/**
 * ruff 退出码分流(纯函数)。
 * rc=1 但 stdout 空 = 没有可打印的违规条目 ⇒ 无证据,不得当红(未判定优先于红)。
 * spawn 自身失败(ENOENT 等)不是 lint 结论。
 */
export function classifyRuffOutcome({
  status,
  signal = null,
  stdout = '',
  error = null,
} = {}) {
  if (error) return error.code === 'ENOENT' ? 'tool-missing' : 'tool-error'
  if (signal) return 'killed'
  if (status === null || status === undefined) return 'killed'
  if (status === 0) return 'pass'
  if (status === 1) return String(stdout || '').trim() ? 'violations' : 'violations-silent'
  return 'broken'
}

/** 唯一退出码映射:0 无违规 / 1 有违规 / 2 其余全部未判定。 */
export function exitCodeFor(kind) {
  if (kind === 'pass') return 0
  if (kind === 'violations') return 1
  return 2
}

/** 未判定那一档的定向说明(每一档都要说清"为什么没有结论")。 */
export function undeterminedReason(ruffKind, { exe, status, signal, error } = {}) {
  if (ruffKind === 'tool-missing')
    return `uvx 不在 PATH(${exe} ⇒ ENOENT)—— 本机无工具可跑,不判红也不记绿`
  if (ruffKind === 'tool-error')
    return `uvx 执行异常(${error?.code || error?.message})—— 不是 lint 结论`
  if (ruffKind === 'killed') return `ruff 被 ${signal || `rc=${status}`} 终止 —— 没有结论`
  if (ruffKind === 'violations-silent')
    return 'ruff 以 rc=1 退出但无逐条输出 —— 无证据可打印,不判红'
  return `ruff 以 rc=${status} 退出 —— 工具自身故障/配置错误,不构成 lint 结论`
}

/** 面标签(每一行结论都要带上它,免得读报告的人把某一面当成仓库事实)。 */
export function faceLabelOf(face) {
  if (face === 'staged') return '索引 blob(物化后判定)'
  if (face === 'head') return 'HEAD blob(物化后判定)'
  return '工作树磁盘(人工逃生舱,不得作为提交门禁)'
}

// ===========================================================================
// 取材 / 物化 / 执行
// ===========================================================================

/**
 * `--staged` 档的入场判定(纯函数):索引面没有 ai-service 的 .py 改动 ⇒ 本档 exit 0 并明说"无相关暂存";
 * 清单形态不可用 ⇒ 未判定(不回落成"无改动")。
 */
export function planStaged(changes) {
  if (!Array.isArray(changes)) {
    return { skip: false, code: 2, changes: [], reason: '改动清单形态不可用' }
  }
  const list = changes.filter((f) => typeof f === 'string' && f.endsWith('.py'))
  if (list.length === 0) return { skip: true, code: 0, changes: [], reason: '本档无相关暂存' }
  return { skip: false, code: null, changes: list, reason: null }
}

/** 索引面上够得着本门的改动清单;取不到 ⇒ Undetermined(不回落成"无改动")。 */
export function stagedPythonChanges(root) {
  let listed
  try {
    listed = gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', AI_REL],
      root,
      { timeout: GIT_TIMEOUT },
    )
  } catch (e) {
    throw new Undetermined(`取不到索引面的改动清单(${e?.message ?? e})`)
  }
  return listed
    .split('\0')
    .filter(Boolean)
    .filter((f) => f.endsWith('.py'))
}

/**
 * 把一个面物化成临时目录里的 `apps/ai-service/...`。
 * 内容只来自 catBatch(取材层),枚举与内容同面同轮 —— 混着取会产出自洽却错位的尺子。
 */
export function materializeFace(root, face, paths) {
  const prefix = faceSpecPrefix(face)
  if (!prefix) throw new Undetermined(`面 ${face} 不经物化通道(worktree 走磁盘)`)
  const map = catBatch(
    root,
    paths.map((p) => `${prefix}${p}`),
    {
      timeout: BATCH_TIMEOUT,
      maxBuffer: 1 << 29,
    },
  )
  const dir = mkScratch(`check-ruff-${face}-`)
  const missing = []
  try {
    for (const rel of paths) {
      const text = map.get(`${prefix}${rel}`)
      if (typeof text !== 'string') {
        missing.push(rel)
        continue
      }
      const abs = join(dir, ...rel.split('/'))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
  } catch (e) {
    rmScratch(dir, { bestEffort: true })
    throw e
  }
  return { dir, written: paths.length - missing.length, missing }
}

/** uvx 位置:默认走 PATH 的名称;`IHUI_RUFF_GATE_UVX` 是换机/夹具的显式出口(不是跳门)。 */
export function resolveUvx(env = process.env) {
  const override = String(env.IHUI_RUFF_GATE_UVX || '').trim()
  return override || 'uvx'
}

function spawnUvx(exe, args, cwd, timeout) {
  return spawnSync(exe, args, {
    cwd,
    encoding: 'utf8',
    // Python/Rust 系子进程在 Windows 上默认按 ANSI 码页写管道;输出会进结论,故钉死 UTF-8 与无色。
    env: { ...process.env, NO_COLOR: '1', UV_NO_PROGRESS: '1' },
    // .cmd/.bat 必须经 shell 才起得来;裸名 uvx 由 PATH 解析(本机是 uvx.exe),shell:false 更稳。
    shell: /\.(cmd|bat)$/i.test(String(exe)),
    windowsHide: true, // AGENTS §5b:缺它必弹可见 cmd 窗口
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 出网腿失败的形状(ruff 已在 uv 本地缓存里时,这一型本不该变成"没结论")。
 * 只认传输层措辞,不认 rc=2 那类配置/规则错误 —— 后者换腿重跑也是同样答案,给它开重跑等于掩盖真故障。
 */
export const EGRESS_FAILURE_RE =
  /failed to fetch|error sending request|tls handshake|connection refused|could not resolve|dns error/i

/** 这条结果是不是"网络没够着"(而非 lint 结论 / 工具自身故障)。 */
export function isEgressFailure(r) {
  if (!r || r.error) return false
  if (r.status === 0 || r.status === 1) return false // rc0=通过、rc1=有违规,都是 lint 结论
  return EGRESS_FAILURE_RE.test(`${r.stderr || ''}\n${r.stdout || ''}`)
}

/** 在**物化出来的判定面**里跑 `uvx ruff==<pin> check .`。 */
export function runRuff({ dir, uvx, spec, timeout = RUFF_TIMEOUT, spawn = spawnUvx }) {
  const first = spawn(uvx, [spec, ...RUFF_ARGS], dir, timeout)
  if (!isEgressFailure(first)) return first
  // 出网腿挂了 ⇒ 用 uv 的本地缓存再问一次(同一 pin、同一参数,覆盖面只增不减)。
  // 两腿都不通就回吐**第一手**错误(离线腿的"缓存里没有"往往比原始故障更难读)。
  const second = spawn(uvx, ['--offline', spec, ...RUFF_ARGS], dir, timeout)
  const firstDetail = `rc=${first.status ?? first.error?.code ?? 'null'}`
  if (second.error || isEgressFailure(second) || (second.status !== 0 && second.status !== 1)) {
    return { ...second, egress: { used: false, firstDetail } }
  }
  return { ...second, egress: { used: true, firstDetail } }
}

/** uvx 可执行性探测(自检用来区分"红绿两向演示不了"与"判据坏了")。 */
export function probeUvx(exe, timeout = 120000) {
  const r = spawnUvx(exe, ['--version'], ROOT, timeout)
  if (r.error) return { ok: false, detail: r.error.code || r.error.message }
  if (r.status !== 0) {
    return {
      ok: false,
      detail: `rc=${r.status} ${String(r.stderr || '')
        .trim()
        .slice(0, 120)}`,
    }
  }
  return { ok: true, detail: String(r.stdout || '').trim() }
}

function readFaceText(root, face, rel, materialized) {
  if (face === 'worktree') {
    const text = readWorktreeFile(root, rel)
    if (text === null) throw new Undetermined(`${rel} 在工作树上不存在`)
    return text
  }
  try {
    return readFileSync(join(materialized.dir, ...rel.split('/')), 'utf8')
  } catch (e) {
    throw new Undetermined(`物化面取不到 ${rel}:${e?.message ?? e}`)
  }
}

function countUntrackedPython(root) {
  try {
    const out = gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', AI_REL], root, {
      timeout: GIT_TIMEOUT,
    })
    return out.split('\0').filter((p) => p.endsWith('.py')).length
  } catch {
    return null
  }
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
}

// ===========================================================================
// 判定一条面:唯一出口(自检、镜像测试、CLI 都走它)
// ===========================================================================

export function judgeFace({ root, face, uvx = null, timeout = RUFF_TIMEOUT } = {}) {
  const lines = []
  let materialized = null
  const fail = (reason, detail = null) => {
    lines.push(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${reason}${C.reset}`)
    for (const d of (detail || []).slice(0, 10)) lines.push(`${C.dim}   - ${d}${C.reset}`)
    return {
      code: 2,
      kind: 'undetermined',
      face,
      reason,
      lines,
      pyCount: null,
      pin: null,
      output: '',
    }
  }
  try {
    if (!root) return fail('缺少仓库根(root)')
    assertRepoRoot(root, 'ruff 守门')
    const paths = pickRuffPaths(
      listFaceFiles(root, face, { paths: [AI_REL], timeout: GIT_TIMEOUT }),
    )
    const pyCount = paths.filter((p) => p.endsWith('.py')).length
    if (pyCount === 0) {
      return fail(`${face} 面在 ${AI_REL}/ 下枚举到 0 个 .py —— 枚举到 0 判死,不出具合格证`)
    }
    if (!paths.includes(PYPROJECT_REL)) {
      return fail(`${face} 面上没有 ${PYPROJECT_REL} —— ruff 配置与版本 pin 都无来源`)
    }
    let runDir
    if (face === 'worktree') {
      runDir = join(root, 'apps', 'ai-service')
      const untracked = countUntrackedPython(root)
      if (untracked === null) {
        lines.push(`${C.yellow}   ⚠️ 未跟踪 .py 清点取不到(不影响本档结论,仅现场提示)${C.reset}`)
      } else if (untracked > 0) {
        lines.push(
          `${C.yellow}   ⚠️ 本档判磁盘:工作树另有 ${untracked} 个未跟踪 .py 参与判定,该形态不属于任何一面被审内容${C.reset}`,
        )
      }
    } else {
      materialized = materializeFace(root, face, paths)
      if (materialized.missing.length > 0) {
        return fail(
          `${face} 面有 ${materialized.missing.length} 个文件取不到内容,判定面不完整`,
          materialized.missing,
        )
      }
      runDir = join(materialized.dir, 'apps', 'ai-service')
      lines.push(
        `${C.dim}   物化 ${materialized.written} 个文件到临时判定面(.py = ${pyCount})${C.reset}`,
      )
    }
    // pin 从被审面自己的 pyproject 取(同面同轮),不接受磁盘/另一面的版本
    const pin = parseRuffPin(readFaceText(root, face, PYPROJECT_REL, materialized))
    if (!pin.ok) return fail(`ruff 版本 pin 解析失败(${PYPROJECT_REL}):${pin.reason}`)
    const exe = uvx || resolveUvx()
    const spec = ruffSpecFor(pin.version)
    const started = Date.now()
    const r = runRuff({ dir: runDir, uvx: exe, spec, timeout })
    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    const output = `${r.stdout || ''}\n${r.stderr || ''}`.trim()
    const ruffKind = classifyRuffOutcome(r)
    const code = exitCodeFor(ruffKind)
    if (r.egress) {
      lines.push(
        `${C.dim}   ↳ 出网腿失败(${r.egress.firstDetail})⇒ 已用 uv 本地缓存重跑 uvx --offline ${spec}` +
          `${r.egress.used ? ' 并给出结论' : '(缓存腿也不通 ⇒ 仍未判定)'}${C.reset}`,
      )
    }

    if (code === 0) {
      if (output) lines.push(`${C.dim}${output}${C.reset}`)
      lines.push(
        `${C.green}${C.bold}✅ ruff 守门通过(0 violations, ${spec}, ${elapsed}s)${C.reset}`,
      )
      lines.push(
        `${C.dim}   判定面=${faceLabelOf(face)};.py ${pyCount} 个;命令 uvx ${spec} check .${C.reset}`,
      )
      return { code: 0, kind: 'pass', face, reason: null, lines, pyCount, pin, output }
    }
    if (code === 1) {
      lines.push(
        `${C.red}${C.bold}❌ ruff 守门失败:${faceLabelOf(face)} 有违规(${elapsed}s)${C.reset}`,
      )
      lines.push(`${C.dim}--- ruff 输出 ---${C.reset}`)
      lines.push(...splitLines(output).slice(-150))
      lines.push(`${C.dim}--- end ---${C.reset}`)
      lines.push('')
      lines.push(`${C.bold}修复方法:${C.reset}`)
      lines.push(
        `  1. 复现本门的判定面: ${C.cyan}node scripts/check-ruff-python.mjs${face === 'staged' ? ' --staged' : ''}${C.reset}`,
      )
      lines.push(
        `  2. 机械项可先自动修: ${C.cyan}cd apps/ai-service && uvx ${spec} check --fix .${C.reset}`,
      )
      lines.push(
        '  3. 规则档位唯一源 = apps/ai-service/pyproject.toml [tool.ruff.lint](本门不放宽)',
      )
      lines.push(`${C.dim}紧急跳过(不推荐): HUSKY_SKIP_RUFF=1 git commit ...${C.reset}`)
      return {
        code: 1,
        kind: 'violations',
        face,
        reason: 'ruff 判出违规',
        lines,
        pyCount,
        pin,
        output,
      }
    }
    const reason = undeterminedReason(ruffKind, {
      exe,
      status: r.status,
      signal: r.signal,
      error: r.error,
    })
    lines.push(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${reason}${C.reset}`)
    if (output) {
      lines.push(`${C.dim}--- uvx/ruff 输出 ---${C.reset}`)
      lines.push(...splitLines(output).slice(-60))
      lines.push(`${C.dim}--- end ---${C.reset}`)
    }
    return { code: 2, kind: 'undetermined', ruffKind, face, reason, lines, pyCount, pin, output }
  } catch (e) {
    const reason = e instanceof Undetermined ? e.message : (e?.message ?? String(e))
    lines.push(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${reason}${C.reset}`)
    lines.push(
      `${C.dim}   "判不出"不是"通过",也不是"仓库有 lint 债" —— 先修取材链路,或应急 HUSKY_SKIP_RUFF=1。${C.reset}`,
    )
    return {
      code: 2,
      kind: 'undetermined',
      face,
      reason,
      lines,
      pyCount: null,
      pin: null,
      output: '',
    }
  } finally {
    if (materialized?.dir) rmScratch(materialized.dir, { bestEffort: true })
  }
}

// ===========================================================================
// 自检
// ===========================================================================

const FIXTURE_GIT_ID = [
  '-c',
  'user.email=ruff-gate@test.local',
  '-c',
  'user.name=ruff-gate',
  '-c',
  'commit.gpgsign=false',
]

function gitRun(cwd, args) {
  // §12g 的 stdio 两态由层写死(不带 input ⇒ ignore),不再各自抄一遍。
  return gitRaw(args, cwd, { timeout: 120000 })
}

function fixtureWrite(dir, rel, text) {
  const abs = join(dir, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function fixtureCommit(dir, message) {
  gitRun(dir, [...FIXTURE_GIT_ID, 'add', '-A', '--', '.'])
  gitRun(dir, [...FIXTURE_GIT_ID, 'commit', '-q', '--no-verify', '-m', message])
}

function fixturePyproject(pinVersion) {
  return [
    '[project]',
    'name = "ruff-gate-fixture"',
    'version = "0.0.0"',
    'requires-python = ">=3.12"',
    'dependencies = []',
    '',
    '[project.optional-dependencies]',
    'dev = [',
    `    "ruff==${pinVersion}",`,
    ']',
    '',
    '[tool.ruff]',
    'line-length = 100',
    '',
  ].join('\n')
}

function finishSelfTest(cases, probe) {
  const failed = cases.filter((c) => !c.ok).length
  const pass = cases.length - failed
  let state = failed === 0 ? 'pass' : 'fail'
  let code = failed === 0 ? 0 : 1
  if (failed === 0 && !probe.ok) {
    // 红绿两向演示不出来 ⇒ 自检本身未判定,绝不冒绿(§0.3)
    state = 'undetermined'
    code = 2
  }
  return { code, state, cases, pass, total: cases.length, probe }
}

/**
 * 自检:面三档守恒、uvx 缺失、pin 解析失败、违规红绿两向 —— 全部真跑(不 mock 判据)。
 * uvx 不在本机时,依赖真 ruff 的用例标记为未演示,自检结论降为 undetermined。
 */
export function selfTest({ uvx = null, timeout = 240000 } = {}) {
  const cases = []
  const add = (name, ok, detail = '') =>
    cases.push({ name, ok: Boolean(ok), detail: String(detail) })
  const exe = uvx || resolveUvx()
  const probe = probeUvx(exe)
  let dir = null
  try {
    const repoPin = parseRuffPin(readFileSync(join(ROOT, PYPROJECT_REL), 'utf8'))
    add(
      '真仓 pin 可解析(夹具版本源)',
      repoPin.ok,
      repoPin.ok ? `ruff==${repoPin.version}` : repoPin.reason,
    )
    if (!repoPin.ok) return finishSelfTest(cases, probe)

    dir = mkScratch('check-ruff-selftest-')
    gitRun(dir, ['init', '-b', 'main'])
    fixtureWrite(dir, PYPROJECT_REL, fixturePyproject(repoPin.version))
    fixtureWrite(dir, `${AI_PREFIX}app/good.py`, 'VALUE = 1\n')
    fixtureCommit(dir, 'fixture: clean')

    if (probe.ok) {
      const judgeAll = () =>
        ['head', 'staged', 'worktree'].map((face) => ({
          face,
          v: judgeFace({ root: dir, face, uvx: exe, timeout }),
        }))
      const summary = (rs) => rs.map((r) => `${r.face}=${r.v.code}`).join(' ')

      const greens = judgeAll()
      add(
        '(a1) 三面守恒(绿):三档结论一致',
        new Set(greens.map((r) => r.v.code)).size === 1,
        summary(greens),
      )
      add(
        '(a2) 干净面 ⇒ exit 0',
        greens.every((r) => r.v.code === 0),
        summary(greens),
      )

      fixtureWrite(dir, `${AI_PREFIX}app/bad.py`, 'import os\n')
      fixtureCommit(dir, 'fixture: violation')
      const reds = judgeAll()
      add(
        '(d1) 三面守恒(红):三档结论一致',
        new Set(reds.map((r) => r.v.code)).size === 1,
        summary(reds),
      )
      add(
        '(d2) 有违规 ⇒ exit 1 且逐条输出含 F401',
        reds.every((r) => r.v.code === 1 && /F401/.test(r.v.output)),
        summary(reds),
      )

      const bogusWhileRed = judgeFace({
        root: dir,
        face: 'staged',
        uvx: 'ihui-no-such-uvx-xyz',
        timeout,
      })
      add(
        '(d3) 有违规时 uvx 缺失 ⇒ exit 2(未判定优先于红)',
        bogusWhileRed.code === 2 && bogusWhileRed.kind === 'undetermined',
        `code=${bogusWhileRed.code} ${bogusWhileRed.reason || ''}`,
      )

      gitRun(dir, ['rm', '-q', '--', `${AI_PREFIX}app/bad.py`])
      fixtureCommit(dir, 'fixture: clean again')
      const back = judgeFace({ root: dir, face: 'head', uvx: exe, timeout })
      add(
        '(d4) 违规移除后回到 exit 0(红→绿真翻)',
        back.code === 0,
        `code=${back.code} ${back.reason || ''}`,
      )
    }

    const missing = judgeFace({ root: dir, face: 'head', uvx: 'ihui-no-such-uvx-xyz', timeout })
    add(
      '(b) uvx 缺失 ⇒ exit 2 且点名工具缺失',
      missing.code === 2 && /uvx/.test(missing.reason || ''),
      `code=${missing.code} ${missing.reason || ''}`,
    )

    fixtureWrite(dir, PYPROJECT_REL, '[tool.ruff]\nline-length = 100\n')
    fixtureCommit(dir, 'fixture: pin removed')
    const noPin = judgeFace({ root: dir, face: 'head', uvx: exe, timeout })
    add(
      '(c) pin 解析失败 ⇒ exit 2',
      noPin.code === 2 && /pin/.test(noPin.reason || ''),
      `code=${noPin.code} ${noPin.reason || ''}`,
    )

    gitRun(dir, ['rm', '-q', '--', `${AI_PREFIX}app/good.py`])
    fixtureCommit(dir, 'fixture: no python')
    const empty = judgeFace({ root: dir, face: 'head', uvx: exe, timeout })
    add(
      '(e) 面内 .py 枚举到 0 ⇒ exit 2(§0.3)',
      empty.code === 2 && /0 个 \.py/.test(empty.reason || ''),
      `code=${empty.code} ${empty.reason || ''}`,
    )

    add(
      '(f) --staged 与 --worktree 同给 ⇒ exit 2',
      Boolean(resolveFace(['--staged', '--worktree']).error),
      resolveFace(['--staged', '--worktree']).error || '',
    )
  } catch (e) {
    add('自检夹具搭建', false, e?.message ?? String(e))
  } finally {
    if (dir) rmScratch(dir, { bestEffort: true })
  }
  return finishSelfTest(cases, probe)
}

// ===========================================================================
// CLI
// ===========================================================================

function printHelp() {
  console.log(`
check-ruff-python.mjs — ruff Python lint 守门(防 ai-service lint 欠账回流)

判定面(先选面,再跑工具):
  默认        判 **HEAD 面** —— 先把该面上的 Python 文件物化到临时目录,再在那里跑 ruff
  --staged    判 **索引面** —— 即"这次会被提交进去的那一份内容";邻居工作树里的改动不参与
  --worktree  判磁盘(仅人工复现用,结论不得作为提交门禁)
  --staged 与 --worktree 同给 ⇒ exit 2(两面互斥,取哪一面都会让另一面成为假绿)

用法:
  node scripts/check-ruff-python.mjs             全量档(判 HEAD 面)
  node scripts/check-ruff-python.mjs --staged    提交链档(判索引面;无 ai-service .py 暂存则跳过)
  node scripts/check-ruff-python.mjs --worktree  人工:在工作树复现
  node scripts/check-ruff-python.mjs --self-test 自检(面三档守恒 / uvx 缺失 / pin 失败 / 违规红绿两向)
  node scripts/check-ruff-python.mjs --help      打印此帮助

退出码:
  0  判定面 0 violations;或 --staged 无相关暂存
  1  判定面确有违规(逐条打印 ruff 输出)
  2  无法判定(uvx 缺失、pin 解析失败、被审面取不到、ruff 自身 rc∉{0,1}、两面旗同给)

执行命令(在**物化出来的判定面**里):
  uvx ruff==<pin> check . --no-cache --no-respect-gitignore
  (pin 唯一源 = apps/ai-service/pyproject.toml 的 ruff==x.y.z,现读 0.16.6)

环境变量:
  HUSKY_SKIP_RUFF=1        紧急跳过本门(不推荐,跳门需留痕)
  IHUI_RUFF_GATE_UVX       uvx 可执行路径覆盖(换机/夹具出口,不是跳门)
  IHUI_RUFF_GATE_TIMEOUT_MS 单次 ruff 超时(默认 600000)
`)
}

function printSelfTest() {
  const r = selfTest()
  console.log('🧪 check-ruff-python --self-test')
  for (const c of r.cases) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
  }
  console.log(`自检 ${r.total} 例:${r.pass} 通过 / ${r.total - r.pass} 失败`)
  if (!r.probe.ok)
    console.log(`${C.yellow}⚠️ 真 ruff 通道不可用(${r.probe.detail})⇒ 红绿两向未演示${C.reset}`)
  console.log(`SELF-TEST-RESULT state=${r.state}`)
  return r.code
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return printSelfTest()

  const known = ['--staged', '--worktree']
  const unknown = argv.filter((a) => a.startsWith('-') && !known.includes(a))
  if (unknown.length > 0) {
    console.log(
      `${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):未识别参数 ${unknown.join(' ')}${C.reset}`,
    )
    console.log(`${C.dim}   可用:--staged / --worktree / --self-test / --help${C.reset}`)
    return 2
  }

  if (process.env.HUSKY_SKIP_RUFF === '1') {
    console.log(`${C.yellow}⚠️  ruff 守门已跳过(HUSKY_SKIP_RUFF=1,紧急场景,不推荐)${C.reset}`)
    return 0
  }

  const { face, error } = resolveFace(argv)
  if (error) {
    console.log(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${error}${C.reset}`)
    return 2
  }

  if (face === 'staged') {
    let changes
    try {
      changes = stagedPythonChanges(ROOT)
    } catch (e) {
      console.log(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${e?.message ?? e}${C.reset}`)
      console.log(
        `${C.dim}   出路:确认在 git 仓库内跑;或应急 HUSKY_SKIP_RUFF=1 git commit ...${C.reset}`,
      )
      return 2
    }
    const plan = planStaged(changes)
    if (plan.code === 2) {
      console.log(`${C.red}${C.bold}❌ ruff 守门无法判定(exit 2):${plan.reason}${C.reset}`)
      return 2
    }
    if (plan.skip) {
      console.log(
        `${C.dim}⏭  ${plan.reason}(索引面没有 apps/ai-service/**/*.py 改动),跳过${C.reset}`,
      )
      return 0
    }
    console.log(
      `${C.cyan}${C.bold}[ruff 守门] staged 检测到 ${plan.changes.length} 个 Python 文件改动,触发 ruff 检查:${C.reset}`,
    )
    for (const f of plan.changes.slice(0, 10)) console.log(`${C.dim}  - ${f}${C.reset}`)
    if (plan.changes.length > 10) {
      console.log(`${C.dim}  ... 及其他 ${plan.changes.length - 10} 个文件${C.reset}`)
    }
  }

  console.log(`${C.cyan}${C.bold}[ruff 守门] 判定面=${faceLabelOf(face)}${C.reset}`)
  const verdict = judgeFace({ root: ROOT, face })
  for (const line of verdict.lines) console.log(line)
  return verdict.code
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要 import 上面的判据)
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
  ROOT,
  AI_REL,
  PYPROJECT_REL,
  RUFF_ARGS,
  parseRuffPin,
  ruffSpecFor,
  isRuffMaterializable,
  pickRuffPaths,
  faceSpecPrefix,
  resolveFace,
  classifyRuffOutcome,
  exitCodeFor,
  undeterminedReason,
  faceLabelOf,
  planStaged,
  stagedPythonChanges,
  materializeFace,
  resolveUvx,
  isEgressFailure,
  runRuff,
  probeUvx,
  judgeFace,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
