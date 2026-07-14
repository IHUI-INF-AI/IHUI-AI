import { View, Text, Image } from '@tarojs/components'

export interface InvitePosterProps {
  inviteCode?: string
  inviteUrl?: string
  qrCodeUrl?: string
  inviterName?: string
  reward?: string
  onSave?: () => void
  onShare?: () => void
}

export default function InvitePoster({
  inviteCode = '',
  inviteUrl = '',
  qrCodeUrl,
  inviterName = '我',
  reward = '邀请好友得现金奖励',
  onSave,
  onShare,
}: InvitePosterProps) {
  return (
    <View className="bg-white mx-3 my-3 rounded-xl overflow-hidden">
      <View
        className="px-6 py-6 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        <Text className="block text-base font-medium mb-1">邀请好友</Text>
        <Text className="block text-xs opacity-80">{reward}</Text>
      </View>

      <View className="px-6 py-5">
        <View className="flex items-center justify-center mb-4">
          {qrCodeUrl ? (
            <Image className="w-32 h-32 rounded-lg bg-gray-50" src={qrCodeUrl} mode="aspectFit" />
          ) : (
            <View className="flex items-center justify-center w-32 h-32 rounded-lg bg-gray-50">
              <Text className="text-xs text-gray-400">二维码</Text>
            </View>
          )}
        </View>

        {inviteCode && (
          <View className="flex items-center justify-center mb-3">
            <Text className="text-xs text-gray-500 mr-2">邀请码:</Text>
            <Text className="text-base font-bold text-indigo-600 tracking-widest">
              {inviteCode}
            </Text>
          </View>
        )}

        {inviteUrl && (
          <View className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
            <Text className="block text-xs text-gray-400 text-center truncate">{inviteUrl}</Text>
          </View>
        )}

        <Text className="block text-xs text-gray-400 text-center mb-4">
          {inviterName} 邀请你加入
        </Text>

        <View className="flex space-x-3">
          <View className="flex-1 py-2.5 rounded-full bg-gray-100 text-center" onClick={onSave}>
            <Text className="text-sm text-gray-600">保存图片</Text>
          </View>
          <View
            className="flex-1 py-2.5 rounded-full text-center"
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
            onClick={onShare}
          >
            <Text className="text-sm text-white">立即分享</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
