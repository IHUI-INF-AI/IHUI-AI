// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/lib/land-gate-rerun.mjs + object-space-land.mjs 的头注④接线(G-113)。
// 票面钉的两格:**判据真跑**(桩臂必须真被 spawn,用 marker 文件记账证明)、
// **失败臂变红**(stub rc=1 ⇒ verdict=1;e2e  ⇒ 落地器 exit 1 且 HEAD 已推进 = 不回滚)。
// 端到端一律 spawn CLI 打临时仓(§22c);git 写操作只发生在 scratch-dir 的临时仓内。

import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseGateRegistry,
  extractEntryFields,
  selectAffectedGates,
  scanDuplicateDefinitions,
  rerunAffectedGates,
} from '../lib/land-gate-rerun.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'object-space-land.mjs')
const UNION_TOOL = join(HERE, '..', 'union-converge.mjs')
const GIT = resolveGitBin() || 'git'
// stdio 显式写在调用点(不进 runOpts 底座):门 193 第 3 条只认「该次调用 options 内的 stdio 属性名」,
// 而 `{ ...runOpts }` 这种 spread 形态读不出属性名 ⇒ 判「options 内无 stdio 属性名」(2026-10-25 实测存量红)。
// 值只有这一处(底座里已删),不产生第二份真相。
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], { ...runOpts, stdio: ['ignore', 'pipe', 'pipe'] })

function makeRepo(t) {
  const dir = mkScratch('lgr-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

/** 桩门体:把收到的 argv 记进 marker,按 STUB_RC 退出(只仿传输,不仿判据,与门 98 桩契约同形)。 */
const STUB_SRC = `
import { writeFileSync } from 'node:fs'
if (process.env.STUB_MARKER) writeFileSync(process.env.STUB_MARKER, process.argv.slice(2).join(' '))
process.exit(Number(process.env.STUB_RC ?? '0'))
`
function writeStub(dir, name) {
  const p = join(dir, name)
  writeFileSync(p, STUB_SRC)
  return p
}

// ── T1 注册表解析:合成文本(多行条目/单行紧凑条目/双引号 id/注释里的花括号与引号) ──
test('T1 parseGateRegistry:三种书写形态都认,注释里的花括号不骗过扫描器', () => {
  const text = `
const checks = [
  // 注释里有 { 花括号 } 和 '引号',扫描器不得在这里失配
  {
    id: '35',
    label: '🐍 mypy 类型检查(防 ai-service Python 类型回退)',
    script: 'check-mypy.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: ['', "  💡 hint with {braces} and 'quote'", ''].join('\\n'),
  },
  { id: '207', label: 'x', script: 'check-agents-doc-size.mjs', args: ['--foo'], mode: 'blocking', skipEnv: 'HUSKY_SKIP_AGENTS_DOC_SIZE', stagedTriggers: ['AGENTS.md'] },
  {
    id: "9",
    script: "check-dbl.mjs",
    mode: "warn",
    stagedTriggers: ["apps/web/"],
  },
]
`
  const { entries, error } = parseGateRegistry(text)
  assert.equal(error, null)
  assert.equal(entries.length, 3)
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]))
  assert.equal(byId['35'].script, 'check-mypy.mjs')
  assert.deepEqual(byId['35'].stagedTriggers, [])
  assert.deepEqual(byId['207'].stagedTriggers, ['AGENTS.md'])
  assert.deepEqual(byId['207'].args, ['--foo'])
  assert.equal(byId['207'].skipEnv, 'HUSKY_SKIP_AGENTS_DOC_SIZE')
  assert.equal(byId['9'].mode, 'warn') // 双引号形态不得隐身(gate-registry-insert 头注②的教训)
})

