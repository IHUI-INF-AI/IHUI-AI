#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-978004 遗留清偿:unknown 逐枚读钩子日志 → 三格分拣(**只读量算仪**,不是判据,不进提交链)。
 *
 * 成因:统计器 `plan-bypass-ledger-report.mjs` 把无正证提交记为 unknown,并按引用事务见证拆成
 * "本机可疑 / 别机或更早 / 无从分"三格(c9f23d691a),但那只产出名单 —— 台账 G-978004 剩下的活是
 * "按名单逐枚读钩子日志"。本器把这一步自动化:对每枚 unknown 提交,汇集四路证据
 *   ① 一方记录 `.workbuddy/hook-logs/pre-commit-rounds.jsonl`(0c9e3f5fb2 起,钩子自报本轮 headBefore
 *      / 暂存集 / 门是否跑过 / 是否红 / 退出码);
 *   ② 回显轮 `.workbuddy/hook-logs/pre-commit.log`(含轮转副本 `.log.1` —— **统计器只读 `.log`,
 *      09-22..09-28 那一段的轮次它从未见过,这是本器能翻案的第一格来源);
 *      每轮取 `staged 文件清单(N 个):` + `- 路径` + `失败: N` + 尾部失败门点名(`· [id] 名` / `单独复现:`);
 *   ③ 引用事务见证 `.workbuddy/commit-witness.log`(--no-verify 跳不掉的 ref 变更正证);
 *   ④ reflog(HEAD + --all)的落 ref 选择器 —— 只当**正证**用:`commit:` 选择器 = 本机 git commit 创建;
 *      空选择器 = plumbing/ref-move 落地痕迹;其余(integration)或无记录 = 不作数。
 *      (reflog 被重建/分支删除截断过,缺席绝不反证"别机",只报语境。)
 *
 * 三格口径(每枚一个格子,证据行随行附上):
 *   A 有门痕迹且无红 —— 一方记录完全正证(headBefore==父 ∧ 门跑过 ∧ 绿 ∧ exit 0 ∧ 文件面 ⊆ 本轮所见)
 *                       或窗口内存在覆盖本次文件面的零失败回显轮(文件面 ⊆ 回显集,超集也算 —— lint-staged
 *                       改写 / 并发会话同窗 stage 别的文件都会破坏逐字等值,那正是 unknown 的成因)。
 *   B 痕迹不足无法判定 —— 日志未覆盖该时刻 / 无本机落地正证且无覆盖轮次 / 覆盖轮无结局(中断)等。
 *                       **不硬分类**:证据够不到哪格就说哪格,并在报告里给"疑似但证据不足"池的计数。
 *   C 明确跳门 —— 本机落地正证(见证 ∨ reflog `commit:` ∨ 空选择器且时刻贴近)∧ 日志时代 ∧ 窗口内
 *                       不存在覆盖本次文件面的绿轮:最后覆盖轮为红(附失败门名)/ 一方记录红或
 *                       批门绿但后续步骤红 / 窗口内根本没有覆盖轮次(钩子从未见过本次文件面)。
 *
 * 三条口径与统计器同源:
 *   1. 取不到就说"未判定"并点名原因,绝不用 0 冒充结论(标记解析失败 / 轮次计数对不上 / reflog 不可用
 *      都进"未判定维度",不静默)。
 *   2. 只读:不写 .git、不改任何被审对象;唯一的落盘是 `--report <path>` 指定的人读报告。
 *   3. 派生一律经 `scripts/lib/bypass-git.mjs` 的 `git()`(绝对路径 + timeout + windowsHide)。
 *
 * 用法:node scripts/analyze-hook-log-unknown.mjs [--since YYYY-MM-DD] [--until YYYY-MM-DD]
 *          [--limit N] [--window-min N] [--sample N] [--json] [--report PATH] [--root DIR] [--self-test]
 * 缺省窗口 since=2026-09-29(台账 G-978004 读数的 09-29/30 窗口起点;数字一律现读,勿照抄台账)。
 * 退出码:0 = 报告已产出(有未判定也是 0 —— 量算仪不阻断任何东西);1 = --self-test 有失败例;
 *         2 = 脚本自身异常(取数层抛出,不是业务结论)。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { git } from './lib/bypass-git.mjs'
import { readLedgerRecords } from './lib/commit-attestation.mjs'
import {
  classifyAll,
  indexLedger,
  parseHookRounds,
  readFirstPartyRounds,
  readWitness,
} from './plan-bypass-ledger-report.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 作者本地日(%aI 带作者时区偏移,切前 10 位即作者本地日;与统计器同一形态)。 */
const dayKey = (iso) => String(iso ?? '').slice(0, 10)

const HOOK_LOG_REL = '.workbuddy/hook-logs'
const DEFAULT_SINCE = '2026-09-29'
const DEFAULT_WINDOW_MIN = 30
const LOG_LIMIT_DEFAULT = 20_000

const MARKER_RE = /^==== (.+?) :: (.*?) ====$/
const ECHO_RE = /staged 文件清单\((\d+) 个\)[:：]\s*$/
const LIST_RE = /^-\s+(\S.*)$/
const FAIL_RE = /^失败:\s*(\d+)/
const DURATION_RE = /^总耗时[:：]\s*([\d.]+)\s*s/
const GATE_RE = /^·\s*\[(\S+)\]\s+(.+)$/
const CMD_RE = /^单独复现[:：]\s*(.+)$/
const LINT_FAIL_RE = /运行 lint-staged\.\.\.失败/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * vbs 的 `Now` 是机器本地时刻(`2026/9/28 20:33:03` 形态);本器与写入方同机,按本地时区构造。
 * 解析不出 ⇒ null(该轮进"未判定维度",绝不冒充一个时刻)。
 */
export function parseVbsTimestamp(s) {
  const m = MARKER_RE.exec(String(s ?? '').trim())
  if (!m) return null
  const t = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/.exec(m[1])
  if (!t) return null
  return new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3]), Number(t[4]), Number(t[5]), Number(t[6]))
}

