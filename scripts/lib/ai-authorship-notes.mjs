// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 代码归属写进 Git notes(逆向-复现-超越 §0.11,G-4 复现轴)。
// 语义借自外部产品形态,标识符与结构全部本仓自命名;不落任何对方专有源码/字符串。
// 三条超越轴:① undetermined 显式语义(decideAttribution),② 多会话主体归因(entry.session
// + external_paths 分桶,他席在飞内容绝不记成本席产出),③ 可核验(integrity.fp + entry_count
// + verifyRecord 只读出口)。notes 不改被记 commit 的 sha —— 这是选 notes 而非 amend 的全部理由。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
const GIT_BIN = process.env.IHUI_GIT_BIN || 'git'

export const NOTES_NS_BASE = 'refs/notes/ihui-ai'
export const NOTES_REF_DEFAULT = NOTES_NS_BASE
export const PAYLOAD_SCHEMA_V = 1

export function notesRefForNamespace(ns = 'default') {
  if (ns === 'default') return NOTES_REF_DEFAULT
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(ns)) throw new Error(`非法 notes 命名空间:${ns}`)
  return `${NOTES_NS_BASE}-${ns}`
}

const normPath = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '')
const normList = (list) => [...new Set((Array.isArray(list) ? list : []).map(normPath))].sort()

export function hashPaths(paths) {
  return createHash('sha256').update(normList(paths).join('\n'), 'utf8').digest('hex')
}

export function dedupeKeyOf({ session, commit, event = 'checkpoint', paths = [] }) {
  if (!session || !commit) throw new Error('dedupeKeyOf 需要 session 与 commit')
  return `${session}:${commit}:${event}:${hashPaths(paths)}`
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
}

const fpOf = (o) => createHash('sha256').update(canonicalJson(o), 'utf8').digest('hex')

export function buildEntry({ session, commit, event = 'checkpoint', decision, model = '', tool = '', recordedAt }) {
  const keyed = decision.ai_paths.length ? decision.ai_paths : decision.undetermined_paths.length ? decision.undetermined_paths : decision.external_paths
  return {
    dedupe_key: dedupeKeyOf({ session, commit, event, paths: keyed }),
    session,
    commit,
    event,
    status: decision.status,
    ai_paths: decision.ai_paths,
    external_paths: decision.external_paths,
    undetermined_paths: decision.undetermined_paths,
    reasons: decision.reasons,
    model,
    tool,
    recorded_at: recordedAt,
  }
}

export function buildPayload(entries = []) {
  const body = { v: PAYLOAD_SCHEMA_V, entries }
  return { ...body, integrity: { entry_count: entries.length, fp: fpOf(body) } }
}

export function mergeEntry(payload, entry) {
  const entries = (payload && Array.isArray(payload.entries) ? payload.entries : []).filter((e) => e.dedupe_key !== entry.dedupe_key)
  entries.push(entry)
  return buildPayload(entries)
}

export function verifyIntegrity(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entries)) {
    return { state: 'undetermined', why: 'notes 载荷不是可解析的对象形态' }
  }
  if (payload.v !== PAYLOAD_SCHEMA_V) return { state: 'mismatch', why: `schema 版本不符:${payload.v}` }
  const expect = fpOf({ v: payload.v, entries: payload.entries })
  if (!payload.integrity || payload.integrity.fp !== expect) return { state: 'mismatch', why: 'integrity.fp 与重算值不一致(载荷被改写过)' }
  if (payload.integrity.entry_count !== payload.entries.length) return { state: 'mismatch', why: 'entry_count 与实际条目数不一致' }
  return { state: 'ok', fp: expect, entry_count: payload.entries.length }
}

// 仓库内相对路径归一的**唯一实现**的内联别名(读侧对账共用,不得在消费方再写一份 replace 链)。
export const normalizeRepoPath = normPath

// ── 读侧取数解析(纯函数,零 IO)────────────────────────────────────────────
// 立因:报表/审计这类消费者一旦各自手写一份 git plumbing 输出解析,判据就成 N 份必然漂移(§0.6)。
// 这三枚只解析**文本形态**,不做任何 IO、不下结论;结论归消费方。

const HEX_RE = /^[0-9a-f]{4,64}$/i
const RENAME_ARROW = ' => '

/**
 * `git notes [--ref=X] list` 单行 → { kind:'pair', noteBlob, objectSha } | { kind:'undetermined', why }。
 * 认不得的形态一律点名,不得静默丢行(丢行等于把"有归属记录"说成"没有")。
 */
