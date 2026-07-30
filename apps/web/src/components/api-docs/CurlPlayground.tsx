'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Play, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Card, CardContent } from '@ihui/ui-react'

interface PlaygroundPrefill {
  model?: string
  messages?: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

const SAMPLE_CURL = `curl https://api.ihui.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "你好"}],
    "temperature": 0.7,
    "max_tokens": 1024
  }'`

/** 将 curl 命令按引号与空白拆分为 token(支持单/双引号) */
function tokenizeCurl(s: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < s.length) {
    while (i < s.length && /\s/.test(s.charAt(i))) i++
    if (i >= s.length) break
    const ch = s.charAt(i)
    if (ch === "'" || ch === '"') {
      const end = s.indexOf(ch, i + 1)
      if (end === -1) {
        tokens.push(s.slice(i + 1))
        break
      }
      tokens.push(s.slice(i + 1, end))
      i = end + 1
    } else {
      let j = i
      while (j < s.length && !/\s/.test(s.charAt(j))) j++
      tokens.push(s.slice(i, j))
      i = j
    }
  }
  return tokens
}

const VALUE_FLAGS = new Set(['-X', '-H', '-o', '-u', '--user', '--url', '-A', '--connect-timeout'])
const BODY_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii'])

/** 解析 curl 提取请求体中的模型/消息/采样参数,失败返回 null */
function parseCurl(input: string): PlaygroundPrefill | null {
  const cleaned = input.replace(/\\\s*\n/g, ' ').trim()
  if (!/^curl\b/i.test(cleaned)) return null
  const tokens = tokenizeCurl(cleaned)
  let body = ''
  for (let i = 1; i < tokens.length; i++) {
    const tk = tokens[i] ?? ''
    if (BODY_FLAGS.has(tk)) {
      if (i + 1 < tokens.length) body = tokens[i + 1] ?? ''
      i++
    } else if (VALUE_FLAGS.has(tk)) {
      i++
    }
  }
  if (!body) return null
  try {
    const obj = JSON.parse(body) as Record<string, unknown>
    const result: PlaygroundPrefill = {}
    if (typeof obj.model === 'string') result.model = obj.model
    if (Array.isArray(obj.messages)) {
      result.messages = obj.messages as Array<{ role: string; content: string }>
    }
    if (typeof obj.temperature === 'number') result.temperature = obj.temperature
    if (typeof obj.max_tokens === 'number') result.max_tokens = obj.max_tokens
    if (typeof obj.stream === 'boolean') result.stream = obj.stream
    return result
  } catch {
    return null
  }
}

/** UTF-8 安全的 base64 编码(浏览器端) */
function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  )
}

export function CurlPlayground(): React.JSX.Element {
  const router = useRouter()
  const [curl, setCurl] = React.useState(SAMPLE_CURL)

  function openInPlayground() {
    const parsed = parseCurl(curl)
    if (!parsed) {
      toast.error('无法解析 curl 命令,请检查格式(需含 -d JSON body)')
      return
    }
    const json = JSON.stringify(parsed)
    router.push(`/playground?prefill=${utf8ToBase64(json)}`)
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">curl 联动 Playground</p>
        </div>
        <p className="text-xs text-muted-foreground">
          粘贴 curl 命令,自动解析 model / messages / temperature / max_tokens 并在 Playground 中打开。
        </p>

        <textarea
          value={curl}
          onChange={(e) => setCurl(e.target.value)}
          spellCheck={false}
          className="min-h-[140px] w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="粘贴 curl 命令..."
        />

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setCurl(SAMPLE_CURL)}>
            重置示例
          </Button>
          <Button size="sm" onClick={openInPlayground}>
            <Play className="h-3.5 w-3.5" />
            在 Playground 中打开
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
