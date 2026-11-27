// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 一句话出稿页：Brief → AI 出稿 → 合规自检 → 落发布草稿。
 *
 * 为什么单独一页，而不是塞进 /publish/new：
 * - /publish/new 是“已经想清楚内容、只差排版和发布”的手动编辑器；
 * - 这一页只收一句需求，产物直接进草稿箱，不在这里点“发布”；
 * - 草稿仍要人去 /publish/history 确认，人工闸门不因为 AI 自动化而消失。
 */

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2, PenLine, Sparkles, TriangleAlert } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useToast } from '@/hooks/use-toast'
import { apiOrThrow } from '@/lib/api'

import {
  buildPrepareDraftPayload,
  collectBlockingChecks,
  failureTitle,
  type PrepareDraftResult,
} from './helpers'

interface Account {
  id?: number
  platform: string
  displayName?: string | null
  status?: 'active' | 'disabled' | 'expired' | string
  hasCredentials?: boolean
}

const PLATFORM_LABEL: Record<string, string> = {
  wechat: '公众号',
  weibo: '微博',
  xiaohongshu: '小红书',
  douyin: '抖音',
  bilibili: 'B站',
  zhihu: '知乎',
  toutiao: '头条',
  kuaishou: '快手',
  shipinhao: '视频号',
  csdn: 'CSDN',
  juejin: '掘金',
  wordpress: 'WordPress',
  medium: 'Medium',
  youtube: 'YouTube',
}

function platformName(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform
}

