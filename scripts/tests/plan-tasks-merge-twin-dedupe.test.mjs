// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-761:单行等值副本删除档(`--dedupe-rows` / `--dedupe-open-rows`,以及 `--dedupe-blocks` 的
 * 那块"看不见单行"的报告面)的取证套件。
 *
 * ## 本套件钉的是哪一维
 * 票面写的是"`--dedupe-blocks` 的阈值(≥3 行且每行 ≥40 字符的连续块)覆盖不到两行逐字相同的单行孪生"。
 * **那一半已由两枚后续票落地**(G-336 `--dedupe-rows` 管 `- [x]` 档,G-741 `--dedupe-open-rows` 管
 * `- [ ]` + 已带副本指针档),本套件不重复发明第三把尺子。本票在**当前实现**上量到的缺口是两格:
 *  ① **认领牌(租约)不是这两档的判据维度** —— 取组函数只看"勾选态 / 长度 / 顶层 / 逐字相同(/指针)",
 *     从不看 `（进行中…）`。真仓 HEAD 面现读:`--dedupe-open-rows` 会把 **47 组 / 115 行**别人持有中的
 *     认领送进删除集,`--dedupe-rows` 另有 11 组 / 13 行。而**现有八条零损失断言一条都拦不住**:
 *     带牌行本来就不进派单口径(`claimed` 与 `claimable` 是两个集合),所以"活数一枚不少"照样成立;
 *     删的确实又是 `- [ ]` 行,所以"open 减量=声明删除数"也照样成立。
 *  ② **"两态不缩水 / 主键族不丢终端代表"这两条守恒断言不在公共核里** —— 已勾档连 `done` 侧的对账
 *     都没有;未勾档只单点对 `open`。
 * 本票补的就是这两格:第⑥维进取组函数(唯一实现 `collectRowTwinGroups`,两档共用),
 * 三条守恒断言进公共核 `verifyRowDedupeCore`(两档同时生效),并把 `--dedupe-blocks` 在 F6=0 时
 * 那句"✅ 无逐字重复的整块登记"补成**同时报出单行那一维的读数**(否则读的人把"没有块"当"没有孪生")。
 *
 * ## 分工边界(不得漂开)
 *  - `plan-copy-fold.mjs` = **禁止删行**的主键档:翻勾 + 写归并注记,行数一字不变;它有"带租约一律跳过"。
 *  - `--heal` = F1/F2/F4:改行内状态与注记,一行不删。
 *  - `--dedupe-rows` / `--dedupe-open-rows` = **删第 2..N 份逐字相同副本**(本套件的对象)。
 *  - `--dedupe-blocks` = 删第 2..N 份**逐字相同的连续块**。
 *  三把尺子问的是三个不同问题,任何一把去替另一把作答(例如用删除档做"同主键折叠")就是本仓禁的
 *  "两把尺子互相顶名额"。
 *
 * ## 为什么这里既"现读真仓"又"自带逐字常量"(§22c)
 * §22c 要求镜像测试至少一条用例的输入**逐字取自真实文件**(或从 HEAD 现读一条),因为夹具只复刻
 * 实现形状时,测试会从防线变成缺陷的掩体。所以 A 组直接对 `git show HEAD:PROJECT_PLAN.md` 现读跑判据;
 * 而"现读"依赖仓库此刻的状态 —— 台账被清干净的那天,B/C/D 组必须仍然有牙,故 REAL_* 两条常量
 * **逐字取自 2026-10-01 的 HEAD:PROJECT_PLAN.md**(复现命令写在各条用例里),不是本文件自造的句子。
 *
 * ## 断言写法(AGENTS 硬规矩)
 * 所有 cond 都是**已求值的布尔**(`(()=>…)()`),没有一条把箭头函数交给 `assert` —— 传函数会得到
 * "实得:function",那条断言从写下起从未求值而账面记绿(门 150 票㉛ 实测 8 条即此型)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

