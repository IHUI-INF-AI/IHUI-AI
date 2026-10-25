// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 镜像测试:scripts/audit-decision-chain.mjs(§22c:判据只 import 源脚本,不复制实现)。
//
// 这只审计器不进提交链(文件名不是 check|scan|guard),所以"被守门看见"这条路不存在;
// 它算错的表现是一张看起来完整的追责报告 —— 故优先钉四件事:缺源必须未判定、理由来源四件齐、
// 断点必须点名环节、§22d 双形态与夹具落点(仓内 .ihui-agent/tmp,不用 os.tmpdir)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

const SRC = fileURLToPath(new URL('../audit-decision-chain.mjs', import.meta.url))
const ROOT = resolve(dirname(SRC), '..')
const BOX = join(ROOT, '.ihui-agent', 'tmp', `audit-decision-chain-test-${process.pid}-${Date.now().toString(36)}`)
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { __test__ } = await import(pathToFileURL(SRC).href)
const {
  buildReport,
  loadSource,
  loadSourcesConfig,
  parseJsonl,
  normalizeAt,
  normalizeCommit,
  isFullSha,
  extractTicketNo,
  parseTimeFlag,
  renderHuman,
  sourcesPath,
  InputError,
} = __test__

const SHA = 'a'.repeat(40)
const PREV = 'b'.repeat(40)
const FACE = '- [ ]（进行中@2026-10-25/r5b）〔归:自进化〕(2026-10-25) 可审计决策链 G-9001'

function writeLines(path, rows) {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
}

mkdirSync(join(BOX, '.ihui-agent', 'state'), { recursive: true })
writeLines(join(BOX, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl'), [
  { ts: '2026-10-24T10:00:00.000Z', mode: 'dispatch', action: 'dispatched', ticketKey: '0123456789abcdef', ticketLine: FACE, exitCode: 0, durationMs: 1234, why: '命中票类白名单' },
])
writeLines(join(BOX, '.ihui-agent', 'state', 'safe-commit-attestation.jsonl'), [
  { ts: '2026-10-24T11:00:00.000Z', kind: 'gates-then-commit', landedSha: SHA, commitFiles: ['scripts/audit-decision-chain.mjs'], gatesRan: true, hookSkipped: false },
])
writeLines(join(BOX, '.ihui-agent', 'deploy-decisions.jsonl'), [
  { v: 1, ts: '2026-10-24T12:00:00.000Z', action: 'rollback', sha: SHA, prevSha: PREV, gateVerdict: 'fail', failDims: ['web'], shadowRc: 1, reason: '健康门禁未过' },
])
mkdirSync(join(BOX, 'bad-root', '.ihui-agent', 'state'), { recursive: true })
writeFileSync(join(BOX, 'bad-root', '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl'), '{"ts":"2026-10-24T10:00:00.000Z","ticketLine":"G-1"}\n{bad json\n', 'utf8')
after(() => rmSync(BOX, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }))

test('① 源配置是路径/字段映射的唯一真相源(三本台账齐全)', () => {
  const cfg = loadSourcesConfig(sourcesPath)
  assert.equal(cfg.ok, true, cfg.why)
  assert.deepEqual(cfg.sources.map((s) => s.id).sort(), ['auto-evolve', 'deploy', 'safe-commit'])
  for (const s of cfg.sources) {
    assert.ok(s.path.endsWith('.jsonl'), `${s.id} 路径不是 jsonl`)
    for (const slot of ['at', 'why', 'change', 'commit']) assert.ok(Array.isArray(s.fields[slot]), `${s.id} 缺 ${slot} 映射`)
  }
})

test('② 源文件缺失 ⇒ 未判定,不得读成空账本记绿', () => {
  const r = buildReport({ root: join(BOX, 'empty-root') })
  assert.equal(r.status, 'undetermined')
  assert.ok(r.sources.every((s) => s.state === 'undetermined'))
  assert.ok(r.sources.every((s) => s.why.includes('文件不存在')))
})

