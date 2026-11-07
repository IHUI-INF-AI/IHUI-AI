// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 薄壳:渲染全部委托共享屏 packages/app/src/features/share-landing/ShareLandingScreen.tsx
// 声明澄清:此前登记的 ChatScreen(对话域:消息流 + 输入区 + 模型选择)与 SquareScreen(文章流)
// 均为误挂 —— 本页是只读分享落地页(模型头卡 + 作者行 + 提问气泡 + 回答卡 + 底部两操作),
// 两者的消息流/文章流结构都不同构,故新建 ShareLandingScreen,不得接入上述两屏。
// 端内保留:① 路由参数 code;② getShareContentByCode 取数 + 字段映射;③ 载入/错误两态;
// ④ useShareAppMessage / showShareMenu / previewImage / 导航 / 吐司;⑤ i18n 与主题。
// 视频/音频的 Taro 组件放在兄弟模块 ./creation-media,本页只传函数引用,不出现渲染型 JSX。
import { useCallback, useMemo, useState } from 'react'
import Taro, { getCurrentInstance, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import { getShareContentByCode } from '@/api'
import { showShareMenu } from '@/utils/share'
import { logger } from '@/utils/logger'
import { onToast } from '@/host/on-toast'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  ShareLandingScreen,
  type ShareLandingContent,
} from '@ihui/rn-app/features/share-landing/ShareLandingScreen'
import { renderShareVideo, renderShareAudio } from './creation-media'

/** 接口原始记录:UI 内容之外的业务字段(agentId 供「再生成」跳转)留在端内 */
export interface ShareCreationRecord extends ShareLandingContent {
  code?: string
  agentId?: string
  userUuid?: string
  gcType?: string
  content?: string
  status?: number
}

/** 取数行 → 共享屏内容;每个展示字段在此映射一次(测试逐字段断言,删掉任一条即红) */
export function toShareLandingContent(record: ShareCreationRecord): ShareLandingContent {
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

export default function ShareCreationPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [content, setContent] = useState<ShareLandingContent | null>(null)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const code = useMemo(() => {
    const inst = getCurrentInstance()
    return (inst.router?.params?.code || '') as string
  }, [])

  const load = useCallback(async () => {
    if (!code) {
      setError(t('share.creation.missingCode'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const record = (await getShareContentByCode(code)) as ShareCreationRecord
      setContent(toShareLandingContent(record))
      setAgentId(record.agentId || '')
    } catch (e) {
      logger.error('share/index', '获取分享内容', e)
      setError(e instanceof Error ? e.message : t('share.creation.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [code, t])

  useDidShow(() => {
    void load()
    showShareMenu()
  })

  useShareAppMessage(() => ({
    title: content?.question || content?.modelName || t('share.creation.title'),
    path: `/pkg-content/share/creation?code=${code}`,
    imageUrl: content?.answer?.images?.[0] || content?.modelIcon || '',
  }))

  const onBack = useCallback(() => {
    void Taro.navigateBack()
  }, [])

  const onPreviewImage = useCallback((images: string[], index: number) => {
    Taro.previewImage({ urls: images, current: images[index] })
  }, [])

  const onRegenerate = useCallback(() => {
    if (agentId) {
      Taro.navigateTo({ url: `/pkg-ai/ai/agent-detail?id=${agentId}` })
    } else {
      Taro.navigateTo({ url: '/pkg-ai/ai/chat' })
    }
  }, [agentId])

  const onShareFriend = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
    onToast(t('share.creation.clickShare'), { kind: 'info' })
  }, [t])

  return (
    <ThemeRoot>
      <ShareLandingScreen
        t={t}
        state={loading ? 'loading' : error || !content ? 'error' : 'ready'}
        content={content}
        errorText={error}
        onBack={onBack}
        onRetry={() => void load()}
        onPreviewImage={onPreviewImage}
        onRegenerate={onRegenerate}
        onShareFriend={onShareFriend}
        colorScheme={resolvedTheme}
        renderVideo={renderShareVideo}
        renderAudio={renderShareAudio}
      />
    </ThemeRoot>
  )
}
