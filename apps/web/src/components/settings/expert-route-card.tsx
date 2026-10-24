// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// PLACEHOLDER

'use client'

/**
 * ExpertRouteCard — 设置页「专家包自动路由」三档卡片(D09,2026-10-24 立)
 *
 * 三档 = 请求字段 `expert_auto_route` 的三档(hint 默认 / auto / off),选择结果落
 * chat store(`expertAutoRoute`),由发送链透传给 ai-service,端内不重复翻译档位。
 *
 * 只读态的唯一判据是 `GET /llm/expert-route` 的 `envLocked`:部署方用
 * `IHUI_EXPERT_AUTO_ROUTE=off` 钉死时,请求字段一概被后端丢弃 —— 此时界面上还让用户
 * 拨档就是谎报可改,所以整组置灰并说明原因。取不到镜像时保持可改(不改写偏好),
 * 但也不声称"已确认可改"。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Sparkles } from 'lucide-react'

import { fetchAiServiceJson, type ExpertAutoRouteMode } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import { useChatStore } from '@/stores/chat'
import { cn } from '@/lib/utils'

/** 三档与 i18n key `settings.expertRoute.{hint|auto|off}` 对齐;hint 为后端默认档 */
const EXPERT_ROUTE_MODES: ExpertAutoRouteMode[] = ['hint', 'auto', 'off']
const DEFAULT_MODE: ExpertAutoRouteMode = 'hint'

/** ai-service 统一信封 {code,message,data};本卡片只消费 data.envLocked */
interface ExpertRouteEnvelope {
  data?: { envLocked?: boolean }
}

export function ExpertRouteCard() {
  const t = useTranslations('settings.expertRoute')
  const expertAutoRoute = useChatStore((s) => s.expertAutoRoute)
  const setExpertAutoRoute = useChatStore((s) => s.setExpertAutoRoute)
  const [envLocked, setEnvLocked] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    fetchAiServiceJson<ExpertRouteEnvelope>('/llm/expert-route')
      .then((res) => {
        if (!alive) return
        setEnvLocked(res.success && res.data?.data?.envLocked === true)
      })
      .catch(() => {
        // 取不到镜像 ⇒ 保持可改(不静默改写用户偏好,也不假装已确认锁定)
      })
    return () => {
      alive = false
    }
  }, [])

  // 未表态 = 界面显示默认档;被部署方锁死时后端只会按 off 生效,界面如实显示 off。
  const active: ExpertAutoRouteMode = envLocked ? 'off' : (expertAutoRoute ?? DEFAULT_MODE)

  return (
    <Card data-testid="expert-route-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[640px]:grid-cols-3">
          {EXPERT_ROUTE_MODES.map((m) => {
            const isActive = active === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => setExpertAutoRoute(m)}
                disabled={envLocked}
                aria-pressed={isActive}
                data-testid={`expert-route-option-${m}`}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-sm border p-3 text-sm transition-colors',
                  isActive
                    ? 'border-brand-accent-deep bg-primary/5 text-primary'
                    : 'hover:bg-accent hover:text-accent-foreground',
                  envLocked && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="flex items-center gap-1 font-medium">
                  {t(m)}
                  {isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {m === DEFAULT_MODE && expertAutoRoute === null && !envLocked && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {t('default')}
                    </span>
                  )}
                </span>
                <span className="text-center text-[11px] leading-snug text-muted-foreground">
                  {t(`${m}Desc`)}
                </span>
              </button>
            )
          })}
        </div>
        {envLocked && (
          <p role="status" className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t('envLockedNotice')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default ExpertRouteCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
