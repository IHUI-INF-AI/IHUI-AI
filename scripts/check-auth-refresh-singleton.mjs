#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-auth-refresh-singleton.mjs - Guard: 客户端 auth refresh 必须走单一权威入口
 * `refreshAccessTokenOnce`(@ihui/api-client 全局单例),禁止任何端绕过单例直接发
 * `/auth/refresh`,否则并发 401 会各触发一次 refresh,后端 refresh token 单次轮转 +
 * RFC 6749 §10.4 family 重用检测 → 整个 family 被吊销 → 登录态静默丢失(刷新风暴)。
 *
 * 背景(2026-09-04 根治):
 *   - web 端曾有三套互不知情的 refresh 路径(use-auth.ts 裸 fetchApi / tokenUtils.ts
 *     endpoint 函数 / 401 拦截器单例),且单例失败后无冷却,形成 6+ 次串行重复。
 *   - extension 端 token-utils.ts 同样裸调 refreshAccessToken(endpoint 函数)。
 *   - 根治 = 封死裸入口 + 本静态守门,确保未来任何端新增代码都无法再绕过单例。
 *
 * 检测规则(只扫客户端业务代码,排除后端/测试/定义处):
 *   1. `fetchApi(..., '/auth/refresh' 或 '/api/auth/refresh')` 直接调用
 *   2. `fetch(...'/auth/refresh'...)` 直接调用
 *   3. 导入并调用裸 `refreshAccessToken(...)`(endpoint 函数,绕过单例)
 *   允许(白名单):
 *   - packages/api-client/src/endpoints/auth.ts(函数定义处 + 注释)
 *   - apps/api 与 packages/auth(后端服务端实现,非客户端风暴域)
 *   - tests 目录与 test/spec 文件(mock 场景)
 *   - api.ts 注入的 refreshAccessToken 回调(它内部调 fetchApiShared,经 isAuthEndpoint 判断
 *     不递归,且是单例 refreshAccessTokenOnce 的唯一实现载体,合法)
 *
 * Usage:
 *   node scripts/check-auth-refresh-singleton.mjs           # full check
 *   node scripts/check-auth-refresh-singleton.mjs --quiet   # errors only
 *
 * Exit: 0 = 无绕过单例的裸 refresh 调用, 1 = 发现违规
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const quiet = process.argv.includes('--quiet') || process.argv.includes('-q')

/** 递归收集目录下所有 .ts/.tsx/.mjs/.js 文件(排除 node_modules/dist/.next/.pnpm/.output 构建产物) */
function collectFiles(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === '.next' ||
      name === '.pnpm' ||
      name === '.git' ||
      name === '.output' ||
      name === 'build' ||
      name === 'coverage' ||
      name === 'out' ||
      name === '.turbo'
    ) continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) collectFiles(p, acc)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) acc.push(p)
  }
  return acc
}

/** 判断路径是否属于后端服务端实现(非客户端风暴域) */
function isBackend(p) {
  const rel = p.replace(/\\/g, '/')
  return rel.includes('/apps/api/') || rel.includes('/packages/auth/')
}

/** 判断路径是否为测试文件 */
function isTest(p) {
  const rel = p.replace(/\\/g, '/')
  return rel.includes('/tests/') || /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(rel)
}

/** 判断是否为 endpoint 函数定义处(白名单) */
function isEndpointDefinition(p) {
  const rel = p.replace(/\\/g, '/')
  return rel === 'packages/api-client/src/endpoints/auth.ts'
}

