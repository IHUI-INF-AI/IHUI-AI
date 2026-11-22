#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:gate-grow.mjs(守门规则自生长候选生成器)。
 *
 * 判据全部 import 生产实现(§22c),本文件不复制任何正则/清单。钉七环:
 *  ① 注册表解析:多行/单行条目 + 条目内 `    ]` 缩进闭合不得被当成外层数组边界;
 *  ② 坏注册表(零条目/未闭合)一律 RegistryShapeError,不静默当空;
 *  ③ 触发面归一化:模块定向与全仓触发面严格分开;
 *  ④ 三态判定:定向=已有 / 无定向=缺失 / 注册表坏=全未判定;
 *  ⑤ 候选形状:合法通过;mode/触发面/判据库路径越界都点名;
 *  ⑥ 人工阀双开关:四格里只有双开才 ok;
 *  ⑦ 写单一真源:有新增才备份,备份与写前字节同值,重复写不二次备份。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  RegistryShapeError,
  applyLibs,
  audit,
  backupFileOf,
  buildCandidates,
  candidateFor,
  humanValve,
  judgeModules,
  normalizeTrigger,
  parseRegistrySource,
  validateCandidate,
} from '../gate-grow.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const REGISTRY = [
  'const checks = [',
  '  {',
  "    id: '1',",
  "    label: 'a',",
  "    script: 'check-a.mjs',",
  '    args: [],',
  "    mode: 'blocking',",
  "    stagedTriggers: ['apps/a/src/'],",
  '    onFailHint: [',
  "      '',",
  '    ]',
  '  },',
  "  { id: '2', label: 'b', script: 'check-b.mjs', args: ['--target=a'], mode: 'warn', stagedTriggers: ['apps/'] },",
  ']',
  'const pushGateChecks = [',
  '  {',
  "    id: 'T1',",
  "    label: 'push',",
  "    script: 'check-t.mjs',",
  '    args: [],',
  "    mode: 'blocking',",
  '  },',
  ']',
].join('\n')

const normalizePath = (p) => String(p).replace(/\\/g, '/')

test('注册表解析:单行/多行条目都认;缩进 `]` 不当外层数组边界', () => {
  const parsed = parseRegistrySource(REGISTRY)
  assert.equal(parsed.entries.length, 3)
  assert.deepEqual(parsed.arrays.map((a) => a.name), ['checks', 'pushGateChecks'])

  const first = parsed.entries.find((e) => e.id === '1')
  assert.equal(first.stagedTriggers[0], 'apps/a/src/')
  assert.deepEqual(first.args, [])
  assert.equal(first.mode, 'blocking')

  const second = parsed.entries.find((e) => e.id === '2')
  assert.equal(second.label, 'b')
  assert.deepEqual(second.args, ['--target=a'])
})

test('注册表解析:零条目/数组未闭合 ⇒ RegistryShapeError', () => {
  for (const bad of ['const checks = []', "const checks = [\n  {\n    id: '1',"]) {
    assert.throws(() => parseRegistrySource(bad), RegistryShapeError)
  }
})

test('触发面归一化:模块定向 vs 全仓触发面不混算', () => {
  assert.equal(normalizeTrigger('apps/mobile-rn/**'), 'apps/mobile-rn')
  assert.equal(normalizeTrigger('apps/ai-service/'), 'apps/ai-service')
  assert.equal(normalizeTrigger('apps/'), 'apps')
  assert.equal(normalizeTrigger('packages/**/*.ts'), 'packages/**/*.ts')
  assert.equal(normalizeTrigger(''), '')
})

test('三态判定:定向=已有 / 无定向=缺失 / 注册表坏=全未判定', () => {
  const modules = [
    { path: 'apps/a', name: 'a', kind: 'app' },
    { path: 'apps/b', name: 'b', kind: 'app' },
    { path: 'packages/c', name: 'c', kind: 'package' },
  ]
  const ok = {
    status: 'ok',
    entries: [
      { id: '1', script: 'check-a.mjs', stagedTriggers: ['apps/a/src/'] },
      { id: '2', script: 'check-all.mjs', stagedTriggers: ['apps/', 'packages/**/*.ts'] },
    ],
  }
  const judged = judgeModules(modules, ok)
  assert.equal(judged[0].status, 'covered')
  assert.equal(judged[1].status, 'missing')
  assert.equal(judged[2].status, 'missing')

  const broken = judgeModules(modules, { status: 'undetermined', why: 'format drift' })
  assert.ok(broken.every((m) => m.status === 'undetermined'))

  const missingRegistry = judgeModules(modules, { status: 'ok', entries: [] })
  assert.ok(missingRegistry.every((m) => m.status === 'missing'))
})

