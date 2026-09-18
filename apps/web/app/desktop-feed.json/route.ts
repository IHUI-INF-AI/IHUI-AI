// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端更新器 feed(2026-09-17 终极方案)。
 *
 * 背景:更新 feed 此前放在 Gitee 分支——被仓库「单分支守门」规则删除三次;
 * 改放 Gitee release 附件——同名附件下载直链恒取旧文件且无 id 可删。
 * 最终方案:**本站点作为 feed 真源**(与官网下载页共用 desktop-feed.generated.ts 快照,
 * 由 scripts/resolve-desktop-download.mjs 在发版时自动刷新)。
 *
 * 端点:https://aizhs.top/desktop-feed.json
 * Tauri 更新器配置见 apps/desktop/src-tauri/tauri.conf.json plugins.updater.endpoints 第一项。
 */
import { DESKTOP_FEED } from '@/config/desktop-feed.generated'

export const dynamic = 'force-static'

/**
 * 读取快照资产的更新签名(2026-09-18)。
 * 快照由 scripts/resolve-desktop-download.mjs 自动生成;历史版本在 release 未附 .sig
 * 资产时**整个字段缺失**(而非空串),直接访问 `.signature` 会 typecheck 报 TS2339。
 * 此处按可选字段读取并恒定降级为空串,使任何版本形态的快照都能编译与运行。
 */
function readSignature(asset: { signature?: string } | undefined): string {
  return asset?.signature ?? ''
}

export function GET() {
  const winAsset = DESKTOP_FEED.assets.find((a) => /Windows/i.test(a.format))
  if (!winAsset) {
    return Response.json({ error: 'no windows asset in snapshot' }, { status: 404 })
  }
  const payload = {
    version: DESKTOP_FEED.version,
    notes: `智汇AI 桌面端 ${DESKTOP_FEED.version}:极速薄壳(3MB)、首启不白屏、线上部署自动热刷新、断网兜底、自动更新。`,
    pub_date: new Date(`${DESKTOP_FEED.releaseDate}T00:00:00Z`).toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: readSignature(winAsset),
        url: winAsset.href,
      },
    },
  }
  return Response.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
