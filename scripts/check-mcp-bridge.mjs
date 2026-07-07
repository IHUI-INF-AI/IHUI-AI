#!/usr/bin/env node
/**
 * check-mcp-bridge.mjs
 *
 * Stage C-1 守门: MCP 桥接 — 三传输 + OAuth + env 展开 + 去重。
 *
 * 验证项:
 *  1. mcp_bridge.py 存在且 Python 语法合法
 *  2. 关键类/函数无重复定义 (std: 单次 class/async def/def)
 *  3. 三传输 (stdio / http / sse) 都有对应 client
 *  4. OAuth + env 展开 + build_auth_headers 已实现
 *  5. routes.py 已注册 3 个 MCP 端点
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const mcp = join(ROOT, 'server/app/api/v1/workspace/mcp_bridge.py')
const routes = join(ROOT, 'server/app/api/v1/workspace/routes.py')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  const tag = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${tag} ${name}${detail ? ' — ' + detail : ''}`)
}

console.log('\n\x1b[1m[MCP Bridge] 守门\x1b[0m')

if (!existsSync(mcp)) {
  console.log(`  \x1b[31m✗\x1b[0m mcp_bridge.py 不存在`)
  process.exit(1)
}
check('mcp_bridge.py 存在', true)

// 1. 语法
try {
  execFileSync('python', ['-m', 'py_compile', mcp], { stdio: 'pipe' })
  check('Python 语法合法', true)
} catch (e) {
  check('Python 语法合法', false, e.message.slice(0, 100))
}

const src = readFileSync(mcp, 'utf8')
const lines = src.split('\n')

// 2. 去重: 关键符号只出现一次
function countMatches(re) {
  return lines.filter((l) => re.test(l)).length
}
const dupStdio = countMatches(/^class MCPStdioClient/)
const dupHttp = countMatches(/^class MCPHttpClient/)
const dupSse = countMatches(/^class MCPSseClient/)
const dupMgr = countMatches(/^class MCPManager/)
const dupOauth = countMatches(/^class OAuthTokenManager/)

check('MCPStdioClient 无重复', dupStdio === 1, `count=${dupStdio}`)
check('MCPHttpClient 无重复', dupHttp === 1, `count=${dupHttp}`)
check('MCPSseClient 无重复', dupSse === 1, `count=${dupSse}`)
check('MCPManager 无重复', dupMgr === 1, `count=${dupMgr}`)
check('OAuthTokenManager 无重复', dupOauth === 1, `count=${dupOauth}`)

// 3. 关键功能存在
check('expand_env 实现', /def expand_env\(value: Any\) -> Any:/.test(src))
check('_expand_config 实现', /def _expand_config\(config: MCPServerConfig\)/.test(src))
check('OAuthTokenManager.build_auth_url', /def build_auth_url/.test(src))
check('OAuthTokenManager.exchange_code', /async def exchange_code/.test(src))
check('OAuthTokenManager.refresh', /async def refresh/.test(src))
check('build_auth_headers 函数', /def build_auth_headers\(config: MCPServerConfig\)/.test(src))
check('stdio connect', /async def connect\(self\) -> bool:/.test(src))
check('stdio list_tools', /async def list_tools\(self\) -> list\[MCPTool\]:/.test(src))
check('stdio call_tool', /async def call_tool\(self, name: str, arguments: dict\[str, Any\]\) -> str:/.test(src))
check('http list_tools 实现', /class MCPHttpClient[\s\S]+?async def list_tools\(self\) -> list\[MCPTool\]:/.test(src))
check('sse _consume_sse 实现', /async def _consume_sse\(self\) -> None:/.test(src))
check('MCPSseClient POST URL 缓存', /_post_url/.test(src))
check('MCPManager.add_server', /async def add_server\(self, config: MCPServerConfig\) -> bool:/.test(src))
check('MCPManager.list_all_tools', /async def list_all_tools\(self\) -> list\[MCPTool\]:/.test(src))
check('get_mcp_manager 单例', /def get_mcp_manager\(\) -> MCPManager:/.test(src))
check('load_mcp_config 实现', /def load_mcp_config\(workspace_path: str\) -> list\[MCPServerConfig\]:/.test(src))
check('MCP-Session-Id 头处理', /Mcp-Session-Id/.test(src))
check('SSE 响应解析 (text/event-stream)', /text\/event-stream/.test(src))
check('jsonrpc 2.0 协议', /"jsonrpc": "2\.0"/.test(src))
check('protocolVersion 2024-11-05', /2024-11-05/.test(src))

// 4. routes 端点
if (existsSync(routes)) {
  const routesSrc = readFileSync(routes, 'utf8')
  check('GET /workspace/mcp/servers', /@router\.get\("\/mcp\/servers"\)/.test(routesSrc))
  check('POST /workspace/mcp/connect', /@router\.post\("\/mcp\/connect"\)/.test(routesSrc))
  check('GET /workspace/mcp/tools', /@router\.get\("\/mcp\/tools"\)/.test(routesSrc))
} else {
  check('routes.py 存在', false)
}

// 5. 必填 schema 字段引用
check('引用 MCPServerConfig', /MCPServerConfig/.test(src))
check('引用 MCPServerStatus', /MCPServerStatus/.test(src))
check('引用 MCPTool', /MCPTool/.test(src))

// summary
const failed = results.filter((r) => !r.ok)
console.log(`\n  总计: ${results.length}, 通过: ${results.length - failed.length}, 失败: ${failed.length}`)
if (failed.length > 0) {
  console.log('\n  \x1b[31m[失败明细]\x1b[0m')
  failed.forEach((f) => console.log(`    - ${f.name}: ${f.detail}`))
  process.exit(1)
}
console.log('\n  \x1b[32m[ALL PASS]\x1b[0m MCP Bridge 守门全部通过')
