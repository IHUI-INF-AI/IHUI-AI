#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Pre-commit 守门钩子（跨平台兼容 Windows）
// lint-staged + guardian-runner 批量守门 + 条件 typecheck/database 闸门
// + staging area 快照还原(防 lint-staged/IDE 副作用污染 commit,2026-07-26 立)
//
// 2026-09-22 弹窗根治:原文件是 .husky/pre-commit,由 git 直接以 node 启动。
// 当 commit 在无 console 上下文触发(IDE 隐藏持久 shell / GUI git 面板 /
// windowsHide 的 spawn / WMI 链)时,本 node 进程被 Windows 分配可见控制台
// 窗口且存活数分钟(全 hook 链最长驻的弹窗源)。现在由 .husky/pre-commit
// 薄壳经 wscript + cmd /c SW_HIDE 执行本文件,stdout/stderr 落
// .workbuddy/hook-logs/pre-commit.log,由薄壳回显摘要/失败详情。
// 本文件内部所有 execSync 均带 windowsHide:true,不受影响。
const { execSync, spawnSync } = require('child_process')
const {
  takeStagingSnapshot,
  setupRestoreOnExit,
  auditStagingFiles,
} = require('./staging-snapshot.js')

/**
 * ⛔ 被 require()/import() 时必须**立即返回**,不得执行下面任何一步(§22d 的 CJS 对应形态:
 *    判定用 `require.main === module`,本文件是 CommonJS,没有 `import.meta`)。
 *
 * 为什么这一档不是"洁癖"而是事故(2026-09-29 实测,由本仓一次真实自伤换来):
 * 另一会话为了读下面那张 `TOKEN_SYNC_TARGETS` 表而 `import` 了本模块,于是**整条 pre-commit 链
 * 被真实执行了一遍** —— 第 0 步 `git-lock.mjs clean` 会去清它判定为 stale 的 `index.lock`;
 * 第 1 步 lint-staged 在**共享索引**上对别人正暂存的 28 个文件跑了 `prettier --write`/`eslint --fix`,
 * 并在"恢复未暂存改动"这一步失败,把 7 个文件的未暂存内容留在 `lint-staged_unstaged.patch`。
 * 而 `git status`、退出码与其余守门**全都看不出来**这件事发生过。
 *
 * 所以:想知道这张表里有什么,请**按文本读**(`fs.readFileSync` + 解析,或 grep),
 * 不要指望 import 本文件做内省 —— 那条路今天的代价是替全队改工作区。
 * 直接执行(`node scripts/lib/pre-commit-hook.js`,由 `.husky/pre-commit` 经
 * `scripts/hook-run-hidden.vbs` 拉起)的行为**逐字不变**。
 */
if (require.main !== module) {
  module.exports = {}
  return
}

// ─── GIT_DIR 去污(2026-10-01,5 道守门链内崩实证根治)─────────────
// IDE(Trae)git 扩展向会话注入 GIT_DIR=D:/IHUI-AI-git-repo(worktree 之外的
// gitdir 指针)。子 git 进程以 scratch 物化目录为 cwd 跑 git init/add、或对
// gitdir 跑 work-tree 型命令时全部报 "fatal: this operation must be run in a
// work tree"([152]/[164]/[167]/[168]/[172] 链内全灭、单跑全绿的根因)。
// delete 后 git 从 cwd(worktree 根)经 ./.git 指针文件发现同一仓库,语义不变。
for (const k of [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_QUARANTINE_PATH',
]) {
  delete process.env[k]
}

// 0. stale 锁清理(2026-09-19 立,根治 index.lock 卡死多 agent)
// 在任何 git 操作前清理可能残留的 index.lock(崩溃 git 进程)+ ihui-git-write.lock(死 PID)。
// 活进程持有的锁不会被误删(clean 内判据:index.lock>60s 或无 git 进程;ihui 锁需 PID 死亡)。
// 清理失败不阻塞 commit(try/catch 兜底)。
try {
  execSync('node scripts/git-lock.mjs clean', {
    stdio: 'inherit',
    cwd: process.cwd(),
    windowsHide: true,
  })
} catch {
  /* 清理失败不阻塞 commit */
}

// 0. staged 文件数预检(2026-07-30 立,防污染事故快速告警)
// 背景:多 agent 并行 + IDE 自动 stage / lint-staged 副作用曾导致 commit 包含非本任务文件。
// 现有 staging-snapshot 机制在 hook 退出前自动 unstage 新增文件,本步骤作为"显式文件数预检"
// 快速告警信号,让 agent 立即看到异常(默认 warn-only,不阻断 commit)。
// 跳过方法:HUSKY_SKIP_STAGED_COUNT=1
try {
  execSync('node scripts/check-staged-files-count.mjs --max=10', {
    stdio: 'inherit',
    cwd: process.cwd(),
    windowsHide: true,
  })
} catch {
  // 守门脚本失败不阻塞 commit(脚本内部 git 失败已自行 exit 0)
}

function run(label, cmd) {
  console.log(label)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), windowsHide: true })
    return true
  } catch {
    console.error(`❌ ${label}失败，提交已阻止`)
    return false
  }
}

// ─── 轮次正证(round witness,2026-09-30 立)───────────────────────────
// 要补的那一格:`scripts/plan-bypass-ledger-report.mjs` 想回答"这枚提交到底有没有被守门看过",
// 但它过去的唯一正证是**去钩子日志里找一段与提交文件集逐字等值的回显** —— 那条件太脆:
// lint-staged 改写过文件、并发会话同一窗口 stage 了别的东西,都会让一次正常提交找不到匹配轮,
// 于是 2026-09-30 现读 1466 枚里 normal 只认得出 5 枚。脆判据的失效方向是"多报 unknown",
// 看着诚实,实际是把"检查全废的提交量"这个问题永久留在答不准。
// 所以由钩子**自己**落一条机器可读记录(不靠解析彩色日志、不靠字符串对齐),统计器用
// `gatesRan ∧ gatesPassed ∧ headBefore == 该提交的父 ∧ 提交文件集 ⊆ 本轮所见的暂存集` 作正证。
// 三条不许漂:
//  ① **一方记录只能证明"门看过这些文件且没红"**,不能证明提交的正是那些文件(那需要 sha,
//     而 pre-commit 阶段还不存在)⇒ 它仍是**下界型**证据,只是比"逐字等值"结实;
//  ② 门根本没跑就退出(lint-staged 失败等)时 `gatesRan` 必为 false ⇒ 永远不得被用来发合格证;
//  ③ 写失败绝不影响提交:整个记录裹在 try 里,连 exit 回调也不允许抛。
const ROUND_FILE_REL = '.workbuddy/hook-logs/pre-commit-rounds.jsonl'
const ROUND = {
  ts: new Date().toISOString(),
  headBefore: '',
  stagedFiles: [],
  gatesRan: false,
  gatesPassed: null,
}
let roundWritten = false
function writeRoundRecord(exitCode) {
  if (roundWritten) return
  roundWritten = true
  try {
    const { appendFileSync, mkdirSync } = require('fs')
    const path = require('path')
    const file = path.join(process.cwd(), ROUND_FILE_REL)
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(file, JSON.stringify({ ...ROUND, exitCode: exitCode ?? null }) + '\n', 'utf8')
  } catch {
    /* 记录写不出去 ≠ 提交该失败;但统计器会因此把这一轮读成"没跑过",方向是少发合格证 */
  }
}
// 本文件里有几十处 process.exit(1)(每个失败点一个),所以只挂**一个** exit 回调统一落记录;
// SIGINT/SIGTERM 走不到 'exit' 时由 staging-snapshot 那套信号处理负责还原暂存区,
// 记录缺失只意味着那一轮拿不到正证 —— 与"把没判写成判过了"相比,这是可接受的失效方向。
process.on('exit', writeRoundRecord)

