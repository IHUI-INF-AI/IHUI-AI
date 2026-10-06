#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‍‍‌‌‌‌‍‍‌‍‍‌‌‌‌‌‌‌‌‍‍‌‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‍‌‌‌‌‍‍‍‌‍‬‍‍‌‌‌‌‌‌‌‌‍‍‌‌‍⁠

/**
 * `check-i18n-broken-en.mjs --target` fail-closed 的判据测试。
 *
 * ## 这个门原本的缺陷（为什么值得有测试）
 * 修前: `--target=api` / `--target=zzz` / 不带参数 三种跑法**输出逐字相同**、都报
 * `✅ 通过`。因为 target 只用来算isExtension / isShared 两个布尔，剩下的全落进
 * 无条件 `else` 分支去扫 web。后果:给一个不存在的 target,门会回"通过" ⇒ **假绿**。
 * 守门脚本的假绿比不判更糟:它会把"这个面没人管"伪装成"这个面没问题"。
 *
 * ## 为什么测在CLI 层而不是抽纯函数
 * 本脚本是 `main()` 直调、无导出(仓库既有形态)。这里刻意**不**为可测性去改它的结构——
 * 这个门真实的风险面是"命令行跑起来会不会说假话",不是某个内部函数返回值。
 * 所以测试直接起子进程、断言 **退出码 + 首行输出**,这与守门在runner 里的实际用法同形。
 *
 * ## 判据两条腿
 *   - 反向防线:未知 target ⇒ 非零退出 **且** 输出里不含"通过"(防回落假绿复发)
 *   - 防锁死:三个合法 target + 默认行为仍能正常跑(防把门焊死成"永远报错")
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'check-i18n-broken-en.mjs')

/** 跑一次本门，返回 { code, first, all } —— first 只取首行,避免多行错误信息干扰断言。 */
function runGate(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    // 这个门不吃 stdin —— 不显式 ignore 会在 Windows 上偶发 EBUSY(仓库已知病症)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const all = `${r.stdout || ''}${r.stderr || ''}`
  return { code: r.status, first: (all.split('\n')[0] || '').trim(), all }
}

const SUPPORTED = ['web', 'extension', 'shared']

// ---- 反向防线:未知 target 必须拒绝,绝不静默回落 ----

test('未知 target 非零退出(修前此处是假绿)', () => {
  const r = runGate(['--target=zzz'])
  assert.notEqual(r.code, 0, '未知 target 必须非零退出')
})

test('未知 target 的输出不得出现"通过"(这条直接钉住假绿)', () => {
  const r = runGate(['--target=zzz'])
  assert.ok(
    !r.all.includes('通过'),
    `未知 target 的输出里出现"通过" = 假绿回来了。实际输出:\n${r.all}`,
  )
})

test('未知 target 的输出必须点明它被拒绝、且列出受支持清单', () => {
  const r = runGate(['--target=zzz'])
  assert.match(r.all, /未知/, '应说明这是未知 target')
  assert.match(r.all, /web/, '应列出受支持的 target,便于调用方自查')
})

test('真实存在但本门未覆盖的 target 同样必须被拒(不得回落)', () => {
  // api / cli / miniapp-taro / mobile-rn 在 packages/i18n/messages/ 下确实有 en.json,
  // 但本脚本没接这4 面。落进"静默扫 web"是最坏结果:它会替这4 个面背书"没问题"。
  for (const t of ['api', 'cli', 'miniapp-taro', 'mobile-rn']) {
    const r = runGate([`--target=${t}`])
    assert.notEqual(r.code, 0, `--target=${t} 必须非零退出`)
    assert.ok(!r.all.includes('通过'), `--target=${t} 回落假绿`)
  }
})

test('空 target(--target=)不得被当成 web 放行', () => {
  const r = runGate(['--target='])
  assert.notEqual(r.code, 0, '空 target 必须拒绝,不能回落成默认 web')
})

test('带多余后缀的 target(--target=web=extra)必须拒绝,不得截断成 web', () => {
  // 这条是**解析层**的牙,不是白名单的牙 —— 白名单本身对 `'web=extra'` 就会拒绝,
  // 所以它抓不到解析退化。真正能区分两种解析写法的是这个形状:
  //   targetArg.split('=')[1]→ 'web'      (截断后**放行**)
  //   targetArg.slice(9)              → 'web=extra' (完整取值后拒绝)
  // 变异实测:把解析改回 split('=')[1] 时,本条会红;只动白名单不动解析时,本条仍绿。
  const r = runGate(['--target=web=extra'])
  assert.notEqual(r.code, 0, '--target=web=extra 必须被拒绝,不得截断成 web 放行')
  assert.ok(!r.all.includes('通过'), '--target=web=extra 不得回出"通过"')
})

// ---- 防锁死:合法路径必须仍然能跑 ----

test('三个受支持 target 仍能正常跑(防把门焊死)', () => {
  for (const t of SUPPORTED) {
    const r = runGate([`--target=${t}`])
    assert.equal(r.code, 0, `--target=${t} 应正常退出,实际:\n${r.all}`)
    assert.match(r.all, /通过/, `--target=${t} 应给出结论`)
  }
})

test('不带 --target 的默认行为仍是 web(行为不得被本次修复改变)', () => {
  const bare = runGate([])
  const web = runGate(['--target=web'])
  assert.equal(bare.code, 0)
  assert.equal(
    bare.first,
    web.first,
    '默认跑法与 --target=web 的首行输出必须一致,否则说明默认值被改动过',
  )
})

test('受支持清单与文件头文档声明一致(防文档漂移成第二判据源)', () => {
  // 直接读源文件文本:本测试文件是 ESM,不能用 require(实测 require 在 -e 里拿不到 exports)。
  const src = readFileSync(SCRIPT, 'utf8')
  for (const t of SUPPORTED) {
    assert.ok(src.includes(t), `文件头文档未提及受支持 target: ${t}`)
  }
})