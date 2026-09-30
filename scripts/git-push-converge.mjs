#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具需 console 输出 */
/**
 * git-push-converge.mjs — 多仓推送状态判定/收敛(2026-09-18 立,#58 收尾事故根治)
 *
 * 定位(AGENTS.md「提交/推送」节 2026-09-18 规则):**只读核验工具 + 应急通道**。
 * 常规推送链完全自动,agent 不得手写 git push:
 *   - origin:post-commit 钩子 git-push-guard.mjs(ahead 检测+推送+回读验证,幂等)
 *   - Gitee/GitCode:mirror-to-cn.yml CI(push 触发+每日 2 次兜底)
 * agent 收尾核验同步状态 = 跑本脚本(默认零推送:ALREADY/SKIP/BEHIND/DIVERGED
 * 均不产生写网络动作);仅在 guard/CI 双失效的应急场景人工推。
 *
 * 背景(两次实锤事故):
 *   post-commit 已由 git-push-guard 自动推 origin,agent 收尾时再手动
 *   `git push origin main` 必然撞上 already-pushed → 非快进报错 → 误判"还没好"
 *   → 后台任务反复盲推+长时间干等(单次 8-13 分钟)。根治原则:**先判定再推,
 *   已同步=跳过;一条命令收敛全部仓,退出码明确**。
 *
 * 行为(对每个 remote 幂等):
 *   1. ls-remote 取远端 main SHA(一次网络往返,不做全量 fetch)
 *   2. 远端 === 本地 HEAD → ALREADY(跳过推送,零网络写)
 *   3. 远端是本地祖先(本地领先) → push(origin 走 guard 同步通道自愈,
 *      2026-09-19;镜像仓直推 600s 上限)
 *   4. 本地是远端祖先(本地落后) → SKIP(远端有并发新提交,由 ff 流程处理,不强推)
 *   5. 分叉 → DIVERGED(不强推,交人工/合并流程;除非 --force-with-lease)
 *   每仓独立超时(默认 180s),单仓网络卡死不拖垮其他仓。
 *
 * 读数诚实性(2026-09-28 立,本文件的那处账面失真):
 *   凡是**依赖 `.workbuddy/push-state.json`** 的结论行(PUSHING / SKIP / DIVERGED / PUSH_FAILED),
 *   下方必须挂一行"依据出处":该记录**关于哪枚提交**(headSha 是否 == 当前 HEAD)、**距今多久**、
 *   以及由这两件事得到的定性(当下量的 / 历史残留 / 未判定)。旧写法把 guard 的输出整个 catch 掉、
 *   又拿几小时前那条记录当结论的注脚,读的人分不清"这是当下量的"还是"历史残留"——实测某次
 *   PUSH_FAILED 报的就是更早一枚提交的记录,而当场没有任何一行证据说明这一点。
 *   出处判据只有一份实现:`scripts/lib/push-attempt-triage.mjs` 的 `pushStateProvenance`
 *   (本脚本与镜像测试同视它;**禁止**在这里再拼一份年龄/相等判断,两处算同一件事必漂移)。
 *   同时 PUSH_FAILED 现在会打印**本次现推**的输出末行;取不到就写"未判定",不留空当"没问题"。
 *
 * 退出码:
 *   0 — 全部仓收敛(推送成功或本已同步或远端领先待 ff)
 *   1 — 存在推送失败或分叉(需人工)
 *
 * 用法:
 *   node scripts/git-push-converge.mjs                         # 默认仅核验 origin(镜像归 CI,见下)
 *   node scripts/git-push-converge.mjs --remotes=origin,gitee  # 显式指定仓(镜像仓仅在应急时使用)
 *   node scripts/git-push-converge.mjs --branch=dev            # 指定分支(默认 main)
 *   node scripts/git-push-converge.mjs --force-with-lease      # 分叉时允许 lease 强推(慎用)
 *
 * ⚠️ 默认 remotes=origin(2026-09-18 收紧):Gitee/GitCode 的同步归 mirror-to-cn.yml CI
 *    (push 触发+每日兜底),本地手推镜像仓违反架构且每次 push 触发仓库级 pre-push
 *    全量 typecheck(数分钟)。核验镜像仓请显式 --remotes=origin,gitee,gitcode。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { pushStateProvenance } from './lib/push-attempt-triage.mjs'

// ─── 参数 ───
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : def
}
const hasFlag = (name) => args.includes(`--${name}`)
const remotes = getArg('remotes', 'origin').split(',').map((s) => s.trim()).filter(Boolean)
const branch = getArg('branch', 'main')
const allowLease = hasFlag('force-with-lease')
const TIMEOUT_MS = Number(getArg('timeout', '180000'))

// ─── git 执行(带超时,失败返回 null) ───
function git(argsArr, { timeout = TIMEOUT_MS } = {}) {
  try {
    return execFileSync('git', argsArr, { encoding: 'utf8', timeout, // 根治:stdin 设 ignore 避开本会话 Node 建子进程 stdin 管道 EBUSY(git 不吃 stdin)
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
  } catch {
    return null
  }
}

/**
 * 需要**回显**的 git / 子进程调用(2026-09-28 加):失败也要把 stdout+stderr 拿回来。
 * 立因:旧 `git()` / `healViaGuard()` 把失败整个 catch 掉只回一个 boolean,于是
 * `PUSH_FAILED` 这一行**没有任何本次的证据**,读的人只剩 push-state 里那条几小时前的
 * 历史读数可以当"真因"——那正是本票要修的账面失真(拿历史读数冒充本次结论)。
 * 取不到文本时如实给空串,调用方必须写"未取到本次输出(未判定)",不得空着当"没问题"。
 */
