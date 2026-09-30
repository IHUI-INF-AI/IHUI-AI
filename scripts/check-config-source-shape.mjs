#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 配置出处形状守门(G-663,2026-09-29 立)。
 *
 * 立因:AGENTS.md A19(「候选序解析器必须同时提供「出处」出口」,`scripts/lib/key-dir.mjs`
 * 的 `resolveKeyDirDetailed()` 返回 `{path, triedCandidates[], winnerIndex}` 三态)自己写着
 * **「但这条是散文约束、没有门:判『有没有真的回答出处』结构上判不了……(如实登记,别误以为
 * 这里有尺子)」**。本门把这句"没有门"升成机器判据。票面判据逐字对齐:
 *   ① 注入一个无 sources(出处三键)的新配置出口 ⇒ 红;
 *   ② 既有 key-dir 侧(现状实现)⇒ 绿。
 *
 * 「sources 形状」= A19 钉的出处三键 `{ path, triedCandidates[], winnerIndex }`
 * (hasSourcesShape 纯函数是唯一判读处,不留第二份)。
 *
 * C1 出口形状 —— 对 scripts/lib 下「候选序出口模块」逐个执行:
 *   候选序出口模块 = 模块正文同时命中 existsSync 与 process.env 的 lib 模块
 *   (即拥有唯一候选表、以"存在即真"跨候选探查的出口面;现状唯一:key-dir.mjs)。
 *   其中每个「读 env 的具名导出函数」(fn.toString() 命中 process.env / env.<x> / env[)
 *   必须满足其一,否则点名:
 *   a) 自身是出处出口(出口名以 Detailed 结尾):运行时探针实测返回对象含三键且类型正确;
 *   b) 存在同名 `Detailed` 配对出口(投影出口,A19 的 resolveKeyDir↔resolveKeyDirDetailed
 *      同构),且配对出口三键实测通过 + 投影等价实测成立(proj(...) === detailed(...).path);
 *   c) 函数体委托同一模块内已 covered 的出口(出处经委托链继承,keyFile→resolveKeyDir 型);
 *   d) 均不满足 ⇒ **新增无出处出口,红**(exit 1)—— 票面验收①即此格的构造面证明;
 *   e) 属首锚台账登记的存量 ⇒ 只报数(warn),不红 —— §12e:立门前若现读有存量,当场
 *      blocking 就是恒红门。台账 = scripts/config-source-shape-baseline.json;账只锚存量
 *      不发豁免,新出口登记进来仿效照红(红格先判,台账只在终判兜底查)。
 *
 * C2 出口面打来源三键 —— 票面「启动序列必须打来源三键」在本仓的具象:拥有实测通过出处出口的
 *   模块(现状唯一:key-dir.mjs),其顶层 scripts/*.mjs 的 CLI import 面必须存在**至少一个
 *   discharge 点**打印来源三键(triedCandidates + winnerIndex + .path;现状 = secret-path.mjs
 *   的 --explain 诊断路径)。一个都没有 ⇒ 红。刻意不逐面点名:消费 key-dir 做业务判定的门
 *   (check-credential-health 族)不是 discharge 点,逐面要求会把 A19 撑成"所有调用方都得
 *   复读候选序"。discharge 点集合为空(import 面为空)⇒ 无法判定(出处出口无人打,不静默记绿)。
 *
 * 三态探针(实测而非读码):把被审面模块正文物化到临时目录后 import,用构造 env
 * (IHUI_SECRETS_ROOT 指向临时根;探针子目录"不存在→建出"两态)实测三键形状与投影等价
 * —— 不依赖真实盘符;winnerIndex 的业务语义(三态判读)不进本门射程,那属单测。
 *
 * 用法:
 *   node scripts/check-config-source-shape.mjs             (判 **HEAD blob**)
 *   node scripts/check-config-source-shape.mjs --worktree  (人工取证档:判磁盘)
 *   node scripts/check-config-source-shape.mjs --self-test (构造面正反例自检)
 * 退出码:0 = 通过(存量报数 warn 不改色)/ 1 = 红(C1 新增无出处出口 / 三键形状破损 /
 *        投影等价破,C2 出口面缺三键)/ 2 = 无法判定(非仓库根、被审面取不到、模块 import
 *        失败、探针执行抛错、CLI 出口面为空、首锚台账取不到或不可解析)。
 * 未接 --staged 档:判据走运行时探针 + 首锚台账,台账按「模块|出口」登记、不分面;pre-commit
 * 场景由 HEAD 档承接(新出口入库即被点名),不装"索引档"的样子。
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  Undetermined,
  assertRepoRoot,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const GIT_TIMEOUT = 120000

/** A19 出处三键:sources 形状的唯一判读面。 */
const SOURCES_KEYS = ['path', 'triedCandidates', 'winnerIndex']

