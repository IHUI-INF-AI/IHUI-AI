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
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../heal-worktree-tracked.mjs'

const { restoreBypassOrphans, alignDrifts } = __test__
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
  return spawnSync(process.execPath, [scriptPath, ...args], {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
