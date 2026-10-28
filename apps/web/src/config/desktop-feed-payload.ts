// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端 updater feed payload 的唯一拼装器。
 *
 * `/desktop-feed.json` 与 `/api/desktop-feed` 两条 App Route 必须共用此函数
 * (历史上两文件是逐字节复制品,改一处漏一处即是第二份真相的起点)。
 *
 * 数据流:scripts/generate-latest-json.mjs 与 scripts/resolve-desktop-download.mjs
 * 共用 scripts/lib/tauri-updater-platforms.mjs 产出四平台映射 → 持久化进
 * desktop-feed.generated.ts 的 `updaterPlatforms` 字段 → 此处直接输出。
 * platform 键的取舍(空签名不出现、dmg 不当 darwin、host 白名单)全部在生成侧
 * 判定,本函数不再自己按 /Windows/i 挑资产。
 */
import type { DesktopFeed, DesktopFeedUpdaterEntry } from './desktop-feed.generated'

export interface DesktopFeedPayload {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, DesktopFeedUpdaterEntry>
}

/**
 * 读取快照资产的更新签名。历史快照在 release 未附 .sig 时整个字段缺失
 * (而非空串),按可选字段读取并恒定降级为空串,使任何版本形态的快照都能
 * 编译与运行。
 */
function readSignature(asset: { signature?: string } | undefined): string {
  return asset?.signature ?? ''
}

/** 快照缺 updaterPlatforms 时的旧行为兜底:仅派生 windows-x86_64 单键。 */
function legacyWindowsPlatforms(feed: DesktopFeed): Record<string, DesktopFeedUpdaterEntry> | null {
  const winAsset = feed.assets.find((a) => /Windows/i.test(a.format))
  if (!winAsset) return null
  return {
    'windows-x86_64': {
      signature: readSignature(winAsset),
      url: winAsset.href,
    },
  }
}

/**
 * 构建 Tauri updater feed payload。返回 null 表示快照无任何可输出平台
 * (route 侧据此保持历史 404 形态)。
 */
export function buildDesktopFeedPayload(feed: DesktopFeed): DesktopFeedPayload | null {
  const generated = feed.updaterPlatforms
  const platforms =
    generated && Object.keys(generated).length > 0 ? generated : legacyWindowsPlatforms(feed)
  if (!platforms) return null
  return {
    version: feed.version,
    notes: `智汇AI 桌面端 ${feed.version}:极速薄壳(3MB)、首启不白屏、线上部署自动热刷新、断网兜底、自动更新。`,
    pub_date: new Date(`${feed.releaseDate}T00:00:00Z`).toISOString(),
    platforms,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
