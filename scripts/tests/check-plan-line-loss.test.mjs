// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(AGENTS.md §22c/§22d):判据一律 import 源文件导出的符号,不得在此复制实现。
// 重点是 §1「端到端装车证明」—— 用独立临时真仓复现 2026-09-24 的 `## O42` 整节标题被旧基线
// 写回的事故形态,要求守门**本身**(不是被测函数)exit 1 并点名该标题。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 源脚本今日两种导出形态都成立:HEAD 仍导出 __test__,并行会话在制版已改成逐个具名导出。
// 取 `__test__ ?? 模块命名空间`,同一批符号在此后两种形态下都能拿到 —— 断言强度一条不降,
// 也让"删掉镜像测试"失去唯一理由(测试不会因源侧重命名而失效)。
import * as PLAN_LOSS_SRC from '../check-plan-line-loss.mjs'
const G = PLAN_LOSS_SRC.__test__ ?? PLAN_LOSS_SRC

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-plan-line-loss.mjs')
const GIT = 'git'
const git = (dir, ...args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60000,
  })

// 真仓 HEAD 里那条**实际被抹掉**的标题原文,连同同节两条同编号 bullet —— 事故形态照原样搬。
const HEADING =
  '## O42 台账也不能撒谎 —— 门 89 新增 R7「豁免依据必须可核验」，并当场抓到一条已入库的假依据(2026-09-24 立并完成 ✅)'
const SIBLING_BOLD =
  '- **O42 残余(不写作收口)**:① R7 只核结构事实,自然语言真伪仍无人核 —— 台账 13 条里 8 条是本次新增且每条都带实测依据。'
const SIBLING_CB =
  '- [x] ✅(2026-09-24) **O42③ 第三处残留**:仓库里根本没有源的那一份,"grep 跟踪文件"这条取证路径自身有盲区。'
const OTHER =
  '- **G-900 无关登记行**:这一条与标题族判据无关,用来确认收紧没有连带波及既有 bullet 判据。'
const V1 = ['# 计划', '', HEADING, '', SIBLING_BOLD, SIBLING_CB, '', '### 另一节', OTHER, ''].join('\n')
// "旧基线整文件写回":同节正文与无关行都在,只有条目标题那一行没了
const STALE = V1.split('\n')
  .filter((l) => l !== HEADING)
  .join('\n')

function tempPlanRepo(planText) {
  const dir = mkScratch('ihui-gate71-')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 守门脚本按自身位置推导 ROOT,故必须把**当前工作区这一版**复制进临时仓才算真装车
  copyFileSync(SCRIPT, join(dir, 'scripts', 'check-plan-line-loss.mjs'))
  git(dir, 'init', '-b', 'main')
  git(dir, 'config', 'user.email', 't@t.local')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  git(dir, 'add', 'PROJECT_PLAN.md', 'scripts/check-plan-line-loss.mjs')
  git(dir, 'commit', '-m', 'init plan')
  return dir
}

