// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「子代理派生点权限档继承对账」(§22c —— 直接 import 源模块,不复制判据实现)
//
// 钉这几件事:
//  1. §22c 装载:源模块必须 export `__test__`,且判据所需的纯函数都在内(本测试只 import,不抄实现);
//  2. **装车前置**:本门按任务书不由实现票接线(注册表由主会话单写)。因此
//     未注册 ⇒ 通过并如实点名"待接线";一旦出现在 runner 里,必须同时是 blocking + 真实 skipEnv,
//     且编号在整份 runner 里唯一(撞号会串 skipEnv 与失败归属 —— 仓里踩过);
//  3. 端到端**有牙**:临时仓里给派生面加一处未下传 ⇒ --staged 必红并点名文件;补上继承 ⇒ 必绿。
//     这两臂构成变异对照:如果判据其实恒绿,第二臂不可能变绿;如果判据恒红,第一臂不可能"只"红一处;
//  4. 零容忍面:P1 的字面量默认档在**全量面**也判红(不像 P2 那样被 HEAD 自身锚点放过);
//  5. 反假绿:扫不到候选 ⇒ exit 2「无法判定」,绝不表现为 exit 0 的绿;
//  6. 取材口径:--staged 判索引、--worktree 与 --staged 同给判死、HEAD 面取不到内容 ⇒ exit 2。
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ } from '../check-subagent-permission-inherited.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARD = join(REPO, 'scripts', 'check-subagent-permission-inherited.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SCRIPT_NAME = 'check-subagent-permission-inherited.mjs'
const SKIP_ENV = 'HUSKY_SKIP_SUBAGENT_PERMISSION_INHERITED'
const GIT = resolveGitBin() || 'git'
const GIT_TIMEOUT = 120000
const gitOpts = { encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT, maxBuffer: 64 << 20 }
const runGit = (dir, args) => execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], gitOpts)
const runGuard = (dir, extra = []) =>
  spawnSync(process.execPath, [GUARD, '--root', dir, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 64 << 20,
  })

/** 派生面文件(路径含 subagent)——内容故意漏掉两个必传键 */
const BAD_SPAWN = "const ctx = await setupAgentTools({ workspacePath: p, silent: true })\n"
const GOOD_SPAWN =
  "const ctx = await setupAgentTools({ workspacePath: p, permissionMode: parent.permissionMode, permissions: parent.permissions })\n"
const LITERAL_BYPASS = "const mode = opts.permissionMode ?? 'bypassPermissions'\n" + BAD_SPAWN

function commit(dir, msg) {
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', msg])
}

function makeRepo(t, spawnSrc = BAD_SPAWN) {
  const dir = mkScratch('subagent-perm-inherit-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'apps/cli/src/tools'), { recursive: true })
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), spawnSrc)
  writeFileSync(join(dir, 'package.json'), '{ "name": "e2e" }\n')
  runGit(dir, ['add', '-A'])
  commit(dir, 'init')
  return dir
}

/** 只在测试内做的注册表解析(不是判据实现的副本,是"装车"检查) */
function registrationOf(text, scriptName) {
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`script: '${scriptName}'`)) continue
    const block = lines.slice(Math.max(0, i - 12), i + 12).join('\n')
    hits.push({
      id: /id:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      mode: /mode:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      skipEnv: /skipEnv:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      line: i + 1,
    })
  }
  return hits
}

