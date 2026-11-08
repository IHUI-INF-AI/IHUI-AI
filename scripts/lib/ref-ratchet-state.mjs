// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * main 引用棘轮 —— 状态与台账（只被 ref-ratchet-main.mjs / ref-ratchet-ledger.mjs /
 * check-ref-ratchet-liveness.mjs 三处使用）。
 *
 * 设计约束（逐条对应批复口径，改代码前先读完）：
 *
 * 1. 台账落在 `<git-common-dir>/ihui-ref-ratchet/`：**跨 worktree 共享、不入库**。
 *    写它不会产生 ref 变更，因此不会反过来触发 reference-transaction 钩子。
 * 2. **台账可被删 = 棘轮可被重置**，这是已知限制，不是缺陷。为让"重置"可见而不是静默归零，
 *    seed 时同时写一份锚点 `anchor.json`（记录 seedAt / seedSha / 各类计数）。
 *    `verifyLedger` 一旦发现"有锚点、台账却不见了"，必须报错；不允许安静地从零开始。
 * 3. 台账只由生成器/钩子写入（读—合并—整份重写），链式哈希（prev + sha256）钉住"手改一行"：
 *    verify 重算链，断链或重复键即判红。生成器之外的行都不是同一次规范化写入的产物。
 * 4. 棘轮键 = (gate, path)。`status=red` 才抑制阻断；`status=undetermined` **不抑制** ——
 *    超时一次不得变成永久豁免（下一次同路径变更若判红，仍然阻断）。
 * 5. 所有 git 调用显式 `stdio: ['ignore','pipe','pipe']`（门 193 刚因漏写 stdio 拦过整条 push 链）。
 */

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const LEDGER_VERSION = 1
export const RECURSION_ENV = 'IHUI_REF_TXN_MAIN_RATCHET'
/** 镜像/自测用的 ref 覆盖；生产不设置，默认只判 refs/heads/main。 */
export const REF_OVERRIDE_ENV = 'IHUI_REF_TXN_RATCHET_REF'
export const DEFAULT_REF = 'refs/heads/main'

const GIT_TIMEOUT_MS = 30_000
/** 台账锁最长等 3s；超时按钩子自身异常处理（放行 + hook-error），绝不锁死 main。 */
const LOCK_WAIT_MS = 3_000

