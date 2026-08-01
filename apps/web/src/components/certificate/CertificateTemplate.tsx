'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

/**
 * CertificateTemplate — 证书视觉模板(紧凑 / 古典 双变体)
 *
 * 设计目标:
 *  1. 4:3 比例(aspect-[4/3])+ 适配 A4 横向打印(@page size landscape via window.print)
 *  2. 纯 CSS + SVG 印章(无外部资源)
 *  3. 暗色模式通过 Tailwind dark: 变量反转
 *  4. i18n 5 语言全 parity(certificate.detail.*)
 *  5. 零 `rounded-full` / 渐变遮罩 / 单边 border(AGENTS.md §4)
 *
 * Props:
 *  - variant: 'compact' | 'classical'(默认 compact)
 *  - certificateNo / title / recipientName / issuedAt / issuer / awarderName
 *  - issuingOrganization / awardConditions / validityPolicy
 *  - showActions: 是否渲染操作按钮(打印 / 下载),默认 false
 *  - className: 透传外层样式
 *
 * 用法:
 *  <CertificateTemplate
 *    variant="compact"
 *    certificateNo="IHUI-2026-0001"
 *    title="LangGraph 实战"
 *    recipientName="张三"
 *    issuedAt="2026-07-28T00:00:00Z"
 *    issuingOrganization="IHUI AI 学院"
 *    awarderName="院长 · 学术委员会"
 *    awardConditions="完成课程全部章节学习并通过期末考核(≥ 60 分)"
 *    validityPolicy="永久有效"
 *  />
 */
export type CertificateVariant = 'compact' | 'classical'

export interface CertificateTemplateProps {
  variant?: CertificateVariant
  certificateNo?: string
  title: string
  recipientName: string
  /** ISO 字符串 / Date / 数字时间戳 */
  issuedAt?: string | number | Date | null
  issuingOrganization?: string
  awarderName?: string
  awardConditions?: string
  validityPolicy?: string
  /** 是否显示操作按钮(打印 / 下载) */
  showActions?: boolean
  className?: string
}

const SEAL_PATH_D =
  // 中心字母 H(IHUI) — SVG path,20x20 网格
  'M7 4h2v5h2V4h2v12h-2V11H9v5H7V4z'