/** 判断是否为 api.ts 注入的 refreshAccessToken 回调(单例实现载体,合法) */
function isTokenProviderInjection(p, line) {
  const rel = p.replace(/\\/g, '/')
  // web: apps/web/src/lib/api.ts 里的 refreshAccessToken: async () => {...}
  // 特征是对象属性方法注入,而非 `refreshAccessToken(...)` 函数调用
  if (rel.includes('apps/web/src/lib/api.ts')) {
    return /refreshAccessToken\s*:\s*(async\s*)?\(/.test(line)
  }
  return false
}

/**
 * 判断是否为 extension 端 doRefresh 内的裸 refreshAccessToken 调用。
 * extension 端有独立的 inFlight 去重(createInFlightRefresh + get/set/clear),
 * 走 chrome.alarms 定时器 + 独立 chrome.storage token 存储,不依赖 401 拦截器,
 * doRefresh 内部已保证同一时刻只发一次 refresh,无风暴风险。故豁免其裸调用,
 * 但仍拦截 extension 其他位置绕过 doRefresh 的裸 refreshAccessToken 调用。
 */
function isExtensionDoRefreshScope(p, lines, idx) {
  const rel = p.replace(/\\/g, '/')
  // p 是绝对路径(collectFiles 返回),用 endsWith 匹配扩展端 token-utils.ts
  if (!rel.endsWith('apps/extension/lib/token-utils.ts')) return false
  // 向上找最近的函数定义,确认当前行在 doRefresh 函数体内
  for (let j = idx; j >= 0; j--) {
    if (/export\s+async\s+function\s+doRefresh/.test(lines[j])) return true
    // 遇到其他顶层函数定义则说明不在 doRefresh 内
    if (j < idx && /^(export\s+)?(async\s+)?function\s+\w+/.test(lines[j].trim()) && j !== idx) return false
  }
  return false
}

const violations = []

/** 扫描单个文件,检测绕过单例的裸 refresh 调用 */
function scanFile(p) {
  if (isBackend(p) || isTest(p) || isEndpointDefinition(p)) return

  let content
  try {
    content = readFileSync(p, 'utf8')
  } catch {
    return
  }
  const lines = content.split('\n')
  const rel = relative(root, p).replace(/\\/g, '/')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ln = i + 1
    // 跳过纯注释行(历史说明文字里可能提到 refreshAccessToken,非真实调用)
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 规则 1 & 2: 直接 fetch/fetchApi 到 /auth/refresh(绕过单例)
    // 匹配 fetchApi('/auth/refresh') / fetch('/api/auth/refresh') 等
    const directFetch = /(?:fetchApi|fetch|fetchApiShared|fetchRaw)\s*\(\s*(['"`])(\/api)?\/auth\/refresh\1/.exec(line)
    if (directFetch && !isTokenProviderInjection(p, line)) {
      violations.push({
        file: rel,
        line: ln,
        code: line.trim(),
        rule: 'direct-fetch',
        reason: '直接 fetch /auth/refresh,绕过 refreshAccessTokenOnce 单例',
      })
      continue
    }

    // 规则 3: 调用裸 refreshAccessToken(...)(endpoint 函数)
    // 排除: 定义处(export async function refreshAccessToken)、注入回调(refreshAccessToken: async () =>)
    // 排除: refreshAccessTokenOnce(带 Once 后缀的是合法单例)
    // 排除: MCP OAuth 领域的 refreshAccessToken(oauthConfig, refreshToken) —— 两参签名,
    //   属 CLI 的 MCP 第三方 OAuth 令牌续期,与用户登录态 /auth/refresh 完全无关(不同域)。
    if (/refreshAccessToken\s*\(/.test(line) && !/refreshAccessTokenOnce/.test(line)) {
      if (/export\s+(async\s+)?function\s+refreshAccessToken/.test(line)) continue
      if (isTokenProviderInjection(p, line)) continue
      // MCP OAuth: refreshAccessToken(oauthConfig, refreshToken) 或 refreshAccessToken(makeOAuthConfig(), ...)
      // 特征是第一个实参是 oauthConfig/makeOAuthConfig/config 对象,而非用户登录态的单 refreshToken 字符串
      if (/refreshAccessToken\s*\(\s*(oauthConfig|makeOAuthConfig|config)\s*,/.test(line)) continue
      // extension doRefresh 内:有独立 inFlight 去重,豁免
      if (isExtensionDoRefreshScope(p, lines, i)) continue
      violations.push({
        file: rel,
        line: ln,
        code: line.trim(),
        rule: 'bare-refreshAccessToken',
        reason: '调用裸 refreshAccessToken(endpoint 函数),绕过 refreshAccessTokenOnce 单例',
      })
    }
  }
}

if (!quiet) console.log('[check-auth-refresh-singleton] 扫描客户端 auth refresh 调用点...')

const dirs = ['apps', 'packages']
for (const d of dirs) {
  const abs = join(root, d)
  for (const f of collectFiles(abs)) scanFile(f)
}

if (violations.length === 0) {
  if (!quiet) console.log('[check-auth-refresh-singleton] ✅ 无绕过单例的裸 refresh 调用')
  process.exit(0)
}

console.error(`[check-auth-refresh-singleton] ❌ 发现 ${violations.length} 处绕过单例的裸 refresh 调用:`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.reason}`)
  console.error(`      ${v.code}`)
}
console.error('  修复:客户端续期必须走 @ihui/api-client 的 refreshAccessTokenOnce 全局单例,')
console.error('  或经 tokenProvider.refreshAccessToken 注入(由单例统一调度)。禁止裸调 endpoint 函数。')
process.exit(1)
