// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/lib/lock-atomic-init.mjs(台账号 G-814425)。
//
// 钉的是**创建侧**那一格(抢占侧由 git-lock-stale-steal / deploy-lock-stale-steal 两把尺子看着):
//   旧形态 `mkdir(正式锁目录)` → `writeMeta` 的两步窗口里,锁目录**已经对外可见而里面什么都没有**,
//   而两把锁对这一态的既有处置都是"读不到 meta + 龄超阈值 ⇒ 视为残留回收/归档抢占" ——
//   于是**还在初始化中的活锁**可以被别人抢走,原持有者再把 meta 写进别人的锁目录。
//
// 真机零副作用(本票最高红线):全部用例的锁目录/归档落点取自 `mkScratch()`,
// 绝不碰真实 `.git/ihui-git-write.lock`,也不往 `gitArchiveDir()` 堆现场;
// 需要造失败分支的场合一律注入假 fs —— **不写真跨卷、不真造权限故障**。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  acquireLockDirectoryOrThrow,
  auditLockInitSource,
  createLockDirectoryAtomically,
  defaultNonce,
  LockNotAcquiredError,
  pendingPathFor,
} from '../lib/lock-atomic-init.mjs'
import { tryAcquireSingleInstance } from '../git-lock.mjs'

const LOCK_NAME = 'ihui-git-write.lock'
const norm = (p) => String(p).split('\\').join('/')

function fixture(t) {
  const base = mkScratch('lock-atomic-init-')
  t.after(() => rmScratch(base))
  return { base, dir: join(base, LOCK_NAME), archive: join(base, 'arch') }
}

/** 只留代码行(整行注释是在解释"为什么不能用/曾经怎样",不是调用点)—— 与两侧既有反向锁同法。 */
const codeOnly = (src) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

/**
 * 同步忙等:在**单线程**里把"另一进程恰好在这一刻进来"做成确定性的一格,而不是靠 sleep 猜。
 * (真正的两进程并发在臂 A/B 里由 T14 的 spawn 对照补上 —— 那一条才是外部世界的证据,
 *  这一条只保证被钉的时机确实是"owner 还没落地"的那一刻。)
 */
function busyWait(ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    /* 故意占住这一轮:writePayload 内部不可能被别的 JS 打断,所以窗口是确定的 */
  }
}

/** 注入用的 fs 收集器:记录每个动作落在哪个路径上(证"没碰过正式路径"只能这样量)。 */
function spyFs() {
  const seen = []
  return {
    seen,
    existsSync: (p) => {
      seen.push(['existsSync', norm(p)])
      return existsSync(p)
    },
    mkdirSync: (p, o) => {
      seen.push(['mkdirSync', norm(p)])
      return mkdirSync(p, o)
    },
    renameSync: (a, b) => {
      seen.push(['renameSync', norm(a), norm(b)])
      return renameSync(a, b)
    },
    rmSync: (p, o) => {
      seen.push(['rmSync', norm(p)])
      return rmSync(p, o)
    },
  }
}

/**
 * 把夹具的 mtime 回拨 ms 毫秒,并**回读校验**它真的生效了。
 * 不用 `staleMs:-1` 那种负阈值糊弄:实测刚 mkdir 出来的目录 mtime 可以落在**未来**
 * (NTFS 时间戳与 Node 的 ms 换算各有量化),`age > 负数` 就变成一次掷硬币 ——
 * 判据的窗口必须是量出来的,不是猜出来的。
 */
function backdate(path, ms) {
  const d = new Date(Date.now() - ms)
  utimesSync(path, d, d)
  const age = Date.now() - statSync(path).mtimeMs
  assert.ok(age >= ms - 1_000, `夹具没能把 mtime 回拨(实得 age=${age}ms)⇒ 这一臂的"龄超阈值"根本没造出来`)
  return age
}

// ═════════ 一、核心不变量:正式路径出现即等于内容已写全 ═════════

