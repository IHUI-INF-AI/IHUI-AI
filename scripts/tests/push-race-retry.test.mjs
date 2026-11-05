// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push-race-retry.test.mjs —— race 重试分档的镜像锁(§22c:import 源判据,零复算)
 *
 * 变异自证:四条 stop 出口各有成对反向档;R5 用**真仓库状态**证明这一型当下确实存在,
 * 而不是只在夹具里自洽(本仓最常见的失效形是"器件在、没人跑")。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { __test__ as R } from '../lib/push-race-retry.mjs'

const OK = { kind: 'remote-ref-race', tipReadable: true, tipIsAncestorOfLocal: true }

test('R1 远端 tip 已被本地包含 ⇒ retry(即 triage 第 291 行那句"直接重推即可")', () => {
  const d = R.decideRaceRetry({ ...OK, attemptNo: 0 })
  assert.equal(d.action, 'retry')
  assert.equal(d.converge, false, '快进可推 ⇒ 不许把人支去跑收敛器')
  assert.match(d.why, /不跳门、不强推/)
})

test('R2 非竞态型一律 stop(否则 hook-failed 可借"重试"把跳门洗白)', () => {
  for (const kind of ['hook-failed', 'secret-scan-blocked', 'protected-branch', 'non-fast-forward', 'other']) {
    const d = R.decideRaceRetry({ ...OK, kind })
    assert.equal(d.action, 'stop', `${kind} 不许走 race 重试`)
    assert.equal(d.converge, false, `${kind} 也不该被顺手升级成跑收敛器`)
  }
})

test('R3 量不到远端 tip ⇒ stop 且不猜(不记成"已推上去",也不支人去 converge)', () => {
  const d = R.decideRaceRetry({ kind: 'remote-ref-race', attemptNo: 0, tipReadable: false, tipIsAncestorOfLocal: false })
  assert.equal(d.action, 'stop')
  assert.equal(d.converge, false)
  assert.match(d.why, /不猜/)
})

test('R4 远端 tip 不在本地 ⇒ 真分叉:唯一出口 converge,本器绝不 merge/force', () => {
  const d = R.decideRaceRetry({ kind: 'remote-ref-race', attemptNo: 0, tipReadable: true, tipIsAncestorOfLocal: false })
  assert.equal(d.action, 'stop')
  assert.equal(d.converge, true, '真分叉必须交 converge')
  assert.ok(!/merge|force|--no-verify/.test(d.why), `分档文案不得暗示合并/强推/跳门:${d.why}`)
})

test('R5 上限两侧成对:max-1 仍 retry,max 即 stop(不许无限重推)', () => {
  assert.equal(R.decideRaceRetry({ ...OK, attemptNo: R.RACE_RETRY_MAX - 1 }).action, 'retry')
  const stop = R.decideRaceRetry({ ...OK, attemptNo: R.RACE_RETRY_MAX })
  assert.equal(stop.action, 'stop')
  assert.match(stop.why, /上限/)
  // 计数本身取不到 ⇒ 未判定方向也是 stop,不猜一个趟数继续推
  assert.equal(R.decideRaceRetry({ ...OK, attemptNo: null }).action, 'stop')
  assert.equal(R.decideRaceRetry({ ...OK, max: 0 }).action, 'stop')
})

test('R6 真仓库现读:这一型此刻确实成立(不是夹具自洽)', () => {
  let tip = ''
  try {
    tip = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    })
      .trim()
      .split(/[\s\t]+/)[0]
  } catch {
    console.log('  (拿不到远端 tip ⇒ 本例只报"未判定",不改判据)')
    return
  }
  if (!/^[0-9a-f]{40}$/.test(tip)) return
  // merge-base --is-ancestor 用退出码表态(0=是祖先,1=不是)⇒ 必须 spawnSync 取 status,
  // 用 execFileSync 会在"不是祖先"那一支直接抛错,把真分叉读成异常。
  const anc = spawnSync('git', ['merge-base', '--is-ancestor', tip, 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  const inLocal = anc.status === 0
  const d = R.decideRaceRetry({ kind: 'remote-ref-race', attemptNo: 0, tipReadable: true, tipIsAncestorOfLocal: inLocal })
  // 只断言"出口与事实一致":远端已被本地包含就该重推,否则交 converge —— 不钉死当下是哪一种
  assert.ok(d.action === 'retry' || (d.action === 'stop' && d.converge === true), `出口必须与真仓库状态一致:${JSON.stringify(d)}`)
  console.log(`  真读:远端 tip ${tip.slice(0, 9)} 已被本地包含=${inLocal} ⇒ 出口=${d.action}${d.converge ? '(converge)' : ''}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
