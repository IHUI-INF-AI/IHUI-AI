// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** 新建团队表单(对齐 web page.tsx 的 name/slug/description 三字段)。 */
export interface TeamCreateForm {
  name: string
  slug: string
  description: string
}

/** 团队列表卡片行(日期已由 wrapper 格式化,共享屏只渲染)。 */
export interface TeamCardItem {
  id: string
  name: string
  slug: string
  description: string
  memberCount: number
  createdAt: string
}

export interface TeamsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  refreshing?: boolean
  error?: string | null
  teams: TeamCardItem[]
  onRefresh: () => void
  onEnterTeam: (teamId: string) => void
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  form: TeamCreateForm
  onFormChange: (patch: Partial<TeamCreateForm>) => void
  formError?: string | null
  creating?: boolean
  onCreate: () => void
}

/**
 * 协作团队列表共享屏 — props 注入式跨端组件(对齐 web apps/web/app/(main)/teams/)
 *
 * 平台无关:渲染 header + 新建团队表单(折叠) + 团队卡片 FlatList(下拉刷新)。
 * 平台特定(取数 / 导航 / 日期格式化)由 wrapper 通过 props 注入。
 * 注意:与 features/team(分销团友)同名不同域,本屏承载的是协作团队(/api/teams)。
 */
export function TeamsScreen({
  t,
  onBack,
  loading,
  refreshing = false,
  error = null,
  teams,
  onRefresh,
  onEnterTeam,
  createOpen,
  onCreateOpenChange,
  form,
  onFormChange,
  formError = null,
  creating = false,
  onCreate,
  colorScheme = 'light',
}: TeamsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('teamsPage.title')}</Text>
        <Text style={styles.subtitle}>{t('teamsPage.subtitle')}</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.newBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={() => onCreateOpenChange(!createOpen)}
        >
          <Text style={styles.newBtnText}>{t('teamsPage.newTeam')}</Text>
        </TouchableOpacity>
      </View>

      {createOpen ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{t('teamsPage.createTeamDesc')}</Text>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <Text style={styles.fieldLabel}>{t('teamsPage.name')}</Text>
          <TextField
            colorScheme={colorScheme}
            value={form.name}
            onChangeText={(v) => onFormChange({ name: v })}
            placeholder={t('teamsPage.namePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={128}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>{t('teamsPage.slug')}</Text>
          <TextField
            colorScheme={colorScheme}
            value={form.slug}
            onChangeText={(v) => onFormChange({ slug: v })}
            placeholder={t('teamsPage.slugPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={128}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>{t('teamsPage.description')}</Text>
          <TextField
            colorScheme={colorScheme}
            value={form.description}
            onChangeText={(v) => onFormChange({ description: v })}
            placeholder={t('teamsPage.descriptionPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={2000}
            multiline
            style={styles.inputMultiline}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => onCreateOpenChange(false)}
            >
              <Text style={styles.cancelBtnText}>{t('teamsPage.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, creating ? styles.btnDisabled : null]}
              activeOpacity={0.85}
              accessibilityRole="button"
              disabled={creating}
              onPress={onCreate}
            >
              <Text style={styles.submitBtnText}>
                {creating ? t('teamsPage.creating') : t('teamsPage.create')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && teams.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.emptyText}>{t('teamsPage.loading')}</Text>
        </View>
      ) : (
        <FlatList<TeamCardItem>
          data={teams}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('teamsPage.empty')}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description || item.slug}
              </Text>
              <Text style={styles.cardMeta}>
                {t('teamsPage.memberCount', { count: item.memberCount })}
              </Text>
              <View style={styles.cardFoot}>
                <Text style={styles.cardMeta}>
                  {t('teamsPage.createdAt')}: {item.createdAt}
                </Text>
                <TouchableOpacity
                  style={styles.enterBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={() => onEnterTeam(item.id)}
                >
                  <Text style={styles.enterBtnText}>{t('teamsPage.enter')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    actionRow: { paddingHorizontal: 10, paddingBottom: 8 },
    newBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    newBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    formCard: {
      marginHorizontal: 10,
      marginBottom: 8,
      padding: 14,
      gap: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    formTitle: { fontSize: 13, color: tk.text.secondary },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium },
    input: {
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    inputMultiline: {
      minHeight: 72,
      paddingTop: 10,
      paddingBottom: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
    formActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cancelBtnText: { fontSize: 14, color: tk.text.primary },
    submitBtn: {
      flex: 1,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    btnDisabled: { opacity: 0.6 },
    errorBar: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center', gap: 8 },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    listBody: { padding: 14, paddingTop: 0, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      padding: 14,
      gap: 6,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardDesc: { fontSize: 13, color: tk.text.secondary },
    cardMeta: { fontSize: 11, color: tk.text.tertiary },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    enterBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.light,
    },
    enterBtnText: { fontSize: 13, fontWeight: '600', color: tk.brandAccent.deep },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
