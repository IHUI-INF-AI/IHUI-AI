// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import {
  buildCapabilityLaunchHref,
  resolveCapabilityIntent,
  type CapabilityIntentMatch,
  type CapabilityIntentResolution,
} from '@ihui/shared/capabilities'

import { Input } from '@/components/form'
import { useChatStore } from '@/stores/chat'

/**
 * /start 唯一入口的命令栏（2026-11-28 立）。
 *
 * 纪律：
 *  - 只做一件事：一句话 → 能力 → 落点；不做第二套“功能菜单”；
 *  - 认不出来不吞输入：原话写进 chat store 的 draftInput + draftAutoSend，跳 /chat 直接发；
 *  - 拿不准不硬跳：ambiguous 时列 3 个候选让用户点，另给“交给 AI”出口；
 *  - 落点统一带 `q=` 种子，目标页读不读都不报错（首个消费方是 /publish/ai-draft）。
 */

const EXAMPLES = [
  '写一篇公众号文章',
  '把这篇文章发到小红书和公众号',
  '看看上周发布数据',
  '生成一张封面图',
] as const

export function StartCommandBar() {
  const router = useRouter()
  const [value, setValue] = React.useState('')
  const [resolution, setResolution] = React.useState<CapabilityIntentResolution | null>(null)

  const handoffToChat = React.useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      useChatStore.setState({ draftInput: trimmed, draftAutoSend: true })
      router.push('/chat')
    },
    [router],
  )

  const openMatch = React.useCallback(
    (match: CapabilityIntentMatch) => {
      const href = buildCapabilityLaunchHref(match, value)
      if (href) {
        router.push(href)
        return
      }
      handoffToChat(value)
    },
    [handoffToChat, router, value],
  )

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const text = value.trim()
      if (!text) return

      const next = resolveCapabilityIntent(text)
      if (next.kind === 'resolved' && next.best) {
        const href = buildCapabilityLaunchHref(next.best, text)
        if (href) {
          router.push(href)
          return
        }
      }
      if (next.kind === 'ambiguous' && next.matches.length > 0) {
        setResolution(next)
        return
      }
      handoffToChat(text)
    },
    [handoffToChat, router, value],
  )

  return (
    <form className="mt-6" onSubmit={handleSubmit} aria-label="用一句话开始">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setResolution(null)
          }}
          placeholder="说一句你要做的事，比如：把这篇文章发到小红书和公众号"
          aria-label="用一句话描述你要做的事"
          icon={Sparkles}
          autoComplete="off"
          enterKeyHint="send"
          className="h-12 text-body"
        />
        <Button type="submit" size="lg" className="h-12 shrink-0 gap-2">
          开始
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted-foreground">试试：</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-full border border-border px-3 py-1 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              setValue(example)
              setResolution(null)
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {resolution?.kind === 'ambiguous' && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-caption text-muted-foreground">这句话可能对应多个能力，选一个：</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {resolution.matches.map((match) => (
              <Button
                key={match.capability.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openMatch(match)}
              >
                {match.capability.title}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => handoffToChat(value)}>
              都不是，交给 AI
            </Button>
          </div>
        </div>
      )}

      <p className="mt-3 text-caption text-muted-foreground">
        说得越具体越好；认不出来也不吞，原话会直接交给对话。
      </p>
    </form>
  )
}
