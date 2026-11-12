// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Loomy / ZCode / 小浣熊 三条同型回灌壳的接线锁(2026-11-12 立)。
 * 只锁纯函数与契约形状:不 spawn、不连库、不碰本机客户端。
 * tsx 侧 parseArgs 的行为面由 apps/api/tests/relay-client-session-sync.test.ts
 * 直测(§22c 各锁各的面,本层零复算)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

import { __test__ as L } from '../sync-loomy-client-session.mjs'
import { __test__ as Z } from '../sync-zcode-client-session.mjs'
import { __test__ as R } from '../sync-raccoon-client-session.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const LEGS = [
  { code: 'loomy', S: L, shell: 'scripts/sync-loomy-client-session.mjs' },
  { code: 'zcode', S: Z, shell: 'scripts/sync-zcode-client-session.mjs' },
  { code: 'raccoon', S: R, shell: 'scripts/sync-raccoon-client-session.mjs' },
]

test('① 参数面:三腿 parseArgs 同型(--dry-run/--json/--help 合法;未知 ⇒ 未判定;裸 `--` 透传)', () => {
  for (const { code, S } of LEGS) {
    assert.equal(S.parseArgs(['--dry-run']).dryRun, true, code)
    assert.equal(S.parseArgs(['--json']).json, true, code)
    assert.equal(S.parseArgs(['--help']).help, true, code)
    assert.equal(S.parseArgs(['-h']).help, true, code)
    assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus', code)
    assert.equal(S.parseArgs(['--', '--dry-run']).error, null, code)
    assert.equal(S.parseArgs(['--', '--dry-run']).dryRun, true, code)
  }
})

test('② 子进程传参形态:三腿一律等号 --provider=<code>(空格形态是 2026-11-12 16:43 事故根因)', () => {
  for (const { code, shell } of LEGS) {
    const src = read(shell)
    assert.ok(src.includes(`'--provider=${code}'`), `${shell} 未以等号形态传 --provider`)
    assert.ok(!src.includes(`'--provider',`), `${shell} 回退成空格形态(spawn 数组拆开传)`)
  }
})

test('③ 载荷 providerCode 字面量与腿自身一致(三条腿不得互串)', () => {
  for (const { code, shell } of LEGS) {
    assert.ok(
      read(shell).includes(`providerCode: '${code}'`),
      `${shell} 载荷 providerCode != ${code}`,
    )
  }
})

test('④ 落库目标单源:三腿都指向 relay-client-session-sync.ts(判据不住在壳里)', () => {
  for (const { shell } of LEGS) {
    assert.ok(read(shell).includes('relay-client-session-sync.ts'), `${shell} 未指向通用落库端`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
