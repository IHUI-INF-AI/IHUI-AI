// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/gate-registry-insert.mjs(§22c —— 判据纯函数 import + CLI 端到端打临时仓)。
// 票面要求逐条钉死:
//  4. 取号必须把 `id: "999"`(双引号形态)也算进已占用集合 —— 用夹具造一枚双引号 id,证明它取不到那个号
//     (这直接钉住 wire-gate 本轮踩的坑:双引号对一切按 `id: '(\d+)'` 解析注册表的判据隐身,含撞号检测);
//  5. 生成的块必须是单引号风格:断言落地后文件里不存在 `id: "` 形态;
//  + 锚点缺失/多处 ⇒ 拒绝凭猜插;结构等值零损失判据(禁止重复行计数)由拼接断言钉住;
//  + 写盘前 node --check 自证语法(注册表坏了 = 整条 pre-commit 中止,守门 89 R8 记过同型崩点);
//  + 端到端 happy:落地 + 回读单引号 id 行在位 + stdout 末行只打新 id。
// git 写操作只发生在 scratch-dir 临时仓内(§26 唯一夹具落点)。

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../gate-registry-insert.mjs'
import { git, headBlobOf, indexBlobOf } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'gate-registry-insert.mjs')
const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], runOpts)

const norm = (s) => s.replace(/\r\n/g, '\n')

function blockOf(id, script, { quote = "'" } = {}) {
  const q = (v) => `${quote}${v}${quote}`
  return [
    '  {',
    `    id: ${q(id)},`,
    `    label: ${q('demo-' + script)},`,
    `    script: ${q(script)},`,
    '    args: [],',
    "    mode: 'blocking',",
    `    skipEnv: ${q('DEMO_' + script.toUpperCase().replace(/[^A-Z0-9]/g, '_'))},`,
    '    stagedTriggers: [],',
    "    onFailHint: ['',].join('\\n'),",
    '  },',
  ].join('\n')
}

/** 与真 runner 同形的最小夹具:demo 块 + `// --- info (1 项) ---` 锚点 + info 块。 */
function runnerFixture({ anchors = 1, dbl = false } = {}) {
  const anchorLines = []
  for (let i = 0; i < anchors; i++) anchorLines.push('  // --- info (1 项) ---')
  return [
    'const checks = [',
    blockOf('1', 'demo.mjs'),
    ...anchorLines,
    blockOf('23', 'info.mjs'),
    dbl ? blockOf('999', 'dbl.mjs', { quote: '"' }) : '',
    ']',
    'export default checks',
    '',
  ].join('\n')
}

function makeRunnerRepo(t, fixture) {
  const dir = mkScratch('gri-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  // 夹具仓必须自带身份:runGit 的 `-c user.*` 只喂给测试自己的调用,而**被测工具**用
  // scripts/lib/bypass-git.mjs 的 git() 跑 commit-tree —— 它不带 -c,也不该带(真仓里有 local 身份)。
  // 没有这条 config,四支端到端用例会以 "Author identity unknown" 全红(本机实测:T5/T6/T9 红,
  // 而红的形态是"工具坏了"而不是"测试跑不起来",极易被误读成取号器本身不可用)。
  runGit(dir, ['config', 'user.email', 't@e2e.local'])
  runGit(dir, ['config', 'user.name', 'e2e'])
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), fixture)
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

