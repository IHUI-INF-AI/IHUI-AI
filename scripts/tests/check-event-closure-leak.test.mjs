// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-event-closure-leak.test.mjs — 门体「可导入性 + 判据」镜像测试(台账 G-239)。
 *
 * 判据一律 import 门体导出的 __test__ 并调用(§22c:镜像只复读实现就是复读机)。
 * 门体此前顶层裸 process.exit(main()),import 会当场终结宿主进程;下面第一句 import
 * 就是守卫在位的阳性证明,T4 再用独立子进程复验。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { __test__ as gate } from '../check-event-closure-leak.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-event-closure-leak.mjs')

test('T1 门体导出判据单元(不是把判据抄进测试)', () => {
  for (const k of ['findAsyncCallbacks', 'findForbiddenAccessInCallback', 'findViolations', 'main'])
    assert.equal(typeof gate[k], 'function', `__test__ 缺导出 ${k}`)
  assert.ok(Array.isArray(gate.ASYNC_TRIGGERS) && gate.ASYNC_TRIGGERS.length > 0, '触发器清单必须导出')
  assert.ok(
    Array.isArray(gate.FORBIDDEN_EVENT_ACCESS) && gate.FORBIDDEN_EVENT_ACCESS.length > 0,
    '禁用访问清单必须导出',
  )
})

test('T2 阳性:异步闭包内访问 event 属性必须判出(行号随回调锚定)', () => {
  const src = [
    'useEffect(() => {',
    '  setTimeout(() => {',
    '    setAnchor((prev) => (prev ? null : e.currentTarget))',
    '  }, 100)',
    '}, [])',
  ].join('\n')
  const callbacks = gate.findAsyncCallbacks(src)
  assert.equal(callbacks.length, 1, '应精确提取 1 个异步回调')
  assert.equal(callbacks[0].trigger, 'setTimeout')
  const violations = gate.findViolations(src, 'a.tsx')
  assert.equal(violations.length, 1, `应判 1 处反模式,实得 ${JSON.stringify(violations)}`)
  assert.equal(violations[0].access, 'e.currentTarget')
  assert.equal(violations[0].line, 3, '命中行必须落在访问那一行')
})

test('T3 阴性:同步 handler 内访问合法;异步闭包只碰缓存值也合法', () => {
  const sync = ['const onClick = (e) => setAnchor(e.currentTarget)'].join('\n')
  assert.deepEqual(gate.findViolations(sync, 'b.tsx'), [], '同步 handler 内访问不得判红')
  const cached = ['setTimeout(() => setAnchor(el), 10)'].join('\n')
  assert.deepEqual(gate.findViolations(cached, 'b.tsx'), [], '闭包内只碰缓存变量不得判红')
})

test('T4 独立子进程 import 门体不得触发 CLI(§22d 立身之本)', () => {
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  assert.equal(r.status, 0, `import 门体不得非零退出:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /__IMPORTED__/, '子进程未走到哨兵行,import 可能被判死')
  assert.doesNotMatch(r.stdout, /event-closure-leak: 扫描/, 'import 即执行扫描 ⇒ 顶层裸 main() 回来了')
})

// ─── 三态:取不到输入 ⇒ exit 2,真 0 ⇒ exit 0(2026-11-04 假绿专项) ───

function runGate(dir, args) {
  return spawnSync(process.execPath, [GATE, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
}

function git(dir, ...args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  })
}

function initRepo(dir) {
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 't@t')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'README.md'), '# init\n')
  git(dir, 'add', 'README.md')
  git(dir, 'commit', '-qm', 'init')
}

test('T5 未判定: --staged 非 git 目录 ⇒ exit 2(不得冒充"无文件需扫描")', () => {
  const dir = mkScratch('event-nogit-')
  try {
    const r = runGate(dir, ['--staged'])
    assert.equal(r.status, 2, `应 exit 2,实得 ${r.status}\n${r.stdout}${r.stderr}`)
    assert.match(r.stderr, /面取不到|未判定/, '必须点名取材失败')
  } finally {
    rmScratch(dir)
  }
})

test('T6 未判定: 显式文件不存在 ⇒ exit 2(点名路径)', () => {
  const dir = mkScratch('event-missing-')
  try {
    const r = runGate(dir, ['nope.tsx'])
    assert.equal(r.status, 2, `应 exit 2,实得 ${r.status}\n${r.stdout}${r.stderr}`)
    assert.match(r.stderr, /nope\.tsx/, '必须点名不存在的文件')
  } finally {
    rmScratch(dir)
  }
})

test('T7 真 0: --staged git 仓库确认为空 ⇒ exit 0 并显式打印不适用', () => {
  const dir = mkScratch('event-empty-')
  try {
    initRepo(dir)
    const r = runGate(dir, ['--staged'])
    assert.equal(r.status, 0, `真 0 应 exit 0,实得 ${r.status}\n${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /不适用/, '真空集必须显式说明')
  } finally {
    rmScratch(dir)
  }
})

test('T8 真 0/真红: 显式文件 0 命中 ⇒ 0,有反模式 ⇒ 1', () => {
  const dir = mkScratch('event-files-')
  try {
    writeFileSync(join(dir, 'ok.tsx'), 'setTimeout(() => setAnchor(el), 10)\n')
    const ok = runGate(dir, ['ok.tsx'])
    assert.equal(ok.status, 0, `0 命中应 exit 0,实得 ${ok.status}\n${ok.stdout}${ok.stderr}`)
    assert.match(ok.stdout, /0 命中/)

    writeFileSync(join(dir, 'bad.tsx'), 'setTimeout(() => setAnchor(e.currentTarget), 10)\n')
    const bad = runGate(dir, ['bad.tsx'])
    assert.equal(bad.status, 1, `有反模式应 exit 1,实得 ${bad.status}\n${bad.stdout}${bad.stderr}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
