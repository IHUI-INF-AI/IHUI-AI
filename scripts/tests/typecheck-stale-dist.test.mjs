// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 陈旧 dist 判据夹具(2026-11-07,T1 假红根因)。
 *
 * 四条必测构造面:
 *   A. 整包最新 mtime 被一个"新产物"拉新,但另一份单产物仍落后于它自己的源码 ⇒ 必须判陈旧;
 *      同一份构造喂**旧实现**(判据逐字快照)必须返回"不陈旧" —— 这就是旧门两次假红的自证。
 *   B. 单产物已最新 ⇒ 不判陈旧、不调用 build。
 *   C. rc=0 但目标产物 mtime/内容都没变 ⇒ 未判定 exit 2(不许静音)。
 *   D. 逐包名 + 逐包 rc 必须出现在日志里(失败日志能指认到包)。
 *
 * 运行:node --test scripts/tests/typecheck-stale-dist.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  collectPackageStates,
  pickStalePackages,
  legacyPickStalePackages,
  rebuildStalePackages,
  formatRebuildSummary,
} from '../lib/stale-dist.mjs'

function writeAt(abs, content, mtimeIso) {
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  const d = new Date(mtimeIso)
  utimesSync(abs, d, d)
}

/** 在临时根下造一个 packages/<dir> 包:src + dist + package.json。 */
function makePackage(root, pkgDirName, manifestName, files) {
  const dir = join(root, 'packages', pkgDirName)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: manifestName, scripts: { build: 'node -e ""' } }),
  )
  for (const [rel, spec] of Object.entries(files)) {
    writeAt(join(dir, rel), spec.content ?? rel, spec.mtime)
  }
  return dir
}

function newRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-stale-dist-'))
}

