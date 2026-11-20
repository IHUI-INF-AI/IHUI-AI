// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜子:守门 `scripts/check-sqlite-write-paths.mjs` 的判据面形状锁。
 *
 * 钉住四件容易悄悄漂开的事:
 *  1. 命中族是**整串**匹配 —— 把针拆成两段字符串写,运行时等值、字面不再命中(本项目踩过的自伤);
 *  2. `SKIP_SELF` 必须同时含门体与本文件 —— 少一个,门就把自己判成"清单外新增"(恒红门);
 *  3. 豁免标记只认 `mode=ro` / `:memory:` 这一类"不是我们的存储"的形态,别的写法不得被静默放过;
 *  4. 基线口径 = "只许减不许增":同一份命中集,基线里有的算存量,基线里没有的算新增。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-sqlite-write-paths.mjs')

// 门体只在被当作脚本直跑时才执行 CLI,import 不会退进程(守卫在门体尾部)。
const { HIT_PATTERNS, ALLOW_MARKERS, classifyLine, countHits, diffAgainstBaseline, NON_STORE_FIXTURES } =
  await import(pathToFileURL(GATE).href)

// 针串拆写:本文件若把整串原样写进源码,门会把这一行当命中族(它就是整串匹配)。
const PY_CONNECT = 'sqlite3' + '.connect('
const PY_AIOSQLITE = 'aio' + 'sqlite'
const JS_BETTER = 'better-' + 'sqlite3'
const JS_DATABASE = 'sqlite3' + '.Database'
const JS_NEW_DB = 'new ' + 'Database('

test('命中族覆盖 py/js 五种打开形态', () => {
  const ids = HIT_PATTERNS.map((p) => p.id)
  assert.deepEqual(ids, [
    'py-connect',
    'py-aiosqlite',
    'js-better-sqlite3',
    'js-sqlite3-database',
    'js-new-database',
  ])
})

test('命中族按整串识别:拆开的针串不算命中(自伤护栏)', () => {
  assert.equal(classifyLine(`conn = ${PY_CONNECT}str(db))`), 'py-connect')
  assert.equal(classifyLine(`x = 'sqlite3' '.connect('`), null)
  assert.equal(classifyLine(`await ${PY_AIOSQLITE}.connect(path)`), 'py-aiosqlite')
  assert.equal(classifyLine(`x = 'aio' 'sqlite'`), null)
  assert.equal(classifyLine(`require('${JS_BETTER}')`), 'js-better-sqlite3')
  assert.equal(classifyLine(`const d = ${JS_DATABASE}`), 'js-sqlite3-database')
  assert.equal(classifyLine(`const d = ${JS_NEW_DB}'x.db')`), 'js-new-database')
})

test('豁免标记:只读与内存库不算写路径', () => {
  assert.deepEqual([...ALLOW_MARKERS].sort(), [':memory:', 'mode=ro', 'mode: "ro"', "mode: 'ro'"].sort())
  assert.equal(classifyLine(`con = ${PY_CONNECT}f"file:{dst}?mode=ro", uri=True)`), null)
  assert.equal(classifyLine(`con = ${PY_CONNECT}':memory:')`), null)
  // 只读豁免不该顺手放过写形态:同一行既有 mode=ro 又有 normal 写法时,按"存在豁免标记"整行不算
  assert.equal(classifyLine(`con = ${PY_CONNECT}'prod.db')`), 'py-connect')
})

test('countHits 逐行计一次,不按正则命中次数累计', () => {
  const content = [
    `a = ${PY_CONNECT}'x')`,
    `b = ${PY_CONNECT}'x'); c = ${PY_AIOSQLITE}`,
    'plain line',
    '',
  ].join('\n')
  assert.equal(countHits(content), 2)
})

