// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门级「有账豁免」台账的窄面用例(2026-11-07 裁定第 4 条:每条断言可单跑、可单独红)。
// 单跑:node --test --test-name-pattern="T1" scripts/tests/gate-exemption-ledger.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGateExemptions, loadGateExemptions, GATE_EXEMPTION_LEDGER_REL } from '../lib/gate-exemption-ledger.mjs'

const TODAY = '2026-11-07'

const row = (over = {}) =>
  JSON.stringify({
    gate: '41',
    object: '8 条他人超窗分支',
    owner: 'infra 线',
    baseline: 'cdd148ba02 单跑 exit 1',
    expires: '2026-11-14',
    touched: '否',
    ...over,
  })

test('T1 六字段齐全且未过期 ⇒ 命中,且原文透传', () => {
  const r = parseGateExemptions(row(), TODAY)
  assert.equal(r.disabled, false)
  const m = r.match('41')
  assert.ok(m, '应当命中门 41')
  assert.equal(m.owner, 'infra 线')
  assert.equal(m.expires, '2026-11-14')
})

test('T2 缺字段(owner)⇒ 该行不成立且整份不生效', () => {
  const r = parseGateExemptions(row({ owner: '' }), TODAY)
  assert.equal(r.disabled, true)
  assert.equal(r.match('41'), null)
  assert.match(r.problems.join(';'), /缺字段/)
})

test('T3 到期日已过 ⇒ 回红,不自动续期', () => {
  const r = parseGateExemptions(row({ expires: '2026-11-06' }), TODAY)
  assert.equal(r.match('41'), null)
  assert.match(r.problems.join(';'), /已过期/)
})

test('T4 同一门第二次上账 ⇒ 该门豁免全部失效(含历史行)', () => {
  const text = `${row()}\n${row({ expires: '2026-12-01' })}`
  const r = parseGateExemptions(text, TODAY)
  assert.equal(r.match('41'), null)
  assert.match(r.problems.join(';'), /第二次上豁免账/)
})

test('T5 本线触碰(touched=是)⇒ 不适用存量豁免', () => {
  const r = parseGateExemptions(row({ touched: '是' }), TODAY)
  assert.equal(r.match('41'), null)
  assert.match(r.problems.join(';'), /本线触碰/)
})

test('T6 坏 JSON 行 ⇒ 整份不生效(宁可回红,不让坏行变放行条)', () => {
  const r = parseGateExemptions('{not json}', TODAY)
  assert.equal(r.disabled, true)
  assert.equal(r.match('41'), null)
  assert.match(r.problems.join(';'), /不是合法 JSON/)
})

test('T7 台账文件不存在 ⇒ 零豁免(不是"坏"),门照常按红处理', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-exempt-'))
  try {
    const r = loadGateExemptions(dir, new Date(`${TODAY}T00:00:00Z`))
    assert.equal(r.disabled, false)
    assert.equal(r.match('41'), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T8 台账落盘读回:scripts/data/gate-exemptions.jsonl 四行均命中本日', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const real = loadGateExemptions(root, new Date(`${TODAY}T00:00:00Z`))
  assert.equal(real.disabled, false, `台账不可用:${real.problems.join('; ')}`)
  for (const id of ['41', '57', '204', '70b']) {
    assert.ok(real.match(id), `门 ${id} 应命中`)
    assert.equal(real.match(id).touched, '否')
  }
  assert.ok(GATE_EXEMPTION_LEDGER_REL.endsWith('.jsonl'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
