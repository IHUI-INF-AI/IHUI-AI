// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronRight,
  Clock,
  Coins,
  History,
  LineChart,
  TrendingUp,
  X,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'stockAnalysePage'

export interface StockAnalyseBalanceView {
  total: number
  used: number
  remaining: number
}

export interface StockAnalyseResultView {
  conversationId: string
  symbol: string
  /** 分析正文 */
  analysis: string
  tokensUsed: number
  /** 薄壳按同参 Intl 格式化后的时间 */
  timeText: string
  /** mock 分支的后端错误说明（可空） */
  errorText: string
}

export interface StockAnalyseScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门（web useAuthGate 同口径） */
  loginRequiredText: string
  /** 余额卡三值 */
  balance: StockAnalyseBalanceView
  /** 已用百分比（0-100，薄壳用 clampPercent 算） */
  usedPercent: number
  balanceLoading: boolean
  balanceError: string | null
  /** 表单 */
  symbolValue: string
  onSymbolChange: (text: string) => void
  questionValue: string
  onQuestionChange: (text: string) => void
  questionMaxLength: number
  analysing: boolean
  canAnalyse: boolean
  onAnalyse: () => void
  /** 分析错误（余额不足 / 一般错误） */
  analyseError: string | null
  analyseErrorTitle: string
  /** 分析结果（null = 尚未分析） */
  result: StockAnalyseResultView | null
  /** mock 警告文案（后端未配置分析服务时） */
  mockWarningText: string
  /** 历史 */
  historyLoading: boolean
  historyError: string | null
  historyRows: StockAnalyseResultView[]
  /** 点击历史条目打开详情 */
  onSelectHistory: (conversationId: string) => void
  /** 历史详情弹窗 */
  detailVisible: boolean
  detail: StockAnalyseResultView | null
  onCloseDetail: () => void
}

/**
 * AI 股票分析共享屏 —— 承载 web /stock
 * (GET /api/stock/token-balance + POST /api/stock/analyse + GET /api/stock/history)。
 *
 * 与 web 的口径差（如实登记，详见 manifest ledger）：
 *  - web 是「余额卡 + 表单卡 + 结果卡 + 历史卡 + 历史详情 Dialog」，
 *    RN 落为同构的纵向卡片 + 详情 Modal。
 *  - web 进度条按已用百分比分档配色（>=90 rose / >=60 amber / 否则 primary），
 *    RN 用同一阈值取令牌档（danger / warning / brand），阈值与 web 一致。
 *  - web 分析成功但服务未配置时展示 mock 警告（result.mock || result.error），
 *    RN 保留同判定分支。
 *  - web 时间格式化用 Intl.DateTimeFormat(undefined, ...)；
 *    RN 由薄壳按当前 locale 注入 timeText（时间格式化在薄壳完成）。
 *
 * 平台无关：取数/时间格式化/百分比计算/登录门全部由薄壳注入，
 * 本文件只管渲染与三态。
 */
