// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * lock-atomic-init.mjs — 锁目录「写全再原子可见」初始化的唯一实现(2026-09-29 立,G-814425)。
 *
 * 要修的病灶与本仓记过的抢占原子性(`scripts/lib/stale-lock-claim.mjs`)是**相邻的另一半**:
 * 创建侧一直是 `mkdirSync(dir)` → `writeMeta(dir)` 两步 —— 在这两步之间,锁目录**已经对外可见
 * 而里面什么都没有**。竞争者看到的恰好是那条最贵的状态:
 *   - `deploy-lock.mjs` 的 `absent` 态:「目录在而 meta 不在 ⇒ 锁龄超 stale 即归档抢占」;
 *   - `git-lock.mjs` 的 `tryAcquireSingleInstance`:「无可读 meta 且目录龄超 staleMs ⇒ 视为残留回收」。
 * 两条判据都必须能处理"持有者崩于两步之间"(那是正当需求),可它们同样命中
 * **「持有者活得好好的,只是正处在初始化的那一毫秒」** ⇒ 一把还没初始化完的锁被判死抢走,
 * 原持有者随后把 meta 写进**别人**的锁目录里,账面两个进程都认为自己持锁。
 * 这与 2026-09-25 冻结部署环 11h50m 的 G-193 同源(判据问错了主体、矛盾时无人认账),只是发生在创建侧。
 *
 * 上游证据(只读参考 `G:\IHUI-AI\.ihui-agent\tmp\zcode-study\zcode\packages\services\src\bots\channelRuntime.ts:153-238`):
 *   - `:172-176` 原文「锁目录和 owner 文件必须作为一个**完整状态**对外可见。先在唯一临时目录写完
 *     owner,再原子 rename,避免竞争者把尚未初始化完成的锁误判为 stale」⇒ 就是本文件的形态:
 *     唯一 pending 目录 → 写全 payload → rename 成正式锁目录;
 *   - `:180-188` 原文「Windows 将临时锁目录 rename 到已存在锁目录时返回 EPERM……**EPERM 也可能只是
 *     目录权限错误;只有正式锁路径确实存在时,才进入冲突接管分支**」⇒ 本文件的 `rename` 失败后
 *     **以"正式路径此刻在不在"分流**,不在就是错误,绝不当成"锁被别人拿着"。
 *
 * 三条不许漂的写法:
 *   1. **本 lib 永不删除正式锁路径**。它只 `rmSync` 自己建的那个 pending 目录。抢占/代为收口
 *      仍然只住 `stale-lock-claim.mjs` 那一份(两处都能删锁 = 两处策略必漂移)。
 *   2. **正式路径已存在时绝不 attempt rename**。POSIX 的 `rename(2)` 对"目标是一个**空目录**"
 *      会**直接替换**(Windows 给 EPERM)—— 先判存在、不存在才 rename,两个平台才同形。
 *      这条不是性能优化:不判就等于在 Linux 上给"覆写别人的空锁目录"开了一道口。
 *   3. **pending 名必须唯一**(pid + 时刻 + 进程内序号 + 随机)。唯一性是本原语的前提:
 *      两个候选者共用同一个 pending 名,就等于共享了它们的临时状态。
 *
 * 与两侧既有纪律的关系(一字未改,本文件只**新增**"初始化不再半成品可见"这一层):
 *   - `git-lock.mjs`:心跳续 `meta.ts`、身份三元组(`lib/proc-identity.mjs`)、
 *     `!holderAlive || age > hardStaleMs || age > staleMs` 那条抢占判据(镜像测试 ⑤ 有结构锁);
 *   - `deploy-lock.mjs`:`--owner-pid` 语义、`HARD_CAP_MS` 硬上限、四态认识论
 *     (`classifyMeta` 的 absent/ok/invalid/unreadable)。
 *   ⚠️ 本 lib **不碰 meta 的内容与格式**:payload 由调用方的 `writePayload(stagedDir)` 自己写,
 *      所以"锁里放什么""文件叫什么名"都不在这里出现 —— 避免与 `stale-lock-claim.mjs` 里的
 *      `META_FILE_NAME` 长成第二份真相。
 *
 * 本 lib 无任何 console 输出、不派生子进程、不碰 git。
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

/** pending 目录名的固定后缀(`.stale-*` 那一族是抢占现场,两者不得混为一谈)。 */
export const PENDING_SUFFIX = '.pending'

