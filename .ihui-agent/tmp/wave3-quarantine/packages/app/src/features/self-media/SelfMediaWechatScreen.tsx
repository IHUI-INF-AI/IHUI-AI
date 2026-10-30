import { useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { CheckCircle2, FileText, History, Send, ShieldCheck, XCircle } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * 公众号稿流水线共享屏 —— 承载 web `/self-media/wechat`
 * (apps/web/app/(main)/self-media/wechat/page.tsx:198-465)。
 *
 * 平台无关:表单态住在本地(纯 UI),取数与三段 POST 由薄壳注入
 * (generateWechatArticle / validateWechatArticle / publishWechatArticle / listWechatHistory)。
 *
 * 与 web 的有意差异(逐条理由,非漏做):
 *  - web 的「上传 md」按钮(:238-247,`<input type=file>`)与「复制/下载/清空」三个
 *    文本操作是浏览器 DOM 能力;RN 侧对应物需要 DocumentPicker/剪贴板新依赖,
 *    本屏只保留**在线编辑正文**这条同义入口(后端 generate 的 mdContent 分支,
 *    self_media.py:519-521),不做点了没反应的按钮。
 *  - web 的「一键流水线」(runAll,:153-196)在 web 侧是**硬编码中文**、无 i18n 键;
 *    RN 文案纪律禁止自造翻译(五语取值必须逐字抄同页面的 web 文案),故本屏
 *    不新增该聚合按钮,三段各自可点已覆盖同一批端点。
 *  - 历史条目点击回填(web applyHistory,:75-81)原样保留。
 */

/** 与 @ihui/api-client 的 WechatPipelineResult 同形(共享层不依赖 api-client,故本地声明) */
export interface WechatPipelineResultView {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  stage?: string
  returncode?: number
  mdPath?: string
  duration_ms?: number
  dryRun?: boolean
}

/** 与 @ihui/api-client 的 WechatHistoryItem 同形 */
export interface WechatHistoryItemView {
  id: string
  title: string
  status: string
  createdAt?: string | null
  payload?: { title?: string; digest?: string; mdPath?: string; cover?: string; topic?: string }
}

/** 三段流水线 + 下拉刷新时正在执行的那一段(null=空闲) */
export type WechatPipelineOp = 'generate' | 'validate' | 'publish'

export interface WechatFormState {
  title: string
  digest: string
  mdPath: string
  mdContent: string
  cover: string
}

export interface SelfMediaWechatScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 历史列表(GET /api/self-media/wechat/history) */
  history: WechatHistoryItemView[]
  historyLoading: boolean
  historyError: string | null
  /** 当前正在执行的操作;命中时三段按钮全部禁用(与 web running!==null 同口径) */
  running: WechatPipelineOp | null
  result: WechatPipelineResultView | null
  /** 薄壳按 op 调对应端点并把结果写回 result;mdPath 回填由薄壳负责 */
  onSubmit: (op: WechatPipelineOp, form: WechatFormState) => void
  /** 历史条目回填(与 web applyHistory 同语义) */
  onApplyHistory: (item: WechatHistoryItemView) => void
  /** 下拉刷新历史(无文案,免自造翻译) */
  onRefreshHistory: () => void
}

const INITIAL_FORM: WechatFormState = {
  title: '',
  digest: '',
  mdPath: '',
  mdContent: '',
  cover: '',
}

/** 状态 → 徽章配色(对齐 web STATUS 上色:published 绿 / failed 红 / 其余中性) */
function statusColors(tk: AppThemeTokens, status: string): { bg: string; fg: string } {
  if (status === 'published') return { bg: tk.success.lightest, fg: tk.success.deepText }
  if (status === 'failed') return { bg: tk.danger.light, fg: tk.danger.DEFAULT }
  return { bg: tk.surface.muted, fg: tk.text.secondary }
}

