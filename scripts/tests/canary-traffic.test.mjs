#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/canary-traffic.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉「金丝雀发布」票面的第一格 —— 灰度分流(先小流量):
 *  ① 桶口径:稳定哈希、同 key 恒定、与 compaction_canary 同算法(不同 salt ⇒ 不同桶)。
 *  ② 比例解析 fail-closed:非法 ⇒ 0(不放量)、越界 ⇒ clamp、缺省 ⇒ 0(部署环不放量)。
 *  ③ 车道选择:强制头优先、否则按桶;比例 0 ⇒ 恒 stable、比例 100 ⇒ 恒 canary。
 *  ④ 档位推进三态:pass ⇒ 进档、fail ⇒ 归零(撤灰度)、unknown ⇒ 原地不动。
 *  ⑤ 形状锁:档位严格递增、末档必须 100、两槽位不同端口、灰度端点必须在 endpoints 里。
 *  ⑥ 契约面:buildRampContract 把比例/槽位/路由键头/桶口径写全,执行体不猜。
 *  ⑦ 灰期策略派生:只改 grayEndpoints 里的源站端点,api/llm 源站不动。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  trafficBucket,
  parseTrafficPercent,
  isTrafficSelected,
  selectTrafficLane,
  loadTrafficPolicy,
  stagePercent,
  resolveStage,
  deriveGrayPolicy,
  buildRampContract,
  TrafficShapeError,
  OFF_STAGE,
  VERDICTS,
} from '../canary-traffic.mjs'

const STAGES = [
  { id: 'ramp-1', percent: 1 },
  { id: 'ramp-2', percent: 5 },
  { id: 'ramp-3', percent: 25 },
  { id: 'ramp-full', percent: 100 },
]

const BASE_POLICY = {
  version: 1,
  window: { ticks: 8, gapMs: 5000, timeoutMs: 5000 },
  thresholds: {
    minSamples: 5,
    maxErrorRate: 0.05,
    maxErrorRateDelta: 0.05,
    maxP95Ms: 1500,
    maxP95Ratio: 1.5,
    maxP95DeltaMs: 500,
    minBaselineP95Ms: 50,
    maxUnknownRatio: 0.5,
  },
  endpoints: [
    { id: 'web-origin', kind: 'origin', url: 'http://127.0.0.1:8801', contains: '<!DOCTYPE html' },
    { id: 'api-origin', kind: 'origin', url: 'http://127.0.0.1:8802/api/health' },
    { id: 'web-public', kind: 'public', url: 'https://www.aizhs.top' },
  ],
  traffic: {
    bucketGranularity: 10000,
    bucketSalt: 'ihui-deploy-canary',
    routingKeyHeader: 'x-ihui-canary-key',
    tagHeader: 'x-canary-tag',
    stages: STAGES,
    slots: { stable: { port: 8801 }, canary: { port: 8845 } },
    grayEndpoints: ['web-origin'],
  },
}

const policyText = () => JSON.stringify(BASE_POLICY)

test('T1 桶口径:同 key 恒定、跨 key 分散、落在 [0, granularity) 内', () => {
  const a = trafficBucket('user-42')
  const b = trafficBucket('user-42')
  assert.equal(a, b, '同一 key 必须恒定(否则同一用户会在两版之间跳来跳去)')
  assert.ok(a >= 0 && a < 10000, '桶必须落在 [0,10000)')
  assert.notEqual(trafficBucket('user-42'), trafficBucket('user-7'), '不同 key 不应同桶')
  assert.notEqual(trafficBucket('user-42'), trafficBucket('session-a'), '不同 key 不应同桶')
  // 粒度可配:粒度缩小 ⇒ 桶值同步缩小
  assert.ok(trafficBucket('user-42', { granularity: 100 }) < 100)
})

