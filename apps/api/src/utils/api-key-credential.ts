// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 凭据解析（2026-10-23 立）。
 *
 * 为什么需要这个模块：
 * 平台的 API Key 是**双因子**——`ihui_<24hex>` 是公开标识（库里按它定位行），
 * `sk_<32hex>` 是 secret（库里只存哈希，**无法反查行**）。文档口径是
 * `Authorization: Bearer ihui_xxx` + `X-Api-Secret: sk_xxx` 两处都要填。
 *
 * 但现实是：绝大多数 OpenAI 兼容客户端只有一个 "API Key" 输入框，没有地方填
 * 第二个头。用户把后台拿到的那串 `sk_…` 直接塞进 Bearer 必然失败（secret 是哈希，
 * 查不到行），于是整条链路在自己家门口 403，看起来像"key 无效"。
 *
 * 解法是给单凭据一个**组合形态**：`<ihui_key>.<sk_secret>`，一个字符串同时承载
 * 两因子，粘进任何客户端的 Key 框即可用。
 *
 * 边界（重要）：本模块**只负责"拆"，绝不负责"信"**。
 * 解析是纯字符串操作、零 IO；真伪仍由调用方查库定位行 + 哈希比对 secret 判定。
 * 拆出来的 secret 为空/缺失时，双因子要求照旧由 `API_KEY_REQUIRE_SECRET` 决定，
 * 这里不做任何放松。
 */

/** 公开标识前缀（与 utils/api-key-presence.ts 的 API_KEY_PUBLIC_PREFIX 同值） */
const API_KEY_PREFIX = 'ihui_'

/** 组合形态的分隔符：`ihui_xxx.sk_yyy`（点号不会出现在两段自身的字符集里） */
const CREDENTIAL_SEPARATOR = '.'

export interface ParsedApiCredential {
  /**
   * 用于按行定位的公开标识。
   * 非 `ihui_` 形态的输入（如人用 JWT）原样返回，由调用方查库自然查不到 ——
   * 与旧行为一致，不在解析层制造新的拒绝分支。
   */
  key: string | null
  /** 内联 secret（`sk_…`）；未以内联形态提供时为 null */
  secret: string | null
  /** 输入是否**看似** API 凭据（`ihui_` 前缀）。仅作廉价前置筛，绝不作放行依据 */
  looksLikeApiKey: boolean
}

/**
 * 解析单凭据字符串。
 *
 * 支持的形态：
 * - `ihui_<24hex>`                    → { key, secret: null }（需另配 X-Api-Secret）
 * - `ihui_<24hex>.<sk_secret>`        → { key, secret }（单凭据即可用）
 * - 其它（JWT / 乱码 / 空）           → { key: 原串或 null, secret: null }
 */
export function parseApiCredential(raw: string | null | undefined): ParsedApiCredential {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { key: null, secret: null, looksLikeApiKey: false }
  if (!text.startsWith(API_KEY_PREFIX)) {
    return { key: text, secret: null, looksLikeApiKey: false }
  }
  const idx = text.indexOf(CREDENTIAL_SEPARATOR)
  if (idx < 0) return { key: text, secret: null, looksLikeApiKey: true }
  const key = text.slice(0, idx).trim()
  const secret = text.slice(idx + 1).trim()
  return {
    key: key.length > 0 ? key : null,
    secret: secret.length > 0 ? secret : null,
    looksLikeApiKey: true,
  }
}

/**
 * 组装单凭据组合形态（展示/下发用）。
 * 没有 secret 时退化为纯公开标识（此时客户端仍需另配 X-Api-Secret）。
 */
export function composeApiCredential(key: string, secret?: string | null): string {
  const k = key.trim()
  const s = typeof secret === 'string' ? secret.trim() : ''
  return s ? `${k}${CREDENTIAL_SEPARATOR}${s}` : k
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
