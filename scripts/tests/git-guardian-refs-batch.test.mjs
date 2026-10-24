// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 嵌套 ref 存续层的"逐条派 git"回潮锁(2026-10-24 立)。
 *
 * 现场(实测数字，不是假想):`.git/refs-manifest.json` 现有 **24,737** 条，其中
 * `refs/tags/lost-commit/*` **24,582** 枚(§29 的悬空 commit 备份族，只增不减)。
 * `healRefs()` 旧写法对清单里每一条派一次 `git rev-parse --verify --quiet <ref>`:
 * 本机单条实测 39.5–177.9 ms ⇒ 一轮 ≈ **977–4,401 秒**;同一函数末尾的 `still` 复检
 * 还派第二遍。而计划任务 `IHUI-AI git-guardian` 每 **2 分钟**派一轮 ⇒ 一轮永远跑不完，
 * 下一轮又来 ⇒ 实测 2026-10-24 18:1x 本机堆到 **54 枚**常驻 node(全部无 `--daemon`，
 * 即"本该跑完就退出"的单轮档)，各自挂着一个 `git.exe rev-parse refs/tags/lost-commit/...`，
 * 连带把 git.exe 顶到 118 枚、会话侧 bash `fork: Resource temporarily unavailable`。
 * 判据本身没写错——**取材方式**错了:同一文件里 `currentRefs()` 早已用一次
 * `for-each-ref` 拿到 25,398 条(实测 119–120 ms)，`missingRefs()` 也早按这份快照判;
 * `healRefs()` 却另起了逐条那一套(§0.6 同判据第二份实现的代价)。
 *
 * 本文件钉六件事:
 *  ① 等价性:批量快照判出的"待修集合"与逐条 `rev-parse` 判的，在同一把尺子
 *     (`lib/gitdir.mjs` 的 `refExpectationSatisfied`，测试直接 import 它，不复制判据)
 *     下逐条同结论;并含正向对照——真被删掉的那枚嵌套 tag 两条路都必须点名它。
 *  ② 三态锁:快照取不到(null)⇒ 返回 null 判「未判定」，绝不折成"清单全缺"。
 *  ③ 形状锁(回潮锁):`healRefs()` 函数体内不得再出现逐条 `rev-parse --verify --quiet ref`。
 *  ④ 装车锁:`healRefs()` 必须把**同一轮**那份 `cur` 快照喂给批量档(§0.4 同面同轮)，
 *     `missingRefs()` 必须与它共用同一个集合运算实现，而不是各写一份 filter。
 *  ⑤ 复检语义锁:pack 后的 `still` 判"快照里没有这条"(与旧逐条档一致)，
 *     不得被顺手改成"值不符也算红"——那会把 origin/main 这类"清单值取 FETCH_HEAD、
 *     packed 值天然滞后"的正常形态每轮报成未达标，连到人通知一起刷。
 *  ⑥ 未判定不记绿:`still` 复检取不到面时必须走"不记成功"那一支。
 *
 * 变异归属(2026-10-24 实测):把 `healRefs()` 的批量判定逐字改回旧的
 * `Object.entries(map).filter(([ref, sha]) => !refExpectationSatisfied(ref, sha,
 *  git(['rev-parse','--verify','--quiet', ref], true)))` 后重跑本文件 ⇒ T3 红(体内出现
 * 逐条派生)、T4 红(不再喂 cur 快照)，其余四臂绿;还原后 6/6 绿。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { refExpectationSatisfied } from '../lib/gitdir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARDIAN = join(HERE, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

function sh(args, cwd) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
  })
}

/** 与守护 currentRefs() 同一条取材命令(测试夹具只做 IO，判定仍走被测实现) */
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

/** 取 healRefs 函数体(括号配平),形状锁与装车锁都只在这段射程内判 */
function bodyOf(name) {
  const start = SRC.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `源码里找不到 ${name}()`)
  const open = SRC.indexOf('{', SRC.indexOf(')', start))
  let depth = 0
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++
    else if (SRC[i] === '}') {
      depth--
      if (depth === 0) return SRC.slice(open, i + 1)
    }
  }
  assert.fail(`${name}() 函数体括号不配平`)
}

