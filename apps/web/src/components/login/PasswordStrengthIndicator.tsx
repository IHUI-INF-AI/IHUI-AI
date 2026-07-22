'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

/**
 * 密码强度实时检测（移植自 usePasswordStrength.ts）。
 * 评分维度：长度 / 小写 / 大写 / 数字 / 特殊字符，常见弱密码与重复字符扣分。
 */
export interface PasswordStrength {
  score: number // 0-4
  feedback: string[]
  suggestions: string[]
}

const commonPatterns = [/123456/, /password/i, /qwerty/i, /abc123/i, /111111/, /000000/]

export function calculateStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, feedback: [], suggestions: [] }

  let score = 0
  const suggestions: string[] = []

  if (password.length >= 8) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1

  if (commonPatterns.some((p) => p.test(password))) score = Math.max(0, score - 2)
  if (/(.)\1{2,}/.test(password)) score = Math.max(0, score - 1)

  score = Math.min(4, score)
  return { score, feedback: [], suggestions }
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const t = useTranslations('auth')
  const { score } = calculateStrength(password)
  if (!password) return null

  const level = score < 2 ? 'weak' : score < 4 ? 'medium' : 'strong'
  const width = (score / 4) * 100
  const label =
    level === 'weak'
      ? t('passwordWeak')
      : level === 'medium'
        ? t('passwordMedium')
        : t('passwordStrong')
  const color =
    level === 'weak'
      ? 'bg-red-500 text-red-600'
      : level === 'medium'
        ? 'bg-amber-500 text-amber-600'
        : 'bg-emerald-500 text-emerald-600'

  return (
    <div className="mt-1.5 flex items-center gap-3">
      <div
        data-slot="strength-track"
        className="h-1 flex-1 overflow-hidden rounded bg-muted"
      >
        <div
          className={`h-full rounded-md transition-all ${color.split(' ')[0]}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-xs whitespace-nowrap ${color.split(' ')[1]}`}>{label}</span>
    </div>
  )
}
