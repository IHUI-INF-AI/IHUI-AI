// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 代码归属 notes 的**只读**聚合报表(逆向-复现-超越 §0.11,G-4 读侧补齐轴)。
// 立因:写侧(safe-commit:2106 → recordForCommit)自接线以来一直在攒数据,但全仓无一个读侧消费者
// ⇒ 四问("AI 参与了多少 / 谁主张过 / 是否重复主张 / 归属是否失效")无人能答。AGENTS §0.9:
// 造好没装车 = 没有。本文件是第一个装车读侧。
//
// 三条硬口径:
// ① 只读。全程不写 notes、不改 blob/索引/工作树;git 派生一律走 scripts/lib/face-reader.mjs 的
//    gitRaw(§12g 显式 stdio + windowsHide + core.quotepath=false 都在那一处单源)。
// ② 判据单源(§0.6)。解析一律 import scripts/lib/ai-authorship-notes.mjs —— 含读侧解析五件
//    (parseNotesListLine / parseLsTreeEntryZ / resolveDiffPathToNewSide / parseNumstatLine /
//    normalizeRepoPath)与既有 readNote / verifyIntegrity / verifyRecord;本文件不重写任何一份。
// ③ 三态(§0.3)。取不到输入一律 unjudged 并逐条点名原因;**无归属记录的 commit 绝不判成"人类写的"**
//    —— 读不到 ≠ 没参与。枚举到 0 条记录时,分桶/重复主张/失效三维均记 unjudged,不记绿。
//
// 刻意不进提交链(§12e):本工具判的是仓库历史,与"本次提交内容"无关,挂成 blocking 即恒红门。
// 退出码:0 = 四问全部判定完成 · 2 = 未判定(未知旗标 / 取值非法 / 任一维取不到输入)。
//    本工具没有"业务失败"这一档:报表读不出来只能是未判定,不能是红(失效方向恒为多要一次定向说明)。
// 用法见 --help。

import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { gitRaw, gitErrText } from './lib/face-reader.mjs'
import {
  NOTES_REF_DEFAULT,
  notesRefForNamespace,
  readNote,
  verifyIntegrity,
  verifyRecord,
  normalizeRepoPath,
  parseNotesListLine,
  parseLsTreeEntryZ,
  resolveDiffPathToNewSide,
  parseNumstatLine,
  findDuplicateSubjectClaims,
} from './lib/ai-authorship-notes.mjs'

const EXIT = { ok: 0, undetermined: 2 }
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 5000
export const REPORT_SCHEMA_V = 1

// ── 参数:闭集(缺陷先例 90981bad2b:工具不拒未知旗标就直跑真轮)──────────────
const FLAG_WITH_VALUE = new Set(['--since', '--range', '--limit', '--namespace', '--repo'])
const FLAG_BOOL = new Set(['--json', '--self-test', '--help'])

export function parseArgs(argv = []) {
  const opts = { since: null, range: null, limit: DEFAULT_LIMIT, namespace: 'default', repoDir: null, json: false, selfTest: false, help: false }
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (FLAG_BOOL.has(a)) {
      opts[a === '--self-test' ? 'selfTest' : a === '--json' ? 'json' : 'help'] = true
      continue
    }
    if (!FLAG_WITH_VALUE.has(a)) {
      unknown.push(a)
      continue
    }
    const v = argv[i + 1]
    if (v === undefined || String(v).startsWith('--')) throw new Error(`${a} 缺少取值`)
    i += 1
    if (a === '--since') {
      if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?([Zz]|[+-]\d{2}:?\d{2})?$/.test(v) || Number.isNaN(Date.parse(v.replace(' ', 'T')))) {
        throw new Error(`--since 取值不是可解析的 ISO 日期:${v}`)
      }
      opts.since = v
    } else if (a === '--range') opts.range = v
    else if (a === '--limit') {
      const n = Number(v)
      if (!Number.isInteger(n) || n <= 0 || n > MAX_LIMIT) throw new Error(`--limit 需 1..${MAX_LIMIT} 的整数:${v}`)
      opts.limit = n
    } else if (a === '--namespace') opts.namespace = v
    else if (a === '--repo') opts.repoDir = v
  }
  // 未知旗标**先于任何取数**抛出:调用方(main)据此当场 exit 2 点名,绝不带着半生不熟的参数去跑真轮。
  if (unknown.length) throw new Error(`不认识的参数:${unknown.join(' ')}(本工具只收 ${[...FLAG_WITH_VALUE].join('/')} 取值旗标与 ${[...FLAG_BOOL].join('/')} 开关)`)
  return opts
}

