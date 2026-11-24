// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * G-998105 镜像测试(2026-10-07 拍板·选②):acquire 判据形状防"顺手统一"锁。
 *
 * 票面:上游把"触到 maxWait"当终态 —— 只抛带持有者信息的超时错,等待者不会在预算
 * 耗尽那一刻变成立即回收者。我方与上游的差异是**刻意允许最后时刻抢占**(设计选择,
 * 不是疏漏),acquire 判据保持不变。本文件钉两件事:
 *  ① 结构锁:acquire 抢占判据 `!holderAlive || age > hardStaleMs || age > staleMs` 的形状
 *    未被"顺手统一"成单实例档(tryAcquireSingleInstance:持有者活着的锁绝不抢)的形态;
 *    头注与判读块的两处登记注释("刻意允许最后时刻抢占")也在位。
 *  ② 行为镜像:同一形状的夹具(活 pid + 锁龄超 staleMs + meta 无身份凭据 ⇒ unverifiable)
 *    分别喂两档,结果必须分叉 —— acquire 档抢占成功并易主,单实例档按"他人持有"跳过
 *    且原锁一字未动。分叉消失 = 两档被统一了,本文件必红。
 * 登记出处:scripts/git-lock.mjs 头注 G-998105 条目 + acquire 判读块注释。
 *
 * 真机零副作用(红线):锁目录取 mkScratch();cleanIndexLocks 关闭(不扫真 .git 的
 * index.lock);归档落点指进夹具(抢占现场不落 gitArchiveDir());不传 metricsFile
 * (等待事件不落真账本);meta 无 pidStart ⇒ 身份对账短路为 unverifiable,不派生 PowerShell。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gl, tryAcquireSingleInstance } from '../git-lock.mjs'

const SRC = readFileSync(new URL('../git-lock.mjs', import.meta.url), 'utf8')
/** 与 git-lock-stale-steal.test.mjs ⑤ 同款:只看代码行,整行注释不算判据 */
const toCodeOnly = (src) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
/** acquire 抢占判据的形状(票面锚 721 行,行号会漂;锚的是判据本身) */
const ACQUIRE_SHAPE = /else if \(!holderAlive \|\| age > hardStaleMs \|\| age > staleMs\) \{/

function mkFixture(t) {
  const scratch = mkScratch('g-998105-')
  t.after(() => rmScratch(scratch))
  return { dir: join(scratch, 'ihui-git-write.lock'), archive: join(scratch, 'arch') }
}

/** 造一把旧形态锁:meta 无 host/pidStart ⇒ 身份三元组对账只能判 unverifiable */
function putLock(dir, { unitId, pid, ts }) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ unitId, pid, ts }), 'utf8')
}

test('①结构锁:acquire 抢占判据形状未被"顺手统一"成单实例档形态', () => {
  assert.match(
    toCodeOnly(SRC),
    ACQUIRE_SHAPE,
    'acquire 档判据形状变了 —— 若是把"名义活着超龄也抢"统一成单实例档的"活人不抢",' +
      '须先由锁持有人重新拍板(G-998105 选②=维持现状),不得顺手改',
  )
  // 变异对照(防恒绿):判据真被换成单实例档形态时,本锁必须红
  const mutated = SRC.replace(
    'else if (!holderAlive || age > hardStaleMs || age > staleMs) {',
    'else if (!holderAlive && age > staleMs) {',
  )
  assert.doesNotMatch(
    toCodeOnly(mutated),
    ACQUIRE_SHAPE,
    '变异对照失灵:判据被统一后本锁没红 = 这条结构锁在替缺陷背书',
  )
})

test('①b结构锁:两档差异的登记注释在位(头注 + acquire 判读块两处)', () => {
  const marks = SRC.split('刻意允许最后时刻抢占').length - 1
  assert.ok(marks >= 2, `"刻意允许最后时刻抢占"登记须两处在位(头注+判读块),实得 ${marks} 处`)
  assert.ok(SRC.includes('G-998105'), '票号 G-998105 的登记出处丢了')
  assert.ok(
    SRC.includes('持有者活着的锁绝不抢'),
    '单实例档"活人不抢"的口径登记丢了 —— 两档差异要两头都写着,只写一边必漂',
  )
})

test('②行为镜像:同形状夹具(活pid+超龄+无身份凭据)喂两档,结果必须分叉', async (t) => {
  const a = mkFixture(t)
  const b = mkFixture(t)
  // 同一形状:持有者 = 本进程(真活),锁龄 2s 超 staleMs=50ms,meta 无身份凭据
  const shape = { pid: process.pid, ts: Date.now() - 2_000 }
  putLock(a.dir, { unitId: 'g-998105-holder', ...shape })
  putLock(b.dir, { unitId: 'g-998105-holder', ...shape })

  // acquire 档:刻意允许最后时刻抢占 ⇒ 名义活着的持有者超龄即抢,抢完接着拿到锁
  const got = await gl.acquire({
    unitId: 'g-998105-waiter',
    dir: a.dir,
    staleMs: 50,
    hardStaleMs: 1_800_000,
    timeoutMs: 2_000,
    cleanIndexLocks: false,
    claimArchiveRoot: a.archive,
    log: () => {},
  })
  assert.equal(got, true, 'acquire 档必须按既有判据放行(名义活着超龄也抢=刻意允许最后时刻抢占)')
  assert.equal(gl.readMeta(a.dir)?.unitId, 'g-998105-waiter', '抢占后锁应易主到等待者')
  const archivedA = existsSync(a.archive) ? readdirSync(a.archive) : []
  assert.ok(
    archivedA.some((n) => n.includes('.stale-')),
    `抢占必须走 claimStaleLock 原子改名并留档,实得 ${JSON.stringify(archivedA)}`,
  )

  // 单实例档:同一形状 ⇒ 持有者活着的锁绝不抢(唯一例外是身份确证复用,这里判不出 ⇒ 不抢)
  const single = tryAcquireSingleInstance({
    dir: b.dir,
    unitId: 'g-998105-waiter',
    staleMs: 50,
    claimArchiveRoot: b.archive,
    log: () => {},
  })
  assert.equal(single.acquired, false, '单实例档不得跟着 acquire 档"顺手统一"(活人的锁绝不抢)')
  assert.equal(single.kind, 'skipped-held', `须按"他人持有"跳过,实得 kind=${single.kind}`)
  assert.ok(existsSync(b.dir), '单实例档不得动原锁')
  assert.equal(gl.readMeta(b.dir)?.unitId, 'g-998105-holder', '原锁归属必须原样')
  assert.equal(
    existsSync(b.archive) ? readdirSync(b.archive).length : 0,
    0,
    '单实例档没有抢占,不应产生归档现场',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
