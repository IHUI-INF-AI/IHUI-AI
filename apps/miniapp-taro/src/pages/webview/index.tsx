import { View, Text, WebView } from '@tarojs/components'
import { navigateTo, useRouter } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import './index.css'

/** 导航到 webview 页面并加载指定 URL */
export function navigateToWebView(url: string): void {
  navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
}

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
