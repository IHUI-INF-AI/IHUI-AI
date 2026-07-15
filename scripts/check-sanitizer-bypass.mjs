#!/usr/bin/env node
/**
 * skipResponseSanitization 一致性检查 pre-commit 守门脚本。
 *
 * 检查所有暂存的 apps/api/src/routes/*.ts 文件(排除 __tests__/),确保:
 * 1. 在 reply.send / success() 响应中返回 token/secret 的端点
 *    设置了 request.skipResponseSanitization = true
 * 2. 否则 response-sanitizer 会把 token 脱敏为 '***',导致功能损坏
 *
 * 检查策略(减少误报):
 * - 排除 __tests__/ 目录(测试文件中的 mock token 不算)
 * - 只检查 reply.send / success( 上下文中出现的敏感字段
 * - 排除 schema 定义行(如 clientSecret: 'string' 是 schema type 定义)
 *
 * 白名单(已在 plugin 入口或端点级别设置旁路):
 * auth.ts / auth-sso.ts / auth-extended.ts / gdpr.ts
 * developer.ts / agents.ts / legacy-completion.ts
 *
 * 用法:node scripts/check-sanitizer-bypass.mjs [--staged]
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

// 敏感字段关键字(与 response-sanitizer DEFAULT_SENSITIVE_KEYS 一致)
const SENSITIVE_KEYWORDS = [
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'clientSecret',
  'apiSecret',
]

// 白名单文件(已在 plugin 入口或端点级别设置旁路)
const WHITELIST = new Set([
  'auth.ts',
  'auth-sso.ts',
  'auth-extended.ts',
  'gdpr.ts',
  'developer.ts',
  'agents.ts',
  'legacy-completion.ts',
  // R70 补齐 — 用户自身/admin 上下文 PII 可见
  'users.ts',
  'auth-identity.ts',
  'webhooks.ts',
  'admin-api-platform.ts',
  'admin.ts',
  'usercenter.ts',
  'admin-auth-edu-routes.ts',
  'member-users.ts',
])

function getFilesToCheck() {
  if (isStaged) {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        cwd: ROOT,
        encoding: 'utf-8',
      })
      return output
        .trim()
        .split('\n')
        .filter(
          (f) =>
            f.startsWith('apps/api/src/routes/') &&
            f.endsWith('.ts') &&
            !f.includes('__tests__/'),
        )
        .map((f) => join(ROOT, f))
    } catch {
      return []
    }
  }
  try {
    const output = execSync('git ls-files "apps/api/src/routes/**/*.ts"', {
      cwd: ROOT,
      encoding: 'utf-8',
    })
    return output
      .trim()
      .split('\n')
      .filter((f) => f && !f.includes('__tests__/'))
      .map((f) => join(ROOT, f))
  } catch {
    return []
  }
}

const files = getFilesToCheck()
let violations = 0

for (const filePath of files) {
  if (!existsSync(filePath)) continue
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/')
  const basename = relPath.split('/').pop()

  if (WHITELIST.has(basename)) continue

  const content = readFileSync(filePath, 'utf-8')

  // 必须同时包含 reply.send/success 和敏感关键字才检查
  const hasReplyOrSuccess = /\breply\.(send|status)/.test(content) || /\bsuccess\s*\(/.test(content)
  if (!hasReplyOrSuccess) continue

  const hasSensitive = SENSITIVE_KEYWORDS.some((kw) => content.includes(kw))
  if (!hasSensitive) continue

  const hasBypass = /skipResponseSanitization\s*=\s*true/.test(content)
  if (hasBypass) continue

  // 检查敏感字段是否在响应上下文中(reply.send / success 后面 5 行内)
  const lines = content.split('\n')
  const violationLines = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!SENSITIVE_KEYWORDS.some((kw) => line.includes(kw))) continue
    // 排除 schema 定义行(如 clientSecret: { type: 'string' })
    if (/:\s*\{?\s*(type|description)\s*:/i.test(line)) continue
    // 排除变量声明(如 const { accessToken } = ...)
    if (/const\s*\{/.test(line) || /let\s*\{/.test(line)) continue
    // 检查前后 5 行是否有 reply.send / success / return
    const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n')
    if (/\b(reply\.send|reply\.status|success\s*\(|return\s)/.test(context)) {
      violationLines.push({ line: i + 1, text: line.trim().slice(0, 100) })
    }
  }

  if (violationLines.length > 0) {
    console.error(
      `❌ ${relPath}: 响应中包含敏感字段(token/secret)但未设置 skipResponseSanitization`,
    )
    for (const v of violationLines.slice(0, 3)) {
      console.error(`   L${v.line}: ${v.text}`)
    }
    console.error(
      `   修复:在返回敏感字段的端点 handler 中添加 request.skipResponseSanitization = true`,
    )
    violations++
  }
}

if (violations > 0) {
  console.error(`\n❌ skipResponseSanitization 检查失败,${violations} 个文件需修复`)
  process.exit(1)
}

console.log('🛡️ skipResponseSanitization 一致性检查通过')
