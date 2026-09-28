// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * git-native-locks.mjs — git 原生锁文件的**可判检测**(G-262,2026-09-28 立)。
 *
 * 病理(G-262 原文):`.git/index.lock` 可被一个**已挂死的只读 git diff** 长期持有 ⇒
 * 各会话 safe-commit 重试全被挡。2026-09-28 又实证一族新形态:git 的 next-index 实验特性
 * 在 `.git/` 落 `next-index-<pid>.lock`(≈索引大小的文件),Windows **pid 会复用** ⇒
 * 新进程撞上同名旧锁时报 `File exists` 而**永远等不到释放**(当天实测 5 枚 2-4 天陈锁
 * 挡下两路 safe-commit,清理前无人能提交)。
 *
 * 判据方向(与 git-lock.mjs 的写锁抢占纪律同源):
 *   - **名字里带 pid 的锁**才有归属证据:`next-index-<pid>.lock` ⇒ pid 判死 ⇒ dead-confirmed
 *     (创建者确已退出,锁必是孤儿;pid 复用只会把死锁看成活锁 ⇒ 保守方向 = 不碰)。
 *   - **不带 pid 的锁**(index.lock / config.lock / maintenance.lock …)git 没记持有者 ⇒
 *     只能报数与报龄(no-owner-evidence),**绝不**据此授权删除。删除授权只走
 *     git-lock.mjs cleanStaleIndexLocks 的既有判据(全局无 git 进程 / 超龄)。
 *   - 本 lib **只读不删**:检测与分类在这里,处置(清理)在 git-lock.mjs 一处,免得两份策略漂移。
 *
 * 全部注入式(readdir/stat/isPidAlive/now),镜像测试可在临时目录里跑端到端而不碰真实 `.git`。
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 名字里嵌 pid 的锁形态(现读 git 源码侧只有 next-index;新形态出现要来这里登记,别在调用方各写一份正则) */
export const EMBED_PID_PATTERNS = [/^next-index-(\d+)\.lock$/]

/**
 * 枚举 `.git` 下的原生锁文件:仓根 `*.lock`、worktrees/<wt>/ 下 `*.lock`、objects/maintenance.lock。
 * refs 下的 `*.lock` 理论上存在(ref 更新崩溃残留),但 git 自己会按同规则重试清理,
 * 且量大而杂 —— 本尺子**不扩面**(宁漏不误:扩面会把"报数"变成"指控"),如实只收这三族。
 */
export function listNativeLocks({
  gitRoot,
  readdir = readdirSync,
  stat = statSync,
  now = Date.now(),
}) {
  const found = []
  const pushFile = (rel, name) => {
    let st
    try {
      st = stat(join(gitRoot, ...rel.split('/')))
    } catch {
      return // 枚举与 stat 之间消失 = 刚被释放,不是漏
    }
    if (!st.isFile()) return
    let embeddedPid = null
    for (const re of EMBED_PID_PATTERNS) {
      const m = name.match(re)
      if (m) {
        embeddedPid = Number(m[1])
        break
      }
    }
    found.push({ rel, name, embeddedPid, ageMs: now - st.mtimeMs, size: st.size })
  }
  let rootEntries = []
  try {
    rootEntries = readdir(gitRoot)
  } catch {
    return { locks: [], gitRootUnreadable: true }
  }
  for (const name of rootEntries) if (name.endsWith('.lock')) pushFile(name, name)
  try {
    const wtRoot = join(gitRoot, 'worktrees')
    if (existsSync(wtRoot)) {
      for (const wt of readdir(wtRoot)) {
        for (const name of readdir(join(wtRoot, wt))) {
          if (name.endsWith('.lock')) pushFile(`worktrees/${wt}/${name}`, name)
        }
      }
    }
  } catch {
    /* worktrees 不可读:漏报这一族,由 gitRootUnreadable 之外的读数如实体现 */
  }
  try {
    if (existsSync(join(gitRoot, 'objects', 'maintenance.lock')))
      pushFile('objects/maintenance.lock', 'maintenance.lock')
  } catch {
    /* 同上 */
  }
  return { locks: found, gitRootUnreadable: false }
}

/**
 * 三分类(纯函数):dead-confirmed / pid-alive / no-owner-evidence。
 * `isPidAlive` 语义沿用 git-lock.mjs 的 process.kill(pid,0):
 *   false ⇒ 该 pid 上没有任何进程 ⇒ 创建者必已退出 ⇒ 孤儿锁,授权处置;
 *   true  ⇒ 可能是原主、也可能是复用 pid 的新进程 ⇒ 一律不碰(保守)。
 */
export function classifyLock(lock, { isPidAlive }) {
  if (lock.embeddedPid === null || lock.embeddedPid === undefined)
    return { ...lock, verdict: 'no-owner-evidence' }
  if (!Number.isFinite(lock.embeddedPid) || lock.embeddedPid <= 0)
    return { ...lock, verdict: 'no-owner-evidence' }
  let alive
  try {
    alive = isPidAlive(lock.embeddedPid)
  } catch {
    // 判活本身问不到 ⇒ 不得折成"死";unverifiable 与"没判"在账面上必须长得不一样
    return { ...lock, verdict: 'no-owner-evidence', why: 'isPidAlive 不可达' }
  }
  return { ...lock, verdict: alive ? 'pid-alive' : 'dead-confirmed' }
}

export function scanNativeLocks({ gitRoot, isPidAlive, readdir, stat, now }) {
  const { locks, gitRootUnreadable } = listNativeLocks({ gitRoot, readdir, stat, now })
  const classified = locks.map((l) => classifyLock(l, { isPidAlive }))
  return {
    gitRootUnreadable,
    locks: classified,
    counts: {
      dead: classified.filter((l) => l.verdict === 'dead-confirmed').length,
      alive: classified.filter((l) => l.verdict === 'pid-alive').length,
      unevidenced: classified.filter((l) => l.verdict === 'no-owner-evidence').length,
    },
  }
}

/**
 * 从 tasklist 输出数 git.exe 进程数(G-262 判据之二:同时存活 git 进程数)。
 * ⚠ 本机实测坑(2026-09-28):tasklist 的"没有运行的任务"提示按**控制台码页(GBK)**输出,
 * 按 utf8 读会得到乱码 ⇒ 既匹配不到提示也匹配不到进程 ⇒ 把"0 个"读成"量不到"。
 * 所以接受 Buffer:先按 gbk 解(full-icu 可用),解不动退 latin1(git.exe 行本就是 ASCII)。
 * 解析失败 ⇒ null,不报 0 —— "没判"与"判过是 0"在账面上必须长得不一样。
 */
export function countGitProcsFromTasklist(out) {
  let text
  if (Buffer.isBuffer(out)) {
    try {
      text = new TextDecoder('gbk').decode(out)
    } catch {
      text = out.toString('latin1')
    }
  } else if (typeof out === 'string') {
    text = out
  } else {
    return null
  }
  if (/信息: 没有运行的任务|INFO: No tasks/i.test(text)) return 0
  const n = (text.match(/git(?:-[\w]+)?\.exe/gi) || []).length
  return n > 0 || /git\.exe/i.test(text) ? n : null
}
