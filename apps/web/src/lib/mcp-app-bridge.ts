// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP Apps 宿主桥的纯判据层(2026-11-23 立)。
 *
 * 为什么单独一层:`iframe` 里跑的是**外部 server 产出的 HTML**,任何"它说了什么"
 * 都不能直接信。这里只做四件无副作用的事:
 *  1. 判一条资源该不该按 MCP App 渲染(`ui://` 或 `text/html;profile=mcp-app`);
 *  2. 判一条 `postMessage` 数据是不是本宿主认的 JSON-RPC 2.0 请求;
 *  3. 按 JSON-RPC 形状造回包(成功/错误),不让组件里手拼对象;
 *  4. 给 app HTML 注入 CSP,把网络出口收到只剩宿主桥。
 * 真正的副作用(读资源、调工具)留在组件里,由它带上 server 归属与用户会话。
 *
 * 协议版本取 MCP Apps 的 `2025-06-18`;app 发 `ui/initialize` 时宿主回这个值。
 */

export const MCP_APP_PROTOCOL_VERSION = '2025-06-18'

/**
 * MCP App iframe 的 CSP(2026-11-23 立,对齐 WorkBuddy 宿主的强制注入)。
 *
 * `sandbox="allow-scripts"` 只切断了同源凭据,并没有切断网络:没有 CSP 的 app 仍能
 * 把读到的内容 `fetch` 到任意地址。这里把出口收到只剩宿主桥:
 *  - `connect-src 'none'`:fetch/XHR/WebSocket/beacon 全部拒绝;
 *  - `script-src 'unsafe-inline'`:srcDoc 里的内联脚本可跑,外部脚本一律不加载;
 *  - `img-src data: blob: https:` / `media-src https:`:允许展示型资源,不允许回传;
 *  - `frame-src 'none'`:app 不能再套一层 iframe 绕过来源校验。
 * 一切副作用必须走 `tools/call` / `resources/read` 宿主桥。
 */
export const MCP_APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  'img-src data: blob: https:; font-src data:; media-src https:; ' +
  "connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"

/**
 * 把 CSP `<meta>` 放进 app HTML。有 `<head>` 就紧跟其后,没有就前置;
 * 多次调用会重复插入,但多个 CSP 策略是交集(更严者生效),不会放宽安全性。
 */
export function applyAppCsp(html: string): string {
  if (!html) return html
  const tag = `<meta http-equiv="Content-Security-Policy" content="${MCP_APP_CSP}">`
  const head = /<head[^>]*>/i
  if (head.test(html)) return html.replace(head, (match) => `${match}${tag}`)
  return `${tag}${html}`
}

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
