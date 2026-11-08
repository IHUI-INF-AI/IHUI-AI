// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 推送门凭据（push receipt）—— 把 13 门 + 文档数字 + i18n 审计的求值搬到提交侧。
 *
 * 设计要点（详见 docs/engineering/push-receipt-1107.md）：
 *   1. 凭据只对「某个 commit 的某个 tree + 某个远端基线」成立：commitSha/treeSha/remoteBase 三重钉死；
 *   2. 凭据签名载荷同时钉住 runner/executor/每道门脚本的 blob ⇒ 改了门脚本再拿旧凭据不可能通过；
 *   3. 任何一项校验不通过一律返回 ok:false ⇒ 调用方必须回落真跑门，绝不"无凭据即放行"；
 *   4. 门集合以 EXPECTED_GATES 为唯一期望面，缺门/多门/换脚本/换参数都判红。
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { gitRaw } from './face-reader.mjs'

export const RECEIPT_VERSION = 'ihui-push-receipt/v1'
export const RUNNER_VERSION = 'push-receipt-runner/v1'
export const RECEIPT_TTL_MS = 60 * 60 * 1000
export const RECEIPT_CLOCK_SKEW_MS = 5 * 60 * 1000
export const RECEIPT_DIR_REL = '.ihui-agent/state/push-receipts'
export const RECEIPT_KEY_ENV = 'IHUI_PUSH_RECEIPT_KEY'
export const RECEIPT_KEY_FILE_ENV = 'IHUI_PUSH_RECEIPT_KEY_FILE'
export const RECEIPT_KEY_CONFIG = 'ihui.pushReceiptKeyPath'
export const MIN_KEY_CHARS = 32
export const RECEIPT_WAIT_ENV = 'IHUI_PUSH_RECEIPT_WAIT_MS'
export const DEFAULT_RECEIPT_WAIT_MS = 240 * 1000
export const PUSHED_TREE_POLICY = 'full-head-face'

// 凭据必须钉住的 runner 闭包：runner 本体 + 批量执行器。
// 门脚本 blob 逐门记在 gateSet 里，见 buildGateCacheKey。
export const RUNNER_CLOSURE = Object.freeze([
  'scripts/guardian-runner.mjs',
  'scripts/lib/guardian-executor.mjs',
])

/**
 * 推送门的唯一期望集合。
 * 与 scripts/guardian-runner.mjs 的 pushGateChecks 逐项一致（镜像夹具锁住），
 * 外加 bash 钩子里两条不在 runner 注册表里的推送步骤：
 *   173p check-doc-numbers.mjs --strict --push（阻塞）
 *   i18n scan-dead-i18n-keys.mjs --dry-run（非阻塞审计，rc 不参与准入）
 */
export const EXPECTED_GATES = Object.freeze([
  { id: 'T1', script: 'check-typecheck.mjs', args: [], mode: 'blocking' },
  { id: '193', script: 'check-git-stdio-discipline.mjs', args: [], mode: 'blocking' },
  { id: '47p', script: 'check-watermark-coverage.mjs', args: ['--push-scope'], mode: 'blocking' },
  { id: 'IG', script: 'check-immutable-guard.mjs', args: ['--range', 'origin/main..HEAD'], mode: 'blocking' },
  { id: '299', script: 'check-miniapp-shell-form.mjs', args: [], mode: 'blocking' },
  { id: '300', script: 'check-api-endpoint-delta.mjs', args: [], mode: 'blocking' },
  { id: '301', script: 'check-web-mp-route-carriers.mjs', args: [], mode: 'blocking' },
  { id: '302p', script: 'check-cross-end-parity-drift.mjs', args: ['--gate', '--push'], mode: 'blocking' },
  { id: '303p', script: 'check-i18n-cross-end-wording.mjs', args: ['--gate', '--push'], mode: 'blocking' },
  { id: '304p', script: 'check-shared-layer-duplication.mjs', args: ['--platform-purity'], mode: 'blocking' },
  { id: '306p', script: 'gen-knip-taro-entries.mjs', args: ['--check'], mode: 'blocking' },
  { id: '307p', script: 'gen-tool-name-sets.mjs', args: ['--check'], mode: 'blocking' },
  { id: '308p', script: 'gen-rn-shell-scaffold.mjs', args: ['--all'], mode: 'blocking' },
  { id: '173p', script: 'check-doc-numbers.mjs', args: ['--strict', '--push'], mode: 'blocking' },
  { id: 'i18n', script: 'scan-dead-i18n-keys.mjs', args: ['--dry-run'], mode: 'advisory' },
])