const runGate = (dir, args) =>
  spawnSync(process.execPath, [join(dir, 'scripts', 'check-plan-line-loss.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })

test('§22c 装车证明:判据符号必须来自源文件导出(__test__ 或具名导出皆可),测试内不得复制实现', () => {
  for (const fn of [
    'markerOf',
    'headIdSet',
    'headingIdSet',
    'registrationOf',
    'lostMarkers',
    'dropArchivedLost',
    'headingLosses',
    'healContent',
  ])
    assert.equal(typeof G[fn], 'function', `源导出缺判据 ${fn}(§22c 锚点漂移,或该判据被整块删掉)`)
})

test('§22c 装车证明:guardian-runner 里本门仍注册为 blocking 且由 PROJECT_PLAN.md 触发', () => {
  const src = readFileSync(fileURLToPath(new URL('../guardian-runner.mjs', import.meta.url)), 'utf8')
  const at = src.indexOf("script: 'check-plan-line-loss.mjs'")
  assert.ok(at > -1, 'runner 里找不到本门的注册块(门被整文件回写挤掉了)')
  const block = src.slice(src.lastIndexOf('{', at), src.indexOf('},', at))
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /stagedTriggers:\s*\[\s*'PROJECT_PLAN\.md'\s*\]/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_PLAN_LINE_LOSS'/)
})

test('判据:同节仍有同编号 bullet 时,删标题必须判红(旧判据在此处 0 报 = 事故盲区)', () => {
  assert.ok(G.headIdSet(STALE).has('O42'), '前提:编号仍被同节 bullet 顶着头(旧判据判活的原因)')
  assert.ok(!G.headingIdSet(STALE).has('O42'), '但候选里已没有任何一行标题以 O42 开头')
  const lost = G.lostMarkers(V1, STALE)
  assert.equal(lost.length, 1)
  assert.equal(lost[0].id, 'O42')
  assert.equal(lost[0].shape, 'heading')
  assert.deepEqual(G.headingLosses(lost).map((x) => x.id), ['O42'])
})

test('判据:只改写标题文案 / ## 降级 ### 而保留编号 ⇒ 不报(不误伤正常编辑)', () => {
  const reworded = V1.replace(HEADING, '## O42 台账不能撒谎,这一版把依据核验的判据说明重写了一遍,仍然足够长')
  const demoted = V1.replace(HEADING, HEADING.replace(/^## /, '### '))
  assert.deepEqual(G.lostMarkers(V1, reworded), [])
  assert.deepEqual(G.lostMarkers(V1, demoted), [])
})

test('豁免:标题原文能在 archive 里找到 ⇒ 不算丢(§1 归档 = 正当移除)', () => {
  const lost = G.lostMarkers(V1, STALE)
  const fakeArchive = (m) => (m.startsWith('O42 台账') ? 'PROJECT_PLAN_2026-09-24.md' : null)
  assert.equal(G.dropArchivedLost(lost, () => null).length, 1)
  assert.equal(G.dropArchivedLost(lost, fakeArchive).length, 0)
})

test('回归:bullet 两族判活路由未被标题族收紧波及', () => {
  const noBold = V1.split('\n').filter((l) => l !== SIBLING_BOLD).join('\n')
  const lost = G.lostMarkers(V1, noBold)
  assert.equal(lost.length, 1)
  assert.equal(lost[0].shape, 'bold')
  assert.equal(lost[0].id, null)
})

test('自愈能力边界:标题级条目只回插一行,且二次调用不重复插', () => {
  const reg = G.registrationOf(HEADING)
  const entry = { line: HEADING, marker: reg.marker, id: reg.id, shape: reg.shape, prev: null }
  const first = G.healContent(STALE, [entry])
  const second = G.healContent(first.out, [entry])
  assert.equal(first.inserted + first.appended, 1)
  assert.equal(second.inserted, 0)
  assert.equal(second.appended, 0)
  // 回插只补回标题这一行:整节层级(其下正文的从属关系)不在自愈能力内
  assert.ok(!first.out.includes(SIBLING_BOLD + '\n' + HEADING))
})

test('端到端(事故复现):旧基线写回抹掉条目标题 → 守门 exit 1 且点名 O42', () => {
  const dir = tempPlanRepo(V1)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    const r = runGate(dir, ['--staged'])
    assert.equal(r.status, 1, `应 exit 1,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /条目标题 O42/)
    assert.match(r.stderr, /标题级丢失 1 处,条目号:O42/)
    assert.match(r.stderr, /需人工归并/)
  } finally {
    rmScratch(dir)
  }
})

test('端到端(反向对照):补回标题 → 守门 exit 0', () => {
  const dir = tempPlanRepo(V1)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    assert.equal(runGate(dir, ['--staged']).status, 1, '前提:未补回时必须红')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), V1, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    const ok = runGate(dir, ['--staged'])
    assert.equal(ok.status, 0, `补回后应 exit 0,实际 ${ok.status}\nstderr:${ok.stderr}`)
    assert.match(ok.stdout, /无登记行丢失/)
  } finally {
    rmScratch(dir)
  }
})

test('端到端(不误伤):只改写标题文案的提交 → exit 0', () => {
  const dir = tempPlanRepo(V1)
  try {
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      V1.replace(HEADING, '## O42 台账不能撒谎,重写了一遍依据核验判据的说明文字,仍然足够长以入选'),
      'utf8',
    )
    git(dir, 'add', 'PROJECT_PLAN.md')
    const r = runGate(dir, ['--staged'])
    assert.equal(r.status, 0, `改写文案不该红,实际 ${r.status}\nstderr:${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

test('端到端(--heal 能力边界):只回插标题行,并如实声明层级需人工归并', () => {
  const dir = tempPlanRepo(V1)
  try {
    // HEAD 有标题、工作区是旧基线(未提交)—— 正是 --heal 的适用场景,只写工作区不建提交
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
    const r = runGate(dir, ['--heal'])
    assert.equal(r.status, 0, `--heal 应 exit 0,实际 ${r.status}\nstderr:${r.stderr}`)
    // 边界声明走 console.warn ⇒ stderr,断言按合并输出判,别把通道写死成 stdout
    const out = `${r.stdout}\n${r.stderr}`
    assert.match(out, /标题级丢失需人工归并/)
    assert.match(out, /O42/)
    const healed = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(healed.includes(HEADING), '标题行必须被回插')
    // 能力边界的实证:回插只补回那一行,整节正文并没有被"重建"
    assert.equal(healed.split('\n').filter((l) => l === HEADING).length, 1)
    const again = runGate(dir, ['--heal'])
    assert.match(`${again.stdout}\n${again.stderr}`, /无缺失,无需回捞/, '二次 --heal 必须幂等')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
