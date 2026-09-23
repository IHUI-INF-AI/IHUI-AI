// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90 的镜像测试(§22c):直接 import 源脚本的 __test__,不复制判据实现。
// 重点是两条"造门时就踩过"的反例:名字判据不得误伤他人工具态,以及 TEMP 漂移必须能被识别。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-c-drive-pollution.mjs'

// 编号唯一性:同日多会话在同一位置各加一道门必然撞号。本门实测撞了两次 ——
// 先与并行会话的 check-test-paths 同为 85(改 90),而 90 又被 ce261e1a8 的
// check-sse-dispatch-parity 占用;更糟的是"整文件提交 guardian-runner.mjs"把那道门的
// 注册块直接覆盖掉了(提交 5db08f26e),已按原文回插并把本门改到 91。
// 这条断言把两种失败都钉成红:编号出现次数 ≠ 1、或本门根本没接入 runner。
test('本门编号在 guardian-runner 中必须出现恰好一次', () => {
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'guardian-runner.mjs'),
    'utf8',
  )
  const hits = runner.match(/id: '91'/g) || []
  assert.equal(hits.length, 1, `id 91 出现 ${hits.length} 次(应为 1 次;撞号即说明两道门抢同一编号)`)
  assert.match(runner, /script: 'check-c-drive-pollution\.mjs'/, '本门未接入 runner')
  // 反向:不得有任何一道门被本文件"顶掉"后只剩编号没有脚本
  assert.match(runner, /script: 'check-sse-dispatch-parity\.mjs'/, '守门 90(SSE)注册块缺失')
})

test('盘根 IHUI- 前缀与 .empty-tmp / .pnpm-store 判为自有', () => {
  assert.ok(G.classifyRoot('IHUI-probe-tail.ps1'))
  assert.ok(G.classifyRoot('.empty-tmp'))
  assert.ok(G.classifyRoot('.empty-tmp2'))
  assert.ok(G.classifyRoot('.pnpm-store'))
})

test('系统条目与白名单目录不得判为我们的', () => {
  for (const n of ['Windows', 'Program Files', 'ProgramData', 'Users', 'Recovery', 'pagefile.sys']) {
    assert.equal(G.classifyRoot(n), null, `${n} 被误判为自有`)
  }
  assert.ok(G.FOREIGN_ROOT.has('tools'), 'tools 未登记为外来条目')
})

test('Temp 里只认我们的前缀,他人随机名一律放过', () => {
  assert.ok(G.classifyTmp('ihui-origin-Ab12Cd'))
  assert.ok(G.classifyTmp('next-backup-node22-20260918-094636'))
  assert.equal(G.classifyTmp('8f575ef0-6180-4c22-b1d4-4161278b643b.tmp'), null)
  assert.equal(G.classifyTmp('qoder-000b-cwd'), null, '宿主工具态被误判为本项目产物')
})

test('scanC 只读:结果含 temp 结论且两次一致', () => {
  const a = G.scanC()
  const b = G.scanC()
  assert.equal(a.ours.length, b.ours.length, '两次扫描数量漂移(本门不应改文件)')
  assert.ok(['ok', 'drift', 'unknown'].includes(a.temp.status), `TEMP 判定状态异常:${a.temp.status}`)
})

test('TEMP 漂移判据:注册表与进程不一致必须报 drift', () => {
  const r = G.detectTempDrift()
  if (r.status === 'drift') {
    assert.notEqual(r.proc, r.declared, 'drift 却给出相同路径')
    assert.ok(r.declared, 'drift 判定要求注册表值可读')
  } else if (r.status === 'ok') {
    assert.equal(r.proc.toLowerCase().replace(/[\\/]+$/, ''), r.declared.toLowerCase().replace(/[\\/]+$/, ''))
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