export function SelfMediaWechatScreen({
  t,
  colorScheme,
  onBack,
  history,
  historyLoading,
  historyError,
  running,
  result,
  onSubmit,
  onApplyHistory,
  onRefreshHistory,
}: SelfMediaWechatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [form, setForm] = useState<WechatFormState>(INITIAL_FORM)

  const patch = (key: keyof WechatFormState) => (value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const busy = running !== null
  const canGenerate = form.title.trim().length >= 2 && !busy
  const canValidate = form.mdPath.trim().length > 0 && !busy
  const canPublish = canValidate && form.title.trim().length >= 2

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('selfMediaWechatPage.formTitle')}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={historyLoading}
            onRefresh={onRefreshHistory}
            tintColor={tk.text.secondary}
            colors={[tk.brand.DEFAULT]}
          />
        }
      >
        {/* ── 表单卡 ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('selfMediaWechatPage.formTitle')}</Text>

          <Text style={styles.label}>{t('selfMediaWechatPage.titleLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={patch('title')}
            placeholder={t('selfMediaWechatPage.titlePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={200}
            accessibilityLabel={t('selfMediaWechatPage.titleLabel')}
          />

          <Text style={styles.label}>{t('selfMediaWechatPage.digestLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.digest}
            onChangeText={patch('digest')}
            placeholder={t('selfMediaWechatPage.digestPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={500}
            accessibilityLabel={t('selfMediaWechatPage.digestLabel')}
          />

          <Text style={styles.label}>{t('selfMediaWechatPage.mdPathLabel')}</Text>
          <TextInput
            style={styles.textarea}
            value={form.mdContent}
            onChangeText={patch('mdContent')}
            placeholder={t('selfMediaWechatPage.mdPathPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            multiline
            textAlignVertical="top"
            maxLength={200000}
            accessibilityLabel={t('selfMediaWechatPage.mdPathLabel')}
          />
          {form.mdPath.length > 0 ? (
            <Text style={styles.mdPathText} numberOfLines={2}>
              {form.mdPath}
            </Text>
          ) : null}

          <Text style={styles.label}>{t('selfMediaWechatPage.coverLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.cover}
            onChangeText={patch('cover')}
            placeholder={t('selfMediaWechatPage.coverPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={500}
            accessibilityLabel={t('selfMediaWechatPage.coverLabel')}
          />

          <View style={styles.actionsRow}>
            <OpButton
              styles={styles}
              label={t('selfMediaWechatPage.generate')}
              icon={<FileText size={rnType.label.size} color={tk.brand.ctaForeground} />}
              busy={running === 'generate'}
              disabled={!canGenerate}
              tone="primary"
              onPress={() => onSubmit('generate', form)}
            />
            <OpButton
              styles={styles}
              label={t('selfMediaWechatPage.validate')}
              icon={<ShieldCheck size={rnType.label.size} color={tk.text.secondary} />}
              busy={running === 'validate'}
              disabled={!canValidate}
              tone="outline"
              onPress={() => onSubmit('validate', form)}
            />
            <OpButton
              styles={styles}
              label={t('selfMediaWechatPage.publishDryRun')}
              icon={<Send size={rnType.label.size} color={tk.text.secondary} />}
              busy={running === 'publish'}
              disabled={!canPublish}
              tone="outline"
              onPress={() => onSubmit('publish', form)}
            />
          </View>
        </View>

        {/* ── 运行结果卡(与 web 一致:有结果才出现) ── */}
        {result ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('selfMediaWechatPage.resultTitle')}</Text>
            <View style={styles.resultHead}>
              {result.ok ? (
                <CheckCircle2 size={16} color={tk.success.deepText} />
              ) : (
                <XCircle size={16} color={tk.danger.DEFAULT} />
              )}
              <Text
                style={[
                  styles.resultHeadText,
                  { color: result.ok ? tk.success.deepText : tk.danger.DEFAULT },
                ]}
              >
                {result.ok
                  ? t('selfMediaWechatPage.runSuccess')
                  : t('selfMediaWechatPage.runFailed')}
                {typeof result.returncode === 'number' ? ` (rc=${result.returncode})` : ''}
              </Text>
            </View>
            {result.error ? (
              <View style={styles.resultErrorBox}>
                <Text style={styles.resultErrorText}>{result.error}</Text>
              </View>
            ) : null}
            {result.stdout ? (
              <View style={styles.resultMonoBox}>
                <Text style={styles.resultMonoText}>{result.stdout}</Text>
              </View>
            ) : null}
            {result.stderr ? (
              <View style={styles.resultWarnBox}>
                <Text style={styles.resultWarnText}>{result.stderr}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── 历史记录卡 ── */}
        <View style={styles.card}>
          <View style={styles.historyHead}>
            <History size={16} color={tk.text.secondary} />
            <Text style={styles.cardTitle}>{t('selfMediaWechatPage.historyTitle')}</Text>
          </View>

          {historyError ? (
            <ErrorState
              message={historyError}
              onRetry={onRefreshHistory}
              retryLabel={t('selfMediaWechatPage.historyTitle')}
              colorScheme={colorScheme}
            />
          ) : historyLoading && history.length === 0 ? (
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} style={styles.historySpin} />
          ) : history.length === 0 ? (
            <EmptyState
              title={t('selfMediaWechatPage.historyEmpty')}
              colorScheme={colorScheme}
            />
          ) : (
            history.map((item) => {
              const badge = statusColors(tk, item.status)
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onApplyHistory(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  style={({ pressed }) => [
                    styles.historyRow,
                    pressed ? styles.historyRowPressed : null,
                  ]}
                >
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.historyMetaRow}>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{item.status}</Text>
                    </View>
                    {item.createdAt ? (
                      <Text style={styles.historyDate}>{item.createdAt.slice(0, 10)}</Text>
                    ) : null}
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function OpButton({
  styles,
  label,
  icon,
  busy,
  disabled,
  tone,
  spinnerColor,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>
  label: string
  icon: ReactNode
  busy: boolean
  disabled: boolean
  tone: 'primary' | 'outline'
  /** 走马灯取色必须由调用方给 token(共享层零硬编码色值) */
  spinnerColor: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.opBtn,
        tone === 'primary' ? styles.opBtnPrimary : styles.opBtnOutline,
        disabled ? styles.opBtnDisabled : null,
        pressed && !disabled ? styles.opBtnPressed : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={tone === 'primary' ? '#FFFFFF' : undefined}
          style={styles.opBtnSpin}
        />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.opBtnText,
          tone === 'primary' ? styles.opBtnTextPrimary : styles.opBtnTextOutline,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
    },
    headerTitle: {
      flex: 1,
      fontSize: rnType.subtitle.size,
      fontWeight: '700',
      color: tk.text.primary,
      textAlign: 'center',
    },
    headerSidePlaceholder: { width: 32 },
    scroll: { flex: 1 },
    scrollContent: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: 32 },
    card: {
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    label: { fontSize: rnType.label.size, color: tk.text.secondary, marginTop: rnSpacing.xs },
    input: {
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textarea: {
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      minHeight: 140,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    mdPathText: { fontSize: rnType.label.size, color: tk.text.tertiary },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginTop: rnSpacing.sm },
    opBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    opBtnPrimary: { backgroundColor: tk.brand.cta },
    opBtnOutline: {
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    opBtnDisabled: { opacity: 0.45 },
    opBtnPressed: { opacity: 0.7 },
    opBtnSpin: { marginHorizontal: 2 },
    opBtnText: { fontSize: rnType.label.size, fontWeight: '500' },
    opBtnTextPrimary: { color: tk.brand.ctaForeground },
    opBtnTextOutline: { color: tk.text.secondary },
    resultHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    resultHeadText: { fontSize: rnType.body.size, fontWeight: '600', flex: 1 },
    resultErrorBox: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
      padding: rnSpacing.sm,
    },
    resultErrorText: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    resultMonoBox: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      padding: rnSpacing.sm,
    },
    resultMonoText: { fontSize: rnType.label.size, color: tk.text.primary },
    resultWarnBox: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.warning.amberLight,
      padding: rnSpacing.sm,
    },
    resultWarnText: { fontSize: rnType.label.size, color: tk.warning.amberText },
    historyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    historySpin: { paddingVertical: rnSpacing.lg },
    historyRow: {
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      gap: 2,
    },
    historyRowPressed: { backgroundColor: tk.surface.muted },
    historyTitle: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.primary },
    historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: {
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
    },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '500' },
    historyDate: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
