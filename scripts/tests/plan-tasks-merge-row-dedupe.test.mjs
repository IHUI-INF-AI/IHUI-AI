// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-336 单行等值副本档的镜像测试(`scripts/plan-tasks-merge.mjs` 的 `--dedupe-rows`)。
 *
 * 这一档存在的理由必须先被证明它判的是真东西:F6 的块级门槛(≥3 行且每行 ≥40 字符)看不见
 * "同一件事被抄成两份单行",而 F1/F2/F4 要的是未勾形态 —— 两份都已 `[x]` 时四条判据全 0 而账是错的
 * (本仓那条"状态自洽 ≠ 状态正确"的否证)。所以这里的用例成对:该摘的必须摘、不该碰的一份都不许动,
 * 并且**任何一条零损失断言不过 ⇒ 整批不落**。
 *
 * R6(2026-09-29)加的是**分块 + 轮次**:215 组 / 1144 行的账对上 25 行的单批上限,人工逐批约 46 次
 * 本身就是最大的错误源(每次都要在推进过的 HEAD 上重新定位,而 §1 判过"证据指针禁止写行号")。
 * 分块只改"一次落多少":八条断言一条不减,唯一换口径的是第⑤条幂等(改成只在本轮认领的组上判),
 * 所以这里每一臂都成对写 —— 换了范围必须仍然拦得住"已选组没删净",否则分不清"放宽范围"与"关掉判据"。
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { git as bypassGit } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  KNOWN_FLAGS,
  VALUE_FLAGS,
  buildOpenRowDedupe,
  buildRowDedupe,
  findOpenRowRefusals,
  findOpenRowTwins,
  findRowTwins,
  inspectArgs,
  openRowsDedupeAndLand,
  parsePositiveInt,
  planOpenRowChunks,
  verifyOpenRowDedupe,
  verifyRowDedupe,
} from '../plan-tasks-merge.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.resolve(HERE, '../plan-tasks-merge.mjs'), 'utf8')

const DONE_A =
  '- [x] ✅(2026-09-28) G-900 **一条被抄了两遍的已完成登记(标题足够长以过 40 字符噪声阈)**:正文逐字相同。'
const OPEN_A =
  '- [ ] G-901 **一条未勾的行(两份)**:F4 已经管它,单行档不得越界去折半 —— 那是把待办记成做过。'
const SHORT = '- [x] ✅(2026-09-28) 短行'
const DRIFT_1 =
  '- [x] ✅(2026-09-28) G-902 **漂移副本甲**:第一版措辞,长度足够越过噪声阈以便证明它不是被长度筛掉的。'
const DRIFT_2 =
  '- [x] ✅(2026-09-28) G-902 **漂移副本乙**:第二版措辞,长度同样足够 —— 两份文字不同,机器无权折半。'
const INDENT =
  '  - [x] ✅(2026-09-28) G-903 缩进的续行副本,长度足够;它属于某个块,归 F6 那把尺子管,本档不得动。'

const fixture = () =>
  ['# 台账', DONE_A, DONE_A, '', OPEN_A, OPEN_A, SHORT, SHORT, DRIFT_1, DRIFT_2, INDENT, INDENT, ''].join(
    '\n',
  )

describe('R1 判据四条门槛各自有牙', () => {
  it('只认"已完成 + 顶层 + ≥40 字符 + 逐字节相同"的副本', () => {
    const g = findRowTwins(fixture())
    assert.equal(g.length, 1, `应只命中 1 组,实得 ${g.length}`)
    assert.equal(g[0].line, DONE_A)
    assert.equal(g[0].copies, 2)
  })

  it('未勾行的两份一律不纳(待办折半等于把没做的记成做过的)', () => {
    const src = ['# t', OPEN_A, OPEN_A, ''].join('\n')
    assert.equal(findRowTwins(src).length, 0)
  })

  it('短行不纳(噪声阈);缩进续行不纳(归 F6)', () => {
    assert.equal(findRowTwins(['- [x] 短', '- [x] 短', ''].join('\n')).length, 0)
    const ind = [INDENT, INDENT, ''].join('\n')
    assert.equal(findRowTwins(ind).length, 0, '缩进行的等值副本不属于本档')
  })

  it('漂移副本(同标题不同正文)一份都不许被当成副本', () => {
    const src = [DRIFT_1, DRIFT_2, ''].join('\n')
    assert.equal(findRowTwins(src).length, 0)
  })
})

describe('R2 修复出口的删除范围', () => {
  it('只删第 2..N 份,保留首次出现;行数差 = 删除数', () => {
    const src = fixture()
    const r = buildRowDedupe(src)
    assert.equal(r.deletedCount, 1)
    const lines = src.split('\n')
    assert.equal(
      r.removed[0].at,
      lines.lastIndexOf(DONE_A) + 1,
      '删的必须是后出现那份(保留首次出现;at 是 1 基行号,只当定位用,判据是内容等值)',
    )
    assert.equal(r.text.split('\n').filter((l) => l === DONE_A).length, 1, '必须留一份幸存')
    assert.equal(src.split('\n').length - r.text.split('\n').length, r.deletedCount, '行数差必须等于删除数')
  })

  it('--match 是内容锚点:不命中的组一律不动,且"没命中"不等于"没有副本"', () => {
    const src = fixture()
    const none = buildRowDedupe(src, '这一串在本档里根本不存在-xyz')
    assert.equal(none.deletedCount, 0)
    assert.equal(none.groups.length, 0)
    const hit = buildRowDedupe(src, 'G-900')
    assert.equal(hit.deletedCount, 1)
  })

  it('落地前探针:上一枚副本若仍在新基线里,判据必须能认出(顺序子序列断言不许放行改写)', () => {
    const src = fixture()
    const r = buildRowDedupe(src)
    // 伪造一个"顺手改了别处一行"的产物,零损失断言必须拒绝(只允许纯删除)
    const tampered = r.text.replace(OPEN_A, '- [x] ✅ 我把待办顺手改成已完成了')
    const problems = verifyRowDedupe(src, tampered, r.deletedCount)
    assert.ok(problems.length > 0, '非纯删除必须被拦住')
  })
})

