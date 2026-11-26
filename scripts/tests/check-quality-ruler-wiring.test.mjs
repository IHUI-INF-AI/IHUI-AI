// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:门 328 的判据一律 import 源文件 __test__,本文件零复制判据(§22c / 守门 191)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const { __test__: G } = await import('../check-quality-ruler-wiring.mjs')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const rel = (p) => p.split(path.sep).join('/')

test('源门自检全绿(自检用真判据本体,不是测试里的第二份)', () => {
  const logs = []
  const orig = console.log
  console.log = (...a) => logs.push(a.join(' '))
  try {
    assert.equal(G.selfTest(), 0, `门体自检未过:\n${logs.join('\n')}`)
  } finally {
    console.log = orig
  }
  assert.ok(logs.some((l) => l.includes('SELF-TEST PASS')), '自检必须给出显式 PASS 行')
})

test('头注承诺的四处宿主调用与判据表逐字同源(防文档漂到实现前面)', () => {
  assert.deepEqual(G.REQUIRED_HOST_TOKENS, [
    'autonomy-quality.mjs',
    'resolveQualityConfig(',
    'runRuler(',
    'buildQualityLedgerRow(',
    'readQualityHold(',
  ])
  assert.ok(G.ENTRY_ALLOWLIST.includes(G.WIRING_HOST))
  assert.ok(G.ENTRY_ALLOWLIST.includes(G.WIRING_LIB))
  assert.ok(G.ENTRY_ALLOWLIST.includes('scripts/check-quality-ruler-wiring.mjs'), '本门自身必须豁免,否则提示文案自打 finding')
})

test('真·当前树满足三条判据(接线在位 / 题库未入库 / 入口唯一)', () => {
  const host = readFileSync(path.join(ROOT, rel(G.WIRING_HOST)), 'utf8')
  const lib = readFileSync(path.join(ROOT, rel(G.WIRING_LIB)), 'utf8')
  assert.equal(G.judgeWiring({ libPresent: true, hostPresent: true, hostText: host }).state, 'ok')
  const files = [G.WIRING_HOST, G.WIRING_LIB, 'scripts/data/auto-evolve-gates.json', 'apps/ai-service/app/services/private_eval_store.py']
  assert.equal(G.judgeSecrecy(files).state, 'ok')
  assert.equal(G.judgeSingleEntry({ [G.WIRING_HOST]: host, [G.WIRING_LIB]: lib, 'scripts/guardian-runner.mjs': readFileSync(path.join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8') }).state, 'ok', 'runner 的注册提示文本不得被读成第二入口')
})

test('拆线两型必须仍被抓到(收紧 Q3 后 Q1 不许一起变松)', () => {
  const host = readFileSync(path.join(ROOT, rel(G.WIRING_HOST)), 'utf8')
  assert.equal(G.judgeWiring({ libPresent: true, hostPresent: true, hostText: host.replace('runRuler(', '') }).state, 'finding')
  assert.equal(G.judgeWiring({ libPresent: true, hostPresent: true, hostText: host.replace(/readQualityHold\(/g, '') }).state, 'finding')
  assert.equal(G.judgeWiring({ libPresent: true, hostPresent: true, hostText: host.replace(/autonomy-quality\.mjs/g, '别的什么') }).state, 'finding', '宿主连 lib 都不 import 了 ⇒ 必须抓到')
  assert.equal(G.judgeWiring({ libPresent: true, hostPresent: true, hostText: host.replace(/buildQualityLedgerRow\(/g, '') }).state, 'finding', '记账出口被摘 ⇒ 必须抓到')
})

test('题库真入库的两条路径都要抓到(数据集与趋势账同级)', () => {
  assert.equal(G.judgeSecrecy(['apps/ai-service/data/pairwise-dataset.jsonl']).state, 'finding')
  assert.equal(G.judgeSecrecy(['scripts/pairwise-trend.jsonl']).state, 'finding')
  assert.equal(G.judgeSecrecy(['apps/ai-service/app/services/private_eval_store.py']).state, 'ok')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
