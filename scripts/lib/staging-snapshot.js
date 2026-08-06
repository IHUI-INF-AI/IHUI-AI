/**
 * staging-snapshot.js — pre-commit staging area 快照与还原工具
 *
 * 背景(2026-07-26 立):
 *   多 agent 并行开发时曾出现非本任务文件被 commit 的事故。根因可能是:
 *   ① IDE 自动 stage 文件(如 VSCode "Smart Commit" 或 Source Control 面板误操作);
 *   ② 未察觉的 `git add` 操作(如 `git add .` / `git add -A`);
 *   ③ lint-staged 或 guardian-runner 在 hook 执行期间副作用 stage 新文件(已确认不会,但作为防御);
 *   ④ 其他 git 工具(GUI 客户端)自动 stage。
 *
 * 机制:
 *   - pre-commit 入口调用 takeStagingSnapshot() 记录初始 staged 文件清单;
 *   - hook 执行期间正常跑 lint-staged / guardian-runner / typecheck 等检查;
 *   - hook 退出前(无论成功失败)调用 restoreStaging() 对比当前 staged 与快照,
 *     自动 unstage 快照之外的新增文件,确保 commit 仅包含用户显式 staged 的文件。
 *
 * 注意:
 *   - 本机制只防护"hook 执行期间新增的 staged 文件",不防护"hook 执行前已 staged 的非本任务文件"
 *     (后者由 check-commit-scope-consistency.mjs 通过 commit scope 与文件领域匹配来检测);
 *   - lint-staged 对已 staged 文件的修改(eslint --fix / prettier --write)不受影响,
 *     因为文件 PATH 仍在快照中,只是内容更新;
 *   - 还原使用 `git restore --staged <file>`(git 2.23+),非破坏性,working tree 保留。
 *
 * 文件扩展名说明:使用 .js 而非 .cjs,因为 .gitignore 第 129 行 `*.cjs` 规则忽略所有 .cjs 文件。
 * 根 package.json 无 "type": "module",所以 .js 文件按 CommonJS 处理,可使用 require/module.exports。
 *
 * 豁免: HUSKY_SKIP_STAGING_RESTORE=1 跳过还原(紧急情况用)
 *
 * 用法:
 *   const { takeStagingSnapshot, restoreStaging } = require('./scripts/lib/staging-snapshot.js')
 *   const snapshot = takeStagingSnapshot()
 *   // ... hook 逻辑 ...
 *   setupRestoreOnExit(snapshot)  // 或 process.on('exit', () => restoreStaging(snapshot))
 *
 * 信号处理(2026-07-26 立):
 *   process.on('exit') 在 SIGINT(Ctrl+C)/SIGTERM 时不触发,需要单独监听。
 *   setupRestoreOnExit() 封装 exit + SIGINT + SIGTERM 三种退出路径的还原逻辑。
 */
const { execSync } = require('child_process')
const { appendFileSync, mkdirSync } = require('node:fs')
const { resolve, dirname } = require('node:path')

/**
 * 获取当前 staged 文件快照(Added/Copied/Modified/Renamed,不含 Deleted)
 * @param {object} [options]
 * @param {string} [options.cwd] 工作目录,默认 process.cwd()
 * @returns {Set<string>|null} staged 文件路径集合(POSIX 路径),非 git 环境返回 null
 */
function takeStagingSnapshot(options = {}) {
  const cwd = options.cwd || process.cwd()
  try {
    // core.quotepath=false: 非 ASCII 路径(如中文)输出原始 UTF-8,而非 octal 转义
    // 避免 replace(/\\/g, '/') 误伤 octal 转义中的反斜杠(如 \344 → /344)
    const output = execSync(
      'git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR',
      {
        encoding: 'utf8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    return new Set(
      output
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/\\/g, '/')),
    )
  } catch (e) {
    return null
  }
}

/**
 * 写入 staging 还原监控日志(JSON Lines 格式,追加一行)
 *
 * 触发条件(全部满足才写):
 *   ① 非静默模式(!options.silent);
 *   ② process.env.HUSKY_STAGING_RESTORE_LOG === '1';
 *   ③ 本次还原有实际操作(result.restored.length > 0 或 result.skipped=true)。
 *
 * 日志路径:<cwd>/.trae-cn/tmp/staging-restore.log(cwd = options.cwd || process.cwd())
 * IO 错误被 try-catch 吞掉,不阻塞主流程。
 *
 * @param {{restored: string[], skipped: boolean}} result restoreStaging 的返回值
 * @param {string|null} skipReason 跳过原因("null-snapshot"/"options.skip"/"non-git-env"/null)
 * @param {object} options 透传选项(用 options.silent / options.cwd)
 * @returns {void}
 */
