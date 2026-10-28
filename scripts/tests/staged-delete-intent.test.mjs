// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:票 G-1018292 —— 共享索引被整批清空后,"他人已暂存的删除"丢失保护标记。
 *
 * 事故链(票面实测,2026-09-28 09:13–09:17):另一会话把一个测试文件以 `D ` 形态暂存;
 * `safe-commit.mjs` Step① 的 `git reset HEAD` 清空整个暂存区(那正是它"不把别人在途内容
 * 打包进我提交"的设计),效果是那枚保护标记一起没了;此后 `heal-worktree-tracked.mjs`
 * 的存续自愈判定"工作树缺 ∧ 索引 blob==HEAD blob ∧ HEAD 有"三条成立 ⇒ 把文件恢复回盘上。
 * 净结果那次是好的(恢复字节与 HEAD 同值),但**机制是反的**:一枚有意的删除会被任何一次
 * 与它无关的第三方提交复活,而两边账面都绿。
 *
 * 本文件钉死三件事:
 *   ① **判据有牙**:清空确实摘掉了标记(正例必须报 intent-lost),且这是**观测**不是推断 ——
 *      reflog / `reflog show --name-status` / `fsck` 三条路实测都答不了(见 EXP-REFLOG 用例),
 *      所以判据只能在 reset 之前那一瞬取样。
 *   ② **反例①干净工作树不误报**:没有暂存删除时判据必须 no-intent —— 否则它是恒红门。
 *   ③ **反例②本会话自删行为逐字不变**:属本票声明面的删除会被 Step2 的 add -A 重新暂存,
 *      标记不丢,不得算成丢失(否则"我自己删我自己提交"这一档恒红)。
 *   ④ **判不出不许冒红也不许记绿**:任一侧取不到 ⇒ undetermined(不是 no-intent)。
 *
 * git 写操作只发生在临时仓内(§26 夹具落点),绝不碰真仓索引与 refs。
 * 不用 `--self-test` 那条内置演练:它的夹具目录 `.ihui-agent/tmp/` 未入库,
 * 在干净检出上会 ENOENT(HEAD 基线工作树实测 rc=2、stdout 0 行,与本票改动无关)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  judgeStagedDeleteIntent,
  parseNameStatusZ,
  readCachedNameStatus,
  snapshotStagedDeleteIntent,
} from '../lib/staged-delete-intent.mjs'
import {
  findOrphanedDeletions,
  recentlyClearedStagedIntent,
  heal,
  intentExpiryTtlHours,
} from '../heal-worktree-tracked.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAFE_COMMIT = join(HERE, '..', 'safe-commit.mjs')
const LIB = join(HERE, '..', 'lib', 'staged-delete-intent.mjs')

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'commit.gpgSign=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 << 20,
  })

/**
 * 夹具仓:`base.txt`(基线文件,用来做"他人暂存删除")+ `mine.txt`(本票自己声明的文件)。
 * 磁盘字节与 git 状态都由本函数自己断言,**不靠注释声称**。
 */
function scratchRepo(t, prefix = 'g1018292-') {
  const dir = mkScratch(prefix)
  t.after(() => {
    try {
      rmScratch(dir)
    } catch (e) {
      // 本环境 safe-delete 对 >50 项批量删要求确认(git 夹具的 .git 项数天然超限)。
      // 清理失败不得改写判据结论;残留交 §26 每日 Temp 体检兜。
      console.warn(`⚠ G-1018292 夹具清理未执行 ${dir}:${e?.message ?? e}`)
    }
  })
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'gates@ihui.test')
  git(dir, 'config', 'user.name', 'gates-1018292')
  writeFileSync(join(dir, 'base.txt'), 'v1\n')
  writeFileSync(join(dir, 'mine.txt'), 'v1\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'base')
  return dir
}

