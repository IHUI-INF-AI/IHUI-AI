// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/heal-worktree-tracked.test.mjs
/**
 * 第四层(旁路提交孤儿路径恢复,2026-09-26)的镜像取证。
 *
 * 与 `--self-test` 的分工:self-test 判**行为**(四判据、幂等、父树签名、合并形态);
 * 本文件钉 self-test 结构上看不见的那几件:
 *   ① 装车 —— alignDrifts 真的调用 restoreBypassOrphans,而默认恢复档 heal **不**调用
 *      (新层刻意只在 --align-drift 下写盘;"函数在、没接线"是守门 70/76/81/102 的同型盲区);
 *   ② CLI 契约 —— `--align-drift --json` 的最后一行必须可 JSON.parse 且 bypassRestored 点名
 *      被恢复的路径(守护/converge 都是"取末行 parse",任何跟在 JSON 后的人类行都会把
 *      整轮记成"自愈失败");`--check` 默认档对同一现场必须**零副作用**(只报数,文件不回来);
 *   ③ 形状锁 —— 判据不被简化成"看盘上没有就补":动手函数体内必须同时存在 existsSync 复读
 *      与逐路径 checkout,inner 必须走 `--diff-filter=D` + splitByParentSignature。
 * 判据本体不在此重抄(§22c:测试复制判据=两套真相);①③ 按源码形状断言,②按端到端行为断言。
 *
 * T9–T17 是第五层(旁路落地欠回写 `alignLandingDebtIndex`,2026-10-14)的镜像取证:
 *   ① 装车形状锁 —— 接进 alignDrifts、heal 默认档不接,且**函数体内不得出现任何写工作树的
 *      动作**(2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账的成因);
 *   ② 变异对照 —— 同一形态两个出口读数不同(`refreshStaleIndex` 必须归零并点名 exempt,
 *      新层必须 aligned=1),这样将来有人把新层摘掉/把豁免绕行改回去,本文件立刻变红;
 *   ③ §0.3 —— 没有留痕台账时必须读成 `undetermined` 并点名,绝不允许读成"0 违规 = 干净"。
 *   留痕一律走生产出口 `recordBypassLanding`(手抄 JSON 键名 = 第二份 schema,§22c 禁)。
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { recordBypassLanding } from '../lib/commit-attestation.mjs'
import { __test__ } from '../heal-worktree-tracked.mjs'

const { restoreBypassOrphans, alignDrifts, refreshStaleIndex, alignLandingDebtIndex } = __test__
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS = join(REPO, 'scripts')

/** 取函数体(大括号配平,不用正则猜行 —— 与 git-guardian-drift-align.test 同法)。
 *  差别:本文件的函数带解构默认值参数(`{ dryRun = false }`),参数里就有 `{` ——
 *  必须先配平掉 `(` … `)`,再从其后找第一个 `{`,否则 body 取到的是参数对象(第一版就这样 T1 假红)。 */
function funcBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源文件里找不到 ${name}()`)
  let i = src.indexOf('(', start)
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) break
  }
  const open = src.indexOf('{', i)
  depth = 0
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++
    else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1)
  }
  assert.fail(`${name}() 花括号未配平`)
}

function healSrc() {
  return readFileSync(join(SCRIPTS, 'heal-worktree-tracked.mjs'), 'utf8')
}

test('T1 装车:alignDrifts 调用第四层,而默认恢复档 heal 不调用', () => {
  const src = healSrc()
  assert.match(
    funcBody(src, 'alignDrifts'),
    /restoreBypassOrphans\(/,
    '第四层没接进 --align-drift = converge 收尾仍漏这一型',
  )
  const healIdx = src.indexOf('export function heal(')
  assert.ok(healIdx > 0, '找不到 heal() 定义')
  assert.ok(
    !funcBody(src, 'heal').includes('restoreBypassOrphans'),
    'heal 默认档不得触发第四层(新层只在 --align-drift 写盘是设计前提)',
  )
})

test('T2 形状锁:动手前逐批复读磁盘 + 逐路径 checkout(不得简化成"盘上没有就补")', () => {
  const src = healSrc()
  const act = funcBody(src, 'restoreMissingFromHead')
  assert.match(
    act,
    /existsSync\(/,
    '动手前的 existsSync 复读被删 ⇒ 判据与写盘之间别人刚落盘的现场会被覆盖',
  )
  assert.match(act, /'checkout'/, '恢复动作必须是 checkout(索引+工作树一次回写),不是只写一边')
  const inner = funcBody(src, 'restoreBypassOrphansInner')
  assert.match(inner, /--diff-filter=D/, '判据②的取材命令被改 ⇒ "索引没有该路径"不再可证')
  assert.match(
    inner,
    /splitByParentSignature\(/,
    '判据④(父树签名)被摘线 ⇒ 与有意 git rm 重新分不清,本层变成越权器',
  )
})

/**
 * CLI 契约用例需要的"可独立运行的自愈 CLI":repoRoot 由脚本自身位置推导,所以必须把 CLI
 * 连同它的**相对 import 闭包**拷进演练仓 —— 闭包按 import 行**推导**而不是手抄清单
 * (清单腐烂正是 git-guardian-drift-align.test 头注记过的同型事故)。
 */
function localImportClosure(entryRel, seen = new Set()) {
  if (seen.has(entryRel)) return seen
  seen.add(entryRel)
  let text = ''
  try {
    text = readFileSync(join(SCRIPTS, entryRel), 'utf8')
  } catch {
    return seen
  }
  for (const m of text.matchAll(/^\s*import\b[^'"]*from\s*'(\.[^']+)'/gm)) {
    const next = normalize(join(dirname(entryRel), m[1])).replace(/\\/g, '/')
    localImportClosure(next, seen)
  }
  return seen
}

/**
 * 造第四层的典型现场:HEAD 有 born.ts、索引停在父树、磁盘也没有。
 * 用真实命令造终态(理由同 heal-worktree-tracked self-test ⑭:不喂 stdin、不拼 commit-tree)。
 */
function makeBypassDrill() {
  const dir = mkScratch('wt-heal-mirror-')
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'a.ts'), 'a1\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'base'])
  writeFileSync(join(dir, 'born.ts'), 'born by bypass commit\n')
  g(['add', 'born.ts'])
  g(['commit', '-qm', 'advance: HEAD 多一个 born.ts'])
  rmSync(join(dir, 'born.ts'), { force: true })
  g(['read-tree', 'HEAD~1'])
  return { dir, g }
}

function copyCliInto(dir) {
  const closure = localImportClosure('heal-worktree-tracked.mjs')
  for (const rel of closure) {
    const dst = join(dir, 'scripts', rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(SCRIPTS, rel), dst)
  }
  // 反向哨兵:闭包必须真的含共用层与 scratch-dir,否则 CLI 在演练仓里 ERR_MODULE_NOT_FOUND
  assert.ok(
    closure.has('lib/face-reader.mjs'),
    '闭包没含 lib/face-reader.mjs —— git 派生已收口到共用层',
  )
  assert.ok(
    closure.has('lib/scratch-dir.mjs'),
    '闭包没含 lib/scratch-dir.mjs —— self-test 通道的依赖断了',
  )
  return join(dir, 'scripts', 'heal-worktree-tracked.mjs')
}

function runCli(scriptPath, args, cwd) {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  return spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  })
}

test('T3 CLI 契约:--align-drift --json 末行可 parse,bypassRestored==1 且点名路径,exit 0', () => {
  const { dir } = makeBypassDrill()
  try {
    const cli = copyCliInto(dir)
    const r = runCli(cli, ['--align-drift', '--json'], dir)
    assert.equal(r.status, 0, `应 exit 0,实得 ${r.status};stderr=${String(r.stderr).slice(0, 300)}`)
    const last = (r.stdout || '').trim().split('\n').pop()
    const j = JSON.parse(last) // 守护正是"取末行 parse"——JSON 后面不得再有任何一行
    assert.equal(j.bypassRestored, 1, `bypassRestored 应为 1,实得 ${last.slice(0, 300)}`)
    assert.ok(j.bypassPaths.includes('born.ts'), '审计必须点名被恢复的路径')
    assert.equal(existsSync(join(dir, 'born.ts')), true, '恢复动作必须把文件写回工作树')
    assert.notEqual(
      gitRaw(['ls-files', '-s', '--', 'born.ts'], dir).trim(),
      '',
      '恢复动作必须把路径写回索引',
    )
    assert.equal(
      (r.stdout || '').trim().split('\n').length,
      1,
      '--json 档只能有一行输出(多一行就把守护记成自愈失败)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T4 CLI 契约:人类档审计行点名恢复与两类"只报数"', () => {
  const { dir } = makeBypassDrill()
  try {
    const cli = copyCliInto(dir)
    const r = runCli(cli, ['--align-drift'], dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /旁路提交孤儿路径已恢复 1 个/)
    assert.match(r.stdout, /已恢复 born\.ts/, '审计行必须逐路径点名(不静默)')
  } finally {
    rmScratch(dir)
  }
})

test('T5 --check 默认档对同一现场零副作用(恢复只发生在 --align-drift)', () => {
  const { dir } = makeBypassDrill()
  try {
    const cli = copyCliInto(dir)
    const r = runCli(cli, ['--check'], dir)
    assert.equal(r.status, 1, 'orphanIndex>0 时 --check 必须 exit 1(可判定性),但仍不得写盘')
    assert.equal(
      existsSync(join(dir, 'born.ts')),
      false,
      '--check 档把第四层跑成写操作 = 零副作用承诺作废',
    )
    assert.match(r.stdout, /索引孤儿 born\.ts/, '只报数也要点名')
  } finally {
    rmScratch(dir)
  }
})

test('T6 判据④正面例:老文件的完整 git rm(存在于每个父树)不修', () => {
  const { dir, g } = makeBypassDrill()
  try {
    restoreBypassOrphans(dir) // 先把 born.ts 清出候选集,本例只问"a.ts 被人为 rm"这一型
    g(['rm', '-q', 'a.ts']) // 索引+磁盘一起删 —— 单路径面上与旁路残留同形
    const res = restoreBypassOrphans(dir)
    assert.equal(res.restored, 0, '人为 git rm 被自动恢复 = 替他撤销暂存(§16 越权)')
    assert.ok(res.unprovenPaths.includes('a.ts'), 'a.ts 应落 heldUnproven 并点名')
    assert.equal(existsSync(join(dir, 'a.ts')), false, '不修 = 磁盘保持原样')
  } finally {
    rmScratch(dir)
  }
})

test('T7 幂等:恢复后 alignDrifts 再跑必须 bypassRestored==0', () => {
  const { dir } = makeBypassDrill()
  try {
    const first = alignDrifts(dir)
    assert.equal(first.bypassRestored, 1)
    const second = alignDrifts(dir)
    assert.equal(second.bypassRestored, 0, '第二次仍报恢复 = 判据在已修态上重言,幂等锁失效')
    assert.deepEqual(second.bypassPaths, [])
  } finally {
    rmScratch(dir)
  }
})

/**
 * T8 —— ②′ 通道(索引内容是 HEAD 的行子集 ⇒ 允许在"工作树另有现场"时刷新索引)的三条锁。
 * 每条都是**行为面**而不是正则:构造现场 → 跑判据 → 看索引 blob 与磁盘字节。
 *  ① 正例:拼合旧档(k1/k3 从未整体提交过 ⇒ ②祖先通道挡下)+ 工作树独有一行 ⇒ 走 ②′,
 *     且**盘上那一行一字不动**(刷新只写索引 —— 这是本通道存在的唯一理由);
 *  ② 反例:索引里有一行 HEAD 没有(= 别人真暂存的新工作)⇒ 两条通道都不许动它;
 *  ③ 删除护栏:夹具的 born.ts 处于"索引里没有"态,多重集判据对它天然成立,
 *     而它可以是有意的 `git rm` ⇒ 必须永不出现在刷新名单里(§7 删除安全)。
 *  ④ 形状锁:②′ 取内容只能走共用层 `catBatch(` —— 引了层却自己 `git show` / 读磁盘
 *     就是守门 118 说的半接线,而这条通道判的正是"内容",半接线的后果是拿滞后面判无损。
 */
test('T8 ②′ 通道:行子集才刷新(正例)/ 真新暂存不动(反例)/ 暂存删除永不走(护栏)+ 取材只能走共用层', () => {
  const { dir, g } = makeBypassDrill()
  try {
    writeFileSync(join(dir, 'sub.ts'), 'k1\n')
    g(['add', 'sub.ts'])
    g(['commit', '-qm', 'S1 k1'])
    writeFileSync(join(dir, 'sub.ts'), 'k1\nk2\nk3\n')
    g(['commit', '-qam', 'S2 k1k2k3'])
    writeFileSync(join(dir, '.mkblob'), 'k1\nk3\n')
    const subBlob = g(['hash-object', '-w', '--', '.mkblob']).trim()
    g(['update-index', '--cacheinfo', `100644,${subBlob},sub.ts`])
    writeFileSync(join(dir, 'sub.ts'), 'k1\nk2\nk3\n别人正在写的一行\n')
    const r1 = refreshStaleIndex(dir)
    assert.ok(r1.subsetPaths.includes('sub.ts'), '②′ 没放行:索引行全是 HEAD 的子集仍被 held')
    assert.equal(
      g(['ls-files', '-s', '--', 'sub.ts']).split(/\s+/)[1],
      g(['rev-parse', 'HEAD:sub.ts']).trim(),
      '刷新后索引不等于 HEAD',
    )
    assert.equal(
      readFileSync(join(dir, 'sub.ts'), 'utf8'),
      'k1\nk2\nk3\n别人正在写的一行\n',
      '刷新写了工作树 = 把别人的现场抹掉(本通道结构性禁止)',
    )

    writeFileSync(join(dir, 'sub2.ts'), 'c1\nc2\n')
    g(['add', 'sub2.ts'])
    g(['commit', '-qm', 'T1 c1c2'])
    writeFileSync(join(dir, '.mkblob'), 'c1\nc2\n别人新加的字段\n')
    const newBlob = g(['hash-object', '-w', '--', '.mkblob']).trim()
    g(['update-index', '--cacheinfo', `100644,${newBlob},sub2.ts`])
    writeFileSync(join(dir, 'sub2.ts'), 'c1\nc2\n别人新加的字段\n再改一行\n')
    const r2 = refreshStaleIndex(dir)
    assert.ok(!r2.paths.includes('sub2.ts') && !r2.subsetPaths.includes('sub2.ts'), '真新暂存被刷新 = 替他撤销暂存')
    assert.equal(
      g(['ls-files', '-s', '--', 'sub2.ts']).split(/\s+/)[1],
      newBlob,
      '索引 blob 被改动',
    )
    assert.ok(!r2.paths.includes('born.ts') && !r2.subsetPaths.includes('born.ts'), '暂存删除走进 ②′ = 把有意 git rm 读成无损')

    const src = healSrc()
    const body = funcBody(src, 'subsetRefreshable')
    assert.match(body, /catBatch\(/, '②′ 取内容必须走共用层 catBatch(半接线 = 拿滞后面判无损)')
    assert.doesNotMatch(body, /readFileSync|execFileSync|child_process/, '②′ 里不得再有第二套取材')
  } finally {
    rmScratch(dir)
  }
})

/* ------------------------------------------------------------------ *
 * T9–T17 ㊺ 第五层「旁路落地欠回写」(`alignLandingDebtIndex`,2026-10-14 立)的镜像取证。
 * 立因实测:22:45:55 那枚 `union-converge --apply` 用 commit-tree + CAS 推进 HEAD 但**不回写
 * 工作区/索引**,于是 PROJECT_PLAN.md 的索引长期停在落地前像 b9b41997a6 —— 一次不带 pathspec 的
 * 普通提交会把合并成果写回旧态(守门 84),`git merge --ff-only` 更会被这条脏索引直接挡下。
 * 既有 `ALIGN_EXEMPT_PATHS` 把活文档从 `refreshStaleIndex` 整体绕行 ⇒ 那一格过去无人负责。
 * self-test 判行为;这里钉 self-test 结构上看不见的三件:①装车 + "只写索引、绝不写工作树"
 * (2026-10-12 那次"刷新索引 + 回写工作树"两层接力吃掉 19339 行台账的成因)、②变异对照
 * (将来有人把新层摘掉/把绕行改回去,本文件必须变红)、③§0.3 的"没判"不得读成"判过"。
 * 留痕一律走生产出口 `recordBypassLanding` —— 在测试里手抄 JSON 键名就是第二份 schema(§22c)。
 * ------------------------------------------------------------------ */

/**
 * 造第五层的典型现场:c0 = 落地前像、c1 = 旁路落地换上的合并成果(HEAD),
 * 再把索引与工作树双双退回 c0(与"只推进 HEAD"的落地器终态同形)。
 * `withMerge` 为真时先起一支只动 side.ts 的 feature 做**真** merge(不收口 ⇒ MERGE_HEAD 在);
 * 台账那一格必须在 merge 之后才退回 —— 带着脏索引去 merge 会被 git 自己拒收(实测 exit 2)。
 */
function makeLandingDebtDrill(tag, { withMerge = false } = {}) {
  const dir = mkScratch(tag)
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  g(['init', '-q', '--initial-branch=main'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'line-old\n')
  if (withMerge) writeFileSync(join(dir, 'side.ts'), 's0\n')
  g(['add', '-A'])
  g(['commit', '-qm', 'c0 落地前像'])
  const headBefore = g(['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'line-old\nline-merged\n')
  g(['commit', '-qam', 'c1 合并成果(= 旁路落地那一枚 HEAD)'])
  const landedSha = g(['rev-parse', 'HEAD']).trim()
  if (withMerge) {
    g(['branch', '-f', 'feature', headBefore])
    g(['checkout', '-q', 'feature'])
    writeFileSync(join(dir, 'side.ts'), 's1\n')
    g(['commit', '-qam', 'feature 只动 side.ts'])
    g(['checkout', '-q', 'main'])
    g(['merge', '--no-commit', '--no-ff', 'feature', '-m', 'merge 未收口'])
  }
  g(['checkout', '-q', headBefore, '--', 'PROJECT_PLAN.md'])
  return { dir, g, headBefore, landedSha }
}

/** 留痕写不进台账 ⇒ 本层读到的"无留痕"是夹具坏了,当场炸,不许静默把反控跑成空判。 */
function recordLanding({ dir, landedSha, headBefore, declaredFiles = ['PROJECT_PLAN.md'] }) {
  const r = recordBypassLanding({
    root: dir,
    source: 'scripts/tests/heal-worktree-tracked.test.mjs 镜像夹具',
    landedSha,
    headBefore,
    declaredFiles,
  })
  assert.equal(r.ok, true, `留痕未写入台账:${r.why}`)
  return r
}

const planIndexBlob = (g) => g(['ls-files', '-s', '--', 'PROJECT_PLAN.md']).trim().split(/\s+/)[1]

test('T9 装车 + 形状锁:第五层接进 alignDrifts 而 heal 不接,函数体内不得有写工作树的动词', () => {
  const src = healSrc()
  assert.match(
    funcBody(src, 'alignDrifts'),
    /alignLandingDebtIndex\(/,
    '第五层没接进 --align-drift = 落地欠账仍无人认领(§0.9「造好没装车」= 没有)',
  )
  assert.ok(
    !funcBody(src, 'heal').includes('alignLandingDebtIndex'),
    'heal 默认档不得触发第五层(新层只在 --align-drift 写盘是设计前提)',
  )
  const body = funcBody(src, 'alignLandingDebtIndex')
  assert.match(body, /ALIGN_EXEMPT_PATHS/, '判据①的取材被摘 ⇒ 本层会去碰非豁免路径')
  assert.match(body, /BYPASS_KIND/, '判据②的留痕族键被摘 ⇒ 任意一跳台账都能给陈旧作证')
  assert.match(body, /merge-base/, 'landedSha 的祖先校验被摘 ⇒ 不在当前线上的落地也能作证')
  assert.match(body, /writeIndexCacheInfos\(/, '唯一写出口必须是 writeIndexCacheInfos(锁让路在它里面)')
  assert.doesNotMatch(
    body,
    /writeFileSync|appendFileSync|copyFileSync|rmSync|checkout/,
    '本层出现任何写工作树的动作 = 19339 行台账事故那一半回潮(本层的存在前提)',
  )
})

test('T10 正控:落地前像形态 ⇒ aligned=1、点名路径,索引 blob 复核已等于 HEAD blob', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-pos-')
  try {
    recordLanding({ dir, landedSha, headBefore })
    const pre = g(['rev-parse', 'HEAD~1:PROJECT_PLAN.md']).trim()
    const head = g(['rev-parse', 'HEAD:PROJECT_PLAN.md']).trim()
    assert.equal(planIndexBlob(g), pre, '前提:索引确停在落地前像')
    assert.notEqual(pre, head, '前提:落地前像必须 != HEAD,否则本例什么都没判')
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 1, `应对齐 1 个路径,实得 ${JSON.stringify(r)}`)
    assert.ok(r.paths.includes('PROJECT_PLAN.md'), '审计必须点名被对齐的路径')
    assert.deepEqual(r.held, [], '正控里不得同时冒出 held')
    assert.deepEqual(r.undetermined, [], '正控里不得同时冒出未判定')
    assert.equal(planIndexBlob(g), head, '执行后用 git ls-files -s 复核:索引必须已是 HEAD blob')
  } finally {
    rmScratch(dir)
  }
})

test('T11 反向断律:执行后工作区仍是落地前像(本层刻意绝不写工作树)', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-wt-')
  try {
    recordLanding({ dir, landedSha, headBefore })
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 1)
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'),
      'line-old\n',
      '工作树被写 = 把"刷新索引 + 回写工作树"那两层接力放回来(2026-10-12 吃掉 19339 行台账)',
    )
    assert.equal(
      g(['diff', '--name-only', '--', 'PROJECT_PLAN.md']).trim(),
      'PROJECT_PLAN.md',
      '索引已==HEAD 而工作树仍是前像 ⇒ 这一格必须仍显示为待办,不得被本层抹平成"干净"',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T12 变异对照:同一形态只跑 refreshStaleIndex ⇒ refreshed=0 且点名 exempt;只有新层能对齐', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-mut-')
  try {
    recordLanding({ dir, landedSha, headBefore })
    const pre = g(['rev-parse', 'HEAD~1:PROJECT_PLAN.md']).trim()
    const only = refreshStaleIndex(dir)
    assert.equal(only.refreshed, 0, '既有那层对活文档是刻意绕行 ⇒ 它若刷新了本形态,绕行已被人改掉')
    assert.ok(only.exempt.includes('PROJECT_PLAN.md'), '绕行必须逐条点名(exempt),不许静默')
    assert.equal(planIndexBlob(g), pre, '既有那层不该动索引,却动了')
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 1, '同一形态两个出口读数必须不同 ⇒ 起作用的是新层,不是老代码')
    assert.ok(r.paths.includes('PROJECT_PLAN.md'))
    assert.equal(planIndexBlob(g), g(['rev-parse', 'HEAD:PROJECT_PLAN.md']).trim())
  } finally {
    rmScratch(dir)
  }
})

test('T13 反控 A:工作区 != 索引(有人正在台账上写)⇒ aligned=0、held 点名、索引与现场都不动', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-held-')
  try {
    recordLanding({ dir, landedSha, headBefore })
    const idxBefore = planIndexBlob(g)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'line-old\n某会话正在写的一行\n')
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 0, '判据③不成立还写索引 = 替他撤销暂存(§16 越权)')
    assert.equal(r.held.length, 1, '让路必须逐条点名,不许只剩一个 0')
    assert.equal(r.held[0].path, 'PROJECT_PLAN.md')
    assert.ok(String(r.held[0].reason).length > 0, 'held 必须带原因(静默让路与无事发生同形)')
    assert.deepEqual(r.candidates, [], '既已让路就不该同时进候选集')
    assert.equal(planIndexBlob(g), idxBefore, '索引被写')
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'),
      'line-old\n某会话正在写的一行\n',
      '别人正在写的那一行被抹掉',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T14 反控 B(§0.3):无留痕台账 ⇒ 读成 undetermined 并点名,绝不读成"0 违规 = 干净"', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-noledger-')
  try {
    const idxBefore = planIndexBlob(g)
    assert.ok(headBefore.length === 40 && landedSha.length === 40, '夹具前提:两枚 sha 都取得到')
    // 刻意不写任何留痕:这份陈旧证明不了由哪一次落地造成 ⇒ 只能"未判定"
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 0)
    assert.equal(r.undetermined.length, 1, `台账缺失必须冒出 1 条未判定,实得 ${JSON.stringify(r)}`)
    assert.ok(r.undetermined[0].path.includes('PROJECT_PLAN.md'), '未判定必须点名是哪一格')
    assert.ok(String(r.undetermined[0].reason).includes('台账'), '原因要点名是台账读不到')
    assert.deepEqual(r.held, [], '未判定与"有留痕但对不上"是两件事,不得混成一堆')
    assert.deepEqual(r.candidates, [], '未判定还进候选集 = 判据没起作用')
    assert.equal(planIndexBlob(g), idxBefore, '未判定却写了索引 = 把"没判"写成"判过"')
  } finally {
    rmScratch(dir)
  }
})

test('T15 反控 C:留痕在、但 declaredFiles 不含该路径 ⇒ held、零写(不许把别人的暂存当落地欠账)', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-declare-')
  try {
    recordLanding({ dir, landedSha, headBefore, declaredFiles: ['other.md'] })
    const idxBefore = planIndexBlob(g)
    const r = alignLandingDebtIndex(dir)
    assert.equal(r.aligned, 0)
    assert.equal(r.held.length, 1, '对不上前像必须落 held 并点名')
    assert.equal(r.held[0].path, 'PROJECT_PLAN.md')
    assert.ok(String(r.held[0].reason).length > 0)
    assert.deepEqual(r.undetermined, [], '台账明明读到了 ⇒ 这一格不是"未判定"')
    assert.deepEqual(r.candidates, [])
    assert.equal(planIndexBlob(g), idxBefore, '索引被写')
  } finally {
    rmScratch(dir)
  }
})

test('T16 dryRun:零写(索引 blob 与执行前逐字相同),candidates 带出作证的那枚 landedSha', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-dry-')
  try {
    recordLanding({ dir, landedSha, headBefore })
    const idxBefore = planIndexBlob(g)
    const wtBefore = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    const r = alignLandingDebtIndex(dir, { dryRun: true })
    assert.equal(r.dryRun, true, 'dryRun 标志必须带出来,否则调用方分不清"预演"与"没活"')
    assert.equal(r.aligned, 0, 'dryRun 还报已对齐 = 谎报写盘')
    assert.deepEqual(r.paths, [])
    assert.equal(r.candidates.length, 1, `必须点名作证的那一枚,实得 ${JSON.stringify(r.candidates)}`)
    assert.equal(r.candidates[0].path, 'PROJECT_PLAN.md')
    assert.equal(r.candidates[0].landingSha, landedSha, '作证 sha 必须就是落地那一枚(绑不上 sha 就统计不了)')
    assert.equal(r.candidates[0].headBefore, headBefore)
    assert.equal(planIndexBlob(g), idxBefore, 'dryRun 写了索引')
    assert.equal(readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'), wtBefore, 'dryRun 写了工作树')
  } finally {
    rmScratch(dir)
  }
})

test('T17 MERGE_HEAD 让路:alignDrifts 整轮不写,返回形状必须带 landing* 全套键', () => {
  const { dir, g, headBefore, landedSha } = makeLandingDebtDrill('wt-heal-land-merge-', {
    withMerge: true,
  })
  try {
    recordLanding({ dir, landedSha, headBefore })
    const idxBefore = planIndexBlob(g)
    const r = alignDrifts(dir)
    assert.equal(
      r.mergeInProgress,
      true,
      '夹具没真造出 MERGE_HEAD ⇒ 本例什么都没判(合并中让路这一格无从取证)',
    )
    assert.equal(
      r.landingAligned,
      0,
      '合并未收口仍对齐落地欠账 = 把对侧已提交内容打回 HEAD(g-814406 同型)',
    )
    for (const k of [
      'landingAligned',
      'landingPaths',
      'landingHeld',
      'landingUndetermined',
      'landingDeferred',
      'landingCandidates',
    ]) {
      assert.ok(Object.hasOwn(r, k), `合并让路那个返回字面量里缺 ${k} ⇒ 守护读到 undefined 与读到 0 同形`)
    }
    assert.equal(planIndexBlob(g), idxBefore, '合并中索引被写')
    assert.equal(readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'), 'line-old\n', '合并中工作树被写')
    // 对照一:同一现场若无 MERGE_HEAD 那一格,判据本身成立 ⇒ 起作用的是门,不是"永远不写"
    const dry = alignLandingDebtIndex(dir, { dryRun: true })
    assert.ok(
      dry.candidates.some((c) => c.path === 'PROJECT_PLAN.md' && c.landingSha === landedSha),
      `对照不成立:落地欠账形态本身没被证明(候选=${JSON.stringify(dry.candidates)})`,
    )
    assert.equal(dry.aligned, 0)
    assert.equal(planIndexBlob(g), idxBefore, 'dryRun 对照写了索引')
    // 对照二:只摘 MERGE_HEAD 标记(--abort 会连脏索引一起复位,故不能用它),形态其余不动 ⇒ 必须对齐
    const mhRel = g(['rev-parse', '--git-path', 'MERGE_HEAD']).trim()
    rmSync(resolve(dir, mhRel), { force: true })
    const after = alignDrifts(dir)
    // 常态返回根本不带 mergeInProgress 键(只有让路那个字面量带 true)⇒ 只断"不等于 true"
    assert.notEqual(after.mergeInProgress, true, 'MERGE_HEAD 没摘干净 ⇒ 下面这句什么都没判')
    assert.equal(
      after.landingAligned,
      1,
      '没有合并标记的同一现场仍报 0 ⇒ 上一句的"0"根本不是门挡的,是夹具本来就没活',
    )
    assert.equal(planIndexBlob(g), g(['rev-parse', 'HEAD:PROJECT_PLAN.md']).trim())
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
