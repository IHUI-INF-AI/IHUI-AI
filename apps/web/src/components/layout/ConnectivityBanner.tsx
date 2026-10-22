// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 票85③/④ —— 连通性横幅:档位来自共享层 `bannerKindFor`,本组件**不再自己判一次**。
//
// 四档(共享层唯一真源,与 RN OfflineBanner 同表):
//   none         不打扰(在线 / 尚未有结论 —— 未判定≠在线的谎由"不显示"承担);
//   slow         拿到响应但慢 ⇒ 中性提示,不红;
//   unconfirmed  探测目标不可达但设备在线 ⇒ "连不上服务器",**绝不写成"你没网"**;
//   offline      连续 N 轮全目标未答 / 设备信号确认无网 ⇒ 才写"离线"。
//
// 桌面宿主内(断网时本地能力仍在)附一行「本地 Git 通道仍可用」—— 宿主 git 三命令
// (status/diff/index)零网络依赖,票72 已实证。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CircleAlert, Gauge, WifiOff } from 'lucide-react'

import { isTauri } from '@/lib/tauri-bridge'
import { useConnectivity } from '@/hooks/use-connectivity'

const KIND_ICON = {
  offline: WifiOff,
  slow: Gauge,
  unconfirmed: CircleAlert,
} as const

const KIND_KEY = {
  offline: 'deviceOffline',
  slow: 'slow',
  unconfirmed: 'unconfirmed',
} as const

export function ConnectivityBanner() {
  const t = useTranslations('connectivity')
  // 档位来自共享层 `bannerKindFor`(经 useConnectivity 透传),字段名与 RN 端一致叫 banner
  const { banner } = useConnectivity()

  if (banner === 'none') return null

  const Icon = KIND_ICON[banner]
  const key = KIND_KEY[banner]

  return (
    <div
      role="status"
      data-testid="connectivity-banner"
      data-kind={banner}
      className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1">
        {t(key)}
        {banner !== 'slow' && isTauri() && (
          <span className="ml-1 text-amber-600/80 dark:text-amber-400/80">
            {t('hostLocalAvailable')}
          </span>
        )}
      </span>
    </div>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
