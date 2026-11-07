#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catBatch, gitRaw, Undetermined } from './lib/face-reader.mjs'

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

/**
 * 名单与内容**同面同轮**(BUG-20②,提交链 --staged 档):此前用 `git diff --cached`
 * 划候选(索引面)、却 `readFileSync` 读工作树正文 ⇒ 暂存违规版本 + 工作树改回干净即可洗白。
 * 现 --staged 一次 catBatch 读索引面 `:${p}`;全量档保持既有语义(列 tracked 清单 + 盘上正文,
 * 镜像测试夹具靠它)。清单/内容任一取不到 ⇒ Undetermined ⇒ 调用方 exit 2,绝不返回空清单判绿。
 */
function getFilesToCheck() {
  const pick = (output) =>
    output
      .trim()
      .split('\n')
      .map((f) => f.replace(/\r$/, ''))
      .filter(
        (f) =>
          f &&
          f.startsWith('apps/api/src/routes/') &&
          f.endsWith('.ts') &&
          !f.includes('__tests__/'),
      )
  if (isStaged) {
    try {
      const rels = pick(gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], ROOT))
      const specs = rels.map((p) => `:${p}`)
      const map = catBatch(ROOT, specs)
      return rels.map((rel, i) => ({ rel, content: map.get(specs[i]) }))
    } catch (e) {
      throw new Undetermined(`索引面名单/内容取材失败:${e?.message ?? e}`)
    }
  }
  try {
    const rels = pick(gitRaw(['ls-files', 'apps/api/src/routes/'], ROOT))
    return rels.map((rel) => {
      let content = null
      try {
        content = readFileSync(join(ROOT, rel), 'utf8')
      } catch {
        content = null // 盘上不存在 = 少扫一个,不是取不到
      }
      return { rel, content }
    })
  } catch (e) {
    throw new Undetermined(`全量档名单取材失败:${e?.message ?? e}`)
  }
}

let entries
try {
  entries = getFilesToCheck()
} catch (e) {
  if (e instanceof Undetermined) {
    console.error(`❌ [skipResponseSanitization] 未判定(取不到被审面,既不判绿也不判红):${e.message}`)
    process.exit(2)
  }
  throw e
}
let violations = 0

for (const { rel: relPath, content } of entries) {
  // 该面无此文件(未跟踪/缺席)= 少扫一个,不是取不到;整批取材失败已在上面折成 exit 2。
  if (content === undefined || content === null) continue
  const basename = relPath.split('/').pop()

  if (WHITELIST.has(basename)) continue

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
    // 排除环境变量读取赋值(如 const clientSecret = process.env.X ?? '')——值只进请求体/内部逻辑,不进响应
    if (/=\s*process\.env\./.test(line)) continue
    // 排除 fetch() 调用行(URL/请求体中可能含 access_token/secret 等路径片段)
    if (/\bfetch\s*\(/.test(line)) continue
    // 排除文件写入行(writeFileSync 等,值写本地文件不进响应)
    if (/\b(writeFile|appendFile|createWriteStream)\w*\s*\(/.test(line)) continue
    // 排除 if 条件行(变量名引用,如 if (!clientId || !clientSecret),不是响应字段)
    if (/^\s*if\s*\(/.test(line)) continue
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
