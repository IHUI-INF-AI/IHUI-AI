// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/archive-gc.mjs(G-24「双上限 + 最近 10 代」)
 *
 * 判据不复制:全部经源文件导出的 `__test__` 取,夹具走 `mkScratch`(§26:不落仓库树、
 * 不落可能钉在 C 盘的 os.tmpdir),绝不碰真实 `.ihui-agent/archive`。
 *
 * 覆盖格(与交付票一一对应):
 *   a) 超总数上限 ⇒ 删最老,近 10 代原样留下;
 *   b) 超单件体积上限 ⇒ 单件独立出口判删;落在近 10 代内的超限件受保护优先;
 *   c) 近 10 代保护优先于总数上限 ⇒ 上限达不到也硬删;
 *   d) 未判定(判不出世代)⇒ 保留 + 点名,末行读数含"未判定",退出码 2;
 *   e) 默认 dry-run 不删 / `--apply` 真删,且 deleted 双日志留痕;
 *   f) 两轴独立但总数轴不重复计已判删件(不得过删到 maxFiles 以下);
 *   g) 射程必须由调用方 `--root` 指定;人读面打印本次射程 × 该目录已有器物。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../archive-gc.mjs')
const { __test__ } = await import(pathToFileURL(SRC).href)
const {
  DEFAULT_MAX_ITEM_BYTES,
  MIN_AGE_MS,
  STD_GIT_ARCHIVE,
  parseGeneration,
  isInsideRoot,
  isInsideStateDir,
  scopeNote,
  assertSafeRoot,
  classifyEntry,
  listEntries,
  planGc,
  removeEntry,
  applyPlan,
  makeLedger,
  runMain,
} = __test__

const made = []
const boxed = (tag) => {
  const d = mkScratch(`archive-gc-${tag}-`)
  made.push(d)
  return d
}
after(() => {
  for (const d of made) {
    try {
      rmScratch(d)
    } catch {
      /* 残留由 §26 每日 Temp 体检兜;不得为此改写判据 */
    }
  }
})

const BIG = DEFAULT_MAX_ITEM_BYTES * 10
const mkArch = (box) => {
  const arch = join(box, 'archive')
  mkdirSync(arch, { recursive: true })
  return arch
}
/** 造一件归档文件;mtime 回拨到稳定窗之外(否则会被"正在写"保护掉)。 */
const put = (arch, name, bytes = 32, daysAgo = 2) => {
  const p = join(arch, name)
  writeFileSync(p, Buffer.alloc(bytes, 0x61))
  const ts = new Date(Date.now() - Math.max(daysAgo, 2) * 86400000)
  utimesSync(p, ts, ts)
  return p
}
const planOf = (arch, opts = {}) => {
  const now = Date.now()
  const entries = listEntries(arch).map((name) => classifyEntry({ root: arch, name, now }))
  return planGc({ entries, ...opts })
}

test('T0 世代解析:取文件名最后一个日期,同日 a/b/c 为第 1/2/3 代', () => {
  assert.deepEqual(parseGeneration('AGENTS_trim-2026-10-23c.md'), {
    day: '2026-10-23',
    ordinal: 3,
    key: '2026-10-23#03',
  })
  assert.equal(parseGeneration('AGENTS_trim-2026-10-23.md').ordinal, 0)
  assert.equal(parseGeneration('plan-pointer-purge-2026-10-14-5.md').key, '2026-10-14#00')
  assert.equal(parseGeneration('.lintstagedrc.json'), null, '无日期必须判不出,不得猜')
})

test('T1 超总数上限:删最老 5 件,近 10 代 10 件原样保留', () => {
  const box = boxed('t1')
  const arch = mkArch(box)
  const names = []
  for (let i = 1; i <= 15; i++) {
    const n = `snap-2026-09-${String(i).padStart(2, '0')}.md`
    names.push(n)
    put(arch, n)
  }
  const plan = planOf(arch, { keepGenerations: 10, maxFiles: 5, maxItemBytes: BIG })
  assert.equal(plan.totalFiles, 15)
  assert.equal(plan.retire.length, 5, `应只删最老 5 件,实为 ${plan.retire.length}`)
  assert.deepEqual(
    plan.retire.map((e) => e.name).sort(),
    names.slice(0, 5).sort(),
    '删的必须是最老 5 代',
  )
  assert.ok(plan.retire.every((e) => e.criterion === 'count'), '理由出口应为 count>max')
  assert.ok(plan.retire.every((e) => /count>max/.test(e.reason)))
  assert.equal(plan.keep.length, 10, '最新 10 代必须全部在位')
  for (const n of names.slice(5)) assert.ok(existsSync(join(arch, n)), `${n} 不得被删`)
  assert.equal(
    plan.capUnmet,
    true,
    '15 件要降到 5 件需删 10,但可删集只有保护窗外的 5 件 ⇒ 必须报"上限未达",不得越窗硬删',
  )
})

