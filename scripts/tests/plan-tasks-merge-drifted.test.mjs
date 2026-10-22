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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
