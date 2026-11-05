// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 每日签到与账面读数的机器锁(2026-11-05 立)。
 *
 * 全是**纯函数**,离线可跑。钉住的四件事:
 *   ① 签到四档不并桶:`checked` / `already`(幂等成功) / `failed` / `undetermined`;
 *      「今天已签到」是专码 10001 ⇒ 绝不能算失败,否则天天误报;
 *   ② 读不懂的响应 ⇒ 未判定,不冒充前三档(§0.3);
 *   ③ 账面读数取不到 ⇒ 未判定,**不用 0 冒充「一个都没完成」**;
 *   ④ 端点形状:签到是 POST-only,账面是 GET(实测过,别改错方法)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CHECKIN_URL,
  PROFILE_URL,
  parseArgs,
  parseCheckinResponse,
  parseProfileResponse,
} from '../workbuddy-growth-daily.mjs'

test('① 签到成功态:http 200 + code 0 ⇒ checked', () => {
  const r = parseCheckinResponse(200, '{"code":0,"msg":"OK","data":{"credit":20}}')
  assert.equal(r.state, 'checked')
  assert.equal(r.code, 0)
})

test('① 「今天已签到」是幂等成功,不是失败(实测专码 10001 原文)', () => {
  const live = '{"code":10001,"msg":"今天已签到，请明天再来","requestId":"7a922d2f"}'
  const r = parseCheckinResponse(400, live)
  assert.equal(r.state, 'already')
  assert.equal(r.code, 10001)
  // HTTP 400 也不许把它降成 failed —— 判据看业务码,不看传输层
  assert.notEqual(r.state, 'failed')
})

test('① 文案兜底:没有专码但说了「已签到」⇒ 仍归 already(两种形态同一结论)', () => {
  assert.equal(parseCheckinResponse(400, '{"code":9,"msg":"您已签到过啦"}').state, 'already')
  assert.equal(
    parseCheckinResponse(400, '{"code":9,"msg":"already checked in today"}').state,
    'already',
  )
})

test('① 其它业务码 ⇒ failed,并带出 code 与 msg', () => {
  const r = parseCheckinResponse(400, '{"code":20005,"msg":"账号状态异常"}')
  assert.equal(r.state, 'failed')
  assert.equal(r.code, 20005)
  assert.match(r.msg, /账号状态异常/)
})

test('② 读不懂 ⇒ 未判定,一律不冒充前三档', () => {
  // 非 JSON
  assert.equal(parseCheckinResponse(200, '<html>502 Bad Gateway</html>').state, 'undetermined')
  // JSON 但没有数字 code
  assert.equal(parseCheckinResponse(200, '{"msg":"ok"}').state, 'undetermined')
  // code 是字符串不算
  assert.equal(parseCheckinResponse(200, '{"code":"0","msg":"ok"}').state, 'undetermined')
  // 空输入
  assert.equal(parseCheckinResponse(0, '').state, 'undetermined')
})

test('③ 账面:完成数与总数都要量到才算读到,否则未判定(不用 0 冒充)', () => {
  const p = parseProfileResponse(
    200,
    '{"code":0,"data":{"completed":17,"total":18,"level":17,"max_level":false}}',
  )
  assert.equal(p.ok, true)
  assert.equal(p.completed, 17)
  assert.equal(p.total, 18)
  assert.equal(p.level, 17)

  assert.equal(parseProfileResponse(200, '{"code":0,"data":{}}').ok, false)
  assert.equal(parseProfileResponse(200, '{"code":0}').ok, false)
  assert.equal(parseProfileResponse(500, '{"code":0,"data":{"completed":17,"total":18}}').ok, false)
  assert.equal(parseProfileResponse(200, 'not json').ok, false)
  // 只有 completed 没有 total ⇒ 也算未判定(半只眼睛不当读数)
  assert.equal(parseProfileResponse(200, '{"code":0,"data":{"completed":17}}').ok, false)
})

test('④ 端点形状:签到走 v2 网关,账面走 v2 成长族(方法不同,别改错)', () => {
  assert.equal(CHECKIN_URL, 'https://www.workbuddy.cn/v2/billing/meter/daily-checkin')
  assert.equal(PROFILE_URL, 'https://www.workbuddy.cn/v2/activity/growth/profile')
})

test('④ 命令行:两档可同给,都不给 ⇒ 交回调用方按用法处理', () => {
  assert.deepEqual(parseArgs(['--checkin']), { checkin: true, profile: false, help: false })
  assert.deepEqual(parseArgs(['--checkin', '--profile']), {
    checkin: true,
    profile: true,
    help: false,
  })
  assert.equal(parseArgs([]).checkin, false)
  assert.equal(parseArgs(['-h']).help, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
