/**
 * OtpInput — 共享 OTP 验证码输入(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 * 视觉规范跟 web 端一致:
 *   - N 个独立数字框(默认 6 格)
 *   - 数字自动跳下一格,退格回上一格,粘贴自动拆分
 *   - h-11 w-10 圆角矩形,中央大号数字
 *   - focus-visible 显示 ring
 *   - role="group" + aria-label 整体描述
 */
import * as React from 'react'
import { cn } from '../../lib/utils'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  'aria-label'?: string
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  autoFocus,
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([])
  const digits = React.useMemo(() => {
    const arr = value.padEnd(length, ' ').slice(0, length).split('')
    return arr
  }, [value, length])

  const setDigit = (idx: number, ch: string) => {
    const safe = ch.replace(/\D/g, '').slice(-1)
    const next = digits.slice()
    next[idx] = safe || ' '
    onChange(next.join('').trimEnd())
  }

  const focusAt = (idx: number) => {
    const el = refs.current[idx]
    if (el) el.focus()
  }

  const handleChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw.length > 1) {
      const digitsOnly = raw.replace(/\D/g, '').slice(0, length)
      const arr = digitsOnly.padEnd(length, ' ').split('')
      onChange(arr.join('').trimEnd())
      focusAt(Math.min(digitsOnly.length, length - 1))
      return
    }
    setDigit(idx, raw)
    if (raw && idx < length - 1) focusAt(idx + 1)
  }

  const handleKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]?.trim()) {
        e.preventDefault()
        setDigit(idx, '')
        return
      }
      if (idx > 0) {
        e.preventDefault()
        focusAt(idx - 1)
        setDigit(idx - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault()
      focusAt(idx - 1)
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault()
      focusAt(idx + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const digitsOnly = text.replace(/\D/g, '').slice(0, length)
    if (!digitsOnly) return
    const arr = digitsOnly.padEnd(length, ' ').split('')
    onChange(arr.join('').trimEnd())
    focusAt(Math.min(digitsOnly.length, length - 1))
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex items-center justify-between gap-1.5', className)}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[i]?.trim() ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && i === 0} // eslint-disable-line jsx-a11y/no-autofocus
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          aria-label={`OTP ${i + 1}`}
          className={cn(
            'h-11 w-10 rounded-md border border-input bg-transparent text-center text-lg font-medium tabular-nums shadow-sm transition-colors',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            inputClassName,
          )}
        />
      ))}
    </div>
  )
}