// ─── staging area 入口快照(2026-07-26 立) ──────────────────
// 背景:多 agent 并行时曾出现非本任务文件被 commit 的事故(IDE 自动 stage / 未察觉的
//       git add / lint-staged 副作用)。本机制在 pre-commit 入口快照 staging area,
//       在 hook 退出前(无论成功失败)对比当前 staged 与快照,自动 unstage 新增文件,
//       确保 commit 仅包含用户显式 staged 的文件。
// 信号处理(2026-07-26 立):setupRestoreOnExit 封装 exit + SIGINT + SIGTERM 三种退出路径,
//       避免 Ctrl+C 时 staging area 不还原(process.on('exit') 在 SIGINT 时不触发)。
// 豁免:HUSKY_SKIP_STAGING_RESTORE=1 跳过还原(紧急情况用)
// 详见:scripts/lib/staging-snapshot.js
const INITIAL_STAGED_SNAPSHOT = takeStagingSnapshot()
setupRestoreOnExit(INITIAL_STAGED_SNAPSHOT, {
  skip: process.env.HUSKY_SKIP_STAGING_RESTORE === '1',
})

// 0b. staged 文件清单审计(2026-08-06 立,防同目录文件级污染)
// 背景:commit aa15bec23 "fix(web): message-list ..." 意外包含 message-input.tsx(其他 agent 改的)。
// 根因:message-input.tsx 在 hook 执行前已被 IDE/其他 agent staged,takeStagingSnapshot 把它
//       当成本任务文件,restoreStaging 不会 unstage。所有领域级守门都放过(同目录 scope=web 匹配)。
// 本步骤:打印 staged 文件清单(按目录分组)+ 同目录多文件警告 + 文件数 > 5 严重警告。
// warn-only(不阻塞 commit,避免误伤合法多文件 commit),但警告足够明显让 agent 察觉异常。
// 真正阻止污染的是 safe-commit.mjs(git reset HEAD + 只 add 声明文件 + 校验),见 AGENTS.md §12/§16/§20。
// 跳过方法:HUSKY_SKIP_STAGING_AUDIT=1
auditStagingFiles()

// ─── lint-staged 调用的 EBUSY 稳健性兜底(2026-10-06 立)────────────────────
// 为什么单独包一层而**不改 run()**:run() 被本文件几十处守门调用,给它加"失败自动重试"
// 会把「所有守门」都变成重试语义 —— 那是本票绝不允许的扩散(真实 lint 失败会被重试 3 次
// 再报错,日志噪音 + 耗时,还会掩盖"哪一门真的红")。重试只对下面这一条 EBUSY 兜底有意义。
//
// 病因(已实测,不重复推导):`node_modules/.pnpm/tinyexec@1.3.0/.../main.mjs:201` 的
// `defaultNodeOptions = { windowsHide: true }` **不设 stdio**,而 lint-staged 17.3.0 的
// 每一次 git 调用都走 `execGit.js` → `tinyexec.exec` → 那个 spawn ⇒ git.exe 继承 stdin 管道
// ⇒ 撞 EBUSY(errno -4082)。`--no-stash` 挡不住这条:`--no-stash` 只让 `runAll.js` 的
// `ctx.shouldBackup` 为 false,从而跳过 `gitWorkflow.js:252` 那块 **stash** 逻辑;
// 而 EBUSY 命中的是 `updateIndex()`(:442 `Failed to stage changes from tasks!`)与
// `applyModifications()` 之前的 `git restore`(:308),这两处**都不碰 stash**。
//
// 检测口径(两条都必须认,缺一条就漏):
//   ① 钩子这一层自己 spawn 失败 ⇒ `status === null` / `errno === -4082` / stderr 含 EBUSY。
//   ② lint-staged 内部 git 步骤被 EBUSY 打死 ⇒ 钩子这一层只看到 `status !== 0` 加一句
//      泛泛的 git 错误文案。**这是本机最常见的那一格**:lint-staged 把 EBUSY 吞进了
//      `gitWorkflow.js:443` 的 `debugLog(error)`,而 debug 默认关闭 ⇒ "EBUSY" 三个字
//      永远不会出现在钩子可见的输出里。所以还必须认它自己的指纹文案。
// ⚠️ 认指纹 ≠ 吞错误:重试耗尽后照样 exit 1(见调用点),只是把"这是 EBUSY 形态、已重试几次、
//    怎么绕"写成人能直接照做的诊断,而不是让人对着一句 git error 猜。
const LINT_STAGED_CMD = 'npx lint-staged --max-arg-length 4096 --no-stash'
// 递增退避 200/600/1500ms:EBUSY 是负载相关的间歇病(本机空载复现率低、并发时升高),
// 给它几拍重试通常第二三次就通了。间隔递增是为了不给本机已经很忙的进程面再加压。
const LINT_STAGED_EBUSY_BACKOFF_MS = [200, 600, 1500]
// lint-staged 自己的 git 步骤失败指纹(全部出自 node_modules/lint-staged/lib/messages.js
// 与 gitWorkflow.js,逐字对齐;含 17.3.0 的原文拼写错误 "hude")。
const LINT_STAGED_GIT_STEP_FINGERPRINTS = [
  'Failed to hude unstaged changes to partially staged files',
  'Failed to stage changes from tasks',
  'lint-staged failed due to a git error',
]

function spawnLintStagedOnce() {
  // 形态说明:`shell: true` 是 npx.cmd 在 Windows 上的必需(与既有 execSync 等价);
  // `windowsHide: true` 是 AGENTS §5b 硬要求(shell:true 不配它会弹可见控制台)。
  // stdio[0]='ignore' 是**本票的兜底本体**:不写 stdio / 写 'pipe' 都是三通道全管道
  // ⇒ 这条 spawn 自己也 EBUSY(本机实测 `npx lint-staged --version` 裸调即 EBUSY)。
  // stdout 仍 inherit ⇒ lint-staged 的任务输出照旧原样透传(不改变它的实际行为)。
  // stderr 改 pipe ⇒ 仅为把指纹文案拿回来做判定,用完原样回显,见下。
  const r = spawnSync(LINT_STAGED_CMD, {
    cwd: process.cwd(),
    windowsHide: true,
    shell: true,
    stdio: ['ignore', 'inherit', 'pipe'],
    encoding: 'utf8',
  })
  const stderr = String(r.stderr || '')
  if (stderr) process.stderr.write(stderr)
  return { ...r, stderrText: stderr }
}

function isEbusyShaped(res) {
  // ① 钩子这一层 spawn 自己被 EBUSY 打死。注意 errno 挂在 res.error.errno 上,
  //    res.errno 在 spawnSync 上是 undefined(2026-10-06 实测,两处都认)。
  if (res.status === null && res.signal === null) return true
  if (res.error && (res.error.errno === -4082 || res.error.code === 'EBUSY')) return true
  if (res.errno === -4082) return true
  // ⚠️ 形态锁(2026-10-06 反向实测钉住,这不是洁癖):这里的文本判定**必须锚在 Node 自己的
  //    spawn 错误句式上**,不能拿裸 "EBUSY" 子串去捞。
  //    反例是本机首版栽的:一个**真实的 eslint 报错**提交被误判成 EBUSY 形态并重试 3 次,
  //    原因是我这个 worktree 目录名 `IHUI-AI-verify-ebusy` 里的 "ebusy" 被
  //    `/EBUSY/i` 命中了 —— 路径里出现了被检索的词,于是"lint 规则不通过"被讲成了
  //    "git 子进程起不来"。那正是本票最不许发生的一类误导(把真实 lint 失败说成环境抖动,
  //    让人去查并发进程,而真正该改的是那行代码)。
  //    真实句式固定为 `spawnSync <cmd> EBUSY` / `spawn <cmd> EBUSY`(Node 生成,不可拼错),
  //    故锚 "spawn…EBUSY" 即可;`resource busy or locked` 同样是 Windows 系统的固定串。
  if (/\bspawn(?:Sync)?\s+\S*\s*EBUSY\b/i.test(res.stderrText)) return true
  if (/resource busy or locked/i.test(res.stderrText)) return true
  // ② lint-staged 内部 git 步骤的 EBUSY(被它吞进 debugLog,只留指纹文案)
  return LINT_STAGED_GIT_STEP_FINGERPRINTS.some((fp) => res.stderrText.includes(fp))
}

