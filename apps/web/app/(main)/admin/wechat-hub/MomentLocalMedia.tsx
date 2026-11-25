// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 朋友圈本地媒体面板：只在动态有真实本地目录时显示，按需拉列表和二进制；
 * 不自动加载全部动态，图片加载失败只显示文件名，不补占位图。
 * 视频按需单独加载，避免点开面板就把整段视频拉进内存。
 */

'use client'

import * as React from 'react'
import { Image as ImageIcon, Loader2, Play } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { WechatMomentMediaFileView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '未知大小'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export default function MomentLocalMedia({
  accountId,
  momentId,
}: {
  accountId: string
  momentId: string
}) {
  const [files, setFiles] = React.useState<WechatMomentMediaFileView[] | null>(null)
  const [urls, setUrls] = React.useState<Record<string, string>>({})
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadingName, setLoadingName] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const objectUrls = React.useRef<string[]>([])
  const generation = React.useRef(0)

  React.useEffect(() => {
    return () => {
      generation.current += 1
      for (const url of objectUrls.current) URL.revokeObjectURL(url)
    }
  }, [])

  function clearObjectUrls(): void {
    for (const url of objectUrls.current) URL.revokeObjectURL(url)
    objectUrls.current = []
    setUrls({})
  }

  function close(): void {
    generation.current += 1
    setOpen(false)
    setLoadingName(null)
    clearObjectUrls()
  }

  async function loadFile(file: WechatMomentMediaFileView): Promise<void> {
    const current = generation.current
    setLoadingName(file.name)
    try {
      const blob = await wechatHubApi.fetchMomentMediaBlob(accountId, momentId, file.name)
      if (current !== generation.current) return
      const url = URL.createObjectURL(blob)
      objectUrls.current.push(url)
      setUrls((previous) => ({ ...previous, [file.name]: url }))
    } catch {
      // 单个文件读不到就保留文件名和大小，不拿别的图或占位图顶替。
    } finally {
      if (current === generation.current) setLoadingName(null)
    }
  }

  async function load(): Promise<void> {
    const current = generation.current + 1
    generation.current = current
    setOpen(true)
    setLoading(true)
    setLoadingName(null)
    setError(null)
    clearObjectUrls()
    try {
      const list = await wechatHubApi.fetchMomentMediaList(accountId, momentId)
      if (current !== generation.current) return
      setFiles(list)
      const next: Record<string, string> = {}
      for (const file of list) {
        if (!file.contentType.startsWith('image/')) continue
        try {
          const blob = await wechatHubApi.fetchMomentMediaBlob(accountId, momentId, file.name)
          if (current !== generation.current) return
          const url = URL.createObjectURL(blob)
          objectUrls.current.push(url)
          next[file.name] = url
        } catch {
          // 单张图读不到就保留文件名，不拿别的图或占位图顶替。
        }
      }
      setUrls(next)
    } catch (e) {
      if (current !== generation.current) return
      setFiles(null)
      clearObjectUrls()
      setError(e instanceof Error ? e.message : '读取本地媒体失败')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          if (open) {
            close()
            return
          }
          void load()
        }}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="mr-2 h-4 w-4" />
        )}
        <span>本地媒体</span>
      </Button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-sm border border-stroke-field p-2">
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {!loading && files?.length === 0 ? (
            <p className="text-xs text-muted-foreground">该动态没有本地媒体文件。</p>
          ) : null}
          {files && files.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file) => {
                const url = urls[file.name]
                const isVideo = file.contentType.startsWith('video/')
                if (url && isVideo) {
                  return (
                    <div key={file.name} className="col-span-3">
                      {/* 本地缓存视频没有字幕轨，不放空的假字幕文件。 */}
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        src={url}
                        aria-label={file.name}
                        controls
                        preload="metadata"
                        className="max-h-80 w-full rounded-sm border border-stroke-field bg-black"
                      />
                    </div>
                  )
                }
                if (url) {
                  return (
                    <a
                      key={file.name}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-sm border border-stroke-field"
                    >
                      <img
                        src={url}
                        alt={file.name}
                        loading="lazy"
                        className="h-20 w-full object-cover"
                      />
                    </a>
                  )
                }
                return (
                  <div
                    key={file.name}
                    className="flex min-h-20 flex-col justify-center rounded-sm border border-stroke-field p-1 text-xs"
                  >
                    <span className="break-all text-muted-foreground">{file.name}</span>
                    <span className="mt-1 text-muted-foreground">{formatBytes(file.size)}</span>
                    {isVideo ? (
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 self-start text-primary hover:underline disabled:opacity-50"
                        onClick={() => void loadFile(file)}
                        disabled={loadingName === file.name}
                      >
                        {loadingName === file.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span>{loadingName === file.name ? '加载中' : '加载视频'}</span>
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
