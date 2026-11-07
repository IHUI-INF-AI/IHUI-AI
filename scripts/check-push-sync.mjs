#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * [judges-remote-state] 本门判「本地⇄远端同步态」(未 push commit 数),不是本枚提交的内容 ——
 * G-815912:归因层(commit-gate-attribution)经 readGateSource 读到本声明,把本门的失败
 * 判「未差分」:不进差分四态、不归责提交内容、不产假红假绿(红出现在刚提交后是必然态,
 * 修法 = push,不是改内容)。
 */
/**
 * check-push-sync.mjs — Push 同步兜底守门(防"commit 后忘记 push"复发)
 *
 * 背景:
 *   AGENTS.md §21 任务完成硬定义要求 local HEAD == remote HEAD。
 *   post-commit 钩子(git-push-guard.mjs)是主防线,但可能因各种原因失败:
 *     - HUSKY_SKIP_PUSH=1 跳过
 *     - push 网络失败 / 凭据失效
 *     - agent 用 --no-verify 跳过所有钩子
 *     - pre-push typecheck 阻塞
 *     - RunCommand 工具失联导致无法执行 push 命令
 *   本脚本作为"第二道防线",在 pre-commit 阶段检查:
 *     如果本地有未 push 的 commit → 阻塞本次 commit,要求先 push。
 *
 * 检查逻辑:
 *   1. 读取当前分支
 *   2. 读取本地 HEAD
 *   3. 读取 origin/<branch> HEAD —— **唯一出口 `scripts/lib/face-reader.mjs` 的 resolveRemoteHead()**:
 *      ① ls-remote(当次服务器真值)→ ② 本轮 fetch 成功时的 FETCH_HEAD → ③ 只剩跟踪 ref 残值
 *      ⇒ **不参与落槌**,三档都取不到当次真值时本门以 exit 2「未判定」收口并点名依据
 *      (2026-10-18 收口:过去 ③ 档回退本地 ref 照常判定,
 *      既造出"已推送却被判未推送 ⇒ 阻塞 commit"的假红,也造出"残值恰好等于本地 ⇒ 报已同步"的假绿;
 *      本机宿主清理层删除嵌套 ref 后 packed-refs 读回旧值即此型,AGENTS §5b 已记。
 *      2026-11-04 再收口:那一版在无法判定时 exit 0 放行 —— 没冒红,但仍把"读不到"记成了绿,
 *      §0.3 要求未判定不记绿也不冒红。)
 *   4. `git rev-list --left-right --count <远端 sha>...<HEAD>` —— **三态读数**,同时出两个数:
 *      左列 = 本地落后(behind:N),右列 = 本地领先(ahead:M)。只有真读到两个整数才落判定;
 *      rev-list 失败 / 取不到对象 / 被信号打断一律「未判定」(exit 2)并点名原因。
 *      2026-11-04 实测:远端推进而本地未 fetch 时,该命令以非零退出失败
 *      (本机读到 `fatal: bad object <sha>` exit 1;引用形态不同时亦有
 *      `fatal: ambiguous argument '<sha>..HEAD': unknown revision` 一型);
 *      旧写法 `allowFail ⇒ null ⇒ ahead=0 ⇒ 打印"无 ahead commit(可能 behind,跳过)" exit 0`,
 *      把"远端存在本地没有的对象(过期引用 / 浅克隆 / 取不到对象)"这一整族报成了通过。
 *   5. 关系分类(2026-11-05 加固,旧版只算 ahead 把分叉读成"本地 N 枚未推"):
 *      · ahead>0 且 behind=0 → 本地领先 → 按既有语义阻塞(exit 1,除推送在途/done 等可读放行档)
 *      · behind>0 且 ahead=0 → **远端领先 = 红**,点名两侧 sha
 *      · ahead>0 且 behind>0 → **真分叉 = 红**,点名两侧 sha 与两侧独有提交数
 *      远端位置一律以 `ls-remote` 现读 sha 为准(见第 3 步),跟踪 ref 只作缓存提示。
 *
 * 退出码(§0.3):
 *   0 — 本地与 origin 同步(无 behind/ahead,或非 git 环境/无 origin/detached HEAD/空仓库等不适用)
 *   1 — 本地领先有未 push commit(既有语义),或远端落后/分叉(2026-11-05 加固)
 *   2 — 未判定:取不到 origin 当次位置(远端不可读),或 rev-list 读不出数(远端对象缺失 / 失败 / 被信号打断)
 *
 * 豁免:
 *   - HUSKY_SKIP_PUSH_SYNC=1: 跳过本检查(紧急场景,不推荐)
 *   - IHUI_ARCHIVE_COMMIT=1: 归档 commit 跳过(归档 commit 由 post-commit 自动 push)
 *   - --staged 模式: pre-commit 调用,正常执行检查
 *
 * 用法:
 *   node scripts/check-push-sync.mjs [--staged]
 *   HUSKY_SKIP_PUSH_SYNC=1 node scripts/check-push-sync.mjs
 *
 * 调用方:
 *   - .husky/pre-commit → guardian-runner.mjs 第 29 项 blocking 检查
 *   - 手动收尾验证
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// 远端 tip 的唯一取法(§22c 单一真相源):判据住在 lib,本门不再各写一份
import { resolveRemoteHead } from './lib/face-reader.mjs'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费(.trim() 后 return)⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...opts,
    }).trim()
  } catch (e) {
    if (opts.allowFail) return null
    throw e
  }
}

// ─── 同步关系读数:三态(§0.3) ───────────────────────────────
/**
 * `git rev-list --left-right --count <远端 sha>...<本地 sha>` 的**唯一读数口**。
 *   判过   : { judged:true, behind:N, ahead:M } —— 真读到两个整数
 *      左列 = 只在远端可达的提交数(本地落后 behind 枚)
 *      右列 = 只在本地可达的提交数(本地领先 ahead 枚)
 *   未判定 : { judged:false, why }     —— 失败 / 取不到对象 / 被信号打断
 * 2026-11-05 加固:旧版只算 `--count <远端>..HEAD`(= ahead 一个数),读到 0 就打印
 * "behind,不阻塞" exit 0 —— 真分叉被读成"本地未推"、真落后被放行。现在两个数都要读,
 * 落后与分叉都按红处置,并把两侧 sha / 两侧独有数一起点名(见下方关系分类)。
 * 未判定的处置不变:绝不折算成 0(§0.3)。
 */
