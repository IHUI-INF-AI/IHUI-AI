// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `plan-fields-project.mjs` 镜像测试(§22c)—— 判据全从生产出口 import,本文件零复算。
 *
 * 承重的是"什么情况下**不许**改行":信息不被侧车覆盖 / 把预算内的行顶过 400 字档(那才是
 * 新增一条长行) / 三维守恒任一违规 / 记录里没有可渲染的信息。失效方向永远是"少改一行",
 * 绝不是"先收下再说"。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as P } from '../plan-fields-project.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { parseHeader, renderHeader, roundTripOk } from '../lib/plan-field-line.mjs'

const padTo = (head, n, ch = '细') => head + ch.repeat(Math.max(0, n - head.length))

const rec = (over = {}) => ({
  key: 'K#1',
  owner: '门 130 持有人',
  waiting: 'none',
  updatedAt: '2026-10-22T00:00:00.000Z',
  updatedBy: 't',
  ...over,
})

describe('投影规划:加标头 + 删逐字等价的归属句同批(规格 §4.3)', () => {
  it('加标头并删等价归属句,其余正文逐字留着', () => {
    const line = '- [ ] **G-1 甲题** 细节一:归属:门 130 持有人,细节二'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.ok(p.line.includes(renderHeader(r)), '标头必须在位(门 234 A2 逐字对账的对象)')
    assert.ok(!p.line.includes('归属:门 130 持有人'), '与记录逐字等价的归属句要同批删掉')
    assert.ok(p.line.includes('细节一:细节二'), '归属句之外的正文必须逐字留着')
    assert.ok(p.removedProse > 0, '删掉的字数要能逐字核对')
  })

  it('删等价归属句后正文缩短且判据不漂(主键/复合/租约/桶四维等值)', () => {
    const line =
      '- [ ] （进行中@2026-10-22/holder-x） **G-9 壬题** 细节一:归属:门 130 持有人,细节二 ' +
      '细'.repeat(20)
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    if (p.action !== 'rewrite')
      throw new Error(`带租约的等价归属句应可投影,实得 ${p.action}:${p.reason ?? ''}`)
    assert.ok(p.removedProse > 0)
    assert.ok(
      p.line.length < line.length + renderHeader(r).length + 1,
      '比"只加标头"更短,才说明确实删掉了散文句',
    )
    const a = P.dimsOf(line)
    const b = P.dimsOf(p.line)
    assert.equal(b.key, a.key)
    assert.equal(b.composite, a.composite)
    assert.equal(b.claim, a.claim)
    assert.equal(p.dims.bucketOldFields, p.dims.bucketNewFields, '侧车桶前后必须同桶')
  })

  it('只删 owner 本字:括号补充与随后的叙述一律留着(不许吞掉侧车没覆盖的话)', () => {
    const line =
      '- [ ] **G-12 亥题** 细节一:归属:守门 130(计划任务状态一致性)持有人 —— 两档互相矛盾'
    const r = rec({ key: compositeKeyOf(line), owner: '守门 130' })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.ok(!p.line.includes('归属:守门 130'), '等价的那一截要删')
    assert.ok(
      p.line.includes('(计划任务状态一致性)持有人 —— 两档互相矛盾'),
      'owner 之后的括号补充与叙述不是侧车覆盖的信息,一个字都不许吞',
    )
  })

  it('删了会挪复合主键 ⇒ 拒投影(守恒闸有牙,不是注释承诺)', () => {
    const line = '- [ ] **G-10 事件** 归属:门 130 持有人,细节'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /composite/)
  })

  it('render → parse → render 幂等(集成断言,不改 plan-field-line)', () => {
    const x = { key: null, owner: '门 130 持有人', waiting: 'none', blocking: '' }
    const once = renderHeader(x)
    const parsed = parseHeader(`- [ ] ${once} **G-13 子题** 细节`)
    assert.deepEqual(parsed, { rec: x, malformed: false })
    assert.equal(renderHeader(parsed.rec), once)
    assert.equal(roundTripOk(`- [ ] ${once} **G-13 子题** 细节`), true)

    const env = { key: null, owner: '', waiting: 'env', blocking: 'dev 栈依赖被拉回' }
    const onceEnv = renderHeader(env)
    const parsedEnv = parseHeader(`- [ ] ${onceEnv} **G-14 丑题** 细节`)
    assert.deepEqual(parsedEnv.rec, { key: null, owner: '', waiting: 'env', blocking: 'dev 栈依赖被拉回' })
    assert.equal(renderHeader(parsedEnv.rec), onceEnv)
  })

  it('散文说的持有人与记录不一致 ⇒ 不动(侧车没覆盖的信息不许删)', () => {
    const line = '- [ ] **G-2 乙题** 归属:另一个组持有,细节'
    const p = P.planRow(line, rec({ key: compositeKeyOf(line) }))
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /覆盖|不等价/)
  })

  it('记录里没有可渲染的信息(owner 与 blocking 都空)⇒ 不造空标头', () => {
    const line = '- [ ] **G-3 丙题** 需真机复跑'
    const p = P.planRow(line, rec({ key: compositeKeyOf(line), owner: '', blocking: '' }))
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /没有可渲染/)
  })

  it('原行已超预算(500 字)⇒ 候选 551 字仍放行(改写存量长行不算新增)', () => {
    // 标头内容封顶 48 字(+方括号 2 + 空格 1)⇒ 500 字原行最多投到 551 字;
    // 判据的关键不是候选绝对值,而是原行本就在存量集里。
    const line = padTo('- [ ] **G-901 甲题说明** 不归本线 ', 500)
    assert.equal(line.length, 500)
    const r = rec({ key: compositeKeyOf(line), waiting: 'env', blocking: '细'.repeat(34) })
    assert.equal(renderHeader(r).length, 50)
    const p = P.planRow(line, r, { maxLen: 400 })
    assert.equal(p.action, 'rewrite', p.reason)
    assert.ok(p.line.length > 400)
    assert.equal(p.line.length, 551)
  })

  it('原行在预算内(380 字)、候选 430 字 ⇒ 仍跳过(不许把短行推进长行存量)', () => {
    const line = padTo('- [ ] **G-902 乙题说明** 不归本线 ', 380)
    assert.equal(line.length, 380)
    const r = rec({ key: compositeKeyOf(line), waiting: 'env', blocking: '细'.repeat(33) })
    assert.equal(renderHeader(r).length, 49)
    const p = P.planRow(line, r, { maxLen: 400 })
    assert.equal(p.action, 'skip')
    assert.equal(p.len, 430)
    assert.match(p.reason, /预算/)
    assert.match(p.reason, /原行/)
  })

  it('标头已在位且与记录一致 ⇒ already(幂等,重跑不再改这一行)', () => {
    const r = rec({ key: compositeKeyOf('- [ ] **G-5 戊题** 细节') })
    const line = `- [ ] ${renderHeader(r)} **G-5 戊题** 细节`
    assert.equal(P.planRow(line, r).action, 'already')
  })

  it('waiting 记录带 blocking ⇒ 标头写出等什么,散文原话不动', () => {
    const line = '- [ ] **G-6 己题** 在等什么:dev 栈依赖被拉回'
    const r = rec({
      key: compositeKeyOf(line),
      owner: '',
      waiting: 'env',
      blocking: 'dev 栈依赖被拉回',
    })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.ok(p.line.includes('在等什么:dev 栈依赖被拉回'), '散文原话必须原样留着')
  })
})

