// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 逐包类型结论回执的判据锁(2026-11-20 立)。
 *
 * 守的是"跳过"这件事的**边界**,不是"跳过得快不快":
 *   ① 自己的 blob 变 ⇒ 摘要必变(输入变了就得重跑);
 *   ② 依赖包 blob 变 ⇒ 摘要必变(依赖的 .d.ts 由源码派生);
 *   ③ 自己的 .ts 脏 ⇒ 不跳过(摘要是 HEAD 面,工作树脏了就不能复用);
 *   ④ 自己的 README/css 脏 ⇒ 仍可跳过(不进 program,不改变结论);
 *   ⑤ 超 TTL ⇒ 不跳过;
 *   ⑥ 取不到 HEAD 面 / 取不到脏面 ⇒ 整层不跳过并点名原因(fail-closed)。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  legInputDigest,
  planLegReceipt,
  planProjectReceipts,
  projectInputDigest,
  readReceipts,
  writeLegReceipts,
  writeReceipts,
} from '../lib/typecheck-project-receipt.mjs'

const ENV = { node: 'v-test', ts: '5.0.0', base: 'baseblob' }

function mkProject(root, rel) {
  const dir = join(root, rel)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@t/${rel}`, scripts: { typecheck: 'tsc --noEmit' } }))
  return { name: `@t/${rel}`, dir, command: `pnpm --filter @t/${rel} run typecheck` }
}

test('① 自己的 blob 变 ⇒ 摘要必变', () => {
  const root = 'G:/t'
  const project = { name: '@t/x', dir: join(root, 'apps/x'), command: 'c' }
  const a = projectInputDigest({
    root,
    project,
    blobs: new Map([['apps/x/src/a.ts', 'b1']]),
    envNode: ENV,
  })
  const b = projectInputDigest({
    root,
    project,
    blobs: new Map([['apps/x/src/a.ts', 'b2']]),
    envNode: ENV,
  })
  assert.notEqual(a, b)
})

test('② 依赖包 blob 变 ⇒ 摘要必变;依赖包与自身无关的改动不影响摘要', () => {
  const root = 'G:/t'
  const project = { name: '@t/x', dir: join(root, 'apps/x'), command: 'c' }
  const blobsA = new Map([
    ['apps/x/src/a.ts', 'b1'],
    ['packages/dep/src/d.ts', 'd1'],
    ['packages/other/src/o.ts', 'o1'],
  ])
  const blobsB = new Map([
    ['apps/x/src/a.ts', 'b1'],
    ['packages/dep/src/d.ts', 'd2'],
    ['packages/other/src/o.ts', 'o1'],
  ])
  const blobsC = new Map([
    ['apps/x/src/a.ts', 'b1'],
    ['packages/dep/src/d.ts', 'd1'],
    ['packages/other/src/o.ts', 'o9'],
  ])
  const base = projectInputDigest({ root, project, blobs: blobsA, depDirs: ['packages/dep'], envNode: ENV })
  const depChanged = projectInputDigest({ root, project, blobs: blobsB, depDirs: ['packages/dep'], envNode: ENV })
  const otherChanged = projectInputDigest({ root, project, blobs: blobsC, depDirs: ['packages/dep'], envNode: ENV })
  assert.notEqual(base, depChanged, '依赖包变了必须重跑')
  assert.equal(base, otherChanged, '与本项目无关的包变了不该作废本项目')
})

test('③④ 脏面:自己的 .ts 脏 ⇒ 重跑;只有 README/css 脏 ⇒ 仍跳过', () => {
  const root = 'G:/t/fixture-3'
  rmSync(root, { recursive: true, force: true })
  const project = mkProject(root, 'apps/x')
  const blobs = new Map([['apps/x/src/a.ts', 'b1']])
  const digest = projectInputDigest({ root, project, blobs, envNode: ENV })
  const receipts = new Map([['@t/apps/x', { digest, at: Date.now(), ms: 1000 }]])
  const base = { root, projects: [project], depDirsOf: () => [], blobs, envNode: ENV, receipts }

  const clean = planProjectReceipts({ ...base, dirty: new Set([]) })
  assert.equal(clean.skip.length, 1, '干净面应当命中')
  assert.equal(clean.blocked, null)

  const tsDirty = planProjectReceipts({ ...base, dirty: new Set(['apps/x/src/a.ts']) })
  assert.equal(tsDirty.skip.length, 0, '.ts 脏 ⇒ 必须重跑')
  assert.equal(tsDirty.run.length, 1)

  const docDirty = planProjectReceipts({
    ...base,
    dirty: new Set(['apps/x/README.md', 'apps/x/styles.css', 'apps/x/src/i18n.json']),
  })
  assert.equal(docDirty.skip.length, 1, '非 TS 资产脏不该作废结论')

  const pkgDirty = planProjectReceipts({ ...base, dirty: new Set(['apps/x/package.json']) })
  assert.equal(pkgDirty.skip.length, 0, 'package.json 是 program 边界 ⇒ 重跑')
  rmSync(root, { recursive: true, force: true })
})

test('⑤ 超 TTL ⇒ 重跑', () => {
  const root = 'G:/t/fixture-5'
  rmSync(root, { recursive: true, force: true })
  const project = mkProject(root, 'apps/y')
  const blobs = new Map([['apps/y/src/a.ts', 'b1']])
  const digest = projectInputDigest({ root, project, blobs, envNode: ENV })
  const receipts = new Map([['@t/apps/y', { digest, at: Date.now() - 8 * 24 * 3600 * 1000, ms: 1 }]])
  const plan = planProjectReceipts({
    root,
    projects: [project],
    depDirsOf: () => [],
    blobs,
    dirty: new Set(),
    receipts,
    envNode: ENV,
    ttlMs: 7 * 24 * 3600 * 1000,
  })
  assert.equal(plan.skip.length, 0)
  rmSync(root, { recursive: true, force: true })
})

test('⑥ 取不到 HEAD 面 / 脏面 ⇒ 整层不跳过并点名', () => {
  const p = mkProject(mkdtempSync(join(tmpdir(), 'tcr-')), 'apps/z')
  const a = planProjectReceipts({ root: 'G:/t', projects: [p], blobs: null, dirty: new Set(), receipts: new Map(), envNode: ENV })
  assert.equal(a.skip.length, 0)
  assert.match(String(a.blocked), /HEAD 面/)
  const b = planProjectReceipts({ root: 'G:/t', projects: [p], blobs: new Map(), dirty: null, receipts: new Map(), envNode: ENV })
  assert.equal(b.skip.length, 0)
  assert.match(String(b.blocked), /脏面/)
})

test('⑦ 回执落盘/读回:结构坏 ⇒ 空表(不抛)', () => {
  const root = mkdtempSync(join(tmpdir(), 'tcr-'))
  const ok = writeReceipts(root, [
    ['@t/a', { digest: 'd1', ms: 12 }],
    ['@t/b', { digest: 'd2', ms: null }],
  ])
  assert.equal(ok, true)
  const back = readReceipts(root)
  assert.equal(back.ok, true)
  assert.equal(back.map.get('@t/a').digest, 'd1')
  writeFileSync(join(root, '.ihui-agent/state/typecheck-project-receipts.json'), '{oops')
  const broken = readReceipts(root)
  assert.equal(broken.ok, false)
  assert.equal(broken.map.size, 0)
  rmSync(root, { recursive: true, force: true })
})

// ─── 非包腿(e2e / mypy)回执的判据锁(2026-11-21) ────────────────────────────
const LEG_ENV = { node: 'v-test', mypy: '1.13.0', py: 'Python 3.12.4' }

test('⑧ 腿摘要:.py 改 ⇒ 变;无关目录改 ⇒ 不变;exact 文件缺失与出现不同(absent≠有 blob)', () => {
  const base = new Map([
    ['apps/ai-service/app/a.py', 'p1'],
    ['apps/ai-service/app/b.pyi', 'p2'],
    ['apps/web/e2e/x.spec.ts', 'e1'],
    ['apps/ai-service/pyproject.toml', 'cfg1'],
  ])
  const run = (blobs) =>
    legInputDigest({
      leg: 'mypy',
      blobs,
      dirs: ['apps/ai-service/app'],
      exactFiles: ['apps/ai-service/pyproject.toml'],
      exts: ['.py', '.pyi'],
      command: 'mypy app/',
      envNode: LEG_ENV,
    })
  const a = run(base)
  const pyChanged = new Map(base)
  pyChanged.set('apps/ai-service/app/a.py', 'p9')
  assert.notEqual(a, run(pyChanged), '.py 改了必须重跑')

  const pyiChanged = new Map(base)
  pyiChanged.set('apps/ai-service/app/b.pyi', 'p9')
  assert.notEqual(a, run(pyiChanged), '.pyi 改了必须重跑')

  const unrelated = new Map(base)
  unrelated.set('apps/web/e2e/x.spec.ts', 'e9')
  assert.equal(a, run(unrelated), '无关目录的改动不该作废本腿')

  const cfgChanged = new Map(base)
  cfgChanged.set('apps/ai-service/pyproject.toml', 'cfg2')
  assert.notEqual(a, run(cfgChanged), 'pyproject.toml 改了必须重跑')

  const cfgGone = new Map(base)
  cfgGone.delete('apps/ai-service/pyproject.toml')
  assert.notEqual(a, run(cfgGone), '精确钉的文件消失 ⇒ 摘要必变(不能当成"没变化")')
})

test('⑨ 腿摘要:扩展名过滤生效(非 .py 的新增不算进 mypy 输入)', () => {
  const base = new Map([['apps/ai-service/app/a.py', 'p1']])
  const withReadme = new Map(base)
  withReadme.set('apps/ai-service/app/README.md', 'r1')
  const digest = (blobs) =>
    legInputDigest({
      leg: 'mypy',
      blobs,
      dirs: ['apps/ai-service/app'],
      exactFiles: [],
      exts: ['.py', '.pyi'],
      command: 'mypy app/',
      envNode: LEG_ENV,
    })
  assert.equal(digest(base), digest(withReadme), 'README 不进 mypy 输入面')
})

test('⑩ 腿跳过决策:命中/脏面/TTL/取不到面 四态', () => {
  const digest = 'd1'
  const receipts = new Map([['mypy', { digest, at: Date.now(), ms: 9 }]])
  const ok = planLegReceipt({
    leg: 'mypy',
    blobs: new Map(),
    dirty: new Set(),
    receipts,
    digest,
  })
  assert.equal(ok.skip, true, '干净面 + 摘要一致 ⇒ 跳过')

  const dirtyHit = planLegReceipt({
    leg: 'mypy',
    blobs: new Map(),
    dirty: new Set(['apps/ai-service/app/a.py']),
    receipts,
    digest,
  })
  assert.equal(dirtyHit.skip, false, '相关 .py 脏 ⇒ 重跑')
  assert.match(dirtyHit.why, /脏面/)

  const dirtyIrrelevant = planLegReceipt({
    leg: 'mypy',
    blobs: new Map(),
    dirty: new Set(['apps/ai-service/app/README.md']),
    receipts,
    digest,
    dirtyRelevant: (p) => /\.pyi?$/i.test(p),
  })
  assert.equal(dirtyIrrelevant.skip, true, '非 .py 脏面不作废(判据按 dirtyRelevant 收窄)')

  const stale = planLegReceipt({
    leg: 'mypy',
    blobs: new Map(),
    dirty: new Set(),
    receipts: new Map([['mypy', { digest, at: Date.now() - 8 * 24 * 3600 * 1000, ms: 9 }]]),
    digest,
    ttlMs: 7 * 24 * 3600 * 1000,
  })
  assert.equal(stale.skip, false, '超 TTL ⇒ 重跑')
  assert.match(stale.why, /TTL/)

  const noFace = planLegReceipt({ leg: 'mypy', blobs: null, dirty: new Set(), receipts, digest })
  assert.equal(noFace.skip, false, 'HEAD 面取不到 ⇒ 不跳过(fail-closed)')
  assert.match(noFace.why, /HEAD 面/)

  const noDigest = planLegReceipt({ leg: 'mypy', blobs: new Map(), dirty: new Set(), receipts, digest: null })
  assert.equal(noDigest.skip, false, '摘要算不出 ⇒ 不跳过')
})

test('⑪ 包级与腿级回执共用一份文件且互不吞掉(写一类保留另一类)', () => {
  const root = mkdtempSync(join(tmpdir(), 'tcr-'))
  writeReceipts(root, [['@t/a', { digest: 'd1', ms: 3 }]])
  writeLegReceipts(root, [['mypy', { digest: 'L1', ms: 7 }]])
  const back = readReceipts(root)
  assert.equal(back.map.get('@t/a')?.digest, 'd1', '写腿级不该抹掉包级')
  assert.equal(back.legs.get('mypy')?.digest, 'L1')
  writeReceipts(root, [['@t/b', { digest: 'd2', ms: 4 }]])
  const back2 = readReceipts(root)
  assert.equal(back2.legs.get('mypy')?.digest, 'L1', '写包级不该抹掉腿级')
  assert.equal(back2.map.get('@t/b')?.digest, 'd2')
  rmSync(root, { recursive: true, force: true })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
