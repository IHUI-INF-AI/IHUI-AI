// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 孤儿提交备份腿(lib/orphan-backup.mjs + 三台旁路落地器的接线)的镜像锁
 * (2026-10-29 门 30a 根因票;§22c:判据一律 import 源模块导出的 __test__,测试里零复制)。
 *
 * 立因:守门 30a 把"30 天窗内新产生且未 tag 备份"的悬空 commit 逐枚判红,而实测 185 枚孤儿里
 * 178 枚父全可达、184 枚从未当过 main 的 reflog 值 ⇒ 孤儿 = **commit-tree 已造出、当场被弃掉的那枚**,
 * 不是被顶掉的旧 tip。此前只有 git-sync-converge 一条备份腿,object-space-land / union-converge
 * 一枚都不备份。本锁五格:
 *  ① 装车形状锁(摘掉 import 或调用即翻红 —— 反向对照 1);
 *  ② 成功落地路径零 tag(摘掉 landed 短路即翻红 —— 反向对照 2);
 *  ③ 同 sha 重跑幂等(不撞名、不重复打);
 *  ④ ref 已指向该 sha ⇒ why:'landed' 且一题 git 都不派(防 tag 噪声那一格;并验 trim/失联方向);
 *  ⑤ sha 形状不对 ⇒ 未备份且**出声**,绝不静默折成已备份(§0.3)。
 * 另把 converge 旧镜像锁 T3 的"tag 之后必须 pack-refs"改锚到 lib 源文本上,覆盖面不许随重构蒸发。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as lib } from '../lib/orphan-backup.mjs'
import { __test__ as LAND } from '../object-space-land.mjs'
import { __test__ as CONV } from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SHA = '947ef34a88a2b4c1d2e3f4a5b6c7d8e9f0a1b2c3'
const OTHER = 'b'.repeat(40)

const landSrc = readFileSync(new URL('../object-space-land.mjs', import.meta.url), 'utf8')
const unionSrc = readFileSync(new URL('../union-converge.mjs', import.meta.url), 'utf8')
const convSrc = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
const libSrc = readFileSync(new URL('../lib/orphan-backup.mjs', import.meta.url), 'utf8')

/** 假 git 面:只记录 argv,不派任何真进程(rev-parse 按 state.tagExists 答"tag 在不在")。 */
function spyRunner(state = { tagExists: false }) {
  const calls = []
  const runner = (_root, args) => {
    calls.push(args)
    if (args[0] === 'rev-parse') return state.tagExists ? SHA : null
    return ''
  }
  runner.calls = calls
  runner.tagCalls = () => calls.filter((a) => a[0] === 'tag')
  return runner
}

