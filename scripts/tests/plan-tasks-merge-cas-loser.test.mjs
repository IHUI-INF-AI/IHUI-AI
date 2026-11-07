// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 失败沉积治本(第五单)· CAS 输家臂夹具。
 *
 * 这一格要证明的不是"代码里出现了 backup 字样",而是**人为制造 CAS 失败时的真实行为**:
 *  ① 每轮都失败 ⇒ 中间轮次**一枚 tag 都不打**(只进 jsonl 台账,ref:null);
 *  ② 恰好 **1 枚** tag,且指向**末枚**(最后一次 commit-tree 造出的那枚);
 *  ③ 台账里那两枚 sha 与 tag 指向的 sha 都不相同(证明"末枚"不是"随便一枚")。
 *
 * 为什么必须让 HEAD 在轮间真的前进:若 HEAD 不动,每轮 commit-tree 的 (tree,parent,msg) 全同,
 * 三轮会产出**同一个 sha**,于是"中间枚"与"末枚"在对象库里根本分不开 —— 那种夹具即使断言
 * "只有 1 枚 tag"也只是同义反复。夹具回调在 CAS 前用 `git commit --allow-empty` 把 HEAD 推进
 * 一枚(空提交 ⇒ tree 不变 ⇒ 不会把本应匿名的树变成可达面而触发同 tree 去重)。
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { git as bypassGit } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { openRowsDedupeAndLand, setCasFailuresForTest } from '../plan-tasks-merge.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.resolve(HERE, '../plan-tasks-merge.mjs'), 'utf8')

const TWIN =
  '- [ ] **G-950 未勾等值副本**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕三份逐字相同的未勾选副本,长度越过噪声阈。'
const KEEP =
  '- [ ] **G-951 未带指针的等值孪生**:两份逐字相同 —— 那一族是 F4/F4b 的当次活账,本档不得删。'

const fixture = () => ['# 台账', '', TWIN, TWIN, TWIN, KEEP, KEEP, ''].join('\n')

function makeRepo(text) {
  const dir = mkScratch('cas-loser-')
  try {
    bypassGit(['init', '-q', '.'], { root: dir })
    bypassGit(['config', 'user.email', 'cas-loser@example.invalid'], { root: dir })
    bypassGit(['config', 'user.name', 'cas-loser-fixture'], { root: dir })
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), text, 'utf8')
    bypassGit(['add', 'PROJECT_PLAN.md'], { root: dir })
    bypassGit(['commit', '-q', '-m', 'seed'], { root: dir })
    return dir
  } catch (e) {
    rmScratch(dir)
    throw e
  }
}

const lostTags = (dir) =>
  bypassGit(['tag', '-l', 'lost-commit/*'], { root: dir })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

