// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-snapshot-backlog.mjs(goal-b49 W3 立的快照积压只读温度计)。
 * §22c 纪律:判据函数一律从源脚本的 __test__ 出口 import,本文件不复制任何判定字面量。
 * 钉住的是三件事:① 三态退出码不并桶(未判定 2 / 判出越界 1 / 判出清绿 0);
 * ② "取不到输入"绝不被折成 0 枚积压(§0.3);③ 头注不得自称已接线(门 89 R1/R2 的射程)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as ruler } from '../check-snapshot-backlog.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  UNDETERMINED_REASONS,
  BLIND_SPOT_REASONS,
  bucketOfDirName,
  observeSnapshotDir,
  undeterminedReasonsOf,
  scanSnapshotRoot,
  summarizeScan,
  verdictOf,
  exitCodeOf,
  formatReadout,
} = ruler

const NOW = Date.UTC(2026, 10, 5)
const DAY = 86_400_000
const SRC = readFileSync(fileURLToPath(new URL('../check-snapshot-backlog.mjs', import.meta.url)), 'utf-8')

const fakeOkScan = (dirs) => ({
  status: 'ok',
  root: '/fake',
  sessions: [
    {
      session: 's1',
      unreadable: false,
      dirs: dirs.map((d) => ({ session: 's1', bucket: bucketOfDirName(d.name), ...d })),
    },
  ],
})
const dirOf = (name, over = {}) => ({
  name,
  createdAtMs: NOW - DAY,
  bytes: 10,
  reasons: [],
  ...over,
})
const judge = (scan, opts = {}) => {
  const report = summarizeScan(scan, { root: '/fake', nowMs: NOW, maxDirs: null, maxAgeDays: null, ...opts })
  const verdict = verdictOf(report)
  return { report, verdict, code: exitCodeOf(report, verdict) }
}

describe('三态退出码:未判定 / 判出越界 / 判出清绿,绝不并桶', () => {
  it('判出且无判不出目录 ⇒ clear / exit 0', () => {
    const { report, verdict, code } = judge(fakeOkScan([dirOf('u@v1'), dirOf('u@v2')]))
    assert.equal(report.state, 'judged')
    assert.equal(verdict.verdict, 'clear')
    assert.equal(code, 0)
  })
  it('判不出目录 ≥1 ⇒ flagged / exit 1(可整改:补清单是人能做的动作)', () => {
    const { verdict, code } = judge(fakeOkScan([dirOf('u@v1', { reasons: ['manifest-missing'] })]))
    assert.equal(verdict.verdict, 'flagged')
    assert.equal(code, 1)
  })
  it('取不到快照根 ⇒ 未判定 / exit 2 且积压读数为 null(不拿 0 冒充"没有")', () => {
    for (const reason of ['root-missing', 'root-unreadable', 'no-sessions']) {
      const { report, verdict, code } = judge({ status: 'unavailable', reason, sessions: [] })
      assert.equal(report.state, 'undetermined', reason)
      assert.equal(report.backlog, null, reason)
      assert.equal(verdict, 'undetermined', reason)
      assert.equal(code, 2, reason)
      assert.match(formatReadout(report, verdict).join('\n'), /未判定/)
    }
  })
  it('枚举到 0 个会话目录不记绿(§0.3:0 枚 ≠ 判过)', () => {
    const { code } = judge({ status: 'unavailable', reason: 'no-sessions', sessions: [] })
    assert.equal(code, 2)
  })
})

describe('读数分列:积压 / 最老年龄 / 判不出轮次', () => {
  it('积压按字面分桶(series / legacy / other),体积只累加量得出的那些枚', () => {
    const { report } = judge(
      fakeOkScan([
        dirOf('11111111-1111-4111-8111-111111111111@v3', { bytes: 30 }),
        dirOf('cp_1700000000000_abc', { bytes: 20 }),
        dirOf('hunk_20260101', { bytes: 7 }),
        dirOf('u@v9', { bytes: null, reasons: ['size-unmeasurable'] }),
      ]),
    )
    assert.deepEqual(
      {
        total: report.backlog.total,
        series: report.backlog.series,
        legacy: report.backlog.legacy,
        other: report.backlog.other,
        measurable: report.backlog.bytesMeasurableDirs,
        bytes: report.backlog.totalBytes,
      },
      { total: 4, series: 2, legacy: 1, other: 1, measurable: 3, bytes: 57 },
    )
  })
  it('一条 createdAt 都解析不出 ⇒ 年龄读数 null,不是 0 天', () => {
    const { report } = judge(fakeOkScan([dirOf('u@v1', { createdAtMs: null })]))
    assert.equal(report.oldestAgeDays, null)
  })
  it('已删计数与不删原因各有各的档:byReason 逐因计数,不折叠成一个总数', () => {
    const { report } = judge(
      fakeOkScan([
        dirOf('u@v1', { reasons: ['manifest-missing'] }),
        dirOf('u@v2', { reasons: ['manifest-corrupt', 'size-unmeasurable'] }),
      ]),
    )
    assert.equal(report.undetermined.dirs, 2)
    assert.deepEqual(report.undetermined.byReason, {
      'manifest-missing': 1,
      'manifest-corrupt': 1,
      'size-unmeasurable': 1,
    })
  })
  it('盲区五档逐条点名(不静默吞掉,也不冒充已判)', () => {
    const { report } = judge(fakeOkScan([dirOf('u@v1')]))
    assert.deepEqual(report.blindSpots, [...BLIND_SPOT_REASONS])
    assert.equal(BLIND_SPOT_REASONS.length, 5)
    for (const r of UNDETERMINED_REASONS) assert.ok(!BLIND_SPOT_REASONS.includes(r))
  })
})