test('diffAgainstBaseline 只认新增(基线内算存量,超出的算新增)', () => {
  const hits = new Map([
    ['apps/a.py', 1],
    ['apps/b.py', 2],
    ['apps/c.py', 1],
  ])
  const baseline = { files: { 'apps/a.py': 1, 'apps/b.py': 2 } }
  const diff = diffAgainstBaseline(hits, baseline)
  const addedFiles = (diff.newHits ?? diff.added ?? []).map?.((x) => x.path ?? x.file ?? x) ?? []
  assert.ok(
    JSON.stringify(diff).includes('apps/c.py'),
    `新增集必须点名 apps/c.py,实际:${JSON.stringify(diff)}`,
  )
  assert.ok(!addedFiles.includes('apps/a.py'), '基线内文件不得被算成新增')
})

test('SKIP_SELF 同时含门体与本文件(否则门量自己=恒红)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const SKIP_SELF = new Set\(\[/)
  assert.ok(src.includes("'scripts/check-sqlite-write-paths.mjs'"), 'SKIP_SELF 必须含门体')
  assert.ok(src.includes("'scripts/tests/check-sqlite-write-paths.test.mjs'"), 'SKIP_SELF 必须含本镜像')
})

test('NON_STORE_FIXTURES:自有写路径清零后只留两条"不是我们的存储"的豁免', () => {
  // 零容忍生效后,豁免表就是唯一还能放行 sqlite 字面的地方 —— 所以它必须窄、必须带理由:
  // 多一条等于悄悄重开一个后门,少一条等于把别人的格式判成我们的违规。
  assert.ok(NON_STORE_FIXTURES instanceof Map, 'NON_STORE_FIXTURES 必须是带理由的 Map')
  assert.deepEqual([...NON_STORE_FIXTURES.keys()].sort(), [
    'apps/ai-service/tests/test_external_browser_profile.py',
    'apps/ai-service/tests/test_sag2_pg_integration.py',
  ])
  for (const [rel, reason] of NON_STORE_FIXTURES) {
    assert.ok(typeof reason === 'string' && reason.trim().length >= 8, `${rel} 的豁免理由太短`)
  }
})

test('预筛(gt;grep -l)不得变成第二份判据,且必须留对账档与全量逃生舱', () => {
  // 2026-11-20 立:全域触发面 × 逐个 blob 精读 ⇒ 每次提交 12–14 秒。治法是用宽正则先捞候选文件,
  // 但"捞候选"一旦变成"自己判命中",就等于写了第二把尺子(§0.6)⇒ 这里钉住三条:
  //  ① 候选只按 GREP_RE 宽匹配捞文件,精确计数仍只走 classifyLine / countHits;
  //  ② 必须存在 --parity 对账档(预筛 vs 全量逐文件比,不等即 exit 1);
  //  ③ 必须有 IHUI_SQLITE_GATE_FULL_SCAN=1 全量逃生舱与"预筛失败退全量"的降级分支。
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /export const GREP_RE =/, '必须导出一条宽正则供预筛使用')
  assert.match(src, /const n = countHits\(content\)/, '精确计数必须仍走 countHits')
  assert.match(src, /function grepCandidates/, '预筛必须只有一条实现(grepCandidates)')
  assert.match(src, /function parityCheck/, '必须提供 --parity 对账档')
  assert.match(src, /SQLITE-WRITE-PATHS-PARITY state=(equal|mismatch)/, '对账档必须有机读末行')
  assert.match(src, /IHUI_SQLITE_GATE_FULL_SCAN/, '必须留全量逃生舱')
  assert.match(src, /预筛不可用.*退回全量逐 blob 扫描/s, '预筛失败必须降级到全量而不是判红/判绿')
  // 宽正则不得含 POSIX ERE 不认的 \b / \s(那样 grep 会静默漏捞 ⇒ 假绿)
  const re = src.match(/export const GREP_RE =\s*\n?\s*'([^']+)'/)?.[1] ?? ''
  assert.ok(re.length > 10, 'GREP_RE 取值必须可解析')
  assert.ok(!/\\b|\\s/.test(re), `GREP_RE 不得使用 \\b / \\s(POSIX ERE 不认):${re}`)
})

