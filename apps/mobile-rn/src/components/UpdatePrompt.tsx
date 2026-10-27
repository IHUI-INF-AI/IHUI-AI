// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 更新提示(2026-10-27 立):对齐 web 端 PWAUpdatePrompt 的视觉与交互。
 *
 * web 原型(apps/web/src/components/common/PWAUpdatePrompt.tsx):
 *   卡片行 = RefreshCw 图标(primary) + 「有新版本可用」+「刷新页面以获取最新版本」
 *   + [更新] cta 按钮 + 关闭 X。
 * RN 端同构:expo-updates 静默下载就绪后弹同一形态卡片,「更新」= reloadAsync(重启生效)。
 *
 * 生命周期:挂载后 3s 检查(避开首屏网络争抢)→ 有更新即静默 fetchUpdateAsync 下载
 * → 就绪才提示(用户点更新立即重启,不等下次冷启动)。检查/下载失败一律静默 fail-open,
 * 与 web 端 app-version-gate 的降级哲学一致:挡住用户比旧版本跑着更坏。
 * __DEV__ 与 web 平台跳过(dev-client 无 OTA 通道;web 有自己的 PWA 链路)。
 */

import * as React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Updates from 'expo-updates'
import { RefreshCw, X } from 'lucide-react-native'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

/** 挂载后延迟检查的毫秒数:首屏资源/请求优先,更新检查让路。 */
const CHECK_DELAY_MS = 3000

export function UpdatePrompt(): React.JSX.Element | null {
  const { t } = useI18n()
  const [ready, setReady] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    if (__DEV__ || Platform.OS === 'web') return
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync()
          if (!check.isAvailable || cancelled) return
          await Updates.fetchUpdateAsync()
          if (!cancelled) setReady(true)
        } catch {
          // fail-open:检查/下载失败不提示、不打扰,下次冷启动再试
        }
      })()
    }, CHECK_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const handleReload = React.useCallback(() => {
    void Updates.reloadAsync().catch(() => {
      // 重启失败极罕见(原生通道异常);保持卡片可见,用户可重试
    })
  }, [])

  if (__DEV__ || Platform.OS === 'web' || !ready || dismissed) return null

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={t('update.title')}>
      <RefreshCw size={20} color={tokens.brand.DEFAULT} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{t('update.title')}</Text>
        <Text style={styles.body}>{t('update.body')}</Text>
      </View>
      <Pressable
        onPress={handleReload}
        style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('update.action')}
      >
        <Text style={styles.actionText}>{t('update.action')}</Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('update.close')}
      >
        <X size={18} color={tokens.text.secondary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: rnSpacing.lg,
    right: rnSpacing.lg,
    // GlobalFloatBox(右下角浮窗)在 bottom 9%;提示卡片抬高避开
    bottom: '18%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.gray[200],
    // web 原型 shadow-sm 的 RN 等效
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  icon: { flexShrink: 0 },
  textWrap: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: tokens.text.primary, fontSize: 14, fontWeight: '500' },
  body: { color: tokens.text.secondary, fontSize: 12 },
  actionBtn: {
    flexShrink: 0,
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  actionBtnPressed: { opacity: 0.9 },
  actionText: { color: tokens.brand.ctaForeground, fontSize: 12, fontWeight: '500' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌​​‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