export function helpText() {
  return [
    '用法: node scripts/ai-authorship-report.mjs [--since <iso>] [--range <rev-list 表达式>] [--limit N]',
    '        [--namespace <ns>] [--repo <dir>] [--json] [--self-test] [--help]',
    '',
    `只读聚合 AI 代码归属 git notes(默认命名空间 ref=${NOTES_REF_DEFAULT}),回答四问:`,
    '  1 覆盖率   —— 范围内多少枚带归属记录、多少枚不带;不带记录一律记 unjudged(读不到≠人类写的)',
    '  2 主体分桶 —— 每个归属主体(session)各主张多少文件/行(字段形态照 lib 的 entries 结构,不自造)',
    '  3 跨席重复 —— 同一文件被不同主体分别主张 ⇒ 逐条点名(本仓多会话共享工作树独有的一轴)',
    '  4 归属失效 —— 载荷内容哈希(integrity.fp)与重算不符 或 主张路径已不在 HEAD 树 ⇒ stale,',
    '                不再计入有效归属;per-file blob 哈希未记录 ⇒ 内容级失效记 unjudged 并点名',
    '',
    `范围: 默认最近 ${DEFAULT_LIMIT} 枚(--limit 可调,上限 ${MAX_LIMIT});--since 按提交时刻筛;--range 收 rev-list 表达式。`,
    '退出码: 0 四问全部判定 · 2 未判定(未知旗标/取值非法/任一维取不到输入)。未知旗标在取数之前就拒。',
    '全程零写盘:不写 notes、不改 blob/索引/工作树。刻意不进提交链(判历史 ⇒ 挂提交门即恒红门)。',
  ].join('\n')
}

// ── 纯判据层(零 IO):报表四问的结论在这里成形 ────────────────────────────────

/**
 * 单枚 commit 的归属形态分档(第一问的牙)。
 * ⚠️ 失效方向锁死:没有记录 ⇒ `unjudged_no_record`,**不是** `human_only`。
 *    把这一行改成"人类写的"就是把"读不到"说成"判过了"(§0.3),镜像测试的真变异用例专咬此处。
 */
export function classifyCommit({ hasNote, noteState, integrityState, entryCount } = {}) {
  if (!hasNote) return { bucket: 'unjudged_no_record', validAttribution: false, reason: '该 commit 在归属 ref 上没有记录(未记录≠无 AI 参与)' }
  if (noteState === 'undetermined') return { bucket: 'unjudged_unreadable', validAttribution: false, reason: 'notes 取数未判定' }
  if (noteState === 'malformed') return { bucket: 'unjudged_malformed', validAttribution: false, reason: 'notes 载荷 JSON 解析失败' }
  // 载荷自带的内容哈希(integrity.fp = sha256(canonicalJson{v,entries}))与重算值不符 ⇒ 载荷被改写过
  // ⇒ 这条归属**不再算有效**(第二处牙;把它反成"不符也算有效",真变异用例必须翻红)。
  if (integrityState !== 'ok') return { bucket: 'stale_payload', validAttribution: false, reason: `载荷完整性不符:${integrityState}` }
  if (!entryCount) return { bucket: 'note_empty', validAttribution: false, reason: '载荷可解析但 entries 为空' }
  return { bucket: 'attributed_record', validAttribution: true, reason: null }
}

/** 覆盖率聚合:分母必须是"范围内 commit 数",不得把 unjudged 并进"人类写的"。 */
export function aggregateCoverage({ commits, classification } = {}) {
  const buckets = {}
  for (const sha of commits) {
    const b = classification[sha]?.bucket ?? 'unjudged_unreadable'
    buckets[b] = (buckets[b] || 0) + 1
  }
  const withRecord = commits.filter((s) => classification[s]?.hasNote).length
  const state = commits.length > 0 && Object.keys(buckets).length > 0 ? 'ok' : 'unjudged'
  return {
    state,
    total_commits: commits.length,
    with_record: withRecord,
    without_record: commits.length - withRecord,
    buckets,
    // 未判定合计 = 没有记录 + 取不到 + 载荷坏 + 空载荷;这一维单独列出来,就是为了不许它隐身。
    unjudged_total: (buckets.unjudged_no_record || 0) + (buckets.unjudged_unreadable || 0) + (buckets.unjudged_malformed || 0) + (buckets.note_empty || 0),
    coverage_pct: commits.length ? Number(((withRecord / commits.length) * 100).toFixed(2)) : null,
    note: 'without_record 全部落 unjudged,不代表人类独立编写',
  }
}

/**
 * 按主体分桶(第二问)。只统计**有效归属**的条目;stale/malformed 的 commit 上的条目单独计数
 * 且不进文件行桶(§硬约束 4)。行数来自 numstat:二进制行结构上无定义 ⇒ 记 binary_files,
 * 绝不记成 0 行(用 0 冒充"没改动"是 §0.3 禁形态);主张了但该枚 numstat 里没有 ⇒ unjudged。
 */