/**
 * rename 撞"目标已存在"时各平台给过的错误码。
 * ⚠️ **这一组只随结果一起用于诊断,不参与判定** —— 判定只看"正式路径此刻在不在"(见 runAttempt)。
 * 上游 `channelRuntime.ts:184-188` 的教训:EPERM 既可能是锁竞争、也可能只是目录权限错误,
 * 拿错误码当"可以接管"的凭据,就是把一次权限故障读成一次抢占授权。
 */
export const BUSY_RENAME_CODES = Object.freeze(['EPERM', 'EEXIST', 'ENOTEMPTY', 'EISDIR', 'EBUSY'])

let nonceSeq = 0

/**
 * pending 目录的唯一名:pid + 时刻 + 本进程内递增序号 + 随机字节。
 * 序号那一维不是装饰 —— 同一毫秒内同一进程可以走两次创建(EXDEV 兜底重试、抢占后重试),
 * 只靠随机字节在 8 位 hex 上仍会同值;序号保证**同进程内永不重名**。
 */
export function defaultNonce() {
  nonceSeq += 1
  return `${process.pid}-${Date.now().toString(36)}-${nonceSeq}-${randomBytes(4).toString('hex')}`
}

/**
 * 算出本次要用哪个 pending 目录。单独导出是为了让镜像测试**问同一把尺子**它落在哪,
 * 而不是在测试里再拼一遍 `${dir}.${nonce}.pending`(拼错的那份断言永远绿)。
 * `pendingRoot` 为空 ⇒ 正式锁目录的同级兄弟(同一父目录,与上游同形)。
 */
export function pendingPathFor({ dir, pendingRoot = null, nonce = defaultNonce() }) {
  const parent = pendingRoot ? pendingRoot : dirname(dir)
  return join(parent, `${basename(dir)}.${nonce}${PENDING_SUFFIX}`)
}

const nodeFs = { existsSync, mkdirSync, renameSync, rmSync }

/**
 * 「建唯一 pending → 写全 owner/meta → 原子 rename 成正式锁」走完一次的**哨兵错误**。
 * 只给那种"catch 块的形状已被镜像测试钉住"的调用方用(见 `acquireLockDirectoryOrThrow`)。
 */
export class LockNotAcquiredError extends Error {
  constructor(detail) {
    super(`lock-atomic-init: 未取得锁(${detail?.kind ?? '?'} / ${detail?.code ?? '?'})`)
    this.name = 'LockNotAcquiredError'
    this.detail = detail
  }
}

/**
 * 把「写全再原子可见」走完一次。
 *
 * 三种结论(**互斥,第三种绝不折成第二种**):
 *   - `acquired`  正式路径现在就是本次写下的那一份,内容在 rename 之前就已完整;
 *   - `contended` 正式路径已被别人拿着(判据 = `existsSync(dir)`),本次**没有**碰过它;
 *   - `error`     其它任何失败(pending 建不出、payload 写不进、rename 失败而正式路径不在、
 *                 跨卷 EXDEV 且同级兜底也失败)⇒ 调用方按自己的既有错误口径处置。
 *                 **本 lib 不把它说成"竞争"**(那会把"没做成"写成"别人持锁")。
 *
 * @param {object} opts
 * @param {string} opts.dir 正式锁目录
 * @param {(stagedDir:string)=>any} opts.writePayload 必须在返回前把锁内容**写全**;返回值原样带在
 *        结果的 `payload` 上(调用方据此打印"我拿到的是哪一把"。deploy-lock 就踩过一次:改从
 *        `readMeta` 回读会把新键丢掉,于是"非确证"被打印成"调用方声明")。
 * @param {string|null} [opts.pendingRoot] pending 落点目录(默认正式锁的同级兄弟)。
 *        跨卷导致 rename 必然 EXDEV 时,本函数内会自动退回**同级** pending 重试一次。
 * @param {string} [opts.nonce] 注入用(镜像测试要确定性 pending 名)。
 * @param {{existsSync:Function,mkdirSync:Function,renameSync:Function,rmSync:Function}} [opts.fs]
 *        注入用(证真/证伪各条失败分支,不必真去造权限故障)。
 * @returns {{ok:boolean,kind:'acquired'|'contended'|'error',payload?:any,pendingPath:string|null,
 *   code:string,originCode?:string|null,message?:string,cleanupError?:string|null,
 *   usedSiblingFallback?:boolean}}
 */
