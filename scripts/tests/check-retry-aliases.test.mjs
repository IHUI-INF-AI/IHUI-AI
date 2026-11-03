#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-retry-aliases.mjs 的判据镜像测试(3 条)。
 * §22c:判据直接 import 源 `__test__`,不另抄一份「什么算别名 / 什么算缺重试」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-retry-aliases.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { judgeRetryAliases, isAliasExpr, onRetryExprs } = __test__

const shared = (name, text, spec = `packages/app/src/features/x/${name}.tsx`) => ({ name, spec, text })
const shell = (name, text) => ({ file: `apps/mobile-rn/src/screens/${name}.tsx`, name, text })

test('别名命中即红:onBack / onRefresh / onLoadMore / undefined / onRetry ?? onRefresh', () => {
  const exprs = ['onBack', 'onRefresh', 'onLoadMore', 'undefined', 'onRetry ?? onRefresh']
  for (const e of exprs) assert.equal(isAliasExpr(e), true, `${e} 应判别名`)
  assert.equal(isAliasExpr('() => { void load(); }'), false)
  assert.equal(isAliasExpr('load'), false)

  const report = judgeRetryAliases({
    sharedScreens: [
      shared('DemoScreen', 'export function DemoScreen() { return <ErrorState message={e} onRetry={onBack} /> }'),
    ],
    rnShells: [],
  })
  assert.equal(report.alias, 1)
  assert.equal(report.sharedAlias, 1)
  assert.equal(report.missingRetry, 0)
})

test('壳侧缺真 onRetry 即红:共享屏有 ErrorState 但壳只给别名/不给', () => {
  const sharedScreens = [
    shared(
      'DemoScreen',
      'export function DemoScreen() { return <ErrorState message={e} onRetry={onRetry} /> }',
    ),
  ]
  const aliasOnly = judgeRetryAliases({
    sharedScreens,
    rnShells: [shell('DemoScreen', "import { DemoScreen as S } from '@ihui/rn-app'\n<S onRetry={onRefresh} />")],
  })
  assert.equal(aliasOnly.missingRetry, 0, '别名另有 alias 口径,不重复记 missing')
  assert.equal(aliasOnly.shellAlias, 1)

  const missing = judgeRetryAliases({
    sharedScreens,
    rnShells: [shell('DemoScreen', "import { DemoScreen as S } from '@ihui/rn-app'\n<S onBack={() => goBack()} />")],
  })
  assert.equal(missing.alias, 0)
  assert.equal(missing.missingRetry, 1)
  assert.equal(missing.shellMissing.length, 1)

  const sharedMissing = judgeRetryAliases({
    sharedScreens: [shared('DemoScreen', 'export function DemoScreen() { return <ErrorState message={e} /> }')],
    rnShells: [],
  })
  assert.equal(sharedMissing.missingRetry, 1)
  assert.equal(sharedMissing.sharedMissing.length, 1)
})

test('全绿:共享屏透传真 onRetry,壳侧 () => load() ⇒ alias=0 missingRetry=0', () => {
  const report = judgeRetryAliases({
    sharedScreens: [
      shared(
        'DemoScreen',
        'export function DemoScreen({ onRetry }: Props) { return <ErrorState message={e} onRetry={onRetry} /> }',
      ),
    ],
    rnShells: [
      shell(
        'DemoScreen',
        "import { DemoScreen as S } from '@ihui/rn-app'\n<S onRetry={() => { void load(); }} />",
      ),
    ],
  })
  assert.equal(report.alias, 0)
  assert.equal(report.missingRetry, 0)

  // 平衡花括号:内层块的 `}` 不能截断表达式
  assert.deepEqual(onRetryExprs('<X onRetry={() => { void load(); }} />'), ['() => { void load(); }'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