function writeRestoreLog(result, skipReason, options) {
  if (options.silent) return
  if (process.env.HUSKY_STAGING_RESTORE_LOG !== '1') return
  if (result.restored.length === 0 && !result.skipped) return
  try {
    const cwd = (options.cwd || process.cwd()).replace(/\\/g, '/')
    const logPath = resolve(cwd, '.trae-cn/tmp/staging-restore.log')
    mkdirSync(dirname(logPath), { recursive: true })
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      cwd,
      restored: result.restored,
      restoredCount: result.restored.length,
      skipped: result.skipped,
      skipReason,
    })
    appendFileSync(logPath, entry + '\n', 'utf8')
  } catch (e) {
    // 吞掉 IO 错误,不阻塞主流程
  }
}

/**
 * 还原 staging area 至初始快照(unstage 快照之外的新增文件)
 * @param {Set<string>|null} initialSnapshot takeStagingSnapshot() 返回的初始快照
 * @param {object} [options]
 * @param {string} [options.cwd] 工作目录,默认 process.cwd()
 * @param {boolean} [options.skip] 跳过还原(如 HUSKY_SKIP_STAGING_RESTORE=1)
 * @param {boolean} [options.silent] 静默模式(不输出日志,测试用)
 * @returns {{restored: string[], skipped: boolean}} 还原的文件列表 + 是否跳过
 */
function restoreStaging(initialSnapshot, options = {}) {
  const result = { restored: [], skipped: false }
  if (!initialSnapshot) {
    result.skipped = true
    writeRestoreLog(result, 'null-snapshot', options)
    return result
  }
  if (options.skip) {
    result.skipped = true
    writeRestoreLog(result, 'options.skip', options)
    return result
  }
  const cwd = options.cwd || process.cwd()
  const silent = options.silent || false
  try {
    // core.quotepath=false: 非 ASCII 路径(如中文)输出原始 UTF-8,而非 octal 转义
    const currentOutput = execSync(
      'git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR',
      {
        encoding: 'utf8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    const currentStaged = new Set(
      currentOutput
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/\\/g, '/')),
    )
    // 找出快照之外的新增文件(可能是 lint-staged/IDE 副作用 stage 的)
    const addedFiles = [...currentStaged].filter((f) => !initialSnapshot.has(f))
    if (addedFiles.length === 0) {
      writeRestoreLog(result, null, options)
      return result
    }
    if (!silent) {
      console.warn(
        `\n⚠️  staging area 还原:检测到 ${addedFiles.length} 个非预期 staged 文件(可能由 lint-staged 副作用或 IDE 自动 stage 引入),自动 unstage:`,
      )
      for (const f of addedFiles) {
        console.warn(`     - ${f}`)
      }
    }
    // 使用 git restore --staged unstage(git 2.23+,非破坏性,working tree 保留)
    // 用引号包裹路径以处理空格
    execSync(`git restore --staged ${addedFiles.map((f) => `"${f}"`).join(' ')}`, {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd,
    })
    if (!silent) {
      console.log(
        `✅ 已还原 staging area 至 pre-commit 入口快照(剩余 ${initialSnapshot.size} 个 staged 文件)\n`,
      )
    }
    result.restored = addedFiles
    writeRestoreLog(result, null, options)
    return result
  } catch (e) {
    if (!silent) {
      console.warn(`⚠️  staging area 还原检查跳过: ${e.message}`)
    }
    result.skipped = true
    writeRestoreLog(result, 'non-git-env', options)
    return result
  }
}

/**
 * 注册 staging area 还原到进程退出钩子(包括正常退出 + SIGINT + SIGTERM)
 *
 * 背景(2026-07-26 立):
 *   process.on('exit') 在 SIGINT(Ctrl+C)/SIGTERM 时不触发,需要单独监听。
 *   否则用户在 pre-commit hook 期间按 Ctrl+C 会导致 staging area 不还原,
 *   非本任务文件残留 staged,下次 commit 可能被混入。
 *
 * 退出码约定:
 *   - 正常退出: 不改退出码(由调用方控制)
 *   - SIGINT: 130 (128 + 2,POSIX 约定)
 *   - SIGTERM: 143 (128 + 15,POSIX 约定)
 *
 * @param {Set<string>|null} initialSnapshot takeStagingSnapshot() 返回的初始快照
 * @param {object} [options] 透传给 restoreStaging 的选项(skip/silent/cwd)
 * @returns {void}
 */
function setupRestoreOnExit(initialSnapshot, options = {}) {
  const restore = () => {
    try {
      restoreStaging(initialSnapshot, options)
    } catch (e) {
      // 还原失败不阻塞进程退出(避免 hook 卡死)
      if (!options.silent) {
        console.warn(`⚠️  staging area 还原失败(信号退出路径): ${e.message}`)
      }
    }
  }

  // 正常退出路径(process.exit() / 事件循环空了 / 未捕获异常后)
  process.on('exit', restore)

  // SIGINT(Ctrl+C):用户中断 hook,需要还原 staging area 后退出码 130
  process.on('SIGINT', () => {
    restore()
    process.exit(130)
  })

  // SIGTERM(kill 默认信号):被其他进程 kill,需要还原 staging area 后退出码 143
  process.on('SIGTERM', () => {
    restore()
    process.exit(143)
  })
}