export function createLockDirectoryAtomically({ dir, writePayload, pendingRoot = null, nonce, fs: F = nodeFs } = {}) {
  if (!dir || typeof dir !== 'string') {
    return { ok: false, kind: 'error', code: 'EINVAL', pendingPath: null, message: 'dir 不可用' }
  }
  if (typeof writePayload !== 'function') {
    return {
      ok: false,
      kind: 'error',
      code: 'EINVAL',
      pendingPath: null,
      message: 'writePayload 必须是函数(锁内容必须在 rename 之前写全)',
    }
  }

  // 判据 2:正式路径已在 ⇒ 连 pending 都不必建(见头注:Linux 上 rename 会替换空目录)。
  if (F.existsSync(dir)) {
    return { ok: false, kind: 'contended', code: 'EEXIST', originCode: null, pendingPath: null }
  }

  const runAttempt = (root, usedSiblingFallback) => {
    const pendingPath = pendingPathFor({ dir, pendingRoot: root, nonce: nonce ?? defaultNonce() })

    // ⓪ pending 落点自身。`{recursive:true}` 是刻意的:调用方给的落点允许是深层路径
    //    (deploy-lock 用 .ihui-agent/tmp/…),不存在就该建出来而不是报故障。
    if (root) {
      try {
        F.mkdirSync(root, { recursive: true })
      } catch (e) {
        return {
          ok: false,
          kind: 'error',
          code: e?.code ?? 'unknown',
          pendingPath: null,
          message: `创建 pending 落点 ${root} 失败:${e?.message ?? e}`,
        }
      }
    }

    // ① 建唯一 pending。**不带 `{recursive:true}`** —— 它保证"锁目录的父目录不存在"以 ENOENT
    //    如实报出来(deploy-lock 的既有判据要在这一格**立刻抛错**,而不是退化成"死等一把自己建不出来的锁")。
    try {
      F.mkdirSync(pendingPath)
    } catch (e) {
      // EEXIST 只会是 nonce 撞名(结构上不该发生);同样**不当成锁竞争**。
      return {
        ok: false,
        kind: 'error',
        code: e?.code ?? 'unknown',
        pendingPath: null,
        message: `创建 pending 目录 ${pendingPath} 失败:${e?.message ?? e}`,
      }
    }

    // ② 在 pending 里把锁内容写全。抛出 ⇒ 清掉自己建的 pending,绝不把半成品 rename 出去。
    let payload
    try {
      payload = writePayload(pendingPath)
    } catch (e) {
      const cleanupError = cleanupPending(F, pendingPath)
      return {
        ok: false,
        kind: 'error',
        code: e?.code ?? 'unknown',
        originCode: null,
        pendingPath: null,
        message: `写入锁内容到 ${pendingPath} 失败:${e?.message ?? e}`,
        cleanupError,
      }
    }

    // ③ 原子可见:rename 成正式锁目录。
    try {
      F.renameSync(pendingPath, dir)
      return {
        ok: true,
        kind: 'acquired',
        payload,
        pendingPath: null,
        code: 'ACQUIRED',
        originCode: null,
        cleanupError: null,
        usedSiblingFallback,
      }
    } catch (e) {
      const code = e?.code ?? 'unknown'
      // 跨卷 pending(root 与正式路径不同卷)⇒ rename 结构上做不成。这不是锁竞争,
      // 也不能报成"别人持锁":唯一安全处置是清掉自己的 pending、换回**同级兄弟**再试一次
      // (同父目录必同卷)。兜底也只试一次,不循环。
      if (code === 'EXDEV' && root && !usedSiblingFallback) {
        const cleanupError = cleanupPending(F, pendingPath)
        const retry = runAttempt(null, true)
        if (cleanupError) retry.cleanupError = cleanupError
        return retry
      }
      const cleanupError = cleanupPending(F, pendingPath)
      // 上游 `channelRuntime.ts:186` 那条判别照搬:只有正式路径**确实存在**,这次 rename 失败
      // 才算"锁被别人拿着";否则是错误,不得据此接管。
      if (F.existsSync(dir)) {
        return { ok: false, kind: 'contended', code: 'EEXIST', originCode: code, pendingPath: null, cleanupError }
      }
      return {
        ok: false,
        kind: 'error',
        code,
        originCode: code,
        pendingPath: null,
        message: `rename ${pendingPath} → ${dir} 失败而正式路径并不存在 ⇒ 不是锁竞争:${e?.message ?? e}`,
        cleanupError,
      }
    }
  }

  return runAttempt(pendingRoot, false)
}

