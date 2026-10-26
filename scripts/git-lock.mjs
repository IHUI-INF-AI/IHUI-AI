#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-lock.mjs — git 写操作全局串行化锁(2026-08-06 立,根治多 agent 并发写损坏)。
 *
 * 事故背景(8-06 实锤 / 8-05 仓库重建 / 7-26 gc 清 tag):多 agent 并行 commit 时,
 * git 写操作(index/refs/pack)并发竞争 + autoGc 并发 repack → .git 元数据损坏。
 * 本项目 git 写操作必须串行化:同一时刻只允许一个「写操作单元」执行。
 *
 * 用法(CLI):
 *   node scripts/git-lock.mjs acquire [--unit <id>] [--timeout <ms>] [--stale <ms>]
 *   node scripts/git-lock.mjs release [--unit <id>] [--token <t>]
 *   node scripts/git-lock.mjs check              # 只读:是否有锁,exit 0=无锁 1=有锁
 *   node scripts/git-lock.mjs scan               # 只读:G-262 原生锁三分类读数 + git 进程数 + 等待 P95(账本累积)
 *   node scripts/git-lock.mjs heartbeat --unit <id> [--interval <ms>] [--parent-pid <pid>]
 *
 * 锁语义:
 *   - 锁 = .git/ihui-git-write.lock 目录(mkdir 原子性)
 *   - **初始化必须"写全再原子可见"(2026-09-29 立,G-814425)**:旧形态是 `mkdirSync(正式路径)`
 *     紧接 `writeMeta`,两步之间那把**空锁目录**已对外可见 ⇒ 竞争者(含本文件的
 *     `tryAcquireSingleInstance` 与 deploy-lock 的 `absent` 态)按"目录在而 meta 不在 + 龄超
 *     staleMs ⇒ 残留回收"就能把**还在初始化中**的锁抢走,原持有者随后把 meta 写进别人的锁目录。
 *     现由唯一实现 `scripts/lib/lock-atomic-init.mjs` 收口:唯一 pending 目录 → 写全 meta →
 *     原子 rename 成正式锁。心跳/身份三元组/抢占判据**一字未动**,只换了创建这一层。
 *   - 锁内 meta 文件记录 { unitId, pid, ts } + **进程身份两元** { host, pidStart }
 *     (2026-09-27 接 lines:裸 pid 不足以回答"这个 pid 还是当初那个进程吗"——
 *      pid 会被系统复用,部署锁 2026-09-25 就被一次复用冻了 11h50m,登记 G-193。
 *      `pidStart` 取不到 ⇒ 整键不写 ⇒ 旧形态,判读走 unverifiable = 维持改动前行为。)
 *   - 可重入:同 unitId(同一写操作单元,如 safe-commit 及其 post-commit 子进程)
 *     再次 acquire 直接通过,避免嵌套死锁
 *   - 心跳续期(2026-09-18 根治):持锁方 spawn heartbeat 子进程(随父进程死亡自动退出),
 *     每 intervalMs 重写 meta.ts。根治事故:长流程(pre-commit 多分钟)期间 meta.ts 停留在
 *     acquire 时刻,被并发方按"悬挂锁"误判强制抢占 → 两个进程同时写 .git(锁反而制造损坏)。
 *     心跳**只搬不测**身份两元(它写的是持有者的 pid/host/pidStart,自己是另一个进程)。
 *   - stale 清理(2026-09-18 加固):锁年龄超过 staleMs(默认 300s)**且持有者 pid 已死**
 *     才强制抢占;活进程的锁绝不被抢。另设 hardStale(默认 1800s)兜底 pid 复用假阳性。
 *     ⚠️ **这句与代码不一致,登记而非顺手改**(2026-09-27 实测):下面 `acquire` 里的实际条件,与
 *     本行"活进程的锁绝不会被抢"矛盾 —— 真实规则是"年龄超 staleMs **或** 超 hardStaleMs 就抢",
 *     活着只被用来构造"极可能已被复用"这句措辞,真正兜住长流程的是**心跳续 ts**。
 *     本票只**新增**一条更精确的路径(身份确证复用 ⇒ 立即抢占),**不把这条规则改严或改松**;
 *     要统一文档与代码得由锁的持有人定夺(改严会把活人的长流程暴露在抢占下)。
 *     G-998105(2026-10-07 拍板·选②):acquire 档与单实例档(tryAcquireSingleInstance:
 *     持有者活着的锁绝不抢,唯一例外是身份确证复用)的口径分叉是**有意的可用性取舍,不是疏漏**。
 *     上游把"触到 maxWait"当终态 —— 只抛带持有者信息的超时错,等待者不会在预算耗尽那一刻
 *     变成立即回收者;我方 acquire 档**刻意允许最后时刻抢占**(deadline 前轮询的任一时刻都按
 *     既有判据抢,活人长流程由心跳续 meta.ts 兜住),换的是提交链不必在"持有者刚死/刚超龄"
 *     的边缘整段白等。两档判据**不得顺手统一**,形状由镜像测试钉住
 *     (scripts/tests/g-998105-acquire-late-preempt-mirror.test.mjs)。
 *   - 超时:acquire 等待 timeoutMs(默认 120s)后抛错
 *
 * 集成点(见 AGENTS.md 事故复盘):
 *   - scripts/safe-commit.mjs:整个 commit 流程包锁
 *   - .husky/post-commit:IHUI_GIT_LOCK_UNIT 未设置时(直接 git commit 场景)acquire
 *   - scripts/safe-gc.mjs:手动 gc 前必须 acquire(杜绝 gc 与写操作并发)
 */
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
// 现场归档的唯一落点(AGENTS §15b / §5b「现场归档一律落在 gitArchiveDir(),手工抢修也不得例外」)。
// 抢占产生的 `.stale-*` 目录**绝不**留在 .git 里,更不落工作区根或盘根。
import { gitArchiveDir } from './lib/gitdir.mjs'
// 抢占算法的唯一实现(2026-09-26 合并:本脚本与 deploy-lock.mjs 曾各写一份 claimStaleLock)。
// G-998104(2026-10-08):锁实例观察器也单源在这份 lib —— 观察者按 (路径, stat) 区分
// 「同一锁文件被反复重建」的多次实例,使"锁抖动"与"一次长持有"在观测上是两个形状。
import { claimStaleLockCore, createLockInstanceObserver } from './lib/stale-lock-claim.mjs'
// 锁目录「写全再原子可见」初始化的唯一实现(2026-09-29 立,G-814425)—— 本脚本与
// deploy-lock.mjs 共用同一份,禁止各写一遍"mkdir 正式路径 + 补写 meta"(那两步之间,
// 一把还没初始化完的空锁目录就对外可见,竞争者按 absent/残留判死就能把它抢走)。
import {
  createLockDirectoryAtomically,
  acquireLockDirectoryOrThrow,
} from './lib/lock-atomic-init.mjs'
// meta.json 的**原子替换**唯一出口(2026-09-29 立,G-653)。裸 `writeFileSync` 覆盖写已存在的文件是
// "truncate → 再写"两步,而 `check` / `clean` 的判活、计划任务 `git-guardian` 每 2 分钟一轮、
// 以及**本文件自己的心跳**(每 5s 重写 meta.json)随时可能落在那两步之间 ⇒ 读到半截 JSON。
// 本文件对"读不到 meta"的既有处置是"无可读 meta 且龄超 staleMs ⇒ 视为残留回收",于是
// **一个活着的持锁者会被读成"已退出"并抢走锁**(§5b/§12d 记过:判活判错 ⇒ 并发写坏 .git)。
// ⚠️ 只换"怎么写":meta 的键集、后写覆盖前写的语义、身份三元组、抢占判据一字未动。
import { atomicWriteFileSync } from './lib/atomic-write.mjs'
// G-262(2026-09-28):git 原生锁文件的可判检测 —— 枚举/分类只在这一份实现,
// 本脚本的 clean 与 scan 两个子命令共用,不各写一份扫描(§22c 同纪律)。
import { scanNativeLocks, countGitProcsFromTasklist } from './lib/git-native-locks.mjs'
// 进程身份三元组(pid + pidStart + host)。裸 pid 不足以回答"这个 pid 还是当初那个进程吗"
// —— 2026-09-25 的 G-193 就是 meta.pid=888 被 nssm.exe 复用,判活恒真 ⇒ 部署环冻结 11h50m。
import { identityFields, verifyHolder } from './lib/proc-identity.mjs'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      // 根治(2026-09-30):本会话 Node 建子进程 stdin 管道会 EBUSY;run() 无 input 调用,stdin 设 ignore。
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 仓库 .git 目录(绝对路径) */
function gitDir() {
  const d = run('git rev-parse --absolute-git-dir', true)
  if (!d) throw new Error('不在 git 仓库中')
  return d
}

/** 锁目录路径 */
function lockDir() {
  return join(gitDir(), 'ihui-git-write.lock')
}

function metaFile(dir) {
  return join(dir, 'meta.json')
}

function readMeta(dir) {
  try {
    return JSON.parse(readFileSync(metaFile(dir), 'utf8'))
  } catch {
    return null
  }
}

/**
 * ── 租约凭据 leaseToken(G-397 补的那一格,机制对标 deploy-lock 的 G-696)─────────────
 *
 * 立因:release 侧旧写法拿 `meta.pid === process.pid` 这**一个裸 pid 事实**就删锁,而 pid 会被
 * 系统复用(2026-09-25 部署锁因此冻了 11h50m,登记 G-193);`unitId` 又不入此列 —— 它是调用方
 * 自取的公开名(谁都能 `check` 一眼看见再照抄),所以它证明的是"我领了这枚号",不是"这把锁归我"。
 * 于是"迟到的一次 finish"只要 pid 恰好撞上,就能删掉别人正在用的活锁。
 *
 * 三条口径(与 deploy-lock 一字同纪律,不得各写一份):
 *  - 凭据**不可预测**:`randomBytes(16)` hex,由 writeMeta 在 acquire 那一刻现生成;
 *  - **绝不把空凭据写进锁里**(那等于把"无凭据"合法化,比对失去意义);
 *  - 比对是**逐字节等值**,且拒绝文案只打掩码(整枚凭据进日志 = 把钥匙贴在门上)。
 *
 * 来源优先级:显式入参 > 环境变量 `IHUI_GIT_LOCK_TOKEN` > 现生成。
 * ⚠️ 这一档**不是**身份档的替代品:身份被**确证**复用(mismatch)时,凭据也翻不回来
 * (见 release 头注的档位次序与理由)。
 */