// ── T2 形状锁:真注册表(本仓 HEAD 面取材由调用方给文本)能解析出门 35/207 ──
test('T2 parseGateRegistry:真 guardian-runner 的门 35/207 条目按字段解析出来', () => {
  const text = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const { entries, error } = parseGateRegistry(text)
  assert.equal(error, null)
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]))
  assert.ok(byId['35'], '门 35(mypy)必须在解析结果里')
  assert.equal(byId['35'].script, 'check-mypy.mjs')
  assert.ok(byId['207'], '门 207(AGENTS.md 体积)必须在解析结果里')
  assert.deepEqual(byId['207'].stagedTriggers, ['AGENTS.md'])
  assert.equal(byId['207'].mode, 'blocking')
  assert.ok(entries.length > 100, `条目数应覆盖全注册表(实测 ${entries.length})`)
})

// ── T3 路径→门映射 ──
test('T3 selectAffectedGates:触发前缀/glob 命中入选;恒跑门与 info 门不入列', () => {
  const entries = [
    { id: '35', script: 'check-mypy.mjs', mode: 'blocking', args: [], stagedTriggers: [] },
    { id: '207', script: 'check-agents-doc-size.mjs', mode: 'blocking', args: [], stagedTriggers: ['AGENTS.md'] },
    { id: '9', script: 'a.mjs', mode: 'warn', args: [], stagedTriggers: ['apps/web/'] },
    { id: '97', script: 'g.mjs', mode: 'blocking', args: [], stagedTriggers: ['apps/**/status*.tsx'] },
    { id: '100', script: 'i.mjs', mode: 'info', args: [], stagedTriggers: ['apps/'] },
  ]
  const sel = (paths) => selectAffectedGates(paths, entries).map((e) => e.id)
  assert.deepEqual(sel(['apps/web/src/x.ts']), ['9'])
  assert.deepEqual(sel(['AGENTS.md']), ['207'])
  assert.deepEqual(sel(['apps/mobile-rn/src/statusbar.tsx']), ['97']) // glob 档
  assert.ok(!sel(['apps/web/a.ts']).includes('100')) // info 门不入选
  assert.ok(!sel(['apps/ai-service/app/x.py']).includes('35')) // 恒跑门不是"路径受影响"
})

// ── T4 同名函数族简单判据(f57e0c9983 那一型) ──
test('T4 scanDuplicateDefinitions:顶层同名命中,嵌套/注释不算,ts 臂同形', () => {
  const py = [
    'def handle(x):',
    '    return x',
    'class Box:',
    '    def handle(self):',
    '        pass',
    "# def handle(: 注释行不算",
    'def handle(y):',
    '    return y',
  ].join('\n')
  const d = scanDuplicateDefinitions(py, '.py')
  assert.equal(d.length, 1)
  assert.equal(d[0].name, 'handle')
  assert.equal(d[0].lines.length, 2) // 只数顶层那两次;类内同名不算
  assert.deepEqual(scanDuplicateDefinitions('def one(x):\n    pass\n', '.py'), [])

  const ts = [
    'export function fmt(a) {',
    '  return a',
    '}',
    'export const tick = () => 1',
    'export function fmt(b) {',
    '  return b',
    '}',
    'export const tick = () => 2',
  ].join('\n')
  // 夹具里的同名声明不是定义(模板串/普通字符串):2026-10-25 实测过的假红型
  const fixtureTs = [
    "const SAMPLE = `import x from 'y'",
    'export function Dialog() {',
    '  return null',
    '}`',
    'const S2 = "export function Dialog() {"',
    'export function Dialog() { return 1 }',
  ].join('\n')
  assert.deepEqual(
    scanDuplicateDefinitions(fixtureTs, '.ts'),
    [],
    '字符串/模板串里的同名声明不得算第二份定义',
  )
  const names = scanDuplicateDefinitions(ts, '.ts').map((x) => x.name).sort()
  assert.deepEqual(names, ['fmt', 'tick'])
})

