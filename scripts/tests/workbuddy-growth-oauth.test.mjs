// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「公众号关注」收口链的机器锁(2026-11-05 立)。
 *
 * 覆盖的判据(全是纯函数,不碰进程/网络 ⇒ 离线可跑):
 *   ① 状态词口径:`accepted` ≠ 完成 / `completed` = 可领 / `claimed` = 已到账;
 *   ② 领奖响应的解析:HTTP 200 **不等于**领到了(受理回执 ≠ 业务事实,§0.3);
 *   ③ 一轮轮询的四路分流(要领 / 已到账 / 等达标 / 未判定);
 *   ④ 命令行解析(两种写法 + 下限保护);
 *   ⑤ 「直接跑 vs 被 import」的守卫(单一真相源 `lib/direct-run.mjs`);
 *   ⑥ 订阅任务状态的解析与措辞:`subscribed=false` ≠ 读不到;读不到一律「未判定」。
 *
 * 为什么这些必须钉住:踩过的坑全在**状态词**上——
 *   · 把 `accepted` 当成"已完成" ⇒ 引擎会跳过真待办;
 *   · 把 `claimed` 当成"可领" ⇒ 引擎会反复重领(实测踩过,已改为 finished 集合收口);
 *   · 领奖 HTTP 200 就当成功 ⇒ 把"受理"当"到账";
 *   · 把状态端点**取不到**渲染成"服务端说没关注" ⇒ 把人引去做一次本来已经做完的关注。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  OA_SUBSCRIBE_STATUS_URL,
  OA_TASK_CODE,
  describeSubscribe,
  oaClaimUrl,
  parseArgs,
  parseClaimResponse,
  parseSubscribeStatus,
  planOaRound,
  selectOaTask,
  subscribeVerdictOf,
} from '../workbuddy-growth-oauth.mjs'
import { isDirectRun } from '../lib/direct-run.mjs'

const OA_ROW = {
  task_code: OA_TASK_CODE,
  title: '关注「腾讯 WorkBuddy」官方公众号',
  task_desc: '关注「腾讯 WorkBuddy」官方公众号满 24 小时，即可领取奖励',
  jump_url: 'https://www.workbuddy.cn/events/follow-guide/',
  reward_credit: 100,
  reward_energy: 5,
  has_reward: true,
}

test('① 列表里挑出公众号项:奖励与条件原样带出', () => {
  const t = selectOaTask([{ task_code: 'chat_5' }, OA_ROW])
  assert.equal(t.task_code, OA_TASK_CODE)
  assert.equal(t.reward_credit, 100)
  assert.equal(t.reward_energy, 5)
  assert.equal(t.has_reward, true)
  assert.match(t.task_desc, /满 24 小时/)
  assert.equal(t.jump_url, 'https://www.workbuddy.cn/events/follow-guide/')
})

test('① 列表里没有这一项 ⇒ null(未判定,不静默丢、不编造)', () => {
  assert.equal(selectOaTask([{ task_code: 'chat_5' }]), null)
  assert.equal(selectOaTask([]), null)
  assert.equal(selectOaTask(undefined), null)
  assert.equal(selectOaTask('not-a-list'), null)
})

test('① 状态词口径:accepted ≠ 完成 / completed = 可领 / claimed = 已到账', () => {
  const accepted = selectOaTask([
    { ...OA_ROW, accept_status: 'accepted', progress: { current: 0, target: 1 } },
  ])
  assert.equal(accepted.serviceDone, false)
  assert.equal(accepted.claimable, false)
  assert.equal(accepted.rewardClaimed, false)
  assert.equal(accepted.done, false)

  const completed = selectOaTask([
    { ...OA_ROW, accept_status: 'completed', progress: { current: 1, target: 1 } },
  ])
  assert.equal(completed.serviceDone, true)
  assert.equal(completed.claimable, true)
  assert.equal(completed.rewardClaimed, false)
  assert.equal(completed.done, true)

  const claimed = selectOaTask([
    { ...OA_ROW, accept_status: 'claimed', progress: { current: 1, target: 1 } },
  ])
  assert.equal(claimed.serviceDone, true)
  assert.equal(claimed.claimable, false, '已领到的号不能再当成"可领"去反复重领')
  assert.equal(claimed.rewardClaimed, true)
  assert.equal(claimed.done, true)
})

