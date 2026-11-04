// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/knip-ratchet-face.test.mjs — Knip 棘轮"口径闸门"的镜像测试(§22c)。
 *
 * 被测对象是**纯函数**,输入全是构造面:不派生 git、不跑 knip、不碰仓库瞬时状态
 * (证明取材面/口径这类行为只能靠纯函数 + 构造面 —— 守门 103 的 T12 同教训)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFace, detectConfigLoadFailures, provenanceNote } from '../lib/knip-ratchet-face.mjs'

test('K1 本地脏树必判 incomparable,且理由里带条数(不许只说"不可比")', () => {
  const r = classifyFace({ ci: false, dirtyCount: 238 })
  assert.equal(r.verdict, 'incomparable')
  assert.match(r.reason, /238/)
})

test('K2 干净树判 comparable(反向对照:闸门不是一律判死)', () => {
  assert.equal(classifyFace({ ci: false, dirtyCount: 0 }).verdict, 'comparable')
})

test('K3 CI 干净检出判 comparable;CI 却有脏改动要判 incomparable 并点名配置异常', () => {
  assert.equal(classifyFace({ ci: true, dirtyCount: 0 }).verdict, 'comparable')
  const r = classifyFace({ ci: true, dirtyCount: 3 })
  assert.equal(r.verdict, 'incomparable')
  assert.match(r.reason, /checkout|配置/)
})

test('K4 问不到条数 ⇒ 判 undetermined,绝不冒判可比', () => {
  const r = classifyFace({ ci: false, dirtyCount: null })
  assert.equal(r.verdict, 'undetermined')
  assert.doesNotMatch(r.reason, /可比\b.*✓/)
  assert.match(r.reason, /无法判定/)
})

test('K5 出处标注三态互不串门,且 DIRTY 一定带"经人工放行"字样', () => {
  assert.match(provenanceNote({ comparable: true, dirtyCount: 0, forced: false }), /clean face/)
  const dirtyForced = provenanceNote({ comparable: false, dirtyCount: 42, forced: true })
  assert.match(dirtyForced, /DIRTY worktree\(42 个未提交改动\)/)
  assert.match(dirtyForced, /--allow-dirty/)
  assert.match(provenanceNote({ comparable: false, dirtyCount: null, forced: false }), /DIRTY worktree\(\?\)/)
})

test('K6 反向锁:脏树 + 未放行 与 脏树 + 放行 的文案必须不同形(静默放行 = 没有出处)', () => {
  const a = provenanceNote({ comparable: false, dirtyCount: 7, forced: false })
  const b = provenanceNote({ comparable: false, dirtyCount: 7, forced: true })
  assert.notEqual(a, b)
  assert.doesNotMatch(a, /人工放行/)
})

test('K7 隔离 HEAD 检出(无 .git)判可比并留专门出处 —— 闸门不得挡住唯一正确的记录方式', () => {
  // 本仓做 HEAD 干净验证用的就是 `git archive` 出去的隔离树;它没有 .git,
  // 把它判成 undetermined/incomparable 等于让基线永远没法在干净面上重记。
  const r = classifyFace({ ci: false, dirtyCount: 0, insideRepo: false })
  assert.equal(r.verdict, 'comparable')
  assert.match(r.reason, /隔离|archive/)
  assert.match(provenanceNote({ comparable: true, dirtyCount: 0, forced: false, isolated: true }), /isolated HEAD checkout/)
  // 反向对照:git 问得到但在 status 上失败 ⇒ 仍是 undetermined,不能借 insideRepo 默认值洗成可比
  assert.equal(classifyFace({ ci: false, dirtyCount: null, insideRepo: true }).verdict, 'undetermined')
})

test('K8 knip 的 "Error loading" 行被认成配置加载失败(路径与 cause 都要拿到)', () => {
  const stderr = [
    "ERROR: Error loading packages/database/drizzle.config.ts (DATABASE_URL 未设置 ⇒ 拒绝加载 drizzle 配置。)",
    'ERROR: Please fix or visit https://knip.dev/reference/known-issues',
  ].join('\n')
  const f = detectConfigLoadFailures(stderr)
  assert.equal(f.length, 1)
  assert.equal(f[0].path, 'packages/database/drizzle.config.ts')
  assert.match(f[0].cause, /DATABASE_URL/)
})

test('K9 路径自带括号(Next 路由段)不得被当成 cause 的分隔点', () => {
  // 反面锁:若实现用"第一个左括号"切分,app/(main)/… 会被切成 path='apps/web/app' 而误判
  const stderr =
    "ERROR: Error loading apps/web/app/(main)/download/[platform]/x.tsx ([app.config] 缺少配置)"
  const f = detectConfigLoadFailures(stderr)
  assert.equal(f.length, 1)
  assert.equal(f[0].path, 'apps/web/app/(main)/download/[platform]/x.tsx')
  assert.equal(f[0].cause, '[app.config] 缺少配置')
})

test('K10 cause 自身带括号时取到行尾的右括号,不被截断', () => {
  const f = detectConfigLoadFailures(
    "ERROR: Error loading apps/mobile-rn/app.config.js ([app.config] 缺 WX(见 app.json) 与 android.package)",
  )
  assert.equal(f.length, 1)
  assert.match(f[0].cause, /android\.package/)
})

test('K11 无配置加载失败时返回空(反向锁:判据不是见 ERROR 就红)', () => {
  assert.deepEqual(detectConfigLoadFailures(''), [])
  assert.deepEqual(detectConfigLoadFailures(undefined), [])
  assert.deepEqual(
    detectConfigLoadFailures(
      'Your Expo app does not have a userInterfaceStyle setting\nERROR: 其它类型的错误不属本判据',
    ),
    [],
  )
})

test('K12 多面同时失败时逐条点名,一条不漏', () => {
  const f = detectConfigLoadFailures(
    [
      "ERROR: Error loading apps/extension/wxt.config.ts (File './.wxt/tsconfig.json' not found.)",
      "ERROR: Error loading apps/extension/vitest.config.ts (File './.wxt/tsconfig.json' not found.)",
      'ERROR: Please fix or visit https://knip.dev/reference/known-issues',
    ].join('\n'),
  )
  assert.deepEqual(
    f.map((x) => x.path),
    ['apps/extension/wxt.config.ts', 'apps/extension/vitest.config.ts'],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
