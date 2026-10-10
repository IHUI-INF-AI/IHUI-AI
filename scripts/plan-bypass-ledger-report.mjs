#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旁路落地 / 跳门总量统计(`G-725`,**只读量算仪**,不是判据,不进提交链)。
 *
 * 要回答的那句话(AGENTS §12f):"有多少提交是在检查未跑的状态下入库的?"
 * 此前答不出 —— 台账 `.workbuddy/safe-commit-attestation.jsonl` 只有 `safe-commit.mjs` **决定跳门**时
 * 才写行,于是"过了全部门禁的正常提交"与"根本不跑钩子的旁路提交"在账面上同形(2026-09-29 现读:
 * 当日零点起 0 条,而同一窗口非合并提交 222 枚)。本器把四态拆开:
 *
 *   normal         —— 有**正证**说门禁跑过且没红:该提交的文件集合与钩子日志里某一轮 `staged 文件清单`
 *                     回显逐字等值,且那一轮的批量汇总 `失败: 0`。
 *   skipped        —— 台账里有一条跳门留痕(safe-commit 写的 kind ∈ {not-ours/unattributed/…}),其
 *                     `headBefore` 等于该提交的父 ⇒ 这枚提交是在检查未跑的状态下入库的。
 *   bypass-landing —— 台账里 kind=bypass-landing 且 `landedSha` 等于该提交(commit-tree + CAS 旁路落地,
 *                     由 `scripts/lib/commit-attestation.mjs` 写)。
 *   unknown        —— 三条正证一条都拿不到。**不得**并进 normal,也不得并进 skipped。
 *                     2026-09-30 起再按**引用事务见证**(`.husky/reference-transaction` 在 committed
 *                     阶段落的 sha —— `--no-verify` 跳不掉它)拆三格:本机可疑 / 别机或更早 / 无从分。
 *                     见证**不能单独证明跳门**(跑了门但回显不逐字等值时同样无匹配轮),
 *                     所以这里只产出"该逐枚去读哪几枚"的名单,不产出指控。
 *   ran-with-self-skip —— (G-1059139 新增第五态)有当轮**批次留痕**(`kind=gate-batch-run`,由
 *                     `scripts/guardian-runner.mjs` 经 `scripts/lib/attestation-tree-digest.mjs` 落账)
 *                     且该留痕 `selfSkipped` 非空 ⇒ 这枚"门确实跑过,但有 N 道按名字跳了"。
 *                     它补的是旧四态答不出的一格:"跑了 214 道、跳了 3 道"与"整批根本没跑"在两行文本上
 *                     完全同形(都落 unknown)。绑定钥匙是 `treeDigest`(归一只有一份实现):
 *                     记录侧 `git ls-files --stage -z`(剔 unmerged)↔ 报告侧
 *                     `git ls-tree -r --full-name -z <sha>`(剥掉 `blob/tree/commit` 类型字段),
 *                     两侧经同一个 `normalizeGitEntries()` 归一、排序后取 sha256。
 *                     **批次跑了且 selfSkipped 为空 ⇒ 归 normal(那是一条正证,不是新债)。**
 *                     三条"宁可少归一类"的边界:同一 digest 命中窗口内多枚 ⇒ 落"无从分"计数
 *                     (`unknownBatchAmbiguous`,是 unknown 的**第四格**,不吞原有三格);同一 digest 有多条
 *                     批次留痕而在"有没有自跳"上不一致 ⇒ 不判新态;完全找不到 ⇒ **维持原态**。
 *                     **能力上限(必须跟读数一起说)**:记录侧取的是**跑门那一刻的索引面**。若 lint-staged
 *                     改写过暂存内容、或 pre-commit 之后有人又动过索引,那一枚落地的 tree 与批次 digest
 *                     不等 ⇒ 维持原态(通常仍是 unknown)。这是**正确行为**,不是待修的洞 —— 错归一类等于
 *                     给一台没跑门的机器发合格证。这一维由 `unboundReasons` 逐档量化并点名。
 *
 * 三条不可动摇的口径:
 *   1. **取不到就说"未判定"并点名原因,绝不用 0 冒充结论**:台账文件不存在(missing)≠ 今天没人绕门;
 *      钩子日志现在**整档流式读**(64 MB 内不截断 ⇒ normal 不再是下界),超上限才退回读尾部并大声报
 *      被跳过的字节数;提交清单另有 `coverage` 自证 —— 取数没走到窗口最早那一天就明说"下面的枚数是下界"。
 *   2. **合并不算"检查未跑"**:并集合并的两侧已被计入,本器单列一枚数,不混进总量。
 *   3. **只读**:不写盘、不改任何 ref、不跑构建;派生一律带 timeout(守门 80)与 windowsHide(守门 52)。
 *
 * 用法:node scripts/plan-bypass-ledger-report.mjs [--days N|--since YYYY-MM-DD [--until YYYY-MM-DD]]
 *                                                  [--json] [--root DIR] [--self-test] [--limit N]
 * 退出码:0 = 报告已产出(有未判定也是 0 —— 它是量算仪,不阻断任何东西);1 = --self-test 有失败例;
 *         2 = 脚本自身异常(取数层抛出,不是业务结论)。
 */
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { git } from './lib/bypass-git.mjs'
import { BYPASS_KIND, COMMITTED_KIND, readLedgerRecords } from './lib/commit-attestation.mjs'
// G-1059139:批次留痕(kind=gate-batch-run)的读侧与同一份 treeDigest 归一出口。
// 刻意不复用 readLedgerRecords —— 它有字段白名单,会整块丢掉本 kind 的 treeDigest/selfSkipped;
// 台账路径仍只有 `commit-attestation.mjs` 一份出口(本 lib 从它 import ledgerPath)。
import {
  GATE_BATCH_KIND,
  readGateBatchRecords,
  treeDigestForCommit,
} from './lib/attestation-tree-digest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/**
 * 钩子日志一次读的上限:真仓该文件现读约 8 MB,旧上限 4 MB 把 normal 永久做成下界。
 * 64 MB 之内**整档流式读**(不整档进内存);只有超上限才退回读尾部,并把被跳过的字节数报出来。
 */
const HOOK_READ_CAP_BYTES = 64 * 1024 * 1024
/** 见证文件一行约 50 B,64 MB 已够几百万枚;超上限只读前一段并如实报名。 */
const WITNESS_CAP_BYTES = 64 * 1024 * 1024
const DAY_MS = 86_400_000
/**
 * 取数深度。旧缺省 3000 在本仓**两天窗口**就不够(09-29/30 两天非合并提交 1459 枚,加上合并
 * 与更早的日子会直接吃满)—— 吃满不是错误,是必须被报出来的状态,所以覆盖面判据住在
 * `collectCommits` 的 `coverage` 里,而不是把 limit 调大就当没事。
 */
const LOG_LIMIT_DEFAULT = 20_000
/**
 * 批次留痕的 treeDigest 补算上限(只对"没有任何正证"的枚算)。
 * 触顶不静默:计进 unboundReasons.capped 并大声报"这一维是下界"。
 */
const DIGEST_CAP_DEFAULT = 600

const dayKey = (iso) => String(iso ?? '').slice(0, 10)

/**
 * 台账 → 三张索引。纯函数,构造面可直接断言。
 *   bypass:  landedSha → 记录
 *   skip:    headBefore(= 那枚提交的父) → 记录数组(同父多枚时按作者时刻取最近的一条)
 *   mine:    safe-commit 判"本任务自己的红"⇒ 拒绝跳门、不落地面 ⇒ 不得被读成 skipped
 */