/** 「读 env 的具名出口」识别:函数源文本命中任一即算(默认参数、体读 env、体下标 env)。 */
const RE_ENV_READ = /process\.env|\benv\.\w+|\benv\[/

/**
 * 射程排除:函数体是**子进程派生器**(spawnSync/execFileSync 族)不算「读配置的具名出口」
 * —— 它读 env 是为了给子进程构造环境(如 bypass-git 的 git()),不是解析某个配置来源;
 * A19 的主体是候选序解析器,不是所有摸过 env 的函数。构造env→spawn 的形态若真要携带出处,
 * 那是另一族契约,不进本门射程(写明在案的忽略项,不是暗减)。
 */
const RE_SPAWNER = /\bspawnSync\b|\bexecFileSync\b|\bexecSync\b|\bspawn\(/

/** 首锚台账路径(键 = <模块相对路径>|<出口名>)。 */
const BASELINE_PATH = 'scripts/config-source-shape-baseline.json'

/** 探针子目录名(先不存在后建出,两态共用;建出后即"存在态")。 */
const PROBE_SUB = '__g663_probe__'

/**
 * 三键形状判读(纯函数):对象、含 path 键、triedCandidates 是数组、winnerIndex 是整数。
 * 类型按 A19 原文(path 可为 null,tried 为候选全路径列表,winnerIndex 为候选表下标,-1 亦合法)。
 */
export function hasSourcesShape(v) {
  return (
    v !== null &&
    typeof v === 'object' &&
    'path' in v &&
    Array.isArray(v.triedCandidates) &&
    Number.isInteger(v.winnerIndex)
  )
}

/**
 * 出处出口探针:构造 env(IHUI_SECRETS_ROOT=临时根)下两态实测。
 * 态一:探针子目录不存在 ⇒ 三键齐全、path === null、winnerIndex === 0(env 根存在)。
 * 态二:建出探针子目录 ⇒ path 命中该构造路径。
 * fn 抛错不算"形状破损",由调用方折成无法判定(探针跑不起来 ≠ 判据判红)。
 */
export function probeSourcesExit(fn, { tmpRoot, env, sub }) {
  const first = fn(sub, env)
  if (!hasSourcesShape(first))
    return { ok: false, why: `态一(子目录不存在)返回值缺出处三键: ${safeJson(first)}` }
  if (first.path !== null)
    return { ok: false, why: `态一 path 应为 null(子目录不存在),实得 ${safeJson(first.path)}` }
  if (first.winnerIndex !== 0)
    return {
      ok: false,
      why: `态一 winnerIndex 应为 0(env 根存在),实得 ${safeJson(first.winnerIndex)}`,
    }
  mkdirSync(join(tmpRoot, sub), { recursive: true })
  const second = fn(sub, env)
  if (!hasSourcesShape(second))
    return { ok: false, why: `态二(子目录已建出)返回值缺出处三键: ${safeJson(second)}` }
  const expected = join(tmpRoot, sub).replace(/\\/g, '/')
  if (second.path !== expected)
    return { ok: false, why: `态二 path 应命中构造根 ${expected},实得 ${safeJson(second.path)}` }
  return { ok: true }
}

function safeJson(v) {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function fnSource(fn) {
  try {
    return String(fn)
  } catch {
    return ''
  }
}

/**
 * C1 纯函数判据核心:对单个候选序出口模块的命名空间分类。
 * @param baselineMap 首锚台账(键 = `${relPath}|${出口名}`,值 = 登记理由)
 * @returns {{covered:Map, findings:Array, warnings:Array, undetermined:Array, consumedBaseline:Set}}
 */
export function judgeModuleExports({ relPath, ns, baselineMap, probeEnv, tmpRoot, probeSub }) {
  const findings = []
  const warnings = []
  const undetermined = []
  const covered = new Set()
  const kind = new Map()
  const consumedBaseline = new Set()
  const names = Object.keys(ns).filter(
    (k) =>
      typeof ns[k] === 'function' &&
      RE_ENV_READ.test(fnSource(ns[k])) &&
      !RE_SPAWNER.test(fnSource(ns[k])),
  )

  // 第一轮:出处出口本体(*Detailed)逐个探三键。
  for (const n of names.filter((x) => x.endsWith('Detailed'))) {
    try {
      const r = probeSourcesExit(ns[n], { tmpRoot, env: probeEnv, sub: probeSub })
      if (r.ok) {
        kind.set(n, 'sources')
        covered.add(n)
      } else {
        findings.push({ module: relPath, exit: n, kind: 'C1 出处出口三键形状破损', why: r.why })
        kind.set(n, 'red')
      }
    } catch (e) {
      undetermined.push(`${relPath}|${n} 出处探针执行失败(不判红也不判绿): ${e?.message ?? e}`)
      kind.set(n, 'und')
    }
  }

  // 收敛轮:投影配对与委托覆盖(被委托者可能排在后面,跑到不再前进为止)。
  let progressed = true
  while (progressed) {
    progressed = false
    for (const n of names) {
      if (kind.has(n)) continue
      const fn = ns[n]
      const sib = `${n}Detailed`
      if (n !== sib && covered.has(sib)) {
        try {
          const d = ns[sib](probeSub, probeEnv)
          const p = fn(probeSub, probeEnv)
          if (p === d.path) {
            kind.set(n, 'projection')
            covered.add(n)
            progressed = true
            continue
          }
          findings.push({
            module: relPath,
            exit: n,
            kind: 'C1 投影等价破裂',
            why: `proj(...)=${safeJson(p)} !== ${sib}(...).path=${safeJson(d.path)}(A19:旧版由新版降格投影而来,等价必须实测成立)`,
          })
          kind.set(n, 'red')
          progressed = true
          continue
        } catch (e) {
          undetermined.push(
            `${relPath}|${n} 投影等价探针执行失败(签名不合 (sub, env) 约定?): ${e?.message ?? e}`,
          )
          kind.set(n, 'und')
          progressed = true
          continue
        }
      }
      const src = fnSource(fn)
      const delegateTo = [...covered].find((c) => c !== n && new RegExp(`\\b${c}\\b`).test(src))
      if (delegateTo) {
        kind.set(n, `delegation:${delegateTo}`)
        covered.add(n)
        progressed = true
      }
    }
  }

  // 终判:仍未覆盖者 —— 首锚存量报数,其余 = 新增无出处出口(红)。
  for (const n of names) {
    if (kind.has(n)) continue
    const key = `${relPath}|${n}`
    if (Object.prototype.hasOwnProperty.call(baselineMap, key)) {
      warnings.push({ key, why: `存量报数(首锚):${baselineMap[key]}` })
      consumedBaseline.add(key)
    } else {
      findings.push({
        module: relPath,
        exit: n,
        kind: 'C1 新增无出处出口',
        why: '读 env 的具名出口既无出处三键形状、无 Detailed 配对、也不委托已覆盖出口,且不在首锚台账(票面验收①的判红格)',
      })
    }
  }
  return { covered: kind, findings, warnings, undetermined, consumedBaseline }
}

/**
 * 首锚残项:台账里有、这一面已见不到的条目(存量清零或模块已删)—— 好方向,但要报数请人工复锚,
 * 不静默吞掉(台账与被审面的差值必须可见)。
 */
export function residualBaseline(baselineMap, consumed) {
  return Object.keys(baselineMap)
    .filter((k) => !consumed.has(k))
    .map((k) => ({
      key: k,
      why: '首锚条目在被审面上已不存在(存量清零或模块已删)—— 请人工复锚台账',
    }))
}

/**
 * C2 纯函数判据:出处出口的 CLI discharge 点必须存在 —— 票面「启动序列必须打来源三键」。
 * 收窄口径(2026-09-30 首跑实证修正):只对**拥有实测通过出处出口的模块**(provenanceModuleNames,
 * 现状唯一 key-dir.mjs)的顶层 CLI import 面要求"至少一个面打印三键(triedCandidates+winnerIndex+.path)",
 * 不逐面点名 —— 消费 key-dir 做业务判定的门(check-credential-health 族)不是 discharge 点,
 * 逐面要求会把 A19 撑成"所有调用方都得复读候选序",那正是 A19 要禁止的抄表。
 * @param faces [{relPath, source}] 顶层 scripts/*.mjs(不含 lib 一层)
 * @param provenanceModuleNames 拥有出处出口的模块文件名(如 ['key-dir.mjs'])
 */
export function judgeCliFaces({ faces, provenanceModuleNames }) {
  const findings = []
  const undetermined = []
  const importing = faces.filter((f) =>
    provenanceModuleNames.some((m) => new RegExp(`from\\s+['"][^'"]*${m}['"]`).test(f.source)),
  )
  if (importing.length === 0) {
    undetermined.push(
      'CLI 出口面为空:没有任何顶层脚本 import 出处出口模块 —— 来源三键无人打',
    )
    return { findings, undetermined, importing, dischargers: [] }
  }
  const dischargers = importing.filter(
    (f) =>
      /triedCandidates/.test(f.source) &&
      /winnerIndex/.test(f.source) &&
      /\.path\b/.test(f.source),
  )
  if (dischargers.length === 0)
    findings.push({
      module: importing.map((f) => f.relPath).join(', '),
      exit: '(CLI discharge 点)',
      kind: 'C2 出口面未打来源三键',
      why: `${importing.length} 个 CLI 出口面 import 了出处出口模块,但没有一个打印来源三键(triedCandidates+winnerIndex+.path)—— 票面:启动序列必须打来源三键`,
    })
  return { findings, undetermined, importing, dischargers }
}

/** 结论 → 退出码:无法判定优先于红(不把"跑不起来"洗成判红,更不洗成绿)。 */
export function decideExit({ findings, undetermined }) {
  if (undetermined.length > 0) return 2
  if (findings.length > 0) return 1
  return 0
}

/** 枚举一面上的 .mjs 清单。HEAD 判 ls-tree;worktree = 跟踪 ⊕ 未跟踪。lib 与顶层两个射程分开收。 */
function listScripts(root, relDir, face, pattern) {
  const prefix = `${relDir}/`
  if (face === 'worktree') {
    const tracked = gitRaw(['ls-files', '-z', prefix], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
    const others = gitRaw(['ls-files', '--others', '--exclude-standard', '-z', prefix], root, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
    return [...new Set([...tracked, ...others])].filter((p) => pattern.test(p))
  }
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', prefix], root, {
    timeout: GIT_TIMEOUT,
  })
    .split('\0')
    .filter(Boolean)
    .filter((p) => pattern.test(p))
}

const RE_LIB_MJS = /^scripts\/lib\/[^/]+\.mjs$/
const RE_CLI_MJS = /^scripts\/[^/]+\.mjs$/

/**
 * 清单与内容同面同轮。HEAD 档走**逐文件 `git cat-file blob HEAD:<p>`**(经 face-reader 的
 * gitRaw 统一派生层,不带 input ⇒ stdio ['ignore','pipe','pipe'])—— 刻意不用 catBatch:
 * `cat-file --batch` 必吃 stdin(input 管道),本仓 2026-09-30 实证病会话进程树下 Node 建
 * stdin 管道必 EBUSY(见 skills/ihui-spawn-ebusy-fix),批量通道会让本门在病会话里"判定面
 * 无法取材";单文件 blob 通道与批量通道取的是同一个 HEAD blob,内容逐字等价,只是放弃批量的
 * 派生次数优化(本门被审面 ~55 份,可接受)。取不到 ⇒ null(调用方判"无法判定")。
 */
function readFaceContents(root, paths, face) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  for (const p of paths) {
    try {
      map.set(p, gitRaw(['cat-file', 'blob', `HEAD:${p}`], root, { timeout: GIT_TIMEOUT }))
    } catch {
      map.set(p, null)
    }
  }
  return map
}

/** 候选序出口模块预筛:正文同时命中 existsSync 与 process.env。 */
function isCandidateExitModule(source) {
  return /existsSync/.test(source) && /process\.env/.test(source)
}

/**
 * 把被审面 lib 正文(全部,不只候选 —— 让未来候选模块的 lib 内相对 import 也能解析)物化到
 * 临时目录;只 import 候选模块。HEAD blob 与磁盘统一走这里,探针不依赖"盘上文件与被审面一致"。
 */
async function materializeAndImport(libSources, candidatePaths) {
  const nsByPath = new Map()
  const undetermined = []
  const tmpRoot = mkdtempSync(join(tmpdir(), 'g663-probe-'))
  const tmpByPath = new Map()
  for (const [relPath, source] of libSources) {
    const tmpFile = join(tmpRoot, relPath.split('/').pop())
    writeFileSync(tmpFile, source, 'utf8')
    tmpByPath.set(relPath, tmpFile)
  }
  for (const relPath of candidatePaths) {
    try {
      nsByPath.set(relPath, await import(pathToFileURL(tmpByPath.get(relPath)).href))
    } catch (e) {
      undetermined.push(
        `${relPath} 模块 import 失败(探针无法执行,不静默记绿): ${e?.message ?? e}`,
      )
    }
  }
  return { nsByPath, undetermined, tmpRoot }
}

/** 首锚台账按被审面取(HEAD blob / 磁盘),与被审面同源,不混面。取材通道同 readFaceContents(不吃 stdin)。 */
function loadBaseline(root, face) {
  let text
  if (face === 'worktree') text = readWorktreeFile(root, BASELINE_PATH)
  else {
    try {
      text = gitRaw(['cat-file', 'blob', `HEAD:${BASELINE_PATH}`], root, { timeout: GIT_TIMEOUT })
    } catch {
      text = null
    }
  }
  if (typeof text !== 'string')
    throw new Undetermined(`首锚台账 ${BASELINE_PATH} 在被审面(${face})取不到 —— 不静默记绿`)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Undetermined(`首锚台账 ${BASELINE_PATH} 不可解析: ${e?.message ?? e}`)
  }
  if (parsed === null || typeof parsed !== 'object' || typeof parsed.legacyExitsWithoutSources !== 'object' || parsed.legacyExitsWithoutSources === null)
    throw new Undetermined(`首锚台账 ${BASELINE_PATH} 缺 legacyExitsWithoutSources 对象 —— 台账形态破损,不静默记绿`)
  return parsed.legacyExitsWithoutSources
}

/** 构造面自检:正反例必须成对;T6(注入即红)是票面验收①,T14(真模块绿)是票面验收②的探针面。 */
async function selfTest() {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'g663-selftest-'))
  const probeEnv = { IHUI_SECRETS_ROOT: tmpRoot }
  let bad = 0
  const check = (label, cond) => {
    if (!cond) {
      console.error(`${C.red}✗ 自检失败:${label}`)
      bad++
    }
  }
  const fixtureDetailed = (sub, env = process.env) => {
    const root = env.IHUI_SECRETS_ROOT
    const p = join(root, sub).replace(/\\/g, '/')
    return { path: existsSync(p) ? p : null, triedCandidates: [p], winnerIndex: 0 }
  }
  const judge = (relPath, ns, baselineMap = {}) => {
    // 每用例独立临时根:探针"态二"会建出子目录,共用根会把"态一"污染成存在态(T1 之后全炸)。
    const root = mkdtempSync(join(tmpdir(), 'g663-selftest-'))
    try {
      return judgeModuleExports({
        relPath,
        ns,
        baselineMap,
        probeEnv: { IHUI_SECRETS_ROOT: root },
        tmpRoot: root,
        probeSub: PROBE_SUB,
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
  const base = 'scripts/lib/fake.mjs'

  // T1 出处出口本体:三键齐全 ⇒ 绿。
  let r = judge(base, { resolveFooDetailed: fixtureDetailed })
  check('T1 出处出口三键齐全 ⇒ 绿', r.findings.length === 0 && r.undetermined.length === 0)

  // T2 三键形状破损(缺 winnerIndex)⇒ 红。
  r = judge(base, {
    resolveFooDetailed: (sub, env = process.env) => {
      const d = fixtureDetailed(sub, env)
      return { path: d.path, triedCandidates: d.triedCandidates }
    },
  })
  check(
    'T2 出处出口缺 winnerIndex ⇒ 红',
    r.findings.length === 1 && /三键形状破损/.test(r.findings[0].kind),
  )

  // T3 投影配对:proj === detailed.path ⇒ 双绿。
  const projOk = (sub, env = process.env) => fixtureDetailed(sub, env).path
  r = judge(base, { resolveFoo: projOk, resolveFooDetailed: fixtureDetailed })
  check('T3 投影配对等价 ⇒ 绿', r.findings.length === 0 && r.undetermined.length === 0)

  // T4 投影等价破裂 ⇒ 红。
  r = judge(base, {
    resolveFoo: (sub, env = process.env) => `${fixtureDetailed(sub, env).path}/x`,
    resolveFooDetailed: fixtureDetailed,
  })
  check(
    'T4 投影等价破裂 ⇒ 红',
    r.findings.length === 1 && r.findings[0].kind.includes('投影等价破裂'),
  )

  // T5 委托继承(keyFile→resolveKeyDir 型):委托目标须是具名覆盖出口(resolveFoo 投影覆盖)⇒ 绿。
  const resolveFoo = (sub, env = process.env) => fixtureDetailed(sub, env).path
  const resolveBaz = (sub, env = process.env) => resolveFoo(sub, env)
  r = judge(base, { resolveFooDetailed: fixtureDetailed, resolveFoo, resolveBaz })
  check('T5 委托继承 ⇒ 绿', r.findings.length === 0 && r.undetermined.length === 0)

  // T6 票面验收①:注入无 sources 的新配置出口 ⇒ 红。
  const bareConfigExit = (sub, env = process.env) => join(env.IHUI_SECRETS_ROOT ?? '', sub)
  r = judge(base, { resolveNewConfig: bareConfigExit })
  check(
    'T6 注入无出处新出口 ⇒ 红',
    r.findings.length === 1 && r.findings[0].kind === 'C1 新增无出处出口',
  )

  // T7 同一出口登记进首锚 ⇒ 只报数不红(exit 0)。
  r = judge(base, { resolveNewConfig: bareConfigExit }, { [`${base}|resolveNewConfig`]: '存量登记' })
  check(
    'T7 首锚存量 ⇒ 仅 warn',
    r.findings.length === 0 && r.warnings.length === 1 && r.consumedBaseline.size === 1,
  )

  // T8 首锚残项:条目出口消失 ⇒ 报 warn 请人工复锚。
  r = residualBaseline({ [`${base}|gone`]: 'x' }, new Set())
  check('T8 首锚残项 ⇒ 报数', r.length === 1)

  // T9 探针抛错 ⇒ 无法判定(不判红也不判绿,退出码 2)。
  r = judge(base, {
    resolveFooDetailed: (sub, env = process.env) => {
      throw new Error('probe boom')
    },
  })
  check('T9 探针抛错 ⇒ 无法判定', r.undetermined.length === 1 && r.findings.length === 0)
  check('T9 退出码 = 2', decideExit(r) === 2)

  // T10 C2 discharge 点存在 ⇒ 绿。
  r = judgeCliFaces({
    faces: [
      {
        relPath: 'scripts/fake-cli.mjs',
        source:
          "import { resolveKeyDirDetailed } from './lib/key-dir.mjs'\nconsole.log(d.triedCandidates, d.winnerIndex, d.path)",
      },
      { relPath: 'scripts/fake-consumer.mjs', source: "import { resolveKeyDir } from './lib/key-dir.mjs'\nmain()" },
    ],
    provenanceModuleNames: ['key-dir.mjs'],
  })
  check('T10 C2 discharge 点存在 ⇒ 绿', r.findings.length === 0 && r.undetermined.length === 0 && r.dischargers.length === 1)

  // T11 C2 有 import 面但无 discharge 点 ⇒ 红。
  r = judgeCliFaces({
    faces: [
      {
        relPath: 'scripts/fake-consumer.mjs',
        source: "import { resolveKeyDir } from './lib/key-dir.mjs'\nmain()",
      },
    ],
    provenanceModuleNames: ['key-dir.mjs'],
  })
  check(
    'T11 C2 无 discharge 点 ⇒ 红',
    r.findings.length === 1 && r.findings[0].kind === 'C2 出口面未打来源三键',
  )

  // T12 C2 出口面为空 ⇒ 无法判定(退出码 2)。
  r = judgeCliFaces({ faces: [], provenanceModuleNames: ['key-dir.mjs'] })
  check('T12 C2 出口面为空 ⇒ 无法判定', r.undetermined.length === 1)
  check('T12 退出码 = 2', decideExit({ findings: r.findings, undetermined: r.undetermined }) === 2)

  // T15 射程排除:体是子进程派生器的 env 函数(构造环境→spawn)不算配置出口 ⇒ 不进判据。
  r = judge(base, {
    gitRunner: (args, opts = {}) => {
      const e = { ...process.env }
      return spawnSync(args, e, opts)
    },
  })
  check('T15 派生器形态排除 ⇒ 不点名', r.findings.length === 0 && r.warnings.length === 0)

  // T13 形状判读本身:非对象 / 缺键 / 类型错 ⇒ 一律不算 sources 形状。
  check('T13a null 不算形状', !hasSourcesShape(null))
  check('T13b 数组不算形状', !hasSourcesShape([]))
  check(
    'T13c triedCandidates 非数组不算',
    !hasSourcesShape({ path: null, triedCandidates: 'x', winnerIndex: 0 }),
  )
  check(
    'T13d winnerIndex 非整数不算',
    !hasSourcesShape({ path: null, triedCandidates: [], winnerIndex: 1.5 }),
  )
  check('T13e 三键齐全算(winnerIndex -1 合法)', hasSourcesShape({ path: null, triedCandidates: [], winnerIndex: -1 }))

  // T14 真仓实证(票面验收②的探针面):既有 key-dir 侧三键与投影等价实测必绿。
  //     全量判定(含首锚/出口面)由 main() 的 HEAD 档承担,这里只证模块判据本体。
  try {
    const ns = await import('./lib/key-dir.mjs')
    const pr = probeSourcesExit(ns.resolveKeyDirDetailed, { tmpRoot, env: probeEnv, sub: PROBE_SUB })
    check(`T14a 真模块 resolveKeyDirDetailed 三键实测 ⇒ 通过(${pr.ok ? '' : pr.why})`, pr.ok === true)
    const proj = ns.resolveKeyDir(PROBE_SUB, probeEnv)
    const det = ns.resolveKeyDirDetailed(PROBE_SUB, probeEnv)
    check('T14b 真模块 resolveKeyDir 投影等价实测 ⇒ 通过', proj === det.path)
  } catch (e) {
    check(`T14 真模块探针异常: ${e?.message ?? e}`, false)
  }

  rmSync(tmpRoot, { recursive: true, force: true })
  if (bad === 0) console.log(`${C.green}✅ 构造面自检通过(15 组正反例)`)
  else console.error(`${C.red}❌ 构造面自检失败 ${bad} 处`)
  return bad === 0
}

async function runGate(root, face) {
  assertRepoRoot(root, 'config-source-shape 的 ROOT')
  const libPaths = listScripts(root, 'scripts/lib', face, RE_LIB_MJS)
  const cliPaths = listScripts(root, 'scripts', face, RE_CLI_MJS)
  const contents = readFaceContents(root, [...libPaths, ...cliPaths], face)
  const unreadable = [...libPaths, ...cliPaths].filter((p) => typeof contents.get(p) !== 'string')
  if (unreadable.length > 0)
    throw new Undetermined(
      `被审面取不到 ${unreadable.length} 份正文: ${unreadable.slice(0, 5).join(', ')}`,
    )
  if (libPaths.length === 0)
    throw new Undetermined('scripts/lib 枚举到 0 个 .mjs 模块 ⇒ 尺子空转不是通过')

  const baselineMap = loadBaseline(root, face)
  const candidatePaths = libPaths.filter((p) => isCandidateExitModule(contents.get(p)))
  if (candidatePaths.length === 0)
    throw new Undetermined(
      'scripts/lib 枚举到 0 个候选序出口模块(existsSync+process.env 双命中)⇒ 尺子空转不是通过',
    )

  const { nsByPath, undetermined, tmpRoot } = await materializeAndImport(
    libPaths.map((p) => [p, contents.get(p)]),
    candidatePaths,
  )
  const probeEnv = { IHUI_SECRETS_ROOT: tmpRoot }
  const findings = []
  const warnings = []
  const consumedBaseline = new Set()
  const provenanceModuleNames = []
  try {
    for (const [relPath, ns] of nsByPath) {
      const r = judgeModuleExports({
        relPath,
        ns,
        baselineMap,
        probeEnv,
        tmpRoot,
        probeSub: PROBE_SUB,
      })
      findings.push(...r.findings)
      warnings.push(...r.warnings)
      undetermined.push(...r.undetermined)
      r.consumedBaseline.forEach((k) => consumedBaseline.add(k))
      // 拥有实测通过出处出口的模块,才进 C2 discharge 点射程。
      if ([...r.covered.values()].includes('sources'))
        provenanceModuleNames.push(relPath.split('/').pop())
    }
    warnings.push(...residualBaseline(baselineMap, consumedBaseline))

    const c2 = judgeCliFaces({
      faces: cliPaths.map((p) => ({ relPath: p, source: contents.get(p) })),
      provenanceModuleNames,
    })
    findings.push(...c2.findings)
    undetermined.push(...c2.undetermined)
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
  return {
    face,
    findings,
    warnings,
    undetermined,
    moduleCount: candidatePaths.length,
    provenanceModuleNames,
    cliCount: cliPaths.length,
  }
}

async function main() {
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1
  if (argv.includes('--staged')) {
    console.error(
      `${C.red}❌ 无法判定:本门未接 --staged 档(判据走运行时探针+首锚台账;pre-commit 由 HEAD 档承接,新出口入库即被点名)`,
    )
    return 2
  }
  const sel = selectFace({ staged: false, worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.error(`${C.red}❌ 无法判定:${sel.error}`)
    return 2
  }
  let out
  try {
    out = await runGate(ROOT, sel.face)
  } catch (e) {
    const known = e instanceof Undetermined
    console.error(
      `${C.red}❌ 无法判定(${sel.face} 面)⇒ 不记为通过:${
        known ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`
      }`,
    )
    return 2
  }
  for (const w of out.warnings) console.error(`${C.yellow}⚠️ 存量报数:${w.key} —— ${w.why}`)
  for (const u of out.undetermined) console.error(`${C.red}❌ 无法判定:${u}`)
  if (out.findings.length === 0) {
    if (out.undetermined.length > 0) return decideExit(out)
    console.log(
      `${C.green}✅ 配置出处形状一致(候选序出口模块 ${out.moduleCount} 个 / CLI 出口面 ${out.cliCount} 个;取材面:${out.face};A19 出处三键实测通过)`,
    )
    return 0
  }
  for (const f of out.findings) {
    console.error(`${C.red}❌ ${f.kind}:${f.module}|${f.exit}`)
    console.error(`   → ${f.why}`)
  }
  return decideExit(out)
}

/** §22d 双形态入口守护:测试 import 不触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(await main())

export const __test__ = {
  SOURCES_KEYS,
  RE_ENV_READ,
  hasSourcesShape,
  probeSourcesExit,
  judgeModuleExports,
  judgeCliFaces,
  residualBaseline,
  decideExit,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