/** 轮转副本排序:`.log` 最新在最后,`.N` 数字越大越旧(本仓现只有 .1,写成通用形态)。 */
export function hookLogFiles(root) {
  const dir = resolve(root, HOOK_LOG_REL)
  if (!existsSync(dir)) return { ok: false, state: 'missing', why: `${dir} 不存在`, files: [] }
  const all = readdirSync(dir).filter((f) => /^pre-commit\.log(\.\d+)?$/.test(f))
  const sorted = all.sort((a, b) => {
    const na = /^\.(\d+)$/.exec(a.slice('pre-commit.log'.length))
    const nb = /^\.(\d+)$/.exec(b.slice('pre-commit.log'.length))
    if (na && nb) return Number(nb[1]) - Number(na[1])
    if (na) return -1
    if (nb) return 1
    return 0
  })
  return { ok: true, state: 'read', files: sorted.map((f) => resolve(dir, f)) }
}

/**
 * 钩子日志文本 → 调用段(marker 分段),每段携带**轮次数组**:
 *   段 = { ts, target, rounds: [{ echoFiles, failed, failedGates }], lintStagedFailed }。
 * 与统计器 roundCollector 同一套行判据(回显、清单、汇总),另加 marker / 失败门点名两条;
 * 两把尺子对同一份日志的"完整轮数"必须一致,不一致进未判定维度(防本器自己读歪)。
 * 为什么段内是数组而不是单个轮:vbs 写 marker 包在 On Error Resume Next 里,偶发丢 marker 会把
 * 两次调用并成一段 —— 段内轮次各自成对(回显↔汇总),只共享一个(偏晚的)marker 时刻,
 * 该形态单独计数进报告,不冒充"看见了一次调用"。
 * 纯函数:输入文本,不碰文件系统(自检直接喂构造文本,不落任何临时文件)。
 */
export function parseHookSegmentsFromText(text) {
  const segments = []
  let seg = null
  let rnd = null
  const newSeg = (ts, target) => {
    seg = { ts, target, rounds: [], lintStagedFailed: false }
    segments.push(seg)
    rnd = null
  }
  // 首条 marker 之前的内容无法归属到任何一次调用,整段丢弃(不冒充一轮)。
  seg = null
  rnd = null
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/\u001b\[[0-9;]*m/g, '')
    const l = line.trim()
    const mk = MARKER_RE.exec(l)
    if (mk) {
      newSeg(parseVbsTimestamp(l), mk[2])
      continue
    }
    if (!seg) newSeg(null, '(无 marker)')
    const echo = ECHO_RE.exec(l)
    if (echo) {
      rnd = { echoFiles: [], failed: null, durationS: null, failedGates: [], collecting: true }
      seg.rounds.push(rnd)
      continue
    }
    if (rnd && rnd.collecting) {
      const f = LIST_RE.exec(l)
      if (f) {
        rnd.echoFiles.push(f[1].trim())
        continue
      }
      if (l !== '') rnd.collecting = false
    }
    const fail = FAIL_RE.exec(l)
    if (fail) {
      if (rnd && rnd.failed === null) rnd.failed = Number(fail[1])
      continue
    }
    const dur = DURATION_RE.exec(l)
    if (dur && rnd && rnd.durationS === null) rnd.durationS = Number(dur[1])
    const g = GATE_RE.exec(l)
    if (g) {
      if (rnd) rnd.failedGates.push({ id: g[1], name: g[2].trim(), cmd: null })
      continue
    }
    const c = CMD_RE.exec(l)
    if (c && rnd && rnd.failedGates.length > 0 && rnd.failedGates[rnd.failedGates.length - 1].cmd === null) {
      rnd.failedGates[rnd.failedGates.length - 1].cmd = c[1].trim()
      continue
    }
    if (LINT_FAIL_RE.test(l)) seg.lintStagedFailed = true
  }
  for (const s of segments) for (const r of s.rounds) delete r.collecting
  return segments
}

/** 段内 >1 轮 ⇒ vbs 的 marker 写入被吞(On Error Resume Next)⇒ 至少两次调用并成了一段。 */
export function countMergedSegments(segments) {
  return segments.filter((s) => s.rounds.length > 1).length
}

export function readHookSegments(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    return { ok: false, state: e?.code === 'ENOENT' ? 'missing' : 'unreadable', why: String(e?.message ?? e).slice(0, 120), segments: [] }
  }
  return { ok: true, state: 'read', segments: parseHookSegmentsFromText(text), size: Buffer.byteLength(text, 'utf8') }
}

/** 轮转族全量读取:段拼接 + 覆盖面自证(首末 marker 时刻)。 */
export function readAllHookSegments(root) {
  const fam = hookLogFiles(root)
  if (!fam.ok) return { ok: false, state: fam.state, why: fam.why, segments: [], coverage: null, files: [] }
  const segments = []
  const files = []
  for (const p of fam.files) {
    const r = readHookSegments(p)
    if (!r.ok) return { ok: false, state: r.state, why: `${p}: ${r.why}`, segments: [], coverage: null, files }
    files.push({ file: p, segments: r.segments.length, size: r.size })
    segments.push(...r.segments)
  }
  const tsed = segments.filter((s) => s.ts instanceof Date && !Number.isNaN(s.ts.getTime()))
  const coverage = tsed.length
    ? { first: tsed[0].ts, last: tsed[tsed.length - 1].ts, unparsedMarkers: segments.length - tsed.length }
    : null
  return { ok: true, state: 'read', segments, coverage, files }
}

/**
 * 自己取提交面:与统计器 collectCommits 同形,但多取 **%cI(提交者时刻)** ——
 * 钩子在提交落地前一刻跑,归属窗口必须锚在 committer 时刻上(author 时刻会被 rebase/amend 挪走)。
 * 覆盖面三态语义照抄统计器(covered / not-covered / cap-hit)。
 */
