// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端 v2 feed 的发布侧结构判据。
 *
 * 放在 config 而不是 route，原因有两个：
 * 1. Next 的 route.ts 只允许导出路由处理器与段配置，额外导出会被构建期类型检查拒绝；
 * 2. 判据要能被单测直接引用，不必启动整个路由模块。
 */

export interface DesktopFeedV2 {
  schema: 2
  version: string
  channel: string
  rollout: { percent: number }
  minSupported: string | null
  revoked: string[]
  rollbackTo: string | null
  notes: string
  payload: {
    url: string
    size: number
    sha256: string
    signature: string
    format: 'zip'
    platform: string
    minLauncher: string
  }
}

/** 版本号必须至少含一个数字：`latest` 这类纯字母能过旧字符集，但客户端会拿它做版本比较。 */
const VERSION_RE = /^(?=.*\d)[0-9A-Za-z.-]{1,64}$/

/** 必须与客户端 update_v2.rs 的上限一致：超过 300MB 客户端直接拒收，发布侧不能放行。 */
const MAX_PAYLOAD_BYTES = 300 * 1024 * 1024

function isHttpsUrl(raw: string): boolean {
  // URL 构造器会把 `https:///a.zip` 规范成 host=a.zip 的合法地址，
  // 发布侧必须按原始串先拒绝“三斜杠”这种明显写错的资产地址。
  if (!/^https:\/\/[^/?#]/i.test(raw)) return false
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname !== '' &&
      url.hash === ''
    )
  } catch {
    return false
  }
}

/**
 * v2 是客户端直接拿去下载+验签+切版本的结构，不能像 legacy 那样只判 version。
 * 字段缺一个，客户端要么下载 404 资产，要么 minisign 解码失败，最后只在
 * 客户端 console.warn —— 发布侧必须在这里先红。
 */
export function isValidDesktopFeedV2(value: unknown): value is DesktopFeedV2 {
  if (!value || typeof value !== 'object') return false
  const feed = value as Record<string, unknown>
  const payload = feed.payload as Record<string, unknown> | undefined
  if (feed.schema !== 2) return false
  if (typeof feed.version !== 'string' || !VERSION_RE.test(feed.version)) return false
  if (typeof feed.channel !== 'string' || feed.channel === '') return false
  if (typeof feed.notes !== 'string') return false
  if (
    feed.minSupported !== null &&
    (typeof feed.minSupported !== 'string' || !VERSION_RE.test(feed.minSupported))
  )
    return false
  if (
    feed.rollbackTo !== null &&
    (typeof feed.rollbackTo !== 'string' || !VERSION_RE.test(feed.rollbackTo))
  )
    return false
  if (
    !Array.isArray(feed.revoked) ||
    !feed.revoked.every((v) => typeof v === 'string' && VERSION_RE.test(v))
  )
    return false
  const rollout = feed.rollout as Record<string, unknown> | undefined
  if (
    !rollout ||
    typeof rollout.percent !== 'number' ||
    !Number.isInteger(rollout.percent) ||
    rollout.percent < 1 ||
    rollout.percent > 100
  ) {
    return false
  }
  if (!payload) return false
  if (typeof payload.url !== 'string' || !isHttpsUrl(payload.url)) return false
  if (
    typeof payload.size !== 'number' ||
    !Number.isSafeInteger(payload.size) ||
    payload.size <= 0 ||
    payload.size > MAX_PAYLOAD_BYTES
  ) {
    return false
  }
  if (typeof payload.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(payload.sha256)) return false
  if (typeof payload.signature !== 'string' || payload.signature.trim() === '') return false
  if (payload.format !== 'zip') return false
  if (typeof payload.platform !== 'string' || payload.platform === '') return false
  if (typeof payload.minLauncher !== 'string' || !VERSION_RE.test(payload.minLauncher)) return false
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
