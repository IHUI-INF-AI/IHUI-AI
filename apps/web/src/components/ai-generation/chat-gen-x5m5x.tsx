// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  ChatAdvancedParams,
  CHAT_ADVANCED_DEFAULTS,
  ModelSelect,
  parseChatAdvanced,
  useVendorModels,
  type ChatAdvancedValues,
} from './vendor-models'

// 极速 API 按量 key 模型 fallback(动态拉取失败时使用,2026-09-20 实测精选)
const MODELS = [
  'deepseek-v4-flash-0731',
  'glm-5.3',
  'gpt-5.6',
  'gpt-5.5',
  'qwen3.8-max',
  'qwen3.8-flash',
  'grok-4.6',
  'claude-opus-5',
  'gemini-3.6',
  'kimi-k3',
] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// OpenAI 原生响应 { choices: [{ message: { content } }] },extractText 不覆盖此顶层结构,需自行提取
function extractChatText(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices
    const content = choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) return content
  }
  return ''
}

export const ChatGenX5m5x = React.memo(function ChatGenX5m5x() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState<string>(MODELS[0])
  const [advanced, setAdvanced] = React.useState<ChatAdvancedValues>(CHAT_ADVANCED_DEFAULTS)
  const [answer, setAnswer] = React.useState('')
  const { models, isDynamic, isLoading } = useVendorModels('x5m5x', MODELS)

  const mutation = useMutation({
    mutationFn: async (payload: {
      messages: Array<{ role: string; content: string }>
      model: string
    }) => {
      const res = await fetchApi<unknown>('/api/ai/x5m5x/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      const text = extractChatText(res.data)
      if (!text) throw new Error(t('noResult'))
      return text
    },
    onSuccess: (text) => setAnswer(text),
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmit = () => {
    if (!prompt.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    mutation.mutate({
      messages: [{ role: 'user', content: prompt.trim() }],
      model,
      ...parseChatAdvanced(advanced),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('x5m5xChatTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('x5m5xChatSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="x5m5x-chat-prompt">{t('prompt')}</Label>
          <textarea
            id="x5m5x-chat-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={4}
            className={TEXTAREA_CLS}
          />
        </div>
        <ModelSelect
          models={models}
          value={model}
          onChange={setModel}
          isDynamic={isDynamic}
          isLoading={isLoading}
        />
        <ChatAdvancedParams values={advanced} onChange={setAdvanced} />
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generateText')}
        </Button>

        {answer ? (
          <div className="space-y-1">
            <div className="text-sm font-medium">{t('result')}</div>
            <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
              {answer}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})

export default ChatGenX5m5x
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
