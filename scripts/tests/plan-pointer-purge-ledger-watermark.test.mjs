#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:plan-pointer-purge 写台账前必须把水印载荷装上(§5c「生成器写盘后紧随注入」在
 * 对象空间落地这一支的落地版)。
 *
 * 立因(2026-10-16 实测):本器走对象空间、从不写工作树,于是它生成的归档件
 * `.ihui-agent/archive/plan-pointer-purge-*.md` 进 HEAD 时**没有载荷** —— 已在 HEAD 面造成
 * 三轮 CI `Provenance watermark check` 步红(他席手工补交 20 枚、本席补交 1 枚,而每跑一次
 * 就又造出一枚新的欠账)。判序:装不上就**拒绝落地**(方向保守 —— 宁可不落下一轮重跑,
 * 也不把无水印的归档件送进 HEAD 让人在 CI 上重新发现一次红)。
 *
 * 运行:node --test scripts/tests/plan-pointer-purge-ledger-watermark.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as P } from '../plan-pointer-purge.mjs'

const BODY = [
  '# plan-pointer-purge 存量清偿台账(测试夹具)',
  '',
  '> 每条 = 一条被删登记行的原文。',
  '',
  '- 原 L1(L3 纯指针):',
  '',
  '  ```',
  '  - [x] ✅(2026-01-01) 夹具正文一行',
  '  ```',
  '',
].join('\n')

test('装上后正文一字不动:只多顶部横幅块与文末隐写行', () => {
  const r = P.ledgerWithWatermark('.ihui-agent/archive/plan-pointer-purge-TESTCASE.md', BODY)
  assert.equal(r.ok, true, `inject 应成功,实得:${r.why ?? ''}`)
  assert.match(r.text, /\[IHUI-AI-PROVENANCE\]:/, '必须带载荷标记')
  for (const line of BODY.split('\n')) {
    if (line.trim() === '') continue
    assert.ok(r.text.includes(line), `台账正文行被改动:${line.slice(0, 40)}`)
  }
  assert.ok(r.text.length > BODY.length, '载荷是加进去的,不该把原正文换掉')
})

test('幂等:同一份文本装两次不多出第二份载荷(inject 幂等这条铁律由调用方依赖)', () => {
  const once = P.ledgerWithWatermark('.ihui-agent/archive/plan-pointer-purge-TESTCASE.md', BODY)
  assert.equal(once.ok, true, once.why ?? '')
  const twice = P.ledgerWithWatermark(
    '.ihui-agent/archive/plan-pointer-purge-TESTCASE.md',
    once.text,
  )
  assert.equal(twice.ok, true, twice.why ?? '')
  const marks = (twice.text.match(/\[IHUI-AI-PROVENANCE\]:/g) ?? []).length
  assert.equal(marks, 1, `载荷标记必须只有一份(实得 ${marks})`)
})

test('反向锁:inject 吃不动的形态必须报 ok:false,由调用方拒绝落地(不是静默交无水印件)', () => {
  const r = P.ledgerWithWatermark('.ihui-agent/archive/plan-pointer-purge-TESTCASE.bin', BODY)
  assert.equal(r.ok, false, '非可注入类型不该被当成"已带水印"')
  assert.ok(typeof r.why === 'string' && r.why.length > 0, '拒绝必须给得出原因')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
