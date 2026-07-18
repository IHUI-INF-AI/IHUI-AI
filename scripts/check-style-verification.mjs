#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 样式改动强制验证守门(AGENTS.md 第 19 节)
 *
 * 检测本次 commit staged 中是否含 apps/web 下的 .css 改动。
 * 若含,要求 commit message 附 `Verified-DOM: <描述>` trailer,
 * 证明 agent 已按第 19 节用 browser_use 实际渲染验证 + 读 DOM 数值。
 *
 * 用法(由 .husky/commit-msg 调用):
 *   node scripts/check-style-verification.mjs <commit-msg-file>
 *
 * 跳过:HUSKY_SKIP_STYLE_VERIFY=1(紧急 commit 时使用,但建议补验证)
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()

if (process.env.HUSKY_SKIP_STYLE_VERIFY === '1') {
  console.log('⚠️  HUSKY_SKIP_STYLE_VERIFY=1 — 已跳过样式验证守门(不推荐)')
  process.exit(0)
}

const msgFile = process.argv[2]
if (!msgFile) {
  console.error('❌ check-style-verification: 缺少 commit message 文件参数')
  process.exit(1)
}

let stagedCssFiles = []
try {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  stagedCssFiles = output
    .split('\n')
    .filter(Boolean)
    .filter((f) => f.startsWith('apps/web/') && f.endsWith('.css'))
} catch {
  process.exit(0)
}

if (stagedCssFiles.length === 0) {
  process.exit(0)
}

const msg = readFileSync(msgFile, 'utf8')
const hasVerifiedDom = /^Verified-DOM:\s*.+$/m.test(msg)

if (!hasVerifiedDom) {
  console.error('')
  console.error('❌ 样式改动强制验证守门(AGENTS.md 第 19 节)')
  console.error('')
  console.error('本次 commit 含 .css 改动:')
  for (const f of stagedCssFiles) {
    console.error(`  - ${f}`)
  }
  console.error('')
  console.error('按 AGENTS.md 第 19 节,样式改动必须:')
  console.error('  1. 启动全链路 dev server(web 3000 + api 3001 + ai-service 8000)')
  console.error('  2. 用 browser_use 实际渲染验证 + 读 DOM 数值(offsetHeight/scrollHeight/overflowY)')
  console.error('  3. 在 commit message 末尾附 trailer:')
  console.error('     Verified-DOM: <URL> <验证的 DOM 数值摘要>')
  console.error('')
  console.error('示例:')
  console.error('  Verified-DOM: http://localhost:3000/ai-world (textarea offsetHeight=58 scrollHeight=58 overflowY=hidden)')
  console.error('')
  console.error('跳过方法:HUSKY_SKIP_STYLE_VERIFY=1 git commit ...(紧急 commit 时使用,但建议补验证)')
  console.error('')
  process.exit(1)
}

console.log('✅ 样式验证守门通过(commit message 含 Verified-DOM trailer)')
process.exit(0)
