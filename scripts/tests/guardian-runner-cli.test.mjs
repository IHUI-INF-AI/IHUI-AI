// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// guardian-runner CLI 回归:未知参数必须当场失败、--self-test 不许落成全量批、--staged 行为不变。
// 背景(2026-11-04):旧实现只解析 --staged/--timing/--push-gate/--help,`--self-test` 被静默忽略
// ⇒ 调用者以为在跑门自检,实际跑 332 门全量批(实测 41.2 分钟)。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')

function run(args, env = {}) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    env: { ...process.env, ...env },
  })
}

test('CLI:未知参数 --nonsense ⇒ exit 2 且不跑任何门', () => {
  const r = run(['--nonsense'])
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stderr, /未知参数/)
  assert.doesNotMatch(r.stdout, /总检查数/, '未知参数不得静默降级成全量批')
})

test('CLI:--self-test 只跑自检档(抽样门 2 = check-i18n-keys)', () => {
  const r = run(['--self-test'], { GUARDIAN_SELFTEST_ONLY: '2' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /门自检档/)
  assert.match(r.stdout, /check-i18n-keys\.mjs/)
  assert.doesNotMatch(r.stdout, /总检查数/, '--self-test 不得跑全量判据')
})

test('CLI:--self-test 对无自检档门明确未判定(抽样门 1 = check-api-key-leak)', () => {
  const r = run(['--self-test'], { GUARDIAN_SELFTEST_ONLY: '1' })
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stdout, /无自检档/)
  assert.match(r.stdout, /未判定/)
  assert.doesNotMatch(r.stdout, /总检查数/)
})

test('CLI:--self-test 不可与 --staged 组合 ⇒ exit 2', () => {
  const r = run(['--self-test', '--staged'])
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stderr, /不能与 --staged/)
})

test('CLI:--help 打印真实参数表且不触发门', () => {
  const r = run(['--help'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /--self-test/)
  assert.match(r.stdout, /--no-cache/)
  assert.match(r.stdout, /未知参数/)
  assert.doesNotMatch(r.stdout, /总检查数/, '--help 不得触发任何门')
})

test('CLI:--staged 行为保留(空暂存面 ⇒ 全量档 332 门读数)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'guardian-cli-'))
  try {
    const idx = join(tmp, 'index')
    const env = { ...process.env, GIT_INDEX_FILE: idx }
    const seed = spawnSync('git', ['read-tree', 'HEAD'], { cwd: ROOT, env, encoding: 'utf8' })
    assert.equal(seed.status, 0, seed.stdout + seed.stderr)
    const r = run(['--staged'], { GIT_INDEX_FILE: idx })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /全量档/)
    assert.match(r.stdout, /总检查数: 332/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