function runGate(dir, extra = {}) {
  const env = {
    ...process.env,
    GATE_ROOT: dir,
    GATE_LABEL: extra.label ?? '🧪 测试门(样例)',
    GATE_SCRIPT: extra.script ?? 'check-e2e-gate.mjs',
    GATE_SKIP_ENV: extra.skipEnv ?? 'HUSKY_SKIP_E2E_GATE',
    GATE_SECTION: extra.section ?? '测试门',
    GATE_MSG: extra.msg ?? 'feat(gates): e2e insert',
  }
  for (const k of ['GATE_LABEL', 'GATE_SCRIPT', 'GATE_SKIP_ENV', 'GATE_TRIGGERS', 'GATE_HINT']) {
    if (extra[k] === null) delete env[k]
  }
  if (extra.triggers) env.GATE_TRIGGERS = extra.triggers
  if (extra.hint) env.GATE_HINT = extra.hint
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

test('T1 §22c 导出面:取号/块生成/结构拼接/语法自证都在 __test__ 里', () => {
  for (const k of ['jsQ', 'nextIdOf', 'buildEntry', 'spliceInto', 'checkSyntax', 'readGateArgs']) {
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  }
})

test('T2 取号必须同时认单/双引号 id 形态(钉住 wire-gate 实测坑:双引号对按单引号解析的判据隐身)', () => {
  const singleOnly = "id: '1',\nid: '23',\n"
  assert.equal(__test__.nextIdOf(singleOnly).nextId, '24')
  const withDouble = "id: '1',\nid: \"999\",\nid: '23',\n"
  const r = __test__.nextIdOf(withDouble)
  assert.equal(r.nextId, '1000', '双引号 999 必须算已占用 ⇒ 绝不取 999,而是 1000')
  assert.equal(r.used, 3)
})

test('T3 jsQ 单引号风格与转义:内部单引号/反斜杠被转义,绝不产出双引号字面量', () => {
  assert.equal(__test__.jsQ("it's"), `'it\\'s'`)
  assert.equal(__test__.jsQ('a\\b'), `'a\\\\b'`)
  assert.ok(!__test__.jsQ('x').startsWith('"'))
})

test('T4 spliceInto 纯函数:锚点 0 处 / 2 处都拒绝;恰好 1 处时前后缀逐字不动', () => {
  const base = ['const checks = [', blockOf('1', 'demo.mjs'), '  // --- info (1 项) ---', blockOf('23', 'info.mjs'), ']', ''].join('\n').split('\n')
  const entry = __test__.buildEntry({ id: '24', section: '测试门', label: 'L', script: 's.mjs', skipEnv: 'S' })
  const a0 = __test__.spliceInto(base.filter((l) => !l.includes('--- info')), entry)
  assert.equal(a0.ok, false)
  assert.equal(a0.reason, 'no-anchor')
  const a2 = __test__.spliceInto([...base, '  // --- info (1 项) ---'], entry)
  assert.equal(a2.ok, false)
  assert.match(a2.reason, /multi-anchor/)
  const a1 = __test__.spliceInto(base, entry)
  assert.equal(a1.ok, true)
  assert.deepEqual(a1.next.slice(0, a1.anchorAt), base.slice(0, a1.anchorAt), '前缀逐字不动')
  assert.deepEqual(a1.next.slice(a1.anchorAt + entry.length), base.slice(a1.anchorAt), '后缀逐字不动')
  assert.ok(a1.next.some((l) => l === `    id: '24',`))
  assert.ok(!a1.next.some((l) => l.includes('id: "')), '生成块不得含双引号 id')
})

test('T5 端到端 happy:落地后单引号 id 行在位、无 `id: "` 残留、node --check 通过、主索引对齐、stdout 末行是 id', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runGate(dir, {})
  assert.equal(r.status, 0, `${r.stdout}|${r.stderr}`)
  assert.match(r.stdout, /第 1 次 CAS 成功 id=24/)
  assert.match(r.stdout, /回读:id 行单引号在位 1 处/)
  assert.match(r.stdout, /主索引已对齐 1\/1/)
  assert.equal(r.stdout.trim().split('\n').at(-1), '24', '末行必须只打新 id(供接力取号)')
  const now = norm(git(['show', 'HEAD:scripts/guardian-runner.mjs'], { root: dir, raw: true }))
  assert.equal(now.split('\n').filter((l) => l === "    id: '24',").length, 1)
  assert.ok(now.includes("    script: 'check-e2e-gate.mjs',"))
  assert.equal(now.split('\n').filter((l) => l.includes('id: "')).length, 0)
  const scratch = mkScratch('gri-check-')
  t.after(() => rmScratch(scratch))
  const f = join(scratch, 'head-runner.mjs')
  writeFileSync(f, now, 'utf8')
  assert.equal(__test__.checkSyntax(f).ok, true, 'HEAD 版注册表必须可被 node 解析')
  assert.equal(indexBlobOf('scripts/guardian-runner.mjs', { root: dir }), headBlobOf('HEAD', 'scripts/guardian-runner.mjs', { root: dir }))
  assert.notEqual(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T6 端到端·双引号占用号不得被复取:夹具含 id: "999" ⇒ 新号 1000,且原双引号行原样保留', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture({ dbl: true }))
  const r = runGate(dir, {})
  assert.equal(r.status, 0, `${r.stdout}|${r.stderr}`)
  assert.equal(r.stdout.trim().split('\n').at(-1), '1000')
  const now = norm(git(['show', 'HEAD:scripts/guardian-runner.mjs'], { root: dir, raw: true }))
  assert.ok(now.split('\n').some((l) => l === `    id: '1000',`), '新块须为单引号 1000')
  assert.ok(now.includes(`    id: "999",`), '夹具里那双引号行不是我写的,不得被我顺手改写')
})

test('T7 端到端·锚点缺失 ⇒ 拒绝(结构已漂不猜);锚点两处 ⇒ 同样拒绝', (t) => {
  const d1 = makeRunnerRepo(t, runnerFixture({ anchors: 0 }))
  const head1 = git(['rev-parse', 'HEAD'], { root: d1 })
  const r1 = runGate(d1, {})
  assert.equal(r1.status, 1)
  assert.match(r1.stderr, /找不到 info 段锚点/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: d1 }), head1, '拒绝路径 HEAD 不动')
  const d2 = makeRunnerRepo(t, runnerFixture({ anchors: 2 }))
  const head2 = git(['rev-parse', 'HEAD'], { root: d2 })
  const r2 = runGate(d2, {})
  assert.equal(r2.status, 1)
  assert.match(r2.stderr, /不止一处/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: d2 }), head2)
})

