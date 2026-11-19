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
import { readFileSync } from 'node:fs'
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
