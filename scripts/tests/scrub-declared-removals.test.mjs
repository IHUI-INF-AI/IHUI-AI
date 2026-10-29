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

const { scrub, declaredRows, buildDeclared, rowStateOf, main, LEDGERS } = scrubTool

const ROW = '- [ ] G-900 已被台账摘除的登记行'
const HEAD = ['- [ ] G-901 在册行', '- [x] G-902 已勾在册行'].join('\n')

// 维二(正文等值维)夹具:复刻 2026-10-23 现读的 G-878 型 —— 台账留的是**已勾带结清注记**那一版,
// 滞后工作树带回的是**剥掉 ✅(日期) 与结清注记的旧形态**;两行既不同勾选态又不同正文 ⇒ 逐字比对必然对不上。
const CLOSED = '- [x] ✅(2026-10-23) G-878 原生弹窗逐页清偿:判据重写后现读 45 处 —— **已结清**:45 处全部换成 useConfirm()'
const RESURFACED = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处'
const REWRITTEN = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处(题面已被别人改写)'
const HEAD_LIVE = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处(别人本轮在册的另一版)'

describe('维六:未勾形态的"装饰改写回潮"(2026-10-29 立)', () => {
  // 真例复刻:台账存的是被摘那一刻的未勾原文;带回时被收编器加了 `〔归:…〕` 表头 ⇒ 维一逐字不中,
  // 而维二/维四只吃已勾形态。实测两形态的 compositeKeyOf 相等、正文一方是另一方的前缀。
  const OPEN = '- [ ] G-903 腾讯云短信第二通道已接线:处于未配置态,应用与凭据均已核实'
  const BACK = '- [ ] 〔归:机主短信资质面〕 G-903 腾讯云短信第二通道已接线:处于未配置态,应用与凭据均已核实(后加的尾巴)'
  const OTHER = '- [ ] G-903 腾讯云短信第二通道已接线:完全另一套正文,与台账那条毫无关系'
  const d = (rows) => buildDeclared(rows)

  it('正例:同主键 ∧ 正文一方向成前缀 ∧ HEAD 无同键 ⇒ 剔(记为未勾形态桶)', () => {
    const r = scrub(BACK, '', d([OPEN]))
    assert.equal(r.dropped.length, 1, '必须剔')
    assert.match(String(r.via.get(r.dropped[0])), /^open:/, 'via 必须落在 open 桶')
  })

  it('反证一:HEAD 面仍有同主键行 ⇒ 不剔(别人真在写同题)', () => {
    const headLive = '- [ ] G-903 腾讯云短信第二通道已接线:处于未配置态,应用与凭据均已核实(在册版)'
    const r = scrub(BACK, headLive, d([OPEN]))
    assert.equal(r.dropped.length, 0)
    assert.ok(r.held.some((h) => String(h.why).includes('HEAD 面仍有同主键行')), '必须点名让路原因')
  })

  it('反证二:带认领牌 ⇒ 不剔(在干活的席位一律让路)', () => {
    const claimed = '- [ ] 〔归:机主短信资质面〕（进行中@2026-10-29/某席） G-903 腾讯云短信第二通道已接线:处于未配置态,应用与凭据均已核实(后加的尾巴)'
    const r = scrub(claimed, '', d([OPEN]))
    assert.equal(r.dropped.length, 0)
    assert.ok(r.held.some((h) => String(h.why).includes('认领牌')), '必须点名"席位在飞"')
  })

  it('反证三:同主键但正文完全不是一回事(实测 D03 型:只共享 16 字)⇒ 不剔,交人工', () => {
    const r = scrub(OTHER, '', d([OPEN]))
    assert.equal(r.dropped.length, 0, '同键不同事不得按"回潮"删掉')
    assert.ok(r.held.some((h) => String(h.why).includes('正文不等')), '必须点名让路原因')
  })

  it('反证四:台账里没有该主键的未勾形态 ⇒ 这一维不动手(输入是台账,不是"长得像旧的")', () => {
    const r = scrub(BACK, '', d(['- [ ] G-999 别的票']))
    assert.equal(r.dropped.length, 0)
  })

  it('成对:同一行在 HEAD 面不存在且台账未声明 ⇒ 保留(证明不是"凡带表头就剔")', () => {
    const r = scrub(BACK, '', d([]))
    assert.equal(r.text, BACK)
  })
})

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

  it('(c3) 台账未勾形态不进维二(closed 仍为空);同一形态由维六接住,归因必须点名 open 桶', () => {
    const openLedger = '- [ ] G-878 原生弹窗逐页清偿:判据重写后现读 45 处(台账未勾版)'
    assert.equal(rowStateOf(openLedger), 'open')
    const d = buildDeclared([openLedger])
    assert.equal(d.closed.size, 0, '维二的输入面必须仍然为空(未勾形态一条都不许进 closed)')
    const r = scrub(`${HEAD}\n${RESURFACED}`, HEAD, d)
    assert.equal(r.dropped.length, 1, '维六(2026-10-29 立)负责这一格')
    assert.match(String(r.via.get(r.dropped[0])), /^open:/, '归因必须是 open 桶,不许伪装成维二 body')
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
    assert.match(src, /import \{ bodyOfRow, claimMarkOf, compositeKeyOf, parseTaskRows \} from '\.\/lib\/plan-task-index\.mjs'/)
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

  it('删除档具名 form=dropped 进题面指纹集;同 kind 而 form=open(翻勾前像)不得进', () => {
    const dir = mkScratch('declared-dropped-form-')
    try {
      mkdirSync(path.join(dir, '.ihui-agent', 'state'), { recursive: true })
      // 现场复刻 2026-10-29 实测的死循环:走 live-doc-edit 删除档摘掉的未勾行,留痕只有整行逐字,
      // 而守门 71 插回的是它自己采集的**另一份字节形态** ⇒ 逐字通道永远对不上 ⇒ 摘一次回一次。
      const droppedRow = '- [ ] 〔归:机主号池裁决面〕 Z-9 取号池饱和票(被删除档摘除)'
      const flipBefore = '- [ ] Z-8 另一张票(只是翻勾,并未摘行)'
      writeFileSync(
        path.join(dir, '.ihui-agent', 'state', 'drop.jsonl'),
        [
          JSON.stringify({
            rowBefore: droppedRow,
            kind: 'closed-row-reclose-open-form',
            form: 'dropped',
            at: '2026-10-29T02:11:09.568Z',
          }),
          JSON.stringify({
            rowBefore: flipBefore,
            kind: 'closed-row-reclose-open-form',
            form: 'open',
            at: '2026-10-29T02:11:09.568Z',
          }),
        ].join('\n') + '\n',
        'utf8',
      )
      const d = declaredRows(dir, ['.ihui-agent/state/drop.jsonl'])
      assert.ok(d.dropTitleFps.has(titleFpOf(droppedRow)), '声明为删除的行必须拿到题面指纹豁免')
      assert.equal(
        d.dropTitleFps.has(titleFpOf(flipBefore)),
        false,
        '翻勾前像不是删除 ⇒ 不得进维三(否则"没结清"能被写成"已处置")',
      )
      assert.equal(d.set.has(droppedRow), true, '逐字维照旧收(两维并存,不互相顶替)')
      assert.equal(d.set.has(flipBefore), true, '逐字维照旧收')
    } finally {
      rmScratch(dir)
    }
  })

  it('既非 f11/f12-purge 又未具名 dropped ⇒ 不进维三(维三只认"声明为删除"那一族)', () => {
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
