// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native'
import { CheckCircle2, FileText, History, Send, XCircle } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

const NS = 'selfMediaWechatPage'

export type WechatBusyOp = 'generate' | 'validate' | 'publish'

export interface WechatHistoryRowView {
  id: string
  title: string
  /** 薄壳按 web 同口径给的状态文案(generated/published/failed 原样或本地化) */
  statusText: string
  /** 与 web `text-emerald-600 / text-rose-600 / muted` 同档 */
  statusTone: 'ok' | 'failed' | 'neutral'
  /** 薄壳按 locale 格式化的日期(web formatDateOnly) */
  timeText: string
}

export interface WechatRunView {
  ok: boolean
  returncode: number | null
  error: string | null
  stdout: string | null
  stderr: string | null
}

export interface SelfMediaWechatScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(本页所有端点均要求登录,web 由 api 401 → 登录弹窗同口径) */
  loginRequiredText: string
  title: string
  digest: string
  mdPath: string
  mdContent: string
  cover: string
  onChangeTitle: (value: string) => void
  onChangeDigest: (value: string) => void
  onChangeMdPath: (value: string) => void
  onChangeMdContent: (value: string) => void
  onChangeCover: (value: string) => void
  /** 正在跑的动作(三按钮互斥,与 web running 同语义) */
  busyOp: WechatBusyOp | null
  /** web 同口径禁用条件:generate 需 title、validate 需 mdPath、publish 需 mdPath+title */
  canGenerate: boolean
  canValidate: boolean
  canPublish: boolean
  onGenerate: () => void
  onValidate: () => void
  onPublish: () => void
  result: WechatRunView | null
  history: WechatHistoryRowView[]
  historyLoading: boolean
  historyError: string | null
  onApplyHistory: (id: string) => void
  onRefreshHistory: () => void
}

/**
 * 公众号文章流水线共享屏 —— 承载 web /self-media/wechat
 * (POST /api/self-media/wechat/{generate,validate,publish} + GET .../history)。
 *
 * 与 web 的口径差(如实登记):
 *  - web 的「上传 md / 复制 / 下载 / 清空 / 一键流水线」五处按钮文案是**页面内硬编码中文**,
 *    packages/i18n/messages/web/* 五语里没有对应键 ⇒ RN 不新造翻译,也不做注定无文案的死按钮,
 *    只保留有 i18n 值的 generate / validate / publish 三个动作 + mdContent 文本框(可粘贴正文)。
 *  - 表单校验与按钮禁用条件与 web 逐条同值(page.tsx:319/331/351)。
 *  - 平台无关:取数 / 组装请求 / 日期格式化 / 登录态由薄壳注入;本文件只渲染三态。
 */