const LEASE_TOKEN_ENV = 'IHUI_GIT_LOCK_TOKEN'

/** 本进程为**哪些锁目录**写下过哪枚凭据(同进程 acquire⇒release 不必显式带 token)。 */
const leaseTokenMemo = new Map()

function cleanToken(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function newLeaseToken() {
  return randomBytes(16).toString('hex')
}

/** 掩码形态(进日志/拒绝文案用):前 4 后 2 + 长度,与原 deploy-lock 同形。 */
function maskLeaseToken(t) {
  const s = cleanToken(t)
  return s === '' ? '(未携带)' : `${s.slice(0, 4)}***${s.slice(-2)} (len=${s.length})`
}

/** 记下"这个目录的凭据是我刚写进去的" —— 只有 mkdir/rename 成功那一支才配记。 */
function rememberLeaseToken(dir, token) {
  const t = cleanToken(token)
  if (t !== '') leaseTokenMemo.set(resolve(dir), t)
  return t
}

function forgetLeaseToken(dir) {
  leaseTokenMemo.delete(resolve(dir))
}

/**
 * 取调用方带来的凭据:显式入参 > 进程内备忘(本进程自己 acquire 写的那枚)> 环境变量。
 * 返回 '' = 没带 ⇒ 调用方**不得**把它当成"空凭据也匹配"。
 */
function resolveLeaseToken(token, dir) {
  const declared = cleanToken(token)
  if (declared !== '') return declared
  const memo = leaseTokenMemo.get(resolve(dir))
  if (memo) return memo
  return cleanToken(process.env[LEASE_TOKEN_ENV])
}

function writeMeta(dir, unitId, opts = {}) {
  // 除 pid 之外再记两元:host(哪台机器)与 pidStart(那个 pid 的启动时刻)。
  // pid 会被系统复用 ⇒ 单看 pid 判活要么恒真、要么恒假;年龄阈值只是在**猜**。
  // 取不到 pidStart 时 identityFields 给 undefined,JSON.stringify 会整键丢掉
  // ⇒ 与改动前的 meta 形态逐字相同(向后兼容,不写假值)。
  //
  // G-397 多落一格 `leaseToken` = 持锁凭据(release 侧比对的唯一依据,见上方头注)。
  // 旧锁没有这一格 ⇒ release 走"旧格式报名"分支维持改动前判据,随下一次 acquire 自然绝迹。
  //
  // 落盘走唯一出口的原子替换(G-653):除新增的 leaseToken 键外,写出的字节与改动前同形,
  // 且不再让读者看见半截。返回值带完整 meta,供调用方把凭据记进进程内备忘。
  const meta = {
    unitId: unitId ?? '',
    pid: process.pid,
    ts: Date.now(),
    ...identityFields(opts.run ? { run: opts.run } : {}),
    leaseToken: cleanToken(opts.token) || cleanToken(process.env[LEASE_TOKEN_ENV]) || newLeaseToken(),
  }
  atomicWriteFileSync(metaFile(dir), JSON.stringify(meta))
  return meta
}

/**
 * 删除锁目录 —— **只允许持有者自释时调用**。
 *
 * ⚠️ 抢占路径不得用它(2026-09-26 根治):`rmSync(dir)` 删的是**此刻挂在 `dir` 上的那把锁**,
 * 而"我判它已死"与"我删它"之间,别人可以已经删掉旧锁并 mkdir 拿到**新锁** ⇒ 我删掉的是别人的活锁
 * ⇒ 两个写者同时进临界区(git 侧即 `.git/index.lock` 双写者)。抢占必须走 `claimStaleLock()`。
 */
function removeLock(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* 忽略 */
  }
}

/** 两把锁是否"同一把":三要素全等(unitId/pid/ts),即"我刚判死的那把"。 */
function sameLock(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.unitId === b.unitId && a.pid === b.pid && a.ts === b.ts
}

/** 抢占现场的留档:把判死证据(谁、为什么、原始 meta)写进归档出口。失败 ⇒ 返回错误,调用方不得静默。 */
function writeStaleNote(dirPath, { judged, rawMeta, why, stolenByPid }) {
  try {
    writeFileSync(
      join(dirPath, 'stale-claim-note.txt'),
      [
        `抢占时间: ${new Date().toISOString()}`,
        `执行进程: pid=${stolenByPid} 命令=${process.argv.slice(2).join(' ') || '(in-process)'}`,
        `被抢的持有者: unit=${judged?.unitId ?? ''} pid=${judged?.pid ?? ''} ts=${judged?.ts ?? ''}`,
        `原始 meta.json: ${rawMeta ?? '(不可得)'}`,
        `判死理由: ${why}`,
      ].join('\n'),
      'utf8',
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `${e?.code ?? ''} ${e?.message ?? e}`.trim() }
  }
}

// 抢占动作的唯一实现在 scripts/lib/stale-lock-claim.mjs(2026-09-26 合并,
// 出处见 git log --grep 锁抢占 —— 本函数与 deploy-lock.mjs 的同名函数曾各写一份,
// 算法骨架只留那一份;两侧真实差异(指纹算法、归档落点、现场格式与处置策略)在此注入)。

/**
 * 抢占 git 写锁的悬挂锁:委托 lib 的「改名→身份回读→只处置改到的那份」骨架,
 * 本函数只负责 ① 注入 git 侧差异(三字段指纹 sameLock、现场 txt、归档落点 gitArchiveDir()、
 * 现场落不进归档就搬运/删除的处置策略),② 把结构化结果逐字渲染回旧日志文案。
 * 语义与合并前逐字等价,算法不变式(改名优先、失败绝不碰原路径)见 lib 头注。
 *
 * @param {string} dir 锁目录
 * @param {{unitId?:string,pid?:number,ts?:number}|null} judged 判死时读到的 meta(也是②的比对基准)
 * @param {string} why 判死理由(进归档现场与日志,供事后追责)
 * @param {{archiveRoot?:string|null, suffix?:string}} [opts]
 * @returns {{ok:boolean, phase:string, code?:string, restored?:boolean, stagedPath:string|null, archived:string|null, log:string}}
 */
function claimStaleLock(dir, judged, why, { archiveRoot = gitArchiveDir(), suffix } = {}) {
  const r = claimStaleLockCore(dir, judged, why, {
    archiveRoot,
    suffix,
    readState: readMeta,
    same: sameLock,
    writeNote: (stagedPath, ctx) =>
      writeStaleNote(stagedPath, { judged, rawMeta: ctx.rawMeta, why, stolenByPid: process.pid }),
    placeScene: placeGitScene,
  })
  switch (r.cause) {
    case 'dir-gone-early':
      return {
        ok: false,
        phase: 'rename',
        code: 'ENOENT',
        stagedPath: null,
        archived: null,
        log: `[git-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除、未创建任何目录`,
      }
    case 'archive-rename-enoent':
      return {
        ok: false,
        phase: 'rename',
        code: 'ENOENT',
        stagedPath: null,
        archived: null,
        log: `[git-lock] 抢占放弃(锁目录已不见:${dir})——未删除任何目录,继续等待`,
      }
    case 'rename-failed':
      return {
        ok: false,
        phase: 'rename',
        code: r.localErr?.code ?? 'unknown',
        stagedPath: null,
        archived: null,
        log: `[git-lock] 抢占未成功(改名 ${r.localErr?.code ?? r.localErr?.message})——原路径 ${dir} 未被触碰,继续等待`,
      }
    case 'identity-mismatch':
      return {
        ok: false,
        phase: 'mismatch',
        restored: r.restored,
        stagedPath: r.restored ? null : r.stagedPath,
        archived: null,
        log:
          `[git-lock] 抢占放弃:${dir} 上的锁在改名瞬间已被替换` +
          `(判死时 ${fmtLock(judged)},改名后 ${fmtLock(r.nowState)})` +
          ` ⇒ ${r.restored ? '已原样放回,未删除任何锁' : `⚠️ 放回失败,现场保留在 ${r.stagedPath}(未删除,请人工处置)`}`,
      }
    default:
      return {
        ok: true,
        phase: 'claimed',
        stagedPath: r.stagedPath,
        archived: r.archived,
        log:
          `[git-lock] 已抢占悬挂锁:被抢的持有者 = ${fmtLock(judged)};判死理由:${why}。` +
          `现场=${r.archived ?? '(归档不可得,已就地删除)'}${r.noteResult.ok ? '' : ` ⚠️ 现场说明写入失败:${r.noteResult.error}`}`,
      }
  }
}

/**
 * git 侧的现场处置策略(与合并前逐字同形):
 * 现场已在归档内 ⇒ 就地留档;否则先试着搬进归档,搬不动就递归删除,
 * 删除失败也不回头碰原路径 —— 部署侧是「原地保留」,这一分歧是既有语义,
 * 未统一(登记在合并票报告里,由主会话定夺)。
 */
function placeGitScene({ dir, stagedPath, archiveRoot }) {
  const staysInArchive = !!archiveRoot && stagedPath.startsWith(archiveRoot)
  let archived = staysInArchive ? stagedPath : null
  if (!staysInArchive) {
    const dest = archiveRoot ? join(archiveRoot, basename(stagedPath)) : null
    if (dest) {
      try {
        renameSync(stagedPath, dest)
        archived = dest
      } catch {
        /* 搬不动就删,不静默保留在 .git 里 */
      }
    }
    if (!archived) {
      try {
        rmSync(stagedPath, { recursive: true, force: true })
      } catch (e) {
        console.error(
          `[git-lock] ⚠️ 删除已改名的悬挂锁失败(${e?.code ?? e?.message})——保留 ${stagedPath},` +
            `**不回头删 ${dir}**(那已经不是我这把)`,
        )
      }
    }
  }
  return { archived }
}

/** meta 的一行式身份描述(日志与测试断言共用,避免两处各拼一遍漂移) */
function fmtLock(meta) {
  if (!meta) return '(无 meta.json)'
  return `unit=${meta.unitId ?? ''} pid=${meta.pid ?? ''} ts=${meta.ts ? new Date(meta.ts).toISOString() : ''}`
}

