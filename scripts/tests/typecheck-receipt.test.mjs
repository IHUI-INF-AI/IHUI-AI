// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * typecheck-receipt.test.mjs — T1 结论回执镜像测试(票 t1-typecheck-budget-calibration §5 落地配套)
 *
 * 钉四格:
 *   ① lib 三判据(校验/可用性/原子写)正反例 —— 失效方向必须一律「回落实跑」,不许半信半疑复用;
 *   ② 接线形状锁:check-typecheck.mjs 主流程真的消费了回执(读档在 spawn 之前、落盘只在有结论分支),
 *      本仓最高频失效型是「判据在、主流程没用它」;
 *   ③ 排障开关与 TTL 的 env 契约;
 *   ④ 降级签名行在回放档仍逐字产出(push-attempt-triage 的 SCOPE_DEGRADE_EVIDENCE_RE 消费它)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  RECEIPT_SCHEMA_V,
  RECEIPT_TTL_MIN_DEFAULT,
  RECEIPT_WRITER,
  readReceipt,
  receiptDisabled,
  receiptTtlMs,
  receiptUsable,
  validateReceipt,
  writeReceipt,
} from '../lib/typecheck-receipt.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = readFileSync(join(ROOT, 'scripts', 'check-typecheck.mjs'), 'utf8')

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const mk = (over = {}) => ({
  v: RECEIPT_SCHEMA_V,
  treeSha: SHA_A,
  finishedAt: Date.now(),
  exitCode: 0,
  errorFiles: [],
  writer: RECEIPT_WRITER,
  ...over,
})

test('L1 往返:写什么读什么;目录不存在也写得进', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-receipt-'))
  try {
    const abs = join(dir, 'nested', 'receipt.json')
    const r = mk({ errorFiles: ['apps/web/src/x.ts'] })
    assert.equal(writeReceipt(abs, r), true)
    assert.deepEqual(readReceipt(abs), r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('L2 结构校验 fail-closed:每格畸形都作废,读侧一律 null', () => {
  for (const bad of [
    null,
    42,
    mk({ v: 99 }),
    mk({ treeSha: 'xyz' }),
    mk({ finishedAt: 'now' }),
    mk({ exitCode: -1 }),
    mk({ exitCode: 1.5 }),
    mk({ errorFiles: 'apps/x.ts' }),
    mk({ errorFiles: [1] }),
    mk({ writer: 'hand' }),
  ]) {
    assert.equal(validateReceipt(bad).ok, false, `应作废: ${JSON.stringify(bad)}`)
  }
  assert.equal(validateReceipt(mk()).ok, true)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-receipt-'))
  try {
    const abs = join(dir, 'r.json')
    writeFileSync(abs, '{not json')
    assert.equal(readReceipt(abs), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('L3 可用性:同树+期内才命中;换树/超期/未来时刻都未命中', () => {
  const now = 1_800_000_000_000
  const ttl = RECEIPT_TTL_MIN_DEFAULT * 60_000
  assert.equal(
    receiptUsable(mk({ finishedAt: now - 60_000 }), { treeSha: SHA_A, nowMs: now, ttlMs: ttl }).ok,
    true,
  )
  assert.equal(
    receiptUsable(mk({ finishedAt: now - 60_000 }), { treeSha: SHA_B, nowMs: now, ttlMs: ttl }).ok,
    false,
  )
  assert.equal(
    receiptUsable(mk({ finishedAt: now - ttl - 1 }), { treeSha: SHA_A, nowMs: now, ttlMs: ttl }).ok,
    false,
  )
  assert.equal(
    receiptUsable(mk({ finishedAt: now + 5000 }), { treeSha: SHA_A, nowMs: now, ttlMs: ttl }).ok,
    false,
  )
  assert.equal(receiptUsable(null, { treeSha: SHA_A, nowMs: now, ttlMs: ttl }).ok, false)
  assert.equal(receiptUsable(mk(), { treeSha: null, nowMs: now, ttlMs: ttl }).ok, false)
})

test('L4 env 契约:TTL 可调、开关可关,非法值回退缺省', () => {
  assert.equal(receiptTtlMs({}), RECEIPT_TTL_MIN_DEFAULT * 60_000)
  assert.equal(receiptTtlMs({ IHUI_TYPECHECK_RECEIPT_TTL_MIN: '30' }), 30 * 60_000)
  assert.equal(
    receiptTtlMs({ IHUI_TYPECHECK_RECEIPT_TTL_MIN: '0' }),
    RECEIPT_TTL_MIN_DEFAULT * 60_000,
  )
  assert.equal(
    receiptTtlMs({ IHUI_TYPECHECK_RECEIPT_TTL_MIN: 'abc' }),
    RECEIPT_TTL_MIN_DEFAULT * 60_000,
  )
  assert.equal(receiptDisabled({}), false)
  assert.equal(receiptDisabled({ IHUI_TYPECHECK_NO_RECEIPT: '1' }), true)
})

test('L5 接线形状锁:读档在 spawn 之前,落盘只在有结论分支,未判定/超时/中断不落盘', () => {
  const iReplay = SRC.indexOf('命中近期全量结论')
  const iSpawn = SRC.indexOf("spawn(process.execPath, [resolve(__dirname, 'typecheck-full.mjs')]")
  assert.ok(iReplay > 0 && iSpawn > 0, '回放档与 spawn 都要在')
  assert.ok(iReplay < iSpawn, '读回执必须发生在 spawn 之前(否则长期票没落地)')
  assert.ok(SRC.includes('_writeReceipt(0, [])'), 'pass 分支必须落盘')
  assert.ok(
    SRC.includes('if (errorFiles.length > 0) _writeReceipt(code ?? 1, errorFiles)'),
    '有结论失败必须落盘',
  )
  const iTimeout = SRC.indexOf("if (outcome.kind === 'timeout')")
  const iInterrupt = SRC.indexOf("if (outcome.kind === 'interrupt')")
  const iUndet = SRC.indexOf('process.exit(UNDETERMINED_EXIT_CODE)')
  const iWriteFail = SRC.indexOf('if (errorFiles.length > 0) _writeReceipt')
  for (const [name, i] of [
    ['timeout', iTimeout],
    ['interrupt', iInterrupt],
    ['undetermined', iUndet],
  ]) {
    assert.ok(i > 0 && i < iWriteFail, `${name} 分支必须在落盘点之前 exit(不落盘)`)
  }
})

test('L6 回放档的降级签名行逐字存在(SCOPE_DEGRADE_EVIDENCE_RE 消费面不漂)', async () => {
  const { SCOPE_DEGRADE_EVIDENCE_RE } = await import('../lib/push-attempt-triage.mjs')
  const line = '[IHUI-SCOPE-DEGRADE] 全部报错文件均不在本次推送范围,降级为警告(exit 0)'
  assert.ok(SRC.split('\n').filter((l) => l.includes(line)).length >= 2, '实跑档与回放档各一行')
  assert.ok(SCOPE_DEGRADE_EVIDENCE_RE.test(line), '签名行必须仍被消费侧正则认得')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
