// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号域族注册表回归锁(RP-1,2026-11-03)。
 *
 * 立因:取号器把族名写死成单字母,台账里已开张的 `RP` 两字母族结构上取不到号。
 * 本文件钉四件事(都不许靠"跑一次看着对"):
 *  ① 注册表:26 个单字母 + RP 显式在册,段宽/池上限与 lease 常量同源,未知族不在册;
 *  ② RP 能取号:真跑 CLI(`--next-only --family RP --source <固定 rev>`),输出 `RP-n` 且 1≤n≤99;
 *  ③ 越界拒发点名:池 1..99 全被占 ⇒ 分配器返回 null,拒绝行点名 `绝不发 >99`;
 *  ④ 单字母逐字不变:**HEAD 版 CLI** 与当前版 CLI 在固定 source 下 stdout 字节相同。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PLAN_ID_FAMILY_REGISTRY,
  PLAN_ID_FAMILY_NAMES,
  describeRegisteredFamilies,
  lookupPlanIdFamily,
} from '../lib/plan-id-families.mjs'
import {
  LEASE_POOL_MAX,
  LEASE_SEGMENT_SIZE,
  POOL_EXHAUST_REASON,
  describePoolExhaustion,
  smallestFreeId,
} from '../lib/plan-id-lease.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'next-plan-id.mjs')

function runCli(args, { cwd = ROOT, input } = {}) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', input, windowsHide: true })
  return { status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') }
}

function fixedSource() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 0, 'git rev-parse HEAD 失败,无法做固定 source 对照')
  return String(r.stdout).trim()
}

test('注册表:26 个单字母全在册、RP 显式在册、未知族不在册', () => {
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const entry = PLAN_ID_FAMILY_REGISTRY[letter]
    assert.ok(entry, `单字母族 ${letter} 必须与改前一样在册`)
    assert.equal(entry.segmentWidth, LEASE_SEGMENT_SIZE, `${letter}: 段宽必须引用 lease 常量`)
    assert.equal(entry.poolMax, LEASE_POOL_MAX, `${letter}: 池上限必须引用 lease 常量`)
    assert.equal(entry.multiLetter, false)
  }
  const rp = lookupPlanIdFamily('RP')
  assert.ok(rp, 'RP 必须作为多字母族显式登记')
  assert.equal(rp.name, 'RP')
  assert.equal(rp.multiLetter, true)
  assert.equal(rp.segmentWidth, LEASE_SEGMENT_SIZE)
  assert.equal(rp.poolMax, LEASE_POOL_MAX)
  assert.deepEqual(lookupPlanIdFamily('rp'), rp, '族名大小写归一必须落在同一族目')
  for (const unknown of ['AB', 'R-P', 'R.P', 'RP2', '']) {
    assert.equal(lookupPlanIdFamily(unknown), null, `${JSON.stringify(unknown)} 不得在册`)
  }
  assert.ok(PLAN_ID_FAMILY_NAMES.includes('RP'))
  assert.match(describeRegisteredFamilies(), /RP/)
})

test('RP 能取号:CLI 输出 RP-n 且在池 1..99 内', () => {
  const sha = fixedSource()
  const r = runCli([SCRIPT, '--next-only', '--family', 'RP', '--source', sha])
  assert.equal(r.status, 0, `RP 取号失败(stderr=${r.stderr.trim()})`)
  assert.match(r.stdout.trim(), /^RP-(\d+)$/, `输出形状必须是 RP-n,实得 ${JSON.stringify(r.stdout.trim())}`)
  const n = Number(r.stdout.trim().slice(3))
  assert.ok(n >= 1 && n <= LEASE_POOL_MAX, `发出号必须落在池内 1..${LEASE_POOL_MAX},实得 ${n}`)
})

test('越界拒发点名:RP 池 1..99 全占 ⇒ 不返池外号,拒绝行点名「绝不发 >99」', () => {
  const used = Array.from({ length: LEASE_POOL_MAX }, (_, i) => `RP-${i + 1}`)
  assert.equal(
    smallestFreeId({ usedNumbers: used.map((s) => Number(s.slice(3))), poolMax: LEASE_POOL_MAX }),
    null,
    '池满时分配器必须返回 null,不得回落到 100(池外号)',
  )
  const line = describePoolExhaustion({ reason: POOL_EXHAUST_REASON.poolFull, poolMax: LEASE_POOL_MAX })
  assert.match(line, new RegExp(`绝不发 >${LEASE_POOL_MAX} 的号`), '拒绝行必须点名池上限')
  assert.match(line, new RegExp(`池 1..${LEASE_POOL_MAX}`), '拒绝行必须给出池读数')
})

test('未知族仍拒:CLI --family AB ⇒ exit 2 且点名未登记', () => {
  const sha = fixedSource()
  const r = runCli([SCRIPT, '--next-only', '--family', 'AB', '--source', sha])
  assert.equal(r.status, 2, '未登记族必须 exit 2,不得静默退回缺省族')
  assert.equal(r.stdout.trim(), '', '拒发时不得向 stdout 打印任何号')
  assert.match(r.stderr, /未登记|在册|注册表/, `拒绝文案必须点名族注册表,实得 ${JSON.stringify(r.stderr)}`)
})

test('单字母族行为逐字不变:HEAD 版与当前版 CLI stdout 字节相同(O/Z)', () => {
  const sha = fixedSource()
  const headSrc = spawnSync('git', ['show', 'HEAD:scripts/next-plan-id.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(headSrc.status, 0, '取 HEAD 版 next-plan-id.mjs 失败')
  for (const family of ['O', 'Z']) {
    const cur = runCli([SCRIPT, '--next-only', '--family', family, '--source', sha])
    // HEAD 版经 stdin 执行:`scripts/` 作为 cwd ⇒ 相对 import 解析到同一组 lib。
    const head = runCli(['--input-type=module', '-', '--next-only', '--family', family, '--source', sha], {
      cwd: join(ROOT, 'scripts'),
      input: headSrc.stdout,
    })
    assert.equal(cur.status, 0, `当前版 ${family} 取号失败:${cur.stderr.trim()}`)
    assert.equal(head.status, 0, `HEAD 版 ${family} 取号失败:${head.stderr.trim()}`)
    assert.equal(cur.stdout, head.stdout, `${family} 族:HEAD 与当前 stdout 必须逐字相同`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
