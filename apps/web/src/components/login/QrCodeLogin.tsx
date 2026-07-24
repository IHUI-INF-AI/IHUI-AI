'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { WechatQrPanel } from './qr/WechatQrPanel'
import { WecomQrPanel } from './qr/WecomQrPanel'
import { DingtalkQrPanel } from './qr/DingtalkQrPanel'
import { FeishuQrPanel } from './qr/FeishuQrPanel'

type QrPlatform = 'wechat' | 'enterpriseWechat' | 'dingtalk' | 'feishu'

interface PlatformTab {
  key: QrPlatform
  labelKey: 'wechatLogin' | 'enterpriseWechat' | 'dingtalkLogin' | 'feishuLogin'
  icon: string
}

const PLATFORM_TABS: PlatformTab[] = [
  { key: 'wechat', labelKey: 'wechatLogin', icon: '/images/oauth-providers/wechat.svg' },
  { key: 'enterpriseWechat', labelKey: 'enterpriseWechat', icon: '/images/oauth-providers/wecom.svg' },
  { key: 'dingtalk', labelKey: 'dingtalkLogin', icon: '/images/oauth-providers/dingtalk.svg' },
  { key: 'feishu', labelKey: 'feishuLogin', icon: '/images/loginSANFANG/feishu.png' },
]

/**
 * 扫码登录:平台切换 Tab + 各厂商官方 SDK 内嵌二维码。
 *
 * 支持 4 个平台:
 * - 微信(WxLogin.js)→ 扫码后整页跳 /callback?platform=wechat
 * - 企业微信(wwLogin)→ 扫码后整页跳 /callback?platform=enterpriseWechat
 * - 钉钉(DTFrameLogin)→ 扫码后 postMessage 通知,前端 router.push 到 /callback
 * - 飞书(QRLogin)→ 扫码后整页跳 /callback?platform=feishu
 *
 * 各厂商未配置(appId / agentId / redirectUri 任一缺失)时显示"未配置"提示,
 * 不会渲染二维码。
 */
export function QrCodeLogin({ onSwitchMethod }: { onSwitchMethod?: () => void }) {
  const t = useTranslations('auth')
  const [platform, setPlatform] = React.useState<QrPlatform>('wechat')
  const [refreshKey, setRefreshKey] = React.useState(0)

  const handleRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <div className="flex flex-col items-center gap-3 pt-2 pb-0">
      {/* 平台切换 Tab */}
      <div
        role="tablist"
        aria-label={t('qrLogin')}
        className="grid w-full grid-cols-4 gap-1.5 rounded-md border bg-muted/40 p-1"
      >
        {PLATFORM_TABS.map((tab) => {
          const active = tab.key === platform
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`qr-tab-${tab.key}`}
              onClick={() => setPlatform(tab.key)}
              className={[
                'flex items-center justify-center gap-1.5 rounded-[4px] px-2 py-1.5 text-xs transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              ].join(' ')}
            >
              <Image
                src={tab.icon}
                alt=""
                aria-hidden="true"
                width={14}
                height={14}
                className="h-[14px] w-[14px] shrink-0"
              />
              <span>{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>

      {/* 当前平台的二维码面板 */}
      <div className="w-full">
        {platform === 'wechat' && <WechatQrPanel refreshKey={refreshKey} />}
        {platform === 'enterpriseWechat' && <WecomQrPanel refreshKey={refreshKey} />}
        {platform === 'dingtalk' && <DingtalkQrPanel refreshKey={refreshKey} />}
        {platform === 'feishu' && <FeishuQrPanel refreshKey={refreshKey} />}
      </div>

      {/* 操作行:刷新 + 切换登录方式 */}
      <div className="flex w-full items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          {t('qrRefresh')}
        </Button>
        {onSwitchMethod && (
          <Button type="button" variant="link" size="sm" onClick={onSwitchMethod} className="h-7 px-2 text-xs">
            {t('qrSwitchMethod')}
          </Button>
        )}
      </div>

      {/* 扫码提示 */}
      <p className="text-center text-xs text-muted-foreground">
        {t('qrScanTipPlatform', { platform: t(`${PLATFORM_TABS.find((p) => p.key === platform)?.labelKey}`) })}
      </p>
    </div>
  )
}
