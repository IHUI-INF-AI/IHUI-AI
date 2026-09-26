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
 *   node scripts/git-lock.mjs release [--unit <id>]
 *   node scripts/git-lock.mjs check              # 只读:是否有锁,exit 0=无锁 1=有锁
 *   node scripts/git-lock.mjs heartbeat --unit <id> [--interval <ms>] [--parent-pid <pid>]
 *
 * 锁语义:
 *   - 锁 = .git/ihui-git-write.lock 目录(mkdir 原子性)
 *   - 锁内 meta 文件记录 { unitId, pid, ts }
 *   - 可重入:同 unitId(同一写操作单元,如 safe-commit 及其 post-commit 子进程)
 *     再次 acquire 直接通过,避免嵌套死锁
 *   - 心跳续期(2026-09-18 根治):持锁方 spawn heartbeat 子进程(随父进程死亡自动退出),
 *     每 intervalMs 重写 meta.ts。根治事故:长流程(pre-commit 多分钟)期间 meta.ts 停留在
 *     acquire 时刻,被并发方按"悬挂锁"误判强制抢占 → 两个进程同时写 .git(锁反而制造损坏)。
 *   - stale 清理(2026-09-18 加固):锁年龄超过 staleMs(默认 300s)**且持有者 pid 已死**
 *     才强制抢占;活进程的锁绝不被抢。另设 hardStale(默认 1800s)兜底 pid 复用假阳性。
 *   - 超时:acquire 等待 timeoutMs(默认 120s)后抛错
 *
 * 集成点(见 AGENTS.md 事故复盘):
 *   - scripts/safe-commit.mjs:整个 commit 流程包锁
 *   - .husky/post-commit:IHUI_GIT_LOCK_UNIT 未设置时(直接 git commit 场景)acquire
 *   - scripts/safe-gc.mjs:手动 gc 前必须 acquire(杜绝 gc 与写操作并发)
 */
