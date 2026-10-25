// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:`--declare-side-loss` 这条逐行具名放行出口(2026-10-25 立)。
 *
 * 判据一律 import 源模块(§22c:在测试里再抄一份"什么算少带"两边必漂移)。
 * 四条必须同时成立,少一条都等于没修:
 *   A. 判据仍有牙 —— 不声明时"丢对侧独有行"照旧进 bad(阳性对照:出口不是默认动作);
 *   B. 出口真能收 —— 声明命中那一行才销账,且 `lossCredits` 逐行带原因留痕;
 *   C. 出口不是免死金牌 —— 只销声明的那一行(别的路径仍须全在),声明未命中本轮判红行 ⇒ 进 bad;
 *   D. 锁"旗 ↔ 出路":CLI 认这面旗,声明档读不到 ⇒ exit 2 点名,绝不当成"没有声明"。
 *
 * 立因(现读):两侧把**同一个 JSX 元素**改成互斥写法时(对侧把硬编码 `'收起'` 按 prettier 收成单行,
 * 本侧同元素已 i18n 化成 `t('chat.msg.collapse')` 拆成三行),`--resolve` 的零损失锁结构上无解,
 * 而 `--take-ours` 会连对侧其余 34 行独有内容一起丢 ⇒ 整枚合并卡死。缺的是可追责的出口,不是判断。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = resolveGitBin() || 'git'

/**
 * 夹具:一个仓库、两枚分支,`clash.ts` 中间那一行两侧各改成一种写法(互斥,不能同时在场)。
 * 与本仓真形同构:本侧三行 i18n 形,对侧单行硬编码形。
 */
function fixtureRepo() {
  const dir = mkScratch('union-dsl-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@example.com')
  run('config', 'user.name', 't')
  const put = (text) => {
    writeFileSync(join(dir, 'clash.ts'), text, 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '- [ ] **G-900 与本判据无关的一行标题** —— 现状\n', 'utf8')
  }
  put('x1\nx2\nx3\n')
  run('add', '.')
  run('commit', '-qm', 'base')
  run('branch', 'base')
  put('x1\nOURS-多行\n改写形态\nx3\n')
  run('commit', '-qam', 'ours')
  const ours = run('rev-parse', 'HEAD').trim()
  run('checkout', '-q', 'base')
  put("x1\nx2 ? '收起' : '展开'\nx3\n")
  run('commit', '-qam', 'theirs')
  const theirs = run('rev-parse', 'HEAD').trim()
  run('checkout', '-q', 'main')
  return { dir, run, ours, theirs, put }
}

/** 用同一份人工判定内容(取本侧写法)跑一次合并;decl 为 `--declare-side-loss` 的等价 Map。 */
function mergeWithResolve(f, decl) {
  const resolveFile = join(f.dir, '.resolve-clash.txt')
  writeFileSync(resolveFile, 'x1\nOURS-多行\n改写形态\nx3\n', 'utf8')
  return U.plan(
    f.ours,
    f.theirs,
    f.dir,
    new Set(),
    new Map([['clash.ts', resolveFile]]),
    new Set(),
    null,
    null,
    null,
    null,
    decl ?? null,
  )
}

const WHY = '两侧把同一元素改成互斥写法,本侧 i18n 版为当下状态;同时保留即双份标签/死代码塞行'

test('A 阳性对照:不声明时"丢对侧独有行"照旧进 bad(出口不得是默认动作)', () => {
  const f = fixtureRepo()
  try {
    const p = mergeWithResolve(f)
    assert.ok(
      p.bad.some((b) => b.includes('clash.ts') && /对侧独有行/.test(b)),
      `不声明必须判红,实得 bad=${JSON.stringify(p.bad.slice(0, 3))}`,
    )
    assert.equal(p.lossCredits.length, 0, '没声明却产生放行留痕 ⇒ 放行不是从声明来的')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('B 出口真能收:声明命中那一行才销账,且逐行带原因留痕', () => {
  const f = fixtureRepo()
  try {
    const decl = new Map([
      ['clash.ts', new Map([["x2 ? '收起' : '展开'", { why: WHY }]])],
    ])
    const p = mergeWithResolve(f, decl)
    assert.ok(
      !p.bad.some((b) => b.includes('clash.ts') && /对侧独有行/.test(b)),
      `声明命中后那一行不该再判红,实得 bad=${JSON.stringify(p.bad.slice(0, 3))}`,
    )
    assert.equal(p.lossCredits.length, 1, `放行的每一行必须留痕,实得 ${p.lossCredits.length}`)
    assert.equal(p.lossCredits[0].line, "x2 ? '收起' : '展开'")
    assert.ok(p.lossCredits[0].why.length >= 10, '留痕必须带着原因原文')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C 反向锁:声明未命中本轮判红行 ⇒ 进 bad 点名,不记成"这轮真放过东西"', () => {
  const f = fixtureRepo()
  try {
    const decl = new Map([['clash.ts', new Map([['GHOST-本轮没有这一行', { why: WHY }]])]])
    const p = mergeWithResolve(f, decl)
    assert.ok(
      p.bad.some((b) => b.includes('--declare-side-loss 声明未命中') && b.includes('GHOST-本轮没有这一行')),
      `陈旧清单必须点名,实得 bad=${JSON.stringify(p.bad.slice(0, 3))}`,
    )
    assert.equal(p.lossCredits.length, 0, '未命中的声明不得记成放行')
    // 同一条合并里"真丢的对侧独有行"仍须判红(陈旧声明不能顺手把真丢失一起抹掉)
    assert.ok(
      p.bad.some((b) => b.includes('clash.ts') && /对侧独有行/.test(b)),
      `真丢失照旧判红,实得 bad=${JSON.stringify(p.bad.slice(0, 3))}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C2 形状锁:放行只销声明的那一行,判据实现仍住在一个出口里', () => {
  const src = U.sideLossEntryProblem
  assert.equal(typeof src, 'function', '__test__ 必须把门槛判据交出来(镜像测试不得另写一份)')
  assert.equal(src({ line: '', why: '够长的理由够长的理由' }) !== null, true, '缺 line 必须拒')
  assert.notEqual(src({ line: 'L', why: '太短' }), null, '原因不足 10 字必须拒')
  assert.equal(src({ line: 'L', why: '两侧同一元素互斥改写,信息无损失' }), null, '合格项必须放行')
})

test('D 旗 ↔ 出路:CLI 认 --declare-side-loss,声明档读不到 ⇒ exit 2 点名', () => {
  const out = spawnSync(
    process.execPath,
    ['scripts/union-converge.mjs', '--declare-side-loss', 'clash.ts=./不存在-的-声明档.json'],
    {
      cwd: join(import.meta.dirname, '..', '..'),
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
    },
  )
  const text = `${out.stdout || ''}${out.stderr || ''}`
  assert.equal(out.status, 2, `取不到输入必须 exit 2(§0.3),实得 status=${out.status}\n${text.slice(0, 400)}`)
  assert.match(text, /读不到或解不开声明档/, `要点名是哪个声明档:\n${text.slice(0, 400)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
