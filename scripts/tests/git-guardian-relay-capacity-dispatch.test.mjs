// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池容量哨兵派发点的接线锁(2026-10-26 立)。
 *
 * 立因:哨兵 `check-relay-capacity-zero.mjs` 造好、自检 23/23、真读数可用,但**零派发点**
 * —— §0.9「造好没装车 = 没有」。本文件钉住:
 *  ① 装车成套:main tick 与 daemon tick 各恰一处真调用、__test__ 恰有导出;
 *  ② 节流有牙:同窗口第二次零调用;
 *  ③ breach ⇒ 喊人,且邮件去重身份只含**计数**(不把会抖动的 provider 清单写进指纹,§5e-3);
 *  ④ 未判定(unjudged)/ 结论不可解析 ⇒ 不冒绿、不喊"容量正常";
 *  ⑤ 判据 import 自 `../git-guardian.mjs` 的 __test__(§22c),不重写业务判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const GUARDIAN_SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const NOW = Date.parse('2026-10-26T10:00:00+08:00')

function harness(out, opts = {}) {
  const scratch = mkScratch('relay-capacity-dispatch')
  const logs = []
  const mails = []
  const res = G.dispatchRelayCapacity({
    now: opts.now ?? NOW,
    intervalMs: 5 * 60 * 1000,
    tickFile: `${scratch}/tick.json`,
    logger: (m) => logs.push(String(m)),
    runner: () => ({ ok: true, out }),
    notifier: (subject, body, meta) => mails.push({ subject, body, meta }),
    ...opts.extra,
  })
  return { res, logs, mails, cleanup: () => rmScratch(scratch) }
}

test('① 装车成套:两处 tick 真调用 + __test__ 导出(注释里的示例不算)', () => {
  const calls = GUARDIAN_SRC.split('\n').filter((l) => /^\s*(if \(!CHECK_ONLY\) )?dispatchRelayCapacity\(\)\s*$/.test(l))
  assert.equal(calls.length, 2, 'main tick 与 daemon tick 各一处')
  assert.equal(typeof G.dispatchRelayCapacity, 'function')
})

test('② 节流有牙:同窗口第二次零调用', () => {
  const scratch = mkScratch('relay-capacity-throttle')
  try {
    const tickFile = `${scratch}/tick.json`
    const base = {
      now: NOW,
      intervalMs: 5 * 60 * 1000,
      tickFile,
      logger: () => {},
      runner: () => ({ ok: true, out: JSON.stringify({ state: 'ok', reason: 'fine', breaches: [] }) }),
      notifier: () => {},
    }
    const first = G.dispatchRelayCapacity(base)
    const second = G.dispatchRelayCapacity(base)
    assert.equal(first.ran, true)
    assert.equal(second.ran, false)
    assert.match(String(second.why), /节流/)
  } finally {
    rmScratch(scratch)
  }
})

test('③ breach ⇒ 喊人,去重身份只含计数(明细不进指纹)', () => {
  const payload = {
    state: 'breach',
    reason: 'x',
    breaches: [
      { kind: 'account_provider_zero_capacity', providerCode: 'qoder', detail: 'qoder 可调度 0' },
      { kind: 'key_provider_zero_capacity', providerCode: 'gemini', detail: 'gemini 可调度 0' },
    ],
  }
  const h = harness(JSON.stringify(payload))
  try {
    assert.equal(h.res.ok, false)
    assert.equal(h.mails.length, 1)
    assert.match(h.mails[0].subject, /号池容量归零/)
    assert.equal(h.mails[0].meta.dedupKey, 'relay-capacity-zero:2')
    assert.equal(h.mails[0].meta.dedupKey.includes('qoder'), false, 'provider 清单不得进去重身份')
    assert.match(h.mails[0].body, /修法/)
  } finally {
    h.cleanup()
  }
})

test('④ 未判定 / 结论不可解析 ⇒ 不冒绿、不喊"容量正常"、不误发信', () => {
  const u = harness(JSON.stringify({ state: 'unjudged', reason: 'psql 不在位' }))
  try {
    assert.equal(u.res.ok, false)
    assert.equal(u.mails.length, 0)
    assert.ok(u.logs.some((l) => l.includes('未判定')))
  } finally {
    u.cleanup()
  }
  const bad = harness('not-json')
  try {
    assert.equal(bad.res.ok, false)
    assert.equal(bad.mails.length, 0)
    assert.ok(bad.logs.some((l) => l.includes('不可解析')))
  } finally {
    bad.cleanup()
  }
})

test('⑤ ok 档不喊人,且日志里带读数摘要', () => {
  const h = harness(JSON.stringify({ state: 'ok', reason: '账号池可调度 3 / key 池可调度 9', breaches: [] }))
  try {
    assert.equal(h.res.ok, true)
    assert.equal(h.mails.length, 0)
    assert.ok(h.logs.some((l) => l.includes('未见归零')))
  } finally {
    h.cleanup()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
