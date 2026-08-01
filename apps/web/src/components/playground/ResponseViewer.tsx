'use client'

/**
 * 响应展示:markdown 渲染 + token 计数 + 成本 + 延迟 + 代码生成(cURL/Python/Node.js)+ 历史记录。
 */

import * as React from 'react'
import { Clock, Hash, Coins, History, Trash2, RotateCcw } from 'lucide-react'
import { Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, CodeBlock, Button } from '@ihui/ui-react'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'
import {
  generateCurlCode,
  generateNodejsCode,
  generatePythonCode,
} from '@/lib/playground-api'
import type {
  CodeLanguage,
  PlaygroundHistoryItem,
  PlaygroundMessage,
  PlaygroundParams,
  PlaygroundResponse,
} from './PlaygroundTypes'

interface ResponseViewerProps {
  response: PlaygroundResponse | null
  streamingContent: string
  isStreaming: boolean
  error: string | null
  messages: PlaygroundMessage[]
  params: PlaygroundParams
  apiKey: string
  history: PlaygroundHistoryItem[]
  onRestoreHistory: (item: PlaygroundHistoryItem) => void
  onRemoveHistory: (id: string) => void
  onClearHistory: () => void
}

const LANG_LABELS: Record<CodeLanguage, string> = {
  curl: 'cURL',
  python: 'Python',
  nodejs: 'Node.js',
}

export function ResponseViewer({
  response,
  streamingContent,
  isStreaming,
  error,
  messages,
  params,
  apiKey,
  history,
  onRestoreHistory,
  onRemoveHistory,
  onClearHistory,
}: ResponseViewerProps) {
  const [codeLang, setCodeLang] = React.useState<CodeLanguage>('curl')

  const displayContent = isStreaming ? streamingContent : response?.content ?? ''
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}` : 'YOUR_API_KEY'

  const code = React.useMemo(() => {
    const keyForCode = apiKey || 'YOUR_API_KEY'
    if (codeLang === 'curl') return generateCurlCode(messages, params, keyForCode)
    if (codeLang === 'python') return generatePythonCode(messages, params, keyForCode)
    return generateNodejsCode(messages, params, keyForCode)
  }, [codeLang, messages, params, apiKey])

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col p-4">
        <Tabs defaultValue="response" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="response" className="text-xs">响应</TabsTrigger>
            <TabsTrigger value="code" className="text-xs">代码</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              历史({history.length})
            </TabsTrigger>
          </TabsList>

          {/* 响应 Tab */}
          <TabsContent value="response" className="mt-3 flex-1 overflow-y-auto">
            {error ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : displayContent ? (
              <div className="space-y-3">
                <MarkdownViewer content={displayContent} />
                {isStreaming && (
                  <span className="inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
                {isStreaming ? '等待响应…' : '点击「发送」查看响应'}
              </div>
            )}

            {/* 统计信息 */}
            {response && !isStreaming && (
              <div className="mt-4 grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
                <StatChip icon={<Hash className="h-3 w-3" />} label="prompt" value={String(response.promptTokens)} />
                <StatChip icon={<Hash className="h-3 w-3" />} label="completion" value={String(response.completionTokens)} />
                <StatChip icon={<Clock className="h-3 w-3" />} label="耗时" value={`${response.latencyMs}ms`} />
                <StatChip
                  icon={<Coins className="h-3 w-3" />}
                  label="成本"
                  value={response.costCents > 0 ? `¥${(response.costCents / 100).toFixed(4)}` : '—'}
                />
              </div>
            )}
          </TabsContent>

          {/* 代码 Tab */}
          <TabsContent value="code" className="mt-3 flex-1 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {(Object.keys(LANG_LABELS) as CodeLanguage[]).map((lang) => (
                  <Button
                    key={lang}
                    variant={codeLang === lang ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCodeLang(lang)}
                    className="h-7 text-xs"
                  >
                    {LANG_LABELS[lang]}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                API Key 显示为 <code className="rounded bg-muted px-1 py-0.5">{maskedKey}</code>
              </p>
              <CodeBlock code={code} language={codeLang === 'nodejs' ? 'javascript' : codeLang === 'python' ? 'python' : 'bash'} />
            </div>
          </TabsContent>

          {/* 历史 Tab */}
          <TabsContent value="history" className="mt-3 flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
                <History className="mr-2 h-4 w-4" />
                暂无历史记录
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearHistory}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    清空
                  </Button>
                </div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{item.params.model || '未知模型'}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onRestoreHistory(item)}
                          aria-label="恢复"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveHistory(item.id)}
                          aria-label="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">
                      {item.response.content.slice(0, 120) || '(空响应)'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{item.response.totalTokens} tokens</span>
                      <span>{item.response.latencyMs}ms</span>
                      <span>
                        {new Intl.DateTimeFormat('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(item.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

interface StatChipProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
    </div>
  )
}
