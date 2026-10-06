// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-next-env-dist.mjs`(apps/web/next-env.d.ts 的 `.next-*` 变体污染守门)。
 *
 * 裁定一律走门体导出的 `__test__`:`POLLUTION`(污染形态)、`isStaged`(取材面选择)、`NEXT_ENV`(取材路径)。
 * 测试里不写第二份正则、也不抄第二份路径常量(守门 191 的 F1/F2 拦的就是这一型;§22c 红线同上)。
 *
 * 取材(§22c 最后一条红线:不得全部自造夹具):
 *   · 反例(放行)= `git show HEAD:apps/web/next-env.d.ts` 现读的**逐字原文** —— 铁律「变体永不提交」
 *     说的是 HEAD 面,所以这一条按规则该恒绿;真漂出变体时红的是铁律被破,不是测试写错了;
 *   · 阳性(命中)= 在同一行真原文上把 `.next/` 换成拼接出来的变体名(内存内,不落真仓);
 *     另有一臂直接取 `apps/web/` 下**真实存在**的变体目录名(现读磁盘)当素材。
 *
 * 判据不得建立在"此刻是干净的"之上(本票硬约束 7):真仓面上的 CLI 退出码与
 * `POLLUTION` + 变体目录在位性**当场算出的期望**对账,而不是与某个写死的 0 对账。
 *
 * node:test 在本仓运行时(Node 24.19)没有模块级 `it.skipIf`(实测读数见 X8),
 * 等价通道是 `test(name, { skip: <加载期同步算出的条件> }, fn)`,账面同样落 skipped 计数。
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g);临时树只经 mkScratch/rmScratch。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

/** 把真原文里的纯 `.next/` 换成给定变体名(只在内存里)。 */
function pollute(realLine, variant) {
  assert.ok(realLine.includes(PURE_REF), `真面那一行不含 ${PURE_REF}:${JSON.stringify(realLine)}`)
  return realLine.replace(PURE_REF, ['.', '/', variant, '/'].join(''))
}

