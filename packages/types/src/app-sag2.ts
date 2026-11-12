// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SAG2 词法多跳检索「移动工作台」屏的形状单源。
 *
 * 真相源:web `apps/web/app/(main)/sag2/PageClient.tsx` 的检索链路(状态头 /
 * 快速搜索 / 多跳检索 / RRF 融合 / 引用锚点 / 检索轨迹)。共享屏
 * `packages/app/src/features/sag2/Sag2Screen.tsx` 直取本文件;RN 壳
 * `apps/mobile-rn/src/screens/Sag2Screen.tsx` 与小程序承载页各自注入数据腿
 * (两端数据均走 `@ihui/api-client` 的 sag2 端点,单一真相源)。
 *
 * ⚠️ 平台边界(如实登记,不是遗漏):
 * - **承载**:索引状态头 / 文档登记与移除 / 快速搜索 / 多跳检索 / RRF 融合 /
 *   引用锚点 / 检索轨迹 / 判定器状态 —— 这些是纯 HTTP + 文本 UI,三端同构。
 * - **不承载(端内私有能力)**:本地文件夹登记 / 扫描 / 自动监听。它们依赖
 *   本机文件系统 walk(后端读宿主磁盘),移动端无宿主磁盘路径可给,web 独占。
 *   RN/小程序不渲染文件夹面板,web 的 `foldersOpen` 分支不在共享屏里。
 */
import type { TFunction } from './app-shared.js'

/** 检索模式:快速(BM25 离线) / 深度(多跳 + 引用锚点)。 */
export type Sag2Mode = 'quick' | 'deep'

/**
 * 共享屏消费的结果行。两端数据腿各自把 api-client 的
 * `Sag2SearchItem` / `Sag2ResultRow` 归一成这一种,共享屏零端内分叉。
 */
export interface Sag2ResultRowView {
  key: string
  path: string
  title: string
  snippet: string
  score: number
  bm25: number
  hop: number
  /** 片段内命中区间(字符下标,左闭右开);后端不下发时为空。 */
  highlights: Array<[number, number]>
}

/** 引用锚点(可直达原文:文件 hash + byte range)。 */
export type Sag2CitationView = {
  path: string
  title: string
  heading: string
  passage: string
  score: number
  hop: number
}

/** 多跳检索的一跳轨迹(候选池 + 扩展词 + 判定器状态)。 */
export interface Sag2TraceHopView {
  hop: number
  candidates: string[]
  terms: Array<{ term: string; score: number; kind: string }>
  poolSize: number
  judgeMode: string
  judgeExecuted: boolean
  judgeReason: string
}

/** 索引状态头要展示的归一化字段(后端 extractors 探测如实透传)。 */
export interface Sag2StatusView {
  version: number
  documents: number
  chunks: number
  terms: number
  ready: boolean
  judgeProvider: string
  /** 抽取能力探测:栅格化 / OCR 是两件事,缺哪个报哪个(空数组=后端未上报)。 */
  extractors: Array<{ label: 'raster' | 'ocr' | 'asr'; installed: boolean; engine: string }>
}

/** 融合结果(三通道 RRF),共享屏以只读列表呈现。 */
export interface Sag2FuseView {
  channels: string[]
  rrfK: number
  rows: Array<{ path?: string; key?: string; rrfScore?: number; fusedFrom?: string }>
}

export interface Sag2ScreenProps {
  t: TFunction
  /** 索引状态(null=加载中/取不到)。 */
  status: Sag2StatusView | null
  /** 当前检索模式。 */
  mode: Sag2Mode
  onModeChange: (mode: Sag2Mode) => void
  query: string
  onQueryChange: (text: string) => void
  loading: boolean
  error: string
  /** 操作回执(登记成功 / 移除块数 / 融合完成 等)。 */
  notice: string
  /** 快速搜索结果(mode='quick' 时非空)。 */
  quickRows: Sag2ResultRowView[]
  /** 多跳检索结果(mode='deep' 时非空)。 */
  deepRows: Sag2ResultRowView[]
  citations: Sag2CitationView[]
  trace: Sag2TraceHopView[]
  /** 判定器是否真执行(false=纯词法判定,绝不伪装成模型证据)。 */
  judgeExecuted: boolean
  judgeMode: string
  fused: Sag2FuseView | null
  /** 模型调用次数(纯词法恒 0,如实展示)。 */
  modelCalls: number
  onSearch: () => void
  onFuse: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
