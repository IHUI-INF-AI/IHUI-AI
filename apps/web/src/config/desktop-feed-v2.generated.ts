// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AUTO-GENERATED — 由 scripts/desktop-feed-v2.mjs 的格式生成（2026-11-27 手工烘焙 0.1.96）。
// 发版步骤见 docs/desktop-update-v2.md。
// 注意：0.1.96 客户端 update_v2 仍钉旧信任锚 08db，因此这一版 zip 用 08db 签名做引导；
// 0.1.97 的 zip 仍必须用 08db 签（0.1.96 只认旧锚）；0.1.97 装好（双锚）后，0.1.98 起 zip 才切 A40E。

export interface DesktopFeedV2Payload {
  schema: 2
  version: string
  channel?: string
  rollout?: { percent: number; salt?: string }
  minSupported?: string | null
  revoked?: string[]
  rollbackTo?: string | null
  notes?: string | null
  payload: {
    url: string
    size: number
    sha256: string
    signature: string
    format: string
    platform?: string
    minLauncher?: string
  }
}

export const DESKTOP_FEED_V2: DesktopFeedV2Payload = {
  "schema": 2,
  "version": "0.1.96",
  "channel": "stable",
  "rollout": {
    "percent": 100
  },
  "minSupported": null,
  "revoked": [],
  "rollbackTo": null,
  "notes": "桌面桥 ACL 修复：补齐 get_native_bridge_manifest 等 6 条桥命令授权，修复首屏「桌面桥版本不匹配 / 桌面入口已禁用」红条。后台暂存，点重启生效。",
  "payload": {
    "url": "https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.96/ihui-0.1.96-windows-x86_64.zip",
    "size": 6350308,
    "sha256": "0e06638763c842d90775fecb43c1afc170d5c556dc6cd127f00729471a274e14",
    "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFN3VXFvS3dzWk0wVjYxOHBhUnJMdEx2cVRWZG9XZHQ3bUNkRUU2ZVpkczlzaWYzc2g2V09vTDJCZHZZMWhaeVJYeWZIaUxiaVQ3UU9HNFo2Y2FxQUF3PQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzk1NzQzNDEyCWZpbGU6aWh1aS0wLjEuOTYtd2luZG93cy14ODZfNjQuemlwCnBhYmVCUTFGdEpxOFI1WFR5RG1KNFRET3RYQlpDR0lNTTYzUWZHaEdxOTUvNEUybW9scEpEOXFwSS83MTEzS1dlVlI0YmI2QU5kNzA1RGFnR0ZWZERRPT0K",
    "format": "zip",
    "platform": "windows-x86_64",
    "minLauncher": "0.1.0"
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
