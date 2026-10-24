// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { __test__ as scrubTool } from '../scrub-declared-removals.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { scrub, declaredRows, buildDeclared, rowStateOf, titleFpOf, main, LEDGERS } = scrubTool

const ROW = '- [ ] G-900 已被台账摘除的登记行'
const HEAD = ['- [ ] G-901 在册行', '- [x] G-902 已勾在册行'].join('\n')

// 维二(正文等值维)夹具:复刻 2026-10-23 现读的 G-878 型 —— 台账留的是**已勾带结清注记**那一版,
// 滞后工作树带回的是**剥掉 ✅(日期) 与结清注记的旧形态**;两行既不同勾选态又不同正文 ⇒ 逐字比对必然对不上。
const CLOSED = '- [x] ✅(2026-10-23) G-878 原生弹窗逐页清偿:判据重写后现读 45 处 —— **已结清**:45 处全部换成 useConfirm()'
const RESURFACED = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处'
const REWRITTEN = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处(题面已被别人改写)'
const HEAD_LIVE = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处(别人本轮在册的另一版)'

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

describe('维二:正文等值(2026-10-23 补,治"已结清票以未勾形态复活"三件器物同时够不着)', () => {
  it('前提自证:夹具四行同复合主键(单源 compositeKeyOf),而已勾/未勾两态确实不同形态', () => {
    const k = compositeKeyOf(RESURFACED)
    assert.equal(k, compositeKeyOf(CLOSED))
    assert.equal(k, compositeKeyOf(HEAD_LIVE))
    assert.equal(rowStateOf(CLOSED), 'done')
    assert.equal(rowStateOf(RESURFACED), 'open')
  })

  it('(a) 改前失败复现:未勾复活形态在"只认整行逐字"的口径下剔不到', () => {
    // Set 调用形 == 2026-10-22 立版的输入面(维二输入为空),用它把"改前"钉成一条断言而不是叙述
    const r = scrub(`${HEAD}\n${RESURFACED}`, HEAD, new Set([CLOSED]))
    assert.equal(r.dropped.length, 0, `逐字维应剔不到,实剔 ${r.dropped.length}`)
    assert.equal(r.text.includes('G-878'), true)
  })

  it('(b) 补维后能剔,且 HEAD 面确实既无逐字同文行、也无同主键行', () => {
    const d = buildDeclared([CLOSED])
    assert.equal(d.closed.size, 1, '台账已勾行必须进维二输入索引')
    const r = scrub(`${HEAD}\n${RESURFACED}\n- [ ] G-903 别人本轮真新增的行`, HEAD, d)
    assert.equal(r.dropped.length, 1)
    assert.equal(r.text.includes('G-878'), false)
    assert.match(String(r.via.get(RESURFACED)), /^body:/, '必须记为正文维命中')
    assert.equal(HEAD.split('\n').some((l) => compositeKeyOf(l) === compositeKeyOf(RESURFACED)), false, '前提:HEAD 无同主键行')
    assert.equal(r.text.includes('G-903'), true, '本轮真新增行一字不动')
  })

  it('(c) HEAD 面有同正文(同主键)行 ⇒ 绝不剔并点名 —— 防误伤别人的活', () => {
    const d = buildDeclared([CLOSED])
    const r = scrub(`${HEAD}\n${RESURFACED}`, `${HEAD}\n${HEAD_LIVE}`, d)
    assert.equal(r.dropped.length, 0, `HEAD 在册同题却剔了 ${r.dropped.length} 行`)
    assert.equal(r.held.length, 1)
    assert.match(r.held[0].why, /HEAD 面仍有同主键行/)
  })

  it('(c2) 同主键而正文已漂开(不是台账形态的前缀)⇒ 不剔,点名交人工', () => {
    const d = buildDeclared([CLOSED])
    const r = scrub(`${HEAD}\n${REWRITTEN}`, HEAD, d)
    assert.equal(r.dropped.length, 0)
    assert.equal(r.held.length, 1)
    assert.match(r.held[0].why, /前缀/)
  })

  it('(c3) 勾选态与台账相同(台账也是未勾)⇒ 不走这一维:少剔一行,绝不放宽', () => {
    const openLedger = '- [ ]（进行中@2026-10-18/甲） G-878 原生弹窗逐页清偿:判据重写后现读 45 处'
    assert.equal(rowStateOf(openLedger), 'open')
    const r = scrub(`${HEAD}\n${RESURFACED}`, HEAD, buildDeclared([openLedger]))
    assert.equal(r.dropped.length, 0)
    assert.equal(r.text.includes('G-878'), true)
  })

  it('(c4) 台账未收的编号 / 散文行 ⇒ 维二一条不碰', () => {
    const d = buildDeclared([CLOSED])
    const r = scrub(`${HEAD}\n- [ ] G-899 台账没声明过的行\n说明 G-878 原生弹窗逐页清偿:判据重写后现读 45 处`, HEAD, d)
    assert.equal(r.dropped.length, 0)
  })

  it('两维同时命中时各记各的口径(逐字维语义一字未动)', () => {
    const d = buildDeclared([CLOSED, ROW])
    const r = scrub(`${HEAD}\n${ROW}\n${RESURFACED}`, HEAD, d)
    assert.equal(r.dropped.length, 2)
    assert.equal(r.via.get(ROW), 'verbatim')
    assert.match(String(r.via.get(RESURFACED)), /^body:/)
  })

  it('(d) 台账取不到 ⇒ exit 2 未判定,绝不冒充 state=clean(§0.3)', () => {
    const dir = mkScratch('scrub-cli-noleger')
    const logs = []
    const orig = console.log
    try {
      console.log = (...a) => logs.push(a.join(' '))
      const rc = main(['PROJECT_PLAN.md', '--dry-run'], dir)
      const out = logs.join('\n')
      assert.equal(rc, 2, `退出码应为 2,实为 ${rc} / ${out}`)
      assert.match(out, /state=undetermined/)
      assert.doesNotMatch(out, /state=clean/)
    } finally {
      console.log = orig
      rmScratch(dir)
    }
  })

  it('(d2) 台账在位而 HEAD 面取不到 ⇒ 同样 exit 2,不回落另一个面', () => {
    const dir = mkScratch('scrub-cli-nohead')
    const logs = []
    const orig = console.log
    try {
      writeLedgerFixture(dir, CLOSED)
      console.log = (...a) => logs.push(a.join(' '))
      const rc = main(['PROJECT_PLAN.md', '--dry-run'], dir)
      const out = logs.join('\n')
      assert.equal(rc, 2, `退出码应为 2,实为 ${rc} / ${out}`)
      assert.match(out, /state=undetermined.*HEAD 面/s)
      assert.doesNotMatch(out, /state=clean/)
    } finally {
      console.log = orig
      rmScratch(dir)
    }
  })

  it('形状锁:形态解析必须 import 单源,本器不得再写一份"什么算登记行正文"', () => {
    const src = readSource()
    assert.match(src, /import \{ bodyOfRow, compositeKeyOf, parseTaskRows \} from '\.\/lib\/plan-task-index\.mjs'/)
    assert.match(src, /export function rowStateOf\(line\)[\s\S]{0,200}parseTaskRows\(/)
    assert.match(src, /export function buildDeclared\(/, '维二输入的唯一构造出口必须在位')
    assert.ok(typeof scrubTool.buildDeclared === 'function' && typeof scrubTool.rowStateOf === 'function')
  })

  it('题面前缀维:f11-purge 声明的同题行让号/改号后仍剔', () => {
    const base = '- [ ] G-63 生产备份链日志的写入侧编码要改成 UTF-8:第一段取证'
    const variant = '- [ ] G-87 生产备份链日志的写入侧编码要改成 UTF-8:第一段取证'
    const declared = { set: new Set([base]), closed: new Map(), dropTitleFps: new Set([titleFpOf(base)]) }
    const r = scrub(`${HEAD}\n${variant}`, HEAD, declared)
    assert.equal(r.dropped.length, 1)
    assert.equal(r.via.get(variant), 'title')
  })

  it('题面前缀维反证:HEAD 仍有同题键 ⇒ 不剔', () => {
    const base = '- [ ] G-63 生产备份链日志的写入侧编码要改成 UTF-8:第一段取证'
    const variant = '- [ ] G-87 生产备份链日志的写入侧编码要改成 UTF-8:第一段取证'
    const declared = { set: new Set([base]), closed: new Map(), dropTitleFps: new Set([titleFpOf(base)]) }
    const r = scrub(`${HEAD}\n${variant}`, `${HEAD}\n${variant}`, declared)
    assert.equal(r.dropped.length, 0)
  })

  it('declaredRows 只为 f11-purge 条目建题面前缀集(其它 kind 不进维三)', () => {
    const dir = mkScratch('declared-tfp-')
    try {
      mkdirSync(path.join(dir, '.ihui-agent', 'state'), { recursive: true })
      const f11 = '- [ ] G-63 生产备份链日志的写入侧编码要改成 UTF-8:第一段取证'
      const other = '- [ ] G-64 另一张无关票'
      writeFileSync(
        path.join(dir, '.ihui-agent', 'state', 'drop.jsonl'),
        [
          JSON.stringify({ rowBefore: f11, kind: 'f11-purge', at: '2026-10-25T00:00:00.000Z' }),
          JSON.stringify({ rowBefore: other, kind: 'stale-closed-sweep', at: '2026-10-25T00:00:00.000Z' }),
        ].join('\n') + '\n',
        'utf8',
      )
      const d = declaredRows(dir, ['.ihui-agent/state/drop.jsonl'])
      assert.equal(d.dropTitleFps.size, 1)
      assert.ok(d.dropTitleFps.has(titleFpOf(f11)))
    } finally {
      rmScratch(dir)
    }
  })
})

function writeLedgerFixture(dir, rowText) {
  mkdirSync(path.join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    path.join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl'),
    `${JSON.stringify({ rowBefore: rowText, kind: 'stale-closed-sweep', at: '2026-10-23T04:07:32.148Z' })}\n`,
    'utf8',
  )
}

/** 读本器源码(形状锁用):按 import.meta.url 定位,不吃 cwd(§15 ROOT 由脚本自身位置推导)。 */
function readSource() {
  return readFileSync(fileURLToPath(new URL('../scrub-declared-removals.mjs', import.meta.url)), 'utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
