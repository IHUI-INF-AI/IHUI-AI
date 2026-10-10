// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:G-1117435 —— mypy 守门那条"覆盖面"提示必须自己说清讲的是哪些文件。
/* eslint-disable no-console -- 测试夹具脚本,诊断信息走 console */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { maskComments } from '../lib/code-mask.mjs'
// §22c:判据从门自己的导出取,测试里**不得再抄一份**(抄了就只会复读实现)。
import { __test__ as gate } from '../check-mypy.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..')
const SOURCE_SCRIPT = join(SCRIPTS_DIR, 'check-mypy.mjs')
const P = 'apps/ai-service/'
const app = (...segs) => `${P}app/${segs.join('/')}`

// ─── 端到端夹具(演练仓 + stub mypy):走门的**入口**,不是内部函数 ───
// stub 按动词分流(--version 探测必须先过,否则门会走"环境缺失放行"分支,夹具语义就窄于真引擎)。
const STUB_SRC = [
  'const e = process.env',
  'const a = process.argv.slice(2)',
  "if (a.includes('--version')) {",
  "  console.log(e.STUB_MYPY_VERSION_OUT || 'mypy 9.9.9 (stub)')",
  "  process.exit(parseInt(e.STUB_MYPY_VERSION_EXIT || '0', 10))",
  '}',
  "console.log(e.STUB_MYPY_OUT || 'Success: no issues found in 1 source file')",
  "process.exit(parseInt(e.STUB_MYPY_EXIT || '0', 10))",
].join('\n')

function createTempRepo() {
  const dir = mkScratch('ihui-mypy-cov-')
  for (const c of [
    'git init -b main',
    'git config user.email test@test.com',
    'git config user.name test',
    'git config commit.gpgsign false',
  ]) {
    execSync(c, { cwd: dir, /* 不吃的子进程必须给 stdio,否则本机报 spawnSync git EBUSY(AGENTS §12g) */ stdio: 'ignore' })
  }
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 整条相对 import 闭包都要拷:**按名字手列依赖必然晚一拍**(scratch-module-closure 头注记过两次同型)
  copyScriptWithClosure(SCRIPTS_DIR, 'check-mypy.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/scratch-dir.mjs',
    'lib/gitdir.mjs',
  ])
  const binDir = join(dir, '.stub-bin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(binDir, 'mypy.cmd'), '@echo off\r\nnode "%~dp0mypy-stub.js" %*\r\nexit /b %errorlevel%\r\n')
  writeFileSync(join(binDir, 'mypy-stub.js'), STUB_SRC)
  writeFileSync(join(dir, '.gitignore'), '.stub-bin/\n')
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md .gitignore', { cwd: dir, stdio: 'ignore' })
  execSync('git commit -m init -q', { cwd: dir, stdio: 'ignore' })
  return dir
}