test('① 进度达标也算终态(即使状态词还没翻)', () => {
  const t = selectOaTask([
    { ...OA_ROW, accept_status: 'accepted', progress: { current: 1, target: 1 } },
  ])
  assert.equal(t.done, true)
  assert.equal(t.claimable, false)
})

test('② 领奖响应:HTTP 200 + code:0 ⇒ 成功', () => {
  const r = parseClaimResponse(200, JSON.stringify({ code: 0, msg: 'ok' }))
  assert.equal(r.ok, true)
  assert.equal(r.already, false)
  assert.equal(r.code, 0)
})

test('② 领奖响应:HTTP 200 但 code:400 "task not completed" ⇒ 失败(受理 ≠ 业务事实)', () => {
  const r = parseClaimResponse(400, JSON.stringify({ code: 400, msg: 'task not completed' }))
  assert.equal(r.ok, false)
  assert.equal(r.msg, 'task not completed')
})

test('② 领奖响应:HTTP 200 但体里 code:400 ⇒ 失败(状态码与体不一致时以体为准)', () => {
  const r = parseClaimResponse(200, JSON.stringify({ code: 400, msg: 'task not completed' }))
  assert.equal(r.ok, false)
})

test('② 领奖响应:"已经领过了" ⇒ 视为已到账(already)', () => {
  const r = parseClaimResponse(400, JSON.stringify({ code: 400, msg: 'already claimed' }))
  assert.equal(r.already, true)
  assert.equal(r.ok, true)
})

test('② 领奖响应:非 JSON 原文 ⇒ 不炸,msg 兜底且判失败', () => {
  const r = parseClaimResponse(502, 'Bad Gateway')
  assert.equal(r.ok, false)
  assert.equal(r.msg, 'Bad Gateway')
})

test('③ 一轮轮询四路分流', () => {
  const done = selectOaTask([{ ...OA_ROW, accept_status: 'completed' }])
  const already = selectOaTask([{ ...OA_ROW, accept_status: 'claimed' }])
  const pending = selectOaTask([
    { ...OA_ROW, accept_status: 'accepted', progress: { current: 0, target: 1 } },
  ])
  const plan = planOaRound([
    { uid: 'u1', task: done },
    { uid: 'u2', task: already },
    { uid: 'u3', task: pending },
    { uid: 'u4', task: null },
  ])
  assert.deepEqual(plan.claim, ['u1'])
  assert.deepEqual(plan.already, ['u2'])
  assert.deepEqual(plan.pending, ['u3'])
  assert.deepEqual(plan.undecided, ['u4'])
})

test('③ 一轮轮询:空输入 ⇒ 四个桶都空(不编造)', () => {
  const plan = planOaRound([])
  assert.deepEqual(plan.claim, [])
  assert.deepEqual(plan.already, [])
  assert.deepEqual(plan.pending, [])
  assert.deepEqual(plan.undecided, [])
})

test('④ 命令行:两种写法都认', () => {
  assert.equal(parseArgs(['--status']).status, true)
  assert.equal(parseArgs(['--watch']).watch, true)
  assert.equal(parseArgs(['--watch', '--interval', '60']).intervalSec, 60)
  assert.equal(parseArgs(['--watch', '--interval=90']).intervalSec, 90)
  assert.equal(parseArgs(['--watch', '--timeout', '600']).timeoutSec, 600)
  assert.equal(parseArgs(['--watch', '--timeout=700']).timeoutSec, 700)
})

test('④ 命令行:间隔下限 30s(再密就是拿服务端当靶子打)', () => {
  assert.equal(parseArgs(['--watch', '--interval', '1']).intervalSec, 30)
  assert.equal(parseArgs(['--watch', '--interval', '0']).intervalSec, 30)
  assert.equal(parseArgs(['--watch', '--interval', 'abc']).intervalSec, 30)
  // 默认值
  assert.equal(parseArgs([]).intervalSec, 300)
  assert.equal(parseArgs([]).timeoutSec, 90_000)
})

test('④ 命令行:领奖端点把任务码放进路径', () => {
  assert.equal(
    oaClaimUrl(),
    `https://www.workbuddy.cn/v2/activity/growth/tasks/${OA_TASK_CODE}/claim`,
  )
})

