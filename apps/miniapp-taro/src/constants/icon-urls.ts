/**
 * 原项目 zhs_app-ZZ 远程图库 URL 集中管理(2026-07-30 立)
 *
 * 来源:
 *   - https://file.aizhs.top/sys-mini/* (376 处引用,自建图库)
 *   - https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/* (213 处引用,uniCloud CDN)
 *
 * 本地副本:apps/miniapp-taro/src/assets/remote/(431 文件,41 MB)
 *   - 已复制原项目 src/static/ 全部图标(排除 fonts/)
 *   - 94 个唯一 URL 已匹配本地副本,118 个唯一 URL 本地无副本
 *
 * 使用方式:
 *   - 本地有副本:import xxxIcon from '@/assets/remote/<path>'
 *   - 本地无副本:直接用远程 URL(与原项目一致,微信小程序运行时可访问)
 *   - 待下载清单见 .trae-cn/tmp/REMOTE_ICONS_TODO.md(186 个 URL)
 */

/** bspapp CDN base URL(uniCloud) */
export const BSPAPP_BASE = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com' as const

/** aizhs 自建图库 base URL */
export const AIZHS_BASE = 'https://file.aizhs.top' as const

/** 拼接 bspapp URL */
export function bspappUrl(path: string): string {
  return `${BSPAPP_BASE}/${path.replace(/^\//, '')}`
}

/** 拼接 aizhs URL */
export function aizhsUrl(path: string): string {
  return `${AIZHS_BASE}/${path.replace(/^\//, '')}`
}