describe('R3 零损失断言与大批量阀门', () => {
  it('纯删除 ⇒ 五条断言全过', () => {
    const src = fixture()
    const r = buildRowDedupe(src)
    assert.deepEqual(verifyRowDedupe(src, r.text, r.deletedCount), [])
  })

  it('幸存份被抹掉 ⇒ 必红(这是"删的是副本、不是唯一副本"的唯一证明)', () => {
    const src = fixture()
    const r = buildRowDedupe(src)
    const lost = r.text.replace(DONE_A, '')
    assert.ok(verifyRowDedupe(src, lost, r.deletedCount).length > 0)
  })

  it('值变多 ⇒ 必红(重放式追加正是本仓被咬过的那型)', () => {
    const src = fixture()
    const grown = `${src}${DONE_A}\n`
    assert.ok(verifyRowDedupe(src, grown, 0).some((p) => p.includes('反而变多')))
  })

  it('F 维上涨 ⇒ 必红 —— 这一条不许被放宽:它拦的是"我用删副本顺手把别的账改好看"', () => {
    const src = fixture()
    const r = buildRowDedupe(src)
    assert.equal(verifyRowDedupe(src, r.text, r.deletedCount).length, 0)
  })

  it('幂等:做完之后本档必须清零,否则不闭合', () => {
    const src = `${fixture()}${DONE_A}\n`
    const once = buildRowDedupe(src)
    assert.equal(findRowTwins(once.text).length, 0, '一次清理后仍应有副本 ⇒ 实现漏了一份')
    const twice = buildRowDedupe(once.text)
    assert.equal(twice.deletedCount, 0, '第二次必须无话可说(幂等)')
  })

  it('阀门常量在位,且判据用的是**拟删行数**而不是组数', () => {
    assert.match(SRC, /const ROW_MASS_LIMIT = \d+/, '大批量阀门常量必须存在')
    assert.match(SRC, /rR\.deletedCount > ROW_MASS_LIMIT/, '阀门必须按拟删行数判,不按组数')
    assert.match(SRC, /has\('--allow-mass'\)/, '放行出口必须是显式旗标')
  })
})

describe('R4 装车证明(开关必须真的接进去)', () => {
  it('--dedupe-rows / --match / --allow-mass 都在旗标白名单里', () => {
    for (const f of ['--dedupe-rows', '--match', '--allow-mass']) {
      assert.ok(KNOWN_FLAGS.includes(f), `${f} 未进 KNOWN_FLAGS ⇒ 会被 inspectArgs 当未知参数拒掉`)
    }
  })

  it('inspectArgs 允许 --match 的位置值(否则带锚点运行会被整条拒收)', () => {
    const { unknown } = inspectArgs(['--dedupe-rows', '--match', '某段原文锚点', '--commit'])
    assert.deepEqual(unknown, [])
  })

  it('主档必须真的调用 rowsDedupeAndLand,且 --commit 才动手', () => {
    assert.match(SRC, /return rowsDedupeAndLand\(match\)/, '开关没接上落地函数 = 该档只出报告')
    assert.match(SRC, /if \(!has\('--commit'\)\)[\s\S]{0,160}return rowsDedupeAndLand/, '未加 --commit 必须先返回')
  })

  it('--match 给了旗标却没给值 ⇒ 拒绝并非零退出(不得静默退化成全档清理)', () => {
    assert.match(SRC, /mv\.present && !mv\.valid[\s\S]{0,200}return 2/)
  })

  it('落地函数只走 lib/bypass-git 那一份 plumbing(不得再手写一遍 read-tree/commit-tree/CAS)', () => {
    assert.match(SRC, /import \{ alignSharedIndex, casUpdateRef, commitTreeWithIndex \} from '\.\/lib\/bypass-git\.mjs'/)
    const body = SRC.slice(SRC.indexOf('export function rowsDedupeAndLand'))
    assert.ok(!/commit-tree/.test(body.slice(0, 4000)), '落地函数里不该再出现自派生 commit-tree')
  })
})

// ── 2026-09-29 修的那一咬:第④条按"份数下降"判,把本档在自己要清的那一型上永久锁死 ──
// 真仓现读证据:同一枚 HEAD 面上最多的几组等值孪生**本身就是归并指针行**,跑 `--dedupe-rows`
// 报的是"归并落账注记由 253 掉到 244(不得随副本一起丢)" ⇒ 一条都删不掉。
// 判据互咬的失效方向不是"少清一点",而是"这一维在真账面上永远落不了地",所以三条用例成对。
const NOTE_TWIN =
  '- [x] ✅(2026-09-28) G-907 **一条被并集带回两遍的已完成登记**:正文逐字相同〔【归并】翻勾落账:复测 2026-09-28〕'

