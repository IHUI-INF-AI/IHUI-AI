// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 告警投递降噪策略的判据测试(2026-11-02 立):规则表解析 / 长前缀优先 / 到期失效 / 族级窗口。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { matchAlertDeliveryPolicy, parseAlertDeliveryPolicy } from '../lib/alert-delivery-policy.mjs'

const ENTRY = (over = {}) => ({
  id: 'x',
  prefix: '族',
  cooldownMs: 24 * 60 * 60 * 1000,
  reason: '外部线路环境类,本机不可整改',
  owner: 'git-guardian',
  reviewBy: '2026-12-31',
  ...over,
})

test('策略表:坏 JSON / 非数组不抛;坏条目跳过并留名', () => {
  assert.deepEqual(parseAlertDeliveryPolicy('{oops'), { entries: [], error: '配置不是合法 JSON' })
  assert.deepEqual(parseAlertDeliveryPolicy('{}'), { entries: [], error: '配置顶层必须是数组' })
  const r = parseAlertDeliveryPolicy(JSON.stringify([ENTRY({ id: 'ok' }), { id: 'no-prefix' }]))
  assert.equal(r.entries.length, 1, '缺 prefix/cooldown 的条目必须被跳过')
  assert.deepEqual(r.invalid, ['no-prefix'], '坏条目要留名,配置写坏时人看得见')
})

test('匹配:长前缀优先(窄规则不被宽规则吞掉);到期返回 expired ⇒ 调用方必须不压', () => {
  const entries = parseAlertDeliveryPolicy(
    JSON.stringify([ENTRY({ id: 'wide', prefix: '族' }), ENTRY({ id: 'narrow', prefix: '族:入口段', cooldownMs: 3600000 })]),
  ).entries
  const hit = matchAlertDeliveryPolicy('族:入口段:慢', entries, { today: '2026-11-02' })
  assert.equal(hit.entry.id, 'narrow', '长前缀优先')
  assert.equal(matchAlertDeliveryPolicy('别的族', entries), null, '不命中必须返回 null,不得给出假规则')
  const expired = matchAlertDeliveryPolicy('族:入口段', entries, { today: '2027-01-01' })
  assert.equal(expired.expired, true, '到期即失效:方向必须是多喊一次,绝不静默')
  assert.equal(expired.entry.id, 'narrow')
})

test('族级窗口:同族指纹抖动(sev 2↔3)24h 内只发首封,压住计数落盘;窗口届满再发', async () => {
  const { notifyGuardRed } = await import('../git-guardian.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'ihui-alert-policy-'))
  const stateFile = join(dir, 'notify-state.json')
  const undelFile = join(dir, 'undelivered.json')
  const calls = []
  const dispatch = (arg) => {
    calls.push(arg)
    return { ok: true, why: 'stub' }
  }
  const name = '公网路径探测越阈值:B/公网·常态·入口段'
  const opts = { stateFile, undelFile, dispatch, logger: () => {}, dedupKey: 'seq=B;sev=2' }
  const now = Date.now()
  try {
    const first = notifyGuardRed(name, '第一封', { ...opts, now })
    assert.equal(first.sent, true, '首封必须发')
    assert.equal(calls.length, 1)

    // 同一段故障的 sev 档从 2 抖到 3 ⇒ 指纹换了,但族窗口必须仍然压住(这正是轰炸的真因)。
    const second = notifyGuardRed(name, '抖动一封', { ...opts, now: now + 10 * 60_000, dedupKey: 'seq=B;sev=3' })
    assert.equal(second.sent, false)
    assert.equal(second.suppressed, true)
    assert.equal(calls.length, 1, '族窗口内不得再派发')
    const st = JSON.parse(readFileSync(stateFile, 'utf8'))
    assert.equal(st['__policy__:public-entry-env'].n, 1, '压住必须计数落盘,下一封正文才有汇总读数')
    assert.equal(st['__policy__:public-entry-env'].ts, now, '计数不得续命窗口起点')

    // 窗口届满(24h)⇒ 必须再发,否则真故障被压成静音。
    const third = notifyGuardRed(name, '跨窗一封', { ...opts, now: now + 25 * 60 * 60 * 1000, dedupKey: 'seq=B;sev=3' })
    assert.equal(third.sent, true)
    assert.equal(calls.length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
