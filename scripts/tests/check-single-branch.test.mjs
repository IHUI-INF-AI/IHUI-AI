// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 41（单分支开发）的 §22c 镜像测试。
 *
 * 为什么必须有它（不是补格式）：2026-09-28 该门新增了两类**豁免**判据（在飞窗口内的 PR 分支、
 * `backup/` 与 `ihui-backup/` 备份引用）。豁免类判据最大的风险从来不是"漏放一个违规"，而是
 * ①豁免静默生效（读报告的人以为这一族无人看守）、②有人为消红把当前那几条分支名抄进白名单
 * （名单必然腐烂，AGENTS §4 对 `RN_ONLY_BRAND_KEYS` 记过同型）、③接线本身被并发旧基线写回
 * （"门存在、判据对、无人调度"是本仓最高频失效型）。这三条 `--self-test` 结构上抓不到，
 * 因为自检只证明"函数会给答案"，不证明"有人在提交链上问它"。
 *
 * 判据一律 `import` 门体导出的 `__test__`，**禁止**在本文件复制第二份实现（AGENTS §22c）。
 * 断言不依赖仓库当下的分支状态 —— 分支集合是机器态，把它当恒定前提会让本测试在别人开 PR 时
 * 随机翻红（AGENTS §12e"与改动无关的恒红门"同型）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../check-single-branch.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE_SRC = readFileSync(join(HERE, '..', 'check-single-branch.mjs'), 'utf8')
const RUNNER_SRC = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')

const { branchTipTimes, inFlightExempt, mirrorRemoteSet, nonLocalExempt, remoteHeadNames, staleExempt } =
  __test__
const HOUR = 3600000
const NOW = 1_800_000_000_000

/**
 * 从注册表里按**大括号配对**取出本门那一条注册项 —— 不能取"脚本名前后各 N 字符"，
 * 那样会跨进邻门的条目（守门 136 的 T2 记过同型：别人有 blocking 就算我有）。
 * @returns {string|null} 取不到返回 null，由调用方判"未装车"，绝不静默当成通过。
 */
function entryOf(source, scriptName) {
  const at = source.indexOf(`script: '${scriptName}'`)
  if (at < 0) return null
  const open = source.lastIndexOf('{', at)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

test('T1 装车证明：守门 41 在注册表里是 blocking，且本门编号在 runner 中恰好出现一次', () => {
  const entry = entryOf(RUNNER_SRC, 'check-single-branch.mjs')
  assert.ok(entry, '注册表里取不到 check-single-branch.mjs ⇒ 门没接进提交链（不是"通过"）')
  assert.match(entry, /mode:\s*'blocking'/, '本门定级被改动：它必须是 blocking（§9b 的拦截力就在这）')
  const ids = [...RUNNER_SRC.matchAll(/^\s*id:\s*'41',/gm)].length
  assert.equal(ids, 1, `id '41' 在 runner 中出现 ${ids} 次（撞号会串 skipEnv 与失败归属）`)
})

test('T2 反向锁：应急跳过通道不得是文档幻觉 —— 声明了 skipEnv 就必须真被门读取', () => {
  const entry = entryOf(RUNNER_SRC, 'check-single-branch.mjs')
  assert.ok(entry, '前置同 T1')
  const m = entry.match(/skipEnv:\s*'([^']+)'/)
  if (!m) {
    // 没有 skipEnv = 本门刻意不给应急出口。此时门体与注释都不得声称有那条出路。
    assert.doesNotMatch(
      GATE_SRC,
      /HUSKY_SKIP_[A-Z_]*BRANCH[A-Z_]*/,
      'runner 未声明 skipEnv，而门体里出现了同类环境变量名 ⇒ 有人写了跑不通的出路',
    )
    return
  }
  assert.ok(
    GATE_SRC.includes(m[1]),
    `runner 声明 skipEnv=${m[1]} 而门体从不读它 ⇒ 假出路（守门 46/11c/50 同型事故）`,
  )
})

