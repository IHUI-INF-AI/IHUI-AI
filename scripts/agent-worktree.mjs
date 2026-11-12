// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-worktree — 影响面隔离(O65 P0 · O6503 的隔离半边,2026-10-25 立)。
 *
 * 把"一个 agent 的改动限定在独立检出里"落成一把尺子,但**不自造第二套规范**:
 * 落点 = 根直属 `.worktrees/wt-<名>`、分支 `wt/<名>`,与 AGENTS §12h 五步生命周期同源。
 *
 * 纪律:
 *  - 默认 dry-run:不带 --apply 只打印将执行的 git 命令,零写入。
 *  - 回收不得静默删未合并检出:分支未并入 main ⇒ 必须 --tag-lost(先打 lost-commit 标签保活,
 *    再移除),否则拒绝(§12h:未合并检出不得静默删;合并与否由 agent 自主裁决,见 §12h-补)。
 *  - **回收(--reap)只删检出,绝不自动删分支**(2026-11-04 定档,s9 票):分支归 `git branch -d`
 *    与 §12h 合并裁决;`--remove <名>` 是显式单件操作,删不删分支由该路径的裁决展示。
 *  - **回收射程不按分支命名收口**(2026-11-04 定档):旧命名闸 `wt/*` 只表达"这张检出是谁创建的",
 *    不表达任何安全属性,实测让 guardian 每 24h 派发的回收腿结构性空转(21 枚 linked 检出 0 枚
 *    `wt/*` ⇒ 候选恒 0)。安全实质由后四闸(非 locked ∧ 干净 ∧ HEAD 已并入 main ∧ 空闲 ≥ 阈值)
 *    表达,一条不弱化;落点闸扩为"主仓 .worktrees/ 或同盘兄弟检出"(仓外其它盘一律不进射程),安全实质仍由后四闸兜底。
 *  - git 一律显式 stdio(守门 193):不裸 execSync、不共用继承管道。
 *  - **孤儿目录壳清扫腿(2026-11-11 补最后一格)**:`git worktree prune` 只注销
 *    `.git/worktrees/<名>` 元数据、**从不删工作树目录**,而回收器只遍历 `git worktree list`
 *    ⇒ 元数据一注销,那些只剩文件的目录壳就永远进不了射程,在盘上越积越多(实测
 *    `D:/IHUI-AI-merge-wt` 13.5 万文件、无 .git、不在登记面)。本腿并入 `--reap` 同一入口:
 *    调度层 `scripts/lib/git-guardian-worktree-reap.mjs` 已固定派 `--reap --apply --older-than 1`
 *    且 24h 节流,故零调度改动即自动生效(§0.9 不造"没装车"的器物),判据仍单源在本文件(§22c)。
 *    安全上走**两段式墓碑**:首次发现只 `renameSync` 成 `.stale-<时间戳>`(同盘、可逆、零数据丢失),
 *    墓碑按名字里的死亡戳判龄 ≥ 观察期才真删;自动腿结构上不会一上来删十几万文件。
 *    兄弟检出另加「本仓检出三件套」闸,把 `IHUI-AI-backups` / `-keys` / `-git-repo` 一律挡在射程外。
 *
 * 2026-11-11 第二轮并行代码审查收口 10 项(判据/动作仍全在本文件,调度层零改动):
 *  B1 失败数不得被「ℹ 无回收候选」吞掉(removed=0∧failed>0 必须走带失败数的 ✅ 行并设退出码);
 *  B2 `derived-heal` 进常驻槽位保护集合;I1 孤儿腿重取 `worktree list` 刷新登记面;
 *  I2 `--purge-orphan` 传 `explicitPurge` 且只接受 `remove`(不绕过两段式可逆窗口);
 *  I3 常驻兄弟目录白名单 + gitdir 以 root 归一;I4 跨进程互斥锁 / 并发 ENOENT / 真删前二次复核;
 *  M1 路径大小写统一小写归一;M2 dry-run 计划计数独立、不再双结论;
 *  M3 墓碑判龄提前到两道启发式闸之前;M4 robocopy 的 stderr 带进失败诊断。
 *
 * 用法:
 *   node scripts/agent-worktree.mjs --create <名> [--base origin/main] [--apply]
 *   node scripts/agent-worktree.mjs --list [--json]
 *   node scripts/agent-worktree.mjs --remove <名> [--tag-lost] [--apply]
 *   node scripts/agent-worktree.mjs --reap [--older-than 1] [--apply]
 *   node scripts/agent-worktree.mjs --purge-orphan <目录> [--apply]
 *   node scripts/agent-worktree.mjs --self-test
 */
import {
  statSync,
  mkdtempSync,
  existsSync,
  rmSync,
  readdirSync,
  renameSync,
  lstatSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs'
import { join, dirname, resolve, basename, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const EXIT_OK = 0
export const EXIT_REFUSED = 1
export const EXIT_UNKNOWN = 2
const WT_DIR = join(ROOT, '.worktrees')

/** 名字规范化:只留 [a-z0-9-],空/非法 ⇒ 抛。复用同一规则判落点与分支名。 */
export function normalizeName(raw) {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!n) throw new Error('worktree 名不能为空(规范化后为空)')
  if (n.length > 40) throw new Error(`worktree 名过长(${n.length} > 40)`)
  return n
}

export function worktreePathOf(name, root = ROOT) {
  return join(root, '.worktrees', `wt-${normalizeName(name)}`)
}

export function branchOf(name) {
  return `wt/${normalizeName(name)}`
}

export function lostTagOf(name, sha) {
  return `lost-commit/worktree-${normalizeName(name)}-${String(sha).slice(0, 7)}`
}

/** `git worktree list --porcelain` 解析:返回 [{path, sha, branch, locked, prunable, detached}]。 */
export function parseWorktreeList(out) {
  const rows = []
  let cur = null
  for (const line of String(out ?? '').split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) rows.push(cur)
      cur = {
        path: line.slice('worktree '.length).trim(),
        sha: '',
        branch: '',
        locked: false,
        prunable: false,
        detached: false,
      }
    } else if (cur && line.startsWith('HEAD ')) cur.sha = line.slice(5).trim()
    else if (cur && line.startsWith('branch '))
      cur.branch = line
        .slice(7)
        .trim()
        .replace(/^refs\/heads\//, '')
    else if (cur && line === 'detached') cur.detached = true
    else if (cur && line.startsWith('prunable')) cur.prunable = true
    else if (cur && line.startsWith('locked'))
      cur.locked = line.slice('locked'.length).trim() || true
  }
  if (cur) rows.push(cur)
  return rows
}

