// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree 自动回收调度层(2026-10-30)的证明面。
 *
 * 钉四件事:
 *  (a) 装车:两处挂点(main() 健康轮次 `!CHECK_ONLY` 与 daemon tick)都必须真的派生;
 *  (b) 节流是节奏不是封量:未到 24h 窗口绝不派生;
 *  (c) 三态不并桶:回收 N 个 ⇒ ✅ / 无候选 ⇒ 静默 / 未跑成 ⇒ ⚠️ 且 tick **只冷却 1 小时**;
 *  (d) 归属:本层不得自己判"什么该收"(判据只许住在 agent-worktree.mjs 那一份实现里)。
 * 全部构造输入 + 假 runner ⇒ 零真派生、零真删除。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  reapWorktrees,
  worktreeReapDue,
  parseReapReport,
} from '../lib/git-guardian-worktree-reap.mjs'

const NOW = 1_700_000_000_000
const HOUR = 3_600_000
const DAY = 24 * HOUR
const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')
const LIB = readFileSync(join(HERE, '..', 'lib', 'git-guardian-worktree-reap.mjs'), 'utf8')

function harness(call, intervalMs = DAY, minIdleDays = 7) {
  const logs = []
  let derivations = 0
  return {
    logs,
    get derivations() {
      return derivations
    },
    run(tickFile, now = NOW) {
      return reapWorktrees({
        now,
        intervalMs,
        minIdleDays,
        tickFile,
        logger: (m) => logs.push(String(m)),
        runner: () => {
          derivations++
          return call
        },
      })
    },
  }
}

test('R1 装车锁:main() 健康轮次必须带 !CHECK_ONLY 旗调用,daemon tick 也必须有一处', () => {
  const mainBlock = SRC.slice(0, SRC.indexOf('function startDaemon'))
  assert.match(mainBlock, /if \(!CHECK_ONLY\) reapWorktrees\(\)/, 'main() 没挂回收器(或挂进了 --check 路径)')
  assert.equal(/if \(CHECK_ONLY\) reapWorktrees/.test(SRC), false, '零副作用档不得派生真删除')
  const daemonBlock = SRC.slice(SRC.indexOf('function startDaemon'))
  assert.match(daemonBlock, /reapWorktrees\(\)/, 'daemon 执行体没挂 ⇒ 本机常驻载体永远收不了')
  assert.ok(SRC.split('reapWorktrees()').length - 1 >= 2, '两处挂点缺一处 = 另一半执行体永不回收')
})

test('R2 节流纯函数:无戳 ⇒ 该跑;未到 24h ⇒ 绝不派生', () => {
  assert.equal(worktreeReapDue(NOW, Number.NaN, DAY), true)
  assert.equal(worktreeReapDue(NOW, NOW - 1000, DAY), false)
  assert.equal(worktreeReapDue(NOW, NOW - DAY, DAY), true)
})