test('T1 批量档与逐条档逐条同结论,且真删掉的那枚嵌套 tag 两条路都点名', () => {
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
    const before = snapshotOf(wt)
    for (const ref of ['refs/tags/nightly-fixture/one', 'refs/tags/lost-commit/deadman']) {
      assert.ok(before[ref], `夹具 tag ${ref} 没落盘(§12d 假成功那一型)`)
    }
    const manifest = {
      ...before,
      // 一枚清单里有、盘上被宿主清理掉的嵌套 tag:两条路都必须点名它
      'refs/tags/nightly-fixture/vanished': sha,
      // 一枚值被改写的嵌套 tag
      'refs/tags/nightly-fixture/two': 'f'.repeat(40),
    }
    const batched = G.brokenRefsFromSnapshot(manifest, before)
    assert.ok(Array.isArray(batched), '快照可得时不得返回 null')
    const batchedSet = new Set(batched.map(([r]) => r))

    let divergent = 0
    for (const [ref, expected] of Object.entries(manifest)) {
      const oldVerdict = !refExpectationSatisfied(ref, expected, perRefResolved(wt, ref))
      if (oldVerdict !== batchedSet.has(ref)) divergent++
    }
    assert.equal(divergent, 0, '批量档与逐条档出现逐条判定分歧')
    // 阳性对照:缺席与值不符都必须被点名，否则上面那条"零分歧"可能只是两边都恒假
    assert.ok(batchedSet.has('refs/tags/nightly-fixture/vanished'), '被删的嵌套 tag 必须点名')
    assert.ok(batchedSet.has('refs/tags/nightly-fixture/two'), '值被改写的 tag 必须点名')
    assert.ok(!batchedSet.has('refs/tags/nightly-fixture/one'), '完好项不得误点名')
  } finally {
    rmScratch(dir)
  }
})

test('T2 三态锁:快照取不到返回 null,绝不折成"清单全缺"', () => {
  const map = {
    'refs/tags/lost-commit/a': 'a'.repeat(40),
    'refs/tags/lost-commit/b': 'b'.repeat(40),
  }
  assert.equal(G.brokenRefsFromSnapshot(map, null), null, '面问不到必须是未判定')
  assert.deepEqual(G.brokenRefsFromSnapshot({}, {}), [], '清单为空 ⇒ 判过且零待修')
})

test('T3 形状锁:healRefs 体内不得再逐条派 git 问 ref', () => {
  const body = bodyOf('healRefs')
  assert.ok(
    !/rev-parse['"]?\s*,\s*['"]--verify['"]?\s*,\s*['"]--quiet['"]?\s*,\s*ref\b/.test(body),
    'healRefs() 又回到逐条 rev-parse ⇒ 24,737 条清单会把守护打成常驻堆积(见头注现场)',
  )
  assert.ok(!body.includes(`'rev-parse'`), 'healRefs() 体内不得出现任何 rev-parse 派生')
})

test('T4 装车锁:healRefs 与 missingRefs 共用同一份集合运算,且喂的是同轮快照', () => {
  const heal = bodyOf('healRefs')
  const miss = bodyOf('missingRefs')
  assert.ok(
    heal.includes('brokenRefsFromSnapshot(map, cur)'),
    'healRefs 必须用本轮已取的 cur 快照判清单',
  )
  assert.ok(
    miss.includes('brokenRefsFromSnapshot(readRefsManifest(), currentRefs())'),
    'missingRefs 必须走同一实现',
  )
  assert.ok(SRC.includes('function brokenRefsFromSnapshot(map, cur)'), '集合运算只许有一份实现')
  assert.ok(
    !miss.includes('refExpectationSatisfied'),
    'missingRefs 不得再自己写一份判定(单实现在 helper 内)',
  )
})

test('T5/T6 复检语义锁 + 未判定不记绿', () => {
  const heal = bodyOf('healRefs')
  assert.ok(
    heal.includes('Object.keys(map).filter((ref) => !after[ref])'),
    'pack 后复检必须按"快照里没有这条"判(与旧逐条档同语义)',
  )
  assert.ok(heal.includes('after === null'), '复检面取不到必须走未判定支,不得记成功')
  assert.ok(/不记成功/.test(heal), '未判定支必须点名"不记成功"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