function gitWithOutput(argsArr, cmd = 'git', { timeout = TIMEOUT_MS, env } = {}) {
  try {
    const r = execFileSync(cmd, argsArr, {
      encoding: 'utf8',
      timeout,
      // 根治:本会话 Node 建子进程 stdin 管道会 EBUSY;本助手不传 input,stdin 设 ignore 安全。
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      ...(env ? { env } : {}),
    })
    return { ok: true, code: 0, text: `${r ?? ''}`.trim() }
  } catch (e) {
    const text = `${e?.stdout ?? ''}\n${e?.stderr ?? ''}`.trim()
    return {
      ok: false,
      code: typeof e?.status === 'number' ? e.status : null,
      text: text || (e?.message ? String(e.message).trim() : ''),
    }
  }
}

/** 取回显尾部 N 行(每行截 200 字符),用于"本次现推到底说了什么"的一行证据。 */
function tailEvidence(text, n = 3) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  return lines
    .slice(-n)
    .map((l) => (l.length > 200 ? `${l.slice(0, 200)}…` : l))
    .join(' / ')
}

const localHead = git(['rev-parse', 'HEAD'])
if (!localHead) {
  console.error('❌ 无法读取本地 HEAD(非 git 仓库?)')
  process.exit(1)
}
console.log(`本地 HEAD: ${localHead.slice(0, 11)} (branch=${branch})`)

// 后台推送状态识别(guard 异步化配套,#58 收尾根治):
// push-state=running 且 headSha=本地 HEAD → 显示 PUSHING,不算失败(后台 worker 正在推)
// push-state 的终态集(2026-09-26 起)是 running | done | failed | diverged:
//   · 本脚本是**只读核验**工具,任何不认识的值都只会被读成"不在途",绝不会被读成"已推成功"
//     (老状态文件里没有 diverged,行为与今天逐字一致 ⇒ 向后兼容);
//   · diverged 必须被点名出来:它是"远端拒收 non-fast-forward"的结论,若只打 DIVERGED
//     而不说 guard 已经判过,读的人还会再去试一趟推送(那正是本次修复要断掉的循环)。
function readPushState() {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), '.workbuddy/push-state.json'), 'utf8'))
  } catch {
    return null
  }
}
const pushState = readPushState()
const pushDiverged = pushState && pushState.status === 'diverged'
/**
 * 这条读数的**出处**(2026-09-28 立):它关于哪枚提交、距今多久、算不算当下量的。
 * 判据住在 lib/push-attempt-triage.mjs 的 `pushStateProvenance`(一份实现,guard/测试/本脚本同视),
 * 本脚本**不得**再自己拼一份年龄/相等判断 —— 两处算同一件事必漂移(AGENTS 记过多次)。
 */
