'use client'

import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { toast } from 'sonner'
import { Globe, Camera, ExternalLink, Loader2, Wrench, Download, MessageSquare } from 'lucide-react'

import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { listOpenclawTools, executeBrowserTool, type OpenclawToolItem } from '@/lib/openclaw-api'

const BROWSER_KEYWORDS = ['browser', 'navigate', 'screenshot', 'click', 'input', 'page', 'web']

function isBrowserTool(tool: OpenclawToolItem): boolean {
  const haystack = `${tool.name} ${tool.description ?? ''} ${tool.category ?? ''}`.toLowerCase()
  return BROWSER_KEYWORDS.some((k) => haystack.includes(k))
}

export function BrowserPanel() {
  const t = useTranslations('floatingChat.openclaw')

  const [url, setUrl] = React.useState('')
  const [screenshot, setScreenshot] = React.useState<string | null>(null)

  const toolsQuery = useQuery({
    queryKey: ['openclaw', 'tools'],
    queryFn: listOpenclawTools,
  })

  const navigateMutation = useMutation({
    mutationFn: (target: string) => executeBrowserTool('browser_navigate', { url: target }),
    onSuccess: () => {
      toast.success(t('browserNavigateSuccess'))
    },
    onError: () => toast.error(t('browserNavigateError')),
  })

  const screenshotMutation = useMutation({
    mutationFn: () => executeBrowserTool('browser_screenshot', {}),
    onSuccess: (data) => {
      if (data && typeof data.screenshot === 'string') {
        setScreenshot(data.screenshot)
      }
      toast.success(t('browserScreenshotSuccess'))
    },
    onError: () => toast.error(t('browserScreenshotError')),
  })

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      toast.error(t('browserUrlRequired'))
      return
    }
    navigateMutation.mutate(url.trim())
  }

  const handleScreenshot = () => {
    screenshotMutation.mutate()
  }

  const handleDownload = () => {
    if (!screenshot) return
    if (typeof window !== 'undefined') {
      const link = window.document.createElement('a')
      link.href = screenshot.startsWith('data:')
        ? screenshot
        : `data:image/png;base64,${screenshot}`
      link.download = `screenshot-${Date.now()}.png`
      link.click()
      toast.success(t('browserDownloadSuccess'))
    }
  }

  const allTools: OpenclawToolItem[] = toolsQuery.data ?? []
  const browserTools = allTools.filter(isBrowserTool)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            {t('browserQuickActions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleNavigate} className="space-y-2">
            <Label htmlFor="browser-url">{t('browserUrlPlaceholder')}</Label>
            <div className="flex gap-2">
              <Input
                id="browser-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('browserUrlPlaceholder')}
              />
              <Button type="submit" variant="outline" disabled={navigateMutation.isPending}>
                {navigateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('browserOpen')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleScreenshot}
                disabled={screenshotMutation.isPending}
              >
                {screenshotMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {t('browserScreenshot')}
              </Button>
            </div>
          </form>

          {screenshot && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('browserView')}</p>
              <div className="relative h-80 overflow-hidden rounded-md border border-border bg-background">
                <Image
                  src={
                    screenshot.startsWith('data:')
                      ? screenshot
                      : `data:image/png;base64,${screenshot}`
                  }
                  alt={t('browserCurrentPage')}
                  fill
                  className="object-contain"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                {t('browserDownloadScreenshot')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" />
            {t('browserBackendTools')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('browserPanelIntro')}</p>
          {toolsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : browserTools.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noBrowserTools')}
            </p>
          ) : (
            <ul className="space-y-2">
              {browserTools.map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{tool.name}</p>
                    {tool.description && (
                      <p className="break-words text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('browserPanelEmptyHint')}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default BrowserPanel