export function SelfMediaWechatScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  title,
  digest,
  mdPath,
  mdContent,
  cover,
  onChangeTitle,
  onChangeDigest,
  onChangeMdPath,
  onChangeMdContent,
  onChangeCover,
  busyOp,
  canGenerate,
  canValidate,
  canPublish,
  onGenerate,
  onValidate,
  onPublish,
  result,
  history,
  historyLoading,
  historyError,
  onApplyHistory,
  onRefreshHistory,
}: SelfMediaWechatScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, toneStyle } = useMemo(() => createStyles(tk), [tk])
  const busy = busyOp !== null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleRow}>
          <FileText size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.formTitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.label}>{t(`${NS}.titleLabel`)}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={title}
              onChangeText={onChangeTitle}
              placeholder={t(`${NS}.titlePlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
            />

            <Text style={styles.label}>{t(`${NS}.digestLabel`)}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={digest}
              onChangeText={onChangeDigest}
              placeholder={t(`${NS}.digestPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
            />

            <Text style={styles.label}>{t(`${NS}.mdPathLabel`)}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={mdPath}
              onChangeText={onChangeMdPath}
              placeholder={t(`${NS}.mdPathPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
            />
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, styles.textarea]}
              value={mdContent}
              onChangeText={onChangeMdContent}
              placeholder={t(`${NS}.mdPathPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t(`${NS}.coverLabel`)}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={cover}
              onChangeText={onChangeCover}
              placeholder={t(`${NS}.coverPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
            />

            <View style={styles.actionRow}>
              <ActionButton
                text={t(`${NS}.generate`)}
                disabled={!canGenerate || busy}
                busy={busyOp === 'generate'}
                tone="primary"
                icon={<FileText size={14} color={tk.brand.foreground} />}
                styles={styles}
                onPress={onGenerate}
                colorScheme={colorScheme}
              />
              <ActionButton
                text={t(`${NS}.validate`)}
                disabled={!canValidate || busy}
                busy={busyOp === 'validate'}
                tone="outline"
                icon={<CheckCircle2 size={14} color={tk.text.primary} />}
                styles={styles}
                onPress={onValidate}
                colorScheme={colorScheme}
              />
              <ActionButton
                text={t(`${NS}.publishDryRun`)}
                disabled={!canPublish || busy}
                busy={busyOp === 'publish'}
                tone="outline"
                icon={<Send size={14} color={tk.text.primary} />}
                styles={styles}
                onPress={onPublish}
                colorScheme={colorScheme}
              />
            </View>
          </View>

          {result ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t(`${NS}.resultTitle`)}</Text>
              <View style={styles.resultHead}>
                {result.ok ? (
                  <CheckCircle2 size={16} color={tk.success.deep} />
                ) : (
                  <XCircle size={16} color={tk.danger.DEFAULT} />
                )}
                <Text style={[styles.resultText, result.ok ? styles.okText : styles.failedText]}>
                  {result.ok ? t(`${NS}.runSuccess`) : t(`${NS}.runFailed`)}
                  {result.returncode !== null ? ` (rc=${result.returncode})` : ''}
                </Text>
              </View>
              {result.error ? <Text style={styles.preFailed}>{result.error}</Text> : null}
              {result.stdout ? <Text style={styles.pre}>{result.stdout}</Text> : null}
              {result.stderr ? <Text style={styles.preWarn}>{result.stderr}</Text> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.historyHead}>
              <History size={16} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.historyTitle`)}</Text>
              <TouchableOpacity onPress={onRefreshHistory} disabled={historyLoading}>
                <Text style={styles.refreshText}>
                  {historyLoading ? t('common.loading') : t('common.retry')}
                </Text>
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t('common.loading')}</Text>
              </View>
            ) : historyError ? (
              <Text style={styles.error}>{historyError}</Text>
            ) : history.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.historyEmpty`)}</Text>
            ) : (
              history.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={styles.historyRow}
                  onPress={() => onApplyHistory(row.id)}
                >
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <View style={styles.historyMeta}>
                    <Text style={[styles.historyStatus, toneStyle[row.statusTone]]}>
                      {row.statusText}
                    </Text>
                    {row.timeText ? (
                      <Text style={styles.muted}>{`· ${row.timeText}`}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function ActionButton({
  text,
  disabled,
  busy,
  tone,
  icon,
  styles,
  onPress,
  colorScheme,
}: {
  text: string
  disabled: boolean
  busy: boolean
  tone: 'primary' | 'outline'
  icon: ReactNode
  styles: ReturnType<typeof createStyles>['styles']
  onPress: () => void
  colorScheme: AppThemeMode
}) {
  const tk = getTokens(colorScheme)
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        tone === 'primary' ? styles.actionPrimary : styles.actionOutline,
        disabled && styles.actionDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={tone === 'primary' ? tk.brand.foreground : tk.text.primary}
        />
      ) : (
        icon
      )}
      <Text style={tone === 'primary' ? styles.actionPrimaryText : styles.actionOutlineText}>
        {text}
      </Text>
    </TouchableOpacity>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    label: { fontSize: rnType.label.size, color: tk.text.secondary },
    input: {
      minHeight: 40,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textarea: { minHeight: 120, paddingTop: rnSpacing.sm },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
    },
    actionPrimary: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    actionOutline: { backgroundColor: 'transparent', borderColor: tk.border.medium },
    actionDisabled: { opacity: 0.45 },
    actionPrimaryText: { fontSize: rnType.label.size, color: tk.brand.ctaForeground },
    actionOutlineText: { fontSize: rnType.label.size, color: tk.text.primary },
    resultHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    resultText: { fontSize: rnType.body.size, fontWeight: '500' },
    okText: { color: tk.success.deep },
    failedText: { color: tk.danger.DEFAULT },
    pre: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    preFailed: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
      fontSize: rnType.caption.size,
      color: tk.danger.DEFAULT,
    },
    preWarn: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.warning.amberLight,
      fontSize: rnType.caption.size,
      color: tk.warning.amberText,
    },
    historyHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    refreshText: { marginLeft: 'auto', fontSize: rnType.label.size, color: tk.brandAccent.deep },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.lg,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    historyRow: {
      gap: 2,
      paddingVertical: rnSpacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tk.border.light,
    },
    historyTitle: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.primary },
    historyMeta: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    historyStatus: { fontSize: rnType.caption.size },
  })

  const toneStyle: Record<WechatHistoryRowView['statusTone'], TextStyle> = {
    ok: { color: tk.success.deep },
    failed: { color: tk.danger.DEFAULT },
    neutral: { color: tk.text.secondary },
  }

  return { styles, toneStyle }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