function runLintStaged() {
  // 用 console.info 而非 console.log:两者都写 stdout(输出逐字不变),但 info 在本仓
  // eslint 的 no-console 白名单内 —— 不给本文件新增一条告警(基线 34 条,改后仍 34 条)。
  console.info('🎨 运行 lint-staged...')
  let last = null
  for (let attempt = 0; attempt <= LINT_STAGED_EBUSY_BACKOFF_MS.length; attempt++) {
    if (attempt > 0) {
      const wait = LINT_STAGED_EBUSY_BACKOFF_MS[attempt - 1]
      console.warn(`   ↻ lint-staged 命中 EBUSY 形态,${wait}ms 后重试(第 ${attempt} 次重试)`)
      // 同步退避:本文件是全同步的 execSync 风格,不能改 async(会改掉后面几十处守门的时序)。
      // Atomics.wait 是唯一能在同步上下文里真睡的原生手段(不用第三方依赖、不 spawn 子进程 ——
      // 在一个正为 EBUSY 难受的进程里再 spawn 只会更糟)。
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
    }
    const res = spawnLintStagedOnce()
    if (res.status === 0) return true
    last = res
    if (!isEbusyShaped(res)) {
      // 不是 EBUSY 形态 ⇒ 是 lint/eslint 自己的真实判定(如 ESLint 报错)。
      // 这种情况**一个字都不能改**:它必须原样红,且不该被重试拖慢。
      console.error(`❌ lint-staged 失败,提交已阻止(非 EBUSY 形态,如为 eslint/prettier 真实报错)`)
      return false
    }
  }
  // 重试耗尽:仍然 exit 1(见调用点)。这里只负责把"为什么"讲清楚。
  console.error(`❌ lint-staged 失败,提交已阻止(EBUSY 形态,已重试 ${LINT_STAGED_EBUSY_BACKOFF_MS.length} 次仍失败)`)
  console.error(`   形态:lint-staged 的 git 步骤没跑完 —— git.exe 子进程起不来(errno -4082 EBUSY / status=null)。`)
  console.error(
    `   判据:命中 git 步骤失败指纹或 spawn EBUSY 特征,**不是** lint 规则不通过(真 lint 报错不带这些指纹)。`,
  )
  console.error(
    `   根因:本机 lint-staged 17.3.0 的 git 调用走 tinyexec(不设 stdio,git 继承 stdin 管道)。`,
  )
  console.error(
    `   已做:已给钩子这条 spawn 补 stdio 兜底 + ${LINT_STAGED_EBUSY_BACKOFF_MS.length} 次递增退避重试;仍未通过说明当前是持续句柄争用。`,
  )
  console.error(`   怎么绕(按代价从低到高):`)
  console.error(`     1) 查并发面:tasklist | findstr /i "git node" —— 杀掉残留的 git/node 进程再 commit;`)
  console.error(`     2) 原样手工复跑一次(EBUSY 是间歇病,单独跑通常就通):npx lint-staged --max-arg-length 4096 --no-stash`)
  console.error(`     3) 仍红则先看 lint-staged 自己的 git 步骤是否真有问题(别把这句 git error 当 lint 报错):`)
  console.error(`        npx lint-staged --max-arg-length 4096 --no-stash --debug`)
  if (last && last.stderrText) {
    console.error(`   ---- lint-staged stderr 原文 ----`)
    console.error(last.stderrText.trimEnd())
  }
  return false
}

// 5. lint-staged：对暂存文件运行 eslint --fix 和 prettier --write
// ⚠️ 必须带 --no-stash(2026-09-12 立,事故根治):
//   lint-staged 默认在跑任务前用 `git stash` 备份现场。本机存在「宿主清理 gitdir 嵌套目录」
//   的病理,而 **git stash 路径会连带删掉工作区之外的整个 gitdir** —— 2026-09-12 当天两次
//   实证:① `git pull --rebase` 的 autostash;② 本文件 lint-staged 的备份 stash(16:10,
//   gitdir 整目录消失、deploy 失效、需守护从备份重建)。两次事故 100% 落在 stash 路径上。
//   staging area 的安全性已由本文件顶部的 staging-snapshot 机制兜住(hook 退出前自动
//   unstage 非预期新增文件),故不需要 lint-staged 自带备份。
//   回退方式:删掉 --no-stash 即可(但请先确认宿主清理病理已消失)。
// ⚠️ 2026-10-06:这一条改走 runLintStaged()(EBUSY 兜底 + 重试),命令串与 --no-stash 原样保留,
//   lint-staged 的配置/版本/检查规则一律没动。真实 lint 失败仍然原样阻断,见 runLintStaged 内注释。
if (!runLintStaged()) {
  process.exit(1)
}

// 🎨 design-tokens → 各端 CSS 副本 自动同步(2026-07-28 立 miniapp / 2026-09-25 收口成多目标)
// 背景:改 packages/design-tokens/src/styles/tokens.css 后,端内那份 CSS 字面量副本会漂移,
//       而 NativeWind(v3)/Taro 吃的正是副本 —— 源头改了端内没跟上 = "手机上改了 web 没改"。
// 策略:在 guardian-runner 之前检测 staged 是否含 tokens.css,若有则**逐目标**跑生成器 + git add。
// 2026-09-25 为什么改结构:这段原本只服务 miniapp 一个目标,而 mobile-rn 的 `global.css` 在同文件
//       下方只做"检出漂移即拦红"、不回写 —— 同一个需求一端自动一端人工。现在抽成
//       TOKEN_SYNC_TARGETS 表 + 单一实现:加一端只加一行,**不得复制第二份** git add / 快照 /
//       失败处理(复制出去的那份正是最先腐烂的那份)。
// 前置(为什么 RN 这一行今天才敢加):生成器旧写法是整块替换,会抹掉 `.dark` 里 13 个在用的
//       `--rn-*` 端内档;已改为原位写回 + 与守门共用取值实现,详见 `scripts/sync-rn-global-css.mjs` 头注。
// 跳过方法(紧急):HUSKY_SKIP_TOKENS_SYNC=1 git commit ...
// 错误处理:生成器失败时 exit 1,不静默忽略(避免副本漂移悄悄通过)
// 无变化处理:同步后与 index 一致时跳过 git add,不报错
// staging-snapshot 协同:git add 后同步更新 INITIAL_STAGED_SNAPSHOT,避免 setupRestoreOnExit
//       把新加的文件当作"非预期 staged 文件"unstage(见 staging-snapshot.js)
const TOKENS_CSS_REL = 'packages/design-tokens/src/styles/tokens.css'
const TOKEN_SYNC_TARGETS = [
  {
    label: 'miniapp-taro app.css',
    file: 'apps/miniapp-taro/src/app.css',
    cmd: 'pnpm --filter @ihui/miniapp-taro sync-tokens',
    trigger: 'tokens',
    failMode: 'block',
    check: 'check-miniapp-tokens-sync.mjs',
  },
  {
    // 小程序原生 chrome 两份副本(2026-09-25 立项,AGENTS §4「副本一律是派生态」):
    // theme.json 是微信 darkmode 配置(app.config.ts 以 @变量 引用它,是编译期唯一源),
    // lib/theme.ts 的 THEME_CHROME 是运行期 setNavigationBarColor/setTabBarStyle 的取色。
    // 微信只认字面 hex,所以它们是"派生出的副本"而不是"该删的硬编码" —— 与 extension 那条同理。
    // file 为两个空格分隔路径:下游是 `git diff --quiet -- <file>` / `git add <file>` 的 shell 拼接,
    // 两个 pathspec 都合法;登记一个漏另一个会让第二份副本永不自动入库(两份必须同进同退)。
    // failMode=block 的依据:立项当日对真仓 --check exit 0,连跑两次写回 0 字节(幂等)。
    label: 'miniapp 原生 chrome 副本(theme.json + THEME_CHROME)',
    file: 'apps/miniapp-taro/src/theme.json apps/miniapp-taro/src/lib/theme.ts',
    cmd: 'node scripts/sync-miniapp-chrome.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
    check: 'check-miniapp-chrome.mjs',
  },
  {
    label: 'mobile-rn global.css',
    file: 'apps/mobile-rn/global.css',
    cmd: 'node scripts/sync-rn-global-css.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
    check: 'check-rn-global-css-sync.mjs',
  },
  {
    // rn-tokens.ts 的色值派生面(2026-09-25):改 tokens.css 一处,RN 侧手抄 HEX 表自动跟上。
    label: 'rn-tokens.ts 派生面',
    file: 'packages/design-tokens/src/rn-tokens.ts',
    cmd: 'node scripts/sync-rn-tokens.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
    check: 'check-cross-end-tokens.mjs',
  },
  {
    // extension 注入第三方页面的内联色(2026-09-25):它不能依赖宿主 CSS 变量,必须自带字面量,
    // 所以是"派生出的副本"而不是"该删的硬编码"。profile 走 .dark(注入层永不反转)。
    label: 'extension 注入样式色值',
    file: 'apps/extension/entrypoints/content/content-toolbar.tsx',
    cmd: 'node scripts/sync-extension-tokens.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
    check: 'sync-extension-tokens.mjs',
  },
  {
    // ALPHA_USAGE 由三端真实用量导出(2026-09-25):登记 surface 不再靠人记。
    // 触发面是**端源码**而不是 tokens.css,所以 trigger 用 v3-src;按索引面扫,才与本次提交带走的内容同形。
    // failMode=warn:生成器在"表体之外另有未提交差异"时按设计拒绝写回(那是 §12 防吞他人行的闸门,
    // 不是故障)。此时不得把别人的现场变成阻塞;正确性由守门 93 的 R6 继续兜。
    label: 'ALPHA_USAGE 用量表',
    file: 'packages/design-tokens/src/tailwind-alpha-plugin.js',
    cmd: 'node scripts/sync-alpha-usage.mjs --quiet --face staged',
    trigger: 'v3-src',
    failMode: 'warn',
    check: 'check-cross-end-tokens.mjs',
  },
]
const V3_USAGE_DIRS = ['apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/']