test('T1 写 payload 的那一刻,正式锁目录**还不存在**(半成品永不对外可见)', (t) => {
  const { base, dir } = fixture(t)
  const observed = []
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: (staged) => {
      // 这一维就是整张票的全部价值:旧实现在这里 existsSync(dir) 为 **true**(目录已建、meta 未写),
      // 竞争者据此就能把它读成"目录在而 meta 不在 ⇒ 残留"。新实现必须恒 false。
      observed.push({ canonicalVisible: existsSync(dir), stagedIsThePending: staged !== dir })
      busyWait(15)
      writeFileSync(join(staged, 'meta.json'), JSON.stringify({ unitId: 'A', pid: process.pid }), 'utf8')
      return staged
    },
  })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.deepEqual(observed, [{ canonicalVisible: false, stagedIsThePending: true }])
  // 取得之后:正式路径里的内容就是刚才写全的那一份(不是"目录在、内容随后才补")
  assert.equal(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).unitId, 'A')
  // 不留 pending 残留(残留会被下一轮的"目录在而 meta 不在"判读喂进去)
  assert.deepEqual(readdirSync(base), [LOCK_NAME], `同级不得留 .pending:${readdirSync(base)}`)
})

test('T2 正式路径已在 ⇒ contended,且**一次都没碰过它**(不 rename 覆盖、不 rm)', (t) => {
  const { base, dir } = fixture(t)
  mkdirSync(dir)
  const raw = JSON.stringify({ unitId: '他人', pid: 4321 })
  writeFileSync(join(dir, 'meta.json'), raw, 'utf8')
  writeFileSync(join(dir, 'holder.txt'), 'THEIRS', 'utf8')
  const fs = spyFs()
  const r = createLockDirectoryAtomically({
    dir,
    fs,
    writePayload: () => {
      throw new Error('不该被调用')
    },
  })
  assert.equal(r.ok, false)
  assert.equal(r.kind, 'contended')
  assert.equal(r.code, 'EEXIST', '竞争一律归一成 EEXIST(调用方按这一码分流,lockTimeoutMessage 也读它)')
  // 快路径:正式路径已在 ⇒ 连 pending 都不建(POSIX 的 rename 会**直接替换空目录**,不得 attempt)
  assert.deepEqual(fs.seen, [['existsSync', norm(dir)]], `除一次存在性询问还做了别的:${JSON.stringify(fs.seen)}`)
  assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), raw, '别人的 meta 被动了')
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'THEIRS', '别人的附属文件被动了')
  assert.deepEqual(readdirSync(base), [LOCK_NAME])
})

test('T3 payload 写失败 ⇒ 失败得干净:正式路径根本没出现,pending 也被清掉', (t) => {
  const { base, dir } = fixture(t)
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: () => {
      throw Object.assign(new Error('夹具:磁盘满'), { code: 'ENOSPC' })
    },
  })
  assert.equal(r.kind, 'error')
  assert.equal(r.code, 'ENOSPC')
  assert.equal(existsSync(dir), false, '绝不允许留下一把"看起来存在"的半成品锁')
  assert.equal(r.cleanupError ?? null, null, `pending 未清:${JSON.stringify(r)}`)
  assert.deepEqual(readdirSync(base), [], `base 里留了东西:${readdirSync(base)}`)
})

// ═════════ 二、三条失败分支的**归属**(把没判写成判过了是本仓最高频失效型) ═════════

