// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── post-commit 钩子正文(2026-10-16 由 .husky/post-commit 整体迁入) ─────────────
// 迁入立因:.husky/post-commit 原是 #!/usr/bin/env node 脚本 ⇒ 钩子被 spawn 时的 PATH
// 里没有 node 就整层静默死(Git for Windows 回落用 sh 解释,第 2 行 JS 注释即报
// syntax error;post-commit 不拦提交 ⇒ safe-commit 照样打"将自动推送"提示行,
// 自动推送/归档/自愈腿的死亡无声 —— 实测同日 13:04 跑过、13:15 死,随触发方 env 浮动)。
// 根治:与 .husky/pre-commit 同型 —— 正文整体迁到本文件,薄壳(.husky/post-commit,sh)
// 经 scripts/hook-run-hidden.vbs 启动,把死法变响(失败进 .ihui-agent/state/hook-logs/post-commit.log)。
// 本文件由薄壳直启,不被 import;段编号、日志 label、跳过 env(HUSKY_SKIP_* 族)与迁入前逐字一致。
//
// ─── 0. git 写锁(2026-08-06 立,根治多 agent 并发写损坏) ─────
// safe-commit.mjs 已持锁(通过 IHUI_GIT_LOCK_UNIT 环境变量传给子进程)则跳过;
// 直接 git commit(未走 safe-commit)时在此获取锁,整个 post-commit 脚本链串行化。
// finally 保证任意退出路径都释放锁(等价于原 sh 的 trap EXIT)。
//
// ─── 弹窗根治 v2(2026-09-23,用户:"错误框要彻底修复解决 别总弹了") ──
// 2026-09-22 的第一版做法是把 5 个裸 node 改成
// `wscript //nologo scripts/hook-run-hidden.vbs <label> <cmd…>`(GUI 子系统 +
// shell.Run(…,0,True) SW_HIDE)。它治住了黑窗,却引入一个**外部单点**:
// 该 .vbs 一旦不在,每次 commit 就弹 8 枚 WSH"无法找到脚本文件"错误框
// (2026-09-23 实机发生:并发会话在工作树删了它,本钩子尚未迁完)。
//
// 本版把钩子本身改成 Node —— 与仓库既有的 `.husky/pre-commit`(同为
// `#!/usr/bin/env node`)同形态 —— 每个子进程直接
// `execSync(cmd,{stdio:…,windowsHide:true})`。两条性质同时成立且**不再依赖
// 任何外部包装文件**:① 无可见控制台窗口(windowsHide 显式传,不依赖 §5b
// 机器级 NODE_OPTIONS 钩子,后者对 sh→node 派生链无效);② 没有可被误删的
// .vbs,弹窗在机制上不可能。
// 输出仍按 label 落 `.ihui-agent/state/hook-logs/<label>.log`,与原行为一致。
const { execSync, spawn, spawnSync } = require('child_process')
const {
  mkdirSync,
  appendFileSync,
  readFileSync,
  existsSync,
  openSync,
  copyFileSync,
  statSync,
} = require('fs')
const { join } = require('path')
// G-927(2026-10-22):git 派生改走共用层(绝对路径 git + 显式 stdio + quotepath + timeout)。
// require(esm) 在本仓 engines(node >=22.13)下免旗标可用;层无顶层 await。
const { gitRaw } = require('./face-reader.mjs')

// ─── GIT_DIR 去污(2026-10-01,同 pre-commit-hook.js 同款病理根治)───
// IDE(Trae)git 扩展注入的 GIT_DIR 指向 worktree 之外的 gitdir,会让本钩子
// 派生的守门子 git 丢 work-tree 上下文。delete 后经 cwd 发现同一仓库。
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

// ⚠ 本机铁律(2026-10-12 实证):Node 派生的 cmd.exe 子进程**必须**显式 stdio,
//   默认三 pipe 在本机 100% spawnSync EBUSY(-4082)—— A11 那枚 commit 的 post-commit
//   就是死在这一行:execSync 内部走 cmd.exe,没给 stdio ⇒ 钩子整体崩在 push guard 之前,
//   commit 落了地但**自动推送整段静默跳过**(靠 guardian 补推才没丢)。runLogged 里的
//   execSync 一直都带 stdio(第 59 行),漏的只有这两个顶层调用。
//   2026-10-22 G-927:rev-parse 改走 face-reader 的 gitRaw(层内已收口 stdio/绝对路径 git),
//   本文件不再持有裸 'git' 派生;git-lfs 探测那枚是另一支二进制,原样保留显式 stdio。
const ROOT = gitRaw(['rev-parse', '--show-toplevel'], process.cwd()).trim()
process.chdir(ROOT)
const LOG_DIR = join(ROOT, '.ihui-agent', 'state', 'hook-logs')
mkdirSync(LOG_DIR, { recursive: true })

