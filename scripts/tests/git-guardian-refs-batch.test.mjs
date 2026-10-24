// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 嵌套 ref 存续层的"逐条派 git"回潮锁 + 派发层"重叠实例"回潮锁(2026-10-24 立)。
 *
 * 现场(实测数字，不是推演):
 *   `.git/refs-manifest.json` 清单 24,737 条，其中 `refs/tags/lost-commit/*` 24,582 枚
 *   (§29 悬空 commit 备份族，只增不减)。旧 `healRefs()` 对清单每一条派一次
 *   `git rev-parse --verify --quiet <ref>`，函数末尾 `still` 复检再派一遍;单条本机实测
 *   39.5 ms(低负载)–177.9 ms(高负载) ⇒ 一轮外推 977–4,401 秒。
 *   而任务 `IHUI-AI git-guardian` 每 2 分钟派一轮，动作是 `wscript.exe …-hidden.vbs`，
 *   包装器用 `Run(cmd, 0, False)` 把 node **detach** 后立即退出 ⇒ 计划任务认定"实例已结束"
 *   ⇒ 注册条目 `MultipleInstances=IgnoreNew` 形同虚设(它只管 wscript 那一瞬)。
 *   两半合起来:2026-10-24 18:1x 实测 54 枚常驻 node(命令行全无 `--daemon`，即本该跑完
 *   就退的单轮档)，各挂一枚 `git.exe rev-parse refs/tags/lost-commit/...`;git.exe 一度
 *   118 枚、node 80 枚，会话侧 `bash: fork: Resource temporarily unavailable`。
 *   同一份 `for-each-ref` 快照实测 120 ms / 25,398 条，批量判定再 32 ms。
 *
 * 取材面纪律:被锁的守护源码一律读 **HEAD blob**(§0.4 全量档判 HEAD blob)。
 * 本文件立账当晚 `scripts/git-guardian.mjs` 的工作树副本正被他席持有(索引面 5+/92−，
 * 与本改动区不相交)，读盘上那份会把"别人的在飞形态"判成本文件的红 ⇒ 那是 §12e 恒红门
 * 的形状，不是判据。
 *
 * 钉这些事:
 *  T1 等价性:批量快照判定与逐条 `rev-parse` 判定，在同一把尺子(lib 的
 *     refExpectationSatisfied，测试直接 import 它，零复制)下逐条同结论;含阳性对照
 *     ——真删掉的嵌套 tag 与值被改写的 tag 两条路都必须点名，完好项不得误点名。
 *  T2 三态锁:快照 null ⇒ 返回 null 判未判定;空清单 ⇒ 判过且零待修。
 *  T3-T6 七道锁(合一臂,判据见 lockFailures):
 *     T3 形状锁 healRefs 体内不得再出现 rev-parse 派生;
 *     T4 单源锁 集合运算只在 lib 有一份、守护必须 import 它、healRefs 必须喂**同一轮**
 *        的 cur 快照(§0.4 同面同轮)、missingRefs 必须走同一个 helper;
 *     T5 复检语义锁 pack 后按"快照里没有这条"判(改成"值不符也算红"会把 origin/main
 *        这类"清单值取 FETCH_HEAD、packed 值天然滞后"的正常形态每轮报成未达标，
 *        连带到人通知刷屏);
 *     T6 未判定不记绿 复检面取不到必须走"不记成功"那一支。
 *  T7 变异对照(锁必须有牙):把 HEAD 那份批量判定逐字换回旧的逐条写法，同一组锁必须判红;
 *     并先断言这次替换真的动了字节(锚点漂了就等于空调用)。
 *  T8 派发层锁:`git-guardian-hidden.vbs` 必须以 `Run(cmd, 0, True)` 等待子进程，
 *     否则 IgnoreNew 永远管不住重叠 tick(本文件头注那一半的成因)。
 *
 * 全程只在 mkScratch 临时仓里造 tag，绝不碰活 gitdir。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { brokenRefsFromSnapshot, refExpectationSatisfied } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARDIAN_REL = 'scripts/git-guardian.mjs'
