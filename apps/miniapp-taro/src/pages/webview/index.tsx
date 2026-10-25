// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, WebView } from '@tarojs/components'
import {
  navigateTo,
  useRouter,
  setNavigationBarTitle,
  getStorageSync,
  reLaunch,
} from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { WEBVIEW_FILE_CACHE_KEY } from '@/constants/storage'
import { logger } from '@/utils/logger'
import { consumeSsoCode, extractSsoCodeFromWebviewMessages } from '@/utils/sso'
import { safeDecodeURIComponent } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

/** 导航到 webview 页面并加载指定 URL(title 可选:带上后导航栏显示功能名而非空白) */
export function navigateToWebView(url: string, title?: string): void {
  const titleParam = title ? `&title=${encodeURIComponent(title)}` : ''
  navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}${titleParam}` })
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

    // 标题设置(对标原项目 uni.setNavigationBarTitle;decode 已收敛到跨端唯一 safe 出口)
    if (params.title) {
      setNavigationBarTitle({ title: safeDecodeURIComponent(params.title) })
    }

    // URL 参数处理(对标原项目 decodeURIComponent + 额外参数追加)
    if (params.url) {
      const decodedUrl = safeDecodeURIComponent(params.url)

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
      fileCacheRef.current = getStorageSync(WEBVIEW_FILE_CACHE_KEY)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次,load 依赖 t/setState 但无需重跑
  }, [])

  // SSO 回传腿接管(G-957):H5 页登录完成后用 wx.miniProgram.postMessage 回传
  // sso_code,微信在「后退/组件销毁/分享」时机把消息投给 bindmessage。
  // 收到即走 consumeSsoCode 换登录态(与 app.tsx 启动腿同一出口),成功后 600ms reLaunch
  // 首页(与登录页微信登录成功路径同形)。ref 防重:消息数组在销毁时机可能整批重投。
  const ssoReturnInflightRef = useRef(false)
  const handleWebviewMessage = (e: unknown) => {
    logger.info('webview', 'message', String(e))
    if (ssoReturnInflightRef.current) return
    const detail = (e as { detail?: { data?: unknown } })?.detail
    const code = extractSsoCodeFromWebviewMessages(detail?.data)
    if (!code) return
    ssoReturnInflightRef.current = true
    void consumeSsoCode(code, () => t('login.loginSuccess'))
      .then((ok) => {
        if (ok) {
          setTimeout(() => reLaunch({ url: '/pages/index/index' }), 600)
        } else {
          // 换票失败(code 过期/网络异常):释放防重锁,允许用户重试回传
          ssoReturnInflightRef.current = false
        }
      })
      .catch((err: unknown) => {
        logger.warn('webview', 'sso 回传消费异常', String(err))
        ssoReturnInflightRef.current = false
      })
  }

  // web-view 加载完成回调(对标原项目 onWebviewLoad)
  const onWebviewLoad = (e: unknown) => {
    logger.info('webview', 'loaded', String(e))
  }

  if (!url) {
    return (
      // 对齐 RN WebViewScreen:根容器 bg-white/dark neutral-900 → var(--color-card);
      // 头部 px-4(32rpx)/pt-3(24rpx)/pb-2(16rpx),标题 text-base(32rpx) font-medium;底部那条 2rpx 描边按 §4 摘除
      <ThemeRoot>
        <View className="min-h-screen bg-card">
          <View className="px-[32rpx] pt-[24rpx] pb-[16rpx]">
            <Text className="text-[length:32rpx] font-medium text-foreground">
              {t('webview.title')}
            </Text>
          </View>
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-[length:28rpx] text-muted-foreground">
              {t('webview.missingUrl')}
            </Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    // 加载态:根容器对齐 RN(bg-white / dark neutral-900 → var(--color-card)),
    // 网页内容由原生 WebView 组件全屏承载,返回/标题由原生导航栏提供
    <ThemeRoot>
      <View className="min-h-screen bg-card">
        <WebView src={url} onMessage={handleWebviewMessage} onLoad={onWebviewLoad} />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
