// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D94 失败诊断脱敏交接包 —— 对话流内渲染件(G-127)。
//
// **自证落点(先自证再落地)**:全仓 grep `handoff|交接单` 在 apps/packages 源码里
// **0 命中**(只剩第三方 .venv 噪声)⇒ 本卡是**新建**渲染位,不是收编既有组件;
// 判定层一律走 `@ihui/shared/chat/handoff-package`(四段 / 本地优先 / 脱敏 / 截断 /
// 降级),本文件**不写任何判据、不写任何脱敏正则**。
//
// **数据面纪律**:与 D72 `worktree-card` 同形 —— 本卡**不取数**,包由调用方注入
// (`pkg` 或原始 `ctx`,二选一),复制动作走 `onCopy` 回调(推 Server酱 / 发 Resend
// 邮件是调用方的事,卡片只把**已脱敏纯文本**交出去;AGENTS.md §5e 兜底链)。
//
// **所见即所交**:界面文案取自 `pkg`(内置中文正文),复制出去的是 `formatHandoffText(pkg)`,
// 两者同源 —— 用户看到什么,工单里就是什么,不存在"界面干净、复制出去带密钥"的分叉。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  HANDOFF_SECTION_TITLE_KEYS,
  HANDOFF_SECTIONS,
  buildHandoffPackage,
  formatHandoffText,
  type HandoffContext,
  type HandoffPackage,
  type HandoffSection,
} from '@ihui/shared/chat/handoff-package'

/** 四段 → 空态词包键(`ai.pane.handoff.empty.*`) */
const EMPTY_KEY: Partial<Record<HandoffSection, string>> = {
  fixSteps: 'empty.fixSteps',
  evidence: 'empty.evidence',
  productSurface: 'empty.productSurface',
}

export interface HandoffPackageCardProps {
  /** 已构建的交接单(优先) */
  pkg?: HandoffPackage
  /** 原始上下文;未传 `pkg` 时由本卡现场构建(调用方只给数据,判据仍在共享层) */
  ctx?: HandoffContext
  /** 复制回调:参数是**已脱敏**的可导出纯文本,可直接推通知 / 附工单 */
  onCopy?: (text: string) => void
  className?: string
  'data-testid'?: string
}

export function HandoffPackageCard({
  pkg: pkgProp,
  ctx,
  onCopy,
  className,
  'data-testid': testId,
}: HandoffPackageCardProps) {
  const t = useTranslations('ai.pane.handoff')

  const pkg = pkgProp ?? buildHandoffPackage(ctx ?? {})
  const text = React.useMemo(() => formatHandoffText(pkg), [pkg])

  const onCopyClick = React.useCallback(() => {
    // 剪贴板不可用时(jsdom / 无权限)**静默失败**,但仍要把文本交给上层兜底链
    try {
      void navigator.clipboard?.writeText(text)
    } catch {
      /* 剪贴板不可用:不阻断交接 */
    }
    onCopy?.(text)
  }, [onCopy, text])

  const renderEmpty = (section: HandoffSection) => {
    const key = EMPTY_KEY[section]
    if (!key) return null
    return (
      <p className="text-[11px] text-muted-foreground/70" data-handoff-empty={section}>
        {t(key)}
      </p>
    )
  }

  const incidentNames = pkg.productSurface.incidentsEmpty
    ? t('empty.incidents')
    : pkg.productSurface.incidents.join('、')

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-handoff-degraded={pkg.degraded}
      data-handoff-local-confirmed={pkg.diagnosis.localConfirmed}
      data-handoff-external-only={pkg.diagnosis.externalOnly}
      data-handoff-truncated={pkg.truncatedChars}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopyClick}
            aria-label={t('copy')}
            data-handoff-copy="true"
            className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('copy')}
          </button>
        ) : null}
      </div>

      {pkg.degradedNote ? (
        <p
          className="text-[11px] text-amber-600 dark:text-amber-500"
          data-handoff-degraded-note="true"
        >
          {t('degraded')}
        </p>
      ) : null}

      {HANDOFF_SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1" data-handoff-section={section}>
          <span className="text-[11px] font-medium" data-handoff-section-title={section}>
            {t(HANDOFF_SECTION_TITLE_KEYS[section])}
          </span>

          {section === 'diagnosis' ? (
            <>
              <p className="text-[11px]" data-handoff-method="true">
                {pkg.diagnosis.method}
              </p>
              {pkg.diagnosis.lines.map((line, index) => (
                <p
                  key={`${line.source}-${index}`}
                  className="text-[11px] text-muted-foreground"
                  data-handoff-line={index}
                  data-handoff-line-source={line.source}
                >
                  {`[${line.source === 'local' ? t('source.local') : t('source.external')}] ${line.text}`}
                </p>
              ))}
              {pkg.diagnosis.caveat ? (
                <p className="text-[11px] text-muted-foreground/70" data-handoff-caveat="true">
                  {t('externalCaveat')}
                </p>
              ) : null}
            </>
          ) : null}

          {section === 'fixSteps' ? (
            pkg.fixSteps.empty ? (
              renderEmpty('fixSteps')
            ) : (
              pkg.fixSteps.lines.map((line, index) => (
                <p
                  key={index}
                  className="text-[11px] text-muted-foreground"
                  data-handoff-fix-step={index}
                >
                  {line}
                </p>
              ))
            )
          ) : null}

          {section === 'evidence' ? (
            pkg.evidence.empty ? (
              renderEmpty('evidence')
            ) : (
              pkg.evidence.lines.map((line, index) => (
                <p
                  key={index}
                  className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground"
                  data-handoff-evidence={index}
                  data-handoff-evidence-label={line.label}
                  data-handoff-evidence-truncated={line.truncatedChars}
                >
                  {`${line.label}：${line.text}`}
                  {line.truncatedChars > 0 ? ` (${t('truncated', { count: line.truncatedChars })})` : ''}
                </p>
              ))
            )
          ) : null}

          {section === 'productSurface' ? (
            <>
              {pkg.productSurface.empty
                ? renderEmpty('productSurface')
                : pkg.productSurface.lines.map((line, index) => (
                    <p
                      key={index}
                      className="text-[11px] text-muted-foreground"
                      data-handoff-surface={index}
                    >
                      {line}
                    </p>
                  ))}
              <p
                className="text-[11px] text-muted-foreground"
                data-handoff-incident-line="true"
                data-handoff-incidents-empty={pkg.productSurface.incidentsEmpty}
              >
                {t('incidentLine', { incidentNames })}
              </p>
            </>
          ) : null}
        </section>
      ))}

      <p className="text-[11px] text-muted-foreground/70" data-handoff-redacted="true">
        {t('redacted')}
      </p>
    </div>
  )
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
