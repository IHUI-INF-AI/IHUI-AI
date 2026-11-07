// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { planLedgerSeal, sealPathForLedger, verifyLedgerSeal, writeLedgerSeal } from '../lib/ledger-seal.mjs'
import { appendLanding } from '../lib/cross-end-landing-ledger.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const STAMP = '2026-11-07T00:00:00.000Z'

function body(lines) {
  return `${lines.join('\n')}\n`
}

test('封存记下条数、首尾哈希和全文哈希，改中间一行仍判不符', () => {
  const text = body(['{"n":1}', '{"n":2}', '{"n":3}'])
  const planned = planLedgerSeal(text, { segment: 'sample', dropped: 0, timestamp: STAMP })
  assert.equal(planned.ok, true)
  assert.equal(planned.seal.entryCount, 3)
  assert.equal(verifyLedgerSeal(text, planned.seal).verdict, 'ok')
  const flipped = text.replace('{"n":2}', '{"n":9}')
  const verdict = verifyLedgerSeal(flipped, planned.seal)
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'fileSha256-mismatch')
  assert.equal(planLedgerSeal(flipped, { segment: 'sample', dropped: 0, timestamp: STAMP }).seal.entryCount, 3)
})

test('没量到裁掉条数时不封，也不把缺省读成 0', () => {
  const text = body(['{"n":1}'])
  const planned = planLedgerSeal(text, { segment: 'sample', timestamp: STAMP })
  assert.equal(planned.ok, false)
  assert.equal(planned.reason, 'dropped-unmeasured')
  const lying = {
    segment: 'sample',
    entryCount: 1,
    firstHash: 'x',
    lastHash: 'x',
    fileSha256: 'x',
    timestamp: STAMP,
  }
  assert.equal(verifyLedgerSeal(text, lying).reason, 'dropped-unmeasured')
})

test('末行没有换行时整份未判定，不把残行算成一条', () => {
  const planned = planLedgerSeal('{"n":1}', { segment: 'sample', dropped: 2, timestamp: STAMP })
  assert.equal(planned.reason, 'truncated-tail')
  assert.equal(verifyLedgerSeal('{"n":1}', { segment: 'sample', dropped: 2, timestamp: STAMP }).verdict, 'unjudged')
})

test('跨端落地账本每追加一次就重写可复核的封存', () => {
  const root = mkScratch('ledger-seal-')
  try {
    const row = {
      at: STAMP,
      leg: 'sweepWeb',
      path: 'apps/demo/page.tsx',
      blobOid: 'a'.repeat(40),
    }
    const first = appendLanding([row], { root })
    assert.equal(first.appended, 1)
    const ledger = join(root, '.ihui-agent', 'state', 'cross-end-landing.jsonl')
    const seal = JSON.parse(readFileSync(sealPathForLedger(ledger), 'utf8'))
    assert.equal(verifyLedgerSeal(readFileSync(ledger, 'utf8'), seal).verdict, 'ok')
    assert.equal(seal.dropped, 0)
    writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}{"n":`, 'utf8')
    const broken = writeLedgerSeal(ledger, { segment: 'cross-end-landing', dropped: 0, timestamp: STAMP })
    assert.equal(broken.reason, 'truncated-tail')
    assert.equal(existsSync(sealPathForLedger(ledger)), false)
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