import {
  buildOpenRowDedupe,
  buildRowDedupe,
  findLeasedTwinRefusals,
  findOpenRowRefusals,
  findOpenRowTwins,
  findRowTwins,
  isLeasedRow,
  leasedTwinNote,
  openRowsDedupeAndLand,
  verifyOpenRowDedupe,
  verifyRowDedupe,
} from '../plan-tasks-merge.mjs'
import { auditPlan, compositeKeyOf } from '../lib/plan-task-index.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPTS = path.resolve(HERE, '..')
const REPO = path.resolve(HERE, '../..')
const SRC = readFileSync(path.resolve(SCRIPTS, 'plan-tasks-merge.mjs'), 'utf8')

/**
 * ── 逐字取自 HEAD:PROJECT_PLAN.md(2026-10-01 现读)的两行真账 ──────────────
 * 复验命令(任何一天都能跑,不依赖本文件):
 *   node -e "import('./scripts/plan-tasks-merge.mjs').then(m=>{const t=require('child_process')\
 *     .execFileSync('git',['show','HEAD:PROJECT_PLAN.md'],{maxBuffer:1<<28}).toString();\
 *     console.log(m.findLeasedTwinRefusals(t).slice(0,2))})"
 */
const REAL_OPEN_TWIN =
  '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见同主键的当前状态那条(编号相同、不带租约)(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。 〔【归并】重复登记副本(2026-09-29):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕'
const REAL_LEASED_TWIN =
  '- [ ]（进行中@2026-09-27/v3wave4）84. 26h 级耐久任务底座(依赖 51 + 已有 checkpoint/resume + 77) 〔【归并】重复登记副本(2026-09-30):逐字相同的另一条登记(与本行正文逐字相同,可按正文检索),派单以那条为准,本行不再单独派单。〕'

/** 已完成档的真账(逐字取自同一面,行尾带 `（进行中@…）` 牌 ⇒ 它同时是 done 档的租约反例)。 */
const REAL_DONE_LEASED =
  '- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「D31」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 （进行中@2026-09-26/D31票） D31 设计稿转码:Figma Frame/组件→可运行前端代码(对标 Trae 设计还原)'

/**
 * 同复合主键而正文已漂开的一对。**必须是合成行**,不是真仓行:真仓那条 `副本指针(编号 62)：…`
 * 的 `compositeKeyOf` 现读为 null(编号住在括号里,不在行首),而 F4/drifted 那一族按复合主键分组,
 * 无主键的行它结构性看不见(尺子自己的口径,不是我挑的)。所以要证"漂移族被点名",只能给一对有编号的。
 * 编号取 `G-97610001`,与真账任何编号都不撞(撞了的话 F4 会把这条夹具算进面内债)。
 */
const DRIFT_A =
  '- [ ] G-97610001 单行孪生的漂移对照:同一段前缀必须长到越过第四十个字符才分叉,之后甲写第一段取证。〔【归并】重复登记副本(合成)〕'
const DRIFT_B =
  '- [ ] G-97610001 单行孪生的漂移对照:同一段前缀必须长到越过第四十个字符才分叉,之后乙写第二段取证。〔【归并】重复登记副本(合成)〕'

const readHeadPlan = () =>
  execFileSync('git', ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'], {
    cwd: REPO,
    maxBuffer: 1 << 28,
    windowsHide: true,
  }).toString()

const seedRepo = (dir, text) => {
  const git = (a) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...a], {
      windowsHide: true,
      encoding: 'utf8',
    })
  git(['init', '-q', '.'])
  git(['config', 'user.email', 'g761@example.invalid'])
  git(['config', 'user.name', 'g761-fixture'])
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), text, 'utf8')
  git(['add', 'PROJECT_PLAN.md'])
  git(['commit', '-q', '-m', 'seed'])
}
const headOf = (dir) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, 'show', 'HEAD:PROJECT_PLAN.md'], {
    windowsHide: true,
    maxBuffer: 1 << 26,
    encoding: 'utf8',
  })
