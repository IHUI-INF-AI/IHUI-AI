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
  planProjectReceipts,
  projectInputDigest,
  readReceipts,
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
