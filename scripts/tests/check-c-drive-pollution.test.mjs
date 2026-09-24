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

// 编号唯一性:同日多会话在同一位置各加一道门必然撞号。本门一天内撞了三次 ——
// 85(与 check-test-paths)→ 90(与 check-sse-dispatch-parity)→ 91(与
// check-error-code-coverage),最终落 92。所以断言**不硬写编号**:先从 runner 里反查
// "本门脚本所在注册块的 id",再要求那个 id 全文件唯一。硬写编号的写法下次重排就又红了
// (或更糟:悄悄通过)。
test('本门编号在 guardian-runner 中必须唯一(反查 id,不硬写编号)', () => {
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'guardian-runner.mjs'),
    'utf8',
  )
  const block = runner.match(
    /\{\s*\n\s*id: '([0-9]+[a-z]?)',[\s\S]{0,400}?script: 'check-c-drive-pollution\.mjs'/,
  )
  assert.ok(block, '本门未接入 runner(找不到 id→script 相邻的注册块)')
  const myId = block[1]
  const hits = runner.match(new RegExp(`id: '${myId}'`, 'g')) || []
  assert.equal(hits.length, 1, `id ${myId} 出现 ${hits.length} 次 ⇒ 与别的门撞号,注册块可能互相顶掉`)

  const ids = [...runner.matchAll(/^\s{4}id: '([0-9a-z]+)',$/gm)].map((m) => m[1])
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))]
  assert.deepEqual(dupes, [], `runner 存在重号: ${dupes.join(', ')}`)

  // 邻门注册块不得因"整文件提交"而缺失(本仓实测踩过,见提交 5db08f26e 的修复)
  for (const neighbor of [
    'check-sse-dispatch-parity.mjs',
    'check-test-paths.mjs',
    'check-error-code-coverage.mjs',
  ]) {
    assert.ok(runner.includes(`script: '${neighbor}'`), `邻门 ${neighbor} 的注册块缺失`)
  }
})

test('盘根 IHUI- 前缀与 .empty-tmp / .pnpm-store 判为自有', () => {
  assert.ok(G.classifyRoot('IHUI-probe-tail.ps1'))
  assert.ok(G.classifyRoot('.empty-tmp'))
  assert.ok(G.classifyRoot('.empty-tmp2'))
  assert.ok(G.classifyRoot('.pnpm-store'))
})

test('盘根单字母目录 = MSYS 路径错位指纹;单字母文件与系统目录都不判', () => {
  // 实测成因:C:\c 是 2026-08-06 把 /c/tmp/... 当相对路径用套出来的,内藏 515MB
  assert.ok(G.classifyRootEntry('c', true), 'C:\\c 这类错位目录必须被识别')
  assert.equal(G.classifyRootEntry('c', false), null, '单字母文件不得判(宁漏不误报)')
  assert.equal(G.classifyRootEntry('Windows', true), null, '系统目录误判')
  assert.ok(G.classifyRootEntry('IHUI-probe-tail.ps1', false), '既有 IHUI- 规则须仍生效')
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
