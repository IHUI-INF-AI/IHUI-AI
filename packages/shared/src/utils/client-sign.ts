// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端签名 —— 让服务端能"认出这是自己的原生客户端",而不是靠 User-Agent 猜。
 *
 * 为什么需要它(2026-11-17 立):生产登录端点的 Turnstile 判据原先只能按 UA 区分
 * 「浏览器上下文 vs 原生客户端」,而 UA 是请求里**明文可改**的一个字段 ——
 * 脚本把 UA 改成 `okhttp/4.12.0` 就能拿到"原生客户端"豁免,等于人机验证对脚本无效。
 * 签名头 `X-IHUI-Client: <appId>.<tsMs>.<sig>` 把这件事变成"要么有共享密钥,要么没有":
 * 改 UA 不再有任何收益。
 *
 * 设计取舍(如实登记,不是已收口):
 * - 用的是**共享密钥 + SHA-256 摘要**,不是 HMAC,也不是非对称签名。理由是这条判据的目标
 *   是"抬掉零成本绕过",不是密码学强度:密钥若被打包逆向取出,攻击者无论拿 HMAC 还是
 *   非对称都能算出合法签名 —— 差异只在"取密钥的难度",而客户端的密钥本来就在包里。
 *   真要去掉这一类风险,只有"客户端不持密钥、走设备证书"那一档,属后续架构变更。
 * - 摘要走字符串域(`sha256Hex`),而不是字节域 HMAC,是为了跨四类宿主(web / 小程序 /
 *   RN / Node)复用**同一份**纯 JS 实现,不引入第二份散列(本仓「单一真相源」铁律)。
 * - 时间戳只用来限制"重放窗口",不承担新鲜度证明:两端时钟允许 ±10 分钟。
 * - 失效方向恒为"多一次人机验证",不是"多放一次跳门":验签失败 ⇒ 服务端回落到既有 UA
 *   判据(行为与未引入签名时逐字相同),绝不因为"验签没过"就放行。
 *
 * 纪律:
 * - 本层只产/只判**字符串**,不读环境、不读凭证文件 —— 调用方负责把 secret 注入进来;
 *   凭证永远不进仓(AGENTS §5d)。
 * - 服务端判据入口在 `apps/api/src/services/client-signature.ts` 薄壳调用本层,算法
 *   唯一实现在这里;各端只调 `formatClientSignature`,不自行拼格式。
 */

import { sha256Hex } from './tool-args-digest.js'

/** 请求头名(小写;HTTP 头大小写不敏感,发送时按此拼) */
export const CLIENT_SIGN_HEADER = 'x-ihui-client'

/** 算法版本:改了拼接格式必须 +1,否则新旧两套签名会在同一个校验里互相冒充 */
export const CLIENT_SIGN_VERSION = 'ihui-client-v1'

/** 两端时钟允许的最大偏差(±10 分钟);只限制重放窗口,不用于新鲜度证明 */
export const CLIENT_SIGN_MAX_SKEW_MS = 600_000

/** 原生客户端标识(appid:ihui-app / ihui-cli / ihui-miniapp / ihui-desktop) */
export type ClientAppId = string

/** 参与签名的规范化载荷 —— 端与服务端必须逐字一致(改格式要同时 +1 版本号) */
function canonicalPayload(appId: ClientAppId, tsMs: number, secret: string): string {
  return `${CLIENT_SIGN_VERSION}|${appId}|${tsMs}|${secret}`
}

/** 计算签名值(64 位小写 hex) */
export function computeClientSignature(secret: string, appId: ClientAppId, tsMs: number): string {
  if (!secret) throw new Error('computeClientSignature: secret 为空(客户端签名未注入密钥)')
  if (!appId) throw new Error('computeClientSignature: appId 为空')
  if (!Number.isFinite(tsMs)) throw new Error('computeClientSignature: 时间戳无效')
  return sha256Hex(canonicalPayload(appId, tsMs, secret))
}

/**
 * 生成上线用的完整头值 `appId.tsMs.sig`。
 * `tsMs` 可省略(默认取当前时刻);**每次请求前调用**才能让时间戳保持在窗口内。
 */
export function formatClientSignature(
  secret: string,
  appId: ClientAppId,
  tsMs: number = Date.now(),
): string {
  return `${appId}.${tsMs}.${computeClientSignature(secret, appId, tsMs)}`
}

/** 解析签名头。任何形态异常一律返回 null,由调用方按"没有有效签名"处理。 */
export function parseClientSignature(raw: unknown): { appId: string; tsMs: number; sig: string } | null {
  if (typeof raw !== 'string' || !raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [appId, tsRaw, sig] = parts
  if (!appId || !tsRaw || !sig) return null
  const tsMs = Number(tsRaw)
  if (!Number.isFinite(tsMs) || tsMs <= 0) return null
  if (!/^[0-9a-f]{64}$/i.test(sig)) return null
  return { appId, tsMs, sig: sig.toLowerCase() }
}

/** 时间戳是否仍在允许窗口内(独立出口,便于服务端给出"过期"这一确定性理由) */
export function isClientSignatureFresh(tsMs: number, nowMs: number = Date.now()): boolean {
  return Math.abs(nowMs - tsMs) <= CLIENT_SIGN_MAX_SKEW_MS
}

/** 定长十六进制串比较(长度不等直接 false;长度相等时逐位异或累加,不提前退出) */
function hexEqualConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * 完整验签(服务端唯一用法)。返回结构化结论,理由可落日志;调用方据 `signed` 决定
 * 是否把该请求视为"自家原生客户端"。
 */
export function verifyClientSignature(
  raw: unknown,
  secret: string,
  nowMs: number = Date.now(),
): { signed: boolean; reason: 'ok' | 'secret-not-configured' | 'missing' | 'malformed' | 'stale' | 'mismatch' } {
  if (!secret) return { signed: false, reason: 'secret-not-configured' }
  const parsed = parseClientSignature(raw)
  if (!parsed) return { signed: false, reason: typeof raw === 'string' && raw ? 'malformed' : 'missing' }
  if (!isClientSignatureFresh(parsed.tsMs, nowMs)) return { signed: false, reason: 'stale' }
  const expect = computeClientSignature(secret, parsed.appId, parsed.tsMs)
  if (!hexEqualConstantTime(expect, parsed.sig)) return { signed: false, reason: 'mismatch' }
  return { signed: true, reason: 'ok' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
