// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Link2, Link2Off } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/**
 * ConnectedAccountsScreen — 跨端共享「已连接账户屏」(门 39 六屏共享化第一批)。
 *
 * 为什么进共享层:守门 39 的屏级共享维(V2)要求 RN 有 `@ihui/rn-app` import 的同时
 * `packages/app` 有同名共享屏 —— 本文件是 `apps/mobile-rn/src/screens/ConnectedAccountsScreen.tsx`
 * 的 UI 下沉(照 `features/payment/PaymentScreen.tsx` 的 props 注入式,wrapper 只留
 * API 调用 / 打开浏览器 / 二次确认弹层 / i18n 与主题注入)。
 *
 * 平台无关边界:
 *  - 导航:只收 `onBack`;
 *  - 数据:`bindings` 由平台按 `GET /api/auth/bindings` 取回并**先做好时间格式化**
 *    (`createdAtText`)后注入,共享层不依赖 `@ihui/api-client`;
 *  - 未绑定时的「去网页绑定」是平台能力(打开外部浏览器),共享层只发 `onBindOnWeb`;
 *  - 解绑二次确认属平台能力(`appAlert`),共享层只发 `onUnbind(binding)`。
 */
/** 平台标识 → i18n 文案键(未知平台回落原值) */
function platformLabelKey(platform: string): string {
  if (platform === 'wechat') return 'connectedAccounts.platformWechat'
  if (platform === 'github') return 'connectedAccounts.platformGithub'
  if (platform === 'google') return 'connectedAccounts.platformGoogle'
  return ''
}

/** 已知平台档(固定顺序渲染;未在档内的绑定归入「其他」区)。 */
export const KNOWN_ACCOUNT_PLATFORMS = ['wechat', 'github', 'google'] as const

/** 绑定行(平台注入;时间已格式化为 `createdAtText`)。 */
export interface ConnectedAccountBinding {
  id: string
  platform: string
  /** 平台侧格式化好的绑定时间文本 */
  createdAtText: string
}

/** 平台显示名;未知平台回落原始标识。 */
export function accountPlatformLabel(t: TFunction, platform: string): string {
  const key = platformLabelKey(platform)
  return key ? t(key) : platform
}

export interface ConnectedAccountsScreenProps {
  t: TFunction
  bindings: ConnectedAccountBinding[]
  loading: boolean
  /** 错误态文案(非空则渲染错误态 + 重试钮) */
  error: string | null
  /** 正在解绑的绑定 id(置忙禁用);空值 = 无 */
  unbindingId: string | null
  onRefresh: () => void
  /** 解绑回调(平台注入:先弹二次确认,确认后调 DELETE /api/auth/bindings/:id) */
  onUnbind: (binding: ConnectedAccountBinding) => void
  /** 「去网页绑定」回调(平台注入:打开 web 的已连接账号页) */
  onBindOnWeb: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function ConnectedAccountsScreen({
  t,
  bindings,
  loading,
  error,
  unbindingId,
  onRefresh,
  onUnbind,
  onBindOnWeb,
  onBack,
  colorScheme = 'light',
}: ConnectedAccountsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const extraBindings = bindings.filter(
    (b) => !KNOWN_ACCOUNT_PLATFORMS.some((p) => p === b.platform),
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('connectedAccounts.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Link2 size={16} color={tk.text.secondary} />
            <Text style={styles.cardTitle}>{t('connectedAccounts.title')}</Text>
            <TouchableOpacity
              style={styles.refresh}
              onPress={onRefresh}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('connectedAccounts.refresh')}
            >
              <Text style={styles.link}>{t('connectedAccounts.refresh')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>{t('connectedAccounts.subtitle')}</Text>

          {loading ? (
            <ActivityIndicator style={styles.loading} color={tk.text.tertiary} />
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{error}</Text>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={onRefresh}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('connectedAccounts.retry')}
              >
                <Text style={styles.outlineText}>{t('connectedAccounts.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {KNOWN_ACCOUNT_PLATFORMS.map((platform) => {
                const binding = bindings.find((b) => b.platform === platform)
                return (
                  <View key={platform} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.platformName}>{accountPlatformLabel(t, platform)}</Text>
                      <Text style={styles.meta}>
                        {binding
                          ? `${t('connectedAccounts.boundAt')}: ${binding.createdAtText}`
                          : t('connectedAccounts.unbound')}
                      </Text>
                    </View>
                    {binding ? (
                      <TouchableOpacity
                        style={styles.outlineButtonSmall}
                        onPress={() => onUnbind(binding)}
                        disabled={unbindingId === binding.id}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t('connectedAccounts.unbind')}
                      >
                        <Link2Off size={13} color={tk.danger.DEFAULT} />
                        <Text style={styles.dangerLink}>{t('connectedAccounts.unbind')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.button}
                        onPress={onBindOnWeb}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t('connectedAccounts.bindOnWeb')}
                      >
                        <Link2 size={13} color={tk.brand.ctaForeground} />
                        <Text style={styles.buttonText}>{t('connectedAccounts.bindOnWeb')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
              {extraBindings.map((binding) => (
                <View key={binding.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.platformName}>
                      {accountPlatformLabel(t, binding.platform)}
                    </Text>
                    <Text style={styles.meta}>
                      {t('connectedAccounts.boundAt')}: {binding.createdAtText}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.outlineButtonSmall}
                    onPress={() => onUnbind(binding)}
                    disabled={unbindingId === binding.id}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('connectedAccounts.unbind')}
                  >
                    <Link2Off size={13} color={tk.danger.DEFAULT} />
                    <Text style={styles.dangerLink}>{t('connectedAccounts.unbind')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.hint}>{t('connectedAccounts.webBindHint')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: 10,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    refresh: { paddingVertical: 2, paddingHorizontal: rnSpacing.xs },
    link: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: 13, color: tk.text.secondary, lineHeight: 19 },
    hint: { fontSize: rnType.label.size, color: tk.text.tertiary, lineHeight: 17, marginTop: 2 },
    error: { fontSize: 13, color: tk.danger.DEFAULT },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
    },
    rowMain: { flex: 1, gap: 2 },
    platformName: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    meta: { fontSize: rnType.label.size, color: tk.text.tertiary },
    button: {
      height: 32,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    buttonText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    outlineButtonSmall: {
      height: 32,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.danger.DEFAULT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    dangerLink: { fontSize: rnType.label.size, fontWeight: '600', color: tk.danger.DEFAULT },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
