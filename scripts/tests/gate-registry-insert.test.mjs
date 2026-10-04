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
//  2026-09-27 追加(GATE_MODE 缺口,三条方向成对 + 一条源码反向锁):
//  (a) T11 带 GATE_MODE=warn ⇒ 落地条目定级真是 warn(缺省档对照同批跑,证明不是"一律读成 warn");
//  (b) T12 不带 GATE_MODE ⇒ 整块与**改动前原文逐字同形**(期望值是手写字面块,不借 buildEntry 自证);
//  (c) T13 值域外 ⇒ exit 1 + 点名收到的值与值域 + 注册表/HEAD 分毫未动;空串在纯函数层钉
//      (CLI 传空串在 Windows 上可能等于"未设",拿它当端到端判据会测出一个假绿);
//  + T14 源码级反向锁:mode 行不得再是写死的字面量,且值域 {blocking, warn} 全仓只许写在一处。
// git 写操作只发生在 scratch-dir 临时仓内(§26 唯一夹具落点)。

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
const runOpts = { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
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
  // 定级必须由用例**显式**给:先无条件删掉从父进程继承来的 GATE_MODE —— 否则"未设"这一档
  // (T12 = 既有行为逐字不变的证明)会被某一次恰好设了该 env 的外层会话读成 warn 档。
  delete env.GATE_MODE
  if (typeof extra.GATE_MODE === 'string') env.GATE_MODE = extra.GATE_MODE
  if (extra.triggers) env.GATE_TRIGGERS = extra.triggers
  if (extra.hint) env.GATE_HINT = extra.hint
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return spawnSync(process.execPath, [TOOL], { stdio: ['ignore', 'pipe', 'pipe'], env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
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

/**
 * 落地块里"该条目自己的定级行"的定位:runner 的字段顺序固定是 script → args → mode → skipEnv,
 * 所以从 script 行往下两行就是这一条目的 mode 行。夹具里另有别人的 blocking 块 ⇒ 只认这一条。
 */
function landedModeLine(dir, script) {
  const now = norm(git(['show', 'HEAD:scripts/guardian-runner.mjs'], { root: dir, raw: true })).split('\n')
  const at = now.findIndex((l) => l.trim() === `script: '${script}',`)
  assert.ok(at >= 0, `落地内容里找不到该条目的 script 行(${script})`)
  assert.equal(now[at + 1], '    args: [],', '字段顺序漂了(本判据依赖 script→args→mode→skipEnv)')
  const m = /^\s{4}mode: '([^']*)',$/.exec(now[at + 2] ?? '')
  assert.ok(m, `mode 行形态不是 4 空格 + 单引号:${JSON.stringify(now[at + 2])}`)
  return { mode: m[1], skipEnvLine: now[at + 3], lines: now }
}

test('T11 (a) GATE_MODE=warn ⇒ 落地条目 mode: warn,skipEnv 与非单引号 id 反查照旧成立', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const r = runGate(dir, { GATE_MODE: 'warn', msg: 'feat(gates): warn 档落地' })
  assert.equal(r.status, 0, `warn 档必须能落地(这正是本票要的出口):${r.stdout}|${r.stderr}`)
  const got = landedModeLine(dir, 'check-e2e-gate.mjs')
  assert.equal(got.mode, 'warn', '所选定级必须原样落进注册块')
  assert.ok(__test__.GATE_MODES.includes(got.mode), '落地值必须落在同一份值域里(不得在测试里另抄 {blocking,warn})')
  assert.equal(got.skipEnvLine, "    skipEnv: 'HUSKY_SKIP_E2E_GATE',", 'skipEnv 仍非空且仍是单引号形态')
  const now = got.lines.join('\n')
  assert.equal(now.split('\n').filter((l) => l === "    id: '24',").length, 1, 'id 仍必须是单引号形态且在位 1 处')
  assert.equal(
    now.split('\n').filter((l) => l.includes('id: "')).length,
    0,
    'warn 档不得顺手产出双引号 id',
  )
  // 阳性对照:同一支夹具不带 GATE_MODE 时仍是 blocking ⇒ 本用例的红不是"任何条目都读成 warn"
  const dir2 = makeRunnerRepo(t, runnerFixture())
  const r2 = runGate(dir2, { script: 'check-e2e-gate2.mjs', msg: 'feat(gates): 缺省档对照' })
  assert.equal(r2.status, 0, `${r2.stdout}|${r2.stderr}`)
  assert.equal(landedModeLine(dir2, 'check-e2e-gate2.mjs').mode, 'blocking', '缺省档对照必须是 blocking')
})

