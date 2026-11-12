// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SAG2 词法多跳检索「移动工作台」共享屏(本仓自有实现)。
 *
 * 形状真相源 = `packages/types/src/app-sag2.ts`;UI 真相源 = web
 * `apps/web/app/(main)/sag2/PageClient.tsx` 的检索链路。本屏只管渲染,零数据腿、
 * 零 API 调用(packages/app 不依赖 @ihui/api-client,数据由 RN 壳 / 小程序承载页注入,
 * 与 ConnectorsScreen / LearnScreen 同一纪律)。
 *
 * 判定器未执行时显式展示「纯词法判定」(judgeExecuted=false),绝不把 BM25 分数
 * 伪装成模型证据 —— 与 web 端的诚实降级约定逐字一致。
 *
 * 平台边界:web 的「本地文件夹登记/扫描/监听」依赖宿主磁盘 walk,移动端无此能力,
 * 故不在本屏(web 独占分支);本屏覆盖三端同构的检索工作台面。
 */
import { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { EmptyState, ErrorState } from '../../components/ScreenStates'
import { BackChevron } from '../../components/BackChevron'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { Sag2ScreenProps, Sag2StatusView } from '@ihui/types'

export type { Sag2ScreenProps }

/** 命中片段高亮:区间由后端下发,本屏只切片渲染(绝不前端重算,避免与后端口径漂移)。 */
function Highlighted({
  text,
  spans,
  highlightStyle,
}: {
  text: string
  spans: Array<[number, number]>
  highlightStyle: TextStyle
}) {
  const parts = useMemo(() => {
    if (!spans || spans.length === 0) return [{ text, hit: false }]
    const out: Array<{ text: string; hit: boolean }> = []
    let cursor = 0
    for (const [start, end] of spans) {
      const from = Math.max(cursor, Math.min(start, text.length))
      const to = Math.max(from, Math.min(end, text.length))
      if (to <= from) continue
      if (from > cursor) out.push({ text: text.slice(cursor, from), hit: false })
      out.push({ text: text.slice(from, to), hit: true })
      cursor = to
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false })
    return out
  }, [text, spans])
  return (
    <Text style={highlightStyle}>
      {parts.map((p, i) => (
        <Text key={i} style={p.hit ? highlightStyle : undefined}>
          {p.text}
        </Text>
      ))}
    </Text>
  )
}