// ─── EXP-REFLOG:判据只能取样在 reset 之前(票面②建议的 reflog 路实测走不通) ───
test('EXP-REFLOG:清空后 reflog/fsck 结构上答不出"曾否是暂存态" ⇒ 判据必须取样在 reset 之前', (t) => {
  const dir = scratchRepo(t, 'g1018292-reflog-')
  git(dir, 'rm', '-q', '--', 'base.txt') // 他人暂存删除
  const snap = snapshotStagedDeleteIntent({ root: dir })
  assert.equal(snap.ok, true, '清空前必须取得到索引面(否则正例无从谈起)')
  assert.deepEqual(
    snap.before.filter((e) => e.status === 'D').map((e) => e.path),
    ['base.txt'],
    '清空前的索引面必须读到那枚 D',
  )

  git(dir, 'reset', 'HEAD')

  // 逐条试票面②建议的三条路,断言它们都拿不到"曾否暂存"的证据。
  const reflog = git(dir, 'reflog', '--all')
  assert.ok(
    !/rm|delete/i.test(reflog),
    `reflog 里不该有任何删除条目(若将来 git 改了行为,本用例会提醒重估判据):\n${reflog}`,
  )
  const nameStatus = git(dir, 'reflog', 'show', '--name-status', 'HEAD')
  assert.ok(
    !/\tD\t/.test(nameStatus) && !/^D\t/m.test(nameStatus),
    `reflog --name-status 不含索引面的 D(它给的是提交树之间的差异):\n${nameStatus}`,
  )
  const fsck = git(dir, 'fsck', '--no-progress')
  assert.equal(
    fsck.trim(),
    '',
    'fsck 无输出 ⇒ 暂存删除不产生对象,索引不是对象库的一部分',
  )
  // 决定性的一条:清空之后,索引面里那枚 D 真的读不到了 ⇒ 事后无痕。
  const after = readCachedNameStatus({ root: dir })
  assert.deepEqual(after, [], '清空后索引面为空 —— 这就是"标记被摘掉"的观测定义')
})

// ─── 正例:清空确实摘掉他人暂存删除 ⇒ 必须报 intent-lost 并点名 ───
test('正例:暂存区有他人删除 → 走完 Step① 清空 → 判据报"删除意图丢失"并点名该路径', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, 'mine.txt'), 'v2\n')
  git(dir, 'rm', '-q', '--', 'base.txt') // 另一会话的暂存删除
  // 自证:清空前确是 `D ` 形态(索引里没有、HEAD 有、盘上也没有)
  assert.match(git(dir, 'status', '--porcelain'), /^D {2}base\.txt$/m, '夹具自证:清空前是暂存删除形态')

  const snap = snapshotStagedDeleteIntent({ root: dir })
  assert.equal(snap.ok, true)

  git(dir, 'reset', 'HEAD') // Step① 的逐字动作
  const after = readCachedNameStatus({ root: dir })

  const verdict = judgeStagedDeleteIntent({ before: snap.before, after, ownPaths: ['mine.txt'] })
  assert.equal(verdict.kind, 'intent-lost', `必须报意图丢失,实得 ${verdict.kind}(${verdict.reason})`)
  assert.deepEqual(verdict.lost, ['base.txt'], '必须逐字点名那一枚丢失的路径')
  assert.deepEqual(verdict.selfStaged, [], '他人路径不得被算成"本票自删"')
  assert.deepEqual(verdict.kept, [], '没有"仍是暂存态"的路径')

  // 机制侧确认:三条判据此刻全成立 ⇒ 改前存续自愈会把它当成外部删除恢复。
  const st = git(dir, 'status', '--porcelain')
  assert.match(st, /^ D base\.txt$/m, '退化后的形态是 ` D`(标记已摘,索引 blob==HEAD blob)')
  assert.equal(existsSync(join(dir, 'base.txt')), false, '盘上确实没有(这正是被恢复的对象)')
})

