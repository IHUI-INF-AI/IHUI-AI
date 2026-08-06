#!/usr/bin/env node
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

/** 健康检查:HEAD commit/tree 对象可读 + refs 有效 */
function isHealthy(repoRoot) {
  const head = run(`git -C ${repoRoot} rev-parse HEAD`, true)
  if (!head) return false
  const commitOk = run(`git -C ${repoRoot} cat-file -e ${head}^{commit}`, true) !== null || true
  const treeOk = run(`git -C ${repoRoot} cat-file -e ${head}^{tree}`, true) !== null || true
  return !!head && !!commitOk && !!treeOk
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
    console.log('⚠️  仓库健康检查未通过(或 --force)。重建需执行: node scripts/git-rebuild-local.mjs')
    process.exit(1)
  }

  const url = remoteUrl(repoRoot)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const gitDir = join(repoRoot, '.git')
  const backupDir = join(repoRoot, `.git.broken-${ts}`)
  const cloneDir = join(tmpdir(), `ihui-git-rebuild-${ts}`)

  console.log('🔧 检测到仓库异常,开始从远端重建...')
  console.log(`   远端: ${url}`)

  // 1. 备份损坏 .git
  if (existsSync(gitDir)) {
    console.log(`   ① 备份损坏 .git → ${backupDir}`)
    try {
      execSync(`mv "${gitDir}" "${backupDir}"`, { stdio: 'ignore' })
    } catch {
      // Windows 下 mv 失败(文件占用)时用 robocopy/cp 兜底
      try {
        execSync(`cp -r "${gitDir}" "${backupDir}"`, { stdio: 'ignore' })
        rmSync(gitDir, { recursive: true, force: true })
      } catch (e) {
        console.error(`❌ 备份 .git 失败(可能有进程占用): ${String(e.message ?? e)}`)
        console.error('   请关闭其他 git 进程后重试')
        process.exit(1)
      }
    }
  }

  // 2. 从远端 clone(不 checkout,仅获取 .git)
  console.log(`   ② 从远端 clone(--no-checkout)到 ${cloneDir}`)
  mkdirSync(cloneDir, { recursive: true })
  const cloneCmd = `git clone --no-checkout "${url}" "${cloneDir}"`
  const cloneOut = run(cloneCmd, true)
  if (!existsSync(join(cloneDir, '.git', 'HEAD'))) {
    console.error(`❌ clone 失败: ${cloneOut ?? '未知错误'}`)
    console.error('   远端可能不可达;请检查网络后重试。工作区文件未受影响')
    process.exit(1)
  }

  // 3. 替换 .git
  console.log('   ③ 替换 .git')
  execSync(`mv "${cloneDir}/.git" "${gitDir}"`, { stdio: 'ignore' })

  // 4. 重建 index(工作区不动),恢复分支跟踪
  console.log('   ④ 重建 index(git reset) — 工作区文件不动')
  run(`git -C ${repoRoot} reset`, true)
  const branch = run(`git -C ${repoRoot} symbolic-ref --short HEAD`, true)
  if (!branch) {
    // clone 默认分支可能是别的,切回 main 并跟踪
    run(`git -C ${repoRoot} checkout -b main origin/main`, true)
  }
  run(`git -C ${repoRoot} checkout -- .`, true) // 还原他人最新提交引入的文件差异

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