export function aggregateBySubject({ entries, classification, numstatByCommit, stalePathKeys = new Set() } = {}) {
  const bySubject = new Map()
  const excluded = []
  for (const e of entries) {
    const sha = typeof e?.commit === 'string' ? e.commit : ''
    if (!sha || !classification[sha]?.validAttribution) {
      excluded.push({ session: e?.session ?? null, commit: sha || null, why: classification[sha]?.bucket ?? 'commit-not-in-range' })
      continue
    }
    const s = typeof e.session === 'string' && e.session !== '' ? e.session : '__session-missing__'
    const row = bySubject.get(s) || {
      session: s,
      entries: 0,
      commits: new Set(),
      files: new Set(),
      lines_added: 0,
      lines_removed: 0,
      binary_files: 0,
      lines_unjudged_paths: [],
      stale_paths: new Set(),
      stale_path_files: 0,
      statuses: {},
      events: new Set(),
      tools: new Set(),
      counted: new Set(),
    }
    row.entries += 1
    if (sha) row.commits.add(sha)
    row.statuses[e.status ?? 'unknown'] = (row.statuses[e.status ?? 'unknown'] || 0) + 1
    if (e.event) row.events.add(e.event)
    if (e.tool) row.tools.add(e.tool)
    const stat = numstatByCommit[sha] || { stats: new Map(), undetermined: [] }
    // 同一 (commit, path) 的行数只累计一次:numstat 的行差是那枚 commit 的属性,不是条目的属性。
    // 同一路径被两条 checkpoint 条目重复主张时若再求和,就是"把记录条数当工作量"(§0.10 失效方向)。
    for (const p of e.ai_paths || []) {
      const key = normalizeRepoPath(p)
      const id = `${sha}::${key}`
      // 第四问打回的一档(主张路径已不在当前 HEAD 树)不得再留在有效归属桶里(硬约束 4)。
      if (stalePathKeys.has(id)) {
        if (!row.stale_paths.has(id)) {
          row.stale_paths.add(id)
          row.stale_path_files += 1
        }
        continue
      }
      row.files.add(key)
      if (row.counted.has(id)) continue
      const n = stat.stats.get(key)
      if (!n) {
        row.counted.add(id)
        row.lines_unjudged_paths.push(key)
        continue
      }
      row.counted.add(id)
      if (n.binary) row.binary_files += 1
      else {
        row.lines_added += n.added
        row.lines_removed += n.removed
      }
    }
    bySubject.set(s, row)
  }
  const subjects = [...bySubject.values()]
    .map((r) => ({
      session: r.session,
      entries: r.entries,
      commits: r.commits.size,
      files: r.files.size,
      lines_added: r.lines_added,
      lines_removed: r.lines_removed,
      binary_files: r.binary_files,
      lines_unjudged_files: r.lines_unjudged_paths.length,
      stale_path_files: r.stale_path_files,
      statuses: r.statuses,
      events: [...r.events],
      tools: [...r.tools],
    }))
    .sort((a, b) => b.files - a.files || a.session.localeCompare(b.session))
  // 枚举到 0 条有效条目 ⇒ unjudged:没有主体不等于"没有 AI 参与",只是没有可读的归属记录(§0.3)。
  return {
    state: subjects.length > 0 ? 'ok' : 'unjudged',
    subjects,
    entries_excluded_as_invalid: excluded.length,
    excluded_sessions: [...new Set(excluded.map((x) => x.session ?? null))].filter(Boolean),
    note: subjects.length ? null : '范围内无可判定的归属条目(未判定,不记"无人主张")',
  }
}

/**
 * 归属失效(第四问)。三档分列,绝不并桶:
 *  · payload_fp_mismatch —— 载荷自记录的内容哈希与重算不符(已由 classify 打回,不记有效)
 *  · path_gone_at_head   —— 主张的路径在当前 HEAD 树里已不存在(HEAD 树取不到 ⇒ 该档 unjudged)
 *  · per-file content hash —— **先读 lib 确认**:note 记录的是 integrity.fp(payload 级)与
 *    dedupe_key 尾段 hashPaths(路径集级),**没有 per-file blob 哈希** ⇒ 内容级"当前 blob 与记录
 *    不符"结构上判不了 ⇒ 恒记 unjudged 并点名,不得用 payload 档冒充它判过了。
 */
