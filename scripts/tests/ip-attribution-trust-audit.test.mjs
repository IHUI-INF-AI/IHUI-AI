// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ip-attribution-trust-audit 的镜像测试（§22c：判据 import 源脚本的 __test__，本层零复算）。
 *
 * 三格必须钉住：
 *   ① 三态解析：尺子无输出 / 末行不是 JSON ⇒ **未判定**，绝不允许被读成"通过"（§0.3）；
 *   ② 到人语义：只在状态翻转时寄信，同一身份连续多轮必须压住（§5e-1/门 224：抖量不进身份）；
 *   ③ 派发层必须真存在且在位（§0.9"造好没装车 = 没有"）—— git-guardian 的 import 与调用点
 *      由形状锁验证，摘掉任一处即翻红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as A } from '../lib/ip-attribution-trust-audit.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')

test('① 三态解析：ok / breach 原样，坏输入一律未判定', () => {
  assert.equal(A.parseIpTrustVerdict('{"state":"ok","reason":"r"}').state, 'ok')
  assert.equal(A.parseIpTrustVerdict('{"state":"breach","reason":"r"}').state, 'breach')
  assert.equal(A.parseIpTrustVerdict('').state, 'unjudged', '无输出不得当成通过')
  assert.equal(A.parseIpTrustVerdict('not json').state, 'unjudged', '解析不出来不得当成通过')
  assert.equal(A.parseIpTrustVerdict('{"state":"weird"}').state, 'unjudged', '认不出的档位不得猜')
})

test('② 到人语义：只在翻转时寄信', () => {
  assert.equal(A.shouldNotifyIpTrust(null, 'breach'), 'finding', '首次发现必须喊')
  assert.equal(A.shouldNotifyIpTrust('ok', 'breach'), 'finding')
  assert.equal(A.shouldNotifyIpTrust('breach', 'breach'), null, '同一身份连续多轮不得重复寄')
  assert.equal(A.shouldNotifyIpTrust('breach', 'ok'), 'recovered', '恢复也要有一封终点')
  assert.equal(A.shouldNotifyIpTrust('ok', 'ok'), null)
  assert.equal(A.shouldNotifyIpTrust(null, 'ok'), null, '一直好着不制造噪声')
  assert.equal(A.shouldNotifyIpTrust(null, 'unjudged'), null, '未判定不寄信')
})

test('③ 节流：取不到 tick ⇒ 该跑；未到窗口 ⇒ 不跑', () => {
  assert.equal(A.ipTrustAuditDue(1_000_000, NaN), true)
  assert.equal(A.ipTrustAuditDue(1_000_000, 999_999), false)
  assert.equal(A.ipTrustAuditDue(1_000_000, 1_000_000 - 61 * 60 * 1000), true)
})

test('④ 派发全链：breach 寄信带 alertId，连续轮压住，恢复再寄一封', async () => {
  const dir = await mkScratch('ip-trust-audit')
  try {
    const tickFile = path.join(dir, 'tick.json')
    const calls = []
    const logs = []
    let stdout = '{"state":"breach","reason":"表里有 104.16.0.0/12(public)","fix":"先改 cf-connecting-ip"}'

    const runOnce = (nowMs) =>
      A.runIpAttributionTrustAudit({
        now: nowMs,
        tickFile,
        intervalMs: 1000,
        logger: (t) => logs.push(t),
        notify: (title, detail, opts) => calls.push({ title, detail, opts }),
        runner: () => stdout,
      })

    const t0 = 1_800_000_000_000
    const first = runOnce(t0)
    assert.equal(first.state, 'breach')
    assert.equal(calls.length, 1, '首次 breach 必须到人')
    assert.equal(calls[0].opts.alertId, 'ip-attribution-trust', '身份必须是常量，不带条目数/计数')
    assert.match(calls[0].detail, /104\.16\.0\.0/, '正文要带可整改的读数')

    const second = runOnce(t0 + 10_000)
    assert.equal(second.state, 'breach')
    assert.equal(calls.length, 1, '同一身份连续第二轮必须压住（否则就是"一直在报警"）')

    stdout = '{"state":"ok","reason":"全部条目属回环"}'
    const third = runOnce(t0 + 20_000)
    assert.equal(third.state, 'ok')
    assert.equal(calls.length, 2, '恢复要有终点信')
    assert.match(calls[1].title, /已恢复/)
  } finally {
    await rmScratch(dir)
  }
})

test('⑤ 未判定不寄信，但日志必须点名（未判定 ≠ 通过）', async () => {
  const dir = await mkScratch('ip-trust-unjudged')
  try {
    const calls = []
    const logs = []
    const r = A.runIpAttributionTrustAudit({
      now: 1_800_000_000_000,
      tickFile: path.join(dir, 'tick.json'),
      logger: (t) => logs.push(t),
      notify: (...a) => calls.push(a),
      runner: () => '垃圾输出',
    })
    assert.equal(r.state, 'unjudged')
    assert.equal(calls.length, 0, '未判定不占用到人通道')
    assert.ok(logs.some((l) => l.includes('未判定')), '但必须写进日志，不许静默')
  } finally {
    await rmScratch(dir)
  }
})

test('⑥ 接线锁：守护必须 import 本层并在巡检轮真调用（摘掉即翻红）', () => {
  const guardian = readFileSync(path.join(ROOT, 'scripts/git-guardian.mjs'), 'utf8')
  assert.match(guardian, /from '\.\/lib\/ip-attribution-trust-audit\.mjs'/)
  assert.match(guardian, /export function auditIpAttributionTrust/)
  assert.match(guardian, /if \(!CHECK_ONLY\) auditIpAttributionTrust\(\)/)
  assert.match(guardian, /notifyGuardRed\(title, detail, notifyOpts\)/, 'alertId 必须透传，不能被薄接线吃掉')
})

test('⑦ 尺子在位且能自检（防"注册了个不存在的脚本"）', () => {
  assert.ok(existsSync(path.join(ROOT, 'scripts/check-ip-attribution-trust.mjs')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