test('T3 形状锁：两条豁免判据必须由门体导出，供本文件与自测共用一份实现', () => {
  assert.ok(
    typeof branchTipTimes === 'function' && typeof inFlightExempt === 'function',
    '豁免逻辑若不再经 __test__ 导出，镜像测试就只能复制一份判据 —— 复制的那份必然跟着漂（§22c）',
  )
  assert.match(GATE_SRC, /export const __test__ = \{[^}]*inFlightExempt[^}]*\}/, '__test__ 丢了 inFlightExempt')
  assert.equal(inFlightExempt('backup/x', new Map(), NOW, 48), 'backup', '导出对象里的必须是那一份实现')
})

test('T4 在飞窗口边界：窗口内豁免、超窗必判（豁免不得变成永久放行）', () => {
  const tips = branchTipTimes(
    [
      `fresh ${Math.floor((NOW - 5 * HOUR) / 1000)}`,
      `edge ${Math.floor((NOW - 48 * HOUR) / 1000)}`,
      `over ${Math.floor((NOW - 49 * HOUR) / 1000)}`,
    ].join('\n'),
  )
  assert.equal(inFlightExempt('fresh', tips, NOW, 48), 'in-flight')
  assert.equal(inFlightExempt('edge', tips, NOW, 48), 'in-flight', '恰好等于窗口应按"仍在飞"（实现用 <=）')
  assert.equal(inFlightExempt('over', tips, NOW, 48), null, '超窗必须回到原判据 —— 这条红就是本门存在的理由')
})

test('T5 origin/ 镜像与本地同名分支同视（否则只豁免了一半）', () => {
  const tips = branchTipTimes(`ci-fix/x ${Math.floor((NOW - 3 * HOUR) / 1000)}`)
  assert.equal(inFlightExempt('ci-fix/x', tips, NOW, 48), 'in-flight')
  // 表里只记了本地那份时，origin 那份取不到时刻 ⇒ 不豁免（宁误拦，不静默放行）
  assert.equal(inFlightExempt('origin/ci-fix/x', tips, NOW, 48), null)
  const both = branchTipTimes(
    [`ci-fix/y ${Math.floor((NOW - 3 * HOUR) / 1000)}`, `origin/ci-fix/y ${Math.floor((NOW - 3 * HOUR) / 1000)}`].join('\n'),
  )
  assert.equal(inFlightExempt('origin/ci-fix/y', both, NOW, 48), 'in-flight')
})

test('T6 备份引用永不判红且不看时刻（§5b 禁删备份 / §22 要求双留，门不得喊人删它们）', () => {
  const ancient = branchTipTimes('backup/ancient 1700000000')
  assert.equal(inFlightExempt('backup/ancient', ancient, NOW, 0), 'backup', '窗口收到 0 也不得把备份引用判红')
  assert.equal(inFlightExempt('origin/ihui-backup/main-x', new Map(), NOW, 48), 'backup')
  assert.equal(inFlightExempt('feature/other', new Map([['feature/other', 1700000000]]), NOW, 48), null)
})

test('T7 取不到时刻一律不豁免（失效方向必须是"多拦"，绝不是"多放"）', () => {
  const tips = branchTipTimes(`listed ${Math.floor((NOW - 1 * HOUR) / 1000)}`)
  assert.equal(inFlightExempt('never-listed', tips, NOW, 48), null)
  assert.equal(inFlightExempt('listed', tips, Number.NaN, 48), null, 'nowMs 不是有限数 ⇒ 不豁免')
  assert.equal(inFlightExempt('listed', new Map(), NOW, 48), null, '整表取不到 ⇒ 在飞豁免必须整体失效')
})

