// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:plan-tasks-merge.mjs 的 --merge-drifted 漂开副本归并档(G-1058524)。
// 判定口径一律 import 生产实现的 __test__,不复制第二份注记形状/判据;另有一臂经 CLI
// 端到端跑(临时仓对象空间落地),证明"报告 → --keeper 两步确认 → --commit"整条链真的装车。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import {
  KNOWN_FLAGS,
  VALUE_FLAGS,
  __test__ as M,
} from '../plan-tasks-merge.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPTS = path.resolve(HERE, '..')

// ─── 夹具:两条"同题而正文漂开"的无编号副本(t 票面同形)──
const KEEPER = '- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段,明暗两态均复现):根因=函数形态 style 被 cssInterop 吃掉;已修 + 回归锁 7 例。'
const COPY = '- [ ] P1 **区段头「更多」与箭头折成两行**(学习页 3 个区段 + 首页区段):bannerFace.flexDirection 被归并写回旧态;PlazaScreen:216 已走 apiFailureToError。'
const OTHER = '- [ ] P1 **完全无关的另一条票**:别碰它。'

function fixture() {
  return ['', KEEPER, '', COPY, '', OTHER, ''].join('\n')
}

test('旗标装车:--merge-drifted/--keeper 进 KNOWN_FLAGS ∧ VALUE_FLAGS(否则 inspectArgs 拒掉合法用法)', () => {
  assert.ok(KNOWN_FLAGS.includes('--merge-drifted'))
  assert.ok(KNOWN_FLAGS.includes('--keeper'))
  assert.ok(VALUE_FLAGS.includes('--merge-drifted'))
  assert.ok(VALUE_FLAGS.includes('--keeper'))
})

test('findDriftedFamilies:按题面子串锚点成族(无编号副本也认),带指针/已折/带认领牌的行不进族', () => {
  const fam = M.findDriftedFamilies(fixture().split('\n'), '区段头「更多」与箭头')
  assert.equal(fam.error, undefined)
  assert.equal(fam.rows.length, 2)
  assert.equal(fam.rows[0].line, 2)
  assert.equal(fam.rows[1].line, 4)
  // 锚点脏输入三态:太短 / 含换行 ⇒ 报 error 而不是判空族
  assert.match(M.findDriftedFamilies(fixture().split('\n'), '区段').error, /锚点太短/)
  assert.match(M.findDriftedFamilies(fixture().split('\n'), '区段头\n更多').error, /换行/)
  // 已带副本指针的行不再是漂开副本
  const withPtr = fixture().replace(COPY, COPY + ' 〔【归并】重复登记副本(x):派单以那条为准〕')
  assert.equal(M.findDriftedFamilies(withPtr.split('\n'), '区段头「更多」与箭头').rows.length, 1)
  // 带认领牌(进行中)的行跳过并报名(租约写在题面之后 —— 写在题面之前会被题面闸切开,那是另一型)
  const leased = fixture().replace('两行**(学习页 3 个区段 + 首页区段', '两行**（进行中@x）(学习页 3 个区段 + 首页区段')
  const famL = M.findDriftedFamilies(leased.split('\n'), '区段头「更多」与箭头')
  assert.equal(famL.rows.length, 1)
  assert.equal(famL.skippedLeased.length, 1)
})

test('applyDriftedMerge:两步确认语义 —— 不点名持有行不猜;持有行必须在族内', () => {
  assert.match(M.applyDriftedMerge(fixture(), '区段头「更多」与箭头', null, '2026-10-18').error, /不足两份|点名/)
  assert.match(
    M.applyDriftedMerge(fixture(), '区段头「更多」与箭头', 6, '2026-10-18').error,
    /族内/,
  )
})

