'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui'

declare global {
  interface Window {
    DDLogin?: {
      init: (options: { gotoUrl?: string; width?: number; height?: number }) => void
    }
    WwLogin?: (options: {
      id: string
      appid: string
      agentid: string
      redirect_uri: string
      state: string
      href?: string
    }) => void
  }
}

export function SdkQrLogin() {
  const t = useTranslations('auth')
  const [showDingtalkQr, setShowDingtalkQr] = React.useState(false)
  const [showEnterpriseQr, setShowEnterpriseQr] = React.useState(false)

  React.useEffect(() => {
    if (!showDingtalkQr) return
    const initDd = () => {
      if (window.DDLogin) {
        window.DDLogin.init({
          gotoUrl: window.location.origin + '/api/auth/dingtalk',
          width: 280,
          height: 280,
        })
      }
    }
    const existing = document.querySelector('script[src="/ddLogin.js"]')
    if (existing) {
      initDd()
      return
    }
    const script = document.createElement('script')
    script.src = '/ddLogin.js'
    script.async = true
    script.onload = initDd
    document.body.appendChild(script)
  }, [showDingtalkQr])

  React.useEffect(() => {
    if (!showEnterpriseQr) return
    const initWw = () => {
      if (window.WwLogin) {
        window.WwLogin({
          id: 'ww-login-container',
          appid: '',
          agentid: '',
          redirect_uri: encodeURIComponent(
            window.location.origin + '/api/auth/login/enterprise/pc/wxCode',
          ),
          state: 'enterprise_login',
        })
      }
    }
    const existing = document.querySelector('script[src="/wwLogin-1.0.0.js"]')
    if (existing) {
      initWw()
      return
    }
    const script = document.createElement('script')
    script.src = '/wwLogin-1.0.0.js'
    script.async = true
    script.onload = initWw
    script.onerror = () => {
      window.location.href = '/api/auth/login/enterprise/pc/wxCode'
    }
    document.body.appendChild(script)
  }, [showEnterpriseQr])

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowDingtalkQr((v) => !v)
            setShowEnterpriseQr(false)
          }}
        >
          {t('dingtalkLogin')}
          {t('scan')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowEnterpriseQr((v) => !v)
            setShowDingtalkQr(false)
          }}
        >
          {t('enterpriseWechat')}
          {t('scan')}
        </Button>
      </div>
      {showDingtalkQr && (
        <div className="flex flex-col items-center gap-2">
          <div id="dd-login-container" className="flex items-center justify-center" />
          <p className="text-xs text-muted-foreground">{t('dingtalkScanTip')}</p>
        </div>
      )}
      {showEnterpriseQr && (
        <div className="flex flex-col items-center gap-2">
          <div id="ww-login-container" className="flex items-center justify-center" />
          <p className="text-xs text-muted-foreground">{t('enterpriseScanTip')}</p>
        </div>
      )}
    </>
  )
}
