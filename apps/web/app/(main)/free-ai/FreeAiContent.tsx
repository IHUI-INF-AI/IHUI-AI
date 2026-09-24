// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 免费开始使用 AI — 零 Key 引导页(P3 3-4 B 档,2026-09-17 立)。
 *
 * 三条路径卡:云免费档(国内:硅基流动/智谱;海外:Groq)/ 本地 OLLAMA(桌面端,零网络)/
 * 每卡含步骤 + 官网外链 + key 填写入口(/settings 或 /models)。
 * A 档(平台内置试用额度)属商务决策,未含在本页(见 PROJECT_PLAN 3-4)。
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Cloud, Cpu, ExternalLink, KeyRound, Rocket, ShieldCheck } from 'lucide-react'

interface PathCard {
  icon: 'cloud' | 'cpu'
  titleKey: string
  descKey: string
  steps: string[]
  linkUrl: string
  linkLabelKey: string
  afterKey: string
}

const CARDS: PathCard[] = [
  {
    icon: 'cloud',
    titleKey: 'card1Title',
    descKey: 'card1Desc',
    steps: ['card1Step1', 'card1Step2', 'card1Step3'],
    linkUrl: 'https://cloud.siliconflow.cn',
    linkLabelKey: 'card1Link',
    afterKey: 'afterFillKey',
  },
  {
    icon: 'cloud',
    titleKey: 'card2Title',
    descKey: 'card2Desc',
    steps: ['card2Step1', 'card2Step2', 'card2Step3'],
    linkUrl: 'https://console.groq.com',
    linkLabelKey: 'card2Link',
    afterKey: 'afterFillKey',
  },
  {
    icon: 'cpu',
    titleKey: 'card3Title',
    descKey: 'card3Desc',
    steps: ['card3Step1', 'card3Step2'],
    linkUrl: 'https://ollama.com',
    linkLabelKey: 'card3Link',
    afterKey: 'afterLocal',
  },
]

export function FreeAiContent() {
  const t = useTranslations('freeAi')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10" data-testid="free-ai-page">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-cta/10 px-3 py-1 text-xs font-medium text-primary">
          <Rocket className="h-3.5 w-3.5" />
          {t('heroBadge')}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heroTitle')}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t('heroSub')}
        </p>
      </div>

      {/* 三条路径 */}
      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.titleKey} className="flex flex-col rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              {card.icon === 'cloud' ? (
                <Cloud className="h-5 w-5 text-primary" />
              ) : (
                <Cpu className="h-5 w-5 text-primary" />
              )}
              <h2 className="text-sm font-semibold">{t(card.titleKey)}</h2>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
            <ol className="mb-4 flex-1 space-y-2">
              {card.steps.map((step) => (
                <li key={step} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold">
                    {card.steps.indexOf(step) + 1}
                  </span>
                  <span className="text-muted-foreground">{t(step)}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-2">
              <a
                href={card.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t(card.linkLabelKey)}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
                {t(card.afterKey)}
                <Link href="/settings" className="shrink-0 text-primary hover:underline">
                  {t('goSettings')}
                </Link>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 免责/安全说明 */}
      <div className="mt-8 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p>{t('securityNote')}</p>
      </div>

      {/* 完成后 */}
      <div className="mt-6 text-center">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 rounded-md bg-cta px-4 py-2 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta/90"
        >
          <Rocket className="h-4 w-4" />
          {t('startChat')}
        </Link>
      </div>
    </div>
  )
}

export default FreeAiContent
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