test('预筛 vs 全量:同一份命中集必须逐文件相等(变体红 + 对账同轮)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pgonly-'))
  const git = (...args) => execFileSync('git', args, { cwd: tmp, encoding: 'utf8' })
  try {
    git('init', '-q')
    git('config', 'user.email', 't@t')
    git('config', 'user.name', 't')
    mkdirSync(join(tmp, 'scripts', 'data'), { recursive: true })
    mkdirSync(join(tmp, 'apps', 'x'), { recursive: true })
    writeFileSync(
      join(tmp, 'scripts', 'data', 'sqlite-write-paths-baseline.json'),
      JSON.stringify({ files: {} }),
      'utf8',
    )
    // 一处真命中 + 一处只读豁免(同一行 mode=ro)+ 一处拆开的针串(不该算)
    writeFileSync(join(tmp, 'apps', 'x', 'store.py'), ['import sqlite3', `conn = ${PY_CONNECT}'a.db')`].join('\n'), 'utf8')
    writeFileSync(
      join(tmp, 'apps', 'x', 'reader.py'),
      `conn = ${PY_CONNECT}` + "'file:p.db?mode=ro', uri=True)",
      'utf8',
    )
    writeFileSync(join(tmp, 'apps', 'x', 'nonhit.py'), `x = 'sqlite3' '.connect('`, 'utf8')
    // 豁免路径必须在面内存在:否则门按"豁免清单腐烂"判红(那是另一条判据,不是本用例要测的)
    mkdirSync(join(tmp, 'apps', 'ai-service', 'tests'), { recursive: true })
    for (const p of ['test_external_browser_profile.py', 'test_sag2_pg_integration.py']) {
      writeFileSync(join(tmp, 'apps', 'ai-service', 'tests', p), '# fixture\n', 'utf8')
    }
    git('add', '.')

    // 门判红时 exit 1 ⇒ execFileSync 会抛,统一在 helper 里把 stdout 取回来(判红是预期结果)
    const runGate = (...args) => {
      try {
        return execFileSync(process.execPath, [GATE, '--root', tmp, ...args], { encoding: 'utf8' })
      } catch (e) {
        return String(e.stdout ?? '')
      }
    }

    const staged = runGate('--staged')
    assert.match(staged, /state=new new=1/, `真命中必须判红且只点名 store.py:${staged}`)
    assert.match(staged, /apps\/x\/store\.py/, '新增必须点名具体文件')
    assert.doesNotMatch(staged, /apps\/x\/nonhit\.py/, '拆开的针串不得算命中')

    const parity = runGate('--parity', '--staged')
    assert.match(parity, /SQLITE-WRITE-PATHS-PARITY state=equal/, `对账必须相等:${parity}`)

    const forced = (() => {
      const env = { ...process.env, IHUI_SQLITE_GATE_FULL_SCAN: '1' }
      try {
        return execFileSync(process.execPath, [GATE, '--root', tmp, '--staged'], { encoding: 'utf8', env })
      } catch (e) {
        return String(e.stdout ?? '')
      }
    })()
    assert.match(forced, /state=new new=1/, '全量逃生舱必须给同一个结论')
    assert.equal(staged.includes('new=1'), forced.includes('new=1'), '预筛与全量结论必须一致')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('零容忍接线:扫描面排除豁免表,且豁免路径消失必须判红(不留空豁免)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /!SKIP_SELF\.has\(rel\)\s*&&\s*!NON_STORE_FIXTURES\.has\(rel\)/,
    '扫描 targets 必须同时排除 SKIP_SELF 与 NON_STORE_FIXTURES',
  )
  assert.match(src, /const lapsed = \[\.\.\.NON_STORE_FIXTURES\.keys\(\)\]\.filter/, '必须核对豁免路径存活')
  assert.match(src, /state=new new='\s*\+\s*lapsed\.length/, '豁免到期必须以 state=new 判红')
  // 基线口径已是"零":基线文件里不允许再出现任何 files 条目
  const baseline = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'data', 'sqlite-write-paths-baseline.json'), 'utf8'),
  )
  assert.deepEqual(baseline.files ?? {}, {}, '自有写路径清零后基线必须为空')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
