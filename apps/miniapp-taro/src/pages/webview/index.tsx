import { View, Text, WebView } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import './index.css'

export default function WebviewIndex() {
  const { t } = useI18n()
  const router = useRouter()
  const url = decodeURIComponent(router.params.url || '')

  if (!url) {
    return (
      <View className="webview-page">
        <View className="page-header">
          <Text className="page-title">{t('webview.title')}</Text>
        </View>
        <Text className="empty-text">{t('webview.missingUrl')}</Text>
      </View>
    )
  }

  return (
    <View className="webview-page">
      <WebView src={url} />
    </View>
  )
}