/** 索引状态头:就绪徽标 + 版本/文档/块/词项计数 + 抽取能力探测。 */
function StatusHeader({
  t,
  status,
  styles,
}: {
  t: Sag2ScreenProps['t']
  status: Sag2StatusView | null
  styles: ReturnType<typeof createStyles>
}) {
  const ready = status?.ready ?? false
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{t('title')}</Text>
      <Text style={styles.subtitle}>{t('subtitle')}</Text>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, ready ? styles.badgeReady : styles.badgeMuted]}>
          <Text style={[styles.badgeText, ready ? styles.badgeReadyText : styles.badgeMutedText]}>
            {ready ? t('ready') : t('empty')}
          </Text>
        </View>
        <Text style={styles.meta}>
          {t('version')} {status?.version ?? '—'}
        </Text>
        <Text style={styles.meta}>
          {t('documents')} {status?.documents ?? '—'}
        </Text>
        <Text style={styles.meta}>
          {t('chunks')} {status?.chunks ?? '—'}
        </Text>
        <Text style={styles.meta}>
          {t('terms')} {status?.terms ?? '—'}
        </Text>
      </View>
      {status && status.extractors.length > 0 ? (
        <View style={styles.badgeRow}>
          {status.extractors.map((e) => (
            <View key={e.label} style={styles.probe}>
              <Text style={styles.probeText}>
                {e.label === 'raster'
                  ? t('extractRaster')
                  : e.label === 'ocr'
                    ? t('extractOcr')
                    : t('extractAsr')}{' '}
                {e.installed ? e.engine : t('missing')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {status ? (
        <Text style={styles.judgeProvider}>
          {t('judgeProvider')} {status.judgeProvider}
        </Text>
      ) : null}
    </View>
  )
}

/** 检索链路:模式切换(快速/深度) + 查询框 + 结果列表 + 引用锚点 + 轨迹 + 融合。 */
function SearchPanel({
  t,
  mode,
  onModeChange,
  query,
  onQueryChange,
  quickRows,
  deepRows,
  citations,
  trace,
  judgeExecuted,
  judgeMode,
  fused,
  modelCalls,
  onSearch,
  onFuse,
  loading,
  styles,
}: Omit<Sag2ScreenProps, 'status' | 'error' | 'notice' | 'onBack' | 'colorScheme'> & {
  styles: ReturnType<typeof createStyles>
}) {
  const rows = mode === 'quick' ? quickRows : deepRows
  return (
    <View style={styles.panel}>
      {/* 模式切换:快速 = 离线 BM25;深度 = 多跳 + 引用锚点 */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'quick' && styles.modeBtnActive]}
          onPress={() => onModeChange('quick')}
        >
          <Text style={[styles.modeText, mode === 'quick' && styles.modeTextActive]}>
            {t('quick')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'deep' && styles.modeBtnActive]}
          onPress={() => onModeChange('deep')}
        >
          <Text style={[styles.modeText, mode === 'deep' && styles.modeTextActive]}>
            {t('deep')}
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('queryPlaceholder')}
        placeholderTextColor={styles.meta.color}
        multiline
      />
      <Pressable style={styles.primaryBtn} onPress={onSearch} disabled={loading}>
        <Text style={styles.primaryBtnText}>
          {loading ? t('loading') : t(mode === 'quick' ? 'quick' : 'deep')}
        </Text>
      </Pressable>

      {/* 纯词法判定(modelCalls=0)时如实展示,不把 BM25 分数伪装成模型证据。 */}
      {modelCalls === 0 ? <Text style={styles.modelCalls}>{t('modelCalls')}</Text> : null}
      {!judgeExecuted && mode === 'deep' ? (
        <View style={styles.judgeOff}>
          <Text style={styles.judgeOffText}>
            {t('judgeOff')}（{judgeMode}）
          </Text>
        </View>
      ) : null}

      {rows.length === 0 ? (
        <Text style={styles.emptyResult}>{t('emptyResult')}</Text>
      ) : (
        <View style={styles.resultList}>
          {rows.map((r) => (
            <View key={r.key} style={styles.resultCard}>
              <Text style={styles.resultPath}>
                {r.title || r.path} · {t('bm25')} {r.bm25.toFixed(3)}
              </Text>
              <Highlighted text={r.snippet} spans={r.highlights} highlightStyle={styles.hit} />
              {r.hop > 0 ? <Text style={styles.hop}>hop {r.hop}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* 融合:只在深度结果非空时可触发 */}
      {mode === 'deep' && deepRows.length > 0 ? (
        <View style={styles.fuseBlock}>
          <Pressable style={styles.fuseBtn} onPress={onFuse}>
            <Text style={styles.fuseBtnText}>{t('fuse')}</Text>
          </Pressable>
          {fused ? (
            <View style={styles.fuseResult}>
              <Text style={styles.meta}>
                {fused.channels.join(' ⊕ ')} · rrf_k={fused.rrfK}
              </Text>
              {fused.rows.slice(0, 10).map((row, i) => (
                <Text key={row.key ?? row.path ?? i} style={styles.fuseRow}>
                  {row.path ?? row.key} · {(row.rrfScore ?? 0).toFixed(4)}
                  {row.fusedFrom ? ` ← ${row.fusedFrom}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 引用锚点:可直达原文(文件 hash + byte range 由后端下发) */}
      {citations.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('citations')}</Text>
          {citations.map((c, i) => (
            <View key={`${c.path}:${i}`} style={styles.citation}>
              <Text style={styles.citationTitle}>
                {c.title || c.path} · {c.heading}
              </Text>
              <Text style={styles.citationPassage} numberOfLines={3}>
                {c.passage}
              </Text>
              <Text style={styles.meta}>
                {t('score')} {c.score.toFixed(3)} · hop {c.hop}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* 检索轨迹:多跳的候选池 + 扩展词 + 判定器状态,全程可追溯 */}
      {trace.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('trace')}</Text>
          {trace.map((h) => (
            <View key={h.hop} style={styles.traceHop}>
              <Text style={styles.traceHopTitle}>
                hop {h.hop} · {t('tracePool')} {h.poolSize}
              </Text>
              <Text style={styles.meta}>{h.candidates.slice(0, 8).join(' / ')}</Text>
              {h.terms.length > 0 ? (
                <Text style={styles.meta}>
                  {t('traceTerms')}: {h.terms.map((x) => `${x.term}(${x.kind})`).join(', ')}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                judge={h.judgeMode} · {h.judgeExecuted ? 'executed' : 'not-executed'} ·{' '}
                {h.judgeReason}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** 主屏:状态头 + 检索工作台。零数据腿 —— 数据与回调全由端内壳注入。 */
export function Sag2Screen({
  t,
  status,
  mode,
  onModeChange,
  query,
  onQueryChange,
  loading,
  error,
  notice,
  quickRows,
  deepRows,
  citations,
  trace,
  judgeExecuted,
  judgeMode,
  fused,
  modelCalls,
  onSearch,
  onFuse,
  onBack,
  colorScheme = 'light',
}: Sag2ScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.screen}>
      <View style={styles.navBar}>
        <BackChevron onPress={onBack} colorScheme={colorScheme} />
        <Text style={styles.navTitle}>{t('title')}</Text>
      </View>
      {error ? <ErrorState message={error} colorScheme={colorScheme} /> : null}
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <StatusHeader t={t} status={status} styles={styles} />
        <SearchPanel
          t={t}
          mode={mode}
          onModeChange={onModeChange}
          query={query}
          onQueryChange={onQueryChange}
          loading={loading}
          quickRows={quickRows}
          deepRows={deepRows}
          citations={citations}
          trace={trace}
          judgeExecuted={judgeExecuted}
          judgeMode={judgeMode}
          fused={fused}
          modelCalls={modelCalls}
          onSearch={onSearch}
          onFuse={onFuse}
          styles={styles}
        />
        {status === null && !loading ? (
          <EmptyState title={t('empty')} colorScheme={colorScheme} />
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tk.surface.card } as ViewStyle,
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    } as ViewStyle,
    navTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    body: { flex: 1 } as ViewStyle,
    bodyContent: { padding: rnSpacing.md, gap: rnSpacing.md } as ViewStyle,
    notice: {
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    } as ViewStyle,
    noticeText: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,

    header: { gap: rnSpacing.xs } as ViewStyle,
    title: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    subtitle: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    } as ViewStyle,
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
    } as ViewStyle,
    badgeReady: { backgroundColor: tk.brand.DEFAULT, borderColor: tk.brand.DEFAULT } as ViewStyle,
    badgeMuted: { backgroundColor: tk.surface.muted, borderColor: tk.border.medium } as ViewStyle,
    badgeText: { fontSize: rnType.caption.size, fontWeight: '600' } as TextStyle,
    badgeReadyText: { color: tk.brand.ctaForeground } as TextStyle,
    badgeMutedText: { color: tk.text.secondary } as TextStyle,
    meta: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    probe: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    } as ViewStyle,
    probeText: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    judgeProvider: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,

    panel: { gap: rnSpacing.sm } as ViewStyle,
    modeRow: { flexDirection: 'row', gap: rnSpacing.sm } as ViewStyle,
    modeBtn: {
      flex: 1,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
    } as ViewStyle,
    modeBtnActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    modeText: { fontSize: rnType.body.size, color: tk.text.secondary } as TextStyle,
    modeTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' } as TextStyle,
    input: {
      borderWidth: 1,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.card,
      minHeight: 64,
      textAlignVertical: 'top',
    } as TextStyle,
    primaryBtn: {
      backgroundColor: tk.brand.cta,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      alignItems: 'center',
    } as ViewStyle,
    primaryBtnText: {
      color: tk.brand.ctaForeground,
      fontWeight: '600',
      fontSize: rnType.body.size,
    } as TextStyle,
    modelCalls: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    judgeOff: {
      backgroundColor: tk.surface.muted,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.sm,
    } as ViewStyle,
    judgeOffText: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    emptyResult: { fontSize: rnType.body.size, color: tk.text.secondary } as TextStyle,

    resultList: { gap: rnSpacing.sm } as ViewStyle,
    resultCard: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      padding: rnSpacing.sm,
      gap: rnSpacing.xs,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    resultPath: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    hit: { backgroundColor: tk.surface.muted, color: tk.text.primary } as TextStyle,
    hop: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,

    fuseBlock: { gap: rnSpacing.xs } as ViewStyle,
    fuseBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
    } as ViewStyle,
    fuseBtnText: {
      color: tk.text.primary,
      fontSize: rnType.caption.size,
      fontWeight: '600',
    } as TextStyle,
    fuseResult: { gap: rnSpacing.xs } as ViewStyle,
    fuseRow: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,

    section: { gap: rnSpacing.xs, marginTop: rnSpacing.xs } as ViewStyle,
    sectionTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    citation: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      padding: rnSpacing.sm,
      gap: rnSpacing.xs,
    } as ViewStyle,
    citationTitle: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    citationPassage: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    traceHop: {
      gap: rnSpacing.xs,
      paddingLeft: rnSpacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: tk.border.light,
    } as ViewStyle,
    traceHopTitle: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
  })
}
