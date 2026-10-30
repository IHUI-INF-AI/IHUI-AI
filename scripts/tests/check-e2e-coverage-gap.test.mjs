// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 250 镜像测试(§22c):源脚本 __test__ 形状锁 + 装车证明(HEAD 面 runner)+ 补测两半射程单源锁。
// node --test scripts/tests/check-e2e-coverage-gap.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as L } from '../lib/e2e-coverage-gap.mjs'
import { __test__ as G } from '../check-e2e-coverage-gap.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GATE = path.join(ROOT, 'scripts/check-e2e-coverage-gap.mjs')

test('self-test 全绿(例数按末行现读)', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  const last = String(r.stdout).trim().split(/\r?\n/).pop()
  assert.match(last, /^自检 \d+\/\d+ 通过$/)
})

test('__test__ 键齐备(源搬家/改名即报错)', () => {
  for (const k of [
    'REPO_ROOT',
    'SCOPE_REL',
    'validateScope',
    'loadScope',
    'collectFace',
    'evaluateFace',
    'judgeExit',
    'todayIso',
  ]) {
    assert.ok(k in G, `缺导出 ${k}`)
  }
})

test('射程单源:缺口门射程清单 == 补测器 audit.roots', () => {
  const scope = G.loadScope()
  assert.ok(scope.roots.length > 0)
  const map = JSON.parse(readFileSync(path.join(ROOT, 'scripts/data/e2e-autofill-map.json'), 'utf8'))
  assert.deepEqual(
    scope.roots.map((r) => r.root),
    map.audit.roots,
  )
})

test('装车证明:HEAD 面 runner 里 id 250 条目成套(script/mode/skipEnv/triggers)', () => {
  const src = gitRaw(['cat-file', 'blob', 'HEAD:scripts/guardian-runner.mjs'], ROOT, {
    maxBuffer: 64 * 1024 * 1024,
  })
  const m = src.match(/script: 'check-e2e-coverage-gap\.mjs',([\s\S]{0,2000}?)\n  \},/)
  assert.ok(m, 'HEAD 面 runner 找不到 check-e2e-coverage-gap.mjs 注册条目')
  const block = m[1]
  // 升 blocking 时本条断言须与 AGENTS 点名、门体头注同笔更新(名字承诺与实现兑现)。
  assert.match(block, /mode: 'warn'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_E2E_COVERAGE_GAP'/)
  for (const { root } of G.loadScope().roots) {
    assert.ok(block.includes(`'${root}/'`), `triggers 缺射程根 ${root}/`)
  }
  assert.ok(block.includes("'scripts/data/e2e-coverage-gap-scope.json'"), 'triggers 缺射程清单')
  assert.ok(block.includes("'scripts/lib/e2e-coverage-gap.mjs'"), 'triggers 缺判据层')
})

test('判据层③收集目录同名:正反成对(唯一实现 import 判据层 __test__,不复制)', () => {
  const M = (p) => ({ path: p, text: 'export const x = 1\n' })
  const run = (files, tests) =>
    L.findTestlessModules({ files, testFiles: tests, roots: ['apps/api/src'] })
  // 正:收集目录(tests/ 任意层与 test/ 平铺)精确同名、跨扩展名 —— 补测配方真落点必须被门收
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/api/tests/lib/x.test.ts']).gapCount, 0)
  assert.equal(run([M('apps/api/src/db/y.tsx')], ['apps/api/test/y.test.ts']).gapCount, 0)
  // 反:跨包 / playwright 族 *.spec.* / 前缀名 / src 内嵌 tests/,一律不认(失效方向=多要一次说明)
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/web/tests/x.test.ts']).gapCount, 1)
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/api/tests/visual/x.spec.ts']).gapCount, 1)
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/api/tests/x-extra.test.ts']).gapCount, 1)
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/api/src/lib/tests/x.test.ts']).gapCount, 1)
})

