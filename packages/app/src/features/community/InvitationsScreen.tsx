// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Clock, Gift, Users } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 邀请奖励共享屏 —— 承载 web /invitations(同口径:邀请码卡列表 + 被邀请人列表 + 生成码)。
 * 平台无关:取数(GET /api/invitations、/api/invitations/invitees)、生成(POST)与
 * 复制剪贴板(RN Clipboard / 小程序 setClipboardData)由薄壳注入;时间文案由薄壳
 * 用 Intl.DateTimeFormat 按 locale 预格式化(与 web 逐字同参)。
 */
export type InvitationStatus = 'unused' | 'used' | 'expired'

export interface InvitationRowView {
  id: string
  code: string
  status: InvitationStatus
  rewardText: string
  expiresText: string
}

export interface InviteeRowView {
  id: string
  name: string
  registeredText: string
  rewardText: string
}

export interface InvitationsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径),优先级最高 */
  loginRequiredText: string
  generating: boolean
  generateError: string | null
  onGenerate: () => void
  codesLoading: boolean
  codesError: string | null
  codes: InvitationRowView[]
  copiedId: string | null
  onCopy: (id: string, code: string) => void
  inviteesLoading: boolean
  inviteesError: string | null
  invitees: InviteeRowView[]
}

const STATUS_TEXT_KEY: Record<InvitationStatus, string> = {
  unused: 'invitationsPage.statusUnused',
  used: 'invitationsPage.statusUsed',
  expired: 'invitationsPage.statusExpired',
}

export function InvitationsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  generating,
  generateError,
  onGenerate,
  codesLoading,
  codesError,
  codes,
  copiedId,
  onCopy,
  inviteesLoading,
  inviteesError,
  invitees,
}: InvitationsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('invitationsPage.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('invitationsPage.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('invitationsPage.subtitle')}</Text>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.generateBtn} onPress={onGenerate} disabled={generating}>
            {generating ? (
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
            ) : (
              <Gift size={16} color={tk.brand.ctaForeground} />
            )}
            <Text style={styles.generateText}>{t('invitationsPage.generate')}</Text>
          </TouchableOpacity>
          {generateError ? <Text style={styles.error}>{generateError}</Text> : null}

          <Text style={styles.sectionTitle}>{t('invitationsPage.myCodes')}</Text>
          {codesLoading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t('invitationsPage.loading')}</Text>
            </View>
          ) : codesError ? (
            <Text style={styles.error}>{codesError}</Text>
          ) : codes.length === 0 ? (
            <EmptyBlock
              icon={<Gift size={28} color={tk.text.tertiary} />}
              text={t('invitationsPage.emptyCodes')}
              colorScheme={colorScheme}
            />
          ) : (
            <View style={styles.codeGrid}>
              {codes.map((c) => (
                <View key={c.id} style={styles.codeCard}>
                  <View style={styles.codeTopRow}>
                    <Text style={styles.codeText}>{c.code}</Text>
                    <Text
                      style={
                        c.status === 'unused'
                          ? styles.badgeUnused
                          : c.status === 'used'
                            ? styles.badgeUsed
                            : styles.badgeExpired
                      }
                    >
                      {t(STATUS_TEXT_KEY[c.status])}
                    </Text>
                  </View>
                  <Text style={styles.metaRow}>{c.rewardText}</Text>
                  <View style={styles.metaIconRow}>
                    <Clock size={13} color={tk.text.tertiary} />
                    <Text style={styles.metaRow}>{c.expiresText}</Text>
                  </View>
                  <TouchableOpacity
                    style={c.status === 'unused' ? styles.copyBtn : styles.copyBtnDisabled}
                    onPress={() => onCopy(c.id, c.code)}
                    disabled={c.status !== 'unused'}
                  >
                    <Text
                      style={
                        c.status === 'unused' ? styles.copyBtnText : styles.copyBtnTextDisabled
                      }
                    >
                      {copiedId === c.id ? t('invitationsPage.copied') : t('invitationsPage.copy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.inviteeHeader}>
            <Users size={15} color={tk.text.secondary} />
            <Text style={styles.sectionTitle}>{t('invitationsPage.invitees')}</Text>
          </View>
          {inviteesLoading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t('invitationsPage.loading')}</Text>
            </View>
          ) : inviteesError ? (
            <Text style={styles.error}>{inviteesError}</Text>
          ) : invitees.length === 0 ? (
            <EmptyBlock
              icon={<Users size={28} color={tk.text.tertiary} />}
              text={t('invitationsPage.emptyInvitees')}
              colorScheme={colorScheme}
            />
          ) : (
            <View style={styles.inviteeCard}>
              <View style={styles.inviteeHeadRow}>
                <Text style={[styles.inviteeHead, { flex: 2 }]}>{t('invitationsPage.user')}</Text>
                <Text style={[styles.inviteeHead, { flex: 2 }]}>
                  {t('invitationsPage.registeredAt')}
                </Text>
                <Text style={[styles.inviteeHead, { flex: 1, textAlign: 'right' }]}>
                  {t('invitationsPage.reward')}
                </Text>
              </View>
              {invitees.map((u) => (
                <View key={u.id} style={styles.inviteeRow}>
                  <Text style={[styles.inviteeName, { flex: 2 }]} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={[styles.muted, { flex: 2 }]}>{u.registeredText}</Text>
                  <Text style={[styles.muted, { flex: 1, textAlign: 'right' }]}>
                    {u.rewardText}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function EmptyBlock({
  icon,
  text,
  colorScheme,
}: {
  icon: ReactNode
  text: string
  colorScheme: AppThemeMode
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <View style={styles.emptyBlock}>
      {icon}
      <Text style={styles.muted}>{text}</Text>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    scroll: { paddingTop: rnSpacing.md, paddingBottom: 24 },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    generateText: { color: tk.brand.ctaForeground, fontSize: rnType.body.size, fontWeight: '600' },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    sectionTitle: {
      marginTop: rnSpacing.xl,
      marginBottom: rnSpacing.sm,
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    centerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xl,
      justifyContent: 'center',
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    codeGrid: { gap: rnSpacing.md },
    codeCard: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.xs,
    },
    codeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    codeText: {
      fontSize: rnType.strong.size,
      fontFamily: 'monospace',
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
    },
    badgeUnused: {
      fontSize: rnType.caption.size,
      color: tk.success.deepText,
      backgroundColor: tk.success.light,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    badgeUsed: {
      fontSize: rnType.caption.size,
      color: tk.warning.amberText,
      backgroundColor: tk.warning.amberLight,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    badgeExpired: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
    },
    metaIconRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    metaRow: { fontSize: rnType.caption.size, color: tk.text.secondary },
    copyBtn: {
      marginTop: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
    },
    copyBtnDisabled: {
      marginTop: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      opacity: 0.5,
    },
    copyBtnText: { fontSize: rnType.label.size, color: tk.text.primary, fontWeight: '500' },
    copyBtnTextDisabled: { fontSize: rnType.label.size, color: tk.text.tertiary },
    inviteeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xl,
      marginBottom: rnSpacing.sm,
    },
    inviteeCard: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    inviteeHeadRow: { flexDirection: 'row', gap: rnSpacing.sm },
    inviteeHead: { fontSize: rnType.caption.size, color: tk.text.secondary, fontWeight: '600' },
    inviteeRow: { flexDirection: 'row', gap: rnSpacing.sm, alignItems: 'center' },
    inviteeName: { fontSize: rnType.label.size, color: tk.text.primary, fontWeight: '500' },
    emptyBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
