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
const { execSync } = require('child_process')
const {
  takeStagingSnapshot,
  setupRestoreOnExit,
  auditStagingFiles,
} = require('./staging-snapshot.js')

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

// 5. lint-staged：对暂存文件运行 eslint --fix 和 prettier --write
// ⚠️ 必须带 --no-stash(2026-09-12 立,事故根治):
//   lint-staged 默认在跑任务前用 `git stash` 备份现场。本机存在「宿主清理 gitdir 嵌套目录」
//   的病理,而 **git stash 路径会连带删掉工作区之外的整个 gitdir** —— 2026-09-12 当天两次
//   实证:① `git pull --rebase` 的 autostash;② 本文件 lint-staged 的备份 stash(16:10,
//   gitdir 整目录消失、deploy 失效、需守护从备份重建)。两次事故 100% 落在 stash 路径上。
//   staging area 的安全性已由本文件顶部的 staging-snapshot 机制兜住(hook 退出前自动
//   unstage 非预期新增文件),故不需要 lint-staged 自带备份。
//   回退方式:删掉 --no-stash 即可(但请先确认宿主清理病理已消失)。
if (!run('🎨 运行 lint-staged...', 'npx lint-staged --max-arg-length 4096 --no-stash')) {
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
  },
  {
    label: 'mobile-rn global.css',
    file: 'apps/mobile-rn/global.css',
    cmd: 'node scripts/sync-rn-global-css.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
  },
  {
    // rn-tokens.ts 的色值派生面(2026-09-25):改 tokens.css 一处,RN 侧手抄 HEX 表自动跟上。
    label: 'rn-tokens.ts 派生面',
    file: 'packages/design-tokens/src/rn-tokens.ts',
    cmd: 'node scripts/sync-rn-tokens.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
  },
  {
    // extension 注入第三方页面的内联色(2026-09-25):它不能依赖宿主 CSS 变量,必须自带字面量,
    // 所以是"派生出的副本"而不是"该删的硬编码"。profile 走 .dark(注入层永不反转)。
    label: 'extension 注入样式色值',
    file: 'apps/extension/entrypoints/content/content-toolbar.tsx',
    cmd: 'node scripts/sync-extension-tokens.mjs --quiet',
    trigger: 'tokens',
    failMode: 'block',
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
  },
]
const V3_USAGE_DIRS = ['apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/']

if (process.env.HUSKY_SKIP_TOKENS_SYNC !== '1') {
  try {
    const stagedForTokens = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: process.cwd(),
      windowsHide: true,
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
if (!run('🛡️ 运行守门脚本批量检查...', 'node scripts/guardian-runner.mjs --staged')) {
  process.exit(1)
}

// 🌐 i18n 死 key 扫描挂 pre-commit 阻塞(2026-07-26 立,PROJECT_PLAN.md §1 后续任务收尾)
// 背景:scan-dead-i18n-keys.mjs 之前仅在 pre-push dry-run + i18n-dead-key-audit.yml paths 触发,
//      漏掉"main 分支全量 PR"场景;本步在每次 commit 都跑全量扫描,死 key > 0 立即阻断。
// 跳过方法(紧急,本任务挂载时已知 40 个现存死 key):HUSKY_SKIP_I18N_DEAD_KEY=1 git commit ...
// 性能:web 端 3261 文件全量扫描 ~3.5s,在 guardian-runner 之后跑,不影响前置检查流。
if (process.env.HUSKY_SKIP_I18N_DEAD_KEY !== '1') {
  if (
    !run(
      '🌐 i18n 死 key 扫描(死 key > 0 阻断 commit,2026-07-26 立)',
      'node scripts/scan-dead-i18n-keys.mjs --exit 1',
    )
  ) {
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
// 跳过方法:HUSKY_SKIP_I18N_DEAD_KEY_OTHER=1 git commit ...
// 注:3 端扫描器内置 5 语言 JSON 加载,key 不一致会直接报错(隐式 parity 校验)。
if (process.env.HUSKY_SKIP_I18N_DEAD_KEY_OTHER !== '1') {
  console.log('🌐 4 端 i18n 死 key 扫描(miniapp-taro/mobile-rn/extension,warn-only)')
  for (const target of ['miniapp-taro', 'mobile-rn', 'extension']) {
    try {
      execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`, {
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
if (process.env.HUSKY_SKIP_MINIAPP_PARITY !== '1') {
  if (
    !run(
      '🎨 miniapp-taro 跨端样式一致性守门(2026-09-03 立)',
      'node scripts/check-miniapp-taro-style-parity.mjs',
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
      'node scripts/check-auth-refresh-singleton.mjs',
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
  if (involvesRnTokens) {
    if (!run('🔍 条件 RN global.css 同步守门...', 'node scripts/check-rn-global-css-sync.mjs')) {
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
if (!run('🔗 跨端 storage-adapter parity 守门...', 'node scripts/check-cross-store-parity.mjs')) {
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
// 阻断条件:1) SiteFooter 关键 class 缺失;2) ECOSYSTEM_GROUPS 不是 5 分组;
//         3) 5 语言 footer 命名空间任一 key 缺失或为空。
if (process.env.HUSKY_SKIP_FOOTER_GUARD !== '1') {
  if (
    !run(
      '🦶 SiteFooter 守门(防 v10/v11 回退, 5 语言 i18n + 关键 class, 2026-07-30 立)...',
      'node scripts/check-site-footer.mjs',
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
      'node scripts/check-agent-engine-parity.mjs --quiet',
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
      'node scripts/check-desktop-event-wiring.mjs',
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
