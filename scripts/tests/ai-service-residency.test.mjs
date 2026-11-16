// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/ai-service-residency.test.mjs — 签到常驻腿判据镜像(§22c import 源出口,零复制)
 * 运行:node --test scripts/tests/ai-service-residency.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeDevAutostart,
  judgeSigninLegResidency,
  SIGNIN_RESIDENCY_DISABLE_ENV,
} from '../lib/dev-stack-residency-policy.mjs'
import {
  parseEnvFileText,
  mergeEnvLayers,
  withResidencyDefaults,
  buildUvicornArgs,
  guardSingleWorker,
  selectRuntimeEntry,
  serializePidRecord,
  parsePidRecord,
  shouldRotateLog,
  healthProbeUrl,
  RESIDENCY_INTERVAL_MINUTES,
} from '../lib/ai-service-residency-runtime.mjs'
import { __test__ as registrar } from '../register-signin-residency-task.mjs'
import { __test__ as poolRuntime } from '../register-pool-sync-task.mjs'

test('policy:签到裁决默认允许,且不改判 dev-stack 全家桶锁', () => {
  const v = judgeSigninLegResidency({ env: {} })
  assert.equal(v.allowed, true)
  assert.match(v.why, /2026-11-16/)
  // 11-10 锁原样(回归保护:加例外≠放松旧闸)
  assert.equal(judgeDevAutostart({ env: {} }).allowed, false)
})

test('policy:机主关闸 = 拒装并给可读出路(失效方向是多要一次说明,非跳门)', () => {
  const v = judgeSigninLegResidency({ env: { [SIGNIN_RESIDENCY_DISABLE_ENV]: '1' } })
  assert.equal(v.allowed, false)
  assert.match(v.why, /出路/)
  const off = judgeSigninLegResidency({ env: { [SIGNIN_RESIDENCY_DISABLE_ENV]: '0' } })
  assert.equal(off.allowed, true, '非 "1" 的显式值不得当关闸(取值判据单一)')
})

test('env 文本解析:注释/空行/无等号跳过,成对引号剥离', () => {
  const p = parseEnvFileText('# c\nA=1\n\n B =  two  \nC="q"\nJUNK')
  assert.deepEqual(p, { A: '1', B: 'two', C: 'q' })
})

test('分层合并后层覆盖前层;CHECKIN_CRON_ENABLED 未设置注入 true,显式值保留', () => {
  const merged = mergeEnvLayers({ X: 'root', Y: 'both' }, { X: 'api' })
  assert.equal(merged.X, 'api')
  assert.equal(merged.Y, 'both')
  assert.equal(withResidencyDefaults({}).CHECKIN_CRON_ENABLED, 'true')
  assert.equal(
    withResidencyDefaults({ CHECKIN_CRON_ENABLED: 'false' }).CHECKIN_CRON_ENABLED,
    'false',
  )
  assert.equal(withResidencyDefaults({ CHECKIN_CRON_ENABLED: '  ' }).CHECKIN_CRON_ENABLED, 'true')
})

test('uvicorn 参数形态 = 单 worker 固定串;守卫拦 --workers/-w/--reload', () => {
  assert.deepEqual(buildUvicornArgs(), [
    'uvicorn',
    'app.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    '8803',
  ])
  assert.equal(guardSingleWorker(buildUvicornArgs()).ok, true)
  for (const bad of ['--workers', '-w', '--workers=4', '--reload']) {
    assert.equal(guardSingleWorker(buildUvicornArgs({ extraArgs: [bad] })).ok, false, bad)
  }
})

test('运行时三形态:venv+uvicorn 可导入 > uv > null;违规 args ⇒ error 不是 null', () => {
  const a = selectRuntimeEntry({ venvPython: 'P', uvicornImportable: true, uvExe: 'U' })
  assert.equal(a.command, 'P')
  assert.deepEqual(a.args, [
    '-m',
    'uvicorn',
    'app.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    '8803',
  ])
  const b = selectRuntimeEntry({ venvPython: null, uvicornImportable: false, uvExe: 'U' })
  assert.equal(b.command, 'U')
  assert.equal(b.args[0], 'run')
  assert.equal(selectRuntimeEntry({}), null)
})

test('pid 记录往返:坏形状一律解析 null;procStart 缺位记 "-"(停止侧据此拒杀)', () => {
  const s = serializePidRecord({ pid: 4242, procStartMs: 1763_000_000_000 })
  assert.equal(s, '4242 1763000000000')
  assert.deepEqual(parsePidRecord(s), { pid: 4242, procStartMs: 1763_000_000_000 })
  const n = serializePidRecord({ pid: 4242, procStartMs: null })
  assert.equal(n, '4242 -')
  assert.deepEqual(parsePidRecord(n), { pid: 4242, procStartMs: null })
  for (const junk of ['', 'abc', '0 5', '-7 5', '1 2 3'])
    assert.equal(parsePidRecord(junk), null, junk)
  assert.equal(serializePidRecord({ pid: 0, procStartMs: 1 }), null)
})

test('健康探测 URL 与节拍常量单形;轮转只对超限生效,坏读数不动', () => {
  assert.equal(healthProbeUrl(), 'http://127.0.0.1:8803/health')
  assert.equal(RESIDENCY_INTERVAL_MINUTES, 30)
  assert.equal(shouldRotateLog({ sizeBytes: 6 * 1024 * 1024 }), true)
  assert.equal(shouldRotateLog({ sizeBytes: 4 * 1024 * 1024 }), false)
  assert.equal(shouldRotateLog({ sizeBytes: Number.NaN }), false)
})

test('注册器出口:内层命令指向 ensure(本机 ROOT 派生,非写死盘符),节拍闸门下限 5min', () => {
  const arg = registrar.buildSigninTaskArgument()
  assert.match(arg, /ensure-ai-service-residency\.mjs/)
  assert.match(arg, /--ensure/)
  assert.ok(!/G:\\/.test(arg), '禁止旧盘符')
  for (const junk of [['--interval', '2'], ['--bogus'], ['--nope']]) {
    assert.equal(registrar.parseArgs(junk).error !== null, true, JSON.stringify(junk))
  }
  assert.equal(registrar.parseArgs(['--run-now']).error, null)
})

test('COM/PowerShell 模板复用零复制:__test__ 面确实携带四个 COM 脚本函数', () => {
  for (const k of [
    'comRegisterScript',
    'comQueryScript',
    'comUnregisterScript',
    'comRunNowScript',
  ]) {
    assert.equal(typeof poolRuntime[k], 'function', k)
  }
  // interval 注册文本带任务名与 PT30M 节拍(与 ensure 的 30min 判据同源)
  const text = poolRuntime.comRegisterScript('//B "x.vbs"', {
    taskName: registrar.TASK_NAME,
    description: 'd',
    trigger: { kind: 'interval', minutes: 30 },
  })
  assert.match(text, /IHUI AI Service Signin Residency/)
  assert.match(text, /PT30M/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
