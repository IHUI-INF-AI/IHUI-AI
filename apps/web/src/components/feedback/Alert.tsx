'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  description?: React.ReactNode
  closable?: boolean
  onClose?: () => void
  action?: React.ReactNode
  className?: string
}

const variantMap: Record<
  AlertVariant,
  { icon: React.ComponentType<{ className?: string }>; class: string }
> = {
  info: { icon: Info, class: 'border-primary/30 bg-primary/5 text-primary' },
  success: {
    icon: CheckCircle,
    class: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    class: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500',
  },
  danger: { icon: XCircle, class: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-500' },
}

export function Alert({
  variant = 'info',
  title,
  description,
  closable = false,
  onClose,
  action,
  className,
}: AlertProps) {
  const t = useTranslations('a11y')
  const { icon: Icon, class: variantClass } = variantMap[variant]
  const [visible, setVisible] = React.useState(true)

  if (!visible) return null

  const handleClose = () => {
    setVisible(false)
    onClose?.()
  }

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', variantClass, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {description && (
          <p className={cn('text-sm', title && 'mt-0.5 opacity-90')}>{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('closeAlert')}
          className="shrink-0 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