test('T2 超单件体积上限独立判删;近 10 代内的超限件受保护优先', () => {
  const box = boxed('t2')
  const arch = mkArch(box)
  for (let i = 1; i <= 12; i++) put(arch, `snap-2026-09-${String(i).padStart(2, '0')}.md`)
  put(arch, 'big-2026-09-01.md', 2048)
  put(arch, 'big-2026-09-12.md', 2048)

  const plan = planOf(arch, { keepGenerations: 10, maxFiles: 1000, maxItemBytes: 1024 })
  assert.equal(plan.retire.length, 1, `应只删最老的超限件,实为 ${plan.retire.length}`)
  assert.equal(plan.retire[0].name, 'big-2026-09-01.md')
  assert.equal(plan.retire[0].criterion, 'itemBytes')
  assert.match(plan.retire[0].reason, /itemBytes>max/)
  const keptBig = plan.keep.find((e) => e.name === 'big-2026-09-12.md')
  assert.ok(keptBig, '近 10 代内的超限件必须落在保留档')
  assert.match(keptBig.reason, /gen<=keep/, '保护优先的理由必须写明')

  const loose = planOf(arch, { keepGenerations: 10, maxFiles: 1000, maxItemBytes: BIG })
  assert.equal(loose.retire.length, 0, '放宽单件上限后仍判删 ⇒ 该档没有独立牙口')
})

test('T3 近 10 代保护优先于总数上限:上限达不到也不硬删', () => {
  const box = boxed('t3')
  const arch = mkArch(box)
  const names = []
  for (let i = 1; i <= 12; i++) {
    const n = `snap-2026-09-${String(i).padStart(2, '0')}.md`
    names.push(n)
    put(arch, n)
  }
  const plan = planOf(arch, { keepGenerations: 10, maxFiles: 5, maxItemBytes: BIG })
  assert.equal(plan.retire.length, 2, `只应删保护窗之外的 2 件,实为 ${plan.retire.length}`)
  assert.deepEqual(plan.retire.map((e) => e.name).sort(), names.slice(0, 2).sort())
  assert.ok(plan.retire.every((e) => e.rank >= 10), '保护窗内的件绝不得进删除档')
  assert.equal(plan.capUnmet, true, '10 件保护地板 > 5 件总数上限 ⇒ 必须报"上限未达"')
  assert.equal(plan.keep.length, 10)
})

test('T4 判不出世代的件保留并报名(未判定计数 + 退出码 2)', () => {
  const box = boxed('t4')
  const arch = mkArch(box)
  for (let i = 1; i <= 10; i++) put(arch, `snap-2026-08-${String(i).padStart(2, '0')}.md`)
  put(arch, 'old-2026-07-01.md')
  put(arch, 'no-date.md')
  writeFileSync(join(arch, 'PROJECT_PLAN_ARCHIVE.md'), 'in use\n')
  mkdirSync(join(arch, 'subdir'), { recursive: true })

  const plan = planOf(arch, { keepGenerations: 10, maxFiles: 1, maxItemBytes: BIG })
  assert.deepEqual(plan.undetermined.map((e) => e.name), ['no-date.md'])
  assert.ok(plan.undetermined.every((e) => e.decision === null), '未判定不得被赋判删')
  assert.ok(!plan.retire.some((e) => e.name === 'no-date.md'), '未判定件绝不能进删除档')
  assert.ok(
    plan.protected.some((e) => e.name === 'PROJECT_PLAN_ARCHIVE.md'),
    '正在被引用的归档件必须进保护档',
  )
  assert.ok(plan.protected.some((e) => e.name === 'subdir'), '目录必须进保护档')
  assert.deepEqual(plan.retire.map((e) => e.name), ['old-2026-07-01.md'])

  const out = []
  const code = runMain({
    argv: [
      '--root',
      arch,
      '--keep',
      '10',
      '--max-files',
      '1',
      '--max-item-bytes',
      String(BIG),
      '--dry-run',
    ],
    stdout: (l) => out.push(l),
    stderr: () => {},
  })
  assert.equal(code, 2, '存在未判定件 ⇒ 退出码 2(不记绿)')
  assert.ok(
    out.some((l) => /^未判定 1 件.*no-date\.md/.test(l)),
    `未判定必须点名,不得悄悄当保留:${out.join(' | ')}`,
  )
  assert.match(out.at(-1), /^保留 \d+ \/ 待删 1 \/ 未判定 1$/, `末行读数不对:${out.at(-1)}`)
})

