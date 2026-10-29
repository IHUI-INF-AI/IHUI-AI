// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `auto-triage.mjs` 的镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉十一环:
 *  ① 分诊配置形状锁(来源白名单闭集 / 配额正整数);
 *  ② mail-failure 来源:24h 窗计数只收 failed(旧窗与 delivered 不计),台账缺 = 未判定;
 *  ③ 去重与配额成对:24h 窗新鲜拦 / 过期放;配额只数当日 registered
 *     (时钟显式注入、不读真实钟:00:30 / 23:30 / 跨日 23:59→00:01 三档同形);
 *  ④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一登记入口);
 *  ⑤ 第二期三来源进白名单 / clustering 与 minOccurrences 形状锁;
 *  ⑥ 错误签名归一(UUID/数字/URL 查询串/时间戳归零);
 *  ⑦ 聚类:同桶 24h ≥2 可派单 / 单次观察 / 窗外不计;
 *  ⑧ api-logs:JSONL 夹具 + 只读单语句 SQL 形状;
 *  ⑨ grafana-alerts:无 URL 未判定 / 夹具同 alertname 多实例聚一桶;
 *  ⑩ user-feedback:无导出件未判定 / JSONL 夹具聚类;
 *  ⑪ 参数闸:未知旗标/位置参数/歧义调用当场拒绝(exit 2 + 用法),且零观测账副作用(反向对照
 *     --once/--dry-run/--status/--self-test/--help 仍各自合法)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as tr } from '../auto-triage.mjs'

const LDE_TAIL = 'live-doc-edit.mjs'
const LDE_MSG = '登记必须走 live-doc-edit 唯一入口'

// 时间基准显式本地日历构造(月 1-based),不读真实钟 —— 日切口径见源脚本 registeredToday。
// 夹具若从 Date.now() 相对生成,00:00–01:00 的 now-1h 会落到前一日,每日凌晨必假红(2026-10-28 实测)。
const at = (y, month, day, hh = 0, mm = 0) => new Date(y, month - 1, day, hh, mm, 0, 0)

test('① 形状锁:合法过 / 未知源闭集拒 / 配额 0 拒', () => {
  const g = tr.loadConfig(() =>
    JSON.stringify({
      enabled: true,
      dailyRegistrationQuota: 3,
      sources: ['mail-failure', 'index-unmerged'],
    }),
  )
  assert.equal(g.enabled, true)
  assert.deepEqual(g.sources, ['mail-failure', 'index-unmerged'])
  assert.throws(
    () =>
      tr.loadConfig(() =>
        JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['everything'] }),
      ),
    tr.TriageShapeError,
  )
  assert.throws(
    () =>
      tr.loadConfig(() =>
        JSON.stringify({ enabled: true, dailyRegistrationQuota: 0, sources: ['mail-failure'] }),
      ),
    tr.TriageShapeError,
  )
  assert.throws(() => tr.loadConfig(() => 'nope'), tr.TriageShapeError)
})

test('② mail-failure:24h 窗只收 failed;缺台账 = 未判定不记绿', () => {
  const now = Date.now()
  const rows = [
    JSON.stringify({
      at: new Date(now - 3600_000).toISOString(),
      disposition: 'failed',
      why: 'conn refused',
    }),
    JSON.stringify({ at: new Date(now - 7200_000).toISOString(), disposition: 'failed' }),
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'delivered' }),
    JSON.stringify({ at: new Date(now - 25 * 3600_000).toISOString(), disposition: 'failed' }),
    'not-json',
  ]
  const m = tr.readMailFailures(() => rows.join('\n'), now)
  assert.equal(m.status, 'ok')
  assert.equal(m.failed24h, 2)
  assert.equal(m.lastWhy, 'conn refused')
  assert.equal(
    tr.readMailFailures(() => {
      throw new Error('missing')
    }, now).status,
    'undetermined',
  )
})

