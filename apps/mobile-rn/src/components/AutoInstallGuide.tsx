// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「开启全自动更新」引导卡(2026-11-05 立)。
 *
 * 立因:整包更新的最后一步(系统安装器「安装/完成」)没有 API 可绕过 —— 只有无障碍服务能代点。
 * 该服务必须由用户一次性在系统设置里启用,所以这里必须**主动把入口摆到用户面前**:
 * 光在代码里注入服务而不引导,等于装了个永远没人开的开关。
 *
 * 交互:
 *   · [去开启] → 直接跳到系统无障碍列表(用户找到「IHUI 自动安装」并打开);
 *   · [我已开启] → 记确认,7 天内不再弹(拿不到真实开关状态时宁可多提醒一次,也不假装已开);
 *   · 两者都落 ack,避免每次冷启动糊脸。
 *
 * 显示时机由 UpdatePrompt 决定:只在没有别的更新卡占浮层时出现(不叠卡)。
 */

import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ShieldCheck } from 'lucide-react-native'
import { ELEVATION_STEPS, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { Tappable } from '@ihui/ui-native'
import {
  ackAutoInstallGuide,
  openAutoInstallSettings,
  shouldShowAutoInstallGuide,
} from '../lib/auto-install'

export function AutoInstallGuide(): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    void shouldShowAutoInstallGuide().then((show) => {
      if (alive) setVisible(show)
    })
    return () => {
      alive = false
    }
  }, [])

  // ⚠️ 两个 useCallback 必须声明在 `if (!visible) return null` **之前**(2026-11-06 真机实测):
  // 早退在前时,首帧(false)只跑 2 个 hook、可见帧(true)跑 4 个,React 直接抛
  // "Rendered more hooks than during the previous render" 并整屏崩溃(
  // expo-updates 会把它记成启动崩溃并回滚本次 OTA)。
  const handleOpen = React.useCallback(() => {
    setVisible(false)
    void ackAutoInstallGuide()
    void openAutoInstallSettings()
  }, [])

  const handleAck = React.useCallback(() => {
    setVisible(false)
    void ackAutoInstallGuide()
  }, [])

  if (!visible) return null

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel="开启全自动更新">
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <ShieldCheck size={16} color={tokens.brandAccent.deep} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>开启全自动更新</Text>
          <Text style={styles.body}>
            允许「IHUI 自动安装」无障碍服务后，新版本会自动下载并安装，不用再手动点确认。
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Tappable
          onPress={handleAck}
          style={styles.ghostBtn}
          accessibilityRole="button"
          accessibilityLabel="我已开启"
        >
          <Text style={styles.ghostText}>我已开启</Text>
        </Tappable>
        <Tappable
          onPress={handleOpen}
          style={styles.actionBtn}
          pressedStyle={styles.actionBtnPressed}
          accessibilityRole="button"
          accessibilityLabel="去开启"
        >
          <Text style={styles.actionText}>去开启</Text>
        </Tappable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: rnSpacing.lg,
    right: rnSpacing.lg,
    bottom: '18%',
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    // 投影:引导浮层卡 → 档位 lg(原手写 4/.16/12 + elevation 8,收口到 ELEVATION_STEPS)
    ...ELEVATION_STEPS.lg,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.md },
  iconBadge: {
    width: rnSpacing.xl * 2,
    height: rnSpacing.xl * 2,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brandAccent.light,
  },
  titleWrap: { flex: 1, minWidth: 0, gap: rnSpacing['2xs'] },
  title: { color: tokens.text.primary, fontSize: rnType.strong.size, fontWeight: '600' },
  body: { color: tokens.text.secondary, fontSize: rnType.label.size, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rnSpacing.sm,
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
  },
  ghostText: { color: tokens.text.secondary, fontSize: rnType.bodySm.size },
  actionBtn: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    // 投影:主行动按钮(小控件)→ 档位 sm
    ...ELEVATION_STEPS.sm,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionText: {
    color: tokens.brand.ctaForeground,
    fontSize: rnType.bodySm.size,
    fontWeight: '600',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
