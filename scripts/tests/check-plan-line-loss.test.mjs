// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(AGENTS.md §22c/§22d):判据一律 import 源文件导出的符号,不得在此复制实现。
// 重点是 §1「端到端装车证明」—— 用独立临时真仓复现 2026-09-24 的 `## O42` 整节标题被旧基线
// 写回的事故形态,要求守门**本身**(不是被测函数)exit 1 并点名该标题。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 源脚本今日两种导出形态都成立:HEAD 仍导出 __test__,并行会话在制版已改成逐个具名导出。
// 取 `__test__ ?? 模块命名空间`,同一批符号在此后两种形态下都能拿到 —— 断言强度一条不降,
// 也让"删掉镜像测试"失去唯一理由(测试不会因源侧重命名而失效)。
import * as PLAN_LOSS_SRC from '../check-plan-line-loss.mjs'
const G = PLAN_LOSS_SRC.__test__ ?? PLAN_LOSS_SRC

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根(测试文件在 `<root>/scripts/tests/` 下 ⇒ 上溯两级;闭包里的路径一律以仓库根为基准) */
const REPO = join(HERE, '..', '..')
const SCRIPT_REL = 'scripts/check-plan-line-loss.mjs'
const GIT = 'git'
const git = (dir, ...args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60000,
  })

/**
 * 端到端夹具的装车面:复制**整条相对 import 闭包**,不是只复制入口那一个文件。
 *
 * 起因(实测,不是假想):守门 71 的内容面在 2026-09-25 迁到 `./lib/face-reader.mjs` 之后,
 * 旧的 `copyFileSync(SCRIPT, …)` 只搬入口,于是夹具里 `ERR_MODULE_NOT_FOUND`,
 * **14 例端到端用例当场红 5 例而无人发现** —— 提交链不跑 `node --test`,而 `import` 判据符号的
 * 那 9 例纯函数用例照样绿,绿灯就把红的范围遮住了。判据搬家一次,夹具就得跟着搬一次。
 */
