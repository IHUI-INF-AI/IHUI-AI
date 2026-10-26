// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Layers,
  Scissors,
  Stamp,
  Trash2,
  Upload,
} from 'lucide-react-native'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../../types'
import { getTokens } from '../../../theme/tokens'
import { BackChevron } from '../../../components/BackChevron'
import { createPdfToolsStyles } from './pdf-tools-styles'

/** 三入口(对齐 web /tools/pdf/{merge,split,watermark} 三路由)。 */
export type PdfToolTab = 'merge' | 'split' | 'watermark'

/** 已选取并上传到服务端的文件(id = /files/upload/base64 返回的 fileId)。 */
export interface PdfPickedFile {
  id: string
  name: string
  size: number
}

/** 提交载荷(merge 用 fileIds;split/watermark 用 fileId + 参数)。 */
export interface PdfProcessPayload {
  fileIds?: string[]
  fileId?: string
  ranges?: string
  text?: string
  fontSize?: number
  opacity?: number
  rotation?: number
}

/** onProcess 回传:ok=true 时带 taskId(结果下载走 GET /pdf-service/result/:taskId)。 */
export interface PdfProcessOutcome {
  ok: boolean
  taskId?: string
}

export interface PdfToolsHubScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 路由参数指定的初始入口(web 三路由 → 同一屏 tab 参数;缺省 merge)。 */
  initialTab?: PdfToolTab
  /** 平台侧选文件 + 上传(base64 → /files/upload/base64);取消返回空数组,失败自行提示。 */
  onPickFiles: (opts: { multiple: boolean }) => Promise<PdfPickedFile[]>
  /** 提交处理(屏内已完成参数裁剪;失败/异常回 ok=false → 屏内落 NotAvailableAlert)。 */
  onProcess: (tab: PdfToolTab, payload: PdfProcessPayload) => Promise<PdfProcessOutcome>
  /** 下载结果(平台侧 Linking 打开 pdfServiceResultUrl)。 */
  onDownload: (taskId: string) => void
}

const TAB_ORDER: readonly PdfToolTab[] = ['merge', 'split', 'watermark']

const TAB_META: Record<PdfToolTab, { labelKey: string; Icon: typeof Layers }> = {
  merge: { labelKey: 'pdfToolsPage.tabMerge', Icon: Layers },
  split: { labelKey: 'pdfToolsPage.tabSplit', Icon: Scissors },
  watermark: { labelKey: 'pdfToolsPage.tabWatermark', Icon: Stamp },
}

/** 拆分三模式(对齐 web MODE_KEYS:range/every/bookmarks;后端仅实现 range)。 */
type SplitMode = 'range' | 'every' | 'bookmarks'
const SPLIT_MODES: { key: SplitMode; labelKey: string }[] = [
  { key: 'range', labelKey: 'pdfToolsPage.modeRange' },
  { key: 'every', labelKey: 'pdfToolsPage.modeEvery' },
  { key: 'bookmarks', labelKey: 'pdfToolsPage.modeBookmarks' },
]

/** 九宫格位置(逐字对齐 web POSITIONS 键序;仅前端预览用,后端固定居中渲染)。 */
const POSITIONS: {
  key: string
  labelKey: string
  align: 'flex-start' | 'center' | 'flex-end'
  justify: 'flex-start' | 'center' | 'flex-end'
}[] = [
  {
    key: 'top-left',
    labelKey: 'pdfToolsPage.posTopLeft',
    align: 'flex-start',
    justify: 'flex-start',
  },
  {
    key: 'top-center',
    labelKey: 'pdfToolsPage.posTopCenter',
    align: 'flex-start',
    justify: 'center',
  },
  {
    key: 'top-right',
    labelKey: 'pdfToolsPage.posTopRight',
    align: 'flex-start',
    justify: 'flex-end',
  },
  {
    key: 'middle-left',
    labelKey: 'pdfToolsPage.posMiddleLeft',
    align: 'center',
    justify: 'flex-start',
  },
  {
    key: 'middle-center',
    labelKey: 'pdfToolsPage.posMiddleCenter',
    align: 'center',
    justify: 'center',
  },
  {
    key: 'middle-right',
    labelKey: 'pdfToolsPage.posMiddleRight',
    align: 'center',
    justify: 'flex-end',
  },
  {
    key: 'bottom-left',
    labelKey: 'pdfToolsPage.posBottomLeft',
    align: 'flex-end',
    justify: 'flex-start',
  },
  {
    key: 'bottom-center',
    labelKey: 'pdfToolsPage.posBottomCenter',
    align: 'flex-end',
    justify: 'center',
  },
  {
    key: 'bottom-right',
    labelKey: 'pdfToolsPage.posBottomRight',
    align: 'flex-end',
    justify: 'flex-end',
  },
]