test('③ 按票聚合:理由来源含票面/票号/why/门读数,提交环显式点名断点', () => {
  const r = buildReport({ root: BOX, ticket: 'G-9001' })
  assert.equal(r.chains.length, 1)
  const c = r.chains[0]
  assert.ok(c.理由来源.票面.some((v) => v.includes('可审计决策链')))
  assert.ok(c.理由来源.票号.includes('G-9001'))
  assert.ok(c.理由来源.why.includes('命中票类白名单'))
  assert.ok(c.理由来源.门读数.some((v) => v.includes('exitCode=0')))
  assert.ok(c.链路断点.some((b) => b.startsWith('链路断在「落到哪个提交」')))
  assert.equal(c.理由来源.票面.length > 0 && c.理由来源.why.length > 0, true)
})

test('④ 按 40 位提交聚合:跨台账串起门读数与部署理由', () => {
  const r = buildReport({ root: BOX, commit: SHA })
  assert.equal(r.chains.length, 1)
  const c = r.chains[0]
  assert.ok(c.links.改了什么.some((v) => v.includes('scripts/audit-decision-chain.mjs')))
  assert.ok(c.links.过了哪些门.some((v) => v.includes('gatesRan=true')))
  assert.ok(c.理由来源.why.includes('健康门禁未过'))
  assert.ok(c.链路断点.some((b) => b.startsWith('链路断在「谁/哪张票」')))
})

test('⑤ 时间窗过滤:窗外事件不参与聚合', () => {
  const r = buildReport({ root: BOX, sinceMs: Date.parse('2026-10-24T11:30:00.000Z') })
  assert.equal(r.mode, 'window')
  assert.equal(r.sources.reduce((n, s) => n + s.records, 0), 1)
  assert.equal(r.chains[0].events[0].source, 'deploy')
})

test('⑥ 坏行计未判定面,好行不被吞', () => {
  const rec = loadSource(
    { id: 'x', label: 'x', path: '.ihui-agent/state/auto-evolve-ledger.jsonl', fields: { at: ['ts'], ticketFace: ['ticketLine'] } },
    { root: join(BOX, 'bad-root') },
  )
  assert.equal(rec.state, 'partial')
  assert.equal(rec.badLines, 1)
  assert.equal(rec.records.length, 1)
  assert.deepEqual(parseJsonl('').records, [])
})

test('⑦ 人读输出必须带「理由来源」与断点原文', () => {
  const text = renderHuman(buildReport({ root: BOX, ticket: '0123456789abcdef' }))
  assert.ok(text.includes('理由来源:'))
  assert.ok(text.includes('链路断在「落到哪个提交」'))
  assert.ok(text.includes('台账源:'))
})

test('⑧ 输入校验:短 sha / 坏时间拒绝,CLI 缺输入 exit 2,合法查询 exit 0', () => {
  assert.equal(isFullSha(SHA), true)
  assert.equal(isFullSha(SHA.slice(0, 12)), false)
  assert.equal(normalizeCommit(SHA.slice(0, 12)).full, false)
  assert.throws(() => parseTimeFlag('不是时间', '--since'), InputError)
  assert.equal(normalizeAt(1792633183868), new Date(1792633183868).toISOString())
  assert.equal(extractTicketNo(FACE, loadSourcesConfig(sourcesPath).ticketNoPatterns), 'G-9001')

  const noInput = spawnSync(process.execPath, [SRC], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(noInput.status, 2, noInput.stderr)
  const shortSha = spawnSync(process.execPath, [SRC, '--commit', SHA.slice(0, 12)], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(shortSha.status, 2, shortSha.stderr)

  const ok = spawnSync(process.execPath, [SRC, '--ticket', 'G-9001', '--root', BOX, '--json'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stderr)
  const report = JSON.parse(ok.stdout)
  assert.equal(report.status, 'broken')
  assert.ok(report.chains[0].理由来源.票号.includes('G-9001'))
})

test('⑨ 形态锁:§22d 双形态、夹具落仓内 .ihui-agent/tmp 且不引 os.tmpdir', () => {
  assert.ok(SRC_TEXT.includes('pathToFileURL(process.argv[1])'), '缺 §22d isDirectRun 守卫')
  assert.ok(/^const isDirectRun =/m.test(SRC_TEXT), 'isDirectRun 不是顶层常量')
  assert.ok(!/from 'node:os'/.test(SRC_TEXT), '不得引入 node:os(夹具必须落仓内 .ihui-agent/tmp)')
  assert.ok(SRC_TEXT.includes("'.ihui-agent', 'tmp'"), '自检夹具落点不是 .ihui-agent/tmp')
})
