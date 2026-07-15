'use client'

import { Bot } from 'lucide-react'
import Image from 'next/image'
import { AnswerArea } from './AnswerArea'
import { BottomBar } from './BottomBar'
import { formatTokens, formatDate } from './helpers'
import type { ShareContentProps } from './types'

export function ShareContent({ shareData, copy, copied }: ShareContentProps) {
  const { modelName, modelIcon, question, answer, tokenCost, createdAt } = shareData

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* 头部：模型信息 */}
      <header className="flex items-center border-b border-gray-100 px-5 py-3.5">
        {modelIcon ? (
          <Image
            src={modelIcon}
            alt="模型图标"
            width={32}
            height={32}
            className="mr-2.5 h-8 w-8 rounded object-cover"
          />
        ) : (
          <div className="mr-2.5 flex h-8 w-8 items-center justify-center rounded bg-gray-100">
            <Bot className="h-5 w-5 text-gray-500" />
          </div>
        )}
        <span className="text-base font-semibold text-gray-800">{modelName || 'AI智能对话'}</span>
      </header>

      {/* 对话内容 */}
      <div className="px-5 py-5">
        {/* 用户提问 */}
        <div className="flex justify-end">
          <div className="w-full rounded-2xl border border-[#9A99F3]/40 bg-[#9A99F3] p-5 text-white">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7">
              {question || ''}
            </p>
          </div>
        </div>

        {/* AI 回答 */}
        <div className="mt-5 w-full rounded-3xl border border-gray-200 bg-[#F6F6F6] p-5">
          <AnswerArea answer={answer} />

          {/* 底部信息 */}
          <div className="mt-4 flex items-center gap-4 border-t border-gray-200 pt-3 text-xs text-gray-400">
            <span>智汇AI生成</span>
            {typeof tokenCost === 'number' && tokenCost > 0 && (
              <span>消耗智汇值：{formatTokens(tokenCost)}</span>
            )}
            {createdAt && <span>{formatDate(createdAt)}</span>}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <BottomBar copy={copy} copied={copied} />
    </div>
  )
}