test('T8 时刻表解析：坏行跳过不猜（一次坏行不得把别的分支的豁免顶掉）', () => {
  const tips = branchTipTimes(
    [
      `good ${Math.floor((NOW - 2 * HOUR) / 1000)}`,
      'garbage-line',
      '',
      'broken not-a-number',
      `  padded ${Math.floor((NOW - 2 * HOUR) / 1000)}  `,
    ].join('\n'),
  )
  assert.equal(tips.size, 2)
  assert.ok(tips.has('good') && tips.has('padded'))
  assert.equal(branchTipTimes(null).size, 0, 'null/undefined 输入必须得空表，而不是抛')
})

test('T9 报名锁：两类豁免都必须逐条点名，静默豁免等于没有这一维', () => {
  const printed = (GATE_SRC.match(/不判但如实报数/g) || []).length
  assert.ok(printed >= 3, `门体只在结论里打印了 ${printed} 处"不判但如实报数"（应含镜像/幻影/在飞/备份各档）`)
  assert.match(GATE_SRC, /exempt\['in-flight'\]\.length/, '在飞豁免没有报名分支 ⇒ 有人会把"绿"读成"没有旁支"')
  assert.match(GATE_SRC, /exempt\.backup\.length/, '备份豁免没有报名分支 ⇒ 同上')
  assert.match(GATE_SRC, /提交时刻取不到/, '取不到时刻必须喊出来，不得静默降级成"没有旁支"')
})

test('T10 反白名单锁：豁免必须由"前缀 + 提交时刻"算出，不得抄当前那几条分支名', () => {
  for (const banned of ['ci-green-sweep', 'star-thank-autoclose', 'nightly-single-tracker', 'api-n8n-ownership']) {
    assert.ok(!GATE_SRC.includes(banned), `门体里出现了具体分支名 ${banned} ⇒ 有人用白名单消红，名单必然腐烂`)
  }
  assert.match(GATE_SRC, /BACKUP_REF_PREFIXES\s*=\s*\[[^\]]*'backup\/'/, '备份豁免应按键名前缀判')
})

test('T11 在飞窗口取值：环境变量坏值不得变成 Infinity 或负数（那等于关掉判据）', () => {
  assert.match(GATE_SRC, /IHUI_SINGLE_BRANCH_GRACE_HOURS/, '窗口必须可调（CI 与本地节奏不同）')
  assert.match(GATE_SRC, /GRACE_HOURS_DEFAULT\s*=\s*48/, '缺省值写在源码里，文档不得另抄一份')
  assert.match(GATE_SRC, /Number\.isFinite\(n\)\s*&&\s*n\s*>=\s*0/, '坏值必须回落默认，而不是让 `--grace=abc` 变成永不判红')
})

test('T12 既有豁免族不得被新判据吞掉：goal 分支仍要 STATE.md 标注才合法', () => {
  assert.match(GATE_SRC, /isActiveGoalBranch/, 'goal/ 豁免通道被摘 ⇒ 正在跑 /goal 的会话会被本门顶红')
  assert.match(GATE_SRC, /goal-runtime\/STATE\.md/, 'goal 豁免的凭据是那份 STATE.md，不是前缀本身')
  assert.ok(
    typeof mirrorRemoteSet === 'function' && typeof nonLocalExempt === 'function',
    '镜像远端/幻影引用两类既有豁免的判据必须仍可测（§22c）',
  )
})

test('T13 反向锁：self-test 的登记函数必须对"函数形态用例"求值（恒绿断言比没有断言更糟）', () => {
  // 2026-09-28 实测过的失效形态：`const t = (name, ok) => cases.push([name, !!ok])` 而 13 条用例
  // 全部传 `() => …` ⇒ `!!fn` 恒真 ⇒ self-test 一路报"13/13 通过"，而它连一条都没判过。
  // 该形态下的 grace 除数单位错（48h 实际 ~5.5 年，反向对照永不触发）就是被它掩盖的。
  assert.doesNotMatch(
    GATE_SRC,
    /const t = \(name, ok\) => cases\.push\(\[name, !!ok\]\)/,
    'self-test 退化成"收函数就报绿"—— 这一整维看守当场失效且毫无声响',
  )
  assert.match(GATE_SRC, /typeof ok === 'function' \? Boolean\(ok\(\)\)/, '登记函数必须真的求值用例')
  assert.equal(selfTestReturnsZero(), 0, 'self-test 现读必须真通过（返回码非 0 = 有用例真红）')
})