test('buildDriftFold/stripDriftFold:可逆、一行不删、注记含 DUP_POINTER 认的字面;无编号副本走无编号沿革', () => {
  const folded = M.buildDriftFold(COPY, '区段头「更多」与箭头折成两行**(学习页 3 个区段,明暗两态均复现', '2026-10-18')
  assert.ok(folded)
  assert.match(folded, /【归并】重复登记副本·漂开归并·2026-10-18/)
  // 正文逐字保留:剥注记回底稿
  assert.equal(M.stripDriftFold(folded), COPY)
  assert.ok(M.isDriftFolded(folded))
  // 副本的 checkbox 与正文原样在(一行不删;"双方差异以两行原文对照为准"的承载方式)
  assert.ok(folded.includes('bannerFace.flexDirection'))
  // 行首名额不因折叠改变形态
  assert.ok(folded.startsWith('- [ ] '))
})

test('端到端纯函数:折一条、留一条持有行,零损失断言全过,幂等闭合,F 维不涨', () => {
  const src = fixture()
  const f = M.applyDriftedMerge(src, '区段头「更多」与箭头', 2, '2026-10-18')
  assert.equal(f.error, undefined)
  assert.equal(f.edits.length, 1)
  assert.equal(f.edits[0].line, 4)
  const v = M.verifyDriftedMerge(src, f.text, f.edits, f.refused, '区段头「更多」与箭头', 2)
  assert.deepEqual(v.problems, [], `断言应全过:${JSON.stringify(v.problems)}`)
  // 行数不变 ∧ 持有行逐字不变 ∧ 无关行逐字不变
  const a = src.split('\n')
  const b = f.text.split('\n')
  assert.equal(a.length, b.length)
  assert.equal(b[1], KEEPER)
  assert.equal(b[5], OTHER)
  // 派单口径:副本行带指针 → 同参复跑报"不足两份"(闭合形态),不是还有可归并对象
  const again = M.applyDriftedMerge(f.text, '区段头「更多」与箭头', 2, '2026-10-18')
  assert.match(again.error, /不足两份/)
})

test('verifyDriftedMerge 的牙:持有行被改 / 注记被篡 / 可逆性破 ⇒ 各自点名拒落', () => {
  const src = fixture()
  const f = M.applyDriftedMerge(src, '区段头「更多」与箭头', 2, '2026-10-18')
  // ① 有人把持有行也改了
  const tamperedKeeper = f.text.split('\n')
  tamperedKeeper[1] = KEEPER + ' (被人追加)'
  const v1 = M.verifyDriftedMerge(src, tamperedKeeper.join('\n'), f.edits, [], '区段头「更多」与箭头', 2)
  assert.ok(v1.problems.some((p) => p.includes('持有行 L2 被本档改动')))
  // ② 产物没带副本指针(把注记抠掉)
  const noPtr = f.text.replace(/（【归并】重复登记副本·漂开归并[^）]*）/, '')
  const v2 = M.verifyDriftedMerge(src, noPtr, f.edits, [], '区段头「更多」与箭头', 2)
  assert.ok(v2.problems.length > 0, '剥掉指针注记必须被判红(不可逆/缺指针两臂至少中一)')
})

