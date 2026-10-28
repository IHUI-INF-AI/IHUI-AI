// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP / 插件视图失败面板(PROJECT_PLAN D92,对标 G-125)。
 *
 * 取代原先的笼统"加载失败":按 15 类分类学渲染
 * `分类标题` + `错误码:{errorCode}` + `建议动作`,并**始终**给出统一恢复动作
 * `重新加载插件视图`。未知错误码走回落通用态,只说"未能判定失败原因",不猜因。
 *
 * 分类表与 D71 同源:`@ihui/shared/utils/view-failure-taxonomy`。本组件不做任何二次映射。
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CircleAlert, HelpCircle, RotateCw } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { resolveViewFailure } from '@ihui/shared/utils/view-failure-taxonomy'
import { cn } from '@/lib/utils'

export interface McpViewFailureProps {
  /** 失败源:Error / SSE 响应 json / 裸字符串均可,由 `readViewFailureSignal` 归一。 */
  error: unknown
  /** 统一恢复动作。缺省回落整页重载 —— 恢复按钮在任何分类下都不得消失或禁用。 */
  onReload?: () => void
  /** 恢复动作进行中(仅影响图标,不影响可点性之外的语义)。 */
  reloading?: boolean
  /** 失败对象上下文(如工具名 / 资源名),渲染在标题行右侧的弱文字位。 */
  context?: string
  className?: string
}

/** 回落态用中性警示图标,避免"未知"被包装成确定性结论。 */
function FailureIcon({ fallback }: { fallback: boolean }) {
  const cls = cn('h-4 w-4 shrink-0', fallback ? 'text-muted-foreground' : 'text-destructive')
  return fallback ? <HelpCircle className={cls} /> : <CircleAlert className={cls} />
}

export function McpViewFailure({
  error,
  onReload,
  reloading = false,
  context,
  className,
}: McpViewFailureProps) {
  const t = useTranslations('viewFailure')
  const resolution = React.useMemo(() => resolveViewFailure(error), [error])
  const { entry } = resolution

  const handleReload = () => {
    if (onReload) {
      onReload()
      return
    }
    window.location.reload()
  }

  return (
    <Card className={cn('overflow-hidden border-destructive/40', className)}>
      <CardContent className="min-[640px]:p-3 p-3">
        <div className="flex items-start gap-2">
          <FailureIcon fallback={resolution.isFallback} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  resolution.isFallback && 'text-muted-foreground',
                )}
              >
                {t(entry.titleKey)}
              </span>
              {context && (
                <span className="break-all font-mono text-xs text-muted-foreground">{context}</span>
              )}
            </div>

            {resolution.errorCodeText && (
              <div className="break-all font-mono text-[11px] text-muted-foreground tabular-nums">
                {t('errorCodeLabel', { errorCode: resolution.errorCodeText })}
              </div>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">{t(entry.actionKey)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleReload}>
            <RotateCw className={cn('h-3.5 w-3.5', reloading && 'animate-spin')} />
            {t(resolution.reloadKey)}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
