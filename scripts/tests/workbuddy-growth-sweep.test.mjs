// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一键编排」命令的机器锁(2026-11-05 立)。
 *
 * 全绿判据一律 import 源脚本的 `parseArgs/planSweepRound/aggregateSweep/buildJsonReport`
 * 与领奖判据 `selectClaimable`(§22c 禁在测试里复制判据),离线、不碰网络不碰进程。
 * 钉住的六件事:
 *   ① 签到四档各进各桶,`already` 是幂等成功、绝不落失败桶;
 *   ② 可领集与 `selectClaimable` 同一实现,只含 `completed`;
 *   ③ 关注项 `undetermined` 与 `not_followed` 不得并桶(§0.3);
 *   ④ 任一输入缺失/形状坏 ⇒ 该维未判定,不编造读数;
 *   ⑤ 命令行三档解析;
 *   ⑥ `--json` 输出体白名单取键,凭据形态(令牌/手机号)结构上进不去。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  aggregateSweep,
  buildJsonReport,
  parseArgs,
  planSweepRound,
} from '../workbuddy-growth-sweep.mjs'
import { selectClaimable } from '../workbuddy-growth-claim.mjs'
import { OA_TASK_CODE } from '../workbuddy-growth-oauth.mjs'

const okRow = (plan, claims = []) => ({ tag: 'a'.slice(0, 8), state: 'ok', plan, claims })
const taskRow = (code, status) => ({
  task_code: code,
  accept_status: status,
  title: `标题-${code}`,
  reward_credit: 10,
  reward_energy: 1,
})

test('① 签到四档各进各桶;already=幂等成功,不算失败', () => {
  for (const state of ['checked', 'already', 'failed', 'undetermined']) {
    assert.equal(
      planSweepRound({ checkin: { state, code: 0, msg: '', http: 200 } }).checkinState,
      state,
    )
  }
  const s = aggregateSweep([
    okRow(planSweepRound({ checkin: { state: 'checked' } })),
    okRow(planSweepRound({ checkin: { state: 'already' } })),
    okRow(planSweepRound({ checkin: { state: 'failed' } })),
    okRow(planSweepRound({ checkin: { state: 'undetermined' } })),
  ])
  assert.equal(s.checked, 1)
  assert.equal(s.already, 1)
  assert.equal(s.checkinFailed, 1)
  assert.equal(s.checkinUndetermined, 1)
  // 单独一轮「全部已签」⇒ 失败桶必须是 0(天天误报的失效型)
  const only = aggregateSweep([okRow(planSweepRound({ checkin: { state: 'already' } }))])
  assert.equal(only.checkinFailed, 0)
  assert.equal(only.already, 1)
})

test('② 可领集 = selectClaimable 同一实现,只含 completed', () => {
  const tasks = {
    ok: true,
    tasks: [taskRow('a', 'completed'), taskRow('b', 'accepted'), taskRow('c', 'claimed')],
  }
  const p = planSweepRound({ tasks })
  assert.deepEqual(
    p.claimable.map((t) => t.task_code),
    ['a'],
  )
  assert.deepEqual(p.claimable, selectClaimable(tasks.tasks))
})

test('②b 关注项一旦被判 completed ⇒ 自动进可领集(绑定生效那天起零人工)', () => {
  // 这一条锁的是"剩下的那一格不需要人再做任何动作":服务端把 OA 项判成 completed 后,
  // sweep 的领奖集必须自动把它收进去 —— 因为可领集只认状态词,不认任务码。
  const tasks = {
    ok: true,
    tasks: [
      {
        task_code: OA_TASK_CODE,
        accept_status: 'completed',
        title: '关注「腾讯 WorkBuddy」官方公众号',
        reward_credit: 100,
        reward_energy: 5,
      },
      { task_code: 'chat_5', accept_status: 'claimed', reward_credit: 100 },
    ],
  }
  const p = planSweepRound({
    checkin: { state: 'already' },
    tasks,
    subscribe: { ok: true, subscribed: true, remainingSeconds: -1, taskStatus: 'completed' },
    profile: { ok: true, completed: 18, total: 18, level: 17 },
  })
  assert.deepEqual(
    p.claimable.map((r) => r.task_code),
    [OA_TASK_CODE],
    'completed 的 OA 项必须在可领集里,claimed 的不在',
  )
  // 同一轮里关注关系应读作"已关注",而不是还挂着等待
  assert.equal(p.subscribeVerdict, 'followed')
  assert.equal(p.checkinState, 'already')
  assert.deepEqual(p.profileRead, { completed: 18, total: 18, level: 17 })
})

