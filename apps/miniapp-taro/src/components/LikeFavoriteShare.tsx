import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'

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
  return (
    <View className="flex items-center justify-around py-3 bg-card mt-2">
      <View className="flex flex-col items-center" onClick={onLike}>
        <Image
          style={{ width: '36rpx', height: '36rpx' }}
          src={liked ? '/static/images/icons/heart-fill.svg' : '/static/images/icons/heart.svg'}
          mode="aspectFit"
        />
        <Text className={`text-xs mt-0.5 ${liked ? 'text-destructive' : 'text-muted-foreground'}`}>
          {likeCount > 0 ? likeCount : tt('action.like', '点赞')}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onFavorite}>
        <Image
          style={{ width: '36rpx', height: '36rpx' }}
          src={favorited ? '/static/images/icons/star-fill.svg' : '/static/images/icons/star.svg'}
          mode="aspectFit"
        />
        <Text className={`text-xs mt-0.5 ${favorited ? 'text-warning' : 'text-muted-foreground'}`}>
          {favoriteCount > 0 ? favoriteCount : tt('action.favorite', '收藏')}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onShare}>
        <Image
          style={{ width: '36rpx', height: '36rpx' }}
          src="/static/images/icons/share-2.svg"
          mode="aspectFit"
        />
        <Text className="text-xs mt-0.5 text-muted-foreground">
          {shareCount > 0 ? shareCount : tt('action.share', '分享')}
        </Text>
      </View>
    </View>
  )
}
