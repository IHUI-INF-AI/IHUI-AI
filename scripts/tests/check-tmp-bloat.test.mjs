// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-tmp-bloat 的镜像测试(§22c:直接 import 源脚本,不复制判据)。
// 重心是**只有跨文件才看得见的三件事**:
//   ① 「有意保留」台账真的被哨兵消费(造好没装车 = 没有,S0 机制清单的老毛病);
//   ② 台账里每一条都带可解析 reviewBy 且落在 tmp 根之内(否则一条台账能把盘上任意大文件"豁免"掉);
//   ③ 登记失效方向恒为"多喊一次":缺件 / 坏 JSON / 到期 ⇒ 一条都不豁免且不静默。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../check-tmp-bloat.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const SRC = readFileSync(join(SCRIPTS, 'check-tmp-bloat.mjs'), 'utf8')
const LEDGER_PATH = join(SCRIPTS, 'data', 'tmp-bloat-keep.json')
const MB = 1024 * 1024

test('装车:哨兵必须真的读台账并走 applyKeep(不是另写一份判据)', () => {
  const body = SRC.slice(SRC.indexOf('function conclusionLine('))
  assert.match(body, /loadKeep\(\)/, 'main 没调 loadKeep ⇒ 台账形同不存在')
  assert.match(body, /applyKeep\(r, keep\.entries\)/, 'main 没把台账交给 applyKeep ⇒ 降档不会发生')
  assert.match(SRC, /scripts', 'data', 'tmp-bloat-keep\.json'|'data', 'tmp-bloat-keep\.json'/)
})

test('台账每条:reviewBy 可解析、rel 落在 .ihui-agent/tmp 根内、带 reason', () => {
  const raw = readFileSync(LEDGER_PATH, 'utf8')
  const { entries, problems } = __test__.parseKeepLedger(raw)
  assert.deepEqual(problems, [], '台账自带问题项 ⇒ 那些条目此刻根本不豁免')
  assert.equal(entries.length, 2, '条目数变了就复核一次(增删都要有理由)')
  for (const e of entries) {
    assert.match(e.reviewBy, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(e.reason.trim().length >= 8, `「${e.rel}」理由太短`)
    assert.equal(e.rel.includes('..'), false)
    assert.equal(e.rel.startsWith('/'), false)
  }
})

test('登记只认精确 rel 或 `/` 结尾前缀:相似名不得被顺手豁免', () => {
  const keep = __test__.parseKeepLedger(
    JSON.stringify({ entries: [{ rel: 'recon/', reason: '取证产物在这里', reviewBy: '2099-01-01' }] }),
  ).entries
  const base = __test__.classify([
    { rel: 'recon/qoder-graph.json', bytes: 160 * MB },
    { rel: 'recon-backup/qoder-graph.json', bytes: 160 * MB },
  ])
  const r = __test__.applyKeep(base, keep, Date.parse('2026-11-21T00:00:00Z'))
  assert.equal(r.kept.length, 1, '前缀登记吃到了相似名 ⇒ 台账被当成通配符')
  assert.equal(r.over50.length, 1, '目录外的越阈件被一起压掉了')
  assert.equal(r.state, 'alarm')
})

test('失效方向恒为多喊一次:坏 JSON / 缺 reason / 缺 reviewBy / 跑出根 ⇒ 一条都不豁免', () => {
  const bad = [
    '{ not json',
    JSON.stringify({ entries: [{ rel: 'a.bin', reviewBy: '2099-01-01' }] }),
    JSON.stringify({ entries: [{ rel: 'a.bin', reason: '够长的理由在这' }] }),
    JSON.stringify({ entries: [{ rel: '../../etc/passwd', reason: '够长的理由在这', reviewBy: '2099-01-01' }] }),
    JSON.stringify({ entries: [{ rel: 'C:/Windows/System32/x.dll', reason: '够长的理由在这', reviewBy: '2099-01-01' }] }),
    JSON.stringify({}),
  ]
  for (const raw of bad) {
    const r = __test__.parseKeepLedger(raw)
    assert.equal(r.entries.length, 0, `坏台账仍读出条目:${raw.slice(0, 40)}`)
    assert.ok(r.problems.length >= 1, `坏台账没有原因读数 ⇒ 静默不豁免`)
  }
})

test('到期的那一条仍要算越阈(不许"登记过就永久静音")', () => {
  const keep = __test__.parseKeepLedger(
    JSON.stringify({ entries: [{ rel: 'r/big.json', reason: '取证产物在这里', reviewBy: '2026-11-01' }] }),
  ).entries
  const r = __test__.applyKeep(__test__.classify([{ rel: 'r/big.json', bytes: 160 * MB }]), keep, Date.parse('2026-11-21T00:00:00Z'))
  assert.equal(r.state, 'alarm')
  assert.equal(r.expired.length, 1, '到期没被点名 ⇒ 人看不出该续期')
  assert.equal(r.over50.length, 1, '到期条目从越阈栏消失 = 永久豁免')
})

test('台账落点常量的默认值就在仓库内、且不在 .ihui-agent/tmp 之外被写坏', () => {
  const def = resolve(SCRIPTS, 'data', 'tmp-bloat-keep.json')
  assert.equal(__test__.KEEP_LEDGER.toLowerCase().endsWith(`${sep}tmp-bloat-keep.json`), true)
  assert.equal(__test__.KEEP_LEDGER.startsWith(dirname(dirname(def))), true, '台账不在 scripts/data 下')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
