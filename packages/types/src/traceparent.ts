// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * W3C Trace Context(`traceparent`)端侧生成与解析 —— 单一实现(2026-09-28 D147 立)。
 *
 * 为什么要这一份:一轮对话要用一个 trace id 串起四段
 * (端侧生成 → apps/api 转发 → apps/ai-service 处理 → provider/工具调用记录),
 * 而端上此前**没有任何 traceparent 生产者** —— 全仓 `traceparent` 只出现在
 * apps/api 与 apps/ai-service,浏览器/小程序/RN 发出的请求不带该头,
 * 于是 api 端只能在服务端起 trace,"用户在界面上看到的那一轮"与"服务端那条链"
 * 从第一跳就断成两条(实测 grep 面:packages/apps 各端源码 0 命中)。
 *
 * 住在 `packages/types` 而非 `packages/shared` 的理由(现读依赖图,不是偏好):
 * `packages/api-client/package.json` 的 `dependencies` 是**空的**,它只从 `@ihui/types`
 * 取运行时值(见 client.ts 的 `GOAL_WIRE_STATUSES`)。放 shared ⇒ api-client 要么加
 * workspace 依赖(§12e 那类"顺手削掉根 node_modules 链接"的风险),要么各端自己抄一份;
 * 两种都会产出"生产者在,没人消费"。放 types ⇒ 端侧唯一出口 api-client 直接够得着。
 *
 * 格式(spec: https://www.w3.org/TR/trace-context/#traceparent-header):
 *   `version '-' trace-id(32hex) '-' parent-id(16hex) '-' flags(2hex)`
 *   例:`00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01`
 *
 * 三条边界,不得漂:
 * 1. **trace id 只是关联键,不是授权凭据。** 本模块只做格式与携带,不参与任何身份判定;
 *    任何"按 trace id 读/写归属型记录"的入口仍必须按 §5"认证不等于授权"取令牌主体。
 * 2. **与 `apps/api/src/utils/trace-context.ts` 刻意不同名。** 那一份是服务端 Fastify
 *    专用(入参是 `FastifyRequest`),这一份是跨端纯函数(零平台依赖)。两侧导出名若相同,
 *    守门 40 会把服务端那份判成"端内重新实现共享层";真实约束是**格式必须逐字同形**,
 *    所以同形性由 `packages/types/tests/traceparent.test.ts` 与
 *    `apps/api/tests/traceparent-contract.test.ts` 两侧各钉一次,而不是靠共用一个名字。
 * 3. **平台中立(守门 126 纯度同理,本包也不得碰 `node:*`)**:随机源优先
 *    `globalThis.crypto.getRandomValues`(浏览器/Node 18+/多数小程序运行时),
 *    取不到才退 `Math.random` —— trace id 不是密钥,退化不影响正确性,
 *    但**不得**把这里的兜底当随机数生成器复用在他处。
 */

/** 请求头名(小写;HTTP/1.1 头名大小写不敏感,fetch/XHR 一律按小写发)。 */
export const TRACEPARENT_HEADER = 'traceparent'
/** 回带响应头名:端用它把"排查编号"读回来(界面上**不显示**,仅供复制排查)。 */
export const TRACE_ID_RESPONSE_HEADER = 'X-Trace-Id'

/** flags:`01` = sampled(与本仓采样口径一致,维持 0.1,不改)。 */
export const TRACEPARENT_FLAGS_SAMPLED = '01'
/** flags:`00` = 未采样,但 trace 仍延续(留口子,当前不产出)。 */
export const TRACEPARENT_FLAGS_UNSAMPLED = '00'

const TRACE_VERSION = '00'
const TRACE_ID_HEX_LENGTH = 32
const SPAN_ID_HEX_LENGTH = 16

/** traceparent 的四个字段(已按 spec 校验过形态)。 */
export interface W3cTraceparent {
  version: string
  traceId: string
  parentId: string
  flags: string
}

function randomHex(byteLength: number): string {
  const g = globalThis as unknown as {
    crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array }
  }
  const buf = new Uint8Array(byteLength)
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    g.crypto.getRandomValues(buf)
  } else {
    // 兜底:无 WebCrypto 的运行时(部分小程序基础库)。Math.random 逐字节取 0..255。
    for (let i = 0; i < byteLength; i += 1) {
      buf[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (let i = 0; i < buf.length; i += 1) {
    // noUncheckedIndexedAccess 下 buf[i] 是 number | undefined;越界不存在,
    // 但仍不得用 `!` 蒙过去 —— 显式收口成 0,保证产出恒为 2 位 hex。
    out += (buf[i] ?? 0).toString(16).padStart(2, '0')
  }
  return out
}

/** 新生 trace-id:32 位小写 hex,且不得全 0(spec 要求非零)。 */
export function createTraceId(): string {
  for (;;) {
    const hex = randomHex(TRACE_ID_HEX_LENGTH / 2)
    if (/^[0-9a-f]{32}$/.test(hex) && !/^0+$/.test(hex)) return hex
  }
}

/** 新生 parent/span id:16 位小写 hex,且不得全 0。 */
export function createSpanId(): string {
  for (;;) {
    const hex = randomHex(SPAN_ID_HEX_LENGTH / 2)
    if (/^[0-9a-f]{16}$/.test(hex) && !/^0+$/.test(hex)) return hex
  }
}

/** 产出一条全新的 root traceparent(新 trace)。 */
export function createTraceparent(flags: string = TRACEPARENT_FLAGS_SAMPLED): string {
  return `${TRACE_VERSION}-${createTraceId()}-${createSpanId()}-${flags}`
}

/**
 * 严格解析 traceparent。
 * 非法/缺失/长度不符/含非 hex 字符/全 0 ⇒ null(调用方据此决定"另起一条 trace")。
 * 未来版本(spec 允许 `00` 之外带额外字段)只剥掉尾部多余段,不整串否掉。
 */
export function parseW3cTraceparent(raw: string | null | undefined): W3cTraceparent | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  const parts = raw.trim().toLowerCase().split('-')
  if (parts.length < 4) return null
  const [version, traceId, parentId, flags] = parts as [string, string, string, string]
  if (!/^[0-9a-f]{2}$/.test(version) || version === 'ff') return null
  if (!new RegExp(`^[0-9a-f]{${TRACE_ID_HEX_LENGTH}}$`).test(traceId)) return null
  if (!new RegExp(`^[0-9a-f]{${SPAN_ID_HEX_LENGTH}}$`).test(parentId)) return null
  if (!/^[0-9a-f]{2}$/.test(flags)) return null
  if (/^0+$/.test(traceId) || /^0+$/.test(parentId)) return null
  return { version, traceId, parentId, flags }
}

/** 只取 trace-id(32hex);非法输入 ⇒ null。 */
export function traceIdFromTraceparent(raw: string | null | undefined): string | null {
  return parseW3cTraceparent(raw)?.traceId ?? null
}

/** 是否为一条合法 traceparent(供测试与入口校验用)。 */
export function isValidTraceparent(raw: string | null | undefined): boolean {
  return parseW3cTraceparent(raw) !== null
}

/**
 * 给一组出站请求头补 `traceparent`(幂等:已有合法值原样保留 = 延续同一条 trace)。
 *
 * 这是端侧唯一的注入出口 —— `packages/api-client` 的 fetchApi / streamChat /
 * fetchAiServiceJson 等全部经它,所以"生产者"不可能被某一端单独绕过。
 * 返回**新对象**,不原地改调用方传入的 headers(端上 headers 常被复用/冻结)。
 */
export function withTraceparentHeader(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const next: Record<string, string> = { ...(headers ?? {}) }
  // 大小写不敏感查重:端上历史写法不止一种(Traceparent / traceparent)。
  const existingKey = Object.keys(next).find((k) => k.toLowerCase() === TRACEPARENT_HEADER)
  const existing = existingKey ? next[existingKey] : undefined
  if (parseW3cTraceparent(existing)) return next
  next[TRACEPARENT_HEADER] = createTraceparent()
  return next
}

/**
 * 从响应头读回 trace id(回带段)。
 * 兼容三种形态:`X-Trace-Id`(ai-service 中间件直接产出)、`x-trace-id`、
 * 以及只有 `traceparent` 回显的通道。取不到 ⇒ null,**不得**回退成猜测值。
 */
export function readTraceIdFromResponse(
  headers: Record<string, string> | { get(name: string): string | null } | undefined | null,
): string | null {
  if (!headers) return null
  const get = (name: string): string | null => {
    if (typeof (headers as { get?: unknown }).get === 'function') {
      return (headers as { get: (n: string) => string | null }).get(name)
    }
    const bag = headers as Record<string, string>
    const key = Object.keys(bag).find((k) => k.toLowerCase() === name.toLowerCase())
    return key ? bag[key] ?? null : null
  }
  const direct = get(TRACE_ID_RESPONSE_HEADER)
  const traceId = traceIdFromTraceparent(direct) ?? direct
  if (traceId && /^[0-9a-f]{32}$/i.test(traceId)) return traceId.toLowerCase()
  return traceIdFromTraceparent(get(TRACEPARENT_HEADER))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
