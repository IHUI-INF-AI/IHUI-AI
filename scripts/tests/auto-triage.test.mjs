// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `auto-triage.mjs` 的镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉九环:
 *  ① 分诊配置形状锁(来源白名单闭集 / 配额正整数);
 *  ② mail-failure 来源:24h 窗计数只收 failed(旧窗与 delivered 不计),台账缺 = 未判定;
 *  ③ 去重与配额成对:24h 窗新鲜拦 / 过期放;配额只数当日 registered;
 *  ④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一登记入口);
 *  ⑤ 第二期三来源进白名单 / clustering 与 minOccurrences 形状锁;
 *  ⑥ 错误签名归一(UUID/数字/URL 查询串/时间戳归零);
 *  ⑦ 聚类:同桶 24h ≥2 可派单 / 单次观察 / 窗外不计;
 *  ⑧ api-logs:JSONL 夹具 + 只读单语句 SQL 形状;
 *  ⑨ grafana-alerts:无 URL 未判定 / 夹具同 alertname 多实例聚一桶;
 *  ⑩ user-feedback:无导出件未判定 / JSONL 夹具聚类。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as tr } from '../auto-triage.mjs'

const LDE_TAIL = 'live-doc-edit.mjs'
const LDE_MSG = '登记必须走 live-doc-edit 唯一入口'

test('① 形状锁:合法过 / 未知源闭集拒 / 配额 0 拒', () => {
  const g = tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['mail-failure', 'index-unmerged'] }))
  assert.equal(g.enabled, true)
  assert.deepEqual(g.sources, ['mail-failure', 'index-unmerged'])
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['everything'] })), tr.TriageShapeError)
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 0, sources: ['mail-failure'] })), tr.TriageShapeError)
  assert.throws(() => tr.loadConfig(() => 'nope'), tr.TriageShapeError)
})

test('② mail-failure:24h 窗只收 failed;缺台账 = 未判定不记绿', () => {
  const now = Date.now()
  const rows = [
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'failed', why: 'conn refused' }),
    JSON.stringify({ at: new Date(now - 7200_000).toISOString(), disposition: 'failed' }),
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'delivered' }),
    JSON.stringify({ at: new Date(now - 25 * 3600_000).toISOString(), disposition: 'failed' }),
    'not-json',
  ]
  const m = tr.readMailFailures(() => rows.join('\n'), now)
  assert.equal(m.status, 'ok')
  assert.equal(m.failed24h, 2)
  assert.equal(m.lastWhy, 'conn refused')
  assert.equal(tr.readMailFailures(() => { throw new Error('missing') }, now).status, 'undetermined')
})

test('③a 去重成对:24h 新鲜拦 / 过期放 / 指纹区分源', () => {
  const now = Date.now()
  const led = [{ action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fp1' }]
  assert.equal(tr.recentlyRegistered(led, 'fp1', now), true)
  assert.equal(tr.recentlyRegistered(led, 'fp2', now), false)
  assert.equal(tr.recentlyRegistered([{ action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString(), fingerprint: 'fp1' }], 'fp1', now), false)
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

test('④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一入口路径 + 取号令牌)', () => {
  const calls = []
  let block = ''
  const fakeSpawn = (_cmd, argv, opts) => {
    calls.push({ argv, opts })
    block = readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8')
    return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
  }
  const r = tr.registerToPlan({ source: 'mail-failure', fingerprint: 'fpt', title: '测试票', evidence: 'e' }, fakeSpawn)
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
  const r = tr.registerToPlan({ source: 's', fingerprint: 'fpf', title: 't', evidence: 'e' }, () => ({ status: 2, stdout: '', stderr: 'boom' }))
  assert.equal(r.ok, false)
  assert.match(r.why, /rc=2/)
})

test('⑤ 形状锁:三个新来源在闭集内 / clustering 与 minOccurrences 形状锁', () => {
  const g = tr.loadConfig(() => JSON.stringify({
    enabled: true,
    dailyRegistrationQuota: 3,
    sources: ['api-logs', 'grafana-alerts', 'user-feedback'],
    clustering: { windowHours: 24, minOccurrences: 2 },
    apiLogs: { jsonl: '', rowLimit: 500 },
    grafanaAlerts: { url: '' },
    userFeedback: { jsonl: '' },
  }))
  assert.deepEqual(g.sources, ['api-logs', 'grafana-alerts', 'user-feedback'])
  assert.deepEqual(tr.clusteringOf(g), { windowHours: 24, minOccurrences: 2 })
  assert.deepEqual(tr.clusteringOf({}), { windowHours: 24, minOccurrences: 2 })
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['mail-failure'], clustering: { minOccurrences: 1 } })), tr.TriageShapeError)
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['mail-failure'], apiLogs: { rowLimit: 0 } })), tr.TriageShapeError)
})

