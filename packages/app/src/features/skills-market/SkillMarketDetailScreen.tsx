// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Wand2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { SkillMarketDetailView, type SkillDetailView } from './SkillMarketDetailView'

const NS = 'skillMarketPage'

export interface SkillMarketDetailScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  /** 返回(深链屏无上一级详情,回市场列表) */
  onBack: () => void
  /** 非空即未登录门(web AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  /** 深链 name:非空且查不到时进「未找到」空态(web 同口径:下架即隐身,与不存在同一结果) */
  notFoundName: string | null
  detail: SkillDetailView | null
  onSubmitRating: (score: number, comment: string) => void
  onToggleSubscribe: () => void
}

/**
 * Skill 深链详情共享屏 —— 承载 web `/skills-market/[id]`
 * (apps/web/app/(main)/skills-market/[id]/PageClient.tsx:11-29,把 URL 里的 name 反查
 * 市场条目后打开详情,查不到 / 已下架给明确空态 + 回列表出口,web PageClient.tsx:229-250)。
 *
 * 与列表屏共用同一个详情面组件 SkillMarketDetailView(web 同样只有一份详情实现)。
 * 只渲染;反查与取数在薄壳(复用 GET /api/skills/market?q=<name>,不新增详情端点)。
 */
export function SkillMarketDetailScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  notFoundName,
  detail,
  onSubmitRating,
  onToggleSubscribe,
}: SkillMarketDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleRow}>
          <Wand2 size={20} color={tk.text.primary} />
          <Text style={styles.title} numberOfLines={1}>
            {t(`${NS}.title`)}
          </Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.text.secondary} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : notFoundName !== null ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{t(`${NS}.notFoundTitle`)}</Text>
          <Text style={styles.hintMuted}>{t(`${NS}.notFoundHint`, { name: notFoundName })}</Text>
          <Pressable onPress={onBack} accessibilityRole="button" style={styles.linkButton}>
            <Text style={styles.linkText}>{t(`${NS}.backToMarket`)}</Text>
          </Pressable>
        </View>
      ) : detail ? (
        <SkillMarketDetailView
          t={t}
          colorScheme={colorScheme}
          detail={detail}
          onClose={onBack}
          onSubmitRating={onSubmitRating}
          onToggleSubscribe={onToggleSubscribe}
        />
      ) : null}
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
      marginBottom: rnSpacing.sm,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flex: 1 },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    errorText: {
      marginTop: rnSpacing.xl,
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    notFound: {
      marginTop: rnSpacing.lg,
      alignItems: 'center',
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
      padding: rnSpacing.xl,
    },
    notFoundTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    hintMuted: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      textAlign: 'center',
    },
    linkButton: { paddingVertical: rnSpacing.xs },
    linkText: { fontSize: rnType.caption.size, color: tk.brandAccent.deep },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