describe('第④条:注记判"种类是否整类消失",不判"份数有没有变少"(G-336 单行档解咬)', () => {
  const src = ['# 台账', '', NOTE_TWIN, NOTE_TWIN, ''].join('\n')

  it('该摘的必须摘得动:孪生指针行的第 2..N 份被摘掉时零损失断言不得拦', () => {
    const r = buildRowDedupe(src)
    assert.equal(r.deletedCount, 1, '两份逐字相同的已完成行应摘掉后一份')
    assert.deepEqual(verifyRowDedupe(src, r.text, r.deletedCount), [], `不该再报"注记掉了":\n${JSON.stringify(verifyRowDedupe(src, r.text, r.deletedCount))}`)
    assert.equal(r.groups[0].copies, 2)
  })

  it('注记整类消失仍必须被拒(保护没被削掉,只是换了正确的判法)', () => {
    const out = ['# 台账', '', ''].join('\n')
    const problems = verifyRowDedupe(src, out, 2)
    assert.ok(problems.length > 0, '把唯一载体整类删掉必须拦下来')
    assert.ok(
      problems.some((p) => /一份都不剩|种类.*掉到/.test(p)),
      `拦截理由必须落在"幸存性/注记种类"上,实得:${JSON.stringify(problems)}`,
    )
  })

  it('形状锁:第④条不得再退回"份数比较"(退回去本档就永远落不了地)', () => {
    const fn = SRC.slice(SRC.indexOf('export function verifyRowDedupe'), SRC.indexOf('export function verifyTwinFold'))
    assert.ok(fn.length > 200, '取不出本档函数体 ⇒ 这条锁对着空气判绿')
    assert.ok(!/after\.mergeNotes\s*<\s*before\.mergeNotes/.test(fn), '又按份数比判了 —— 孪生指针行一删就恒拒')
    assert.ok(/countMergeNotes\(distinct\(/.test(fn), '第④条必须走"去重后的种类"这把同源尺子(且复用 lib 那一份 countMergeNotes)')
    assert.match(SRC, /import \{[\s\S]*?\bcountMergeNotes\b[\s\S]*?\} from '\.\/lib\/plan-task-index\.mjs'/)
  })
})

// ══ R5 未勾单行等值副本档(G-741,2026-09-29 立)════════════════════════
// 上面那一档的第①条门槛写死了 `^- \[x\]`,于是**未勾选**的逐字孪生行到今天仍无任何出口:
// F1 要两态并存、F4 的处置是"加指针不删行"(加完两份都带同一句指针 ⇒ 行仍在)、F4b 刻意排除带指针
// 与有主键的行、F6 只认 ≥3 行连续块、守门 71 只防丢不防重。真仓 HEAD 现读 220 组 / 1148 份,
// 而后果不是难看是功能被卡死:任何按该行内容定位的自动动作都按"锚点命中≠1 不猜"拒绝插入。
// 本档比已完成档**多一道第⑤条门槛**(必须已带「【归并】重复登记副本」指针)—— 那一条把
// "什么算副本"这一问交还给尺子自己的 claimable 排除,并由第⑥条"活数一枚不少"当场反证。
const O_TWIN =
  '- [ ] **G-900 未勾等值副本**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕三份逐字相同的未勾选副本,长度越过噪声阈。'
const O_NOPTR =
  '- [ ] **G-901 未带指针的等值孪生**:两份逐字相同 —— 那一族是 F4/F4b 的当次活账,出口是 --heal 加注记,本档不得删。'
const O_DRA = '- [ ] **G-902 同主键漂移**:第一段正文,长度足够越过噪声阈以便证明它不是被长度筛掉的。'
const O_DRB = '- [ ] **G-902 同主键漂移**:第二段正文,与甲同复合主键而正文不同 ⇒ 机器折半即有损,必须交人工。'
const O_SHORT = '- [ ] G-903 短〔【归并】重复登记副本〕'
const O_IND =
  '  - [ ] G-904 缩进的未勾副本〔【归并】重复登记副本〕长度足够越过噪声阈,所以它不是被长度筛掉而是被顶层判据筛掉的。'

const openFixture = () =>
  ['# 台账', '', O_TWIN, O_TWIN, O_TWIN, O_NOPTR, O_NOPTR, O_SHORT, O_SHORT, O_DRA, O_DRB, O_IND, O_IND, ''].join('\n')

describe('R5 判据第⑤条(指针)是本档唯一的安全论据', () => {
  it('五条件同时成立才纳组:未勾选 ∧ 顶层 ∧ ≥40 ∧ 逐字相同 ∧ 已带重复登记指针', () => {
    const g = findOpenRowTwins(openFixture())
    assert.equal(g.length, 1, `应只命中 1 组,实得 ${g.length}`)
    assert.equal(g[0].copies, 3)
    assert.equal(g[0].line, O_TWIN)
  })

  it('已完成行一律不纳(那是 --dedupe-rows 的地盘,两档不得互相顶名额)', () => {
    const src = ['# t', DONE_A, DONE_A, ''].join('\n')
    assert.equal(findOpenRowTwins(src).length, 0, '未勾档吃掉已完成行 = 同一对孪生被两把尺子各折一遍')
    assert.equal(findRowTwins(src).length, 1, '已完成那一族仍由原档负责,原判据一字未动')
  })

  it('三态各自报名,绝不静默成一桶:可删 / 交 --heal / 交人工', () => {
    const ref = findOpenRowRefusals(openFixture())
    assert.equal(ref.noPointer.length, 1, '未带指针的等值孪生必须点名(它的出口是 --heal,不是删)')
    assert.equal(ref.drifted.length, 1, '同主键而正文已漂开必须点名交人工')
    assert.ok(ref.drifted[0].at.length === 2, '漂移组必须报到行级,否则拿到数字的人无从定位')
    const r = buildOpenRowDedupe(openFixture())
    assert.ok(r.text.includes(O_NOPTR) && r.text.includes(O_DRA) && r.text.includes(O_DRB), '两族刻意不删的一份都不许少')
  })

  it('短行/缩进两个噪声阈照旧有牙(与已完成档同形)', () => {
    assert.equal(findOpenRowTwins([O_SHORT, O_SHORT, ''].join('\n')).length, 0)
    assert.equal(findOpenRowTwins([O_IND, O_IND, ''].join('\n')).length, 0)
  })
})

describe('R5 四条零损失断言各配一条"故意做坏必须拒"', () => {
  const src = openFixture()
  const r = buildOpenRowDedupe(src)

  it('纯删除 ⇒ 全过,且删的是第 2..N 份、保留首次出现', () => {
    assert.equal(r.deletedCount, 2)
    assert.deepEqual(r.removed.map((x) => x.at), [4, 5])
    assert.deepEqual(verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines), [])
    assert.equal(r.text.split('\n').filter((l) => l === O_TWIN).length, 1)
  })

  it('①漏保留行 ⇒ 必拒(删掉唯一幸存份等于把这条活从台账抹了)', () => {
    const lost = r.text.split('\n').filter((l) => l !== O_TWIN).join('\n')
    assert.ok(verifyOpenRowDedupe(src, lost, r.deletedCount, null, r.droppedLines).some((p) => p.includes('一份都不剩')))
  })

  it('②多删一行(吃掉一条真待办)⇒ 必拒,且第⑥条"活数不变"必须真的会响', () => {
    const over = r.text.replace(`${O_DRA}\n`, '')
    assert.equal(over.split('\n').length, r.text.split('\n').length - 1, '夹具必须真的多删了一行')
    const problems = verifyOpenRowDedupe(src, over, r.deletedCount, null, r.droppedLines)
    assert.ok(problems.length > 0, '多删一行必须被拦住')
    assert.ok(problems.some((p) => p.includes('活数') || p.includes('逐行等值')), `拦截理由必须落在活数/逐行等值上,实得:${problems.join('|')}`)
  })

  it('③产物含新增行 ⇒ 必拒(只断"不删"会造出重复行而账面全绿)', () => {
    const grown = `${r.text}\n- [ ] 凭空新增的一行待办,长度足够越过噪声阈以便证明它不是被长度筛掉的。`
    assert.ok(verifyOpenRowDedupe(src, grown, r.deletedCount, null, r.droppedLines).some((p) => p.includes('新增')))
    // 同值被"重放式追加" ⇒ 走的是"无值变多"那一臂(src 里只有一份,产物里变两份)
    assert.ok(verifyOpenRowDedupe(src, `${r.text}\n${O_DRA}`, r.deletedCount, null, r.droppedLines).some((p) => p.includes('变多')))
  })

  it('④行数减少量 ≠ 声明删除量 ⇒ 必拒(声明与产物必须互相咬合)', () => {
    assert.ok(verifyOpenRowDedupe(src, r.text, r.deletedCount + 1, null, r.droppedLines).some((p) => p.includes('行数差')))
  })

  it('幂等:清完之后第二次必须报"无可归并"而不是重复删除', () => {
    assert.equal(findOpenRowTwins(r.text).length, 0, '一次清理后仍有副本 ⇒ 实现漏了一份')
    assert.equal(buildOpenRowDedupe(r.text).deletedCount, 0)
  })
})

describe('R5 端到端(独立临时仓,拿真 git 问 HEAD)', () => {
  /** 造一枚只含 PROJECT_PLAN.md 的临时仓;夹具 = 3 份逐字相同 + 1 对同主键漂移。 */
  function makeRepo(text) {
    const dir = mkScratch('g741-e2e-')
    try {
      bypassGit(['init', '-q', '.'], { root: dir })
      bypassGit(['config', 'user.email', 'e2e@example.invalid'], { root: dir })
      bypassGit(['config', 'user.name', 'e2e-fixture'], { root: dir })
      writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), text, 'utf8')
      bypassGit(['add', 'PROJECT_PLAN.md'], { root: dir })
      bypassGit(['commit', '-q', '-m', 'seed'], { root: dir })
      return dir
    } catch (e) {
      rmScratch(dir)
      throw e
    }
  }
  const showHead = (dir) => bypassGit(['show', 'HEAD:PROJECT_PLAN.md'], { root: dir, raw: true })

  it('只删第 2..N 份、漂移那一对原地不动、提交只含台账、工作树不被触碰', () => {
    const dir = makeRepo(openFixture())
    try {
      const head0 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir }), 0, '落地必须返回 0')
      assert.notEqual(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head0, 'HEAD 必须前进一枚')
      const after = showHead(dir)
      assert.equal(after.split('\n').filter((l) => l === O_TWIN).length, 1, '三份等值副本必须只留一份')
      assert.ok(after.includes(O_DRA) && after.includes(O_DRB), '漂移副本一份都不许动')
      assert.ok(after.includes(O_NOPTR), '未带指针的等值孪生必须整族留在面上')
      assert.equal(bypassGit(['show', '--name-only', '--format=', 'HEAD'], { root: dir }), 'PROJECT_PLAN.md', '落地提交只允许含台账一个路径')
      // 底稿取被审面(HEAD blob),工作树那份不许被本档改写 —— 它是别人的现场
      assert.ok(bypassGit(['status', '--porcelain'], { root: dir }).includes('PROJECT_PLAN.md'), '临时仓的工作树副本保持原样(不 checkout)')
    } finally {
      rmScratch(dir)
    }
  })

  it('第二次连跑:报"无可归并"且不得再产提交(计数一律按当次 HEAD 现算)', () => {
    const dir = makeRepo(openFixture())
    try {
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir }), 0)
      const head1 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir }), 0, '第二次也必须 rc=0(无话可说不是失败)')
      assert.equal(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head1, '第二次不得造出空提交')
    } finally {
      rmScratch(dir)
    }
  })

  it('只有漂移族/只有未带指针孪生时:rc=0 且 HEAD 一步不前进(不得为"看起来修过"造提交)', () => {
    const dir = makeRepo(['# 台账', '', O_DRA, O_DRB, O_NOPTR, O_NOPTR, ''].join('\n'))
    try {
      const head0 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir }), 0)
      assert.equal(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head0, '没有可折的副本就不该有提交')
    } finally {
      rmScratch(dir)
    }
  })
})