test('T5 默认 dry-run 零删除;--apply 真删且 deleted 双日志留痕', () => {
  const box = boxed('t5')
  const arch = mkArch(box)
  const names = []
  for (let i = 1; i <= 12; i++) {
    const n = `snap-2026-09-${String(i).padStart(2, '0')}.md`
    names.push(n)
    put(arch, n)
  }
  const ledgerDir = join(box, 'ledger')
  const argv = [
    '--root',
    arch,
    '--keep',
    '5',
    '--max-files',
    '2',
    '--max-item-bytes',
    String(BIG),
    '--ledger-dir',
    ledgerDir,
  ]

  const dry = []
  const dryCode = runMain({ argv, stdout: (l) => dry.push(l), stderr: () => {} })
  assert.equal(dryCode, 0)
  assert.equal(names.filter((n) => existsSync(join(arch, n))).length, 12, 'dry-run 必须零删除')
  assert.ok(dry.some((l) => l.includes('[dry-run]')), 'dry-run 档必须自报')
  assert.match(dry.at(-1), /^保留 \d+ \/ 待删 7 \/ 未判定 0$/, `末行读数不对:${dry.at(-1)}`)
  assert.ok(!existsSync(join(ledgerDir, 'archive-gc-deleted.jsonl')), 'dry-run 不得写删除日志')

  const app = []
  const appCode = runMain({
    argv: [...argv, '--apply'],
    stdout: (l) => app.push(l),
    stderr: () => {},
  })
  assert.equal(appCode, 0)
  assert.ok(app.some((l) => l.includes('[apply]')), 'apply 档必须自报')
  assert.equal(names.filter((n) => existsSync(join(arch, n))).length, 5, '只应剩近 5 代')
  const log = readFileSync(join(ledgerDir, 'archive-gc-deleted.jsonl'), 'utf8')
    .trim()
    .split('\n')
  assert.equal(log.length, 7, `deleted 日志应有 7 行,实为 ${log.length}`)
  assert.ok(log.every((l) => JSON.parse(l).op === 'deleted'))

  const again = []
  const againCode = runMain({ argv: [...argv, '--apply'], stdout: (l) => again.push(l), stderr: () => {} })
  assert.equal(againCode, 0)
  assert.equal(names.filter((n) => existsSync(join(arch, n))).length, 5, '第二遍不得再删保护件')
  assert.match(again.at(-1), /^保留 5 \/ 待删 0 \/ 未判定 0$/)
})

test('T6 删除出口复验:保护件/目录/重解析点/state 路径全部拒删', () => {
  const box = boxed('t6')
  const arch = mkArch(box)
  const f = put(arch, 'snap-2026-09-01.md')
  assert.equal(removeEntry({ root: arch, name: 'snap-2026-09-01.md' }).ok, true)
  assert.ok(!existsSync(f), '正常归档件应删成')
  mkdirSync(join(arch, 'dir'), { recursive: true })
  const r = removeEntry({ root: arch, name: 'dir' })
  assert.equal(r.ok, false)
  assert.match(r.why, /非普通文件/)
  assert.equal(removeEntry({ root: arch, name: '../state/x' }).ok, false, '越界路径必须拒删')
  assert.equal(
    removeEntry({ root: arch, name: 'x', path: resolve(arch, '..', 'state', 'y') }).ok,
    false,
    'state 路径必须拒删',
  )
  assert.equal(isInsideRoot(arch, join(arch, 'a')), true)
  assert.equal(isInsideStateDir(join(arch, '..', 'state', 'y')), false, '夹具根不在真实 state 内')
  assert.equal(MIN_AGE_MS, 1000, '稳定窗是票面值,不得悄悄改掉')
})