const ROOT = join(HERE, '..', '..')
const VBS = join(HERE, '..', 'git-guardian-hidden.vbs')

function gitCmd(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** 被审面 = HEAD blob(见头注"取材面纪律") */
const HEAD_SRC = gitCmd(['show', `HEAD:${GUARDIAN_REL}`])

function sh(args, cwd) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
  })
}

/** 与守护 currentRefs() 同一条取材命令(夹具只做 IO，判定仍走被测实现) */
function snapshotOf(cwd) {
  const out = sh(
    [
      'for-each-ref',
      '--format=%(refname) %(objectname)',
      'refs/heads',
      'refs/tags',
      'refs/remotes',
    ],
    cwd,
  )
  const map = {}
  for (const line of out.split('\n')) {
    const [ref, sha] = line.trim().split(/\s+/)
    if (ref && sha) map[ref] = sha
  }
  return map
}

function perRefResolved(cwd, ref) {
  try {
    return sh(['rev-parse', '--verify', '--quiet', ref], cwd).trim()
  } catch {
    return ''
  }
}

/** 取某个函数的体(括号配平),形状锁与单源锁只在这段射程内判 */
function bodyOf(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源码里找不到 ${name}()`)
  const open = src.indexOf('{', src.indexOf(')', start))
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  assert.fail(`${name}() 函数体括号不配平`)
}

/**
 * 七道锁的集合判据(纯函数，便于 T7 拿变异体再问一遍)。返回失败项数组，空 = 全过。
 */
function lockFailures(src) {
  const heal = bodyOf(src, 'healRefs')
  const miss = bodyOf(src, 'missingRefs')
  const fails = []
  if (heal.includes(`'rev-parse'`)) fails.push('T3 healRefs 体内出现逐条 rev-parse 派生')
  if (!heal.includes('brokenRefsFromSnapshot(map, cur)'))
    fails.push('T4a healRefs 未把同轮 cur 快照喂给批量档')
  if (!miss.includes('brokenRefsFromSnapshot(readRefsManifest(), currentRefs())'))
    fails.push('T4b missingRefs 未走同一实现')
  if (src.includes('function brokenRefsFromSnapshot'))
    fails.push('T4c 守护内不得自带第二份集合运算实现(单源在 lib/gitdir.mjs)')
  if (!/from '\.\/lib\/gitdir\.mjs'/.test(src) || !src.includes('  brokenRefsFromSnapshot,\n'))
    fails.push('T4d 守护未从 lib/gitdir.mjs import 该实现')
  if (!heal.includes('Object.keys(map).filter((ref) => !after[ref])'))
    fails.push('T5 pack 后复检未按"快照里没有这条"判(语义漂移会每轮刷未达标)')
  if (!heal.includes('after === null') || !/不记成功/.test(heal))
    fails.push('T6 复检面取不到时未走"不记成功"支')
  return fails
}

test('T1 批量档与逐条档逐条同结论,且真删掉的嵌套 tag 被点名', () => {
  const dir = mkScratch('ihui-refsbatch-')
  try {
    const wt = join(dir, `wt-${basename(dir)}`)
    mkdirSync(wt, { recursive: true })
    sh(['init', '-q', '-b', 'main'], wt)
    writeFileSync(join(wt, 'a.txt'), 'v1\n')
    sh(['add', 'a.txt'], wt)
    sh(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1'], wt)
    const sha = sh(['rev-parse', 'HEAD'], wt).trim()
    sh(['tag', 'nightly-fixture/one', sha], wt)
    sh(['tag', 'nightly-fixture/two', sha], wt)
    sh(['tag', 'lost-commit/deadman', sha], wt)
    const snap = snapshotOf(wt)
    for (const ref of ['refs/tags/nightly-fixture/one', 'refs/tags/lost-commit/deadman']) {
      assert.ok(snap[ref], `夹具 tag ${ref} 没落盘(§12d 假成功那一型)`)
    }
    const manifest = {
      ...snap,
      'refs/tags/nightly-fixture/vanished': sha, // 清单有、盘上被清理
      'refs/tags/nightly-fixture/two': 'f'.repeat(40), // 值被改写
    }
    const batched = brokenRefsFromSnapshot(manifest, snap)
    assert.ok(Array.isArray(batched), '快照可得时不得返回 null')
    const batchedSet = new Set(batched.map(([r]) => r))
    let divergent = 0
    for (const [ref, expected] of Object.entries(manifest)) {
      const oldVerdict = !refExpectationSatisfied(ref, expected, perRefResolved(wt, ref))
      if (oldVerdict !== batchedSet.has(ref)) divergent++
    }
    assert.equal(divergent, 0, '批量档与逐条档出现逐条判定分歧')
    assert.ok(batchedSet.has('refs/tags/nightly-fixture/vanished'), '被删的嵌套 tag 必须点名')
    assert.ok(batchedSet.has('refs/tags/nightly-fixture/two'), '值被改写的 tag 必须点名')
    assert.ok(!batchedSet.has('refs/tags/nightly-fixture/one'), '完好项不得误点名')
  } finally {
    rmScratch(dir)
  }
})

test('T2 三态锁:快照取不到返回 null,空清单判过且零待修', () => {
  const map = {
    'refs/tags/lost-commit/a': 'a'.repeat(40),
    'refs/tags/lost-commit/b': 'b'.repeat(40),
  }
  assert.equal(brokenRefsFromSnapshot(map, null), null, '面问不到必须是未判定')
  assert.deepEqual(brokenRefsFromSnapshot({}, {}), [], '空清单 ⇒ 判过且零待修')
})

test('T3-T6 守护的七道锁对 HEAD blob 全过', () => {
  const fails = lockFailures(HEAD_SRC)
  assert.deepEqual(fails, [], `HEAD 面守护应全过,实得:\n  ${fails.join('\n  ')}`)
})

test('T7 变异对照:换回逐条写法后,同一组锁必须判红', () => {
  const batchedCall = '  const broken = brokenRefsFromSnapshot(map, cur)'
  const perRefLoop = `  const broken = Object.entries(map).filter(([ref, sha]) => {
    const resolved = git(['rev-parse', '--verify', '--quiet', ref], true)
    return !refExpectationSatisfied(ref, sha, resolved)
  })`
  const mutant = HEAD_SRC.replace(batchedCall, perRefLoop)
  assert.notEqual(mutant, HEAD_SRC, '变异锚点已漂(替换没动一个字节 ⇒ 这一臂会空调过)')
  const fails = lockFailures(mutant)
  assert.ok(
    fails.some((f) => f.startsWith('T3')),
    `旧逐条写法没被 T3 咬住:${fails.join(' | ')}`,
  )
  assert.ok(
    fails.some((f) => f.startsWith('T4a')),
    `healRefs 不再喂同轮快照没被 T4a 咬住:${fails.join(' | ')}`,
  )
})

test('T8 派发层锁:隐藏启动包装器必须等子进程,否则 IgnoreNew 管不住重叠 tick', () => {
  const vbs = readFileSync(VBS, 'utf8')
  assert.match(
    vbs,
    /shell\.Run\(\s*cmd\s*,\s*0\s*,\s*True\s*\)/,
    'git-guardian-hidden.vbs 又回到 detach(Run(...,False)) ⇒ 每次触发都会再 detach 一枚永不退出的 tick(见头注 54 枚常驻现场)',
  )
  assert.doesNotMatch(
    vbs,
    /shell\.Run\(\s*cmd\s*,\s*0\s*,\s*False\s*\)/,
    '不得同时存在两种等待形态',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