const readLedger = (dir) => {
  try {
    return readFileSync(path.join(dir, '.ihui-agent', 'state', 'orphan-backup.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  } catch {
    // 台账文件还没建 ⇒ 就是零行(不是"读不到"),空转臂必须断言零行而不是跳过
    return []
  }
}

describe('CAS 输家臂:中间轮次只记台账、末枚才打 tag', () => {
  it('3 轮全败:恰好 1 枚 tag,指向末枚;中间两枚只进台账且 ref:null;rc=1', () => {
    const dir = makeRepo(fixture())
    try {
      const rounds = 3
      const made = []
      // 夹具:每轮 CAS 前把 HEAD 推进一枚空提交(= 模拟并发会话抢先落地),然后让 CAS 失败。
      // 回调收到的 `commit` 就是本轮刚 commit-tree 出来的那枚 —— 用它做"末枚"的独立取证,
      // 而不是靠事后从 tag 反推(反推出来的东西证明不了"牌打在最后一轮"）。
      setCasFailuresForTest(rounds, (commit) => {
        made.push(commit)
        bypassGit(['commit', '--allow-empty', '-q', '-m', 'concurrent-winner-fixture'], { root: dir })
      })
      const rc = openRowsDedupeAndLand(null, rounds, { root: dir })
      assert.equal(rc, 1, '轮次耗尽必须 rc=1(放弃),而不是伪装成已修')
      assert.equal(made.length, rounds, `夹具必须真的制造 ${rounds} 次失败,实得 ${made.length}`)

      const tags = lostTags(dir)
      assert.equal(tags.length, 1, `恰好 1 枚 lost-commit tag,实得 ${tags.length}:${tags.join(',')}`)
      assert.match(tags[0], /^lost-commit\/wip-merge-[0-9a-f]{7}$/, '命名必须在 lost-commit/* 的 merge 档,不得新起前缀')

      const headAfter = bypassGit(['rev-parse', 'HEAD'], { root: dir })
      const tagged = bypassGit(['rev-parse', `${tags[0]}^{}`], { root: dir })
      assert.equal(tagged, made[made.length - 1], 'tag 必须指向**末枚**(最后一轮 commit-tree 造出的那枚)')
      assert.notEqual(tagged, headAfter, 'tag 不得是赢家那枚(赢家已在 HEAD 上,再打 tag 等于把可达面当孤儿)')

      const ledger = readLedger(dir).filter((r) => r.superseded === true)
      assert.equal(ledger.length, rounds - 1, `中间轮次必须全部落台账,实得 ${ledger.length}`)
      for (const [i, r] of ledger.entries()) {
        assert.equal(r.ref, null, '台账行不得带 ref(它不是备份,30a 仍按"无 tag = 未备份"判)')
        assert.equal(r.sha, made[i], '台账里的每一枚必须逐轮对上中间 sha')
        assert.notEqual(r.sha, tagged, '台账里的中间 sha 必须与末枚不同,否则"末枚"断言是同义反复')
      }
    } finally {
      setCasFailuresForTest(0)
      rmScratch(dir)
    }
  })

  it('CAS 一次都不失败时:零 tag、零台账(不许把正常落地也记成孤儿)', () => {
    const dir = makeRepo(fixture())
    try {
      setCasFailuresForTest(0)
      const rc = openRowsDedupeAndLand(null, 8, { root: dir })
      assert.equal(rc, 0)
      assert.equal(lostTags(dir).length, 0, '赢家臂不许产生任何 lost-commit tag')
      assert.equal(
        readLedger(dir).filter((r) => r.superseded === true).length,
        0,
        '赢家臂不许产生"被取代"台账',
      )
    } finally {
      rmScratch(dir)
    }
  })
})

describe('接线锁:8 处出口逐个钉住(防止下一次改动把某处悄悄退回"一个都不打")', () => {
  const slice = (start, end) => {
    const i = SRC.indexOf(start)
    if (i < 0) throw new Error(`源文件找不到起点:${start}`)
    const j = end ? SRC.indexOf(end, i) : -1
    return SRC.slice(i, j < 0 ? undefined : j)
  }

  const loops = [
    ['rowsDedupeAndLand', 'export function rowsDedupeAndLand', '// ── 未勾单行等值副本档'],
    ['openRowsDedupeOnce', 'function openRowsDedupeOnce', 'export function openRowsDedupeAndLand'],
    ['twinFoldAndLand', 'export function twinFoldAndLand', '// ── 漂开副本归并档'],
    ['driftedMergeAndLand', 'export function driftedMergeAndLand', '// ── 漂开族自动折叠档'],
    ['foldDriftedFamiliesAndLand', 'export function foldDriftedFamiliesAndLand', '// ── 自愈层'],
  ]

  const singles = [
    ['healAndLand', 'export function healAndLand', 'function healWithPrefixHolder'],
    ['healWithPrefixHolder', 'function healWithPrefixHolder', 'export function dedupeAndLand'],
    ['dedupeAndLand', 'export function dedupeAndLand', 'export function pointerVisibilityRegression'],
  ]

  for (const [name, start, end] of loops) {
    it(`${name}:失败轮走台账、终态出口走 tag,且正向 CAS 一律走可注入的 casForward`, () => {
      const body = slice(start, end)
      assert.match(body, /casForward\(/, `${name} 的正向 CAS 必须走 casForward(否则夹具造不出失败臂)`)
      assert.match(body, /noteSupersededRound\(/, `${name} 的中间轮次必须只记台账`)
      assert.match(body, /backupUnlanded(?:Orphan)?\(/, `${name} 的终态出口必须照打末枚`)
      assert.match(body, /轮均未抢到 CAS\(末枚兜底\)/, `${name} 必须在轮次耗尽处出声并备份`)
    })
  }

  for (const [name, start, end] of singles) {
    it(`${name}:单发/raw update-ref 失败即终态,必须就地备份`, () => {
      const body = slice(start, end)
      assert.match(body, /backupUnlandedOrphan\(/, `${name} 的 CAS 失败出口必须备份,不得一枚都不打`)
    })
  }

  it('本文件的正向 CAS 不得再绕开 casForward(逐处点名,漏一处即红)', () => {
    // BYPASS_LANDING_SITES 表里有 `cas: 'casUpdateRef(landed.commit, parent'` 这类**字符串字面量**
    // (那是统计器认形状用的),它们不是调用点 —— 只数真正出现在代码行上的调用。
    const calls = SRC.split('\n').filter((l) => /^\s*(?:if \(!)?casUpdateRef\(landed\.commit/.test(l)).length
    assert.equal(calls, 0, `仍有 ${calls} 处正向 CAS 直接调 casUpdateRef`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