/** 检测进程是否存活(signal 0 探测,跨平台;EPERM 视为存在) */
function isPidAlive(pid) {
  if (!pid || Number(pid) === process.pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * 身份三元组的**取用闸门**(2026-09-27 接线,机制见 scripts/lib/proc-identity.mjs)。
 *
 * 为什么需要这层 memo 而不是直接调 `verifyHolder`:
 *  `acquire` 每 300ms 轮询一次、`clean` 挂在提交链上,而现测启动时间要派生一次 PowerShell。
 *  语义硬要求写死了它**不得进快路径**,所以一个探测实例对**同一把锁**
 *  (`unitId|pid|ts` 三元组变化即换锁)只问一次;`unverifiable` 的原因当场喊一遍,
 *  因为"判不出来"与"判过了"在账面上必须长得不一样(本仓最高频的失效型)。
 *  `heartbeat` / `check` 一律**不**经过这里 —— 它们既不判抢占,就不该付这次派生。
 *
 * `scene`(G-397 新增,只为把"喊出来的那句话"写对):同一座闸门服务两种失效方向 ——
 *  抢占侧判不出来 ⇒ 维持原判据、**不据此抢**;释放侧判不出来 ⇒ 不得折成"身份已核对"、
 *  **不据此放行**。把这两种结论写成同一句话,就是"没判"冒充"判过"的另一副面孔。
 *
 * @param {{run?:Function,host?:string}} [opts] 透给 proc-identity 的注入面(测试用假 run)
 * @param {(m:string)=>void} [log] 输出出口(默认 console.log;测试夹具注入收集器)
 * @param {'claim'|'release'} [scene] 结论落点:抢占(不据此抢)还是释放(不据此放行)
 * @returns {(meta:object)=>{kind:string,why?:string}}
 */
function makeIdentityProbe(opts = {}, log = (m) => console.log(m), scene = 'claim') {
  const seen = new Map()
  const tail =
    scene === 'release'
      ? '⇒ 释放侧不据此放行(未判定 ≠ 身份已核对),改走租约凭据 / unitId 兼容档'
      : '⇒ 维持改动前判据(锁龄/存活),不据此抢占'
  return (meta) => {
    const key = `${meta?.unitId ?? ''}|${meta?.pid ?? ''}|${meta?.ts ?? ''}`
    if (!seen.has(key)) {
      const verdict = verifyHolder(meta, opts)
      if (verdict.kind === 'unverifiable') {
        // 不据此抢占,但必须留痕:否则读日志的人会把"没有身份凭据"看成"身份已核过"
        log(`[git-lock] 身份无法核对(pid=${meta?.pid ?? ''}):${verdict.why} ${tail}`)
      }
      seen.set(key, verdict)
    }
    return seen.get(key)
  }
}

/**
 * 把身份对账的实测结论如实带进"判死理由"(进抢占现场与日志)。
 * 三种写法各有其义:`mismatch` 是确证、`match` 是"这人真的还持着锁而我仍按年龄抢了"
 * (原判据的行为,不改)、`unverifiable` 是"没有身份凭据,这一条纯粹按年龄/存活猜"。
 * 把没判与判过了写成同一句话,就是本仓反复记过的那一型。
 */
function identityNote(identity) {
  if (!identity) return ';身份对账=未做(持有者 pid 已不存活,现测必然量不到,本条不依赖它)'
  if (identity.kind === 'mismatch') return `;身份对账=mismatch(${identity.why})⇒ 确证 pid 已被复用`
  return `;身份对账=${identity.kind}(${identity.why ?? '无原因'})⇒ 不构成额外授权,本条仍按年龄判据`
}

/**
 * 身份三元组是否**授权**抢占 —— 两个调用点(acquire 的轮询判定 / clean 的手动清理)共用这一份,
 * 不得各写一遍字面量比较(两处实现必漂移,且漂移的一侧会变成"悄悄多放开一点")。
 * 只有 `mismatch` 授权;`match` 与 `unverifiable` 一律不授权,即**维持改动前行为**。
 */
function identityAuthorizesClaim(identity) {
  return identity?.kind === 'mismatch'
}

/**
 * G-57(2026-10-23 立):锁龄的**可判性**判据 —— 未来时间戳下的负龄处置,全仓唯一一份。
 *
 * 病型(本机实测,见交付报告):**mtime / meta.ts 落在 Date.now() 之后 ⇒ 锁龄为负**。
 * 负龄一旦流进"龄 > staleMs ⇒ 判死"这一跳,该跳恒假 ⇒ **该判死的永远判不死**,而且
 * 一句都不说 —— 实测把 -3600s 读成"龄 -3600s 未超 60s ⇒ 不判死",账面看着就是一把
 * 新鲜的锁。成因不是"时钟稍微不准",而是时钟回拨 / NTP 跳变 / 时区误设 / 跨主机共享
 * gitdir 这类分钟到小时级的偏移,量级远在容差之外。
 *
 * 处置方向按 §0.3 / §0.10:**判为不可判定并点名原因**,既不判死也不静默按"新鲜"处理。
 * 这里**刻意不夹逼**(`Math.max(0, age)`):夹逼会把一个"判不出来"的输入改写成"龄 0,
 * 刚建的",读者再也看不出曾经有过负龄 —— 那正是本仓反复被批的消音。容差之内的小负龄
 * (文件系统时间戳粒度、读写之间的抖动)按既有行为走,不需要点名,也不需要夹逼:
 * `age > staleMs` 对负龄本来就判假,结果与"当成新鲜"逐字一致,但没有改写输入。
 *
 * @param {number} ageMs `Date.now() - 时间戳`(负数 = 时间戳在未来)
 * @param {number} [skewToleranceMs] 时钟偏移容差(默认 LOCK_AGE_SKEW_TOLERANCE_MS)
 * @returns {{verdict:'judgeable'|'undetermined', why?:string}}
 */
export const LOCK_AGE_SKEW_TOLERANCE_MS = 5_000

export function judgeLockAge(ageMs, skewToleranceMs = LOCK_AGE_SKEW_TOLERANCE_MS) {
  if (!Number.isFinite(ageMs))
    return { verdict: 'undetermined', why: `锁龄不是一个有限数(${String(ageMs)})⇒ 无从判龄` }
  if (ageMs < -skewToleranceMs)
    return {
      verdict: 'undetermined',
      why:
        `锁龄为负 ${Math.round(ageMs)}ms(时间戳在 Date.now() 之后 ${Math.round(-ageMs)}ms,` +
        `超出时钟偏移容差 ${skewToleranceMs}ms)⇒ mtime/ts 与本机时钟不同步,锁龄不可判定`,
    }
  return { verdict: 'judgeable' }
}

/**
 * 清理 git 原生 index.lock(2026-09-19 立,根治 index.lock 卡死多 agent)。
 *
 * 根因:git 写操作(index/refs)被中断(kill/崩溃/宿主清树)时,index.lock 残留,
 * 后续所有 git add/commit 都报 "Unable to create '.git/index.lock': File exists"。
 * 多 agent 并行时,一个 agent 的 git 崩溃会卡死所有人。
 *
 * 安全策略:
 *   - 扫描 .git/index.lock + .git/worktrees/ 下各 worktree 的 index.lock
 *   - 锁龄 > INDEX_LOCK_STALE_MS(默认 60s)即删除——git 单次 index 写入正常 < 5s,
 *     超过 60s 必定是崩溃残留(活进程持锁时文件会被持续刷新/占用,但 Windows 下
 *     文件时间戳不会更新,故用"年龄 + 无对应 git 进程"双判据)。
 *   - 双判据:优先检测是否有 git 进程在运行;无 git 进程时直接删;有 git 进程时
 *     年龄 > 60s 才删(兜底,因无法精确匹配哪个 git 持有哪个 index.lock)。
 */
const INDEX_LOCK_STALE_MS = 60_000

function cleanStaleIndexLocks({
  gitRoot,
  alive = isPidAlive,
  hasGitProcessProbe,
  // G-57:未判定的点名出口。默认走 stderr —— "判不出锁龄"是异常,不是常态读数,
  // 塞进 stdout 会被当普通日志扫过去。`clean` 子命令注入收集器,把点名行并进汇总。
  log = (m) => console.error(m),
} = {}) {
  const cleaned = []
  const base = gitRoot ?? gitDir()
  const candidates = [join(base, 'index.lock')]
  // worktrees 的 index.lock
  try {
    const wtDir = join(base, 'worktrees')
    if (existsSync(wtDir)) {
      for (const wt of readdirSync(wtDir)) {
        const wtIndexLock = join(wtDir, wt, 'index.lock')
        if (existsSync(wtIndexLock)) candidates.push(wtIndexLock)
      }
    }
  } catch {
    /* worktrees 目录不存在或不可读,跳过 */
  }
  // maintenance.lock(git gc/repack 崩溃残留,会阻塞后续 gc)
  const maintenanceLock = join(base, 'objects', 'maintenance.lock')
  if (existsSync(maintenanceLock)) candidates.push(maintenanceLock)
  // 是否有 git 进程在运行(粗略判据:tasklist 有 git.exe)
  let hasGitProcess = false
  if (hasGitProcessProbe) hasGitProcess = hasGitProcessProbe()
  else
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq git.exe" /NH', {
        encoding: 'utf8',
        // 根治:同 run() —— tasklist 不吃 stdin。
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      hasGitProcess = /git\.exe/i.test(out)
    } catch {
      /* tasklist 失败,保守假设无 git 进程(允许清理) */
    }
  for (const lockPath of candidates) {
    try {
      const st = statSync(lockPath)
      const age = Date.now() - st.mtimeMs
      // 无 git 进程 → 必是残留(这一支**不依赖锁龄**,故不问可判性);
      // 有 git 进程 → 锁龄超阈值才删 ⇒ 锁龄是判据,先问它判不判得出来。
      // G-57:负龄会让 `age > INDEX_LOCK_STALE_MS` 恒假 ⇒ 该判死的永不判死且零输出
      // (实测 -3600s ⇒ cleaned=[] 且不打印任何东西)。判不出来 ⇒ 点名后交人工,不静默。
      if (hasGitProcess) {
        const v = judgeLockAge(age)
        if (v.verdict === 'undetermined') {
          log(
            `[git-lock] index.lock 未判定:${lockPath} —— ${v.why}` +
              ` ⇒ 既不按"新鲜"略过也不删除,锁保持原样(出路:先对本机时钟对时,再跑 git-lock.mjs clean)`,
          )
          continue
        }
      }
      // 无 git 进程 → 必是残留;有 git 进程 → 年龄超阈值才删
      if (!hasGitProcess || age > INDEX_LOCK_STALE_MS) {
        unlinkSync(lockPath)
        cleaned.push(lockPath)
      }
    } catch {
      /* 文件正在被占用(活 git 持有)或已消失,跳过 */
    }
  }
  // G-262(2026-09-28):名字里嵌 pid 的锁族(next-index-<pid>.lock)—— 归属证据比
  // index.lock 强:**pid 判死 ⇒ 创建者必已退出 ⇒ 孤儿锁,立即清理**(不等 INDEX_LOCK_STALE_MS,
  // 也不受"有没有别的 git 进程在跑"影响 —— 别的进程不会持有它)。pid 存活 ⇒ 一律不碰
  // (复用 pid 会把死锁看成活锁,保守方向 = 少删;这正是"不删别人的锁"的那一格)。
  // 实测病型:Windows pid 复用 ⇒ 新进程撞上同名旧锁报 `File exists` 且永远等不到释放。
  try {
    const scan = scanNativeLocks({ gitRoot: base, isPidAlive: alive })
    for (const l of scan.locks) {
      if (l.verdict !== 'dead-confirmed') continue
      const p = join(base, ...l.rel.split('/'))
      try {
        unlinkSync(p)
        cleaned.push(`${p}(pid=${l.embeddedPid} 已退出,锁龄 ${Math.round(l.ageMs / 1000)}s)`)
      } catch {
        /* 竞态:刚被别人清走 ⇒ 下一轮再说 */
      }
    }
  } catch {
    /* 枚举失败不阻塞主路径(acquire 快路径不得因新族检测而变红) */
  }
  return cleaned
}

/** 仓库根(工作树顶层)。 */
function repoRoot() {
  const r = run('git rev-parse --show-toplevel', true)
  if (!r) throw new Error('不在 git 仓库中')
  return r
}

/** G-262 计量账本:等待事件与快照都进这一份(不另立文件,避免第二份真相)。 */
function metricsFilePath() {
  return join(repoRoot(), '.ihui-agent', 'state', 'git-lock-metrics.jsonl')
}

function readMetricsLines(file) {
  try {
    return readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function percentile(nums, p) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))
  return s[idx]
}