test('R3 未到窗口 ⇒ 一次都不派生、不写日志(静默跳过不得冒充"已回收")', () => {
  const dir = mkScratch('worktree-reap-tick-')
  try {
    const tickFile = join(dir, 'tick.iso')
    writeFileSync(tickFile, new Date(NOW - 1000).toISOString(), 'utf8')
    const h = harness({ status: 0, stdout: 'ℹ 无回收候选(1 个检出全数保留;阈值 7 天)', stderr: '' })
    const r = h.run(tickFile)
    assert.equal(r.ran, false)
    assert.equal(h.derivations, 0, '未到窗口却派生了')
    assert.equal(h.logs.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('R4 三态不并桶:真回收 ⇒ ✅ 报个数;无候选 ⇒ 静默;未跑成 ⇒ ⚠️ 且只冷却 1 小时', () => {
  const dir = mkScratch('worktree-reap-run-')
  try {
    const ok = harness({ status: 0, stdout: '✅ 回收 2 个(已 prune)\n', stderr: '' })
    const tickOk = join(dir, 'ok.iso')
    const r1 = ok.run(tickOk)
    assert.equal(r1.removed, 2)
    assert.equal(ok.logs.length, 1)
    assert.match(ok.logs[0], /^✅ worktree 自动回收:2 个/)
    assert.match(ok.logs[0], /并入 main/, '必须写明安全闸,否则读日志的人会以为它在乱删')
    assert.equal(existsSync(tickOk), true, '有结论却不落戳 ⇒ 下一轮又派一遍')

    const quiet = harness({ status: 0, stdout: 'ℹ 无回收候选(1 个检出全数保留;阈值 7 天)', stderr: '' })
    const r2 = quiet.run(join(dir, 'quiet.iso'))
    assert.equal(r2.removed, 0)
    assert.equal(quiet.logs.length, 0, '无候选不该刷日志')

    const failed = harness({ status: 2, stdout: '', stderr: '❌ 未判定:git worktree list 失败' })
    const tickFail = join(dir, 'fail.iso')
    const r3 = failed.run(tickFail)
    assert.equal(r3.ok, false, '未跑成不得被读成已回收')
    assert.match(failed.logs[0], /^⚠️ worktree 回收未跑成/)
    // 失败也写戳,但只写到"距下次到期 1 小时"——不得像旧实现那样白占 24h
    const stamped = Date.parse(readFileSync(tickFail, 'utf8'))
    assert.ok(Number.isFinite(stamped), '失败档必须落戳,否则每 2 分钟重试一次')
    assert.equal(stamped, NOW - DAY + HOUR)
    assert.equal(worktreeReapDue(NOW + 30 * 60_000, stamped, DAY), false, '30 分钟后还在冷却窗内')
    assert.equal(worktreeReapDue(NOW + 61 * 60_000, stamped, DAY), true, '1 小时后必须重试')
  } finally {
    rmScratch(dir)
  }
})

test('R5 归属锁:本层不得自带回收判据(落点/分支/合并/脏判定只许住在 agent-worktree.mjs)', () => {
  const from = LIB.indexOf('export function reapWorktrees')
  assert.ok(from > 0, '切不到函数体(锚点漂了 ⇒ 本条恒真)')
  const body = LIB.slice(from)
  for (const forbidden of ['worktree', 'merge-base', 'is-ancestor', 'readdirSync', 'lstatSync'])
    assert.equal(
      body.includes(`'${forbidden}'`),
      false,
      `本层出现了回收判据输入「${forbidden}」:两处各写一份"什么该收"必漂移`,
    )
  assert.match(body, /--reap/, '唯一动作必须是派生回收器自己的 --reap')
  // 2026-11-11:回收器默认 tag-then-remove(未并入先打 lost-commit 标签保活,零丢现场);
  // 调度层不得自带任何射程旗(--tag-lost / --no-tag-lost)改判据射程 ⇒ 单源纪律不破。
  assert.equal(/--no?-tag-lost/.test(body), false, '调度层不得携带射程旗,回收射程只住 agent-worktree.mjs')
  assert.match(body, /parseReapReport\(/, '读数必须走那一份解析出口')
})

test('R6 解析三态:回收个数与失败个数必须分开读(§0.3 不得并桶)', () => {
  assert.deepEqual(parseReapReport('✅ 回收 3 个(已 prune)'), {
    judged: true,
    removed: 3,
    tagged: 0,
    failed: 0,
  })
  assert.deepEqual(parseReapReport('✅ 回收 2 个,失败 1 个(已 prune)'), {
    judged: true,
    removed: 2,
    tagged: 0,
    failed: 1,
  })
  assert.deepEqual(parseReapReport('ℹ 无回收候选(1 个检出全数保留;阈值 7 天)'), {
    judged: true,
    removed: 0,
    tagged: 0,
    failed: 0,
  })
  assert.equal(parseReapReport('❌ 未判定:git worktree list 失败').judged, false)
  assert.equal(parseReapReport('').judged, false)
})

test('R7 tag-then-remove 新格式:其中 T 个标签段不得吞掉失败数(阳性=新格式全读数;阴性=无该段旧格式)', () => {
  // 阳性对照:tagged 段插在 `个` 与 `,失败` 之间,失败数必须仍被读到(旧正则会静默读成 0)
  assert.deepEqual(
    parseReapReport('✅ 回收 5 个,其中 3 个先打 lost-commit 标签保活,失败 2 个(已 prune;分支一律保留)'),
    { judged: true, removed: 5, tagged: 3, failed: 2 },
  )
  // 阳性对照:全走打标签出口、无失败
  assert.deepEqual(
    parseReapReport('✅ 回收 4 个,其中 4 个先打 lost-commit 标签保活(已 prune;分支一律保留)'),
    { judged: true, removed: 4, tagged: 4, failed: 0 },
  )
  // 阴性对照:无 tagged 段的旧格式仍按 tagged=0 解析(不得把 `,失败` 误配进 tagged 组)
  assert.deepEqual(parseReapReport('✅ 回收 1 个,失败 1 个(已 prune;分支一律保留)'), {
    judged: true,
    removed: 1,
    tagged: 0,
    failed: 1,
  })
  // 端到端:新格式部分失败必须走 partial 分支(成功+失败都报数),不得粉饰成全成功
  const dir = mkScratch('worktree-reap-tag-')
  try {
    const h = harness({
      status: 0,
      stdout: '✅ 回收 5 个,其中 3 个先打 lost-commit 标签保活,失败 2 个(已 prune;分支一律保留)\n',
      stderr: '',
    })
    const r = h.run(join(dir, 'tag.iso'))
    assert.equal(r.partial, true, '带失败的新格式读数必须判为部分成功')
    assert.equal(r.failed, 2)
    assert.equal(r.tagged, 3)
    assert.match(h.logs[0], /^⚠️ worktree 回收:成功 5 个、失败 2 个/)
    // 全成功且含打标签 ⇒ ✅ 日志必须点名 lost-commit 保活,读数可核
    const h2 = harness({
      status: 0,
      stdout: '✅ 回收 6 个,其中 6 个先打 lost-commit 标签保活(已 prune;分支一律保留)\n',
      stderr: '',
    })
    h2.run(join(dir, 'tag-ok.iso'))
    assert.match(h2.logs[0], /^✅ worktree 自动回收:6 个,其中 6 个 HEAD 未并入 main、已先打 lost-commit 标签保活/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
