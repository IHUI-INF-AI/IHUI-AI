// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Image } from '@tarojs/components'

export interface ConversationHistoryItemProps {
  /** 行 id:服务端来源=chat_conversations 主键(UUID),本机快照来源=hist_* (不可置顶) */
  id: string
  title: string
  /**
   * 摘要行文本。服务端会话列表接口**不返回消息体**,故服务端来源行为 undefined ——
   * 此时整行不渲染,不得用占位文案冒充"这条对话的内容"。
   */
  preview?: string
  /** 已格式化的时间串(由调用方给,组件不碰时区/格式化口径) */
  time: string
  /** 已代入条数的消息计数文案(同上:i18n 取词留在调用方,组件可独立测) */
  countLabel: string
  iconSrc: string
  /**
   * 是否给置顶入口。只有数据来自服务端会话列表时才为 true ——
   * 本机历史快照的 id 不是会话主键,PATCH /api/chat/conversations/:id 必然失败,
   * 给它一个点了只会报错的入口比不给更糟(判序 fail-closed)。
   */
  canPin: boolean
  pinned: boolean
  /** 三个文案同样由调用方取词后传入,组件不依赖 i18n */
  pinLabel: string
  pinnedLabel: string
  onOpen: () => void
  onTogglePin: () => void
  /** 长按删除等行级动作;本机快照来源才传 */
  onLongPress?: () => void
}

/**
 * 会话历史行(D20 会话列表补齐票立)。
 *
 * 为什么单独成件:列表页在 AGENTS §4 有「每页 < 250 行」的约束,
 * 而本行要同时服务两个数据源(服务端会话 / 本机快照)与置顶态,继续内联只会把页面撑肥。
 *
 * 结构约定:可点的正文块与置顶动作是**兄弟**而非父子 —— 小程序 tap 会向上冒泡,
 * 嵌进去就会出现"点置顶等于打开会话"的双触发。
 */
export default function ConversationHistoryItem({
  id,
  title,
  preview,
  time,
  countLabel,
  iconSrc,
  canPin,
  pinned,
  pinLabel,
  pinnedLabel,
  onOpen,
  onTogglePin,
  onLongPress,
}: ConversationHistoryItemProps) {
  return (
    <>
      <View
        className="flex flex-1 min-w-0 items-start"
        onClick={onOpen}
        onLongPress={onLongPress}
        hoverClass="opacity-60"
      >
        <View className="w-[64rpx] h-[64rpx] flex items-center justify-center bg-background rounded-md flex-shrink-0 mr-[20rpx]">
          <Image src={iconSrc} className="w-[40rpx] h-[40rpx]" mode="aspectFit" />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex items-center justify-between gap-[16rpx]">
            <Text
              key={`t-${id}`}
              className="text-[length:30rpx] text-foreground font-semibold flex-1 truncate"
            >
              {title}
            </Text>
            <Text className="text-[length:22rpx] text-muted-foreground flex-shrink-0">{time}</Text>
          </View>
          {preview ? (
            <Text className="block text-[length:26rpx] text-muted-foreground mt-[8rpx] leading-[1.4] truncate">
              {preview}
            </Text>
          ) : null}
          <Text className="block text-[length:22rpx] text-muted-foreground mt-[12rpx]">
            {countLabel}
          </Text>
        </View>
      </View>
      {canPin ? (
        // hoverClass 只在 View 上受支持(TextProps 没有该属性,typecheck 会红),
        // 所以命中块用 View、文案用 Text —— 与端内既有「可点胶囊」写法同形。
        <View
          className="flex items-center flex-shrink-0 ml-[16rpx] py-[8rpx] px-[16rpx] rounded-sm bg-background"
          onClick={onTogglePin}
          hoverClass="opacity-60"
        >
          <Text
            className={`text-[length:22rpx] ${
              pinned ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}
          >
            {pinned ? pinnedLabel : pinLabel}
          </Text>
        </View>
      ) : null}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
