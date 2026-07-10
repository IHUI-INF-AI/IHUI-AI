'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

type Provider = {
  key: string
  label: string
  /** OAuth2 重定向入口（相对路径，由后端代理到各厂商授权页） */
  href: string
  /** 未配置时禁用 */
  configuredKey?: 'google' | 'wechat' | 'enterprise'
}

/**
 * 第三方登录按钮群：Google / Apple / 钉钉 / 企业微信 / GitHub。
 * 全部走 OAuth2 重定向（window.location.href 由后端代理至各厂商授权页）。
 */
export function ThirdPartyLoginButtons() {
  const t = useTranslations('auth')

  // Google 登录是否已在后端配置
  const [googleConfigured, setGoogleConfigured] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    let active = true
    void fetch('/api/auth/google/config')
      .then((r) => r.json())
      .then((j: { code: number; data?: { configured: boolean } }) => {
        if (active) setGoogleConfigured(j.code === 0 && !!j.data?.configured)
      })
      .catch(() => active && setGoogleConfigured(false))
    return () => {
      active = false
    }
  }, [])

  const redirect = (url: string) => {
    if (typeof window !== 'undefined') window.location.href = url
  }

  const providers: Provider[] = [
    {
      key: 'google',
      label: t('googleLogin'),
      href: '/api/auth/google',
      configuredKey: 'google',
    },
    { key: 'apple', label: 'Apple', href: '/api/auth/apple' },
    { key: 'dingtalk', label: t('dingtalkLogin'), href: '/api/auth/dingtalk' },
    { key: 'enterprise', label: t('enterpriseWechat'), href: '/api/auth/login/enterprise/pc/wxCode' },
    { key: 'wechat', label: t('wechatLogin'), href: '/api/auth/wechat/mini/login' },
    { key: 'github', label: 'GitHub', href: '/api/auth/github' },
  ]

  return (
    <>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('thirdPartyLogin')}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {providers.map((p) => {
          const disabled = p.configuredKey === 'google' && googleConfigured === false
          return (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => redirect(p.href)}
              title={disabled ? t('googleNotConfigured') : undefined}
            >
              {p.label}
            </Button>
          )
        })}
      </div>
    </>
  )
}