function resolveIfRelative(p) {
  if (/^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\')) return p
  return join(repoRoot(), p)
}

/**
 * `scan` 子命令(G-262 判据的取数口):
 *   - 枚举 .git(含 common dir)原生锁文件并按证据三分类(只读,绝不删);
 *   - 现测同时存活 git 进程数(tasklist git.exe);
 *   - 落一行快照进账本;从账本里已有的**等待事件**算 P50/P95(样本不足如实报不足,不编数)。
 */
function scanCommand() {
  const roots = [gitDir()]
  try {
    const common = run('git rev-parse --git-common-dir', true)
    if (common) {
      const abs = resolveIfRelative(common)
      if (!roots.includes(abs)) roots.push(abs)
    }
  } catch {
    /* common dir 问不到就只扫 gitDir,快照里如实 */
  }
  const seen = new Set()
  const allLocks = []
  let unreadable = false
  for (const r of roots) {
    const scan = scanNativeLocks({ gitRoot: r, isPidAlive })
    unreadable = unreadable || scan.gitRootUnreadable
    for (const l of scan.locks) {
      const key = `${r}|${l.rel}`
      if (seen.has(key)) continue
      seen.add(key)
      allLocks.push({ ...l, root: r })
    }
  }
  let gitProcs = null
  try {
    gitProcs = countGitProcsFromTasklist(
      // encoding 必须是 buffer:GBK 码页下 utf8 解码会把"没有运行的任务"读成乱码(见 lib 头注)
      execSync('tasklist /FI "IMAGENAME eq git.exe" /NH', {
        encoding: 'buffer',
        // 根治:同 run() —— 默认 stdio 的 stdin 是管道会 EBUSY,tasklist 不吃 stdin。
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 30_000,
      }),
    )
  } catch {
    /* tasklist 失败 ⇒ null(不报 0,"没判"与"判过"必须长得不一样) */
  }
  const file = metricsFilePath()
  const snap = {
    ts: new Date().toISOString(),
    kind: 'snapshot',
    gitProcs,
    locks: allLocks.map((l) => ({
      rel: l.rel,
      verdict: l.verdict,
      ageMs: Math.round(l.ageMs),
      size: l.size,
    })),
  }
  try {
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify(snap)}\n`)
  } catch (e) {
    console.error(`⚠️ 快照落账失败(不影响读数):${e?.message ?? e}`)
  }
  const waits = readMetricsLines(file).filter((r) => r.kind === 'wait' && r.outcome !== 'timeout')
  const timeouts = readMetricsLines(file).filter(
    (r) => r.kind === 'wait' && r.outcome === 'timeout',
  )
  const L = []
  L.push(
    `[git-lock scan] .git 原生锁读数(只检不删;roots=${roots.length}${unreadable ? ' ⚠ 有根不可读' : ''})`,
  )
  L.push(
    `  同时存活 git.exe 进程数:${gitProcs === null ? '量不到(tasklist 失败,不报 0)' : gitProcs}`,
  )
  const dead = allLocks.filter((l) => l.verdict === 'dead-confirmed')
  const aliveL = allLocks.filter((l) => l.verdict === 'pid-alive')
  const noEv = allLocks.filter((l) => l.verdict === 'no-owner-evidence')
  L.push(
    `  锁文件:${allLocks.length} 枚 ⇒ dead-confirmed ${dead.length} / pid-alive ${aliveL.length} / 无归属证据 ${noEv.length}`,
  )
  for (const l of dead)
    L.push(
      `    · ${l.rel} pid=${l.embeddedPid} 已退出 龄 ${Math.round(l.ageMs / 1000)}s ⇒ 出路:node scripts/git-lock.mjs clean`,
    )
  for (const l of aliveL)
    L.push(`    · ${l.rel} pid=${l.embeddedPid} 名义存活 ⇒ 不碰(复用 pid 会把它看成活锁,保守方向)`)
  for (const l of noEv)
    L.push(
      `    · ${l.rel} 无归属证据 ⇒ 只报数(龄 ${Math.round(l.ageMs / 1000)}s,${l.size}B),删除授权走 clean 既有判据`,
    )
  if (waits.length >= 20) {
    const p50 = percentile(
      waits.map((w) => w.waitMs),
      0.5,
    )
    const p95 = percentile(
      waits.map((w) => w.waitMs),
      0.95,
    )
    L.push(`  锁等待 P50=${p50}ms P95=${p95}ms(样本 ${waits.length};账本 ${file})`)
  } else {
    L.push(`  锁等待 P95:样本不足(${waits.length}/20)⇒ 如实不报数;等待事件由 acquire 记账,越跑越准`)
  }
  if (timeouts.length)
    L.push(`  ⚠ 等待超时事件 ${timeouts.length} 次(这些是"被挡到放弃"的右截断,未计入 P95)`)
  console.log(L.join('\n'))
}

/**
 * 获取锁。返回 true 表示获取成功;同 unitId 可重入直接成功。
 * stale 判定(2026-09-18 加固):年龄超 staleMs **且持有者 pid 已死** 才抢占——
 * 活进程的锁(哪怕流程很长)绝不被抢,根治"长 commit 被误判悬挂 → 并发写损坏"。
 * hardStale(默认 1800s)兜底:pid 复用等极端假阳性时最终能逃生。
 *
 * 2026-09-19 修复(根治 index.lock 卡死):
 *   - 死 PID 立即抢占:持有者进程已退出时,不再等 staleMs(300s),直接抢占。
 *     此前死锁场景:agent 崩溃后锁残留,其他 agent 等 5 分钟才能继续,期间若绕过
 *     锁直接 git 操作 → index.lock 冲突 → 全员卡死。
 *   - acquire 前自动清理 stale index.lock:杜绝 git 原生锁残留阻塞。
 *
 * 2026-09-27 身份接线(G-193 的同型病灶):下面那行 `!holderAlive || age > hardStaleMs || age > staleMs`
 *   **一个字都没改**(镜像测试 ⑤ 有结构锁)。它是"猜",但是**行为已知的猜** ——
 *   注释写着"活进程的锁绝不会被抢",代码却是"名义活着的锁超 staleMs 也抢(靠心跳续命兜住)",
 *   这一处文档与代码不一致**如实登记、不顺手改严也不改松**。
 *   新增的只有更精确的那一条:锁里记着 `pidStart` 且现测值与之不符 ⇒ **确证**该 pid 已被复用
 *   ⇒ 立即抢占,不必再等 300s/1800s 的年龄阈值。
 *   `unverifiable`(旧 meta 没记 pidStart / 量不到启动时间 / 别机持有 / PowerShell 不可达)
 *   一律**维持改动前行为**:抢错的代价是并发写坏 `.git`(§5b 事故链),少抢只是多等一轮。
 *
 * @param {{unitId?:string,timeoutMs?:number,staleMs?:number,hardStaleMs?:number,
 *   dir?:string,cleanIndexLocks?:boolean,identityRun?:Function,log?:(m:string)=>void,
 *   claimArchiveRoot?:string|null}} [opts]
 *   `dir` / `cleanIndexLocks` / `identityRun` / `log` / `claimArchiveRoot` 是**测试与夹具专用通道**
 *   (镜像测试据此在"不碰真实 `.git`、不派生真 PowerShell、抢占现场不落进 gitArchiveDir()"的
 *   前提下跑端到端);生产调用点一个都不传 ⇒ 行为与改动前一致。
 */
async function acquire({
  unitId,
  timeoutMs = 120_000,
  staleMs = 300_000,
  hardStaleMs = 1_800_000,
  dir = lockDir(),
  cleanIndexLocks = true,
  identityRun,
  claimArchiveRoot,
  metricsFile,
  log = (m) => console.log(m),
} = {}) {
  // G-262 判据之一(锁等待 P95)的取数口:只有 CLI 传 metricsFile 才记账 ——
  // 镜像测试注入 dir/桩时一个字都不落真账本。
  const t0 = Date.now()
  let polls = 0
  // G-998104(观察级,2026-10-08 立):一次等待里"看到的锁实例换了几个"。观察器按
  // (inode 或 mtimeMs, pid, ts) 全等划分实例,实现单源在 scripts/lib/stale-lock-claim.mjs。
  // 只报数不判红:instances 只进 wait 账本行,判据面一字未动(超时即终态、不升级为抢占)。
  const observeLockInstance = createLockInstanceObserver()
  let instancesSeen = 0
  const recordWait = (outcome) => {
    if (!metricsFile || polls === 0) return
    try {
      mkdirSync(dirname(metricsFile), { recursive: true })
      appendFileSync(
        metricsFile,
        `${JSON.stringify({ ts: new Date().toISOString(), kind: 'wait', outcome, unitId: unitId ?? '', waitMs: Date.now() - t0, polls, instances: instancesSeen })}\n`,
      )
    } catch {
      /* 记账失败不得影响锁语义 */
    }
  }
  // 先清理可能存在的 stale index.lock(死 git 进程残留),否则后续 git 操作全卡死
  if (cleanIndexLocks) cleanStaleIndexLocks()

  const probe = makeIdentityProbe(identityRun ? { run: identityRun } : {}, log)
  const deadline = Date.now() + timeoutMs
  // 同一次 acquire 里同一个初始化故障码**只喊一遍**:轮询是 300ms 一轮,反复打印会把日志刷满,
  // 而"喊过一次"与"每轮都喊"给出的判据信息完全相同。
  let initErrorNoted = null
  // G-57(2026-10-23 收口):负龄点名在一次 acquire 里只喊一遍 —— 轮询 300ms 一轮,
  // 反复打印会把日志刷满,而"喊过一次"与"每轮都喊"给出的判据信息完全相同。
  let ageUndeterminedNoted = false
  for (;;) {
    try {
      // G-814425:锁目录必须**写全再对外可见**。旧形态是 `mkdirSync(dir)` 紧接 `writeMeta(dir)`,
      // 这两步之间那把空锁目录已经挂着 `.git` 上 —— 竞争者读到的是"目录在而 meta 不在",
      // 而它对这一态的既有处置就是"龄超 staleMs ⇒ 视为残留回收"(deploy-lock 的 absent 态同形)。
      // 于是**还在初始化中的锁**可以被活着的人抢走,原持有者再把 meta 写进别人的锁目录。
      // 现由 lib 那一份实现收口:唯一 pending 目录 → 写全 meta → 原子 rename 成正式锁。
      // 未取到 ⇒ 抛哨兵错误,落到下面**既有**的"锁已存在"判读块(那一整块的缩进与结构被
      // 镜像测试 ⑤ 逐字钉着;搬动它等于改判据形状)。判读一律从 readMeta 现取,不读这个错误。
      const made = acquireLockDirectoryOrThrow({
        dir,
        writePayload: (staged) =>
          writeMeta(staged, unitId, identityRun ? { run: identityRun } : {}),
      })
      // G-397:记下本进程为**这个目录**写下的租约凭据 ⇒ 同进程 acquire⇒release 无需显式带 token
      // (键按最终目录,不是 pending 暂存路径;多把锁互不串)。
      rememberLeaseToken(dir, made?.payload?.leaseToken)
      recordWait('acquired')
      return true
    } catch (e) {
      // 「没做成」与「别人持着」必须长得不一样(把没判写成判过了是本仓最高频的失效型):
      // contended 是正常竞争,走下面的既有判读;error(建不出 pending / 写不进 meta / rename
      // 失败而正式路径不在)同样落进既有判读以保持改动前行为,但必须当场喊出一次原因。
      if (
        e?.name === 'LockNotAcquiredError' &&
        e?.detail?.kind === 'error' &&
        e.detail.code !== initErrorNoted
      ) {
        initErrorNoted = e.detail.code
        log(
          `[git-lock] 锁初始化未落地(${e.detail.code}:${e.detail.message ?? '无原因'})⇒ 按已有锁对待,继续判读`,
        )
      }
      polls++
      // 锁已存在:检查可重入 / stale
      const meta = readMeta(dir)
      // G-998104:每轮对 readMeta/statSync 结果计一个 lock instance(抖动维度,观察级)。
      // "锁被反复抢占又重建"与"一个持有者长期占着"在账本上从此是两个形状;instances
      // 只进 wait 账本行,不参与下面任何判读。目录 stat 拿不到 ⇒ 该轮按"无实例在位"计。
      let lockStat = null
      try {
        const st = statSync(dir)
        lockStat = { ino: st.ino, mtimeMs: st.mtimeMs, pid: meta?.pid, ts: meta?.ts }
      } catch {
        lockStat = null
      }
      instancesSeen = Math.max(instancesSeen, observeLockInstance(dir, lockStat, Date.now()))
      if (meta && unitId && meta.unitId === unitId) {
        // 同一写操作单元(如 safe-commit → post-commit 链路)可重入
        recordWait('reentrant')
        return true
      }
      if (meta) {
        const age = Date.now() - (meta.ts ?? 0)
        const holderAlive = isPidAlive(meta.pid)
        // 只有"名义存活"才值得现测身份:pid 已经不在时原判据本来就要抢,
        // 而现测必然量不到(白派生一次 PowerShell,还会把原因写成"取不到启动时间")。
        const identity = holderAlive ? probe(meta) : null
        // G-57(2026-10-23 收口剩余两格之一,别席 6d9be2907d 已修 cleanStaleIndexLocks 与
        // tryAcquireSingleInstance,本格同型未收):未来 ts ⇒ age 为负 ⇒ 下面
        // `age > hardStaleMs || age > staleMs` 恒假 ⇒ "pid 名义存活 + 未来 ts"这一型
        // **永不判死且对负龄一字不说**(实测 age=-3600s 被读成"持有者仍在运行,请耐心等待",
        // 超时错的措辞反过来把静默坐实)。判据接单一真相源 judgeLockAge():判不出来 ⇒
        // 点名,既不判死也不按"新鲜"处理(§0.3/§0.10)。死 pid 那一支由 !holderAlive
        // 短路照旧回收,不依赖锁龄,故不在这里问可判性。
        if (holderAlive && !ageUndeterminedNoted) {
          const v = judgeLockAge(age)
          if (v.verdict === 'undetermined') {
            ageUndeterminedNoted = true
            log(
              `[git-lock] 锁龄不可判定:${dir} —— ${v.why} ⇒ 不据此抢占,也不按"新鲜"静默略过` +
                `(出路:先对本机时钟对时,再跑 git-lock.mjs clean)`,
            )
          }
        }
        // —— 2026-09-27 新增的**唯一**一条更精确路径:身份确证该 pid 已被复用 ⇒ 立即抢占。
        // `unverifiable` / `match` 都走不到这里(前者=维持原判据,后者=这人真的还持着锁)。
        // 这里再调一次 claimStaleLock 而不是把两支并成一个条件,是为了不改动下面那行原判据的形状
        // (镜像测试 ⑤ 锁着它);改名+回读+只处置改到的那份这套不变式仍在 lib 那一份实现里,
        // 两处调用同一个出口 ⇒ 不存在"第二份抢占算法"。
        if (identityAuthorizesClaim(identity)) {
          const claim = claimStaleLock(
            dir,
            meta,
            `身份三元组确证 pid=${meta.pid} 已不是持锁那个进程:${identity.why} ⇒ 立即抢占(锁龄仅 ${Math.round(age / 1000)}s,原判据要等到 staleMs=${Math.round(staleMs / 1000)}s)`,
            { archiveRoot: claimArchiveRoot },
          )
          log(claim.log)
          if (claim.ok) continue
        }
        // G-998105(拍板@2026-10-07 选②):本判据在轮询内**任一时刻**都生效 —— 含等待
        // deadline 前的最后一刻,即**刻意允许最后时刻抢占**。上游语义是把"触到 maxWait"
        // 当终态(只抛带持有者信息的超时错,等待者不会在预算耗尽那一刻变成立即回收者);
        // 我方不采纳,是设计选择不是疏漏:活人长流程靠心跳续 meta.ts 兜住(两档差异见本
        // 文件头注 G-998105 条目),而"持有者刚死/刚超龄"的边缘,提交链不值得整段白等。
        // 与单实例档的口径分叉是有意的可用性取舍,两档**不得顺手统一**(镜像测试钉着
        // 这行判据的形状,scripts/tests/g-998105-acquire-late-preempt-mirror.test.mjs)。
        // 2026-09-19:死 PID 立即抢占(不等 staleMs);活进程才走 staleMs/hardStaleMs
        else if (!holderAlive || age > hardStaleMs || age > staleMs) {
          // 悬挂锁(持有者已崩溃退出,或超 hardStale 兜底):强制抢占。
          // 2026-09-26:旧写法是 `removeLock(dir)` —— 在"我判它已死"与"我删它"之间,
          // 别的进程可以已经删掉旧锁并 mkdir 拿到新锁,于是删掉的是**别人的活锁**
          // (git 侧即 `.git/index.lock` 双写者)。抢占必须原子改名,见 claimStaleLock()。
          const why = holderAlive
            ? `锁龄 ${Math.round(age / 1000)}s 已超 staleMs=${Math.round(staleMs / 1000)}s / hardStaleMs=${Math.round(hardStaleMs / 1000)}s,而持有者 pid=${meta.pid} 名义存活 ⇒ pid 极可能已被复用${identityNote(identity)}`
            : `持有者 pid=${meta.pid} 已退出`
          const claim = claimStaleLock(dir, meta, why, { archiveRoot: claimArchiveRoot })
          log(claim.log)
          if (claim.ok) continue
          // 没抢到 ⇒ 什么都不删,落到下面的超时判据 + 轮询等待(不 continue,避免热自旋)
        }
      }
      if (Date.now() > deadline) {
        recordWait('timeout')
        const alive = meta ? isPidAlive(meta.pid) : false
        throw new Error(
          `git 写锁等待超时(${timeoutMs}ms)。当前持锁: ${meta ? `unit=${meta.unitId} pid=${meta.pid} 于 ${new Date(meta.ts).toLocaleTimeString()}(${alive ? '持有者仍在运行,请耐心等待或稍后重试' : '持有者已退出,等待 stale 抢占'})` : '未知'}。` +
            '若确认为残留锁,超过 stale 时间会自动抢占;紧急可删 .git/ihui-git-write.lock',
        )
      }
      // 轮询等待(异步 setTimeout)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
}

/**
 * 释放锁(仅当**证明得出**"这把是我的"才删;同 unitId 可重入多次 acquire 需配平 release)。
 *
 * 2026-09-26 收紧:旧写法是"拿不到 meta 也删" + "unitId 为空 ⇒ 无条件删",于是
 * 一条不带 `--unit` 的 `git-lock.mjs release` 就能删掉**别人正在用的活锁**。
 *
 * ⚠️ 2026-10-26 G-397 再收紧(本轮修的正是这一格):上一版留了两条归属档,其中
 * `meta.pid === process.pid` 那条是**一个裸 pid 事实**,而 pid 会被系统复用 ——
 * 实测夹具(见 `.ihui-agent/tmp/s6-lease/gitlock-gap-evidence.mjs` 与 `.../s10-gitlock/progress.md`):
 * 同一份 meta 让生产判据问一次 `verifyHolder`,答 `mismatch`(记录 1793028782 vs 现测 1793032382
 * ⇒ 该 pid 已被复用);而当时的 release 一个字没问它,照样报 `{"released":true,"why":"本进程 pid 匹配"}`
 * 并把控制文件删成 null。**迟到的一次 finish 只要 pid 撞上就能删掉别人正在用的活锁**,
 * 而 `unitId` 又救不了场:它是调用方自取的公开名(`check` 一眼就能看见再照抄),
 * 证明的是"我领了这枚号",不是"这把锁归我"。
 *
 * 现口径 = 四档,顺序固定(每档各自点名,合起来才既不放开误删、也不制造谁也释放不了):
 *  ① **身份档**(仅当 `meta.pid === process.pid` 才问,且只经既有取用闸门 `makeIdentityProbe`,
 *     本文件里 `verifyHolder` 的落点因此仍在镜像反向锁的白名单内,快路径也没多一次派生):
 *     - `match` ⇒ 本进程确是当初写入这把锁的那个进程 ⇒ 放行(这是"属主本人"的正解,不再靠裸 pid);
 *     - `mismatch` ⇒ **硬拒且优先于一切档**:一条"确证不是持锁进程"的结论,不能被公开名 unitId
 *       或一枚可从锁文件里抄来的凭据翻回来;锁目录逐字节不动,交抢占通道处置(带现场归档);
 *     - `unverifiable` ⇒ 按未判定处理,**绝不折成 match 放行**(§0.3"没判绝不写成判过"),
 *       落 ②③ 继续问 —— 这一档不得变成"谁也释放不了"(见下)。
 *  ② **租约凭据档**:`callerToken`(显式 `--token` > 进程内备忘 > `IHUI_GIT_LOCK_TOKEN`)与
 *     锁内 `leaseToken` 逐字节等值 ⇒ 放行。它正是身份档失效时的那条合法出路:
 *     探针不可达 / 别机持有 / 锁没记 pidStart 时,属主仍凭自己 acquire 时那枚凭据交得了锁。
 *  ③ **unitId 兼容档**:`meta.unitId === unitId`(逐字相等、非空)⇒ 放行。
 *     **为什么必须留着**:`safe-commit.mjs` / `safe-gc.mjs` / `lib/post-commit-hook.js` 的
 *     acquire 与 release 是**两个不同进程**(CLI 子进程拿锁后即退出,meta.pid 是那个已死的子进程),
 *     身份档对它们结构上永远打不到、凭据档又需要调用方先学会带 token;摘掉 ③ = 每枚提交都要
 *     等 hardStale 1800s 被别人抢占才能继续 = G-193 那种"冻结"的复现(§12e 恒红门同型)。
 *     留着它不等于承认它是凭据:调用方 unitId 与锁内不等时,这一档一条也不放行(旧缺陷走的
 *     正是"unitId 不等 + 裸 pid 撞"那一格,现已由 ① 堵死),且新锁带 leaseToken 而调用方没带
 *     凭据时每进程报名一次迁移提示。
 *  ④ 皆不成立 ⇒ 拒绝,`why` 里逐档点名 + 给出命令级出路(守卫必须带出自己的出路)。
 *
 * @param {{unitId?:string,dir?:string,token?:string,identityOpts?:{run?:Function,host?:string,highPrecision?:boolean},log?:(m:string)=>void}} [opts]
 */
let compatReleaseNoted = false
let legacyLockNoted = false

function release({ unitId, dir = lockDir(), token, identityOpts, log = (m) => console.log(m) } = {}) {
  if (!existsSync(dir)) return { released: false, why: '无锁目录' }
  const meta = readMeta(dir)
  if (!meta) {
    console.error(
      `[git-lock] ❌ 拒绝释放:${dir} 里没有可读的 meta.json ⇒ 无法证明这把锁是谁的,` +
        `删它可能删掉别人正在用的锁。出路:\`git-lock.mjs clean\`(按判死证据抢占)或人工确认后删除。`,
    )
    return { released: false, why: '无法判定归属(无 meta.json)' }
  }
  const holder = `unit=${meta.unitId ?? ''} pid=${meta.pid ?? ''} ts=${meta.ts ? new Date(meta.ts).toISOString() : ''}`
  const 出路 =
    '出路:① 确是本锁持有者 ⇒ 带上 acquire 时给出的凭据 `node scripts/git-lock.mjs release --unit <id> --token <t>`' +
    '(或环境变量 IHUI_GIT_LOCK_TOKEN);② 判定这把该被回收 ⇒ 走抢占通道 `node scripts/git-lock.mjs clean`' +
    '(先归档现场、再原子改名,绝不直接删原路径),或让下一次 acquire 按 stale/身份判据抢占;' +
    '③ 报的是"未判定" ⇒ 先让本机探针可用(PowerShell/CIM 可达),再按 ① 或 ② 处置。'
  const leaseToken = typeof meta.leaseToken === 'string' ? meta.leaseToken : ''
  const callerToken = resolveLeaseToken(token, dir)

  // 放行结论只在一个变量里成形,删除动作全函数只有一处出口(镜像反向锁 ⑤ 逐字数
  // `removeLock(` 的出现次数:定义 + 持有者自释这一处 = 2,多一处即红)。
  let releaseWhy = null

  // ── ① 身份档:裸 pid 不再单独构成放行,必须问成对身份(pid + pidStart)────────────
  let identityUnverifiable = null
  if (Number(meta.pid) === process.pid) {
    const probe = makeIdentityProbe(identityOpts ?? {}, log, 'release')
    const identityVerdict = probe(meta)
    if (identityVerdict.kind === 'mismatch') {
      console.error(
        `[git-lock] ❌ 拒绝释放:锁里的 pid=${meta.pid} 与本进程**同号但不同一进程** ⇒ ` +
          `身份三元组确证该 pid 已被复用(${identityVerdict.why})。这把锁的持有者(${holder})` +
          '不是本次调用,删它就是在删别人正在用的活锁。\n' +
          `[git-lock] ${出路}`,
      )
      return {
        released: false,
        why: `身份 mismatch:${identityVerdict.why}(裸 pid 巧合,拒绝代删别人的锁)`,
      }
    }
    if (identityVerdict.kind === 'match') {
      releaseWhy = '身份三元组核对本进程即持锁进程'
    } else {
      // unverifiable ⇒ 未判定:不得当 match 放行,继续走 ②③(结论跟着走账,不静默)
      identityUnverifiable = `身份未判定(unverifiable:${identityVerdict.why ?? '未给原因'})`
    }
  }

  // ── ② 租约凭据档 ────────────────────────────────────────────────────────────
  if (releaseWhy === null && leaseToken !== '' && callerToken !== '' && callerToken === leaseToken) {
    releaseWhy = identityUnverifiable
      ? `lease token 匹配(凭租约凭据放行;${identityUnverifiable})`
      : 'lease token 匹配'
  }

  // ── ③ unitId 兼容档(公开名,非凭据;摘它就是把提交链冻死,见头注)──────────────
  if (releaseWhy === null && unitId && meta.unitId === unitId) {
    if (leaseToken === '' && !legacyLockNoted) {
      legacyLockNoted = true
      log(
        '[git-lock] ⚠️ 这把锁的 meta 无 leaseToken(旧格式,归属凭据无从比对)⇒ 按既有 unitId 判据处置;' +
          '新 acquire 写的锁均带 leaseToken,旧锁随下一次抢占/重写自然绝迹。',
      )
    } else if (leaseToken !== '' && callerToken === '' && !compatReleaseNoted) {
      compatReleaseNoted = true
      log(
        '[git-lock] ℹ️ 本次释放走的是 unitId 兼容档(公开名,非凭据),没带 leaseToken ⇒ 跨进程调用方' +
          '(safe-commit/safe-gc/post-commit)下一步可改带 --token / IHUI_GIT_LOCK_TOKEN 换 ② 档;' +
          '同一进程内只提示这一次。',
      )
    }
    releaseWhy = identityUnverifiable ? `unitId 匹配(${identityUnverifiable})` : 'unitId 匹配'
  }

  // ── ④ 三档皆不成立 ⇒ 拒绝并逐档点名 ──────────────────────────────────────────
  if (releaseWhy === null) {
    const whyParts = []
    if (Number(meta.pid) === process.pid) {
      whyParts.push(identityUnverifiable ?? '身份档未给出 match')
    } else {
      whyParts.push(`身份档不适用(meta.pid=${meta.pid ?? '未记'} 非本进程 pid=${process.pid})`)
    }
    whyParts.push(
      leaseToken === ''
        ? '凭据档不适用(旧锁无 leaseToken 可比)'
        : `凭据档不匹配(调用方=${maskLeaseToken(callerToken)} 锁内=${maskLeaseToken(leaseToken)})`,
    )
    whyParts.push(
      unitId
        ? `unitId 不等(锁内=${JSON.stringify(meta.unitId ?? '')} 调用=${JSON.stringify(unitId)})`
        : '未带 unitId',
    )
    console.error(
      `[git-lock] ❌ 拒绝释放:锁由 ${holder} 持有 ⇒ ${whyParts.join(';')} ⇒ 三档(身份/凭据/unitId)皆不成立,` +
        `不代删别人的锁(锁目录一字未动)。\n[git-lock] ${出路}`,
    )
    return { released: false, why: `非持有者:${whyParts.join(';')}` }
  }

  // 唯一删除出口:三档里任何一档放行都只落到这里一次。
  removeLock(dir)
  forgetLeaseToken(dir)
  return { released: true, why: releaseWhy }
}

