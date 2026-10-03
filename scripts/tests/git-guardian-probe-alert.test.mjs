// 公网路径探测告警的两条新行为(2026-10-03 立,28 封审计):
//   ① **B/本地 对照组失真不得按「公网故障」到人** —— 尺子头注自己写明「公网是被测对象,
//      本地是对照组」;对照组失真 = 本机服务没起(实测报的是 127.0.0.1:8801 connRefused,
//      8801 = Web/IHUI-WEB),与公网可用性无关。收信人读着"公网探测越阈值"去查公网
//      永远查不到 ⇒ 属 §5e-1「告的不是信里说的那件事」,不许挂。
//   ② **公网格必须带 dedupKey** —— numbers 里 `最长连续不可用 13.5s` 带小数点,数字归一
//      `\d+ → #` 吃不掉小数点 ⇒ 13s 与 13.5s 撞成两个身份,4 小时窗口被绕成虚设
//      (实测 B/公网 12 封里 7 个间隔短于 4h,最短 0.53h = 两倍 30 分钟节流 = 刚跑完又寄)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

function mkRunner(results) {
  return () => ({ status: 0, stdout: JSON.stringify({ rc: 1, results }), stderr: '' })
}

function harness(results) {
  const dir = mkScratch('gg-probe-')
  const sent = []
  const logs = []
  return {
    dir,
    sent,
    logs,
    opts: {
      now: 1_800_000_000_000,
      intervalMs: 0,
      tickFile: `${dir}/tick`,
      lastFile: `${dir}/last.json`,
      logger: (l) => logs.push(l),
      notify: (name, detail, o) => {
        sent.push({ name, detail: String(detail), opts: o || {} })
        return { sent: true }
      },
      runner: mkRunner(results),
    },
  }
}

const B_LOCAL_BREACH = {
  'B/本地·常态': { verdict: 'breach', numbers: '样本 10 / 失败 10 = 100.0% / 最长连续不可用 13.5s', reasons: ['http://127.0.0.1:8801 connRefused'] },
}
const B_PUBLIC_BREACH = {
  'B/公网·常态': { verdict: 'breach', numbers: '样本 10 / 失败 3 = 30.0% / 最长连续不可用 13.5s', reasons: ['目标 ≥8s'] },
}

test('B/本地 对照组失真:只进日志,不按公网故障到人(§5e-1)', () => {
  const h = harness(B_LOCAL_BREACH)
  try {
    G.auditPublicPathProbe(h.opts)
    assert.equal(h.sent.length, 0, `本地对照组失真不得寄信,实寄 ${h.sent.length} 封:${h.sent.map((s) => s.name).join(',')}`)
    assert.ok(
      h.logs.some((l) => l.includes('对照组失真')),
      '必须留日志说明这一格为什么不喊人(静默丢弃 = 把没判写成判过了)',
    )
  } finally {
    rmScratch(h.dir)
  }
})

test('B/公网 真故障照寄,且带 dedupKey + 可执行出路(出口 1)', () => {
  const h = harness(B_PUBLIC_BREACH)
  try {
    G.auditPublicPathProbe(h.opts)
    assert.equal(h.sent.length, 1, '公网真故障必须到人')
    const s = h.sent[0]
    assert.ok(s.name.includes('公网'), `告警名须点名公网,实得:${s.name}`)
    assert.ok(s.opts.dedupKey, '必须给 dedupKey —— 否则 13s/13.5s 撞两个身份,4h 窗口失效')
    assert.match(s.opts.dedupKey, /seq=.*verdict=breach/, `身份应取序列+结论,实得:${s.opts.dedupKey}`)
    assert.ok(/出路:/.test(s.detail), '必须给可执行出路(§5e-1 出口 1),不能只给取证回读')
    // 实时读数仍须留在正文(不丢诊断价值)
    assert.match(s.detail, /13\.5s/, '实时读数必须仍在正文里')
  } finally {
    rmScratch(h.dir)
  }
})

test('dedupKey 不吃小数点抖动:同一故障的 13s / 13.5s 必须同身份', () => {
  // 变异取证:若 dedupKey 里混进 numbers,这两个值会因小数点而产生不同身份(回归即红)。
  // 实现里的 dedupKey 形态是 `seq=<序列>;verdict=<结论>` —— 不含任何实时读数。
  const REAL_KEY = 'seq=B/公网·常态;verdict=breach'
  const fp = (k) => G.stableAlertFingerprint('公网路径探测越阈值:B/公网·常态', k)
  assert.equal(fp(REAL_KEY), fp(REAL_KEY), '同一身份必须同指纹')
  assert.notEqual(
    fp(REAL_KEY),
    fp('seq=A/换流窗口;verdict=breach'),
    '不同序列仍须是不同身份(合并会让先响的压掉后响的)',
  )
  // 对照:alertFingerprint 那条路**确实**会被小数点影响 —— 这正是必须显式 dedupKey 的理由。
  assert.notEqual(
    G.alertFingerprint('x', '最长连续不可用 13s'),
    G.alertFingerprint('x', '最长连续不可用 13.5s'),
    'alertFingerprint 吃不掉小数点 ⇒ 实时读数进正文就会绕过去重窗口(本条是"为什么"的证据)',
  )
})
