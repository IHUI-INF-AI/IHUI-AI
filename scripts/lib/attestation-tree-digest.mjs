// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门批留痕的「树指纹归一出口」+「批次留痕读写出口」(G-1059139,2026-10-07 立)。
 *
 * 要补的那一格:各道守门的应急跳过变量(`HUSKY_SKIP_*=1`)在提交链上**只往 stdout 打一行人类文案**
 * (`⏭  [id] label(跳过:SKIPENV=1)`),不落任何结构化留痕。于是统计器
 * `scripts/plan-bypass-ledger-report.mjs` 的按日四态里,"跑了 214 道门、按名字跳了 3 道"这种枚只能落
 * unknown —— 与"整批根本没跑"完全同形。把 unknown 径行读成 normal 是"把没判写成判过了";
 * 为少几条 unknown 而关掉跳过通道,则让出路退化成 `--no-verify`(一次绕过 = 该枚提交上全部对账作废)。
 * 所以这里只做一件事:**把那枚提交与"它自己那一轮批次"绑起来**,绑得住就点名,绑不住就如实说绑不住。
 *
 * 三条不可漂的写法:
 *   1. **归一函数只许有一份**。记录侧喂 `git ls-files --stage -z`(排除 unmerged 条目),
 *      报告侧喂 `git ls-tree -r --full-name -z <sha>`(必须**剥掉 `blob`/`tree`/`commit` 类型字段**),
 *      两侧经同一个 `normalizeGitEntries()` 得同一形状的 `"<mode> <oid>\t<path>"` 行集合,
 *      **排序后**取 sha256。两处各写一遍必然漂开 —— 那是本仓记过最多次的失效型(§22c / 守门 131/135/148)。
 *      排序与剥类型这两步都由测试的**构造面**证明其存在理由:真仓两侧天然是同序的,
 *      只拿真仓做正向证明,"去掉排序"会是一条不动任何结论的等价变异。
 *   2. **写留痕绝不改变门禁结论**。`appendGateBatchRecord()` 全程 try/catch,只回 `{ok, why}`,
 *      绝不抛、绝不改退出码(它判的是记账,不是门禁;一次正常的守门批不得因为记账写失败而变红)。
 *      但**写失败必须响亮** —— 调用方要把 `why` 打到 stderr,台账静默失踪是本仓最高频失效型。
 *   3. **读侧与四个既有写者共用同一本台账、同一个路径出口**(`LEDGER_REL` / `ledgerPath` 取自
 *      `./commit-attestation.mjs`,不得在任何调用方再拼一次)。本模块**不改** safe-commit /
 *      object-space-land / live-doc-edit / plan-tasks-merge 那四家的写入形状,只新增一个 kind。
 *      另设一份 `readGateBatchRecords()` 而非复用 `readLedgerRecords()`,原因是后者有**字段白名单**
 *      (ts/kind/gatesRun/ranFullBatch/declaredFiles/headBefore/landedSha/source),本 kind 的
 *      `treeDigest` / `selfSkipped` / `mode` 会被整块丢掉;而 `commit-attestation.mjs` 不在本票
 *      可改文件清单内 ⇒ 不得为加字段去动它。**只多一个读出口,不多一本账、不多一个写者。**
 *
 * 能力上限(必须跟读数一起说,否则下一个人会把"没绑上"读成"没跑门"):
 *   - 记录侧取的是**跑门那一刻的索引面**。若 lint-staged 改写过暂存内容、或 pre-commit 之后又有人动过
 *     索引,那一枚提交落地的 tree 与批次记录的 digest 就**不等**,报告侧会维持原态(通常仍是 unknown)。
 *     这是**正确行为**(宁可少归一类,不可错归一类 —— 错归等于给一台没跑门的机器发合格证),
 *     不是待修的洞;报告用 `unboundReasons` 把这一维量化并点名。
 *   - 同一 digest 命中窗口内多枚提交 ⇒ 全部落"无从分",一律不判新态。
 *   - 步骤级门(`.husky/*` 与 `scripts/lib/pre-commit-hook.js` 里 runner 之后的独立步骤)自带
 *     `HUSKY_SKIP_*`,runner 看不见它们的判定结果;本模块按"该面上出现、且当次环境变量为 1、
 *     且不在 runner 声明的 skipEnv 清单里"计数为 `undeclaredSkipHits`,**只报数不判红**。
 *     某个面读不到 ⇒ 该面落 `undetermined` 并点名,不得折成 0。
 *
 * 用法(只建出口 + 落账,不做判据,不进提交链的判红路径):
 *   import { indexTreeDigest, appendGateBatchRecord } from './lib/attestation-tree-digest.mjs'
 *   const d = indexTreeDigest({ root })           // {ok, digest, count, why}
 *   appendGateBatchRecord({ mode:'staged', totalChecks:214, executed:211, blockingFailed:0,
 *     selfSkipped:[{id:'52',skipEnv:'HUSKY_SKIP_X'}], notTriggered:[], undeclaredSkipHits:0,
 *     declaredFiles:[…], treeDigest:d.digest })   // {ok,path} 或 {ok:false,why}
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LEDGER_REL, ledgerPath } from './commit-attestation.mjs'
import { resolveGitBin } from './gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根由本文件自身位置推导(§15);禁止 process.cwd() 定根、禁止硬编码盘符。 */
export const REPO_ROOT = resolve(HERE, '..', '..')

