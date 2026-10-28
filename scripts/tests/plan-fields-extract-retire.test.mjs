// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-fields-extract 的「孤儿键退场档」镜像测试(§22c)。
 *
 * 判据一律 import 源脚本 `__test__`,测试内不写第二份键解析/桶名/正则;夹具落 `mkScratch()`
 * (§15b,工作区外 + 退出结构性回收),绝不在仓库树内 git init(门 208)。
 *
 * 本文件的四个"多留"锁各自对应 2026-10-27 dry-run 抓到的一型真误退:
 *  ① 同号行仍在(题面漂移)  —— 41 条可退里 G-50/O02 正是这一型;
 *  ② 题面只差空白          —— "DevEnv 搬入 G" vs "DevEnv搬入G";
 *  ③ 无编号行(编号位被租约/标头挤掉,compositeKeyOf 恒 null);
 *  ④ 拿派单口径当全量面    —— claimableRows 排除在飞票 ⇒ 每张在飞票的侧车都会成"孤儿"。
 * ④ 是 CLI 层的接线错,由本文件末尾的源码形状锁钉住(判据层拿不到面)。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'

import { __test__ as ex } from '../plan-fields-extract.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(path.join(HERE, '..', 'plan-fields-extract.mjs'), 'utf8')
const FIELDS_REL = path.join('scripts', 'data', 'plan-fields.jsonl')
const LEDGER_REL = path.join('.ihui-agent', 'state', 'plan-row-drop.jsonl')

const scratch = []
const repo = () => {
  const d = mkScratch('pfe-retire-')
  scratch.push(d)
  return d
}
after(() => {
  for (const d of scratch) rmScratch(d, { bestEffort: true })
})

const rec = (key, extra = {}) => ({
  key,
  waiting: 'none',
  why: '夹具记录',
  updatedAt: '2026-10-01T00:00:00.000Z',
  updatedBy: 'seat-x',
  ...extra,
})
const entriesOf = (...recs) => ex.parsePhysicalLines(recs.map((r) => JSON.stringify(r)))
const row = (raw) => ({ raw, state: 'open' })

test('① 题面在台账彻底消失 ⇒ 可退(正向:孤儿键真有出口)', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-40#钩子没有终态事件与outcome分类')),
    [row('- [ ] **G-99 完全不相干的另一件事**')],
    new Map(),
  )
  assert.equal(rp.retireKeys, 1)
  assert.deepEqual(
    rp.retire.map((r) => r.key),
    ['G-40#钩子没有终态事件与outcome分类'],
  )
  assert.equal(rp.conserved, true, '退场数 + 剩余数必须等于退场前总数')
})

test('② 同复合主键行仍在 ⇒ held(绝不退)', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-50#DevEnv搬入G')),
    [row('- [ ] **G-50 DevEnv 搬入 G(机器级)** —— 说明')],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /复合主键/)
})

test('③ 同号不同题 ⇒ held(编号是强身份,题面漂移不足以判孤儿)', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-50#旧版题面')),
    [row('- [ ] **G-50 改写后的全新题面** —— 说明')],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /同号行/)
})

test('④ 改号族:旧号键 vs 新号行的题面只差空白 ⇒ held(空白归一)', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-53#DevEnv搬入G')),
    [row('- [ ] **G-50 DevEnv 搬入 G:内置盘** —— 说明')],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  // 这条比"题面指纹"更早命中:归并档已把该旧号键列为"可搬"(新号行在册)⇒ 本档不重复动手。
  assert.match(rp.held[0].why, /归并档在册/)
})

test('⑤ 无编号行(编号位被租约/标头挤掉)含同题面 ⇒ held', () => {
  const head =
    '- [ ]（进行中@2026-10-25/r5）〔归:自进化〕(2026-10-25) 经验自动提炼:每次改动写回 `AGENTS.md`(受 P0 不可变护栏约束)'
  // 先自证这一行的确解析不出复合主键 —— 否则本用例测的是另一条分支
  assert.equal(ex.faceIdentityOf({ ...rec('X#y'), key: 'X#y' }).length > 0, true)
  const rp = ex.retirePlanOf(entriesOf(rec('O6501#不可变护栏')), [row(head)], new Map())
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /题面原样出现在某条登记行正文里/)
})

test('⑥ 键形态非法(题面短于 4 字 / T: 兜底键)⇒ held', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-1#短'), rec('T:deadbeefdeadbeef#任意题面')),
    [],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  assert.equal(rp.held.length, 2)
  assert.match(rp.held[0].why, /键形态不合法/)
  assert.match(rp.held[1].why, /兜底键/)
})

