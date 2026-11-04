// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * content-loss-gate.test.mjs —— 内容级防丢闸的回归锁(独立一笔,2026-11-05)。
 *
 * 覆盖:
 *   C1 五语言词包键集:合并结果少 17 键 ⇒ 逐键点名(复刻"i18n 17 键"真事故的读数面);
 *   C2 JSONL 按键集(记录并集)判,不按文件字节判;
 *   C3 活文档/AGENTS.md 行级包含:少 3 个测试用例行 ⇒ 逐行点名(复刻"3 个用例"真事故);
 *   C4 两侧都少带 ⇒ 两侧分别点名,不只报一侧;
 *   C5 JSON 解不开 ⇒ 未判定即判红(不静默当空表);
 *   C6 CLI 真临时仓端到端:exit 1 + 点名;合并成联合集 ⇒ exit 0(阳性对照);
 *   C7 装车锁:union-converge --apply 在 commit-tree 之前调用本闸,红档 exit 非 0。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitRaw } from '../lib/face-reader.mjs'
import { judgeContentLoss, textKeySet } from '../lib/content-loss-gate.mjs'

const SCRIPTS = resolve(import.meta.dirname, '..')

/** 纯函数档:三份文本 + 注入 read,不碰 git(判据本体与取材分层)。 */
function judgeTexts({ ours = null, theirs = null, merged = null, path }) {
  const map = { O: ours, T: theirs, M: merged }
  return judgeContentLoss({
    root: SCRIPTS,
    ours: 'O',
    theirs: 'T',
    merged: 'M',
    paths: [path],
    read: (rev) => map[rev] ?? null,
  })
}

test('C1 词包键集:合并结果少 17 键 ⇒ 逐键点名(oursKeys − mergedKeys)', () => {
  const full = {}
  for (let i = 1; i <= 20; i++) full[`k${i}`] = `v${i}`
  const kept = {}
  for (let i = 1; i <= 3; i++) kept[`k${i}`] = `v${i}`
  const r = judgeTexts({
    ours: JSON.stringify(full),
    theirs: JSON.stringify(full),
    merged: JSON.stringify(kept),
    path: 'packages/i18n/messages/zh-CN.json',
  })
  assert.equal(r.ok, false, '少 17 键必须判红')
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].missingOurs.length, 17, '缺失键必须逐个数出来')
  assert.ok(r.violations[0].missingOurs.includes('k20'), '必须点名具体键,不能只报个数')
})

test('C2 JSONL 按键集判(记录并集),文件行数变化本身不判红', () => {
  const ours = '{"a":1}\n{"b":2}\n'
  const merged = '{"a":1}\n'
  const r = judgeTexts({ ours, theirs: ours, merged, path: 'scripts/data/x.jsonl' })
  assert.equal(r.ok, false)
  assert.deepEqual(r.violations[0].missingOurs, ['b'], 'JSONL 少一条记录的键必须点名')
})

test('C3 活文档/AGENTS.md 行级包含:少 3 个用例行 ⇒ 逐行点名', () => {
  const ours = ['# 标题', '用例一', '用例二', '用例三', '用例四'].join('\n') + '\n'
  const merged = ['# 标题', '用例一'].join('\n') + '\n'
  const r = judgeTexts({ ours, theirs: ours, merged, path: 'AGENTS.md' })
  assert.equal(r.ok, false)
  assert.deepEqual(r.violations[0].missingOurs, ['用例二', '用例三', '用例四'])
})

test('C4 两侧都少带 ⇒ 两侧分别点名(不只报本侧)', () => {
  const ours = JSON.stringify({ a: 1, onlyOurs: 2 })
  const theirs = JSON.stringify({ a: 1, onlyTheirs: 3 })
  const merged = JSON.stringify({ a: 1 })
  const r = judgeTexts({ ours, theirs, merged, path: 'packages/i18n/messages/en.json' })
  assert.equal(r.violations[0].missingOurs.length, 1)
  assert.equal(r.violations[0].missingTheirs.length, 1)
  assert.deepEqual(r.violations[0].missingOurs, ['onlyOurs'])
  assert.deepEqual(r.violations[0].missingTheirs, ['onlyTheirs'])
})

