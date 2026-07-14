import { View, Text } from '@tarojs/components'

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
  return (
    <View className="flex items-center justify-around py-3 bg-white border-t border-gray-100">
      <View className="flex flex-col items-center" onClick={onLike}>
        <Text className={`text-lg ${liked ? 'text-red-500' : 'text-gray-400'}`}>
          {liked ? '♥' : '♡'}
        </Text>
        <Text className={`text-xs mt-0.5 ${liked ? 'text-red-500' : 'text-gray-400'}`}>
          {likeCount > 0 ? likeCount : '点赞'}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onFavorite}>
        <Text className={`text-lg ${favorited ? 'text-yellow-500' : 'text-gray-400'}`}>
          {favorited ? '★' : '☆'}
        </Text>
        <Text className={`text-xs mt-0.5 ${favorited ? 'text-yellow-500' : 'text-gray-400'}`}>
          {favoriteCount > 0 ? favoriteCount : '收藏'}
        </Text>
      </View>
      <View className="flex flex-col items-center" onClick={onShare}>
        <Text className="text-lg text-gray-400">↗</Text>
        <Text className="text-xs mt-0.5 text-gray-400">{shareCount > 0 ? shareCount : '分享'}</Text>
      </View>
    </View>
  )
}
