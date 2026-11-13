// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-admin-password-frozen 的判据锁(2026-11-13 立)
 *
 * 锁的是"机主明令此后不得再改 admin 密码"这条约束的唯一实现:
 * `scripts/check-admin-password-frozen.mjs` 的 `judge()` / `selfTest()`。
 *
 * 为什么要有这份测试:冻结闸本身若判错(例如把明文指纹与库内哈希指纹混用),
 * 会在"完全一致"时误报 drift,久而久之逼人加豁免 —— 那等于亲手拆掉唯一防线。
 * 2026-11-13 首次实现就踩过这一格,故把 5 个场景逐条钉死。
 *
 * 判据单一真相源:本文件只 import 源脚本,不得复制判据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const SRC = new URL('../check-admin-password-frozen.mjs', import.meta.url).href
const { judge, selfTest } = await import(SRC)

const sha12 = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)

test('三处指纹各按各的口径比:明文用明文指纹,库哈希用哈希指纹', () => {
  const plain = 'test-only-fixture'
  const lock = { passwordSha256_12: sha12(plain), dbHashSha256_12: sha12('ARGON2-HASH') }
  const r = judge({
    lock,
    pwdFileValue: plain,
    serviceEnvValue: plain,
    dbHashSha12: sha12('ARGON2-HASH'),
  })
  assert.equal(r.state, 'ok')
  assert.deepEqual(r.drifted, [])
})

test('把库哈希拿明文指纹去比 ⇒ 必须判 drift(2026-11-13 踩过的错型)', () => {
  const plain = 'test-only-fixture'
  // 只给一个 passwordSha256_12,库哈希与它不等 ⇒ 应精确点名 db-hash
  const lock = { passwordSha256_12: sha12(plain), dbHashSha256_12: 'ffffffffffff' }
  const r = judge({
    lock,
    pwdFileValue: plain,
    serviceEnvValue: plain,
    dbHashSha12: sha12('ARGON2-HASH'),
  })
  assert.equal(r.state, 'drift')
  assert.deepEqual(r.drifted, ['db-hash'])
})

test('只有 env 陈旧 ⇒ 精确点名 service-env(2026-10 那次静默事故的形态)', () => {
  const plain = 'test-only-fixture'
  const lock = { passwordSha256_12: sha12(plain), dbHashSha256_12: sha12('H') }
  const r = judge({
    lock,
    pwdFileValue: plain,
    serviceEnvValue: 'stale-value',
    dbHashSha12: sha12('H'),
  })
  assert.equal(r.state, 'drift')
  assert.deepEqual(r.drifted, ['service-env'])
})

test('取不到输入 ⇒ unjudged,不记绿也不冒红', () => {
  const plain = 'test-only-fixture'
  const lock = { passwordSha256_12: sha12(plain), dbHashSha256_12: sha12('H') }
  const r = judge({ lock, pwdFileValue: null, serviceEnvValue: plain, dbHashSha12: sha12('H') })
  assert.equal(r.state, 'unjudged')
  assert.deepEqual(r.unjudged, ['file'])
  assert.deepEqual(r.drifted, [])
})

test('lock 缺 dbHashSha256_12 ⇒ 该维不得判绿', () => {
  const plain = 'test-only-fixture'
  const r = judge({
    lock: { passwordSha256_12: sha12(plain) },
    pwdFileValue: plain,
    serviceEnvValue: plain,
    dbHashSha12: sha12('H'),
  })
  assert.equal(r.state, 'drift')
  assert.ok(r.drifted.includes('db-hash'))
})

test('内置自检 5 场景全过', () => {
  assert.equal(selfTest(), true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