export function aggregateStale({ classification, commits, entries, headTree, treeState } = {}) {
  const payload = []
  for (const sha of commits) {
    const c = classification[sha]
    if (c?.bucket === 'stale_payload') payload.push({ commit: sha, reason: c.reason })
  }
  const malformed = commits.filter((s) => classification[s]?.bucket === 'unjudged_malformed').map((s) => ({ commit: s, reason: classification[s].reason }))
  const unreadable = commits.filter((s) => classification[s]?.bucket === 'unjudged_unreadable').map((s) => ({ commit: s, reason: classification[s].reason }))
  const pathGone = []
  const pathsGoneJudged = treeState === 'ok'
  if (pathsGoneJudged) {
    const seen = new Set()
    for (const e of entries) {
      const sha = typeof e?.commit === 'string' ? e.commit : ''
      if (!sha || !classification[sha]?.validAttribution) continue
      for (const p of e.ai_paths || []) {
        const key = normalizeRepoPath(p)
        const id = `${sha}::${key}`
        if (seen.has(id)) continue
        seen.add(id)
        if (!headTree.has(key)) pathGone.push({ commit: sha, path: key, reason: '主张路径已不在当前 HEAD 树 ⇒ 该归属不再算有效指向' })
      }
    }
  }
  const anyPayloadRead = commits.some((s) => classification[s]?.hasNote)
  return {
    state: !anyPayloadRead ? 'unjudged' : pathGone.length || payload.length || malformed.length || unreadable.length ? 'partial' : 'ok',
    named: {
      payload_fp_mismatch: payload,
      note_malformed: malformed,
      note_unreadable: unreadable,
      path_gone_at_head: pathGone,
    },
    counts: { payload_fp_mismatch: payload.length, note_malformed: malformed.length, note_unreadable: unreadable.length, path_gone_at_head: pathGone.length },
    per_file_content_hash: {
      state: 'unjudged',
      reason: '归属 note 载荷未记录 per-file blob 哈希;已记录的哈希形态只有 integrity.fp(payload 级) 与 dedupe_key 尾段 hashPaths(路径集级) ⇒ "当前 blob 与记录不符"这一轴判不了(不记绿也不记红)',
    },
    head_tree_state: treeState,
  }
}

/** 报表成形(纯函数;所有输入由 collect 层取好后注入,便于测试脱离真仓驱动)。 */
export function buildReportData({ repoDir, ref, namespace, rangeSpec, commits, notesIndex, indexParse, classification, entries, numstatByCommit, headTree, treeState, perCommitVerify } = {}) {
  const coverage = aggregateCoverage({ commits, classification })
  // 第四问先算,再喂第二问:已失效的归属(载荷被改写 / 主张路径已不在 HEAD 树)不得留在有效桶里。
  const stale = aggregateStale({ classification, commits, entries, headTree, treeState })
  const stalePathKeys = new Set(stale.named.path_gone_at_head.map((x) => `${x.commit}::${x.path}`))
  const by_subject = aggregateBySubject({ entries, classification, numstatByCommit, stalePathKeys })
  const validEntries = entries.filter((e) => classification[e?.commit]?.validAttribution)
  // 第三问射程 = 载荷有效的条目集(路径级失效不剔除:跨席重复主张是"谁主张过"的风险面,
  // 即便该路径后来被删,两次主张这件事仍然成立;它在第二问里已按失效扣计)。
  const duplicate = findDuplicateSubjectClaims(validEntries)
  const duplicates = {
    state: validEntries.length > 0 ? 'ok' : 'unjudged',
    count: duplicate.length,
    items: duplicate,
    note: validEntries.length ? (duplicate.length ? '同一文件被不同主体分别主张(本仓多会话共享工作树的真实风险面)' : '已判定:有效条目中无跨主体重复主张') : '有效归属条目为 0 ⇒ 该轴未判定(不是"没有重复")',
  }
  const axes = { coverage: coverage.state, by_subject: by_subject.state, duplicate_claims: duplicates.state, stale: stale.state }
  return {
    kind: 'ai-authorship-report',
    schema: REPORT_SCHEMA_V,
    read_only: true,
    generated_at: new Date().toISOString(),
    repo: repoDir,
    notes: { ref, namespace, ref_present: notesIndex.refPresent, index_total: notesIndex.total, in_range: notesIndex.inRange, out_of_range: notesIndex.total - notesIndex.inRange, index_undetermined_lines: indexParse.undetermined },
    range: rangeSpec,
    axes,
    coverage,
    by_subject,
    duplicate_claims: duplicates,
    stale,
    per_commit_verify: perCommitVerify,
    undetermined_commits: commits.filter((s) => !classification[s]?.validAttribution && classification[s]?.bucket?.startsWith('unjudged')).map((s) => ({ commit: s, bucket: classification[s].bucket, why: classification[s].reason })),
    all_axes_judged: Object.values(axes).every((v) => v === 'ok' || v === 'partial'),
  }
}