export default function AiDraftPage() {
  const { allow } = useAuthGate()
  const toast = useToast()
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = React.useState(false)
  const [brief, setBrief] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [tone, setTone] = React.useState('口语化、自然聊天')
  const [generating, setGenerating] = React.useState(false)
  const [result, setResult] = React.useState<PrepareDraftResult | null>(null)

  React.useEffect(() => {
    if (!allow) return
    let cancelled = false
    setLoadingAccounts(true)
    void apiOrThrow<{ items?: Account[]; list?: Account[] } | Account[]>('/api/publish/accounts/me')
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : (data.items ?? data.list ?? [])
        const usable = list.filter(
          (item) => item.status === 'active' && item.hasCredentials !== false,
        )
        setAccounts(usable)
        setSelected((prev) => {
          if (prev.size > 0) return prev
          const first = usable[0]?.platform
          return first ? new Set([first]) : prev
        })
      })
      .catch((err) => {
        if (!cancelled) toast.error('账号列表没有拉到', (err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false)
      })
    return () => {
      cancelled = true
    }
  }, [allow, toast])

  const platforms = React.useMemo(() => {
    const set = new Set<string>()
    accounts.forEach((item) => {
      if (item.platform) set.add(item.platform)
    })
    return Array.from(set)
  }, [accounts])

  const canSubmit = brief.trim().length > 0 && selected.size > 0 && !generating

  function togglePlatform(platform: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  async function generate() {
    if (!brief.trim()) {
      toast.error('先写一句你要什么')
      return
    }
    if (selected.size === 0) {
      toast.error('至少选一个发布平台')
      return
    }
    setGenerating(true)
    setResult(null)
    try {
      const data = await apiOrThrow<PrepareDraftResult>('/api/publish/prepare-draft', {
        method: 'POST',
        body: JSON.stringify(buildPrepareDraftPayload({ brief, platforms: selected, tone })),
        headers: { 'Content-Type': 'application/json' },
        // 生成 + 合规 + 落库是一条长链路，默认 30s 会把“还在跑”误判成失败。
        timeoutMs: 120_000,
      })
      setResult(data)
      if (data.ok) {
        toast.success('草稿已生成，下一步是你确认')
      } else {
        toast.error(failureTitle(data), data.message)
      }
    } catch (err) {
      const message = (err as Error).message || '请求失败'
      setResult({ ok: false, message })
      toast.error('出稿失败', message)
    } finally {
      setGenerating(false)
    }
  }

  const blocking = collectBlockingChecks(result)
  const success = result?.ok === true && result.taskId

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="space-y-2">
        <p className="text-caption font-medium tracking-wider text-muted-foreground">
          智汇AI · 内容流水线
        </p>
        <h2 className="text-xl font-semibold tracking-tight">一句话，落到草稿箱</h2>
        <p className="text-body leading-relaxed text-muted-foreground">
          说出你要讲什么，AI 按口播规则出稿并自检；通过后只落草稿，不会自己发出去。
        </p>
      </section>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Textarea
            label="一句话需求"
            placeholder="例如：讲清楚为什么 AI 时代一人公司要先把发布链路跑通，给做内容的小团队看"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={2000}
            showCounter
            autoResize
            rows={4}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-label font-medium">发到哪些平台</span>
              <Link href="/account-pool" className="text-caption text-primary hover:underline">
                账号池
              </Link>
            </div>
            {loadingAccounts ? (
              <p className="text-caption text-muted-foreground">正在读账号…</p>
            ) : platforms.length === 0 ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-caption text-muted-foreground">
                还没有可用账号。先去
                <Link href="/account-pool" className="mx-1 text-primary hover:underline">
                  账号池
                </Link>
                接入一个，再回来。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {platforms.map((platform) => {
                  const active = selected.has(platform)
                  return (
                    <button
                      key={platform}
                      type="button"
                      aria-pressed={active}
                      onClick={() => togglePlatform(platform)}
                      className={
                        active
                          ? 'rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-caption font-medium text-primary'
                          : 'rounded-md border px-3 py-1.5 text-caption text-muted-foreground hover:bg-muted/40'
                      }
                    >
                      {platformName(platform)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-medium">语气</span>
            {['口语化、自然聊天', '专业、克制', '轻松、有梗'].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tone === value}
                onClick={() => setTone(value)}
                className={
                  tone === value
                    ? 'rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-caption text-primary'
                    : 'rounded-md border px-2.5 py-1 text-caption text-muted-foreground hover:bg-muted/40'
                }
              >
                {value}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
            <span className="text-caption text-muted-foreground">
              固定口径：470–490 字 · 标题 16 字 · 5 个话题词
            </span>
            <Button onClick={generate} disabled={!canSubmit} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {generating ? '正在出稿并自检…' : '生成并落草稿'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generating && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-body text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            正在生成、自检、落库；通常需要几十秒，别重复点。
          </CardContent>
        </Card>
      )}

      {result && !success && (
        <Card className="border-amber-500/40">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-body font-medium">
              <TriangleAlert className="h-5 w-5 text-amber-600" aria-hidden />
              {failureTitle(result)}
            </div>
            {result.message && <p className="text-body text-muted-foreground">{result.message}</p>}
            {result.errorCode === 'NO_ACCOUNT' && (
              <div className="space-y-2 text-caption text-muted-foreground">
                {result.missingPlatforms && result.missingPlatforms.length > 0 && (
                  <p>缺账号：{result.missingPlatforms.map(platformName).join('、')}</p>
                )}
                {result.availablePlatforms && result.availablePlatforms.length > 0 && (
                  <p>已有账号：{result.availablePlatforms.map(platformName).join('、')}</p>
                )}
                <Link href="/account-pool" className="inline-flex text-primary hover:underline">
                  去账号池接入
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            )}
            {blocking.length > 0 && (
              <ul className="space-y-1 text-caption text-muted-foreground">
                {blocking.map((item, index) => (
                  <li key={`${item.code ?? 'block'}-${index}`}>
                    · {item.message ?? item.code ?? '未通过项'}
                    {item.detail ? `：${item.detail}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {result.content && (
              <div className="space-y-2 rounded-md bg-muted/30 p-3">
                <p className="text-caption text-muted-foreground">这次生成的稿（未落库）</p>
                {result.title && <p className="text-body font-medium">{result.title}</p>}
                <p className="whitespace-pre-wrap text-body leading-relaxed">{result.content}</p>
              </div>
            )}
            <Button variant="outline" onClick={generate} disabled={generating}>
              改一下需求，再试
            </Button>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-500/40">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-body font-medium">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              草稿已落库，等你确认
            </div>
            <div className="flex flex-wrap gap-3 text-caption text-muted-foreground">
              <span>状态：{result.status ?? 'draft'}</span>
              {typeof result.charCount === 'number' && <span>正文 {result.charCount} 字</span>}
              {typeof result.titleLength === 'number' && <span>标题 {result.titleLength} 字</span>}
              {typeof result.hashtagCount === 'number' && (
                <span>{result.hashtagCount} 个话题词</span>
              )}
              {result.contentCheck?.score !== undefined && (
                <span>自检 {result.contentCheck.score} 分</span>
              )}
            </div>
            {result.title && <p className="text-body font-medium">{result.title}</p>}
            {result.content && (
              <p className="line-clamp-6 whitespace-pre-wrap text-body leading-relaxed text-muted-foreground">
                {result.content}
              </p>
            )}
            {result.hashtags && result.hashtags.length > 0 && (
              <p className="text-caption text-muted-foreground">{result.hashtags.join(' ')}</p>
            )}
            {result.targets && result.targets.length > 0 && (
              <p className="text-caption text-muted-foreground">
                目标：{result.targets.map((t) => platformName(t.platform ?? '')).join('、')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={
                    result.taskId
                      ? `/publish/history?status=draft&task=${encodeURIComponent(result.taskId)}`
                      : '/publish/history?status=draft'
                  }
                >
                  去草稿箱确认
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null)
                  setBrief('')
                }}
              >
                <PenLine className="mr-1 h-4 w-4" aria-hidden />
                再写一条
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
