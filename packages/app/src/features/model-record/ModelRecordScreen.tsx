// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
// 行/结果类型直接取 @ihui/types(app 的 types.ts barrel 尚未增列这两枚,不在本票允许改动面内)
import type { ModelRecordItem, ModelRecordScreenProps } from '@ihui/types'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from 'react-native'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Search,
  ShieldCheck,
} from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** 模型备案/Props 类型 re-export(单一来源 @ihui/types) */
export type { ModelRecordScreenProps }

/** 后端 kind 枚举(同值单源:apps/api/src/services/algorithm-record-service.ts 的两个常量) */
const KIND_DEEP = 'deep_synthesis'
const KIND_RECOMMEND = 'algorithm_recommend'
/** 「已复制」提示存活时长(与 web settings/model-record 同档 1500ms) */
const COPIED_RESET_MS = 1500

interface SelectOption {
  value: string
  label: string
}

/** ISO 时刻 → 本地 YYYY-MM-DD(走 Intl,不手拼时区;无法解析回落 '-') */
function formatLocalDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const parts = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const pick = (type: 'year' | 'month' | 'day'): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/**
 * 模型备案共享屏 — 平台无关 UI 组件(props 注入式,自身不 fetch)。
 *
 * 能力对齐 web `apps/web/app/(main)/settings/model-record/page.tsx`:
 * 4 张统计卡 → 搜索框 + 类型/批次筛选 → 记录卡片列表(移动端卡片形,不做 7 列横向表)
 * → 上一页/页码/下一页 → 备案公示图片 → 底部公告。
 *
 * 平台特定(取数、剪贴板、图片预览模态框、导航)全部由宿主经 props 注入:
 * RN 壳 = apps/mobile-rn/src/screens/ModelRecordScreen.tsx;
 * 小程序 = 同一 RN 壳经 rn-compat 兼容层承载(端内页面只包一层 ThemeRoot)。
 */