/** 唯一的 git 出口：不许有第二个 spawn 形态（门 193 的判据看的就是这个）。 */
export function git(root, args, { timeout = GIT_TIMEOUT_MS, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 共享状态目录（git-common-dir 对所有 worktree 唯一）。 */
export function stateDir(root) {
  const common = String(git(root, ['rev-parse', '--git-common-dir'])).trim()
  const abs = isAbsolute(common) ? common : resolve(root, common)
  return join(abs, 'ihui-ref-ratchet')
}

export function ensureStateDir(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

export function ledgerPath(dir) {
  return join(dir, 'ledger.jsonl')
}
export function anchorPath(dir) {
  return join(dir, 'anchor.json')
}
export function heartbeatPath(dir) {
  return join(dir, 'heartbeat.json')
}
export function hookErrorPath(dir) {
  return join(dir, 'hook-error.log')
}

const keyOf = (gate, path) => `${gate}\u0000${path}`

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`
}

function chainHash(prev, entry) {
  // entry 里不得含 hash 自身；canonical 序列化保证同一内容在任意机器上算出同一个链。
  const body = { ...entry }
  delete body.hash
  return createHash('sha256').update(`${prev}\n${stableJson(body)}`).digest('hex')
}

/**
 * 读台账。坏行不静默吞掉：返回 errors，由调用方决定报红还是未判定。
 * @returns {{entries: Map<string, object>, errors: string[], head: string, exists: boolean}}
 */
export function readLedger(dir) {
  const file = ledgerPath(dir)
  const entries = new Map()
  const errors = []
  let head = 'GENESIS'
  if (!existsSync(file)) return { entries, errors, head, exists: false }
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n').filter((l) => l.trim())
  let prev = 'GENESIS'
  for (let i = 0; i < lines.length; i++) {
    let row
    try {
      row = JSON.parse(lines[i])
    } catch (e) {
      errors.push(`line ${i + 1}: 不是合法 JSON (${String(e.message).split('\n')[0]})`)
      continue
    }
    if (row.v !== LEDGER_VERSION) errors.push(`line ${i + 1}: 未知 schema v=${row.v}`)
    if (typeof row.gate !== 'string' || typeof row.path !== 'string') {
      errors.push(`line ${i + 1}: 缺 gate/path`)
      continue
    }
    if (row.prev !== prev) errors.push(`line ${i + 1}: 链断裂(prev 不匹配) ⇒ 疑似手改`)
    const expect = chainHash(prev, row)
    if (row.hash !== expect) errors.push(`line ${i + 1}: 哈希不符 ⇒ 疑似手改`)
    prev = row.hash
    const key = keyOf(row.gate, row.path)
    if (entries.has(key)) errors.push(`line ${i + 1}: 重复键 (${row.gate}, ${row.path})`)
    entries.set(key, row)
  }
  head = prev
  return { entries, errors, head, exists: true }
}

/**
 * 追加/更新台账。**同一个键重复写入是合法更新**（存量红刷新 lastSeen），
 * 因此这不是 append-only 日志，而是"读—合并—整份重写"的规范化账本：
 * 落盘文件里每个 (gate,path) 只有一行，出现重复行只可能是被人手工加出来的 ⇒ `--verify` 判红。
 * 重写仍是原子写（tmp + rename），任何时刻盘上都是一个可验的完整链。
 * 调用方负责分类（red / undetermined）。
 */
export function putLedger(dir, rows, { allowNoPrev = false } = {}) {
  ensureStateDir(dir)
  return withLock(dir, () => {
    const { entries, errors } = readLedger(dir)
    if (errors.length && !allowNoPrev) {
      throw new Error(`台账已损坏，拒绝写入（先跑 ref-ratchet-ledger --verify）: ${errors[0]}`)
    }
    const now = new Date().toISOString()
    for (const row of rows) {
      const key = keyOf(row.gate, row.path)
      const prior = entries.get(key)
      entries.set(key, {
        v: LEDGER_VERSION,
        gate: row.gate,
        path: row.path,
        blob: row.blob ?? prior?.blob ?? null,
        status: row.status,
        missing: row.missing ?? null,
        firstSeen: row.firstSeen ?? prior?.firstSeen ?? row.lastSeen ?? now,
        lastSeen: row.lastSeen ?? now,
      })
    }
    return writeLedgerFile(dir, Array.from(entries.values()))
  })
}

/** 整份重写链（从 GENESIS 起算）；排序固定，保证同一内容得到同一条链。 */
function writeLedgerFile(dir, entries) {
  ensureStateDir(dir)
  let prev = 'GENESIS'
  const lines = []
  const ordered = [...entries].sort(
    (a, b) =>
      String(a.firstSeen).localeCompare(String(b.firstSeen)) ||
      a.gate.localeCompare(b.gate) ||
      a.path.localeCompare(b.path),
  )
  for (const e of ordered) {
    const entry = { ...e, prev }
    entry.hash = chainHash(prev, entry)
    prev = entry.hash
    lines.push(JSON.stringify(entry))
  }
  const file = ledgerPath(dir)
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, lines.length ? lines.join('\n') + '\n' : '')
  renameSync(tmp, file)
  return prev
}

/**
 * 最小的互斥：不同 worktree 的钩子可能同时写同一份账。
 * 拿不到锁**不阻断 main** —— 抛错由钩子按"自身异常"处理（放行 + hook-error）。
 */
export function withLock(dir, fn) {
  const lock = join(dir, 'ledger.lock')
  const deadline = Date.now() + LOCK_WAIT_MS
  let fd = null
  while (true) {
    try {
      fd = openSync(lock, 'wx')
      break
    } catch (e) {
      if (e.code !== 'EEXIST' || Date.now() > deadline) {
        throw new Error(`拿不到台账锁 ${lock}: ${e.code ?? e.message}`)
      }
      sleepSync(25)
    }
  }
  try {
    return fn()
  } finally {
    try {
      closeSync(fd)
    } catch {
      /* best effort */
    }
    try {
      rmSync(lock, { force: true })
    } catch {
      /* best effort */
    }
  }
}

function sleepSync(ms) {
  // 同步等待：钩子内没有事件循环可让出，Atomics.wait 是唯一不引入依赖的睡眠。
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 判定用的棘轮比较。**只比较这份账**，不重跑历史门。
 * 规则：
 *  - 台账 (gate,path)=red ⇒ 存量红，只记账；
 *  - 台账 (gate,path)=undetermined ⇒ 不抑制，本次判红就阻断；
 *  - 台账无该键且 path ∈ 本次变更面 ⇒ 新增红，阻断；
 *  - 红出现在本次变更面之外 ⇒ 只记账（别人的存量，不是这笔引入的）。
 */
export function classifyFindings({ ledger, gate, findings, changedPaths }) {
  const changed = new Set(changedPaths)
  const blocked = []
  const recorded = []
  for (const f of findings) {
    const key = keyOf(gate, f.path)
    const known = ledger.get(key)
    const isExisting = known?.status === 'red'
    if (isExisting) {
      recorded.push({ ...f, cause: 'existing-red' })
      continue
    }
    if (changed.has(f.path)) {
      blocked.push({ ...f, cause: known?.status === 'undetermined' ? 'undetermined-retry' : 'new-red' })
      continue
    }
    recorded.push({ ...f, cause: 'out-of-scope' })
  }
  return { blocked, recorded }
}

/** 心跳：钩子每次执行都写。装死检查靠它，不靠钩子自述"我健康"。 */
export function writeHeartbeat(dir, patch) {
  ensureStateDir(dir)
  const file = heartbeatPath(dir)
  const prev = existsSync(file) ? safeJson(file) : null
  const next = { ...(prev ?? {}), ...patch, ts: new Date().toISOString() }
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2))
  renameSync(tmp, file)
  return next
}

/** 钩子自身异常：单独落一条，永不混进心跳（心跳过期与"报过异常"是两条判据）。 */
export function writeHookError(dir, { kind, message, stack, input }) {
  ensureStateDir(dir)
  appendFileSync(
    hookErrorPath(dir),
    JSON.stringify({
      ts: new Date().toISOString(),
      kind: String(kind ?? 'unknown'),
      message: String(message ?? '').split('\n')[0],
      stack: String(stack ?? '').split('\n').slice(0, 8).join('\n'),
      input: input ?? null,
    }) + '\n',
  )
}

export function safeJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function writeAnchor(dir, anchor) {
  ensureStateDir(dir)
  const file = anchorPath(dir)
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(anchor, null, 2))
  renameSync(tmp, file)
}

/** 钩子第一次落账时补一份锚点：台账从此有"起算点"，避免 verify 把合法首写误判成"有账无锚"。 */
export function ensureAnchor(dir, seedSha) {
  if (existsSync(anchorPath(dir))) return false
  writeAnchor(dir, { seedAt: new Date().toISOString(), seedSha, auto: true })
  return true
}

/** 台账体检。除链/重复/坏行外，专门钉"棘轮被重置"这件事：
 *  - 有锚点但台账不见了 ⇒ 报错（删台账不能当没发生过）；
 *  - 台账存在但锚点不见了 ⇒ 报错（不知道这份账从哪个 main tip 起算）；
 *  - 锚点本身必须带合法的 seedAt/seedSha。
 * 注：账本是"读—合并—整份重写"，链头每次写入都会变，因此**不做链头比对**；
 * 完整性靠逐行链式哈希 + 重复键检查。手改一行、插一行、删一行都会断链。
 * @returns {{ok: boolean, errors: string[]}}
 */
export function verifyLedger(dir) {
  const errors = []
  const anchor = safeJson(anchorPath(dir))
  if (anchor && !existsSync(ledgerPath(dir))) {
    errors.push('台账缺失但存在 seed 锚点 ⇒ 棘轮已被重置（删台账不能当没发生过）')
    return { ok: false, errors }
  }
  const read = readLedger(dir)
  errors.push(...read.errors)
  if (anchor) {
    if (typeof anchor.seedAt !== 'string' || typeof anchor.seedSha !== 'string') {
      errors.push('锚点缺 seedAt/seedSha')
    } else if (!/^[0-9a-f]{40}$/.test(anchor.seedSha)) {
      errors.push(`锚点 seedSha 不是 40 位 sha: ${anchor.seedSha}`)
    }
    if (!read.exists) errors.push('锚点存在但台账缺失')
  } else if (read.exists) {
    errors.push('台账存在但无 seed 锚点 ⇒ 不知道这份账从哪个 main tip 起算')
  }
  return { ok: errors.length === 0, errors }
}

/** 清理：只保留最近 N 天的 undetermined；red 由 `--prune` 显式按"已不再判红"删除。 */
export function compactLedger(dir, { now = Date.now(), undeterminedTtlDays = 30 } = {}) {
  return withLock(dir, () => {
    const { entries, errors } = readLedger(dir)
    if (errors.length) throw new Error(`台账已损坏: ${errors[0]}`)
    const keep = []
    for (const e of entries.values()) {
      if (e.status === 'undetermined') {
        const age = now - Date.parse(e.lastSeen)
        if (Number.isFinite(age) && age > undeterminedTtlDays * 24 * 3600_000) continue
      }
      keep.push(e)
    }
    const head = writeLedgerFile(dir, keep)
    return { kept: keep.length, removed: entries.size - keep.length, head }
  })
}

export function removeState(dir) {
  rmSync(dir, { recursive: true, force: true })
}

/** 按 (gate,path) 删除条目（`--prune` 用来撤掉"已不再判红"的旧账）。 */
export function deleteLedgerKeys(dir, pairs) {
  return withLock(dir, () => {
    const { entries, errors } = readLedger(dir)
    if (errors.length) throw new Error(`台账已损坏: ${errors[0]}`)
    for (const [gate, path] of pairs) entries.delete(keyOf(gate, path))
    return writeLedgerFile(dir, Array.from(entries.values()))
  })
}

export function ledgerDirOf(root) {
  return dirname(ledgerPath(stateDir(root)))
}

export const __test__ = { keyOf, stableJson, chainHash }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
