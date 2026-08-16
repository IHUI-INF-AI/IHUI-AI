/**
 * 下载量统计跨端契约(2026-08-06 立)
 *
 * 对接后端 POST /api/downloads/track(允许匿名调用)+ GET /api/downloads/stats(管理员)。
 * DownloadPlatform 与 apps/web/src/config/downloads.config.ts 同源,
 * 此处为共享层唯一定义,后续主 agent 统一让各端从 @ihui/types import。
 */

/** 项目所有支持的下载端(8 端),与 apps/* 目录一一对应 */
export type DownloadPlatform =
  'web' | 'desktop' | 'ios' | 'android-apk' | 'mobile' | 'wechat-miniapp' | 'extension' | 'cli'

/** 下载事件触发来源 */
export type DownloadSource = 'sidebar' | 'detail_page'

/** 下载事件上报入参(POST /api/downloads/track body) */
export interface DownloadEventInput {
  platform: DownloadPlatform
  assetHref?: string
  source: DownloadSource
}

/** 下载事件上报响应(POST /api/downloads/track data) */
export interface DownloadEventResponse {
  eventId: string
}

/** 下载量统计(GET /api/downloads/stats data,需管理员登录) */
export interface DownloadStats {
  total: number
  byPlatform: Record<string, number>
  byDate: Array<{ date: string; count: number }>
}
