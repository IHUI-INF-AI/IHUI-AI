import { View, Text, WebView } from '@tarojs/components'
import { navigateTo, useRouter, setNavigationBarTitle, getStorageSync } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

/** 导航到 webview 页面并加载指定 URL */
export function navigateToWebView(url: string): void {
  navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
}

export default function WebviewIndex() {
  const { t } = useI18n()
  const router = useRouter()
  const params = router.params
  const [url, setUrl] = useState('')
  // fileCache 本地缓存(对标原项目 uni.getStorageSync('webviewFileCache'),用于文件下载等场景)
  const fileCacheRef = useRef<unknown>(null)
  // 标记 onLoad 逻辑是否已执行,避免重复触发(对标原项目 onLoad 只执行一次)
  const initedRef = useRef(false)

  // 对标原 pagesA/webview/index.vue onLoad options 处理
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true

    // 标题设置(对标原项目 uni.setNavigationBarTitle)
    if (params.title) {
      try {
        setNavigationBarTitle({ title: decodeURIComponent(params.title) })
      } catch (e) {
        console.error('webview title decode failed', e)
      }
    }

    // URL 参数处理(对标原项目 decodeURIComponent + 额外参数追加)
    if (params.url) {
      let decodedUrl = params.url
      try {
        decodedUrl = decodeURIComponent(params.url)
      } catch (e) {
        console.error('webview url decode failed', e)
      }

      // 追加除 url/title 外的其他参数到 URL query string
      const h5Params: Record<string, string | undefined> = { ...params }
      delete h5Params.url
      delete h5Params.title
      const paramString = Object.entries(h5Params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`)
        .join('&')
      const separator = decodedUrl.includes('?') ? '&' : '?'
      setUrl(paramString ? `${decodedUrl}${separator}${paramString}` : decodedUrl)
    } else {
      console.warn('未接收到有效的URL参数')
    }

    // fileCache:本地缓存(用于文件下载等场景)
    try {
      fileCacheRef.current = getStorageSync('webviewFileCache')
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 接收 H5 页面 postMessage 的消息(对标原项目 handleWebviewMessage)
  const handleWebviewMessage = (e: unknown) => {
    console.log('webview message:', e, fileCacheRef.current)
  }

  // web-view 加载完成回调(对标原项目 onWebviewLoad)
  const onWebviewLoad = (e: unknown) => {
    console.log('webview loaded:', e)
  }

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
      <WebView src={url} onMessage={handleWebviewMessage} onLoad={onWebviewLoad} />
    </View>
  )
}
