// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { StyleSheet, Text, View } from 'react-native'
import { WifiOff, Wifi, HelpCircle } from 'lucide-react-native'
import { rnTokens } from '@ihui/design-tokens'
import type { ConnectivityBannerKind, ConnectivityReason } from '@ihui/shared/utils/connectivity'
import { useI18n } from '../i18n'

/**
 * 顶部网络横幅(台账 G-1113920 改为分档、fail-visible)。
 *
 * 旧形态是「`isOnline` 为 false 就亮红写网络已断开」—— 把"我们的服务器没答"和"这台设备没网"
 * 渲染成同一句话。现在横幅只按共享层给出的档位说话,四种结论四种可见形态:
 * - `offline`     红色 + 「网络已断开」——**只有**判据确认无网才走到这里。
 * - `slow`        琥珀 + 「网络较慢」——收到了应答但耗时超阈,慢网 ≠ 断网。
 * - `unconfirmed` 中性 + 「暂时无法确认网络状态」——未判定就是未判定,不得冒红称已确认离线
 *                  (典型:目标不可达但设备侧证据/旁证显示有网,或探测机制本身跑不动)。
 * - `none`        不渲染(在线,或冷启动/抖动等下一轮复探,不打扰用户)。
 *
 * 文案一律走 i18n 五语言(AGENTS §30:新增状态词汇必须同批补齐,否则端上一半语言显示键名)。
 */
export interface OfflineBannerProps {
  /** 横幅档位;缺省视为 `none`(不渲染)。 */
  banner?: ConnectivityBannerKind
  /** 结论来历,用于在 `unconfirmed` 档区分"服务器没答"与"探测跑不动"。 */
  reason?: ConnectivityReason
}

export function OfflineBanner({ banner = 'none', reason }: OfflineBannerProps) {
  const { t } = useI18n()
  if (banner === 'none') return null

  if (banner === 'slow') {
    return (
      <View style={styles.wrapper} accessibilityRole="alert">
        <View style={styles.pill}>
          <Wifi size={16} color={rnTokens.warning.amberText} />
          <Text style={styles.slowText}>{t('network.slow')}</Text>
        </View>
      </View>
    )
  }

  if (banner === 'unconfirmed') {
    // 说清是哪一格没判到:是服务器侧没答(probe-target-unreachable),还是探测本身跑不动。
    // 两条键必须各有**字面**发射点:先把键名存进变量再 t(key) 会让取词审计看不见这一格,
    // 端上的表现是"键在语言包里、屏幕上永远取不到"(守门 121 的 i18n 维判的就是这个)。
    const label =
      reason === 'probe-unavailable'
        ? t('network.probeUnavailable')
        : t('network.serverUnreachable')
    return (
      <View style={styles.wrapper} accessibilityRole="alert">
        <View style={styles.pill}>
          <HelpCircle size={16} color={rnTokens.text.secondary} />
          <Text style={styles.mutedText}>{label}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrapper} accessibilityRole="alert">
      <View style={styles.pill}>
        <WifiOff size={16} color={rnTokens.error.text} />
        <Text style={styles.text}>{t('network.offline')}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 8 },
  // 2026-10-07 用户定稿:不要胶囊底色/描边,直接在页面主背景上排图标 + 文字
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: { color: rnTokens.error.text, fontSize: 14, fontWeight: '500' },
  slowText: { color: rnTokens.warning.amberText, fontSize: 14, fontWeight: '500' },
  mutedText: { color: rnTokens.text.secondary, fontSize: 14, fontWeight: '500' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
