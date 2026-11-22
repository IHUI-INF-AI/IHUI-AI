// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP Apps 宿主桥的纯判据层(2026-11-23 立)。
 *
 * 为什么单独一层:`iframe` 里跑的是**外部 server 产出的 HTML**,任何"它说了什么"
 * 都不能直接信。这里只做三件无副作用的事:
 *  1. 判一条资源该不该按 MCP App 渲染(`ui://` 或 `text/html;profile=mcp-app`);
 *  2. 判一条 `postMessage` 数据是不是本宿主认的 JSON-RPC 2.0 请求;
 *  3. 按 JSON-RPC 形状造回包(成功/错误),不让组件里手拼对象。
 * 真正的副作用(读资源、调工具)留在组件里,由它带上 server 归属与用户会话。
 *
 * 协议版本取 MCP Apps 的 `2025-06-18`;app 发 `ui/initialize` 时宿主回这个值。
 */

export const MCP_APP_PROTOCOL_VERSION = '2025-06-18'

/** 宿主愿意代理的方法白名单 —— 不在表里的一律 -32601,不给"未知即放行"。 */
export const MCP_APP_METHODS = ['ui/initialize', 'tools/call', 'resources/read', 'ping'] as const

export type McpAppMethod = (typeof MCP_APP_METHODS)[number]

export interface McpAppRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export function isMcpAppMethod(method: string): method is McpAppMethod {
  return (MCP_APP_METHODS as readonly string[]).includes(method)
}

/**
 * `ui://` 前缀是 MCP Apps 的资源约定;其余按 MIME 判,大小写与参数顺序都不挑。
 * `text/html` 但没有 `profile=mcp-app` 的普通 HTML **不**进宿主 —— 它该走纯文本/
 * 下载分支,避免把任意网页塞进可执行 iframe。
 */
export function isMcpAppResource(mimeType: string | undefined, uri: string): boolean {
  if (uri.startsWith('ui://')) return true
  const type = (mimeType ?? '').toLowerCase().replace(/\s+/g, '')
  return type.includes('text/html') && type.includes('profile=mcp-app')
}

/** 只认 JSON-RPC 2.0 请求(有 method、有 id;通知没有 id,宿主不回包)。 */
export function isAppRpcRequest(value: unknown): value is McpAppRpcRequest {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.jsonrpc !== '2.0') return false
  if (typeof data.method !== 'string' || data.method.length === 0) return false
  const id = data.id
  if (typeof id !== 'string' && typeof id !== 'number') return false
  if (data.params !== undefined && (typeof data.params !== 'object' || data.params === null)) {
    return false
  }
  return true
}

export interface McpAppRpcResult {
  jsonrpc: '2.0'
  id: string | number
  result: unknown
}

export interface McpAppRpcError {
  jsonrpc: '2.0'
  id: string | number
  error: { code: number; message: string }
}

export function rpcResult(id: string | number, result: unknown): McpAppRpcResult {
  return { jsonrpc: '2.0', id, result }
}

export function rpcError(id: string | number, code: number, message: string): McpAppRpcError {
  return { jsonrpc: '2.0', id, error: { code, message } }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
