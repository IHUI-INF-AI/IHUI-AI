#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-rn-host-shell-coverage.mjs 的判据镜像测试(P0-1,4 条)。
 * §22c:判据直接 import 源 `__test__`,测试不另抄一份「什么算直接 import / 什么算到期」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-rn-host-shell-coverage.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { judgeCoverage, rnAppValueImports, directlyImports } = __test__

const shell = (file, name, text) => ({ file, name, text })
const needsManual = () => ({ kind: 'needs-manual', hard: ['onPress'], legs: ['onPress'] })
const seedable = () => ({ kind: 'seedable', hard: [], legs: [] })

test('覆盖达标:每个共享屏都被至少一个 RN 壳值导入 ⇒ 无判红', () => {
  const shared = [
    {
      name: 'AboutScreen',
      spec: 'packages/app/src/features/about/AboutScreen.tsx',
      domain: 'about',
    },
    { name: 'HomeScreen', spec: 'packages/app/src/features/home/HomeScreen.tsx', domain: 'home' },
  ]
  const rnShells = [
    shell(
      'apps/mobile-rn/src/screens/AboutScreen.tsx',
      'AboutScreen',
      "import { AboutScreen as SharedAboutScreen } from '@ihui/rn-app'\nexport const AboutScreen = () => <SharedAboutScreen />\n",
    ),
    shell(
      'apps/mobile-rn/src/screens/HomeScreen.tsx',
      'HomeScreen',
      "import { HomeScreen } from '@ihui/rn-app'\nexport const HomeScreen = () => <HomeScreen />\n",
    ),
    // 类型导入不算「直接 import」:它不渲染,只证明符号存在
    shell(
      'apps/mobile-rn/src/screens/TypeOnly.tsx',
      'TypeOnly',
      "import type { AboutScreen } from '@ihui/rn-app'\n",
    ),
  ]
  const r = judgeCoverage({
    shared,
    rnShells,
    manualEntries: [],
    classify: seedable,
    today: '2026-11-03',
  })
  assert.equal(r.total, 2)
  assert.equal(r.covered, 2)
  assert.deepEqual(r.failures, [])
  assert.equal(r.needsManual.length, 0)
  assert.equal(r.seedableMissing.length, 0)
  // 反证:类型导入没有被算进值导入
  const parsed = rnAppValueImports("import type { AboutScreen } from '@ihui/rn-app'")
  assert.equal(directlyImports({ ...parsed, namespacesText: '' }, 'AboutScreen'), false)
})

test('有 needsManual 未登记:未覆盖且账本无条目 ⇒ 判红并点名未指派', () => {
  const shared = [
    {
      name: 'CameraScreen',
      spec: 'packages/app/src/features/camera/CameraScreen.tsx',
      domain: 'camera',
    },
  ]
  const rnShells = [
    shell(
      'apps/mobile-rn/src/screens/CameraScreen.tsx',
      'CameraScreen',
      '// 空壳,未 import 共享屏\n',
    ),
  ]
  const r = judgeCoverage({
    shared,
    rnShells,
    manualEntries: [],
    classify: needsManual,
    today: '2026-11-03',
  })
  assert.equal(r.covered, 0)
  assert.equal(r.needsManual.length, 1)
  assert.equal(r.needsManual[0].owner, null)
  assert.equal(r.needsManual[0].expires, null)
  assert.ok(r.failures.some((f) => f.type === 'manual-unregistered' && f.shared === 'CameraScreen'))
  assert.equal(r.manualExpired, 0)
})

test('登记到期:needsManual 的 expires 早于今天 ⇒ manualExpired=1 且判红', () => {
  const shared = [
    { name: 'PdfScreen', spec: 'packages/app/src/features/pdf/PdfScreen.tsx', domain: 'pdf' },
  ]
  const rnShells = [shell('apps/mobile-rn/src/screens/PdfScreen.tsx', 'PdfScreen', '// 空壳\n')]
  const manualEntries = [
    {
      shared: 'PdfScreen',
      owner: 'alice',
      expires: '2026-10-01',
      reason: '等 PDF 原生依赖',
      evidence: 'apps/mobile-rn/src/screens/PdfScreen.tsx:1 空壳;共享屏硬 props uri/onBack 未接',
    },
  ]
  const r = judgeCoverage({
    shared,
    rnShells,
    manualEntries,
    classify: needsManual,
    today: '2026-11-03',
  })
  assert.equal(r.needsManual.length, 1)
  assert.equal(r.manualExpired, 1)
  const hit = r.failures.find((f) => f.type === 'manual-invalid' && f.shared === 'PdfScreen')
  assert.ok(hit, '到期条目必须进 failures')
  assert.ok(hit.issues.some((x) => x.includes('已到期')))
  // 到期日当天仍算在期(与仓库既有 until 语义一致)
  const onDeadline = judgeCoverage({
    shared,
    rnShells,
    manualEntries,
    classify: needsManual,
    today: '2026-10-01',
  })
  assert.equal(onDeadline.manualExpired, 0)
  assert.equal(onDeadline.failures.length, 0)
})

test('登记缺 evidence:needsManual 有 owner/expires 但无 evidence ⇒ 判红', () => {
  const shared = [
    { name: 'MapScreen', spec: 'packages/app/src/features/map/MapScreen.tsx', domain: 'map' },
  ]
  const rnShells = [shell('apps/mobile-rn/src/screens/MapScreen.tsx', 'MapScreen', '// 空壳\n')]
  const manualEntries = [
    { shared: 'MapScreen', owner: 'bob', expires: '2027-03-31', reason: '等地图 SDK' },
  ]
  const r = judgeCoverage({
    shared,
    rnShells,
    manualEntries,
    classify: needsManual,
    today: '2026-11-03',
  })
  assert.equal(r.needsManual.length, 1)
  const hit = r.failures.find((f) => f.type === 'manual-invalid' && f.shared === 'MapScreen')
  assert.ok(hit, '缺 evidence 必须进 failures')
  assert.ok(hit.issues.includes('缺 evidence'))
  assert.equal(r.needsManual[0].evidence, null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