export function parseNotesListLine(line) {
  const raw = String(line).replace(/\r$/, '').trim()
  if (raw === '') return { kind: 'blank' }
  const cols = raw.split(/\s+/)
  if (cols.length !== 2 || !HEX_RE.test(cols[0]) || !HEX_RE.test(cols[1])) {
    return { kind: 'undetermined', why: `notes list 行形态不认得:${raw.slice(0, 120)}` }
  }
  return { kind: 'pair', noteBlob: cols[0], objectSha: cols[1] }
}

/**
 * `git ls-tree --full-name -z` 单条(NUL 结尾)→ { kind:'entry', path, blob, mode } | { kind:'undetermined', why }。
 * 形态 `<mode> blob <oid>\t<path>`;非 blob(树/链接)与形态不认得的都点名,不猜。
 */
export function parseLsTreeEntryZ(chunk) {
  const raw = String(chunk).replace(/\0$/, '')
  if (raw === '') return { kind: 'blank' }
  const tab = raw.indexOf('\t')
  if (tab < 0) return { kind: 'undetermined', why: `ls-tree 行缺制表符:${raw.slice(0, 120)}` }
  const head = raw.slice(0, tab).split(/\s+/)
  const path = raw.slice(tab + 1)
  if (head.length !== 3 || !HEX_RE.test(head[2])) return { kind: 'undetermined', why: `ls-tree 头段形态不认得:${raw.slice(0, 120)}` }
  if (head[1] !== 'blob') return { kind: 'undetermined', why: `ls-tree 该条不是 blob(${head[1]}):${path}` }
  return { kind: 'entry', mode: head[0], blob: head[2], path: normPath(path) }
}

/**
 * diff 路径(可能带 rename 形态)→ 归属对账用的**新侧**路径。
 * 三种真形态:整段 `a.ts => b.ts` / 花括号 `src/{a.ts => b.ts}` / 普通 `src/a.ts`。
 * 含引号(core.quotepath 未关时的非 ASCII 形)或段数不对 ⇒ 显式 undetermined,绝不猜新侧。
 */
export function resolveDiffPathToNewSide(rawPath) {
  const p = String(rawPath).replace(/\r$/, '')
  if (p === '') return { kind: 'undetermined', why: 'diff 路径为空' }
  if (p.includes('"')) return { kind: 'undetermined', why: `diff 路径含引号形态,不猜:${p.slice(0, 80)}` }
  if (!p.includes(RENAME_ARROW)) return { kind: 'ok', value: normPath(p) }
  if (p.includes('{') !== p.includes('}')) return { kind: 'undetermined', why: `rename 花括号不配对:${p.slice(0, 80)}` }
  if (p.includes('{')) {
    const braceStart = p.indexOf('{')
    const braceEnd = p.indexOf('}')
    if (braceEnd < braceStart) return { kind: 'undetermined', why: `rename 花括号顺序不认得:${p.slice(0, 80)}` }
    const sides = p.slice(braceStart + 1, braceEnd).split(RENAME_ARROW)
    if (sides.length !== 2) return { kind: 'undetermined', why: `rename 花括号内段数不为 2:${p.slice(0, 80)}` }
    const joined = p.slice(0, braceStart) + sides[1] + p.slice(braceEnd + 1)
    return { kind: 'ok', value: normPath(joined).replace(/\/{2,}/g, '/') }
  }
  const whole = p.split(RENAME_ARROW)
  if (whole.length !== 2) return { kind: 'undetermined', why: `rename 整段形态段数不为 2:${p.slice(0, 80)}` }
  return { kind: 'ok', value: normPath(whole[1]) }
}

/**
 * `git show --numstat` 单行 → { kind:'stat', path, added, removed, binary } | { kind:'blank' } | { kind:'undetermined', why }。
 * added/removed 为 null 表示二进制(行数结构上无定义,不是 0 —— 用 0 冒充"没改动"是 §0.3 禁形态)。
 */
