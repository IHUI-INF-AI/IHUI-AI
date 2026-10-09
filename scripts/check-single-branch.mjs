#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本是 CLI 工具,需 console 输出诊断信息 */
/**
 * 单分支开发守门(blocking, 2026-08-02 立,AGENTS.md §9b)。
 *
 * 规则:除 main 之外不允许新建任何本地/远程分支(feat/* / fix/* / hotfix/* /
 * add-* / rescue/* / 自定义前缀全部禁止)。所有改动统一往 main 合并。
 *
 * 唯一豁免:goal 模式临时分支(必须带 goal/ 前缀,且在 .ihui-agent/goal-runtime/STATE.md
 * 标注 active 状态才算合法;goal/* 完成后必须立即删除)。
 *
 * 检测逻辑:
 *   1. git branch -a 列出全部本地 + 远程分支
 *   2. 规范化:去掉当前分支星号、remotes/ 前缀
 *   3. 白名单:main / origin/main / upstream/main / gitee/main(镜像远程)/ HEAD
 *   4. 已 checkout 在 linked worktree 的分支豁免(AGENTS.md §12d sanctioned 并行隔离,非 feature 分支)
 *   4. 剩余分支逐一判定:
 *      - goal/* 前缀 → 检查 .ihui-agent/goal-runtime/STATE.md 是否标注 active → 合法豁免
 *      - 其他 → 违规,exit 1 阻塞 commit + push
 *
 * 退出码: 0 = 通过 / 1 = 检测到非法分支,阻塞
 * 集成位置: scripts/guardian-runner.mjs id 41(blocking)
 *
 * 2026-09-24 两处判据改正(都是"红得没有处置对象"那一类):
 *   ① 镜像远端(除 origin/upstream 外的一切:gitee / gitcode / gh …)下的分支**不判,但如实报数**。
 *      §9b 禁的是"工作分支",而 AGENTS §5b 明令本机不直推 Gitee/GitCode(交 mirror-to-cn.yml
 *      CI 收敛)⇒ 这些引用在本机既不该建也不该删,判红只会把一个无人能在此处置的状态
 *      变成全局阻塞(实测 `gh/main` 因不在硬编码白名单而被判成非法分支)。
 *   ② **不可解析的远程跟踪引用(幻影)不判,但如实报数**。§5b 实测宿主清理层会删
 *      depth≥2 的 `refs/remotes/<remote>/*`,而 `git-refs-heal` / packed-refs 又会把它按
 *      旧清单重建 ⇒ 幻影会**反复回来**;对它 `git branch -d` 根本执行不了,判红等于无解死循环。
 *      取证:本机 `git ls-remote --heads origin` 服务端只有 `refs/heads/main`,而
 *      `git branch -a` 报出 `origin/batch-58` / `origin/feat/relay-sell-productization`
 *      —— `git rev-parse --verify` 两条均失败,即"3 个非法分支"里 0 个是真分支。
 *   ③ ROOT 由脚本自身位置推导:原 `process.cwd()` 在 pnpm 切 cwd 下会让 `git branch -a`
 *      直接失败 → 走 catch 打一行警告后**恒绿**(与守门 70 的 ROOT 教训同型,静默失效)。
 *
 * 2026-10-09 补 ② 的**孪生空档**(同一型故障的另一种形态,本机实测烧掉当天每一枚提交):
 *   ④ **远端已无此分支、本机跟踪引用还留着(stale)⇒ 不判,但如实报数**。② 认的是"sha 取不到",
 *      而这一型的 sha **完全可解析**(对象还在本机,常还有远端 backup tag 指着它),所以 ② 结构上
 *      认不出它。实测 `origin/wip/collect-2026-09-30`:`git ls-remote origin 'refs/heads/wip/*'`
 *      零命中(远端早在 10-02 前就被删过,并留了三枚 `backup/cleanup-*-wip-collect` tag),而
 *      `refs/remotes/origin/wip/collect-2026-09-30` 仍在 `packed-refs` 里(8286 行)⇒ 本门每次提交
 *      判红,而它当时给的出路是 `git push origin --delete <分支>`,**对一条远端不存在的分支必然失败**
 *      —— 无解的恒红挂在全队每次提交上,结局就是各会话 `--no-verify`,连带链上全部守门对每次提交作废
 *      (§12e/§12f 同型;当天 safe-commit 的归因层如实写着"HEAD 面亦红 ⇒ 存量/机器态,非本次引入")。
 *      唯一正解是 §9b 那句"fetch + prune 是日常"。两条设计约束:**只在本来要判红时才联网问远端**
 *      (happy path 不派进程、不联网 —— 这道门挂在每次提交上);**问不到就一律不豁免**(失效方向是多拦)。
 */