test('T4 rename 失败而正式路径**不在** ⇒ error,不得折成"别人持锁"', (t) => {
  const { dir } = fixture(t)
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: (s) => writeFileSync(join(s, 'meta.json'), '{"unitId":"A"}'),
    // 正式路径永远答"不在":这一格 rename 失败只能是故障,不能是竞争
    fs: {
      existsSync: (p) => (norm(p) === norm(dir) ? false : existsSync(p)),
      mkdirSync,
      renameSync: () => {
        throw Object.assign(new Error('夹具:权限'), { code: 'EPERM' })
      },
      rmSync,
    },
  })
  assert.equal(r.kind, 'error', `权限故障被读成锁竞争就是把"没做成"写成"别人持锁":${JSON.stringify(r)}`)
  assert.equal(r.code, 'EPERM')
  assert.equal(r.originCode, 'EPERM')
  assert.match(r.message, /不是锁竞争/)
})

test('T5 rename 失败而正式路径**确实在**(Windows EPERM 那一型)⇒ contended + originCode 留痕', (t) => {
  const { dir } = fixture(t)
  // 第一次问"在不在"(快路径)答"不在";rename 时被别人抢先建好 ⇒ 第二次答"在"。
  // 上游 channelRuntime.ts:184-188 的教训:EPERM 既可能是锁竞争也可能只是目录权限错误,
  // **只有正式路径确实存在才进接管分支** —— 拿错误码当凭据就会把权限故障读成抢占授权。
  let afterRename = false
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: (s) => writeFileSync(join(s, 'meta.json'), '{"unitId":"A"}'),
    fs: {
      existsSync: (p) => (norm(p) === norm(dir) ? afterRename : existsSync(p)),
      mkdirSync,
      renameSync: (a, b) => {
        afterRename = true
        mkdirSync(b) // 模拟竞争者抢建
        throw Object.assign(new Error('夹具:EPERM'), { code: 'EPERM' })
      },
      rmSync,
    },
  })
  assert.equal(r.kind, 'contended', JSON.stringify(r))
  assert.equal(r.code, 'EEXIST')
  assert.equal(r.originCode, 'EPERM', '原始错误码必须随结论一起带走(只写 EEXIST 就看不出是 Windows 那一型)')
  assert.equal(r.cleanupError ?? null, null)
})

test('T6 跨卷 pending(EXDEV)⇒ 自动退回**同级** pending 重试一次并成功', (t) => {
  const { base, dir } = fixture(t)
  const pendingRoot = join(base, 'elsewhere-pending')
  const renames = []
  const r = createLockDirectoryAtomically({
    dir,
    pendingRoot,
    writePayload: (s) => writeFileSync(join(s, 'meta.json'), '{"unitId":"A"}'),
    fs: {
      existsSync,
      mkdirSync,
      rmSync,
      renameSync: (a, b) => {
        renames.push(norm(a))
        if (norm(a).startsWith(norm(pendingRoot))) {
          throw Object.assign(new Error('夹具:跨卷'), { code: 'EXDEV' })
        }
        return renameSync(a, b)
      },
    },
  })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.usedSiblingFallback, true)
  assert.equal(renames.length, 2, `兜底只应重试一次:${renames}`)
  assert.ok(norm(renames[1]).startsWith(norm(base)) && !norm(renames[1]).startsWith(norm(pendingRoot)), '第二次必须换回同级 pending')
  assert.equal(existsSync(dir), true)
  // 第一次失败的那个跨卷 pending 也被清掉了(不是"换了个落点就丢一份垃圾")
  assert.deepEqual(readdirSync(pendingRoot), [], `跨卷 pending 有残留:${readdirSync(pendingRoot)}`)
})

test('T7 清理失败不改判据结论,但必须报名(cleanupError)—— 静默吞掉就是下一轮的半成品', (t) => {
  const { dir } = fixture(t)
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: () => {
      throw Object.assign(new Error('夹具:写不进'), { code: 'EACCES' })
    },
    fs: {
      existsSync,
      mkdirSync,
      renameSync,
      rmSync: () => {
        throw Object.assign(new Error('夹具:删不掉'), { code: 'EBUSY' })
      },
    },
  })
  assert.equal(r.kind, 'error')
  assert.equal(r.code, 'EACCES', '判据结论是"payload 写失败",不被清理失败顶替')
  assert.match(r.cleanupError ?? '', /EBUSY/, `清理失败没报名:${JSON.stringify(r)}`)
})

