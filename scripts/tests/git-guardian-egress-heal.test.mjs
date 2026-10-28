// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// git-guardian 出口 IP 漂移格「先自愈、后喊人」的镜像测试(§22c:import 源模块 __test__,零复制判据)。
//
// 立因(2026-10-28):EO 源站可编程之后,漂移不再只能到人 —— repair-eo-origin.mjs --apply
// 会改源站并从公网入口验证。本文件钉住接线层的**顺序契约**:
//   ① 漂移 + 自愈成功 ⇒ 不写信、返回 self-healed(自愈过的那一格不该再喊人);
//   ② 漂移 + 自愈失败 ⇒ 必写信,正文带失败形状(含"回滚也失败"),人接班才有据可查;
//   ③ 注入 run 而未注入 heal ⇒ 不跑真自愈(旧用例/取证档行为不变),仍按原路到人;
//   ④ 自愈器没装车 ⇒ 不得冒充"已自愈",照旧到人。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as N } from '../git-guardian.mjs'

const WAN = '218.27.68.23'
const EXPECT = '198.51.100.7'

const probe = (state = 'drift') => ({
  code: state === 'ok' ? 0 : state === 'drift' ? 1 : 2,
  stdout: JSON.stringify({
    state,
    face: 'www.aizhs.top',
    ledgerPath: 'x',
    currentIp: WAN,
    expectedSet: EXPECT,
    sources: [{ url: 'a', ok: true, ip: WAN }],
    verdicts: [
      {
        index: 0,
        face: 'www.aizhs.top',
        judge: true,
        expires: '2026-11-27',
        badReason: '',
        expectedIPv4: EXPECT,
        port: 8801,
        owner: '机主',
        note: '',
        expired: false,
        state: state === 'ok' ? 'ok' : 'drift',
        reason: 'x',
      },
    ],
    counts: { ok: state === 'ok' ? 1 : 0, drift: state === 'drift' ? 1 : 0, unjudged: 0, registered: 0 },
    fatal: '',
  }),
})

/** 每例独立:临时状态文件 + 假 run/heal/notify/logger;run 第 2 次起给 ok(自愈后的复检)。
 *  传了 heal 键(= 显式注入,含 undefined)才覆盖注入面 —— 这正对应源函数的 hasOwnProperty 判据。 */
function harness(given = {}) {
  const { heal, runImpl } = given
  const dir = mkScratch('gg-egress-heal-')
  const sent = []
  const lines = []
  let n = 0
  const run = () => {
    n += 1
    if (runImpl) return runImpl(n)
    return n === 1 ? probe('drift') : probe('ok')
  }
  const opts = {
    run,
    notify: (name, body, meta) => sent.push({ name, body, meta }),
    logger: (l) => lines.push(l),
    now: Date.parse('2026-10-28T02:00:00Z'),
    undetFile: join(dir, 'undet.json'),
    driftFile: join(dir, 'drift.json'),
  }
  if (Object.prototype.hasOwnProperty.call(given, 'heal')) opts.heal = heal
  return { dir, sent, lines, opts }
}

test('E1 漂移 + 自愈成功(repaired)⇒ 不写信,返回 self-healed', () => {
  const h = harness({ heal: () => ({ missing: false, state: 'repaired', oldOrigin: EXPECT, origin: WAN, wan: WAN }) })
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'self-healed', JSON.stringify(out))
  assert.equal(out.healed, 'repaired')
  assert.equal(h.sent.length, 0, '自愈成功后仍写信 ⇒ 人会被已经修好的事叫醒')
  assert.ok(
    h.lines.some((l) => l.includes('已自愈') && l.includes(WAN)),
    `日志没留自愈痕迹:${JSON.stringify(h.lines)}`,
  )
  rmScratch(h.dir)
})

test('E2 自愈器报 ok(EO 现配 == 现测出口)⇒ 也不写信(仓内台账过期不构成告警)', () => {
  const h = harness({ heal: () => ({ missing: false, state: 'ok', origin: WAN, wan: WAN }) })
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'self-healed')
  assert.equal(out.healed, 'ok')
  assert.equal(h.sent.length, 0, '链路本来就对,不该写信')
  rmScratch(h.dir)
})

test('E3 自愈失败 ⇒ 必写信,正文带失败形状;回滚也失败要明写', () => {
  const h = harness({ heal: () => ({ missing: false, state: 'failed', reason: 'entry-unverified:last=502', rolledBack: false }) })
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'drift', JSON.stringify(out))
  assert.equal(out.heal, 'failed')
  assert.equal(h.sent.length, 1, '自愈失败还不喊人 = 静默断网')
  const body = h.sent[0].body
  assert.ok(body.includes('自愈未完成:failed(entry-unverified:last=502)'), body)
  assert.ok(body.includes('[回滚也失败]'), `回滚失败没明写:${body}`)
  assert.ok(h.sent[0].meta && h.sent[0].meta.severity === 'critical', '漂移仍是 critical')
  rmScratch(h.dir)
})

test('E4 注入 run 而未注入 heal ⇒ 不跑真自愈(旧用例/取证档行为不变),按原路到人', () => {
  const h = harness({})
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'drift', JSON.stringify(out))
  assert.equal(out.heal, 'skipped')
  assert.equal(h.sent.length, 1, '无自愈注入时应维持旧的到人行为')
  assert.ok(!h.sent[0].body.includes('自愈未完成'), '没跑自愈却写"自愈未完成"= 撒谎')
  rmScratch(h.dir)
})

test('E5 自愈器没装车(missing)⇒ 不得冒充已自愈,照旧到人', () => {
  const h = harness({ heal: () => ({ missing: true }) })
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'drift')
  assert.equal(out.heal, 'skipped')
  assert.equal(h.sent.length, 1)
  rmScratch(h.dir)
})

test('E6 自愈成功但复检仍非 ok ⇒ 不写"已验证",日志如实留"下轮重读"', () => {
  const h = harness({
    heal: () => ({ missing: false, state: 'repaired', oldOrigin: EXPECT, origin: WAN }),
    runImpl: () => probe('drift'),
  })
  const out = N.auditEgressIpDrift(h.opts)
  assert.equal(out.state, 'self-healed')
  assert.ok(
    h.lines.some((l) => l.includes('运行时台账下轮重读')),
    `复检未过却报"已验证"= 谎报:${JSON.stringify(h.lines)}`,
  )
  rmScratch(h.dir)
})