test('T12 (b) 不带 GATE_MODE ⇒ 产物与改动前逐字同形(整块按字面预期比对,不借实现自证)', (t) => {
  // 这一段是**改动前**该工具对同一组 env 产出的原文(手写期望值,刻意不调 buildEntry —— 用实现验实现就是恒绿断言)
  const EXPECTED_BLOCK_BEFORE_CHANGE = [
    '  // --- 测试门(1 项,blocking)---',
    '  {',
    "    id: '24',",
    '    label:',
    "      '🧪 测试门(样例)',",
    "    script: 'check-e2e-gate.mjs',",
    '    args: [],',
    "    mode: 'blocking',",
    "    skipEnv: 'HUSKY_SKIP_E2E_GATE',",
    // 这一行(原 `stagedTriggers: [],`)被 2026-09-28 的 R8 收口**摘掉**:空数组交给
    // scripts/lib/guardian-triggers.mjs 归一时当场抛错,而 runner 的 for (const check of effectiveChecks)
    // 没有 catch ⇒ 整条 pre-commit 中止。本块因此**故意不等于**该工具改动前的原文 ——
    // 留这一句是为了让下一个人知道"逐字同形"这条断言在哪一格被有意放宽过,以及为什么。
    '    onFailHint: [',
    "      '',",
    "      '',",
    "    ].join('\\n'),",
    '  },',
    '',
  ].join('\n')
  const dir = makeRunnerRepo(t, runnerFixture())
  const r = runGate(dir, {})
  assert.equal(r.status, 0, `${r.stdout}|${r.stderr}`)
  const now = norm(git(['show', 'HEAD:scripts/guardian-runner.mjs'], { root: dir, raw: true }))
  assert.ok(now.includes(EXPECTED_BLOCK_BEFORE_CHANGE), '缺省档整块必须与改动前逐字同形(比对方式=字面块 includes)')
  // 纯函数层再钉一次:mode 形参的默认值 == DEFAULT_GATE_MODE,传与不传逐字等值
  const args = { id: '24', section: '测试门', label: '🧪 测试门(样例)', script: 'check-e2e-gate.mjs', skipEnv: 'HUSKY_SKIP_E2E_GATE' }
  assert.deepEqual(
    __test__.buildEntry(args),
    __test__.buildEntry({ ...args, mode: __test__.DEFAULT_GATE_MODE }),
    'buildEntry 缺省定级必须等于 DEFAULT_GATE_MODE',
  )
  assert.deepEqual(
    __test__.buildEntry(args).join('\n'),
    EXPECTED_BLOCK_BEFORE_CHANGE,
    '纯函数产出与字面预期逐字等值(历史调用方与既有断言语义不变)',
  )
})