test('⑥ 错误签名归一:数字/ID/UUID/URL 查询串/时间戳归零,不同缺陷不并桶', () => {
  const a = tr.normalizeSignature('GET /api/users/550e8400-e29b-41d4-a716-446655440000?page=2 at 2026-10-25T10:00:00Z code=42')
  const b = tr.normalizeSignature('GET /api/users/123e4567-e89b-12d3-a456-426614174000?page=9 at 2026-10-24T09:11:22Z code=7')
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
    { at: new Date(now - 3600_000).toISOString(), objectText: 'GET /api/a/1 500 boom', label: 'GET /api/a/:n 500', evidence: 'e1' },
    { at: new Date(now - 7200_000).toISOString(), objectText: 'GET /api/a/2 500 boom', label: 'GET /api/a/:n 500', evidence: 'e2' },
    { at: new Date(now - 3 * 3600_000).toISOString(), objectText: 'GET /api/b/9 500 timeout', label: 'GET /api/b/:n 500', evidence: 'e3' },
    { at: new Date(now - 30 * 3600_000).toISOString(), objectText: 'GET /api/a/3 500 boom', label: 'GET /api/a/:n 500', evidence: 'old' },
  ]
  const buckets = tr.clusterRecords({ source: 'api-logs', records, windowHours: 24, minOccurrences: 2, now })
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
      { method: 'GET', path: '/api/users/1', statusCode: 500, error: 'TypeError: x is undefined', at: new Date(now - 3600_000).toISOString() },
      { method: 'GET', path: '/api/users/2', statusCode: 500, error: 'TypeError: x is undefined', at: new Date(now - 7200_000).toISOString() },
      { method: 'POST', path: '/api/orders', statusCode: 502, error: 'upstream timeout', at: new Date(now - 1800_000).toISOString() },
      { method: 'GET', path: '/api/users/3', statusCode: 200, error: '', at: new Date(now - 600_000).toISOString() },
      { method: 'GET', path: '/api/users/4', statusCode: 401, error: 'Unauthorized: token expired', at: new Date(now - 600_000).toISOString() },
    ]
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
    const read = tr.readApiLogs({ jsonlPath: file })
    assert.equal(read.status, 'ok')
    assert.equal(read.records.length, 3, '低于 minStatus(默认 500)的行不得进候选')
    const buckets = tr.clusterRecords({ source: 'api-logs', records: read.records, windowHours: 24, minOccurrences: 2, now })
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
    { labels: { alertname: 'ApiDown', severity: 'critical', instance: 'a:1' }, annotations: { summary: 'API 宕机' }, startsAt: at, status: { state: 'active' } },
    { labels: { alertname: 'ApiDown', severity: 'critical', instance: 'b:2' }, annotations: { summary: 'API 宕机' }, startsAt: at, status: { state: 'active' } },
    { labels: { alertname: 'Old', severity: 'warning', instance: 'c:3' }, annotations: { summary: '已恢复' }, startsAt: at, status: { state: 'suppressed' } },
  ]
  const read = await tr.readGrafanaAlerts({ url: 'http://127.0.0.1:9093/', fetchJson: async (u) => { assert.match(u, /\/api\/v2\/alerts\?active=true&silenced=false$/); return alerts } })
  assert.equal(read.status, 'ok')
  assert.equal(read.records.length, 2, 'suppressed 的告警不得进候选')
  const buckets = tr.clusterRecords({ source: 'grafana-alerts', records: read.records, windowHours: 24, minOccurrences: 2, now })
  assert.equal(buckets.length, 1)
  assert.equal(buckets[0].count, 2)
  assert.equal(buckets[0].disposition, 'register')
  const broken = await tr.readGrafanaAlerts({ url: 'http://127.0.0.1:9093', fetchJson: async () => { throw new Error('ECONNREFUSED') } })
  assert.equal(broken.status, 'undetermined')
})

test('⑩ user-feedback:无导出件 ⇒ 未判定并点名无既有消费面;JSONL 夹具聚类', () => {
  const none = tr.readUserFeedback({ jsonlPath: '' })
  assert.equal(none.status, 'undetermined')
  assert.match(none.why, /无既有消费面/)
  const dir = mkScratch('auto-triage-')
  try {
    const now = Date.now()
    const file = join(dir, 'feedbacks.jsonl')
    const rows = [
      { type: 'bug', title: '导出按钮点了没反应', content: '订单页导出 PDF 无响应', status: 'pending', createdAt: new Date(now - 3600_000).toISOString() },
      { type: 'bug', title: '导出按钮点了没反应', content: '订单页导出 PDF 无响应', status: 'reviewing', createdAt: new Date(now - 7200_000).toISOString() },
      { type: 'bug', title: '旧问题', content: '已修', status: 'resolved', createdAt: new Date(now - 1800_000).toISOString() },
    ]
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
    const read = tr.readUserFeedback({ jsonlPath: file })
    assert.equal(read.status, 'ok')
    assert.equal(read.records.length, 2, '已结反馈不得进候选')
    const buckets = tr.clusterRecords({ source: 'user-feedback', records: read.records, windowHours: 24, minOccurrences: 2, now })
    assert.equal(buckets.length, 1)
    assert.equal(buckets[0].count, 2)
    assert.equal(buckets[0].disposition, 'register')
  } finally {
    rmScratch(dir)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