if (process.env.HUSKY_SKIP_TOKENS_SYNC !== '1') {
  try {
    const stagedForTokens = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: process.cwd(),
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stagedList = stagedForTokens
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
    // 每个目标自带触发面:token 派生看 tokens.css,用量派生看 v3 三端源码。
    // git 在 Windows 下可能给反斜杠路径,统一成正斜杠再比(旧实现手写两条字面量比较,加一端就漏一端)
    const triggersOn = {
      tokens: stagedList.includes(TOKENS_CSS_REL),
      'v3-src': stagedList.some((f) => V3_USAGE_DIRS.some((d) => f.startsWith(d))),
    }
    const matched = TOKEN_SYNC_TARGETS.filter((t) => triggersOn[t.trigger])
    if (matched.length === 0) {
      console.log(
        `⏭  design-tokens / 用量 派生自动同步(无 ${TOKENS_CSS_REL} 与 v3 端源码的 staged 改动, 跳过)`,
      )
    } else {
      for (const t of matched) {
        console.log(`🎨 派生自动同步:${t.label}(触发面 ${t.trigger})`)
        try {
          execSync(t.cmd, { stdio: 'inherit', cwd: process.cwd(), windowsHide: true })
        } catch {
          if (t.failMode === 'warn') {
            // 生成器在"产物文件表体之外另有未提交差异"时按设计拒绝写回(那是 §12 防吞他人行的闸门,
            // 不是故障)。这种拒绝不得变成阻塞,否则别人的现场会钉红每一次提交;正确性由守门 93 R6 兜。
            console.warn(
              `⚠️  ${t.label} 本次未自动写回(${t.cmd} 拒绝或失败)。正确性仍由守门 93 的 R6 兜底;` +
                `需要自动登记时,先收敛该文件的未提交差异,再手动跑一次该命令。`,
            )
            continue
          }
          console.error(`❌ ${t.cmd} 失败,提交已阻止`)
          console.error(
            `   请手动排查 ${t.label} 的生成器错误,或紧急跳过:HUSKY_SKIP_TOKENS_SYNC=1 git commit ...`,
          )
          process.exit(1)
        }
        // git diff --quiet -- <file>: exit 0=工作区与 index 一致(无变化); exit 1=有差异或 index 无此文件
        let hasDiff = true
        try {
          execSync(`git diff --quiet -- ${t.file}`, {
            stdio: 'ignore',
            cwd: process.cwd(),
            windowsHide: true,
          })
          hasDiff = false
        } catch {
          hasDiff = true
        }
        if (!hasDiff) {
          console.log(`  ✅ ${t.label} 同步后无变化,跳过 git add`)
          continue
        }
        try {
          execSync(`git add ${t.file}`, { stdio: 'inherit', cwd: process.cwd(), windowsHide: true })
          // 同步更新 staging 快照,避免 setupRestoreOnExit 把它当作"非预期 staged 文件"unstage
          if (INITIAL_STAGED_SNAPSHOT && typeof INITIAL_STAGED_SNAPSHOT.add === 'function') {
            INITIAL_STAGED_SNAPSHOT.add(t.file)
          }
          console.log(`  ✅ 已将同步后的 ${t.file} 加入 staged`)
        } catch {
          console.error(`❌ git add ${t.file} 失败,提交已阻止`)
          process.exit(1)
        }
      }
    }
  } catch {
    console.log('⏭  design-tokens → 各端 CSS 副本自动同步(非 git 环境, 跳过)')
  }
} else {
  console.log('⏭  design-tokens → 各端 CSS 副本自动同步(HUSKY_SKIP_TOKENS_SYNC=1, 跳过)')
}