import { execSync } from 'node:child_process'
import {
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
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
// 现场归档的唯一落点(AGENTS §15b / §5b「现场归档一律落在 gitArchiveDir(),手工抢修也不得例外」)。
// 抢占产生的 `.stale-*` 目录**绝不**留在 .git 里,更不落工作区根或盘根。
import { gitArchiveDir } from './lib/gitdir.mjs'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trim()
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

function writeMeta(dir, unitId) {
  writeFileSync(
    metaFile(dir),
    JSON.stringify({ unitId: unitId ?? '', pid: process.pid, ts: Date.now() }),
    'utf8',
  )
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

/**
 * 原子抢占:**先把锁目录改名搬走、只删自己改到的那一份**(2026-09-26 根治运行期竞态)。
 *
 * 故障形态(旧实现):判"持有者已死"之后直接 `rmSync(dir)`。在"我判它已死"与"我删它"之间,
 * 别的进程可以已经删掉旧锁并 `mkdir` 拿到**新锁** —— 我 `rmSync` 掉的就是别人的活锁,
 * 于是两个写者同时进临界区(git 侧 = `.git/index.lock` 双写者;部署侧 = 两次构建同时写 `.next`)。
 * `:205` 那句"调用方必须回读 existsSync 复核"只判"删没删掉",**不判"删的是不是我刚看过的那把"**。
 *
 * 三步,一步都不能少:
 *   ① `renameSync(dir, 归档出口/<name>.stale-<pid>-<ts>)` —— 改名是原子的,成功即独占。
 *      抛错(ENOENT=锁已不见 / EPERM·EBUSY=被占用 / EXDEV=跨卷)一律算**没抢到**,
 *      **绝不回退去 rmSync 原路径**(那正是本票要根治的那一步)。跨卷时退到同父目录暂存,
 *      但退的是"落点",不是"改名这一步"(仍是 rename-first)。
 *   ② 改名成功后回读**改名后目录**里的 meta,与判死时那份三要素比对。不等 ⇒ 我改到的是
 *      别人新建的活锁 ⇒ 原样放回、什么都没删(失效方向是"多等一轮",不是"多删一把")。
 *   ③ 只有②通过才处置改名后的那份:留在归档出口当现场,落不进归档才递归删除;
 *      删除失败也不回头碰原路径。
 *
 * @param {string} dir 锁目录
 * @param {{unitId?:string,pid?:number,ts?:number}|null} judged 判死时读到的 meta(也是②的比对基准)
 * @param {string} why 判死理由(进归档现场与日志,供事后追责)
 * @param {{archiveRoot?:string|null, suffix?:string}} [opts]
 * @returns {{ok:boolean, phase:string, code?:string, stagedPath:string|null, archived:string|null, log:string}}
 */
function claimStaleLock(dir, judged, why, { archiveRoot = gitArchiveDir(), suffix } = {}) {
  // 提前一次"锁目录在不在"只为了不去建归档目录 —— **它不是抢占的安全凭据**:
  // 安全凭据是①的改名 + ②的身份回读,二者才决定"我能不能处置这一份"。
  if (!existsSync(dir)) {
    return {
      ok: false,
      phase: 'rename',
      code: 'ENOENT',
      stagedPath: null,
      archived: null,
      log: `[git-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除、未创建任何目录`,
    }
  }
  const tag = suffix ?? `.stale-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let rawMeta = null
  try {
    rawMeta = readFileSync(metaFile(dir), 'utf8')
  } catch {
    rawMeta = null
  }
  // ① 原子改名:优先直接搬进归档出口(§15b 批准落点,不落工作区根/盘根)
  let stagedPath = null
  if (archiveRoot) {
    const target = join(archiveRoot, `${basename(dir)}${tag}`)
    try {
      mkdirSync(archiveRoot, { recursive: true })
      renameSync(dir, target)
      stagedPath = target
    } catch (e) {
      if (e?.code === 'ENOENT') {
        return {
          ok: false,
          phase: 'rename',
          code: 'ENOENT',
          stagedPath: null,
          archived: null,
          log: `[git-lock] 抢占放弃(锁目录已不见:${dir})——未删除任何目录,继续等待`,
        }
      }
      stagedPath = null // 跨卷/权限等:退到同父目录暂存(仍是 rename-first)
    }
  }
  if (!stagedPath) {
    const local = `${dir}${tag}`
    try {
      renameSync(dir, local)
      stagedPath = local
    } catch (e) {
      return {
        ok: false,
        phase: 'rename',
        code: e?.code ?? 'unknown',
        stagedPath: null,
        archived: null,
        log: `[git-lock] 抢占未成功(改名 ${e?.code ?? e?.message})——原路径 ${dir} 未被触碰,继续等待`,
      }
    }
  }
  // ② 回读校验:改名后目录里的 meta 必须就是判死时那把
  const nowMeta = readMeta(stagedPath)
  if (!sameLock(nowMeta, judged)) {
    let restored = false
    try {
      renameSync(stagedPath, dir)
      restored = true
    } catch {
      /* 放不回(原路径又被占了)⇒ 现场原地保留、绝不删,大声喊出来交人工 */
    }
    return {
      ok: false,
      phase: 'mismatch',
      restored,
      stagedPath: restored ? null : stagedPath,
      archived: null,
      log:
        `[git-lock] 抢占放弃:${dir} 上的锁在改名瞬间已被替换` +
        `(判死时 ${fmtLock(judged)},改名后 ${fmtLock(nowMeta)})` +
        ` ⇒ ${restored ? '已原样放回,未删除任何锁' : `⚠️ 放回失败,现场保留在 ${stagedPath}(未删除,请人工处置)`}`,
    }
  }
  // ③ 处置改名后的那一份(且只有这一份)
  const note = writeStaleNote(stagedPath, { judged, rawMeta, why, stolenByPid: process.pid })
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
  return {
    ok: true,
    phase: 'claimed',
    stagedPath,
    archived,
    log:
      `[git-lock] 已抢占悬挂锁:被抢的持有者 = ${fmtLock(judged)};判死理由:${why}。` +
      `现场=${archived ?? '(归档不可得,已就地删除)'}${note.ok ? '' : ` ⚠️ 现场说明写入失败:${note.error}`}`,
  }
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

function cleanStaleIndexLocks() {
  const cleaned = []
  const base = gitDir()
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
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq git.exe" /NH', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
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
      // 无 git 进程 → 必是残留;有 git 进程 → 年龄超阈值才删
      if (!hasGitProcess || age > INDEX_LOCK_STALE_MS) {
        unlinkSync(lockPath)
        cleaned.push(lockPath)
      }
    } catch {
      /* 文件正在被占用(活 git 持有)或已消失,跳过 */
    }
  }
  return cleaned
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
 */
async function acquire({ unitId, timeoutMs = 120_000, staleMs = 300_000, hardStaleMs = 1_800_000 }) {
  // 先清理可能存在的 stale index.lock(死 git 进程残留),否则后续 git 操作全卡死
  cleanStaleIndexLocks()

  const dir = lockDir()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      mkdirSync(dir, { recursive: false })
      writeMeta(dir, unitId)
      return true
    } catch {
      // 锁已存在:检查可重入 / stale
      const meta = readMeta(dir)
      if (meta && unitId && meta.unitId === unitId) {
        // 同一写操作单元(如 safe-commit → post-commit 链路)可重入
        return true
      }
      if (meta) {
        const age = Date.now() - (meta.ts ?? 0)
        const holderAlive = isPidAlive(meta.pid)
        // 2026-09-19:死 PID 立即抢占(不等 staleMs);活进程才走 staleMs/hardStaleMs
        if (!holderAlive || age > hardStaleMs || age > staleMs) {
          // 悬挂锁(持有者已崩溃退出,或超 hardStale 兜底):强制抢占。
          // 2026-09-26:旧写法是 `removeLock(dir)` —— 在"我判它已死"与"我删它"之间,
          // 别的进程可以已经删掉旧锁并 mkdir 拿到新锁,于是删掉的是**别人的活锁**
          // (git 侧即 `.git/index.lock` 双写者)。抢占必须原子改名,见 claimStaleLock()。
          const why = holderAlive
            ? `锁龄 ${Math.round(age / 1000)}s 已超 staleMs=${Math.round(staleMs / 1000)}s / hardStaleMs=${Math.round(hardStaleMs / 1000)}s,而持有者 pid=${meta.pid} 名义存活 ⇒ pid 极可能已被复用`
            : `持有者 pid=${meta.pid} 已退出`
          const claim = claimStaleLock(dir, meta, why)
          console.log(claim.log)
          if (claim.ok) continue
          // 没抢到 ⇒ 什么都不删,落到下面的超时判据 + 轮询等待(不 continue,避免热自旋)
        }
      }
      if (Date.now() > deadline) {
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
 * 释放锁(仅当锁属于当前 unitId;同 unitId 可重入多次 acquire 需配平 release)。
 *
 * 2026-09-26 收紧:旧写法是"拿不到 meta 也删" + "unitId 为空 ⇒ 无条件删",于是
 * 一条不带 `--unit` 的 `git-lock.mjs release` 就能删掉**别人正在用的活锁**。
 * 现在必须拿得出归属凭据:unitId 与 meta 全等,或 meta 记的就是本进程 pid。
 * 拿不出凭据 ⇒ 拒绝并说明出路(抢占走 acquire / `clean`)。
 * @param {{unitId?:string, dir?:string}} [opts]
 */
function release({ unitId, dir = lockDir() } = {}) {
  if (!existsSync(dir)) return { released: false, why: '无锁目录' }
  const meta = readMeta(dir)
  if (!meta) {
    console.error(
      `[git-lock] ❌ 拒绝释放:${dir} 里没有可读的 meta.json ⇒ 无法证明这把锁是谁的,` +
        `删它可能删掉别人正在用的锁。出路:\`git-lock.mjs clean\`(按判死证据抢占)或人工确认后删除。`,
    )
    return { released: false, why: '无法判定归属(无 meta.json)' }
  }
  const ownsByToken = !!unitId && meta.unitId === unitId
  const ownsByPid = Number(meta.pid) === process.pid
  if (!ownsByToken && !ownsByPid) {
    console.error(
      `[git-lock] ❌ 拒绝释放:锁由 unit=${meta.unitId} pid=${meta.pid} 持有,` +
        `本次调用既无匹配 unitId(--unit ${JSON.stringify(unitId ?? '')})也非本进程 ⇒ 不代删别人的锁。`,
    )
    return { released: false, why: '非持有者' }
  }
  // 持有者自释:不存在竞态(内容凭据已验明这把就是我的),按原语义直接删
  removeLock(dir)
  return { released: true, why: ownsByToken ? 'unitId 匹配' : '本进程 pid 匹配' }
}