test('T2 桶口径与 compaction_canary 同算法:换 salt ⇒ 换桶(不得共用一份灰度身份)', () => {
  // apps/ai-service/app/services/compaction_canary.py 用 salt=ihui-compaction-canary,
  // 部署侧用 salt=ihui-deploy-canary —— 算法同(sha256 前 8 字节大端 % 10000),身份域不同。
  const deploy = trafficBucket('user-42', { salt: 'ihui-deploy-canary' })
  const compaction = trafficBucket('user-42', { salt: 'ihui-compaction-canary' })
  assert.notEqual(deploy, compaction, '两个灰度域必须用不同 salt,否则用户身份跨域串联')
  // 同算法锚点:手算 sha256('ihui-deploy-canary:user-42') 前 8 字节大端 % 10000
  assert.equal(deploy, 2277, '部署侧桶值漂移 ⇒ 灰度用户集合变了(必须显式改版)')
})

test('T3 比例解析 fail-closed:非法⇒0、越界⇒clamp、缺省⇒0', () => {
  assert.equal(parseTrafficPercent(''), 0, '空 ⇒ 不放量')
  assert.equal(parseTrafficPercent('   '), 0, '空白 ⇒ 不放量')
  assert.equal(parseTrafficPercent('abc'), 0, '非数字 ⇒ 不放量(fail-closed)')
  assert.equal(parseTrafficPercent(undefined), 0, '未设置 ⇒ 不放量(部署环缺省必须不放量)')
  assert.equal(parseTrafficPercent(null), 0, 'null ⇒ 不放量')
  assert.equal(parseTrafficPercent('-5'), 0, '负值 ⇒ clamp 到 0')
  assert.equal(parseTrafficPercent('150'), 100, '越界 ⇒ clamp 到 100')
  assert.equal(parseTrafficPercent('5'), 5)
  assert.equal(parseTrafficPercent('5.5'), 5.5)
})

test('T4 命中判定:比例 0 ⇒ 恒不命中、比例 100 ⇒ 恒命中、中间比例按桶', () => {
  assert.equal(isTrafficSelected('user-42', 0), false)
  assert.equal(isTrafficSelected('user-42', 100), true)
  assert.equal(isTrafficSelected('user-42', 100, {}), true)
  // 桶 2277 ⇒ 命中条件 bucket < percent * (10000/100)
  assert.equal(isTrafficSelected('user-42', 1), false, '桶 2277 在 1%(=100)之外')
  assert.equal(isTrafficSelected('user-42', 25), true, '桶 2277 在 25%(=2500)之内')
  // 同一 key + 同一比例 ⇒ 结果稳定
  assert.equal(isTrafficSelected('user-42', 25), isTrafficSelected('user-42', 25))
})

test('T5 车道选择:强制头优先(运维旁路),否则按桶', () => {
  const c = { percent: 5, granularity: 10000, salt: 'ihui-deploy-canary' }
  const forced = selectTrafficLane('user-42', { ...c, tag: 'canary' })
  assert.equal(forced.lane, 'canary')
  assert.equal(forced.forced, true)
  assert.equal(forced.bucket, null, '强制头不参与桶判定')

  const pinned = selectTrafficLane('user-42', { ...c, tag: 'stable' })
  assert.equal(pinned.lane, 'stable', '强制 stable 必须压过哈希(运维可把某用户钉在现网)')
  assert.equal(pinned.forced, true)

  const natural = selectTrafficLane('user-42', { ...c })
  assert.equal(natural.forced, false)
  assert.equal(natural.lane, 'stable', '桶 2277 在 5%(=500)之外 ⇒ 走现网')
  assert.equal(natural.bucket, 2277)

  // 比例 0 ⇒ 恒 stable;比例 100 ⇒ 恒 canary
  assert.equal(selectTrafficLane('user-42', { ...c, percent: 0 }).lane, 'stable')
  assert.equal(selectTrafficLane('user-42', { ...c, percent: 100 }).lane, 'canary')
})

test('T6 比例 1% 的命中量级:2000 个 key 落在 0.5%~1.5% 区间', () => {
  let hit = 0
  for (let i = 0; i < 2000; i += 1) {
    if (isTrafficSelected(`key-${i}`, 1)) hit += 1
  }
  assert.ok(hit >= 10 && hit <= 30, `1% 档命中 ${hit}/2000,偏离 0.5%~1.5% 太多(分桶可能不均)`)
})