// ── 取数层(只读 git;解析全部走 lib)──────────────────────────────────────────

function revList(repoDir, { since, range, limit }) {
  const base = range ? ['rev-list', ...range.split(/\s+/).filter(Boolean)] : ['rev-list', 'HEAD']
  const args = [...base]
  if (since) args.splice(1, 0, `--since=${since}`)
  if (!range) args.splice(1, 0, `--max-count=${limit}`)
  const out = gitRaw(args, repoDir)
  const commits = String(out).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return { commits, spec: { kind: range ? 'range' : since ? 'since' : 'limit', expression: args.slice(1).join(' '), limit: range ? null : limit, since } }
}

function notesIndexFor(repoDir, ref) {
  const refsOut = String(gitRaw(['for-each-ref', '--format=%(refname)', ref], repoDir))
  const refPresent = refsOut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).includes(ref)
  const listOut = String(gitRaw(['notes', `--ref=${ref}`, 'list'], repoDir))
  const map = new Map()
  const undetermined = []
  let total = 0
  for (const line of listOut.split(/\r?\n/)) {
    const p = parseNotesListLine(line)
    if (p.kind === 'blank') continue
    if (p.kind === 'undetermined') {
      undetermined.push(p.why)
      continue
    }
    total += 1
    map.set(p.objectSha, p.noteBlob)
  }
  return { refPresent, map, total, undetermined }
}

function headTreeBlobs(repoDir) {
  try {
    const out = String(gitRaw(['ls-tree', '-r', '--full-name', '-z', 'HEAD'], repoDir))
    const map = new Map()
    for (const chunk of out.split('\0')) {
      const e = parseLsTreeEntryZ(chunk)
      if (e.kind === 'entry') map.set(e.path, e.blob)
    }
    return { map, state: 'ok' }
  } catch (err) {
    return { map: new Map(), state: `unjudged:${String(gitErrText(err) || err?.message || err).slice(0, 120)}` }
  }
}

function numstatFor(repoDir, sha) {
  const stats = new Map()
  const undetermined = []
  const out = String(gitRaw(['show', '--numstat', '--pretty=format:', '-M', sha], repoDir))
  for (const line of out.split(/\r?\n/)) {
    const p = parseNumstatLine(line)
    if (p.kind === 'blank') continue
    if (p.kind === 'undetermined') {
      undetermined.push(p.why)
      continue
    }
    stats.set(p.path, { added: p.added, removed: p.removed, binary: p.binary })
  }
  return { stats, undetermined }
}

/** 该枚 commit 实际改动的路径集(重命名取新侧;认不得的形态点名,不猜)。 */
function changedPathsFor(repoDir, sha) {
  const out = String(gitRaw(['show', '--pretty=format:', '--name-only', '-M', sha], repoDir))
  const paths = []
  const undetermined = []
  for (const line of out.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const r = resolveDiffPathToNewSide(line)
    if (r.kind === 'ok') paths.push(r.value)
    else undetermined.push(r.why)
  }
  return { paths, undetermined }
}

