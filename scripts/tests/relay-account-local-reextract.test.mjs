// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 无刷新协议平台「本机重新提取」兜底的决策核心回归(2026-11-12 立)。
 *
 * 钉死的是一条失效方向:只有「refreshable=false + 到期时间已知且进入窗口」才触发
 * 本机提取;能力位缺失/到期未知一律不猜(§0.3 取不到输入不猜)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __parseArgs as parseArgs, __planReextract as planReextract } from '../relay-account-local-reextract.mjs'

const DAY = 86_400_000
const NOW = Date.parse('2026-11-12T12:00:00.000Z')

function row(providerCode, expiresAt) {
  return {
    __sync: {
      providerCode,
      core: { tokenExpiresAt: expiresAt },
    },
  }
}

test('无刷新平台 + 到期在窗口内 ⇒ 进入计划;可刷新平台忽略', () => {
  const payload = {
    providers: {
      doubao: { refreshable: false },
      trae: { refreshable: true },
    },
  }
  const rows = [
    row('doubao', '2026-11-13T00:00:00.000Z'),
    row('trae', '2026-11-13T00:00:00.000Z'),
  ]
  const { dueByProvider } = planReextract(payload, rows, { windowDays: 3, providers: [] }, NOW)
  assert.deepEqual([...dueByProvider.keys()], ['doubao'])
  assert.equal(dueByProvider.get('doubao').count, 1)
})

test('到期还远的行不触发', () => {
  const payload = { providers: { doubao: { refreshable: false } } }
  const rows = [row('doubao', new Date(NOW + 10 * DAY).toISOString())]
  const { dueByProvider } = planReextract(payload, rows, { windowDays: 3, providers: [] }, NOW)
  assert.equal(dueByProvider.size, 0)
})

test('到期时间未知只计数不猜', () => {
  const payload = { providers: { zcode: { refreshable: false } } }
  const rows = [row('zcode', ''), row('zcode', '不是时间')]
  const { dueByProvider, unknownExpiry } = planReextract(
    payload,
    rows,
    { windowDays: 3, providers: [] },
    NOW,
  )
  assert.equal(dueByProvider.size, 0)
  assert.equal(unknownExpiry.get('zcode'), 2)
})

test('能力位缺失 ⇒ 未判定,不触发提取', () => {
  const payload = { providers: { loomy: { accounts: [] } } }
  const rows = [row('loomy', '2026-11-13T00:00:00.000Z')]
  const { dueByProvider } = planReextract(payload, rows, { windowDays: 3, providers: [] }, NOW)
  assert.equal(dueByProvider.size, 0)
})

test('--provider 过滤只保留点名平台', () => {
  const payload = {
    providers: {
      doubao: { refreshable: false },
      raccoon: { refreshable: false },
    },
  }
  const rows = [
    row('doubao', '2026-11-13T00:00:00.000Z'),
    row('raccoon', '2026-11-13T00:00:00.000Z'),
  ]
  const { dueByProvider } = planReextract(
    payload,
    rows,
    { windowDays: 3, providers: ['raccoon'] },
    NOW,
  )
  assert.deepEqual([...dueByProvider.keys()], ['raccoon'])
})

test('参数面:无 --apply 即 dry-run;窗口必须非负;平台白名单拒绝未知值', () => {
  const ok = parseArgs(['--window-days', '0', '--provider', 'doubao'])
  assert.equal(ok.error, null)
  assert.equal(ok.options.apply, false)
  assert.equal(ok.options.windowDays, 0)
  assert.deepEqual(ok.options.providers, ['doubao'])

  assert.match(parseArgs(['--window-days', '-1']).error, /window-days/)
  assert.match(parseArgs(['--provider', 'nope']).error, /不支持的平台/)
  assert.match(parseArgs(['--wat']).error, /未知参数/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
