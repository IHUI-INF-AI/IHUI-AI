// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/run-script-tests.test.mjs — 全量镜像测试入口自身的取证。
 *
 * 钉的是它的**反假绿**职责(一个"跑测试的人"如果自己在假绿,比没有更危险):
 *  ① 发现 0 个文件 ⇒ 必须判红(目录漂移不等于"全过");
 *  ② TAP 计数缺失 ⇒ 必须按失败计(runner 崩了不等于测试过了);
 *  ③ 切片不得丢文件(Windows argv 长度上限下的 ENAMETOOLONG 静默少跑)。
 * 全部在 mkScratch 隔离目录里端到端取证,不往真仓 scripts/tests/ 丢临时文件(§25)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as rt } from '../run-script-tests.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { discover, buildChunks, parseTap, main } = rt

const PASS_TAP = ['# Subtest: a', 'ok 1 - a', '# tests 3', '# pass 3', '# fail 0', '# skip 1'].join(
  '\n',
)
const RED_TAP = ['not ok 1 - 某门判据回归', '# tests 2', '# pass 1', '# fail 1'].join('\n')

test('parseTap:正常汇总取到计数,并把 not ok 名字提出来', () => {
  const p = parseTap(PASS_TAP)
  assert.equal(p.parsed, true)
  assert.deepEqual([p.tests, p.pass, p.fail, p.skipped], [3, 3, 0, 1])
  assert.deepEqual(p.notOk, [])
  const r = parseTap(RED_TAP)
  assert.equal(r.fail, 1)
  assert.deepEqual(r.notOk, ['某门判据回归'])
})

test('parseTap(反假绿核心):只有崩溃残迹、没有计数 ⇒ parsed:false,不得当成 0 失败', () => {
  for (const raw of ['', 'node:internal/modules/cjs/loader:255\nboom', '# tests 0', undefined]) {
    const p = parseTap(raw)
    assert.equal(p.parsed, false, `输入 ${JSON.stringify(raw)} 必须算"未真正运行"`)
  }
  // 只有 fail 没有 pass 也算取到结论(不能因为缺一个键就判"没跑")
  assert.equal(parseTap('# fail 0').parsed, true)
})

test('buildChunks:任何 limit 下都不得丢文件(ENAMETOOLONG 型静默少跑的正面判据)', () => {
  const files = Array.from(
    { length: 40 },
    (_, i) => `scripts/tests/x${String(i).padStart(2, '0')}.test.mjs`,
  )
  for (const limit of [6000, 200, 60]) {
    const chunks = buildChunks(files, limit)
    assert.deepEqual(chunks.flat(), files, `limit=${limit} 时丢/重排了文件`)
  }
  assert.equal(buildChunks(files, 6000, true).length, files.length, '--serial 必须一片一个')
  assert.equal(buildChunks([], 6000).length, 0)
  // 变异对照:正常 limit 下确实切成多片(否则上面的"不丢文件"是空判据)
  assert.ok(buildChunks(files, 200).length > 1, 'limit=200 必须切片,否则本用例什么都没测')
})

test('discover:只认 *.test.mjs、排序稳定,目录不存在=空集', () => {
  const dir = mkScratch('ihui-rst-')
  try {
    mkdirSync(join(dir, 'scripts', 'tests'), { recursive: true })
    for (const n of ['b.test.mjs', 'a.test.mjs', 'helper.mjs', 'c.test.ts']) {
      writeFileSync(join(dir, 'scripts', 'tests', n), 'export {}\n', 'utf8')
    }
    const found = discover(dir).map((f) => f.split(/[\\/]/).pop())
    assert.deepEqual(found, ['a.test.mjs', 'b.test.mjs'], '.test.ts 与 helper.mjs 不得入列')
    assert.deepEqual(discover(dir, ['zzz']), [], '过滤后为空必须真是空集')
    assert.deepEqual(discover(join(dir, 'nope')), [], '目录不存在 ⇒ 空集(交给 main 判红)')
  } finally {
    rmScratch(dir)
  }
})

test('main(端到端):隔离目录 0 个测试 ⇒ 判红;放一个真测试 ⇒ 判绿', () => {
  const dir = mkScratch('ihui-rst-main-')
  try {
    mkdirSync(join(dir, 'scripts', 'tests'), { recursive: true })
    assert.equal(main([], dir), 1, '一个测试都没发现时必须 exit 1,不得静默变绿')
    assert.equal(main(['--', 'nosuch'], dir), 1, '过滤后为空同样必须 exit 1')
    writeFileSync(
      join(dir, 'scripts', 'tests', 'sample.test.mjs'),
      "import { test } from 'node:test'\ntest('sample ok', () => {})\n",
      'utf8',
    )
    assert.equal(main([], dir), 0, '有一个真通过的测试 ⇒ 0')
    // 再放一个必红的:整体必须判红,且不得因"有一片绿"而被抵掉
    writeFileSync(
      join(dir, 'scripts', 'tests', 'bad.test.mjs'),
      "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\ntest('sample bad', () => assert.equal(1, 2))\n",
      'utf8',
    )
    assert.equal(main([], dir), 1, '任一片红必须整体红')
  } finally {
    rmScratch(dir)
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