describe('显式预算才判红:温度计不替回收判据设档', () => {
  it('未给预算时,再多积压也只报数(clear)', () => {
    const many = Array.from({ length: 90 }, (_, i) => dirOf(`u@v${i + 1}`))
    assert.equal(judge(fakeOkScan(many)).verdict.verdict, 'clear')
  })
  it('给了 --max-dirs 且越界 ⇒ flagged / exit 1', () => {
    const { code } = judge(fakeOkScan([dirOf('u@v1'), dirOf('u@v2')]), { maxDirs: 1 })
    assert.equal(code, 1)
  })
  it('给了 --max-age-days 且超窗 ⇒ flagged;年龄未判定时设了预算也不判绿', () => {
    assert.equal(judge(fakeOkScan([dirOf('u@v1', { createdAtMs: NOW - 40 * DAY })]), { maxAgeDays: 30 }).code, 1)
    const noAge = judge(fakeOkScan([dirOf('u@v1', { createdAtMs: null })]), { maxAgeDays: 30 })
    assert.equal(noAge.report.oldestAgeDays, null)
    assert.equal(noAge.code, 1)
  })
})

describe('观测层:undeterminedReasonsOf 一目录不叠因、清单坏就不再加注时刻', () => {
  it('清单缺失 ⇒ 只算 manifest-missing(+ 量得出体积时不叠 size)', () => {
    assert.deepEqual(undeterminedReasonsOf({ manifest: 'missing', createdAtMs: null, bytes: 10 }), [
      'manifest-missing',
    ])
  })
  it('清单损坏 ⇒ 只算 manifest-corrupt', () => {
    assert.deepEqual(undeterminedReasonsOf({ manifest: 'corrupt', createdAtMs: null, bytes: 10 }), [
      'manifest-corrupt',
    ])
  })
  it('清单可读但 createdAt 解析不出 ⇒ manifest-unreadable(GC 侧同档名)', () => {
    assert.deepEqual(undeterminedReasonsOf({ manifest: 'unreadable', createdAtMs: null, bytes: 10 }), [
      'manifest-unreadable',
    ])
  })
  it('体积量不出 ⇒ size-unmeasurable,可与清单档同时成立', () => {
    assert.deepEqual(undeterminedReasonsOf({ manifest: 'missing', createdAtMs: null, bytes: null }), [
      'manifest-missing',
      'size-unmeasurable',
    ])
  })
  it('形状锁:头注不得自称已接线(门 89 R1/R2 射程),且必须如实写明刻意不进提交链', () => {
    const header = SRC.slice(0, 4000)
    for (const forbidden of [/集成位置/, /接入\s*pre-commit/, /pre-push/, /CI\s*必跑/, /已接线/]) {
      assert.ok(!forbidden.test(header), `头注出现接线声称:${forbidden.source}`)
    }
    assert.match(header, /刻意不进提交链/)
    assert.match(header, /没有任何调度器/)
  })
})

describe('端到端真盘夹具(mkScratch,§15b 唯一落点)', () => {
  it('造 2 枚目录(一枚清单缺失)⇒ 判出 flagged 且逐因计数、字节实测非 0', () => {
    const scratch = mkScratch('snapshot-backlog-')
    try {
      const root = join(scratch, 'checkpoints', 's1')
      const good = join(root, 'u@v1')
      const broken = join(root, 'u@v2')
      mkdirSync(good, { recursive: true })
      mkdirSync(broken, { recursive: true })
      writeFileSync(join(good, 'manifest.json'), JSON.stringify({ id: 'u@v1', createdAt: new Date(NOW - 2 * DAY).toISOString() }), 'utf-8')
      writeFileSync(join(good, 'a.txt'), 'x'.repeat(128), 'utf-8')
      const scan = scanSnapshotRoot(join(scratch, 'checkpoints'))
      assert.equal(scan.status, 'ok')
      const dirs = scan.sessions[0].dirs
      assert.equal(dirs.length, 2)
      const bad = dirs.find((d) => d.name === 'u@v2')
      assert.deepEqual(bad.reasons, ['manifest-missing'])
      const verdict = judge(scan)
      assert.equal(verdict.code, 1)
      assert.equal(verdict.report.backlog.totalBytes, 128 + new TextEncoder().encode(JSON.stringify({ id: 'u@v1', createdAt: new Date(NOW - 2 * DAY).toISOString() })).length)
      assert.equal(verdict.report.oldestAgeDays, 2)
      // 观测层直连真 fs:清单在、可解析 ⇒ 无因
      assert.deepEqual(undeterminedReasonsOf(observeSnapshotDir(good)), [])
    } finally {
      rmSync(join(scratch, 'checkpoints'), { recursive: true, force: true })
      rmScratch(scratch)
    }
  })
  it('夹具根不存在 ⇒ root-missing / exit 2(scanSnapshotRoot 直连真 fs 的阴性分支)', () => {
    const scratch = mkScratch('snapshot-backlog-missing-')
    try {
      const scan = scanSnapshotRoot(join(scratch, 'nope'))
      assert.equal(scan.status, 'unavailable')
      assert.equal(scan.reason, 'root-missing')
      assert.equal(exitCodeOf(summarizeScan(scan, { root: '/x', nowMs: NOW }), 'undetermined'), 2)
    } finally {
      rmScratch(scratch)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