const planTasksJson = (dir, extra) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [path.resolve(SCRIPTS, 'plan-tasks.mjs'), '--root', dir, '--open', '--json', ...extra],
      {
        windowsHide: true,
        maxBuffer: 1 << 26,
        encoding: 'utf8',
      },
    ),
  )

describe('A 真仓现读(§22c 的逐字输入):删除集合里不得有任何认领牌', () => {
  const text = readHeadPlan()

  it('HEAD 面:findRowTwins / findOpenRowTwins 命中的每一组都必须无认领牌', () => {
    const leasedInDone = (() => findRowTwins(text).filter((g) => isLeasedRow(g.line)).length)()
    const leasedInOpen = (() => findOpenRowTwins(text).filter((g) => isLeasedRow(g.line)).length)()
    assert.equal(
      leasedInDone,
      0,
      `已完成档的删除集合里出现 ${leasedInDone} 组认领牌 ⇒ 第⑥维没接进取组函数`,
    )
    assert.equal(
      leasedInOpen,
      0,
      `未勾档的删除集合里出现 ${leasedInOpen} 组认领牌 ⇒ 第⑥维没接进取组函数`,
    )
  })

  it('租约报名这一维必须真能数到东西(构造面;真仓阳性对照已被 G-1102638 批3 清偿,见常量条)', () => {
    // 真仓 HEAD 面的带牌等值孪生已由 G-1102638 批3(过期租约∩自述副本,82c33620f6/68bfc07853,
    // 2026-10-08)清干净(现读 0 组)—— 按本套件自写契约("台账清干净那天把真仓条改成构造面证明
    // 或删掉,不得留恒真断言"),阳性对照转为构造面,两档各喂一对逐字带牌孪生。
    const openFace = ['# 台账', '', REAL_LEASED_TWIN, REAL_LEASED_TWIN, ''].join('\n')
    const doneFace = ['# 台账', '', REAL_DONE_LEASED, REAL_DONE_LEASED, ''].join('\n')
    const openRef = (() => findLeasedTwinRefusals(openFace))()
    const doneRef = (() => findLeasedTwinRefusals(doneFace))()
    assert.ok(
      openRef.length === 1 && doneRef.length === 1,
      `两档构造面各一枚带牌孪生 ⇒ 各须报到 1 组;实得 open=${openRef.length} done=${doneRef.length}(数不到 = 尺子空转)`,
    )
    assert.ok(
      [...openRef, ...doneRef].every((g) => isLeasedRow(g.line)),
      '租约报名里混进了不带牌的组 ⇒ 报名口径与取组口径不同形',
    )
    assert.ok(
      openRef.every((g) => g.arm === 'open') && doneRef.every((g) => g.arm === 'done'),
      '两档必须各自报得出自己那一族的租约;只有一档 = 另一档的跳过逻辑无人可验',
    )
  })

  it('报名里的行若被喂进删除档,一份都不许少(构造面;出处同上)', () => {
    const g = (() =>
      findLeasedTwinRefusals(
        ['# 台账', '', REAL_LEASED_TWIN, REAL_LEASED_TWIN, ''].join('\n'),
      )[0])()
    assert.ok(g, '构造面都量不到 open 档租约组 ⇒ 判据坏了,本条无从谈起')
    const fixture = ['# 台账', g.line, g.line, ''].join('\n')
    assert.equal(
      (() => buildOpenRowDedupe(fixture).deletedCount)(),
      0,
      '把带牌孪生喂进未勾档 ⇒ 必须一份不删',
    )
  })

  it('REAL_OPEN_TWIN 必须逐字活在 HEAD 面;REAL_LEASED_TWIN 退为历史标本(真账出处不变)', () => {
    const lines = new Set(text.split('\n'))
    assert.ok(
      lines.has(REAL_OPEN_TWIN),
      'REAL_OPEN_TWIN 不再逐字存在于 HEAD 面 ⇒ 从上面复验命令重取,不得就地改写',
    )
    // REAL_LEASED_TWIN(84. 26h 级耐久任务底座,带 2026-09-27 牌)那一族真账已被 G-1102638 批3
    // 过期租约清偿收走(2026-10-08)—— 逐字常量保留其真账出处(2026-10-01 HEAD),只断"标本形态
    // 仍带牌"(B③/C④ 的构造面对照全靠它),不再断"仍在面"那种时变条件。
    assert.ok(
      (() => isLeasedRow(REAL_LEASED_TWIN))(),
      'REAL_LEASED_TWIN 标本必须仍带认领牌(否则 B③/C④ 的构造面对照全空转)',
    )
  })
})

