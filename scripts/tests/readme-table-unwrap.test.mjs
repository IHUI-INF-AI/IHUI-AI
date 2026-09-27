// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// README 表格完整性守门的修复出口(readme-table-unwrap.mjs)的 §22c 镜像测试。
//
// 这把尺子的要害是"零内容损失自证" —— 归并动作本身做错不会被 typecheck 或任何别的门发现,
// 只会在很久以后表现为"README 里那句话少了半截"。所以反向锁必须钉两件事:
//  ① 判据**认得出**被吃掉的内容(故意删一块 ⇒ 判 false);
//  ② CLI 的写盘分支**真的在 writeFileSync 之前问过它**(源码级锁 —— 分支不接线,判据再对也没用,
//     守门 128"具名档写进了函数但调用点没传参"那一课)。
// 端到端 apply 只碰临时夹具文件,绝不 --apply 真 README(那是主会话决定时机的事)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as unwrap } from '../readme-table-unwrap.mjs'
import { __test__ as gate } from '../check-readme-table-integrity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOL = join(REPO, 'scripts', 'readme-table-unwrap.mjs')
const { planUnwrap, assertNoLoss, writeAllowed } = unwrap
const F = gate.FIXTURES

test('W1 机械归并正确且幂等:run 拼回宿主末格后,再跑一次必须零改动', () => {
  const plan = planUnwrap(F.taRun + '\n')
  assert.equal(plan.edits.length, 1)
  assert.equal(plan.tbRows, 0)
  const host = plan.newText.split('\n')[2]
  assert.ok(host.includes('这一格的前半被竖排出来了,') && host.includes('后半继续另起一行'), '两截内容没逐字并进宿主末格')
  assert.equal(plan.lossOk, true, '自然路径的零损失自证必须成立(不成立=归并逻辑自己在吃字)')
  const again = planUnwrap(plan.newText)
  assert.equal(again.changed, false, '同一输入第二趟必须报"已归位"')
  const { taRows } = gate.auditText(plan.newText)
  assert.equal(taRows, 0, '归并结果不得仍被门判红(出口与判据必须闭合)')
})

test('W2 零损失判据有牙:删一块内容 ⇒ assertNoLoss 必须 false,写盘闸门必须拒绝', () => {
  const plan = planUnwrap(F.taRun + '\n')
  const tampered = plan.newText.replace('后半继续另起一行', '')
  assert.equal(assertNoLoss(F.taRun + '\n', tampered).ok, false, '被吃掉的内容没被抓出来 = 判据恒真')
  assert.equal(assertNoLoss(F.taRun + '\n', plan.newText).ok, true, '正向对照:同样的尺子必须放过头一遍真归并')
  assert.equal(writeAllowed({ changed: true, lossOk: false }, true), false)
  assert.equal(writeAllowed({ changed: true, lossOk: true }, false), false, '--dry-run 绝不允许写盘')
  assert.equal(writeAllowed({ changed: true, lossOk: true }, true), true)
})

test('W3 源码级反向锁:apply 分支必须在 writeFileSync 之前先过 lossOk / changed 两道闸', () => {
  const src = readFileSync(TOOL, 'utf8')
  const guardIdx = src.indexOf('if (!plan.lossOk)')
  const writeIdx = src.indexOf('writeFileSync(abs')
  assert.ok(guardIdx >= 0, 'apply 路径里没有 lossOk 闸门 —— 反向锁判据退化成孤儿函数')
  assert.ok(guardIdx < writeIdx, '闸门在写盘之后才问 = 问了也白问(先落盘再喊话就是把红留给文件系统)')
})

test('W4 T-B 与孤立续行一律不动,只如实计数', () => {
  const plan = planUnwrap(F.tbOnly + '\n')
  assert.equal(plan.changed, false)
  assert.equal(plan.tbRows, 1)
  const lone = planUnwrap(F.loneP2 + '\n')
  assert.equal(lone.changed, false)
  assert.equal(lone.loneRows, 1)
})

test('W5 两种"交人工"拒绝:run 无宿主行、涉及转义竖线,都不许机械猜', () => {
  const noHost = ['| 段一 |', '| 段二 |', '| a | b | c | d |', '| - | - | - | - |', '| x | y | z | w |'].join('\n')
  const p1 = planUnwrap(noHost + '\n')
  assert.equal(p1.edits.length, 0)
  assert.equal(p1.skipped.length, 1, '簇首 run 没有宿主行,归并目标不可判 —— 必须点名交人工')
  assert.match(p1.skipped[0].reason, /无宿主行/)
  // 归并器拒无宿主,但门**必须**仍判它红(能判不能修,不等于可以看不见)
  assert.ok(gate.auditText(noHost + '\n').taRows === 2, '门对无宿主 run 失明 = 把"修不了"洗成"没违规"')
  const esc = ['| a | b | c | d |', '| - | - | - | - |', '| 1 | 2 | 3 | 4 |', '| x \\| y |', '| 普通续行 |'].join('\n')
  const p2 = planUnwrap(esc + '\n')
  assert.equal(p2.edits.length, 0)
  assert.match(p2.skipped[0].reason, /转义竖线/)
})

test('W6 端到端 --apply 只碰临时夹具:写盘后归位、再跑报幂等;豁免 run 不动', () => {
  const dir = mkdtempSync(join(REPO, '.ihui-agent', 'tmp', 'unwrap-e2e-'))
  try {
    const f = join(dir, 'T.md')
    writeFileSync(f, F.taLong + '\n', { encoding: 'utf8' })
    const run = (args) =>
      execFileSync(process.execPath, [TOOL, ...args], {
        encoding: 'utf8',
        cwd: REPO,
        windowsHide: true,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    const first = run(['--file', f, '--apply'])
    assert.match(first, /已归并 1 处/)
    assert.equal(gate.auditText(readFileSync(f, 'utf8')).taRows, 0)
    const second = run(['--file', f, '--apply'])
    assert.match(second, /已归位/, '第二趟必须零改动(幂等)')
    // 豁免 run:出口与门同判"不碰",但出口要报豁免数而不是当没看见
    const exFile = join(dir, 'E.md')
    writeFileSync(exFile, F.exemptHost + '\n', { encoding: 'utf8' })
    const exOut = run(['--file', exFile, '--dry-run'])
    assert.match(exOut, /豁免 run 1/)
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

test('W7 判据只有一份:unwrap 必须 import 门自身的导出,不得自带第二份分箱实现', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /from '\.\/check-readme-table-integrity\.mjs'/, '修复出口与守门各写一遍分箱必然漂移(§"两处实现必漂移"最多次记过的失败型)')
  assert.ok(!/function classifyCluster\(/.test(src), 'unwrap 里不得再出现本地 classifyCluster 实现')
  assert.ok(!/function maskMarkdownStructure\(/.test(src), 'unwrap 里不得再出现本地遮罩实现')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
