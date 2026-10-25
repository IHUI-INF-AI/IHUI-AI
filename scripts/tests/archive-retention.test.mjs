// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/archive-dir.mjs 的保留档(G-24,"双上限 + 保留最近 N 代 + 禁删名单")。
//
// 为什么是形状锁 + 行为锁两套:
//   · 判据全在 retire-git-archive.mjs(**单一真相源**),这里不复制任何阈值/正则 ——
//     只 import __test__,把"计划怎么说 / 执行器怎么做"钉住(§22c)。
//   · 删除行为一律在 mkScratch 夹具里跑;真实归档根一律只读 `--check`,**绝不**对生产面 apply。
//
// 跑法:node --test scripts/tests/archive-retention.test.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(ROOT, 'scripts', 'archive-dir.mjs')
const { __test__ } = await import('../archive-dir.mjs')
const {
  RETENTION_LEDGER_REL,
  planArchiveRetention,
  applyArchiveRetention,
  appendRetentionLedger,
} = __test__

const NOW = Date.parse('2026-01-01T00:00:00Z')
const HOUR = 3600_000
const made = []
const box = (name) => {
  const d = mkScratch(`archive-retention-${name}-`)
  made.push(d)
  return d
}
after(() => {
  for (const d of made) {
    try {
      rmScratch(d, { bestEffort: true })
    } catch {
      /* 清理失败不改写用例结论(scratch-dir 退出钩子会兜底) */
    }
  }
})

/** 纯数据条目:只给保留档需要的三样(name / mtime / bytes)。 */
function entry(name, hoursAgo, bytes = 10) {
  return { name, path: `/fixture/${name}`, mtimeMs: NOW - hoursAgo * HOUR, bytes }
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  })
}

/** 造一棵像真归档根的夹具树:目录 + 一个文件,并把 mtime 推到 1 小时前(过 1 秒稳定窗)。 */
function makeArchiveRoot(tag, names) {
  const root = box(tag)
  const old = new Date(Date.now() - HOUR)
  for (const n of names) {
    const p = join(root, n)
    mkdirSync(p, { recursive: true })
    writeFileSync(join(p, 'payload.txt'), 'x')
    utimesSync(p, old, old)
  }
  return root
}

test('①a 世代上限独立触发:12 项 keep=10 ⇒ 只删最旧 2 项,理由 gen>keep', () => {
  const entries = Array.from({ length: 12 }, (_, i) => entry(`a.stale-${i}`, 12 - i))
  const plan = planArchiveRetention(entries, { keep: 10, maxTotalBytes: 10 ** 12, now: NOW })
  assert.equal(plan.remove.length, 2)
  assert.deepEqual(
    plan.remove.map((e) => e.name).sort(),
    ['a.stale-0', 'a.stale-1'],
    '被删的必须是最旧两项(排序方向错 = 字节档一生效就毁最有用的归档)',
  )
  for (const e of plan.remove) assert.match(e.reason, /gen>keep/)
  assert.equal(plan.keep.length, 10)
})

test('①b 字节上限独立触发:3 项各 100B、cap=250B ⇒ 只删最旧 1 项,理由 bytes>cap', () => {
  const entries = [entry('b.stale-1', 3, 100), entry('b.stale-2', 2, 100), entry('b.stale-3', 1, 100)]
  const plan = planArchiveRetention(entries, { keep: 10, maxTotalBytes: 250, now: NOW })
  assert.equal(plan.remove.length, 1)
  assert.equal(plan.remove[0].name, 'b.stale-1')
  assert.match(plan.remove[0].reason, /bytes>cap/)
  assert.equal(plan.keep.length, 2)
})

test('② 保留最近 10 代(缺省值):10 新 + 5 旧 ⇒ 5 旧判删、10 新一个不动', () => {
  const entries = [
    ...Array.from({ length: 10 }, (_, i) => entry(`new.stale-${i}`, 10 - i)),
    ...Array.from({ length: 5 }, (_, i) => entry(`old.stale-${i}`, 100 + i)),
  ]
  const plan = planArchiveRetention(entries, { now: NOW })
  assert.equal(plan.limits.keepGenerations, 10, '缺省保留代数必须来自 retire 的单一真相源')
  assert.equal(plan.remove.length, 5)
  assert.deepEqual(
    plan.remove.map((e) => e.name).sort(),
    Array.from({ length: 5 }, (_, i) => `old.stale-${i}`).sort(),
  )
  for (const e of plan.keep) assert.ok(!e.name.startsWith('old.stale-'))
})