function localImportSpecs(src) {
  return [...src.matchAll(/(?:^|\n)\s*import[^'"]*from\s*['"](\.\.?\/[^'"]+)['"]/g)].map((m) => m[1])
}

function copyGateClosure(dir) {
  const queue = [SCRIPT_REL]
  const copied = new Set()
  while (queue.length) {
    const rel = queue.shift()
    if (copied.has(rel)) continue
    copied.add(rel)
    const text = readFileSync(join(REPO, rel), 'utf8')
    const dst = join(dir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    writeFileSync(dst, text, 'utf8')
    for (const spec of localImportSpecs(text)) {
      queue.push(join(dirname(rel), spec).split(/[\\/]+/).join('/'))
    }
  }
  return [...copied]
}

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
  // 守门脚本按自身位置推导 ROOT,故必须把**当前工作区这一版**(连同它的相对 import 闭包)
  // 复制进临时仓才算真装车 —— 只搬入口会让夹具 ERR_MODULE_NOT_FOUND(见 copyGateClosure 头注)。
  const files = copyGateClosure(dir)
  git(dir, 'init', '-b', 'main')
  git(dir, 'config', 'user.email', 't@t.local')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  git(dir, 'add', 'PROJECT_PLAN.md', ...files)
  git(dir, 'commit', '-m', 'init plan')
  return dir
}

const runGate = (dir, args) =>
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  spawnSync(process.execPath, [join(dir, 'scripts', 'check-plan-line-loss.mjs'), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
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
    // 取材面三件套(2026-09-26 收口):选面、人工档提示、总入口、历史面基线
    'pickPlanContent',
    'faceNoticeFor',
    'runCheck',
    'historyMarkers',
    // 编号形态维(G-722):按面选基准的编排出口
    'malformedReport',
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

test('端到端夹具的装车面:闭包必须覆盖相对 import,复制后的每个文件都真在夹具里', () => {
  // 这一例是「夹具自己会不会再次静默崩」的锁:此前 5 例端到端红掉就是因为只搬了入口。
  const dir = mkScratch('ihui-gate71-closure-')
  try {
    const entry = readFileSync(join(REPO, SCRIPT_REL), 'utf8')
    const closure = copyGateClosure(dir)
    assert.ok(closure.includes(SCRIPT_REL), '闭包必须含入口自身')
    for (const spec of localImportSpecs(entry)) {
      const rel = join(dirname(SCRIPT_REL), spec).split(/[\\/]+/).join('/')
      assert.ok(closure.includes(rel), `入口相对导入 ${spec} 未进闭包 ⇒ 端到端用例必 ERR_MODULE_NOT_FOUND`)
      assert.ok(existsSync(join(dir, rel)), `${rel} 在闭包名单里却没被复制`)
    }
    assert.ok(
      closure.some((p) => p.endsWith('lib/face-reader.mjs')),
      `闭包实得 ${closure.join(' , ')} —— 内容面已走取材层,闭包不含它即说明判据又搬家了`,
    )
    // G-722 载体对账:编号形态判据的家 2026-09-29 从 `live-doc-edit.mjs` 搬进 `lib/plan-task-index.mjs`
    // (生产侧与判据侧各写一份必然漂开)。断言跟着改址,防的东西没变:**判据搬家而闭包没跟上,
    // 端到端夹具就会在 spawn 门的那一刻 ERR_MODULE_NOT_FOUND**(那正是"14 例端到端红 5 例"的旧事故型)。
    // 断言的是"载体在闭包里"而不是"某个具体文件在",所以真搬家时这条会红着逼人改址,不会静默放行。
    assert.ok(
      closure.some((p) => p.endsWith('lib/plan-task-index.mjs')),
      `闭包实得 ${closure.join(' , ')} —— 编号形态判据的载体(lib/plan-task-index.mjs)没搬进夹具`,
    )
  } finally {
    rmScratch(dir)
  }
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

test('端到端(G-183 归档豁免的 A/B):同一份归档正文,只有「已入库」那一版能放行', () => {
  const archiveRel = '.ihui-agent/archive/PROJECT_PLAN_2026-09-25.md'
  const archiveBody = ['# 归档(2026-09-25)', '', HEADING, ''].join('\n')
  const a = tempPlanRepo(V1) // 归档副本只躺在盘上,从未进索引
  const b = tempPlanRepo(V1) // 同一份内容,多一次 git add
  try {
    for (const dir of [a, b]) {
      const dst = join(dir, archiveRel)
      mkdirSync(dirname(dst), { recursive: true })
      writeFileSync(dst, archiveBody, 'utf8')
      writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
      git(dir, 'add', 'PROJECT_PLAN.md')
    }
    git(b, 'add', archiveRel)
    const red = runGate(a, ['--staged'])
    assert.equal(
      red.status,
      1,
      `本机自写的未入库副本竟放行了删行 ⇒ 归档凭据仍是「机器-local 巧合」\nstdout:${red.stdout}`,
    )
    assert.match(red.stderr, /条目标题 O42/)
    const green = runGate(b, ['--staged'])
    assert.equal(
      green.status,
      0,
      `已入库的归档副本必须被认作正当移除,否则 §1 归档流程被本闸判死:\n${green.stderr}`,
    )
  } finally {
    rmScratch(a)
    rmScratch(b)
  }
})

test('反向回归锁:归档豁免不得退回「按磁盘判」,且必须绑当次判定面', () => {
  const src = readFileSync(join(REPO, SCRIPT_REL), 'utf8')
  // 旧形态一旦回来,未入库的本机副本就又能授权删别人的登记行(G-183 ③ 的洞)。
  // 只看函数体:头注里那句「旧实现是 readdirSync(ARCHIVE_DIR)」是对缺陷的说明,不是判据现场。
  const fn = src.slice(
    src.indexOf('export function archivedCopy'),
    src.indexOf('export function archiveExemptFor'),
  )
  assert.ok(fn.length > 100, '没切到 archivedCopy 函数体 ⇒ 本锁变成空判据')
  assert.doesNotMatch(fn, /readdirSync\(/, 'archivedCopy 退回读磁盘目录 ⇒ 归档凭据不再要求「已入库」')
  assert.doesNotMatch(fn, /readFileSync\(/, 'archivedCopy 退回按磁盘读内容 ⇒ 面里的 blob 不再是依据')
  assert.doesNotMatch(src, /^\s*const ARCHIVE_DIR\s*=/m, '磁盘归档目录常量已无消费者,不得加回')
  for (const verb of ["'ls-tree'", "'ls-files'"])
    assert.ok(src.includes(verb), `面清单判据缺 ${verb}(全量走 HEAD 树、--staged 走索引)`)
  // 归档豁免必须**在 runCheck 内按当次判定面 + 当次根**绑定后再喂给两条消费通道。
  // 旧写法 `archiveExemptFor(isStaged)` 直接内联在 dropArchivedLost 里;三面判据落地后它换成
  // 一个 `archive` 闭包被 missingFrom 与 dropArchivedLost 共用 —— 判据没变,**变了的是形状**,
  // 所以锁必须跟着换成"绑面 + 两路都吃到",否则它会在一次正当重构里静默变成空断言。
  const rc = src.slice(src.indexOf('export function runCheck'), src.indexOf('export function faceNoticeFor'))
  assert.ok(rc.length > 200, '没切到 runCheck 段 ⇒ 本锁变成空判据')
  assert.match(
    rc,
    /const archive = archiveExemptFor\(face === 'staged',\s*root\)/,
    "归档豁免必须由当次判定面(face)与当次根(root)绑定 —— 用默认面等于 --staged 时偷偷按 HEAD 判",
  )
  assert.match(
    rc,
    /dropArchivedLost\([\s\S]{0,160}?,\s*archive\)/,
    'staged 通道必须吃到绑好面的 archive,否则收口等于把豁免面写死',
  )
  assert.match(
    rc,
    /missingFrom\([\s\S]{0,160}?,\s*archive\)/,
    '全量/人工档(历史面)同样必须吃到绑好面的 archive —— 新判据最容易做丢的就是这一路',
  )
})

test('取材面形状锁:缺省面必须是 head,磁盘面只能经取材层,三面各一支且不回落', () => {
  const src = readFileSync(join(REPO, SCRIPT_REL), 'utf8')
  const pick = src.slice(
    src.indexOf('export function pickPlanContent'),
    src.indexOf('function candidateContent'),
  )
  assert.ok(pick.length > 100, '没切到 pickPlanContent ⇒ 本锁变成空判据')
  for (const f of ['staged', 'worktree', 'head'])
    assert.ok(pick.includes(`'${f}'`) || f === 'head', `选面缺 ${f} 一支`)
  assert.match(pick, /return readHead\(PLAN\)/, '缺省(未匹配任何旗号)必须落 HEAD,不得落磁盘')
  assert.doesNotMatch(pick, /readDisk\(PLAN\)\s*\|\|/, '不得用"取不到就换一面"的回落写法(回落=把没判写成判过了)')
  const cand = src.slice(src.indexOf('function candidateContent'), src.indexOf('export function runCheck'))
  assert.ok(cand.length > 100, '没切到 candidateContent ⇒ 本锁变成空判据')
  assert.match(cand, /readWorktreeFile\(root, PLAN\)/, '磁盘面必须经取材层 readWorktreeFile(读失败要抛,不得伪装成"不存在")')
  assert.doesNotMatch(cand, /readFileSync\(path\.join\(ROOT/, 'candidateContent 不得再自己拼仓库根读磁盘')
})

test('CLI 面旗成套:两面旗同给判死;缺省档绿而 --worktree 在同一现场红且大声提示', () => {
  // 夹具:HEAD 与索引都是完整那份,只有磁盘副本被"旧基线"写回(= 与任何提交都无关的滞后)
  const dir = tempPlanRepo(V1)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
    const both = runGate(dir, ['--staged', '--worktree'])
    assert.equal(both.status, 2, `--staged 与 --worktree 同给必须 exit 2,实际 ${both.status}`)
    assert.match(`${both.stdout}\n${both.stderr}`, /不得同用|同时给出|拒绝判定/)
    const head = runGate(dir, [])
    assert.equal(head.status, 0, `磁盘缺行不得把 HEAD 面钉红(这正是收口前那道恒红门):\n${head.stderr}`)
    const wt = runGate(dir, ['--worktree'])
    assert.equal(wt.status, 1, `人工档必须仍看得见磁盘滞后,否则逃生舱名不副实:\n${wt.stderr}`)
    const out = `${wt.stdout}\n${wt.stderr}`
    assert.match(out, /你在审\*\*工作树磁盘副本\*\*/, '人工档必须打印"你在审工作树副本"')
    assert.match(out, /与任何提交都无关/, '人工档必须明说红点与任何提交无关')
    assert.match(out, /不要照下面的 1\)|不要.*覆盖/, '人工档必须挡住"拿 HEAD 覆盖在飞副本"这个动作')
    // 反向对照:缺省档不得替人工档喊话(否则会稀释这句提示的意义)
    assert.doesNotMatch(`${head.stdout}\n${head.stderr}`, /你在审\*\*工作树磁盘副本\*\*/)
  } finally {
    rmScratch(dir)
  }
})

test('CLI 全量档端到:HEAD 真丢了历史里的登记行 ⇒ exit 1 并点名;同一现场 --staged 仍绿', () => {
  const dir = tempPlanRepo(V1)
  try {
    // 把"旧基线写回"真正提交进去 ⇒ HEAD 从此缺那行(全量档该红),而索引==HEAD ⇒ 提交链档该绿
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    git(dir, 'commit', '-q', '-m', '旧基线整文件提交(夹具)')
    const head = runGate(dir, [])
    assert.equal(head.status, 1, `HEAD 缺行必须红,实际 ${head.status}\n${head.stdout}${head.stderr}`)
    assert.match(head.stderr, /条目标题 O42/)
    assert.match(head.stderr, /无法判定|判定面/, '结论行必须说自己审的是哪一面')
    const staged = runGate(dir, ['--staged'])
    assert.equal(staged.status, 0, `索引与 HEAD 一致时提交链档不该红:\n${staged.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI 端到:被审面取不到(无提交)⇒ exit 2「无法判定」,不得 rc=0 也不得 rc=1', () => {
  const dir = mkScratch('planloss-nocommit-')
  try {
    copyGateClosure(dir)
    git(dir, 'init', '-q', '-b', 'main')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), V1, 'utf8') // 磁盘上有,但一次也没提交
    const r = runGate(dir, [])
    assert.equal(r.status, 2, `无提交时全量档必须 exit 2,实际 ${r.status}\n${r.stdout}${r.stderr}`)
    assert.match(`${r.stdout}\n${r.stderr}`, /无法判定/)
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /无登记行丢失/, '取不到面却宣布通过 = 替没跑成的判定发合格证')
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
    // 出处必须是**真 sha**:它同时是 `historyMarkers` 的 sha 字段被填上的阳性证明 ——
    // 该字段曾在校验不到的位置被写坏成未定义标识符,而 --heal 每次都抛 ReferenceError。
    assert.match(out, /回捞自 [0-9a-f]{9}/, `回捞出处没打出来 ⇒ sha 字段又空了:\n${out}`)
    assert.doesNotMatch(out, /回捞自 未知来源/, 'sha 字段丢失会退化成「未知来源」,不得静默')
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

test('接线自检:真仓五处权威点里至少一处仍点名本门(防"防丢门被摘线"无人看守)', () => {
  const w = PLAN_LOSS_SRC.planLineLossWired()
  assert.equal(w.wired, true, `本门已不在提交链上:${w.missing.join(' | ')}`)
  assert.ok(
    w.present.length > 0,
    `至少要有一处在场,实得 present=${w.present.join(' | ')} missing=${w.missing.join(' | ')}`,
  )
})

test('接线自检(端到端反例):把五处注册块全抹掉 ⇒ 判"未接线";恢复任一处 ⇒ 判回绿', () => {
  const dir = mkScratch('planloss-unwired-')
  try {
    let copied = 0
    for (const [rel] of PLAN_LOSS_SRC.WIRE_POINTS) {
      let t
      try {
        t = readFileSync(join(process.cwd(), rel), 'utf8')
      } catch {
        continue // 该落点在本仓不存在(本就是一处 missing,不必伪造)
      }
      const dst = join(dir, rel)
      mkdirSync(dirname(dst), { recursive: true })
      writeFileSync(dst, t.split('check-plan-line-loss').join('some-other-gate.mjs'), 'utf8')
      copied++
    }
    assert.ok(copied >= 3, `夹具复制到的落点太少(${copied}),反例不成立`)
    const w = PLAN_LOSS_SRC.planLineLossWired(dir)
    assert.equal(w.wired, false, '五处(已复制的那些)全被抹名后仍判已接线 ⇒ 守卫是空判据')
    assert.equal(w.present.length, 0)
    // 恢复其中一处即回绿 ⇒ 证明判据认的是"内容点名本脚本",不是"文件存在"
    const rPath = join(dir, 'scripts/guardian-runner.mjs')
    writeFileSync(rPath, readFileSync(rPath, 'utf8') + "\n// script: 'check-plan-line-loss.mjs'\n", 'utf8')
    assert.equal(PLAN_LOSS_SRC.planLineLossWired(dir).wired, true, '恢复 runner 注册块后必须判回绿')
  } finally {
    rmScratch(dir)
  }
})

test('接线自检:脚本被复制进临时夹具仓(五处落点全不存在)⇒ 判"不适用",绝不以摘线名义 exit 1', () => {
  const dir = mkScratch('planloss-fixture-')
  try {
    const dst = join(dir, 'scripts')
    mkdirSync(dst, { recursive: true })
    // 同样搬整条闭包(见 copyGateClosure):这一例要真跑出 exit 0 才算"夹具不适用",而不是"夹具崩了"
    copyGateClosure(dir)
    // 本门要求跑在 git 仓里(它读 HEAD),所以夹具也得 init 一个仓并放入一份最小 PLAN
    const gi = (a) =>
      spawnSync('git', a, { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: 'pipe' })
    gi(['init', '-q', '-b', 'main'])
    gi(['config', 'user.email', 't@t.t'])
    gi(['config', 'user.name', 't'])
    // 语料必须是**含受保护编号族**的那份(V1):全量档自 2026-09-26 起把"历史面一条登记行都没枚举到"
    // 判成「无法判定」exit 2(空扫不发合格证),所以夹具若写 `## O9 夹具标题` 这种短而无编号的行,
    // 本例会以"门坏了"的形式红 —— 那是判据在正确地点拒绝出合格证,不是夹具该改判据。
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), V1)
    gi(['add', 'PROJECT_PLAN.md'])
    gi(['commit', '-q', '-m', 'fixture'])
    // 夹具里连 guardian-runner / .husky 都没有:这不是"门被摘掉",是"这里不是本仓"。
    // 第一版把两者混为一谈 ⇒ 本门自己的三枚端到端用例(它们正是这么跑的)被提前 exit 1 弄红。
    const w = PLAN_LOSS_SRC.planLineLossWired(dir)
    assert.equal(w.applicable, false, '一个注册落点都不存在时必须判不适用')
    assert.equal(w.wired, false)
    // 端到端:在这样一个复制出来的脚本上跑 --check,不得因接线判据而红
    const r = spawnSync(process.execPath, [join(dst, 'check-plan-line-loss.mjs'), '--check'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    })
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /已从提交链上被摘掉/, '夹具仓不得报摘线')
    assert.equal(r.status, 0, `夹具仓 --check 应正常跑完,实际 ${r.status}\n${r.stdout}${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 取材面源码锁(2026-09-26):全量档曾把"待提交内容"取成工作树磁盘副本,于是它与任何提交
// 都无关地报红,而它给的出路是"从 HEAD 取回再提交" —— 照做会覆盖别人未提交的在飞内容。
// 这类"只能靠源码锁防"的失效型见守门 70/76/81;行为证明在 --self-test 的四面构造用例里。
test('全量档不得默认读磁盘副本 —— 判定面必须是 HEAD blob', () => {
  const s = readFileSync(new URL('../check-plan-line-loss.mjs', import.meta.url), 'utf8')
  const body = s.slice(s.indexOf('export function runCheck('), s.indexOf('export function historyMarkers'))
  assert.ok(body.length > 50, '找不到 runCheck 段')
  assert.doesNotMatch(
    body,
    /readDisk:\s*\(\)\s*=>\s*readFileSync/,
    'runCheck 段不得再把磁盘写成默认面'
  )
  assert.match(body, /'head'/, "缺省判定面必须显式是 head")
})

/**
 * G-307 闭环端到端:归并器把 F1 分叉的未勾副本翻成带注记的已完成行后,
 * 防丢层(本门全量档 + 它的 --heal 回捞)**不得**把那行读成"整行消失"。
 * 两臂各测一时代形态:legacy 前置式(HEAD 存量)与现行后置式(G-307 修法 a)。
 * 修前该夹具在 legacy 臂上 exit 1(循环的第一半),修后两臂都 exit 0;
 * 反向对照臂(整行真删 + 别处一句散文引用)在两代形态下都必须仍 exit 1 ——
 * 证明"识别合法改写"没有被放宽成"编号在任何地方出现就算活"。
 */
test('端到端(G-307):翻勾+注记的两种形态都不得触发回捞;整行真删仍必须判丢', () => {
  const PLAIN =
    '- [ ] G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。'
  const LEGACY =
    '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。'
  const SUFFIXED =
    '- [x] ✅(2026-09-28) G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。 （[归并] 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账）'
  const v1 = ['# 计划', '', PLAIN, ''].join('\n')
  for (const [name, turned] of [
    ['legacy 前置式', LEGACY],
    ['现行后置式', SUFFIXED],
  ]) {
    const dir = tempPlanRepo(v1)
    try {
      writeFileSync(join(dir, 'PROJECT_PLAN.md'), ['# 计划', '', turned, ''].join('\n'), 'utf8')
      git(dir, 'add', 'PROJECT_PLAN.md')
      git(dir, 'commit', '-m', `fixture: ${name} 翻勾`)
      const r = runGate(dir, [])
      assert.equal(
        r.status,
        0,
        `${name}:被合法翻勾的登记行不得判丢(判丢即触发回捞 ⇒ F1 再红 ⇒ 循环):\nstdout:${r.stdout}\nstderr:${r.stderr}`,
      )
    } finally {
      rmScratch(dir)
    }
  }
  // 反向对照:整行真删,只在别处留一句带同样文字的散文引用 ⇒ 必须仍判丢(两代形态同判)
  const erased = ['# 计划', '', '- 说明:曾有过 G-256 一条**环境相关红** 的登记,现状以别处为准,本行只是转述引用。', ''].join('\n')
  const dir = tempPlanRepo(v1)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), erased, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    git(dir, 'commit', '-m', 'fixture: 整行真删只留散文引用')
    const r = runGate(dir, [])
    assert.equal(r.status, 1, `整段被删不得被"改写识别"洗白:\nstdout:${r.stdout}`)
    assert.match(`${r.stdout}${r.stderr}`, /G-256/)
  } finally {
    rmScratch(dir)
  }
})

// ── 名额判活(multiset):同一编号多处登记、被吞其中一行(2026-09-27 补)──────────────
// 现场逐字取自真实事故:`7c22d68d09b` 入库一整节 `### O61 领票前逐条实测…`,下一枚
// `85e07c9e70b` 按旧基线整文件回写把它吞掉;而 HEAD 里另有 `## O61 safe-commit…` 顶着同一个
// 编号 ⇒ 旧判据(`headingIdSet(候选).has(id)`)判活,717 条历史登记行照报"无缺失,无需回捞"。
const O43_A = '## O43 名额判活夹具甲节:与乙节共用同一个编号;旧基线回写之后这一行仍然留在文档里。'
const O43_B = '### O43 名额判活夹具乙节:同一编号的第二处登记,被下一枚提交按旧基线整文件回写时最先被吞。'
const V_MULTI = ['# 计划', '', O43_A, '', O43_B, '', '### 另一节', OTHER, ''].join('\n')
const STALE_MULTI = V_MULTI.split('\n').filter((l) => l !== O43_B).join('\n')

test('判据(阳性对照):同编号两处登记、吞其一 ⇒ 必须点名;旧集合判据在同一现场判活', () => {
  const lost = G.lostMarkers(V_MULTI, STALE_MULTI)
  // 这两句是"改动确实修好了什么"的证据,不是装饰:旧判据的谓词正是集合成员判定
  assert.equal(G.headingIdSet(STALE_MULTI).has('O43'), true, '前提:旧集合判据会把这一型判活')
  assert.equal(G.headIdSet(STALE_MULTI).has('O43'), true, '前提:大集合同样含该编号')
  assert.equal(lost.length, 1, `应只点名乙节那一条,实得 ${JSON.stringify(lost.map((x) => x.marker))}`)
  assert.equal(lost[0].shape, 'heading')
  assert.equal(lost[0].id, 'O43')
  assert.equal(lost[0].multiSlot, true, '同编号仍有登记点 ⇒ 必须打 multiSlot 标记(回捞侧靠它刹车)')
})

test('判据(不误伤):同编号两处登记都只改写措辞、编号仍占行首 ⇒ 一条都不报', () => {
  const reworded = V_MULTI
    .replace(O43_A, '## O43 名额判活夹具甲节被重写了一遍,编号照旧待在行首,长度也够入选登记行。')
    .replace(O43_B, '### O43 名额判活夹具乙节也被重写了一遍,编号照旧待在行首,长度也够入选登记行。')
  assert.deepEqual(G.lostMarkers(V_MULTI, reworded), [])
})

test('端到端(提交链):旧基线写回吞掉同编号第二行 → --staged exit 1,并写明"不自动回捞"', () => {
  const dir = tempPlanRepo(V_MULTI)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE_MULTI, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    const r = runGate(dir, ['--staged'])
    assert.equal(r.status, 1, `应 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stderr, /条目标题 O43/)
    assert.match(r.stderr, /只点名,不进自动回捞/, 'multiSlot 那一类必须写明不许自动插回台账')
  } finally {
    rmScratch(dir)
  }
})

test('端到端(归档豁免成对):同一行在已入库归档件里逐字可寻 ⇒ 正当移除,--staged 必须绿', () => {
  const archiveRel = '.ihui-agent/archive/PROJECT_PLAN_2026-09-27.md'
  const a = tempPlanRepo(V_MULTI) // 归档副本只躺在盘上,从未进索引 ⇒ 不构成凭据
  const b = tempPlanRepo(V_MULTI) // 同一份内容,多一次 git add ⇒ 构成凭据
  try {
    for (const dir of [a, b]) {
      const dst = join(dir, archiveRel)
      mkdirSync(dirname(dst), { recursive: true })
      writeFileSync(dst, ['# 归档(2026-09-27)', '', O43_B, ''].join('\n'), 'utf8')
      writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE_MULTI, 'utf8')
      git(dir, 'add', 'PROJECT_PLAN.md')
    }
    git(b, 'add', archiveRel)
    assert.equal(runGate(a, ['--staged']).status, 1, '归档件未入库时不得放行(G-183 同条纪律)')
    const green = runGate(b, ['--staged'])
    assert.equal(green.status, 0, `已入库的归档副本必须放行:\n${green.stderr}`)
  } finally {
    rmScratch(a)
    rmScratch(b)
  }
})

test('端到端(回捞侧两种处置):编号整体消失才回插;同编号仍有登记点只点名、一个字节都不写', () => {  const dirA = tempPlanRepo(V_MULTI)
  const sole = '### O44 名额判活夹具丁节:这一处编号只有一行登记,被旧基线吞掉之后应当被自动回捞回来。'
  // 语料必须够"肥":规模安全闸按 missing/seen 比例判异常(默认 40%),只放 2 条登记行的夹具
  // 会被它正确地拒掉 ⇒ 本例要测的是"回捞动作",不是那道闸(那道闸另有自己的成对用例)。
  const V_SOLE = ['# 计划', '', sole, '', HEADING, SIBLING_BOLD, SIBLING_CB, '', '### 另一节', OTHER, ''].join('\n')
  const STALE_SOLE = V_SOLE.split('\n').filter((l) => l !== sole).join('\n')
  const dirB = tempPlanRepo(V_SOLE)
  try {
    writeFileSync(join(dirA, 'PROJECT_PLAN.md'), STALE_MULTI, 'utf8')
    const ra = runGate(dirA, ['--heal'])
    assert.equal(ra.status, 0, `--heal 应正常收尾,实际 ${ra.status}\n${ra.stdout}\n${ra.stderr}`)
    assert.equal(
      readFileSync(join(dirA, 'PROJECT_PLAN.md'), 'utf8'),
      STALE_MULTI,
      'multiSlot 那一类绝不允许被自动插回(那等于替台账长出重复登记)',
    )
    assert.match(`${ra.stdout}\n${ra.stderr}`, /O43/, '但它必须被点名,不得静默')

    writeFileSync(join(dirB, 'PROJECT_PLAN.md'), STALE_SOLE, 'utf8')
    const rb = runGate(dirB, ['--heal'])
    assert.equal(rb.status, 0, `对照:--heal 应 exit 0\n${rb.stderr}`)
    assert.ok(
      readFileSync(join(dirB, 'PROJECT_PLAN.md'), 'utf8').includes(sole),
      '对照:编号整体消失那一类必须被回插,否则本次收紧只是把回捞能力削掉了',
    )
  } finally {
    rmScratch(dirA)
    rmScratch(dirB)
  }
})

// ── 编号形态维(G-722):判据住 live-doc-edit,门只做按面接线的编排 ────────────────────
const MAL_BASE = [
  '# 计划',
  '',
  '- [ ] G-9001 形态维基线行:三面都在,用来确认注入只动了要动的那一行,正文足够长。',
  '',
  '- [ ] DD9002 存量畸形号(台账历史遗留):已在 HEAD ⇒ 只报数;当场判红就是恒红门(§12e)。',
  '',
].join('\n')

test('形状锁(G-722):编号形态判据只许 lib 那一份,门体内不得再抄第二份形态正则', () => {
  const s = readFileSync(join(REPO, SCRIPT_REL), 'utf8')
  // 判据的家 2026-09-29 从 live-doc-edit.mjs 搬到 lib/plan-task-index.mjs(生产侧与判据侧各写一份
  // "什么算畸形"必然漂开,漂开的两个方向账面都是绿的)。这一支跟着改址 —— **不是放宽**:反向锁照旧,
  // 只是"那一份"的位置变了;再加一条反向锁:不得从生产器转口 import(那条边造出 门→生产器→lib→门
  // 的循环依赖,模块实例化期读自己的导出 ⇒ TDZ,实测把整个测试文件打挂)。
  assert.match(s, /from '\.\/lib\/plan-task-index\.mjs'/, '门必须从 lib/plan-task-index.mjs import 判据(单一实现的家)')
  assert.doesNotMatch(s, /from '\.\/live-doc-edit\.mjs'/, '不得从生产器转口 import 畸形判据(循环依赖)')
  assert.match(s, /newMalformed\(/, 'staged/worktree 档必须真调 newMalformed —— 只 import 不接线 = 没有这道维')
  assert.match(s, /findMalformedIds\(/, 'head 档的存量报名必须走 findMalformedIds,不得只报"无"')
  // 反向锁:共享判据的三个形状记号在门体内出现即说明抄了第二份(族名字符类量词 / 全角连字符 / 反向引用)
  assert.doesNotMatch(s, /A-Za-z\]\{1,4\}/, '门体内出现"族名字符类+量词"⇒ 第二份形态正则字面量')
  assert.doesNotMatch(s, /\uFF0D/, '门体内出现全角连字符 ⇒ 抄了共享判据编号段分隔符的形态')
  assert.ok(!s.includes('\\1'), '门体内出现 regex 反向引用 ⇒ 形态判据被就地重写,两处必然漂移')
})

test('端到端(G-722):索引注入畸形号 → --staged exit 1 并点名;摘掉重复前缀的同形行 → exit 0 且存量报名', () => {
  const dir = tempPlanRepo(MAL_BASE)
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${MAL_BASE}\n- [ ] G-G-987 注入的畸形新增行:族名在编号段出现两次,长度足够入选。\n`, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    const red = runGate(dir, ['--staged'])
    assert.equal(red.status, 1, `注入畸形号必须 exit 1,实际 ${red.status}\n${red.stdout}${red.stderr}`)
    const redOut = `${red.stdout}\n${red.stderr}`
    assert.match(redOut, /畸形登记编号/)
    assert.match(redOut, /G-G-987/)
    assert.match(redOut, /未检出登记行丢失/, '登记行没丢时不得打"0 条丢失"的丢失报告,必须分开说')
    // 成对反向:同一行摘掉重复前缀 ⇒ 判绿,且存量 DD9002 必须被报数(静默省略=把没判写成判过了)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${MAL_BASE}\n- [ ] G-987 摘掉重复族名后的正常登记行:与注入行只差编号形态,长度也够。\n`, 'utf8')
    git(dir, 'add', 'PROJECT_PLAN.md')
    const green = runGate(dir, ['--staged'])
    assert.equal(green.status, 0, `摘完前缀不该红,实际 ${green.status}\n${green.stderr}`)
    const greenOut = `${green.stdout}\n${green.stderr}`
    assert.match(greenOut, /无登记行丢失/)
    assert.match(greenOut, /存量/)
    // 全量档同一现场:HEAD 只有存量 DD9002 ⇒ 只报数不判红(§12e),不得把台账旧账钉在每次问责上
    const head = runGate(dir, [])
    assert.equal(head.status, 0, `全量档不得因存量判红,实际 ${head.status}\n${head.stderr}`)
  } finally {
    rmScratch(dir)
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// G-816708(2026-10-05):自愈的**比较目标**从"工作树 + HEAD"两面扩成"工作树 + HEAD + 索引"三面。
// 这一组钉的是端到端那一格(纯函数三档住在 `--self-test`,落地那一刻真的有人跑它住在
// object-space-land / live-doc-edit 的镜像里)。方向:摘掉索引档 ⇒ 第一条立刻红;
// 把"未判定"折成"缺 0 条" ⇒ 第二条立刻红。**判据宽严一字未动**(纯文本搜索的残余面照旧)。
// ─────────────────────────────────────────────────────────────────────────────
test('端到端(G-816708 索引档):HEAD 与工作树都在、只有索引带着旧版 ⇒ --heal 必须点名索引档且不宣布"无缺失"', () => {
  const dir = tempPlanRepo(V1)
  try {
    // 只把**索引**换成旧版,再把工作树恢复成 HEAD 那一份 —— 这是旁路落地(commit-tree +
    // update-index,两个面同时动)之后剩下的那一格:下一个人一次不带 pathspec 的普通提交
    // 就把那一行再吞一遍,而旧实现在这里读不到任何东西。
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), STALE)
    git(dir, 'add', 'PROJECT_PLAN.md')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), V1)
    const idxBlob = git(dir, 'rev-parse', ':PROJECT_PLAN.md').trim()
    const headBlob = git(dir, 'rev-parse', 'HEAD:PROJECT_PLAN.md').trim()
    assert.notEqual(idxBlob, headBlob, '夹具必须真是"索引带旧版"')
    const r = runGate(dir, ['--heal'])
    const out = `${r.stdout}\n${r.stderr}`
    assert.equal(r.status, 0, `--heal 索引档只点名,不该把落地侧判红,实得 ${r.status}\n${out}`)
    assert.match(out, /\[点名\/索引\][^\n]*O42/, '索引档缺的那一条必须**点名到行**,不得只报数')
    assert.doesNotMatch(out, /无缺失,无需回捞/, '三面里有一面缺 ⇒ "无缺失"这句话不得打印(票面的成因正在这句)')
    assert.match(out, /不回写共享主索引/, '能力边界必须报名:点名 ≠ 已修好')
    assert.equal(
      git(dir, 'rev-parse', ':PROJECT_PLAN.md').trim(),
      idxBlob,
      '本层必须**没动**索引 —— 索引那一份可能属于别人尚未提交的暂存(§12 代收红线)',
    )
    assert.equal(readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'), V1, '工作树本来就是对的,不得被顺手改写')
  } finally {
    rmScratch(dir)
  }
})

test('端到端(G-816708 三态):索引面整个取不到 ⇒ 那一档写"未判定",既不冒红也绝不并进"无缺失"', () => {
  const dir = tempPlanRepo(V1)
  try {
    // 索引里根本没有这份文档(git rm --cached)⇒ `:PROJECT_PLAN.md` 取不到内容。
    // 这一档必须是**未判定**,不得折成"缺 0 条"—— "把没判写成判过了"是本仓最高频失效型。
    git(dir, 'rm', '--cached', '-q', '--', 'PROJECT_PLAN.md')
    const r = runGate(dir, ['--heal'])
    const out = `${r.stdout}\n${r.stderr}`
    assert.match(out, /\[点名\/索引\][^\n]*未判定/, '取不到必须单列为未判定(读数里也要是"未判定"而不是数字)')
    assert.doesNotMatch(out, /无缺失,无需回捞/, '有一档没判 ⇒ 不得宣布"无缺失"')
    assert.equal(r.status, 0, `未判定不是违规,实得 ${r.status}\n${out}`)
    assert.match(out, /工作树副本缺 0 条 \/ HEAD 提交树缺 0 条/, '另两档的读数必须照常逐档报清')
  } finally {
    rmScratch(dir)
  }
})

// ── 摘号指针豁免(G-580/D173/G-1058623 F9 批⑤复活竞态根治,2026-10-09)──────────────
// 事故形态:台账治理按 §1 把同号多题的残行合法摘号(整行改写,编号位换成
//   〔【归并】重复登记副本·残行摘号…〕指针段,正文逐字保留),守门 71 的缺失判定把
//   "基线带编号行"与"新面不再以编号开头"简单对账 ⇒ 每次合法摘号都被判"行被抹掉"而回捞旧态,
//   摘号治理与自愈互搏永不收敛(2026-10-09 实测连发 5 轮:0→3→0→3…)。
// 豁免判据:absent 条目的基线行剥复选框、剥行首编号(两族:G-580 连字符 / D173 无连字符)后的
//   正文指纹(去空白前 20 字,≥8 字)必须出现在被审面摘号指针行(剥指针段后)中。
const FP_BASE_ROWS = [
  '- [ ] **G-580 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉(2026-09-28 立)〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕',
  '- [ ]**D173 断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"。',
  '- [ ]**G-1058623 RN 与 api-client 三处接口路径多写一段 agents,运行时必 404(守门 8 报的真缺口)**:① 端内路径。',
  '- [ ]**G-1058623 RN 三处接口路径多写一段 agents(守门 8 报的真缺口;部分收口)** ——原票面三处。',
  '- [ ] G-777 带编号普通行会被吞的一票(对照:它没有摘号,真删必须报)',
]
const FP_TARGET_ROWS = [
  '- [ ] 〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):原号已让出,复活旧态摘号留指针,正文逐字保留。〕**本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉(2026-09-28 立)〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕',
  '- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):本行已让号至 D1047(持行在面),复活旧态摘号留指针,正文逐字保留。〕**断线窗口待决审批的重放(承 D131 取证;等 §24 拍板 A/B/C)** —— 取证已证"会丢"。',
  '- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):原号留归 F1 判据票,复活旧态摘号留指针,正文逐字保留。〕**RN 与 api-client 三处接口路径多写一段 agents,运行时必 404(守门 8 报的真缺口)**:① 端内路径。',
  '- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09 批⑤复活再摘):本行已让号至 G-1104167(持行在面),复活旧态摘号留指针,正文逐字保留。〕**RN 三处接口路径多写一段 agents(守门 8 报的真缺口;部分收口)** ——原票面三处。',
]

test('豁免(摘号指针):基线四行旧态在被审面已合法摘号 ⇒ 不判缺失;同面真删的 G-777 照旧报', () => {
  const lost = G.lostMarkers(FP_BASE_ROWS.join('\n'), FP_TARGET_ROWS.join('\n'))
  assert.equal(
    lost.length, 1,
    `只允许报真删的 G-777,实测 ${lost.length} 条:${lost.map((e) => e.marker.slice(0, 24)).join(' | ')}`,
  )
  assert.match(lost[0].marker, /G-777/, '报的那条必须是没摘号、真被删的对照行')
})

test('反向锁(摘号指针):指针行不在(整行真删)⇒ 必须仍判缺失,豁免不得变万能', () => {
  const lost = G.lostMarkers(FP_BASE_ROWS.join('\n'), '别的无关内容\n- [ ] G-999 别的票')
  assert.equal(lost.length, FP_BASE_ROWS.length, '五条全丢必须全报')
})

test('反向锁(摘号指针):指针行在、正文被换(指纹不匹配)⇒ 必须仍判缺失', () => {
  const lost = G.lostMarkers(
    FP_BASE_ROWS.join('\n'),
    '- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):正文早就不在了。〕**完全不相干的别的内容**',
  )
  assert.equal(lost.length, FP_BASE_ROWS.length, '指针行骗不过指纹对账')
})

test('形状锁(摘号指纹):D 族无连字符编号(D173)必须被剥掉 —— 剥不掉指纹带编号,豁免对 D 族整族失效', () => {
  const fp = G.lossFingerprintOf('- [ ]**D173 断线窗口待决审批的重放(承 D131 取证)**')
  assert.ok(!fp.startsWith('D173'), `指纹不得带编号,实测 ${fp}`)
  assert.ok(fp.startsWith('断线窗口待决审批的重放'), `指纹应从正文开始,实测 ${fp}`)
})

