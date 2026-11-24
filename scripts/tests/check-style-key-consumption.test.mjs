#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-style-key-consumption.mjs(守门 266,共享样式工厂键集 ↔ 跨文件具名取用)。
// 立因(g35-s11 实测):`check-staged-typecheck.mjs` 的 filterTscOutputForStagedFiles 里
// `pendingIsStaged = stagedAbs.has(fileAbs)` ⇒ **非暂存文件的 tsc 报错被整条丢弃**;于是
// "只暂存样式源、消费面留在未暂存区"这一刀被提交门读成绿,真红落进 HEAD(历史两枚 876c4cb418 /
// bd41560d83 都只动了单边)。本测试钉的就是"两侧同面成对判"这件事,而不是某个键名。
// §22c:判据只 import 本门 `__test__`,测试里不复制第二把尺子;端到端一律走 scratch 临时仓。

import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'

import { __test__ as T } from '../check-style-key-consumption.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const F = T.FIXTURES

const accesses = (r) => r.violations.map((v) => v.access).sort()

// 门体的夹具构造器是唯一入口(测试不重跑一遍绑定/取用逻辑)
const run = (files, changed = null) => accesses(T.fixtureJudge(files, changed))

test('T1 判据 A:导出工厂的顶层键集读得出;含 spread 的源标 partial(不判)', () => {
  const sf = T.parseFile('pkg/a-styles.ts', F.sourceA).sf
  const { factories, typeAliases } = T.collectFactories(sf)
  assert.deepEqual([...factories.get('createAStyles').keys].sort(), ['chipTextActive', 'tabText', 'tabTextActive'])
  assert.equal(factories.get('createAStyles').partial, false)
  assert.equal(typeAliases.get('AStyles'), 'createAStyles')
  const p = T.parseFile('pkg/p-styles.ts', F.partialSource).sf
  assert.equal(T.collectFactories(p).factories.get('createAStyles').partial, true)
  assert.deepEqual(run({ 'pkg/a-styles.ts': F.partialSource, 'pkg/b.tsx': F.consumerBad }), [])
})

test('T2 判据 B:跨文件按名取用不在源键集 ⇒ 红;同键 ⇒ 绿(正反对照)', () => {
  const src = { 'pkg/a-styles.ts': F.sourceA }
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.consumerBad }), ['styles.tabActiveText'])
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.consumerOk }), [])
  // useMemo 包裹的绑定、props 型别名、字符串下标、解构 四条入口都必须判得到
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.useMemoConsumer }), [])
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.propTypedConsumer }), [])
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.elementAccessOk }), [])
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.destructuredBad }), ['{nope} 自 createAStyles()'])
})

test('T3 判据 C(恒红生死线):同文件本地 StyleSheet 定义的取用放过 —— 且只放过那一枚', () => {
  const src = { 'pkg/a-styles.ts': F.sourceA }
  // ① 本地 localSheet.tabActiveText 不在导入工厂键集里 ⇒ 必须放过(整文件免判就是恒红门)
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.localDefinition }), [])
  // ② "摘掉即翻红"对照:同一份夹具里把那一枚**跨文件**取用改成不存在的键 ⇒ 必须翻红
  //    ⇒ 证明放过的是"本地定义"那一枚标识符,不是把整个消费文件洗白
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.localDefinition.replace('styles.tabTextActive', 'styles.tabNope') }), [
    'styles.tabNope',
  ])
  // ③ 同名标识符先绑导入工厂、后被本地 StyleSheet 覆写 ⇒ 整枚退出
  assert.deepEqual(run({ ...src, 'pkg/b.tsx': F.localSameName }), [])
})

test('T4 判据 D:两面旗同给 ⇒ selectFace 直接给 error(交调用方折 exit 2)', async () => {
  const { selectFace } = await import('../lib/face-reader.mjs')
  assert.ok(selectFace({ staged: true, worktree: true }).error)
  assert.equal(selectFace({ staged: true, worktree: false }).face, 'staged')
  assert.equal(selectFace({ staged: false, worktree: false }).face, 'head')
})

