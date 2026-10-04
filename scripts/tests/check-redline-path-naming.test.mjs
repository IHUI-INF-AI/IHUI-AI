#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-redline-path-naming.test.mjs — G-263 尺子的 §22c 镜像测试
 *
 * 取向:一律 import 被测源文件的导出,**不复制任何判据实现**(§22c 红线)。
 * 静态规则的成对正反在源脚本 `--self-test` 里用合成夹具完成(T1 直接调用它,不重抄);
 * 本文件钉的是**跨文件关系**:与铰链共用一份实现、与门 89 的注册表解析互证、
 * 门 55 修法不退化(防腐烂锚)、探针表不悬空、空全集护栏不报绿。
 *
 * 取材说明:T3/T4/T8 读**磁盘**上的 scripts/guardian-runner.mjs 与门 55 源文件 ——
 * 镜像测试跑在开发机上,锁的是"这两份当前源码的关系";尺子的**判定读数**面(head 默认)
 * 由源脚本自身的 --staged/--worktree 档负责,不在本文件射程。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseGateRegistry,
  extractLiterals,
  verdictGateSource,
  classifyExpr,
  selfTest,
  runScan,
  PROBES,
} from '../check-redline-path-naming.mjs'
import { findAbsentGateScripts } from '../check-gate-wiring.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')

test('T1 层自检全绿(合成夹具 29+ 项,成对正反在源里跑)', () => {
  const { fails, total } = selfTest()
  assert.deepEqual(fails, [], `自检失败:\n${fails.join('\n')}`)
  assert.ok(total >= 29, `自检项数退化(${total})—— 加判据必须同时加用例`)
})

test('T2 与铰链共用一份实现:尺子源码不得自带第二份 FINDING_LINE_RE / 点名判据', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'check-redline-path-naming.mjs'), 'utf8')
  assert.ok(
    src.includes("from './lib/commit-gate-attribution.mjs'"),
    '尺子必须从铰链 lib 导入结论行/点名判据',
  )
  assert.ok(
    !/const FINDING_LINE_RE\s*=/.test(src),
    '尺子内重定义 FINDING_LINE_RE ⇒ 两份判据必然漂移',
  )
  assert.ok(!/function lineNamesFile/.test(src), '尺子内重定义 lineNamesFile ⇒ 同上')
  assert.ok(!/function findingLines/.test(src), '尺子内重定义 findingLines ⇒ 同上')
})

test('T3 注册表解析与门 89 互证:同一份 runner 文本,两条解析路线读数必须一致', () => {
  const runnerText = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const mine = parseGateRegistry(runnerText)
  const theirs = findAbsentGateScripts(runnerText, (rel) => existsSync(join(ROOT, rel)))
  assert.equal(mine.registered, theirs.registered, 'id 总数两路解析必须相等(同一份文本)')
  const theirValid = theirs.checked + theirs.absent.filter((a) => a.script !== '(空)').length
  assert.equal(mine.gates.length, theirValid, '有效门体数两路解析必须相等')
  assert.ok(mine.gates.length > 100, `真仓门体应远超 100(实得 ${mine.gates.length})`)
  assert.ok(
    mine.gates.every((g) => g.mode !== '?'),
    '真仓每条门体都应解析出 mode(全 ? = 抽取退化)',
  )
})

test('T4 防腐烂锚(门 108 到期档的同位替代):门 55 的点名修法不得退化', () => {
  // 2026-09-27 那次修复把「⇒ 违规落点 <裸相对路径>」加进了门 55 的红行;
  // 若将来有人把点名措辞删掉,静态筛会立刻从 names 翻走 —— 本条即那格腐烂的尺子。
  const src = readFileSync(join(ROOT, 'scripts', 'check-tool-name-display-coverage.mjs'), 'utf8')
  assert.equal(verdictGateSource(src).verdict, 'names', '门 55 红行必须保持"可点名"形态')
})

test('T5 空全集护栏:注册表取不到 ⇒ 判"尺子失效",绝不报绿', () => {
  const scratch = mkScratch('redline-empty-')
  try {
    const git = spawnSync('git', ['-c', 'safe.directory=*', '-C', scratch, 'init'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    assert.equal(git.status, 0, git.stderr)
    writeFileSync(join(scratch, 'a.txt'), 'a\n')
    spawnSync(
      'git',
      [
        '-c',
        'safe.directory=*',
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-C',
        scratch,
        'add',
        '.',
      ],
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const c = spawnSync(
      'git',
      [
        '-c',
        'safe.directory=*',
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-C',
        scratch,
        'commit',
        '--no-verify',
        '-m',
        'seed',
      ],
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    assert.equal(c.status, 0, c.stderr)
    const res = runScan(scratch, [])
    assert.equal(res.ok, false, '没有 guardian-runner 的仓必须判尺子失效')
    assert.match(res.why, /尺子失效/)
  } finally {
    rmScratch(scratch)
  }
})

test('T6 注释剥离:剥过的 code 文本不含注释散文,拼接通道不会被文档示例喂假证据', () => {
  const src = [
    '// console.error("散文" + fakeVar) 的示例不得进 code 通道',
    '/* 块注释 console.log("x" + y) */',
    "console.error('真发射' + realVar)",
  ].join('\n')
  const { code } = extractLiterals(src)
  assert.ok(!code.includes('fakeVar'), '行注释未剥净')
  assert.ok(!code.includes('块注释'), '块注释未剥净')
  assert.ok(code.includes('realVar'), '真代码被误剥')
})

test('T7 成员调用取最后一段动词:unmapped.join(...) 是列表拼接不是路径', () => {
  assert.equal(classifyExpr("unmapped.join(', ')", new Map()), 'nonpath')
  assert.equal(classifyExpr("path.join('scripts', f)", new Map()), 'path')
  assert.equal(classifyExpr('mystery', new Map()), 'unknown')
})

test('T8 探针表不悬空:每条探针的 gateId 必须在真仓注册表里,且字段齐', () => {
  const runnerText = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const { gates } = parseGateRegistry(runnerText)
  const byId = new Map(gates.map((g) => [g.id, g.script]))
  const seen = new Set()
  for (const p of PROBES) {
    assert.ok(!seen.has(p.gateId), `探针撞号:${p.gateId}`)
    seen.add(p.gateId)
    assert.equal(byId.get(p.gateId), p.script, `探针 [${p.gateId}] 与注册表 script 不一致`)
    assert.equal(typeof p.inject, 'function')
    assert.ok(p.rel, '探针必须有注入落点')
  }
  // 三档覆盖:names 侧、指控侧(silent)、保守侧(undetermined)各至少一条
  const ids = PROBES.map((p) => p.gateId)
  assert.ok(
    ids.includes('55') && ids.includes('44') && ids.includes('1'),
    '探针表退化:三档覆盖缺位',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