/** 本类记录的 kind。统计侧靠它把"批次跑过"与四家既有写者分开。 */
export const GATE_BATCH_KIND = 'gate-batch-run'
/** declaredFiles 上限:超出只置 truncated 标记、不写全量(台账单行不得无界增长)。 */
export const DECLARED_FILES_CAP = 300
/** 派生 git 的超时(守门 80:热路径 git 只读调用必须带 timeout)。 */
export const GIT_TIMEOUT_MS = 90_000
/** ls-files / ls-tree 的真仓单次输出可到 16k 行 × ~50 B,128 MB 上限留足余量。 */
export const GIT_MAX_BUFFER_BYTES = 128 * 1024 * 1024
/**
 * 步骤级门所在的面。刻意只列 runner 之后那批独立步骤会读到的文件,
 * 不扫全仓 —— 扫全仓会把无关文案里的 HUSKY_SKIP_* 读成"有读点"。
 */
export const STEP_LEVEL_FACES = [
  'scripts/lib/pre-commit-hook.js',
  '.husky/pre-commit',
  '.husky/commit-msg',
]
const SKIP_ENV_RE = /HUSKY_SKIP_[A-Z0-9_]+/g
const MODE_RE = /^\d{6}$/
const OID_RE = /^[0-9a-f]{4,40}$/i

/**
 * 归一两侧条目为同一形状的 `<mode> <oid>\t<path>` 行集合。
 * source='ls-files':`mode SP oid SP stage \t path`,stage≠0 的 unmerged 条目整条剔除
 *   (索引里有冲突-stage 时,"这一轮的树"结构上没有唯一答案 ⇒ 不参与 digest,也不得静默当没有)。
 * source='ls-tree' :`mode SP type SP oid \t path`,**类型字段必须在这里剥掉**,否则两侧永不同形。
 * 返回的 lines 已排序 —— 排序是"两侧同形"的一部分,不是可选美化。
 */
export function normalizeGitEntries(text, source) {
  const parts = String(text ?? '')
    .split('\0')
    .filter((s) => s !== '')
  const lines = []
  let malformed = 0
  let droppedUnmerged = 0
  for (const p of parts) {
    const tab = p.indexOf('\t')
    if (tab < 0) {
      malformed++
      continue
    }
    const head = p.slice(0, tab)
    const path = p.slice(tab + 1)
    if (path === '') {
      malformed++
      continue
    }
    const cols = head.split(' ')
    let mode = ''
    let oid = ''
    if (source === 'ls-files') {
      if (cols.length < 3) {
        malformed++
        continue
      }
      const stage = cols[2]
      if (!/^\d$/.test(stage)) {
        malformed++
        continue
      }
      if (stage !== '0') {
        droppedUnmerged++
        continue
      }
      mode = cols[0]
      oid = cols[1]
    } else if (source === 'ls-tree') {
      if (cols.length < 3) {
        malformed++
        continue
      }
      mode = cols[0]
      // cols[1] 是 blob/tree/commit —— 剥掉它才与 ls-files 同形(这一步没有替代品)。
      oid = cols[2]
    } else {
      throw new Error(`normalizeGitEntries: 未知取材形态 ${String(source)}`)
    }
    if (!MODE_RE.test(mode) || !OID_RE.test(oid)) {
      malformed++
      continue
    }
    lines.push(`${mode} ${oid}\t${path}`)
  }
  lines.sort()
  return { lines, count: lines.length, malformed, droppedUnmerged }
}

