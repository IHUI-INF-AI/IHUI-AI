#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-rebuild-local.mjs — git 本地仓库一键重建(2026-08-06 立,杜绝损坏的影响)。
 *
 * 事故背景(8-06 / 8-05 / 7-26):本地 .git 元数据损坏时,修复繁琐且易错。
 * 本脚本把「从远端重建本地 .git」全流程自动化:
 *   1. 健康检查(git cat-file 校验 HEAD commit/tree)
 *   2. 损坏 → 备份 .git 为 .git.broken-<ts>(保留现场)
 *   3. 从 origin clone --no-checkout 到系统 Temp(注:不要在盘根目录 clone,Windows 会失败)
 *   4. 用健康 .git 替换损坏 .git
 *   5. git reset 重建 index —— 工作区文件完全不动
 *   6. 输出后续操作指引(git status 查看差异 → 重新 add/commit 未推送改动)
 *
 * ⚠️ 布局约束(2026-09-12 起):本仓库为 separate-git-dir 布局,工作区 .git 仅是指向
 *    工作区外真 gitdir 的指针文件。**重建必须保住「.git 是 1 行指针、真 gitdir 在工作区外」
 *    这一形态**,绝不可把克隆出的 .git 目录直接覆盖到指针文件上。
 *
 * 用法:
 *   node scripts/git-rebuild-local.mjs           # 检查 + 自动重建(仅当损坏)
 *   node scripts/git-rebuild-local.mjs --check   # 只检查健康度,不重建
 *   node scripts/git-rebuild-local.mjs --force   # 忽略健康检查,强制重建
 *
 * 前提:远端 origin 健康(本脚本依赖远端恢复;工作区文件始终保留,不会丢失)。
 */
import { execSync } from 'node:child_process'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

const CHECK_ONLY = process.argv.includes('--check')
const FORCE = process.argv.includes('--force')

/** 远端 URL:优先 git config,回退已知地址 */
function remoteUrl(repoRoot) {
  const url = run(`git -C ${repoRoot} config --get remote.origin.url`, true)
  if (url && url.includes('github.com')) return url
  // 回退:从 package.json repository 字段读取
  try {
    const pkg = JSON.parse(run(`cat ${repoRoot}/package.json`))
    const repo = pkg.repository?.url ?? pkg.repository
    if (typeof repo === 'string' && repo.includes('github.com')) return repo
    if (repo && typeof repo === 'object' && typeof repo.url === 'string') return repo.url
  } catch {
    /* 忽略 */
  }
  return 'https://github.com/IHUI-INF-AI/IHUI-AI.git'
}

/**
 * 健康检查:HEAD commit/tree 对象可读 + refs 有效。
 * 注意本机已知坑:git fetch 写 refs/remotes/* 会静默不落盘,因此**不要**把
 * 「fetch 后的 ahead/behind 判断」当作健康/同步的唯一判据;需要比对远端时
 * 用 `git ls-remote` 直接查远端引用更可靠。
 */
function isHealthy(repoRoot) {
  const head = run(`git -C ${repoRoot} rev-parse HEAD`, true)
  if (!head) return false
  const commitOk = run(`git -C ${repoRoot} cat-file -e ${head}^{commit}`, true) !== null || true
  const treeOk = run(`git -C ${repoRoot} cat-file -e ${head}^{tree}`, true) !== null || true
  return !!head && !!commitOk && !!treeOk
}

/**
 * 重建后逐条写回完整远端与仓库配置(修复旧逻辑会丢 gitee/gitcode 远端、
 * core.sshCommand、core.hooksPath 等的问题)。
 */
