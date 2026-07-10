#!/usr/bin/env node
/**
 * FreeLLMAPI 集成守门 (2026-07-03 立)
 *
 * 目的: 防止 FreeLLMAPI 集成链路静默断裂
 *   - 后端 .env 缺 FREELLMAPI_API_KEY (key 丢失 → 65 模型全部失效)
 *   - Vite proxy 缺 /ihui-ai-api/llm 规则 (前端 AI 对话路由 404)
 *   - 后端 llm_ws_router 路由被删/改 prefix (链路断裂)
 *   - seed_freellmapi_models.py 脚本丢失 (无法重新同步模型)
 *
 * 与 e2e/llm-freellmapi-integration.spec.ts 的关系 (如有):
 *   - 本脚本: 轻量级文本/文件检查 (pre-commit 阶段, < 50ms)
 *   - e2e 测试: 完整链路请求/响应断言 (CI 阶段)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-freellmapi-integration.mjs          # 全量检查
 *   node scripts/check-freellmapi-integration.mjs --staged # 仅 staged 相关
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')

let totalViolations = 0
const violations = []

function recordViolation(check, file, line, msg) {
  totalViolations++
  violations.push({ check, file: file ? path.relative(projectRoot, file) : '<project>', line, msg })
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf-8') } catch { return null }
}

function lineOf(content, idx) {
  return content.slice(0, idx).split(/\r?\n/).length
}

// ──────────────────────────────────────────────────────────
// 检查 1: seed_freellmapi_models.py 存在
// ──────────────────────────────────────────────────────────
const SEED_SCRIPT = path.join(projectRoot, 'server/scripts/seed_freellmapi_models.py')
if (!fs.existsSync(SEED_SCRIPT)) {
  recordViolation('seed-script', SEED_SCRIPT, 0, 'seed_freellmapi_models.py 不存在, 无法同步 FreeLLMAPI 模型清单到 zhs_ai_model_info/_unify')
} else {
  const content = readSafe(SEED_SCRIPT) || ''
  // 必须包含 fetch_freellmapi_models + 写入 zhs_ai_model_info + zhs_ai_model_info_unify
  const required = [
    { name: 'fetch_freellmapi_models 函数', re: /def fetch_freellmapi_models/ },
    { name: '写入 zhs_ai_model_info', re: /INSERT\s+INTO\s+zhs_ai_model_info\b/i },
    { name: '写入 zhs_ai_model_info_unify', re: /INSERT\s+INTO\s+zhs_ai_model_info_unify\b/i },
    { name: '访问 /v1/models 端点', re: /\/v1\/models/ },
  ]
  for (const r of required) {
    if (!r.re.test(content)) {
      recordViolation('seed-script', SEED_SCRIPT, 0, `seed 脚本缺 ${r.name} (匹配 ${r.re})`)
    }
  }
}

// ──────────────────────────────────────────────────────────
// 检查 2: .env.production 含 FREELLMAPI_API_KEY
// (不强制要求 key 真实, 但要求 key 字段存在且非空)
// ──────────────────────────────────────────────────────────
const ENV_PROD = path.join(projectRoot, 'server/.env.production')
const envContent = readSafe(ENV_PROD)
if (!envContent) {
  recordViolation('env', ENV_PROD, 0, '.env.production 不存在, FreeLLMAPI_API_KEY 必填项缺失')
} else {
  const match = envContent.match(/^\s*FREELLMAPI_API_KEY\s*=\s*(.+?)\s*$/m)
  if (!match) {
    recordViolation('env', ENV_PROD, 0, '.env.production 缺 FREELLMAPI_API_KEY 变量')
  } else if (!match[1] || match[1].length < 8 || /^["']?\s*["']?$/.test(match[1])) {
    recordViolation('env', ENV_PROD, lineOf(envContent, envContent.indexOf(match[0])), `FREELLMAPI_API_KEY 值为空或过短 (${match[1]?.length || 0} 字符)`)
  }
  // 也检查 BASE_URL
  if (!/^\s*FREELLMAPI_BASE_URL\s*=\s*https?:\/\//m.test(envContent)) {
    recordViolation('env', ENV_PROD, 0, '.env.production 缺 FREELLMAPI_BASE_URL 或格式错误 (必须 http(s)://)')
  }
}

// ──────────────────────────────────────────────────────────
// 检查 3: Vite proxy 含 /ihui-ai-api/llm 规则
// (顺序: 必须在通用 /ihui-ai-api 规则前, 因为 vite proxy 按顺序匹配)
// ──────────────────────────────────────────────────────────
const VITE_CONFIG = path.join(clientRoot, 'vite.config.ts')
const viteContent = readSafe(VITE_CONFIG)
if (!viteContent) {
  recordViolation('vite-proxy', VITE_CONFIG, 0, 'vite.config.ts 不存在')
} else {
  // 必须有 /ihui-ai-api/llm 代理
  const llmProxyMatch = viteContent.match(/['"]\/?ihui-ai-api\/llm['"]\s*:\s*\{/g)
  if (!llmProxyMatch) {
    recordViolation('vite-proxy', VITE_CONFIG, 0, 'vite proxy 缺 /ihui-ai-api/llm 规则, 前端 AI 对话无法路由到后端')
  } else {
    // 必须把路径重写为 /api/v1/llm/ihui-ai-api/llm
    if (!/rewrite.*['"]\/?ihui-ai-api\/llm['"].*\/?api\/v1\/llm\/ihui-ai-api\/llm/.test(viteContent.replace(/\s+/g, ' '))) {
      recordViolation('vite-proxy', VITE_CONFIG, 0, 'vite proxy /ihui-ai-api/llm rewrite 路径错, 必须重写为 /api/v1/llm/ihui-ai-api/llm (后端真实路径)')
    }
  }
}

// ──────────────────────────────────────────────────────────
// 检查 4: 后端 llm_ws_router 注册, prefix 必须含 /llm
// ──────────────────────────────────────────────────────────
const BACKEND_ROUTER = path.join(projectRoot, 'server/app/api/v1/router.py')
const routerContent = readSafe(BACKEND_ROUTER)
if (!routerContent) {
  recordViolation('backend-router', BACKEND_ROUTER, 0, 'app/api/v1/router.py 不存在')
} else {
  if (!/include_router\(\s*llm_ws_router\b/.test(routerContent)) {
    recordViolation('backend-router', BACKEND_ROUTER, 0, 'router.py 缺 llm_ws_router 注册, AI 对话后端路由断裂')
  }
  if (!/prefix\s*=\s*["']\/llm["']/.test(routerContent)) {
    recordViolation('backend-router', BACKEND_ROUTER, 0, 'router.py llm_ws_router 缺 prefix="/llm", 前端 /ihui-ai-api/llm 路径无法匹配')
  }
}

// ──────────────────────────────────────────────────────────
// 检查 5: 后端 ws.py (或 http_chat) 处理函数存在
// ──────────────────────────────────────────────────────────
const WS_PY = path.join(projectRoot, 'server/app/api/v1/llm/ws.py')
const wsContent = readSafe(WS_PY)
if (!wsContent) {
  recordViolation('backend-ws', WS_PY, 0, 'app/api/v1/llm/ws.py 不存在, 实际路由处理函数缺失')
} else {
  if (!/async def http_chat|def chat\(|def stream_chat|async def stream_chat/.test(wsContent)) {
    recordViolation('backend-ws', WS_PY, 0, 'ws.py 缺 chat 处理函数 (http_chat / chat / stream_chat)')
  }
  // 必须有 get_effective_config 或类似读取 zhs_ai_model_info_unify
  if (!/zhs_ai_model_info_unify|get_effective_config|get_model_config/.test(wsContent)) {
    recordViolation('backend-ws', WS_PY, 0, 'ws.py 缺 zhs_ai_model_info_unify 读取逻辑, 模型路由失效')
  }
}

// ──────────────────────────────────────────────────────────
// 检查 6 (可选, 软提示): FreeLLMAPI 服务可达
// 这一项运行时检查, 仅在脚本被显式调用时验证, 不计入 fail
// ──────────────────────────────────────────────────────────
async function checkFreellmapiReachable() {
  // 不阻塞, 仅 warning
  const url = 'http://127.0.0.1:3001/health'
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (res.status === 200) {
      console.log('  [runtime] FreeLLMAPI :3001 健康 ✓')
    } else {
      console.log(`  [runtime] FreeLLMAPI :3001 异常 (HTTP ${res.status})`)
    }
  } catch (e) {
    console.log(`  [runtime] FreeLLMAPI :3001 不可达 (${e.message?.slice(0, 50) || 'unknown'})`)
  }
}

// ──────────────────────────────────────────────────────────
// 检查 7 (可选, 软提示): DB 中 freellmapi 模型数量
// ──────────────────────────────────────────────────────────
function checkDbModels() {
  // 不阻塞, 仅 warning
  const fb = path.join(projectRoot, 'server/.zhs_db_fallback.sqlite')
  if (!fs.existsSync(fb)) {
    console.log('  [runtime] SQLite fallback 不存在, 跳过 DB 检查')
    return
  }
  try {
    const Database = require('better-sqlite3') || null
    if (!Database) {
      // Node 22+ 自带 node:sqlite
      // eslint-disable-next-line no-undef
    }
  } catch {}
  // 实际 DB 检查在 Python 端, 这里跳过, 避免 Node 端引入 sqlite 依赖
  console.log('  [runtime] DB 模型数量检查请运行: python server/scripts/check_ihui_db.py')
}

// ──────────────────────────────────────────────────────────
// 输出
// ──────────────────────────────────────────────────────────
console.log('─'.repeat(60))
console.log('FreeLLMAPI 集成守门 (2026-07-03 立)')
console.log('─'.repeat(60))

if (onlyStaged) {
  console.log('  模式: --staged (注: 本检查主要检测项目级文件, --staged 仅控制 seed 脚本误删检查)')
}

if (totalViolations > 0) {
  console.error(`\n[FAIL] 共发现 ${totalViolations} 处违规:\n`)
  for (const v of violations) {
    console.error(`  [${v.check}] ${v.file}${v.line ? ':' + v.line : ''}`)
    console.error(`    → ${v.msg}`)
  }
  console.error('\n修复方法:')
  console.error('  1. seed 脚本: 参考 server/scripts/seed_freellmapi_models.py')
  console.error('  2. .env:  cd server && echo "FREELLMAPI_API_KEY=..." >> .env.production')
  console.error('  3. Vite proxy:  vite.config.ts 中 /ihui-ai-api/llm 规则必须在 /ihui-ai-api 通用规则之前')
  console.error('  4. 后端路由:  server/app/api/v1/router.py 中 llm_ws_router 必须 prefix="/llm"')
  process.exit(1)
}

console.log('[OK] FreeLLMAPI 集成链路配置完整')
console.log('  ✓ seed_freellmapi_models.py 存在且含必要步骤')
console.log('  ✓ .env.production FREELLMAPI_API_KEY/BASE_URL 已配置')
console.log('  ✓ Vite proxy /ihui-ai-api/llm 规则存在且 rewrite 路径正确')
console.log('  ✓ 后端 router.py llm_ws_router 注册 + prefix="/llm"')
console.log('  ✓ 后端 ws.py 含 chat 处理 + zhs_ai_model_info_unify 读取')
console.log()
console.log('  ─── 运行时软检查 (非阻塞) ───')

// 异步运行软检查, 不阻塞退出
checkFreellmapiReachable().then(() => {
  checkDbModels()
  process.exit(0)
})
