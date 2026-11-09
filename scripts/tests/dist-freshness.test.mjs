// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-dist-freshness.mjs` 的镜像测试(§22c:判据 import 源脚本的 __test__,零复算)。
 * 夹具一律落 `mkScratch()`(§15b:不得 os.tmpdir()、不得落仓库树内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as DF } from '../check-dist-freshness.mjs'

const MIN = 60_000
const OLD = Date.now() - 90 * MIN
const NEW = Date.now() - 10 * MIN

/** 造一个最小 workspace:一个 dist 入口包 + 一个 src 入口包(可选缺 dist)。 */
function makeWorkspace(root, { withSrcEntryPkg = true, giveDist = true } = {}) {
  const mk = (pkg, files) => {
    for (const [rel, text] of Object.entries(files)) {
      const p = join(root, 'packages', pkg, rel)
      mkdirSync(join(p, '..'), { recursive: true })
      writeFileSync(p, text, 'utf8')
    }
  }
  mk('api-client', {
    'package.json': JSON.stringify({ name: '@ihui/api-client', main: './dist/index.js' }),
    'src/client.ts': 'export const x = 1\n',
  })
  utimesSync(join(root, 'packages/api-client/src/client.ts'), NEW / 1000, NEW / 1000)
  if (giveDist) {
    mk('api-client', { 'dist/index.js': 'export const x=1\n' })
    utimesSync(join(root, 'packages/api-client/dist/index.js'), OLD / 1000, OLD / 1000)
  }
  if (withSrcEntryPkg) {
    mk('auth', {
      'package.json': JSON.stringify({ name: '@ihui/auth', main: './src/index.ts' }),
      'src/index.ts': 'export const a = 1\n',
    })
    utimesSync(join(root, 'packages/auth/src/index.ts'), NEW / 1000, NEW / 1000)
  }
  return root
}

test('① dist 入口包:src 比 dist 新 ⇒ 判滞后,并给出分钟数', () => {
  const dir = mkScratch('df-')
  try {
    makeWorkspace(dir)
    const { rows, error } = DF.scanDistFreshness(dir, {})
    assert.equal(error, null)
    const ac = rows.find((r) => r.pkg === 'api-client')
    assert.equal(ac.state, 'lag', `应判滞后,实得 ${JSON.stringify(ac)}`)
    assert.ok(ac.lagMin > 60, `滞后分钟数应在 80 上下,实得 ${ac.lagMin}`)
    // 成对:src 入口的那枚包**不得**被判滞后(它本来就被当源码消费)
    const auth = rows.find((r) => r.pkg === 'auth')
    assert.equal(auth.state, 'ok')
    assert.match(auth.note, /源码消费/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('② 入口自述 dist 而 dist 取不到 ⇒ 未判定(不许冒充"没问题")', () => {
  const dir = mkScratch('df-')
  try {
    makeWorkspace(dir, { giveDist: false })
    const { rows } = DF.scanDistFreshness(dir, {})
    const ac = rows.find((r) => r.pkg === 'api-client')
    assert.equal(ac.state, 'unjudged', `应落未判定,实得 ${JSON.stringify(ac)}`)
    assert.equal(ac.lagMin, null, '未判定不得把分钟数写成 0(0 会被读成"不落后")')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('③ 阈值:同一样输入,阈值放宽到 120 分钟 ⇒ 不算滞后(阈值确实是消费方,不是装饰)', () => {
  const dir = mkScratch('df-')
  try {
    makeWorkspace(dir)
    const strict = DF.scanDistFreshness(dir, { maxAgeMin: 0 })
    const loose = DF.scanDistFreshness(dir, { maxAgeMin: 120 })
    assert.equal(strict.rows.find((r) => r.pkg === 'api-client').state, 'lag')
    assert.equal(loose.rows.find((r) => r.pkg === 'api-client').state, 'ok')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('④ packages 根取不到 ⇒ error 非空(主流程据此走 exit 2 未判定,不记绿)', () => {
  const dir = mkScratch('df-')
  try {
    const { rows, error } = DF.scanDistFreshness(join(dir, 'nope'))
    assert.equal(rows.length, 0)
    assert.match(String(error), /取不到/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑤ 入口形态判定:main / exports 字符串 / exports 对象 / src 入口 四态各自定档', () => {
  assert.equal(DF.entryPointsToDist({ main: './dist/index.js' }), true)
  assert.equal(DF.entryPointsToDist({ exports: './dist/index.mjs' }), true)
  assert.equal(
    DF.entryPointsToDist({
      exports: { '.': { import: './dist/client.js', types: './dist/client.d.ts' } },
    }),
    true,
  )
  assert.equal(DF.entryPointsToDist({ main: './src/index.ts' }), false)
  assert.equal(DF.entryPointsToDist({}), false, '两个字段都没有 ⇒ 不算 dist 入口(不冒充判过)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