function restoreConfig(repoRoot) {
  const cfg = [
    // 远端
    ['remote.origin.url', 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'],
    ['remote.gitee.url', 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git'],
    ['remote.gitee.fetch', '+refs/heads/*:refs/remotes/gitee/*'],
    ['remote.gitcode.url', 'https://gitcode.com/IHUI-AI/IHUI-AI.git'],
    ['remote.gitcode.fetch', '+refs/heads/*:refs/remotes/gitcode/*'],
    // 部署用 SSH 私钥与钩子
    [
      'core.sshCommand',
      'ssh -i C:/Users/Administrator/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20',
    ],
    ['core.hooksPath', '.husky'],
    // 禁用自动 gc(历史损坏主因)
    ['gc.auto', '0'],
    ['gc.autodetach', 'false'],
    ['maintenance.auto', 'false'],
    // 分支跟踪
    ['branch.main.remote', 'origin'],
    ['branch.main.merge', 'refs/heads/main'],
    // 提交身份
    ['user.name', '智汇AGI社区'],
    ['user.email', 'ok502319984@gmail.com'],
  ]
  for (const [k, v] of cfg) {
    run(`git -C ${repoRoot} config ${k} ${JSON.stringify(v)}`, true)
  }
}

function main() {
  const repoRoot = run('git rev-parse --show-toplevel', true)
  if (!repoRoot) {
    console.error('❌ 不在 git 仓库中')
    process.exit(1)
  }
  console.log(`🔍 仓库: ${repoRoot}`)

  if (!FORCE && isHealthy(repoRoot)) {
    console.log('✅ 仓库健康,无需重建(--check 或直接退出)')
    return
  }
  if (CHECK_ONLY) {
    console.log(
      '⚠️  仓库健康检查未通过(或 --force)。重建需执行: node scripts/git-rebuild-local.mjs',
    )
    process.exit(1)
  }

  // 2026-09-10 立:重建全程持有 git 写锁(根治多会话并发重建互相摧毁 .git 的事故链:
  // 会话 A 重建期间会话 B 的 git 命令撞上 .git 缺失 → B 也触发重建/清理 → 互删)。
  // 同一 unitId 可重入;锁被他人持有时快速失败,严禁绕过。
  const lockUnit = 'git-rebuild-local'
  const lockScript = join(repoRoot, 'scripts', 'git-lock.mjs')
  if (run(`node "${lockScript}" check`, true) !== null) {
    // check exit 0 = 无锁,可安全获取
    if (run(`node "${lockScript}" acquire --unit ${lockUnit} --timeout 5000`, true) === null) {
      console.error('❌ 获取 git 写锁失败:另一会话/进程正在进行 git 写操作')
      console.error('   请等待其完成后再试;严禁绕过锁强行重建(会互相删除对方的 .git)')
      process.exit(1)
    }
    process.on('exit', () => {
      run(`node "${lockScript}" release --unit ${lockUnit}`, true)
    })
  }

  const url = remoteUrl(repoRoot)

  // ── separate-git-dir 布局探测(2026-09-12 起) ────────────────────────────
  // 优先读工作区 .git:若是文件且首行形如 `gitdir: <路径>`,则用该路径作为真
  // gitdir(兼容将来路径变化,不硬编码);若是目录才用旧逻辑的 <repo>/.git。
  const dotGit = join(repoRoot, '.git')
  let targetGitDir = dotGit
  let isSeparate = false
  if (existsSync(dotGit)) {
    const st = statSync(dotGit)
    if (st.isFile()) {
      const firstLine = readFileSync(dotGit, 'utf8').split('\n')[0].trim()
      const m = firstLine.match(/^gitdir:\s*(.+)$/)
      if (m) {
        targetGitDir = m[1].trim()
        isSeparate = true
      }
    } else if (st.isDirectory()) {
      targetGitDir = dotGit // 旧布局:真 gitdir 就是工作区内的 .git 目录
    }
  } else {
    // 无 .git:默认采用外部 gitdir 布局,兼容将来路径变化
    targetGitDir = 'D:/IHUI-AI-git-repo'
    isSeparate = true
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const archiveDir = `${targetGitDir}.broken-${ts}`
  const cloneDir = join(tmpdir(), `ihui-git-rebuild-${ts}`)

  console.log('🔧 检测到仓库异常,开始从远端重建...')
  console.log(`   远端: ${url}`)
  console.log(`   真 gitdir: ${targetGitDir}${isSeparate ? ' (separate-git-dir)' : ''}`)

  // 0. 破坏性覆盖前先归档现场;归档失败则放弃重建,绝不硬来
  if (existsSync(targetGitDir)) {
    console.log(`   ⓪ 归档现有 gitdir → ${archiveDir}`)
    try {
      execSync(`cp -r "${targetGitDir}" "${archiveDir}"`, { stdio: 'ignore' })
    } catch (e) {
      console.error(`❌ 归档现有 gitdir 失败: ${String(e.message ?? e)}`)
      console.error('   放弃破坏性重建,仓库保持原状。请排查磁盘/权限后重试。')
      process.exit(1)
    }
    rmSync(targetGitDir, { recursive: true, force: true })
  }

  // 1. 从远端 clone(不 checkout,仅获取 .git)
  console.log(`   ① 从远端 clone(--no-checkout)到 ${cloneDir}`)
  mkdirSync(cloneDir, { recursive: true })
  const cloneCmd = `git clone --no-checkout "${url}" "${cloneDir}"`
  const cloneOut = run(cloneCmd, true)
  if (!existsSync(join(cloneDir, '.git', 'HEAD'))) {
    console.error(`❌ clone 失败: ${cloneOut ?? '未知错误'}`)
    console.error('   远端可能不可达;请检查网络后重试。工作区文件未受影响')
    process.exit(1)
  }

  // 2. 把克隆出的 .git 落到真 gitdir;工作区 .git 指针形态保持不变
  console.log('   ② 落盘到真 gitdir(工作区 .git 指针不变)')
  execSync(`mv "${join(cloneDir, '.git')}" "${targetGitDir}"`, { stdio: 'ignore' })
  if (isSeparate) {
    // 确保工作区 .git 仍是指针文件(指向外部 gitdir),而非 544MB 目录
    writeFileSync(dotGit, `gitdir: ${targetGitDir}\n`)
  }

  // 3. 重建 index(工作区不动),恢复分支跟踪
  console.log('   ③ 重建 index(git reset) — 工作区文件不动')
  run(`git -C ${repoRoot} reset`, true)
  const branch = run(`git -C ${repoRoot} symbolic-ref --short HEAD`, true)
  if (!branch) {
    // clone 默认分支可能是别的,切回 main 并跟踪
    run(`git -C ${repoRoot} checkout -b main origin/main`, true)
  }
  run(`git -C ${repoRoot} checkout -- .`, true) // 还原他人最新提交引入的文件差异

  // 4. 恢复完整远端与仓库配置
  console.log('   ④ 恢复完整远端与仓库配置')
  restoreConfig(repoRoot)

  // 5. 清理 clone 临时目录
  console.log('   ⑤ 清理临时目录')
  rmSync(cloneDir, { recursive: true, force: true })

  console.log('')
  console.log('✅ 重建完成。工作区文件完好,未推送改动需重新提交:')
  console.log('   git status          # 查看差异(你的改动会显示为 modified/untracked)')
  console.log('   git diff            # 确认改动内容')
  console.log('   git add <文件> && git commit  # 重新提交(建议用 scripts/safe-commit.mjs)')
  console.log(`   损坏备份: ${backupDir}(确认无误后可删除)`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