test('1 §22c 装载:源模块导出判据所需纯函数,测试不复制实现', () => {
  for (const k of ['maskComments', 'maskStrings', 'identifiersOnly', 'matchParen', 'findSpawnCalls', 'blankCallArgs', 'inSpawnFace', 'exempted', 'scanFile', 'decide', 'filterCandidates'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  assert.deepEqual([...__test__.REQUIRED_KEYS], ['permissionMode', 'permissions'])
})

test('2 装车前置:未注册时通过并点名待接线;注册后必须 blocking + skipEnv + 编号唯一', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const hits = registrationOf(runner, SCRIPT_NAME)
  if (hits.length === 0) {
    // 本门由主会话统一接线(任务书禁止实现票改注册表)。这一臂不是"门不存在",
    // 而是"门存在但还没人调度"—— 与 §12e 的"造好没装车"同型,故必须在报告里点名。
    assert.ok(!runner.includes(SCRIPT_NAME), 'runner 里出现了脚本名却没解析出注册块(写法漂移,判据会瞎)')
    return
  }
  assert.equal(hits.length, 1, `本门在 runner 里登记了 ${hits.length} 次(撞号会串 skipEnv 与失败归属)`)
  const allIds = [...runner.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(allIds.filter((x) => x === hits[0].id).length, 1, `编号 ${hits[0].id} 被两道门共用`)
  assert.equal(hits[0].mode, 'blocking', '本门必须 blocking 才拦得住新增的绕过点')
  assert.equal(hits[0].skipEnv, SKIP_ENV, 'skipEnv 必须与脚本自读的变量名一致')
})

test('3 全量面(HEAD):存量未下传走棘轮,不得把无关提交钉红', (t) => {
  const dir = makeRepo(t)
  const r = runGuard(dir)
  assert.equal(r.status, 0, `HEAD 自身就是这一份 ⇒ 存量只报数:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /存量/)
})

test('4 --staged 有牙:加回一处未下传 ⇒ exit 1 并点名文件', (t) => {
  const dir = makeRepo(t, GOOD_SPAWN)
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), GOOD_SPAWN + BAD_SPAWN)
  runGit(dir, ['add', '-A'])
  const r = runGuard(dir, ['--staged'])
  assert.equal(r.status, 1, `应当判红:${r.stdout}${r.stderr}`)
  assert.match(r.stdout + r.stderr, /apps\/cli\/src\/tools\/subagent\.ts/)
  assert.match(r.stdout + r.stderr, /未下传 permissionMode/)
})

test('5 变异对照的反臂:把继承补上 ⇒ 同一仓同一面立刻变绿', (t) => {
  const dir = makeRepo(t, GOOD_SPAWN)
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), GOOD_SPAWN + BAD_SPAWN)
  runGit(dir, ['add', '-A'])
  assert.equal(runGuard(dir, ['--staged']).status, 1, '前置条件:第 4 臂的红必须能在这里复现')
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), GOOD_SPAWN)
  runGit(dir, ['add', '-A'])
  const ok = runGuard(dir, ['--staged'])
  assert.equal(ok.status, 0, `补齐继承后必须绿:${ok.stdout}${ok.stderr}`)
})

test('6 零容忍面:字面量 bypassPermissions 默认档在全量面也判红(不吃 HEAD 棘轮)', (t) => {
  const dir = makeRepo(t, LITERAL_BYPASS)
  const r = runGuard(dir)
  assert.equal(r.status, 1, `P1 必须即时判红:${r.stdout}${r.stderr}`)
  assert.match(r.stdout + r.stderr, /P1 .*bypassPermissions/)
})

test('7 半个继承:接口里声明了 permissions 却没喂进构造调用 ⇒ 全量面也判红(P3)', (t) => {
  // 关键:P2 在这份文件里同样命中,但全量面的锚点 = 该文件 HEAD 自身计数 ⇒ P2 只报数。
  // 于是"这一枚红"只可能来自 P3 —— 这条断言因此真能证明 P3 有牙,而不是顺带红。
  const src =
    'interface Parent { permissions?: Rules }\n' +
    'const ctx = await setupAgentTools({ workspacePath: p, permissionMode: parent.permissionMode })\n'
  const dir = makeRepo(t, src)
  const r = runGuard(dir)
  assert.equal(r.status, 1, `P3 必须判红:${r.stdout}${r.stderr}`)
  assert.match(r.stdout + r.stderr, /半个继承/)
})

test('8 反假绿:扫不到候选文件 ⇒ exit 2「无法判定」,不得记绿', (t) => {
  const dir = mkScratch('subagent-perm-empty-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'apps/api/src'), { recursive: true })
  writeFileSync(join(dir, 'apps/api/src/x.ts'), 'export const a = 1\n')
  writeFileSync(join(dir, 'package.json'), '{ "name": "e2e" }\n')
  runGit(dir, ['add', '-A'])
  commit(dir, 'init')
  const r = runGuard(dir)
  assert.equal(r.status, 2, `空扫必须 exit 2:${r.stdout}${r.stderr}`)
  assert.match(r.stderr, /无法判定/)
})

test('9 取材口径:--staged 与 --worktree 同给 ⇒ 判死(exit 2)', (t) => {
  const dir = makeRepo(t)
  const r = runGuard(dir, ['--staged', '--worktree'])
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stderr, /不得同用/)
})

test('10 索引面与磁盘面分开判:索引坏而盘上好 ⇒ --staged 仍判红(盘上随后改对不算修好)', (t) => {
  const dir = makeRepo(t, GOOD_SPAWN)
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), GOOD_SPAWN + BAD_SPAWN)
  runGit(dir, ['add', '-A'])
  // 只在工作树修好,不再度 add ⇒ 索引仍是坏的那一份
  writeFileSync(join(dir, 'apps/cli/src/tools/subagent.ts'), GOOD_SPAWN)
  const r = runGuard(dir, ['--staged'])
  assert.equal(r.status, 1, `索引这一份才是被提交进去的内容:${r.stdout}${r.stderr}`)
})

test('11 判据字面量都在门源码里(预筛是判据的严格超集,漏一条该门对该形态全盲)', () => {
  const src = readFileSync(GUARD, 'utf8')
  for (const lit of ["bypassPermissions", 'permissionMode', 'permissions', 'setupAgentTools', 'runAgent', 'createSubagentTool', 'subagentParent'])
    assert.ok(src.includes(`'${lit}'`) || src.includes(`"${lit}"`) || src.includes(lit), `门里没有判据字面量 ${lit}`)
  assert.ok(src.includes(`'${SKIP_ENV}'`.slice(0, SKIP_ENV.length)) || src.includes(SKIP_ENV), '门里没有自读应急跳过变量')
})

test('12 自检可连跑两次且结论一致(只能跑一次的取证等于没取证)', () => {
  const a = spawnSync(process.execPath, [GUARD, '--self-test'], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 32 << 20 })
  const b = spawnSync(process.execPath, [GUARD, '--self-test'], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 32 << 20 })
  assert.equal(a.status, 0, a.stdout + a.stderr)
  assert.equal(b.status, 0, b.stdout + b.stderr)
  assert.equal(a.stdout, b.stdout, '两次自检输出必须逐字相同')
  assert.match(a.stdout, /失败 0 条/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