test('T7 档位百分比:off ⇒ 0;未知档位 ⇒ 抛形状错(不猜)', () => {
  assert.equal(stagePercent(OFF_STAGE, STAGES), 0)
  assert.equal(stagePercent('', STAGES), 0)
  assert.equal(stagePercent('ramp-2', STAGES), 5)
  assert.throws(() => stagePercent('ramp-99', STAGES), TrafficShapeError)
})

test('T8 档位推进三态:pass⇒进档、fail⇒归零、unknown⇒原地不动', () => {
  const off = resolveStage(OFF_STAGE, 'pass', STAGES)
  assert.equal(off.stage, 'ramp-1')
  assert.equal(off.percent, 1)
  assert.equal(off.changed, true)

  const up = resolveStage('ramp-1', 'pass', STAGES)
  assert.equal(up.stage, 'ramp-2')
  assert.equal(up.percent, 5)

  const bad = resolveStage('ramp-2', 'fail', STAGES)
  assert.equal(bad.stage, OFF_STAGE, '判定异常 ⇒ 灰度流量必须归零(撤灰度)')
  assert.equal(bad.percent, 0)
  assert.equal(bad.changed, true)

  const unknown = resolveStage('ramp-2', 'unknown', STAGES)
  assert.equal(unknown.stage, 'ramp-2', '未判定 ⇒ 既不放量也不回滚')
  assert.equal(unknown.percent, 5)
  assert.equal(unknown.changed, false)

  // 已在末档 ⇒ pass 不再往前(没有「下一档」)
  const last = resolveStage('ramp-full', 'pass', STAGES)
  assert.equal(last.stage, 'ramp-full')
  assert.equal(last.percent, 100)
  assert.equal(last.changed, false)

  // 末档 fail ⇒ 仍然归零
  assert.equal(resolveStage('ramp-full', 'fail', STAGES).stage, OFF_STAGE)
})

test('T9 档位推进的非法输入:verdict 不在集合内 ⇒ 抛形状错', () => {
  assert.deepEqual(VERDICTS, ['pass', 'fail', 'unknown'])
  assert.throws(() => resolveStage('ramp-1', 'great', STAGES), TrafficShapeError)
  assert.throws(() => resolveStage('ramp-1', '', STAGES), TrafficShapeError)
  assert.throws(() => resolveStage('ramp-99', 'pass', STAGES), TrafficShapeError, '当前档位不在表内 ⇒ 抛')
})

test('T10 形状锁:策略面坏 ⇒ 一律 TrafficShapeError', () => {
  const bad = (mutate, why) => {
    const doc = JSON.parse(policyText())
    mutate(doc)
    assert.throws(() => loadTrafficPolicy(JSON.stringify(doc)), TrafficShapeError, why)
  }
  bad((d) => { delete d.traffic }, '缺 traffic 段')
  bad((d) => { d.traffic.bucketGranularity = 0 }, '粒度必须正整数')
  bad((d) => { d.traffic.bucketGranularity = 1.5 }, '粒度必须正整数')
  bad((d) => { d.traffic.bucketSalt = '' }, 'salt 不能为空')
  bad((d) => { d.traffic.routingKeyHeader = '' }, '路由键头不能为空')
  bad((d) => { d.traffic.tagHeader = '' }, '强制头不能为空')
  bad((d) => { d.traffic.stages = [] }, '档位表不能为空')
  bad((d) => { d.traffic.stages = [{ id: 'a', percent: 5 }, { id: 'b', percent: 5 }] }, '档位必须严格递增')
  bad((d) => { d.traffic.stages = [{ id: 'a', percent: 10 }, { id: 'b', percent: 5 }] }, '档位必须严格递增')
  bad((d) => { d.traffic.stages = [{ id: 'a', percent: 5 }] }, '末档必须 100')
  bad((d) => { d.traffic.stages = [{ id: 'a', percent: 5 }, { id: 'b', percent: 100 }, { id: 'c', percent: 100 }] }, '档位重复/不递增')
  bad((d) => { d.traffic.stages = [{ id: 'a', percent: 200 }] }, 'percent 必须 0..100')
  bad((d) => { d.traffic.slots.stable.port = 0 }, '槽位端口必须正整数')
  bad((d) => { d.traffic.slots.canary.port = 8801 }, '两槽位不能同端口')
  bad((d) => { delete d.traffic.slots.canary }, '缺 canary 槽位')
  bad((d) => { d.traffic.grayEndpoints = ['nope'] }, '灰度端点必须在 endpoints 里')
  bad((d) => { d.traffic.grayEndpoints = 'web-origin' }, 'grayEndpoints 必须是数组')
  assert.throws(() => loadTrafficPolicy('{ not json'), Error, '非法 JSON ⇒ 抛')
})

