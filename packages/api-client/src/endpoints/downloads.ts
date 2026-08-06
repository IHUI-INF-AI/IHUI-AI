import type { DownloadEventInput, DownloadEventResponse } from '@ihui/types'

import { fetchApi } from '../client'

/**
 * 下载量统计端点(2026-08-06 立,跨端共享下载点击上报)
 *
 * 后端契约:
 * - POST /api/downloads/track:允许匿名调用(无需登录 token),返回 { eventId }
 * - GET /api/downloads/stats:需管理员登录(本端点暂不封装,留后续)
 *
 * track 失败时静默返回 { eventId: '' },不阻断下载流程(用户无感知)。
 */
export const downloadEndpoints = {
  /** 上报下载点击事件 — POST /api/downloads/track(匿名可用,失败静默) */
  track: async (input: DownloadEventInput): Promise<DownloadEventResponse> => {
    try {
      const res = await fetchApi<DownloadEventResponse>('/api/downloads/track', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (res.success && res.data) {
        return res.data
      }
      return { eventId: '' }
    } catch {
      return { eventId: '' }
    }
  },
}
