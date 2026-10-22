// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFileSync } from 'node:fs'

import { __test__ as scrubTool } from '../scrub-declared-removals.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { scrub, declaredRows, LEDGERS } = scrubTool

const ROW = '- [ ] G-900 已被台账摘除的登记行'
const HEAD = ['- [ ] G-901 在册行', '- [x] G-902 已勾在册行'].join('\n')

describe('scrub-declared-removals 判据(单源 import,不在本文件复算)', () => {
  it('三条件齐备才剔:已声明 ∧ HEAD 已无 ∧ 登记行形', () => {
    const r = scrub(`${HEAD}\n${ROW}`, HEAD, new Set([ROW]))
    assert.equal(r.dropped.length, 1)
    assert.equal(r.text.includes('G-900'), false)
  })

  it('反证一:去掉台账声明 ⇒ 一行也不剔(证明输入是台账而不是"这行看着像旧的")', () => {
    const r = scrub(`${HEAD}\n${ROW}`, HEAD, new Set())
    assert.equal(r.dropped.length, 0)
    assert.equal(r.text.includes('G-900'), true)
  })

  it('反证二:HEAD 面上仍在册 ⇒ 不许剔(那行属于别人本轮的在册工作)', () => {
    const r = scrub(`${HEAD}\n${ROW}`, `${HEAD}\n${ROW}`, new Set([ROW]))
    assert.equal(r.dropped.length, 0)
  })

  it('反证三:非登记行形即便声明过也不动(只认台账语义,不碰正文)', () => {
    const prose = `正文里引用 ${ROW}`
    const r = scrub(`${HEAD}\n${prose}`, HEAD, new Set([prose]))
    assert.equal(r.dropped.length, 0)
  })

  it('已勾行同样可剔(完成即删口径下 - [x] 也是登记行)', () => {
    const done = '- [x] G-903 已结清并按台账摘除'
    const r = scrub(`${HEAD}\n${done}`, HEAD, new Set([done]))
    assert.equal(r.dropped.length, 1)
  })

  it('同文两行按逐行判定都剔,不靠"第一行匹配"', () => {
    const r = scrub(`${HEAD}\n${ROW}\n${ROW}`, HEAD, new Set([ROW]))
    assert.equal(r.dropped.length, 2)
  })

  it('在册行与本轮真新增行一字不动(守恒)', () => {
    const r = scrub(`${HEAD}\n${ROW}\n- [ ] G-904 别人本轮新增`, HEAD, new Set([ROW]))
    assert.equal(r.text.includes('G-901'), true)
    assert.equal(r.text.includes('G-902'), true)
    assert.equal(r.text.includes('G-904'), true)
  })

  it('台账只收 rowBefore / before 整行字段;坏 JSON 计数不静默', () => {
    const dir = mkScratch('scrub-mirror')
    try {
      const abs = path.join(dir, 'led.jsonl')
      writeFileSync(abs, JSON.stringify({ rowBefore: ROW }) + '\n' + JSON.stringify({ title: ROW }) + '\n坏的 JSON\n', 'utf8')
      const d = declaredRows(dir, ['led.jsonl'])
      assert.equal(d.set.size, 1, `实收 ${d.set.size}`)
      assert.equal(d.malformed, 1, `坏行计数 ${d.malformed}`)
    } finally {
      rmScratch(dir)
    }
  })

  it('登记的台账路径清单是仓库相对、无逃逸(防器物改了出口而测试仍指旧的)', () => {
    assert.ok(Array.isArray(LEDGERS) && LEDGERS.length >= 2)
    assert.ok(LEDGERS.every((p) => !p.startsWith('/') && !p.includes('..')))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
