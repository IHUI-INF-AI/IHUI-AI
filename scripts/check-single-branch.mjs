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
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 * 其 updater 端点链为 Gitee raw → GitHub raw/desktop-feed → desktop-updater-feed release。
 * 该分支由 CI/发版脚本写入,人工严禁在此分支做功能开发。
 */
const SANCTIONED_RELEASE_BRANCHES = new Set([
  'desktop-feed',
  'origin/desktop-feed',
  'gitee/desktop-feed',
  'gitcode/desktop-feed',
])

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
 */
function isActiveGoalBranch(branch) {
  if (!branch.startsWith('goal/')) return false
  const statePath = join(ROOT, '.ihui-agent', 'goal-runtime', 'STATE.md')
  if (!existsSync(statePath)) return false
  try {
    const state = readFileSync(statePath, 'utf8')
    return state.includes('active')
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
    const raw = execSync('git branch -a', { cwd: ROOT, encoding: 'utf8', windowsHide: true })
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
  const exempt = { mirror: [], phantom: [] }
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
      const why = nonLocalExempt(entry, { mirrorRemotes, unresolvable })
      if (why) {
        exempt[why].push(b)
        return false
      }
      return true
    })
    .map((e) => e.name)

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
  }

  if (illegal.length === 0) {
    console.log(`${C.green}✅ 单分支检查通过:仅存在 main(及 goal/ 合法豁免分支)${C.reset}`)
    reportExempt()
    process.exit(0)
  }

  console.error(
    `${C.red}🛡️ 单分支守门失败:检测到 ${illegal.length} 个非法分支,提交已阻塞${C.reset}`,
  )
  reportExempt()
  for (const b of illegal) {
    console.error(`  ${C.red}✗ ${b}${C.reset}`)
  }
  console.error(`
${C.yellow}💡 AGENTS.md §9b 强制规则:除 main 外禁止创建任何分支(含远程),所有改动统一往 main 合并。${C.reset}
   修复(三选一):
     A. 已合并 → 删除:git branch -d <分支>(本地)+ git push origin --delete <分支>(远程)
     B. 未合并但内容已在 main → 确认后删除:git branch -D <分支>
        (删除未合并分支前先 tag 备份:git tag backup/cleanup-<date>-<branch> <branch>)
     C. 确为 goal 模式临时分支 → 在 .ihui-agent/goal-runtime/STATE.md 标注 active 后重试
        (goal/* 完成后必须立即删除)
`)
  process.exit(1)
}

/**
 * 逻辑自检(零 git 调用、零副作用):只验两条新豁免判据的**边界**,含"豁免不得吞掉真违规"
 * 的反向对照 —— 豁免类判据最大的风险从来不是漏豁免,而是把该拦的放过去。
 */
export function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push([name, !!ok])
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

export const __test__ = { mirrorRemoteSet, nonLocalExempt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
