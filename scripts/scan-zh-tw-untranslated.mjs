#!/usr/bin/env node
/* eslint-disable */
/**
 * 扫描 zh-TW.json 中漏译的英文 value，结果写入 _scan_result.json。
 */
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('apps/web/messages/zh-TW.json')
const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')

const whitelist = new Set([
  'Apple', 'Edu', 'Grok', 'OpenAI', 'Anthropic', 'StepFun', 'Agnes',
  'GitHub', 'OAuth', 'JWT', 'WebSocket', 'SSE', 'URL', 'URI', 'ID',
  'Course', 'Live', 'Exam', 'Web', 'PC', 'Mac', 'iOS', 'Android',
  'TypeScript', 'JavaScript', 'Python', 'React', 'Next.js', 'Tailwind',
  'Shadcn', 'Tauri', 'LangGraph', 'LiteLLM', 'MCP', 'Fastify',
  'PostgreSQL', 'Redis', 'BullMQ', 'Drizzle', 'pnpm', 'Turborepo',
  'OpenAPI', 'REST', 'GraphQL', 'WebRTC', 'WebAssembly', 'CSS', 'HTML',
  'AI', 'AIGC', 'API', 'SDK', 'CLI', 'TUI', 'GUI', 'HTTP', 'HTTPS',
  'Token', 'JSON', 'XML', 'YAML', 'Markdown', 'MDX',
  'Vercel', 'Stripe', 'Aliyun', 'Tencent', 'WeChat', 'TikTok',
  'LiveEn', 'CoursesEn', 'ExamEn',
  'Brand', 'Subtitle', 'Title', 'Content', 'Description',
  'Greeting', 'Hello', 'Welcome',
  'Print', 'Minimize', 'Dismiss',
  'Hours', 'Minutes', 'Seconds', 'Days',
  'Open', 'Close', 'Cancel', 'Save', 'Delete', 'Edit', 'Submit',
  'Reset', 'Loading', 'Success', 'Error', 'Warning', 'Info',
  'Weak', 'Strong', 'Schedule', 'Navigation', 'External',
  'Platform', 'Connect', 'Explore',
  'Home', 'Search', 'Profile', 'Settings', 'About', 'Help',
  'Done', 'Back', 'Next', 'Prev', 'Yes', 'No',
  'Reply', 'Forward', 'Send', 'Receive', 'Share', 'Copy', 'Paste',
  'Upload', 'Download', 'Refresh', 'Reload',
  'Default', 'Required', 'Optional',
  'Username', 'Password', 'Email', 'Phone', 'Address',
  'Login', 'Logout', 'Register', 'Signin', 'Signout', 'Signup',
  'subagent', 'subagent-driven', 'webapp', 'webapp-driven',
])

const issues = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const m = line.match(/^\s+"([^"]+)":\s+"([^"]*)"\s*,?\s*$/)
  if (!m) continue
  const key = m[1]
  const value = m[2]
  if (!value || value.length < 2) continue
  if (/[\u4e00-\u9fff]/.test(value)) continue
  if (!/[A-Za-z]/.test(value)) continue
  if (whitelist.has(value)) continue
  issues.push({ line: i + 1, key, value })
}

const byValue = new Map()
for (const it of issues) {
  const v = it.value
  if (!byValue.has(v)) byValue.set(v, [])
  byValue.get(v).push(it)
}
const sorted = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length)

const out = []
out.push(`Found ${issues.length} potential missing translations in zh-TW.json`)
out.push('')
for (const [value, list] of sorted) {
  out.push(`"${value}"  x${list.length}`)
  for (const it of list) {
    out.push(`  L${it.line}: "${it.key}": "${it.value}"`)
  }
}
fs.writeFileSync(path.resolve('apps/web/messages/_zh-tw-scan-result.txt'), out.join('\n'), 'utf8')
console.log(`Written: apps/web/messages/_zh-tw-scan-result.txt (${out.join('\n').length} bytes)`)
console.log(`Total: ${issues.length} issues, ${byValue.size} unique values`)
