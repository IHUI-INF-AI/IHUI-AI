// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// i18n-content-exempt-file: 多语言常量数据定义(label/title/description等选项值,内容体系定为中文单语,产品决策2026-11-15)

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

import { t as tStatic } from '../i18n'
import * as React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ShieldCheck } from 'lucide-react-native'
import { ELEVATION_STEPS, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { Tappable } from '@ihui/ui-native'
import {
  ackAutoInstallGuide,
  grantA11yConsent,
  hasA11yConsent,
  openAutoInstallSettings,
  shouldShowAutoInstallGuide,
} from '../lib/auto-install'

export function AutoInstallGuide(): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(false)
  const [consentOpen, setConsentOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    void shouldShowAutoInstallGuide()
      .then((show) => {
        if (alive) setVisible(show)
      })
      .catch(() => {
        if (alive) setVisible(false)
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
    // 明示同意闸门(2026-11-18):用途说明没被用户确认过,绝不直接跳系统设置。
    void hasA11yConsent().then((ok) => {
      if (ok) {
        setVisible(false)
        void ackAutoInstallGuide()
        void openAutoInstallSettings()
        return
      }
      setConsentOpen(true)
    })
  }, [])

  const handleConsentCancel = React.useCallback(() => {
    setConsentOpen(false)
  }, [])

  const handleConsentAgree = React.useCallback(() => {
    setConsentOpen(false)
    setVisible(false)
    void grantA11yConsent()
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
          <Text style={styles.title}>{tStatic('uiText.enableAutoUpdate')}</Text>
          <Text style={styles.body}>{tStatic('uiText.autoInstallPermHint')}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Tappable
          onPress={handleAck}
          style={styles.ghostBtn}
          accessibilityRole="button"
          accessibilityLabel="我已开启"
        >
          <Text style={styles.ghostText}>{tStatic('uiText.alreadyEnabled')}</Text>
        </Tappable>
        <Tappable
          onPress={handleOpen}
          style={styles.actionBtn}
          pressedStyle={styles.actionBtnPressed}
          accessibilityRole="button"
          accessibilityLabel="去开启"
        >
          <Text style={styles.actionText}>{tStatic('uiText.goEnable')}</Text>
        </Tappable>
      </View>
      <Modal
        visible={consentOpen}
        transparent
        animationType="fade"
        onRequestClose={handleConsentCancel}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleConsentCancel} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>无障碍服务用途说明</Text>
            <View style={styles.modalItem}>
              <Text style={styles.modalBody}>
                用途：仅在本应用自身版本更新时，自动点击系统安装器上的「安装/继续/完成」按钮，
                省去你手动确认这一步。
              </Text>
            </View>
            <View style={styles.modalItem}>
              <Text style={styles.modalBody}>
                范围：只识别系统安装器界面，且界面出现本应用名称时才动作；不读取其他应用内容，
                不做坐标点击，不模拟手势。
              </Text>
            </View>
            <View style={styles.modalItem}>
              <Text style={styles.modalBody}>
                数据：不采集、不存储、不上传任何屏幕内容、输入内容或账号信息。
              </Text>
            </View>
            <View style={styles.modalItem}>
              <Text style={styles.modalBody}>
                控制：你可随时在「设置 → 无障碍」关闭该服务，关闭后自动安装立即失效，
                不影响下载与其他功能。
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Tappable
                onPress={handleConsentCancel}
                style={styles.ghostBtn}
                accessibilityRole="button"
                accessibilityLabel="暂不开启"
              >
                <Text style={styles.ghostText}>暂不开启</Text>
              </Tappable>
              <Tappable
                onPress={handleConsentAgree}
                style={styles.actionBtn}
                pressedStyle={styles.actionBtnPressed}
                accessibilityRole="button"
                accessibilityLabel="同意并去开启"
              >
                <Text style={styles.actionText}>同意并去开启</Text>
              </Tappable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: rnSpacing.lg,
  },
  modalCard: {
    gap: rnSpacing.xs,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    ...ELEVATION_STEPS.lg,
  },
  modalTitle: {
    color: tokens.text.primary,
    fontSize: rnType.strong.size,
    fontWeight: '600',
  },
  modalItem: { minWidth: 0 },
  modalBody: { color: tokens.text.secondary, fontSize: rnType.bodySm.size, lineHeight: 20 },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rnSpacing.sm,
    marginTop: rnSpacing.sm,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