export function collectCommitsFull({ root, limit = LOG_LIMIT_DEFAULT, sinceDay = '0000-00-00', untilDay = '9999-99-99' } = {}) {
  let out
  try {
    out = git(
      ['log', '-n', String(limit), '--no-merges', '--no-renames', '--format=@%H%x09%P%x09%aI%x09%cI', '--name-only'],
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
      const [sha, parents, aIso, cIso] = line.slice(1).split('\t')
      const ms = Date.parse(aIso)
      const cMs = Date.parse(cIso)
      cur = {
        sha,
        parents: (parents || '').split(' ').filter(Boolean),
        parent: (parents || '').split(' ')[0] || '',
        iso: aIso,
        ms: Number.isFinite(ms) ? ms : null,
        cIso,
        cMs: Number.isFinite(cMs) ? cMs : null,
        day: dayKey(aIso),
        files: [],
      }
      continue
    }
    const t = line.trim()
    if (cur && t !== '') cur.files.push(t)
  }
  if (cur) commits.push(cur)
  const inWin = commits.filter((c) => c.day >= sinceDay && c.day <= untilDay)
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

/**
 * reflog → 每 sha 的落 ref 选择器分类。只当**正证**用:
 *   commit-local   —— 某条选择器以 `commit:` / `commit (` 开头 ⇒ 本机 git commit 创建(钩子应跑而未跑才是跳门);
 *   plumbing-empty —— 只有空选择器条目 ⇒ ref 曾被无消息移动(update-ref/commit-tree 落地痕迹),时刻贴近才算本机落地;
 *   integration    —— 只有 merge/pull/reset/rebase 等 ⇒ 内容经整合进入,创建时刻本机不可见;
 *   absent         —— reflog 无此 sha(被重建/分支删除截断过)⇒ **不作数**,不反证。
 * 返回 { ok, state, bySha: Map<sha, {cls, emptyIso|null}>, badLines }。
 */
export function classifyReflog(root) {
  const bySha = new Map()
  let badLines = 0
  const feed = (out, refField) => {
    for (const line of String(out).split(/\r?\n/)) {
      if (!line) continue
      const [sha, ref, sel, iso] = line.split('\t')
      if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
        badLines++
        continue
      }
      const e = { sel: sel ?? '', iso: iso ?? null, ref: refField === 'all' ? ref : 'HEAD' }
      if (!bySha.has(sha)) bySha.set(sha, [])
      bySha.get(sha).push(e)
    }
  }
  try {
    feed(git(['reflog', 'HEAD', '--format=%H%x09%gD%x09%gs%x09%cI'], { root, timeout: 60_000 }), 'HEAD')
  } catch (e) {
    return { ok: false, state: 'unavailable', why: `HEAD reflog 取不到:${String(e?.message ?? e).slice(0, 120)}`, bySha, badLines }
  }
  try {
    feed(git(['reflog', '--all', '--format=%H%x09%gD%x09%gs%x09%cI'], { root, timeout: 60_000 }), 'all')
  } catch {
    /* --all 失败不致命:HEAD reflog 仍在,报告里注明这一维打折 */
  }
  for (const [sha, entries] of bySha) {
    const isCommit = (e) => /^commit(:| \()/.test(e.sel)
    const isEmpty = (e) => String(e.sel).trim() === ''
    let cls = 'integration'
    let emptyIso = null
    if (entries.some(isCommit)) cls = 'commit-local'
    else if (entries.some(isEmpty)) {
      cls = 'plumbing-empty'
      for (const e of entries) if (isEmpty(e) && e.iso && (emptyIso === null || Date.parse(e.iso) < Date.parse(emptyIso))) emptyIso = e.iso
    }
    // integration 只报语境用:留一条代表选择器,让证据行说得出"经什么进入"。
    const sampleSel = cls === 'integration' ? (entries.find((e) => e.sel)?.sel ?? '') : null
    bySha.set(sha, { cls, emptyIso, sampleSel })
  }
  return { ok: true, state: 'read', bySha, badLines }
}

/** 提交文件面 ⊆ 回显/一方记录的暂存集(超集即算覆盖;等值只是它的特例)。接受 Set 或数组(调用段是数组)。 */
export function covers(commitFiles, staged) {
  if (!commitFiles.length || !staged) return false
  const has = staged instanceof Set ? (f) => staged.has(f) : (f) => staged.includes(f)
  return commitFiles.every(has)
}

/**
 * 单枚 unknown 提交的三格分拣(纯函数;全部证据由调用方收集好传入)。
 * 返回 { cell: 'A'|'B'|'C', sub, evidence: string[] }。
 * 判定次序刻意为:正证(A)→ 红证(C)→ 无结局/无证据(B)—— 正证优先于红证(绿轮放行是更强的那个事实)。
 */
export function triageUnknown({
  commit,
  logCovered,
  windowRounds,
  windowInvocations,
  firstPartyForParent,
  witnessed,
  reflog,
  windowMinMs,
}) {
  const ev = []
  const F = commit.files
  const cMs = commit.cMs
  if (!logCovered) {
    if (reflog && reflog.cls === 'commit-local') ev.push('reflog:本机 commit 创建(但钩子日志未覆盖该时刻,2026-09-22 前无日志)')
    if (witnessed) ev.push('见证:sha 在引用事务见证文件里')
    return { cell: 'B', sub: 'log-gap', evidence: ev.length ? ev : ['钩子日志未覆盖该时刻(首条 marker 之前)'] }
  }
  if (F.length === 0) return { cell: 'B', sub: 'empty-files', evidence: ['提交文件面为空,回显/暂存集归属无从谈起'] }

  // reflog 语境:每格证据都带上(正面证词与反证词都要可见,不许只挑有利的一边)。
  const reflogNote = reflog
    ? reflog.cls === 'commit-local'
      ? 'reflog:有本机 `commit:` 选择器(本机 git commit 创建)'
      : reflog.cls === 'plumbing-empty'
        ? `reflog:仅空选择器条目(落 ref 无消息 = update-ref/commit-tree 形态${reflog.emptyIso ? `,${reflog.emptyIso}` : ',时刻未知'})`
        : `reflog:仅整合型选择器(如 \`${reflog.sampleSel ?? '?'}\`)`
    : 'reflog:无此 sha 的记录(分支删除/日志重建截断;不作数,也不反证)'
  // reflog 显示经整合(reset/pull/merge/fetch)进入 ⇒ 落地本就不触发 pre-commit(结构性),
  // 其门禁在创建地 —— 本机窗口无论量到什么都不构成对该枚的判定,一律 B。
  if (reflog && reflog.cls === 'integration') {
    return {
      cell: 'B',
      sub: 'integrated',
      evidence: [
        reflogNote,
        '⇒ reflog 现存选择器显示经 reset/pull/merge 进入本仓(不排除更早的本机创建记录已被日志截断):整合落地本就不触发钩子是结构性的,门禁判定属创建地,本机日志无从谈起 ⇒ 保守不指控',
      ],
    }
  }

  const localBits = []
  if (witnessed) localBits.push('见证命中')
  if (reflog && reflog.cls === 'commit-local') localBits.push('reflog=本机 commit 创建')
  if (reflog && reflog.cls === 'plumbing-empty' && reflog.emptyIso) {
    const d = Math.abs(cMs - Date.parse(reflog.emptyIso))
    if (d <= 10 * 60_000) localBits.push(`reflog=空选择器(落 ref 无消息,距落地 ${Math.round(d / 60_000)} 分钟)`)
  }
  const localEvidence = localBits.length > 0

  // 一方记录(钩子自报;headBefore==父 是精确锚,不受窗口影响)。
  // readFirstPartyRounds 里 ts 保持 JSON 字符串形态 ⇒ 这里统一 parse 成 ms 再比,不得拿字符串与数字比较。
  const fp = (firstPartyForParent ?? [])
    .map((r) => ({ ...r, tsMs: r.ts ? Date.parse(r.ts) : null }))
    .filter((r) => cMs === null || r.tsMs === null || Number.isNaN(r.tsMs) || r.tsMs <= cMs + 5 * 60_000)
  const fpCovers = (r) => covers(F, r.files)
  const fpGreenFull = fp.filter((r) => r.gatesRan && r.gatesPassed === true && r.exitCode === 0 && fpCovers(r))
  const fpRedFull = fp.filter((r) => r.gatesRan && r.gatesPassed === false && fpCovers(r))
  const fpLateBlock = fp.filter((r) => r.gatesRan && r.gatesPassed === true && r.exitCode !== 0 && fpCovers(r))
  const fpNoRun = fp.filter((r) => !r.gatesRan && fpCovers(r) && r.exitCode !== 0)

  // 回显轮(窗口内;marker 时刻锚定;无汇总行 = 无结局轮,单独判)
  const covering = windowRounds.filter((s) => s.failed !== null && covers(F, s.set))
  const lastCover = covering.length ? covering[covering.length - 1] : null
  const incompleteCovering = windowRounds.filter((s) => s.failed === null && covers(F, s.set))

  if (fpGreenFull.length > 0) {
    const r = fpGreenFull[0]
    ev.push(`一方记录 ${r.ts ?? '?'} headBefore=父 门跑过且绿 exit=0,本轮所见 ${r.files.size} 文件 ⊇ 本次 ${F.length}`)
    if (fp.length > 1) ev.push(`同父一方记录共 ${fp.length} 条(并发/重试;一条记录只证"门看过这些文件",不证落地的正是它)`)
    return { cell: 'A', sub: 'fp-full', evidence: ev }
  }
  if (lastCover && lastCover.failed === 0) {
    const delta = lastCover.set.size - F.length
    ev.push(`回显轮 ${fmtTs(lastCover.ts)} 失败:0,回显 ${lastCover.set.size} 文件 ⊇ 本次 ${F.length}(超集差 ${delta})`)
    // 关键绑定条件:该轮必须**在落地前完成**。并发会话同时写同一份日志 + vbs 偶发吞 marker,
    // 会让"回显↔汇总"的配对漂到别的调用上;若轮次批量(总耗时)算到落地之后才结束,
    // 它就不可能是本次提交的服务轮 —— 正证不成立,降格 B(不可用带病正证发合格证)。
    const endMs = lastCover.endMs
    if (endMs !== null && endMs > cMs + 60_000) {
      ev.push(`但该轮批量至 ${fmtTs2(endMs)} 才结束,晚于落地(${fmtTs2(cMs)})超过 1 分钟 ⇒ 不可能是本次提交的服务轮(并发交错/丢 marker)`)
      ev.push(reflogNote)
      return { cell: 'B', sub: 'green-round-not-mine', evidence: ev }
    }
    ev.push(`轮末 ${endMs !== null ? fmtTs2(endMs) : '(总耗时未解析,按 marker 计)'} ≤ 落地 ${fmtTs2(cMs)} ⇒ 可为本次提交的服务轮`)
    ev.push(`窗口距落地 ${Math.round((cMs - lastCover.ts.getTime()) / 60_000)} 分钟`)
    if (delta === 0) ev.push('注:回显与提交文件面逐字等值 ⇒ 统计器判 unknown 说明该轮已被同父兄弟提交消费')
    return { cell: 'A', sub: 'echo-green', evidence: ev }
  }
  if (fpRedFull.length > 0) {
    const r = fpRedFull[fpRedFull.length - 1]
    ev.push(`一方记录 ${r.ts ?? '?'} headBefore=父 门跑过且红 exit=${r.exitCode},本轮所见 ${r.files.size} 文件 ⊇ 本次 ${F.length}`)
    return { cell: 'C', sub: 'fp-red', evidence: ev }
  }
  if (fpLateBlock.length > 0) {
    const r = fpLateBlock[fpLateBlock.length - 1]
    ev.push(`一方记录 ${r.ts ?? '?'} 批量门绿但后续 blocking 步骤使 exit=${r.exitCode},提交仍落地 ⇒ 链未走完`)
    return { cell: 'C', sub: 'fp-late-block', evidence: ev }
  }
  if (fpNoRun.length > 0) {
    const r = fpNoRun[fpNoRun.length - 1]
    ev.push(`一方记录 ${r.ts ?? '?'} 门未及运行即退(lint-staged 等)exit=${r.exitCode},提交仍落地`)
    return { cell: 'C', sub: 'fp-noran', evidence: ev }
  }
  if (lastCover && lastCover.failed > 0) {
    const names = lastCover.failedGates.slice(0, 4).map((g) => `[${g.id}] ${g.name}`).join(' / ') || '(失败门名未解析出)'
    ev.push(`回显轮 ${fmtTs(lastCover.ts)} 失败:${lastCover.failed},回显 ${lastCover.set.size} 文件 ⊇ 本次 ${F.length}`)
    ev.push(`失败门:${names}`)
    // 同 A 的绑定条件:红轮必须先于落地结束,才谈得上"被它拦下后绕行落地"。
    const endMs = lastCover.endMs
    if (endMs !== null && endMs > cMs + 60_000) {
      ev.push(`但该轮批量至 ${fmtTs2(endMs)} 才结束,晚于落地(${fmtTs2(cMs)})超过 1 分钟 ⇒ 该红轮不构成对本次落地的拦截(并发交错)`)
      return { cell: 'B', sub: 'red-context', evidence: ev }
    }
    ev.push(`其红轮于 ${endMs !== null ? fmtTs2(endMs) : '(总耗时未解析)'}结束 ≤ 落地 ${fmtTs2(cMs)},其后无覆盖绿轮 ⇒ 落地未经绿轮放行`)
    if (!localEvidence) ev.push(`无本机落地正证(${localBits.join('、') || '见证未命中 / reflog 无 commit 选择器'})⇒ 降格 B`)
    return localEvidence ? { cell: 'C', sub: 'echo-red', evidence: ev } : { cell: 'B', sub: 'red-context', evidence: ev }
  }
  if (incompleteCovering.length > 0) {
    ev.push(`窗口内有 ${incompleteCovering.length} 轮覆盖本次文件面但无结局(无汇总行 = 中断/截断),绿红均不可证`)
    return { cell: 'B', sub: 'incomplete-round', evidence: ev }
  }
  const invocations = windowInvocations
  if (localEvidence) {
    ev.push(`本机落地正证:${localBits.join(' + ')}`)
    ev.push(reflogNote)
    ev.push(`窗口(${windowMinMs / 60_000} 分钟)内钩子调用 ${invocations} 次,无任何一轮的暂存集覆盖本次 ${F.length} 个文件`)
    ev.push('⇒ 本机落地当刻,钩子从未见过本次文件面(未调用或未覆盖)⇒ 门禁未看过本次内容')
    return { cell: 'C', sub: 'no-hook-trace', evidence: ev }
  }
  ev.push(`窗口内钩子调用 ${invocations} 次,无覆盖轮次`)
  ev.push(`本机落地正证:无;${reflogNote}`)
  ev.push('⇒ 可能别机产生或更早落地,本机日志无从定其门禁 ⇒ 不指控')
  return { cell: 'B', sub: 'no-evidence', evidence: ev }
}

const fmtTs = (d) => (d instanceof Date ? d.toLocaleString('sv-SE', { hour12: false }) : String(d))
const fmtTs2 = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleString('sv-SE', { hour12: false }) : '?')

