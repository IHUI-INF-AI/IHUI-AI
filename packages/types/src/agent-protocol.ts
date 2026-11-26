// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L14 三端共用协议契约(2026-11-26)。
 *
 * 单一真相源为什么放在 `@ihui/types`:
 *  - `@ihui/agent-sdk` 依赖它,CLI/ACP 不再硬编码方法名;
 *  - `@ihui/api-client` 已依赖它,web/RN/小程序共同经这条链拿到同一份方法表;
 *  - 它是纯常量 + 类型,不 import `node:*`,可安全进浏览器/小程序包。
 *
 * 传输边界(诚实):ACP 的 stdio NDJSON 服务仍在 CLI;三端 HTTP 业务通过
 * `x-ihui-acp-method` 头携带同一方法身份,方法名与错误码不再各写一份。
 */

/** ACP 方法名(请求)与通知名。键是语义名,值是线上一字不差的字面量。 */
export const ACP_METHODS = {
  initialize: 'initialize',
  authenticate: 'authenticate',
  sessionNew: 'session/new',
  sessionLoad: 'session/load',
  sessionPrompt: 'session/prompt',
  sessionCancel: 'session/cancel',
  sessionUpdate: 'session/update',
} as const

export type AcpMethodKey = keyof typeof ACP_METHODS
export type AcpMethodName = (typeof ACP_METHODS)[AcpMethodKey]

/** 请求类方法(有 response)。`session/update` 是通知,不在其内。 */
export const ACP_REQUEST_METHODS: readonly AcpMethodName[] = [
  ACP_METHODS.initialize,
  ACP_METHODS.authenticate,
  ACP_METHODS.sessionNew,
  ACP_METHODS.sessionLoad,
  ACP_METHODS.sessionPrompt,
  ACP_METHODS.sessionCancel,
]

export const ACP_NOTIFICATION_METHODS: readonly AcpMethodName[] = [ACP_METHODS.sessionUpdate]

/** SDK/三端统一错误码;HTTP 侧只做映射,不另造一套字符串。 */
export const AGENT_SDK_ERROR_CODES = ['PROTOCOL', 'RPC', 'SPAWN', 'AGENT_EXIT', 'ABORTED'] as const

export type AgentSdkErrorCode = (typeof AGENT_SDK_ERROR_CODES)[number]

/** HTTP 业务请求携带 ACP 方法身份的请求头(服务端可忽略,客户端不得写第二份)。 */
export const AGENT_PROTOCOL_METHOD_HEADER = 'x-ihui-acp-method' as const

export function acpMethodHeaders(method: AcpMethodName): Record<string, string> {
  return { [AGENT_PROTOCOL_METHOD_HEADER]: method }
}