test('T11 真实策略文件必须过形状锁(策略是唯一真源,不得与代码漂移)', () => {
  const raw = readFileSync(new URL('../data/canary-policy.json', import.meta.url), 'utf8')
  const policy = loadTrafficPolicy(raw)
  assert.equal(policy.bucketGranularity, 10000)
  assert.equal(policy.bucketSalt, 'ihui-deploy-canary')
  assert.equal(policy.routingKeyHeader, 'x-ihui-canary-key')
  assert.equal(policy.tagHeader, 'x-canary-tag')
  assert.deepEqual(policy.stages, STAGES, '仓内真实档位表必须与本测试的期望一致(改档位须同步改测试)')
  assert.equal(policy.slots.stable.port, 8801)
  assert.equal(policy.slots.canary.port, 8845)
  assert.deepEqual(policy.grayEndpoints, ['web-origin'])
})

test('T12 契约面:buildRampContract 把执行体需要的一切写全(不猜)', () => {
  const policy = loadTrafficPolicy(policyText())
  const contract = buildRampContract({ policy, stage: 'ramp-2', sha: 'abc123', now: '2026-10-27T00:00:00Z' })
  assert.equal(contract.v, 1)
  assert.equal(contract.stage, 'ramp-2')
  assert.equal(contract.percent, 5)
  assert.equal(contract.deploySha, 'abc123')
  assert.equal(contract.routingKeyHeader, 'x-ihui-canary-key')
  assert.equal(contract.tagHeader, 'x-canary-tag')
  assert.equal(contract.bucketGranularity, 10000)
  assert.equal(contract.bucketSalt, 'ihui-deploy-canary')
  assert.deepEqual(contract.slots, { stable: { port: 8801 }, canary: { port: 8845 } })
  assert.equal(contract.updatedAt, '2026-10-27T00:00:00.000Z')

  // off 档 ⇒ 比例 0(契约仍要写全字段,执行体不猜)
  const off = buildRampContract({ policy, stage: OFF_STAGE })
  assert.equal(off.percent, 0)
  assert.equal(off.stage, OFF_STAGE)
})

test('T13 灰期策略派生:只改 grayEndpoints 里的源站端点,其余端点不动', () => {
  const policy = loadTrafficPolicy(policyText())
  const gray = deriveGrayPolicy(policy, 'ramp-1')
  assert.equal(gray.changed, true)
  assert.equal(gray.moved.length, 1)
  assert.equal(gray.moved[0].id, 'web-origin')
  assert.match(gray.moved[0].to, /:8845/, 'web 源站必须改指 canary 槽位')

  const web = gray.policy.endpoints.find((e) => e.id === 'web-origin')
  const api = gray.policy.endpoints.find((e) => e.id === 'api-origin')
  const pub = gray.policy.endpoints.find((e) => e.id === 'web-public')
  assert.match(web.url, /:8845/)
  assert.match(api.url, /:8802/, 'api 源站不动(只切 web 产物)')
  assert.match(pub.url, /aizhs\.top/, '公网腿不动')

  // 原策略对象不得被就地改(派生只出内存副本)
  assert.match(policy.endpoints.find((e) => e.id === 'web-origin').url, /:8801/)

  // off 档 ⇒ 一切不动
  const off = deriveGrayPolicy(policy, OFF_STAGE)
  assert.equal(off.changed, false)
  assert.deepEqual(off.moved, [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