export function indexLedger(records = []) {
  const bypass = new Map()
  const skip = new Map()
  const committed = new Map()
  let mine = 0
  let bypassNoSha = 0
  let skipNoParent = 0
  let committedRejectedNoGate = 0
  let committedRejectedNoSha = 0
  for (const r of records) {
    if (r.kind === BYPASS_KIND) {
      if (r.landedSha) bypass.set(r.landedSha, r)
      else bypassNoSha++ // kind 对得上却绑不到 sha ⇒ 形同没写,必须报数(否则静默丢一条旁路)
      continue
    }
    // G-1118437:`gates-then-commit` 是 safe-commit 在 Step 5 判"干净"之后写的 **sha 绑定正证**
    // (钩子没跳过 ∧ 提交成功 ⇒ pre-commit 全绿)。它与 bypass-landing 同为"按 landedSha 绑这一枚",
    // 但语义相反(一个说"跑了门",一个说"没跑门"),所以**另立一张表**,绝不并进 skip/bypass。
    // `gatesRan` 为 false 的记录(用了 --no-verify)按设计不进这张表 ⇒ 它永远不会被读成正证。
    if (r.kind === COMMITTED_KIND) {
      if (r.landedSha && r.gatesRan === true) committed.set(r.landedSha, r)
      else if (r.landedSha) committedRejectedNoGate++
      else committedRejectedNoSha++
      continue
    }
    if (r.kind === 'mine') {
      mine++
      continue
    }
    if (r.headBefore) {
      const list = skip.get(r.headBefore) || []
      list.push(r)
      skip.set(r.headBefore, list)
    } else skipNoParent++
  }
  return { bypass, skip, committed, mine, bypassNoSha, skipNoParent, committedRejectedNoGate, committedRejectedNoSha }
}

/**
 * 剥 ANSI 色码。钩子日志是**带色**落盘的(汇总行原文即 `  <ESC>[31m失败: 1<ESC>[0m`),不剥色 ⇒
 * 行首锚点永不成立 ⇒ 一轮都找不到 ⇒ normal 恒 0,而账面读起来像"今天没有一个提交过门"。
 * 这是"把没判写成判过了"那一型,不是格式偏好。
 */
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

export function stripAnsi(s) {
  return String(s ?? '').replace(ANSI_RE, '')
}

/** 钩子日志 → 轮次收集器(逐行喂,给整档流式读用)。 */
export function roundCollector() {
  const rounds = []
  let pending = null
  let collecting = false
  return {
    feed(raw) {
      const l = String(raw ?? '').trim()
      // 回显行真形态是 `ℹ️  staged 文件清单(6 个):`(带前缀与全角冒号前的空格),不锚行首。
      const echo = l.match(/staged 文件清单\((\d+) 个\)[:：]\s*$/)
      if (echo) {
        pending = { files: [], declared: Number(echo[1]), failed: null }
        collecting = true
        return
      }
      if (pending && collecting) {
        const f = l.match(/^-\s+(\S.*)$/)
        if (f) {
          pending.files.push(f[1].trim())
          return
        }
        if (l !== '') collecting = false // 清单块结束:后面的 `- xxx` 属于别的块,不得混进来
      }
      const sum = l.match(/^失败:\s*(\d+)/)
      if (sum && pending) {
        pending.failed = Number(sum[1])
        rounds.push(pending)
        pending = null
        collecting = false
      }
    },
    finish() {
      return rounds
    },
  }
}

/** 钩子日志 → 轮次数组:每轮 = 一次 `staged 文件清单` 回显 + 其后**第一个**批量汇总的失败数。 */
export function parseHookRounds(text) {
  const c = roundCollector()
  for (const line of stripAnsi(text).split(/\r?\n/)) c.feed(line)
  return c.finish()
}

/** 该提交能否被某一轮"门跑过且没红"正证到?命中即消费该轮(一轮只给一枚提交作保)。 */
export function matchNormalRound(commit, rounds) {
  const mine = [...commit.files].sort().join('\n')
  for (const r of rounds) {
    if (r.consumed || r.failed !== 0) continue
    if ([...r.files].sort().join('\n') === mine && mine !== '') {
      r.consumed = true
      return r
    }
  }
  return null
}

/**
 * 批次留痕 → 按 treeDigest 的索引(纯函数)。
 * 没有 digest 的记录单独计数(`noDigest`)并保留原因 —— 它们绑不上任何提交,
 * 但"有一轮跑了却没绑上"与"根本没有这一轮"是两件事,不得混成 0。
 */
export function indexBatchRuns(records = []) {
  const byDigest = new Map()
  let noDigest = 0
  for (const r of records) {
    if (r.kind !== GATE_BATCH_KIND) continue
    if (!r.treeDigest) {
      noDigest++
      continue
    }
    const d = String(r.treeDigest).toLowerCase()
    const list = byDigest.get(d) || []
    list.push(r)
    byDigest.set(d, list)
  }
  return { byDigest, noDigest, records: records.length }
}

/**
 * 这一枚能否被批次留痕定态?只认**唯一、且结论一致**的绑定。
 * 返回值 verdict ∈ { 'self-skip' | 'normal' | 'ambiguous' | 'none' }:
 *   none      —— 没有批次面 / 取不到 digest / 面上找不到 ⇒ **维持原态**(绝不判新态)。
 *   ambiguous —— 同一 digest 命中窗口内多枚,或同一 digest 的多条留痕在"有没有自跳"上不一致
 *                ⇒ 落"无从分",既不发合格证也不指控(错归一类的代价 = 给没跑门的机器发证)。
 * 纯函数:digest 由调用方(run)喂进来,本器不在判据里派生 git。
 */
export function decideBatch(commit, batch) {
  if (!batch || batch.available !== true)
    return { verdict: 'none', note: batch && batch.state ? `批次台账${batch.state}` : '批次面未提供', records: 0 }
  const d = batch.digestBySha && batch.digestBySha.get(commit.sha)
  if (!d)
    return {
      verdict: 'none',
      note: `treeDigest 未取到:${(batch.reasonBySha && batch.reasonBySha.get(commit.sha)) || '不在补算范围'}`,
      records: 0,
    }
  const sameTree = (batch.commitCountByTree && batch.commitCountByTree.get(commit.tree)) || 1
  if (sameTree > 1)
    return {
      verdict: 'ambiguous',
      why: `同一 treeDigest 命中窗口内 ${sameTree} 枚(同 tree 的多枚提交分不出哪条留痕属于谁)⇒ 无从分`,
      records: 0,
    }
  const recs = (batch.byDigest && batch.byDigest.get(d)) || []
  if (recs.length === 0)
    return { verdict: 'none', note: '批次面里没有这一枚的 digest(索引面与落地 tree 不等 ⇒ 按设计不绑)', records: 0 }
  const empty = recs.filter((r) => (r.selfSkipped || []).length === 0).length
  if (empty === recs.length)
    return { verdict: 'normal', note: `批次留痕 ${recs.length} 条、无按名字自跳 ⇒ 正证`, records: recs.length }
  if (empty === 0) {
    const names = new Set()
    for (const r of recs) for (const g of r.selfSkipped || []) names.add(`${g.id}:${g.skipEnv}`)
    return {
      verdict: 'self-skip',
      gateCount: names.size,
      gates: [...names],
      note: `${recs.length} 条批次留痕一致:${names.size} 道按名字自跳`,
      records: recs.length,
    }
  }
  return {
    verdict: 'ambiguous',
    why: `同一 digest 的 ${recs.length} 条批次留痕在"有没有自跳"上不一致(空/非空并存)⇒ 不判新态`,
    records: recs.length,
  }
}

/**
 * 逐枚提交定五态。纯函数:输入 = 提交数组 + 台账索引 + 钩子轮次 + 批次上下文 + 三个"取不到"开关。
 * 返回按日聚合的行与逐枚明细,**任何一维取不到都记进 unknown 并带上原因**(不并桶)。
 */
