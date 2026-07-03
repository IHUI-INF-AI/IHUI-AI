#!/usr/bin/env node
/**
 * Git Hook 同步硬约束守门 (2026-07-04 立)
 *
 * 目的: 保证 g:\IHUI-AI\.git\hooks\pre-commit (git 真正查找的钩子) 与
 *       g:\IHUI-AI\.husky\pre-commit (项目级源, 入版本库) 内容一致,
 *       且 21 项 check 调用都存在, 0 个 simple-git-hooks v2 残留 wrapper.
 *
 * 根因背景: simple-git-hooks@2.13.1 v2 系列存在 monorepo 设计缺陷
 *   (_getHooksDirPath(projectRoot) 用 projectRoot 而非 gitRoot 推导 hooks 目录),
 *   导致从 client/ 运行 npx simple-git-hooks 时把钩子写到 client/.git/hooks/ (错位死代码),
 *   而 git 真正查找的根 .git/hooks/pre-commit 永远不被 simple-git-hooks 触碰.
 *   详细分析见 AGENTS.md 第 20 章「Git Hook 同步硬约束」.
 *
 * 与 e2e/pre-commit-hook-sync.spec.ts 的关系:
 *   - 本脚本: 轻量级 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整浏览器级断言 (CI 阶段, 含所有 21 项调用存在性)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-pre-commit-hook-content.mjs          # 全量检查
 *   node scripts/check-pre-commit-hook-content.mjs --staged # 仅当 .husky/pre-commit 在 staged 时才检查
 *
 * 退出码:
 *   0 - 通过
 *   1 - 钩子缺失/不同步/15 项 check 缺失/simple-git-hooks 残留
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const gitHooksPath = path.join(projectRoot, '.git', 'hooks', 'pre-commit')
const huskyPreCommitPath = path.join(projectRoot, '.husky', 'pre-commit')
const gitHooksPrePushPath = path.join(projectRoot, '.git', 'hooks', 'pre-push')
const huskyPrePushPath = path.join(projectRoot, '.husky', 'pre-push')

const onlyStaged = process.argv.includes('--staged')

// 21 项 pre-commit 检查项 (按 .husky/pre-commit 中的执行顺序)
// 与 simple-git-hooks 配置 + pre-commit 钩子内容保持一致
const EXPECTED_PRE_COMMIT_CHECKS = [
  'npx lint-staged',
  'npm run check:no-important --silent',
  'node scripts/check-nul.mjs',
  'node scripts/check-markraw-staged.mjs',
  'HIGH_SPECIFICITY_THRESHOLD=0 node scripts/check-high-specificity-staged.mjs',
  'npm run check:i18n:keys --silent',
  'npm run check:agents-md --silent',
  'npm run check:becomesupplier:join-us:staged --silent',
  'npm run check:sidebar:dark-tier:staged --silent',
  'npm run check:ai-header:style-scope:staged --silent',
  'npm run check:ai-customer-service-status:staged --silent',
  'npm run check:session-expired-button:no-double-border:staged --silent',
  'npm run check:dark-overlay-primary-button:no-double-border:staged --silent',
  'npm run check:dark-overlay-bg-color-unified:staged --silent',
  'npm run check:primary-button-contrast:staged --silent',
  'npm run check:button-text-contrast:staged --silent',
  'npm run check:sidebar-header:staged --silent',
  'node scripts/check-pre-commit-hook-content.mjs',
  'npm run check:frontend-verify:staged --silent',
  'node scripts/check-edu-route-consistency.mjs --staged',
  'node scripts/check-no-css-line-comments.mjs --staged',
  'node scripts/check-popper-backdrop-leak.mjs',
]

// 2 项 pre-push 检查项
const EXPECTED_PRE_PUSH_CHECKS = [
  'npm run typecheck --silent',
  'npm run check:el-token --silent',
]

// simple-git-hooks v2 wrapper 的特征行 (用于检测残留)
const SIMPLE_GIT_HOOKS_WRAPPERS = [
  'SKIP_SIMPLE_GIT_HOOKS',
  'SIMPLE_GIT_HOOKS_RC',
]

let hasError = false

// 辅助函数
function readFileIfExists(p) {
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf-8')
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  hasError = true
}

// 检查 1: .husky/pre-commit 必须存在
if (!fs.existsSync(huskyPreCommitPath)) {
  fail(`.husky/pre-commit 不存在: ${huskyPreCommitPath}`)
  console.error('  修复: cp <template> .husky/pre-commit')
  process.exit(1)
}

// 检查 2: .git/hooks/pre-commit 必须存在
if (!fs.existsSync(gitHooksPath)) {
  fail(`.git/hooks/pre-commit 不存在: ${gitHooksPath}`)
  console.error('  修复: cmd /c copy /Y ".husky\\pre-commit" ".git\\hooks\\pre-commit"')
  console.error('  或 Linux/macOS: cp .husky/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit')
  process.exit(1)
}

// 检查 3: 两个文件内容必须一致
const huskyContent = readFileIfExists(huskyPreCommitPath)
const gitHookContent = readFileIfExists(gitHooksPath)
if (huskyContent !== gitHookContent) {
  fail('.git/hooks/pre-commit 与 .husky/pre-commit 内容不同步')
  console.error('  .husky/pre-commit 是事实单一来源 (入版本库), .git/hooks/pre-commit 是 git 查找的目标')
  console.error('  修复: cmd /c copy /Y ".husky\\pre-commit" ".git\\hooks\\pre-commit"')
  process.exit(1)
}

// 检查 4: 21 项 check 调用都必须存在
for (const check of EXPECTED_PRE_COMMIT_CHECKS) {
  if (!huskyContent.includes(check)) {
    fail(`.husky/pre-commit 缺失 21 项检查之一: "${check}"`)
  }
}

// 检查 5: 0 个 simple-git-hooks v2 wrapper 残留
for (const wrapper of SIMPLE_GIT_HOOKS_WRAPPERS) {
  if (huskyContent.includes(wrapper)) {
    fail(`.husky/pre-commit 含 simple-git-hooks v2 wrapper 残留: "${wrapper}"`)
    console.error('  本项目已放弃 simple-git-hooks 自动同步, 改用手工 .git/hooks/pre-commit')
  }
}

// 检查 6: pre-push 同理 (最佳实践, 失败不阻塞 pre-commit)
if (fs.existsSync(gitHooksPrePushPath) && fs.existsSync(huskyPrePushPath)) {
  const huskyPrePush = readFileIfExists(huskyPrePushPath)
  const gitHookPrePush = readFileIfExists(gitHooksPrePushPath)
  if (huskyPrePush !== gitHookPrePush) {
    fail('.git/hooks/pre-push 与 .husky/pre-push 内容不同步 (警告, 不阻塞 pre-commit)')
  }
  for (const check of EXPECTED_PRE_PUSH_CHECKS) {
    if (huskyPrePush && !huskyPrePush.includes(check)) {
      fail(`.husky/pre-push 缺失 2 项检查之一: "${check}" (警告)`)
    }
  }
  for (const wrapper of SIMPLE_GIT_HOOKS_WRAPPERS) {
    if (huskyPrePush && huskyPrePush.includes(wrapper)) {
      fail(`.husky/pre-push 含 simple-git-hooks v2 wrapper 残留: "${wrapper}" (警告)`)
    }
  }
} else {
  console.warn(`[WARN] pre-push 钩子未完整配置 (gitHooks=${fs.existsSync(gitHooksPrePushPath)}, husky=${fs.existsSync(huskyPrePushPath)}), 跳过 pre-push 检查`)
}

// 检查 7: client/.git 不应存在 (simple-git-hooks v2 副作用)
const clientGitPath = path.join(clientRoot, '.git')
if (fs.existsSync(clientGitPath)) {
  const stat = fs.lstatSync(clientGitPath)
  if (stat.isDirectory()) {
    fail(`client/.git 目录存在 (simple-git-hooks v2 bug 副作用): ${clientGitPath}`)
    console.error('  修复:')
    console.error('    Windows: Remove-Item -Path "client\\.git" -Recurse -Force')
    console.error('    Linux/macOS: rm -rf client/.git')
    console.error('  根因: simple-git-hooks@2.13.1 v2 _getHooksDirPath bug 写到子目录 client/.git/hooks/')
  }
}

if (hasError) {
  console.error('\n[FAIL] Git Hook 同步硬约束检查未通过 (AGENTS.md 第 20 章)')
  console.error('  修复后重试: git add .husky/pre-commit && git commit')
  process.exit(1)
}

console.log(`[OK] Git Hook 同步硬约束: .git/hooks/pre-commit == .husky/pre-commit, 21 项 check 齐, 0 残留, client/.git 已清理`)
process.exit(0)