export const CertificateTemplate = React.forwardRef<HTMLDivElement, CertificateTemplateProps>(
  function CertificateTemplate(props, ref) {
    const {
      variant = 'compact',
      certificateNo,
      title,
      recipientName,
      issuedAt,
      issuingOrganization: awardingOrganization,
      awarderName,
      awardConditions: _awardConditions,
      validityPolicy,
      showActions = false,
      className,
    } = props

    const t = useTranslations('certificate.detail')

    const onPrint = React.useCallback(() => {
      if (typeof window !== 'undefined') window.print()
    }, [])

    const isClassical = variant === 'classical'
    // 古典版:更厚的装饰边 + 双印章 + 大字号
    const ringWidth = isClassical ? 3 : 2
    const innerPad = isClassical ? 'p-12' : 'p-10'
    const titleSize = isClassical ? 'text-2xl min-[768px]:text-3xl' : 'text-2xl'

    return (
      <div className={cn('flex flex-col items-center gap-4', className)}>
        <div
          ref={ref}
          data-certificate-root
          data-variant={variant}
          className={cn(
            'relative w-full max-w-3xl overflow-hidden rounded-lg bg-card text-card-foreground shadow-md print:shadow-none',
            'aspect-[4/3]',
          )}
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* 外框(AGENTS.md §4 允许 border,禁止单边) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg border-2 border-foreground/20 dark:border-foreground/30"
            style={{ borderWidth: ringWidth }}
          />
          {/* 内框(古典版双框) */}
          {isClassical && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3 rounded-md border border-foreground/15"
            />
          )}

          {/* 顶部装饰线 */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-0 h-1 bg-foreground/70 dark:bg-foreground/60"
          />

          <div className={cn('relative h-full w-full', innerPad, 'flex flex-col')}>
            {/* Header:CERTIFICATE 字样 + 编号 */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p
                  className="text-xs font-medium uppercase tracking-[0.4em] text-muted-foreground"
                  aria-hidden
                >
                  CERTIFICATE
                </p>
                <h1
                  className={cn(
                    'font-serif font-bold leading-tight tracking-tight text-foreground',
                    titleSize,
                  )}
                >
                  {t('headerTitle')}
                </h1>
              </div>
              {certificateNo && (
                <p className="text-right text-xs text-muted-foreground">
                  <span className="block uppercase tracking-wider">{t('certNo')}</span>
                  <span className="font-mono text-sm text-foreground">{certificateNo}</span>
                </p>
              )}
            </div>

            {/* 课程标题 */}
            <div className="mt-6 space-y-1 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {t('courseLabel')}
              </p>
              <h2
                className={cn(
                  'mx-auto max-w-2xl font-serif font-semibold text-foreground',
                  isClassical ? 'text-2xl' : 'text-xl',
                )}
              >
                {title}
              </h2>
            </div>

            {/* 获得者 */}
            <div className="mt-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {t('recipientLabel')}
              </p>
              <p
                className={cn(
                  'mt-2 font-serif font-bold text-foreground',
                  isClassical ? 'text-4xl' : 'text-3xl',
                )}
              >
                {recipientName}
              </p>
            </div>

            {/* 颁发机构 + 颁发人 + 印章 */}
            <div className="mt-auto flex items-end justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1.5 text-xs text-muted-foreground">
                {awardingOrganization && (
                  <p className="font-medium text-foreground">{awardingOrganization}</p>
                )}
                {awarderName && (
                  <p>
                    <span className="text-muted-foreground">{t('awarderLabel')}:</span>{' '}
                    {awarderName}
                  </p>
                )}
                {issuedAt && (
                  <p>
                    <span className="text-muted-foreground">{t('issueDate')}:</span>{' '}
                    {formatDate(issuedAt)}
                  </p>
                )}
                {validityPolicy && (
                  <p>
                    <span className="text-muted-foreground">{t('validityLabel')}:</span>{' '}
                    {validityPolicy}
                  </p>
                )}
                {awardingOrganization && (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                    © {new Date().getFullYear()} {awardingOrganization}
                  </p>
                )}
              </div>

              {/* 印章(SVG 圆形 + 中心 H 字 + 外圈文字) */}
              <CertificateSeal
                size={isClassical ? 96 : 80}
                orgShort={awardingOrganization?.slice(0, 6) ?? 'IHUI'}
              />
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={onPrint}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <Award className="h-4 w-4" />
              <span>{t('printAction')}</span>
            </button>
          </div>
        )}

        {awardingOrganization && (
          <p className="sr-only">
            {t('issuerAria', { org: awardingOrganization, name: recipientName })}
          </p>
        )}
      </div>
    )
  },
)

/* -------------------------------------------------------------------------- */
/*  印章 — 纯 SVG,内嵌使用不依赖外部资源                                    */
/* -------------------------------------------------------------------------- */

interface CertificateSealProps {
  size?: number
  orgShort?: string
}

function CertificateSeal({ size = 80, orgShort = 'IHUI' }: CertificateSealProps) {
  const r = 50
  const center = 50
  return (
    <svg
      role="img"
      aria-label="Official seal"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0 text-foreground/70 dark:text-foreground/60"
    >
      <defs>
        <path
          id="seal-circle-path"
          d={`M ${center},${center} m -${r - 8},0 a ${r - 8},${r - 8} 0 1,1 ${(r - 8) * 2},0 a ${
            r - 8
          },${r - 8} 0 1,1 -${(r - 8) * 2},0`}
          fill="none"
        />
      </defs>
      {/* 外圈 */}
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      {/* 内圈 */}
      <circle
        cx={center}
        cy={center}
        r={r - 6}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {/* 外圈文字(机构缩写,环绕) */}
      <text
        fill="currentColor"
        fontSize={9}
        fontFamily="serif"
        fontWeight="600"
        letterSpacing="2"
      >
        <textPath href="#seal-circle-path" startOffset="0%">
          {`★ ${orgShort} ★ OFFICIAL SEAL ★ ${orgShort} ★`}
        </textPath>
      </text>
      {/* 中心 H 字标 */}
      <g transform={`translate(${center - 10},${center - 10})`}>
        <path d={SEAL_PATH_D} fill="currentColor" />
      </g>
      {/* 底部 ISSUE DATE 标签 */}
      <text
        x={center}
        y={center + 22}
        textAnchor="middle"
        fontSize={6}
        fill="currentColor"
        letterSpacing="1"
      >
        AWARDED
      </text>
    </svg>
  )
}
