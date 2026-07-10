'use client'

import * as React from 'react'
import { Loader2, Terminal, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function ApiTestPage() {
  const [url, setUrl] = React.useState('')
  const [method, setMethod] = React.useState<Method>('GET')
  const [headers, setHeaders] = React.useState('')
  const [body, setBody] = React.useState('')
  const [response, setResponse] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResponse('')
    if (!url.trim()) {
      setError('请输入请求 URL')
      return
    }
    setLoading(true)
    try {
      const init: RequestInit = { method }
      if (method !== 'GET' && body.trim()) {
        init.body = body.trim()
      }
      if (headers.trim()) {
        init.headers = JSON.parse(headers.trim()) as Record<string, string>
      }
      const r = await fetchApi<unknown>(url.trim(), init)
      setResponse(JSON.stringify(r, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="h-6 w-6 text-primary" />
          API 测试
        </h1>
        <p className="text-sm text-muted-foreground">发送自定义请求并查看响应</p>
      </header>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                发送
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Input
                id="headers"
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                placeholder='{"Content-Type":"application/json"}'
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder='{"key":"value"}'
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">响应</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">{response}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