describe('B 删除判据的四条成对对照(缺一条就是只证明了会删)', () => {
  it('① 真孪生 ⇒ 必删,且只删第 2..N 份(留一份幸存)', () => {
    const src = ['# 台账', '', REAL_OPEN_TWIN, REAL_OPEN_TWIN, REAL_OPEN_TWIN, ''].join('\n')
    const r = buildOpenRowDedupe(src)
    assert.equal((() => r.deletedCount)(), 2, '三份逐字相同 ⇒ 只删第 2、3 份')
    assert.equal(
      (() => r.text.split('\n').filter((l) => l === REAL_OPEN_TWIN).length)(),
      1,
      '必须恰好留一份原件',
    )
    assert.deepEqual(
      (() => verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines))(),
      [],
      '纯删除必须过全部零损失断言(含本票新加的三条)',
    )
  })

  it('② 同复合主键而正文已漂开 ⇒ 一份都不动,且必须被点名交人工', () => {
    const src = ['# 台账', '', DRIFT_A, DRIFT_B, ''].join('\n')
    assert.ok(
      (() => {
        return (
          compositeKeyOf(DRIFT_A) === compositeKeyOf(DRIFT_B) && compositeKeyOf(DRIFT_A) !== null
        )
      })(),
      '夹具前提不成立:这一对必须有同一个复合主键,否则证的不是"同主键漂移"那一族',
    )
    assert.equal((() => findOpenRowTwins(src).length)(), 0, '漂移对不得进删除集(机器折半即有损)')
    const r = buildOpenRowDedupe(src)
    assert.equal(r.deletedCount, 0)
    assert.ok(r.text.includes(DRIFT_A) && r.text.includes(DRIFT_B), '两行必须逐字留在产物里')
    assert.ok(
      (() => findOpenRowRefusals(src).drifted.length)() >= 1,
      '漂移族必须报名 —— 只判"不删"而不点名,下一个人会以为这一族不存在',
    )
  })

  it('③ 带认领牌 ⇒ 一律跳过,并逐条报名(不静默少删)', () => {
    const src = ['# 台账', '', REAL_LEASED_TWIN, REAL_LEASED_TWIN, REAL_LEASED_TWIN, ''].join('\n')
    assert.ok(isLeasedRow(REAL_LEASED_TWIN), '常量本身必须带牌,否则这一条什么都没证明')
    assert.equal((() => findOpenRowTwins(src).length)(), 0, '带牌组不得进未勾档的删除集')
    assert.equal((() => buildOpenRowDedupe(src).text)(), src, '产物必须逐字等于输入(一行都没动)')
    const ref = findLeasedTwinRefusals(src)
    assert.equal(ref.length, 1, '跳过必须被点名成一组,不得静默')
    assert.equal(ref[0].copies, 3)
    assert.match(leasedTwinNote(src, 'open'), /租约硬跳过.*3 份|1 组/)
    // 同一形态换成"不带牌"就必须进删除集 —— 证明拦住它的是牌,不是长度/形态
    const unleased = src.split(REAL_LEASED_TWIN).join(REAL_OPEN_TWIN)
    assert.ok(
      (() => findOpenRowTwins(unleased).length)() === 1,
      '同一形态去掉牌以后仍不命中 ⇒ 本档整族失明(判据坏了)',
    )
  })

  it('④ 勾选态不越界:open 档不碰 [x],done 档不碰 [ ];删过的每一族必留幸存份', () => {
    const DONE_TWIN =
      '- [x] ✅(2026-09-26) G-97610002 一条被抄了两遍的已完成登记:正文逐字相同,长度足够越过 40 字符噪声阈,用来证 done 档的动作面。'
    const OPEN_TWIN =
      '- [ ] G-97610003 一条未勾的等值孪生(合成):两份逐字相同,长度足够越过噪声阈,并带〔【归并】重复登记副本(合成)〕指针。'
    const src = ['# 台账', '', DONE_TWIN, DONE_TWIN, OPEN_TWIN, OPEN_TWIN, ''].join('\n')

    const openR = buildOpenRowDedupe(src)
    assert.equal(openR.deletedCount, 1, '未勾档应只吃掉 OPEN_TWIN 的第二份')
    assert.ok(
      openR.removed.every((x) => x.line === OPEN_TWIN),
      '未勾档的删除集里混进了别的行 ⇒ 勾选态越界',
    )
    assert.equal(
      openR.text.split('\n').filter((l) => l === DONE_TWIN).length,
      2,
      '未勾档吃掉了 [x] 行(§1:已勾的那两份不是本档的射程)',
    )

    const doneR = buildRowDedupe(src)
    assert.equal(doneR.deletedCount, 1, '已完成档应只吃掉 DONE_TWIN 的第二份')
    assert.ok(
      doneR.removed.every((x) => x.line === DONE_TWIN),
      '已完成档的删除集里混进了未勾行(反面:那会把待办折成做过)',
    )
    assert.equal(
      doneR.text.split('\n').filter((l) => l === DONE_TWIN).length,
      1,
      '§1 禁止无声删除:被删的每一个值都必须还有同文幸存份',
    )
    assert.equal(
      doneR.text.split('\n').filter((l) => l === OPEN_TWIN).length,
      2,
      '已完成档吃掉了未勾行',
    )
  })
})

