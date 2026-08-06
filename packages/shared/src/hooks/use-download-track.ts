import { useCallback } from 'react'
import { downloadEndpoints } from '@ihui/api-client'
import type { DownloadPlatform, DownloadSource } from '@ihui/types'

/**
 * useDownloadTrack — 跨端下载点击统计 Hook
 *
 * 调用后端 POST /api/downloads/track 上报下载点击事件(允许匿名调用,未登录也会返回 200)。
 * 异步调用,不阻断 UI(不 await),失败静默(不抛错,用户无感知)。
 *
 * 用法:
 * ```ts
 * const trackDownload = useDownloadTrack()
 * // 侧边栏点击
 * trackDownload('desktop', 'sidebar')
 * // 详情页下载按钮点击(附带资源 URL)
 * trackDownload('desktop', 'detail_page', 'https://cdn.example.com/app.exe')
 * ```
 */
export function useDownloadTrack(): (
  platform: DownloadPlatform,
  source: DownloadSource,
  assetHref?: string,
) => void {
  return useCallback(
    (platform: DownloadPlatform, source: DownloadSource, assetHref?: string) => {
      void downloadEndpoints.track({ platform, source, assetHref })
    },
    [],
  )
}