test('① 装车形状锁:三台落地器都必须"import 了 lib 且真的在弃落出口调用",缺任一即红(函数在、调度点没有 = 本仓最高频失效型)', () => {
  // object-space-land:import + 守卫定义 + 两处弃落出口调用(CAS 逐轮输 / 12 次耗尽)
  assert.match(landSrc, /import \{ backupOrphanCommit \} from '\.\/lib\/orphan-backup\.mjs'/, 'land 没 import lib')
  assert.match(landSrc, /function backupIfAbandoned\(sha, why, root, deps = \{\}\)/, 'land 的弃落守卫不见了')
  assert.match(landSrc, /kind: 'land'/, "land 调用没走 'land' 档")
  assert.match(landSrc, /backupIfAbandoned\(commit, `object-space-land 第 \$\{attempt\} 回 CAS 未抢到`, root\)/, 'CAS 输的那一支没调备份(本票主格子)')
  assert.match(landSrc, /backupIfAbandoned\(lastMadeCommit/, '12 次耗尽出口没调备份')
  assert.match(landSrc, /lastMadeCommit = commit/, '耗尽兜底拿不到末枚造出的 sha')
  // union-converge:import + CAS 失败分支调用,且第二份"拼 ref 名"的实现必须已删净
  assert.match(unionSrc, /from '\.\/lib\/orphan-backup\.mjs'/, 'union 没 import lib')
  const casAt = unionSrc.indexOf('if (cas.status !== 0)')
  assert.ok(casAt > 0, 'union 的 CAS 失败分支不见了 —— 它一消失本锁就无条件通过')
  const branch = unionSrc.slice(casAt, casAt + 1600)
  assert.match(branch, /backupOrphanCommit\(\{/, 'union CAS 失败没调 lib 备份')
  assert.match(branch, /kind: 'uni'/, "union 调用没走 'uni' 档")
  assert.match(branch, /process\.exit\(1\)/, 'tag 失败不得掩盖原始故障:CAS 失败仍须非零退出')
  assert.ok(!/`lost-commit\/wip-\$\{/.test(unionSrc), 'union 里不得再有手拼 ref 名的第二处(§0.6)')
  // git-sync-converge:再导出必须留着(镜像测试按名从本文件取用,删掉 = 门 253 D2 那一型)
  assert.match(convSrc, /export \{ orphanBackupRefName \}/, 'converge 的再导出被删 = 削出口而消费方按名取用')
  assert.match(convSrc, /backupOrphanCommit\(\{/, 'converge 的薄封装没调 lib')
  // 旧 T3 覆盖面不许蒸发:lib 里 tag 必须在 pack-refs 之前(嵌套 ref 不 pack 会被宿主清理层删掉)
  const tagAt = libSrc.indexOf(`'tag',`)
  const packAt = libSrc.indexOf(`['pack-refs'`)
  assert.ok(tagAt > 0 && packAt > tagAt, 'lib 必须在 tag 之后 pack-refs')
})

test('② 首轮 CAS 即成功的形状 ⇒ 一枚 tag 都不许产生(ref 当前值 == 本轮 sha ⇒ 正常落地,不是孤儿)', () => {
  const runner = spyRunner()
  const res = LAND.backupIfAbandoned(SHA, '第 1 回 CAS 成功', '.', { headOf: () => SHA, runner })
  assert.equal(res.ok, true)
  assert.equal(res.why, 'landed')
  assert.equal(res.ref, null, '正常落地不得返回任何备份 ref')
  assert.equal(runner.calls.length, 0, '成功路径连一次 git 都不该派(更不许 git tag)')
  // 反向对照:摘掉 landed 短路 ⇒ 本条立刻见到 tag 调用翻红。调用点形状也钉住:
  // CAS 成功分支体内(到 break 为止)不得出现 backupIfAbandoned。
  // 2026-10-29 改锚:成功判定从 `if (casUpdateRef(…))` 改成 try/catch + `if (casWon)`
  // (为的是接住"抛出"那一型第四弃落口),锚点跟着走 —— 钉的仍是**同一件事**:成功出口不挂备份。
  const casAt = landSrc.indexOf('casWon = casUpdateRef(commit, head, { root })')
  assert.ok(casAt > 0, 'CAS 调用锚点不见了(改成 try/catch 形态时这条要一起改)')
  const okAt = landSrc.indexOf('if (casWon) {', casAt)
  assert.ok(okAt > 0, 'CAS 成功分支锚点不见了')
  const okBranch = landSrc.slice(okAt, landSrc.indexOf('}', landSrc.indexOf('break', okAt)))
  assert.ok(!okBranch.includes('backupIfAbandoned'), '成功出口挂了备份 = 把每次落地变成 tag 噪声')
})

test('③ 同 sha 重跑:第二次必须 already:true,不撞名、不重复打、留痕只一行', () => {
  const dir = mkScratch('orphan-backup-t3-')
  try {
    const ledgerFile = join(dir, 'ledger.jsonl')
    const state = { tagExists: false }
    const runner = spyRunner(state)
    const r1 = LAND.backupIfAbandoned(SHA, '第 2 回 CAS 未抢到', dir, {
      headOf: () => OTHER,
      runner,
      ledgerFile,
      now: new Date('2026-10-29T00:00:00Z'),
    })
    assert.equal(r1.ok, true)
    assert.equal(r1.why, 'tagged')
    assert.equal(r1.ref, lib.orphanBackupRefName(SHA, 'land'), 'ref 名必须由 lib 单源拼出')
    state.tagExists = true
    const r2 = LAND.backupIfAbandoned(SHA, '第 3 回又输(同一枚)', dir, {
      headOf: () => OTHER,
      runner,
      ledgerFile,
      now: new Date('2026-10-29T00:05:00Z'),
    })
    assert.equal(r2.ok, true)
    assert.equal(r2.already, true, '同名 ref 已在 ⇒ 必须报 already 而不是重复打')
    assert.equal(runner.tagCalls().length, 1, `tag 只许派一次,实际 ${runner.tagCalls().length} 次`)
    const lines = readFileSync(ledgerFile, 'utf8').trim().split('\n')
    assert.equal(lines.length, 1, '留痕按实际备份计数,already 不得再写一行')
    assert.equal(JSON.parse(lines[0]).kind, 'land')
  } finally {
    rmScratch(dir)
  }
})

test('④ 防 tag 噪声格:ref 当前值(含首尾空白)指向该 sha ⇒ why:landed 且不派 git;问不到 ref ⇒ 宁多备一枚(失效方向是"多备份",不是"假装修过")', () => {
  const r1 = spyRunner()
  const res = LAND.backupIfAbandoned(SHA, '回读出口竞态', '.', { headOf: () => `  ${SHA}\n`, runner: r1 })
  assert.equal(res.why, 'landed', 'git 回值带换行/空白也必须判成"已是指 ref 值"')
  assert.equal(r1.calls.length, 0)
  // detached / git 问不到 ⇒ 该枚结构上不可能"已成为 ref 值",走备份分支宁备勿漏
  const dir4 = mkScratch('orphan-backup-t4-')
  try {
    const r2 = spyRunner()
    const res2 = LAND.backupIfAbandoned(SHA, 'detached 面', dir4, {
      headOf: () => null,
      runner: r2,
      ledgerFile: join(dir4, 'l.jsonl'),
    })
    assert.equal(res2.ok, true)
    assert.equal(r2.tagCalls().length, 1, '判不成"已落地"时必须落备份 tag')
  } finally {
    rmScratch(dir4)
  }
})

test('⑤ sha 形状不对:必须"未备份 + 出声",不得静默折成已备份(§0.3);空 sha 同判', () => {
  assert.equal(lib.orphanBackupRefName('zxcvbn', 'land'), null)
  const msgs = []
  const runner = spyRunner()
  const empty = LAND.backupIfAbandoned('', '循环没造出 sha', '.', { headOf: () => OTHER, runner, logger: (m) => msgs.push(String(m)) })
  assert.equal(empty.ok, false)
  assert.equal(empty.why, 'no-sha', '空 sha 不得被读成已备份')
  const bad = LAND.backupIfAbandoned('zxcvbn', '畸形 sha', '.', {
    headOf: () => OTHER,
    runner,
    logger: (m) => msgs.push(String(m)),
    ledgerFile: join('.', 'orphan-backup-t5-none.jsonl'),
  })
  assert.equal(bad.ok, false)
  assert.equal(bad.ref, null)
  assert.equal(bad.why, 'bad-sha-or-kind')
  assert.ok(msgs.some((m) => m.includes('zxcvbn') && m.includes('⚠️')), '坏形状必须出声点名该 sha')
  assert.equal(runner.tagCalls().length, 0, '形状不对绝不许把坏名字递给 git tag')
})

test('⑥ 薄封装不吞判据:converge 的再导出与 lib 同函数,conv 档历史命名逐字不变', () => {
  assert.equal(typeof CONV.orphanBackupRefName, 'function', '__test__ 里的按名出口没了(门 253 D2 型)')
  assert.equal(CONV.orphanBackupRefName(SHA), lib.orphanBackupRefName(SHA, 'conv'))
  assert.ok(CONV.orphanBackupRefName(SHA).startsWith(lib.ORPHAN_TAG_PREFIX), '备份名必须落 30a 认账的 lost-commit/* 族')
  for (const bad of ['', 'zxcvbn', undefined, null]) {
    assert.equal(CONV.orphanBackupRefName(bad), null)
  }
})

/**
 * ⑦ 第四弃落口锁:`casUpdateRef` **抛出**(不是返回 false)那一型也必须先备份再原样抛。
 * 立因:抛出会崩出 CAS 循环,本轮已 commit-tree 的 sha 就地变成无备份孤儿 —— 而门 30a 只数得出孤儿、
 * 数不出是谁造的。这条锁同时钉"异常没被吞"(备份是善后,不得改变本器退出码语义)。
 */
test('⑦ casUpdateRef 抛出一型:先备份、再原样 rethrow(不吞异常、不改退出码)', () => {
  assert.match(
    landSrc,
    /catch \(casErr\)[\s\S]{0,600}?backupIfAbandoned\(\s*commit[\s\S]{0,300}?throw casErr\s*\}/,
    'CAS 抛出分支里必须"先 backupIfAbandoned(commit…) 再 throw casErr";缺一即那枚 sha 无备份,或异常被吞',
  )
  const calls = (landSrc.match(/backupIfAbandoned\(/g) || []).length
  assert.ok(calls >= 4, `弃落出口调用数应 ≥4(CAS 输 / 耗尽兜底 / CAS 抛出 / __test__ 出口),实测 ${calls}`)
  // 反向对照:守卫自身绝不抛(契约上它必须"永不抛",否则备份失败会把落地器炸成另一种失效)
  assert.doesNotThrow(() => LAND.backupIfAbandoned(null, '测试:无 sha', '.', { backup: () => ({ ok: false }) }))
})