export function classifyAll({
  commits = [],
  index = { bypass: new Map(), skip: new Map(), mine: 0, other: 0 },
  rounds = [],
  ledgerReadable = true,
  ledgerState = 'read',
  roundsAvailable = true,
  witness = null,
  firstParty = null,
  batch = null,
} = {}) {
  const detail = []
  const byDay = new Map()
  for (const c of commits) {
    let state
    let why = ''
    let sub = ''
    let proof = ''
    if (index.bypass.has(c.sha)) {
      state = 'bypass-landing'
    } else if (index.committed?.has(c.sha)) {
      // **sha 绑定正证优先于"按父绑定"的一切**:旧的一条一方正证要求 `headBefore == 提交父`,
      // 而多席并发下 pre-commit 与真正落地之间 HEAD 会被别人推进 —— 实测 294 条轮次记录里
      // 16 条 gatesRan∧gatesPassed **命中父集 0 条**,即"跑过门的正常提交也拿不到合格证"。
      // 这张表由 safe-commit 在 Step 5(已核对提交内容只含预期文件)之后写 ⇒ 它是这一枚的证据。
      state = 'normal'
      proof = 'safe-commit-landed'
      why = `Step 5 已核对提交文件集 ⊆ 声明集(${(index.committed.get(c.sha).commitFiles ?? []).length} 个)且钩子未跳过`
    } else {
      const cand = (index.skip.get(c.parent) || []).filter(
        (r) => c.ms === null || r.ms === null || Math.abs(r.ms - c.ms) <= 6 * 3600_000,
      )
      if (cand.length === 1) state = 'skipped'
      else if (cand.length > 1) {
        // 同父多条跳门留痕(空提交/重试)⇒ 时间序最近的一条才算这枚
        cand.sort((a, b) => Math.abs(a.ms - c.ms) - Math.abs(b.ms - c.ms))
        state = 'skipped'
        why = `同父 ${index.skip.get(c.parent).length} 条留痕,按时刻取最近一条`
      } else {
        const matched = matchFirstPartyRound(c, firstParty?.rounds ?? [])
        if (matched) {
          // 一方记录(钩子自报)排在回显之前:它是钩子当场写下的,而回显要过"逐字等值"这道脆条件。
          // G-978004 ②:声明集与落地面多重集等值的轮带 strongDeclared,比 ⊆ 弱证高一档,两档分开计数。
          state = 'normal'
          proof = matched.strongDeclared ? 'round-record-declared' : 'round-record'
        } else if (matchNormalRound(c, rounds)) {
          state = 'normal'
          proof = 'hook-echo'
        } else {
        // 第五态只在"前三条正证一条都没有"时才问 —— 它绝不抢已有正证,更不会把 unknown 吞掉。
        const b = decideBatch(c, batch)
        if (b.verdict === 'self-skip') {
          state = 'ran-with-self-skip'
          proof = 'gate-batch-run'
          why = b.note
        } else if (b.verdict === 'normal') {
          // 批次跑了且 selfSkipped 为空 ⇒ 这是一条**正证**,归 normal,不是新债、也不另立一态。
          state = 'normal'
          proof = 'gate-batch-run'
        } else if (b.verdict === 'ambiguous') {
          state = 'unknown'
          sub = 'batch-ambiguous'
          why = `${b.why};这是 unknown 的**第四格**,不并入原有三格`
        } else {
        state = 'unknown'
        why = !ledgerReadable
          ? `台账取不到(${ledgerState})`
          : !roundsAvailable
            ? '钩子轮次取不到 ⇒ normal 无从正证'
            : '无旁路留痕、无跳门留痕、无逐字等值的零失败钩子轮'
        why += `;批次绑定:${b.note}`
        // 把 unknown 拆成可行动的两格(第一次)。**措辞刻意不指控**:有见证只说明"这台机发生过一次
        // refs/heads 变更",而"跑了门但文件回显不逐字等值"(并发会话同窗口 staged、lint-staged 改写过
        // 文件)与"根本没跑"在两行文本上同形 ⇒ 只说「可疑」,定它得去读那一枚的钩子日志。
        if (witness && witness.ok) {
          sub = witness.shas.has(c.sha) ? 'witnessed' : 'unwitnessed'
          why +=
            sub === 'witnessed'
              ? ';本机有引用事务见证 ⇒ 可疑(跑了门而回显不等值 / 或根本没跑,需人工读那一轮)'
              : ';本机无见证 ⇒ 别机或更早产生,无从判断'
        } else if (witness) {
          sub = 'unsplittable'
          why += `;见证文件取不到(${witness.state})⇒ 本机/别机这一维**无从分**,不得读成"全部无见证"`
        }
        }
        }
      }
    }
    const day = c.day
    if (!byDay.has(day))
      byDay.set(day, {
        day,
        normal: 0,
        ranWithSelfSkip: 0,
        skipped: 0,
        bypassLanding: 0,
        unknown: 0,
        // unknown 的三个子格(只在 unknown 里加,不动四态本身 —— 四态口径是 AGENTS §12f 定的,
        // 换它等于改判据;这一层只是把"无从下手"变成"可以逐枚去读"。）
        unknownWitnessed: 0,
        unknownUnwitnessed: 0,
        unknownUnsplittable: 0,
        unknownBatchAmbiguous: 0,
        normalByRecord: 0,
        normalByEcho: 0,
        normalByBatch: 0,
        total: 0,
      })
    const row = byDay.get(day)
    row.total++
    if (state === 'normal') {
      row.normal++
      if (proof === 'round-record') row.normalByRecord++
      else if (proof === 'gate-batch-run') row.normalByBatch++
      else row.normalByEcho++
    } else if (state === 'skipped') row.skipped++
    else if (state === 'ran-with-self-skip') row.ranWithSelfSkip++
    else if (state === 'bypass-landing') row.bypassLanding++
    else {
      row.unknown++
      if (sub === 'batch-ambiguous') row.unknownBatchAmbiguous++
      else if (sub === 'witnessed') row.unknownWitnessed++
      else if (sub === 'unwitnessed') row.unknownUnwitnessed++
      else if (sub === 'unsplittable') row.unknownUnsplittable++
    }
    detail.push({ sha: c.sha.slice(0, 11), day, state, sub, proof, why })
  }
  return { rows: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)), detail }
}

/**
 * 钩子日志 → 轮次(整档**流式**读,不整档进内存)。
 *
 * 为什么不是"读尾部若干 MB":旧写法把 normal 永久做成下界(真仓该文件 7.9 MB,4 MB 上限 ⇒ 前面
 * 3.75 MB 的一轮都没见过),而"有多少提交在检查全废状态下入库"这句话要的恰恰是**全量**。
 * 现在只在超过 `capBytes`(64 MB)时才退回读尾部,并且**大声报出被跳过的字节数** ——
 * 失效方向是"少认一些 normal"(宁可多报 unknown),绝不是"把没看见写成看见"。
 */
export function readHookRounds(path, { capBytes = HOOK_READ_CAP_BYTES, chunkBytes = 1024 * 1024 } = {}) {
  let fd
  try {
    fd = openSync(path, 'r')
  } catch (e) {
    return {
      ok: false,
      state: e?.code === 'ENOENT' ? 'missing' : 'unreadable',
      why: String(e?.message ?? e).slice(0, 120),
      rounds: [],
    }
  }
  try {
    const size = fstatSync(fd).size
    const from = Math.max(0, size - capBytes)
    const skippedBytes = from // 只在超上限时 > 0:跳的是**开头**,尾部(当轮窗口要的)永远读得到
    const collector = roundCollector()
    const buf = Buffer.alloc(Math.min(chunkBytes, Math.max(1, size - from)))
    // StringDecoder 而非 buf.toString:分块边界会切在多字节字符中间(日志里全是中文),
    // 裸 toString 会把它变成 U+FFFD —— 那正是守门 164 扫的那型损坏,不该由一把量尺自己造出来。
    const dec = new StringDecoder('utf8')
    let off = from
    let carry = ''
    let fedBytes = 0
    while (off < size) {
      const want = Math.min(buf.length, size - off)
      const got = readSync(fd, buf, 0, want, off)
      if (got <= 0) break
      off += got
      fedBytes += got
      const text = carry + dec.write(buf.subarray(0, got))
      const parts = text.split(/\r?\n/)
      carry = parts.pop() ?? '' // 末尾可能是半行,留给下一块(ANSI 码不跨换行,故按整行剥色安全)
      // **必须逐行剥色再喂**:落盘的是带色日志,汇总行原文即 `  <ESC>[31m失败: 0<ESC>[0m`,
      // 不剥 ⇒ 锚点永不成立 ⇒ 0 轮 ⇒ normal 恒 0(整档读反而"什么都看不见")。
      for (const p of parts) collector.feed(stripAnsi(p))
    }
    carry += dec.end()
    if (carry !== '') collector.feed(stripAnsi(carry))
    return {
      ok: true,
      state: 'read',
      rounds: collector.finish(),
      size,
      bytesParsed: fedBytes,
      skippedBytes,
      capped: skippedBytes > 0,
    }
  } finally {
    closeSync(fd)
  }
}

