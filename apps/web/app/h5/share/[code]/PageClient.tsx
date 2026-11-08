// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/use-theme'
import { Check, Link2, Share2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchShareContent, type ShareContent } from '@ihui/api-client'
import {
  ShareLandingScreen,
  type ShareLandingAudio,
  type ShareLandingContent,
  type ShareLandingVideo,
} from '@ihui/rn-app/features/share-landing/ShareLandingScreen'
import type { TFunction } from '@ihui/types'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

/**
 * h5 分享落地页(web 真消费点)。
 *
 * 正文、模型头卡、作者行、提问气泡、回答卡、思考折叠块与底部两操作已全量交给
 * `@ihui/rn-app/features/share-landing/ShareLandingScreen`(与小程序端同一份源码);
 * web 只保留数据获取、路由,以及平台专属插槽:markdown 正文、`<video>`/`<audio>`、
 * 底部复制链接/微信分享栏与返回。
 */
export function toShareLandingContent(data: ShareContent): ShareLandingContent {
  return {
    modelName: data.modelName,
    modelIcon: data.modelIcon,
    question: data.question,
    answer: data.answer,
    tokenCost: data.tokenCost,
    createdAt: data.createdAt,
    userAvatar: data.userAvatar,
    userName: data.userName,
  }
}

export default function H5SharePage(): React.JSX.Element {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const router = useRouter()
  const th = useTranslations('h5SharePage')
  const tc = useTranslations('common')
  const { resolvedTheme } = useTheme()
  const [copied, setCopied] = React.useState(false)
  const [shareTip, setShareTip] = React.useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['share', 'h5', code],
    queryFn: () => fetchShareContent(code),
    enabled: !!code,
    retry: 1,
  })

  /** 共享屏沿用小程序端 `share.creation.*` / `common.*` 词条，web 侧在此映射到 h5SharePage */
  const landingT: TFunction = (key, options) => {
    switch (key) {
      case 'share.creation.title':
        return th('shareTitleDefault')
      case 'share.creation.loading':
        return th('loading')
      case 'share.creation.loadFailed':
      case 'share.creation.contentNotExist':
        return th('errorDefault')
      case 'share.creation.missingCode':
        return th('errorDefault')
      case 'share.creation.modelDefault':
        return 'AI'
      case 'share.creation.tokenCost':
        return `${options?.n ?? 0} tokens`
      case 'share.creation.thinkingProcess':
        return th('thinkingLabel')
      case 'share.creation.voiceAnswer':
        return th('answerLabel')
      case 'share.creation.regenerate':
        return tc('retry')
      case 'share.creation.shareFriend':
        return th('wechatShare')
      case 'common.back':
        return tc('back')
      case 'common.retry':
        return tc('retry')
      default:
        return key
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setShareTip(th('copyFail'))
      setTimeout(() => setShareTip(''), 2000)
    }
  }

  const wechatShare = async () => {
    if (!data) return
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({
          title: data.userName
            ? th('shareTitleWithUser', { user: data.userName })
            : th('shareTitleDefault'),
          text: data.question,
          url: window.location.href,
        })
        return
      } catch {
        // 用户取消或失败，回退到复制链接
      }
    }
    setShareTip(th('wechatShareTip'))
    setTimeout(() => setShareTip(''), 2500)
  }

  const footer = (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={copyLink}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-sm border px-4 py-2.5 text-body transition-colors',
          copied ? 'border-emerald-500 text-emerald-500' : 'hover:bg-muted',
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? th('copied') : th('copyLink')}
      </button>
      <button
        type="button"
        onClick={wechatShare}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#07c160] px-4 py-2.5 text-body text-white transition-opacity hover:opacity-90"
      >
        <Share2 className="h-4 w-4" />
        {th('wechatShare')}
      </button>
    </div>
  )

  return (
    <main className="px-4 py-4 flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-muted/40 to-background">
      {shareTip && (
        <div className="fixed inset-x-0 top-4 z-popover mx-auto w-fit max-w-[80%] rounded-md bg-foreground/80 px-4 py-2 text-center text-label text-background">
          {shareTip}
        </div>
      )}
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <ShareLandingScreen
          t={landingT}
          state={isLoading ? 'loading' : error || !data ? 'error' : 'ready'}
          content={data ? toShareLandingContent(data) : null}
          errorText={(error as Error)?.message}
          onBack={() => router.back()}
          onRetry={() => void refetch()}
          onPreviewImage={(images, index) => window.open(images[index], '_blank', 'noopener')}
          onRegenerate={() => router.push('/')}
          onShareFriend={wechatShare}
          colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          formatTime={formatDate}
          renderText={(text) => (
            <div className="prose prose-sm max-w-none break-words text-body leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          )}
          renderVideo={(video: ShareLandingVideo) => (
            <video src={video.url} poster={video.cover} controls className="w-full rounded-lg">
              <track default kind="captions" srcLang="zh" src="" />
            </video>
          )}
          renderAudio={(audio: ShareLandingAudio) => (
            <audio src={audio.url} controls className="w-full">
              <track default kind="captions" srcLang="zh" src="" />
            </audio>
          )}
          footer={footer}
        />
      </div>
    </main>
  )
}
