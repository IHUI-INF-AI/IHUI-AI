// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { useToast } from '@/hooks/use-toast'

interface ConfigBlock {
  title: string
  filePath: string
  language: string
  content: string
}

interface BootstrapData {
  client: string
  keyPrefix: string
  config: ConfigBlock[]
}

interface KeyUseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyId: string
  keyName: string
}

const CLIENTS = [
  { value: 'codex', labelKey: 'clientCodex' },
  { value: 'codex-ws', labelKey: 'clientCodexWs' },
  { value: 'claude-code', labelKey: 'clientClaudeCode' },
  { value: 'opencode', labelKey: 'clientOpencode' },
  { value: 'gemini-cli', labelKey: 'clientGemini' },
  { value: 'grok-cli', labelKey: 'clientGrok' },
] as const

export function KeyUseDialog({ open, onOpenChange, keyId, keyName }: KeyUseDialogProps) {
  const t = useTranslations('developer')
  const { toast } = useToast()
  const [activeClient, setActiveClient] = React.useState<string>('codex')
  const [data, setData] = React.useState<BootstrapData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadFailed, setLoadFailed] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    setData(null)
    fetchApi<BootstrapData>(`/api/developer/relay/keys/${keyId}/bootstrap?client=${activeClient}`)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) {
          setData(r.data)
          setLoadFailed(false)
        } else {
          setLoadFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, activeClient, keyId])

  function copyBlock(content: string) {
    navigator.clipboard?.writeText(content).then(
      () => toast.success(t('bootstrap.copied')),
      () => toast.error(t('bootstrap.copyFailed')),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('bootstrap.title')}</DialogTitle>
          <DialogDescription>{t('bootstrap.description', { name: keyName })}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeClient} onValueChange={setActiveClient}>
          <TabsList className="flex w-full flex-wrap gap-1 min-[640px]:flex-nowrap">
            {CLIENTS.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="flex-1">
                {t(`bootstrap.${c.labelKey}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {CLIENTS.map((c) => (
            <TabsContent key={c.value} value={c.value}>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('bootstrap.loading')}
                </div>
              ) : loadFailed ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  {t('bootstrap.loadFailed')}
                </p>
              ) : (
                <div className="space-y-3 py-2">
                  {data?.config.map((block, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{block.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t('bootstrap.configPath')}: <code>{block.filePath}</code>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyBlock(block.content)}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          {t('bootstrap.copy')}
                        </Button>
                      </div>
                      <pre className="rounded-md bg-muted p-3 font-mono text-xs overflow-x-auto whitespace-pre">
                        <code>{block.content}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default KeyUseDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
