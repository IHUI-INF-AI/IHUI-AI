// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像常量守门模式:测试直接 import 源脚本的 __test__,不复制任何实现,
// 杜绝"源/测两份真相"漂移。§22d:源脚本 main() 受 isDirectRun 守护,被 import 时零副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import { __test__ as src } from '../check-uncommitted-age.mjs'

const NOW = 1_700_000_000_000
/** 造一个"年龄 = ageMin 分钟"的条目 */
const stat = (path, ageMin) => ({ path, mtimeMs: NOW - ageMin * 60_000 })
/** 把文件清单包成 porcelain 条目(modified) */
const asModified = (files) => files.map((f) => ({ path: f, status: ' M', untracked: false }))
/** 端到端:收集层过滤 → 年龄判定(过滤职责在收集层,不在年龄层) */
const evaluate = (files, thresholdMin = 45) =>
  src.classifyByAge(
    src
      .collectCandidatePaths(asModified(files), () => [])
      .map((f) => stat(f, thresholdMin * 2)),
    thresholdMin,
    NOW,
  )

test('__test__ 导出形状齐全(§22c 锚点,重命名即失败)', () => {
  for (const key of [
    'parsePorcelainZ',
    'normalizePath',
    'isSourceFile',
    'isExemptPath',
    'isCandidatePath',
    'collectCandidatePaths',
    'resolveThresholdMin',
    'classifyByAge',
    'formatAge',
    'runSelfTest',
    'SOURCE_EXTS',
    'EXCLUDED_DIRS',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof src.parsePorcelainZ, 'function')
})

test('导入源模块未触发 main() 副作用(§22d isDirectRun)', () => {
  // 若 main() 被误执行,进程会在 import 阶段 process.exit,本文件断言根本跑不到。
  // 再显式核对:被 import 时 process.argv[1] 是本测试文件而非源脚本。
  assert.notEqual(
    import.meta.url,
    pathToFileURL(resolve('scripts/check-uncommitted-age.mjs')).href,
  )
})

// ─── 四类基础判据 ───────────────────────────────────────────
test('① 无改动 = pass', () => {
  assert.deepEqual(src.parsePorcelainZ(''), [])
  assert.deepEqual(src.parsePorcelainZ('\n'), [])
  const r = src.classifyByAge([], 45, NOW)
  assert.equal(r.scanned, 0)
  assert.equal(r.risky.length, 0)
})

test('② 新改动(阈值内)= pass', () => {
  const r = src.classifyByAge([stat('apps/web/src/a.ts', 10)], 45, NOW)
  assert.equal(r.scanned, 1)
  assert.equal(r.risky.length, 0)
})

test('③ 老改动(超阈值)= fail', () => {
  const r = src.classifyByAge([stat('apps/api/src/routes/x.ts', 120)], 45, NOW)
  assert.equal(r.risky.length, 1)
  assert.equal(r.risky[0].file, 'apps/api/src/routes/x.ts')
  assert.equal(r.risky[0].ageMs, 120 * 60_000)
})

test('④ 豁免目录 = fail 不成立(超龄豁免文件一律不报)', () => {
  const exempt = [
    '.ihui-agent/tmp/probe/old.ts',
    'node_modules/pkg/index.ts',
    'apps/web/dist/old.js',
    'apps/web/.next/static/chunk.ts',
    'packages/i18n/generated/remote-locales.gen.ts',
    'apps/api/.env.local',
    'docs/notes.md',
  ]
  assert.deepEqual(exempt.filter(src.isCandidatePath), [])
  assert.equal(evaluate(exempt).risky.length, 0)
})

test('阈值边界:严格大于才报(恰好等于不报)', () => {
  assert.equal(src.classifyByAge([stat('a.ts', 45)], 45, NOW).risky.length, 0)
  assert.equal(src.classifyByAge([stat('a.ts', 46)], 45, NOW).risky.length, 1)
})

// ─── porcelain -z 解析 ─────────────────────────────────────
test('parsePorcelainZ:modified / untracked / rename 三类条目', () => {
  const parsed = src.parsePorcelainZ(' M apps/web/src/a.ts\0?? scripts/new.mjs\0R  apps/new.ts\0apps/old.ts\0')
  assert.deepEqual(
    parsed.map((p) => p.path),
    ['apps/web/src/a.ts', 'scripts/new.mjs', 'apps/new.ts'],
  )
  assert.equal(parsed[0].untracked, false)
  assert.equal(parsed[1].untracked, true)
})

test('parsePorcelainZ:rename 的 origin path 被跳过(不重复计入)', () => {
  const parsed = src.parsePorcelainZ('R  apps/new.ts\0apps/old.ts\0')
  assert.equal(parsed.length, 1)
  assert.ok(!parsed.some((p) => p.path === 'apps/old.ts'))
})

test('parsePorcelainZ:Windows 反斜杠归一为 /', () => {
  assert.equal(src.parsePorcelainZ(' M apps\\web\\b.ts\0')[0].path, 'apps/web/b.ts')
  assert.equal(src.normalizePath('a\\b\\c.ts'), 'a/b/c.ts')
})

test('parsePorcelainZ:未跟踪目录以 / 结尾,原样保留待展开', () => {
  const parsed = src.parsePorcelainZ('?? scripts/probe/\0')
  assert.equal(parsed[0].path, 'scripts/probe/')
  assert.equal(src.isCandidatePath('scripts/probe/'), false)
})

// ─── 源码判据 / 豁免口径 ────────────────────────────────────
test('isSourceFile:九类扩展名全认,其余不认', () => {
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.css', '.sql']) {
    assert.equal(src.isSourceFile(`p/f${ext}`), true, ext)
  }
  for (const p of ['README.md', 'x.json', 'Dockerfile', 'a.ts.map', 'img.png', 'no_ext']) {
    assert.equal(src.isSourceFile(p), false, p)
  }
})