describe('C 五条守恒断言逐条有牙(构造面:做坏必须红)', () => {
  const src = [
    '# 台账',
    '# 区头(非注册行,本档不得吃)',
    '',
    REAL_OPEN_TWIN,
    REAL_OPEN_TWIN,
    REAL_OPEN_TWIN,
    '',
  ].join('\n')
  const r = buildOpenRowDedupe(src)

  it('正常纯删除:五条断言全过(这是 C 组其余四条的对照基线)', () => {
    assert.deepEqual(verifyOpenRowDedupe(src, r.text, r.deletedCount, null, r.droppedLines), [])
  })

  it('非注册行被吃掉 ⇒ 「不是任务登记行」那一维必须红', () => {
    const bad = r.text
      .split('\n')
      .filter((l) => l !== '# 区头(非注册行,本档不得吃)')
      .join('\n')
    assert.ok(
      (() => verifyOpenRowDedupe(src, bad, r.deletedCount, null, null))().some((p) =>
        p.includes('不是任务登记行'),
      ),
      '多删掉一条非登记行而账面判绿 ⇒ 本档可以"顺手"吃掉标题/正文',
    )
  })

  it('多删一行未勾(声明没算) ⇒ 多重集与声明数的对账必须红', () => {
    const bad = r.text
      .split('\n')
      .filter((l) => l !== REAL_OPEN_TWIN)
      .join('\n')
    const ps = (() => verifyOpenRowDedupe(src, bad, r.deletedCount, null, null))()
    // 被删集合由判据**从产物自己算**,不接受调用方声明的数 —— 这一条就是"声明与实删不一致"的出口。
    assert.ok(
      ps.some((p) => p.includes('按多重集算出的被删份数')),
      `多重集对账没响:${JSON.stringify(ps)}`,
    )
    assert.ok(ps.some((p) => p.includes('一份都不剩') || p.includes('行数差')))
  })

  it('删掉一张认领牌 ⇒ 「认领牌不缩水」必须红(现有 claimable 那一维看不见它)', () => {
    const leasedSrc = ['# 台账', '', REAL_LEASED_TWIN, REAL_LEASED_TWIN, ''].join('\n')
    const beforeClaimed = planCount(leasedSrc, 'claimed')
    // 手工造一份"把两张牌都删光"的产物,判它是否比"没删"少了 claimed
    const wiped = '# 台账\n\n'
    assert.ok(beforeClaimed === 2, `夹具本身应含 2 张认领牌,实得 ${beforeClaimed}`)
    const ps = (() => verifyRowDedupeCoreProbe(leasedSrc, wiped, 2))()
    assert.ok(
      ps.some((p) => p.includes('认领牌')),
      `删光认领牌没被"认领牌不缩水"拦住 ⇒ 第⑥维的机器证据是空的:${JSON.stringify(ps)}`,
    )
  })

  it('某主键族的唯一终端代表被删 ⇒ 「幸存份在位」与「终端代表不丢」两条都要红', () => {
    const onlyOne = ['# 台账', '', REAL_OPEN_TWIN, ''].join('\n')
    const none = ['# 台账', '', ''].join('\n')
    const ps = (() => verifyOpenRowDedupe(onlyOne, none, 1, null, null))()
    assert.ok(
      ps.some((p) => p.includes('一份都不剩')),
      '族里最后一份被删必须红',
    )
  })

  it('已勾态被吃 ⇒ doneRows 交叉对账必须红(公共核此前完全没有这一维)', () => {
    // 顶上的 `# 区头` 行不是注册行(stateOf 归 null)⇒ "不是任务登记行" 与 "行数差" 都会红;
    // 而这一条要单独证的是**已勾态**那一维:被吃掉的是一条本档没认领的 `- [x]` 行,
    // 此时多重集算出的 cut.done 与声明删除数不再吻合(第一版把这条写成 counts.doneRows ——
    // 一个不存在的字段,于是恒红;这条用例同时是那处缺陷的替代证明)。
    const doneLine = REAL_DONE_LEASED.replace('（进行中@2026-09-26/D31票） ', '')
    const dSrc = ['# 台账', '', doneLine, doneLine, ''].join('\n')
    const dr = buildRowDedupe(dSrc)
    assert.equal(dr.deletedCount, 1, '夹具应命中已完成档一份副本')
    assert.deepEqual(verifyRowDedupe(dSrc, dr.text, dr.deletedCount), [], '正常删除必须全过')
    const over = dr.text.replace(doneLine, '')
    const ps = (() => verifyRowDedupe(dSrc, over, 1))()
    assert.ok(
      ps.some((p) => p.includes('已勾选行数') || p.includes('按多重集算出的被删份数')),
      `吃掉第二张 [x] 而两态对账不响 ⇒ 已勾态无人看守:${JSON.stringify(ps)}`,
    )
    assert.ok(
      ps.some((p) => p.includes('一份都不剩')),
      '族的最后一份被删必须同时报"一份都不剩"',
    )
  })
})

