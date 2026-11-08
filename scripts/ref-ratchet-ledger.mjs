#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 引用棘轮的台账生成器 —— 钩子之外的**离线**入口（钩子写账经 ref-ratchet-main.mjs → 同一份 lib）。
 * 手改台账一律被 `--verify` 的链式哈希拒绝。
 *
 * 子命令：
 *   --seed --at <sha>   一次性把 <sha> 的存量红全量登记（跑几分钟无所谓；**绝不挂在 update-ref 上**）
 *   --verify            台账体检：坏行/重复键/断链/有锚点没台账/有台账没锚点
 *   --prune [--at <sha>] 清 undetermined 过期项；给了 --at 时对红路径重跑，已不再红的一并撤账
 *   --status            只读报数（条目数、最近心跳、锚点）
 *
 * 台账位置：<git-common-dir>/ihui-ref-ratchet/（不入库、跨 worktree 共享、**删了等于棘轮归零**）。
 * 删掉的后果不是"静默从零开始"：seed 会留下 anchor.json，`--verify` 见"有锚点没台账"即报错。
 */

import { performance } from 'node:perf_hooks'

import {
  anchorPath,
  compactLedger,
  deleteLedgerKeys,
  ensureStateDir,
  git,
  heartbeatPath,
  ledgerPath,
  putLedger,
  readLedger,
  safeJson,
  stateDir,
  verifyLedger,
  writeAnchor,
} from './lib/ref-ratchet-state.mjs'
import { adaptStdioDiscipline, adaptWatermark } from './lib/ref-ratchet-adapters.mjs'

const argv = process.argv.slice(2)
const has = (n) => argv.includes(n)
const arg = (n, d = null) => {
  const i = argv.indexOf(n)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
}
const OID_RE = /^[0-9a-f]{40}$/
const SCRIPT_RE = /\.(mjs|js|sh)$/

function root() {
  const explicit = arg('--root')
  if (explicit) return explicit
  return String(git(process.cwd(), ['rev-parse', '--show-toplevel'], { allowFail: true }) ?? process.cwd()).trim()
}

function pathsAt(repo, rev) {
  const raw = git(repo, ['ls-tree', '-r', '--name-only', '-z', rev])
  return String(raw).split('\0').filter(Boolean)
}

function count(dir = stateDir(root())) {
  const read = readLedger(dir)
  const red = [...read.entries.values()].filter((e) => e.status === 'red').length
  const undetermined = [...read.entries.values()].filter((e) => e.status === 'undetermined').length
  return { total: read.entries.size, red, undetermined }
}

function seed() {
  const repo = root()
  const at = arg('--at')
  if (!at || !OID_RE.test(at)) {
    console.error('--seed 需要 --at <40 位 sha>')
    return 2
  }
  const dir = ensureStateDir(stateDir(repo))
  const existing = readLedger(dir)
  if (existing.errors.length) {
    console.error(`台账已损坏，拒绝 seed：${existing.errors[0]}`)
    return 1
  }
  const known = new Set(existing.entries.keys())
  const t0 = performance.now()
  const all = pathsAt(repo, at)
  console.log(`[seed] ${at} 全量 ${all.length} 个路径，开始 47p 水印面…`)
  const wm = adaptWatermark({ root: repo, newOid: at, paths: all })
  console.log(`[seed] 47p: findings=${wm.findings.length} undetermined=${wm.undetermined.length}`)
  const scripts = all.filter((p) => p.startsWith('scripts/') && SCRIPT_RE.test(p))
  console.log(`[seed] 193 脚本面 ${scripts.length} 个路径…`)
  const std = adaptStdioDiscipline({ root: repo, newOid: at, paths: scripts })
  console.log(`[seed] 193: findings=${std.findings.length} undetermined=${std.undetermined.length}`)

  const now = new Date().toISOString()
  const rows = []
  let added = 0
  let skipped = 0
  for (const [gate, findings] of [
    ['47p', wm.findings],
    ['193', std.findings],
  ]) {
    for (const f of findings) {
      if (known.has(`${gate}\u0000${f.path}`)) {
        skipped++
        continue
      }
      added++
      rows.push({ gate, path: f.path, blob: f.blob ?? null, status: 'red', firstSeen: now, lastSeen: now })
    }
  }
  const undetermined = [...wm.undetermined.map((u) => ({ gate: '47p', u })), ...std.undetermined.map((u) => ({ gate: '193', u }))]
  for (const { gate, u } of undetermined) {
    rows.push({
      gate,
      path: u.path ?? '*',
      blob: null,
      status: 'undetermined',
      missing: `${u.reason}: ${u.missing}`,
      firstSeen: now,
      lastSeen: now,
    })
  }
  putLedger(dir, rows, { allowNoPrev: !existing.exists })
  const counts = count(dir)
  const anchor = {
    seedAt: now,
    seedSha: at,
    seeded: {
      watermark: wm.findings.length,
      stdio: std.findings.length,
      added,
      skippedExisting: skipped,
      undetermined: undetermined.length,
    },
    durationMs: Math.round(performance.now() - t0),
    ...counts,
  }
  writeAnchor(dir, anchor)
  console.log(
    `[seed] 完成：新增 ${added} 条（47p red=${wm.findings.length} / 193 red=${std.findings.length}），` +
      `跳过已登记 ${skipped} 条，耗时 ${anchor.durationMs}ms，锚点写入 ${anchorPath(dir)}`,
  )
  return 0
}

