'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { demoCompaction } from '@ihui/api-client'
import {
  Button,
  Card,
  CardContent,
  Badge,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Loader2, ChevronDown } from 'lucide-react'

import type { CompactionDemoResult, CompactionStrategy } from './types'

const STRATEGIES: { value: CompactionStrategy; label: string }[] = [
  { value: 'rtk_caveman', label: 'RTK_CAVEMAN' },
  { value: 'rtk', label: 'RTK' },
  { value: 'caveman', label: 'CAVEMAN' },
]

const DEFAULT_TEXT = `请在以下文本中提取关键信息并总结:

人工智能(Artificial Intelligence,简称 AI)是计算机科学的一个分支,它致力于研究、开发用于模拟、延伸和扩展人类智能的理论、方法、技术及应用系统。人工智能的历史可以追溯到 20 世纪 50 年代,当时图灵提出了著名的图灵测试,用于判断机器是否具有智能。随后,逻辑理论家、通用问题求解器等早期程序相继问世,奠定了人工智能研究的基础。

进入 21 世纪后,随着大数据、云计算和深度学习技术的突破,人工智能迎来了爆发式增长。深度学习模型如卷积神经网络(CNN)、循环神经网络(RNN)和 Transformer 架构极大地推动了图像识别、自然语言处理和语音识别等领域的进步。特别是 2017 年 Google 提出的 Transformer 架构,成为了 BERT、GPT 等大型语言模型(LLM)的基石。

如今,大型语言模型如 GPT-4、Claude、Gemini 等已经能够完成文本生成、代码编写、数学推理、多语言翻译等复杂任务,并在教育、医疗、金融、法律等行业得到广泛应用。然而,人工智能的发展也带来了伦理、安全、隐私等方面的挑战,需要社会各界共同应对。`

const PREVIEW_LIMIT = 500

export function CompactionTab() {
  const t = useTranslations('settings.gateway.compaction')

  const [text, setText] = React.useState(DEFAULT_TEXT)
  const [strategy, setStrategy] = React.useState<CompactionStrategy>('rtk_caveman')
  const [keepRecent, setKeepRecent] = React.useState(6)
  const [result, setResult] = React.useState<CompactionDemoResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [showDecompressed, setShowDecompressed] = React.useState(false)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await demoCompaction({
        messages: [{ role: 'user', content: text }],
        strategy,
        keep_recent: keepRecent,
      })
      setResult(r)
      setExpanded(false)
      setShowDecompressed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const ratioPct = result ? Math.round(result.compression_ratio * 100) : 0
  const ratioBadge =
    ratioPct >= 80
      ? {
          label: t('excellent'),
          class: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
        }
      : ratioPct >= 50
        ? {
            label: t('good'),
            class: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-500',
          }
        : { label: t('poor'), class: 'border-transparent bg-muted text-muted-foreground' }

  const compressedText = result?.compressed_messages.map((m) => m.content).join('\n\n') ?? ''
  const decompressedText = result?.decompressed_messages.map((m) => m.content).join('\n\n') ?? ''

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Input */}
      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('input')}</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder={t('inputPlaceholder')}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('strategy')}</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as CompactionStrategy)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('keepRecent')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={keepRecent}
                onChange={(e) => setKeepRecent(Number(e.target.value) || 0)}
                className="w-[100px]"
              />
            </div>
            <Button size="sm" onClick={run} disabled={loading || !text.trim()}>
              {loading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t('run')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <Card>
        <CardContent className="space-y-3 p-3">
          {error && <Alert variant="danger" title="Error" description={error} />}

          {!result && !error && !loading && (
            <p className="py-8 text-center text-xs text-muted-foreground">{t('empty')}</p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-3">
                <MetricCard label={t('original')} value={String(result.original_tokens)} />
                <MetricCard label={t('compressed')} value={String(result.compressed_tokens)} />
                <div className="rounded-md border p-2">
                  <p className="text-[11px] text-muted-foreground">{t('ratio')}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-500">
                      {ratioPct}%
                    </p>
                    <Badge className={`text-[10px] ${ratioBadge.class}`}>{ratioBadge.label}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium">{t('compressedPreview')}</p>
                <pre className="max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed">
                  {expanded ? compressedText : compressedText.slice(0, PREVIEW_LIMIT)}
                  {!expanded && compressedText.length > PREVIEW_LIMIT && '…'}
                </pre>
                {compressedText.length > PREVIEW_LIMIT && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? 'Collapse' : 'Expand'}
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {t('rtkMapSize')}:{' '}
                <span className="font-medium text-foreground">{result.rtk_map_size}</span>
              </p>

              <Collapsible open={showDecompressed} onOpenChange={setShowDecompressed}>
                <CollapsibleTrigger className="inline-flex h-7 w-auto items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent">
                  <ChevronDown
                    className={`mr-1 h-3.5 w-3.5 transition-transform ${showDecompressed ? 'rotate-180' : ''}`}
                  />
                  {showDecompressed ? t('hideDecompressed') : t('showDecompressed')}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed">
                    {decompressedText}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