// ── T5 失败臂变红:落地面自带重复定义 ⇒ verdict=1(判 HEAD 面,不读工作树) ──
test('T5 rerunAffectedGates:落地面重复定义 ⇒ dupdef 臂红,verdict=1', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'bad.py'), 'def f(x):\n    return x\ndef f(y):\n    return y\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'landed dup family'])
  const res = rerunAffectedGates({ root: dir, paths: ['bad.py'], env: {} })
  assert.equal(res.verdict, 1)
  assert.equal(res.dupFindings.length, 1)
  assert.equal(res.dupFindings[0].name, 'f')
  assert.ok(res.failed.some((f) => f.kind === 'dupdef'))
})

// ── T6 判据真跑:桩臂真被 spawn(argv 记账),rc 三态分流 ──
test('T6 rerunAffectedGates:mypy 桩被真跑(argv 记账),rc=1/2/0 分别落 failed/undetermined/ran', (t) => {
  const dir = makeRepo(t)
  const stub = writeStub(dir, 'stub-mypy.mjs')
  const marker = join(dir, 'marker.txt')
  const run = (rc) =>
    rerunAffectedGates({
      root: dir,
      paths: ['x.py'],
      env: { LAND_GATE_RERUN_MYPY: stub, STUB_RC: String(rc), STUB_MARKER: marker },
    })
  const r1 = run(1)
  assert.ok(existsSync(marker), '桩没被 spawn ⇒ "判据真跑"这一格就是假的')
  assert.equal(r1.verdict, 1)
  assert.ok(r1.failed.some((f) => f.kind === 'mypy'))
  const r2 = run(2)
  assert.equal(r2.verdict, 2)
  assert.ok(r2.undetermined.some((f) => f.kind === 'mypy'))
  const r0 = run(0)
  assert.equal(r0.verdict, 0)
  assert.ok(r0.ran.some((f) => f.kind === 'mypy'))
})

// ── T7 注册表映射端到端:桩注册表选门、桩门体 rc=1 ⇒ 红;warn 门红不改 verdict ──
test('T7 注册表臂:stagedTriggers 命中的门真被复跑;blocking rc=1 ⇒ verdict=1,warn ⇒ 只点名', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  const stubGate = join(dir, 'scripts', 'stub-gate.mjs')
  writeFileSync(stubGate, STUB_SRC)
  const reg = join(dir, 'stub-registry.txt')
  writeFileSync(
    reg,
    `const checks = [
  { id: '900', label: 'stub blocking', script: 'stub-gate.mjs', args: ['--keep'], mode: 'blocking', stagedTriggers: ['pkg/'] },
  { id: '901', label: 'stub warn', script: 'stub-gate.mjs', args: [], mode: 'warn', stagedTriggers: ['pkg/'] },
  { id: '902', label: 'not affected', script: 'stub-gate.mjs', args: [], mode: 'blocking', stagedTriggers: ['other/'] },
]\n`,
  )
  const marker = join(dir, 'marker.txt')
  const res = rerunAffectedGates({
    root: dir,
    paths: ['pkg/readme.md'],
    env: { LAND_GATE_RERUN_REGISTRY: reg, STUB_RC: '1', STUB_MARKER: marker },
  })
  assert.equal(res.verdict, 1)
  assert.ok(res.failed.some((f) => f.kind === 'registry' && f.id === '900'))
  assert.ok(res.warnFailures.some((f) => f.id === '901'))
  assert.ok(!res.failed.some((f) => f.id === '902'))
  assert.ok(existsSync(marker), '注册表门没被 spawn ⇒ 映射就是纸上的')
  // 全绿档:rc=0 ⇒ verdict=0
  const ok = rerunAffectedGates({
    root: dir,
    paths: ['pkg/readme.md'],
    env: { LAND_GATE_RERUN_REGISTRY: reg, STUB_RC: '0', STUB_MARKER: marker },
  })
  assert.equal(ok.verdict, 0)
  assert.equal(ok.ran.filter((f) => f.kind === 'registry').length, 2)
})

