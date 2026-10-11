// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跳门 / 旁路落地留痕的**唯一出口**(G-725,2026-09-29 立)。
 *
 * 要补的那一格(AGENTS §12f 的那句话此前答不出):
 *   「跳门次数只有一个真值来源:`.workbuddy/safe-commit-attestation.jsonl`」—— 但只有 `safe-commit.mjs`
 *   **决定跳门**时才往它写行。于是两类提交在账面上同形:① 过了全部门禁的正常提交(不写行),
 *   ② 走对象空间旁路的提交(commit-tree + CAS,**根本不跑钩子**,也不写行)。结果"有多少提交是在检查
 *   未跑的状态下入库的"这个问题无法回答 —— 2026-09-29 现读:该台账自当日零点起 0 条,而同一窗口
 *   非合并提交 222 枚。把"0 条"读成"今天没人绕门",正是本模块要消灭的误读。
 *
 * 三条不可动摇的口径:
 *   1. **只建一份实现,且落在同一本台账**:文件路径与键名都取自 `safe-commit.mjs:673-691` 那一次既有
 *      落盘(同一批键名 ts/kind/reason/failedGates/declaredFiles/headBefore/batchSelfRun/selfRunOk/
 *      blockerBeforeBatch),只**追加**两个本类记录才有的键:`gatesRun`(恒 false,旁路不跑门禁)与
 *      `landedSha`(把留痕绑到具体那枚提交 —— safe-commit 那本只有 `headBefore`,绑不上 sha 就统计不了)。
 *      刻意**不改** safe-commit 的写法:它的镜像测试
 *      (`scripts/tests/safe-commit-gate-attribution.test.mjs:583`)钉的是"该文件里 `appendFileSync(`
 *      恰好出现 1 次",抽走它就把别人那条锁弄红,而那是他人持有的判据。
 *   2. **写留痕绝不改变落地成败**:`recordBypassLanding()` 全程 try/catch,只回 `{ok, why}`,绝不抛、
 *      绝不改退出码(它判的是记账,不是门禁;一次成功落地不得因为记账写失败而变红)。
 *   3. **读侧也只有一个解析出口**:`readLedgerRecords()` 把坏行 / 取不到文件分开如实报出,
 *      调用方(统计脚本)不得把"解不出"当成"没有"。
 *
 * 用法(只建出口,不做判据,不进提交链):
 *   import { recordBypassLanding } from './lib/commit-attestation.mjs'
 *   const rec = recordBypassLanding({ root, source: 'object-space-land', landedSha, headBefore, declaredFiles })
 *   if (!rec.ok) console.log(`⚠️ 留痕未写入:${rec.why}`)   // 一行 WARN,不红
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 台账相对路径 —— 全仓唯一,不得在任何调用方再拼一次(拼两份就是两份真相)。 */
export const LEDGER_REL = join('.workbuddy', 'safe-commit-attestation.jsonl')

/** 本类记录的 kind(统计侧靠它把"旁路"与"跳门"分开;与 safe-commit 的 kind 族互不重叠)。 */
export const BYPASS_KIND = 'bypass-landing'

/**
 * G-1118437:`gates-then-commit` —— safe-commit 在 Step 5 判"提交只含预期文件"**之后**写的 sha 绑定正证。
 * 语义与 BYPASS_KIND 正好相反(一个说"钩子跑了且没红",一个说"钩子根本没跑"),所以是**独立一族**、
 * 不并进任何一张既有索引。`gatesRan:false`(用了 --no-verify)的记录统计侧直接不收 —— 它不是正证。
 */
export const COMMITTED_KIND = 'gates-then-commit'

/** 默认原因:写清楚"为什么这一枚的门禁没跑",而不是留一个空串让人猜。 */
export const DEFAULT_BYPASS_REASON =
  '旁路落地(commit-tree + CAS)不触发钩子 ⇒ 提交链上的门禁对本枚未执行'

export function ledgerPath(root = REPO_ROOT) {
  return resolve(root, LEDGER_REL)
}

/**
 * 纯函数:造一条旁路留痕(键名逐字对齐 safe-commit 那本)。
 * 不碰磁盘、不取时钟以外的东西 —— 构造面因此可被测试直接断言。
 */
export function buildBypassRecord({
  source,
  landedSha,
  headBefore,
  declaredFiles,
  reason = DEFAULT_BYPASS_REASON,
  nowIso = new Date().toISOString(),
  watermarkSkipped = false,
} = {}) {
  const sha = String(landedSha ?? '')
  if (sha === '') throw new Error('buildBypassRecord: landedSha 不能为空(留痕必须绑到具体提交)')
  if (!Array.isArray(declaredFiles) || declaredFiles.length === 0)
    throw new Error('buildBypassRecord: declaredFiles 必须是非空数组(空路径清单不该落地,更不该留痕)')
  const src = String(source ?? '')
  if (src === '') throw new Error('buildBypassRecord: source 必须点名是哪个落地器(否则事后无从归因)')
  return {
    ts: nowIso,
    kind: BYPASS_KIND,
    // 旁路一律 gatesRun:false —— 这一维就是本票要量的东西,不得由调用方覆盖成 true。
    gatesRun: false,
    ranFullBatch: false,
    reason: String(reason || DEFAULT_BYPASS_REASON) + (watermarkSkipped ? ';水印预检亦被跳过' : ''),
    failedGates: [],
    declaredFiles: declaredFiles.map(String),
    headBefore: String(headBefore ?? ''),
    landedSha: sha,
    source: src,
    batchSelfRun: false,
    selfRunOk: false,
    blockerBeforeBatch: null,
    // G-1058649 态⑤ 那三键在 safe-commit 那一本里后来加上了。旁路留痕**结构上没有**这些事实
    // (它不跑批、不做归因降级、也没有"哪一步环境性失败"),所以取"无从有"的字面值而不是省略键:
    // 同一本台账只许有一种形状 —— 少写一键,统计器读到的就是两种 schema,而"哪一格没记"与
    // "那一格为假"在 JSONL 上长得一模一样(与本仓"把没判写成判过了"同一条禁令)。
    envStep: null,
    envFingerprint: null,
    downgradedFromMine: false,
  }
}

