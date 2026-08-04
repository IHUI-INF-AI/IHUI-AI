'use client'

import * as React from 'react'
import { QrCode, ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '../button'
import { cn } from '../../lib/utils'
import type { QrPlatformConfig, ThirdPartyPlatform } from './types'

export interface QrTabProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /**
   * 自定义二维码组件(可选)。web 端可注入带 WxLogin/DTFrameLogin/QRLogin/wwLogin SDK 的版本;
   * extension 不传时显示默认"打开网页完成扫码"占位。
   * 接收当前选中的 platform key + refreshKey,返回 ReactNode。
   */
  QrComponent?: (props: {
    platform: ThirdPartyPlatform
    refreshKey: number
  }) => React.ReactNode
  /** 自定义平台列表(默认 4 个 wechat/wecom/dingtalk/feishu) */
  platforms?: QrPlatformConfig[]
  /** 初始选中的平台(默认 list[0]?.key;用于 URL参数 ?platform=xxx 自动选中) */
  defaultPlatform?: ThirdPartyPlatform
  /** 切换登录方式回调(默认跳到 email tab) */
  onSwitchMethod?: () => void
  className?: string
}

/** 默认 4 个扫码登录平台(对标 web 端 QrCodeLogin.tsx) */
const DEFAULT_PLATFORMS: QrPlatformConfig[] = [
  { key: 'wechat', labelKey: 'auth.wechatLogin', icon: '💬', webUrl: '/login?method=qr&platform=wechat' },
  {
    key: 'enterpriseWechat',
    labelKey: 'auth.enterpriseWechat',
    icon: '🏢',
    webUrl: '/login?method=qr&platform=enterpriseWechat',
  },
  {
    key: 'dingtalk',
    labelKey: 'auth.dingtalkLogin',
    icon: '📌',
    webUrl: '/login?method=qr&platform=dingtalk',
  },
  { key: 'feishu', labelKey: 'auth.feishuLogin', icon: '✈️', webUrl: '/login?method=qr&platform=feishu' },
]

/**
 * 扫码登录 tab(2026-07-26 抽取到共享包)
 *
 * 共享版策略(对标 web 端 QrCodeLogin.tsx):
 *   - 4 平台切换 Tab(wechat / enterpriseWechat / dingtalk / feishu)
 *   - 二维码面板:Q:web 端可注入带 SDK 的 QrComponent(微信 WxLogin.js / 钉钉 DTFrameLogin
 *     / 飞书 QRLogin / 企业微信 wwLogin),这些 SDK 不能在 extension 中使用(跨域 /
 *     iframe 限制)
 *   - 默认:显示简单占位"请使用 {平台} APP 扫描二维码登录" + QrCode 图标 + "打开网页"按钮
 *     (点击跳到 web 端 /login 完成扫码)
 *
 * 共享包关键差异(2026-07-26):
 *   - **不嵌入第三方 SDK**(SDK 跨域 / iframe 在 extension 中会失败)
 *   - 默认显示占位 + 打开网页按钮
 *   - web 端可注入 QrComponent 接管渲染逻辑,实现完全兼容旧行为
 */
export function QrTab({ t, QrComponent, platforms, defaultPlatform, onSwitchMethod, className }: QrTabProps) {
  const list = platforms ?? DEFAULT_PLATFORMS
  const [platform, setPlatform] = React.useState<ThirdPartyPlatform>(
    defaultPlatform && list.some((p) => p.key === defaultPlatform)
      ? defaultPlatform
      : list[0]?.key ?? 'wechat',
  )
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const current = list.find((p) => p.key === platform) ?? list[0]

  const handleOpenWeb = () => {
    if (!current) return
    setLoading(true)
    try {
      window.open(current.webUrl, '_blank', 'noopener,noreferrer')
    } finally {
      // 即使被 popup blocker 拦截,也不阻塞 UI
      setTimeout(() => setLoading(false), 200)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-3 pt-2 pb-0', className)}>
      {/* 平台切换 Tab */}
      <div
        role="tablist"
        aria-label={t('auth.qrLogin')}
        className="grid w-full grid-cols-4 gap-1.5 rounded-md border bg-muted/40 p-1"
      >
        {list.map((tab) => {
          const active = tab.key === platform
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`qr-tab-${tab.key}`}
              onClick={() => setPlatform(tab.key)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-[4px] px-2 py-1.5 text-xs transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              <span aria-hidden="true" className="text-sm leading-none">
                {tab.icon}
              </span>
              <span>{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>

      {/* 当前平台的二维码面板 */}
      <div className="flex w-full flex-col items-center gap-3 py-3">
        {QrComponent ? (
          <QrComponent platform={platform} refreshKey={refreshKey} />
        ) : (
          <>
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
              <QrCode className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenWeb}
              disabled={loading}
              className="h-8 text-xs"
              data-testid="qr-open-web"
            >
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              {t('common.open')}
            </Button>
          </>
        )}
      </div>

      {/* 扫码提示 */}
      <p className="text-center text-xs text-muted-foreground">
        {current
          ? t('auth.qrScanTipPlatform', { platform: t(current.labelKey) })
          : t('auth.qrScanTipPlatform', { platform: '' })}
      </p>

      {/* 操作行:刷新 + 切换登录方式 */}
      <div className="flex w-full items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          {t('auth.qrRefresh')}
        </Button>
        {onSwitchMethod && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onSwitchMethod}
            className="h-7 px-2 text-xs"
          >
            {t('auth.qrSwitchMethod')}
          </Button>
        )}
      </div>
    </div>
  )
}
