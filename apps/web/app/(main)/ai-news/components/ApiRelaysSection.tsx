'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ExternalLink, Zap, Building2, User, AlertTriangle, Lightbulb } from 'lucide-react'
import { COMPANY_RELAYS, PERSONAL_RELAY_NOTE } from './api-relays'
import { encodePrefill } from './vendor-platforms'

/** API 中转站区块:公司平台 + 个人运行说明 */
export function ApiRelaysSection() {
  const router = useRouter()
  const t = useTranslations('aiNews.apiRelays')

  function handleRelayImport(baseUrl: string, name: string) {
    const payload = encodePrefill({
      providerCode: 'openai',
      name: `${name} 中转`,
      baseUrlOverride: baseUrl,
      apiFormat: 'openai_chat',
    })
    router.push(`/settings/llm?prefill=${payload}`)
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="px-5 py-4">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-4 px-5 pb-5">
        {/* 公司平台性质 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold">{t('companyType')}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMPANY_RELAYS.map((relay) => (
              <div
                key={relay.name}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{relay.name}</span>
                      <a
                        href={relay.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {relay.features}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {relay.vendors.slice(0, 4).map((v) => (
                        <span
                          key={v}
                          className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                        >
                          {v}
                        </span>
                      ))}
                      {relay.vendors.length > 4 ? (
                        <span className="text-[9px] text-muted-foreground">+{relay.vendors.length - 4}</span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">{relay.billing}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRelayImport(relay.baseUrl, relay.name)}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    <span>{t('import')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 个人运行性质 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold">{t('personalType')}</h3>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="space-y-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-amber-600">{t('riskTitle')}</p>
                  <ul className="space-y-0.5">
                    {PERSONAL_RELAY_NOTE.risks.map((risk) => (
                      <li key={risk} className="text-[10px] leading-relaxed text-muted-foreground">
                        · {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-primary">{t('tipsTitle')}</p>
                  <ul className="space-y-0.5">
                    {PERSONAL_RELAY_NOTE.tips.map((tip) => (
                      <li key={tip} className="text-[10px] leading-relaxed text-muted-foreground">
                        · {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
