// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Wave3 q3 — web /memory/[id] 的 RN 承载(共享屏)
//
// 复刻 apps/web/app/(main)/memory/[id]/PageClient.tsx 的三块:
//  1) 徽章行(类型 / 作用域 / 来源)—— web PageClient.tsx:137-150
//  2) 只读态(分类标题 + 正文 + 创建/更新时间)—— 同文件 184-196
//  3) 编辑态(分类 + 内容两字段,保存/取消)与删除 —— 同文件 152-183、198-250
//
// 平台无关:请求 / 导航 / Alert / 登录态由 wrapper 注入(与同域 MemoryScreen 同一套纪律)。
// 「保存」在 web 端就是 DELETE + POST 两步(web 无 PUT /api/memory/:id,后端 apps/api
// src/routes/memory.ts 只注册 GET/POST/DELETE),本屏不引入第三种动作,仍由 wrapper 承担。

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Brain, Pencil, Save, Trash2, X } from 'lucide-react-native'
import type { MemoryEntry } from '@ihui/types'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** MemoryDetailScreen props(注入式:wrapper 保留 fetchApi/Alert/导航/登录态) */
export interface MemoryDetailScreenProps {
  t: TFunction
  /** 登录态:false 时渲染「请先登录」(对齐同域 MemoryScreen 的 loggedIn 口径) */
  loggedIn: boolean
  /** 已按 id 命中的条目;未命中传 null(此时 notFound 决定空态文案) */
  entry: MemoryEntry | null
  loading: boolean
  /** 加载/保存/删除失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 列表里没有这个 id(web 的「记忆条目不存在」) */
  notFound: boolean
  editing: boolean
  categoryDraft: string
  textDraft: string
  saving: boolean
  deleting: boolean
  onCategoryDraftChange: (text: string) => void
  onTextDraftChange: (text: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  /** 提交保存(web 同款 DELETE + POST;必填校验与 Alert 由 wrapper 处理) */
  onSave: () => void
  onDelete: () => void
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(iso: string): string {
  try {
    return timeFormatter.format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * MemoryDetailScreen 记忆详情(共享层) — props 注入式跨端组件
 *
 * web /memory/[id] 在 RN 端的原生承载。数据来源与 web 逐字同口径:
 * GET /api/memory 聚合列表后按 id 命中(web PageClient.tsx:47-48 就是这么找的)。
 */
export function MemoryDetailScreen({
  t,
  loggedIn,
  entry,
  loading,
  error,
  notFound,
  editing,
  categoryDraft,
  textDraft,
  saving,
  deleting,
  onCategoryDraftChange,
  onTextDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onRetry,
  onBack,
  colorScheme = 'light',
}: MemoryDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={2} colorScheme={colorScheme} />
  }

  if (!loggedIn) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.mutedText}>{t('memory.loginRequired')}</Text>
      </View>
    )
  }

  const busy = saving || deleting

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.headerTitleGroup}>
          <Brain size={rnType.title.size} color={tk.brand.DEFAULT} />
          <Text style={styles.headerTitle}>{t('memory.detailTitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : null}

        {!error && notFound && !entry ? (
          <EmptyState title={t('memory.notFound')} colorScheme={colorScheme} />
        ) : null}

        {entry ? (
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                {/* 键名与同域 MemoryScreen 的 memory.type.* / memory.scope.* 同一族,不再另立映射表 */}
                <Text style={styles.badgeText}>{t(`memory.type.${entry.type}`)}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t(`memory.scope.${entry.scope}`)}</Text>
              </View>
              <Text style={styles.metaText}>
                {t('memory.source')}: {entry.source}
              </Text>
            </View>

            {editing ? (
              <View style={styles.editBlock}>
                <Text style={styles.fieldLabel}>{t('memory.categoryLabel')}</Text>
                <TextField
                  colorScheme={colorScheme}
                  style={styles.categoryInput}
                  value={categoryDraft}
                  onChangeText={onCategoryDraftChange}
                  placeholder={t('memory.categoryPlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  editable={!busy}
                />
                <Text style={styles.fieldLabel}>{t('memory.contentLabel')}</Text>
                <TextField
                  colorScheme={colorScheme}
                  style={styles.textInput}
                  value={textDraft}
                  onChangeText={onTextDraftChange}
                  placeholder={t('memory.textPlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!busy}
                />
              </View>
            ) : (
              <View style={styles.readBlock}>
                <Text style={styles.categoryTitle}>{entry.category}</Text>
                <Text style={styles.entryText}>{entry.text}</Text>
              </View>
            )}

            <View style={styles.timeRow}>
              <Text style={styles.metaText}>
                {t('memory.createdAt')}: {formatTime(entry.createdAt)}
              </Text>
              <Text style={styles.metaText}>
                {t('memory.updatedAt')}: {formatTime(entry.updatedAt)}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              {editing ? (
                <>
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={onCancelEdit}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <X size={rnType.body.size} color={tk.text.secondary} />
                    <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={onSave}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('memory.save')}
                  >
                    <Save size={rnType.body.size} color={tk.brand.ctaForeground} />
                    <Text style={styles.primaryBtnText}>
                      {saving ? t('common.loading') : t('memory.save')}
                    </Text>
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
                    <Pencil size={rnType.body.size} color={tk.text.secondary} />
                    <Text style={styles.ghostBtnText}>{t('memory.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={onDelete}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Trash2 size={rnType.body.size} color={tk.danger.DEFAULT} />
                    <Text style={styles.dangerBtnText}>
                      {deleting ? t('common.loading') : t('memory.delete')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

/**
 * 样式:颜色全部走 AppThemeTokens 语义 token,零 hex(共享层惯例)。
 * 描边只取 border.light/medium(AGENTS.md §4「描边不得取墨档」)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mutedText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    headerTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    scrollContent: {
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    badge: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 11,
      color: tk.text.secondary,
    },
    readBlock: {
      gap: rnSpacing.xs,
    },
    categoryTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    entryText: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    editBlock: {
      gap: rnSpacing.xs,
    },
    fieldLabel: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    categoryInput: {
      height: 36,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textInput: {
      minHeight: 120,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
    timeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.lg,
    },
    metaText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
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
    ghostBtnText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
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
    dangerBtnText: {
      fontSize: rnType.label.size,
      color: tk.danger.DEFAULT,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    primaryBtnText: {
      fontSize: rnType.label.size,
      color: tk.brand.ctaForeground,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
