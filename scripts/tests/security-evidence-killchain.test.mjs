// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 证据链与杀伤链判据锁:这两层一旦漂移,"他打到第几步"和"证据有没有被动过"就都不可信。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { GENESIS, appendEvidence, canonical, makeEntry, readChain, sha256, verifyChain } from '../security/lib/evidence-chain.mjs'
import { assessEntity, classifyEvent, judgeIntent, stageIndex, summarize } from '../security/lib/kill-chain.mjs'

test('canonical: 键序不影响哈希(跨机校验的前提)', () => {
  assert.equal(canonical({ a: 1, b: 2 }), canonical({ b: 2, a: 1 }))
  assert.notEqual(canonical({ a: 1 }), canonical({ a: 2 }))
  assert.equal(canonical({ u: undefined, a: 1 }), canonical({ a: 1 }))
})

test('makeEntry: 自身哈希可复算,seq/prevHash 参与摘要', () => {
  const e = makeEntry({ seq: 0, prevHash: GENESIS, ts: '2026-11-24T00:00:00.000Z', payload: { ip: '1.1.1.1' } })
  const body = `${e.seq}|${e.prevHash}|${e.ts}|${e.payloadHash}`
  assert.equal(sha256(body), e.hash)
  assert.equal(sha256(canonical({ ip: '1.1.1.1' })), e.payloadHash)
})

test('verifyChain: 完整链通过,改任何一条都断在该条', () => {
  const a = makeEntry({ seq: 0, prevHash: GENESIS, ts: 't0', payload: { x: 1 } })
  const b = makeEntry({ seq: 1, prevHash: a.hash, ts: 't1', payload: { x: 2 } })
  const c = makeEntry({ seq: 2, prevHash: b.hash, ts: 't2', payload: { x: 3 } })
  assert.equal(verifyChain([a, b, c]).ok, true)

  const tampered = [{ ...c, payloadHash: sha256('fake') }]
  const v = verifyChain([a, b, tampered[0]])
  assert.equal(v.ok, false)
  assert.equal(v.brokenAt, 2)

  const skipped = verifyChain([a, c])
  assert.equal(skipped.ok, false)
  assert.equal(skipped.brokenAt, 1)
})

test('verifyChain: 空链视为通过(count=0),不冒充有证据', () => {
  const v = verifyChain([])
  assert.equal(v.ok, true)
  assert.equal(v.count, 0)
  assert.equal(v.head, GENESIS)
})

test('appendEvidence: 连续追加后 prevHash 串得上,坏行让整链判坏', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ev-'))
  const p = join(dir, 'chain.jsonl')
  try {
    assert.equal(appendEvidence(p, { a: 1 }).ok, true)
    assert.equal(appendEvidence(p, { a: 2 }).ok, true)
    const { entries, error } = readChain(p)
    assert.equal(error, null)
    assert.equal(entries.length, 2)
    assert.equal(entries[1].prevHash, entries[0].hash)
    assert.equal(verifyChain(entries).ok, true)

    writeFileSync(p, `${readFileSync(p, 'utf8')}not-json\n`, 'utf8')
    const bad = readChain(p)
    assert.match(bad.error, /第 3 行/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('classifyEvent: 扫描器规则归 recon,利用类归 initial-access,认不出的不硬塞', () => {
  assert.equal(classifyEvent({ kind: 'waf-block', detail: 'scanner-ua' }), 'recon')
  assert.equal(classifyEvent({ kind: 'waf-block', detail: 'sqli-union-select' }), 'initial-access')
  assert.equal(classifyEvent({ kind: 'waf', detection: 'Exploit/CVE-2025-55182' }), 'initial-access')
  assert.equal(classifyEvent({ kind: 'host-webshell' }), 'persistence')
  assert.equal(classifyEvent({ kind: 'host-c2' }), 'c2')
  assert.equal(classifyEvent({ kind: 'mystery' }), null)
})

test('assessEntity: blocked=true 停在边界,不升 execution', () => {
  const r = assessEntity([{ kind: 'waf', ip: '1.1.1.1', blocked: true, detection: 'Exploit/CVE-2025-55182' }])
  assert.equal(r.stage, 'initial-access')
  assert.equal(r.entryPassed, false)
  assert.equal(r.blockedAll, true)
})

test('assessEntity: blocked=false 才升 execution(边界被越过)', () => {
  const r = assessEntity([{ kind: 'waf', ip: '1.1.1.1', blocked: false, detection: 'Exploit/CVE-2025-55182' }])
  assert.equal(r.stage, 'execution')
  assert.equal(r.entryPassed, true)
  assert.equal(r.confidence, 'high')
})

test('assessEntity: blocked 缺失不得冒充 true,也不得冒充 false', () => {
  const r = assessEntity([{ kind: 'waf', ip: '1.1.1.1', detection: 'Exploit/CVE-2025-55182' }])
  assert.equal(r.entryPassed, false)
  assert.equal(r.blockedAll, false)
  assert.equal(r.stage, 'initial-access')
})

test('assessEntity: 主机侧发现直接判到 persistence/c2 并标越界', () => {
  const r = assessEntity([{ kind: 'host-webshell', detail: 'C:\\tmp\\x.php' }])
  assert.equal(r.stage, 'persistence')
  assert.equal(r.entryPassed, true)
})

test('judgeIntent: React2Shell 判命令执行权,纯扫描不编目的', () => {
  assert.match(judgeIntent([{ detection: 'Exploit/CVE-2025-55182' }]).intent, /命令执行权/)
  assert.match(judgeIntent([{ detail: 'scanner-ua' }]).intent, /测绘/)
  assert.equal(judgeIntent([{ detail: 'nothing' }]).confidence, 'low')
})

test('summarize: 分布按阶段统计,breached 只数真越界的', () => {
  const s = summarize([
    { stage: 'recon', hits: 2, entryPassed: false },
    { stage: 'execution', hits: 5, entryPassed: true },
  ])
  assert.equal(s.total, 2)
  assert.equal(s.breached, 1)
  assert.equal(s.distribution.execution, 1)
  assert.equal(stageIndex('exfil'), 5)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