test('isExemptPath:目录段命中排除清单 + 点文件 + 生成物', () => {
  assert.equal(src.isExemptPath('.ihui-agent/tmp/a.ts'), true)
  assert.equal(src.isExemptPath('a/generated/b.ts'), true)
  assert.equal(src.isExemptPath('apps/api/.env'), true)
  assert.equal(src.isExemptPath('.env.production'), true)
  assert.equal(src.isExemptPath('src/x.gen.ts'), true)
  assert.equal(src.isExemptPath('src/x.ts'), false)
  assert.equal(src.EXCLUDED_DIRS.has('node_modules'), true)
  assert.equal(src.EXCLUDED_DIRS.has('dist'), true)
})

test('isExemptPath:文件名含 env/gen 子串不得误豁免(防过度豁免)', () => {
  assert.equal(src.isExemptPath('src/environment_context.py'), false)
  assert.equal(src.isExemptPath('src/agent-model.ts'), false)
})

test('collectCandidatePaths:未跟踪目录交给注入的 listFiles 展开且二次过滤', () => {
  const entries = [
    { path: 'scripts/probe/', status: '??', untracked: true },
    { path: 'a.ts', status: ' M', untracked: false },
  ]
  // 故意返回未过滤清单(含 md / 豁免目录)→ 收集层必须自己挡掉
  const raw = ['scripts/probe/old.ts', 'scripts/probe/readme.md', 'node_modules/x/y.ts']
  assert.deepEqual(src.collectCandidatePaths(entries, () => raw), ['a.ts', 'scripts/probe/old.ts'])
})

test('collectCandidatePaths:豁免目录不触发展开 + 去重', () => {
  let called = 0
  const list = () => {
    called++
    return []
  }
  src.collectCandidatePaths([{ path: 'node_modules/x/', status: '??' }], list)
  assert.equal(called, 0)
  const dup = src.collectCandidatePaths(
    [
      { path: 'a.ts', status: ' M' },
      { path: 'a.ts', status: ' M' },
    ],
    () => [],
  )
  assert.deepEqual(dup, ['a.ts'])
})

// ─── 阈值解析 ─────────────────────────────────────────────
test('resolveThresholdMin:CLI(两种写法)> env > 默认 45', () => {
  assert.equal(src.resolveThresholdMin([], {}), src.DEFAULT_THRESHOLD_MIN)
  assert.equal(src.resolveThresholdMin([], { IHUI_UNCOMMITTED_AGE_MIN: '10' }), 10)
  assert.equal(src.resolveThresholdMin(['--threshold-min=5'], { IHUI_UNCOMMITTED_AGE_MIN: '10' }), 5)
  assert.equal(src.resolveThresholdMin(['--threshold-min', '7'], {}), 7)
  assert.equal(src.resolveThresholdMin(['--threshold-min=abc'], { IHUI_UNCOMMITTED_AGE_MIN: '-1' }), 45)
})

// ─── 报告可读性 / 排序 ────────────────────────────────────
test('classifyByAge:最老的排前面(报告按风险排序)', () => {
  const r = src.classifyByAge([stat('new.ts', 50), stat('oldest.ts', 500), stat('mid.ts', 100)], 45, NOW)
  assert.deepEqual(
    r.risky.map((x) => x.file),
    ['oldest.ts', 'mid.ts', 'new.ts'],
  )
})

test('formatAge:分钟 / 小时 / 天三档', () => {
  assert.match(src.formatAge(20 * 60_000), /分钟$/)
  assert.match(src.formatAge(5 * 3_600_000), /小时$/)
  assert.match(src.formatAge(3 * 86_400_000), /天$/)
})

test('报告只含文件名与年龄,不含任何文件内容', () => {
  const r = src.classifyByAge([stat('apps/api/.env', 600)], 45, NOW)
  const serialized = JSON.stringify(r)
  assert.ok(!/SECRET|PASSWORD|BEGIN PRIVATE/i.test(serialized))
  assert.ok(r.risky.every((x) => Object.keys(x).sort().join(',') === 'ageMs,file'))
})

test('源脚本内置 --self-test 用例全绿(与 CLI 同一套判据)', () => {
  const failed = src.runSelfTest().filter((r) => !r.pass)
  assert.deepEqual(failed, [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
