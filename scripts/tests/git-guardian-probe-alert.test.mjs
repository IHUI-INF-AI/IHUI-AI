// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { writeFileSync } from 'node:fs'
import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

function mkRunner(results) {
  return () => ({ status: 0, stdout: JSON.stringify({ rc: 1, results }), stderr: '' })
}

function harness(results, extra = {}) {
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
      streakFile: `${dir}/streak.json`,
      // 夹具默认关掉"重复测量合并",让每一格测试各测各的那一维;合并本身由下面两格专测钉住。
      minGapMs: 0,
      logger: (l) => logs.push(l),
      notify: (name, detail, o) => {
        sent.push({ name, detail: String(detail), opts: o || {} })
        return { sent: true }
      },
      runner: mkRunner(results),
      ...extra,
    },
    round(nextResults, nextOpts = {}) {
      if (nextResults) this.opts.runner = mkRunner(nextResults)
      if (nextOpts.now) this.opts.now = nextOpts.now
      return G.auditPublicPathProbe(this.opts)
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

test('B/公网 持续故障照寄(连 2 轮),带 dedupKey + 按段出路(出口 1)', () => {
  const h = harness(B_PUBLIC_BREACH)
  try {
    h.round()
    h.round(null, { now: 1_800_000_000_000 + 30 * 60 * 1000 })
    assert.equal(h.sent.length, 1, `连续两轮越阈必须到人,实寄 ${h.sent.length}`)
    const s = h.sent[0]
    assert.ok(s.name.includes('公网'), `告警名须点名公网,实得:${s.name}`)
    assert.ok(s.opts.dedupKey, '必须给 dedupKey —— 否则 13s/13.5s 撞两个身份,4h 窗口失效')
    assert.match(s.opts.dedupKey, /seq=.*verdict=breach/, `身份应取序列+结论,实得:${s.opts.dedupKey}`)
    assert.ok(/出路:/.test(s.detail), '必须给可执行出路(§5e-1 出口 1),不能只给取证回读')
    assert.match(s.detail, /连续第 2\/2 轮/, '正文必须写清"这是第几轮/门槛几轮" —— 门槛不能是暗箱')
    // 实时读数仍须留在正文(不丢诊断价值)
    assert.match(s.detail, /13\.5s/, '实时读数必须仍在正文里')
  } finally {
    rmScratch(h.dir)
  }
})

// ───────────────── 持续性门槛(2026-10-16 立:单轮尖峰不寄信) ─────────────────

test('门槛默认 2:第一轮只报名不寄信,理由与下一轮可见', () => {
  const h = harness(B_PUBLIC_BREACH)
  try {
    h.round()
    assert.equal(h.sent.length, 0, `单轮尖峰不得寄信(2026-10-16 那封信就是这么来的),实寄 ${h.sent.length}`)
    const line = h.logs.find((l) => l.includes('未达持续性门槛'))
    assert.ok(line, '必须留一条点名"为什么没寄"的日志(抑制不许静默)')
    assert.match(line, /连 1\/2 轮/, `日志要写清算到第几轮,实得:${line}`)
  } finally {
    rmScratch(h.dir)
  }
})

test('变异对照:门槛设 1 时同一份读数立刻寄信(门槛真的在起作用,不是恰好没发)', () => {
  const h = harness(B_PUBLIC_BREACH, { requiredStreak: 1 })
  try {
    h.round()
    assert.equal(h.sent.length, 1, '门槛 1 = 老语义"越阈即寄"必须还活着')
  } finally {
    rmScratch(h.dir)
  }
})

// ───────── 连击的计量单位是**时间**,不是"进过几次这段代码"(2026-10-16 13:19/13:20 实测被绕过一次) ─────────

test('同一节流窗口里的第二轮 ⇒ 算重复测量,不推进连击、不寄信', () => {
  const MIN_GAP = 15 * 60 * 1000
  const T = 1_800_000_000_000
  const h = harness(B_PUBLIC_BREACH, { minGapMs: MIN_GAP })
  try {
    h.round() // 连 1
    h.round(B_PUBLIC_BREACH, { now: T + 60_000 }) // 60 秒后的第二轮(两个执行体撞进同一个窗口)
    assert.equal(h.sent.length, 0, `60 秒内的第二次采样不得凑满"连续两轮",实寄 ${h.sent.length}`)
    const line = h.logs.find((l) => l.includes('重复测量'))
    assert.ok(line, '合并这件事必须报名(不得静默把一轮抹掉)')
    assert.match(line, /仍算连 1\/2 轮/)
    // 而真正过了窗口的下一轮,仍然照常到人
    h.round(B_PUBLIC_BREACH, { now: T + 40 * 60 * 1000 })
    assert.equal(h.sent.length, 1, '隔了 40 分钟的第二轮是真·下一轮,必须到人')
  } finally {
    rmScratch(h.dir)
  }
})

test('反向:关掉合并(minGapMs=0)时,60 秒内的两轮照样凑满门槛(证明上面那格真有牙)', () => {
  const T = 1_800_000_000_000
  const h = harness(B_PUBLIC_BREACH, { minGapMs: 0 })
  try {
    h.round()
    h.round(B_PUBLIC_BREACH, { now: T + 60_000 })
    assert.equal(h.sent.length, 1, '合并被关掉后必须回到"两轮即寄" —— 否则上一格是恒绿的断言')
  } finally {
    rmScratch(h.dir)
  }
})

test('中途恢复合规即清零:再来一次尖峰仍不寄(连击不能跨恢复累积)', () => {
  const okResults = { 'B/公网·常态': { verdict: 'ok', numbers: '样本 10 / 慢 0', reasons: [] } }
  const h = harness(B_PUBLIC_BREACH)
  try {
    h.round() // breach → 连 1
    h.round(okResults) // 恢复 → 清零
    assert.ok(
      h.logs.some((l) => l.includes('连击清零')),
      '清零必须报名(恢复是有终态的事件,不是悄悄不留痕)',
    )
    h.round(B_PUBLIC_BREACH) // 再尖一次 → 仍算第 1 轮
    assert.equal(h.sent.length, 0, `恢复过后再尖一次仍算第 1 轮,不得寄信,实寄 ${h.sent.length}`)
    h.round(B_PUBLIC_BREACH) // 连着第二轮才到人
    assert.equal(h.sent.length, 1, '门槛判据确实还在跑(不是被 ok 轮永久关掉)')
  } finally {
    rmScratch(h.dir)
  }
})

test('未判定轮:既不替故障续命也不替它收尸(连击冻在原值)', () => {
  const und = { 'B/公网·常态': { verdict: 'unjudged', numbers: '样本 0', reasons: ['尺子被掐'] } }
  const h = harness(B_PUBLIC_BREACH)
  try {
    h.round() // streak 1
    h.round(und) // 冻结在 1(不推进也不清零)
    h.round(und) // 再冻一轮 —— 未判定永远不该变成 due
    assert.equal(h.sent.length, 0, '全是未判定不得凑满门槛')
    h.round(B_PUBLIC_BREACH) // streak 2 ⇒ 到人
    assert.equal(h.sent.length, 1, '一轮没量到不得把已确认的持续故障打回第一轮(否则永远发不出去)')
    assert.match(h.sent[0].detail, /连续第 2\/2 轮/, '未判定轮不计入连击 ⇒ 这里是 2/2 而不是 4/2')
  } finally {
    rmScratch(h.dir)
  }
})

test('账本读不出 ⇒ 按"越阈即寄"处理(失效方向只能是多喊一次,绝不能静默)', () => {
  const h = harness(B_PUBLIC_BREACH)
  try {
    h.round() // 正常写出一份账本(streak 1)
    writeFileSync(`${h.dir}/streak.json`, '{ this is not json', 'utf8')
    h.round()
    assert.equal(h.sent.length, 1, `账本坏了必须照样喊人,实寄 ${h.sent.length}`)
    assert.ok(
      h.logs.some((l) => l.includes('读不出') && l.includes('宁多勿默')),
      '必须报名"因为读不出所以降级"',
    )
  } finally {
    rmScratch(h.dir)
  }
})

test('换段是另一件事:入口段与服务段各自计数,旧条目按 TTL 回收且报名(死亡机制)', () => {
  const ENTRY = { 'B/公网·常态·入口段': { verdict: 'breach', leg: 'entry', numbers: '样本 10 / 慢 6', reasons: ['慢样本率 60.0%'] } }
  const SERVICE = { 'B/公网·常态·服务段': { verdict: 'breach', leg: 'service', numbers: '样本 10 / 慢 6', reasons: ['慢样本率 60.0%'] } }
  const DAY = 24 * 60 * 60 * 1000
  const h = harness(ENTRY)
  try {
    h.round()
    h.round(SERVICE, { now: 1_800_000_000_000 + 30 * 60 * 1000 })
    assert.equal(h.sent.length, 0, '服务段刚起,不能继承入口段那一格已经连到 1 的账(两件事)')
    h.round(SERVICE, { now: 1_800_000_000_000 + 2 * DAY })
    assert.equal(h.sent.length, 1, `服务段连满 2 轮必须到人,实寄 ${h.sent.length}`)
    assert.match(h.sent[0].name, /服务段/, '身份里带着段名 ⇒ 收信人一眼知道该查哪一段')
    assert.ok(
      h.logs.some((l) => l.includes('条目回收') && l.includes('入口段')),
      '本轮未再出现的旧身份必须被回收并报名(台账不能只进不出)',
    )
  } finally {
    rmScratch(h.dir)
  }
})

test('出路按定位到的段点名:入口段提隧道/net-doctor,服务段提 web,拿不到定位也仍有出路', () => {
  const mk = (leg, extraKey) => ({
    [`B/公网·常态${extraKey}`]: { verdict: 'breach', ...(leg ? { leg } : {}), numbers: '样本 10 / 慢 6', reasons: ['慢样本率 60.0%'] },
  })
  const cases = [
    ['entry', '·入口段', /Cloudflared/],
    ['service', '·服务段', /IHUI-WEB/],
    ['undetermined', '', /定位拿不到/],
    [null, '', /--report/],
  ]
  for (const [leg, suffix, expect] of cases) {
    const h = harness(mk(leg, suffix))
    try {
      h.round()
      h.round()
      assert.equal(h.sent.length, 1, `leg=${leg} 两轮后必须到人`)
      assert.match(h.sent[0].detail, expect, `leg=${leg} 的出路必须点名能动手的那一段`)
      assert.match(h.sent[0].detail, /出路:/, `leg=${leg} 不许把出路那一行省掉`)
    } finally {
      rmScratch(h.dir)
    }
  }
})

test('判据自身:门槛计数是纯函数,未列 verdict 形态一律不推进(不猜)', () => {
  const f = G.bumpProbeStreak
  assert.ok(f, '镜像测试必须调生产实现(§22c),不许在测试里另抄一份连击判据')
  const r1 = f({}, { x: { verdict: 'breach' } }, { now: 1000, required: 2 })
  assert.equal(r1.info.x.streak, 1)
  assert.equal(r1.info.x.due, false)
  const r2 = f(r1.state, { x: { verdict: 'breach' } }, { now: 2000, required: 2 })
  assert.equal(r2.info.x.due, true, '连满即 due')
  const rUnknown = f({}, { x: { verdict: 'wat' } }, { now: 1000, required: 2 })
  assert.deepEqual(rUnknown.state, {}, '不认识的结论既不计数也不落账')
  assert.equal(rUnknown.info.x, undefined, '更不得给出 due')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