function commitFile(dir, relPath, content = 'x: int = 1\n') {
  const full = join(dir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  execSync(`git add "${relPath}"`, { cwd: dir, stdio: 'ignore' })
  execSync('git commit -m feat-fixture -q', { cwd: dir, stdio: 'ignore' })
}

function runScript(dir, env = {}) {
  const r = spawnSync('node', [join(dir, 'scripts', 'check-mypy.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, '.stub-bin')};${process.env.PATH || ''}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300000,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

const COUNT_ONLY = '计数口径不等但差集为空'
const MISSING = '漏物化点名'

// ─── T1 端到端:被同名包目录占位的形态 ⇒ 提示必须切文案并点名,不得喊漏检 ───
test('T1 端到端:pkg-dir 占位 ⇒ exit 0 + 「计数口径不等但差集为空」+ 点名该文件,绝不喊漏物化', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, app('__init__.py'))
    commitFile(dir, app('services', 'sandbox.py'))
    commitFile(dir, app('services', 'sandbox', 'models.py'))
    // 面内 app/ 下 .py = 3(sandbox.py 不占 BuildSource)⇒ stub 如实回 2,与真 mypy 同口径
    const r = runScript(dir, { STUB_MYPY_OUT: 'Success: no issues found in 2 source files' })
    assert.equal(r.status, 0, `口径差不判红,退出码语义未变\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /✅/, '仍须出具通过结论')
    assert.match(r.out, /判定面=HEAD blob\(物化后判定\)/, '取材口径不得漂成工作树')
    assert.ok(r.out.includes(COUNT_ONLY), `必须切到「计数口径不等但差集为空」这一档\nstdout: ${r.out}`)
    assert.ok(r.out.includes(app('services', 'sandbox.py')), `必须逐条点名是哪些文件\nstdout: ${r.out}`)
    assert.ok(r.out.includes('kind=pkg-dir'), `必须点名占位类型\nstdout: ${r.out}`)
    assert.ok(!r.out.includes(MISSING), `差集为空时不得喊"漏物化"(那是另一格)\nstdout: ${r.out}`)
    assert.ok(!r.out.includes('请人工确认不是漏物化'), `含糊文案必须已被算出来的账替代\nstdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 端到端:退出码一字未改 ───
test('T2 端到端:Success 但实检 0 个 ⇒ 仍 exit 2(空扫不得当合格证,新判据没把这条吃掉)', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, app('__init__.py'))
    commitFile(dir, app('a.py'))
    const r = runScript(dir, { STUB_MYPY_OUT: 'Success: no issues found in 0 source files' })
    assert.equal(r.status, 2, `空扫必须 exit 2\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /空扫不得当合格证/)
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 纯判据:mypy 目录扫描的同名 stem 去重(依据 find_sources.py:110-136 / :58-64)───
test('T3 stemDedupSources:同目录同名形态各自归位,占位者与**出处(依据)**都要挂在记录自己身上', () => {
  const stubForm = gate.stemDedupSources([app('types', 'api_client.py'), app('types', 'api_client.pyi')])
  assert.deepEqual(stubForm.counted.sort(), [app('types', 'api_client.pyi')], '.pyi 赢位(mypy 排序契约 foo < foo.pyi < foo.py)')
  assert.deepEqual(stubForm.dropped, [
    {
      path: app('types', 'api_client.py'),
      by: app('types', 'api_client.pyi'),
      kind: 'stub',
      rule: gate.SHADOW_RULES.stub,
    },
  ], '被存根占位的 .py 必须逐条带 by/kind/rule(依据)报出来 —— 少 rule 就是"只报被占位、不报出处"')
  assert.equal(stubForm.conflicts, 1, '争位对数要能自证:这一格枚举到 1 处')
  assert.match(gate.SHADOW_RULES.stub, /find_sources\.py/, '依据必须落到 mypy 那条现读口径,不能是空话')
  assert.match(gate.SHADOW_RULES.stub, /foo < foo\.pyi < foo\.py/, '"谁挤掉谁"的可核依据(排序契约)必须写在出处里')

  const pkgForm = gate.stemDedupSources([app('services', 'sandbox.py'), app('services', 'sandbox', 'models.py')])
  assert.deepEqual(pkgForm.dropped, [
    {
      path: app('services', 'sandbox.py'),
      by: `${app('services', 'sandbox')}/`,
      kind: 'pkg-dir',
      rule: gate.SHADOW_RULES['pkg-dir'],
    },
  ], '被同名包目录占位的 .py 归 pkg-dir,不得并桶')
  assert.equal(pkgForm.conflicts, 1)
  assert.match(gate.SHADOW_RULES['pkg-dir'], /find_sources\.py:110-136/)
  assert.deepEqual(pkgForm.counted, [app('services', 'sandbox', 'models.py')])

  const triple = gate.stemDedupSources([
    app('x.py'),
    app('x.pyi'),
    app('x', 'inner.py'),
    app('y.py'),
  ])
  assert.deepEqual(triple.dropped.map((d) => d.path).sort(), [app('x.py'), app('x.pyi')])
  assert.deepEqual(triple.counted.slice().sort(), [app('x', 'inner.py'), app('y.py')])
  assert.equal(triple.conflicts, 2, '一处包目录挤掉两条同名文件 ⇒ 争位对数按位置上的争位者数算,不得算成 1')
  assert.equal(triple.dropped.length, triple.conflicts, '清单条数与枚举对数必须自证对得上')

  const noCollision = gate.stemDedupSources([app('__init__.py'), app('a.py'), app('b.py')])
  assert.equal(noCollision.dropped.length, 0, '无同名形态不得凭空造出占位')
  assert.equal(noCollision.conflicts, 0)
  assert.deepEqual(noCollision.unenumerable, [], '枚举成功时不得造假"判不出"记录')

  for (const bad of [null, undefined, 'apps/ai-service/app/a.py']) {
    const got = gate.stemDedupSources(bad)
    assert.equal(got.conflicts, null, `枚举取不到(${String(bad)})时冲突对数是"不知道",不是 0`)
    assert.ok(got.unenumerable.length > 0 && got.unenumerable.every((u) => u.subject && u.reason), '判不出要逐条报名 + 原因')
  }
  const empty = gate.stemDedupSources([])
  assert.equal(empty.conflicts, null, '枚举到 0 个源 = 尺子失效,不得读成"没有遮蔽"')
  assert.ok(empty.unenumerable.length > 0)
})

// ─── T4 差集非空 ⇒ 逐条点名(旧判据在这一格完全静默 ⇒ 本锁在旧面上必红)───
test('T4 coverageVerdict:面内有、物化目录没有 ⇒ state missing + 逐条点名(计数相等也要报)', () => {
  const face = [app('__init__.py'), app('a.py'), app('b.py')]
  const disk = [app('__init__.py'), app('a.py')]
  const v = gate.coverageVerdict({ checked: 3, faceSources: face, diskSources: disk })
  assert.equal(v.state, 'missing')
  assert.deepEqual(v.onlyOnFace, [app('b.py')], '差集必须逐条给出路径,不是只报个数量')
  assert.ok(v.lines.some((l) => l.includes(MISSING)), `须有"漏物化点名"这一档:${v.lines}`)
  assert.ok(v.lines.some((l) => l.includes(app('b.py'))), `点名行须含该路径:${v.lines}`)
  assert.ok(!v.lines.some((l) => l.includes(COUNT_ONLY)), '计数闭合时不得混进另一档文案')
  assert.ok(!v.lines.some((l) => l.includes('口径账')), '计数闭合时不得输出对账噪声(两态绝不并桶)')
  assert.ok(v.lines.every((l) => !l.includes('❌') && !l.includes('exit 2')), `警示不得冒充判红:${v.lines}`)
  // 成对:同一格里若计数也不等 ⇒ 两档都出声(漏物化点名 + 口径差),谁也不许把谁遮掉
  const both = gate.coverageVerdict({ checked: 2, faceSources: face, diskSources: disk })
  assert.equal(both.state, 'missing')
  assert.ok(both.lines.some((l) => l.includes(MISSING)), `差集档必须在:${both.lines}`)
  assert.ok(both.lines.some((l) => l.includes('口径账')), `口径档也必须在:${both.lines}`)
})

// ─── T5 解释不完 ⇒ 也绝不静默 ───
test('T5 coverageVerdict:口径账闭合不了 ⇒ closure=partial 且照样出声(不静默、不冒红)', () => {
  const face = [app('__init__.py'), app('a.py'), app('services', 'sandbox.py'), app('services', 'sandbox', 'models.py')]
  const v = gate.coverageVerdict({ checked: 2, faceSources: face, diskSources: face })
  assert.equal(v.state, 'count-only')
  assert.equal(v.closure, 'partial')
  assert.ok(v.lines.length > 0, '解释不了更不许静默')
  assert.ok(v.lines.some((l) => l.includes('口径账不闭合') && l.includes('请人工确认')), `须原样报出没解释掉的差额:${v.lines}`)
  const exact = gate.coverageVerdict({ checked: 3, faceSources: face, diskSources: face })
  assert.equal(exact.closure, 'exact')
  assert.ok(exact.lines.some((l) => l.includes('(闭合)')), `对账等式要写进结论:${exact.lines}`)
})

// ─── T6 反向对照:同名 .pyi 存根单独成对时账面本来就相等 ⇒ 一个字都不许多说 ───
test('T6 端到端:pyi 存根形态而计数相等 ⇒ 不出任何警示(不许把口径差报成漏检)', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, app('__init__.py'))
    commitFile(dir, app('types', 'api_client.py'))
    commitFile(dir, app('types', 'api_client.pyi'))
    // app/ 下 .py = 2(__init__ + api_client.py),mypy 实检也是 2(__init__ + api_client.pyi)⇒ 闭合
    const r = runScript(dir, { STUB_MYPY_OUT: 'Success: no issues found in 2 source files' })
    assert.equal(r.status, 0, `stdout: ${r.out}\nstderr: ${r.err}`)
    assert.ok(!r.out.includes(COUNT_ONLY), `计数闭合时不得喊口径差\nstdout: ${r.out}`)
    assert.ok(!r.out.includes(MISSING), `stdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T7 唯一实现 + 形状锁(用 matchAll 数出现次数,exec 首匹配会把"只剩一处"读成"都在")───
test('T7 形状锁:文案与判据只有门里那一份实现,主流程必须真的接上 coverageVerdict', () => {
  const masked = maskComments(readFileSync(SOURCE_SCRIPT, 'utf8'))
  assert.equal([...masked.matchAll(/请人工确认不是漏物化/g)].length, 0, '含糊文案留在代码路径里 = 提示又回到只报两个数')
  for (const token of [
    COUNT_ONLY,
    MISSING,
    '口径账不闭合',
    'stemDedupSources',
    'listDiskAppSources',
    // G-1117437:出处维的骨架(三态字段 + 那句"被谁挤掉"的读法)不得只剩注释
    'SHADOW_RULES',
    'shadowState',
    'shadowClosure',
    'shadowUndetermined',
    '被挤掉:',
    '挤掉者:',
    '遮蔽清单与枚举不自证',
  ]) {
    assert.ok([...masked.matchAll(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].length >= 1, `缺实现:${token}`)
  }
  assert.ok(/coverageVerdict\(/.test(masked), '主流程没接上判据 ⇒ 提示又变成只报两个数')
  assert.ok(/diskUnreadable:/.test(masked), '盘面"目录树读不出"没接进判据 ⇒ 判不出那一格会静默成"没有遮蔽"')
  assert.equal([...masked.matchAll(/function coverageVerdict/g)].length, 1, '覆盖面判据只许有一份')
  assert.equal([...masked.matchAll(/function stemDedupSources/g)].length, 1, '占位枚举只许有一份(不得另起第二份扫描)')
  assert.ok(/刻意\*\*不因不等而改退出码\*\*/.test(readFileSync(SOURCE_SCRIPT, 'utf8')), '退出码那条决定必须还在原文里')
})

// ─── T8 阳性对照钉真仓:输入**逐字**取自 HEAD 面真文件清单(现读那两个占位)───
// 只用自造夹具等于把缺陷掩了(§22c:镜像测试只复读实现就是复读机)。这条吃门的**枚举函数**,
// 拿 HEAD 面真读数当输入 ⇒ "这条判据真能在本仓产出的形态上命中"是被证明的,不是被声称的。
const REPO_ROOT = join(__dirname, '..', '..')
const REAL_API_CLIENT_PY = 'apps/ai-service/app/types/api_client.py'
const REAL_API_CLIENT_PYI = 'apps/ai-service/app/types/api_client.pyi'
const REAL_SANDBOX_PY = 'apps/ai-service/app/services/sandbox.py'
const REAL_SANDBOX_MODELS = 'apps/ai-service/app/services/sandbox/models.py'
const REAL_SANDBOX_PKG_DIR = 'apps/ai-service/app/services/sandbox/'

test('T8 阳性对照(真仓 HEAD 面):api_client/sandbox 两格必须被命中,且每条带"被谁挤掉 + 依据"', () => {
  const face = gate.appSourcePaths(gate.listFacePaths(REPO_ROOT, 'head')) // 真读数,不是夹具
  assert.ok(face.length > 500, `真仓 HEAD 面应有真实规模,实得 ${face.length}`)
  for (const p of [REAL_API_CLIENT_PY, REAL_API_CLIENT_PYI, REAL_SANDBOX_PY, REAL_SANDBOX_MODELS]) {
    assert.ok(
      face.includes(p),
      `HEAD 面真清单里应现读到 ${p};不在位说明钉的对象变了 —— 要按 HEAD 现状重钉,不得放宽本条`,
    )
  }
  const predicted = gate.stemDedupSources(face)
  const v = gate.coverageVerdict({
    checked: predicted.counted.length,
    faceSources: face,
    diskSources: face,
  })
  assert.equal(v.shadowState, 'shadowed', `真仓面必须读成"被遮蔽",不是"无遮蔽":${v.shadowState}`)
  assert.equal(
    v.shadowClosure,
    'exact',
    `遮蔽清单必须对得上枚举到的争位对数(${v.shadowConflicts} vs ${v.shadowItems.length})`,
  )
  const stub = v.shadowItems.find((d) => d.path === REAL_API_CLIENT_PY)
  assert.ok(
    stub,
    `本票点名的这一格(类型口径由同名 .pyi 决定)必须逐条点名:清单=${v.shadowItems.map((d) => d.path).join(', ')}`,
  )
  assert.equal(stub.by, REAL_API_CLIENT_PYI, '"被谁挤掉"里的挤掉者必须是那份同名 .pyi 存根')
  assert.equal(stub.kind, 'stub')
  assert.ok(stub.rule && stub.rule.length > 0, '出处(依据)必须挂在这条记录自己身上,不能只在头部说明里')
  assert.match(stub.rule, /find_sources\.py/, '依据要能查到 mypy 的哪一条口径')
  const pkg = v.shadowItems.find((d) => d.path === REAL_SANDBOX_PY)
  assert.ok(pkg, 'sandbox.py 那一格同样必须点名(真仓另一处占位)')
  assert.equal(pkg.by, REAL_SANDBOX_PKG_DIR)
  assert.equal(pkg.kind, 'pkg-dir')
  assert.match(pkg.rule, /find_sources\.py:110-136/)
  assert.ok(
    v.shadowItems.every((d) => d.path && d.by && d.kind && d.rule),
    '一条没有出处的遮蔽记录 = 这一维等于没有',
  )
  assert.ok(
    v.lines.some((l) => l.includes('被挤掉:') && l.includes('挤掉者:') && l.includes('依据:')),
    `读数里必须看得见出处:\n${v.lines.join('\n')}`,
  )
})

// ─── T9 三态绝不并桶 ───
test('T9 遮蔽三态:none / shadowed / undetermined 各自归位,判不出那格逐条报名且不得静默', () => {
  const clean = [app('__init__.py'), app('a.py'), app('b.py')]
  const none = gate.coverageVerdict({ checked: 3, faceSources: clean, diskSources: clean })
  assert.equal(none.shadowState, 'none')
  assert.equal(none.shadowConflicts, 0)
  assert.equal(none.shadowClosure, 'exact')
  assert.deepEqual(none.shadowItems, [], '无遮蔽不得凭空造出记录')
  assert.equal(none.shadowUndetermined.length, 0, '无遮蔽也不是"判不出"')

  const noFace = gate.coverageVerdict({ checked: 5, faceSources: null, diskSources: clean })
  assert.equal(noFace.shadowState, 'undetermined', '取不到面 ⇒ 判不出,不得并到"无遮蔽"')
  assert.equal(noFace.shadowConflicts, null, '枚举失败时冲突对数是"不知道",不是 0')
  assert.ok(noFace.shadowUndetermined.length > 0, '判不出要逐条报名')
  assert.ok(
    noFace.shadowUndetermined.every((u) => u.subject && u.reason),
    `每条判不出都要有名字与原因:${JSON.stringify(noFace.shadowUndetermined)}`,
  )
  assert.ok(
    noFace.lines.some((l) => l.includes('判不出') && !l.includes('❌') && !l.includes('exit 2')),
    `判不出必须出声、且不冒充判红:\n${noFace.lines.join('\n')}`,
  )

  const emptyFace = gate.coverageVerdict({ checked: 1, faceSources: [], diskSources: [] })
  assert.equal(emptyFace.shadowState, 'undetermined', '枚举到 0 个源 = 尺子失效,不是"没有遮蔽"')

  const unreadable = gate.coverageVerdict({
    checked: 3,
    faceSources: clean,
    diskSources: clean,
    diskUnreadable: [app('services')],
  })
  assert.equal(
    unreadable.shadowState,
    'undetermined',
    '目录树读不出 ⇒ 判不出(旧写法在这一格是静默的,账面一片太平)',
  )
  assert.ok(
    unreadable.lines.some((l) => l.includes(app('services'))),
    `读不出那一层要报到名字:\n${unreadable.lines.join('\n')}`,
  )
  assert.ok(unreadable.lines.length > 0, '判不出不得静默成"没有遮蔽"')
  assert.notEqual(unreadable.shadowState, none.shadowState, '三态不得并桶:判不出与无遮蔽是两个格子')
})

// ─── T10 端到端:那条掩缺陷的格子(计数净 +1 −1 而旧判据一字不说)───
test('T10 端到端:计数相等的 .pyi 占位 ⇒ exit 0,但读数必须带"被挤掉/挤掉者/依据"', () => {
  const dir = createTempRepo()
  try {
    commitFile(dir, app('__init__.py'))
    commitFile(dir, app('types', 'api_client.py'))
    commitFile(dir, app('types', 'api_client.pyi'))
    // app/ 下 .py = 2,mypy 实检也是 2 ⇒ 计数轴在"相等"那一格直接收口(真仓 api_client 就是这一型)
    const r = runScript(dir, { STUB_MYPY_OUT: 'Success: no issues found in 2 source files' })
    assert.equal(r.status, 0, `出处维不改退出码语义\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /✅/, '仍须出具通过结论')
    assert.ok(
      r.out.includes('被挤掉:') && r.out.includes(app('types', 'api_client.py')),
      `计数相等时也必须点名被挤掉的那一份\nstdout: ${r.out}`,
    )
    assert.ok(
      r.out.includes(`挤掉者:${app('types', 'api_client.pyi')}`),
      `必须点名挤掉者(判"漂移在哪一侧"的唯一依据)\nstdout: ${r.out}`,
    )
    assert.ok(
      r.out.includes('依据:mypy 2.3.1 mypy/find_sources.py'),
      `必须带上依据\nstdout: ${r.out}`,
    )
    assert.ok(!r.out.includes(COUNT_ONLY), `计数相等时不得喊口径差(两态各说各的)\nstdout: ${r.out}`)
    assert.ok(!r.out.includes(MISSING), `stdout: ${r.out}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