const GATE_KEYS = ['id', 'script', 'args', 'mode', 'scriptBlob', 'cacheKey', 'rc', 'durationMs']
const TOP_KEYS = [
  'version',
  'runnerVersion',
  'nodeVersion',
  'commitSha',
  'treeSha',
  'remoteBase',
  'issuedAt',
  'expiresAt',
  'worktreeClean',
  'pushedTreePolicy',
  'runnerClosure',
  'gateSetHash',
  'gateSet',
  'signature',
]

export function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex')
}

export function receiptDir(root) {
  return join(root, RECEIPT_DIR_REL)
}

export function receiptPath(root, commitSha) {
  return join(receiptDir(root), `${commitSha}.json`)
}

export function markerPath(root, headSha) {
  return join(receiptDir(root), `${headSha}.running`)
}

export function lockPath(root) {
  return join(receiptDir(root), '.worker.lock')
}

export function canonicalGate(g) {
  return {
    id: String(g.id),
    script: String(g.script),
    args: (g.args || []).map(String),
    mode: g.mode === 'advisory' ? 'advisory' : 'blocking',
    scriptBlob: String(g.scriptBlob),
    cacheKey: String(g.cacheKey),
    // 保留 null 而不是 Number(null)=0：rc 缺失绝不能被规范化成"通过"。
    rc: typeof g.rc === 'number' ? g.rc : null,
    durationMs: typeof g.durationMs === 'number' ? g.durationMs : null,
  }
}

export function buildGateCacheKey({ treeSha, id, runnerBlob, executorBlob, scriptBlob, nodeVersion }) {
  return sha256Hex(
    [treeSha, String(id), RUNNER_VERSION, runnerBlob, executorBlob, scriptBlob, nodeVersion].join('\0'),
  )
}

function buildPayload(receipt) {
  return {
    version: receipt.version,
    runnerVersion: receipt.runnerVersion,
    nodeVersion: receipt.nodeVersion,
    commitSha: receipt.commitSha,
    treeSha: receipt.treeSha,
    remoteBase: receipt.remoteBase,
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
    worktreeClean: receipt.worktreeClean,
    pushedTreePolicy: receipt.pushedTreePolicy,
    runnerClosure: (receipt.runnerClosure || []).map((x) => ({ path: String(x.path), blob: String(x.blob) })),
    gateSetHash: receipt.gateSetHash,
    gateSet: (receipt.gateSet || []).map(canonicalGate),
  }
}

export function signReceipt(receipt, key) {
  return createHmac('sha256', key).update(JSON.stringify(buildPayload(receipt))).digest('hex')
}

function exactKeys(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const actual = Object.keys(obj).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((k, i) => k === expected[i])
}

function readKeyFromSources(root, sources) {
  for (const src of sources) {
    if (src.env) {
      const v = process.env[src.env]
      if (typeof v === 'string' && v.trim().length >= MIN_KEY_CHARS) return v.trim()
    }
    if (src.fileEnv) {
      const p = process.env[src.fileEnv]
      if (typeof p === 'string' && p.trim()) {
        try {
          const v = readFileSync(p.trim(), 'utf8').trim()
          if (v.length >= MIN_KEY_CHARS) return v
        } catch {
          /* 读不到继续尝试下一来源 */
        }
      }
    }
    if (src.config) {
      // 配置项以 `...KeyPath` 命名 ⇒ 值是**文件路径**，必须读文件内容作为密钥材料；
      // 绝不能把路径字符串本身当密钥（否则路径公开可猜 = 人人可伪造凭据）。
      try {
        const p = gitRaw(['config', '--get', src.config], root).trim()
        if (p) {
          const v = readFileSync(p, 'utf8').trim()
          if (v.length >= MIN_KEY_CHARS) return v
        }
      } catch {
        /* 无该配置/读不到继续尝试下一来源 */
      }
    }
  }
  return null
}