export function StockAnalyseScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  balance,
  usedPercent,
  balanceLoading,
  balanceError,
  symbolValue,
  onSymbolChange,
  questionValue,
  onQuestionChange,
  questionMaxLength,
  analysing,
  canAnalyse,
  onAnalyse,
  analyseError,
  analyseErrorTitle,
  result,
  mockWarningText,
  historyLoading,
  historyError,
  historyRows,
  onSelectHistory,
  detailVisible,
  detail,
  onCloseDetail,
}: StockAnalyseScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, barTone } = useMemo(() => createStyles(tk), [tk])

  const barStyle = barTone(usedPercent)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <LineChart size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.muted}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Coins size={18} color={tk.brand.DEFAULT} />
              <Text style={styles.cardTitle}>{t(`${NS}.tokenBalance`)}</Text>
            </View>
            {balanceLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t('common.loading')}</Text>
              </View>
            ) : balanceError ? (
              <Text style={styles.error}>{balanceError}</Text>
            ) : (
              <>
                <View style={styles.balanceRow}>
                  <View style={styles.balanceCell}>
                    <Text style={styles.balanceLabel}>{t(`${NS}.total`)}</Text>
                    <Text style={styles.balanceValue}>{balance.total.toLocaleString()}</Text>
                  </View>
                  <View style={styles.balanceCell}>
                    <Text style={styles.balanceLabel}>{t(`${NS}.used`)}</Text>
                    <Text style={styles.balanceValue}>{balance.used.toLocaleString()}</Text>
                  </View>
                  <View style={styles.balanceCell}>
                    <Text style={styles.balanceLabel}>{t(`${NS}.remaining`)}</Text>
                    <Text style={[styles.balanceValue, styles.balanceRemaining]}>
                      {balance.remaining.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, barStyle, { width: `${usedPercent}%` }]} />
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t(`${NS}.symbol`)}</Text>
            <TextInput
              style={styles.input}
              value={symbolValue}
              onChangeText={onSymbolChange}
              placeholder={t(`${NS}.symbolPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              maxLength={20}
              autoCorrect={false}
              autoCapitalize="characters"
              underlineColorAndroid="transparent"
            />
            <Text style={styles.fieldLabel}>{t(`${NS}.question`)}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={questionValue}
              onChangeText={onQuestionChange}
              placeholder={t(`${NS}.questionPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              maxLength={questionMaxLength}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
            />
            <Text style={styles.counter}>
              {`${questionValue.length}/${questionMaxLength}`}
            </Text>
            <TouchableOpacity
              style={[styles.analyseBtn, !canAnalyse ? styles.analyseBtnDisabled : null]}
              onPress={onAnalyse}
              disabled={!canAnalyse}
            >
              {analysing ? (
                <ActivityIndicator size="small" color={tk.brand.foreground} />
              ) : (
                <TrendingUp size={16} color={tk.brand.foreground} />
              )}
              <Text style={styles.analyseBtnText}>
                {analysing ? t(`${NS}.analysing`) : t(`${NS}.analyse`)}
              </Text>
            </TouchableOpacity>
            {analyseError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{analyseErrorTitle}</Text>
                <Text style={styles.error}>{analyseError}</Text>
              </View>
            ) : null}
          </View>

          {result ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <TrendingUp size={18} color={tk.brand.DEFAULT} />
                <Text style={styles.cardTitle}>{t(`${NS}.result`)}</Text>
              </View>
              {result.errorText ? (
                <View style={styles.warnBox}>
                  <Text style={styles.warnTitle}>{mockWarningText}</Text>
                  <Text style={styles.warnText}>{result.errorText}</Text>
                </View>
              ) : null}
              {result.analysis ? (
                <Text style={styles.analysis}>{result.analysis}</Text>
              ) : result.errorText ? null : (
                <View style={styles.centerBlock}>
                  <LineChart size={26} color={tk.text.tertiary} />
                  <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Coins size={12} color={tk.text.secondary} />
                <Text style={styles.metaText}>
                  {`${t(`${NS}.tokensUsed`)}: ${result.tokensUsed.toLocaleString()}`}
                </Text>
                <Clock size={12} color={tk.text.secondary} />
                <Text style={styles.metaText}>{`${t(`${NS}.time`)}: ${result.timeText}`}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <History size={18} color={tk.brand.DEFAULT} />
              <Text style={styles.cardTitle}>{t(`${NS}.history`)}</Text>
            </View>
            {historyLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t('common.loading')}</Text>
              </View>
            ) : historyError ? (
              <Text style={styles.error}>{historyError}</Text>
            ) : historyRows.length === 0 ? (
              <View style={styles.centerBlock}>
                <History size={26} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.noHistory`)}</Text>
              </View>
            ) : (
              <FlatList
                data={historyRows}
                keyExtractor={(item) => item.conversationId}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyRow}
                    onPress={() => onSelectHistory(item.conversationId)}
                  >
                    <Text style={styles.historySymbol}>{item.symbol}</Text>
                    <View style={styles.historyBody}>
                      <Text style={styles.historyAnalysis} numberOfLines={1}>
                        {item.analysis || t(`${NS}.empty`)}
                      </Text>
                      <Text style={styles.historyTime}>{item.timeText}</Text>
                    </View>
                    <Text style={styles.historyLink}>{t(`${NS}.viewHistory`)}</Text>
                    <ChevronRight size={14} color={tk.brand.DEFAULT} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseDetail}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View style={styles.cardHead}>
                {detail ? <Text style={styles.historySymbol}>{detail.symbol}</Text> : null}
                <Text style={styles.modalTitle}>{t(`${NS}.result`)}</Text>
              </View>
              <TouchableOpacity onPress={onCloseDetail} hitSlop={8}>
                <X size={18} color={tk.text.secondary} />
              </TouchableOpacity>
            </View>
            {detail ? (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.metaRow}>
                  <Coins size={12} color={tk.text.secondary} />
                  <Text style={styles.metaText}>
                    {`${t(`${NS}.tokensUsed`)}: ${detail.tokensUsed.toLocaleString()}`}
                  </Text>
                  <Clock size={12} color={tk.text.secondary} />
                  <Text style={styles.metaText}>{detail.timeText}</Text>
                </View>
                {detail.analysis ? (
                  <Text style={styles.analysis}>{detail.analysis}</Text>
                ) : (
                  <View style={styles.centerBlock}>
                    <LineChart size={26} color={tk.text.tertiary} />
                    <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <Text style={styles.muted}>{t('common.loading')}</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
    },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    errorBox: {
      gap: 2,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.light,
    },
    errorTitle: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.danger.DEFAULT },
    warnBox: {
      gap: 2,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.warning.amberLight,
    },
    warnTitle: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.warning.amberText },
    warnText: { fontSize: rnType.caption.size, color: tk.warning.amberText },
    balanceRow: { flexDirection: 'row', gap: rnSpacing.sm },
    balanceCell: {
      flex: 1,
      gap: 2,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    balanceLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    balanceValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    balanceRemaining: { color: tk.success.deepText },
    barTrack: {
      height: 8,
      borderRadius: rnRadius.xs,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    barFill: { height: 8, borderRadius: rnRadius.xs },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    input: {
      minHeight: 40,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textarea: { minHeight: 96 },
    counter: { textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.secondary },
    analyseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.DEFAULT,
    },
    analyseBtnDisabled: { opacity: 0.5 },
    analyseBtnText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.foreground },
    analysis: { fontSize: rnType.body.size, lineHeight: 22, color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    metaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    historySymbol: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      backgroundColor: tk.surface.muted,
      color: tk.text.secondary,
    },
    historyBody: { flex: 1, gap: 2 },
    historyAnalysis: { fontSize: rnType.body.size, color: tk.text.primary },
    historyTime: { fontSize: rnType.caption.size, color: tk.text.secondary },
    historyLink: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    modalCard: {
      maxHeight: '85%',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      paddingBottom: rnSpacing.xl,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    modalTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    modalScroll: { marginTop: rnSpacing.sm },
  })

  /** 与 web 进度条分档同阈值（>=90 rose / >=60 amber / 否则 primary → danger/warning/brand） */
  const barTone = (percent: number) => {
    if (percent >= 90) return { backgroundColor: tk.danger.DEFAULT }
    if (percent >= 60) return { backgroundColor: tk.warning.DEFAULT }
    return { backgroundColor: tk.brand.DEFAULT }
  }

  return { styles, barTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