// 1-4c, 6-29: 批量执行所有守门脚本(guardian-runner 单进程顺序执行)
// 守门项数与分级见 `node scripts/guardian-runner.mjs --help` 输出
// (项数随 guardian-runner.mjs 注册表自动变化,勿在此写死数字——写死必然过期)
// 各项 id 清单见 `node scripts/guardian-runner.mjs --help` 输出
// 正证要在**批门实际看到的那一份索引**上取值,所以这一刻才测:lint-staged 刚刚跑过,
// 索引可能已被它改写过(取早了会把"门其实没看过的文件"也算进合格证)。
try {
  const gitOut = (args) =>
    execSync(args, {
      cwd: process.cwd(),
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30_000,
      // EBUSY 根治(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败。
      // 调用点只有 `rev-parse HEAD` 与 `diff --cached --name-only`,都不吃 stdin。
      // ⚠️ 形态锁:pre-commit-hook.test.mjs 对本行的timeout 断言按字面读,
      //    改这四行属性前先看那个用例(2026-10-03 加固时已复核过,一致)。
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  ROUND.headBefore = gitOut('git rev-parse HEAD')
  ROUND.stagedFiles = gitOut('git diff --cached --name-only')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
} catch {
  /* 取不到就留空 ⇒ 这条记录对统计器等于"无从证",不会被误用 */
}
const gatesOk = run('🛡️ 运行守门脚本批量检查...', 'node scripts/guardian-runner.mjs --staged')
ROUND.gatesRan = true
ROUND.gatesPassed = gatesOk
if (!gatesOk) {
  process.exit(1)
}

// 🌐 i18n 死 key 扫描挂 pre-commit 阻塞(2026-07-26 立,PROJECT_PLAN.md §1 后续任务收尾)
// 背景:scan-dead-i18n-keys.mjs 之前仅在 pre-push dry-run + i18n-dead-key-audit.yml paths 触发,
//      漏掉"main 分支全量 PR"场景;本步在每次 commit 都跑全量扫描,死 key > 0 立即阻断。
// 判定面(2026-09-28 收口,守门 70/118 同口径):本步改为 `--staged` ⇒ **索引 blob**。
//      旧形态按磁盘判 locale JSON 与参照语料,并行会话**未暂存**的半编辑态(实测 2026-09-28:
//      apps/web/app/status/page.tsx 短暂 orphan `statusPage.*`)会把本步判红 —— 而它是批外
//      blocking,各会话唯一出路是 --no-verify,一次绕过约等于链上全部守门对该提交作废(§12e/§12f)。
//      索引面上"别人的在飞改动"结构上不存在(未 add 即不进索引),红点从此只可能来自本次提交。
//      面上取不到 ⇒ 脚本 exit 2「未判定」:不冒红也不记绿,提交同样阻止(未判定≠通过),
//      但文案点名"取材失败≠仓库有死 key",归因层可据此区分。
// 跳过方法(紧急):HUSKY_SKIP_I18N_DEAD_KEY=1 git commit ...(本步在跑之前真读该 env,见下一行判据)
// 性能(web 端 4460 个语料文件,2026-09-28 现测):磁盘档 ~1.7s;--staged 档 ~1.4s
//      (git ls-files 一次 + cat-file --batch 一次读满,反而省掉逐文件 readFileSync)。
if (process.env.HUSKY_SKIP_I18N_DEAD_KEY !== '1') {
  console.log(
    '🌐 i18n 死 key 扫描(判定面=索引 blob;死 key > 0 阻断 commit,2026-07-26 立 / 2026-09-28 收面)',
  )
  let deadKeyStatus = 0
  try {
    execSync('node scripts/scan-dead-i18n-keys.mjs --staged --exit 1', {
      stdio: 'inherit',
      cwd: process.cwd(),
      windowsHide: true,
    })
  } catch (e) {
    deadKeyStatus = typeof e.status === 'number' ? e.status : 1
  }
  if (deadKeyStatus === 2) {
    console.error('❌ i18n 死 key 扫描【未判定】(exit 2):索引面取材失败,提交已阻止。')
    console.error(
      '   这不是"仓库有死 key",是这次判不了 —— 先修 git 取材(索引锁 / 对象库)再 commit;',
    )
    console.error(
      '   未判定 ≠ 通过。确属环境故障需应急时,用 HUSKY_SKIP_I18N_DEAD_KEY=1(会在账面留下跳门痕迹)。',
    )
    process.exit(1)
  }
  if (deadKeyStatus !== 0) {
    console.error(
      '❌ i18n 死 key 扫描发现死 key,提交已阻止(请清理 packages/i18n/messages/* 中未引用的 key 后再 commit)',
    )
    process.exit(1)
  }
} else {
  console.log('⏭  i18n 死 key 扫描(HUSKY_SKIP_I18N_DEAD_KEY=1, 跳过)')
}

// 🌐 4 端 i18n 死 key 扫描(miniapp-taro / mobile-rn / extension,warn-only 起步,2026-07-26 立)
// 背景:web 端已 blocking(上方 HUSKY_SKIP_I18N_DEAD_KEY 段),其余 3 端死 key 比例高
//      (miniapp-taro 66.9% / mobile-rn 36.4% / extension 43.1%),立即 blocking 会阻塞所有 commit。
// 策略:warn-only 起步(用 || true 吞掉 exit 1),1 周后(2026-08-02)评估升级 blocking。
// 2026-09-28:与 web 步同口径收面 —— 也走 `--staged`(判索引 blob;别人的磁盘半编辑态
//      不得再进这一档的结论,升级 blocking 时才不会复刻今天这次批外恒红)。
// 跳过方法:HUSKY_SKIP_I18N_DEAD_KEY_OTHER=1 git commit ...
// 注:3 端扫描器内置 5 语言 JSON 加载,key 不一致会直接报错(隐式 parity 校验)。
if (process.env.HUSKY_SKIP_I18N_DEAD_KEY_OTHER !== '1') {
  console.log(
    '🌐 4 端 i18n 死 key 扫描(miniapp-taro/mobile-rn/extension,warn-only,判定面=索引 blob)',
  )
  for (const target of ['miniapp-taro', 'mobile-rn', 'extension']) {
    try {
      execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --staged --exit 1`, {
        stdio: 'inherit',
        cwd: process.cwd(),
        windowsHide: true,
      })
      console.log(`  ✅ ${target}: 死 key = 0`)
    } catch {
      console.warn(`  ⚠️  ${target}: 发现死 key(warn-only,不阻塞 commit;1 周后升级 blocking)`)
    }
  }
} else {
  console.log('⏭  4 端 i18n 死 key 扫描(HUSKY_SKIP_I18N_DEAD_KEY_OTHER=1, 跳过)')
}

// 🎨 miniapp-taro 跨端样式一致性守门(2026-09-03 立)
// 背景:web 与 miniapp-taro 必须视觉一致。本次重构建立守门,防止深色科技风回潮、
//       路由页漏挂 <ThemeRoot>、已删除装饰类重新引用、app.css token 块被手改。
// 阻塞规则:RULE-1a(禁用色板)/RULE-2(app.css 回归)/RULE-3(路由页 ThemeRoot)/RULE-5(删除类复用)。
// WARN 规则:RULE-1b(其他 hex)/RULE-4(tsx 内联 hex)不阻塞提交。
// 跳过方法(紧急):HUSKY_SKIP_MINIAPP_PARITY=1 git commit ...
// 判定面(2026-09-28 收口):本步跑在守门批**之外**且 blocking,旧形态把 pages/components 整片
//   按**磁盘**读 ⇒ 别人一次未暂存的 miniapp 页面就把无关提交钉红,唯一出路 --no-verify
//   (约等于链上全部守门对该提交作废,§12e/§12f)。`--staged` ⇒ 判索引 blob,红点从此只可能
//   来自本次提交;面上取不到 ⇒ 脚本 exit 2「未判定」(不冒红也不记绿),不回退磁盘。
if (process.env.HUSKY_SKIP_MINIAPP_PARITY !== '1') {
  if (
    !run(
      '🎨 miniapp-taro 跨端样式一致性守门(2026-09-03 立,判定面=索引 blob)',
      'node scripts/check-miniapp-taro-style-parity.mjs --staged',
    )
  ) {
    console.error('❌ miniapp-taro 跨端样式一致性守门失败,提交已阻止')
    console.error(
      '   修复方法:见脚本输出定位 BLOCK 级问题(禁用色板/路由页 ThemeRoot/删除类复用/app.css 回归)',
    )
    console.error('   紧急跳过: HUSKY_SKIP_MINIAPP_PARITY=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  miniapp-taro 跨端样式一致性守门(HUSKY_SKIP_MINIAPP_PARITY=1, 跳过)')
}

// 🛡️ auth refresh 单例守门(2026-09-04 立,blocking 根治刷新风暴)
// 背景:客户端 refresh token 续期必须走 @ihui/api-client 的 refreshAccessTokenOnce 全局单例,
//       禁止任何端绕过单例直接发 /auth/refresh。曾因三套互不知情的 refresh 路径 + 单例失败
//       无冷却,形成 6+ 次串行重复 → 后端 refresh token 单次轮转 + RFC 6749 §10.4 family
//       重用检测 → 整个 family 吊销 → 登录态静默丢失。
// 跳过方法(紧急):HUSKY_SKIP_AUTH_REFRESH=1 git commit ...
if (process.env.HUSKY_SKIP_AUTH_REFRESH !== '1') {
  if (
    !run(
      '🛡️ auth refresh 单例守门(禁绕过单例直发 /auth/refresh,2026-09-04 立)...',
      'node scripts/check-auth-refresh-singleton.mjs --staged',
    )
  ) {
    console.error('❌ auth refresh 单例守门失败,提交已阻止')
    console.error(
      '   修复方法:客户端续期必须走 refreshAccessTokenOnce 全局单例(见脚本输出定位违规行)',
    )
    console.error('   紧急跳过:HUSKY_SKIP_AUTH_REFRESH=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  auth refresh 单例守门(HUSKY_SKIP_AUTH_REFRESH=1, 跳过)')
}

// 16. staged typecheck 闸门(全端,2026-07-30 立,2026-08-18 根治)
// 全量 typecheck 的"失败阻塞"只针对 staged 文件:scripts/check-staged-typecheck.mjs
// 按 package 分组 + 临时 tsconfig 沿用全量 include(加载完整模块扩展,避免 TS2339
// 假阳性) + tsc 输出按行过滤,只保留错误文件 ∈ staged 的错误。
// 其他 agent 引入的非 staged 错误自动过滤不阻塞,跨端(web/api/mobile-rn/miniapp-taro/packages/*)统一。
// 紧急跳过:HUSKY_SKIP_STAGED_TYPECHECK=1 git commit ...
if (process.env.HUSKY_SKIP_STAGED_TYPECHECK !== '1') {
  if (
    !run(
      '🔍 staged typecheck 闸门(全量 include + 过滤非 staged 错误, 2026-08-18 根治)...',
      'node scripts/check-staged-typecheck.mjs --staged',
    )
  ) {
    console.error('❌ staged typecheck 失败,提交已阻止')
    console.error('   修复方法: 在对应 package 目录跑 pnpm typecheck 修复 staged 文件中的错误')
    console.error('   紧急跳过: HUSKY_SKIP_STAGED_TYPECHECK=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  staged typecheck 闸门(HUSKY_SKIP_STAGED_TYPECHECK=1, 跳过)')
}

// 16b-16e: 条件守门(非 git 环境用 try/catch 兜底,跳过)
try {
  const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
    cwd: process.cwd(),
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .filter(Boolean)

  // 16b. 条件 database 重建闸门(仅 staged 涉及 packages/database/src/ 时跑)
  // 防止"schema 加字段但 dist 未重建导致运行时字段缺失"的循环(0108 icon_svg 字段踩坑)
  // database 包的 package.json 配置 import: ./dist/index.js,运行时加载 dist 而非 src
  // typecheck 用 src 不会报错,但 api 运行时用 dist 会字段缺失
  const involvesDatabase = stagedFiles.some(
    (f) => f.startsWith('packages/database/src/') || f.startsWith('packages\\database\\src\\'),
  )
  if (involvesDatabase) {
    if (
      !run(
        '📦 条件 database 重建闸门(packages/database/src staged)...',
        'pnpm --filter @ihui/database build',
      )
    ) {
      console.error('❌ @ihui/database build 失败,提交已阻止(请修复 schema 编译错误后再 commit)')
      process.exit(1)
    }
  } else {
    console.log('⏭  条件 database 重建闸门(无 packages/database/src staged 改动, 跳过)')
  }

  // 16c. 条件 RN global.css 同步守门(仅 staged 涉及 mobile-rn/global.css 或 tokens.css 时跑)
  // 防止 mobile-rn/global.css 手抄值与 design-tokens/tokens.css 漂移
  const involvesRnTokens = stagedFiles.some(
    (f) =>
      f.includes('apps/mobile-rn/global.css') ||
      f.includes('packages/design-tokens/src/styles/tokens.css'),
  )
  // 本门 2026-09-26 收口为"默认判 HEAD blob",而提交链要审的是**这次会带走的那一份** ⇒ 必须显式
  // 传 --staged。不带面旗等于让这条钩子悄悄换成审上一提交态:生成器刚写回、已 git add 的新值
  // 不会被本步看到(它判的是 HEAD 里的旧值),这一格是"门在跑、判的不是被提交的内容"那一型。
  if (involvesRnTokens) {
    if (
      !run('🔍 RN global.css 同步守门...', 'node scripts/check-rn-global-css-sync.mjs --staged')
    ) {
      console.error(
        '❌ RN global.css 与 tokens.css 变量值不一致,提交已阻止(请同步变量值后再 commit)',
      )
      process.exit(1)
    }
  } else {
    console.log('⏭  条件 RN global.css 同步守门(无相关 staged 改动, 跳过)')
  }

  // 16d. 条件 MiniApp-Taro dist 清理提示(仅 staged 涉及 miniapp-taro 配置时 warn)
  // 防止 config 改动后 IDE 仍指向陈旧 dist/dist-alipay,误判产物路径错误
  // 仅输出提示,不阻断(用户可手动运行 node scripts/clean-miniapp-taro-dist.mjs)
  const involvesMiniappConfig = stagedFiles.some(
    (f) =>
      f.startsWith('apps/miniapp-taro/config/') ||
      f.startsWith('apps\\miniapp-taro\\config\\') ||
      f === 'apps/miniapp-taro/package.json' ||
      f === 'apps\\miniapp-taro\\package.json',
  )
  if (involvesMiniappConfig) {
    console.log(
      '\n⚠️  检测到 miniapp-taro 配置改动 → 建议清理 dist + dist-alipay 避免 IDE 缓存混淆\n' +
        '   命令: node scripts/clean-miniapp-taro-dist.mjs\n',
    )
  } else {
    console.log('⏭  条件 miniapp-taro dist 清理提示(无相关 staged 改动, 跳过)')
  }

  // 16e. 条件 miniapp-taro ICU .replace 反模式扫描(2026-07-28 立,blocking 防回退)
  // 背景:commit 09a7849b9d 修了 11 处 tt('key', '{{n}}...').replace('{{n}}', val) 反模式
  //      (LearningStreak/pay/model-plaza/share/wallet-recharge/ai-history),但缺乏拦截
  //      机制防"修复后被人改回去"。
  // 挂载 scripts/check-miniapp-replace-antipattern.mjs --staged 守门:
  //   - 3 命中规则(tt().replace / t().replace / 字符串含 {{xxx}}.replace)
  //   - 5 白名单(t(key, { variables }) / t(key, params ?? {}) / 正则 .replace 等)
  //   - 纯 Node 0 依赖,扫描 382 个文件 ~1s
  // 跳过方法(紧急):HUSKY_SKIP_MINIAPP_ICU_CHECK=1 git commit ...
  // 仅 staged 涉及 apps/miniapp-taro/src/ 时跑,避免影响其他包 commit 速度
  if (process.env.HUSKY_SKIP_MINIAPP_ICU_CHECK !== '1') {
    const stagedForIcu = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: process.cwd(),
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const involvesMiniappIcu = stagedForIcu
      .split('\n')
      .filter(Boolean)
      .some(
        (f) => f.startsWith('apps/miniapp-taro/src/') || f.startsWith('apps\\miniapp-taro\\src\\'),
      )
    if (involvesMiniappIcu) {
      if (
        !run(
          '🔍 条件 miniapp-taro ICU 反模式扫描(2026-07-28 立,blocking 防回退)...',
          'node scripts/check-miniapp-replace-antipattern.mjs --staged',
        )
      ) {
        console.error("❌ miniapp-taro 检测到 .replace('{{xxx}}') 反模式,提交已阻止")
        console.error(
          "   修复方法:把 .replace('{{n}}', val) 改为 t('key', { n: val }) 走 next-intl ICU",
        )
        console.error('   紧急跳过:HUSKY_SKIP_MINIAPP_ICU_CHECK=1 git commit ...')
        process.exit(1)
      }
    } else {
      console.log('⏭  条件 miniapp-taro ICU 反模式扫描(无 apps/miniapp-taro/src staged 改动, 跳过)')
    }
  } else {
    console.log('⏭  条件 miniapp-taro ICU 反模式扫描(HUSKY_SKIP_MINIAPP_ICU_CHECK=1, 跳过)')
  }
} catch {
  // 非 git 环境,跳过
  console.log('⏭  条件 typecheck/database 闸门(非 git 环境, 跳过)')
}

// 跨端 storage-adapter 一致性守门(node 直接跑,避免 husky 环境变量污染)
// 判定面(2026-09-28 收口):批外 blocking,旧形态按磁盘读 5 份输入 ⇒ 别人未暂存的 adapter /
//   shared auth-store 改动会钉红无关提交(§12e/§12f)。`--staged` ⇒ 判索引 blob。
if (
  !run(
    '🔗 跨端 storage-adapter parity 守门(判定面=索引 blob)...',
    'node scripts/check-cross-store-parity.mjs --staged',
  )
) {
  process.exit(1)
}

// 🛡️ button 文字换行守门(2026-07-28 立,warn-only 起步,1 周后评估升级 strict)
// 背景:小高度 button(h-4~h-8)+ 极小字号(text-xs / text-[10px])+ 中文 label 时,
//      若缺 shrink-0 / whitespace-nowrap,在 flex 父容器窄空间下会被压缩/换行,
//      导致 UI 错位 / 文字溢出 / 布局抖动。
//      真实案例:apps/web/src/components/ai/agent-task-progress-pane.tsx "对话流" / "时间线"
//      tab 按钮原缺 shrink-0,被 flex 父容器压缩。spec-panel.tsx 等 28 处待修复。
// 跳过方法(紧急,本守门挂载时已知 28 个现存命中):HUSKY_SKIP_BUTTON_WRAP_CHECK=1 git commit ...
// 检测目标:扫描 apps/ + packages/ui-react/src/ 全量 .tsx/.ts/.jsx/.js,
//      命中 4 条 AND 规则(<button> + h-4~h-8 + 极小字号 + 中文 label 缺 shrink-0 AND 缺 whitespace-nowrap)即报。
// 性能:web + ui-react 全量扫描 ~3.5s,放在 pre-commit 末尾不影响前置检查流。
// 实现细节:脚本无 --exit 1 参数,只有 --strict 模式命中 exit 1;pre-commit 用 try/catch
//      接住 --strict 的 exit 1,转为 warn(不阻塞 commit),1 周后(2026-08-04)评估升级 strict 阻塞。
if (process.env.HUSKY_SKIP_BUTTON_WRAP_CHECK !== '1') {
  try {
    execSync('node scripts/check-shrinkable-text-button.mjs --strict', {
      stdio: 'inherit',
      cwd: process.cwd(),
      windowsHide: true,
    })
    console.log('  ✅ button 文字换行守门通过(0 命中)')
  } catch {
    console.warn('  ⚠️  button 文字换行守门发现命中(warn-only,不阻塞 commit;1 周后升级 strict)')
    console.warn('     修复方法:给 button className 补 shrink-0 + whitespace-nowrap')
    console.warn('     详细清单已打印在上方,紧急跳过:HUSKY_SKIP_BUTTON_WRAP_CHECK=1')
  }
} else {
  console.log('⏭  button 文字换行守门(HUSKY_SKIP_BUTTON_WRAP_CHECK=1, 跳过)')
}

// 🦶 SiteFooter 守门(2026-07-30 立,blocking 防 v10/v11 回退)
// 背景:SiteFooter v10(拉高放宽 + 放大 icon/QR/ICP)+ v11(国际/国产模型分组)涉及
//      7 个关键 class(py-2 md:py-3 / h-7 w-7 / h-16 w-16 / h-5 w-5 ICP / lg:grid-cols-5 /
//      5 分组 / INTERNATIONAL_MODELS+CHINESE_MODELS 拆分),改完已两次被其他 agent
//      commit 部分回退,本守门在每次 commit 时跑,确保关键 class + 5 语言 i18n key 完整。
// 跳过方法(紧急):HUSKY_SKIP_FOOTER_GUARD=1 git commit ...
// 性能:仅读 5 个 i18n 文件 + SiteFooter.tsx + footer-data.ts,~300ms 跑完。
// 判定面(2026-09-28 收口):批外 blocking,旧形态把这 7 份输入按**磁盘**读 —— 5 个 web 语言包
//   是全仓并发写入最热的面之一,别人一次未暂存的 footer 键改动就钉红无关提交(§12e/§12f)。
//   `--staged` ⇒ 7 份输入同一次 cat-file --batch 取自索引 blob;面上取不到 ⇒ exit 2「未判定」。
// 阻断条件:1) SiteFooter 关键 class 缺失;2) ECOSYSTEM_GROUPS 不是 5 分组;
//         3) 5 语言 footer 命名空间任一 key 缺失或为空。
if (process.env.HUSKY_SKIP_FOOTER_GUARD !== '1') {
  if (
    !run(
      '🦶 SiteFooter 守门(防 v10/v11 回退, 5 语言 i18n + 关键 class, 2026-07-30 立;判定面=索引 blob)...',
      'node scripts/check-site-footer.mjs --staged',
    )
  ) {
    console.error(
      '❌ SiteFooter 守门失败,提交已阻止(防 v10/v11 关键 class / 5 分组 / i18n key 被回退)',
    )
    console.error('   修复方法:检查 SiteFooter.tsx / footer-data.ts / 5 语言 footer 命名空间')
    console.error('   紧急跳过:HUSKY_SKIP_FOOTER_GUARD=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  SiteFooter 守门(HUSKY_SKIP_FOOTER_GUARD=1, 跳过)')
}

// 🚪 createPortal 定位守门(2026-09-07 立,blocking)
// 背景:同日实修 4 处同型根因——createPortal popover 容器挂 style={{top,left}}
//      但缺 position:fixed,portal 到 body 后 top/left 静默失效
//      ("弹层位置漂移/点击没反应")。规则早已写入 AGENTS.md 但无守门,
//      本脚本把文档规则升级为强制门禁。
// 跳过方法(紧急):HUSKY_SKIP_PORTAL_GUARD=1 git commit ...
if (process.env.HUSKY_SKIP_PORTAL_GUARD !== '1') {
  if (
    !run(
      '🚪 createPortal 定位守门(portal 容器必显式 position:fixed, 2026-09-07 立)...',
      'node scripts/check-portal-fixed.mjs --staged',
    )
  ) {
    console.error('❌ createPortal 定位守门失败,提交已阻止')
    console.error('   修复:portal 容器 style 加 position: "fixed"(或 className 加 fixed 类)')
    console.error('   紧急跳过:HUSKY_SKIP_PORTAL_GUARD=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  createPortal 定位守门(HUSKY_SKIP_PORTAL_GUARD=1, 跳过)')
}

// 📏 Button 高度/宽度覆盖守门(2026-09-07 立,blocking)
// 背景:Button className h-* 覆盖 size 档位导致全站按钮高度参差(发布账号页 4 钮 h-7/h-9 混用),
//      2026-09-07 已全量迁移 130 处/56 文件至 size 档位。本守门防止回潮:
//      <Button> 禁止 className h-*/w-* 覆盖 + size 值必须 ∈ 档位表。
//      豁免:原生 <button>(IDE 面板 24px 紧凑档有意设计)、Input/SelectTrigger/Skeleton。
// 跳过方法(紧急):HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1 git commit ...
if (process.env.HUSKY_SKIP_BUTTON_HEIGHT_GUARD !== '1') {
  if (
    !run(
      '📏 Button 高度/宽度覆盖守门(必须走 size 档位, 2026-09-07 立)...',
      'node scripts/check-button-height.mjs',
    )
  ) {
    console.error('❌ Button 高度/宽度覆盖守门失败,提交已阻止')
    console.error('   修复方法:改用 size 档位(见脚本输出);新高度先在 button.tsx size 表立档')
    console.error('   紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  Button 高度/宽度覆盖守门(HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1, 跳过)')
}

// 🔑 凭据前缀一致性守门(2026-09-13 立,blocking)
// 背景:IHUI 对外 API 的 Bearer 只能用公开标识 `ihui_xxx`;`sk_xxx`(secret)只走 X-Api-Secret 头。
//      2026-09-13 生产实测确认 `Bearer sk_...` 必 401,而当时 8 个 UI 页面/文档把 Bearer 写成
//      `sk-xxx`,新用户照抄文档接入必然失败。本守门防止回潮。
// 跳过方法(紧急):HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD=1 git commit ...
if (process.env.HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD !== '1') {
  if (
    !run(
      '🔑 凭据前缀一致性守门(Bearer 只能用 ihui_xxx, 2026-09-13 立)...',
      'node scripts/check-api-credential-prefix.mjs --staged',
    )
  ) {
    console.error('❌ 凭据前缀一致性守门失败,提交已阻止')
    console.error('   修复:Authorization: Bearer 一律 ihui_xxx;sk_xxx 仅用于 X-Api-Secret')
    console.error('   权威说明:docs/developer/getting-started/authentication.md')
    console.error('   紧急跳过:HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  凭据前缀一致性守门(HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD=1, 跳过)')
}

// 🐧 PowerShell 版本声明守门(2026-09-15 立,blocking)
// 背景:项目内 .ps1 必须首行 `#requires -Version 7`,强制 pwsh 7+,
//      弃用 EOL 的 Windows PowerShell 5.1(编码/解析已知 bug)。
//      全仓已于 2026-09-15 清零(隔离归档已排除);staged 模式守住新增/修改。
// 跳过方法(紧急):HUSKY_SKIP_PWSH_VERSION_GUARD=1 git commit ...
if (process.env.HUSKY_SKIP_PWSH_VERSION_GUARD !== '1') {
  if (
    !run(
      '🐧 PowerShell 版本声明守门(.ps1 必须 #requires -Version 7)...',
      'node scripts/check-pwsh-version.mjs --staged',
    )
  ) {
    console.error('❌ PowerShell 版本声明守门失败,提交已阻止')
    console.error('   修复:每个 .ps1 首行加 #requires -Version 7')
    console.error('   紧急跳过:HUSKY_SKIP_PWSH_VERSION_GUARD=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  PowerShell 版本声明守门(HUSKY_SKIP_PWSH_VERSION_GUARD=1, 跳过)')
}

// 🔌 Agent Engine 协议 parity 守门(2026-09-18 立,blocking)
// 背景:P2-③ JSON-RPC 编排引擎的方法名/通知名/错误码同时存在于三处 —— 引擎 handler 表
//      (apps/ai-service/app/services/agent_engine.py)+ TS 编程编排层(packages/sdk/src/
//      agent-engine.ts)+ Python 编程编排层(packages/sdk/python/ihui_ai/agent_engine.py)。
//      单边改名会让第三方调用方到运行时才炸,故三方静态对齐后才允许提交。
// 跳过方法(紧急):HUSKY_SKIP_AGENT_ENGINE_PARITY=1 git commit ...
if (process.env.HUSKY_SKIP_AGENT_ENGINE_PARITY !== '1') {
  if (
    !run(
      '🔌 Agent Engine 协议 parity 守门(引擎 handler 表 ↔ TS ↔ Python)...',
      'node scripts/check-agent-engine-parity.mjs --quiet --staged',
    )
  ) {
    console.error('❌ Agent Engine 协议 parity 守门失败,提交已阻止')
    console.error('   修复:三方同步改动 engine handler 表 / TS 常量 / Python 常量')
    console.error('   紧急跳过:HUSKY_SKIP_AGENT_ENGINE_PARITY=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  Agent Engine 协议 parity 守门(HUSKY_SKIP_AGENT_ENGINE_PARITY=1, 跳过)')
}

// 🔧 工具注册表完整性守门(2026-09-26 立,blocking;V3 #49)
// 背景:ai-service 的 fs 类工具有两个相交但不等的**可达面** —— 本地注册面
//      (mcp_server._TOOL_HANDLERS)与浏览器委托面(apps/web workspace-tool-executor.ts,
//      仅当请求带 workspace_context 时可用)。`apply_patch` / `create_file` /
//      `delete_file` / `move_file` 只在后者存在,桌面端/本地工作区下调它们会走到
//      _mcp.call_tool 拿到模糊的「未知工具」,模型只能原地重试到迭代打满。
//      切面(_DELEGATE_ONLY_TOOLS / _TOOL_ALIASES / _FS_DEPENDENT_TOOLS)任何一侧
//      单边改名前 llm.py 与三个事实源必须对得上,否则漂移在提交时即被拦下。
// 跳过方法(紧急):HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY=1 git commit ...
if (process.env.HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY !== '1') {
  if (
    !run(
      '🔧 工具注册表完整性守门(工具可达面 ↔ 本地注册表 ↔ 前端委托实现)...',
      'node scripts/check-tool-registry-integrity.mjs --quiet --staged',
    )
  ) {
    console.error('❌ 工具注册表完整性守门失败,提交已阻止')
    console.error('   修复:三面对齐 —— llm.py 的 _FS_DEPENDENT_TOOLS / _DELEGATE_ONLY_TOOLS /')
    console.error(
      '        _TOOL_ALIASES ↔ mcp_server._TOOL_HANDLERS ↔ workspace-tool-executor.ts 的 case',
    )
    console.error('   自检: node scripts/check-tool-registry-integrity.mjs --self-test')
    console.error('   紧急跳过:HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  工具注册表完整性守门(HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY=1, 跳过)')
}

// 📋 能力矩阵对账守门(2026-09-26 立,blocking;V3 #57)
// 背景:ai-service 存在 76 个 feature env(开关/灰度/门控三类),散落各处且多数默认关
//      ——之前没人能一句话说清「生产上哪些能力是关的」。capability_matrix.py 是台账
//      单一事实源;本门断言代码库新增的默认关 env 必须登记进台账(漏登即红),
//      防止「移植完成但线上从不跑」的能力再次无感堆积。
// 跳过方法(紧急):HUSKY_SKIP_CAPABILITY_MATRIX=1 git commit ...
// 判定面(2026-09-28 收口):批外 blocking,旧形态把 apps/ai-service/app 下全部 .py 按**磁盘**读
//   ⇒ 别人一个未暂存、还没登记进台账的默认关 env 就把无关提交钉红(§12e/§12f)。
//   `--staged` ⇒ 清单与内容同面同轮取自索引 blob;取不到 ⇒ exit 2「未判定」,不回退磁盘。
if (process.env.HUSKY_SKIP_CAPABILITY_MATRIX !== '1') {
  if (
    !run(
      '📋 能力矩阵对账守门(默认关 env 必须登记台账;判定面=索引 blob)...',
      'node scripts/check-capability-matrix.mjs --quiet --staged',
    )
  ) {
    console.error('❌ 能力矩阵对账守门失败,提交已阻止')
    console.error(
      '   修复:在 apps/ai-service/app/core/capability_matrix.py 补登记(含 category/reason),',
    )
    console.error('   或该 env 本不该默认关 —— 改默认值前先查有没有灰度体系与钉住它的测试')
    console.error('   紧急跳过:HUSKY_SKIP_CAPABILITY_MATRIX=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  能力矩阵对账守门(HUSKY_SKIP_CAPABILITY_MATRIX=1, 跳过)')
}

// 🖥️ 桌面端事件链路接线守门(2026-09-22 立,blocking)
// 背景:用户反馈"托盘右键菜单『切换主题』/『打开设置』点击没任何反应"。根因是三层事件链
//      的第 3 层断裂 —— Rust emit → use-desktop.ts 转 CustomEvent → **无任何 addEventListener
//      消费方**,dispatch 成功但零副作用;Rust 侧 `let _ = window.emit(...)` 又吞掉返回值,
//      日志查不到,只能肉眼 diff 三层源码。同类问题还命中了系统级快捷键 Ctrl+Shift+S。
//      本守门把「Rust emit ⊆ 桥接 listen ⊆ 桥接 case ⊆ 前端消费方」升级为强制门禁,
//      任一层断裂即阻断,防止"点了没反应"再次静默上线。
// 跳过方法(紧急):HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...
if (process.env.HUSKY_SKIP_DESKTOP_EVENT_WIRING !== '1') {
  if (
    !run(
      '🖥️ 桌面端事件链路接线守门(Rust emit → 桥接 → 前端消费方, 2026-09-22 立)...',
      // 必须带 --staged:本门不走 guardian-runner,拿不到它统一追加的面旗。
      // 不带时它判的是 HEAD blob ⇒ 提交链上审的是**上一提交态**,本次刚改的接线看不见。
      'node scripts/check-desktop-event-wiring.mjs --staged',
    )
  ) {
    console.error('❌ 桌面端事件链路接线守门失败,提交已阻止')
    console.error(
      '   修复:补齐缺失的一层接线 —— 最常见是 CustomEvent 派发了但没有 addEventListener 消费方',
    )
    console.error('   紧急跳过:HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...')
    process.exit(1)
  }
} else {
  console.log('⏭  桌面端事件链路接线守门(HUSKY_SKIP_DESKTOP_EVENT_WIRING=1, 跳过)')
}

console.log('✅ Pre-commit 检查通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
