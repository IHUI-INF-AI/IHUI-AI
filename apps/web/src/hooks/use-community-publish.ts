'use client'

import * as React from 'react'
import { getCircles, createCirclePost, type Circle } from '@ihui/api-client'

/**
 * 社区发布 hook(2026-08-02 立,对齐原项目 AIChat.vue publishToCommunity)
 *
 * 功能:
 * 1. fetchCircles:拉取用户已加入的圈子列表(供 CommunityPublishDialog 选择)
 * 2. publish:把 AI 回复发布到指定圈子(调 createCirclePost API)
 *
 * 后端契约:POST /circles/:circleId/posts(见 apps/api/src/routes/community/posts.ts)
 * 前端 api-client:createCirclePost(circleId, { title, content, images? })
 */
export function useCommunityPublish() {
  const [circles, setCircles] = React.useState<Circle[]>([])
  const [loadingCircles, setLoadingCircles] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)

  const fetchCircles = React.useCallback(async () => {
    setLoadingCircles(true)
    try {
      const res = await getCircles({ page: 1, pageSize: 100 })
      if (res.success && res.data) {
        // 只展示用户已加入的圈子(isJoined=true)
        setCircles(res.data.list.filter((c) => c.isJoined))
      }
    } catch {
      // 静默失败,Dialog 会显示"暂无圈子"空态
    } finally {
      setLoadingCircles(false)
    }
  }, [])

  const publish = React.useCallback(
    async (
      circleId: string,
      title: string,
      content: string,
      images: string[],
    ): Promise<boolean> => {
      setPublishing(true)
      try {
        const res = await createCirclePost(circleId, { title, content, images })
        return res.success
      } catch {
        return false
      } finally {
        setPublishing(false)
      }
    },
    [],
  )

  return { circles, loadingCircles, publishing, fetchCircles, publish }
}
