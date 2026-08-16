import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RecruitmentCategory, RecruitmentJob, RecruitmentScreenProps } from '../../types'

export type { RecruitmentCategory, RecruitmentJob, RecruitmentScreenProps }

const TABS: { key: RecruitmentCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'recruitment.tab_all' },
  { key: 'tech', labelKey: 'recruitment.tab_tech' },
  { key: 'product', labelKey: 'recruitment.tab_product' },
  { key: 'design', labelKey: 'recruitment.tab_design' },
  { key: 'ops', labelKey: 'recruitment.tab_ops' },
]

/**
 * 招聘共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 分类 tabs + 职位 FlatList + 职位详情 Modal。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function RecruitmentScreen({
  t,
  jobs,
  activeTab,
  appliedIds,
  selected,
  loading,
  error,
  onSelectTab,
  onSelectJob,
  onApply,
  onBack,
  colorScheme = 'light',
}: RecruitmentScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const filtered = activeTab === 'all' ? jobs : jobs.filter((j) => j.category === activeTab)

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.stateText}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('recruitment.title')}</Text>
        <Text style={styles.subtitle}>{t('recruitment.count', { count: filtered.length })}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList<RecruitmentJob>
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('recruitment.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.jobCard}
            onPress={() => onSelectJob(item)}
            activeOpacity={0.7}
          >
            <View style={styles.jobHead}>
              <Text style={styles.jobPosition} numberOfLines={1}>
                {item.position}
              </Text>
              <Text style={styles.jobSalary}>{item.salary}</Text>
            </View>
            <Text style={styles.jobCompany}>
              {item.company} · {item.location}
            </Text>
            <View style={styles.jobMeta}>
              <Text style={styles.jobMetaText}>{item.experience}</Text>
              <Text style={styles.jobMetaText}>{item.education}</Text>
              {item.tags.map((tg) => (
                <View key={tg} style={styles.miniTag}>
                  <Text style={styles.miniTagText}>{tg}</Text>
                </View>
              ))}
              {appliedIds.has(item.id) ? (
                <View style={styles.appliedBadge}>
                  <Text style={styles.appliedText}>{t('recruitment.applied')}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => onSelectJob(null)}
      >
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selected.position}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onSelectJob(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.modalClose}>{t('recruitment.close')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSalary}>
                  {selected.salary} · {selected.company} · {selected.location}
                </Text>
                <Text style={styles.modalSection}>{t('recruitment.description')}</Text>
                <ScrollView style={styles.modalDescWrap}>
                  <Text style={styles.modalDesc}>{selected.description}</Text>
                </ScrollView>
                <Text style={styles.modalSection}>{t('recruitment.requirements')}</Text>
                {selected.requirements.map((r, i) => (
                  <Text key={i} style={styles.modalReq}>
                    · {r}
                  </Text>
                ))}
                <TouchableOpacity
                  style={[styles.applyBtn, appliedIds.has(selected.id) && styles.applyBtnDisabled]}
                  onPress={() => onApply(selected)}
                  disabled={appliedIds.has(selected.id)}
                >
                  <Text style={styles.applyText}>
                    {appliedIds.has(selected.id)
                      ? t('recruitment.appliedWaiting')
                      : t('recruitment.applyNow')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
    stateText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backBtn: { paddingVertical: 4, marginBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.tertiary },
    tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    listBody: { padding: 14, paddingBottom: 32 },
    separator: { height: 12 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    jobCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    jobHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    jobPosition: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    jobSalary: { fontSize: 16, fontWeight: '600', color: tk.danger.bright },
    jobCompany: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    jobMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    jobMetaText: { fontSize: 11, color: tk.text.tertiary },
    miniTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    miniTagText: { fontSize: 10, color: tk.text.secondary },
    appliedBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: tk.success.light,
    },
    appliedText: { fontSize: 10, color: tk.brand.DEFAULT },
    modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: tk.surface.light,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 14,
      paddingBottom: 32,
      maxHeight: '85%',
    },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    modalClose: { fontSize: 16, color: tk.text.secondary },
    modalSalary: { marginTop: 8, fontSize: 14, color: tk.brand.DEFAULT },
    modalSection: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    modalDescWrap: { maxHeight: 200 },
    modalDesc: { fontSize: 14, color: tk.text.medium, lineHeight: 20 },
    modalReq: { marginTop: 8, fontSize: 14, color: tk.text.medium, lineHeight: 20 },
    applyBtn: {
      marginTop: 20,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnDisabled: { backgroundColor: tk.text.tertiary },
    applyText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