export function parseNumstatLine(line) {
  const raw = String(line).replace(/\r$/, '')
  if (raw.trim() === '') return { kind: 'blank' }
  const t1 = raw.indexOf('\t')
  const t2 = t1 < 0 ? -1 : raw.indexOf('\t', t1 + 1)
  if (t1 < 0 || t2 < 0) return { kind: 'undetermined', why: `numstat 行不足两枚制表符:${raw.slice(0, 80)}` }
  const addedRaw = raw.slice(0, t1).trim()
  const removedRaw = raw.slice(t1 + 1, t2).trim()
  const path = resolveDiffPathToNewSide(raw.slice(t2 + 1))
  if (path.kind !== 'ok') return { kind: 'undetermined', why: path.why }
  if (addedRaw === '-' || removedRaw === '-') return { kind: 'stat', path: path.value, added: null, removed: null, binary: true }
  const added = Number(addedRaw)
  const removed = Number(removedRaw)
  if (!Number.isInteger(added) || !Number.isInteger(removed) || added < 0 || removed < 0) {
    return { kind: 'undetermined', why: `numstat 计数不认得:${addedRaw}/${removedRaw} @ ${path.value}` }
  }
  return { kind: 'stat', path: path.value, added, removed, binary: false }
}

/**
 * 读侧**跨 commit** 的"同一文件被不同主体分别主张"判据(纯函数,零 IO)。
 * 立因:verifyRecord 的冲突判据射程只到一枚 commit 的载荷(within-note);报表/审计要把这条牙
 * 撒到整段历史,若在消费方另写一份 `new Set(owners).size > 1` 就是§0.6 的第二份实现 ⇒ 必然漂移。
 * 语义与 within-note 版一致(不同主体对同一路径各自主张 ⇒ 冲突),只是输入是已展平的条目集
 * (每条须带 commit)。只点名不裁决:"判没判过"由消费方按输入集是否可枚举决定(§0.3)。
 * ⚠️ 本次约束(读侧补齐席)是"lib 仅新增纯函数导出、既有函数体一字不动",故 verifyRecord 内
 *    那段同名判据保持原样,不做行为等价重构。
 */
export function findDuplicateSubjectClaims(entries = []) {
  const byPath = new Map()
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || typeof e !== 'object') continue
    const session = typeof e.session === 'string' ? e.session : ''
    if (session === '') continue
    for (const raw of e.ai_paths || []) {
      const key = normPath(raw)
      const row = byPath.get(key) || { path: key, sessions: [], commits: [], dedupe_keys: [] }
      if (!row.sessions.includes(session)) row.sessions.push(session)
      const commit = typeof e.commit === 'string' ? e.commit : ''
      if (commit && !row.commits.includes(commit)) row.commits.push(commit)
      if (e.dedupe_key && !row.dedupe_keys.includes(e.dedupe_key)) row.dedupe_keys.push(e.dedupe_key)
      byPath.set(key, row)
    }
  }
  return [...byPath.values()].filter((r) => r.sessions.length > 1).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

// 归属判定的唯一实现(纯函数,零 IO):失效方向永远是「多要一次定向说明」,不是冒绿(§0.3)。
export function decideAttribution({ sha = null, parentCount = 1, changedPaths = [], declaredPaths = [], dirtyPaths = [], session = null } = {}) {
  const reasons = []
  if (typeof session !== 'string' || session === '') reasons.push('session-identity-missing')
  if (!sha) reasons.push('commit-unresolvable')
  if (parentCount > 1) reasons.push('merge-commit-not-hunk-attributable')
  const declared = new Set(normList(declaredPaths))
  const dirty = new Set(normList(dirtyPaths))
  const ai = []
  const external = []
  const undetermined = []
  for (const p of normList(changedPaths)) {
    if (parentCount > 1) {
      undetermined.push(p)
      continue
    }
    if (!declared.has(p)) external.push(p)
    else if (dirty.has(p)) {
      undetermined.push(p)
      reasons.push(`worktree-copy-diverged:${p}`)
    } else ai.push(p)
  }
  let status
  if (reasons.length > 0) status = ai.length > 0 ? 'partial' : 'undetermined'
  else status = ai.length > 0 ? 'attributed' : 'no-ai-content'
  return { status, ai_paths: ai, external_paths: external, undetermined_paths: undetermined, reasons }
}

function git(repoDir, args, input) {
  const r = spawnSync(GIT_BIN, args, {
    cwd: repoDir || REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
    timeout: 30000,
  })
  if (r.error) return { ok: false, undetermined: true, why: `git 派生失败(${r.error.code ?? r.error.message})`, stderr: '' }
  return { ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), undetermined: false }
}