/** 本机本地日(与统计器 resolveWindow 的 localDay 同一量纲;dayKey(iso) 切的是作者本地日,勿混用 UTC)。 */
function localDay(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function run({ argv }) {
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : REPO_ROOT
  const asJson = argv.includes('--json')
  const get = (name, dflt) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : dflt
  }
  const since = get('--since', DEFAULT_SINCE)
  const until = get('--until', null)
  const limit = Number(get('--limit', LOG_LIMIT_DEFAULT))
  const windowMin = Number(get('--window-min', DEFAULT_WINDOW_MIN))
  const sampleN = Number(get('--sample', 5))
  const reportPath = argv.includes('--report') ? resolve(argv[argv.indexOf('--report') + 1]) : null
  const today = localDay(Date.now())
  if (!DAY_RE.test(since)) {
    console.error(`❌ --since 不是 YYYY-MM-DD:${since}`)
    return 2
  }
  const untilDay = until ? (DAY_RE.test(until) ? until : (console.error(`❌ --until 不是 YYYY-MM-DD:${until}`), null)) : today
  if (!untilDay || untilDay < since) {
    console.error(`❌ 窗口非法:since=${since} until=${untilDay}`)
    return 2
  }
  const windowMinMs = windowMin * 60_000

  // ── 证据源 ─────────────────────────────────────────────────────────
  const ledger = readLedgerRecords(root)
  const index = indexLedger(ledger.records)
  const witness = readWitness(root)
  const firstParty = readFirstPartyRounds(root)
  const hook = readAllHookSegments(root)
  const reflog = classifyReflog(root)

  // 统计器判四态(喂全新副本 —— classifyAll 会就地消费轮次,不得污染本器自己的证据面)。
  const allRounds = hook.ok
    ? hook.segments.flatMap((s) =>
        s.rounds
          .filter((r) => r.echoFiles)
          .map((r) => ({
            ts: s.ts,
            files: r.echoFiles,
            failed: r.failed,
            failedGates: r.failedGates,
            endMs: s.ts && r.durationS !== null ? s.ts.getTime() + r.durationS * 1000 : null,
          })),
      )
    : []
  const echoRoundsFresh = allRounds.filter((r) => r.failed !== null).map((r) => ({ files: [...r.files], declared: r.files.length, failed: r.failed, consumed: false }))
  const crossCheck = hook.ok ? parseHookRounds(readAllRawText(root)).length : -1
  const completeRounds = echoRoundsFresh.length
  const roundsMismatch = crossCheck >= 0 && crossCheck !== completeRounds
  const mergedSegments = hook.ok ? countMergedSegments(hook.segments) : 0

  const got = collectCommitsFull({ root, limit, sinceDay: since, untilDay })
  if (!got.ok) {
    console.error(`❌ 提交清单取不到 ⇒ 未判定,不产出任何三格结论:${got.why}`)
    return 0
  }
  const commits = got.commits
  const classification = classifyAll({
    commits,
    index,
    rounds: echoRoundsFresh.map((r) => ({ ...r, files: [...r.files], consumed: false })),
    ledgerReadable: ledger.ok,
    ledgerState: ledger.state,
    roundsAvailable: hook.ok,
    witness,
    firstParty: firstParty.ok
      ? { ok: true, state: firstParty.state, rounds: firstParty.rounds.map((r) => ({ ...r, files: new Set(r.files), consumed: false })) }
      : firstParty,
  })
  const unknowns = classification.detail.filter((d) => d.state === 'unknown')
  const byShortSha = new Map()
  for (const c of commits) {
    const k = c.sha.slice(0, 11)
    if (!byShortSha.has(k)) byShortSha.set(k, c)
  }

  const logStartMs = hook.ok && hook.coverage ? hook.coverage.first.getTime() : null
  const logEndMs = hook.ok && hook.coverage ? hook.coverage.last.getTime() : null
  const fpByParent = new Map()
  if (firstParty.ok) for (const r of firstParty.rounds) fpByParent.set(r.headBefore, [...(fpByParent.get(r.headBefore) ?? []), r])

  const logCovered = (c) =>
    logStartMs !== null && c.cMs !== null && c.cMs >= logStartMs - 60_000 && c.cMs <= logEndMs + 60_000

  const results = []
  for (const u of unknowns) {
    const c = byShortSha.get(u.sha)
    if (!c) {
      results.push({ sha: u.sha, day: u.day, cell: 'B', sub: 'internal-miss', evidence: ['internal:unknown 的短 sha 在提交面里找不到(不应发生)'] })
      continue
    }
    const start = c.cMs === null ? null : c.cMs - windowMinMs
    const end = c.cMs
    const inWin = (ms) => ms !== null && ms >= start && ms <= end
    const windowRounds =
      hook.ok && start !== null
        ? allRounds
            .filter((r) => inWin(r.ts ? r.ts.getTime() : null))
            .map((r) => ({ ts: r.ts, set: new Set(r.files), failed: r.failed, failedGates: r.failedGates, endMs: r.endMs }))
        : []
    const windowInvocations =
      hook.ok && start !== null ? hook.segments.filter((s) => inWin(s.ts ? s.ts.getTime() : null)).length : 0
    const witnessed = witness.ok ? witness.shas.has(c.sha) : false
    const reflogInfo = reflog.ok ? reflog.bySha.get(c.sha) ?? null : null
    const t = triageUnknown({
      commit: c,
      logCovered: logCovered(c),
      windowRounds,
      windowInvocations,
      firstPartyForParent: fpByParent.get(c.parent) ?? [],
      witnessed,
      reflog: reflogInfo,
      windowMinMs,
    })
    results.push({ sha: c.sha.slice(0, 11), day: c.day, cell: t.cell, sub: t.sub, evidence: t.evidence })
  }

  // ── 汇总 ──────────────────────────────────────────────────────────
  const CELL_NAME = { A: '有门痕迹且无红', B: '痕迹不足无法判定', C: '明确跳门' }
  const byCell = { A: [], B: [], C: [] }
  for (const r of results) byCell[r.cell].push(r)
  const bySub = {}
  for (const r of results) bySub[`${r.cell}/${r.sub}`] = (bySub[`${r.cell}/${r.sub}`] ?? 0) + 1
  const byDayCell = new Map()
  for (const r of results) {
    if (!byDayCell.has(r.day)) byDayCell.set(r.day, { day: r.day, A: 0, B: 0, C: 0 })
    byDayCell.get(r.day)[r.cell]++
  }
  const dayRows = [...byDayCell.values()].sort((a, b) => (a.day < b.day ? 1 : -1))

  const pick = (cell, n) => byCell[cell].slice(0, n)
  const undetermined = [
    !hook.ok ? `钩子日志取不到(${hook.state}:${hook.why ?? ''})` : null,
    hook.ok && hook.coverage && hook.coverage.unparsedMarkers > 0 ? `${hook.coverage.unparsedMarkers} 条 marker 时刻解析不出(那些调用段不参与窗口归属)` : null,
    roundsMismatch ? `轮次计数对不上:分段尺 ${completeRounds} vs 统计器尺 ${crossCheck}(两把尺漂了 ⇒ 覆盖轮判定存疑)` : null,
    mergedSegments > 0 ? `${mergedSegments} 个调用段疑似丢 marker(vbs 吞写)并合并了多次调用:段内各轮共享偏晚的 marker 时刻 ⇒ 窗口归属可能有分钟级偏移(轮次的回显↔汇总配对不受影响)` : null,
    !witness.ok ? `见证文件取不到(${witness.state}:${witness.why ?? ''})⇒ "本机落地正证"这一维打折` : null,
    !firstParty.ok ? `一方记录取不到(${firstParty.state}:${firstParty.why ?? ''})` : null,
    !reflog.ok ? `reflog 取不到(${reflog.state}:${reflog.why ?? ''})⇒ 本机创建正证缺失` : null,
    reflog.ok && reflog.badLines > 0 ? `reflog 坏行 ${reflog.badLines}` : null,
    got.coverage !== 'covered' ? `提交清单覆盖面=${got.coverage}(取数深至 ${got.reachedBackTo})` : null,
  ].filter(Boolean)

  const summary = {
    root,
    window: `${since}..${untilDay}`,
    windowMin,
    statSums: {
      normal: sumOf(classification.rows, 'normal'),
      skipped: sumOf(classification.rows, 'skipped'),
      bypassLanding: sumOf(classification.rows, 'bypassLanding'),
      unknown: sumOf(classification.rows, 'unknown'),
    },
    commits: { counted: classification.detail.length, unknown: results.length, coverage: got.coverage, reachedBackTo: got.reachedBackTo },
    sources: {
      hookLogs: hook.ok ? { files: hook.files, segments: hook.segments.length, rounds: completeRounds, roundsByStatisticiansRuler: crossCheck, coverage: hook.coverage, mergedSegments } : { state: hook.state, why: hook.why },
      firstParty: firstParty.ok ? { records: firstParty.records, badLines: firstParty.badLines } : { state: firstParty.state },
      witness: { ok: witness.ok, state: witness.state, records: witness.records ?? null },
      reflog: reflog.ok ? { state: 'read', shas: reflog.bySha.size, badLines: reflog.badLines } : { state: reflog.state, why: reflog.why },
      ledger: { ok: ledger.ok, records: ledger.records.length },
      roundsMismatch,
    },
    cells: {
      A: byCell.A.length,
      B: byCell.B.length,
      C: byCell.C.length,
      bySub,
      dayRows,
    },
    undetermined,
    detail: results,
  }

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`📊 unknown 逐枚钩子日志分拣 —— ${since}..${untilDay}(窗口 ${windowMin} 分钟,root=${root})`)
    console.log(`  提交面 ${classification.detail.length} 枚,unknown ${results.length} 枚(统计器四态:normal ${sumOf(classification.rows, 'normal')} / skipped ${sumOf(classification.rows, 'skipped')} / bypass ${sumOf(classification.rows, 'bypassLanding')} / unknown ${sumOf(classification.rows, 'unknown')})`)
    if (hook.ok && hook.coverage)
      console.log(`  日志覆盖:${fmtTs(hook.coverage.first)} .. ${fmtTs(hook.coverage.last)}(${hook.files.map((f) => `${f.file.split(/[\\/]/).pop()}:${f.segments} 段`).join(' + ')})`)
    console.log(`  三格:A 有门痕迹且无红 ${byCell.A.length} / B 痕迹不足 ${byCell.B.length} / C 明确跳门 ${byCell.C.length}`)
    for (const [k, n] of Object.entries(bySub)) console.log(`    ${k}: ${n}`)
    console.log(`  未判定维度:${undetermined.length ? undetermined.join(';') : '无'}`)
    for (const cell of ['A', 'C', 'B']) {
      const rows = pick(cell, sampleN)
      if (!rows.length) continue
      console.log(`\n  ── ${CELL_NAME[cell]} 抽样 ${rows.length}/${byCell[cell].length} ──`)
      for (const r of rows) {
        console.log(`   · ${r.sha} ${r.day} ${r.cell}/${r.sub}`)
        for (const e of r.evidence) console.log(`       ${e}`)
      }
    }
  }

  if (reportPath) writeReport(reportPath, { summary, CELL_NAME, sampleN })
  return 0
}

