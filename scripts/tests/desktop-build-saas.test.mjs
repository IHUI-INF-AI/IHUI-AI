// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/desktop-build-saas.mjs` 的 buildPlan 执行器选择镜像测试(2026-10-14 立)。
 *
 * 判据不在此复制:一律 import 生产实现 `__test__.buildPlan`(AGENTS.md §22c)。
 *
 * 本用例锁的是一条**静默失效**形态:`npm_execpath` 不保证是 JS 入口 —— pnpm 11/Windows
 * 下它是 `pnpm.exe` 本体路径。把它交给 `process.execPath`(node)当模块加载,
 * 直接 `ERR_UNKNOWN_FILE_EXTENSION ".exe"` 退出 1,于是 `pnpm build:desktop:saas`
 * 这条**发版入口**整个起不来,而失败信息里没有一个字提到"入口"。
 * 同型缺陷已于 2026-10-14 在 desktop-dev-saas.mjs 上实测炸掉 dev 入口(修于 6160e47bb1);
 * 本函数当时是同一字形,故补此锁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as saasBuild } from '../desktop-build-saas.mjs'

const NODE = process.execPath

/** 本机 pnpm 11 的真实取值形态(装完即此路径,不是 JS 文件) */
const PNPM_EXE =
  'D:\\pnpm-home\\package-manager-store\\v11\\links\\@pnpm\\exe\\11.18.0\\d225868c\\node_modules\\@pnpm\\exe\\pnpm.exe'
/** npm 的形态:确实是可被 node 加载的 JS 入口 */
const NPM_JS = 'C:\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'

const plan = (npmExecpath, allowUnsigned = false) =>
  saasBuild.buildPlan({ npmExecpath, execPath: NODE, root: 'G:/IHUI-AI', allowUnsigned })

test('npm_execpath 是 .exe 时绝不可交给 node 直载 —— 本判据存在的全部理由', () => {
  const p = plan(PNPM_EXE)
  assert.notEqual(p.cmd, NODE, '把 pnpm.exe 交给 node 加载 = ERR_UNKNOWN_FILE_EXTENSION,入口必死')
  assert.equal(p.cmd, 'pnpm')
  assert.equal(p.args[0], '--filter', '不得把 .exe 路径塞进 args 首位当模块名')
  assert.equal(p.shell, true, '裸 `pnpm` 要靠 shell 解析 Windows 上的 shim')
})

test('npm_execpath 是 .c?js 入口时仍走 node 直载(npm 的既有形态,不得回退)', () => {
  const p = plan(NPM_JS)
  assert.equal(p.cmd, NODE)
  assert.deepEqual(p.args.slice(0, 2), [NPM_JS, '--filter'])
  assert.equal(p.shell, false)
})

test('.cmd 形态同样不得交给 node', () => {
  const p = plan('D:\\pnpm\\global\\pnpm.cmd')
  assert.notEqual(p.cmd, NODE)
  assert.equal(p.cmd, 'pnpm')
  assert.equal(p.shell, true)
})

test('npm_execpath 未设(直接 node 跑本脚本)⇒ shell + 裸 pnpm,语义与历史一致', () => {
  const p = plan(undefined)
  assert.equal(p.cmd, 'pnpm')
  assert.equal(p.args[0], '--filter')
  assert.equal(p.shell, true)
})

test('未签名豁免分支:--config 传的是文件路径,tail 用 node 跑 .mjs(这一处交给 node 是对的)', () => {
  const p = plan(PNPM_EXE, true)
  assert.ok(p.configPath, 'allowUnsigned 必须给出 config 文件路径')
  assert.ok(p.args.includes(p.configPath), 'config 以路径入参,不内联 JSON')
  assert.equal(p.tail.cmd, NODE, 'tail 跑的是仓内 .mjs 脚本,node 直载正当')
  assert.match(p.tail.args[0], /desktop-artifact-single\.mjs$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
