// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池选号策略档只读卡片(2026-10-29 立,台账 O93 的前端消费腿)。
 *
 * 八枚 IHUI_RELAY_POOL_* 此前只能靠读源码发现:运营在面板上看不到"当前生效的是哪一档、
 * 哪枚偏离了默认、哪枚在 .env 里写了代码认不出的形态而回落了默认"。
 * 卡片**只提供读面**:env 由 api 进程启动时读入,改完必须重启进程,面板给一个写入按钮
 * 就是"改了不生效"的假旋钮,所以刻意不做。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

interface PoolPolicyKnob {
  name: string
  envKey: string
  effective: unknown
  defaultValue: unknown
  differsFromDefault: boolean
  invalidEnv: boolean
  description: string
}

interface PoolPolicyView {
  knobs: PoolPolicyKnob[]
  registryComplete: boolean
  missingKnobs: string[]
  orphanKnobs: string[]
  deviatedKnobs: number
  invalidEnvKnobs: number
  allDefault: boolean
  mutable: boolean
  hint: string
}

async function fetchPoolPolicy(): Promise<PoolPolicyView> {
  return apiOrThrow<PoolPolicyView>('/api/admin/relay/pool-policy')
}

/** 生效值渲染:null/boolean/number 都要可读,不许渲染成空字符串冒充"没值" */
function fmtValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

export function RelayPoolPolicyCard() {
  const t = useTranslations('admin.relayPoolPolicy')
  const q = useQuery({
    queryKey: ['relay-pool-policy'],
    queryFn: fetchPoolPolicy,
    staleTime: 30_000,
  })
  const data = q.data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
          >
            {q.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            {t('refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <p className="text-muted-foreground text-sm">
            {q.isError ? `${t('loadFailed')}: ${q.error.message}` : t('loading')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  'inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none tabular-nums ' +
                  (data.allDefault
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-amber-500/15 text-amber-600')
                }
              >
                {data.allDefault
                  ? t('badgeAllDefault')
                  : t('badgeDeviated', { n: data.deviatedKnobs })}
              </span>
              {data.invalidEnvKnobs > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center gap-1 rounded-md bg-red-500/15 px-1 text-[10px] font-semibold leading-none tabular-nums text-red-600">
                  <AlertTriangle className="size-3" aria-hidden />
                  {t('badgeInvalid', { n: data.invalidEnvKnobs })}
                </span>
              )}
              {!data.registryComplete && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500/15 px-1 text-[10px] font-semibold leading-none text-red-600">
                  {t('badgeRegistryBroken')}
                </span>
              )}
              <span className="text-muted-foreground text-xs">{t('readOnlyHint')}</span>
            </div>

            <div className="rounded-lg border">
              {data.knobs.map((k) => (
                <div
                  key={k.name}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <code className="text-muted-foreground min-w-40 text-xs">{k.envKey}</code>
                  {/* 等分格里的读数必须单行:偏离/脏值标记不能把数值挤成折行 */}
                  <span className="font-medium tabular-nums" style={{ flexShrink: 0 }}>
                    {fmtValue(k.effective)}
                  </span>
                  {k.differsFromDefault && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {t('defaultIs', { v: fmtValue(k.defaultValue) })}
                    </span>
                  )}
                  {k.invalidEnv && (
                    <span className="text-xs text-red-600 tabular-nums">
                      {t('invalidFellBack')}
                    </span>
                  )}
                  <span className="text-muted-foreground min-w-40 flex-1 text-xs">
                    {k.description}
                  </span>
                </div>
              ))}
            </div>

            {(data.missingKnobs.length > 0 || data.orphanKnobs.length > 0) && (
              <p className="text-sm text-red-600">
                {t('registryDiff', {
                  missing: data.missingKnobs.join(', ') || '—',
                  orphan: data.orphanKnobs.join(', ') || '—',
                })}
              </p>
            )}

            {/* 生效方式说明由后端单源给出(env 名与重启要求不许在两端各写一份) */}
            <p className="text-muted-foreground text-xs">{data.hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