/**
 * 引用事务见证文件(`.husky/reference-transaction` 在 `committed` 阶段落的一行一枚 sha)。
 *
 * 它是**唯一一条与 `--no-verify` 无关的正证** —— 跳门只跳过校验型钩子,引用事务钩子照跑
 * (同一条机制上 stash-guard 拦得住 `git stash push`,连 `--no-verify` 都绕不过它)。
 * 于是"三样正证都没有"那一堆第一次能被拆成两格:本机见证过(可疑)/ 本机无见证(别机或更早)。
 *
 * 三态不得并桶,而且**缺文件绝不等于"今天没人提交"**:
 *   read      —— 读到 N 行(坏行单独计数,不当 0 处理)
 *   missing   —— 见证机制还没入库/机器上没跑过 ⇒ 无从分,**不得**把每枚都判成"无见证"
 *   unreadable—— 取了个空/权限问题 ⇒ 同上,只能说无从分
 */
export function readWitness(root) {
  const path = resolve(root, '.workbuddy', 'commit-witness.log')
  let fd
  try {
    fd = openSync(path, 'r')
  } catch (e) {
    return {
      ok: false,
      state: e?.code === 'ENOENT' ? 'missing' : 'unreadable',
      why: String(e?.message ?? e).slice(0, 120),
      shas: new Set(),
      records: 0,
      badLines: 0,
    }
  }
  const shas = new Set()
  let badLines = 0
  try {
    const size = fstatSync(fd).size
    const cap = Math.min(size, WITNESS_CAP_BYTES)
    const buf = Buffer.alloc(cap)
    const got = readSync(fd, buf, 0, cap, 0)
    const lines = buf.toString('utf8', 0, got).split(/\r?\n/)
    for (const l of lines) {
      const t = l.trim()
      if (t === '') continue
      const [sha] = t.split(/[\t ]+/)
      if (/^[0-9a-f]{40}$/.test(sha)) shas.add(sha)
      else badLines++
    }
    return {
      ok: true,
      state: 'read',
      shas,
      records: shas.size,
      badLines,
      truncated: size > cap,
      size,
      why: size > cap ? `见证文件 ${size} B 超 ${WITNESS_CAP_BYTES} B 上限,只读了前面这一段` : null,
    }
  } finally {
    closeSync(fd)
  }
}

/**
 * 钩子自己落的一方记录 `.workbuddy/hook-logs/pre-commit-rounds.jsonl`
 * (2026-09-30 由 `scripts/lib/pre-commit-hook.js` 的 round witness 写入)。
 *
 * 为什么需要它:此前 normal 的**唯一**正证是"钩子日志里有一段与提交文件集逐字等值的回显",
 * 而 lint-staged 改写过文件、并发会话同窗口 stage 别的东西,都会让一次正常提交找不到匹配轮
 * —— 脆判据的失效方向是"多报 unknown",看着保守,实际把"检查全废的提交量"这个问题永久留在答不准。
 * 一方记录改问一件结得实的事:**门跑过、没红、且提交的文件都在这轮它看过的暂存集里**。
 * 三条不并桶:文件集按"提交 ⊆ 本轮所见"判(不是等值);`gatesRan=false` 或 `gatesPassed!==true`
 * 的记录一律不发合格证;取不到文件 ⇒ `missing`(退回日志回显那一维,并在报告里说明两种正证各多少)。
 */
export function readFirstPartyRounds(root) {
  const path = resolve(root, '.workbuddy', 'hook-logs', 'pre-commit-rounds.jsonl')
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (e) {
    return {
      ok: false,
      state: e?.code === 'ENOENT' ? 'missing' : 'unreadable',
      why: String(e?.message ?? e).slice(0, 140),
      rounds: [],
      badLines: 0,
    }
  }
  const rounds = []
  let badLines = 0
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (t === '') continue
    let r
    try {
      r = JSON.parse(t)
    } catch {
      badLines++
      continue
    }
    if (!r || typeof r.headBefore !== 'string' || !Array.isArray(r.stagedFiles)) {
      badLines++
      continue
    }
    rounds.push({
      headBefore: r.headBefore,
      files: new Set(r.stagedFiles.map((f) => String(f).trim()).filter(Boolean)),
      // G-978004 ②:声明集(safe-commit 经 IHUI_DECLARED_FILES 传入,pre-commit-hook 落账);
      // 普通直 git commit 的记录没有该字段 ⇒ 空数组,匹配器维持 ⊆ 弱证。
      declaredFiles: Array.isArray(r.declaredFiles)
        ? r.declaredFiles.map((f) => String(f).trim()).filter(Boolean)
        : [],
      gatesRan: r.gatesRan === true,
      gatesPassed: r.gatesPassed === true,
      exitCode: Number.isFinite(r.exitCode) ? r.exitCode : null,
      ts: r.ts ?? null,
      consumed: false,
    })
  }
  return { ok: true, state: 'read', rounds, badLines, records: rounds.length }
}

/**
 * 一方记录正证:本轮 `headBefore` 等于该提交的父、门跑过且没红、且提交的文件**都在**这轮
 * 门看过的暂存集里。一条记录只给一枚提交作保(consumed),同父多枚时各配各的轮。
 * 三条都必须成立,缺任何一条 ⇒ 不判 normal(不猜)。
 */
export function matchFirstPartyRound(commit, rounds = []) {
  if (!rounds.length) return null
  for (const r of rounds) {
    if (r.consumed || !r.gatesRan || !r.gatesPassed || r.exitCode !== 0) continue
    if (r.headBefore !== commit.parent) continue
    if (commit.files.length === 0) continue
    if (!commit.files.every((f) => r.files.has(f))) continue
    // G-978004 ②:声明集与提交文件面**多重集等值** ⇒ 强证(门看的就是声明要落地的面);
    // 否则维持 ⊆ 弱证(lint-staged 派生文件让落地面 ⊋ 声明集,失效方向是少发强证不是发假证)。
    if (Array.isArray(r.declaredFiles) && r.declaredFiles.length > 0) {
      const declared = [...r.declaredFiles].sort()
      const landed = [...commit.files].sort()
      if (declared.length === landed.length && declared.every((f, i) => f === landed[i])) {
        r.consumed = true
        r.strongDeclared = true
        return r
      }
    }
    r.consumed = true
    return r
  }
  return null
}

/** 一次 git log 拿到「提交 + 父 + 作者时刻 + 改名清单」(-z 不用,按 @ 头行分段)。 */
export function collectCommits({
  root,
  limit = LOG_LIMIT_DEFAULT,
  sinceDay = '0000-00-00',
  untilDay = '9999-99-99',
} = {}) {
  let out
  try {
    out = git(
      ['log', '-n', String(limit), '--no-merges', '--no-renames', '--format=@%H%x09%P%x09%T%x09%aI', '--name-only'],
      { root, timeout: 60_000 },
    )
  } catch (e) {
    return { ok: false, why: `git log 取不到:${String(e?.message ?? e).slice(0, 160)}`, commits: [] }
  }
  const commits = []
  let cur = null
  for (const line of String(out).split(/\r?\n/)) {
    if (line.startsWith('@')) {
      if (cur) commits.push(cur)
      const [sha, parent, tree, iso] = line.slice(1).split('\t')
      const ms = Date.parse(iso)
      cur = { sha, parent: (parent || '').split(' ')[0], tree: String(tree || '').trim(), iso, ms: Number.isFinite(ms) ? ms : null, day: dayKey(iso), files: [] }
      continue
    }
    const t = line.trim()
    if (cur && t !== '') cur.files.push(t)
  }
  if (cur) commits.push(cur)
  const inWin = commits.filter((c) => c.day >= sinceDay && c.day <= untilDay)
  /**
   * **覆盖面自证**(不是"取到多少算多少"):窗口过滤只看落在范围内的枚数,而 `git log -n` 是从 HEAD
   * 往回走 —— 如果还没走到 `sinceDay` 就把 limit 用尽,那"窗口内 N 枚"是**假全量**(读起来像"这一窗
   * 就这么多提交",实际是被截断)。旧写法只有一个 `truncated` 布尔,报得出"截断了"却答不出
   * "有没有覆盖到窗口最早那一天",而后者才是结论能不能用的条件。
   * 三态:`covered`(取数深至 ≤ sinceDay 且没用尽 limit)/ `not-covered`(深至 > sinceDay ⇒ 窗口没走全)/
   * `cap-hit`(正好用尽 limit ⇒ 无从知道)。三者一律如实打印,后两者进"未判定维度"。
   */
  const reachedBackTo = commits.length ? commits[commits.length - 1].day : null
  const capHit = commits.length >= limit
  const coverage = !reachedBackTo
    ? 'empty'
    : reachedBackTo > sinceDay && capHit
      ? 'not-covered'
      : capHit
        ? 'covered-cap'
        : 'covered'
  return { ok: true, why: null, commits: inWin, truncated: capHit, total: commits.length, reachedBackTo, coverage }
}