// ── T8 换仓通道守卫:根不是本仓且没给桩 ⇒ 内置臂点名"未跑",不得静默读成绿 ──
test('T8 换仓通道:mypy/tsc/注册表臂点名未跑,verdict 仍 0(不是"跑过且绿"而是"本轮无判据可跑且已出声")', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'clean.py'), 'def only(x):\n    return x\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'clean'])
  const res = rerunAffectedGates({ root: dir, paths: ['clean.py'], env: {} })
  assert.equal(res.verdict, 0)
  assert.ok(res.notes.some((n) => n.includes('mypy 臂') && n.includes('未跑')))
  assert.ok(res.notes.some((n) => n.includes('注册表臂') && n.includes('未跑')))
})

// ── T9 应急出口:跳过必打留痕,不判红也不判绿 ──
test('T9 IHUI_LAND_SKIP_AFFECTED_GATES=1 ⇒ skipped,verdict=0', (t) => {
  const dir = makeRepo(t)
  const res = rerunAffectedGates({ root: dir, paths: ['bad.py'], env: { IHUI_LAND_SKIP_AFFECTED_GATES: '1' } })
  assert.equal(res.skipped, true)
  assert.equal(res.verdict, 0)
})

// ── T10 接线端到端:object-space-land 落地含重复定义族的 .py ⇒ exit 1、大声报数、**不回滚** ──
test('T10 e2e:落地器对 dupdef 失败臂 exit 1,而提交仍在 HEAD(不回滚,拒绝静默)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'svc.py'), 'def handle(x):\n    return x\ndef handle(y):\n    return y\n')
  const before = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const env = {
    ...process.env,
    LAND_ROOT: dir,
    LAND_PATHS: 'svc.py',
    LAND_MSG: 'test: 旁路落地一份带同名函数族的文件',
    IHUI_LAND_SKIP_WATERMARK: '1',
  }
  const r = spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
  const after = runGit(dir, ['rev-parse', 'HEAD']).trim()
  assert.equal(r.status, 1, `期望 exit 1,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.notEqual(after, before, '落地是既成事实:失败臂不得回滚 HEAD')
  assert.match(`${r.stderr}${r.stdout}`, /重复定义/)
  assert.match(`${r.stderr}${r.stdout}`, /不回滚/)
})

// ── T11 接线端到端正向对照:干净落地面 ⇒ exit 0 且复跑臂出声 ──
test('T11 e2e:干净落地面 ⇒ exit 0,复跑段在 stdout 出声(失败臂变红由 T10 钉,两臂不同色才是有牙)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'svc.py'), 'def handle(x):\n    return x\n')
  const env = {
    ...process.env,
    LAND_ROOT: dir,
    LAND_PATHS: 'svc.py',
    LAND_MSG: 'test: 干净落地',
    IHUI_LAND_SKIP_WATERMARK: '1',
  }
  const r = spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(r.status, 0, `期望 exit 0,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(`${r.stdout}`, /✅ 落地后受影响判据复跑/)
})

// ── T12 形状锁:接线在位(§22c 的"接了没接"用源码面钉,防止 lib 装车而调用点漂开) ──
test('T12 形状锁:object-space-land 与 union-converge 两台旁路落地器的复跑档都在(2026-10-23 闭环)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /G-113,2026-10-23/)
  assert.match(src, /rerunAffectedGates\(\{ root, paths: paths\.concat\(removePaths\) \}\)/)
  assert.match(src, /IHUI_LAND_SKIP_AFFECTED_GATES/)
  const uc = readFileSync(UNION_TOOL, 'utf8')
  assert.match(uc, /import \{ rerunAffectedGates \} from '\.\/lib\/land-gate-rerun\.mjs'/)
  assert.match(uc, /rerunAffectedGates\(\{ root: ROOT, paths: \[\.\.\.new Set\(\[\.\.\.LIVE_DOCS, \.\.\.p\.tookTheirs\]\)\] \}\)/)
})

