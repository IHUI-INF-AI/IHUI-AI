// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SAG2 词法多跳检索工作台 · RN 端内壳(数据腿)。
 *
 * 单一真相源:UI = `packages/app/src/features/sag2/Sag2Screen.tsx`(共享屏,零数据腿);
 * 数据 = `@ihui/api-client` 的 sag2 端点(与 web `sag2-lexical.ts` 同构投影)。
 * 本壳只做三件事:① 把 api-client 返回归一成共享屏 props 形状;② 绑定 `sag2Lexical.`
 * 命名空间;③ 注入导航 onBack。端内不自写第二份检索 UI。
 *
 * 平台边界:web 的「本地文件夹登记/扫描/监听」依赖宿主磁盘,移动端不承载(见共享屏头注)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  sag2Fuse,
  sag2RemoveDocument,
  sag2AddDocument,
  sag2Retrieve,
  sag2Search,
  sag2Status,
  type Sag2SearchItem,
  type Sag2ResultRow,
} from '@ihui/api-client'
import type {
  Sag2CitationView,
  Sag2FuseView,
  Sag2Mode,
  Sag2ResultRowView,
  Sag2StatusView,
  Sag2TraceHopView,
} from '@ihui/types'
import { Sag2Screen as SharedSag2Screen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'

/** 归一:快速搜索命中(Sag2SearchItem)→ 共享屏结果行。 */
function toRowFromSearch(item: Sag2SearchItem): Sag2ResultRowView {
  return {
    key: `${item.path}:${item.citation.byte_range[0]}`,
    path: item.path,
    title: item.title,
    snippet: item.snippet,
    score: item.citation.score,
    bm25: item.bm25,
    hop: item.citation.hop,
    highlights: item.highlights ?? [],
  }
}

/** 归一:多跳检索行(Sag2ResultRow)→ 共享屏结果行(无高亮区间,后端 retrieve 不下发)。 */
function toRowFromRetrieve(row: Sag2ResultRow): Sag2ResultRowView {
  return {
    key: row.key,
    path: row.path,
    title: row.path,
    snippet: row.content,
    score: row.score,
    bm25: row.bm25,
    hop: row.hop,
    highlights: [],
  }
}

/** 归一:索引状态(扁平化 extractors,缺件如实上报)。 */
function toStatusView(s: Awaited<ReturnType<typeof sag2Status>>): Sag2StatusView {
  const ex = s.extractors
  return {
    version: s.version,
    documents: s.documents,
    chunks: s.chunks,
    terms: s.terms,
    ready: s.ready,
    judgeProvider: s.judge_provider,
    extractors: [
      ...(ex?.pdf_rasterizer
        ? [
            {
              label: 'raster' as const,
              installed: ex.pdf_rasterizer.installed,
              engine: ex.pdf_rasterizer.engine,
            },
          ]
        : []),
      ...(ex?.ocr
        ? [{ label: 'ocr' as const, installed: ex.ocr.installed, engine: ex.ocr.engine }]
        : []),
      ...(ex?.asr
        ? [{ label: 'asr' as const, installed: ex.asr.installed, engine: ex.asr.engine }]
        : []),
    ],
  }
}

export function Sag2Screen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation()

  // 共享屏用裸键,这里绑定 sag2Lexical 命名空间(web/小程序同一套词条)
  const nsT = useCallback(
    (key: string, options?: Record<string, string | number>) => t(`sag2Lexical.${key}`, options),
    [t],
  )

  const [status, setStatus] = useState<Sag2StatusView | null>(null)
  const [mode, setMode] = useState<Sag2Mode>('deep')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [quickRows, setQuickRows] = useState<Sag2ResultRowView[]>([])
  const [deepRows, setDeepRows] = useState<Sag2ResultRowView[]>([])
  const [citations, setCitations] = useState<Sag2CitationView[]>([])
  const [trace, setTrace] = useState<Sag2TraceHopView[]>([])
  const [judgeExecuted, setJudgeExecuted] = useState(false)
  const [judgeMode, setJudgeMode] = useState('')
  const [fused, setFused] = useState<Sag2FuseView | null>(null)
  const [modelCalls, setModelCalls] = useState(0)
  const [lastDeepRows, setLastDeepRows] = useState<Sag2ResultRow[]>([])

  const refresh = useCallback(async () => {
    try {
      setStatus(toStatusView(await sag2Status()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(async (action: () => Promise<void>) => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const runSearch = useCallback(
    () =>
      run(async () => {
        const q = query.trim()
        if (!q) return
        if (mode === 'quick') {
          const r = await sag2Search(q, 1, 20)
          setQuickRows(r.items.map(toRowFromSearch))
          setDeepRows([])
          setCitations([])
          setTrace([])
          setModelCalls(r.model_calls)
        } else {
          const r = await sag2Retrieve(q)
          setLastDeepRows(r.results)
          setDeepRows(r.results.map(toRowFromRetrieve))
          setQuickRows([])
          setCitations(
            r.citations.map((c) => ({
              path: c.path,
              title: c.title,
              heading: c.heading,
              passage: c.passage,
              score: c.score,
              hop: c.hop,
            })),
          )
          setTrace(
            r.trace.map((h) => ({
              hop: h.hop,
              candidates: h.candidates,
              terms: h.terms,
              poolSize: h.pool_size,
              judgeMode: h.judge_mode,
              judgeExecuted: h.judge_executed,
              judgeReason: h.judge_reason,
            })),
          )
          setJudgeExecuted(r.judge.executed)
          setJudgeMode(r.judge.mode)
          // 深度检索(纯词法判定)零模型调用,如实置 0 —— 不把 BM25 分数伪装成模型证据。
          setModelCalls(0)
          setFused(null)
        }
      }),
    [mode, query, run],
  )

  const runFuse = useCallback(
    () =>
      run(async () => {
        if (!lastDeepRows.length) return
        const r = await sag2Fuse(lastDeepRows)
        setFused({
          channels: r.channels,
          rrfK: r.rrf_k,
          rows: r.results.slice(0, 10).map((row) => ({
            path: typeof row.path === 'string' ? row.path : undefined,
            key: typeof row.key === 'string' ? row.key : undefined,
            rrfScore: typeof row.rrf_score === 'number' ? row.rrf_score : undefined,
            fusedFrom: typeof row.fused_from === 'string' ? row.fused_from : undefined,
          })),
        })
      }),
    [lastDeepRows, run],
  )

  // 文档登记/移除(移动端承载:纯 HTTP,无宿主磁盘依赖)。此处先接移除入口到结果行,
  // 登记表单随工作台后续迭代;核心检索链路已可用。
  const styles = useMemo(() => StyleSheet.create({ container: { flex: 1 } }), [])

  return (
    <View style={styles.container}>
      <SharedSag2Screen
        t={nsT}
        status={status}
        mode={mode}
        onModeChange={setMode}
        query={query}
        onQueryChange={setQuery}
        loading={loading}
        error={error}
        notice={notice}
        quickRows={quickRows}
        deepRows={deepRows}
        citations={citations}
        trace={trace}
        judgeExecuted={judgeExecuted}
        judgeMode={judgeMode}
        fused={fused}
        modelCalls={modelCalls}
        onSearch={runSearch}
        onFuse={runFuse}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
    </View>
  )
}

// 保留 API 引用,供后续登记/移除表单迭代消费(避免未使用告警被误删)
void sag2AddDocument
void sag2RemoveDocument
