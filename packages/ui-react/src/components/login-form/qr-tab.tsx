/**
 * QrCodeLogin — 共享扫码登录占位(2026-07-26 立)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件。
 *
 * 重要:web 端扫码登录依赖 4 个厂商官方 SDK(微信 WxLogin.js / 企业微信 wwLogin
 * / 钉钉 DTFrameLogin / 飞书 QRLogin),每个 SDK 都要在客户端动态注入 script,
 * 复杂度高且无法在扩展端 popup/sidepanel 复用(扩展端 browser_action 不允许
 * 加载外网 SDK,需走 OAuth 跳转)。
 *
 * 设计决策:
 *   - web 端继续用本地 QrCodeLogin(含厂商 SDK 加载),通过 `<LoginForm qrComponent={...}>` 注入
 *   - 共享包提供 default QrCodeLogin 组件作为占位/通用版
 *   - 扩展端如果启用 qr tab,显示简洁的"打开网页版扫码"按钮,引导去 web 端
 *
 * 默认 QrCodeLogin 视觉:
 *   - 居中图标 + 标题
 *   - 提示文案
 *   - "打开网页版扫码"按钮
 */
import { QrCode } from 'lucide-react'
import { Button } from '../../index'
import type { TFunc } from './types'

interface QrCodeLoginProps {
  t: TFunc
  /** "打开网页版扫码"按钮回调(扩展端跳网页版) */
  onOpenWeb?: () => void
}

export function QrCodeLogin({ t, onOpenWeb }: QrCodeLoginProps) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 pb-0" data-testid="qr-code-login">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <QrCode className="h-6 w-6" strokeWidth={2} />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {t('auth.qrLogin')}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {t('auth.qrScanTipPlatform', { platform: t('auth.qrLogin') })}
      </p>
      {onOpenWeb && (
        <Button
          type="button"
          variant="outline"
          className="h-9 px-3 text-sm"
          onClick={onOpenWeb}
          data-testid="qr-open-web"
        >
          {t('auth.qrSwitchMethod')}
        </Button>
      )}
    </div>
  )
}