/**
 * 结果版之外的**抛出**入口,只为一类调用方存在:`scripts/git-lock.mjs` 的 `acquire` 里
 * "锁已存在 ⇒ 判读"那一整块的**缩进与结构**被镜像测试 ⑤ 钉着(`else if (!holderAlive || …)`
 * 那一行逐字 + 八空格收口)。把它从 `catch` 里搬出来就要动那块的结构 —— 于是这里用一个
 * 哨兵错误让原块原地不动。**判读一律从 `readMeta` 现取,从不读这个错误对象。**
 *
 * @param {Parameters<typeof createLockDirectoryAtomically>[0]} opts
 * @returns {ReturnType<typeof createLockDirectoryAtomically>} 必定是 `acquired` 那一支
 * @throws {LockNotAcquiredError} 带 `.detail` = 上面三种结论里的后两种
 */
export function acquireLockDirectoryOrThrow(opts) {
  const r = createLockDirectoryAtomically(opts)
  if (!r.ok) throw new LockNotAcquiredError(r)
  return r
}

/**
 * 清掉**自己建的** pending 目录。清理失败不改判据结论,只如实带在 `cleanupError` 上
 * (静默吞掉 = 下一个读锁目录的人看见一个无人认领的半成品,正是本票要消掉的那一型)。
 * ⚠️ 参数只允许是 pending 路径;正式锁目录永不经这条路被删(见头注判据 1)。
 */
function cleanupPending(F, pendingPath) {
  try {
    F.rmSync(pendingPath, { recursive: true, force: true })
    return null
  } catch (e) {
    return `${e?.code ?? ''} ${e?.message ?? e}`.trim()
  }
}

/**
 * 防复发判据(测试支撑出口,供 `scripts/tests` 的镜像测试调用,不得在测试里另抄一份):
 * 两条锁的**代码面**不得再自己 `mkdirSync` 正式锁目录 —— 半成品可见窗口就是这么重开的。
 *
 * 三条检查各有独立的失效方向,任何一条漂了都会以"看起来一切正常"的形态存在,所以
 * 宁可多判(交人看)也不静默:
 *   ① 必须真的引了本 lib 的某个出口(引了却没调用 = 半接线,守门 118 那一型);
 *   ② 不得出现对"锁目录变量"的直接 mkdir(`mkdirSync(dir…` / `mkdirSync(lockDir()…`);
 *   ③ 不得出现把已知锁目录名字面量直接 mkdir 出来的形态。
 *
 * @param {string} src 被审源码(调用方应传**剥掉整行注释**后的代码面,与 stale-lock-claim 同纪律)
 * @param {string} label 点名用
 * @param {{lockDirNames?:string[]}} [opts] 要管的锁目录字面量(默认现读的两把锁)
 * @returns {string[]} 问题清单;空数组 = 合规
 */
export function auditLockInitSource(src, label, { lockDirNames = ['.deploy.lock', 'ihui-git-write.lock'] } = {}) {
  const problems = []
  if (!/createLockDirectoryAtomically\(|acquireLockDirectoryOrThrow\(/.test(src)) {
    problems.push(`${label}: 未调用 lib 的原子初始化出口 ⇒ 锁创建回到了"直接 mkdir 正式路径"那一型`)
  }
  if (/mkdirSync\(\s*(?:dir|lockDir\(\))\s*[,)]/.test(src)) {
    problems.push(`${label}: 出现对正式锁目录的直接 mkdirSync ⇒ pending+rename 被绕过(半成品锁重新对外可见)`)
  }
  for (const name of lockDirNames) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`mkdirSync\\(\\s*[^;\\n]*${esc}`, 'g')
    for (const m of src.matchAll(re)) {
      problems.push(`${label}: mkdirSync 直接建出 ${name}(实得片段:${JSON.stringify(m[0])})`)
    }
  }
  return problems
}

export const __test__ = {
  PENDING_SUFFIX,
  BUSY_RENAME_CODES,
  defaultNonce,
  pendingPathFor,
  createLockDirectoryAtomically,
  acquireLockDirectoryOrThrow,
  LockNotAcquiredError,
  auditLockInitSource,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