test('判据层③精确同名收紧:特征命名测试不得冒充模块测试(admin 例,补测配方真落点)', () => {
  const M = (p) => ({ path: p, text: 'export const a = 1\n' })
  const run = (files, tests) =>
    L.findTestlessModules({ files, testFiles: tests, roots: ['apps/api/src'] })
  // 反:admin-deep-p0-batch.test.ts 是补测配方(api-unit-other)的真实特征命名,stem 是
  // "admin-deep-p0-batch",与模块 admin.ts(stem="admin")不同 ⇒ ③ 精确同名不成立,admin.ts 仍落缺口。
  // 这正是 ③ 不做 ② 词边界前缀放宽的原因:否则 admin-*.test.ts 会冒充 admin.ts 的测试(假绿)。
  assert.equal(run([M('apps/api/src/admin/admin.ts')], ['apps/api/tests/admin-deep-p0-batch.test.ts']).gapCount, 1)
  // 正:同名测试 admin.test.ts 才认 —— 证明不是"整个③失效",只是精确同名这一维收紧
  assert.equal(run([M('apps/api/src/admin/admin.ts')], ['apps/api/tests/admin.test.ts']).gapCount, 0)
})

test('判据层③同包同名唯一:同名多模块时名字指认不了 ⇒ 失效方向是红', () => {
  const M = (p) => ({ path: p, text: 'export const x = 1\n' })
  const run = (files, tests, roots) => L.findTestlessModules({ files, testFiles: tests, roots })
  // 同名×2 共享一份收集目录测试 ⇒ ③ 失效,双双落缺口(宁可要一次说明,不放行假绿)
  assert.equal(
    run(
      [M('apps/api/src/lib/audit.ts'), M('apps/api/src/plugins/audit.ts')],
      ['apps/api/tests/audit.test.ts'],
      ['apps/api/src'],
    ).gapCount,
    2,
  )
  // 同名唯一 ⇒ 认
  assert.equal(
    run([M('apps/api/src/lib/auth.ts')], ['apps/api/tests/auth.test.ts'], ['apps/api/src']).gapCount,
    0,
  )
  // 同包跨根(app 与 src)的同名也计入唯一性
  assert.equal(
    run(
      [M('apps/web/app/b/solo.ts'), M('apps/web/src/a/solo.ts')],
      ['apps/web/tests/solo.test.ts'],
      ['apps/web/app', 'apps/web/src'],
    ).gapCount,
    2,
  )
  // pairwise 契约:stemUnique 缺省不认,显式 true 才认
  assert.equal(L.testCoversModule('apps/api/src/lib/x.ts', 'apps/api/tests/x.test.ts'), false)
  assert.equal(
    L.testCoversModule('apps/api/src/lib/x.ts', 'apps/api/tests/x.test.ts', { stemUnique: true }),
    true,
  )
})

// ── 规则④(收集式 __tests__)2026-10-28 立:正反成对,负向必在场 ──────────────────
test('判据层①②不回退:同目录与同目录 __tests__ 仍各自命中', () => {
  const M = (p) => ({ path: p, text: 'export const x = 1\n' })
  const run = (files, tests, roots) => L.findTestlessModules({ files, testFiles: tests, roots })
  // ① 同目录同名
  assert.equal(run([M('apps/web/src/a/x.ts')], ['apps/web/src/a/x.test.ts'], ['apps/web/src']).gapCount, 0)
  // ① 同目录跨扩展名族(x.tsx ← x.spec.tsx)
  assert.equal(run([M('apps/web/src/a/x.tsx')], ['apps/web/src/a/x.spec.tsx'], ['apps/web/src']).gapCount, 0)
  // ② 同目录 __tests__,词边界前缀(y-extra 盖 y)
  assert.equal(
    run([M('packages/shared/src/b/y.ts')], ['packages/shared/src/b/__tests__/y-extra.test.ts'], ['packages/shared/src'])
      .gapCount,
    0,
  )
})

