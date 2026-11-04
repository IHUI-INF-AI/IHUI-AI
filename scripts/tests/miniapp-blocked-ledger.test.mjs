// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// blocked 侧车镜像测试(黑盒):锁「词表不变 / 分桶不变 / 侧车合法 / 不替产品拍板」。
// 判据不复制:分桶真相源在 report-rn-miniapp-gaps.mjs 的 evidence 正则,
// 本测试只跑它的 --json 并断言读数,不在测试里重写 CLOSED_RE / BLOCKED_RE。
// 台账行数/三档分布一律不写死 —— 并行会话随时会追加行(实测 114→115),写死只会在真实仓造假红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERDICT_KINDS, VERDICTS_PATH, readVerdicts } from '../lib/cross-end-verdicts.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LEDGER = 'scripts/data/miniapp-blocked-ledger.jsonl'
// 落地前在隔离 worktree 验收时用 --worktree 面;落地后默认 HEAD 面(与报告器同面)。
const WT_FACE = process.env.IHUI_BLOCKED_FACE === 'worktree'
const FACE_ARGS = WT_FACE ? ['--worktree'] : []

const reportJson = () =>
  JSON.parse(
    execFileSync(process.execPath, [resolve(ROOT, 'scripts/report-rn-miniapp-gaps.mjs'), '--json', ...FACE_ARGS], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )

const ledgerText = () =>
  WT_FACE
    ? readFileSync(resolve(ROOT, LEDGER), 'utf8')
    : execFileSync('git', ['-C', ROOT, 'show', `HEAD:${LEDGER}`], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })

const ledgerRows = () =>
  String(ledgerText())
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => JSON.parse(x))

test('B1 词表不变:VERDICT_KINDS 仍三档,侧车没有偷偷新增第四档', () => {
  assert.deepEqual([...VERDICT_KINDS].sort(), ['generated', 'missing', 'not-applicable'])
})

test('B2 分桶不因侧车改变:三桶之和恒等于已造页,blocked 桶条数由 evidence 决定', () => {
  const j = reportJson()
  assert.equal(j.stats.hooksGenerated, j.stats.hooksClosed + j.stats.hooksBlocked + j.stats.hooksPending)
  assert.equal(j.hooks.blocked.length, j.stats.hooksBlocked)
  assert.equal(j.blockedAudit.hooksBlockedFromEvidence, j.stats.hooksBlocked)
  assert.equal(
    j.hooks.blocked.length,
    j.blockedAudit.registered + j.blockedAudit.unregistered.length,
    '侧车不得改变 blocked 桶条数',
  )
  assert.ok(j.stats.hooksBlocked >= 8, '现读 blocked 不得少于侧车登记数')
})

test('B3 侧车 8 行且全部合法:screen 落在主台账,字段齐,blockKind 闭合', () => {
  const rows = ledgerRows()
  assert.equal(rows.length, 8)
  const v = readVerdicts('head', ROOT)
  const shared = new Set(v.rows.map((r) => r.shared))
  const kinds = new Set(['blocked-structure', 'blocked-api', 'mobile-only'])
  for (const r of rows) {
    assert.ok(shared.has(r.screen), `侧车 screen 不在主台账:${r.screen}`)
    assert.ok(kinds.has(r.blockKind), `blockKind 非法:${r.blockKind}`)
    assert.ok(r.reason.length >= 20, `reason 太短:${r.screen}`)
    assert.ok(r.owner, `缺 owner:${r.screen}`)
    assert.equal(r.decidedBy, '', `不替产品拍板:decidedBy 必须空:${r.screen}`)
    assert.match(r.recheckAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(r.evidenceRef, /:\d+$/)
  }
  assert.equal(new Set(rows.map((r) => r.screen)).size, 8, 'screen 不得重复')
})

test('B4 blockedAudit 全绿:登记 8 / 未登记 0 / 坏行 0 / 腐烂 0 / 标签不符 0 / 到期 0 / 重复 0', () => {
  const a = reportJson().blockedAudit
  assert.equal(a.available, true, '取材面必须取得到侧车')
  assert.equal(a.registered, 8)
  assert.deepEqual(a.unregistered, [])
  assert.equal(a.invalid.length, 0)
  assert.equal(a.stale.length, 0)
  assert.equal(a.mismatch.length, 0)
  assert.equal(a.expired.length, 0)
  assert.equal(a.duplicate.length, 0)
})

test('B5 不替产品做决策:8 条全部待裁决,类别分布 5 structure / 3 api', () => {
  const j = reportJson()
  assert.equal(j.blockedAudit.pendingDecision, 8)
  assert.equal(j.stats.blockedPendingDecision, 8)
  assert.deepEqual(j.blockedAudit.byKind, { 'blocked-structure': 5, 'blocked-api': 3 })
})

test('B6 主台账词表自洽且与报告器同面:不写死行数,侧车不污染词表', () => {
  const v = readVerdicts('head', ROOT)
  const j = reportJson()
  assert.ok(v.rows.length > 0, '主台账取不到')
  assert.equal(v.bad.length, 0, '主台账不得有坏行')
  const kinds = new Set([...VERDICT_KINDS])
  for (const r of v.rows) {
    assert.ok(kinds.has(r.verdict), `主台账出现词表外档位:${r.verdict}`)
    assert.ok(!String(r.verdict).startsWith('blocked-'), '侧车类别污染了主台账词表')
  }
  assert.equal(
    v.rows.filter((r) => r.verdict === 'generated').length,
    j.stats.ledgerGenerated,
    '主台账 generated 条数必须与报告器读数一致(不许两份真相源)',
  )
  assert.equal(j.stats.hooksGenerated, j.stats.hooksClosed + j.stats.hooksBlocked + j.stats.hooksPending)
  assert.equal(VERDICTS_PATH, 'scripts/data/miniapp-mirror-verdicts.jsonl')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
