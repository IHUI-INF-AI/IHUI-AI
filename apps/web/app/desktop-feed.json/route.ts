// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端更新器 feed(2026-09-17 终极方案;2026-09-24 覆盖四平台)。
 *
 * 背景:更新 feed 此前放在 Gitee 分支——被仓库「单分支守门」规则删除三次;
 * 改放 Gitee release 附件——同名附件下载直链恒取旧文件;而"附件无法删除"这句已被实测推翻
 * (2026-09-24:GET /repos/{o}/{r}/releases/{id}/attach_files 会返回每个附件的 id,
 *  DELETE /repos/{o}/{r}/releases/{id}/attach_files/{file_id} 返回 204 即真删)。
 * 最终方案:**本站点作为 feed 真源**(与官网下载页共用 desktop-feed.generated.ts 快照,
 * 由 scripts/resolve-desktop-download.mjs 在发版时自动刷新)。
 *
 * 端点:https://aizhs.top/desktop-feed.json
 * Tauri 更新器配置见 apps/desktop/src-tauri/tauri.conf.json plugins.updater.endpoints 第一项。
 *
 * 2026-10-17 起:本端点改为**运行期自动取最新**,不再经过「生成快照 → CI push 回 main」
 * 那一环。动因是两条实测事故:
 *  ① **版本号陈旧**:那条 push 链恒被 main 的 required status check 拒绝 —— GitHub 规定
 *     用 GITHUB_TOKEN 推送产生的 commit 不触发新 workflow run,于是 check 永远缺席,
 *     sync-downloads.yml 自 10-11 起连日 GH006 failure,线上下载页与更新器长期停在
 *     0.1.54(仓库当时已发到 desktop-v0.1.58)。修 push 语句治不好这一格,只能绕开"入库"。
 *  ② **Windows 更新链接死链**:生成侧把 windows-x86_64 的 URL 强行改写为 Gitee 直链,
 *     而 Gitee 仓 /releases 实测返回 `[]`(从未托管这些资产)⇒ 该 URL 实测 404,
 *     用户点了更新也下不到包。(该 host 改写是 2026-10-16 引入的。)
 * ⇒ 现在以 **release 自带 `latest.json`** 为源(tauri-action 发版时产出,version/notes/
 *   pub_date/四平台 URL+签名全在里面,签名与包体天然配对),**不再改写 host**;
 *   发布源取不到时降级入库快照 —— 宁给已知版本,也不输出破损 feed。
 *
 * 2026-10-18 补强(实测才定下):运行期取 `latest.json` 在生产机(国内)必失败 ——
 *   `api.github.com` 可达,但 GitHub **资产下载 CDN 域名**直连超时(本机实测 ETIMEDOUT,
 *   API 资产端点 302 仍跳该 CDN)。于是取源恒失败、恒降级到冻结在 0.1.54 的快照,
 *   新版本永远推不到用户。补强方案:**发版时把 CI 生成的 `latest.json` 1:1 烘焙进仓库**
 *   (apps/web/src/config/desktop-latest.generated.ts),本路由**本地直读即返回**,彻底绕开
 *   运行时外部依赖;运行期解析仅作兜底(在可达 GitHub 的环境仍可用)。烘焙文件内 Windows 主包
 *   已直写 Gitee 镜像直链(字节与 GitHub 原件对账一致、国内可达),其余平台维持 GitHub 原生产物,
 *   与 desktop-feed-live.ts 的 preferGiteeWindows 判据一致。烘焙步骤见发布清单。
 */
import { DESKTOP_LATEST } from '@/config/desktop-latest.generated'
import { buildDesktopFeedPayload } from '@/config/desktop-feed-payload'
import { resolveDesktopFeedForUpdater } from '@/config/desktop-feed-live'
import type { DesktopFeedPayload } from '@/config/desktop-feed-payload'

// ISR 10 分钟:新发版能较快推给客户端,又远低于 GitHub 公开 API 的 60 req/h 限流。
export const revalidate = 600

/** 防御性判据:烘焙文件被改坏时,不要吐破损 feed,而是走下方运行期兜底。 */
function isValidPayload(p: unknown): p is DesktopFeedPayload {
  return (
    !!p &&
    typeof (p as DesktopFeedPayload).version === 'string' &&
    !!(p as DesktopFeedPayload).platforms &&
    typeof (p as DesktopFeedPayload).platforms === 'object'
  )
}

export async function GET() {
  // 优先:部署时烘焙进仓库的发布源快照 —— 生产机本地直读,零运行时外部依赖。
  if (isValidPayload(DESKTOP_LATEST)) {
    return Response.json(DESKTOP_LATEST, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        // 该 feed 是否已经反映到最新 release(肉眼可见的陈旧度)。
        // 旧形态把"线上最新"与"降级快照"渲染成同一个版本号 ⇒ 自动化静默死掉完全不可观测。
        'X-Desktop-Feed-Version': DESKTOP_LATEST.version,
      },
    })
  }

  // 兜底:运行期解析(在可达 GitHub 的环境有效;国内生产机取源超时 → 进一步降级到入库快照)。
  const feed = await resolveDesktopFeedForUpdater()
  const payload = buildDesktopFeedPayload(feed)
  if (!payload) {
    return Response.json({ error: 'no windows asset in snapshot' }, { status: 404 })
  }
  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Desktop-Feed-Version': feed.version,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
