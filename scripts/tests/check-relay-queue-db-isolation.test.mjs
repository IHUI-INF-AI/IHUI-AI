// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 276 的镜像测试 —— 判据一律 import 门体的 `__test__`,**不复制实现**。
 *
 * 为什么必须有镜像这一层(而不是只靠门体 `--self-test`):`--self-test` 住在门体里,
 * 门体的判据被误改时,自检用的还是被改过的那把尺子 —— 两份用例各自独立写一遍,
 * 改坏一处至少会在另一半红。test 用例里的样例串在 `*.test.*` 里,门自己扫到会走路径豁免,
 * 所以这里可以写明文,不必像门体那样拼接规避自指。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-relay-queue-db-isolation.mjs'

const { extractBalanced, scanSource, pathExemptReason } = __test__

const VICTIM = `const api = spawn(process.execPath, ['src/index.ts'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: dsn, PORT: '8809' },
  stdio: 'ignore',
})
`

test('换库不换 Redis ⇒ 命中 1 条,且行号指向 DATABASE_URL 那一行', () => {
  const r = scanSource(VICTIM, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 1)
  assert.equal(r.skips.length, 0)
  assert.equal(r.violations[0].line, 3)
  assert.match(r.violations[0].reason, /relay-account-pool-queue/)
  assert.match(r.violations[0].fix, /RELAY_QUEUE_SUFFIX|REDIS_URL/)
})

test('同块换 REDIS_URL ⇒ 0 条(反例锁)', () => {
  const src = VICTIM.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, REDIS_URL: redisDsn")
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 0)
})

test('同块设 RELAY_QUEUE_SUFFIX ⇒ 0 条', () => {
  const src = VICTIM.replace("DATABASE_URL: dsn", "DATABASE_URL: dsn, RELAY_QUEUE_SUFFIX: 'e2e'")
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
})

test('注释里的 REDIS_URL 不算隔离证据(否则一行注释就能洗绿)', () => {
  const src = `spawn(cmd, {
  // 记得换 REDIS_URL
  env: { DATABASE_URL: dsn },
})
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 1)
})

test('process.env.DATABASE_URL = 直赋值形 ⇒ 命中', () => {
  const src = `function boot(dsn) {
  process.env.DATABASE_URL = dsn
  return startWorker()
}
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.rewritten, 1)
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].line, 2)
})

test('READ_ONLY 豁免:记 skip 且不记 violation(不许静默吞)', () => {
  const src = `const r = execSync(cmd, { env: { ...process.env, DATABASE_URL: dsn /* READ_ONLY */ } })
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 1)
  assert.match(r.skips[0].reason, /READ_ONLY/)
})

test('QUEUE_ISOLATION_EXEMPT 标记豁免:记 skip 且点名标记', () => {
  const src = `const r = execSync(cmd, {
  env: {
    ...process.env,
    DATABASE_URL: dsn, // QUEUE_ISOLATION_EXEMPT: 该进程不加载 relay worker
  },
})
`
  const r = scanSource(src, { file: 'scripts/fixture.mjs' })
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 1)
  assert.match(r.skips[0].reason, /QUEUE_ISOLATION_EXEMPT/)
})

test('没有 env 块的文件 ⇒ NOT_APPLICABLE(rewritten=0,不记绿也不记红)', () => {
  const r = scanSource('const dsn = process.env.DATABASE_URL\nconsole.log(dsn)\n', { file: 'scripts/x.mjs' })
  assert.equal(r.rewritten, 0)
  assert.equal(r.violations.length, 0)
  assert.equal(r.skips.length, 0)
})

test('路径豁免:apps/api/tests/ 与 *.test.* 各记 1 条 skip', () => {
  assert.match(String(pathExemptReason('apps/api/tests/e2e/stack.ts')), /apps\/api\/tests/)
  assert.match(String(pathExemptReason('scripts/tests/foo.test.mjs')), /test/)
  const a = scanSource(VICTIM, { file: 'apps/api/tests/e2e/stack.ts' })
  const b = scanSource(VICTIM, { file: 'scripts/tests/foo.test.mjs' })
  assert.equal(a.violations.length, 0)
  assert.equal(a.skips.length, 1)
  assert.equal(b.violations.length, 0)
  assert.equal(b.skips.length, 1)
})

test('extractBalanced:嵌套对象', () => {
  const src = 'env: { a: { b: { c: 1 } }, d: 2 }, tail'
  assert.equal(extractBalanced(src, src.indexOf('{')), '{ a: { b: { c: 1 } }, d: 2 }')
})

test('extractBalanced:字符串里含 } 不提前收口', () => {
  assert.equal(extractBalanced(`{ k: '}', j: "a}b", m: 1 } rest`, 0), `{ k: '}', j: "a}b", m: 1 }`)
})

test('extractBalanced:模板串(含 ${} 插值)', () => {
  assert.equal(extractBalanced('{ k: `x${y.z}` , m: `a}b` } tail', 0), '{ k: `x${y.z}` , m: `a}b` }')
})

test('extractBalanced:配不平返回 null,不猜', () => {
  assert.equal(extractBalanced('{ a: 1', 0), null)
  assert.equal(extractBalanced('no brace here', 0), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
