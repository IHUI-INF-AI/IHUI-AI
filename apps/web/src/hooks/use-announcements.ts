// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Announcement } from '@/lib/content'

/**
 * 公告 Marquee 动态化(2026-10-24)。
 *
 * 根因:营销首页 Hero 的公告跑马灯此前吃 i18n 静态文案(marketing.marquee.items),
 * 后台 /admin/announcements 发了公告首页也不会动 —— "公告没有自动更新"的成因。
 * 本 hook 把 Marquee 接到公开端点 GET /api/announcements(后端已按
 * is_published + expires_at 过滤、置顶在前、published_at 倒序),管理员在后台
 * 发布/下架公告,首页跑马灯自动跟随。
 *
 * 按端定向(李总 2026-10-24 定案):全端统一这一个接口,web 端传 ?platform=web,
 * 后端只返回"全端通用或含 web"的公告;管理员可按端独立设定投放范围。
 *
 * - 拉取失败 / 列表为空 => 返回 null,调用方 fallback 到 i18n 静态兜底文案
 * - refetchInterval 5min:公告"自动更新"不依赖用户操作
 * - 登录用户由后端自动附带 isRead 标记(本 hook 不使用,只取标题)
 */

/** 跑马灯最多展示的公告条数(与 Marquee 视觉密度匹配) */
const MARQUEE_LIMIT = 8

/** 拉取间隔:公告自动更新的节流(公开端点,成本可忽略) */
const REFETCH_INTERVAL_MS = 5 * 60 * 1000

/** web 端公告查询(按端定向,2026-10-24) */
const WEB_ANNOUNCEMENTS_URL = '/api/announcements?platform=web'

export function useAnnouncementMarqueeItems(): { id: string; text: string }[] | null {
  const { data } = useQuery<Announcement[]>({
    queryKey: ['announcements', 'marquee'],
    queryFn: async () => {
      const d = await api<{ list: Announcement[] }>(WEB_ANNOUNCEMENTS_URL)
      return d.list ?? []
    },
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  return React.useMemo(() => {
    if (!data || data.length === 0) return null
    // 防御性排序:后端已置顶+时间倒序,前端再排一次防数据源变化
    const sorted = [...data].sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
    return sorted.slice(0, MARQUEE_LIMIT).map((a) => ({ id: a.id, text: a.title }))
  }, [data])
}

/** 最新一条公告标题(工作区首页 AnnouncementBar 用);无则 null 走 i18n 兜底 */
export function useLatestAnnouncementTitle(): string | null {
  const { data } = useQuery<Announcement[]>({
    queryKey: ['announcements', 'latest'],
    queryFn: async () => {
      const d = await api<{ list: Announcement[] }>(WEB_ANNOUNCEMENTS_URL)
      return d.list ?? []
    },
    staleTime: REFETCH_INTERVAL_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  return data && data.length > 0 ? (data[0]?.title ?? null) : null
}
