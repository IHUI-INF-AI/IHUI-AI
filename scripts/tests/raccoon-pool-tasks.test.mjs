// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * raccoon-pool-tasks 判据镜像测试:直接 import 生产脚本的纯函数,零复制。
 *
 * 钉死三件事:
 * 1. **`granted=false` 是幂等命中,不是失败** —— 号池最怕把"今日已领"标红(会误摘账号),
 *    所以这条要有正例(`fine`)与反向牙(真失败必须还是 `finding`/`undetermined`)。
 * 2. **`granted` 非布尔 ⇒ 未判定**,不许按 falsy 猜成"已领"。
 * 3. 流水判定取 `biz_type/event_name/points`,发没发得看流水而不是接口自述。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../raccoon-pool-tasks.mjs'

const { judgeGrant, judgeBills, judgeBalance, judgeTasks, suggestNext } = __test__

const okRes = (body) => ({ status: 200, body, text: JSON.stringify(body) })
const errRes = (status, body = null) => ({ status, body, text: body ? JSON.stringify(body) : '' })

test('grant: granted=true 才算到账,取 popup 金额与来源', () => {
  const r = judgeGrant(
    okRes({ code: 0, data: { granted: true, popup: { source: 'mobile_login', display_name: '移动端登录奖励', points: 3000 } } })
  )
  assert.equal(r.verdict, 'ok')
  assert.equal(r.granted, true)
  assert.equal(r.points, 3000)
  assert.equal(r.source, 'mobile_login')
  assert.equal(r.displayName, '移动端登录奖励')
})

test('grant: granted=false 是幂等命中(ok),绝不判 finding', () => {
  const r = judgeGrant(okRes({ code: 0, data: { granted: false, popup: null } }))
  assert.equal(r.verdict, 'ok')
  assert.equal(r.granted, false)
  assert.equal(r.points, 0)
})

test('grant: granted 非布尔 ⇒ 未判定(反向牙:不许当已领)', () => {
  for (const data of [{}, { granted: 'false' }, { granted: 0 }, { granted: null }]) {
    const r = judgeGrant(okRes({ code: 0, data }))
    assert.equal(r.verdict, 'undetermined', `data=${JSON.stringify(data)}`)
    assert.equal(r.code, 'GRANTED_NOT_BOOL')
  }
})

test('grant: 401/403 与 5xx 分别是 finding 与 undetermined', () => {
  assert.equal(judgeGrant(errRes(401)).verdict, 'finding')
  assert.equal(judgeGrant(errRes(403)).verdict, 'finding')
  assert.equal(judgeGrant(errRes(502)).verdict, 'undetermined')
})

test('grant: 业务码非 0 ⇒ 未判定(不冒绿)', () => {
  const r = judgeGrant(okRes({ code: 200813, message: 'device_link_required' }))
  assert.equal(r.verdict, 'undetermined')
  assert.equal(r.code, 'HTTP_200')
})

test('bills: 逐条取 biz_type/event_name/points', () => {
  const r = judgeBills(
    okRes({
      code: 0,
      data: {
        items: [
          { created_at: '2026-11-11T15:27:40+08:00', biz_type: 'reward_grant', event_name: '移动端登录奖励', points: 3000 },
          { created_at: '2026-11-11T12:54:44+08:00', biz_type: 'daily_grant', event_name: '每日积分发放', points: 300 },
        ],
      },
    })
  )
  assert.equal(r.verdict, 'ok')
  assert.equal(r.items.length, 2)
  assert.deepEqual(r.items[0], {
    at: '2026-11-11T15:27:40+08:00',
    event: '移动端登录奖励',
    bizType: 'reward_grant',
    points: 3000,
  })
})

test('bills: 形状不符一律未判定(空 items 不等于"没有流水")', () => {
  assert.equal(judgeBills(okRes({ code: 0 })).verdict, 'undetermined')
  assert.equal(judgeBills(okRes({ code: 0, data: { items: [] } })).verdict, 'ok')
  assert.equal(judgeBills(errRes(401)).verdict, 'finding')
})

test('balance/tasks: 正常面与失效面', () => {
  const b = judgeBalance(okRes({ code: 0, data: { available_points: 9300, daily_points: 300, reward_points: 9000, topup_points: 0, owner_id: 7 } }))
  assert.equal(b.verdict, 'ok')
  assert.equal(b.availablePoints, 9300)
  assert.equal(b.dailyPoints, 300)
  assert.equal(judgeBalance(errRes(401)).code, 'AUTH_EXPIRED')

  const t = judgeTasks(
    okRes({ code: 0, data: { new_user_task_states: [{ key: 'mobile_login', status: 'completed' }], invite: { invite_code: 'abc' } } })
  )
  assert.equal(t.verdict, 'ok')
  assert.equal(t.newUserTasks.mobile_login, 'completed')
  assert.equal(t.invite.code, 'abc')
})

test('suggest: 未完成任务指到具体命令;已领不提示领取', () => {
  const bal = { verdict: 'ok', availablePoints: 9300, dailyPoints: 300, rewardPoints: 9000, topupPoints: 0 }
  const tasks = { verdict: 'ok', newUserTasks: { mobile_login: 'unfinished' }, invite: null }
  const out = suggestNext(bal, tasks, { verdict: 'ok', granted: false, points: 0 })
  assert.ok(out.some((s) => s.includes('--claim-new-user')), out.join('\n'))
  assert.ok(out.some((s) => s.includes('granted=false')), out.join('\n'))

  const done = suggestNext(bal, { verdict: 'ok', newUserTasks: { mobile_login: 'completed' }, invite: null }, null)
  assert.ok(!done.some((s) => s.includes('--claim-new-user')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
