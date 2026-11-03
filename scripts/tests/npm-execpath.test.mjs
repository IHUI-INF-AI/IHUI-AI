// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/npm-execpath.mjs` 的镜像测试(2026-10-14 立)。
 *
 * 判据不在此复制:一律 import 生产实现(AGENTS.md §22c)。
 * 本用例锁的是"把原生可执行文件当 JS 模块交给 node 加载"这一静默失效形态 ——
 * 它曾同时打断 dev 与 build 两条桌面端入口,且两处是各自独立抄的同一份判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as npmExecpath } from '../lib/npm-execpath.mjs'

const NODE = 'C:\\nodejs\\node.exe'
const { planPackageManagerSpawn: plan } = npmExecpath

/** 本机 pnpm 11 的真实取值形态:原生 exe,不是 JS 文件 */
const PNPM_EXE =
  'D:\\pnpm-home\\package-manager-store\\v11\\links\\@pnpm\\exe\\11.18.0\\d225868c\\node_modules\\@pnpm\\exe\\pnpm.exe'
/** npm 的形态:可被 node 加载的 JS 入口 */
const NPM_JS = 'C:\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'

test('npm_execpath 是 .exe 时绝不可交给 node 直载 —— 本判据存在的全部理由', () => {
  const p = plan(PNPM_EXE, NODE)
  assert.notEqual(p.cmd, NODE, '把 pnpm.exe 交给 node 加载 = ERR_UNKNOWN_FILE_EXTENSION,入口必死')
  assert.equal(p.cmd, 'pnpm')
  assert.deepEqual(p.prefix, [], '不得把 .exe 路径塞进参数首位当模块名')
  assert.equal(p.shell, true, '裸 `pnpm` 要靠 shell 解析 Windows 上的 shim')
})

test('.cmd 形态同样不得交给 node', () => {
  const p = plan('D:\\pnpm\\global\\pnpm.cmd', NODE)
  assert.notEqual(p.cmd, NODE)
  assert.equal(p.cmd, 'pnpm')
  assert.equal(p.shell, true)
})

test('npm_execpath 是 .c?js 入口时走 node 直载(npm 的既有形态,不得回退)', () => {
  for (const entry of [NPM_JS, 'D:\\npm\\bin\\npm-cli.cjs', 'D:\\npm\\bin\\npm-cli.mjs']) {
    const p = plan(entry, NODE)
    assert.equal(p.cmd, NODE, `${entry} 应当可被 node 直载`)
    assert.deepEqual(p.prefix, [entry])
    assert.equal(p.shell, false)
  }
})

test('npm_execpath 未设(直接 node 跑调用方脚本)⇒ shell + 裸 pnpm', () => {
  const p = plan(undefined, NODE)
  assert.equal(p.cmd, 'pnpm')
  assert.deepEqual(p.prefix, [])
  assert.equal(p.shell, true)
})

test('空串不得被当成 JS 入口(否则 cmd 会指向空)', () => {
  const p = plan('', NODE)
  assert.equal(p.cmd, 'pnpm')
  assert.deepEqual(p.prefix, [])
})

test('扩展名判定大小写不敏感,且不被路径中其它 ".js" 子串骗过', () => {
  assert.equal(plan('D:\\A\\PNPM-JS\\x.JS', NODE).cmd, NODE, '结尾 .JS 大写仍应认')
  // 目录名里带 .js 而文件本体是 exe:必须判成"不可直载"
  assert.equal(plan('D:\\a.js\\pnpm.exe', NODE).cmd, 'pnpm')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