/**
 * 只读检查。**刻意不做身份现测**:check 挂在人手与脚本链上(AGENTS §5b 诊断、
 * `git-lock.mjs check`),每次现测一次 PowerShell 就是把它变成快路径(语义硬要求 2)。
 * 这里只把**锁里记着什么**如实打出来,并写明"未现测",免得读报告的人把
 * "打印了 pidStart"当成"身份已经核对过"。
 */
function check() {
  const dir = lockDir()
  if (!existsSync(dir)) return 0
  const meta = readMeta(dir)
  const id =
    meta && (meta.host || meta.pidStart)
      ? ` host=${meta.host ?? '(未记)'} pidStart=${meta.pidStart ?? '(未记)'}`
      : ' host=(旧 meta 未记) pidStart=(旧 meta 未记 ⇒ 身份无从对账)'
  console.log(
    `locked: unit=${meta?.unitId ?? ''} pid=${meta?.pid ?? ''} ts=${meta ? new Date(meta.ts).toISOString() : ''}${id}(check 只读,未现测启动时间)`,
  )
  return 1
}

/**
 * 心跳续期(2026-09-18 根治):每 intervalMs 重写 meta.ts,使长流程持锁永不误判悬挂。
 * 退出条件(全部自动,无需清理动作):
 *   - 锁目录消失(已释放)或 unitId 易主
 *   - parentPid 指定的持锁父进程已退出(detached spawn 场景父死子亡)
 *
 * ⚠️ 身份两元(host / pidStart)**只能原样搬,不得现测**:心跳是另一个进程,
 * 而 `pid` 字段记的仍是持锁那位的 pid —— 在这里调 identityFields() 会把
 * "心跳进程的启动时刻"写成"持锁进程的启动时刻",于是每一次身份对账都必然报
 * mismatch ⇒ 一把正在被活人使用的锁被"确证复用"抢走。那比没有身份更糟。
 * 旧 meta 没有这两个字段时写回是 undefined ⇒ JSON 丢键 ⇒ 形态一字不变(向后兼容)。
 */