test('T13 (c) GATE_MODE 值域外 ⇒ exit 1 并点名收到的值;拒绝路径注册表逐字不动、HEAD 不动', (t) => {
  const dir = makeRunnerRepo(t, runnerFixture())
  const before = norm(runGit(dir, ['show', 'HEAD:scripts/guardian-runner.mjs']))
  const head = git(['rev-parse', 'HEAD'], { root: dir })
  for (const bad of ['warn-only', 'Warn', 'error', 'BLOCKING', 'warn ', '  ']) {
    const r = runGate(dir, { GATE_MODE: bad, msg: 'feat(gates): 不该落地' })
    assert.equal(r.status, 1, `${JSON.stringify(bad)} 必须走业务拒绝(1),实得 status=${r.status} out=${r.stdout} err=${r.stderr}`)
    assert.match(r.stderr, /GATE_MODE/, `拒绝理由要点名是哪个 env:${r.stderr}`)
    assert.ok(r.stderr.includes(JSON.stringify(bad)), `拒绝理由必须原样点名收到的值 ${JSON.stringify(bad)}:${r.stderr}`)
    assert.match(r.stderr, /blocking \| warn/, '要点名允许值域,好让人不改判据就能自助修复')
    assert.equal(norm(runGit(dir, ['show', 'HEAD:scripts/guardian-runner.mjs'])), before, '拒绝不得留下任何注册表改动')
    assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), head, '拒绝路径 HEAD 不动')
  }
  // 空串在纯函数层钉:CLI 传空串在 Windows 上可能等于"未设",拿它当端到端判据会测出一个假绿
  assert.equal(typeof __test__.normalizeGateMode('').error, 'string', '空串必须算非法(设了却没落在值域内)')
  assert.match(__test__.normalizeGateMode('').error, /""/, 'error 消息要点名空串本身')
  // 反向锁:非法值绝不静默回落缺省档(那等于把"没判"写成"判过了")
  for (const good of __test__.GATE_MODES) {
    assert.deepEqual(__test__.normalizeGateMode(good), { mode: good })
  }
  assert.deepEqual(__test__.normalizeGateMode(undefined), { mode: __test__.DEFAULT_GATE_MODE })
  // 阳性对照:合法值照旧放行,证明判据不是一律拒绝
  const ok = runGate(dir, { GATE_MODE: 'warn', script: 'check-brand-ok-gate.mjs', msg: 'feat(gates): 合法定级照旧落' })
  assert.equal(ok.status, 0, `合法定级必须仍能插入:err=${ok.stderr}`)
})

test('T14 源码级反向锁:mode 行不得再是写死的字面量,必须由变量经 jsQ 生成(§22c 镜像锁同族)', () => {
  const src = norm(readFileSync(TOOL, 'utf8'))
  assert.ok(
    !/['"`] {4}mode: '(?:blocking|warn)',/.test(src),
    '注册块的定级行又变回字符串字面量 ⇒ warn 档永远产不出,调用方只能绕过唯一出口手改注册表(= 替别人卸闸)',
  )
  assert.match(src, /mode:\s*\$\{[^}]*mode[^}]*\}/, '定级行必须由变量生成')
  const domainLines = src.split('\n').filter((l) => l.includes("'blocking'") && l.includes("'warn'"))
  assert.equal(domainLines.length, 1, `值域 {blocking, warn} 只许写在一处(GATE_MODES),实测 ${domainLines.length} 处:${domainLines}`)
  assert.match(domainLines[0], /export const GATE_MODES/, '那一处必须是导出的 GATE_MODES,供测试复用而不是被测试重抄')
})

test('T15 (d) 没有 triggers 就整个键都不写 —— 空数组会让归一层当场抛错,一次抛错 = 整条 pre-commit 中止(守门 89 的 R8)', () => {
  const args = { id: '24', section: '测试门', label: '🧪 测试门(样例)', script: 'check-e2e-gate.mjs', skipEnv: 'HUSKY_SKIP_E2E_GATE' }
  const without = __test__.buildEntry(args).join('\n')
  assert.ok(!without.includes('stagedTriggers'), '缺省(无 triggers)必须整个键都不写,而不是写一个 []')
  const withT = __test__.buildEntry({ ...args, triggers: ['apps/web/src/', 'packages/'] }).join('\n')
  assert.ok(
    withT.includes("    stagedTriggers: ['apps/web/src/', 'packages/'],"),
    `有 triggers 时必须照旧逐条写出(本锁不许把另一头一起关掉)。实得:\n${withT}`,
  )
})

test('T16 源码级反向锁:注册器不得再产出 `stagedTriggers: [],` 这个字面量(R8 那一崩点的形状防线)', () => {
  const src = norm(readFileSync(TOOL, 'utf8'))
  assert.ok(
    !/ {4}stagedTriggers: \[\],/.test(src),
    '空数组形态回来 = 下一次"不带 triggers 的注册"又会把整条 pre-commit 弄崩(runner 的 for 循环没有 catch)',
  )
})