describe('投影规划:判定面一根头发都不许动', () => {
  it('rewrite 前后:主键/复合主键/租约/归属桶四维逐字等值', () => {
    const line =
      '- [ ] （进行中@2026-10-22/holder-x） **G-7 庚题** 细节一:归属:门 130 持有人,细节'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    if (p.action !== 'rewrite')
      throw new Error(`带租约的行也应可投影,实得 ${p.action}:${p.reason ?? ''}`)
    const a = P.dimsOf(line)
    const b = P.dimsOf(p.line)
    assert.equal(b.key, a.key, 'keyOfRow 变了 ⇒ 门 203/归并/守恒全认不出这一行')
    assert.equal(b.composite, a.composite, '复合主键变了 ⇒ 同题查重与 F4 归全会把它当新事项')
    assert.equal(b.claim, a.claim, '租约三要素必须原样(代别人摘牌 = §1 禁令)')
    assert.equal(p.dims.conserved, true, '守恒器物必须亲自说通过')
  })
  it('侧车权威前后桶不变(桶维等值由守恒器物判,这里不复算)', () => {
    const line = '- [ ] **G-8 辛题** 细节一:归属:门 130 持有人,细节'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.equal(p.dims.bucketOldFields, p.dims.bucketNewFields, '侧车权威前后必须同桶')
  })

  it('record 读数被切歪(owner 括号失配)⇒ 不投影(标头是给人读的,写畸形归属比不写更糟)', () => {
    const line = '- [ ] **G-948 活文档整文件回写** 细节'
    const p = P.planRow(line, rec({ key: compositeKeyOf(line), owner: '台账自愈层):一枚 bypass 落地' }))
    assert.equal(p.action, 'skip')
    assert.equal(p.undetermined, true)
    assert.match(p.reason, /括号失配/)
    // 配对括号不是本判据的打击面:即便被其它既有判据(散文⇄记录不等价,抽取器本就按 `(` 切)拦下,
    // 报因也不得是"括号失配" —— 否则这条结构判据就在替归属判据做决定。
    const okLine = '- [ ] **G-948 活文档整文件回写** 归属:甲(A组)持有人,细节'
    const paired = P.planRow(okLine, rec({ key: compositeKeyOf(okLine), owner: '甲(A组)持有人' }))
    assert.doesNotMatch(String(paired.reason ?? ''), /括号失配/)
  })

  it('形状锁:规划器必须问守恒器物,不得自己判桶', () => {
    const src = readFileSync(new URL('../plan-fields-project.mjs', import.meta.url), 'utf8')
    assert.match(src, /assertRowRewriteConservation/, '整行改写必须先过三维守恒器物')
    assert.match(src, /renderHeader/, '标头只能由投影层渲染')
    assert.ok(!/归属\[:：\]\|本票不认领/.test(src), '不得出现第二份归属词表')
  })
})

