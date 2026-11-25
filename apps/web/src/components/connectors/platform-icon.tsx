// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Image from 'next/image'
import { BookOpen, Building2, MessageCircle, Plug } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * 连接器平台品牌图标。
 *
 * 飞书/钉钉/企微/公众号用项目已有的官方 SVG(与登录页第三方登录同一套资源),
 * 避免用 Lucide 通用图标冒充品牌 logo。未知类型回退到通用图标。
 */
const PLATFORM_SVG: Record<string, string> = {
  feishu: '/images/oauth-providers/feishu.svg',
  dingtalk: '/images/oauth-providers/dingtalk.svg',
  wecom: '/images/oauth-providers/wecom.svg',
  // 微信(Clawbot 渠道)与微信公众号复用登录页同款微信官方图标,不用喇叭等通用图标冒充。
  wechat: '/images/oauth-providers/wechat.svg',
  wechat_mp: '/images/oauth-providers/wechat.svg',
}

const FALLBACK_ICON: Record<string, LucideIcon> = {
  yuque: BookOpen,
  wecom: Building2,
  dingtalk: MessageCircle,
}

interface PlatformIconProps {
  type: string
  /** 图像边长(px),默认 20 */
  size?: number
  className?: string
}

export function PlatformIcon({ type, size = 20, className = '' }: PlatformIconProps) {
  const src = PLATFORM_SVG[type]
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
      />
    )
  }
  const Fallback = FALLBACK_ICON[type] ?? Plug
  return <Fallback className={`shrink-0 ${className}`} style={{ width: size, height: size }} />
}