const IG_KEY_SOURCES = [
  { env: 'IHUI_IMMUTABLE_GUARD_KEY' },
  { fileEnv: 'IHUI_IMMUTABLE_GUARD_KEY_FILE' },
  { config: 'ihui.immutableGuardKeyPath' },
]
const IG_ACK_KEY_SOURCES = [
  { env: 'IHUI_IMMUTABLE_GUARD_ACK_KEY' },
  { fileEnv: 'IHUI_IMMUTABLE_GUARD_ACK_KEY_FILE' },
  { config: 'ihui.immutableGuardAckKeyPath' },
]
const RECEIPT_KEY_SOURCES = [
  { env: RECEIPT_KEY_ENV },
  { fileEnv: RECEIPT_KEY_FILE_ENV },
  { config: RECEIPT_KEY_CONFIG },
]

/**
 * 解析凭据签名钥，并强制与 IG 提交钥 / IG ack 钥不同（复用了同一把钥等于把
 * 「凭据签发权」与「不可变守卫豁免权」绑死，任何一边泄露都会同时污染另一边）。
 */
export function loadReceiptKey(root) {
  const key = readKeyFromSources(root, RECEIPT_KEY_SOURCES)
  if (!key) return { ok: false, code: 'key-unavailable' }
  const igKey = readKeyFromSources(root, IG_KEY_SOURCES)
  const ackKey = readKeyFromSources(root, IG_ACK_KEY_SOURCES)
  if (igKey && key === igKey) return { ok: false, code: 'key-collision-ig' }
  if (ackKey && key === ackKey) return { ok: false, code: 'key-collision-ack' }
  return { ok: true, key, keyId: sha256Hex(key).slice(0, 16) }
}

export function parsePushRefs(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const refs = []
  for (const line of lines) {
    const parts = line.split(/\s+/)
    if (parts.length < 4) return { ok: false, code: 'refs-parse' }
    refs.push({ localRef: parts[0], localSha: parts[1], remoteRef: parts[2], remoteSha: parts[3] })
  }
  if (refs.length === 0) return { ok: false, code: 'refs-empty' }
  return { ok: true, refs }
}

/**
 * 只接受「全部是分支引用、全部指向同一个本地 commit、无删除」的推送。
 * 标签/混合/删除/多 tip 一律回落真跑门（判据不变，只是不省这一步）。
 */
export function evaluateRefs(refs, headSha) {
  const bad = (code, detail = '') => ({ ok: false, code, detail })
  for (const r of refs) {
    if (!r.remoteRef.startsWith('refs/heads/')) return bad('refs-not-branch', r.remoteRef)
    if (/^0+$/.test(r.localSha)) return bad('refs-deletion', r.localRef)
    if (r.localSha !== headSha) return bad('refs-head-mismatch', `${r.localRef}=${r.localSha}`)
    if (!/^[0-9a-f]{40}$/.test(r.localSha)) return bad('refs-sha-invalid', r.localSha)
  }
  return { ok: true, refs }
}

export function gatherContext(root, pushRefsRaw = process.env.PUSH_REFS || '') {
  const headOut = gitRaw(['rev-parse', 'HEAD', 'HEAD^{tree}', 'origin/main'], root)
    .trim()
    .split(/\r?\n/)
  if (headOut.length < 3) throw new Error('rev-parse 输出不足')
  const [headSha, treeSha, originMainSha] = headOut.map((s) => s.trim())

  const paths = [...RUNNER_CLOSURE, ...EXPECTED_GATES.map((g) => `scripts/${g.script}`)]
  const blobOut = gitRaw(['cat-file', '--batch-check=%(objectname)'], root, {
    input: paths.map((p) => `${headSha}:${p}`).join('\n') + '\n',
  })
  const blobLines = blobOut
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
  if (blobLines.length !== paths.length) throw new Error('cat-file 行数不匹配')
  const blobs = {}
  paths.forEach((p, i) => {
    if (!/^[0-9a-f]{40}$/.test(blobLines[i])) throw new Error(`blob 缺失: ${p}`)
    blobs[p] = blobLines[i]
  })

  const parsedRefs = parsePushRefs(pushRefsRaw)
  const refs = parsedRefs.ok ? evaluateRefs(parsedRefs.refs, headSha) : parsedRefs
  return {
    root,
    headSha,
    treeSha,
    originMainSha,
    nodeVersion: process.version,
    blobs,
    refs,
  }
}