/** 归一后取 sha256。**枚举到 0 条目不签发 digest**(空集合不得被当成"两侧相等")。 */
export function digestFromEntryText(text, source) {
  let n
  try {
    n = normalizeGitEntries(text, source)
  } catch (e) {
    return { ok: false, digest: null, count: 0, why: String(e?.message ?? e).slice(0, 160) }
  }
  if (n.count === 0) {
    return {
      ok: false,
      digest: null,
      count: 0,
      malformed: n.malformed,
      droppedUnmerged: n.droppedUnmerged,
      why: `枚举到 0 条目(malformed=${n.malformed},剔除 unmerged=${n.droppedUnmerged})⇒ 不签发 digest`,
    }
  }
  const digest = createHash('sha256')
    .update(`${n.lines.join('\n')}\n`, 'utf8')
    .digest('hex')
  return { ok: true, digest, count: n.count, malformed: n.malformed, droppedUnmerged: n.droppedUnmerged, why: null }
}

function gitText(args, root, timeout) {
  let git = ''
  try {
    git = resolveGitBin()
  } catch (e) {
    return { ok: false, why: `git 二进制解析不到:${String(e?.message ?? e).slice(0, 120)}` }
  }
  if (!git) return { ok: false, why: 'git 二进制解析不到(resolveGitBin 返回空)' }
  try {
    const out = execFileSync(git, ['-c', 'safe.directory=*', ...args], {
      cwd: root || REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeout || GIT_TIMEOUT_MS,
      // §12g:本机不写 stdio 会稳定 EBUSY(0/30 成功);这里没有 input ⇒ stdio[0] 恒 'ignore'。
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    })
    return { ok: true, text: out }
  } catch (e) {
    return { ok: false, why: `git ${args[0]} 取不到:${String(e?.message ?? e).slice(0, 160)}` }
  }
}

/** 记录侧:当次索引的树指纹(= 跑门那一刻"门看见的内容")。 */
export function indexTreeDigest({ root = REPO_ROOT } = {}) {
  const r = gitText(['ls-files', '--stage', '-z'], root)
  if (!r.ok) return { ok: false, digest: null, count: 0, why: r.why }
  return digestFromEntryText(r.text, 'ls-files')
}

/** 报告侧:某枚提交的树指纹(与 indexTreeDigest 同一条归一路径)。 */
export function treeDigestForCommit({ root = REPO_ROOT, sha = '' } = {}) {
  const s = String(sha).trim()
  if (s === '') return { ok: false, digest: null, count: 0, why: 'sha 为空 ⇒ 无从问 tree' }
  const r = gitText(['ls-tree', '-r', '--full-name', '-z', s], root)
  if (!r.ok) return { ok: false, digest: null, count: 0, why: r.why }
  return digestFromEntryText(r.text, 'ls-tree')
}

/** 本次索引相对 HEAD 有差异的路径清单(上限 DECLARED_FILES_CAP,超出只置标记不写全量)。 */
export function indexVsHeadPaths({ root = REPO_ROOT, cap = DECLARED_FILES_CAP } = {}) {
  const r = gitText(['diff', '--cached', '--name-only'], root)
  if (!r.ok) return { ok: false, files: [], truncated: false, why: r.why }
  const all = String(r.text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const truncated = all.length > cap
  return { ok: true, files: truncated ? all.slice(0, cap) : all, truncated, totalSeen: all.length, why: null }
}

function num(v, name) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new Error(`buildGateBatchRecord: ${name} 必须是非负有限数,实得 ${String(v)}`)
  return n
}

function gateList(arr, name, requiredKey) {
  if (!Array.isArray(arr)) throw new Error(`buildGateBatchRecord: ${name} 必须是数组`)
  return arr.map((g) => {
    if (!g || typeof g !== 'object') throw new Error(`buildGateBatchRecord: ${name} 的每一项必须是对象`)
    const id = String(g.id ?? '')
    if (id === '') throw new Error(`buildGateBatchRecord: ${name} 缺 id(逐道点名是这张表的全部价值)`)
    const val = String(g[requiredKey] ?? '')
    if (val === '')
      throw new Error(`buildGateBatchRecord: ${name} 的 [${id}] 缺 ${requiredKey}(没有名字的跳门事后无从归因)`)
    const out = { id, label: String(g.label ?? '') }
    out[requiredKey] = val
    if (Array.isArray(g.triggers)) out.triggers = g.triggers.map(String)
    return out
  })
}

/**
 * 纯函数:造一条批次留痕。不碰磁盘、不派生 git ⇒ 构造面可直接断言。
 * treeDigest 允许为 null(取不到时如实写 null,并带 treeDigestWhy),但**不得伪造**。
 */
