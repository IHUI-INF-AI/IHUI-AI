// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「顶部状态栏避让单一源头」的 §22c 镜像测试。
 *
 * 与 --self-test 的分工:self-test 验**判据**;本文件验**接线**——
 * 判据存在而永不调用 = 没有(守门 70/76/81 的同型教训)。故这里全是"门是否真装上车"的断言。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-statusbar-single-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')

test('源脚本必须 export __test__ 且含核心判据(§22c phase B)', () => {
  for (const k of ['scan', 'stripComments', 'findMagicPads', 'SECOND_SOURCE_RE', 'MECHANISM_FILE']) {
    assert.ok(k in gate, `__test__ 缺 ${k}`)
  }
})

test('本门编号在 runner 中必须出现恰好一次(防撞号)', () => {
  const ids = [...RUNNER.matchAll(/^\s*id: '(\d+)',/gm)].map((m) => m[1])
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual([...new Set(dupes)], [], `runner 存在重复编号:${[...new Set(dupes)].join(',')}`)
  assert.equal(ids.filter((v) => v === '97').length, 1, 'id 97 必须恰好注册一次')
})

test('装车证明:runner 里必须真有 blocking + skipEnv + script(缺一即门未上车)', () => {
  const block = RUNNER.slice(RUNNER.indexOf("id: '97'"))
  const body = block.slice(0, block.indexOf("onFailHint:") + 400)
  assert.match(body, /script:\s*'check-statusbar-single-source\.mjs'/, 'script 未注册')
  assert.match(body, /mode:\s*'blocking'/, '未设为 blocking')
  assert.match(body, /skipEnv:\s*'HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE'/, '缺应急通道声明')
})

test('扫描面必须覆盖共享屏层与端内层(否则判据看不见 83 处债务所在)', () => {
  assert.deepEqual(gate.SCAN_DIRS, ['packages/app/src', 'apps/mobile-rn/src'])
  for (const d of gate.SCAN_DIRS) assert.ok(existsSync(join(ROOT, d)), `扫描面目录不存在:${d}`)
})

test('机制文件路径必须真的存在(路径漂移会让 S1 恒报"取不到")', () => {
  assert.equal(gate.MECHANISM_FILE, 'apps/mobile-rn/App.tsx')
  assert.ok(existsSync(join(ROOT, gate.MECHANISM_FILE)))
})

test('判据语义回归:48 计红 / insets.top 与 12 不计 / 块注释不判红', () => {
  assert.equal(gate.findMagicPads('  header: { paddingTop: 48, height: 44 },').length, 1)
  assert.equal(gate.findMagicPads('  header: { paddingTop: insets.top }').length, 0)
  assert.equal(gate.findMagicPads('  card: { paddingTop: 12 }').length, 0)
  assert.equal(gate.SECOND_SOURCE_RE.test(gate.stripComments('/* 说明 */ const h = StatusBar.currentHeight')), true)
  assert.equal(gate.SECOND_SOURCE_RE.test(gate.stripComments('/**\n * a\n   再加一次 StatusBar.currentHeight 会推歪 */')), false)
})

test('AGENTS.md 与 README 必须点名本门(守门 89 R4:判据在而文档不点名即拦)', () => {
  for (const doc of ['AGENTS.md', 'README.md']) {
    const text = readFileSync(join(ROOT, doc), 'utf8')
    assert.ok(
      /check-statusbar-single-source/.test(text),
      `${doc} 未登记本门 —— R4 会判红,且后人无从知道顶距该往哪写`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