test('③a 去重成对:24h 新鲜拦 / 过期放 / 指纹区分源', () => {
  const now = Date.now()
  const led = [
    { action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fp1' },
  ]
  assert.equal(tr.recentlyRegistered(led, 'fp1', now), true)
  assert.equal(tr.recentlyRegistered(led, 'fp2', now), false)
  assert.equal(
    tr.recentlyRegistered(
      [
        {
          action: 'registered',
          ts: new Date(now - 25 * 3600_000).toISOString(),
          fingerprint: 'fp1',
        },
      ],
      'fp1',
      now,
    ),
    false,
  )
  assert.notEqual(tr.fingerprintOf('a', 'x'), tr.fingerprintOf('b', 'x'))
  assert.equal(tr.fingerprintOf('a', 'x'), tr.fingerprintOf('a', 'x'))
})

test('③b 配额:只数当日 registered(observed/quota-deferred 不占额)', () => {
  const now = new Date()
  const led = [
    { action: 'registered', ts: now.toISOString() },
    { action: 'registered', ts: new Date(Date.now() - 25 * 3600_000).toISOString() },
    { action: 'quota-deferred', ts: now.toISOString() },
    { action: 'observed', ts: now.toISOString() },
  ]
  assert.equal(tr.registeredToday(led, now), 1)
})

test('③c 产出待办:纯函数 planTriageActions 把聚类候选推成动作(不 IO、可重放)', () => {
  // 基准显式取本地正午(不读真实钟):任何时区下 now-1h 都落在同一本地日,
  // 不会像 Date.now() 那样在 00:00–01:00 把夹具推进前一日、踩 registeredToday 的日切。
  const now = at(2026, 10, 27, 12, 0).getTime()
  const mk = (source, disposition, fp, title = 't') => ({
    source,
    disposition,
    fp,
    title,
    evidence: 'e',
  })
  // 观察类 → observed,不占配额
  let r = tr.planTriageActions({ findings: [mk('api-logs', 'observe', 'fa')], dailyQuota: 3, now })
  assert.equal(r.actions.length, 1)
  assert.equal(r.actions[0].action, 'observed')
  assert.equal(r.quotaUsed, 0)
  // 可派单 + 空台账 + 配额充足 → register,quotaUsed=1
  r = tr.planTriageActions({ findings: [mk('api-logs', 'register', 'fb')], dailyQuota: 3, now })
  assert.equal(r.actions[0].action, 'register')
  assert.equal(r.quotaUsed, 1)
  // 24h 内同指纹已登记 → skip-dedupe(不占额、不重复登记)
  const led = [
    { action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fc' },
  ]
  r = tr.planTriageActions({
    findings: [mk('api-logs', 'register', 'fc')],
    ledger: led,
    dailyQuota: 3,
    now,
  })
  assert.equal(r.actions[0].action, 'skip-dedupe')
  assert.equal(r.quotaUsed, 1)
  // 超配额 → 多余候选落 quota-deferred(不占额)
  r = tr.planTriageActions({
    findings: [
      mk('a', 'register', 'f1'),
      mk('b', 'register', 'f2'),
      mk('c', 'register', 'f3'),
      mk('d', 'register', 'f4'),
    ],
    dailyQuota: 3,
    now,
  })
  assert.deepEqual(
    r.actions.map((a) => a.action),
    ['register', 'register', 'register', 'quota-deferred'],
  )
  assert.equal(r.quotaUsed, 3)
  // 注入 now 决定可重放:换 now 不影响同输入结果(纯函数)
  const alt = tr.planTriageActions({
    findings: [mk('a', 'register', 'f1')],
    dailyQuota: 3,
    now: now + 999,
  })
  assert.equal(alt.actions[0].action, 'register')
})

test('③d 端到端(纯):归一 → 聚类 → 产出待办,复用既有通道不新建平行体系', () => {
  const now = Date.now()
  const recs = (src, arr) =>
    arr.map((o) => ({
      at: new Date(now - 3600_000).toISOString(),
      objectText: o,
      label: o,
      evidence: o,
    }))
  const apiRecords = recs('api-logs', [
    'GET /api/a/1 500 boom',
    'GET /api/a/2 500 boom', // 同签名 2 次 ⇒ register
    'GET /api/b/9 500 timeout', // 单次 ⇒ observe
  ])
  const gRecords = recs('grafana-alerts', [
    'ApiDown|critical|API 宕机',
    'ApiDown|critical|API 宕机', // 同 alertname 2 实例 ⇒ register
  ])
  const toFindings = (records, source) =>
    tr.clusterRecords({ source, records, windowHours: 24, minOccurrences: 2, now }).map((b) => ({
      source,
      disposition: b.disposition,
      fp: b.fingerprint,
      title: b.label,
      evidence: b.evidence,
    }))
  const findings = [
    ...toFindings(apiRecords, 'api-logs'),
    ...toFindings(gRecords, 'grafana-alerts'),
  ]
  // 归一(数字/UUID 归零)使 /api/a/1 与 /api/a/2 落同一桶
  const apiBuckets = tr.clusterRecords({
    source: 'api-logs',
    records: apiRecords,
    windowHours: 24,
    minOccurrences: 2,
    now,
  })
  assert.ok(
    apiBuckets.some((b) => b.disposition === 'register' && b.count === 2),
    '同签名 2 次应聚成可派单簇',
  )
  // 产出待办:两个 register 簇 + 一个 observe 簇,配额 3 充足
  const plan = tr.planTriageActions({ findings, dailyQuota: 3, now })
  const registers = plan.actions.filter((a) => a.action === 'register')
  const observes = plan.actions.filter((a) => a.action === 'observed')
  assert.equal(registers.length, 2, '两源各一可派单簇')
  assert.equal(observes.length, 1, '单例 api/b 落观察类')
  assert.equal(plan.quotaUsed, 2)
})

test('③e 时间基准可注入:00:30 / 23:30 / 跨日 23:59→00:01 三档同形', () => {
  const mk = (source, disposition, fp) => ({ source, disposition, fp, title: 't', evidence: 'e' })
  const ledgerOf = (tsMs) => [
    { action: 'registered', ts: new Date(tsMs).toISOString(), fingerprint: 'fc' },
  ]
  const planAt = (nowMs, ledger) =>
    tr.planTriageActions({
      findings: [mk('api-logs', 'register', 'fc'), mk('api-logs', 'register', 'fd')],
      ledger,
      dailyQuota: 3,
      now: nowMs,
    })
  const shapeOf = (r) => r.actions.map((a) => a.action)
  const early = at(2026, 10, 28, 0, 30) // 凌晨档:now-1h 会跨日
  const late = at(2026, 10, 27, 23, 30) // 深夜档
  const edgeBefore = at(2026, 10, 27, 23, 59) // 跨日前 1 分钟
  const edgeAfter = at(2026, 10, 28, 0, 1) // 跨日后 1 分钟
  assert.notEqual(
    edgeBefore.toDateString(),
    edgeAfter.toDateString(),
    '这一档必须真的跨本地日,否则等于没判',
  )
  // 档一/档二:夹具各取「自身所在本地日」内的时刻 ⇒ 日切维相同,只差真实时刻
  const earlyPlan = planAt(early.getTime(), ledgerOf(at(2026, 10, 28, 0, 0).getTime()))
  const latePlan = planAt(late.getTime(), ledgerOf(at(2026, 10, 27, 12, 0).getTime()))
  // 档三:同一份 23:00 台账跨过午夜 ⇒ 日切只换配额基数,24h 去重不得松手
  const beforePlan = planAt(edgeBefore.getTime(), ledgerOf(at(2026, 10, 27, 23, 0).getTime()))
  const afterPlan = planAt(edgeAfter.getTime(), ledgerOf(at(2026, 10, 27, 23, 0).getTime()))
  // 同形:三档动作序列必须一致(24h 去重与本地日切正交)
  for (const [name, r] of [
    ['深夜', latePlan],
    ['跨日前', beforePlan],
    ['跨日后', afterPlan],
  ]) {
    assert.deepEqual(shapeOf(r), shapeOf(earlyPlan), `${name}档动作序列必须与凌晨档同形`)
  }
  assert.deepEqual(shapeOf(earlyPlan), ['skip-dedupe', 'register'])
  // 配额基数按本地日切成对:同日内 = 当日已登记 1;跨日后 = 0(同一行仍被 24h 去重拦住)
  assert.equal(earlyPlan.quotaUsed, 2)
  assert.equal(latePlan.quotaUsed, 2)
  assert.equal(beforePlan.quotaUsed, 2)
  assert.equal(afterPlan.quotaUsed, 1)
  // 注入生效的硬证明:同一台账换 now 即换日切结论(若读真实钟,两次必然同值)
  assert.equal(tr.registeredToday(ledgerOf(at(2026, 10, 27, 23, 0).getTime()), edgeBefore), 1)
  assert.equal(tr.registeredToday(ledgerOf(at(2026, 10, 27, 23, 0).getTime()), edgeAfter), 0)
})

test('④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一入口路径 + 取号令牌)', () => {
  const calls = []
  let block = ''
  const fakeSpawn = (_cmd, argv, opts) => {
    calls.push({ argv, opts })
    block = readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8')
    return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
  }
  const r = tr.registerToPlan(
    { source: 'mail-failure', fingerprint: 'fpt', title: '测试票', evidence: 'e' },
    fakeSpawn,
  )
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(String(calls[0].argv[0]).endsWith(LDE_TAIL), LDE_MSG)
  assert.equal(calls[0].opts.env.LIVE_DOC, 'PROJECT_PLAN.md')
  assert.match(calls[0].opts.env.LIVE_MSG, /auto-triage/)
  // 取号必须走令牌(手填/自算号在并发仓必撞号;live-doc-edit 在每次 CAS 按当下 HEAD 现算)
  assert.match(block, /^- \[ \] \{\{NEXT_ID:G\}\} \[auto-triage\] /, `登记行缺取号令牌:${block}`)
  assert.ok(!/^- \[ \] G-\d+/.test(block), '不得自己拼号')
  // 台账行不得出现 7~64 位 hex(守门 117 当短 sha 拒落,2026-10-26 端到端实测)
  assert.ok(!/[0-9a-f]{7,64}/i.test(block), `登记行混入 hex 串会被 live-doc-edit 整块拒落:${block}`)
})

test('④ 登记行守卫:7~64 位 hex 折占位,版本号/日期/域名不误伤', () => {
  assert.equal(tr.sanitizeHexRuns('指纹 abc123def456;'), '指纹 [hex:12];')
  assert.equal(tr.sanitizeHexRuns('decimal.js 16.3.6 2026-10-26'), 'decimal.js 16.3.6 2026-10-26')
  assert.equal(tr.sanitizeHexRuns('sha 0123456789abcdef0123456789abcdef01234567'), 'sha [hex:40]')
})

test('④ 登记通道:live-doc-edit 失败 ⇒ 不冒充已登记', () => {
  const r = tr.registerToPlan(
    { source: 's', fingerprint: 'fpf', title: 't', evidence: 'e' },
    () => ({ status: 2, stdout: '', stderr: 'boom' }),
  )
  assert.equal(r.ok, false)
  assert.match(r.why, /rc=2/)
})

test('⑤ 形状锁:三个新来源在闭集内 / clustering 与 minOccurrences 形状锁', () => {
  const g = tr.loadConfig(() =>
    JSON.stringify({
      enabled: true,
      dailyRegistrationQuota: 3,
      sources: ['api-logs', 'grafana-alerts', 'user-feedback'],
      clustering: { windowHours: 24, minOccurrences: 2 },
      apiLogs: { jsonl: '', rowLimit: 500 },
      grafanaAlerts: { url: '' },
      userFeedback: { jsonl: '' },
    }),
  )
  assert.deepEqual(g.sources, ['api-logs', 'grafana-alerts', 'user-feedback'])
  assert.deepEqual(tr.clusteringOf(g), { windowHours: 24, minOccurrences: 2 })
  assert.deepEqual(tr.clusteringOf({}), { windowHours: 24, minOccurrences: 2 })
  assert.throws(
    () =>
      tr.loadConfig(() =>
        JSON.stringify({
          enabled: true,
          dailyRegistrationQuota: 3,
          sources: ['mail-failure'],
          clustering: { minOccurrences: 1 },
        }),
      ),
    tr.TriageShapeError,
  )
  assert.throws(
    () =>
      tr.loadConfig(() =>
        JSON.stringify({
          enabled: true,
          dailyRegistrationQuota: 3,
          sources: ['mail-failure'],
          apiLogs: { rowLimit: 0 },
        }),
      ),
    tr.TriageShapeError,
  )
})

test('⑥ 错误签名归一:数字/ID/UUID/URL 查询串/时间戳归零,不同缺陷不并桶', () => {
  const a = tr.normalizeSignature(
    'GET /api/users/550e8400-e29b-41d4-a716-446655440000?page=2 at 2026-10-25T10:00:00Z code=42',
  )
  const b = tr.normalizeSignature(
    'GET /api/users/123e4567-e89b-12d3-a456-426614174000?page=9 at 2026-10-24T09:11:22Z code=7',
  )
  assert.equal(a, b)
  assert.match(a, /:uuid/)
  assert.match(a, /:ts/)
  assert.match(a, /:uuid\? at :ts/)
  assert.notEqual(tr.normalizeSignature('boom timeout'), tr.normalizeSignature('boom conn refused'))
  assert.equal(tr.fingerprintOf('api-logs', a), tr.fingerprintOf('api-logs', b))
})

test('⑦ 聚类:同桶 24h ≥2 可派单 / 单次观察 / 窗外不计', () => {
  const now = Date.now()
  const records = [
    {
      at: new Date(now - 3600_000).toISOString(),
      objectText: 'GET /api/a/1 500 boom',
      label: 'GET /api/a/:n 500',
      evidence: 'e1',
    },
    {
      at: new Date(now - 7200_000).toISOString(),
      objectText: 'GET /api/a/2 500 boom',
      label: 'GET /api/a/:n 500',
      evidence: 'e2',
    },
    {
      at: new Date(now - 3 * 3600_000).toISOString(),
      objectText: 'GET /api/b/9 500 timeout',
      label: 'GET /api/b/:n 500',
      evidence: 'e3',
    },
    {
      at: new Date(now - 30 * 3600_000).toISOString(),
      objectText: 'GET /api/a/3 500 boom',
      label: 'GET /api/a/:n 500',
      evidence: 'old',
    },
  ]
  const buckets = tr.clusterRecords({
    source: 'api-logs',
    records,
    windowHours: 24,
    minOccurrences: 2,
    now,
  })
  assert.equal(buckets.length, 2)
  const a = buckets.find((x) => x.signature.includes('/api/a/'))
  const b = buckets.find((x) => x.signature.includes('/api/b/'))
  assert.equal(a.count, 2)
  assert.equal(a.disposition, 'register')
  assert.equal(b.count, 1)
  assert.equal(b.disposition, 'observe')
  assert.equal(a.lastAt, new Date(now - 3600_000).toISOString())
  assert.equal(a.evidence, 'e1')
})

test('⑧ api-logs:JSONL 夹具(不连库)+ 只读单语句 SQL 形状', () => {
  const dir = mkScratch('auto-triage-')
  try {
    const now = Date.now()
    const file = join(dir, 'api-logs.jsonl')
    const rows = [
      {
        method: 'GET',
        path: '/api/users/1',
        statusCode: 500,
        error: 'TypeError: x is undefined',
        at: new Date(now - 3600_000).toISOString(),
      },
      {
        method: 'GET',
        path: '/api/users/2',
        statusCode: 500,
        error: 'TypeError: x is undefined',
        at: new Date(now - 7200_000).toISOString(),
      },
      {
        method: 'POST',
        path: '/api/orders',
        statusCode: 502,
        error: 'upstream timeout',
        at: new Date(now - 1800_000).toISOString(),
      },
      {
        method: 'GET',
        path: '/api/users/3',
        statusCode: 200,
        error: '',
        at: new Date(now - 600_000).toISOString(),
      },
      {
        method: 'GET',
        path: '/api/users/4',
        statusCode: 401,
        error: 'Unauthorized: token expired',
        at: new Date(now - 600_000).toISOString(),
      },
    ]
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
    const read = tr.readApiLogs({ jsonlPath: file })
    assert.equal(read.status, 'ok')
    assert.equal(read.records.length, 3, '低于 minStatus(默认 500)的行不得进候选')
    const buckets = tr.clusterRecords({
      source: 'api-logs',
      records: read.records,
      windowHours: 24,
      minOccurrences: 2,
      now,
    })
    assert.equal(buckets.length, 2)
    assert.equal(buckets.find((x) => x.signature.includes('/api/users/')).count, 2)
    assert.equal(tr.readApiLogs({ jsonlPath: join(dir, 'missing.jsonl') }).status, 'undetermined')
  } finally {
    rmScratch(dir)
  }
  const sql = tr.buildApiLogsSql(10)
  assert.match(sql, /^SELECT\b/)
  assert.match(sql, /api_logs/)
  assert.doesNotMatch(sql, /;/, '只读单语句:分号会让 psqlSpawn 的只读断言拒发')
  assert.match(sql, /LIMIT 10$/)
  assert.match(sql, /status_code >= 500/)
  assert.equal(tr.buildApiLogsSql(0).includes(`LIMIT ${tr.API_LOGS_DEFAULT_LIMIT}`), true)
  const parsed = tr.parseApiLogRows('GET|/api/a|500|boom|2026-10-25 10:00:00+00')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].method, 'GET')
  assert.equal(parsed[0].objectText, 'GET /api/a 500 boom')
})