export function runReport(opts = {}) {
  const repoDir = opts.repoDir || process.cwd()
  let ref
  try {
    ref = notesRefForNamespace(opts.namespace || 'default')
  } catch (e) {
    return { fatal: `notes 命名空间非法:${e.message}` }
  }
  let range
  try {
    range = revList(repoDir, opts)
  } catch (e) {
    return { fatal: `范围内 commit 取不到:${String(gitErrText(e) || e?.message || e).slice(0, 200)}` }
  }
  let index
  try {
    index = notesIndexFor(repoDir, ref)
  } catch (e) {
    return { fatal: `归属 notes 索引取不到:${String(gitErrText(e) || e?.message || e).slice(0, 200)}` }
  }
  const commits = range.commits
  if (!commits.length) return { fatal: '范围内 0 枚 commit ⇒ 未判定(枚举到 0 个候选不记绿,§0.3)', ref }

  const notesIndexObj = { refPresent: index.refPresent, total: index.total, inRange: 0 }
  const classification = {}
  const entries = []
  const numstatByCommit = {}
  const perCommitVerify = []
  const pathCheckUndetermined = []
  for (const sha of commits) {
    const hasNote = index.map.has(sha)
    if (hasNote) notesIndexObj.inRange += 1
    const note = hasNote ? readNote({ repoDir, commit: sha, ref }) : { state: 'absent' }
    const payload = note.state === 'found' ? note.payload : null
    const integrity = payload ? verifyIntegrity(payload) : null
    const c = classifyCommit({ hasNote, noteState: note.state, integrityState: integrity?.state, entryCount: payload?.entries?.length ?? 0 })
    c.hasNote = hasNote
    classification[sha] = c
    if (!payload) continue
    for (const e of payload.entries || []) entries.push({ ...e, commit: e.commit || sha })
    // 逐枚只读自证复用 lib 的 verifyRecord(within-note 判据不在本文件重写一遍,§0.6)
    const v = verifyRecord({ repoDir, commit: sha, namespace: opts.namespace || 'default' })
    perCommitVerify.push({ commit: sha, state: v.state, entry_count: v.entry_count ?? null, issues: v.issues ?? (v.why ? [v.why] : []), conflicts: v.conflicts ?? [] })
    try {
      numstatByCommit[sha] = numstatFor(repoDir, sha)
    } catch (e) {
      numstatByCommit[sha] = { stats: new Map(), undetermined: [`numstat 取不到:${String(gitErrText(e) || e?.message || e).slice(0, 120)}`] }
    }
    try {
      const ch = changedPathsFor(repoDir, sha)
      for (const p of ch.undetermined) pathCheckUndetermined.push(`${sha.slice(0, 12)}:${p}`)
      for (const e of payload.entries || []) {
        for (const p of e.ai_paths || []) {
          if (!ch.paths.includes(normalizeRepoPath(p))) pathCheckUndetermined.push(`${sha.slice(0, 12)}:主张路径不在该枚改动集:${normalizeRepoPath(p)}`)
        }
      }
    } catch (e) {
      pathCheckUndetermined.push(`${sha.slice(0, 12)}:改动集取不到:${String(gitErrText(e) || e?.message || e).slice(0, 120)}`)
    }
  }
  const tree = headTreeBlobs(repoDir)
  const report = buildReportData({
    repoDir,
    ref,
    namespace: opts.namespace || 'default',
    rangeSpec: { ...range.spec, resolved: commits.length, ref_present_note: index.refPresent ? 'ref 存在' : 'ref 不存在 ⇒ 全仓零条归属记录(未判定,不是无 AI 参与)' },
    commits,
    notesIndex: notesIndexObj,
    indexParse: { undetermined: index.undetermined },
    classification,
    entries,
    numstatByCommit,
    headTree: tree.map,
    treeState: tree.state,
    perCommitVerify,
  })
  report.claims_outside_commit_diff = pathCheckUndetermined
  report.numstat_undetermined = Object.values(numstatByCommit).flatMap((n) => n.undetermined)
  return { report }
}