describe('D 夹具面 --open 复算:删除前后 claimable 不变 / open 恰好少同样多', () => {
  it('落地一枚真提交前后,派单口径一枚不少、未勾选恰好少 deletedCount', () => {
    const src = ['# 台账', '', REAL_OPEN_TWIN, REAL_OPEN_TWIN, REAL_OPEN_TWIN, ''].join('\n')
    const dir = mkScratch('g761-open-e2e-')
    try {
      seedRepo(dir, src)
      const before = planTasksJson(dir, [])
      const rc = openRowsDedupeAndLand(null, 8, { root: dir })
      assert.equal(rc, 0, `落地必须返回 0,实得 ${rc}`)
      const after = planTasksJson(dir, [])
      const deleted = (() => buildOpenRowDedupe(src).deletedCount)()
      assert.equal(
        after.counts.open,
        before.counts.open - deleted,
        `未勾选总数必须恰好少 ${deleted}(前 ${before.counts.open} 后 ${after.counts.open})—— 多减就是吃掉了别人的活`,
      )
      assert.equal(
        after.counts.claimable,
        before.counts.claimable,
        '派单口径不得因为删副本而变化(删的是已经不计入派单的那几份)',
      )
      assert.equal(after.counts.claimed, before.counts.claimed, '认领牌数必须一字不动')
      assert.equal(
        headOf(dir)
          .split('\n')
          .filter((l) => l === REAL_OPEN_TWIN).length,
        1,
      )
    } finally {
      rmScratch(dir)
    }
  })
})

