// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 247(check-ai-task-background-reference.mjs)镜像测试(§22c:判据一份,此处只 import 不重抄)。
// 跑法:node --test scripts/tests/check-ai-task-background-reference.test.mjs
// 锁三件事:
//  ① 判据行为(W1 必拒裸调 / 不得误拒合格形态 / doc 与注释出判 / 台账生命周期);
//  ② 未判定语义(取不到、射程 0、W3 装车缺失都必须落非零方向,绝不静默绿);
//  ③ 形状锁:被迁移文件真无残留裸调 + 出口 importer>0(读源码面,不读口头声称)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-ai-task-background-reference.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// ok(name, cond):cond 为函数 ⇒ 作为断言体执行(内部 assert);为布尔 ⇒ 直接断言真。
// 若把函数当 truthy 值断言,任何回调都恒绿 —— 假绿即失守,这里显式二相执行。
const ok = (name, condOrFn) =>
  test(name, () => {
    if (typeof condOrFn === 'function') return condOrFn()
    assert.ok(condOrFn, name)
  })

ok('__test__ 键齐备(源搬家即红)', ['scanFile', 'evaluate', 'findStaleExemptions', 'pyCodeLines', 'selfTest'].every((k) => typeof G[k] === 'function'))
ok('内置 selfTest 全绿', G.selfTest().length === 0)

ok('W1 必拒:三种裸调用', () => {
  assert.equal(G.scanFile('a.py', 'async def f():\n    asyncio.create_task(w())\n', []).bare.length, 1)
  assert.equal(G.scanFile('a.py', 'async def f():\n    asyncio.ensure_future(w())\n', []).bare.length, 1)
  assert.equal(G.scanFile('a.py', 'async def f():\n    loop.create_task(w())\n', []).bare.length, 1)
})

ok('W1 不得误拒:合格形态族', () => {
  assert.equal(G.scanFile('a.py', 'async def f():\n    spawn(w())\n', []).bare.length, 0)
  assert.equal(G.scanFile('a.py', 'async def f():\n    t = asyncio.create_task(w())\n', []).bare.length, 0)
  assert.equal(G.scanFile('a.py', 'async def f():\n    xs=[\n        asyncio.create_task(a()),\n    ]\n', []).bare.length, 0)
})

ok('def 头豁免但体内裸调仍判', () => {
  const r = G.scanFile('a.py', 'async def create_task(x):\n    return asyncio.ensure_future(y())\n', [])
  // 第 2 行体内 ensure_future 无赋值无 spawn ⇒ 必拒
  assert.equal(r.bare.length, 1)
})

ok('注释/doc 出判', () => {
  assert.equal(G.scanFile('a.py', '# asyncio.create_task(x)\nx=1\n', []).bare.length, 0)
  assert.equal(G.scanFile('a.py', 'def f():\n    """见 asyncio.create_task(x)\n    续"""\n    return 1\n', []).bare.length, 0)
})

ok('台账生命周期:过期判红 + marker 消失=腐烂点名', () => {
  const ex = [{ file: 'a.py', marker: 'w()', reason: 'r', until: '2000-01-01' }]
  assert.equal(G.scanFile('a.py', 'asyncio.create_task(w())\n', ex, '2026-01-01T00:00:00Z').bare.length, 1)
  assert.equal(G.findStaleExemptions(ex, () => 'no w here').length, 1)
  assert.equal(G.findStaleExemptions(ex, () => 'has w()').length, 0)
})

ok('未判定方向正确:取不到/射程0/W3缺 ⇒ 非绿', () => {
  assert.ok(G.evaluate([], [], () => null).undetermined)
  assert.ok(G.evaluate([['apps/ai-service/x.py', null]], [], () => null).undetermined)
  const r = G.evaluate([['apps/ai-service/app/s.py', 'import asyncio\n']], [], (f) => (f.endsWith('background_tasks.py') ? null : 'x'))
  assert.ok(r.w3fail || r.violations.length >= 0)
  assert.ok(r.w3fail, '出口缺失必须 w3fail')
})

ok('形状锁:被迁移三文件无裸 create_task', () => {
  for (const p of ['app/services/workflow_engine.py', 'app/routers/llm.py', 'app/services/mcp_client.py']) {
    const t = readFileSync(path.join(ROOT, 'apps/ai-service', p), 'utf8')
    // 允许 spawn( 包裹;禁止裸 asyncio./loop. create_task 且同行无 = spawn
    for (const line of t.split(/\r?\n/)) {
      if (/\.create_task\(/.test(line) && !/=\s/.test(line) && !/spawn\s*\(/.test(line) && !/^\s*#/.test(line))
        assert.fail(`${p} 残留裸 create_task: ${line.trim().slice(0, 60)}`)
    }
  }
})

ok('形状锁:出口 importer 数与 gate HEAD 现读一致(装车非声称)', () => {
  const out = execFileSync('git', ['grep', '-l', 'background_tasks import', '--', 'apps/ai-service/app'], { cwd: ROOT, encoding: 'utf8' })
  const importers = out.split(/\r?\n/).filter(Boolean)
  assert.ok(importers.length >= 10, `importer ${importers.length} < 10 —— 迁移波没走完就别说收口`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