describe('R5 装车证明与形状锁', () => {
  it('--dedupe-open-rows 进旗标白名单(否则 inspectArgs 把它当未知参数整条拒收)', () => {
    assert.ok(KNOWN_FLAGS.includes('--dedupe-open-rows'), '未进 KNOWN_FLAGS ⇒ 该档结构上跑不起来')
    const { unknown } = inspectArgs(['--dedupe-open-rows', '--match', '某段原文锚点', '--commit'])
    assert.deepEqual(unknown, [])
  })

  it('主档必须真的接上落地函数,且 --commit 才动手;非 HEAD 面一律拒绝落地', () => {
    const armStart = SRC.indexOf("if (has('--dedupe-open-rows'))")
    const arm = SRC.slice(armStart, SRC.indexOf('  const sel = selectFace(', armStart))
    assert.ok(arm.length > 2000, '取不出 --dedupe-open-rows 那一档的源码 ⇒ 下面三条锁都在对空气判绿')
    assert.match(
      arm,
      /return openRowsDedupeAndLand\(\s*match,\s*8,\s*\{[\s\S]{0,160}root: ROOT[\s\S]{0,240}maxRows[\s\S]{0,160}rounds/,
      '落地必须把分块两旗(maxRows / rounds)真的传进去 —— 只在 CLI 里算完又不传 = 报告与实际落地两套数',
    )
    const commitGuard = arm.indexOf("if (!has('--commit'))")
    const landCall = arm.indexOf('return openRowsDedupeAndLand(')
    assert.ok(commitGuard > 0 && landCall > commitGuard, '未加 --commit 必须先返回 —— 落地调用排在它后面才成立')
    assert.match(arm, /selO\.face !== 'head'[\s\S]{0,900}return 2/, '索引/工作树面只许出报告,拒落地(§12 污染型)')
    // 分块不拆阀门:CLI 与单轮函数各留一处按**拟删行数**判
    assert.match(arm, /rO\.deletedCount > ROW_MASS_LIMIT && !has\('--allow-mass'\)/, 'CLI 档的阀门不得被分块顺手拆掉')
    const once = SRC.slice(SRC.indexOf('function openRowsDedupeOnce'), SRC.indexOf('export function openRowsDedupeAndLand'))
    assert.match(once, /r\.deletedCount > ROW_MASS_LIMIT && !allowMass/, '单轮函数同样必须判阀门(绕过 CLI 直接调用也要拦)')
  })

  it('落地只走 lib/bypass-git 那一份 plumbing(同一套代码本仓手写过 6 份并漂开)', () => {
    const body = SRC.slice(SRC.indexOf('function openRowsDedupeOnce'), SRC.indexOf('// ── 同题不同编号的孪生登记折叠档'))
    assert.ok(body.length > 800, '取不出本档落地函数体 ⇒ 这条锁对着空气判绿')
    assert.ok(!/commit-tree|read-tree|update-index/.test(body), '本档内不得再自派生 plumbing 命令')
    assert.ok(/commitTreeWithIndex\(\{/.test(body) && /casUpdateRef\(/.test(body) && /alignSharedIndex\(\{/.test(body), '三个出口必须都用上')
    assert.ok(/catBatch\(root, \[spec\], \{ maxBuffer: 1 << 28 \}/.test(body), '底稿必须经 face-reader 按 root 取被审面(不得 readFileSync 工作树)')
    assert.ok(!/readFileSync\(/.test(body), '落地函数里出现 readFileSync = 把滞后的工作树当判定输入')
    // 外层轮次循环的三条不可漂写法
    const outer = SRC.slice(SRC.indexOf('export function openRowsDedupeAndLand'), SRC.indexOf('// ── 同题不同编号的孪生登记折叠档'))
    assert.match(outer, /openRowsDedupeOnce\(match, maxAttempts, opts\)/, '外层必须真的调单轮函数,而不是把逻辑再抄一遍')
    assert.ok(!/commitTreeWithIndex\(\{/.test(outer), 'plumbing 只许住在单轮函数里(两处各写一遍必漂)')
    assert.match(outer, /return 2/, 'undetermined 必须原样传播 2 —— 把 2 收敛成 1 就是把"没判"写成"判过了"')
  })
})

// ══ R6 分块 + 轮次(2026-09-29 立)═══════════════════════════════════
// 这道档的存在理由必须先写清楚:真仓 HEAD 现读 215 组 / 1144 行可删,而单批上限是 25 行。
// 出路只有两条 —— 人工逐批约 46 次(每次都要在推进过的 HEAD 上重新定位,而 §1 早已判"证据指针
// 禁止写行号"),或让工具自己按块落。分块改的**只有"一次落多少"**,八条零损失断言一条不减;
// 唯一换口径的是第⑤条幂等,而它换的恰好是"本轮没认领的组算不算未清"这一件本轮无从负责的事。
// 所以下面每一臂都必须同时给出"该放的放过"与"该拦的拦住"两条,否则放宽与失明分不清。
const C_A4 =
  '- [ ] **G-920 四份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕四份逐字相同的未勾副本,cost=3,长度越过噪声阈。'
const C_B2 =
  '- [ ] **G-921 两份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕两份逐字相同的未勾副本,cost=1,长度同样越过噪声阈。'
const chunkFixture = () => ['# 台账', '', C_A4, C_A4, C_A4, C_A4, C_B2, C_B2, ''].join('\n')

describe('R6 分块按组完整取:绝不切半', () => {
  it('maxRows=3 时 4 份那组整组入块、2 份那组整组保留(切半会让"幸存份在位"失去意义)', () => {
    const src = chunkFixture()
    const r = buildOpenRowDedupe(src, null, 3)
    assert.equal(r.groups.length, 2, 'groups 仍是"锚点命中的全部组",语义不得随分块改变(既有调用方按它报命中数)')
    assert.equal(r.selectedGroups.length, 1, '本轮只认领装得下的那一组')
    assert.equal(r.selectedGroups[0].line, C_A4)
    assert.equal(r.deletedCount, 3, `第一组 cost=3 恰好装满,实得 ${r.deletedCount}`)
    assert.equal(r.text.split('\n').filter((l) => l === C_A4).length, 1, '入块的组必须留首次出现那一份')
    assert.equal(r.text.split('\n').filter((l) => l === C_B2).length, 2, '未入块的组必须**整份**保留 —— 这就是"不许切半"')
    assert.ok([...r.selectedLines].join('|') === C_A4, 'selectedLines 必须是入选组的整行原文集合(幂等判据按它取范围)')
  })

  it('单组超上限时:整组跳过并报名,但排在它后面的小组照样进块(2026-09-29 改口径)', () => {
    const r = buildOpenRowDedupe(chunkFixture(), null, 2)
    assert.equal(r.selectedGroups.length, 1, '首组 cost=3 超上限 ⇒ 整组跳过,但 cost=1 的次组必须仍被装上')
    assert.equal(r.deletedCount, 1, '只装次组那 1 行;被跳过那组一份都不动()')
    assert.ok(r.plan.oversized.length === 1 && r.plan.oversized[0].copies === 4 && r.plan.oversized[0].cost === 3, '超上限那组必须报名到份数与行数')
    assert.equal(r.plan.remainingRows, 3, `被跳过的那组留 3 行无路可装,实得 ${r.plan.remainingRows}`)
    assert.equal(r.text.split(String.fromCharCode(10)).filter((l) => l === C_A4).length, 4, '被跳过的组一份都不动(它是换出口的对象,不是本轮的对象)')
  })

  it('投影与 build 同源:块数与各块行数必须互洽(报告与落地不许两套数)', () => {
    const groups = findOpenRowTwins(chunkFixture())
    const p3 = planOpenRowChunks(groups, 3)
    assert.equal(p3.chunks.length, 2, 'cost 3 + cost 1 ⇒ 两块')
    assert.deepEqual(p3.chunks.map((c) => c.rows), [3, 1])
    assert.equal(p3.oversized.length, 0, '全部组都进得了块时不得虚报超上限')
    assert.equal(p3.totalRows, 4)
    assert.equal(p3.remainingRows, 0)
    const p2 = planOpenRowChunks(groups, 2)
    assert.equal(p2.chunks.length, 1, '上限 2 ⇒ 次组单独成一块(旧口径这里是 0 块,等于对整档一条都不生效)')
    assert.ok(p2.oversized.length === 1 && p2.oversized[0].cost === 3, '必须点名超上限的那一组,不许静默')
    assert.equal(planOpenRowChunks(groups, null).chunks.length, 1, 'maxRows=null ⇒ 一整块装全部')
    assert.equal(planOpenRowChunks([], 5).chunks.length, 0, '空组集必须 0 块(空扫不造绿也不造块)')
    assert.equal(planOpenRowChunks([], 5).oversized.length, 0, '没有组就没有超上限组,不得凭空造一条')
  })
})

describe('R6 第⑤条幂等:分块时按"本轮认领的组"判 —— 成对', () => {
  const src = chunkFixture()
  const r = buildOpenRowDedupe(src, null, 3)

  it('正向:面上还剩未轮到的组 ⇒ 断言必须绿(否则每次分块都恒拒,这条路一步也走不通)', () => {
    assert.ok(findOpenRowTwins(r.text).length > 0, '夹具必须真的还剩未处理的组,否则这条正向臂在测空气')
    assert.deepEqual(verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines, r.selectedLines), [])
  })

  it('反向:scopeLines 传错(不含已选组)⇒ 必红 —— 只有上一条的话,分不清"放宽了范围"和"关了判据"', () => {
    const wrong = new Set([C_B2])
    const problems = verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines, wrong)
    assert.ok(problems.some((p) => p.includes('不闭合')), `实得:${problems.join('|')}`)
  })

  it('已选组没删净时,即便带着正确的 scope 也照样红(换口径不等于放过)', () => {
    const half = src.split('\n')
      .filter((l, i) => !(i + 1 === 6 && l === C_A4))
      .join('\n')
    const problems = verifyOpenRowDedupe(src, half, r.deletedCount, null, r.droppedLines, r.selectedLines)
    assert.ok(problems.length > 0, '只删两份而声明删三份 ⇒ 必须被拦住')
  })

  it('其余七条一字未动:未入块的组若被吃掉,仍然当场红', () => {
    const ate = r.text.replace(`${C_B2}\n`, '')
    const problems = verifyOpenRowDedupe(src, ate, r.deletedCount, null, new Set([4, 5, 6]), r.selectedLines)
    assert.ok(problems.some((p) => p.includes('逐行等值') || p.includes('活数')), `实得:${problems.join('|')}`)
  })

  it('不传 scopeLines 时保持原 match 语义逐字不变(已完成档与旧调用方不受分块波及)', () => {
    const full = buildOpenRowDedupe(src)
    assert.deepEqual(verifyOpenRowDedupe(src, full.text, full.deletedCount, null, full.droppedLines), [])
    // 什么都不删(deletedCount=0)时幂等条照旧不许响 —— 与改动前逐字同形(它一直是 `deletedCount > 0` 才判)
    assert.deepEqual(verifyOpenRowDedupe(src, src, 0, null, null), [])
    // 同一份"还有未处理组"的产物,**不传** scope 时必须红:这证明 scopeLines 真的在起作用,
    // 而不是"幂等条反正也判不到东西"(若两者同色,本档就是关了判据而不是换了范围)。
    const problems = verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines)
    assert.ok(problems.some((p) => p.includes('不闭合')), `不传 scope 的分块产物必须被判不闭合,实得:${problems.join('|')}`)
  })
})

describe('R6 maxRows=null 与旧行为逐字等值(防止为分块偷偷改选取顺序)', () => {
  const src = openFixture()
  // 独立预言:旧实现删的是 L4、L5(O_TWIN 的第 2..3 份)。这个期望值**不是**从实现算出来的。
  const legacyExpected = src
    .split('\n')
    .filter((_, i) => i !== 3 && i !== 4)
    .join('\n')

  it('不带第三参与带 null 的产物,必须与旧实现的"删 L4/L5"逐字全等', () => {
    const two = buildOpenRowDedupe(src)
    const three = buildOpenRowDedupe(src, null, null)
    assert.equal(two.text, legacyExpected, '两参调用(旧签名)产物被改了 —— 分块不许动默认路径')
    assert.equal(three.text, legacyExpected, '显式 null 与省略必须同义')
    assert.equal(two.text, three.text)
    assert.deepEqual(two.removed.map((x) => x.at), [4, 5])
  })

  it('上限大到一装得下全部 ⇒ 与不分块逐字等值;同一输入两跑也必须逐字等值', () => {
    assert.equal(buildOpenRowDedupe(src, null, 99999).text, legacyExpected)
    assert.equal(buildOpenRowDedupe(chunkFixture(), null, 3).text, buildOpenRowDedupe(chunkFixture(), null, 3).text)
  })
})

describe('R6 parsePositiveInt:成对(合法值必放行,四类非法值各点名实得)', () => {
  it('25 放行;0 / 负数 / 小数 / 科学计数 / 非数字 / 缺值一律拒', () => {
    assert.deepEqual(parsePositiveInt('25'), { ok: true, value: 25 })
    for (const bad of ['0', '-5', '25.9', '1e3', 'abc', '', null, undefined, 25]) {
      assert.equal(parsePositiveInt(bad).ok, false, `${JSON.stringify(bad)} 必须被拒 —— Number()/parseInt 各自都会静默收掉其中一类`)
    }
    assert.ok(parsePositiveInt('0').reason.includes('实得'), '拒绝必须带回原样实得,否则调用方分不清漏写与写错')
  })
})

describe('R6 端到端:轮次循环在独立临时仓里真跑', () => {
  const R1 =
    '- [ ] **G-930 第一轮该落的组**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕四份逐字相同,cost=3,长度越过噪声阈。'
  const R2 =
    '- [ ] **G-931 第二轮该落的组**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕四份逐字相同,cost=3,长度同样越过噪声阈。'
  const R3 =
    '- [ ] **G-932 第三轮该落的组**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕三份逐字相同,cost=2,长度再越过一次噪声阈。'
  const roundsFixture = () => ['# 台账', '', R1, R1, R1, R1, R2, R2, R2, R2, R3, R3, R3, ''].join('\n')
  const LATE =
    '- [ ] **G-934 单组就超上限的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕五份逐字相同,cost=4 > 上限,它永远进不了块。'
  const stopFixture = () => ['# 台账', '', R1, R1, R1, LATE, LATE, LATE, LATE, LATE, ''].join('\n')

  function makeRepo(text) {
    const dir = mkScratch('g741-chunk-')
    bypassGit(['init', '-q', '.'], { root: dir })
    bypassGit(['config', 'user.email', 'e2e@example.invalid'], { root: dir })
    bypassGit(['config', 'user.name', 'e2e-fixture'], { root: dir })
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), text, 'utf8')
    bypassGit(['add', 'PROJECT_PLAN.md'], { root: dir })
    bypassGit(['commit', '-q', '-m', 'seed'], { root: dir })
    return dir
  }
  const showHead = (dir) => bypassGit(['show', 'HEAD:PROJECT_PLAN.md'], { root: dir, raw: true })
  const commitCount = (dir) => bypassGit(['rev-list', '--count', 'HEAD'], { root: dir })

  it('3 组共 8 行可删 + maxRows=3 rounds=5 ⇒ 落 3 枚提交后正常收尾,台账清零,工作树一字未变', () => {
    const src = roundsFixture()
    const dir = makeRepo(src)
    try {
      assert.equal(buildOpenRowDedupe(src, null, 3).plan.chunks.length, 3, '夹具必须恰好凑成 3 块(3/3/2)')
      const head0 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir, maxRows: 3, rounds: 5 }), 0, '三轮落地 + 第四轮 empty ⇒ rc 0')
      assert.equal(Number(commitCount(dir)), 4, `应为 seed + 3 枚,实得 ${commitCount(dir)}`)
      const after = showHead(dir)
      for (const line of [R1, R2, R3])
        assert.equal(after.split('\n').filter((l) => l === line).length, 1, `${line.slice(0, 24)}… 必须只留首次出现那一份`)
      assert.equal(findOpenRowTwins(after).length, 0, '台账本轮范围内必须无剩余(报 empty 而不是"还剩很多")')
      assert.equal(
        bypassGit(['show', '--name-only', '--format=', 'HEAD'], { root: dir }),
        'PROJECT_PLAN.md',
        '每枚提交只允许含台账一个路径',
      )
      assert.equal(
        bypassGit(['show', '--name-only', '--format=', 'HEAD~1'], { root: dir }),
        'PROJECT_PLAN.md',
        '中间那块同样只含台账',
      )
      assert.equal(readFileSync(path.join(dir, 'PROJECT_PLAN.md'), 'utf8'), src, '工作树那份是别人的现场 —— 分块多落几枚也不许碰它')
      assert.ok(bypassGit(['status', '--porcelain'], { root: dir }).includes('PROJECT_PLAN.md'), '工作树保持"落后于 HEAD"的原样(不 checkout)')
      assert.notEqual(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head0)
    } finally {
      rmScratch(dir)
    }
  })

  it('中途停:第 1 轮落一块,第 2 轮首组超上限 ⇒ rc 非 0、只有一枚提交、前一块保留', () => {
    const src = stopFixture()
    const dir = makeRepo(src)
    try {
      const head0 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir, maxRows: 3, rounds: 4 }), 1, '第 2 轮 refused ⇒ 退出码 1')
      assert.equal(Number(commitCount(dir)), 2, `只能是 seed + 1 枚(停住之后不许再产提交),实得 ${commitCount(dir)}`)
      const after = showHead(dir)
      assert.equal(after.split('\n').filter((l) => l === R1).length, 1, '第 1 轮的清偿必须留着(每块是独立前向提交)')
      assert.equal(after.split('\n').filter((l) => l === LATE).length, 5, '堵住的那一组一份都不许被"顺手"处理掉')
      assert.equal(readFileSync(path.join(dir, 'PROJECT_PLAN.md'), 'utf8'), src, '停在那里 ≠ 回滚已落的块,更不许动工作树')
      assert.notEqual(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head0)
    } finally {
      rmScratch(dir)
    }
  })

  it('阀门方向不变:不带 max-rows 而拟删 > 25 行 ⇒ 拒批量 rc=1、零提交(分块没把阀门拆掉)', () => {
    const one =
      '- [ ] **G-933 二十八份同文的整档夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕长度足够越过噪声阈,用来测大批量阀门。'
    const src = ['# 台账', ...Array.from({ length: 28 }, () => one), ''].join('\n')
    const dir = makeRepo(src)
    try {
      assert.equal(buildOpenRowDedupe(src).deletedCount, 27, '夹具必须真的越过 25 行阈值')
      const head0 = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      assert.equal(openRowsDedupeAndLand(null, 8, { root: dir }), 1, '无 --max-rows 且拟删 > 25 ⇒ 仍按原口径拒批量')
      assert.equal(bypassGit(['rev-parse', 'HEAD'], { root: dir }), head0, '拒批量必须一分不落,不许造半落地现场')
      // 同一夹具换了分块口径就该走得动(证明阀门是被"块大小"合规地满足,不是被拆掉)
      assert.ok(buildOpenRowDedupe(src, null, 25).deletedCount <= 25, '分块后单块必须 ≤ 上限')
    } finally {
      rmScratch(dir)
    }
  })
})

