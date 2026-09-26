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
    // 取材面三件套(2026-09-26 收口):选面、人工档提示、总入口、历史面基线
    'pickPlanContent',
    'faceNoticeFor',
    'runCheck',
    'historyMarkers',
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

