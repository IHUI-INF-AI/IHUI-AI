#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 安装器为 CLI 工具,需 console 输出诊断信息 */
/**
 * Git 钩子安装器(2026-11-12 立)。
 *
 * 立因:`G:\IHUI-AI` 实测 `core.hooksPath` 为空、`.git/hooks` 只有 `.sample`,
 *       `.husky/pre-commit` 等钩子**从未生效** —— 486 枚守门全部空转,于是运行期错误:
 *       一次 `git add -A` 把 9038 件生成物(实验沙箱/日志/副本)直接提交进历史,
 *       全程没有任何一道门报警。事后新增的 `check-staged-artifacts.mjs` 若仍装不上,
 *       等于又立一枚空转的门。
 *
 * 做法:把 `core.hooksPath` 指向仓库内受版本管理的 `.husky`(钩子本体就在那儿,
 *       不再复制到 `.git/hooks`,避免"改钩子要改两处"的老问题),并逐枚校验钩子文件在位。
 *       幂等:重复执行只做对账,不改其它 git 配置。
 *
 * 用法:
 *   node scripts/install-git-hooks.mjs           # 安装/对齐(默认)
 *   node scripts/install-git-hooks.mjs --silent  # 静默(供 postinstall 调用)
 *   node scripts/install-git-hooks.mjs --check   # 只对账:装好 exit 0,没装 exit 1
 *
 * 三态:真 0 = 已安装且钩子齐全;真违规 = 未安装/钩子缺失(--check 时 exit 1);
 *       未判定 = 非 git 仓库或 git 不可用(exit 2,不得报绿)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const HOOKS_DIR = '.husky'

/** 必须存在的钩子本体(缺一枚就等于该阶段的门全部空转) */
const REQUIRED_HOOKS = [
  'pre-commit',
  'commit-msg',
  'pre-push',
  'post-commit',
  'post-merge',
  'post-checkout',
  'pre-rebase',
]

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...opts,
  }).trim()
}

function isGitRepo() {
  try {
    git(['rev-parse', '--is-inside-work-tree'])
    return true
  } catch {
    return false
  }
}

function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const silent = args.includes('--silent')

  if (!isGitRepo()) {
    console.error('❌ install-git-hooks:当前目录不是 git 工作树 —— 未判定(exit 2)')
    return 2
  }

  const missing = REQUIRED_HOOKS.filter((name) => !existsSync(join(ROOT, HOOKS_DIR, name)))
  if (missing.length > 0) {
    console.error(
      `❌ install-git-hooks:钩子本体缺失 ${missing.join(', ')}(应位于 ${HOOKS_DIR}/)—— 未判定(exit 2)`,
    )
    return 2
  }

  let current = ''
  try {
    current = git(['config', '--get', 'core.hooksPath'])
  } catch {
    current = ''
  }

  if (current === HOOKS_DIR) {
    if (!silent) console.log(`✅ Git 钩子已生效:core.hooksPath=${HOOKS_DIR}(${REQUIRED_HOOKS.length} 枚钩子在位)`)
    return 0
  }

  if (checkOnly) {
    console.error(
      `❌ install-git-hooks:钩子未生效(core.hooksPath=${current || '(空)'},应为 ${HOOKS_DIR})—— 全部门空转中`,
    )
    console.error('   修复:node scripts/install-git-hooks.mjs')
    return 1
  }

  git(['config', 'core.hooksPath', HOOKS_DIR])
  const after = git(['config', '--get', 'core.hooksPath'])
  if (after !== HOOKS_DIR) {
    console.error(`❌ install-git-hooks:写入后回读不一致(${after})—— 未判定(exit 2)`)
    return 2
  }
  if (!silent) {
    console.log(`✅ Git 钩子已安装:core.hooksPath ${current || '(空)'} → ${HOOKS_DIR}`)
  }
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
