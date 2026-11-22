// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-nested-additional-properties.mjs`(b76 族:工具入参闭合声明必须递归到每一层)。
 *
 * 这道门只导出一枚生产判据 `check(validatorSrc, typesSrc)` 加两个取材路径,所以镜像测试的形状很干净:
 * 测试**只**负责构造面(真 HEAD 面 + 内存内变异),裁定一律交给 `check`。测试里不写第二份判据
 * (守门 191 `check-test-judge-not-replicated.mjs` 的 F2 拦的就是"import 了门又自带清单")。
 *
 * 取材(§22c 红线:不得全部自造夹具):`validatorSrc` / `typesSrc` 一律 `git show HEAD:<门体自己导出的路径>`
 * 现读 —— 路径也取自 `gate.VALIDATOR_PATH` / `gate.TYPES_PATH`,测试不另抄一份路径常量。
 *
 * 一正一反:
 *   · 反例(放行)= 真 HEAD 双面对账 ⇒ `check` 必须返回空数组;类型面**多补**一处合法声明也不得误红;
 *   · 正例(命中)= 五条判据各有一枚内存变异 ⇒ 每枚都必须"恰好红一条",且那条读数里点名可辨认的锚;
 *   · 摘不到(未判定)= CLI 在取不到取材文件的目录下必须 exit 2 且说不出 PASS。
 *
 * 变异面里的锚点串按拼接给(本仓实测过测试字面量与别门文本棘轮相撞),不逐字抄别处的触发词。
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g);临时目录只经 mkScratch/rmScratch。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-nested-additional-properties.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_PATH = join(REPO, 'scripts', 'check-nested-additional-properties.mjs')
const ANSI = /\x1b\[[0-9;]*m/g
const stripAnsi = (s) => String(s ?? '').replace(ANSI, '')

/** 夹具锚点:一律拼接成形(见文件头注)。 */
const tok = (...parts) => parts.join('_')
const ANCHOR_FACE = ['const additional = param.', 'additionalProperties;'].join('')
const FALSE_IF_FACE = ['if (additional', '=== false)'].join(' ')
const REASON_FACE = ['reason: ', "'", tok('unknown', 'field'), "'"].join('')
const KEY_PATH_FACE = ['`', '${field}', '.', '${k}', '`'].join('')
const COERCE_FACE = ['coerceAndCheck(', KEY_PATH_FACE, ', obj[k], additional, errors)'].join('')
const CLOSED_TOKEN = ['additional', 'Properties'].join('')

const replaceAll = (s, from, to) => s.split(from).join(to)

function runGate(args, cwd = REPO, env = process.env) {
  const r = spawnSync(process.execPath, [GATE_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    env,
  })
  return { rc: r.status, out: stripAnsi(r.stdout), err: stripAnsi(r.stderr), all: stripAnsi(r.stdout) + stripAnsi(r.stderr) }
}

// ── 真 HEAD 面(路径来自门体导出,正文来自 git show) ──────────────────────
const HEAD_BATCH = catBatch(REPO, [`HEAD:${gate.VALIDATOR_PATH}`, `HEAD:${gate.TYPES_PATH}`])
const VALIDATOR_FACE = HEAD_BATCH.get(`HEAD:${gate.VALIDATOR_PATH}`)
const TYPES_FACE = HEAD_BATCH.get(`HEAD:${gate.TYPES_PATH}`)

/** 五枚变异面:每枚只摘一处生产判据的锚,期望"恰好一条读数且点名可辨认"。 */
const MUTATIONS = [
  {
    name: '嵌套三态锚点被摘',
    face: () => [replaceOnce(VALIDATOR_FACE, ANCHOR_FACE, 'const additional = void 0;'), TYPES_FACE],
    mustMention: ANCHOR_FACE,
  },
  {
    name: 'false 分支被摘',
    face: () => [replaceOnce(VALIDATOR_FACE, FALSE_IF_FACE, 'if (additional === notFalse)'), TYPES_FACE],
    mustMention: ['缺', 'false', '分支'].join(' '),
  },
  {
    name: 'unknown_field 记账被改写(键路径约定失依)',
    face: () => [replaceAll(VALIDATOR_FACE, REASON_FACE, ["reason: ", "'", 'off_record', "'"].join('')), TYPES_FACE],
    mustMention: KEY_PATH_FACE,
  },
  {
    name: '子 schema 改走按值判的调用被摘形',
    face: () => [replaceOnce(VALIDATOR_FACE, COERCE_FACE, 'coerceAndCheck(field, obj[k], additional, errors)'), TYPES_FACE],
    mustMention: 'coerceAndCheck',
  },
  {
    name: '类型面声明被摘到不足两处',
    face: () => [VALIDATOR_FACE, replaceAll(TYPES_FACE, CLOSED_TOKEN, 'closedObjectFlags')],
    mustMention: gate.TYPES_PATH,
  },
]

function replaceOnce(s, from, to) {
  assert.ok(s.includes(from), `真 HEAD 面里找不到锚点「${from}」⇒ 门体的取材面漂了(先疑尺子/取材,别改测试期望)`)
  return s.replace(from, to)
}

test('N0 import 门体不得触发 CLI(§22d:旧写法一 import 就 exit)', () => {
  for (const k of ['check', 'VALIDATOR_PATH', 'TYPES_PATH']) {
    assert.ok(k in gate, `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据(§22c 红线)`)
  }
  assert.equal(typeof gate.check, 'function', '生产判据 check 不是函数')
  assert.equal(typeof gate.VALIDATOR_PATH, 'string')
  assert.equal(typeof gate.TYPES_PATH, 'string')

  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE_PATH).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = stripAnsi(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${stripAnsi(r.stderr)}`)
  assert.doesNotMatch(out, /PASS|UNDETERMINED/, 'import 门体就跑了 CLI 并打出读数 ⇒ §22c 的通道又断了')
})

test('N1 真 HEAD 双面对账必须零失败(逐字真面,不是自造夹具)', () => {
  assert.equal(typeof VALIDATOR_FACE, 'string', `${gate.VALIDATOR_PATH} 的 HEAD blob 取不到 ⇒ 无法判定`)
  assert.equal(typeof TYPES_FACE, 'string', `${gate.TYPES_PATH} 的 HEAD blob 取不到 ⇒ 无法判定`)
  assert.ok(VALIDATOR_FACE.length > 1000 && TYPES_FACE.length > 1000, '取材面短到不可能是真源码 ⇒ 面读错了')

  assert.deepEqual(gate.check(VALIDATOR_FACE, TYPES_FACE), [], '真 HEAD 面被生产判据判红 ⇒ 门与面对不上,先疑尺子')
  for (const anchor of [ANCHOR_FACE, FALSE_IF_FACE, REASON_FACE, KEY_PATH_FACE, COERCE_FACE]) {
    assert.ok(VALIDATOR_FACE.includes(anchor), `真面里找不到锚「${anchor}」⇒ 判据钉的写法与真面对不上`)
  }
  assert.ok(TYPES_FACE.split(CLOSED_TOKEN).length - 1 >= 2, `${gate.TYPES_PATH} 真面的声明数不足 2,类型面判据无从成立`)
})

test('N2 五条判据各有阳性对照:每枚变异必须恰好红一条并点名其锚', () => {
  const seen = new Set()
  for (const mut of MUTATIONS) {
    const [vFace, tFace] = mut.face()
    assert.notEqual(vFace + tFace, VALIDATOR_FACE + TYPES_FACE, `${mut.name}:变异没生效 ⇒ 自证无效`)
    const failures = gate.check(vFace, tFace)
    assert.equal(failures.length, 1, `${mut.name} 应当只红一条,实得 ${JSON.stringify(failures)}`)
    assert.ok(failures[0].includes(mut.mustMention), `${mut.name} 的读数没点名锚「${mut.mustMention}」:「${failures[0]}」`)
    assert.ok(!seen.has(failures[0]), `两枚不同变异给出同一条读数(${failures[0]})⇒ 判据之间不可分辨`)
    seen.add(failures[0])
    // 还原面必须立刻转绿(证明红的是变异,不是判据本身)
    assert.deepEqual(gate.check(VALIDATOR_FACE, TYPES_FACE), [], '同轮里真面又变红了 ⇒ 判据不稳定')
  }
  assert.equal(seen.size, MUTATIONS.length, `${MUTATIONS.length} 条判据没各得一条读数`)
})

test('N3 反例配对:多补一处合法声明不得误红(锚点不能过紧)', () => {
  const augmented = [TYPES_FACE, 'export interface ProbeB76ExtraFace {', `  ${CLOSED_TOKEN}?: boolean;`, '}', ''].join('\n')
  assert.deepEqual(gate.check(VALIDATOR_FACE, augmented), [], `补一处合法声明被读成红:${JSON.stringify(gate.check(VALIDATOR_FACE, augmented))}`)
  assert.ok(augmented.split(CLOSED_TOKEN).length - 1 > TYPES_FACE.split(CLOSED_TOKEN).length - 1, '补充面没真的多一条声明 ⇒ 这一格没判到东西')
})

test('N4 CLI 退出码与生产判据同面自洽(不写死"此刻是绿的")', () => {
  const liveValidator = readFileSync(join(REPO, gate.VALIDATOR_PATH), 'utf8')
  const liveTypes = readFileSync(join(REPO, gate.TYPES_PATH), 'utf8')
  const expectFailures = gate.check(liveValidator, liveTypes)
  const r = runGate([])
  assert.notEqual(r.rc, 2, `CLI 在能取材的仓里 exit 2(未判定)是脚本自身异常:${r.all.slice(0, 400)}`)
  assert.equal(r.rc, expectFailures.length === 0 ? 0 : 1, `CLI 退出码与 check() 在同一份盘面上分叉:rc=${r.rc} failures=${JSON.stringify(expectFailures)}`)
  if (expectFailures.length === 0) assert.match(r.out, /PASS/)
  else assert.match(r.err, /FAIL/)
})

test('N5 门体自带的三臂自检必须真跑过(现读读数,不抄历史数字)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.rc, 0, `--self-test 应 exit 0,实得 ${r.rc}:${r.all.slice(0, 600)}`)
  const line = r.out.split(/\r?\n/).find((l) => l.includes('self-test:') && l.includes('/'))
  assert.ok(line, `自检末行读数换了形状:${r.out.slice(-300)}`)
  const after = line.slice(line.lastIndexOf('self-test:') + 'self-test:'.length).trim()
  const [passed, total] = after.split(/\s+/)[0].split('/')
  assert.ok(passed && total, `读数不像 n/n:${after}`)
  assert.equal(passed, total, `自检有失败臂:${after} —— ${r.out.slice(-300)}`)
  for (const arm of ['ST1', 'ST2', 'ST3']) {
    assert.ok(r.out.includes(`${arm} PASS`), `自检缺 ${arm} 这一臂:${r.out.slice(-300)}`)
  }
})

test('N6 取不到判未判定:任一取材文件缺失都不得记绿(exit 2 + UNDETERMINED)', () => {
  const empty = mkScratch('ihui-nested-ap-none-')
  try {
    const r = runGate([], empty)
    assert.equal(r.rc, 2, `无取材面应 exit 2,实得 ${r.rc}:${r.all.slice(0, 300)}`)
    assert.match(r.err, /UNDETERMINED/)
    assert.doesNotMatch(r.all, /PASS/, '取不到却说了 PASS ⇒ 把"没判"写成"判过了"')
  } finally {
    rmScratch(empty, { bestEffort: true })
  }

  const partial = mkScratch('ihui-nested-ap-partial-')
  try {
    const abs = join(partial, ...gate.VALIDATOR_PATH.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, VALIDATOR_FACE, 'utf8')
    const r = runGate([], partial)
    assert.equal(r.rc, 2, `只有一份取材面时应 exit 2,实得 ${r.rc}:${r.all.slice(0, 300)}`)
    assert.ok(r.err.includes(gate.TYPES_PATH), `点名的该是缺的那一份(${gate.TYPES_PATH}):${r.err}`)
  } finally {
    rmScratch(partial, { bestEffort: true })
  }
})

test('N7 测试不得重写判据(本文件只许调用门体导出的 check)', () => {
  const own = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    own.includes("import { __test__ as gate } from '../check-nested-additional-properties.mjs'"),
    '§22c 锚点:必须 import 门体导出的判据',
  )
  for (const name of Object.keys(gate)) {
    assert.ok(!own.includes(`function ${name}(`), `测试里出现了第二份 ${name} ⇒ 两处实现必漂移`)
    assert.ok(!own.includes(`const ${name} =`), `测试里重新声明了 ${name}`)
  }
  // 正向锁:五枚变异都必须由生产判据裁定(调用次数现读自本文件,不写死)
  const judgeCalls = own.split('gate.check(').length - 1
  assert.ok(judgeCalls >= MUTATIONS.length, `只有 ${judgeCalls} 处走 gate.check ⇒ 有变异没被生产判据裁定`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