/** 合并提交枚数(单列,不参与四态)。 */
export function countMerges({
  root,
  limit = LOG_LIMIT_DEFAULT,
  sinceDay = '0000-00-00',
  untilDay = '9999-99-99',
} = {}) {
  try {
    const out = git(['log', '-n', String(limit), '--merges', '--format=%H%x09%aI'], { root, timeout: 60_000 })
    const rows = String(out)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [, iso] = l.split('\t')
        const ms = Date.parse(iso)
        return { iso, ms: Number.isFinite(ms) ? ms : null, day: dayKey(iso) }
      })
      .filter((r) => r.day >= sinceDay && r.day <= untilDay)
    const byDay = new Map()
    for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + 1)
    return { ok: true, count: rows.length, byDay }
  } catch (e) {
    return { ok: false, count: 0, byDay: new Map(), why: String(e?.message ?? e).slice(0, 120) }
  }
}

/** 机器本地日(与 git `%aI` 的**作者本地日**同一量纲;混用 UTC 会让"今天"漏掉当天早晨的提交)。 */
function localDay(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 窗口 = **作者本地日**的闭区间(YYYY-MM-DD 字符串,字典序即时间序)。
 * 刻意不用 ms 区间:%aI 带作者时区偏移,按 UTC 零点切会把当天 00:00–08:00(+08)整段切掉
 * —— 实测 `--since 2026-09-29` 用 ms 判据得 0 枚,而同一窗口按日字符串判有数百枚。
 */
function resolveWindow(argv) {
  const get = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : null
  }
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
  const since = get('--since')
  const until = get('--until')
  const today = localDay(Date.now())
  if (since) {
    if (!DAY_RE.test(since)) return { error: `--since 不是 YYYY-MM-DD:${since}` }
    if (until && !DAY_RE.test(until)) return { error: `--until 不是 YYYY-MM-DD:${until}` }
    const untilDay = until || today
    if (untilDay < since) return { error: `--until(${untilDay}) 早于 --since(${since})` }
    return { sinceDay: since, untilDay, label: `${since}..${until ? until : '今'}` }
  }
  const days = Number(get('--days') ?? 1)
  if (!Number.isFinite(days) || days <= 0) return { error: `--days 必须是正整数,实得 ${get('--days')}` }
  return { sinceDay: localDay(Date.now() - (days - 1) * DAY_MS), untilDay: today, label: `近 ${days} 天(按本地日,含今天)` }
}