describe('无侧车记录的行不许被当成"记录为空"(2026-10-26 修)', () => {
  it('无记录 + 有效标头 ⇒ hold(摘了就是丢全仓唯一的归属证据)', () => {
    const line = '- [ ]（进行中@2026-10-26/r5）〔归:自进化〕(2026-10-25) 需求/异常自动发现器:x'
    assert.equal(P.noRecordVerdict(line), 'hold')
  })
  it('无记录 + malformed 标头(…截断)⇒ strip(它永远渲染不回来,是门 234 A2 的恒红源)', () => {
    const line = '- [ ] 〔归:某某某某…〕 **G-7 庚题** 细节'
    assert.equal(P.noRecordVerdict(line), 'strip')
  })
  it('无记录 + 无标头 ⇒ nothing(这一行没有可管的投影)', () => {
    assert.equal(P.noRecordVerdict('- [ ] **G-8 辛题** 细节'), 'nothing')
  })
  it('形状锁:caller 对无记录行必须问 noRecordVerdict,不得直接造空记录喂 planRow', () => {
    const src = readFileSync(new URL('../plan-fields-project.mjs', import.meta.url), 'utf8')
    assert.match(src, /noRecordVerdict\(r\.raw\)/, '无记录行的裁决必须走单源出口')
  })
})

describe('无记录行分因出口(2026-10-26,G-965:疑点必须是可读点名,不是"101 行"一个总数)', () => {
  it('四档各认一例:不可寻址 / 散文可做 / 归属抽不出值 / 复算可自愈', () => {
    assert.equal(P.noRecordKind('- [ ] 副本指针(编号 62)：同主键第二份未勾选副本'), 'keyless')
    assert.equal(P.noRecordKind('- [ ] **G-1 甲题** 可做'), 'prose-actionable')
    assert.equal(
      P.noRecordKind('- [ ] **G-2 乙题** 由安全线持有者接管这条线'),
      'owner-unextractable',
      '归属词族命中但无可搬值 ⇒ 抽取器宁缺,不能读成"可做"',
    )
    assert.equal(P.noRecordKind('- [ ] **G-3 丙题** 归属:甲持有人'), 'self-healable')
  })

  it('有编号但题面退化 ⇒ key-degenerate(侧车没有可寻址键,补题面要动判定面)', () => {
    assert.equal(P.noRecordKind('- [ ] G-16（等守门 128 持有人拍两件事）门 128 的 SL 维'), 'key-degenerate')
  })

  it('形状锁:分因判据必须问既有单源,不得在本层另造桶/词表', () => {
    const src = readFileSync(new URL('../plan-fields-project.mjs', import.meta.url), 'utf8')
    assert.match(src, /extractFromLine/, '"现在抽不抽得出"必须问抽取器自己的出口')
    assert.match(src, /dispositionOf,/, '桶必须问 plan-task-index 那一份')
    assert.match(src, /export function noRecordKind/, '分因出口必须可被外部复核')
    assert.match(src, /无记录行分因/, '报告面必须打印分因,否则读数仍是一团总数')
  })
})

