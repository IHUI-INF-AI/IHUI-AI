import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AigcCoverFilter, AigcCoverOption, AigcCoverScreenProps } from '../../types'

/** AIGC 封面选择共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AigcCoverFilter, AigcCoverOption, AigcCoverScreenProps }

const FILTERS: { key: AigcCoverFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'aigcCover.filterAll' },
  { key: 'work', labelKey: 'aigcCover.filterWork' },
  { key: 'ai', labelKey: 'aigcCover.filterAi' },
]

export function AigcCoverScreen({
  t,
  workTitle,
  covers,
  selectedId,
  filter,
  loading,
  error,
  onSelectCover,
  onFilterChange,
  onConfirm,
  onGenerateAi,
  onBack,
  colorScheme = 'light',
}: AigcCoverScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>{t('aigcCover.loading')}</Text>
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

  const selected = covers.find((c) => c.id === selectedId) ?? covers[0]
  const filtered = filter === 'all' ? covers : covers.filter((c) => c.source === filter)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{t('aigcCover.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('aigcCover.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t('aigcCover.subtitle', { title: workTitle })}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {selected ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selected.url }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{selected.label}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => onFilterChange(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {t(f.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('aigcCover.empty')}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.coverItem, selectedId === c.id && styles.coverItemActive]}
                onPress={() => onSelectCover(c.id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: c.url }} style={styles.coverImage} resizeMode="cover" />
                <Text style={styles.coverLabel} numberOfLines={1}>
                  {c.label}
                </Text>
                {selectedId === c.id ? (
                  <View style={styles.selectedDot}>
                    <Text style={styles.selectedDotText}>✓</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.aiGenBtn} onPress={onGenerateAi} activeOpacity={0.7}>
          <Text style={styles.aiGenText}>{t('aigcCover.aiGenBtn')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
          onPress={() => selected && onConfirm(selected)}
          activeOpacity={0.85}
          disabled={!selected}
        >
          <Text style={styles.confirmText}>{t('aigcCover.confirmBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const primary = tk.brand.DEFAULT
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    stateText: { fontSize: 13, color: tk.text.tertiary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
    previewWrap: {
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 16,
    },
    preview: { width: '100%', aspectRatio: 1, backgroundColor: tk.border.light },
    previewBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    previewBadgeText: { fontSize: 12, color: tk.surface.light },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    filterChipActive: { backgroundColor: primary },
    filterText: { fontSize: 13, color: tk.text.medium },
    filterTextActive: { color: tk.surface.light, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    coverItem: {
      width: '48%',
      flexGrow: 1,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
      paddingBottom: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    coverItemActive: { borderColor: primary },
    coverImage: { width: '100%', aspectRatio: 1, backgroundColor: tk.border.light },
    coverLabel: { marginTop: 6, paddingHorizontal: 8, fontSize: 12, color: tk.text.medium },
    selectedDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedDotText: { color: tk.surface.light, fontSize: 14, fontWeight: '700' },
    aiGenBtn: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: primary,
      backgroundColor: tk.success.light,
      alignItems: 'center',
    },
    aiGenText: { color: primary, fontSize: 14, fontWeight: '600' },
    footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tk.surface.light },
    confirmBtn: {
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnDisabled: { backgroundColor: tk.text.tertiary },
    confirmText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
