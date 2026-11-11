import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findCheckinTask,
  deviceIdsFor,
  CHECKIN_COMMON_PARAMS,
  CHECKIN_UA,
} from '../lib/doubao-checkin-api.mjs'

test('签到① findCheckinTask:从 detail 响应挖 daily_signin 任务', () => {
  const j = {
    data: {
      tasks: [
        { task_kind: 'other_task', x: 1 },
        { task_kind: 'daily_signin', daily_checkin: { checked_in_today: false, continuous_days: 3, reward: { reward_amount: 200 } } },
      ],
    },
  }
  const t = findCheckinTask(j)
  assert.ok(t)
  assert.equal(t.daily_checkin.continuous_days, 3)
  assert.equal(findCheckinTask({ data: {} }), null)
  assert.equal(findCheckinTask({}), null)
})

test('签到② deviceIdsFor:同 uid 稳定,异 uid 互异,数字形状', () => {
  const a = deviceIdsFor('744846990510748')
  const b = deviceIdsFor('744846990510748')
  const c = deviceIdsFor('59830099522953')
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
  assert.match(a.web_id, /^76\d{8}$/)
  assert.equal(a.tea_uuid.length, 16)
})

test('签到③ 指纹常量:web 指纹 aid=497858 + DoubaoDesktop UA(2026-11-11 detail code:0 实测形状)', () => {
  assert.equal(CHECKIN_COMMON_PARAMS.aid, '497858')
  assert.equal(CHECKIN_COMMON_PARAMS.real_aid, '497858')
  assert.equal(CHECKIN_COMMON_PARAMS.web_platform, 'desktop')
  assert.equal(CHECKIN_COMMON_PARAMS.doubao_device_platform, 'web')
  assert.match(CHECKIN_UA, /DoubaoDesktop\/2\.32\.6/)
  assert.doesNotMatch(CHECKIN_UA, /SamanthaDoubao/)
})