function judgeByBlobs(root, receipt, ctx) {
  for (const item of receipt.runnerClosure || []) {
    if (ctx.blobs[item.path] !== item.blob) return { ok: false, code: 'runner-blob-mismatch', detail: item.path }
  }
  const expectedById = new Map(EXPECTED_GATES.map((g) => [g.id, g]))
  const seen = new Set()
  for (const g of receipt.gateSet || []) {
    if (seen.has(g.id)) return { ok: false, code: 'gate-duplicate', detail: g.id }
    seen.add(g.id)
    const exp = expectedById.get(g.id)
    if (!exp) return { ok: false, code: 'gate-unknown', detail: g.id }
    if (exp.script !== g.script) return { ok: false, code: 'gate-script-drift', detail: g.id }
    if (JSON.stringify(exp.args) !== JSON.stringify(g.args)) return { ok: false, code: 'gate-args-drift', detail: g.id }
    if (exp.mode !== g.mode) return { ok: false, code: 'gate-mode-drift', detail: g.id }
    const path = `scripts/${g.script}`
    if (ctx.blobs[path] !== g.scriptBlob) return { ok: false, code: 'gate-script-blob-mismatch', detail: g.id }
    const want = buildGateCacheKey({
      treeSha: receipt.treeSha,
      id: g.id,
      runnerBlob: ctx.blobs['scripts/guardian-runner.mjs'],
      executorBlob: ctx.blobs['scripts/lib/guardian-executor.mjs'],
      scriptBlob: g.scriptBlob,
      nodeVersion: receipt.nodeVersion,
    })
    if (want !== g.cacheKey) return { ok: false, code: 'gate-cache-key-mismatch', detail: g.id }
    if (!Number.isFinite(g.durationMs) || g.durationMs < 0) return { ok: false, code: 'gate-duration-invalid', detail: g.id }
    if (exp.mode === 'blocking' && g.rc !== 0) return { ok: false, code: 'gate-not-passed', detail: `${g.id}:rc=${g.rc}` }
  }
  for (const g of EXPECTED_GATES) {
    if (!seen.has(g.id)) return { ok: false, code: 'gate-missing', detail: g.id }
  }
  const gateSetHash = sha256Hex(JSON.stringify((receipt.gateSet || []).map(canonicalGate)))
  if (gateSetHash !== receipt.gateSetHash) return { ok: false, code: 'gate-set-hash-mismatch' }
  return { ok: true }
}

/**
 * 纯判定：给一份 receipt + 一份已取证的 context（含 push refs 判定结果），
 * 返回 ok 或具体回落原因。上下文（HEAD/tree/origin/main/blob）由 gatherContext 取证。
 */
