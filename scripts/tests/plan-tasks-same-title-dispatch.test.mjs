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
 *
 * E2E 臂 2026-10-16 修:真仓同题副本的存量见证者已随清偿搬走(立因那天的 37 组已清光),
 * "真仓此刻必须存在同题副本"的断言把清光那一笔读成判据失明(见证者随归档搬家自锁)。
 * 现改为:正/反对照走**构造面**(git 夹具仓 + `--root`,判据走生产链路),真仓面只留
 * **性质对账**(点名组数与 HEAD 面同题超集的关系),对任何存量读数都成立、不钉数量。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { sameTitleDispatchGroups } from '../plan-tasks.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

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

describe('端到端 — 构造面取证(正/反对照)+ 真仓现读性质对账', () => {
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

  // 「见证者随归档搬家」那一型的修法:真仓同题副本的**存量**已被清偿(见证者搬走了),
  // 把"真仓此刻必须存在同题副本"当断言 ⇒ 清光那一笔提交后本臂自锁成恒红门(§12e 同型)。
  // 故牙放在**构造面**(git 夹具仓 + `--root`,判据走生产链路),真仓面只留**性质对账**
  // (点名组数与 HEAD 面同题超集的关系,对任何读数都成立,不钉数量)。
  const headFaceOf = (root) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', root, 'show', 'HEAD:PROJECT_PLAN.md'], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

  // 夹具必须是**真 git 仓**:plan-tasks 全量档判 HEAD blob(`git show`),非 git 目录会走"未判定"rc 2。
  const makeFixture = (lines, tag) => {
    const dir = mkScratch(`ihui-same-title-${tag}-`)
    const git = (...args) =>
      execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), lines.join('\n') + '\n')
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'f@f')
    git('config', 'user.name', 'f')
    git('add', '-A')
    git('commit', '-qm', 'base')
    return dir
  }
  const runIn = (dir) =>
    execFileSync('node', [path.join(REPO, 'scripts/plan-tasks.mjs'), '--open', '--dispatchable', '--root', dir], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

  it('正对照(构造面):同题两行必须被默认档点名 1 组 / 2 行(两行逐字取自门 203 自带正例)', () => {
    const dir = makeFixture(
      [
        '# 计划',
        '### P0',
        '- [ ] G-100 **修复登录超时问题** 详情甲',
        '- [ ] G-999 **修复登录超时问题。** 详情乙(2026-10-13)',
      ],
      'pos',
    )
    try {
      const outFx = runIn(dir)
      const mFx = /同题副本\(与守门 203 \*\*同一份指纹\*\*量得\):本清单里 (\d+) 组 \/ (\d+) 行/.exec(outFx)
      assert.ok(mFx, `构造面 stdout 未点名同题副本 ⇒ 派单面失明。实得:${outFx.slice(-300)}`)
      assert.equal(Number(mFx[1]), 1, `必须恰好点名 1 组,实得 ${mFx[1]}`)
      assert.equal(Number(mFx[2]), 2, `必须恰好点名 2 行,实得 ${mFx[2]}`)
      assert.match(outFx, /2 份 @ L3,L4/, '点名必须落到行号(不报名 = 下一位要重发现一遍)')
    } finally {
      rmScratch(dir)
    }
  })

  it('负对照(构造面):题面不同的两行不得被点名,且两行仍必须进派单名额(夹具没退化)', () => {
    const dir = makeFixture(
      [
        '# 计划',
        '### P0',
        '- [ ] G-100 **修复登录超时问题** 详情甲',
        '- [ ] G-101 **新增导出报表功能** 说明',
      ],
      'neg',
    )
    try {
      const outFx = runIn(dir)
      assert.doesNotMatch(outFx, /同题副本/, '不同题不得并组(判多了就是把别人的活并掉)')
      assert.match(outFx, /派单口径中"现在可做" 2 \/ 2 行/, '两行必须都活着进派单面(0/0 = 夹具没造出有效面,本臂白跑)')
    } finally {
      rmScratch(dir)
    }
  })

  it('真仓现读性质对账(不钉数量):点名组数必须与 HEAD 面同题超集同形,清光时必为 0', () => {
    const superset = sameTitleDispatchGroups(
      headFaceOf(REPO)
        .split('\n')
        .map((l, i) => row(l, i + 1))
        .filter((r) => r.raw.startsWith('- [ ]')),
    )
    // 派单面只吃 claimable ∩ actionable 行(⊆ 全量未勾行)⇒ 每个派单面组都装在某一个超集组里
    // ⇒ 点名组数恒 ≤ 超集组数;超集为 0 ⇒ 点名必为 0(点名了就是判据虚报)。
    const named = m ? Number(m[1]) : 0
    if (superset.length === 0) {
      assert.equal(
        named,
        0,
        `HEAD 面同题超集为 0(见证者已清光),派单面却点名了 ${named} 组 ⇒ 判据虚报或读的是过期面`,
      )
    } else {
      assert.ok(
        named > 0 && named <= superset.length,
        `点名组数 ${named} 应落在 (0, 超集 ${superset.length}]`,
      )
    }
    console.log(`   ℹ 现读:派单面点名 ${named} 组 / ${m ? Number(m[2]) : 0} 行;全量未勾行超集 ${superset.length} 组`)
  })

  it('点名不得动派单名额:同一命令跑两遍,"现在可做 N / M" 必须逐字相同', () => {
    const head = (s) => (/派单口径中"现在可做" (\d+) \/ (\d+) 行/.exec(s) ?? [])[0]
    assert.equal(head(run()), head(out), '两次跑法的名额读数不一致 ⇒ 点名段动了名额')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