/** p 是否严格落在 dir 之下(按路径分段判定,避免 `G:\IHUI-AI\.worktrees-x` 这类前缀误判)。 */
export function isUnderDir(p, dir) {
  const rel = relative(resolve(dir), resolve(p))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** 批准落点判定:只有根直属 `.worktrees/` 下的检出才由本工具回收。 */
export function isUnderWorktreesRoot(p, root = ROOT) {
  return isUnderDir(p, join(root, '.worktrees'))
}

/**
 * 批准落点(2026-11-11 根治):原闸只认 `.worktrees/`,导致根层兄弟检出
 * (`D:/IHUI-AI-wt-*`、`D:/IHUI-AI-ci-probe` 等并行会话产物)恒为候选 0、永不回收,
 * 是"遗留工作树"积压的根因。现扩到"与主仓同盘的同级兄弟检出"——`basename` 以
 * `<主仓名>-` 起头(如 `IHUI-AI-wt-x`);仓外其它盘(C:/E:)一律不进射程。
 * gitdir 本身由调用方用 `gitDirPath` 排除,不在此处兜底。
 */
export function isReapLocationApproved(path, root = ROOT, worktreesRoot = WT_DIR) {
  if (isUnderDir(path, worktreesRoot)) return true
  const rp = resolve(root)
  const p = resolve(path)
  const sameDrive =
    process.platform === 'win32' ? p[0]?.toLowerCase() === rp[0]?.toLowerCase() : true
  // 2026-11-11 代码审查 M1:盘符大小写混写(D: vs d:)时 dirname 严格比较会把同级兄弟
  // 误判成"仓外落点"而漏收;统一走 samePath 的 resolve+斜杠归一+小写化口径。
  if (sameDrive && samePath(dirname(p), dirname(rp)) && basename(p).startsWith(`${basename(rp)}-`))
    return true
  return false
}

/**
 * git 的 `--git-dir` 可能是相对 `.git`,也可能是绝对盘符路径。posix CI 上 `D:/x`
 * 不算 isAbsolute,直接用 resolve(root, s) 会拼成 `<root>/D:/x` 而让 gitdir 排除闸失效。
 */
function absoluteFromRoot(root, p) {
  const s = String(p)
  return isAbsolute(s) || /^[A-Za-z]:[\\/]/.test(s) ? s : resolve(root, s)
}

/** Windows 长路径友好:把 posix/混合路径规整成 robocopy 可吃的 `D:\...` 形式。 */
function toWinPath(p) {
  const s = resolve(p)
  if (/^[A-Za-z]:[\\/]/.test(s)) return s.replace(/\//g, '\\')
  return s.replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\//g, '\\')
}

/**
 * 稳健删除 worktree 目录(2026-11-11 根治):`git worktree remove` 在 node_modules 长路径下
 * 必报 `Filename too long` 失败(本机实测),导致回收器报"失败"却删不掉、工作树越积越多。
 * 改用 robocopy /MIR 从空目录镜像删除 —— robocopy 走长路径 API,能删掉深层长路径文件;
 * 删完 rmdir 空壳。robocopy 退出码 0–7 均成功,<8 才是失败;失败再退化回 git worktree remove。
 */
function robustRemoveWorktreeDir(path) {
  try {
    git(['worktree', 'unlock', path])
  } catch {
    /* 未锁也行 */
  }
  const empty = mkdtempSync(join(tmpdir(), 'wt-empty-'))
  let diag = ''
  try {
    try {
      execFileSync(
        'robocopy',
        [
          toWinPath(empty),
          toWinPath(path),
          '/MIR',
          '/R:0',
          '/W:0',
          '/MT:16',
          '/NFL',
          '/NDL',
          '/NJH',
          '/NJS',
        ],
        {
          windowsHide: true,
          timeout: 600_000,
          // 2026-11-11 一次根治:默认 maxBuffer=1MB 会被 node_modules 大树的逐文件错误行撑爆
          // (spawnSync ENOBUFS ⇒ e.status 缺失 ⇒ 误入 code<0 兜底腿 ⇒ git worktree remove 又撞
          // index.lock 超时 ⇒ 假失败)。静默开关(/NFL /NDL /NJH /NJS)挡不住错误行,故扩容。
          // 2026-11-11 二次根治:13.5 万文件的孤儿目录 /MIR 连 16MB 都撑爆(实测
          // `purge-orphan` 报 ENOBUFS ⇒ 兜底腿对孤儿目录必报 "not a working tree")。
          // 扩容是治标:逐文件清单走 stdout,直接丢弃、只留 stderr 供诊断 ⇒ 从源头消掉缓冲区。
          // 退出码仍由 e.status 判(robocopy 0–7 成功),不依赖 stdout 内容。
          stdio: ['ignore', 'ignore', 'pipe'],
          maxBuffer: 1 << 24,
        },
      )
    } catch (e) {
      const code = typeof e?.status === 'number' ? e.status : -1
      // 2026-11-11 代码审查 M4:stdout 已丢弃,robocopy 的逐文件错误行只留在 stderr,
      // 必须带进诊断;否则十几万文件的删除失败只剩一句 ENOBUFS,排障信息全丢。
      diag = [e?.message, String(e?.stderr ?? '').trim().slice(0, 200)]
        .filter(Boolean)
        .join(' | ')
      if (code < 0 || code >= 8) {
        const r = git(['worktree', 'remove', '--force', path])
        if (!r.ok) return { ok: false, err: `${diag};${r.err}` }
      }
    }
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      /* 已空则忽略 */
    }
    const ok = !existsSync(path)
    return { ok, err: ok ? '' : `删除后目录仍在${diag ? `(${diag})` : ''}` }
  } finally {
    try {
      rmSync(empty, { recursive: true, force: true })
    } catch {
      /* 临时目录清不掉不影响主流程 */
    }
  }
}

/**
 * 回收判定(纯函数,构造面可证)。返回 `{action:'remove'|'tag-then-remove'|'skip', reason}`。
 *
 * 方向一律"宁可少收一个,不可丢一份现场":不在批准落点、形态判不出、locked、脏、
 * 活跃未满阈值、量不到最后活动时间 —— 任一命中即保留。到达"非 locked∧干净∧空闲≥阈值"
 * 这一关后,再按"是否并入 main"分两条零风险出口:
 *  - 已并入 ⇒ `remove`(只删检出,分支归 branch -d 与 §12h 裁决);
 *  - 未并入 ⇒ 默认 `tag-then-remove`(先打 lost-commit 标签保活 commit,再删目录,绝不静默丢现场);
 *    仅当 `tagUnmerged=false`(保守 `--no-tag-lost` 模式)才退回 `skip`。
 *
 * 2026-11-04 定档(s9 票):命名闸 `wt/*` 已摘 —— 它只表达"这张检出是谁创建的",
 * 不表达任何安全属性,实测让回收腿结构性空转(0 枚候选)。安全实质由后四闸
 * (非 locked ∧ 干净 ∧ 已并入 ∨ 未并入但 tag 保活 ∧ 空闲 ≥ 阈值)表达,一条不弱化;
 * 落点闸扩为"主仓 .worktrees/ 或同盘兄弟检出"(仓外其它盘不进射程)。两类检出分开走:
 *  - detached:无现场归属,删除前必须 HEAD 已证并入(merged 闸即其存在前提),或改打标签;
 *  - 有分支:任意分支名都进射程,回收只删检出、不动分支(分支归 branch -d 与 §12h 裁决)。
 */
export function evaluateReapCandidate({
  path,
  branch = '',
  detached = false,
  locked = false,
  dirty = false,
  merged = false,
  lastActivityMs = 0,
  now = Date.now(),
  minIdleDays = 7,
  root = ROOT,
  worktreesRoot = join(ROOT, '.worktrees'),
  gitDirPath = null,
  tagUnmerged = false,
} = {}) {
  // gitdir 本身(.git 指针指向处)永不进射程:删它会毁仓。
  if (gitDirPath && samePath(path, absoluteFromRoot(root, gitDirPath)))
    return { action: 'skip', reason: 'gitdir 本身不进射程' }
  if (!isReapLocationApproved(path, root, worktreesRoot))
    return { action: 'skip', reason: '不在批准落点(.worktrees/ 或主仓同盘兄弟检出;仓外落点不扩)' }
  // 身份形态闸(替代旧命名闸):detached 与有分支两类之外判不出形态 ⇒ 保守保留。
  // 此闸不表达安全属性、只表达"这张检出归谁/是什么",故不再按分支名收口。
  if (!detached && !branch)
    return { action: 'skip', reason: '既无分支也未标注 detached(形态判不出,保守保留)' }
  if (locked) return { action: 'skip', reason: 'worktree 被 lock' }
  if (dirty) return { action: 'skip', reason: '工作区有未提交/未跟踪改动(保留现场)' }
  // 空闲闸:量不到活动时间 / 未满阈值 ⇒ 保留(给在途会话留出窗口,避免误删当天在用工件)。
  if (!Number.isFinite(lastActivityMs) || lastActivityMs <= 0)
    return { action: 'skip', reason: '量不到最后活动时间(保守保留)' }
  const idleDays = (now - lastActivityMs) / 86_400_000
  if (idleDays < minIdleDays)
    return { action: 'skip', reason: `最近活动 ${idleDays.toFixed(1)} 天 < 阈值 ${minIdleDays} 天` }
  // 到达此处:非 locked、干净、空闲 ≥ 阈值。安全实质一致(都不丢现场),按并入状态分两出口。
  if (!merged) {
    if (!tagUnmerged)
      return {
        action: 'skip',
        reason: detached
          ? 'detached 的 HEAD 未证并入 main(保守 --no-tag-lost:不加标签不删;改去掉该标志即走打标签保活再删)'
          : 'HEAD 未并入 main(保守 --no-tag-lost:不加标签不删;改去掉该标志即走打标签保活再删)',
      }
    return {
      action: 'tag-then-remove',
      reason: detached
        ? `detached 无现场归属、HEAD 未证并入 main 但干净空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天 ⇒ 先打 lost-commit 标签保活再删(零丢现场)`
        : `干净空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天但 HEAD 未并入 main ⇒ 先打 lost-commit 标签保活再删(零丢现场,分支 ${branch} 保留归 §12h)`,
    }
  }
  return {
    action: 'remove',
    reason: detached
      ? `detached 无现场归属且 HEAD 已证并入 main,空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天`
      : `干净且已并入 main,空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天(只删检出,分支 ${branch} 保留归 §12h 裁决)`,
  }
}

/* ─────────────── 孤儿目录壳清扫(2026-11-11) ─────────────── */

/**
 * 本仓检出特征:同盘兄弟目录必须三件全有才可能是"曾经的检出"。
 * 实测 `IHUI-AI-backups`(34 项) / `-keys`(6 项) / `-git-repo`(39 项) 三件全无,
 * 而 `IHUI-AI-merge-wt` 三件全有 —— 这一闸把备份、密钥、gitdir 一起挡在射程外。
 */
export const CHECKOUT_MARKERS = ['package.json', 'pnpm-workspace.yaml', 'README.md']
/** 墓碑名 `${原名}.stale-<毫秒戳>`,与 `scripts/lib/scratch-dir.mjs` 的 rmScratch 同族命名。 */
export const ORPHAN_TOMBSTONE_RE = /\.stale-(\d{10,})$/
/**
 * 设计上常驻、不归本腿回收的专用槽位。
 * mobile-auto = `IHUI-Mobile-AutoRelease` 计划任务的 `$Worktree` 默认落点
 *   (scripts/mobile-auto-release.ps1),每小时 reset --hard 复用;删它会打断发版。
 * derived-heal = guardian 派生自愈腿每 30 分钟复用的临时槽位
 *   (scripts/heal-derived-in-checkout.mjs:73);建/摘窗口内同样无 .git、可能不在登记面,
 *   不保护会与 guardian 的 `worktree add` 抢同一路径(2026-11-11 代码审查 B2)。
 */
export const PROTECTED_ORPHAN_SLOTS = new Set(['mobile-auto', 'derived-heal'])
/**
 * 已知常驻兄弟目录白名单(2026-11-11 代码审查 I3):三件套是正向启发式,分不清
 * "曾经的检出"与"检出的完整备份/拷贝"。名字已确定的常驻目录显式钉死,不靠启发式赌。
 */
export const PROTECTED_ORPHAN_SIBLINGS = new Set([
  'IHUI-AI-backups',
  'IHUI-AI-keys',
  'IHUI-AI-git-repo',
])

/** Windows 盘符大小写不敏感:统一 resolve + 斜杠归一 + 小写后再比(代码审查 M1)。 */
export function samePath(a, b) {
  const norm = (p) => resolve(String(p)).replace(/\\/g, '/').toLowerCase()
  return norm(a) === norm(b)
}

export const tombstonePathOf = (path, nowMs = Date.now()) => `${path}.stale-${nowMs}`

export function hasCheckoutMarkersOf(path) {
  return CHECKOUT_MARKERS.every((f) => existsSync(join(path, f)))
}

/**
 * 孤儿目录壳判据(纯函数,self-test 可证)。返回 `{action:'tombstone'|'remove'|'skip', reason}`。
 *
 * 方向同 evaluateReapCandidate:宁可少收一个,不可丢一份现场。闸序:
 *   普通目录 ∧ 非链接 → 不是 gitdir/主树 → 批准落点 → 不在登记面 → 非常驻槽位/兄弟白名单
 *   → **墓碑按死亡戳判龄(提前)** → 无 .git 指针 → 兄弟须带检出三件套 → 首次发现按 mtime 判空闲
 * 墓碑分支必须排在两道启发式闸之前:否则墓碑观察期内只要丢一个特征文件就 skip 而不再判龄,
 * 会永久滞留(代码审查 M3)。首次命中只给 tombstone(同盘改名,可逆、零数据丢失);
 * 只有墓碑观察期满、或 `explicitPurge`(人显式点名已裁决)才给 remove。
 */
export function evaluateOrphanDir({
  path,
  registeredPaths = [],
  gitDirPath = null,
  root = ROOT,
  worktreesRoot = WT_DIR,
  dirMtimeMs = 0,
  hasGitPointer = false,
  isDirectory = true,
  isSymlink = false,
  hasCheckoutMarkers = true,
  now = Date.now(),
  minIdleDays = 1,
  graceDays = 1,
  explicitPurge = false,
} = {}) {
  if (!isDirectory || isSymlink)
    return { action: 'skip', reason: '非普通目录或为链接/挂载点(不进射程)' }
  // gitDirPath 可能是 git 返回的相对 `.git` ⇒ 以 root 为基准归一(代码审查 I3)。
  const gitDirAbs = gitDirPath ? absoluteFromRoot(root, gitDirPath) : null
  if (samePath(path, root) || (gitDirAbs && samePath(path, gitDirAbs)))
    return { action: 'skip', reason: '主工作树 / gitdir 本身绝不进射程' }
  if (!isReapLocationApproved(path, root, worktreesRoot))
    return { action: 'skip', reason: '不在批准落点' }
  if (registeredPaths.some((r) => samePath(r, path)))
    return { action: 'skip', reason: '仍在 git worktree list 登记面(归正常回收腿)' }
  const inWorktreesRoot = isUnderDir(path, worktreesRoot)
  const name = basename(path)
  if (inWorktreesRoot && PROTECTED_ORPHAN_SLOTS.has(name))
    return { action: 'skip', reason: '设计上常驻的专用槽位(计划任务在用)' }
  if (!inWorktreesRoot && PROTECTED_ORPHAN_SIBLINGS.has(name))
    return { action: 'skip', reason: '已知常驻兄弟目录(备份/密钥/gitdir 白名单)' }

  const m = ORPHAN_TOMBSTONE_RE.exec(name)
  if (m) {
    const stampMs = Number(m[1])
    if (!Number.isFinite(stampMs) || stampMs <= 0)
      return { action: 'skip', reason: '墓碑死亡戳不可解析(保守保留)' }
    const ageDays = (now - stampMs) / 86_400_000
    if (ageDays < graceDays)
      return {
        action: 'skip',
        reason: `墓碑观察期 ${ageDays.toFixed(1)} 天 < ${graceDays} 天(可逆窗口内不删)`,
      }
    return { action: 'remove', reason: `墓碑观察期已满 ${ageDays.toFixed(1)} 天 ⇒ 真删` }
  }
  if (hasGitPointer)
    return { action: 'skip', reason: '目录仍带 .git 指针(可能是有效检出或他仓)' }
  if (!inWorktreesRoot && !hasCheckoutMarkers)
    return { action: 'skip', reason: '兄弟目录不含本仓检出特征(备份/密钥/凭据一律保留)' }
  if (!Number.isFinite(dirMtimeMs) || dirMtimeMs <= 0)
    return { action: 'skip', reason: '量不到目录 mtime(保守保留)' }
  const idleDays = (now - dirMtimeMs) / 86_400_000
  if (idleDays < minIdleDays)
    return { action: 'skip', reason: `目录最近活动 ${idleDays.toFixed(1)} 天 < ${minIdleDays} 天` }
  if (explicitPurge)
    return {
      action: 'remove',
      reason: `人显式点名、现场已裁决(空闲 ${idleDays.toFixed(1)} 天)⇒ 跳过墓碑直接真删`,
    }
  return {
    action: 'tombstone',
    reason: `登记面外的目录壳,空闲 ${idleDays.toFixed(1)} 天 ≥ ${minIdleDays} 天 ⇒ 先改名墓碑(可逆)`,
  }
}

/** 扫描两个批准落点下的一层子目录;读不到就返回空,不猜(§0.3)。 */
export function listCandidateOrphanDirs({ root = ROOT, worktreesRoot = WT_DIR } = {}) {
  const out = []
  const pushDirs = (parent, filter = null) => {
    let entries = []
    try {
      entries = readdirSync(parent, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue
      const p = join(parent, e.name)
      if (filter && !filter(e.name)) continue
      out.push(p)
    }
  }
  // ① 仓内 .worktrees/:按 §12h 落点定义,每个子目录都可能是检出(含墓碑)。
  pushDirs(worktreesRoot)
  // ② 同盘同级兄弟检出:只收 `<主仓名>-*` 前缀的普通目录,其余(其它项目/系统目录)不碰。
  const rp = resolve(root)
  const prefix = `${basename(rp)}-`
  pushDirs(dirname(rp), (name) => name.startsWith(prefix))
  return out
}

/**
 * 跨进程互斥(2026-11-11 代码审查 I4):guardian 24h 轮次、人工 `--reap --apply`、或两路守护
 * 可能同时进孤儿腿。A 改名墓碑后 B 的 renameSync 抛 ENOENT 会被计成 failed;A 真删后 B 对
 * 已不存在的目录走 robocopy /MIR 还会新建空目录再虚报 purged+1 —— 数据不丢,但调度层日志失真。
 * 锁放 tmpdir(不污染工作树),`openSync(...,'wx')` 独占创建保证原子;超 30 分钟视为进程被杀的死锁。
 */
function orphanLockPathOf(root) {
  const key = resolve(root).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(-80)
  return join(tmpdir(), `ihui-orphan-reap-${key}.lock`)
}

function acquireOrphanLock(root) {
  const lock = orphanLockPathOf(root)
  try {
    if (Date.now() - statSync(lock).mtimeMs > 30 * 60_000) unlinkSync(lock)
  } catch {
    /* 锁不存在/刚被清掉:继续抢 */
  }
  let fd = null
  try {
    fd = openSync(lock, 'wx')
  } catch (e) {
    if (e?.code === 'EEXIST')
      return { ok: false, err: `另一进程持有锁 ${basename(lock)}(本轮跳过,不误报失败)` }
    return { ok: false, err: String(e?.message ?? e) }
  } finally {
    if (fd !== null) closeSync(fd)
  }
  return { ok: true, path: lock }
}

function releaseOrphanLock(lock) {
  try {
    unlinkSync(lock)
  } catch {
    /* 已被清掉也无妨 */
  }
}

/**
 * 孤儿目录壳清扫动作层。返回
 * `{ tombstoned, purged, failed, skipped, plannedTombstone, plannedPurge, lines }`。
 * 默认 dry-run 只报数(计划数走 planned*,**不混进"已删"计数**,代码审查 M2);apply 时
 * 「首次发现 ⇒ 改名墓碑」「墓碑期满 ⇒ robustRemoveWorktreeDir」。
 */
export function reapOrphanDirs({
  root = ROOT,
  worktreesRoot = WT_DIR,
  gitDirPath = null,
  registeredPaths = [],
  now = Date.now(),
  minIdleDays = 1,
  graceDays = 1,
  apply = false,
} = {}) {
  const out = {
    tombstoned: 0,
    purged: 0,
    failed: 0,
    skipped: 0,
    plannedTombstone: 0,
    plannedPurge: 0,
    lines: [],
  }
  const lock = apply ? acquireOrphanLock(root) : null
  if (lock && !lock.ok) {
    out.lines.push(`ℹ 孤儿腿本轮跳过:${lock.err}`)
    return out
  }
  try {
    for (const path of listCandidateOrphanDirs({ root, worktreesRoot })) {
      let st = null
      try {
        st = lstatSync(path)
      } catch {
        continue
      }
      const verdict = evaluateOrphanDir({
        path,
        registeredPaths,
        gitDirPath,
        root,
        worktreesRoot,
        dirMtimeMs: st.mtimeMs,
        hasGitPointer: existsSync(join(path, '.git')),
        isDirectory: st.isDirectory(),
        isSymlink: st.isSymbolicLink(),
        hasCheckoutMarkers: hasCheckoutMarkersOf(path),
        now,
        minIdleDays,
        graceDays,
      })
      if (verdict.action === 'skip') {
        out.skipped += 1
        continue
      }
      if (!apply) {
        if (verdict.action === 'tombstone') out.plannedTombstone += 1
        else out.plannedPurge += 1
        out.lines.push(`ℹ 孤儿目录壳 dry-run:${path} ⇒ ${verdict.action}(${verdict.reason})`)
        continue
      }
      if (verdict.action === 'tombstone') {
        const dst = tombstonePathOf(path, now)
        try {
          // I4:并发下 A 已改名 ⇒ B 这里目录已不在,属"已被处理"而非失败。
          if (!existsSync(path)) {
            out.skipped += 1
            out.lines.push(`ℹ 孤儿目录壳已被并发处理(改名时不在):${basename(path)}`)
            continue
          }
          renameSync(path, dst)
          out.tombstoned += 1
          out.lines.push(
            `🪦 孤儿目录壳改名墓碑:${basename(path)} → ${basename(dst)}(可逆;观察 ${graceDays} 天后真删)`,
          )
        } catch (e) {
          if (e?.code === 'ENOENT') {
            out.skipped += 1
            out.lines.push(`ℹ 孤儿目录壳改名撞并发(ENOENT),视为已处理:${basename(path)}`)
            continue
          }
          out.failed += 1
          out.lines.push(`❌ 孤儿目录壳改名失败 ${path}:${String(e?.message ?? e).slice(0, 160)}`)
        }
        continue
      }
      // I4:真删前二次复核 —— 并发进程可能已删;否则 robocopy /MIR 会新建空目录再虚报回收。
      if (!existsSync(path)) {
        out.skipped += 1
        out.lines.push(`ℹ 孤儿墓碑已被并发清理:${basename(path)}`)
        continue
      }
      const rm = robustRemoveWorktreeDir(path)
      if (rm.ok) {
        out.purged += 1
        out.lines.push(`🗑 孤儿目录壳已真删:${basename(path)}(墓碑观察期满)`)
      } else {
        out.failed += 1
        out.lines.push(`❌ 孤儿目录壳删除失败 ${path}:${rm.err.slice(0, 160)}`)
      }
    }
  } finally {
    if (lock?.ok) releaseOrphanLock(lock.path)
  }
  return out
}

function git(args, { root = ROOT, input = null } = {}) {
  // G-927 迁移批(2026-10-25):裸 spawnSync('git') 改走 face-reader 取材层 gitRaw
  // (绝对路径 git + quotepath=false + safe.directory + timeout + EBUSY 兜底)。
  // gitRaw 非零即抛 Undetermined(带 status),这里折回调用方的 {ok,status,out,err} 三态,
  // 行为面与旧实现逐字段等值(out 含 stdout,status 透传,err 取异常消息)。
  try {
    return { ok: true, status: 0, out: gitRaw(args, root, { input: input ?? undefined }), err: '' }
  } catch (e) {
    return {
      ok: false,
      status: typeof e?.status === 'number' ? e.status : 1,
      out: '',
      err: String(e?.message ?? e),
    }
  }
}

function mtimeMsOf(p) {
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}

/**
 * 最后活动时间:只取**巡检不会污染**的信号 —— 工作树目录自身 mtime、`.git` 指针文件 mtime、
 * 以及 HEAD 提交时间(`git log -1 --format=%ct`,scanner 从不改写 HEAD)。
 *
 * 2026-11-11 根治:旧实现还纳入了 gitdir 的 admin 目录(`D:/IHUI-AI-git-repo/worktrees/<名>`)
 * 及其 index/HEAD 文件 mtime,但这些会被守护巡检自身的 `git worktree list` / `git status`
 * (刷新 index) / `git worktree prune` 反复改写,导致"最后活动时间"永远≈今天、`idle≈0`,
 * 进而让空闲闸 `idleDays < 阈值` 恒成立 ⇒ 一切候选被跳过、回收器结构性空转(即本次遗留积压的
 * 第二道根因)。去掉 admin 目录及其 index/HEAD,改用 HEAD 提交时间作主信号,idle 才真实。
 * (配合 dirty 闸:凡有未提交/未跟踪改动一律保留,故"干净且 HEAD 旧"即可安全判为闲置。)
 */
function lastActivityMsOf(path) {
  let ts = 0
  const push = (ms) => {
    if (Number.isFinite(ms) && ms > ts) ts = ms
  }
  push(mtimeMsOf(path))
  push(mtimeMsOf(join(path, '.git')))
  const last = git(['log', '-1', '--format=%ct'], { root: path })
  if (last.ok) push(Number(last.out.trim()) * 1000)
  return ts
}

/** 工作区是否脏(含未跟踪);量不到按脏处理,保留现场。 */
function isDirty(path) {
  const r = git(['status', '--porcelain'], { root: path })
  return !r.ok || r.out.trim().length > 0
}

function selfTest() {
  let checks = 0
  const assert = (c, m) => {
    checks += 1
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  assert(normalizeName('Land 20261025') === 'land-20261025', '名字规范化')
  assert(normalizeName('  Wt-01 ') === 'wt-01', '去空白与保留连字符')
  let threw = false
  try {
    normalizeName('!!!')
  } catch {
    threw = true
  }
  assert(threw, '全非法字符应抛')
  const p = worktreePathOf('abc', '/repo')
  assert(p.replace(/\\/g, '/') === '/repo/.worktrees/wt-abc', `落点应在根直属 .worktrees:${p}`)
  assert(branchOf('abc') === 'wt/abc', '分支名')
  assert(
    lostTagOf('abc', '0123456789abcdef') === 'lost-commit/worktree-abc-0123456',
    '保活标签截 7 位',
  )
  const rows = parseWorktreeList(
    [
      'worktree D:/IHUI-AI-git-repo',
      'HEAD c05ca0d5000e',
      'branch refs/heads/main',
      '',
      'worktree D:/IHUI-AI/.worktrees/wt-x',
      'HEAD abc123',
      'branch refs/heads/wt/x',
      '',
    ].join('\n'),
  )
  assert(
    rows.length === 2 && rows[0].branch === 'main' && rows[1].branch === 'wt/x',
    'porcelain 解析',
  )
  assert(basename(rows[1].path) === 'wt-x', '路径 basename')
  const marked = parseWorktreeList(
    [
      'worktree G:/IHUI-AI/.worktrees/wt-y',
      'HEAD def456',
      'branch refs/heads/wt/y',
      'locked needs review',
      '',
      'worktree G:/gone/wt-z',
      'HEAD 789abc',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n'),
  )
  assert(marked[0].locked === 'needs review' && marked[0].prunable === false, 'locked 行解析')
  assert(marked[1].detached === true && marked[1].prunable === true, 'detached/prunable 行解析')

  const base = { path: '/repo/.worktrees/wt-a', branch: 'wt/a', merged: true, lastActivityMs: 1 }
  const now = 1 + 30 * 86_400_000
  assert(
    evaluateReapCandidate({ ...base, now, worktreesRoot: '/repo/.worktrees' }).action === 'remove',
    '干净+已并入+超龄 ⇒ 回收',
  )
  assert(
    evaluateReapCandidate({ ...base, branch: 'feature/x', now, worktreesRoot: '/repo/.worktrees' })
      .action === 'remove',
    '非 wt/* 分支名不再被命名闸拦(2026-11-04 定档)',
  )
  assert(
    evaluateReapCandidate({
      ...base,
      branch: '',
      detached: true,
      now,
      worktreesRoot: '/repo/.worktrees',
    }).action === 'remove',
    'detached 且已证并入 ⇒ 回收',
  )
  assert(
    evaluateReapCandidate({
      ...base,
      branch: '',
      detached: true,
      merged: false,
      now,
      worktreesRoot: '/repo/.worktrees',
    }).action === 'skip',
    'detached 未证并入必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, branch: '', now, worktreesRoot: '/repo/.worktrees' })
      .action === 'skip',
    '形态判不出(无分支且非 detached)必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, locked: true, now, worktreesRoot: '/repo/.worktrees' })
      .action === 'skip',
    'locked 必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, dirty: true, now, worktreesRoot: '/repo/.worktrees' })
      .action === 'skip',
    '脏工作区必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, merged: false, now, worktreesRoot: '/repo/.worktrees' })
      .action === 'skip',
    '独有 HEAD 必须保留',
  )
  assert(
    evaluateReapCandidate({
      ...base,
      path: '/elsewhere/wt-a',
      now,
      worktreesRoot: '/repo/.worktrees',
    }).action === 'skip',
    '批准落点之外必须保留',
  )
  assert(
    evaluateReapCandidate({ ...base, now, minIdleDays: 31, worktreesRoot: '/repo/.worktrees' })
      .action === 'skip',
    '活跃未满阈值必须保留',
  )
  // 2026-11-11 根治:根层兄弟检出(.worktrees/ 之外、与主仓同盘、以 `<主仓名>-` 起头)应进回收射程
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-wt-x',
      branch: 'wt/x',
      merged: true,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
    }).action === 'remove',
    '根层兄弟检出应进回收射程(根治:覆盖 .worktrees/ 之外)',
  )
  // gitdir 本身绝不进射程(即使同名前缀匹配也排除)
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-git-repo',
      merged: true,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
    }).action === 'skip',
    'gitdir 本身不进射程',
  )
  // 2026-11-11 根治:未并入但干净+空闲的检出,默认走 tag-then-remove(先打标签保活再删,零丢现场)
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-wt-orphan',
      detached: true,
      merged: false,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
      tagUnmerged: true,
    }).action === 'tag-then-remove',
    '未并入+干净+空闲 ⇒ tag-then-remove(根治:覆盖改写历史遗留)',
  )
  // 保守模式(--no-tag-lost)下未并入一律保留,向后兼容
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-wt-orphan',
      detached: true,
      merged: false,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
      tagUnmerged: false,
    }).action === 'skip',
    '保守 --no-tag-lost:未并入一律保留',
  )
  // 脏工作区优先于 tag-then-remove(即使未并入也不删,保住未提交改动)
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-wt-orphan',
      detached: true,
      dirty: true,
      merged: false,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
      tagUnmerged: true,
    }).action === 'skip',
    '脏工作区优先跳过(tag-then-remove 不覆盖脏闸)',
  )
  // 未达空闲阈值也不删
  assert(
    evaluateReapCandidate({
      path: '/repo/IHUI-AI-wt-orphan',
      detached: true,
      merged: false,
      lastActivityMs: now - 5 * 86_400_000,
      now,
      minIdleDays: 31,
      root: '/repo/IHUI-AI',
      worktreesRoot: '/repo/IHUI-AI/.worktrees',
      gitDirPath: '/repo/IHUI-AI-git-repo',
      tagUnmerged: true,
    }).action === 'skip',
    '未达空闲阈值:tag-then-remove 也不触发',
  )
  // ─── 孤儿目录壳判据(2026-11-11):每一道安全闸都要有反向断言 ───
  const OB = {
    root: '/repo/IHUI-AI',
    worktreesRoot: '/repo/IHUI-AI/.worktrees',
    gitDirPath: '/repo/IHUI-AI-git-repo',
    now: 1 + 30 * 86_400_000,
    minIdleDays: 1,
    graceDays: 1,
  }
  const orphan = {
    ...OB,
    path: '/repo/IHUI-AI-merge-wt',
    dirMtimeMs: 1,
    hasCheckoutMarkers: true,
    registeredPaths: [],
    hasGitPointer: false,
  }
  assert(
    evaluateOrphanDir(orphan).action === 'tombstone',
    '登记面外的检出目录壳 ⇒ 先改名墓碑(可逆,不直接删)',
  )
  assert(
    evaluateOrphanDir({ ...orphan, registeredPaths: ['/repo/IHUI-AI-merge-wt'] }).action === 'skip',
    '仍在 worktree list 登记面 ⇒ 归正常回收腿,孤儿腿不碰',
  )
  assert(
    evaluateOrphanDir({ ...orphan, path: '/repo/IHUI-AI-git-repo' }).action === 'skip',
    'gitdir 本身绝不进孤儿射程',
  )
  assert(
    evaluateOrphanDir({ ...orphan, path: '/repo/IHUI-AI' }).action === 'skip',
    '主工作树绝不进孤儿射程',
  )
  assert(
    evaluateOrphanDir({ ...orphan, path: '/elsewhere/IHUI-AI-wt-x' }).action === 'skip',
    '批准落点之外必须保留',
  )
  assert(
    evaluateOrphanDir({ ...orphan, hasGitPointer: true }).action === 'skip',
    '仍带 .git 指针 ⇒ 可能是有效检出或他仓,保留',
  )
  assert(
    evaluateOrphanDir({ ...orphan, isSymlink: true }).action === 'skip',
    '链接/挂载点不进射程',
  )
  assert(
    evaluateOrphanDir({ ...orphan, isDirectory: false }).action === 'skip',
    '非目录不进射程',
  )
  assert(
    evaluateOrphanDir({ ...orphan, hasCheckoutMarkers: false }).action === 'skip',
    '兄弟目录无本仓检出三件套 ⇒ 备份/密钥/凭据目录一律保留',
  )
  assert(
    evaluateOrphanDir({
      ...orphan,
      path: '/repo/IHUI-AI/.worktrees/mobile-auto',
      hasCheckoutMarkers: false,
    }).action === 'skip',
    '常驻专用槽位(每小时发版用)一律保留',
  )
  assert(
    evaluateOrphanDir({ ...orphan, dirMtimeMs: OB.now - 3_600_000 }).action === 'skip',
    '目录最近活动未满空闲阈值 ⇒ 保留',
  )
  assert(
    evaluateOrphanDir({ ...orphan, dirMtimeMs: 0 }).action === 'skip',
    '量不到 mtime ⇒ 保守保留',
  )
  const oldTomb = `/repo/IHUI-AI-merge-wt.stale-${OB.now - 2 * 86_400_000}`
  const freshTomb = `/repo/IHUI-AI-merge-wt.stale-${OB.now - 3_600_000}`
  assert(
    evaluateOrphanDir({ ...orphan, path: oldTomb }).action === 'remove',
    '墓碑观察期满 ⇒ 真删',
  )
  assert(
    evaluateOrphanDir({ ...orphan, path: freshTomb }).action === 'skip',
    '墓碑观察期未满 ⇒ 可逆窗口内不删',
  )
  assert(
    /\.stale-\d{10,}$/.test(tombstonePathOf('/repo/IHUI-AI-merge-wt', OB.now)),
    '墓碑名带可解析毫秒死亡戳',
  )
  assert(
    evaluateOrphanDir({
      ...orphan,
      path: '/repo/IHUI-AI/.worktrees/wt-empty',
      hasCheckoutMarkers: false,
    }).action === 'tombstone',
    '仓内 .worktrees/ 下的空壳不受兄弟目录三件套闸限制',
  )
  // ─── 2026-11-11 第二轮代码审查修复的自证钉子(B2/I3/M1/M3/I2) ───
  assert(samePath('D:/repo/IHUI-AI', 'd:/repo/IHUI-AI'), 'Windows 盘符大小写混写须认作同路径')
  assert(!samePath('D:/repo/IHUI-AI', 'D:/repo/IHUI-AI-x'), '不同路径不得误判同形')
  assert(
    evaluateReapCandidate({
      path: 'd:/repo/IHUI-AI-git-repo',
      gitDirPath: 'D:/repo/IHUI-AI-git-repo',
      root: 'D:/repo/IHUI-AI',
      branch: 'wt/x',
      merged: true,
      lastActivityMs: 1,
      now,
      minIdleDays: 0,
      worktreesRoot: 'D:/repo/IHUI-AI/.worktrees',
    }).action === 'skip',
    '正常回收腿的 gitdir 排除闸也须统一路径大小写口径(M1)',
  )
  assert(
    absoluteFromRoot('/repo/IHUI-AI', '.git') === resolve('/repo/IHUI-AI', '.git') &&
      absoluteFromRoot('/repo/IHUI-AI', '.git') !== '.git',
    '相对 gitdir 以 root 为基准(不得按 cwd 解析;期望值走平台自己的 resolve)',
  )
  assert(
    absoluteFromRoot('/repo/IHUI-AI', '/repo/gd') === '/repo/gd',
    '绝对 gitdir 不得被拼进 root',
  )
  assert(
    absoluteFromRoot('/repo/IHUI-AI', 'D:/gd') === 'D:/gd',
    '盘符绝对路径须认作绝对',
  )
  assert(PROTECTED_ORPHAN_SLOTS.has('derived-heal'), 'guardian 复用槽位须在保护集合(B2)')
  assert(
    evaluateOrphanDir({
      ...orphan,
      path: '/repo/IHUI-AI/.worktrees/derived-heal',
      hasCheckoutMarkers: false,
    }).action === 'skip',
    'derived-heal 空壳不得进射程(B2)',
  )
  assert(PROTECTED_ORPHAN_SIBLINGS.has('IHUI-AI-backups'), '常驻兄弟目录须有白名单(I3)')
  assert(
    evaluateOrphanDir({ ...orphan, path: '/repo/IHUI-AI-backups', hasCheckoutMarkers: true })
      .action === 'skip',
    '带三件套的常驻备份目录仍不得判成孤儿(I3)',
  )
  assert(
    evaluateOrphanDir({
      ...orphan,
      path: `/repo/IHUI-AI-merge-wt.stale-${OB.now - 2 * 86_400_000}`,
      hasCheckoutMarkers: false,
      hasGitPointer: true,
    }).action === 'remove',
    '墓碑分支必须早于两道启发式闸,丢了特征文件也不永久滞留(M3)',
  )
  const purgeVerdict = evaluateOrphanDir({ ...orphan, explicitPurge: true })
  assert(purgeVerdict.action === 'remove', '人显式点名 ⇒ 跳过墓碑直接真删(I2)')
  assert(/显式点名/.test(purgeVerdict.reason), '显式裁决档的结论必须可自证(I2)')
  assert(
    evaluateOrphanDir({ ...orphan, explicitPurge: true, registeredPaths: [orphan.path] }).action ===
      'skip',
    '显式点名也不得越过任何安全闸(I2)',
  )
  console.log(`self-test: 全绿(${checks} 组断言)`)
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  const apply = has('--apply')

  if (has('--list')) {
    const r = git(['worktree', 'list', '--porcelain'])
    if (!r.ok) {
      console.error(`❌ 未判定:git worktree list 失败(${r.err.trim()})`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const rows = parseWorktreeList(r.out)
    if (has('--json')) console.log(JSON.stringify(rows, null, 2))
    else
      for (const w of rows)
        console.log(
          `${w.sha.slice(0, 10)}  ${w.branch || '(detached)'}  ${w.path}` +
            `${w.locked ? '  [locked]' : ''}${w.prunable ? '  [prunable]' : ''}`,
        )
    return
  }

  if (has('--reap')) {
    const minIdle = Number(val('--older-than', '1'))
    if (!Number.isFinite(minIdle) || minIdle < 0) {
      console.error(`❌ --older-than 需要非负天数,收到 ${val('--older-than', '')}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const list = git(['worktree', 'list', '--porcelain'])
    if (!list.ok) {
      console.error(`❌ 未判定:git worktree list 失败(${list.err.trim()})`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const now = Date.now()
    const gitDir = git(['rev-parse', '--git-dir']).out.trim()
    // 2026-11-11 I1:登记面在孤儿腿前会重取一次(见下方 fresh),此处不再缓存过期快照。
    const rows = []
    for (const w of parseWorktreeList(list.out)) {
      if (resolve(w.path) === resolve(ROOT)) continue
      if (resolve(w.path) === resolve(gitDir)) continue
      const dirty = isDirty(w.path)
      const merged = git(['merge-base', '--is-ancestor', w.sha, 'main']).ok
      const lastActivityMs = lastActivityMsOf(w.path)
      const verdict = evaluateReapCandidate({
        path: w.path,
        branch: w.branch,
        detached: w.detached,
        locked: !!w.locked,
        dirty,
        merged,
        lastActivityMs,
        now,
        minIdleDays: minIdle,
        worktreesRoot: WT_DIR,
        gitDirPath: gitDir,
        tagUnmerged: !has('--no-tag-lost'),
      })
      // 四闸读数逐条打印(2026-11-04 s9 票):让"为什么没收"可核,不再只有一句 reason。
      const idle =
        Number.isFinite(lastActivityMs) && lastActivityMs > 0
          ? `${((now - lastActivityMs) / 86_400_000).toFixed(1)}d`
          : '量不到'
      const gates = `locked=${w.locked ? 'Y' : 'N'} dirty=${dirty ? 'Y' : 'N'} merged=${merged ? 'Y' : 'N'} idle=${idle}`
      rows.push({ ...w, ...verdict, gates })
    }
    const doomed = rows.filter((r) => r.action === 'remove' || r.action === 'tag-then-remove')
    const tagCount = rows.filter((r) => r.action === 'tag-then-remove').length
    for (const r of rows) {
      const mark = r.action === 'remove' ? '🗑' : r.action === 'tag-then-remove' ? '🏷🗑' : '⏭'
      console.log(
        `${mark} ${r.path} [${r.branch || (r.detached ? '(detached)' : '(无分支)')}] ${r.gates} ⇒ ${r.reason}`,
      )
    }
    let removed = 0
    let tagged = 0
    let failed = 0
    // 2026-11-11:原实现在 0 候选 / dry-run 时直接 return ⇒ 后面的孤儿腿永远跑不到,
    // 这是"元数据已注销的目录壳常年留盘"的最后一格。改为不早退:dry-run 时让循环空转。
    // 2026-11-11 代码审查 M2:dry-run 结论统一放到末尾打印,不再在这里先报一次、
    // 末尾又因 removed=0 报一次「无回收候选」(双结论互相矛盾)。
    for (const r of apply ? doomed : []) {
      if (r.action === 'tag-then-remove') {
        const wtName = basename(r.path)
        const tag = lostTagOf(wtName, r.sha)
        // 标签可能已存在(上次 --apply 被中断,标签已打但目录未删):已指向同一 sha 即视为已保活,
        // 直接继续删目录,不再因"标签已存在"而跳过删除(否则会留下永远删不掉的残留)。
        const existing = git(['rev-parse', '-q', '--verify', tag])
        if (existing.ok && existing.out.trim() === r.sha) {
          console.log(`🏷 保活标签 ${tag} 已存在(指向同 sha ${r.sha.slice(0, 10)}),跳过重复打标;即将删目录`)
        } else {
          const t = git(['tag', tag, r.sha])
          if (!t.ok) {
            console.error(`❌ 打保活标签失败 ${tag}:${t.err.trim()} ⇒ 跳过(保住工作,不删)`)
            failed += 1
            continue
          }
          console.log(`🏷 已打保活标签 ${tag}(HEAD ${r.sha.slice(0, 10)});即将删目录`)
        }
        tagged += 1
      }
      const rm = robustRemoveWorktreeDir(r.path)
      if (!rm.ok) {
        console.error(`❌ 回收失败 ${r.path}:${rm.err}(先按 §12h 裁决现场)`)
        failed += 1
        continue
      }
      // 2026-11-04 定档(s9 票):自动回收只删检出,绝不自动删分支。
      // 分支存续归 `git branch -d` 与 §12h 合并裁决 —— 回收器结构上碰不到它。
      removed += 1
      if (r.branch && r.action === 'remove')
        console.log(`🏷 检出已回收;分支 ${r.branch} 保留(删除走 git branch -d 与 §12h 裁决)`)
    }
    if (apply) git(['worktree', 'prune'])

    // ─── 孤儿目录壳清扫腿:与正常回收共用同一次 --reap 派发,调度层零改动 ───
    const graceEnv = Number(process.env.IHUI_WORKTREE_ORPHAN_GRACE_DAYS || 1)
    const graceDays = Number.isFinite(graceEnv) && graceEnv >= 0 ? graceEnv : 1
    // 2026-11-11 代码审查 I1:正常回收腿的 robocopy 可跑数分钟,期间 guardian 会新建/注销
    // 检出;孤儿腿若复用开头的登记面快照,会把在途检出误判成孤儿。这里必须重取一次。
    const fresh = git(['worktree', 'list', '--porcelain'])
    let orphan
    if (!fresh.ok) {
      // 读不到登记面 ⇒ 本轮干脆不扫孤儿(保守),并计入失败让调度层看得见,不静默吞掉。
      orphan = {
        tombstoned: 0,
        purged: 0,
        failed: 1,
        skipped: 0,
        plannedTombstone: 0,
        plannedPurge: 0,
        lines: [
          `❌ 孤儿腿本轮未扫:刷新登记面失败(${fresh.err.trim().slice(0, 120)})⇒ 保守保留全部目录壳`,
        ],
      }
    } else {
      orphan = reapOrphanDirs({
        root: ROOT,
        worktreesRoot: WT_DIR,
        gitDirPath: gitDir,
        registeredPaths: parseWorktreeList(fresh.out).map((w) => w.path),
        now,
        minIdleDays: minIdle,
        graceDays,
        apply,
      })
    }
    for (const line of orphan.lines) console.log(line)
    removed += orphan.purged
    failed += orphan.failed

    // M2:dry-run 单独一条结论,且计划数只报"将",绝不计入已回收。
    if (!apply) {
      if (doomed.length || orphan.plannedTombstone || orphan.plannedPurge || failed) {
        console.log(
          `ℹ dry-run:将回收 ${doomed.length} 个检出(其中 ${tagCount} 个先打 lost-commit 标签保活再删);孤儿目录壳将打墓碑 ${orphan.plannedTombstone} 枚 / 观察期满真删 ${orphan.plannedPurge} 枚(加 --apply 执行)`,
        )
      } else {
        // 这句同时是调度层 parseReapReport 的 judged 凭据,格式不可改。
        console.log(
          `ℹ 无回收候选(${rows.length} 个检出全数保留;阈值 ${minIdle} 天;孤儿目录壳:跳过 ${orphan.skipped} 枚)`,
        )
      }
      return
    }
    // 2026-11-11 代码审查 B1:旧出口是 `if (!removed)`,当"有候选但全删失败"时
    // removed=0 ∧ failed>0 会落到「ℹ 无回收候选」提前 return ⇒ 失败数被吞、退出码不设、
    // parseReapReport 先匹配该行返回 failed:0 ⇒ 调度层写 24h 戳静默不重试。
    // 现改为只有"零回收且零失败"才报无候选,任何失败都必须走带 `,失败 M 个` 的 ✅ 行。
    if (!removed && !failed) {
      console.log(
        `ℹ 无回收候选(${rows.length} 个检出全数保留;阈值 ${minIdle} 天;孤儿目录壳:墓碑 ${orphan.tombstoned} 枚、跳过 ${orphan.skipped} 枚)`,
      )
      return
    }
    console.log(
      `✅ 回收 ${removed} 个${tagged ? `,其中 ${tagged} 个先打 lost-commit 标签保活` : ''}${failed ? `,失败 ${failed} 个` : ''}(已 prune;分支一律保留;孤儿墓碑 ${orphan.tombstoned} 枚 / 真删 ${orphan.purged} 枚)`,
    )
    if (failed) process.exitCode = EXIT_REFUSED
    return
  }

  if (has('--create')) {
    // §12d 停用(2026-11-12 机主定案):本项目禁止用 git worktree 做并行开发隔离(合并收尾成本过高)。
    // 本出口已封死 —— 一律拒绝创建并指向规范。清理与自愈(--reap / --purge-orphan / --remove / --list)不受影响。
    console.error(
      '❌ 拒绝创建:本项目已停用开发用 git worktree(§12d,2026-11-12 机主定案 —— 隔离后仍需合并,收尾成本大于收益)。\n'
        + '   跨会话现场隔离的唯一出路 = `node scripts/isolated-git.mjs`(私有索引 pathspec 级隔离,无需后续合并,§12i);\n'
        + '   或等前席收尾再动同一批文件。历史检出收敛见 §12h(能合即合、不能合先 tag 保活再回收)。',
    )
    process.exitCode = EXIT_REFUSED
    return
  }

  if (has('--remove')) {
    let name
    try {
      name = normalizeName(val('--remove', ''))
    } catch (e) {
      console.error(`❌ ${e.message}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const path = worktreePathOf(name)
    const branch = branchOf(name)
    const list = git(['worktree', 'list', '--porcelain'])
    const entry = list.ok
      ? parseWorktreeList(list.out).find((w) => resolve(w.path) === resolve(path))
      : null
    if (!entry) {
      console.error(`❌ 未找到该检出:${path}`)
      process.exitCode = EXIT_REFUSED
      return
    }
    const merged = git(['merge-base', '--is-ancestor', branch, 'main'])
    const isMerged = merged.ok
    console.log(
      `检出 ${path}(HEAD ${entry.sha.slice(0, 10)},分支 ${branch})已并入 main=${isMerged}`,
    )
    if (!isMerged && !has('--tag-lost')) {
      console.error(
        '❌ 拒绝回收:分支未并入 main。按 §12h 未合并检出不得静默删;确需回收先给 --tag-lost(打保活标签后再删)',
      )
      process.exitCode = EXIT_REFUSED
      return
    }
    if (!apply) {
      console.log(
        `ℹ dry-run:将${isMerged ? '' : `先打标签 ${lostTagOf(name, entry.sha)} 再`}执行 git worktree remove ${path} + git worktree prune`,
      )
      return
    }
    if (!isMerged) {
      const t = git(['tag', lostTagOf(name, entry.sha), entry.sha])
      if (!t.ok) {
        console.error(`❌ 打保活标签失败:${t.err.trim()} ⇒ 不继续删(保住工作)`)
        process.exitCode = EXIT_REFUSED
        return
      }
      console.log(`🏷 已打保活标签 ${lostTagOf(name, entry.sha)}`)
    }
    const rm = robustRemoveWorktreeDir(path)
    if (!rm.ok) {
      console.error(`❌ 回收失败:${rm.err}(有未提交改动时 git 会拒绝——按 §12h 先裁决再收回)`)
      process.exitCode = EXIT_REFUSED
      return
    }
    git(['worktree', 'prune'])
    const del = git(['branch', '-d', branch])
    console.log(
      del.ok
        ? `✅ 已回收 ${path} 并删除已并入分支 ${branch}`
        : `✅ 已回收 ${path};分支 ${branch} 未删(${del.err.trim().split('\n')[0]})`,
    )
    return
  }

  if (has('--purge-orphan')) {
    const raw = val('--purge-orphan', '')
    if (!raw) {
      console.error('❌ --purge-orphan 需要一个目录路径')
      process.exitCode = EXIT_UNKNOWN
      return
    }
    const path = resolve(raw)
    const list = git(['worktree', 'list', '--porcelain'])
    const registeredPaths = list.ok ? parseWorktreeList(list.out).map((w) => w.path) : []
    const gitDir = git(['rev-parse', '--git-dir']).out.trim()
    let st = null
    try {
      st = lstatSync(path)
    } catch {
      console.error(`❌ 路径不存在或读不到:${path}`)
      process.exitCode = EXIT_REFUSED
      return
    }
    // 人显式点名 = 现场已裁决 ⇒ 空闲/观察期两道时间闸归零,其余安全闸一条不弱化。
    // 2026-11-11 代码审查 I2:必须传 explicitPurge 让判据自证"这是人工裁决档",
    // 且只接受 action==='remove';旧实现把 tombstone 也当真删,绕过了两段式可逆窗口。
    const verdict = evaluateOrphanDir({
      path,
      registeredPaths,
      gitDirPath: gitDir,
      root: ROOT,
      worktreesRoot: WT_DIR,
      dirMtimeMs: st.mtimeMs,
      hasGitPointer: existsSync(join(path, '.git')),
      isDirectory: st.isDirectory(),
      isSymlink: st.isSymbolicLink(),
      hasCheckoutMarkers: hasCheckoutMarkersOf(path),
      now: Date.now(),
      minIdleDays: 0,
      graceDays: 0,
      explicitPurge: true,
    })
    if (verdict.action !== 'remove') {
      console.error(
        `❌ 拒绝清理 ${path}:${verdict.action === 'skip' ? verdict.reason : '仅显式裁决档可直删,本路径判据要求先走墓碑观察期'}`,
      )
      process.exitCode = EXIT_REFUSED
      return
    }
    console.log(`待清理 ${path}\n判据 ${verdict.reason}`)
    if (!apply) {
      console.log('ℹ dry-run:未写入。加 --apply 执行')
      return
    }
    const rm = robustRemoveWorktreeDir(path)
    if (!rm.ok) {
      console.error(`❌ 清理失败 ${path}:${rm.err}(现场原样保留)`)
      process.exitCode = EXIT_REFUSED
      return
    }
    git(['worktree', 'prune'])
    console.log(`✅ 已清理孤儿目录壳 ${path}(已 prune)`)
    return
  }

  console.error(
    '用法:--create <名> [--base ref] [--apply] | --list [--json] | --remove <名> [--tag-lost] [--apply] | --reap [--older-than N] [--apply] | --purge-orphan <目录> [--apply] | --self-test',
  )
  process.exitCode = EXIT_UNKNOWN
}

export const __test__ = {
  normalizeName,
  worktreePathOf,
  branchOf,
  lostTagOf,
  parseWorktreeList,
  isUnderDir,
  isUnderWorktreesRoot,
  isReapLocationApproved,
  evaluateReapCandidate,
  evaluateOrphanDir,
  listCandidateOrphanDirs,
  reapOrphanDirs,
  hasCheckoutMarkersOf,
  tombstonePathOf,
  CHECKOUT_MARKERS,
  ORPHAN_TOMBSTONE_RE,
  PROTECTED_ORPHAN_SLOTS,
  PROTECTED_ORPHAN_SIBLINGS,
  samePath,
  orphanLockPathOf,
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