test('T8 用法错误 ⇒ exit 2:缺 GATE_SCRIPT / 缺 LABEL / 缺 SKIP_ENV 各一支', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const head = git(['rev-parse', 'HEAD'], { root: dir })
  const cases = [
    { GATE_LABEL: 'L', GATE_SCRIPT: '', GATE_SKIP_ENV: 'S' },
    { GATE_LABEL: '', GATE_SCRIPT: 's.mjs', GATE_SKIP_ENV: 'S' },
    { GATE_LABEL: 'L', GATE_SCRIPT: 's.mjs', GATE_SKIP_ENV: '' },
  ]
  for (const c of cases) {
    const r = spawnSync(process.execPath, [TOOL], {
      env: { ...process.env, GATE_ROOT: dir, ...c, GATE_MSG: 'm' },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 64 << 20,
    })
    assert.equal(r.status, 2, `${JSON.stringify(c)} 缺失必填必须 exit 2:${r.stderr}`)
    assert.match(r.stderr, /GATE_LABEL|GATE_SCRIPT|GATE_SKIP_ENV/)
  }
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), head, '用法错误路径 HEAD 不动')
})

test('T9 label 含单引号不得砸语法:写盘前 node --check 自证生效(转义正确或拒绝落地,二选一,不许产出坏注册表)', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const r = runGate(dir, { label: "拦「it's」型 —— 撇号与反斜杠 C:\\path 都要活下来" })
  assert.equal(r.status, 0, `${r.stdout}|${r.stderr}`)
  const now = norm(git(['show', 'HEAD:scripts/guardian-runner.mjs'], { root: dir, raw: true }))
  const scratch = mkScratch('gri-esc-')
  t.after(() => rmScratch(scratch))
  const f = join(scratch, 'head-runner.mjs')
  writeFileSync(f, now, 'utf8')
  assert.equal(__test__.checkSyntax(f).ok, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T10 同一道门不得注册两次:script 已在表里 ⇒ exit 1 并点名现有 id,注册表逐字不动', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const before = norm(runGit(dir, ['show', 'HEAD:scripts/guardian-runner.mjs']))
  const r = runGate(dir, { script: 'demo.mjs', msg: 'feat(gates): 不该落地' })
  assert.equal(r.status, 1, `重复注册必须被拒,实得 status=${r.status} out=${r.stdout} err=${r.stderr}`)
  assert.match(r.stderr, /已在注册表/, '拒绝理由要点名"已注册"这一型')
  assert.match(r.stderr, /demo\.mjs/, '要点名是哪个 script')
  assert.match(r.stderr, /id: '1'/, '要给出已有条目的 id,便于直接改那一块而不是再插一块')
  assert.equal(
    norm(runGit(dir, ['show', 'HEAD:scripts/guardian-runner.mjs'])),
    before,
    '拒绝路径不得留下任何注册表改动',
  )
  // 阳性对照:判据不是一律拒绝 —— 没注册过的 script 照旧落地(与 T5 同一条链,这里只验没被本判据误伤)
  const ok = runGate(dir, { script: 'check-brand-new-gate.mjs', msg: 'feat(gates): 新门落地' })
  assert.equal(ok.status, 0, `未注册过的 script 必须仍能插入:err=${ok.stderr}`)
  assert.match(
    norm(runGit(dir, ['show', 'HEAD:scripts/guardian-runner.mjs'])),
    /script: 'check-brand-new-gate\.mjs',/,
  )
})
