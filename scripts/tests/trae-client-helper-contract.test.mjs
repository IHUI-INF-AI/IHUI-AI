// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
//
// 调用端↔被调端 参数契约测试(2026-11-16 立)。
// 立因:commit 79efa223c85 给 trae-client-process.mjs 加了 -KillPids 调用,却没给
// run-as-user.ps1 的 param 块加这个开关 ⇒ 一键切号真机报
// "A parameter cannot be found that matches parameter name 'KillPids'" 而回滚。
// 当时的单测全用注入的 run 替身,只验「调用端传了什么」,从不验「被调端认不认」——
// 于是"造好没装车"整条溜过。本测试从两份源码**现读**契约:
//   ① JS 实际传给 run-as-user.ps1 的 flag  ⊆  PS param 块定义的参数;
//   ② KillPids 在调用端仍在使用、在被调端有实现(param + C# 方法 + PS 分支)。
// 任一侧漂移都会红,不再依赖替身 selftest。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as T } from '../lib/trae-client-process.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HELPER = T.RUN_AS_USER_SCRIPT
const JS_SRC = fs.readFileSync(path.join(ROOT, 'scripts/lib/trae-client-process.mjs'), 'utf8')
const PS_SRC = fs.readFileSync(HELPER, 'utf8')

/** PS param 块里带类型声明的参数名(只认 [string]/[int]/[switch]$Xxx) */
function declaredParams(ps) {
  const block = /param\s*\(([\s\S]*?)\n\)/.exec(ps)
  assert.ok(block, 'run-as-user.ps1 必须能定位到 param 块')
  const names = new Set()
  for (const m of block[1].matchAll(/\[(?:string|int|switch)\]\s*\$(\w+)/g)) names.add(m[1])
  assert.ok(names.size > 0, 'param 块至少应解析出一个有类型的参数')
  return names
}

/** JS 里 -File helper 之后传给 run-as-user.ps1 的 flag 集合(排除 powershell.exe 自身的 -NoProfile 等) */
function flagsPassedToHelper(js) {
  const flags = new Set()
  let hits = 0
  for (const m of js.matchAll(/'-File',\s*helper,([\s\S]*?)\n[ \t]*\],/g)) {
    hits += 1
    for (const f of m[1].matchAll(/'(-\w+)'/g)) flags.add(f[1].slice(1))
  }
  assert.ok(hits >= 2, `应至少识别两处 helper 调用(终止腿 + 拉起腿),实得 ${hits}`)
  return flags
}

const psParams = declaredParams(PS_SRC)
const jsFlags = flagsPassedToHelper(JS_SRC)

test('JS 传给 run-as-user.ps1 的每个 flag 都在 PS param 块有定义(防再次造好没装车)', () => {
  const missing = [...jsFlags].filter((f) => !psParams.has(f))
  assert.deepEqual(
    missing,
    [],
    `这些 flag 被 JS 传给 helper 但 PS 不认 ⇒ 真机必报 parameter cannot be found: ${missing.join(', ')}`,
  )
})

test('终止腿与拉起腿 flags 均被识别(契约测试本身没瞎)', () => {
  for (const required of ['Exe', 'ArgJson', 'KillPids', 'WorkingDirectory', 'NoWait']) {
    assert.ok(jsFlags.has(required), `JS 调用端应传 -${required},实得 flags=${[...jsFlags].join(',')}`)
  }
})

test('KillPids 在被调端三处接线齐全:param 声明 + C# 方法 + PS 分支', () => {
  assert.ok(psParams.has('KillPids'), 'PS param 块必须声明 [switch]$KillPids')
  assert.match(PS_SRC, /public static string KillPids\(/, 'PS 内联 C# 必须有 KillPids 终止方法')
  assert.match(PS_SRC, /if \(\$KillPids\)/, 'PS 流程必须有 KillPids 执行分支')
  assert.match(PS_SRC, /\[IHUIUserProcess\]::KillPids\(/, 'PS 分支必须真的调用 C# KillPids(不能只留空壳)')
})
