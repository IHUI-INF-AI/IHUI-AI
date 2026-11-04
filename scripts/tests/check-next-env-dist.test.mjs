// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-next-env-dist.mjs`(门 50:tracked 生成物不得含 `.next-*` 变体引用)。
 *
 * 裁定一律走门体导出的 `__test__`:`POLLUTION`(污染形态)、`scanFace`(判据面取材)、
 * `judgeLines`(原始输出判违规)、`stagedPaths`(索引面路径)、`FACE_HEAD`/`FACE_INDEX`(两张面)。
 * 测试里不写第二份正则、也不抄第二份路径常量(守门 191 的 F1/F2 拦的就是这一型;§22c 红线同上)。
 *
 * 取材(§22c 最后一条红线:不得全部自造夹具):
 *   · 反例(放行)= `git show HEAD:apps/web/next-env.d.ts` 现读的**逐字原文** —— 铁律「变体永不提交」
 *     说的是 HEAD 面,所以这一条按规则该恒绿;真漂出变体时红的是铁律被破,不是测试写错了;
 *   · 阳性(命中)= 在同一行真原文上把 `.next/` 换成拼接出来的变体名(内存内),再落到临时仓的
 *     **tracked 生成物**里(回归①);合法臂用同一份真原文(回归②,`.next/dev/types`)。
 *
 * 判据面纪律(本票硬约束): 判据只认 git 面(HEAD tree / 索引),不读磁盘正文 ——
 * X5 直接从门体源码锁这条;X4 用"只脏工作树、索引已复原"证明 `--staged` 判的是索引而不是磁盘。
 * 真仓面上的 CLI 退出码与 `scanFace` + `judgeLines` **当场算出的期望**对账(X6),不写死 0。
 *
 * node:test 在本仓运行时(Node 24.19)没有模块级 `it.skipIf`(实测读数见 X8),
 * 等价通道是 `test(name, { skip: <加载期同步算出的条件> }, fn)`,账面同样落 skipped 计数。
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g);临时树只经 mkScratch/rmScratch。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-next-env-dist.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_PATH = join(REPO, 'scripts', 'check-next-env-dist.mjs')
const ANSI = /\x1b\[[0-9;]*m/g
const stripAnsi = (s) => String(s ?? '').replace(ANSI, '')

/** 变体名的书写件(`.` + `next` + `-` + 后缀):拼接给出,免得测试成为别处的文本棘轮。 */
const VARIANT_PREFIX = ['.next', '-'].join('')
const PURE_REF = ['.', '/', '.', 'next', '/'].join('')
const DEV_REF = ['.', '/', '.', 'next', '/dev/'].join('')

/** 门体的 NEXT_ENV 是按**进程 cwd** 推的,所以只有 cwd 就是仓根时它才指向真取材面(加载期现测)。 */
const CWD_IS_REPO = resolve(process.cwd()) === REPO
const NOT_REPO = CWD_IS_REPO ? false : `门体的 NEXT_ENV 由 process.cwd() 推得,本次 cwd=${process.cwd()} 不是仓根 ⇒ 真面臂无从判定,记 skip 不记通过`
const REL_NEXT_ENV = relative(REPO, gate.NEXT_ENV).split(sep).join('/')

function runGate(args, cwd = REPO) {
  const r = spawnSync(process.execPath, [GATE_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  return { rc: r.status, out: stripAnsi(r.stdout), err: stripAnsi(r.stderr), all: stripAnsi(r.stdout) + stripAnsi(r.stderr) }
}

function gitIn(root, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${stripAnsi(r.stderr)}`)
  return String(r.stdout ?? '')
}

/** 临时仓夹具:init + 身份(提交真实树,才有 HEAD 面可判)。 */
function seedRepo(root) {
  gitIn(root, ['init', '--quiet'])
  gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
  gitIn(root, ['config', 'user.name', 'gate-test'])
}

/** 真仓 apps/web 下现读的变体目录(并发会话的活 distDir;为空则该臂记 skip)。 */
const REAL_VARIANT_DIRS = (() => {
  try {
    return readdirSync(join(REPO, 'apps', 'web')).filter((n) => n.startsWith(VARIANT_PREFIX))
  } catch {
    return []
  }
})()

/** 真 HEAD 面(逐字原文)。 */
const HEAD_FACE = (() => {
  if (!CWD_IS_REPO) return null
  const spec = `HEAD:${REL_NEXT_ENV}`
  const text = catBatch(REPO, [spec]).get(spec)
  assert.equal(typeof text, 'string', `${spec} 取不到 HEAD blob ⇒ 无法判定(不回落磁盘那一面)`)
  return text
})()

const HEAD_IMPORT_LINES = HEAD_FACE ? HEAD_FACE.split(/\r?\n/).filter((l) => l.includes('import')) : []

/** HEAD 面全量扫描只做一次(2026-11-04 实测单次 5-7s,每条臂各扫一遍会把测试时间翻倍)。 */
let HEAD_SCAN_CACHE
function headScan() {
  if (HEAD_SCAN_CACHE === undefined) HEAD_SCAN_CACHE = gate.scanFace(gate.FACE_HEAD)
  return HEAD_SCAN_CACHE
}

/** 把真原文里的纯 `.next/` 换成给定变体名(只在内存里)。 */
function pollute(realLine, variant) {
  assert.ok(realLine.includes(PURE_REF), `真面那一行不含 ${PURE_REF}:${JSON.stringify(realLine)}`)
  return realLine.replace(PURE_REF, ['.', '/', variant, '/'].join(''))
}

test('X0 import 门体不得触发 CLI(§22d:旧写法一 import 就跑 git + 读文件 + exit)', () => {
  for (const k of ['POLLUTION', 'NEXT_ENV', 'FACE_HEAD', 'FACE_INDEX', 'scanFace', 'judgeLines', 'stagedPaths', 'selfTest']) {
    assert.ok(k in gate, `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据`)
  }
  assert.ok(gate.POLLUTION instanceof RegExp, 'POLLUTION 不是正则 ⇒ 判据换了形状')
  assert.equal(typeof gate.scanFace, 'function')
  assert.equal(typeof gate.judgeLines, 'function')
  assert.equal(typeof gate.selfTest, 'function')
  assert.equal(typeof gate.NEXT_ENV, 'string')

  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE_PATH).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = stripAnsi(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${stripAnsi(r.stderr)}`)
  assert.doesNotMatch(out, /next-env\.d\.ts/, 'import 门体就打印了 CLI 读数 ⇒ §22c 的通道又断了')
})

test('X1 真仓 HEAD 面(全部 tracked blob)不得含 .next-* 变体引用(铁律锁,不是状态锁)', { skip: NOT_REPO }, () => {
  assert.ok(HEAD_IMPORT_LINES.length >= 1, 'HEAD 面里一行 import 都没有 ⇒ 取材面不对,这条无从判定')
  for (const l of HEAD_IMPORT_LINES) {
    assert.equal(gate.POLLUTION.exec(l), null, `HEAD 的 next-env.d.ts 引用了 .next-* 变体(铁律「变体永不提交」被破):${JSON.stringify(l)}`)
  }
  const raw = headScan()
  assert.notEqual(raw, null, 'HEAD 面取不到 ⇒ 无从判定(不许回落磁盘面)')
  const v = gate.judgeLines(raw, gate.FACE_HEAD)
  assert.deepEqual(v, [], `HEAD 面出现变体引用(射程已扩到全部 tracked 文件):${JSON.stringify(v).slice(0, 300)}`)
})

test('X2 污染形态一正一反:变体必命中,纯 .next 与空后缀不得命中', { skip: NOT_REPO }, () => {
  const base = HEAD_IMPORT_LINES[0]
  const variant = [VARIANT_PREFIX, 'staging'].join('')
  const face = pollute(base, variant)
  const m = gate.POLLUTION.exec(face)
  assert.ok(m, `拼出的变体引用没被判成污染(判据失明?):${JSON.stringify(face)}`)
  assert.equal(m[1], variant, `捕获的变体名是 ${m[1]},不是素材 ${variant} ⇒ 组取错了`)

  for (const legal of [base, base.replace(PURE_REF, DEV_REF)]) {
    assert.equal(gate.POLLUTION.exec(legal), null, `合法的纯 .next 写法被判红:${JSON.stringify(legal)}`)
  }
  const emptySuffix = base.replace(PURE_REF, ['.', '/', VARIANT_PREFIX, '/'].join(''))
  assert.equal(gate.POLLUTION.exec(emptySuffix), null, `.next- 后头没有后缀时不该算变体:${JSON.stringify(emptySuffix)}`)
})

test('X2b 素材可来自真仓现读的变体目录名(有则判,无则 skip)',
  { skip: NOT_REPO || (REAL_VARIANT_DIRS.length === 0 && `apps/web 下现读不到 ${VARIANT_PREFIX}* 变体目录 ⇒ 这一臂没有可测对象`) },
  () => {
    const variant = REAL_VARIANT_DIRS[0]
    const face = pollute(HEAD_IMPORT_LINES[0], variant)
    const m = gate.POLLUTION.exec(face)
    assert.ok(m && m[1] === variant, `真存在的变体目录名 ${variant} 没被判成污染:${JSON.stringify(face)}`)
    assert.equal(existsSync(join(REPO, 'apps', 'web', variant)), true, '现读的变体目录已消失 ⇒ 该臂的面漂了')
  })

test('X3 回归①:伪造 tracked 生成物含 .next-e2e-x/ 引用 ⇒ 全量档必红', { skip: NOT_REPO }, () => {
  const root = mkScratch('ihui-next-env-head-red-')
  try {
    seedRepo(root)
    const variant = [VARIANT_PREFIX, 'e2e-x'].join('')
    const polluted = pollute(HEAD_IMPORT_LINES[0], variant)
    const rel = 'apps/web/probe.generated.ts'
    const abs = join(root, 'apps', 'web', 'probe.generated.ts')
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, `${polluted}\n`, 'utf8')
    gitIn(root, ['add', '--', rel])
    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 变体引用入库(反例)'])

    const r = runGate([], root)
    assert.equal(r.rc, 1, `tracked 生成物引用了 ${variant} 却放行,实得 ${r.rc}:${r.all.slice(0, 300)}`)
    assert.ok(r.all.includes(rel) && r.all.includes(variant), `读数没点名违规文件/变体:${r.all.slice(0, 300)}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('X3b 回归②:`.next/types` 合法形式不许误报(同一份真原文,只把变体换回纯 .next)', { skip: NOT_REPO }, () => {
  const root = mkScratch('ihui-next-env-head-green-')
  try {
    seedRepo(root)
    const rel = 'apps/web/probe.generated.ts'
    const abs = join(root, 'apps', 'web', 'probe.generated.ts')
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, HEAD_FACE, 'utf8')
    gitIn(root, ['add', '--', rel])
    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 合法面入库'])

    const r = runGate([], root)
    assert.equal(r.rc, 0, `合法 .next 路径被误报,实得 ${r.rc}:${r.all.slice(0, 300)}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('X4 --staged 判索引面:污染进了索引必拦;只脏工作树(索引已复原)不许红', { skip: NOT_REPO }, () => {
  const root = mkScratch('ihui-next-env-staged-')
  try {
    seedRepo(root)
    const variant = [VARIANT_PREFIX, 'perf'].join('')
    const rel = 'apps/web/probe.generated.ts'
    const abs = join(root, 'apps', 'web', 'probe.generated.ts')
    mkdirSync(dirname(abs), { recursive: true })

    writeFileSync(abs, HEAD_FACE, 'utf8')
    gitIn(root, ['add', '--', rel])
    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 合法基线'])

    writeFileSync(abs, pollute(HEAD_IMPORT_LINES[0], variant), 'utf8')
    gitIn(root, ['add', '--', rel])
    const hit = runGate(['--staged'], root)
    assert.equal(hit.rc, 1, `污染引用进了索引却放行,实得 ${hit.rc}:${hit.all.slice(0, 300)}`)

    gitIn(root, ['reset', '--quiet', '--', rel])
    const unstaged = runGate(['--staged'], root)
    assert.equal(unstaged.rc, 0, `索引面已复原、只有工作树脏(该如何判磁盘面?)实得 ${unstaged.rc}:${unstaged.all.slice(0, 300)}`)
    assert.match(unstaged.out, /跳过/)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('X5 面纪律:门体不得读磁盘正文(node:fs 0 处),判据只认 HEAD / 索引两张 git 面', () => {
  const src = readFileSync(GATE_PATH, 'utf8')
  assert.doesNotMatch(src, /from ['"]node:fs['"]/, '门体又 import node:fs ⇒ 面混用(磁盘面)回归')
  assert.match(src, /'grep'/, '判据不从 git 面取材 ⇒ 射程/面都无从锁')
  assert.equal(gate.FACE_HEAD, 'HEAD')
  assert.equal(gate.FACE_INDEX, 'INDEX')
})

test('X6 真仓全量档:退出码与 HEAD 面当场判出的期望自洽', { skip: NOT_REPO }, () => {
  const raw = headScan()
  assert.notEqual(raw, null, 'HEAD 面取不到 ⇒ 期望算不出来')
  const violations = gate.judgeLines(raw, gate.FACE_HEAD)
  const expect = violations.length ? 1 : 0
  const r = runGate([], REPO)
  assert.notEqual(r.rc, 2, `CLI 在本仓 exit 2 属脚本自身异常:${r.all.slice(0, 400)}`)
  assert.equal(r.rc, expect, `CLI 读数与 HEAD 面判据分叉:rc=${r.rc} expect=${expect} 违规=${JSON.stringify(violations).slice(0, 200)}`)
})

test('X7 测试不得重写判据(本文件只许用门体导出的 POLLUTION / scanFace / judgeLines / NEXT_ENV)', () => {
  const own = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    own.includes("import { __test__ as gate } from '../check-next-env-dist.mjs'"),
    '§22c 锚点:必须 import 门体导出的判据',
  )
  for (const name of Object.keys(gate)) {
    assert.ok(!own.includes(`function ${name}(`), `测试里出现了第二份 ${name}`)
    assert.ok(!own.includes(`const ${name} =`), `测试里重新声明了 ${name}`)
  }
  assert.ok(!own.includes(gate.POLLUTION.source), '污染形态被抄进测试 ⇒ 门体一改测试就静默失效')
  const judged = own.split('gate.POLLUTION.').length - 1
  assert.ok(judged >= 3, `只有 ${judged} 处走门体形态 ⇒ 有断言在用自造判据`)
})

test('X8 加载期能力读数(账面可复核:哪些臂有对象、哪些记 skip)', () => {
  const raw = CWD_IS_REPO ? headScan() : null
  const headLines = raw ? raw.split(/\r?\n/).filter(Boolean).length : 0
  const headViolations = raw ? gate.judgeLines(raw, gate.FACE_HEAD).length : 0
  const staged = CWD_IS_REPO ? gate.stagedPaths() : []
  const st = gate.selfTest()
  console.info(
    [
      `    · Node ${process.version} / it.skipIf 可用 = ${typeof test.skipIf === 'function'} / skip 通道 = test(name,{skip}) 等价`,
      `    · 门体 NEXT_ENV = ${gate.NEXT_ENV} / 仓根对账 = ${CWD_IS_REPO} / 相对取材路径 = ${REL_NEXT_ENV}`,
      `    · HEAD 面:含 "${gate.PREFILTER}" 的行 = ${headLines} / 违规 = ${headViolations}`,
      `    · 索引面暂存路径 = ${staged.length} / HEAD 面 import 行数 = ${HEAD_IMPORT_LINES.length}`,
      `    · apps/web 现读变体目录 = ${REAL_VARIANT_DIRS.length ? REAL_VARIANT_DIRS.join(',') : '(无)'}`,
      `    · 门体 --self-test 内存断言 = ${st.passed}/${st.rows.length} 通过`,
    ].join('\n'),
  )
  assert.equal(typeof CWD_IS_REPO, 'boolean')
  assert.equal(st.failed, 0, `门体自检在本票里有失败项:${JSON.stringify(st.rows.filter((r) => !r.ok))}`)
})

test('X9 CLI --self-test 必须绿(反例在自检里常驻)', { skip: NOT_REPO }, () => {
  const r = runGate(['--self-test'], REPO)
  assert.equal(r.rc, 0, `门体自检 CLI 红,实得 ${r.rc}:${r.all.slice(0, 300)}`)
  assert.match(r.out, /自检 \d+\/\d+ 通过/)
  assert.match(r.out, /反例/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
