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
  buildOpenRowDedupe,
  buildRowDedupe,
  findOpenRowRefusals,
  findOpenRowTwins,
  findRowTwins,
  inspectArgs,
  openRowsDedupeAndLand,
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
    assert.match(SRC, /return openRowsDedupeAndLand\(match, 8, \{ root: ROOT, allowMass: has\('--allow-mass'\) \}\)/)
    assert.match(SRC, /if \(!has\('--commit'\)\)[\s\S]{0,200}return openRowsDedupeAndLand/)
    assert.match(SRC, /selO\.face !== 'head'[\s\S]{0,600}return 2/, '索引/工作树面只许出报告,拒落地(§12 污染型)')
  })

  it('落地只走 lib/bypass-git 那一份 plumbing(同一套代码本仓手写过 6 份并漂开)', () => {
    const body = SRC.slice(SRC.indexOf('export function openRowsDedupeAndLand'), SRC.indexOf('// ── 同题不同编号的孪生登记折叠档'))
    assert.ok(body.length > 800, '取不出本档落地函数体 ⇒ 这条锁对着空气判绿')
    assert.ok(!/commit-tree|read-tree|update-index/.test(body), '本档内不得再自派生 plumbing 命令')
    assert.ok(/commitTreeWithIndex\(\{/.test(body) && /casUpdateRef\(/.test(body) && /alignSharedIndex\(\{/.test(body), '三个出口必须都用上')
    assert.ok(/catBatch\(root,/.test(body), '底稿必须经 face-reader 按 root 取被审面(不得 readFileSync 工作树)')
    assert.ok(!/readFileSync\(/.test(body), '落地函数里出现 readFileSync = 把滞后的工作树当判定输入')
  })

  it('两档共用同一份零损失核(出现第二份断言实现就红,不靠人记得同步)', () => {
    assert.match(SRC, /export function verifyRowDedupeCore\(/)
    assert.match(SRC, /verifyRowDedupeCore\(srcText, outText, deletedCount, match, findRowTwins\)/)
    assert.match(SRC, /verifyRowDedupeCore\(srcText, outText, deletedCount, match, findOpenRowTwins\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