function prune() {
  const repo = root()
  const dir = ensureStateDir(stateDir(repo))
  const at = arg('--at')
  const before = count(dir)
  const res = compactLedger(dir, {})
  console.log(`[prune] 过期 undetermined 清理：保留 ${res.kept} 条，移除 ${res.removed} 条`)
  if (at) {
    if (!OID_RE.test(at)) {
      console.error('--prune --at 需要 40 位 sha')
      return 2
    }
    // 只对台账里已记 red 的路径重跑：不再红的撤账，仍红的刷新 blob/lastSeen。
    const read = readLedger(dir)
    const redOf = (gate) =>
      [...read.entries.values()]
        .filter((e) => e.gate === gate && e.status === 'red' && e.path !== '*')
        .map((e) => e.path)
    const wmPaths = redOf('47p')
    const stdPaths = redOf('193')
    const wm = adaptWatermark({ root: repo, newOid: at, paths: wmPaths })
    const std = adaptStdioDiscipline({ root: repo, newOid: at, paths: stdPaths })
    const stillWm = new Set(wm.findings.map((f) => f.path))
    const stillStd = new Set(std.findings.map((f) => f.path))
    const gone = [
      ...wmPaths.filter((p) => !stillWm.has(p)).map((p) => ['47p', p]),
      ...stdPaths.filter((p) => !stillStd.has(p)).map((p) => ['193', p]),
    ]
    if (gone.length) deleteLedgerKeys(dir, gone)
    const now = new Date().toISOString()
    const rows = [
      ...wm.findings.filter((f) => stillWm.has(f.path)).map((f) => ({ gate: '47p', path: f.path, blob: f.blob ?? null, status: 'red', lastSeen: now })),
      ...std.findings.filter((f) => stillStd.has(f.path)).map((f) => ({ gate: '193', path: f.path, blob: f.blob ?? null, status: 'red', lastSeen: now })),
    ]
    putLedger(dir, rows)
    console.log(
      `[prune] 重判：47p 仍红 ${stillWm.size}/${wmPaths.length}，193 仍红 ${stillStd.size}/${stdPaths.length}，撤账 ${gone.length} 条`,
    )
  }
  const after = count(dir)
  console.log(`[prune] 之前 ${JSON.stringify(before)} → 之后 ${JSON.stringify(after)}`)
  return 0
}

function verify() {
  const dir = stateDir(root())
  const res = verifyLedger(dir)
  if (res.ok) {
    console.log(`[verify] OK ${JSON.stringify(count(dir))} ledger=${ledgerPath(dir)}`)
    return 0
  }
  console.error('[verify] 台账体检失败：')
  for (const e of res.errors) console.error(`  · ${e}`)
  return 1
}

function status() {
  const dir = stateDir(root())
  const read = readLedger(dir)
  const hb = safeJson(heartbeatPath(dir))
  const anchor = safeJson(anchorPath(dir))
  console.log(
    JSON.stringify(
      {
        ledger: ledgerPath(dir),
        exists: read.exists,
        ...count(dir),
        errors: read.errors,
        anchor: anchor ? { seedAt: anchor.seedAt, seedSha: anchor.seedSha, seeded: anchor.seeded } : null,
        heartbeat: hb,
      },
      null,
      2,
    ),
  )
  return 0
}

let code = 2
if (has('--seed')) code = seed()
else if (has('--verify')) code = verify()
else if (has('--prune')) code = prune()
else if (has('--status')) code = status()
else console.error('用法: --seed --at <sha> | --verify | --prune [--at <sha>] | --status')
process.exitCode = code
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
