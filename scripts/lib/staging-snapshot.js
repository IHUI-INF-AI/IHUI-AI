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

/**
 * 获取当前 staged 文件快照(Added/Copied/Modified/Renamed,不含 Deleted)
 * @param {object} [options]
 * @param {string} [options.cwd] 工作目录,默认 process.cwd()
 * @returns {Set<string>|null} staged 文件路径集合(POSIX 路径),非 git 环境返回 null
 */
function takeStagingSnapshot(options = {}) {
  const cwd = options.cwd || process.cwd()
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
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
    return result
  }
  if (options.skip) {
    result.skipped = true
    return result
  }
  const cwd = options.cwd || process.cwd()
  const silent = options.silent || false
  try {
    const currentOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const currentStaged = new Set(
      currentOutput
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/\\/g, '/')),
    )
    // 找出快照之外的新增文件(可能是 lint-staged/IDE 副作用 stage 的)
    const addedFiles = [...currentStaged].filter((f) => !initialSnapshot.has(f))
    if (addedFiles.length === 0) {
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
    return result
  } catch (e) {
    if (!silent) {
      console.warn(`⚠️  staging area 还原检查跳过: ${e.message}`)
    }
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

module.exports = { takeStagingSnapshot, restoreStaging, setupRestoreOnExit }