// ═════════ 三、pending 名与注入面 ═════════

test('T8 pending 名唯一,且落点算法与实现**同一把尺子**(测试不得自己拼名字)', () => {
  const dir = 'X:/w/ihui-git-write.lock'
  const a = norm(pendingPathFor({ dir, nonce: 'N1' }))
  assert.equal(a, 'X:/w/ihui-git-write.lock.N1.pending')
  // 给了 pendingRoot 就落在它下面(调用方要能把它指到 gitignore 的落点,不落项目根)
  assert.equal(norm(pendingPathFor({ dir, pendingRoot: 'X:/pend', nonce: 'N2' })), 'X:/pend/ihui-git-write.lock.N2.pending')
  // 同进程连续两次:序号那一维保证同一毫秒内也不重名(只靠随机字节会在 8 位 hex 上撞)
  const seen = new Set()
  for (let i = 0; i < 300; i++) {
    const n = defaultNonce()
    assert.equal(seen.has(n), false, `nonce 重名:${n}`)
    seen.add(n)
  }
})

test('T9 入参守卫:dir 不可用 / writePayload 不是函数 ⇒ error 且不碰文件系统', (t) => {
  const { base } = fixture(t)
  let touched = 0
  const fs = {
    existsSync: (p) => {
      touched++
      return existsSync(p)
    },
    mkdirSync: (p, o) => {
      touched++
      return mkdirSync(p, o)
    },
    renameSync: (a, b) => {
      touched++
      return renameSync(a, b)
    },
    rmSync: (p, o) => {
      touched++
      return rmSync(p, o)
    },
  }
  assert.equal(createLockDirectoryAtomically({ dir: '', writePayload: () => {}, fs }).kind, 'error')
  assert.equal(createLockDirectoryAtomically({ dir: join(base, 'l'), writePayload: 'not-a-fn', fs }).kind, 'error')
  assert.equal(touched, 0, `守卫之前就有文件系统动作:${touched}`)
  assert.deepEqual(readdirSync(base), [], '守卫分支不该留下任何东西')
})

// ═════════ 四、A/B 并发取证:旧实现可被抢 / 新实现不可(用**真实消费者**判读) ═════════
//
// 两臂都用同一把尺子问同一件事:`scripts/git-lock.mjs` 导出的 `tryAcquireSingleInstance` ——
// 它对"目录在而 meta 不在"的处置就是「龄超 staleMs ⇒ 视为残留回收」,正是本票要证的判据。
// 不在测试里重写任何抢占/回收逻辑(§22c):竞争者走真实出口,持有者只走"创建"这一步。

test('T10 A/B 臂 A(旧两步形态):owner 还没写下,竞争者就能把那把锁判死并抢走', (t) => {
  const { base, dir, archive } = fixture(t)
  // 旧实现的第一步:mkdir 正式目录(此刻 meta 还没写)—— 这就是改动前真实存在的窗口。
  // 回拨 mtime 是为了把"龄超 staleMs"这一格确定地造出来(真实场景里它由两步之间的调度延迟提供)。
  mkdirSync(dir)
  backdate(dir, 600_000)
  assert.equal(existsSync(dir), true, '夹具前提:目录已对外可见')
  assert.equal(existsSync(join(dir, 'meta.json')), false, '夹具前提:owner 尚未写下')

  const b = tryAcquireSingleInstance({ dir, unitId: 'B', claimArchiveRoot: archive, log: () => {} })
  assert.equal(
    b.acquired,
    true,
    `臂 A 要证的就是这一格:未初始化完成的锁被判成"残留"回收 ⇒ 旧实现可被抢占(拿不到就说明这条证据是空的)。实得:${JSON.stringify({ acquired: b.acquired, kind: b.kind, why: b.why })}`,
  )
  const metaAfterB = readFileSync(join(dir, 'meta.json'), 'utf8')
  assert.equal(JSON.parse(metaAfterB).unitId, 'B')

  // 原持有者毫不知情,继续它的第二步:把 meta 写进**别人**的锁目录
  busyWait(10)
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ unitId: 'A', pid: process.pid }), 'utf8')

  // 缺陷定格:账面两个进程都认为自己持锁,而 B 的归属凭据已被 A 覆盖
  assert.equal(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).unitId, 'A')
  assert.notEqual(readFileSync(join(dir, 'meta.json'), 'utf8'), metaAfterB, 'A 的写入没有覆盖 B ⇒ 这一臂没复现病灶')
  assert.ok(existsSync(archive), '臂 A 回收过一把 ⇒ 现场应在归档面')
  assert.deepEqual(readdirSync(base).filter((n) => n.includes('.pending')), [], '臂 A 不得留 pending')
})

