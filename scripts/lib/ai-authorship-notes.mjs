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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
