'use client'

import type { ThirdPartyPlatform } from '@/types/third-party'
import { WechatQrPanel } from './qr/WechatQrPanel'
import { WecomQrPanel } from './qr/WecomQrPanel'
import { DingtalkQrPanel } from './qr/DingtalkQrPanel'
import { FeishuQrPanel } from './qr/FeishuQrPanel'

type QrPlatform = 'wechat' | 'enterpriseWechat' | 'dingtalk' | 'feishu'

export interface QrCodeLoginProps {
  /** 当前选中的扫码平台(由共享 QrTab 注入) */
  platform: ThirdPartyPlatform
  /** 父组件传入,变化时重新生成二维码 */
  refreshKey: number
}

function isQrPlatform(p: ThirdPartyPlatform): p is QrPlatform {
  return p === 'wechat' || p === 'enterpriseWechat' || p === 'dingtalk' || p === 'feishu'
}

/**
 * 扫码登录:各厂商官方 SDK 内嵌二维码面板(纯渲染组件)。
 *
 * 单一职责:**只渲染当前 platform 对应的二维码面板**。
 * 平台切换 Tab / 扫码提示文字 / 操作行(刷新 + 切换登录方式)由共享 `QrTab`
 * (`@ihui/ui-react`)负责,本组件不再重复渲染这些 UI,否则会出现两套按钮 + 两套提示。
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
export function QrCodeLogin({ platform, refreshKey }: QrCodeLoginProps) {
  if (!isQrPlatform(platform)) return null
  return (
    <div className="w-full">
      {platform === 'wechat' && <WechatQrPanel refreshKey={refreshKey} />}
      {platform === 'enterpriseWechat' && <WecomQrPanel refreshKey={refreshKey} />}
      {platform === 'dingtalk' && <DingtalkQrPanel refreshKey={refreshKey} />}
      {platform === 'feishu' && <FeishuQrPanel refreshKey={refreshKey} />}
    </div>
  )
}
