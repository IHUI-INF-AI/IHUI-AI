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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  KNOWN_FLAGS,
  buildRowDedupe,
  findRowTwins,
  inspectArgs,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
