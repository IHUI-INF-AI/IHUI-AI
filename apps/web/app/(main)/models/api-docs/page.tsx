import { getTranslations } from 'next-intl/server'
import { BookOpen, Code2, Key } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

const CURL_EXAMPLE = `curl https://api.ihui.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-ihui-xxxxx" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`

const PYTHON_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    api_key="sk-ihui-xxxxx",
    base_url="https://api.ihui.ai/v1"
)

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
print(resp.choices[0].message.content)`

export default async function ApiDocsPage() {
  const t = await getTranslations('models')

  const endpoints = [
    { method: 'POST', path: '/v1/chat/completions', desc: t('apiDocs.endpoints.chat') },
    { method: 'POST', path: '/v1/completions', desc: t('apiDocs.endpoints.complete') },
    { method: 'GET', path: '/v1/models', desc: t('apiDocs.endpoints.list') },
    { method: 'POST', path: '/v1/embeddings', desc: t('apiDocs.endpoints.embed') },
    { method: 'POST', path: '/v1/images/generations', desc: t('apiDocs.endpoints.image') },
    { method: 'POST', path: '/v1/audio/speech', desc: t('apiDocs.endpoints.audio') },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('apiDocs.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('apiDocs.subtitle')}</p>
      </header>

      {/* 鉴权 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-primary" />
            {t('apiDocs.auth.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">{t('apiDocs.auth.desc')}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs">
            <code className="font-mono">
              <span className="text-muted-foreground"># Header 格式</span>
              {'\n'}
              Authorization: Bearer sk-ihui-xxxxx
            </code>
          </pre>
        </CardContent>
      </Card>

      {/* 端点列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {t('apiDocs.endpoints.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('apiDocs.endpoints.method')}</th>
                  <th className="px-4 py-2 font-medium">{t('apiDocs.endpoints.path')}</th>
                  <th className="px-4 py-2 font-medium">{t('apiDocs.endpoints.desc')}</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr
                    key={e.path}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          e.method === 'GET'
                            ? 'inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400'
                            : 'inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground">{e.path}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 示例 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4 text-primary" />
            {t('apiDocs.example.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {t('apiDocs.example.curl')}
              </div>
              <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                <code className="font-mono text-foreground">{CURL_EXAMPLE}</code>
              </pre>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {t('apiDocs.example.python')}
              </div>
              <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                <code className="font-mono text-foreground">{PYTHON_EXAMPLE}</code>
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