test('C5 JSON 解不开 ⇒ 未判定即判红,不静默当空表', () => {
  const r = judgeTexts({ ours: '{oops', theirs: '{oops', merged: '{}', path: 'scripts/data/x.json' })
  assert.equal(r.ok, false)
  assert.match(r.violations[0].error, /解不开/)
  const broken = textKeySet('{oops', 'scripts/data/x.json')
  assert.ok(broken.error, '解析失败必须带 error,不得返回空键集冒充通过')
})

test('C6 CLI 真临时仓:少键 exit 1 并点名;联合集 exit 0(阳性对照)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-gate-'))
  const g = (args) => gitRaw(args, dir, { timeout: 60000 })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    g(['config', 'core.autocrlf', 'false'])
    const path = 'packages/i18n/messages/en.json'
    mkdirSync(join(dir, 'packages/i18n/messages'), { recursive: true })
    const full = Object.fromEntries([...Array(5)].map((_, i) => [`k${i + 1}`, `v${i + 1}`]))
    writeFileSync(join(dir, path), JSON.stringify(full, null, 2))
    writeFileSync(join(dir, 'AGENTS.md'), 'line1\nline2\nline3\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'base'])
    const ours = g(['rev-parse', 'HEAD']).trim()
    // 对侧:同一份内容(不制造假差异)
    writeFileSync(join(dir, path), JSON.stringify(full, null, 2))
    g(['add', '-A'])
    g(['commit', '-q', '--allow-empty', '-m', 'theirs'])
    const theirs = g(['rev-parse', 'HEAD']).trim()
    // 病态合并:只剩 2 键 + 只剩 1 行
    writeFileSync(join(dir, path), JSON.stringify({ k1: 'v1', k2: 'v2' }, null, 2))
    writeFileSync(join(dir, 'AGENTS.md'), 'line1\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'bad-merge'])
    const merged = g(['rev-parse', 'HEAD']).trim()

    const cli = join(SCRIPTS, 'check-merge-content-loss.mjs')
    const run = (m) =>
      spawnSync(
        process.execPath,
        [cli, '--ours', ours, '--theirs', theirs, '--merged', m, '--root', dir],
        { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )
    const bad = run(merged)
    assert.equal(bad.status, 1, `病态合并应 exit 1,实得 ${bad.status};stdout=${String(bad.stdout).slice(0, 300)}`)
    assert.match(bad.stdout, /内容级防丢闸/, '必须打印闸名')
    assert.match(bad.stdout, /k3/, '必须点名缺失键')
    assert.match(bad.stdout, /line2/, '必须点名缺失行')

    // 阳性对照:合并成联合集 ⇒ 0 缺失
    writeFileSync(join(dir, path), JSON.stringify(full, null, 2))
    writeFileSync(join(dir, 'AGENTS.md'), 'line1\nline2\nline3\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'good-merge'])
    const good = run(g(['rev-parse', 'HEAD']).trim())
    assert.equal(good.status, 0, `联合集应 exit 0,实得 ${good.status};stdout=${String(good.stdout).slice(0, 300)}`)
    assert.match(good.stdout, /0 缺失键\/行/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C7 装车锁:内容闸在 commit-tree 之前,红档 exit 非 0', () => {
  const src = readFileSync(join(SCRIPTS, 'union-converge.mjs'), 'utf8')
  const gateAt = src.indexOf('judgeContentLoss({')
  const commitAt = src.indexOf("git(['commit-tree'")
  assert.ok(gateAt > 0, '内容闸未被 union-converge 调用')
  assert.ok(commitAt > gateAt, '内容闸必须排在 commit-tree 之前')
  assert.match(src.slice(gateAt, commitAt), /process\.exit\(/, '红档必须 exit 非 0')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