export function readNote({ repoDir, commit, ref = NOTES_REF_DEFAULT } = {}) {
  const r = git(repoDir, ['notes', '--ref=' + ref, 'show', commit])
  if (r.ok) {
    let payload
    try {
      payload = JSON.parse(r.stdout)
    } catch (e) {
      return { state: 'malformed', why: `notes JSON 解析失败:${e.message}`, raw: r.stdout }
    }
    return { state: 'found', payload }
  }
  if (r.undetermined) return { state: 'undetermined', why: r.why }
  if (/could not read|no note|not known to|does not exist|Missing note|cannot find/i.test(r.stderr) || r.status === 1) {
    return { state: 'absent' }
  }
  return { state: 'undetermined', why: `git notes show 退出形态不认得(rc ${r.status}):${r.stderr.slice(0, 160)}` }
}

export function writeNote({ repoDir, commit, payload, ref = NOTES_REF_DEFAULT } = {}) {
  const r = git(repoDir, ['notes', '--ref=' + ref, 'add', '-f', '-m', canonicalJson(payload), commit])
  if (!r.ok) {
    if (r.undetermined) return { state: 'undetermined', why: r.why }
    return { state: 'failed', why: `git notes add 失败(rc ${r.status}):${r.stderr.slice(0, 200)}` }
  }
  return { state: 'written' }
}

function commitFacts(repoDir, commit) {
  const rev = git(repoDir, ['rev-parse', '--verify', `${commit}^{commit}`])
  if (!rev.ok) return { sha: null, why: `commit 取不到:${rev.stderr.slice(0, 120) || rev.why}` }
  const sha = rev.stdout.trim()
  const parents = git(repoDir, ['rev-parse', `${sha}^@`])
  if (!parents.ok) return { sha, parentCount: null, why: `parents 取不到:${parents.stderr.slice(0, 120) || parents.why}` }
  const changed = git(repoDir, ['show', '--pretty=format:', '--name-only', sha])
  if (!changed.ok) return { sha, parentCount: parents.stdout.split(/\r?\n/).filter(Boolean).length, changedPaths: null, why: `changed 取不到:${changed.stderr.slice(0, 120)}` }
  const st = git(repoDir, ['status', '--porcelain'])
  if (!st.ok) return { sha, parentCount: parents.stdout.split(/\r?\n/).filter(Boolean).length, changedPaths: changed.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), dirtyPaths: null, why: `工作树状态取不到:${st.stderr.slice(0, 120)}` }
  const dirtyPaths = []
  let quoting = false
  for (const line of st.stdout.split(/\r?\n/)) {
    if (!line) continue
    let p = line.slice(3)
    if (p.startsWith('"')) {
      quoting = true
      continue
    }
    const arrow = p.indexOf(' -> ')
    if (arrow >= 0) p = p.slice(arrow + 4)
    dirtyPaths.push(p)
  }
  return {
    sha,
    parentCount: parents.stdout.split(/\r?\n/).filter(Boolean).length,
    changedPaths: changed.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    dirtyPaths: quoting ? null : dirtyPaths,
    why: quoting ? 'porcelain 路径含引号形态,工作树脏集判不出(§0.3 不猜)' : null,
  }
}

// 消费方唯一入口(safe-commit 成功路径按此派生;fail-open:返回值只用于汇报,绝不回抛)。
export function recordForCommit({ repoDir, commit = 'HEAD', session, declaredPaths = [], event = 'checkpoint', model = '', tool = '', namespace = 'default', dryRun = false, now } = {}) {
  const ref = notesRefForNamespace(namespace)
  if (typeof session !== 'string' || session === '') {
    return { state: 'undetermined', reasons: ['session-identity-missing'], hint: '未判定:会话主体缺失,不写 notes(§0.3)' }
  }
  const facts = commitFacts(repoDir, commit)
  if (!facts.sha) return { state: 'undetermined', reasons: ['commit-unresolvable'], hint: facts.why }
  if (facts.parentCount === null) return { state: 'undetermined', reasons: ['parents-unreadable'], hint: facts.why }
  if (!facts.changedPaths) return { state: 'undetermined', reasons: ['changed-paths-unreadable'], hint: facts.why }
  if (!facts.dirtyPaths) return { state: 'undetermined', reasons: ['worktree-state-unreadable'], hint: facts.why || '工作树脏集取不到' }
  const decision = decideAttribution({
    sha: facts.sha,
    parentCount: facts.parentCount,
    changedPaths: facts.changedPaths,
    declaredPaths,
    dirtyPaths: facts.dirtyPaths,
    session,
  })
  const entry = buildEntry({ session, commit: facts.sha, event, decision, model, tool, recordedAt: (now ?? new Date()).toISOString() })
  const existing = readNote({ repoDir, commit: facts.sha, ref })
  if (existing.state === 'undetermined') return { state: 'undetermined', reasons: ['existing-note-unreadable'], hint: existing.why }
  if (existing.state === 'malformed') return { state: 'undetermined', reasons: ['existing-note-malformed'], hint: existing.why }
  const merged = mergeEntry(existing.state === 'found' ? existing.payload : buildPayload([]), entry)
  if (dryRun) return { state: 'would-record', ref, entry, payload: merged, idempotent_replay: existing.state === 'found' && existing.payload.entries.some((e) => e.dedupe_key === entry.dedupe_key) }
  const w = writeNote({ repoDir, commit: facts.sha, payload: merged, ref })
  if (w.state !== 'written') return { state: w.state === 'undetermined' ? 'undetermined' : 'failed', reasons: [w.why] }
  const repeat = existing.state === 'found' && existing.payload.entries.some((e) => e.dedupe_key === entry.dedupe_key)
  return { state: 'recorded', ref, sha: facts.sha, entry, payload: merged, idempotent_replay: repeat }
}

