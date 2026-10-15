// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派单面「同题副本」点名(`plan-tasks.mjs --open --dispatchable`,2026-10-16 立)。
 *
 * 立因:机主要求"不允许其他 agent 打架重复做同一件任务"。同一件事被登记两份时派单清单会把两份都
 * 发出去(装好后实测:默认档 425 行可派单里 37 组 / 99 行同题)⇒ 两个会话各领一张票各做一遍。
 *
 * 取证口径(§22c):判据一律 import 源脚本的 `sameTitleDispatchGroups`,本文件不复制归一化逻辑;
 * 正对照的两行**逐字取自守门 203 自测试里那条"同题不同号必命中"** —— 上一版这里栽过跟头:夹具自己
 * 写错(把规格数组当可变参数传给构造器)却差点被判成"判据不成立而整体回退"。所有 cond 都是已求值布尔。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { sameTitleDispatchGroups } from '../plan-tasks.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const SRC = readFileSync(path.resolve(REPO, 'scripts/plan-tasks.mjs'), 'utf8')

const row = (raw, line) => ({ raw, line, title: raw.replace(/^- \[[ xX]\]\s*/, '').slice(0, 46) })

describe('同题副本分组 — 判据本身', () => {
  it('正对照(两行逐字取自门 203 自带正例):同题不同号必须并成一组两行', () => {
    const g = sameTitleDispatchGroups([
      row('- [ ] G-100 **修复登录超时问题** 详情甲', 1),
      row('- [ ] G-999 **修复登录超时问题。** 详情乙(2026-10-13)', 2),
    ])
    assert.equal(g.length, 1, `必须并成一组,实得 ${g.length}`)
    assert.equal(g[0].members.length, 2)
    assert.deepEqual(g[0].members.map((m) => m.line), [1, 2])
  })

  it('不同题不误伤(判多了就是把别人的活并掉)', () => {
    assert.equal(
      sameTitleDispatchGroups([
        row('- [ ] G-100 **修复登录超时问题** 详情甲', 1),
        row('- [ ] G-101 **新增导出报表功能** 说明', 2),
      ]).length,
      0,
    )
  })

  it('已勾行不参与:结清副本不该在派单面被点名', () => {
    assert.equal(
      sameTitleDispatchGroups([
        row('- [ ] G-100 **修复登录超时问题** 详情甲', 1),
        row('- [x] ✅(2026-10-16) G-101 **修复登录超时问题** 详情乙', 2),
      ]).length,
      0,
    )
  })

  it('无号形态必须有牙:带未解析令牌 / 带释放牌的副本正是原本隐形的那一族', () => {
    const base = '**无号同题副本的合成票，标题足够长以越过二十个归一化字符的判定阈值** 正文段一致'
    const g = sameTitleDispatchGroups([
      row(`- [ ] {{NEXT_ID}} ${base}`, 1),
      row(`- [ ]（认领已释放@2026-10-15/x） {{NEXT_ID}} ${base}`, 2),
    ])
    assert.equal(g.length, 1, `无号副本必须被量到,实得 ${g.length} 组`)
    assert.equal(g[0].members.length, 2)
  })
})

describe('装车锁与口径', () => {
  it('同题分组必须整体委托门 203,派单器不得另拍阈值或另写一份指纹(§0.6)', () => {
    assert.ok(
      /import \{[^}]*findDuplicateGroups[^}]*\} from '\.\/check-plan-task-duplicates\.mjs'/.test(SRC),
      '必须 import 门 203 的分组出口(含其最小长度阈与无号第三类)',
    )
    assert.ok(
      !/function extractTaskFingerprint|function findDuplicateGroups/.test(SRC),
      '派单器里出现第二份指纹/分组实现 ⇒ 两份尺子必然漂开',
    )
    assert.ok(
      !/fp\.length\s*</.test(SRC),
      '不得在派单器里另拍长度阈(上一版拍过 <20,而门 203 的阈更宽 ⇒ 门判得出的组清单点不出名)',
    )
    assert.ok(/sub = findDuplicateGroups|const sub = findDuplicateGroups/.test(SRC), '必须真委托,不是挂着 import 不用')
  })

  it('只点名不剔名额:剔名额=把别人没做完的活记成做过的(§1 F4 禁令)', () => {
    assert.ok(/const stg = sameTitleDispatchGroups\(rows\)/.test(SRC), '点名段必须真接在派单档里')
    assert.ok(
      !/rows\s*=\s*sameTitleDispatchGroups|rows\.filter\([^)]*stg/.test(SRC),
      '出现按同题组剔名额的写法即违 §1',
    )
    assert.ok(SRC.includes('--fold-identical-open-rows'), '必须写出 N→1 的合法出口(守卫要带出自己的出路)')
    assert.ok(SRC.includes('禁止手写归并注记'), '另一半(正文已漂开)必须写明交人工且不许手写注记')
  })
})

describe('端到端 — 真仓现读', () => {
  const run = () =>
    execFileSync('node', [path.join(REPO, 'scripts/plan-tasks.mjs'), '--open', '--dispatchable'], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const out = run()
  const m = /同题副本\(与守门 203 \*\*同一份指纹\*\*量得\):本清单里 (\d+) 组 \/ (\d+) 行/.exec(out)

  it('默认档必须点名真仓的同题副本(不点名=门看得见、清单看不见那一型)', () => {
    const superset = sameTitleDispatchGroups(
      execFileSync('git', ['show', 'HEAD:PROJECT_PLAN.md'], {
        cwd: REPO,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .split('\n')
        .map((l, i) => row(l, i + 1))
        .filter((r) => r.raw.startsWith('- [ ]')),
    )
    assert.ok(superset.length > 0, '真仓 HEAD 面此刻应存在同题副本;若已被清光,本臂改为构造面取证再判')
    assert.ok(m, `stdout 未点名。末 300 字:${out.slice(-300)}`)
    const named = Number(m[1])
    assert.ok(named > 0 && named <= superset.length, `点名组数 ${named} 应落在 (0, 超集 ${superset.length}]`)
    console.log(`   ℹ 现读:派单面点名 ${named} 组 / ${Number(m[2])} 行;全量未勾行超集 ${superset.length} 组`)
  })

  it('点名不得动派单名额:同一命令跑两遍,"现在可做 N / M" 必须逐字相同', () => {
    const head = (s) => (/派单口径中"现在可做" (\d+) \/ (\d+) 行/.exec(s) ?? [])[0]
    assert.equal(head(run()), head(out), '两次跑法的名额读数不一致 ⇒ 点名段动了名额')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