/**
 * 落一行留痕。**永不抛、永不影响调用方的退出码**。
 * 返回 {ok:true,path} 或 {ok:false,why}(why 是要打给人看的那一行原因,不编造)。
 */
export function recordBypassLanding(input = {}) {
  try {
    const root = input.root ? resolve(input.root) : REPO_ROOT
    const rec = buildBypassRecord(input)
    const path = ledgerPath(root)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify(rec)}\n`)
    return { ok: true, path, record: rec }
  } catch (e) {
    return {
      ok: false,
      why: `${String(e?.message ?? e).slice(0, 220)} ⇒ 旁路落地未进台账,总量统计会把这一维算成未判定`,
    }
  }
}

/**
 * 纯函数:造一条 **sha 绑定正证**(G-1118437)—— safe-commit 在 Step 5 核对"提交只含预期文件"之后写。
 * 与旁路留痕的分工:`bypass-landing` 说"这枚**没跑**门禁",本条说"这枚**跑了**门禁且钩子没跳过"。
 * `gatesRan:false`(用了 --no-verify)仍然落盘,但统计侧按设计不收它为正证 —— 落而不认,
 * 比不落更好:事后能分清"跑了门"与"绕了门",而不是两条都读成"没证据"。
 */
export function buildCommittedRecord({
  landedSha,
  headBefore,
  commitFiles,
  declaredFiles,
  gatesRan,
  hookSkipped = false,
  nowIso = new Date().toISOString(),
} = {}) {
  const sha = String(landedSha ?? '')
  if (sha === '') throw new Error('buildCommittedRecord: landedSha 不能为空(正证必须绑到具体提交)')
  if (!Array.isArray(commitFiles)) throw new Error('buildCommittedRecord: commitFiles 必须是数组(空数组是合法形态:纯删除前的空提交)')
  return {
    ts: nowIso,
    kind: COMMITTED_KIND,
    landedSha: sha,
    headBefore: String(headBefore ?? ''),
    commitFiles: commitFiles.map(String),
    declaredFiles: (Array.isArray(declaredFiles) ? declaredFiles : []).map(String),
    gatesRan: gatesRan === true,
    hookSkipped: hookSkipped === true,
  }
}

/** 落一行 sha 绑定正证。**永不抛**(与 recordBypassLanding 同一条契约:留痕不得影响提交)。 */
export function recordGatesThenCommit(input = {}) {
  try {
    const root = input.root ? resolve(input.root) : REPO_ROOT
    const rec = buildCommittedRecord(input)
    const path = ledgerPath(root)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify(rec)}\n`)
    return { ok: true, path, record: rec }
  } catch (e) {
    return {
      ok: false,
      why: `${String(e?.message ?? e).slice(0, 220)} ⇒ 这一枚拿不到"跑过门"的一方正证,统计器会把它留在 unknown`,
    }
  }
}

/**
 * 读侧唯一出口:把台账解成记录数组,并把三类"看不见"分开报出 ——
 *   - missing:文件不存在(从未写过 ⇒ 不代表没人绕门,只代表没人写)
 *   - unreadable:存在但读不到(权限/占用)
 *   - badLines:逐行 JSON 解不出(行号 + 短错因,**不静默丢弃**)
 * 好行只保留统计需要的字段,未知键忽略(前向兼容 safe-commit 以后再加字段)。
 */
export function readLedgerRecords(root = REPO_ROOT) {
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
      why: `${code || '读失败'}:${String(e?.message ?? e).slice(0, 120)}`,
    }
  }
  const records = []
  const badLines = []
  text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .forEach((l, i) => {
      let o
      try {
        o = JSON.parse(l)
      } catch (e) {
        badLines.push({ n: i + 1, err: String(e?.message ?? e).slice(0, 80) })
        return
      }
      if (o === null || typeof o !== 'object' || Array.isArray(o)) {
        badLines.push({ n: i + 1, err: `顶层不是对象(实得 ${Array.isArray(o) ? 'array' : String(o).slice(0, 20)})` })
        return
      }
      const ms = Date.parse(String(o.ts ?? ''))
      records.push({
        ms: Number.isFinite(ms) ? ms : null,
        ts: String(o.ts ?? ''),
        kind: typeof o.kind === 'string' ? o.kind : '(缺 kind)',
        gatesRun: o.gatesRun === true,
        // G-1118437:`gatesRan` / `commitFiles` 必须在这份白名单里 —— 读侧只留白名单字段,
        // 少留一个就等于把"跑过门"这件事在读侧抹掉,而写侧与自检都各自绿(自检是直接把对象喂进
        // indexLedger 的,根本不经过这里)。这一格由镜像测试的"写→读 round-trip"钉住。
        gatesRan: o.gatesRan === true,
        commitFiles: Array.isArray(o.commitFiles) ? o.commitFiles.map(String) : [],
        ranFullBatch: o.ranFullBatch === true,
        declaredFiles: Array.isArray(o.declaredFiles) ? o.declaredFiles.map(String) : [],
        headBefore: typeof o.headBefore === 'string' ? o.headBefore : '',
        landedSha: typeof o.landedSha === 'string' ? o.landedSha : '',
        source: typeof o.source === 'string' ? o.source : '',
      })
    })
  return { ok: true, state: 'read', path, records, badLines, why: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