export function judgeReceipt({ receipt, context, key, now = Date.now() }) {
  const fail = (code, detail = '') => ({ ok: false, code, detail })
  if (!receipt || typeof receipt !== 'object') return fail('receipt-parse')
  if (!exactKeys(receipt, TOP_KEYS)) return fail('receipt-schema')
  if (!exactKeys(receipt.signature, ['alg', 'keyId', 'sig'])) return fail('signature-schema')
  if (receipt.version !== RECEIPT_VERSION) return fail('receipt-version')
  if (receipt.runnerVersion !== RUNNER_VERSION) return fail('runner-version')
  if (receipt.nodeVersion !== context.nodeVersion) return fail('node-version-drift')
  if (receipt.pushedTreePolicy !== PUSHED_TREE_POLICY) return fail('tree-policy')
  if (receipt.worktreeClean !== true) return fail('worktree-not-clean-at-issue')

  // 闭包必须恰好是 RUNNER_CLOSURE 全量且顺序钉死：少一条就等于"runner/执行器不被钉住"。
  const closure = Array.isArray(receipt.runnerClosure) ? receipt.runnerClosure : []
  if (closure.length !== RUNNER_CLOSURE.length) return fail('runner-closure-missing')
  for (const [i, path] of RUNNER_CLOSURE.entries()) {
    if (!exactKeys(closure[i], ['path', 'blob'])) return fail('runner-closure-schema')
    if (closure[i].path !== path) return fail('runner-closure-mismatch', path)
  }

  // 门对象本身也做白名单键校验：多余字段不能借签名外空间"携带语义"。
  for (const g of receipt.gateSet || []) {
    if (!exactKeys(g, GATE_KEYS)) return fail('gate-schema', String(g?.id))
  }

  if (receipt.signature.alg !== 'hmac-sha256') return fail('signature-alg')
  const wantSig = signReceipt(receipt, key)
  const gotSig = String(receipt.signature.sig || '')
  if (gotSig.length !== wantSig.length) return fail('signature-invalid')
  try {
    if (!timingSafeEqual(Buffer.from(wantSig, 'hex'), Buffer.from(gotSig, 'hex'))) return fail('signature-invalid')
  } catch {
    return fail('signature-invalid')
  }

  const issuedAt = Date.parse(receipt.issuedAt)
  const expiresAt = Date.parse(receipt.expiresAt)
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return fail('ttl-invalid')
  if (issuedAt > now + RECEIPT_CLOCK_SKEW_MS) return fail('ttl-future')
  if (now > expiresAt) return fail('ttl-expired')

  if (receipt.commitSha !== context.headSha) return fail('commit-mismatch', receipt.commitSha)
  if (receipt.treeSha !== context.treeSha) return fail('tree-mismatch', receipt.treeSha)
  if (receipt.remoteBase !== context.originMainSha) return fail('remote-base-mismatch', receipt.remoteBase)
  if (!context.refs || !context.refs.ok) return fail(context.refs?.code || 'refs-invalid')

  const byBlobs = judgeByBlobs(context.root, receipt, context)
  if (!byBlobs.ok) return byBlobs
  return { ok: true }
}

function readReceipt(root, commitSha) {
  const p = receiptPath(root, commitSha)
  if (!existsSync(p)) return { ok: false, code: 'receipt-missing' }
  try {
    const raw = readFileSync(p, 'utf8')
    if (raw.length > 4 * 1024 * 1024) return { ok: false, code: 'receipt-too-large' }
    return { ok: true, receipt: JSON.parse(raw) }
  } catch {
    return { ok: false, code: 'receipt-parse' }
  }
}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    /* 忽略 */
  }
}

export function receiptWaitMs() {
  const raw = process.env[RECEIPT_WAIT_ENV]
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) return n
  return DEFAULT_RECEIPT_WAIT_MS
}

/**
 * 推送侧入口：读凭据并判定。凭据缺失但提交侧 worker 正在跑同一 HEAD 时，
 * 先等（上限 receiptWaitMs）—— 满足「要么等凭据、要么回落真跑」，不留"未跑完先推"窗口。
 */
export function verifyPushReceipt(root, { wait = true, now = Date.now() } = {}) {
  const keyInfo = loadReceiptKey(root)
  if (!keyInfo.ok) return { ok: false, code: keyInfo.code }

  let ctx
  try {
    ctx = gatherContext(root)
  } catch (error) {
    return { ok: false, code: 'context-gather-failed', detail: String(error?.message || error) }
  }
  if (!ctx.refs.ok) return { ok: false, code: ctx.refs.code, detail: ctx.refs.detail }

  for (const r of ctx.refs.refs) {
    if (!/^0+$/.test(r.remoteSha)) {
      try {
        gitRaw(['merge-base', '--is-ancestor', r.remoteSha, r.localSha], root)
      } catch {
        return { ok: false, code: 'refs-non-fast-forward', detail: `${r.remoteSha}..${r.localSha}` }
      }
    }
  }

  let got = readReceipt(root, ctx.headSha)
  if (!got.ok && wait) {
    const marker = markerPath(root, ctx.headSha)
    const deadline = Date.now() + receiptWaitMs()
    while (Date.now() < deadline && existsSync(marker)) {
      sleepSync(2000)
      got = readReceipt(root, ctx.headSha)
      if (got.ok) break
    }
    if (got.ok) {
      try {
        ctx = gatherContext(root)
      } catch (error) {
        return { ok: false, code: 'context-gather-failed', detail: String(error?.message || error) }
      }
    }
  }
  if (!got.ok) return { ok: false, code: got.code }

  return judgeReceipt({ receipt: got.receipt, context: ctx, key: keyInfo.key, now })
}