test('端到端 CLI(演练仓,脚本连闭包拷入 ⇒ ROOT 解析到演练仓):报告档一行不改;--keeper --commit 落地且幂等', () => {
  const dir = mkScratch('ihui-drift-merge-')
  try {
    const git = (args) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    // 本门的 ROOT 由脚本自身位置推导(§15)⇒ CLI 端到端必须把入口连相对 import 闭包拷进
    // <演练仓>/scripts/,在演练仓里跑 —— 绝不允许拿真仓 ROOT 去落演练夹具,也不允许反过来。
    copyScriptWithClosure(SCRIPTS, 'plan-tasks-merge.mjs', path.join(dir, 'scripts'), [
      'lib/plan-task-index.mjs',
      'lib/scratch-dir.mjs',
    ])
    const node = (args) => {
      const r = spawnSync('node', [path.join(dir, 'scripts', 'plan-tasks-merge.mjs'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return { status: r.status, out: String(r.stdout), err: String(r.stderr), args }
    }
    execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    execFileSync('git', ['config', 'user.name', 't'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    // 最小台账:两条漂开副本
    writeFileSync(`${dir}/PROJECT_PLAN.md`, fixture(), 'utf8')
    execFileSync('git', ['add', 'PROJECT_PLAN.md'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    execFileSync('git', ['commit', '-m', 'init plan'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })

    // ① 报告档:列出两行,一行不改
    const r1 = node(['--merge-drifted', '区段头「更多」与箭头'])
    assert.equal(r1.status, 0, `${r1.out}\n${r1.err}`)
    assert.match(r1.out, /2 份未指针对待办/)
    assert.match(r1.out, /两步确认/)
    const head1 = git(['rev-parse', 'HEAD']).trim()
    assert.equal(git(['show', 'HEAD:PROJECT_PLAN.md']).trim(), fixture().trim(), '报告档不得改面')

    // ② 预演档(--keeper):零损失断言跑过,仍一行不改
    const r2 = node(['--merge-drifted', '区段头「更多」与箭头', '--keeper', '2'])
    assert.equal(r2.status, 0, `${r2.out}\n${r2.err}`)
    assert.match(r2.out, /零损失断言全过/)
    assert.equal(git(['rev-parse', 'HEAD']).trim(), head1)
    assert.equal(git(['show', 'HEAD:PROJECT_PLAN.md']).trim(), fixture().trim(), '预演档不得改面')

    // ③ 落地档:commit-tree 旁路落一枚,副本行带指针,持有行原样
    const r3 = node(['--merge-drifted', '区段头「更多」与箭头', '--keeper', '2', '--commit'])
    assert.equal(
      r3.status,
      0,
      `落地臂退出 ${r3.status};落地前 HEAD blob:\n${git(['show', 'HEAD:PROJECT_PLAN.md'])}\n--- stdout ---\n${r3.out}\n--- stderr ---\n${r3.err}`,
    )
    assert.match(r3.out, /漂开归并落地/)
    const head2 = git(['rev-parse', 'HEAD']).trim()
    assert.notEqual(head2, head1)
    const landed = git(['show', 'HEAD:PROJECT_PLAN.md'])
    assert.match(landed, /【归并】重复登记副本·漂开归并/)
    assert.ok(landed.includes(KEEPER))
    // ④ 复跑幂等:同参再落 → 无可归并对象,HEAD 不再前进
    const r4 = node(['--merge-drifted', '区段头「更多」与箭头', '--keeper', '2', '--commit'])
    assert.match(r4.out, /无可归并对象|不足两份|停手/)
  } finally {
    rmScratch(dir)
  }
})

test('可发现性钉锁(G-952):漂开型"交人工"决策点必须就地指向 --merge-drifted 出口(出口 2026-10-18 已落地,文案不点名 ⇒ 派单器现读会再次误判"没有出口")', () => {
  const src = readFileSync(path.join(SCRIPTS, 'plan-tasks-merge.mjs'), 'utf8')
  const offenders = src
    .split('\n')
    .filter(
      (l) =>
        /(漂开|漂移|折半即有损)[^\n]*交人工/.test(l) &&
        !l.includes('--merge-drifted') &&
        // 出口自己的停手文案不算决策点(引用自身是循环)
        !l.includes('漂开归并档'),
    )
  assert.deepEqual(offenders, [], `这些"漂开⇒交人工"行没点名出口:\n${offenders.join('\n')}`)
  assert.ok(src.includes('出口是 --merge-drifted'), '至少一处决策点必须点名出口')
})

// ─── G-952 收口(2026-10-23):可发现性扫描档 + 三维守恒闸 ───────────────────────
// 票面要的是"无编号 P1 视觉票的漂开副本有合法出口"。出口 2026-10-18 就装车了,缺的是两格:
//  ① 报名档按 composite 键取组 ⇒ 无编号行整族隐身,没人拿得到锚点(判据在,可发现性不在);
//  ② 折叠是整行改写,而 AGENTS §1 那三维守恒(勾选态 ∧ 租约 ∧ 归属桶)此前只有口头保证。
// 下面每一例都带**正向对照**,免得判据靠"夹具恰好不命中"假绿。
import { dispositionOf, titleOf } from '../lib/plan-task-index.mjs'

const DK1 = '- [ ] P1 **宫格卡片区高度塌陷**:甲份正文,长度足够,写明复现步骤与已修一半。'
const DK2 = '- [ ] P1 **宫格卡片区高度塌陷**:乙份正文,与甲份同题面而逐字不等,是漂开副本。'
const VERB1 = '- [ ] P1 **广场首屏直接进错误态**:两份逐字节相同,那一族归 --fold-identical-open-rows。'
const KEYED1 = '- [ ] G-901 **同主键漂移**:第一段正文,长度足够越过噪声阈以便证明它不是被长度筛掉的。'
const KEYED2 = '- [ ] G-901 **同主键漂移**:第二段正文,有编号 ⇒ 归 dupOpen 报名,不归无编号扫描档。'
const LEASED_ROW = '- [ ] P1 **宫格卡片区高度塌陷**（进行中@2026-10-23/别席）:在飞的现场,一份不碰。'
/** 守恒闸的正反两控:副本行散文里带"在等:…" ⇒ 折前 waiting-env;那条机器注记会把等待句
 *  挤成主键区装饰 ⇒ 折后读成 actionable(真仓 HEAD 现读 L28865 同型)。守恒闸必须拒写。 */
const WAIT_KEEPER = '- [ ] P1-③ **批量对齐**:持有行正文,写明已修一半,剩真机复验。'
const WAIT_COPY =
  '- [ ] P1-③ **批量对齐(在等:P0-① 触发面先攒出一轮真实分叉样本)**:副本正文,与持有行同题而正文漂开。'

function keylessFixture() {
  return [
    '',
    DK1,
    DK2,
    VERB1,
    VERB1,
    KEYED1,
    KEYED2,
    LEASED_ROW,
    WAIT_KEEPER,
    WAIT_COPY,
    '',
  ].join('\n')
}

test('夹具前提成锁:扫描档要判的那几行必须真的无编号、且副本行折前确实是 waiting-env(前提塌了测试就是空转)', () => {
  assert.equal(dispositionOf(WAIT_COPY), 'waiting-env')
  assert.equal(dispositionOf(WAIT_KEEPER), 'actionable')
  assert.match(M.findDriftedFamilies([DK1, DK2], '宫格卡片区高度塌陷').rows[0].raw, /^- \[ \] P1 /)
})

test('driftRowAdmission 是单源入场判据:四态各自退场/放行,且锚点档与扫描档共用这一份', () => {
  assert.equal(M.driftRowAdmission(DK2), null)
  assert.equal(M.driftRowAdmission(DK2 + ' 〔【归并】重复登记副本(x):派单以那条为准〕'), 'pointer')
  // 本档产物同时命中 pointer 臂(注记字面里就含 DUP_POINTER_RE 那一句)—— 退场结论一致,
  // 刻意不把"必须落到 folded 臂"当断言:那是把实现顺序当契约,而契约是"产物不再进族"。
  assert.notEqual(M.driftRowAdmission(M.buildDriftFold(DK2, '持有行题面', '2026-10-23')), null)
  assert.equal(M.driftRowAdmission(LEASED_ROW), 'leased')
  const src = readFileSync(path.join(SCRIPTS, 'plan-tasks-merge.mjs'), 'utf8')
  // 两处取组都必须问这一份判据(自己再写一遍 DUP_POINTER/LEASE 就是第二把尺子,§0.6)
  const users = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .filter((l) => l.includes('driftRowAdmission('))
  assert.ok(users.length >= 3, `行级入场判据的定义 + 使用点 <3:${users.join(' | ')}`)
})

test('findKeylessDriftedFamilies:只吃"无编号 ∧ 族内正文互不等"那一格,与两条既有尺子不重叠', () => {
  const s = M.findKeylessDriftedFamilies(keylessFixture())
  assert.equal(s.error, undefined)
  assert.equal(s.scannedRows, 7, '无编号未勾行:DK1/DK2/VERB1×2/LEASED/WAIT×2(KEYED 有编号不算)')
  const anchors = s.families.map((f) => f.anchor)
  assert.ok(anchors.includes('P1宫格卡片区高度塌陷'), '真漂开族必须报名')
  assert.ok(!anchors.includes('P1广场首屏直接进错误态'), '逐字相同那一族归 --fold-identical-open-rows')
  assert.ok(!anchors.includes('G-901#同主键漂移'), '有编号那一族归 dupOpen,两把尺子不得重叠记账')
  assert.equal(s.skippedLeased.length, 1, '带认领牌必须逐条点名退场(G-761 第⑥维)')
  // 锚点可直接回填 --merge-drifted(titleOf 的产物就是它的合法锚点)
  const fam = s.families.find((f) => f.anchor === 'P1宫格卡片区高度塌陷')
  assert.deepEqual(fam.lines, [2, 3])
  assert.equal(fam.overCap, false)
})

test('扫描档的牙:族内 >DRIFT_GROUP_MAX 标 overCap(不猜同题);未判定三态不记绿也不冒红', () => {
  const many = ['', ...Array.from({ length: M.DRIFT_GROUP_MAX + 1 }, (_, i) => `- [ ] P1 **超上限族**:第 ${i} 份正文,各不相同。`)].join('\n')
  const s = M.findKeylessDriftedFamilies(many)
  assert.equal(s.families.length, 1)
  assert.equal(s.families[0].overCap, true)
  // 三条未判定臂:非字符串 / 空文本 / 档内枚举不到登记行
  assert.match(M.findKeylessDriftedFamilies(undefined).error, /未判定/)
  assert.match(M.findKeylessDriftedFamilies('   \n').error, /未判定/)
  assert.match(M.findKeylessDriftedFamilies('- 这里没有一行登记行\n').error, /未判定/)
  // 未判定时结论行必须写「未判定」,不得退化成"0 族"(那读起来就是"这一型已清完")
  const note = M.keylessDriftedNote(M.findKeylessDriftedFamilies('   \n'))
  assert.match(note, /未判定/)
  assert.ok(!/0 族/.test(note), `未判定被洗成计数就是记绿:${note}`)
})

test('三维守恒闸:归属桶会漂的那一折**拒写**(不是照样折),正控那一折照旧放行', () => {
  // 反控:机器注记把 waiting-env 洗成 actionable ⇒ 必须点名拒
  const bad = M.buildDriftFold(WAIT_COPY, titleOf(WAIT_KEEPER), '2026-10-23')
  assert.ok(bad)
  assert.equal(dispositionOf(bad), 'actionable', '夹具前提:这一折确实改了归属桶')
  assert.match(
    M.driftedFoldRejectReason(WAIT_COPY, bad),
    /三维守恒未过[\s\S]*waiting-env → actionable/,
    '守恒闸必须把漂的那一维点名出来',
  )
  // 正控:桶不变的普通漂开副本照样能折
  const ok = M.buildDriftFold(DK2, titleOf(DK1), '2026-10-23')
  assert.equal(M.driftedFoldRejectReason(DK2, ok), null)
  // applyDriftedMerge 层:守恒不过的那行进 refused,一行都不许进 edits
  const fam = M.applyDriftedMerge(keylessFixture(), '批量对齐', 9, '2026-10-23')
  assert.equal(fam.error, undefined)
  assert.equal(fam.edits.length, 0, '会改判据输入的一折必须整条拒写')
  assert.equal(fam.refused.length, 1)
  assert.match(fam.refused[0].reason, /三维守恒未过/)
  // 落地闸重复量一遍(不许由上游口头代证):把被拒的那一折**硬塞进落地面**,断言必须点名守恒
  const forcedLines = fam.text.split('\n')
  forcedLines[9] = bad
  const forced = M.verifyDriftedMerge(
    keylessFixture(),
    forcedLines.join('\n'),
    [{ line: 10, before: WAIT_COPY, after: bad }],
    [],
    '批量对齐',
    9,
  )
  assert.ok(
    forced.problems.some((p) => p.includes('三维守恒未过')),
    `落地闸必须自己再证一次守恒:${JSON.stringify(forced.problems).slice(0, 300)}`,
  )
})

test('装车形状锁:归并器 import 单源守恒件,且两个只读报名站点都打印④族(缺一即"判据在而没人看得见")', () => {
  const src = readFileSync(path.join(SCRIPTS, 'plan-tasks-merge.mjs'), 'utf8')
  assert.match(
    src,
    /import\s*\{\s*assertRowRewriteConservation\s*\}\s*from\s*'\.\/lib\/plan-row-conservation\.mjs'/,
    '三维守恒必须 import 单源件,不得在归并器里复算(§0.6)',
  )
  const live = (re) =>
    src
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          !l.startsWith('*') && !l.startsWith('//') && !l.startsWith('/*') && re.test(l),
      )
  // 两处站点必须**各有一行真打印**(注释掉的调用不算接线,§0.9:造好没装车 = 没有)
  assert.equal(live(/^console\.log\(keylessDriftedNote\(/).length, 1, '默认预演档的④族打印不在位')
  assert.equal(
    live(/^console\.log\(`\s*\$\{refO\.keylessNote\}`\)/).length,
    1,
    '未勾单行副本档必须打的是**同一份**读数(取 refO,不再扫第二遍)',
  )
  assert.equal(live(/^export function keylessDriftedNote\(/).length, 1, '报名文案只许有一份实现')
})

test('端到端只读预演(演练仓):④族与可回填锚点在默认档与 --fold-identical-open-rows 都报出,面一行不动', () => {
  const dir = mkScratch('ihui-drift-scan-')
  try {
    const git = (args) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    copyScriptWithClosure(SCRIPTS, 'plan-tasks-merge.mjs', path.join(dir, 'scripts'), [
      'lib/plan-task-index.mjs',
      'lib/plan-row-conservation.mjs',
      'lib/scratch-dir.mjs',
    ])
    const node = (args) => {
      const r = spawnSync('node', [path.join(dir, 'scripts', 'plan-tasks-merge.mjs'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      return { status: r.status, out: String(r.stdout), err: String(r.stderr) }
    }
    execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    for (const [k, v] of [
      ['user.email', 't@t'],
      ['user.name', 't'],
      ['commit.gpgsign', 'false'],
    ])
      execFileSync('git', ['config', k, v], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    writeFileSync(`${dir}/PROJECT_PLAN.md`, keylessFixture(), 'utf8')
    execFileSync('git', ['add', 'PROJECT_PLAN.md'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    execFileSync('git', ['commit', '-m', 'init plan'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const before = git(['rev-parse', 'HEAD']).trim()

    for (const args of [[], ['--fold-identical-open-rows'], ['--dedupe-open-rows']]) {
      const r = node(args)
      assert.equal(r.status, 0, `${r.out}\n${r.err}`)
      assert.match(r.out, /④ 无编号漂开候选族\(G-952 扫描档\):2 族 \/ 4 行/, `${args.join(' ')} 未报出扫描族`)
      assert.match(r.out, /--merge-drifted "P1宫格卡片区高度塌陷"/, '必须给出可直接回填的锚点')
      assert.match(r.out, /带认领牌跳过 1 行/)
    }
    // 只读预演:HEAD 与面一个字都不许动
    assert.equal(git(['rev-parse', 'HEAD']).trim(), before)
    assert.equal(git(['show', 'HEAD:PROJECT_PLAN.md']), keylessFixture())
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