// ─── 反例①:干净工作树 ⇒ 绝不误报(否则它是恒红门) ───
test('反例①:干净工作树(无暂存删除)⇒ 判据 no-intent,不报丢失、不点名', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, 'mine.txt'), 'v2\n')

  const snap = snapshotStagedDeleteIntent({ root: dir })
  assert.equal(snap.ok, true)
  assert.deepEqual(snap.before, [], '夹具自证:索引面干净')

  git(dir, 'reset', 'HEAD')
  const after = readCachedNameStatus({ root: dir })

  const verdict = judgeStagedDeleteIntent({ before: snap.before, after, ownPaths: ['mine.txt'] })
  assert.equal(verdict.kind, 'no-intent', `干净树必须 no-intent,实得 ${verdict.kind}(${verdict.reason})`)
  assert.deepEqual(verdict.lost, [], '干净树不得报出任何丢失路径')

  // 存续自愈侧同步:干净树不得产出任何 intentLost 报数。
  assert.deepEqual(findOrphanedDeletions(dir).intentLost, [], '干净树不得有 intentLost')
})

// ─── 反例①b:只有 M/A 暂存项(无 D)⇒ 同样不得报丢失 ───
test('反例①b:暂存区只有 M 与 A(无 D)⇒ no-intent —— 判据只看 D,不看"暂存区非空"', (t) => {
  const dir = scratchRepo(t)
  writeFileSync(join(dir, 'mine.txt'), 'v2\n')
  writeFileSync(join(dir, 'added.txt'), 'new\n')
  git(dir, 'add', '-A') // 一枚 M + 一枚 A,零枚 D

  const snap = snapshotStagedDeleteIntent({ root: dir })
  const verdict = judgeStagedDeleteIntent({ before: snap.before, after: snap.before, ownPaths: [] })
  assert.equal(verdict.kind, 'no-intent', '有 M/A 不等于有删除意图 —— 否则每次普通提交都喊丢失')
  assert.deepEqual(verdict.lost, [])
})

// ─── 反例②:删除是本会话自己刚做的 ⇒ 不得算成"意图丢失" ───
test('反例②:删除是本票声明面自己的 ⇒ 归 selfStaged(Step2 会重新暂存),不算丢失', (t) => {
  const dir = scratchRepo(t)
  git(dir, 'rm', '-q', '--', 'mine.txt') // 本会话自己删的,且它在声明面里

  const snap = snapshotStagedDeleteIntent({ root: dir })
  git(dir, 'reset', 'HEAD')
  const after = readCachedNameStatus({ root: dir })

  const verdict = judgeStagedDeleteIntent({ before: snap.before, after, ownPaths: ['mine.txt'] })
  assert.equal(verdict.kind, 'no-intent', `本会话自删不得报丢失,实得 ${verdict.kind}(${verdict.reason})`)
  assert.deepEqual(verdict.lost, [], '自删不得进 lost')
  assert.deepEqual(verdict.selfStaged, ['mine.txt'], '自删必须被点名在 selfStaged 里(可追责,不静默)')

  // 行为与改前逐字一致的另一半:Step2 的 `git add -A --` 之后标记真的回来了。
  git(dir, 'add', '-A', '--', 'mine.txt')
  const restored = readCachedNameStatus({ root: dir })
  assert.deepEqual(
    restored.filter((e) => e.status === 'D').map((e) => e.path),
    ['mine.txt'],
    '自删那一档的标记由 Step2 重新暂存回来 ⇒ 提交链行为与改前逐字一致',
  )
})

// ─── 判不出:取不到就报未判定,不许冒红也不许记绿 ───
test('判不出:任一侧取不到 ⇒ undetermined(不折进 no-intent,也不折进 intent-lost)', () => {
  const before = [{ status: 'D', path: 'x.txt' }]
  const onlyBefore = judgeStagedDeleteIntent({ before, after: null, ownPaths: [] })
  assert.equal(onlyBefore.kind, 'undetermined', 'after 取不到必须判不出')
  assert.deepEqual(onlyBefore.lost, [], '判不出时不得报出丢失路径(那是编造)')

  const onlyAfter = judgeStagedDeleteIntent({ before: null, after: [], ownPaths: [] })
  assert.equal(onlyAfter.kind, 'undetermined', 'before 取不到必须判不出')
  assert.deepEqual(onlyAfter.lost, [])

  // 恒真的诱饵:清空后索引面按定义不含 D,若只比"单面"就会恒判丢失。
  // 断言两侧都是观测时,清空前后完全相同的面必须判 no-intent(不得凭空生事)。
  const same = judgeStagedDeleteIntent({ before, after: before, ownPaths: [] })
  assert.equal(same.kind, 'no-intent', '两侧观测相同 ⇒ 什么都没丢')
})