test('T11 A/B 臂 B(新原子形态):同一时刻竞争者进不来,初始化中的持有者绝不会被"判死回收"', (t) => {
  const { base, dir, archive } = fixture(t)
  let competitor = null
  const r = createLockDirectoryAtomically({
    dir,
    writePayload: (staged) => {
      // 与臂 A 完全相同的时机:owner 还没落地,此刻让真实竞争者跑一次判读
      // (阈值也不放宽 —— 两臂只差在"锁目录在不在",这正是本票唯一改变的那一维)
      competitor = tryAcquireSingleInstance({ dir, unitId: 'B', claimArchiveRoot: archive, log: () => {} })
      writeFileSync(join(staged, 'meta.json'), JSON.stringify({ unitId: 'A', pid: process.pid }), 'utf8')
    },
  })
  assert.ok(competitor, '夹具没跑到竞争者那一格')
  // 新形态下这一刻正式路径**不存在** ⇒ 竞争者拿到的是一把**全新**的锁(合法:无人持有),
  // 而不是"把别人还在初始化的锁判死抢走"。所以绝不会出现"两个进程都自认为持有同一把"。
  assert.equal(competitor.kind, 'acquired', `竞争者应当是新建而非回收:${JSON.stringify(competitor)}`)
  assert.equal(r.ok, false, '初始化者必须明确知道自己**没**拿到这把锁(旧形态下它以为自己拿到了,其实写进了别人的目录)')
  assert.equal(r.kind, 'contended')
  assert.equal(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).unitId, 'B', 'B 的凭据不得被覆盖')
  assert.equal(existsSync(archive), false, '新形态下没有任何一把锁被"判死回收"过')
  assert.deepEqual(readdirSync(base).filter((n) => n.includes('.pending')), [], '臂 B 不得留 pending')
})

// ═════════ 五、防复发反向锁:两条锁不得再把 mkdir 正式路径那一型写回去 ═════════