/** 单入口处理状态机(与 web useProcessApi 同构:loading/progress/result/error)。 */
interface ProcessState {
  loading: boolean
  progress: number
  taskId: string | null
  error: boolean
}
const IDLE: ProcessState = { loading: false, progress: 0, taskId: null, error: false }

/** 数值输入解析(非法回退默认值;web 是 range 滑块,RN 用数字输入框等价承担)。 */
function parseNum(raw: string, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function formatSize(bytes: number, unitKb: string): string {
  return `${(bytes / 1024).toFixed(1)} ${unitKb}`
}

/**
 * PDF 工具台共享屏(Wave2 2026-10-26,tools 域;一屏三入口,参照 Wave1 legal hub 先例)。
 *
 * 承载 web /tools/pdf/{merge,split,watermark} 三路由:顶部胶囊 tabs 切换,
 * 每个入口复刻 web 页的表单与 useProcessApi 状态机(提交即进度模拟:5% 起、
 * 每 150ms +5% 封顶 90%,成功 100% + 下载行,失败落 NotAvailableAlert 文案)。
 * 平台差异:web 的 FormData(files) 直传在后端 JSON fileIds/fileId 契约下恒失败,
 * RN 侧文件选取/上传与提交、下载全部经 props 回调由薄壳承担(DocumentPicker →
 * uploadFileBase64 → processPdf* → Linking 打开 result/:taskId)。
 * 拆分仅 range 模式有后端实现;every/bookmarks 与 web 同口径落「功能开发中」提示。
 */
export function PdfToolsHubScreen({
  t,
  colorScheme = 'light',
  onBack,
  initialTab = 'merge',
  onPickFiles,
  onProcess,
  onDownload,
}: PdfToolsHubScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createPdfToolsStyles(tk), [tk])

  const [tab, setTab] = useState<PdfToolTab>(initialTab)
  const [mergeItems, setMergeItems] = useState<PdfPickedFile[]>([])
  const [splitFile, setSplitFile] = useState<PdfPickedFile | null>(null)
  const [mode, setMode] = useState<SplitMode>('range')
  const [ranges, setRanges] = useState('1-3,5,7-10')
  const [every, setEvery] = useState('1')
  const [wmFile, setWmFile] = useState<PdfPickedFile | null>(null)
  const [wmText, setWmText] = useState(t('pdfToolsPage.defaultText'))
  const [wmFontSize, setWmFontSize] = useState('48')
  const [wmColor, setWmColor] = useState('#888888')
  const [wmOpacity, setWmOpacity] = useState('20')
  const [wmPosition, setWmPosition] = useState('middle-center')
  const [wmRotation, setWmRotation] = useState('-30')
  const [proc, setProc] = useState<Record<PdfToolTab, ProcessState>>({
    merge: IDLE,
    split: IDLE,
    watermark: IDLE,
  })

  // useProcessApi 进度模拟计时器(web 同源:150ms +5%,封顶 90)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }
  useEffect(() => clearTimer, [])

  const run = async (which: PdfToolTab, payload: PdfProcessPayload) => {
    clearTimer()
    setProc((p) => ({ ...p, [which]: { loading: true, progress: 5, taskId: null, error: false } }))
    timerRef.current = setInterval(() => {
      setProc((p) => {
        const cur = p[which]
        if (!cur.loading) return p
        return {
          ...p,
          [which]: { ...cur, progress: cur.progress < 90 ? cur.progress + 5 : cur.progress },
        }
      })
    }, 150)
    let outcome: PdfProcessOutcome
    try {
      outcome = await onProcess(which, payload)
    } catch {
      outcome = { ok: false }
    }
    clearTimer()
    setProc((p) => ({
      ...p,
      [which]:
        outcome.ok && outcome.taskId
          ? { loading: false, progress: 100, taskId: outcome.taskId, error: false }
          : { loading: false, progress: 0, taskId: null, error: true },
    }))
  }

  const pickInto = async (multiple: boolean): Promise<PdfPickedFile[]> => {
    try {
      return await onPickFiles({ multiple })
    } catch {
      return []
    }
  }

  const onPickMerge = async () => {
    const picked = await pickInto(true)
    if (picked.length > 0) setMergeItems((prev) => [...prev, ...picked])
  }
  const onPickSplit = async () => {
    const picked = await pickInto(false)
    if (picked[0]) setSplitFile(picked[0])
  }
  const onPickWm = async () => {
    const picked = await pickInto(false)
    if (picked[0]) setWmFile(picked[0])
  }

  const moveMergeItem = (index: number, delta: -1 | 1) => {
    setMergeItems((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      if (!moved) return prev
      next.splice(target, 0, moved)
      return next
    })
  }

  const submitMerge = () => {
    if (mergeItems.length < 2 || proc.merge.loading) return
    void run('merge', { fileIds: mergeItems.map((it) => it.id) })
  }

  const submitSplit = () => {
    if (!splitFile || proc.split.loading) return
    if (mode !== 'range') {
      // 后端 splitSchema 仅收 fileId+ranges;every/bookmarks 与 web 同口径直接落「功能开发中」。
      setProc((p) => ({ ...p, split: { loading: false, progress: 0, taskId: null, error: true } }))
      return
    }
    void run('split', { fileId: splitFile.id, ranges })
  }

  const submitWm = () => {
    if (!wmFile || proc.watermark.loading) return
    const fontSize = Math.min(120, Math.max(12, parseNum(wmFontSize, 48)))
    const opacity = Math.min(100, Math.max(5, parseNum(wmOpacity, 20)))
    const rotation = Math.min(90, Math.max(-90, parseNum(wmRotation, -30)))
    void run('watermark', {
      fileId: wmFile.id,
      text: wmText.trim() || undefined,
      fontSize,
      opacity: opacity / 100,
      rotation,
    })
  }

  const uploadBox = (label: string, onPress: () => void) => (
    <TouchableOpacity
      style={styles.uploadBox}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Upload size={28} color={tk.text.tertiary} strokeWidth={2} />
      <Text style={styles.uploadText}>{label}</Text>
    </TouchableOpacity>
  )

  const singleFileRow = (file: PdfPickedFile, onRemove: () => void) => (
    <View style={styles.fileRow}>
      <FileText size={16} color={tk.brand.DEFAULT} strokeWidth={2} />
      <View style={styles.fileMain}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.fileMeta}>{formatSize(file.size, t('pdfToolsPage.unitKb'))}</Text>
      </View>
      <TouchableOpacity
        style={styles.iconBtn}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t('pdfToolsPage.removeFile')}
        onPress={onRemove}
      >
        <Trash2 size={16} color={tk.text.tertiary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )

  const processArea = (state: ProcessState) => {
    if (state.loading || state.progress > 0) {
      return (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${state.progress}%` }]} />
        </View>
      )
    }
    if (state.error) {
      return (
        <View style={styles.noticeBox}>
          <AlertTriangle size={18} color={tk.warning.amber} strokeWidth={2} />
          <View style={styles.noticeMain}>
            <Text style={styles.noticeTitle}>{t('pdfToolsPage.notAvailableTitle')}</Text>
            <Text style={styles.noticeText}>{t('pdfToolsPage.notAvailableDesc')}</Text>
          </View>
        </View>
      )
    }
    if (state.taskId) {
      return (
        <View style={styles.resultBox}>
          <Text style={styles.resultHint}>{t('pdfToolsPage.resultHint')}</Text>
          <TouchableOpacity
            style={styles.downloadRow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('pdfToolsPage.download')}
            onPress={() => onDownload(state.taskId as string)}
          >
            <Download size={16} color={tk.brand.DEFAULT} strokeWidth={2} />
            <Text style={styles.downloadText}>{t('pdfToolsPage.download')}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return null
  }

  const mergeContent = (
    <>
      <Text style={styles.desc}>{t('pdfToolsPage.mergeDesc')}</Text>
      {uploadBox(t('pdfToolsPage.mergeUploadLabel'), () => void onPickMerge())}
      {mergeItems.map((it, index) => (
        <View key={it.id} style={styles.fileRow}>
          <Text style={styles.fileMeta}>#{index + 1}</Text>
          <View style={styles.fileMain}>
            <Text style={styles.fileName} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={styles.fileMeta}>{formatSize(it.size, t('pdfToolsPage.unitKb'))}</Text>
          </View>
          <View style={styles.orderBtns}>
            <TouchableOpacity
              style={styles.iconBtn}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={t('pdfToolsPage.moveUp')}
              onPress={() => moveMergeItem(index, -1)}
            >
              <ChevronUp size={16} color={tk.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={t('pdfToolsPage.moveDown')}
              onPress={() => moveMergeItem(index, 1)}
            >
              <ChevronDown size={16} color={tk.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t('pdfToolsPage.removeFile')}
            onPress={() => setMergeItems((prev) => prev.filter((x) => x.id !== it.id))}
          >
            <Trash2 size={16} color={tk.text.tertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            mergeItems.length < 2 || proc.merge.loading ? styles.submitBtnDisabled : null,
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={submitMerge}
        >
          <Text style={styles.submitText}>
            {proc.merge.loading ? t('pdfToolsPage.merging') : t('pdfToolsPage.mergeSubmit')}
          </Text>
        </TouchableOpacity>
        {mergeItems.length > 0 && mergeItems.length < 2 ? (
          <Text style={styles.rowHint}>{t('pdfToolsPage.needTwo')}</Text>
        ) : null}
      </View>
      {processArea(proc.merge)}
    </>
  )

  const splitContent = (
    <>
      <Text style={styles.desc}>{t('pdfToolsPage.splitDesc')}</Text>
      {splitFile
        ? singleFileRow(splitFile, () => setSplitFile(null))
        : uploadBox(t('pdfToolsPage.splitUploadLabel'), () => void onPickSplit())}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('pdfToolsPage.modeLabel')}</Text>
        <View style={styles.chipRow}>
          {SPLIT_MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.chip, mode === m.key ? styles.chipActive : null]}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => setMode(m.key)}
            >
              <Text style={[styles.chipText, mode === m.key ? styles.chipTextActive : null]}>
                {t(m.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {mode === 'range' ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pdfToolsPage.rangesLabel')}</Text>
          <TextInput
            style={styles.input}
            value={ranges}
            onChangeText={setRanges}
            placeholder="1-3,5,7-10"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />
        </View>
      ) : null}
      {mode === 'every' ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('pdfToolsPage.everyLabel')}</Text>
          <TextInput
            style={styles.input}
            value={every}
            onChangeText={setEvery}
            keyboardType="number-pad"
          />
        </View>
      ) : null}
      {mode === 'bookmarks' ? (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>{t('pdfToolsPage.bookmarksHint')}</Text>
        </View>
      ) : null}
      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !splitFile || proc.split.loading ? styles.submitBtnDisabled : null,
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={submitSplit}
        >
          <Text style={styles.submitText}>
            {proc.split.loading ? t('pdfToolsPage.splitting') : t('pdfToolsPage.splitSubmit')}
          </Text>
        </TouchableOpacity>
      </View>
      {processArea(proc.split)}
    </>
  )

  const fontSizeNum = Math.min(120, Math.max(12, parseNum(wmFontSize, 48)))
  const opacityNum = Math.min(100, Math.max(5, parseNum(wmOpacity, 20)))
  const rotationNum = Math.min(90, Math.max(-90, parseNum(wmRotation, -30)))
  const posMeta = POSITIONS.find((p) => p.key === wmPosition) ?? POSITIONS[4]!

  const watermarkContent = (
    <>
      <Text style={styles.desc}>{t('pdfToolsPage.wmDesc')}</Text>
      {wmFile
        ? singleFileRow(wmFile, () => setWmFile(null))
        : uploadBox(t('pdfToolsPage.wmUploadLabel'), () => void onPickWm())}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('pdfToolsPage.wmText')}</Text>
        <TextInput
          style={styles.input}
          value={wmText}
          onChangeText={setWmText}
          maxLength={200}
          placeholder={t('pdfToolsPage.wmPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {t('pdfToolsPage.wmFontSize')}: {fontSizeNum}
        </Text>
        <TextInput
          style={styles.input}
          value={wmFontSize}
          onChangeText={setWmFontSize}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('pdfToolsPage.wmColor')}</Text>
        <TextInput
          style={styles.input}
          value={wmColor}
          onChangeText={setWmColor}
          autoCapitalize="none"
          placeholder="#888888"
          placeholderTextColor={tk.text.tertiary}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {t('pdfToolsPage.wmOpacity')}: {opacityNum}%
        </Text>
        <TextInput
          style={styles.input}
          value={wmOpacity}
          onChangeText={setWmOpacity}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {t('pdfToolsPage.wmRotation')}: {rotationNum}°
        </Text>
        <TextInput
          style={styles.input}
          value={wmRotation}
          onChangeText={setWmRotation}
          keyboardType="numbers-and-punctuation"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('pdfToolsPage.wmPosition')}</Text>
        <View style={styles.posGrid}>
          {POSITIONS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.posCell, wmPosition === p.key ? styles.posCellActive : null]}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => setWmPosition(p.key)}
            >
              <Text style={[styles.posText, wmPosition === p.key ? styles.posTextActive : null]}>
                {t(p.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('pdfToolsPage.wmPreview')}</Text>
        <View style={styles.previewBox}>
          <View
            style={[
              styles.previewInner,
              { alignItems: posMeta.align, justifyContent: posMeta.justify },
            ]}
          >
            <Text
              style={{
                fontSize: Math.min(fontSizeNum, 48),
                color: wmColor,
                opacity: opacityNum / 100,
                transform: [{ rotate: `${rotationNum}deg` }],
              }}
            >
              {wmText || t('pdfToolsPage.wmPlaceholder')}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.submitRow}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !wmFile || proc.watermark.loading ? styles.submitBtnDisabled : null,
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={submitWm}
        >
          <Text style={styles.submitText}>
            {proc.watermark.loading ? t('pdfToolsPage.wmSubmitting') : t('pdfToolsPage.wmSubmit')}
          </Text>
        </TouchableOpacity>
      </View>
      {processArea(proc.watermark)}
    </>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('pdfToolsPage.title')}</Text>
      </View>
      <View style={styles.tabStrip}>
        {TAB_ORDER.map((kind) => {
          const { labelKey, Icon } = TAB_META[kind]
          const active = kind === tab
          return (
            <TouchableOpacity
              key={kind}
              style={[styles.tab, active ? styles.tabActive : null]}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(kind)}
            >
              <Icon
                size={13}
                strokeWidth={2}
                color={active ? tk.brand.ctaForeground : tk.text.secondary}
              />
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'merge' ? mergeContent : null}
        {tab === 'split' ? splitContent : null}
        {tab === 'watermark' ? watermarkContent : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