function readSyncCounts(remoteSha, localSha) {
  let out
  try {
    out = execSync(`git rev-list --left-right --count ${remoteSha}...${localSha}`, {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim()
  } catch (e) {
    return { judged: false, why: explainCountFailure(e, remoteSha) }
  }
  const m = /^(\d+)\s+(\d+)$/.exec(out)
  if (!m) {
    return {
      judged: false,
      why: `git rev-list --left-right 输出不是 "<behind> <ahead>" 两个整数(${JSON.stringify(out.slice(0, 60))})⇒ 未读到数`,
    }
  }
  return { judged: true, behind: Number.parseInt(m[1], 10), ahead: Number.parseInt(m[2], 10) }
}

/** 同步关系分类(纯函数,便于 --self-test 与单测直接验判据核)。 */
function classifySync({ ahead, behind }) {
  if (ahead > 0 && behind > 0) return 'diverged'
  if (behind > 0) return 'behind'
  if (ahead > 0) return 'ahead'
  return 'synced'
}

// ─── --self-test:只验判据核,不碰网络、不碰仓库 ─────────────
if (process.argv.includes('--self-test')) {
  const cases = [
    ['synced', { ahead: 0, behind: 0 }],
    ['ahead', { ahead: 3, behind: 0 }],
    ['behind', { ahead: 0, behind: 2 }],
    ['diverged', { ahead: 2, behind: 3 }],
  ]
  let failed = 0
  for (const [expect, input] of cases) {
    const got = classifySync(input)
    if (got !== expect) {
      failed += 1
      console.error(`❌ self-test: ${JSON.stringify(input)} 期望 ${expect},实得 ${got}`)
    }
  }
  if (failed > 0) {
    console.error(`❌ self-test 失败 ${failed}/${cases.length}`)
    process.exit(1)
  }
  console.log(`✅ self-test 通过 ${cases.length}/${cases.length}(synced / ahead / behind / diverged)`)
  process.exit(0)
}

/**
 * 远端 sha 在本地对象库里是否存在。三态:true / false(确定缺失) / null(探不出 ⇒ 不冒充缺失)。
 * `cat-file -e` 对"对象不存在"是 exit 1;其它非零(信号 / 参数坏)不是"缺失"这一型。
 */
function objectPresent(sha) {
  try {
    execSync(`git cat-file -e ${sha}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return true
  } catch (e) {
    return typeof e?.status === 'number' && e.status === 1 ? false : null
  }
}

/** 把"数不出来"点名到可处置的类别:取不到对象 ≠ 被信号打断 ≠ 其它 git 失败。 */
function explainCountFailure(e, remoteSha) {
  const sig = e?.signal
  const status = e?.status
  if (sig) return `git rev-list 被信号 ${sig} 打断(exit ${status ?? '无'})⇒ 未读到数`
  if (objectPresent(remoteSha) === false) {
    return (
      `远端对象 ${String(remoteSha).slice(0, 11)} 在本地不存在` +
      '(未 fetch / 浅克隆 / 过期引用)⇒ 无法计算 ahead/behind'
    )
  }
  const line = String(e?.stderr ?? '').split(/\r?\n/).find((l) => l.trim())
  return `git rev-list 失败(exit ${status ?? '无'}):${line ? line.trim() : '无回显'}`
}

/** 未 push commit 清单(最多 5 条)。三态:读不到 ⇒ { judged:false, why }(本票 ④)。
 *  2026-11-04:此前失败返回 null 后静默跳过清单、照常 exit 1 —— "ahead 已读到但证据读不出"
 *  同属机器状态读数失败,按 §0.3 收口为 exit 2,不再静默放行。 */
function readAheadCommits(remoteSha, localSha) {
  try {
    const out = execSync(`git log --oneline -5 ${remoteSha}..${localSha}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim()
    return { judged: true, text: out }
  } catch (e) {
    const sig = e?.signal ? `,信号 ${e.signal}` : ''
    const line = String(e?.stderr ?? '').split(/\r?\n/).find((l) => l.trim())
    return {
      judged: false,
      why:
        `git log --oneline -5 ${String(remoteSha).slice(0, 7)}..${String(localSha).slice(0, 7)} ` +
        `失败(exit ${e?.status ?? '无'}${sig})${line ? `:${line.trim()}` : ''}`,
    }
  }
}

/** §0.3 统一收口:未判定 ⇒ 点名原因后 exit 2(guardian 依 stderr 的「未判定」归 undetermined)。 */
function exitUndetermined(why, details = []) {
  console.error(`?  未判定:${why}`)
  for (const d of details) console.error(`   ${d}`)
  console.error('   ⇒ 本次不给「通过 / 阻塞」结论(§0.3,exit 2)')
  process.exit(2)
}

// ─── 豁免检查 ───────────────────────────────────────────────
if (process.env.HUSKY_SKIP_PUSH_SYNC === '1') {
  console.log('⏭  HUSKY_SKIP_PUSH_SYNC=1 — 跳过 push 同步兜底检查(紧急场景,不推荐)')
  process.exit(0)
}

// 归档 commit 跳过(归档 commit 由 post-commit 自动 push,不阻塞)
if (process.env.IHUI_ARCHIVE_COMMIT === '1') {
  console.log('⏭  IHUI_ARCHIVE_COMMIT=1 — 归档 commit,跳过 push 同步兜底检查')
  process.exit(0)
}

// ─── 1. 基础环境检查 ───────────────────────────────────────
const repoRoot = run('git rev-parse --show-toplevel', { allowFail: true })
if (!repoRoot) {
  // 非 git 环境,跳过(不阻塞)
  console.log('⏭  非 git 仓库,跳过 push 同步检查')
  process.exit(0)
}
process.chdir(repoRoot)

/** `rev` 是否指向一个**真实存在**的对象。`git rev-parse --verify` 只验名字能解析,
 *  不验对象存在(实测:ref 写成不存在的 sha 时它照样 exit 0 并回显该 sha),
 *  所以 HEAD 可用性必须再用 `cat-file -e` 补一刀。 */
function objectAtRev(rev) {
  try {
    execSync(`git cat-file -e ${rev}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

// ─── 1b. 分支 / HEAD 三态:真空仓库「不适用」≠ HEAD 损坏「未判定」────────
// 2026-11-04:此前 `git rev-parse HEAD` 失败一律打印「空仓库?」exit 0。空仓库确实没有
// 可比较的提交(不适用),但 HEAD 损坏 / 分支 ref 指向缺失对象时同样读不到 —— 把它一起
// 跳过等于把「读不到」记成绿。改用两枚探针分开取证:
//   · `git symbolic-ref -q HEAD` —— 有符号分支才谈得上"当前分支"
//   · `git rev-parse --verify HEAD` + `git cat-file -e HEAD` + `git rev-list --all --count`
//     —— 区分无提交仓库与坏 ref(rev-parse 只验名字,必须 cat-file 再验对象存在)
const headRef = run('git symbolic-ref -q HEAD', { allowFail: true })
const headVerify = run('git rev-parse --verify HEAD', { allowFail: true })
const headUsable = !!headVerify && objectAtRev('HEAD')
if (!headRef) {
  if (headUsable) {
    // 真 detached HEAD(HEAD 直接持有效 sha):无法自动 push,不适用
    console.log('⏭  detached HEAD 状态,跳过 push 同步检查(请先 git checkout 切回分支)')
    process.exit(0)
  }
  exitUndetermined('本地 HEAD 既不是符号分支,也解析不出真实存在的提交(HEAD 损坏 / 指向缺失对象)', [
    `取证:git symbolic-ref -q HEAD ⇒ 失败;git rev-parse --verify HEAD ⇒ ${
      headVerify ? `${String(headVerify).slice(0, 11)}(对象不存在)` : '失败'
    }`,
    '区分:真 detached HEAD 必须 rev-parse 得出 sha 且 cat-file -e 能找到对象;否则是损坏,不得按跳过放行',
  ])
}
const currentBranch = headRef.replace(/^refs\/heads\//, '')
if (!currentBranch || currentBranch === headRef) {
  exitUndetermined(`HEAD 指向非分支符号 ref(${headRef})⇒ 无法判定 origin/<branch> 位置`, [
    '出路:git checkout 切回正常分支后重跑本门',
  ])
}

// ─── 2. 检查 origin remote ─────────────────────────────────
const remotes = run('git remote', { allowFail: true })
if (!remotes || !remotes.split('\n').includes('origin')) {
  // 无 origin remote,跳过(无法 push)
  console.log('⏭  未配置 origin remote,跳过 push 同步检查')
  process.exit(0)
}

// ─── 3. 读取本地 + 远端 HEAD ───────────────────────────────
const localHead = headUsable ? headVerify : null
if (!localHead) {
  // 无提交仓库的判据是 --all 读到 0 枚提交;探针本身失败(疑有 ref 指向缺失对象)⇒ 未判定
  const allCommits = run('git rev-list --all --count', { allowFail: true })
  if (allCommits === '0') {
    console.log('⏭  空仓库(尚无任何提交),push 同步检查不适用')
    process.exit(0)
  }
  exitUndetermined(
    `本地 HEAD(${headRef})读不出真实存在的提交 —— 属 HEAD / ref 损坏(指向缺失对象)`,
    [
      `取证:git rev-parse --verify HEAD ⇒ ${
        headVerify ? `${String(headVerify).slice(0, 11)}(对象不存在)` : '失败'
      };git cat-file -e HEAD ⇒ 失败;git rev-list --all --count ⇒ ${
        allCommits === null ? '失败(疑有 ref 指向缺失对象)' : allCommits
      }`,
      '无提交仓库的判据是 --all count=0;HEAD 损坏不得按"跳过"放行',
    ],
  )
}

// 远端 tip 的唯一取法住在 `scripts/lib/face-reader.mjs` 的 `resolveRemoteHead()`(§22c 单一真相源)。
// 背景(2026-09-12 修,与 git-push-guard.mjs 同源问题;2026-10-18 收口成共用一份):
//   本机「宿主清理 gitdir 嵌套目录」病理会把 `refs/remotes/<remote>/<branch>` 静默删除,
//   而 packed-refs 残留旧值 → `git rev-parse origin/<branch>` 返回**过期 sha**。
//   本门过去在 ls-remote 失败时**回退到那枚残值并照常落槌**,两个方向都会错:
//     ① 残值落后 ⇒ 把已推送的 commit 判成"未 push"并阻塞本次 commit(实测:本地=远端=bc3b29c1f,
//        却报「远端 HEAD: 81a5869」);诱导出的 `pull --rebase` 本机禁用且曾两次删库(§5b);
//     ② 残值恰好等于本地 ⇒ 报"已同步"放行,而远端其实在别处 ⇒ 提交堆在本地被当成完成(§20)。
//   lib 的三档依次退让里第 ③ 档(只剩跟踪 ref 残值)**不参与落槌**,只随"未判定"报出供诊断。
//   2026-10-18 那一版在无法判定时 exit 0 放行(理由:判机器状态的门在网络不可达时造红,
//   唯一实际结局是逼人 --no-verify)。2026-11-04 再收口:放行等于把"读不到"记成绿(§0.3),
//   现在改为 exit 2「未判定」——既不冒红(不进判红名单),也绝不记绿;急事走 HUSKY_SKIP_PUSH_SYNC=1。
const remoteResolution = resolveRemoteHead(currentBranch, { root: repoRoot })
const remoteHead = remoteResolution.sha
if (!remoteHead) {
  console.error(`?  未判定:远端不可读 —— 无法取到 origin/${currentBranch} 的当次位置 ⇒ 本次不参与判定(§0.3,exit 2)`)
  console.error(`   依据:${remoteResolution.reason}`)
  if (remoteResolution.stale) {
    console.error(
      `   仅有跟踪 ref 残值 ${String(remoteResolution.stale).slice(0, 11)} —— §5b 规定它不足以判定收敛,不拿它算"未 push"数量`,
    )
  }
  console.error('   出路:恢复 origin 可达后重跑 node scripts/check-push-sync.mjs;确需跳过本次检查用 HUSKY_SKIP_PUSH_SYNC=1(不推荐)')
  process.exit(2)
}

// ─── 4. 对比 + 计算 behind / ahead(2026-11-05:两个数都要读) ─────
if (localHead === remoteHead) {
  // 完全同步,通过
  console.log(`✅ 本地与 origin/${currentBranch} 已同步(HEAD: ${localHead.substring(0, 7)})`)
  process.exit(0)
}

// 同时读出"本地落后几枚 / 本地领先几枚" —— 三态:读不到数一律未判定,绝不折算成 0
const counts = readSyncCounts(remoteHead, localHead)
if (!counts.judged) {
  console.error(`?  未判定:${counts.why}`)
  console.error('   ⇒ 不折算成 ahead=0 / behind=0,本次不给「通过 / 阻塞」结论(§0.3,exit 2)')
  console.error(`   取证:git rev-list --left-right --count ${remoteHead}...${localHead}`)
  console.error('   出路:先 git fetch origin 补齐远端对象后重跑本门;确需跳过本次检查用 HUSKY_SKIP_PUSH_SYNC=1(不推荐)')
  process.exit(2)
}
const { ahead, behind } = counts
const relation = classifySync({ ahead, behind })

// 远端领先 / 真分叉:都必须红(旧版把 behind 与 diverged 都放过) —— 点名两侧 sha 与独有数
if (relation === 'behind' || relation === 'diverged') {
  const localShort = localHead.substring(0, 7)
  const remoteShort = remoteHead.substring(0, 7)
  const headline =
    relation === 'behind'
      ? `远端领先(本地落后 ${behind} 枚,本地独有 0 枚)`
      : `真分叉(远端独有 ${behind} 枚、本地独有 ${ahead} 枚)`
  console.error('')
  console.error(`${C.red}❌ Push 同步兜底检查失败:${C.bold}${headline}${C.reset}`)
  console.error('')
  console.error(`  ${C.dim}本地 HEAD  :${C.reset} ${C.cyan}${localShort}${C.reset}`)
  console.error(`  ${C.dim}远端 HEAD  :${C.reset} ${C.cyan}${remoteShort}${C.reset}`)
  console.error(`  ${C.dim}当前分支  :${C.reset} ${C.cyan}${currentBranch}${C.reset}`)
  console.error('')
  console.error(
    `${C.dim}远端位置取自 ls-remote 当次现读(跟踪 ref 只作缓存提示,不单独落槌)${C.reset}`,
  )
  console.error(
    `${C.green}出路:${C.reset} ${C.cyan}node scripts/git-sync-converge.mjs${C.reset} ${C.dim}(先现读远端再做合面)${C.reset}`,
  )
  console.error(
    `${C.red}禁止 pull --rebase:§5b 记录它在本机曾两次删库;落后/分叉都要显式收口${C.reset}`,
  )
  console.error('')
  process.exit(1)
}

// ─── 5. 有未 push 的 commit → 检查后台推送状态 ──────────────
// 2026-09-18 晚(异步推送适配):推送已后台化(全量门约 270s),"本地有未 push commit"
// 在每次 commit 后数分钟内是**常态**。此检查若照旧阻塞,会导致 pre-commit 首跑必败
// → --no-verify 重试 → 80 项守门全跳过(实测今日每次 commit 都如此)。
// 故:后台推送在途(running 且未过期)→ 放行;仅"无在途推送且 ahead>0"(真忘记 push)才阻塞。
const PUSH_STATE_STALE_MS = 5 * 60 * 1000

/** 读 `.ihui-agent/state/push-state.json`;缺文件/坏 JSON ⇒ null(回到原判据,不猜)。 */
function readPushState() {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, '.ihui-agent/state/push-state.json'), 'utf8'))
  } catch {
    return null
  }
}

/** pid 存活探测(signal 0)。`isPidAlive` 与 worker 侧同一语义:EPERM = 活着但不属于我。 */
function isPidAlive(pid) {
  if (!pid || Number(pid) === process.pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** `headSha` 是否是本地 HEAD 的祖先(含自身)。**三态**:true=明确是,false=明确不是,
 *  judged:false=调用失败/形状不可判(§0.3 未判定,由调用方 exit 2)。
 *  2026-11-04:此前任何失败都折成 `false` —— 在 done 档会把"读不出"当"别的历史",
 *  在 protected-branch 档会把"读不出"当"真分叉";两个方向都在替机器猜。现在只承认
 *  `merge-base --is-ancestor` 的 exit 0(是)与 exit 1(明确不是),其余一律未判定。
 *  刻意不用 `git cat-file -e <sha>^{commit}`:`execSync` 在 Windows 走 cmd.exe,
 *  而 `^` 是 cmd 的转义符,该形态会被吃掉后报"未知对象"(实测踩过一次,表现为
 *  done+祖先这一格永远判红)。 */
function isAncestorOfHead(sha, head) {
  if (!sha || !head) return { judged: false, why: 'sha / head 为空' }
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    return { judged: false, why: `sha 形状不合法(${String(sha).slice(0, 12)})` }
  }
  try {
    execSync(`git merge-base --is-ancestor ${sha} ${head}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return { judged: true, ancestor: true }
  } catch (e) {
    // merge-base --is-ancestor:0=是祖先,1=明确不是,其余=调用失败(不得当"不是")
    if (typeof e?.status === 'number' && e.status === 1) return { judged: true, ancestor: false }
    const sig = e?.signal ? `,信号 ${e.signal}` : ''
    const line = String(e?.stderr ?? '').split(/\r?\n/).find((l) => l.trim())
    return {
      judged: false,
      why: `git merge-base --is-ancestor 失败(exit ${e?.status ?? '无'}${sig})${
        line ? `:${line.trim()}` : ''
      }`,
    }
  }
}

/** push-state 三态结论(§0.3):{ state:'pass'|'fail'|'undetermined', why, warn? }。
 *  · pass —— 有**可读的真实读数**支持"积压不是本枚提交的疏忽"或"推送正在进行"
 *  · fail —— 按真实读数该阻塞(ahead>0);`warn:true` 只降级文案(避免重复告警),不降退出码
 *  · undetermined —— 读数本身失败(祖先关系 / headSha 取不到),exit 2 并点名
 *
 *  2026-11-04 改判(本票 ①):`failed` / `diverged` 的"新鲜窗口"**不再 exit 0** ——
 *  上轮推送被拒 non-fast-forward 恰恰说明存在真实分叉,窗口内放行等于把分叉判绿(§20)。
 *  窗口内的降级只到文案(warn),退出码仍按真实读数走:能算出 ahead>0 ⇒ 阻塞;
 *  算不出 / 取不到 origin 位置 ⇒ 更早的 rev-list 三态已 exit 2。
 *
 *  仍保留的两格 pass 都有可读的几何事实:
 *    · running 且新鲜且持有者存活 —— 推送在途,不是"忘了推";
 *    · done 且新鲜且 headSha 在 HEAD 祖先线 —— 上一轮真推成功,本次 ahead 是其后的新提交;
 *    · failed(protected-branch / remote-ref-race)且 **ls-remote 现读**远端 tip 在本地祖先线
 *      —— 通道被策略或竞态挡住,behind=0,积压不是本枚疏忽。祖先关系读不出 ⇒ exit 2(本票 ②)。
 *  向后兼容:老状态文件里缺 `diverged` 等值时,对应分支不生效。 */
function pushVerdict(st, { now, localHead, remoteHead }) {
  if (!st || typeof st.ts !== 'number') return { state: 'fail', why: '无 push-state(或形状不对)' }
  const fresh = now - st.ts < PUSH_STATE_STALE_MS
  const alive = isPidAlive(st.pid)
  if (
    st.status === 'failed' &&
    (st.kind === 'protected-branch' || st.kind === 'remote-ref-race') &&
    remoteHead
  ) {
    // 2026-09-27 17:1x 起本机真实遇到的型:GitHub 侧 main 分支保护要求 PR 状态检查
    // (`GH006 / Required status check ...`),于是**任何**推送都出不去,而 ahead 会永久 >0。
    // 它不是任何人的疏忽:拦下去的后果不是"逼人去推",而是每个会话每次提交都合法
    // --no-verify —— 一次绕过约等于链上全部守门对该提交作废(§12e)。
    // 判据是几何事实:**ls-remote 现读的远端 tip 已在本地祖先线内 ⇒ behind=0**。
    // 所以这一档刻意不看 freshness —— 策略不改读数必然变旧,拿 freshness 当条件
    // 等于自己造一台恒红门;而真分叉(远端已推进)时祖先不成立,照拦。
    // 2026-09-28 G-353 把 `remote-ref-race`(并发插队)并进同一条几何判据,**不是放宽**:
    // 两型共享的只有"远端 tip 在本地祖先线内 ⇒ 积压不是本枚提交的疏忽";下一步动作
    // 相反,所以**出路文案按 kind 分开**。
    const anc = isAncestorOfHead(String(remoteHead), localHead)
    if (!anc.judged) {
      // 本票 ②:祖先关系读不出 ⇒ 既不满足几何放行条件,也不等于"明确不是祖先";
      // 这一格不得落任何一边,统一 exit 2 未判定。
      return {
        state: 'undetermined',
        why: `远端 tip 与本次 HEAD 的祖先关系读不出(${anc.why})⇒ 无法证明 behind=0,不得放行也不得判红`,
      }
    }
    if (anc.ancestor) {
      const isRaceKind = st.kind === 'remote-ref-race'
      return {
        state: 'pass',
        why: isRaceKind
          ? `推送落在**并发插队的竞态窗口**里(remote-ref-race,读数 ${ageText(now, st.ts)}前),` +
            '而 ls-remote 现读远端 tip 已在本地祖先线内 ⇒ 积压不是本枚提交的疏忽,拦下只会逼人跳门。' +
            '出路:重跑 node scripts/git-push-guard.mjs(它先现读远端 tip 再推,窗口最短且幂等);' +
            '**不得**按"去改仓库设置"处置 —— 那一句只属于 protected-branch,两型出路相反'
          : `推送通道被远端**分支保护策略**挡住(protected-branch,读数 ${ageText(now, st.ts)}前),而 ls-remote 现读远端 tip 已在本地祖先线内 ⇒ 积压不是本枚提交的疏忽,拦下只会逼人跳门。出路在机主侧:仓库 Settings→Branches 放开直推,或整仓改走 PR(那要同时改 §16/§20 的交付语义)`,
      }
    }
    // 明确"不是祖先"(exit 1)⇒ 真分叉,落到下面的 failed 档按真实读数阻塞
  }
  if (st.status === 'failed' && fresh) {
    // 2026-11-04 本票 ① 改判:此格原为 exit 0(理由:拦提交修不好推送,只会逼人 --no-verify)。
    // 但"上轮 push 失败"本身就是分叉/通道坏了的信号,exit 0 等于把真分叉判绿(§20);
    // 且 ahead 是**已真读到**的 >0,不是"读不到折算的 0"。现在窗口内仍按真实读数阻塞,
    // 只把"避免重复告警"降级为 warn 文案。自动重试仍由 watchdog / 下一次 guard 负责(§5b ⑤),
    // 升级到人走 §5e;持续失败看 .ihui-agent/state/git-push-guard-async.log 与 .alert-undelivered.json。
    return {
      state: 'fail',
      warn: true,
      why: `最近一次后台推送判 failed(${ageText(now, st.ts)}前${
        st.kind ? `,来源 ${st.kind}` : ''
      });新鲜窗口不再吞成通过 —— 真实读数 ahead>0,按阻塞落退出码(仅降级文案,不降退出码)`,
    }
  }
  if (st.status === 'failed') {
    return {
      state: 'fail',
      why: `failed 已 ${ageText(now, st.ts)}未被任何后续推送清掉 ⇒ 先跑 node scripts/git-push-guard.mjs 复现真因再提交`,
    }
  }
  if (st.status === 'diverged') {
    const remedy = st.nextCommand
      ? `出路:${st.nextCommand}`
      : '出路:node scripts/git-sync-converge.mjs'
    if (fresh) {
      // 本票 ①:diverged 就是"远端已推进、真分叉在场"。窗口内判绿等于把分叉报成完成,
      // 所以退出码按真实读数(ahead>0 ⇒ 阻塞);新鲜只让文案降级为 warn(避免重复告警)。
      return {
        state: 'fail',
        warn: true,
        why: `上一轮推送被远端拒收 non-fast-forward(diverged,${ageText(now, st.ts)}前)⇒ ${remedy};真分叉在场,窗口内不得判绿 —— 真实读数 ahead>0,按阻塞落退出码(仅降级文案),先跑收敛器再提交`,
      }
    }
    return {
      state: 'fail',
      why: `diverged 已 ${ageText(now, st.ts)}无人收敛(超过 ${Math.round(PUSH_STATE_STALE_MS / 60000)}min 窗口)⇒ 先跑 ${remedy} 再提交`,
    }
  }
  if (st.status === 'running' && fresh && alive) {
    return {
      state: 'pass',
      why: `后台推送在途(running,${ageText(now, st.ts)}前,pid ${st.pid} 存活)`,
    }
  }
  if (st.status === 'running' && fresh && !alive) {
    return { state: 'fail', why: `running 但持有者 pid ${st.pid} 已死 ⇒ 猝死残留,不算在途` }
  }
  // 2026-09-26 新增的一格:上一轮推送**已成功落终态(done)**,而本次 ahead 来自其后
  // 的新提交。这不算放宽:`done` 只说明"推送通道是通的、guard 在位",post-commit 必然为
  // 新提交再起一个 worker(§5b「异步推送」条);真推不出去会写 failed,仍由上面的档拦下。
  // 2026-11-04 本票 ②:祖先关系读不出 ⇒ 不得当"别的历史",统一 exit 2。
  if (st.status === 'done' && fresh) {
    const anc = isAncestorOfHead(String(st.headSha), localHead)
    if (!anc.judged) {
      return {
        state: 'undetermined',
        why: `push-state 是 done,但 headSha 与本次 HEAD 的祖先关系读不出(${anc.why})⇒ 不能把"读不出"当"别的历史"`,
      }
    }
    if (anc.ancestor) {
      return {
        state: 'pass',
        why: `上一轮推送已成功(done ${String(st.headSha).slice(0, 7)},${ageText(now, st.ts)}前),本次 ahead 来自其后的新提交,post-commit 会再起 worker 重推`,
      }
    }
    return {
      state: 'fail',
      why: `push-state 是 done,但那一枚 headSha 不在本次 HEAD 的祖先线上 ⇒ 不得拿别的历史的成功当本分支的合格证`,
    }
  }
  return { state: 'fail', why: `push-state status=${st.status} 且已过期(${ageText(now, st.ts)}前)` }
}

function ageText(now, ts) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}min`
}

const pushState = readPushState()
const verdict = pushVerdict(pushState, { now: Date.now(), localHead, remoteHead })
if (verdict.state === 'pass') {
  console.log(`⏭  ${verdict.why};新提交将由 post-commit 随新 worker 重推,不阻塞本次 commit`)
  process.exit(0)
}
if (verdict.state === 'undetermined') {
  // 本票 ②:祖先关系读不出 ≠ 明确不是祖先。这一格不落任何一边,统一 exit 2。
  exitUndetermined(verdict.why, [
    `push-state 读数:${
      pushState
        ? `status=${pushState.status} headSha=${String(pushState.headSha).slice(0, 7)} pid=${pushState.pid}`
        : '无文件'
    }`,
    '读不出祖先关系 ≠ 明确不是祖先:既不放行也不阻塞,由人补齐对象/重用 ls-remote 后重跑',
  ])
}
// 本票 ①:warn 只降级文案(避免重复告警),退出码仍按真实读数(ahead>0 ⇒ 阻塞)
if (verdict.warn) console.log(`⚠️  warn:${verdict.why}`)
// 判红时把"读到了什么"一起打出来:这道门判的是**远端态**,与提交内容无关,
// 没有这一行,每一次红都要有人从头猜一遍(今天就是这样)。
console.log(
  `ℹ️  push-state 读数:${pushState ? `status=${pushState.status} headSha=${String(pushState.headSha).slice(0, 7)} pid=${pushState.pid}` : '无文件'} ⇒ ${verdict.why}`,
)

const localShort = localHead.substring(0, 7)
const remoteShort = remoteHead.substring(0, 7)

// 读取未 push 的 commit 列表(最多 5 条)——三态:读不到 ⇒ 未判定(本票 ④)
const aheadCommits = readAheadCommits(remoteHead, localHead)
if (!aheadCommits.judged) {
  exitUndetermined(`未 push commit 清单读不出(${aheadCommits.why})⇒ 只报"有 ahead"而给不出证据`, [
    `已真读到 ahead=${ahead},但清单命令失败:证据与读数不可分,本次不给结论`,
  ])
}

console.error('')
console.error(
  `${C.red}❌ Push 同步兜底检查失败:本地有 ${C.bold}${ahead}${C.reset}${C.red} 个未 push 的 commit${C.reset}`,
)
console.error('')
console.error(`  ${C.dim}本地 HEAD  :${C.reset} ${C.cyan}${localShort}${C.reset}`)
console.error(`  ${C.dim}远端 HEAD  :${C.reset} ${C.cyan}${remoteShort}${C.reset}`)
console.error(`  ${C.dim}当前分支  :${C.reset} ${C.cyan}${currentBranch}${C.reset}`)
console.error('')
console.error(`${C.yellow}未 push 的 commit:${C.reset}`)
if (aheadCommits.text) {
  aheadCommits.text.split('\n').forEach((line) => {
    console.error(`  ${C.yellow}  ${line}${C.reset}`)
  })
}
if (ahead > 5) {
  console.error(`  ${C.dim}  ... 还有 ${ahead - 5} 个${C.reset}`)
}
console.error('')
console.error(`${C.bold}🛡️  这是 push 兜底守门(AGENTS.md §21 第三道防线)${C.reset}`)
console.error(
  `${C.dim}post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:${C.reset}`,
)
console.error(`${C.dim}  - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效${C.reset}`)
console.error(`${C.dim}  - agent 用 --no-verify 跳过所有钩子${C.reset}`)
console.error(`${C.dim}  - pre-push typecheck 阻塞 / RunCommand 工具失联${C.reset}`)
console.error('')
console.error(`${C.green}修复方法(任选其一):${C.reset}`)
console.error(
  `  ${C.green}① 自动 push:${C.reset} ${C.cyan}node scripts/git-push-guard.mjs${C.reset}`,
)
console.error(
  `  ${C.green}② 手动 push:${C.reset} ${C.cyan}git push origin ${currentBranch}${C.reset}`,
)
console.error(
  `  ${C.green}③ 紧急跳过(不推荐):${C.reset} ${C.cyan}HUSKY_SKIP_PUSH_SYNC=1 git commit ...${C.reset}`,
)
console.error('')
console.error(`${C.red}本次 commit 已阻止。请先 push 未同步的 commit,再重新 commit。${C.reset}`)
console.error('')
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
