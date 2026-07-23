'use client'

import * as React from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2, Bot, Link2, Check, Share2, RotateCcw } from 'lucide-react'
import { fetchShareContent, type ShareContent } from '@/lib/share-api'
import { cn } from '@/lib/utils'

export default function H5SharePage(): React.JSX.Element {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['share', 'h5', code],
    queryFn: () => fetchShareContent(code),
    enabled: !!code,
    retry: 1,
  })

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        {isLoading ? (
          <LoadingView />
        ) : error || !data ? (
          <ErrorView onRetry={() => refetch()} message={(error as Error)?.message} />
        ) : (
          <ShareCard data={data} />
        )}
      </div>
    </main>
  )
}

function LoadingView(): React.JSX.Element {
  const t = useTranslations('h5SharePage')
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>
    </div>
  )
}

function ErrorView({
  onRetry,
  message,
}: {
  onRetry: () => void
  message?: string
}): React.JSX.Element {
  const t = useTranslations('h5SharePage')
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
      <AlertCircle className="mb-4 h-16 w-16 text-muted-foreground/40" />
      <p className="mb-6 text-sm text-muted-foreground">{message || t('errorDefault')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4" />
        {t('retry')}
      </button>
    </div>
  )
}

function ShareCard({ data }: { data: ShareContent }): React.JSX.Element {
  const t = useTranslations('h5SharePage')
  const [copied, setCopied] = React.useState(false)
  const [shareTip, setShareTip] = React.useState('')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setShareTip(t('copyFail'))
      setTimeout(() => setShareTip(''), 2000)
    }
  }

  const wechatShare = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({
          title: data.userName
            ? t('shareTitleWithUser', { user: data.userName })
            : t('shareTitleDefault'),
          text: data.question,
          url: window.location.href,
        })
        return
      } catch {
        // 用户取消或失败，回退到复制链接
      }
    }
    setShareTip(t('wechatShareTip'))
    setTimeout(() => setShareTip(''), 2500)
  }

  const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN') : ''

  return (
    <div className="flex flex-1 flex-col px-4 pb-24 pt-6">
      <article className="flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="flex items-center gap-2.5 border-b px-4 py-3">
          {data.modelIcon ? (
            <Image
              src={data.modelIcon}
              alt={data.modelName}
              width={32}
              height={32}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{data.modelName}</div>
            {data.userName && (
              <div className="truncate text-xs text-muted-foreground">{data.userName}</div>
            )}
          </div>
          {data.tokenCost !== undefined && data.tokenCost > 0 && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {data.tokenCost} tokens
            </span>
          )}
        </header>

        <div className="space-y-4 p-4">
          <section>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('questionLabel')}</div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {data.question}
            </p>
          </section>

          {data.answer?.thinking && (
            <section className="rounded-lg bg-muted/40 p-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">{t('thinkingLabel')}</div>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {data.answer.thinking}
              </p>
            </section>
          )}

          {data.answer?.text && (
            <section>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('answerLabel')}</div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {data.answer.text}
              </p>
            </section>
          )}

          {data.answer?.images && data.answer.images.length > 0 && (
            <section className="grid grid-cols-2 gap-2">
              {data.answer.images.map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt={t('imageAlt', { n: i + 1 })}
                  width={200}
                  height={200}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </section>
          )}

          {data.answer?.lists && data.answer.lists.length > 0 && (
            <section className="space-y-2">
              {data.answer.lists.map((it, i) => (
                <div key={i} className="rounded-lg border p-2">
                  {it.type === 'image' ? (
                    <Image
                      src={it.content}
                      alt={t('contentAlt', { n: i + 1 })}
                      width={400}
                      height={300}
                      className="w-full rounded object-cover"
                    />
                  ) : it.type === 'video' ? (
                    <video src={it.content} controls className="w-full rounded">
                      <track default kind="captions" srcLang="zh" src="" />
                    </video>
                  ) : it.type === 'audio' ? (
                    <audio src={it.content} controls className="w-full">
                      <track default kind="captions" srcLang="zh" src="" />
                    </audio>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm">{it.content}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {data.answer?.video?.url && (
            <video
              src={data.answer.video.url}
              poster={data.answer.video.cover}
              controls
              className="w-full rounded-lg"
            >
              <track default kind="captions" srcLang="zh" src="" />
            </video>
          )}
          {data.answer?.audio?.url && (
            <audio src={data.answer.audio.url} controls className="w-full">
              <track default kind="captions" srcLang="zh" src="" />
            </audio>
          )}

          {createdAt && (
            <div className="border-t pt-2 text-xs text-muted-foreground">{createdAt}</div>
          )}
        </div>
      </article>

      {shareTip && (
        <div className="fixed inset-x-0 top-4 z-popover mx-auto w-fit max-w-[80%] rounded-md bg-black/80 px-4 py-2 text-center text-xs text-white">
          {shareTip}
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t bg-background/95 p-3 backdrop-blur">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-4 py-2.5 text-sm transition-colors',
              copied ? 'border-emerald-500 text-emerald-500' : 'hover:bg-muted',
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? t('copied') : t('copyLink')}
          </button>
          <button
            type="button"
            onClick={wechatShare}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#07c160] px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
          >
            <Share2 className="h-4 w-4" />
            {t('wechatShare')}
          </button>
        </div>
      </footer>
    </div>
  )
}