export function buildGateBatchRecord(input = {}) {
  const mode = String(input.mode ?? '')
  if (mode !== 'staged' && mode !== 'full')
    throw new Error(`buildGateBatchRecord: mode 只能是 staged|full,实得 "${mode}"`)
  const totalChecks = num(input.totalChecks, 'totalChecks')
  const executed = num(input.executed, 'executed')
  const blockingFailed = num(input.blockingFailed, 'blockingFailed')
  if (executed > totalChecks)
    throw new Error(`buildGateBatchRecord: executed(${executed}) 不得大于 totalChecks(${totalChecks})`)
  const selfSkipped = gateList(input.selfSkipped ?? [], 'selfSkipped', 'skipEnv')
  const notTriggered = gateList(input.notTriggered ?? [], 'notTriggered', 'reason')
  const files = Array.isArray(input.declaredFiles) ? input.declaredFiles.map(String) : null
  if (files === null) throw new Error('buildGateBatchRecord: declaredFiles 必须是数组(取不到请传 [] 并带 declaredFilesWhy)')
  const truncated = input.declaredFilesTruncated === true || files.length > DECLARED_FILES_CAP
  const rec = {
    // ts 是 **epoch ms**(票面口径);既有四家的写者用 ISO 串,读侧两种都要认(见 readGateBatchRecords)。
    ts: Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now(),
    kind: GATE_BATCH_KIND,
    source: 'guardian-runner',
    mode,
    totalChecks,
    executed,
    blockingFailed,
    selfSkipped,
    notTriggered,
    // 批次留痕存在本身 = 这一轮门禁跑过 ⇒ gatesRun 恒 true,不得由调用方覆盖成 false。
    gatesRun: true,
    ranFullBatch: input.ranFullBatch === true,
    declaredFiles: truncated ? files.slice(0, DECLARED_FILES_CAP) : files,
    declaredFilesTruncated: truncated,
    declaredFilesTotalSeen: Number.isFinite(Number(input.declaredFilesTotalSeen))
      ? Number(input.declaredFilesTotalSeen)
      : files.length,
    treeDigest: typeof input.treeDigest === 'string' && /^[0-9a-f]{64}$/i.test(input.treeDigest) ? input.treeDigest : null,
    treeDigestWhy: input.treeDigest ? null : String(input.treeDigestWhy ?? '调用方未提供 treeDigest,也未说明原因'),
    // 步骤级门:数字是"扫得动的面上量到的命中",null = 该维未判定(绝不折成 0)。
    // null / 缺字段 = 该维未判定,原样留 null。Number(null) 是 0,直接走 isFinite 判会把"没扫到"写成 0 ——
    // 而 0 读起来像"这一维已核过且没有未声明跳过",正是本仓最高频的失效型。
    undeclaredSkipHits:
      input.undeclaredSkipHits === null ||
      input.undeclaredSkipHits === undefined ||
      !Number.isFinite(Number(input.undeclaredSkipHits))
        ? null
        : Number(input.undeclaredSkipHits),
    undeclaredSkipHitsUndetermined: Array.isArray(input.undeclaredSkipHitsUndetermined)
      ? input.undeclaredSkipHitsUndetermined.map((u) => ({
          file: String(u?.file ?? ''),
          why: String(u?.why ?? '').slice(0, 160),
        }))
      : [],
  }
  return rec
}

/**
 * 落一行批次留痕到同一本台账。**永不抛、永不影响调用方退出码**。
 * 追加写:绝不动既有行(该文件已被四个写者共用)。失败只回 {ok:false,why},由调用方响亮打出来。
 */
