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
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-retry-aliases.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const {
  judgeRetryAliases,
  isAliasExpr,
  onRetryExprs,
  judgeRetryText,
  classifyRetryExpr,
  judgeFakeRatchet,
  collectRetryCandidateFiles,
} = __test__

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

// ============================================================================
// 扩面组(2026-11-05):同一提取器/分类器扩到 apps/web/** 与 apps/miniapp-taro/src/**
// 正例:真重载不红;反例:点重试实际只是关弹窗/重置筛选 ⇒ 判红;取不到文件 ⇒ exit 2。
// ============================================================================

test('扩面正例:真重载站点一枚不红(带行号,逐枚可对账)', () => {
  const text = [
    'export function DemoScreen() {',
    '  return (',
    '    <ErrorState',
    '      message={e}',
    '      onRetry={() => { void refetch() }}',
    '    />',
    '  )',
    '}',
  ].join('\n')
  const sites = judgeRetryText(text)
  assert.equal(sites.length, 1)
  assert.equal(sites[0].line, 5)
  assert.equal(sites[0].verdict, '真重载')
  assert.equal(judgeFakeRatchet(sites.map((s) => ({ ...s, end: 'web', file: 'apps/web/a.tsx' })), []).newFake.length, 0)
})

test('扩面反例:关弹窗 / 重置筛选 / 退出 / 翻页 / 空值 一律判假重载', () => {
  const fake = [
    ['() => { setVisible(false) }', 'exit'],
    ['() => { Taro.navigateBack() }', 'exit'],
    ['onBack', 'exit'],
    ['() => { setKeyword("") }', 'clear'],
    ['() => { setFilters({}) }', 'clear'],
    ['onRefresh', 'clear'],
    ['() => loadMore()', 'paging'],
    ['onLoadMore', 'paging'],
    ['undefined', 'null'],
    ['() => {}', 'noop'],
  ]
  for (const [expr, cat] of fake) {
    const r = classifyRetryExpr(expr)
    assert.equal(r.verdict, '假重载', `${expr} 必须判假重载`)
    assert.equal(r.category, cat, `${expr} 子类`)
  }
})

test('扩面棘轮:新假重载无账 ⇒ 红;台账已记 ⇒ 不红;同键超额 ⇒ 红', () => {
  const site = { end: 'miniapp', file: 'apps/miniapp-taro/src/pages/x/x.tsx', line: 12, expr: 'onBack', verdict: '假重载', category: 'exit', reason: '' }
  const fresh = judgeFakeRatchet([site], [])
  assert.equal(fresh.newFake.length, 1, '无台账 ⇒ 新增假重载必须红')
  const recorded = judgeFakeRatchet([site], [{ end: 'miniapp', file: site.file, expr: 'onBack', verdict: '假重载', category: 'exit' }])
  assert.equal(recorded.newFake.length, 0)
  const over = judgeFakeRatchet(
    [site, { ...site, line: 30 }],
    [{ end: 'miniapp', file: site.file, expr: 'onBack', verdict: '假重载', category: 'exit' }],
  )
  assert.equal(over.newFake.length, 1, '同键只允许台账枚数,第 2 枚判红')
})

test('扩面未判定:回调透传不折成真重载,也不折成 0', () => {
  for (const expr of ['onRetry', 'onPolishRetry', 'onRetryReference']) {
    const r = classifyRetryExpr(expr)
    assert.equal(r.verdict, '未判定', `${expr} 的真实语义在宿主侧`)
  }
  const site = { end: 'web', file: 'apps/web/a.tsx', line: 1, expr: 'onRetry', verdict: '未判定', category: 'passthrough', reason: '' }
  const r = judgeFakeRatchet([site], [])
  assert.equal(r.newFake.length, 0, '未判定不进假重载棘轮')
  assert.equal(r.decided, 0, '未判定不计入已判定数')
})

test('扩面取材:web/小程序候选清单只收产品文件,测试夹具不进射程', () => {
  const web = collectRetryCandidateFiles('head', __test__.RETRY_SURFACES.find((s) => s.end === 'web'))
  assert.ok(web.length > 0, 'HEAD 面 web 候选可枚举')
  assert.deepEqual(
    web.filter((f) => /(?:__tests__|\.test\.|\.spec\.)/.test(f)),
    [],
    '测试文件不得进产品口径',
  )
  const mp = collectRetryCandidateFiles('head', __test__.RETRY_SURFACES.find((s) => s.end === 'miniapp'))
  assert.ok(mp.length > 0)
})

// ---- 故障注入:取材层恒故障 ⇒ 直执行 exit 2 且明说「未判定」 ----

const STUB_FACE_READER = `// 镜像测试夹具:取材层恒故障(同步抛,与真实现 execFileSync 同步语义一致)
export class Undetermined extends Error {}
export function gitRaw() {
  throw new Undetermined('stub: git 派生故障注入(镜像测试夹具)')
}
export function catBatch() {
  throw new Undetermined('stub: catBatch 故障注入(镜像测试夹具)')
}
export function readWorktreeFile() {
  return null
}
`

function makeRetryFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'retry-aliases-'))
  const scripts = join(dir, 'scripts')
  mkdirSync(scripts, { recursive: true })
  for (const rel of [
    'check-retry-aliases.mjs',
    'check-cross-end-screen-coverage.mjs',
    'check-rn-host-shell-coverage.mjs',
  ]) {
    copyFileSync(join(ROOT, 'scripts', rel), join(scripts, rel))
  }
  cpSync(join(ROOT, 'scripts', 'lib'), join(scripts, 'lib'), { recursive: true })
  // gen-rn-host-shell 拉 typescript 裸包;本夹具只演练取材故障路径,给它一个不落盘的桩
  writeFileSync(
    join(scripts, 'gen-rn-host-shell.mjs'),
    'export const __test__ = { classify: () => ({}) }\n',
    'utf8',
  )
  writeFileSync(join(scripts, 'lib', 'face-reader.mjs'), STUB_FACE_READER, 'utf8')
  return { entry: join(scripts, 'check-retry-aliases.mjs'), dir }
}

test('扩面 exit 2:取不到文件/清单 ⇒ exit 2 且 stderr 含「未判定」(不冒绿不冒红)', () => {
  const fx = makeRetryFixture()
  const r = spawnSync(process.execPath, [fx.entry], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, TZ: process.env.TZ || 'Asia/Shanghai' },
  })
  assert.equal(r.status, 2, `stderr=${r.stderr}`)
  assert.match(String(r.stderr), /未判定/, '必须以「未判定」点名,不得静默记绿')
  assert.match(String(r.stderr), /取不到/, '必须点名取不到哪一面输入')
})

test('扩面自检:--self-test 27 例全绿(分类器正反例覆盖真/假/未判定三桶)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(r.status, 0, `stderr=${r.stderr}`)
  assert.match(String(r.stdout), /自检 \d+ 例,失败 0/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