test('③ 禁删名单不回收:§5b 两类形态 + bundles/cold/broken-refs + 无签名条目,哪怕它们最旧', () => {
  const protectedNames = ['IHUI-AI-git-repo']
  const entries = [
    entry('IHUI-AI-git-repo', 500), // 活 gitdir 本体
    entry('IHUI-AI-git-repo.broken-20260101T000000', 501), // 其现场
    entry('IHUI-AI.git-backup-20260912.broken-20260101T000000', 502), // 恢复源现场
    entry('bundles', 503), // §22 lost-commit/stash 抢救 bundle
    entry('cold', 504), // 冷层自身
    entry('broken-refs', 505), // 正被 git-backup-refresh 写
    entry('notes', 506), // 无事故签名 ⇒ 射程外
    ...Array.from({ length: 15 }, (_, i) => entry(`y.stale-${i}`, 15 - i)),
  ]
  const plan = planArchiveRetention(entries, { keep: 10, maxTotalBytes: 10 ** 12, now: NOW, protectedNames })
  const removed = new Set(plan.remove.map((e) => e.name))
  for (const name of [
    'IHUI-AI-git-repo',
    'IHUI-AI-git-repo.broken-20260101T000000',
    'IHUI-AI.git-backup-20260912.broken-20260101T000000',
    'bundles',
    'cold',
    'broken-refs',
    'notes',
  ]) {
    assert.ok(!removed.has(name), `禁删名单上的 ${name} 进了候选集`)
    assert.ok(plan.reasons[name], `${name} 没有理由 —— 四桶都要报名(§0.3)`)
  }
  assert.match(plan.reasons.bundles, /禁删名单前缀/)
  assert.match(plan.reasons.cold, /冷存储层/)
  assert.match(plan.reasons['broken-refs'], /当前被引用/)
  assert.match(plan.reasons.notes, /非事故归档/)
  assert.equal(plan.remove.length, 5, '只有 15 项 y.stale-* 里的最旧 5 项可删')
})

test('④ 边界:刚好等于条数上限 / 刚好等于字节上限 ⇒ 都不删', () => {
  const exactlyKeep = Array.from({ length: 10 }, (_, i) => entry(`c.stale-${i}`, 10 - i))
  const p1 = planArchiveRetention(exactlyKeep, { now: NOW, maxTotalBytes: 10 ** 12 })
  assert.equal(p1.remove.length, 0)
  assert.equal(p1.keep.length, 10)

  const exactlyBytes = [entry('d.stale-1', 2, 100), entry('d.stale-2', 1, 100)]
  const p2 = planArchiveRetention(exactlyBytes, { now: NOW, maxTotalBytes: 200 })
  assert.equal(p2.remove.length, 0, '恰好等于上限不得判删(strict >)')
  assert.equal(p2.keep.length, 2)
})

test('保持"keep + remove 恰好覆盖且不相交":每一条都有理由,不得静默漏项', () => {
  const entries = [
    entry('e.stale-1', 1),
    entry('e.stale-2', 2),
    { name: 'e.stale-3' }, // 缺 mtime ⇒ 判不出,不删
    entry('IHUI-AI-git-repo.broken-20260101T000000', 3),
    entry('bundles', 4),
  ]
  const plan = planArchiveRetention(entries, { keep: 1, now: NOW })
  const names = entries.map((e) => e.name).sort()
  assert.deepEqual([...plan.keep.map((e) => e.name), ...plan.remove.map((e) => e.name)].sort(), names)
  const removeSet = new Set(plan.remove.map((e) => e.name))
  for (const n of plan.keep.map((e) => e.name)) assert.ok(!removeSet.has(n))
  for (const n of names) assert.ok(plan.reasons[n], `${n} 缺理由`)
  assert.match(plan.reasons['e.stale-3'], /缺 mtime/)
})

