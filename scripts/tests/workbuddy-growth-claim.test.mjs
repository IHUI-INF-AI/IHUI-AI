// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一键领奖」命令的机器锁(2026-11-05 立)。
 *
 * 全绿判据全是**纯函数**,不碰网络 ⇒ 离线可跑。钉住的四件事:
 *   ① 可领集只认 `completed` 一个词:`accepted`(行为没做)与 `claimed`(已到账)都不许进射程;
 *   ② `--code` 点名后找不到 ⇒ 交回调用方报未判定,不静默当"没有可领的";
 *   ③ 命令行两种写法都认;
 *   ④ 判据不复制:`claimTask` 与 `parseClaimResponse` 的同一实现被 import(§0.6)。
 *
 * 为什么必须钉:②把"没挣到"当"已领过"、或把"已领过"再领一次,都是拿服务端的报错当噪音,
 * 而真正的失效方向是**多要一次定向说明**,不是多放一次(AGENTS.md §0.10)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { narrowByCode, parseArgs, selectClaimable } from '../workbuddy-growth-claim.mjs'
import { claimOaTask, claimTask } from '../workbuddy-growth-oauth.mjs'

const row = (code, status, extra = {}) => ({
  task_code: code,
  accept_status: status,
  title: `标题-${code}`,
  reward_credit: 100,
  reward_energy: 5,
  ...extra,
})

test('① 可领集只认 completed:accepted / claimed / in_progress / not_accepted 全不进射程', () => {
  const tasks = [
    row('chat_5', 'completed'),
    row('wb_wechat_oa_subscribe_task', 'accepted'),
    row('skill_1', 'claimed'),
    row('template_5', 'in_progress'),
    row('first_buddy', 'not_accepted'),
  ]
  const got = selectClaimable(tasks)
  assert.deepEqual(
    got.map((t) => t.task_code),
    ['chat_5'],
  )
  // 奖励与标题原样带出,不折算
  assert.equal(got[0].reward_credit, 100)
  assert.equal(got[0].reward_energy, 5)
  assert.equal(got[0].title, '标题-chat_5')
})

test('① 大小写与空白不影響判定,但缺任务码的行一律丢掉(不构造空名请求)', () => {
  const tasks = [
    row('a', ' COMPLETED '),
    row('', 'completed'),
    row('', 'completed', { task_code: undefined }),
  ]
  assert.deepEqual(
    selectClaimable(tasks).map((t) => t.task_code),
    ['a'],
  )
})

test('① 输入不是数组 ⇒ 空集(未判定由调用方报,这里不编造)', () => {
  assert.deepEqual(selectClaimable(undefined), [])
  assert.deepEqual(selectClaimable(null), [])
  assert.deepEqual(selectClaimable({}), [])
})

test('② --code 点名:命中留一枚,不命中交回空集(调用方据此报未判定)', () => {
  const rows = selectClaimable([row('chat_5', 'completed'), row('skill_1', 'completed')])
  assert.deepEqual(
    narrowByCode(rows, 'skill_1').map((r) => r.task_code),
    ['skill_1'],
  )
  assert.deepEqual(narrowByCode(rows, 'not_exist'), [])
  // 不点名 ⇒ 全留
  assert.equal(narrowByCode(rows, '').length, 2)
  assert.equal(narrowByCode(rows, undefined).length, 2)
})

test('③ 命令行:--code 的两种写法与 --dry-run', () => {
  assert.deepEqual(parseArgs(['--dry-run']), { dryRun: true, onlyCode: '', help: false })
  assert.equal(parseArgs(['--code', 'chat_5']).onlyCode, 'chat_5')
  assert.equal(parseArgs(['--code=skill_1']).onlyCode, 'skill_1')
  assert.equal(parseArgs(['--help']).help, true)
  assert.equal(parseArgs([]).dryRun, false)
  // --code 是最后一个旗标而没跟值 ⇒ 空串(不拿 undefined 当任务码)
  assert.equal(parseArgs(['--code']).onlyCode, '')
})

test('④ 判据不复制:通用档与公众号档共用同一实现,专用档只是钉任务码', () => {
  assert.equal(typeof claimTask, 'function')
  assert.equal(typeof claimOaTask, 'function')
  assert.notEqual(claimOaTask, claimTask)
})

test('④ 任务码为空 ⇒ 不发请求,直接返回未判定(空 URL 段打服务端是噪音不是重试)', async () => {
  const r = await claimTask({ accessToken: 'x', uid: 'u', domain: 'd' }, '')
  assert.equal(r.ok, false)
  assert.match(r.msg, /任务码为空/)
  assert.equal(r.status, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