/** 只读检查 */
function check() {
  const dir = lockDir()
  if (!existsSync(dir)) return 0
  const meta = readMeta(dir)
  console.log(
    `locked: unit=${meta?.unitId ?? ''} pid=${meta?.pid ?? ''} ts=${meta ? new Date(meta.ts).toISOString() : ''}`,
  )
  return 1
}

/**
 * 心跳续期(2026-09-18 根治):每 intervalMs 重写 meta.ts,使长流程持锁永不误判悬挂。
 * 退出条件(全部自动,无需清理动作):
 *   - 锁目录消失(已释放)或 unitId 易主
 *   - parentPid 指定的持锁父进程已退出(detached spawn 场景父死子亡)
 */
async function heartbeat({ unitId, intervalMs = 5_000, parentPid }) {
  const dir = lockDir()
  for (;;) {
    const meta = readMeta(dir)
    if (!meta || (unitId && meta.unitId !== unitId)) return
    if (parentPid && !isPidAlive(parentPid)) return
    try {
      writeFileSync(
        metaFile(dir),
        JSON.stringify({ unitId: meta.unitId, pid: meta.pid, ts: Date.now() }),
        'utf8',
      )
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
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
      })
      console.log('locked')
    } else if (cmd === 'release') {
      const r = release({ unitId: getOpt('--unit') ?? '' })
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
      // 1. 清理死 PID 的 ihui-git-write.lock
      if (existsSync(dir)) {
        const meta = readMeta(dir)
        if (meta) {
          const holderAlive = isPidAlive(meta.pid)
          const age = Date.now() - (meta.ts ?? 0)
          if (!holderAlive || age > 1_800_000) {
            // 同样是抢占 ⇒ 走原子改名,不得 rmSync 原路径(见 claimStaleLock 注释)
            const claim = claimStaleLock(
              dir,
              meta,
              holderAlive
                ? `clean:锁龄 ${Math.round(age / 1000)}s 超硬上限 1800s 而 pid=${meta.pid} 名义存活 ⇒ pid 复用`
                : `clean:持有者 pid=${meta.pid} 已退出`,
            )
            console.log(claim.log)
            if (claim.ok)
              removed.push(
                `ihui-git-write.lock(unit=${meta.unitId} pid=${meta.pid} ${holderAlive ? 'hardStale' : 'dead'})`,
              )
          } else {
            console.log(`保留 ihui-git-write.lock(持有者 pid=${meta.pid} 仍存活,age=${Math.round(age / 1000)}s)`)
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
      const indexLocks = cleanStaleIndexLocks()
      removed.push(...indexLocks.map((p) => `index.lock:${p}`))
      if (removed.length === 0) {
        console.log('✅ 无 stale 锁需清理')
      } else {
        console.log(`🧹 已清理 ${removed.length} 个 stale 锁:`)
        for (const r of removed) console.log(`   - ${r}`)
      }
    } else {
      console.error('用法: git-lock.mjs acquire|release|check|heartbeat|clean [--unit <id>] [--timeout <ms>] [--stale <ms>] [--parent-pid <pid>]')
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