/** 跑门自带的 self-test，只取其返回码（它自己打印到 stdout，本测试不转述内容）。 */
function selfTestReturnsZero() {
  const r = spawnSync(process.execPath, [join(HERE, '..', 'check-single-branch.mjs'), '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r.status === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------
// 2026-10-09 第三类豁免 stale（本机挂着远程跟踪引用、远端已无该分支）
// ---------------------------------------------------------------------------

/**
 * 纯解析器：`git ls-remote --heads` 的文本里**只有 refs/heads 行算分支**。
 * 这条不是形式主义 —— 本仓真出现过"远端已删分支、但三枚 backup tag 仍指着那个 commit"
 * 的现场（`backup/cleanup-20261002-wip-collect` 等）。若解析器吃得下 `refs/tags/...`，
 * 一条被删的旁支会因为它的备份 tag 而被判"远端还在" ⇒ 豁免失效、恒红回来；
 * 反过来若把 tag 名当分支名比较，则永远匹配不上 ⇒ 真分支被当成 stale 放走。两个方向都红。
 */
test('T14 解析器形状锁：ls-remote 文本里 tag 行不得算分支，空输入不得算"全都没有"', () => {
  const heads = remoteHeadNames(
    [
      'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678\trefs/heads/main',
      'b74ad5a64b2351da23dee3f649d1c41c8fa65c69\trefs/heads/wip/collect-2026-09-30',
      'cecaca0000000000000000000000000000000000\trefs/tags/backup/cleanup-20261002-wip-collect',
      'deadbeef\trefs/heads/',
      '',
    ].join('\n'),
  )
  assert.deepEqual(
    [...heads].sort(),
    ['main', 'wip/collect-2026-09-30'],
    '必须只收 refs/heads/ 下的非空分支名（tag 行与空段都算噪声）',
  )
  // 空输入 ⇒ 空集；调用方据此判"问不到"，不得由解析器自己伪造一个"有清单"的结果
  assert.equal(remoteHeadNames('').size, 0)
  assert.equal(remoteHeadNames(null).size, 0)
})

test('T15 stale 判据四向：远端无⇒豁免 / 远端有⇒仍判 / 问不到⇒不豁免 / 本地分支永不归这一档', () => {
  const heads = remoteHeadNames('aaaa\trefs/heads/main\nbbbb\trefs/heads/wip/real\n')
  const q = { remoteHeads: heads, remoteQueryable: true }
  assert.equal(staleExempt('origin/wip/gone', q), 'stale')
  assert.equal(staleExempt('upstream/wip/gone', q), 'stale', 'origin 的历史别名问的是同一上游')
  assert.equal(staleExempt('origin/wip/real', q), null, '远端真有的滞留旁支必须仍判（§9b 拦的就是它）')
  assert.equal(staleExempt('origin/main', q), null)
  assert.equal(staleExempt('wip/gone', q), null, '本地分支永远要判')
  assert.equal(staleExempt('gitee/wip/gone', q), null, '镜像远端归 mirror 档，不得由 stale 抢')
  assert.equal(staleExempt('origin/wip/gone', { remoteHeads: heads, remoteQueryable: false }), null)
  assert.equal(staleExempt('origin/wip/gone', { remoteQueryable: true }), null, '没给集合⇒不豁免')
})

/**
 * 装车锁：判据写在文件里而主流程没调用 = 提交链上一路绿灯（守门 70/76/81/102 同型，
 * 本仓为这一条写过不止一次反向测试）。这里要的是**结构**证据：
 * stale 必须出现在"决定违规清单"的那一段，而不是只活在 self-test 里。
 */
test('T16 装车锁：stale 判据必须接进主流程的违规清单，且只在"本来要判红"时才联网', () => {
  const mainBody = GATE_SRC.slice(GATE_SRC.indexOf('function main()'), GATE_SRC.indexOf('export function selfTest'))
  assert.ok(mainBody.includes('staleExempt('), '主流程没调用 staleExempt ⇒ 这一档豁免结构上不存在')
  assert.ok(mainBody.includes('probeRemoteHeads('), '主流程没问远端真值 ⇒ staleExempt 永远拿不到集合')
  assert.ok(mainBody.includes('exempt.stale.push('), '判出的 stale 必须进豁免清单并报名')
  // 成本方向：这道门挂在每次提交上，无条件联网会把全队提交拖慢（§12e 的成本口径同门 195）。
  const callSite = mainBody.slice(mainBody.indexOf('probeRemoteHeads(') - 260, mainBody.indexOf('probeRemoteHeads('))
  assert.match(callSite, /if\s*\(\s*illegal\.length/, 'ls-remote 必须只在有候选红的路径上调用')
})

test('T17 出路锁：修复提示必须给出 prune 这条正解，并明写 push --delete 对该型无效', () => {
  // 本门当时的失效方式不是"多放"，而是**给一条必然失败的出路** —— 对它跑 push --delete 报
  // "remote ref does not exist"，人于是认定门坏了，走 --no-verify（当天 safe-commit 的归因行就是这么写的）。
  assert.match(GATE_SRC, /git fetch origin --prune/, '失败提示里没有唯一正解 ⇒ 等于没有出路')
  assert.match(GATE_SRC, /push --delete[^\n]*必然失败|对一条远端不存在的分支/, '必须点名旧出路对这一型不成立')
  assert.match(GATE_SRC, /远端已无此分支/, '报名行要能让人认出这是哪一型，而不是含糊的"幻影"')
})

/** 造一份真 git 现场：bare origin + 推送方 A + 只读过一次远端的 B（B 留着陈旧的远程跟踪引用）。 */
function makeStalenessFixture(t) {
  const dir = mkScratch('single-branch-stale')
  t.after(() => rmScratch(dir))
  const git = (cwd, args, env = {}) => {
    const r = spawnSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@e.t', '-c', 'user.name=T', ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `git ${args.join(' ')} 失败：${(r.stderr || r.stdout || '').slice(0, 400)}`)
    return r.stdout
  }
  const origin = join(dir, 'origin.git')
  mkdirSync(origin, { recursive: true })
  git(origin, ['init', '--bare', '-q', '.'])
  const a = join(dir, 'a')
  mkdirSync(a, { recursive: true })
  git(a, ['init', '-q', '-b', 'main', '.'])
  writeFileSync(join(a, 'f.txt'), 'x\n')
  git(a, ['add', 'f.txt'])
  git(a, ['commit', '-q', '-m', 'init'], { GIT_AUTHOR_DATE: OLD_DATE, GIT_COMMITTER_DATE: OLD_DATE })
  git(a, ['remote', 'add', 'origin', origin])
  git(a, ['push', '-q', 'origin', 'main'])
  git(a, ['branch', 'wip/gone'])
  git(a, ['push', '-q', 'origin', 'wip/gone'])
  // B 在分支还存在的时刻取过一次快照 ⇒ 它手上有对象、也有跟踪引用
  const b = join(dir, 'b')
  git(dir, ['clone', '-q', origin, b])
  // A 把远端分支删掉（本机跟踪引用随之消失，但 B 的那份留着 —— 正是 2026-10-09 那台机的形态）
  git(a, ['push', '-q', 'origin', '--delete', 'wip/gone'])
  const shown = git(b, ['branch', '-a'])
  assert.match(shown, /remotes\/origin\/wip\/gone/, '夹具没造出"远端已无、本机仍挂"的形态（后续断言全部无效）')
  // 对象在 B 里必须**仍可解析** —— 否则这一型会落进 phantom 档，本测试测的就不是 stale
  const resolvable = spawnSync('git', ['-C', b, 'rev-parse', '--verify', 'refs/remotes/origin/wip/gone^{commit}'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(resolvable.status, 0, '夹具里那条 ref 的 sha 必须可解析，否则测的是 phantom 而不是 stale')
  // 把门体连它的 import 闭包拷进 B（ROOT 由脚本自身位置推导 ⇒ 落在 B 的仓根）
  const copied = copyScriptWithClosure(join(HERE, '..'), 'check-single-branch.mjs', join(b, 'scripts'), [
    'lib/face-reader.mjs',
  ])
  assert.ok(copied.includes('check-single-branch.mjs'), '门体没拷进去')
  return { dir, origin, a, b, gate: join(b, 'scripts', 'check-single-branch.mjs') }
}

const OLD_DATE = '2020-01-01T00:00:00 +0000'

test('T18 端到端正向：远端已无、本机仍挂 ⇒ 判绿并逐条点名（旧写法在这里是无解的恒红）', (t) => {
  const { b, gate } = makeStalenessFixture(t)
  const r = spawnSync(process.execPath, [gate], {
    cwd: b,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, IHUI_SINGLE_BRANCH_GRACE_HOURS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 0, `远端已无该分支时本门必须放行，实得 rc=${r.status}\n${out.slice(0, 1200)}`)
  assert.match(out, /origin\/wip\/gone/, '豁免必须报名，静默放行等于没有这一维')
  assert.match(out, /git fetch origin --prune/, '报告里要给出唯一正解')
})

test('T19 端到端反向：远端真有的超窗旁支必须仍判红（开了豁免不等于关掉判据）', (t) => {
  const { origin, b, gate } = makeStalenessFixture(t)
  // 在 B 里造一条**远端确实存在**的旁支：先推上去，再把 B 的本地分支删掉只留跟踪引用，
  // 使候选面里出现 origin/wip/real（提交时刻压到 2020 年，保证超出任何在飞窗口）。
  spawnSync('git', ['-C', b, 'push', '-q', 'origin', 'refs/remotes/origin/main:refs/heads/wip/real'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  spawnSync('git', ['-C', b, 'fetch', '-q', 'origin'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const r = spawnSync(process.execPath, [gate], {
    cwd: b,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, IHUI_SINGLE_BRANCH_GRACE_HOURS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 1, `远端真在的旁支必须判红，实得 rc=${r.status}\n${out.slice(0, 1200)}`)
  assert.match(out, /origin\/wip\/real/, '红点必须点名那条真分支')
  assert.ok(!/不判但如实报数:1 个"远端已无此分支"/.test(out) || out.includes('origin/wip/real'),
    '真分支不得被 stale 档吞掉（吞掉的那条会从报告里消失，而不是变成红）')
  // 夹具自证：origin 里确实有那条分支（否则 T19 只是在测一条空规则）
  const ls = spawnSync('git', ['-C', b, 'ls-remote', '--heads', origin], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(ls.stdout, /refs\/heads\/wip\/real/, '夹具反向对照的前提')
})

test('T20 端到端失效方向：远端问不到 ⇒ 不豁免，照旧判红（失效方向必须是多拦）', (t) => {
  const { b, gate } = makeStalenessFixture(t)
  // 把 B 的 origin 指到一个不存在的目录：ls-remote 必失败，而那条陈旧跟踪引用仍在。
  spawnSync('git', ['-C', b, 'remote', 'set-url', 'origin', join(b, 'no-such-origin.git')], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const r = spawnSync(process.execPath, [gate], {
    cwd: b,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, IHUI_SINGLE_BRANCH_GRACE_HOURS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 1, `问不到远端时必须回到原判据，实得 rc=${r.status}\n${out.slice(0, 1200)}`)
  assert.match(out, /取不到/, '必须喊出"远端清单取不到"，不得静默按"都没有"处理')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
