import { View, Text, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

export interface QrCodeShareProps {
  title?: string
  desc?: string
  qrUrl?: string
  logoUrl?: string
  userName?: string
  onSave?: () => void
  onShare?: () => void
}

export default function QrCodeShare({
  title = '分享海报',
  desc = '扫码即可查看',
  qrUrl = '',
  logoUrl = '',
  userName = '',
  onSave,
  onShare,
}: QrCodeShareProps) {
  const handleSave = () => {
    if (!qrUrl) {
      Taro.showToast({ title: '二维码生成中', icon: 'loading' })
      return
    }
    Taro.saveImageToPhotosAlbum({
      filePath: qrUrl,
      success: () => Taro.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: () => Taro.showToast({ title: '保存失败', icon: 'none' }),
    })
    onSave?.()
  }

  const handleShare = () => {
    onShare?.()
  }

  return (
    <View className="flex flex-col items-center px-6 py-8">
      <Text className="text-base font-semibold text-gray-800">{title}</Text>
      <Text className="text-xs text-gray-400 mt-1">{desc}</Text>

      <View className="relative mt-5 w-56 h-56 bg-white rounded-2xl shadow-sm flex items-center justify-center">
        {qrUrl ? (
          <Image src={qrUrl} className="w-48 h-48" mode="aspectFit" />
        ) : (
          <View className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <Text className="text-xs text-gray-400">二维码加载中</Text>
          </View>
        )}
        {logoUrl && (
          <Image
            src={logoUrl}
            className="absolute top-2 right-2 w-8 h-8 rounded-lg border-2 border-white"
            mode="aspectFill"
          />
        )}
      </View>

      {userName && <Text className="mt-4 text-sm text-gray-700">来自:{userName}</Text>}

      <View className="flex gap-3 mt-6 w-full">
        <Button
          className="flex-1 !bg-gray-100 !text-gray-700 text-sm rounded-md"
          onClick={handleShare}
        >
          分享给好友
        </Button>
        <Button
          className="flex-1 !bg-green-600 !text-white text-sm rounded-md"
          onClick={handleSave}
        >
          保存图片
        </Button>
      </View>
    </View>
  )
}
