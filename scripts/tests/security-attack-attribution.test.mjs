// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 归因器判据锁：聚合/分组/目的判读三件事一旦漂移,"谁打的我"这份结论就不可信。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildProfiles, groupBySharedInfra, judgePurpose, readRouterGuards } from '../security/attack-attribution.mjs'

test('buildProfiles: 同 IP 的载荷命中与边缘拦截合并计数,时间取首末', () => {
  const waf = [
    { ts: 100, ip: '1.1.1.1', detection: 'Exploit/CVE-2025-55182', host: 'aizhs.top:8801', path: '/_rsc', method: 'POST' },
    { ts: 300, ip: '1.1.1.1', detection: 'Exploit/CVE-2025-55182', host: 'www.aizhs.top:8801', path: '/_rsc', method: 'POST' },
  ]
  const guards = [
    { ts: 200, ip: '1.1.1.1', kind: 'edge guard', reason: 'edge-secret' },
    { ts: 400, ip: '2.2.2.2', kind: 'edge guard', reason: 'edge-secret' },
  ]
  const profiles = buildProfiles(waf, guards)
  const a = profiles.find((p) => p.ip === '1.1.1.1')
  assert.equal(a.waf, 2)
  assert.equal(a.edge, 1)
  assert.equal(a.first, 100)
  assert.equal(a.last, 300)
  assert.deepEqual(a.detections, ['Exploit/CVE-2025-55182'])
  assert.equal(a.hosts.length, 2)
  const b = profiles.find((p) => p.ip === '2.2.2.2')
  assert.equal(b.waf, 0)
  assert.equal(b.edge, 1)
})

test('buildProfiles: 无 ip 的行不得造出空档案', () => {
  const profiles = buildProfiles([{ ts: 1, detection: 'x' }, { ts: 2, ip: '3.3.3.3', detection: 'y' }], [])
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].ip, '3.3.3.3')
})

test('groupBySharedInfra: 同 ASN 同载荷归一组,按 IP 数降序', () => {
  const profiles = [
    { ip: 'a', waf: 3, edge: 9, detections: ['Exploit/CVE-2025-55182'], geo: { as: 'AS139341 ACE' } },
    { ip: 'b', waf: 1, edge: 4, detections: ['Exploit/CVE-2025-55182'], geo: { as: 'AS139341 ACE' } },
    { ip: 'c', waf: 1, edge: 2, detections: [], geo: { as: 'AS396982 Google LLC' } },
  ]
  const groups = groupBySharedInfra(profiles)
  assert.equal(groups[0].asn, 'AS139341 ACE')
  assert.equal(groups[0].count, 2)
  assert.equal(groups[0].waf, 4)
  assert.equal(groups[0].edge, 13)
  assert.equal(groups[1].count, 1)
  assert.equal(groups[1].detection, '(无载荷)')
})

test('judgePurpose: React2Shell 必须判成拿执行权,敏感文件探测必须单列', () => {
  const notes = judgePurpose([
    { detections: ['Exploit/CVE-2025-55182'], paths: ['/..%2f..%2fetc%2fpasswd', '/.env'], geo: {} },
  ])
  const evidence = notes.map((n) => n.evidence).join('|')
  assert.match(evidence, /React2Shell/)
  assert.match(evidence, /敏感文件/)
  for (const n of notes) assert.ok(n.reading.length > 10, '每条判读都要有一句人话解释目的')
})

test('judgePurpose: 无载荷不得凭空编目的', () => {
  assert.deepEqual(judgePurpose([{ detections: [], paths: ['/'], geo: {} }]), [])
})

test('readRouterGuards: 坏行计数但不抛,正常行照收', () => {
  const dir = mkdtempSync(join(tmpdir(), 'attr-'))
  const p = join(dir, 'router.log')
  writeFileSync(p, [
    JSON.stringify({ msg: 'edge guard', ip: '9.9.9.9', reason: 'edge-secret', time: '2026-11-24T00:00:00Z' }),
    '{坏行',
    JSON.stringify({ msg: 'proxy error', ip: '9.9.9.9' }),
  ].join('\n'), 'utf8')
  try {
    const r = readRouterGuards(p)
    assert.equal(r.rows.length, 1)
    assert.equal(r.bad, 1)
    assert.equal(r.rows[0].kind, 'edge guard')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
