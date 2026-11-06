// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端「分享落地页」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/share-landing/ShareLandingScreen.tsx`(真消费点)。
 *
 * 本文件只做平台侧:按 code 取数(api-client fetchShareContent)、字段映射、
 * 图片预览(本端 ImagePreviewModal)、视频(本端 VideoPlayer)、系统分享、再生成跳转。
 * 共享屏本身零取数/零路由/零平台 API。
 */

import { useEffect, useCallback, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { fetchShareContent, type ShareContent } from '@ihui/api-client'
import { ShareLandingScreen as SharedShareLandingScreen } from '@ihui/rn-app'
import type { ShareLandingContent } from '@ihui/rn-app/features/share-landing/ShareLandingScreen'
import ImagePreviewModal from '../components/ImagePreviewModal'
import VideoPlayer from '../components/VideoPlayer'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type ShareLandingRoute = RouteProp<RootStackParamList, 'ShareLanding'>

/** 取数行 → 共享屏内容;每个展示字段在此映射一次 */
export function toShareLandingContent(record: ShareContent): ShareLandingContent {
  return {
    modelName: record.modelName,
    modelIcon: record.modelIcon,
    question: record.question,
    answer: record.answer ?? {},
    tokenCost: record.tokenCost,
    createdAt: record.createdAt,
    userAvatar: record.userAvatar,
    userName: record.userName,
  }
}

export function ShareLandingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<ShareLandingRoute>()
  const code = route.params?.code ?? ''
  const [content, setContent] = useState<ShareLandingContent | null>(null)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null)

  const load = useCallback(async () => {
    if (!code) {
      setError(t('share.creation.missingCode'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const record = await fetchShareContent(code)
      setContent(toShareLandingContent(record))
      setAgentId(record.agentId || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('share.creation.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [code, t])

  useEffect(() => {
    void load()
  }, [load])

  const onShareFriend = useCallback(() => {
    void Share.share({
      title: content?.question || content?.modelName || t('share.creation.title'),
      message: `${content?.question || ''}\nhttps://aizhs.top/h5/share/${code}`.trim(),
    }).catch(() => undefined)
  }, [content, code, t])

  return (
    <>
      <SharedShareLandingScreen
        t={t}
        state={loading ? 'loading' : error || !content ? 'error' : 'ready'}
        content={content}
        errorText={error}
        onBack={() => navigation.goBack()}
        onRetry={() => {
          void load()
        }}
        onPreviewImage={(images, index) => setPreview({ images, index })}
        onRegenerate={() => {
          if (agentId) navigation.navigate('AgentDetail', { id: agentId })
          else navigation.navigate('Chat', {})
        }}
        onShareFriend={onShareFriend}
        colorScheme={resolvedTheme}
        renderVideo={(video) => (
          <VideoPlayer url={video.url} poster={video.cover} autoplay={false} />
        )}
      />
      <ImagePreviewModal
        visible={preview !== null}
        source={null}
        sources={preview ? preview.images.map((uri) => ({ uri })) : undefined}
        initialIndex={preview?.index ?? 0}
        onClose={() => setPreview(null)}
      />
    </>
  )
}