test('判据层④收集式 __tests__:同包祖先目录的 __tests__ 精确同名即命中(本轮新规则)', () => {
  const M = (p) => ({ path: p, text: 'export const x = 1\n' })
  const run = (files, tests) => L.findTestlessModules({ files, testFiles: tests, roots: ['apps/api/src'] })
  // 一层祖先:routes/__tests__ 收 routes/user/ 下的模块(存量假缺口主形态)
  assert.equal(run([M('apps/api/src/routes/user/x.ts')], ['apps/api/src/routes/__tests__/x.test.ts']).gapCount, 0)
  // 任意层祖先 + 跨扩展名族(x.ts ← x.test.mjs)
  assert.equal(run([M('apps/api/src/a/b/c/deep.ts')], ['apps/api/src/a/__tests__/deep.test.mjs']).gapCount, 0)
  // 既有 ③(P/tests)不得回退
  assert.equal(run([M('apps/api/src/lib/x.ts')], ['apps/api/tests/x.test.ts']).gapCount, 0)
  // pairwise 契约:子树唯一维缺省不认,显式 true 才认
  assert.equal(L.nestedTestsDirCovers('apps/api/src/routes/user/x.ts', 'apps/api/src/routes/__tests__/x.test.ts'), true)
  assert.equal(L.testCoversModule('apps/api/src/routes/user/x.ts', 'apps/api/src/routes/__tests__/x.test.ts'), false)
  assert.equal(
    L.testCoversModule('apps/api/src/routes/user/x.ts', 'apps/api/src/routes/__tests__/x.test.ts', {
      subtreeStemUnique: true,
    }),
    true,
  )
})

test('判据层④负向:前缀相似 / 跨子树 / playwright 族 / 跨包,一律不得误判命中', () => {
  const M = (p) => ({ path: p, text: 'export const x = 1\n' })
  const run = (files, tests) => L.findTestlessModules({ files, testFiles: tests, roots: ['apps/api/src'] })
  // 前缀相似:foo-extra 不盖 foo(④ 不做 ② 的词边界前缀放宽)
  assert.equal(run([M('apps/api/src/routes/user/foo.ts')], ['apps/api/src/routes/__tests__/foo-extra.test.ts']).gapCount, 1)
  // 跨子树:routes/__tests__ 不盖 services/ 的模块(一份路由测试冒充服务层测试)
  assert.equal(run([M('apps/api/src/services/foo.ts')], ['apps/api/src/routes/__tests__/foo.test.ts']).gapCount, 1)
  // playwright 族 *.spec.*:收集目录里不认
  assert.equal(run([M('apps/api/src/routes/user/foo.ts')], ['apps/api/src/routes/__tests__/foo.spec.ts']).gapCount, 1)
  // 跨包:apps/web 的 __tests__ 不盖 apps/api 的模块
  assert.equal(run([M('apps/api/src/lib/foo.ts')], ['apps/web/src/__tests__/foo.test.ts']).gapCount, 1)
})

test('判据层④子树锚定收紧:routes/__tests__ 不得盖 services/(一份路由测试冒充服务层测试)', () => {
  const M = (p) => ({ path: p, text: 'export const a = 1\n' })
  const run = (files, tests) => L.findTestlessModules({ files, testFiles: tests, roots: ['apps/api/src'] })
  // 反:routes/__tests__/x.test.ts 的父目录子树是 apps/api/src/routes,services/ 不在其下 ⇒ 子树锚定不成立
  assert.equal(run([M('apps/api/src/services/x.ts')], ['apps/api/src/routes/__tests__/x.test.ts']).gapCount, 1)
  // 正:同子树的 routes/zzz-route-uniq.ts 才认(用唯一 stem,避开子树内同名撞车)
  assert.equal(
    run([M('apps/api/src/routes/zzz-route-uniq.ts')], ['apps/api/src/routes/__tests__/zzz-route-uniq.test.ts']).gapCount,
    0,
  )
})

test('判据层④主收紧:子树内同名撞车(page.tsx 族)不得一份测试洗成整片绿', () => {
  const M = (p) => ({ path: p, text: 'export const Page = () => null\n' })
  const run = (files, tests) => L.findTestlessModules({ files, testFiles: tests, roots: ['apps/web/app'] })
  // 根 __tests__/page.test.tsx 面对两枚 page.tsx ⇒ 名字指认不了 ⇒ 双双落缺口
  assert.equal(
    run(
      [M('apps/web/app/a/page.tsx'), M('apps/web/app/b/page.tsx')],
      ['apps/web/app/__tests__/page.test.tsx'],
    ).gapCount,
    2,
  )
  // 子树内唯一 ⇒ 认(每个页面自己的 __tests__ 测自己,不连坐别处的同名兄弟)
  assert.equal(
    run([M('apps/web/app/a/page.tsx'), M('apps/web/app/b/page.tsx')], ['apps/web/app/a/__tests__/page.test.tsx']).gapCount,
    1,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
