// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'

export interface LikeFavoriteShareProps {
  likeCount?: number
  favoriteCount?: number
  shareCount?: number
  liked?: boolean
  favorited?: boolean
  onLike?: () => void
  onFavorite?: () => void
  onShare?: () => void
}

export default function LikeFavoriteShare({
  likeCount = 0,
  favoriteCount = 0,
  shareCount = 0,
  liked = false,
  favorited = false,
  onLike,
  onFavorite,
  onShare,
}: LikeFavoriteShareProps) {
  const tt = useTt()
  // 2026-11-23 用户定档:按钮只留图标,计数为 0 不再落「点赞/收藏/分享」文案;
  // 语义改由 ariaLabel 承担,命中盒固定 80rpx(40px,与 RN 视频互动条同档)。
  return (
    <View className="flex items-center justify-around py-md bg-card mt-sm">
      <View
        className="flex flex-col items-center justify-center"
        style={{ width: 'var(--spacing-4xl)', minHeight: 'var(--spacing-4xl)' }}
        ariaRole="button"
        ariaLabel={tt('action.like', '点赞')}
        onClick={onLike}
        hoverClass="opacity-60"
      >
        <LineIcon
          name="heart"
          size={40}
          color={liked ? 'var(--color-brand)' : 'var(--color-muted-foreground)'}
        />
        {likeCount > 0 ? (
          <Text
            className={`text-label mt-[4rpx] ${liked ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {likeCount}
          </Text>
        ) : null}
      </View>
      <View
        className="flex flex-col items-center justify-center"
        style={{ width: 'var(--spacing-4xl)', minHeight: 'var(--spacing-4xl)' }}
        ariaRole="button"
        ariaLabel={tt('action.favorite', '收藏')}
        onClick={onFavorite}
        hoverClass="opacity-60"
      >
        <LineIcon
          name="star"
          size={40}
          color={favorited ? 'var(--color-brand)' : 'var(--color-muted-foreground)'}
        />
        {favoriteCount > 0 ? (
          <Text
            className={`text-label mt-[4rpx] ${favorited ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {favoriteCount}
          </Text>
        ) : null}
      </View>
      <View
        className="flex flex-col items-center justify-center"
        style={{ width: 'var(--spacing-4xl)', minHeight: 'var(--spacing-4xl)' }}
        ariaRole="button"
        ariaLabel={tt('action.share', '分享')}
        onClick={onShare}
        hoverClass="opacity-60"
      >
        <LineIcon name="share-2" size={40} color="var(--color-muted-foreground)" />
        {shareCount > 0 ? (
          <Text className="text-label mt-[4rpx] text-muted-foreground">{shareCount}</Text>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
