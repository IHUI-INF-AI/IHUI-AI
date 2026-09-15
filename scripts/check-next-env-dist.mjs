#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * next-env.d.ts 构建污染守门脚本。
 *
 * 背景: apps/web 的 next build 在 IHUI_BUILD_DIST 覆盖 distDir 时(部署脚本
 *   ihui-deploy.ps1 用 .next-staging 做零停机交换)会把被跟踪的 next-env.d.ts
 *   改写为引用 `.next-staging/types/...`。该引用残留会污染源码树,且违反
 *   AGENTS.md「next-env.d.ts 的 .next-* 变体永不提交」铁律。
 *
 * 检测: apps/web/next-env.d.ts 中 import 路径若引用 `.next-<suffix>`(suffix 非空,
 *   即 .next-staging / .next-static 等带环境后缀的 distDir)→ 视为污染,exit 1。
 * 合法: `.next` / `.next/dev` / `.next/types`(纯 .next 路径,Next.js 默认或 dev 模式)。
 *
 * 守门策略:
 *   - pre-commit(--staged):仅当 next-env.d.ts 被 git add 进暂存区才判定,
 *     避免本地正常构建产生的脏文件误伤 commit(铁律本就不提交该文件)。
 *   - 手动运行(无 --staged):直接判定工作树文件内容,用于验证污染检测是否生效。
 *
 * 用法: node scripts/check-next-env-dist.mjs [--staged]
 *   exit 0 = 无 .next-* 变体污染
 *   exit 1 = 发现 .next-* 变体引用(需 git checkout -- apps/web/next-env.d.ts 还原)
 * 跳过: HUSKY_SKIP_NEXT_ENV_DIST=1 git commit ...
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const NEXT_ENV = join(ROOT, 'apps', 'web', 'next-env.d.ts')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 污染:引用 `.next-<suffix>`(suffix 非空)的 distDir 类型路径。
// 例: import './.next-staging/types/routes.d.ts'  → 命中
//     import './.next/dev/types/routes.d.ts'      → 不命中(.next 无后缀)
//     import './.next/types/routes.d.ts'          → 不命中
const POLLUTION = /import\s+['"]\.\/\.next-[^'"]+['"]/

function isStaged() {
  try {
    const out = execSync('git diff --cached --name-only', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out
      .split('\n')
      .map((s) => s.trim())
      .includes('apps/web/next-env.d.ts')
  } catch {
    return false
  }
}

function main() {
  if (!existsSync(NEXT_ENV)) {
    console.log(`${C.dim}⚠${C.reset} apps/web/next-env.d.ts 不存在,跳过`)
    process.exit(0)
  }

  const staged = process.argv.includes('--staged')
  if (staged && !isStaged()) {
    console.log(`${C.green}✓${C.reset} next-env.d.ts 未暂存,跳过(铁律不提交该文件)`)
    process.exit(0)
  }

  const content = readFileSync(NEXT_ENV, 'utf8')
  const m = content.match(POLLUTION)
  if (m) {
    console.log(
      `${C.red}✗${C.reset} apps/web/next-env.d.ts 引用了 .next-* 变体(distDir 被构建覆盖残留):`,
    )
    console.log(`    ${C.dim}${m[0]}${C.reset}`)
    console.log(`  ${C.yellow}修复:${C.reset} git checkout -- apps/web/next-env.d.ts`)
    console.log(
      `  ${C.dim}(部署脚本 ihui-deploy.ps1 应在 staging→.next 交换后自动还原;本地误改请手动还原)${C.reset}`,
    )
    process.exit(1)
  }

  console.log(`${C.green}✓${C.reset} next-env.d.ts 未引用 .next-* 变体`)
  process.exit(0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