describe('R5 形状锁补:共用核与分块旗标成套性(被摘线不得被读成已装车)', () => {
  it('两档共用同一份零损失核(出现第二份断言实现就红,不靠人记得同步)', () => {
    assert.match(SRC, /export function verifyRowDedupeCore\(/)
    assert.match(SRC, /verifyRowDedupeCore\(srcText, outText, deletedCount, match, findRowTwins\)/)
    assert.match(SRC, /verifyRowDedupeCore\(srcText, outText, deletedCount, match, findOpenRowTwins, scopeLines\)/)
    // 已完成档那一臂**不得**被分块参数波及:它必须仍然只传 5 参(scopeLines 走默认 null)
    assert.ok(!/findRowTwins, scopeLines/.test(SRC), '已完成档若也开始吃 scopeLines,幂等就在它那一侧被悄悄放宽了')
    assert.match(SRC, /function verifyRowDedupeCore\(srcText, outText, deletedCount, match, findTwins, scopeLines = null\)/)
    assert.match(SRC, /export function verifyRowDedupe\(srcText, outText, deletedCount, match = null\)/, '旧 4 参签名不许动 —— 已完成档的调用方还在按它传')
    assert.match(SRC, /scopeSetOf\(scopeLines\)\.has\(g\.line\)/, '范围成员必须按**整行原文**取,不得退化成子串 includes')
  })

  it('旗标成套性:白名单 / 值旗标表 / inspectArgs 三处必须同时认识 --max-rows 与 --rounds', () => {
    for (const f of ['--max-rows', '--rounds', '--help']) {
      assert.ok(KNOWN_FLAGS.includes(f), `${f} 未进 KNOWN_FLAGS ⇒ inspectArgs 会把整条命令当未知参数拒掉`)
    }
    for (const f of ['--max-rows', '--rounds']) {
      assert.ok(VALUE_FLAGS.includes(f), `${f} 未进 VALUE_FLAGS ⇒ 它的值会被判成未知位置参数(旗标认识、值不认识)`)
    }
    assert.deepEqual(inspectArgs(['--dedupe-open-rows', '--max-rows', '25', '--rounds', '60', '--commit']).unknown, [])
    assert.ok(inspectArgs(['--dedupe-open-rows', '25']).unknown.includes('25'), '没有被值旗标领着的裸位置参数必须仍被拒 —— 放宽到"所有裸值"就没人管错位的参数了')
    assert.match(SRC, /VALUE_FLAGS\.includes\(list\[i - 1\]\)/, 'inspectArgs 必须从 VALUE_FLAGS 派生,不得再抄一份 if 链')
    assert.match(SRC, /if \(has\('--help'\)\) return printHelp\(\)/, '--help 必须真的接进 main,否则它只是白名单里一个空名字')
    assert.match(SRC, /--max-rows <N>/, '--help 里必须解释新旗标(只列名字不解释,与没有 --help 同义)')
    assert.match(SRC, /--rounds <N>/, '同上')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
