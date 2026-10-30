// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mic,
  PlayCircle,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createVoiceLibraryStyles } from './voice-clone-styles'

/**
 * 三态判定与 web 逐字同源(web `apps/web/app/(main)/voices/page.tsx:55-65` 的
 * STATUS_READY / STATUS_FAILED 集合,口径来自 ai-service `token6688_provider.py` 的
 * `_TASK_OK_STATES` / `_TASK_FAIL_STATES`)。导出给各端薄壳复用,禁止端内复算(§0.6)。
 */
export const VOICE_STATUS_READY = new Set([
  'succeeded',
  'success',
  'completed',
  'complete',
  'done',
  'ok',
  'ready',
  'active',
])
export const VOICE_STATUS_FAILED = new Set([
  'failed',
  'fail',
  'error',
  'cancelled',
  'canceled',
])

export type VoiceCloneState = 'ready' | 'processing' | 'failed'

/** 原始 status(含"没有 status 但有 id ⇒ ready"这一 web 同款回退)归到三态。 */
export function voiceCloneStateOf(status: string | undefined, hasId: boolean): VoiceCloneState {
  const raw = (status ?? (hasId ? 'ready' : 'unknown')).toLowerCase()
  if (VOICE_STATUS_READY.has(raw)) return 'ready'
  if (VOICE_STATUS_FAILED.has(raw)) return 'failed'
  return 'processing'
}

/** 列表行(共享层独立声明,不依赖 api-client;字段来自 ai-service provider 原样透传)。 */
export interface VoiceCloneRow {
  /** 主键:provider 的 voice_id,缺则回退 id;两者皆无 ⇒ 空串(行仍渲染,操作按钮不出) */
  id: string
  name: string
  state: VoiceCloneState
  /** 已按调用方 locale 格式化好的创建时间文本(缺字段传 '-') */
  createdAtLabel: string
  model: string | null
  previewUrl: string | null
}

/** 展开行的详情面板状态(取数在薄壳,面板在此渲染)。 */
export interface VoiceCloneDetail {
  loading: boolean
  error: string | null
  /** label 由薄壳用同一套 `voicesPage.*` 词条拼好,值取 provider 原字段 */
  fields: { label: string; value: string }[]
}

export interface VoiceLibraryScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  /** 列表整体加载失败(与"某次操作失败"分开,后者是 actionError) */
  listError: string | null
  /** 上传/删除等操作失败原因(web 同名 helper 的 error 态) */
  actionError: string | null
  /** 操作成功提示(web 的 info 态:克隆已提交) */
  notice: string | null
  voices: VoiceCloneRow[]
  /** 后端 DELETE 是 `_require_admin` ⇒ 非管理员不给删除按钮(与 web isAdmin 同口径) */
  isAdmin: boolean
  uploading: boolean
  deletingId: string | null
  expandedId: string | null
  detail: VoiceCloneDetail | null
  onRefresh: () => void
  onUpload: () => void
  onPreview: (row: VoiceCloneRow) => void
  onToggleExpand: (row: VoiceCloneRow) => void
  onDelete: (row: VoiceCloneRow) => void
}

/**
 * 声纹库共享屏(承载 web `/voices`:token6688 克隆音色列表/详情/删除/上传)。
 *
 * 结构与 web 逐块对齐:页头 → 副题 → 上传/刷新两个动作 → 上传口径提示 →
 * 成功/失败两条横幅 → 列表卡(名称徽章 + 三态徽章 + 时间 + 模型 + 试听/展开/删除)→
 * 展开后的详情面板 → 底部条数。三态齐:loading 骨架 / error 可重试 / empty。
 * 取数(GET·POST·DELETE `/api/voice/voices*`,ai-service)由平台薄壳承担。
 * 试听在 RN 不等价于 web 的 `<audio>` 元素:薄壳经 `onPreview` 落系统播放/浏览器,
 * 因此这里只有一个动作按钮,不复制 web 的"试听↔收起"翻转文案。
 */
