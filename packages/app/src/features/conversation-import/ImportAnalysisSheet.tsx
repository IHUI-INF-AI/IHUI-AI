// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 跨端共享 UI:不含平台 API。发起分析的**唯一出口**是 onSubmit 回调,由调用端(RN)接到既有 streamChat。
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { AlertTriangle, Sparkles } from 'lucide-react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'
import { buildAnalysisPrompt, type ImportSource } from '@ihui/shared/import-analysis'
import type {
  ImportAnalysisCategory,
  ImportAnalysisScenario,
} from '@ihui/shared/import-analysis/scenarios'

/**
 * 导入会话「用场景分析」弹层(RN 端,2026-10-03)
 *
 * 与 web 端 `apps/web/src/components/ai/import-analysis-dialog.tsx` 同款三段结构
 * (选场景 → 填 variables → 发起),但**刻意不共用组件**:web 用 Radix Dialog + shadcn,
 * 本屏用 RN Modal,两套 UI 基座无共同抽象层,硬抽组件只会造出一个两端都要传一堆 props 的空壳。
 * 真正共享的是**判据与目录**(下沉到 `@ihui/shared/import-analysis*`),故两端对同一份
 * 导入记录给出的推荐场景、拼出的分析指令必然一致 —— 这才是不能漂移的部分。
 *
 * 目录按需加载:`await import('@ihui/shared/import-analysis/scenarios')` 连带 492KB 投影,
 * 静态 import 会让**每一个**引用本弹层的 RN bundle 都背上它。RN 首屏是会话列表,
 * 用户未必进导入流程,故挂载后再 load(见下方 catalog 状态)。
 *
 * 发起不新造 LLM 调用链:onSubmit 抛出一条**普通用户消息**,由 RN 端接既有 streamChat
 * (与 P1.4 网页链接 `send(url)` 同一出口),历史里的导入消息即本轮上下文。
 */
export type ImportAnalysisTFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string

export interface ImportAnalysisSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
  /** 导入来源(决定推荐场景);null = 非导入会话,只给全库 */
  readonly source: ImportSource | null
  readonly colorScheme?: AppThemeMode
  readonly t: ImportAnalysisTFunction
  /** 变量默认值(如 wechat 场景把 raw_info 预填为"本次导入的聊天记录") */
  readonly initialVariables?: Readonly<Record<string, string>>
  /** 发起:把拼好的分析指令作为普通用户消息交给既有聊天通道 */
  readonly onSubmit: (prompt: string) => void
}

/** 目录加载态(动态 import 的真实阶段,不是"假装在加载") */
type CatalogState =
  | { phase: 'loading' }
  | {
      phase: 'ready'
      categories: readonly ImportAnalysisCategory[]
      recommended: ImportAnalysisScenario[]
      all: readonly ImportAnalysisScenario[]
    }
  | { phase: 'error'; message: string }