async function run({ argv }) {
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : REPO_ROOT
  const asJson = argv.includes('--json')
  const win = resolveWindow(argv)
  if (win.error) {
    console.error(`❌ ${win.error}`)
    return 2
  }
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : LOG_LIMIT_DEFAULT

  const ledger = readLedgerRecords(root)
  // G-1059139:批次留痕走它自己的读出口(字段白名单会丢 treeDigest/selfSkipped)。
  // **不得**把它喂进 indexLedger —— 它没有 headBefore,混进去只会被计入 skipNoParent,
  // 即把"这一轮门跑过了"的记账读成"一条缺父的跳门留痕"。
  const batchLedger = readGateBatchRecords(root)
  const batchRuns = indexBatchRuns(batchLedger.records)
  const index = indexLedger(ledger.records.filter((r) => r.kind !== GATE_BATCH_KIND))

  const hookPath = resolve(root, '.workbuddy', 'hook-logs', 'pre-commit.log')
  const hook = readHookRounds(hookPath)
  const rounds = hook.rounds
  const witness = readWitness(root)
  const firstParty = readFirstPartyRounds(root)

  const got = collectCommits({ root, limit, sinceDay: win.sinceDay, untilDay: win.untilDay })
  const merges = countMerges({ root, limit, sinceDay: win.sinceDay, untilDay: win.untilDay })

  if (!got.ok) {
    console.error(`❌ 提交清单取不到 ⇒ **未判定**,不产出任何四态结论:${got.why}`)
    console.error('   (本器绝不在没有提交面时说"0 条" —— 那正是本票要消灭的误读)')
    return 0
  }

  const passArgs = {
    commits: got.commits,
    index,
    rounds,
    ledgerReadable: ledger.ok,
    ledgerState: ledger.state,
    roundsAvailable: hook.ok,
    witness,
    firstParty,
  }
  /**
   * 两趟定态。第一趟不带批次面,找出"三条正证一条都没有"的枚 —— 只对**这些**枚补算 treeDigest
   * (全量补算会把这器变成几分钟的 git 派生风暴);第二趟带批次面出终态。
   * 两趟之间必须把轮次的 consumed 标记复位:匹配器"一轮只给一枚作保"是有状态的,
   * 不复位会让第二趟把第一趟消费掉的轮当成"没有轮"。
   */
  const pass1 = classifyAll(passArgs)
  const stateByShort = new Map(pass1.detail.map((d) => [d.sha, d.state]))
  const candidates = got.commits.filter((c) => stateByShort.get(c.sha.slice(0, 11)) === 'unknown')
  const digestBySha = new Map()
  const reasonBySha = new Map()
  const treeCache = new Map()
  const cap = argv.includes('--digest-cap') ? Number(argv[argv.indexOf('--digest-cap') + 1]) : DIGEST_CAP_DEFAULT
  let digested = 0
  let capped = 0
  const commitCountByTree = new Map()
  for (const c of got.commits) commitCountByTree.set(c.tree, (commitCountByTree.get(c.tree) || 0) + 1)
  for (const c of candidates) {
    if (batchRuns.byDigest.size === 0) {
      reasonBySha.set(c.sha, '批次面里没有一条带 treeDigest 的留痕(该 kind 是 2026-10-07 才出生的 ⇒ 更早的窗口本就没有)')
      continue
    }
    if (digested >= cap) {
      capped++
      reasonBySha.set(c.sha, `补算上限 ${cap} 已用尽 ⇒ 不判新态(这一维是下界,不是"没有")`)
      continue
    }
    let d = treeCache.get(c.tree)
    if (d === undefined) {
      const r = treeDigestForCommit({ root, sha: c.sha })
      d = r.ok ? r.digest : null
      if (!r.ok) reasonBySha.set(c.sha, r.why)
      treeCache.set(c.tree, d)
      if (d) digested++
    }
    if (d) digestBySha.set(c.sha, d)
    else if (!reasonBySha.has(c.sha)) reasonBySha.set(c.sha, 'treeDigest 取不到(未知原因)')
  }
  for (const r of rounds) r.consumed = false
  if (firstParty && Array.isArray(firstParty.rounds)) for (const r of firstParty.rounds) r.consumed = false
  const batch = {
    available: batchLedger.ok,
    state: batchLedger.state,
    byDigest: batchRuns.byDigest,
    digestBySha,
    reasonBySha,
    commitCountByTree,
  }
  const unboundReasons = {
    candidateCommits: candidates.length,
    digestedTrees: digested,
    digestFailed: [...reasonBySha.entries()].filter(([, w]) => !w.includes('补算上限') && !w.includes('批次面里没有')).length,
    noBatchDigest: [...reasonBySha.entries()].filter(([, w]) => w.includes('批次面里没有')).length,
    capped,
    batchRecordsNoDigest: batchRuns.noDigest,
    batchBadLines: batchLedger.badLines.length,
    batchLedgerState: batchLedger.state,
    ambiguousSameTree: 0,
    noMatch: [...reasonBySha.entries()].filter(([, w]) => w.includes('索引面与落地 tree 不等')).length,
  }
  const { rows, detail } = classifyAll({ ...passArgs, batch })
  unboundReasons.ambiguousSameTree = rows.reduce((a, r) => a + r.unknownBatchAmbiguous, 0)
  const total = rows.reduce((a, r) => a + r.total, 0)
  const sums = {
    normal: rows.reduce((a, r) => a + r.normal, 0),
    ranWithSelfSkip: rows.reduce((a, r) => a + r.ranWithSelfSkip, 0),
    skipped: rows.reduce((a, r) => a + r.skipped, 0),
    bypassLanding: rows.reduce((a, r) => a + r.bypassLanding, 0),
    unknown: rows.reduce((a, r) => a + r.unknown, 0),
    unknownWitnessed: rows.reduce((a, r) => a + r.unknownWitnessed, 0),
    unknownUnwitnessed: rows.reduce((a, r) => a + r.unknownUnwitnessed, 0),
    unknownUnsplittable: rows.reduce((a, r) => a + r.unknownUnsplittable, 0),
    unknownBatchAmbiguous: rows.reduce((a, r) => a + r.unknownBatchAmbiguous, 0),
    normalByBatch: rows.reduce((a, r) => a + r.normalByBatch, 0),
    normalByRecord: rows.reduce((a, r) => a + r.normalByRecord, 0),
    normalByEcho: rows.reduce((a, r) => a + r.normalByEcho, 0),
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          root,
          window: win.label,
          sinceDay: win.sinceDay,
          untilDay: win.untilDay,
          dayFrame: 'author-local-day',
          ledger: {
            ok: ledger.ok,
            state: ledger.state,
            path: ledger.path,
            records: ledger.records.length,
            badLines: ledger.badLines.length,
            why: ledger.why,
          },
          hook: {
            ok: hook.ok,
            state: hook.state ?? 'read',
            rounds: rounds.length,
            truncated: hook.capped === true,
            bytesParsed: hook.bytesParsed ?? null,
            skippedBytes: hook.skippedBytes ?? null,
            size: hook.size ?? null,
            why: hook.why ?? null,
          },
          commits: {
            counted: total,
            truncated: got.truncated === true,
            limit: got.truncated ? limit : null,
            reachedBackTo: got.reachedBackTo ?? null,
            coverage: got.coverage ?? null,
          },
          witness: {
            ok: witness.ok,
            state: witness.state,
            records: witness.records,
            badLines: witness.badLines,
            truncated: witness.truncated === true,
            why: witness.why ?? null,
          },
          firstParty: {
            ok: firstParty.ok,
            state: firstParty.state,
            records: firstParty.records ?? null,
            badLines: firstParty.badLines ?? null,
            why: firstParty.why ?? null,
          },
          merges: { counted: merges.count, ok: merges.ok, why: merges.why ?? null },
          ledgerUnbound: {
            bypassNoSha: index.bypassNoSha,
            skipNoParent: index.skipNoParent,
            refusedMine: index.mine,
          },
          sums,
          batch: {
            ok: batchLedger.ok,
            state: batchLedger.state,
            records: batchLedger.records.length,
            withDigest: batchRuns.byDigest.size,
            noDigest: batchRuns.noDigest,
            badLines: batchLedger.badLines.length,
            why: batchLedger.why ?? null,
          },
          unboundReasons,
          rows,
          detail,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`📊 旁路/跳门总量 —— ${win.label}(root=${root})`)
    console.log(
      `  非合并提交 ${total} 枚 / 合并 ${merges.count} 枚(合并不参与四态;两数相加 = 窗口内全部落地)`,
    )
    console.log(
      `  窗口覆盖:${
        {
          covered: `完整(取数走到 ${got.reachedBackTo},未用尽 --limit)`,
          'covered-cap': `完整但吃满 --limit ${limit}(取数已越过 ${got.reachedBackTo} ≤ ${win.sinceDay})`,
          'not-covered': `**不完整**——只走到 ${got.reachedBackTo},没到 ${win.sinceDay}(还有更早的没取到)⇒ 下面的枚数只是下界`,
          empty: '**未判定**——窗口内一枚提交都没取到(或仓库无提交)',
        }[got.coverage ?? 'empty']
      }`,
    )
    console.log('  日期          normal  跑而自跳  skipped  bypass  unknown')
    for (const r of rows)
      console.log(
        `  ${r.day}   ${String(r.normal).padStart(5)}  ${String(r.ranWithSelfSkip).padStart(9)}  ${String(r.skipped).padStart(7)}  ${String(r.bypassLanding).padStart(6)}  ${String(r.unknown).padStart(7)}`,
      )
    console.log(
      `  合计           ${sums.normal}              ${sums.ranWithSelfSkip}         ${sums.skipped}        ${sums.bypassLanding}        ${sums.unknown}`,
    )
    console.log(`  台账:${ledger.ok ? `可读(${ledger.path})记录 ${ledger.records.length} 条 / 坏行 ${ledger.badLines.length}` : `**未判定**(${ledger.state}:${ledger.why})`}`)
    console.log(
      `  钩子轮次:${hook.ok ? `读到 ${rounds.length} 轮(整档流式读 ${hook.bytesParsed}/${hook.size} B)${hook.capped ? ` ⇒ 超上限,开头 ${hook.skippedBytes} B 没看见,normal 只是下界` : ' ⇒ 无截断,normal 不是下界'}` : `**未判定**(${hook.state}:${hook.why})`}`,
    )
    if (hook.ok && hook.capped)
      console.log(`⚠️ 钩子日志 ${hook.size} B 超过 ${HOOK_READ_CAP_BYTES} B 上限,只读了尾部 ${hook.bytesParsed} B(开头 ${hook.skippedBytes} B 没看见)⇒ normal 是**下界**,不是全量`)
    console.log(
      `  normal 正证来源:一方记录 ${sums.normalByRecord} / 日志回显 ${sums.normalByEcho}` +
        (firstParty.ok
          ? `(一方记录 ${firstParty.records} 条${firstParty.badLines ? `,坏行 ${firstParty.badLines}` : ''})`
          : ` ⇒ 一方记录取不到(${firstParty.state}:${firstParty.why}),normal 只剩"逐字等值回显"这一条脆正证 —— ` +
            `从本仓把轮次正证接进 pre-commit(` +
            `scripts/lib/pre-commit-hook.js)之后,这条缺口对新提交不再存在;历史提交仍只有回显可考`),
    )
    if (index.bypassNoSha > 0)
      console.log(`  ⚠️ 旁路留痕里 ${index.bypassNoSha} 条没有 landedSha ⇒ 绑不到提交,只报数不判绿`)
    if (index.skipNoParent > 0)
      console.log(`  ⚠️ 跳门留痕里 ${index.skipNoParent} 条没有 headBefore ⇒ 绑不到提交,只报数`)
    if (index.mine > 0) console.log(`  ℹ 台账里 ${index.mine} 条 kind=mine 是"拒绝跳门、未落地",不计入任何一态`)
    if (sums.unknown > 0) {
    {
      const amb = unboundReasons.ambiguousSameTree
      console.log(
        `  第五态(ran-with-self-skip)绑定读数:候选 ${unboundReasons.candidateCommits} 枚 / 实算 tree ${unboundReasons.digestedTrees} 棵 / 无匹配 ${unboundReasons.noMatch} / digest 取不到 ${unboundReasons.digestFailed} / 上限截断 ${unboundReasons.capped} / 同 tree 无从分 ${amb} / 无 digest 的批次留痕 ${unboundReasons.batchRecordsNoDigest} 条`,
      )
      console.log(
        '  ⚠️ 能力上限:treeDigest 取的是**跑门那一刻的索引面**;lint-staged 改写过暂存内容、或 pre-commit 之后有人又动过索引时,那一枚落地的 tree 与批次 digest 不等 ⇒ 维持原态(通常仍是 unknown)。这是**正确行为**(宁可少归一类),不是待修的洞。',
      )
      if (amb > 0) console.log(`  ⚠️ 同 treeDigest 命中多枚 ${amb} 枚 ⇒ 落"无从分"(unknown 的第四格,不并入原有三格)`)
      if (unboundReasons.capped > 0) console.log(`  ⚠️ treeDigest 补算触顶 ${unboundReasons.capped} 枚 ⇒ 上面"无匹配/取不到"是**下界**,可调 --digest-cap 重跑`)
    }
    console.log(`  ⚠️ unknown=${sums.unknown}:这些枚"没有任何一条正证"。**不得**读成 normal,也不得读成 skipped。`)
      for (const d of detail.filter((x) => x.state === 'unknown').slice(0, 12))
        console.log(`     · ${d.sha} ${d.day} —— ${d.why}`)
      if (detail.filter((x) => x.state === 'unknown').length > 12) console.log('     …(其余逐条见 --json 的 detail)')
    }
    if (sums.unknown > 0) {
      console.log(
        `  unknown 拆分(按引用事务见证):本机可疑 ${sums.unknownWitnessed} / 别机或更早 ${sums.unknownUnwitnessed} / 无从分 ${sums.unknownUnsplittable}` +
          (witness.ok
            ? `(见证记录 ${witness.records} 枚${witness.truncated ? ' ⇒ 文件超上限只读了一段' : ''})`
            : ` ⇒ 见证文件取不到(${witness.state}:${witness.why})，这一维**无从分**`),
      )
      console.log(
        `     「本机可疑」≠「跳了门」:有见证只说明这台机发生过一次分支 ref 变更,而"跑了门但文件回显不逐字等值"与"根本没跑"同形 ⇒ 定它得读那一枚的钩子日志。`,
      )
    }
    if (ledger.badLines.length > 0)
      console.log(`  ❌ 台账有 ${ledger.badLines.length} 行解不出(行号 ${ledger.badLines.slice(0, 5).map((b) => b.n).join(',')}),这些行**没有**被算成"没发生"`)
    console.log(
      `  口径:normal 的唯一正证 = 钩子日志里文件集合逐字等值且"失败: 0"的一轮;skipped 的唯一正证 = 台账某条跳门留痕的 headBefore == 该提交的父;bypass 的唯一正证 = 台账 landedSha == 该提交。`,
    )
    console.log(
      `  未判定维度:${[
        ledger.ok ? null : '台账取不到',
        hook.ok ? null : '钩子轮次取不到',
        got.coverage === 'not-covered' || got.coverage === 'empty'
          ? `提交清单未覆盖整个窗口(取数深至 ${got.reachedBackTo ?? '无'},需要 ${win.sinceDay};--limit ${limit})`
          : got.coverage === 'covered-cap'
            ? `提交清单吃满 --limit ${limit}(窗口已越过,结论仍可用)`
            : null,
        merges.ok ? null : '合并计数取不到',
      ]
        .filter(Boolean)
        .join(' / ') || '无'}`,
    )
  }
  return 0
}