async function heartbeat({ unitId, intervalMs = 5_000, parentPid }) {
  const dir = lockDir()
  for (;;) {
    const meta = readMeta(dir)
    if (!meta || (unitId && meta.unitId !== unitId)) return
    if (parentPid && !isPidAlive(parentPid)) return
    try {
      // G-653:心跳是**每 5s 重写同一个 meta.json**,也就是本文件里被并发读者撞上的概率最高的
      // 那次裸写(判活的 `check` / 守护每 2 分钟一轮随时落在 truncate 与 write 之间)。
      // 出口只换"怎么写":键集、只搬不测的身份两元、失败即 return 的处置一字未动。
      atomicWriteFileSync(
        metaFile(dir),
        JSON.stringify({
          unitId: meta.unitId,
          pid: meta.pid,
          ts: Date.now(),
          host: meta.host,
          pidStart: meta.pidStart,
          // G-397:凭据同样**只搬不测** —— 心跳每 5s 重写一次 meta.json,若不带这一格,
          // 第一次续期就把属主自己的租约凭据洗掉 ⇒ 身份档又判不出来时,这把锁谁也释放不了
          // (正是 G-193 那种"冻结"的反向复现)。旧 meta 没这格 ⇒ undefined ⇒ JSON 丢键 ⇒ 形态不变。
          leaseToken: meta.leaseToken,
        }),
      )
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/**
 * G-262 新增(2026-09-27,纯新增导出 —— 本文件上方全部既有判据一字未动):
 * 「后到者直接跳过并说明原因」形态的**单实例**获取,给那种"每一轮都被再叠一发"的
 * 周期任务用(立因实测:守护每 2 分钟一轮,一轮全 ref 增量 fetch 跑不完 2 分钟,
 * 于是每个 tick 再叠一发 —— 当轮量到 26 个互不相同父进程各对同一备份库开 fetch)。
 *
 * 为什么不走上方 `acquire()`(语义不合,不是嫌它重):
 *  - acquire 是"排队等到位"(默认 120s 超时后 throw),那是提交链要的 —— 提交必须做成;
 *  - 本原语的调用方**做成做不成两可**:少刷一轮不是故障(AGENTS §1 归档大批量阀门 /
 *    守门 5c 水印 200 缺口阀同一条:自动档少做一件事不是错误,不得把链条弄红),
 *    叠八轮并发才是故障;所以拿不到就返回,调用方自己决定怎么"说明跳过"(退出码 0);
 *  - acquire 的 unitId 重入(同 unitId 直接放行)会为单实例**开后门**(两个同 unit 的
 *    进程本就是要互斥的那对),故这里的重入判据收紧为"同 unitId ∧ 持锁 pid 就是本进程";
 *  - acquire 先调 cleanStaleIndexLocks()(扫 tasklist + 删文件),对只路过一下的跳过者
 *    是无必要副作用,本原语不碰 index.lock。
 *
 * 三条不许漂的规矩(各有镜像用例,scripts/tests/git-backup-refresh.test.mjs T10–T14):
 *  ① **持有者活着的锁绝不抢**(哪怕名义年龄超 staleMs)—— acquire 那条"名义活着超龄也抢"
 *     靠心跳续 ts 兜住,而本原语的调用方没有心跳:照抄会把两个实例直接放进临界区,
 *     正是本票要根治的病。唯一例外是身份三元组**确证** pid 已被复用(`mismatch`,
 *     走既有 identityAuthorizesClaim);`unverifiable` / `match` 一律维持"按持有中处理"。
 *  ② 死 pid 的残留锁不秒删:要求 **pid 已死 ∧ 锁龄超 staleMs(默认 300s,与 git-lock 同档)**
 *     才回收,且回收仍走 claimStaleLock(改名→身份回读→只处置改到的那份)—— 2026-09-26
 *     的实测教训:"我判它已死"与"我删它"之间别人可能已拿到新锁,直删删的是别人的活锁。
 *  ③ 拿不到锁只返回结论,不等待、不抛错、**更不删别人的锁**;release 句柄只在拿到锁时
 *     给出(acquired=false ⇒ release=null),从结构上排除"跳过者误删持有者的锁"。
 *
 * 锁形态与本文件完全同构(目录 + meta.json {unitId,pid,ts,host,pidStart}),落点由调用方
 * 指定(资源在哪,锁就在哪 —— 备份刷新器的锁放备份 gitdir 内),`git-lock.mjs clean`
 * 与任何通用巡检工具因此都认得这类锁。
 *
 * @param {{dir:string, unitId?:string, staleMs?:number,
 *   identityRun?:Function, claimArchiveRoot?:string|null, log?:(m:string)=>void}} opts
 *   `identityRun` / `claimArchiveRoot` / `dir` / `log` 为测试与夹具注入面(镜像测试据此
 *   在"不派生真 PowerShell、抢占现场不落进 gitArchiveDir()"的前提下跑端到端)。
 * @returns {{acquired:boolean, kind:string, why:string, holder:string|null,
 *   release:(()=>{released:boolean,why:string})|null}}
 */
export function tryAcquireSingleInstance({
  dir,
  unitId = '',
  staleMs = 300_000,
  identityRun,
  claimArchiveRoot,
  log = (m) => console.log(m),
} = {}) {
  const idOpts = identityRun ? { run: identityRun } : {}
  const seconds = (ms) => Math.round(ms / 1000)
  // mkdir 成功即持锁;EEXIST 才进入下面的判读,其它错误如实上报(不做"猜无锁"继续)。
  const mk = () => {
    // G-814425:与 `acquire` 用**同一份**原子初始化(lib/lock-atomic-init.mjs),不各写一遍。
    // 这一支原本也是 `mkdirSync(dir)` → `writeMeta(dir)` 两步,而本原语对"目录在而 meta 不在"
    // 的处置正是「龄超 staleMs ⇒ 视为残留回收」—— 于是**别人还在写 meta 的那一毫秒**的半成品锁
    // 会被回收掉(与 deploy-lock 的 absent 态同一条判据、同一个病灶)。改成 pending+rename 之后,
    // 正式路径出现即等于内容已写全,那条判据只剩"真的崩在两步之外"这一种解释。
    const made = createLockDirectoryAtomically({
      dir,
      writePayload: (staged) => writeMeta(staged, unitId, idOpts),
    })
    if (made.ok) {
      // G-397:同 acquire —— 把本进程刚写下的租约凭据记在**最终目录**上,
      // 否则 `release: () => release({ unitId, dir })` 那个闭包只能凭 unitId 兼容档交锁。
      rememberLeaseToken(dir, made.payload?.leaseToken)
      return 'ok'
    }
    // mkdir 成功即持锁;EEXIST 才进入下面的判读,其它错误如实上报(不做"猜无锁"继续)。
    if (made.kind === 'contended') return 'exists'
    return `fail:${made.code ?? 'unknown'}`
  }
  const yes = (kind) => ({
    acquired: true,
    kind,
    why: '',
    holder: null,
    release: () => release({ unitId, dir }),
  })
  const no = (kind, why, holderMeta) => ({
    acquired: false,
    kind,
    why,
    holder: holderMeta ? fmtLock(holderMeta) : null,
    release: null, // ⚠️ 判据:没拿到锁就不给释放句柄 —— 跳过者永远删不动持有者的锁
  })

  for (let round = 0; round < 3; round++) {
    const m = mk()
    if (m === 'ok') return yes('acquired')
    if (m !== 'exists') return no('error', `创建锁目录失败,不猜 ⇒ 本轮放弃(${m})`, null)

    const meta = readMeta(dir)
    // 重入:同 unitId **且** meta.pid 就是本进程(acquire 那种"同 unit 即重入"会拆掉单实例)
    if (meta && meta.unitId === unitId && Number(meta.pid) === process.pid) return yes('reentrant')

    let stealWhy = null
    if (!meta) {
      // 锁目录在而 meta 读不到:只能按目录 mtime 估龄;估不动(刚消失/无权限)不猜,交下轮
      let age = null
      try {
        age = Date.now() - statSync(dir).mtimeMs
      } catch {
        continue
      }
      // G-57:负龄 ⇒ 锁龄判不出来。这里**不许**落到下面那句"龄 Xs 未超 Ys ⇒ 不判死" ——
      // 那句话把"判不出来"写成了"判过了,是新鲜的",而负龄恰恰会让下一跳恒假 ⇒ 永不判死。
      const v = judgeLockAge(age)
      if (v.verdict === 'undetermined') {
        const why = `[git-lock] 单实例守卫:未判定 —— 锁目录内无可读 meta.json,${v.why} ⇒ 既不判死也不判新鲜,本轮跳过`
        log(why)
        return no('undetermined', why, null)
      }
      if (age > staleMs)
        stealWhy = `锁目录内无可读 meta.json 且目录龄 ${seconds(age)}s 超 ${seconds(staleMs)}s ⇒ 视为残留回收`
      else
        return no(
          'skipped-held',
          `锁目录内无可读 meta.json,龄 ${seconds(age)}s 未超 ${seconds(staleMs)}s ⇒ 不判死`,
          null,
        )
    } else if (!isPidAlive(meta.pid)) {
      const age = Date.now() - (meta.ts ?? 0)
      // G-57:同上 —— 死 pid 这一支的回收条件也是 `age > staleMs`,未来 ts 会把它恒钉成假。
      const v = judgeLockAge(age)
      if (v.verdict === 'undetermined') {
        const why = `[git-lock] 单实例守卫:未判定 —— 持有者 pid=${meta.pid} 已退出,但 ${v.why} ⇒ 既不回收也不判新鲜,本轮跳过`
        log(why)
        return no('undetermined', why, meta)
      }
      if (age > staleMs)
        stealWhy = `持有者 pid=${meta.pid} 已退出,且锁龄 ${seconds(age)}s 超 ${seconds(staleMs)}s ⇒ 回收残留`
      else
        return no(
          'skipped-held',
          `持有者 pid=${meta.pid} 刚退出(锁龄 ${seconds(age)}s 未超 ${seconds(staleMs)}s)⇒ 暂不回收,下轮再来`,
          meta,
        )
    } else {
      // 名义存活:唯一能证明"这其实不是持锁者"的是身份三元组确证复用(G-193 那一型)。
      // match ⇒ 确有人在持有;unverifiable ⇒ 维持改动前判据(活着就不抢),原因当场喊出来。
      const identity = verifyHolder(meta, idOpts)
      if (identityAuthorizesClaim(identity)) {
        stealWhy = `身份三元组确证 pid=${meta.pid} 已不是持锁进程:${identity.why} ⇒ 回收(不依赖锁龄)`
      } else {
        if (identity.kind === 'unverifiable')
          log(
            `[git-lock] 单实例守卫:身份无法核对(pid=${meta.pid})⇒ 按"持有者仍持有"跳过,不据此抢占。原因:${identity.why ?? '未给'}`,
          )
        return no(
          'skipped-held',
          `已有一个实例在持有该锁(持有者 ${fmtLock(meta)})⇒ 跳过本轮,不排队`,
          meta,
        )
      }
    }

    const claim = claimStaleLock(dir, meta, `[tryAcquireSingleInstance] ${stealWhy}`, {
      archiveRoot: claimArchiveRoot,
    })
    log(claim.log)
    if (!claim.ok) {
      // 回收没落地 ⇒ 原路径此刻可能已属别人,什么都别再碰;失效方向 = 跳过而非双实例
      return no('skipped-held', `残留锁回收未落地 ⇒ 按他人持有对待:${claim.log}`, meta)
    }
    // 回收成功 ⇒ 回循环顶重试 mkdir(并发下可能被抢,最多 3 轮,绝不热自旋等待)
  }
  return no('skipped-held', '连续多轮未取到锁 ⇒ 本轮放弃(下轮再来)', null)
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  const getOpt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }

  try {
    if (cmd === 'acquire') {
      await acquire({
        unitId: getOpt('--unit') ?? '',
        timeoutMs: Number(getOpt('--timeout') ?? 120_000),
        staleMs: Number(getOpt('--stale') ?? 300_000),
        metricsFile: metricsFilePath(),
      })
      console.log('locked')
    } else if (cmd === 'scan') {
      // G-262:只检不删的原生锁读数 + git 进程数 + 锁等待 P95(账本累积)
      scanCommand()
    } else if (cmd === 'release') {
      const r = release({ unitId: getOpt('--unit') ?? '', token: getOpt('--token') })
      console.log(r.released ? 'released' : `未释放:${r.why}`)
      if (!r.released && r.why !== '无锁目录') process.exit(1)
    } else if (cmd === 'check') {
      process.exit(check())
    } else if (cmd === 'heartbeat') {
      await heartbeat({
        unitId: getOpt('--unit') ?? '',
        intervalMs: Number(getOpt('--interval') ?? 5_000),
        parentPid: getOpt('--parent-pid') ? Number(getOpt('--parent-pid')) : undefined,
      })
    } else if (cmd === 'git-dir') {
      console.log(gitDir())
    } else if (cmd === 'clean') {
      // 2026-09-19:手动清理所有 stale 锁(ihui-git-write.lock 死 PID + index.lock 残留)
      // 用法: node scripts/git-lock.mjs clean
      const dir = lockDir()
      const removed = []
      // G-57:ihui-git-write.lock 负龄未判定的点名收集(与下面 index.lock 的 indexNotes 同型:
      // 它们不是"已清理",塞进 removed 会让"清了 0 个"读成"清了 1 个")
      const ageNotes = []
      const probe = makeIdentityProbe()
      // 1. 清理死 PID 的 ihui-git-write.lock
      if (existsSync(dir)) {
        const meta = readMeta(dir)
        if (meta) {
          const holderAlive = isPidAlive(meta.pid)
          const age = Date.now() - (meta.ts ?? 0)
          const identity = holderAlive ? probe(meta) : null
          // 原判据(死 PID / 超 1800s 硬上限)一字未动;多出来的授权只有"身份确证复用"这一条。
          // G-57(2026-10-23 收口剩余两格之二,同 acquire 那一格):未来 ts ⇒ age 为负 ⇒
          // 下面 `age > 1_800_000` 恒假 ⇒ "pid 名义存活 + 未来 ts"原本静默落进"保留"支,
          // 把"判不出来"写成"保留/新鲜",连汇总都跟着报"✅ 无 stale 锁需清理"
          // (实测 age=-3600s,§0.3"没判绝不写成判过"的典型)。判据接单一真相源
          // judgeLockAge():判不出来 ⇒ 点名后不处置(既不抢占也不判新鲜),点名进未判定汇总。
          // 死 PID 与身份确证复用两支不依赖锁龄,照旧走原判据。
          const ageV = judgeLockAge(age)
          if (holderAlive && ageV.verdict === 'undetermined') {
            ageNotes.push(
              `[git-lock] clean 未判定:${dir} —— ${ageV.why} ⇒ 既不抢占也不按"新鲜"保留,锁保持原样` +
                `(出路:先对本机时钟对时,再跑 git-lock.mjs clean)`,
            )
          } else if (!holderAlive || age > 1_800_000 || identityAuthorizesClaim(identity)) {
            // 同样是抢占 ⇒ 走原子改名,不得 rmSync 原路径(见 claimStaleLock 注释)
            const claim = claimStaleLock(
              dir,
              meta,
              identityAuthorizesClaim(identity)
                ? `clean:${identity.why} ⇒ 身份确证该 pid 已不是持锁过程,立即抢占(锁龄 ${Math.round(age / 1000)}s,原判据要等 1800s)`
                : holderAlive
                  ? `clean:锁龄 ${Math.round(age / 1000)}s 超硬上限 1800s 而 pid=${meta.pid} 名义存活 ⇒ pid 复用${identityNote(identity)}`
                  : `clean:持有者 pid=${meta.pid} 已退出`,
            )
            console.log(claim.log)
            if (claim.ok)
              removed.push(
                `ihui-git-write.lock(unit=${meta.unitId} pid=${meta.pid} ${
                  identityAuthorizesClaim(identity)
                    ? '身份确证复用'
                    : holderAlive
                      ? 'hardStale'
                      : 'dead'
                })`,
              )
          } else {
            console.log(
              `保留 ihui-git-write.lock(持有者 pid=${meta.pid} 仍存活,age=${Math.round(age / 1000)}s${identity ? `;身份对账=${identity.kind}${identity.why ? `:${identity.why}` : ''}` : ''})`,
            )
          }
        } else {
          // 无 meta.json 的残留锁目录:判不了归属 ⇒ 只能按"判死=无 meta"这一条改名抢占,
          // 改名后再回读校验(若此刻别人已建好带 meta 的新锁,mismatch 分支会原样放回)
          const claim = claimStaleLock(dir, null, 'clean:锁目录内无 meta.json')
          console.log(claim.log)
          if (claim.ok) removed.push('ihui-git-write.lock(无 meta.json)')
        }
      }
      // 2. 清理 stale index.lock
      // G-57:未判定的点名行单独收集 —— 它们不是"已清理",塞进 removed 会让"清了 0 个"读成
      // "清了 1 个";而只打到 stderr 又会在"✅ 无 stale 锁需清理"旁边被当成噪声略过。
      const indexNotes = []
      const indexLocks = cleanStaleIndexLocks({ log: (m) => indexNotes.push(m) })
      removed.push(...indexLocks.map((p) => `index.lock:${p}`))
      for (const n of indexNotes) console.log(`   ⚠️ ${n}`)
      for (const n of ageNotes) console.log(`   ⚠️ ${n}`)
      if (removed.length === 0 && indexNotes.length === 0 && ageNotes.length === 0) {
        console.log('✅ 无 stale 锁需清理')
      } else if (removed.length !== 0) {
        console.log(`🧹 已清理 ${removed.length} 个 stale 锁:`)
        for (const r of removed) console.log(`   - ${r}`)
      } else {
        console.log(
          `⚠️ 未判定:${indexNotes.length + ageNotes.length} 把锁因锁龄判不出来而**未处置**(不是"没有 stale 锁")`,
        )
      }
    } else {
      console.error(
        '用法: git-lock.mjs acquire|release|check|heartbeat|clean|scan [--unit <id>] [--timeout <ms>] [--stale <ms>] [--parent-pid <pid>]',
      )
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

// §22d:双形态入口守护 —— 被镜像测试 import 时绝不触发 CLI 副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// §22c:暴露给镜像测试(scripts/tests/git-lock-stale-steal.test.mjs),
// 禁止在测试里复制第二份判据实现 —— 实现漂了测试还绿 = 测试在替缺陷背书。
export const __test__ = {
  lockDir,
  metaFile,
  readMeta,
  writeMeta,
  isPidAlive,
  sameLock,
  claimStaleLock,
  removeLock,
  acquire,
  release,
  check,
  // 身份三元组的接线面(镜像测试直接判这三件,不得在测试里抄第二份判据 —— §22c):
  makeIdentityProbe,
  identityNote,
  identityAuthorizesClaim,
  heartbeat,
  // G-262 计量与检测的接线面(镜像测试注入夹具目录跑端到端,不碰真实 .git/账本):
  cleanStaleIndexLocks,
  // G-57 锁龄可判性判据(镜像测试直接判这一份,不得在测试里抄第二份 —— §22c):
  judgeLockAge,
  LOCK_AGE_SKEW_TOLERANCE_MS,
  INDEX_LOCK_STALE_MS,
  metricsFilePath,
  readMetricsLines,
  percentile,
  scanCommand,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-697(2026-10-03):双因果链合成器同出口 —— 实现唯一在 scripts/lib/two-cause-chain.mjs,
// 这里顶层 re-export 供本锁消费方(git-backup-refresh 等自己写 finally { release } 的脚本)
// 取用;各消费方自己的 finally 接线归 F5 改造,不得由本票顺手改。
export { runWithRelease, throwTwoCauseChain } from './lib/two-cause-chain.mjs'