/**
 * 审计 staging area 文件清单(2026-08-06 立,防同目录文件级污染)
 *
 * 背景(2026-08-06 立,真实事故):
 *   commit aa15bec23 "fix(web): message-list 消息操作按钮..." 意外包含了
 *   message-input.tsx(其他 agent 改的 rounded-t-xl)。根因:message-input.tsx 在
 *   pre-commit hook 执行**前**已被 IDE/其他 agent staged,takeStagingSnapshot 把它
 *   当成本任务文件,restoreStaging 不会 unstage。所有领域级守门(check-commit-scope /
 *   check-staged-pollution)都放过(同目录 apps/web/src/components/chat/,scope=web 匹配)。
 *
 * 机制:
 *   - 在 pre-commit 入口(takeStagingSnapshot 之后、lint-staged 之前)调用本函数
 *   - 打印 staged 文件清单(按目录分组),让 agent 察觉异常
 *   - 同目录多文件时警告(提示可能是污染,建议用 safe-commit.mjs 重新提交)
 *   - 文件数 > 5 时严重警告
 *   - warn-only(不阻塞 commit,避免误伤合法多文件 commit)
 *
 * 注意:
 *   - 本函数是"提示层",无法真正阻止污染。真正阻止污染的是 safe-commit.mjs
 *     (git reset HEAD 清空暂存区 + 只 add 声明文件 + 校验 staged == 预期)
 *   - agent 应遵循 AGENTS.md §12/§16/§20 强制用 safe-commit.mjs,不直接 git add + commit
 *
 * 豁免: HUSKY_SKIP_STAGING_AUDIT=1 跳过审计(紧急情况用)
 *
 * @param {object} [options]
 * @param {string} [options.cwd] 工作目录,默认 process.cwd()
 * @param {boolean} [options.silent] 静默模式(不输出日志,测试用)
 * @returns {void}
 */
function auditStagingFiles(options = {}) {
  if (process.env.HUSKY_SKIP_STAGING_AUDIT === '1') {
    if (!options.silent) {
      console.log('⏭  staged 文件清单审计(HUSKY_SKIP_STAGING_AUDIT=1, 跳过)')
    }
    return
  }
  const cwd = options.cwd || process.cwd()
  const silent = options.silent || false

  let stagedFiles = []
  try {
    const output = execSync(
      'git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR',
      {
        encoding: 'utf8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    stagedFiles = output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch (e) {
    return // 非 git 环境,跳过
  }

  if (stagedFiles.length === 0) return

  // 按目录分组(取文件所在目录,如 apps/web/src/components/chat/)
  const groups = new Map()
  for (const f of stagedFiles) {
    const lastSlash = f.lastIndexOf('/')
    const dir = lastSlash > 0 ? f.slice(0, lastSlash) : '(root)'
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir).push(f)
  }

  if (!silent) {
    console.log(
      `\n📋 staged 文件清单审计(2026-08-06 立,防同目录文件级污染,共 ${stagedFiles.length} 个文件):`,
    )
    for (const [dir, files] of groups) {
      console.log(`   📁 ${dir}/`)
      for (const f of files) {
        const name = f.slice(f.lastIndexOf('/') + 1)
        console.log(`      - ${name}`)
      }
    }

    // 警告:同目录多文件(最常见污染模式,如 message-list + message-input 同目录)
    // 用 console.log 而非 console.warn(warn 输出到 stderr,pre-commit hook 中不显眼)
    let hasMultiFileDir = false
    for (const [dir, files] of groups) {
      if (files.length > 1) {
        hasMultiFileDir = true
        console.log(
          `   ⚠️  目录 ${dir}/ 有 ${files.length} 个文件 — 请确认是否都是本任务文件(同目录多文件是最常见污染模式)`,
        )
      }
    }
    if (hasMultiFileDir) {
      console.log(
        '      如果混入了其他 agent 改动,请用 node scripts/safe-commit.mjs 重新提交:',
      )
      console.log(
        '      node scripts/safe-commit.mjs -m "fix(web): ..." -- apps/web/foo.tsx',
      )
      console.log('      (safe-commit 会 git reset HEAD 清空暂存区 + 只 add 声明文件 + 校验)')
    }

    // 严重警告:文件数 > 5(多 agent 并行时容易混入)
    if (stagedFiles.length > 5) {
      console.log(
        `   ⚠️  staged 文件数 ${stagedFiles.length} > 5 — 多 agent 并行时容易混入其他 agent 改动`,
      )
      console.log(
        '      强烈建议用 node scripts/safe-commit.mjs -m "..." -- <files> 重新提交',
      )
    }

    console.log('')
  }
}

module.exports = { takeStagingSnapshot, restoreStaging, setupRestoreOnExit, auditStagingFiles }
