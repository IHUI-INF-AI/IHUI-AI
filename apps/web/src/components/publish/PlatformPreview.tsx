'use client'

/**
 * 跨平台差异化预览 — 模拟微信公众号/知乎/小红书/CSDN 的呈现效果。
 * 手机(375px)/ 电脑(1024px)视图切换;内容变化防抖 500ms 同步。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Smartphone, Monitor } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export interface PlatformPreviewProps {
  readonly content: string
  readonly platform: string
  readonly title: string
}

type ViewMode = 'mobile' | 'desktop'

type PreviewPlatform = 'wechat' | 'zhihu' | 'xiaohongshu' | 'csdn'

const PLATFORM_OPTIONS: readonly PreviewPlatform[] = ['wechat', 'zhihu', 'xiaohongshu', 'csdn']

/** HTML 文本转义(& < >),防止 XSS 注入 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 链接 URL 协议白名单(http/https/mailto/相对路径/锚点),非白名单协议替换为 # 防 XSS */
const SAFE_HREF_RE = /^(https?:|mailto:|#|\/)/i

/** 轻量 Markdown → HTML(预览用,覆盖常用语法) */
function mdToHtml(md: string): string {
  let s = escapeHtml(md)
  s = s.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  s = s.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^\*]+)\*/g, '<em>$1</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // 链接:校验 URL 协议白名单,防 javascript: 等 XSS
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, text: string, url: string) => {
      const safeHref = SAFE_HREF_RE.test(url) ? url : '#'
      return `<a href="${safeHref}">${text}</a>`
    },
  )
  s = s.replace(/!\[\]\(([^)]+)\)/g, '<img src="$1" alt="" />')
  s = s.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  s = s.replace(/^---$/gm, '<hr/>')
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>')
  s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  s = s.replace(/\n\n/g, '</p><p>')
  s = `<p>${s}</p>`
  s = s.replace(/<p><\/p>/g, '')
  return s
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function PlatformPreview({ content, platform, title }: PlatformPreviewProps) {
  const t = useTranslations('publish')
  const [view, setView] = React.useState<ViewMode>('mobile')
  const [selectedPlatform, setSelectedPlatform] = React.useState<PreviewPlatform>(
    (PLATFORM_OPTIONS.includes(platform as PreviewPlatform) ? platform : 'wechat') as PreviewPlatform,
  )
  const debouncedContent = useDebounced(content, 500)
  const html = React.useMemo(() => mdToHtml(debouncedContent), [debouncedContent])

  const platformClass = PLATFORM_STYLES[selectedPlatform]
  const widthClass = view === 'mobile' ? 'max-w-[375px]' : 'max-w-[1024px]'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {PLATFORM_OPTIONS.map((p) => (
            <Button
              key={p}
              type="button"
              variant={selectedPlatform === p ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedPlatform(p)}
            >
              {t(`preview.${p}` as never)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant={view === 'mobile' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9"
            title={t('preview.mobile')}
            onClick={() => setView('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === 'desktop' ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9"
            title={t('preview.desktop')}
            onClick={() => setView('desktop')}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={cn('mx-auto overflow-hidden rounded-md border bg-background', widthClass)}>
        <div
          className={cn('p-4 text-sm leading-relaxed', platformClass.wrapper)}
          dangerouslySetInnerHTML={{ __html: `<h1 class="text-base font-bold mb-2 ${platformClass.title}">${escapeHtml(title || '无标题')}</h1>${html}` }}
        />
      </div>
    </div>
  )
}

const PLATFORM_STYLES: Record<PreviewPlatform, { wrapper: string; title: string }> = {
  wechat: {
    wrapper: '[&_p]:my-3 [&_h1]:text-[#222] [&_h2]:text-[#222] [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#07c160] [&_blockquote]:text-[#888] [&_a]:text-[#576b95] [&_code]:text-[#c7254e] [&_code]:bg-[#f9f2f4] [&_code]:px-1 [&_code]:rounded',
    title: 'text-[#222]',
  },
  zhihu: {
    wrapper: '[&_p]:my-3 [&_h1]:text-[#1a1a1a] [&_blockquote]:border-l-4 [&_blockquote]:border-[#0084ff] [&_blockquote]:bg-[#f6f6f6] [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_a]:text-[#0084ff] [&_img]:rounded-md [&_img]:border',
    title: 'text-[#1a1a1a]',
  },
  xiaohongshu: {
    wrapper: '[&_*]:text-[15px] [&_p]:my-2 [&_h1]:text-base [&_blockquote]:bg-[#fff0f5] [&_blockquote]:border-l-4 [&_blockquote]:border-[#ff2442] [&_a]:text-[#ff2442] [&_img]:rounded-lg',
    title: 'text-[#ff2442]',
  },
  csdn: {
    wrapper: '[&_p]:my-3 [&_h1]:text-[#1f73b1] [&_h2]:text-[#1f73b1] [&_h3]:text-[#1f73b1] [&_blockquote]:border-l-4 [&_blockquote]:border-[#ddd] [&_blockquote]:bg-[#f8f8f8] [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_a]:text-[#4ea1db] [&_pre]:bg-[#1e1e1e] [&_pre]:text-[#d4d4d4] [&_pre]:p-3 [&_pre]:rounded [&_code]:text-[#c7254e] [&_code]:bg-[#f9f2f4] [&_code]:px-1',
    title: 'text-[#1f73b1]',
  },
}
