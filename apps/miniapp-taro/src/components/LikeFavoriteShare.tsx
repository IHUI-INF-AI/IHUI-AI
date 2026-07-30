import { View, Text } from '@tarojs/components'
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
  return (
    <View className="flex items-center justify-around py-3 bg-card mt-2">
      <View className="flex flex-col items-center" onClick={onLike}>
        <Text className={`text-lg ${liked ? 'text-destructive' : 'text-muted-foreground'}`}>
          {liked ? '♥' : '♡'}
        </Text>
        <Text className={`text-xs mt-0.5 ${liked ? 'text-destructive' : 'text-muted-foreground'}`}>
          {likeCount > 0 ? likeCount : tt('action.like', '点赞')}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onFavorite}>
        <Text className={`text-lg ${favorited ? 'text-warning' : 'text-muted-foreground'}`}>
          {favorited ? '★' : '☆'}
        </Text>
        <Text className={`text-xs mt-0.5 ${favorited ? 'text-warning' : 'text-muted-foreground'}`}>
          {favoriteCount > 0 ? favoriteCount : tt('action.favorite', '收藏')}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onShare}>
        <Text className="text-lg text-muted-foreground">↗</Text>
        <Text className="text-xs mt-0.5 text-muted-foreground">{shareCount > 0 ? shareCount : tt('action.share', '分享')}</Text>
      </View>
    </View>
  )
}