test('T12 反向锁:git-lock / deploy-lock 的代码面都必须经这一份初始化出口', () => {
  for (const rel of ['../git-lock.mjs', '../deploy-lock.mjs']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    const problems = auditLockInitSource(codeOnly(src), rel)
    assert.deepEqual(problems, [], `${rel} 的锁创建没有走 lib 的唯一实现:\n${problems.join('\n')}`)
    assert.match(codeOnly(src), /from ['"]\.\/lib\/lock-atomic-init\.mjs['"]/, `${rel} 未引 lib`)
  }
})

test('T13 反向锁有牙:旧形态塞回源码面必须被判红,而合规写法不得被误伤', () => {
  const legacy = [
    "import { createLockDirectoryAtomically } from './lib/lock-atomic-init.mjs'",
    'function acquire(dir) {',
    '  mkdirSync(dir, { recursive: false })',
    '  writeMeta(dir, "unit")',
    '}',
  ].join('\n')
  const flagged = auditLockInitSource(legacy, 'mutation-fixture')
  assert.ok(flagged.length >= 1, '旧形态没被抓到 ⇒ 本门的反向锁是空的')
  assert.ok(
    flagged.some((p) => /直接 mkdirSync/.test(p)),
    `点名的必须是"绕过 pending+rename",实得 ${JSON.stringify(flagged)}`,
  )
  // 换名副本(直接把已知锁目录名字面量 mkdir 出来)也必须点名
  const named = auditLockInitSource('mkdirSync(join(root, ".deploy.lock"), { recursive: false })', 'named-fixture')
  assert.ok(
    named.some((p) => /mkdirSync 直接建出 \.deploy\.lock/.test(p)),
    `字面量锁目录名必须被点名,实得 ${JSON.stringify(named)}`,
  )
  // 反向:合规写法不得判红 —— 一条对合法形态恒红的判据,结局就是逼人绕过本门
  const ok = [
    "import { createLockDirectoryAtomically } from './lib/lock-atomic-init.mjs'",
    'const r = createLockDirectoryAtomically({ dir, writePayload: (s) => writeMeta(s) })',
    'mkdirSync(dirname(file), { recursive: true })', // 非锁目录,不该误伤
  ].join('\n')
  assert.deepEqual(auditLockInitSource(ok, 'compliant-fixture'), [])
})

test('T14 抛出型入口只为"catch 形状已被测试锁住"的调用方存在,detail 三种结论齐备', (t) => {
  const { dir } = fixture(t)
  const okResult = acquireLockDirectoryOrThrow({
    dir,
    writePayload: (s) => writeFileSync(join(s, 'meta.json'), '{}'),
  })
  assert.equal(okResult.kind, 'acquired')
  let err = null
  try {
    acquireLockDirectoryOrThrow({ dir, writePayload: () => {} })
  } catch (e) {
    err = e
  }
  assert.ok(err instanceof LockNotAcquiredError, `第二次应抛哨兵错误,实得 ${err}`)
  assert.equal(err.detail.kind, 'contended')
  assert.equal(err.detail.code, 'EEXIST')
})

test('T15 真进程并发对照:两发真 CLI 同时抢同一把锁 ⇒ 恰好一发取得,且不留 pending', async (t) => {
  // 臂 A/B(T10/T11)是确定性的时机对照;这一条补的是"外部世界"那一半:两个真 OS 进程
  // 同时跑 `deploy-lock.mjs acquire`,既有互斥仍在(本票只换了**创建层**,不得把锁做松)。
  const { base } = fixture(t)
  const dir = join(base, 'concurrent.lock')
  const script = fileURLToPath(new URL('../deploy-lock.mjs', import.meta.url))
  const args = ['acquire', '--mode', 'build', '--timeout', '2500', '--lock-dir', dir]
  const kids = [0, 1].map(() => spawn(process.execPath, [script, ...args], { windowsHide: true }))
  const outs = await Promise.all(
    kids.map(
      (k) =>
        new Promise((res) => {
          let out = ''
          k.stdout.on('data', (d) => (out += d))
          k.stderr.on('data', (d) => (out += d))
          k.on('exit', (code) => res({ code, out }))
        }),
    ),
  )
  const winners = outs.filter((o) => o.code === 0)
  assert.equal(
    winners.length,
    1,
    `两发并发 CLI 应当恰好一发取得:${JSON.stringify(outs)}`,
  )
  assert.equal(existsSync(dir), true, '取得的那一发必须把锁留在位')
  assert.equal(
    readFileSync(join(dir, 'meta.json'), 'utf8').includes('"mode":"build"'),
    true,
    '取得即完整:正式路径一出现就得读得到 meta(而不是"目录在、meta 随后补")',
  )
  assert.deepEqual(
    readdirSync(base).filter((n) => n.includes('.pending')),
    [],
    `并发跑完不得留 pending:${readdirSync(base)}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
