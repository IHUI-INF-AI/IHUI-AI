// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​​​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 允许差异到期回收器的镜像测试(§22c:import 源脚本 __test__,不在测试里复算判据)。
//
// 钉四件事:
//   T01 三态边界:active / expiring(≤90 天,含当日到期)/ expired;
//   T02 裸条目(缺 owner / 缺 expires / 非法 expires)一律 expired,不许默默放过;
//   T03 --gate 行为差异:临期只告警(exit 0),expired 仍然 exit 1;
//   T04 逐条点名的 locator 给得出 文件:行(报告要能让人点回去看原条目)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as C } from '../check-allowed-diffs-expiry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-allowed-diffs-expiry.mjs')
const REPO = resolve(HERE, '..', '..')
const TODAY = '2026-11-03'

const entry = (over = {}) => ({
  component: 'Widget',
  key: 'geometry',
  platform: 'both',
  owner: 'cross-end-ui',
  expires: '2027-03-27',
  count: 1,
  reason: '测试夹具:两端几何档读数仍有差,到期前必须复核。',
  evidence: 'fixture',
  ...over,
})

const run = (args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('T01 三态边界:active / expiring(≤90 天,含当日到期)/ expired', () => {
  assert.equal(C.classifyEntry(entry({ expires: '2028-01-01' }), TODAY).status, 'active')
  assert.equal(C.classifyEntry(entry({ expires: '2027-01-01' }), TODAY).status, 'expiring')
  const today = C.classifyEntry(entry({ expires: TODAY }), TODAY)
  assert.equal(today.status, 'expiring')
  assert.equal(today.daysLeft, 0)
  assert.equal(C.classifyEntry(entry({ expires: '2026-11-02' }), TODAY).status, 'expired')
  assert.equal(C.daysBetween('2026-11-03', '2027-02-01'), 90)
})

test('T02 缺 owner / 缺 expires / 非法 expires 一律按 expired 计并计数', () => {
  const raw = JSON.stringify(
    {
      entries: [
        entry({ component: 'A' }),
        entry({ component: 'B', owner: undefined, expires: '2028-01-01' }),
        entry({ component: 'C', expires: undefined }),
        entry({ component: 'D', expires: '2027-02-30' }),
      ],
    },
    null,
    2,
  )
  const ledger = JSON.parse(raw)
  const report = C.analyzeLedger(raw, ledger, TODAY)
  assert.deepEqual(
    report.records.map((r) => r.status),
    ['active', 'expired', 'expired', 'expired'],
  )
  assert.equal(report.counts.missingOwner, 1)
  assert.equal(report.counts.missingExpires, 1)
  assert.equal(report.counts.invalidExpires, 1)
  assert.match(report.records[1].problems.join('/'), /owner 缺失/)
  assert.match(report.records[2].problems.join('/'), /expires 缺失/)
  assert.match(report.records[3].problems.join('/'), /expires 非法/)
  // entries 不是数组 ⇒ 无法判定,不得按 0 条记绿
  assert.throws(() => C.analyzeLedger('{}', {}, TODAY), /entries/)
})

test('T03 --gate 行为差异:expiring 只告警 exit 0;expired 仍 exit 1', () => {
  assert.equal(C.exitCodeFor({ expired: 0, expiring: 3 }, { gate: false }), 1)
  assert.equal(C.exitCodeFor({ expired: 0, expiring: 3 }, { gate: true }), 0)
  assert.equal(C.exitCodeFor({ expired: 1, expiring: 0 }, { gate: false }), 1)
  assert.equal(C.exitCodeFor({ expired: 1, expiring: 0 }, { gate: true }), 1)

  const dir = mkScratch('allowed-diffs-expiry')
  try {
    const onlyExpiring = join(dir, 'expiring.json')
    writeFileSync(
      onlyExpiring,
      JSON.stringify({ entries: [entry({ component: 'P', expires: '2027-01-01' })] }, null, 2),
    )
    const dry = run([`--file=${onlyExpiring}`, `--today=${TODAY}`, '--json'])
    assert.equal(dry.status, 1, '默认档临期应判 1')
    assert.equal(JSON.parse(dry.stdout).counts.expiring, 1)
    const gate = run([`--file=${onlyExpiring}`, `--today=${TODAY}`, '--gate', '--json'])
    assert.equal(gate.status, 0, '--gate 档临期只告警,不得改退出码')
    const gateHuman = run([`--file=${onlyExpiring}`, `--today=${TODAY}`, '--gate'])
    assert.match(gateHuman.stdout, /只告警,不改退出码/)

    const expiredFile = join(dir, 'expired.json')
    writeFileSync(
      expiredFile,
      JSON.stringify({ entries: [entry({ component: 'X', expires: '2026-11-02' })] }, null, 2),
    )
    const g = run([`--file=${expiredFile}`, `--today=${TODAY}`, '--gate', '--json'])
    assert.equal(g.status, 1, '--gate 不得豁免 expired')
    assert.equal(JSON.parse(g.stdout).counts.expired, 1)
    assert.equal(run([`--file=${join(dir, 'missing.json')}`]).status, 2, '读不到账本 = 无法判定')
  } finally {
    rmScratch(dir)
  }
})

test('T04 逐条点名:文件:行 与理由/owner/到期日同条给出', () => {
  const raw = readFileSync(join(REPO, C.DEFAULT_LEDGER_REL), 'utf8')
  const ledger = JSON.parse(raw)
  assert.ok(Array.isArray(ledger.entries) && ledger.entries.length > 0)
  const report = C.analyzeLedger(raw, ledger, TODAY)
  for (const r of report.records) {
    assert.ok(r.line > 0, `${r.component}×${r.key} 定位不到行号`)
  }
  assert.equal(report.counts.total, ledger.entries.length)
  assert.equal(
    report.counts.total,
    report.counts.active + report.counts.expiring + report.counts.expired,
    '三态必须覆盖全部条目',
  )
  assert.equal(report.counts.missingOwner, 0)
  assert.equal(report.counts.missingExpires, 0)

  const dir = mkScratch('allowed-diffs-expiry-line')
  try {
    const f = join(dir, 'ledger.json')
    writeFileSync(
      f,
      JSON.stringify(
        {
          entries: [
            entry({ component: 'Old', expires: '2026-10-01' }),
            entry({ component: 'Bare', owner: undefined, expires: undefined }),
          ],
        },
        null,
        2,
      ),
    )
    const out = run([`--file=${f}`, `--today=${TODAY}`])
    assert.equal(out.status, 1)
    assert.match(out.stdout, /ledger\.json:\d+ Old × geometry owner=cross-end-ui expires=2026-10-01/)
    assert.match(out.stdout, /Bare × geometry owner=\(缺失\) expires=\(缺失\)/)
  } finally {
    rmScratch(dir)
  }
})

test('T05 器物在位:默认账本真实存在且 --self-test 可跑', () => {
  assert.ok(existsSync(join(REPO, C.DEFAULT_LEDGER_REL)))
  const out = run(['--self-test'])
  assert.equal(out.status, 0)
  assert.match(out.stdout, /self-test 3 例全绿/)
})