test('⑨ grafana-alerts:无 URL ⇒ 未判定;注入夹具后同 alertname 多实例聚成一桶', async () => {
  const none = await tr.readGrafanaAlerts({ url: '' })
  assert.equal(none.status, 'undetermined')
  assert.match(none.why, /读取地址/)
  const now = Date.now()
  const at = new Date(now - 3600_000).toISOString()
  const alerts = [
    {
      labels: { alertname: 'ApiDown', severity: 'critical', instance: 'a:1' },
      annotations: { summary: 'API 宕机' },
      startsAt: at,
      status: { state: 'active' },
    },
    {
      labels: { alertname: 'ApiDown', severity: 'critical', instance: 'b:2' },
      annotations: { summary: 'API 宕机' },
      startsAt: at,
      status: { state: 'active' },
    },
    {
      labels: { alertname: 'Old', severity: 'warning', instance: 'c:3' },
      annotations: { summary: '已恢复' },
      startsAt: at,
      status: { state: 'suppressed' },
    },
  ]
  const read = await tr.readGrafanaAlerts({
    url: 'http://127.0.0.1:9093/',
    fetchJson: async (u) => {
      assert.match(u, /\/api\/v2\/alerts\?active=true&silenced=false$/)
      return alerts
    },
  })
  assert.equal(read.status, 'ok')
  assert.equal(read.records.length, 2, 'suppressed 的告警不得进候选')
  const buckets = tr.clusterRecords({
    source: 'grafana-alerts',
    records: read.records,
    windowHours: 24,
    minOccurrences: 2,
    now,
  })
  assert.equal(buckets.length, 1)
  assert.equal(buckets[0].count, 2)
  assert.equal(buckets[0].disposition, 'register')
  const broken = await tr.readGrafanaAlerts({
    url: 'http://127.0.0.1:9093',
    fetchJson: async () => {
      throw new Error('ECONNREFUSED')
    },
  })
  assert.equal(broken.status, 'undetermined')
})