describe('E 变异自证:判据放宽回"前缀相同即副本"必须当场翻红', () => {
  /**
   * 手法:把门体连它的相对依赖拷进临时仓,对**拷贝**做字符串级变异,再 import 那份变异模块,
   * 用同一条漂移夹具喂两版 —— 生产版必须 0 命中,变异版必须命中。
   * 只断言"生产版不命中"是不够的:那等于只证明了判据太窄。变异臂证的才是"这条对照有牙"。
   */
  const mutate = (label, fn) => {
    const dir = mkScratch('g761-mut-')
    try {
      const dst = path.join(dir, 'scripts')
      copyScriptWithClosure(SCRIPTS, 'plan-tasks-merge.mjs', dst, [
        'lib/plan-task-index.mjs',
        'lib/scratch-dir.mjs',
      ])
      const p = path.join(dst, 'plan-tasks-merge.mjs')
      const srcTxt = readFileSync(p, 'utf8')
      const outTxt = fn(srcTxt)
      assert.notEqual(
        outTxt,
        srcTxt,
        `变异 ${label} 一个字节都没改下去 ⇒ 变异靶写歪了,这条断言是恒真的`,
      )
      writeFileSync(p, outTxt, 'utf8')
      return import(pathToFileURL(p).href)
    } finally {
      // 变异模块已在 import 缓存里,删盘不删缓存;dir 留给 GC(刻意不 rmSync —— 删掉会让
      // 同一进程内的后续用例读到已消失的文件路径,报错形状与"判据红"难以区分)
      void dir
    }
  }

  it('把"整行等值"放宽成"前 40 字符等值" ⇒ 漂移对会被当副本删,生产版不会', async () => {
    const mod = await mutate('prefix-equality', (t) =>
      t.replace(
        'if (!seen.has(l)) seen.set(l, [])\n    seen.get(l).push(i + 1)',
        'const __k = l.slice(0, 40)\n    if (!seen.has(__k)) seen.set(__k, [])\n    seen.get(__k).push(i + 1)',
      ),
    )
    const src = ['# 台账', '', DRIFT_A, DRIFT_B, ''].join('\n')
    assert.equal((() => findOpenRowTwins(src).length)(), 0, '生产判据必须把漂移对留在删除集外')
    assert.ok(
      (() => mod.findOpenRowTwins(src).length)() === 1,
      '变异版竟也不命中 ⇒ 变异没生效,那条对照是空转的',
    )
  })

  it('摘掉租约硬跳过 ⇒ 带牌组立刻进删除集,而公共核的「认领牌不缩水」是第二道闸', async () => {
    const mod = await mutate('lease-skip', (t) =>
      t.replace('if (!includeLeased && isLeasedRow(l)) return', 'void includeLeased'),
    )
    const src = ['# 台账', '', REAL_LEASED_TWIN, REAL_LEASED_TWIN, REAL_LEASED_TWIN, ''].join('\n')
    assert.equal((() => findOpenRowTwins(src).length)(), 0, '生产判据必须跳过带牌组')
    assert.ok(
      (() => mod.findOpenRowTwins(src).length)() === 1,
      '摘掉跳过之后仍未命中 ⇒ 拦住它的不是这一维(那本票的产出就落空了)',
    )
    const mr = mod.buildOpenRowDedupe(src)
    assert.equal(mr.deletedCount, 2, '变异版应当真的拟删 2 行(否则下一句没有东西可拦)')
    const ps = (() => verifyOpenRowDedupe(src, mr.text, mr.deletedCount, null, null))()
    assert.ok(
      ps.some((p) => p.includes('认领牌')),
      `变异版删掉了认领牌却没被公共核拦住 ⇒ 第二道闸是空的:${JSON.stringify(ps)}`,
    )
  })
})