// 只读校验出口:回读 notes → 完整性重算 → 与 commit 现实对账 → 跨席冲突检测。全程零写盘。
export function verifyRecord({ repoDir, commit = 'HEAD', namespace = 'default' } = {}) {
  const ref = notesRefForNamespace(namespace)
  const rev = git(repoDir, ['rev-parse', '--verify', `${commit}^{commit}`])
  if (!rev.ok) return { state: 'undetermined', why: `commit 取不到:${rev.stderr.slice(0, 120) || rev.why}` }
  const sha = rev.stdout.trim()
  const note = readNote({ repoDir, commit: sha, ref })
  if (note.state === 'absent') return { state: 'undetermined', why: `该 commit 在 ${ref} 上没有归属记录(未记录≠已核验)` }
  if (note.state === 'undetermined' || note.state === 'malformed') return { state: 'undetermined', why: note.why }
  const integrity = verifyIntegrity(note.payload)
  if (integrity.state !== 'ok') return { ...integrity, sha, ref }
  const changed = git(repoDir, ['show', '--pretty=format:', '--name-only', sha])
  if (!changed.ok) return { state: 'undetermined', why: `changed 集取不到:${changed.stderr.slice(0, 120) || changed.why}` }
  const changedSet = new Set(normList(changed.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)))
  const issues = []
  const claims = new Map()
  for (const e of note.payload.entries) {
    if (e.commit !== sha) issues.push(`commit-mismatch:${e.dedupe_key}`)
    for (const p of e.ai_paths || []) {
      if (!changedSet.has(normPath(p))) issues.push(`path-not-in-commit:${e.session}:${p}`)
      const owners = claims.get(p) || []
      owners.push(e.session)
      claims.set(p, owners)
    }
    if (e.status === 'undetermined' && !(e.reasons || []).length) issues.push(`undetermined-without-reason:${e.dedupe_key}`)
  }
  const conflicts = [...claims.entries()].filter(([, owners]) => new Set(owners).size > 1).map(([p, owners]) => ({ path: p, sessions: [...new Set(owners)] }))
  for (const c of conflicts) issues.push(`duplicate-attribution:${c.path}⇐${c.sessions.join(',')}`)
  if (issues.length) return { state: 'mismatch', sha, ref, issues, conflicts, entry_count: note.payload.entries.length }
  return { state: 'ok', sha, ref, fp: integrity.fp, entry_count: note.payload.entries.length, conflicts, sessions: [...new Set(note.payload.entries.map((e) => e.session))] }
}

export const __test__ = {
  NOTES_NS_BASE,
  NOTES_REF_DEFAULT,
  PAYLOAD_SCHEMA_V,
  notesRefForNamespace,
  hashPaths,
  dedupeKeyOf,
  canonicalJson,
  buildEntry,
  buildPayload,
  mergeEntry,
  verifyIntegrity,
  decideAttribution,
  readNote,
  writeNote,
  recordForCommit,
  verifyRecord,
  REPO_ROOT,
  // 读侧取数解析(纯函数,报表/审计共用单源;新增导出,不改上面任何既有函数体)
  normalizeRepoPath,
  parseNotesListLine,
  parseLsTreeEntryZ,
  resolveDiffPathToNewSide,
  parseNumstatLine,
  findDuplicateSubjectClaims,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