export function appendGateBatchRecord(input = {}) {
  try {
    const root = input.root ? resolve(input.root) : REPO_ROOT
    const rec = buildGateBatchRecord(input)
    const path = ledgerPath(root)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify(rec)}\n`)
    return { ok: true, path, record: rec }
  } catch (e) {
    return {
      ok: false,
      why: `${String(e?.message ?? e).slice(0, 220)} ⇒ 本轮守门批未落批次留痕 ⇒ 统计器会把这一枚留在 unknown(记账失败,不是仓库缺陷,但必须有人看见)`,
    }
  }
}

function toMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const ms = Date.parse(String(v ?? ''))
  return Number.isFinite(ms) ? ms : null
}

/**
 * 读侧:批次留痕专用(键名全量保留)。文件不存在 = `missing`,**不得**被调用方读成"没人跑过门"
 * —— 本 kind 是 2026-10-07 才出生的,之前的窗口里它本来就该是 0 条。
 */
export function readGateBatchRecords(root = REPO_ROOT) {
  const path = ledgerPath(root)
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    const code = String(e?.code ?? '')
    return {
      ok: false,
      state: code === 'ENOENT' ? 'missing' : 'unreadable',
      path,
      records: [],
      badLines: [],
      scannedLines: 0,
      why: `${code || '读失败'}:${String(e?.message ?? e).slice(0, 120)}`,
    }
  }
  const records = []
  const badLines = []
  let otherKinds = 0
  let scanned = 0
  text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .forEach((l, i) => {
      scanned++
      let o
      try {
        o = JSON.parse(l)
      } catch (e) {
        badLines.push({ n: i + 1, err: String(e?.message ?? e).slice(0, 80) })
        return
      }
      if (o === null || typeof o !== 'object' || Array.isArray(o)) {
        badLines.push({ n: i + 1, err: '顶层不是对象' })
        return
      }
      if (o.kind !== GATE_BATCH_KIND) {
        otherKinds++
        return
      }
      records.push({
        ms: toMs(o.ts),
        ts: o.ts ?? null,
        kind: GATE_BATCH_KIND,
        mode: typeof o.mode === 'string' ? o.mode : '',
        totalChecks: Number.isFinite(o.totalChecks) ? o.totalChecks : null,
        executed: Number.isFinite(o.executed) ? o.executed : null,
        blockingFailed: Number.isFinite(o.blockingFailed) ? o.blockingFailed : null,
        selfSkipped: Array.isArray(o.selfSkipped) ? o.selfSkipped : [],
        notTriggered: Array.isArray(o.notTriggered) ? o.notTriggered : [],
        undeclaredSkipHits: Number.isFinite(o.undeclaredSkipHits) ? o.undeclaredSkipHits : null,
        undeclaredSkipHitsUndetermined: Array.isArray(o.undeclaredSkipHitsUndetermined)
          ? o.undeclaredSkipHitsUndetermined
          : [],
        declaredFiles: Array.isArray(o.declaredFiles) ? o.declaredFiles.map(String) : [],
        declaredFilesTruncated: o.declaredFilesTruncated === true,
        gatesRun: o.gatesRun === true,
        ranFullBatch: o.ranFullBatch === true,
        // 没有 treeDigest 的记录 = 绑不上任何提交 ⇒ 由调用方计成 batchNoDigest 并点名,不得静默。
        treeDigest:
          typeof o.treeDigest === 'string' && /^[0-9a-f]{64}$/i.test(o.treeDigest) ? o.treeDigest.toLowerCase() : null,
        treeDigestWhy: typeof o.treeDigestWhy === 'string' ? o.treeDigestWhy : '',
        source: typeof o.source === 'string' ? o.source : '',
      })
    })
  return { ok: true, state: 'read', path, records, badLines, otherKinds, scannedLines: scanned, why: null }
}

/**
 * 步骤级门的"未声明跳过命中":runner 之后那批独立步骤自带的 HUSKY_SKIP_*,
 * 名字不在 runner 注册表的 skipEnv 清单里、而当次环境变量为 1 ⇒ 计一次命中。
 * 某个面读不到 ⇒ 该面落 undetermined 并点名,**不得**把"看不见"折成 0。
 */
export function stepLevelSkipHits({
  root = REPO_ROOT,
  declared = [],
  env = process.env,
  faces = STEP_LEVEL_FACES,
  readFile = (p) => readFileSync(p, 'utf8'),
} = {}) {
  const declaredSet = new Set((Array.isArray(declared) ? declared : []).map(String))
  const hits = []
  const undetermined = []
  for (const rel of faces) {
    let text
    try {
      text = String(readFile(join(root, rel)))
    } catch (e) {
      undetermined.push({ file: rel, why: `${String(e?.code ?? '读失败')}:${String(e?.message ?? e).slice(0, 100)}` })
      continue
    }
    const names = new Set(text.match(SKIP_ENV_RE) ?? [])
    for (const name of names) {
      if (declaredSet.has(name)) continue
      if (String(env?.[name] ?? '') !== '1') continue
      hits.push({ name, file: rel })
    }
  }
  return { ok: undetermined.length === 0, hits, count: hits.length, undetermined }
}

/** 测试通道:镜像测试**禁止复制判据**,一律经本对象取生产入口(§22c)。 */
export const __test__ = {
  normalizeGitEntries,
  digestFromEntryText,
  buildGateBatchRecord,
  appendGateBatchRecord,
  readGateBatchRecords,
  stepLevelSkipHits,
  indexTreeDigest,
  treeDigestForCommit,
  indexVsHeadPaths,
  GATE_BATCH_KIND,
  DECLARED_FILES_CAP,
  STEP_LEVEL_FACES,
  LEDGER_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
