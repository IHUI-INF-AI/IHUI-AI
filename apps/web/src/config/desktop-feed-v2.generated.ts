// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端 v2 feed 的编译期快照。
 *
 * 默认 null：/desktop-feed.json 继续输出 legacy 安装器 feed（迁移期不把老客户端打挂）。
 * 发版时运行 scripts/desktop-feed-v2.mjs --ts-out 本文件，写入 schema=2 的 zip feed；
 * 之后 route 优先返回 v2，客户端走“后台暂存 + 常驻胶囊”链。
 */
export const DESKTOP_FEED_V2: Record<string, unknown> | null = {
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