function sumOf(rows, key) {
  return rows.reduce((a, r) => a + (r[key] ?? 0), 0)
}

function readAllRawText(root) {
  const fam = hookLogFiles(root)
  return fam.files.map((p) => readFileSync(p, 'utf8')).join('\n')
}

function writeReport(path, { summary, CELL_NAME, sampleN }) {
  const { window: winLabel, windowMin, statSums, commits, sources, cells, undetermined, detail } = summary
  const L = []
  L.push(`# G-978004 unknown 清偿 —— 逐枚钩子日志分拣报告`)
  L.push('')
  L.push(`- 生成:${new Date().toLocaleString('sv-SE', { hour12: false })};窗口 \`${winLabel}\`;归属窗口 ${windowMin} 分钟(committer 时刻锚定)`)
  L.push(`- 统计器四态现读:normal ${statSums.normal} / skipped ${statSums.skipped} / bypass-landing ${statSums.bypassLanding} / unknown ${statSums.unknown}(提交面 ${commits.counted} 枚,覆盖=${commits.coverage},取数深至 ${commits.reachedBackTo});本次只分拣其中 unknown ${commits.unknown} 枚`)
  L.push(`- 证据源:一方记录 ${sources.firstParty.records ?? '取不到'} 条;钩子日志 ${sources.hookLogs?.rounds ?? '?'} 完整轮 / ${sources.hookLogs?.segments ?? '?'} 调用段(轮转族 ${sources.hookLogs?.files?.map((f) => f.file.split(/[\\/]/).pop()).join(' + ') ?? '?'});见证 ${sources.witness.records ?? '取不到'} 枚;reflog ${sources.reflog.shas ?? '取不到'} sha;台账 ${sources.ledger.records} 条`)
  L.push('')
  L.push(`## 三格分布`)
  L.push('')
  L.push(`| 格 | 枚数 |`)
  L.push(`| --- | --- |`)
  L.push(`| A 有门痕迹且无红 | ${cells.A} |`)
  L.push(`| B 痕迹不足无法判定 | ${cells.B} |`)
  L.push(`| C 明确跳门 | ${cells.C} |`)
  L.push('')
  L.push(`子原因:`)
  L.push('')
  for (const [k, n] of Object.entries(cells.bySub)) L.push(`- \`${k}\`: ${n}`)
  L.push('')
  L.push(`按日:`)
  L.push('')
  L.push(`| 日 | A | B | C |`)
  L.push(`| --- | --- | --- | --- |`)
  for (const r of cells.dayRows) L.push(`| ${r.day} | ${r.A} | ${r.B} | ${r.C} |`)
  L.push('')
  L.push(`## 抽样(每格前 ${sampleN} 枚,带证据行)`)
  L.push('')
  for (const cell of ['A', 'C', 'B']) {
    const rows = detail.filter((r) => r.cell === cell).slice(0, sampleN)
    L.push(`### ${CELL_NAME[cell]}(${cells[cell]} 枚)`)
    L.push('')
    for (const r of rows) {
      L.push(`- ${r.sha} ${r.day} \`${r.cell}/${r.sub}\``)
      for (const e of r.evidence) L.push(`  - ${e}`)
    }
    L.push('')
  }
  L.push(`## 未判定维度`)
  L.push('')
  for (const u of undetermined) L.push(`- ${u}`)
  if (!undetermined.length) L.push('- 无')
  L.push('')
  L.push(`## 复跑`)
  L.push('')
  L.push('```bash')
  L.push(`node scripts/analyze-hook-log-unknown.mjs --since ${winLabel.split('..')[0]} --report .ihui-agent/tmp/g-978004-unknown-drain.md`)
  L.push('```')
  L.push('')
  L.push(`口径提醒:三格是**量算**不是判决 —— A 仍可能被并发同窗轮次顶替(它证的是"门看过这些文件且没红"),C 的措辞是"落地未经绿轮放行";指控要人逐枚复核证据行。`)
  writeFileSync(path, L.join('\n'), 'utf8')
}

