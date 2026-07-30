'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Code2, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { useClipboard } from '@/hooks/use-clipboard'
import { Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ApiKey {
  key: string
}

async function fetchKeys(): Promise<ApiKey[]> {
  const r = await fetchApi<ApiKey[]>('/api/developer/keys')
  if (!r.success) throw new Error(r.error)
  return r.data
}

type Lang = 'curl' | 'python' | 'node' | 'go' | 'java'

interface CodeExample {
  title: string
  code: string
}

interface LangGroup {
  lang: Lang
  label: string
  examples: CodeExample[]
}

const TEMPLATES: LangGroup[] = [
  {
    lang: 'curl',
    label: 'curl',
    examples: [
      {
        title: '基础调用 (OpenAI 格式)',
        code: `curl https://api.ihui.ai/v1/chat/completions \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "你好"}],
    "temperature": 0.7
  }'`,
      },
      {
        title: '流式响应',
        code: `curl https://api.ihui.ai/v1/chat/completions \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "讲个故事"}],
    "stream": true
  }'`,
      },
      {
        title: 'Anthropic 格式',
        code: `curl https://api.ihui.ai/v1/anthropic/messages \\
  -H "x-api-key: {{API_KEY}}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'`,
      },
    ],
  },
  {
    lang: 'python',
    label: 'Python',
    examples: [
      {
        title: 'openai-sdk',
        code: `from openai import OpenAI

client = OpenAI(
    api_key="{{API_KEY}}",
    base_url="https://api.ihui.ai/v1"
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)`,
      },
      {
        title: 'anthropic-sdk',
        code: `from anthropic import Anthropic

client = Anthropic(
    api_key="{{API_KEY}}",
    base_url="https://api.ihui.ai/v1/anthropic"
)

msg = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "你好"}],
)
print(msg.content[0].text)`,
      },
      {
        title: 'requests',
        code: `import requests

resp = requests.post(
    "https://api.ihui.ai/v1/chat/completions",
    headers={
        "Authorization": "Bearer {{API_KEY}}",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "你好"}],
    },
)
print(resp.json())`,
      },
    ],
  },
  {
    lang: 'node',
    label: 'Node.js',
    examples: [
      {
        title: 'openai',
        code: `import OpenAI from "openai"

const client = new OpenAI({
  apiKey: "{{API_KEY}}",
  baseURL: "https://api.ihui.ai/v1",
})

const resp = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "你好" }],
})
console.log(resp.choices[0].message.content)`,
      },
      {
        title: '@anthropic-ai/sdk',
        code: `import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: "{{API_KEY}}",
  baseURL: "https://api.ihui.ai/v1/anthropic",
})

const msg = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "你好" }],
})
console.log(msg.content[0].text)`,
      },
      {
        title: 'fetch',
        code: `const resp = await fetch("https://api.ihui.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer {{API_KEY}}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "你好" }],
  }),
})
const data = await resp.json()
console.log(data.choices[0].message.content)`,
      },
    ],
  },
  {
    lang: 'go',
    label: 'Go',
    examples: [
      {
        title: 'net/http',
        code: `package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
)

func main() {
  body, _ := json.Marshal(map[string]any{
    "model": "gpt-4o-mini",
    "messages": []map[string]string{{"role": "user", "content": "你好"}},
  })
  req, _ := http.NewRequest("POST", "https://api.ihui.ai/v1/chat/completions", bytes.NewReader(body))
  req.Header.Set("Authorization", "Bearer {{API_KEY}}")
  req.Header.Set("Content-Type", "application/json")
  resp, _ := http.DefaultClient.Do(req)
  defer resp.Body.Close()
  data, _ := io.ReadAll(resp.Body)
  fmt.Println(string(data))
}`,
      },
    ],
  },
  {
    lang: 'java',
    label: 'Java',
    examples: [
      {
        title: 'OkHttp',
        code: `import okhttp3.*;

OkHttpClient client = new OkHttpClient();

String json = """
    {"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}
    """;

Request request = new Request.Builder()
    .url("https://api.ihui.ai/v1/chat/completions")
    .addHeader("Authorization", "Bearer {{API_KEY}}")
    .addHeader("Content-Type", "application/json")
    .post(RequestBody.create(json, MediaType.parse("application/json")))
    .build();

try (Response resp = client.newCall(request).execute()) {
  System.out.println(resp.body().string());
}`,
      },
    ],
  },
]

function maskKey(k: string): string {
  if (!k) return 'sk-your-api-key'
  if (k.length <= 10) return k
  return k.slice(0, 6) + '...' + k.slice(-4)
}

export function SdkExamples(): React.JSX.Element {
  const { copy } = useClipboard()
  const [reveal, setReveal] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const { data: keys = [] } = useQuery({
    queryKey: ['developer', 'keys'],
    queryFn: () => fetchKeys().catch(() => [] as ApiKey[]),
  })

  const realKey = keys[0]?.key ?? ''
  const apiKey = reveal ? realKey || 'sk-your-api-key' : maskKey(realKey)

  async function handleCopy(id: string, code: string) {
    const ok = await copy(code)
    if (ok) {
      setCopiedId(id)
      toast.success('代码已复制')
      setTimeout(() => setCopiedId(null), 1500)
    } else {
      toast.error('复制失败')
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">SDK 示例</p>
          </div>
          <button
            onClick={() => setReveal((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {reveal ? '隐藏 Key' : '显示 Key'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          示例已填入你的 API Key{reveal ? '(明文)' : '(已脱敏,复制后请替换为完整 Key)'}。
        </p>

        <Tabs defaultValue="curl">
          <TabsList className="h-8">
            {TEMPLATES.map((g) => (
              <TabsTrigger key={g.lang} value={g.lang} className="text-xs">
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TEMPLATES.map((g) => (
            <TabsContent key={g.lang} value={g.lang} className="space-y-3">
              {g.examples.map((ex, idx) => {
                const id = `${g.lang}-${idx}`
                const code = ex.code.replace(/{{API_KEY}}/g, apiKey)
                const copied = copiedId === id
                return (
                  <div key={id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{ex.title}</p>
                    <div className="relative">
                      <pre
                        className={cn(
                          'overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100',
                          'dark:bg-zinc-900',
                        )}
                      >
                        <code className="font-mono">{code}</code>
                      </pre>
                      <button
                        onClick={() => handleCopy(id, code)}
                        className="absolute right-2 top-2 rounded-md bg-zinc-800 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                        aria-label="复制代码"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