// ─── 取材层:奇数字段 ⇒ 取不到(返回 null),不返回半截清单 ───
test('取材层:-z 奇数字段(截断)必须判 null,不得返回半截结果', () => {
  assert.equal(parseNameStatusZ('D\0a.txt\0M\0'), null, '奇数个字段 = 截断 = 取不到')
  assert.deepEqual(
    parseNameStatusZ('D\0a.txt\0M\0b.txt\0'),
    [
      { status: 'D', path: 'a.txt' },
      { status: 'M', path: 'b.txt' },
    ],
    '成对字段必须按 status/path 交替解析',
  )
  assert.equal(parseNameStatusZ('DD\0a.txt\0'), null, '多字母状态码 = 看不懂 = 取不到')
  // 判据有牙的反证:非 -z 形态会把中文名按 quotePath 转写 ⇒ 判据必须只认 -z
  assert.deepEqual(parseNameStatusZ('D\0中文名.txt\0'), [{ status: 'D', path: '中文名.txt' }])
})

// ─── 存续自愈侧:读到账 ⇒ 移入报数档(只报数不代裁);读不到 ⇒ 照原判据 ───
test('存续自愈:账里点名的路径不再被当成"外部删除"恢复,而是移入 intentLost 报数', (t) => {
  const dir = scratchRepo(t)
  git(dir, 'rm', '-q', '--', 'base.txt') // 他人暂存删除
  const snap = snapshotStagedDeleteIntent({ root: dir })
  git(dir, 'reset', 'HEAD') // 标记被摘掉

  // 改前行为:三条判据成立 ⇒ 落进 safe(会被恢复)。
  const beforeGate = findOrphanedDeletions(dir)
  assert.ok(
    beforeGate.safe.includes('base.txt'),
    '夹具自证:无账时该路径落进 safe(即改前会被恢复)',
  )
  assert.deepEqual(beforeGate.intentLost, [], '无账时不得凭空有 intentLost')

  // 写账(形态与 safe-commit 的 recordClearedStagedDeletions 一致)
  const verdict = judgeStagedDeleteIntent({ before: snap.before, after: readCachedNameStatus({ root: dir }), ownPaths: ['mine.txt'] })
  assert.equal(verdict.kind, 'intent-lost')
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'index-purge-cleared-staged-deletions',
      clearedIntentLost: verdict.lost,
      selfStagedReadded: verdict.selfStaged,
      stillStaged: verdict.kept,
      actionTaken: 'report-only',
    }) + '\n',
  )

  assert.deepEqual([...recentlyClearedStagedIntent(dir)], ['base.txt'], '读账必须取到那一枚路径')
  const afterGate = findOrphanedDeletions(dir)
  assert.ok(
    !afterGate.safe.includes('base.txt'),
    '有账时不得再落进 safe —— 那就是本票要防的那次自动恢复',
  )
  assert.deepEqual(afterGate.intentLost, ['base.txt'], '必须移入 intentLost 报数档')
  assert.equal(
    existsSync(join(dir, 'base.txt')),
    false,
    '判据层只报数不代裁:此刻仍不该有任何恢复动作(恢复由 heal() 决定,本用例只验判据面)',
  )
})

// ─── 到期档(2026-10-23 立):摘标超 TTL 仍缺 ⇒ 回盘 + 意图逐字转进新留痕 ───
function writeIntentLedger(dir, ts, paths = ['base.txt']) {
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    JSON.stringify({
      ts,
      event: 'index-purge-cleared-staged-deletions',
      clearedIntentLost: paths,
      actionTaken: 'report-only',
    }) + '\n',
  )
}

