// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/triage-discovery.mjs(§22c:判据只 import 源脚本 `__test__`,本文件零复制实现)。
// 第 1 期·感知层自动分诊器。票面钉四件事:白名单拒绝 / 同源去重命中 / 每日配额封顶 /
// 分诊三分类各分支;外加输入三形态、REPLACE_FILE 模板形状与守门 117 消毒、CLI 幂等与未判定档。
import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = fileURLToPath(new URL('../triage-discovery.mjs', import.meta.url))
const { __test__ } = await import(pathToFileURL(SRC).href)
const {
  TRIAGE_CLASSES,
  RESULT_PREFIX,
  DiscoveryShapeError,
  loadSourcesConfig,
  parseFindings,
  dedupKeyOf,
  planTriage,
  localDay,
} = __test__

const BOXES = []
function makeBox() {
  const dir = mkScratch('triage-discovery-test-')
  BOXES.push(dir)
  return dir
}
after(() => {
  for (const dir of BOXES) {
    try {
      rmScratch(dir)
    } catch {
      /* 夹具清理失败不影响判据 */
    }
  }
})

const NOW = new Date('2026-10-26T12:00:00.000Z')
const CONFIG = {
  dailyQuota: 5,
  sources: [
    { name: 'guardian-runner', defaultTriage: 'fix-now' },
    { name: 'incident-cluster', defaultTriage: 'dispatchable' },
  ],
}
const finding = (over = {}) => ({
  line: 1,
  source: 'incident-cluster',
  fingerprint: 'fp-001',
  summary: 'API 5xx 簇:GET /api/a 连败',
  ...over,
})

