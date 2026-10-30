// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Brain, Pencil, Save, Trash2, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState } from '../../components/ScreenStates'

const NS = 'memoryDetailPage'

/** 单条记忆的展示模型(时间文案由薄壳按 locale 格式化后注入) */
export interface MemoryDetailView {
  id: string
  /** 类型徽章文案(薄壳已本地化) */
  typeLabel: string
  /** 作用域徽章文案(薄壳已本地化) */
  scopeLabel: string
  category: string
  text: string
  source: string
  createdAtText: string
  updatedAtText: string
}

export interface MemoryDetailScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate 同口径:未登录不发注定 401 的查询) */
  loginRequiredText: string
  loading: boolean
  /** 加载/保存/删除失败文案(非空渲染错误态 + 重试) */
  error: string | null
  /** 列表里没有该 id(对齐 web「记忆条目不存在」) */
  notFound: boolean
  entry: MemoryDetailView | null
  editing: boolean
  saving: boolean
  deleting: boolean
  editCategory: string
  onEditCategoryChange: (text: string) => void
  editText: string
  onEditTextChange: (text: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onDelete: () => void
  onRetry: () => void
}

/**
 * 记忆详情共享屏 —— 承载 web /memory/[id](apps/web/app/(main)/memory/[id]/PageClient.tsx)。
 *
 * 与 web 同口径:
 * - 数据源 = GET /api/memory 列表里按 id 命中(后端无 GET /api/memory/:id,PageClient.tsx:47-56);
 *   未命中显「记忆条目不存在」,不伪造 404 详情端点。
 * - 编辑保存 = DELETE 旧条目 + POST 新条目(web PageClient.tsx:68-86 的原样语义,后端无 PUT/PATCH);
 *   保存成功由薄壳 goBack 回列表。
 * - 删除 = DELETE /api/memory/:id(web PageClient.tsx:88-98)。
 * - 平台无关:取数 / Intl 时间格式化 / 确认弹窗 / 登录态 / 导航全部薄壳注入,本文件只渲染。
 */
export function MemoryDetailScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  notFound,
  entry,
  editing,
  saving,
  deleting,
  editCategory,
  onEditCategoryChange,
  editText,
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onRetry,
}: MemoryDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const busy = saving || deleting

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.headerTitleRow}>
          <Brain size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.headerTitle}>{t(`${NS}.title`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : notFound || !entry ? (
        <View style={styles.stateBlock}>
          <Brain size={28} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.notFound`)}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{entry.typeLabel}</Text>
              </View>
              <View style={styles.scopeBadge}>
                <Text style={styles.scopeBadgeText}>{entry.scopeLabel}</Text>
              </View>
              <Text style={styles.sourceText}>
                {t('memory.source')}:{entry.source || '-'}
              </Text>
            </View>

            {editing ? (
              <View style={styles.formBlock}>
                <Text style={styles.fieldLabel}>{t(`${NS}.categoryLabel`)}</Text>
                <TextInput
                  style={styles.input}
                  value={editCategory}
                  onChangeText={onEditCategoryChange}
                  placeholder={t(`${NS}.categoryPlaceholder`)}
                  placeholderTextColor={tk.text.tertiary}
                  editable={!busy}
                />
                <Text style={styles.fieldLabel}>{t(`${NS}.contentLabel`)}</Text>
                <TextInput
                  style={styles.textarea}
                  value={editText}
                  onChangeText={onEditTextChange}
                  multiline
                  textAlignVertical="top"
                  editable={!busy}
                />
              </View>
            ) : (
              <View style={styles.bodyBlock}>
                <Text style={styles.categoryText}>{entry.category}</Text>
                <Text style={styles.bodyText}>{entry.text}</Text>
              </View>
            )}

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {t(`${NS}.createdLabel`)}:{entry.createdAtText}
              </Text>
              <Text style={styles.timeText}>
                {t('memory.updatedAt')}:{entry.updatedAtText}
              </Text>
            </View>

            <View style={styles.actionRow}>
              {editing ? (
                <>
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={onCancelEdit}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <X size={14} color={tk.text.secondary} />
                    <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, busy ? styles.btnDisabled : null]}
                    onPress={onSave}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Save size={14} color={tk.brand.ctaForeground} />
                    <Text style={styles.primaryBtnText}>{t('memory.save')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={onStartEdit}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Pencil size={14} color={tk.text.secondary} />
                    <Text style={styles.ghostBtnText}>{t(`${NS}.edit`)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dangerBtn, busy ? styles.btnDisabled : null]}
                    onPress={onDelete}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Trash2 size={14} color={tk.danger.DEFAULT} />
                    <Text style={styles.dangerBtnText}>{t('memory.delete')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    headerTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    stateBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    scrollContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.sm },
    typeBadge: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    typeBadgeText: { fontSize: rnType.caption.size, color: tk.text.primary },
    scopeBadge: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    scopeBadgeText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    sourceText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    bodyBlock: { gap: rnSpacing.xs },
    categoryText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    bodyText: { fontSize: rnType.label.size, lineHeight: 20, color: tk.text.secondary },
    formBlock: { gap: rnSpacing.xs },
    fieldLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    input: {
      height: 38,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textarea: {
      minHeight: 110,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    timeText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: rnSpacing.sm },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    ghostBtnText: { fontSize: rnType.label.size, color: tk.text.secondary },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    primaryBtnText: { fontSize: rnType.label.size, color: tk.brand.ctaForeground },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.danger.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    dangerBtnText: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    btnDisabled: { opacity: 0.5 },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
