import { View, Text, WebView } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './index.css'

export default function WebviewIndex() {
  const router = useRouter()
  const url = decodeURIComponent(router.params.url || '')

  if (!url) {
    return (
      <View className="webview-page">
        <View className="page-header">
          <Text className="page-title">网页</Text>
        </View>
        <Text className="empty-text">缺少网页地址参数</Text>
      </View>
    )
  }

  return (
    <View className="webview-page">
      <WebView src={url} />
    </View>
  )
}