function runCli(args) {
  const r = spawnSync(process.execPath, [SRC, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
const lastLine = (s) =>
  String(s ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop() ?? ''

test('① 白名单拒绝:名单外的源只计数,不进任何档', () => {
  const plan = planTriage({
    config: CONFIG,
    rows: [finding({ source: 'random-mailer' }), finding({ source: 'incident-cluster' })],
    now: NOW,
  })
  assert.equal(plan.rejectedSource.length, 1)
  assert.equal(plan.rejectedSource[0].source, 'random-mailer')
  assert.equal(plan.accepted.length, 1)
  assert.equal(plan.deduped.length, 0)
})

test('② 同源去重:已登记指纹命中即跳过,不重复消耗配额', () => {
  const rows = [finding({ fingerprint: 'fp-old' })]
  const keys = new Set([dedupKeyOf('incident-cluster', 'fp-old')])
  const plan = planTriage({ config: CONFIG, rows, dedupKeys: keys, usedToday: 4, now: NOW })
  assert.equal(plan.deduped.length, 1)
  assert.equal(plan.accepted.length, 0)
  assert.equal(plan.registeredToday, 4, '去重命中不得占配额')
})

test('②b 去重按「来源|指纹」成对:跨源同指纹不并档', () => {
  const keys = new Set([dedupKeyOf('incident-cluster', 'fp-x')])
  const plan = planTriage({ config: CONFIG, rows: [finding({ source: 'guardian-runner', fingerprint: 'fp-x' })], dedupKeys: keys, now: NOW })
  assert.equal(plan.deduped.length, 0)
  assert.equal(plan.fixNow.length, 1)
})

test('③ 配额封顶:超限只计数不落登记,且不进去重集(明日可再来)', () => {
  const rows = [
    finding({ fingerprint: 'fp-a' }),
    finding({ fingerprint: 'fp-b' }),
    finding({ fingerprint: 'fp-c' }),
  ]
  const plan = planTriage({ config: CONFIG, rows, quota: 1, now: NOW })
  assert.equal(plan.accepted.length, 1)
  assert.equal(plan.accepted[0].fingerprint, 'fp-a')
  assert.equal(plan.quotaDeferred.length, 2)
  assert.match(plan.quotaDeferred[0].why, /今日已登记 1\/1/)
  assert.equal(plan.registeredToday, 1)
  // 已接过的指纹当场进本轮 seen:同批同指纹第二条算去重不算二次登记
  const dup = planTriage({ config: CONFIG, rows: [finding({ fingerprint: 'fp-a' }), finding({ fingerprint: 'fp-a' })], quota: 5, now: NOW })
  assert.equal(dup.accepted.length, 1)
  assert.equal(dup.deduped.length, 1)
})

test('③b 配额跨轮续算:usedToday 现读当日面,满额全落 deferred', () => {
  const plan = planTriage({ config: { ...CONFIG, dailyQuota: 5 }, rows: [finding()], usedToday: 5, now: NOW })
  assert.equal(plan.accepted.length, 0)
  assert.equal(plan.quotaDeferred.length, 1)
})

test('④ 三分类:fix-now / dispatchable / observe 各走各档,条目级 triage 覆盖源默认', () => {
  const plan = planTriage({
    config: CONFIG,
    rows: [
      finding({ source: 'guardian-runner', fingerprint: 'f1' }), // 默认 fix-now
      finding({ source: 'guardian-runner', fingerprint: 'f2', triage: 'dispatchable' }), // 覆盖 ⇒ 可派单
      finding({ source: 'incident-cluster', fingerprint: 'f3', triage: 'observe' }), // 覆盖 ⇒ 观察
      finding({ source: 'incident-cluster', fingerprint: 'f4' }), // 默认 dispatchable
    ],
    quota: 2,
    now: NOW,
  })
  assert.equal(plan.fixNow.length, 1)
  assert.equal(plan.observe.length, 1)
  assert.equal(plan.accepted.length, 2)
  assert.deepEqual(plan.accepted.map((a) => a.fingerprint), ['f2', 'f4'])
  assert.deepEqual([...TRIAGE_CLASSES], ['fix-now', 'dispatchable', 'observe'])
})

test('⑤ dispatchable 生成 REPLACE_FILE 载荷模板:形状可用、不自动写台账', () => {
  const plan = planTriage({ config: CONFIG, rows: [finding({ fingerprint: 'deadbeefcafe1234' })], now: NOW })
  assert.equal(plan.accepted.length, 1)
  const t = plan.accepted[0].template
  assert.equal(t.env.LIVE_DOC, 'PROJECT_PLAN.md')
  assert.ok(t.env.LIVE_REPLACE_FILE)
  assert.ok(t.env.LIVE_MSG)
  assert.ok(Array.isArray(t.payload) && t.payload.length === 1)
  const { before, after } = t.payload[0]
  assert.equal(typeof before, 'string')
  assert.match(after, /^- \[ \] \{\{NEXT_ID:G\}\} \[triage-discovery\] /)
  assert.match(after, new RegExp(`登记@${localDay(NOW)}/triage-discovery`), '登记行必须带新鲜日期交代')
  assert.ok(after.length <= 400, `登记行超 400:${after.length}`)
  assert.ok(!after.includes('deadbeefcafe1234'), 'hex 指纹不得进台账行(守门 117 短 sha,身份只住 state)')
})

test('⑥ 输入三形态:JSON 数组 / JSONL / 竖线行文本;坏行单列不连坐', () => {
  const arr = parseFindings(JSON.stringify([finding({ fingerprint: 'a1' }), { source: 'x' }]))
  assert.equal(arr.rows.length, 1)
  assert.equal(arr.bad.length, 1)
  assert.match(arr.bad[0].reason, /缺 source\/summary\/fingerprint/)
  const jsonl = parseFindings(`${JSON.stringify(finding({ fingerprint: 'b1' }))}\nnot-json\n`)
  assert.equal(jsonl.rows.length, 1)
  assert.equal(jsonl.bad.length, 1)
  const pipe = parseFindings('incident-cluster|c1|API 5xx 簇:GET /api/a 连败\nguardian-runner|c2|门 71 红\n坏行\n')
  assert.equal(pipe.rows.length, 2)
  assert.deepEqual(pipe.rows[1], { line: 2, source: 'guardian-runner', summary: '门 71 红', fingerprint: 'c2' })
  assert.equal(pipe.bad.length, 1)
  const badTriage = parseFindings(JSON.stringify([finding({ triage: 'register' })]))
  assert.equal(badTriage.rows.length, 0)
  assert.equal(badTriage.bad.length, 1)
})

test('⑦ 配置形状锁:配额非正整数 / 空 sources / 未知 defaultTriage / 重名 全拒', () => {
  const ok = loadSourcesConfig(JSON.stringify(CONFIG))
  assert.equal(ok.dailyQuota, 5)
  const rejects = [
    JSON.stringify({ dailyQuota: 0, sources: CONFIG.sources }),
    JSON.stringify({ sources: [] }),
    JSON.stringify({ sources: [{ name: 'a', defaultTriage: 'register' }] }),
    JSON.stringify({ sources: [{ name: 'a', defaultTriage: 'observe' }, { name: 'a', defaultTriage: 'observe' }] }),
    '{坏 JSON',
  ]
  for (const text of rejects) {
    assert.throws(() => loadSourcesConfig(text), DiscoveryShapeError, `应拒:${text.slice(0, 40)}`)
  }
})

test('⑧ CLI 端到端:真跑落去重面/当日面/模板件,重跑幂等;dry-run 零落盘', () => {
  const box = makeBox()
  const stateDir = join(box, 'state')
  const inPath = join(box, 'findings.jsonl')
  const cfgPath = join(box, 'sources.json')
  writeFileSync(cfgPath, JSON.stringify({ dailyQuota: 2, sources: CONFIG.sources }), 'utf8')
  writeFileSync(
    inPath,
    [
      JSON.stringify(finding({ fingerprint: 'x1' })),
      JSON.stringify(finding({ fingerprint: 'x2', triage: 'observe' })),
      JSON.stringify(finding({ source: 'unknown-mailer', fingerprint: 'x3' })),
    ].join('\n') + '\n',
    'utf8',
  )
  const r1 = runCli(['--in', inPath, '--config', cfgPath, '--state-dir', stateDir])
  assert.equal(r1.status, 0, r1.stderr)
  assert.match(lastLine(r1.stdout), new RegExp(`^${RESULT_PREFIX} accepted=1 .* observe=1 .* rejected=1 .* quota=1/2$`))
  const dedupPath = join(stateDir, 'triage-dedup.json')
  const dayPath = join(stateDir, `triage-${localDay(new Date())}.json`)
  assert.ok(existsSync(dedupPath), '去重面应落盘')
  assert.ok(existsSync(dayPath), '当日配额面应落盘')
  const dedup = JSON.parse(readFileSync(dedupPath, 'utf8'))
  assert.equal(dedup.entries.length, 1)
  assert.equal(dedup.entries[0].key, dedupKeyOf('incident-cluster', 'x1'))
  assert.ok(existsSync(dedup.entries[0].payload), 'REPLACE_FILE 模板件应落 state 目录')
  const day = JSON.parse(readFileSync(dayPath, 'utf8'))
  assert.equal(day.registered, 1)
  assert.equal(day.counts.rejectedSource, 1)

  const r2 = runCli(['--in', inPath, '--config', cfgPath, '--state-dir', stateDir])
  assert.equal(r2.status, 0, r2.stderr)
  assert.match(lastLine(r2.stdout), /accepted=0 .* deduped=1 /, '重跑必命中去重(幂等)')
  assert.equal(JSON.parse(readFileSync(dedupPath, 'utf8')).entries.length, 1)

  writeFileSync(inPath, JSON.stringify([finding({ fingerprint: 'y9', triage: 'dispatchable' })]) + '\n', 'utf8')
  const r3 = runCli(['--in', inPath, '--config', cfgPath, '--state-dir', stateDir, '--dry-run'])
  assert.equal(r3.status, 0, r3.stderr)
  assert.match(lastLine(r3.stdout), /accepted=1/)
  const dedupAfterDry = JSON.parse(readFileSync(dedupPath, 'utf8'))
  assert.equal(dedupAfterDry.entries.length, 1, 'dry-run 不得写去重面')
})

test('⑨ CLI 未判定档:缺 --in / 输入读不到 / 去重面 JSON 坏 ⇒ exit 2 点名原因', () => {
  const r0 = runCli([])
  assert.equal(r0.status, 2)
  assert.match(r0.stderr, /缺少 --in/)
  const box = makeBox()
  const stateDir = join(box, 'state')
  mkdirSync(stateDir, { recursive: true })
  const r1 = runCli(['--in', join(box, 'missing.json'), '--state-dir', stateDir])
  assert.equal(r1.status, 2)
  assert.match(r1.stderr, /未判定:输入清单读不到/)
  writeFileSync(join(stateDir, 'triage-dedup.json'), '{坏', 'utf8')
  const inPath = join(box, 'f.json')
  writeFileSync(inPath, JSON.stringify([finding()]), 'utf8')
  const r2 = runCli(['--in', inPath, '--state-dir', stateDir])
  assert.equal(r2.status, 2)
  assert.match(r2.stderr, /去重面不可信/)
})

test('⑩ 旗标吞值走 G-322 单源:--quota 非正整数 / 未知旗标 ⇒ exit 2', () => {
  const box = makeBox()
  const inPath = join(box, 'f.json')
  writeFileSync(inPath, JSON.stringify([finding()]), 'utf8')
  const r1 = runCli(['--in', inPath, '--quota', 'abc'])
  assert.equal(r1.status, 2)
  assert.match(r1.stderr, /--quota 需要正整数/)
  const r2 = runCli(['--in', inPath, '--nope'])
  assert.equal(r2.status, 2)
  assert.match(r2.stderr, /未知旗标 --nope/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
