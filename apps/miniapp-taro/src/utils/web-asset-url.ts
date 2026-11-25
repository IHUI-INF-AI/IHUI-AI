// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后端静态素材路径 → 小程序可渲染 URL。
 *
 * 与 `apps/mobile-rn/src/lib/web-asset-url.ts` 同源语义：后端 `agents.avatar` 等字段常返回
 * 站内相对路径（如 `/agents/coze/x.webp`）。在小程序 `<Image src>` 里相对路径会按小程序
 * 自身域名解析 ⇒ 404 静默白块，必须拼到 Web 站点底座（静态资源由站点根直出）。
 *
 * 其它同族约定：绝对 URL / data: / 已带 scheme 的原样透传；空白视为"无图"返回 undefined，
 * 调用方按无图兜底。路径拼接复用共享 `joinUrl`，端内不另写规则。
 */
import { joinUrl } from '@ihui/shared/utils/image-helpers'
import { WEB_BASE_URL } from '@/constants/web-portal'
import { resolveAvatarUrlCore } from './avatar-url-core'

export function resolveWebAssetUrl(path?: string | null): string | undefined {
  const raw = path?.trim()
  if (!raw) return undefined
  return joinUrl(WEB_BASE_URL, raw)
}

/** 智能体头像本地占位图(分包静态资源;空 avatar 兜底,不拼站点底座) */
export const DEFAULT_AGENT_AVATAR = '/pkg-ai/assets/default-agent.png'

/**
 * 智能体头像 URL 解析:三态判定委托 `avatar-url-core`,站点底座补全复用 `resolveWebAssetUrl`。
 * - 空值/非字符串 → 本地占位图(可传 fallback 覆盖)
 * - 绝对 URL / data: / 本地临时文件 / 本端静态路径 → 原样透传
 * - 其余相对路径 → `resolveWebAssetUrl` 拼站点底座;补全落空 → 本地占位图兜底。
 * 站点底座复用既有 `WEB_BASE_URL`(与 RN `lib/web-asset-url.ts` 同源),端内不另写 base。
 */
export function resolveAvatarUrl(avatar: unknown, fallback: string = DEFAULT_AGENT_AVATAR): string {
  return resolveAvatarUrlCore(avatar, {
    fallback,
    resolveAsset: (v) => resolveWebAssetUrl(v),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