test('X0 import 门体不得触发 CLI(§22d:旧写法一 import 就跑 git + 读文件 + exit)', () => {
  for (const k of ['POLLUTION', 'isStaged', 'NEXT_ENV']) assert.ok(k in gate, `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据`)
  assert.ok(gate.POLLUTION instanceof RegExp, 'POLLUTION 不是正则 ⇒ 判据换了形状')
  assert.equal(typeof gate.isStaged, 'function')
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

test('X1 真仓 HEAD 面的逐字 import 行必须都不算污染(铁律锁,不是状态锁)', { skip: NOT_REPO }, () => {
  assert.ok(HEAD_IMPORT_LINES.length >= 1, 'HEAD 面里一行 import 都没有 ⇒ 取材面不对,这条无从判定')
  for (const l of HEAD_IMPORT_LINES) {
    assert.equal(gate.POLLUTION.exec(l), null, `HEAD 的 next-env.d.ts 引用了 .next-* 变体(铁律「变体永不提交」被破):${JSON.stringify(l)}`)
  }
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

test('X3 CLI 全量档两态:同一份污染面,目录在位只提示、目录消失必须红', { skip: NOT_REPO }, () => {
  const root = mkScratch('ihui-next-env-full-')
  try {
    const webDir = join(root, 'apps', 'web')
    const variant = [VARIANT_PREFIX, 'staging'].join('')
    const face = pollute(HEAD_IMPORT_LINES[0], variant)
    const abs = join(webDir, 'next-env.d.ts')

    mkdirSync(join(webDir, variant), { recursive: true })
    writeFileSync(abs, face, 'utf8')
    const alive = runGate([], root)
    assert.equal(alive.rc, 0, `变体目录在位时全量档不该报红(并发会话的活 distDir),实得 ${alive.rc}:${alive.all.slice(0, 300)}`)

    rmSync(join(webDir, variant), { recursive: true, force: true })
    const dead = runGate([], root)
    assert.equal(dead.rc, 1, `目录已消失而引用留下 = 死引用污染,必须红,实得 ${dead.rc}:${dead.all.slice(0, 300)}`)
    assert.ok(dead.all.includes(variant), `读数没点名是哪个变体:${dead.all.slice(0, 300)}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('X4 CLI --staged 无条件严格:变体引用进了暂存区就必拦(目录在位也不放行)', { skip: NOT_REPO }, () => {
  const root = mkScratch('ihui-next-env-staged-')
  try {
    const webDir = join(root, 'apps', 'web')
    const variant = [VARIANT_PREFIX, 'modal'].join('')
    const abs = join(webDir, 'next-env.d.ts')
    mkdirSync(join(webDir, variant), { recursive: true })
    gitIn(root, ['init', '--quiet'])
    gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
    gitIn(root, ['config', 'user.name', 'gate-test'])

    writeFileSync(abs, pollute(HEAD_IMPORT_LINES[0], variant), 'utf8')
    gitIn(root, ['add', '--', 'apps/web/next-env.d.ts'])
    const stagedHit = runGate(['--staged'], root)
    assert.equal(stagedHit.rc, 1, `污染引用已入索引却放行(目录在位绕开了铁律),实得 ${stagedHit.rc}:${stagedHit.all.slice(0, 300)}`)

    writeFileSync(abs, HEAD_FACE, 'utf8')
    gitIn(root, ['add', '--', 'apps/web/next-env.d.ts'])
    const stagedClean = runGate(['--staged'], root)
    assert.equal(stagedClean.rc, 0, `暂存的是合法面却判红,实得 ${stagedClean.rc}:${stagedClean.all.slice(0, 300)}`)

    writeFileSync(abs, pollute(HEAD_IMPORT_LINES[0], variant), 'utf8')
    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 合法面入库'])
    writeFileSync(abs, pollute(HEAD_IMPORT_LINES[0], variant), 'utf8')
    const unstaged = runGate(['--staged'], root)
    assert.equal(unstaged.rc, 0, `未暂存时 --staged 应放行(铁律本就靠 --staged 把关),实得 ${unstaged.rc}:${unstaged.all.slice(0, 300)}`)
    assert.match(unstaged.out, /未暂存|跳过/)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('X5 isStaged 与 live 索引面同读数对账(两面都现读,不写死"此刻未暂存")', { skip: NOT_REPO }, () => {
  const live = gitIn(REPO, ['diff', '--cached', '--name-only']).split('\n').map((s) => s.trim()).includes(REL_NEXT_ENV)
  assert.equal(gate.isStaged(), live, `门体的 isStaged() 与当场读的索引面分叉:gate=${gate.isStaged()} git=${live}`)
})

test('X6 真仓全量档:退出码与"污染 + 目录在位性"当场算出的期望自洽', { skip: NOT_REPO }, () => {
  const faceInPlace = existsSync(gate.NEXT_ENV)
  const liveFace = faceInPlace ? readFileSync(gate.NEXT_ENV, 'utf8') : ''
  const m = faceInPlace ? gate.POLLUTION.exec(liveFace) : null
  const expect = !m ? 0 : existsSync(join(dirname(gate.NEXT_ENV), m[1])) ? 0 : 1
  const r = runGate([], REPO)
  assert.notEqual(r.rc, 2, `CLI 在本仓 exit 2 属脚本自身异常:${r.all.slice(0, 400)}`)
  assert.equal(r.rc, expect, `CLI 读数与判据期望分叉:rc=${r.rc} expect=${expect} 取材面=${JSON.stringify(liveFace.slice(0, 120))}`)
})

test('X7 测试不得重写判据(本文件只许用门体导出的 POLLUTION / isStaged / NEXT_ENV)', () => {
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
  console.log(
    [
      `    · Node ${process.version} / it.skipIf 可用 = ${typeof test.skipIf === 'function'} / skip 通道 = test(name,{skip}) 等价`,
      `    · 门体 NEXT_ENV = ${gate.NEXT_ENV} / 仓根对账 = ${CWD_IS_REPO} / 相对取材路径 = ${REL_NEXT_ENV}`,
      `    · HEAD 面 import 行数 = ${HEAD_IMPORT_LINES.length} / apps/web 现读变体目录 = ${REAL_VARIANT_DIRS.length ? REAL_VARIANT_DIRS.join(',') : '(无)'}`,
      `    · 当场 isStaged() = ${gate.isStaged()}`,
    ].join('\n'),
  )
  assert.equal(typeof CWD_IS_REPO, 'boolean')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