describe('分批与出件契约', () => {
  it('--batch 上限 40,越界/非整数一律判用法错', () => {
    assert.equal(P.MAX_BATCH, 40, '规格 §4.3:每批 ≤40 行')
    assert.equal(P.parseBatchArg([]), 10, '未给 batch 用默认小批')
    assert.equal(P.parseBatchArg(['--batch', '1']), 1)
    assert.equal(P.parseBatchArg(['--batch', '40']), 40)
    assert.equal(P.parseBatchArg(['--batch', '41']), null)
    assert.equal(P.parseBatchArg(['--batch', '0']), null)
    assert.equal(P.parseBatchArg(['--batch', '1.5']), null)
    assert.equal(P.parseBatchArg(['--batch']), null)
  })

  it('--emit 产出:替换档只含 before/after,摘除声明逐行带旧形态与出处', () => {
    const tmp = mkScratch('ihui-pfp-')
    try {
      const rows = [
        { before: '- [ ] **G-1 甲题** a', after: '- [ ] 〔归:甲〕 **G-1 甲题** a' },
        { before: '- [ ] **G-2 乙题** b', after: '- [ ] 〔归:乙〕 **G-2 乙题** b' },
        { before: '- [ ] **G-3 丙题** c', after: '- [ ] 〔归:丙〕 **G-3 丙题** c' },
      ]
      const jsonPath = path.join(tmp, 'replace.json')
      const dropRel = path.join('state', 'plan-row-drop.jsonl')
      const code = P.emit({ rewrite: rows }, jsonPath, 2, { root: tmp, dropRel })
      assert.equal(code, 0)
      const replace = JSON.parse(readFileSync(jsonPath, 'utf8'))
      assert.equal(replace.length, 2, '--batch 是每批上限,出件不得越界')
      assert.deepEqual(Object.keys(replace[0]).sort(), ['after', 'before'])
      assert.deepEqual(replace[0], { before: rows[0].before, after: rows[0].after })

      const dropFile = path.join(tmp, dropRel)
      assert.ok(existsSync(dropFile), '旧形态声明必须在落地前就在位')
      const drop = readFileSync(dropFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
      assert.equal(drop.length, 2)
      assert.deepEqual(
        Object.keys(drop[0]).sort(),
        ['at', 'file', 'rowAfter', 'rowBefore', 'seat', 'why'],
      )
      assert.equal(drop[0].seat, 'plan-fields-project')
      assert.equal(drop[0].file, 'PROJECT_PLAN.md')
      assert.equal(drop[0].rowBefore, rows[0].before)
      assert.equal(drop[0].rowAfter, rows[0].after)
      assert.match(drop[0].why, /删逐字等价的散文归属句/)
      assert.ok(!Number.isNaN(Date.parse(drop[0].at)), 'at 必须是可解析时间戳')
    } finally {
      rmScratch(tmp)
    }
  })

  it('无可投影行 ⇒ 不出件,也不写旧形态声明(空替换档会被读成"未命中")', () => {
    const tmp = mkScratch('ihui-pfp-empty-')
    try {
      const jsonPath = path.join(tmp, 'replace.json')
      assert.equal(P.emit({ rewrite: [] }, jsonPath, 40, { root: tmp }), 0)
      assert.equal(existsSync(jsonPath), false)
      assert.equal(existsSync(path.join(tmp, '.ihui-agent', 'state', 'plan-row-drop.jsonl')), false)
    } finally {
      rmScratch(tmp)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