test('全量读数:注册表读不到 ⇒ 模块仍枚举,但三态全未判定', () => {
  const io = {
    readdir: (p) => {
      const n = normalizePath(p)
      if (n.endsWith('/apps')) return [{ name: 'a', isDirectory: () => true }]
      if (n.endsWith('/packages')) return []
      return []
    },
    exists: (p) => normalizePath(p).endsWith('/apps/a/package.json'),
    readFile: () => {
      throw new Error('ENOENT')
    },
  }
  const result = audit('/fixture', io)
  assert.equal(result.counts.total, 1)
  assert.equal(result.counts.covered, 0)
  assert.equal(result.counts.undetermined, 1)
  assert.equal(result.status, 'undetermined')
})

test('候选形状:合法通过;mode/触发面/判据库路径越界都点名', () => {
  const candidate = candidateFor({ path: 'apps/a', name: 'a', kind: 'app' }, '/fixture', () => false)
  assert.deepEqual(validateCandidate(candidate), [])
  assert.equal(candidate.scriptExists, false)
  assert.equal(candidate.singleSource.file, 'scripts/lib/judgement-libs.json')
  assert.deepEqual(candidate.singleSource.libs, [])

  const badMode = structuredClone(candidate)
  badMode.gate.mode = 'always'
  assert.ok(validateCandidate(badMode).some((p) => p.includes('mode')))

  const badTrigger = structuredClone(candidate)
  badTrigger.gate.stagedTriggers = ['apps/other/']
  assert.ok(validateCandidate(badTrigger).some((p) => p.includes('未落在 module')))

  const badLib = structuredClone(candidate)
  badLib.singleSource.libs = ['scripts/not-lib.mjs']
  assert.ok(validateCandidate(badLib).some((p) => p.includes('scripts/lib')))

  assert.deepEqual(buildCandidates({ modules: [{ path: 'apps/a', name: 'a', kind: 'app', status: 'missing' }] }, '/fixture', () => false).length, 1)
})

test('人工阀:双开关四格里只有全开才 ok', () => {
  const cases = [
    [{ approved: '', env: '1' }, false],
    [{ approved: '工单-1', env: '' }, false],
    [{ approved: '', env: '' }, false],
    [{ approved: '工单-1', env: '1' }, true],
  ]
  for (const [input, expected] of cases) assert.equal(humanValve(input).ok, expected)
})

test('写单一真源:有新增才备份,备份与写前字节同值,重复写不二次备份', () => {
  const dir = mkScratch('gate-grow-test-')
  try {
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    const before = '[\n  "scripts/lib/a.mjs"\n]\n'
    writeFileSync(join(dir, 'scripts', 'lib', 'judgement-libs.json'), before, 'utf8')
    writeFileSync(join(dir, 'scripts', 'lib', 'a.mjs'), '// a\n', 'utf8')
    writeFileSync(join(dir, 'scripts', 'lib', 'b.mjs'), '// b\n', 'utf8')

    const first = applyLibs({ root: dir, libs: ['scripts/lib/b.mjs'] })
    assert.equal(first.changed, true)
    assert.equal(first.added.length, 1)
    assert.equal(readFileSync(backupFileOf(dir), 'utf8'), before)

    const merged = JSON.parse(readFileSync(join(dir, 'scripts', 'lib', 'judgement-libs.json'), 'utf8'))
    assert.deepEqual(merged, ['scripts/lib/a.mjs', 'scripts/lib/b.mjs'])

    const again = applyLibs({ root: dir, libs: ['scripts/lib/b.mjs'] })
    assert.equal(again.changed, false)

    assert.throws(() => applyLibs({ root: dir, libs: ['scripts/lib/nope.mjs'] }), /不在盘上/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