export function ImportAnalysisSheet({
  visible,
  onClose,
  source,
  colorScheme = 'light',
  t,
  initialVariables,
  onSubmit,
}: ImportAnalysisSheetProps) {
  const tk = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tk), [tk])

  const [catalog, setCatalog] = useState<CatalogState>({ phase: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [browseOpen, setBrowseOpen] = useState(false)

  // 未填变量的占位提示(i18n 一处,预览与发起共用同一个函数)
  const pendingLabel = useCallback(
    (name: string) => t('conversationImport.analysisPendingVar', { name }),
    [t],
  )

  // 目录动态加载:仅在弹层打开时拉一次,关闭后保留已加载结果(重开不再等)
  useEffect(() => {
    if (!visible || catalog.phase === 'ready') return
    let cancelled = false
    setCatalog({ phase: 'loading' })
    void import('@ihui/shared/import-analysis/scenarios')
      .then((m) => {
        if (cancelled) return
        setCatalog({
          phase: 'ready',
          categories: m.listCategories(),
          recommended: m.recommendedScenarios(source),
          all: m.listScenarios(),
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setCatalog({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [visible, catalog.phase, source])

  const selected: ImportAnalysisScenario | null =
    catalog.phase === 'ready' && selectedId !== null
      ? (catalog.all.find((s) => s.id === selectedId) ?? null)
      : null

  // 选中新场景时重置变量表单:上一个场景的 {var} 与新场景无关,留着等于预填错值
  const handleSelect = useCallback(
    (s: ImportAnalysisScenario) => {
      setSelectedId(s.id)
      setVariables({ ...(initialVariables ?? {}) })
    },
    [initialVariables],
  )

  const preview = useMemo(
    () => (selected ? buildAnalysisPrompt(selected, variables, pendingLabel) : null),
    [selected, variables, pendingLabel],
  )

  const handleSubmit = useCallback(() => {
    if (!selected || !preview) return
    onSubmit(preview)
  }, [selected, preview, onSubmit])

  const inCategory =
    catalog.phase === 'ready' && categoryId !== null
      ? catalog.all.filter((s) => s.categoryId === categoryId)
      : []

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('conversationImport.analysisTitle')}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>{t('conversationImport.analysisClose')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>{t('conversationImport.analysisDesc')}</Text>

          {catalog.phase === 'loading' && (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
              <Text style={styles.hint}>{t('conversationImport.analysisLoading')}</Text>
            </View>
          )}

          {catalog.phase === 'error' && (
            <View style={styles.errorBox}>
              <AlertTriangle size={13} color={tk.danger.DEFAULT} />
              <Text style={styles.errorText}>
                {t('conversationImport.analysisLoadFailed', { error: catalog.message })}
              </Text>
            </View>
          )}

          {catalog.phase === 'ready' && (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
              {/* ① 选场景:推荐区(按来源给默认)+ 全库浏览 */}
              <Text style={styles.sectionTitle}>
                {t('conversationImport.analysisScenarioLabel')}
              </Text>
              {catalog.recommended.length > 0 && (
                <>
                  <Text style={styles.hint}>{t('conversationImport.analysisRecommended')}</Text>
                  {catalog.recommended.map((s) => (
                    <ScenarioRow
                      key={s.id}
                      title={s.title}
                      subtitle={s.useCase || s.description}
                      active={selectedId === s.id}
                      onPress={() => handleSelect(s)}
                      styles={styles}
                    />
                  ))}
                </>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.browseToggle}
                onPress={() => setBrowseOpen((v) => !v)}
              >
                <Text style={styles.linkText}>
                  {t('conversationImport.analysisBrowseAll', { count: catalog.all.length })}
                </Text>
              </TouchableOpacity>

              {browseOpen && (
                <View style={styles.browseBox}>
                  <Text style={styles.hint}>{t('conversationImport.analysisCategoryLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryRow}>
                      <CategoryChip
                        label={t('conversationImport.analysisAllCategories')}
                        active={categoryId === null}
                        onPress={() => setCategoryId(null)}
                        tk={tk}
                        styles={styles}
                      />
                      {catalog.categories.map((c) => (
                        <CategoryChip
                          key={c.id}
                          label={`${c.categoryZh}(${c.count})`}
                          active={categoryId === c.id}
                          onPress={() => setCategoryId(c.id)}
                          tk={tk}
                          styles={styles}
                        />
                      ))}
                    </View>
                  </ScrollView>
                  {categoryId !== null &&
                    inCategory.map((s) => (
                      <ScenarioRow
                        key={s.id}
                        title={s.title}
                        subtitle=""
                        active={selectedId === s.id}
                        onPress={() => handleSelect(s)}
                        styles={styles}
                      />
                    ))}
                </View>
              )}

              {/* ② 填 variables */}
              {selected && (
                <View>
                  <Text style={styles.sectionTitle}>
                    {t('conversationImport.analysisVariablesLabel', { title: selected.title })}
                  </Text>
                  {selected.variables.length === 0 ? (
                    <Text style={styles.hint}>{t('conversationImport.analysisNoVariables')}</Text>
                  ) : (
                    selected.variables.map((name) => (
                      <View key={name} style={styles.field}>
                        <Text style={styles.fieldLabel}>{name}</Text>
                        <TextInput
                          style={styles.input}
                          value={variables[name] ?? ''}
                          placeholder={t('conversationImport.analysisVarPlaceholder', { name })}
                          placeholderTextColor={tk.text.tertiary}
                          onChangeText={(v) => setVariables((prev) => ({ ...prev, [name]: v }))}
                        />
                      </View>
                    ))
                  )}
                  <Text style={styles.hint}>{t('conversationImport.analysisOptionalHint')}</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ③ 发起 */}
          {catalog.phase === 'ready' && (
            <View style={styles.footer}>
              <Text style={styles.footerHint} numberOfLines={2}>
                {selected
                  ? t('conversationImport.analysisEstimate', {
                      tokens: selected.estimatedTokens,
                      difficulty: selected.difficulty,
                    })
                  : t('conversationImport.analysisPickFirst')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.submit, !selected || !preview ? styles.submitDisabled : null]}
                onPress={handleSubmit}
                disabled={!selected || !preview}
              >
                <Sparkles size={15} color={tk.brand.ctaForeground} />
                <Text style={styles.submitText}>{t('conversationImport.analysisSubmit')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

/** 一个可选场景(推荐区与全库浏览共用同一种行形态) */
function ScenarioRow({
  title,
  subtitle,
  active,
  onPress,
  styles,
}: {
  title: string
  subtitle: string
  active: boolean
  onPress: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.scenarioRow, active ? styles.scenarioRowActive : null]}
      onPress={onPress}
    >
      <Text style={styles.scenarioTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle !== '' && (
        <Text style={styles.scenarioSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  )
}

/** 分类胶囊(横向滚动) */
function CategoryChip({
  label,
  active,
  onPress,
  tk,
  styles,
}: {
  label: string
  active: boolean
  onPress: () => void
  tk: AppThemeTokens
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.chip, active ? styles.chipActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active ? styles.chipActiveText : { color: tk.text.medium }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '88%',
      padding: 16,
      gap: 8,
      // 档位表单源:panel 角色档 = xl(12px),不得写死数字(守门 77 B1 / §4 圆角单一源头)
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    close: { fontSize: 13, color: tk.text.secondary },
    desc: { fontSize: 12, lineHeight: 18, color: tk.text.secondary },
    stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    scroll: { maxHeight: 460 },
    scrollBody: { gap: 8, paddingBottom: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    hint: { fontSize: 11, lineHeight: 16, color: tk.text.tertiary },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      padding: 8,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.danger.DEFAULT + '22',
    },
    errorText: { flex: 1, fontSize: 11, lineHeight: 16, color: tk.danger.DEFAULT },
    scenarioRow: {
      padding: 10,
      gap: 2,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    scenarioRowActive: { borderColor: tk.brandAccent.deep, backgroundColor: tk.surface.muted },
    scenarioTitle: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    scenarioSubtitle: { fontSize: 11, lineHeight: 15, color: tk.text.tertiary },
    browseToggle: { paddingVertical: 6 },
    browseBox: {
      gap: 6,
      padding: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    chipActive: {
      // 选中态是纯品牌实底。原先另写一圈与填充同色的 borderColor(不可见环),按门 83 R3
      // 计一笔"实底未与配对前景成文"的债。去掉那圈环并用等值 padding 补回 1px:
      // 盒子尺寸与字形位置逐像素不变(10+1 / 5+1),不是靠豁免消账。
      backgroundColor: tk.brand.cta,
      borderWidth: 0,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    // 配对前景必须落进**与底同名前缀**的样式键(而不是行内 style),门 83 R3 才认得到兄弟配对:
    // chipActive × chipActiveText 成对 ⇒ 免债;叫 chipTextActive 时底那侧配不上,行内色它更看不见。
    chipActiveText: { color: tk.brand.ctaForeground },
    chipText: { fontSize: 11 },
    linkText: { fontSize: 12, color: tk.brand.dark },
    field: { gap: 2, marginBottom: 6 },
    fieldLabel: { fontSize: 11, color: tk.text.secondary },
    input: {
      height: 34,
      paddingHorizontal: 8,
      fontSize: 12,
      color: tk.text.primary,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    },
    footerHint: { flex: 1, fontSize: 11, color: tk.text.tertiary },
    submit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 36,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitDisabled: { backgroundColor: tk.border.medium },
    submitText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