const startProv = pushStateProvenance({ pushState, localHead, now: Date.now() })
/** 结论行下方统一挂一行出处;缩进两格,与既有 `└` 风格一致。 */
function noteEvidence(prov, extra = '') {
  return `         └ 依据出处:${prov.text}${extra}`
}
// 持有者存活探测(worker 被强杀时残留 running,死 pid 不算在途)
function isPushStatePidAlive() {
  if (!pushState?.pid) return false
  try {
    process.kill(Number(pushState.pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
// 在途判定 = running + **当下量的**那条读数 + 持有者存活(worker 被强杀时残留 running,死 pid 不算在途)
// 2026-09-28:原先这里自己写了一遍 `headSha === localHead` 与 `Date.now() - ts < 5min`,
// 而同一件事的判据已经住在 lib 的 `pushStateProvenance` 里 ⇒ 两处必漂移(该常量的值一改动这里就悄悄变宽)。
// 现在只消费 `startProv.state === 'current'`(= 同一枚提交 ∧ 在 5min 窗口内),行为与改动前逐字等价。
const pushInProgress =
  !!pushState &&
  pushState.status === 'running' &&
  startProv.state === 'current' &&
  isPushStatePidAlive()

// 2026-09-19 根治(猝死第三刀):origin 推送统一委托 guard 同步通道。
// GUARD_ASYNC=0 强制 guard 走同步推送(门禁不降级,75 中断重试 + no-verify
// 兜底齐全),600s 上限远超 270s 全量门。
// 2026-09-28 改返回值:boolean → {ok, code, text} —— 旧写法把 guard 的整段回显 catch 掉,
// 于是本脚本失败时**拿不出任何本次证据**,只能让读的人去猜(而猜的人就顺手把 push-state
// 里那条几小时前的历史读数当成本次的真因,这是本票登记的账面失真)。
function healViaGuard() {
  return gitWithOutput(['scripts/git-push-guard.mjs', `--branch=${branch}`], process.execPath, {
    timeout: 600_000,
    // 逐字保留改动前的强制同步档:GUARD_ASYNC=0 让 guard 在本进程里推完再返回,
    // 否则它 spawn 后台 worker 后秒回 exit 0 ⇒ 本脚本会把"什么都没推"报成 PUSHED。
    env: { ...process.env, GUARD_ASYNC: '0', GUARD_WORKER: '' },
  })
}

let hasFailure = false
const results = []

for (const remote of remotes) {
  const label = remote.padEnd(8)
  // 1. 远端 tip(单次 ls-remote,比 fetch 轻得多)
  const remoteTip = git(['ls-remote', remote, `refs/heads/${branch}`])
  if (remoteTip === null) {
    results.push({ remote, status: 'UNREACHABLE' })
    console.log(`${label} ❌ UNREACHABLE(网络/权限)`)
    hasFailure = true
    continue
  }
  const remoteSha = remoteTip.split('\t')[0]
  if (remoteSha === localHead) {
    results.push({ remote, status: 'ALREADY' })
    console.log(`${label} ✅ ALREADY(远端=本地,跳过推送)`)
    continue
  }
  // 2. 判定领先关系(无需网络:本地已有该对象即可判定,否则按需 fetch)
  if (!git(['cat-file', '-e', remoteSha])) {
    git(['fetch', remote, branch], { timeout: TIMEOUT_MS })
  }
  const remoteIsAncestor = git(['merge-base', '--is-ancestor', remoteSha, localHead]) !== null
    && git(['cat-file', '-e', remoteSha]) !== null
  const localIsAncestor = git(['merge-base', '--is-ancestor', localHead, remoteSha]) !== null
    && git(['cat-file', '-e', remoteSha]) !== null

  if (localIsAncestor && !remoteIsAncestor) {
    results.push({ remote, status: 'BEHIND' })
    console.log(`${label} ⏭️  SKIP(远端领先 ${remoteSha.slice(0, 11)},本地待 ff;不强推)`)
    // 本行结论只由 ls-remote 网络真值产出(当下量的);push-state 只是旁证 ——
    // 不加这一句,读的人会把它和几小时前那条读数混成一件事(2026-09-28 失真登记)。
    console.log(
      noteEvidence(startProv, ';本行结论依据 = ls-remote 现读远端 tip(当下量的),**本次未现推**'),
    )
    continue
  }
  if (remoteIsAncestor && !localIsAncestor) {
    // 本地领先:若后台推送正在进行(guard 异步化),显示 PUSHING 而非重复触发
    if (pushInProgress) {
      results.push({ remote, status: 'PUSHING' })
      console.log(`${label} ⏳ PUSHING(后台推送进行中,HEAD ${localHead.slice(0, 11)})`)
      console.log(
        noteEvidence(startProv, ';在途判定同时要求 running + headSha==HEAD + 未过期 + pid 存活'),
      )
      continue
    }
    if (remote === 'origin') {
      // 2026-09-19 根治:origin 推送委托 guard 同步通道(此前直推必败——
      // push 会跑 pre-push 全量门 ~270s,而本脚本 git() 超时只有 180s,一推
      // 就被自己 kill 成 PUSH_FAILED)。guard 通道自带:75 中断重试/门失败
      // no-verify 兜底/终态兜底/心跳,委托即获得全部根治能力(--heal 同路径)。
      const healRes = healViaGuard()
      if (healRes.ok) {
        results.push({ remote, status: 'PUSHED' })
        console.log(`${label} 🚀 PUSHED(${localHead.slice(0, 11)},经 guard 同步通道)`)
      } else {
        results.push({ remote, status: 'PUSH_FAILED' })
        // guard 刚刚跑过 ⇒ 这里的 push-state 一律**现读**再报出处:仍与当前 HEAD 无关时
        // 必须写成"历史残留/未现推",不得让下一个人把几小时前那条读数当成本次的真因。
        const afterProv = pushStateProvenance({
          pushState: readPushState(),
          localHead,
          now: Date.now(),
        })
        const tail = tailEvidence(healRes.text)
        console.log(
          `${label} ❌ PUSH_FAILED(本次**确实现推过一趟**:guard 同步通道 exit=${
            healRes.code === null ? '未取到' : healRes.code
          },需人工)`,
        )
        console.log(
          `         └ 本次现推输出末行:${tail || '**未取到输出(未判定)** —— 不得拿 push-state 的历史读数冒充本次真因'}`,
        )
        console.log(noteEvidence(afterProv))
        hasFailure = true
      }
      continue
    }
    // 本地领先 → 推(镜像仓:直推但放宽超时,门禁由 CI 承担)
    const pushArgs = ['push', remote, `HEAD:refs/heads/${branch}`]
    const pushRes = gitWithOutput(pushArgs, 'git', { timeout: 600_000 })
    if (!pushRes.ok) {
      results.push({ remote, status: 'PUSH_FAILED' })
      const tail = tailEvidence(pushRes.text)
      console.log(
        `${label} ❌ PUSH_FAILED(本次**确实现推过一趟** exit=${
          pushRes.code === null ? '未取到' : pushRes.code
        },需人工)`,
      )
      console.log(
        `         └ 本次现推输出末行:${tail || '**未取到输出(未判定)** —— 不得拿 push-state 的历史读数冒充本次真因'}`,
      )
      console.log(noteEvidence(startProv, ';push-state 只是旁证,本行的失败判定来自上面那趟现推'))
      hasFailure = true
    } else {
      results.push({ remote, status: 'PUSHED' })
      console.log(`${label} 🚀 PUSHED(${localHead.slice(0, 11)})`)
    }
    continue
  }
  // 既非祖先关系 → 分叉
  if (allowLease) {
    const leaseRes = gitWithOutput([
      'push',
      '--force-with-lease',
      remote,
      `HEAD:refs/heads/${branch}`,
    ])
    if (leaseRes.ok) {
      results.push({ remote, status: 'FORCE_PUSHED' })
      console.log(`${label} ⚠️  FORCE_PUSHED(lease,分叉 ${remoteSha.slice(0, 11)})`)
      continue
    }
    console.log(
      `${label}    └ lease 强推未成功(本次现推 exit=${
        leaseRes.code === null ? '未取到' : leaseRes.code
      }):${tailEvidence(leaseRes.text) || '未取到输出(未判定)'}`,
    )
  }
  results.push({ remote, status: 'DIVERGED' })
  console.log(`${label} ⚠️  DIVERGED(远端 ${remoteSha.slice(0, 11)} 与本地分叉;先 ff/merge 再收敛)`)
  console.log(
    noteEvidence(
      startProv,
      ';本行的分叉结论只依据 ls-remote 现读 + merge-base 判定(当下量的),不取自 push-state',
    ),
  )
  if (pushDiverged) {
    // 措辞按**出处**分岔,而"算不算当下量的"这一步只在 lib 里判一次(`isCurrent`/`label`)——
    // 记录与当前 HEAD 无关(或已过期)时不得写成"guard 刚刚判过",那会让人以为这一型
    // 已被处理过而不去收敛(2026-09-28 失真登记)。
    const staleWording = startProv.isCurrent
      ? 'guard 上一轮(同枚提交)已判 diverged'
      : `push-state 里那条 diverged 属${startProv.label}`
    console.log(
      `${label}    └ ${staleWording}${
        pushState.reason ? `(${String(pushState.reason).slice(0, 90)})` : ''
      }⇒ 别再重试推送,唯一入口:node scripts/git-sync-converge.mjs`,
    )
  }
  hasFailure = true
}

// ─── 汇总 ───
const summary = results.map((r) => `${r.remote}=${r.status}`).join(' ')
console.log(`\n收敛结果: ${summary}`)
// 末行再报一次开跑时那条读数的出处:多仓时上面的逐行注脚容易被截掉,而"这一轮的结论
// 有多少来自当下、有多少压在历史读纸上"必须是**不用翻上文就能答**的问题(2026-09-28)。
console.log(`汇总出处: ${startProv.text}`)
process.exit(hasFailure ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
