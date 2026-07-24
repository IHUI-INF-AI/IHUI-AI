import { View, Text, Image } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="bg-card mx-3 my-3 rounded-xl overflow-hidden">
      <View
        className="px-6 py-6 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
      >
        <Text className="block text-base font-medium mb-1">{tt('invite.title', '邀请好友')}</Text>
        <Text className="block text-xs opacity-80">{reward}</Text>
      </View>

      <View className="px-6 py-5">
        <View className="flex items-center justify-center mb-4">
          {qrCodeUrl ? (
            <Image className="w-32 h-32 rounded-lg bg-muted" src={qrCodeUrl} mode="aspectFit" />
          ) : (
            <View className="flex items-center justify-center w-32 h-32 rounded-lg bg-muted">
              <Text className="text-xs text-muted-foreground">{tt('invite.qrcode', '二维码')}</Text>
            </View>
          )}
        </View>

        {inviteCode && (
          <View className="flex items-center justify-center mb-3">
            <Text className="text-xs text-muted-foreground mr-2">{tt('invite.code', '邀请码:')}</Text>
            <Text className="text-base font-bold text-primary tracking-widest">
              {inviteCode}
            </Text>
          </View>
        )}

        {inviteUrl && (
          <View className="bg-muted rounded-lg px-3 py-2 mb-4">
            <Text className="block text-xs text-muted-foreground text-center truncate">{inviteUrl}</Text>
          </View>
        )}

        <Text className="block text-xs text-muted-foreground text-center mb-4">
          {inviterName} {tt('invite.inviteSuffix', '邀请你加入')}
        </Text>

        <View className="flex space-x-3">
          <View className="flex-1 py-2.5 rounded-md bg-muted text-center" onClick={onSave}>
            <Text className="text-sm text-foreground">{tt('invite.saveImage', '保存图片')}</Text>
          </View>
          <View
            className="flex-1 py-2.5 rounded-md text-center"
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
            onClick={onShare}
          >
            <Text className="text-sm text-white">{tt('invite.shareNow', '立即分享')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
