import type { Metadata } from 'next'
import { PlaygroundClient } from '@/components/playground/PlaygroundClient'

export const metadata: Metadata = {
  title: 'API Playground — 智汇 AI',
  description:
    '在线测试 OpenAI 兼容 API:模型选择、多轮消息构造、参数调节、流式 SSE 渲染、代码生成(cURL/Python/Node.js)与历史记录。',
  alternates: { canonical: '/playground' },
}

export default function PlaygroundPage() {
  return (
    <div className="mx-auto w-full space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">API Playground</h1>
        <p className="text-xs text-muted-foreground">
          用你的 API Key 直接调用 /v1/chat/completions,支持流式渲染、参数调节与代码生成,无需跳转到 /chat。
        </p>
      </header>
      <PlaygroundClient />
    </div>
  )
}