test('T7 applyPlan 一条失败不得静默:failed 走独立日志', () => {
  const box = boxed('t7')
  const arch = mkArch(box)
  put(arch, 'snap-2026-09-01.md')
  const now = Date.now()
  const entries = listEntries(arch).map((name) => classifyEntry({ root: arch, name, now }))
  const plan = planGc({ entries, keepGenerations: 0, maxFiles: 0, maxItemBytes: BIG })
  const ledger = makeLedger(join(box, 'ledger'))
  const calls = []
  const res = applyPlan({
    root: arch,
    plan,
    ledger,
    now,
    remove: ({ path }) => {
      calls.push(path)
      return { ok: false, why: '注入失败' }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(res.failed.length, 1)
  const failLog = readFileSync(join(box, 'ledger', 'archive-gc-failed.jsonl'), 'utf8').trim()
  assert.equal(JSON.parse(failLog).error, '注入失败')
  assert.equal(JSON.parse(failLog).op, 'failed')
})

test('T8 根准入:state 目录与其子目录一律拒跑', () => {
  const arch = mkArch(boxed('t8'))
  assert.equal(assertSafeRoot(arch).ok, true)
  const st = __test__.STATE_DIR
  assert.equal(assertSafeRoot(st).ok, false)
  assert.equal(assertSafeRoot(join(st, 'sub')).ok, false)
})

test('T9 射程必须由调用方 --root 指定;人读面打印本次射程 × 该目录已有器物', () => {
  const out = []
  const err = []
  const code = runMain({
    argv: ['--dry-run'],
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
  })
  assert.equal(code, 2, '未给射程 ⇒ 不得默认某条硬编码路径,也不记通过')
  assert.ok(
    err.some((l) => /未指定射程/.test(l) && /--root/.test(l)),
    `缺射程必须点名 --root:${err.join(' | ')}`,
  )
  assert.equal(out.length, 0, '缺射程不得输出任何读数')

  const arch = mkArch(boxed('t9'))
  const out2 = []
  const code2 = runMain({
    argv: ['--root', arch, '--dry-run'],
    stdout: (l) => out2.push(l),
    stderr: () => {},
  })
  assert.equal(code2, 0)
  assert.ok(out2.some((l) => l.startsWith('本次射程:')), '必须打印本次射程')
  const note = out2.find((l) => l.startsWith('射程说明:'))
  assert.ok(note && /不是票面点名的 gitArchiveDir/.test(note), `非票面射程必须写明:${note}`)

  if (STD_GIT_ARCHIVE) {
    assert.match(
      scopeNote(STD_GIT_ARCHIVE),
      /gitArchiveDir.*retire-git-archive/,
      '票面射程必须点名已有器物 retire-git-archive 已覆盖',
    )
  }
})

test('T10 两轴独立但总数轴不重复计已判删件:不得过删到 maxFiles 以下', () => {
  const box = boxed('t10')
  const arch = mkArch(box)
  for (let i = 1; i <= 10; i++) put(arch, `snap-2026-09-${String(i).padStart(2, '0')}.md`)
  put(arch, 'big-a-2026-09-01.md', 2048)
  put(arch, 'big-b-2026-09-02.md', 2048)

  const plan = planOf(arch, { keepGenerations: 0, maxFiles: 5, maxItemBytes: 1024 })
  assert.equal(plan.totalFiles, 12)
  assert.equal(plan.itemBytesRetired, 2, '体积轴应独立判删 2 件')
  assert.equal(
    plan.retire.length,
    7,
    `体积轴 2 件 + 总数轴 5 件 = 7;若重复计已判删件会过删到 9,实为 ${plan.retire.length}`,
  )
  assert.equal(plan.keep.length, 5, '最终保留数必须正好等于 maxFiles')
  assert.equal(plan.capUnmet, false, '两轴合计已够回落,不得误报上限未达')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
