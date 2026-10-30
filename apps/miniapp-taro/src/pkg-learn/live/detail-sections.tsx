// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 直播详情页附加区块 —— 对齐 RN 共享屏
// packages/app/src/features/live-detail/LiveDetailScreen.tsx 的 introSection。
// 拆到同目录子模块只为守住「单页 < 250 行」;门会读同目录 `./` 模块里的文案键。
//
// 互动区(chatSection / LiveChat)已整块下线(假绿清偿@2026-10-31,取证):
//   GET/POST `/live/:id/messages` 确已注册(mobile-chat-routes.ts:224/:240,挂在
//   routes/index.ts:1121 的 `/api` 前缀下,方法/字段 id·nickname·content·createdAt 全对上),
//   但其 :id 走 `Number.parseInt(id, 10)` 并要求有限数 —— 而 live_channels.id 是 **uuid**
//   (packages/database/src/schema/live.ts:58;本频道详情面 live.ts:453 亦强制 z.uuid()),
//   live_comment.channel_id 又是 integer(live-extended.ts:48)。uuid 过 parseInt 恒 NaN ⇒
//   本页任何可达频道的聊天历史恒拉不到、发送恒发不出(聊天块整块 = 假功能)⇒ 按纪律撤,
//   不用假数据顶绿。后端把 channel_id 与频道 id 同型(uuid)或提供 uuid 兼容端点后,
//   可按本文件 git 历史原样接回(键 liveDetail.chat / chatEmpty / chatPlaceholder / chatSend)。

import { View, Text, Input } from '@tarojs/components'
import { useI18n } from '@/i18n'
import type { Live } from '@/api'
import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// 详情数据腿投影(供 detail.tsx 使用;拆到本模块同为「单页 < 250 行」)
//
// 数据腿 = `GET /live/channels/:id`(apps/api/src/routes/live.ts:238,公开在册端点,
// 返回整行 LiveChannel)。不用 `GET /live/:id`(同文件 :453):那条投影只回
// id/title/status/anchor/playUrl/watchCount 六字段,没有 intro/startTime/coverImage
// ⇒ 介绍区恒 '—'、分享封面恒兜底、预约时间恒不显示(键在正文、数据恒缺 = 假绿)。
// ---------------------------------------------------------------------------

export interface LiveChannelRow {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  lecturerName: string | null
  playUrl: string | null
  startTime: string | null
  isLive: boolean
  viewCount: number
}

export type LiveDetail = Live & { intro?: string | null }

/**
 * 状态按整行真值现判:isLive → living;开播时间未到 → upcoming;其余 → ended。
 * 后端 `deriveLiveStatus(live.ts:196)` 只认 isLive/isPublished 两列,公开详情面又
 * 只服务已发布频道 ⇒ 「已发布未开播」恒被读成 ended,预约链路(POST /live/:id/subscribe
 * 在册可用)会因此结构性死亡 ⇒ 这里按 startTime 现判,不改任何在册判据。
 */
function deriveStatus(c: LiveChannelRow): Live['status'] {
  if (c.isLive) return 'living'
  if (c.startTime && new Date(c.startTime).getTime() > Date.now()) return 'upcoming'
  return 'ended'
}

export function projectChannel(c: LiveChannelRow): LiveDetail {
  return {
    id: c.id,
    title: c.title,
    coverUrl: c.coverImage ?? '',
    status: deriveStatus(c),
    startTime: c.startTime ?? undefined,
    anchor: c.lecturerName ?? undefined,
    playUrl: c.playUrl ?? undefined,
    watchCount: c.viewCount,
    intro: c.intro,
  }
}

/** 直播介绍区(对齐 RN introSection:标题 + 正文,空正文落 '—';数据腿见上注) */
export function LiveIntro({ intro }: { intro?: string | null }) {
  const { t } = useI18n()
  return (
    <View className="px-[20rpx] pb-[16rpx]">
      <Text className="block text-[length:30rpx] font-semibold text-foreground mb-[16rpx]">
        {t('liveDetail.intro')}
      </Text>
      <Text className="block text-[length:28rpx] text-[var(--color-text-medium)]">
        {intro || '—'}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