import { execFileSync, execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 合法分支白名单(本地 main + 远程 main:origin/upstream/gitee/gitcode 镜像;gitee/gitcode 为项目 sanctioned 镜像远程,main 即 main) */
const ALLOWED = new Set([
  'main',
  'origin/main',
  'upstream/main',
  'gitee/main',
  'gitcode/main',
  'HEAD',
])

/**
 * sanctioned 发布产物分支(非开发分支,不违反单分支原则)。
 *
 * desktop-feed(2026-09-17 立):桌面端 updater feed 的"真源分支"——GitHub 侧
 * desktop-feed 分支承载 latest.json feed,Gitee/GitCode 镜像自动携带。属发布管线
 * 数据通道,非功能开发分支;见 commit 359a782d3be(desktop-feed 真源化 GitHub),
 * 其 updater 端点自 2026-10-05 定稿为单端点 https://aizhs.top/desktop-feed.json,
 * 原 desktop-updater-feed release 兜底端点已删除(数据链仍为 Gitee raw → GitHub raw/desktop-feed)。
 * 该分支由 CI/发版脚本写入,人工严禁在此分支做功能开发。
 */
const SANCTIONED_RELEASE_BRANCHES = new Set([
  'desktop-feed',
  'origin/desktop-feed',
  'gitee/desktop-feed',
  'gitcode/desktop-feed',
])

/**
 * §9b 的现行前提已变:2026-09-27 起 main 开启分支保护(直推被 GH006 拒),每个代理的改动
 * **必须**经"分支 + PR"入库 —— 审计建议原文即「每个 AI 代理用独立分支走 PR」。所以本门要防的
 * 不再是"存在旁支",而是"旁支长期滞留"。两类豁免,都只报数不判红:
 *  - in-flight:分支尖端提交时刻距今 ≤ GRACE_HOURS(默认 48,`IHUI_SINGLE_BRANCH_GRACE_HOURS`
 *    可调)的分支,即"正在路上"的 PR 工作分支;超窗回到判据(合并或删除)。
 *  - backup:`backup/` 与 `ihui-backup/` 前缀(含其 `origin/` 镜像)。§5b 明令禁止删除/清理备份
 *    gitdir 与现场归档,§22 要求备份引用本地+远端双留 —— 门喊"删掉它"等于替人犯 §5b 的禁令。
 * 取不到提交时刻 ⇒ **不豁免**(宁误拦,不静默放行;与本门镜像豁免同取向)。
 */
const GRACE_HOURS_DEFAULT = 48
const graceHours = (() => {
  const raw = process.env.IHUI_SINGLE_BRANCH_GRACE_HOURS
  if (raw === undefined || raw === '') return GRACE_HOURS_DEFAULT
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : GRACE_HOURS_DEFAULT
})()

export const BACKUP_REF_PREFIXES = ['backup/', 'ihui-backup/']

/** `for-each-ref` 的 "短名 unix时刻" 输出 → Map(短名 → 提交秒);坏行跳过不猜 */
export function branchTipTimes(raw) {
  const map = new Map()
  for (const line of String(raw ?? '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    const sp = s.lastIndexOf(' ')
    if (sp <= 0) continue
    const name = s.slice(0, sp)
    const ct = Number(s.slice(sp + 1))
    if (name && Number.isFinite(ct) && ct > 0) map.set(name, ct)
  }
  return map
}

/**
 * 在飞/备份豁免判定(纯函数,供 self-test 与镜像测试直接喂构造面)。
 * @returns {'in-flight'|'backup'|null} null = 不豁免,回到原判据
 */
export function inFlightExempt(name, tipTimes, nowMs, grace) {
  const bare = name.startsWith('origin/') ? name.slice('origin/'.length) : name
  if (BACKUP_REF_PREFIXES.some((p) => bare.startsWith(p))) return 'backup'
  const ct = tipTimes.get(name)
  if (ct === undefined || !Number.isFinite(nowMs)) return null
  // ct 是**秒**(for-each-ref 的 committerdate:unix),nowMs 是**毫秒** —— 换算必须先对齐单位。
  // 除数写成 3600000 而分子是秒差,会把年龄算小 1000 倍:48h 的窗口实际等于 ~5.5 年,
  // 于是"超窗仍判"这一整条反向判据在生产面上永不触发(而 self-test 当时一路报绿,
  // 因为 t() 收的是布尔而所有用例传的是函数 —— 见 selfTest 里那条修复)。
  return (nowMs - ct * 1000) / 3600000 <= grace ? 'in-flight' : null
}

/**
 * origin/HEAD -> origin/main 是 git 符号引用输出,非真实分支,需跳过。
 * 但 AGENTS.md §5b 的嵌套 ref 自愈会把 refs/remotes/<remote>/HEAD 固化进 packed-refs,
 * git pack-refs 将符号引用摊平为普通 sha ref → `git branch -a` 输出无 `->` 的 `origin/HEAD`,
 * 只按箭头判定会漏(实测:本机 origin/HEAD 已摊平,symbolic-ref 返回非 0)。
 */
function isSymbolicRef(branch) {
  return branch.includes('->') || /(^|\/)HEAD$/.test(branch)
}

/**
 * goal 模式豁免判定:分支必须以 goal/ 开头,且 .ihui-agent/goal-runtime/STATE.md
 * 标注 active(AGENTS.md §9b 豁免条款)。
 * 2026-09-28:内容改走取材层唯一出口 `readWorktreeFile`(守门 118 的 face 判据)。这份 STATE.md 是
 * **机器态**(gitignored 的目标运行目录,不在任何被审面上),所以读磁盘面本身是对的;约束在于
 * 读取动作只许有那一份实现 —— 取不到(null)与读失败(抛 Undetermined)一律按"不豁免"处理,
 * 失效方向是多拦,不是放行。
 */
function isActiveGoalBranch(branch) {
  if (!branch.startsWith('goal/')) return false
  try {
    const state = readWorktreeFile(ROOT, '.ihui-agent/goal-runtime/STATE.md')
    return typeof state === 'string' && state.includes('active')
  } catch {
    return false
  }
}

/**
 * 排除已 checkout 在 linked worktree 中的分支(AGENTS.md §12d sanctioned 并行隔离机制)。
 * worktree 的 branch 是 agent/并行会话的"工作上下文",不是 §9b 要防范的 feature 分支;
 * 其唯一性由 worktree 本身保证,不应在单分支守门中被误判为非法分支。
 * 主 worktree 的 main 已在 ALLOWED 中,这里额外排除 linked worktree 的 checkout 分支。
 */
function getWorktreeBranches() {
  try {
    const raw = execSync('git worktree list --porcelain', {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    const set = new Set()
    for (const line of raw.split('\n')) {
      const m = line.match(/^branch refs\/heads\/(.+)$/)
      if (m) set.add(m[1])
    }
    return set
  } catch {
    return new Set()
  }
}

/** `git remote` 输出 → 镜像远端集合(排除 origin 与历史别名 upstream) */
export function mirrorRemoteSet(raw) {
  return new Set(
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== 'origin' && s !== 'upstream'),
  )
}

/**
 * 纯判据:某条 `git branch -a` 条目是否属"本机不可处置"的两类豁免。
 * `entry.remote` 必须来自 `remotes/` **原文前缀**而非 for-each-ref 的成员判断 ——
 * 指向缺失对象的幻影 ref 会被 `git for-each-ref` **直接跳过**(实测 `origin/batch-58`
 * 出现在 branch -a 却不在 for-each-ref),用后者当 memberships 会让本豁免整体空转,
 * 这正是"改了判据但没生效"的形态。
 */
export function nonLocalExempt(entry, { mirrorRemotes, unresolvable }) {
  if (!entry || !entry.remote) return null // 本地分支永远要判
  const b = entry.name
  const slash = b.indexOf('/')
  if (slash < 0) return null
  const remote = b.slice(0, slash)
  if (remote === 'origin' || remote === 'upstream') {
    return unresolvable.has(b) ? 'phantom' : null // origin 上的真分支仍是要判的违规
  }
  return mirrorRemotes.has(remote) ? 'mirror' : unresolvable.has(b) ? 'phantom' : null
}

/**
 * `git ls-remote --heads origin` 原文 → 远端真实分支短名集合(纯解析,可被镜像测试直接喂)。
 * 一行形如 `<sha>\trefs/heads/<name>`;非 refs/heads/ 行(如带 tag)一律丢掉 —— 拿 tag 当分支
 * 会让"这条分支远端还在"得出假肯定,而那方向是**多判红**,不是放行。
 */
export function remoteHeadNames(raw) {
  const out = new Set()
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const ref = line.slice(tab + 1).trim()
    if (!ref.startsWith('refs/heads/')) continue
    const name = ref.slice('refs/heads/'.length)
    if (!name) continue // `refs/heads/`(空段)不是分支:收进来会让"远端有这条"的判定多一个幽灵成员
    out.add(name)
  }
  return out
}

/**
 * 纯判据(2026-10-09 新增第三类豁免 `stale`):**本机还挂着、远端已经没有的那条远程跟踪引用**。
 * 它和 phantom 的区别是关键:phantom 是 sha 取不到(对象没了),stale 的 sha **完全可解析**,
 * 因为内容还在本机对象库里 —— 远端分支早被删过(常常是另一台机/另一路会话删的,而
 * `git push origin --delete` 只清发起方的本地跟踪 ref),于是本机的 `packed-refs` 一直留着一条
 * 指向"确实存在但上游已无"的对象的引用。本门的旧修复提示教的是
 * `git push origin --delete <分支>`,对这一型**必然失败**(远端没有它),于是这条红无解 ——
 * 而它红在每一枚提交上,结局就是各会话 `--no-verify`,连带链上全部守门对每次提交作废(§12e/§12f)。
 * 失效方向刻意是"多判红":remoteQueryable=false(取不到远端清单)或该分支真在远端 ⇒ 一律 null。
 */
export function staleExempt(name, { remoteHeads, remoteQueryable } = {}) {
  if (!remoteQueryable || !(remoteHeads instanceof Set)) return null // 没问到真值 ⇒ 不据此豁免
  if (typeof name !== 'string') return null
  const rest = name.startsWith('origin/')
    ? name.slice('origin/'.length)
    : name.startsWith('upstream/')
      ? name.slice('upstream/'.length) // origin 的历史别名(§9b),问的是同一个上游
      : null
  if (rest === null) return null // 本地分支永远判;镜像远端由 mirror 那一档管
  return remoteHeads.has(rest) ? null : 'stale'
}

/**
 * 问一次远端真值(§5b:git ls-remote 为远端真值唯一来源)。**只在"本来要判红"那条路径上调用**,
 * 所以 happy path 一个进程都不多派、不联网 —— 这道门挂在每次提交上,给它加一次网络往返就是把
 * 全队的提交拖慢(§12e 的成本口径同门 195 那条)。
 */
function probeRemoteHeads() {
  try {
    const raw = execFileSync('git', ['-C', ROOT, 'ls-remote', '--heads', 'origin'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // 一条 refs/heads 都没有 ⇒ 网络半通 / 空仓 / 输出形态解不出,三种都不配当"远端没这些分支"的证据
    if (!/\trefs\/heads\//.test(raw)) {
      return { heads: new Set(), queryable: false, reason: '远端清单里没有任何 refs/heads 行' }
    }
    return { heads: remoteHeadNames(raw), queryable: true, reason: '' }
  } catch (e) {
    return { heads: new Set(), queryable: false, reason: (e && e.message) || 'ls-remote 派生失败' }
  }
}

/** sha 不可解析的远程跟踪引用(§5b 宿主清 nested ref 后的幻影)。 */
function unresolvableSet(names) {
  const bad = new Set()
  for (const b of names) {
    try {
      // execFileSync + argv 而非拼 shell 串:分支名可含元字符,插进字符串即注入面
      execFileSync('git', ['-C', ROOT, 'rev-parse', '--verify', `refs/remotes/${b}^{commit}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
        timeout: 5000,
      })
    } catch {
      bad.add(b)
    }
  }
  return bad
}

function listBranches() {
  try {
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const raw = execSync('git branch -a', { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    return (
      raw
        .split('\n')
        .map((line) => line.trim().replace(/^[*+]\s*/, ''))
        .filter(Boolean)
        // 2026-09-13:detached HEAD 是本仓 sanctioned 的 worktree 提交姿态(AGENTS.md §12d),
        // `git branch -a` 在 detached 状态会输出 `(HEAD detached at <sha>)` / `(no branch)`
        // 这类伪条目——它们不是分支,不应被判为"非法分支"而阻塞 worktree 提交。
        .filter((line) => !line.startsWith('('))
        // 先留 `remote` 标记再剥前缀:幻影 ref 在 for-each-ref 里不可见,只能靠这里认。
        .map((line) => ({
          name: line.replace(/^remotes\//, ''),
          remote: line.startsWith('remotes/'),
        }))
    )
  } catch {
    console.error(`${C.yellow}⚠️ git branch -a 执行失败,跳过单分支检查${C.reset}`)
    return []
  }
}

function main() {
  const branches = listBranches()
  const worktreeBranches = getWorktreeBranches()
  /** 远端清单取不到时按空集 ⇒ 不豁免任何镜像引用(宁误拦,不静默放行) */
  let mirrorRemotes = new Set()
  try {
    mirrorRemotes = mirrorRemoteSet(
      execFileSync('git', ['-C', ROOT, 'remote'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'pipe']
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      }),
    )
  } catch {
    console.error(`${C.yellow}⚠️ git remote 取不到,镜像远端不豁免${C.reset}`)
  }
  const remoteRefs = branches.filter((e) => e.remote).map((e) => e.name)
  const unresolvable = unresolvableSet(remoteRefs)
  if (process.env.IHUI_SINGLE_BRANCH_DEBUG === '1') {
    console.error(
      `[debug] entries=${branches.length} remote=${remoteRefs.join(',')} ` +
        `mirrors=${[...mirrorRemotes].join(',')} unresolvable=${[...unresolvable].join(',')}`,
    )
  }
  const exempt = { mirror: [], phantom: [], 'in-flight': [], backup: [], stale: [] }
  /** 分支尖端提交时刻(一次 for-each-ref,不逐个起进程);取不到 ⇒ 空表 ⇒ 在飞豁免整段失效并如实喊出 */
  let tipTimes = new Map()
  let tipTimesOk = true
  try {
    tipTimes = branchTipTimes(
      execFileSync(
        'git',
        [
          '-C',
          ROOT,
          'for-each-ref',
          '--format=%(refname:short) %(committerdate:unix)',
          'refs/heads',
          'refs/remotes',
        ],
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    )
  } catch {
    tipTimesOk = false
  }
  const nowMs = Date.now()
  const illegal = branches
    .filter((entry) => {
      const b = entry.name
      if (ALLOWED.has(b) || isSymbolicRef(b) || isActiveGoalBranch(b)) return false
      if (SANCTIONED_RELEASE_BRANCHES.has(b)) return false
      if (worktreeBranches.has(b)) return false
      // 2026-09-16:worktree 分支的远程镜像豁免。sanctioned worktree 会话(AGENTS.md §12d)
      // push 备份后产生的 origin/<branch> 远程跟踪引用,是该 worktree 工作上下文的镜像,
      // 与本地分支同等豁免,不应被误判为 §9b 禁止的 feature 分支(否则并行会话互相阻塞)。
      if (b.startsWith('origin/') && worktreeBranches.has(b.slice('origin/'.length))) return false
      // 2026-09-28:main 受保护 ⇒ 分支 + PR 是唯一入库通道,在飞窗口内的分支不判红;
      // 备份引用(backup/ 与 ihui-backup/)永不判红 —— §5b 明令禁止删除它们。
      const flight = inFlightExempt(b, tipTimes, nowMs, graceHours)
      if (flight) {
        exempt[flight].push(b)
        return false
      }
      const why = nonLocalExempt(entry, { mirrorRemotes, unresolvable })
      if (why) {
        exempt[why].push(b)
        return false
      }
      return true
    })
    .map((e) => e.name)

  /**
   * 第三类豁免的落点:只在"已经有候选红"时才联网(2026-10-09)。
   * 这里补的是 phantom 的**反向**空档 —— phantom 认的是 sha 取不到,而"远端删了分支、本机跟踪
   * 引用还留着"那条 ref 的 sha 完全解析得出(内容仍在对象库),于是它被当合法违规判红,而本门给的
   * 出路(`git push origin --delete <分支>`)对一条远端根本不存在的分支**必然失败** ⇒ 无解的恒红,
   * 而它挂在每次提交上(§12f:一道红在干净 HEAD 上的门 = 全队合法跳门 = 链上全部守门作废)。
   * 失效方向:远端清单问不到 / 问到了但那是空清单 ⇒ 一律不豁免,照旧判红(宁误拦,不静默放行)。
   */
  let illegalFinal = illegal
  if (illegal.length && illegal.some((b) => b.startsWith('origin/') || b.startsWith('upstream/'))) {
    const { heads, queryable, reason } = probeRemoteHeads()
    if (!queryable) {
      console.error(
        `${C.yellow}⚠️ 远端分支清单取不到(${reason})⇒ "远端已无此分支"这一豁免本轮整体失效,` +
          `候选旁支按原判据计红(失效方向是多拦,不是放行)${C.reset}`,
      )
    } else {
      illegalFinal = []
      for (const b of illegal) {
        if (staleExempt(b, { remoteHeads: heads, remoteQueryable: true }) === 'stale') {
          exempt.stale.push(b)
        } else illegalFinal.push(b)
      }
    }
  }
  const illegalList = illegalFinal

  /** 豁免面必须可见:只豁免不报数,和漏判不可区分(门 79/80 同取向) */
  function reportExempt() {
    if (exempt.mirror.length) {
      console.log(
        `${C.dim}ℹ️ 不判但如实报数:${exempt.mirror.length} 个镜像远端引用(${exempt.mirror.join(', ')})` +
          ` —— §5b 本机不直推 Gitee/GitCode/gh,交 mirror-to-cn.yml CI 收敛${C.reset}`,
      )
    }
    if (exempt.phantom.length) {
      console.log(
        `${C.dim}ℹ️ 不判但如实报数:${exempt.phantom.length} 个幻影远程跟踪引用(${exempt.phantom.join(', ')})` +
          ` —— sha 不可解析(§5b:宿主清 depth≥2 的 refs/remotes/**,而 refs-heal 会按旧清单重建,` +
          `prune 只是治标)${C.reset}`,
      )
    }
    if (exempt.stale.length) {
      console.log(
        `${C.dim}ℹ️ 不判但如实报数:${exempt.stale.length} 个"远端已无此分支"的陈旧远程跟踪引用` +
          `(${exempt.stale.join(', ')}) —— sha 仍可解析(内容还在本机对象库),所以 phantom 那一档认不出它;` +
          `唯一正解是 git fetch origin --prune(§9b「fetch + prune 是日常」),不是 push --delete${C.reset}`,
      )
    }
    if (!tipTimesOk) {
      console.log(
        `${C.yellow}⚠️ 提交时刻取不到(for-each-ref 失败)⇒ 在飞窗口豁免本轮整体失效,` +
          `所有旁支按原判据计红(失效方向是多拦,不是放行)${C.reset}`,
      )
    }
    if (exempt['in-flight'].length) {
      console.log(
        `${C.dim}ℹ️ 不判但如实报数:${exempt['in-flight'].length} 个在飞分支(≤${graceHours}h,` +
          `main 受保护 ⇒ 走分支+PR 入库)—— 超窗必须合并或删除:${exempt['in-flight'].join(', ')}${C.reset}`,
      )
    }
    if (exempt.backup.length) {
      console.log(
        `${C.dim}ℹ️ 不判但如实报数:${exempt.backup.length} 个备份引用(§5b 禁删/§22 要求双留,` +
          `本门不得喊人删它们):${exempt.backup.join(', ')}${C.reset}`,
      )
    }
  }

  if (illegalList.length === 0) {
    console.log(`${C.green}✅ 单分支检查通过:仅存在 main(及 goal/ 合法豁免分支)${C.reset}`)
    reportExempt()
    process.exit(0)
  }

  console.error(
    `${C.red}🛡️ 单分支守门失败:检测到 ${illegalList.length} 个非法分支,提交已阻塞${C.reset}`,
  )
  reportExempt()
  for (const b of illegalList) {
    console.error(`  ${C.red}✗ ${b}${C.reset}`)
  }
  console.error(`
${C.yellow}💡 AGENTS.md §9b(2026-09-28 口径):main 已受分支保护,改动经"分支 + PR"入库;本门只拦**超在飞窗口(${graceHours}h)仍滞留**的旁支。${C.reset}
   修复(四选一):
     A. 已合并 → 删除:git branch -d <分支>(本地)+ git push origin --delete <分支>(远程)
     B. 未合并但内容已在 main → 确认后删除:git branch -D <分支>
        (删除未合并分支前先 tag 备份:git tag backup/cleanup-<date>-<branch> <branch>)
     C. 确为 goal 模式临时分支 → 在 .ihui-agent/goal-runtime/STATE.md 标注 active 后重试
        (goal/* 完成后必须立即删除)
     D. 远端其实已经没有这条分支(上面「不判但如实报数」把它列过,或因取不到远端清单而没能豁免)
        → 那是本机的陈旧远程跟踪引用,唯一正解是:git fetch origin --prune
        ⚠️ 对它跑 A 里的 push --delete 必然失败(远端没有它),别按 A 试。
`)
  process.exit(1)
}

/**
 * 逻辑自检(零 git 调用、零副作用):只验两条新豁免判据的**边界**,含"豁免不得吞掉真违规"
 * 的反向对照 —— 豁免类判据最大的风险从来不是漏豁免,而是把该拦的放过去。
 */
export function selfTest() {
  const cases = []
  /**
   * 用例登记。历史上这里只写 `!!ok`,而**所有**用例传的都是箭头函数 ⇒ `!!(() => …)` 恒真,
   * 13 条自测整体变成"永远绿的断言"(与恒红同样有害:它让读报告的人以为这一维被看守过)。
   * 现同时接受两种形态:函数(求值一次)与布尔值(直接用);函数抛错按"该条失败"计并打印原因,
   * 不让一条坏用例把整轮 self-test 炸成未捕获异常。
   */
  const t = (name, ok) => {
    let verdict = false
    try {
      verdict = typeof ok === 'function' ? Boolean(ok()) : Boolean(ok)
    } catch (e) {
      verdict = false
      name = `${name}(用例抛错:${e && e.message ? e.message : e})`
    }
    cases.push([name, verdict])
  }
  const mirrors = mirrorRemoteSet('gitee\ngitcode\norigin\nupstream\ngh\n')
  const e = (name, remote = true) => ({ name, remote })
  const ctx = (over = {}) => ({ mirrorRemotes: mirrors, unresolvable: new Set(), ...over })

  t('remote 清单:origin/upstream 不当镜像,gitee/gitcode/gh 算镜像', () => {
    return (
      mirrors.has('gitee') &&
      mirrors.has('gh') &&
      !mirrors.has('origin') &&
      !mirrors.has('upstream')
    )
  })
  t('镜像远端引用豁免为 mirror(含未配进 git remote 的 gh)', () => {
    return (
      nonLocalExempt(e('gitee/desktop-feed'), ctx()) === 'mirror' &&
      nonLocalExempt(e('gh/main'), ctx()) === 'mirror'
    )
  })
  t('幻影 origin 引用豁免为 phantom', () => {
    return (
      nonLocalExempt(e('origin/batch-58'), ctx({ unresolvable: new Set(['origin/batch-58']) })) ===
      'phantom'
    )
  })
  t('反向对照:可解析的 origin 分支仍要判(豁免不得吞真违规)', () => {
    return nonLocalExempt(e('origin/batch-58'), ctx()) === null
  })
  t('反向对照:本地分支永远判(即便名字含斜杠、sha 恰好不可解析)', () => {
    return nonLocalExempt(e('feat/x', false), ctx({ unresolvable: new Set(['feat/x']) })) === null
  })
  t('反向对照:remote 标记只能来自 branch -a 前缀(幻影不在 for-each-ref 里)', () => {
    return (
      nonLocalExempt({ name: 'origin/ghost' }, ctx({ unresolvable: new Set(['origin/ghost']) })) ===
      null
    )
  })
  t('反向对照:未配进 git remote 的第三类远端且可解析 → 仍判(宁误拦)', () => {
    return nonLocalExempt(e('zzz/work'), ctx({ mirrorRemotes: new Set() })) === null
  })
  // ---- 2026-10-09 新增第三类豁免 stale:本机挂着、远端已无的远程跟踪引用(sha 仍可解析,
  //      所以 phantom 那一档结构上认不出它)。四条各有分工:正例认得出来 / 真在远端必须仍判 /
  //      没问到远端清单必须不豁免 / ls-remote 文本里 tag 行不得被读成"分支还在"。
  const heads = remoteHeadNames(
    [
      'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678\trefs/heads/main',
      'b74ad5a64b2351da23dee3f649d1c41c8fa65c69\trefs/heads/wip/collect-2026-09-30',
      'cecaca00\trefs/tags/backup/cleanup-20261002-wip-collect',
      '',
    ].join('\n'),
  )
  t('stale:ls-remote 文本解析只吃 refs/heads/ 行(tag 行不得算分支)', () => {
    return (
      heads.has('main') &&
      heads.has('wip/collect-2026-09-30') &&
      ![...heads].some((x) => x.includes('tags/')) &&
      heads.size === 2
    )
  })
  t('stale 正例:origin/<名字> 而远端没有该名 ⇒ 判 stale(这才是不用 push --delete 的那一型)', () => {
    return (
      staleExempt('origin/wip/gone-over-there', { remoteHeads: heads, remoteQueryable: true }) ===
        'stale' &&
      // origin 的历史别名 upstream 问的是同一个上游
      staleExempt('upstream/wip/gone-over-there', { remoteHeads: heads, remoteQueryable: true }) ===
        'stale'
    )
  })
  t('反向对照:远端真有的分支必须仍判(豁免不得吞掉§9b 要拦的那种滞留旁支)', () => {
    return (
      staleExempt('origin/wip/collect-2026-09-30', {
        remoteHeads: heads,
        remoteQueryable: true,
      }) === null && staleExempt('origin/main', { remoteHeads: heads, remoteQueryable: true }) === null
    )
  })
  t('反向对照:远端清单问不到 ⇒ 一律不豁免(失效方向是多拦,绝不静默放行)', () => {
    const notQueryable = { remoteHeads: new Set(), remoteQueryable: false }
    return (
      staleExempt('origin/wip/collect-2026-09-30', notQueryable) === null &&
      staleExempt('origin/whatever', notQueryable) === null &&
      // 集合本身没给 / 给了非 Set 同样不豁免(不得把"判据输入坏了"读成"全都豁免")
      staleExempt('origin/whatever', { remoteQueryable: true }) === null &&
      staleExempt('origin/whatever', { remoteHeads: ['main'], remoteQueryable: true }) === null
    )
  })
  t('反向对照:本地分支与镜像远端不归 stale 这一档(归本地判 / 归 mirror 档)', () => {
    const q = { remoteHeads: heads, remoteQueryable: true }
    return (
      staleExempt('feat/local-thing', q) === null &&
      staleExempt('wip/no-slash-name', q) === null &&
      staleExempt('gitee/desktop-feed', q) === null
    )
  })
  // ---- 2026-09-28 新增:在飞窗口 + 备份引用。豁免类判据最大的风险是"把该拦的放过去",
  //      所以每条正例都配一条反向对照(超窗仍判 / 取不到时刻不豁免 / backup 不看时刻)。
  const HOUR = 3600000
  const now = 1_800_000_000_000
  const tips = branchTipTimes(
    [
      `ci-fix/fresh ${Math.floor((now - 5 * HOUR) / 1000)}`,
      `origin/ci-fix/fresh ${Math.floor((now - 5 * HOUR) / 1000)}`,
      `stale-old ${Math.floor((now - 200 * HOUR) / 1000)}`,
      'backup/cleanup-2026-09-28-x 1700000000',
      'ihui-backup/main-2026-09-27-r1 1700000000',
      'garbage-line',
      '',
      `broken not-a-number`,
    ].join('\n'),
  )
  t('for-each-ref 解析:好行入表、坏行与空行跳过不猜', () => {
    return (
      tips.size === 5 &&
      tips.get('ci-fix/fresh') === Math.floor((now - 5 * HOUR) / 1000) &&
      !tips.has('garbage-line') &&
      !tips.has('broken')
    )
  })
  t('在飞窗口内的 PR 分支豁免为 in-flight(本地与 origin/ 镜像同视)', () => {
    return (
      inFlightExempt('ci-fix/fresh', tips, now, 48) === 'in-flight' &&
      inFlightExempt('origin/ci-fix/fresh', tips, now, 48) === 'in-flight'
    )
  })
  t('反向对照:超窗仍判(豁免不得变成永久放行)', () => {
    return inFlightExempt('stale-old', tips, now, 48) === null
  })
  t('反向对照:取不到提交时刻不豁免(失效方向是多拦,不是放行)', () => {
    return (
      inFlightExempt('never-listed', tips, now, 48) === null &&
      inFlightExempt('broken', tips, now, 48) === null
    )
  })
  t('备份引用豁免为 backup(§5b 禁删 / §22 双留,含 origin/ 镜像)', () => {
    return (
      inFlightExempt('backup/cleanup-2026-09-28-x', tips, now, 48) === 'backup' &&
      inFlightExempt('origin/ihui-backup/main-2026-09-27-r1', tips, now, 48) === 'backup'
    )
  })
  t('反向对照:backup 判据不看时刻(超龄备份也绝不喊删)', () => {
    return inFlightExempt('backup/ancient', new Map(), now, 0) === 'backup'
  })
  let bad = 0
  for (const [name, ok] of cases) {
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`self-test: ${cases.length - bad}/${cases.length} 通过`)
  return bad ? 1 : 0
}

import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (process.argv.slice(2).includes('--self-test')) process.exit(selfTest())
  main()
}

export const __test__ = {
  mirrorRemoteSet,
  nonLocalExempt,
  branchTipTimes,
  inFlightExempt,
  // 2026-10-09 第三类豁免(stale)的两个纯判据 —— 镜像测试必须调它们,不得在本文件复制一份
  // 解析式/比较式(§22c:复制的那份必然跟着漂,而漂开的表现是"测试绿、判据红着别的形态")。
  remoteHeadNames,
  staleExempt,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