export function ModelRecordScreen({
  t,
  title,
  onBack,
  query,
  onKeywordChange,
  onKindChange,
  onBatchChange,
  onSearch,
  result,
  page,
  pageSize,
  onPageChange,
  loading,
  error,
  onCopy,
  images = [],
  onPreviewIndexChange,
  colorScheme = 'light',
}: ModelRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [aspects, setAspects] = useState<Record<number, number>>({})
  const [copiedNo, setCopiedNo] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 卸载时清掉复制提示定时器(不在已卸载组件上 setState)
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(result.total / Math.max(1, pageSize)))
  const stats = result.stats
  // 统计卡:未取到时展示 '-' 而非报错(与 web 同口径)
  const deepCount = stats
    ? String(result.kindCounts.find((k) => k.kind === KIND_DEEP)?.count ?? 0)
    : '-'
  const recommendCount = stats
    ? String(result.kindCounts.find((k) => k.kind === KIND_RECOMMEND)?.count ?? 0)
    : '-'
  const totalAll = stats ? String(stats.totalAll) : '-'
  const updatedAt = formatLocalDate(stats?.updatedAt ?? null)

  const kindOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: t('modelRecord.kindAll') },
      { value: KIND_DEEP, label: t('modelRecord.kindDeep') },
      { value: KIND_RECOMMEND, label: t('modelRecord.kindRecommend') },
    ],
    [t],
  )
  const batchOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: t('modelRecord.filterAllBatch') },
      ...result.batches.map((b) => ({ value: b, label: b })),
    ],
    [t, result.batches],
  )

  const statCards = useMemo(
    () => [
      {
        key: 'total',
        label: t('modelRecord.statsTotal'),
        value: totalAll,
        icon: <Database size={13} color={tk.text.tertiary} />,
      },
      {
        key: 'deep',
        label: t('modelRecord.statsDeep'),
        value: deepCount,
        icon: <Cpu size={13} color={tk.text.tertiary} />,
      },
      {
        key: 'recommend',
        label: t('modelRecord.statsRecommend'),
        value: recommendCount,
        icon: <ShieldCheck size={13} color={tk.text.tertiary} />,
      },
      {
        key: 'updated',
        label: t('modelRecord.updatedAt'),
        value: updatedAt,
        icon: <Clock size={13} color={tk.text.tertiary} />,
      },
    ],
    [t, totalAll, deepCount, recommendCount, updatedAt, tk.text.tertiary],
  )

  const handleCopy = (recordNo: string) => {
    onCopy(recordNo)
    setCopiedNo(recordNo)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopiedNo(null), COPIED_RESET_MS)
  }

  const handleImageLoad = (index: number) => (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source
    if (width > 0 && height > 0) {
      const ratio = width / height
      setAspects((prev) => (prev[index] === ratio ? prev : { ...prev, [index]: ratio }))
    }
  }

  const kindTextOf = (item: ModelRecordItem): string => {
    if (item.category) return item.category
    if (item.kind === KIND_DEEP) return t('modelRecord.kindDeep')
    if (item.kind === KIND_RECOMMEND) return t('modelRecord.kindRecommend')
    return item.kind
  }

  const prevDisabled = page <= 1 || loading
  const nextDisabled = page >= totalPages || loading

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? t('modelRecord.title')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('modelRecord.desc')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 统计概览:4 卡(两列自适应,最小宽兜住读数不折行) */}
        <View style={styles.statRow}>
          {statCards.map((card) => (
            <View key={card.key} style={styles.statCard}>
              <View style={styles.statLabelRow}>
                {card.icon}
                <Text style={styles.statLabel} numberOfLines={1}>
                  {card.label}
                </Text>
              </View>
              <Text style={styles.statValue} numberOfLines={1}>
                {card.value}
              </Text>
            </View>
          ))}
        </View>

        {/* 查询:关键字 + 类型 / 批次筛选 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('modelRecord.cardTitle')}</Text>
          <View style={styles.searchRow}>
            <TextField
              colorScheme={colorScheme}
              value={query.keyword}
              onChangeText={onKeywordChange}
              onSubmitEditing={onSearch}
              placeholder={t('modelRecord.searchPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              returnKeyType="search"
              style={styles.input}
            />
            <Pressable
              onPress={onSearch}
              accessibilityRole="button"
              accessibilityLabel={t('modelRecord.search')}
            >
              {({ pressed }) => (
                <View style={[styles.cta, pressed ? styles.ctaPressed : null]}>
                  <Search size={14} color={tk.brand.ctaForeground} />
                  <Text style={styles.ctaText}>{t('modelRecord.search')}</Text>
                </View>
              )}
            </Pressable>
          </View>
          <View style={styles.filterRow}>
            <SelectField
              t={t}
              label={t('modelRecord.algorithmType')}
              value={query.kind}
              options={kindOptions}
              onChange={onKindChange}
              styles={styles}
              tk={tk}
            />
            <SelectField
              t={t}
              label={t('modelRecord.batch')}
              value={query.batch}
              options={batchOptions}
              onChange={onBatchChange}
              styles={styles}
              tk={tk}
            />
          </View>
        </View>

        <Text style={styles.countLine}>{t('modelRecord.count', { total: result.total })}</Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={tk.brand.DEFAULT} />
            <Text style={styles.stateText}>{t('modelRecord.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateError}>{error}</Text>
          </View>
        ) : result.items.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{t('modelRecord.empty')}</Text>
          </View>
        ) : (
          <View style={styles.listBody}>
            {result.items.map((item) => {
              const copied = copiedNo === item.recordNo
              const rows: { label: string; value: string }[] = [
                { label: t('modelRecord.applicant'), value: item.provider },
                { label: t('modelRecord.product'), value: item.product ?? '-' },
                { label: t('modelRecord.purpose'), value: item.purpose ?? '-' },
                { label: t('modelRecord.algorithmType'), value: kindTextOf(item) },
                // 备案日期:后端当前不返回该列 ⇒ 端上不造值,取不到即整行不渲染
                ...(item.applyDate
                  ? [{ label: t('modelRecord.applyDate'), value: formatLocalDate(item.applyDate) }]
                  : []),
                { label: t('modelRecord.batch'), value: item.batch ?? '-' },
              ]
              return (
                <View key={item.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle} numberOfLines={2}>
                      {item.algName}
                    </Text>
                    <View style={styles.statusChip}>
                      <Text style={styles.statusChipText}>{t('modelRecord.statusFiled')}</Text>
                    </View>
                  </View>
                  <View style={styles.recordRows}>
                    {rows.map((row) => (
                      <View key={row.label} style={styles.metaRow}>
                        <Text style={styles.metaLabel}>{row.label}</Text>
                        <Text style={styles.metaValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.recordFooter}>
                    <Text style={styles.recordNo} numberOfLines={1} selectable>
                      {item.recordNo}
                    </Text>
                    <View style={styles.recordActions}>
                      <Pressable
                        onPress={() => handleCopy(item.recordNo)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          copied ? t('modelRecord.copied') : t('modelRecord.copy')
                        }
                      >
                        {({ pressed }) => (
                          <View style={[styles.copyBtn, pressed ? styles.pressedSoft : null]}>
                            {copied ? (
                              <Check size={13} color={tk.success.deep} />
                            ) : (
                              <Copy size={13} color={tk.text.medium} />
                            )}
                            <Text style={[styles.copyText, copied ? styles.copyTextDone : null]}>
                              {copied ? t('modelRecord.copied') : t('modelRecord.copy')}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                      {item.sourceUrl ? (
                        <Pressable
                          onPress={() => {
                            const url = item.sourceUrl
                            if (!url) return
                            void Linking.openURL(url).catch(() => {})
                          }}
                          accessibilityRole="link"
                          accessibilityLabel={t('modelRecord.source')}
                        >
                          {({ pressed }) => (
                            <View style={[styles.sourceBtn, pressed ? styles.pressedSoft : null]}>
                              <ExternalLink size={13} color={tk.text.medium} />
                              <Text style={styles.sourceText}>{t('modelRecord.source')}</Text>
                            </View>
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* 分页:上一页 / 页码 / 下一页(加载中与错误态不渲染) */}
        {!loading && !error && result.total > 0 ? (
          <View style={styles.pager}>
            <Pressable
              disabled={prevDisabled}
              onPress={() => onPageChange(Math.max(1, page - 1))}
              accessibilityRole="button"
              accessibilityLabel={t('modelRecord.prev')}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.pagerBtn,
                    prevDisabled ? styles.pagerBtnDisabled : null,
                    pressed && !prevDisabled ? styles.pressedSoft : null,
                  ]}
                >
                  <ChevronLeft size={14} color={prevDisabled ? tk.text.tertiary : tk.text.medium} />
                  <Text style={[styles.pagerText, prevDisabled ? styles.pagerTextDisabled : null]}>
                    {t('modelRecord.prev')}
                  </Text>
                </View>
              )}
            </Pressable>
            <Text style={styles.pagerInfo}>{t('modelRecord.pageInfo', { page, totalPages })}</Text>
            <Pressable
              disabled={nextDisabled}
              onPress={() => onPageChange(Math.min(totalPages, page + 1))}
              accessibilityRole="button"
              accessibilityLabel={t('modelRecord.next')}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.pagerBtn,
                    nextDisabled ? styles.pagerBtnDisabled : null,
                    pressed && !nextDisabled ? styles.pressedSoft : null,
                  ]}
                >
                  <Text style={[styles.pagerText, nextDisabled ? styles.pagerTextDisabled : null]}>
                    {t('modelRecord.next')}
                  </Text>
                  <ChevronRight
                    size={14}
                    color={nextDisabled ? tk.text.tertiary : tk.text.medium}
                  />
                </View>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* 备案公示图片(合规公示,列表之后渲染) */}
        {images.length > 0 ? (
          <View style={styles.imageCard}>
            {images.map((src, index) => (
              <Pressable
                key={index}
                onPress={() => onPreviewIndexChange?.(index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${t('modelRecord.title')} ${index + 1}`}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.imageWrap,
                      index === images.length - 1 ? styles.imageWrapLast : null,
                      pressed ? styles.pressedSoft : null,
                    ]}
                  >
                    <Image
                      source={src}
                      style={[
                        styles.imageBase,
                        aspects[index] ? { aspectRatio: aspects[index] } : styles.imageFallback,
                      ]}
                      resizeMode="contain"
                      onLoad={handleImageLoad(index)}
                    />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 底部公告 */}
        <View style={styles.noticeCard}>
          <ShieldCheck size={14} color={tk.text.medium} />
          <Text style={styles.noticeText}>{t('modelRecord.notice')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

/* ────────────────────────── 下拉选择(纯 RN,无三方库) ────────────────────────── */

interface SelectFieldProps {
  t: ModelRecordScreenProps['t']
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  styles: ReturnType<typeof createStyles>
  tk: AppThemeTokens
}

function SelectField({ t, label, value, options, onChange, styles, tk }: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const currentLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? ''
  const close = () => setOpen(false)

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${currentLabel}`}
      >
        {({ pressed }) => (
          <View style={[styles.selectBox, pressed ? styles.pressedSoft : null]}>
            <Text style={styles.selectValue} numberOfLines={1}>
              {currentLabel}
            </Text>
            <ChevronDown size={14} color={tk.text.tertiary} />
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {label}
            </Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const selected = opt.value === value
                return (
                  <Pressable
                    key={opt.value || '__all__'}
                    onPress={() => {
                      onChange(opt.value)
                      close()
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.sheetItem,
                          selected ? styles.sheetItemActive : null,
                          pressed && !selected ? styles.pressedSoft : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sheetItemText,
                            selected ? styles.sheetItemTextActive : null,
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                        {selected ? <Check size={14} color={tk.brand.ctaForeground} /> : null}
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

/* ────────────────────────── 样式(单份,两端共用) ────────────────────────── */

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    headerText: { flexShrink: 1, gap: rnSpacing['2xs'] },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: rnType.label.size, color: tk.text.tertiary },
    content: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
      gap: rnSpacing.md,
    },
    // 统计卡:两列自适应(flexBasis 定宽格必须带 minWidth,读数才不被压折)
    statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    statCard: {
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 140,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: rnSpacing['xs-loose'],
    },
    statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    statLabel: { flexShrink: 1, fontSize: rnType.caption.size, color: tk.text.tertiary },
    statValue: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tk.text.primary },
    // 查询卡
    sectionCard: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: rnSpacing.md,
    },
    sectionTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    input: {
      flex: 1,
      height: 38,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      height: 38,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      // CTA 成对取档:品牌实底 + 其上文字
      backgroundColor: tk.brand.cta,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.ctaForeground },
    filterRow: { flexDirection: 'row', gap: rnSpacing.sm },
    selectWrap: { flex: 1, gap: rnSpacing.xs },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.xs,
      height: 36,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.light,
    },
    selectValue: { flexShrink: 1, fontSize: rnType.body.size, color: tk.text.primary },
    pressedSoft: { backgroundColor: tk.surface.muted },
    countLine: { fontSize: rnType.label.size, color: tk.text.secondary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['3xl'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    stateText: { fontSize: rnType.body.size, color: tk.text.tertiary },
    stateError: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    listBody: { gap: rnSpacing.md },
    // 记录卡片
    recordCard: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: rnSpacing.md,
    },
    recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    recordTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    statusChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.success.light,
    },
    statusChipText: { fontSize: rnType.badge.size, fontWeight: '600', color: tk.success.deepText },
    recordRows: { gap: rnSpacing['xs-loose'] },
    metaRow: { flexDirection: 'row', gap: rnSpacing.sm },
    metaLabel: { width: 72, fontSize: rnType.label.size, color: tk.text.tertiary },
    metaValue: { flexShrink: 1, fontSize: rnType.label.size, color: tk.text.medium },
    recordFooter: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    recordNo: {
      flexShrink: 1,
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    recordActions: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
    },
    copyText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    copyTextDone: { color: tk.success.deep },
    sourceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
    },
    sourceText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    // 分页
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    pagerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.light,
    },
    pagerBtnDisabled: { borderColor: tk.border.light, backgroundColor: tk.surface.muted },
    pagerText: { fontSize: rnType.label.size, color: tk.text.medium },
    pagerTextDisabled: { color: tk.text.tertiary },
    pagerInfo: { fontSize: rnType.label.size, color: tk.text.secondary },
    // 备案公示图片
    imageCard: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    imageWrap: { marginBottom: rnSpacing.md },
    imageWrapLast: { marginBottom: 0 },
    imageBase: { width: '100%', borderRadius: rnRadius.sm, backgroundColor: tk.surface.muted },
    // 取不到自然尺寸时(小程序侧无 onLoad)按 0.62 竖屏比例占位,避免高度塌成 0
    imageFallback: { aspectRatio: 0.62 },
    // 底部公告
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    noticeText: {
      flexShrink: 1,
      fontSize: rnType.caption.size,
      lineHeight: rnType.caption.lineHeight + 3,
      color: tk.text.tertiary,
    },
    // 下拉弹层
    modalRoot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing['2xl'],
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: tk.overlay.modal,
    },
    sheet: {
      width: '100%',
      maxWidth: 360,
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    sheetTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    sheetList: { maxHeight: 320 },
    sheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
    },
    sheetItemActive: { backgroundColor: tk.brand.cta },
    sheetItemText: { flexShrink: 1, fontSize: rnType.body.size, color: tk.text.primary },
    sheetItemTextActive: { color: tk.brand.ctaForeground, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