test('T5 索引档只报"本次改动集带进来的配对"(共享索引里别人的在飞不判红)', () => {
  // 源翻了键名、消费面留在旧名 ⇒ 配对违规;改动集里只列源(s11 那一刀的切法)⇒ 仍必须报
  const renamed = { 'pkg/a-styles.ts': F.sourceA.replace('tabTextActive:', 'tabActiveText:'), 'pkg/b.tsx': F.consumerOk }
  assert.deepEqual(run(renamed, new Set(['pkg/a-styles.ts'])), ['styles.tabTextActive'])
  // 同一份内容,改动集不碰这一对 ⇒ 不报(交全量档拦)
  assert.deepEqual(run(renamed, new Set()), [])
  // 全量档(不带改动集)⇒ 照报
  assert.deepEqual(run(renamed, null), ['styles.tabTextActive'])
  // 消费面同批改 ⇒ 两档都绿(这就是唯一合法修法)
  const fixed = { ...renamed, 'pkg/b.tsx': F.consumerOk.replace('tabTextActive', 'tabActiveText') }
  assert.deepEqual(run(fixed, new Set(['pkg/a-styles.ts'])), [])
  assert.deepEqual(run(fixed, null), [])
})

test('T6 接线形状锁:注册条目 blocking+skipEnv+stagedTriggers 成套,且"摘掉即翻红"', () => {
  const entry = T.registryEntryFacts(T.REGISTRY_ENTRY)
  assert.equal(entry.id, '266')
  assert.equal(entry.script, 'check-style-key-consumption.mjs')
  assert.equal(entry.mode, 'blocking')
  assert.ok(entry.skipEnv, 'blocking 门必须带 skipEnv 成套')
  assert.deepEqual(entry.args, [], 'args 必须留空:--staged 由 runner 统一追加')
  assert.ok(entry.stagedTriggers.length > 0, '缺 stagedTriggers 会被门 253 判红(两通道反义)')
  const without = 'const checks = [\n  { id: "253", script: "check-mjs-export-resolution.mjs" }\n]\n'
  assert.equal(T.wiringVerdict(entry, without), 'missing')
  assert.equal(T.wiringVerdict(entry, `${without}${T.REGISTRY_ENTRY}\n`), 'wired')
  assert.equal(T.wiringVerdict(entry, null), 'undetermined')
})

test('T7 形状锁:射程只有两根(源与消费只可能在这两处,扩面 = 造噪声)', () => {
  assert.deepEqual(T.SOURCE_ROOTS, ['packages/app/src', 'apps/mobile-rn/src'])
})

test('T8 端到端(真 git 两面):HEAD 自洽而"只暂存样式源"这一刀必须被索引档咬住', () => {
  const dir = mkScratch('skc-mirror-')
  try {
    const g = (args) => spawnSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.hooksPath=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(g(['init', '-q', '-b', 'main']).status, 0, 'scratch 仓初始化失败')
    const srcDir = join(dir, 'packages/app/src/features/x')
    mkdirSync(srcDir, { recursive: true })
    const srcPath = join(srcDir, 'a-styles.ts')
    const usePath = join(srcDir, 'b-screen.tsx')
    writeFileSync(srcPath, F.sourceA, 'utf8')
    writeFileSync(usePath, F.consumerOk, 'utf8')
    g(['add', '.'])
    g(['-c', 'user.email=t@ihui.local', '-c', 'user.name=fixture', 'commit', '-q', '-m', 'fixture'])
    // ① HEAD 面:两侧自洽 ⇒ 不判红,且必须真判到了东西(判不成 = 未判定,不许冒绿)
    const head = scanFace(dir, 'head')
    assert.equal(head.violations.length, 0, `HEAD 面本应自洽:${JSON.stringify(head.violations)}`)
    assert.ok(head.stats.accesses > 0, 'HEAD 面一枚都没判成 ⇒ 该判未判定,不是绿')
    assert.equal(T.report(head, { quiet: true, face: 'head' }), 0)
    // ② s11 那一刀:源翻键名并**只暂存源**,消费面留在工作树未暂存 ⇒ 索引档必须报红
    writeFileSync(srcPath, F.sourceA.replace('tabTextActive:', 'tabActiveText:'), 'utf8')
    g(['add', 'packages/app/src/features/x/a-styles.ts'])
    const staged = scanFace(dir, 'staged')
    assert.deepEqual(staged.violations.map((v) => v.access), ['styles.tabTextActive'])
    assert.equal(T.report({ ...staged, undetermined: [] }, { quiet: true, face: 'staged' }), 1, '索引档这一刀必须 exit=1')
    // ③ 同批把消费面也改也暂存 ⇒ 索引档转绿(修法有效)
    writeFileSync(usePath, F.consumerOk.replace('tabTextActive', 'tabActiveText'), 'utf8')
    g(['add', 'packages/app/src/features/x/b-screen.tsx'])
    assert.deepEqual(scanFace(dir, 'staged').violations, [])
  } finally {
    rmScratch(dir)
  }
})

/** 直接调门体的面扫描(scan 是门体导出的唯一做 IO 的判据入口,测试不自拼清单/正文)。 */
function scanFace(root, face) {
  return T.scan({ face, root })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
