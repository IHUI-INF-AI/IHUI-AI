'use client'

import { ExternalLink, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { MINI_PROGRAM_LINK } from './helpers'

export function BottomBar({
  copy,
  copied,
}: {
  copy: (text: string) => Promise<boolean>
  copied: boolean
}) {
  const openMiniProgram = async () => {
    const ok = await copy(MINI_PROGRAM_LINK)
    toast[ok ? 'success' : 'error'](ok ? '小程序链接已复制，请在微信中打开' : '复制失败')
  }

  const copyLink = async () => {
    const url =
      typeof window !== 'undefined' && window.location ? window.location.href : MINI_PROGRAM_LINK
    const ok = await copy(url)
    toast[ok ? 'success' : 'error'](ok ? '链接已复制' : '复制失败')
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex gap-2.5 border-t border-gray-100 bg-white px-2.5 py-2.5">
      <button
        onClick={openMiniProgram}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-200"
      >
        <ExternalLink className="h-4 w-4" />
        打开小程序
      </button>
      <button
        onClick={copyLink}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#9A99F3] py-3 text-sm text-white transition-colors hover:bg-[#8a89e3]"
      >
        <LinkIcon className="h-4 w-4" />
        {copied ? '已复制' : '复制链接'}
      </button>
    </div>
  )
}