test('⑤ --apply 真删(仅夹具)后每次尝试写一行 JSONL:时刻/路径/原因/字节/来源', () => {
  const names = ['f1.stale-aaa', 'f2.stale-bbb']
  const root = makeArchiveRoot('apply', names)
  const ledger = join(box('ledger'), 'archive-retention.jsonl')
  const entries = names.map((n) => ({
    name: n,
    path: join(root, n),
    mtimeMs: Date.now() - HOUR,
    bytes: 1,
  }))
  const res = applyArchiveRetention({
    root,
    entries,
    opts: { keep: 0, maxTotalBytes: 10 ** 9, now: Date.now() },
    apply: true,
    ledgerFile: ledger,
  })
  assert.equal(res.attempted, 2)
  assert.equal(res.deleted.length, 2)
  assert.equal(res.failed.length, 0)
  for (const n of names) assert.ok(!existsSync(join(root, n)), `${n} 应已被删`)
  const recs = readFileSync(ledger, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  assert.equal(recs.length, 2)
  for (const r of recs) {
    assert.equal(r.source, 'retention')
    assert.equal(r.ok, true)
    assert.equal(r.why, null)
    assert.equal(r.bytes, 1)
    assert.match(r.reason, /gen>keep/)
    assert.ok(r.path.startsWith(root))
    assert.ok(Number.isFinite(Date.parse(r.ts)), `ts 不是可解析时刻:${r.ts}`)
  }
  assert.deepEqual(recs.map((r) => r.name).sort(), names.slice().sort())
})

test('⑥ dry-run(缺省档)不删、不写台账;apply=true 缺 ledgerFile 直接抛', () => {
  const names = ['g1.stale-aaa', 'g2.stale-bbb']
  const root = makeArchiveRoot('dry', names)
  const ledger = join(box('dry-ledger'), 'archive-retention.jsonl')
  const entries = names.map((n) => ({
    name: n,
    path: join(root, n),
    mtimeMs: Date.now() - HOUR,
    bytes: 1,
  }))
  const res = applyArchiveRetention({
    root,
    entries,
    opts: { keep: 0, now: Date.now() },
    ledgerFile: ledger,
  })
  assert.equal(res.dryRun, true)
  assert.equal(res.attempted, 0)
  assert.equal(res.plan.remove.length, 2)
  for (const n of names) assert.ok(existsSync(join(root, n)), `dry-run 删了 ${n}`)
  assert.ok(!existsSync(ledger), 'dry-run 写了台账')

  assert.throws(
    () => applyArchiveRetention({ root, entries, apply: true }),
    /ledgerFile/,
    'apply=true 不交台账必须当场抛(每次删除都要留痕)',
  )
})

test('⑦ CLI --check:只打印计划,零删除、零台账', () => {
  const names = ['h1.stale-aaa', 'h2.stale-bbb', 'h3.stale-ccc']
  const root = makeArchiveRoot('cli-check', names)
  const ledger = join(box('cli-check-ledger'), 'archive-retention.jsonl')
  const r = runCli([
    '--check',
    '--root',
    root,
    '--allow-custom-root',
    '--keep',
    '1',
    '--max-bytes',
    '999999999',
    '--ledger',
    ledger,
  ])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /dry-run/)
  assert.match(r.stdout, /将删\(候选集 2 项/)
  for (const n of names) assert.ok(existsSync(join(root, n)), `--check 删了 ${n}`)
  assert.ok(!existsSync(ledger), '--check 写了台账')
})

test('⑧ CLI --apply:先打印候选集再删(仅夹具),台账逐行落盘', () => {
  const names = ['i1.stale-aaa', 'i2.stale-bbb', 'i3.stale-ccc']
  const root = makeArchiveRoot('cli-apply', names)
  const ledger = join(box('cli-apply-ledger'), 'archive-retention.jsonl')
  const r = runCli([
    '--apply',
    '--root',
    root,
    '--allow-custom-root',
    '--keep',
    '1',
    '--max-bytes',
    '999999999',
    '--ledger',
    ledger,
  ])
  assert.equal(r.status, 0, r.stderr)
  const planAt = r.stdout.indexOf('将删(候选集 2 项')
  const applyAt = r.stdout.indexOf('[apply] 按上表开始删除')
  assert.ok(planAt >= 0 && applyAt > planAt, '候选集必须在动手之前打印')
  const left = names.filter((n) => existsSync(join(root, n)))
  assert.equal(left.length, 1, `应只剩 1 项,实得:${left.join(',')}`)
  const recs = readFileSync(ledger, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  assert.equal(recs.length, 2)
  for (const rec of recs) assert.equal(rec.source, 'retention')
})

test('⑨ 越界与互斥:换根未声明 / --check+--apply / 保留档接非 git 族 ⇒ 全部 exit 2', () => {
  const names = ['j1.stale-aaa', 'j2.stale-bbb']
  const root = makeArchiveRoot('guard', names)
  const noAllow = runCli(['--apply', '--root', root, '--keep', '0', '--ledger', join(box('g1'), 'x.jsonl')])
  assert.equal(noAllow.status, 2)
  assert.match(noAllow.stderr, /越界|allow-custom-root/)
  for (const n of names) assert.ok(existsSync(join(root, n)), '越界档不得删任何东西')

  const both = runCli(['--check', '--apply', '--root', root, '--allow-custom-root'])
  assert.equal(both.status, 2)
  assert.match(both.stderr, /互斥/)

  const otherKind = runCli(['--check', '--kind', 'sql'])
  assert.equal(otherKind.status, 2)
  assert.match(otherKind.stderr, /kind=git/)
})

test('⑩ 参数与档位非法一律 exit 2(不得静默回落默认值)', () => {
  const cases = [
    [['--check', '--keep', 'abc'], /保留代数|档位非法/],
    [['--check', '--max-bytes', '0'], /档位非法/],
    [['--check', '--root'], /--root 需要一个归档根目录/],
    [['--root', 'x'], /只在 --check \/ --apply/],
  ]
  for (const [args, re] of cases) {
    const r = runCli(args)
    assert.equal(r.status, 2, `${JSON.stringify(args)} 应 exit 2,实得 ${r.status}:${r.stderr}`)
    assert.match(`${r.stdout}${r.stderr}`, re)
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /ERR_INVALID_ARG_TYPE|at ModuleJob/, '不得以裸栈当用法错出口')
  }
})

test('台账路径唯一:RETENTION_LEDGER_REL 指向 .ihui-agent/state 下的 JSONL', () => {
  assert.equal(RETENTION_LEDGER_REL, '.ihui-agent/state/archive-retention.jsonl')
  const file = join(box('ledger-path'), 'a.jsonl')
  const w = appendRetentionLedger(file, { ts: new Date(NOW).toISOString(), source: 'retention' })
  assert.equal(w.ok, true)
  assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
