// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端签名注入点(2026-11-17 立,补齐三端 `setClientSignatureProvider` 的唯一落点)。
 *
 * 算法唯一实现在 `@ihui/shared` 的 `utils/client-sign.ts`(纯 JS SHA-256,与服务端同一份);
 * 本文件只做一件事:**记住端注册进来的 provider**,并在组装请求头时把它的返回值塞进
 * `CLIENT_SIGN_HEADER`。不得在此另写一套签名算法(端与服务端拼接格式漂开 = 全端 403 且日志无因)。
 *
 * 失效方向恒为"少一个 header":provider 未注册 / 抛错 / 返回空 ⇒ 一个 header 都不加,
 * 由服务端回落到既有 UA 判据 —— 绝不因为"签名拿不到"就伪造一个占位值。
 */

/**
 * 请求头名(HTTP 线协议常量)。与 `@ihui/shared/src/utils/client-sign.ts` 的
 * `CLIENT_SIGN_HEADER` 逐字一致 —— 本包只依赖 `@ihui/types`(纯类型包,不能承载运行时常量),
 * 故按线协议在此声明;服务端 apps/api 的薄壳 `client-signature.ts` 按同一名字读取。
 * 改名必须两端同批改(改错的后果是签名静默不生效,服务端回落到 UA 判据,日志无因)。
 */
const CLIENT_SIGN_HEADER = 'x-ihui-client'

/** 端注册进来的签名提供者:每次请求现算(时间戳随时间变,不能缓存)。 */
export type ClientSignatureProvider = () => string

let provider: ClientSignatureProvider | null = null

/** 注册/注销签名提供者。传 `null` 即注销(端退出登录时应调用)。 */
export function setClientSignatureProvider(fn: ClientSignatureProvider | null): void {
  provider = typeof fn === 'function' ? fn : null
}

/** 当前是否已注册 provider(供诊断日志用,不暴露签名内容)。 */
export function hasClientSignatureProvider(): boolean {
  return provider !== null
}

/**
 * 取当前签名值。未注册 / 抛错 / 空串 ⇒ 返回 `''`(调用方据此不加该 header)。
 */
export function resolveClientSignature(): string {
  if (provider === null) return ''
  try {
    const v = provider()
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/**
 * 把签名合并进给定请求头(原地改后返回同一对象,便于链式复用)。
 * 已有同名 header 时不覆盖:显式传入优先于默认注入。
 */
export function applyClientSignature(headers: Record<string, string>): Record<string, string> {
  if (headers[CLIENT_SIGN_HEADER]) return headers
  const value = resolveClientSignature()
  if (value) headers[CLIENT_SIGN_HEADER] = value
  return headers
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
