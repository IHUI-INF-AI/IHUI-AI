#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
 * 退出码(三态,AGENTS.md §0.3):
 *   0 = 通过(无 apps/web 的 .css 改动,或改动且 message 带 Verified-DOM trailer)
 *   1 = 真违规(.css 改动但 message 缺 Verified-DOM trailer)
 *   2 = 未判定(缺 commit-msg 参数 / git 取暂存区失败 / message 文件读不到)
 *
 * 跳过:HUSKY_SKIP_STYLE_VERIFY=1(紧急 commit 时使用,但建议补验证)
 */
import { readFileSync } from 'node:fs'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = process.cwd()

if (process.env.HUSKY_SKIP_STYLE_VERIFY === '1') {
  console.log('⚠️  HUSKY_SKIP_STYLE_VERIFY=1 — 已跳过样式验证守门(不推荐)')
  process.exit(0)
}

const msgFile = process.argv[2]
if (!msgFile) {
  console.error('❌ check-style-verification: 缺少 commit message 文件参数 —— 未判定(exit 2)')
  process.exit(2)
}

let stagedCssFiles = []
try {
  // 2026-10-26 G-54:git 派生收口到 face-reader(gitRaw 内部已带 safe.directory/quotepath/-C/stdio/windowsHide/timeout)
  const output = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], ROOT)
  stagedCssFiles = output
    .split('\n')
    .filter(Boolean)
    .filter((f) => f.startsWith('apps/web/') && f.endsWith('.css'))
} catch (e) {
  // 取不到暂存区(非 git / git 一过性失败)⇒ 未判定,不得静默放行
  console.error(
    `❌ check-style-verification: 取不到 git 暂存区(git diff --cached 失败)—— 未判定(exit 2):${e?.message ?? e}`,
  )
  process.exit(2)
}

if (stagedCssFiles.length === 0) {
  process.exit(0)
}

let msg
try {
  msg = readFileSync(msgFile, 'utf8')
} catch (e) {
  console.error(
    `❌ check-style-verification: 读不到 commit message 文件 ${msgFile} —— 未判定(exit 2):${e?.message ?? e}`,
  )
  process.exit(2)
}
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
  console.error('  Verified-DOM: http://localhost:8801/ai-world (textarea offsetHeight=58 scrollHeight=58 overflowY=hidden)')
  console.error('')
  console.error('跳过方法:HUSKY_SKIP_STYLE_VERIFY=1 git commit ...(紧急 commit 时使用,但建议补验证)')
  console.error('')
  process.exit(1)
}

console.log('✅ 样式验证守门通过(commit message 含 Verified-DOM trailer)')
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