test('⑦ 最近一次写手是本器自写面 ⇒ held(出路是 --reclassify 逐条带 why)', () => {
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-40#某题面内容', { updatedBy: 'plan-fields-extract-adopt' })),
    [],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /本器自写面/)
})

test('⑧ 盘上记录在被审面读不到同形副本 ⇒ held(侧车正被别席改写)', () => {
  const entry = rec('G-40#某题面内容')
  const rp = ex.retirePlanOf(entriesOf(entry), [], new Map(), { faceIds: new Set() })
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /被审面读不到同形副本/)
})

test('⑨ applyRetireRecords:成功路径 = 留痕 + 摘行 + 回读守恒', () => {
  const d = repo()
  mkdirSync(path.join(d, 'scripts', 'data'), { recursive: true })
  mkdirSync(path.join(d, '.ihui-agent', 'state'), { recursive: true })
  const side = [JSON.stringify(rec('G-40#某题面内容')), JSON.stringify(rec('G-41#另一题面'))]
  writeFileSync(path.join(d, FIELDS_REL), side.join('\n') + '\n', 'utf8')
  writeFileSync(path.join(d, LEDGER_REL), '', 'utf8')
  const rp = ex.retirePlanOf(entriesOf(rec('G-40#某题面内容')), [], new Map())
  const res = ex.applyRetireRecords(d, rp)
  assert.equal(res.state, 'stripped')
  assert.equal(res.lines, 1)
  const left = readFileSync(path.join(d, FIELDS_REL), 'utf8').trim().split('\n')
  assert.equal(left.length, 1)
  assert.match(left[0], /G-41/)
  const ledger = readFileSync(path.join(d, LEDGER_REL), 'utf8').trim().split('\n')
  assert.equal(ledger.length, 1, '退场必须留痕(回滚件 = 该条 rowBefore 原样追加回侧车)')
  const entry = JSON.parse(ledger[0])
  assert.equal(entry.kind, ex.RETIRE_DROP_KIND)
  assert.equal(entry.seat, ex.RETIRE_SEAT)
  assert.match(entry.rowBefore, /G-40/)
})

test('⑩ applyRetireRecords:零可退 ⇒ clean 且一个字节都不动', () => {
  const d = repo()
  mkdirSync(path.join(d, 'scripts', 'data'), { recursive: true })
  writeFileSync(path.join(d, FIELDS_REL), JSON.stringify(rec('G-41#另一题面')) + '\n', 'utf8')
  const before = readFileSync(path.join(d, FIELDS_REL), 'utf8')
  const rp = ex.retirePlanOf(
    entriesOf(rec('G-41#另一题面')),
    [row('- [ ] **G-41 另一题面** —— 说明')],
    new Map(),
  )
  assert.equal(rp.retireKeys, 0)
  const res = ex.applyRetireRecords(d, rp)
  assert.equal(res.state, 'clean')
  assert.equal(readFileSync(path.join(d, FIELDS_REL), 'utf8'), before)
})

test('⑪ applyRetireRecords:留痕件取不到 ⇒ undetermined,零写盘(§0.3 不猜"它大概是空的")', () => {
  const d = repo()
  mkdirSync(path.join(d, 'scripts', 'data'), { recursive: true })
  writeFileSync(path.join(d, FIELDS_REL), JSON.stringify(rec('G-40#某题面内容')) + '\n', 'utf8')
  const before = readFileSync(path.join(d, FIELDS_REL), 'utf8')
  const rp = ex.retirePlanOf(entriesOf(rec('G-40#某题面内容')), [], new Map())
  const res = ex.applyRetireRecords(d, rp)
  assert.equal(res.state, 'undetermined')
  assert.equal(readFileSync(path.join(d, FIELDS_REL), 'utf8'), before)
})