/** 自检:构造面 + 两条反假绿锁(硬要求④)。零写盘、零 git 派生。 */
function selfTest() {
  const C = (sha, parent, ms, files) => ({
    sha,
    parent,
    iso: new Date(ms).toISOString(),
    ms,
    day: dayKey(new Date(ms).toISOString()),
    files,
  })
  const T = 1_759_000_000_000
  const rec = (o) => ({
    ms: T,
    ts: new Date(T).toISOString(),
    kind: '',
    gatesRun: false,
    ranFullBatch: false,
    declaredFiles: [],
    headBefore: '',
    landedSha: '',
    source: '',
    ...o,
  })
  const fails = []
  const ok = (name, cond, extra = '') => {
    if (!cond) fails.push(`${name} ${extra}`)
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` —— ${extra}`}`)
  }

  // 锁①:旁路落地一行都不落 ⇒ 必须报 unknown 而不是"一切正常"
  {
    const commits = [C('a'.repeat(40), 'p1', T, ['x.ts']), C('b'.repeat(40), 'p2', T, ['y.ts'])]
    const r = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: true })
    ok('①空台账 ⇒ unknown=2 且 total=2', r.rows[0].unknown === 2 && r.rows[0].total === 2, JSON.stringify(r.rows))
    ok('①空台账 ⇒ bypass/normal/skipped 全 0', r.rows[0].bypassLanding === 0 && r.rows[0].normal === 0 && r.rows[0].skipped === 0)
    ok('①unknown 带原因', (r.detail.find((d) => d.sha === 'a'.repeat(11))?.why ?? '').includes('无旁路留痕'), JSON.stringify(r.detail))
  }
  // 锁①b:台账取不到(missing)时,结论必须写"未判定"而不是 0
  {
    const commits = [C('a'.repeat(40), 'p1', T, ['x.ts'])]
    const r = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: false, ledgerState: 'missing' })
    ok('①b台账 missing ⇒ unknown=1 且原因点名"台账取不到"', r.rows[0].unknown === 1 && r.detail[0].why.includes('台账取不到'), r.detail[0].why)
  }
  // 锁②:bypass-landing 必须真被计进总量(不是被丢进 unknown)
  {
    const sha = 'c'.repeat(40)
    const commits = [C(sha, 'p1', T, ['x.ts']), C('d'.repeat(40), 'p2', T, ['y.ts'])]
    const idx = indexLedger([rec({ kind: BYPASS_KIND, landedSha: sha, declaredFiles: ['x.ts'], gatesRun: false })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('②旁路计进总量(bypass=1,unknown=1)', r.rows[0].bypassLanding === 1 && r.rows[0].unknown === 1 && r.rows[0].total === 2, JSON.stringify(r.rows))
  }
  // skipped:headBefore == 父 ⇒ 归 skipped,不归 unknown/normal
  {
    const commits = [C('e'.repeat(40), 'f'.repeat(40), T, ['x.ts'])]
    const idx = indexLedger([rec({ kind: 'not-ours', headBefore: 'f'.repeat(40), ranFullBatch: false })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('跳门留痕按父绑定 ⇒ skipped=1', r.rows[0].skipped === 1, JSON.stringify(r.rows))
  }
  // mine 不算跳门(拒绝跳门 ⇒ 那枚提交根本没落地)
  {
    const commits = [C('e'.repeat(40), 'f'.repeat(40), T, ['x.ts'])]
    const idx = indexLedger([rec({ kind: 'mine', headBefore: 'f'.repeat(40) })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('kind=mine 不得被算成 skipped', r.rows[0].skipped === 0 && idx.mine === 1)
  }
  // ── G-1118437:sha 绑定正证(gates-then-commit)四臂 ──
  {
    const sha = 'q'.repeat(40)
    const commits = [C(sha, 'p'.repeat(40), T, ['x.ts'])]
    const rec0 = rec({ kind: COMMITTED_KIND, landedSha: sha, gatesRan: true, commitFiles: ['x.ts'], declaredFiles: ['x.ts'], headBefore: 'stale-because-HEAD-moved' })
    const r = classifyAll({ commits, index: indexLedger([rec0]), rounds: [], ledgerReadable: true })
    ok('committed 正证按 sha 绑定 ⇒ normal=1 且不进 bypass', r.rows[0].normal === 1 && r.rows[0].bypassLanding === 0, JSON.stringify(r.rows))
    const rNo = classifyAll({
      commits,
      index: indexLedger([rec({ ...rec0, gatesRan: false, hookSkipped: true })]),
      rounds: [],
      ledgerReadable: true,
    })
    ok('--no-verify 那一枚(gatesRan=false)不得被发合格证 ⇒ 仍 unknown', rNo.rows[0].normal === 0 && rNo.rows[0].unknown === 1, JSON.stringify(rNo.rows))
    const idxShaless = indexLedger([rec({ kind: COMMITTED_KIND, landedSha: '', gatesRan: true })])
    ok('committed 留痕缺 landedSha ⇒ 报数不静默', idxShaless.committedRejectedNoSha === 1 && idxShaless.committed.size === 0)
    // 验收①的等价臂:钩子自报的轮次因 HEAD 被别人推进而绑不上(旧条件红),
    // 同一次提交经 safe-commit 的 sha 绑定必须拿得到证(新条件绿)。
    const oldOnly = classifyAll({
      commits,
      index: indexLedger([]),
      firstParty: { rounds: [{ headBefore: 'stale-because-HEAD-moved', stagedFiles: ['x.ts'], gatesRan: true, gatesPassed: true, ms: Date.now() }] },
      rounds: [],
      ledgerReadable: true,
    })
    ok('旧绑定条件在"HEAD 被推进"场景 ⇒ 拿不到证(unknown=1,这就是本票的立因)', oldOnly.rows[0].unknown === 1 && oldOnly.rows[0].normal === 0, JSON.stringify(oldOnly.rows))
    ok('新绑定条件同场景 ⇒ normal=1', r.rows[0].normal === 1)
  }
  // normal:唯一正证 = 逐字等值 + 失败 0 的钩子轮
  {
    const commits = [C('g'.repeat(40), 'h'.repeat(40), T, ['a.ts', 'b.ts'])]
    const rounds = parseHookRounds(
      ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '🛡️ 守门脚本批量检查汇总', '  失败: 0'].join('\n'),
    )
    const r = classifyAll({ commits, index: indexLedger([]), rounds, ledgerReadable: true })
    ok('有零失败等值轮 ⇒ normal=1', r.rows[0].normal === 1, JSON.stringify(r.rows))
    const r2 = classifyAll({ commits, index: indexLedger([]), rounds: parseHookRounds(
      ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '🛡️ 守门脚本批量检查汇总', '  失败: 2'].join('\n')), ledgerReadable: true })
    ok('同轮但失败:2 ⇒ 不得算 normal(反例)', r2.rows[0].normal === 0 && r2.rows[0].unknown === 1, JSON.stringify(r2.rows))
  }
  // landedSha 缺失的旁路留痕 ⇒ 报数,不静默
  {
    const idx = indexLedger([rec({ kind: BYPASS_KIND, landedSha: '' })])
    ok('旁路留痕无 landedSha ⇒ 计入 bypassNoSha(不静默丢弃)', idx.bypassNoSha === 1 && idx.bypass.size === 0)
  }
  // ANSI 剥色有牙:带色原文必须仍能量出一轮(不剥色 ⇒ 恒 0 轮 ⇒ normal 恒 0 = 把没判写成判过了)
  {
    const E = String.fromCharCode(27)
    const colored = [
      '  ℹ️  staged 文件清单(2 个):',
      '  - a.ts',
      '  - b.ts',
      `  ${E}[31m失败: 0${E}[0m`,
    ].join('\n')
    const rs = parseHookRounds(colored)
    ok('ANSI 色码不得把轮次消成 0 轮', rs.length === 1 && rs[0].failed === 0, JSON.stringify(rs))
    ok('stripAnsi 去掉控制序列', stripAnsi(`${E}[31mX${E}[0m`) === 'X')
  }
  // 收集器与整串解析必须同形(整档流式读走的是 collector;两条路径漂开 ⇒ 同一份日志两种结论)
  {
    const text = [
      'ℹ️  staged 文件清单(2 个):',
      '  - a.ts',
      '  - b.ts',
      '🛡️ 守门脚本批量检查汇总',
      '  失败: 0',
      'ℹ️  staged 文件清单(1 个):',
      '  - c.ts',
      '  失败: 1',
    ].join('\n')
    const col = roundCollector()
    for (const l of text.split('\n')) col.feed(l)
    const viaCollector = col.finish()
    const viaText = parseHookRounds(text)
    ok('逐行喂与整串解析必须同形(两条路径不得漂)', JSON.stringify(viaCollector) === JSON.stringify(viaText) && viaText.length === 2, `${JSON.stringify(viaCollector)} vs ${JSON.stringify(viaText)}`)
    ok('两轮各自的失败数分别记对(0 与 1 不得并桶)', viaCollector[0].failed === 0 && viaCollector[1].failed === 1)
  }
  // 坏行:parse 不吞
  {
    const bad = parseHookRounds('staged 文件清单(1 个):\n  - a.ts\n(没有汇总就结束)')
    ok('钩子轮没等到汇总 ⇒ 不产出该轮(不猜失败数)', bad.length === 0)
  }
  // unknown 按见证拆三格。最关键的一条是**反方向**:见证文件取不到时不得把每枚算成"无见证"
  // —— 那是把"没记"写成"没发生",正是本器要消灭的那一型。
  {
    const sha = 'z'.repeat(40)
    const other = 'y'.repeat(40)
    const commits = [C(sha, 'p1', T, ['x.ts']), C(other, 'p2', T, ['w.ts'])]
    const wOk = { ok: true, state: 'read', shas: new Set([sha]), records: 1, badLines: 0 }
    const r = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: true, witness: wOk })
    ok('见证命中 ⇒ unknownWitnessed=1 且带「可疑」不指控', r.rows[0].unknownWitnessed === 1 && r.detail[0].why.includes('可疑'), JSON.stringify(r.detail[0]))
    ok('见证未命中 ⇒ unknownUnwitnessed=1(别机/更早,不判成可疑)', r.rows[0].unknownUnwitnessed === 1 && r.detail[1].why.includes('无从判断'), JSON.stringify(r.detail[1]))
    ok('拆格总和必须等于 unknown(不得漏计/重计)', r.rows[0].unknownWitnessed + r.rows[0].unknownUnwitnessed === r.rows[0].unknown && r.rows[0].unknown === 2, JSON.stringify(r.rows[0]))
    const wBad = { ok: false, state: 'missing', shas: new Set(), records: 0, why: 'ENOENT' }
    const r2 = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: true, witness: wBad })
    ok('见证取不到 ⇒ 全部落 unsplittable，**一格都不许算成"无见证"**', r2.rows[0].unknownUnsplittable === 2 && r2.rows[0].unknownUnwitnessed === 0 && r2.rows[0].unknownWitnessed === 0, JSON.stringify(r2.rows[0]))
    ok('取不到那一格的措辞必须点出「无从分」', r2.detail[0].why.includes('无从分'), r2.detail[0].why)
    const r3 = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: true })
    ok('不传 witness ⇒ 四态与旧口径逐字同(向后兼容,拆格是加法不是换判据)', r3.rows[0].unknown === 2 && r3.rows[0].unknownWitnessed === 0 && r3.rows[0].unknownUnwitnessed === 0 && !r3.detail[0].sub)
  }
  // 一方记录正证。四条反例各钉一个漏洞:门没跑 / 门红了 / 文件集不含 / 父不对 ——
  // 以及"一条记录只保一枚"(consumed),否则同父的两枚提交会共享同一张合格证。
  {
    const P = 'f'.repeat(40)
    const mk = (over) => ({ headBefore: P, files: new Set(['a.ts', 'b.ts']), gatesRan: true, gatesPassed: true, exitCode: 0, ts: null, consumed: false, ...over })
    const c = C('m'.repeat(40), P, T, ['a.ts'])
    ok('一方记录:门跑过+没红+文件在内 ⇒ normal', matchFirstPartyRound(c, [mk({})]) !== null)
    ok('gatesRan=false 不得发合格证', matchFirstPartyRound(c, [mk({ gatesRan: false })]) === null)
    ok('gatesPassed=false(门红了)不得发合格证', matchFirstPartyRound(c, [mk({ gatesPassed: false })]) === null)
    ok('exitCode=1 不得发合格证', matchFirstPartyRound(c, [mk({ exitCode: 1 })]) === null)
    ok('提交里有一个文件不在本轮所见面 ⇒ 不得发合格证', matchFirstPartyRound(C('n'.repeat(40), P, T, ['a.ts', 'ghost.ts']), [mk({})]) === null)
    ok('headBefore ≠ 提交的父 ⇒ 不得发合格证', matchFirstPartyRound(c, [mk({ headBefore: 'x'.repeat(40) })]) === null)
    const rounds = [mk({})]
    ok('一条记录只保一枚(消费后不得复用)', matchFirstPartyRound(c, rounds) !== null && matchFirstPartyRound(C('o'.repeat(40), P, T, ['b.ts']), rounds) === null)
    const r = classifyAll({
      commits: [c],
      index: indexLedger([]),
      rounds: [],
      ledgerReadable: true,
      firstParty: { ok: true, state: 'read', rounds: [mk({})] },
    })
    ok('只有一方记录、没有回显 ⇒ 仍是 normal 且来源=round-record(脆判据的洞由它补上)', r.rows[0].normal === 1 && r.rows[0].normalByRecord === 1 && r.detail[0].proof === 'round-record', JSON.stringify(r.rows[0]))
  }
  console.log(`\n自检:${fails.length === 0 ? '全部通过' : `${fails.length} 条失败`}(组数按当次实跑,不钉数字)`)
  return fails.length === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/plan-bypass-ledger-report.mjs [--days N|--since YYYY-MM-DD [--until YYYY-MM-DD]] [--json] [--root DIR] [--limit N] [--self-test]',
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  return await run({ argv })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { indexLedger, parseHookRounds, classifyAll, matchNormalRound, collectCommits, countMerges, dayKey, readHookRounds, roundCollector, readWitness, readFirstPartyRounds, matchFirstPartyRound }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