test('⑩ user-feedback:无导出件转直连取数(取不到才未判定并点名);JSONL 夹具聚类', () => {
  const und = tr.readUserFeedback({
    query: () => ({ status: 'undetermined', why: 'psql 不可用(测试夹具)' }),
  })
  assert.equal(und.status, 'undetermined')
  assert.match(und.why, /psql 不可用/)
  const got = tr.readUserFeedback({
    query: () => ({
      status: 'ok',
      records: [{ at: 'x', label: 'bug:A', objectText: 'bug|A|', evidence: 'type=bug' }],
    }),
  })
  assert.equal(got.status, 'ok')
  assert.equal(got.records.length, 1)
  const sql = tr.buildFeedbacksSql(50)
  assert.match(sql, /^SELECT /)
  assert.ok(!sql.includes(';'), '单语句:带分号会被 psqlSpawn 只读断言拒发')
  assert.ok(!/user_id|contact|admin_reply/i.test(sql), '隐私列不得出库')
  assert.match(tr.buildFeedbacksSql(99999), /LIMIT 200$/)
  const parsed = tr.parseFeedbackRows(
    'bug|登录失败|点了没反应|pending|2026-10-28 00:00:00\nspam|x|y|pending|z\nbug|已解决|c|resolved|w',
  )
  assert.equal(parsed.length, 1, '非可派单型与已结档一律剔掉')
  assert.equal(parsed[0].label, 'bug:登录失败')
  const dir = mkScratch('auto-triage-')
  try {
    const now = Date.now()
    const file = join(dir, 'feedbacks.jsonl')
    const rows = [
      {
        type: 'bug',
        title: '导出按钮点了没反应',
        content: '订单页导出 PDF 无响应',
        status: 'pending',
        createdAt: new Date(now - 3600_000).toISOString(),
      },
      {
        type: 'bug',
        title: '导出按钮点了没反应',
        content: '订单页导出 PDF 无响应',
        status: 'reviewing',
        createdAt: new Date(now - 7200_000).toISOString(),
      },
      {
        type: 'bug',
        title: '旧问题',
        content: '已修',
        status: 'resolved',
        createdAt: new Date(now - 1800_000).toISOString(),
      },
    ]
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
    const read = tr.readUserFeedback({ jsonlPath: file })
    assert.equal(read.status, 'ok')
    assert.equal(read.records.length, 2, '已结反馈不得进候选')
    const buckets = tr.clusterRecords({
      source: 'user-feedback',
      records: read.records,
      windowHours: 24,
      minOccurrences: 2,
      now,
    })
    assert.equal(buckets.length, 1)
    assert.equal(buckets[0].count, 2)
    assert.equal(buckets[0].disposition, 'register')
  } finally {
    rmScratch(dir)
  }
})

