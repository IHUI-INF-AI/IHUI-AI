#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:dep-advisory-radar.mjs(O65 第 3 期「依赖安全通告 → 可派单票」)。
 *
 * 判据全部 import 生产实现(§22c)。钉六环:
 *  ① 可修判据:空补丁 / `<0.0.0` 不派死票;
 *  ② audit JSON 形状坏一律 throw,不静默当零漏洞;
 *  ③ 同模块多通告合并取最高 severity,排序 critical 优先;
 *  ④ 指纹与通告顺序无关(同模块同集合不分叉);
 *  ⑤ 24h 去重 + 日配额截断;
 *  ⑥ 机器行单行可解析、摘要 ≤8 行;CLI 真跑(离线读数)退出码 0/2。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  MAX_SUMMARY_LINES,
  RadarShapeError,
  buildCandidates,
  formatSummary,
  formatTicketLine,
  isFixable,
  parseAudit,
  registerTicket,
  selectTickets,
} from '../dep-advisory-radar.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SCRIPT = fileURLToPath(new URL('../dep-advisory-radar.mjs', import.meta.url))

const adv = (o = {}) => ({
  findings: [{ version: '1.0.0', paths: ['a>b>c'] }],
  id: 1,
  title: 'T',
  module_name: 'm',
  vulnerable_versions: '<1.1.0',
  patched_versions: '>=1.1.0',
  severity: 'high',
  cwe: 'CWE-1',
  url: 'u',
  ...o,
})
const auditDoc = (advisories) => JSON.stringify({
  advisories: Object.fromEntries(advisories.map((a, i) => [String(a.id ?? i), a])),
  metadata: { vulnerabilities: { info: 0, low: 1, moderate: 2, high: 3, critical: 4 } },
})

test('可修判据:空补丁 / <0.0.0 不派死票,有补丁范围才可修', () => {
  assert.equal(isFixable(''), false)
  assert.equal(isFixable('<0.0.0'), false)
  assert.equal(isFixable('>=4.8.1'), true)
})

test('audit JSON 形状坏一律 throw(不静默当零漏洞)', () => {
  for (const bad of ['not-json', '{}', '{"advisories":[]}', 'null']) {
    assert.throws(() => parseAudit(bad), RadarShapeError, `未拒绝:${bad}`)
  }
  const ok = parseAudit(auditDoc([adv()]))
  assert.equal(ok.rows.length, 1)
  assert.equal(ok.counts.critical, 4)
})

test('同模块合并取最高 severity,critical 排前', () => {
  const c = buildCandidates(parseAudit(auditDoc([adv({ id: 1 }), adv({ id: 2, severity: 'critical' })])).rows)
  assert.equal(c.length, 1)
  assert.equal(c[0].severity, 'critical')
  assert.equal(c[0].count, 2)

  const two = buildCandidates(parseAudit(auditDoc([adv({ id: 1, module_name: 'zz', severity: 'low' }), adv({ id: 2, module_name: 'aa', severity: 'critical' })])).rows)
  assert.equal(two[0].module, 'aa')
})

test('不可修通告不进候选', () => {
  const c = buildCandidates(parseAudit(auditDoc([adv({ id: 1, patched_versions: '<0.0.0' })])).rows)
  assert.equal(c.length, 0)
})

test('指纹与通告顺序无关', () => {
  const a = buildCandidates(parseAudit(auditDoc([adv({ id: 1 }), adv({ id: 3 })])).rows)[0].fingerprint
  const b = buildCandidates(parseAudit(auditDoc([adv({ id: 3 }), adv({ id: 1 })])).rows)[0].fingerprint
  assert.equal(a, b)
  assert.equal(a.length, 12)
})

test('24h 去重与日配额截断都进读数', () => {
  const cands = buildCandidates(parseAudit(auditDoc([
    adv({ id: 1, module_name: 'm1' }),
    adv({ id: 2, module_name: 'm2' }),
    adv({ id: 3, module_name: 'm3' }),
  ])).rows)
  const picked = selectTickets(cands, [], { maxTickets: 2 })
  assert.equal(picked.picked.length, 2)
  assert.equal(picked.suppressed, 1)

  const ledger = [{ action: 'reported', module: cands[0].module, ts: new Date().toISOString() }]
  const again = selectTickets(cands, ledger, { maxTickets: 3 })
  assert.ok(!again.picked.some((x) => x.module === cands[0].module))
})

test('机器行单行可解析;摘要 ≤8 行', () => {
  const c = buildCandidates(parseAudit(auditDoc([adv()])).rows)[0]
  const line = formatTicketLine(c)
  assert.ok(line.startsWith('DEP-ADVISORY '))
  assert.ok(!line.includes('\n'))
  const obj = JSON.parse(line.slice('DEP-ADVISORY '.length))
  assert.equal(obj.module, 'm')
  assert.equal(obj.count, 1)
  assert.equal(obj.kind, 'ticket')

  const s = formatSummary([c], { critical: 1, high: 2, moderate: 3, low: 4 }, { suppressed: 9 })
  assert.ok(s.split('\n').length <= MAX_SUMMARY_LINES)
})

test('登记通道:live-doc-edit 唯一入口 + 取号令牌(不得自己拼号)', () => {
  const dir = mkScratch('dep-radar-reg-')
  try {
    let block = ''
    const calls = []
    const fakeSpawn = (_cmd, argv, opts) => {
      calls.push({ argv, opts })
      block = readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8')
      return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
    }
    const cand = buildCandidates(parseAudit(auditDoc([adv()])).rows)[0]
    const r = registerTicket(cand, { counts: { critical: 0, high: 3, moderate: 0, low: 0 }, spawn: fakeSpawn })
    assert.equal(r.ok, true)
    assert.equal(calls.length, 1)
    assert.ok(String(calls[0].argv[0]).endsWith('live-doc-edit.mjs'), '登记必须走 live-doc-edit 唯一入口')
    assert.equal(calls[0].opts.env.LIVE_DOC, 'PROJECT_PLAN.md')
    assert.match(calls[0].opts.env.LIVE_MSG, /dep-advisory-radar/)
    assert.match(block, /^- \[ \] \{\{NEXT_ID:G\}\} \[dep-advisory\] /, `登记行缺取号令牌:${block}`)
    assert.ok(!/^- \[ \] G-\d+/.test(block), '不得自己拼号')
    assert.ok(!/[0-9a-f]{7,64}/i.test(block), `登记行混入 hex 串会被 live-doc-edit 整块拒落:${block}`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI 真跑:离线读数 exit 0,坏读数/缺文件 exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dep-radar-'))
  try {
    const good = join(dir, 'audit.json')
    writeFileSync(good, auditDoc([adv()]), 'utf8')
    const ok = spawnSync(process.execPath, [SCRIPT, '--audit-json', good, '--ledger', join(dir, 'l.jsonl'), '--json'], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    const payload = JSON.parse(ok.stdout.trim().split(/\r?\n/).pop())
    assert.equal(payload.tickets.length, 1)
    assert.equal(payload.counts.high, 3)

    const bad = join(dir, 'bad.json')
    writeFileSync(bad, 'not-json', 'utf8')
    assert.equal(spawnSync(process.execPath, [SCRIPT, '--audit-json', bad, '--ledger', join(dir, 'l.jsonl')], { encoding: 'utf8' }).status, 2)

    assert.equal(spawnSync(process.execPath, [SCRIPT, '--audit-json', join(dir, 'missing.json'), '--ledger', join(dir, 'l.jsonl')], { encoding: 'utf8' }).status, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