test('⑤ 直接运行守卫:入口指向本文件 ⇒ true;指向别的文件 ⇒ false', () => {
  const selfUrl = pathToFileURL(path.resolve('scripts/lib/direct-run.mjs')).href
  assert.equal(isDirectRun(selfUrl, path.resolve('scripts/lib/direct-run.mjs')), true)
  assert.equal(isDirectRun(selfUrl, path.resolve('scripts/workbuddy-growth-oauth.mjs')), false)
  // 取不到输入 ⇒ 保守判 false(宁可不执行,也不误杀宿主进程)
  assert.equal(isDirectRun(selfUrl, undefined), false)
  assert.equal(isDirectRun('not-a-url', path.resolve('scripts/lib/direct-run.mjs')), false)
})

test('⑥ 订阅状态:服务端真回的那一型(实测 2026-11-05)解析出 subscribed=false', () => {
  const live =
    '{"code":0,"msg":"OK","data":{"subscribe_task":{"task_code":"wb_wechat_oa_subscribe_task",' +
    '"subscribed":false,"remaining_seconds":-1,"task_status":"accepted","advanced":false}}}'
  const s = parseSubscribeStatus(200, live)
  assert.equal(s.ok, true)
  assert.equal(s.subscribed, false)
  assert.equal(s.remainingSeconds, -1)
  assert.equal(s.taskStatus, 'accepted')
  assert.equal(subscribeVerdictOf(s), 'not_followed')
  // 未关注时 -1 不是"倒计时",不许渲染成还在等 24h
  assert.match(describeSubscribe(s), /未检测到/)
})

test('⑥ 订阅状态:已关注 + 还有倒计时 ⇒ counting(把秒说成人能读的小时)', () => {
  const s = parseSubscribeStatus(
    200,
    '{"code":0,"data":{"subscribe_task":{"subscribed":true,"remaining_seconds":3725,"task_status":"in_progress"}}}',
  )
  assert.equal(s.ok, true)
  assert.equal(subscribeVerdictOf(s), 'counting')
  assert.equal(describeSubscribe(s), '已关注,24h 窗还差 1h02m')
})

test('⑥ 订阅状态:已关注且没有倒计时读数(-1)⇒ followed,不谎报还在等', () => {
  const s = parseSubscribeStatus(
    200,
    '{"code":0,"data":{"subscribe_task":{"subscribed":true,"remaining_seconds":-1,"task_status":"completed"}}}',
  )
  assert.equal(subscribeVerdictOf(s), 'followed')
})

test('⑥ 订阅状态:读不到 ⇒ 未判定,绝不并桶成"没关注"(§0.3)', () => {
  // 非 JSON
  const a = parseSubscribeStatus(200, '<html>502</html>')
  assert.equal(a.ok, false)
  assert.equal(a.subscribed, null)
  assert.equal(subscribeVerdictOf(a), 'undetermined')
  // 形状对但缺 subscribed 布尔
  const b = parseSubscribeStatus(
    200,
    '{"code":0,"data":{"subscribe_task":{"task_status":"accepted"}}}',
  )
  assert.equal(b.ok, false)
  assert.equal(subscribeVerdictOf(b), 'undetermined')
  // HTTP 非 2xx ⇒ 未判定(不是"服务端说没关注")
  const c = parseSubscribeStatus(
    404,
    '{"code":404,"data":{"subscribe_task":{"subscribed":false,"remaining_seconds":-1}}}',
  )
  assert.equal(c.ok, false)
  assert.equal(subscribeVerdictOf(c), 'undetermined')
  assert.match(describeSubscribe(c), /未判定/)
  // HTTP 200 但业务码非 0 ⇒ 同样未判定(受理回执 ≠ 业务事实;这条守卫没人测就等于没有)
  const d = parseSubscribeStatus(
    200,
    '{"code":500,"msg":"internal error","data":{"subscribe_task":{"subscribed":true,"remaining_seconds":-1}}}',
  )
  assert.equal(d.ok, false)
  assert.equal(subscribeVerdictOf(d), 'undetermined')
  assert.match(describeSubscribe(d), /未判定/)
  // 整个输入缺失
  assert.equal(subscribeVerdictOf(null), 'undetermined')
})

test('⑥ 刷新端点 URL 与官方 bundle 的 qa() 同一条', () => {
  assert.equal(
    OA_SUBSCRIBE_STATUS_URL,
    'https://www.workbuddy.cn/v2/activity/growth/subscribe-task/status',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