export function VoiceLibraryScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading,
  listError,
  actionError,
  notice,
  voices,
  isAdmin,
  uploading,
  deletingId,
  expandedId,
  detail,
  onRefresh,
  onUpload,
  onPreview,
  onToggleExpand,
  onDelete,
}: VoiceLibraryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createVoiceLibraryStyles(tk), [tk])

  const statusChip = (state: VoiceCloneState) => {
    const map = {
      ready: { box: styles.statusReady, text: styles.statusReadyText, label: t('voicesPage.statusReady') },
      processing: {
        box: styles.statusProcessing,
        text: styles.statusProcessingText,
        label: t('voicesPage.statusProcessing'),
      },
      failed: { box: styles.statusFailed, text: styles.statusFailedText, label: t('voicesPage.statusFailed') },
    } as const
    const it = map[state]
    return (
      <View style={[styles.statusChip, it.box]}>
        <Text style={it.text}>{it.label}</Text>
      </View>
    )
  }

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {t('voicesPage.title')}
      </Text>
    </View>
  )

  const busy = loading && voices.length === 0

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={tk.text.secondary} />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('voicesPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('voicesPage.subtitle')}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnPrimary,
              uploading && styles.actionBtnDisabled,
            ]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={uploading ? t('voicesPage.uploading') : t('voicesPage.upload')}
            disabled={uploading}
            onPress={onUpload}
          >
            <Upload size={14} color={tk.brand.ctaForeground} strokeWidth={2} />
            <Text style={styles.actionTextPrimary}>
              {uploading ? t('voicesPage.uploading') : t('voicesPage.upload')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('voicesPage.refresh')}
            onPress={onRefresh}
          >
            <RefreshCw size={14} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.actionText}>{t('voicesPage.refresh')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{t('voicesPage.uploadHint')}</Text>

        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}

        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.listCard}>
          {listError && !loading ? (
            <View style={[styles.row, styles.emptyBox]}>
              <AlertTriangle size={28} color={tk.danger.DEFAULT} strokeWidth={2} />
              <Text style={styles.errorText}>{listError}</Text>
            </View>
          ) : busy ? (
            <View style={styles.row}>
              <View style={styles.loadingBox}>
                <Mic size={18} color={tk.text.tertiary} strokeWidth={2} />
                <Text style={styles.loadingText}>{t('voicesPage.loading')}</Text>
              </View>
              <View style={styles.skeletonRow} />
              <View style={[styles.skeletonRow, { marginTop: 8 }]} />
            </View>
          ) : voices.length === 0 ? (
            <View style={[styles.row, styles.emptyBox]}>
              <Mic size={32} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.emptyText}>{t('voicesPage.empty')}</Text>
            </View>
          ) : (
            voices.map((row, idx) => {
              const key = row.id || `${row.name}-${idx}`
              const isExpanded = !!row.id && expandedId === row.id
              return (
                <View key={key} style={[styles.row, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tk.border.light }]}>
                  <View style={styles.rowHead}>
                    <View style={styles.nameChip}>
                      <Mic size={12} color={tk.brandAccent.deep} strokeWidth={2} />
                      <Text style={styles.nameChipText}>{row.name}</Text>
                    </View>
                    {statusChip(row.state)}
                    <Text style={styles.metaText}>{row.createdAtLabel}</Text>
                    {row.model ? <Text style={styles.modelText}>{row.model}</Text> : null}
                  </View>

                  <View style={styles.rowActions}>
                    {row.previewUrl ? (
                      <TouchableOpacity
                        style={styles.smallBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t('voicesPage.playPreview')}
                        onPress={() => onPreview(row)}
                      >
                        <PlayCircle size={13} color={tk.text.secondary} strokeWidth={2} />
                        <Text style={styles.smallBtnText}>{t('voicesPage.playPreview')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {row.id ? (
                      <TouchableOpacity
                        style={styles.smallBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t('voicesPage.voiceId')}
                        onPress={() => onToggleExpand(row)}
                      >
                        {isExpanded ? (
                          <ChevronUp size={13} color={tk.text.tertiary} strokeWidth={2} />
                        ) : (
                          <ChevronDown size={13} color={tk.text.tertiary} strokeWidth={2} />
                        )}
                        <Text style={styles.idBtnText} numberOfLines={1}>
                          {row.id}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {row.id && isAdmin ? (
                      <TouchableOpacity
                        style={styles.smallBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t('voicesPage.delete')}
                        disabled={deletingId === row.id}
                        onPress={() => onDelete(row)}
                      >
                        <Trash2 size={13} color={tk.danger.DEFAULT} strokeWidth={2} />
                        <Text style={styles.dangerText}>
                          {deletingId === row.id ? t('voicesPage.deleting') : t('voicesPage.delete')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {isExpanded && detail ? (
                    <View style={styles.detailBox}>
                      {detail.loading ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailValue}>{t('voicesPage.loading')}</Text>
                        </View>
                      ) : detail.error ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.errorText}>{detail.error || t('voicesPage.notFound')}</Text>
                        </View>
                      ) : (
                        detail.fields.map((field) => (
                          <View key={field.label} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{`${field.label}:`}</Text>
                            <Text style={styles.detailValue}>{field.value || '-'}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              )
            })
          )}
        </View>

        {!busy && !listError && voices.length > 0 ? (
          <Text style={styles.footerCount}>{t('voicesPage.count', { count: voices.length })}</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