// ── 自测(纯逻辑,不碰真仓;真 git 夹具在镜像测试里走 mkScratch)──────────────────
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  t('无归属记录的 commit ⇒ unjudged,绝不记成"人类写的"', () => {
    const c = classifyCommit({ hasNote: false })
    if (c.bucket !== 'unjudged_no_record' || c.validAttribution) throw new Error(JSON.stringify(c))
    const cov = aggregateCoverage({ commits: ['a'], classification: { a: { ...c, hasNote: false } } })
    if (cov.buckets.human_only) throw new Error('覆盖率里冒出了"人类写的"档')
    if (cov.unjudged_total !== 1) throw new Error(JSON.stringify(cov))
  })
  t('载荷完整性不符 ⇒ stale 且不进有效归属/不进主体分桶', () => {
    const c = classifyCommit({ hasNote: true, noteState: 'found', integrityState: 'mismatch' })
    if (c.bucket !== 'stale_payload' || c.validAttribution) throw new Error(JSON.stringify(c))
    const agg = aggregateBySubject({ entries: [{ session: 'S', commit: 'a', ai_paths: ['x.ts'], status: 'attributed' }], classification: { a: { ...c, hasNote: true } }, numstatByCommit: {} })
    if (agg.subjects.length !== 0 || agg.entries_excluded_as_invalid !== 1) throw new Error(JSON.stringify(agg))
  })
  t('malformed / unreadable 均落 unjudged 且不记有效', () => {
    for (const st of ['malformed', 'undetermined']) {
      const c = classifyCommit({ hasNote: true, noteState: st })
      if (!c.bucket.startsWith('unjudged_') || c.validAttribution) throw new Error(`${st}:${JSON.stringify(c)}`)
    }
  })
  t('主体分桶:文件去重、二进制不记 0 行、无 numstat 记 unjudged', () => {
    const cls = { a: { bucket: 'attributed_record', validAttribution: true, hasNote: true } }
    const stats = new Map([['x.ts', { added: 5, removed: 2, binary: false }], ['img.png', { added: null, removed: null, binary: true }]])
    const agg = aggregateBySubject({
      entries: [
        { session: 'S1', commit: 'a', status: 'attributed', ai_paths: ['x.ts', './x.ts', 'img.png', 'ghost.ts'] },
        { session: 'S1', commit: 'a', status: 'attributed', ai_paths: ['x.ts'] },
      ],
      classification: cls,
      numstatByCommit: { a: { stats, undetermined: [] } },
    })
    const s = agg.subjects[0]
    if (s.files !== 3) throw new Error(`去重后应 3 枚文件:${JSON.stringify(s)}`)
    if (s.lines_added !== 5 || s.lines_removed !== 2) throw new Error(`行数应只累计非二进制:${JSON.stringify(s)}`)
    if (s.binary_files !== 1 || s.lines_unjudged_files !== 1) throw new Error(JSON.stringify(s))
  })
  t('跨席重复主张点名;同席重记不算重复', () => {
    const dup = findDuplicateSubjectClaims([
      { session: 'A', commit: 'c1', ai_paths: ['shared.ts'] },
      { session: 'A', commit: 'c2', ai_paths: ['shared.ts'] },
      { session: 'B', commit: 'c3', ai_paths: ['shared.ts'] },
      { session: 'C', commit: 'c3', ai_paths: ['solo.ts'] },
    ])
    if (dup.length !== 1 || dup[0].path !== 'shared.ts' || dup[0].sessions.length !== 2) throw new Error(JSON.stringify(dup))
  })
  t('失效路径已从有效归属桶扣掉(第二问与第四问不得各说各话)', () => {
    const cls = { a: { bucket: 'attributed_record', validAttribution: true, hasNote: true } }
    const stats = new Map([['live.ts', { added: 3, removed: 1, binary: false }], ['gone.ts', { added: 9, removed: 9, binary: false }]])
    const entries = [{ session: 'S', commit: 'a', status: 'attributed', ai_paths: ['gone.ts', 'live.ts'] }]
    const withStale = aggregateBySubject({ entries, classification: cls, numstatByCommit: { a: { stats, undetermined: [] } }, stalePathKeys: new Set(['a::gone.ts']) })
    const s = withStale.subjects[0]
    if (s.files !== 1 || s.lines_added !== 3 || s.stale_path_files !== 1) throw new Error(JSON.stringify(s))
    const withoutStale = aggregateBySubject({ entries, classification: cls, numstatByCommit: { a: { stats, undetermined: [] } } })
    if (withoutStale.subjects[0].files !== 2 || withoutStale.subjects[0].lines_added !== 12) throw new Error(JSON.stringify(withoutStale.subjects[0]))
  })
  t('有效条目为 0 ⇒ 分桶/重复主张两轴均 unjudged(不记绿)', () => {
    const agg = aggregateBySubject({ entries: [], classification: {}, numstatByCommit: {} })
    if (agg.state !== 'unjudged') throw new Error(JSON.stringify(agg))
    const r = buildReportData({
      repoDir: 'x',
      ref: 'refs/notes/ihui-ai',
      namespace: 'default',
      rangeSpec: {},
      commits: ['a'],
      notesIndex: { refPresent: false, total: 0, inRange: 0 },
      indexParse: { undetermined: [] },
      classification: { a: { ...classifyCommit({ hasNote: false }), hasNote: false } },
      entries: [],
      numstatByCommit: {},
      headTree: new Map(),
      treeState: 'ok',
      perCommitVerify: [],
    })
    if (r.duplicate_claims.state !== 'unjudged' || r.stale.state !== 'unjudged') throw new Error(JSON.stringify(r.axes))
    if (r.stale.per_file_content_hash.state !== 'unjudged') throw new Error('内容级失效被冒判了')
  })
  t('主张路径不在 HEAD 树 ⇒ path_gone 点名且不记有效;HEAD 树取不到 ⇒ 该档 unjudged', () => {
    const cls = { a: { bucket: 'attributed_record', validAttribution: true, hasNote: true } }
    const entries = [{ session: 'S', commit: 'a', status: 'attributed', ai_paths: ['gone.ts', 'live.ts'] }]
    const judged = aggregateStale({ classification: cls, commits: ['a'], entries, headTree: new Map([['live.ts', 'b'.repeat(40)]]), treeState: 'ok' })
    if (judged.counts.path_gone_at_head !== 1 || judged.named.path_gone_at_head[0].path !== 'gone.ts') throw new Error(JSON.stringify(judged.counts))
    const unjudged = aggregateStale({ classification: cls, commits: ['a'], entries, headTree: new Map(), treeState: 'unjudged:HEAD 取不到' })
    if (unjudged.counts.path_gone_at_head !== 0 || unjudged.head_tree_state.startsWith('unjudged') === false) throw new Error(JSON.stringify(unjudged))
  })
  t('闭集参数:未知旗标抛、缺取值抛、--since 非日期抛', () => {
    for (const bad of [['--bogus-flag'], ['--limit'], ['--since', 'not-a-date'], ['--limit', '0'], ['--json', '--oops']]) {
      let threw = false
      try {
        parseArgs(bad)
      } catch {
        threw = true
      }
      if (!threw) throw new Error(`闭集参数未拦住:${bad.join(' ')}`)
    }
    const ok = parseArgs(['--since', '2026-10-01', '--limit', '5', '--namespace', 'wip', '--json'])
    if (ok.limit !== 5 || ok.namespace !== 'wip' || ok.since !== '2026-10-01' || !ok.json) throw new Error(JSON.stringify(ok))
    if (parseArgs(['--help']).help !== true) throw new Error('--help 必须被认')
    if (parseArgs(['--range', 'HEAD~5..HEAD']).range !== 'HEAD~5..HEAD') throw new Error('--range 未透传')
  })
  let pass = 0
  for (const c of cases) {
    try {
      c.fn()
      pass += 1
    } catch (e) {
      console.error(`✗ ${c.name}:${e.message}`)
    }
  }
  console.log(pass === cases.length ? `self-test: ${pass}/${cases.length} passed` : `self-test: ${pass}/${cases.length} passed(有失败)`)
  return pass === cases.length ? EXIT.ok : EXIT.undetermined
}