test('⑪ 参数闸:未知旗标/位置参数/歧义调用 ⇒ 当场拒绝且零副作用(2026-10-28 立)', async () => {
  // 立因:`--help` 曾不被识别而不报错,直接落进真分诊轮(实测往观测账净增 1 行,并 spawn
  // live-doc-edit 去登记 PROJECT_PLAN)。失效方向必须是"多要一次定向说明",绝不能是"多跑一次真轮"。
  assert.ok(tr.KNOWN_FLAGS.has('--once') && tr.KNOWN_FLAGS.has('--dry-run'), '闭集缺文档点名的旗标')
  for (const f of tr.KNOWN_FLAGS) assert.ok(tr.usageText().includes(f), `用法档未点名 ${f}`)

  // 与同族 triage-discovery.mjs 同形的拒绝措辞(未知旗标 <原样 token>)
  assert.match(tr.parseArgs(['--warp']).errors.join('|'), /未知旗标 --warp/)
  assert.match(tr.parseArgs(['D:/junk']).errors.join('|'), /位置参数/)
  assert.match(tr.parseArgs([]).errors.join('|'), /缺少动作旗标/)
  assert.match(tr.parseArgs(['--dry-run']).errors.join('|'), /必须与 --once 同给/)
  assert.match(tr.parseArgs(['--once', '--status']).errors.join('|'), /互斥/)

  // 合法档必须仍然合法(反向对照,否则等于把功能关了)
  for (const argv of [
    ['--once'],
    ['--once', '--dry-run'],
    ['--status'],
    ['--self-test'],
    ['--help'],
    ['-h'],
  ]) {
    assert.equal(
      tr.parseArgs(argv).errors.length,
      0,
      `${argv.join(' ')} 被误拒:${tr.parseArgs(argv).errors}`,
    )
  }
  assert.equal(tr.parseArgs(['--once', '--dry-run']).dryRun, true)
  assert.equal(tr.parseArgs(['--help']).help, true)
  assert.equal(tr.parseArgs(['-h']).help, true)

  // 副作用没发生:拒绝档不得碰观测账(读真实台账只做计数比对,不写)
  const savedExitCode = process.exitCode
  const logLines = []
  const errLines = []
  const realLog = console.log
  const realErr = console.error
  try {
    console.log = (...a) => logLines.push(a.join(' '))
    console.error = (...a) => errLines.push(a.join(' '))
    const before = tr.readTriageLedger().length
    await tr.main(['--help'])
    assert.equal(tr.readTriageLedger().length, before, '拒绝档写了观测账 ⇒ 参数闸失效')
    assert.ok(
      logLines.some((l) => /用法:node scripts\/auto-triage\.mjs/.test(l)),
      '--help 未打印用法',
    )
    assert.notEqual(process.exitCode, 2, '--help 是合法档,不得顶 exit 2')

    logLines.length = 0
    errLines.length = 0
    await tr.main(['--warp'])
    const after = tr.readTriageLedger().length
    assert.equal(after, before, '未知旗标仍落了真轮 ⇒ 副作用回来了')
    assert.equal(process.exitCode, 2, '未知旗标必须给出退出码 2')
    assert.ok(
      errLines.some((l) => /未知旗标 --warp/.test(l)),
      '拒绝未点名未知旗标',
    )
    assert.ok(
      errLines.some((l) => /未执行任何分诊轮/.test(l)),
      '拒绝结论缺"未执行任何分诊轮"',
    )
  } finally {
    console.log = realLog
    console.error = realErr
    process.exitCode = savedExitCode
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
