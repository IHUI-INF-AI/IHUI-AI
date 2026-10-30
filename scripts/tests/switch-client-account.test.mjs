// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一切号入口的接线锁(2026-10-31 立)。
 *
 * 锁四件东西:
 *   ① 平台归一(别名表 + 未知平台不猜);
 *   ② 参数映射(--to/--provider → 目标脚本 argv,含 trae-solo 自动补产品面);
 *   ③ list/current 分流(Trae 系转 account 入口;其它平台如实 exit 2 并指巡检入口);
 *   ④ 真实 CLI 退出码(无参数 2 / --help 0 / 未知平台 2)。
 *
 * 判据 import 自生产脚本的 `__test__`(§22c),本文件不复制任何常量或判据。
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as S } from '../switch-client-account.mjs'

const { normalizeProvider, planCli, parseArgs, buildPlan, TRAE_SOLO_PRODUCT, SUPPORTED_PLATFORMS } =
  S

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'switch-client-account.mjs',
)

function runCli(argv) {
  return spawnSync(process.execPath, [SCRIPT, ...argv], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('① 平台归一:trae 系别名与直通平台,未知不猜', () => {
  for (const raw of ['trae', 'Trae', 'trae-cn', 'Trae CN', 'TRAE-CN']) {
    const n = normalizeProvider(raw)
    assert.equal(n.ok, true, `${raw} 应识别`)
    assert.equal(n.provider, 'trae')
    assert.equal(n.product, undefined, `${raw} 不应带产品面`)
  }
  for (const raw of ['trae-solo', 'TRAE SOLO CN', 'solo', 'Trae_Solo', 'trae-solo-cn']) {
    const n = normalizeProvider(raw)
    assert.equal(n.ok, true, `${raw} 应识别`)
    assert.equal(n.provider, 'trae')
    assert.equal(n.product, TRAE_SOLO_PRODUCT, `${raw} 必须补 ${TRAE_SOLO_PRODUCT}`)
  }
  for (const raw of [
    'qoder',
    'minimax',
    'codex',
    'zcode',
    'opencode',
    'workbuddy',
    'codearts',
    'loomy',
    'doubao',
  ]) {
    const n = normalizeProvider(raw)
    assert.equal(n.ok, true)
    assert.equal(n.provider, raw)
    assert.equal(n.product, undefined)
  }
  assert.equal(normalizeProvider('nope').ok, false)
  assert.equal(normalizeProvider('').ok, false)
  assert.ok(SUPPORTED_PLATFORMS.includes('doubao'))
})

test('② 参数映射:--to → trae with-chat argv(trae-solo 自动补产品面)', () => {
  const plain = planCli(['--to', 'u-1', '--provider', 'trae'])
  assert.equal(plain.ok, true)
  assert.equal(plain.target, 'trae-chat')
  assert.deepEqual(plain.args, ['--to', 'u-1'])

  const solo = planCli([
    '--to',
    'u-1',
    '--provider',
    'trae-solo',
    '--dry-run',
    '--force',
    '--no-launch',
    '--json',
  ])
  assert.equal(solo.ok, true)
  assert.equal(solo.target, 'trae-chat')
  assert.deepEqual(solo.args, [
    '--to',
    'u-1',
    '--product',
    TRAE_SOLO_PRODUCT,
    '--dry-run',
    '--force',
    '--no-launch',
    '--json',
  ])

  // 显式产品面与 provider 自带产品面冲突 ⇒ 不猜,exit 2
  const conflict = planCli(['--to', 'u-1', '--provider', 'trae-solo', '--product', 'Trae CN'])
  assert.equal(conflict.ok, false)
  assert.equal(conflict.code, 2)
  assert.match(conflict.error, /冲突/)

  // 同一产品面大小写不一致不算冲突(字面比较归一)
  const same = planCli(['--to', 'u-1', '--provider', 'solo', '--product', 'trae solo cn'])
  assert.equal(same.ok, true)
  assert.deepEqual(same.args.slice(0, 4), ['--to', 'u-1', '--product', TRAE_SOLO_PRODUCT])
})

test('②b 参数映射:其它平台 → login-local-verified argv(--to 折成 --uid)', () => {
  const plain = planCli(['--to', 'pool-uid', '--provider', 'minimax'])
  assert.equal(plain.ok, true)
  assert.equal(plain.target, 'login-verified')
  assert.deepEqual(plain.args, ['--provider', 'minimax', '--uid', 'pool-uid'])

  const flags = planCli(['--to', 'pool-uid', '--provider', 'qoder', '--dry-run', '--json'])
  assert.equal(flags.ok, true)
  assert.deepEqual(flags.args, ['--provider', 'qoder', '--uid', 'pool-uid', '--dry-run', '--json'])

  // 目标 ts 脚本不认的旗标 ⇒ 如实 exit 2,不静默吞
  for (const extra of [['--force'], ['--no-launch'], ['--product', 'Trae CN']]) {
    const plan = planCli(['--to', 'pool-uid', '--provider', 'codex', ...extra])
    assert.equal(plan.ok, false, `${extra.join(' ')} 应被拒`)
    assert.equal(plan.code, 2)
  }
})

test('③ list/current 分流:Trae 系转 account 入口,其它平台如实未判定', () => {
  const list = planCli(['--list'])
  assert.equal(list.ok, true)
  assert.equal(list.target, 'trae-account')
  assert.deepEqual(list.args, ['--list'])

  const current = planCli(['--current', '--provider', 'trae', '--json'])
  assert.equal(current.ok, true)
  assert.equal(current.target, 'trae-account')
  assert.deepEqual(current.args, ['--current', '--json'])

  // 产品面不影响名单查询
  const soloList = planCli(['--list', '--provider', 'trae-solo'])
  assert.equal(soloList.ok, true)
  assert.deepEqual(soloList.args, ['--list'])

  const other = planCli(['--list', '--provider', 'workbuddy'])
  assert.equal(other.ok, false)
  assert.equal(other.code, 2)
  assert.match(other.error, /relay-account-pool/)
  assert.match(other.error, /relay:inspect/)

  assert.equal(planCli(['--list', '--current']).code, 2)
  assert.equal(planCli(['--list', '--to', 'u-1', '--provider', 'trae']).code, 2)
})

test('④ 未知 provider / 缺 --to / 未知参数 ⇒ exit 2 并列出支持集', () => {
  const unknown = planCli(['--to', 'x', '--provider', 'nope'])
  assert.equal(unknown.ok, false)
  assert.equal(unknown.code, 2)
  for (const platform of ['trae', 'trae-solo', 'qoder', 'doubao']) {
    assert.ok(unknown.error.includes(platform), `错误里必须列出 ${platform}`)
  }

  const noTo = planCli(['--provider', 'qoder'])
  assert.equal(noTo.ok, false)
  assert.equal(noTo.code, 2)
  assert.match(noTo.error, /--to/)

  const noProvider = planCli(['--to', 'x'])
  assert.equal(noProvider.ok, false)
  assert.equal(noProvider.code, 2)
  assert.match(noProvider.error, /--provider/)

  assert.equal(planCli(['--bogus']).code, 2)
  assert.equal(planCli(['--to']).code, 2)
  // parseArgs 与 buildPlan 串联等价 planCli
  assert.deepEqual(buildPlan(parseArgs(['--list'])), planCli(['--list']))
})

test('⑤ 真实 CLI:无参数 exit 2 / --help exit 0 / 未知平台 exit 2', () => {
  const noArgs = runCli([])
  assert.equal(noArgs.status, 2)
  assert.match(noArgs.stdout, /用法:/)

  const help = runCli(['--help'])
  assert.equal(help.status, 0)
  assert.match(help.stdout, /--provider/)

  const unknown = runCli(['--to', 'x', '--provider', 'nope'])
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /不认识的平台/)
  assert.match(unknown.stderr, /doubao/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
