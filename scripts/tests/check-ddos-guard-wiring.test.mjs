// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DDoS 守卫接线对账的镜像测试(§22c:import 生产判据 __test__，零复制)。
// 立因同 AGENTS §0.9：防线被摘掉时 typecheck / 单测 / build 表现逐字同形，
// 所以"接线还在"这件事必须由本门 + 本锁钉住；本锁又必须住在每次提交都跑的那一层。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../check-ddos-guard-wiring.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const { evaluateWiring, isChecklistViable, pyAnchorInCode, anchorPresent, GUARD_SOURCES, WIRING } =
  __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

function faceOfRepo() {
  const files = new Map()
  for (const p of new Set([...GUARD_SOURCES, ...WIRING.map((w) => w.file)])) files.set(p, read(p))
  return files
}

test('真仓工作树面：四道闸全部在位(主判定零缺口)', () => {
  const { gaps } = evaluateWiring({ files: faceOfRepo() })
  assert.deepEqual(gaps, [], `接线缺口：${JSON.stringify(gaps)}`)
})

test('摘掉 register(httpConnGuard) 即翻红(成对夹具：接回即绿)', () => {
  const files = faceOfRepo()
  const key = 'apps/api/src/server.ts'
  const original = files.get(key)
  const mutated = original.replace('server.register(httpConnGuard', '// server.register(httpConnGuard')
  assert.notEqual(mutated, original, '夹具未命中(锚点形态漂了)')
  files.set(key, mutated)
  assert.ok(evaluateWiring({ files }).gaps.length > 0)
  files.set(key, original)
  assert.equal(evaluateWiring({ files }).gaps.length, 0)
})

test('删除 ws-guard 实现文件 ⇒ W1 点名(不是"少扫一个文件就过去")', () => {
  const files = faceOfRepo()
  files.delete('apps/api/src/plugins/ws-guard.ts')
  const gaps = evaluateWiring({ files }).gaps
  assert.ok(gaps.some((g) => g.kind === 'W1' && g.file === 'apps/api/src/plugins/ws-guard.ts'))
})

test('Python：整行 # 注释里的锚点不算接线；真代码行算', () => {
  assert.equal(pyAnchorInCode('# sio_conn_gate.allow_handshake(\n', 'sio_conn_gate.allow_handshake('), false)
  assert.equal(pyAnchorInCode('  x = sio_conn_gate.allow_handshake(ip)\n', 'sio_conn_gate.allow_handshake('), true)
})

test('Python：行尾 # 之后的锚点不算接线', () => {
  assert.equal(
    pyAnchorInCode('pass  # sio_conn_gate.acquire(\n', 'sio_conn_gate.acquire('),
    false,
  )
})

test('JS 面：注释里的锚点不算接线(守门 89 R1 同型)', () => {
  assert.equal(
    anchorPresent('apps/api/src/server.ts', '// await server.register(httpConnGuard)\n', 'server.register(httpConnGuard'),
    false,
  )
  assert.equal(
    anchorPresent('apps/api/src/server.ts', 'await server.register(httpConnGuard)\n', 'server.register(httpConnGuard'),
    true,
  )
})

test('main.py 的挂载行必须被认到(锁住 2026-10-28 那次的遮罩漂移)', () => {
  // JS 词法器扫 .py 会把这行抹成空白 ⇒ 门当场假红。这条锁住"Python 走按行档"这一处置本身。
  const text = read('apps/ai-service/app/main.py')
  assert.ok(anchorPresent('apps/ai-service/app/main.py', text, 'WsConnGuardMiddleware('))
})

test('清单为空/锚点被清空 ⇒ 判不成立(§0.3 判死不记绿)', () => {
  assert.equal(isChecklistViable([], []), false)
  assert.equal(isChecklistViable(GUARD_SOURCES, [{ file: 'x', anchors: [] }]), false)
  assert.equal(isChecklistViable(), true)
})

test('形状锁：runner 里 257 条目成套(blocking + skipEnv + 射程齐备)', () => {
  // 用"只剥注释、保留字符串"那一档：注册条目要认的东西(id/script/skipEnv 的值)本身就是字符串，
  // 连字符串一起抹的那档会把合规条目读成"没登记"(code-mask 头注记过同型)。
  const runner = maskComments(read('scripts/guardian-runner.mjs'))
  const block = runner.split("id: '257'")[1]
  assert.ok(block, '257 未登记进 guardian-runner(= 造好没装车)')
  const entry = block.slice(0, block.indexOf('onFailHint'))
  assert.match(entry, /script: 'check-ddos-guard-wiring\.mjs'/)
  assert.match(entry, /mode: 'blocking'/)
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_DDOS_GUARD_WIRING'/)
  assert.match(entry, /stagedTriggers: \[/)
})

test('形状锁：注册条目 id 不得重复(门 89 R5 同判据，剥注释后数)', () => {
  // 注释里那句 grep 示例("id: '186'")曾被本锁的原文正则读成第二条注册条目 ⇒ 假阳。
  // 数的是**注册对象**，不是文档提到的编号。
  const runner = maskComments(read('scripts/guardian-runner.mjs'))
  const ids = [...runner.matchAll(/^ {2,6}id: '(\d+)'/gm)].map((m) => m[1])
  assert.ok(ids.length > 100, `解析到的注册条目数异常(${ids.length})—— 判据自身坏了，不据此出绿`)
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(dup, [], `重复 id：${dup.join(', ')}`)
  assert.equal(ids.filter((v) => v === '257').length, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