// ── T13 锚点档:声明了 rerunAnchor 的门,复跑必须带 --rev/--anchor ──
// 病根(2026-10-27 实测,同一枚被咬两次):门 98 落地**前**那跑是带树+锚点的(只拦本枚新增),
// 落地**后**的复跑档不带锚点 ⇒ HEAD 上 16 条存量被算成本枚新增,每次旁路落地都判红一次。
// 恒红的复跑臂只会逼人设 IHUI_LAND_SKIP_AFFECTED_GATES=1(§12e),所以两跑的口径必须一致。
test('T13 rerunAnchor 门以锚点档复跑;未声明的门不得被塞锚点', (t) => {
  const dir = makeRepo(t)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'scripts', 'stub-gate.mjs'), STUB_SRC)
  const marker = join(dir, 'argv.txt')
  const regAnchored = join(dir, 'reg-anchor.txt')
  writeFileSync(
    regAnchored,
    `const checks = [
  { id: '908', label: 'stub anchored', script: 'stub-gate.mjs', args: [], mode: 'blocking', rerunAnchor: true, stagedTriggers: ['pkg/'] },
]\n`,
  )
  const env = { LAND_GATE_RERUN_REGISTRY: regAnchored, STUB_RC: '0', STUB_MARKER: marker }
  const res = rerunAffectedGates({ root: dir, paths: ['pkg/readme.md'], env })
  assert.equal(res.verdict, 0)
  const argv = readFileSync(marker, 'utf8')
  assert.match(argv, /--rev HEAD/, `锚点档必须指定被审面(实收:${argv})`)
  assert.match(argv, /--anchor HEAD\^/, `锚点必须是本枚的父,否则棘轮无基准(实收:${argv})`)

  // 反向对照:没声明能力的门不得被塞锚点(否则等于给所有门改了口径)
  const regPlain = join(dir, 'reg-plain.txt')
  writeFileSync(
    regPlain,
    `const checks = [
  { id: '909', label: 'stub plain', script: 'stub-gate.mjs', args: [], mode: 'blocking', stagedTriggers: ['pkg/'] },
]\n`,
  )
  rerunAffectedGates({ root: dir, paths: ['pkg/readme.md'], env: { ...env, LAND_GATE_RERUN_REGISTRY: regPlain } })
  const argv2 = readFileSync(marker, 'utf8')
  assert.ok(!argv2.includes('--rev'), `未声明 rerunAnchor 的门被塞了锚点:${argv2}`)

  // 真仓接线锁:门 98 在注册表里确实带了这个能力(不然改了机制而存量红照旧)
  const runner = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const e98 = runner.slice(
    runner.indexOf("script: 'check-dangling-local-imports.mjs'"),
    runner.indexOf("script: 'check-dangling-local-imports.mjs'") + 900,
  )
  assert.match(e98, /rerunAnchor:\s*true/, '注册表里没声明能力 ⇒ 本枚只是写了机制没装车')

  // 解析面单测:能力必须被读出来(真/缺省两态),且不依赖字段在条目里的书写次序
  const on = extractEntryFields("{ id: '8', script: 'a.mjs', rerunAnchor: true, mode: 'blocking' }")
  assert.equal(on.rerunAnchor, true, '解析器没读出 rerunAnchor ⇒ 装了等于没装')
  const off = extractEntryFields("{ id: '9', script: 'a.mjs', mode: 'blocking' }")
  assert.equal(off.rerunAnchor, false, '未声明的门必须读成 false,不得默认带锚点')
  // 注释里出现同名字样不得被当成声明(取材遮注释是同族事故的既有口径)
  const commented = extractEntryFields(
    "{ id: '10', script: 'a.mjs', mode: 'blocking' }\n// rerunAnchor: true 这是散文,不算声明\n",
  )
  assert.equal(commented.rerunAnchor, false, '注释里的散文被当成了能力声明')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