/**
 * 提交侧签发：校验逐门结果与期望集合完全一致后签名落盘（临时文件 + rename 原子替换）。
 */
export function issueReceipt({ root, ctx, gateRows, now = Date.now() }) {
  const fail = (code, detail = '') => ({ ok: false, code, detail })
  const rowsById = new Map()
  for (const row of gateRows || []) {
    const id = String(row?.id)
    if (rowsById.has(id)) return fail('gate-duplicate', id)
    rowsById.set(id, row)
  }
  const gateSet = []
  for (const exp of EXPECTED_GATES) {
    const row = rowsById.get(exp.id)
    if (!row) return fail('gate-missing', exp.id)
    if (row.cached === true) return fail('gate-cached-row', exp.id)
    if (row.script !== exp.script) return fail('gate-script-drift', exp.id)
    if (row.args && JSON.stringify(row.args) !== JSON.stringify(exp.args)) return fail('gate-args-drift', exp.id)
    if (String(row.mode) !== exp.mode) return fail('gate-mode-drift', exp.id)
    const scriptBlob = ctx.blobs[`scripts/${exp.script}`]
    if (!scriptBlob) return fail('gate-script-blob-missing', exp.id)
    const gates = {
      ...exp,
      scriptBlob,
      cacheKey: buildGateCacheKey({
        treeSha: ctx.treeSha,
        id: exp.id,
        runnerBlob: ctx.blobs['scripts/guardian-runner.mjs'],
        executorBlob: ctx.blobs['scripts/lib/guardian-executor.mjs'],
        scriptBlob,
        nodeVersion: ctx.nodeVersion,
      }),
      rc: row.rc,
      durationMs: row.durationMs,
    }
    if (exp.mode === 'blocking') {
      if (row.rc !== 0) return fail('gate-not-passed', `${exp.id}:rc=${row.rc}`)
      if (!Number.isFinite(row.durationMs) || row.durationMs < 0) return fail('gate-duration-invalid', exp.id)
    } else if (!Number.isFinite(row.durationMs) || row.durationMs < 0) {
      return fail('gate-duration-invalid', exp.id)
    }
    gateSet.push(gates)
  }
  for (const id of rowsById.keys()) {
    if (!EXPECTED_GATES.some((g) => g.id === id)) return fail('gate-unknown', id)
  }

  const receipt = {
    version: RECEIPT_VERSION,
    runnerVersion: RUNNER_VERSION,
    nodeVersion: ctx.nodeVersion,
    commitSha: ctx.headSha,
    treeSha: ctx.treeSha,
    remoteBase: ctx.originMainSha,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RECEIPT_TTL_MS).toISOString(),
    worktreeClean: true,
    pushedTreePolicy: PUSHED_TREE_POLICY,
    runnerClosure: RUNNER_CLOSURE.map((p) => ({ path: p, blob: ctx.blobs[p] })),
    gateSetHash: sha256Hex(JSON.stringify(gateSet.map(canonicalGate))),
    gateSet: gateSet.map(canonicalGate),
  }

  const keyInfo = loadReceiptKey(root)
  if (!keyInfo.ok) return { ok: false, code: keyInfo.code }
  receipt.signature = { alg: 'hmac-sha256', keyId: keyInfo.keyId, sig: signReceipt(receipt, keyInfo.key) }

  const dir = receiptDir(root)
  mkdirSync(dir, { recursive: true })
  const dest = receiptPath(root, ctx.headSha)
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, JSON.stringify(receipt, null, 2) + '\n', 'utf8')
  renameSync(tmp, dest)
  return { ok: true, receipt, path: dest }
}

export function cleanupStaleLock(root, maxAgeMs = 30 * 60 * 1000) {
  const p = lockPath(root)
  try {
    const st = statSync(p)
    if (Date.now() - st.mtimeMs > maxAgeMs) {
      unlinkSync(p)
      return true
    }
  } catch {
    /* 不存在即无需清理 */
  }
  return false
}

export function removeFileQuietly(p) {
  try {
    unlinkSync(p)
  } catch {
    /* 忽略 */
  }
}

export function resolveRootFromModule(moduleUrl) {
  const here = dirname(new URL(moduleUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  return resolve(here, '..', '..')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