test('到期档:TTL 内不恢复;超 TTL 回盘并把意图写回同一本账;时刻读不出不恢复', (t) => {
  const H = 3600_000
  // ① TTL 内 ⇒ 照旧"只报数"(阳性对照:加了到期绝不能把在飞席位的东西抢回来)
  const a = scratchRepo(t)
  git(a, 'rm', '-q', '--', 'base.txt')
  git(a, 'reset', 'HEAD')
  writeIntentLedger(a, new Date(Date.now() - 30_000).toISOString())
  const fresh = findOrphanedDeletions(a, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(fresh.intentLost, ['base.txt'], 'TTL 内必须仍落 intentLost')
  assert.deepEqual(fresh.intentExpired, [], 'TTL 内不得到期')
  assert.ok(!fresh.safe.includes('base.txt'), 'TTL 内不得进恢复清单')

  // ② 超 TTL ⇒ 移入到期并随 safe 回盘;heal 落地成功后写新留痕,且新留痕不再被读侧消费
  const b = scratchRepo(t)
  git(b, 'rm', '-q', '--', 'base.txt')
  git(b, 'reset', 'HEAD')
  writeIntentLedger(b, new Date(Date.now() - 3 * H).toISOString())
  const expired = findOrphanedDeletions(b, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(expired.intentExpired, ['base.txt'], '超 TTL 必须识别成到期档')
  assert.ok(expired.safe.includes('base.txt'), '到期档要随 safe 一起回盘')
  const res = heal(b, {})
  assert.equal(existsSync(join(b, 'base.txt')), true, '到期后文件必须回到盘上(内容恒等于 HEAD)')
  assert.deepEqual(res.intentExpiredPaths, ['base.txt'], '结果里要看得见回盘的那几枚')
  const ledgerAfter = readFileSync(
    join(b, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    'utf8',
  ).trim().split('\n')
  const last = JSON.parse(ledgerAfter[ledgerAfter.length - 1])
  assert.equal(last.event, 'staged-intent-expiry-restored', '意图清单要写回同一本账')
  assert.deepEqual(last.clearedIntentLost, ['base.txt'], '路径逐字留着,归属会话可一句 git rm --cached 坐实')
  // 反自我循环:回盘后再制造同样的缺失,新事件(report-only 之外)不得把它再判成"待裁决"
  git(b, 'rm', '-q', '--', 'base.txt')
  git(b, 'reset', 'HEAD')
  const again = findOrphanedDeletions(b, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(again.intentLost, [], '到期留痕不得被读侧再消费成待裁决(自我循环)')
  assert.ok(again.safe.includes('base.txt'), '无 report-only 证据时回到原判据:按外部删除恢复')

  // ③ 账上时刻读不出 ⇒ 判不出那一档,不恢复(§0.3)
  const c = scratchRepo(t)
  git(c, 'rm', '-q', '--', 'base.txt')
  git(c, 'reset', 'HEAD')
  writeIntentLedger(c, '昨天下午')
  const deaf = findOrphanedDeletions(c, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(deaf.intentLost, ['base.txt'], '时刻解不出来时必须回落到"不代裁"')
  assert.deepEqual(deaf.intentExpired, [], '判不出不是恢复的许可证')

  // ④ TTL 档位本身:非法值回落默认,不接受把档位关成 0(0 ⇒ 恒到期 = 拆牙)
  assert.equal(intentExpiryTtlHours({}), 2, '默认 2 小时')
  assert.equal(intentExpiryTtlHours({ IHUI_STAGED_INTENT_TTL_HOURS: '12' }), 12, '合法覆盖要生效')
  for (const bad of ['0', '-1', 'abc', '']) {
    assert.equal(intentExpiryTtlHours({ IHUI_STAGED_INTENT_TTL_HOURS: bad }), 2, `非法值 ${bad} 必须回落默认`)
  }
})

test('存续自愈:账坏/半截行 ⇒ 读账吞掉并按空集合走,不让每2 分钟一轮的守护崩掉', (t) => {
  const dir = scratchRepo(t)
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    '{"event":"index-purge-cleared-staged-deletions","actionTaken":"report-only","clearedIntentLost":["ok.txt"]}\n{"broken":\n',
  )
  assert.deepEqual(
    [...recentlyClearedStagedIntent(dir)],
    ['ok.txt'],
    '半截行被跳过,但前一条完整记录仍取到 —— 不得因一行坏JSON 丢掉整份证据',
  )
  // actionTaken 不是 report-only 的条目必须被忽略(防止账被改成"已恢复"而本层跟着信)
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    JSON.stringify({ actionTaken: 'restored', clearedIntentLost: ['sneaky.txt'] }) + '\n',
  )
  assert.deepEqual([...recentlyClearedStagedIntent(dir)], [], '非 report-only 的条目不得被采信')
})

// ─── 保护只认最新一条事件(到期档落地后自审出的边界,2026-10-23)───
test('陈旧 report-only 不得永久保护:同一路径的最新事件若是到期留痕 ⇒ 再删按原判据恢复', (t) => {
  const H = 3600_000
  const dir = scratchRepo(t)
  git(dir, 'rm', '-q', '--', 'base.txt')
  git(dir, 'reset', 'HEAD')
  mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    [
      JSON.stringify({
        ts: new Date(Date.now() - 3 * H).toISOString(),
        event: 'index-purge-cleared-staged-deletions',
        clearedIntentLost: ['base.txt'],
        actionTaken: 'report-only',
      }),
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'staged-intent-expiry-restored',
        clearedIntentLost: ['base.txt'],
        actionTaken: 'restored-intent-expired',
      }),
    ].join('\n') + '\n',
  )
  const after = findOrphanedDeletions(dir, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(after.intentLost, [], '最新事件已非 report-only ⇒ 不得再当"待裁决"挂着')
  assert.deepEqual(after.intentExpired, [], '同理不该重复到期')
  assert.ok(after.safe.includes('base.txt'), '无现行保护 ⇒ 回到原判据:按外部删除恢复')

  // 反向对照:report-only 若才是最新一条,保护必须照在(收窄不能反过来吃掉真保护)
  const rev = scratchRepo(t)
  git(rev, 'rm', '-q', '--', 'base.txt')
  git(rev, 'reset', 'HEAD')
  mkdirSync(join(rev, '.ihui-agent', 'state'), { recursive: true })
  writeFileSync(
    join(rev, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl'),
    [
      JSON.stringify({
        ts: new Date(Date.now() - 5 * H).toISOString(),
        event: 'staged-intent-expiry-restored',
        clearedIntentLost: ['base.txt'],
        actionTaken: 'restored-intent-expired',
      }),
      JSON.stringify({
        ts: new Date(Date.now() - 30_000).toISOString(),
        event: 'index-purge-cleared-staged-deletions',
        clearedIntentLost: ['base.txt'],
        actionTaken: 'report-only',
      }),
    ].join('\n') + '\n',
  )
  const revRes = findOrphanedDeletions(rev, { now: Date.now(), ttlHours: 2 })
  assert.deepEqual(revRes.intentLost, ['base.txt'], '最新的 report-only 必须仍在射程内(TTL 内不恢复)')
})

// ─── 形状锁:两处接线不得被摘掉,也不得改成自动恢复 ───

test('形状锁:safe-commit 必须在 reset 之前取样,只标记不代裁(不得出现自动恢复)', () => {
  const src = readFileSync(SAFE_COMMIT, 'utf8')
  const masked = maskCommentsAndStrings(src)

  assert.match(src, /snapshotStagedDeleteIntent\(\{ root: repoRoot \}\)/, '清空前必须取样')
  assert.match(src, /judgeStagedDeleteIntent\(\{/, '必须调判据本体')
  assert.match(src, /readCachedNameStatus\(\{ root: repoRoot \}\)/, '清空后必须再取一次面(差分判据)')

  // 取样必须**在** reset 之前:两个下标可比。
  // ⚠️ 两处定位纪律(都是本用例实测踩出来的):
  //  ① reset 的定位用**未遮罩**的 src:它在源码里是 `gitStep(['reset', 'HEAD'], ...)`,
  //     而 `'HEAD'` 是字符串字面量,会被 maskCommentsAndStrings 抹掉(实测 masked 侧 indexOf = -1)。
  //  ② 三个函数名在文件顶部的 **import 段**里各出现一次,而 mask **保留标识符**
  //     ⇒ 只按裸名 indexOf 会命中 import(恒在 reset 之前),量出假的顺序。
  //     故一律锚在**带实参的调用文本**上。
  const iSnap = masked.indexOf('snapshotStagedDeleteIntent({ root: repoRoot })')
  const iJudge = masked.indexOf('judgeStagedDeleteIntent({')
  const iAfter = masked.indexOf('readCachedNameStatus({ root: repoRoot })')
  const iReset = src.indexOf("gitStep(['reset', 'HEAD']")
  assert.ok(iSnap > -1 && iReset > -1 && iJudge > -1, '三处调用点都要在')
  assert.ok(iSnap < iReset, '取样必须早于 git reset HEAD —— 判据的唯一合法取样窗')
  assert.ok(iAfter > iReset, '清空后的第二次取样必须晚于 reset(否则量的是清空前那一瞬,判据恒空)')
  assert.ok(iJudge > iReset, '判据必须跑在 reset 之后(它比的是清面前后两次观测)')

  // 三条不许漂:代码面(遮掉注释与字符串后)不得出现自动恢复/自动删除的动词。
  assert.ok(
    !/checkout-index|restoreToHead|writeFileSync\(/.test(masked),
    'safe-commit 的本段不得含任何写工作树的调用(只标记与喊人,绝不代裁)',
  )
  assert.match(src, /actionTaken: 'report-only'/, '落盘账必须自记"只报数"')
})

test('形状锁:存续自愈读的是同一份账,且判据面与既有 held 分开记', () => {
  const src = readFileSync(join(HERE, '..', 'heal-worktree-tracked.mjs'), 'utf8')
  assert.match(src, /recentlyClearedStagedIntent/, '必须接上账的读取')
  assert.match(src, /intentLost\.push\(path\)/, '命中账的路径必须被移入 intentLost 而不是 safe')
  assert.match(
    src,
    /return \{ safe, held, orphanIndex, intentLost, intentExpired \}/,
    '必须单列一档,不折进 held;到期档也单列(2026-10-23)',
  )
  // 到期档的三条纪律:①只按 TTL 分档,读不出时刻一律不恢复;②留痕必须排在落地成功之后;
  // ③写进同一本账的新事件不得被自己的读侧再消费成"待裁决"(会自我循环)。
  const masked = maskCommentsAndStrings(src)
  assert.match(src, /const age = Number\.isFinite\(seenAt\) \? now - seenAt : NaN/, '时刻解不出 ⇒ 年龄是 NaN,不是 0')
  assert.match(
    src,
    /if \(Number\.isFinite\(age\) && age > ttlHours \* 3600_000\) \{/,
    '只有"量得到年龄且确已超 TTL"才准进到期档(行为由上面③的夹具用例钉住)',
  )
  assert.ok(
    masked.indexOf('restoreToHead(g, safe)') < masked.indexOf('appendIntentExpiryLedger(repoRoot, expiredRestored'),
    '留痕必须排在落地成功之后(先写后落会把"面上还在"说成"已删")',
  )
  assert.match(
    masked,
    /expiredRestored = intentExpiredPaths\.filter\(\(p\) => done\.includes\(p\)\)/,
    '留痕只能记真正回盘成功的那几枚',
  )
  assert.match(src, /actionTaken: 'restored-intent-expired'/, '新事件必须用非 report-only 的 actionTaken')
  assert.doesNotMatch(src, /actionTaken: 'report-only'[\s\S]{0,40}restored-intent-expired/, '两者不得同形')
  const masked0 = maskCommentsAndStrings(src)
  assert.ok(
    !/intentLost\.push\(path\)[\s\S]{0,80}restore/.test(masked0),
    'intentLost 档里不得夹带恢复动作',
  )
  // 判据本体必须住在 lib 里(两处算同一件事必漂移 ⇒ 只许一份实现)
  const lib = readFileSync(LIB, 'utf8')
  assert.match(lib, /export function judgeStagedDeleteIntent/, '判据本体导出')
  assert.match(lib, /export function snapshotStagedDeleteIntent/, '取样出口导出')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
