// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ThirdPartyPlatform } from '@ihui/types'
import { QR_PANEL_STATE_BOX, WechatQrPanel } from './qr/WechatQrPanel'
import { WecomQrPanel } from './qr/WecomQrPanel'
import { DingtalkQrPanel } from './qr/DingtalkQrPanel'
import { FeishuQrPanel } from './qr/FeishuQrPanel'
import { AppQrPanel } from './qr/AppQrPanel'

type QrPlatform = 'wechat' | 'enterpriseWechat' | 'dingtalk' | 'feishu' | 'app'

export interface QrCodeLoginProps {
  /** 当前选中的扫码平台(由共享 QrTab 注入) */
  platform: ThirdPartyPlatform
  /** 父组件传入,变化时重新生成二维码 */
  refreshKey: number
  /**
   * 嵌入模式(mobile-rn WebView/iframe 加载时使用):
   * - 去掉各 QrPanel 根容器的 border(黑色线框),避免 iframe 内出现双重边框
   * - 去掉 bg-card 背景,保持 iframe 透明
   */
  embed?: boolean
}

function isQrPlatform(p: ThirdPartyPlatform): p is QrPlatform {
  return (
    p === 'wechat' || p === 'enterpriseWechat' || p === 'dingtalk' || p === 'feishu' || p === 'app'
  )
}

/**
 * 扫码登录:各厂商官方 SDK 内嵌二维码面板(纯渲染组件)。
 *
 * 单一职责:**只渲染当前 platform 对应的二维码面板**。
 * 平台切换 Tab / 扫码提示文字 / 操作行(刷新 + 切换登录方式)由共享 `QrTab`
 * (`@ihui/ui-react`)负责,本组件不再重复渲染这些 UI,否则会出现两套按钮 + 两套提示。
 *
 * 支持 5 个平台:
 * - 本站 App(POST /qr/generate + GET /qr/status 轮询)→ 扫码后直接拿到 token
 * - 微信(WxLogin.js)→ 扫码后整页跳 /callback?platform=wechat
 * - 企业微信(wwLogin)→ 扫码后整页跳 /callback?platform=enterpriseWechat
 * - 钉钉(DTFrameLogin)→ 扫码后 postMessage 通知,前端 router.push 到 /callback
 * - 飞书(QRLogin)→ 扫码后整页跳 /callback?platform=feishu
 *
 * 各厂商未配置(appId / agentId / redirectUri 任一缺失)时显示"未配置"提示,
 * 不会渲染二维码。
 */
export function QrCodeLogin({ platform, refreshKey, embed = false }: QrCodeLoginProps) {
  // 协议同意采集:扫码 tab 不触发"提交",共享 LoginForm 的协议通道覆盖不到,
  // 于是停在扫码面板的访客从未同意条款。2026-11-11 机主决定:**不再自动弹模态框**,
  // 改为扫码面板内联一行"同意并继续"(含协议/隐私链接),用户主动点过才渲染二维码。
  // 本站 App 面板仍把同意写进后端扫码会话(唯一真相源),由 /qr/confirm 与
  // /qr/status 校验后才会发 token。
  const t = useTranslations()
  const [agreed, setAgreed] = React.useState(false)

  if (!isQrPlatform(platform)) return null

  const handleAgree = () => {
    setAgreed(true)
  }

  return (
    <div className={embed ? 'w-full [&>div]:!border-0 [&>div]:!bg-transparent' : 'w-full'}>
      {agreed ? (
        <>
          {platform === 'app' && <AppQrPanel refreshKey={refreshKey} agreementAccepted />}
          {platform === 'wechat' && <WechatQrPanel refreshKey={refreshKey} />}
          {platform === 'enterpriseWechat' && <WecomQrPanel refreshKey={refreshKey} />}
          {platform === 'dingtalk' && <DingtalkQrPanel refreshKey={refreshKey} />}
          {platform === 'feishu' && <FeishuQrPanel refreshKey={refreshKey} />}
        </>
      ) : (
        <div className={`${QR_PANEL_STATE_BOX} gap-3`}>
          <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
          <p className="max-w-[280px] text-center text-body text-muted-foreground">
            {t('auth.agreementNoticeDesc')}
          </p>
          <div className="flex items-center justify-center gap-2 text-label">
            <a
              href="/agreement/user-agreement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary transition-colors hover:underline"
            >
              {t('auth.termsOfService')}
            </a>
            <span className="text-muted-foreground/60" aria-hidden="true">
              ·
            </span>
            <a
              href="/agreement/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary transition-colors hover:underline"
            >
              {t('auth.privacyPolicy')}
            </a>
          </div>
          <button
            type="button"
            data-testid="qr-agreement-agree"
            onClick={handleAgree}
            className="inline-flex items-center rounded-sm border border-border bg-background px-3 py-1.5 text-label font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t('auth.agreementNoticeAgree')}
          </button>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