test('⑫ 守恒断言不过 ⇒ refused,整批不落', () => {
  const d = repo()
  mkdirSync(path.join(d, 'scripts', 'data'), { recursive: true })
  mkdirSync(path.join(d, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(path.join(d, FIELDS_REL), JSON.stringify(rec('G-40#某题面内容')) + '\n', 'utf8')
  writeFileSync(path.join(d, LEDGER_REL), '', 'utf8')
  const rp = ex.retirePlanOf(entriesOf(rec('G-40#某题面内容')), [], new Map())
  const broken = { ...rp, conserved: false }
  const res = ex.applyRetireRecords(d, broken)
  assert.equal(res.state, 'refused')
})

test('⑬ 接线锁(§0.9 造好没装车 = 没有):CLI 必须有 --retire-orphans 分支,且判定面是全量登记行', () => {
  assert.match(SOURCE, /has\('--retire-orphans'\)/, 'CLI 分支未接线 ⇒ 该档跑不起来')
  assert.match(
    SOURCE,
    /rows = parseTaskRows\(readPlan\(ROOT, face\)\)/,
    '判定面必须取全量登记行;退回 claimableRows 会把在飞票全判成孤儿',
  )
  assert.ok(
    !/rows = a\.claimableRows/.test(SOURCE),
    'claimableRows 是派单口径(排除在飞),不得再当孤儿判据的输入',
  )
  for (const k of ['parsePhysicalLines', 'retirePlanOf', 'applyRetireRecords', 'faceIdentityOf']) {
    assert.equal(typeof ex[k], 'function', `__test__ 缺 ${k} ⇒ 镜像测的不是生产判据`)
  }
  assert.equal(typeof ex.RETIRE_SEAT, 'string')
  assert.equal(typeof ex.RETIRE_DROP_KIND, 'string')
})

// ⑭ 族 A(本器自写面)+ 合法声明 ⇒ 可退:旧档在这一族恒 0,声明档是唯一出口,why 必须原样带出
test('⑭ 自写面记录 + 合法 intent ⇒ 可退,且 why 原样带出', () => {
  const r = rec('G-93#自写面退场演练题面', { updatedBy: 'plan-fields-extract' })
  const why = '题面在台账面已彻底消失,逐条声明退场(自写面记录的定向说明)'
  const v = ex.validateRetireIntents(
    [{ key: r.key, why, declaredAt: '2026-10-02T00:00:00.000Z', declaredBy: 'seat-x' }],
    [r],
  )
  assert.equal(v.error, null)
  const rows = [row('- [ ] **G-99 完全不相干的另一件事**')]
  const rp = ex.retirePlanOf(entriesOf(r), rows, new Map(), { retireIntents: v.intents })
  assert.equal(rp.retireKeys, 1)
  assert.equal(rp.retire[0].intent.why, why, '声明原话必须逐字带出,不得被改写')
})

// ⑮ 同一记录不给声明 ⇒ 仍 held:这条锁的是旧护栏本身(防止有人后来把它删掉)
test('⑮ 同一自写面记录不给 intent ⇒ 仍 held(旧护栏不动)', () => {
  const r = rec('G-93#自写面退场演练题面', { updatedBy: 'plan-fields-extract' })
  const rp = ex.retirePlanOf(entriesOf(r), [], new Map())
  assert.equal(rp.retireKeys, 0)
  const h = rp.held.find((x) => x.key === r.key)
  assert.ok(h, '自写面记录必须出现在 held 里(护栏还在)')
  assert.match(h.why, /本器自写面/)
})

// ⑯ 声明早于记录最后一次改写 ⇒ 逐项跳过(陈旧不记通过),退场计划收到的 intents 为空 ⇒ 仍 held
test('⑯ 声明早于 updatedAt ⇒ skipped 且 intents 为空 ⇒ 仍 held', () => {
  const r = rec('G-94#陈旧声明演练题面', { updatedBy: 'plan-fields-extract' })
  const item = {
    key: r.key,
    why: '陈旧声明演练用理由(早于记录最后一次改写)',
    declaredAt: '2026-09-30T00:00:00.000Z',
  }
  const v = ex.validateRetireIntents([item], [r])
  assert.equal(v.error, null)
  assert.equal(v.skipped.length, 1)
  assert.equal(v.skipped[0].key, r.key)
  assert.equal(v.intents.size, 0)
  const rp = ex.retirePlanOf(entriesOf(r), [], new Map(), { retireIntents: v.intents })
  assert.equal(rp.retireKeys, 0)
  assert.ok(rp.held.some((x) => x.key === r.key))
})

// ⑰ 声明的 key 不在侧车 ⇒ 整批拒:半批应用等于挑着信,声明面整体不可信
test('⑰ 声明的 key 不在侧车 ⇒ error 非空且一条都不放行', () => {
  const r = rec('G-95#在册记录题面')
  const item = {
    key: 'G-96#侧车面上根本没有这个键',
    why: '该键在侧车面上不存在,属于陈旧声明',
    declaredAt: '2026-10-02T00:00:00.000Z',
  }
  const v = ex.validateRetireIntents([item], [r])
  assert.ok(v.error, '整批拒必须给 error')
  assert.equal(v.intents.size, 0)
  assert.match(v.error, /不在侧车面/)
})

// ⑱ why 去空白后不足 10 字 ⇒ 整批拒:不说明理由的退场等于替人猜
test('⑱ why 少于 10 字 ⇒ error 非空(整批拒)', () => {
  const r = rec('G-97#理由过短演练题面')
  const v = ex.validateRetireIntents(
    [{ key: r.key, why: '太短了', declaredAt: '2026-10-02T00:00:00.000Z' }],
    [r],
  )
  assert.ok(v.error)
  assert.equal(v.intents.size, 0)
  assert.match(v.error, /why/)
})

// ⑲ 族 B(题面挂在别的登记行正文里):hitRefs 必须覆盖每一枚命中行 —— 少一条就不放行
test('⑲ 题面挂在别的行正文里:hitRefs 必须覆盖每一枚命中行', () => {
  // 编号位被租约括注挤掉 ⇒ 这两行 compositeKeyOf 恒 null(与用例⑤同一型)
  const pA = '- [ ] （进行中@2026-10-25/甲席）退场声明档锚点演练'
  const pB = '- [ ] （进行中@2026-10-25/乙席）退场声明档锚点演练'
  const rows = [row(`${pA} —— 第一处正文,归属:甲`), row(`${pB} —— 第二处正文,归属:乙`)]
  const r = rec('G-92#退场声明档锚点演练')
  const side = new Map([[r.key, r]])
  const entries = entriesOf(r)
  const item = {
    key: r.key,
    why: '题面只挂在那两条无主键行的正文里,逐条点名后再退',
    declaredAt: '2026-10-21T00:00:00.000Z',
  }
  // 完全不给声明档 ⇒ 旧护栏原样生效
  assert.equal(ex.retirePlanOf(entries, rows, side).retireKeys, 0)
  // 给了声明但一条 ref 都不给 ⇒ 仍 held,原因里点名"未覆盖全部命中行"
  const v0 = ex.validateRetireIntents([item], [r])
  const p0 = ex.retirePlanOf(entries, rows, side, { retireIntents: v0.intents })
  assert.equal(v0.error, null)
  assert.equal(p0.retireKeys, 0)
  assert.match(p0.held[0].why, /未覆盖全部命中行\(2 条命中\/0 条 ref\)/)
  // 只点名部分命中行 ⇒ 仍 held
  const v1 = ex.validateRetireIntents([{ ...item, hitRefs: [pA] }], [r])
  const p1 = ex.retirePlanOf(entries, rows, side, { retireIntents: v1.intents })
  assert.equal(p1.retireKeys, 0)
  assert.match(p1.held[0].why, /未覆盖全部命中行/)
  // 每一枚命中行都被点名 ⇒ 可退(ref 各认领一行,不重复)
  const v2 = ex.validateRetireIntents([{ ...item, hitRefs: [pA, pB] }], [r])
  const p2 = ex.retirePlanOf(entries, rows, side, { retireIntents: v2.intents })
  assert.equal(p2.retireKeys, 1)
  assert.equal(p2.retire[0].intent.hitRefs.length, 2)
})

// ⑳ 声明档不绕过既有前置:台账面仍有同号行 ⇒ 有 intent 也 held(编号是强身份)
test('⑳ 有 intent 但台账面仍有同号行 ⇒ held(声明档绕不过既有前置)', () => {
  const r = rec('G-50#旧版题面', { updatedBy: 'plan-fields-extract' })
  const item = {
    key: r.key,
    why: '题面已在台账消失,声明退场后由同号行的归属承接',
    declaredAt: '2026-10-02T00:00:00.000Z',
  }
  const v = ex.validateRetireIntents([item], [r])
  assert.equal(v.error, null)
  assert.equal(v.intents.size, 1)
  const rows = [row('- [ ] **G-50 改写后的全新题面** —— 说明')]
  const rp = ex.retirePlanOf(entriesOf(r), rows, new Map(), { retireIntents: v.intents })
  assert.equal(rp.retireKeys, 0)
  assert.match(rp.held[0].why, /同号行/)
})

// ㉑ 同一键声明两份 ⇒ 整批拒:声明面自相矛盾时,写哪一份都是替人裁决
test('㉑ 同键重复声明 ⇒ error 非空(同一键只能有一份交代)', () => {
  const r = rec('G-98#重复声明演练题面')
  const item = {
    key: r.key,
    why: '同一键写两份交代说明声明面自相矛盾',
    declaredAt: '2026-10-02T00:00:00.000Z',
  }
  const v = ex.validateRetireIntents([item, { ...item }], [r])
  assert.ok(v.error)
  assert.equal(v.intents.size, 0)
  assert.match(v.error, /重复声明/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
