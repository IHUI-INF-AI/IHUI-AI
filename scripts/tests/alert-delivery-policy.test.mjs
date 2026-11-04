// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 告警投递降噪策略的判据测试(2026-11-02 立):规则表解析 / 长前缀优先 / 到期失效 / 族级窗口。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  matchAlertDeliveryPolicy,
  parseAlertDeliveryPolicy,
} from '../lib/alert-delivery-policy.mjs'

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
    JSON.stringify([
      ENTRY({ id: 'wide', prefix: '族' }),
      ENTRY({ id: 'narrow', prefix: '族:入口段', cooldownMs: 3600000 }),
    ]),
  ).entries
  const hit = matchAlertDeliveryPolicy('族:入口段:慢', entries, { today: '2026-11-02' })
  assert.equal(hit.entry.id, 'narrow', '长前缀优先')
  assert.equal(
    matchAlertDeliveryPolicy('别的族', entries),
    null,
    '不命中必须返回 null,不得给出假规则',
  )
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
    const second = notifyGuardRed(name, '抖动一封', {
      ...opts,
      now: now + 10 * 60_000,
      dedupKey: 'seq=B;sev=3',
    })
    assert.equal(second.sent, false)
    assert.equal(second.suppressed, true)
    assert.equal(calls.length, 1, '族窗口内不得再派发')
    const st = JSON.parse(readFileSync(stateFile, 'utf8'))
    assert.equal(st['__policy__:public-entry-env'].n, 1, '压住必须计数落盘,下一封正文才有汇总读数')
    assert.equal(st['__policy__:public-entry-env'].ts, now, '计数不得续命窗口起点')

    // 窗口届满(24h)⇒ 必须再发,否则真故障被压成静音。
    const third = notifyGuardRed(name, '跨窗一封', {
      ...opts,
      now: now + 25 * 60 * 60 * 1000,
      dedupKey: 'seq=B;sev=3',
    })
    assert.equal(third.sent, true)
    assert.equal(calls.length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2026-11-03 紧急降噪:五族的 24h 上限 / 首报 / 不误伤(五族逐个实测,不是一句"会变少") ──
const NEW_FAMILIES = [
  {
    id: 'repo-divergence-true',
    name: '本地与 origin/main 分叉(true-divergence)',
    cooldownMs: 86400000,
    cap24: 1,
  },
  {
    id: 'prod-checkout-foreign-work',
    name: '生产签出有只活在盘上的外来改动(正在丢失的边缘)',
    cooldownMs: 86400000,
    cap24: 1,
  },
  { id: 'push-channel-failed', name: 'push-channel', cooldownMs: 86400000, cap24: 1 },
  {
    id: 'immutable-surface-undeclared',
    name: '判据面被静默改动(无 immutable-exempt 声明)',
    cooldownMs: 86400000,
    cap24: 1,
  },
  {
    id: 'client-sync-leg-workbuddy',
    name: 'WorkBuddy 号池保活腿失效(本机会话不再回灌)',
    // 2026-11-03 临时止血:回灌腿计划任务已 DISABLE,guardian 审计尚在 ⇒ 条目保留不删,窗口拉长到 7 天。
    cooldownMs: 604800000,
    cap24: 1,
  },
]
const REAL_POLICY = () =>
  parseAlertDeliveryPolicy(
    readFileSync(new URL('../data/alert-delivery-policy.json', import.meta.url), 'utf8'),
  )

test('策略表:五族各自在册、未到期,且前缀只命中自己的告警名', () => {
  const { entries, invalid } = REAL_POLICY()
  assert.ok(Array.isArray(invalid) && invalid.length === 0, '策略表不得有坏条目')
  for (const fam of NEW_FAMILIES) {
    const byId = entries.find((e) => e.id === fam.id)
    assert.ok(byId, `缺条目 ${fam.id}`)
    assert.equal(byId.prefix, fam.name)
    assert.equal(byId.cooldownMs, fam.cooldownMs)
    const hit = matchAlertDeliveryPolicy(fam.name, entries, { today: '2026-11-03' })
    assert.equal(hit.entry.id, fam.id)
    assert.equal(hit.expired, false, `${fam.id} 不得在 11-03 就到期`)
  }
})

test('不误伤:兄弟告警名不被五族窗口吃掉(另型分叉/另一条腿/另一族都在自己名下)', () => {
  const { entries } = REAL_POLICY()
  const siblings = [
    '本地与 origin/main 分叉(local-backlog)',
    '本地与 origin/main 分叉(remote-ahead-stale)',
    '公网入口隧道腿异常:leg-count',
    '公网入口隧道腿异常:restart-churn',
    'Qoder 号池保活腿失效(本机会话不再回灌)',
    '反馈闭环卡住超 48h:1 条',
    '部署停摆(线上构建 vs origin/main)',
    '元运维巡检红',
    '基础设施告警 — PostgresDown',
    'PostgresDown',
  ]
  for (const s of siblings) {
    const hit = matchAlertDeliveryPolicy(s, entries, { today: '2026-11-03' })
    const ids = NEW_FAMILIES.map((f) => f.id)
    assert.ok(!hit || !ids.includes(hit.entry.id), `兄弟告警「${s}」被五族窗口误命中`)
  }
})

test('族级 24h 上限:身份每轮抖动也只按窗口寄,首报必出、跨窗必再响(逐族实测)', async () => {
  const { notifyGuardRed } = await import('../git-guardian.mjs')
  const t0 = new Date('2026-11-03T00:00:00Z').getTime()
  for (const fam of NEW_FAMILIES) {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-alert-cap-'))
    const stateFile = join(dir, 'notify-state.json')
    const undelFile = join(dir, 'undelivered.json')
    const calls = []
    const dispatch = (arg) => {
      calls.push(arg)
      return { ok: true, why: 'stub' }
    }
    const opts = (now, seq) => ({
      stateFile,
      undelFile,
      dispatch,
      logger: () => {},
      now,
      dedupKey: `${fam.id};seq=${seq}`,
    })
    try {
      // ① 首报(此前从未报过)必须出
      const first = notifyGuardRed(fam.name, '首报', opts(t0, 0))
      assert.equal(first.sent, true, `${fam.id} 首报必须出`)
      // ② 24h 内每 5 分钟重报一次、每次 dedupKey 都变(模拟身份抖动):只允许在 cooldown 整数倍处放行
      const cooldownMin = fam.cooldownMs / 60000
      for (let m = 5; m <= 1435; m += 5) {
        const r = notifyGuardRed(fam.name, `第 ${m} 分钟重报`, opts(t0 + m * 60000, m))
        const due = m % cooldownMin === 0
        assert.equal(r.sent, due, `${fam.id} 在 +${m} 分钟${due ? '该放行' : '不应再寄'}`)
        if (!due) assert.equal(r.suppressed, true)
      }
      assert.equal(calls.length, fam.cap24, `${fam.id} 24h 投递数必须 ≤ ${fam.cap24}`)
      // ③ 窗口届满(+cooldown)必须再响:绝不静音
      const after = notifyGuardRed(
        fam.name,
        '跨窗重报',
        opts(t0 + (fam.cap24 * cooldownMin + 1) * 60000, 'end'),
      )
      assert.equal(after.sent, true, `${fam.id} 跨窗必须再响`)
      assert.equal(calls.length, fam.cap24 + 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('首报不受他族窗口影响:从未报过的新故障(PG 挂了)在别的族窗口内仍立即出', async () => {
  const { notifyGuardRed } = await import('../git-guardian.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'ihui-alert-nocollateral-'))
  const stateFile = join(dir, 'notify-state.json')
  const undelFile = join(dir, 'undelivered.json')
  const calls = []
  const dispatch = (arg) => {
    calls.push(arg)
    return { ok: true, why: 'stub' }
  }
  const base = new Date('2026-11-03T00:00:00Z').getTime()
  try {
    const sent = notifyGuardRed('push-channel', '首报', {
      stateFile,
      undelFile,
      dispatch,
      logger: () => {},
      now: base,
      dedupKey: 'x',
    })
    assert.equal(sent.sent, true)
    const fresh = notifyGuardRed('PostgresDown', '新故障', {
      stateFile,
      undelFile,
      dispatch,
      logger: () => {},
      now: base + 60_000,
      dedupKey: 'pg',
    })
    assert.equal(fresh.sent, true, '从未报过的新故障必须立即出,不得被别的族窗口压住')
    assert.equal(calls.length, 2)
    assert.equal(matchAlertDeliveryPolicy('PostgresDown', REAL_POLICY().entries), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2026-11-03 防「条目被误删/被写短」闸 ──────────────────────────────
// 本文件历史上的真实事故形态是条目被误删(2 条 → 3 条 → 17 条),不是 JSON 写坏:
// 坏 JSON 的加载行为是 {entries:[], error} 不抛异常,运行时落回默认 4h 窗口 ⇒ 不漏报、只会更吵;
// 但条目被静默删掉 = 降噪判据被悄悄拆掉,运行侧毫无信号 ⇒ 只能靠测试硬下限钉住。
test('防误删闸:策略表可解析、顶层数组、条目数≥17、关键条目在册、必需键齐全且 id 唯一', () => {
  const raw = readFileSync(new URL('../data/alert-delivery-policy.json', import.meta.url), 'utf8')
  const parsed = JSON.parse(raw) // 解析不了直接抛 ⇒ 红灯(这条闸宁可吵,不可静默)
  assert.ok(Array.isArray(parsed), '策略表顶层必须是数组')
  // 下限取 2026-11-03 实测值 17。纪律:正常增条目不动这行;正常删条目必须显式改小这个数,
  // 把「拆降噪判据」变成本次提交里看得见的一次决策,而不是静默漂移。
  assert.ok(
    parsed.length >= 17,
    `条目数 ${parsed.length} 低于下限 17 ⇒ 疑似条目被误删/文件被写短`,
  )
  // 加载器不得静默丢条目(丢条目 = 变相误删)
  const { entries, invalid } = parseAlertDeliveryPolicy(raw)
  assert.ok(Array.isArray(entries), 'entries 必须是数组')
  assert.deepEqual(invalid, [], '加载器不得有被跳过的坏条目')
  assert.equal(entries.length, parsed.length, '加载器丢条目 = 变相误删')
  // 关键条目:client-sync-leg-workbuddy 的 7d 窗口是 2026-11-03 临时止血现状。
  // 断言精确毫秒而不放宽为「≥43200000」:上方五族测试(NEW_FAMILIES)早已钉死同一值,
  // 本闸不引入额外脆面;将来恢复腿改回 43200000 时两处测试必须同步改 ⇒ 强制有意识改动,正是想要的效果。
  const wb = parsed.find((e) => e.id === 'client-sync-leg-workbuddy')
  assert.ok(wb, 'client-sync-leg-workbuddy 条目缺失 ⇒ 被误删')
  assert.equal(wb.cooldownMs, 604800000, 'WorkBuddy 回灌腿 7d 止血窗口必须在册')
  // 每条目必需键齐全(非空字符串)+ id 唯一
  const REQUIRED = ['id', 'prefix', 'reason', 'owner', 'reviewBy']
  const seen = new Set()
  for (const e of parsed) {
    for (const k of REQUIRED) {
      assert.ok(
        typeof e[k] === 'string' && e[k].length > 0,
        `条目 ${e.id ?? '(无id)'} 缺必需键 ${k}`,
      )
    }
    assert.ok(!seen.has(e.id), `id 重复: ${e.id}`)
    seen.add(e.id)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
