#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-gate-rot.mjs(O65 第 3 期「判据腐烂自检」)。
 *
 * 判据全部 import 生产实现(§22c)。钉五环:
 *  ① 注册表抽取只认字段行 `script: '<name>'`,散文里的 `node scripts/x.mjs` 不算引用;
 *  ② 判据库 JSON 形状坏(非数组/空/非字符串/坏 JSON)一律拒绝,不静默当空;
 *  ③ 存在性判定:缺失进 rot,存在不进;修法提示区分"改路径"与"摘除";
 *  ④ 全量读数三档:clean / rot / undetermined(源读不到 ⇒ 未判定优先);
 *  ⑤ CLI 真跑(--root 夹具仓):三档退出码 0/1/2 与 --json 形状。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  RotShapeError,
  audit,
  checkRefs,
  extractRegistryRefs,
  parseLibRefs,
  resolveRef,
  suggestFix,
} from '../check-gate-rot.mjs'

const SCRIPT = fileURLToPath(new URL('../check-gate-rot.mjs', import.meta.url))
const normalize = (p) => String(p).replace(/\\/g, '/')

const REGISTRY = ['const checks = [', '  {', "    id: '1',", "    label: 'a',", "    script: 'check-a.mjs',", '  },', ']'].join('\n')

function makeRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'gate-rot-'))
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), REGISTRY, 'utf8')
  writeFileSync(join(dir, 'scripts', 'lib', 'judgement-libs.json'), '["scripts/lib/a.mjs"]', 'utf8')
  writeFileSync(join(dir, 'scripts', 'lib', 'a.mjs'), '// x\n', 'utf8')
  writeFileSync(join(dir, 'scripts', 'check-a.mjs'), '// x\n', 'utf8')
  return dir
}

test('注册表抽取:只认字段行并带 id;散文引用不算', () => {
  const refs = extractRegistryRefs(REGISTRY)
  assert.equal(refs.length, 1)
  assert.deepEqual(refs[0], { id: '1', ref: 'check-a.mjs' })

  const prose = ["    onFailHint: [", "      '     1. node scripts/check-a.mjs  (定位)',", '    ],'].join('\n')
  assert.equal(extractRegistryRefs(prose).length, 0)
  assert.equal(extractRegistryRefs('').length, 0)
})

test('判据库解析:形状坏一律 throw(不静默当空)', () => {
  for (const bad of ['{}', '[]', '[1]', '[""]', 'not-json']) {
    assert.throws(() => parseLibRefs(bad), RotShapeError, `未拒绝:${bad}`)
  }
  assert.deepEqual(parseLibRefs('["scripts/lib/a.mjs"]'), ['scripts/lib/a.mjs'])
})

test('引用解析与存在性:缺失进 rot、存在不进', () => {
  assert.equal(resolveRef('check-a.mjs'), 'scripts/check-a.mjs')
  assert.equal(resolveRef('scripts/lib/a.mjs'), 'scripts/lib/a.mjs')
  assert.equal(resolveRef('   '), '')

  const rot = checkRefs(
    [
      { source: 'guardian-registry', id: '1', ref: 'ok.mjs' },
      { source: 'guardian-registry', id: '2', ref: 'gone.mjs' },
    ],
    (p) => p === 'scripts/ok.mjs',
  )
  assert.equal(rot.length, 1)
  assert.equal(rot[0].resolved, 'scripts/gone.mjs')
})

test('修法提示:同名脚本在 scripts/ 根下 ⇒ 改路径;否则摘除;注册表项 ⇒ 补回或摘除', () => {
  const s = suggestFix(
    [
      { source: 'judgement-libs', ref: 'scripts/lib/git-lock.mjs', resolved: 'scripts/lib/git-lock.mjs' },
      { source: 'judgement-libs', ref: 'scripts/lib/nope.mjs', resolved: 'scripts/lib/nope.mjs' },
      { source: 'guardian-registry', id: '9', ref: 'check-x.mjs', resolved: 'scripts/check-x.mjs' },
    ],
    (p) => p === 'scripts/git-lock.mjs',
  )
  assert.ok(s[0].includes('改为 scripts/git-lock.mjs'), s[0])
  assert.ok(s[1].includes('摘除'), s[1])
  assert.ok(s[2].includes('摘除该项'), s[2])
})

test('全量读数三档:clean / rot / undetermined(源读不到优先)', () => {
  const clean = audit('/x', (p) => (p.includes('judgement-libs') ? '["scripts/lib/a.mjs"]' : "    id: '1',\n    script: 'a.mjs',"), () => true)
  assert.equal(clean.overall, 'clean')

  const rot = audit('/x', (p) => (p.includes('judgement-libs') ? '["scripts/lib/a.mjs"]' : "    id: '1',\n    script: 'gone.mjs',"), (p) => normalize(p) === '/x/scripts/lib/a.mjs')
  assert.equal(rot.overall, 'rot')
  assert.equal(rot.rot.length, 1)

  const und = audit('/x', () => {
    throw new Error('ENOENT')
  }, () => true)
  assert.equal(und.overall, 'undetermined')
  assert.equal(und.undetermined.length, 2)
})

test('CLI 真跑:三档退出码 0/1/2 与 --json 形状', () => {
  const dir = makeRoot()
  try {
    const ok = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json'], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    const okJson = JSON.parse(ok.stdout.trim().split(/\r?\n/).pop())
    assert.equal(okJson.overall, 'clean')
    assert.equal(okJson.checked['guardian-registry'], 1)
    assert.equal(okJson.checked['judgement-libs'], 1)

    writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), REGISTRY.replace('check-a.mjs', 'check-gone.mjs'), 'utf8')
    const rot = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json'], { encoding: 'utf8' })
    assert.equal(rot.status, 1, rot.stdout)
    const rotJson = JSON.parse(rot.stdout.trim().split(/\r?\n/).pop())
    assert.equal(rotJson.overall, 'rot')
    assert.ok(rotJson.rot.some((r) => r.resolved === 'scripts/check-gone.mjs'))

    rmSync(join(dir, 'scripts', 'lib', 'judgement-libs.json'))
    const und = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json'], { encoding: 'utf8' })
    assert.equal(und.status, 2, und.stdout)
    const undJson = JSON.parse(und.stdout.trim().split(/\r?\n/).pop())
    assert.equal(undJson.overall, 'undetermined')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