describe('F 形状锁:三件事不得靠下一次的自觉', () => {
  const collector = SRC.slice(
    SRC.indexOf('function collectRowTwinGroups'),
    SRC.indexOf('export function findRowTwins'),
  )
  const core = SRC.slice(
    SRC.indexOf('export function verifyRowDedupeCore'),
    SRC.indexOf('export function rowsDedupeAndLand'),
  )

  it('租约判据只有一份实现(引 CLAIM_SOURCE,不在门里另拼字面量)', () => {
    assert.ok(
      /import \{[\s\S]{0,400}CLAIM_SOURCE[\s\S]{0,400}\} from '\.\/lib\/plan-task-index\.mjs'/.test(
        SRC,
      ),
      '未从尺子导入 CLAIM_SOURCE',
    )
    assert.match(
      SRC,
      /const ROW_LEASE_RE = new RegExp\(CLAIM_SOURCE\)/,
      '租约正则必须由 CLAIM_SOURCE 构造',
    )
    assert.ok(
      !/（进行中/.test(collector),
      '取组函数体内又手写了一遍 `（进行中` 字面量 ⇒ 与守门 109 的词族必然漂开',
    )
  })

  it('三条新断言必须住在公共核(住在某一档 = 另一档静默没有这一维)', () => {
    assert.match(core, /认领牌\(租约\)行数/, '公共核缺"认领牌不缩水"')
    assert.match(core, /不是任务登记行/, '公共核缺"被删行必须是注册行"')
    assert.match(core, /主键族终端代表/, '公共核缺"族不丢终端代表"')
    assert.match(core, /与被删的已勾份数/, '公共核缺已勾态对账(已勾档此前一条都没有)')
  })

  it('报名函数必须真被三档接上(函数在而没人调 = 提交链上一路安静)', () => {
    const calls = (SRC.match(/leasedTwinNote\(/g) || []).length
    assert.ok(
      calls >= 4,
      `leasedTwinNote 调用点只有 ${calls - 1} 处(定义占 1)——三档里至少 --dedupe-rows / --dedupe-open-rows 各一处 + 定义,少于 4 处就是有档没接`,
    )
    const blocksArm = SRC.slice(
      SRC.indexOf("if (has('--dedupe-blocks'))"),
      SRC.indexOf("if (has('--dedupe-rows'))"),
    )
    assert.ok(
      blocksArm.length > 800,
      '取不出 --dedupe-blocks 那一档的源码 ⇒ 下面这条锁对着空气判绿',
    )
    assert.match(
      blocksArm,
      /twinNote\(\)/,
      '块档的报告没接上单行那一维 ⇒ "没有块"仍会被读成"没有孪生"',
    )
  })

  it('两档共用同一份取组实现(各写一遍过滤条件必然漂开)', () => {
    assert.match(SRC, /export function findRowTwins\(content\) \{\s*return collectRowTwinGroups\(/)
    assert.match(
      SRC,
      /export function findOpenRowTwins\(content\) \{\s*return collectRowTwinGroups\(/,
    )
    const seen = (SRC.match(/seen\.get\(l\)\.push\(i \+ 1\)/g) || []).length
    assert.equal(seen, 1, `取组核心出现 ${seen} 处 ⇒ 已经有人抄了第二份`)
  })
})

/** 直接对文本面取 counts(公共核用的就是这一把尺子)。 */
function planCount(text, key) {
  return auditPlan(text).counts[key]
}

/**
 * 公共核的探针:把"删光认领牌"这种产物喂给未勾档的核(不传 droppedLines,让它仍跑公共核那五条
 * + 本档独有三条)。之所以要有这个显式包装:构造出来的坏产物没有 droppedLines 集合可传,
 * 而"不传"与"传一个空 Set"在判据上是两件事 —— 传空集等于宣布"本轮声明删 0 行",
 * 那会把本条要证的"删了牌"直接洗成"什么都没做"。
 */
function verifyRowDedupeCoreProbe(srcText, outText, deletedCount) {
  return verifyOpenRowDedupe(srcText, outText, deletedCount, null, null)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