// 跑一条命令:全量输出(含 stderr)落 <label>.log,返回是否成功。
// timeout 为硬上限毫秒(等价原 `timeout 60`),超限按失败处理。
function runLogged(label, cmd, { timeout = 0, env = {} } = {}) {
  const logFile = join(LOG_DIR, `${label}.log`)
  let out = ''
  let ok = true
  try {
    out =
      execSync(cmd, {
        encoding: 'utf8',
        cwd: ROOT,
        windowsHide: true,
        timeout,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
      }) || ''
  } catch (e) {
    ok = false
    out = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`
  }
  try {
    appendFileSync(logFile, `\n===== ${new Date().toISOString()} ${label} ok=${ok} =====\n${out}`)
  } catch {
    /* 日志写失败不得影响钩子主流程 */
  }
  return ok
}

let LOCK_UNIT = ''
function releaseLock() {
  if (!LOCK_UNIT) return
  const u = LOCK_UNIT
  LOCK_UNIT = ''
  runLogged(
    'post-commit-lock-release',
    `node scripts/git-lock.mjs release --unit ${JSON.stringify(u)}`,
  )
}
// exit / SIGINT / SIGTERM 三条退出路径都要释放(同 scripts/lib/staging-snapshot.js 口径)
process.on('exit', releaseLock)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    releaseLock()
    process.exit(1)
  })
}

// ─── 0. 获取 git 写锁 ───────────────────────────────────────
if (!process.env.IHUI_GIT_LOCK_UNIT) {
  LOCK_UNIT = `post-commit-${process.pid}-${Date.now()}`
  const ok = runLogged(
    'post-commit-lock',
    `node scripts/git-lock.mjs acquire --unit ${JSON.stringify(LOCK_UNIT)} --timeout 180000`,
  )
  if (!ok) {
    LOCK_UNIT = '' // 未拿到锁就不该去释放(等价原 sh:trap 在 acquire 成功之后才登记)
    console.error(
      '❌ 获取 git 写锁失败(有其他写操作进行中,稍后重试或检查 .git/ihui-git-write.lock;详见 .ihui-agent/state/hook-logs/post-commit-lock.log)',
    )
    process.exit(1)
  }
}

// ─── 1. Git LFS post-commit(原有) ──────────────────────────
// 同第 41 行铁律:spawnSync 默认 stdio 在本机同样 EBUSY(三 pipe 无 input),显式给。
const lfs = spawnSync('git-lfs', ['version'], {
  encoding: 'utf8',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
if (lfs.error || lfs.status !== 0) {
  console.error(
    "\nThis repository is configured for Git LFS but 'git-lfs' was not found on your path. " +
      "If you no longer wish to use Git LFS, remove this hook by deleting the 'post-commit' file in the hooks directory " +
      "(set by 'core.hookspath'; usually '.git/hooks').\n",
  )
  process.exit(2)
}
runLogged(
  'post-commit-lfs',
  `git lfs post-commit ${process.argv
    .slice(2)
    .map((a) => JSON.stringify(a))
    .join(' ')}`,
)

// ─── 2. 自动归档已完成任务 —— 已退役(2026-10-16 机主令:完成即删,不存档) ──────
// 原第 2 段(ledger-strip 排空 + archive-completed-tasks --auto-commit)整体摘除。
// 台账新语义 = 活队列:`- [x]` 翻勾后即可删行,守门 71 判据已同步改为"已勾行不进保护集"
// (markerOf 顶部),删除不再被判丢、也不被回捞。`pnpm archive` 手动入口一并摘除。

// ─── 3. 自动 push guard(AGENTS.md §20, 2026-07-20 立) ──────
// 背景: 历史上多次出现 agent "commit 后忘记 push" 协作事故。
// 任何 `git commit` 成功后, 自动检测本地 ahead, 立即推送, 并验证 local == remote HEAD。
// 跳过: HUSKY_SKIP_PUSH=1(紧急本地暂存场景, 不推荐)
if (process.env.HUSKY_SKIP_PUSH === '1') {
  console.log('⚠️  HUSKY_SKIP_PUSH=1 — 已跳过自动 push(commit 仅落地本地, 需手动 git push)')
} else {
  const ok = runLogged('post-commit-push-guard', 'node scripts/git-push-guard.mjs')
  if (!ok) {
    console.error('❌ git-push-guard 失败, commit 仅落地本地(未推送到 origin)')
    console.error('   修复后请手动: git push origin main')
    console.error('   失败详情: .ihui-agent/state/hook-logs/post-commit-push-guard.log')
    process.exit(1)
  }
}

// ─── 4. 项目外污染巡查 + 自动清理(2026-07-24 立, AGENTS.md §15 运行时禁令) ──
// 每次 commit 后立即巡查项目父目录 / 桌面 / 用户主目录是否有 agent 创建的污染文件
// 自动清理文件名强信号命中(search_*.ps1 / *_result.txt 等),内容双信号命中只 warn
// 跳过: HUSKY_SKIP_HYGIENE=1(紧急场景)
// 非阻塞: 巡查失败不影响 commit(已落地)和 push(已由第 3 段处理)
if (process.env.HUSKY_SKIP_HYGIENE !== '1') {
  runLogged('post-commit-pollution', 'node scripts/check-parent-pollution.mjs --auto-clean --quiet')
}

// ─── 5. Lost commit tag 自动同步(2026-07-26 立, AGENTS.md §22 + docs/lost-commit-archive.md) ─
// 背景: 2026-07-26 真实事故: 本地 lost-commit/* tag 被 git gc 清理, 远端虽有但 fetch 失败。
//       关键教训: tag 必须主动 push + 主动 fetch, 否则 git gc 14 天后丢失。
// 机制: commit 后把"远端缺失"的 tag 增量推送到 origin(2026-10-14 起覆盖**全部命名空间**;分块 --atomic)。
// 跳过: HUSKY_SKIP_TAG_SYNC=1(紧急场景)
// 非阻塞: push 失败不阻断 commit(已落地)和 push(已由第 3 段 git-push-guard 处理)
//
// 2026-09-17 根治(用户反馈"推送早就完成了,终端却一直挂着等"):
//   旧行为 = 每次 commit 后**全量**同步 `git push --atomic`(约 5000 个 tag),
//   耗时 10~15 分钟,把 post-commit 阻塞成"假死";外层 shell 任务因此迟迟不退出。
//   新行为 = ①脚本内部只推远端缺失项(通常 0~3 个,秒级)+ 限流标记;
//            ②此处再加 60s 硬上限 —— 无论远端多慢/网络多差,该段最多占用 60s
//              即结束,绝不阻塞提交与后续流程。
//   2026-09-23 附注:硬上限现在直接杀该 node 进程本身(execSync timeout),
//   不再像旧版那样只杀 wscript 而把 cmd/node 子进程留在后台跑完。
if (process.env.HUSKY_SKIP_TAG_SYNC !== '1') {
  const ok = runLogged(
    'post-commit-tag-sync',
    'node scripts/sync-lost-commit-tags.mjs --auto-push',
    { timeout: 60000 },
  )
  if (!ok) {
    console.log(
      '⚠️  tag 同步超时/失败(非阻塞, commit 已落地并 push 到 branch; 需补推时: node scripts/sync-lost-commit-tags.mjs --auto-push --force)',
    )
  }
}

// ─── 7. 快档延后守门补跑(2026-10-21 立,配合 pre-commit 的 35s 硬预算)────────────
// pre-commit 快档到点后,未跑完的门写进 gates-deferred.json;这里 **detached** 补跑全量,
// 不阻塞本次提交返回,结果落 gates-deferred-run.log。提交已落地 ⇒ 这里失败只留日志不阻断。
// 跳过:HUSKY_SKIP_DEFERRED_GATES=1
if (process.env.HUSKY_SKIP_DEFERRED_GATES !== '1') {
  const deferredFile = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'gates-deferred.json')
  if (existsSync(deferredFile)) {
    try {
      const j = JSON.parse(readFileSync(deferredFile, 'utf8'))
      if (j && Array.isArray(j.gates) && j.gates.length > 0) {
        const outLog = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'gates-deferred-run.log')
        const fd = openSync(outLog, 'w')
        // 索引快照(2026-10-22 修正):补跑会大量派生 git 且长期持有**主索引锁**,实测把后续
        // 提交卡在 "Unable to create index.lock"(13 个 git 进程 + 1.85MB 僵尸锁)。
        // 这里先把索引复制一份,补跑用 GIT_INDEX_FILE 指向快照 —— 读到的是同一份暂存面,
        // 锁的是快照文件,与主索引零竞争。快照读失败就退回主索引(宁可慢,不能丢判据)。
        let envExtra = {}
        try {
          const dotGit = join(ROOT, '.git')
          let gitDir = dotGit
          if (!statSync(dotGit).isDirectory()) {
            const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)
            if (m && m[1]) gitDir = m[1].trim()
          }
          const snapDir = join(ROOT, '.ihui-agent', 'tmp')
          mkdirSync(snapDir, { recursive: true })
          const snapshot = join(snapDir, `index-snapshot-${Date.now()}`)
          copyFileSync(join(gitDir, 'index'), snapshot)
          envExtra = { GIT_INDEX_FILE: snapshot }
        } catch {
          /* 快照失败 ⇒ 用主索引(与旧行为一致),不阻断补跑 */
        }
        const child = spawn(process.execPath, ['scripts/guardian-runner.mjs', '--staged'], {
          cwd: ROOT,
          detached: true,
          stdio: ['ignore', fd, fd],
          windowsHide: true,
          env: { ...process.env, IHUI_GATE_FAST: '0', ...envExtra },
        })
        child.unref()
        console.log(`⏱  快档延后的 ${j.gates.length} 门已在后台补跑(日志:${outLog})`)
      }
    } catch {
      /* 补跑派发失败不影响提交(提交已落地) */
    }
  }
}

// ─── 8. 四端 i18n 死 key 扫描(2026-10-22 从 pre-commit 移来)────────────────────
// 本档一直是 warn-only(从不阻断提交),却实测占 8.3s 用户等待 ⇒ 移到这里:整条 post-commit
// 已 detached 后台执行,判据与开关一字未动。要回 pre-commit:HUSKY_SKIP_I18N_DEAD_KEY_OTHER=0。
if (process.env.HUSKY_SKIP_I18N_DEAD_KEY_OTHER !== '0') {
  for (const target of ['miniapp-taro', 'mobile-rn', 'extension']) {
    runLogged(
      `post-commit-i18n-${target}`,
      `node scripts/scan-${target}-dead-i18n-keys.mjs --staged --exit 1`,
      {
        timeout: 120000,
      },
    )
  }
}

// ─── 9. README 自动同步(2026-10-22 从 pre-commit 移来)──────────────────────────
// 这两段会 `git add` README,与 pre-commit 之后的 O43②「钩子运行期外来件」护栏**结构性冲突**
// —— 护栏拒发"钩子窗口期新进索引、又不在本票声明集里"的文件,而这两段每轮都 add README,
// 实测连续 4 次提交被同一道护栏拒发。移到这里后提交不再被拦;README 的更新落在工作区,
// 随下一次触及 README 的提交带上。
// 跳过:HUSKY_SKIP_POST_README=1(注意与 pre-commit 那个 HUSKY_SKIP_README_* 不是一回事:
// 那两个是"是否在 pre-commit 跑",默认 1=不跑;这里是"是否在 post-commit 跑",默认跑)。
if (process.env.HUSKY_SKIP_POST_README !== '1') {
  runLogged('post-commit-readme-numbers', 'node scripts/sync-readme-numbers.mjs', {
    timeout: 120000,
  })
  runLogged('post-commit-readme-recent', 'node scripts/auto-update-readme-recent.mjs', {
    timeout: 120000,
  })
}

// ─── 6. 计划登记行自动回捞(2026-09-22 立,守门 71 的自愈面) ────────────────────
// 为什么放 post-commit 而不是只靠 pre-commit:并发会话 routinely 用 --no-verify 提交,
// pre-commit 那道闸(pre-commit #71)会被一起跳过;而"按内存里旧计划文档整文件提交"
// 把别人已入库的登记行抹掉,一小时内就发生了两次(第三次靠人工回捞)。
// post-commit 即使 --no-verify 也会跑 → 这里做自愈:扫最近历史,把消失的登记行
// 按原文插回(只加不减),提交用 HEAD 基线的临时 index + commit-tree(不代收工作区里
// 别人尚未提交的内容),并交给 git-push-guard 推送。
// 防递归:回捞提交带 IHUI_PLAN_HEAL_COMMIT=1;跳过:HUSKY_SKIP_PLAN_HEAL=1
if (process.env.IHUI_PLAN_HEAL_COMMIT !== '1' && process.env.HUSKY_SKIP_PLAN_HEAL !== '1') {
  // 结论必须留痕:上一版把输出丢进 /dev/null 并 `|| true`,而提交命令里 rev-parse/hash-object
  // 未 .trim() 使自愈**自上线起一次都没成功过**却毫无声响(2026-09-23 才在临时仓库 A/B 抓到)。
  runLogged('post-commit-plan-heal', 'node scripts/check-plan-line-loss.mjs --heal --commit', {
    timeout: 90000,
    env: { IHUI_PLAN_HEAL_COMMIT: '1' },
  })
  const healLog = join(ROOT, '.ihui-agent', 'state', 'plan-heal.log')
  if (existsSync(healLog)) {
    try {
      const lines = readFileSync(healLog, 'utf8').split(/\r?\n/)
      const kept = lines.slice(-401).join('\n')
      if (kept !== lines.join('\n')) {
        const tmp = `${healLog}.tmp`
        require('fs').writeFileSync(tmp, `${kept}\n`)
        require('fs').renameSync(tmp, healLog)
      }
    } catch {
      /* 日志截断失败不影响主流程 */
    }
  }

  // 任务状态分叉自愈(2026-09-26 立,守门 130 的第二层)
  // 为什么 pre-commit 那道门不够:并发改计划文档的会话 routinely 用 --no-verify,pre-commit
  // 被一起跳过;而"按内存里旧计划文档整文件提交"会把刚归并好的行原样复活 —— 实测本票第一次
  // 落地(118 行)在同一小时内就被一次这样的回写吞掉,108 行 [归并] 从 HEAD 全部消失。
  // 判据在 pre-commit 会红给下一个人(还不是他的债),修必须挂在这里。
  // 递归:提交走 commit-tree + update-ref,钩子结构性不跑;仍带 IHUI_PLAN_STATE_HEAL_COMMIT
  // 供判读。跳过:HUSKY_SKIP_PLAN_STATE_HEAL=1
  if (
    process.env.IHUI_PLAN_STATE_HEAL_COMMIT !== '1' &&
    process.env.HUSKY_SKIP_PLAN_STATE_HEAL !== '1'
  ) {
    runLogged('post-commit-plan-state-heal', 'node scripts/plan-tasks-merge.mjs --heal --commit', {
      timeout: 120000,
      env: { IHUI_PLAN_STATE_HEAL_COMMIT: '1' },
    })
  }
}

// ─── 10. 跨端登记自动链路 —— web↔RN↔小程序 登记表自动追加(2026-10-25 立)─────────
// (任务口径把这条叫"第 7 段";本文件 7 号已被上面「快档延后守门补跑」占,0 号更有两处,
//  故按末尾续号登记为 10,不再添第三处重号。)
// 立因(AGENTS.md §0.9「判据必须在真跑它的那一刻才成立:造好没装车 = 没有」):
//   scripts/auto-register-cross-end.mjs 造完即**无人调用**—— 2026-10-25 现读:该名字在
//   .husky/、scripts/guardian-runner.mjs、scripts/lib/pre-commit-hook.js、根 package.json
//   四处零命中,只有它自己那一行注释。两条跨端登记表(scripts/data/web-rn-screen-map.jsonl
//   与 scripts/data/cross-end-screen-registry.json)因此只能靠人工逐条登记,追不上屏的增长
//   (web 路由 / 共享屏 / 小程序页计数一律现读,口径同该脚本头注,本文不复制读数)。
// 为什么挂 post-commit 而不是 pre-commit:
//   ① 本腿写的是**工作树**(map/registry 追加 + 给小程序页源码插镜像标记)。pre-commit 里动
//      工作树,会赶上别人正在 add 的同一批文件被卷进暂存面(§12 多会话同仓禁令);
//   ② 并发会话 routinely 用 --no-verify 提交,pre-commit 整层被一起跳过,自动登记就永远停在
//      人工那一档;post-commit 即使 --no-verify 也会跑(与上面第 6 段同一条立因)。
// 本腿绝不 `git add`、绝不提交:落库交给仓内既有的收编器 scripts/auto-commit-quiet.mjs
//   (它专收"停留≥3 分钟未提交"的工作树改动,自带活文档行级归并与摘除台账复洁,不归本腿管)。
//   本腿若自行 add/commit,就是在别人尚未提交的内容上叠提交,且与 O43②「钩子运行期外来件」
//   护栏结构性冲突 —— 同第 9 段 README 两条腿从 pre-commit 移来的理由,一字不改地沿用。
// 节流:整轮扫描要枚举全部 web 路由与共享屏并逐枚取 HEAD blob,耗时以分钟计(2026-10-25 现读:
//   预演档单跑约 4.5 分钟;换机/换仓必重测,不得把本行当事实)。因此不能每次提交都跑:
//   仓外状态文件 .ihui-agent/state/cross-end-autoreg.json 记 lastRunAt(ISO)+ headSha,
//   距上次不足 CROSS_END_AUTOREG_WINDOW_MS(现值 30 分钟)直接跳过本腿。
//   读不到 / 读坏 / 时刻字段形态坏 ⇒ 一律按"该跑"处理:失效方向必须是"多跑一次",
//   绝不能变成"永不登记"(§0.3、§0.10)。
// 防递归:IHUI_CROSS_END_AUTOREG_COMMIT=1(本腿不提交;旗子为"将来若接提交"预留,并透给子进程)。
// 跳过:HUSKY_SKIP_CROSS_END_AUTOREG=1(应急放行,须留痕)。
// 非阻塞:失败/超时只进 .ihui-agent/state/hook-logs/post-commit-cross-end-autoreg.log,
//   不影响已落地的 commit 与第 3 段自动推送。
// 结论行用 console.info 而不是 console.log:本文件 eslint 的 no-console 只放 warn/error/info,
//   新腿不该认领新增告警(§0.2 差值棘轮:只拦本次带进来的;存量告警数以当次实测为准)。
const CROSS_END_AUTOREG_STATE_FILE = join(ROOT, '.ihui-agent', 'state', 'cross-end-autoreg.json')
const CROSS_END_AUTOREG_WINDOW_MS = 30 * 60 * 1000
const CROSS_END_AUTOREG_SCRIPT = 'scripts/auto-register-cross-end.mjs'

/**
 * 纯判据(不碰 IO,供本段调用、也供人单独喂文本复算):状态文件文本 + 现在时刻 → 本腿跑不跑。
 * 一切"取不到输入"的分支都落在 run=true —— 宁可多跑一次,不可不登记。
 */
function crossEndThrottleVerdict(stateText, nowMs, windowMs = CROSS_END_AUTOREG_WINDOW_MS) {
  if (stateText === null || stateText === undefined || String(stateText).trim() === '')
    return { run: true, reason: '状态文件读不到/为空 ⇒ 按"该跑"处理(失效方向=多跑一次)' }
  let st
  try {
    st = JSON.parse(stateText)
  } catch (e) {
    return {
      run: true,
      reason: `状态文件不是合法 JSON(${e && e.message ? e.message : e})⇒ 按"该跑"处理`,
    }
  }
  if (!st || typeof st !== 'object' || Array.isArray(st))
    return { run: true, reason: '状态文件不是对象 ⇒ 按"该跑"处理' }
  const last = typeof st.lastRunAt === 'string' ? Date.parse(st.lastRunAt) : NaN
  if (!Number.isFinite(last))
    return { run: true, reason: 'lastRunAt 缺失或形态坏 ⇒ 按"该跑"处理(绝不因读不懂就永不登记)' }
  const ageMs = nowMs - last
  if (ageMs < 0)
    return { run: true, reason: `lastRunAt 在未来(ageMs=${ageMs})⇒ 时钟跳变,按"该跑"处理` }
  const minutes = Math.floor(ageMs / 60000)
  const windowMinutes = Math.round(windowMs / 60000)
  if (ageMs >= windowMs)
    return { run: true, reason: `距上次 ${minutes} 分钟 ≥ ${windowMinutes} 分钟窗口 ⇒ 该跑` }
  return { run: false, reason: `距上次 ${minutes} 分钟 < ${windowMinutes} 分钟窗口 ⇒ 本轮跳过` }
}

function readCrossEndAutoregState() {
  try {
    return readFileSync(CROSS_END_AUTOREG_STATE_FILE, 'utf8')
  } catch {
    return null
  }
}

/** 状态文件是"节流凭据"不是判据输入:写不进去只回 false,绝不反过来影响本腿结论。 */
function writeCrossEndAutoregState(patch) {
  let base = {}
  try {
    const prev = JSON.parse(readFileSync(CROSS_END_AUTOREG_STATE_FILE, 'utf8'))
    if (prev && typeof prev === 'object' && !Array.isArray(prev)) base = prev
  } catch {
    /* 读不到/读坏 ⇒ 从空对象重建(重建本身即"上一次不算数",与节流判据同向) */
  }
  try {
    require('fs').writeFileSync(
      CROSS_END_AUTOREG_STATE_FILE,
      `${JSON.stringify({ ...base, ...patch }, null, 2)}\n`,
    )
    return true
  } catch {
    return false
  }
}

if (
  process.env.IHUI_CROSS_END_AUTOREG_COMMIT !== '1' &&
  process.env.HUSKY_SKIP_CROSS_END_AUTOREG !== '1'
) {
  if (!existsSync(join(ROOT, CROSS_END_AUTOREG_SCRIPT))) {
    // 器物不在工作树(未入库/别席 checkout 尚未拿到)⇒ 显式点名并跳过,**不盖 lastRunAt**:
    // 它一旦入库,下一轮提交就该跑 —— 把"没装车"记成"刚跑过"正是 §0.3 禁的那类假绿。
    console.info(
      `⚠️  跨端登记自动器:${CROSS_END_AUTOREG_SCRIPT} 不在位 ⇒ 本腿跳过(未盖节流时刻,器物一到位即恢复)`,
    )
  } else {
    const verdict = crossEndThrottleVerdict(readCrossEndAutoregState(), Date.now())
    if (!verdict.run) {
      // 跳过只打一行结论,不写 label 日志:提交频率远高于 30 分钟窗口,写日志等于刷屏。
      console.info(`⏱  跨端登记自动器:${verdict.reason}(${CROSS_END_AUTOREG_STATE_FILE})`)
    } else {
      let headSha = ''
      try {
        headSha = gitRaw(['rev-parse', 'HEAD'], ROOT).trim()
      } catch {
        /* 取不到 HEAD ⇒ 记 null,供人判读,不影响本腿 */
      }
      // 先盖时刻再跑:孩子被 timeout 杀掉、机器断电时窗口仍然成立(下一轮 30 分钟后再来);
      // 反过来"跑失败就退回窗口"会让一枚慢提交反复触发同一条 5 分钟级重活。
      writeCrossEndAutoregState({
        lastRunAt: new Date().toISOString(),
        headSha: headSha || null,
        windowMs: CROSS_END_AUTOREG_WINDOW_MS,
        verdict: verdict.reason,
      })
      const ok = runLogged(
        'post-commit-cross-end-autoreg',
        `node ${CROSS_END_AUTOREG_SCRIPT} --apply`,
        {
          // 上限必须 ≥ 一轮完整扫描:2026-10-25 实测预演档单跑约 4.5 分钟,按任务口径的
          // 120000 写会**每次都把孩子杀掉**(装了等于没装,§0.9),故取 8 分钟这一档。
          timeout: 480000,
          env: { IHUI_CROSS_END_AUTOREG_COMMIT: '1' },
        },
      )
      writeCrossEndAutoregState({
        lastResult: ok ? 'ok' : 'failed',
        lastFinishedAt: new Date().toISOString(),
      })
      if (!ok) {
        console.info(
          '⚠️  跨端登记自动器失败/超时(非阻塞;日志 .ihui-agent/state/hook-logs/post-commit-cross-end-autoreg.log)',
        )
      }
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