test('A. 新文件拉高整包 mtime 但单产物陈旧 ⇒ 判陈旧;旧实现必须漏判(自证翻红)', () => {
  const root = newRoot()
  try {
    makePackage(root, 'types', '@fixture/types', {
      'src/index.ts': { mtime: '2026-11-06T21:00:00Z' },
      // 这份源码改过,晚于它自己的产物
      'src/notification.ts': { mtime: '2026-11-07T02:00:00Z' },
      // 病态产物:停在 11-06 21:48,内容缺失 NotificationListFilters
      'dist/notification.d.ts': {
        content: 'export type Notification = string\n',
        mtime: '2026-11-06T21:48:00Z',
      },
      // 另一个产物今天刚重建 —— 把整包最新 mtime 拉到 11-07 03:00
      'dist/index.d.ts': { mtime: '2026-11-07T03:00:00Z' },
      // 真实 tsc 产物是 js + d.ts 成对;补齐 js,避免把"应有产物缺失"混进本用例
      'dist/index.js': { mtime: '2026-11-07T03:00:00Z' },
      'dist/notification.js': { mtime: '2026-11-07T03:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    const st = entries.find((e) => e.name === '@fixture/types')
    assert.ok(st)

    // 构造面成立:整包最新 mtime 比源码最新还新 —— 旧判据会判 "fresh"
    assert.ok(st.distNewestMtimeMs > st.srcNewestMtimeMs)
    assert.equal(legacyPickStalePackages(entries).length, 0, '旧实现必须在这里漏判(夹具对它为红)')

    // 新判据必须抓到 notification.d.ts 这一份
    assert.equal(st.staleArtifacts.length, 1)
    assert.ok(
      !st.staleArtifacts.some((a) => a.missing),
      '本用例只测 mtime 陈旧,不得让"产物缺失"混进计数(否则断言 1 就名不副实)',
    )
    assert.equal(st.staleArtifacts[0].artifact, 'notification.d.ts')
    assert.equal(st.staleArtifacts[0].src, 'notification.ts')
    assert.deepEqual(pickStalePackages(entries), ['@fixture/types'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('B. 单产物已最新 ⇒ 不判陈旧,且不调用 build', () => {
  const root = newRoot()
  try {
    makePackage(root, 'fresh', '@fixture/fresh', {
      'src/a.ts': { mtime: '2026-11-06T00:00:00Z' },
      'dist/a.js': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-07T00:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    assert.equal(entries[0].staleArtifacts.length, 0)
    assert.deepEqual(pickStalePackages(entries), [])

    let calls = 0
    const out = rebuildStalePackages({
      entries,
      staleNames: pickStalePackages(entries),
      buildPackage: () => {
        calls++
        return { status: 0 }
      },
      log: () => {},
    })
    assert.equal(calls, 0, '不陈旧就不得触发 build')
    assert.equal(out.exitCode, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('C. build rc=0 但产物 mtime/内容都没变 ⇒ 未判定(exit 2),不静音', () => {
  const root = newRoot()
  try {
    makePackage(root, 'norewrite', '@fixture/norewrite', {
      'src/a.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-06T00:00:00Z' },
      'dist/a.js': { mtime: '2026-11-07T01:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    const logs = []
    const out = rebuildStalePackages({
      entries,
      staleNames: pickStalePackages(entries),
      // 假装构建成功,但一个字节都没动(典型的增量跳过/假构建)
      buildPackage: () => ({ status: 0 }),
      log: (s) => logs.push(String(s)),
    })
    assert.equal(out.failure, 'unverified')
    assert.equal(out.exitCode, 2)
    assert.equal(out.results[0].status, 0)
    assert.equal(out.results[0].unverified.length, 1)
    assert.equal(out.results[0].unverified[0].artifact, 'a.d.ts')
    assert.equal(out.results[0].ok, false)
    assert.match(logs.join('\n'), /未刷新 a\.d\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('C2. 真重建(mtime 前进)⇒ 复核通过,exit 0', () => {
  const root = newRoot()
  try {
    makePackage(root, 'really', '@fixture/really', {
      'src/a.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-06T00:00:00Z' },
      // 真实产物成对:补齐 a.js,本用例只构造 a.d.ts 这一份陈旧
      'dist/a.js': { mtime: '2026-11-07T00:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    const dir = entries[0].dir
    const out = rebuildStalePackages({
      entries,
      staleNames: pickStalePackages(entries),
      buildPackage: () => {
        // 模拟 tsc 重写产物(内容不变但 mtime 前进是真实增量构建的常见形态)
        const d = new Date(Date.now() + 60_000)
        utimesSync(join(dir, 'dist', 'a.d.ts'), d, d)
        return { status: 0 }
      },
      log: () => {},
    })
    assert.equal(out.exitCode, 0)
    assert.equal(out.results[0].refreshed, 1)
    assert.equal(out.results[0].postStale, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('D. 逐包名 + 逐包 rc 必须打印(build 失败也要能指认包)', () => {
  const root = newRoot()
  try {
    makePackage(root, 'aa', '@fixture/aa', {
      'src/a.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-06T00:00:00Z' },
      'dist/a.js': { mtime: '2026-11-07T00:00:00Z' },
    })
    makePackage(root, 'bb', '@fixture/bb', {
      'src/b.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/b.d.ts': { mtime: '2026-11-06T00:00:00Z' },
      'dist/b.js': { mtime: '2026-11-07T00:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    const logs = []
    const out = rebuildStalePackages({
      entries,
      staleNames: pickStalePackages(entries),
      // 第一个包成功(且真刷新),第二个包 build 失败
      buildPackage: (n) => {
        if (n === '@fixture/aa') {
          const d = new Date(Date.now() + 60_000)
          utimesSync(join(root, 'packages', 'aa', 'dist', 'a.d.ts'), d, d)
          return { status: 0 }
        }
        return { status: 1 }
      },
      log: (s) => logs.push(String(s)),
    })
    const text = logs.join('\n')
    assert.match(text, /重建 @fixture\/aa: rc=0/)
    assert.match(text, /重建 @fixture\/bb: rc=1/)
    assert.equal(out.exitCode, 1)
    assert.equal(out.failure, 'build')
    const summary = formatRebuildSummary(out.results)
    assert.match(summary, /@fixture\/aa: rc=0/)
    assert.match(summary, /@fixture\/bb: rc=1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('E. 同刻平手不判陈旧(严格 <,不得用 >= 制造伪重建)', () => {
  const root = newRoot()
  try {
    makePackage(root, 'tie', '@fixture/tie', {
      'src/a.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.js': { mtime: '2026-11-07T00:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    assert.equal(entries[0].staleArtifacts.length, 0)
    assert.deepEqual(pickStalePackages(entries), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('F. 应有产物缺失必须判陈旧;重建后仍缺 ⇒ NOT-OK(exit 2),不许把缺失判绿', () => {
  const root = newRoot()
  try {
    // 真实 tsc 会同时产出 js + d.ts;这里故意缺 a.js,让"产物缺失"路径单独成立。
    makePackage(root, 'gone', '@fixture/gone', {
      'src/a.ts': { mtime: '2026-11-07T00:00:00Z' },
      'dist/a.d.ts': { mtime: '2026-11-07T00:00:00Z' },
    })
    const entries = collectPackageStates(join(root, 'packages'))
    const st = entries[0]
    // 缺失必须计入陈旧(不能因为"文件不存在所以没有 mtime"就跳过)
    assert.equal(st.staleArtifacts.length, 1)
    assert.equal(st.staleArtifacts[0].artifact, 'a.js')
    assert.equal(st.staleArtifacts[0].missing, true)
    assert.deepEqual(pickStalePackages(entries), ['@fixture/gone'])

    // 重建 rc=0 但产物仍然不出现 ⇒ 必须未判定 exit 2(旧产物不许放行)
    const out = rebuildStalePackages({
      entries,
      staleNames: pickStalePackages(entries),
      buildPackage: () => ({ status: 0 }),
      log: () => {},
    })
    assert.equal(out.exitCode, 2)
    assert.equal(out.failure, 'unverified')
    assert.equal(out.results[0].ok, false)
    assert.equal(out.results[0].unverified.length, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