/** 自检:构造面 + 关键反例。零写盘、零 git 派生。 */
function selfTest() {
  const T = 1_760_000_000_000
  const P = 'f'.repeat(40)
  const sha = 'a'.repeat(40)
  const C = (over) => ({ sha, parent: P, parents: [P], iso: new Date(T).toISOString(), ms: T, cIso: new Date(T).toISOString(), cMs: T, day: dayKey(new Date(T).toISOString()), files: ['x.ts', 'y.ts'], ...over })
  const round = (over) => ({ ts: new Date(T - 5 * 60_000), set: new Set(['x.ts', 'y.ts']), failed: 0, failedGates: [], endMs: T - 3 * 60_000, ...over })
  const fpRec = (over) => ({ headBefore: P, files: new Set(['x.ts', 'y.ts']), gatesRan: true, gatesPassed: true, exitCode: 0, ts: new Date(T - 5 * 60_000), consumed: false, ...over })
  const base = (over) => ({
    commit: C(),
    logCovered: true,
    windowRounds: [],
    windowInvocations: 0,
    windowRounds: [],
    firstPartyForParent: [],
    witnessed: false,
    reflog: null,
    windowMinMs: 30 * 60_000,
    ...over,
  })
  const fails = []
  const ok = (name, cond, extra = '') => {
    if (!cond) fails.push(`${name} ${extra}`)
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` —— ${extra}`}`)
  }

  let r = triageUnknown(base({ windowRounds: [round({ failed: 0, set: new Set(['x.ts', 'y.ts', 'z.ts']) })] }))
  ok('①超集绿轮 ⇒ A/echo-green(等值不是必要条件)', r.cell === 'A' && r.sub === 'echo-green', JSON.stringify(r))
  ok('①证据带超集差', r.evidence.some((e) => e.includes('超集差 1')), JSON.stringify(r.evidence))
  r = triageUnknown(base({ windowRounds: [round({ failed: 0 })] }))
  ok('②逐字等值绿轮 ⇒ A 并注明兄弟消费', r.cell === 'A' && r.evidence.some((e) => e.includes('兄弟提交消费')))
  r = triageUnknown(base({ windowRounds: [round({ failed: 0, endMs: T + 5 * 60_000 })] }))
  ok('②b绿轮在落地后才结束 ⇒ B/green-round-not-mine(带病正证不得发合格证)', r.cell === 'B' && r.sub === 'green-round-not-mine', JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ failed: 0, endMs: T + 30_000 })] }))
  ok('②c绿轮在落地 1 分钟容差内结束 ⇒ 仍 A(轮末与落地的正常间距)', r.cell === 'A', JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ failed: 3, failedGates: [{ id: '2', name: 'i18n 键完整性', cmd: 'node x' }] })], witnessed: true }))
  ok('③最后覆盖轮红 + 见证 ⇒ C/echo-red 且点名失败门', r.cell === 'C' && r.sub === 'echo-red' && r.evidence.some((e) => e.includes('[2] i18n 键完整性')), JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ failed: 3, endMs: T + 5 * 60_000 })], witnessed: true }))
  ok('③b红轮在落地后才结束 ⇒ B/red-context(红轮拦不住晚于它的落地)', r.cell === 'B' && r.sub === 'red-context', JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ failed: 3 })] }))
  ok('④红轮但无本机落地正证 ⇒ 降格 B/red-context(不指控)', r.cell === 'B' && r.sub === 'red-context', JSON.stringify(r))
  r = triageUnknown(base({ firstPartyForParent: [fpRec({})] }))
  ok('⑤一方记录完全正证 ⇒ A/fp-full', r.cell === 'A' && r.sub === 'fp-full', JSON.stringify(r))
  r = triageUnknown(base({ firstPartyForParent: [fpRec({ gatesPassed: false, exitCode: 1 })] }))
  ok('⑥一方红轮 ⇒ C/fp-red', r.cell === 'C' && r.sub === 'fp-red', JSON.stringify(r))
  r = triageUnknown(base({ firstPartyForParent: [fpRec({ exitCode: 1 })] }))
  ok('⑦批门绿但后续步骤红 exit=1 ⇒ C/fp-late-block', r.cell === 'C' && r.sub === 'fp-late-block', JSON.stringify(r))
  r = triageUnknown(base({ firstPartyForParent: [fpRec({ gatesRan: false, exitCode: 1 })] }))
  ok('⑧门未及跑即退 ⇒ C/fp-noran', r.cell === 'C' && r.sub === 'fp-noran', JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ set: new Set(['x.ts', 'y.ts']), failed: null })], windowInvocations: 1 }) )
  ok('⑨覆盖轮无结局 ⇒ B/incomplete-round(绿红均不可证)', r.cell === 'B' && r.sub === 'incomplete-round', JSON.stringify(r))
  r = triageUnknown(base({ witnessed: true, windowRounds: [round({ set: new Set(['other.ts']), failed: 0 })], windowInvocations: 1 }) )
  ok('⑩见证 + 窗口调用但无覆盖轮 ⇒ C/no-hook-trace', r.cell === 'C' && r.sub === 'no-hook-trace', JSON.stringify(r))
  r = triageUnknown(base({ windowRounds: [round({ set: new Set(['other.ts']), failed: 0 })], windowInvocations: 1 }) )
  ok('⑪无覆盖轮 + 无本机正证 ⇒ B/no-evidence(不指控)', r.cell === 'B' && r.sub === 'no-evidence', JSON.stringify(r))
  r = triageUnknown(base({ logCovered: false }))
  ok('⑫日志未覆盖 ⇒ B/log-gap', r.cell === 'B' && r.sub === 'log-gap', JSON.stringify(r))
  r = triageUnknown(base({ commit: C({ files: [] }) }))
  ok('⑬空文件面 ⇒ B/empty-files(不冒充覆盖)', r.cell === 'B' && r.sub === 'empty-files', JSON.stringify(r))
  const ts = parseVbsTimestamp('==== 2026/9/28 20:33:03 :: scripts/lib/pre-commit-hook.js ====')
  ok('⑭vbs 本地时刻解析', ts instanceof Date && ts.getFullYear() === 2026 && ts.getMonth() === 8 && ts.getDate() === 28 && ts.getHours() === 20, String(ts))
  ok('⑮坏时刻 ⇒ null(进未判定维度,不冒充)', parseVbsTimestamp('==== x ====' ) === null)
  const segs = readHookSegmentsTest()
  ok('⑯分段尺与统计器尺对同一份日志轮数一致', segs === 2, `实得 ${segs}`)
  console.log(`\n自检:${fails.length === 0 ? '全部通过' : `${fails.length} 条失败`}`)
  return fails.length === 0 ? 0 : 1
}

function readHookSegmentsTest() {
  const text = [
    '==== 2026/10/1 10:00:00 :: scripts/lib/pre-commit-hook.js ====',
    'ℹ️  staged 文件清单(2 个):',
    '  - a.ts',
    '  - b.ts',
    '🛡️ 守门脚本批量检查汇总',
    '  失败: 0',
    '==== 2026/10/1 10:10:00 :: scripts/lib/pre-commit-hook.js ====',
    'ℹ️  staged 文件清单(1 个):',
    '  - c.ts',
    '🛡️ 守门脚本批量检查汇总',
    '  失败: 2',
    '   · [2] 🌐 i18n 键完整性',
    '     单独复现:node scripts/check-i18n-keys.mjs --staged',
  ].join('\n')
  const segments = parseHookSegmentsFromText(text)
  const complete = segments.flatMap((s) => s.rounds.filter((r) => r.echoFiles && r.failed !== null))
  const g = complete[1]?.failedGates?.[0]
  if (complete.length !== 2 || segments[0].ts === null || !g || g.cmd !== 'node scripts/check-i18n-keys.mjs --staged') return -1
  return complete.length
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/analyze-hook-log-unknown.mjs [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--limit N] [--window-min N] [--sample N] [--json] [--report PATH] [--root DIR] [--self-test]',
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  return await run({ argv })
}

// readHookSegmentsTest 的夹具是纯文本构造,不落任何临时文件(自检零写盘)。

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { parseVbsTimestamp, hookLogFiles, readHookSegments, readAllHookSegments, collectCommitsFull, classifyReflog, covers, triageUnknown }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