test('③ 关注项 undetermined 与 not_followed 不并桶', () => {
  const pU = planSweepRound({ subscribe: { ok: false, subscribed: null, reason: '响应读不懂' } })
  const pN = planSweepRound({
    subscribe: { ok: true, subscribed: false, remainingSeconds: -1, taskStatus: '' },
  })
  assert.equal(pU.subscribeVerdict, 'undetermined')
  assert.equal(pN.subscribeVerdict, 'not_followed')
  const s = aggregateSweep([okRow(pU), okRow(pN)])
  assert.equal(s.follow.undetermined, 1)
  assert.equal(s.follow.not_followed, 1)
  assert.equal(s.follow.counting, 0)
  assert.equal(s.follow.followed, 0)
})

test('④ 输入缺失/形状坏 ⇒ 该维未判定,不编造', () => {
  const p = planSweepRound({})
  assert.equal(p.checkinState, 'undetermined')
  assert.equal(p.tasksState, 'undetermined')
  assert.equal(p.claimable, null)
  assert.equal(p.needsClient, null)
  assert.equal(p.subscribeVerdict, 'undetermined')
  assert.equal(p.profileOk, false)
  assert.equal(planSweepRound({ checkin: null }).checkinState, 'undetermined')
  assert.equal(planSweepRound({ checkin: { state: 'weird' } }).checkinState, 'undetermined')
  assert.equal(planSweepRound({ tasks: { ok: true, tasks: '非数组' } }).tasksState, 'undetermined')
  // ok ∧ 空数组 = 真「没有可领」,不是未判定
  assert.deepEqual(planSweepRound({ tasks: { ok: true, tasks: [] } }).claimable, [])
  // 无 plan 的号级异常行:各维独立进未判定,不冒充 0
  const s = aggregateSweep([{ tag: 'x', state: 'undetermined', reason: '取不到凭据' }])
  assert.equal(s.accountErrors, 1)
  assert.equal(s.checkinUndetermined, 1)
  assert.equal(s.tasksUndetermined, 1)
  assert.equal(s.follow.undetermined, 1)
  assert.equal(s.profileUndetermined, 1)
})

test('⑤ 命令行三档解析', () => {
  assert.deepEqual(parseArgs([]), { json: false, dryRun: false, help: false })
  assert.equal(parseArgs(['--json']).json, true)
  assert.equal(parseArgs(['--dry-run']).dryRun, true)
  const both = parseArgs(['--json', '--dry-run'])
  assert.equal(both.json, true)
  assert.equal(both.dryRun, true)
  assert.equal(parseArgs(['--help']).help, true)
  assert.equal(parseArgs(['-h']).help, true)
  assert.deepEqual(parseArgs(undefined), { json: false, dryRun: false, help: false })
})

test('⑥ --json 输出体不含凭据形态字段(假对象,不跑网络)', () => {
  const plan = planSweepRound({
    checkin: { state: 'checked', code: 0, msg: 'ok', http: 200 },
    tasks: { ok: true, tasks: [taskRow('a', 'completed')] },
    subscribe: { ok: true, subscribed: true, remainingSeconds: 0, taskStatus: 'done' },
    profile: { ok: true, completed: 5, total: 9, level: 5, reason: '' },
  })
  const row = {
    tag: '12345678',
    state: 'ok',
    plan,
    claims: [{ task_code: 'a', ok: true }],
    checkin: { state: 'checked', code: 0, msg: 'ok', http: 200 },
  }
  const json = JSON.stringify(buildJsonReport([row], aggregateSweep([row]), {}))
  assert.doesNotMatch(json, /accessToken|refreshToken|token|phone|mobile/i)
  assert.doesNotMatch(json, /SECRET|13800000000/)
  assert.match(json, /"uid":"12345678"/)
  // 完整 uid 与凭据就算混进行对象里也出不去(白名单取键)
  const tainted = { ...row, uid: '1234567890abcdef', accessToken: 'SECRET', phone: '13800000000' }
  assert.doesNotMatch(
    JSON.stringify(buildJsonReport([tainted], aggregateSweep([tainted]), {})),
    /SECRET|13800000000|1234567890abcdef/,
  )
})

test('⑥b 领奖成败分桶:claimFail 只数 ok!==true 的回执', () => {
  const p = planSweepRound({
    tasks: { ok: true, tasks: [taskRow('a', 'completed'), taskRow('b', 'completed')] },
  })
  const s = aggregateSweep([
    okRow(p, [
      { task_code: 'a', ok: true },
      { task_code: 'b', ok: false },
    ]),
  ])
  assert.equal(s.claimOk, 1)
  assert.equal(s.claimFail, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