// ── 人类可读摘要 ────────────────────────────────────────────────────────────
export function summaryLines(r) {
  const ax = (k) => `[${k}] state=${r.axes[k]}`
  return [
    `AI-authorship-report ref=${r.notes.ref} ref存在=${r.notes.ref_present} 范围=${r.range.kind}:${String(r.range.expression ?? '').slice(0, 60)} commits=${r.range.resolved}`,
    `  ${ax('coverage')} 带记录=${r.coverage.with_record} 不带记录=${r.coverage.without_record} 覆盖率=${r.coverage.coverage_pct}% 未判定合计=${r.coverage.unjudged_total}(不带记录≠人类写的)`,
    `  ${ax('by_subject')} 主体数=${r.by_subject.subjects.length} 有效条目外被剔除=${r.by_subject.entries_excluded_as_invalid}`,
    ...r.by_subject.subjects.map((s) => `    · ${s.session}: 条目=${s.entries} commit=${s.commits} 文件=${s.files} +${s.lines_added}/-${s.lines_removed} 二进制=${s.binary_files} 行数未判定=${s.lines_unjudged_files} 失效路径已扣=${s.stale_path_files}`),
    `  ${ax('duplicate_claims')} 跨席重复主张=${r.duplicate_claims.count} 处`,
    ...r.duplicate_claims.items.slice(0, 20).map((d) => `    · ${d.path} ⇐ ${d.sessions.join(',')}(${d.commits.length} 枚 commit)`),
    `  ${ax('stale')} 载荷fp不符=${r.stale.counts.payload_fp_mismatch} 载荷坏=${r.stale.counts.note_malformed} 取不到=${r.stale.counts.note_unreadable} 路径已不在HEAD树=${r.stale.counts.path_gone_at_head} 内容级=${r.stale.per_file_content_hash.state}`,
    ...(r.notes.index_undetermined_lines.length ? [`  ⚠ notes 索引有 ${r.notes.index_undetermined_lines.length} 行形态不认得(未判定,已点名)`] : []),
    ...(r.claims_outside_commit_diff?.length ? [`  ⚠ 主张路径不在该枚改动集:${r.claims_outside_commit_diff.length} 处(前 5:${r.claims_outside_commit_diff.slice(0, 5).join(' | ')})`] : []),
    `  四问全部判定=${r.all_axes_judged ? '是' : '否(存在未判定维度 ⇒ RC=2)'}`,
  ]
}

export function main(argv = process.argv.slice(2)) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    console.error(`✗ ${e.message}`)
    console.error('未执行任何取数(闭集参数闸,缺陷先例 90981bad2b)。--help 看可收旗标。')
    return EXIT.undetermined
  }
  if (opts.help) {
    console.log(helpText())
    return EXIT.ok
  }
  if (opts.selfTest) return selfTest()
  const built = runReport(opts)
  if (built.fatal) {
    console.error(`未判定:${built.fatal}`)
    return EXIT.undetermined
  }
  const r = built.report
  if (opts.json) console.log(JSON.stringify(r, null, 2))
  else for (const l of summaryLines(r)) console.log(l)
  return r.all_axes_judged ? EXIT.ok : EXIT.undetermined
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = {
  EXIT,
  DEFAULT_LIMIT,
  REPORT_SCHEMA_V,
  parseArgs,
  helpText,
  classifyCommit,
  aggregateCoverage,
  aggregateBySubject,
  aggregateStale,
  findDuplicateSubjectClaims,
  buildReportData,
  runReport,
  summaryLines,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
